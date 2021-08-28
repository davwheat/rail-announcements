import { getStationByCrs } from '@data/StationManipulators'
import AnnouncementSystem, { AudioItem } from './AnnouncementSystem'

interface IAnyOptions {
  [key: string]: any
}

interface IOptionsExplanation {
  name: string
}

export type OptionsExplanation = IOptionsExplanation & (IMultiselectOptions | ISelectOptions | IBooleanOptions | INumberOptions | ITimeOptions)

interface IMultiselectOptions {
  type: 'multiselect'
  default: string[]
  options: { title: string; value: string }[]
}
interface ISelectOptions {
  type: 'select'
  default: string
  options: { title: string; value: string }[]
}
interface IBooleanOptions {
  type: 'boolean'
  default: boolean
}
interface ITimeOptions {
  type: 'time'
  default: `${string}:${string}`
}
interface INumberOptions {
  type: 'number'
  default: number
}

export default abstract class TrainAnnouncementSystem extends AnnouncementSystem {
  abstract playApproachingStationAnnouncement(stationCode: string, options: IAnyOptions): Promise<void>
  abstract readonly approachingStationAnnouncementOptions: Record<string, IOptionsExplanation>

  abstract playStoppedAtStationAnnouncement(
    thisStationCode: string,
    terminatesAtCode: string,
    callingAtCodes: string[],
    options: IAnyOptions,
  ): Promise<void>
  abstract readonly stoppedAtStationAnnouncementOptions: Record<string, IOptionsExplanation>

  abstract readonly AvailableStationNames: { high: string[]; low: string[] }

  protected validateStationExists(stationCrs: string, type: 'high' | 'low'): boolean {
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

  protected pluraliseAudio(...items: AudioItem[]): AudioItem[] {
    if (items.length > 1) {
      items.splice(items.length - 1, 0, 'and')
      return items
    }

    return items
  }
}
