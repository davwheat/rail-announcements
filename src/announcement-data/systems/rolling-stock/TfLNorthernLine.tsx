import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import AnnouncementSystem, { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'

interface IDestination {
  station: string
  viaBank?: boolean
  viaCharingCross?: boolean
}

const AvailableDestinations: IDestination[] = [
  {
    station: 'Archway',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Battersea Power Station',
    viaCharingCross: true,
  },
  {
    station: 'Charing Cross',
  },
  {
    station: 'Clapham Common',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Colindale',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'East Finchley',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Edgware',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Euston',
    viaBank: true,
  },
  {
    station: 'Finchley Central',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Golders Green',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Hampstead',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'High Barnet',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Kennington',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Kings Cross',
  },
  {
    station: 'Mill Hill East',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Moorgate',
  },
  {
    station: 'Morden',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Mornington Crescent',
  },
  {
    station: 'Nine Elms',
    viaCharingCross: true,
  },
  {
    station: 'Stockwell',
    viaBank: true,
    viaCharingCross: true,
  },
  {
    station: 'Tooting Broadway',
    viaBank: true,
    viaCharingCross: true,
  },
]

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

interface INextStationAnnouncementOptions {
  stationName: string
  doorDirection: 'left' | 'right'
  usePostEliz: boolean
}

interface IAtStationAnnouncementOptions {
  stationName: string
}

interface IDestinationInfoAnnouncementOptions {
  stationName: string
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {}

export default class TfLNorthernLine extends AnnouncementSystem {
  readonly NAME = 'TfL Northern Line'
  readonly ID = 'TFL_NORTHERN_LINE_V1'
  readonly FILE_PREFIX = 'TfL/Northern Line'
  readonly SYSTEM_TYPE = 'train'

  private async playDestinationInfoAnnouncement(options: IDestinationInfoAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('destination.' + options.stationName.toLowerCase().replace(/[^a-z \.]/g, ''))

    await this.playAudioFiles(files, download)
  }

  private async playNextStationAnnouncement(options: INextStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('conjoiner.the next station is')

    await this.playAudioFiles(files, download)
  }

  private async playAtStationAnnouncement(options: IAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('conjoiner.this station is')

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
          stationName: {
            name: 'Destination station',
            default: AvailableDestinations[0].station,
            options: AvailableDestinations.reduce((acc, dest) => {
              acc.push({ title: dest.station, value: dest.station })

              if (dest.viaBank) {
                acc.push({ title: `${dest.station} via Bank`, value: `via bank.${dest.station}` })
              }

              if (dest.viaCharingCross) {
                acc.push({ title: `${dest.station} via Charing Cross`, value: `via charing cross.${dest.station}` })
              }

              return acc
            }, [] as { title: string; value: string }[]),
            type: 'select',
          },
        },
      },
    },
    // nextStation: {
    //   name: 'Next station',
    //   component: CustomAnnouncementPane,
    //   props: {
    //     playHandler: this.playNextStationAnnouncement.bind(this),
    //     options: {
    //       stationName: {
    //         name: 'Next station',
    //         default: StationData[0].name,
    //         options: StationData.map(s => ({ title: s.name, value: s.name })),
    //         type: 'select',
    //       },
    //       doorDirection: {
    //         name: 'Door direction',
    //         default: 'right',
    //         options: [
    //           { title: 'Left', value: 'left' },
    //           { title: 'Right', value: 'right' },
    //         ],
    //         type: 'select',
    //       },
    //     },
    //   },
    // },
    // thisStation: {
    //   name: 'Stopped at station',
    //   component: CustomAnnouncementPane,
    //   props: {
    //     playHandler: this.playAtStationAnnouncement.bind(this),
    //     options: {
    //       stationName: {
    //         name: 'This station',
    //         default: StationData[0].name,
    //         options: StationData.map(s => ({ title: s.name, value: s.name })),
    //         type: 'select',
    //       },
    //     },
    //   },
    // },
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
