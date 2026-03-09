export interface RttResponse {
  serviceUid: string
  runDate: string
  serviceType: string
  isPassenger: boolean
  trainIdentity: string
  powerType: string
  trainClass: string
  atocCode: string
  atocName: string
  performanceMonitored: boolean
  origin: RttOrigin[]
  destination: RttDestination[]
  locations: RttLocation[]
}

export interface RttOrigin {
  tiploc: string
  description: string
  workingTime: string
  publicTime: string
  crs?: string
}

export interface RttDestination {
  tiploc: string
  description: string
  workingTime: string
  publicTime: string
  crs?: string
}

export type LocationDisplayAs = 'CALL' | 'PASS' | 'ORIGIN' | 'DESTINATION' | 'STARTS' | 'TERMINATES' | 'CANCELLED_CALL' | 'CANCELLED_PASS'

export interface RttLocation {
  tiploc: string
  crs?: string
  description: string
  origin: RttOrigin[]
  destination: RttDestination[]
  isCall: boolean
  isPublicCall: boolean
  platform?: string
  gbttBookedArrival?: string
  gbttBookedArrivalNextDay?: true
  gbttBookedDeparture?: string
  gbttBookedDepartureNextDay?: true
  realtimeDeparture?: string
  realtimeDepartureNextDay?: true
  realtimeArrival?: string
  realtimeArrivalNextDay?: true
  path?: string
  associations?: RttAssociation[]
  displayAs: LocationDisplayAs
  realtimeActivated?: true
  realtimeGbttArrivalLateness?: number
  realtimeGbttDepartureLateness?: number
}

export interface RttAssociation {
  type: 'divide' | 'join'
  associatedUid: string
  associatedRunDate: string
  service?: RttResponse
}
