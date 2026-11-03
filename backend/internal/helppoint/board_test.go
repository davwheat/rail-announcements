package helppoint

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTheBoardIsReadFromDarwinBrowser(t *testing.T) {
	var asked *http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = r
		switch r.URL.Query().Get("crs") {
		case "BTN":
			io.WriteString(w, `{"crs": "BTN", "services": [{
				"toc": "SN", "planned_arr": "2026-09-20T23:37:00+01:00", "exp_arr": {"t": "23:56:00"},
				"platform": "5", "cancelled": false, "coach_count": 8, "late_reason_code": "100",
				"origins": [{"tpl": "VICTRIC", "crs": "VIC"}],
				"false_destination": {"tpl": "WRTHING", "crs": "WRH"},
				"destinations": [{"crs": "BTN", "via": {"text": "via Hove", "locs": ["HOV"]}},
					{"crs": "LIT", "assoc_rid": "202609207654321", "assoc_cat": "VV"}]}]}`)
		case "ZZZ":
			http.Error(w, "no such station", http.StatusNotFound)
		default:
			http.Error(w, "the database is away", http.StatusBadGateway)
		}
	}))
	defer server.Close()

	board, err := NewBoard("ws" + server.URL[len("http"):] + "/")
	if err != nil {
		t.Fatal(err)
	}
	from := time.Date(2026, 9, 20, 23, 30, 0, 0, time.FixedZone("BST", 3600))
	services, err := board.Departures(context.Background(), "BTN", from)
	if err != nil {
		t.Fatal(err)
	}
	if asked.URL.Path != "/v1/departures" {
		t.Errorf("asked for %s", asked.URL.Path)
	}
	for key, want := range map[string]string{
		"from": "2026-09-20T23:30:00+01:00", "window": "90", "limit": "8", "passenger_only": "true", "modes": "train",
	} {
		if got := asked.URL.Query().Get(key); got != want {
			t.Errorf("%s is %q, want %q", key, got, want)
		}
	}
	if len(services) != 1 {
		t.Fatalf("read %d services, want 1", len(services))
	}
	service := services[0]
	if service.TOC != "SN" || service.Platform != "5" || service.PlannedDep != nil || service.PlannedArr.Minute() != 37 ||
		service.ExpArr.T != "23:56:00" || *service.CoachCount != 8 || service.LateReasonCode != "100" ||
		*service.Origins[0].CRS != "VIC" || service.Destinations[0].Via.Locs[0] != "HOV" ||
		service.Destinations[0].AssocRID != "" || service.Destinations[1].AssocRID != "202609207654321" ||
		*service.FalseDestination.CRS != "WRH" {
		t.Errorf("read %+v", service)
	}

	if _, err := board.Departures(context.Background(), "ZZZ", from); !errors.Is(err, ErrUnknownStation) {
		t.Errorf("an unknown station gave %v", err)
	}
	if _, err := board.Departures(context.Background(), "KGX", from); err == nil || errors.Is(err, ErrUnknownStation) {
		t.Errorf("a failing service gave %v", err)
	}
}

func TestOnlyAServiceURLIsAccepted(t *testing.T) {
	if _, err := NewBoard("ftp://darwinbrowser.com"); err == nil {
		t.Error("an FTP URL was accepted")
	}
}
