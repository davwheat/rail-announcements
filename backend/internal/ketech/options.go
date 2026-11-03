package ketech

import (
	"encoding/json"

	"rail-announcements-backend/internal/plan"
)

// CallingPoint is one stop as the website's calling point editor holds it.
type CallingPoint struct {
	CRSCode       string  `json:"crsCode"`
	Name          string  `json:"name"`
	RandomID      string  `json:"randomId"`
	ShortPlatform string  `json:"shortPlatform,omitempty"`
	RequestStop   bool    `json:"requestStop,omitempty"`
	SplitType     string  `json:"splitType,omitempty"`
	SplitForm     *string `json:"splitForm,omitempty"`
	// SplitCallingPoints are the stops of the portion that divides off here.
	SplitCallingPoints []CallingPoint `json:"splitCallingPoints,omitempty"`
	// FurtherSplits are more portions that divide off, beyond the one that
	// SplitForm and SplitCallingPoints describe. Only the live feed sets it:
	// the website's editor offers one portion for each stop.
	FurtherSplits             []FurtherSplit `json:"furtherSplits,omitempty"`
	ContinuesAsRrbAfterHere   bool           `json:"continuesAsRrbAfterHere,omitempty"`
	ContinuesAsTrainAfterHere bool           `json:"continuesAsTrainAfterHere,omitempty"`
}

// FurtherSplit is one more portion that divides off a train.
type FurtherSplit struct {
	SplitForm          string         `json:"splitForm"`
	SplitCallingPoints []CallingPoint `json:"splitCallingPoints"`
}

func (p CallingPoint) splits() bool { return p.SplitType != "" && p.SplitType != "none" }

// TrainOptions is the state of the next train and standing train tabs.
type TrainOptions struct {
	Chime                            Chime                 `json:"chime"`
	Platform                         string                `json:"platform"`
	Hour                             string                `json:"hour"`
	Min                              string                `json:"min"`
	IsDelayed                        bool                  `json:"isDelayed"`
	Toc                              string                `json:"toc"`
	TerminatingStationCode           string                `json:"terminatingStationCode"`
	Vias                             []CallingPoint        `json:"vias"`
	CallingAt                        []CallingPoint        `json:"callingAt"`
	FirstClassLocation               string                `json:"firstClassLocation"`
	Coaches                          string                `json:"coaches"`
	ServiceLoading                   string                `json:"serviceLoading"`
	AnnounceShortPlatformsAfterSplit bool                  `json:"announceShortPlatformsAfterSplit"`
	NotCallingAtStations             []CallingPoint        `json:"notCallingAtStations"`
	FromLive                         bool                  `json:"fromLive"`
	MissingAudioMode                 plan.MissingAudioMode `json:"missingAudioMode"`

	ThisStationCode string `json:"thisStationCode"`
	MindTheGap      bool   `json:"mindTheGap"`
}

// Destinations is where a train is announced to, with each destination's via
// points. A form posts one destination, and the live feed gives one for each
// portion of a dividing train. The two are also worded differently, so Live
// records which one this is.
type Destinations struct {
	Live     bool
	Stations []string
	Vias     [][]string
}

// RouteOptions is the state shared by the announcements that name a train
// without listing its calls.
type RouteOptions struct {
	Chime            Chime                 `json:"chime"`
	Hour             string                `json:"hour"`
	Min              string                `json:"min"`
	IsDelayed        bool                  `json:"isDelayed"`
	Toc              string                `json:"toc"`
	MissingAudioMode plan.MissingAudioMode `json:"missingAudioMode"`
	Destinations     Destinations          `json:"-"`
}

type ApproachingOptions struct {
	RouteOptions
	Platform string   `json:"platform"`
	Origins  []string `json:"-"`
}

type DisruptedOptions struct {
	RouteOptions
	DisruptionType string           `json:"disruptionType"`
	DelayTime      string           `json:"delayTime"`
	Reason         DisruptionReason `json:"-"`
}

// DisruptionReason is a reason by name, which the voice turns into a clip, or
// finished clips that are played as they are.
type DisruptionReason struct {
	Name  string
	Clips []string
	List  bool
}

func (r DisruptionReason) given() bool { return r.List || r.Name != "" }

type AlterationOptions struct {
	RouteOptions
	AnnounceOldPlatform bool           `json:"announceOldPlatform"`
	OldPlatform         string         `json:"oldPlatform"`
	NewPlatform         string         `json:"newPlatform"`
	CallingAt           []CallingPoint `json:"callingAt"`
}

type FastTrainOptions struct {
	Chime                Chime                 `json:"chime"`
	DaktronicsFanfare    bool                  `json:"daktronicsFanfare"`
	Platform             string                `json:"platform"`
	FastTrainApproaching bool                  `json:"fastTrainApproaching"`
	MissingAudioMode     plan.MissingAudioMode `json:"missingAudioMode"`
}

// routeState is the part of a posted state whose shape depends on whether the
// live feed or a form produced it.
type routeState struct {
	FromLive               *bool           `json:"fromLive"`
	TerminatingStationCode json.RawMessage `json:"terminatingStationCode"`
	Vias                   json.RawMessage `json:"vias"`
	OriginStationCode      json.RawMessage `json:"originStationCode"`
	DisruptionReason       json.RawMessage `json:"disruptionReason"`
}

func crsCodes(points []CallingPoint) []string {
	out := make([]string, len(points))
	for i, point := range points {
		out[i] = point.CRSCode
	}
	return out
}

func oneOrMany(raw json.RawMessage) ([]string, bool, error) {
	if len(raw) == 0 {
		return nil, false, nil
	}
	var one string
	if json.Unmarshal(raw, &one) == nil {
		return []string{one}, false, nil
	}
	var many []string
	err := json.Unmarshal(raw, &many)
	return many, true, err
}

func (s routeState) destinations() (Destinations, error) {
	// The website tests for the key, so any value of fromLive means live.
	out := Destinations{Live: s.FromLive != nil}
	var err error
	if out.Stations, _, err = oneOrMany(s.TerminatingStationCode); err != nil {
		return out, err
	}
	if len(s.Vias) == 0 {
		return out, nil
	}
	if out.Live {
		var vias [][]CallingPoint
		if err := json.Unmarshal(s.Vias, &vias); err != nil {
			return out, err
		}
		for _, points := range vias {
			out.Vias = append(out.Vias, crsCodes(points))
		}
		return out, nil
	}
	var vias []CallingPoint
	if err := json.Unmarshal(s.Vias, &vias); err != nil {
		return out, err
	}
	out.Vias = [][]string{crsCodes(vias)}
	return out, nil
}

func (s routeState) reason() (DisruptionReason, error) {
	clips, list, err := oneOrMany(s.DisruptionReason)
	if err != nil || list {
		return DisruptionReason{Clips: clips, List: list}, err
	}
	if len(clips) == 1 {
		return DisruptionReason{Name: clips[0]}, nil
	}
	return DisruptionReason{}, nil
}
