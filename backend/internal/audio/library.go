// Package audio turns a plan into sound. It finds each clip's recording,
// decodes it, joins the clips with their silences, and encodes the result.
//
// Decoding and encoding run ffmpeg, which is what a browser uses to decode the
// same files. The website joins clips at 44.1 kHz and keeps only the first
// channel, and this package does the same so that both sound alike.
package audio

import (
	"bytes"
	"container/list"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

const (
	SampleRate     = 44100
	bytesPerSample = 2
)

// PCM is mono, 16-bit, little-endian audio at SampleRate.
type PCM []byte

// Silence returns the silence the website puts before a clip: the number of
// samples is rounded up, as its createSilence does.
func Silence(ms int) PCM {
	if ms <= 0 {
		return nil
	}
	samples := (ms*SampleRate + 999) / 1000
	return make(PCM, samples*bytesPerSample)
}

// ErrMissing reports a clip with no recording.
var ErrMissing = errors.New("audio file not found")

// Library reads recordings from a copy of the website's audio directory. It
// keeps decoded clips in memory, because a station says the same few hundred
// words all day.
type Library struct {
	root   string
	ffmpeg string
	budget int

	mu      sync.Mutex
	entries map[string]*list.Element
	recent  *list.List
	held    int
	flights map[string]*flight
}

type cached struct {
	path string
	pcm  PCM
}

type flight struct {
	done chan struct{}
	pcm  PCM
	err  error
}

// NewLibrary serves the audio directory at root, caching up to cacheBytes of
// decoded audio.
func NewLibrary(root, ffmpeg string, cacheBytes int) (*Library, error) {
	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("audio directory: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("audio directory %s is not a directory", root)
	}
	if ffmpeg == "" {
		ffmpeg = "ffmpeg"
	}
	if _, err := exec.LookPath(ffmpeg); err != nil {
		return nil, fmt.Errorf("ffmpeg: %w", err)
	}
	return &Library{root: root, ffmpeg: ffmpeg, budget: cacheBytes, entries: map[string]*list.Element{}, recent: list.New(), flights: map[string]*flight{}}, nil
}

// Path maps a clip to its file the way the website maps it to a URL: the dots
// of the ID are directories under the voice's prefix.
func (l *Library) Path(prefix, id string) (string, error) {
	relative := filepath.FromSlash(prefix + "/" + strings.ReplaceAll(id, ".", "/") + ".mp3")
	// A posted state chooses clip IDs, so an ID must not climb out of the library.
	if !filepath.IsLocal(relative) {
		return "", fmt.Errorf("clip %q is outside the audio directory", id)
	}
	return filepath.Join(l.root, relative), nil
}

// Exists reports whether a clip has a recording.
func (l *Library) Exists(prefix, id string) bool {
	path, err := l.Path(prefix, id)
	if err != nil {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// Clip returns a clip's decoded audio, or ErrMissing.
func (l *Library) Clip(ctx context.Context, prefix, id string) (PCM, error) {
	path, err := l.Path(prefix, id)
	if err != nil {
		return nil, err
	}

	l.mu.Lock()
	if element, ok := l.entries[path]; ok {
		l.recent.MoveToFront(element)
		l.mu.Unlock()
		return element.Value.(*cached).pcm, nil
	}
	if inFlight, ok := l.flights[path]; ok {
		l.mu.Unlock()
		select {
		case <-inFlight.done:
			return inFlight.pcm, inFlight.err
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	mine := &flight{done: make(chan struct{})}
	l.flights[path] = mine
	l.mu.Unlock()

	// The decode outlives a caller that gives up, because others may be waiting on it.
	mine.pcm, mine.err = l.decode(context.WithoutCancel(ctx), path)

	l.mu.Lock()
	delete(l.flights, path)
	if mine.err == nil {
		l.entries[path] = l.recent.PushFront(&cached{path, mine.pcm})
		l.held += len(mine.pcm)
		for l.held > l.budget && l.recent.Len() > 1 {
			oldest := l.recent.Remove(l.recent.Back()).(*cached)
			delete(l.entries, oldest.path)
			l.held -= len(oldest.pcm)
		}
	}
	l.mu.Unlock()
	close(mine.done)
	return mine.pcm, mine.err
}

func (l *Library) decode(ctx context.Context, path string) (PCM, error) {
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("%w: %s", ErrMissing, strings.TrimPrefix(path, l.root+string(filepath.Separator)))
		}
		return nil, err
	}
	var out, problems bytes.Buffer
	// The website keeps a stereo clip's first channel and discards the rest.
	cmd := exec.CommandContext(ctx, l.ffmpeg, "-v", "error", "-nostdin", "-i", path,
		"-map", "0:a:0", "-af", "pan=mono|c0=c0", "-ar", fmt.Sprint(SampleRate), "-f", "s16le", "-")
	cmd.Stdout, cmd.Stderr = &out, &problems
	failed := func(err error) error {
		return fmt.Errorf("decode %s: %w: %s", filepath.Base(path), err, strings.TrimSpace(problems.String()))
	}
	if err := cmd.Start(); err != nil {
		return nil, failed(err)
	}
	deprioritize(cmd)
	if err := cmd.Wait(); err != nil {
		return nil, failed(err)
	}
	return out.Bytes(), nil
}
