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

interface NextStationItem {
  label: string
  /**
   * Defaults to `['next station.<label>']` in lowercase, without special chars
   */
  audio?: AudioItem[]
  terminatingAudio?: string[]
  conditionalMindTheGap?: boolean
  onlyTerminates?: boolean
}

const NextStationData: NextStationItem[] = [
  { label: 'Angel' },
  {
    label: 'Archway',
    terminatingAudio: ['next station.terminating.archway'],
  },
  { label: 'Balham' },
  { label: 'Bank' },
  {
    label: 'Battersea Power Station (terminating)',
    terminatingAudio: ['next station.terminating.battersea power station'],
    onlyTerminates: true,
  },
  { label: 'Belsize Park' },
  {
    label: 'Borough',
    audio: ['next station.borough', 'please mind the gap between the train and the platform'],
  },
  { label: 'Brent Cross' },
  { label: 'Burnt Oak' },
  {
    label: 'Camden Town (Bank branch)',
    audio: ['next station.camden town - bank'],
  },
  {
    label: 'Camden Town (Charing Cross branch)',
    audio: ['next station.camden town - charing cross'],
  },
  {
    label: 'Camden Town (Edgware branch)',
    audio: ['next station.camden town - edgware'],
  },
  {
    label: 'Camden Town (High Barnet branch)',
    audio: ['next station.camden town - high barnet'],
  },
  { label: 'Chalk Farm' },
  {
    label: 'Charing Cross',
    audio: [
      'conjoiner.the next station is',
      'station.low.charing cross',
      { id: 'sdo.upon arrival', opts: { delayStart: 250 } },
      'sdo.the first',
      'sdo.set of doors will not open',
      'sdo.customers in',
      'sdo.the first',
      'sdo.carriage please move towards',
      'sdo.the rear doors',
      'sdo.to leave the train',
    ],
  },
  {
    label: 'Clapham Common',
    audio: [
      'next station.clapham common',
      { id: 'sdo.upon arrival', opts: { delayStart: 250 } },
      'sdo.the last',
      'sdo.set of doors will not open',
      'sdo.customers in',
      'sdo.the last',
      'sdo.carriage please move towards',
      'sdo.the front doors',
      'sdo.to leave the train',
    ],
  },
  { label: 'Clapham North' },
  { label: 'Clapham South' },
  {
    label: 'Colindale',
    terminatingAudio: ['next station.terminating.colindale'],
  },
  { label: 'Colliers Wood' },
  {
    label: 'East Finchley',
    terminatingAudio: ['next station.terminating.east finchley'],
  },
  {
    label: 'Edgware (terminating)',
    // audio: ['conjoiner.the next station is', 'station.low.edgware'],
    onlyTerminates: true,
    terminatingAudio: ['next station.terminating.edgware'],
  },
  { label: 'Elephant & Castle' },
  {
    label: 'Embankment',
    audio: ['conjoiner.the next station is', 'station.low.embankment', 'please mind the gap between the train and the platform'],
  },
  {
    label: 'Euston (Bank branch)',
    audio: [
      'next station.euston - bank',
      { id: 'sdo.upon arrival', opts: { delayStart: 250 } },
      'sdo.the last',
      'sdo.set of doors will not open',
      'sdo.customers in',
      'sdo.the last',
      'sdo.carriage please move towards',
      'sdo.the front doors',
      'sdo.to leave the train',
    ],
  },
  {
    label: 'Euston (Charing Cross branch)',
    audio: ['conjoiner.the next station is', 'station.high.euston', 'routeing.charing cross branch'],
  },
  {
    label: 'Finchley Central',
    terminatingAudio: ['next station.terminating.finchley central'],
  },
  {
    label: 'Finchley Central (change for Mill Hill East)',
    audio: ['next station.finchley central change here mill hill east'],
    terminatingAudio: ['next station.terminating.finchley central change here mill hill east high barnet'],
  },
  {
    label: 'Golders Green',
    audio: ['next station.golders green', 'please mind the gap between the train and the platform'],
    terminatingAudio: ['next station.terminating.golders green'],
  },
  {
    label: 'Goodge Street',
    audio: ['conjoner.the next station is', 'station.low.goodge street'],
  },
  {
    label: 'Hampstead',
    audio: [
      'next station.hampstead',
      { id: 'sdo.upon arrival', opts: { delayStart: 250 } },
      'sdo.the last',
      'sdo.set of doors will not open',
      'sdo.customers in',
      'sdo.the last',
      'sdo.carriage please move towards',
      'sdo.the front doors',
      'sdo.to leave the train',
    ],
    terminatingAudio: ['next station.terminating.hampstead'],
  },
  { label: 'Hendon Central' },
  {
    label: 'High Barnet (terminating)',
    onlyTerminates: true,
    // audio: ['conjoiner.the next station is', 'station.low.high barnet'],
    terminatingAudio: ['next station.terminating.high barnet'],
  },
  { label: 'Highgate' },
  {
    label: 'Kennington',
    terminatingAudio: ['next station.terminating.kennington'],
  },
  {
    label: 'Kennington (change for southbound trains)',
    audio: ['next station.kennington change here southbound trains morden'],
  },
  { label: 'Kentish Town' },
  { label: 'Kings Cross St Pancras' },
  { label: 'Leicester Square' },
  { label: 'London Bridge' },
  {
    label: 'Mill Hill East',
    terminatingAudio: ['next station.terminating.mill hill east'],
  },
  {
    label: 'Moorgate',
    audio: [
      'conjoiner.the next station is',
      'station.low.moorgate',
      { id: 'sdo.upon arrival', opts: { delayStart: 250 } },
      'sdo.the first',
      'sdo.set of doors will not open',
      'sdo.customers in',
      'sdo.the first',
      'sdo.carriage please move towards',
      'sdo.the rear doors',
      'sdo.to leave the train',
      'please mind the gap between the train and the platform',
    ],
  },
  {
    label: 'Morden',
    onlyTerminates: true,
    terminatingAudio: ['next station.terminating.morden'],
  },
  { label: 'Mornington Crescent' },
  {
    label: 'Nine Elms',
    terminatingAudio: ['next station.terminating.nine elms'],
  },
  { label: 'Old Street' },
  { label: 'Oval' },
  { label: 'South Wimbledon', conditionalMindTheGap: true },
  { label: 'Stockwell' },
  { label: 'Tooting Bec' },
  { label: 'Tooting Broadway' },
  { label: 'Tottenham Court Road' },
  { label: 'Totteridge & Whetstone' },
  { label: 'Tufnell Park' },
  {
    label: 'Warren Street',
    audio: ['conjoiner.the next station is', 'station.low.warren street'],
  },
  {
    label: 'Waterloo',
    audio: ['conjoiner.the next station is', 'station.low.waterloo'],
  },
  { label: 'West Finchley' },
  { label: 'Woodside Park' },
]

interface INextStationAnnouncementOptions {
  stationLabel: string
  terminating: boolean
  mindTheGap: boolean
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

  // private async playAtStationAnnouncement(options: IAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
  //   const files: AudioItem[] = []

  //   files.push('conjoiner.this station is')

  //   await this.playAudioFiles(files, download)
  // }

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
