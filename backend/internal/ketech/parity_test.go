package ketech

import (
	"compress/gzip"
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"

	"rail-announcements-backend/internal/feed"
	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/paritytest"
)

const audioDirectory = "../../../audio"

// The files in testdata are written by the website's `npm run export:backend`
// from the TypeScript these voices were ported from. Every test here replays
// that output, so a failure means the two have drifted apart.

func load[T any](t *testing.T, name string) T {
	t.Helper()
	file, err := os.Open("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	unzipped, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	var out T
	if err := json.NewDecoder(unzipped).Decode(&out); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return out
}

type outcome struct {
	Plan   *plan.Plan `json:"plan"`
	Error  *string    `json:"error"`
	Silent bool       `json:"silent"`
}

func (want outcome) check(t *testing.T, label string, got plan.Plan, err error) bool {
	t.Helper()
	switch {
	case want.Error != nil:
		if err == nil || err.Error() != *want.Error {
			t.Errorf("%s: error %v, want %q", label, err, *want.Error)
			return false
		}
	case want.Plan != nil:
		if err != nil {
			t.Errorf("%s: unexpected error %v", label, err)
			return false
		}
		if !reflect.DeepEqual(got, *want.Plan) {
			t.Errorf("%s: clips differ\n%s", label, diff(got, *want.Plan))
			return false
		}
	default:
		t.Errorf("%s: the website played nothing and raised nothing", label)
		return false
	}
	return true
}

func diff(got, want plan.Plan) string {
	if got.StartDelay != want.StartDelay || got.MissingAudioMode != want.MissingAudioMode {
		return "start delay or missing audio mode differs"
	}
	for i := 0; i < max(len(got.Clips), len(want.Clips)); i++ {
		var g, w plan.Clip
		if i < len(got.Clips) {
			g = got.Clips[i]
		}
		if i < len(want.Clips) {
			w = want.Clips[i]
		}
		if g != w {
			out, _ := json.Marshal(map[string]any{"index": i, "got": g, "want": w})
			return string(out)
		}
	}
	return ""
}

func TestLiveAnnouncementsMatchTheWebsite(t *testing.T) {
	movements := load[[]json.RawMessage](t, "movements.json.gz")
	cases := load[[]struct {
		Voice        string            `json:"voice"`
		Preferences  Preferences       `json:"preferences"`
		Movement     int               `json:"movement"`
		Announcement feed.Announcement `json:"announcement"`
		Details      json.RawMessage   `json:"details"`
		Platforms    []struct {
			Platform *string `json:"platform"`
			Spoken   *string `json:"spoken"`
			Outcome  outcome `json:"outcome"`
		} `json:"platforms"`
	}](t, "parity-live.json.gz")

	recordings := paritytest.OpenRecordings(t, audioDirectory)
	failures, plans := 0, 0
	for index, c := range cases {
		details := c.Details
		if string(details) == "null" || len(details) == 0 {
			details = movements[c.Movement]
		}
		if err := json.Unmarshal(details, &c.Announcement.Details); err != nil {
			t.Fatal(err)
		}
		voice := Voices[c.Voice]
		platforms := c.Announcement.Platforms()
		if len(platforms) != len(c.Platforms) {
			t.Fatalf("case %d: speaks on %d platforms, want %d", index, len(platforms), len(c.Platforms))
		}
		for i, want := range c.Platforms {
			label := c.Voice + " " + string(c.Announcement.Type) + " " + c.Announcement.MovementID
			if deref(platforms[i]) != deref(want.Platform) {
				t.Fatalf("%s: platform %q, want %q", label, deref(platforms[i]), deref(want.Platform))
			}
			if deref(platforms[i]) == "" {
				continue
			}
			spoken, ok := voice.AudioPlatform(*platforms[i])
			if ok != (want.Spoken != nil) || (ok && spoken != *want.Spoken) {
				t.Fatalf("%s: audio platform %q %v, want %v", label, spoken, ok, want.Spoken)
			}
			if !ok {
				continue
			}
			got, err := voice.Announce(c.Announcement, c.Preferences, spoken)
			recordings.Check(t, voice.FilePrefix, label, withoutStations(got.Plan.Clips))
			if !want.Outcome.check(t, label, got.Plan, err) {
				failures++
			}
			if want.Outcome.Plan != nil {
				plans++
			}
			if failures > 15 {
				t.Fatal("too many failures")
			}
		}
	}
	if plans < 1000 {
		t.Fatalf("only %d plans were compared", plans)
	}
	recordings.Report(t)
}

// withoutStations leaves out the station names. The feed names stations that
// no voice has recorded, and the listener's missing audio mode covers those.
// Every other clip is wording that the voice chose, so it must exist.
func withoutStations(clips []plan.Clip) []plan.Clip {
	var out []plan.Clip
	for _, clip := range clips {
		if !strings.HasPrefix(clip.ID, "station.") {
			out = append(out, clip)
		}
	}
	return out
}

func TestPostedStatesMatchTheWebsite(t *testing.T) {
	cases := load[[]struct {
		Voice        string          `json:"voice"`
		Announcement string          `json:"announcement"`
		State        json.RawMessage `json:"state"`
		Outcome      outcome         `json:"outcome"`
	}](t, "parity-state.json.gz")
	if len(cases) < 50 {
		t.Fatalf("only %d states", len(cases))
	}
	recordings := paritytest.OpenRecordings(t, audioDirectory)
	for _, c := range cases {
		voice := Voices[c.Voice]
		got, err := voice.PlanState(c.Announcement, c.State)
		c.Outcome.check(t, c.Voice+" "+c.Announcement, got, err)
		recordings.Check(t, voice.FilePrefix, c.Voice+" "+c.Announcement, got.Clips)
	}
	recordings.Report(t)
}

func TestOperatorNamesMatchTheWebsite(t *testing.T) {
	cases := load[[]struct {
		Voice, Name, Code, Origin, Destination, UID, Toc string
		Legacy                                           bool
	}](t, "parity-toc.json.gz")
	for _, c := range cases {
		if got := Voices[c.Voice].TocForLiveTrain(c.Name, c.Code, c.Origin, c.Destination, c.Legacy, c.UID); got != c.Toc {
			t.Errorf("%+v: got %q", c, got)
		}
	}
}

func TestShortPlatformsMatchTheWebsite(t *testing.T) {
	cases := load[[]struct {
		CRS      string  `json:"crs"`
		Platform *string `json:"platform"`
		Train    struct {
			ShortPlatformTrain
			Origin              []struct{ CRS string }  `json:"origin"`
			Destination         []struct{ CRS string }  `json:"destination"`
			SubsequentLocations []struct{ CRS *string } `json:"subsequentLocations"`
		} `json:"train"`
		Result *string `json:"result"`
	}](t, "parity-short-platforms.json.gz")
	for _, c := range cases {
		train := c.Train.ShortPlatformTrain
		for _, s := range c.Train.Origin {
			train.Origins = append(train.Origins, s.CRS)
		}
		for _, s := range c.Train.Destination {
			train.Destinations = append(train.Destinations, s.CRS)
		}
		for _, s := range c.Train.SubsequentLocations {
			train.SubsequentLocations = append(train.SubsequentLocations, deref(s.CRS))
		}
		if got := ShortPlatform(c.CRS, c.Platform, train); got != deref(c.Result) {
			t.Errorf("%s platform %s %+v: got %q, want %q", c.CRS, deref(c.Platform), train, got, deref(c.Result))
		}
	}
}
