/** Where rail-announcements-backend is. It builds announcements itself: as a live stream for a
 *  station, and as one MP3 for the state of a tab. */
export const ANNOUNCEMENT_SERVICE_URL = process.env.NEXT_PUBLIC_ANNOUNCEMENT_SERVICE_URL || 'http://localhost:8090'

/** Without a deployed service there is nothing to ask, so a production build only offers audio
 *  from the service once it has been told where the service is. */
export const ANNOUNCEMENT_SERVICE_AVAILABLE = !!process.env.NEXT_PUBLIC_ANNOUNCEMENT_SERVICE_URL || process.env.NODE_ENV === 'development'

const REQUEST_TIMEOUT = 30_000

function endpoint(baseUrl: string, path: string): string {
  const url = new URL(baseUrl)
  url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`
  return url.toString()
}

const supported = new Map<string, Promise<Map<string, Set<string>>>>()

/**
 * The tabs the service can build, as system ID -> tab IDs. What the service knows is asked, not
 * assumed: a system the website does not register, or one registered since the service was last
 * deployed, has no port there, and the page builds those tabs itself as it always has.
 *
 * The answer is fetched once for each service URL. A failed fetch is forgotten, so that a
 * service that was down is asked again on the next play.
 */
export function supportedAnnouncements(baseUrl: string = ANNOUNCEMENT_SERVICE_URL): Promise<Map<string, Set<string>>> {
  let known = supported.get(baseUrl)
  if (!known) {
    known = fetch(endpoint(baseUrl, '/v1/systems'), { signal: AbortSignal.timeout(REQUEST_TIMEOUT) })
      .then(response => {
        if (!response.ok) throw new Error(`The announcement service answered ${response.status}`)
        return response.json()
      })
      .then(
        (body: { systems: { id: string; announcements: string[] }[] }) =>
          new Map(body.systems.map(system => [system.id, new Set(system.announcements)])),
      )
    known.catch(() => supported.delete(baseUrl))
    supported.set(baseUrl, known)
  }
  return known
}

/**
 * Asks the service for the MP3 of a tab in the given state, which is the tab's own option state.
 * Resolves to null when the service does not build that tab. Rejects with the service's own
 * message when it refuses the state, and with the fault when it cannot be reached.
 */
export async function renderAnnouncement(
  systemId: string,
  tabId: string,
  state: unknown,
  baseUrl: string = ANNOUNCEMENT_SERVICE_URL,
): Promise<Uint8Array | null> {
  const systems = await supportedAnnouncements(baseUrl)
  if (!systems.get(systemId)?.has(tabId)) return null

  const response = await fetch(endpoint(baseUrl, '/v1/announcements'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: systemId, announcement: tabId, state }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new Error(problem?.error?.message || `The announcement service answered ${response.status}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}
