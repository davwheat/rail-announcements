package queue

import (
	"fmt"
	"strings"
	"time"
	_ "time/tzdata"

	"rail-announcements-backend/internal/feed"
)

var names = map[feed.AnnouncementType]string{
	feed.Next:               "next train",
	feed.Approaching:        "approaching train",
	feed.Standing:           "standing train",
	feed.Disrupted:          "disruption",
	feed.Passing:            "fast train warning",
	feed.PlatformAlteration: "platform alteration",
}

var london = func() *time.Location {
	location, err := time.LoadLocation("Europe/London")
	if err != nil {
		panic(err)
	}
	return location
}()

// Name is the announcement type as a log reader knows it.
func Name(t feed.AnnouncementType) string {
	if name, ok := names[t]; ok {
		return name
	}
	return string(t)
}

func text(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func first(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

// DescribeMovement names a train the way its platform sees it: headcode,
// booked time in London, and where it is going.
func DescribeMovement(m feed.Movement) string {
	clock := "??:??"
	for _, instant := range []feed.Instant{m.Departure.Planned, m.Arrival.Planned, m.Passing.Planned} {
		if instant.Valid {
			clock = instant.Time.In(london).Format("15:04")
			break
		}
	}
	destination := ""
	for i, endpoint := range m.Destinations {
		if i == 0 || text(endpoint.AssocRID) == "" {
			destination = text(endpoint.Name)
		}
		if text(endpoint.AssocRID) == "" {
			break
		}
	}
	return fmt.Sprintf("%s (%s to %s)", first(text(m.Headcode), m.RID, m.ID), clock, first(destination, "an unknown destination"))
}

func Describe(a feed.Announcement) string {
	train := DescribeMovement(a.Details)
	if a.Type == feed.PlatformAlteration {
		return fmt.Sprintf("platform alteration for %s, platform %s to %s", train, first(text(a.PreviousPlatform), "?"), first(text(a.NewPlatform), "?"))
	}
	platforms := platformsOf(a)
	where := ", with no platform allocated"
	switch {
	case len(platforms) == 1:
		where = " on platform " + platforms[0]
	case len(platforms) > 1:
		where = " on platform " + strings.Join(platforms[:len(platforms)-1], ", ") + " and " + platforms[len(platforms)-1]
	}
	return Name(a.Type) + " for " + train + where
}

func platformsOf(a feed.Announcement) []string {
	var out []string
	for _, platform := range a.Platforms() {
		if text(platform) != "" {
			out = append(out, *platform)
		}
	}
	return out
}
