import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'

interface IApproachingStationAnnouncementOptions {
  stationCode: string
  toc: string
  terminatesHere: boolean
  ticketsReady: boolean
  mindTheGap: boolean
}

interface IWelcomeAnnouncementOptions {
  terminatesAtCode: string
  toc: string
  readAllStations: boolean
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  welcome: [
    {
      name: 'Dorridge to Worcester Forgate Street',
      state: {
        terminatesAtCode: 'WOF',
        toc: 'WMR',
        readAllStations: true,
        callingAtCodes: [
          'WMR',
          'SOL',
          'OLT',
          'ACG',
          'TYS',
          'SMA',
          'BMO',
          'BSW',
          'JEQ',
          'THW',
          'SGB',
          'ROW',
          'CRA',
          'SBJ',
          'HAG',
          'BKD',
          'KID',
          'HBY',
          'DTW',
        ].map(crsToStationItemMapper),
      },
    },
    {
      name: 'Birmingham Snow Hill to Whitlocks End',
      state: {
        terminatesAtCode: 'WTE',
        toc: 'Generic',
        readAllStations: true,
        callingAtCodes: ['BMO', 'SMA', 'TYS', 'SRI', 'HLG', 'YRD', 'SRL'].map(crsToStationItemMapper),
      },
    },
    {
      name: 'Kidderminister to Stratford-upon-Avon',
      state: {
        terminatesAtCode: 'SAV',
        toc: 'LM',
        readAllStations: true,
        callingAtCodes: [
          'SBJ',
          'LYE',
          'CRA',
          'OHL',
          'ROW',
          'LGG',
          'SGB',
          'THW',
          'JEQ',
          'BSW',
          'BMO',
          'SMA',
          'TYS',
          'SRI',
          'HLG',
          'YRD',
          'SRL',
          'WTE',
          'WYT',
          'EWD',
          'TLK',
          'WDE',
          'DZY',
          'HNL',
          'WWW',
          'WMC',
          'STY',
        ].map(crsToStationItemMapper),
      },
    },
  ],
}

export default class WMTClass172 extends TrainAnnouncementSystem {
  readonly NAME = 'West Midlands Trains Class 172 - Julie Berry'
  readonly ID = 'WMT_CLASS_172_V1'
  readonly FILE_PREFIX = 'WMT/172'
  readonly SYSTEM_TYPE = 'train'
  readonly DESCRIPTION = 'Generate West Midlands Trains Class 172 on-train announcements using real audio recordings from Julie Berry.'

  private readonly StationsWithForcedChangeHere = {
    SBJ: ['stations.SBT'],
  }

  private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('bing bong')
    files.push('we are now approaching')
    files.push({ id: `stations.${options.stationCode}` })

    if (options.terminatesHere) {
      files.push({ id: 'our final destination' })
    }

    if (Object.keys(this.StationsWithForcedChangeHere).includes(options.stationCode)) {
      const changeFor = this.StationsWithForcedChangeHere[options.stationCode as keyof typeof this.StationsWithForcedChangeHere]
      files.push({ id: 'change here for' })
      const changes = [...changeFor.map((line): AudioItemObject => ({ id: line }))]

      files.push(...this.pluraliseAudio(changes))
    }

    if (options.toc == 'LM') {
      files.push({ id: 'thank you for travelling with london midland' })
    }

    if (options.ticketsReady) {
      files.push({ id: 'please have your tickets ready' })
    }

    if (options.mindTheGap) {
      if (options.toc == 'LM' || options.toc == 'Generic') files.push({ id: 'please mind the gap between the platform and the train' })
      else files.push({ id: 'please mind the gap when leaving the train and step' })
    }

    await this.playAudioFiles(files, download)
  }

  private async playStoppedAtStationAnnouncement(options: IWelcomeAnnouncementOptions, download: boolean = false): Promise<void> {
    const { callingAtCodes: _callingAt, terminatesAtCode, readAllStations } = options

    const callingAtCodes = _callingAt.map(stop => stop.crsCode)

    if (!this.validateStationExists(terminatesAtCode)) return

    const files: AudioItem[] = []
    files.push('bing bong')

    if (options.callingAtCodes.length === 0) {
      // terminates here

      files.push('this is')
      files.push({ id: `stations.${terminatesAtCode}` })
      files.push({ id: 'our final destination' })

      if (options.toc == 'LM') {
        files.push({ id: 'thank you for travelling with london midland' })
        files.push({ id: 'please mind the gap between the platform and the train' })
      } else if (options.toc == 'Generic') {
        files.push({ id: 'please mind the gap between the platform and the train' })
      } else {
        files.push({ id: 'please mind the gap when leaving the train and step' })
      }
    } else {
      if (options.toc == 'Generic') files.push('this train is for')
      else if (options.toc == 'LM') files.push('welcome aboard this london midland service to')
      else files.push('welcome to this service for')

      files.push({ id: `stations.${terminatesAtCode}` })

      const remainingStops = [
        ...callingAtCodes.map((crsCode): AudioItemObject => ({ id: `stations.${crsCode}` })),
        { id: `stations.${terminatesAtCode}` },
      ]

      if (callingAtCodes.some(code => !this.validateStationExists(code))) return

      if (remainingStops.length === 1 || !readAllStations) {
        // Next station is the termination point or we are not reading all stations.
        files.push({ id: `the next station is` })
        files.push(remainingStops[0])
      } else {
        // We are not at the termination point and reading all stations.
        files.push({ id: `calling at` })
        files.push(...this.pluraliseAudio(remainingStops))
      }
    }

    await this.playAudioFiles(files, download)
  }

  private RealAvailableStationNames = [
    'ACB',
    'ACG',
    'ADD',
    'ALB',
    'ALV',
    'APG',
    'ASC',
    'ASG',
    'AST',
    'ATH',
    'BBK',
    'BBS',
    'BDM',
    'BEH',
    'BEP',
    'BER',
    'BHI',
    'BHM',
    'BKD',
    'BKT',
    'BKW',
    'BLX',
    'BLY',
    'BMO',
    'BMV',
    'BRT',
    'BRV',
    'BSC',
    'BSJ',
    'BSW',
    'BTG',
    'BUL',
    'BWB',
    'BWN',
    'CAA',
    'CAO',
    'CLV',
    'CNL',
    'CNM',
    'COS',
    'COV',
    'CRA',
    'CRD',
    'CRE',
    'CSL',
    'CSY',
    'CWL',
    'DDG',
    'DDP',
    'DTW',
    'DUD',
    'DZY',
    'ERD',
    'EWD',
    'FEN',
    'FOK',
    'FWY',
    'GCR',
    'GMV',
    'GVH',
    'HAG',
    'HBY',
    'HFD',
    'HIA',
    'HLG',
    'HNF',
    'HNL',
    'HSD',
    'HTF',
    'HTN',
    'JEQ',
    'KDG',
    'KID',
    'KMH',
    'KNN',
    'KNW',
    'LAW',
    'LBK',
    'LED',
    'LEH',
    'LGG',
    'LIC',
    'LID',
    'LIV',
    'LMS',
    'LOB',
    'LPT',
    'LPW',
    'LPY',
    'LTV',
    'LYE',
    'MGN',
    'MLB',
    'MSH',
    'MVL',
    'NFD',
    'NMP',
    'NTB',
    'NUN',
    'OHL',
    'OKN',
    'OLT',
    'PKG',
    'PRE',
    'PRY',
    'PSW',
    'RDC',
    'RGL',
    'RGT',
    'RID',
    'ROW',
    'RUG',
    'RUN',
    'SAD',
    'SAV',
    'SBJ',
    'SBT',
    'SCF',
    'SEN',
    'SFN',
    'SGB',
    'SHR',
    'SMA',
    'SMR',
    'SNE',
    'SOL',
    'SOT',
    'SRI',
    'SRL',
    'STA',
    'STY',
    'SUT',
    'SWR',
    'TAB',
    'TAM',
    'TFC',
    'THL',
    'THW',
    'TIP',
    'TLK',
    'TYS',
    'UNI',
    'WBQ',
    'WDE',
    'WED',
    'WGN',
    'WLN',
    'WMC',
    'WMR',
    'WOB',
    'WOF',
    'WOS',
    'WRP',
    'WRW',
    'WSF',
    'WSL',
    'WTE',
    'WTT',
    'WVH',
    'WWW',
    'WYL',
    'WYT',
    'YRD',
  ]

  readonly AvailableStationNames = {
    high: this.RealAvailableStationNames,
    low: this.RealAvailableStationNames,
  }

  private AvailableTOCs: { title: string; value: string }[] = [
    { title: 'West Midlands Railway', value: 'WMR' },
    { title: 'London Midland', value: 'LM' },
    { title: 'Generic', value: 'Generic' },
  ]

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab<string>> = {
    approachingStation: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      defaultState: {
        stationCode: this.RealAvailableStationNames[0],
        toc: this.AvailableTOCs[0].value,
        terminatesHere: false,
        ticketsReady: true,
        mindTheGap: true,
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
          toc: {
            name: 'TOC',
            default: this.AvailableTOCs[0].value,
            options: this.AvailableTOCs,
            type: 'select',
          },
          ticketsReady: {
            name: 'Have your tickets ready for the gates?',
            type: 'boolean',
            default: false,
          },
          mindTheGap: {
            name: 'Mind the gap?',
            type: 'boolean',
            default: true,
          },
          terminatesHere: {
            name: 'Train terminates here?',
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
        terminatesAtCode: this.RealAvailableStationNames[0],
        toc: this.AvailableTOCs[0].value,
        terminatesHere: false,
        readAllStations: true,
        callingAtCodes: [],
      },
      props: {
        playHandler: this.playStoppedAtStationAnnouncement.bind(this),
        presets: announcementPresets.welcome,
        options: {
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.RealAvailableStationNames[0],
            options: AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)),
            type: 'select',
          },
          toc: {
            name: 'TOC',
            default: this.AvailableTOCs[0].value,
            options: this.AvailableTOCs,
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
            label: 'Short platform - move to front four coaches',
            play: this.playAudioFiles.bind(this, [
              'buttons.the next station has a short platform only the doors of the front four coaches will open',
            ]),
            download: this.playAudioFiles.bind(
              this,
              ['buttons.the next station has a short platform only the doors of the front four coaches will open'],
              true,
            ),
          },
        ],
      },
    },
  }
}
