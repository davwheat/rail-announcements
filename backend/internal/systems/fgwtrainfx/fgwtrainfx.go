// Package fgwtrainfx ports the website's First Great Western TrainFX system
// (FGW_TRAINFX_V1, the Faye Dicker recordings).
//
// The website is the reference: change its TypeScript first, re-export the
// parity record, then port the change here.
package fgwtrainfx

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"slices"

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
	tabWelcomeAboard      = "welcomeAboard"
	tabDepartingStation   = "departingStation"
	tabApproachingStation = "approachingStation"
	tabAtStation          = "atStation"
	tabDisruption         = "disruption"
	tabDividingTrain      = "dividingTrain"
)

const (
	pitchHigh = "high"
	pitchLow  = "low"
)

// audioItems is a list of the website's AudioItem: each entry is a bare clip
// ID, or an ID carrying play options.
type audioItems []plan.Clip

func (a *audioItems) UnmarshalJSON(raw []byte) error {
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return err
	}
	out := make(audioItems, 0, len(items))
	for _, item := range items {
		var id string
		if err := json.Unmarshal(item, &id); err == nil {
			out = append(out, plan.Clip{ID: id})
			continue
		}
		var object struct {
			ID   string `json:"id"`
			Opts struct {
				DelayStart int `json:"delayStart"`
			} `json:"opts"`
		}
		if err := json.Unmarshal(item, &object); err != nil {
			return err
		}
		out = append(out, plan.Clip{ID: object.ID, Delay: object.Opts.DelayStart})
	}
	*a = out
	return nil
}

// moduleTables are the module-level constants of the website's TypeScript.
type moduleTables struct {
	// SentenceGap is the pause the recordings leave between sentences.
	SentenceGap int `json:"SENTENCE_GAP"`
	// ApproachExtras and ArrivalExtras are the station-specific extras the
	// TrainFX export's auxiliary announcement table appends at those stations.
	ApproachExtras map[string]audioItems `json:"APPROACH_EXTRAS"`
	ArrivalExtras  map[string]audioItems `json:"ARRIVAL_EXTRAS"`
	// PrincipalStations arrive with the full welcome and security reminder
	// rather than the short welcome.
	PrincipalStations    []string   `json:"PRINCIPAL_STATIONS"`
	StartOfJourneySafety audioItems `json:"START_OF_JOURNEY_SAFETY"`
	SecurityReminder     audioItems `json:"SECURITY_REMINDER"`
	// ShortGWRPhrases are the only phrases the GWR rebrand re-recorded with
	// the short name. Every other phrase borrows the full-name recording.
	ShortGWRPhrases []string `json:"SHORT_GWR_PHRASES"`
}

type System struct {
	id         string
	name       string
	filePrefix string
	// stations holds, per pitch, the CRS codes with a recording.
	stations map[string]map[string]bool
	tables   moduleTables
	buttons  shared.Buttons
}

func New() (*System, error) {
	var instance struct {
		ID                    string              `json:"ID"`
		Name                  string              `json:"NAME"`
		FilePrefix            string              `json:"FILE_PREFIX"`
		AvailableStationNames map[string][]string `json:"AvailableStationNames"`
	}
	if err := json.Unmarshal(instanceData, &instance); err != nil {
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

	stations := make(map[string]map[string]bool, len(instance.AvailableStationNames))
	for pitch, codes := range instance.AvailableStationNames {
		set := make(map[string]bool, len(codes))
		for _, code := range codes {
			set[code] = true
		}
		stations[pitch] = set
	}

	return &System{
		id:         instance.ID,
		name:       instance.Name,
		filePrefix: instance.FilePrefix,
		stations:   stations,
		tables:     tables,
		buttons:    buttons,
	}, nil
}

func (s *System) ID() string         { return s.id }
func (s *System) Name() string       { return s.name }
func (s *System) FilePrefix() string { return s.filePrefix }

func (s *System) Announcements() []string {
	tabs := []string{tabWelcomeAboard, tabDepartingStation, tabApproachingStation, tabAtStation, tabDisruption, tabDividingTrain}
	return append(tabs, s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	switch announcement {
	case tabWelcomeAboard:
		return s.welcomeAboard(state)
	case tabDepartingStation:
		return s.departingStation(state)
	case tabApproachingStation:
		return s.approachingStation(state)
	case tabAtStation:
		return s.atStation(state)
	case tabDisruption:
		return s.disruption(state)
	case tabDividingTrain:
		return s.dividingTrain(state)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}

// callingPoint is one entry of a CallingAtSelector value. Only the CRS code
// reaches the audio.
type callingPoint struct {
	CRSCode string `json:"crsCode"`
}

func crsCodes(points []callingPoint) []string {
	codes := make([]string, len(points))
	for i, point := range points {
		codes[i] = point.CRSCode
	}
	return codes
}

func announce(clips []plan.Clip) plan.Plan {
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}
}

// validateStationExists refuses a station without a recording in the pitch the
// announcement needs, with the message the website alerts.
func (s *System) validateStationExists(crs, pitch string) error {
	if s.stations[pitch][crs] {
		return nil
	}
	return fmt.Errorf(
		"Unfortunately, we don't have the recording for %s in the needed type (type: %s). If you can record this, please do so, then create an issue or PR on GitHub!",
		stationName(crs), pitch,
	)
}

// stationName names a CRS code from the national station table, the way the
// website's alert does: the station this system has no recording of still has
// a name. A code the national table lacks renders as "undefined", which is
// what the TypeScript template literal prints for the missing lookup.
func stationName(crs string) string {
	if name, ok := shared.StationName(crs); ok {
		return name
	}
	return "undefined"
}

func (s *System) validateCallingPoints(codes []string) error {
	for _, code := range codes {
		if err := s.validateStationExists(code, pitchHigh); err != nil {
			return err
		}
	}
	return nil
}

func (s *System) brandClip(brand, phrase string, delay int) plan.Clip {
	if brand == "gwr short" && !slices.Contains(s.tables.ShortGWRPhrases, phrase) {
		brand = "gwr"
	}
	return plan.Clip{ID: "brand." + brand + "." + phrase, Delay: delay}
}

func callingPointsAudio(callingAt []string, terminatesAt string) []plan.Clip {
	items := make([]plan.Clip, 0, len(callingAt)+1)
	for _, crs := range callingAt {
		items = append(items, plan.Clip{ID: "stations.high." + crs})
	}
	items = append(items, plan.Clip{ID: "stations.low." + terminatesAt})
	return plan.Pluralise(items, plan.PluraliseOptions{AndID: "conjoiners.and"})
}

func (s *System) journeyAudio(brand, phrase, origin, terminatesAt string, callingAt []string) ([]plan.Clip, error) {
	if err := s.validateStationExists(origin, pitchHigh); err != nil {
		return nil, err
	}
	if err := s.validateStationExists(terminatesAt, pitchHigh); err != nil {
		return nil, err
	}
	if err := s.validateStationExists(terminatesAt, pitchLow); err != nil {
		return nil, err
	}
	if err := s.validateCallingPoints(callingAt); err != nil {
		return nil, err
	}

	clips := []plan.Clip{
		s.brandClip(brand, phrase, 0),
		{ID: "stations.high." + origin},
		{ID: "conjoiners.to"},
		{ID: "stations.high." + terminatesAt},
		{ID: "conjoiners.calling at"},
	}
	return append(clips, callingPointsAudio(callingAt, terminatesAt)...), nil
}

func (s *System) finalStopAudio(brand string) []plan.Clip {
	gap := s.tables.SentenceGap
	return []plan.Clip{
		{ID: "conjoiners.our final stop for this service"},
		{ID: "messages.please have your tickets and travel documents ready", Delay: gap},
		{ID: "messages.please take care as you step from the train to the platform", Delay: gap},
		s.brandClip(brand, "thank you for travelling with", gap),
	}
}

func (s *System) welcomeAboard(state json.RawMessage) (plan.Plan, error) {
	var opts struct {
		Brand            string         `json:"brand"`
		AnnouncementType string         `json:"announcementType"`
		OriginCode       string         `json:"originCode"`
		TerminatesAtCode string         `json:"terminatesAtCode"`
		CallingAtCodes   []callingPoint `json:"callingAtCodes"`
	}
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}

	startOfJourney := opts.AnnouncementType == "start of journey"
	phrase := "welcome aboard this service from"
	if startOfJourney {
		phrase = "welcomes you aboard this service from"
	}
	clips, err := s.journeyAudio(opts.Brand, phrase, opts.OriginCode, opts.TerminatesAtCode, crsCodes(opts.CallingAtCodes))
	if err != nil {
		return plan.Plan{}, err
	}
	if startOfJourney {
		clips = append(clips, s.tables.StartOfJourneySafety...)
	}
	return announce(clips), nil
}

func (s *System) departingStation(state json.RawMessage) (plan.Plan, error) {
	var opts struct {
		NextStationCode string `json:"nextStationCode"`
	}
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	if err := s.validateStationExists(opts.NextStationCode, pitchLow); err != nil {
		return plan.Plan{}, err
	}
	return announce(plan.IDs("conjoiners.our next station is", "stations.low."+opts.NextStationCode)), nil
}

func (s *System) approachingStation(state json.RawMessage) (plan.Plan, error) {
	var opts struct {
		Brand       string `json:"brand"`
		StationCode string `json:"stationCode"`
		IsFinalStop bool   `json:"isFinalStop"`
	}
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}

	var clips []plan.Clip
	if opts.IsFinalStop {
		if err := s.validateStationExists(opts.StationCode, pitchHigh); err != nil {
			return plan.Plan{}, err
		}
		clips = append(plan.IDs("conjoiners.we are now approaching", "stations.high."+opts.StationCode), s.finalStopAudio(opts.Brand)...)
	} else {
		if err := s.validateStationExists(opts.StationCode, pitchLow); err != nil {
			return plan.Plan{}, err
		}
		clips = plan.IDs("conjoiners.we will shortly be arriving at", "stations.low."+opts.StationCode)
	}

	clips = append(clips, s.tables.ApproachExtras[opts.StationCode]...)
	return announce(clips), nil
}

func (s *System) atStation(state json.RawMessage) (plan.Plan, error) {
	var opts struct {
		Brand            string         `json:"brand"`
		StationCode      string         `json:"stationCode"`
		IsFinalStop      bool           `json:"isFinalStop"`
		PrincipalArrival bool           `json:"principalArrival"`
		OriginCode       string         `json:"originCode"`
		TerminatesAtCode string         `json:"terminatesAtCode"`
		CallingAtCodes   []callingPoint `json:"callingAtCodes"`
	}
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}

	principal := !opts.IsFinalStop && opts.PrincipalArrival && slices.Contains(s.tables.PrincipalStations, opts.StationCode)

	var clips []plan.Clip
	switch {
	case opts.IsFinalStop:
		if err := s.validateStationExists(opts.StationCode, pitchHigh); err != nil {
			return plan.Plan{}, err
		}
		clips = append(plan.IDs("conjoiners.this station is", "stations.high."+opts.StationCode), s.finalStopAudio(opts.Brand)...)
	case principal:
		journey, err := s.journeyAudio(opts.Brand, "welcome aboard this service from", opts.OriginCode, opts.TerminatesAtCode, crsCodes(opts.CallingAtCodes))
		if err != nil {
			return plan.Plan{}, err
		}
		clips = journey
	default:
		if err := s.validateStationExists(opts.TerminatesAtCode, pitchLow); err != nil {
			return plan.Plan{}, err
		}
		clips = []plan.Clip{
			s.brandClip(opts.Brand, "welcomes you aboard this service to", 0),
			{ID: "stations.low." + opts.TerminatesAtCode},
		}
	}

	clips = append(clips, s.tables.ArrivalExtras[opts.StationCode]...)
	if principal {
		clips = append(clips, s.tables.SecurityReminder...)
	}
	return announce(clips), nil
}

func (s *System) reasonAudio(reasonIntro, reason string) []plan.Clip {
	if reasonIntro == "none" || reason == "" {
		return nil
	}
	return []plan.Clip{
		{ID: "conjoiners." + reasonIntro, Delay: s.tables.SentenceGap},
		{ID: "reasons." + reason},
	}
}

func (s *System) disruption(state json.RawMessage) (plan.Plan, error) {
	var opts struct {
		Brand             string         `json:"brand"`
		DisruptionType    string         `json:"disruptionType"`
		MinutesLate       string         `json:"minutesLate"`
		ReasonIntro       string         `json:"reasonIntro"`
		Reason            string         `json:"reason"`
		WaitingFor        string         `json:"waitingFor"`
		WillContinue      bool           `json:"willContinue"`
		TerminatesAtCode  string         `json:"terminatesAtCode"`
		NoLongerCallingAt []callingPoint `json:"noLongerCallingAt"`
		Apologise         bool           `json:"apologise"`
		CheckWithStaff    bool           `json:"checkWithStaff"`
		CheckWebsite      bool           `json:"checkWebsite"`
	}
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}

	var clips []plan.Clip
	switch opts.DisruptionType {
	case "running late":
		clips = append(plan.IDs(
			"conjoiners.we apologise but this service is now running approximately",
			"numbers."+opts.MinutesLate,
			"conjoiners.minutes late",
		), s.reasonAudio(opts.ReasonIntro, opts.Reason)...)

	case "delayed":
		clips = append([]plan.Clip{s.brandClip(opts.Brand, "this service has been delayed", 0)}, s.reasonAudio(opts.ReasonIntro, opts.Reason)...)

	case "waiting for":
		clips = plan.IDs("conjoiners.we are waiting for", "reasons.legacy."+opts.WaitingFor)

	case "continuing delay":
		if opts.Reason == "" {
			return plan.Plan{}, errors.New("Please choose a reason for the continuing delay.")
		}
		clips = plan.IDs("conjoiners.we apologise for the continuing delay but due to", "reasons."+opts.Reason)

	case "terminating early":
		if err := s.validateStationExists(opts.TerminatesAtCode, pitchLow); err != nil {
			return plan.Plan{}, err
		}
		clips = plan.IDs("conjoiners.this service will now terminate at", "stations.low."+opts.TerminatesAtCode)

		if len(opts.NoLongerCallingAt) > 0 {
			codes := crsCodes(opts.NoLongerCallingAt)
			if err := s.validateCallingPoints(codes); err != nil {
				return plan.Plan{}, err
			}
			lastStop := codes[len(codes)-1]
			if err := s.validateStationExists(lastStop, pitchLow); err != nil {
				return plan.Plan{}, err
			}
			clips = append(clips, plan.Clip{ID: "conjoiners.and will no longer call at"})
			clips = append(clips, callingPointsAudio(codes[:len(codes)-1], lastStop)...)
		}

		clips = append(clips, s.reasonAudio(opts.ReasonIntro, opts.Reason)...)
	}

	gap := s.tables.SentenceGap
	if opts.WillContinue && (opts.DisruptionType == "waiting for" || opts.DisruptionType == "continuing delay") {
		clips = append(clips, plan.Clip{ID: "messages.this service will continue as soon as possible", Delay: gap})
	}
	if opts.CheckWithStaff && opts.DisruptionType == "terminating early" {
		clips = append(clips, plan.Clip{ID: "messages.please check with station staff for alternative services", Delay: gap})
	}
	if opts.CheckWebsite && opts.DisruptionType == "terminating early" {
		clips = append(clips, s.brandClip(opts.Brand, "please check website for further details", gap))
	}
	if opts.Apologise && opts.DisruptionType != "delayed" {
		clips = append(clips, s.brandClip(opts.Brand, "apologise for the inconvenience", gap))
	}

	return announce(clips), nil
}

func (s *System) dividingTrain(state json.RawMessage) (plan.Plan, error) {
	var opts struct {
		DivideAtCode         string `json:"divideAtCode"`
		FrontDestinationCode string `json:"frontDestinationCode"`
		RearDestinationCode  string `json:"rearDestinationCode"`
	}
	if err := json.Unmarshal(state, &opts); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	if err := s.validateStationExists(opts.DivideAtCode, pitchLow); err != nil {
		return plan.Plan{}, err
	}
	if err := s.validateStationExists(opts.FrontDestinationCode, pitchHigh); err != nil {
		return plan.Plan{}, err
	}
	if err := s.validateStationExists(opts.RearDestinationCode, pitchHigh); err != nil {
		return plan.Plan{}, err
	}

	gap := s.tables.SentenceGap
	return announce([]plan.Clip{
		{ID: "conjoiners.this train will divide at"},
		{ID: "stations.low." + opts.DivideAtCode},
		{ID: "conjoiners.if you are travelling to", Delay: gap},
		{ID: "stations.high." + opts.FrontDestinationCode},
		{ID: "conjoiners.please sit in the front coaches"},
		{ID: "conjoiners.if you are travelling to", Delay: gap},
		{ID: "stations.high." + opts.RearDestinationCode},
		{ID: "conjoiners.please sit in the rear coaches"},
	}), nil
}
