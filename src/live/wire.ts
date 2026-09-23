import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt'
import * as pb from './gen/darwin/live/v2/live_pb'
import type {
  Announcement,
  AnnouncementAudio,
  AnnouncementType,
  Call,
  Endpoint,
  Instant,
  Location,
  Movement,
  NRCCMessage,
  Platform,
  PlatformOverride,
  Portion,
  Reason,
  ServerMessage,
  TDMovement,
  Times,
} from './types'

export const PROTOCOL_VERSION = 2

const announcementTypes: Partial<Record<pb.AnnouncementType, AnnouncementType>> = {
  [pb.AnnouncementType.NEXT]: 'next',
  [pb.AnnouncementType.APPROACHING]: 'approaching',
  [pb.AnnouncementType.STANDING]: 'standing',
  [pb.AnnouncementType.DISRUPTED]: 'disrupted',
  [pb.AnnouncementType.PASSING]: 'passing',
  [pb.AnnouncementType.PLATFORM_ALTERATION]: 'platform_alteration',
}
const movementKinds: Partial<Record<pb.MovementKind, Movement['kind']>> = {
  [pb.MovementKind.STOP]: 'stop',
  [pb.MovementKind.ARRIVAL]: 'arrival',
  [pb.MovementKind.DEPARTURE]: 'departure',
  [pb.MovementKind.PASSING]: 'passing',
  [pb.MovementKind.UNKNOWN]: 'unknown',
}
const transportModes: Partial<Record<pb.TransportMode, Movement['mode']>> = {
  [pb.TransportMode.TRAIN]: 'train',
  [pb.TransportMode.BUS]: 'bus',
  [pb.TransportMode.FERRY]: 'ferry',
}
const tdEvents: Partial<Record<pb.TdEvent, TDMovement['event']>> = {
  [pb.TdEvent.ARRIVAL]: 'arrival',
  [pb.TdEvent.DEPARTURE]: 'departure',
  [pb.TdEvent.PLATFORM]: 'platform',
}
const tdMatches: Partial<Record<pb.TdMatch, TDMovement['match']>> = {
  [pb.TdMatch.MATCHED]: 'matched',
  [pb.TdMatch.UNMATCHED]: 'unmatched',
  [pb.TdMatch.AMBIGUOUS]: 'ambiguous',
}
const tdClassifications: Partial<Record<pb.TdClassification, TDMovement['classification']>> = {
  [pb.TdClassification.STOPPING]: 'stopping',
  [pb.TdClassification.PASSING]: 'passing',
  [pb.TdClassification.NON_PASSENGER]: 'non_passenger',
  [pb.TdClassification.NON_PUBLIC]: 'non_public',
  [pb.TdClassification.UNKNOWN]: 'unknown',
  [pb.TdClassification.AMBIGUOUS]: 'ambiguous',
}

/** A required timestamp the service always sets. One that is missing is a malformed message. */
function instant(timestamp: Timestamp | undefined): Instant {
  if (!timestamp) throw new Error('Stream message is missing a timestamp')
  // Written as the service writes RFC 3339, without trailing zeros, so an instant reads the same in a log as in the service's own.
  return timestampDate(timestamp)
    .toISOString()
    .replace(/\.?0+Z$/, 'Z')
}

function optionalInstant(timestamp: Timestamp | undefined): Instant | null {
  return timestamp ? instant(timestamp) : null
}

function location(value: pb.Location | undefined): Location {
  return { tpl: value?.tpl ?? '', crs: value?.crs ?? null, name: value?.name ?? null }
}

function times(value: pb.Times | undefined): Times {
  return {
    planned: optionalInstant(value?.planned),
    estimated: optionalInstant(value?.estimated),
    actual: optionalInstant(value?.actual),
    unknown_delay: value?.unknownDelay ?? false,
  }
}

function platform(value: pb.Platform | undefined): Platform {
  return {
    number: value?.number ?? null,
    confirmed: value?.confirmed ?? null,
    suppressed: value?.suppressed ?? null,
    source: value?.source ?? null,
  }
}

function reason(value: pb.Reason | undefined): Reason {
  return { code: value?.code ?? null, text: value?.text ?? null }
}

function endpoint(value: pb.Endpoint): Endpoint {
  return {
    ...location(value.location),
    via: value.via ? { text: value.via.text, locs: value.via.locs } : null,
    assoc_rid: value.assocRid ?? null,
    assoc_cat: value.assocCat ?? null,
  }
}

function call(value: pb.Call): Call {
  return {
    ...location(value.location),
    id: value.id,
    arrival: times(value.arrival),
    departure: times(value.departure),
    platform: platform(value.platform),
    cancelled: value.cancelled,
    activities: value.activities ?? null,
    operational: value.operational,
    detach_front: value.detachFront ?? null,
    false_destination: value.falseDestination ? location(value.falseDestination) : null,
    coach_count: value.coachCount ?? null,
  }
}

function portion(value: pb.Portion): Portion {
  return {
    headcode: value.headcode ?? null,
    mode: transportModes[value.mode] ?? null,
    operator_code: value.operatorCode ?? null,
    operator_name: value.operatorName ?? null,
    origin: value.origin ? location(value.origin) : null,
    destination: value.destination ? location(value.destination) : null,
    rid: value.rid,
    category: value.category,
    at: location(value.at),
    cancelled: value.cancelled,
    available: value.available,
    coach_count: value.coachCount ?? null,
    position: value.position ?? null,
    calls: value.calls.map(call),
  }
}

// An enum value this build does not know came from a newer service. Each falls back to the
// reading that claims least: evidence that proves nothing, a train nobody identified.
function td(value: pb.TdEvidence): TDMovement {
  return {
    id: value.id,
    area: value.area,
    description: value.description,
    from: value.from,
    to: value.to,
    stanox: value.stanox,
    crs: value.crs,
    tiplocs: value.tiplocs,
    name: value.name,
    platform: value.platform,
    event: tdEvents[value.event] ?? 'platform',
    step: value.step as TDMovement['step'],
    direction: value.direction as TDMovement['direction'],
    from_line: value.fromLine,
    to_line: value.toLine,
    observed_at: instant(value.observedAt),
    reported_at: instant(value.reportedAt),
    expires_at: instant(value.expiresAt),
    match: tdMatches[value.match] ?? 'unmatched',
    classification: tdClassifications[value.classification] ?? 'unknown',
  }
}

function movement(value: pb.Movement | undefined): Movement {
  if (!value) throw new Error('Stream message is missing its movement')
  const decoded: Movement = {
    id: value.id,
    rid: value.rid,
    location_id: value.locationId,
    station: location(value.station),
    kind: movementKinds[value.kind] ?? 'unknown',
    // Darwin has had these three modes for as long as it has had modes.
    mode: transportModes[value.mode] ?? 'train',
    uid: value.uid ?? null,
    headcode: value.headcode ?? null,
    operator_code: value.operatorCode ?? null,
    operator_name: value.operatorName ?? null,
    passenger: value.passenger,
    operational: value.operational,
    arrival: times(value.arrival),
    departure: times(value.departure),
    passing: times(value.passing),
    platform: platform(value.platform),
    suppressed: value.suppressed,
    cancelled: value.cancelled,
    cancel_reason: reason(value.cancelReason),
    delay_reason: reason(value.delayReason),
    coach_count: value.coachCount ?? null,
    loading_percent: value.loadingPercent ?? null,
    loading_category: value.loadingCategory ?? null,
    coaches:
      value.coaches?.coaches.map(coach => ({
        number: coach.number,
        class: coach.class ?? null,
        toilet_type: coach.toiletType ?? null,
        toilet_status: coach.toiletStatus ?? null,
        loading_percent: coach.loadingPercent ?? null,
        accessible: coach.accessible ?? null,
        cycle_spaces: coach.cycleSpaces ?? null,
        food: coach.food ?? null,
      })) ?? null,
    formation: value.formation ?? null,
    coach_loading: value.coachLoading ?? null,
    reverse_formation: value.reverseFormation ?? null,
    detach_front: value.detachFront ?? null,
    activities: value.activities ?? null,
    false_destination: value.falseDestination ? location(value.falseDestination) : null,
    origins: value.origins.map(endpoint),
    destinations: value.destinations.map(endpoint),
    calling_points: value.callingPoints.map(call),
    portions: value.portions.map(portion),
    arrived_at: optionalInstant(value.arrivedAt),
    passed_at: optionalInstant(value.passedAt),
  }
  if (value.trainOrder) {
    decoded.train_order = {
      position: value.trainOrder.position,
      platform: value.trainOrder.platform,
      updated_at: instant(value.trainOrder.updatedAt),
    }
  }
  if (value.td) decoded.td = td(value.td)
  return decoded
}

function nrccMessage(value: pb.NrccMessage): NRCCMessage {
  return {
    id: value.id,
    text: value.text,
    category: value.category,
    severity: value.severity,
    suppress: value.suppress,
    updated_at: instant(value.updatedAt),
  }
}

function override(value: pb.PlatformOverride): PlatformOverride {
  return {
    id: value.id,
    // Dropping an override this build cannot name would break the state digest, which counts it.
    kind: value.kind === pb.OverrideKind.STAND_CLEAR ? 'stand_clear' : 'not_for_public_use',
    station: location(value.station),
    platform: value.platform,
    movement_id: value.movementId ?? null,
    activates_at: instant(value.activatesAt),
    expires_at: instant(value.expiresAt),
    reason: value.reason,
    source: value.source,
  }
}

function window(value: pb.Window | undefined): { from: Instant; to: Instant } {
  return { from: instant(value?.from), to: instant(value?.to) }
}

/** Audio in a codec this build cannot play is no audio: the announcement is generated instead. */
function audio(value: pb.AnnouncementAudio | undefined): AnnouncementAudio | undefined {
  if (!value || value.codec !== pb.AudioCodec.MP3 || value.data.length === 0) return undefined
  const duration = value.duration
  return {
    codec: 'mp3',
    data: value.data,
    duration_ms: duration ? Number(duration.seconds) * 1000 + Math.round(duration.nanos / 1e6) : null,
  }
}

/**
 * Decodes one binary frame. Returns null for a message a newer service added, which is ignored
 * rather than fatal: the frame still proves the connection is alive.
 */
export function decodeServerMessage(frame: Uint8Array): ServerMessage | null {
  const message = fromBinary(pb.ServerMessageSchema, frame)
  if (message.version !== PROTOCOL_VERSION) throw new Error(`Unsupported stream version ${message.version}`)
  const version = PROTOCOL_VERSION
  const payload = message.payload
  switch (payload.case) {
    case 'snapshot': {
      const value = payload.value
      const snapshot: ServerMessage = {
        version,
        type: 'snapshot',
        station: location(value.station),
        window: window(value.window),
        epoch: value.epoch,
        revision: Number(value.revision),
        movements: value.movements.map(movement),
        ordering: value.ordering,
        overrides: value.overrides.map(override),
        nrcc_messages: value.nrccMessages.map(nrccMessage),
      }
      if (value.requestId !== undefined) snapshot.request_id = value.requestId
      return snapshot
    }
    case 'update': {
      const value = payload.value
      return {
        version,
        type: 'update',
        epoch: value.epoch,
        previous_revision: Number(value.previousRevision),
        revision: Number(value.revision),
        window: window(value.window),
        upserts: value.upserts.map(movement),
        removals: value.removals,
        ordering: value.ordering,
        override_upserts: value.overrideUpserts.map(override),
        override_removals: value.overrideRemovals.map(({ id, reason }) => ({ id, reason })),
        nrcc_messages: value.nrccMessages.map(nrccMessage),
      }
    }
    case 'heartbeat': {
      const value = payload.value
      const heartbeat: ServerMessage = { version, type: 'heartbeat', sent_at: instant(value.sentAt) }
      if (value.epoch !== undefined) heartbeat.epoch = value.epoch
      if (value.revision !== undefined) heartbeat.revision = Number(value.revision)
      if (value.digest !== undefined) heartbeat.digest = value.digest
      return heartbeat
    }
    case 'ready': {
      const value = payload.value
      return { version, type: 'ready', station: location(value.station), created_at: instant(value.createdAt), healthy: value.healthy }
    }
    case 'announcement': {
      const value = payload.value
      const announcementType = announcementTypes[value.announcementType]
      if (!announcementType) return null
      const announcement: Announcement = {
        version,
        type: 'announcement',
        event_id: value.eventId,
        movement_id: value.movementId,
        station: location(value.station),
        announcement_type: announcementType,
        created_at: instant(value.createdAt),
        expires_at: instant(value.expiresAt),
        details: movement(value.details),
        affected_platforms: value.affectedPlatforms,
        previous_platform: value.previousPlatform ?? null,
        new_platform: value.newPlatform ?? null,
      }
      const rendered = audio(value.audio)
      if (rendered) announcement.audio = rendered
      return announcement
    }
    case 'retraction': {
      const value = payload.value
      const announcementType = announcementTypes[value.announcementType]
      if (!announcementType) return null
      const retraction: ServerMessage = {
        version,
        type: 'retraction',
        event_id: value.eventId,
        movement_id: value.movementId,
        announcement_type: announcementType,
        reason: value.reason,
        created_at: instant(value.createdAt),
        affected_platforms: value.affectedPlatforms,
      }
      if (value.cause !== undefined) retraction.cause = value.cause
      return retraction
    }
    case 'revision': {
      const value = payload.value
      const announcementType = announcementTypes[value.announcementType]
      if (!announcementType) return null
      const revision: ServerMessage = {
        version,
        type: 'revision',
        event_id: value.eventId,
        movement_id: value.movementId,
        announcement_type: announcementType,
        created_at: instant(value.createdAt),
        expires_at: instant(value.expiresAt),
        details: movement(value.details),
        affected_platforms: value.affectedPlatforms,
      }
      const rendered = audio(value.audio)
      if (rendered) revision.audio = rendered
      return revision
    }
    default:
      return null
  }
}

export function encodeResync(requestId?: string): Uint8Array<ArrayBuffer> {
  // toBinary allocates its own buffer; the cast only tells WebSocket.send it is not a shared one.
  return toBinary(
    pb.ClientMessageSchema,
    create(pb.ClientMessageSchema, { command: { case: 'resync', value: create(pb.ResyncSchema, { requestId }) } }),
  ) as Uint8Array<ArrayBuffer>
}
