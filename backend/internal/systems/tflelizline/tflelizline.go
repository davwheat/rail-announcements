// Package tflelizline ports the website's TfL Elizabeth Line on-train
// announcements (src/announcement-data/systems/rolling-stock/TfLElizabeth.tsx).
// The website is the reference: change it first, re-export, then port the
// change here.
package tflelizline

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strconv"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/instance.json
var instanceData []byte

//go:embed data/module.json
var moduleData []byte

//go:embed data/buttons.json
var buttonData []byte

const (
	atStationTab    = "thisStation"
	approachingTab  = "approachingStation"
	nextStationClip = "conjoiners.next station"
	terminatesClip  = "conjoiners.where this train terminates"
)

type info struct {
	ID         string `json:"ID"`
	Name       string `json:"NAME"`
	FilePrefix string `json:"FILE_PREFIX"`
}

type System struct {
	info     info
	buttons  shared.Buttons
	stations map[string]station
}

func New() (*System, error) {
	var parsed info
	if err := json.Unmarshal(instanceData, &parsed); err != nil {
		return nil, fmt.Errorf("instance: %w", err)
	}
	var tables moduleTables
	if err := json.Unmarshal(moduleData, &tables); err != nil {
		return nil, fmt.Errorf("module: %w", err)
	}
	buttons, err := shared.ParseButtons(buttonData)
	if err != nil {
		return nil, err
	}
	return &System{info: parsed, buttons: buttons, stations: newStations(tables)}, nil
}

func (s *System) ID() string         { return s.info.ID }
func (s *System) Name() string       { return s.info.Name }
func (s *System) FilePrefix() string { return s.info.FilePrefix }

func (s *System) Announcements() []string {
	return append([]string{atStationTab, approachingTab}, s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	var options options
	if len(state) > 0 {
		if err := json.Unmarshal(state, &options); err != nil {
			return plan.Plan{}, fmt.Errorf("state: %w", err)
		}
	}
	switch announcement {
	case atStationTab:
		return s.atStation(options)
	case approachingTab:
		return s.approachingStation(options)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func (s *System) atStation(options options) (plan.Plan, error) {
	this, haveThis := s.station(options["thisStationCrs"])
	destination, haveDestination := s.station(options["destinationCrs"])
	via, haveVia := s.station(options["viaCrs"])
	next, haveNext := s.station(options["nextStationCrs"])

	if !haveThis || !haveDestination || !haveNext {
		return plan.Plan{}, fmt.Errorf("Invalid stations.\n\n%s %s %s",
			crsOrUndefined(this, haveThis), crsOrUndefined(destination, haveDestination), crsOrUndefined(next, haveNext))
	}

	clips := []plan.Clip{{ID: this.end}}

	if this.CRS == destination.CRS {
		clips = append(clips, plan.Clip{ID: "conjoiners.this train terminates here all change please", Delay: 1000})
		return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}, nil
	}

	clips = append(clips, plan.Clip{ID: "conjoiners.this is the train to", Delay: 1000})
	if haveVia {
		clips = append(clips,
			plan.Clip{ID: destination.mid},
			plan.Clip{ID: "conjoiners.via"},
			plan.Clip{ID: via.end},
		)
	} else {
		clips = append(clips, plan.Clip{ID: destination.end})
	}

	clips = append(clips, plan.Clip{ID: nextStationClip, Delay: 1000})
	if next.CRS == destination.CRS {
		clips = append(clips, plan.Clip{ID: next.mid}, plan.Clip{ID: terminatesClip})
	} else {
		clips = append(clips, plan.Clip{ID: next.end})
	}

	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}, nil
}

func (s *System) approachingStation(options options) (plan.Plan, error) {
	next, ok := s.station(options["nextStationCrs"])
	if !ok {
		value, present := options["nextStationCrs"]
		return plan.Plan{}, fmt.Errorf("Invalid station.\n\n%s", jsText(value, present))
	}

	clips := []plan.Clip{{ID: nextStationClip, Delay: 1000}}
	if truthy(options["terminating"]) {
		clips = append(clips, plan.Clip{ID: next.mid}, plan.Clip{ID: terminatesClip})
	} else {
		clips = append(clips, plan.Clip{ID: next.end})
	}

	if len(next.ChangeFor) > 0 {
		clips = append(clips, plan.Clip{ID: "conjoiners.change for", Delay: 1000})
		clips = append(clips, plan.Pluralise(plan.IDs(next.ChangeFor...), plan.PluraliseOptions{
			AndID:       "conjoiners.and",
			Prefix:      plan.Ptr("change for.m."),
			FinalPrefix: plan.Ptr("change for.e."),
		})...)
	}

	if len(next.ExitFor) > 0 {
		clips = append(clips, plan.Clip{ID: "conjoiners.exit for", Delay: 1000})
		clips = append(clips, plan.Pluralise(plan.IDs(next.ExitFor...), plan.PluraliseOptions{
			AndID:       "conjoiners.and",
			Prefix:      plan.Ptr("exit for.m."),
			FinalPrefix: plan.Ptr("exit for.e."),
		})...)
	}

	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}, nil
}

// options is a tab's option state as the website holds it. The values stay
// untyped because the website reads them with JavaScript's own rules: a
// missing option and a null one differ in a refusal's wording, and a code that
// is not a string matches no station at all.
type options map[string]any

// station finds the option's station, as the website's strict === comparison
// against every AllStations entry does.
func (s *System) station(value any) (station, bool) {
	crs, ok := value.(string)
	if !ok {
		return station{}, false
	}
	found, ok := s.stations[crs]
	return found, ok
}

// crsOrUndefined stands in for `station?.crs` inside a template literal.
func crsOrUndefined(st station, ok bool) string {
	if !ok {
		return "undefined"
	}
	return st.CRS
}

// jsText renders a value as a template literal does, so a refusal reads
// exactly as the website's alert.
func jsText(value any, present bool) string {
	switch v := value.(type) {
	case nil:
		if !present {
			return "undefined"
		}
		return "null"
	case string:
		return v
	case bool:
		return strconv.FormatBool(v)
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	default:
		return fmt.Sprint(v)
	}
}

// truthy applies JavaScript's own test, which an option holding something
// other than a boolean depends on.
func truthy(value any) bool {
	switch v := value.(type) {
	case nil:
		return false
	case bool:
		return v
	case string:
		return v != ""
	case float64:
		return v != 0
	default:
		return true
	}
}
