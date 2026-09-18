/** The stream messages as the app reads them. `wire.ts` decodes protocol version 2's protobuf frames
 *  into these; null still means unknown. Railway instants are ISO/RFC3339, never local clocks. */
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
  /** Signalling evidence that the train is at the platform. Never a Darwin actual. */
  arrived_at: Instant | null
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
  /** `platform` is a platform-only SMART rule: it routes the train and says nothing of arrival. */
  event: 'arrival' | 'departure' | 'platform'
  step: 'B' | 'F' | 'T' | 'C' | 'I' | 'D' | 'E'
  direction: 'up' | 'down' | ''
  from_line: string
  to_line: string
  observed_at: Instant
  reported_at: Instant
  expires_at: Instant
  match: 'matched' | 'unmatched' | 'ambiguous'
  classification: 'stopping' | 'passing' | 'non_passenger' | 'non_public' | 'unknown' | 'ambiguous'
}
export interface PlatformOverride {
  id: string
  kind: 'stand_clear' | 'not_for_public_use'
  station: Location
  platform: string
  movement_id: string | null
  activates_at: Instant
  expires_at: Instant
  reason: string
  source: string
}
export interface Snapshot {
  version: 2
  type: 'snapshot'
  request_id?: string
  station: Location
  window: { from: Instant; to: Instant }
  epoch: string
  revision: number
  movements: Movement[]
  ordering: string[]
  overrides: PlatformOverride[]
}
export interface Update {
  version: 2
  type: 'update'
  epoch: string
  previous_revision: number
  revision: number
  window: Snapshot['window']
  upserts: Movement[]
  removals: string[]
  ordering: string[]
  override_upserts: PlatformOverride[]
  override_removals: { id: string; reason: string }[]
}
/** The CIS stream attests its state. The announcement stream has none, so there only `sent_at` is set. */
export interface Heartbeat {
  version: 2
  type: 'heartbeat'
  epoch?: string
  revision?: number
  digest?: string
  sent_at: Instant
}
export interface CISState {
  station: Location
  epoch: string
  revision: number
  window: Snapshot['window']
  movements: Map<string, Movement>
  ordering: string[]
  overrides: Map<string, PlatformOverride>
}
export type AnnouncementType = 'next' | 'approaching' | 'standing' | 'disrupted' | 'passing' | 'platform_alteration'
export interface Announcement {
  version: 2
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
  /** The announcement already rendered by the service. Absent means generate it from `details`. */
  audio?: AnnouncementAudio
}
/** A complete rendered announcement, chime included, ready to play as it is. */
export interface AnnouncementAudio {
  codec: 'mp3'
  data: Uint8Array
  /** Playing time in milliseconds, when the service measured it. */
  duration_ms: number | null
}
export interface Ready {
  version: 2
  type: 'ready'
  station: Location
  created_at: Instant
  healthy: boolean
}
export interface Retraction {
  version: 2
  type: 'retraction'
  event_id: string
  movement_id: string
  announcement_type: AnnouncementType
  /** Advisory. New reasons can appear; the withdrawal is the message. */
  reason: string
  cause?: string
  created_at: Instant
  affected_platforms: string[]
}
export interface Revision {
  version: 2
  type: 'revision'
  event_id: string
  movement_id: string
  announcement_type: AnnouncementType
  created_at: Instant
  expires_at: Instant
  details: Movement
  affected_platforms: string[]
  /** Replaces the audio the announcement carried. Absent means drop that audio and generate from `details`. */
  audio?: AnnouncementAudio
}
export type ServerMessage = Snapshot | Update | Heartbeat | Ready | Announcement | Retraction | Revision
