package fgwtrainfx

import (
	"fmt"
	"testing"
)

// The parity record holds no refusal, so nothing else pins the alert: the
// website names the station from the national table, which reaches far beyond
// this system's own list, and only a CRS code that table lacks prints
// "undefined".
func TestValidateStationExistsNamesTheStation(t *testing.T) {
	sys, err := New()
	if err != nil {
		t.Fatal(err)
	}

	for _, test := range []struct{ crs, name string }{
		{"KGX", "London Kings Cross"},
		{"ZZZ", "undefined"},
	} {
		if sys.stations[pitchHigh][test.crs] {
			t.Errorf("%s has a recording, so it never reaches the alert", test.crs)
			continue
		}
		err := sys.validateStationExists(test.crs, pitchHigh)
		if err == nil {
			t.Errorf("%s has no recording, and validation passed", test.crs)
			continue
		}
		want := fmt.Sprintf(
			"Unfortunately, we don't have the recording for %s in the needed type (type: high). If you can record this, please do so, then create an issue or PR on GitHub!",
			test.name,
		)
		if err.Error() != want {
			t.Errorf("%s alerts\n\t%q\nwant\n\t%q", test.crs, err, want)
		}
	}
}
