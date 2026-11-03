package stream

import (
	"context"
	"fmt"

	"rail-announcements-backend/internal/audio"
	"rail-announcements-backend/internal/feed"
	"rail-announcements-backend/internal/queue"
)

// Voices renders announcements in the KeTech voices from a clip library.
type Voices struct {
	Library *audio.Library
}

// Announce speaks the announcement once for each of the zone's platforms that
// it names, one after another, as the website does.
func (v Voices) Announce(ctx context.Context, zone Zone, a feed.Announcement) (audio.PCM, []string, error) {
	var out audio.PCM
	var notes []string
	train, kind := queue.DescribeMovement(a.Details), queue.Name(a.Type)
	for _, platform := range a.Platforms() {
		if platform == nil || *platform == "" {
			notes = append(notes, fmt.Sprintf("Skipping the %s for %s: no platform has been allocated", kind, train))
			continue
		}
		voice := zone.voiceFor(*platform)
		if voice == nil {
			continue
		}
		spoken, ok := voice.AudioPlatform(*platform)
		if !ok {
			notes = append(notes, fmt.Sprintf("Skipping the %s for %s: %s has no audio for platform %s", kind, train, voice.Name, *platform))
			continue
		}
		announcement, err := voice.Announce(a, zone.Preferences, spoken)
		if err != nil {
			return out, notes, err
		}
		notes = append(notes, fmt.Sprintf("Announcing the %s for %s on platform %s in %s", kind, train, *platform, voice.Name))
		pcm, err := v.Library.Render(ctx, voice.FilePrefix, announcement.Plan)
		if err != nil && announcement.Fallback != nil && ctx.Err() == nil {
			notes = append(notes, fmt.Sprintf("Announcing %s without its disruption reason: %v", a.MovementID, err))
			pcm, err = v.Library.Render(ctx, voice.FilePrefix, *announcement.Fallback)
		}
		if err != nil {
			return out, notes, err
		}
		out = append(out, pcm...)
	}
	return out, notes, nil
}
