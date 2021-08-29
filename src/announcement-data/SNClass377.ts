import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane from '@components/PanelPanes/CustomAnnouncementPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from './AnnouncementSystem'
import TrainAnnouncementSystem from './TrainAnnouncementSystem'

interface IApproachingStationAnnouncementOptions {
  stationCode: string
  mindTheGap: boolean
}

interface IStoppedAtStationAnnouncementOptions {
  thisStationCode: string
  terminatesAtCode: string
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
}

interface IDepartingStationAnnouncementOptions {
  terminatesAtCode: string
  nextStationCode: string
}

export default class SouthernClass377 extends TrainAnnouncementSystem {
  readonly NAME = 'Southern Class 377'
  readonly ID = 'SN_CLASS_377_V1'
  readonly FILE_PREFIX = 'SN/377'
  readonly SYSTEM_TYPE = 'train'

  private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions): Promise<void> {
    const files: AudioItem[] = []

    files.push('bing bong')
    files.push('we are now approaching', `stations.${options.stationCode}`)

    if (options.mindTheGap) {
      files.push('please mind the gap between the train and the platform')
    }

    await this.playAudioFiles(files)
  }

  private async playStoppedAtStationAnnouncement(options: IStoppedAtStationAnnouncementOptions): Promise<void> {
    const { callingAtCodes: _callingAt, terminatesAtCode, thisStationCode } = options

    const callingAtCodes = _callingAt.map(stop => stop.crsCode)

    const files: AudioItem[] = []
    files.push('bing bong')
    files.push('this is', `stations.${thisStationCode}`, 'this train is the southern service to', `stations.${terminatesAtCode}`)

    const remainingStops = [...callingAtCodes.map(crsCode => `stations.${crsCode}`), `stations.${terminatesAtCode}`]

    if (callingAtCodes.some(code => !this.validateStationExists(code))) return
    if (!this.validateStationExists(terminatesAtCode)) return

    if (remainingStops.length > 1) {
      // We are not at the termination point.
      files.push('calling at')
      files.push(...this.pluraliseAudio(...remainingStops))
      files.push('the next station is', remainingStops[0])
    }

    await this.playAudioFiles(files)
  }

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

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab> = {
    approachingStation: {
      name: 'Approaching station',
      playHandler: this.playApproachingStationAnnouncement.bind(this),
      component: CustomAnnouncementPane,
      options: {
        stationCode: {
          name: 'Next station',
          default: this.RealAvailableStationNames[0],
          options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
          type: 'select',
        },
        mindTheGap: {
          name: 'Mind the gap?',
          type: 'boolean',
          default: true,
        },
      },
    },
    stoppedAtStation: {
      name: 'Stopped at station',
      playHandler: this.playStoppedAtStationAnnouncement.bind(this),
      component: CustomAnnouncementPane,
      options: {
        thisStationCode: {
          name: 'This station',
          default: this.RealAvailableStationNames[0],
          options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
          type: 'select',
        },
        terminatesAtCode: {
          name: 'Terminates at',
          default: this.RealAvailableStationNames[0],
          options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
          type: 'select',
        },
        callingAtCodes: {
          name: '',
          type: 'custom',
          component: CallingAtSelector,
          props: {
            availableStations: this.RealAvailableStationNames,
          },
          default: [],
        },
      },
    },
    departingStation: {
      name: 'Departing station',
      playHandler: this.playDepartingStationAnnouncement.bind(this),
      component: CustomAnnouncementPane,
      options: {
        terminatesAtCode: {
          name: 'Terminates at',
          default: this.RealAvailableStationNames[0],
          options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
          type: 'select',
        },
        nextStationCode: {
          name: 'Next station',
          default: this.RealAvailableStationNames[0],
          options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
          type: 'select',
        },
      },
    },
  }

  private async playDepartingStationAnnouncement(options: IDepartingStationAnnouncementOptions): Promise<void> {
    const files: AudioItem[] = []
    files.push('bing bong')

    files.push(
      'this train is the southern service to',
      `stations.${options.terminatesAtCode}`,
      'the next station is',
      `stations.${options.nextStationCode}`,
    )

    await this.playAudioFiles(files)
  }
}
