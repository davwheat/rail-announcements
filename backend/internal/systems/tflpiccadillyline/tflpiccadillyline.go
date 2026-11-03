// Package tflpiccadillyline ports the website's TfL Piccadilly Line system,
// which builds 1973 Tube Stock on-train announcements from an announcement
// card. The website
// (src/announcement-data/systems/rolling-stock/TfLPiccadillyLine.tsx) is the
// reference: change the TypeScript first, re-export the parity record, then
// port.
package tflpiccadillyline

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/instance.json
var instanceData []byte

//go:embed data/module.json
var moduleData []byte

//go:embed data/buttons.json
var buttonData []byte

type clip struct {
	SpecID int    `json:"specId"`
	Clip   string `json:"clip"`
}

type station struct {
	Number      int   `json:"number"`
	AtStation   *clip `json:"atStation"`
	Approaching *clip `json:"approaching"`
	Destination *clip `json:"destination"`
}

// extraPair is the same announcement in its two tenses, by audio ID. A pair
// the export leaves half-filled, or a lookup that misses, decodes to zero,
// which stands in for the TypeScript's undefined: the card numbers no audio 0,
// so findClip misses either way.
type extraPair struct {
	AtStation   int `json:"atStation"`
	Approaching int `json:"approaching"`
}

type stationExtras struct {
	Interchange extraPair `json:"interchange"`
	LocalInfo   extraPair `json:"localInfo"`
}

// module is the TypeScript module scope: the clips the announcement card
// carries (TfLPiccadillyLineData.ts) and the tables the system declares beside
// them.
type module struct {
	Stations               []station `json:"Stations"`
	GeneralAnnouncements   []clip    `json:"GeneralAnnouncements"`
	InterchangeAtStation   []clip    `json:"InterchangeAtStation"`
	InterchangeApproaching []clip    `json:"InterchangeApproaching"`
	LocalInfoAtStation     []clip    `json:"LocalInfoAtStation"`
	LocalInfoApproaching   []clip    `json:"LocalInfoApproaching"`
	SafetyAnnouncements    []clip    `json:"SafetyAnnouncements"`

	GapBetweenClips int       `json:"GAP_BETWEEN_CLIPS"`
	MindTheGap      int       `json:"MIND_THE_GAP"`
	Terminating     extraPair `json:"TERMINATING"`

	ReducedAccessAnnouncements []clip                    `json:"ReducedAccessAnnouncements"`
	StationExtras              map[int]stationExtras     `json:"StationExtras"`
	ServiceAnnouncements       map[int]map[int]extraPair `json:"ServiceAnnouncements"`
}

type identity struct {
	Name       string `json:"NAME"`
	ID         string `json:"ID"`
	FilePrefix string `json:"FILE_PREFIX"`
}

type System struct {
	identity identity
	module   module
	buttons  shared.Buttons
}

func New() (*System, error) {
	s := &System{}
	if err := json.Unmarshal(instanceData, &s.identity); err != nil {
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

func (s *System) ID() string         { return s.identity.ID }
func (s *System) Name() string       { return s.identity.Name }
func (s *System) FilePrefix() string { return s.identity.FilePrefix }

func (s *System) Announcements() []string {
	return append([]string{"approachingStation", "atStation", "destination"}, s.buttons.Tabs()...)
}

type approachingStationOptions struct {
	StationNumber     string `json:"stationNumber"`
	DestinationNumber string `json:"destinationNumber"`
	ReducedAccess     string `json:"reducedAccess"`
}

type atStationOptions struct {
	StationNumber       string   `json:"stationNumber"`
	DestinationNumber   string   `json:"destinationNumber"`
	AnnounceDestination bool     `json:"announceDestination"`
	ReducedAccess       string   `json:"reducedAccess"`
	Safety              []string `json:"safety"`
}

type destinationOptions struct {
	StationNumber string `json:"stationNumber"`
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	switch announcement {
	case "approachingStation":
		var opts approachingStationOptions
		if err := json.Unmarshal(state, &opts); err != nil {
			return plan.Plan{}, fmt.Errorf("state: %w", err)
		}
		return s.planApproachingStation(opts), nil
	case "atStation":
		var opts atStationOptions
		if err := json.Unmarshal(state, &opts); err != nil {
			return plan.Plan{}, fmt.Errorf("state: %w", err)
		}
		return s.planAtStation(opts), nil
	case "destination":
		var opts destinationOptions
		if err := json.Unmarshal(state, &opts); err != nil {
			return plan.Plan{}, fmt.Errorf("state: %w", err)
		}
		return s.planDestination(opts), nil
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func (s *System) planApproachingStation(opts approachingStationOptions) plan.Plan {
	station := s.findStation(opts.StationNumber)
	if station == nil || station.Approaching == nil {
		return plan.Plan{}
	}
	extras := s.module.StationExtras[station.Number]
	service := s.serviceAnnouncement(station.Number, opts.DestinationNumber)

	clips := []*clip{station.Approaching}
	clips = append(clips, findClip(s.module.InterchangeApproaching, service.Approaching))
	if opts.StationNumber == opts.DestinationNumber {
		clips = append(clips, findClip(s.module.GeneralAnnouncements, s.module.Terminating.Approaching))
	}
	clips = append(clips, findClip(s.module.InterchangeApproaching, extras.Interchange.Approaching))
	clips = append(clips, findClip(s.module.LocalInfoApproaching, extras.LocalInfo.Approaching))
	clips = append(clips, s.reducedAccessClip(opts.ReducedAccess))

	return s.playClips(clips)
}

func (s *System) planAtStation(opts atStationOptions) plan.Plan {
	station := s.findStation(opts.StationNumber)
	if station == nil || station.AtStation == nil {
		return plan.Plan{}
	}
	extras := s.module.StationExtras[station.Number]
	service := s.serviceAnnouncement(station.Number, opts.DestinationNumber)

	var leadingSafety, trailingSafety []*clip
	for _, raw := range opts.Safety {
		specID, ok := jsParseInt(raw)
		if !ok {
			continue
		}
		found := findClip(s.module.SafetyAnnouncements, specID)
		switch {
		case found == nil:
		case found.SpecID == s.module.MindTheGap:
			leadingSafety = append(leadingSafety, found)
		default:
			trailingSafety = append(trailingSafety, found)
		}
	}
	terminating := opts.StationNumber == opts.DestinationNumber

	clips := append([]*clip{}, leadingSafety...)
	clips = append(clips, station.AtStation)
	clips = append(clips, findClip(s.module.InterchangeAtStation, service.AtStation))
	if terminating {
		clips = append(clips, findClip(s.module.GeneralAnnouncements, s.module.Terminating.AtStation))
	}
	clips = append(clips, findClip(s.module.InterchangeAtStation, extras.Interchange.AtStation))
	clips = append(clips, findClip(s.module.LocalInfoAtStation, extras.LocalInfo.AtStation))
	clips = append(clips, s.reducedAccessClip(opts.ReducedAccess))
	if opts.AnnounceDestination && !terminating {
		if destination := s.findStation(opts.DestinationNumber); destination != nil {
			clips = append(clips, destination.Destination)
		}
	}
	clips = append(clips, trailingSafety...)

	return s.playClips(clips)
}

func (s *System) planDestination(opts destinationOptions) plan.Plan {
	station := s.findStation(opts.StationNumber)
	if station == nil || station.Destination == nil {
		return plan.Plan{}
	}
	return s.playClips([]*clip{station.Destination})
}

// playClips mirrors the card's own pacing: the first clip starts at once and
// every later one waits out the gap.
func (s *System) playClips(clips []*clip) plan.Plan {
	built := plan.Plan{MissingAudioMode: plan.SkipService}
	for _, c := range clips {
		if c == nil {
			continue
		}
		item := plan.Clip{ID: c.Clip}
		if len(built.Clips) > 0 {
			item.Delay = s.module.GapBetweenClips
		}
		built.Clips = append(built.Clips, item)
	}
	return built
}

func (s *System) findStation(stationNumber string) *station {
	for i := range s.module.Stations {
		if fmt.Sprint(s.module.Stations[i].Number) == stationNumber {
			return &s.module.Stations[i]
		}
	}
	return nil
}

func (s *System) reducedAccessClip(reducedAccess string) *clip {
	specID, ok := jsParseInt(reducedAccess)
	if !ok {
		return nil
	}
	return findClip(s.module.ReducedAccessAnnouncements, specID)
}

func (s *System) serviceAnnouncement(stationNumber int, destinationNumber string) extraPair {
	destination, ok := jsParseInt(destinationNumber)
	if !ok {
		return extraPair{}
	}
	return s.module.ServiceAnnouncements[stationNumber][destination]
}

func findClip(clips []clip, specID int) *clip {
	for i := range clips {
		if clips[i].SpecID == specID {
			return &clips[i]
		}
	}
	return nil
}
