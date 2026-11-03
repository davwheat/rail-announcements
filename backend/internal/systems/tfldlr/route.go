package tfldlr

import (
	"slices"
	"sort"
)

type station struct {
	Name string `json:"name"`
	// Clip is the bare station name.
	Clip string `json:"clip"`
	// ApproachClip is the name used when approaching, which for some stations
	// carries a suffix such as "for ExCeL West".
	ApproachClip string `json:"approachClip"`
	// DockedClip is the name used when docked at the station.
	DockedClip string `json:"dockedClip"`
	// DepartureClip is the name used as a destination, and when departing
	// towards the station as the train's terminus.
	DepartureClip string `json:"departureClip"`
	// Belongings marks a station whose messages end with a reminder to take
	// belongings.
	Belongings bool `json:"belongings"`
	// SDO marks a platform too short for a three-car train, so selective door
	// opening applies.
	SDO bool `json:"sdo"`
	// MindTheGap marks a station whose docked message opens with "Mind the gap
	// please".
	MindTheGap bool `json:"mindTheGap"`
}

type destination struct {
	ID string `json:"id"`
	// Station is the station the train finally terminates at.
	Station string `json:"station"`
	// Via is a station the train runs to first, which the destination names
	// until the train nears it.
	Via  string `json:"via"`
	Clip string `json:"clip"`
}

// oneWayLink is a link out of From which only a train that reached From from
// ArrivingFrom may take. Trains from Limehouse towards Canary Wharf use the
// diveunder, which has no platform at West India Quay; trains the other way
// still call there, and a train from Poplar cannot reach the diveunder without
// reversing.
type oneWayLink struct {
	From         string `json:"from"`
	To           string `json:"to"`
	ArrivingFrom string `json:"arrivingFrom"`
}

// buildLinks indexes the lines by station. Each station's links keep the order
// the lines add them in, because the search below returns the first shortest
// path it reaches and that decides which interchange clip plays.
func buildLinks(lines [][]string) map[string][]string {
	links := map[string][]string{}
	for _, line := range lines {
		for i := 1; i < len(line); i++ {
			links[line[i-1]] = append(links[line[i-1]], line[i])
			links[line[i]] = append(links[line[i]], line[i-1])
		}
	}
	return links
}

type route struct {
	destination destination
	// path holds every station from the origin to the destination, in order.
	// It is empty when the network has no such route.
	path []string
	// viaIndex is the position in path of the destination's via station, or -1
	// when the destination has none.
	viaIndex int
}

type position struct {
	route   route
	station station
	// previous, beforePrevious and following are empty where the TypeScript
	// leaves undefined, which no station name can collide with.
	previous       string
	beforePrevious string
	following      string
	terminating    bool
}

func (s *System) getStation(name string) (station, bool) {
	found, ok := s.stations[name]
	return found, ok
}

// nodesFor maps a station name onto its graph nodes. Stratford's two DLR
// stations share a name but not tracks — the terminus of the line from Poplar,
// and the through platforms on the Stratford International branch — so they are
// separate nodes and no route runs from one line onto the other.
func (s *System) nodesFor(stationName string) []string {
	if stationName == "Stratford" {
		return []string{"Stratford", s.tables.StratfordLowLevel}
	}
	return []string{stationName}
}

func (s *System) shortestNodePath(from, to string) []string {
	// An entry with an empty value is the start node, which arrived from
	// nowhere; absence means not yet reached.
	cameFrom := map[string]string{from: ""}
	queue := []string{from}

	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]

		if node == to {
			var path []string
			for step := node; step != ""; step = cameFrom[step] {
				path = append([]string{step}, path...)
			}
			return path
		}

		arrivedFrom := cameFrom[node]
		var next []string
		for _, link := range s.tables.OneWayLinks {
			if link.From == node && (arrivedFrom == "" || arrivedFrom == link.ArrivingFrom) {
				next = append(next, link.To)
			}
		}
		next = append(next, s.links[node]...)

		for _, candidate := range next {
			if _, seen := cameFrom[candidate]; !seen {
				cameFrom[candidate] = node
				queue = append(queue, candidate)
			}
		}
	}

	return nil
}

func (s *System) findPath(origin, destination string) []string {
	var candidates [][]string
	for _, from := range s.nodesFor(origin) {
		for _, to := range s.nodesFor(destination) {
			if found := s.shortestNodePath(from, to); found != nil {
				candidates = append(candidates, found)
			}
		}
	}
	// The TypeScript sorts by length, and Array.prototype.sort is stable, so
	// equal-length candidates keep origin-then-destination node order.
	sort.SliceStable(candidates, func(i, j int) bool { return len(candidates[i]) < len(candidates[j]) })
	if len(candidates) == 0 {
		return nil
	}

	path := make([]string, len(candidates[0]))
	for i, node := range candidates[0] {
		if node == s.tables.StratfordLowLevel {
			node = "Stratford"
		}
		path[i] = node
	}
	return path
}

func (s *System) resolveRoute(origin, destinationID string) (route, bool) {
	index := slices.IndexFunc(s.tables.AllDestinations, func(dest destination) bool { return dest.ID == destinationID })
	if index < 0 {
		return route{}, false
	}
	found := s.tables.AllDestinations[index]

	if found.Via != "" {
		toVia := s.findPath(origin, found.Via)
		fromVia := s.findPath(found.Via, found.Station)

		if len(toVia) > 0 && len(fromVia) > 0 {
			return route{destination: found, path: append(slices.Clone(toVia), fromVia[1:]...), viaIndex: len(toVia) - 1}, true
		}
	}

	return route{destination: found, path: s.findPath(origin, found.Station), viaIndex: -1}, true
}

func (s *System) locate(r route, stationName string) (position, bool) {
	found, ok := s.getStation(stationName)
	if !ok {
		return position{}, false
	}

	index := slices.Index(r.path, stationName)
	located := position{route: r, station: found}
	if index > 0 {
		located.previous = r.path[index-1]
	}
	if index > 1 {
		located.beforePrevious = r.path[index-2]
	}
	if index >= 0 {
		if index+1 < len(r.path) {
			located.following = r.path[index+1]
		}
		located.terminating = index == len(r.path)-1
	} else {
		located.terminating = stationName == r.destination.Station
	}
	return located, true
}

func (s *System) locateNextStation(options serviceOptions) (position, bool) {
	r, ok := s.resolveRoute(options.Origin.Value(), options.Destination.Value())
	if !ok {
		return position{}, false
	}
	return s.locate(r, options.NextStation.Value())
}

// destinationClip is the destination as announced on the way to a station. A
// via destination drops its "via" once the train is heading for the via
// station.
func (s *System) destinationClip(r route, stationName string) string {
	index := slices.Index(r.path, stationName)
	if r.viaIndex >= 0 && index >= 0 && index < r.viaIndex {
		return r.destination.Clip
	}
	if terminus, ok := s.getStation(r.destination.Station); ok {
		return terminus.DepartureClip
	}
	return r.destination.Clip
}

func bypassesWestIndiaQuay(p position) bool {
	path := p.route.path
	for i, name := range path {
		if name == "Westferry" && i+1 < len(path) && path[i+1] == "Canary Wharf" {
			return true
		}
	}
	return false
}
