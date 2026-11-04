import { useEffect, useState } from 'react'

/** The station platform list, from Darwin Browser's SMART reference data. */
export interface StationPlatformsResponse {
  crs: string
  name?: string
  tiplocs: string[]
  stanox: string[]
  platforms: string[]
  /** Other CRS codes sharing this station's STANOX, whose platforms SMART cannot tell apart from its own. */
  shared_with?: string[]
  /** Platforms used whole on some days and in parts on others, each with its parts (Birmingham New Street's 4: 4A, 4B). */
  subdivisions?: Record<string, string[]>
}

export type StationPlatforms =
  | { status: 'loading' }
  | { status: 'ready'; platforms: string[]; name?: string; sharedWith: string[]; subdivisions: Record<string, string[]> }
  /** SMART describes no platform here, or the service could not answer. Either way the
   *  caller knows nothing about this station and must not narrow anything on that basis. */
  | { status: 'unavailable'; reason: string }

/** Rewrites a WebSocket service URL to the HTTP one the REST endpoints live on. The
 *  live service is configured once, as `wss://…`, and this endpoint is on that host. */
export function platformsUrl(base: string, crs: string): URL {
  const url = new URL(base)
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    throw new Error('Use an HTTP or WebSocket service URL')
  }
  url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'https:' : 'http:'
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/platforms`
  url.search = new URLSearchParams({ crs }).toString()
  url.hash = ''
  return url
}

export async function fetchStationPlatforms(base: string, crs: string, signal?: AbortSignal): Promise<StationPlatforms> {
  let url: URL

  try {
    url = platformsUrl(base, crs)
  } catch (error) {
    return { status: 'unavailable', reason: String(error) }
  }

  const response = await fetch(url, { signal })

  // 404 means SMART has no location for the code, and 503 means the service has
  // not loaded the datasets yet. Neither says the station has no platforms.
  if (response.status === 404) {
    return { status: 'unavailable', reason: `SMART does not describe ${crs}` }
  }
  if (!response.ok) {
    return { status: 'unavailable', reason: `platform list: HTTP ${response.status}` }
  }

  const body: StationPlatformsResponse = await response.json()

  if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
    return { status: 'unavailable', reason: `SMART describes no platforms at ${crs}` }
  }

  return {
    status: 'ready',
    platforms: body.platforms,
    name: body.name,
    sharedWith: body.shared_with ?? [],
    subdivisions: readSubdivisions(body.subdivisions),
  }
}

function readSubdivisions(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([platform, parts]) => (Array.isArray(parts) && parts.length > 0 ? [[platform, parts.map(String)]] : [])),
  )
}

/** The platforms that get a board of their own. A subdivided platform has none: its parts' boards show its trains too,
 *  as the live service sends a train for the whole of 4 to the boards for 4A and 4B. */
export function boardPlatforms(platforms: string[], subdivisions: Record<string, string[]>): string[] {
  const divided = new Set(Object.keys(subdivisions).map(platform => platform.toUpperCase()))
  return platforms.filter(platform => !divided.has(platform.toUpperCase()))
}

/** Reads the platform list for one station, refetching when the station or service changes. */
export function useStationPlatforms(base: string, crs: string): StationPlatforms {
  const [state, setState] = useState<StationPlatforms>({ status: 'loading' })

  useEffect(() => {
    const abort = new AbortController()
    setState({ status: 'loading' })

    fetchStationPlatforms(base, crs, abort.signal)
      .then(result => {
        if (!abort.signal.aborted) setState(result)
      })
      .catch(error => {
        if (!abort.signal.aborted) setState({ status: 'unavailable', reason: String(error) })
      })

    return () => abort.abort()
  }, [base, crs])

  return state
}
