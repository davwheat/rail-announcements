import type AmeyPhil from '../announcement-data/systems/stations/AmeyPhil'
import type {
  ChimeType,
  ILiveDisruptedTrainAnnouncementOptions,
  INextTrainAnnouncementOptions,
} from '../announcement-data/systems/stations/AmeyPhil'
import type { MissingAudioMode } from '../announcement-data/AnnouncementSystem'
import type { CallingAtPoint } from '../components/CallingAtSelector'
import { isMindTheGapStation } from '../data/liveTrains/mindTheGap'
import { isShortPlatform, type ShortPlatformTrain } from '../data/liveTrains/shortPlatforms'
import type { Announcement, Call, Endpoint, Location, Movement, Portion } from './types'

export interface VoicePreferences {
  chime: ChimeType | ''
  useLegacyTocNames: boolean
  announceViaPoints: boolean
  announceShortPlatformsAfterSplit: boolean
  fastTrainApproaching: boolean
  daktronicsFanfare: boolean
  missingAudioMode: MissingAudioMode
}

function stationAudio(location: Location, system: AmeyPhil): string {
  const code = system.liveTrainsTiplocStationOverrides(location.tpl) || location.crs
  if (!code) throw new Error(`No station audio identity for ${location.name || location.tpl}`)
  return code
}

/** The platforms an announcement speaks on. A passing train warns every platform it affects. */
export function announcementPlatforms(announcement: Announcement): (string | null)[] {
  return announcement.announcement_type === 'passing'
    ? announcement.affected_platforms
    : [announcement.new_platform || announcement.details.platform.number]
}

export function audioPlatform(platform: string, system: Pick<AmeyPhil, 'PLATFORMS'>): string | null {
  const normalised = platform.toLowerCase()
  if (system.PLATFORMS.includes(normalised)) return normalised
  const unsuffixed = normalised.replace(/[a-z]+$/, '')
  return system.PLATFORMS.includes(unsuffixed) ? unsuffixed : null
}

/** Darwin concatenates fixed two-character activity codes, so 'R' must not match within 'RM' or 'RR'. */
function hasActivity(activities: string | null, code: string): boolean {
  if (!activities) return false
  for (let index = 0; index < activities.length; index += 2) {
    if (activities.slice(index, index + 2).trim() === code) return true
  }
  return false
}

/**
 * Where this train goes. An entry with an `assoc_rid` is an endpoint a joining
 * or dividing portion reaches, so a service dividing at Redhill was announced
 * to its Gatwick Airport portion instead of to Reigate. The feed leads with the
 * service's own endpoint, and this lookup does not depend on that order.
 */
function ownDestination(movement: Movement): Endpoint {
  return movement.destinations.find(destination => !destination.assoc_rid) || movement.destinations[0]
}

/**
 * The endpoints of the portions running today. An associate the feed knows nothing about is
 * described by no station at all, so announcing it would fail on a train nobody is travelling on.
 * A portion that divides off with nowhere left to call takes nobody anywhere either, though the
 * feed lists its destination for as long as the division stands.
 */
function runningPortions(movement: Movement, endpoints: Endpoint[]): Endpoint[] {
  const running = new Set(
    movement.portions
      .filter(portion => portion.available && !portion.cancelled && (portion.category !== 'VV' || dividedCalls(portion).length))
      .map(portion => portion.rid),
  )
  return endpoints.filter(endpoint => endpoint.assoc_rid && running.has(endpoint.assoc_rid))
}

/** An endpoint, a link and a call can each name one station by a different TIPLOC. */
const sameStation = (a: Location, b: Location) => a.tpl === b.tpl || (!!a.crs && a.crs === b.crs)

/** A call the service makes, as opposed to one that is cancelled or that passengers can't use. */
const running = (call: Call) => !call.cancelled && !call.operational

/**
 * The portion that takes a service's passengers on from the call where it ends. Darwin links two services to make
 * one journey of them, most often a train and the rail replacement bus that finishes its route, and a bus recorded
 * as a train's next working means the same. A link anywhere else on the route is a change that the service runs on
 * past, so it's left alone. `main` is false on the service the passengers came from.
 *
 * A portion that joins another train ends where it joins, and its passengers stay on board, so the train it joins
 * takes them on as well. There `main` is false on the portion that joins, and the join can be a call that
 * passengers can't use.
 */
function onwardLink(portions: Portion[], calls: Call[]): { link: Portion; from: number; calls: Call[] } | null {
  let ends = calls.length - 1
  while (ends >= 0 && calls[ends].cancelled) ends--
  let leaves = ends
  while (leaves >= 0 && !running(calls[leaves])) leaves--
  for (const link of portions) {
    if (!link.available || link.cancelled) continue
    const joins = link.category === 'JJ' && link.main !== true
    if (!joins && link.main === false) continue
    if (!joins && link.category !== 'LK' && !(link.category === 'NP' && link.mode === 'bus')) continue
    const from = joins ? ends : leaves
    if (from < 0 || !sameStation(link.at, calls[from])) continue
    const meets = link.calls.findIndex(call => sameStation(call, link.at))
    const onward = meets === -1 ? [] : link.calls.slice(meets + 1)
    // A linked service that runs nowhere from here takes nobody on.
    if (onward.some(running)) return { link, from, calls: onward }
  }
  return null
}

interface Journey {
  /** The movement's own calls on the journey. */
  calls: Call[]
  /**
   * The services linked on from the last of those, in order, each with its calls on the journey and what the feed
   * sends of its own associations. For a train that a portion joined, those include the portions that divide from
   * it afterwards.
   */
  links: { calls: Call[]; bus: boolean; portions: Portion[] }[]
  /** Where the last linked service goes, or null when nothing is linked. */
  destination: Location | null
}

/**
 * The journey that passengers make from here. A service linked to another where it ends is announced as one
 * through service, and so is each service linked on from that one: a train, a bus, and then a train. A portion
 * that joins another train is announced in the same way, as a through service to where that train goes.
 */
function linkedJourney(movement: Movement): Journey {
  const journey: Journey = { calls: movement.calling_points, links: [], destination: null }
  // A false destination is the station Darwin tells an announcement to name, so no link is followed past it.
  if (movement.false_destination) return journey
  let onward = onwardLink(movement.portions, movement.calling_points)
  if (onward) journey.calls = movement.calling_points.slice(0, onward.from + 1)
  while (onward) {
    const { link, calls } = onward
    onward = onwardLink(link.links, calls)
    journey.links.push({ calls: onward ? calls.slice(0, onward.from + 1) : calls, bus: link.mode === 'bus', portions: link.links })
    journey.destination = link.destination || calls[calls.length - 1]
  }
  return journey
}

/**
 * The station this train is announced to: a false destination wherever it has one, or else the destination of the
 * last service linked on from it.
 */
function announcedDestination(movement: Movement): Endpoint {
  const own = ownDestination(movement)
  const named = movement.false_destination || linkedJourney(movement).destination
  // The feed's via points lie on the route to the train's own destination, so another one has none.
  return named ? { ...own, tpl: named.tpl, crs: named.crs, name: named.name, via: null } : own
}

/**
 * Every station this train is announced to: its own first, then the portions that divide off it. The feed lists
 * the destinations of the movement's own portions. Those of a train that it joins come with that train.
 */
function announcedDestinations(movement: Movement): Endpoint[] {
  const joined = linkedJourney(movement).links.flatMap(link =>
    link.portions.flatMap((portion): Endpoint[] => {
      const reached =
        portion.category === 'VV' && portion.available && !portion.cancelled && link.calls.some(call => call.tpl === portion.at.tpl)
      const calls = reached ? dividedCalls(portion) : []
      if (!calls.length) return []
      const { tpl, crs, name } = portion.destination || calls[calls.length - 1]
      return [{ tpl, crs, name, via: null, assoc_rid: portion.rid, assoc_cat: portion.category }]
    }),
  )
  return [announcedDestination(movement), ...runningPortions(movement, movement.destinations), ...joined]
}

/** Every station this train is announced from: its own first, then the portions that joined it. */
function announcedOrigins(movement: Movement): Endpoint[] {
  const own = movement.origins.find(origin => !origin.assoc_rid) || movement.origins[0]
  return [own, ...runningPortions(movement, movement.origins)]
}

/**
 * A call where the train only takes passengers up, which isn't one it takes anybody to. Darwin can list `U` beside
 * `D` or `T`, and passengers can alight there.
 */
function pickUpOnly(activities: string | null): boolean {
  return hasActivity(activities, 'U') && !hasActivity(activities, 'D') && !hasActivity(activities, 'T')
}

function passengerCalls(calls: Call[]): Call[] {
  return calls.filter(call => call.crs && !call.operational && !call.cancelled && !pickUpOnly(call.activities))
}

function onwardCalls(portion: Portion): Call[] {
  const start = portion.calls.findIndex(call => call.tpl === portion.at.tpl || (!!call.crs && call.crs === portion.at.crs))
  // Without the division point, nothing says which of these calls are still ahead of the train.
  return start === -1 ? [] : portion.calls.slice(start)
}

/** The stations a portion takes passengers to once it has divided off. */
function dividedCalls(portion: Portion): Call[] {
  return passengerCalls(onwardCalls(portion)).filter(stop => stop.tpl !== portion.at.tpl)
}

/** The portions that divide from a train at a call, and that passengers can still travel in. */
function divisionsAt(call: Call, portions: Portion[]): Portion[] {
  // A portion with nowhere left to call isn't one the voice can send anybody to.
  return portions.filter(
    portion =>
      portion.at.tpl === call.tpl && portion.available && !portion.cancelled && portion.category === 'VV' && dividedCalls(portion).length,
  )
}

type Split = Pick<CallingAtPoint, 'splitType' | 'splitForm' | 'splitCallingPoints' | 'furtherSplits'>

/**
 * What the voice says of a call where part of the train leaves it: the portions that divide off there, or else the
 * coaches that the train leaves behind while it runs on as the same service, which go no further.
 *
 * The feed names the end of the train as it arrives at the call. `turned` is whether the train reverses an odd
 * number of times on the way there, which makes that the other end as the train stands at this station.
 */
function splitAt(call: Call, divides: Portion[], turned: boolean, system: AmeyPhil): Split {
  const end = (position: string) => (!turned ? position : position === 'front' ? 'rear' : position === 'rear' ? 'front' : position)
  // The voice can say which end a part is at without saying how long it is.
  const form = (position: string, coaches: number | null) =>
    !['front', 'rear', 'middle'].includes(position) ? 'unknown' : coaches ? `${end(position)}.${coaches}` : end(position)

  if (divides.length) {
    const [split, ...further] = divides.map(portion => {
      // Darwin says only which end of the train stock detaches from, which can't tell two portions apart.
      const darwin = divides.length > 1 || call.detach_front === null ? 'unknown' : call.detach_front ? 'front' : 'rear'
      return {
        splitForm: form(portion.position || darwin, portion.coach_count),
        splitCallingPoints: dividedCalls(portion).map(stop => ({
          crsCode: stationAudio(stop, system),
          name: stop.name || '',
          randomId: stop.id,
          requestStop: hasActivity(stop.activities, 'R'),
        })),
      }
    })
    return { splitType: 'splits', ...split, ...(further.length ? { furtherSplits: further } : {}) }
  }

  const detached = passengerCalls([call]).length ? call.formation_change?.detached : null
  if (!detached) return {}
  return { splitType: 'splitTerminates', splitForm: form(detached.position || 'unknown', detached.coaches), splitCallingPoints: [] }
}

export function callingPoints(movement: Movement, system: AmeyPhil): CallingAtPoint[] {
  const train: ShortPlatformTrain = {
    operatorCode: movement.operator_code || '',
    length: movement.coach_count,
    origin: movement.origins.map(origin => ({ crs: origin.crs || '' })),
    destination: movement.destinations.map(destination => ({ crs: destination.crs || '' })),
    subsequentLocations: movement.calling_points.map(call => ({ crs: call.crs })),
  }
  // Preserve occurrence order on circular routes and reverse coach preferences
  // at each reversal, including reversals at operational calls.
  let reversed = movement.reverse_formation === true
  const result: CallingAtPoint[] = []
  const destination = announcedDestination(movement)
  // The endpoint and the call can name one station by different TIPLOCs.
  const terminus = (call: Call) => call.tpl === destination?.tpl || (!!destination?.crs && call.crs === destination.crs)
  const journey = linkedJourney(movement)
  // The journey ends on the last service that runs it.
  const lastLeg = journey.links.length ? journey.links[journey.links.length - 1].calls : journey.calls
  // A train on a circular route calls at a false destination again on its way to the real one, so
  // the calling points end at the first call there. The real destination is the last call at it.
  const destinationIndex = movement.false_destination
    ? lastLeg.findIndex(terminus)
    : lastLeg.reduce((last, call, index) => (terminus(call) ? index : last), -1)
  let turned = false
  for (const [index, call] of journey.calls.entries()) {
    const arrivesTurned = turned
    if (hasActivity(call.activities, 'RM')) {
      reversed = !reversed
      turned = !turned
    }
    const terminates = journey.calls === lastLeg && index === destinationIndex
    const portions = movement.portions.filter(portion => portion.at.tpl === call.tpl && portion.available && !portion.cancelled)
    const divides = divisionsAt(call, movement.portions)
    // A train can divide at a station where it sets nobody down, as a sleeper does. The voice names the station
    // where the train divides, so that call is kept, as it is for the original data source.
    const dividesOnly = divides.length > 0 && !!call.crs && !call.cancelled
    if (passengerCalls([call]).length === 0 && !dividesOnly) {
      if (terminates) break
      continue
    }
    if (terminates && portions.length === 0) break
    let shortPlatform = isShortPlatform(call.crs!, call.platform.number, { ...train, length: call.coach_count ?? train.length })
    if (reversed && shortPlatform) {
      shortPlatform = shortPlatform.startsWith('front') ? shortPlatform.replace('front', 'rear') : shortPlatform.replace('rear', 'front')
    }
    // The terminus is spoken as the destination, so it joins the calling points only as the station where a
    // portion divides off and carries on.
    if (terminates && !divides.length) break
    result.push({
      crsCode: stationAudio(call, system),
      name: call.name || '',
      randomId: call.id,
      requestStop: hasActivity(call.activities, 'R'),
      shortPlatform: shortPlatform || undefined,
      ...splitAt(call, divides, arrivesTurned, system),
    })
    if (terminates) break
  }

  let onBus = movement.mode === 'bus'
  let leg = journey.calls
  for (const link of journey.links) {
    // One service hands over to the next at the last call it makes. The voice says once where the train gives
    // way to a replacement bus, and once where a train takes over again.
    const handover = result[result.length - 1]
    if (handover?.randomId === leg[leg.length - 1].id) {
      const byBus = result.some(point => point.continuesAsRrbAfterHere)
      if (link.bus && !onBus && !byBus) handover.continuesAsRrbAfterHere = true
      if (!link.bus && onBus && byBus && !result.some(point => point.continuesAsTrainAfterHere)) handover.continuesAsTrainAfterHere = true
    }
    // The ends of another train are its own.
    turned = false
    for (const [index, call] of link.calls.entries()) {
      if (link.calls === lastLeg && index === destinationIndex) break
      const arrivesTurned = turned
      if (hasActivity(call.activities, 'RM')) turned = !turned
      // A train that this one joined can divide later on, as the train's own journey can.
      const divides = divisionsAt(call, link.portions)
      if (passengerCalls([call]).length === 0 && !(divides.length > 0 && !!call.crs && !call.cancelled)) continue
      result.push({
        crsCode: stationAudio(call, system),
        name: call.name || '',
        randomId: call.id,
        requestStop: hasActivity(call.activities, 'R'),
        ...splitAt(call, divides, arrivesTurned, system),
      })
    }
    onBus = link.bus
    leg = link.calls
  }

  // The voice describes one division. A portion that divides off further along is announced with it, at an end
  // of the train that only the crew can say. Coaches left behind further along than that aren't announced.
  const [first, ...later] = result.filter(point => point.splitType)
  for (const point of later) {
    if (point.splitType === 'splits') {
      const splits = [{ splitCallingPoints: point.splitCallingPoints || [] }, ...(point.furtherSplits || [])]
      first.furtherSplits = [...(first.furtherSplits || []), ...splits.map(split => ({ ...split, splitForm: 'unknown' }))]
    }
    delete point.splitType
    delete point.splitForm
    delete point.splitCallingPoints
    delete point.furtherSplits
  }
  return result
}

export function trainOptions(
  movement: Movement,
  system: AmeyPhil,
  preferences: VoicePreferences,
  platform: string,
): INextTrainAnnouncementOptions {
  if (!movement.departure.planned || !movement.destinations.length) throw new Error('Departure time or destination unavailable')
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const parts = clock.formatToParts(new Date(movement.departure.planned))
  const hour = parts.find(part => part.type === 'hour')!.value
  const minute = parts.find(part => part.type === 'minute')!.value
  const delay = movement.departure.estimated ? (Date.parse(movement.departure.estimated) - Date.parse(movement.departure.planned)) / 60_000 : 0
  const coachLoads = movement.coaches?.flatMap(coach => (coach.loading_percent === null ? [] : [coach.loading_percent])) || []
  const loading = movement.loading_percent ?? (coachLoads.length ? coachLoads.reduce((sum, load) => sum + load, 0) / coachLoads.length : null)
  return {
    fromLive: true,
    missingAudioMode: preferences.missingAudioMode,
    chime: preferences.chime || system.DEFAULT_CHIME,
    hour: hour === '00' ? '00 - midnight' : hour,
    min: minute === '00' ? '00 - hundred-hours' : minute,
    isDelayed: movement.departure.unknown_delay || delay >= 5,
    toc: system.processTocForLiveTrains(
      movement.operator_name || '',
      movement.operator_code || '',
      movement.origins[0]?.crs || '',
      ownDestination(movement).crs || '',
      preferences.useLegacyTocNames,
      movement.uid || '',
    ),
    platform,
    terminatingStationCode: stationAudio(announcedDestination(movement), system),
    vias: viaPoints([announcedDestination(movement)], movement, system, preferences)[0] || [],
    callingAt: callingPoints(movement, system),
    firstClassLocation: 'none',
    coaches: movement.coach_count ? `${movement.coach_count} coaches` : 'None',
    serviceLoading: loading !== null && loading > 70 ? 'full and standing' : 'none',
    announceShortPlatformsAfterSplit: preferences.announceShortPlatformsAfterSplit,
    // A linked service makes the calls that the train has cancelled beyond the link.
    notCallingAtStations: linkedJourney(movement)
      .calls.filter(call => call.crs && !call.operational && call.cancelled && !pickUpOnly(call.activities))
      .map(call => ({
        crsCode: stationAudio(call, system),
        name: call.name || '',
        randomId: call.id,
      })),
  }
}

function viaPoints(endpoints: Endpoint[], movement: Movement, system: AmeyPhil, preferences: VoicePreferences): CallingAtPoint[][] {
  return endpoints.map(destination =>
    !preferences.announceViaPoints
      ? []
      : (destination.via?.locs || []).map(crs => {
          const call = movement.calling_points.find(call => call.crs === crs)
          return { crsCode: call ? stationAudio(call, system) : crs, name: call?.name || '', randomId: crs }
        }),
  )
}

/** Only audio assets are loaded by these handlers. All railway facts come from the message. */
export async function playAnnouncement(
  announcement: Announcement,
  system: AmeyPhil,
  preferences: VoicePreferences,
  platform: string,
  log: (message: string) => void = () => {},
): Promise<void> {
  if (announcement.announcement_type === 'passing') {
    await system.playFastTrainAnnouncement({
      chime: preferences.chime || system.DEFAULT_CHIME,
      daktronicsFanfare: preferences.daktronicsFanfare,
      platform,
      fastTrainApproaching: preferences.fastTrainApproaching,
      missingAudioMode: preferences.missingAudioMode,
    })
    return
  }
  const movement = announcement.details
  const options = trainOptions(movement, system, preferences, platform)
  switch (announcement.announcement_type) {
    case 'next':
      await system.playNextTrainAnnouncement(options)
      break
    case 'standing':
      await system.playStandingTrainAnnouncement({
        ...options,
        thisStationCode: movement.station.crs || '',
        mindTheGap: isMindTheGapStation(movement.station.crs || '', movement.platform.number),
      })
      break
    case 'approaching': {
      if (!movement.origins.length) throw new Error('Origin unavailable')
      const destinations = announcedDestinations(movement)
      await system.playTrainApproachingAnnouncement({
        ...options,
        fromLive: true,
        originStationCode: announcedOrigins(movement).map(origin => stationAudio(origin, system)),
        terminatingStationCode: destinations.map(destination => stationAudio(destination, system)),
        vias: viaPoints(destinations, movement, system, preferences),
      })
      break
    }
    case 'disrupted': {
      const reason = movement.cancelled ? movement.cancel_reason : movement.delay_reason
      const delay =
        movement.departure.estimated && movement.departure.planned
          ? Math.floor((Date.parse(movement.departure.estimated) - Date.parse(movement.departure.planned)) / 60_000)
          : null
      // Without a delay to count, the generic announcement replaces 'delayed by approximately' and no number.
      const spokenDelay = movement.departure.unknown_delay || delay === null || delay <= 0 ? 'delay' : 'delayedBy'
      // The mapping holds finished clip ids. The voice plays those verbatim only in the list form;
      // a lone string is taken for a reason name and prefixed again into a clip that cannot exist.
      const reasonAudio = (reason.code && system.DelayCodeMapping[reason.code]?.e) || null
      // Both ends of a dividing service are disrupted by the same delay, so both are announced.
      const destinations = announcedDestinations(movement)
      const disruption: ILiveDisruptedTrainAnnouncementOptions = {
        ...options,
        fromLive: true,
        terminatingStationCode: destinations.map(destination => stationAudio(destination, system)),
        vias: viaPoints(destinations, movement, system, preferences),
        disruptionType: movement.cancelled ? 'cancel' : spokenDelay,
        delayTime: String(Math.max(0, delay || 0)),
        disruptionReason: reasonAudio ? (Array.isArray(reasonAudio) ? reasonAudio : [reasonAudio]) : '',
      }
      try {
        await system.playDisruptedTrainAnnouncement(disruption)
      } catch (error) {
        // A reason the voice cannot say must not cost the listener the disruption itself, which is
        // the part they need. Said without it, the announcement is shorter but still true.
        if (!disruption.disruptionReason.length) throw error
        log(`Announcing ${announcement.movement_id} without its disruption reason: ${error instanceof Error ? error.message : String(error)}`)
        await system.playDisruptedTrainAnnouncement({ ...disruption, disruptionReason: '' })
      }
      break
    }
    case 'platform_alteration': {
      if (!announcement.previous_platform || !announcement.new_platform) throw new Error('Platform alteration details unavailable')
      const oldPlatform = audioPlatform(announcement.previous_platform, system)
      const newPlatform = audioPlatform(announcement.new_platform, system)
      if (!oldPlatform || !newPlatform) throw new Error('Platform audio unavailable')
      const destinations = announcedDestinations(movement)
      await system.playPlatformAlterationAnnouncement({
        ...options,
        fromLive: true,
        announceOldPlatform: true,
        oldPlatform,
        newPlatform,
        terminatingStationCode: destinations.map(destination => stationAudio(destination, system)),
        vias: viaPoints(destinations, movement, system, preferences),
      })
      break
    }
  }
}
