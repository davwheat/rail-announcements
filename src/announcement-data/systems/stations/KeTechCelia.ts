import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'

interface INextTrainAnnouncementOptions {
  chime: '3' | '4' | 'none'
  platform: typeof AVAILABLE_ALPHANUMBERS[number]
  hour: typeof AVAILABLE_HOURS[number]
  min: typeof AVAILABLE_MINUTES[number]
  toc: typeof AVAILABLE_TOCS[number]
  terminatingStationCode: typeof AVAILABLE_STATIONS['low'][number]
  via: typeof AVAILABLE_STATIONS['low'][number] | 'none'
  callingAt: { crsCode: string; name: string; randomId: string }[]
  coaches: typeof AVAILABLE_NUMBERS[number]
}

const AVAILABLE_ALPHANUMBERS = ['1', '2', '3', '4', '4a', '5', '6'] as const
const AVAILABLE_HOURS = ['08', '11', '12', '13', '14', '15', '16', '18', '19'] as const
const AVAILABLE_MINUTES = ['00', '06', '08', '13', '16', '17', '20', '24', '30', '35', '41', '42', '44', '46', '50', '55'] as const
const AVAILABLE_TOCS = [
  '<None>',
  'Arriva Trains Wales',
  'Chiltern Railways',
  'Cross Country',
  'Great Western Railway',
  'London Midland',
  'Northern',
  'South West Trains',
  'Virgin Pendolino',
  'West Midlands Railway',
] as const
const AVAILABLE_NUMBERS: string[] = AVAILABLE_ALPHANUMBERS.filter(x => /^\d+$/.test(x))

const AVAILABLE_STATIONS = {
  low: ['BHM', 'BMH', 'BSK', 'BSW', 'CDF', 'EDB', 'ESL', 'LMS', 'MAN', 'PMH', 'POO', 'SAL', 'SBJ', 'SHF', 'SOU', 'WAT', 'WOK'],
  high: [
    'ADV',
    'ALM',
    'ANF',
    'BAN',
    'BCU',
    'BEU',
    'BHI',
    'BHM',
    'BMH',
    'BNY',
    'BOA',
    'BRI',
    'BSK',
    'BSM',
    'BSW',
    'BTH',
    'CDF',
    'CFR',
    'CHR',
    'CLJ',
    'CLN',
    'COV',
    'CRA',
    'CSA',
    'DAR',
    'DBY',
    'DDG',
    'DHM',
    'DOR',
    'DRT',
    'ELR',
    'ESL',
    'EUS',
    'FIT',
    'FLE',
    'FRM',
    'FTN',
    'GRN',
    'HNA',
    'HSG',
    'HTN',
    'HXX',
    'JEQ',
    'LDS',
    'LGG',
    'LIV',
    'LMS',
    'LYE',
    'MAC',
    'MHS',
    'NCL',
    'NWM',
    'NWP',
    'OHL',
    'OXF',
    'PKS',
    'PMS',
    'POK',
    'RDG',
    'ROM',
    'ROW',
    'SDN',
    'SGB',
    'SHF',
    'SHW',
    'SOA',
    'SOT',
    'SOU',
    'SPT',
    'STA',
    'STJ',
    'SWG',
    'SWY',
    'THW',
    'TRO',
    'TTN',
    'WIN',
    'WKF',
    'WMN',
    'WOM',
    'WRW',
    'WSB',
    'WVH',
    'YRK',
    'YVJ',
  ],
} as const

interface IValidateOptions {
  stationsHigh: string[]
  stationsLow: string[]
  hour: string
  minute: string
  toc: string
  platform: string
  coaches: string
}

export default class KeTechCelia extends StationAnnouncementSystem {
  readonly NAME = 'KeTech - Celia Drummond'
  readonly ID = 'KETECH_CELIA_V1'
  readonly FILE_PREFIX = 'station/ketech/celia'
  readonly SYSTEM_TYPE = 'station'

  private getTocAudioId(toc: typeof AVAILABLE_TOCS[number]) {
    return toc === '<None>' ? `tocs.service to` : `tocs.${toc.toLowerCase()} service to`
  }

  private async playNextTrainAnnouncement(options: INextTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    if (!this.validateOptions({ platform: options.platform, hour: options.hour, minute: options.min, toc: options.toc })) return

    if (options.chime !== 'none') files.push(`${options.chime} chime`)

    files.push('platform', `numbers.${options.platform}`, 'for the', `times.hour.${options.hour}`, `times.mins.${options.min}`, {
      id: this.getTocAudioId(options.toc),
      opts: { delayStart: 150 },
    })

    if (options.via && options.via !== 'none') {
      if (!this.validateOptions({ stationsHigh: [options.terminatingStationCode], stationsLow: [options.via] })) return
      files.push(`stations.high.${options.terminatingStationCode}`, 'via', `stations.low.${options.via}`)
    } else {
      if (!this.validateOptions({ stationsLow: [options.terminatingStationCode] })) return
      files.push(`stations.low.${options.terminatingStationCode}`)
    }

    files.push({ id: 'calling at', opts: { delayStart: 750 } })

    if (options.callingAt.length === 0) {
      files.push(`stations.high.${options.terminatingStationCode}`, 'only')
    } else {
      const callingAtStops = options.callingAt.map(stn => stn.crsCode)
      if (!this.validateOptions({ stationsHigh: callingAtStops })) return
      files.push(
        ...this.pluraliseAudio([...callingAtStops.map(stn => `stations.high.${stn}`), `stations.low.${options.terminatingStationCode}`]),
      )
    }

    if (!this.validateOptions({ coaches: options.coaches })) return
    files.push('this train is formed of', `numbers.${options.coaches}`, 'coaches')

    files.push('platform', `numbers.${options.platform}`, 'for the', `times.hour.${options.hour}`, `times.mins.${options.min}`, {
      id: this.getTocAudioId(options.toc),
      opts: { delayStart: 150 },
    })

    if (options.via && options.via !== 'none') {
      files.push(`stations.high.${options.terminatingStationCode}`, 'via', `stations.low.${options.via}`)
    } else {
      files.push(`stations.low.${options.terminatingStationCode}`)
    }

    await this.playAudioFiles(files, download)
  }

  private validateOptions({ stationsHigh, stationsLow, hour, minute, toc, platform, coaches }: Partial<IValidateOptions>): boolean {
    if (platform && !(AVAILABLE_ALPHANUMBERS as any as string[]).includes(platform)) {
      this.showAudioNotExistsError(`numbers.${platform}`)
      return false
    }

    if (hour && !(AVAILABLE_HOURS as any as string[]).includes(hour)) {
      this.showAudioNotExistsError(`times.hour.${hour}`)
      return false
    }

    if (minute && !(AVAILABLE_MINUTES as any as string[]).includes(minute)) {
      this.showAudioNotExistsError(`times.mins.${minute}`)
      return false
    }

    if (toc && !(AVAILABLE_TOCS as any as string[]).some(t => t.toLowerCase() === toc.toLowerCase())) {
      this.showAudioNotExistsError(`tocs.${toc.toLowerCase()} service to`)
      return false
    }

    if (coaches && !(AVAILABLE_NUMBERS as any as string[]).includes(coaches)) {
      this.showAudioNotExistsError(`numbers.${coaches}`)
      return false
    }

    if (stationsLow) {
      const stnLo = stationsLow.find(stn => !(AVAILABLE_STATIONS.low as any as string[]).includes(stn))
      if (stnLo) {
        this.showAudioNotExistsError(`stations.low.${stnLo}`)
        return false
      }
    }

    if (stationsHigh) {
      const stnHi = stationsHigh.find(stn => !(AVAILABLE_STATIONS.high as any as string[]).includes(stn))
      if (stnHi) {
        console.log(stnHi)

        this.showAudioNotExistsError(`stations.high.${stnHi}`)
        return false
      }
    }

    return true
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab> = {
    nextTrain: {
      name: 'Next train',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playNextTrainAnnouncement.bind(this),
        options: {
          chime: {
            name: 'Chime',
            type: 'select',
            default: '4',
            options: [
              { title: '3 chimes', value: '3' },
              { title: '4 chimes', value: '4' },
              { title: 'No chime', value: 'none' },
            ],
          },
          platform: {
            name: 'Platform',
            default: AVAILABLE_ALPHANUMBERS[0],
            options: AVAILABLE_ALPHANUMBERS.map(p => ({ title: `Platform ${p}`, value: p })),
            type: 'select',
          },
          hour: {
            name: 'Hour',
            default: AVAILABLE_HOURS[0],
            options: AVAILABLE_HOURS.map(h => ({ title: h, value: h })),
            type: 'select',
          },
          min: {
            name: 'Minute',
            default: AVAILABLE_MINUTES[0],
            options: AVAILABLE_MINUTES.map(m => ({ title: m, value: m })),
            type: 'select',
          },
          toc: {
            name: 'TOC',
            default: AVAILABLE_TOCS[0],
            options: AVAILABLE_TOCS.map(m => ({ title: m, value: m })),
            type: 'select',
          },
          terminatingStationCode: {
            name: 'Terminating station',
            default: AVAILABLE_STATIONS.low[0],
            options: AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value as typeof AVAILABLE_STATIONS.low[number])),
            type: 'select',
          },
          // via: {
          //   name: 'Via... (optional)',
          //   default: 'none',
          //   options: [
          //     { title: 'NONE', value: 'none' },
          //     ...AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value as typeof AVAILABLE_STATIONS.low[number])),
          //   ],
          //   type: 'select',
          // },
          callingAt: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: AVAILABLE_STATIONS.high,
            },
            default: [],
          },
          coaches: {
            name: 'Coach count',
            default: AVAILABLE_NUMBERS.filter(x => parseInt(x) > 1)[0],
            options: AVAILABLE_NUMBERS.filter(x => parseInt(x) > 1).map(c => ({ title: c, value: c })),
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
            label: '3 chimes',
            play: this.playAudioFiles.bind(this, ['3 chime']),
            download: this.playAudioFiles.bind(this, ['3 chime'], true),
          },
          {
            label: '4 chimes',
            play: this.playAudioFiles.bind(this, ['4 chime']),
            download: this.playAudioFiles.bind(this, ['4 chime'], true),
          },
        ],
      },
    },
  }
}
