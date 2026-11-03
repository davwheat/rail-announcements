// Package tfljubileeline ports the website's TfL Jubilee Line system
// (src/announcement-data/systems/rolling-stock/TfLJubileeLine.tsx). The website
// is the reference: change the TypeScript first, re-export the parity record,
// then port.
package tfljubileeline

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"slices"
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

// stationFilesDelay leads into every station clip that the website delays, and
// into the door direction.
const stationFilesDelay = 500

type System struct {
	instance instance
	module   module
	buttons  shared.Buttons
}

type instance struct {
	Name       string `json:"NAME"`
	ID         string `json:"ID"`
	FilePrefix string `json:"FILE_PREFIX"`
}

// module holds the TypeScript's module-level constants. ElizAffected is the
// list the handlers test against before reaching for a station's PostEliz
// files.
type module struct {
	Stations     []stationData `json:"StationData"`
	ElizAffected []string      `json:"elizAffectedStations"`
}

// stationFiles are the clips a station is announced with, in the order they
// play.
type stationFiles struct {
	Approaching []string `json:"approachingFiles"`
	Standing    []string `json:"standingFiles"`
}

// stationData is one entry of the TypeScript's StationData. Its canTerminate
// flag is left out: only the tab's option list reads it.
type stationData struct {
	Name string `json:"name"`
	stationFiles
	PostEliz *stationFiles `json:"postEliz"`
	// FullMessages marks a station recorded as whole sentences, which play on
	// their own: no "the next station is", no door direction.
	FullMessages bool `json:"fullMessages"`
}

func New() (*System, error) {
	s := &System{}
	if err := json.Unmarshal(instanceData, &s.instance); err != nil {
		return nil, fmt.Errorf("instance: %w", err)
	}
	if err := json.Unmarshal(moduleData, &s.module); err != nil {
		return nil, fmt.Errorf("module: %w", err)
	}
	buttons, err := shared.ParseButtons(buttonData)
	if err != nil {
		return nil, err
	}
	s.buttons = buttons
	return s, nil
}

func (s *System) ID() string         { return s.instance.ID }
func (s *System) Name() string       { return s.instance.Name }
func (s *System) FilePrefix() string { return s.instance.FilePrefix }

func (s *System) Announcements() []string {
	return append([]string{"destinationInfo", "nextStation", "thisStation"}, s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}

	switch announcement {
	case "destinationInfo":
		o := destinationInfoOptions{TerminatingStationName: absentValue()}
		if err := decodeState(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return destinationInfo(o)

	case "nextStation":
		o := nextStationOptions{StationName: absentValue(), DoorDirection: absentValue()}
		if err := decodeState(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return s.nextStation(o), nil

	case "thisStation":
		o := thisStationOptions{StationName: absentValue()}
		if err := decodeState(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return s.thisStation(o), nil
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func decodeState(state json.RawMessage, into any) error {
	if len(state) == 0 {
		return nil
	}
	if err := json.Unmarshal(state, into); err != nil {
		return fmt.Errorf("state: %w", err)
	}
	return nil
}

type destinationInfoOptions struct {
	TerminatingStationName jsValue `json:"terminatingStationName"`
}

type nextStationOptions struct {
	StationName   jsValue  `json:"stationName"`
	DoorDirection jsValue  `json:"doorDirection"`
	UsePostEliz   jsTruthy `json:"usePostEliz"`
}

type thisStationOptions struct {
	StationName jsValue  `json:"stationName"`
	UsePostEliz jsTruthy `json:"usePostEliz"`
}

func destinationInfo(o destinationInfoOptions) (plan.Plan, error) {
	if !o.TerminatingStationName.isString {
		return plan.Plan{}, o.TerminatingStationName.notAStringError("options.terminatingStationName", "toLowerCase")
	}
	clips := []plan.Clip{
		{ID: "anita.this train terminates at"},
		{ID: "anita." + audioName(o.TerminatingStationName.text), Delay: stationFilesDelay},
	}
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}, nil
}

func (s *System) nextStation(o nextStationOptions) plan.Plan {
	station := s.findStation(o.StationName)
	if station != nil && station.FullMessages {
		return plan.Plan{Clips: plan.IDs(station.Approaching...), MissingAudioMode: plan.SkipService}
	}

	stnFiles := s.stationClips(o.StationName, o.UsePostEliz, func(f stationFiles) []string { return f.Approaching })
	stnFiles[0].Delay = stationFilesDelay
	// The website writes over the second station clip only when there is one,
	// so a two-clip station gets a lead-in on both and a longer list does not.
	if len(stnFiles) > 1 && stnFiles[1].ID != "" {
		stnFiles[1].Delay = stationFilesDelay
	}

	clips := append([]plan.Clip{{ID: "the next station is"}}, stnFiles...)
	doors := plan.Clip{
		ID:    "doors will open on the " + o.DoorDirection.text + " hand side",
		Delay: stationFilesDelay,
	}
	// The doors clip is spliced in at index 2, which puts it between the
	// station's name and whatever the station's own files say next.
	clips = slices.Insert(clips, min(2, len(clips)), doors)

	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}
}

func (s *System) thisStation(o thisStationOptions) plan.Plan {
	station := s.findStation(o.StationName)
	if station != nil && station.FullMessages {
		return plan.Plan{Clips: plan.IDs(station.Standing...), MissingAudioMode: plan.SkipService}
	}

	stnFiles := s.stationClips(o.StationName, o.UsePostEliz, func(f stationFiles) []string { return f.Standing })
	stnFiles[0].Delay = stationFilesDelay

	clips := append([]plan.Clip{{ID: "this station is"}}, stnFiles...)
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}
}

// stationClips picks the Elizabeth line files over the station's own when
// elizAffectedStations names the station and the state asks for them. It never
// returns an empty slice: the website assigns to index 0 unconditionally, which
// grows an empty array to one clip with no ID.
func (s *System) stationClips(name jsValue, usePostEliz jsTruthy, pick func(stationFiles) []string) []plan.Clip {
	station := s.findStation(name)

	var ids []string
	switch {
	case s.postElizAffects(name) && bool(usePostEliz):
		if station != nil && station.PostEliz != nil {
			ids = pick(*station.PostEliz)
		}
	case station != nil:
		ids = pick(station.stationFiles)
	}
	if len(ids) == 0 {
		return []plan.Clip{{}}
	}
	return plan.IDs(ids...)
}

func (s *System) postElizAffects(name jsValue) bool {
	return name.isString && slices.Contains(s.module.ElizAffected, name.text)
}

func (s *System) findStation(name jsValue) *stationData {
	if !name.isString {
		return nil
	}
	for i := range s.module.Stations {
		if s.module.Stations[i].Name == name.text {
			return &s.module.Stations[i]
		}
	}
	return nil
}

// audioName is the station name as the destination clips are filed: lower case
// with everything but letters and spaces dropped, so St. John's Wood is
// "st johns wood".
func audioName(station string) string {
	var out strings.Builder
	for _, r := range strings.ToLower(station) {
		if r == ' ' || (r >= 'a' && r <= 'z') {
			out.WriteRune(r)
		}
	}
	return out.String()
}

// jsValue is a state field read as the website's handlers read it. They tell a
// string apart from a missing field, null or a number: `===` matches none of
// those, and a template literal spells them out rather than dropping them.
type jsValue struct {
	text     string
	isString bool
}

// absentValue is a field the state leaves out, spelled as a template literal
// spells undefined.
func absentValue() jsValue { return jsValue{text: "undefined"} }

func (v *jsValue) UnmarshalJSON(raw []byte) error {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	switch value := value.(type) {
	case nil:
		v.text, v.isString = "null", false
	case string:
		v.text, v.isString = value, true
	default:
		v.text, v.isString = strings.TrimSpace(string(raw)), false
	}
	return nil
}

// notAStringError is the TypeError the handler throws when it calls a string
// method on a field that holds no string.
func (v jsValue) notAStringError(field, method string) error {
	switch v.text {
	case "undefined", "null":
		return fmt.Errorf("Cannot read properties of %s (reading '%s')", v.text, method)
	}
	return fmt.Errorf("%s.%s is not a function", field, method)
}

// jsTruthy is a state field the handlers only test for truth, so it follows
// JavaScript's rules rather than requiring a boolean.
type jsTruthy bool

func (t *jsTruthy) UnmarshalJSON(raw []byte) error {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	switch value := value.(type) {
	case nil:
		*t = false
	case bool:
		*t = jsTruthy(value)
	case float64:
		*t = value != 0
	case string:
		*t = value != ""
	default:
		*t = true
	}
	return nil
}
