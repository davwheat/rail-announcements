// Package plan describes an announcement as the clips that make it up, before
// any audio is read. It is what a voice produces and what the renderer plays,
// and it is the unit the parity tests compare with the website.
package plan

import "fmt"

type MissingAudioMode string

const (
	// SkipService fails the whole announcement when a clip is missing.
	SkipService MissingAudioMode = "skip-service"
	// PlaySilence leaves a missing clip out.
	PlaySilence MissingAudioMode = "play-silence"
	// RepeatLastStation stands the last station name in for a missing one.
	RepeatLastStation MissingAudioMode = "repeat-last-station"
	// RepeatLast stands the last clip of any kind in for a missing one.
	RepeatLast MissingAudioMode = "repeat-last"
)

func ParseMissingAudioMode(value string) (MissingAudioMode, error) {
	switch mode := MissingAudioMode(value); mode {
	case "":
		return SkipService, nil
	case SkipService, PlaySilence, RepeatLastStation, RepeatLast:
		return mode, nil
	}
	return "", fmt.Errorf("unknown missing audio mode %q", value)
}

// Clip is one recording, with the silence that leads into it.
type Clip struct {
	// ID names the recording with dots for directories: "station.m.KGX".
	ID string `json:"id"`
	// Delay is the silence before the clip, in milliseconds.
	Delay int `json:"delay"`
	// Prefix replaces the voice's own directory, for sounds the voices share.
	Prefix string `json:"prefix"`
}

type Plan struct {
	Clips []Clip `json:"clips"`
	// StartDelay is added to the first clip's delay, in milliseconds.
	StartDelay       int              `json:"startDelay"`
	MissingAudioMode MissingAudioMode `json:"missingAudioMode"`
}

// PluraliseOptions shapes a spoken list. A nil field was not given, which
// differs from zero: only a given delay replaces the one an item already has.
type PluraliseOptions struct {
	AndID           string
	Prefix          *string
	FinalPrefix     *string
	FirstItemDelay  *int
	BeforeItemDelay *int
	BeforeAndDelay  *int
	AfterAndDelay   *int
}

func Ptr[T any](v T) *T { return &v }

// IDs turns bare clip IDs into clips.
func IDs(ids ...string) []Clip {
	out := make([]Clip, len(ids))
	for i, id := range ids {
		out[i] = Clip{ID: id}
	}
	return out
}

// Pluralise joins items as "a, b and c", placing the "and" clip before the
// last item.
func Pluralise(items []Clip, o PluraliseOptions) []Clip {
	if o.AndID == "" {
		o.AndID = "and"
	}
	out := make([]Clip, 0, len(items)+1)
	for i, item := range items {
		if i == len(items)-1 {
			if o.FinalPrefix != nil {
				item.ID = *o.FinalPrefix + item.ID
			}
		} else if o.Prefix != nil {
			item.ID = *o.Prefix + item.ID
		}
		if i == 0 && o.FirstItemDelay != nil {
			item.Delay = *o.FirstItemDelay
		} else if o.BeforeItemDelay != nil {
			item.Delay = *o.BeforeItemDelay
		}
		out = append(out, item)
	}
	if len(out) < 2 {
		return out
	}
	and := Clip{ID: o.AndID}
	if o.BeforeAndDelay != nil {
		and.Delay = *o.BeforeAndDelay
	}
	last := out[len(out)-1]
	if o.AfterAndDelay != nil {
		last.Delay = *o.AfterAndDelay
	} else if o.BeforeItemDelay != nil {
		last.Delay = *o.BeforeItemDelay
	}
	return append(out[:len(out)-1], and, last)
}
