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
  /** The zones that have a voice, each in station order. They speak at the same time. Empty when
   *  the stream is the whole station taking turns in one voice. */
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
  // Without zones the list is every platform a voice can say, which is some eighty entries. When
  // they all share one voice, naming the voice says the same thing: the service takes a stream
  // with no zones to be the whole station.
  const everyVoice = Object.values(voices)
  const wholeStationVoice = groups.length === 1 && !(zones && zones.length > 0) && everyVoice.every(voice => voice === everyVoice[0])
  if (wholeStationVoice) params.set('voice', everyVoice[0]!)
  else for (const platforms of groups) params.append('zone', platforms.map(platform => `${platform}:${voices[platform]}`).join(','))
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

  return { zones: wholeStationVoice ? [] : groups, playlistUrl: endpoint('live.m3u8'), radioUrl: endpoint('live.mp3') }
}

export type StreamStatus = 'connecting' | 'playing' | 'blocked' | 'reconnecting'

const RECONNECT_DELAY = 3000
/** MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED, spelled out because the tests run where MediaError does not exist. */
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4
const LATENCY_CHECK_INTERVAL = 10_000
/** An endless response has no live edge to return to, so every stall or pause leaves the player
 *  that much further behind for good. Past this it starts the stream again. That drops the audio in
 *  between, which can be part of an announcement, so a brief stall is not enough. */
const MAX_SECONDS_BEHIND = 10
/** The service opens each MP3 response with three seconds of the recent past. */
const SECONDS_BEHIND_AT_START = 3

/**
 * Plays the station's stream through an audio element until the returned function is called.
 *
 * Everything here is the browser's own playback of one URL: no script has to run for the audio
 * to continue, so a background tab whose timers are throttled keeps announcing. A browser that
 * plays HLS itself, which is Safari, takes the playlist, which keeps itself at the live edge.
 * Other browsers cannot play a playlist without a script feeding them, so they take the endless
 * MP3 response, the way they play internet radio.
 */
export function playStream(
  stream: StationStream,
  audio: HTMLAudioElement,
  onStatus: (status: StreamStatus) => void,
  log: (message: string) => void = () => {},
): () => void {
  // A browser's claim to play HLS is only a hint. Firefox can answer "maybe" and then find it has
  // no decoder, so the playlist is tried first where it is claimed and dropped for good if the
  // browser then refuses it. The MP3 response plays everywhere.
  let playlist = audio.canPlayType('application/vnd.apple.mpegurl') !== ''
  let stopped = false
  let retry: ReturnType<typeof setTimeout> | undefined
  let respondedAt: number | undefined

  const start = () => {
    respondedAt = undefined
    audio.src = playlist ? stream.playlistUrl : stream.radioUrl
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
  const onError = () => {
    if (playlist && audio.error?.code === MEDIA_ERR_SRC_NOT_SUPPORTED) {
      playlist = false
      log('This browser cannot play the HLS playlist after all, so it is playing the MP3 stream')
      if (!stopped) start()
      return
    }
    reconnect('failed')
  }
  // The service ends a response when the listener falls too far behind, or when it restarts.
  const onEnded = () => reconnect('ended')
  const onLoadedMetadata = () => {
    respondedAt = Date.now()
  }
  // The service sends audio as it is made, so a player that never stalled or paused stays as far
  // behind as the response started. Everything past that is lag. The buffered range cannot show it:
  // Chrome reads only a couple of seconds ahead and leaves the rest of a backlog in the network
  // buffers, where no seek reaches it. A new response is the only way back to the present.
  //
  // A playlist needs none of this. The service keeps only its last few segments, so a player cannot
  // fall further behind than those.
  const catchUp = () => {
    if (playlist || stopped || audio.paused || respondedAt === undefined) return
    const behind = SECONDS_BEHIND_AT_START + (Date.now() - respondedAt) / 1000 - audio.currentTime
    if (behind <= MAX_SECONDS_BEHIND) return
    log(`The announcement stream was ${Math.round(behind)} seconds behind, so it is starting again from the present`)
    start()
  }
  audio.addEventListener('playing', onPlaying)
  audio.addEventListener('waiting', onWaiting)
  audio.addEventListener('error', onError)
  audio.addEventListener('ended', onEnded)
  audio.addEventListener('loadedmetadata', onLoadedMetadata)
  // Resuming after a pause, or first playing long after autoplay was refused, would otherwise
  // announce trains that have already gone until the next check.
  audio.addEventListener('play', catchUp)

  const latency = setInterval(catchUp, LATENCY_CHECK_INTERVAL)

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
    audio.removeEventListener('loadedmetadata', onLoadedMetadata)
    audio.removeEventListener('play', catchUp)
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
}
