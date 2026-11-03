package stream

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"rail-announcements-backend/internal/audio"
	"rail-announcements-backend/internal/feed"
	"rail-announcements-backend/internal/hls"
	"rail-announcements-backend/internal/queue"
)

const (
	// mixInterval is how often audio is handed to the encoder. It bounds how
	// late an announcement starts, and is far below a segment's length.
	mixInterval   = 50 * time.Millisecond
	renderTimeout = 60 * time.Second

	// maxCatchUp bounds the audio one block carries after a late tick. An MP3
	// listener holds the three seconds its response opened with and a
	// constant-bit-rate stream never refills them, so audio the mixer skips
	// comes out of that cushion for the rest of the response. A stall this long
	// or shorter is written in full instead. Past the bound the clock jumped or
	// the host was suspended, and an hour of catch-up buys a listener nothing.
	maxCatchUp = 10 * time.Second
	// lateBlock is how much audio has to be due for a tick to be worth
	// reporting. A block is mixInterval long, and a few milliseconds over that
	// is a healthy host.
	lateBlock = 500 * time.Millisecond
	// lateInterval rate-limits the late warning. A host that ticks late once
	// ticks late again, and the log is read for the first one.
	lateInterval = 10 * time.Second
)

// Renderer produces the audio for one announcement in one zone.
type Renderer interface {
	// Announce returns the audio for the zone's platforms that the
	// announcement names, and what it has to say about each of them.
	Announce(ctx context.Context, zone Zone, a feed.Announcement) (audio.PCM, []string, error)
}

// Feed is where a stream hears its station's announcements.
type Feed interface {
	Subscribe(crs string) *feed.Subscription
}

// Encoder takes the mixed audio. *hls.Encoder is one.
type Encoder interface {
	Write(pcm []byte) (int, error)
}

type Logger interface {
	Infof(format string, args ...any)
	Warnf(format string, args ...any)
}

// Stream is one listener's continuous audio. It plays silence until its queue
// starts an announcement, and the sum of whatever its zones are saying after.
type Stream struct {
	Zone     Zone
	Key      string
	Playlist *hls.Playlist

	// Radio carries the same audio as MP3, for listeners who take it as one
	// endless response. Nothing feeds it until StartRadio is called.
	Radio      *hls.Broadcast
	radio      atomic.Pointer[hls.Encoder]
	startRadio func() (*hls.Encoder, error)
	radioOnce  sync.Once
	radioErr   error

	renderer Renderer
	log      Logger
	now      func() time.Time
	// lastRequest is when a listener last asked for anything, in Unix nanoseconds.
	lastRequest atomic.Int64
}

// StartRadio starts the MP3 encoder the first time anyone wants it. Most
// listeners take HLS, and a second encoder for each stream would be wasted on them.
func (s *Stream) StartRadio() error {
	s.radioOnce.Do(func() {
		encoder, err := s.startRadio()
		if err != nil {
			s.radioErr = err
			return
		}
		go func() {
			for frame := range encoder.Frames {
				s.Radio.Add(frame)
			}
			s.Radio.Close()
			// Nothing else waits for this encoder. Left unreaped, each stream
			// that stops leaves a dead ffmpeg process and its pipes behind.
			if err := encoder.Close(); err != nil {
				s.log.Warnf("The MP3 encoder failed: %v", err)
			}
		}()
		s.radio.Store(encoder)
	})
	return s.radioErr
}

// Trim asks for total of the silence between announcements to be left out of
// one listener's MP3 response, counted from the response's start, with at most
// most of it still to come. It reports how much has been left out so far and
// how much is still to come, or false when nobody is listening by that name.
func (s *Stream) Trim(listener string, total, most time.Duration) (trimmed, pending time.Duration, ok bool) {
	const frame = hls.MP3SamplesPerFrame * time.Second / audio.SampleRate
	done, left, ok := s.Radio.Trim(listener, int(total/frame), int(most/frame))
	return time.Duration(done) * frame, time.Duration(left) * frame, ok
}

// Touch records that a listener is still there.
func (s *Stream) Touch() { s.lastRequest.Store(s.now().UnixNano()) }

func (s *Stream) idleFor() time.Duration {
	return s.now().Sub(time.Unix(0, s.lastRequest.Load()))
}

type speaking struct {
	playback *queue.Playback
	pcm      audio.PCM
}

type rendered struct {
	playback *queue.Playback
	pcm      audio.PCM
	notes    []string
	err      error
}

// lanes lists the zones an announcement holds while it speaks. It is empty for
// an announcement that names none of this stream's platforms.
func (s *Stream) lanes(a feed.Announcement) []string {
	var out []string
	for _, platform := range a.Platforms() {
		if platform == nil || *platform == "" {
			continue
		}
		if lane, ok := s.Zone.lane(*platform); ok && !slices.Contains(out, lane) {
			out = append(out, lane)
		}
	}
	return out
}

// mix adds speech into block, which is 16-bit little-endian samples, holding
// at full scale where two zones together would wrap.
func mix(block, speech []byte) {
	for i := 0; i+1 < len(block) && i+1 < len(speech); i += 2 {
		sum := int32(int16(binary.LittleEndian.Uint16(block[i:]))) + int32(int16(binary.LittleEndian.Uint16(speech[i:])))
		binary.LittleEndian.PutUint16(block[i:], uint16(int16(max(math.MinInt16, min(math.MaxInt16, sum)))))
	}
}

// samplesFor is the number of samples that fill d.
func samplesFor(d time.Duration) int64 { return int64(d) * audio.SampleRate / int64(time.Second) }

// durationOf is how long n samples last.
func durationOf(n int64) time.Duration { return time.Duration(n) * time.Second / audio.SampleRate }

// mixer writes one block of audio for each tick. It holds everything a tick
// touches, which keeps run a loop around it and lets a test drive ticks from a
// clock of its own.
type mixer struct {
	stream  *Stream
	queue   *queue.Queue
	begin   func()
	encoder Encoder

	epoch   time.Time
	written int64
	voices  []*speaking
	// warned is when the late warning was last logged.
	warned time.Time
}

// tick writes the audio due at now: silence, plus whatever the stream's zones
// are saying. It reports how many samples that was.
func (m *mixer) tick(now time.Time) (int64, error) {
	due := samplesFor(now.Sub(m.epoch)) - m.written
	if due <= 0 {
		return 0, nil
	}
	if behind := durationOf(due); behind > lateBlock && now.Sub(m.warned) >= lateInterval {
		m.warned = now
		m.stream.log.Warnf("A mix tick was %s late: writing %s of audio in one block",
			(behind - mixInterval).Round(time.Millisecond), behind.Round(time.Millisecond))
	}
	if bound := samplesFor(maxCatchUp); due > bound {
		m.stream.log.Warnf("Dropping %s of audio: the mixer is %s behind real time, past the %s it catches up",
			durationOf(due-bound).Round(time.Millisecond), durationOf(due).Round(time.Millisecond), maxCatchUp)
		m.written += due - bound
		due = bound
	}

	block := make([]byte, due*2)
	m.fill(block)
	if _, err := m.encoder.Write(block); err != nil {
		return 0, fmt.Errorf("encoder: %w", err)
	}
	if radio := m.stream.radio.Load(); radio != nil {
		if _, err := radio.Write(block); err != nil {
			return 0, fmt.Errorf("radio encoder: %w", err)
		}
	}
	m.written += due
	return due, nil
}

// fill mixes the speaking announcements into block, each from where it left
// off, and hands the queue back the ones that end in it.
func (m *mixer) fill(block []byte) {
	finished := false
	m.voices = slices.DeleteFunc(m.voices, func(voice *speaking) bool {
		if voice.playback.Context().Err() != nil {
			return true
		}
		n := min(len(block), len(voice.pcm))
		mix(block, voice.pcm[:n])
		voice.pcm = voice.pcm[n:]
		if len(voice.pcm) > 0 {
			return false
		}
		m.queue.Finished(voice.playback, nil)
		finished = true
		return true
	})
	if finished {
		m.begin()
	}
}

// run mixes until ctx ends. Everything that touches the queue happens on this
// goroutine, which is what lets the queue go without locks.
func (s *Stream) run(ctx context.Context, messages <-chan any, encoder Encoder) error {
	var started []*queue.Playback
	renders := make(chan rendered)
	ready := false

	q := queue.New(
		func(p *queue.Playback) { started = append(started, p) },
		s.now,
		// An announcement for other platforms must be weighed, because it can cut
		// short or outdate one of this stream's. It occupies no lane, so it never
		// makes a zone wait.
		s.lanes,
		func(message string) { s.log.Infof("%s", message) },
		func(err error) { s.log.Warnf("Announcement skipped: %v", err) },
	)

	// begin deals with what the queue started during the call that just returned.
	// Finishing one announcement can start another, so it runs until none are left.
	begin := func() {
		for len(started) > 0 {
			playback := started[0]
			started = started[1:]
			if len(s.lanes(playback.Announcement)) == 0 {
				q.Finished(playback, nil)
				continue
			}
			go func() {
				renderCtx, cancel := context.WithTimeout(playback.Context(), renderTimeout)
				defer cancel()
				pcm, notes, err := s.renderer.Announce(renderCtx, s.Zone, playback.Announcement)
				select {
				case renders <- rendered{playback, pcm, notes, err}:
				case <-ctx.Done():
				}
			}()
		}
	}

	ticker := time.NewTicker(mixInterval)
	defer ticker.Stop()
	mixing := &mixer{stream: s, queue: q, begin: begin, encoder: encoder, epoch: s.now()}

	for {
		select {
		case <-ctx.Done():
			q.Reset()
			return nil

		case message, open := <-messages:
			if !open {
				return fmt.Errorf("the announcement feed closed")
			}
			switch m := message.(type) {
			case feed.Disconnected:
				ready = false
				q.Reset()
			case *feed.Ready:
				// Repeated whenever the service's health changes, and each one re-baselines it.
				q.Reset()
				ready = m.Healthy
				if ready {
					s.log.Infof("%s is live; announcements start from now", s.Zone.CRS)
				} else {
					s.log.Infof("%s is recovering; announcements are paused until the service catches up", s.Zone.CRS)
				}
			case *feed.Announcement:
				switch {
				case !ready:
					s.log.Infof("Ignoring a %s sent while the service is recovering", queue.Name(m.Type))
				case s.Zone.wants(m.Type):
					q.Push(*m)
				}
			case *feed.Retraction:
				if ready {
					q.Retract(m.EventID, m.Reason)
				}
			case *feed.Revision:
				if ready {
					q.Revise(m.EventID, m.Details)
				}
			}
			begin()

		case result := <-renders:
			for _, note := range result.notes {
				s.log.Infof("%s", note)
			}
			switch {
			case result.playback.Context().Err() != nil:
			case result.err != nil || !result.playback.Valid() || len(result.pcm) == 0:
				q.Finished(result.playback, result.err)
			default:
				mixing.voices = append(mixing.voices, &speaking{result.playback, result.pcm})
			}
			begin()

		case <-ticker.C:
			if _, err := mixing.tick(s.now()); err != nil {
				return err
			}
		}
	}
}
