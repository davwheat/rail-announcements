import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'

interface IApproachingStationAnnouncementOptions {
    stationCode: string
    mindTheGap: boolean
}
  
interface IWelcomeAnnouncementOptions {
    terminatesAtCode: string
    readAllStations: boolean
    callingAtCodes: { crsCode: string; name: string; randomId: string }[]
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  welcome: [
    {
      name: 'Birmingham Snow Hill to Worcester Forgate Street',
      state: {
        terminatesAtCode: 'WOF',
        readAllStations: true,
        callingAtCodes: ['JEQ', 'THW', 'SGB', 'ROW', 'CRA', 'SBJ', 'HAG', 'BKD', 'KID', 'HBY', 'DTW'].map(crsToStationItemMapper),
      },
    },
  ],
}

export default class WMTClass172 extends TrainAnnouncementSystem {
    readonly NAME = 'West Midlands Trains Class 172 - Julie Berry'
    readonly ID = 'WMT_CLASS_172_V1'
    readonly FILE_PREFIX = 'WMT/172'
    readonly SYSTEM_TYPE = 'train'

    private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions, download: boolean = false): Promise<void> {
        const files: AudioItem[] = []

        files.push('bing bong')
        files.push('we are now approaching')
        files.push({ id: `stations.${options.stationCode}`, opts: { delayStart: 200 } })

        if (options.mindTheGap) {
            files.push({ id: 'please mind the gap when leaving the train and step', opts: { delayStart: 500 } })
        }

        await this.playAudioFiles(files, download)
    }

    private async playStoppedAtStationAnnouncement(options: IWelcomeAnnouncementOptions, download: boolean = false): Promise<void> {
        const { callingAtCodes: _callingAt, terminatesAtCode, readAllStations } = options

        const callingAtCodes = _callingAt.map(stop => stop.crsCode)

        if (!this.validateStationExists(terminatesAtCode)) return

        const files: AudioItem[] = []
        files.push('bing bong')
        files.push('welcome to this service')
        files.push({ id: 'for', opts: { delayStart: 200 } })
        files.push({ id: `stations.${terminatesAtCode}`, opts: { delayStart: 200 } })

        const remainingStops = [
            ...callingAtCodes.map((crsCode): AudioItemObject => ({ id: `stations.${crsCode}`, opts: { delayStart: 100 } })),
            { id: `stations.${terminatesAtCode}`, opts: { delayStart: 100 } },
        ]

        if (callingAtCodes.some(code => !this.validateStationExists(code))) return

        if (remainingStops.length === 0) {
            // We are at the termination point.
            // files.push('this train terminates here all change please ensure')
        } else if (remainingStops.length === 1 || !readAllStations) {
            // Next station is the termination point or we are not reading all stations.
            files.push({ id: `the next station is`, opts: { delayStart: 200 } })
            files.push(remainingStops[0])
        } else {
            // We are not at the termination point and reading all stations.
            files.push({ id: `calling at`, opts: { delayStart: 200 } })
            files.push(...this.pluraliseAudio(remainingStops, { beforeAndDelay: 200, beforeItemDelay: 200 }))
        }

        await this.playAudioFiles(files, download)
    }

    private RealAvailableStationNames = [
        'ACG',
        'BKD',
        'BMO',
        'BSW',
        'CRA',
        'DTW',
        'HAG',
        'HBY',
        'JEQ',
        'KID',
        'OLT',
        'ROW',
        'SBJ',
        'SGB',
        'SMA',
        'THW',
        'WOF',
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
                },
            },
        } as CustomAnnouncementTab<keyof IApproachingStationAnnouncementOptions>,
        stoppedAtStation: {
            name: 'Stopped at station',
            component: CustomAnnouncementPane,
            defaultState: {
                terminatesAtCode: this.RealAvailableStationNames[0],
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
    }
}
  