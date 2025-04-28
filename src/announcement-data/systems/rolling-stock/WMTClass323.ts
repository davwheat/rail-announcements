import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'

interface IApproachingStationAnnouncementOptions {
  stationCode: string
  terminatesHere: boolean
}

interface INextStationAnnouncementOptions {
  stationCode: string
}

interface IThisIsAnnouncementOptions {
  stationCode: string
}

interface IWelcomeAnnouncementOptions {
  terminatesAtCode: string
  readAllStations: boolean
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  welcome: [
    {
      name: 'Reddich to Four Oaks',
      state: {
        terminatesAtCode: 'FOK',
        readAllStations: true,
        callingAtCodes: [
          'ALV',
          'BTG',
          'LOB',
          'NFD',
          'KNN',
          'BRV',
          'SLY',
          'UNI',
          'FWY',
          'BHM',
          'DUD',
          'AST',
          'GVH',
          'ERD',
          'CRD',
          'WYL',
          'SUT',
        ].map(crsToStationItemMapper),
      },
    },
  ],
}

export default class WMTClass172 extends TrainAnnouncementSystem {
  readonly NAME = 'West Midlands Trains Class 323 - Julie Berry'
  readonly ID = 'WMT_CLASS_323_V1'
  readonly FILE_PREFIX = 'WMT/323'
  readonly SYSTEM_TYPE = 'train'

  private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('we are now approaching')
    files.push({ id: `stations.${options.stationCode}`, opts: { delayStart: 200 } })

    if (options.terminatesHere) {
      files.push('our final destination where this train terminates')
    }

    files.push({ id: 'please mind the gap', opts: { delayStart: 500 } })

    await this.playAudioFiles(files, download)
  }

  private async playNextStationAnnouncement(options: INextStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('the next station is')
    files.push({ id: `stations.${options.stationCode}`, opts: { delayStart: 200 } })

    await this.playAudioFiles(files, download)
  }

  private async playWelcomeAnnouncement(options: IWelcomeAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('welcome aboard this service to')
    files.push({ id: `stations.${options.terminatesAtCode}`, opts: { delayStart: 200 } })

    if (options.readAllStations) {
      files.push({ id: 'we will be calling at', opts: { delayStart: 200 } })
      files.push(
        ...this.pluraliseAudio(options.callingAtCodes.map(stop => `stations.${stop.crsCode}`).concat(`stations.${options.terminatesAtCode}`), {
          beforeAndDelay: 75,
        }),
      )
    } else {
      files.push({ id: 'the next station is', opts: { delayStart: 200 } })

      if (options.callingAtCodes.length > 0) {
        files.push({ id: `stations.${options.callingAtCodes[0].crsCode}`, opts: { delayStart: 200 } })
      } else {
        files.push({ id: `stations.${options.terminatesAtCode}`, opts: { delayStart: 200 } })
      }
    }

    await this.playAudioFiles(files, download)
  }

  private async playThisIsAnnouncement(options: IThisIsAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('this is')
    files.push({ id: `stations.${options.stationCode}`, opts: { delayStart: 200 } })
    files.push('please mind the gap')

    await this.playAudioFiles(files, download)
  }

  private RealAvailableStationNames = [
    'ALV',
    'AST',
    'BHM',
    'BKT',
    'BMV',
    'BRV',
    'BTG',
    'BUL',
    'CRD',
    'DUD',
    'ERD',
    'FOK',
    'FWY',
    'GVH',
    'KNN',
    'LIC',
    'LOB',
    'LTV',
    'NFD',
    'RDC',
    'SEN',
    'SLY',
    'SUT',
    'UNI',
    'WYL',
  ]

  readonly AvailableStationNames = {
    high: this.RealAvailableStationNames,
    low: this.RealAvailableStationNames,
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab<string>> = {
    approachingStation: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      defaultState: {
        stationCode: this.RealAvailableStationNames[0],
        terminatesHere: false,
      },
      props: {
        playHandler: this.playApproachingStationAnnouncement.bind(this),
        options: {
          stationCode: {
            name: 'Next station',
            default: this.RealAvailableStationNames[0],
            options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
            type: 'select',
          },
          terminatesHere: {
            name: 'Terminates here?',
            type: 'boolean',
            default: false,
          },
        },
      },
    } as CustomAnnouncementTab<keyof IApproachingStationAnnouncementOptions>,
    nextStation: {
      name: 'Next station',
      component: CustomAnnouncementPane,
      defaultState: {
        stationCode: this.RealAvailableStationNames[0],
      },
      props: {
        playHandler: this.playNextStationAnnouncement.bind(this),
        options: {
          stationCode: {
            name: 'Next station',
            default: this.RealAvailableStationNames[0],
            options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
            type: 'select',
          },
        },
      },
    } as CustomAnnouncementTab<keyof INextStationAnnouncementOptions>,
    welcomeAboard: {
      name: 'Welcome aboard',
      component: CustomAnnouncementPane,
      defaultState: {
        terminatesAtCode: this.RealAvailableStationNames[0],
        readAllStations: true,
        callingAtCodes: [],
      },
      props: {
        playHandler: this.playWelcomeAnnouncement.bind(this),
        presets: announcementPresets.welcome,
        options: {
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.RealAvailableStationNames[0],
            options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
            type: 'select',
          },
          readAllStations: {
            name: 'Read all stations?',
            type: 'boolean',
            default: true,
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
    } as CustomAnnouncementTab<keyof IWelcomeAnnouncementOptions>,
    thisIs: {
      name: 'This is…',
      component: CustomAnnouncementPane,
      defaultState: {
        stationCode: this.RealAvailableStationNames[0],
        mindTheGap: false,
      },
      props: {
        playHandler: this.playThisIsAnnouncement.bind(this),
        options: {
          stationCode: {
            name: 'This station',
            default: this.RealAvailableStationNames[0],
            options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
            type: 'select',
          },
        },
      },
    } as CustomAnnouncementTab<keyof IThisIsAnnouncementOptions>,
  }
}
