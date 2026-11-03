package tfldlr

import (
	"fmt"
	"reflect"
	"strings"
)

// interchangeClips is the export's Interchange table. Message numbers in the
// comments below are the DLR AVIS interface definition's (4016/AVIS2/0676
// issue 14).
type interchangeClips struct {
	Jubilee                                      string `json:"jubilee"`
	JubileeAndLocalBus                           string `json:"jubileeAndLocalBus"`
	JubileeElizabethGreenwichLewisham            string `json:"jubileeElizabethGreenwichLewisham"`
	DistrictHammersmithAtBowRoad                 string `json:"districtHammersmithAtBowRoad"`
	NationalRail                                 string `json:"nationalRail"`
	TowardsBecktonAndCityAirport                 string `json:"towardsBecktonAndCityAirport"`
	TowardsBecktonCityAirportBankAndTowerGateway string `json:"towardsBecktonCityAirportBankAndTowerGateway"`
	TowardsBecktonJubileeAndLocalBus             string `json:"towardsBecktonJubileeAndLocalBus"`
	TowardsCanaryWharfAndLewisham                string `json:"towardsCanaryWharfAndLewisham"`
	TowardsStratford                             string `json:"towardsStratford"`
	TowardsStratfordCanaryWharfAndLewisham       string `json:"towardsStratfordCanaryWharfAndLewisham"`
	ForLondonUnderground                         string `json:"forLondonUnderground"`
	ForDistrictHammersmithAtBowRoad              string `json:"forDistrictHammersmithAtBowRoad"`
	ForDistrictCircleAtTowerHill                 string `json:"forDistrictCircleAtTowerHill"`
	ForJubileeAndLocalBus                        string `json:"forJubileeAndLocalBus"`
	ForNationalRailAndLocalBus                   string `json:"forNationalRailAndLocalBus"`
	ForTowardsBecktonViaStairs                   string `json:"forTowardsBecktonViaStairs"`
}

// elizabethLineEraClips is the export's ElizabethLineEra table, the wording
// recorded once the Elizabeth line opened.
type elizabethLineEraClips struct {
	JubileeElizabeth                         string `json:"jubileeElizabeth"`
	JubileeElizabethBankTowerGateway         string `json:"jubileeElizabethBankTowerGateway"`
	JubileeElizabethStratford                string `json:"jubileeElizabethStratford"`
	Elizabeth                                string `json:"elizabeth"`
	Stratford                                string `json:"stratford"`
	CableCarAndCityHall                      string `json:"cableCarAndCityHall"`
	ForJubileeElizabethGreenwichLewisham     string `json:"forJubileeElizabethGreenwichLewisham"`
	ForElizabeth                             string `json:"forElizabeth"`
	ForElizabethRiverNationalRailAndLocalBus string `json:"forElizabethRiverNationalRailAndLocalBus"`
	ForStratford                             string `json:"forStratford"`
}

// requireClips names every clip the export left empty, so that a key renamed in
// the website fails at start-up instead of playing silence.
func requireClips(table string, clips any) error {
	value := reflect.ValueOf(clips)
	var missing []string
	for i := range value.NumField() {
		if value.Field(i).String() == "" {
			missing = append(missing, value.Type().Field(i).Tag.Get("json"))
		}
	}
	if len(missing) == 0 {
		return nil
	}
	return fmt.Errorf("module: %s has no %s", table, strings.Join(missing, ", "))
}

// approachMessage is the clips which follow the station name in an approach
// message.
func (s *System) approachMessage(p position, elizabethLine bool) []string {
	if p.terminating {
		return s.terminalMessage(p, elizabethLine)
	}
	return s.interchangeMessage(p, elizabethLine)
}

func (s *System) interchangeMessage(p position, elizabethLine bool) []string {
	interchange, era := s.tables.Interchange, s.tables.ElizabethLineEra

	switch p.station.Name {
	case "Bow Church":
		return []string{interchange.DistrictHammersmithAtBowRoad}

	case "Canary Wharf":
		jubilee := interchange.Jubilee
		if elizabethLine {
			jubilee = era.JubileeElizabeth
		}

		// 187: trains which came through the diveunder.
		if p.previous == "Westferry" {
			return []string{jubilee, s.tables.Clips.AndDlrToWestIndiaQuay}
		}

		if p.previous == "West India Quay" {
			// 140: trains which reverse here. Only the Elizabeth line wording
			// was recorded.
			if p.following == "West India Quay" {
				if elizabethLine {
					return []string{interchange.JubileeElizabethGreenwichLewisham}
				}
				return []string{interchange.Jubilee}
			}

			// 139: trains from Bank and Tower Gateway.
			if p.beforePrevious == "Westferry" {
				if elizabethLine {
					return []string{era.JubileeElizabethStratford}
				}
				return []string{interchange.TowardsStratford}
			}

			// 138: trains from Stratford and Beckton. Only the Elizabeth line
			// wording was recorded.
			if elizabethLine {
				return []string{era.JubileeElizabethBankTowerGateway}
			}
			return []string{interchange.Jubilee}
		}

		return []string{jubilee}

	// 185 for trains on the Woolwich Arsenal branch, 141 otherwise.
	case "Canning Town":
		if p.previous == "West Silvertown" || p.following == "West Silvertown" {
			return []string{interchange.TowardsBecktonJubileeAndLocalBus}
		}
		return []string{interchange.JubileeAndLocalBus}

	case "Custom House":
		if elizabethLine {
			return []string{era.Elizabeth}
		}
		return nil

	case "Greenwich":
		return []string{interchange.NationalRail}

	// 154 northbound. Southbound trains have just left the Jubilee line
	// interchange at Canary Wharf.
	case "Heron Quays":
		if p.previous == "South Quay" {
			return []string{interchange.Jubilee}
		}
		return nil

	case "Limehouse":
		return []string{interchange.NationalRail}

	// 161 to 168: what is worth changing for depends on which of the four
	// lines the train came from.
	case "Poplar":
		switch p.previous {
		case "All Saints":
			return []string{interchange.TowardsBecktonCityAirportBankAndTowerGateway}
		case "Blackwall":
			return []string{interchange.TowardsStratford}
		case "Westferry":
			if p.following == "All Saints" {
				return []string{interchange.TowardsBecktonAndCityAirport}
			}
			return []string{interchange.TowardsStratfordCanaryWharfAndLewisham}
		case "West India Quay":
			if p.following == "Blackwall" {
				return []string{interchange.TowardsStratford}
			}
			return []string{interchange.TowardsBecktonAndCityAirport}
		}
		return nil

	case "Royal Victoria":
		if elizabethLine {
			return []string{era.CableCarAndCityHall}
		}
		return nil

	case "Stratford":
		if elizabethLine {
			return []string{era.Stratford}
		}
		return nil

	// 181 to 184: trains to or from Canary Wharf offer the Beckton lines, and
	// those to or from Poplar offer Canary Wharf.
	case "Westferry":
		for _, neighbour := range []string{p.previous, p.following} {
			if neighbour == "West India Quay" || neighbour == "Canary Wharf" {
				return []string{interchange.TowardsBecktonAndCityAirport}
			}
		}
		if p.previous == "Poplar" || p.following == "Poplar" {
			return []string{interchange.TowardsCanaryWharfAndLewisham}
		}
		return nil
	}

	return nil
}

func (s *System) terminalMessage(p position, elizabethLine bool) []string {
	interchange, era := s.tables.Interchange, s.tables.ElizabethLineEra

	allChange := func(follows ...string) []string {
		return append([]string{s.tables.Clips.WhereThisTrainWillTerminateAllChange}, follows...)
	}

	switch p.station.Name {
	case "Bank":
		return allChange(interchange.ForLondonUnderground)

	case "Bow Church":
		return allChange(interchange.ForDistrictHammersmithAtBowRoad)

	// 649 from the north, where passengers can continue south. 688 from the
	// south.
	case "Canary Wharf":
		if p.previous == "Heron Quays" {
			return []string{s.tables.Clips.WhereThisTrainWillTerminateBelongings}
		}
		if elizabethLine {
			return allChange(era.ForJubileeElizabethGreenwichLewisham)
		}
		return allChange()

	// Trains from the Stratford International branch arrive at the upper
	// platforms, away from the Beckton trains.
	case "Canning Town":
		if p.previous == "Star Lane" {
			return allChange(interchange.ForTowardsBecktonViaStairs)
		}
		return allChange(interchange.ForJubileeAndLocalBus)

	case "Custom House":
		if elizabethLine {
			return allChange(era.ForElizabeth)
		}
		return []string{s.tables.Clips.WhereThisTrainWillTerminateBelongings}

	case "Cutty Sark":
		return allChange()

	case "Lewisham":
		return allChange(interchange.ForNationalRailAndLocalBus)

	case "Stratford":
		if elizabethLine {
			return allChange(era.ForStratford)
		}
		return allChange()

	case "Tower Gateway":
		return allChange(interchange.ForDistrictCircleAtTowerHill, s.tables.Clips.LeaveFromRightHandSide)

	case "Woolwich Arsenal":
		if elizabethLine {
			return allChange(era.ForElizabethRiverNationalRailAndLocalBus)
		}
		return allChange(interchange.ForNationalRailAndLocalBus)
	}

	return []string{s.tables.Clips.WhereThisTrainWillTerminateBelongings}
}
