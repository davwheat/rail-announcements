// Package ameyphil is the Amey/KeTech system in one voice, as the website
// registers it. The announcements are internal/ketech's, and the button tab is
// the website's exported data.
package ameyphil

import (
	_ "embed"
	"encoding/json"

	"rail-announcements-backend/internal/ketech"
	"rail-announcements-backend/internal/plan"
	"rail-announcements-backend/internal/systems/shared"
)

//go:embed data/buttons.json
var buttonData []byte

type System struct {
	voice   *ketech.Voice
	buttons shared.Buttons
}

func New() (*System, error) {
	buttons, err := shared.ParseButtons(buttonData)
	return &System{voice: voiceOf(), buttons: buttons}, err
}

func (s *System) ID() string         { return s.voice.ID }
func (s *System) Name() string       { return s.voice.Name }
func (s *System) FilePrefix() string { return s.voice.FilePrefix }

func (s *System) Announcements() []string {
	return append(append([]string{}, ketech.Announcements...), s.buttons.Tabs()...)
}

func (s *System) Plan(announcement string, state json.RawMessage) (plan.Plan, error) {
	if s.buttons.Has(announcement) {
		return s.buttons.Plan(announcement, state)
	}
	return s.voice.PlanState(announcement, state)
}

func voiceOf() *ketech.Voice { return ketech.Phil }
