import type { MissingAudioMode } from '../announcement-data/AnnouncementSystem'
import { comparePlatforms } from './platformZones'
import type { AnnouncementType } from './types'

/** What the announcement service needs to know to speak for this listener. It mirrors the
 *  preferences the page applies when it builds announcements itself. */
export interface StreamPreferences {
  chime: 'three' | 'four' | 'none' | ''
  useLegacyTocNames: boolean
  announceViaPoints: boolean
  announceShortPlatformsAfterSplit: boolean
  fastTrainApproaching: boolean
  daktronicsFanfare: boolean
  missingAudioMode: MissingAudioMode
}

export interface StationStream {
  /** The zones that have a voice, each in station order. They speak at the same time. */
  zones: string[][]
  /** The stream as an HLS playlist, which Safari plays itself. */
  playlistUrl: string
  /** The same audio as one endless MP3 response, for every other browser. */
  radioUrl: string
}

/**
 * The one stream that carries the whole station. Zones are separate loudspeakers, so the service
 * lets them speak over each other and mixes them, while the platforms within a zone take turns.
 * One stream means one player, which is what a browser keeps alive in a background tab.
 *
 * With `zones` null the whole station takes turns. That is also what a station with no known
 * platform list gets, because there is nothing to group.
 *
 * @param voices The voice chosen for each platform, as the service names voices. A platform
 *   with no voice is left out, and with no voiced platform at all there is no stream.
 */
export function stationStream(
  baseUrl: string,
  crs: string,
  zones: string[][] | null,
  voices: Record<string, string | null>,
  types: AnnouncementType[],
  preferences: StreamPreferences,
): StationStream | null {
  const base = new URL(baseUrl)
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Use an HTTP announcement service URL')
  if (types.length === 0) return null

  const voiced = (platforms: string[]) => platforms.filter(platform => voices[platform]).sort(comparePlatforms)
  const groups = (zones && zones.length > 0 ? zones.map(voiced) : [voiced(Object.keys(voices))])
    .filter(platforms => platforms.length > 0)
    .sort((a, b) => comparePlatforms(a[0], b[0]))
  if (groups.length === 0) return null

  const params = new URLSearchParams({ crs })
  for (const platforms of groups) params.append('zone', platforms.map(platform => `${platform}:${voices[platform]}`).join(','))
  params.set('type', [...types].sort().join(','))
  if (preferences.chime) params.set('chime', preferences.chime)
  params.set('vias', String(preferences.announceViaPoints))
  if (preferences.useLegacyTocNames) params.set('legacy_tocs', 'true')
  if (preferences.announceShortPlatformsAfterSplit) params.set('short_platforms_after_split', 'true')
  if (preferences.fastTrainApproaching) params.set('fast_train_approaching', 'true')
  if (preferences.daktronicsFanfare) params.set('fanfare', 'true')
  if (preferences.missingAudioMode !== 'skip-service') params.set('missing_audio', preferences.missingAudioMode)

  const endpoint = (file: string) => {
    const url = new URL(base)
    url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/streams/${file}`
    url.hash = ''
    url.search = params.toString()
    return url.toString()
  }

  return { zones: groups, playlistUrl: endpoint('live.m3u8'), radioUrl: endpoint('live.mp3') }
}

export type StreamStatus = 'connecting' | 'playing' | 'blocked' | 'reconnecting'

const RECONNECT_DELAY = 3000
const LATENCY_CHECK_INTERVAL = 10_000
/** An endless response has no live edge to return to, so every stall leaves the player that much
 *  further behind for good. Past this it skips to the newest audio it holds. */
const MAX_SECONDS_BEHIND = 4
const SECONDS_BEHIND_AFTER_SKIP = 1

/**
 * Plays the station's stream through an audio element until the returned function is called.
 *
 * Everything here is the browser's own playback of one URL: no script has to run for the audio
 * to continue, so a background tab whose timers are throttled keeps announcing. Safari plays the
 * playlist, which keeps itself at the live edge. Other browsers cannot play a playlist without a
 * script feeding them, so they take the endless MP3 response, the way they play internet radio.
 */
export function playStream(
  stream: StationStream,
  audio: HTMLAudioElement,
  onStatus: (status: StreamStatus) => void,
  log: (message: string) => void = () => {},
): () => void {
  const native = audio.canPlayType('application/vnd.apple.mpegurl') !== ''
  let stopped = false
  let retry: ReturnType<typeof setTimeout> | undefined

  const start = () => {
    audio.src = native ? stream.playlistUrl : stream.radioUrl
    audio.play().then(
      () => {},
      () => {
        // The browser wants a click before it plays anything. The element shows its controls for that.
        if (!stopped && audio.paused && !audio.error) onStatus('blocked')
      },
    )
  }
  const reconnect = (why: string) => {
    if (stopped || retry !== undefined) return
    onStatus('reconnecting')
    log(`The announcement stream ${why}, so it is starting again`)
    retry = setTimeout(() => {
      retry = undefined
      if (!stopped) start()
    }, RECONNECT_DELAY)
  }
  const onPlaying = () => onStatus('playing')
  const onWaiting = () => onStatus('connecting')
  const onError = () => reconnect('failed')
  // The service ends a response when the listener falls too far behind, or when it restarts.
  const onEnded = () => reconnect('ended')
  audio.addEventListener('playing', onPlaying)
  audio.addEventListener('waiting', onWaiting)
  audio.addEventListener('error', onError)
  audio.addEventListener('ended', onEnded)

  const latency = setInterval(() => {
    if (native || audio.paused || audio.buffered.length === 0) return
    const newest = audio.buffered.end(audio.buffered.length - 1)
    if (newest - audio.currentTime <= MAX_SECONDS_BEHIND) return
    log('The announcement stream fell behind, so it skipped to the present')
    audio.currentTime = newest - SECONDS_BEHIND_AFTER_SKIP
  }, LATENCY_CHECK_INTERVAL)

  onStatus('connecting')
  start()

  return () => {
    stopped = true
    clearTimeout(retry)
    clearInterval(latency)
    audio.removeEventListener('playing', onPlaying)
    audio.removeEventListener('waiting', onWaiting)
    audio.removeEventListener('error', onError)
    audio.removeEventListener('ended', onEnded)
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
}
