package shared

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

// stationData is the national CRS -> station name table, exported from the
// website's uk-railway-stations package. It is what the website's
// "we don't have the recording for X" alert names a station by, including a
// station a voice has no recording of, so the message must not be built from a
// voice's own list.
//
//go:embed data/stations.json
var stationData []byte

var stationNames = mustParseStations()

func mustParseStations() map[string]string {
	var names map[string]string
	if err := json.Unmarshal(stationData, &names); err != nil {
		panic(fmt.Sprintf("shared: stations.json: %v", err))
	}
	return names
}

// StationName returns the name of the station with this CRS code, and whether
// there is one.
func StationName(crs string) (string, bool) {
	name, ok := stationNames[crs]
	return name, ok
}
