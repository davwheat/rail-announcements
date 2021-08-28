import { AudioItem } from './AnnouncementSystem'
import TrainAnnouncementSystem, { OptionsExplanation } from './TrainAnnouncementSystem'

interface IApproachingStationAnnouncementOptions {
  mindTheGap: boolean
}
interface IStoppedAtStationAnnouncementOptions {}

export default class SouthernClass377 extends TrainAnnouncementSystem {
  readonly NAME = 'Southern Class 377'
  readonly ID = 'SN_CLASS_377_V1'
  readonly FILE_PREFIX = 'SN/377'
  readonly SYSTEM_TYPE = 'train'

  async playApproachingStationAnnouncement(stationCode: string, options: IApproachingStationAnnouncementOptions): Promise<void> {
    const files: AudioItem[] = []

    files.push('bing bong')
    files.push('we are now approaching', `stations.${stationCode}`)

    if (options.mindTheGap) {
      files.push('please mind the gap between the train and the platform')
    }

    await this.playAudioFiles(files)
  }

  readonly approachingStationAnnouncementOptions: Record<keyof IApproachingStationAnnouncementOptions, OptionsExplanation> = {
    mindTheGap: {
      name: 'Mind the gap?',
      type: 'boolean',
      default: true,
    },
  }

  async playStoppedAtStationAnnouncement(
    thisStationCode: string,
    terminatesAtCode: string,
    callingAtCodes: string[],
    options: IStoppedAtStationAnnouncementOptions,
  ): Promise<void> {
    const files: AudioItem[] = []
    files.push('bing bong')
    files.push('this is', `stations.${thisStationCode}`, 'this train is the southern service to', `stations.${terminatesAtCode}`)

    if (callingAtCodes.some(code => !this.validateStationExists(code))) return
    if (!this.validateStationExists(terminatesAtCode)) return

    const remainingStops = [...callingAtCodes.map(crsCode => `stations.${crsCode}`), `stations.${terminatesAtCode}`]

    files.push('calling at')
    files.push(...this.pluraliseAudio(...remainingStops))
    files.push('the next station is', remainingStops[0])

    await this.playAudioFiles(files)
  }

  readonly stoppedAtStationAnnouncementOptions: Record<keyof IStoppedAtStationAnnouncementOptions, OptionsExplanation> = {}

  private RealAvailableStationNames = [
    'ANG',
    'BEX',
    'BRK',
    'CBR',
    'CLJ',
    'DUR',
    'EBN',
    'ECR',
    'FMR',
    'GBS',
    'GLY',
    'GTW',
    'HGS',
    'HHE',
    'HMD',
    'HOV',
    'HSK',
    'LAC',
    'LIT',
    'LWS',
    'MCB',
    'PLD',
    'PLG',
    'PRP',
    'SSE',
    'VIC',
    'WRH',
    'WVF',
    'WWO',
  ]

  readonly AvailableStationNames = {
    high: this.RealAvailableStationNames,
    low: this.RealAvailableStationNames,
  }
}
