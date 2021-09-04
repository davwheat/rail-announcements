import { getStationByCrs } from '@data/StationManipulators'
import AnnouncementSystem from './AnnouncementSystem'

export default abstract class TrainAnnouncementSystem extends AnnouncementSystem {
  /**
   * Checks if a station's audio file exists.
   *
   * @param stationCrs Station CRS code
   * @param type Optional pitch (defaults to `'high'`)
   * @returns Boolean indicating whether the station is available in the provided pitch
   */
  protected validateStationExists(stationCrs: string, type: 'high' | 'low' = 'high'): boolean {
    if (!this.AvailableStationNames[type].includes(stationCrs)) {
      const name = getStationByCrs(stationCrs).stationName
      console.error(`No audio file could be found for ${stationCrs} (${name}) in the pitch required for this announcement (${type})!`)

      alert(
        `Unfortunately, we don't have the recording for ${name} in the needed type (type: ${type}). If you can record this, please do so, then create an issue or PR on GitHub!`,
      )

      return false
    }
    return true
  }

  abstract readonly AvailableStationNames: { high: string[]; low: string[] }
}
