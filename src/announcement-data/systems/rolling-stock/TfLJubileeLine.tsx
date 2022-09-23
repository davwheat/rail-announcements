import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import AnnouncementSystem, { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'

interface IStationDataItem {
  name: string
  canTerminate: boolean
  approachingFiles: readonly string[]
  standingFiles: readonly string[]
}

const StationData: IStationDataItem[] = [
  {
    name: 'Stanmore',
    approachingFiles: ['stanmore'],
    standingFiles: ['stanmore'],
    canTerminate: true,
  },
  {
    name: 'Canons Park',
    approachingFiles: ['canons park'],
    standingFiles: ['canons park'],
    canTerminate: true,
  },
  {
    name: 'Queensbury',
    approachingFiles: ['queensbury'],
    standingFiles: ['queensbury'],
    canTerminate: false,
  },
  {
    name: 'Kingsbury',
    approachingFiles: ['kingsbury'],
    standingFiles: ['kingsbury'],
    canTerminate: false,
  },
  {
    name: 'Wembley Park',
    approachingFiles: ['wembley park', 'change for the metropolitan line', 'exit for wembley national stadium'],
    standingFiles: ['wembley park change here'],
    canTerminate: true,
  },
  {
    name: 'Neasden',
    approachingFiles: ['neasden'],
    standingFiles: ['neasden', 'change for the metropolitan line'],
    canTerminate: true,
  },
  {
    name: 'Dollis Hill',
    approachingFiles: ['dollis hill'],
    standingFiles: ['dollis hill'],
    canTerminate: true,
  },
  {
    name: 'Willesden Green',
    approachingFiles: ['willesden green', 'change for the metropolitan line'],
    standingFiles: ['willesden green', 'change for the metropolitan line'],
    canTerminate: true,
  },
  {
    name: 'Kilburn',
    approachingFiles: ['kilburn'],
    standingFiles: ['kilburn'],
    canTerminate: false,
  },
  {
    name: 'West Hampstead',
    approachingFiles: ['west hampstead', 'change for national rail and london overground'],
    standingFiles: ['west hampstead'],
    canTerminate: true,
  },
  {
    name: 'Finchley Road',
    approachingFiles: ['finchley road', 'change for the met change here please mind the gap'],
    standingFiles: ['finchley road change here'],
    canTerminate: true,
  },
  {
    name: 'Swiss Cottage',
    approachingFiles: ['swiss cottage'],
    standingFiles: ['swiss cottage'],
    canTerminate: false,
  },
  {
    name: "St. John's Wood",
    approachingFiles: ['st johns wood'],
    standingFiles: ['st johns wood'],
    canTerminate: false,
  },
  {
    name: 'Baker Street',
    approachingFiles: ['baker street', 'change for the bakerloo, h&c, circle and met'],
    standingFiles: ['baker street change here'],
    canTerminate: false,
  },
  {
    name: 'Bond Street',
    approachingFiles: ['bond street', 'change for the central line'],
    standingFiles: ['bond street change here'],
    canTerminate: false,
  },
  {
    name: 'Green Park',
    approachingFiles: ['green park', 'change for the piccadilly and victoria lines exit for buckingham palace'],
    standingFiles: ['green park change here'],
    canTerminate: true,
  },
  {
    name: 'Westminster',
    approachingFiles: ['westminster', 'change for the circle and district line exit for westminster abbey and houses of parliament'],
    standingFiles: ['westminster change here'],
    canTerminate: false,
  },
  {
    name: 'Waterloo',
    approachingFiles: ['waterloo', 'change for the bakerloo, northern, and waterloo and city, and national rail'],
    standingFiles: ['waterloo change here'],
    canTerminate: true,
  },
  {
    name: 'Southwark',
    approachingFiles: ['southwark', 'change for national rail from waterloo east'],
    standingFiles: ['southwark change here'],
    canTerminate: false,
  },
  {
    name: 'London Bridge',
    approachingFiles: ['london bridge', 'change for the northern line and national rail'],
    standingFiles: ['london bridge change here'],
    canTerminate: true,
  },
  {
    name: 'Bermondsey',
    approachingFiles: ['bermondsey'],
    standingFiles: ['bermondsey'],
    canTerminate: false,
  },
  {
    name: 'Canada Water',
    approachingFiles: ['canada water', 'change for london overground'],
    standingFiles: ['canada water change here'],
    canTerminate: false,
  },
  {
    name: 'Canary Wharf',
    approachingFiles: ['canary wharf', 'change for the dlr'],
    standingFiles: ['canary wharf change here'],
    canTerminate: true,
  },
  {
    name: 'North Greenwich',
    approachingFiles: ['north greenwich', 'exit here for the emirates airline and the o2'],
    standingFiles: ['north greenwich', 'exit here for the emirates airline and the o2 '],
    canTerminate: true,
  },
  {
    name: 'Canning Town',
    approachingFiles: ['canning town', 'change for the dlr including excel and london city'],
    standingFiles: ['canning town change here'],
    canTerminate: false,
  },
  {
    name: 'West Ham',
    approachingFiles: ['west ham', 'change for the district, hammersmith and city, dlr, national rail'],
    standingFiles: ['west ham change here'],
    canTerminate: true,
  },
  {
    name: 'Stratford',
    approachingFiles: ['stratford change for'],
    standingFiles: ['stratford change here'],
    canTerminate: true,
  },
]

interface INextStationAnnouncementOptions {
  stationName: string
  doorDirection: 'left' | 'right'
}

interface IAtStationAnnouncementOptions {
  stationName: string
}

interface IDestinationInfoAnnouncementOptions {
  terminatingStationName: string
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  destinationInfo: [
    {
      name: 'Westbound - Stanmore',
      state: {
        terminatingStationName: 'Stanmore',
      },
    },
    {
      name: 'Westbound - Willesden Green',
      state: {
        terminatingStationName: 'Willesden Green',
      },
    },
    {
      name: 'Westbound - Wembley Park',
      state: {
        terminatingStationName: 'Wembley Park',
      },
    },
    {
      name: 'Eastbound - Stratford',
      state: {
        terminatingStationName: 'Stratford',
      },
    },
  ],
}

export default class TfLJubileeLine extends AnnouncementSystem {
  readonly NAME = 'TfL Jubilee Line'
  readonly ID = 'TFL_JUBILEE_LINE_V1'
  readonly FILE_PREFIX = 'TfL/Jubilee Line'
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

    const stnFiles: AudioItem[] = [...StationData.find(s => s.name === options.stationName).approachingFiles]
    stnFiles[0] = { id: stnFiles[0] as string, opts: { delayStart: 250 } }

    files.push(...stnFiles)

    files.push({ id: `doors will open on the ${options.doorDirection} hand side`, opts: { delayStart: 750 } })

    await this.playAudioFiles(files, download)
  }

  private async playAtStationAnnouncement(options: IAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('this station is')

    const stnFiles: AudioItem[] = [...StationData.find(s => s.name === options.stationName).standingFiles]
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
