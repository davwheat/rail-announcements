import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane from '@components/PanelPanes/CustomAnnouncementPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab, OptionsExplanation } from './AnnouncementSystem'
import TrainAnnouncementSystem from './TrainAnnouncementSystem'

interface IApproachingStationAnnouncementOptions {
  stationCode: string
  isAto: boolean
  terminatesHere: boolean
  nearbyPOIs: string[]
  changeFor: string[]
}
interface IStoppedAtStationAnnouncementOptions {
  thisStationCode: string
  terminatesAtCode: string
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
  mindTheGap: boolean
  nearbyPOIs: string[]
  changeFor: string[]
}

export default class ThameslinkClass700 extends TrainAnnouncementSystem {
  readonly NAME = 'Thameslink Class 700'
  readonly ID = 'TL_CLASS_700_V1'
  readonly FILE_PREFIX = 'TL/700'
  readonly SYSTEM_TYPE = 'train'

  private readonly NearbyPointsOfInterest = [{ title: "St. Paul's Cathedral", value: 'st pauls cathedral' }]

  private readonly OtherServicesAvailable = [{ title: 'Other NR services', value: 'other national rail services' }]

  private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions): Promise<void> {
    const files: AudioItem[] = []

    if (options.terminatesHere) {
      if (!this.validateStationExists(options.stationCode, 'high')) return

      files.push(
        'we will shortly be arriving at',
        `stations.high.${options.stationCode}`,
        'our final destination',
        'thank you for travelling with us please make sure you take all your personal belongings with you when you leave the train',
      )
    } else {
      if (!this.validateStationExists(options.stationCode, 'low')) return

      files.push('we will shortly be arriving at', `stations.low.${options.stationCode}`)
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

  private async playStoppedAtStationAnnouncement(options: IStoppedAtStationAnnouncementOptions): Promise<void> {
    const { thisStationCode, terminatesAtCode, callingAtCodes } = options

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
    } else if (callingAtCodes.length === 0) {
      if (!this.validateStationExists(terminatesAtCode, 'high')) return

      files.push({ id: 'we will be calling at', opts: { delayStart: 3500 } }, `stations.high.${terminatesAtCode}`, `our final destination`)
    } else {
      if (!this.validateStationExists(terminatesAtCode, 'low')) return

      files.push({ id: 'this train terminates at', opts: { delayStart: 3500 } }, `stations.low.${terminatesAtCode}`)

      files.push({ id: 'we will be calling at', opts: { delayStart: 1000 } })

      if (callingAtCodes.some(({ crsCode }) => !this.validateStationExists(crsCode, 'high'))) return
      if (!this.validateStationExists(terminatesAtCode, 'low')) return

      files.push(...this.pluraliseAudio(...callingAtCodes.map(({ crsCode }) => `stations.high.${crsCode}`), `stations.low.${terminatesAtCode}`))
    }

    await this.playAudioFiles(files)
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

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab> = {
    approachingStation: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      playHandler: this.playApproachingStationAnnouncement.bind(this),
      options: {
        stationCode: {
          name: 'Next station',
          default: this.AvailableStationNames.low[0],
          options: AllStationsTitleValueMap.filter(s => this.AvailableStationNames.low.includes(s.value)),
          type: 'select',
        },
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
        changeFor: {
          name: 'Change for...',
          type: 'multiselect',
          options: this.OtherServicesAvailable,
          default: [],
        },
        nearbyPOIs: {
          name: 'Nearby POIs',
          type: 'multiselect',
          options: this.NearbyPointsOfInterest,
          default: [],
        },
      },
    },
    stoppedAtStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      playHandler: this.playStoppedAtStationAnnouncement.bind(this),
      options: {
        thisStationCode: {
          name: 'This station',
          default: this.AvailableStationNames.low[0],
          options: AllStationsTitleValueMap.filter(s => this.AvailableStationNames.low.includes(s.value)),
          type: 'select',
        },
        terminatesAtCode: {
          name: 'Terminates at',
          default: this.AvailableStationNames.low[0],
          options: AllStationsTitleValueMap.filter(s => this.AvailableStationNames.low.includes(s.value)),
          type: 'select',
        },
        callingAtCodes: {
          name: '',
          type: 'custom',
          component: CallingAtSelector,
          props: {
            availableStations: this.AvailableStationNames.high,
          },
          default: [],
        },
        mindTheGap: {
          name: 'Mind the gap?',
          default: false,
          type: 'boolean',
        },
        // changeFor: {
        //   name: 'Change for...',
        //   type: 'multiselect',
        //   options: this.OtherServicesAvailable,
        //   default: [],
        // },
        // nearbyPOIs: {
        //   name: 'Nearby POIs',
        //   type: 'multiselect',
        //   options: this.NearbyPointsOfInterest,
        //   default: [],
        // },
      },
    },
  }
}
