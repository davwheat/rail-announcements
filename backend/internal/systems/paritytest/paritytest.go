// Package paritytest holds a ported announcement system to the website's own
// output. The website's `npm run export:backend` runs every tab of every
// system through the real TypeScript, over the tab's defaults, its presets and
// states generated from its option descriptors, and records what each would
// play. Run replays that record against the port.
//
// A case records both what the handler played and what it alerted, and the
// play is what counts: a handler which alerts and carries on has not refused
// the state, and the website shows that alert in the browser itself and asks
// the backend only for the audio. So a recorded plan is always the expected
// outcome, whatever the recorded alert says, and only a case which played
// nothing expects the port to refuse.
package paritytest

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"slices"
	"sort"
	"strings"
	"testing"

	"rail-announcements-backend/internal/plan"
)

// System is the part of system.System the record can be checked against. It is
// declared here so that a system's own tests can import this package.
type System interface {
	ID() string
	FilePrefix() string
	Announcements() []string
	Plan(announcement string, state json.RawMessage) (plan.Plan, error)
}

type record struct {
	System struct {
		ID         string `json:"id"`
		FilePrefix string `json:"filePrefix"`
		Tabs       []struct {
			ID   string `json:"id"`
			Kind string `json:"kind"`
		} `json:"tabs"`
	} `json:"system"`
	Cases []struct {
		Tab   string          `json:"tab"`
		State json.RawMessage `json:"state"`
		Calls []plan.Plan     `json:"calls"`
		Error *string         `json:"error"`
	} `json:"cases"`
}

// maxReported keeps a broken port's output readable.
const maxReported = 12

// Run replays the record at path, which is testdata/parity.json.gz in a
// system's package. A case which the website played expects that plan and no
// error; only one which played nothing expects the recorded refusal.
//
// Every clip the port plans must also have a recording.
func Run(t *testing.T, sys System, path string) {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	unzipped, err := gzip.NewReader(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	var rec record
	if err := json.NewDecoder(unzipped).Decode(&rec); err != nil {
		t.Fatal(err)
	}

	if sys.ID() != rec.System.ID || sys.FilePrefix() != rec.System.FilePrefix {
		t.Errorf("the port is %s with audio in %q, and the website's is %s in %q", sys.ID(), sys.FilePrefix(), rec.System.ID, rec.System.FilePrefix)
	}
	var tabs []string
	for _, tab := range rec.System.Tabs {
		tabs = append(tabs, tab.ID)
	}
	ported := slices.Clone(sys.Announcements())
	sort.Strings(tabs)
	sort.Strings(ported)
	if !slices.Equal(tabs, ported) {
		t.Errorf("the port offers %v, and the website has %v", ported, tabs)
	}
	if len(rec.Cases) == 0 {
		t.Fatal("the record holds no cases")
	}

	recordings := OpenRecordings(t, audioDirectory)
	failed := map[string]int{}
	total := map[string]int{}
	reported := 0
	for index, c := range rec.Cases {
		total[c.Tab]++
		if len(c.Calls) > 1 {
			t.Fatalf("case %d plays %d times, which one plan cannot describe", index, len(c.Calls))
		}
		got, err := sys.Plan(c.Tab, c.State)
		recordings.Check(t, sys.FilePrefix(), fmt.Sprintf("case %d, tab %s", index, c.Tab), got.Clips)
		problem := compare(got, err, c.Calls, c.Error)
		if problem == "" {
			continue
		}
		failed[c.Tab]++
		if reported++; reported <= maxReported {
			t.Errorf("case %d, tab %s: %s\n  state: %s", index, c.Tab, problem, abbreviate(string(c.State)))
		}
	}
	for tab, count := range total {
		if failed[tab] > 0 {
			t.Errorf("%s: %d of %d cases differ from the website", tab, failed[tab], count)
		}
	}
	recordings.Report(t)
}

// compare reports how the port differs from one recorded case, or "" when it
// matches. A recorded plan wins over a recorded alert: wantError is the
// expected outcome only where the website played nothing.
func compare(got plan.Plan, err error, calls []plan.Plan, wantError *string) string {
	if len(calls) == 0 {
		switch {
		case wantError != nil && err == nil:
			return fmt.Sprintf("the website refuses this with %q, and the port built a plan", *wantError)
		case wantError != nil && err.Error() != *wantError:
			return fmt.Sprintf("refused with %q, and the website says %q", err, *wantError)
		case wantError != nil:
			return ""
		case err != nil:
			return fmt.Sprintf("refused with %q, and the website plays nothing", err)
		case len(got.Clips) != 0:
			return fmt.Sprintf("plays %d clips, and the website plays nothing", len(got.Clips))
		}
		return ""
	}
	if err != nil {
		return fmt.Sprintf("refused with %q, and the website plays it", err)
	}
	want := calls[0]
	if got.StartDelay != want.StartDelay {
		return fmt.Sprintf("start delay %d, want %d", got.StartDelay, want.StartDelay)
	}
	if got.MissingAudioMode != want.MissingAudioMode {
		return fmt.Sprintf("missing audio mode %q, want %q", got.MissingAudioMode, want.MissingAudioMode)
	}
	for i := 0; i < max(len(got.Clips), len(want.Clips)); i++ {
		var g, w plan.Clip
		if i < len(got.Clips) {
			g = got.Clips[i]
		}
		if i < len(want.Clips) {
			w = want.Clips[i]
		}
		if !reflect.DeepEqual(g, w) {
			return fmt.Sprintf("clip %d of %d is %+v, want %+v\n  before it: %s", i, len(want.Clips), g, w, tail(want.Clips[:min(i, len(want.Clips))]))
		}
	}
	return ""
}

func tail(clips []plan.Clip) string {
	var ids []string
	for _, clip := range clips[max(0, len(clips)-4):] {
		ids = append(ids, clip.ID)
	}
	return strings.Join(ids, " | ")
}

func abbreviate(s string) string {
	if len(s) > 700 {
		return s[:700] + "…"
	}
	return s
}
