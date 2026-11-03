// Package snclass377 ports the website's SN_CLASS_377_V1 system, the
// Bombardier Electrostar and Turbostar on-train announcements in Julie Berry's
// voice.
//
// The website is the reference: change
// src/announcement-data/systems/rolling-stock/BombardierXstar.tsx there,
// re-export the parity record, then port the change here.
package snclass377

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

// instance is the part of the exported class instance the announcements need.
type instance struct {
	ID         string `json:"ID"`
	Name       string `json:"NAME"`
	FilePrefix string `json:"FILE_PREFIX"`
	Stations   struct {
		High []string `json:"high"`
		Low  []string `json:"low"`
	} `json:"AvailableStationNames"`
}

type System struct {
	data    instance
	buttons shared.Buttons
}

func New() (*System, error) {
	var s System
	if err := json.Unmarshal(instanceData, &s.data); err != nil {
		return nil, fmt.Errorf("instance data: %w", err)
	}
	buttons, err := shared.ParseButtons(buttonData)
	if err != nil {
		return nil, err
	}
	s.buttons = buttons
	return &s, nil
}

func (s *System) ID() string         { return s.data.ID }
func (s *System) Name() string       { return s.data.Name }
func (s *System) FilePrefix() string { return s.data.FilePrefix }

const (
	approachingStation = "approachingStation"
	stoppedAtStation   = "stoppedAtStation"
	departingStation   = "departingStation"
)

func (s *System) Announcements() []string {
	return append([]string{approachingStation, stoppedAtStation, departingStation}, s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	switch announcement {
	case approachingStation:
		return build(state, s.approachingStationAudio)
	case stoppedAtStation:
		return build(state, s.stoppedAtStationAudio)
	case departingStation:
		return build(state, s.departingStationAudio)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

func build[Options any](state json.RawMessage, handler func(Options) ([]plan.Clip, error)) (plan.Plan, error) {
	var options Options
	if err := json.Unmarshal(state, &options); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	clips, err := handler(options)
	if err != nil {
		return plan.Plan{}, err
	}
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}, nil
}

// delayed is a clip led into by silence, the website's
// `{ id, opts: { delayStart } }`.
func delayed(ms int, id string) plan.Clip { return plan.Clip{ID: id, Delay: ms} }

func station(code fmt.Stringer) string { return "stations." + code.String() }

type shortPlatformOptions struct {
	ShortPlatform         jsText `json:"shortPlatform"`
	ShortPlatformPosition jsText `json:"shortPlatformPosition"`
	ShortPlatformLength   jsText `json:"shortPlatformLength"`
}

// divisionOptions describes each portion of a dividing train as an inclusive
// coach range.
type divisionOptions struct {
	DividesEnRoute          jsBool `json:"dividesEnRoute"`
	PortionAFirstCoach      jsText `json:"portionAFirstCoach"`
	PortionALastCoach       jsText `json:"portionALastCoach"`
	PortionAAction          jsText `json:"portionAAction"`
	PortionADestinationCode jsText `json:"portionADestinationCode"`
	PortionBFirstCoach      jsText `json:"portionBFirstCoach"`
	PortionBLastCoach       jsText `json:"portionBLastCoach"`
	PortionBAction          jsText `json:"portionBAction"`
	PortionBDestinationCode jsText `json:"portionBDestinationCode"`
}

type coachNumberOptions struct {
	AnnounceCoachNumber jsBool `json:"announceCoachNumber"`
	CoachNumber         jsText `json:"coachNumber"`
	TotalCoaches        jsText `json:"totalCoaches"`
}

type approachingOptions struct {
	StationCode     jsText `json:"stationCode"`
	TerminatesHere  jsBool `json:"terminatesHere"`
	ServiceType     jsText `json:"serviceType"`
	MindTheGap      jsBool `json:"mindTheGap"`
	KeepBelongings  jsBool `json:"keepBelongings"`
	CannotUseOyster jsBool `json:"cannotUseOyster"`
	shortPlatformOptions
	divisionOptions
	coachNumberOptions
}

// callingPoint is one entry of the website's CallingAtSelector. Only the CRS
// code reaches the audio.
type callingPoint struct {
	CrsCode jsText `json:"crsCode"`
}

type stoppedOptions struct {
	ThisStationCode   jsText         `json:"thisStationCode"`
	TerminatesAtCode  jsText         `json:"terminatesAtCode"`
	DivideStationCode jsText         `json:"divideStationCode"`
	CallingAtCodes    []callingPoint `json:"callingAtCodes"`
	ServiceType       jsText         `json:"serviceType"`
	divisionOptions
	coachNumberOptions
}

type departingOptions struct {
	TerminatesAtCode jsText `json:"terminatesAtCode"`
	NextStationCode  jsText `json:"nextStationCode"`
	ServiceType      jsText `json:"serviceType"`
	divisionOptions
	coachNumberOptions
}

func shortPlatformAudio(o shortPlatformOptions) []plan.Clip {
	if o.ShortPlatform.String() == "none" {
		return nil
	}

	alighting := "cannot"
	if o.ShortPlatform.String() == "canOnly" {
		alighting = "can only"
	}

	return []plan.Clip{
		delayed(500, "short plat.would customers please note that"),
		{ID: fmt.Sprintf("short plat.you %s alight from the %s", alighting, o.ShortPlatformPosition)},
		{ID: "short plat.coaches." + o.ShortPlatformLength.String()},
		{ID: "short plat.as this station has a short platform"},
	}
}

// portionAudio is one portion of a dividing train, such as "coaches 1 to 4
// will continue to Bognor Regis".
func portionAudio(firstCoach, lastCoach, action, destinationCode jsText) []plan.Clip {
	onwards := "division.will terminate at"
	if action.String() == "continueTo" {
		onwards = "division.will continue to"
	}

	return []plan.Clip{
		delayed(500, "division.coaches"),
		{ID: "numbers.high." + firstCoach.String()},
		{ID: "division.to"},
		{ID: "numbers.low." + lastCoach.String()},
		{ID: onwards},
		{ID: station(destinationCode)},
	}
}

const travelInCorrectPart = "division.please ensure you are travelling in the correct part of the train"

func divisionAudio(o divisionOptions) []plan.Clip {
	if !o.DividesEnRoute.truthy {
		return nil
	}

	clips := portionAudio(o.PortionAFirstCoach, o.PortionALastCoach, o.PortionAAction, o.PortionADestinationCode)
	clips = append(clips, portionAudio(o.PortionBFirstCoach, o.PortionBLastCoach, o.PortionBAction, o.PortionBDestinationCode)...)
	return append(clips, delayed(500, travelInCorrectPart))
}

// destinationAudio names the terminus only while the train stays intact: a
// dividing train is announced to both of its destinations.
func destinationAudio(o divisionOptions, terminatesAtCode jsText) []plan.Clip {
	if !o.DividesEnRoute.truthy {
		return plan.IDs(station(terminatesAtCode))
	}
	return plan.IDs(station(o.PortionADestinationCode), "and", station(o.PortionBDestinationCode))
}

func divisionStationCodes(o divisionOptions) []jsText {
	if !o.DividesEnRoute.truthy {
		return nil
	}
	return []jsText{o.PortionADestinationCode, o.PortionBDestinationCode}
}

func coachNumberAudio(o coachNumberOptions) []plan.Clip {
	if !o.AnnounceCoachNumber.truthy {
		return nil
	}

	return []plan.Clip{
		delayed(1000, "this is coach number"),
		{ID: "numbers.high." + o.CoachNumber.String()},
		{ID: "of"},
		{ID: "numbers.low." + o.TotalCoaches.String()},
	}
}

func (s *System) approachingStationAudio(o approachingOptions) ([]plan.Clip, error) {
	// A train terminating here cannot also divide here, so terminating wins.
	dividesHere := o.DividesEnRoute.truthy && !o.TerminatesHere.truthy

	if dividesHere {
		if err := s.validateStations(divisionStationCodes(o.divisionOptions)); err != nil {
			return nil, err
		}
	}

	files := plan.IDs("bing bong", "we are now approaching", station(o.StationCode))

	if dividesHere {
		files = append(files, plan.Clip{ID: "division.where the train will divide"})
		files = append(files, divisionAudio(o.divisionOptions)...)
	}

	if o.TerminatesHere.truthy {
		files = append(files, plan.Clip{ID: "our final destination"})

		switch o.ServiceType.String() {
		case "southern":
			files = append(files, plan.Clip{ID: "thank you for travelling with southern"})
		case "connex":
			files = append(files, plan.Clip{ID: "thank you for travelling with connex"})
		}
	}

	if o.MindTheGap.truthy {
		files = append(files, plan.Clip{ID: "please mind the gap between the train and the platform"})
	}

	if o.KeepBelongings.truthy {
		if o.MindTheGap.truthy {
			files = append(files, plan.Clip{ID: "and"})
		}
		files = append(files, plan.Clip{ID: "please do not leave unattended items of luggage in the train or on the station"})
	}

	if o.CannotUseOyster.truthy {
		files = append(files, plan.Clip{ID: "you cannot use oyster"})
	}

	files = append(files, shortPlatformAudio(o.shortPlatformOptions)...)

	// A dividing train already has this line from divisionAudio, so a short
	// platform only adds it when the train stays intact.
	if o.ShortPlatform.String() != "none" && !dividesHere {
		files = append(files, delayed(500, travelInCorrectPart))
	}

	return append(files, coachNumberAudio(o.coachNumberOptions)...), nil
}

func (s *System) stoppedAtStationAudio(o stoppedOptions) ([]plan.Clip, error) {
	if err := s.validateStation(o.TerminatesAtCode); err != nil {
		return nil, err
	}
	if err := s.validateStation(o.ThisStationCode); err != nil {
		return nil, err
	}
	if err := s.validateStations(divisionStationCodes(o.divisionOptions)); err != nil {
		return nil, err
	}
	if o.DividesEnRoute.truthy {
		if err := s.validateStation(o.DivideStationCode); err != nil {
			return nil, err
		}
	}

	files := plan.IDs("bing bong", "this is", station(o.ThisStationCode))

	// A dividing train's calling list runs as far as the dividing point, and
	// each portion is described separately afterwards.
	finalStopCode := o.TerminatesAtCode
	if o.DividesEnRoute.truthy {
		finalStopCode = o.DivideStationCode
	}

	remainingStops := make([]plan.Clip, 0, len(o.CallingAtCodes)+1)
	for _, stop := range o.CallingAtCodes {
		remainingStops = append(remainingStops, delayed(50, station(stop.CrsCode)))
	}
	remainingStops = append(remainingStops, delayed(50, station(finalStopCode)))

	for _, stop := range o.CallingAtCodes {
		if err := s.validateStation(stop.CrsCode); err != nil {
			return nil, err
		}
	}

	switch o.ServiceType.String() {
	case "generic":
		files = append(files, plan.Clip{ID: "this train is for"})
	case "southern":
		files = append(files, plan.Clip{ID: "this train is the southern service to"})
	default:
		files = append(files, plan.Clip{ID: "this train is the service to"})
	}
	files = append(files, destinationAudio(o.divisionOptions, o.TerminatesAtCode)...)

	// A lone remaining stop is the terminus, which has just been named, unless
	// the train divides: then it's the station where the train divides, which
	// nothing else names.
	if len(remainingStops) > 1 || o.DividesEnRoute.truthy {
		files = append(files, plan.Clip{ID: "calling at"})
		files = append(files, plan.Pluralise(remainingStops, plan.PluraliseOptions{BeforeAndDelay: plan.Ptr(75)})...)
	}

	if o.DividesEnRoute.truthy {
		files = append(files, delayed(75, "division.where the train will divide"))
		files = append(files, divisionAudio(o.divisionOptions)...)
	}

	return append(files, coachNumberAudio(o.coachNumberOptions)...), nil
}

func (s *System) departingStationAudio(o departingOptions) ([]plan.Clip, error) {
	if !o.DividesEnRoute.truthy {
		if err := s.validateStation(o.TerminatesAtCode); err != nil {
			return nil, err
		}
	}
	if err := s.validateStation(o.NextStationCode); err != nil {
		return nil, err
	}
	if err := s.validateStations(divisionStationCodes(o.divisionOptions)); err != nil {
		return nil, err
	}

	files := plan.IDs("bing bong")

	switch o.ServiceType.String() {
	case "southeastern":
		files = append(files, plan.Clip{ID: "welcome aboard this southeastern service to"})
	case "connex", "generic":
		// The clip's own ID is misspelt, as recorded.
		files = append(files, plan.Clip{ID: "welcome abord this service to"})
	default:
		files = append(files, plan.Clip{ID: "welcome aboard the southern service to"})
	}

	files = append(files, destinationAudio(o.divisionOptions, o.TerminatesAtCode)...)
	files = append(files, divisionAudio(o.divisionOptions)...)
	files = append(files, plan.Clip{ID: "the next station is"}, plan.Clip{ID: station(o.NextStationCode)})

	return append(files, coachNumberAudio(o.coachNumberOptions)...), nil
}

// validateStation is the base class's validateStationExists. Every call this
// system makes takes the default pitch, so only the high list is consulted.
func (s *System) validateStation(code jsText) error {
	if slices.Contains(s.data.Stations.High, code.String()) {
		return nil
	}
	return fmt.Errorf("Unfortunately, we don't have the recording for %s in the needed type (type: high). If you can record this, please do so, then create an issue or PR on GitHub!", stationName(code.String()))
}

// validateStations follows the handlers' `.some(code => !validate(code))`,
// which stops at the first station that refuses.
func (s *System) validateStations(codes []jsText) error {
	for _, code := range codes {
		if err := s.validateStation(code); err != nil {
			return err
		}
	}
	return nil
}

// stationName names a CRS the way the alert does. The website splices in
// getStationByCrs(crs)?.stationName, so the name comes from the national
// station list whether or not this system records the station, and a code that
// is no station at all reads as JavaScript's own undefined.
func stationName(code string) string {
	if name, ok := shared.StationName(code); ok {
		return name
	}
	return "undefined"
}
