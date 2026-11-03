package snclass377

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
		// A station the website knows and this voice has no recording of.
		{crs: "PNZ", name: "Penzance"},
		{crs: "ZZZ", name: "undefined"},
	} {
		state := fmt.Sprintf(`{"terminatesAtCode":%q,"nextStationCode":"BTN","serviceType":"southern"}`, c.crs)
		_, err := sys.Plan("departingStation", json.RawMessage(state))
		if err == nil {
			t.Errorf("%s has no recording, and the port played it", c.crs)
			continue
		}
		want := fmt.Sprintf("Unfortunately, we don't have the recording for %s in the needed type (type: high). "+
			"If you can record this, please do so, then create an issue or PR on GitHub!", c.name)
		if err.Error() != want {
			t.Errorf("%s is refused with %q, want %q", c.crs, err, want)
		}
	}
}
