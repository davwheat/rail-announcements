package tlclass700

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestRefusalNamesTheStationNationally(t *testing.T) {
	sys, err := New()
	if err != nil {
		t.Fatal(err)
	}

	for _, c := range []struct{ crs, name string }{
		// A station the website knows and these voices have no recording of.
		{crs: "EUS", name: "London Euston"},
		{crs: "ZZZ", name: "undefined"},
	} {
		state := fmt.Sprintf(`{"stationCode":%q,"terminatesHere":false,"changeFor":[]}`, c.crs)
		_, err := sys.Plan("approachingStation", json.RawMessage(state))
		if err == nil {
			t.Errorf("%s has no recording, and the port played it", c.crs)
			continue
		}
		want := fmt.Sprintf("Unfortunately, we don't have the recording for %s in the needed type (type: low). "+
			"If you can record this, please do so, then create an issue or PR on GitHub!", c.name)
		if err.Error() != want {
			t.Errorf("%s is refused with %q, want %q", c.crs, err, want)
		}
	}
}

// The website's own override accepts its test stations, which no audio library
// and no national list holds.
func TestTestStationsAreAccepted(t *testing.T) {
	sys, err := New()
	if err != nil {
		t.Fatal(err)
	}

	for _, crs := range additionalStations {
		state := fmt.Sprintf(`{"stationCode":%q,"terminatesHere":false,"changeFor":[]}`, crs)
		if _, err := sys.Plan("approachingStation", json.RawMessage(state)); err != nil {
			t.Errorf("%s is refused with %q, and the website plays it", crs, err)
		}
	}
}
