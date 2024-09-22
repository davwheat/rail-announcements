import TiplocToStation from './tiploc_to_station.json'

interface RttError {
  error: string
}

export interface RttResponse {
  serviceUid: string
  runDate: string
  serviceType: string
  isPassenger: boolean
  trainIdentity: string
  powerType: string
  trainClass: string
  atocCode: string
  atocName: string
  performanceMonitored: boolean
  origin: Origin[]
  destination: Destination[]
  locations: Location[]
}

interface Origin {
  tiploc: string
  description: string
  workingTime: string
  publicTime: string
  crs?: string
}

interface Destination {
  tiploc: string
  description: string
  workingTime: string
  publicTime: string
  crs?: string
}

type LocationDisplayAs = 'CALL' | 'PASS' | 'ORIGIN' | 'DESTINATION' | 'STARTS' | 'TERMINATES' | 'CANCELLED_CALL' | 'CANCELLED_PASS'

interface Location {
  tiploc: string
  crs?: string
  description: string
  origin: Origin[]
  destination: Destination[]
  isCall: boolean
  isPublicCall: boolean
  platform?: string
  gbttBookedArrival?: string
  gbttBookedArrivalNextDay?: true
  gbttBookedDeparture?: string
  gbttBookedDepartureNextDay?: true
  realtimeDeparture?: string
  realtimeDepartureNextDay?: true
  realtimeArrival?: string
  realtimeArrivalNextDay?: true
  path?: string
  associations?: Association[]
  displayAs: LocationDisplayAs
  realtimeActivated?: true
  realtimeGbttArrivalLateness?: number
  realtimeGbttDepartureLateness?: number
}

interface Association {
  type: AssociationType
  associatedUid: string
  associatedRunDate: string
  service?: RttResponse
}

type AssociationType = 'divide' | 'join'

async function fetchRttService(
  serviceUid: string,
  runDate: string,
  username: string,
  password: string,
  followAssociations: boolean = true,
): Promise<RttResponse> {
  // YYYY-MM-DD
  const year = runDate.slice(0, 4)
  const month = runDate.slice(5, 7)
  const day = runDate.slice(8, 10)

  const req = await fetch(`https://api.rtt.io/api/v1/json/service/${serviceUid}/${year}/${month}/${day}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
      'User-Agent': 'railannouncements.co.uk',
      Server: 'cloudflare pages function',
    },
  })
  if (!req.ok) {
    throw new Error(`Failed to fetch RTT service: ${req.status} ${req.statusText}`)
  }
  const response: RttResponse | RttError = await req.json()

  if ('error' in response) {
    throw new Error(response.error)
  }

  // Fill in CRS data
  response.origin.forEach(origin => {
    const station = TiplocToStation[origin.tiploc]
    if (station) {
      origin.crs = station.crs
    }
  })
  response.destination.forEach(destination => {
    const station = TiplocToStation[destination.tiploc]
    if (station) {
      destination.crs = station.crs
    }
  })
  response.locations ??= []
  response.locations.forEach(location => {
    location.origin.forEach(origin => {
      const station = TiplocToStation[origin.tiploc]
      if (station) {
        origin.crs = station.crs
      }
    })
    location.destination.forEach(destination => {
      const station = TiplocToStation[destination.tiploc]
      if (station) {
        destination.crs = station.crs
      }
    })
  })

  if (followAssociations) {
    await Promise.all(
      response.locations
        .flatMap(location => {
          return location.associations?.map((association): Promise<any> => {
            return (async () => {
              association.service = await fetchRttService(association.associatedUid, association.associatedRunDate, username, password, false)
            })()
          })
        })
        .filter(Boolean),
    )
  }

  return response
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const { searchParams } = new URL(request.url)

  try {
    const uid = searchParams.get('uid')
    const date = searchParams.get('date')

    console.log(uid, date)

    if (!uid) {
      return Response.json({ error: true, message: 'Missing uid' })
    }
    if (!date) {
      return Response.json({ error: true, message: 'Missing date' })
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return Response.json({ error: true, message: 'Invalid date' })
    }

    const username = env.RTT_API_USERNAME
    const password = env.RTT_API_PASSWORD

    const json = await fetchRttService(uid, date, username, password)

    return Response.json(json)
  } catch (ex) {
    if (ex instanceof Error && ex.message) {
      return Response.json({ error: true, message: ex.message })
    } else {
      return Response.json({ error: true, message: 'Unknown error' })
    }
  }
}
