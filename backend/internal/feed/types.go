// Package feed holds Darwin Browser's announcement stream: its messages as
// plain structs, the protobuf decoding, and the client that keeps a station
// subscribed.
//
// The JSON tags spell each message the way the websites' TypeScript types do,
// which is also the shape of the fixtures in testdata. The parity tests load
// announcements in that shape, so the tags are part of the test contract.
package feed

import (
	"encoding/json"
	"time"
)

// Instant is a wire timestamp that might be missing or unreadable. The queue
// treats either as already expired, so neither may fail decoding.
type Instant struct {
	Time  time.Time
	Valid bool
}

func At(t time.Time) Instant { return Instant{Time: t, Valid: true} }

func (i *Instant) UnmarshalJSON(data []byte) error {
	*i = Instant{}
	var text *string
	if err := json.Unmarshal(data, &text); err != nil || text == nil {
		return nil
	}
	if t, err := time.Parse(time.RFC3339Nano, *text); err == nil {
		*i = At(t)
	}
	return nil
}

func (i Instant) MarshalJSON() ([]byte, error) {
	if !i.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(i.Time.UTC().Format(time.RFC3339Nano))
}

type AnnouncementType string

const (
	Next               AnnouncementType = "next"
	Approaching        AnnouncementType = "approaching"
	Standing           AnnouncementType = "standing"
	Disrupted          AnnouncementType = "disrupted"
	Passing            AnnouncementType = "passing"
	PlatformAlteration AnnouncementType = "platform_alteration"
)

var AnnouncementTypes = []AnnouncementType{Next, Approaching, Standing, Disrupted, Passing, PlatformAlteration}

type Location struct {
	TPL  string  `json:"tpl"`
	CRS  *string `json:"crs"`
	Name *string `json:"name"`
}

type Times struct {
	Planned      Instant `json:"planned"`
	Estimated    Instant `json:"estimated"`
	Actual       Instant `json:"actual"`
	UnknownDelay bool    `json:"unknown_delay"`
}

type Platform struct {
	Number     *string `json:"number"`
	Confirmed  *bool   `json:"confirmed"`
	Suppressed *bool   `json:"suppressed"`
	Source     *string `json:"source"`
}

type Reason struct {
	Code *string `json:"code"`
	Text *string `json:"text"`
}

type Via struct {
	Text string   `json:"text"`
	Locs []string `json:"locs"`
}

type Endpoint struct {
	Location
	Via      *Via    `json:"via"`
	AssocRID *string `json:"assoc_rid"`
	AssocCat *string `json:"assoc_cat"`
}

type Call struct {
	Location
	ID               string    `json:"id"`
	Arrival          Times     `json:"arrival"`
	Departure        Times     `json:"departure"`
	Platform         Platform  `json:"platform"`
	Cancelled        bool      `json:"cancelled"`
	Activities       *string   `json:"activities"`
	Operational      bool      `json:"operational"`
	DetachFront      *bool     `json:"detach_front"`
	FalseDestination *Location `json:"false_destination"`
	CoachCount       *int      `json:"coach_count"`
	// FormationChange is the coaches that leave or join the train at this
	// call. Nil when none do, or when nothing says.
	FormationChange *FormationChange `json:"formation_change,omitempty"`
}

// FormationChange is how a train's formation changes at a call while it stays
// one service: coaches left behind there, or coaches coupled on. A portion that
// divides off or joins as a service of its own is a Portion instead.
type FormationChange struct {
	Detached *FormationPart `json:"detached"`
	Attached *FormationPart `json:"attached"`
}

// FormationPart is the coaches that leave or join a train.
type FormationPart struct {
	// Coaches is how many passenger coaches, or nil when unknown.
	Coaches *int `json:"coaches"`
	// Position is the end of the train, as it arrives, that coaches which
	// leave are at: "front" or "rear". Nil for coaches that join.
	Position *string `json:"position"`
}

type Portion struct {
	Headcode     *string   `json:"headcode"`
	Mode         *string   `json:"mode"`
	OperatorCode *string   `json:"operator_code"`
	OperatorName *string   `json:"operator_name"`
	Origin       *Location `json:"origin"`
	Destination  *Location `json:"destination"`
	RID          string    `json:"rid"`
	Category     string    `json:"category"`
	At           Location  `json:"at"`
	Cancelled    bool      `json:"cancelled"`
	Available    bool      `json:"available"`
	CoachCount   *int      `json:"coach_count"`
	Position     *string   `json:"position"`
	Calls        []Call    `json:"calls"`
	// Main is whether the service that holds this association is its main
	// service. Passengers leave the main service of a link for the associated
	// one. The main service of a join is the train that is joined, and of a
	// division the train that divides, so false means that the movement's
	// service is the portion that joins or divides off. It is nil when Darwin
	// hasn't said which end is which.
	Main *bool `json:"main"`
	// Links are the links this portion's own service hands its passengers to,
	// each with its own in turn.
	Links []Portion `json:"links"`
}

type Coach struct {
	Number         string `json:"number"`
	LoadingPercent *int   `json:"loading_percent"`
}

// Movement carries what the announcements read. The stream's signalling
// evidence, train order and coach facilities are not spoken, so they are not
// decoded.
type Movement struct {
	ID               string     `json:"id"`
	RID              string     `json:"rid"`
	Station          Location   `json:"station"`
	Kind             string     `json:"kind"`
	Mode             string     `json:"mode"`
	UID              *string    `json:"uid"`
	Headcode         *string    `json:"headcode"`
	OperatorCode     *string    `json:"operator_code"`
	OperatorName     *string    `json:"operator_name"`
	Arrival          Times      `json:"arrival"`
	Departure        Times      `json:"departure"`
	Passing          Times      `json:"passing"`
	Platform         Platform   `json:"platform"`
	Cancelled        bool       `json:"cancelled"`
	CancelReason     Reason     `json:"cancel_reason"`
	DelayReason      Reason     `json:"delay_reason"`
	CoachCount       *int       `json:"coach_count"`
	LoadingPercent   *int       `json:"loading_percent"`
	Coaches          []Coach    `json:"coaches"`
	ReverseFormation *bool      `json:"reverse_formation"`
	FalseDestination *Location  `json:"false_destination"`
	Origins          []Endpoint `json:"origins"`
	Destinations     []Endpoint `json:"destinations"`
	CallingPoints    []Call     `json:"calling_points"`
	Portions         []Portion  `json:"portions"`
}

type Announcement struct {
	EventID           string           `json:"event_id"`
	MovementID        string           `json:"movement_id"`
	Station           Location         `json:"station"`
	Type              AnnouncementType `json:"announcement_type"`
	CreatedAt         Instant          `json:"created_at"`
	ExpiresAt         Instant          `json:"expires_at"`
	Details           Movement         `json:"details"`
	AffectedPlatforms []string         `json:"affected_platforms"`
	PreviousPlatform  *string          `json:"previous_platform"`
	NewPlatform       *string          `json:"new_platform"`
}

type Ready struct {
	Station Location `json:"station"`
	Healthy bool     `json:"healthy"`
}

type Retraction struct {
	EventID string `json:"event_id"`
	Reason  string `json:"reason"`
}

type Revision struct {
	EventID    string   `json:"event_id"`
	MovementID string   `json:"movement_id"`
	Details    Movement `json:"details"`
}

type Heartbeat struct{}

// Platforms returns the platforms an announcement speaks on. A passing train
// warns every platform it affects. A nil entry is a train with no platform.
func (a Announcement) Platforms() []*string {
	if a.Type == Passing {
		out := make([]*string, len(a.AffectedPlatforms))
		for i := range a.AffectedPlatforms {
			out[i] = &a.AffectedPlatforms[i]
		}
		return out
	}
	if a.NewPlatform != nil && *a.NewPlatform != "" {
		return []*string{a.NewPlatform}
	}
	return []*string{a.Details.Platform.Number}
}
