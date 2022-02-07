import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'

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

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  stopped: [
    {
      name: 'Haywards Heath to Ore',
      state: {
        thisStationCode: 'HHE',
        terminatesAtCode: 'ORE',
        callingAtCodes: ['WVF', 'PMP', 'LWS', 'PLG', 'EBN', 'HMD', 'PEB', 'COB', 'CLL', 'BEX', 'SLQ', 'HGS'].map(crsToStationItemMapper),
      },
    },
    {
      name: 'Preston Park to London Victoria',
      state: {
        thisStationCode: 'PRP',
        terminatesAtCode: 'VIC',
        callingAtCodes: ['HHE', 'GTW', 'ECR', 'CLJ'].map(crsToStationItemMapper),
      },
    },
    {
      name: 'Preston Park to Littlehampton',
      state: {
        thisStationCode: 'PRP',
        terminatesAtCode: 'LIT',
        callingAtCodes: ['HOV', 'PLD', 'SSE', 'LAC', 'WRH', 'WWO', 'DUR', 'GBS', 'ANG'].map(crsToStationItemMapper),
      },
    },
  ],
}

export default class BombardierXstar extends TrainAnnouncementSystem {
  readonly NAME = 'Electrostar & Turbostar - Julie Berry'
  readonly ID = 'SN_CLASS_377_V1'
  readonly FILE_PREFIX = 'SN/377'
  readonly SYSTEM_TYPE = 'train'

  private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('bing bong')
    files.push('we are now approaching', `stations.${options.stationCode}`)

    if (options.mindTheGap) {
      files.push('please mind the gap between the train and the platform')
    }

    await this.playAudioFiles(files, download)
  }

  private async playStoppedAtStationAnnouncement(options: IStoppedAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { callingAtCodes: _callingAt, terminatesAtCode, thisStationCode } = options

    const callingAtCodes = _callingAt.map(stop => stop.crsCode)

    if (!this.validateStationExists(terminatesAtCode)) return
    if (!this.validateStationExists(thisStationCode)) return

    const files: AudioItem[] = []
    files.push('bing bong')
    files.push('this is', `stations.${thisStationCode}`, 'this train is the southern service to', `stations.${terminatesAtCode}`)

    const remainingStops = [
      ...callingAtCodes.map((crsCode): AudioItemObject => ({ id: `stations.${crsCode}`, opts: { delayStart: 100 } })),
      { id: `stations.${terminatesAtCode}`, opts: { delayStart: 100 } },
    ]

    if (callingAtCodes.some(code => !this.validateStationExists(code))) return

    if (remainingStops.length > 1) {
      // We are not at the termination point.
      files.push('calling at')
      files.push(...this.pluraliseAudio(remainingStops, 75))
      files.push('the next station is', remainingStops[0])
    }

    await this.playAudioFiles(files, download)
  }

  private RealAvailableStationNames = [
    'AFK',
    'ANG',
    'ANZ',
    'APD',
    'BAN',
    'BCS',
    'BCY',
    'BEX',
    'BRK',
    'CAT',
    'CBR',
    'CLJ',
    'CLL',
    'COB',
    'CRW',
    'DUR',
    'EBN',
    'ECR',
    'FMR',
    'FOH',
    'GBS',
    'GLY',
    'GTW',
    'HDM',
    'HGS',
    'HHE',
    'HMD',
    'HMT',
    'HOV',
    'HPA',
    'HRH',
    'HSK',
    'HWY',
    'LAC',
    'LIT',
    'LMS',
    'LWS',
    'MCB',
    'MYB',
    'NSB',
    'NWD',
    'ORE',
    'PEB',
    'PLD',
    'PLG',
    'PMP',
    'PMS',
    'PNW',
    'PRP',
    'PRR',
    'PUO',
    'PUR',
    'RYE',
    'SCY',
    'SLQ',
    'SOL',
    'SSE',
    'SYD',
    'TAT',
    'TOK',
    'VIC',
    'WRH',
    'WRP',
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
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playApproachingStationAnnouncement.bind(this),
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
    },
    stoppedAtStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playStoppedAtStationAnnouncement.bind(this),
        presets: announcementPresets.stopped,
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
    },
    departingStation: {
      name: 'Departing station',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playDepartingStationAnnouncement.bind(this),
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
    },
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttons: [
          {
            label: 'Bing bong',
            play: this.playAudioFiles.bind(this, ['bing bong']),
            download: this.playAudioFiles.bind(this, ['bing bong'], true),
          },
          {
            label: 'You must wear a face covering',
            play: this.playAudioFiles.bind(this, ['you must wear a face covering on your jouney unless you are exempt']),
            download: this.playAudioFiles.bind(this, ['you must wear a face covering on your jouney unless you are exempt'], true),
          },
        ],
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
