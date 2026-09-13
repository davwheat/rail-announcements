import assert from 'node:assert/strict'
import { test } from 'node:test'
import { streamUrl } from '../src/live/connection'
import fixture from './snapshot.json'
import type { Movement } from '../src/live/types'

/** The fixture is a station projection; the tests only need the train out of it. */
const snapshot = () => structuredClone(fixture) as unknown as { movements: Movement[] }

test('WebSocket URLs default cleanly to the local service and support a remote prefix', () => {
  assert.equal(streamUrl('ws://localhost:8080', 'announcements', 'TST').href, 'ws://localhost:8080/v1/announcements/live?crs=TST')
  assert.equal(streamUrl('https://example.test/darwin/', 'announcements', 'TST').href, 'wss://example.test/darwin/v1/announcements/live?crs=TST')
  assert.throws(() => streamUrl('file:///tmp', 'announcements', 'TST'))
})

class FakeSocket {
  static sockets: FakeSocket[] = []
  /** Nothing should ever be written to the announcement stream; asserted, not used. */
  sent: string[] = []
  onmessage?: (event: { data: string }) => void
  onclose?: () => void
  onerror?: () => void
  constructor(readonly url: URL) {
    FakeSocket.sockets.push(this)
  }
  send(value: string) {
    this.sent.push(value)
  }
  receive(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) })
  }
  close() {
    this.onclose?.()
  }
}

import { setImmediate } from 'node:timers/promises'
import { PlaybackQueue } from '../src/live/playbackQueue'
import { announcementPlatforms, audioPlatform, callingPoints, playAnnouncement, trainOptions } from '../src/live/playAnnouncement'
import type { Announcement, AnnouncementType } from '../src/live/types'
import type AmeyPhil from '../src/announcement-data/systems/stations/AmeyPhil'

const now = Date.parse(fixture.window.from)
function announcement(type: AnnouncementType, id: string = type): Announcement {
  const movement = snapshot().movements[0]
  return {
    version: 1,
    type: 'announcement',
    event_id: id,
    movement_id: movement.id,
    station: movement.station,
    announcement_type: type,
    created_at: fixture.window.from,
    expires_at: '2026-09-13T10:01:00Z',
    details: movement,
    affected_platforms: ['2'],
    previous_platform: null,
    new_platform: null,
  }
}
const preferences = {
  chime: '' as const,
  useLegacyTocNames: false,
  announceViaPoints: true,
  announceShortPlatformsAfterSplit: true,
  missingAudioMode: 'skip-service' as const,
}
const voice = {
  PLATFORMS: ['1', '2'],
  DEFAULT_CHIME: 'four',
  liveTrainsTiplocStationOverrides: () => null,
  processTocForLiveTrains: (name: string) => name,
  DelayCodeMapping: {},
} as unknown as AmeyPhil

test('audio options use feed data, London clocks, via CRS, loading and explicit unknown delays', () => {
  const movement = snapshot().movements[0]
  movement.departure.planned = '2026-09-12T23:00:00Z'
  movement.departure.unknown_delay = true
  const options = trainOptions(movement, voice, preferences, '2')
  assert.equal(options.hour, '00 - midnight')
  assert.equal(options.min, '00 - hundred-hours')
  assert.equal(options.isDelayed, true)
  assert.equal(options.terminatingStationCode, 'DST')
  assert.equal(options.vias[0].crsCode, 'JNC')
  assert.equal(options.callingAt[0].requestStop, true)
  assert.equal(options.serviceLoading, 'full and standing')
  assert.equal(audioPlatform('2a', voice), '2')
  assert.equal(audioPlatform('99', voice), null)
})

test('split data is optional and never causes associated-service requests', () => {
  const movement = snapshot().movements[0]
  movement.portions = [
    {
      rid: 'associate',
      category: 'VV',
      at: movement.calling_points[0],
      available: false,
      cancelled: false,
      headcode: null,
      mode: null,
      operator_code: null,
      operator_name: null,
      origin: null,
      destination: null,
      coach_count: null,
      position: null,
      calls: [],
    },
  ]
  assert.equal(callingPoints(movement, voice)[0].splitType, undefined)
  movement.portions[0] = { ...movement.portions[0], available: true, coach_count: 4, position: 'rear', calls: movement.calling_points }
  const split = callingPoints(movement, voice)[0]
  assert.equal(split.splitForm, 'rear.4')
  assert.equal(split.splitCallingPoints?.[0].crsCode, 'DST')
})

test('request stops come from whole activity codes, so a reversal or run round is not one', () => {
  const movement = snapshot().movements[0]
  movement.calling_points[0].activities = 'RM'
  assert.equal(callingPoints(movement, voice)[0].requestStop, false)
  movement.calling_points[0].activities = 'RR'
  assert.equal(callingPoints(movement, voice)[0].requestStop, false)
  movement.calling_points[0].activities = 'T R '
  assert.equal(callingPoints(movement, voice)[0].requestStop, true)
})

test('calling points stop at the destination even when that call is not a passenger stop', () => {
  const movement = snapshot().movements[0]
  const beyond = { ...movement.calling_points[0], id: 'beyond', tpl: 'BEYOND', crs: 'BYD', name: 'Beyond the terminus' }
  movement.calling_points[1].cancelled = true
  movement.calling_points.push(beyond)
  assert.deepEqual(
    callingPoints(movement, voice).map(point => point.crsCode),
    ['JNC'],
  )
})

test('the terminus is never a calling point as well as the destination', () => {
  const dividing = snapshot().movements[0]
  dividing.portions = [
    {
      rid: 'associate',
      category: 'VV',
      at: dividing.calling_points[1],
      available: true,
      cancelled: false,
      headcode: null,
      mode: null,
      operator_code: null,
      operator_name: null,
      origin: null,
      destination: null,
      coach_count: 4,
      position: 'rear',
      calls: dividing.calling_points,
    },
  ]
  assert.deepEqual(
    callingPoints(dividing, voice).map(point => point.crsCode),
    ['JNC'],
  )
  const retiploced = snapshot().movements[0]
  retiploced.destinations[0] = { ...retiploced.destinations[0], tpl: 'DESTINATION2' }
  assert.deepEqual(
    callingPoints(retiploced, voice).map(point => point.crsCode),
    ['JNC'],
  )
})

test('a portion that omits its division point contributes no onward calls', () => {
  const movement = snapshot().movements[0]
  movement.portions = [
    {
      rid: 'associate',
      category: 'VV',
      at: movement.calling_points[0],
      available: true,
      cancelled: false,
      headcode: null,
      mode: null,
      operator_code: null,
      operator_name: null,
      origin: null,
      destination: null,
      coach_count: 4,
      position: 'rear',
      calls: [movement.calling_points[1]],
    },
  ]
  const split = callingPoints(movement, voice)[0]
  assert.equal(split.splitType, 'splits')
  assert.deepEqual(split.splitCallingPoints, [])
})

test('a disrupted message with no measurable delay uses the generic delay announcement', async () => {
  const spoken: Parameters<AmeyPhil['playDisruptedTrainAnnouncement']>[0][] = []
  const system = {
    ...voice,
    playDisruptedTrainAnnouncement: async (options: Parameters<AmeyPhil['playDisruptedTrainAnnouncement']>[0]) => {
      spoken.push(options)
    },
  } as unknown as AmeyPhil
  const onTime = announcement('disrupted')
  onTime.details.departure.estimated = onTime.details.departure.planned
  await playAnnouncement(onTime, system, preferences, '2')
  assert.equal(spoken[0].disruptionType, 'delay')
  const late = announcement('disrupted')
  late.details.departure.estimated = '2026-09-13T10:20:00Z'
  await playAnnouncement(late, system, preferences, '2')
  assert.equal(spoken[1].disruptionType, 'delayedBy')
  assert.equal(spoken[1].delayTime, '15')
})

test('all six message types dispatch to the existing voice handlers without fetching railway data', async context => {
  context.mock.method(globalThis, 'fetch', () => {
    throw new Error('Unexpected train-data fetch')
  })
  const played: string[] = []
  const system = {
    ...voice,
    playNextTrainAnnouncement: async () => {
      played.push('next')
    },
    playStandingTrainAnnouncement: async () => {
      played.push('standing')
    },
    playTrainApproachingAnnouncement: async () => {
      played.push('approaching')
    },
    playDisruptedTrainAnnouncement: async () => {
      played.push('disrupted')
    },
    playFastTrainAnnouncement: async () => {
      played.push('passing')
    },
    playPlatformAlterationAnnouncement: async () => {
      played.push('platform_alteration')
    },
  } as unknown as AmeyPhil
  const types: AnnouncementType[] = ['next', 'approaching', 'standing', 'disrupted', 'passing', 'platform_alteration']
  for (const type of types) {
    await playAnnouncement({ ...announcement(type), previous_platform: '1', new_platform: '2' }, system, preferences, '2')
  }
  assert.deepEqual(played, types)
})

test('queue deduplicates, supersedes lower stages and checks expiry immediately before playback', async () => {
  let clock = now
  let release!: () => void
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
      if (message.event_id === 'busy')
        await new Promise<void>(resolve => {
          release = resolve
        })
    },
    () => clock,
  )
  queue.push(announcement('passing', 'busy'))
  queue.push(announcement('next'))
  queue.push(announcement('approaching'))
  queue.push(announcement('standing'))
  queue.push(announcement('standing'))
  release()
  await setImmediate()
  assert.deepEqual(played, ['busy', 'standing'])
  queue.push(announcement('passing', 'busy-again'))
  clock += 60_000
  queue.push(announcement('next', 'expired'))
  assert.ok(!played.includes('expired'))
})

test('a retraction discards queued audio and stops the announcement it names', async () => {
  let release!: () => void
  let signal!: AbortSignal
  let valid!: () => boolean
  const played: string[] = []
  const queue = new PlaybackQueue(
    async (message, currentSignal, currentValid) => {
      played.push(message.event_id)
      signal = currentSignal
      valid = currentValid
      if (message.event_id === 'busy')
        await new Promise<void>(resolve => {
          release = resolve
        })
    },
    () => now,
  )
  queue.push(announcement('next', 'busy'))
  queue.push(announcement('next', 'pending'))
  // Withdrawing the one still waiting leaves the one already speaking alone.
  queue.retract('pending')
  assert.equal(valid(), true)
  queue.retract('busy')
  assert.equal(valid(), false)
  assert.equal(signal.aborted, true)
  release()
  await setImmediate()
  assert.deepEqual(played, ['busy'])
  queue.reset()
  assert.equal(signal.aborted, true)
  queue.push(announcement('standing', 'after-reset'))
  await setImmediate()
  assert.deepEqual(played, ['busy', 'after-reset'])
})

function onPlatform(platform: string, id: string): Announcement {
  const message = announcement('next', id)
  const movementId = `R1/${platform}/${id}`
  message.movement_id = movementId
  message.details = { ...message.details, id: movementId, platform: { ...message.details.platform, number: platform } }
  return message
}

test('announcements for different platforms play at once, and one platform still plays in turn', async () => {
  const started: string[] = []
  const release: Record<string, () => void> = {}
  const queue = new PlaybackQueue(
    async message => {
      started.push(message.event_id)
      await new Promise<void>(resolve => {
        release[message.event_id] = resolve
      })
    },
    () => now,
    console.error,
    message => [message.details.platform.number || ''],
  )
  queue.push(onPlatform('1', 'one'))
  queue.push(onPlatform('2', 'two'))
  queue.push(onPlatform('1', 'one-again'))
  await setImmediate()
  assert.deepEqual(started, ['one', 'two'])
  release['one']()
  await setImmediate()
  assert.deepEqual(started, ['one', 'two', 'one-again'])
  queue.reset()
})

test('a fast train warning holds every platform it affects', async () => {
  const started: string[] = []
  let release!: () => void
  const queue = new PlaybackQueue(
    async message => {
      started.push(message.event_id)
      if (message.event_id === 'fast')
        await new Promise<void>(resolve => {
          release = resolve
        })
    },
    () => now,
    console.error,
    message => announcementPlatforms(message).map(platform => platform || ''),
  )
  const fast = announcement('passing', 'fast')
  fast.affected_platforms = ['1', '2']
  queue.push(fast)
  queue.push(onPlatform('1', 'waiting'))
  await setImmediate()
  assert.deepEqual(started, ['fast'])
  release()
  await setImmediate()
  assert.deepEqual(started, ['fast', 'waiting'])
  queue.reset()
})

test('one shared lane keeps the whole station in turn', async () => {
  const started: string[] = []
  let release!: () => void
  const queue = new PlaybackQueue(
    async message => {
      started.push(message.event_id)
      await new Promise<void>(resolve => {
        release = resolve
      })
    },
    () => now,
  )
  queue.push(onPlatform('1', 'one'))
  queue.push(onPlatform('2', 'two'))
  await setImmediate()
  assert.deepEqual(started, ['one'])
  release()
  await setImmediate()
  assert.deepEqual(started, ['one', 'two'])
  queue.reset()
})

test('a revision replaces the details of an announcement still waiting its turn', async () => {
  let release!: () => void
  const spoken: Announcement[] = []
  const queue = new PlaybackQueue(
    async message => {
      spoken.push(message)
      if (message.event_id === 'busy')
        await new Promise<void>(resolve => {
          release = resolve
        })
    },
    () => now,
  )
  queue.push(announcement('next', 'busy'))
  queue.push(announcement('next', 'waiting'))
  const movement = snapshot().movements[0]
  queue.revise('waiting', { ...movement, departure: { ...movement.departure, estimated: '2026-09-13T10:12:00Z' } })
  queue.revise('never-sent', movement)
  release()
  await setImmediate()
  assert.deepEqual(
    spoken.map(message => message.event_id),
    ['busy', 'waiting'],
  )
  assert.equal(spoken[1].details.departure.estimated, '2026-09-13T10:12:00Z')
  assert.equal(spoken[1].expires_at, announcement('next', 'waiting').expires_at)
})

test('withdrawing an announcement that was never queued is harmless', async () => {
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
    },
    () => now,
  )
  queue.retract('never-sent')
  queue.push(announcement('next', 'live'))
  await setImmediate()
  assert.deepEqual(played, ['live'])
})

test('playback that never settles does not wedge the queue for the rest of the session', async () => {
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
      if (message.event_id === 'stuck') await new Promise<void>(() => {})
    },
    () => now,
  )
  queue.push(announcement('passing', 'stuck'))
  await setImmediate()
  queue.reset()
  await setImmediate()
  queue.push(announcement('passing', 'after'))
  await setImmediate()
  assert.deepEqual(played, ['stuck', 'after'])
})

import { connectAnnouncements } from '../src/live/announcements'

test('one stream carries ready, triggers, withdrawals and heartbeats, and is never answered', async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const originalSocket = globalThis.WebSocket
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket
  context.after(() => {
    globalThis.WebSocket = originalSocket
  })
  FakeSocket.sockets = []
  let release!: () => void
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
      if (message.event_id === 'blocker')
        await new Promise<void>(resolve => {
          release = resolve
        })
    },
    () => now,
  )
  const stop = connectAnnouncements('ws://localhost:8080', 'TST', ['next'], queue, () => {})
  // The train list is no longer a second connection: the service withdraws what it sent.
  assert.equal(FakeSocket.sockets.length, 1)
  const events = FakeSocket.sockets[0]
  assert.equal(events.url.pathname, '/v1/announcements/live')
  assert.equal(events.url.searchParams.get('heartbeat'), '30')

  events.receive(announcement('next', 'before-ready'))
  events.receive({ version: 1, type: 'ready', station: fixture.station, healthy: false })
  events.receive(announcement('next', 'unhealthy'))
  assert.deepEqual(played, [])
  events.receive({ version: 1, type: 'ready', station: fixture.station, healthy: true })

  events.receive(announcement('next', 'blocker'))
  events.receive(announcement('next', 'doomed'))
  await setImmediate()
  assert.deepEqual(played, ['blocker'])
  events.receive({
    version: 1,
    type: 'retraction',
    event_id: 'doomed',
    movement_id: fixture.movements[0].id,
    announcement_type: 'next',
    reason: 'cancelled',
    created_at: fixture.window.from,
    affected_platforms: ['2'],
  })
  release()
  await setImmediate()
  assert.deepEqual(played, ['blocker'])

  // A heartbeat proves liveness and is never replied to.
  events.receive({ version: 1, type: 'heartbeat', sent_at: fixture.window.from })
  context.mock.timers.tick(70_000)
  assert.equal(events.sent.length, 0)
  stop()
})

test('a repeated ready re-baselines the queue, so a recovery never replays what it held', async context => {
  const originalSocket = globalThis.WebSocket
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket
  context.after(() => {
    globalThis.WebSocket = originalSocket
  })
  FakeSocket.sockets = []
  const statuses: string[] = []
  let release!: () => void
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
      if (message.event_id === 'blocker')
        await new Promise<void>(resolve => {
          release = resolve
        })
    },
    () => now,
  )
  const stop = connectAnnouncements('ws://localhost:8080', 'TST', ['next'], queue, status => statuses.push(status))
  const events = FakeSocket.sockets[0]
  events.receive({ version: 1, type: 'ready', station: fixture.station, healthy: true })
  events.receive(announcement('next', 'blocker'))
  events.receive(announcement('next', 'queued'))
  await setImmediate()
  assert.deepEqual(played, ['blocker'])
  events.receive({ version: 1, type: 'ready', station: fixture.station, healthy: false })
  release()
  await setImmediate()
  assert.deepEqual(played, ['blocker'])
  assert.deepEqual(statuses.slice(-2), ['live', 'recovering'])
  stop()
})

test('an expired item waiting behind audio is discarded and the queue stays bounded', async () => {
  let clock = now
  let release!: () => void
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
      if (message.event_id === 'busy')
        await new Promise<void>(resolve => {
          release = resolve
        })
    },
    () => clock,
  )
  queue.push(announcement('passing', 'busy'))
  for (let index = 0; index < 100; index++) queue.push(announcement('passing', `queued-${index}`))
  clock += 60_000
  release()
  await setImmediate()
  assert.deepEqual(played, ['busy'])
})

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { LiveTrainAnnouncements } from '../src/components/AmeyLiveTrainAnnouncements'

test('a saved WebSocket preference produces the same initial markup as the server', context => {
  const system = { ...voice, STATIONS: ['ECR'], ADDITIONAL_STATIONS: [] } as unknown as AmeyPhil
  const element = createElement(LiveTrainAnnouncements, {
    systems: { Test: system },
    supportedPlatforms: { '2': ['Test'] },
    nextTrainHandler: { Test: async () => {} },
    approachingTrainHandler: { Test: async () => {} },
    standingTrainHandler: { Test: async () => {} },
    disruptedTrainHandler: { Test: async () => {} },
  })
  const serverMarkup = renderToString(element)
  const storage = { getItem: (key: string) => (key === 'amey.live-trains.data-source' ? '"websocket"' : null) }
  for (const [name, value] of Object.entries({ window: { localStorage: storage }, localStorage: storage })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    context.after(() => {
      if (original) Object.defineProperty(globalThis, name, original)
      else Reflect.deleteProperty(globalThis, name)
    })
  }
  const firstClientMarkup = renderToString(element)
  assert.equal(firstClientMarkup, serverMarkup)
})
