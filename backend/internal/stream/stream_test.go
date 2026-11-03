package stream

import (
	"context"
	"encoding/binary"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"rail-announcements-backend/internal/audio"
	"rail-announcements-backend/internal/feed"
	"rail-announcements-backend/internal/hls"
	"rail-announcements-backend/internal/ketech"
	"rail-announcements-backend/internal/queue"
)

type capture struct {
	mu     sync.Mutex
	loud   int
	silent int
	// doubled counts samples where two zones spoke at once.
	doubled int
}

func (c *capture) Write(pcm []byte) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for i := 0; i+1 < len(pcm); i += 2 {
		if pcm[i] != 0 || pcm[i+1] != 0 {
			c.loud++
			if int16(binary.LittleEndian.Uint16(pcm[i:])) == 2*spoken {
				c.doubled++
			}
		} else {
			c.silent++
		}
	}
	return len(pcm), nil
}

func (c *capture) counts() (loud, silent int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.loud, c.silent
}

// spoken is the sample value the fake renderer fills its speech with.
const spoken = 1000

type fakeRenderer struct {
	mu       sync.Mutex
	samples  int
	rendered []string
}

func (f *fakeRenderer) Announce(_ context.Context, _ Zone, a feed.Announcement) (audio.PCM, []string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rendered = append(f.rendered, a.EventID)
	pcm := make(audio.PCM, f.samples*2)
	for i := 0; i < len(pcm); i += 2 {
		binary.LittleEndian.PutUint16(pcm[i:], spoken)
	}
	return pcm, nil, nil
}

func (f *fakeRenderer) events() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.rendered...)
}

type quiet struct{ t *testing.T }

func (q quiet) Infof(format string, args ...any) { q.t.Logf(format, args...) }
func (q quiet) Warnf(format string, args ...any) { q.t.Logf(format, args...) }

// recorder keeps what the mixer warned about, which is the only trace a late
// or dropped block leaves.
type recorder struct {
	t        *testing.T
	warnings []string
}

func (r *recorder) Infof(format string, args ...any) { r.t.Logf(format, args...) }

func (r *recorder) Warnf(format string, args ...any) {
	r.warnings = append(r.warnings, fmt.Sprintf(format, args...))
	r.t.Logf("WARN "+format, args...)
}

func text(s string) *string { return &s }

func announcement(id string, kind feed.AnnouncementType, movement, platform string) *feed.Announcement {
	return &feed.Announcement{
		EventID:    id,
		MovementID: movement,
		Type:       kind,
		ExpiresAt:  feed.At(time.Now().Add(time.Minute)),
		Details:    feed.Movement{ID: movement, Platform: feed.Platform{Number: text(platform)}},
	}
}

func start(t *testing.T, query string, samples int) (chan any, *capture, *fakeRenderer) {
	t.Helper()
	values, err := url.ParseQuery(query)
	if err != nil {
		t.Fatal(err)
	}
	zone, err := ParseZone(values)
	if err != nil {
		t.Fatal(err)
	}
	renderer, output := &fakeRenderer{samples: samples}, &capture{}
	s := &Stream{Zone: zone, Key: zone.Key(), Playlist: hls.NewPlaylist(audio.SampleRate, time.Second, 3, time.Now()), renderer: renderer, log: quiet{t}, now: time.Now}
	messages := make(chan any, 16)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); s.run(ctx, messages, output) }()
	t.Cleanup(func() { cancel(); <-done })
	return messages, output, renderer
}

// mixerFor builds a mixer a test drives tick by tick, with the queue and the
// block filling run gives it. speak puts an announcement of that many samples
// on the air, as a finished render does.
func mixerFor(t *testing.T, epoch time.Time, log Logger) (*mixer, *capture, func(samples int)) {
	t.Helper()
	values, err := url.ParseQuery("crs=KGX&platform=1")
	if err != nil {
		t.Fatal(err)
	}
	zone, err := ParseZone(values)
	if err != nil {
		t.Fatal(err)
	}
	clock := func() time.Time { return epoch }
	output := &capture{}
	s := &Stream{Zone: zone, Key: zone.Key(), log: log, now: clock}
	var started []*queue.Playback
	q := queue.New(func(p *queue.Playback) { started = append(started, p) }, clock, s.lanes, func(string) {}, func(error) {})
	m := &mixer{stream: s, queue: q, begin: func() {}, encoder: output, epoch: epoch}

	speak := func(samples int) {
		t.Helper()
		q.Push(*announcement("speaking", feed.Next, "m1", "1"))
		if len(started) != 1 {
			t.Fatalf("the queue started %d announcements, want 1", len(started))
		}
		pcm := make(audio.PCM, samples*2)
		for i := 0; i < len(pcm); i += 2 {
			binary.LittleEndian.PutUint16(pcm[i:], spoken)
		}
		m.voices = append(m.voices, &speaking{started[0], pcm})
		started = nil
	}
	return m, output, speak
}

func TestALateTickWritesEveryDueSampleAndTheSpeechThatFillsThem(t *testing.T) {
	epoch := time.Now()
	log := &recorder{t: t}
	m, output, speak := mixerFor(t, epoch, log)
	speak(5 * audio.SampleRate)

	wrote, err := m.tick(epoch.Add(3 * time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if want := samplesFor(3 * time.Second); wrote != want {
		t.Errorf("a tick three seconds late wrote %d samples, want %d", wrote, want)
	}
	if loud, silent := output.counts(); int64(loud) != samplesFor(3*time.Second) || silent != 0 {
		t.Errorf("%d samples of speech and %d of silence: the announcement fills the whole block", loud, silent)
	}

	if _, err := m.tick(epoch.Add(5 * time.Second)); err != nil {
		t.Fatal(err)
	}
	if loud, _ := output.counts(); int64(loud) != samplesFor(5*time.Second) {
		t.Errorf("%d samples of speech in five seconds, want %d: the announcement kept its place", loud, samplesFor(5*time.Second))
	}
	if len(m.voices) != 0 {
		t.Error("the announcement did not finish when its audio ran out")
	}
	if len(log.warnings) != 1 || !strings.Contains(log.warnings[0], "late") {
		t.Errorf("warnings %q, want one saying how late the tick was", log.warnings)
	}
}

func TestAStallPastTheCatchUpBoundDropsAudioAndSaysSo(t *testing.T) {
	epoch := time.Now()
	log := &recorder{t: t}
	m, output, _ := mixerFor(t, epoch, log)

	wrote, err := m.tick(epoch.Add(30 * time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if want := samplesFor(maxCatchUp); wrote != want {
		t.Errorf("a tick 30 seconds late wrote %d samples, want the %s bound of %d", wrote, maxCatchUp, want)
	}
	if len(log.warnings) != 2 || !strings.Contains(log.warnings[1], "Dropping 20s of audio") {
		t.Errorf("warnings %q, want how late the tick was and how much audio went", log.warnings)
	}

	// The audio dropped counts as written, so the tick after it is due only its
	// own second, and the late warning holds off until lateInterval has passed.
	next, err := m.tick(epoch.Add(31 * time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if want := samplesFor(time.Second); next != want {
		t.Errorf("the tick after the drop wrote %d samples, want %d", next, want)
	}
	if len(log.warnings) != 2 {
		t.Errorf("warnings %q: the late warning comes at most once every %s", log.warnings, lateInterval)
	}
	if _, silent := output.counts(); int64(silent) != samplesFor(maxCatchUp)+samplesFor(time.Second) {
		t.Errorf("%d samples reached the encoder, want %d", silent, samplesFor(maxCatchUp)+samplesFor(time.Second))
	}
}

func TestOnTimeTicksWriteTheElapsedSamplesWithoutDrift(t *testing.T) {
	epoch := time.Now()
	log := &recorder{t: t}
	m, output, _ := mixerFor(t, epoch, log)

	// A ticker fires a little after its interval every time, which is what drift
	// would accumulate from.
	const ticks = 400
	const interval = mixInterval + 137*time.Microsecond
	var total int64
	for i := 1; i <= ticks; i++ {
		wrote, err := m.tick(epoch.Add(time.Duration(i) * interval))
		if err != nil {
			t.Fatal(err)
		}
		total += wrote
	}
	if want := samplesFor(ticks * interval); total != want {
		t.Errorf("%d samples over %s, want %d", total, time.Duration(ticks)*interval, want)
	}
	if _, silent := output.counts(); int64(silent) != total {
		t.Errorf("%d samples reached the encoder, want %d", silent, total)
	}
	if len(log.warnings) != 0 {
		t.Errorf("warnings %q: a tick on time is not worth reporting", log.warnings)
	}
}

func eventually(t *testing.T, what string, condition func() bool) {
	t.Helper()
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if condition() {
			return
		}
	}
	t.Fatalf("never happened: %s", what)
}

// deadChildren counts the processes that this one started, that have exited,
// and that nothing has waited for.
func deadChildren(t *testing.T) int {
	t.Helper()
	out, err := exec.Command("ps", "-axo", "ppid=,stat=").Output()
	if err != nil {
		t.Skipf("ps cannot list processes here: %v", err)
	}
	dead := 0
	for _, line := range strings.Split(string(out), "\n") {
		if fields := strings.Fields(line); len(fields) == 2 && fields[0] == strconv.Itoa(os.Getpid()) && strings.HasPrefix(fields[1], "Z") {
			dead++
		}
	}
	return dead
}

// A listener whose connection keeps dropping starts and stops streams all day,
// and so does one who changes a voice or a zone. Whatever a stopped stream
// leaves behind adds up until the service can start no more encoders.
func TestAStreamThatStopsLeavesNoEncoderBehind(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg is not installed")
	}
	hub, err := feed.NewHub("http://127.0.0.1:1", quiet{t})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	manager := NewManager(ctx, hub, &fakeRenderer{}, quiet{t}, Options{
		BitrateKbps: 64, SegmentDuration: time.Second, Window: 3, IdleTimeout: time.Hour, MaxStreams: 1,
	})
	values, _ := url.ParseQuery("crs=KGX")
	zone, err := ParseZone(values)
	if err != nil {
		t.Fatal(err)
	}
	live, err := manager.Get(zone)
	if err != nil {
		t.Fatal(err)
	}
	if err := live.StartRadio(); err != nil {
		t.Fatal(err)
	}
	_, frames, stop := live.Radio.Listen("")
	defer stop()
	select {
	case <-frames:
	case <-time.After(10 * time.Second):
		t.Fatal("the MP3 encoder produced nothing")
	}

	cancel()
	eventually(t, "the stream stops", func() bool { return manager.Count() == 0 })
	eventually(t, "both encoders are waited for", func() bool { return deadChildren(t) == 0 })
}

func TestAStreamPlaysItsZoneAndSilenceOtherwise(t *testing.T) {
	const samples = audio.SampleRate / 4
	messages, output, renderer := start(t, "crs=KGX&platform=1,2:celia&type=next,platform_alteration", samples)

	messages <- announcement("before-ready", feed.Next, "m0", "1")
	messages <- &feed.Ready{Healthy: true}
	messages <- announcement("elsewhere", feed.Next, "m1", "7")
	messages <- announcement("unwanted-type", feed.Standing, "m2", "1")
	messages <- announcement("unplaced", feed.Next, "m3", "")
	messages <- announcement("ours", feed.Next, "m4", "2F")

	eventually(t, "the announcement plays in full", func() bool { loud, _ := output.counts(); return loud == samples })
	eventually(t, "silence follows it", func() bool { _, silent := output.counts(); return silent > audio.SampleRate/10 })
	time.Sleep(200 * time.Millisecond)
	if loud, _ := output.counts(); loud != samples {
		t.Errorf("%d samples of speech were played, want %d", loud, samples)
	}
	if got := renderer.events(); len(got) != 1 || got[0] != "ours" {
		t.Errorf("rendered %v, want only the zone's own announcement", got)
	}
}

func TestAnAlterationToAnotherZoneCutsTheTrainShort(t *testing.T) {
	const samples = audio.SampleRate * 30
	messages, output, renderer := start(t, "crs=KGX&platform=1", samples)

	messages <- &feed.Ready{Healthy: true}
	messages <- announcement("next", feed.Next, "train", "1")
	eventually(t, "the announcement starts", func() bool { loud, _ := output.counts(); return loud > 0 })

	alteration := announcement("alteration", feed.PlatformAlteration, "train", "9")
	alteration.PreviousPlatform, alteration.NewPlatform = text("1"), text("9")
	messages <- alteration

	var stopped int
	eventually(t, "the announcement stops", func() bool {
		before, _ := output.counts()
		time.Sleep(150 * time.Millisecond)
		stopped, _ = output.counts()
		return before == stopped
	})
	if stopped >= samples {
		t.Error("the announcement ran to its end")
	}
	if got := renderer.events(); len(got) != 1 {
		t.Errorf("rendered %v: the alteration is for another zone's platform", got)
	}
}

func TestZonesOfOneStreamSpeakAtOnceAndPlatformsOfAZoneTakeTurns(t *testing.T) {
	const samples = audio.SampleRate / 2
	messages, output, renderer := start(t, "crs=KGX&zone=1,2&zone=3:celia", samples)

	messages <- &feed.Ready{Healthy: true}
	messages <- announcement("one", feed.Next, "m1", "1")
	messages <- announcement("two", feed.Next, "m2", "2")
	messages <- announcement("three", feed.Next, "m3", "3")

	eventually(t, "all three are rendered", func() bool { return len(renderer.events()) == 3 })
	eventually(t, "everything has been said", func() bool { _, silent := output.counts(); return silent > audio.SampleRate/5 })

	output.mu.Lock()
	loud, doubled := output.loud, output.doubled
	output.mu.Unlock()
	// Platform 3 speaks over platform 1, and platform 2 waits for platform 1. The two
	// zones start a render apart, so allow for that much of the overlap being missed.
	if doubled < samples*8/10 || doubled > samples {
		t.Errorf("%d samples were spoken by two zones at once, want about %d", doubled, samples)
	}
	if want := samples*3 - doubled; loud != want {
		t.Errorf("%d samples carried speech, want %d", loud, want)
	}
}

func TestAWarningForTwoZonesHoldsBothAsItDoesOnTheWebsite(t *testing.T) {
	const samples = audio.SampleRate / 2
	messages, output, renderer := start(t, "crs=KGX&zone=1&zone=3", samples)

	messages <- &feed.Ready{Healthy: true}
	warning := announcement("warning", feed.Passing, "fast", "")
	warning.AffectedPlatforms = []string{"1", "3"}
	messages <- warning
	messages <- announcement("three", feed.Next, "m3", "3")

	eventually(t, "both are rendered", func() bool { return len(renderer.events()) == 2 })
	eventually(t, "everything has been said", func() bool { _, silent := output.counts(); return silent > audio.SampleRate/5 })
	output.mu.Lock()
	defer output.mu.Unlock()
	if output.doubled != 0 || output.loud != 2*samples {
		t.Errorf("%d samples of speech with %d spoken over: platform 3 must wait for the warning", output.loud, output.doubled)
	}
}

func TestMixingHoldsAtFullScale(t *testing.T) {
	sample := func(v int16) []byte { return binary.LittleEndian.AppendUint16(nil, uint16(v)) }
	for _, c := range []struct{ a, b, want int16 }{{1000, 2000, 3000}, {30000, 30000, 32767}, {-30000, -30000, -32768}, {-5, 5, 0}} {
		block := sample(c.a)
		mix(block, sample(c.b))
		if got := int16(binary.LittleEndian.Uint16(block)); got != c.want {
			t.Errorf("%d + %d = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestAResetStopsTheSpeaker(t *testing.T) {
	messages, output, _ := start(t, "crs=KGX", audio.SampleRate*30)
	messages <- &feed.Ready{Healthy: true}
	messages <- announcement("next", feed.Next, "train", "4")
	eventually(t, "the announcement starts", func() bool { loud, _ := output.counts(); return loud > 0 })
	messages <- feed.Disconnected{}
	eventually(t, "the announcement stops", func() bool {
		before, _ := output.counts()
		time.Sleep(150 * time.Millisecond)
		after, _ := output.counts()
		return before == after
	})
}

func TestZonesParseAndShareKeys(t *testing.T) {
	parse := func(query string) (Zone, error) {
		values, _ := url.ParseQuery(query)
		return ParseZone(values)
	}
	a, err := parse("crs=kgx&platform=2:celia&platform=1&type=next,passing&chime=three")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := parse("chime=three&type=passing&type=next&platform=1:PHIL,2:AMEY_CELIA_V1&crs=KGX&voice=amey_phil_v1")
	if a.Key() != b.Key() {
		t.Errorf("equal zones have keys %s and %s", a.Key(), b.Key())
	}
	c, _ := parse("crs=KGX&platform=1,2&type=next,passing&chime=three")
	if a.Key() == c.Key() {
		t.Error("zones with different voices share a key")
	}
	if !a.Preferences.AnnounceViaPoints || a.Preferences.UseLegacyTocNames {
		t.Errorf("defaults are wrong: %+v", a.Preferences)
	}
	if a.voiceFor("2F").ID != "AMEY_CELIA_V1" || a.voiceFor("2b") != nil || a.voiceFor("1").ID != "AMEY_PHIL_V1" || a.voiceFor("3") != nil {
		t.Error("platforms do not map to their voices")
	}

	zoned, err := parse("crs=KGX&zone=3:celia&zone=2,1")
	if err != nil {
		t.Fatal(err)
	}
	reordered, _ := parse("crs=KGX&zone=1,2&zone=3:celia")
	if zoned.Key() != reordered.Key() || zoned.Key() == a.Key() {
		t.Error("zones must key by their membership, in any order")
	}
	if lane, ok := zoned.lane("2"); !ok || lane != "1" {
		t.Errorf("platform 2 is in lane %q %v, want the zone named for platform 1", lane, ok)
	}
	if lane, _ := zoned.lane("3"); lane != "3" {
		t.Errorf("platform 3 is in lane %q", lane)
	}
	if _, ok := zoned.lane("9"); ok {
		t.Error("platform 9 is in no zone")
	}

	// A station with no known platform list is asked for with every platform a voice can say.
	everything := "crs=ECR&zone="
	for _, platform := range ketech.Phil.Platforms {
		everything += platform + ":AMEY_PHIL_V1,"
	}
	if whole, err := parse(everything); err != nil || len(whole.Platforms) != len(ketech.Phil.Platforms) {
		t.Errorf("a zone of all %d platforms gave %d, %v", len(ketech.Phil.Platforms), len(whole.Platforms), err)
	}
	if byVoice, err := parse("crs=ECR&voice=AMEY_CELIA_V1"); err != nil || byVoice.voiceFor("7").ID != "AMEY_CELIA_V1" {
		t.Errorf("a whole station in one voice: %+v %v", byVoice, err)
	}

	for _, bad := range []string{"", "crs=KGX&zone=1&platform=2", "crs=KGX&zone=1,2&zone=2", "crs=KINGS", "crs=KGX&voice=anne", "crs=KGX&platform=1:anne", "crs=KGX&type=arriving", "crs=KGX&chime=five", "crs=KGX&vias=maybe", "crs=KGX&missing_audio=shrug"} {
		if _, err := parse(bad); err == nil {
			t.Errorf("%q was accepted", bad)
		}
	}
}

func TestPlatformKeyMatchesTheWebsite(t *testing.T) {
	for platform, key := range map[string]string{"1": "1", "10A": "10a", "3F": "3", "12d": "12d", "13A": "13", "B": "b", "0": "0", "24": "24"} {
		if got := PlatformKey(platform); got != key {
			t.Errorf("platform %s is %q, want %q", platform, got, key)
		}
	}
}
