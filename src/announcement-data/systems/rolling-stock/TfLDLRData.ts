// Message structure follows the DLR AVIS interface definition (4016/AVIS2/0676 issue 14). Message
// numbers in comments refer to that document. Behaviour the document predates, such as Elizabeth line
// wording, was taken from an on-train recording of a Bank to Lewisham service.

import type { AudioItem } from '../../AnnouncementSystem'

// Measured from the on-train recording: the real system plays clips back to back, and the only added
// pause comes before "at <station>" in the selective door opening warning.
export const SDO_WARNING_PAUSE = 460

export const Clips = {
  thisTrainIsFor: 'phrase.this train is for',
  theNextStopIs: 'phrase.the next stop is',
  thisIs: 'phrase.this is',
  whereThisTrainTerminates: 'phrase.where this train terminates',
  whereThisTrainWillTerminateAllChange: 'phrase.where this train will terminate all change',
  whereThisTrainWillTerminateBelongings: 'phrase.where this train will terminate please remember to take all your belongings with you',
  theTrainWillTerminateAllChange: 'phrase.the train will terminate all change',
  theTrainWillTerminateBelongings: 'phrase.the train will terminate please remember to take all your belongings with you',
  thisTrainTerminatesHere: 'phrase.this train terminates here all change please remember to take all your belongings with you',
  pleaseRememberBelongings: 'phrase.please remember to take all your belongings with you',
  whenLeavingBelongings: 'phrase.when leaving the train please remember to take all your belongings with you',
  as: 'phrase.as',
  at: 'phrase.at',
  andDlrToWestIndiaQuay: 'phrase.and dlr to west india quay',
  toAlightMoveToCentre: 'misc.to alight please move towards the centre of the train',
  firstAndLastDoorsWillNotOpen: 'misc.first and last two sets of doors will not open',
  reverseAtPoplar: 'misc.the next stop is poplar the train will reverse en route',
  wiqBypass: 'misc.this train does not stop at west india quay for west india quay please change at canary wharf',
  wiqBypassPlatform5: 'misc.this train does not stop at west india quay for west india quay please change at canary wharf and go to platform 5',
  leaveFromRightHandSide: 'misc.please leave the train from the right hand side in the direction of travel',
  notInService: 'misc.this train is not in service',
  contactTrainCaptain: 'misc.please contact the train captain or press the passenger alarm immediately',
  mindTheGap: 'misc.mind the gap please',
} as const

export const Interchange = {
  jubilee: 'interchange.change for london underground jubilee line',
  jubileeAndLocalBus: 'interchange.change for london underground jubilee line and local bus services',
  jubileeElizabethGreenwichLewisham:
    'interchange.change for london underground jubilee line elizabeth line and stations towards greenwich and lewisham',
  districtHammersmithAtBowRoad: 'interchange.change for london underground district and hammersmith and city lines at bow road station',
  nationalRail: 'interchange.change for national rail services',
  towardsBecktonAndCityAirport: 'interchange.change for stations towards beckton and london city airport',
  towardsBecktonCityAirportBankAndTowerGateway: 'interchange.change for stations towards beckton london city airport bank and tower gateway',
  towardsBecktonJubileeAndLocalBus: 'interchange.change for stations towards beckton london underground jubilee line and local bus services',
  towardsCanaryWharfAndLewisham: 'interchange.change for stations towards canary wharf and lewisham',
  towardsStratford: 'interchange.change for stations towards stratford',
  towardsStratfordCanaryWharfAndLewisham: 'interchange.change for stations towards stratford canary wharf and lewisham',
  forLondonUnderground: 'interchange.for london underground services',
  forDistrictHammersmithAtBowRoad: 'interchange.for london underground district and hammersmith and city lines at bow road station',
  forDistrictCircleAtTowerHill: 'interchange.for london underground district and circle lines at tower hill station',
  forJubileeAndLocalBus: 'interchange.for london underground jubilee line and local bus services',
  forNationalRailAndLocalBus: 'interchange.for national rail and local bus services',
  forTowardsBecktonViaStairs: 'interchange.for stations towards beckton cross via the stairs to platform 1',
} as const

export const ElizabethLineEra = {
  jubileeElizabeth: 'emma.change for london underground jubilee line and elizabeth line',
  jubileeElizabethBankTowerGateway: 'emma.change for london underground jubilee line elizabeth line and stations towards bank and tower gateway',
  jubileeElizabethStratford: 'emma.change for london underground jubilee line and elizabeth line and stations towards stratford',
  elizabeth: 'emma.change for the elizabeth line',
  stratford:
    'emma.change for london underground central and jubilee lines elizabeth line london overground national rail and local bus services',
  cableCarAndCityHall: 'emma.exit for london cable car and city hall',
  forJubileeElizabethGreenwichLewisham: 'emma.for london underground jubilee line elizabeth line and stations towards greenwich and lewisham',
  forElizabeth: 'emma.for the elizabeth line',
  forElizabethRiverNationalRailAndLocalBus: 'emma.for the elizabeth line river services national rail and local bus services',
  forStratford: 'emma.for london underground central and jubilee lines elizabeth line london overground national rail and local bus services',
} as const

export interface IDlrStation {
  name: string
  /** Bare station name. */
  clip: string
  /** Name used when approaching, which for some stations carries a suffix such as "for ExCeL West". */
  approachClip: string
  /** Name used when docked at the station. */
  dockedClip: string
  /** Name used as a destination, and when departing towards the station as the train's terminus. */
  departureClip: string
  /** Whether messages about the station end with a reminder to take belongings. */
  belongings: boolean
  /** The platform is too short for a three-car train, so selective door opening applies. */
  sdo: boolean
  /** The docked message opens with "Mind the gap please", as heard at the station on the on-train recording. */
  mindTheGap: boolean
}

function station(name: string, overrides: Partial<Omit<IDlrStation, 'name'>> = {}): IDlrStation {
  const clip = overrides.clip ?? `station.${name.toLowerCase()}`

  return {
    name,
    clip,
    approachClip: overrides.approachClip ?? clip,
    dockedClip: overrides.dockedClip ?? clip,
    departureClip: overrides.departureClip ?? clip,
    belongings: overrides.belongings ?? false,
    sdo: overrides.sdo ?? false,
    mindTheGap: overrides.mindTheGap ?? false,
  }
}

export const AllStations: IDlrStation[] = [
  station('Abbey Road'),
  station('All Saints', { approachClip: 'station.all saints for chrisp street market', belongings: true }),
  station('Bank', { belongings: true }),
  station('Beckton', { belongings: true }),
  station('Beckton Park'),
  station('Blackwall'),
  station('Bow Church', { belongings: true }),
  station('Bow Creek'),
  station('Canary Wharf', { belongings: true, mindTheGap: true }),
  station('Canning Town', { belongings: true }),
  station('Crossharbour', { belongings: true }),
  // No bare "Custom House" was recorded.
  station('Custom House', { clip: 'station.custom house for excel west', belongings: true }),
  station('Cutty Sark', {
    approachClip: 'station.cutty sark for maritime greenwich alight here',
    departureClip: 'station.cutty sark for maritime greenwich',
    belongings: true,
    sdo: true,
  }),
  station('Cyprus'),
  station('Deptford Bridge'),
  station('Devons Road'),
  station('East India'),
  station('Elverson Road', { sdo: true }),
  station('Gallions Reach', { sdo: true }),
  station('Greenwich', { belongings: true, mindTheGap: true }),
  station('Heron Quays', { belongings: true }),
  station('Island Gardens', { belongings: true, mindTheGap: true }),
  station('King George V'),
  station('Langdon Park'),
  station('Lewisham', { belongings: true }),
  station('Limehouse', { belongings: true }),
  station('London City Airport'),
  station('Mudchute'),
  station('Pontoon Dock'),
  station('Poplar', { belongings: true }),
  station('Prince Regent', {
    approachClip: 'station.prince regent for excel east and icc london',
    dockedClip: 'station.prince regent for excel east and icc london',
    departureClip: 'station.prince regent for excel east and icc london',
    belongings: true,
  }),
  station('Pudding Mill Lane', { belongings: true, sdo: true }),
  station('Royal Albert', { approachClip: 'station.royal albert for west beckton', sdo: true }),
  station('Royal Victoria'),
  station('Shadwell', { belongings: true }),
  station('South Quay', { belongings: true }),
  station('Star Lane'),
  station('Stratford', { belongings: true }),
  station('Stratford High Street'),
  station('Stratford International'),
  station('Thames Wharf'),
  station('Tower Gateway', { belongings: true }),
  station('West Ham'),
  station('West India Quay', { belongings: true }),
  station('West Silvertown'),
  station('Westferry', { belongings: true }),
  station('Woolwich Arsenal'),
]

export function getStation(name: string | undefined): IDlrStation | undefined {
  return AllStations.find(stn => stn.name === name)
}

export interface IDlrDestination {
  id: string
  /** The station the train finally terminates at. */
  station: string
  /** A station the train runs to first, which the destination names until the train nears it. */
  via?: string
  clip: string
}

const ViaDestinations: IDlrDestination[] = [
  { id: 'Bank via Canary Wharf', station: 'Bank', via: 'Canary Wharf', clip: 'destination.bank via canary wharf' },
  { id: 'Beckton via Canary Wharf', station: 'Beckton', via: 'Canary Wharf', clip: 'destination.beckton via canary wharf' },
  { id: 'Canning Town via Canary Wharf', station: 'Canning Town', via: 'Canary Wharf', clip: 'destination.canning town via canary wharf' },
  {
    id: 'King George V via London City Airport',
    station: 'King George V',
    via: 'London City Airport',
    clip: 'destination.king george v via london city airport',
  },
  {
    id: 'London City Airport via Canary Wharf',
    station: 'London City Airport',
    via: 'Canary Wharf',
    clip: 'destination.city airport via canary wharf',
  },
  { id: 'Prince Regent via Canary Wharf', station: 'Prince Regent', via: 'Canary Wharf', clip: 'destination.prince regent via canary wharf' },
  { id: 'Tower Gateway via Canary Wharf', station: 'Tower Gateway', via: 'Canary Wharf', clip: 'destination.tower gateway via canary wharf' },
  {
    id: 'Woolwich Arsenal via Canary Wharf',
    station: 'Woolwich Arsenal',
    via: 'Canary Wharf',
    clip: 'destination.woolwich arsenal via canary wharf',
  },
  {
    id: 'Woolwich Arsenal via London City Airport',
    station: 'Woolwich Arsenal',
    via: 'London City Airport',
    clip: 'destination.woolwich arsenal via london city airport',
  },
]

export const AllDestinations: IDlrDestination[] = AllStations.flatMap(stn => [
  { id: stn.name, station: stn.name, clip: stn.departureClip },
  ...ViaDestinations.filter(dest => dest.station === stn.name),
])

// Stratford's two DLR stations share a name but not tracks: the terminus of the line from Poplar, and
// the through platforms on the Stratford International branch. They're separate nodes so that no
// route runs from one line onto the other.
export const STRATFORD_LOW_LEVEL = 'Stratford (low level)'

export const Lines: string[][] = [
  ['Bank', 'Shadwell'],
  ['Tower Gateway', 'Shadwell', 'Limehouse', 'Westferry', 'Poplar'],
  ['Westferry', 'West India Quay'],
  [
    'Poplar',
    'West India Quay',
    'Canary Wharf',
    'Heron Quays',
    'South Quay',
    'Crossharbour',
    'Mudchute',
    'Island Gardens',
    'Cutty Sark',
    'Greenwich',
    'Deptford Bridge',
    'Elverson Road',
    'Lewisham',
  ],
  ['Poplar', 'All Saints', 'Langdon Park', 'Devons Road', 'Bow Church', 'Pudding Mill Lane', 'Stratford'],
  ['Poplar', 'Blackwall', 'East India', 'Canning Town'],
  ['Canning Town', 'Royal Victoria', 'Custom House', 'Prince Regent', 'Royal Albert', 'Beckton Park', 'Cyprus', 'Gallions Reach', 'Beckton'],
  ['Canning Town', 'West Silvertown', 'Pontoon Dock', 'London City Airport', 'King George V', 'Woolwich Arsenal'],
  ['Stratford International', STRATFORD_LOW_LEVEL, 'Stratford High Street', 'Abbey Road', 'West Ham', 'Star Lane', 'Canning Town'],
]

interface IOneWayLink {
  from: string
  to: string
  /** The link is only reachable by a train which ran into `from` from this station. */
  arrivingFrom: string
}

// Trains from Limehouse towards Canary Wharf use the diveunder, which has no platform at West India
// Quay. Trains the other way still call there, and a train from Poplar can't reach the diveunder
// without reversing.
export const OneWayLinks: IOneWayLink[] = [{ from: 'Westferry', to: 'Canary Wharf', arrivingFrom: 'Limehouse' }]

const Links = new Map<string, string[]>()

function addLink(from: string, to: string): void {
  Links.set(from, [...(Links.get(from) ?? []), to])
}

Lines.forEach(line =>
  line.slice(1).forEach((node, index) => {
    addLink(line[index], node)
    addLink(node, line[index])
  }),
)

function nodesFor(stationName: string): string[] {
  return stationName === 'Stratford' ? ['Stratford', STRATFORD_LOW_LEVEL] : [stationName]
}

function shortestNodePath(from: string, to: string): string[] | null {
  const cameFrom = new Map<string, string | null>([[from, null]])
  const queue = [from]

  while (queue.length) {
    const node = queue.shift()!

    if (node === to) {
      const path: string[] = []

      for (let step: string | null = node; step !== null; step = cameFrom.get(step) ?? null) {
        path.unshift(step)
      }

      return path
    }

    const arrivedFrom = cameFrom.get(node) ?? null
    const oneWay = OneWayLinks.filter(link => link.from === node && (arrivedFrom === null || arrivedFrom === link.arrivingFrom)).map(
      link => link.to,
    )

    for (const next of [...oneWay, ...(Links.get(node) ?? [])]) {
      if (!cameFrom.has(next)) {
        cameFrom.set(next, node)
        queue.push(next)
      }
    }
  }

  return null
}

function findPath(origin: string, destination: string): string[] {
  const candidates = nodesFor(origin)
    .flatMap(from => nodesFor(destination).map(to => shortestNodePath(from, to)))
    .filter((path): path is string[] => path !== null)
    .sort((a, b) => a.length - b.length)

  return (candidates[0] ?? []).map(node => (node === STRATFORD_LOW_LEVEL ? 'Stratford' : node))
}

export interface IDlrRoute {
  destination: IDlrDestination
  /** Every station from the origin to the destination, in order. Empty when the network has no such route. */
  path: string[]
  /** Position in `path` of the destination's via station. */
  viaIndex: number | null
}

export function resolveRoute(origin: string, destinationId: string): IDlrRoute | null {
  const destination = AllDestinations.find(dest => dest.id === destinationId)

  if (!destination) {
    return null
  }

  if (destination.via) {
    const toVia = findPath(origin, destination.via)
    const fromVia = findPath(destination.via, destination.station)

    if (toVia.length && fromVia.length) {
      return { destination, path: [...toVia, ...fromVia.slice(1)], viaIndex: toVia.length - 1 }
    }
  }

  return { destination, path: findPath(origin, destination.station), viaIndex: null }
}

/**
 * The stations a train on the route has yet to reach. A route the network can't produce offers every
 * station, so that reserved stations such as Thames Wharf stay usable.
 */
export function upcomingStations(route: IDlrRoute | null): string[] {
  const upcoming = [...new Set(route?.path.slice(1) ?? [])]

  return upcoming.length ? upcoming : AllStations.map(stn => stn.name)
}

export interface IDlrPosition {
  route: IDlrRoute
  station: IDlrStation
  previous: string | undefined
  beforePrevious: string | undefined
  following: string | undefined
  terminating: boolean
}

export function locate(route: IDlrRoute, stationName: string): IDlrPosition | null {
  const found = getStation(stationName)

  if (!found) {
    return null
  }

  const index = route.path.indexOf(stationName)

  return {
    route,
    station: found,
    previous: index > 0 ? route.path[index - 1] : undefined,
    beforePrevious: index > 1 ? route.path[index - 2] : undefined,
    following: index >= 0 ? route.path[index + 1] : undefined,
    terminating: index >= 0 ? index === route.path.length - 1 : stationName === route.destination.station,
  }
}

/**
 * The destination as announced on the way to a station. A via destination drops its "via" once the
 * train is heading for the via station.
 */
export function destinationClip(route: IDlrRoute, stationName: string): string {
  const index = route.path.indexOf(stationName)
  const beforeVia = route.viaIndex !== null && index >= 0 && index < route.viaIndex

  return beforeVia ? route.destination.clip : (getStation(route.destination.station)?.departureClip ?? route.destination.clip)
}

export function bypassesWestIndiaQuay(position: IDlrPosition): boolean {
  const { path } = position.route

  return path.some((name, index) => name === 'Westferry' && path[index + 1] === 'Canary Wharf')
}

/** Stations whose messages changed when the Elizabeth line opened, and for which both wordings exist. */
export const ElizabethLineEraStations = ['Canary Wharf', 'Custom House', 'Royal Victoria', 'Stratford', 'Woolwich Arsenal']

type MessageRule = (position: IDlrPosition, elizabethLine: boolean) => AudioItem[]

const ApproachRules: Record<string, MessageRule> = {
  'Bow Church': () => [Interchange.districtHammersmithAtBowRoad],

  'Canary Wharf': ({ previous, beforePrevious, following }, elizabethLine) => {
    const jubilee = elizabethLine ? ElizabethLineEra.jubileeElizabeth : Interchange.jubilee

    // 187: trains which came through the diveunder.
    if (previous === 'Westferry') {
      return [jubilee, Clips.andDlrToWestIndiaQuay]
    }

    if (previous === 'West India Quay') {
      // 140: trains which reverse here. Only the Elizabeth line wording was recorded.
      if (following === 'West India Quay') {
        return [elizabethLine ? Interchange.jubileeElizabethGreenwichLewisham : Interchange.jubilee]
      }

      // 139: trains from Bank and Tower Gateway.
      if (beforePrevious === 'Westferry') {
        return [elizabethLine ? ElizabethLineEra.jubileeElizabethStratford : Interchange.towardsStratford]
      }

      // 138: trains from Stratford and Beckton. Only the Elizabeth line wording was recorded.
      return [elizabethLine ? ElizabethLineEra.jubileeElizabethBankTowerGateway : Interchange.jubilee]
    }

    return [jubilee]
  },

  // 185 for trains on the Woolwich Arsenal branch, 141 otherwise.
  'Canning Town': ({ previous, following }) => [
    previous === 'West Silvertown' || following === 'West Silvertown'
      ? Interchange.towardsBecktonJubileeAndLocalBus
      : Interchange.jubileeAndLocalBus,
  ],

  'Custom House': (_, elizabethLine) => (elizabethLine ? [ElizabethLineEra.elizabeth] : []),
  Greenwich: () => [Interchange.nationalRail],

  // 154 northbound. Southbound trains have just left the Jubilee line interchange at Canary Wharf.
  'Heron Quays': ({ previous }) => (previous === 'South Quay' ? [Interchange.jubilee] : []),

  Limehouse: () => [Interchange.nationalRail],

  // 161 to 168: what's worth changing for depends on which of the four lines the train came from.
  Poplar: ({ previous, following }) => {
    switch (previous) {
      case 'All Saints':
        return [Interchange.towardsBecktonCityAirportBankAndTowerGateway]
      case 'Blackwall':
        return [Interchange.towardsStratford]
      case 'Westferry':
        return [following === 'All Saints' ? Interchange.towardsBecktonAndCityAirport : Interchange.towardsStratfordCanaryWharfAndLewisham]
      case 'West India Quay':
        return [following === 'Blackwall' ? Interchange.towardsStratford : Interchange.towardsBecktonAndCityAirport]
      default:
        return []
    }
  },

  'Royal Victoria': (_, elizabethLine) => (elizabethLine ? [ElizabethLineEra.cableCarAndCityHall] : []),
  Stratford: (_, elizabethLine) => (elizabethLine ? [ElizabethLineEra.stratford] : []),

  // 181 to 184: trains to or from Canary Wharf offer the Beckton lines, and those to or from Poplar
  // offer Canary Wharf.
  Westferry: ({ previous, following }) => {
    const neighbours = [previous, following]

    if (neighbours.includes('West India Quay') || neighbours.includes('Canary Wharf')) {
      return [Interchange.towardsBecktonAndCityAirport]
    }

    return neighbours.includes('Poplar') ? [Interchange.towardsCanaryWharfAndLewisham] : []
  },
}

const allChange = (...interchange: AudioItem[]): AudioItem[] => [Clips.whereThisTrainWillTerminateAllChange, ...interchange]

const TerminalRules: Record<string, MessageRule> = {
  Bank: () => allChange(Interchange.forLondonUnderground),
  'Bow Church': () => allChange(Interchange.forDistrictHammersmithAtBowRoad),

  // 649 from the north, where passengers can continue south. 688 from the south.
  'Canary Wharf': ({ previous }, elizabethLine) => {
    if (previous === 'Heron Quays') {
      return [Clips.whereThisTrainWillTerminateBelongings]
    }

    return elizabethLine ? allChange(ElizabethLineEra.forJubileeElizabethGreenwichLewisham) : allChange()
  },

  // Trains from the Stratford International branch arrive at the upper platforms, away from the Beckton trains.
  'Canning Town': ({ previous }) =>
    allChange(previous === 'Star Lane' ? Interchange.forTowardsBecktonViaStairs : Interchange.forJubileeAndLocalBus),

  'Custom House': (_, elizabethLine) =>
    elizabethLine ? allChange(ElizabethLineEra.forElizabeth) : [Clips.whereThisTrainWillTerminateBelongings],
  'Cutty Sark': () => allChange(),
  Lewisham: () => allChange(Interchange.forNationalRailAndLocalBus),
  Stratford: (_, elizabethLine) => (elizabethLine ? allChange(ElizabethLineEra.forStratford) : allChange()),
  'Tower Gateway': () => allChange(Interchange.forDistrictCircleAtTowerHill, Clips.leaveFromRightHandSide),
  'Woolwich Arsenal': (_, elizabethLine) =>
    allChange(elizabethLine ? ElizabethLineEra.forElizabethRiverNationalRailAndLocalBus : Interchange.forNationalRailAndLocalBus),
}

/** The clips which follow the station name in an approach message. */
export function approachMessage(position: IDlrPosition, elizabethLine: boolean): AudioItem[] {
  if (position.terminating) {
    return TerminalRules[position.station.name]?.(position, elizabethLine) ?? [Clips.whereThisTrainWillTerminateBelongings]
  }

  return ApproachRules[position.station.name]?.(position, elizabethLine) ?? []
}
