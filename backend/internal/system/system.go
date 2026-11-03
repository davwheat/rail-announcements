// Package system is the registry between the HTTP API and the ported systems.
// The website posts the state of one of its tabs, and the system answers with
// the clips that tab would play. Every system the website registers has a
// package under internal/systems, tested against the website's own output; a
// new system joins by implementing System and being added to All.
package system

import (
	"encoding/json"

	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/ameycelia"
	"rail-announcements-backend/internal/systems/ameyphil"
	"rail-announcements-backend/internal/systems/banedanmark"
	"rail-announcements-backend/internal/systems/fgwtrainfx"
	"rail-announcements-backend/internal/systems/lnerazuma"
	"rail-announcements-backend/internal/systems/northerntrainfx"
	"rail-announcements-backend/internal/systems/scotrailstn"
	"rail-announcements-backend/internal/systems/snclass377"
	"rail-announcements-backend/internal/systems/tfldlr"
	"rail-announcements-backend/internal/systems/tflelizline"
	"rail-announcements-backend/internal/systems/tfljubileeline"
	"rail-announcements-backend/internal/systems/tflnorthernline"
	"rail-announcements-backend/internal/systems/tflpiccadillyline"
	"rail-announcements-backend/internal/systems/tfwtelevic"
	"rail-announcements-backend/internal/systems/tfwtrainfx"
	"rail-announcements-backend/internal/systems/tlclass700"
)

type System interface {
	// ID is the website's ID for the system, such as AMEY_PHIL_V1.
	ID() string
	Name() string
	// FilePrefix is the system's directory in the audio library.
	FilePrefix() string
	// Announcements are the website's tab IDs that Plan accepts.
	Announcements() []string
	// Plan builds what the tab would play in the given state, which is the
	// tab's own option object as the website holds it.
	Plan(announcement string, state json.RawMessage) (plan.Plan, error)
}

// All lists every system this service can speak for.
var All = []System{
	load(ameycelia.New),
	load(ameyphil.New),
	load(banedanmark.New),
	load(fgwtrainfx.New),
	load(lnerazuma.New),
	load(northerntrainfx.New),
	load(scotrailstn.New),
	load(snclass377.New),
	load(tfldlr.New),
	load(tflelizline.New),
	load(tfljubileeline.New),
	load(tflnorthernline.New),
	load(tflpiccadillyline.New),
	load(tfwtelevic.New),
	load(tfwtrainfx.New),
	load(tlclass700.New),
}

// load builds a system at start-up. A system fails to build only when its
// embedded data is broken, which no request could recover from.
func load[S System](construct func() (S, error)) System {
	sys, err := construct()
	if err != nil {
		panic(err)
	}
	return sys
}

func ByID(id string) System {
	for _, s := range All {
		if s.ID() == id {
			return s
		}
	}
	return nil
}
