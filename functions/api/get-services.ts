import { PagesFunction } from '@cloudflare/workers-types'
export type {
  AssociatedServiceDetail,
  AssociatedServiceLocation,
  Association,
  EndPointLocation,
  StaffServicesResponse,
  TimingLocation,
  TrainService,
} from './get-services-types'
export { AssociationCategory } from './get-services-types'
import { AssociationCategory } from './get-services-types'
import type {
  AssociatedServiceDetail,
  AssociatedServiceLocation,
  Association,
  StaffServicesResponse,
  TimingLocation,
  TrainService,
} from './get-services-types'

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

async function getServiceByRid(apiKey: string, rid: string, followAssociations: boolean = false): Promise<AssociatedServiceDetail | undefined> {
  const cache = await caches.open('associated-service')
  // const url = `https://national-rail-api.davwheat.dev/service/${rid}`
  const url = `https://api1.raildata.org.uk/1010-query-services-and-service-details1_0/LDBSVWS/api/20220120/GetServiceDetailsByRID/${encodeURIComponent(rid)}`

  const cachedResponse = await cache.match(url, { ignoreMethod: true })
  if (cachedResponse) {
    console.log(`Associated service cache hit (${rid})`)
    return cachedResponse.json()
  }

  const response = await fetch(url, {
    headers: {
      'x-apikey': apiKey,
    },
  })
  if (!response.ok) {
    console.error(`RDM API error: ${response.status} ${response.statusText}`)
    return undefined
  }

  let json: AssociatedServiceDetail = await response.json()

  if (followAssociations) {
    await processAssociatedService(apiKey, json)
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

  // Perform some transformations to the data to match Huxley's output
  if (json.locations) {
    json.locations = json.locations.map((location: AssociatedServiceLocation) => {
      if (location.departureTypeSpecified) {
        switch (location.departureType as any as string) {
          case 'Forecast':
            location.departureType = 0
            break
          case 'Actual':
            location.departureType = 1
            break
          case 'NoLog':
            location.departureType = 2
            break
          case 'Delayed':
            location.departureType = 3
            break
        }
      }
      if (location.arrivalTypeSpecified) {
        switch (location.arrivalType as any as string) {
          case 'Forecast':
            location.arrivalType = 0
            break
          case 'Actual':
            location.arrivalType = 1
            break
          case 'NoLog':
            location.arrivalType = 2
            break
          case 'Delayed':
            location.arrivalType = 3
            break
        }
      }

      if (location.delayReason) {
        location.delayReason.value = (location.delayReason as any).Value
        delete (location.delayReason as any).Value
      }

      if (location.cancelReason) {
        location.cancelReason.value = (location.cancelReason as any).Value
        delete (location.cancelReason as any).Value
      }

      if (location.associations) {
        location.associations = location.associations.map((association: Association) => {
          switch (association.category as any as string) {
            case 'next':
            case 'LinkTo':
              association.category = AssociationCategory.LinkedTo
              break

            case 'previous':
            case 'LinkFrom':
              association.category = AssociationCategory.LinkedFrom
              break

            case 'join':
              association.category = AssociationCategory.Join
              break

            case 'divide':
              association.category = AssociationCategory.Divide
              break
          }

          return association
        })
      }

      // Split into array with groups of two chars
      if (location.activities) {
        location.activities = (location.activities as any as string | undefined)?.match(/.{2}/g) || []
      }

      return location
    })

    if (json.delayReason) {
      json.delayReason.value = (json.delayReason as any).Value
      delete (json.delayReason as any).Value
    }
    if (json.cancelReason) {
      json.cancelReason.value = (json.cancelReason as any).Value
      delete (json.cancelReason as any).Value
    }
  }

  return json
}

async function processService(env: Env, service: TrainService): Promise<void> {
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
        association.service = await getServiceByRid(env.RDM_LDBSVWS_GetServiceDetailsByRID_API_KEY, association.rid)
      } else if (
        association.category === AssociationCategory.LinkedTo &&
        (association.trainid === '0B00' || (service.trainid === '0B00' && association.trainid !== '0B00'))
      ) {
        // Fine. Or continuation bus services, and include future changes to trains again
        association.service = await getServiceByRid(env.RDM_LDBSVWS_GetServiceDetailsByRID_API_KEY, association.rid, true)
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

async function processAssociatedService(apiKey: string, service: AssociatedServiceDetail): Promise<void> {
  for (const l in service.locations) {
    const location: TimingLocation = service.locations[l]

    for (const a in location.associations) {
      const association: Association = location.associations[a as any]

      if (association.category === AssociationCategory.Divide) {
        // Divides only
        association.service = await getServiceByRid(apiKey, association.rid)
      } else if (
        association.category === AssociationCategory.LinkedTo &&
        (association.trainid === '0B00' || (service.trainid === '0B00' && association.trainid !== '0B00'))
      ) {
        // Fine. Or continuation bus services, and include future changes to trains again
        association.service = await getServiceByRid(apiKey, association.rid, true)
      }
    }
  }
}

export const onRequest: PagesFunction<Env> = async context => {
  const { request } = context
  const { searchParams } = new URL(request.url)

  try {
    const station = searchParams.get('station')
    const maxServices = searchParams.get('maxServices') || '20'
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

    // const response = await fetch(`https://national-rail-api.davwheat.dev/staffdepartures/${station}/${maxServices}?${params}`, {
    //   cf: {
    //     cacheTtl: 10,
    //     cacheEverything: true,
    //   },
    // })
    //
    // if (!response.ok) {
    //   return Response.json({ error: true, message: 'Upstream fetch error' })
    // }
    //
    // if (response.headers.get('CF-Cache-Status') === 'HIT') {
    //   console.log(`Departure board cache hit (${station})`)
    // }
    //
    // const json: StaffServicesResponse = await response.json()

    const json = await getBoardFromRdm(context.env.RDM_LDBSVWS_GetDepBoardWithDetails_API_KEY, station, maxServices, timeOffset, timeWindow)
    if (!json) {
      return Response.json({ error: true, message: 'Upstream fetch error' })
    }

    await Promise.all(json.trainServices?.map(service => processService(context.env, service)) ?? [])

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

async function getBoardFromRdm(
  apiKey: string,
  crs: string,
  maxServices: string,
  timeOffset: string,
  timeWindow: string,
): Promise<StaffServicesResponse | undefined> {
  try {
    const offsetMs = parseInt(timeOffset) * 1000 * 60

    // yyyyMMddTHHmmss in Europe/London local time
    const now = new Date(Date.now() + (isNaN(offsetMs) ? 0 : offsetMs))
    const londonTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now)

    const nowStr = `${londonTime.find(p => p.type === 'year')?.value}${londonTime.find(p => p.type === 'month')?.value}${londonTime.find(p => p.type === 'day')?.value}T${londonTime.find(p => p.type === 'hour')?.value}${londonTime.find(p => p.type === 'minute')?.value}${londonTime.find(p => p.type === 'second')?.value}`
    const url = new URL(
      `https://api1.raildata.org.uk/1010-live-departure-board---staff-version1_0/LDBSVWS/api/20220120/GetDepBoardWithDetails/${encodeURIComponent(crs)}/${encodeURIComponent(nowStr)}`,
    )
    url.searchParams.set('numRows', maxServices.toString())
    url.searchParams.set('timeWindow', timeWindow.toString())
    url.searchParams.set('services', 'PBS')
    url.searchParams.set('getNonPassengerServices', 'false')

    const resp = await fetch(url, {
      cf: {
        cacheTtl: 10,
        cacheEverything: true,
      },
      headers: {
        'x-apikey': apiKey,
      },
    })
    if (!resp.ok) {
      console.error(`RDM API error: ${resp.status} ${resp.statusText}`)
      return undefined
    }
    const rdmData = (await resp.json()) as StaffServicesResponse

    // Perform some transformations to the data to match Huxley's output
    if (rdmData.trainServices) {
      rdmData.trainServices = rdmData.trainServices.map((service: TrainService) => {
        if (service.subsequentLocations) {
          service.subsequentLocations = service.subsequentLocations.map((location: TimingLocation) => {
            if (location.departureTypeSpecified) {
              switch (location.departureType as any as string) {
                case 'Forecast':
                  location.departureType = 0
                  break
                case 'Actual':
                  location.departureType = 1
                  break
                case 'NoLog':
                  location.departureType = 2
                  break
                case 'Delayed':
                  location.departureType = 3
                  break
              }
            }
            if (location.arrivalTypeSpecified) {
              switch (location.arrivalType as any as string) {
                case 'Forecast':
                  location.arrivalType = 0
                  break
                case 'Actual':
                  location.arrivalType = 1
                  break
                case 'NoLog':
                  location.arrivalType = 2
                  break
                case 'Delayed':
                  location.arrivalType = 3
                  break
              }
            }

            if ((location as any).delayReason) {
              ;(location as any).delayReason.value = (location as any).delayReason.Value
              delete (location as any).delayReason.Value
            }

            if ((location as any).cancelReason) {
              ;(location as any).cancelReason.value = (location as any).cancelReason.Value
              delete (location as any).cancelReason.Value
            }

            if (location.associations) {
              location.associations = location.associations.map((association: Association) => {
                switch (association.category as any as string) {
                  case 'next':
                  case 'LinkTo':
                    association.category = AssociationCategory.LinkedTo
                    break

                  case 'previous':
                  case 'LinkFrom':
                    association.category = AssociationCategory.LinkedFrom
                    break

                  case 'join':
                    association.category = AssociationCategory.Join
                    break

                  case 'divide':
                    association.category = AssociationCategory.Divide
                    break
                }

                return association
              })
            }

            return location
          })
        }

        if (service.delayReason) {
          service.delayReason.value = (service.delayReason as any).Value
          delete (service.delayReason as any).Value
        }

        if (service.cancelReason) {
          service.cancelReason.value = (service.cancelReason as any).Value
          delete (service.cancelReason as any).Value
        }

        if (service.activities) {
          // Split into array with groups of two chars
          service.activities = (service.activities as any as string | undefined)?.match(/.{2}/g) || []
        }

        return service
      })
    }

    return rdmData
  } catch (e) {
    console.error(e)
    return undefined
  }
}
