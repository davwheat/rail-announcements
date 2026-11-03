// Package tlclass700 ports the website's Thameslink Class 700 on-train
// announcements (TL_CLASS_700_V1), in Julie Berry's and Matt Streeton's voices.
//
// The website is the reference: change
// src/announcement-data/systems/rolling-stock/TLClass700.tsx there first,
// re-export the parity record, then port the change here.
package tlclass700

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

//go:embed data/buttons.json
var buttonData []byte

// announcements are the website's option tabs, in the order it declares them.
var announcements = []string{"initialDeparture", "approachingStation", "stoppedAtStation"}

// additionalStations are the test stations the website's own
// validateStationExists override accepts regardless of the audio library.
var additionalStations = []string{"TESTELJ", "TESTHHL", "TESTWBY", "TESTWLN"}

// instance is the website class's data, as its exporter dumps it.
type instance struct {
	ID         string `json:"ID"`
	Name       string `json:"NAME"`
	FilePrefix string `json:"FILE_PREFIX"`

	Attractions      map[string]string `json:"StationsWithAttractions"`
	ForcedChangeHere map[string]string `json:"StationsWithForcedChangeHere"`

	AvailableStationNames struct {
		Low  []string `json:"low"`
		High []string `json:"high"`
	} `json:"AvailableStationNames"`
}

type System struct {
	data    instance
	buttons shared.Buttons
}

func New() (*System, error) {
	var s System
	if err := json.Unmarshal(instanceData, &s.data); err != nil {
		return nil, fmt.Errorf("instance: %w", err)
	}
	buttons, err := shared.ParseButtons(buttonData)
	s.buttons = buttons
	return &s, err
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
	case "initialDeparture":
		var o departureOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return s.initialDeparture(o)

	case "approachingStation":
		var o approachingOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return s.approachingStation(o)

	case "stoppedAtStation":
		var o stoppedOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return s.stoppedAtStation(o)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func decode(state json.RawMessage, into any) error {
	if err := json.Unmarshal(state, into); err != nil {
		return fmt.Errorf("state: %w", err)
	}
	return nil
}

// pitch is which recording of a station name to speak: the falling one that
// ends a sentence, or the level one that carries on into the next station.
type pitch string

const (
	high pitch = "high"
	low  pitch = "low"
)

// callingPoint is one stop of the website's calling-point selector. Only the
// CRS code reaches the audio.
type callingPoint struct {
	CRSCode string `json:"crsCode"`
}

type departureOptions struct {
	TerminatesAtCode string         `json:"terminatesAtCode"`
	CallingAtCodes   []callingPoint `json:"callingAtCodes"`
	ServiceType      string         `json:"serviceType"`
}

type approachingOptions struct {
	StationCode        string   `json:"stationCode"`
	IsAto              bool     `json:"isAto"`
	TerminatesHere     bool     `json:"terminatesHere"`
	TakeCareAsYouLeave bool     `json:"takeCareAsYouLeave"`
	ChangeFor          []string `json:"changeFor"`
}

type stoppedOptions struct {
	ThisStationCode  string         `json:"thisStationCode"`
	TerminatesAtCode string         `json:"terminatesAtCode"`
	CallingAtCodes   []callingPoint `json:"callingAtCodes"`
	MindTheGap       bool           `json:"mindTheGap"`
}

func (s *System) initialDeparture(o departureOptions) (plan.Plan, error) {
	if err := s.validateStationExists(o.TerminatesAtCode, low); err != nil {
		return plan.Plan{}, err
	}

	welcome := "welcome aboard this service to"
	switch o.ServiceType {
	case "southeastern":
		welcome = "welcome aboard this southeastern service to"
	case "generic":
		welcome = "this train is for"
	}
	files := []plan.Clip{
		{ID: welcome},
		{ID: "stations.low." + o.TerminatesAtCode, Delay: 250},
	}

	if len(o.CallingAtCodes) == 0 {
		if err := s.validateStationExists(o.TerminatesAtCode, high); err != nil {
			return plan.Plan{}, err
		}
		files = append(files,
			plan.Clip{ID: "the next station is", Delay: 1000},
			plan.Clip{ID: "stations.high." + o.TerminatesAtCode},
			plan.Clip{ID: "our final destination"},
		)
	} else {
		files = append(files, plan.Clip{ID: "we will be calling at", Delay: 1000})
		stops, err := s.callingPoints(o.CallingAtCodes, o.TerminatesAtCode)
		if err != nil {
			return plan.Plan{}, err
		}
		files = append(files, stops...)
	}

	files = append(files, plan.Clip{ID: "safety information is provided on posters in every carriage", Delay: 2000})
	return plays(files), nil
}

func (s *System) approachingStation(o approachingOptions) (plan.Plan, error) {
	var files []plan.Clip
	if o.TerminatesHere {
		if err := s.validateStationExists(o.StationCode, high); err != nil {
			return plan.Plan{}, err
		}
		files = append(files,
			plan.Clip{ID: "we will shortly be arriving at"},
			plan.Clip{ID: "stations.high." + o.StationCode, Delay: 500},
			plan.Clip{ID: "our final destination thank you for travelling with us please remember to take all your personal belongings with you when you leave the train"},
		)
	} else {
		if err := s.validateStationExists(o.StationCode, low); err != nil {
			return plan.Plan{}, err
		}
		files = append(files,
			plan.Clip{ID: "we will shortly be arriving at"},
			plan.Clip{ID: "stations.low." + o.StationCode, Delay: 500},
		)
	}

	// A station with its own connections announcement overrides the chosen one.
	if connections, ok := s.data.ForcedChangeHere[o.StationCode]; ok {
		files = append(files,
			plan.Clip{ID: "change here for", Delay: 500},
			plan.Clip{ID: "station connections." + connections},
		)
	} else if len(o.ChangeFor) > 0 {
		items := make([]plan.Clip, len(o.ChangeFor))
		for i, poi := range o.ChangeFor {
			items[i] = plan.Clip{ID: "station connections." + poi}
		}
		files = append(files, plan.Clip{ID: "change here for", Delay: 500})
		files = append(files, plan.Pluralise(items, plan.PluraliseOptions{BeforeAndDelay: plan.Ptr(50)})...)
	}

	if attractions, ok := s.data.Attractions[o.StationCode]; ok {
		files = append(files,
			plan.Clip{ID: "exit here for"},
			plan.Clip{ID: "station attractions." + attractions},
		)
	}

	if o.TakeCareAsYouLeave {
		files = append(files, plan.Clip{ID: "please make sure you have all your belongings and take care as you leave the train", Delay: 500})
	}
	if o.IsAto {
		files = append(files, plan.Clip{ID: "the doors will open automatically at the next station", Delay: 500})
	}
	return plays(files), nil
}

func (s *System) stoppedAtStation(o stoppedOptions) (plan.Plan, error) {
	var files []plan.Clip
	thisStationDelay := 0
	if o.MindTheGap {
		files = append(files, plan.Clip{ID: "please mind the gap between the train and the platform"})
		thisStationDelay = 500
	}

	if err := s.validateStationExists(o.ThisStationCode, low); err != nil {
		return plan.Plan{}, err
	}
	files = append(files,
		plan.Clip{ID: "this station is", Delay: thisStationDelay},
		plan.Clip{ID: "stations.low." + o.ThisStationCode, Delay: 500},
	)

	switch {
	case o.ThisStationCode == o.TerminatesAtCode:
		files = append(files, plan.Clip{ID: "this train terminates here all change", Delay: 4600})

	case len(o.CallingAtCodes) == 0:
		if err := s.validateStationExists(o.TerminatesAtCode, high); err != nil {
			return plan.Plan{}, err
		}
		files = append(files,
			plan.Clip{ID: "the next station is", Delay: 4600},
			plan.Clip{ID: "stations.high." + o.TerminatesAtCode},
			plan.Clip{ID: "our final destination"},
		)

	default:
		if err := s.validateStationExists(o.TerminatesAtCode, low); err != nil {
			return plan.Plan{}, err
		}
		files = append(files,
			plan.Clip{ID: "this train terminates at", Delay: 4600},
			plan.Clip{ID: "stations.low." + o.TerminatesAtCode},
			plan.Clip{ID: "we will be calling at", Delay: 1000},
		)
		stops, err := s.callingPoints(o.CallingAtCodes, o.TerminatesAtCode)
		if err != nil {
			return plan.Plan{}, err
		}
		files = append(files, stops...)
	}
	return plays(files), nil
}

// callingPoints reads the stops and then the destination, which ends the list
// in the pitch that closes a sentence.
func (s *System) callingPoints(stops []callingPoint, terminatesAt string) ([]plan.Clip, error) {
	items := make([]plan.Clip, 0, len(stops)+1)
	for _, stop := range stops {
		if err := s.validateStationExists(stop.CRSCode, high); err != nil {
			return nil, err
		}
		items = append(items, plan.Clip{ID: "stations.high." + stop.CRSCode})
	}
	if err := s.validateStationExists(terminatesAt, low); err != nil {
		return nil, err
	}
	items = append(items, plan.Clip{ID: "stations.low." + terminatesAt})

	return plan.Pluralise(items, plan.PluraliseOptions{
		BeforeItemDelay: plan.Ptr(350),
		BeforeAndDelay:  plan.Ptr(350),
		AfterAndDelay:   plan.Ptr(350),
	}), nil
}

// plays wraps the clips in the play call's own defaults, which no tab of this
// system overrides.
func plays(files []plan.Clip) plan.Plan {
	return plan.Plan{Clips: files, MissingAudioMode: plan.SkipService}
}

// validateStationExists refuses a station the voices have no recording of, in
// the message the website alerts. The website names it from the national
// station list, not from the stations it records, so a station it knows and has
// no recording of is named in full.
func (s *System) validateStationExists(crs string, p pitch) error {
	if slices.Contains(additionalStations, crs) || slices.Contains(s.recorded(p), crs) {
		return nil
	}
	name, ok := shared.StationName(crs)
	if !ok {
		// The website splices in getStationByCrs(crs)?.stationName, so a code
		// that is no station at all reads as JavaScript's own undefined.
		name = "undefined"
	}
	return fmt.Errorf(
		"Unfortunately, we don't have the recording for %s in the needed type (type: %s). If you can record this, please do so, then create an issue or PR on GitHub!",
		name, p,
	)
}

func (s *System) recorded(p pitch) []string {
	if p == low {
		return s.data.AvailableStationNames.Low
	}
	return s.data.AvailableStationNames.High
}
