import { getStationByCrs } from '@data/StationManipulators'
import { nanoid } from 'nanoid'

export default function crsToStationItemMapper(crs: string): { crsCode: string; name: string | null; randomId: string } {
  return {
    crsCode: crs,
    name: getStationByCrs(crs)?.stationName ?? null,
    randomId: nanoid(),
  }
}
