export interface AssociatedServiceDetail {
  cancelReason: CancelLatenessReason | null
  delayReason: CancelLatenessReason | null
  isCharter: boolean
  isPassengerService: boolean
  category: string
  sta: string
  staSpecified: boolean
  ata: string
  ataSpecified: boolean
  eta: string
  etaSpecified: boolean
  std: string
  stdSpecified: boolean
  atd: string
  atdSpecified: boolean
  etd: string
  etdSpecified: boolean
  rid: string
  uid: string
  locations: AssociatedServiceLocation[]
  trainid: string
}

export interface StaffServicesResponse {
  trainServices: TrainService[] | null
  busServices: null
  ferryServices: null
  isTruncated: boolean
  generatedAt: string
  locationName: string
  crs: string
  filterLocationName: null
  filtercrs: null
  filterType: number
  stationManager: string
  stationManagerCode: string
  nrccMessages: NrccMessage[]
  platformsAreHidden: boolean
  servicesAreUnavailable: boolean
}

export interface TrainService {
  previousLocations: any
  subsequentLocations: TimingLocation[]
  cancelReason: CancelLatenessReason | null
  delayReason: CancelLatenessReason | null
  category: string
  activities?: string[]
  length: number | null
  isReverseFormation: boolean
  detachFront: boolean
  origin: EndPointLocation[]
  destination: EndPointLocation[]
  currentOrigins: EndPointLocation[] | null
  currentDestinations: EndPointLocation[] | null
  formation: any
  rid: string
  uid: string
  trainid: string
  rsid: string | null
  sdd: string
  operator: string
  operatorCode: string
  isPassengerService: boolean
  isCharter: boolean
  isCancelled: boolean
  isCircularRoute: boolean
  filterLocationCancelled: boolean
  filterLocationOperational: boolean
  isOperationalCall: boolean
  sta: string
  staSpecified: boolean
  ata: string
  ataSpecified: boolean
  eta: string
  etaSpecified: boolean
  arrivalType: number
  arrivalTypeSpecified: boolean
  arrivalSource: string | null
  arrivalSourceInstance: any
  std: string
  stdSpecified: boolean
  atd: string
  atdSpecified: boolean
  etd: string
  etdSpecified: boolean
  departureType: number
  departureTypeSpecified: boolean
  departureSource: string | null
  departureSourceInstance: any
  platform: string
  platformIsHidden: boolean
  serviceIsSupressed: boolean
  adhocAlerts: any
}

export interface TimingLocation {
  locationName: string
  tiploc: string
  crs?: string
  isOperational: boolean
  isPass: boolean
  isCancelled: boolean
  platform?: string
  platformIsHidden: boolean
  serviceIsSuppressed: boolean
  sta: string
  staSpecified: boolean
  ata: string
  ataSpecified: boolean
  eta: string
  etaSpecified: boolean
  arrivalType: number
  arrivalTypeSpecified: boolean
  arrivalSource: string | null
  arrivalSourceInstance: any
  std: string
  stdSpecified: boolean
  atd: string
  atdSpecified: boolean
  etd: string
  etdSpecified: boolean
  departureType: number
  departureTypeSpecified: boolean
  departureSource: string | null
  departureSourceInstance: any
  lateness: any
  associations: Association[] | null
  adhocAlerts: any
  activities?: string[]
}

export enum AssociationCategory {
  Join = 0,
  Divide = 1,
  LinkedFrom = 2,
  LinkedTo = 3,
}

interface AssociatedServiceLocation extends TimingLocation {
  length: number | null
  falseDest: null | EndPointLocation[]
}

export interface Association<Category extends AssociationCategory = AssociationCategory> {
  /**
   * 0: Join
   * 1: Divide
   * 2: Linked-From (last service)
   * 3: Linked-To (next service)
   */
  category: AssociationCategory
  rid: string
  uid: string
  trainid: string
  rsid?: string
  sdd: string
  origin: string
  originCRS: string
  originTiploc: string
  destination: string
  destCRS: string
  destTiploc: string
  isCancelled: boolean

  /**
   * Added by this proxy
   */
  service: Category extends AssociationCategory.Divide ? AssociatedServiceDetail : undefined
}

interface CancelLatenessReason {
  tiploc: string
  near: boolean
  value: number
  stationName?: string | null
}

export interface EndPointLocation {
  isOperationalEndPoint: boolean
  locationName: string
  crs: string
  tiploc: string
  via: any
  futureChangeTo: number
  futureChangeToSpecified: boolean
}

interface NrccMessage {
  category: number
  severity: number
  xhtmlMessage: string
}

import TiplocToStation from './tiploc_to_station.json'

async function getServiceByRidForActivityData(rid: string): Promise<AssociatedServiceDetail | undefined> {
  const cache = await caches.open('activity-data')
  const url = `https://national-rail-api.davwheat.dev/service/${rid}`

  const cachedResponse = await cache.match(url, { ignoreMethod: true })
  if (cachedResponse) {
    console.log(`Activity data cache hit (${rid})`)
    return cachedResponse.json()
  }

  const response = await fetch(url)
  if (!response.ok) return undefined

  const json: AssociatedServiceDetail = await response.json()

  await cache.put(
    url,
    new Response(JSON.stringify(json), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    }),
  )

  return json
}

async function getServiceByRid(rid: string, followAssociations: boolean = false): Promise<AssociatedServiceDetail | undefined> {
  const cache = await caches.open('associated-service')
  const url = `https://national-rail-api.davwheat.dev/service/${rid}`

  const cachedResponse = await cache.match(url, { ignoreMethod: true })
  if (cachedResponse) {
    console.log(`Associated service cache hit (${rid})`)
    return cachedResponse.json()
  }

  const response = await fetch(url)
  if (!response.ok) return undefined

  let json: AssociatedServiceDetail = await response.json()

  if (followAssociations) {
    await processAssociatedService(json)
  }

  await cache.put(
    url,
    new Response(JSON.stringify(json), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120',
      },
    }),
  )

  // Split into array with groups of two chars
  json.locations.forEach(l => {
    if (l.activities) {
      l.activities = ((l.activities as any as string | undefined)?.match(/.{2}/g) || []).map(a => a.trim())
    }
  })

  return json
}

async function processService(service: TrainService): Promise<void> {
  const serviceData = await getServiceByRidForActivityData(service.rid)

  if (service.cancelReason?.near) {
    service.cancelReason.stationName = TiplocToStation[service.cancelReason.tiploc as keyof typeof TiplocToStation].crs || null
  }

  if (service.delayReason?.near) {
    service.delayReason.stationName = TiplocToStation[service.delayReason.tiploc as keyof typeof TiplocToStation].crs || null
  }

  for (const l in service.subsequentLocations) {
    const location: TimingLocation = service.subsequentLocations[l]

    for (const a in location.associations) {
      const association: Association = location.associations[a as any]

      if (association.category === AssociationCategory.Divide) {
        // Divides only
        association.service = await getServiceByRid(association.rid)
      } else if (
        association.category === AssociationCategory.LinkedTo &&
        (association.trainid === '0B00' || (service.trainid === '0B00' && association.trainid !== '0B00'))
      ) {
        // Fine. Or continuation bus services, and include future changes to trains again
        association.service = await getServiceByRid(association.rid, true)
      }
    }

    const activities = serviceData?.locations.find(l => {
      return l.tiploc === location.tiploc && (l.sta === location.sta || l.std === location.std)
    })?.activities as string | undefined

    // Split into array with groups of two chars
    if (activities) {
      location.activities = (activities?.match(/.{2}/g) || []).map(a => a.trim())
    }
  }
}

async function processAssociatedService(service: AssociatedServiceDetail): Promise<void> {
  for (const l in service.locations) {
    const location: TimingLocation = service.locations[l]

    for (const a in location.associations) {
      const association: Association = location.associations[a as any]

      if (association.category === AssociationCategory.Divide) {
        // Divides only
        association.service = await getServiceByRid(association.rid)
      } else if (
        association.category === AssociationCategory.LinkedTo &&
        (association.trainid === '0B00' || (service.trainid === '0B00' && association.trainid !== '0B00'))
      ) {
        // Fine. Or continuation bus services, and include future changes to trains again
        association.service = await getServiceByRid(association.rid, true)
      }
    }
  }
}

export const onRequest: PagesFunction<Env> = async context => {
  const { request } = context
  const { searchParams } = new URL(request.url)

  try {
    const station = searchParams.get('station')
    const maxServices = searchParams.get('maxServices') || '10'
    const timeOffset = searchParams.get('timeOffset') || '0'
    const timeWindow = searchParams.get('timeWindow') || '120'
    const expand = 'true'

    if (!station) {
      return Response.json({ error: true, message: 'Missing station' })
    }

    const params = new URLSearchParams({
      expand,
      timeOffset,
      timeWindow,
    })

    const response = await fetch(`https://national-rail-api.davwheat.dev/staffdepartures/${station}/${maxServices}?${params}`, {
      cf: {
        cacheTtl: 10,
        cacheEverything: true,
      },
    })

    if (!response.ok) {
      return Response.json({ error: true, message: 'Upstream fetch error' })
    }

    if (response.headers.get('CF-Cache-Status') === 'HIT') {
      console.log(`Departure board cache hit (${station})`)
    }

    const json: StaffServicesResponse = await response.json()

    await Promise.all(json.trainServices?.map(service => processService(service)) ?? [])

    const resp = Response.json(json)
    resp.headers.set('Cache-Control', 'public, max-age=5, s-maxage=30')
    return resp
  } catch (ex) {
    console.error(ex)

    if (ex && ex instanceof Error) {
      return Response.json({ error: true, message: ex.message })
    } else {
      return Response.json({ error: true, message: 'Unknown error' })
    }
  }
}
