import { CallingAtPoint } from '@components/CallingAtSelector'
import { RttResponse, RttLocation } from '../api-types/get-service-rtt-types'
import crsToStationItemMapper, { stationItemCompleter } from '@helpers/crsToStationItemMapper'
import { isShortPlatform } from '@data/liveTrains/shortPlatforms'
import type { TrainService } from '../api-types/get-services-types'

import dayjs from 'dayjs'
import dayjsTz from 'dayjs/plugin/timezone'
import dayjsUtc from 'dayjs/plugin/utc'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

interface CallingAtPointWithRttDetail extends CallingAtPoint {
  rttPlatform: string | null
  arrLateness: number | null
  depLateness: number | null
  cancelled: boolean
  divisionInfo?: string
}

const eligibleLocationsSymbol = Symbol('eligibleLocations')

function divisionInfoString(loc: RttLocation): string | undefined {
  if (!loc.divisions?.length) return undefined
  return loc.divisions
    .map(div => {
      const dest = div.callingPoints[div.callingPoints.length - 1]
      if (!dest?.crs) return 'Divides here'
      const stn = crsToStationItemMapper(dest.crs)
      return `Divides for ${stn.name.replace(/ \(.*\)$/, '')}`
    })
    .join(', ')
}

function applyDivisions(point: CallingAtPointWithRttDetail, loc: RttLocation): void {
  if (!loc.divisions?.length) return

  const div = loc.divisions[0]
  point.splitType = div.callingPoints.length > 0 ? 'splits' : 'splitTerminates'
  point.splitForm = `${div.position}.${div.vehicleCount ?? 1}`
  point.splitCallingPoints = div.callingPoints.filter(cp => cp.crs).map(cp => stationItemCompleter(cp.crs!))
  point.divisionInfo = divisionInfoString(loc)
}

export class RttUtils {
  static getCallingPoints(rttService: RttResponse, fromLocationIndex: number): CallingAtPointWithRttDetail[] {
    if (fromLocationIndex === rttService.locations.length - 1) return []

    const eligible = this.getEligibleLocationsInternal(rttService).slice(fromLocationIndex + 1)

    const callingLocs = eligible.filter((l, i, arr) => {
      if (!l.isPublicCall || l.displayAs === 'CANCELLED_CALL' || l.displayAs === 'DESTINATION' || l.displayAs === 'TERMINATES') return false
      if (!l.crs) {
        console.warn(`Location ${l.tiploc} has no CRS code`)
        return false
      }
      // Ignore destination in calling points
      if (i === arr.length - 1 && l.destination.some(d => d.tiploc === l.tiploc)) return false
      return true
    })

    return callingLocs.map((l, i) => {
      const point: CallingAtPointWithRttDetail = {
        ...stationItemCompleter(l.crs!),
        requestStop: l.requestStop ?? false,
        rttPlatform: l.platform ?? null,
        arrLateness: l.arrivalLateness ?? null,
        depLateness: l.departureLateness ?? null,
        cancelled: false,
      }

      // Look up short platform data from the static table
      if (l.platform && l.crs) {
        const mockTrain = {
          operatorCode: rttService.atocCode,
          length: l.passengerVehicleCount ?? null,
          origin: l.origin.map(o => ({ crs: o.crs ?? '' })),
          destination: l.destination.map(d => ({ crs: d.crs ?? '' })),
          subsequentLocations: callingLocs.slice(i + 1).map(sl => ({ crs: sl.crs ?? '' })),
        } as unknown as TrainService
        const shortPlatform = isShortPlatform(l.crs, l.platform, mockTrain)
        if (shortPlatform) point.shortPlatform = shortPlatform
      }

      applyDivisions(point, l)
      return point
    })
  }

  static getEligibleLocations(rttService: RttResponse): CallingAtPointWithRttDetail[] {
    ;(rttService as any)[eligibleLocationsSymbol] ??= this.getEligibleLocationsInternal(rttService).map(l => {
      const point: CallingAtPointWithRttDetail = {
        ...stationItemCompleter(l.crs!),
        requestStop: l.requestStop ?? false,
        rttPlatform: l.platform ?? null,
        arrLateness: l.arrivalLateness ?? null,
        depLateness: l.departureLateness ?? null,
        cancelled: l.displayAs === 'CANCELLED_CALL',
        divisionInfo: divisionInfoString(l),
      }
      return point
    })

    return (rttService as any)[eligibleLocationsSymbol]
  }

  private static getEligibleLocationsInternal(rttService: RttResponse) {
    return rttService.locations.filter(l => {
      if (!l.isPublicCall) return false
      if (!l.crs) {
        console.warn(`Location ${l.tiploc} has no CRS code`)
        return false
      }
      return true
    })
  }

  static getCancelledCallingPoints(rttService: RttResponse, fromLocationIndex: number): CallingAtPoint[] {
    if (fromLocationIndex === rttService.locations.length - 1) return []

    return this.getEligibleLocationsInternal(rttService)
      .slice(fromLocationIndex + 1)
      .filter(l => {
        if (!l.isPublicCall || l.displayAs !== 'CANCELLED_CALL') return false
        if (!l.crs) {
          console.warn(`Location ${l.tiploc} has no CRS code`)
          return false
        }
        return true
      })
      .map(l => l.crs!)
      .map(stationItemCompleter)
  }

  static getScheduledDepartureTime(rttService: RttResponse, locationIndex: number): dayjs.Dayjs {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (!loc.scheduledDeparture) {
      throw new Error(`Location ${loc.tiploc} has no scheduled departure time`)
    }
    return dayjs(loc.scheduledDeparture).tz('Europe/London')
  }

  static getScheduledArrivalTime(rttService: RttResponse, locationIndex: number): dayjs.Dayjs {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (!loc.scheduledArrival) {
      throw new Error(`Location ${loc.tiploc} has no scheduled arrival time`)
    }
    return dayjs(loc.scheduledArrival).tz('Europe/London')
  }

  static getRealtimeDepartureTime(rttService: RttResponse, locationIndex: number): dayjs.Dayjs {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (!loc.realtimeDeparture) {
      return this.getScheduledDepartureTime(rttService, locationIndex)
    }
    return dayjs(loc.realtimeDeparture).tz('Europe/London')
  }

  static getRealtimeArrivalTime(rttService: RttResponse, locationIndex: number): dayjs.Dayjs {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (!loc.realtimeArrival) {
      return this.getScheduledArrivalTime(rttService, locationIndex)
    }
    return dayjs(loc.realtimeArrival).tz('Europe/London')
  }

  static getIsDelayedDeparture(rttService: RttResponse, locationIndex: number): boolean {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (loc.departureLateness != null) return loc.departureLateness >= 4
    if (!loc.realtimeDeparture || !loc.scheduledDeparture) return false
    return dayjs(loc.realtimeDeparture).diff(dayjs(loc.scheduledDeparture), 'minutes') >= 4
  }

  static getIsDelayedArrival(rttService: RttResponse, locationIndex: number): boolean {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (loc.arrivalLateness != null) return loc.arrivalLateness >= 4
    if (!loc.realtimeArrival || !loc.scheduledArrival) return false
    return dayjs(loc.realtimeArrival).diff(dayjs(loc.scheduledArrival), 'minutes') >= 4
  }
}
