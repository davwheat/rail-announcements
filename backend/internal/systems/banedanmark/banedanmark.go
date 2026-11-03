// Package banedanmark ports the website's Banedanmark Stations (Denmark)
// system (BANEDANMARK_V1). The website is the reference: change
// src/announcement-data/systems/international/denmark/Banedanmark.tsx there,
// re-export, then port the change here.
//
// Every announcement is bilingual, playing the full Danish version and then
// the full English one. Word order differs per language, so each half is built
// as a list of segments and the gap that leads into each one:
//
//	Danish:  [notice] -> "Toget til X" -> "klokken HH MM" -> "kører fra spor N" -> "om ca. ABC"
//	English: [notice] -> "The HH MM" -> "train to X" -> "will depart from track N" -> "in ABC"
package banedanmark

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"slices"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/instance.json
var instanceData []byte

//go:embed data/module.json
var moduleData []byte

//go:embed data/buttons.json
var buttonData []byte

// announcements are the option tabs, in the order the website declares them.
var announcements = []string{"announcement", "disruption"}

// bilingualClip is one clip under each language's ID namespace.
type bilingualClip struct {
	Value string `json:"value"`
	Da    string `json:"da"`
	En    string `json:"en"`
}

// moduleTables is the module-level export of Banedanmark.tsx: the pacing gaps
// and the two clip tables a tab chooses from.
type moduleTables struct {
	SectionDelay            int `json:"SECTION_DELAY"`
	AfterTimeDelay          int `json:"AFTER_TIME_DELAY"`
	AfterTrackDelay         int `json:"AFTER_TRACK_DELAY"`
	LanguageDelay           int `json:"LANGUAGE_DELAY"`
	BetweenDestinationDelay int `json:"BETWEEN_DESTINATION_DELAY"`
	// UnknownTrack plays the bare "kører"/"departs" clip instead of a track.
	UnknownTrack string `json:"UNKNOWN_TRACK"`
	// Countdowns and Disruptions are ordered: an unrecognised choice falls
	// back to the first entry, so decode them as arrays.
	Countdowns  []bilingualClip `json:"COUNTDOWNS"`
	Disruptions []bilingualClip `json:"DISRUPTIONS"`
}

// find returns the entry a state names, or the first one, which is what the
// website's `find(...) ?? table[0]` does with an unknown or missing choice.
func find(table []bilingualClip, chosen json.RawMessage) bilingualClip {
	for _, entry := range table {
		if isString(chosen, entry.Value) {
			return entry
		}
	}
	return table[0]
}

type instance struct {
	ID         string `json:"ID"`
	Name       string `json:"NAME"`
	FilePrefix string `json:"FILE_PREFIX"`
}

type System struct {
	data    instance
	tables  moduleTables
	buttons shared.Buttons
}

func New() (*System, error) {
	s := &System{}
	if err := json.Unmarshal(instanceData, &s.data); err != nil {
		return nil, fmt.Errorf("instance: %w", err)
	}
	if err := json.Unmarshal(moduleData, &s.tables); err != nil {
		return nil, fmt.Errorf("module: %w", err)
	}
	buttons, err := shared.ParseButtons(buttonData)
	if err != nil {
		return nil, err
	}
	s.buttons = buttons
	return s, nil
}

func (s *System) ID() string         { return s.data.ID }
func (s *System) Name() string       { return s.data.Name }
func (s *System) FilePrefix() string { return s.data.FilePrefix }

func (s *System) Announcements() []string {
	return append(slices.Clone(announcements), s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, raw json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, raw)
	}
	var st state
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &st); err != nil {
			return plan.Plan{}, fmt.Errorf("state: %w", err)
		}
	}
	var clips []plan.Clip
	switch announcement {
	case "announcement":
		clips = s.platformAnnouncement(st)
	case "disruption":
		clips = s.disruption(st)
	default:
		return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
	}
	return plan.Plan{Clips: clips, MissingAudioMode: plan.SkipService}, nil
}

func (s *System) platformAnnouncement(st state) []plan.Clip {
	countdown := find(s.tables.Countdowns, st["countdown"])
	daTrack, enTrack := "da.track.koerer", "en.track.departs"
	if !isString(st["track"], s.tables.UnknownTrack) {
		track := text(st["track"])
		daTrack, enTrack = "da.track.spor"+track, "en.track.trk"+track
	}
	return s.build(st, halves{
		trackChange: truthy(st["trackChange"]),
		daTrack:     daTrack,
		enTrack:     enTrack,
		daTail:      plan.IDs("da.countdown." + countdown.Da),
		enTail:      plan.IDs("en.countdown." + countdown.En),
	})
}

func (s *System) disruption(st state) []plan.Clip {
	chosen := find(s.tables.Disruptions, st["disruption"])
	return s.build(st, halves{
		daTail: plan.IDs("da.extra." + chosen.Da),
		enTail: plan.IDs("en.extra." + chosen.En),
	})
}

// halves is what differs between the two announcements: the track clips, the
// closing clips, and the gap that leads into a closing clip with no track
// before it.
type halves struct {
	trackChange bool
	// daTrack and enTrack are empty when the language omits the track segment.
	daTrack string
	enTrack string
	daTail  []plan.Clip
	enTail  []plan.Clip
	tailGap int
}

// segment is a run of clips and the silence that leads into the run.
type segment struct {
	clips []plan.Clip
	gap   int
}

func (s *System) build(st state, h halves) []plan.Clip {
	hour := jsParseInt(text(st["hour"]))
	minute := text(st["minute"])
	destinations := st.strings("destinations")

	var danish []segment
	if h.trackChange {
		danish = append(danish, segment{clips: plan.IDs("da.extra.trkchg")})
	}
	danish = append(danish, segment{clips: s.destinationClips("da", destinations), gap: s.firstGap(danish, 0)})
	danish = append(danish, segment{clips: timeClipsDa(hour, minute), gap: s.tables.SectionDelay})
	daTailGap := h.tailGap
	if h.daTrack != "" {
		danish = append(danish, segment{clips: plan.IDs(h.daTrack), gap: s.tables.AfterTimeDelay})
		daTailGap = s.tables.AfterTrackDelay
	}
	danish = append(danish, segment{clips: h.daTail, gap: daTailGap})

	var english []segment
	if h.trackChange {
		english = append(english, segment{clips: plan.IDs("en.extra.trkchg"), gap: s.tables.LanguageDelay})
	}
	english = append(english, segment{clips: timeClipsEn(hour, minute), gap: s.firstGap(english, s.tables.LanguageDelay)})
	english = append(english, segment{clips: s.destinationClips("en", destinations), gap: s.tables.AfterTimeDelay})
	enTailGap := h.tailGap
	if h.enTrack != "" {
		english = append(english, segment{clips: plan.IDs(h.enTrack), gap: s.tables.SectionDelay})
		enTailGap = s.tables.AfterTrackDelay
	}
	english = append(english, segment{clips: h.enTail, gap: enTailGap})

	return append(assemble(danish), assemble(english)...)
}

// firstGap gives a half's opening segment the gap that starts a language, and
// every later one the ordinary section gap. The notice, when present, has
// already taken the opening slot.
func (s *System) firstGap(built []segment, opening int) int {
	if len(built) > 0 {
		return s.tables.SectionDelay
	}
	return opening
}

// timeClipsDa speaks the scheduled time in Danish: "klokken {H}" and the
// minute, where minute "00" is a 1 ms silence.
func timeClipsDa(hour jsNumber, minute string) []plan.Clip {
	return []plan.Clip{
		{ID: "da.hour.kl" + hour.String()},
		{ID: "da.minute." + minute, Delay: 75},
	}
}

// timeClipsEn speaks the scheduled time in English, on a 12-hour clock.
func timeClipsEn(hour jsNumber, minute string) []plan.Clip {
	h12 := jsNumber{}
	if hour.ok {
		h12 = jsNumber{value: ((hour.value + 11) % 12) + 1, ok: true}
	}
	if minute == "00" {
		return plan.IDs("en.hour.the" + h12.String() + "oclock")
	}
	return []plan.Clip{
		{ID: "en.hour.the" + h12.String()},
		{ID: "en.minute." + minute, Delay: 100},
	}
}

// destinationClips names the stops the train serves. The first one uses the
// "Toget til X" / "train to X" recording and the rest the bare station name,
// with the "og" / "and" clip before the last:
//
//	1 stop:  "Toget til X"
//	2 stops: "Toget til X" "og" "Y"
//	3 stops: "Toget til X" "Y" "og" "Z"
func (s *System) destinationClips(lang string, destinations []string) []plan.Clip {
	clips := make([]plan.Clip, 0, len(destinations)+1)
	for i, id := range destinations {
		clip := plan.Clip{ID: lang + ".destination." + id}
		if i == 0 {
			clip.ID = lang + ".destination.togtil" + id
		} else {
			clip.Delay = s.tables.BetweenDestinationDelay
		}
		clips = append(clips, clip)
	}
	if len(clips) > 1 {
		last := clips[len(clips)-1]
		and := plan.Clip{ID: lang + ".extra.og-and", Delay: s.tables.BetweenDestinationDelay}
		clips = append(clips[:len(clips)-1], and, last)
	}
	return clips
}

func assemble(segments []segment) []plan.Clip {
	var out []plan.Clip
	for _, s := range segments {
		out = append(out, lead(s.clips, s.gap)...)
	}
	return out
}

// lead adds a segment's gap to the delay its first clip already carries. An
// empty segment swallows its gap, which is what the website's map over no
// clips does.
func lead(clips []plan.Clip, gap int) []plan.Clip {
	out := slices.Clone(clips)
	if len(out) > 0 {
		out[0].Delay += gap
	}
	return out
}
