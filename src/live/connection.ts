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

/** Reconnect only to this feed. A disconnect never enables the legacy API. */
export function connectStream(
  url: URL,
  onMessage: (message: unknown, socket: WebSocket) => void,
  onReset: () => void,
  onStatus: (status: ConnectionStatus) => void,
  /** Recycle a stream this long without traffic: a middlebox drops an idle connection
   *  without telling either end, and a stream with no keepalive cannot notice. */
  idleTimeout?: number,
): () => void {
  let stopped = false
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let connectTimeout: ReturnType<typeof setTimeout> | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let attempts = 0

  function connect() {
    if (stopped) return
    onStatus(attempts === 0 ? 'connecting' : 'reconnecting')
    const current = new WebSocket(url)
    socket = current
    connectTimeout = setTimeout(() => current.close(), 20_000)
    if (idleTimeout) idleTimer = setTimeout(() => current.close(), idleTimeout)

    current.onmessage = event => {
      if (stopped || socket !== current) return
      try {
        if (typeof event.data !== 'string' || event.data.length > 5_000_000) {
          throw new Error('Invalid stream message')
        }
        onMessage(JSON.parse(event.data), current)
        clearTimeout(connectTimeout)
        if (idleTimeout) {
          clearTimeout(idleTimer)
          idleTimer = setTimeout(() => current.close(), idleTimeout)
        }
        attempts = 0
      } catch (error) {
        console.error('Invalid live feed message', error)
        current.close()
      }
    }

    current.onerror = () => current.close()
    current.onclose = () => {
      clearTimeout(connectTimeout)
      clearTimeout(idleTimer)
      if (stopped || socket !== current) return
      onReset()
      onStatus('reconnecting')
      const delay = Math.min(30_000, 1000 * 2 ** attempts++)
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
  }
}
