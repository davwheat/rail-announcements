import { getStationByCrs } from '@data/StationManipulators'
import AnnouncementSystem, { AudioItem, OptionsExplanation } from './AnnouncementSystem'

interface IAnyOptions {
  [key: string]: any
}

export default abstract class TrainAnnouncementSystem extends AnnouncementSystem {
  abstract readonly approachingStationAnnouncementOptions: Record<string, OptionsExplanation>
  abstract playApproachingStationAnnouncement(stationCode: string, options: IAnyOptions): Promise<void>

  abstract readonly stoppedAtStationAnnouncementOptions: Record<string, OptionsExplanation>
  abstract playStoppedAtStationAnnouncement(
    thisStationCode: string,
    terminatesAtCode: string,
    callingAtCodes: string[],
    options: IAnyOptions,
  ): Promise<void>

  /**
   * ----------------------------------------------------------------------------------------------------
   */

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

  /**
   * Takes an array of audio files, and adds an `and` audio file where needed.
   *
   * @example
   * pluraliseAudioItems(['a', 'b', 'c']) // returns ['a', 'b', 'and', 'c']
   *
   * @example
   * pluraliseAudioItems(['a']) // returns ['a']
   *
   * @example
   * pluraliseAudioItems(['a', 'b']) // returns ['a', 'and', 'b']
   *
   * @param items Array of audio files
   * @returns Pluralised array of audio files
   */
  protected pluraliseAudio(...items: AudioItem[]): AudioItem[] {
    if (items.length > 1) {
      items.splice(items.length - 1, 0, 'and')
      return items
    }

    return items
  }

  /**
   * ----------------------------------------------------------------------------------------------------
   */

  abstract readonly AvailableStationNames: { high: string[]; low: string[] }
}
