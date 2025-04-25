import CallingAtSelector, { CallingAtPoint } from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'

interface IApproachingStationAnnouncementOptions {
  stationCode: string
  shortPlatform: boolean
  finalStop: boolean
  play61016: boolean
}

interface IWelcomeAboardAnnouncementOptions {
  terminatesAtCode: string
  callingLocations: CallingAtPoint[]
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  welcomeOnBoard: [
    {
      name: 'London to Birmingham (fast)',
      state: {
        terminatesAtCode: 'EDB',
        callingLocations: ['COV', 'BHI', 'BHM'].map(crsToStationItemMapper),
      } as IWelcomeAboardAnnouncementOptions,
    },
    {
      name: 'London to Edinburgh via Birmingham',
      state: {
        terminatesAtCode: 'EDB',
        callingLocations: [
          'WFJ',
          'MKC',
          'RUG',
          'COV',
          'BHI',
          'BHM',
          'SAD',
          'WVH',
          'STA',
          'CRE',
          'WBQ',
          'WGN',
          'PRE',
          'LAN',
          'PNR',
          'CAR',
          'HYM',
        ].map(crsToStationItemMapper),
      } as IWelcomeAboardAnnouncementOptions,
    },
    {
      name: 'Glasgow to London (fast)',
      state: {
        terminatesAtCode: 'EUS',
        callingLocations: ['MTH', 'LOC', 'CAR', 'PNR', 'OXN', 'LAN', 'PRE', 'WGN', 'WBQ'].map(crsToStationItemMapper),
      } as IWelcomeAboardAnnouncementOptions,
    },
  ],
}

export default class AvantiPendolino extends TrainAnnouncementSystem {
  readonly NAME = 'Avanti West Coast - Pendolino (Class 390) - Emma Lintern & Unknown Male'
  readonly ID = 'AWC_PENDOLINO'
  readonly FILE_PREFIX = 'AWC/390'
  readonly SYSTEM_TYPE = 'train'

  private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    if (!options.finalStop) files.push('chime')

    files.push('were now approaching', `stations.${options.stationCode}`)

    if (options.finalStop) files.push('which is our final stop')

    if (options.play61016) {
      files.push({ id: '61016', opts: { delayStart: 1500 } })
    }

    files.push({ id: 'when leaving us here', opts: { delayStart: 750 } })

    if (options.shortPlatform) {
      files.push('please move forward to leave the train')
    }

    await this.playAudioFiles(files, download)
  }

  private async playWelcomeAboardAnnouncement(options: IWelcomeAboardAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []
    files.push('chime')

    files.push('welcome on board this avanti west coast service to', `stations.${options.terminatesAtCode}`)

    if (options.callingLocations.length > 0) {
      files.push({
        id: 'calling at',
        opts: { delayStart: 2000 },
      })
      files.push(...options.callingLocations.map(location => ({ id: `stations.${location.crsCode}`, opts: { delayStart: 180 } })))
    }

    files.push({ id: '61016', opts: { delayStart: 2500 } })

    await this.playAudioFiles(files, download)
  }

  private RealAvailableStationNames = [
    'BHI',
    'BHM',
    'BPN',
    'CAR',
    'COV',
    'CRE',
    'EDB',
    'EUS',
    'GLC',
    'HYM',
    'LAN',
    'LIV',
    'LOC',
    'LTV',
    'MAC',
    'MAN',
    'MKC',
    'MTH',
    'NMP',
    'NUN',
    'OXN',
    'PNR',
    'PRE',
    'RUG',
    'RUN',
    'SAD',
    'SOT',
    'SPT',
    'STA',
    'TAM',
    'WBQ',
    'WFJ',
    'WGN',
    'WML',
    'WVH',
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
        shortPlatform: false,
        finalStop: false,
        play61016: true,
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
          shortPlatform: {
            name: 'Short platform?',
            type: 'boolean',
            default: false,
          },
          finalStop: {
            name: 'Terminates here?',
            type: 'boolean',
            default: false,
          },
          play61016: {
            name: 'Play 61016 announcement?',
            type: 'boolean',
            default: false,
          },
        },
      },
    } as CustomAnnouncementTab<keyof IApproachingStationAnnouncementOptions>,
    welcomeAboard: {
      name: 'Welcome on board',
      component: CustomAnnouncementPane,
      defaultState: {
        terminatesAtCode: this.RealAvailableStationNames[0],
        callingLocations: [],
      },
      props: {
        playHandler: this.playWelcomeAboardAnnouncement.bind(this),
        presets: announcementPresets.welcomeOnBoard,
        options: {
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.RealAvailableStationNames[0],
            options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
            type: 'select',
          },
          callingLocations: {
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
    } as CustomAnnouncementTab<keyof IWelcomeAboardAnnouncementOptions>,
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttons: [
          {
            label: 'Chime',
            play: this.playAudioFiles.bind(this, ['chime']),
            download: this.playAudioFiles.bind(this, ['chime'], true),
          },
          {
            label: 'BTP 61016',
            play: this.playAudioFiles.bind(this, ['61016']),
            download: this.playAudioFiles.bind(this, ['61016'], true),
          },
        ],
      },
    },
  }
}
