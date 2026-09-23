import { create, toBinary, type MessageInitShape } from '@bufbuild/protobuf'
import { timestampFromDate } from '@bufbuild/protobuf/wkt'
import * as pb from '../src/live/gen/darwin/live/v2/live_pb'
import type {
  Announcement,
  AnnouncementAudio,
  Call,
  Endpoint,
  Location,
  Movement,
  PlatformOverride,
  ServerMessage,
  Times,
} from '../src/live/types'

/** The inverse of src/live/wire.ts, for tests only: the service is the only real encoder. */

const announcementTypes = {
  next: pb.AnnouncementType.NEXT,
  approaching: pb.AnnouncementType.APPROACHING,
  standing: pb.AnnouncementType.STANDING,
  disrupted: pb.AnnouncementType.DISRUPTED,
  passing: pb.AnnouncementType.PASSING,
  platform_alteration: pb.AnnouncementType.PLATFORM_ALTERATION,
}
const kinds = {
  stop: pb.MovementKind.STOP,
  arrival: pb.MovementKind.ARRIVAL,
  departure: pb.MovementKind.DEPARTURE,
  passing: pb.MovementKind.PASSING,
  unknown: pb.MovementKind.UNKNOWN,
}
const modes = { train: pb.TransportMode.TRAIN, bus: pb.TransportMode.BUS, ferry: pb.TransportMode.FERRY }
const tdEvents = { arrival: pb.TdEvent.ARRIVAL, departure: pb.TdEvent.DEPARTURE, platform: pb.TdEvent.PLATFORM }
const tdMatches = { matched: pb.TdMatch.MATCHED, unmatched: pb.TdMatch.UNMATCHED, ambiguous: pb.TdMatch.AMBIGUOUS }
const tdClassifications = {
  stopping: pb.TdClassification.STOPPING,
  passing: pb.TdClassification.PASSING,
  non_passenger: pb.TdClassification.NON_PASSENGER,
  non_public: pb.TdClassification.NON_PUBLIC,
  unknown: pb.TdClassification.UNKNOWN,
  ambiguous: pb.TdClassification.AMBIGUOUS,
}

const known = <T>(value: T | null | undefined): T | undefined => value ?? undefined
const time = (value: string | null | undefined) => (value ? timestampFromDate(new Date(value)) : undefined)
const location = (value: Location) => ({ tpl: value.tpl, crs: known(value.crs), name: known(value.name) })
const times = (value: Times) => ({
  planned: time(value.planned),
  estimated: time(value.estimated),
  actual: time(value.actual),
  unknownDelay: value.unknown_delay,
})
const platform = (value: Movement['platform']) => ({
  number: known(value.number),
  confirmed: known(value.confirmed),
  suppressed: known(value.suppressed),
  source: known(value.source),
})
const endpoint = (value: Endpoint) => ({
  location: location(value),
  via: value.via ? { text: value.via.text, locs: value.via.locs } : undefined,
  assocRid: known(value.assoc_rid),
  assocCat: known(value.assoc_cat),
})
const call = (value: Call) => ({
  id: value.id,
  location: location(value),
  arrival: times(value.arrival),
  departure: times(value.departure),
  platform: platform(value.platform),
  cancelled: value.cancelled,
  activities: known(value.activities),
  operational: value.operational,
  detachFront: known(value.detach_front),
  falseDestination: value.false_destination ? location(value.false_destination) : undefined,
  coachCount: known(value.coach_count),
})

function movement(value: Movement): MessageInitShape<typeof pb.MovementSchema> {
  return {
    id: value.id,
    rid: value.rid,
    locationId: value.location_id,
    station: location(value.station),
    kind: kinds[value.kind],
    mode: modes[value.mode],
    uid: known(value.uid),
    headcode: known(value.headcode),
    operatorCode: known(value.operator_code),
    operatorName: known(value.operator_name),
    passenger: value.passenger,
    operational: value.operational,
    arrival: times(value.arrival),
    departure: times(value.departure),
    passing: times(value.passing),
    platform: platform(value.platform),
    suppressed: value.suppressed,
    cancelled: value.cancelled,
    cancelReason: { code: known(value.cancel_reason.code), text: known(value.cancel_reason.text) },
    delayReason: { code: known(value.delay_reason.code), text: known(value.delay_reason.text) },
    coachCount: known(value.coach_count),
    loadingPercent: known(value.loading_percent),
    loadingCategory: known(value.loading_category),
    coaches: value.coaches
      ? {
          coaches: value.coaches.map(coach => ({
            number: coach.number,
            class: known(coach.class),
            toiletType: known(coach.toilet_type),
            toiletStatus: known(coach.toilet_status),
            loadingPercent: known(coach.loading_percent),
            accessible: known(coach.accessible),
            cycleSpaces: known(coach.cycle_spaces),
            food: known(coach.food),
          })),
        }
      : undefined,
    formation: known(value.formation),
    coachLoading: known(value.coach_loading),
    reverseFormation: known(value.reverse_formation),
    detachFront: known(value.detach_front),
    activities: known(value.activities),
    falseDestination: value.false_destination ? location(value.false_destination) : undefined,
    origins: value.origins.map(endpoint),
    destinations: value.destinations.map(endpoint),
    callingPoints: value.calling_points.map(call),
    portions: value.portions.map(portion => ({
      headcode: known(portion.headcode),
      mode: portion.mode ? modes[portion.mode] : pb.TransportMode.UNSPECIFIED,
      operatorCode: known(portion.operator_code),
      operatorName: known(portion.operator_name),
      origin: portion.origin ? location(portion.origin) : undefined,
      destination: portion.destination ? location(portion.destination) : undefined,
      rid: portion.rid,
      category: portion.category,
      at: location(portion.at),
      cancelled: portion.cancelled,
      available: portion.available,
      coachCount: known(portion.coach_count),
      position: known(portion.position),
      calls: portion.calls.map(call),
    })),
    arrivedAt: time(value.arrived_at),
    passedAt: time(value.passed_at),
    trainOrder: value.train_order
      ? { position: value.train_order.position, platform: value.train_order.platform, updatedAt: time(value.train_order.updated_at) }
      : undefined,
    td: value.td
      ? {
          id: value.td.id,
          area: value.td.area,
          description: value.td.description,
          from: value.td.from,
          to: value.td.to,
          stanox: value.td.stanox,
          crs: value.td.crs,
          tiplocs: value.td.tiplocs,
          name: value.td.name,
          platform: value.td.platform,
          event: tdEvents[value.td.event],
          step: value.td.step,
          direction: value.td.direction,
          fromLine: value.td.from_line,
          toLine: value.td.to_line,
          observedAt: time(value.td.observed_at),
          reportedAt: time(value.td.reported_at),
          expiresAt: time(value.td.expires_at),
          match: tdMatches[value.td.match],
          classification: tdClassifications[value.td.classification],
        }
      : undefined,
  }
}

const override = (value: PlatformOverride) => ({
  id: value.id,
  kind: value.kind === 'stand_clear' ? pb.OverrideKind.STAND_CLEAR : pb.OverrideKind.NOT_FOR_PUBLIC_USE,
  station: location(value.station),
  platform: value.platform,
  movementId: known(value.movement_id),
  activatesAt: time(value.activates_at),
  expiresAt: time(value.expires_at),
  reason: value.reason,
  source: value.source,
})

const audio = (value: AnnouncementAudio | undefined) =>
  value
    ? {
        codec: pb.AudioCodec.MP3,
        data: value.data,
        duration:
          value.duration_ms === null
            ? undefined
            : { seconds: BigInt(Math.floor(value.duration_ms / 1000)), nanos: (value.duration_ms % 1000) * 1e6 },
      }
    : undefined

function payload(message: ServerMessage): MessageInitShape<typeof pb.ServerMessageSchema>['payload'] {
  switch (message.type) {
    case 'snapshot':
      return {
        case: 'snapshot',
        value: {
          requestId: message.request_id,
          station: location(message.station),
          window: { from: time(message.window.from), to: time(message.window.to) },
          epoch: message.epoch,
          revision: BigInt(message.revision),
          movements: message.movements.map(movement),
          ordering: message.ordering,
          overrides: message.overrides.map(override),
          nrccMessages: message.nrcc_messages.map(notice => ({ ...notice, updatedAt: time(notice.updated_at) })),
        },
      }
    case 'update':
      return {
        case: 'update',
        value: {
          epoch: message.epoch,
          previousRevision: BigInt(message.previous_revision),
          revision: BigInt(message.revision),
          window: { from: time(message.window.from), to: time(message.window.to) },
          upserts: message.upserts.map(movement),
          removals: message.removals,
          ordering: message.ordering,
          overrideUpserts: message.override_upserts.map(override),
          overrideRemovals: message.override_removals,
          nrccMessages: message.nrcc_messages.map(notice => ({ ...notice, updatedAt: time(notice.updated_at) })),
        },
      }
    case 'heartbeat':
      return {
        case: 'heartbeat',
        value: {
          epoch: message.epoch,
          revision: message.revision === undefined ? undefined : BigInt(message.revision),
          digest: message.digest,
          sentAt: time(message.sent_at),
        },
      }
    case 'ready':
      return { case: 'ready', value: { station: location(message.station), createdAt: time(message.created_at), healthy: message.healthy } }
    case 'announcement':
      return {
        case: 'announcement',
        value: {
          eventId: message.event_id,
          announcementType: announcementTypes[message.announcement_type],
          movementId: message.movement_id,
          station: location(message.station),
          createdAt: time(message.created_at),
          expiresAt: time(message.expires_at),
          details: movement(message.details),
          affectedPlatforms: message.affected_platforms,
          previousPlatform: known(message.previous_platform),
          newPlatform: known(message.new_platform),
          audio: audio(message.audio),
        },
      }
    case 'retraction':
      return {
        case: 'retraction',
        value: {
          eventId: message.event_id,
          movementId: message.movement_id,
          announcementType: announcementTypes[message.announcement_type],
          reason: message.reason,
          cause: message.cause,
          createdAt: time(message.created_at),
          affectedPlatforms: message.affected_platforms,
        },
      }
    case 'revision':
      return {
        case: 'revision',
        value: {
          eventId: message.event_id,
          movementId: message.movement_id,
          announcementType: announcementTypes[message.announcement_type],
          createdAt: time(message.created_at),
          expiresAt: time(message.expires_at),
          details: movement(message.details),
          affectedPlatforms: message.affected_platforms,
          audio: audio(message.audio),
        },
      }
  }
}

/** One binary frame as the service would write it. `version` is sent as given, so a test can send a wrong one. */
export function encodeServerMessage(message: ServerMessage | (Omit<Announcement, 'version'> & { version: number })): ArrayBuffer {
  const bytes = toBinary(
    pb.ServerMessageSchema,
    create(pb.ServerMessageSchema, { version: message.version, payload: payload(message as ServerMessage) }),
  )
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
