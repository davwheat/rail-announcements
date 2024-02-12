import { CallingAtPoint } from '@components/CallingAtSelector'
import { getStationByCrs } from '@data/StationManipulators'
import { nanoid } from 'nanoid'

export default function crsToStationItemMapper(crs: string): CallingAtPoint {
  const stn = getStationByCrs(crs)

  return {
    crsCode: crs,
    name: stn ? `${stn.stationName} (${crs})` : `Unknown (${crs})`,
    randomId: nanoid(),
  }
}

export function stationItemCompleter(point: string | (Partial<CallingAtPoint> & { crsCode: string })): CallingAtPoint {
  const p = typeof point === 'string' ? { crsCode: point } : point

  const stn = getStationByCrs(p.crsCode)

  return {
    crsCode: p.crsCode,
    name: stn ? `${stn.stationName} (${p.crsCode})` : `Unknown (${p.crsCode})`,
    shortPlatform: p.shortPlatform ?? '',
    requestStop: p.requestStop ?? false,
    splitType: p.splitType ?? 'none',
    splitCallingPoints: p.splitCallingPoints ?? [],
    splitForm: p.splitForm ?? '',
    randomId: nanoid(),
  }
}
