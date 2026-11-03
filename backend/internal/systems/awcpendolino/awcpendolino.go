// Package awcpendolino ports the website's Avanti West Coast Pendolino (Class
// 390) on-train announcements. The website is the reference: change its
// TypeScript first, re-export the parity record, then port the change here.
package awcpendolino

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

var optionTabs = []string{"approachingStation", "welcomeAboard"}

type instance struct {
	Name       string `json:"NAME"`
	ID         string `json:"ID"`
	FilePrefix string `json:"FILE_PREFIX"`
}

type System struct {
	data    instance
	buttons shared.Buttons
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
	return &System{data: data, buttons: buttons}, nil
}

func (s *System) ID() string         { return s.data.ID }
func (s *System) Name() string       { return s.data.Name }
func (s *System) FilePrefix() string { return s.data.FilePrefix }

func (s *System) Announcements() []string {
	return append(append([]string{}, optionTabs...), s.buttons.Tabs()...)
}

type approachingOptions struct {
	StationCode   string `json:"stationCode"`
	ShortPlatform bool   `json:"shortPlatform"`
	FinalStop     bool   `json:"finalStop"`
	Play61016     bool   `json:"play61016"`
}

type welcomeOptions struct {
	TerminatesAt string `json:"terminatesAtCode"`
	CallingAt    []struct {
		CRS string `json:"crsCode"`
	} `json:"callingLocations"`
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
		return announce(approachingStation(o)), nil

	case "welcomeAboard":
		var o welcomeOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return announce(welcomeAboard(o)), nil
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func approachingStation(o approachingOptions) []plan.Clip {
	var clips []plan.Clip
	if !o.FinalStop {
		clips = append(clips, plan.Clip{ID: "chime"})
	}
	clips = append(clips, plan.Clip{ID: "were now approaching"}, plan.Clip{ID: "stations." + o.StationCode})
	if o.FinalStop {
		clips = append(clips, plan.Clip{ID: "which is our final stop"})
	}
	if o.Play61016 {
		clips = append(clips, plan.Clip{ID: "61016", Delay: 750})
	}
	clips = append(clips, plan.Clip{ID: "when leaving us here", Delay: 100})
	if o.ShortPlatform {
		clips = append(clips, plan.Clip{ID: "please move forward to leave the train"})
	}
	return clips
}

func welcomeAboard(o welcomeOptions) []plan.Clip {
	clips := []plan.Clip{
		{ID: "chime"},
		{ID: "welcome on board this avanti west coast service to"},
		{ID: "stations." + o.TerminatesAt},
	}
	if len(o.CallingAt) > 0 {
		clips = append(clips, plan.Clip{ID: "calling at", Delay: 2000})
		for _, point := range o.CallingAt {
			clips = append(clips, plan.Clip{ID: "stations." + point.CRS, Delay: 180})
		}
	}
	return append(clips, plan.Clip{ID: "61016", Delay: 2500})
}

func announce(clips []plan.Clip) plan.Plan {
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}
}

func decode(state json.RawMessage, into any) error {
	if err := json.Unmarshal(state, into); err != nil {
		return fmt.Errorf("state: %w", err)
	}
	return nil
}
