package queue

import (
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"rail-announcements-backend/internal/feed"
)

// testdata/parity-queue.json is written by the website's `npm run
// export:backend`: scripts run against its PlaybackQueue, with everything the
// queue did after each step.
func TestQueueMatchesTheWebsite(t *testing.T) {
	raw, err := os.ReadFile("testdata/parity-queue.json")
	if err != nil {
		t.Fatal(err)
	}
	var scenarios []struct {
		Name  string     `json:"name"`
		Zones [][]string `json:"zones"`
		Start time.Time  `json:"start"`
		Steps []struct {
			Op           string            `json:"op"`
			Announcement feed.Announcement `json:"announcement"`
			EventID      string            `json:"event_id"`
			Reason       string            `json:"reason"`
			Details      feed.Movement     `json:"details"`
			Message      string            `json:"message"`
			MS           int               `json:"ms"`
		} `json:"steps"`
		Expected [][]string `json:"expected"`
	}
	if err := json.Unmarshal(raw, &scenarios); err != nil {
		t.Fatal(err)
	}
	if len(scenarios) < 10 {
		t.Fatalf("only %d scenarios", len(scenarios))
	}

	for _, scenario := range scenarios {
		t.Run(scenario.Name, func(t *testing.T) {
			now := scenario.Start
			var trace []string
			plays := map[string]*Playback{}
			lanes := map[string]string{}
			for _, zone := range scenario.Zones {
				sorted := slices.Clone(zone)
				slices.Sort(sorted)
				for _, platform := range zone {
					lanes[platform] = strings.Join(sorted, "+")
				}
			}

			q := New(
				func(p *Playback) {
					trace = append(trace, "start "+p.Announcement.EventID)
					plays[p.Announcement.EventID] = p
				},
				func() time.Time { return now },
				func(a feed.Announcement) []string {
					if len(scenario.Zones) == 0 {
						return []string{""}
					}
					var out []string
					for _, platform := range a.Platforms() {
						lane := ""
						if text(platform) != "" {
							lane = first(lanes[*platform], *platform)
						}
						if !slices.Contains(out, lane) {
							out = append(out, lane)
						}
					}
					return out
				},
				func(message string) { trace = append(trace, "log "+message) },
				func(err error) { trace = append(trace, "error "+err.Error()) },
			)

			for i, step := range scenario.Steps {
				trace = nil
				before := map[string]bool{}
				for id, p := range plays {
					before[id] = p.Context().Err() != nil
				}
				switch step.Op {
				case "push":
					q.Push(step.Announcement)
				case "retract":
					q.Retract(step.EventID, step.Reason)
				case "revise":
					q.Revise(step.EventID, step.Details)
				case "finish":
					if p := plays[step.EventID]; p != nil {
						q.Finished(p, nil)
					}
				case "fail":
					if p := plays[step.EventID]; p != nil {
						q.Finished(p, errors.New(step.Message))
					}
				case "advance":
					now = now.Add(time.Duration(step.MS) * time.Millisecond)
				case "reset":
					q.Reset()
				}
				want := scenario.Expected[i]
				got := withoutAborts(trace)
				if !reflect.DeepEqual(got, withoutAborts(want)) {
					t.Fatalf("step %d (%s):\n got %q\nwant %q", i, step.Op, got, withoutAborts(want))
				}
				// The website records an abort as its listener fires. Here it is a cancelled
				// context, so compare which playbacks were stopped by this step.
				var aborted []string
				for id, p := range plays {
					if !before[id] && p.Context().Err() != nil && !finishedBy(step.Op, step.EventID, id) {
						aborted = append(aborted, "abort "+id)
					}
				}
				slices.Sort(aborted)
				wantAborted := onlyAborts(want)
				slices.Sort(wantAborted)
				if !reflect.DeepEqual(aborted, wantAborted) {
					t.Fatalf("step %d (%s): aborted %q, want %q", i, step.Op, aborted, wantAborted)
				}
			}
		})
	}
}

func finishedBy(op, stepEvent, id string) bool {
	return (op == "finish" || op == "fail") && stepEvent == id
}

func withoutAborts(trace []string) []string {
	out := []string{}
	for _, entry := range trace {
		if !strings.HasPrefix(entry, "abort ") {
			out = append(out, entry)
		}
	}
	return out
}

func onlyAborts(trace []string) []string {
	var out []string
	for _, entry := range trace {
		if strings.HasPrefix(entry, "abort ") {
			out = append(out, entry)
		}
	}
	return out
}
