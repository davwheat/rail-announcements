// Package hls serves continuous audio as an HTTP Live Stream. An encoder turns
// PCM into AAC frames, and a playlist cuts the frames into segments.
//
// The segments are packed audio: raw ADTS frames behind an ID3 tag that gives
// the segment's timestamp, as RFC 8216 section 3.4 asks. That needs no
// container, so the only thing ffmpeg does here is encode.
package hls

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
)

// SamplesPerFrame is fixed by AAC-LC.
const SamplesPerFrame = 1024

// MP3SamplesPerFrame is fixed by MPEG-1 Layer III.
const MP3SamplesPerFrame = 1152

// Encoder is a running AAC encoder. Write PCM to it and read whole ADTS frames
// from Frames. Closing it ends the stream and closes Frames.
type Encoder struct {
	stdin    io.WriteCloser
	cmd      *exec.Cmd
	problems bytes.Buffer
	Frames   <-chan []byte
}

// Codec is what an Encoder produces.
type Codec int

const (
	// AAC is for HLS segments.
	AAC Codec = iota
	// MP3 is for an endless response. Its bit rate is constant, so silence
	// arrives as fast as speech. AAC spends about 500 bytes a second on
	// silence, and a browser waiting for enough bytes to recognise the format
	// would take minutes to start on a quiet station.
	MP3
)

// StartEncoder starts ffmpeg encoding mono 16-bit PCM at sampleRate.
func StartEncoder(ctx context.Context, ffmpeg string, codec Codec, sampleRate, bitrateKbps int) (*Encoder, error) {
	if ffmpeg == "" {
		ffmpeg = "ffmpeg"
	}
	output, readFrame := []string{"-c:a", "aac", "-f", "adts"}, readADTSFrame
	if codec == MP3 {
		// No tags: the stream is joined part way through, where a tag is noise.
		output, readFrame = []string{"-c:a", "libmp3lame", "-write_xing", "0", "-id3v2_version", "0", "-f", "mp3"}, readMP3Frame
	}
	args := []string{"-v", "error", "-nostdin",
		"-f", "s16le", "-ar", fmt.Sprint(sampleRate), "-ac", "1", "-i", "-",
		"-b:a", fmt.Sprintf("%dk", bitrateKbps),
		// Without these ffmpeg holds frames back, and a live stream starves.
		"-flush_packets", "1", "-fflags", "+flush_packets"}
	cmd := exec.CommandContext(ctx, ffmpeg, append(append(args, output...), "-")...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	frames := make(chan []byte, 64)
	e := &Encoder{stdin: stdin, cmd: cmd, Frames: frames}
	cmd.Stderr = &e.problems
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start ffmpeg: %w", err)
	}
	go func() {
		defer close(frames)
		reader := bufio.NewReaderSize(stdout, 1<<16)
		for {
			frame, err := readFrame(reader)
			if err != nil {
				return
			}
			select {
			case frames <- frame:
			case <-ctx.Done():
				return
			}
		}
	}()
	return e, nil
}

func (e *Encoder) Write(pcm []byte) (int, error) { return e.stdin.Write(pcm) }

// Close stops the encoder and reports anything ffmpeg complained about.
func (e *Encoder) Close() error {
	e.stdin.Close()
	err := e.cmd.Wait()
	if problems := strings.TrimSpace(e.problems.String()); problems != "" {
		return fmt.Errorf("ffmpeg: %s", problems)
	}
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		return nil
	}
	return err
}

// readADTSFrame reads one frame, header included. The frame's length is the
// 13 bits that straddle bytes 3 to 5 of its header.
func readADTSFrame(r *bufio.Reader) ([]byte, error) {
	header := make([]byte, 7)
	if _, err := io.ReadFull(r, header); err != nil {
		return nil, err
	}
	if header[0] != 0xFF || header[1]&0xF0 != 0xF0 {
		return nil, errors.New("lost ADTS frame sync")
	}
	length := int(header[3]&0x03)<<11 | int(header[4])<<3 | int(header[5])>>5
	if length < len(header) {
		return nil, errors.New("impossible ADTS frame length")
	}
	frame := make([]byte, length)
	copy(frame, header)
	_, err := io.ReadFull(r, frame[len(header):])
	return frame, err
}

var (
	mp3Bitrates    = [16]int{0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0}
	mp3SampleRates = [4]int{44100, 48000, 32000, 0}
)

// readMP3Frame reads one MPEG-1 Layer III frame, which is all the encoder is
// asked for. A frame is 144 × bit rate ÷ sample rate bytes, plus a padding byte
// when its header says so.
func readMP3Frame(r *bufio.Reader) ([]byte, error) {
	header := make([]byte, 4)
	if _, err := io.ReadFull(r, header); err != nil {
		return nil, err
	}
	if header[0] != 0xFF || header[1]&0xFE != 0xFA {
		return nil, errors.New("lost MP3 frame sync")
	}
	bitrate, sampleRate := mp3Bitrates[header[2]>>4], mp3SampleRates[header[2]>>2&3]
	if bitrate == 0 || sampleRate == 0 {
		return nil, errors.New("impossible MP3 frame header")
	}
	frame := make([]byte, 144000*bitrate/sampleRate+int(header[2]>>1&1))
	copy(frame, header)
	_, err := io.ReadFull(r, frame[len(header):])
	return frame, err
}

// mp3SideInfo finds a mono frame's side information, which follows the header
// and the checksum that the header can announce. It reports false for anything
// else, a stereo frame included: the encoder is only ever asked for mono.
func mp3SideInfo(frame []byte) (side []byte, start int, ok bool) {
	const header, sideInfo = 4, 17
	if len(frame) < header || frame[0] != 0xFF || frame[1]&0xFE != 0xFA || frame[3]>>6 != 3 {
		return nil, 0, false
	}
	start = header
	if frame[1]&1 == 0 {
		start += 2
	}
	if len(frame) < start+sideInfo {
		return nil, 0, false
	}
	return frame[start : start+sideInfo], start + sideInfo, true
}

// silentMP3Frame reports whether a frame holds no audio at all, which is how
// the encoder writes digital silence: neither granule has any data to read.
// A granule's part2_3_length is 12 bits, at bit 18 for the first granule and
// 59 bits on for the second.
func silentMP3Frame(frame []byte) bool {
	side, _, ok := mp3SideInfo(frame)
	if !ok {
		return false
	}
	length := func(bit int) int {
		value := 0
		for i := bit; i < bit+12; i++ {
			value = value<<1 | int(side[i/8]>>(7-i%8)&1)
		}
		return value
	}
	return length(18) == 0 && length(18+59) == 0
}

// mp3Reach is how many frames back a frame like this one can read its audio
// from. Layer III lets a frame keep its data in the room that earlier frames
// left spare, up to 511 bytes before its own.
func mp3Reach(frame []byte) int {
	const reservoir = 511
	_, data, ok := mp3SideInfo(frame)
	if !ok || len(frame) <= data {
		return reservoir
	}
	room := len(frame) - data
	return (reservoir + room - 1) / room
}
