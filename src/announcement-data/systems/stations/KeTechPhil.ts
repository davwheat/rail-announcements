import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'

interface INextTrainAnnouncementOptions {
  platform: typeof AVAILABLE_PLATFORMS[number]
  hour: typeof AVAILABLE_HOURS[number]
  min: typeof AVAILABLE_MINUTES[number]
  toc: typeof AVAILABLE_TOCS[number]
  terminatingStationCode: typeof AVAILABLE_STATIONS['low'][number]
  via: typeof AVAILABLE_STATIONS['low'][number] | 'none'
  callingAt: { crsCode: string; name: string; randomId: string }[]
  coaches: typeof AVAILABLE_COACHES[number]
}

interface IDepartingStationAnnouncementOptions {
  terminatesAtCode: string
  nextStationCode: string
}

const AVAILABLE_PLATFORMS = ['2', '2a', '3b', '4', '5', '8', '9', '11b'] as const
const AVAILABLE_HOURS = ['09', '12', '13', '14', '16'] as const
const AVAILABLE_MINUTES = ['01', '07', '10', '13', '16', '24', '28', '30', '32', '33', '34'] as const
const AVAILABLE_TOCS = ['Arriva Trains Wales', 'London Midland', 'Virgin Pendolino', 'Southern', 'South West Trains'] as const
const AVAILABLE_COACHES = ['2', '4', '5', '8', '9'] as const
const AVAILABLE_STATIONS = {
  low: ['AYW', 'BHM', 'BTN', 'CLJ', 'CSD', 'DKG', 'EPS', 'EUS', 'FNB', 'HMC', 'POO', 'RDC', 'SGB', 'SOU', 'STW', 'VIC', 'WAT', 'WIM'],
  high: [
    'ABH',
    'AHD',
    'ALV',
    'ANF',
    'ANG',
    'AVY',
    'AYW',
    'BAA',
    'BHI',
    'BHM',
    'BKA',
    'BOG',
    'BRH',
    'BRI',
    'BRV',
    'BSK',
    'BTG',
    'CCC',
    'CCH',
    'CLA',
    'CLG',
    'CLJ',
    'COV',
    'CRW',
    'CSA',
    'CSD',
    'CWS',
    'DUR',
    'DVY',
    'DYF',
    'EAD',
    'ECR',
    'EFF',
    'EMS',
    'EPS',
    'ESL',
    'EWW',
    'FLE',
    'FRB',
    'FRM',
    'FWY',
    'GBS',
    'GLD',
    'GTW',
    'HAV',
    'HOV',
    'HRH',
    'HRL',
    'HSY',
    'HYW',
    'KNG',
    'KNN',
    'LBR',
    'LDN',
    'LHD',
    'LIT',
    'LLC',
    'LLW',
    'LOB',
    'LRD',
    'MCN',
    'MFA',
    'MFF',
    'MOT',
    'NFD',
    'NWT',
    'PES',
    'PHG',
    'PLD',
    'PMH',
    'PNC',
    'PRH',
    'PTC',
    'PTM',
    'PWL',
    'RAY',
    'SAL',
    'SBS',
    'SHR',
    'SHW',
    'SLY',
    'SNL',
    'SNW',
    'SOA',
    'SOB',
    'SUR',
    'SWK',
    'TAL',
    'TBD',
    'TFC',
    'TTN',
    'TYW',
    'UNI',
    'WCP',
    'WFJ',
    'WIM',
    'WLN',
    'WLP',
    'WOK',
    'WRH',
    'WVH',
    'WWO',
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

export default class KeTechPhil extends StationAnnouncementSystem {
  readonly NAME = 'KeTech - Phil Sayer'
  readonly ID = 'KETECH_PHIL_V1'
  readonly FILE_PREFIX = 'station/ketech/phil'
  readonly SYSTEM_TYPE = 'station'

  private async playNextTrainAnnouncement(options: INextTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    if (!this.validateOptions({ platform: options.platform, hour: options.hour, minute: options.min, toc: options.toc })) return

    files.push('3 chime', 'platform', `platforms.${options.platform}`, 'for the', `times.hour.${options.hour}`, `times.mins.${options.min}`, {
      id: `tocs.${options.toc.toLowerCase()} service to`,
      opts: { delayStart: 150 },
    })

    if (options.via !== 'none') {
      if (!this.validateOptions({ stationsHigh: [options.terminatingStationCode], stationsLow: [options.via] })) return
      files.push(`stations.high.${options.terminatingStationCode}`, 'via', `stations.low.${options.via}`)
    } else {
      if (!this.validateOptions({ stationsLow: [options.terminatingStationCode] })) return
      files.push(`stations.low.${options.terminatingStationCode}`)
    }

    files.push({ id: 'calling at', opts: { delayStart: 750 } })

    const callingAtStops = options.callingAt.map(stn => stn.crsCode)
    if (!this.validateOptions({ stationsHigh: callingAtStops })) return
    files.push(...this.pluraliseAudio([...callingAtStops.map(stn => `stations.high.${stn}`), `stations.low.${options.terminatingStationCode}`]))

    // Platforms share the same audio as coach numbers
    if (!this.validateOptions({ coaches: options.coaches })) return
    files.push('this train is formed of', `platforms.${options.coaches}`, 'coaches')

    files.push(
      { id: 'platform', opts: { delayStart: 750 } },
      `platforms.${options.platform}`,
      'for the',
      `times.hour.${options.hour}`,
      `times.mins.${options.min}`,
      {
        id: `tocs.${options.toc.toLowerCase()} service to`,
        opts: { delayStart: 150 },
      },
    )

    if (options.via !== 'none') {
      files.push(`stations.high.${options.terminatingStationCode}`, 'via', `stations.low.${options.via}`)
    } else {
      files.push(`stations.low.${options.terminatingStationCode}`)
    }

    await this.playAudioFiles(files, download)
  }

  private validateOptions({ stationsHigh, stationsLow, hour, minute, toc, platform, coaches }: Partial<IValidateOptions>): boolean {
    if (platform && !(AVAILABLE_PLATFORMS as any as string[]).includes(platform)) {
      this.showAudioNotExistsError(`platforms.${platform}`)
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

    if (coaches && !(AVAILABLE_COACHES as any as string[]).includes(coaches)) {
      this.showAudioNotExistsError(`platforms.${coaches}`)
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
          platform: {
            name: 'Platform',
            default: AVAILABLE_PLATFORMS[0],
            options: AVAILABLE_PLATFORMS.map(p => ({ title: `Platform ${p}`, value: p })),
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
            options: AVAILABLE_TOCS.map(m => ({ title: m, value: m.toLowerCase() })),
            type: 'select',
          },
          terminatingStationCode: {
            name: 'Terminating station',
            default: AVAILABLE_STATIONS.low[0],
            options: AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value as typeof AVAILABLE_STATIONS.low[number])),
            type: 'select',
          },
          via: {
            name: 'Via... (optional)',
            default: 'none',
            options: [
              { title: 'NONE', value: 'none' },
              ...AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value as typeof AVAILABLE_STATIONS.low[number])),
            ],
            type: 'select',
          },
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
            default: AVAILABLE_COACHES[0],
            options: AVAILABLE_COACHES.map(c => ({ title: c, value: c })),
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
