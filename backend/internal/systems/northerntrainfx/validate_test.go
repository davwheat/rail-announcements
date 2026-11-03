package northerntrainfx

import "testing"

// TestValidateStationNamesTheStation covers what the parity record cannot: no
// recorded case reaches a station this system has no recording of, so only the
// message itself pins the name the website's alert shows.
func TestValidateStationNamesTheStation(t *testing.T) {
	sys, err := New()
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name  string
		crs   string
		pitch string
		want  string
	}{
		{
			name:  "a real station outside this system's list is named from the national table",
			crs:   "KGX",
			pitch: pitchHigh,
			want:  "Unfortunately, we don't have the recording for London Kings Cross in the needed type (type: high). If you can record this, please do so, then create an issue or PR on GitHub!",
		},
		{
			name:  "a code no station has reaches the message as undefined",
			crs:   "ZZZ",
			pitch: pitchLow,
			want:  "Unfortunately, we don't have the recording for undefined in the needed type (type: low). If you can record this, please do so, then create an issue or PR on GitHub!",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := sys.validateStation(c.crs, c.pitch)
			if err == nil {
				t.Fatalf("%s has no recording, and the port accepted it", c.crs)
			}
			if err.Error() != c.want {
				t.Errorf("%s refused with %q, want %q", c.crs, err, c.want)
			}
		})
	}
}
