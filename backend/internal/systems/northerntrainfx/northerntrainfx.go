// Package northerntrainfx ports the website's NORTHERN_TRAINFX_V1 system, the
// Northern Rail and Northern Electrics TrainFX on-train announcements. The
// website's src/announcement-data/systems/rolling-stock/NorthernTrainFx.tsx is
// the reference: change it there first, re-export, then port the change here.
package northerntrainfx

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"slices"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/instance.json
var instanceData []byte

//go:embed data/module.json
var moduleData []byte

//go:embed data/buttons.json
var buttonData []byte

// announcements are the option tabs, in the order the website declares them.
var announcements = []string{
	"welcomeAboard",
	"departingStation",
	"approachingStation",
	"atStation",
	"disruption",
	"dividingTrain",
	"connections",
}

type instance struct {
	ID         string `json:"ID"`
	Name       string `json:"NAME"`
	FilePrefix string `json:"FILE_PREFIX"`
	// AvailableStationNames holds the CRS codes recorded in each pitch, keyed
	// "high" and "low".
	AvailableStationNames map[string][]string `json:"AvailableStationNames"`
}

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

// moduleTables are the module constants of the website's TypeScript.
type moduleTables struct {
	// SentenceGap is the silence the system leaves between sentences.
	SentenceGap int `json:"SENTENCE_GAP"`
	// PrincipalStations are the stations flagged as principal in the TrainFX
	// export, where arrival repeats the safety reminders.
	PrincipalStations []string `json:"PRINCIPAL_STATIONS"`
	// OhNumbers name the hours and minutes below ten, indexed by the number
	// they name. The empty first entry is never spoken: zero has clips of its
	// own.
	OhNumbers            []string    `json:"OH_NUMBERS"`
	StartOfJourneySafety []audioItem `json:"START_OF_JOURNEY_SAFETY"`
}

type System struct {
	data    instance
	tables  moduleTables
	buttons shared.Buttons
}

func New() (*System, error) {
	s := &System{}
	if err := json.Unmarshal(instanceData, &s.data); err != nil {
		return nil, fmt.Errorf("instance: %w", err)
	}
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

func (s *System) ID() string         { return s.data.ID }
func (s *System) Name() string       { return s.data.Name }
func (s *System) FilePrefix() string { return s.data.FilePrefix }

func (s *System) Announcements() []string {
	return append(slices.Clone(announcements), s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	switch announcement {
	case "welcomeAboard":
		return build(state, s.welcomeAboard)
	case "departingStation":
		return build(state, s.departingStation)
	case "approachingStation":
		return build(state, s.approachingStation)
	case "atStation":
		return build(state, s.atStation)
	case "disruption":
		return build(state, s.disruption)
	case "dividingTrain":
		return build(state, s.dividingTrain)
	case "connections":
		return build(state, s.connections)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

// build decodes a tab's option object and runs its play handler. Every handler
// plays with the defaults of playAudioFiles: no start delay, and an
// announcement that fails when a clip is missing.
func build[Options any](state json.RawMessage, handler func(Options) (clips, error)) (plan.Plan, error) {
	var o Options
	if err := json.Unmarshal(state, &o); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	files, err := handler(o)
	if err != nil {
		return plan.Plan{}, err
	}
	return plan.Plan{Clips: files, MissingAudioMode: plan.SkipService}, nil
}

const (
	pitchHigh = "high"
	pitchLow  = "low"
)

// callingPoint is one entry of the website's CallingAtSelector. Only the CRS
// code reaches the audio.
type callingPoint struct {
	CrsCode string `json:"crsCode"`
}

// validateStation reports the website's own alert when a station has no
// recording in the pitch an announcement needs.
func (s *System) validateStation(crs, pitch string) error {
	if slices.Contains(s.data.AvailableStationNames[pitch], crs) {
		return nil
	}
	return fmt.Errorf("Unfortunately, we don't have the recording for %s in the needed type (type: %s). If you can record this, please do so, then create an issue or PR on GitHub!", stationName(crs), pitch)
}

func (s *System) validateCallingPoints(points []callingPoint) error {
	for _, point := range points {
		if err := s.validateStation(point.CrsCode, pitchHigh); err != nil {
			return err
		}
	}
	return nil
}

// stationName names a CRS the way the alert does. The website reads the name
// from the national station list and interpolates it without checking, so a
// station outside this system's own list is still named, and only a CRS the
// national list has no entry for becomes the string "undefined".
func stationName(crs string) string {
	if name, ok := shared.StationName(crs); ok {
		return name
	}
	return "undefined"
}

// firstError follows the handlers' chains of `||`-joined validations, which
// stop at the first station that refuses.
func firstError(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}
