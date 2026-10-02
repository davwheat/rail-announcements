/**
 * Writes the data tables and the expected output that rail-announcements-backend holds its Go
 * port of these voices to. The backend's tests replay every case here and fail on any difference,
 * so a change to a voice or to the live announcement logic has to be regenerated and ported.
 *
 * Run it with `npm run export:backend`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { AudioItem, MissingAudioMode } from '../../src/announcement-data/AnnouncementSystem'
import AmeyCelia from '../../src/announcement-data/systems/stations/AmeyCelia'
import AmeyPhil from '../../src/announcement-data/systems/stations/AmeyPhil'
import NamedServices from '../../src/announcement-data/systems/stations/named-services.json'
import { MindTheGapStations } from '../../src/data/liveTrains/mindTheGap'
import { isShortPlatform, shortPlatformData, type ShortPlatformTrain } from '../../src/data/liveTrains/shortPlatforms'
import { announcementPlatforms, audioPlatform, playAnnouncement, type VoicePreferences } from '../../src/live/playAnnouncement'
import type { Announcement, AnnouncementType, Call, Movement, Portion } from '../../src/live/types'
import { queueCases } from './queue'
import { exportSystems } from './systems'
import { AllStationsCrsToNameMap } from '../../src/data/StationManipulators'
import * as Banedanmark from '../../src/announcement-data/systems/international/denmark/Banedanmark'
import * as DlrData from '../../src/announcement-data/systems/rolling-stock/TfLDLRData'
import * as ElizabethLine from '../../src/announcement-data/systems/rolling-stock/TfLElizabeth'
import * as FGWTrainFx from '../../src/announcement-data/systems/rolling-stock/FGWTrainFx'
import * as JubileeLine from '../../src/announcement-data/systems/rolling-stock/TfLJubileeLine'
import * as NorthernLine from '../../src/announcement-data/systems/rolling-stock/TfLNorthernLine'
import * as NorthernTrainFx from '../../src/announcement-data/systems/rolling-stock/NorthernTrainFx'
import * as PiccadillyLine from '../../src/announcement-data/systems/rolling-stock/TfLPiccadillyLine'
import * as PiccadillyLineData from '../../src/announcement-data/systems/rolling-stock/TfLPiccadillyLineData'
import * as ScotRail from '../../src/announcement-data/systems/stations/ScotRail'

interface Clip {
  id: string
  delay: number
  prefix: string
}

interface Plan {
  clips: Clip[]
  startDelay: number
  missingAudioMode: MissingAudioMode
}

type Outcome = { plan: Plan } | { error: string } | { silent: true }

const voices = { phil: new AmeyPhil(), celia: new AmeyCelia() }
type VoiceId = keyof typeof voices

const alerts: string[] = []
Object.assign(globalThis, { alert: (message: string) => alerts.push(message) })
// The handlers narrate as they go, and report the failures that capture() already records.
console.log = console.info = console.warn = console.error = () => {}

/** Runs one play handler and reports what it would have handed to the audio player. */
async function capture(voice: VoiceId, run: (system: AmeyPhil) => Promise<void>): Promise<Outcome> {
  let plan: Plan | null = null
  const system = Object.create(voices[voice]) as AmeyPhil
  system.playAudioFiles = async (files: AudioItem[], _download = false, missingAudioMode: MissingAudioMode = 'skip-service', startDelay = 0) => {
    plan = {
      clips: files.map(file =>
        typeof file === 'string'
          ? { id: file, delay: 0, prefix: '' }
          : { id: file.id, delay: file.opts?.delayStart ?? 0, prefix: file.opts?.customPrefix ?? '' },
      ),
      startDelay,
      missingAudioMode,
    }
  }
  alerts.length = 0
  try {
    await run(system)
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  if (plan) return { plan }
  // A handler that alerts has given up without playing anything.
  return alerts.length ? { error: alerts[0] } : { silent: true }
}

const preferenceSets: VoicePreferences[] = [
  {
    chime: '',
    useLegacyTocNames: false,
    announceViaPoints: true,
    announceShortPlatformsAfterSplit: false,
    fastTrainApproaching: false,
    daktronicsFanfare: false,
    missingAudioMode: 'skip-service',
  },
  {
    chime: 'none',
    useLegacyTocNames: true,
    announceViaPoints: false,
    announceShortPlatformsAfterSplit: true,
    fastTrainApproaching: true,
    daktronicsFanfare: true,
    missingAudioMode: 'play-silence',
  },
  {
    chime: 'three',
    useLegacyTocNames: false,
    announceViaPoints: true,
    announceShortPlatformsAfterSplit: true,
    fastTrainApproaching: true,
    daktronicsFanfare: false,
    missingAudioMode: 'repeat-last-station',
  },
]

const oddPlatforms = ['0', '12', '13', '20', '21', '24', 'a', 'B', 'c', '10d', '25', 'x', '3b', '7']
const delays = [0, 3, 5, 7, 29, 35, 50, 60, 61, 125]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function announce(type: AnnouncementType, details: Movement, extra: Partial<Announcement> = {}): Announcement {
  return {
    version: 2,
    type: 'announcement',
    event_id: `${type}:${details.id}`,
    movement_id: details.id,
    station: details.station,
    announcement_type: type,
    created_at: '2026-09-18T10:00:00Z',
    expires_at: '2026-09-18T10:05:00Z',
    details,
    affected_platforms: details.platform.number ? [details.platform.number] : [],
    previous_platform: null,
    new_platform: null,
    ...extra,
  }
}

function addMinutes(instant: string, minutes: number): string {
  return new Date(Date.parse(instant) + minutes * 60_000).toISOString().replace(/\.?0+Z$/, 'Z')
}

/** Every announcement a movement could raise, with the variations real traffic rarely shows. */
function announcementsFor(movement: Movement, index: number, reasonCodes: string[]): Announcement[] {
  const out: Announcement[] = [
    announce('next', movement),
    announce('standing', movement),
    announce('approaching', movement),
    announce('passing', movement, { affected_platforms: [movement.platform.number || '1', oddPlatforms[index % oddPlatforms.length]] }),
    announce('platform_alteration', movement, {
      previous_platform: movement.platform.number,
      new_platform: oddPlatforms[(index + 3) % oddPlatforms.length],
    }),
  ]

  const replatformed = clone(movement)
  replatformed.platform.number = oddPlatforms[index % oddPlatforms.length]
  out.push(announce('next', replatformed), announce('standing', replatformed), announce('approaching', replatformed))

  const late = clone(movement)
  if (late.departure.planned) late.departure.estimated = addMinutes(late.departure.planned, delays[index % delays.length])
  late.delay_reason = { code: reasonCodes[index % reasonCodes.length], text: null }
  late.loading_percent = index % 3 === 0 ? 85 : late.loading_percent
  out.push(announce('disrupted', late), announce('next', late))

  const unknownDelay = clone(movement)
  unknownDelay.departure.unknown_delay = true
  unknownDelay.delay_reason = index % 2 ? { code: reasonCodes[(index * 7) % reasonCodes.length], text: null } : { code: null, text: null }
  out.push(announce('disrupted', unknownDelay))

  const cancelled = clone(movement)
  cancelled.cancelled = true
  cancelled.cancel_reason = index % 4 === 0 ? { code: null, text: null } : { code: reasonCodes[(index * 13) % reasonCodes.length], text: null }
  out.push(announce('disrupted', cancelled))

  const amended = clone(movement)
  const stops = amended.calling_points.filter(call => call.crs && !call.operational)
  if (stops.length >= 3) {
    stops[0].activities = 'T R '
    stops[1].cancelled = true
    amended.false_destination = { tpl: stops[stops.length - 2].tpl, crs: stops[stops.length - 2].crs, name: stops[stops.length - 2].name }
    amended.reverse_formation = true
    out.push(announce('next', amended), announce('standing', amended))
  }

  const linkedJourneys: [TransportMode[], string][] = [
    [['bus'], 'LK'],
    [['bus', 'train'], 'LK'],
    [['train'], 'LK'],
    [['bus'], 'NP'],
    [['train', 'bus', 'train', 'bus'], 'LK'],
  ]
  for (const [variant, [modes, category]] of linkedJourneys.entries()) {
    const linked = withLinks(movement, modes, category, index % 2 === 1)
    if (!linked) continue
    out.push(announce('next', linked))
    if (index % linkedJourneys.length === variant) {
      out.push(announce('standing', linked), announce('approaching', linked), announce('disrupted', linked))
    }
  }

  // A portion that joins another train, with each way the feed can describe the join.
  const joins: [boolean, boolean | null][] = [
    [false, false],
    [true, false],
    [false, null],
    [false, true],
  ]
  const joining = withJoin(movement, ...joins[index % joins.length])
  if (joining) out.push(announce('next', joining), announce(index % 2 ? 'approaching' : 'standing', joining))

  const dividing = withDivisions(movement, index % divisionVariants)
  if (dividing) out.push(announce('next', dividing), announce(index % 2 ? 'standing' : 'approaching', dividing))

  const detaching = withDetachment(movement, index % detachmentVariants)
  if (detaching) out.push(announce('next', detaching), announce('standing', detaching))

  // Calls where passengers can board, with and without being able to alight as well.
  const boarding = clone(movement)
  const boardingStops = passengerStops(boarding.calling_points)
  if (boardingStops.length >= 3) {
    boarding.calling_points[boardingStops[0]].activities = 'D U'
    boarding.calling_points[boardingStops[1]].activities = 'U'
    out.push(announce('next', boarding))
  }

  return out
}

const place = (call: Call) => ({ tpl: call.tpl, crs: call.crs, name: call.name })
const passengerStops = (calls: Call[]) => calls.flatMap((call, index) => (call.crs && !call.operational && !call.cancelled ? [index] : []))
const associate = (movement: Movement, rid: string, values: Partial<Portion>): Portion => ({
  headcode: null,
  mode: 'train',
  operator_code: movement.operator_code,
  operator_name: movement.operator_name,
  origin: null,
  destination: null,
  rid,
  category: 'VV',
  at: movement.station,
  cancelled: false,
  available: true,
  coach_count: null,
  position: null,
  calls: [],
  main: true,
  links: [],
  ...values,
})

/**
 * The movement as a portion that joins another train halfway along its route, where that train runs the rest of
 * it. The join can be a call that passengers can't use, and `main` is what the feed says of the train joined.
 */
function withJoin(movement: Movement, operational: boolean, main: boolean | null): Movement | null {
  const calls = movement.calling_points
  const stops = passengerStops(calls)
  if (stops.length < 3 || movement.false_destination) return null
  const join = stops[Math.floor(stops.length / 2)]
  const own = movement.destinations.find(destination => !destination.assoc_rid) || movement.destinations[0]

  const joining = clone(movement)
  joining.calling_points = joining.calling_points.slice(0, join + 1)
  joining.calling_points[join].operational = operational
  joining.destinations = [{ ...place(calls[join]), via: null, assoc_rid: null, assoc_cat: null }]
  // Some of the trains joined go on to divide, at the stop after the join and to the stop where the journey began.
  const after = stops[Math.floor(stops.length / 2) + 1]
  const divides = main === false && after !== undefined && after !== stops[stops.length - 1]
  joining.portions.push(
    associate(movement, `${movement.rid}-joined`, {
      category: 'JJ',
      at: place(calls[join]),
      main,
      destination: own ? { tpl: own.tpl, crs: own.crs, name: own.name } : null,
      calls: clone(calls.slice(join)),
      links: divides
        ? [
            associate(movement, `${movement.rid}-joined-portion`, {
              at: place(calls[after]),
              destination: place(calls[stops[0]]),
              coach_count: 4,
              position: operational ? 'front' : null,
              calls: clone([calls[after], calls[stops[0]]]),
            }),
          ]
        : [],
    }),
  )
  return joining
}

const detachmentVariants = 5

/**
 * The movement leaving coaches behind at its second stop while it runs on as the same service: with and without a
 * length and an end for them, and with a reversal on the way there, which swaps the ends.
 */
function withDetachment(movement: Movement, variant: number): Movement | null {
  const stops = passengerStops(movement.calling_points)
  if (stops.length < 4 || movement.false_destination || movement.portions.some(portion => portion.category === 'VV')) return null
  const detaching = clone(movement)
  const [first, at] = [detaching.calling_points[stops[0]], detaching.calling_points[stops[1]]]
  const detached = [
    { coaches: 4, position: 'rear' },
    { coaches: 4, position: 'front' },
    { coaches: null, position: 'rear' },
    { coaches: 2, position: null },
    { coaches: 4, position: 'front' },
  ][variant]
  at.formation_change = { detached, attached: null }
  // The train reverses out of the stop where it leaves the coaches, or of the stop before.
  if (variant === 1) at.activities = `${at.activities || 'T '}RM`
  if (variant === 4) first.activities = `${first.activities || 'T '}RM`
  return detaching
}

const divisionVariants = 10

/**
 * The movement with a portion dividing off it, in each way that changes what the voice says: the end and length
 * that the feed gives the portion, a division where the train sets nobody down, a second portion at the same
 * station or further along, a portion with nowhere left to call, and a division where the train itself ends.
 */
function withDivisions(movement: Movement, variant: number): Movement | null {
  const calls = movement.calling_points
  const stops = passengerStops(calls)
  if (stops.length < 5 || movement.false_destination || movement.portions.some(portion => portion.category === 'VV')) return null
  const dividing = clone(movement)
  const divide = (rid: string, at: number, to: number, values: Partial<Portion> = {}) => {
    const portion = associate(movement, `${movement.rid}-${rid}`, {
      at: place(calls[at]),
      destination: place(calls[to]),
      calls: clone([calls[at], calls[to]]),
      ...values,
    })
    dividing.portions.push(portion)
    dividing.destinations.push({ ...place(calls[to]), via: null, assoc_rid: portion.rid, assoc_cat: 'VV' })
    return portion
  }
  const [at, further, penultimate, last] = [stops[1], stops[2], stops[stops.length - 2], stops[stops.length - 1]]
  const split = dividing.calling_points[at]

  switch (variant) {
    case 0:
      split.detach_front = false
      divide('portion', at, penultimate, { coach_count: 4 })
      break
    case 1:
      split.detach_front = true
      divide('portion', at, penultimate)
      break
    case 2:
      split.detach_front = null
      divide('portion', at, penultimate, { coach_count: 4 })
      break
    case 3:
      split.operational = true
      divide('portion', at, penultimate, { coach_count: 2 }).calls[0].operational = true
      break
    case 4:
      divide('portion', at, penultimate, { coach_count: 4 })
      divide('second', at, further, { coach_count: 2, position: movement.coach_count ? 'middle' : null })
      break
    case 5:
      divide('portion', at, penultimate, { coach_count: 4 }).calls[1].cancelled = true
      break
    case 6:
      divide('portion', last, stops[0], { coach_count: 4 })
      break
    case 7:
      split.detach_front = false
      divide('portion', at, penultimate, { coach_count: 4 })
      divide('later', further, stops[stops.length - 3], { coach_count: 2 })
      break
    case 8:
      // The feed's own position outranks Darwin's default.
      split.detach_front = false
      divide('portion', at, penultimate, { coach_count: 4, position: 'front' })
      break
    case 9: {
      // A reversal on the way to the division swaps the ends.
      const first = dividing.calling_points[stops[0]]
      first.activities = `${first.activities || 'T '}RM`
      divide('portion', at, penultimate, { coach_count: 4, position: 'rear' })
      break
    }
  }
  return dividing
}

type TransportMode = NonNullable<Portion['mode']>

/**
 * The movement with the end of its route run by services linked on from it, one for each mode, as Darwin sends a
 * train that a replacement bus finishes for. The train either ends at the first link, or is cut short there with
 * its later calls cancelled.
 */
function withLinks(movement: Movement, modes: TransportMode[], category: string, cutShort: boolean): Movement | null {
  const calls = movement.calling_points
  const stops = calls.flatMap((call, index) => (call.crs && !call.operational && !call.cancelled ? [index] : []))
  if (stops.length < modes.length + 2) return null
  // Each service runs an equal share of the stops, and hands over at the last of its own.
  const handovers = modes.map((_, leg) => stops[Math.floor(((leg + 1) * stops.length) / (modes.length + 1)) - 1])
  const own = movement.destinations.find(destination => !destination.assoc_rid) || movement.destinations[0]

  let links: Portion[] = []
  for (let leg = modes.length - 1; leg >= 0; leg--) {
    const last = leg === modes.length - 1
    const until = last ? calls.length : handovers[leg + 1] + 1
    links = [
      {
        headcode: null,
        // The feed leaves a train's mode unset when Darwin gave the service no status.
        mode: modes[leg] === 'train' && leg % 2 ? null : modes[leg],
        operator_code: movement.operator_code,
        operator_name: movement.operator_name,
        origin: place(calls[handovers[leg]]),
        destination: last && own ? { tpl: own.tpl, crs: own.crs, name: own.name } : place(calls[until - 1]),
        rid: `${movement.rid}-link-${leg}`,
        category: leg === 0 ? category : 'LK',
        at: place(calls[handovers[leg]]),
        cancelled: false,
        available: true,
        coach_count: null,
        position: null,
        calls: clone(calls.slice(handovers[leg], until)),
        main: leg % 3 === 2 ? null : true,
        links,
      },
    ]
  }

  const linked = clone(movement)
  linked.portions.push(...links)
  if (cutShort) {
    for (const call of linked.calling_points.slice(handovers[0] + 1)) call.cancelled = true
  } else {
    linked.calling_points = linked.calling_points.slice(0, handovers[0] + 1)
    const ends = { ...place(calls[handovers[0]]), via: null, assoc_rid: null, assoc_cat: null }
    linked.destinations = [ends, ...linked.destinations.filter(destination => destination.assoc_rid)]
  }
  return linked
}

async function liveCases(movements: Movement[]) {
  const reasonCodes = Object.keys(voices.phil.DelayCodeMapping)
  const cases = []
  let counter = 0
  for (const [index, movement] of movements.entries()) {
    for (const announcement of announcementsFor(movement, index, reasonCodes)) {
      const voice: VoiceId = counter % 2 ? 'celia' : 'phil'
      const preferences = preferenceSets[counter % preferenceSets.length]
      counter++
      const platforms = []
      for (const platform of announcementPlatforms(announcement)) {
        if (!platform) {
          platforms.push({ platform, spoken: null, outcome: { silent: true } })
          continue
        }
        const spoken = audioPlatform(platform, voices[voice])
        if (spoken === null) {
          platforms.push({ platform, spoken, outcome: { silent: true } })
          continue
        }
        platforms.push({
          platform,
          spoken,
          outcome: await capture(voice, system => playAnnouncement(announcement, system, preferences, spoken)),
        })
      }
      const { details, ...envelope } = announcement
      cases.push({ voice, preferences, movement: index, announcement: envelope, details: details === movement ? null : details, platforms })
    }
  }
  return cases
}

const point = (crsCode: string, extra: Record<string, unknown> = {}) => ({ crsCode, name: crsCode, randomId: crsCode, ...extra })

/** States the presets never reach: every way a train can divide, be short of a platform or turn into a bus. */
function variations(tabId: string, base: any): any[] {
  if (!base) return []
  const out: any[] = []
  if (tabId === 'fastTrain' || tabId === 'approachingTrain') {
    for (const platform of oddPlatforms) {
      out.push({ ...base, platform: platform.toLowerCase(), isDelayed: platform === '13', chime: 'none', fastTrainApproaching: true })
    }
    return out
  }
  if (tabId === 'disruptedTrain') {
    for (const delayTime of ['0', '1', '9', '10', '44', '60', '61', '135']) {
      for (const disruptionReason of ['', ['disruption-reason.e.a fault on this train which cannot be rectified']]) {
        out.push({ ...base, disruptionType: 'delayedBy', delayTime, disruptionReason })
      }
    }
    return out
  }
  if (tabId !== 'nextTrain' && tabId !== 'standingTrain') return out

  const portionCalls = [point('LWS', { shortPlatform: 'front.4' }), point('SEF', { requestStop: true }), point('EBN')]
  for (const splitType of ['splits', 'splitTerminates']) {
    for (const splitForm of ['front.4', 'rear.1', 'rear.8', 'front.12', 'middle.2', 'unknown', 'unknown.4', 'front', 'rear', undefined, '']) {
      for (const coaches of ['8 coaches', 'None', '12 coaches', '1 coach']) {
        for (const announceShortPlatformsAfterSplit of [false, true]) {
          out.push({
            ...base,
            coaches,
            announceShortPlatformsAfterSplit,
            terminatingStationCode: 'LIT',
            callingAt: [
              point('ECR', { shortPlatform: 'front.10' }),
              point('GTW', { requestStop: true, shortPlatform: 'rear.2' }),
              point('HHE', { splitType, splitForm, splitCallingPoints: portionCalls, shortPlatform: 'front.4' }),
              point('HOV', { shortPlatform: 'front.1' }),
              point('WRH', { shortPlatform: 'rear.6' }),
              point('ANG', { shortPlatform: 'unknown' }),
            ],
          })
        }
      }
    }
  }
  out.push({ ...base, callingAt: [point('HHE', { splitType: 'splits', splitForm: 'front.4', splitCallingPoints: [] })] })
  // Only the live feed describes more than one portion dividing off.
  for (const [splitForm, ...furtherForms] of [
    ['rear.4', 'middle.2'],
    ['unknown', 'unknown'],
    ['front.2', 'unknown'],
    ['rear.4', 'middle.2', 'unknown'],
    ['rear', 'middle'],
  ]) {
    for (const coaches of ['12 coaches', 'None']) {
      out.push({
        ...base,
        coaches,
        announceShortPlatformsAfterSplit: true,
        terminatingStationCode: 'LIT',
        callingAt: [
          point('ECR'),
          point('HHE', {
            splitType: 'splits',
            splitForm,
            splitCallingPoints: portionCalls,
            furtherSplits: furtherForms.map((form, further) => ({
              splitForm: form,
              splitCallingPoints: further ? [] : [point('BTN', { requestStop: true }), point('SSE', { shortPlatform: 'front.3' })],
            })),
          }),
          point('HOV', { shortPlatform: 'front.1' }),
        ],
      })
    }
  }
  out.push({
    ...base,
    callingAt: [point('HHE', { splitType: 'splits', splitForm: 'front.4', splitCallingPoints: [point('HHE'), point('LWS')] })],
  })

  for (const restart of [-1, 2, 3, 4]) {
    const callingAt = ['ECR', 'GTW', 'TBD', 'HHE', 'BTN'].map((crs, index) =>
      point(crs, { continuesAsRrbAfterHere: index === 1, continuesAsTrainAfterHere: index === restart }),
    )
    out.push({ ...base, callingAt })
  }
  out.push({ ...base, callingAt: [point('ECR', { continuesAsRrbAfterHere: true })] })

  for (const platform of oddPlatforms) out.push({ ...base, platform: platform.toLowerCase(), isDelayed: platform === '12' || platform === '21' })
  out.push({ ...base, serviceLoading: 'no seats available', firstClassLocation: 'front', toc: 'southern', callingAt: [] })
  out.push({ ...base, serviceLoading: 'full and standing', firstClassLocation: 'rear', toc: 'Thameslink', vias: [point('GTW'), point('ECR')] })
  out.push({
    ...base,
    callingAt: [point('GTW', { requestStop: true }), point('TBD', { requestStop: true })],
    notCallingAtStations: [point('HHE')],
  })
  for (const shorts of [['front.4'], ['front.4', 'front.4'], ['front.4', 'rear.2', 'front.1'], ['unknown', 'front.4']]) {
    out.push({ ...base, callingAt: shorts.map((shortPlatform, index) => point(['GTW', 'TBD', 'HHE'][index], { shortPlatform })) })
  }
  return out
}

/** The tabs' own presets are complete option states, which is what the backend will be posted. */
async function stateCases() {
  const handlers = {
    nextTrain: 'playNextTrainAnnouncement',
    standingTrain: 'playStandingTrainAnnouncement',
    disruptedTrain: 'playDisruptedTrainAnnouncement',
    fastTrain: 'playFastTrainAnnouncement',
    approachingTrain: 'playTrainApproachingAnnouncement',
    platformAlteration: 'playPlatformAlterationAnnouncement',
  } as const
  const cases = []
  for (const voice of Object.keys(voices) as VoiceId[]) {
    const system = voices[voice] as any
    for (const [tabId, tab] of Object.entries<any>(system.customAnnouncementTabs)) {
      const handler = handlers[tabId as keyof typeof handlers]
      if (!handler) continue
      const states = [tab.defaultState, ...(tab.props.presets || []).map((preset: any) => ({ ...tab.defaultState, ...preset.state }))]
      for (const state of [...states, ...variations(tabId, tab.defaultState)]) {
        if (!state) continue
        // The presets give each calling point a random ID, which would rewrite this file on every run.
        const stable = JSON.parse(JSON.stringify(state, (key, value) => (key === 'randomId' ? 'id' : value)))
        cases.push({
          voice,
          announcement: tabId,
          state: stable,
          outcome: await capture(voice, scoped => (scoped as any)[handler](clone(stable))),
        })
      }
    }
  }
  return cases
}

function tocCases() {
  const uids = ['', 'G44964', 'C90560', 'G44729', 'X00000']
  const cases = []
  for (const voice of Object.keys(voices) as VoiceId[]) {
    const system = voices[voice] as any
    const names: string[] = [
      '',
      'Southern',
      'thameslink',
      'Great Western Railway',
      'LNER',
      'Nobody Trains',
      ...system.ALL_AVAILABLE_TOCS.slice(0, 400),
    ]
    const codes = ['AW', 'CC', 'CH', 'CS', 'EM', 'ES', 'GC', 'GN', 'GR', 'GW', 'GX', 'HT', 'HX', 'IL', 'LD', 'LE', 'LM', 'LO', 'ME', 'NT']
    codes.push('SE', 'SN', 'SR', 'SW', 'TL', 'TP', 'TW', 'VT', 'XC', 'XR', 'gw', 'lm', '')
    let counter = 0
    for (const code of codes) {
      for (const legacy of [false, true]) {
        for (const uid of code.toUpperCase() === 'GW' ? uids : ['']) {
          for (const [origin, destination] of [
            ['BTN', 'VIC'],
            ['EUS', 'BHM'],
            ['BHM', 'LIV'],
          ]) {
            const name = names[counter++ % names.length]
            cases.push({
              voice,
              name,
              code,
              origin,
              destination,
              legacy,
              uid,
              toc: system.processTocForLiveTrains(name, code, origin, destination, legacy, uid),
            })
          }
        }
      }
    }
    for (const name of names) {
      cases.push({
        voice,
        name,
        code: 'ZZ',
        origin: 'BTN',
        destination: 'VIC',
        legacy: false,
        uid: '',
        toc: system.processTocForLiveTrains(name, 'ZZ', 'BTN', 'VIC', false, ''),
      })
    }
  }
  return cases
}

function shortPlatformCases() {
  const trains: ShortPlatformTrain[] = [
    { operatorCode: 'SN', length: 8, origin: [{ crs: 'VIC' }], destination: [{ crs: 'BTN' }], subsequentLocations: [{ crs: 'HHE' }] },
    { operatorCode: 'SN', length: 4, origin: [{ crs: 'LBG' }], destination: [{ crs: 'UCK' }], subsequentLocations: [{ crs: 'EBT' }] },
    {
      operatorCode: 'SN',
      length: null,
      origin: [{ crs: 'VIC' }],
      destination: [{ crs: 'ORE' }],
      subsequentLocations: [{ crs: 'AFK' }, { crs: null }],
    },
    { operatorCode: 'SE', length: 12, origin: [{ crs: 'STP' }], destination: [{ crs: 'MAR' }], subsequentLocations: [] },
    { operatorCode: 'SE', length: 6, origin: [{ crs: 'CHX' }], destination: [{ crs: 'DVP' }], subsequentLocations: [{ crs: 'ASI' }] },
    { operatorCode: 'TL', length: 12, origin: [{ crs: 'BDM' }], destination: [{ crs: 'BTN' }], subsequentLocations: [] },
    { operatorCode: 'TL', length: 0, origin: [], destination: [], subsequentLocations: [] },
  ]
  const cases = []
  for (const [crs, platforms] of Object.entries(shortPlatformData)) {
    for (const platform of [...Object.keys(platforms).filter(name => name !== '*'), '1', '2B', null]) {
      for (const train of trains) {
        cases.push({ crs, platform, train, result: isShortPlatform(crs, platform, train) })
      }
    }
  }
  return cases
}

function voiceData(voice: VoiceId) {
  const system = voices[voice] as any
  return {
    id: system.ID,
    name: system.NAME,
    filePrefix: system.FILE_PREFIX,
    defaultChime: system.DEFAULT_CHIME,
    beforeTocDelay: system.BEFORE_TOC_DELAY,
    beforeSectionDelay: system.BEFORE_SECTION_DELAY,
    shortDelay: system.SHORT_DELAY,
    genericOptions: system.genericOptions,
    callingPointsOptions: system.callingPointsOptions,
    requestStopOptions: system.requestStopOptions,
    shortPlatformOptions: system.shortPlatformOptions,
    standingOptions: system.standingOptions,
    splitOptions: system.splitOptions,
    disruptionOptions: system.disruptionOptions,
    platforms: system.PLATFORMS,
    tocs: system.AVAILABLE_TOCS,
    allTocs: system.ALL_AVAILABLE_TOCS,
    delayCodes: Object.fromEntries(Object.entries<any>(system.DelayCodeMapping).map(([code, clips]) => [code, clips.e])),
  }
}

function shortPlatformTable() {
  return Object.fromEntries(
    Object.entries(shortPlatformData).map(([crs, platforms]) => [
      crs,
      Object.fromEntries(
        Object.entries(platforms).map(([platform, operators]) => [
          platform,
          Object.fromEntries(
            Object.entries(operators).map(([operator, value]) => [
              operator,
              typeof value === 'function' ? { rule: value.rule, lengths: value.lengths } : value,
            ]),
          ),
        ]),
      ),
    ]),
  )
}

function writeJson(path: string, value: unknown, compress = false) {
  const text = JSON.stringify(value, null, compress ? undefined : 2) + '\n'
  writeFileSync(path, compress ? gzipSync(text, { level: 9 }) : text)
}

async function main() {
  const backend = process.argv[2]
  if (!backend) throw new Error('Pass the path of the rail-announcements-backend checkout')
  const data = join(backend, 'internal/ketech/data')
  const testdata = join(backend, 'internal/ketech/testdata')
  const queueTestdata = join(backend, 'internal/queue/testdata')
  for (const directory of [data, testdata, queueTestdata]) mkdirSync(directory, { recursive: true })

  writeJson(join(data, 'phil.json'), voiceData('phil'))
  writeJson(join(data, 'celia.json'), voiceData('celia'))
  writeJson(join(data, 'short-platforms.json'), shortPlatformTable())
  writeJson(join(data, 'mind-the-gap.json'), MindTheGapStations)
  writeJson(join(data, 'named-services.json'), NamedServices)

  const movements: Movement[] = JSON.parse(gunzipSync(readFileSync(join(testdata, 'movements.json.gz'))).toString())
  // The movements were captured before a portion carried its direction and its links.
  for (const movement of movements) {
    for (const portion of movement.portions) Object.assign(portion, { main: portion.main ?? null, links: portion.links ?? [] })
  }
  const live = await liveCases(movements)
  writeJson(join(testdata, 'parity-live.json.gz'), live, true)
  const states = await stateCases()
  writeJson(join(testdata, 'parity-state.json.gz'), states, true)
  writeJson(join(testdata, 'parity-toc.json.gz'), tocCases(), true)
  writeJson(join(testdata, 'parity-short-platforms.json.gz'), shortPlatformCases(), true)

  const queue = await queueCases(movements)
  writeJson(join(queueTestdata, 'parity-queue.json'), queue)

  // The station names every voice's "no recording for X" message is built from.
  const sharedData = join(backend, 'internal/systems/shared/data')
  mkdirSync(sharedData, { recursive: true })
  const stationNames = Object.keys(AllStationsCrsToNameMap).sort()
  writeJson(join(sharedData, 'stations.json'), Object.fromEntries(stationNames.map(crs => [crs, AllStationsCrsToNameMap[crs]])))

  // Tables that a system keeps in a module of its own, and not on its class.
  const systems = await exportSystems(backend, {
    BANEDANMARK_V1: Banedanmark,
    FGW_TRAINFX_V1: FGWTrainFx,
    NORTHERN_TRAINFX_V1: NorthernTrainFx,
    SCOTRAIL_STN_V1: ScotRail,
    TFL_DLR_V1: DlrData,
    TFL_ELIZ_LINE_V1: ElizabethLine,
    TFL_JUBILEE_LINE_V1: JubileeLine,
    TFL_NORTHERN_LINE_V1: NorthernLine,
    TFL_PICCADILLY_LINE_V1: { ...PiccadillyLineData, ...PiccadillyLine },
  })

  const count = (outcomes: Outcome[], key: string) => outcomes.filter(outcome => key in outcome).length
  const outcomes = live.flatMap(entry => entry.platforms.map(platform => platform.outcome as Outcome))
  process.stderr.write(
    `live: ${live.length} cases (${count(outcomes, 'plan')} plans, ${count(outcomes, 'error')} errors, ${count(outcomes, 'silent')} silent)\n` +
      `state: ${states.length} cases, queue: ${queue.length} scenarios\n` +
      `systems:\n  ${systems.join('\n  ')}\n`,
  )
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
})
