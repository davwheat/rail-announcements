package ketech

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	_ "time/tzdata"

	"rail-announcements-backend/internal/feed"
	"rail-announcements-backend/internal/plan"
)

// Preferences are the listener's choices that change what is said.
type Preferences struct {
	// Chime is empty for the voice's own default.
	Chime                            Chime                 `json:"chime"`
	UseLegacyTocNames                bool                  `json:"useLegacyTocNames"`
	AnnounceViaPoints                bool                  `json:"announceViaPoints"`
	AnnounceShortPlatformsAfterSplit bool                  `json:"announceShortPlatformsAfterSplit"`
	FastTrainApproaching             bool                  `json:"fastTrainApproaching"`
	DaktronicsFanfare                bool                  `json:"daktronicsFanfare"`
	MissingAudioMode                 plan.MissingAudioMode `json:"missingAudioMode"`
}

// Spoken is a live announcement as clips. Fallback, when set, says the same
// with less, for when a clip of Plan turns out not to exist.
type Spoken struct {
	Plan     plan.Plan
	Fallback *plan.Plan
}

var london = mustLoadLocation("Europe/London")

func mustLoadLocation(name string) *time.Location {
	location, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return location
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func stationAudio(location feed.Location) (string, error) {
	if code := StationOverride(location.TPL); code != "" {
		return code, nil
	}
	if code := deref(location.CRS); code != "" {
		return code, nil
	}
	name := deref(location.Name)
	if name == "" {
		name = location.TPL
	}
	return "", fmt.Errorf("No station audio identity for %s", name)
}

// hasActivity looks for one of Darwin's fixed two-character activity codes, so
// that "R" does not match within "RM" or "RR".
func hasActivity(activities *string, code string) bool {
	if activities == nil {
		return false
	}
	for i := 0; i < len(*activities); i += 2 {
		if strings.TrimSpace((*activities)[i:min(i+2, len(*activities))]) == code {
			return true
		}
	}
	return false
}

// ownDestination is where this train itself goes. An endpoint with an
// associated RID belongs to a portion that joins or divides.
func ownDestination(m feed.Movement) feed.Endpoint {
	return ownEndpoint(m.Destinations)
}

func ownEndpoint(endpoints []feed.Endpoint) feed.Endpoint {
	for _, endpoint := range endpoints {
		if deref(endpoint.AssocRID) == "" {
			return endpoint
		}
	}
	return endpoints[0]
}

// runningPortions keeps the endpoints of portions that run today. The feed
// describes an unknown associate by no station at all. A portion that divides
// off with nowhere left to call takes nobody anywhere either, though the feed
// lists its destination for as long as the division stands.
func runningPortions(m feed.Movement, endpoints []feed.Endpoint) []feed.Endpoint {
	var out []feed.Endpoint
	for _, endpoint := range endpoints {
		rid := deref(endpoint.AssocRID)
		if rid != "" && slices.ContainsFunc(m.Portions, func(p feed.Portion) bool {
			return p.RID == rid && p.Available && !p.Cancelled && (p.Category != "VV" || len(dividedCalls(p)) > 0)
		}) {
			out = append(out, endpoint)
		}
	}
	return out
}

// sameStation allows for an endpoint, a link and a call that each name one
// station by a different TIPLOC.
func sameStation(a, b feed.Location) bool {
	return a.TPL == b.TPL || (deref(a.CRS) != "" && deref(a.CRS) == deref(b.CRS))
}

// running reports whether the service makes a call, as opposed to one that is
// cancelled or that passengers can't use.
func running(call feed.Call) bool {
	return !call.Cancelled && !call.Operational
}

// onwardLink finds the portion that takes a service's passengers on from the
// call where it ends, the index of that call, and the linked service's calls
// after it. Darwin links two services to make one journey of them, most often
// a train and the rail replacement bus that finishes its route, and a bus
// recorded as a train's next working means the same. A link anywhere else on
// the route is a change that the service runs on past, so it's left alone.
// Main is false on the service the passengers came from.
//
// A portion that joins another train ends where it joins, and its passengers
// stay on board, so the train it joins takes them on as well. There Main is
// false on the portion that joins, and the join can be a call that passengers
// can't use.
func onwardLink(portions []feed.Portion, calls []feed.Call) (*feed.Portion, int, []feed.Call) {
	ends := len(calls) - 1
	for ends >= 0 && calls[ends].Cancelled {
		ends--
	}
	leaves := ends
	for leaves >= 0 && !running(calls[leaves]) {
		leaves--
	}
	for i := range portions {
		link := &portions[i]
		if !link.Available || link.Cancelled {
			continue
		}
		joins := link.Category == "JJ" && (link.Main == nil || !*link.Main)
		if !joins && link.Main != nil && !*link.Main {
			continue
		}
		if !joins && link.Category != "LK" && !(link.Category == "NP" && deref(link.Mode) == "bus") {
			continue
		}
		from := leaves
		if joins {
			from = ends
		}
		if from < 0 || !sameStation(link.At, calls[from].Location) {
			continue
		}
		meets := slices.IndexFunc(link.Calls, func(call feed.Call) bool { return sameStation(call.Location, link.At) })
		if meets == -1 {
			continue
		}
		onward := link.Calls[meets+1:]
		// A linked service that runs nowhere from here takes nobody on.
		if slices.ContainsFunc(onward, running) {
			return link, from, onward
		}
	}
	return nil, 0, nil
}

// linkedLeg is the part of a journey that one linked service runs.
type linkedLeg struct {
	calls []feed.Call
	bus   bool
	// portions are what the feed sends of that service's own associations. For
	// a train that a portion joined, they include the portions that divide
	// from it afterwards.
	portions []feed.Portion
}

// journey is the journey that passengers make from the station.
type journey struct {
	// calls are the movement's own calls on the journey.
	calls []feed.Call
	// links are the services linked on from the last of those, in order.
	links []linkedLeg
	// destination is where the last linked service goes, or nil when nothing
	// is linked.
	destination *feed.Location
}

// linkedJourney follows a service's links. A service linked to another where
// it ends is announced as one through service, and so is each service linked
// on from that one: a train, a bus, and then a train. A portion that joins
// another train is announced in the same way, as a through service to where
// that train goes.
func linkedJourney(m feed.Movement) journey {
	j := journey{calls: m.CallingPoints}
	// A false destination is the station Darwin tells an announcement to name,
	// so no link is followed past it.
	if m.FalseDestination != nil {
		return j
	}
	link, from, calls := onwardLink(m.Portions, m.CallingPoints)
	if link != nil {
		j.calls = m.CallingPoints[:from+1]
	}
	for link != nil {
		j.destination = link.Destination
		if j.destination == nil {
			j.destination = &calls[len(calls)-1].Location
		}
		next, from, onward := onwardLink(link.Links, calls)
		if next != nil {
			calls = calls[:from+1]
		}
		j.links = append(j.links, linkedLeg{calls: calls, bus: deref(link.Mode) == "bus", portions: link.Links})
		link, calls = next, onward
	}
	return j
}

// announcedDestination is the station the train is announced to: a false
// destination wherever it has one, or else the destination of the last service
// linked on from it. The feed's via points lie on the route to the train's own
// destination, so another one has none.
func announcedDestination(m feed.Movement) feed.Endpoint {
	own := ownDestination(m)
	named := m.FalseDestination
	if named == nil {
		named = linkedJourney(m).destination
	}
	if named != nil {
		own.Location = *named
		own.Via = nil
	}
	return own
}

// announcedDestinations is every station the train is announced to: its own
// first, then the portions that divide off it. The feed lists the destinations
// of the movement's own portions. Those of a train that it joins come with
// that train.
func announcedDestinations(m feed.Movement) []feed.Endpoint {
	out := append([]feed.Endpoint{announcedDestination(m)}, runningPortions(m, m.Destinations)...)
	for _, link := range linkedJourney(m).links {
		for _, portion := range link.portions {
			reached := portion.Category == "VV" && portion.Available && !portion.Cancelled &&
				slices.ContainsFunc(link.calls, func(call feed.Call) bool { return call.TPL == portion.At.TPL })
			if !reached {
				continue
			}
			calls := dividedCalls(portion)
			if len(calls) == 0 {
				continue
			}
			location := calls[len(calls)-1].Location
			if portion.Destination != nil {
				location = *portion.Destination
			}
			rid, category := portion.RID, portion.Category
			out = append(out, feed.Endpoint{Location: location, AssocRID: &rid, AssocCat: &category})
		}
	}
	return out
}

func announcedOrigins(m feed.Movement) []feed.Endpoint {
	return append([]feed.Endpoint{ownEndpoint(m.Origins)}, runningPortions(m, m.Origins)...)
}

// pickUpOnly reports a call where the train only takes passengers up, which
// isn't one it takes anybody to. Darwin can list "U" beside "D" or "T", and
// passengers can alight there.
func pickUpOnly(activities *string) bool {
	return hasActivity(activities, "U") && !hasActivity(activities, "D") && !hasActivity(activities, "T")
}

func isPassengerCall(call feed.Call) bool {
	return deref(call.CRS) != "" && !call.Operational && !call.Cancelled && !pickUpOnly(call.Activities)
}

func passengerCalls(calls []feed.Call) []feed.Call {
	var out []feed.Call
	for _, call := range calls {
		if isPassengerCall(call) {
			out = append(out, call)
		}
	}
	return out
}

// onwardCalls are a portion's calls from the division point. Without that
// point, nothing says which calls are still ahead of the train.
func onwardCalls(p feed.Portion) []feed.Call {
	start := slices.IndexFunc(p.Calls, func(call feed.Call) bool {
		return call.TPL == p.At.TPL || (deref(call.CRS) != "" && deref(call.CRS) == deref(p.At.CRS))
	})
	if start == -1 {
		return nil
	}
	return p.Calls[start:]
}

// dividedCalls are the stations a portion takes passengers to once it has
// divided off.
func dividedCalls(p feed.Portion) []feed.Call {
	var out []feed.Call
	for _, stop := range passengerCalls(onwardCalls(p)) {
		if stop.TPL != p.At.TPL {
			out = append(out, stop)
		}
	}
	return out
}

func crsOf[T any](items []T, location func(T) feed.Location) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i] = deref(location(item).CRS)
	}
	return out
}

func swapEnds(shortPlatform string) string {
	if strings.HasPrefix(shortPlatform, "front") {
		return strings.Replace(shortPlatform, "front", "rear", 1)
	}
	return strings.Replace(shortPlatform, "rear", "front", 1)
}

func plainPoints(calls []feed.Call, keep func(feed.Call) bool, withRequestStops bool) ([]CallingPoint, error) {
	var out []CallingPoint
	for _, stop := range calls {
		if !keep(stop) {
			continue
		}
		code, err := stationAudio(stop.Location)
		if err != nil {
			return nil, err
		}
		point := CallingPoint{CRSCode: code, Name: deref(stop.Name), RandomID: stop.ID}
		if withRequestStops {
			point.RequestStop = hasActivity(stop.Activities, "R")
		}
		out = append(out, point)
	}
	return out, nil
}

// CallingPoints lists the stops still ahead of the train, in the order it
// makes them, with what each stop needs saying about it.
func CallingPoints(m feed.Movement) ([]CallingPoint, error) {
	train := ShortPlatformTrain{
		OperatorCode:        deref(m.OperatorCode),
		Length:              m.CoachCount,
		Origins:             crsOf(m.Origins, func(e feed.Endpoint) feed.Location { return e.Location }),
		Destinations:        crsOf(m.Destinations, func(e feed.Endpoint) feed.Location { return e.Location }),
		SubsequentLocations: crsOf(m.CallingPoints, func(c feed.Call) feed.Location { return c.Location }),
	}
	// Coach preferences reverse at each reversal, including one at an operational call.
	reversed := m.ReverseFormation != nil && *m.ReverseFormation
	destination := announcedDestination(m)
	// The endpoint and the call can name one station by different TIPLOCs.
	terminus := func(call feed.Call) bool {
		return call.TPL == destination.TPL || (deref(destination.CRS) != "" && deref(call.CRS) == deref(destination.CRS))
	}
	journey := linkedJourney(m)
	// The journey ends on the last service that runs it.
	lastLeg := journey.calls
	if len(journey.links) > 0 {
		lastLeg = journey.links[len(journey.links)-1].calls
	}
	// A train on a circular route calls at a false destination again on its way
	// to the real one, so the calling points end at the first call there. The
	// real destination is the last call at it.
	destinationIndex := -1
	for i, call := range lastLeg {
		if terminus(call) {
			destinationIndex = i
			if m.FalseDestination != nil {
				break
			}
		}
	}

	result := []CallingPoint{}
	turned := false
	for i, call := range journey.calls {
		arrivesTurned := turned
		if hasActivity(call.Activities, "RM") {
			reversed, turned = !reversed, !turned
		}
		terminates := len(journey.links) == 0 && i == destinationIndex
		portions := slices.ContainsFunc(m.Portions, func(p feed.Portion) bool {
			return p.At.TPL == call.TPL && p.Available && !p.Cancelled
		})
		divides := divisionsAt(call, m.Portions)
		// A train can divide at a station where it sets nobody down, as a
		// sleeper does. The voice names the station where the train divides, so
		// that call is kept.
		dividesOnly := len(divides) > 0 && deref(call.CRS) != "" && !call.Cancelled
		if !isPassengerCall(call) && !dividesOnly {
			if terminates {
				break
			}
			continue
		}
		if terminates && !portions {
			break
		}

		callTrain := train
		if call.CoachCount != nil {
			callTrain.Length = call.CoachCount
		}
		short := ShortPlatform(deref(call.CRS), call.Platform.Number, callTrain)
		if reversed && short != "" {
			short = swapEnds(short)
		}
		// The terminus is spoken as the destination, so it joins the calling
		// points only as the station where a portion divides off and carries on.
		if terminates && len(divides) == 0 {
			break
		}
		code, err := stationAudio(call.Location)
		if err != nil {
			return nil, err
		}
		point := CallingPoint{
			CRSCode:       code,
			Name:          deref(call.Name),
			RandomID:      call.ID,
			RequestStop:   hasActivity(call.Activities, "R"),
			ShortPlatform: short,
		}
		if err := splitAt(&point, call, divides, arrivesTurned); err != nil {
			return nil, err
		}
		result = append(result, point)
		if terminates {
			break
		}
	}

	onBus := m.Mode == "bus"
	leg := journey.calls
	for l, link := range journey.links {
		// One service hands over to the next at the last call it makes. The
		// voice says once where the train gives way to a replacement bus, and
		// once where a train takes over again.
		if len(result) > 0 && result[len(result)-1].RandomID == leg[len(leg)-1].ID {
			handover := &result[len(result)-1]
			byBus := slices.ContainsFunc(result, func(p CallingPoint) bool { return p.ContinuesAsRrbAfterHere })
			restarted := slices.ContainsFunc(result, func(p CallingPoint) bool { return p.ContinuesAsTrainAfterHere })
			if link.bus && !onBus && !byBus {
				handover.ContinuesAsRrbAfterHere = true
			}
			if !link.bus && onBus && byBus && !restarted {
				handover.ContinuesAsTrainAfterHere = true
			}
		}
		// The ends of another train are its own.
		turned = false
		for i, call := range link.calls {
			if l == len(journey.links)-1 && i == destinationIndex {
				break
			}
			arrivesTurned := turned
			if hasActivity(call.Activities, "RM") {
				turned = !turned
			}
			// A train that this one joined can divide later on, as the train's
			// own journey can.
			divides := divisionsAt(call, link.portions)
			if !isPassengerCall(call) && !(len(divides) > 0 && deref(call.CRS) != "" && !call.Cancelled) {
				continue
			}
			code, err := stationAudio(call.Location)
			if err != nil {
				return nil, err
			}
			point := CallingPoint{CRSCode: code, Name: deref(call.Name), RandomID: call.ID, RequestStop: hasActivity(call.Activities, "R")}
			if err := splitAt(&point, call, divides, arrivesTurned); err != nil {
				return nil, err
			}
			result = append(result, point)
		}
		onBus = link.bus
		leg = link.calls
	}

	// The voice describes one division. A portion that divides off further
	// along is announced with it, at an end of the train that only the crew
	// can say. Coaches left behind further along than that aren't announced.
	first := -1
	for i := range result {
		point := &result[i]
		if point.SplitType == "" {
			continue
		}
		if first == -1 {
			first = i
			continue
		}
		if point.SplitType == "splits" {
			result[first].FurtherSplits = append(result[first].FurtherSplits, FurtherSplit{SplitForm: "unknown", SplitCallingPoints: point.SplitCallingPoints})
			for _, further := range point.FurtherSplits {
				result[first].FurtherSplits = append(result[first].FurtherSplits, FurtherSplit{SplitForm: "unknown", SplitCallingPoints: further.SplitCallingPoints})
			}
		}
		point.SplitType, point.SplitForm, point.SplitCallingPoints, point.FurtherSplits = "", nil, nil, nil
	}
	return result, nil
}

// divisionsAt lists the portions that divide from a train at a call, and that
// passengers can still travel in. A portion with nowhere left to call isn't
// one the voice can send anybody to.
func divisionsAt(call feed.Call, portions []feed.Portion) []feed.Portion {
	var out []feed.Portion
	for _, portion := range portions {
		if portion.At.TPL == call.TPL && portion.Available && !portion.Cancelled && portion.Category == "VV" && len(dividedCalls(portion)) > 0 {
			out = append(out, portion)
		}
	}
	return out
}

// splitAt gives a calling point what the voice says of the part of the train
// that leaves it there: the portions that divide off, or else the coaches that
// the train leaves behind while it runs on as the same service, which go no
// further.
//
// The feed names the end of the train as it arrives at the call. turned is
// whether the train reverses an odd number of times on the way there, which
// makes that the other end as the train stands at this station.
func splitAt(point *CallingPoint, call feed.Call, divides []feed.Portion, turned bool) error {
	end := func(position string) string {
		switch {
		case turned && position == "front":
			return "rear"
		case turned && position == "rear":
			return "front"
		}
		return position
	}
	// The voice can say which end a part is at without saying how long it is.
	form := func(position string, coaches *int) *string {
		out := "unknown"
		if slices.Contains([]string{"front", "rear", "middle"}, position) {
			out = end(position)
			if coaches != nil && *coaches != 0 {
				out = fmt.Sprintf("%s.%d", out, *coaches)
			}
		}
		return &out
	}

	for d, portion := range divides {
		position := deref(portion.Position)
		if position == "" {
			switch {
			// Darwin says only which end of the train stock detaches from,
			// which can't tell two portions apart.
			case len(divides) > 1 || call.DetachFront == nil:
				position = "unknown"
			case *call.DetachFront:
				position = "front"
			default:
				position = "rear"
			}
		}
		stops, err := plainPoints(dividedCalls(portion), func(feed.Call) bool { return true }, true)
		if err != nil {
			return err
		}
		if d == 0 {
			point.SplitType, point.SplitForm, point.SplitCallingPoints = "splits", form(position, portion.CoachCount), stops
		} else {
			point.FurtherSplits = append(point.FurtherSplits, FurtherSplit{SplitForm: *form(position, portion.CoachCount), SplitCallingPoints: stops})
		}
	}
	if len(divides) > 0 || !isPassengerCall(call) || call.FormationChange == nil || call.FormationChange.Detached == nil {
		return nil
	}
	detached := call.FormationChange.Detached
	position := deref(detached.Position)
	if position == "" {
		position = "unknown"
	}
	point.SplitType, point.SplitForm, point.SplitCallingPoints = "splitTerminates", form(position, detached.Coaches), []CallingPoint{}
	return nil
}

func viaPoints(endpoints []feed.Endpoint, m feed.Movement, announce bool) ([][]CallingPoint, error) {
	out := make([][]CallingPoint, len(endpoints))
	for i, endpoint := range endpoints {
		out[i] = []CallingPoint{}
		if !announce || endpoint.Via == nil {
			continue
		}
		for _, crs := range endpoint.Via.Locs {
			point := CallingPoint{CRSCode: crs, RandomID: crs}
			if call := slices.IndexFunc(m.CallingPoints, func(c feed.Call) bool { return c.CRS != nil && *c.CRS == crs }); call != -1 {
				code, err := stationAudio(m.CallingPoints[call].Location)
				if err != nil {
					return nil, err
				}
				point.CRSCode, point.Name = code, deref(m.CallingPoints[call].Name)
			}
			out[i] = append(out[i], point)
		}
	}
	return out, nil
}

func delayMillis(t feed.Times) (int64, bool) {
	if !t.Estimated.Valid || !t.Planned.Valid {
		return 0, false
	}
	// The website reads both instants at millisecond precision.
	return t.Estimated.Time.UnixMilli() - t.Planned.Time.UnixMilli(), true
}

// LiveTrainOptions turns a movement into the state the next train tab would
// hold for it.
func (v *Voice) LiveTrainOptions(m feed.Movement, prefs Preferences, platform string) (TrainOptions, error) {
	if !m.Departure.Planned.Valid || len(m.Destinations) == 0 {
		return TrainOptions{}, errors.New("Departure time or destination unavailable")
	}
	departs := m.Departure.Planned.Time.In(london)
	hour, minute := departs.Format("15"), departs.Format("04")
	if hour == "00" {
		hour = "00 - midnight"
	}
	if minute == "00" {
		minute = "00 - hundred-hours"
	}
	delay, _ := delayMillis(m.Departure)

	loading := -1.0
	if m.LoadingPercent != nil {
		loading = float64(*m.LoadingPercent)
	} else {
		sum, known := 0, 0
		for _, coach := range m.Coaches {
			if coach.LoadingPercent != nil {
				sum += *coach.LoadingPercent
				known++
			}
		}
		if known > 0 {
			loading = float64(sum) / float64(known)
		}
	}

	destination := announcedDestination(m)
	terminating, err := stationAudio(destination.Location)
	if err != nil {
		return TrainOptions{}, err
	}
	vias, err := viaPoints([]feed.Endpoint{destination}, m, prefs.AnnounceViaPoints)
	if err != nil {
		return TrainOptions{}, err
	}
	callingAt, err := CallingPoints(m)
	if err != nil {
		return TrainOptions{}, err
	}
	// A linked service makes the calls that the train has cancelled beyond the link.
	notCalling, err := plainPoints(linkedJourney(m).calls, func(call feed.Call) bool {
		return deref(call.CRS) != "" && !call.Operational && call.Cancelled && !pickUpOnly(call.Activities)
	}, false)
	if err != nil {
		return TrainOptions{}, err
	}

	chime := prefs.Chime
	if chime == "" {
		chime = v.DefaultChime
	}
	originCRS := ""
	if len(m.Origins) > 0 {
		originCRS = deref(m.Origins[0].CRS)
	}
	o := TrainOptions{
		FromLive:         true,
		MissingAudioMode: prefs.MissingAudioMode,
		Chime:            chime,
		Hour:             hour,
		Min:              minute,
		IsDelayed:        m.Departure.UnknownDelay || (m.Departure.Estimated.Valid && delay >= 5*60_000),
		Toc: v.TocForLiveTrain(deref(m.OperatorName), deref(m.OperatorCode), originCRS, deref(ownDestination(m).CRS),
			prefs.UseLegacyTocNames, deref(m.UID)),
		Platform:                         platform,
		TerminatingStationCode:           terminating,
		Vias:                             vias[0],
		CallingAt:                        callingAt,
		FirstClassLocation:               "none",
		Coaches:                          "None",
		ServiceLoading:                   "none",
		AnnounceShortPlatformsAfterSplit: prefs.AnnounceShortPlatformsAfterSplit,
		NotCallingAtStations:             notCalling,
	}
	if m.CoachCount != nil && *m.CoachCount != 0 {
		o.Coaches = fmt.Sprintf("%d coaches", *m.CoachCount)
	}
	if loading > 70 {
		o.ServiceLoading = "full and standing"
	}
	return o, nil
}

func (v *Voice) liveRoute(m feed.Movement, prefs Preferences, o TrainOptions) (RouteOptions, error) {
	destinations := announcedDestinations(m)
	vias, err := viaPoints(destinations, m, prefs.AnnounceViaPoints)
	if err != nil {
		return RouteOptions{}, err
	}
	route := RouteOptions{
		Chime: o.Chime, Hour: o.Hour, Min: o.Min, IsDelayed: o.IsDelayed, Toc: o.Toc, MissingAudioMode: o.MissingAudioMode,
		Destinations: Destinations{Live: true},
	}
	for i, destination := range destinations {
		code, err := stationAudio(destination.Location)
		if err != nil {
			return RouteOptions{}, err
		}
		route.Destinations.Stations = append(route.Destinations.Stations, code)
		route.Destinations.Vias = append(route.Destinations.Vias, crsCodes(vias[i]))
	}
	return route, nil
}

// Announce turns a live announcement into clips for one platform, which must
// be a platform this voice can say: see [Voice.AudioPlatform].
func (v *Voice) Announce(a feed.Announcement, prefs Preferences, platform string) (Spoken, error) {
	if a.Type == feed.Passing {
		p, err := v.FastTrain(FastTrainOptions{
			Chime:                prefs.Chime,
			DaktronicsFanfare:    prefs.DaktronicsFanfare,
			Platform:             platform,
			FastTrainApproaching: prefs.FastTrainApproaching,
			MissingAudioMode:     prefs.MissingAudioMode,
		})
		return Spoken{Plan: p}, err
	}

	m := a.Details
	o, err := v.LiveTrainOptions(m, prefs, platform)
	if err != nil {
		return Spoken{}, err
	}
	single := func(p plan.Plan, err error) (Spoken, error) { return Spoken{Plan: p}, err }

	switch a.Type {
	case feed.Next:
		return single(v.NextTrain(o))

	case feed.Standing:
		o.ThisStationCode = deref(m.Station.CRS)
		o.MindTheGap = IsMindTheGap(deref(m.Station.CRS), m.Platform.Number)
		return single(v.StandingTrain(o))

	case feed.Approaching:
		if len(m.Origins) == 0 {
			return Spoken{}, errors.New("Origin unavailable")
		}
		var origins []string
		for _, origin := range announcedOrigins(m) {
			code, err := stationAudio(origin.Location)
			if err != nil {
				return Spoken{}, err
			}
			origins = append(origins, code)
		}
		route, err := v.liveRoute(m, prefs, o)
		if err != nil {
			return Spoken{}, err
		}
		return single(v.TrainApproaching(ApproachingOptions{RouteOptions: route, Platform: platform, Origins: origins}))

	case feed.Disrupted:
		reason := m.DelayReason
		if m.Cancelled {
			reason = m.CancelReason
		}
		millis, known := delayMillis(m.Departure)
		minutes := int(floorDiv(millis, 60_000))
		// Without a delay to count, the generic wording replaces "delayed by approximately".
		disruption := "delayedBy"
		if m.Departure.UnknownDelay || !known || minutes <= 0 {
			disruption = "delay"
		}
		if m.Cancelled {
			disruption = "cancel"
		}
		route, err := v.liveRoute(m, prefs, o)
		if err != nil {
			return Spoken{}, err
		}
		options := DisruptedOptions{RouteOptions: route, DisruptionType: disruption, DelayTime: fmt.Sprint(max(0, minutes))}
		// The mapping holds finished clip IDs, which the voice plays as they are only in list form.
		if clips := v.DelayCodes[deref(reason.Code)]; len(clips) > 0 {
			options.Reason = DisruptionReason{Clips: clips, List: true}
		}
		spoken, err := single(v.DisruptedTrain(options))
		if err != nil || !options.Reason.given() {
			return spoken, err
		}
		// A reason the voice cannot say must not cost the listener the disruption itself.
		options.Reason = DisruptionReason{}
		fallback, err := v.DisruptedTrain(options)
		spoken.Fallback = &fallback
		return spoken, err

	case feed.PlatformAlteration:
		if deref(a.PreviousPlatform) == "" || deref(a.NewPlatform) == "" {
			return Spoken{}, errors.New("Platform alteration details unavailable")
		}
		oldPlatform, oldOK := v.AudioPlatform(*a.PreviousPlatform)
		newPlatform, newOK := v.AudioPlatform(*a.NewPlatform)
		if !oldOK || !newOK {
			return Spoken{}, errors.New("Platform audio unavailable")
		}
		route, err := v.liveRoute(m, prefs, o)
		if err != nil {
			return Spoken{}, err
		}
		return single(v.PlatformAlteration(AlterationOptions{
			RouteOptions:        route,
			AnnounceOldPlatform: true,
			OldPlatform:         oldPlatform,
			NewPlatform:         newPlatform,
		}))
	}
	return Spoken{}, fmt.Errorf("unknown announcement type %q", a.Type)
}

func floorDiv(a, b int64) int64 {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}

var mindTheGap = mustLoad[map[string][]string]("mind-the-gap")

func IsMindTheGap(crs string, platform *string) bool {
	return platform != nil && slices.Contains(mindTheGap[crs], *platform)
}
