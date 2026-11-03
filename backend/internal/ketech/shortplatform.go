package ketech

import (
	"encoding/json"
	"slices"
	"strings"
)

// ShortPlatformTrain is what a short platform's length can depend on.
type ShortPlatformTrain struct {
	OperatorCode        string   `json:"operatorCode"`
	Length              *int     `json:"length"`
	Origins             []string `json:"-"`
	Destinations        []string `json:"-"`
	SubsequentLocations []string `json:"-"`
}

// shortPlatformEntry is a fixed length such as "front.4", or a named rule that
// picks between two lengths by where the train runs.
type shortPlatformEntry struct {
	Length  string
	Rule    string
	Lengths []string
}

func (e *shortPlatformEntry) UnmarshalJSON(data []byte) error {
	var length *string
	if json.Unmarshal(data, &length) == nil {
		if length != nil {
			e.Length = *length
		}
		return nil
	}
	var rule struct {
		Rule    string   `json:"rule"`
		Lengths []string `json:"lengths"`
	}
	if err := json.Unmarshal(data, &rule); err != nil {
		return err
	}
	e.Rule, e.Lengths = rule.Rule, rule.Lengths
	return nil
}

// CRS -> platform ("*" for any) -> operator code.
var shortPlatforms = mustLoad[map[string]map[string]map[string]shortPlatformEntry]("short-platforms")

// ruleStations are the places that mark a train as the stock the rule's second
// case is about: Southern's diesel units, and Southeastern's high speed trains.
var ruleStations = map[string][]string{
	"southernTurboElectro": {"AFK", "UCK", "APD", "EBT"},
	"southeasternHs1":      {"STP", "EBD", "SFA", "ASI", "AFK"},
}

func (e shortPlatformEntry) resolve(train ShortPlatformTrain) string {
	stations, ok := ruleStations[e.Rule]
	if !ok || len(e.Lengths) != 2 {
		return e.Length
	}
	runsVia := func(crs string) bool { return slices.Contains(stations, crs) }
	matched := slices.ContainsFunc(train.Origins, runsVia) ||
		slices.ContainsFunc(train.Destinations, runsVia) ||
		slices.ContainsFunc(train.SubsequentLocations, runsVia)
	// The Southern rule lists its diesel length first, and the Southeastern
	// rule lists its high speed length second.
	if matched == (e.Rule == "southernTurboElectro") {
		return e.Lengths[0]
	}
	return e.Lengths[1]
}

// ShortPlatform returns the part of the train that fits a platform, such as
// "front.4", or "" when the whole train fits or nothing is known.
func ShortPlatform(crs string, platform *string, train ShortPlatformTrain) string {
	if platform == nil {
		return ""
	}
	station := shortPlatforms[crs]
	entry, ok := station[strings.ToLower(*platform)][train.OperatorCode]
	out := ""
	if ok {
		out = entry.resolve(train)
	}
	if out == "" {
		if entry, ok = station["*"][train.OperatorCode]; ok {
			out = entry.resolve(train)
		}
	}
	if out == "" {
		return ""
	}
	_, size, _ := strings.Cut(out, ".")
	if count, ok := jsParseInt(size); ok && count != 0 && train.Length != nil && *train.Length > 0 && count >= *train.Length {
		return ""
	}
	return out
}
