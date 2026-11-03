// Package helppoint speaks a station's departure board the way a platform
// help point does: the next services in Phil Sayer's voice, with their
// cancellations and delays.
//
// Unlike the announcement systems, it isn't a port of the website. It reads
// Darwin Browser's departure board and chooses the recordings itself.
package helppoint

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	boardWindowMinutes = 90
	boardLimit         = 8
	fetchTimeout       = 10 * time.Second
)

// ErrUnknownStation reports a CRS code that Darwin Browser has no station for.
var ErrUnknownStation = errors.New("unknown station")

// BoardTime is a real-time forecast for a call.
type BoardTime struct {
	// T is "HH:MM:SS" or "HH:MM", with no date.
	T string `json:"t"`
	// Delayed marks a delay of unknown length, which has no T.
	Delayed bool `json:"delayed"`
}

type Via struct {
	Locs []string `json:"locs"`
}

// Endpoint is one origin or destination. A train that divides or joins has
// several.
type Endpoint struct {
	CRS *string `json:"crs"`
	Via *Via    `json:"via"`
	// AssocRID names the portion that joins or divides to reach this endpoint.
	// It's empty on the service's own.
	AssocRID string `json:"assoc_rid"`
	// AssocCat is that association's category: "JJ" for a join, "VV" for a
	// division. A "JJ" destination is where the train that this service joins
	// goes on to.
	AssocCat string `json:"assoc_cat"`
}

// Service is one row of the departure board.
type Service struct {
	TOC              string     `json:"toc"`
	PlannedArr       *time.Time `json:"planned_arr"`
	PlannedDep       *time.Time `json:"planned_dep"`
	ExpArr           *BoardTime `json:"exp_arr"`
	ExpDep           *BoardTime `json:"exp_dep"`
	Platform         string     `json:"platform"`
	Cancelled        bool       `json:"cancelled"`
	CoachCount       *int       `json:"coach_count"`
	CancelReasonCode string     `json:"cancel_reason_code"`
	LateReasonCode   string     `json:"late_reason_code"`
	Origins          []Endpoint `json:"origins"`
	Destinations     []Endpoint `json:"destinations"`
	// FalseDestination is the station Darwin asks this station to name in place
	// of the service's own destination, as on a circular route.
	FalseDestination *Endpoint `json:"false_destination"`
}

// Board reads departure boards from a Darwin Browser instance.
type Board struct {
	endpoint string
	client   *http.Client
}

// NewBoard reads boards from the Darwin Browser instance at base, which is its
// HTTP or WebSocket URL.
func NewBoard(base string) (*Board, error) {
	parsed, err := url.Parse(base)
	if err != nil {
		return nil, err
	}
	switch parsed.Scheme {
	case "http", "ws":
		parsed.Scheme = "http"
	case "https", "wss":
		parsed.Scheme = "https"
	default:
		return nil, errors.New("use an HTTP or WebSocket service URL")
	}
	parsed.Path = strings.TrimSuffix(parsed.Path, "/") + "/v1/departures"
	parsed.RawQuery, parsed.Fragment = "", ""
	return &Board{endpoint: parsed.String(), client: &http.Client{Timeout: fetchTimeout}}, nil
}

// Departures returns the passenger trains that call at a station in the 90
// minutes after from, to a limit of eight.
func (b *Board) Departures(ctx context.Context, crs string, from time.Time) ([]Service, error) {
	query := url.Values{
		"crs":            {crs},
		"from":           {from.Format(time.RFC3339)},
		"window":         {strconv.Itoa(boardWindowMinutes)},
		"limit":          {strconv.Itoa(boardLimit)},
		"passenger_only": {"true"},
		"modes":          {"train"},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, b.endpoint+"?"+query.Encode(), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	response, err := b.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	switch response.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return nil, fmt.Errorf("%w %q", ErrUnknownStation, crs)
	default:
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return nil, fmt.Errorf("departure board for %s: status %d: %s", crs, response.StatusCode, strings.TrimSpace(string(body)))
	}
	var board struct {
		Services []Service `json:"services"`
	}
	if err := json.NewDecoder(response.Body).Decode(&board); err != nil {
		return nil, fmt.Errorf("departure board for %s: %w", crs, err)
	}
	return board.Services, nil
}
