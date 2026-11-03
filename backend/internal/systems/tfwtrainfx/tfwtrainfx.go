// Package tfwtrainfx ports the website's Transport for Wales TrainFX system
// (TFW_TRAINFX_V1). The website is the reference: change
// src/announcement-data/systems/rolling-stock/TfWTrainFx.tsx there, re-export,
// then port the change here.
package tfwtrainfx

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

//go:embed data/buttons.json
var buttonData []byte

// announcements are the option tabs, in the order the website declares them.
var announcements = []string{"startOfJourney", "stoppedAtStation", "departingStop", "approachingStation"}

type instance struct {
	ID         string `json:"ID"`
	Name       string `json:"NAME"`
	FilePrefix string `json:"FILE_PREFIX"`
	// StationNames is the pitch each station is recorded in: "high" or "low".
	StationNames map[string][]string `json:"AvailableStationNames"`
	// Destinations keeps the website's spelling of the field.
	Destinations []destination `json:"AvailableDestinatons"`
}

// destination is one entry of the "terminates at" list. A destination with
// custom files is a dividing service, chosen by label rather than by CRS.
type destination struct {
	Label       string      `json:"label"`
	CustomFiles []audioItem `json:"customFiles"`
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

type System struct {
	data    instance
	buttons shared.Buttons
}

func New() (*System, error) {
	var data instance
	if err := json.Unmarshal(instanceData, &data); err != nil {
		return nil, fmt.Errorf("instance: %w", err)
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
	return append(slices.Clone(announcements), s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, raw json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, raw)
	}
	var st state
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &st); err != nil {
			return plan.Plan{}, fmt.Errorf("state: %w", err)
		}
	}
	var clips []plan.Clip
	var err error
	switch announcement {
	case "startOfJourney":
		clips, err = s.startOfJourney(st)
	case "stoppedAtStation":
		clips, err = s.stoppedAtStation(st)
	case "departingStop":
		clips, err = s.departingStop(st)
	case "approachingStation":
		clips, err = s.approachingStation(st)
	default:
		return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
	}
	if err != nil {
		return plan.Plan{}, err
	}
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}, nil
}

func (s *System) startOfJourney(st state) ([]plan.Clip, error) {
	var callingAt []struct {
		CRSCode json.RawMessage `json:"crsCode"`
	}
	if raw := st["callingAtCodes"]; len(raw) > 0 {
		if err := json.Unmarshal(raw, &callingAt); err != nil {
			return nil, fmt.Errorf("callingAtCodes: %w", err)
		}
	}
	stations := make([]plan.Clip, len(callingAt))
	for i, station := range callingAt {
		stations[i] = plan.Clip{ID: text(station.CRSCode)}
	}

	clips := plan.IDs("conjoiners.welcome aboard")
	clips = append(clips, plan.Clip{ID: "conjoiners.we will be calling at the following principal stations", Delay: 750})
	clips = append(clips, plan.Pluralise(stations, plan.PluraliseOptions{
		AndID:       "conjoiners.and",
		Prefix:      plan.Ptr("stations.high."),
		FinalPrefix: plan.Ptr("stations.low."),
	})...)
	return append(clips, plan.Clip{ID: "conjoiners.thank you", Delay: 750}), nil
}

func (s *System) stoppedAtStation(st state) ([]plan.Clip, error) {
	thisStation, terminatesAt := text(st["thisStationCode"]), text(st["terminatesAtCode"])
	if err := s.validateStationExists(thisStation, "high"); err != nil {
		return nil, err
	}

	clips := plan.IDs("conjoiners.we are now at", "stations.high."+thisStation)
	if thisStation == terminatesAt {
		return append(clips, plan.Clip{ID: "conjoiners.our final station"}), nil
	}
	return append(clips, s.terminationInfo(terminatesAt, "high", 0)...), nil
}

func (s *System) departingStop(st state) ([]plan.Clip, error) {
	nextStation := text(st["nextStationCode"])
	if err := s.validateStationExists(nextStation, "high"); err != nil {
		return nil, err
	}

	clips := []plan.Clip{
		{ID: "conjoiners.the next stop is", Delay: 750},
		{ID: "stations.high." + nextStation},
	}
	if truthy(st["terminatesHere"]) {
		clips = append(clips, plan.Clip{ID: "conjoiners.our final station"})
	}
	return append(clips, plan.Clip{ID: "conjoiners.thank you", Delay: 750}), nil
}

func (s *System) approachingStation(st state) ([]plan.Clip, error) {
	nextStation := text(st["nextStationCode"])
	if err := s.validateStationExists(nextStation, "high"); err != nil {
		return nil, err
	}

	clips := plan.IDs(
		"conjoiners.we will shortly be arriving at slower",
		"stations.high."+nextStation,
		"conjoiners.thank you",
	)
	switch text(st["gapType"]) {
	case "gap":
		clips = append(clips, plan.Clip{ID: "safety.gap between the train and the platform"})
	case "step":
		clips = append(clips, plan.Clip{ID: "safety.large step between train and platform"})
	case "step down":
		clips = append(clips, plan.Clip{ID: "safety.large step down from the train"})
	}
	return clips, nil
}

// customDestinationPrefix marks a destination chosen by label, for a service
// that divides, rather than by the CRS of a single station.
const customDestinationPrefix = "^^"

// terminationInfo names where the train terminates, and says nothing at all
// about a station it has no recording of: the website alerts, returns no clips,
// and its handler plays the rest of the announcement anyway.
func (s *System) terminationInfo(stationCode, pitch string, delay int) []plan.Clip {
	if label, custom := strings.CutPrefix(stationCode, customDestinationPrefix); custom {
		for _, destination := range s.data.Destinations {
			if destination.Label == label {
				clips := make([]plan.Clip, len(destination.CustomFiles))
				for i, file := range destination.CustomFiles {
					clips[i] = plan.Clip(file)
				}
				return clips
			}
		}
		// An unknown label says nothing at all, as on the website.
		return nil
	}
	if !s.recorded(stationCode, pitch) {
		return nil
	}
	return []plan.Clip{
		{ID: "conjoiners.this train is for", Delay: delay},
		{ID: "stations." + pitch + "." + stationCode},
	}
}

// validateStationExists refuses a station with no recording in the pitch the
// announcement needs, in the words the website alerts. The website shows that
// alert in the browser and asks this service only for the audio, so the error
// stands for the handlers that go on to play nothing at all.
func (s *System) validateStationExists(stationCRS, pitch string) error {
	if s.recorded(stationCRS, pitch) {
		return nil
	}
	name, ok := shared.StationName(stationCRS)
	if !ok {
		// The website splices in getStationByCrs(crs)?.stationName, so a code
		// that is no station at all reads as JavaScript's own undefined.
		name = "undefined"
	}
	return fmt.Errorf("Unfortunately, we don't have the recording for %s in the needed type (type: %s). "+
		"If you can record this, please do so, then create an issue or PR on GitHub!", name, pitch)
}

func (s *System) recorded(stationCRS, pitch string) bool {
	return slices.Contains(s.data.StationNames[pitch], stationCRS)
}
