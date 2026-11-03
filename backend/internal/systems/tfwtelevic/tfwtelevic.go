// Package tfwtelevic ports the website's Transport for Wales Televic system
// (TFW_TELEVIC_V1, the Elin Llwyd and Eryl Jones recordings).
//
// The website is the reference: change its TypeScript first, re-export the
// parity record, then port the change here.
package tfwtelevic

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/instance.json
var instanceData []byte

//go:embed data/buttons.json
var buttonData []byte

const (
	tabStartOfJourney   = "startOfJourney"
	tabStoppedAtStation = "stoppedAtStation"
)

// englishDelay separates the two halves of every announcement: the Welsh one
// is spoken first, and the English one opens after this pause.
const englishDelay = 750

type System struct {
	id         string
	name       string
	filePrefix string
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
	buttons, err := shared.ParseButtons(buttonData)
	if err != nil {
		return nil, err
	}
	return &System{id: instance.ID, name: instance.Name, filePrefix: instance.FilePrefix, buttons: buttons}, nil
}

func (s *System) ID() string         { return s.id }
func (s *System) Name() string       { return s.name }
func (s *System) FilePrefix() string { return s.filePrefix }

func (s *System) Announcements() []string {
	return append([]string{tabStartOfJourney, tabStoppedAtStation}, s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	switch announcement {
	case tabStartOfJourney:
		return startOfJourney(state)
	case tabStoppedAtStation:
		return stoppedAtStation(state)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func startOfJourney(state json.RawMessage) (plan.Plan, error) {
	var opts struct {
		CallingAtCodes []struct {
			CRSCode string `json:"crsCode"`
		} `json:"callingAtCodes"`
	}
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	if len(opts.CallingAtCodes) == 0 {
		return plan.Plan{}, errors.New("Please select at least one station to call at.")
	}

	codes := make([]string, len(opts.CallingAtCodes))
	for i, station := range opts.CallingAtCodes {
		codes[i] = station.CRSCode
	}

	clips := plan.IDs(
		"intro.start.welcome on board",
		"intro.start.we will be ready to depart for",
		"station.e."+codes[len(codes)-1],
	)
	clips = append(clips, plan.Clip{ID: "intro.start.calling at", Delay: 300})
	clips = append(clips, pluraliseStations(codes)...)

	return announce(clips), nil
}

func stoppedAtStation(state json.RawMessage) (plan.Plan, error) {
	var opts struct {
		ThisStation    string `json:"thisStation"`
		Terminus       string `json:"terminus"`
		IsTerminusNext bool   `json:"isTerminusNext"`
	}
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}

	clips := plan.IDs(
		"intro.arrived.welcome to",
		"station.e."+opts.ThisStation,
		"intro.arrived.thank you for travelling with transport for wales",
	)
	switch {
	case opts.Terminus == opts.ThisStation:
	case opts.IsTerminusNext:
		clips = append(clips, plan.IDs(
			"intro.final.we will be travelling to",
			"station.m."+opts.Terminus,
			"intro.final.only",
			"intro.final.the next station will be our final stop",
		)...)
	default:
		clips = append(clips, plan.IDs("intro.mid.we will be travelling to", "station.e."+opts.Terminus)...)
	}

	return announce(clips), nil
}

// pluraliseStations names a calling pattern. It is the system's own list
// joiner, not the base class's: there is no separate "and" clip, so the last
// station takes an "and" recording of its own.
func pluraliseStations(codes []string) []plan.Clip {
	if len(codes) == 1 {
		return plan.IDs("station.e." + codes[0])
	}
	out := make([]plan.Clip, len(codes))
	for i, code := range codes {
		form := "m"
		if i == len(codes)-1 {
			form = "and"
		}
		out[i] = plan.Clip{ID: "station." + form + "." + code, Delay: 100}
	}
	return out
}

// announce says the whole thing twice, in Welsh and then in English. The
// English opening clip's own delay is replaced by englishDelay rather than
// added to it.
func announce(clips []plan.Clip) plan.Plan {
	out := make([]plan.Clip, 0, 2*len(clips))
	for _, clip := range clips {
		clip.ID = "cy." + clip.ID
		out = append(out, clip)
	}
	for i, clip := range clips {
		clip.ID = "en." + clip.ID
		if i == 0 {
			clip.Delay = englishDelay
		}
		out = append(out, clip)
	}
	return plan.Plan{Clips: out, MissingAudioMode: plan.SkipService}
}
