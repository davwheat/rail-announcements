import React from 'react'

import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import AtosDisruptionAlternatives, { IAlternativeServicesState } from '@components/AtosDisruptionAlternatives'
import { nanoid } from 'nanoid'

interface INextTrainAnnouncementOptions {
  platform: string
  hour: string
  min: string
  toc: string
  terminatingStationCode: string
  via: string | 'none'
  callingAt: { crsCode: string; name: string; randomId: string }[]
  coaches: string
  seating: string
  special: string[]
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
  disruptionType: 'delayed' | 'cancelled'
  platform: string
  alternativeServices: IAlternativeServicesState
}

const AVAILABLE_HOURS = ['07', '08', '09', '13', '16']
const AVAILABLE_MINUTES = ['03', '04', '08', '11', '21', '25', '27', '33', '36', '38', '40', '53', '57']
const AVAILABLE_TOCS = ['Southern', 'Thameslink']
const AVAILABLE_NUMBERS = ['5', '6', '7', '8', '10', '12', '13', '14', '21', '41', '45', '53', '55', '61']
const AVAILABLE_PLATFORMS = {
  low: ['2'],
  high: ['1', '2', '3', '4'],
}
const AVAILABLE_STATIONS = {
  low: ['ANG', 'BDM', 'BOG', 'BTN', 'CBR', 'DUR', 'EBN', 'FOD', 'GBS', 'HOV', 'LBG', 'LIT', 'LWS', 'NRB', 'NWD', 'NXG', 'ORE'],
  high: [
    'AGT',
    'AMY',
    'ANG',
    'ARU',
    'BAA',
    'BCY',
    'BDM',
    'BEX',
    'BFR',
    'BIG',
    'BUG',
    'CCH',
    'CHH',
    'CLL',
    'COB',
    'CRW',
    'CSA',
    'CTK',
    'DUR',
    'EBN',
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
    'HGS',
    'HHE',
    'HLN',
    'HMD',
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
    'LWS',
    'NDL',
    'NRB',
    'NWD',
    'PEV',
    'PLD',
    'PLG',
    'PMP',
    'PMR',
    'PNW',
    'PRP',
    'PTC',
    'PUL',
    'QRP',
    'RDH',
    'SAC',
    'SBM',
    'SSE',
    'SLQ',
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
    'WVF',
    'WWO',
    'ZFD',
  ],
}
const AVAILABLE_DISRUPTION_REASONS = [
  'a road vehicle colliding with a bridge earlier today',
  'a speed restriction over defective track',
  'a late running train being in front of this one',
  'a shortage of train crew',
  'a fault with the signalling system earlier today',
  'the emergency services dealing with an incident',
  'emergency services dealing with an incident near the railway',
  'urgent repairs to the track',
].sort()
const AVAILABLE_SEATING_AVAILABILITY = []
const AVAILABLE_SPECIAL_REMARKS = [
  {
    title: 'Make sure you have the correct ticket',
    value: 'please make sure you have the correct ticket to travel on this service',
  },
  {
    title: 'GTR - You must wear a face covering',
    value: 'you must wear a face covering whilst on the station and on the train unless you are exempt',
  },
]

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
  seating: string
  special: string[]
}

const AnnouncementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  nextTrain: [
    {
      name: '13:57 | HHE to LIT',
      state: {
        platform: '1',
        hour: '13',
        min: '57',
        toc: 'southern',
        terminatingStationCode: 'LIT',
        via: 'HOV',
        callingAt: ['BUG', 'HSK', 'PRP', 'HOV', 'PLD', 'SSE', 'LAC', 'WRH', 'WWO', 'DUR', 'GBS', 'ANG'].map(crsToStationItemMapper),
        coaches: '8',
        seating: 'none',
        special: [],
      },
    },
  ],
  disruptedTrain: [
    {
      name: '07:36 | BTN (+21m)',
      state: {
        hour: '07',
        min: '36',
        toc: 'thameslink',
        terminatingStationCode: 'BTN',
        via: 'none',
        disruptionType: 'delayed',
        delayTime: '21',
        disruptionReason: 'a fault with the signalling system earlier today',
        platform: '2',
        alternativeServices: [
          {
            randomId: nanoid(),
            passengersFor: ['WVF'].map(crsToStationItemMapper),
            service: {
              hour: '07',
              minute: '33',
              terminatingCrs: 'EBN',
              via: 'LWS',
              platform: '2',
            },
          },
          {
            randomId: nanoid(),
            passengersFor: ['BUG', 'PRP'].map(crsToStationItemMapper),
            service: {
              hour: '07',
              minute: '40',
              terminatingCrs: 'LIT',
              via: 'HOV',
              platform: '2',
            },
          },
          {
            randomId: nanoid(),
            passengersFor: ['HSK'].map(crsToStationItemMapper),
            service: {
              hour: '07',
              minute: '57',
              terminatingCrs: 'BTN',
              via: 'none',
              platform: '2',
            },
          },
        ],
      },
    },
    {
      name: '16:38 | BTN (+61m)',
      state: {
        hour: '16',
        min: '38',
        toc: 'thameslink',
        terminatingStationCode: 'BTN',
        via: 'none',
        disruptionType: 'delayed',
        delayTime: '61',
        disruptionReason: 'emergency services dealing with an incident near the railway',
        platform: '1',
        alternativeServices: [
          {
            randomId: nanoid(),
            passengersFor: ['BUG'].map(crsToStationItemMapper),
            service: {
              hour: '16',
              minute: '21',
              terminatingCrs: 'BTN',
              via: 'none',
              platform: '2',
            },
          },
        ],
      },
    },
    {
      name: '08:33 to LIT cancelled',
      state: {
        hour: '08',
        min: '33',
        toc: 'southern',
        terminatingStationCode: 'LIT',
        via: 'HOV',
        disruptionType: 'cancelled',
        delayTime: 'unknown',
        disruptionReason: 'a road vehicle colliding with a bridge earlier today',
        platform: '2',
        alternativeServices: [
          {
            randomId: nanoid(),
            passengersFor: ['BUG', 'HSK'].map(crsToStationItemMapper),
            service: {
              hour: '08',
              minute: '36',
              terminatingCrs: 'BTN',
              via: 'none',
              platform: '2',
            },
          },
          {
            randomId: nanoid(),
            passengersFor: ['HOV', 'PLD', 'SSE', 'LAC', 'WRH', 'WWO', 'DUR', 'GBS', 'ANG'].map(crsToStationItemMapper),
            service: {
              hour: '09',
              minute: '33',
              terminatingCrs: 'LIT',
              via: 'HOV',
              platform: '2',
            },
          },
        ],
      },
    },
  ],
}

export default class AtosMatt extends StationAnnouncementSystem {
  readonly NAME = 'ATOS - Matt Streeton'
  readonly ID = 'ATOS_MATT_V1'
  readonly FILE_PREFIX = 'station/atos/matt'
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

    if (options.seating && options.seating !== 'none') {
      if (!this.validateOptions({ seating: options.seating })) return

      files.push(`seating.${options.seating}`)
    }

    if (options.special) {
      if (!this.validateOptions({ special: options.special })) return

      files.push(...options.special.map(s => ({ id: `special.${s}`, opts: { delayStart: 750 } })))
    }

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

  private async playDisruptedTrainAnnouncement(options: IDelayedTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const { delayTime, disruptionReason, disruptionType, platform } = options
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

    if (disruptionType === 'cancelled') {
      if (
        !this.validateOptions({
          platformLow: platform,
        })
      )
        return

      files.push('may i have your attention please on', `platforms.low.platform ${platform}`)
    }

    files.push(
      disruptionType === 'delayed' ? 'we are sorry that the' : 'we are sorry to announce that the',
      ...this.assembleTrainInfo({ ...options }),
    )

    if (disruptionType === 'delayed') {
      if (delayTime === 'unknown') {
        files.push('is delayed')
      } else {
        files.push('is delayed by approximately', `numbers.${delayTime}`, 'minutes')
      }
    } else if (disruptionType === 'cancelled') {
      files.push('has been cancelled')
    }

    if (disruptionReason !== 'unknown') {
      files.push({ id: 'this is due to', opts: { delayStart: 250 } }, `disruption-reasons.${disruptionReason}`)
    }

    if (disruptionType === 'delayed' && delayTime === 'unknown') {
      files.push('please listen for further announcements')
    }

    // Only play if delay time is known or is cancelled, else the faster alternate services are not actually known
    if ((delayTime !== 'unknown' || disruptionType === 'cancelled') && options.alternativeServices.length > 0) {
      options.alternativeServices.forEach(alternativeService => {
        const { hour, minute, platform, terminatingCrs, via } = alternativeService.service

        if (
          !this.validateOptions({
            hour,
            minute,
            platformLow: platform,
            stationsHigh: alternativeService.passengersFor.map(stop => stop.crsCode),
          })
        )
          return

        files.push(
          { id: 'passengers for', opts: { delayStart: 400 } },
          ...this.pluraliseAudio(alternativeService.passengersFor.map(stop => `stations.high.${stop.crsCode}`)),
          'your next fastest direct service is now expected to be the',
          `times.hour.${hour}`,
          `times.mins.${minute}`,
          'to',
        )

        if (via !== 'none') {
          if (!this.validateOptions({ stationsHigh: [terminatingCrs], stationsLow: [via] })) return
          files.push(`stations.high.${terminatingCrs}`, 'via', `stations.low.${via}`)
        } else {
          if (!this.validateOptions({ stationsLow: [terminatingCrs] })) return
          files.push(`stations.low.${terminatingCrs}`)
        }

        files.push('departing from', `platforms.low.platform ${platform}`)
      })
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
    seating,
    special,
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

    if (seating && !AVAILABLE_SEATING_AVAILABILITY.includes(seating)) {
      this.showAudioNotExistsError(`seating.${seating}`)
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

    if (special) {
      const specialF = special.find(s => !AVAILABLE_SPECIAL_REMARKS.find(r => r.value))
      if (specialF) {
        this.showAudioNotExistsError(`special.${specialF}`)
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
            default: AVAILABLE_TOCS[0].toLowerCase(),
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
            default: AVAILABLE_NUMBERS.filter(x => parseInt(x) > 1)[0],
            options: AVAILABLE_NUMBERS.filter(x => parseInt(x) > 1).map(c => ({ title: c, value: c })),
            type: 'select',
          },
          seating: {
            name: 'Seating availability',
            default: 'none',
            options: [{ title: '<not stated>', value: 'none' }, ...AVAILABLE_SEATING_AVAILABILITY.map(c => ({ title: c, value: c }))],
            type: 'select',
          },
          special: {
            name: 'Special remarks',
            default: [],
            options: AVAILABLE_SPECIAL_REMARKS,
            type: 'multiselect',
          },
        },
      },
    },
    fastTrain: {
      name: 'Fast train',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playThroughTrainAnnouncement.bind(this),
        options: {
          platform: {
            name: 'Platform',
            default: AVAILABLE_PLATFORMS.low.filter(x => AVAILABLE_PLATFORMS.high.includes(x))[0],
            options: AVAILABLE_PLATFORMS.low.filter(x => AVAILABLE_PLATFORMS.high.includes(x)).map(p => ({ title: `Platform ${p}`, value: p })),
            type: 'select',
          },
        },
      },
    },
    disruptedTrain: {
      name: 'Delayed/cancelled train',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playDisruptedTrainAnnouncement.bind(this),
        presets: AnnouncementPresets.disruptedTrain,
        options: {
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
            default: AVAILABLE_TOCS[0].toLowerCase(),
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
          disruptionType: {
            name: '',
            type: 'custom',
            default: 'delayed',
            component: ({ value, onChange }) => {
              return (
                <fieldset>
                  <legend>Disruption type</legend>
                  <input
                    type="radio"
                    id="disruptionTypeDelay"
                    checked={value === 'delayed'}
                    name="disruptionType"
                    onChange={e => {
                      if (e.target.checked) {
                        onChange('delayed')
                      }
                    }}
                  />
                  <label htmlFor="disruptionTypeDelay">Delay</label>
                  <input
                    type="radio"
                    id="disruptionTypeCancel"
                    checked={value === 'cancelled'}
                    name="disruptionType"
                    onChange={e => {
                      if (e.target.checked) {
                        onChange('cancelled')
                      }
                    }}
                  />
                  <label htmlFor="disruptionTypeCancel">Cancelled</label>
                </fieldset>
              )
            },
            props: {},
          },
          delayTime: {
            name: '',
            type: 'custom',
            default: 'unknown',
            component: ({ activeState, value, onChange, availableDelayTimes }) => {
              if (activeState.disruptionType !== 'delayed') {
                return null
              }

              return (
                <label>
                  Delay time
                  <select
                    value={value}
                    onChange={e => {
                      onChange({ ...value, delayTime: e.target.value })
                    }}
                  >
                    {availableDelayTimes.map(d => (
                      <option key={d.value} value={d.value}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
              )
            },
            props: {
              availableDelayTimes: [
                { title: 'Unknown', value: 'unknown' },
                ...AVAILABLE_NUMBERS.map(h => ({ title: `${h} minute(s)`, value: h })),
              ],
            },
          },
          platform: {
            name: '',
            type: 'custom',
            default: AVAILABLE_PLATFORMS.low[0],
            component: ({ activeState, value, onChange, availablePlatforms }) => {
              if (activeState.disruptionType !== 'cancelled') {
                return null
              }

              return (
                <label>
                  Platform
                  <select
                    value={value}
                    onChange={e => {
                      onChange({ ...value, platform: e.target.value })
                    }}
                  >
                    {availablePlatforms.map(d => (
                      <option key={d.value} value={d.value}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
              )
            },
            props: {
              availablePlatforms: AVAILABLE_PLATFORMS.low.map(p => ({ title: `Platform ${p}`, value: p })),
            },
          },
          disruptionReason: {
            name: 'Delay reason',
            default: 'unknown',
            options: [{ title: 'Unknown', value: 'unknown' }, ...AVAILABLE_DISRUPTION_REASONS.map(h => ({ title: h, value: h.toLowerCase() }))],
            type: 'select',
          },
          alternativeServices: {
            name: '',
            type: 'custom',
            component: AtosDisruptionAlternatives,
            props: {
              availableStations: AVAILABLE_STATIONS,
              hours: AVAILABLE_HOURS,
              mins: AVAILABLE_MINUTES,
              platforms: AVAILABLE_PLATFORMS,
            },
            default: [],
          },
        },
      },
    },
    // announcementButtons: {
    //   name: 'Announcement buttons',
    //   component: CustomButtonPane,
    //   props: {
    //     buttons: [
    //       {
    //         label: '3 chimes',
    //         play: this.playAudioFiles.bind(this, ['3 chime']),
    //         download: this.playAudioFiles.bind(this, ['3 chime'], true),
    //       },
    //       {
    //         label: '4 chimes',
    //         play: this.playAudioFiles.bind(this, ['4 chime']),
    //         download: this.playAudioFiles.bind(this, ['4 chime'], true),
    //       },
    //     ],
    //   },
    // },
  }
}
