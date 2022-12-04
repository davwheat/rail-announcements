import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import AnnouncementSystem, { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'

const ChangeOptions = [
  'Bakerloo',
  'Central',
  'Circle',
  'District',
  'Hammersmith & City',
  'Jubilee',
  'Metropolitan',
  'Northern',
  'Piccadilly',
  'Victoria',
  'Waterloo & City',
  'DLR',
  'London Overground',
  'National Rail',
  'Elizabeth',
] as const

type ChangeOption = typeof ChangeOptions[number]

interface StationInfo {
  name: string
  audioName: {
    b: string
    m: string
    e: string
    c: string
  }
  changeFor: ChangeOption[]
}

const AllStations: StationInfo[] = []

interface INextStationAnnouncementOptions {
  stationLabel: string
  terminating: boolean
  mindTheGap: boolean
}

interface IDestinationInfoAnnouncementOptions {
  stationName: string
}

interface IAtStationAnnouncementOptions {
  stationNameIndex: string
  terminatingStationName: string
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {}

export default class TfLNorthernLine extends AnnouncementSystem {
  readonly NAME = 'TfL Northern Line'
  readonly ID = 'TFL_NORTHERN_LINE_V1'
  readonly FILE_PREFIX = 'TfL/Northern Line'
  readonly SYSTEM_TYPE = 'train'

  private assembleDestinationInfoSegments(stationName: string, delayStart: number = 0): AudioItem[] {
    const parsed = stationName.toLowerCase().replace(/[^a-z \.]/g, '')

    return [{ id: 'destination.' + parsed, opts: { delayStart } }]
  }

  private async playDestinationInfoAnnouncement(options: IDestinationInfoAnnouncementOptions, download: boolean = false): Promise<void> {
    await this.playAudioFiles(this.assembleDestinationInfoSegments(options.stationName), download)
  }

  private async playNextStationAnnouncement(options: INextStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    const nextStationData = NextStationData.find(item => item.label === options.stationLabel)

    if (!nextStationData) {
      alert('Invalid station')
      return
    }

    if ((options.terminating && nextStationData.terminatingAudio) || nextStationData.onlyTerminates) {
      files.push(...nextStationData.terminatingAudio)
      files.push(
        {
          id: 'please ensure you have all your belongings with you',
          opts: { delayStart: 250 },
        },
        'when you leave the train',
        {
          id: 'thank you for travelling on the northern line',
          opts: { delayStart: 250 },
        },
      )
    } else {
      if (!nextStationData.audio) {
        files.push('next station.' + options.stationLabel.toLowerCase().replace(/[^a-z\& \.]/g, ''))
      } else {
        files.push(...nextStationData.audio)
      }
    }

    if (options.mindTheGap && nextStationData.conditionalMindTheGap) {
      files.push('please mind the gap between the train and the platform')
    }

    await this.playAudioFiles(files, download)
  }

  private async playAtStationAnnouncement(options: IAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push('conjoiner.this station is')

    const stationInfo = ThisStationData[parseInt(options.stationNameIndex)]

    files.push('station.low.' + stationInfo.station.toLowerCase().replace(/[^a-z\& \.]/g, ''))

    if (stationInfo.branch) {
      files.push(`routeing.${stationInfo.branch} branch`)
    }

    if (stationInfo.extraInfo) {
      const extra = [...stationInfo.extraInfo]

      let firstMsg = extra[0]

      if (typeof firstMsg === 'string') {
        firstMsg = { id: firstMsg }
      }

      firstMsg.opts ||= {}
      firstMsg.opts.delayStart ||= 500

      files.push(firstMsg, ...stationInfo.extraInfo.slice(1))
    }

    files.push(...this.assembleDestinationInfoSegments(options.terminatingStationName, 500))

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
    nextStation: {
      name: 'Next station',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playNextStationAnnouncement.bind(this),
        options: {
          stationLabel: {
            name: 'Next station',
            default: NextStationData[0].label,
            options: NextStationData.map(s => ({ title: `${s.label}${s.terminatingAudio && !s.onlyTerminates ? ' (T)' : ''}`, value: s.label })),
            type: 'select',
          },
          terminating: {
            name: 'Terminates here?',
            default: false,
            onlyShowWhen(activeState) {
              const data = NextStationData.find(s => s.label === activeState.stationLabel)

              return !!(data?.terminatingAudio && !data.onlyTerminates)
            },
            type: 'boolean',
          },
          mindTheGap: {
            name: 'Mind the gap?',
            default: true,
            onlyShowWhen(activeState) {
              return !!NextStationData.find(s => s.label === activeState.stationLabel)?.conditionalMindTheGap
            },
            type: 'boolean',
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
          stationNameIndex: {
            name: 'This station',
            default: '0',
            options: ThisStationData.map((s, i) => {
              let label = s.station

              if (s.branch) {
                label += ` (${s.branch.replace(/(?:^|\s)\S/g, a => a.toUpperCase())} branch)`
              }

              return { title: label, value: i.toString() }
            }),
            type: 'select',
          },
          terminatingStationName: {
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
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          Safety: [
            {
              label: 'This train is about to depart',
              play: this.playAudioFiles.bind(this, ['this train is about to depart']),
              download: this.playAudioFiles.bind(this, ['this train is about to depart'], true),
            },
            {
              label: 'Please mind the doors',
              play: this.playAudioFiles.bind(this, ['please mind the doors']),
              download: this.playAudioFiles.bind(this, ['please mind the doors'], true),
            },
            {
              label: 'Please mind the gap between the train and the platform',
              play: this.playAudioFiles.bind(this, ['please mind the gap between the train and the platform']),
              download: this.playAudioFiles.bind(this, ['please mind the gap between the train and the platform'], true),
            },
          ],
          // General: [
          //   {
          //     label: 'Please keep your personal belongings with you at all times',
          //     play: this.playAudioFiles.bind(this, ['please keep your personal belongings with you at all times']),
          //     download: this.playAudioFiles.bind(this, ['please keep your personal belongings with you at all times'], true),
          //   },
          // ],
          Informational: [
            {
              label: 'Smoking is not permitted',
              play: this.playAudioFiles.bind(this, ['smoking is not permitted on any part of london underground']),
              download: this.playAudioFiles.bind(this, ['smoking is not permitted on any part of london underground'], true),
            },

            {
              label: 'Kennington Loop',
              play: this.playAudioFiles.bind(this, [
                'group.kennington loop.this train will arrive back at kennington station shortly',
                'group.kennington loop.please stay on the train to alight at kennington',
              ]),
              download: this.playAudioFiles.bind(this, ['smoking is not permitted on any part of london underground'], true),
            },

            //   {
            //     label: 'There are beggars and buskers operating on this train',
            //     play: this.playAudioFiles.bind(this, ['there are beggars and buskers operating on this train']),
            //     download: this.playAudioFiles.bind(this, ['there are beggars and buskers operating on this train'], true),
            //   },
            //   {
            //     label: 'There may be pickpockets operating on this train',
            //     play: this.playAudioFiles.bind(this, ['there may be pickpockets operating on this train']),
            //     download: this.playAudioFiles.bind(this, ['there may be pickpockets operating on this train'], true),
            //   },
          ],
          // Operational: [
          //   {
          //     label: 'Passengers for Canning Town, West Ham and Stratford should change here',
          //     play: this.playAudioFiles.bind(this, ['passengers for canning town west ham and stratford should change here']),
          //     download: this.playAudioFiles.bind(this, ['passengers for canning town west ham and stratford should change here'], true),
          //   },
          //   {
          //     label: 'The next station is closed. This train will not stop at the next station.',
          //     play: this.playAudioFiles.bind(this, ['the next station is closed this train will not stop at the next station']),
          //     download: this.playAudioFiles.bind(this, ['the next station is closed this train will not stop at the next station'], true),
          //   },
          //   {
          //     label: 'There is restricted escalator service at the next station and you may wish to alight here',
          //     play: this.playAudioFiles.bind(this, [
          //       'there is restricted escalator service at the next station and you may wish to alight here',
          //     ]),
          //     download: this.playAudioFiles.bind(
          //       this,
          //       ['there is restricted escalator service at the next station and you may wish to alight here'],
          //       true,
          //     ),
          //   },
          //   {
          //     label: 'There is no lift service at the next station and you may wish to alight here',
          //     play: this.playAudioFiles.bind(this, ['there is no lift service at the next station and you may wish to alight here']),
          //     download: this.playAudioFiles.bind(this, ['there is no lift service at the next station and you may wish to alight here'], true),
          //   },
          //   {
          //     label: 'All change please. This train will now terminate here. All change please.',
          //     play: this.playAudioFiles.bind(this, ['all change please this train will now terminate here all change please']),
          //     download: this.playAudioFiles.bind(this, ['all change please this train will now terminate here all change please'], true),
          //   },
          // ],
        },
      },
    },
  }
}
