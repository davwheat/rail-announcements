package hls

import "sync"

// listenerBuffer is how many frames are held for a listener that is not reading,
// which is about 15 seconds. It has to exceed the longest burst the mixer writes
// after a stall, which is ten seconds: a smaller buffer fills during that burst
// and closes every listener, which is the loss the burst exists to prevent. The
// network buffers between here and the player hold more on top, so this bounds
// memory, not how far behind a player is. The website's player checks its own lag.
const listenerBuffer = 576

// Broadcast hands every frame to listeners who take the stream as one endless
// response, the way internet radio is served.
//
// A listener that has fallen behind can ask for silence to be left out of its
// own response, which brings it back to the present without losing anything
// that was said. See Trim.
type Broadcast struct {
	mu        sync.Mutex
	keep      int
	gap       int
	recent    [][]byte
	listeners map[*listener]struct{}
	named     map[string]*listener
	// quiet counts the silent frames in a row up to the latest one.
	quiet  int
	closed bool
}

type listener struct {
	id     string
	frames chan []byte
	// budget is how many more frames to leave out, and trimmed how many have
	// been left out.
	budget, trimmed int
	// held are silent frames that are neither sent nor left out yet.
	held [][]byte
}

// NewBroadcast keeps the last keep frames to open each new response with. A
// silence is one between announcements, and so can be left out, only once it
// has lasted gap frames: a pause inside an announcement is part of how it is
// said.
func NewBroadcast(keep, gap int) *Broadcast {
	return &Broadcast{keep: keep, gap: gap, listeners: map[*listener]struct{}{}, named: map[string]*listener{}}
}

func (b *Broadcast) Add(frame []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.recent = append(b.recent, frame)
	if extra := len(b.recent) - b.keep; extra > 0 {
		b.recent = b.recent[extra:]
	}
	if silentMP3Frame(frame) {
		b.quiet++
	} else {
		b.quiet = 0
	}
	spare, reach := b.quiet > b.gap, mp3Reach(frame)
	for l := range b.listeners {
		if !l.take(frame, spare, reach) {
			// This listener has stopped reading for longer than its buffer
			// lasts. Closing it frees the frames, and a player that is still
			// there reconnects at the live edge.
			b.drop(l)
		}
	}
}

// take sends the listener a frame, or keeps it back to leave out. It reports
// false when the listener has no room for it.
//
// A frame of speech can read its audio from the frames before it, so a silent
// frame is safe to leave out only once reach more silent frames have followed
// it. Until then it is held, and the frames still held when speech arrives go
// out ahead of the speech.
func (l *listener) take(frame []byte, spare bool, reach int) bool {
	if !spare || l.budget == 0 {
		for _, held := range l.held {
			if !l.send(held) {
				return false
			}
		}
		l.held = l.held[:0]
		return l.send(frame)
	}
	l.held = append(l.held, frame)
	if len(l.held) > reach {
		l.held = l.held[:copy(l.held, l.held[1:])]
		l.budget--
		l.trimmed++
	}
	return true
}

func (l *listener) send(frame []byte) bool {
	select {
	case l.frames <- frame:
		return true
	default:
		return false
	}
}

func (b *Broadcast) drop(l *listener) {
	if _, listening := b.listeners[l]; !listening {
		return
	}
	delete(b.listeners, l)
	if b.named[l.id] == l {
		delete(b.named, l.id)
	}
	close(l.frames)
}

// Listen returns the recent past, which leads seamlessly into the first frame
// delivered, and every frame from now on. The channel closes when the
// broadcast ends or the listener falls too far behind. Call stop when done.
//
// id names the listener for Trim. It can be empty, for a listener that will
// never ask.
func (b *Broadcast) Listen(id string) (recent []byte, frames <-chan []byte, stop func()) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, frame := range b.recent {
		recent = append(recent, frame...)
	}
	l := &listener{id: id, frames: make(chan []byte, listenerBuffer)}
	if b.closed {
		close(l.frames)
		return recent, l.frames, func() {}
	}
	b.listeners[l] = struct{}{}
	if id != "" {
		b.named[id] = l
	}
	return recent, l.frames, func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		b.drop(l)
	}
}

// Trim asks for total frames of the silence between announcements to be left
// out of one listener's response, counted from the response's start, with at
// most most of them still to come. It reports how many have been left out so
// far and how many are still to come, or false when nobody is listening by
// that name.
//
// The total is what makes asking twice harmless: a player that asks again
// before the silence has come asks for the same total, and adds nothing.
func (b *Broadcast) Trim(id string, total, most int) (trimmed, pending int, ok bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	l := b.named[id]
	if l == nil {
		return 0, 0, false
	}
	l.budget = min(most, max(0, total-l.trimmed))
	return l.trimmed, l.budget, true
}

// Close ends every listener's response. Call it when no more frames will come.
func (b *Broadcast) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.closed = true
	for l := range b.listeners {
		b.drop(l)
	}
}
