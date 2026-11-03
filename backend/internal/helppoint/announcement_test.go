package helppoint

import (
	"slices"
	"strings"
	"testing"
	"time"

	"rail-announcements-backend/internal/audio"
	"rail-announcements-backend/internal/ketech"
	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/paritytest"
)

// audioDirectory is the website's audio, seen from this package.
const audioDirectory = "../../../audio"

func at(clock string) *time.Time {
	t, err := time.ParseInLocation("2006-01-02 15:04", "2026-07-14 "+clock, london)
	if err != nil {
		panic(err)
	}
	return &t
}

func to(crs ...string) []Endpoint {
	var out []Endpoint
	for _, code := range crs {
		out = append(out, Endpoint{CRS: &code})
	}
	return out
}

// recorded stands in for Phil's recordings: everything exists except a
// combined platform phrase for platform 12 and a combined Lumo phrase.
func recorded(id string) bool {
	return !strings.Contains(id, "platform 12") && !strings.HasPrefix(id, "toc.m.lumo service")
}

func spoken(p plan.Plan) string {
	var words []string
	for _, clip := range p.Clips {
		word := clip.ID
		if clip.Delay > 0 {
			word = "(" + time.Duration(clip.Delay*int(time.Millisecond)).String() + ") " + word
		}
		words = append(words, word)
	}
	return strings.Join(words, " | ")
}

const (
	opening = "s.this is | station.e.BTN | "
	closing = " | (2s) w.i hope youll have an enjoyable journey | (1s) w.thank you for choosing to travel by rail"
)

func TestTheBoardIsSpoken(t *testing.T) {
	eight := 8
	cases := []struct {
		name     string
		services []Service
		want     string
	}{
		{
			"no services", nil,
			"(1s) w.there are no more services from this station today",
		},
		{
			"a platform with a combined recording, and a formation",
			[]Service{{TOC: "SN", PlannedDep: at("09:05"), Platform: "5", CoachCount: &eight, Destinations: to("VIC")}},
			"(2s) s.the next service from platform 5 will be the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.e.VIC" +
				" | (250ms) s.this train is formed of | platform.s.8 | e.coaches",
		},
		{
			"a platform and an operator with no combined recording",
			[]Service{{TOC: "LD", PlannedDep: at("00:00"), Platform: "12", Destinations: to("EDB")}},
			"(2s) s.the next service from platform | platform.s.12 | m.will be the | hour.s.00 - midnight | mins.m.00 - hundred" +
				" | toc.m.lumo | m.service to | station.e.EDB",
		},
		{
			"no platform yet, and an operator with no recording",
			[]Service{{TOC: "ZZ", PlannedDep: at("10:30"), Destinations: to("VIC")}},
			"(2s) s.the next train is the | hour.s.10 | mins.m.30 | m.service to | station.e.VIC",
		},
		{
			"the second service from a platform, a dividing train and a via",
			[]Service{
				{TOC: "SN", PlannedDep: at("09:05"), Platform: "24A", Destinations: to("VIC")},
				{TOC: "SN", PlannedDep: at("09:15"), Platform: "24A", Destinations: []Endpoint{
					to("LIT")[0], {CRS: to("SOU")[0].CRS, Via: &Via{Locs: []string{"WRH", "HAV"}}},
				}},
			},
			"(2s) s.the next service from platform 24A will be the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.e.VIC" +
				" | (2s) s.the | m.ordinal 2 | m.service-2 | m.from | m.platform | platform.s.24a | m.will be the | hour.s.09 | mins.m.15" +
				" | toc.m.southern service to | station.m.LIT | m.and | station.m.SOU | m.via | station.m.WRH | m.and | station.e.HAV",
		},
		{
			"a false destination replaces the service's own, without its via, and keeps a portion's",
			[]Service{
				{TOC: "SN", PlannedDep: at("09:05"), FalseDestination: &to("ECR")[0], Destinations: []Endpoint{
					{CRS: to("VIC")[0].CRS, Via: &Via{Locs: []string{"CLJ"}}}, {CRS: to("LIT")[0].CRS, AssocRID: "portion"},
				}},
				{TOC: "SN", PlannedDep: at("09:15"), FalseDestination: &Endpoint{}, Destinations: to("VIC")},
			},
			"(2s) s.the next train is the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.m.ECR | m.and | station.e.LIT" +
				" | (2s) s.the | m.ordinal 2 | m.service-2 | m.will be the | hour.s.09 | mins.m.15 | toc.m.southern service to | station.e.VIC",
		},
		{
			"a portion that joins another train goes where that train goes, and doesn't terminate where it joins",
			[]Service{
				{TOC: "SN", PlannedDep: at("09:05"), Origins: to("LIT"), Destinations: []Endpoint{
					to("HHE")[0], {CRS: to("VIC")[0].CRS, Via: &Via{Locs: []string{"GTW"}}, AssocRID: "main", AssocCat: "JJ"},
				}},
				{TOC: "SN", PlannedArr: at("09:10"), Platform: "5", Origins: to("LIT"), Destinations: []Endpoint{
					to("BTN")[0], {CRS: to("VIC")[0].CRS, AssocRID: "main", AssocCat: "JJ"},
				}},
				{TOC: "SN", PlannedDep: at("09:14"), Platform: "5", Origins: to("EBN", "LIT"), Destinations: to("VIC")},
			},
			"(2s) s.the next train is the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.m.VIC | m.via | station.e.GTW" +
				" | (2s) s.the next service from platform 5 will be the | hour.s.09 | mins.m.14 | toc.m.southern service to | station.e.VIC",
		},
		{
			"an endpoint with no station is left out, and the one before it ends the sentence",
			[]Service{
				{TOC: "SN", PlannedDep: at("09:05"), Destinations: []Endpoint{to("VIC")[0], {AssocRID: "unknown", AssocCat: "VV"}}},
				{TOC: "SN", PlannedArr: at("09:10"), Origins: []Endpoint{to("VIC")[0], to("LBG")[0], {AssocRID: "unknown", AssocCat: "JJ"}}},
			},
			"(2s) s.the next train is the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.e.VIC" +
				" | (2s) s.the next train | m.will be the | hour.s.09 | mins.m.10 | toc.m.southern service from | station.m.VIC | m.and | station.e.LBG" +
				" | (500ms) w.this train terminates here",
		},
		{
			"London Northwestern Railway is told from West Midlands Railway by destination",
			[]Service{
				{TOC: "LM", PlannedDep: at("09:05"), Destinations: to("EUS")},
				{TOC: "LM", PlannedDep: at("09:06"), Destinations: to("BHM")},
				{TOC: "LM", PlannedDep: at("09:07")},
			},
			"(2s) s.the next train is the | hour.s.09 | mins.m.05 | toc.m.london northwestern railway service to | station.e.EUS" +
				" | (2s) s.the | m.ordinal 2 | m.service-2 | m.will be the | hour.s.09 | mins.m.06 | toc.m.west midlands railway service to | station.e.BHM" +
				" | (2s) s.the | m.ordinal 3 | m.service-2 | m.will be the | hour.s.09 | mins.m.07 | toc.m.west midlands railway service to",
		},
		{
			"a terminating service",
			[]Service{{TOC: "SN", PlannedArr: at("23:37"), Platform: "5", Origins: to("VIC", "LBG")}},
			"(2s) s.the next service to arrive at platform 5 | m.will be the | hour.s.23 | mins.m.37 | toc.m.southern service from" +
				" | station.m.VIC | m.and | station.e.LBG | (500ms) w.this train terminates here",
		},
		{
			"a terminating service at a platform with no combined recording",
			[]Service{{TOC: "SN", PlannedArr: at("23:37"), Platform: "12", Origins: to("VIC")}},
			"(2s) s.the next train | m.from | m.platform | platform.s.12 | m.will be the | hour.s.23 | mins.m.37 | toc.m.southern service from" +
				" | station.e.VIC | (500ms) w.this train terminates here",
		},
		{
			"a service that neither arrives nor departs is left out",
			[]Service{{TOC: "SN", Platform: "5"}},
			"",
		},
		{
			"a cancelled departure with a reason",
			[]Service{{TOC: "SN", PlannedDep: at("09:05"), Platform: "5", Cancelled: true, CancelReasonCode: " 100 ", Destinations: to("VIC")}},
			"(2s) s.im sorry to announce that the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.m.VIC | e.has been cancelled" +
				" | m.due to | disruption-reason.e.a broken down train",
		},
		{
			"a cancelled arrival with an unknown reason",
			[]Service{{TOC: "SN", PlannedArr: at("09:05"), Cancelled: true, CancelReasonCode: "nonsense", Origins: to("VIC")}},
			"(2s) s.im sorry to announce that the | hour.s.09 | mins.m.05 | toc.m.southern service from | station.e.VIC | e.has been cancelled",
		},
		{
			"a delay with a reason",
			[]Service{{TOC: "SN", PlannedDep: at("09:05"), ExpDep: &BoardTime{T: "10:10:29"}, LateReasonCode: "100", Destinations: to("VIC")}},
			"(2s) s.the next train is the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.e.VIC" +
				" | (500ms) s.this service-2 | m.is delayed by approximately | platform.s.1 | m.hour | m.and | platform.s.5 | e.minutes" +
				" | m.due to | disruption-reason.e.a broken down train",
		},
		{
			"a delay across midnight",
			[]Service{{TOC: "SN", PlannedDep: at("23:58"), ExpDep: &BoardTime{T: "00:59"}, Destinations: to("VIC")}},
			"(2s) s.the next train is the | hour.s.23 | mins.m.58 | toc.m.southern service to | station.e.VIC" +
				" | (500ms) s.this service-2 | m.is delayed by approximately | platform.s.1 | m.hour | m.and | platform.s.1 | e.minute",
		},
		{
			"a delay of whole hours",
			[]Service{{TOC: "SN", PlannedDep: at("09:00"), ExpDep: &BoardTime{T: "11:00:00"}, Destinations: to("VIC")}},
			"(2s) s.the next train is the | hour.s.09 | mins.m.00 - hundred | toc.m.southern service to | station.e.VIC" +
				" | (500ms) s.this service-2 | m.is delayed by approximately | platform.s.2 | e.hours",
		},
		{
			"an early or punctual train has no delay",
			[]Service{{TOC: "SN", PlannedDep: at("09:05"), ExpDep: &BoardTime{T: "09:05:30"}, Destinations: to("VIC")}},
			"(2s) s.the next train is the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.e.VIC",
		},
		{
			"a delay of unknown length with a reason",
			[]Service{{TOC: "SN", PlannedDep: at("09:05"), ExpDep: &BoardTime{Delayed: true}, LateReasonCode: "100", Destinations: to("VIC")}},
			"(2s) s.the next train is the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.e.VIC" +
				" | (500ms) s.this service-2 | m.is being delayed due to | disruption-reason.e.a broken down train" +
				" | (500ms) e.please listen for further announcements",
		},
		{
			"a delay of unknown length with no reason",
			[]Service{{TOC: "SN", PlannedDep: at("09:05"), ExpDep: &BoardTime{Delayed: true}, Destinations: to("VIC")}},
			"(2s) s.the next train is the | hour.s.09 | mins.m.05 | toc.m.southern service to | station.e.VIC" +
				" | (500ms) s.this service-2 | e.is being delayed | (500ms) e.please listen for further announcements",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := Departures(ketech.Phil, "BTN", c.services, recorded)
			want := opening + c.want + closing
			if c.want == "" {
				want = strings.TrimSuffix(opening, " | ") + closing
			}
			if got := spoken(p); got != want {
				t.Errorf("spoken:\n got %s\nwant %s", got, want)
			}
			if p.MissingAudioMode != plan.PlaySilence {
				t.Errorf("missing audio mode is %q: a station with no recording must not silence the board", p.MissingAudioMode)
			}
		})
	}
}

func TestAReasonWithAMissingRecordingIsLeftOut(t *testing.T) {
	services := []Service{{TOC: "SN", PlannedDep: at("09:05"), Cancelled: true, CancelReasonCode: "100", Destinations: to("VIC")}}
	p := Departures(ketech.Phil, "BTN", services, func(id string) bool { return !strings.HasPrefix(id, "disruption-reason.") })
	if slices.ContainsFunc(p.Clips, func(clip plan.Clip) bool { return clip.ID == "m.due to" }) {
		t.Errorf("%q says \"due to\" with no reason after it", spoken(p))
	}
}

func TestTimesAreSpokenInLondonTime(t *testing.T) {
	utc := at("09:05").UTC()
	p := Departures(ketech.Phil, "BTN", []Service{{TOC: "SN", PlannedDep: &utc, ExpDep: &BoardTime{T: "09:20"}, Destinations: to("VIC")}}, recorded)
	got := spoken(p)
	if !strings.Contains(got, "hour.s.09 | mins.m.05") || !strings.Contains(got, "platform.s.15 | e.minutes") {
		t.Errorf("a British Summer Time departure given in UTC was spoken as %q", got)
	}
}

// everyBranch is a board that takes each turn of the wording: a combined and
// a spelt-out platform, no platform, a second service, an arrival, a
// cancellation with a reason, and delays of a whole hour, of hours and minutes
// and of unknown length.
func everyBranch() []Service {
	nine := 9
	return []Service{
		{TOC: "SN", Platform: "4", PlannedDep: at("09:05"), ExpDep: &BoardTime{T: "10:05"}, CoachCount: &nine, Destinations: to("VIC")},
		{TOC: "SN", Platform: "4", PlannedDep: at("09:10"), ExpDep: &BoardTime{T: "11:15"}, LateReasonCode: "100", Destinations: to("VIC")},
		{TOC: "SN", Platform: "21", PlannedDep: at("09:12"), ExpDep: &BoardTime{T: "11:12"}, Destinations: to("VIC")},
		{TOC: "SN", PlannedDep: at("09:15"), ExpDep: &BoardTime{Delayed: true}, Destinations: to("VIC")},
		{TOC: "SN", Platform: "2", PlannedArr: at("09:20"), Origins: to("VIC")},
		{TOC: "SN", PlannedDep: at("09:25"), Cancelled: true, CancelReasonCode: "100", Destinations: to("VIC")},
	}
}

func TestCeliaSaysTheWordsSheHasInAnotherInflection(t *testing.T) {
	celia := func(id string) bool {
		return !slices.Contains([]string{"m.service-2", "s.this service-2", "e.hour", "e.hours"}, id)
	}
	got := spoken(Departures(ketech.Celia, "BTN", everyBranch(), celia))
	for _, want := range []string{
		"m.ordinal 2 | e.service-2 | m.from",
		"(500ms) s.this train | m.is delayed by approximately | platform.s.1 | m.hour",
		"platform.s.2 | m.hours | m.and",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("Celia's board doesn't say %q:\n%s", want, got)
		}
	}
	for _, missing := range []string{"m.service-2", "s.this service-2", "e.hour"} {
		if strings.Contains(got, " "+missing+" ") {
			t.Errorf("Celia's board plans %q, which she never recorded:\n%s", missing, got)
		}
	}
}

func TestEveryClipOfTheBoardHasARecordingInBothVoices(t *testing.T) {
	library, err := audio.NewLibrary(audioDirectory, "", 0)
	if err != nil {
		t.Skip(err)
	}
	recordings := paritytest.OpenRecordings(t, audioDirectory)
	for id, voice := range ketech.Voices {
		exists := func(clip string) bool { return library.Exists(voice.FilePrefix, clip) }
		recordings.Check(t, voice.FilePrefix, id+" board", Departures(voice, "BTN", everyBranch(), exists).Clips)
		recordings.Check(t, voice.FilePrefix, id+" empty board", Departures(voice, "BTN", nil, exists).Clips)
		recordings.Check(t, voice.FilePrefix, id+" apology", Unavailable().Clips)
	}
	recordings.Report(t)
}
