import React from 'react'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'

interface IApproachingStationAnnouncementOptions {
  stationCode: string
  isAto: boolean
  terminatesHere: boolean
  takeCareAsYouLeave: boolean
  changeFor: string[]
}
interface IStoppedAtStationAnnouncementOptions {
  thisStationCode: string
  terminatesAtCode: string
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
  mindTheGap: boolean
}
interface IInitialDepartureAnnouncementOptions {
  terminatesAtCode: string
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  stopped: [
    {
      name: 'Burgess Hill to Bedford',
      state: {
        thisStationCode: 'BUG',
        terminatesAtCode: 'BDM',
        callingAtCodes: [
          'WVF',
          'HHE',
          'TBD',
          'GTW',
          'ECR',
          'LBG',
          'BFR',
          'CTK',
          'ZFD',
          'STP',
          'SAC',
          'HPD',
          'LTN',
          'LUT',
          'LEA',
          'HLN',
          'FLT',
        ].map(crsToStationItemMapper),
        mindTheGap: true,
      },
    },
    {
      name: 'Burgess Hill to Brighton',
      state: {
        thisStationCode: 'BUG',
        terminatesAtCode: 'BTN',
        callingAtCodes: ['HSK', 'PRP'].map(crsToStationItemMapper),
        mindTheGap: true,
      },
    },
  ],
}

export default class ThameslinkClass700 extends TrainAnnouncementSystem {
  readonly NAME = 'Thameslink Class 700 - Julie & Matt'
  readonly ID = 'TL_CLASS_700_V1'
  readonly FILE_PREFIX = 'TL/700'
  readonly SYSTEM_TYPE = 'train'

  private readonly StationsWithPointsOfInterest = ['BFR', 'CTK', 'LBG', 'STP', 'LTN']
  private readonly StationsWithForcedChangeHere = {
    LBG: { main: 'other national rail services', additional: 'LBG' },
    STP: { main: 'STP' },
    WIM: { main: 'WIM' },
  }

  private readonly OtherServicesAvailable = [{ title: 'Other NR services', value: 'other national rail services' }]

  private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    if (options.terminatesHere) {
      if (!this.validateStationExists(options.stationCode, 'high')) return

      files.push(
        'we will shortly be arriving at',
        { id: `stations.high.${options.stationCode}`, opts: { delayStart: 500 } },
        'our final destination',
        'thank you for travelling with us please remember to take all your personal belongings with you when you leave the train',
      )
    } else {
      if (!this.validateStationExists(options.stationCode, 'low')) return

      files.push('we will shortly be arriving at', { id: `stations.low.${options.stationCode}`, opts: { delayStart: 500 } })
    }

    if (Object.keys(this.StationsWithForcedChangeHere).includes(options.stationCode)) {
      const manualChangeFor = this.StationsWithForcedChangeHere[options.stationCode]

      // We force 'change here' announcements for these stations
      files.push({ id: 'change here for', opts: { delayStart: 500 } })
      files.push(`other-services.${manualChangeFor.main}`)

      if (manualChangeFor.additional) {
        files.push(`also-change.${manualChangeFor.additional}`)
      }
    } else if (options.changeFor.length > 0) {
      files.push({ id: 'change here for', opts: { delayStart: 500 } })
      files.push(
        ...this.pluraliseAudio(
          options.changeFor.map(poi => `other-services.${poi}`),
          50,
        ),
      )
    }

    if (this.StationsWithPointsOfInterest.includes(options.stationCode)) {
      files.push('exit here for')
      files.push(`POIs.${options.stationCode}`)
    }

    if (options.takeCareAsYouLeave) {
      files.push({ id: 'please make sure you have all your belongings and take care as you leave the train', opts: { delayStart: 500 } })
    }

    if (options.isAto) {
      files.push({ id: 'the doors will open automatically at the next station', opts: { delayStart: 500 } })
    }

    await this.playAudioFiles(files, download)
  }

  private async playStoppedAtStationAnnouncement(options: IStoppedAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { thisStationCode, terminatesAtCode, callingAtCodes } = options

    const files: AudioItem[] = []

    if (options.mindTheGap) {
      files.push('please mind the gap between the train and the platform')
    }

    if (!this.validateStationExists(thisStationCode, 'low')) return

    files.push(
      { id: 'this station is', opts: { delayStart: options.mindTheGap ? 500 : 0 } },
      { id: `stations.low.${thisStationCode}`, opts: { delayStart: 500 } },
    )

    if (thisStationCode === terminatesAtCode) {
      files.push(
        { id: 'this train terminates here all change', opts: { delayStart: 4600 } },
        'please ensure you take all personal belongings with you when leaving the train',
      )
    } else if (callingAtCodes.length === 0) {
      if (!this.validateStationExists(terminatesAtCode, 'high')) return

      files.push({ id: 'the next station is', opts: { delayStart: 4600 } }, `stations.high.${terminatesAtCode}`, `our final destination`)
    } else {
      if (!this.validateStationExists(terminatesAtCode, 'low')) return

      files.push({ id: 'this train terminates at', opts: { delayStart: 4600 } }, `stations.low.${terminatesAtCode}`)

      files.push({ id: 'we will be calling at', opts: { delayStart: 1000 } })

      if (callingAtCodes.some(({ crsCode }) => !this.validateStationExists(crsCode, 'high'))) return
      if (!this.validateStationExists(terminatesAtCode, 'low')) return

      files.push(
        ...this.pluraliseAudio(
          [
            ...callingAtCodes.map(
              ({ crsCode }): AudioItemObject => ({
                id: `stations.high.${crsCode}`,
                opts: { delayStart: 350 },
              }),
            ),
            {
              id: `stations.low.${terminatesAtCode}`,
              opts: { delayStart: 350 },
            },
          ],
          350,
        ),
      )
    }

    await this.playAudioFiles(files, download)
  }

  private async playInitialDepartureAnnouncement(options: IInitialDepartureAnnouncementOptions, download: boolean = false): Promise<void> {
    const { terminatesAtCode, callingAtCodes } = options

    const files: AudioItem[] = []

    if (!this.validateStationExists(terminatesAtCode, 'low')) return
    files.push('welcome aboard this service to', { id: `stations.low.${terminatesAtCode}`, opts: { delayStart: 250 } })

    if (callingAtCodes.length === 0) {
      if (!this.validateStationExists(terminatesAtCode, 'high')) return

      files.push({ id: 'the next station is', opts: { delayStart: 1000 } }, `stations.high.${terminatesAtCode}`, `our final destination`)
    } else {
      files.push({ id: 'we will be calling at', opts: { delayStart: 1000 } })

      if (callingAtCodes.some(({ crsCode }) => !this.validateStationExists(crsCode, 'high'))) return
      if (!this.validateStationExists(terminatesAtCode, 'low')) return

      files.push(
        ...this.pluraliseAudio(
          [
            ...callingAtCodes.map(
              ({ crsCode }, i): AudioItemObject => ({
                id: `stations.high.${crsCode}`,
                opts: { delayStart: 350 },
              }),
            ),
            {
              id: `stations.low.${terminatesAtCode}`,
              opts: { delayStart: 350 },
            },
          ],
          350,
        ),
      )
    }

    files.push({
      id: `safety information is provided on posters in every carriage`,
      opts: { delayStart: 2000 },
    })

    await this.playAudioFiles(files, download)
  }

  readonly AvailableStationNames = {
    high: [
      'ABW',
      'ARL',
      'BAB',
      'BBL',
      'BDK',
      'BEC',
      'BFR',
      'BGM',
      'BIW',
      'BKL',
      'BMS',
      'BTN',
      'BUG',
      'CAT',
      'CDS',
      'CFT',
      'CRI',
      'CRW',
      'CTF',
      'CTK',
      'CTM',
      'DEP',
      'DFD',
      'DMK',
      'ECR',
      'ELD',
      'ELS',
      'EPH',
      'EYN',
      'FGT',
      'FLT',
      'FPK',
      'FTN',
      'GLM',
      'GNH',
      'GNW',
      'GRV',
      'GTW',
      'HEN',
      'HGM',
      'HHE',
      'HIT',
      'HLN',
      'HNH',
      'HOR',
      'HPD',
      'HSK',
      'HUN',
      'IFI',
      'KTN',
      'LBG',
      'LEA',
      'LET',
      'LGJ',
      'LTN',
      'LUT',
      'LVN',
      'MHM',
      'MIL',
      'NFL',
      'NHD',
      'OTF',
      'PET',
      'PLU',
      'PMR',
      'PRP',
      'RDH',
      'RDT',
      'RTR',
      'RVB',
      'RYS',
      'SAC',
      'SAF',
      'SAY',
      'SCG',
      'SDY',
      'SEH',
      'SGR',
      'SMY',
      'SNO',
      'SOO',
      'SRT',
      'STP',
      'SVG',
      'SWM',
      'TBD',
      'TOO',
      'TUH',
      'WHP',
      'WVF',
      'ZFD',
    ],
    low: [
      'BAB',
      'BDM',
      'BFR',
      'BTN',
      'BUG',
      'CBG',
      'CRW',
      'CTK',
      'DMK',
      'ELD',
      'EPH',
      'GTW',
      'HOR',
      'HRH',
      'HSK',
      'LBG',
      'LTN',
      'LUT',
      'LVN',
      'ORP',
      'PBO',
      'PRP',
      'RAI',
      'RDH',
      'SAC',
      'SAF',
      'SEV',
      'STP',
      'WHP',
      'WIM',
      'WVF',
      'ZFD',
    ],
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab> = {
    initialDeparture: {
      name: 'Initial departure',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playInitialDepartureAnnouncement.bind(this),
        options: {
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.AvailableStationNames.low[0],
            options: AllStationsTitleValueMap.filter(s => this.AvailableStationNames.low.includes(s.value)),
            type: 'select',
          },
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.AvailableStationNames.high,
            },
            default: [],
          },
        },
      },
    },
    approachingStation: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playApproachingStationAnnouncement.bind(this),
        options: {
          stationCode: {
            name: 'Next station',
            default: this.AvailableStationNames.low[0],
            options: AllStationsTitleValueMap.filter(s => this.AvailableStationNames.low.includes(s.value)),
            type: 'select',
          },
          isAto: {
            name: 'Automatic train operation?',
            default: false,
            type: 'boolean',
          },
          terminatesHere: {
            name: 'Terminates here?',
            default: false,
            type: 'boolean',
          },
          takeCareAsYouLeave: {
            name: 'Take care as you leave the train?',
            default: false,
            type: 'boolean',
          },
          changeForOverridden: {
            type: 'customNoState',
            component: ({ activeState }) => {
              if (Object.keys(this.StationsWithForcedChangeHere).includes(activeState.stationCode as string)) {
                return <p className="warningMessage">The "Change for" setting will have no effect for this station.</p>
              }

              return null
            },
          },
          changeFor: {
            name: 'Change for...',
            type: 'multiselect',
            options: this.OtherServicesAvailable,
            default: [],
          },
          poiMessage: {
            type: 'customNoState',
            component: ({ activeState }) => {
              if (this.StationsWithPointsOfInterest.includes(activeState.stationCode as string)) {
                return (
                  <p className="infoMessage">
                    This announcement will also contain additional information which cannot be modified, relating to local points of interest.
                  </p>
                )
              }

              return null
            },
          },
        },
      },
    },
    stoppedAtStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      props: {
        presets: announcementPresets.stopped,
        playHandler: this.playStoppedAtStationAnnouncement.bind(this),
        options: {
          thisStationCode: {
            name: 'This station',
            default: this.AvailableStationNames.low[0],
            options: AllStationsTitleValueMap.filter(s => this.AvailableStationNames.low.includes(s.value)),
            type: 'select',
          },
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.AvailableStationNames.low[0],
            options: AllStationsTitleValueMap.filter(s => this.AvailableStationNames.low.includes(s.value)),
            type: 'select',
          },
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.AvailableStationNames.high,
            },
            default: [],
          },
          mindTheGap: {
            name: 'Mind the gap?',
            default: false,
            type: 'boolean',
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
            label: 'Manual PA chime',
            play: this.playAudioFiles.bind(this, ['pa chime']),
            download: this.playAudioFiles.bind(this, ['pa chime'], true),
          },
          {
            label: 'Safety information',
            play: this.playAudioFiles.bind(this, ['safety information is provided on posters in every carriage']),
            download: this.playAudioFiles.bind(this, ['safety information is provided on posters in every carriage'], true),
          },
          {
            label: 'Held at red signal',
            play: this.playAudioFiles.bind(this, ['this train is being held at a red signal and should be moving shortly']),
            download: this.playAudioFiles.bind(this, ['this train is being held at a red signal and should be moving shortly'], true),
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
}
