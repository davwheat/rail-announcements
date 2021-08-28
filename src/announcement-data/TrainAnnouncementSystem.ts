import AnnouncementSystem from './AnnouncementSystem'

interface IAnyOptions {
  [key: string]: any
}

interface IOptionsExplanation {
  name: string
  type: 'boolean' | 'select' | 'multiselect' | 'time' | 'number'
}

export type OptionsExplanation = IOptionsExplanation & (IMultiselectOptions | ISelectOptions | IBooleanOptions | INumberOptions | ITimeOptions)

interface IMultiselectOptions {
  type: 'boolean' | 'select' | 'multiselect' | 'time' | 'number'
  default: string[]
  options: { title: string; value: string }[]
}
interface ISelectOptions {
  type: 'boolean' | 'select' | 'multiselect' | 'time' | 'number'
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

  abstract readonly approachingStationAnnouncementOptions: Record<
    keyof Parameters<typeof this.playApproachingStationAnnouncement>[1],
    IOptionsExplanation
  >

  abstract readonly AvailableStationNames: { high: string[]; low: string[] }
}
