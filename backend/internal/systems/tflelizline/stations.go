package tflelizline

// station is an AllStations entry, holding the fields the play handlers read.
type station struct {
	CRS       string   `json:"crs"`
	ChangeFor []string `json:"changeFor"`
	ExitFor   []string `json:"exitFor"`

	// mid and end are the mid- and end-of-sentence recordings, named only for
	// the stations AllStationFiles.em covers.
	mid string
	end string
}

// stationFiles is AllStationFiles. Its beginning-of-sentence list is left out:
// no announcement ported here names those recordings.
type stationFiles struct {
	EM []string `json:"em"`
}

type moduleTables struct {
	AllStations     []station    `json:"AllStations"`
	AllStationFiles stationFiles `json:"AllStationFiles"`
}

// newStations indexes AllStations by CRS and names each station's recordings
// from AllStationFiles.em, the two tables the website itself joins. A repeated
// code keeps its first entry, as the website's Array.find does.
func newStations(tables moduleTables) map[string]station {
	recorded := make(map[string]bool, len(tables.AllStationFiles.EM))
	for _, crs := range tables.AllStationFiles.EM {
		recorded[crs] = true
	}
	out := make(map[string]station, len(tables.AllStations))
	for _, stn := range tables.AllStations {
		if _, seen := out[stn.CRS]; seen {
			continue
		}
		if recorded[stn.CRS] {
			stn.mid = "stations.m." + stn.CRS
			stn.end = "stations.e." + stn.CRS
		}
		out[stn.CRS] = stn
	}
	return out
}
