import React from 'react'

import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import AtosDisruptionAlternatives, { IAlternativeServicesState } from '@components/AtosDisruptionAlternatives'
import createAnnouncementButton from '@helpers/createAnnouncementButton'

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

const AVAILABLE_HOURS = ['07', '12', '13', '15']
const AVAILABLE_MINUTES = ['06', '09', '11', '12', '16', '22', '28', '29', '44', '53', '54']
const AVAILABLE_TOCS = ['Southern', 'Thameslink', 'Arriva Trains Wales']
const AVAILABLE_DELAY_TIMES = ['6', '17', '23']
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
  low: ['BDM', 'CAT', 'CBG', 'PBO', 'STP', 'VIC'],
  high: [
    'ARL',
    'BAB',
    'BDK',
    'BDM',
    'BFR',
    'BIW',
    'CAT',
    'CBG',
    'CDS',
    'CLJ',
    'CTK',
    'ECR',
    'FLT',
    'FPK',
    'GTW',
    'HHE',
    'HIT',
    'HLN',
    'HOR',
    'HPD',
    'HRH',
    'HUN',
    'KLY',
    'LBG',
    'LEA',
    'LET',
    'LTN',
    'LUT',
    'MHM',
    'PUR',
    'RDH',
    'RYS',
    'SAC',
    'SBS',
    'SDY',
    'SNO',
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
const AVAILABLE_DISRUPTION_REASONS = [
  'a fault with the signalling system',
  'earlier engineering works not being finished on time',
  'engineering works not being finished on time',
].sort()
const AVAILABLE_SEATING_AVAILABILITY = ['there are usually many seats available on this train']
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
  coaches: string
  delayTime: string
  seating: string
  special: string[]
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
        coaches: '12',
        seating: 'none',
        special: [],
      },
    },
    {
      name: '15:29 | Crawley to Peterborough',
      state: {
        platform: '3',
        hour: '15',
        min: '29',
        toc: 'thameslink',
        terminatingStationCode: 'PBO',
        via: 'none',
        callingAt: [
          'TBD',
          'GTW',
          'HOR',
          'RDH',
          'MHM',
          'CDS',
          'ECR',
          'LBG',
          'BFR',
          'CTK',
          'ZFD',
          'STP',
          'FPK',
          'SVG',
          'HIT',
          'ARL',
          'BIW',
          'SDY',
          'SNO',
          'HUN',
        ].map(crsToStationItemMapper),
        coaches: '12',
        seating: 'there are usually many seats available on this train',
        special: [],
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
  private assembleTrainInfo({ hour, min, toc, via, terminatingStationCode, destAllHigh = false, delayStart = 0 }): AudioItem[] {
    const files: AudioItem[] = [
      { id: `times.hour.${hour}`, opts: { delayStart } },
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
      { id: 'please stand well clear of the edge of', opts: { delayStart: 400 } },
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
        delayTime: delayTime !== 'unknown' ? delayTime : undefined,
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
      disruptionType === 'delayed' ? 'we are sorry that the' : { id: 'we are sorry to announce that the', opts: { delayStart: 250 } },
      ...this.assembleTrainInfo({ ...options, destAllHigh: true, delayStart: 100 }),
    )

    if (disruptionType === 'delayed') {
      if (delayTime === 'unknown') {
        files.push('is delayed')
      } else {
        files.push('is delayed by approximately', `delay-times.${delayTime} minutes`)
      }
    } else if (disruptionType === 'cancelled') {
      files.push({ id: 'has been cancelled', opts: { delayStart: 100 } })
    }

    if (disruptionReason !== 'unknown') {
      files.push({ id: 'this is due to', opts: { delayStart: 500 } }, `disruption-reasons.${disruptionReason}`)
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

        files.push('departing from', { id: `platforms.low.platform ${platform}`, opts: { delayStart: 100 } })
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
    coaches,
    delayTime,
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

    if (coaches && !AVAILABLE_COACHES.includes(coaches)) {
      this.showAudioNotExistsError(`coaches.${coaches} coaches`)
      return false
    }

    if (delayTime && !AVAILABLE_DELAY_TIMES.includes(delayTime)) {
      this.showAudioNotExistsError(`delay-times.${delayTime} minutes`)
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
            default: AVAILABLE_COACHES[0],
            options: AVAILABLE_COACHES.map(c => ({ title: c, value: c })),
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
            default: AVAILABLE_STATIONS.high[0],
            options: AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.high.includes(s.value)),
            type: 'select',
          },
          via: {
            name: 'Via... (optional)',
            default: 'none',
            options: [{ title: 'NONE', value: 'none' }, ...AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.high.includes(s.value))],
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
            // default: 'unknown',
            default: AVAILABLE_DELAY_TIMES[0],
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
                      onChange(e.target.value)
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
                // { title: 'Unknown', value: 'unknown' },
                ...AVAILABLE_DELAY_TIMES.map(h => ({ title: `${h} minute(s)`, value: h })),
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
                      onChange(e.target.value)
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
    announcementButtons: {
      name: 'Other announcements',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          General: [createAnnouncementButton(this.playAudioFiles.bind(this), 'BTP 61016', ['61016'])],
          'GTR custom announcements': [
            createAnnouncementButton(this.playAudioFiles.bind(this), 'Doors will close 30s before departure', [
              {
                id: 'gtr - doors will be closed and locked 30s prior',
                opts: { customPrefix: 'station/atos/custom' },
              },
            ]),
            createAnnouncementButton(this.playAudioFiles.bind(this), 'If you feel unwell, give staff a shout', [
              {
                id: 'gtr - if youre feeling unwell stay on the platform and give one of our colleagues a shout',
                opts: { customPrefix: 'station/atos/custom' },
              },
            ]),
            createAnnouncementButton(this.playAudioFiles.bind(this), 'Remain behind the yellow line', [
              {
                id: 'gtr - remain behind yellow line for safety',
                opts: { customPrefix: 'station/atos/custom' },
              },
            ]),
            createAnnouncementButton(this.playAudioFiles.bind(this), 'Surfaces may be slippery', [
              {
                id: 'gtr - slippery conditions',
                opts: { customPrefix: 'station/atos/custom' },
              },
            ]),
            createAnnouncementButton(this.playAudioFiles.bind(this), 'Very cold weather', [
              {
                id: 'gtr - very cold weather take care',
                opts: { customPrefix: 'station/atos/custom' },
              },
            ]),
          ],
          'GTR engineering works': [
            createAnnouncementButton(this.playAudioFiles.bind(this), '6/7 Nov 2021 - Three Bridges', [
              {
                id: 'gtr - 6 7 nov 2021 - engineering works three bridges',
                opts: { customPrefix: 'station/atos/custom' },
              },
            ]),
            createAnnouncementButton(this.playAudioFiles.bind(this), '28 May 2021 - No trains London Victoria', [
              {
                id: 'gtr - 28 may 2021 - this bank holiday no southern trains victoria',
                opts: { customPrefix: 'station/atos/custom' },
              },
            ]),
          ],
        },
      },
    },
  }
}
