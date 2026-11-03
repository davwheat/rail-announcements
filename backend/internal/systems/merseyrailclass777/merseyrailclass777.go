// Package merseyrailclass777 ports the website's Merseyrail Class 777
// on-train announcements. The website is the reference: change its TypeScript
// first, re-export the parity record, then port the change here.
package merseyrailclass777

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

const (
	tabStartOfJourney     = "startOfJourney"
	tabDepartingStation   = "departingStation"
	tabApproachingStation = "approachingStation"
	tabAtStation          = "atStation"
	tabDisruption         = "disruption"
)

var optionTabs = []string{tabStartOfJourney, tabDepartingStation, tabApproachingStation, tabAtStation, tabDisruption}

// sentenceGap is the website's SENTENCE_GAP: the pause before each sentence
// after the first.
const sentenceGap = 500

const (
	takeYourBelongings = "messages.please ensure that you take all your personal belongings wit"
	delayApology       = "delays.were sorry for the delay and inconvenience this will cause"
)

type instance struct {
	Name                  string `json:"NAME"`
	ID                    string `json:"ID"`
	FilePrefix            string `json:"FILE_PREFIX"`
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

type callingPoint struct {
	CRS string `json:"crsCode"`
}

type startOfJourneyOptions struct {
	ServiceIntro string         `json:"serviceIntro"`
	TerminatesAt string         `json:"terminatesAtCode"`
	CallingAt    []callingPoint `json:"callingAtCodes"`
}

type departingStationOptions struct {
	DoorWarning     string `json:"doorWarning"`
	ServiceIntro    string `json:"serviceIntro"`
	TerminatesAt    string `json:"terminatesAtCode"`
	NextStopWording string `json:"nextStopWording"`
	NextStation     string `json:"nextStationCode"`
	ShortPlatform   string `json:"shortPlatform"`
}

type approachingStationOptions struct {
	Station       string `json:"stationCode"`
	IsFinalStop   bool   `json:"isFinalStop"`
	DoorSide      string `json:"doorSide"`
	ShortPlatform string `json:"shortPlatform"`
	Thanks        string `json:"thanks"`
}

type atStationOptions struct {
	Station      string `json:"stationCode"`
	IsFinalStop  bool   `json:"isFinalStop"`
	ServiceIntro string `json:"serviceIntro"`
	TerminatesAt string `json:"terminatesAtCode"`
	DoorSide     string `json:"doorSide"`
	Thanks       string `json:"thanks"`
}

type disruptionOptions struct {
	Type          string `json:"disruptionType"`
	DelayDuration string `json:"delayDuration"`
	DelayReason   string `json:"delayReason"`
	Station       string `json:"stationCode"`
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	var (
		clips []plan.Clip
		err   error
	)
	switch announcement {
	case tabStartOfJourney:
		var o startOfJourneyOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		clips, err = s.startOfJourney(o)
	case tabDepartingStation:
		var o departingStationOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		clips, err = s.departingStation(o)
	case tabApproachingStation:
		var o approachingStationOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		clips, err = s.approachingStation(o)
	case tabAtStation:
		var o atStationOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		clips, err = s.atStation(o)
	case tabDisruption:
		var o disruptionOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		clips, err = s.disruption(o)
	default:
		return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
	}
	if err != nil {
		return plan.Plan{}, err
	}
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}, nil
}

func (s *System) startOfJourney(o startOfJourneyOptions) ([]plan.Clip, error) {
	if err := s.validateStationExists(o.TerminatesAt); err != nil {
		return nil, err
	}
	clips := plan.IDs(o.ServiceIntro, station(o.TerminatesAt))
	if len(o.CallingAt) == 0 {
		return clips, nil
	}

	stops := make([]plan.Clip, 0, len(o.CallingAt)+1)
	for _, stop := range o.CallingAt {
		if err := s.validateStationExists(stop.CRS); err != nil {
			return nil, err
		}
		stops = append(stops, plan.Clip{ID: station(stop.CRS)})
	}
	stops = append(stops, plan.Clip{ID: station(o.TerminatesAt)})

	clips = append(clips, plan.Clip{ID: "conjoiners.calling at"})
	return append(clips, plan.Pluralise(stops, plan.PluraliseOptions{AndID: "conjoiners.and"})...), nil
}

func (s *System) departingStation(o departingStationOptions) ([]plan.Clip, error) {
	if err := s.validateStationExists(o.TerminatesAt); err != nil {
		return nil, err
	}
	if err := s.validateStationExists(o.NextStation); err != nil {
		return nil, err
	}

	var clips []plan.Clip
	introDelay := 0
	if o.DoorWarning != "" {
		clips = append(clips, plan.Clip{ID: o.DoorWarning})
		introDelay = sentenceGap
	}
	clips = append(clips,
		plan.Clip{ID: o.ServiceIntro, Delay: introDelay},
		plan.Clip{ID: station(o.TerminatesAt)},
		plan.Clip{ID: o.NextStopWording, Delay: sentenceGap},
		plan.Clip{ID: station(o.NextStation)},
	)
	return append(clips, optionalSentence(o.ShortPlatform)...), nil
}

func (s *System) approachingStation(o approachingStationOptions) ([]plan.Clip, error) {
	if err := s.validateStationExists(o.Station); err != nil {
		return nil, err
	}

	clips := plan.IDs("messages.were now approaching", station(o.Station))
	if o.IsFinalStop {
		clips = append(clips, plan.Clip{ID: "delays.where this train terminates"})
	}
	clips = append(clips, optionalSentence(o.DoorSide)...)
	clips = append(clips, optionalSentence(o.ShortPlatform)...)
	if o.IsFinalStop {
		clips = append(clips, plan.Clip{ID: takeYourBelongings, Delay: sentenceGap})
		clips = append(clips, optionalSentence(o.Thanks)...)
	}
	return clips, nil
}

func (s *System) atStation(o atStationOptions) ([]plan.Clip, error) {
	if err := s.validateStationExists(o.Station); err != nil {
		return nil, err
	}

	clips := plan.IDs("conjoiners.this is", station(o.Station))
	if o.IsFinalStop {
		clips = append(clips,
			plan.Clip{ID: "delays.this train terminates here", Delay: sentenceGap},
			plan.Clip{ID: "messages.all change please", Delay: sentenceGap},
			plan.Clip{ID: takeYourBelongings, Delay: sentenceGap},
		)
		clips = append(clips, optionalSentence(o.DoorSide)...)
		return append(clips, optionalSentence(o.Thanks)...), nil
	}

	if err := s.validateStationExists(o.TerminatesAt); err != nil {
		return nil, err
	}
	clips = append(clips,
		plan.Clip{ID: o.ServiceIntro, Delay: sentenceGap},
		plan.Clip{ID: station(o.TerminatesAt)},
	)
	return append(clips, optionalSentence(o.DoorSide)...), nil
}

func (s *System) disruption(o disruptionOptions) ([]plan.Clip, error) {
	reason := plan.Clip{ID: "delays.reasons." + o.DelayReason}
	apology := plan.Clip{ID: delayApology, Delay: sentenceGap}

	switch o.Type {
	case "running late":
		return []plan.Clip{
			{ID: "delays.this train is being delayed due to"},
			reason,
			{ID: "messages.this service is now running", Delay: sentenceGap},
			{ID: delayDuration(o.DelayDuration)},
			{ID: "delays.were sorry for the late running of this service", Delay: sentenceGap},
		}, nil
	case "delayed":
		return []plan.Clip{{ID: "delays.this train is being delayed due to"}, reason, apology}, nil
	case "diverted":
		return []plan.Clip{{ID: "delays.this train is being diverted due to"}, reason, apology}, nil
	case "terminating early":
		return []plan.Clip{
			{ID: "delays.this train is terminating early due to"},
			reason,
			{ID: "delays.this train will terminate at the next station", Delay: sentenceGap},
			apology,
		}, nil
	case "not calling at":
		if err := s.validateStationExists(o.Station); err != nil {
			return nil, err
		}
		return []plan.Clip{
			{ID: "conjoiners.this train does not call at"},
			{ID: station(o.Station)},
			{ID: "conjoiners.this is due to", Delay: sentenceGap},
			reason,
			apology,
		}, nil
	case "engineering work":
		return []plan.Clip{{ID: "delays.due to engineering work this train will terminate at the nex"}, apology}, nil
	}
	// The website's switch has no default, so an unknown type plays an empty announcement.
	return []plan.Clip{}, nil
}

func delayDuration(duration string) string {
	if duration == "over-an-hour" {
		return "delays.more than an hour late"
	}
	return "time." + duration + " minutes late"
}

// optionalSentence is the chosen sentence after a pause, or nothing where the
// option's "None" is chosen.
func optionalSentence(id string) []plan.Clip {
	if id == "" {
		return nil
	}
	return []plan.Clip{{ID: id, Delay: sentenceGap}}
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

func decode(state json.RawMessage, into any) error {
	if err := json.Unmarshal(state, into); err != nil {
		return fmt.Errorf("state: %w", err)
	}
	return nil
}
