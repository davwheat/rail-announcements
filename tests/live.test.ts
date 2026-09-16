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
import AnnouncementSystem, { type MissingAudioMode } from '../src/announcement-data/AnnouncementSystem'
import type { Announcement, AnnouncementType, Portion } from '../src/live/types'
import type AmeyPhil from '../src/announcement-data/systems/stations/AmeyPhil'
import type {
  ILiveDisruptedTrainAnnouncementOptions,
  ILiveTrainApproachingAnnouncementOptions,
} from '../src/announcement-data/systems/stations/AmeyPhil'

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
  fastTrainApproaching: true,
  daktronicsFanfare: false,
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

test('a dividing portion is an extra destination, not the one the train is announced to', () => {
  const movement = snapshot().movements[0]
  const portion = {
    ...movement.destinations[0],
    tpl: 'GTWK',
    crs: 'GTW',
    name: 'Gatwick Airport',
    via: null,
    assoc_rid: 'associate',
    assoc_cat: 'VV',
  }
  // The feed leads with the service's own destination; a client must not depend on that.
  movement.destinations = [portion, movement.destinations[0]]
  const options = trainOptions(movement, voice, preferences, '2')
  assert.equal(options.terminatingStationCode, 'DST')
  assert.equal(options.vias[0].crsCode, 'JNC')
  assert.deepEqual(
    callingPoints(movement, voice).map(point => point.crsCode),
    ['JNC'],
  )
})

/** An associated service the feed knows, so its endpoint is a station the train really reaches. */
function runningPortion(movement: Movement, rid: string, category: string): Portion {
  return {
    rid,
    category,
    at: movement.calling_points[0],
    available: true,
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
  }
}

test('a disrupted service that divides is announced to every destination it reaches', async () => {
  const spoken: ILiveDisruptedTrainAnnouncementOptions[] = []
  const system = {
    ...voice,
    playDisruptedTrainAnnouncement: async (options: ILiveDisruptedTrainAnnouncementOptions) => {
      spoken.push(options)
    },
  } as unknown as AmeyPhil
  const message = announcement('disrupted')
  message.details.portions.push(runningPortion(message.details, 'associate', 'VV'))
  message.details.destinations.push({
    ...message.details.destinations[0],
    tpl: 'GTWK',
    crs: 'GTW',
    name: 'Gatwick Airport',
    via: { text: 'via Redhill', locs: ['RDH'] },
    assoc_rid: 'associate',
    assoc_cat: 'VV',
  })
  await playAnnouncement(message, system, preferences, '2')
  assert.deepEqual(spoken[0].terminatingStationCode, ['DST', 'GTW'])
  assert.deepEqual(
    spoken[0].vias.map(vias => vias.map(point => point.crsCode)),
    [['JNC'], ['RDH']],
  )
})

test('a false destination is the station every announcement names', async () => {
  const spoken: ILiveTrainApproachingAnnouncementOptions[] = []
  const system = {
    ...voice,
    playTrainApproachingAnnouncement: async (options: ILiveTrainApproachingAnnouncementOptions) => {
      spoken.push(options)
    },
  } as unknown as AmeyPhil
  const message = announcement('approaching')
  message.details.false_destination = { tpl: 'FALSE', crs: 'FLS', name: 'False Destination' }
  assert.equal(trainOptions(message.details, voice, preferences, '2').terminatingStationCode, 'FLS')
  await playAnnouncement(message, system, preferences, '2')
  assert.deepEqual(spoken[0].terminatingStationCode, ['FLS'])
  // The real destination still supplies the via points; only the station named is false.
  assert.deepEqual(
    spoken[0].vias.map(vias => vias.map(point => point.crsCode)),
    [['JNC']],
  )
})

test('a portion the feed cannot describe is not announced as an endpoint', async () => {
  const spoken: ILiveTrainApproachingAnnouncementOptions[] = []
  const system = {
    ...voice,
    playTrainApproachingAnnouncement: async (options: ILiveTrainApproachingAnnouncementOptions) => {
      spoken.push(options)
    },
  } as unknown as AmeyPhil
  const message = announcement('approaching')
  message.details.portions.push({ ...runningPortion(message.details, 'unavailable', 'VV'), available: false })
  // An unavailable associate reaches no station the feed can name, and has no audio to announce.
  message.details.destinations.push({ tpl: '', crs: null, name: null, via: null, assoc_rid: 'unavailable', assoc_cat: 'VV' })
  await playAnnouncement(message, system, preferences, '2')
  assert.deepEqual(spoken[0].terminatingStationCode, ['DST'])
})

test('a train that was joined is announced as the service from both of its origins', async () => {
  const spoken: ILiveTrainApproachingAnnouncementOptions[] = []
  const system = {
    ...voice,
    playTrainApproachingAnnouncement: async (options: ILiveTrainApproachingAnnouncementOptions) => {
      spoken.push(options)
    },
  } as unknown as AmeyPhil
  const message = announcement('approaching')
  message.details.portions.push(runningPortion(message.details, 'joiner', 'JJ'))
  message.details.origins.push({ tpl: 'HORSHAM', crs: 'HRH', name: 'Horsham', via: null, assoc_rid: 'joiner', assoc_cat: 'JJ' })
  await playAnnouncement(message, system, preferences, '2')
  assert.deepEqual(spoken[0].originStationCode, ['ORG', 'HRH'])
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

test('a disruption reason reaches the voice as finished clip ids, whichever form the mapping holds', async () => {
  const spoken: Parameters<AmeyPhil['playDisruptedTrainAnnouncement']>[0][] = []
  const emergencyServices = ['disruption-reason.e.emergency services attending an incident adjacent', 'disruption-reason.e.to the railway line']
  const system = {
    ...voice,
    DelayCodeMapping: {
      '100': { e: 'disruption-reason.e.a broken down train', m: null, text: '' },
      '157': { e: emergencyServices, m: null, text: '' },
    },
    playDisruptedTrainAnnouncement: async (options: Parameters<AmeyPhil['playDisruptedTrainAnnouncement']>[0]) => {
      spoken.push(options)
    },
  } as unknown as AmeyPhil

  const withReason = async (code: string | null) => {
    const message = announcement('disrupted', `disrupted-${code}`)
    message.details.delay_reason = { code, text: null }
    await playAnnouncement(message, system, preferences, '2')
  }

  await withReason('100')
  assert.deepEqual(spoken[0].disruptionReason, ['disruption-reason.e.a broken down train'])
  await withReason('157')
  assert.deepEqual(spoken[1].disruptionReason, emergencyServices)
  await withReason('999')
  assert.equal(spoken[2].disruptionReason, '')
  await withReason(null)
  assert.equal(spoken[3].disruptionReason, '')
})

test('a reason the voice cannot say costs the reason, not the whole disruption announcement', async () => {
  const spoken: Parameters<AmeyPhil['playDisruptedTrainAnnouncement']>[0][] = []
  const logs: string[] = []
  const missingClip = 'disruption-reason.e.a temporary speed restriction'
  const system = {
    ...voice,
    DelayCodeMapping: { '182': { e: missingClip, m: null, text: '' }, '100': { e: 'disruption-reason.e.a fire', m: null, text: '' } },
    playDisruptedTrainAnnouncement: async (options: Parameters<AmeyPhil['playDisruptedTrainAnnouncement']>[0]) => {
      spoken.push(options)
      if (options.disruptionReason.includes(missingClip)) throw new Error(`Crunker: Could not fetch audio file (file: "${missingClip}")`)
    },
  } as unknown as AmeyPhil

  const disrupted = (code: string) => {
    const message = announcement('disrupted', `disrupted-${code}`)
    message.details.delay_reason = { code, text: null }
    return message
  }

  await playAnnouncement(disrupted('182'), system, preferences, '2', message => logs.push(message))
  assert.deepEqual(
    spoken.map(options => options.disruptionReason),
    [[missingClip], ''],
  )
  assert.equal(logs.length, 1)
  assert.match(logs[0], /without its disruption reason/)

  // A failure with nothing left to drop is the caller's to hear about.
  const broken = {
    ...system,
    playDisruptedTrainAnnouncement: async () => {
      throw new Error('Audio device unavailable')
    },
  } as unknown as AmeyPhil
  await assert.rejects(() => playAnnouncement(disrupted('100'), broken, preferences, '2'), /Audio device unavailable/)
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

test('passing warnings take their spoken words, fanfare and missing-audio handling from the listener preferences', async () => {
  const spoken: Parameters<AmeyPhil['playFastTrainAnnouncement']>[0][] = []
  const system = {
    ...voice,
    playFastTrainAnnouncement: async (options: Parameters<AmeyPhil['playFastTrainAnnouncement']>[0]) => {
      spoken.push(options)
    },
  } as unknown as AmeyPhil
  await playAnnouncement(announcement('passing'), system, preferences, '2')
  assert.equal(spoken[0].fastTrainApproaching, true)
  assert.equal(spoken[0].daktronicsFanfare, false)
  assert.equal(spoken[0].missingAudioMode, 'skip-service')
  const changed = { ...preferences, fastTrainApproaching: false, daktronicsFanfare: true, missingAudioMode: 'play-silence' as const }
  await playAnnouncement(announcement('passing'), system, changed, '2')
  assert.equal(spoken[1].fastTrainApproaching, false)
  assert.equal(spoken[1].daktronicsFanfare, true)
  assert.equal(spoken[1].missingAudioMode, 'play-silence')
})

test('every announcement type carries the missing-audio preference down to playback', async () => {
  const modes: (MissingAudioMode | undefined)[] = []
  const record = async (options: { missingAudioMode?: MissingAudioMode }) => {
    modes.push(options.missingAudioMode)
  }
  const system = {
    ...voice,
    playNextTrainAnnouncement: record,
    playStandingTrainAnnouncement: record,
    playTrainApproachingAnnouncement: record,
    playDisruptedTrainAnnouncement: record,
    playFastTrainAnnouncement: record,
    playPlatformAlterationAnnouncement: record,
  } as unknown as AmeyPhil
  const types: AnnouncementType[] = ['next', 'approaching', 'standing', 'disrupted', 'passing', 'platform_alteration']
  for (const type of types) {
    const message = { ...announcement(type), previous_platform: '1', new_platform: '2' }
    await playAnnouncement(message, system, { ...preferences, missingAudioMode: 'repeat-last-station' }, '2')
  }
  assert.deepEqual(
    modes,
    types.map(() => 'repeat-last-station'),
  )
})

class TestSystem extends AnnouncementSystem {
  readonly NAME = 'Test'
  readonly ID = 'TEST_V1'
  readonly FILE_PREFIX = 'test'
  readonly SYSTEM_TYPE = 'station' as const
}

/** Stands in for the browser's Crunker singleton: a clip the CDN does not hold rejects, as a
 *  missing file now does, and concatAudio hands back the clips it was given so they can be read. */
function useFakeCrunker(missing: string[]): () => void {
  const previous = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = {
    __crunker: {
      context: { createBuffer: (_channels: number, length: number) => ({ silence: length }) },
      fetchAudio: async (...uris: string[]) =>
        uris.map(uri => {
          if (missing.some(id => uri.endsWith(`${id.replace(/\./g, '/')}.mp3`))) {
            throw new Error(`Crunker: Could not fetch audio file; the server responded 404. (file: "${uri}")`)
          }
          return { clip: uri }
        }),
      concatAudio: (buffers: unknown[]) => buffers,
    },
  }
  return () => {
    ;(globalThis as { window?: unknown }).window = previous
  }
}

test('a missing clip is handled by the selected mode rather than always failing the announcement', async () => {
  const restore = useFakeCrunker(['station.m.CMS'])
  try {
    const system = new TestSystem()
    const files = [{ id: 'station.m.AAA' }, { id: 'station.m.CMS' }, { id: 'w.fast train approaching' }]
    const clips = async (mode: MissingAudioMode) =>
      ((await system.concatSoundClips(files, mode)) as unknown as { clip: string }[]).map(b => b.clip)

    await assert.rejects(() => system.concatSoundClips(files, 'skip-service'), /station\/m\/CMS\.mp3/)
    assert.deepEqual(await clips('play-silence'), [
      system.generateAudioFileUrl('station.m.AAA'),
      system.generateAudioFileUrl('w.fast train approaching'),
    ])
    assert.deepEqual(await clips('repeat-last-station'), [
      system.generateAudioFileUrl('station.m.AAA'),
      system.generateAudioFileUrl('station.m.AAA'),
      system.generateAudioFileUrl('w.fast train approaching'),
    ])
    assert.deepEqual(await clips('repeat-last'), [
      system.generateAudioFileUrl('station.m.AAA'),
      system.generateAudioFileUrl('station.m.AAA'),
      system.generateAudioFileUrl('w.fast train approaching'),
    ])
  } finally {
    restore()
  }
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

test('a disruption is not announced once the train has been announced as approaching', async () => {
  const played: string[] = []
  const queue = new PlaybackQueue(
    async message => {
      played.push(message.event_id)
    },
    () => now,
  )
  queue.push(announcement('disrupted', 'delayed'))
  queue.push(announcement('approaching'))
  await setImmediate()
  // Both the one waiting its turn behind the approaching train and the one that arrives later.
  queue.push(announcement('disrupted', 'delayed-again'))
  queue.push(announcement('standing'))
  queue.push(announcement('disrupted', 'cancelled'))
  await setImmediate()
  assert.deepEqual(played, ['delayed', 'approaching', 'standing'])
  // A new session speaks for trains afresh.
  queue.reset()
  queue.push(announcement('disrupted', 'delayed-after-reset'))
  await setImmediate()
  assert.deepEqual(played, ['delayed', 'approaching', 'standing', 'delayed-after-reset'])
})

test('a retraction discards queued audio but lets a speaking announcement finish', async () => {
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
  // Withdrawing the one already speaking leaves it alone too: it is heard out rather than cut off.
  queue.retract('busy')
  assert.equal(valid(), true)
  assert.equal(signal.aborted, false)
  // A reset still stops it, because the session it belongs to has gone.
  queue.reset()
  assert.equal(valid(), false)
  assert.equal(signal.aborted, true)
  release()
  await setImmediate()
  assert.deepEqual(played, ['busy'])
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

function speaking(): { queue: PlaybackQueue; played: string[]; release: () => void; signalOf: (id: string) => AbortSignal } {
  const played: string[] = []
  const signals = new Map<string, AbortSignal>()
  let release!: () => void
  const held = new Promise<void>(resolve => {
    release = resolve
  })
  const queue = new PlaybackQueue(
    async (message, signal) => {
      played.push(message.event_id)
      signals.set(message.event_id, signal)
      if (message.event_id.startsWith('held')) await held
    },
    () => now,
  )
  return { queue, played, release: () => release(), signalOf: id => signals.get(id)! }
}

function warning(platforms: string[], id: string): Announcement {
  const message = announcement('passing', id)
  const movementId = `fast/${id}`
  message.movement_id = movementId
  message.details = { ...message.details, id: movementId }
  message.affected_platforms = platforms
  return message
}

test('a platform alteration cuts short the announcement speaking for that train', async () => {
  const { queue, played, signalOf } = speaking()
  queue.push(announcement('standing', 'held-standing'))
  await setImmediate()
  assert.deepEqual(played, ['held-standing'])

  const alteration = announcement('platform_alteration', 'moved')
  alteration.previous_platform = '2'
  alteration.new_platform = '1'
  queue.push(alteration)
  // The platform being spoken is now the wrong one, so finishing it would send the platform there.
  assert.equal(signalOf('held-standing').aborted, true)
  await setImmediate()
  assert.deepEqual(played, ['held-standing', 'moved'])
})

test('a platform alteration for another train waits its turn like anything else', async () => {
  const { queue, played, release, signalOf } = speaking()
  queue.push(onPlatform('2', 'held-standing'))
  await setImmediate()

  const alteration = onPlatform('3', 'moved')
  alteration.announcement_type = 'platform_alteration'
  alteration.previous_platform = '2'
  alteration.new_platform = '3'
  queue.push(alteration)
  assert.equal(signalOf('held-standing').aborted, false)
  assert.deepEqual(played, ['held-standing'])
  release()
  await setImmediate()
  assert.deepEqual(played, ['held-standing', 'moved'])
})

test('a fast train warning cuts short the disruption information its platform is reading', async () => {
  const { queue, played, signalOf } = speaking()
  const disruption = onPlatform('2', 'held-disruption')
  disruption.announcement_type = 'disrupted'
  queue.push(disruption)
  await setImmediate()
  assert.deepEqual(played, ['held-disruption'])

  queue.push(warning(['2', '3'], 'fast'))
  // Standing back from a train seconds away outranks the delay the platform is hearing about.
  assert.equal(signalOf('held-disruption').aborted, true)
  await setImmediate()
  assert.deepEqual(played, ['held-disruption', 'fast'])
})

test('a fast train warning leaves a platform reading anything else, or reading about another platform, alone', async () => {
  const elsewhere = speaking()
  const other = onPlatform('4', 'held-disruption')
  other.announcement_type = 'disrupted'
  elsewhere.queue.push(other)
  await setImmediate()
  elsewhere.queue.push(warning(['2'], 'fast'))
  assert.equal(elsewhere.signalOf('held-disruption').aborted, false)
  elsewhere.release()
  await setImmediate()
  assert.deepEqual(elsewhere.played, ['held-disruption', 'fast'])

  const standing = speaking()
  standing.queue.push(onPlatform('2', 'held-standing'))
  await setImmediate()
  standing.queue.push(warning(['2'], 'fast'))
  assert.equal(standing.signalOf('held-standing').aborted, false)
  standing.release()
  await setImmediate()
  assert.deepEqual(standing.played, ['held-standing', 'fast'])
})

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

import { fetchStationPlatforms, platformsUrl } from '../src/live/stationPlatforms'

test('platform list URLs follow the live service host over HTTP', () => {
  assert.equal(platformsUrl('ws://localhost:8080', 'TST').href, 'http://localhost:8080/v1/platforms?crs=TST')
  assert.equal(platformsUrl('wss://example.test/darwin/', 'TST').href, 'https://example.test/darwin/v1/platforms?crs=TST')
  assert.equal(platformsUrl('https://example.test', 'TST').href, 'https://example.test/v1/platforms?crs=TST')
  assert.throws(() => platformsUrl('file:///tmp', 'TST'))
})

/** Every answer that isn't a platform list means "unknown", so a caller narrows nothing.
 *  Treating any of these as "this station has no platforms" would hide every platform. */
test('a platform list is only reported when the service actually describes one', async context => {
  const responses: Record<string, { status: number; body?: unknown }> = {
    ready: { status: 200, body: { crs: 'TST', name: 'Test', tiplocs: ['TEST'], stanox: ['123'], platforms: ['1', '2'] } },
    shared: { status: 200, body: { crs: 'TST', tiplocs: [], stanox: [], platforms: ['1'], shared_with: ['XTS'] } },
    empty: { status: 200, body: { crs: 'TST', tiplocs: [], stanox: [], platforms: [] } },
    missing: { status: 404 },
    warming: { status: 503 },
  }
  const original = globalThis.fetch
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async (url: URL) => {
      const { status, body } = responses[url.searchParams.get('crs')!]
      return { ok: status === 200, status, json: async () => body }
    },
  })
  context.after(() => Object.defineProperty(globalThis, 'fetch', { configurable: true, value: original }))

  const ready = await fetchStationPlatforms('wss://example.test', 'ready')
  assert.deepEqual(ready, { status: 'ready', platforms: ['1', '2'], name: 'Test', sharedWith: [] })

  const shared = await fetchStationPlatforms('wss://example.test', 'shared')
  assert.deepEqual(shared, { status: 'ready', platforms: ['1'], name: undefined, sharedWith: ['XTS'] })

  for (const crs of ['empty', 'missing', 'warming']) {
    const result = await fetchStationPlatforms('wss://example.test', crs)
    assert.equal(result.status, 'unavailable', `${crs} must not be read as a platform list`)
  }
})

import { comparePlatforms, isPlatformZoneStore, moveToZone, resolveZones, zoneKey, zoneLanes, zonesToSave } from '../src/live/platformZones'

test('every platform starts in a zone of its own, in station order', () => {
  assert.deepEqual(resolveZones(undefined, ['1', '2', '10']), [['1'], ['2'], ['10']])
  assert.deepEqual(resolveZones([], ['2', '1']), [['1'], ['2']])
  assert.deepEqual([...['10', '2', '1', '10a', 'a']].sort(comparePlatforms), ['1', '2', '10', '10a', 'a'])
})

test('saved merges survive a station whose platform list has moved on', () => {
  // A platform the station no longer has drops out; one the save never mentioned
  // still gets its own zone, so a changed list never leaves a platform unqueued.
  assert.deepEqual(resolveZones([['1', '2', '99']], ['1', '2', '3']), [['1', '2'], ['3']])
  assert.deepEqual(resolveZones([['3']], ['1', '2', '3']), [['1'], ['2'], ['3']])
  // A platform named in two saved zones belongs to the first, never to both.
  assert.deepEqual(
    resolveZones(
      [
        ['1', '2'],
        ['2', '3'],
      ],
      ['1', '2', '3'],
    ),
    [['1', '2'], ['3']],
  )
})

test('platforms move between zones, and an emptied zone disappears', () => {
  const zones = [['1'], ['2'], ['3']]

  assert.deepEqual(moveToZone(zones, '2', 0, 1), [['1', '2'], ['3']])
  // Leaving a shared zone for one of its own.
  assert.deepEqual(moveToZone([['1', '2'], ['3']], '2', null), [['1'], ['3'], ['2']])
  // The zone a platform leaves is dropped rather than left empty behind it.
  assert.deepEqual(moveToZone([['1'], ['2']], '2', 0, 1), [['1', '2']])
  // Only merges are worth saving; a zone of one is what every platform already gets.
  assert.deepEqual(zonesToSave([['1', '2'], ['3']]), [['1', '2']])
})

/** A platform has to stay where it was dropped. Re-sorting it into place reads as the
 *  chip jumping the instant the drag is released, which is the jank this avoids. */
test('a dropped platform lands at the position it was dropped, not in sorted order', () => {
  assert.deepEqual(moveToZone([['2', '3'], ['1']], '1', 0, 0), [['1', '2', '3']])
  assert.deepEqual(moveToZone([['2', '3'], ['1']], '1', 0, 1), [['2', '1', '3']])
  assert.deepEqual(moveToZone([['2', '3'], ['1']], '1', 0, 99), [['2', '3', '1']])
  // Reordering within one zone is a remove and an insert at the post-removal index.
  assert.deepEqual(moveToZone([['1', '2', '3']], '3', 0, 0), [['3', '1', '2']])
  // A target that does not resolve must not swallow the platform.
  assert.deepEqual(moveToZone([['1', '2']], '2', -1), [['1'], ['2']])
  // Saving and resolving again must not quietly sort those members back.
  assert.deepEqual(resolveZones([['2', '1', '3']], ['1', '2', '3']), [['2', '1', '3']])
})

/** A merge that moved the surviving row would shift every row after it, which is the other
 *  half of the jank: the zone is named and placed by its lowest platform either way. */
test('a merged zone keeps the place of the earlier of the two', () => {
  assert.equal(zoneKey(['3', '1', '2']), '1')
  // Platform 1 joins the zone holding 3: the survivor sits where 1 already was.
  assert.deepEqual(resolveZones([['3', '1']], ['1', '2', '3', '4']), [['3', '1'], ['2'], ['4']])
  // ...and a merge between later platforms leaves the earlier ones untouched.
  assert.deepEqual(resolveZones([['3', '4']], ['1', '2', '3', '4']), [['1'], ['2'], ['3', '4']])
})

test('platforms sharing a zone share a queue lane, and a lone platform keeps its own', () => {
  const lanes = zoneLanes([['1', '2'], ['3']])

  assert.equal(lanes.get('1'), lanes.get('2'))
  assert.notEqual(lanes.get('3'), lanes.get('1'))
  // The default must reproduce what the station did before zones existed: the lane
  // of an unmerged platform is the platform itself.
  assert.equal(zoneLanes([['3']]).get('3'), '3')
})

test('a stored zone configuration is rejected unless it is a map of platform groups', () => {
  assert.equal(isPlatformZoneStore({ ECR: [['1', '2']] }), true)
  assert.equal(isPlatformZoneStore({}), true)
  for (const bad of [null, [], 'ECR', { ECR: '1' }, { ECR: ['1'] }, { ECR: [[1]] }]) {
    assert.equal(isPlatformZoneStore(bad), false, `${JSON.stringify(bad)} must be rejected`)
  }
})

/** Zones are only a lane mapping, so the queue keeps every rule it already had. */
test('one zone announces in turn while a separate zone announces at the same time', async () => {
  const lanes = zoneLanes([['1', '2'], ['3']])
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
    message => [...new Set(announcementPlatforms(message).map(platform => (platform ? (lanes.get(platform) ?? platform) : '')))],
  )

  queue.push(onPlatform('1', 'one'))
  queue.push(onPlatform('2', 'two'))
  queue.push(onPlatform('3', 'three'))
  await setImmediate()
  // Platform 2 shares a zone with platform 1 and waits; platform 3 does not.
  assert.deepEqual(started, ['one', 'three'])

  release['one']()
  await setImmediate()
  assert.deepEqual(started, ['one', 'three', 'two'])
  queue.reset()
})

test('a warning naming two platforms of one zone holds that zone once', async () => {
  const lanes = zoneLanes([['1', '2']])
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
    message => [...new Set(announcementPlatforms(message).map(platform => (platform ? (lanes.get(platform) ?? platform) : '')))],
  )

  const fast = announcement('passing', 'fast')
  fast.affected_platforms = ['1', '2']
  queue.push(fast)
  queue.push(onPlatform('2', 'waiting'))
  await setImmediate()
  assert.deepEqual(started, ['fast'])

  release()
  await setImmediate()
  assert.deepEqual(started, ['fast', 'waiting'])
  queue.reset()
})
