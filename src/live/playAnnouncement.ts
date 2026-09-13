import type AmeyPhil from '../announcement-data/systems/stations/AmeyPhil'
import type { ChimeType, INextTrainAnnouncementOptions } from '../announcement-data/systems/stations/AmeyPhil'
import type { MissingAudioMode } from '../announcement-data/AnnouncementSystem'
import type { CallingAtPoint } from '../components/CallingAtSelector'
import { isMindTheGapStation } from '../data/liveTrains/mindTheGap'
import { isShortPlatform, type ShortPlatformTrain } from '../data/liveTrains/shortPlatforms'
import type { Announcement, Call, Location, Movement, Portion } from './types'

export interface VoicePreferences {
  chime: ChimeType | ''
  useLegacyTocNames: boolean
  announceViaPoints: boolean
  announceShortPlatformsAfterSplit: boolean
  missingAudioMode: MissingAudioMode
}

function stationAudio(location: Location, system: AmeyPhil): string {
  const code = system.liveTrainsTiplocStationOverrides(location.tpl) || location.crs
  if (!code) throw new Error(`No station audio identity for ${location.name || location.tpl}`)
  return code
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

function passengerCalls(calls: Call[]): Call[] {
  return calls.filter(call => call.crs && !call.operational && !call.cancelled && !hasActivity(call.activities, 'U'))
}

function onwardCalls(portion: Portion): Call[] {
  const start = portion.calls.findIndex(call => call.tpl === portion.at.tpl || (!!call.crs && call.crs === portion.at.crs))
  // Without the division point, nothing says which of these calls are still ahead of the train.
  return start === -1 ? [] : portion.calls.slice(start)
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
  const destination = movement.false_destination || movement.destinations[0]
  // The endpoint and the call can name one station by different TIPLOCs.
  const terminus = (call: Call) => call.tpl === destination?.tpl || (!!destination?.crs && call.crs === destination.crs)
  const destinationIndex = movement.calling_points.reduce((last, call, index) => (terminus(call) ? index : last), -1)
  for (const [index, call] of movement.calling_points.entries()) {
    if (hasActivity(call.activities, 'RM')) reversed = !reversed
    const terminates = index === destinationIndex
    if (passengerCalls([call]).length === 0) {
      if (terminates) break
      continue
    }
    const portions = movement.portions.filter(portion => portion.at.tpl === call.tpl && portion.available && !portion.cancelled)
    if (terminates && portions.length === 0) break
    let shortPlatform = isShortPlatform(call.crs!, call.platform.number, { ...train, length: call.coach_count ?? train.length })
    if (reversed && shortPlatform) {
      shortPlatform = shortPlatform.startsWith('front') ? shortPlatform.replace('front', 'rear') : shortPlatform.replace('rear', 'front')
    }
    const point: CallingAtPoint = {
      crsCode: stationAudio(call, system),
      name: call.name || '',
      randomId: call.id,
      requestStop: hasActivity(call.activities, 'R'),
      shortPlatform: shortPlatform || undefined,
    }
    const divide = portions.find(portion => portion.category === 'VV')
    if (divide) {
      point.splitType = 'splits'
      const position = divide.position || (call.detach_front === null ? 'unknown' : call.detach_front ? 'front' : 'rear')
      point.splitForm = divide.coach_count && ['front', 'rear', 'middle'].includes(position) ? `${position}.${divide.coach_count}` : 'unknown'
      point.splitCallingPoints = passengerCalls(onwardCalls(divide))
        .filter(stop => stop.tpl !== call.tpl)
        .map(stop => ({
          crsCode: stationAudio(stop, system),
          name: stop.name || '',
          randomId: stop.id,
          requestStop: hasActivity(stop.activities, 'R'),
        }))
    }
    // The terminus is spoken as the destination, so it never joins the calling points as well.
    if (!terminates) result.push(point)
    const continuation = portions.find(portion => ['NP', 'LK'].includes(portion.category) && portion.mode === 'bus')
    if (continuation) {
      point.continuesAsRrbAfterHere = true
      result.push(
        ...passengerCalls(onwardCalls(continuation))
          .filter(stop => stop.tpl !== call.tpl && !terminus(stop))
          .map(stop => ({
            crsCode: stationAudio(stop, system),
            name: stop.name || '',
            randomId: stop.id,
          })),
      )
    }
    if (terminates) break
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
      movement.destinations[0]?.crs || '',
      preferences.useLegacyTocNames,
      movement.uid || '',
    ),
    platform,
    terminatingStationCode: stationAudio(movement.false_destination || movement.destinations[0], system),
    vias: viaPoints(movement, system, preferences)[0] || [],
    callingAt: callingPoints(movement, system),
    firstClassLocation: 'none',
    coaches: movement.coach_count ? `${movement.coach_count} coaches` : 'None',
    serviceLoading: loading !== null && loading > 70 ? 'full and standing' : 'none',
    announceShortPlatformsAfterSplit: preferences.announceShortPlatformsAfterSplit,
    notCallingAtStations: movement.calling_points
      .filter(call => call.crs && !call.operational && call.cancelled && !hasActivity(call.activities, 'U'))
      .map(call => ({
        crsCode: stationAudio(call, system),
        name: call.name || '',
        randomId: call.id,
      })),
  }
}

function viaPoints(movement: Movement, system: AmeyPhil, preferences: VoicePreferences): CallingAtPoint[][] {
  return movement.destinations.map(destination =>
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
): Promise<void> {
  if (announcement.announcement_type === 'passing') {
    await system.playFastTrainAnnouncement({
      chime: preferences.chime || system.DEFAULT_CHIME,
      daktronicsFanfare: false,
      platform,
      fastTrainApproaching: true,
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
    case 'approaching':
      if (!movement.origins.length) throw new Error('Origin unavailable')
      await system.playTrainApproachingAnnouncement({
        ...options,
        fromLive: true,
        originStationCode: stationAudio(movement.origins[0], system),
        terminatingStationCode: movement.destinations.map(destination => stationAudio(destination, system)),
        vias: viaPoints(movement, system, preferences),
      })
      break
    case 'disrupted': {
      const reason = movement.cancelled ? movement.cancel_reason : movement.delay_reason
      const delay =
        movement.departure.estimated && movement.departure.planned
          ? Math.floor((Date.parse(movement.departure.estimated) - Date.parse(movement.departure.planned)) / 60_000)
          : null
      // Without a delay to count, the generic announcement replaces 'delayed by approximately' and no number.
      const spokenDelay = movement.departure.unknown_delay || delay === null || delay <= 0 ? 'delay' : 'delayedBy'
      await system.playDisruptedTrainAnnouncement({
        ...options,
        disruptionType: movement.cancelled ? 'cancel' : spokenDelay,
        delayTime: String(Math.max(0, delay || 0)),
        disruptionReason: (reason.code && system.DelayCodeMapping[reason.code]?.e) || '',
      })
      break
    }
    case 'platform_alteration':
      if (!announcement.previous_platform || !announcement.new_platform) throw new Error('Platform alteration details unavailable')
      const oldPlatform = audioPlatform(announcement.previous_platform, system)
      const newPlatform = audioPlatform(announcement.new_platform, system)
      if (!oldPlatform || !newPlatform) throw new Error('Platform audio unavailable')
      await system.playPlatformAlterationAnnouncement({
        ...options,
        fromLive: true,
        announceOldPlatform: true,
        oldPlatform,
        newPlatform,
        terminatingStationCode: movement.destinations.map(destination => stationAudio(destination, system)),
        vias: viaPoints(movement, system, preferences),
      })
      break
  }
}
