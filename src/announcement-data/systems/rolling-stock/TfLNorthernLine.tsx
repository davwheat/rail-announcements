import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import AnnouncementSystem, { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'

interface IStationDataItem {
  name: string
  canTerminate: boolean
  approachingFiles: readonly string[]
  standingFiles: readonly string[]
  postEliz?: {
    approachingFiles: readonly string[]
    standingFiles: readonly string[]
  }
}

const StationData: IStationDataItem[] = [
  {
    name: 'Stanmore',
    approachingFiles: ['stanmore'],
    standingFiles: ['stanmore'],
    canTerminate: true,
  },
]

interface INextStationAnnouncementOptions {
  stationName: string
  doorDirection: 'left' | 'right'
  usePostEliz: boolean
}

interface IAtStationAnnouncementOptions {
  stationName: string
  usePostEliz: boolean
}

interface IDestinationInfoAnnouncementOptions {
  terminatingStationName: string
}

const elizAffectedStations = StationData.filter(station => station.postEliz).map(station => station.name)

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {}

export default class TfLJubileeLine extends AnnouncementSystem {
  readonly NAME = 'TfL Northern Line'
  readonly ID = 'TFL_NORTHERN_LINE_V1'
  readonly FILE_PREFIX = 'TfL/Northern Line'
  readonly SYSTEM_TYPE = 'train'

  private async playDestinationInfoAnnouncement(options: IDestinationInfoAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('anita.this train terminates at')
    files.push('anita.' + options.terminatingStationName.toLowerCase().replace(/[^a-z ]/g, ''))

    await this.playAudioFiles(files, download)
  }

  private async playNextStationAnnouncement(options: INextStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('the next station is')

    const stnFiles: AudioItem[] = []

    if (elizAffectedStations.includes(options.stationName) && options.usePostEliz) {
      stnFiles.push(...StationData.find(s => s.name === options.stationName).postEliz.approachingFiles)
    } else {
      stnFiles.push(...StationData.find(s => s.name === options.stationName).approachingFiles)
    }

    stnFiles[0] = { id: stnFiles[0] as string, opts: { delayStart: 250 } }

    files.push(...stnFiles)

    files.push({ id: `doors will open on the ${options.doorDirection} hand side`, opts: { delayStart: 750 } })

    await this.playAudioFiles(files, download)
  }

  private async playAtStationAnnouncement(options: IAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('this station is')

    const stnFiles: AudioItem[] = []

    if (elizAffectedStations.includes(options.stationName) && options.usePostEliz) {
      stnFiles.push(...StationData.find(s => s.name === options.stationName).postEliz.standingFiles)
    } else {
      stnFiles.push(...StationData.find(s => s.name === options.stationName).standingFiles)
    }

    stnFiles[0] = { id: stnFiles[0] as string, opts: { delayStart: 250 } }

    files.push(...stnFiles)

    await this.playAudioFiles(files, download)
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab> = {
    destinationInfo: {
      name: 'Destination info',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playDestinationInfoAnnouncement.bind(this),
        presets: announcementPresets.destinationInfo,
        options: {
          terminatingStationName: {
            name: 'Destination station',
            default: StationData.filter(s => s.canTerminate)[0].name,
            options: StationData.filter(s => s.canTerminate).map(s => ({ title: s.name, value: s.name })),
            type: 'select',
          },
        },
      },
    },
    nextStation: {
      name: 'Next station',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playNextStationAnnouncement.bind(this),
        options: {
          stationName: {
            name: 'Next station',
            default: StationData[0].name,
            options: StationData.map(s => ({ title: s.name, value: s.name })),
            type: 'select',
          },
          doorDirection: {
            name: 'Door direction',
            default: 'right',
            options: [
              { title: 'Left', value: 'left' },
              { title: 'Right', value: 'right' },
            ],
            type: 'select',
          },
          usePostEliz: {
            name: 'Use Elizabeth line version',
            default: true,
            type: 'boolean',
            onlyShowWhen: ({ stationName }: { stationName: string }) => {
              return elizAffectedStations.includes(stationName)
            },
          },
        },
      },
    },
    thisStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playAtStationAnnouncement.bind(this),
        options: {
          stationName: {
            name: 'This station',
            default: StationData[0].name,
            options: StationData.map(s => ({ title: s.name, value: s.name })),
            type: 'select',
          },
          usePostEliz: {
            name: 'Use Elizabeth line version',
            default: true,
            type: 'boolean',
            onlyShowWhen: ({ stationName }: { stationName: string }) => {
              return elizAffectedStations.includes(stationName)
            },
          },
        },
      },
    },
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          Safety: [
            {
              label: 'Please stand clear of the doors',
              play: this.playAudioFiles.bind(this, ['please stand clear of the doors']),
              download: this.playAudioFiles.bind(this, ['please stand clear of the doors'], true),
            },
            {
              label: 'Please mind the gap between the train and the platform',
              play: this.playAudioFiles.bind(this, ['please mind the gap between the train and the platform']),
              download: this.playAudioFiles.bind(this, ['please mind the gap between the train and the platform'], true),
            },
          ],
          General: [
            {
              label: 'Please keep your personal belongings with you at all times',
              play: this.playAudioFiles.bind(this, ['please keep your personal belongings with you at all times']),
              download: this.playAudioFiles.bind(this, ['please keep your personal belongings with you at all times'], true),
            },
          ],
          Informational: [
            {
              label: 'Passengers are reminded that smoking is not permitted',
              play: this.playAudioFiles.bind(this, ['passengers are reminded that smoking is not permitted']),
              download: this.playAudioFiles.bind(this, ['passengers are reminded that smoking is not permitted'], true),
            },
            {
              label: 'There are beggars and buskers operating on this train',
              play: this.playAudioFiles.bind(this, ['there are beggars and buskers operating on this train']),
              download: this.playAudioFiles.bind(this, ['there are beggars and buskers operating on this train'], true),
            },
            {
              label: 'There may be pickpockets operating on this train',
              play: this.playAudioFiles.bind(this, ['there may be pickpockets operating on this train']),
              download: this.playAudioFiles.bind(this, ['there may be pickpockets operating on this train'], true),
            },
          ],
          Operational: [
            {
              label: 'Passengers for Canning Town, West Ham and Stratford should change here',
              play: this.playAudioFiles.bind(this, ['passengers for canning town west ham and stratford should change here']),
              download: this.playAudioFiles.bind(this, ['passengers for canning town west ham and stratford should change here'], true),
            },
            {
              label: 'The next station is closed. This train will not stop at the next station.',
              play: this.playAudioFiles.bind(this, ['the next station is closed this train will not stop at the next station']),
              download: this.playAudioFiles.bind(this, ['the next station is closed this train will not stop at the next station'], true),
            },
            {
              label: 'There is restricted escalator service at the next station and you may wish to alight here',
              play: this.playAudioFiles.bind(this, [
                'there is restricted escalator service at the next station and you may wish to alight here',
              ]),
              download: this.playAudioFiles.bind(
                this,
                ['there is restricted escalator service at the next station and you may wish to alight here'],
                true,
              ),
            },
            {
              label: 'There is no lift service at the next station and you may wish to alight here',
              play: this.playAudioFiles.bind(this, ['there is no lift service at the next station and you may wish to alight here']),
              download: this.playAudioFiles.bind(this, ['there is no lift service at the next station and you may wish to alight here'], true),
            },
            {
              label: 'All change please. This train will now terminate here. All change please.',
              play: this.playAudioFiles.bind(this, ['all change please this train will now terminate here all change please']),
              download: this.playAudioFiles.bind(this, ['all change please this train will now terminate here all change please'], true),
            },
          ],
        },
      },
    },
  }
}
