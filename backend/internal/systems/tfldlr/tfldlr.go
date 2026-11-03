// Package tfldlr ports the website's TfL Docklands Light Railway system
// (TFL_DLR_V1). The TypeScript is the reference: change
// src/announcement-data/systems/rolling-stock/TfLDLR.tsx and its TfLDLRData.ts
// first, re-export the record, then port.
package tfldlr

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/instance.json
var instanceData []byte

//go:embed data/module.json
var moduleData []byte

//go:embed data/buttons.json
var buttonData []byte

type instanceFields struct {
	ID         string `json:"ID"`
	Name       string `json:"NAME"`
	FilePrefix string `json:"FILE_PREFIX"`
}

// clipSet holds the clips the play handlers name. The button-only entries of
// the TypeScript's Clips table are left out: data/buttons.json carries them.
type clipSet struct {
	ThisTrainIsFor                        string `json:"thisTrainIsFor"`
	TheNextStopIs                         string `json:"theNextStopIs"`
	ThisIs                                string `json:"thisIs"`
	WhereThisTrainTerminates              string `json:"whereThisTrainTerminates"`
	WhereThisTrainWillTerminateAllChange  string `json:"whereThisTrainWillTerminateAllChange"`
	WhereThisTrainWillTerminateBelongings string `json:"whereThisTrainWillTerminateBelongings"`
	ThisTrainTerminatesHere               string `json:"thisTrainTerminatesHere"`
	PleaseRememberBelongings              string `json:"pleaseRememberBelongings"`
	WhenLeavingBelongings                 string `json:"whenLeavingBelongings"`
	As                                    string `json:"as"`
	At                                    string `json:"at"`
	AndDlrToWestIndiaQuay                 string `json:"andDlrToWestIndiaQuay"`
	ToAlightMoveToCentre                  string `json:"toAlightMoveToCentre"`
	FirstAndLastDoorsWillNotOpen          string `json:"firstAndLastDoorsWillNotOpen"`
	WiqBypass                             string `json:"wiqBypass"`
	WiqBypassPlatform5                    string `json:"wiqBypassPlatform5"`
	LeaveFromRightHandSide                string `json:"leaveFromRightHandSide"`
	MindTheGap                            string `json:"mindTheGap"`
}

type moduleTables struct {
	// SDOWarningPause is the only pause the real system adds, before "at
	// <station>" in the selective door opening warning.
	SDOWarningPause int `json:"SDO_WARNING_PAUSE"`
	// StratfordLowLevel names the second Stratford node; see nodesFor.
	StratfordLowLevel string                `json:"STRATFORD_LOW_LEVEL"`
	Clips             clipSet               `json:"Clips"`
	Interchange       interchangeClips      `json:"Interchange"`
	ElizabethLineEra  elizabethLineEraClips `json:"ElizabethLineEra"`
	AllStations       []station             `json:"AllStations"`
	AllDestinations   []destination         `json:"AllDestinations"`
	// Lines is the network in the website's own order, which buildLinks
	// depends on: it decides which of several equal-length routes the search
	// returns, and so which interchange clip plays.
	Lines       [][]string   `json:"Lines"`
	OneWayLinks []oneWayLink `json:"OneWayLinks"`
}

type System struct {
	instance instanceFields
	tables   moduleTables
	buttons  shared.Buttons
	stations map[string]station
	links    map[string][]string
}

func New() (*System, error) {
	s := &System{}
	if err := json.Unmarshal(instanceData, &s.instance); err != nil {
		return nil, fmt.Errorf("instance: %w", err)
	}
	if err := json.Unmarshal(moduleData, &s.tables); err != nil {
		return nil, fmt.Errorf("module: %w", err)
	}
	if err := requireClips("Interchange", s.tables.Interchange); err != nil {
		return nil, err
	}
	if err := requireClips("ElizabethLineEra", s.tables.ElizabethLineEra); err != nil {
		return nil, err
	}
	buttons, err := shared.ParseButtons(buttonData)
	if err != nil {
		return nil, err
	}
	s.buttons = buttons
	s.links = buildLinks(s.tables.Lines)
	s.stations = make(map[string]station, len(s.tables.AllStations))
	for _, stn := range s.tables.AllStations {
		s.stations[stn.Name] = stn
	}
	return s, nil
}

func (s *System) ID() string         { return s.instance.ID }
func (s *System) Name() string       { return s.instance.Name }
func (s *System) FilePrefix() string { return s.instance.FilePrefix }

func (s *System) Announcements() []string {
	return append([]string{"approaching", "docked", "departing"}, s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	switch announcement {
	case "approaching":
		return s.planApproaching(state)
	case "docked":
		return s.planDocked(state)
	case "departing":
		return s.planDeparting(state)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

// serviceOptions is the state of the approaching and departing tabs. The
// departing tab has no Elizabeth line choice and its handler never reads one.
type serviceOptions struct {
	Origin        jsString `json:"origin"`
	Destination   jsString `json:"destination"`
	NextStation   jsString `json:"nextStation"`
	ThreeCar      jsBool   `json:"threeCar"`
	ElizabethLine jsBool   `json:"elizabethLine"`
}

func (s *System) planApproaching(state json.RawMessage) (plan.Plan, error) {
	var options serviceOptions
	if err := json.Unmarshal(state, &options); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	position, ok := s.locateNextStation(options)
	if !ok {
		return plan.Plan{}, invalidService(options)
	}

	clips := s.tables.Clips
	elizabethLine := options.ElizabethLine.Truthy()
	selectiveDoors := options.ThreeCar.Truthy() && position.station.SDO
	var files []string

	if position.terminating {
		files = append(files, clips.TheNextStopIs, position.station.ApproachClip)

		if selectiveDoors {
			files = append(files, clips.ToAlightMoveToCentre, clips.TheNextStopIs, position.station.Clip)
		}

		files = append(files, s.approachMessage(position, elizabethLine)...)
	} else {
		files = append(files, clips.ThisTrainIsFor, s.destinationClip(position.route, position.station.Name), clips.TheNextStopIs, position.station.ApproachClip)

		if selectiveDoors {
			files = append(files, clips.ToAlightMoveToCentre)
		}

		files = append(files, s.approachMessage(position, elizabethLine)...)

		// The on-train recording has the bypass message here, inside the
		// Westferry approach message. At Canary Wharf the interchange message
		// carries it instead, as "and DLR to West India Quay".
		if position.station.Name == "Westferry" && bypassesWestIndiaQuay(position) {
			files = append(files, clips.WiqBypass)
		}

		if position.station.Belongings {
			files = append(files, clips.WhenLeavingBelongings)
		}
	}

	return plan.Plan{Clips: plan.IDs(files...), MissingAudioMode: plan.SkipService}, nil
}

func (s *System) planDocked(state json.RawMessage) (plan.Plan, error) {
	var options struct {
		Station     jsString `json:"station"`
		Terminating jsBool   `json:"terminating"`
		ThreeCar    jsBool   `json:"threeCar"`
	}
	if err := json.Unmarshal(state, &options); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	thisStation, ok := s.getStation(options.Station.Value())
	if !ok {
		return plan.Plan{}, fmt.Errorf("Invalid station.\n\n%s", options.Station)
	}

	clips := s.tables.Clips
	var files []string

	if thisStation.MindTheGap {
		files = append(files, clips.MindTheGap)
	}

	files = append(files, clips.ThisIs, thisStation.DockedClip)

	if options.ThreeCar.Truthy() && thisStation.SDO {
		files = append(files, clips.ToAlightMoveToCentre)
	}

	if options.Terminating.Truthy() {
		files = append(files, clips.ThisTrainTerminatesHere)
	}

	return plan.Plan{Clips: plan.IDs(files...), MissingAudioMode: plan.SkipService}, nil
}

func (s *System) planDeparting(state json.RawMessage) (plan.Plan, error) {
	var options serviceOptions
	if err := json.Unmarshal(state, &options); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	position, ok := s.locateNextStation(options)
	if !ok {
		return plan.Plan{}, invalidService(options)
	}

	clips := s.tables.Clips
	threeCar := options.ThreeCar.Truthy()
	following, hasFollowing := s.getStation(position.following)
	var files []plan.Clip

	switch {
	case position.terminating:
		files = plan.IDs(clips.TheNextStopIs, position.station.DepartureClip)

		if threeCar && position.station.SDO {
			files = append(files, plan.IDs(clips.ToAlightMoveToCentre, clips.TheNextStopIs, position.station.Clip)...)
		}

		files = append(files, plan.Clip{ID: clips.WhereThisTrainTerminates})

		if position.station.Belongings {
			files = append(files, plan.Clip{ID: clips.PleaseRememberBelongings})
		}
	case threeCar && position.station.SDO:
		files = plan.IDs(clips.TheNextStopIs, position.station.Clip, clips.ToAlightMoveToCentre, clips.As, clips.FirstAndLastDoorsWillNotOpen)
	case threeCar && hasFollowing && following.SDO:
		files = append(plan.IDs(clips.TheNextStopIs, position.station.Clip),
			plan.Clip{ID: clips.At, Delay: s.tables.SDOWarningPause},
			plan.Clip{ID: following.Clip},
			plan.Clip{ID: clips.FirstAndLastDoorsWillNotOpen},
			plan.Clip{ID: clips.ToAlightMoveToCentre},
		)
	case bypassesWestIndiaQuay(position) && (position.station.Name == "Westferry" || position.station.Name == "Canary Wharf") && position.previous != "":
		files = plan.IDs(clips.WiqBypassPlatform5)
	default:
		return plan.Plan{}, errNoDepartureAudio
	}

	return plan.Plan{Clips: files, MissingAudioMode: plan.SkipService}, nil
}

// errNoDepartureAudio and invalidService reproduce the alert() text the
// TypeScript shows, word for word, because the parity record holds it.
var errNoDepartureAudio = errors.New("This departure only updates the displays and has no audio. Only terminating, selective door opening and bypass departures do.")

func invalidService(options serviceOptions) error {
	return fmt.Errorf("Invalid service.\n\n%s to %s, next station %s", options.Origin, options.Destination, options.NextStation)
}
