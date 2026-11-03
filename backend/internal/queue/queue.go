// Package queue decides which announcement speaks next. It is a port of the
// website's PlaybackQueue, and the parity test replays the website's own
// traces against it.
//
// A Queue is not safe for concurrent use. Its owner calls it from one
// goroutine, and hands [Queue.Finished] back on that goroutine too.
package queue

import (
	"context"
	"fmt"
	"slices"
	"time"

	"rail-announcements-backend/internal/feed"
)

var stages = map[feed.AnnouncementType]int{feed.Next: 1, feed.Approaching: 2, feed.Standing: 3}

const (
	bound       = 64
	memoryBound = 2048
)

// Playback is one announcement that has been told to start.
type Playback struct {
	Announcement feed.Announcement
	ctx          context.Context
	cancel       context.CancelFunc
	queue        *Queue
	session      int
	lanes        []string
	done         bool
}

// Context is cancelled when the announcement must stop: it was cut short, or
// the queue was reset.
func (p *Playback) Context() context.Context { return p.ctx }

// Valid reports whether the announcement is still worth starting or continuing.
func (p *Playback) Valid() bool {
	return p.ctx.Err() == nil && p.queue.unexpired(p.Announcement)
}

type Queue struct {
	start   func(*Playback)
	now     func() time.Time
	lanes   func(feed.Announcement) []string
	log     func(string)
	onError func(error)

	pending []feed.Announcement
	seen    *memory[struct{}]
	// reached is the furthest stage each movement has been announced at, so a
	// disruption can be weighed against what the station already knows.
	reached *memory[int]
	playing map[string]bool
	active  []*Playback
	session int
}

// New returns a queue that calls start for each announcement whose turn has
// come. start must not block: it begins the audio and returns, and the owner
// calls Finished when the audio ends. Announcements that share a lane take
// turns, and a nil lanes keeps everything in one lane.
func New(start func(*Playback), now func() time.Time, lanes func(feed.Announcement) []string, log func(string), onError func(error)) *Queue {
	if lanes == nil {
		lanes = func(feed.Announcement) []string { return []string{""} }
	}
	return &Queue{
		start: start, now: now, lanes: lanes, log: log, onError: onError,
		seen: newMemory[struct{}](memoryBound), reached: newMemory[int](memoryBound), playing: map[string]bool{},
	}
}

func (q *Queue) unexpired(a feed.Announcement) bool {
	return a.ExpiresAt.Valid && a.ExpiresAt.Time.After(q.now())
}

// Reset forgets everything and stops what is speaking. The feed calls for it
// whenever it re-baselines.
func (q *Queue) Reset() {
	waiting, inProgress := len(q.pending), len(q.active)
	q.session++
	for _, playback := range q.active {
		playback.done = true
		playback.cancel()
	}
	q.pending, q.active = nil, nil
	q.seen, q.reached = newMemory[struct{}](memoryBound), newMemory[int](memoryBound)
	q.playing = map[string]bool{}
	if waiting > 0 || inProgress > 0 {
		q.log(fmt.Sprintf("Cleared the queue: %d waiting, %d part way through", waiting, inProgress))
	}
}

// Retract discards an announcement that is still waiting. One already speaking
// finishes, because a half-spoken announcement is heard as a broken station
// rather than as a correction.
func (q *Queue) Retract(eventID, reason string) {
	because := ""
	if reason != "" {
		because = " (" + reason + ")"
	}
	queued := slices.IndexFunc(q.pending, func(a feed.Announcement) bool { return a.EventID == eventID })
	active := slices.IndexFunc(q.active, func(p *Playback) bool { return p.Announcement.EventID == eventID })
	if queued != -1 {
		q.log("Withdrawn" + because + ": " + Describe(q.pending[queued]))
		q.pending = slices.DeleteFunc(q.pending, func(a feed.Announcement) bool { return a.EventID == eventID })
	}
	if active != -1 {
		q.log("Withdrawn too late to stop, so it finishes" + because + ": " + Describe(q.active[active].Announcement))
	}
	// A withdrawal for something already spoken is routine. One for an event that never arrived is not.
	if queued == -1 && active == -1 && !q.seen.has(eventID) {
		q.log("Withdrawal for an announcement that never arrived" + because)
	}
}

// Revise replaces the details of an announcement still waiting its turn, so
// that it speaks the current time and not the one that triggered it.
func (q *Queue) Revise(eventID string, details feed.Movement) {
	for i := range q.pending {
		if q.pending[i].EventID == eventID {
			q.pending[i].Details = details
			q.log("Revised while queued: " + Describe(q.pending[i]))
		}
	}
}

func (q *Queue) Push(a feed.Announcement) {
	if q.seen.has(a.EventID) {
		q.log("Repeat ignored: " + Describe(a))
		return
	}
	if !q.unexpired(a) {
		q.log("Expired on arrival: " + Describe(a))
		return
	}

	stage := stages[a.Type]
	reached, _ := q.reached.get(a.MovementID)
	// A train announced as approaching is seconds from its platform. Its delay
	// stopped being news when the station was told to stand back from it.
	if a.Type == feed.Disrupted && reached >= stages[feed.Approaching] {
		q.log("Not announcing the delay to " + DescribeMovement(a.Details) + ": it has already been announced as approaching")
		return
	}

	q.seen.set(a.EventID, struct{}{})
	if stage > reached {
		q.reached.set(a.MovementID, stage)
	}

	q.pending = slices.DeleteFunc(q.pending, func(previous feed.Announcement) bool {
		if previous.MovementID != a.MovementID {
			return false
		}
		previousStage, staged := stages[previous.Type]
		keep := !staged || stage <= previousStage
		if a.Details.Cancelled {
			keep = !staged
		}
		if !keep {
			q.log("Superseded by the " + Name(a.Type) + ": " + Describe(previous))
		}
		return !keep
	})
	if len(q.pending) >= bound {
		q.log(fmt.Sprintf("Queue is full at %d, so the oldest was dropped: %s", bound, Describe(q.pending[0])))
		q.pending = q.pending[1:]
	}
	q.pending = append(q.pending, a)
	switch ahead := len(q.pending) - 1; ahead {
	case 0:
		q.log("Queued: " + Describe(a))
	case 1:
		q.log("Queued behind 1 other: " + Describe(a))
	default:
		q.log(fmt.Sprintf("Queued behind %d others: %s", ahead, Describe(a)))
	}
	q.interrupt(a)
	q.drain()
}

// supersedesSpeaking picks out the only two announcements worth cutting a
// speaking one short for. Everything else waits its turn.
func supersedesSpeaking(incoming, speaking feed.Announcement) bool {
	// The platform being spoken is now the wrong one, so finishing it sends people there.
	if incoming.Type == feed.PlatformAlteration {
		return incoming.MovementID == speaking.MovementID
	}
	// Standing back from a train that is seconds away outranks the delay the platform is hearing about.
	if incoming.Type == feed.Passing && speaking.Type == feed.Disrupted {
		warned := platformsOf(incoming)
		return slices.ContainsFunc(platformsOf(speaking), func(platform string) bool { return slices.Contains(warned, platform) })
	}
	return false
}

func (q *Queue) interrupt(a feed.Announcement) {
	for _, playback := range slices.Clone(q.active) {
		if !supersedesSpeaking(a, playback.Announcement) {
			continue
		}
		q.log("Cut short by the " + Name(a.Type) + ": " + Describe(playback.Announcement))
		playback.cancel()
		q.release(playback)
	}
}

func (q *Queue) release(p *Playback) {
	p.done = true
	q.active = slices.DeleteFunc(q.active, func(other *Playback) bool { return other == p })
	for _, lane := range p.lanes {
		delete(q.playing, lane)
	}
}

// Finished reports that a playback's audio ended, or failed with err. It is a
// no-op for a playback the queue already stopped.
func (q *Queue) Finished(p *Playback, err error) {
	if p.done || p.session != q.session {
		return
	}
	if err != nil {
		q.onError(err)
	}
	q.release(p)
	p.cancel()
	q.log("Finished: " + Describe(p.Announcement))
	q.drain()
}

// drain starts everything whose lanes are free, leaving the rest in order.
func (q *Queue) drain() {
	for index := 0; index < len(q.pending); index++ {
		a := q.pending[index]
		lanes := q.lanes(a)
		if slices.ContainsFunc(lanes, func(lane string) bool { return q.playing[lane] }) {
			continue
		}
		q.pending = slices.Delete(q.pending, index, index+1)
		index--
		if !q.unexpired(a) {
			q.log("Expired while it waited its turn: " + Describe(a))
			continue
		}
		for _, lane := range lanes {
			q.playing[lane] = true
		}
		ctx, cancel := context.WithCancel(context.Background())
		playback := &Playback{Announcement: a, ctx: ctx, cancel: cancel, queue: q, session: q.session, lanes: lanes}
		q.active = append(q.active, playback)
		q.start(playback)
	}
}

// memory remembers a bounded number of keys, forgetting the oldest first.
type memory[V any] struct {
	bound  int
	values map[string]V
	order  []string
}

func newMemory[V any](bound int) *memory[V] {
	return &memory[V]{bound: bound, values: map[string]V{}}
}

func (m *memory[V]) has(key string) bool { _, ok := m.values[key]; return ok }

func (m *memory[V]) get(key string) (V, bool) { v, ok := m.values[key]; return v, ok }

func (m *memory[V]) set(key string, value V) {
	if _, ok := m.values[key]; !ok {
		m.order = append(m.order, key)
	}
	m.values[key] = value
	if len(m.order) > m.bound {
		delete(m.values, m.order[0])
		m.order = m.order[1:]
	}
}
