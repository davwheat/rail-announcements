// Package lnerazuma ports the website's LNER Azuma (Class 800/801) on-train
// announcements. The website at ../rail-announcements is the reference: change
// its TypeScript first, re-export the parity record, then port the change here.
package lnerazuma

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

// optionTabs are the tabs with a play handler, in the order the website
// declares them.
var optionTabs = []string{"stoppedAtStation", "departingStation", "aproachingStation"}

// instance is the part of the exported class instance the handlers read.
type instance struct {
	Name        string              `json:"NAME"`
	ID          string              `json:"ID"`
	FilePrefix  string              `json:"FILE_PREFIX"`
	StationInfo map[string][]string `json:"STATION_INFO"`
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

type stoppedOptions struct {
	ThisStation  jsValue        `json:"thisStationCode"`
	TerminatesAt jsValue        `json:"terminatesAtCode"`
	CallingAt    []callingPoint `json:"callingAtCodes"`
}

type departingOptions struct {
	TerminatesAt jsValue        `json:"terminatesAtCode"`
	CallingAt    []callingPoint `json:"callingAtCodes"`
}

type approachingOptions struct {
	NextStation jsValue  `json:"nextStationCode"`
	Terminates  jsTruthy `json:"terminates"`
}

type callingPoint struct {
	CRS jsValue `json:"crsCode"`
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	switch announcement {
	case "stoppedAtStation":
		var o stoppedOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return s.stoppedAtStation(o), nil

	case "departingStation":
		var o departingOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return announce(s.welcome(o.TerminatesAt, o.CallingAt, 0)), nil

	case "aproachingStation":
		var o approachingOptions
		if err := decode(state, &o); err != nil {
			return plan.Plan{}, err
		}
		return s.approachingStation(o), nil
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func (s *System) stoppedAtStation(o stoppedOptions) plan.Plan {
	if o.ThisStation.equals(o.TerminatesAt) {
		return announce([]plan.Clip{
			{ID: "welcome to"},
			{ID: station(o.TerminatesAt)},
			{ID: "where we finish our journey today"},
			{ID: "on behalf of the onboard team thank you for travelling with lner", Delay: 2000},
			{ID: "male.if you enjoyed your journey please let us know", Delay: 2000},
		})
	}
	clips := []plan.Clip{
		{ID: "we are now at"},
		{ID: station(o.ThisStation), Delay: 150},
	}
	return announce(append(clips, s.welcome(o.TerminatesAt, o.CallingAt, 5000)...))
}

func (s *System) welcome(terminatesAt jsValue, callingAt []callingPoint, delay int) []plan.Clip {
	clips := []plan.Clip{
		{ID: "hello and welcome on board this lner azuma to", Delay: delay},
		{ID: station(terminatesAt), Delay: 150},
		{ID: "we will call at", Delay: 6000},
	}

	if len(callingAt) == 0 {
		clips = append(clips, plan.Clip{ID: station(terminatesAt)}, plan.Clip{ID: "only"})
	} else {
		items := make([]plan.Clip, 0, len(callingAt)+1)
		for _, point := range callingAt {
			items = append(items, plan.Clip{ID: station(point.CRS)})
		}
		items = append(items, plan.Clip{ID: station(terminatesAt)})
		clips = append(clips, plan.Pluralise(items, plan.PluraliseOptions{
			BeforeItemDelay: plan.Ptr(100),
			BeforeAndDelay:  plan.Ptr(150),
			AfterAndDelay:   plan.Ptr(150),
		})...)
	}

	next := terminatesAt
	if len(callingAt) > 0 && !callingAt[0].CRS.nullish() {
		next = callingAt[0].CRS
	}

	return append(clips,
		plan.Clip{ID: "the next station will be", Delay: 5000},
		plan.Clip{ID: station(next), Delay: 150},
		plan.Clip{ID: "male.cctv is in operation", Delay: 3000},
		plan.Clip{ID: "male.btp 61016", Delay: 5000},
	)
}

func (s *System) approachingStation(o approachingOptions) plan.Plan {
	clips := []plan.Clip{
		{ID: "we will shortly be arriving at"},
		{ID: station(o.NextStation)},
	}
	if o.Terminates {
		clips = append(clips, plan.Clip{ID: "where we finish our journey today"})
	}
	// An interchange the station list names, however few onward services it
	// holds: the handler tests the array's presence, not its length.
	if info, ok := s.data.StationInfo[o.NextStation.String()]; ok {
		clips = append(clips, plan.Clip{ID: "change here", Delay: 5000}, plan.Clip{ID: "for trains to"})
		for _, id := range info {
			clips = append(clips, plan.Clip{ID: id})
		}
	}
	return announce(append(clips,
		plan.Clip{ID: "if youre leaving us here please make sure to take all your personal belongings with you", Delay: 5000},
		plan.Clip{ID: "thank you for travelling with lner", Delay: 10000},
	))
}

// announce wraps clips as the handlers play them: `playAudioFiles(files,
// download)` leaves the missing-audio mode and the start delay at their
// defaults.
func announce(clips []plan.Clip) plan.Plan {
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}
}

func station(code jsValue) string { return "station." + code.String() }

func decode(state json.RawMessage, into any) error {
	if err := json.Unmarshal(state, into); err != nil {
		return fmt.Errorf("state: %w", err)
	}
	return nil
}

// jsValue is a station code as the handlers read it. They tell a string apart
// from a missing field, null or a number: `===` and `??` match none of those,
// and a template literal spells them out rather than dropping them. The zero
// value is a field the state leaves out.
type jsValue struct {
	text     string
	isString bool
}

func (v *jsValue) UnmarshalJSON(raw []byte) error {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	if text, ok := value.(string); ok {
		v.text, v.isString = text, true
		return nil
	}
	if value == nil {
		v.text = "null"
		return nil
	}
	v.text = string(raw)
	return nil
}

// String spells the value as a template literal spells it.
func (v jsValue) String() string {
	if !v.isString && v.text == "" {
		return "undefined"
	}
	return v.text
}

func (v jsValue) equals(other jsValue) bool {
	return v.isString == other.isString && v.text == other.text
}

// nullish reports whether `??` would reach for the fallback.
func (v jsValue) nullish() bool {
	return !v.isString && (v.text == "" || v.text == "null")
}

// jsTruthy is a state field the handler only tests for truth, so it follows
// JavaScript's rules rather than requiring a boolean.
type jsTruthy bool

func (t *jsTruthy) UnmarshalJSON(raw []byte) error {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	switch value := value.(type) {
	case nil:
		*t = false
	case bool:
		*t = jsTruthy(value)
	case float64:
		*t = value != 0
	case string:
		*t = value != ""
	default:
		*t = true
	}
	return nil
}
