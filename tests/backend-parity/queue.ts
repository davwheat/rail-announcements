/**
 * Scripts that drive the real playback queue, with everything it did in response. The backend
 * replays each script against its Go queue and expects the same trace.
 */
import { setImmediate } from 'node:timers/promises'
import { announcementPlatforms } from '../../src/live/playAnnouncement'
import { PlaybackQueue } from '../../src/live/playbackQueue'
import type { Announcement, AnnouncementType, Movement } from '../../src/live/types'

type Step =
  | { op: 'push'; announcement: Announcement }
  | { op: 'retract'; event_id: string; reason?: string }
  | { op: 'revise'; event_id: string; details: Movement }
  | { op: 'finish'; event_id: string }
  | { op: 'fail'; event_id: string; message: string }
  | { op: 'advance'; ms: number }
  | { op: 'reset' }

interface Scenario {
  name: string
  /** Platforms that share a lane, as the station's zones. An empty list keeps the whole station in one lane. */
  zones: string[][]
  steps: Step[]
}

const START = Date.parse('2026-09-18T10:00:00Z')

async function run(scenario: Scenario) {
  let now = START
  let trace: string[] = []
  const plays = new Map<string, { resolve: () => void; reject: (error: Error) => void }>()
  const lanes = new Map<string, string>()
  for (const zone of scenario.zones) for (const platform of zone) lanes.set(platform, [...zone].sort().join('+'))

  const queue = new PlaybackQueue(
    (announcement, signal) => {
      trace.push(`start ${announcement.event_id}`)
      signal.addEventListener('abort', () => trace.push(`abort ${announcement.event_id}`), { once: true })
      return new Promise<void>((resolve, reject) => plays.set(announcement.event_id, { resolve, reject }))
    },
    () => now,
    error => trace.push(`error ${error instanceof Error ? error.message : String(error)}`),
    announcement => {
      if (!scenario.zones.length) return ['']
      return [...new Set(announcementPlatforms(announcement).map(platform => (platform ? (lanes.get(platform) ?? platform) : '')))]
    },
    message => trace.push(`log ${message}`),
  )

  const expected: string[][] = []
  for (const step of scenario.steps) {
    trace = []
    switch (step.op) {
      case 'push':
        queue.push(step.announcement)
        break
      case 'retract':
        queue.retract(step.event_id, step.reason)
        break
      case 'revise':
        queue.revise(step.event_id, step.details)
        break
      case 'finish':
        plays.get(step.event_id)?.resolve()
        break
      case 'fail':
        plays.get(step.event_id)?.reject(new Error(step.message))
        break
      case 'advance':
        now += step.ms
        break
      case 'reset':
        queue.reset()
        break
    }
    await setImmediate()
    expected.push(trace)
  }
  // Every play still open holds a five-minute timer, which would keep this process alive.
  trace = []
  queue.reset()
  await setImmediate()
  return { ...scenario, start: new Date(START).toISOString(), expected }
}

export async function queueCases(movements: Movement[]) {
  // The queue reads a train's identity and nothing else, so the scripts stay small without its calls.
  const trains = movements
    .filter(movement => movement.departure.planned && movement.platform.number && movement.destinations.length)
    .map(movement => ({ ...movement, calling_points: [], portions: [], coaches: null }))
  const [a, b, c, d] = trains
  let serial = 0
  const make = (type: AnnouncementType, details: Movement, extra: Partial<Announcement> = {}, lifetime = 300_000): Announcement => ({
    version: 2,
    type: 'announcement',
    event_id: `e${++serial}`,
    movement_id: details.id,
    station: details.station,
    announcement_type: type,
    created_at: new Date(START).toISOString(),
    expires_at: new Date(START + lifetime).toISOString(),
    details,
    affected_platforms: details.platform.number ? [details.platform.number] : [],
    previous_platform: null,
    new_platform: null,
    ...extra,
  })
  const on = (details: Movement, platform: string | null): Movement => ({ ...details, platform: { ...details.platform, number: platform } })
  const cancelled = (details: Movement): Movement => ({ ...details, cancelled: true })

  const scenarios: Scenario[] = []
  const scenario = (name: string, zones: string[][], build: () => Step[]) => {
    serial = 0
    scenarios.push({ name, zones, steps: build() })
  }

  scenario('one lane plays in turn', [], () => {
    const first = make('next', on(a, '1'))
    const second = make('next', on(b, '2'))
    const third = make('approaching', on(c, '3'))
    return [
      { op: 'push', announcement: first },
      { op: 'push', announcement: second },
      { op: 'push', announcement: third },
      { op: 'push', announcement: first },
      { op: 'finish', event_id: first.event_id },
      { op: 'finish', event_id: second.event_id },
      { op: 'finish', event_id: third.event_id },
    ]
  })

  scenario('zones play side by side', [['1', '2'], ['3']], () => {
    const first = make('next', on(a, '1'))
    const second = make('next', on(b, '2'))
    const third = make('next', on(c, '3'))
    const unplaced = make('next', on(d, null))
    const warning = make('passing', on(d, null), { affected_platforms: ['2', '3'] })
    return [
      { op: 'push', announcement: first },
      { op: 'push', announcement: second },
      { op: 'push', announcement: third },
      { op: 'push', announcement: unplaced },
      { op: 'push', announcement: warning },
      { op: 'finish', event_id: third.event_id },
      { op: 'finish', event_id: first.event_id },
      { op: 'finish', event_id: second.event_id },
      { op: 'finish', event_id: unplaced.event_id },
      { op: 'finish', event_id: warning.event_id },
    ]
  })

  scenario('later stages replace earlier ones while they wait', [], () => {
    const blocker = make('next', on(a, '1'))
    const next = make('next', on(b, '2'))
    const approaching = make('approaching', on(b, '2'))
    const late = make('disrupted', on(b, '2'))
    const standing = make('standing', on(b, '2'))
    const nextAgain = make('next', on(b, '2'))
    return [
      { op: 'push', announcement: blocker },
      { op: 'push', announcement: next },
      { op: 'push', announcement: approaching },
      { op: 'push', announcement: late },
      { op: 'push', announcement: standing },
      { op: 'push', announcement: nextAgain },
      { op: 'finish', event_id: blocker.event_id },
      { op: 'finish', event_id: standing.event_id },
      { op: 'finish', event_id: nextAgain.event_id },
    ]
  })

  scenario('a cancellation clears the staged announcements', [], () => {
    const blocker = make('next', on(a, '1'))
    const next = make('next', on(b, '2'))
    const alteration = make('platform_alteration', on(b, '4'), { previous_platform: '2', new_platform: '4' })
    const gone = make('disrupted', cancelled(on(b, '4')))
    return [
      { op: 'push', announcement: blocker },
      { op: 'push', announcement: next },
      { op: 'push', announcement: alteration },
      { op: 'push', announcement: gone },
      { op: 'finish', event_id: blocker.event_id },
      { op: 'finish', event_id: alteration.event_id },
      { op: 'finish', event_id: gone.event_id },
    ]
  })

  scenario('a platform alteration cuts its own train short', [['1'], ['2'], ['4']], () => {
    const next = make('next', on(a, '2'))
    const other = make('next', on(b, '1'))
    const alteration = make('platform_alteration', on(a, '4'), { previous_platform: '2', new_platform: '4' })
    return [
      { op: 'push', announcement: next },
      { op: 'push', announcement: other },
      { op: 'push', announcement: alteration },
      { op: 'finish', event_id: next.event_id },
      { op: 'finish', event_id: alteration.event_id },
      { op: 'finish', event_id: other.event_id },
    ]
  })

  scenario('a fast train outranks a delay on its platform only', [['1'], ['2']], () => {
    const delayOne = make('disrupted', on(a, '1'))
    const delayTwo = make('disrupted', on(b, '2'))
    const warning = make('passing', on(c, null), { affected_platforms: ['2'] })
    const nextOne = make('next', on(d, '1'))
    const warnOne = make('passing', on(c, null), { affected_platforms: ['1'] })
    return [
      { op: 'push', announcement: delayOne },
      { op: 'push', announcement: delayTwo },
      { op: 'push', announcement: warning },
      { op: 'finish', event_id: warning.event_id },
      { op: 'finish', event_id: delayOne.event_id },
      { op: 'push', announcement: nextOne },
      { op: 'push', announcement: warnOne },
      { op: 'finish', event_id: nextOne.event_id },
      { op: 'finish', event_id: warnOne.event_id },
    ]
  })

  scenario('withdrawals and revisions', [], () => {
    const speaking = make('next', on(a, '1'))
    const waiting = make('next', on(b, '2'))
    const revised = make('next', on(c, '3'))
    return [
      { op: 'push', announcement: speaking },
      { op: 'push', announcement: waiting },
      { op: 'push', announcement: revised },
      { op: 'retract', event_id: waiting.event_id, reason: 'departed' },
      { op: 'retract', event_id: speaking.event_id, reason: 'cancelled' },
      { op: 'retract', event_id: 'never-sent' },
      { op: 'revise', event_id: revised.event_id, details: on(c, '5') },
      { op: 'revise', event_id: speaking.event_id, details: on(a, '9') },
      { op: 'finish', event_id: speaking.event_id },
      { op: 'retract', event_id: speaking.event_id },
      { op: 'finish', event_id: revised.event_id },
    ]
  })

  scenario('expiry and failure', [], () => {
    const stale = make('next', on(a, '1'), {}, 0)
    const speaking = make('next', on(b, '2'))
    const brief = make('next', on(c, '3'), {}, 60_000)
    const lasting = make('next', on(d, '4'))
    const unreadable = make('next', on(a, '5'), { expires_at: 'soon' })
    return [
      { op: 'push', announcement: stale },
      { op: 'push', announcement: unreadable },
      { op: 'push', announcement: speaking },
      { op: 'push', announcement: brief },
      { op: 'push', announcement: lasting },
      { op: 'advance', ms: 90_000 },
      { op: 'fail', event_id: speaking.event_id, message: 'No station audio identity for Nowhere' },
      { op: 'finish', event_id: lasting.event_id },
    ]
  })

  scenario('a delay is not news once the train is approaching', [], () => {
    const approaching = make('approaching', on(a, '1'))
    const late = make('disrupted', on(a, '1'))
    const otherLate = make('disrupted', on(b, '2'))
    return [
      { op: 'push', announcement: approaching },
      { op: 'push', announcement: late },
      { op: 'push', announcement: otherLate },
      { op: 'finish', event_id: approaching.event_id },
      { op: 'finish', event_id: otherLate.event_id },
    ]
  })

  scenario('a reset forgets everything', [['1'], ['2']], () => {
    const first = make('next', on(a, '1'))
    const second = make('next', on(b, '1'))
    const third = make('next', on(c, '2'))
    return [
      { op: 'push', announcement: first },
      { op: 'push', announcement: second },
      { op: 'push', announcement: third },
      { op: 'reset' },
      { op: 'reset' },
      { op: 'finish', event_id: first.event_id },
      { op: 'push', announcement: first },
      { op: 'finish', event_id: first.event_id },
    ]
  })

  scenario('the queue is bounded', [], () => {
    const steps: Step[] = [{ op: 'push', announcement: make('next', on(a, '1')) }]
    for (let index = 0; index < 66; index++) {
      steps.push({ op: 'push', announcement: make('next', { ...on(trains[index % trains.length], '2'), id: `bulk-${index}` }) })
    }
    return steps
  })

  const results = []
  for (const entry of scenarios) results.push(await run(entry))
  return results
}
