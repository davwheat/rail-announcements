import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'

interface INextTrainAnnouncementOptions {
  platform: string
  hour: string
  min: string
  toc: string
  terminatingStationCode: string
  via: string | 'none'
  callingAt: { crsCode: string; name: string; randomId: string }[]
  coaches: string
}

interface IDepartingStationAnnouncementOptions {
  terminatesAtCode: string
  nextStationCode: string
}

const AVAILABLE_HOURS = ['07', '08', '13']
const AVAILABLE_MINUTES = ['03', '08', '27', '33', '36', '53', '57']
const AVAILABLE_TOCS = ['Southern', 'Thameslink']
const AVAILABLE_NUMBERS = ['4', '5', '6', '7', '8', '10', '12', '13', '14', '21']
const AVAILABLE_PLATFORMS = {
  /**
   * Used for the 'stand clear' announcement
   */
  low: ['2'],
  high: ['2', '3', '4'],
}
const AVAILABLE_STATIONS = {
  low: ['BDM', 'BOG', 'BTN', 'EBN', 'FOD', 'HOV', 'LBG', 'LIT', 'LWS', 'NRB', 'NWD', 'NXG'],
  high: [
    'AGT',
    'AMY',
    'ANG',
    'ARU',
    'BAA',
    'BCY',
    'BDM',
    'BFR',
    'BIG',
    'BUG',
    'CCH',
    'CHH',
    'CRW',
    'CSA',
    'CTK',
    'DUR',
    'EDW',
    'EMS',
    'EWR',
    'FLT',
    'FOD',
    'FOH',
    'FRM',
    'FSG',
    'GBS',
    'GTW',
    'HAV',
    'HHE',
    'HLN',
    'HOV',
    'HPA',
    'HPD',
    'HRH',
    'HSK',
    'LAC',
    'LBG',
    'LEA',
    'LIT',
    'LTN',
    'LUT',
    'NDL',
    'NRB',
    'NWD',
    'PLD',
    'PMR',
    'PNW',
    'PRP',
    'PTC',
    'PUL',
    'QRP',
    'SAC',
    'SBM',
    'SBS',
    'SNW',
    'SOB',
    'SOU',
    'SRC',
    'SRS',
    'STE',
    'STP',
    'SWK',
    'SYD',
    'TBD',
    'TTH',
    'TUH',
    'WRH',
    'WWO',
    'ZFD',
  ],
}
const AVAILABLE_DISRUPTION_REASONS = ['a road vehicle colliding with a bridge earlier today', 'a speed restriction over defective track']

interface IValidateOptions {
  stationsHigh: string[]
  stationsLow: string[]
  hour: string
  minute: string
  toc: string
  platformLow: string
  platformHigh: string
  number: string
  disruptionReason: string
}

export default class AtosMatt extends StationAnnouncementSystem {
  readonly NAME = 'ATOS - Matt Streeton'
  readonly ID = 'ATOS_MATT_V1'
  readonly FILE_PREFIX = 'station/atos/matt'
  readonly SYSTEM_TYPE = 'station'

  /**
   * @returns "Platform X for the HH:mm YYYYYY service to ZZZZ (via AAAA)."
   */
  private assembleTrainInfo({ platform, hour, min, toc, via, terminatingStationCode }): AudioItem[] {
    const files = [
      `platforms.high.platform ${platform}`,
      'for the',
      `times.hour.${hour}`,
      `times.mins.${min}`,
      {
        id: `tocs.${toc.toLowerCase()}`,
        opts: { delayStart: 75 },
      },
      `service to`,
    ]

    if (via !== 'none') {
      if (!this.validateOptions({ stationsHigh: [terminatingStationCode], stationsLow: [via] })) return
      files.push(`stations.high.${terminatingStationCode}`, 'via', `stations.low.${via}`)
    } else {
      if (!this.validateOptions({ stationsLow: [terminatingStationCode] })) return
      files.push(`stations.low.${terminatingStationCode}`)
    }

    return files
  }

  private async playNextTrainAnnouncement(options: INextTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    if (!this.validateOptions({ platformHigh: options.platform, hour: options.hour, minute: options.min, toc: options.toc })) return
    files.push(...this.assembleTrainInfo(options))

    files.push({ id: 'calling at', opts: { delayStart: 750 } })

    if (options.callingAt.length === 0) {
      if (!this.validateOptions({ stationsHigh: [options.terminatingStationCode] })) return
      files.push(`stations.high.${options.terminatingStationCode}`, 'only')
    } else {
      const callingAtStops = options.callingAt.map(stn => stn.crsCode)
      if (!this.validateOptions({ stationsHigh: callingAtStops })) return
      files.push(
        ...this.pluraliseAudio([...callingAtStops.map(stn => `stations.high.${stn}`), `stations.low.${options.terminatingStationCode}`]),
      )
    }

    // Platforms share the same audio as coach numbers
    if (!this.validateOptions({ number: options.coaches })) return
    files.push('this train is formed of', `numbers.${options.coaches}`, 'coaches')

    files.push(...this.assembleTrainInfo(options))

    await this.playAudioFiles(files, download)
  }

  private validateOptions({
    stationsHigh,
    stationsLow,
    hour,
    minute,
    toc,
    platformLow,
    platformHigh,
    number,
    disruptionReason,
  }: Partial<IValidateOptions>): boolean {
    if (platformLow && !AVAILABLE_PLATFORMS.low.includes(platformLow)) {
      this.showAudioNotExistsError(`platforms.low.platform ${platformLow}`)
      return false
    }
    if (platformHigh && !AVAILABLE_PLATFORMS.high.includes(platformHigh)) {
      this.showAudioNotExistsError(`platforms.high.platform ${platformHigh}`)
      return false
    }

    if (hour && !AVAILABLE_HOURS.includes(hour)) {
      this.showAudioNotExistsError(`times.hour.${hour}`)
      return false
    }

    if (minute && !AVAILABLE_MINUTES.includes(minute)) {
      this.showAudioNotExistsError(`times.mins.${minute}`)
      return false
    }

    if (toc && !AVAILABLE_TOCS.some(t => t.toLowerCase() === toc.toLowerCase())) {
      this.showAudioNotExistsError(`tocs.${toc.toLowerCase()}`)
      return false
    }

    if (number && !AVAILABLE_NUMBERS.includes(number)) {
      this.showAudioNotExistsError(`numbers.${number}`)
      return false
    }

    if (disruptionReason && !AVAILABLE_DISRUPTION_REASONS.includes(disruptionReason)) {
      this.showAudioNotExistsError(`disruption-reasons.${disruptionReason}`)
      return false
    }

    if (stationsLow) {
      const stnLo = stationsLow.find(stn => !AVAILABLE_STATIONS.low.includes(stn))
      if (stnLo) {
        this.showAudioNotExistsError(`stations.low.${stnLo}`)
        return false
      }
    }

    if (stationsHigh) {
      const stnHi = stationsHigh.find(stn => !AVAILABLE_STATIONS.high.includes(stn))
      if (stnHi) {
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
            default: AVAILABLE_PLATFORMS.high[0],
            options: AVAILABLE_PLATFORMS.high.map(p => ({ title: `Platform ${p}`, value: p })),
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
            options: AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value)),
            type: 'select',
          },
          via: {
            name: 'Via... (optional)',
            default: 'none',
            options: [{ title: 'NONE', value: 'none' }, ...AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value))],
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
            default: AVAILABLE_NUMBERS[0],
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
