import { AudioItem } from './AnnouncementSystem'
import TrainAnnouncementSystem, { OptionsExplanation } from './TrainAnnouncementSystem'

interface IApproachingStationAnnouncementOptions {
  isAto: boolean
  terminatesHere: boolean
  nearbyPOIs: string[]
  changeFor: string[]
}
interface IStoppedAtStationAnnouncementOptions {
  mindTheGap: boolean
  nearbyPOIs: string[]
  changeFor: string[]
}

export default class TLClass700 extends TrainAnnouncementSystem {
  readonly NAME = 'Thameslink Class 700'
  readonly ID = 'TL_CLASS_700_V1'
  readonly FILE_PREFIX = 'TL/700'
  readonly SYSTEM_TYPE = 'train'

  private readonly NearbyPointsOfInterest = [{ title: "St. Paul's Cathedral", value: 'st pauls cathedral' }]

  private readonly OtherServicesAvailable = [{ title: 'Other NR services', value: 'other national rail services' }]

  async playApproachingStationAnnouncement(stationCode: string, options: IApproachingStationAnnouncementOptions): Promise<void> {
    const files: AudioItem[] = []

    if (options.terminatesHere) {
      if (!this.validateStationExists(stationCode, 'high')) return

      files.push(
        'we will shortly be arriving at',
        `stations.high.${stationCode}`,
        'our final destination',
        'thank you for travelling with us please make sure you take all your personal belongings with you when you leave the train',
      )
    } else {
      if (!this.validateStationExists(stationCode, 'low')) return

      files.push('we will shortly be arriving at', `stations.low.${stationCode}`)
    }

    if (options.changeFor.length > 0) {
      files.push('change here for')
      files.push(...this.pluraliseAudio(...options.changeFor.map(poi => `other-services.${poi}`)))
    }

    if (options.nearbyPOIs.length > 0) {
      files.push('exit here for')
      files.push(...this.pluraliseAudio(...options.nearbyPOIs.map(poi => `POIs.${poi}`)))
    }

    if (options.isAto) {
      files.push('the doors will open automatically at the next station')
    }

    await this.playAudioFiles(files)
  }

  readonly approachingStationAnnouncementOptions: Record<keyof IApproachingStationAnnouncementOptions, OptionsExplanation> = {
    isAto: {
      name: 'Automatic train operation?',
      default: false,
      type: 'boolean',
    },
    terminatesHere: {
      name: 'Terminates here?',
      default: false,
      type: 'boolean',
    },
    nearbyPOIs: {
      name: 'Nearby POIs',
      type: 'multiselect',
      options: this.NearbyPointsOfInterest,
      default: [],
    },
    changeFor: {
      name: 'Change for...',
      type: 'multiselect',
      options: this.OtherServicesAvailable,
      default: [],
    },
  }

  async playStoppedAtStationAnnouncement(
    thisStationCode: string,
    terminatesAtCode: string,
    callingAtCodes: string[],
    options: IStoppedAtStationAnnouncementOptions,
  ): Promise<void> {
    const files: AudioItem[] = []

    if (options.mindTheGap) {
      files.push('please mind the gap between the train and the platform')
    }

    files.push('this station is', `stations.low.${thisStationCode}`)

    if (thisStationCode === terminatesAtCode) {
      files.push(
        { id: 'this train terminates here all change', opts: { delayStart: 150 } },
        'please ensure you take all personal belongings with you when leaving the train',
      )

      if (options.changeFor.length > 0) {
        files.push('change here for')
        files.push(...this.pluraliseAudio(...options.changeFor.map(poi => `other-services.${poi}`)))
      }

      if (options.nearbyPOIs.length > 0) {
        files.push('exit here for')
        files.push(...this.pluraliseAudio(...options.nearbyPOIs.map(poi => `POIs.${poi}`)))
      }
    } else if (callingAtCodes.length === 0) {
      if (!this.validateStationExists(terminatesAtCode, 'high')) return

      files.push({ id: 'we will be calling at', opts: { delayStart: 1000 } }, `stations.high.${terminatesAtCode}`, `our final destination`)
    } else {
      if (!this.validateStationExists(terminatesAtCode, 'low')) return

      files.push({ id: 'this train terminates at', opts: { delayStart: 1000 } }, `stations.low.${terminatesAtCode}`)

      files.push('we will be calling at')

      if (callingAtCodes.some(code => !this.validateStationExists(code, 'high'))) return
      if (!this.validateStationExists(terminatesAtCode, 'low')) return

      files.push(...this.pluraliseAudio(...callingAtCodes.map(crsCode => `stations.high.${crsCode}`), `stations.low.${terminatesAtCode}`))
    }

    await this.playAudioFiles(files)
  }

  readonly stoppedAtStationAnnouncementOptions: Record<keyof IStoppedAtStationAnnouncementOptions, OptionsExplanation> = {
    mindTheGap: {
      name: 'Mind the gap?',
      type: 'boolean',
      default: true,
    },
    nearbyPOIs: {
      name: 'Nearby POIs (terminating only)',
      type: 'multiselect',
      options: this.NearbyPointsOfInterest,
      default: [],
    },
    changeFor: {
      name: 'Change for (terminating only)',
      type: 'multiselect',
      options: this.OtherServicesAvailable,
      default: [],
    },
  }

  readonly AvailableStationNames = {
    high: [
      'BAB',
      'BDK',
      'BFR',
      'BTN',
      'BUG',
      'CTK',
      'ECR',
      'ELS',
      'FLT',
      'FPK',
      'GTW',
      'HHE',
      'HIT',
      'HLN',
      'HPD',
      'HSK',
      'LBG',
      'LEA',
      'LET',
      'LTN',
      'LUT',
      'MIL',
      'PRP',
      'RDT',
      'RYS',
      'SAC',
      'STP',
      'SVG',
      'TBG',
      'WVF',
      'ZFD',
    ],
    low: ['BDM', 'BFR', 'BTN', 'BUG', 'CBG', 'CTK', 'HSK', 'LUT', 'PRP', 'WVF'],
  }
}
