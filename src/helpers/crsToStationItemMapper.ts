import { CallingAtPoint } from '@components/CallingAtSelector'
import { getStationByCrs } from '@data/StationManipulators'
import { nanoid } from 'nanoid'

export default function crsToStationItemMapper(crs: string): CallingAtPoint {
  return {
    crsCode: crs,
    name: getStationByCrs(crs)?.stationName ?? null,
    randomId: nanoid(),
  }
}

export function stationItemCompleter(point: string | (Partial<CallingAtPoint> & { crsCode: string })): CallingAtPoint {
  const p = typeof point === 'string' ? { crsCode: point } : point

  return {
    crsCode: p.crsCode,
    name: p.name ?? getStationByCrs(p.crsCode)?.stationName ?? null,
    shortPlatform: p.shortPlatform ?? '',
    requestStop: p.requestStop ?? false,
    splitType: p.splitType ?? 'none',
    splitCallingPoints: p.splitCallingPoints ?? [],
    splitForm: p.splitForm ?? '',
    randomId: nanoid(),
  }
}
