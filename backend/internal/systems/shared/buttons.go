// Package shared holds what every ported announcement system needs and none
// of them should write twice.
package shared

import (
	"encoding/json"
	"fmt"

	"rail-announcements-backend/internal/plan"
)

// Buttons are a system's one-press announcements. A button always plays the
// same clips, so the website exports them as data: tab ID -> section -> label
// -> plan. No system ports them by hand.
type Buttons map[string]map[string]map[string]plan.Plan

// ParseButtons reads a system's data/buttons.json.
func ParseButtons(raw []byte) (Buttons, error) {
	var out Buttons
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("buttons: %w", err)
	}
	return out, nil
}

// Tabs lists the button tabs, in no particular order.
func (b Buttons) Tabs() []string {
	tabs := make([]string, 0, len(b))
	for tab := range b {
		tabs = append(tabs, tab)
	}
	return tabs
}

// Has reports whether tab is a button tab.
func (b Buttons) Has(tab string) bool { _, ok := b[tab]; return ok }

// Plan returns what a button plays. The state names it, as the website posts
// it: {"section": "Safety", "label": "Mind the gap"}.
func (b Buttons) Plan(tab string, state json.RawMessage) (plan.Plan, error) {
	var button struct {
		Section string `json:"section"`
		Label   string `json:"label"`
	}
	if err := json.Unmarshal(state, &button); err != nil {
		return plan.Plan{}, fmt.Errorf("state: %w", err)
	}
	found, ok := b[tab][button.Section][button.Label]
	if !ok {
		return plan.Plan{}, fmt.Errorf("no button %q in section %q", button.Label, button.Section)
	}
	return found, nil
}
