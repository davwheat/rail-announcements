// Package wmtclass172 ports the website's West Midlands Trains Class 172
// on-train announcements. The website is the reference: change its TypeScript
// first, re-export the parity record, then port the change here.
package wmtclass172

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/instance.json
var instanceData []byte

//go:embed data/buttons.json
var buttonData []byte

var optionTabs = []string{"approachingStation", "stoppedAtStation"}

const (
	tocLondonMidland = "LM"
	tocGeneric       = "Generic"
)

type instance struct {
	Name                  string              `json:"NAME"`
	ID                    string              `json:"ID"`
	FilePrefix            string              `json:"FILE_PREFIX"`
	ForcedChangeHere      map[string][]string `json:"StationsWithForcedChangeHere"`
	AvailableStationNames struct {
		High []string `json:"high"`
	} `json:"AvailableStationNames"`
}

type System struct {
	data     instance
	stations map[string]bool
	buttons  shared.Buttons
}

func New() (*System, error) {
	var data instance
	if err := json.Unmarshal(instanceData, &data); err != nil {
		return nil, fmt.Errorf("instance data: %w", err)
	}
	buttons, err := shared.ParseButtons(buttonData)
	if err != nil {
		return nil, err
	}
	stations := make(map[string]bool, len(data.AvailableStationNames.High))
	for _, crs := range data.AvailableStationNames.High {
		stations[crs] = true
	}
	return &System{data: data, stations: stations, buttons: buttons}, nil
}

func (s *System) ID() string         { return s.data.ID }
func (s *System) Name() string       { return s.data.Name }
func (s *System) FilePrefix() string { return s.data.FilePrefix }

func (s *System) Announcements() []string {
	return append(append([]string{}, optionTabs...), s.buttons.Tabs()...)
}

type approachingOptions struct {
	StationCode    string `json:"stationCode"`
	TOC            string `json:"toc"`
	TerminatesHere bool   `json:"terminatesHere"`
	TicketsReady   bool   `json:"ticketsReady"`
	MindTheGap     bool   `json:"mindTheGap"`
}

type stoppedOptions struct {
	TerminatesAt    string `json:"terminatesAtCode"`
	TOC             string `json:"toc"`
	ReadAllStations bool   `json:"readAllStations"`
	CallingAt       []struct {
		CRS string `json:"crsCode"`
	} `json:"callingAtCodes"`
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	switch announcement {
	case "approachingStation":
		var o approachingOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return announce(s.approachingStation(o)), nil

	case "stoppedAtStation":
		var o stoppedOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		clips, err := s.stoppedAtStation(o)
		if err != nil {
			return plan.Plan{}, err
		}
		return announce(clips), nil
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func (s *System) approachingStation(o approachingOptions) []plan.Clip {
	clips := []plan.Clip{
		{ID: "bing bong"},
		{ID: "we are now approaching"},
		{ID: station(o.StationCode)},
	}
	if o.TerminatesHere {
		clips = append(clips, plan.Clip{ID: "our final destination"})
	}
	if changes, ok := s.data.ForcedChangeHere[o.StationCode]; ok {
		clips = append(clips, plan.Clip{ID: "change here for"})
		clips = append(clips, plan.Pluralise(plan.IDs(changes...), plan.PluraliseOptions{})...)
	}
	if o.TOC == tocLondonMidland {
		clips = append(clips, plan.Clip{ID: "thank you for travelling with london midland"})
	}
	if o.TicketsReady {
		clips = append(clips, plan.Clip{ID: "please have your tickets ready"})
	}
	if o.MindTheGap {
		clips = append(clips, mindTheGap(o.TOC))
	}
	return clips
}

func (s *System) stoppedAtStation(o stoppedOptions) ([]plan.Clip, error) {
	if err := s.validateStationExists(o.TerminatesAt); err != nil {
		return nil, err
	}
	clips := []plan.Clip{{ID: "bing bong"}}

	if len(o.CallingAt) == 0 {
		clips = append(clips, plan.Clip{ID: "this is"}, plan.Clip{ID: station(o.TerminatesAt)}, plan.Clip{ID: "our final destination"})
		if o.TOC == tocLondonMidland {
			clips = append(clips, plan.Clip{ID: "thank you for travelling with london midland"})
		}
		return append(clips, mindTheGap(o.TOC)), nil
	}

	switch o.TOC {
	case tocGeneric:
		clips = append(clips, plan.Clip{ID: "this train is for"})
	case tocLondonMidland:
		clips = append(clips, plan.Clip{ID: "welcome aboard this london midland service to"})
	default:
		clips = append(clips, plan.Clip{ID: "welcome to this service for"})
	}
	clips = append(clips, plan.Clip{ID: station(o.TerminatesAt)})

	remaining := make([]plan.Clip, 0, len(o.CallingAt)+1)
	for _, stop := range o.CallingAt {
		if err := s.validateStationExists(stop.CRS); err != nil {
			return nil, err
		}
		remaining = append(remaining, plan.Clip{ID: station(stop.CRS)})
	}
	remaining = append(remaining, plan.Clip{ID: station(o.TerminatesAt)})

	if len(remaining) == 1 || !o.ReadAllStations {
		return append(clips, plan.Clip{ID: "the next station is"}, remaining[0]), nil
	}
	clips = append(clips, plan.Clip{ID: "calling at"})
	return append(clips, plan.Pluralise(remaining, plan.PluraliseOptions{})...), nil
}

// mindTheGap picks the wording each operator's recordings use.
func mindTheGap(toc string) plan.Clip {
	if toc == tocLondonMidland || toc == tocGeneric {
		return plan.Clip{ID: "please mind the gap between the platform and the train"}
	}
	return plan.Clip{ID: "please mind the gap when leaving the train and step"}
}

// validateStationExists refuses a station without a recording, with the
// message the website alerts.
func (s *System) validateStationExists(crs string) error {
	if s.stations[crs] {
		return nil
	}
	name, ok := shared.StationName(crs)
	if !ok {
		name = "undefined"
	}
	return fmt.Errorf(
		"Unfortunately, we don't have the recording for %s in the needed type (type: high). If you can record this, please do so, then create an issue or PR on GitHub!",
		name,
	)
}

func station(crs string) string { return "stations." + crs }

func announce(clips []plan.Clip) plan.Plan {
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}
}

func decode(state json.RawMessage, into any) error {
	if err := json.Unmarshal(state, into); err != nil {
		return fmt.Errorf("state: %w", err)
	}
	return nil
}
