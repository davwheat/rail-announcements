import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'

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

interface IThroughTrainAnnouncementOptions {
  platform: string
}

interface IDelayedTrainAnnouncementOptions {
  hour: string
  min: string
  toc: string
  terminatingStationCode: string
  via: string | 'none'
  delayTime: string
  disruptionReason: string
}

const AVAILABLE_HOURS = ['07', '12', '13', '15']
const AVAILABLE_MINUTES = ['11', '12', '16', '28', '29', '44', '54']
const AVAILABLE_TOCS = ['Southern', 'Thameslink', 'Arriva Trains Wales']
const AVAILABLE_NUMBERS = ['2', '10', '12']
const AVAILABLE_PLATFORMS = {
  /**
   * Used for the 'stand clear' announcement
   */
  low: ['3', '6'],
  high: ['1', '3'],
}
const AVAILABLE_COACHES = ['8', '10', '12']
const AVAILABLE_STATIONS = {
  low: ['BDM', 'CAT', 'CBG', 'STP', 'VIC'],
  high: [
    'BAB',
    'BDK',
    'BDM',
    'BFR',
    'CAT',
    'CBG',
    'CLJ',
    'CTK',
    'ECR',
    'FLT',
    'FPK',
    'GTW',
    'HHE',
    'HIT',
    'HLN',
    'HPD',
    'KLY',
    'LBG',
    'LEA',
    'LET',
    'LTN',
    'LUT',
    'PUR',
    'RYS',
    'SAC',
    'SBS',
    'STP',
    'SVG',
    'TBD',
    'VIC',
    'WHP',
    'WHS',
    'WHY',
    'ZFD',
  ],
}
const AVAILABLE_DISRUPTION_REASONS = []

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
  coaches: string
}

const AnnouncementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  nextTrain: [
    {
      name: '07:11 | Brighton to Cambridge',
      state: {
        platform: '1',
        hour: '07',
        min: '11',
        toc: 'thameslink',
        terminatingStationCode: 'CBG',
        via: 'none',
        callingAt: ['HHE', 'BAB', 'TBD', 'GTW', 'ECR', 'LBG', 'BFR', 'CTK', 'ZFD', 'STP', 'FPK', 'SVG', 'HIT', 'LET', 'BDK', 'RYS'].map(
          crsToStationItemMapper,
        ),
        coaches: '8',
      },
    },
  ],
}

export default class AtosAnne extends StationAnnouncementSystem {
  readonly NAME = 'ATOS - Anne'
  readonly ID = 'ATOS_ANNE_V1'
  readonly FILE_PREFIX = 'station/atos/anne'
  readonly SYSTEM_TYPE = 'station'

  /**
   * @returns "Platform X for the HH:mm YYYYYY service to ZZZZ (via AAAA)."
   */
  private assembleTrainInfo({ hour, min, toc, via, terminatingStationCode, destAllHigh = false }): AudioItem[] {
    const files = [
      `times.hour.${hour}`,
      `times.mins.${min}`,
      {
        id: `tocs.${toc.toLowerCase()}`,
        opts: { delayStart: 75 },
      },
      `service to`,
    ]

    if (destAllHigh) {
      if (via !== 'none') {
        if (!this.validateOptions({ stationsHigh: [terminatingStationCode, via] })) return
        files.push(`stations.high.${terminatingStationCode}`, 'via', `stations.high.${via}`)
      } else {
        if (!this.validateOptions({ stationsHigh: [terminatingStationCode] })) return
        files.push(`stations.high.${terminatingStationCode}`)
      }
    } else {
      if (via !== 'none') {
        if (!this.validateOptions({ stationsHigh: [terminatingStationCode], stationsLow: [via] })) return
        files.push(`stations.high.${terminatingStationCode}`, 'via', `stations.low.${via}`)
      } else {
        if (!this.validateOptions({ stationsLow: [terminatingStationCode] })) return
        files.push(`stations.low.${terminatingStationCode}`)
      }
    }

    return files
  }

  private async playNextTrainAnnouncement(options: INextTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    if (!this.validateOptions({ platformHigh: options.platform, hour: options.hour, minute: options.min, toc: options.toc })) return

    files.push(`platforms.high.platform ${options.platform}`, 'for the')
    files.push(...this.assembleTrainInfo(options))

    files.push({ id: 'calling at', opts: { delayStart: 750 } })

    if (options.callingAt.length === 0) {
      if (!this.validateOptions({ stationsHigh: [options.terminatingStationCode] })) return
      // TODO: only
      files.push(`stations.high.${options.terminatingStationCode}` /*, 'only'*/)
    } else {
      const callingAtStops = options.callingAt.map(stn => stn.crsCode)
      if (!this.validateOptions({ stationsHigh: callingAtStops })) return
      files.push(
        ...this.pluraliseAudio([...callingAtStops.map(stn => `stations.high.${stn}`), `stations.low.${options.terminatingStationCode}`]),
      )
    }

    // Platforms share the same audio as coach numbers
    if (!this.validateOptions({ coaches: options.coaches })) return
    files.push('this train is formed of', `coaches.${options.coaches} coaches`)

    await this.playAudioFiles(files, download)
  }

  private async playThroughTrainAnnouncement(options: IThroughTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    if (!this.validateOptions({ platformHigh: options.platform, platformLow: options.platform })) return

    files.push(
      'the train now approaching',
      `platforms.high.platform ${options.platform}`,
      'does not stop here',
      'please stand well clear of the edge of',
      `platforms.low.platform ${options.platform}`,
    )

    await this.playAudioFiles(files, download)
  }

  private async playDelayedTrainAnnouncement(options: IDelayedTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const { delayTime, disruptionReason } = options
    const files: AudioItem[] = []

    if (
      !this.validateOptions({
        hour: options.hour,
        minute: options.min,
        toc: options.toc,
        number: delayTime !== 'unknown' ? delayTime : undefined,
        disruptionReason: disruptionReason !== 'unknown' ? disruptionReason : undefined,
      })
    )
      return

    files.push('we are sorry that the', ...this.assembleTrainInfo({ ...options, destAllHigh: true }))

    if (delayTime === 'unknown') {
      alert("We can't handle unknown delays yet as we're missing some audio recordings.")
      return
      // files.push('is delayed', 'please listen for further announcements')
    } else {
      files.push('is delayed by approximately', `numbers.${delayTime}`, 'minutes')
    }

    if (disruptionReason !== 'unknown') {
      files.push('this is due to', `disruption-reasons.${disruptionReason}`)
    }

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
    coaches,
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

    if (coaches && !AVAILABLE_COACHES.includes(coaches)) {
      this.showAudioNotExistsError(`coaches.${coaches} coaches`)
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
        presets: AnnouncementPresets.nextTrain,
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
            default: AVAILABLE_COACHES[0],
            options: AVAILABLE_COACHES.map(c => ({ title: c, value: c })),
            type: 'select',
          },
        },
      },
    },
    // fastTrain: {
    //   name: 'Fast train',
    //   component: CustomAnnouncementPane,
    //   props: {
    //     playHandler: this.playThroughTrainAnnouncement.bind(this),
    //     options: {
    //       platform: {
    //         name: 'Platform',
    //         default: AVAILABLE_PLATFORMS.low.filter(x => AVAILABLE_PLATFORMS.high.includes(x))[0],
    //         options: AVAILABLE_PLATFORMS.low.filter(x => AVAILABLE_PLATFORMS.high.includes(x)).map(p => ({ title: `Platform ${p}`, value: p })),
    //         type: 'select',
    //       },
    //     },
    //   },
    // },
    // delayedTrain: {
    //   name: 'Delayed train',
    //   component: CustomAnnouncementPane,
    //   props: {
    //     playHandler: this.playDelayedTrainAnnouncement.bind(this),
    //     options: {
    //       hour: {
    //         name: 'Hour',
    //         default: AVAILABLE_HOURS[0],
    //         options: AVAILABLE_HOURS.map(h => ({ title: h, value: h })),
    //         type: 'select',
    //       },
    //       min: {
    //         name: 'Minute',
    //         default: AVAILABLE_MINUTES[0],
    //         options: AVAILABLE_MINUTES.map(m => ({ title: m, value: m })),
    //         type: 'select',
    //       },
    //       toc: {
    //         name: 'TOC',
    //         default: AVAILABLE_TOCS[0],
    //         options: AVAILABLE_TOCS.map(m => ({ title: m, value: m.toLowerCase() })),
    //         type: 'select',
    //       },
    //       terminatingStationCode: {
    //         name: 'Terminating station',
    //         default: AVAILABLE_STATIONS.high[0],
    //         options: AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.high.includes(s.value)),
    //         type: 'select',
    //       },
    //       via: {
    //         name: 'Via... (optional)',
    //         default: 'none',
    //         options: [{ title: 'NONE', value: 'none' }, ...AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.high.includes(s.value))],
    //         type: 'select',
    //       },
    //       delayTime: {
    //         name: 'Delay time',
    //         default: AVAILABLE_NUMBERS[0],
    //         options: [{ title: 'Unknown', value: 'unknown' }, ...AVAILABLE_NUMBERS.map(h => ({ title: `${h} minute(s)`, value: h }))],
    //         type: 'select',
    //       },
    //       disruptionReason: {
    //         name: 'Delay reason',
    //         default: 'unknown',
    //         options: [{ title: 'Unknown', value: 'unknown' }, ...AVAILABLE_DISRUPTION_REASONS.map(h => ({ title: h, value: h.toLowerCase() }))],
    //         type: 'select',
    //       },
    //     },
    //   },
    // },
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttons: [
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
