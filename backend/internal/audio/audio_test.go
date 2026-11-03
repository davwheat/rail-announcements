package audio

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"rail-announcements-backend/internal/plan"
)

// toneLibrary builds a library of generated tones, each named clip lasting the
// given number of milliseconds.
func toneLibrary(t *testing.T, clips map[string]int) *Library {
	t.Helper()
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg is not installed")
	}
	root := t.TempDir()
	for id, ms := range clips {
		path := filepath.Join(root, "voice", id+".mp3")
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		source := fmt.Sprintf("sine=frequency=440:sample_rate=16000:duration=%d.%03d", ms/1000, ms%1000)
		if out, err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", source, "-ac", "2", path).CombinedOutput(); err != nil {
			t.Fatalf("ffmpeg: %v: %s", err, out)
		}
	}
	library, err := NewLibrary(root, "", 64<<20)
	if err != nil {
		t.Fatal(err)
	}
	return library
}

func milliseconds(pcm PCM) int { return len(pcm) / bytesPerSample * 1000 / SampleRate }

func near(got, want int) bool { return got >= want-80 && got <= want+80 }

func TestSilenceRoundsUpLikeTheWebsite(t *testing.T) {
	for ms, samples := range map[int]int{0: 0, -5: 0, 1: 45, 50: 2205, 320: 14112, 1000: 44100} {
		if got := len(Silence(ms)) / bytesPerSample; got != samples {
			t.Errorf("%d ms is %d samples, want %d", ms, got, samples)
		}
	}
}

func TestRenderJoinsClipsWithTheirSilences(t *testing.T) {
	library := toneLibrary(t, map[string]int{"s/hello": 500, "station/m/KGX": 300})
	p := plan.Plan{
		StartDelay: 1000,
		Clips:      []plan.Clip{{ID: "s.hello"}, {ID: "station.m.KGX", Delay: 250}, {ID: "s.hello", Delay: 100}},
	}
	pcm, err := library.Render(context.Background(), "voice", p)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := milliseconds(pcm), 1000+500+250+300+100+500; !near(got, want) {
		t.Errorf("rendered %d ms, want about %d", got, want)
	}
	if len(pcm)%bytesPerSample != 0 {
		t.Error("rendered half a sample")
	}
	for i := 0; i < SampleRate*bytesPerSample*9/10; i++ {
		if pcm[i] != 0 {
			t.Fatalf("the start delay is not silent at byte %d", i)
		}
	}
}

func TestMissingClipsFollowTheListenersChoice(t *testing.T) {
	library := toneLibrary(t, map[string]int{"s/hello": 400, "station/m/KGX": 200})
	clips := []plan.Clip{{ID: "s.hello"}, {ID: "station.m.KGX"}, {ID: "station.m.NOPE", Delay: 300}, {ID: "e.nope", Delay: 300}}

	for mode, want := range map[plan.MissingAudioMode]int{
		plan.PlaySilence:       400 + 200,
		plan.RepeatLastStation: 400 + 200 + 300 + 200,
		plan.RepeatLast:        400 + 200 + 300 + 200 + 300 + 200,
	} {
		pcm, err := library.Render(context.Background(), "voice", plan.Plan{Clips: clips, MissingAudioMode: mode})
		if err != nil {
			t.Fatalf("%s: %v", mode, err)
		}
		if got := milliseconds(pcm); !near(got, want) {
			t.Errorf("%s rendered %d ms, want about %d", mode, got, want)
		}
	}

	_, err := library.Render(context.Background(), "voice", plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService})
	if !errors.Is(err, ErrMissing) {
		t.Errorf("skip-service gave %v, want a missing clip", err)
	}
}

func TestAMissingFirstClipTakesTheStartDelayWithIt(t *testing.T) {
	library := toneLibrary(t, map[string]int{"s/hello": 400})
	p := plan.Plan{StartDelay: 1000, MissingAudioMode: plan.PlaySilence, Clips: []plan.Clip{{ID: "s.nope"}, {ID: "s.hello"}}}
	pcm, err := library.Render(context.Background(), "voice", p)
	if err != nil {
		t.Fatal(err)
	}
	if got := milliseconds(pcm); !near(got, 400) {
		t.Errorf("rendered %d ms, want about 400", got)
	}
}

func TestClipsCannotLeaveTheLibrary(t *testing.T) {
	library := toneLibrary(t, map[string]int{"s/hello": 100})
	// An ID cannot climb, because its dots become directory separators.
	if path, err := library.Path("voice", "../../etc/passwd"); err != nil || !strings.HasPrefix(path, library.root) {
		t.Errorf("an ID resolved to %q, %v", path, err)
	}
	for _, clip := range []plan.Clip{{ID: "s.hello", Prefix: "../.."}, {ID: "s.hello", Prefix: "/etc"}} {
		if _, err := library.Render(context.Background(), "voice", plan.Plan{Clips: []plan.Clip{clip}}); err == nil || errors.Is(err, ErrMissing) {
			t.Errorf("%+v: got %v, want a refusal", clip, err)
		}
	}
}

func TestEncodeMP3WritesAPlayableFile(t *testing.T) {
	library := toneLibrary(t, map[string]int{"s/hello": 700})
	pcm, err := library.Render(context.Background(), "voice", plan.Plan{Clips: []plan.Clip{{ID: "s.hello"}}})
	if err != nil {
		t.Fatal(err)
	}
	mp3, err := library.EncodeMP3(context.Background(), pcm)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "out.mp3")
	if err := os.WriteFile(path, mp3, 0o644); err != nil {
		t.Fatal(err)
	}
	out, err := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=format_name,duration", "-of", "csv=p=0", path).CombinedOutput()
	if err != nil {
		t.Skipf("ffprobe: %v", err)
	}
	var format string
	var seconds float64
	if _, err := fmt.Sscanf(string(out), "mp3,%f", &seconds); err != nil {
		t.Fatalf("ffprobe said %q (%s)", out, format)
	}
	if seconds < 0.6 || seconds > 0.9 {
		t.Errorf("the MP3 lasts %.2fs, want about 0.7s", seconds)
	}
}
