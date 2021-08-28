import AnnouncementSystem from './AnnouncementSystem'

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
}
