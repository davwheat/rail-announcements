package shared

import "testing"

func TestStationName(t *testing.T) {
	for crs, want := range map[string]string{
		"KGX": "London Kings Cross",
		"HHE": "Haywards Heath",
		"ZFD": "Farringdon",
	} {
		got, ok := StationName(crs)
		if !ok {
			t.Errorf("%s is missing from the table", crs)
			continue
		}
		if got != want {
			t.Errorf("%s is %q, want %q", crs, got, want)
		}
	}

	if name, ok := StationName("ZZZ"); ok {
		t.Errorf("ZZZ is not a station, and the table names it %q", name)
	}

	// The table is the national one, not any one voice's, so it covers the
	// whole network.
	if len(stationNames) < 2000 {
		t.Errorf("the table holds %d stations, which is too few to be the national list", len(stationNames))
	}
}
