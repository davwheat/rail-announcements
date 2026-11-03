package audio

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"

	"rail-announcements-backend/internal/plan"
)

// decodeWorkers bounds the ffmpeg processes one announcement starts at once.
// The first announcement on a cold service decodes dozens of clips, and they
// run beside a stream's two real-time encoders on a host with few cores: a
// wider decode starves the encoders, and audio a listener never receives is
// audio lost, while a decode that waits only starts an announcement later.
const decodeWorkers = 3

// Render joins a plan's clips into one piece of audio. prefix is the voice's
// own directory, which a clip's Prefix overrides.
func (l *Library) Render(ctx context.Context, prefix string, p plan.Plan) (PCM, error) {
	clips := append([]plan.Clip(nil), p.Clips...)
	if len(clips) == 0 {
		return nil, nil
	}
	// The website folds the start delay into the first clip before it looks for
	// any audio, so a first clip that is missing takes the delay with it.
	clips[0].Delay += p.StartDelay

	decoded := make([]PCM, len(clips))
	failures := make([]error, len(clips))
	var wg sync.WaitGroup
	slots := make(chan struct{}, decodeWorkers)
	for i, clip := range clips {
		wg.Add(1)
		go func() {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			clipPrefix := prefix
			if clip.Prefix != "" {
				clipPrefix = clip.Prefix
			}
			decoded[i], failures[i] = l.Clip(ctx, clipPrefix, clip.ID)
		}()
	}
	wg.Wait()

	var out bytes.Buffer
	var last, lastStation PCM
	for i, clip := range clips {
		pcm := decoded[i]
		station := strings.HasPrefix(clip.ID, "station.")
		switch err := failures[i]; {
		case err == nil:
			last = pcm
			if station {
				lastStation = pcm
			}
		case !errors.Is(err, ErrMissing) || p.MissingAudioMode == plan.SkipService || p.MissingAudioMode == "":
			return nil, err
		case p.MissingAudioMode == plan.RepeatLast:
			pcm = last
		case p.MissingAudioMode == plan.RepeatLastStation && station:
			pcm = lastStation
		default:
			pcm = nil
		}
		// A clip left out takes the silence before it too.
		if pcm == nil {
			continue
		}
		out.Write(Silence(clip.Delay))
		out.Write(pcm)
	}
	return out.Bytes(), nil
}

// EncodeMP3 encodes audio as a complete MP3 file.
func (l *Library) EncodeMP3(ctx context.Context, pcm PCM) ([]byte, error) {
	// ffmpeg writes the Xing header, which holds the duration and seek table,
	// by seeking back once it has finished. A pipe cannot seek, so use a file.
	file, err := os.CreateTemp("", "announcement-*.mp3")
	if err != nil {
		return nil, err
	}
	file.Close()
	defer os.Remove(file.Name())

	var problems bytes.Buffer
	cmd := exec.CommandContext(ctx, l.ffmpeg, "-v", "error", "-nostdin", "-y",
		"-f", "s16le", "-ar", fmt.Sprint(SampleRate), "-ac", "1", "-i", "-",
		"-c:a", "libmp3lame", "-b:a", "64k", "-f", "mp3", file.Name())
	cmd.Stdin, cmd.Stderr = bytes.NewReader(pcm), &problems
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("encode mp3: %w: %s", err, strings.TrimSpace(problems.String()))
	}
	return os.ReadFile(file.Name())
}
