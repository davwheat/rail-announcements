package paritytest

import (
	"errors"
	"io/fs"
	"os"
	"sort"
	"testing"

	"rail-announcements-backend/internal/audio"
	"rail-announcements-backend/internal/plan"
)

// audioDirectory is the website's audio, seen from a system's package.
const audioDirectory = "../../../../audio"

// Recordings collects the clips of the plans it's shown that have no
// recording. A plan that matches the website proves only that both name the
// same clip, and a clip that neither has recorded fails the whole announcement
// for a listener who skips services with missing audio.
type Recordings struct {
	library *audio.Library
	missing map[string]string
}

// OpenRecordings reads the audio directory at root. Without the directory, or
// without ffmpeg, which the library asks for, it returns nil: a nil Recordings
// checks nothing, so the parity tests still run.
func OpenRecordings(t *testing.T, root string) *Recordings {
	t.Helper()
	library, err := audio.NewLibrary(root, "", 0)
	if err != nil {
		t.Logf("recordings aren't checked: %v", err)
		return nil
	}
	return &Recordings{library: library, missing: map[string]string{}}
}

// Check looks for the recording of each clip. prefix is the voice's own
// directory, and label names the case in a failure.
func (r *Recordings) Check(t *testing.T, prefix, label string, clips []plan.Clip) {
	t.Helper()
	if r == nil {
		return
	}
	for _, clip := range clips {
		clipPrefix := prefix
		if clip.Prefix != "" {
			clipPrefix = clip.Prefix
		}
		path, err := r.library.Path(clipPrefix, clip.ID)
		if err != nil {
			t.Errorf("%s: %v", label, err)
			continue
		}
		if _, err := os.Stat(path); errors.Is(err, fs.ErrNotExist) {
			if _, seen := r.missing[clip.ID]; !seen {
				r.missing[clip.ID] = label
			}
		} else if err != nil {
			t.Errorf("%s: %v", label, err)
		}
	}
}

// Report fails for each clip that has no recording, and names the first case
// that plays it.
func (r *Recordings) Report(t *testing.T) {
	t.Helper()
	if r == nil {
		return
	}
	ids := make([]string, 0, len(r.missing))
	for id := range r.missing {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		t.Errorf("%s: plays %q, which has no recording", r.missing[id], id)
	}
}
