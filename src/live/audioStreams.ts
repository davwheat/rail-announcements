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
  /** The stream as one endless MP3 response, which every browser plays for itself. */
  radioUrl: string
}

/**
 * The one stream that carries the whole station, as the endless MP3 response every browser plays.
 * Zones are separate loudspeakers, so the service lets them speak over each other and mixes them,
 * while the platforms within a zone take turns. One stream means one player, which is what a
 * browser keeps alive in a background tab.
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

  return { zones: wholeStationVoice ? [] : groups, radioUrl: endpoint('live.mp3') }
}

export type StreamStatus = 'connecting' | 'playing' | 'blocked' | 'reconnecting'

const RECONNECT_DELAY = 3000
const LATENCY_CHECK_INTERVAL = 10_000
/** MediaError.MEDIA_ERR_ABORTED, spelled out because the tests run where MediaError does not exist. */
const MEDIA_ERR_ABORTED = 1
/** An endless response has no live edge to return to, so every stall or pause leaves the player
 *  that much further behind for good. Past this it starts the stream again. That drops the audio in
 *  between, which can be part of an announcement, so a brief stall is not enough. Short of this,
 *  the service is asked to leave silence out instead, which drops nothing. */
const MAX_SECONDS_BEHIND = 10
/** The service opens each MP3 response with three seconds of the recent past. */
const SECONDS_BEHIND_AT_START = 3
/** How far behind the player has to be before the service is asked to leave silence out of its
 *  response. A browser that buffers a couple of seconds more before it starts is that far behind
 *  from the first moment, and has nothing to catch up on. */
const TRIM_FROM_SECONDS_BEHIND = 6
/** How far behind the player is brought back to. That is a second more than a response starts
 *  with, because silence left out beyond what the player holds runs it dry. */
const TRIM_TO_SECONDS_BEHIND = 4
/** How long a player that has run dry is given to recover by itself. Firefox, having run dry on a
 *  live response, holds it in a buffering state for some fifteen seconds, waiting for more audio
 *  than a stream sent in real time can ever hand over: `currentTime` stops, the element stays
 *  unpaused, and the listener loses the rest of the announcement. A fresh response is back in the
 *  present in under a second, but it drops the audio in between, so anything shorter than this is
 *  left to the browser. */
const STALL_LIMIT = 4000
/** How long a restart has to cure the lag before the lag is taken as something a restart cannot
 *  cure: a browser that needs a deeper buffer than the response opens with, or a network that
 *  cannot keep up. Restarting one of those every lag check leaves the listener nothing but the
 *  first seconds of announcements. */
const RESTART_BACKOFF = 60_000
/** How long the load a start replaced can still be reporting itself for. The browser queues the
 *  aborted load's events as the new one begins, so they arrive within a turn or two; a failure
 *  reported later than this is the new load's own. */
const REPLACED_LOAD_SETTLE = 1000

/** What the service has left out of one response, and has yet to leave out, in seconds. */
export interface Trimming {
  trimmed: number
  pending: number
}

/** Asks the service to make one response `total` seconds shorter in all, counted from its start,
 *  by leaving out silence between announcements. It resolves with null when the service has no
 *  such response, or cannot trim one. */
export type AskToTrim = (responseUrl: string, total: number) => Promise<Trimming | null>

export const askServiceToTrim: AskToTrim = async (responseUrl, total) => {
  const url = new URL(responseUrl)
  url.pathname = url.pathname.replace(/live\.mp3$/, 'trim')
  url.searchParams.set('total', total.toFixed(1))
  const response = await fetch(url, { method: 'POST' })
  if (response.status === 404 || response.status === 405) return null
  if (!response.ok) throw new Error(`The announcement service answered ${response.status}`)
  const body = await response.json()
  return { trimmed: Number(body.trimmed) || 0, pending: Number(body.pending) || 0 }
}

/**
 * Plays the station's stream through an audio element until the returned function is called.
 *
 * Everything here is the browser's own playback of one URL, the way a browser plays internet
 * radio: no script has to run for the audio to continue, so a background tab whose timers are
 * throttled keeps announcing. The service also offers the same audio as an HLS playlist, which the
 * page leaves alone: a browser's claim to play HLS is unreliable (Firefox says it can, starts the
 * playlist, then fails part-way through an announcement for want of a decoder), and a browser that
 * cannot play a playlist by itself needs a script to feed it segments, which is what a background
 * tab stops doing.
 */
export function playStream(
  stream: StationStream,
  audio: HTMLAudioElement,
  onStatus: (status: StreamStatus) => void,
  log: (message: string) => void = () => {},
  askToTrim?: AskToTrim,
): () => void {
  let stopped = false
  let retry: ReturnType<typeof setTimeout> | undefined
  let stall: ReturnType<typeof setTimeout> | undefined
  let respondedAt: number | undefined
  let generation = 0
  /** Whether a load is still in a position to report its own error or ended. */
  let open = false
  /** When the load in progress replaced one that was, if it did. */
  let replacedAt: number | undefined
  let restartedAt: number | undefined
  let leftToPlayLogged = false
  /** The response in progress, which carries the name the service knows this listener by. */
  let responseUrl = stream.radioUrl
  /** What the service has left out of the response in progress, in seconds, as it last said. */
  let trimmed = 0
  /** The total that the log last reported the service being asked for. */
  let saidFor = 0
  let cannotTrim = false
  const listener = askToTrim && Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('')

  const start = () => {
    const loading = ++generation
    // This start supersedes both a reconnect waiting to happen and the stall it was called for.
    clearTimeout(retry)
    retry = undefined
    clearTimeout(stall)
    stall = undefined
    // Assigning src makes the browser abort a load in progress, and the aborted load reports that
    // afterwards as an error or an ended of its own.
    replacedAt = open ? Date.now() : undefined
    open = true
    respondedAt = undefined
    trimmed = 0
    saidFor = 0
    cannotTrim = false
    if (listener) {
      // A name of its own for each response, because the one this replaces is still closing.
      const named = new URL(stream.radioUrl)
      named.searchParams.set('listener', `${listener}-${loading}`)
      responseUrl = named.toString()
    }
    audio.src = responseUrl
    audio.play().then(
      () => {},
      () => {
        // A start that replaced this load rejected its play(), which is not the browser refusing.
        if (stopped || loading !== generation) return
        // The browser wants a click before it plays anything. The element shows its controls for that.
        if (audio.paused && !audio.error) onStatus('blocked')
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
  /** Starting again cures a response the player has fallen behind or run dry on. It cures nothing
   *  about the browser or the network, so it is worth one attempt per backoff window and then the
   *  stream is better late than broken. */
  const restart = (why: string) => {
    const at = Date.now()
    if (restartedAt !== undefined && at - restartedAt < RESTART_BACKOFF) {
      if (leftToPlayLogged) return false
      leftToPlayLogged = true
      log('The announcement stream is still behind, so it is being left to play')
      return false
    }
    restartedAt = at
    leftToPlayLogged = false
    log(why)
    start()
    return true
  }
  /** Catching up without starting again: the service leaves silence out of this response, so the
   *  player loses nothing that was said and keeps its connection. Only the page can ask, because
   *  the audio the player has yet to play sits in network buffers that the service cannot see.
   *  The request names the total for the whole response, so asking again adds nothing. */
  const trim = (played: number) => {
    if (!askToTrim || cannotTrim) return
    const loading = generation
    const total = played - TRIM_TO_SECONDS_BEHIND
    askToTrim(responseUrl, total).then(
      answer => {
        if (stopped || loading !== generation) return
        if (!answer) {
          cannotTrim = true
          return
        }
        trimmed = answer.trimmed
        // Said once for each time the player falls behind, and not at every check until it is back.
        const pending = Math.round(answer.pending)
        if (pending < 1 || total <= saidFor + 1) return
        saidFor = total
        log(
          `The announcement stream is ${Math.round(played - trimmed)} seconds behind, so the service is leaving ${pending} second${pending === 1 ? '' : 's'} of silence out of it`,
        )
      },
      // A request that the network lost is made again at the next lag check.
      () => {},
    )
  }
  /** Whether this failure belongs to the load a start replaced rather than to the one now in
   *  progress. Reconnecting on it would report a failure that never happened and, three seconds
   *  later, throw away the response that replaced it. The replaced load gets one such event, and
   *  only until the new response answers, so a real failure still reconnects. */
  const fromReplacedLoad = () => {
    if (respondedAt !== undefined || replacedAt === undefined || Date.now() - replacedAt >= REPLACED_LOAD_SETTLE) return false
    replacedAt = undefined
    return true
  }
  const onPlaying = () => {
    clearTimeout(stall)
    stall = undefined
    onStatus('playing')
  }
  const onWaiting = () => {
    onStatus('connecting')
    // Waiting for a response that has yet to answer is that response loading, not a stall.
    if (stopped || respondedAt === undefined || stall !== undefined) return
    stall = setTimeout(() => {
      stall = undefined
      // A listener who paused during the stall is not asking for the stream back.
      if (stopped || audio.paused) return
      restart('The announcement stream stalled, so it is starting again from the present')
    }, STALL_LIMIT)
  }
  // Whatever the element failed with, the response is the only thing to play, so every failure is
  // the same failure: wait, and ask for it again. An abort is not one of them: the page aborts a
  // load only by replacing it on purpose.
  //
  // A new load clears the element's error, so an error that the element still holds is the new
  // load's own, however soon after the replacement it comes. A device with no network fails the
  // new load at once, and taking that for the replaced load's leaves nothing to ask again.
  const onError = () => {
    if (audio.error?.code === MEDIA_ERR_ABORTED || (!audio.error && fromReplacedLoad())) return
    open = false
    reconnect('failed')
  }
  // The service ends a response when the listener falls too far behind, or when it restarts.
  const onEnded = () => {
    if (fromReplacedLoad()) return
    open = false
    reconnect('ended')
  }
  const onLoadedMetadata = () => {
    respondedAt = Date.now()
    replacedAt = undefined
  }
  // A phone pauses the element for a call, for another app's audio or when headphones come out,
  // and a media key does it anywhere. No other event reports that, so the page would go on saying
  // that the stream is live, with no play button to bring it back. An element also pauses itself
  // as its response ends, which is the ended handler's business.
  const onPause = () => {
    if (stopped || !audio.paused || audio.ended || audio.error) return
    onStatus('blocked')
  }
  // The service sends audio as it is made, so a player that never stalled or paused stays as far
  // behind as the response started. Everything past that is lag. The buffered range cannot show it:
  // Chrome reads only a couple of seconds ahead and leaves the rest of a backlog in the network
  // buffers, where no seek reaches it. A new response is the only way back to the present.
  const catchUp = () => {
    if (stopped) return
    if (respondedAt === undefined) {
      // A failure that was taken for the replaced load's leaves a response that never answers, and
      // nothing else is watching it. This comes before the check for a pause, because a browser
      // pauses an element whose load failed.
      if (audio.error && audio.error.code !== MEDIA_ERR_ABORTED) reconnect('failed')
      return
    }
    if (audio.paused) return
    // The element's clock cannot see silence that the service left out, so that comes off.
    const played = SECONDS_BEHIND_AT_START + (Date.now() - respondedAt) / 1000 - audio.currentTime
    const behind = played - trimmed
    if (
      behind > MAX_SECONDS_BEHIND &&
      restart(`The announcement stream was ${Math.round(behind)} seconds behind, so it is starting again from the present`)
    )
      return
    if (behind > TRIM_FROM_SECONDS_BEHIND) trim(played)
  }
  audio.addEventListener('playing', onPlaying)
  audio.addEventListener('waiting', onWaiting)
  audio.addEventListener('error', onError)
  audio.addEventListener('ended', onEnded)
  audio.addEventListener('loadedmetadata', onLoadedMetadata)
  audio.addEventListener('pause', onPause)
  // Resuming after a pause, or first playing long after autoplay was refused, would otherwise
  // announce trains that have already gone until the next check.
  audio.addEventListener('play', catchUp)

  const latency = setInterval(catchUp, LATENCY_CHECK_INTERVAL)

  onStatus('connecting')
  start()

  return () => {
    stopped = true
    clearTimeout(retry)
    clearTimeout(stall)
    clearInterval(latency)
    audio.removeEventListener('playing', onPlaying)
    audio.removeEventListener('waiting', onWaiting)
    audio.removeEventListener('error', onError)
    audio.removeEventListener('ended', onEnded)
    audio.removeEventListener('loadedmetadata', onLoadedMetadata)
    audio.removeEventListener('pause', onPause)
    audio.removeEventListener('play', catchUp)
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
}
