package ketech

import (
	"errors"
	"fmt"
	"slices"
	"sort"
	"strconv"
	"strings"

	"rail-announcements-backend/internal/plan"
)

type clips = []plan.Clip

func clip(id string, delay int) plan.Clip { return plan.Clip{ID: id, Delay: delay} }

func (v *Voice) chime(chime Chime, fanfare bool) clips {
	if chime == ChimeNone {
		if fanfare {
			return clips{{ID: "sfx - fanfare", Prefix: sharedPrefix}}
		}
		return nil
	}
	name := string(chime) + " chimes"
	if fanfare {
		name = "fanfare and " + name
	}
	return clips{{ID: "sfx - " + name, Prefix: sharedPrefix}}
}

func (v *Voice) stopList() plan.PluraliseOptions {
	o := v.CallingPointsOptions
	return plan.PluraliseOptions{
		AndID:           "m.and",
		FirstItemDelay:  &o.AfterCallingAtDelay,
		BeforeItemDelay: &o.BetweenStopsDelay,
		BeforeAndDelay:  &o.AroundAndDelay,
		AfterAndDelay:   &o.AroundAndDelay,
	}
}

func (v *Voice) stationList(prefix, finalPrefix string) plan.PluraliseOptions {
	o := v.stopList()
	o.Prefix, o.FinalPrefix = &prefix, &finalPrefix
	return o
}

func stations(inflection string, crs []string) clips {
	out := make(clips, len(crs))
	for i, code := range crs {
		out[i] = plan.Clip{ID: "station." + inflection + "." + code}
	}
	return out
}

// serviceIntro speaks the time, the operator and "service to", or "service
// from ... to" when from names where the service starts.
func (v *Voice) serviceIntro(hour, min, toc string, from clips, delay int) clips {
	files := clips{clip("hour.s."+hour, delay), {ID: "mins.m." + min}}
	direction := "service to"
	if len(from) > 0 {
		direction = "service from"
		from = append(slices.Clone(from), plan.Clip{ID: "m.to"})
	}
	switch {
	case toc == "":
		files = append(files, clip("m."+direction, 50))
	case v.tocIsStandalone(toc):
		files = append(files, clip("toc.m."+strings.ToLower(toc), v.BeforeTocDelay), plan.Clip{ID: "m." + direction})
	default:
		files = append(files, clip("toc.m."+strings.ToLower(toc)+" "+direction, v.BeforeTocDelay))
	}
	return append(files, from...)
}

func viaList(vias []string, middle bool) clips {
	items := make(clips, len(vias))
	for i, crs := range vias {
		inflection := "m"
		if !middle && i == len(vias)-1 {
			inflection = "e"
		}
		items[i] = plan.Clip{ID: "station." + inflection + "." + crs}
	}
	return plan.Pluralise(items, plan.PluraliseOptions{AndID: "m.and", BeforeAndDelay: plan.Ptr(100)})
}

// basicTrainInfo names a train by its time, operator and destination. A train
// that divides is named by both portions' destinations, read out of its calls.
func (v *Voice) basicTrainInfo(hour, min, toc string, vias []string, terminating string, callingAt []CallingPoint, middle bool, from clips) clips {
	files := v.serviceIntro(hour, min, toc, from, 0)
	end := "e"
	if middle {
		end = "m"
	}

	dividesAt := slices.IndexFunc(callingAt, CallingPoint.splits)
	if dividesAt != -1 && len(callingAt[dividesAt].SplitCallingPoints) > 0 {
		point := callingAt[dividesAt]
		lastStop := func(points []CallingPoint) string { return points[len(points)-1].CRSCode }
		destinations := []string{terminating, point.CRSCode}
		if point.SplitType != "splitTerminates" {
			destinations[1] = lastStop(point.SplitCallingPoints)
		}
		for _, further := range point.FurtherSplits {
			if len(further.SplitCallingPoints) > 0 {
				destinations = append(destinations, lastStop(further.SplitCallingPoints))
			}
		}
		return append(files, plan.Pluralise(plan.IDs(destinations...), plan.PluraliseOptions{
			Prefix:          plan.Ptr("station.m."),
			FinalPrefix:     plan.Ptr("station." + end + "."),
			AndID:           "m.and",
			FirstItemDelay:  plan.Ptr(100),
			BeforeAndDelay:  plan.Ptr(100),
			BeforeItemDelay: plan.Ptr(50),
		})...)
	}

	if len(vias) == 0 {
		return append(files, plan.Clip{ID: "station." + end + "." + terminating})
	}
	files = append(files, plan.Clip{ID: "station.m." + terminating}, plan.Clip{ID: "m.via"})
	return append(files, viaList(vias, middle)...)
}

// basicTrainInfoLive names a train by every destination the feed gave it.
func (v *Voice) basicTrainInfoLive(hour, min, toc string, d Destinations, middle bool, from clips) clips {
	files := v.serviceIntro(hour, min, toc, from, 0)
	for i, station := range d.Stations {
		last := i == len(d.Stations)-1
		var vias []string
		if i < len(d.Vias) {
			vias = d.Vias[i]
		}
		if len(vias) > 0 {
			files = append(files, plan.Clip{ID: "station.m." + station}, plan.Clip{ID: "m.via"})
			files = append(files, viaList(vias, middle)...)
		} else if last && !middle {
			files = append(files, plan.Clip{ID: "station.e." + station})
		} else {
			files = append(files, plan.Clip{ID: "station.m." + station})
		}
		if !last {
			files = append(files, plan.Clip{ID: "m.and"})
		}
	}
	return files
}

func (v *Voice) routeInfo(o RouteOptions, callingAt []CallingPoint, middle bool, from clips) clips {
	if o.Destinations.Live {
		return v.basicTrainInfoLive(o.Hour, o.Min, o.Toc, o.Destinations, middle, from)
	}
	terminating, vias := "", []string(nil)
	if len(o.Destinations.Stations) > 0 {
		terminating = o.Destinations.Stations[0]
	}
	if len(o.Destinations.Vias) > 0 {
		vias = o.Destinations.Vias[0]
	}
	return v.basicTrainInfo(o.Hour, o.Min, o.Toc, vias, terminating, callingAt, middle, from)
}

type portionInfo struct {
	position string
	length   *int
}

type splitStop struct {
	crsCode       string
	shortPlatform string
	requestStop   bool
	portion       portionInfo
}

type splitPortion struct {
	stops    []splitStop
	position string
	length   *int
}

type splitInfo struct {
	divideType string
	stopsUpTo  []splitStop
	splitA     *splitPortion
	splitB     *splitPortion
	// further are the portions that divide off beyond the first, which only
	// the live feed describes.
	further []*splitPortion
}

func (s splitInfo) allStops() []splitStop {
	all := slices.Clone(s.stopsUpTo)
	if s.splitA != nil {
		all = append(all, s.splitA.stops...)
	}
	if s.splitB != nil {
		all = append(all, s.splitB.stops...)
	}
	for _, portion := range s.further {
		all = append(all, portion.stops...)
	}
	return all
}

// splitForm reads "front.4" into its position and length. The length is nil
// when the form has none or it is not a number.
func splitForm(form string) (string, *int) {
	position, size, found := strings.Cut(form, ".")
	if !found {
		return position, nil
	}
	if n, ok := jsParseInt(size); ok {
		return position, &n
	}
	return position, nil
}

// fitsPortion drops a short platform that this portion of the train is short
// enough to fit.
func fitsPortion(shortPlatform string, portionLength int) string {
	position, size, _ := strings.Cut(shortPlatform, ".")
	if position == "" || size == "" {
		return ""
	}
	if n, ok := jsParseInt(size); ok && n >= portionLength {
		return ""
	}
	return position + "." + size
}

func (v *Voice) splitInfo(callingAt []CallingPoint, terminating string, overallLength *int) splitInfo {
	divide := slices.IndexFunc(callingAt, CallingPoint.splits)
	if divide == -1 {
		stops := make([]splitStop, len(callingAt))
		for i, p := range callingAt {
			stops[i] = splitStop{p.CRSCode, p.ShortPlatform, p.RequestStop, portionInfo{"any", overallLength}}
		}
		return splitInfo{divideType: "none", stopsUpTo: stops}
	}

	point := callingAt[divide]
	before := callingAt[:divide+1]
	after := append(slices.Clone(callingAt[divide+1:]), CallingPoint{CRSCode: terminating})

	form := "front.1"
	if point.SplitForm != nil && *point.SplitForm != "" {
		form = *point.SplitForm
	}
	bPos, bCount := splitForm(form)
	type furtherForm struct {
		position string
		count    *int
		points   []CallingPoint
	}
	further := make([]furtherForm, len(point.FurtherSplits))
	// The rest of the train is at an end that no portion dividing off is at,
	// wherever those are known to be.
	taken := []string{bPos}
	counts := []*int{bCount}
	for i, split := range point.FurtherSplits {
		position, count := splitForm(split.SplitForm)
		further[i] = furtherForm{position, count, split.SplitCallingPoints}
		taken, counts = append(taken, position), append(counts, count)
	}
	aPos := "middle"
	switch {
	case slices.Contains(taken, "unknown"):
		aPos = "unknown"
	case !slices.Contains(taken, "front"):
		aPos = "front"
	case !slices.Contains(taken, "rear"):
		aPos = "rear"
	}

	dividing := 0
	known := overallLength != nil && *overallLength != 0
	for _, count := range counts {
		if count == nil || *count == 0 {
			known = false
			break
		}
		dividing += *count
	}
	known = known && dividing != 0
	if !known {
		unknown := func(points []CallingPoint, position string) []splitStop {
			stops := make([]splitStop, len(points))
			for i, p := range points {
				short := ""
				if p.ShortPlatform != "" {
					short = "unknown"
				}
				stops[i] = splitStop{p.CRSCode, short, p.RequestStop, portionInfo{position, nil}}
			}
			return stops
		}
		upTo := make([]splitStop, len(before))
		for i, p := range before {
			upTo[i] = splitStop{p.CRSCode, p.ShortPlatform, p.RequestStop, portionInfo{"any", nil}}
		}
		// A portion's length comes from the split form, so it's known even
		// when the train's isn't.
		length := func(count *int) *int {
			if count != nil && *count == 0 {
				return nil
			}
			return count
		}
		info := splitInfo{
			divideType: point.SplitType,
			stopsUpTo:  upTo,
			splitB:     &splitPortion{unknown(point.SplitCallingPoints, bPos), bPos, length(bCount)},
			splitA:     &splitPortion{unknown(after, aPos), aPos, nil},
		}
		for _, split := range further {
			info.further = append(info.further, &splitPortion{unknown(split.points, split.position), split.position, length(split.count)})
		}
		return info
	}

	aCount := min(max(1, *overallLength-dividing), 12)
	portion := func(points []CallingPoint, position string, length int) []splitStop {
		stops := make([]splitStop, len(points))
		for i, p := range points {
			stops[i] = splitStop{p.CRSCode, fitsPortion(p.ShortPlatform, length), p.RequestStop, portionInfo{position, &length}}
		}
		return stops
	}
	upTo := make([]splitStop, len(before))
	for i, p := range before {
		upTo[i] = splitStop{p.CRSCode, p.ShortPlatform, p.RequestStop, portionInfo{"any", overallLength}}
	}
	var bStops []splitStop
	if point.SplitType != "splitTerminates" {
		bStops = portion(point.SplitCallingPoints, bPos, *bCount)
	}
	info := splitInfo{
		divideType: point.SplitType,
		stopsUpTo:  upTo,
		splitB:     &splitPortion{bStops, bPos, bCount},
		splitA:     &splitPortion{portion(after, aPos, aCount), aPos, &aCount},
	}
	for _, split := range further {
		info.further = append(info.further, &splitPortion{portion(split.points, split.position, *split.count), split.position, split.count})
	}
	return info
}

func lengthText(n *int) string {
	if n == nil {
		return "null"
	}
	return fmt.Sprint(*n)
}

func (v *Voice) shortPlatformClips(short string, stop portionInfo, afterSplit bool) []string {
	position, length := splitForm(short)
	one := length != nil && *length == 1
	join := func(shortCoachOfPortionOfTrain bool) []string {
		if one && !shortCoachOfPortionOfTrain {
			return []string{fmt.Sprintf("e.should join the %s coach only", position)}
		} else if one && shortCoachOfPortionOfTrain {
			// No voice has "should join the … coach only" with a middle inflection.
			return []string{fmt.Sprintf("m.should join the %s", position), "m.coach"}
		}
		return []string{fmt.Sprintf("e.should join the %s %s coaches", position, lengthText(length))}
	}
	switch {
	case stop.position == "any":
		if position == "unknown" {
			return []string{v.ShortPlatformOptions.UnknownLocation}
		}
		return join(false)
	case !afterSplit:
		return nil
	// The coaches to join can't be placed within a portion whose own place in
	// the train isn't known.
	case position == "unknown" || stop.position == "unknown":
		return []string{v.ShortPlatformOptions.UnknownLocation}
	case stop.position == position:
		return join(false)
	}
	files := append(join(true), "m.of", "m.the", "m."+stop.position)
	if stop.length != nil && *stop.length == 1 {
		return append(files, "e.coach")
	}
	return append(files, "platform.s."+lengthText(stop.length), "e.coaches")
}

func (v *Voice) shortPlatforms(callingAt []CallingPoint, terminating string, overallLength *int, afterSplit bool) clips {
	// Stations that are told the same thing are told it together.
	groups := map[string][]string{}
	for _, stop := range v.splitInfo(callingAt, terminating, overallLength).allStops() {
		if stop.shortPlatform == "" {
			continue
		}
		spoken := strings.Join(v.shortPlatformClips(stop.shortPlatform, stop.portion, afterSplit), ",")
		if spoken != "" {
			groups[spoken] = append(groups[spoken], stop.crsCode)
		}
	}
	order := make([]string, 0, len(groups))
	for spoken := range groups {
		order = append(order, spoken)
	}
	sort.Strings(order)

	var files clips
	for i, spoken := range order {
		platforms := groups[spoken]
		last := i == len(order)-1
		switch {
		case i == 0 && len(order) == 1 && len(platforms) == 1:
			files = append(files,
				clip("m.due to a short platform at", v.BeforeSectionDelay),
				plan.Clip{ID: "station.m." + platforms[0]},
				plan.Clip{ID: "m.customers for this station"})
		case i == 0:
			files = append(files, clip("s.due to short platforms customers for", v.BeforeSectionDelay))
			files = append(files, plan.Pluralise(plan.IDs(platforms...), v.stationList("station.m.", "station.m."))...)
		case last:
			// https://github.com/davwheat/rail-announcements/issues/226#issuecomment-2212472715
			files = append(files, clip("m.and customers for", 0))
			files = append(files, plan.Pluralise(plan.IDs(platforms...), v.stationList("station.m.", "station.m."))...)
		default:
			files = append(files, clip("m.customers for", 200))
			files = append(files, plan.Pluralise(plan.IDs(platforms...), v.stationList("station.m.", "station.m."))...)
		}
		files = append(files, plan.IDs(strings.Split(spoken, ",")...)...)
	}
	return files
}

func (v *Voice) requestStops(callingAt []CallingPoint, terminating string, overallLength *int) clips {
	var stops []string
	for _, stop := range v.splitInfo(callingAt, terminating, overallLength).allStops() {
		if stop.requestStop && !slices.Contains(stops, stop.crsCode) {
			stops = append(stops, stop.crsCode)
		}
	}
	if len(stops) == 0 {
		return nil
	}
	list := v.stationList("station.m.", "station.m.")
	list.AndID = v.RequestStopOptions.AndID
	files := clips{clip("s.customers may request to stop at", 400)}
	files = append(files, plan.Pluralise(plan.IDs(stops...), list)...)
	return append(files, plan.Clip{ID: "e.by contacting the conductor on board the train"})
}

func (v *Voice) callingPointsWithBus(callingAt []CallingPoint, terminating string) clips {
	busAfter := slices.IndexFunc(callingAt, func(p CallingPoint) bool { return p.ContinuesAsRrbAfterHere })
	trainAfter := slices.IndexFunc(callingAt, func(p CallingPoint) bool { return p.ContinuesAsTrainAfterHere })

	byTrain := callingAt[:busAfter+1]
	busEnd := len(callingAt)
	if trainAfter != -1 {
		busEnd = max(busAfter+1, min(trainAfter+1, len(callingAt)))
	}
	byBus := crsCodes(callingAt[busAfter+1 : busEnd])
	var restarted []string
	if trainAfter != -1 {
		restarted = crsCodes(callingAt[trainAfter+1:])
	}

	var files clips
	if len(byTrain) >= 1 {
		files = append(files, clip("m.calling at", v.CallingPointsOptions.BeforeCallingAtDelay))
		files = append(files, plan.Pluralise(stations("m", crsCodes(byTrain)), v.stopList())...)
	}
	files = append(files,
		plan.Clip{ID: v.CallingPointsOptions.RrbTerminateAudio},
		clip("s.a replacement bus service will then continue to", v.ShortDelay))
	if trainAfter == -1 {
		byBus = append(byBus, terminating)
	}
	files = append(files, plan.Pluralise(stations("m", byBus), v.stopList())...)

	if trainAfter == -1 {
		return append(files, plan.Clip{ID: "e.where the train was originally due to terminate"})
	}
	files = append(files, plan.Clip{ID: "m.where the train will restart for-2"})
	if len(restarted) == 0 {
		return append(files, plan.Clip{ID: "station.m." + terminating}, plan.Clip{ID: "e.only"})
	}
	items := append(stations("m", restarted), plan.Clip{ID: "station.e." + terminating})
	return append(files, plan.Pluralise(items, v.stopList())...)
}

func shouldTravelIn(length *int, position string) clips {
	switch {
	case length == nil:
		return plan.IDs("e.should travel in the " + position + " coaches of the train")
	case *length >= 2 && *length <= 8:
		return plan.IDs("m.should travel in the "+position, fmt.Sprintf("e.%d coaches of the train", *length))
	case *length == 1:
		return plan.IDs("e.should travel in the " + position + " coach of the train")
	}
	return plan.IDs("m.should travel in the "+position, fmt.Sprintf("platform.s.%d", *length), "e.coaches of the train")
}

var errNoSplitCalls = errors.New("Splitting train doesn't have any calling points")

func (v *Voice) callingPointsWithSplits(callingAt []CallingPoint, terminating string, overallLength *int, arriving bool) (clips, error) {
	split := v.splitInfo(callingAt, terminating, overallLength)
	if split.divideType == "none" {
		return nil, nil
	}
	splitPoint := split.stopsUpTo[len(split.stopsUpTo)-1]

	var upTo []string
	for _, stop := range split.stopsUpTo {
		if !stop.requestStop {
			upTo = append(upTo, stop.crsCode)
		}
	}
	files := plan.Pluralise(stations("m", upTo), v.stopList())

	correctPart := v.SplitOptions.TravelInCorrectPartID
	divide := append(clips{{ID: "e.where the train will divide"}, clip(correctPart[0], 400)}, plan.IDs(correctPart[1:]...)...)
	switch split.divideType {
	case "splitTerminates":
		files = append(files, divide...)
		terminatesAt := plan.Clip{ID: "station.e." + splitPoint.crsCode}
		if b := split.splitB; b.position != "unknown" && b.length != nil {
			coaches := "coach"
			if *b.length != 1 {
				coaches = lengthText(b.length) + " coaches"
			}
			files = append(files, clip("s.please note that the "+b.position, 400), plan.Clip{ID: "m." + coaches + " will detach at"}, terminatesAt)
		} else if ids := v.SplitOptions.DetachesAndTerminatesIDs; ids != nil {
			note := "s.please note that"
			if b.position != "unknown" {
				note += " the " + b.position
			}
			files = append(append(append(files, clip(note, 400)), plan.IDs(ids...)...), terminatesAt)
		}
	case "splits":
		files = append(files, divide...)
		if len(split.splitB.stops) == 0 {
			return nil, errNoSplitCalls
		}
	}

	portionStops := func(p *splitPortion) []string {
		var out []string
		for _, stop := range p.stops {
			out = append(out, stop.crsCode)
		}
		// The division point can lead the portion's own calls.
		if len(out) > 0 && out[0] == splitPoint.crsCode {
			out = out[1:]
		}
		return out
	}
	listStops := func(stops []string) clips {
		return append(clips{clip("s.customers for", 400)}, plan.Pluralise(stations("m", stops), v.stopList())...)
	}
	portionFiles := func(p *splitPortion) clips {
		stops := portionStops(p)
		if len(stops) == 0 {
			return nil
		}
		if p.position == "unknown" {
			return append(listStops(stops), plan.Clip{ID: v.ShortPlatformOptions.UnknownLocation})
		}
		return append(listStops(stops), shouldTravelIn(p.length, p.position)...)
	}

	if len(split.stopsUpTo) != 0 {
		var any []string
		for _, stop := range split.stopsUpTo {
			any = append(any, stop.crsCode)
		}
		files = append(files, listStops(any)...)
		files = append(files, plan.IDs(v.SplitOptions.TravelInAnyPartIDs...)...)
	}

	if split.splitA.position == "rear" {
		files = append(files, portionFiles(split.splitB)...)
		files = append(files, portionFiles(split.splitA)...)
	} else {
		files = append(files, portionFiles(split.splitA)...)
		files = append(files, portionFiles(split.splitB)...)
	}
	for _, portion := range split.further {
		files = append(files, portionFiles(portion)...)
	}

	if split.divideType == "splitTerminates" || split.divideType == "splits" {
		which := "the next"
		if arriving {
			which = "this"
		}
		files = append(files, clip("s."+which+" train will divide at", 200), plan.Clip{ID: "station.e." + splitPoint.crsCode})
	}
	return files, nil
}

func (v *Voice) callingPoints(callingAt []CallingPoint, terminating string, overallLength *int, arriving bool) (clips, error) {
	if slices.ContainsFunc(callingAt, func(p CallingPoint) bool { return p.ContinuesAsRrbAfterHere }) {
		return v.callingPointsWithBus(callingAt, terminating), nil
	}
	callingAtClip := clip("m.calling at", v.CallingPointsOptions.BeforeCallingAtDelay)
	withSplits, err := v.callingPointsWithSplits(callingAt, terminating, overallLength, arriving)
	if err != nil {
		return nil, err
	}
	if len(withSplits) != 0 {
		return append(clips{callingAtClip}, withSplits...), nil
	}
	if len(callingAt) == 0 {
		return clips{callingAtClip, {ID: "station.m." + terminating}, {ID: "e.only"}}, nil
	}
	var items clips
	for _, stop := range callingAt {
		if !stop.RequestStop {
			items = append(items, plan.Clip{ID: "station.m." + stop.CRSCode})
		}
	}
	items = append(items, plan.Clip{ID: "station.e." + terminating})
	return append(clips{callingAtClip}, plan.Pluralise(items, v.stopList())...), nil
}

func (o TrainOptions) coachCount() *int {
	if o.Coaches == "None" {
		return nil
	}
	count, _, _ := strings.Cut(o.Coaches, " ")
	if n, ok := jsParseInt(count); ok {
		return &n
	}
	return nil
}

func (v *Voice) forThePlatform(platform string, delayed bool, delay int) clips {
	forThe := plan.Clip{ID: "m.for the"}
	if delayed {
		forThe.ID = "m.for the delayed"
	}
	n, numeric := jsParseInt(platform)
	lower := strings.ToLower(platform)
	switch {
	case platform == "0":
		return clips{clip(v.GenericOptions.Platform, delay), {ID: "m.0"}, forThe}
	case numeric && n <= 12, slices.Contains(v.GenericOptions.LetteredPlatformsWithForThe, lower):
		files := clips{clip("s.platform "+platform+" for the", delay)}
		if delayed {
			files = append(files, plan.Clip{ID: "m.delayed"})
		}
		return files
	case numeric && n >= 21:
		return clips{clip(v.GenericOptions.Platform, delay), {ID: "mins.m." + platform}, forThe}
	}
	return clips{clip(v.GenericOptions.Platform, delay), {ID: "platform.s." + platform}, forThe}
}

func serviceLoading(loading string) clips {
	switch loading {
	case "full and standing":
		return clips{clip("e.this service has been reported as full and standing", 500)}
	case "no seats available":
		return clips{
			clip("s.im sorry to inform you", 500),
			{ID: "m.that this service has standing passengers already"},
			{ID: "e.and no seats are available for passengers joining at this station"},
		}
	}
	return nil
}

func firstClass(location string) clips {
	if location == "none" || location == "" {
		return nil
	}
	return clips{clip("m.first class accommodation is situated at the", 500), {ID: "e." + location + " of the train"}}
}

func (v *Voice) notCallingAt(points []CallingPoint) clips {
	if len(points) == 0 {
		return nil
	}
	files := clips{clip("s.please note this train will not call at", 250)}
	return append(files, plan.Pluralise(plan.IDs(crsCodes(points)...), v.stationList("station.m.", "station.e."))...)
}

func (o TrainOptions) finish(files clips) plan.Plan {
	p := plan.Plan{Clips: files, MissingAudioMode: mode(o.MissingAudioMode)}
	if o.FromLive {
		p.StartDelay = 1000
	}
	return p
}

func mode(m plan.MissingAudioMode) plan.MissingAudioMode {
	if m == "" {
		return plan.SkipService
	}
	return m
}

// platformProblem refuses a platform that can't be spoken: the voice doesn't
// offer it, and the minute recordings that stand in for 21 and above don't
// cover it.
func (v *Voice) platformProblem(platform string) error {
	if slices.Contains(v.Platforms, strings.ToLower(platform)) {
		return nil
	}
	if n, err := strconv.Atoi(platform); err == nil && allDigits(platform) && n >= 21 && n <= 59 {
		return nil
	}
	return fmt.Errorf("Platform %s is not available with this announcement system.", platform)
}

func allDigits(s string) bool {
	return s != "" && strings.IndexFunc(s, func(r rune) bool { return r < '0' || r > '9' }) == -1
}

func (v *Voice) NextTrain(o TrainOptions) (plan.Plan, error) {
	if err := v.platformProblem(o.Platform); err != nil {
		return plan.Plan{}, err
	}
	if o.Chime == "" {
		o.Chime = v.DefaultChime
	}
	length := o.coachCount()
	info := func() clips {
		return v.basicTrainInfo(o.Hour, o.Min, o.Toc, crsCodes(o.Vias), o.TerminatingStationCode, o.CallingAt, false, nil)
	}

	files := v.chime(o.Chime, false)
	files = append(files, v.forThePlatform(o.Platform, o.IsDelayed, 250)...)
	files = append(files, info()...)
	calls, err := v.callingPoints(o.CallingAt, o.TerminatingStationCode, length, false)
	if err != nil {
		return plan.Plan{}, err
	}
	files = append(files, calls...)
	files = append(files, v.shortPlatforms(o.CallingAt, o.TerminatingStationCode, length, o.AnnounceShortPlatformsAfterSplit)...)
	files = append(files, firstClass(o.FirstClassLocation)...)
	if o.Coaches != "None" {
		// Platform numbers and coach counts share their recordings.
		count, unit, _ := strings.Cut(o.Coaches, " ")
		files = append(files, clip("s.this train is formed of", 250), plan.Clip{ID: "platform.s." + count}, plan.Clip{ID: "e." + unit})
	}
	files = append(files, v.requestStops(o.CallingAt, o.TerminatingStationCode, length)...)
	files = append(files, v.notCallingAt(o.NotCallingAtStations)...)
	files = append(files, serviceLoading(o.ServiceLoading)...)
	files = append(files, v.forThePlatform(o.Platform, o.IsDelayed, v.BeforeSectionDelay)...)
	files = append(files, info()...)
	return o.finish(files), nil
}

func (v *Voice) StandingTrain(o TrainOptions) (plan.Plan, error) {
	if err := v.platformProblem(o.Platform); err != nil {
		return plan.Plan{}, err
	}
	length := o.coachCount()
	files := clips{{ID: "station.m." + o.ThisStationCode}, {ID: v.StandingOptions.ThisIsID}, {ID: "station.e." + o.ThisStationCode}}
	if o.MindTheGap {
		files = append(files, clip("w.mind the gap between the train and the platform", 250), clip("w.mind the gap", 100))
	}
	files = append(files, clip(v.StandingOptions.NowStandingAtID, v.BeforeSectionDelay))

	isThe := plan.Clip{ID: "m.is the"}
	if o.IsDelayed {
		isThe.ID = "m.is the delayed"
	}
	n, numeric := jsParseInt(o.Platform)
	switch {
	case o.Platform == "0":
		files = append(files, plan.Clip{ID: "m.0"}, isThe)
	case numeric && n >= 21:
		files = append(files, plan.Clip{ID: "mins.m." + o.Platform}, isThe)
	default:
		files = append(files, plan.Clip{ID: "platform.s." + o.Platform}, isThe)
	}

	files = append(files, v.basicTrainInfo(o.Hour, o.Min, o.Toc, crsCodes(o.Vias), o.TerminatingStationCode, o.CallingAt, false, nil)...)
	calls, err := v.callingPoints(o.CallingAt, o.TerminatingStationCode, length, true)
	if err != nil {
		return plan.Plan{}, err
	}
	files = append(files, calls...)
	files = append(files, v.shortPlatforms(o.CallingAt, o.TerminatingStationCode, length, o.AnnounceShortPlatformsAfterSplit)...)
	files = append(files, v.requestStops(o.CallingAt, o.TerminatingStationCode, length)...)
	files = append(files, firstClass(o.FirstClassLocation)...)
	files = append(files, v.notCallingAt(o.NotCallingAtStations)...)
	files = append(files, serviceLoading(o.ServiceLoading)...)
	return o.finish(files), nil
}

func spokenNumber(n int) string {
	if n < 10 {
		return fmt.Sprintf("platform.s.%d", n)
	}
	return fmt.Sprintf("mins.m.%d", n)
}

func (v *Voice) DisruptedTrain(o DisruptedOptions) (plan.Plan, error) {
	if o.Chime == "" {
		o.Chime = v.DefaultChime
	}
	files := v.chime(o.Chime, false)
	var from clips
	if o.DisruptionType == "cancel" {
		// A cancellation names this station: "the service from here to ...".
		from = clips{{ID: v.DisruptionOptions.ThisStationAudio}}
	}
	files = append(files, plan.Clip{ID: "s.were sorry to announce that the"})
	files = append(files, v.routeInfo(o.RouteOptions, nil, true, from)...)

	reason := func() clips {
		if o.Reason.List {
			return plan.IDs(o.Reason.Clips...)
		}
		return plan.IDs("disruption-reason.e." + o.Reason.Name)
	}
	minutes, _ := jsParseInt(o.DelayTime)
	switch o.DisruptionType {
	case "delayedBy":
		files = append(files, plan.Clip{ID: "m.is delayed by approximately"})
		hours, mins := minutes/60, minutes%60
		if hours > 0 {
			unit := "m.hours"
			if hours == 1 {
				unit = "m.hour"
			}
			files = append(files, plan.Clip{ID: spokenNumber(hours)}, plan.Clip{ID: unit})
		}
		if hours > 0 && mins > 0 {
			files = append(files, plan.Clip{ID: "m.and"})
		}
		if mins > 0 {
			unit := "minutes"
			if mins == 1 {
				unit = "minute"
			}
			inflection := "e"
			if o.Reason.given() {
				inflection = "m"
			}
			files = append(files, plan.Clip{ID: spokenNumber(mins)}, plan.Clip{ID: inflection + "." + unit})
		}
		if o.Reason.given() {
			files = append(files, plan.Clip{ID: "m.due to"})
			files = append(files, reason()...)
		}
	case "delay":
		if o.Reason.given() {
			files = append(files, plan.Clip{ID: "m.is being delayed due to"})
			files = append(files, reason()...)
		} else {
			files = append(files, plan.Clip{ID: "e.is being delayed"})
		}
	case "cancel":
		if o.Reason.given() {
			files = append(files, plan.Clip{ID: "m.has been cancelled due to"})
			files = append(files, reason()...)
		} else {
			files = append(files, plan.Clip{ID: "e.has been cancelled"})
		}
	}

	files = append(files, clip("w.please listen for further announcements", 250))
	switch o.DisruptionType {
	case "delayedBy":
		switch {
		case minutes < 30:
			files = append(files, clip("w.were sorry for the delay to this service", 250))
		case minutes < 45:
			files = append(files, clip("w.were very sorry for the delay to this service", 250))
		default:
			files = append(files, clip("w.were extremely sorry for the severe delay to this service", 250))
		}
	case "delay":
		files = append(files, clip("w.were sorry for the delay to this service", 250))
	case "cancel":
		files = append(files, clip("w.were sorry for the delay this will cause to your journey", 250))
	}

	p := plan.Plan{Clips: files, MissingAudioMode: mode(o.MissingAudioMode)}
	if o.Destinations.Live {
		p.StartDelay = 1000
	}
	return p, nil
}

func (v *Voice) FastTrain(o FastTrainOptions) (plan.Plan, error) {
	if err := v.platformProblem(o.Platform); err != nil {
		return plan.Plan{}, err
	}
	if o.Chime == "" {
		o.Chime = v.DefaultChime
	}
	files := v.chime(o.Chime, o.DaktronicsFanfare)
	n, numeric := jsParseInt(o.Platform)
	platform := "platform.e." + o.Platform
	if o.Platform == "0" {
		platform = v.GenericOptions.PlatformZeroE
	} else if numeric && n > 20 {
		platform = "mins.e." + o.Platform
	}
	files = append(files,
		plan.Clip{ID: "s.stand well away from the edge of platform"},
		plan.Clip{ID: platform},
		clip("w.the approaching train is not scheduled to stop at this station", v.BeforeSectionDelay))
	if o.FastTrainApproaching {
		files = append(files, clip("w.fast train approaching", v.BeforeSectionDelay))
	}
	return plan.Plan{Clips: files, MissingAudioMode: mode(o.MissingAudioMode)}, nil
}

func isDigits(s string) bool {
	return s != "" && strings.Trim(s, "0123456789") == ""
}

func (v *Voice) TrainApproaching(o ApproachingOptions) (plan.Plan, error) {
	if err := v.platformProblem(o.Platform); err != nil {
		return plan.Plan{}, err
	}
	if o.Chime == "" {
		o.Chime = v.DefaultChime
	}
	files := v.chime(o.Chime, false)
	approaching := "s.the train now approaching platform"
	n, numeric := jsParseInt(o.Platform)
	switch {
	case o.Platform == "0":
		files = append(files, plan.Clip{ID: approaching}, plan.Clip{ID: "m.0"})
	case numeric && n <= 20 && isDigits(o.Platform):
		files = append(files, plan.Clip{ID: fmt.Sprintf("%s %d", approaching, n)})
	case numeric && n >= 21:
		files = append(files, plan.Clip{ID: approaching}, plan.Clip{ID: "mins.m." + o.Platform})
	default:
		files = append(files, plan.Clip{ID: approaching}, plan.Clip{ID: "platform.m." + o.Platform})
	}
	files = append(files, plan.Clip{ID: "m.is the"})
	if o.IsDelayed {
		files = append(files, plan.Clip{ID: "m.delayed"})
	}
	files = append(files, v.routeInfo(o.RouteOptions, nil, false, nil)...)
	files = append(files, clip("s.this train is the service from", v.ShortDelay))

	p := plan.Plan{MissingAudioMode: mode(o.MissingAudioMode)}
	if o.Destinations.Live {
		// A train that was joined started in two places, and both are the service the listener is on.
		files = append(files, plan.Pluralise(plan.IDs(o.Origins...), plan.PluraliseOptions{
			Prefix:         plan.Ptr("station.m."),
			FinalPrefix:    plan.Ptr("station.e."),
			AndID:          "m.and",
			BeforeAndDelay: plan.Ptr(100),
		})...)
		p.StartDelay = 1000
	} else {
		origin := ""
		if len(o.Origins) > 0 {
			origin = o.Origins[0]
		}
		files = append(files, plan.Clip{ID: "station.e." + origin})
	}
	p.Clips = files
	return p, nil
}

func platformNumber(platform, inflection string) plan.Clip {
	if platform == "0" {
		return plan.Clip{ID: "m.0"}
	}
	if n, ok := jsParseInt(platform); ok && n >= 21 {
		return plan.Clip{ID: "mins." + inflection + "." + platform}
	}
	return plan.Clip{ID: "platform." + inflection + "." + platform}
}

func (v *Voice) PlatformAlteration(o AlterationOptions) (plan.Plan, error) {
	if err := v.platformProblem(o.OldPlatform); err != nil {
		return plan.Plan{}, err
	}
	if err := v.platformProblem(o.NewPlatform); err != nil {
		return plan.Plan{}, err
	}
	if o.Chime == "" {
		o.Chime = v.DefaultChime
	}
	files := v.chime(o.Chime, false)
	files = append(files, plan.Clip{ID: "w.attention please"}, clip("w.this is a platform alteration", 200), clip("s.the", 400))
	files = append(files, v.routeInfo(o.RouteOptions, o.CallingAt, true, nil)...)
	if o.AnnounceOldPlatform {
		files = append(files, plan.Clip{ID: "m.originally due to depart from platform"}, platformNumber(o.OldPlatform, "m"))
	}
	files = append(files, plan.Clip{ID: "m.will now depart from platform"}, platformNumber(o.NewPlatform, "e"))
	files = append(files, v.forThePlatform(o.NewPlatform, o.IsDelayed, v.BeforeSectionDelay)...)
	files = append(files, v.routeInfo(o.RouteOptions, o.CallingAt, false, nil)...)
	return plan.Plan{Clips: files, MissingAudioMode: mode(o.MissingAudioMode)}, nil
}
