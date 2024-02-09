import { Env } from '.'
import TiplocToStation from './tiploc_to_station.json'

interface RttError {
  error: string
}

interface RttResponse {
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
}

interface Destination {
  tiploc: string
  description: string
  workingTime: string
  publicTime: string
}

interface Location {
  tiploc: string
  crs?: string
  description: string
  gbttBookedDeparture?: string
  origin: Origin[]
  destination: Destination[]
  isCall: boolean
  isPublicCall: boolean
  platform?: string
  line?: string
  gbttBookedArrival?: string
  gbttBookedArrivalNextDay?: boolean
  path?: string
  associations?: Association[]
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

  const response: RttResponse | RttError = await (
    await fetch(`https://api.rtt.io/api/v1/json/service/${serviceUid}/${year}/${month}/${day}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
        'User-Agent': 'railannouncements.co.uk',
        Server: 'cloudflare workers',
      },
    })
  ).json()

  if ('error' in response) {
    throw new Error(response.error)
  }

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

export async function getRttServiceHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
