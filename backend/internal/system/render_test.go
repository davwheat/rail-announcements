package system

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"rail-announcements-backend/internal/audio"
)

const audioDirectory = "../../../audio"

// The parity records prove that each port names the clips the website names.
// This proves the rest of the way: that the service finds those recordings
// under the system's prefix and joins them into audio.
//
// A clip the library lacks is the website's gap as much as the service's, so
// it is counted and not failed, within a bound: a system whose announcements
// mostly cannot be rendered has a wrong prefix or a wrong path rule.
func TestEverySystemRendersFromTheLibrary(t *testing.T) {
	if _, err := os.Stat(filepath.Join(audioDirectory, "station/ketech/phil")); err != nil {
		t.Skip("the audio directory is not checked out")
	}
	library, err := audio.NewLibrary(audioDirectory, "", 256<<20)
	if err != nil {
		t.Skip(err)
	}
	if len(All) < 16 {
		t.Fatalf("only %d systems are registered", len(All))
	}

	const perTab = 3
	for _, sys := range All {
		t.Run(sys.ID(), func(t *testing.T) {
			if ByID(sys.ID()) != sys {
				t.Fatal("the system cannot be found by its ID")
			}
			rendered, missing := 0, map[string]bool{}
			for _, c := range sample(t, sys, perTab) {
				announcement, err := sys.Plan(c.Tab, c.State)
				if err != nil || len(announcement.Clips) == 0 {
					continue
				}
				pcm, err := library.Render(context.Background(), sys.FilePrefix(), announcement)
				switch {
				case errors.Is(err, audio.ErrMissing):
					missing[err.Error()] = true
				case err != nil:
					t.Errorf("%s: %v", c.Tab, err)
				case len(pcm) < audio.SampleRate/2:
					t.Errorf("%s: only %d bytes of audio", c.Tab, len(pcm))
				default:
					rendered++
				}
			}
			t.Logf("%d announcements rendered, %d distinct recordings missing", rendered, len(missing))
			for problem := range missing {
				t.Logf("  %s", problem)
			}
			if rendered == 0 || len(missing) > rendered {
				t.Errorf("%d rendered and %d recordings missing: check the prefix %q", rendered, len(missing), sys.FilePrefix())
			}
		})
	}
}

type recorded struct {
	Tab   string          `json:"tab"`
	State json.RawMessage `json:"state"`
	Calls []any           `json:"calls"`
}

// sample takes the first few playable cases of each tab from the system's own
// parity record, which is the nearest thing to what a listener would post.
func sample(t *testing.T, sys System, perTab int) []recorded {
	t.Helper()
	matches, _ := filepath.Glob("../systems/*/testdata/parity.json.gz")
	for _, path := range matches {
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		unzipped, err := gzip.NewReader(bytes.NewReader(raw))
		if err != nil {
			t.Fatal(err)
		}
		var record struct {
			System struct{ ID string } `json:"system"`
			Cases  []recorded          `json:"cases"`
		}
		if err := json.NewDecoder(unzipped).Decode(&record); err != nil {
			t.Fatal(err)
		}
		if !strings.EqualFold(record.System.ID, sys.ID()) {
			continue
		}
		taken, out := map[string]int{}, []recorded{}
		for _, c := range record.Cases {
			if len(c.Calls) == 1 && taken[c.Tab] < perTab {
				taken[c.Tab]++
				out = append(out, c)
			}
		}
		return out
	}
	t.Fatalf("no parity record for %s", sys.ID())
	return nil
}
