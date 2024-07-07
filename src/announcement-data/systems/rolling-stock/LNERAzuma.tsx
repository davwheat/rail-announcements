import CallingAtSelector, { CallingAtPoint } from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'

interface IStoppedAtStationAnnouncementOptions {
  thisStationCode: string
  terminatesAtCode: string
  callingAtCodes: CallingAtPoint[]
  // mindTheGap: boolean
}

interface IDepartingStationAnnouncementOptions {
  terminatesAtCode: string
  callingAtCodes: CallingAtPoint[]
}

interface IApproachingStationAnnouncementOptions {
  nextStationCode: string
  terminates: boolean
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  stopped: [
    {
      name: 'YRK - ABD',
      state: {
        thisStationCode: 'YRK',
        terminatesAtCode: 'ABD',
        callingAtCodes: ['DAR', 'NCL', 'BWK', 'EDB', 'HYM', 'INK', 'KDY', 'LEU', 'DEE', 'ARB', 'MTS', 'STN'].map(crsToStationItemMapper),
      },
    },
    {
      name: 'BWK - EDB',
      state: {
        thisStationCode: 'BWK',
        terminatesAtCode: 'EDB',
        callingAtCodes: [].map(crsToStationItemMapper),
      },
    },
    {
      name: 'Terminating KGX',
      state: {
        thisStationCode: 'KGX',
        terminatesAtCode: 'KGX',
        callingAtCodes: [].map(crsToStationItemMapper),
      },
    },
  ],
  departingStation: [
    {
      name: 'Departing YRK for ABD',
      state: {
        terminatesAtCode: 'ABD',
        callingAtCodes: ['DAR', 'NCL', 'BWK', 'EDB', 'HYM', 'INK', 'KDY', 'LEU', 'DEE', 'ARB', 'MTS', 'STN'].map(crsToStationItemMapper),
      },
    },
    {
      name: 'Terminating EDB',
      state: {
        terminatesAtCode: 'EDB',
        callingAtCodes: [].map(crsToStationItemMapper),
      },
    },
    {
      name: 'Terminating KGX',
      state: {
        terminatesAtCode: 'KGX',
        callingAtCodes: [].map(crsToStationItemMapper),
      },
    },
  ],
}

interface StationInfo {
  changeFor?: AudioItem[]
}

export default class LnerAzuma extends TrainAnnouncementSystem {
  readonly NAME = 'LNER Azuma'
  readonly ID = 'LNER_AZUMA_V1'
  readonly FILE_PREFIX = 'LNER/Azuma'
  readonly SYSTEM_TYPE = 'train'

  readonly STATION_INFO: Record<string, AudioItem[]> = {
    NCL: ['station.CAR', 'station.HEX', 'and', 'tyne and wear metro'],
    GRA: ['station.SKG'],
    DON: ['station.CLE', 'station.RMC', 'station.SHF', 'and', 'station.GMB'],
    YRK: ['station.HGT', 'station.MLT', 'and', 'station.SCA'],
    DAR: ['station.BIA', 'station.MBR', 'station.RCC', 'and', 'station.SLB'],
  }

  readonly ALL_STATIONS = [
    'AAP',
    'ABD',
    'ACK',
    'ALM',
    'APY',
    'ARB',
    'ARL',
    'AVM',
    'BDQ',
    'BEA',
    'BHI',
    'BHM',
    'BIA',
    'BIL',
    'BIW',
    'BIY',
    'BLA',
    'BPK',
    'BSE',
    'BSN',
    'BUH',
    'BWK',
    'CAG',
    'CAN',
    'CAR',
    'CBG',
    'CEY',
    'CFD',
    'CFL',
    'CHD',
    'CHT',
    'CLE',
    'CLM',
    'CLS',
    'COT',
    'CRM',
    'CRO',
    'CRS',
    'CTL',
    'CUP',
    'DAR',
    'DBL',
    'DBY',
    'DEE',
    'DEW',
    'DHM',
    'DHN',
    //'DHN_1',
    'DKN',
    'DLW',
    'DON',
    'DUN',
    'EAG',
    'EDB',
    'EDP',
    'EGY',
    'ELY',
    'FIL',
    'FKG',
    'FKK',
    'FPK',
    //'FPK_1',
    'GBL',
    'GLC',
    'GLE',
    'GLQ',
    'GMB',
    'GOO',
    'GRF',
    'GRA',
    'HAB',
    'HAT',
    'HBP',
    'HDY',
    'HEI',
    'HES',
    'HEW',
    'HEX',
    'HFN',
    'HGT',
    'HGY',
    'HIT',
    'HKM',
    'HMM',
    'HOW',
    'HPL',
    'HRN',
    'HRS',
    'HUD',
    'HUL',
    'HUN',
    'HYM',
    'INK',
    'INV',
    'IPS',
    'KBW',
    'KDY',
    'KEI',
    'KGX',
    'KIN',
    'KLF',
    'KNA',
    'KNO',
    'LAU',
    'LBT',
    'LCN',
    'LDS',
    'LEI',
    'LEU',
    'LIN',
    'LNZ',
    'LST',
    'MAN',
    'MAS',
    'MBR',
    'MCE',
    'MCH',
    'MHS',
    'MIK',
    'MIR',
    'MKR',
    'MLT',
    'MLY',
    'MNC',
    'MPT',
    'MTH',
    'MTS',
    'MUB',
    'NAY',
    'NCL',
    'NNG',
    'NOR',
    'NOT',
    'NRD',
    //'NRD_1',
    'NRW',
    'NTR',
    'NWR',
    'OKM',
    'PBO',
    'PBR',
    'PEG',
    'PFM',
    'PIT',
    'PLN',
    'PMT',
    'PNL',
    'POP',
    'PTH',
    'RCC',
    'RET',
    'RMC',
    'RVN',
    'RSN',
    'RYS',
    'SAE',
    'SBE',
    'SBY',
    'SCA',
    'SCU',
    'SDY',
    'SEA',
    'SEC',
    'SEM',
    'SFO',
    'SHD',
    'SHF',
    'SHY',
    'SKG',
    'SKI',
    'SLB',
    'SLR',
    'SMK',
    'SNO',
    'SON',
    'SPA',
    'SPF',
    'STA',
    'STG',
    'STK',
    'STN',
    'STP',
    'SUN',
    'SVG',
    'SWD',
    'TBY',
    'THI',
    'TTF',
    'WAF',
    'WDD',
    'WET',
    'WGC',
    'WKF',
    'WKK',
    'WLW',
    'WMG',
    'WRK',
    'WTB',
    'XPK',
    'YRK',
    'YRM',
  ]

  AvailableStationNames = {
    high: this.ALL_STATIONS,
    low: this.ALL_STATIONS,
  }

  private async playStoppedAtStationAnnouncement(options: IStoppedAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { thisStationCode, terminatesAtCode, callingAtCodes } = options

    const files: AudioItem[] = []

    if (thisStationCode === terminatesAtCode) {
      // End of journey
      files.push(
        'welcome to',
        `station.${terminatesAtCode}`,
        'where we finish our journey today',
        {
          id: 'on behalf of the onboard team thank you for travelling with lner',
          opts: { delayStart: 2000 },
        },
        { id: 'male.if you enjoyed your journey please let us know', opts: { delayStart: 2000 } },
      )
    } else {
      files.push({ id: 'we are now at' }, { id: `station.${thisStationCode}`, opts: { delayStart: 150 } })

      files.push(...this.getWelcomeAudio(terminatesAtCode, callingAtCodes, 5000))
    }

    await this.playAudioFiles(files, download)
  }

  private async playDepartingStationAnnouncement(options: IDepartingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { terminatesAtCode, callingAtCodes } = options

    const files: AudioItem[] = []

    files.push(...this.getWelcomeAudio(terminatesAtCode, callingAtCodes))

    await this.playAudioFiles(files, download)
  }

  private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { nextStationCode, terminates } = options

    const files: AudioItem[] = []

    files.push('we will shortly be arriving at', `station.${nextStationCode}`)

    if (terminates) {
      files.push('where we finish our journey today')
    }

    if (this.STATION_INFO[nextStationCode]) {
      files.push({ id: 'change here', opts: { delayStart: 5_000 } }, 'for trains to', ...this.STATION_INFO[nextStationCode])
    }

    files.push({ id: 'if youre leaving us here please make sure to take all your personal belongings with you', opts: { delayStart: 5_000 } })
    files.push({ id: 'thank you for travelling with lner', opts: { delayStart: 10_000 } })

    await this.playAudioFiles(files, download)
  }

  private getWelcomeAudio(terminatesAtCode: string, callingAtCodes: CallingAtPoint[], delay: number = 0): AudioItem[] {
    const files: AudioItem[] = []

    files.push(
      { id: 'hello and welcome on board this lner azuma to', opts: { delayStart: delay } },
      { id: `station.${terminatesAtCode}`, opts: { delayStart: 150 } },
      { id: `we will call at`, opts: { delayStart: 6_000 } },
    )

    if (callingAtCodes.length === 0) {
      files.push(`station.${terminatesAtCode}`, 'only')
    } else {
      files.push(
        ...this.pluraliseAudio([...callingAtCodes.map(({ crsCode }) => `station.${crsCode}`), `station.${terminatesAtCode}`], {
          beforeAndDelay: 150,
          afterAndDelay: 150,
          beforeItemDelay: 100,
        }),
      )
    }

    const nextStation = callingAtCodes.at(0)?.crsCode ?? terminatesAtCode

    files.push({ id: 'the next station will be', opts: { delayStart: 5_000 } }, { id: `station.${nextStation}`, opts: { delayStart: 150 } })
    files.push({ id: 'male.cctv is in operation', opts: { delayStart: 3_000 } }, { id: 'male.btp 61016', opts: { delayStart: 5_000 } })

    return files
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab<string>> = {
    stoppedAtStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      defaultState: {
        thisStationCode: this.ALL_STATIONS[0],
        terminatesAtCode: this.ALL_STATIONS[0],
        callingAtCodes: [],
      },
      props: {
        presets: announcementPresets.stopped,
        playHandler: this.playStoppedAtStationAnnouncement.bind(this),
        options: {
          thisStationCode: {
            name: 'This station',
            default: this.ALL_STATIONS[0],
            options: this.ALL_STATIONS.map(crsToStationItemMapper).map(({ crsCode, name }) => ({ value: crsCode, title: name })),
            type: 'select',
          },
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.ALL_STATIONS[0],
            options: this.ALL_STATIONS.map(crsToStationItemMapper).map(({ crsCode, name }) => ({ value: crsCode, title: name })),
            type: 'select',
          },
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.ALL_STATIONS,
            },
            default: [],
          },
        },
      },
    } as CustomAnnouncementTab<keyof IStoppedAtStationAnnouncementOptions>,
    departingStation: {
      name: 'Route start & departing station',
      component: CustomAnnouncementPane,
      defaultState: {
        terminatesAtCode: this.ALL_STATIONS[0],
        callingAtCodes: [],
      },
      props: {
        presets: announcementPresets.departingStation,
        playHandler: this.playDepartingStationAnnouncement.bind(this),
        options: {
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.ALL_STATIONS[0],
            options: this.ALL_STATIONS.map(crsToStationItemMapper).map(({ crsCode, name }) => ({ value: crsCode, title: name })),
            type: 'select',
          },
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.ALL_STATIONS,
            },
            default: [],
          },
        },
      },
    } as CustomAnnouncementTab<keyof IDepartingStationAnnouncementOptions>,
    aproachingStation: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      defaultState: {
        nextStationCode: this.ALL_STATIONS[0],
        terminates: false,
      },
      props: {
        playHandler: this.playApproachingStationAnnouncement.bind(this),
        options: {
          nextStationCode: {
            name: 'Next station',
            default: this.ALL_STATIONS[0],
            options: this.ALL_STATIONS.map(crsToStationItemMapper).map(({ crsCode, name }) => ({ value: crsCode, title: name })),
            type: 'select',
          },
          terminates: {
            name: 'Terminates here',
            default: false,
            type: 'boolean',
          },
        },
      },
    } as CustomAnnouncementTab<keyof IApproachingStationAnnouncementOptions>,
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          Safety: [
            {
              label: 'BTP 61016',
              play: this.playAudioFiles.bind(this, ['male.btp 61016']),
              download: this.playAudioFiles.bind(this, ['male.btp 61016'], true),
            },
            {
              label: 'BTP 61016 (threat level critical)',
              play: this.playAudioFiles.bind(this, ['male.btp 61016 critical']),
              download: this.playAudioFiles.bind(this, ['male.btp 61016 critical'], true),
            },
            {
              label: 'CCTV is in use',
              play: this.playAudioFiles.bind(this, ['male.cctv is in operation']),
              download: this.playAudioFiles.bind(this, ['male.cctv is in operation'], true),
            },
          ],
        },
      },
    },
  }
}
