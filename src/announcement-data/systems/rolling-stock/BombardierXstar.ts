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
  keepBelongings: boolean
  cannotUseOyster: boolean
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
    {
      name: 'Dorking to London Victoria',
      state: {
        thisStationCode: 'DKG',
        terminatesAtCode: 'VIC',
        callingAtCodes: ['BXW', 'LHD', 'AHD', 'EPS', 'EWE', 'CHE', 'SUO', 'CSH', 'HCB', 'MIJ', 'MTC', 'BAL', 'CLJ'].map(crsToStationItemMapper),
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

    if (options.keepBelongings) {
      if (options.mindTheGap) files.push('and')

      files.push('please do not leave unattended items of luggage in the train or on the station')
    }

    if (options.cannotUseOyster) {
      files.push('you cannot use oyster')
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
    files.push('this is', `stations.${thisStationCode}`)

    const remainingStops = [
      ...callingAtCodes.map((crsCode): AudioItemObject => ({ id: `stations.${crsCode}`, opts: { delayStart: 100 } })),
      { id: `stations.${terminatesAtCode}`, opts: { delayStart: 100 } },
    ]

    if (callingAtCodes.some(code => !this.validateStationExists(code))) return

    if (remainingStops.length === 0) {
      // We are at the termination point.
      files.push('this train terminates here all change please ensure')
    } else if (remainingStops.length === 1) {
      // Next station is the termination point.
      files.push('this train is the southern service to', `stations.${terminatesAtCode}`)
      files.push('the next station is', remainingStops[0])
    } else {
      // We are not at the termination point.
      files.push('this train is the southern service to', `stations.${terminatesAtCode}`)
      files.push('calling at')
      files.push(...this.pluraliseAudio(remainingStops, { beforeAndDelay: 75 }))
      files.push('the next station is', remainingStops[0])
    }

    await this.playAudioFiles(files, download)
  }

  private async playDepartingStationAnnouncement(options: IDepartingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []
    files.push('bing bong')

    files.push(
      'welcome aboard the southern service to',
      `stations.${options.terminatesAtCode}`,
      'the next station is',
      `stations.${options.nextStationCode}`,
    )

    await this.playAudioFiles(files, download)
  }

  private RealAvailableStationNames = [
    'ABW',
    'ADM',
    'AFK',
    'AHD',
    'ANG',
    'ANZ',
    'APD',
    'AYH',
    'AYL',
    'AYP',
    'BAL',
    'BAN',
    'BAT',
    'BBL',
    'BCH',
    'BCS',
    'BCY',
    'BEC',
    'BEG',
    'BEX',
    'BFR',
    'BGM',
    'BHO',
    'BIP',
    'BKH',
    'BKJ',
    'BKL',
    'BKS',
    'BMG',
    'BMN',
    'BMO',
    'BMS',
    'BNH',
    'BOG',
    'BRG',
    'BRK',
    'BRX',
    'BSD',
    'BSR',
    'BTN',
    'BUG',
    'BVD',
    'BXH',
    'BXW',
    'BXY',
    'CAT',
    'CBE',
    'CBR',
    'CBW',
    'CDS',
    'CFB',
    'CFT',
    'CHE',
    'CHG',
    'CHX',
    'CIL',
    'CIT',
    'CLD',
    'CLJ',
    'CLK',
    'CLL',
    'CLP',
    'CNO',
    'COB',
    'CRT',
    'CRW',
    'CRY',
    'CSH',
    'CST',
    'CSW',
    'CTF',
    'CTK',
    'CTM',
    'CTN',
    'CUX',
    'CWU',
    'DDG',
    'DEA',
    'DEP',
    'DFD',
    'DKG',
    'DMK',
    'DMP',
    'DNG',
    'DUR',
    'DVP',
    'EBN',
    'EBR',
    'ECR',
    'EDN',
    'EFL',
    'ELE',
    'ELW',
    'EML',
    'EPH',
    'EPS',
    'ERH',
    'ESD',
    'ETC',
    'EWE',
    'EYN',
    'FAV',
    'FCN',
    'FGT',
    'FKC',
    'FKH',
    'FKW',
    'FMR',
    'FNR',
    'FOH',
    'FRT',
    'GBS',
    'GDN',
    'GLM',
    'GLY',
    'GNH',
    'GNW',
    'GPO',
    'GRP',
    'GRV',
    'GTW',
    'HAI',
    'HBN',
    'HCB',
    'HCN',
    'HDM',
    'HGM',
    'HGR',
    'HGS',
    'HHE',
    'HIB',
    'HLB',
    'HLM',
    'HMD',
    'HMT',
    'HNB',
    'HNH',
    'HOR',
    'HOV',
    'HPA',
    'HRH',
    'HRM',
    'HSK',
    'HWY',
    'HYS',
    'IFI',
    'KCK',
    'KDB',
    'KML',
    'KMS',
    'KSN',
    'KTH',
    'LAC',
    'LAD',
    'LBG',
    'LEE',
    'LEN',
    'LEW',
    'LGF',
    'LGJ',
    'LHD',
    'LIH',
    'LIT',
    'LMS',
    'LRB',
    'LSY',
    'LVN',
    'LWS',
    'MAR',
    'MCB',
    'MDB',
    'MDE',
    'MDW',
    'MEP',
    'MHM',
    'MIJ',
    'MRN',
    'MSR',
    'MTC',
    'MTG',
    'MTM',
    'MYB',
    'MZH',
    'MZO',
    'NBC',
    'NEH',
    'NFL',
    'NGT',
    'NHD',
    'NHE',
    'NLT',
    'NSB',
    'NUF',
    'NVH',
    'NVN',
    'NWD',
    'NWX',
    'OLY',
    'ORE',
    'ORP',
    'OTF',
    'PDW',
    'PEB',
    'PET',
    'PEV',
    'PHR',
    'PLC',
    'PLD',
    'PLG',
    'PLU',
    'PMP',
    'PMR',
    'PNE',
    'PNW',
    'PRP',
    'PRR',
    'PUO',
    'PUR',
    'QBR',
    'RAI',
    'RAM',
    'RBR',
    'RDH',
    'RTR',
    'RVB',
    'RYE',
    'SAJ',
    'SAY',
    'SCG',
    'SCY',
    'SDA',
    'SDG',
    'SDH',
    'SDW',
    'SEE',
    'SEF',
    'SEG',
    'SEH',
    'SEV',
    'SGR',
    'SID',
    'SIO',
    'SIT',
    'SLQ',
    'SMY',
    'SNO',
    'SOG',
    'SOL',
    'SOO',
    'SOR',
    'SOU',
    'SPH',
    'SPU',
    'SRS',
    'SRT',
    'SRU',
    'SSE',
    'SSS',
    'STU',
    'SUD',
    'SUO',
    'SUP',
    'SVO',
    'SWL',
    'SWM',
    'SWO',
    'SYD',
    'SYH',
    'TAT',
    'TBD',
    'TBW',
    'TEY',
    'TOK',
    'TON',
    'VIC',
    'WAD',
    'WAE',
    'WAM',
    'WAT',
    'WCB',
    'WCX',
    'WDU',
    'WGA',
    'WHA',
    'WHI',
    'WLD',
    'WLI',
    'WMA',
    'WRH',
    'WRP',
    'WRU',
    'WRW',
    'WSE',
    'WTR',
    'WVF',
    'WWA',
    'WWD',
    'WWI',
    'WWO',
    'WWR',
    'WYE',
    'YAL',
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
        mindTheGap: true,
        keepBelongings: false,
        cannotUseOyster: false,
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
          mindTheGap: {
            name: 'Mind the gap?',
            type: 'boolean',
            default: true,
          },
          keepBelongings: {
            name: 'Keep belongings with you?',
            type: 'boolean',
            default: false,
          },
          cannotUseOyster: {
            name: 'Cannot use Oyster/Contactless beyond here?',
            type: 'boolean',
            default: false,
          },
        },
      },
    } as CustomAnnouncementTab<keyof IApproachingStationAnnouncementOptions>,
    stoppedAtStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      defaultState: {
        thisStationCode: this.RealAvailableStationNames[0],
        terminatesAtCode: this.RealAvailableStationNames[0],
        callingAtCodes: [],
      },
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
    } as CustomAnnouncementTab<keyof IStoppedAtStationAnnouncementOptions>,
    departingStation: {
      name: 'Departing station',
      component: CustomAnnouncementPane,
      defaultState: {
        terminatesAtCode: this.RealAvailableStationNames[0],
        nextStationCode: this.RealAvailableStationNames[0],
      },
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
    } as CustomAnnouncementTab<keyof IDepartingStationAnnouncementOptions>,
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
          {
            label: 'BTP 61016',
            play: this.playAudioFiles.bind(this, ['please keep your bags and personal belongings with you', '61016']),
            download: this.playAudioFiles.bind(this, ['please keep your bags and personal belongings with you', '61016'], true),
          },
        ],
      },
    },
  }
}
