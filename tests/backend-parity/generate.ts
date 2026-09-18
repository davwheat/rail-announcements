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

  const bus = withBusContinuation(movement)
  if (bus) out.push(announce('next', bus), announce('standing', bus))

  return out
}

function withBusContinuation(movement: Movement): Movement | null {
  if (movement.portions.length) return null
  const stops = movement.calling_points.filter(call => call.crs && !call.operational && !call.cancelled)
  if (stops.length < 4) return null
  const bus = clone(movement)
  const at = stops[stops.length - 3]
  const onward: Call[] = clone(stops.slice(-3))
  const portion: Portion = {
    headcode: null,
    mode: 'bus',
    operator_code: movement.operator_code,
    operator_name: movement.operator_name,
    origin: null,
    destination: null,
    rid: `${movement.rid}-bus`,
    category: 'NP',
    at: { tpl: at.tpl, crs: at.crs, name: at.name },
    cancelled: false,
    available: true,
    coach_count: null,
    position: null,
    calls: onward,
  }
  bus.portions = [portion]
  return bus
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
      for (const disruptionReason of ['', ['disruption-reason.e.a fault on this train']]) {
        out.push({ ...base, disruptionType: 'delayedBy', delayTime, disruptionReason })
      }
    }
    return out
  }
  if (tabId !== 'nextTrain' && tabId !== 'standingTrain') return out

  const portionCalls = [point('LWS', { shortPlatform: 'front.4' }), point('SEF', { requestStop: true }), point('EBN')]
  for (const splitType of ['splits', 'splitTerminates']) {
    for (const splitForm of ['front.4', 'rear.1', 'rear.8', 'front.12', 'middle.2', 'unknown', undefined, '']) {
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
  const live = await liveCases(movements)
  writeJson(join(testdata, 'parity-live.json.gz'), live, true)
  const states = await stateCases()
  writeJson(join(testdata, 'parity-state.json.gz'), states, true)
  writeJson(join(testdata, 'parity-toc.json.gz'), tocCases(), true)
  writeJson(join(testdata, 'parity-short-platforms.json.gz'), shortPlatformCases(), true)

  const queue = await queueCases(movements)
  writeJson(join(queueTestdata, 'parity-queue.json'), queue)

  const count = (outcomes: Outcome[], key: string) => outcomes.filter(outcome => key in outcome).length
  const outcomes = live.flatMap(entry => entry.platforms.map(platform => platform.outcome as Outcome))
  process.stderr.write(
    `live: ${live.length} cases (${count(outcomes, 'plan')} plans, ${count(outcomes, 'error')} errors, ${count(outcomes, 'silent')} silent)\n` +
      `state: ${states.length} cases, queue: ${queue.length} scenarios\n`,
  )
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
})
