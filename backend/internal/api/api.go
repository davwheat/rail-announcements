// Package api is the service's HTTP surface: the live streams, the endpoint
// that renders a posted announcement, and the help point.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"rail-announcements-backend/internal/audio"
	"rail-announcements-backend/internal/helppoint"
	"rail-announcements-backend/internal/ketech"
	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/stream"
	"rail-announcements-backend/internal/system"
)

const (
	// firstSegments is how many segments a new stream must hold before its
	// playlist is served. A player starts three segments from the end of a
	// playlist (RFC 8216 section 6.3.3) and keeps that distance as its buffer.
	// Given fewer, it starts at the end, and for as long as it listens its
	// buffer is about one second, which is less than a mobile connection's
	// ordinary pauses.
	firstSegments    = 3
	firstSegmentWait = 15 * time.Second
	// maxTrim bounds the silence that a response can still have left to leave
	// out. A player that is further behind than this starts its stream again.
	maxTrim       = time.Minute
	maxStateBytes = 1 << 20
	renderTimeout = 60 * time.Second
)

type Logger interface {
	Warnf(format string, args ...any)
}

var (
	crsPattern      = regexp.MustCompile(`^[A-Z]{3}$`)
	listenerPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,64}$`)
	errEmpty        = errors.New("nothing to say")
)

type Server struct {
	streams *stream.Manager
	library *audio.Library
	board   *helppoint.Board
	origins origins
	log     Logger
}

func New(streams *stream.Manager, library *audio.Library, board *helppoint.Board, origins []string, log Logger) *Server {
	return &Server{streams: streams, library: library, board: board, origins: parseOrigins(origins), log: log}
}

func (s *Server) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(s.cors)
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "streams": s.streams.Count()})
	})
	r.Get("/v1/streams/live.m3u8", s.playlist)
	r.Get("/v1/streams/live.mp3", s.progressive)
	r.Post("/v1/streams/trim", s.trim)
	r.Get("/v1/streams/{key}/{segment}", s.segment)
	r.Get("/v1/systems", s.systems)
	r.Post("/v1/announcements", s.render)
	r.Get("/v1/help-points/{crs}", s.helpPoint)
	return r
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		switch {
		case s.origins.any:
			w.Header().Set("Access-Control-Allow-Origin", "*")
		case origin != "" && s.origins.allow(origin):
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]apiError{"error": {code, message}})
}

// stream finds or starts the stream a request describes. It answers the
// request itself, and returns nil, when there is none to give.
func (s *Server) stream(w http.ResponseWriter, r *http.Request) *stream.Stream {
	zone, err := stream.ParseZone(r.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_zone", err.Error())
		return nil
	}
	live, err := s.streams.Get(zone)
	if errors.Is(err, stream.ErrTooManyStreams) {
		w.Header().Set("Retry-After", "30")
		writeError(w, http.StatusServiceUnavailable, "too_many_streams", err.Error())
		return nil
	}
	return live
}

// progressive serves the stream as one response that never ends, the way
// internet radio does. A browser keeps such a response playing in a background
// tab with no script running, which a playlist that has to be polled cannot
// promise.
func (s *Server) progressive(w http.ResponseWriter, r *http.Request) {
	listener := r.URL.Query().Get("listener")
	if listener != "" && !listenerPattern.MatchString(listener) {
		writeError(w, http.StatusBadRequest, "bad_listener", "listener must be 8 to 64 letters, digits, hyphens or underscores")
		return
	}
	live := s.stream(w, r)
	if live == nil {
		return
	}
	if err := live.StartRadio(); err != nil {
		s.log.Warnf("Cannot start the MP3 encoder: %v", err)
		writeError(w, http.StatusInternalServerError, "render_failed", "the stream could not be encoded")
		return
	}
	// A player starts only once it holds a few seconds of audio, and it then stays
	// that far behind, because audio that arrives in real time never lets it catch
	// up. Opening with the recent past costs the same delay without the wait.
	recent, frames, stop := live.Radio.Listen(listener)
	defer stop()

	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	controller := http.NewResponseController(w)
	w.Write(recent)
	controller.Flush()
	// Well inside the shortest idle timeout that the configuration accepts, which
	// is ten seconds. At that same interval the stream stops under its listener.
	keepAlive := time.NewTicker(2 * time.Second)
	defer keepAlive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepAlive.C:
			live.Touch()
		case frame, open := <-frames:
			if !open {
				return
			}
			controller.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if _, err := w.Write(frame); err != nil {
				return
			}
			controller.Flush()
		}
	}
}

// trim leaves silence out of one listener's MP3 response. An endless response
// has no live edge, so a player that stalled is behind for good, and only the
// player knows by how much: the audio it has yet to play sits in network
// buffers that the service cannot see. The player says how much shorter its
// response should be in all, and the service leaves that much of the silence
// between announcements out of it. Nothing that was said is lost, and the
// player keeps its connection.
func (s *Server) trim(w http.ResponseWriter, r *http.Request) {
	zone, err := stream.ParseZone(r.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_zone", err.Error())
		return
	}
	total, err := strconv.ParseFloat(r.URL.Query().Get("total"), 64)
	if err != nil || !(total >= 0 && total <= (24*time.Hour).Seconds()) {
		writeError(w, http.StatusBadRequest, "bad_total", "total must be the seconds of silence to leave out of the response in all")
		return
	}
	// Looked up and never started: a stream that has gone has no response to trim.
	live := s.streams.Lookup(zone.Key())
	if live == nil {
		writeError(w, http.StatusNotFound, "no_listener", "no such stream is playing")
		return
	}
	trimmed, pending, ok := live.Trim(r.URL.Query().Get("listener"), time.Duration(total*float64(time.Second)), maxTrim)
	if !ok {
		writeError(w, http.StatusNotFound, "no_listener", "nobody is listening to the stream by that name")
		return
	}
	writeJSON(w, http.StatusOK, map[string]float64{"trimmed": trimmed.Seconds(), "pending": pending.Seconds()})
}

func (s *Server) playlist(w http.ResponseWriter, r *http.Request) {
	live := s.stream(w, r)
	if live == nil {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), firstSegmentWait)
	defer cancel()
	for {
		// Taken before the count: a segment cut between the two would otherwise
		// go unnoticed, and the listener would wait for the one after it.
		changed := live.Playlist.Changed()
		if live.Playlist.Len() >= firstSegments {
			break
		}
		select {
		case <-changed:
		case <-ctx.Done():
			w.Header().Set("Retry-After", "2")
			writeError(w, http.StatusServiceUnavailable, "stream_starting", "the stream has no audio yet")
			return
		}
	}

	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	w.Header().Set("Cache-Control", "no-store")
	io.WriteString(w, live.Playlist.Render(func(sequence int) string {
		// Relative to /v1/streams/live.m3u8. The station rides along so that a load
		// balancer can send a segment request to the replica that holds the stream:
		// it routes every stream request by its crs parameter.
		return fmt.Sprintf("%s/%d.aac?crs=%s", live.Key, sequence, live.Zone.CRS)
	}))
}

func (s *Server) segment(w http.ResponseWriter, r *http.Request) {
	live := s.streams.Lookup(chi.URLParam(r, "key"))
	sequence, err := strconv.Atoi(strings.TrimSuffix(chi.URLParam(r, "segment"), ".aac"))
	if live == nil || err != nil {
		writeError(w, http.StatusNotFound, "no_segment", "no such segment")
		return
	}
	live.Touch()
	segment, ok := live.Playlist.Segment(sequence)
	if !ok {
		writeError(w, http.StatusNotFound, "no_segment", "the segment has left the stream")
		return
	}
	w.Header().Set("Content-Type", "audio/aac")
	w.Header().Set("Cache-Control", "public, max-age=60, immutable")
	w.Header().Set("Content-Length", strconv.Itoa(len(segment.Data)))
	w.Write(segment.Data)
}

func (s *Server) systems(w http.ResponseWriter, _ *http.Request) {
	type entry struct {
		ID            string   `json:"id"`
		Name          string   `json:"name"`
		Announcements []string `json:"announcements"`
	}
	out := []entry{}
	for _, sys := range system.All {
		out = append(out, entry{sys.ID(), sys.Name(), sys.Announcements()})
	}
	writeJSON(w, http.StatusOK, map[string]any{"systems": out})
}

// render answers a posted tab state with the MP3 that tab would play, or with
// a JSON error.
func (s *Server) render(w http.ResponseWriter, r *http.Request) {
	var request struct {
		System       string          `json:"system"`
		Announcement string          `json:"announcement"`
		State        json.RawMessage `json:"state"`
	}
	body := http.MaxBytesReader(w, r.Body, maxStateBytes)
	if err := json.NewDecoder(body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "the body must be JSON with system, announcement and state")
		return
	}
	sys := system.ByID(request.System)
	if sys == nil {
		writeError(w, http.StatusNotFound, "unknown_system", fmt.Sprintf("no system %q", request.System))
		return
	}
	if !slices.Contains(sys.Announcements(), request.Announcement) {
		writeError(w, http.StatusNotFound, "unknown_announcement", fmt.Sprintf("%s has no announcement %q", sys.ID(), request.Announcement))
		return
	}
	announcement, err := sys.Plan(request.Announcement, request.State)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_state", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), renderTimeout)
	defer cancel()
	mp3, err := s.mp3(ctx, sys.FilePrefix(), announcement)
	switch {
	case err == nil:
		writeMP3(w, mp3)
	case errors.Is(err, audio.ErrMissing):
		writeError(w, http.StatusUnprocessableEntity, "missing_audio", err.Error())
	case errors.Is(err, errEmpty):
		writeError(w, http.StatusUnprocessableEntity, "empty_announcement", "the state describes nothing to say")
	case r.Context().Err() == nil:
		s.log.Warnf("Rendering %s %s failed: %v", sys.ID(), request.Announcement, err)
		writeError(w, http.StatusInternalServerError, "render_failed", "the announcement could not be rendered")
	}
}

// helpPoint answers with the station's departure board, spoken as an MP3. A
// help point that can't read the board says so, and that is an MP3 too: what
// plays the response has a listener and no screen.
func (s *Server) helpPoint(w http.ResponseWriter, r *http.Request) {
	crs := strings.ToUpper(chi.URLParam(r, "crs"))
	if !crsPattern.MatchString(crs) {
		writeError(w, http.StatusBadRequest, "bad_crs", "crs must be a three-letter station code")
		return
	}
	voice := ketech.Phil
	if id := r.URL.Query().Get("voice"); id != "" {
		if voice = ketech.Voices[id]; voice == nil {
			writeError(w, http.StatusBadRequest, "bad_voice", fmt.Sprintf("no voice %q", id))
			return
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), renderTimeout)
	defer cancel()

	services, err := s.board.Departures(ctx, crs, time.Now())
	if errors.Is(err, helppoint.ErrUnknownStation) {
		writeError(w, http.StatusNotFound, "unknown_station", fmt.Sprintf("no station %q", crs))
		return
	}
	announcement := helppoint.Unavailable()
	if err != nil {
		s.log.Warnf("Help point %s: %v", crs, err)
	} else {
		announcement = helppoint.Departures(voice, crs, services, func(id string) bool {
			return s.library.Exists(voice.FilePrefix, id)
		})
	}

	mp3, renderErr := s.mp3(ctx, voice.FilePrefix, announcement)
	if renderErr != nil && err == nil && ctx.Err() == nil {
		s.log.Warnf("Rendering help point %s failed: %v", crs, renderErr)
		mp3, renderErr = s.mp3(ctx, voice.FilePrefix, helppoint.Unavailable())
	}
	switch {
	case renderErr == nil:
		writeMP3(w, mp3)
	case r.Context().Err() == nil:
		s.log.Warnf("Rendering help point %s failed: %v", crs, renderErr)
		writeError(w, http.StatusInternalServerError, "render_failed", "the announcement could not be rendered")
	}
}

func (s *Server) mp3(ctx context.Context, prefix string, p plan.Plan) ([]byte, error) {
	pcm, err := s.library.Render(ctx, prefix, p)
	if err != nil {
		return nil, err
	}
	if len(pcm) == 0 {
		return nil, errEmpty
	}
	return s.library.EncodeMP3(ctx, pcm)
}

func writeMP3(w http.ResponseWriter, mp3 []byte) {
	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(mp3)))
	w.Write(mp3)
}
