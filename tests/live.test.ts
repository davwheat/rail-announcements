import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reduceCIS, connectCIS } from '../src/live/cis'
import { streamUrl } from '../src/live/connection'
import fixture from './snapshot.json'
import type { Snapshot, Update } from '../src/live/types'

const snapshot = () => structuredClone(fixture) as Snapshot
const update = (values: Partial<Update> = {}): Update => ({
  version: 1,
  type: 'update',
  epoch: fixture.epoch,
  previous_revision: 1,
  revision: 2,
  window: fixture.window,
  upserts: [],
  removals: [],
  ordering: fixture.ordering,
  override_upserts: [],
  override_removals: [],
  ...values,
})

test('snapshot and complete upserts converge without losing server ordering or circular visits', () => {
  const initial = snapshot()
  const second = { ...initial.movements[0], id: 'R1/second', location_id: 'second' }
  const first = { ...initial.movements[0], operator_name: null }
  const result = reduceCIS(reduceCIS(null, initial), update({ upserts: [first, second], ordering: [second.id, first.id] }))!
  assert.equal(result.movements.size, 2)
  assert.equal(result.movements.get(first.id)?.operator_name, null)
  assert.deepEqual(result.ordering, [second.id, first.id])
  assert.equal(reduceCIS(result, update()), null)
  assert.equal(reduceCIS(result, update({ epoch: 'rebuilt', previous_revision: 2 })), null)
  const authoritative = reduceCIS(result, { ...initial, epoch: 'rebuilt', revision: 1 })!
  assert.equal(authoritative.movements.size, 1)
  assert.equal(authoritative.epoch, 'rebuilt')
})

test('override removals and departure removals survive authoritative resync', () => {
  const initial = snapshot()
  const override = {
    id: 'warning',
    kind: 'stand_clear' as const,
    station: initial.station,
    platform: '2',
    movement_id: null,
    activates_at: fixture.window.from,
    expires_at: fixture.window.to,
    reason: 'Passing train',
    source: 'TD',
  }
  const withWarning = reduceCIS(reduceCIS(null, initial), update({ override_upserts: [override] }))!
  assert.equal(withWarning.overrides.size, 1)
  const cleared = reduceCIS(
    withWarning,
    update({
      previous_revision: 2,
      revision: 3,
      removals: initial.ordering,
      ordering: [],
      override_removals: [{ id: override.id, reason: 'cleared' }],
    }),
  )!
  assert.equal(cleared.movements.size, 0)
  assert.equal(cleared.overrides.size, 0)
  assert.deepEqual(reduceCIS(cleared, { ...initial, revision: 3, movements: [], ordering: [] }), cleared)
})

test('WebSocket URLs default cleanly to the local service and support a remote prefix', () => {
  assert.equal(streamUrl('ws://localhost:8080', 'cis', 'TST').href, 'ws://localhost:8080/v1/cis/live?crs=TST')
  assert.equal(streamUrl('https://example.test/darwin/', 'announcements', 'TST').href, 'wss://example.test/darwin/v1/announcements/live?crs=TST')
  assert.throws(() => streamUrl('file:///tmp', 'cis', 'TST'))
})

class FakeSocket {
  static OPEN = 1
  static sockets: FakeSocket[] = []
  readyState = 1
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
    this.readyState = 3
    this.onclose?.()
  }
}

test('a revision gap requests one resync; reconnect and cleanup discard previous state', context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const originalSocket = globalThis.WebSocket
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket
  context.after(() => {
    globalThis.WebSocket = originalSocket
  })
  FakeSocket.sockets = []
  const views: unknown[] = []
  const stop = connectCIS(
    streamUrl('ws://localhost:8080', 'cis', 'TST'),
    state => views.push(state),
    () => {},
  )
  const socket = FakeSocket.sockets[0]
  socket.receive(snapshot())
  socket.receive(update({ previous_revision: 99 }))
  socket.receive(update({ previous_revision: 99 }))
  assert.equal(socket.sent.length, 1)
  assert.equal(views.at(-1), null)
  socket.receive(snapshot())
  context.mock.timers.tick(70_000)
  assert.equal(socket.sent.length, 2)
  socket.close()
  assert.equal(views.at(-1), null)
  context.mock.timers.tick(1000)
  assert.equal(FakeSocket.sockets.length, 2)
  FakeSocket.sockets[1].receive({ ...snapshot(), movements: [], ordering: [] })
  stop()
  context.mock.timers.tick(120_000)
  assert.equal(FakeSocket.sockets.length, 2)
  const count = views.length
  socket.receive(snapshot())
  assert.equal(views.length, count)
})

import { setImmediate } from 'node:timers/promises'
import { PlaybackQueue } from '../src/live/playbackQueue'
import { audioPlatform, callingPoints, playAnnouncement, trainOptions } from '../src/live/playAnnouncement'
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

test('departure, cancellation and reconnect invalidate queued audio and in-flight preparation', async () => {
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
  const state = reduceCIS(null, snapshot())!
  state.movements.clear()
  queue.updateState(state)
  assert.equal(valid(), false)
  queue.reset()
  assert.equal(signal.aborted, true)
  release()
  await setImmediate()
  assert.deepEqual(played, ['busy'])
  const cancelled = snapshot()
  cancelled.movements[0].cancelled = true
  queue.updateState(reduceCIS(null, cancelled)!)
  queue.push(announcement('standing'))
  await setImmediate()
  assert.deepEqual(played, ['busy'])
})

test('CIS judges an announcement created inside the board window, not only one created before it', async () => {
  const clock = Date.parse('2026-09-13T10:40:00Z')
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
    },
    () => clock,
  )
  const departed = snapshot()
  departed.movements[0].departure.actual = '2026-09-13T10:30:00Z'
  queue.updateState(reduceCIS(null, departed)!)
  queue.push({ ...announcement('next', 'mid-window'), created_at: '2026-09-13T10:37:00Z', expires_at: '2026-09-13T10:45:00Z' })
  await setImmediate()
  assert.deepEqual(played, [])
})

test('a frame that arrived first cannot rule out a movement it never saw', async () => {
  let clock = now
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
    },
    () => clock,
  )
  const unaware = reduceCIS(null, snapshot())!
  unaware.movements.clear()
  queue.updateState(unaware)
  clock += 1000
  queue.push(announcement('next', 'ahead-of-cis'))
  await setImmediate()
  assert.deepEqual(played, ['ahead-of-cis'])
})

test('a stand clear validates a passing announcement by platform when it carries no movement id', async () => {
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
    },
    () => now,
  )
  const warned = snapshot()
  warned.overrides = [
    {
      id: 'warning',
      kind: 'stand_clear',
      station: warned.station,
      platform: '2',
      movement_id: null,
      activates_at: fixture.window.from,
      expires_at: fixture.window.to,
      reason: 'Passing train',
      source: 'TD',
    },
  ]
  queue.updateState(reduceCIS(null, warned)!)
  queue.push(announcement('passing', 'fast'))
  await setImmediate()
  queue.updateState(reduceCIS(null, snapshot())!)
  queue.push(announcement('passing', 'unwarned'))
  await setImmediate()
  assert.deepEqual(played, ['fast'])
})

test('a platform alteration survives CIS still holding the old platform', async () => {
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
    },
    () => now,
  )
  queue.updateState(reduceCIS(null, snapshot())!)
  const moved = announcement('platform_alteration', 'moved')
  moved.details = { ...moved.details, platform: { ...moved.details.platform, number: '1' } }
  moved.previous_platform = '2'
  moved.new_platform = '1'
  queue.push(moved)
  await setImmediate()
  assert.deepEqual(played, ['moved'])
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

test('announcement connection waits for ready, suppresses unhealthy delivery, and never resyncs announcements', async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const originalSocket = globalThis.WebSocket
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket
  context.after(() => {
    globalThis.WebSocket = originalSocket
  })
  FakeSocket.sockets = []
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
    },
    () => now,
  )
  const stop = connectAnnouncements('ws://localhost:8080', 'TST', ['next'], queue, () => {})
  const cis = FakeSocket.sockets[0]
  cis.receive(snapshot())
  const events = FakeSocket.sockets[1]
  events.receive(announcement('next', 'before-ready'))
  events.receive({ version: 1, type: 'ready', station: fixture.station, healthy: false })
  events.receive(announcement('next', 'unhealthy'))
  assert.deepEqual(played, [])
  events.receive({ version: 1, type: 'ready', station: fixture.station, healthy: true })
  events.receive(announcement('next', 'new-trigger'))
  await setImmediate()
  assert.deepEqual(played, ['new-trigger'])
  context.mock.timers.tick(70_000)
  assert.equal(events.sent.length, 0)
  assert.equal(cis.sent.length, 1)
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
