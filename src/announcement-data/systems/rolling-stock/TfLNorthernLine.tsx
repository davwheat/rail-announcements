import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import AnnouncementSystem, { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'

interface IDestination {
  station: string
  viaBank?: boolean
  viaCharingCross?: boolean
}

const ThisStationData: ThisStationItem[] = [
  {
    station: 'Angel',
    branch: null,
  },
  {
    station: 'Archway',
    branch: null,
  },
  {
    station: 'Balham',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'connections.national rail services'],
  },
  {
    station: 'Bank',
    branch: null,
    fullAudio: ['northern line extension.this station.bank change here'],
  },
  {
    station: 'Battersea Power Station',
    branch: null,
    fullAudio: ['northern line extension.this station.battersea power station exit here'],
  },
  {
    station: 'Belsize Park',
    branch: null,
  },
  {
    station: 'Borough',
    branch: null,
  },
  {
    station: 'Brent Cross',
    branch: null,
  },
  {
    station: 'Burnt Oak',
    branch: null,
  },
  {
    station: 'Camden Town',
    branch: 'bank',
    extraInfo: [
      'conjoiner.change here for',
      'connections.southbound northern line',
      'conjoiner.service',
      'routeing.high.via charing cross',
      'conjoiner.and',
      'connections.northbound',
      'conjoiner.services',
      'conjoiner.to',
      'station.low.edgware',
    ],
  },
  {
    station: 'Camden Town',
    branch: 'charing cross',
    extraInfo: [
      'conjoiner.change here for',
      'connections.southbound northern line',
      'conjoiner.service',
      'routeing.high.via bank',
      'conjoiner.and',
      'connections.northbound',
      'conjoiner.service',
      'conjoiner.to',
      'station.high.high barnet',
      'conjoiner.and',
      'station.low.mill hill east',
      'connections.from platform 3',
    ],
  },
  {
    station: 'Camden Town',
    branch: 'edgware',
    extraInfo: [
      'conjoiner.change here for',
      'conjoiner.all stations to',
      'station.high.high barnet',
      'conjoiner.and',
      'station.high.mill hill east',
      'connections.from platform 3',
    ],
  },
  {
    station: 'Camden Town',
    branch: 'high barnet',
    extraInfo: ['conjoiner.change here for', 'conjoiner.all stations to', 'station.high.edgware', 'connections.from platform 1'],
  },
  {
    station: 'Chalk Farm',
    branch: null,
  },
  {
    station: 'Charing Cross',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'connections.bakerloo line', 'connections.and national rail services'],
  },
  {
    station: 'Clapham Common',
    branch: null,
  },
  {
    station: 'Clapham North',
    branch: null,
  },
  {
    station: 'Clapham South',
    branch: null,
  },
  {
    station: 'Colindale',
    branch: null,
  },
  {
    station: 'Colliers Wood',
    branch: null,
  },
  {
    station: 'East Finchley',
    branch: null,
  },
  {
    station: 'Edgware',
    branch: null,
  },
  {
    station: 'Elephant & Castle',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'connections.bakerloo line', 'connections.and national rail services'],
  },
  {
    station: 'Embankment',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'connections.bakerloo', 'connections.circle', 'conjoiner.and', 'connections.district line'],
  },
  {
    station: 'Euston',
    branch: 'bank',
    extraInfo: [
      'conjoiner.change here for',
      'connections.southbound northern line',
      'conjoiner.service',
      'routeing.high.via charing cross',
      'connections.from platform 2',
      'connections.high.victoria line',
      'connections.and national rail services',
    ],
  },
  {
    station: 'Euston',
    branch: 'charing cross',
    extraInfo: [
      'conjoiner.change here for',
      'connections.southbound northern line',
      'conjoiner.service',
      'routeing.high.via bank',
      'connections.from platform 6',
      'connections.high.victoria line',
      'connections.and national rail services',
    ],
  },
  {
    station: 'Finchley Central',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'station.low.mill hill east'],
  },
  // {
  //   label: 'Finchley Central (change for Mill Hill East)',
  //   branch: null,
  // },
  {
    station: 'Golders Green',
    branch: null,
  },
  {
    station: 'Goodge Street',
    branch: null,
  },
  {
    station: 'Hampstead',
    branch: null,
  },
  {
    station: 'Hendon Central',
    branch: null,
  },
  {
    station: 'High Barnet',
    branch: null,
  },
  {
    station: 'Highgate',
    branch: null,
  },
  {
    station: 'Kennington',
    suffix: '(southbound, terminating)',
    branch: 'bank',
    // Change platform for morden bank branch as on charing cross branch
    fullAudio: ['northern line extension.this station.kennington change here southbound morden plat 2'],
  },
  {
    station: 'Kennington',
    suffix: '(southbound, to Morden)',
    branch: 'bank',
    // Change platform for BPS as on charing cross branch
    fullAudio: ['northern line extension.this station.kennington change here southbound bps plat 2'],
  },
  {
    station: 'Kennington',
    suffix: '(northbound, from Morden)',
    branch: 'bank',
    fullAudio: ['northern line extension.this station.kennington change here northbound via xc plat 1 southbound bps plat 2'],
  },
  {
    station: 'Kennington',
    suffix: '(southbound, to Battersea Power Station)',
    branch: 'charing cross',
    // Same platform for Morden when on charing cross branch
    fullAudio: ['northern line extension.this station.kennington change here southbound morden'],
  },
  {
    station: 'Kennington',
    suffix: '(northbound, from Battersea Power Station)',
    branch: 'charing cross',
    fullAudio: ['northern line extension.this station.kennington change here northbound via bank plat 3 southbound morden plat 2'],
  },
  {
    station: 'Kennington',
    suffix: '(northbound, from Morden)',
    branch: 'charing cross',
    fullAudio: ['northern line extension.this station.kennington change here northbound via bank plat 3 southbound bps plat 2'],
  },
  {
    station: 'Kennington',
    suffix: '(generic)',
    branch: null,
    fullAudio: ['northern line extension.this station.kennington change here northern other dest'],
  },
  {
    station: 'Kentish Town',
    branch: null,
  },
  {
    station: 'Kings Cross St Pancras',
    branch: null,
    extraInfo: [
      'conjoiner.change here for',
      'connections.circle',
      'connections.hammersmith and city',
      'connections.metropolitan',
      'connections.piccadilly',
      'conjoiner.and',
      'connections.victoria lines',
      'conjoiner.and',
      'connections.national and international rail services',
    ],
  },
  {
    station: 'Leicester Square',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'connections.piccadilly line'],
  },
  {
    station: 'London Bridge',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'connections.jubilee line', 'connections.and national rail services'],
  },
  {
    station: 'Mill Hill East',
    branch: null,
  },
  {
    station: 'Moorgate',
    branch: null,
    fullAudio: ['northern line extension.this station.moorgate change here'],
  },
  {
    station: 'Morden',
    branch: null,
  },
  {
    station: 'Mornington Crescent',
    branch: null,
  },
  {
    station: 'Nine Elms',
    branch: null,
    fullAudio: ['northern line extension.this station.nine elms'],
  },
  {
    station: 'Old Street',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'poi.moorfields eye hospital', 'connections.and national rail services'],
  },
  {
    station: 'Oval',
    branch: null,
  },
  {
    station: 'South Wimbledon',
    branch: null,
  },
  {
    station: 'Stockwell',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'connections.victoria line'],
  },
  {
    station: 'Tooting Bec',
    branch: null,
  },
  {
    station: 'Tooting Broadway',
    branch: null,
  },
  {
    station: 'Tottenham Court Road',
    branch: null,
    fullAudio: ['northern line extension.this station.tottenham court road change here'],
  },
  {
    station: 'Totteridge & Whetstone',
    branch: null,
  },
  {
    station: 'Tufnell Park',
    branch: null,
  },
  {
    station: 'Warren Street',
    branch: null,
    extraInfo: ['conjoiner.change here for', 'connections.victoria line'],
  },
  {
    station: 'Waterloo',
    branch: null,
    extraInfo: [
      'conjoiner.change here for',
      'connections.bakerloo',
      'connections.jubilee',
      'conjoiner.and',
      'connections.waterloo and city lines',
      'connections.and national rail services',
      { id: 'connections.exit for riverboat services from', opts: { delayStart: 200 } },
      'poi.waterloo pier',
    ],
  },
  {
    station: 'West Finchley',
    branch: null,
    extraInfo: ['please mind the gap between the train and the platform'],
  },
  {
    station: 'Woodside Park',
    branch: null,
  },
]

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
  terminatingAudio?: AudioItem[]
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
  {
    label: 'Bank',
    audio: ['northern line extension.next station.bank change here'],
  },
  {
    label: 'Battersea Power Station (terminating)',
    terminatingAudio: ['northern line extension.next station.battersea power station terminates'],
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
      ...(ThisStationData.find(s => s.station === 'Charing Cross')?.extraInfo || []),
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
      ...(ThisStationData.find(s => s.station === 'Clapham Common')?.extraInfo || []),
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
    onlyTerminates: true,
    terminatingAudio: ['next station.terminating.edgware'],
  },
  { label: 'Elephant & Castle' },
  {
    label: 'Embankment',
    audio: [
      'conjoiner.the next station is',
      'station.low.embankment',
      ...(ThisStationData.find(s => s.station === 'Embankment')?.extraInfo || []),
      'please mind the gap between the train and the platform',
    ],
  },
  {
    label: 'Euston (Bank branch s/b)',
    audio: [
      'conjoiner.the next station is',
      'station.high.euston',
      'routeing.bank branch',
      ...(ThisStationData.find(s => s.station === 'Euston' && s.branch === 'bank')?.extraInfo || []),
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
    label: 'Euston (Bank branch n/b)',
    audio: [
      'conjoiner.the next station is',
      'station.high.euston',
      'routeing.bank branch',
      ...(ThisStationData.find(s => s.station === 'Euston' && s.branch === 'bank')?.extraInfo || []),
    ],
  },
  {
    label: 'Euston (Charing Cross branch)',
    audio: [
      'conjoiner.the next station is',
      'station.high.euston',
      'routeing.charing cross branch',
      ...(ThisStationData.find(s => s.station === 'Euston' && s.branch === 'charing cross')?.extraInfo || []),
    ],
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
    audio: [
      'next station.golders green',
      ...(ThisStationData.find(s => s.station === 'Golders Green')?.extraInfo || []),
      'please mind the gap between the train and the platform',
    ],
    terminatingAudio: ['next station.terminating.golders green'],
  },
  {
    label: 'Goodge Street',
    audio: ['conjoiner.the next station is', 'station.low.goodge street'],
  },
  {
    label: 'Hampstead',
    audio: [
      'next station.hampstead',
      ...(ThisStationData.find(s => s.station === 'Hampstead')?.extraInfo || []),
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
    label: 'Kennington (southbound via Bank)',
    terminatingAudio: ['northern line extension.next station.kennington terminates change here southbound morden plat 4 bps plat 2'],
    audio: ['northern line extension.next station.kennington change here southbound bps plat 2'],
  },
  {
    label: 'Kennington (northbound via Bank)',
    audio: ['northern line extension.next station.kennington change here northbound via xc plat 1 southbound bps plat 2'],
  },
  {
    label: 'Kennington (southbound via Charing Cross, to BPS)',
    terminatingAudio: ['northern line extension.next station.kennington terminates change here morden bps no train plat 4'],
    audio: ['northern line extension.next station.kennington change here southbound morden'],
  },
  {
    label: 'Kennington (southbound via Charing Cross, to Morden)',
    terminatingAudio: ['northern line extension.next station.kennington terminates change here morden bps no train plat 4'],
    audio: ['northern line extension.next station.kennington change here southbound bps plat 2'],
  },
  {
    label: 'Kennington (northbound via Charing Cross, from BPS)',
    audio: ['northern line extension.next station.kennington change here northbound via bank plat 3 morden plat 2'],
  },
  {
    label: 'Kennington (terminating southbound)',
    terminatingAudio: ['northern line extension.next station.kennington terminates change here southbound morden bps'],
    onlyTerminates: true,
  },
  { label: 'Kentish Town' },
  { label: 'Kings Cross St Pancras' },
  {
    label: 'Leicester Square',
    audio: [
      'conjoiner.the next station is',
      'station.low.leicester square',
      ...(ThisStationData.find(s => s.station === 'Leicester Square')?.extraInfo || []),
    ],
  },
  { label: 'London Bridge' },
  {
    label: 'Mill Hill East',
    terminatingAudio: ['next station.terminating.mill hill east'],
  },
  {
    label: 'Moorgate',
    audio: [
      'northern line extension.next station.moorgate change here',
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
    terminatingAudio: [
      'northern line extension.next station.moorgate terminates change here',
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
    terminatingAudio: ['northern line extension.next station.nine elms terminates'],
    audio: ['northern line extension.next station.nine elms'],
  },
  { label: 'Old Street' },
  { label: 'Oval' },
  { label: 'South Wimbledon', conditionalMindTheGap: true },
  { label: 'Stockwell' },
  { label: 'Tooting Bec' },
  { label: 'Tooting Broadway' },
  {
    label: 'Tottenham Court Road',
    audio: ['northern line extension.next station.tottenham court road change here'],
  },
  { label: 'Totteridge & Whetstone' },
  { label: 'Tufnell Park' },
  {
    label: 'Warren Street',
    audio: [
      'conjoiner.the next station is',
      'station.low.warren street',
      ...(ThisStationData.find(s => s.station === 'Warren Street')?.extraInfo || []),
    ],
  },
  {
    label: 'Waterloo',
    audio: ['conjoiner.the next station is', 'station.low.waterloo', ...(ThisStationData.find(s => s.station === 'Waterloo')?.extraInfo || [])],
  },
  { label: 'West Finchley' },
  { label: 'Woodside Park' },
]

interface ThisStationItem {
  station: string
  suffix?: string
  branch: null | 'charing cross' | 'bank' | 'edgware' | 'high barnet'
  extraInfo?: AudioItem[]
  fullAudio?: AudioItem[]
}

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

    const stationInfo = ThisStationData[parseInt(options.stationNameIndex)]
    const isTerminating = options.terminatingStationName.endsWith(stationInfo.station)

    if (stationInfo.fullAudio) {
      files.push(...stationInfo.fullAudio)

      if (isTerminating) {
        files.push({ id: 'this train terminates here', opts: { delayStart: 500 } }, { id: 'all change please', opts: { delayStart: 500 } })
      } else {
        files.push(...this.assembleDestinationInfoSegments(options.terminatingStationName, 500))
      }

      return await this.playAudioFiles(files, download)
    }

    files.push('conjoiner.this station is')

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

    if (isTerminating) {
      files.push({ id: 'this train terminates here', opts: { delayStart: 500 } }, { id: 'all change please', opts: { delayStart: 500 } })
    } else {
      files.push(...this.assembleDestinationInfoSegments(options.terminatingStationName, 500))
    }

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
            options: AvailableDestinations.reduce(
              (acc, dest) => {
                acc.push({ title: dest.station, value: dest.station })

                if (dest.viaBank) {
                  acc.push({ title: `${dest.station} via Bank`, value: `via bank.${dest.station}` })
                }

                if (dest.viaCharingCross) {
                  acc.push({ title: `${dest.station} via Charing Cross`, value: `via charing cross.${dest.station}` })
                }

                return acc
              },
              [] as { title: string; value: string }[],
            ),
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

              if (s.suffix) {
                label += ` ${s.suffix}`
              }

              return { title: label, value: i.toString() }
            }),
            type: 'select',
          },
          terminatingStationName: {
            name: 'Destination station',
            default: AvailableDestinations[0].station,
            options: AvailableDestinations.reduce(
              (acc, dest) => {
                acc.push({ title: dest.station, value: dest.station })

                if (dest.viaBank) {
                  acc.push({ title: `${dest.station} via Bank`, value: `via bank.${dest.station}` })
                }

                if (dest.viaCharingCross) {
                  acc.push({ title: `${dest.station} via Charing Cross`, value: `via charing cross.${dest.station}` })
                }

                return acc
              },
              [] as { title: string; value: string }[],
            ),
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
