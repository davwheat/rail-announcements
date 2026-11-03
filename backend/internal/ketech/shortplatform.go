package ketech

import (
	"encoding/json"
	"slices"
	"strconv"
	"strings"
)

// ShortPlatformTrain is what a short platform's length can depend on.
type ShortPlatformTrain struct {
	OperatorCode        string   `json:"operatorCode"`
	Length              *int     `json:"length"`
	Origins             []string `json:"-"`
	Destinations        []string `json:"-"`
	SubsequentLocations []string `json:"-"`
	// Units are the units Gemini allocates to the train, such as 450042.
	Units []string `json:"units"`
}

// shortPlatformEntry is a fixed length such as "front.4", or a named rule that
// picks between two lengths by where the train runs.
type shortPlatformEntry struct {
	Length  string
	Rule    string
	Lengths []string
	// Figures are how many coaches of each class of train the platform takes,
	// for a rule that depends on the class.
	Figures map[string]int
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
		Rule    string         `json:"rule"`
		Lengths []string       `json:"lengths"`
		Figures map[string]int `json:"figures"`
	}
	if err := json.Unmarshal(data, &rule); err != nil {
		return err
	}
	e.Rule, e.Lengths, e.Figures = rule.Rule, rule.Lengths, rule.Figures
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
	if e.Rule == "southWesternStock" {
		return southWesternStock(e.Figures, train)
	}
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

// southWesternFormations are the coach counts each class runs in passenger
// service. 158s and 159s run in any mix of two and three coach units.
var southWesternFormations = map[string][]int{
	"444":     {5, 10},
	"450":     {4, 8, 12},
	"444/450": {9},
	"455":     {4, 8},
	"458/4":   {4, 8},
	"458/5":   {5, 10},
	"701":     {5, 10},
	"158/159": {2, 3, 4, 5, 6, 7, 8, 9, 10},
}

// southWesternStockOf names the class of a South Western Railway train from its
// units, or returns "" for a mix the booklet doesn't list.
func southWesternStockOf(units []string) string {
	classes := map[string]bool{}
	for _, unit := range units {
		class := unit[:min(3, len(unit))]
		switch class {
		case "458":
			if len(unit) > 3 && unit[3] == '4' {
				class = "458/4"
			} else {
				class = "458/5"
			}
		case "158", "159":
			class = "158/159"
		}
		classes[class] = true
	}
	if len(classes) == 2 && classes["444"] && classes["450"] {
		return "444/450"
	}
	if len(classes) != 1 {
		return ""
	}
	for class := range classes {
		if _, ok := southWesternFormations[class]; ok {
			return class
		}
	}
	return ""
}

// southWesternStock picks a platform's figure by the class of the train. A
// train without units is short only if every class that runs that many
// coaches, and may call there, would be told the same thing.
func southWesternStock(figures map[string]int, train ShortPlatformTrain) string {
	if stock := southWesternStockOf(train.Units); stock != "" {
		figure := figures[stock]
		// A train of unknown length would otherwise be told to join the front
		// of a platform it fits.
		if figure != 0 && figure < slices.Max(southWesternFormations[stock]) {
			return "front." + strconv.Itoa(figure)
		}
		return ""
	}

	if train.Length == nil || *train.Length == 0 {
		return ""
	}
	length := *train.Length
	outcomes := map[int]bool{}
	for stock, figure := range figures {
		if !slices.Contains(southWesternFormations[stock], length) {
			continue
		}
		if figure < length {
			outcomes[figure] = true
		} else {
			outcomes[0] = true
		}
	}
	if len(outcomes) != 1 {
		return ""
	}
	for figure := range outcomes {
		if figure != 0 {
			return "front." + strconv.Itoa(figure)
		}
	}
	return ""
}
