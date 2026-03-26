export interface RttResponse {
  serviceUid: string
  runDate: string
  atocCode: string
  atocName: string
  locations: RttLocation[]
}

export interface RttOrigin {
  tiploc: string
  crs?: string
}

export interface RttDestination {
  tiploc: string
  crs?: string
}

export type LocationDisplayAs = 'CALL' | 'PASS' | 'ORIGIN' | 'DESTINATION' | 'STARTS' | 'TERMINATES' | 'CANCELLED_CALL' | 'CANCELLED_PASS'

export interface RttLocation {
  tiploc: string
  crs?: string
  origin: RttOrigin[]
  destination: RttDestination[]
  isPublicCall: boolean
  platform?: string
  scheduledArrival?: string
  scheduledDeparture?: string
  realtimeArrival?: string
  realtimeDeparture?: string
  displayAs: LocationDisplayAs
  arrivalLateness?: number
  departureLateness?: number
  passengerVehicleCount?: number
  requestStop?: boolean
}
