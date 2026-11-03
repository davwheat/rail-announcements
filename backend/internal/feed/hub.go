package feed

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// idleTimeout matches the service's pong deadline. Heartbeats fill a quiet
	// station's silence, so silence this long is a dead connection.
	idleTimeout      = 75 * time.Second
	heartbeatSeconds = "30"
	connectTimeout   = 20 * time.Second
	maxFrameBytes    = 8_000_000
	subscriberBuffer = 1024
)

// Disconnected tells subscribers the stream dropped. Everything they hold is
// stale: the service starts again from "now" when the stream returns.
type Disconnected struct{}

// Logger is the part of the service's logger the feed uses.
type Logger interface {
	Infof(format string, args ...any)
	Warnf(format string, args ...any)
}

// Hub shares one upstream connection per station between every stream that
// listens to it.
type Hub struct {
	base string
	log  Logger

	mu       sync.Mutex
	stations map[string]*station
}

type station struct {
	crs         string
	cancel      context.CancelFunc
	subscribers map[*Subscription]struct{}
	// ready is the last health the service declared, replayed to a late subscriber.
	ready *Ready
}

// Subscription receives *Ready, *Announcement, *Retraction, *Revision and
// Disconnected values for one station.
type Subscription struct {
	C       <-chan any
	send    chan any
	hub     *Hub
	station *station
}

// NewHub reads announcements from the Darwin Browser instance at base, which
// is its HTTP or WebSocket URL.
func NewHub(base string, log Logger) (*Hub, error) {
	parsed, err := url.Parse(base)
	if err != nil {
		return nil, err
	}
	switch parsed.Scheme {
	case "http", "ws":
		parsed.Scheme = "ws"
	case "https", "wss":
		parsed.Scheme = "wss"
	default:
		return nil, errors.New("use an HTTP or WebSocket service URL")
	}
	parsed.Path = strings.TrimSuffix(parsed.Path, "/") + "/v1/announcements/live"
	parsed.RawQuery, parsed.Fragment = "", ""
	return &Hub{base: parsed.String(), log: log, stations: map[string]*station{}}, nil
}

func (h *Hub) Subscribe(crs string) *Subscription {
	h.mu.Lock()
	defer h.mu.Unlock()
	st, ok := h.stations[crs]
	if !ok {
		ctx, cancel := context.WithCancel(context.Background())
		st = &station{crs: crs, cancel: cancel, subscribers: map[*Subscription]struct{}{}}
		h.stations[crs] = st
		go h.run(ctx, st)
	}
	send := make(chan any, subscriberBuffer)
	sub := &Subscription{C: send, send: send, hub: h, station: st}
	st.subscribers[sub] = struct{}{}
	if st.ready != nil {
		ready := *st.ready
		send <- &ready
	}
	return sub
}

// Close stops delivery. The station's connection closes with its last subscriber.
func (s *Subscription) Close() {
	h := s.hub
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := s.station.subscribers[s]; !ok {
		return
	}
	delete(s.station.subscribers, s)
	if len(s.station.subscribers) == 0 {
		s.station.cancel()
		delete(h.stations, s.station.crs)
	}
}

func (h *Hub) publish(st *station, message any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	switch m := message.(type) {
	case *Ready:
		st.ready = m
	case Disconnected:
		st.ready = nil
	}
	for sub := range st.subscribers {
		select {
		case sub.send <- message:
		default:
			h.log.Warnf("A %s listener is not keeping up, so it missed a message", st.crs)
		}
	}
}

func (h *Hub) run(ctx context.Context, st *station) {
	for attempt := 0; ctx.Err() == nil; attempt++ {
		started := time.Now()
		err := h.connect(ctx, st)
		if ctx.Err() != nil {
			return
		}
		h.publish(st, Disconnected{})
		if time.Since(started) > time.Minute {
			attempt = 0
		}
		wait := min(time.Second<<min(attempt, 5), 30*time.Second)
		h.log.Warnf("The %s announcement stream dropped, retrying in %s: %v", st.crs, wait, err)
		select {
		case <-time.After(wait):
		case <-ctx.Done():
		}
	}
}

func (h *Hub) connect(ctx context.Context, st *station) error {
	query := url.Values{"crs": {st.crs}, "heartbeat": {heartbeatSeconds}}
	dialer := websocket.Dialer{HandshakeTimeout: connectTimeout, Proxy: http.ProxyFromEnvironment}
	conn, response, err := dialer.DialContext(ctx, h.base+"?"+query.Encode(), nil)
	if err != nil {
		if response != nil {
			return fmt.Errorf("%w (HTTP %d)", err, response.StatusCode)
		}
		return err
	}
	defer conn.Close()
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	defer stop()
	conn.SetReadLimit(maxFrameBytes)
	h.log.Infof("Subscribed to %s announcements", st.crs)

	for {
		conn.SetReadDeadline(time.Now().Add(idleTimeout))
		kind, frame, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		if kind != websocket.BinaryMessage {
			return errors.New("expected a binary stream message")
		}
		message, err := Decode(frame)
		if err != nil {
			return err
		}
		if err := validate(st.crs, message); err != nil {
			return err
		}
		switch message.(type) {
		case nil, *Heartbeat:
		default:
			h.publish(st, message)
		}
	}
}

func validate(crs string, message any) error {
	switch m := message.(type) {
	case *Ready:
		if m.Station.CRS == nil || *m.Station.CRS != crs {
			return errors.New("the stream is for another station")
		}
	case *Announcement:
		if m.Station.CRS == nil || *m.Station.CRS != crs {
			return errors.New("the stream is for another station")
		}
		if m.EventID == "" || m.MovementID != m.Details.ID {
			return errors.New("invalid announcement")
		}
	case *Retraction:
		if m.EventID == "" {
			return errors.New("invalid retraction")
		}
	case *Revision:
		if m.EventID == "" || m.MovementID != m.Details.ID {
			return errors.New("invalid revision")
		}
	}
	return nil
}
