// Package wmtclass323 ports the website's West Midlands Trains Class 323
// on-train announcements. The website is the reference: change its TypeScript
// first, re-export the parity record, then port the change here.
package wmtclass323

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"rail-announcements-backend/internal/plan"
)

//go:embed data/instance.json
var instanceData []byte

var tabs = []string{"approachingStation", "nextStation", "welcomeAboard", "thisIs"}

type instance struct {
	Name       string `json:"NAME"`
	ID         string `json:"ID"`
	FilePrefix string `json:"FILE_PREFIX"`
}

type System struct {
	data instance
}

func New() (*System, error) {
	var data instance
	if err := json.Unmarshal(instanceData, &data); err != nil {
		return nil, fmt.Errorf("instance data: %w", err)
	}
	return &System{data: data}, nil
}

func (s *System) ID() string              { return s.data.ID }
func (s *System) Name() string            { return s.data.Name }
func (s *System) FilePrefix() string      { return s.data.FilePrefix }
func (s *System) Announcements() []string { return append([]string{}, tabs...) }

type stationOptions struct {
	StationCode    string `json:"stationCode"`
	TerminatesHere bool   `json:"terminatesHere"`
}

type welcomeOptions struct {
	TerminatesAt    string `json:"terminatesAtCode"`
	ReadAllStations bool   `json:"readAllStations"`
	CallingAt       []struct {
		CRS string `json:"crsCode"`
	} `json:"callingAtCodes"`
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	switch announcement {
	case "approachingStation", "nextStation", "thisIs":
		var o stationOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return announce(stationAnnouncement(announcement, o)), nil

	case "welcomeAboard":
		var o welcomeOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return announce(welcomeAboard(o)), nil
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func stationAnnouncement(announcement string, o stationOptions) []plan.Clip {
	station := plan.Clip{ID: station(o.StationCode), Delay: 200}
	switch announcement {
	case "approachingStation":
		clips := []plan.Clip{{ID: "we are now approaching"}, station}
		if o.TerminatesHere {
			clips = append(clips, plan.Clip{ID: "our final destination where this train terminates"})
		}
		return append(clips, plan.Clip{ID: "please mind the gap", Delay: 500})
	case "nextStation":
		return []plan.Clip{{ID: "the next station is"}, station}
	default:
		return []plan.Clip{{ID: "this is"}, station, {ID: "please mind the gap"}}
	}
}

func welcomeAboard(o welcomeOptions) []plan.Clip {
	clips := []plan.Clip{
		{ID: "welcome aboard this service to"},
		{ID: station(o.TerminatesAt), Delay: 200},
	}
	if o.ReadAllStations {
		items := make([]plan.Clip, 0, len(o.CallingAt)+1)
		for _, stop := range o.CallingAt {
			items = append(items, plan.Clip{ID: station(stop.CRS)})
		}
		items = append(items, plan.Clip{ID: station(o.TerminatesAt)})
		clips = append(clips, plan.Clip{ID: "we will be calling at", Delay: 200})
		return append(clips, plan.Pluralise(items, plan.PluraliseOptions{BeforeAndDelay: plan.Ptr(75)})...)
	}
	next := o.TerminatesAt
	if len(o.CallingAt) > 0 {
		next = o.CallingAt[0].CRS
	}
	return append(clips, plan.Clip{ID: "the next station is", Delay: 200}, plan.Clip{ID: station(next), Delay: 200})
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
