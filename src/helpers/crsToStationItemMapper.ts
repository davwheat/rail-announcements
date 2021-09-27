import { getStationByCrs } from '@data/StationManipulators'
import { nanoid } from 'nanoid'

export default function crsToStationItemMapper(crs: string): { crsCode: string; name: string; randomId: string } {
  return {
    crsCode: crs,
    name: getStationByCrs(crs).stationName,
    randomId: nanoid(),
  }
}
