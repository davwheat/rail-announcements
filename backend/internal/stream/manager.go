package stream

import (
	"context"
	"errors"
	"sync"
	"time"

	"rail-announcements-backend/internal/audio"
	"rail-announcements-backend/internal/hls"
)

// Options tune every stream a Manager starts.
type Options struct {
	FFmpeg          string
	BitrateKbps     int
	SegmentDuration time.Duration
	// Window is how many segments a playlist lists.
	Window int
	// IdleTimeout stops a stream this long after its last request.
	IdleTimeout time.Duration
	MaxStreams  int
}

// ErrTooManyStreams is returned when every stream slot is in use.
var ErrTooManyStreams = errors.New("too many streams are running")

// Manager starts a stream the first time its zone is asked for and stops it
// when nobody has asked for a while.
type Manager struct {
	feed     Feed
	renderer Renderer
	log      Logger
	options  Options
	ctx      context.Context

	mu      sync.Mutex
	streams map[string]*Stream
}

func NewManager(ctx context.Context, feed Feed, renderer Renderer, log Logger, options Options) *Manager {
	return &Manager{feed: feed, renderer: renderer, log: log, options: options, ctx: ctx, streams: map[string]*Stream{}}
}

// Count is the number of running streams.
func (m *Manager) Count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.streams)
}

// Lookup finds a running stream by key, for a segment request.
func (m *Manager) Lookup(key string) *Stream {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.streams[key]
}

// Get returns the zone's stream, starting it if it is not running.
func (m *Manager) Get(zone Zone) (*Stream, error) {
	key := zone.Key()
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.streams[key]; ok {
		s.Touch()
		return s, nil
	}
	if len(m.streams) >= m.options.MaxStreams {
		return nil, ErrTooManyStreams
	}
	s := &Stream{
		Zone:     zone,
		Key:      key,
		Playlist: hls.NewPlaylist(audio.SampleRate, m.options.SegmentDuration, m.options.Window, time.Now()),
		// Three seconds of frames lead a new radio listener in. The longest pause
		// inside an announcement is under a second, so two seconds of silence is
		// a gap between announcements.
		Radio:    hls.NewBroadcast(3*audio.SampleRate/hls.MP3SamplesPerFrame, 2*audio.SampleRate/hls.MP3SamplesPerFrame),
		renderer: m.renderer,
		log:      prefixed{m.log, "[" + zone.String() + "] "},
		now:      time.Now,
	}
	s.Touch()
	ctx, cancel := context.WithCancel(m.ctx)
	s.startRadio = func() (*hls.Encoder, error) {
		return hls.StartEncoder(ctx, m.options.FFmpeg, hls.MP3, audio.SampleRate, m.options.BitrateKbps)
	}
	m.streams[key] = s
	go m.serve(ctx, cancel, s)
	return s, nil
}

func (m *Manager) serve(ctx context.Context, cancel context.CancelFunc, s *Stream) {
	defer cancel()
	defer m.forget(s)

	defer s.Radio.Close()
	encoder, err := hls.StartEncoder(ctx, m.options.FFmpeg, hls.AAC, audio.SampleRate, m.options.BitrateKbps)
	if err != nil {
		s.log.Warnf("Cannot start the stream: %v", err)
		return
	}
	go func() {
		for frame := range encoder.Frames {
			s.Playlist.AddFrame(frame)
		}
	}()
	go func() {
		watch := time.NewTicker(time.Second)
		defer watch.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-watch.C:
				if s.idleFor() > m.options.IdleTimeout {
					s.log.Infof("Stopping: nobody has listened for %s", m.options.IdleTimeout)
					// Forgotten before it stops, so that a listener who arrives now gets a
					// fresh stream and not one that is shutting down.
					m.forget(s)
					cancel()
					return
				}
			}
		}
	}()

	subscription := m.feed.Subscribe(s.Zone.CRS)
	defer subscription.Close()
	s.log.Infof("Started stream %s", s.Key)
	if err := s.run(ctx, subscription.C, encoder); err != nil {
		s.log.Warnf("The stream failed: %v", err)
	}
	if err := encoder.Close(); err != nil && ctx.Err() == nil {
		s.log.Warnf("The encoder failed: %v", err)
	}
}

func (m *Manager) forget(s *Stream) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.streams[s.Key] == s {
		delete(m.streams, s.Key)
	}
}

type prefixed struct {
	Logger
	prefix string
}

func (p prefixed) Infof(format string, args ...any) { p.Logger.Infof(p.prefix+format, args...) }
func (p prefixed) Warnf(format string, args ...any) { p.Logger.Warnf(p.prefix+format, args...) }
