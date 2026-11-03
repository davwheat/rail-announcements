// Package ketech is the Amey/KeTech station announcement system, in the voices
// of Phil Sayer and Celia Drummond.
//
// It is a port of the website's AmeyPhil and AmeyCelia systems and of the live
// announcement logic that drives them. The website remains the reference: its
// `npm run export:backend` writes the tables in data/ and the expected output
// in testdata/, and the tests here fail on any clip that differs. Change the
// website first, export, and then port the change.
package ketech

import (
	"embed"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
)

//go:embed data/*.json
var dataFiles embed.FS

type Chime string

const (
	ChimeThree Chime = "three"
	ChimeFour  Chime = "four"
	ChimeNone  Chime = "none"
)

// sharedPrefix holds the chimes, which belong to the system and not to a voice.
const sharedPrefix = "station/ketech"

// Voice is one speaker's recordings: what exists, how it is named, and the
// pauses that make it sound like the real system.
type Voice struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	FilePrefix         string `json:"filePrefix"`
	DefaultChime       Chime  `json:"defaultChime"`
	BeforeTocDelay     int    `json:"beforeTocDelay"`
	BeforeSectionDelay int    `json:"beforeSectionDelay"`
	ShortDelay         int    `json:"shortDelay"`
	GenericOptions     struct {
		Platform                    string   `json:"platform"`
		PlatformZeroE               string   `json:"platformZeroE"`
		LetteredPlatformsWithForThe []string `json:"letteredPlatformsWithForThe"`
	} `json:"genericOptions"`
	CallingPointsOptions struct {
		BeforeCallingAtDelay int    `json:"beforeCallingAtDelay"`
		AfterCallingAtDelay  int    `json:"afterCallingAtDelay"`
		BetweenStopsDelay    int    `json:"betweenStopsDelay"`
		AroundAndDelay       int    `json:"aroundAndDelay"`
		RrbTerminateAudio    string `json:"rrbTerminateAudio"`
	} `json:"callingPointsOptions"`
	RequestStopOptions struct {
		AndID string `json:"andId"`
	} `json:"requestStopOptions"`
	ShortPlatformOptions struct {
		UnknownLocation string `json:"unknownLocation"`
	} `json:"shortPlatformOptions"`
	StandingOptions struct {
		ThisIsID        string `json:"thisIsId"`
		NowStandingAtID string `json:"nowStandingAtId"`
	} `json:"standingOptions"`
	SplitOptions struct {
		TravelInCorrectPartID []string `json:"travelInCorrectPartId"`
		TravelInAnyPartIDs    []string `json:"travelInAnyPartIds"`
		// DetachesAndTerminatesIDs is nil for a voice that has no such wording.
		DetachesAndTerminatesIDs []string `json:"detachesAndTerminatesIds"`
	} `json:"splitOptions"`
	DisruptionOptions struct {
		ThisStationAudio string `json:"thisStationAudio"`
	} `json:"disruptionOptions"`
	Platforms []string `json:"platforms"`
	Tocs      struct {
		StandaloneOnly    []string `json:"standaloneOnly"`
		WithServiceToFrom []string `json:"withServiceToFrom"`
	} `json:"tocs"`
	AllTocs    []string              `json:"allTocs"`
	DelayCodes map[string]reasonClip `json:"delayCodes"`

	legacyTocs map[string]string
	// The website matches Celia's named Great Western services against the
	// list as written, and Phil's without regard to case. It also gives
	// Celia's the old company's name even when legacy names are off.
	namedServiceIgnoresCase bool
	namedServicePrefix      string
}

// reasonClip is a delay code's finished clips: one, several, or none recorded.
type reasonClip []string

func (r *reasonClip) UnmarshalJSON(data []byte) error {
	var one *string
	if json.Unmarshal(data, &one) == nil {
		*r = nil
		if one != nil && *one != "" {
			*r = reasonClip{*one}
		}
		return nil
	}
	var many []string
	if err := json.Unmarshal(data, &many); err != nil {
		return err
	}
	*r = many
	return nil
}

var legacyTocs = map[string]string{
	"AW": "arriva trains wales", "CC": "c2c", "CH": "chiltern railways", "CS": "caledonian sleeper",
	"EM": "east midlands railway", "ES": "eurostar", "GC": "grand central", "GN": "first capital connect",
	"GR": "national express east coast", "GX": "gatwick express", "HT": "hull trains", "HX": "heathrow express",
	"IL": "island line",
	// "one" was left out of real announcements because it is heard as a time.
	"LE": "",
	"LM": "london midland", "LO": "london overground", "ME": "merseyrail", "NT": "northern rail",
	"SE": "southeastern", "SN": "southern", "SR": "scotrail", "SW": "south west trains",
	"TL": "first capital connect", "TP": "first transpennine express", "TW": "tyne and wear metro",
	"VT": "virgin trains", "XC": "virgin trains",
}

var (
	Phil  = mustLoadVoice("phil")
	Celia = mustLoadVoice("celia")

	namedServices = mustLoad[map[string]struct {
		Services map[string][]string `json:"services"`
	}]("named-services")
)

// Voices maps the names a stream is asked for to the voices.
var Voices = map[string]*Voice{"phil": Phil, "celia": Celia}

// VoiceName resolves what a listener calls a voice, which is its short name or
// the website's system ID, to the short name.
func VoiceName(name string) (string, bool) {
	for short, voice := range Voices {
		if strings.EqualFold(name, short) || strings.EqualFold(name, voice.ID) {
			return short, true
		}
	}
	return "", false
}

func mustLoad[T any](name string) T {
	var out T
	raw, err := dataFiles.ReadFile("data/" + name + ".json")
	if err == nil {
		err = json.Unmarshal(raw, &out)
	}
	if err != nil {
		panic(fmt.Sprintf("ketech: %s: %v", name, err))
	}
	return out
}

func mustLoadVoice(name string) *Voice {
	voice := mustLoad[*Voice](name)
	voice.legacyTocs = legacyTocs
	voice.namedServiceIgnoresCase = true
	voice.namedServicePrefix = "great western railway "
	if name == "celia" {
		voice.legacyTocs = map[string]string{}
		for code, toc := range legacyTocs {
			voice.legacyTocs[code] = toc
		}
		voice.legacyTocs["EM"] = "east midlands trains"
		voice.namedServiceIgnoresCase = false
		voice.namedServicePrefix = "first great western "
	}
	return voice
}

// AudioPlatform returns the platform this voice has recordings for, dropping a
// letter suffix it lacks. It reports false when the voice cannot say it at all.
func (v *Voice) AudioPlatform(platform string) (string, bool) {
	normalised := strings.ToLower(platform)
	if slices.Contains(v.Platforms, normalised) {
		return normalised, true
	}
	unsuffixed := strings.TrimRight(normalised, "abcdefghijklmnopqrstuvwxyz")
	return unsuffixed, slices.Contains(v.Platforms, unsuffixed)
}

// StationOverride returns the recording that stands for a TIPLOC whose CRS
// code would name the wrong part of the station.
func StationOverride(tiploc string) string {
	switch tiploc {
	case "STPX":
		return "STP"
	case "STPXBOX", "STPANCI":
		return "STP - St Pancras International"
	}
	return ""
}

func (v *Voice) tocByName(name string) string {
	for _, toc := range v.AllTocs {
		if strings.EqualFold(toc, name) {
			return toc
		}
	}
	return ""
}

func (v *Voice) namedService(prefix, uid string) string {
	for name, uids := range namedServices["GW"].Services {
		if !slices.Contains(uids, uid) {
			continue
		}
		toc := prefix + strings.ToLower(name)
		if slices.ContainsFunc(v.AllTocs, func(known string) bool {
			if v.namedServiceIgnoresCase {
				return strings.ToLower(known) == toc
			}
			return known == toc
		}) {
			return toc
		}
		return ""
	}
	return ""
}

// TocForLiveTrain names the operator the way this voice recorded it. An empty
// result announces "the service to" with no operator.
func (v *Voice) TocForLiveTrain(name, code, originCRS, destinationCRS string, legacy bool, uid string) string {
	code = strings.ToUpper(code)
	if legacy {
		if code == "GW" {
			if toc := v.namedService("first great western ", uid); toc != "" {
				return toc
			}
			return "first great western"
		}
		if toc, ok := v.legacyTocs[code]; ok {
			return toc
		}
		return v.tocByName(name)
	}
	switch code {
	case "GR":
		return "london north eastern railway"
	case "GW":
		if toc := v.namedService(v.namedServicePrefix, uid); toc != "" {
			return toc
		}
		return "great western railway"
	case "LM":
		// https://www.westmidlandsrailway.co.uk/media/3657/download?inline
		lnwr := []string{"EUS", "CRE", "BDM", "SAA", "MKC", "TRI", "LIV", "NMP"}
		if slices.Contains(lnwr, originCRS) || slices.Contains(lnwr, destinationCRS) {
			return "london northwestern railway"
		}
		return "west midlands railway"
	}
	return v.tocByName(name)
}

func (v *Voice) tocIsStandalone(toc string) bool {
	return slices.ContainsFunc(v.Tocs.StandaloneOnly, func(known string) bool { return strings.EqualFold(known, toc) })
}
