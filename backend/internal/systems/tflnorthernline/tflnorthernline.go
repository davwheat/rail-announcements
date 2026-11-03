// Package tflnorthernline ports the website's TfL Northern Line system
// (src/announcement-data/systems/rolling-stock/TfLNorthernLine.tsx). The
// website is the reference: change the TypeScript first, re-export, then port
// the change here.
package tflnorthernline

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/instance.json
var instanceData []byte

//go:embed data/module.json
var moduleData []byte

//go:embed data/buttons.json
var buttonData []byte

// audioItem is the website's AudioItem: a clip ID, or an ID with play options.
type audioItem plan.Clip

func (a *audioItem) UnmarshalJSON(raw []byte) error {
	var id string
	if err := json.Unmarshal(raw, &id); err == nil {
		*a = audioItem{ID: id}
		return nil
	}
	var object struct {
		ID   string `json:"id"`
		Opts struct {
			DelayStart   int    `json:"delayStart"`
			CustomPrefix string `json:"customPrefix"`
		} `json:"opts"`
	}
	if err := json.Unmarshal(raw, &object); err != nil {
		return err
	}
	*a = audioItem{ID: object.ID, Delay: object.Opts.DelayStart, Prefix: object.Opts.CustomPrefix}
	return nil
}

// clipList is one of the tables' AudioItem[] fields. A list the table sets but
// leaves empty is truthy in the TypeScript where a missing one is not, so it
// stays apart from nil.
type clipList []plan.Clip

func (c *clipList) UnmarshalJSON(raw []byte) error {
	if string(raw) == "null" {
		return nil
	}
	var items []audioItem
	if err := json.Unmarshal(raw, &items); err != nil {
		return err
	}
	list := make(clipList, len(items))
	for i, item := range items {
		list[i] = plan.Clip(item)
	}
	*c = list
	return nil
}

// thisStationItem is one stop of the "Stopped at station" table. A station with
// more than one entry differs by branch, or by the suffix the website shows
// beside the option.
type thisStationItem struct {
	Station string `json:"station"`
	// Branch is empty where the table has null.
	Branch string `json:"branch"`
	// ExtraInfo is the connections read after the station name. The handler
	// gives its first clip a 500 ms lead where the table sets none.
	ExtraInfo clipList `json:"extraInfo"`
	// FullAudio replaces the whole assembled announcement.
	FullAudio clipList `json:"fullAudio"`
}

type nextStationItem struct {
	Label string `json:"label"`
	// Audio replaces the label-derived clip.
	Audio            clipList `json:"audio"`
	TerminatingAudio clipList `json:"terminatingAudio"`
	// ConditionalMindTheGap lets the tab's Mind the gap option add a clip.
	ConditionalMindTheGap bool `json:"conditionalMindTheGap"`
	// OnlyTerminates forces the terminating announcement whatever the state.
	OnlyTerminates bool `json:"onlyTerminates"`
}

// moduleTables are the module-level tables of the TypeScript. The "Stopped at
// station" state names a stop by its index in ThisStationData, so the order the
// export records is part of the wire contract. The next-station audio the
// TypeScript spreads out of ThisStationData is already resolved in the export.
type moduleTables struct {
	ThisStationData []thisStationItem `json:"ThisStationData"`
	NextStationData []nextStationItem `json:"NextStationData"`
}

type System struct {
	id         string
	name       string
	filePrefix string
	tables     moduleTables
	buttons    shared.Buttons
}

func New() (*System, error) {
	var instance struct {
		ID         string `json:"ID"`
		Name       string `json:"NAME"`
		FilePrefix string `json:"FILE_PREFIX"`
	}
	if err := json.Unmarshal(instanceData, &instance); err != nil {
		return nil, fmt.Errorf("instance: %w", err)
	}
	s := &System{id: instance.ID, name: instance.Name, filePrefix: instance.FilePrefix}
	if err := json.Unmarshal(moduleData, &s.tables); err != nil {
		return nil, fmt.Errorf("module: %w", err)
	}
	buttons, err := shared.ParseButtons(buttonData)
	if err != nil {
		return nil, err
	}
	s.buttons = buttons
	return s, nil
}

func (s *System) ID() string         { return s.id }
func (s *System) Name() string       { return s.name }
func (s *System) FilePrefix() string { return s.filePrefix }

func (s *System) Announcements() []string {
	return append([]string{"destinationInfo", "nextStation", "thisStation"}, s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	switch announcement {
	case "destinationInfo":
		return planDestinationInfo(state)
	case "nextStation":
		return s.planNextStation(state)
	case "thisStation":
		return s.planThisStation(state)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

type destinationInfoState struct {
	StationName jsString `json:"stationName"`
}

func planDestinationInfo(state json.RawMessage) (plan.Plan, error) {
	var opts destinationInfoState
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	name, err := opts.StationName.forMethod("toLowerCase")
	if err != nil {
		return plan.Plan{}, err
	}
	return announcement(destinationSegments(name, 0)), nil
}

type nextStationState struct {
	StationLabel jsString `json:"stationLabel"`
	Terminating  jsBool   `json:"terminating"`
	MindTheGap   jsBool   `json:"mindTheGap"`
}

func (s *System) planNextStation(state json.RawMessage) (plan.Plan, error) {
	var opts nextStationState
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	data := s.findNextStation(opts.StationLabel)
	if data == nil {
		return plan.Plan{}, errors.New("Invalid station")
	}

	var files []plan.Clip
	switch {
	case (bool(opts.Terminating) && data.TerminatingAudio != nil) || data.OnlyTerminates:
		files = append(files, data.TerminatingAudio...)
		files = append(files,
			plan.Clip{ID: "please ensure you have all your belongings with you", Delay: 250},
			plan.Clip{ID: "when you leave the train"},
			plan.Clip{ID: "thank you for travelling on the northern line", Delay: 250},
		)
	case data.Audio == nil:
		files = append(files, plan.Clip{ID: "next station." + stationFileName(data.Label)})
	default:
		files = append(files, data.Audio...)
	}

	if bool(opts.MindTheGap) && data.ConditionalMindTheGap {
		files = append(files, plan.Clip{ID: "please mind the gap between the train and the platform"})
	}
	return announcement(files), nil
}

type thisStationState struct {
	StationNameIndex       jsString `json:"stationNameIndex"`
	TerminatingStationName jsString `json:"terminatingStationName"`
}

func (s *System) planThisStation(state json.RawMessage) (plan.Plan, error) {
	var opts thisStationState
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}

	// The website reads the destination's endsWith before the indexed stop, so
	// a missing destination is the failure it reports first.
	destination, err := opts.TerminatingStationName.forMethod("endsWith")
	if err != nil {
		return plan.Plan{}, err
	}
	index, isNumber := jsParseInt(opts.StationNameIndex.value)
	if !isNumber || index < 0 || index >= len(s.tables.ThisStationData) {
		return plan.Plan{}, undefinedPropertyError(false, "station")
	}
	info := s.tables.ThisStationData[index]
	isTerminating := strings.HasSuffix(destination, info.Station)

	var files []plan.Clip
	if info.FullAudio != nil {
		files = append(files, info.FullAudio...)
		return announcement(append(files, ending(isTerminating, destination)...)), nil
	}

	files = append(files,
		plan.Clip{ID: "conjoiner.this station is"},
		plan.Clip{ID: "station.low." + stationFileName(info.Station)},
	)
	if info.Branch != "" {
		files = append(files, plan.Clip{ID: "routeing." + info.Branch + " branch"})
	}
	if info.ExtraInfo != nil {
		first := info.ExtraInfo[0]
		if first.Delay == 0 {
			first.Delay = 500
		}
		files = append(files, first)
		files = append(files, info.ExtraInfo[1:]...)
	}
	return announcement(append(files, ending(isTerminating, destination)...)), nil
}

// ending closes a "Stopped at station" announcement with either the all-change
// clips or the destination the train is still bound for.
func ending(isTerminating bool, destination string) []plan.Clip {
	if isTerminating {
		return []plan.Clip{
			{ID: "this train terminates here", Delay: 500},
			{ID: "all change please", Delay: 500},
		}
	}
	return destinationSegments(destination, 500)
}

// destinationSegments is the website's assembleDestinationInfoSegments.
func destinationSegments(stationName string, delay int) []plan.Clip {
	return []plan.Clip{{ID: "destination." + destinationFileName(stationName), Delay: delay}}
}

func announcement(clips []plan.Clip) plan.Plan {
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}
}

func (s *System) findNextStation(label jsString) *nextStationItem {
	if !label.defined {
		return nil
	}
	for i := range s.tables.NextStationData {
		if s.tables.NextStationData[i].Label == label.value {
			return &s.tables.NextStationData[i]
		}
	}
	return nil
}

// destinationFileName is the destination clips' /[^a-z \.]/g, which drops the
// ampersand the station clips keep.
func destinationFileName(name string) string {
	return strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r == ' ' || r == '.' {
			return r
		}
		return -1
	}, strings.ToLower(name))
}

// stationFileName is the station clips' /[^a-z\& \.]/g.
func stationFileName(name string) string {
	return strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r == '&' || r == ' ' || r == '.' {
			return r
		}
		return -1
	}, strings.ToLower(name))
}

// jsString is a state field the handlers read as a string. It keeps apart a
// field that is absent and one that is null, because the handlers reach
// straight for a string method and the TypeError that follows is what the
// website reports to the user.
type jsString struct {
	value   string
	defined bool
	null    bool
}

func (j *jsString) UnmarshalJSON(raw []byte) error {
	if string(raw) == "null" {
		j.null = true
		return nil
	}
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		j.value, j.defined = text, true
		return nil
	}
	// A number or a boolean is what a template literal or parseInt would make
	// of it.
	var number json.Number
	if err := json.Unmarshal(raw, &number); err == nil {
		j.value, j.defined = number.String(), true
		return nil
	}
	var flag bool
	if err := json.Unmarshal(raw, &flag); err == nil {
		j.value, j.defined = strconv.FormatBool(flag), true
		return nil
	}
	return fmt.Errorf("cannot read %s as a string", raw)
}

func (j jsString) forMethod(name string) (string, error) {
	if !j.defined {
		return "", undefinedPropertyError(j.null, name)
	}
	return j.value, nil
}

// undefinedPropertyError is V8's own wording, which the website shows unchanged
// when a state field the handler dereferences is not there.
func undefinedPropertyError(isNull bool, property string) error {
	holder := "undefined"
	if isNull {
		holder = "null"
	}
	return fmt.Errorf("Cannot read properties of %s (reading '%s')", holder, property)
}

// jsBool is a state field read for its truthiness, as an `if` in the handlers
// does.
type jsBool bool

func (j *jsBool) UnmarshalJSON(raw []byte) error {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	switch typed := value.(type) {
	case nil:
		*j = false
	case bool:
		*j = jsBool(typed)
	case float64:
		*j = typed != 0
	case string:
		*j = typed != ""
	default:
		*j = true
	}
	return nil
}

// jsParseInt reads an integer the way parseInt does: leading digits count,
// anything after them is ignored, and a value with no digits at all is NaN,
// which indexes nothing.
func jsParseInt(s string) (int, bool) {
	s = strings.TrimSpace(s)
	end := 0
	if end < len(s) && (s[end] == '+' || s[end] == '-') {
		end++
	}
	start := end
	for end < len(s) && s[end] >= '0' && s[end] <= '9' {
		end++
	}
	if end == start {
		return 0, false
	}
	n, err := strconv.Atoi(s[:end])
	return n, err == nil
}
