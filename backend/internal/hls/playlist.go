package hls

import (
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"
)

// discontinuityNumbers bounds the discontinuity sequence number that tells one
// start of a stream from the next. hls.js walks an array as long as the number
// after every playlist reload, and a number in the billions holds its page up
// for good.
const discontinuityNumbers = 1 << 16

// Segment is one playlist entry's bytes and length.
type Segment struct {
	Sequence int
	Duration time.Duration
	Data     []byte
	Started  time.Time
}

// Playlist collects frames into segments and keeps the most recent ones.
type Playlist struct {
	sampleRate     int
	framesPerSeg   int
	window         int
	kept           int
	mu             sync.Mutex
	changed        chan struct{}
	segments       []Segment
	start          int
	next           int
	building       []byte
	buildingFrames int
}

// NewPlaylist cuts segments of about target, advertises the latest window of
// them, and keeps the ones that a client on a slow connection can still ask
// for.
//
// A stream that restarts keeps its URL, and a player that is still polling
// reads the new stream's playlist as the next version of the old one's. So a
// segment's sequence number, timestamp and date all come from one timeline
// that every stream shares: the time since the Unix epoch, cut into segments.
// Numbered or timed from its own start, a restarted stream's audio reads as
// audio that the player has already played. The player then stays silent until
// the new stream is as old as the one before it was, or plays what it still
// holds of the old stream again.
func NewPlaylist(sampleRate int, target time.Duration, window int, started time.Time) *Playlist {
	frames := max(1, int(math.Round(target.Seconds()*float64(sampleRate)/SamplesPerFrame)))
	p := &Playlist{
		sampleRate: sampleRate, framesPerSeg: frames, window: window, changed: make(chan struct{}),
		// RFC 8216 section 6.2.2: a segment stays available, after it leaves the
		// playlist, for its own length plus the length of the longest playlist
		// that listed it. A client that fetches slowly works from a playlist
		// that old.
		kept: 2*window + 1,
	}
	samples := started.Unix()*int64(sampleRate) + int64(started.Nanosecond())*int64(sampleRate)/int64(time.Second)
	p.start = int(samples / p.position(1))
	p.next = p.start
	return p
}

func (p *Playlist) frameDuration(frames int) time.Duration {
	return time.Duration(int64(frames) * SamplesPerFrame * int64(time.Second) / int64(p.sampleRate))
}

// position is where a segment starts on the shared timeline, in samples since
// the Unix epoch.
func (p *Playlist) position(sequence int) int64 {
	return int64(sequence) * int64(p.framesPerSeg) * SamplesPerFrame
}

func (p *Playlist) date(sequence int) time.Time {
	samples, rate := p.position(sequence), int64(p.sampleRate)
	return time.Unix(samples/rate, samples%rate*int64(time.Second)/rate)
}

// timestampTag is the ID3 tag that starts a packed audio segment. It carries
// the segment's first sample as a 33-bit MPEG-2 timestamp at 90 kHz.
func timestampTag(samples int64, sampleRate int) []byte {
	const owner = "com.apple.streaming.transportStreamTimestamp\x00"
	// Whole seconds apart from the rest: samples since the epoch, times 90,000,
	// is close to the largest value an int64 holds.
	rate := int64(sampleRate)
	pts := uint64(samples/rate*90000+samples%rate*90000/rate) & (1<<33 - 1)
	frame := make([]byte, 0, 10+len(owner)+8)
	frame = append(frame, "PRIV"...)
	frame = binary.BigEndian.AppendUint32(frame, uint32(len(owner)+8))
	frame = append(frame, 0, 0)
	frame = append(frame, owner...)
	frame = binary.BigEndian.AppendUint64(frame, pts)

	size := len(frame)
	tag := []byte{'I', 'D', '3', 4, 0, 0, byte(size >> 21 & 0x7F), byte(size >> 14 & 0x7F), byte(size >> 7 & 0x7F), byte(size & 0x7F)}
	return append(tag, frame...)
}

// AddFrame appends one encoded frame, completing a segment when it is due.
func (p *Playlist) AddFrame(frame []byte) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.buildingFrames == 0 {
		p.building = timestampTag(p.position(p.next), p.sampleRate)
	}
	p.building = append(p.building, frame...)
	p.buildingFrames++
	if p.buildingFrames < p.framesPerSeg {
		return
	}
	// Dated from its place on the timeline, not from the clock at each cut: the
	// encoder delivers frames in bursts, and a player lines segments up by these
	// dates.
	p.segments = append(p.segments, Segment{Sequence: p.next, Duration: p.frameDuration(p.buildingFrames), Data: p.building, Started: p.date(p.next)})
	p.next++
	p.building, p.buildingFrames = nil, 0
	if extra := len(p.segments) - p.kept; extra > 0 {
		p.segments = p.segments[extra:]
	}
	close(p.changed)
	p.changed = make(chan struct{})
}

// Changed returns a channel that closes when the next segment is complete.
func (p *Playlist) Changed() <-chan struct{} {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.changed
}

// Len is the number of segments a playlist would list now.
func (p *Playlist) Len() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return min(len(p.segments), p.window)
}

// Segment returns a segment that is still held.
func (p *Playlist) Segment(sequence int) (Segment, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, segment := range p.segments {
		if segment.Sequence == sequence {
			return segment, true
		}
	}
	return Segment{}, false
}

// Render writes the media playlist. uri names a segment by its sequence.
func (p *Playlist) Render(uri func(sequence int) string) string {
	p.mu.Lock()
	defer p.mu.Unlock()
	listed := p.segments[max(0, len(p.segments)-p.window):]
	target := p.frameDuration(p.framesPerSeg)
	var b strings.Builder
	b.WriteString("#EXTM3U\n#EXT-X-VERSION:3\n")
	fmt.Fprintf(&b, "#EXT-X-TARGETDURATION:%d\n", int(math.Ceil(target.Seconds())))
	first := p.next
	if len(listed) > 0 {
		first = listed[0].Sequence
	}
	fmt.Fprintf(&b, "#EXT-X-MEDIA-SEQUENCE:%d\n", first)
	// A restarted stream comes from a new encoder, which is a discontinuity for
	// a player that still holds the old stream's playlist, and a player knows
	// of one by this number having changed. Unaware, it takes the segments that
	// it missed for a gap in one continuous recording, plays the gap as
	// silence, and stays that far behind.
	fmt.Fprintf(&b, "#EXT-X-DISCONTINUITY-SEQUENCE:%d\n", p.start%discontinuityNumbers)
	for _, segment := range listed {
		fmt.Fprintf(&b, "#EXT-X-PROGRAM-DATE-TIME:%s\n", segment.Started.UTC().Format("2006-01-02T15:04:05.000Z"))
		fmt.Fprintf(&b, "#EXTINF:%.5f,\n%s\n", segment.Duration.Seconds(), uri(segment.Sequence))
	}
	return b.String()
}
