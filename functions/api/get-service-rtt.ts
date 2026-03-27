import { PagesFunction } from '@cloudflare/workers-types'
export type { RttResponse, RttOrigin, RttDestination, RttLocation, LocationDisplayAs, RttDivision } from './get-service-rtt-types'
import type { RttResponse, RttOrigin, RttDestination, RttLocation, LocationDisplayAs, RttDivision } from './get-service-rtt-types'

// ── New RTT API v2 response types ──────────────────────────────────────────────

interface V2GeographicLocation {
  description: string
  shortCodes?: string[]
  longCodes?: string[]
}

interface V2IndividualTemporalData {
  scheduleInternal?: string
  scheduleAdvertised?: string
  realtimeForecast?: string
  realtimeActual?: string
  realtimeAdvertisedLateness?: number
  isCancelled?: boolean
}

interface V2LocationTemporalData {
  arrival?: V2IndividualTemporalData
  departure?: V2IndividualTemporalData
  pass?: V2IndividualTemporalData
  scheduledCallType?: 'OPERATIONAL_ONLY' | 'ADVERTISED_OPEN' | 'ADVERTISED_SET_DOWN' | 'ADVERTISED_PICK_UP' | null
  displayAs?: 'CALL' | 'CANCELLED' | 'DIVERTED' | 'STARTS' | 'TERMINATES' | null
}

interface V2PlannedActualData {
  planned?: string
  actual?: string
}

interface V2LocationMetadata {
  platform?: V2PlannedActualData
  numberOfVehicles?: number
  allocationIndex?: number
  isRequestStop?: boolean
}

interface V2LocationPair {
  location: V2GeographicLocation
  temporalData?: V2IndividualTemporalData
}

interface V2AssociatedService {
  associationData: {
    associationType: string
    isPublic?: boolean
  }
  scheduleMetadata: {
    identity: string
    departureDate: string
  }
}

interface V2ServiceLocation {
  temporalData: V2LocationTemporalData
  locationMetadata?: V2LocationMetadata
  location: V2GeographicLocation
  associatedServices?: V2AssociatedService[]
}

interface V2AllocationItem {
  identity: string
  numberOfVehicles?: number
}

interface V2Allocation {
  allocationIndex: number
  passengerVehicles?: number
  allocationItems?: V2AllocationItem[]
}

interface V2ServiceResponse {
  service: {
    scheduleMetadata: {
      identity: string
      departureDate: string
      operator: { code: string; name: string }
      modeType?: string
      inPassengerService?: boolean
      trainReportingIdentity?: string
    }
    locations: V2ServiceLocation[]
    allocationData?: V2Allocation[]
    origin?: V2LocationPair[]
    destination?: V2LocationPair[]
  }
}

interface V2AccessTokenResponse {
  token: string
  validUntil: string
}

// ── Transformation helpers ─────────────────────────────────────────────────────

function mapDisplayAs(
  v2DisplayAs: V2LocationTemporalData['displayAs'],
  scheduledCallType: V2LocationTemporalData['scheduledCallType'],
  isFirst: boolean,
  isLast: boolean,
): LocationDisplayAs {
  if (v2DisplayAs === null || v2DisplayAs === undefined) {
    return 'PASS'
  }

  switch (v2DisplayAs) {
    case 'CALL':
      return 'CALL'
    case 'STARTS':
      return isFirst ? 'ORIGIN' : 'STARTS'
    case 'TERMINATES':
      return isLast ? 'DESTINATION' : 'TERMINATES'
    case 'CANCELLED':
    case 'DIVERTED': {
      const wasAdvertised =
        scheduledCallType === 'ADVERTISED_OPEN' || scheduledCallType === 'ADVERTISED_SET_DOWN' || scheduledCallType === 'ADVERTISED_PICK_UP'
      return wasAdvertised ? 'CANCELLED_CALL' : 'CANCELLED_PASS'
    }
    default:
      return 'PASS'
  }
}

function convertLocationPairToOrigin(pair: V2LocationPair): RttOrigin {
  return {
    tiploc: pair.location.longCodes?.[0] ?? '',
    crs: pair.location.shortCodes?.[0],
  }
}

function convertLocationPairToDestination(pair: V2LocationPair): RttDestination {
  return {
    tiploc: pair.location.longCodes?.[0] ?? '',
    crs: pair.location.shortCodes?.[0],
  }
}

function getRealtimeTime(individual: V2IndividualTemporalData | undefined): string | undefined {
  if (!individual) return undefined
  return individual.realtimeActual ?? individual.realtimeForecast ?? undefined
}

/**
 * Determine which part of the train is splitting off by comparing allocation items
 * before and after the split. Falls back to 'rear' if data is missing or inconsistent.
 */
function determineSplitPosition(
  beforeAlloc: V2Allocation | undefined,
  afterAlloc: V2Allocation | undefined,
): 'front' | 'middle' | 'rear' | 'unknown' {
  if (!beforeAlloc?.allocationItems?.length || !afterAlloc?.allocationItems?.length) {
    return 'rear'
  }

  const beforeIds = beforeAlloc.allocationItems.map(i => i.identity)
  const afterIds = new Set(afterAlloc.allocationItems.map(i => i.identity))

  const missingIndices: number[] = []
  for (let i = 0; i < beforeIds.length; i++) {
    if (!afterIds.has(beforeIds[i])) {
      missingIndices.push(i)
    }
  }

  if (missingIndices.length === 0) return 'rear'

  const firstMissing = missingIndices[0]
  const lastMissing = missingIndices[missingIndices.length - 1]
  const isContiguous = lastMissing - firstMissing + 1 === missingIndices.length

  if (!isContiguous) return 'rear'
  if (firstMissing === 0) return 'front'
  if (lastMissing === beforeIds.length - 1) return 'rear'

  // Units splitting from the middle — default to rear per user preference
  return 'rear'
}

function isPublicCallType(callType: V2LocationTemporalData['scheduledCallType']): boolean {
  return callType === 'ADVERTISED_OPEN' || callType === 'ADVERTISED_SET_DOWN' || callType === 'ADVERTISED_PICK_UP'
}

// ── Access token management ────────────────────────────────────────────────────

const RTT_API_VERSION = '2026-03-27'
const KV_TOKEN_KEY = 'rtt_access_token'

async function getAccessToken(refreshToken: string, kv: KVNamespace): Promise<string> {
  const cached = await kv.get(KV_TOKEN_KEY)
  if (cached) return cached

  const resp = await fetch('https://data.rtt.io/api/get_access_token', {
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      Accept: 'application/json',
      Version: RTT_API_VERSION,
    },
  })

  if (!resp.ok) {
    console.log(await resp.json())
    throw new Error(`Failed to authenticate with RTT API: ${resp.status} ${resp.statusText}`)
  }

  const data: V2AccessTokenResponse = await resp.json()

  // Cache until the token expires, with a 60-second safety margin
  const expiresAt = new Date(data.validUntil).getTime()
  const now = Date.now()
  const ttlSeconds = Math.max(Math.floor((expiresAt - now) / 1000) - 60, 0)

  if (ttlSeconds > 0) {
    await kv.put(KV_TOKEN_KEY, data.token, { expirationTtl: ttlSeconds })
  }

  return data.token
}

// ── API fetch helper ─────────────────────────────────────────────────────────

async function fetchV2Service(serviceUid: string, runDate: string, token: string): Promise<V2ServiceResponse> {
  const req = await fetch(
    `https://data.rtt.io/gb-nr/service?identity=${encodeURIComponent(serviceUid)}&departureDate=${encodeURIComponent(runDate)}&detail=true`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        Version: RTT_API_VERSION,
        'User-Agent': 'railannouncements.co.uk',
      },
    },
  )

  if (req.status === 404) {
    const body = await req.text()
    console.log('RTT API 404 response:', body)
    throw new Error('Service not found')
  }
  if (!req.ok) {
    const body = await req.text()
    console.log('RTT API error response:', body)
    throw new Error(`Failed to fetch RTT service: ${req.status} ${req.statusText}`)
  }

  return req.json()
}

// ── Division resolution ──────────────────────────────────────────────────────

async function resolveDivisions(mainService: V2ServiceResponse['service'], token: string): Promise<Map<number, RttDivision[]>> {
  const divisionsByLocationIndex = new Map<number, RttDivision[]>()

  // Build allocation lookup: allocationIndex → V2Allocation
  const allocations = new Map<number, V2Allocation>()
  for (const alloc of mainService.allocationData ?? []) {
    allocations.set(alloc.allocationIndex, alloc)
  }

  // Collect all DIVIDE_INTO associations with their location indices
  const divideRequests: { locationIndex: number; assoc: V2AssociatedService }[] = []
  for (let i = 0; i < mainService.locations.length; i++) {
    const loc = mainService.locations[i]
    for (const assoc of loc.associatedServices ?? []) {
      if (assoc.associationData.associationType === 'DIVIDE_INTO') {
        divideRequests.push({ locationIndex: i, assoc })
      }
    }
  }

  if (divideRequests.length === 0) return divisionsByLocationIndex

  // Fetch all divided services in parallel
  const results = await Promise.allSettled(
    divideRequests.map(async ({ locationIndex, assoc }) => {
      const splitLoc = mainService.locations[locationIndex]
      const splitTiplocs = new Set(splitLoc.location.longCodes ?? [])

      const v2Response = await fetchV2Service(assoc.scheduleMetadata.identity, assoc.scheduleMetadata.departureDate, token)
      const assocService = v2Response.service
      if (!assocService) return null

      // Find the split point in the associated service's locations (match by tiploc)
      const splitPointIdx = assocService.locations.findIndex(l => (l.location.longCodes ?? []).some(t => splitTiplocs.has(t)))

      // Take public call locations after the split point (excluding the split point itself)
      const callingPoints: RttDivision['callingPoints'] = []
      for (let j = splitPointIdx + 1; j < assocService.locations.length; j++) {
        const assocLoc = assocService.locations[j]
        if (!isPublicCallType(assocLoc.temporalData.scheduledCallType)) continue
        if (assocLoc.temporalData.displayAs === 'CANCELLED' || assocLoc.temporalData.displayAs === 'DIVERTED') continue
        callingPoints.push({
          crs: assocLoc.location.shortCodes?.[0],
          tiploc: assocLoc.location.longCodes?.[0] ?? '',
        })
      }

      // Determine split position from allocation data
      const splitAllocIdx = splitLoc.locationMetadata?.allocationIndex
      const nextLoc = mainService.locations[locationIndex + 1]
      const nextAllocIdx = nextLoc?.locationMetadata?.allocationIndex
      const position = determineSplitPosition(
        splitAllocIdx != null ? allocations.get(splitAllocIdx) : undefined,
        nextAllocIdx != null ? allocations.get(nextAllocIdx) : undefined,
      )

      // Determine vehicle count: diff between this location and the next
      const vehiclesHere = splitLoc.locationMetadata?.numberOfVehicles
      const vehiclesNext = nextLoc?.locationMetadata?.numberOfVehicles
      let vehicleCount: number | undefined
      if (vehiclesHere != null && vehiclesNext != null) {
        const diff = vehiclesHere - vehiclesNext
        if (diff > 0) vehicleCount = diff
      }

      return {
        locationIndex,
        division: {
          serviceUid: assoc.scheduleMetadata.identity,
          position,
          vehicleCount,
          callingPoints,
        } satisfies RttDivision,
      }
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Failed to fetch divided service:', result.reason)
      continue
    }
    if (!result.value) continue

    const { locationIndex, division } = result.value
    const existing = divisionsByLocationIndex.get(locationIndex) ?? []
    existing.push(division)
    divisionsByLocationIndex.set(locationIndex, existing)
  }

  return divisionsByLocationIndex
}

// ── Core fetch + transform ─────────────────────────────────────────────────────

async function fetchRttService(serviceUid: string, runDate: string, token: string): Promise<RttResponse> {
  const v2Response = await fetchV2Service(serviceUid, runDate, token)
  console.log('RTT API response:', JSON.stringify(v2Response, null, 2))
  const service = v2Response.service

  if (!service) {
    throw new Error('No service data in response')
  }

  const meta = service.scheduleMetadata

  // Build a tiploc → CRS lookup from the locations array, which reliably has shortCodes
  const tiplocToCrs = new Map<string, string>()
  for (const loc of service.locations) {
    const crs = loc.location.shortCodes?.[0]
    if (crs) {
      for (const tiploc of loc.location.longCodes ?? []) {
        tiplocToCrs.set(tiploc, crs)
      }
    }
  }

  // Service-level origin/destination may lack shortCodes; enrich CRS from the locations lookup
  const serviceOrigins: RttOrigin[] = (service.origin ?? []).map(pair => {
    const origin = convertLocationPairToOrigin(pair)
    if (!origin.crs && origin.tiploc) origin.crs = tiplocToCrs.get(origin.tiploc)
    return origin
  })
  const serviceDestinations: RttDestination[] = (service.destination ?? []).map(pair => {
    const dest = convertLocationPairToDestination(pair)
    if (!dest.crs && dest.tiploc) dest.crs = tiplocToCrs.get(dest.tiploc)
    return dest
  })

  // Resolve train divisions (splits) — fetch associated services in parallel
  const divisionsByIndex = await resolveDivisions(service, token)

  const locationCount = service.locations.length
  const locations: RttLocation[] = service.locations.map((loc, index) => {
    const temporal = loc.temporalData
    const locMeta = loc.locationMetadata
    const geoLoc = loc.location

    const arrival = temporal.arrival
    const departure = temporal.departure

    const scheduledCallType = temporal.scheduledCallType
    const isPublicCall = isPublicCallType(scheduledCallType)

    const displayAs = mapDisplayAs(temporal.displayAs, scheduledCallType, index === 0, index === locationCount - 1)

    const passengerVehicleCount = locMeta?.numberOfVehicles

    return {
      tiploc: geoLoc.longCodes?.[0] ?? '',
      crs: geoLoc.shortCodes?.[0],
      origin: serviceOrigins,
      destination: serviceDestinations,
      isPublicCall,
      platform: locMeta?.platform?.actual ?? locMeta?.platform?.planned,
      scheduledArrival: arrival?.scheduleAdvertised,
      scheduledDeparture: departure?.scheduleAdvertised,
      realtimeArrival: getRealtimeTime(arrival),
      realtimeDeparture: getRealtimeTime(departure),
      displayAs,
      arrivalLateness: arrival?.realtimeAdvertisedLateness,
      departureLateness: departure?.realtimeAdvertisedLateness,
      passengerVehicleCount,
      requestStop: locMeta?.isRequestStop || undefined,
      divisions: divisionsByIndex.get(index),
    }
  })

  return {
    serviceUid: meta.identity,
    runDate: meta.departureDate,
    atocCode: meta.operator.code,
    atocName: meta.operator.name,
    locations,
  }
}

// ── Request handler ────────────────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const { searchParams } = new URL(request.url)

  try {
    const uid = searchParams.get('uid')
    const date = searchParams.get('date')

    if (!uid) {
      return Response.json({ error: true, message: 'Missing uid' })
    }
    if (!date) {
      return Response.json({ error: true, message: 'Missing date' })
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return Response.json({ error: true, message: 'Invalid date' })
    }

    const token = await getAccessToken(env.RTT_API_TOKEN, env.KV)
    const json = await fetchRttService(uid, date, token)

    return Response.json(json)
  } catch (ex) {
    console.error('get-service-rtt error:', ex)
    if (ex instanceof Error && ex.message) {
      return Response.json({ error: true, message: ex.message })
    } else {
      return Response.json({ error: true, message: 'Unknown error' })
    }
  }
}
