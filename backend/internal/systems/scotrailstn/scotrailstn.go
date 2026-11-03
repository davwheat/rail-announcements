// Package scotrailstn ports the website's ScotRail station system
// (SCOTRAIL_STN_V1, src/announcement-data/systems/stations/ScotRail.tsx). The
// website is the reference: change the TypeScript first, re-export the parity
// record, then port. Only the tabs the website has live are ported; the rest of
// its file is commented out.
package scotrailstn

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/instance.json
var instanceData []byte

//go:embed data/module.json
var moduleData []byte

//go:embed data/buttons.json
var buttonData []byte

const nextTrainTab = "nextTrain"

type instance struct {
	ID         string `json:"ID"`
	Name       string `json:"NAME"`
	FilePrefix string `json:"FILE_PREFIX"`
}

// moduleTables are the module-level constants of the TypeScript. Operators in
// IntegratedTOCs name their own "<operator> service to" recording, rather than
// an operator clip followed by a shared one.
type moduleTables struct {
	IntegratedTOCs []string `json:"INTEGRATED_TOCS"`
}

type System struct {
	instance       instance
	buttons        shared.Buttons
	integratedTOCs map[string]bool
}

func New() (*System, error) {
	var inst instance
	if err := json.Unmarshal(instanceData, &inst); err != nil {
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
	return &System{
		instance:       inst,
		buttons:        buttons,
		integratedTOCs: integratedTOCSet(tables.IntegratedTOCs),
	}, nil
}

func (s *System) ID() string         { return s.instance.ID }
func (s *System) Name() string       { return s.instance.Name }
func (s *System) FilePrefix() string { return s.instance.FilePrefix }

func (s *System) Announcements() []string {
	return append([]string{nextTrainTab}, s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	if announcement == nextTrainTab {
		return s.nextTrain(state)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

// nextTrain is playNextTrainAnnouncement.
func (s *System) nextTrain(state json.RawMessage) (plan.Plan, error) {
	o, err := decodeNextTrain(state)
	if err != nil {
		return plan.Plan{}, err
	}

	clips := plan.IDs(fmt.Sprintf("platform info.the next train at platform %s is the", o.Platform.text))
	clips = append(clips, s.trainInfo(o)...)
	clips = append(clips, plan.Clip{ID: "conjoiner.calling at"})

	if len(o.CallingAt) == 0 {
		clips = append(clips, plan.IDs("stations.high._"+o.TerminatingStationCode.text, "conjoiner.only")...)
	} else {
		stops := make([]plan.Clip, 0, len(o.CallingAt)+1)
		for _, stop := range o.CallingAt {
			stops = append(stops, plan.Clip{ID: "stations.high._" + stop.CRSCode.text})
		}
		stops = append(stops, plan.Clip{ID: "stations.low._" + o.TerminatingStationCode.text})
		clips = append(clips, plan.Pluralise(stops, plan.PluraliseOptions{AndID: "conjoiner.and"})...)
	}

	coaches := "coaches"
	if o.Coaches.isLiteral("1") {
		coaches = "coach only"
	}
	clips = append(clips, plan.Clip{ID: fmt.Sprintf("formation.this train is formed of %s %s", o.Coaches.text, coaches)})

	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}, nil
}

// trainInfo is assembleTrainInfo: "HH:mm <operator> service to <destination>
// (via <station>)". The live tab never asks for an all-high destination, so
// only the low-destination form is ported.
func (s *System) trainInfo(o nextTrainState) []plan.Clip {
	clips := plan.IDs("time.hour."+o.Hour.text, "time.min."+o.Min.text)
	clips = append(clips, s.tocService(o.TOC.text)...)

	if !o.Via.isLiteral("none") {
		return append(clips, plan.IDs(
			"stations.high._"+o.TerminatingStationCode.text,
			"conjoiner.via",
			"stations.low._"+o.Via.text,
		)...)
	}
	return append(clips, plan.Clip{ID: "stations.low._" + o.TerminatingStationCode.text})
}

// integratedTOCSet keys the export's names the way the website's membership
// test reads them: it lowercases the list on every call, but not the operator
// it looks up.
func integratedTOCSet(names []string) map[string]bool {
	set := make(map[string]bool, len(names))
	for _, name := range names {
		set[strings.ToLower(name)] = true
	}
	return set
}

// tocService is getTocService. The website tests membership against the state's
// own text and lowercases only the clip ID, so a mixed-case operator falls to
// the two-clip form even when it is in the integrated list.
func (s *System) tocService(toc string) []plan.Clip {
	if s.integratedTOCs[toc] {
		return plan.IDs("tocs." + strings.ToLower(toc) + " service to")
	}
	return plan.IDs("tocs.high."+strings.ToLower(toc), "tocs.service to")
}

type nextTrainState struct {
	Platform               jsText `json:"platform"`
	Hour                   jsText `json:"hour"`
	Min                    jsText `json:"min"`
	TOC                    jsText `json:"toc"`
	TerminatingStationCode jsText `json:"terminatingStationCode"`
	Via                    jsText `json:"via"`
	CallingAt              []struct {
		CRSCode jsText `json:"crsCode"`
	} `json:"callingAt"`
	Coaches jsText `json:"coaches"`
}

func decodeNextTrain(raw json.RawMessage) (nextTrainState, error) {
	undefined := jsText{text: "undefined"}
	o := nextTrainState{
		Platform:               undefined,
		Hour:                   undefined,
		Min:                    undefined,
		TOC:                    undefined,
		TerminatingStationCode: undefined,
		Via:                    undefined,
		Coaches:                undefined,
	}
	if len(raw) == 0 {
		return o, nil
	}
	if err := json.Unmarshal(raw, &o); err != nil {
		return o, fmt.Errorf("state: %w", err)
	}
	return o, nil
}

// jsText is one state field as JavaScript holds it: the text a template literal
// would build from it, plus whether the value really was a string. The
// announcement compares two fields with `===`, which a number never satisfies,
// and a field the website left out reaches the clip ID as "undefined".
type jsText struct {
	text     string
	isString bool
}

func (v jsText) isLiteral(s string) bool { return v.isString && v.text == s }

func (v *jsText) UnmarshalJSON(raw []byte) error {
	text := string(raw)
	switch {
	case text == "null":
		*v = jsText{text: "null"}
		return nil
	case strings.HasPrefix(text, `"`):
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return err
		}
		*v = jsText{text: s, isString: true}
		return nil
	}
	if n, err := strconv.ParseFloat(text, 64); err == nil {
		*v = jsText{text: strconv.FormatFloat(n, 'f', -1, 64)}
		return nil
	}
	// Anything else is a shape the tab's options cannot produce; its own text
	// is as close as this gets to what JavaScript would have stringified.
	*v = jsText{text: text}
	return nil
}
