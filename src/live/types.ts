/** Version 1 wire types. Railway instants are ISO/RFC3339, never local clocks. */
export type Instant = string
export interface Location {
  tpl: string
  crs: string | null
  name: string | null
}
export interface Times {
  planned: Instant | null
  estimated: Instant | null
  actual: Instant | null
  unknown_delay: boolean
}
export interface Platform {
  number: string | null
  confirmed: boolean | null
  suppressed: boolean | null
  source: string | null
}
export interface Reason {
  code: string | null
  text: string | null
}
export interface Endpoint extends Location {
  via: { text: string; locs: string[] } | null
  assoc_rid: string | null
  assoc_cat: string | null
}
export interface Call extends Location {
  id: string
  arrival: Times
  departure: Times
  platform: Platform
  cancelled: boolean
  activities: string | null
  operational: boolean
  detach_front: boolean | null
  false_destination: Location | null
  coach_count: number | null
}
export interface Portion {
  headcode: string | null
  mode: 'train' | 'bus' | 'ferry' | null
  operator_code: string | null
  operator_name: string | null
  origin: Location | null
  destination: Location | null
  rid: string
  category: string
  at: Location
  cancelled: boolean
  available: boolean
  coach_count: number | null
  position: string | null
  calls: Call[]
}
export interface Coach {
  number: string
  class: string | null
  toilet_type: string | null
  toilet_status: string | null
  loading_percent: number | null
}
export interface Movement {
  /** Present when a current Darwin TrainOrder unambiguously identifies this movement. */
  train_order?: { position: number; platform: string; updated_at: Instant }
  /** TD evidence is separate from Darwin forecasts. An unmatched train has rid === ''. */
  td?: TDMovement
  id: string
  rid: string
  location_id: string
  station: Location
  kind: 'stop' | 'arrival' | 'departure' | 'passing' | 'unknown'
  mode: 'train' | 'bus' | 'ferry'
  uid: string | null
  headcode: string | null
  operator_code: string | null
  operator_name: string | null
  passenger: boolean
  operational: boolean
  arrival: Times
  departure: Times
  passing: Times
  platform: Platform
  suppressed: boolean
  cancelled: boolean
  cancel_reason: Reason
  delay_reason: Reason
  coach_count: number | null
  loading_percent: number | null
  loading_category: string | null
  coaches: Coach[] | null
  formation: string | null
  coach_loading: string | null
  reverse_formation: boolean | null
  detach_front: boolean | null
  activities: string | null
  false_destination: Location | null
  origins: Endpoint[]
  destinations: Endpoint[]
  calling_points: Call[]
  portions: Portion[]
  passed_at: Instant | null
}
export interface TDMovement {
  id: string
  area: string
  description: string
  from: string
  to: string
  stanox: string
  crs: string
  tiplocs: string[]
  name: string
  platform: string
  event: 'arrival' | 'departure'
  step: 'B' | 'F' | 'T' | 'C' | 'I' | 'D' | 'E'
  direction: 'up' | 'down'
  from_line: string
  to_line: string
  observed_at: Instant
  reported_at: Instant
  expires_at: Instant
  match: 'matched' | 'unmatched' | 'ambiguous'
  classification: 'stopping' | 'passing' | 'non_passenger' | 'non_public' | 'unknown' | 'ambiguous'
}
export type AnnouncementType = 'next' | 'approaching' | 'standing' | 'disrupted' | 'passing' | 'platform_alteration'
export interface Announcement {
  version: 1
  type: 'announcement'
  event_id: string
  movement_id: string
  station: Location
  announcement_type: AnnouncementType
  created_at: Instant
  expires_at: Instant
  details: Movement
  affected_platforms: string[]
  previous_platform: string | null
  new_platform: string | null
}
export interface Ready {
  version: 1
  type: 'ready'
  station: Location
  created_at: Instant
  healthy: boolean
}
export interface Retraction {
  version: 1
  type: 'retraction'
  event_id: string
  movement_id: string
  announcement_type: AnnouncementType
  reason: string
  created_at: Instant
  affected_platforms: string[]
}
export interface Revision {
  version: 1
  type: 'revision'
  event_id: string
  movement_id: string
  announcement_type: AnnouncementType
  created_at: Instant
  expires_at: Instant
  details: Movement
  affected_platforms: string[]
}
/** Liveness only. The announcement stream attests no state, so this carries none. */
export interface Heartbeat {
  version: 1
  type: 'heartbeat'
  sent_at: Instant
}
