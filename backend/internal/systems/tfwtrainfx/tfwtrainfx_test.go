package tfwtrainfx

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"

	"rail-announcements-backend/internal/plan"
)

func TestRefusalNamesTheStationNationally(t *testing.T) {
	sys, err := New()
	if err != nil {
		t.Fatal(err)
	}

	for _, c := range []struct{ crs, name string }{
		// A station the website knows and this system has no recording of.
		{crs: "KGX", name: "London Kings Cross"},
		{crs: "ZZZ", name: "undefined"},
	} {
		state := fmt.Sprintf(`{"thisStationCode":%q,"terminatesAtCode":"ABA"}`, c.crs)
		_, err := sys.Plan("stoppedAtStation", json.RawMessage(state))
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

// An unrecorded terminus costs the announcement only the line that names it.
func TestUnrecordedTerminusStillPlaysTheStationItIsAt(t *testing.T) {
	sys, err := New()
	if err != nil {
		t.Fatal(err)
	}

	got, err := sys.Plan("stoppedAtStation", json.RawMessage(`{"thisStationCode":"ABA","terminatesAtCode":"KGX"}`))
	if err != nil {
		t.Fatalf("refused with %q, and the website plays it", err)
	}
	want := plan.Plan{
		Clips:            plan.IDs("conjoiners.we are now at", "stations.high.ABA"),
		MissingAudioMode: plan.SkipService,
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("plays %+v, want %+v", got, want)
	}
}
