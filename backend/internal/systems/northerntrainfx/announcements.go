package northerntrainfx

import (
	"errors"
	"fmt"
	"slices"
	"strconv"

	"rail-announcements-backend/internal/plan"
)

type clips = []plan.Clip

func clip(id string) plan.Clip { return plan.Clip{ID: id} }

// pause leads a clip in with the gap that separates sentences.
func (s *System) pause(id string) plan.Clip {
	return plan.Clip{ID: id, Delay: s.tables.SentenceGap}
}

func (s *System) startOfJourneySafety() clips {
	files := make(clips, len(s.tables.StartOfJourneySafety))
	for i, item := range s.tables.StartOfJourneySafety {
		files[i] = plan.Clip(item)
	}
	return files
}

func serviceIntroAudio(brand, phrasing string, delayStart int) (clips, error) {
	switch phrasing {
	case "is":
		return clips{plan.Clip{ID: "conjoiners.this train is the", Delay: delayStart}, clip("brand." + brand + ".name"), clip("conjoiners.service to")}, nil
	case "will be":
		return clips{plan.Clip{ID: "conjoiners.this train will be the", Delay: delayStart}, clip("brand." + brand + ".name"), clip("conjoiners.service to")}, nil
	case "delayed":
		return clips{plan.Clip{ID: "brand." + brand + ".this train is the delayed service to", Delay: delayStart}}, nil
	}
	// The website's switch falls off the end and spreads undefined, which throws.
	return nil, fmt.Errorf("unknown service wording %q", phrasing)
}

func (s *System) thanksAudio(brand, thanks string) plan.Clip {
	phrase := "thank you for travelling with us"
	if thanks != "plain" {
		phrase += " " + thanks
	}
	return s.pause("brand." + brand + "." + phrase)
}

func (s *System) platformWarningAudio(platformWarning string) plan.Clip {
	return s.pause("messages.please take care when leaving the train and mind the " + platformWarning)
}

func (s *System) timeAudio(hour, minute string) clips {
	hourValue, hourIsNumber := jsParseInt(hour)
	minuteValue, minuteIsNumber := jsParseInt(minute)

	if hourIsNumber && hourValue == 0 && minuteIsNumber && minuteValue == 0 {
		return plan.IDs("time.midnight")
	}
	return plan.IDs(
		"time."+s.timeWord(hourValue, hourIsNumber, "zero"),
		"time."+s.timeWord(minuteValue, minuteIsNumber, "hundred hours"),
	)
}

// timeWord names one half of a clock time. A value parseInt could not read
// reaches the clip ID as JavaScript's own "NaN", and one out of the oh-numbers'
// range as "undefined", because the website interpolates both without checking.
func (s *System) timeWord(value int, isNumber bool, zero string) string {
	switch {
	case !isNumber:
		return "NaN"
	case value == 0:
		return zero
	case value >= 10:
		return strconv.Itoa(value)
	case value < 0:
		return "undefined"
	}
	return s.tables.OhNumbers[value]
}

func callingPointsAudio(points []callingPoint, terminatesAtCode string) clips {
	items := make(clips, 0, len(points)+1)
	for _, point := range points {
		items = append(items, clip("stations.high."+point.CrsCode))
	}
	items = append(items, clip("stations.low."+terminatesAtCode))
	return plan.Pluralise(items, plan.PluraliseOptions{AndID: "conjoiners.and"})
}

// splitLast separates a list of stops into the ones before the last and the
// last itself, which the last stop's own clip then ends the list with.
func splitLast(points []callingPoint) (clips []callingPoint, last callingPoint) {
	return points[:len(points)-1], points[len(points)-1]
}

type welcomeAboardOptions struct {
	Brand               string         `json:"brand"`
	AnnouncementType    string         `json:"announcementType"`
	Phrasing            string         `json:"phrasing"`
	TerminatesAtCode    string         `json:"terminatesAtCode"`
	CallingAtCodes      []callingPoint `json:"callingAtCodes"`
	AnnounceArrivalTime bool           `json:"announceArrivalTime"`
	ArrivalHour         string         `json:"arrivalHour"`
	ArrivalMinute       string         `json:"arrivalMinute"`
}

func (s *System) welcomeAboard(o welcomeAboardOptions) (clips, error) {
	if err := firstError(
		s.validateStation(o.TerminatesAtCode, pitchHigh),
		s.validateStation(o.TerminatesAtCode, pitchLow),
		s.validateCallingPoints(o.CallingAtCodes),
	); err != nil {
		return nil, err
	}

	intro, err := serviceIntroAudio(o.Brand, o.Phrasing, 0)
	if err != nil {
		return nil, err
	}

	isStartOfJourney := o.AnnouncementType == "start of journey"
	var files clips
	if isStartOfJourney {
		files = append(files, clip("conjoiners.welcome aboard"))
	}
	files = append(files, intro...)
	files = append(files,
		clip("stations.high."+o.TerminatesAtCode),
		clip("conjoiners.calling at"),
	)
	files = append(files, callingPointsAudio(o.CallingAtCodes, o.TerminatesAtCode)...)

	if o.AnnounceArrivalTime {
		files = append(files,
			s.pause("conjoiners.we are due to arrive at"),
			clip("stations.high."+o.TerminatesAtCode),
			clip("conjoiners.where our arrival time will be"),
		)
		files = append(files, s.timeAudio(o.ArrivalHour, o.ArrivalMinute)...)
	}

	if isStartOfJourney {
		files = append(files, s.startOfJourneySafety()...)
	}
	return files, nil
}

type departingStationOptions struct {
	Brand            string `json:"brand"`
	TerminatesAtCode string `json:"terminatesAtCode"`
	NextStationCode  string `json:"nextStationCode"`
	DoorPosition     string `json:"doorPosition"`
}

func (s *System) departingStation(o departingStationOptions) (clips, error) {
	if err := firstError(
		s.validateStation(o.TerminatesAtCode, pitchLow),
		s.validateStation(o.NextStationCode, pitchLow),
	); err != nil {
		return nil, err
	}

	files, err := serviceIntroAudio(o.Brand, "is", 0)
	if err != nil {
		return nil, err
	}
	files = append(files,
		clip("stations.low."+o.TerminatesAtCode),
		s.pause("conjoiners.the next station stop is"),
		clip("stations.low."+o.NextStationCode),
	)

	if o.DoorPosition != "none" {
		files = append(files,
			s.pause("messages.if you are getting off at the next station use the doors at the "+o.DoorPosition),
			clip("conjoiners.because our train is longer than the platform"),
		)
	}
	return files, nil
}

type approachingStationOptions struct {
	Brand           string `json:"brand"`
	StationCode     string `json:"stationCode"`
	IsFinalStop     bool   `json:"isFinalStop"`
	PlatformWarning string `json:"platformWarning"`
	Thanks          string `json:"thanks"`
}

func (s *System) approachingStation(o approachingStationOptions) (clips, error) {
	if err := firstError(
		s.validateStation(o.StationCode, pitchHigh),
		s.validateStation(o.StationCode, pitchLow),
	); err != nil {
		return nil, err
	}

	if o.IsFinalStop {
		return clips{
			clip("conjoiners.we are now approaching"),
			clip("stations.high." + o.StationCode),
			clip("conjoiners.where this train terminates"),
			s.pause("messages.please take all your personal belongings any luggage left may be destroyed"),
			s.pause("messages.if you see anything suspicious please tell a member of staff"),
			s.platformWarningAudio(o.PlatformWarning),
			s.thanksAudio(o.Brand, o.Thanks),
		}, nil
	}
	return clips{
		clip("conjoiners.this service is now approaching"),
		clip("stations.low." + o.StationCode),
		s.pause("conjoiners.if you are leaving the train here at"),
		clip("stations.high." + o.StationCode),
		clip("messages.please take all your personal belongings and hand luggage with you"),
		s.platformWarningAudio(o.PlatformWarning),
	}, nil
}

type atStationOptions struct {
	Brand            string `json:"brand"`
	StationCode      string `json:"stationCode"`
	IsFinalStop      bool   `json:"isFinalStop"`
	TerminatesAtCode string `json:"terminatesAtCode"`
	PlatformWarning  string `json:"platformWarning"`
	Thanks           string `json:"thanks"`
}

func (s *System) atStation(o atStationOptions) (clips, error) {
	if err := firstError(
		s.validateStation(o.StationCode, pitchHigh),
		s.validateStation(o.StationCode, pitchLow),
	); err != nil {
		return nil, err
	}

	files := clips{clip("conjoiners.this is")}

	if o.IsFinalStop {
		return append(files,
			clip("stations.high."+o.StationCode),
			clip("conjoiners.where this train terminates"),
			s.platformWarningAudio(o.PlatformWarning),
			s.thanksAudio(o.Brand, o.Thanks),
		), nil
	}

	if err := s.validateStation(o.TerminatesAtCode, pitchLow); err != nil {
		return nil, err
	}
	files = append(files, clip("stations.low."+o.StationCode))

	if slices.Contains(s.tables.PrincipalStations, o.StationCode) {
		files = append(files,
			s.pause("conjoiners.if you are leaving the train here at"),
			clip("stations.high."+o.StationCode),
			clip("messages.please take all your personal belongings any luggage left may be destroyed"),
			s.pause("messages.if you see anything suspicious please tell a member of staff"),
		)
	}

	intro, err := serviceIntroAudio(o.Brand, "is", s.tables.SentenceGap)
	if err != nil {
		return nil, err
	}
	files = append(files, intro...)
	return append(files, clip("stations.low."+o.TerminatesAtCode)), nil
}

func (s *System) reasonAudio(reason string) clips {
	if reason == "" {
		return nil
	}
	return clips{s.pause("conjoiners.this is due to"), clip("reasons." + reason)}
}

type disruptionOptions struct {
	Brand             string         `json:"brand"`
	DisruptionType    string         `json:"disruptionType"`
	MinutesLate       string         `json:"minutesLate"`
	Reason            string         `json:"reason"`
	ApologyWording    string         `json:"apologyWording"`
	AffectedAreaCode  string         `json:"affectedAreaCode"`
	WaitingFor        string         `json:"waitingFor"`
	WillContinue      bool           `json:"willContinue"`
	TerminatePhrasing string         `json:"terminatePhrasing"`
	TerminatesAtCode  string         `json:"terminatesAtCode"`
	NoLongerCallingAt []callingPoint `json:"noLongerCallingAt"`
	Apologise         bool           `json:"apologise"`
	CheckWithStaff    bool           `json:"checkWithStaff"`
}

func (s *System) disruption(o disruptionOptions) (clips, error) {
	var files clips

	switch o.DisruptionType {
	case "running late":
		lateness := "conjoiners.minutes late"
		if o.MinutesLate == "1" {
			lateness = "conjoiners.minute late"
		}
		files = append(files,
			clip("conjoiners.we apologise but this service is now running approximately"),
			clip("numbers."+o.MinutesLate),
			clip(lateness),
		)
		files = append(files, s.reasonAudio(o.Reason)...)

	case "delays may be experienced":
		if o.Reason == "" {
			return nil, errors.New("Please choose a reason for the delays.")
		}
		files = append(files,
			clip("conjoiners.we apologise but"),
			clip("conjoiners.due to"),
			clip("reasons."+o.Reason),
		)
		if o.AffectedAreaCode != "" {
			if err := s.validateStation(o.AffectedAreaCode, pitchHigh); err != nil {
				return nil, err
			}
			files = append(files,
				clip("conjoiners.in the"),
				clip("stations.high."+o.AffectedAreaCode),
				clip("conjoiners.area"),
			)
		}
		files = append(files, clip("conjoiners.delays may be experienced"))

	case "apology":
		if o.Reason == "" {
			return nil, errors.New("Please choose a reason for the apology.")
		}
		files = append(files,
			clip("conjoiners.we apologise but "+o.ApologyWording),
			clip("reasons."+o.Reason),
		)

	case "waiting for":
		files = append(files,
			clip("conjoiners.we are waiting for"),
			clip("reasons.legacy."+o.WaitingFor),
		)

	case "continuing delay":
		if o.Reason == "" {
			return nil, errors.New("Please choose a reason for the continuing delay.")
		}
		files = append(files,
			clip("conjoiners.we apologise for the continuing delay but due to"),
			clip("reasons."+o.Reason),
		)

	case "terminating early":
		if err := s.validateStation(o.TerminatesAtCode, pitchLow); err != nil {
			return nil, err
		}
		phrase := "conjoiners.this train will now end its service at"
		if o.TerminatePhrasing == "terminate at" {
			phrase = "conjoiners.this service will now terminate at"
		}
		files = append(files, clip(phrase), clip("stations.low."+o.TerminatesAtCode))

		if len(o.NoLongerCallingAt) > 0 {
			if err := s.validateCallingPoints(o.NoLongerCallingAt); err != nil {
				return nil, err
			}
			otherStops, lastStop := splitLast(o.NoLongerCallingAt)
			if err := s.validateStation(lastStop.CrsCode, pitchLow); err != nil {
				return nil, err
			}
			files = append(files, clip("conjoiners.and"), clip("conjoiners.will no longer call at"))
			files = append(files, callingPointsAudio(otherStops, lastStop.CrsCode)...)
		}
		files = append(files, s.reasonAudio(o.Reason)...)
	}

	if o.WillContinue && (o.DisruptionType == "waiting for" || o.DisruptionType == "continuing delay") {
		files = append(files, s.pause("messages.this service will continue as soon as possible"))
	}
	if o.CheckWithStaff && o.DisruptionType == "terminating early" {
		files = append(files, s.pause("messages.please check with station staff for alternative services"))
	}
	if o.Apologise {
		files = append(files, s.pause("brand."+o.Brand+".apologises for the inconvenience"))
	}
	return files, nil
}

type dividingTrainOptions struct {
	DivideAtCode         string `json:"divideAtCode"`
	FrontDestinationCode string `json:"frontDestinationCode"`
	RearDestinationCode  string `json:"rearDestinationCode"`
}

func (s *System) dividingTrain(o dividingTrainOptions) (clips, error) {
	if err := firstError(
		s.validateStation(o.DivideAtCode, pitchLow),
		s.validateStation(o.FrontDestinationCode, pitchHigh),
		s.validateStation(o.RearDestinationCode, pitchHigh),
	); err != nil {
		return nil, err
	}
	return clips{
		clip("conjoiners.this train will divide at"),
		clip("stations.low." + o.DivideAtCode),
		s.pause("conjoiners.if you are travelling to"),
		clip("stations.high." + o.FrontDestinationCode),
		clip("conjoiners.please sit in the front coaches"),
		s.pause("conjoiners.if you are travelling to"),
		clip("stations.high." + o.RearDestinationCode),
		clip("conjoiners.please sit in the rear coaches"),
	}, nil
}

type connectionsOptions struct {
	Wording         string         `json:"wording"`
	ConnectionCodes []callingPoint `json:"connectionCodes"`
}

func (s *System) connections(o connectionsOptions) (clips, error) {
	if len(o.ConnectionCodes) == 0 {
		return nil, errors.New("Please add at least one connecting destination.")
	}
	if err := s.validateCallingPoints(o.ConnectionCodes); err != nil {
		return nil, err
	}
	otherStops, lastStop := splitLast(o.ConnectionCodes)
	if err := s.validateStation(lastStop.CrsCode, pitchLow); err != nil {
		return nil, err
	}

	opening := "conjoiners.onward connections are available for"
	if o.Wording == "change here" {
		opening = "conjoiners.change here for connecting services to"
	}
	return append(clips{clip(opening)}, callingPointsAudio(otherStops, lastStop.CrsCode)...), nil
}
