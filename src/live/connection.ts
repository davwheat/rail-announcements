import type { ServerMessage } from './types'
import { decodeServerMessage } from './wire'

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'recovering'

export function streamUrl(base: string, path: string, crs: string): URL {
  const url = new URL(base)
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    throw new Error('Use an HTTP or WebSocket service URL')
  }
  url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/${path}/live`
  url.search = new URLSearchParams({ crs }).toString()
  url.hash = ''
  return url
}

const CONNECT_TIMEOUT = 20_000
/** Room for an announcement that carries its own rendered audio: several minutes of MP3. */
const MAX_FRAME_BYTES = 8_000_000

function seconds(milliseconds: number): string {
  return `${Math.round(milliseconds / 1000)}s`
}

/** Reconnect only to this feed. A disconnect never enables the legacy API. */
export function connectStream(
  url: URL,
  onMessage: (message: ServerMessage) => void,
  onReset: () => void,
  onStatus: (status: ConnectionStatus) => void,
  /** Recycle a stream this long without traffic: a middlebox drops an idle connection
   *  without telling either end, and a stream with no keepalive cannot notice. */
  idleTimeout?: number,
  log: (message: string) => void = () => {},
): () => void {
  let stopped = false
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let connectTimeout: ReturnType<typeof setTimeout> | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let attempts = 0
  /** Why this socket is closing, so the disconnect reads as the fault it was rather than as a bare close. */
  let closeReason = ''

  function connect() {
    if (stopped) return
    onStatus(attempts === 0 ? 'connecting' : 'reconnecting')
    log(attempts === 0 ? `Connecting to ${url.host}${url.pathname}` : `Reconnecting to ${url.host}${url.pathname} (attempt ${attempts + 1})`)
    const current = new WebSocket(url)
    current.binaryType = 'arraybuffer'
    socket = current
    closeReason = ''
    connectTimeout = setTimeout(() => {
      closeReason = `no reply within ${seconds(CONNECT_TIMEOUT)}`
      current.close()
    }, CONNECT_TIMEOUT)
    if (idleTimeout) {
      idleTimer = setTimeout(() => {
        closeReason = `silent for ${seconds(idleTimeout)}`
        current.close()
      }, idleTimeout)
    }

    current.onopen = () => {
      if (stopped || socket !== current) return
      log('Connected; waiting for the service to send its baseline')
    }

    current.onmessage = event => {
      if (stopped || socket !== current) return
      try {
        // Version 2 frames are protobuf. A text frame is a version 1 service, which this build cannot read.
        if (!(event.data instanceof ArrayBuffer)) throw new Error('Expected a binary stream message')
        if (event.data.byteLength > MAX_FRAME_BYTES) throw new Error('Stream message is too large')
        const message = decodeServerMessage(new Uint8Array(event.data))
        if (message) onMessage(message)
        clearTimeout(connectTimeout)
        if (idleTimeout) {
          clearTimeout(idleTimer)
          idleTimer = setTimeout(() => {
            closeReason = `silent for ${seconds(idleTimeout)}`
            current.close()
          }, idleTimeout)
        }
        attempts = 0
      } catch (error) {
        console.error('Invalid live feed message', error)
        log(`Unreadable message from the live feed: ${error instanceof Error ? error.message : String(error)}`)
        closeReason = 'unreadable message'
        current.close()
      }
    }

    current.onerror = () => {
      closeReason ||= 'connection error'
      current.close()
    }
    current.onclose = () => {
      clearTimeout(connectTimeout)
      clearTimeout(idleTimer)
      if (stopped || socket !== current) return
      onReset()
      onStatus('reconnecting')
      const delay = Math.min(30_000, 1000 * 2 ** attempts++)
      log(`Live feed disconnected${closeReason ? ` (${closeReason})` : ''}; queued announcements dropped, retrying in ${seconds(delay)}`)
      retry = setTimeout(connect, delay)
    }
  }

  connect()
  return () => {
    stopped = true
    clearTimeout(retry)
    clearTimeout(connectTimeout)
    clearTimeout(idleTimer)
    socket?.close()
    onReset()
    log('Disconnected from the live feed')
  }
}
