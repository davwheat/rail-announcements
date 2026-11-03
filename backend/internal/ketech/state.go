package ketech

import (
	"encoding/json"
	"fmt"

	"rail-announcements-backend/internal/plan"
)

// Announcements are the website's tab IDs for the announcements a posted state
// can describe.
var Announcements = []string{"nextTrain", "standingTrain", "disruptedTrain", "fastTrain", "approachingTrain", "platformAlteration"}

// PlanState builds the announcement that a website tab in the given state
// plays. The state is the tab's own option object, unchanged.
func (v *Voice) PlanState(announcement string, state json.RawMessage) (plan.Plan, error) {
	var route routeState
	decode := func(into any) error {
		if err := json.Unmarshal(state, into); err != nil {
			return fmt.Errorf("state: %w", err)
		}
		return json.Unmarshal(state, &route)
	}
	switch announcement {
	case "nextTrain", "standingTrain":
		var o TrainOptions
		if err := decode(&o); err != nil {
			return plan.Plan{}, err
		}
		if announcement == "nextTrain" {
			return v.NextTrain(o)
		}
		return v.StandingTrain(o)

	case "fastTrain":
		var o FastTrainOptions
		if err := decode(&o); err != nil {
			return plan.Plan{}, err
		}
		return v.FastTrain(o)

	case "disruptedTrain":
		var o DisruptedOptions
		err := decode(&o)
		if err == nil {
			o.Destinations, err = route.destinations()
		}
		if err == nil {
			o.Reason, err = route.reason()
		}
		if err != nil {
			return plan.Plan{}, err
		}
		return v.DisruptedTrain(o)

	case "approachingTrain":
		var o ApproachingOptions
		err := decode(&o)
		if err == nil {
			o.Destinations, err = route.destinations()
		}
		if err == nil {
			o.Origins, _, err = oneOrMany(route.OriginStationCode)
		}
		if err != nil {
			return plan.Plan{}, err
		}
		return v.TrainApproaching(o)

	case "platformAlteration":
		var o AlterationOptions
		err := decode(&o)
		if err == nil {
			o.Destinations, err = route.destinations()
		}
		if err != nil {
			return plan.Plan{}, err
		}
		return v.PlatformAlteration(o)
	}
	return plan.Plan{}, fmt.Errorf("unknown announcement %q", announcement)
}
