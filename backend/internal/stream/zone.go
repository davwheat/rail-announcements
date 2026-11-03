// Package stream runs the live audio streams. A stream is one listener's mix of
// a station: its announcement zones, each a group of platforms that share a
// loudspeaker and so take turns, with the voices and preferences the listener
// chose. Zones speak at the same time, and the stream is their sum.
package stream

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"

	"rail-announcements-backend/internal/feed"
	"rail-announcements-backend/internal/ketech"
	"rail-announcements-backend/internal/plan"
)

// Zone is everything that decides what a stream sounds like. Two listeners who
// ask for equal zones share one stream.
type Zone struct {
	CRS string `json:"crs"`
	// Platforms maps each platform of the stream to its voice. When it is empty
	// the stream is the whole station, spoken in Voice, taking turns.
	Platforms map[string]string `json:"platforms"`
	// Zones groups Platforms into the zones that take turns. Every platform is
	// in exactly one.
	Zones       [][]string              `json:"zones"`
	Voice       string                  `json:"voice"`
	Types       []feed.AnnouncementType `json:"types"`
	Preferences ketech.Preferences      `json:"preferences"`
}

var crsPattern = regexp.MustCompile(`^[A-Z]{3}$`)

// maxPlatforms bounds a stream's platform list. A voice can say 77 platforms,
// and a listener at a station with no known platform list names every one.
const maxPlatforms = 256

// PlatformKey folds a platform as the feed names it onto the platform a voice
// is chosen for, as the website does: "10A" is platform 10a, but "3F" is 3.
func PlatformKey(platform string) string {
	platform = strings.ToLower(platform)
	if len(platform) == 1 && platform[0] >= 'a' && platform[0] <= 'z' {
		return platform
	}
	number, numeric := 0, false
	for i := 0; i < len(platform) && platform[i] >= '0' && platform[i] <= '9'; i++ {
		number, numeric = min(number*10+int(platform[i]-'0'), 1000), true
	}
	drop := "abcdefghijklmnopqrstuvwxyz"
	if numeric && number <= 12 {
		drop = drop[4:]
	}
	return strings.Map(func(r rune) rune {
		if strings.ContainsRune(drop, r) {
			return -1
		}
		return r
	}, platform)
}

func flag(q url.Values, name string, fallback bool) (bool, error) {
	switch q.Get(name) {
	case "":
		return fallback, nil
	case "1", "true":
		return true, nil
	case "0", "false":
		return false, nil
	}
	return false, fmt.Errorf("%s must be true or false", name)
}

func list(values []string) []string {
	var out []string
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			if part = strings.TrimSpace(part); part != "" {
				out = append(out, part)
			}
		}
	}
	return out
}

// ParseZone reads a zone from a stream URL's query. README.md documents the
// parameters.
func ParseZone(q url.Values) (Zone, error) {
	zone := Zone{CRS: strings.ToUpper(strings.TrimSpace(q.Get("crs"))), Voice: "phil", Platforms: map[string]string{}}
	if !crsPattern.MatchString(zone.CRS) {
		return zone, fmt.Errorf("crs must be a three-letter station code")
	}
	if name := q.Get("voice"); name != "" {
		voice, ok := ketech.VoiceName(name)
		if !ok {
			return zone, fmt.Errorf("unknown voice %q", name)
		}
		zone.Voice = voice
	}

	if len(q["platform"]) > 0 && len(q["zone"]) > 0 {
		return zone, fmt.Errorf("give platform for one zone or zone for several, not both")
	}
	groups := q["zone"]
	if len(q["platform"]) > 0 {
		groups = []string{strings.Join(q["platform"], ",")}
	}
	for _, group := range groups {
		var members []string
		for _, entry := range list([]string{group}) {
			platform, name, _ := strings.Cut(entry, ":")
			voice := zone.Voice
			if name != "" {
				var ok bool
				if voice, ok = ketech.VoiceName(name); !ok {
					return zone, fmt.Errorf("unknown voice %q", name)
				}
			}
			if platform == "" || len(platform) > 8 {
				return zone, fmt.Errorf("bad platform %q", platform)
			}
			key := PlatformKey(platform)
			if _, placed := zone.Platforms[key]; placed {
				return zone, fmt.Errorf("platform %s is listed twice", key)
			}
			zone.Platforms[key] = voice
			members = append(members, key)
		}
		if len(members) > 0 {
			slices.Sort(members)
			zone.Zones = append(zone.Zones, members)
		}
	}
	// Sorted so that the order a listener lists zones in does not change the key.
	slices.SortFunc(zone.Zones, func(a, b []string) int { return strings.Compare(a[0], b[0]) })
	if len(zone.Platforms) > maxPlatforms {
		return zone, fmt.Errorf("a stream holds at most %d platforms", maxPlatforms)
	}

	for _, name := range list(q["type"]) {
		kind := feed.AnnouncementType(name)
		if !slices.Contains(feed.AnnouncementTypes, kind) {
			return zone, fmt.Errorf("unknown announcement type %q", name)
		}
		if !slices.Contains(zone.Types, kind) {
			zone.Types = append(zone.Types, kind)
		}
	}
	if len(zone.Types) == 0 {
		zone.Types = slices.Clone(feed.AnnouncementTypes)
	}
	slices.Sort(zone.Types)

	prefs := &zone.Preferences
	switch prefs.Chime = ketech.Chime(q.Get("chime")); prefs.Chime {
	case "", ketech.ChimeThree, ketech.ChimeFour, ketech.ChimeNone:
	default:
		return zone, fmt.Errorf("chime must be three, four or none")
	}
	var err error
	if prefs.MissingAudioMode, err = plan.ParseMissingAudioMode(q.Get("missing_audio")); err != nil {
		return zone, err
	}
	for name, target := range map[string]*bool{
		"legacy_tocs":                 &prefs.UseLegacyTocNames,
		"vias":                        &prefs.AnnounceViaPoints,
		"short_platforms_after_split": &prefs.AnnounceShortPlatformsAfterSplit,
		"fast_train_approaching":      &prefs.FastTrainApproaching,
		"fanfare":                     &prefs.DaktronicsFanfare,
	} {
		if *target, err = flag(q, name, name == "vias"); err != nil {
			return zone, err
		}
	}
	return zone, nil
}

// Key identifies the zone. It is stable across processes, so a playlist URL
// keeps working through a restart.
func (z Zone) Key() string {
	// Maps marshal with sorted keys, so equal zones give equal bytes.
	canonical, err := json.Marshal(z)
	if err != nil {
		panic(err)
	}
	sum := sha256.Sum256(canonical)
	return hex.EncodeToString(sum[:10])
}

// voiceFor returns the voice that speaks a platform, or nil when the platform
// is not in this zone.
func (z Zone) voiceFor(platform string) *ketech.Voice {
	if len(z.Platforms) == 0 {
		return ketech.Voices[z.Voice]
	}
	return ketech.Voices[z.Platforms[PlatformKey(platform)]]
}

// lane names the zone a platform takes turns in, or reports false when the
// platform is not in this stream.
func (z Zone) lane(platform string) (string, bool) {
	if len(z.Platforms) == 0 {
		return "", true
	}
	key := PlatformKey(platform)
	for _, members := range z.Zones {
		if slices.Contains(members, key) {
			return members[0], true
		}
	}
	return "", false
}

func (z Zone) wants(kind feed.AnnouncementType) bool { return slices.Contains(z.Types, kind) }

func (z Zone) String() string {
	if len(z.Zones) == 0 {
		return z.CRS + " (every platform)"
	}
	zones := make([]string, len(z.Zones))
	for i, members := range z.Zones {
		zones[i] = strings.Join(members, "+")
	}
	return z.CRS + " platforms " + strings.Join(zones, ", ")
}
