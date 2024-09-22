import { CallingAtPoint } from '@components/CallingAtSelector'
import { RttResponse } from '../../functions/api/get-service-rtt'
import { stationItemCompleter } from '@helpers/crsToStationItemMapper'

import dayjs from 'dayjs'
import dayjsTz from 'dayjs/plugin/timezone'
import dayjsUtc from 'dayjs/plugin/utc'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

interface CallingAtPointWithRttDetail extends CallingAtPoint {
  rttPlatform: string | null
  arrLateness: number | null
  depLateness: number | null
}

const eligibleLocationsSymbol = Symbol('eligibleLocations')

export class RttUtils {
  static getCallingPoints(rttService: RttResponse, fromLocationIndex: number): CallingAtPointWithRttDetail[] {
    if (fromLocationIndex === rttService.locations.length - 1) return []

    return this.getEligibleLocationsInternal(rttService)
      .slice(fromLocationIndex + 1)
      .filter((l, i, arr) => {
        if (!l.isPublicCall || l.displayAs === 'CANCELLED_CALL' || l.displayAs === 'DESTINATION' || l.displayAs === 'TERMINATES') return false
        if (!l.crs) {
          console.warn(`Location ${l.tiploc} has no CRS code`)
          return false
        }
        // Ignore destination in calling points
        if (i === arr.length - 1 && l.destination.some(d => d.tiploc === l.tiploc)) return false
        return true
      })
      .map(l => {
        return {
          ...stationItemCompleter(l.crs!),
          rttPlatform: l.platform ?? null,
          arrLateness: l.realtimeGbttArrivalLateness ?? null,
          depLateness: l.realtimeGbttDepartureLateness ?? null,
        }
      })
  }

  static getEligibleLocations(rttService: RttResponse): CallingAtPointWithRttDetail[] {
    rttService[eligibleLocationsSymbol] ??= this.getEligibleLocationsInternal(rttService).map(l => ({
      ...stationItemCompleter(l.crs!),
      rttPlatform: l.platform ?? null,
      arrLateness: l.realtimeGbttArrivalLateness ?? null,
      depLateness: l.realtimeGbttDepartureLateness ?? null,
    }))

    return rttService[eligibleLocationsSymbol]
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
    if (!loc.gbttBookedDeparture) {
      throw new Error(`Location ${loc.tiploc} has no scheduled departure time`)
    }

    const date = dayjs
      .tz(rttService.runDate, 'Europe/London')
      .set('hour', parseInt(loc.gbttBookedDeparture.substring(0, 2)))
      .set('minute', parseInt(loc.gbttBookedDeparture.substring(2, 4)))
      .set('second', 0)
      .set('millisecond', 0)
      .add(loc.gbttBookedDepartureNextDay ? 1 : 0, 'day')

    return date
  }

  static getScheduledArrivalTime(rttService: RttResponse, locationIndex: number): dayjs.Dayjs {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (!loc.gbttBookedArrival) {
      throw new Error(`Location ${loc.tiploc} has no scheduled arrival time`)
    }

    const date = dayjs
      .tz(rttService.runDate, 'Europe/London')
      .set('hour', parseInt(loc.gbttBookedArrival.substring(0, 2)))
      .set('minute', parseInt(loc.gbttBookedArrival.substring(2, 4)))
      .set('second', 0)
      .set('millisecond', 0)
      .add(loc.gbttBookedArrivalNextDay ? 1 : 0, 'day')

    return date
  }

  static getRealtimeDepartureTime(rttService: RttResponse, locationIndex: number): dayjs.Dayjs {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (!loc.realtimeActivated) {
      return this.getScheduledDepartureTime(rttService, locationIndex)
    }
    if (!loc.realtimeDeparture) {
      throw new Error(`Location ${loc.tiploc} has no realtime departure time`)
    }

    const date = dayjs
      .tz(rttService.runDate, 'Europe/London')
      .set('hour', parseInt(loc.realtimeDeparture.substring(0, 2)))
      .set('minute', parseInt(loc.realtimeDeparture.substring(2, 4)))
      .set('second', 0)
      .set('millisecond', 0)
      .add(loc.realtimeDepartureNextDay ? 1 : 0, 'day')

    return date
  }

  static getRealtimeArrivalTime(rttService: RttResponse, locationIndex: number): dayjs.Dayjs {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (!loc.realtimeActivated) {
      return this.getScheduledArrivalTime(rttService, locationIndex)
    }
    if (!loc.realtimeArrival) {
      throw new Error(`Location ${loc.tiploc} has no realtime arrival time`)
    }

    const date = dayjs
      .tz(rttService.runDate, 'Europe/London')
      .set('hour', parseInt(loc.realtimeArrival.substring(0, 2)))
      .set('minute', parseInt(loc.realtimeArrival.substring(2, 4)))
      .set('second', 0)
      .set('millisecond', 0)
      .add(loc.realtimeArrivalNextDay ? 1 : 0, 'day')

    return date
  }

  static getIsDelayedDeparture(rttService: RttResponse, locationIndex: number): boolean {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (!loc.realtimeActivated) {
      return false
    }

    const minsDiff =
      loc.realtimeGbttDepartureLateness ??
      this.getRealtimeDepartureTime(rttService, locationIndex).diff(this.getScheduledDepartureTime(rttService, locationIndex), 'minutes')

    return minsDiff >= 4
  }

  static getIsDelayedArrival(rttService: RttResponse, locationIndex: number): boolean {
    const loc = this.getEligibleLocationsInternal(rttService)[locationIndex]
    if (!loc.realtimeActivated) {
      return false
    }

    const minsDiff =
      loc.realtimeGbttArrivalLateness ??
      this.getScheduledArrivalTime(rttService, locationIndex).diff(this.getRealtimeArrivalTime(rttService, locationIndex), 'minutes')

    return minsDiff >= 4
  }
}
