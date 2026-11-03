import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import CallingAtSelector, { CallingAtPoint } from '@components/CallingAtSelector'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AnyCustomAnnouncementTab, AudioItem, CustomAnnouncementTab, CustomButtonTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'

type DelayDuration = '10' | '15' | '20' | '30' | '40' | '50' | 'over-an-hour'

type DisruptionType = 'running late' | 'delayed' | 'diverted' | 'terminating early' | 'not calling at' | 'engineering work'

interface IStartOfJourneyOptions {
  serviceIntro: string
  terminatesAtCode: string
  callingAtCodes: CallingAtPoint[]
}

interface IDepartingStationOptions {
  doorWarning: string
  serviceIntro: string
  terminatesAtCode: string
  nextStopWording: string
  nextStationCode: string
  shortPlatform: string
}

interface IApproachingStationOptions {
  stationCode: string
  isFinalStop: boolean
  doorSide: string
  shortPlatform: string
  thanks: string
}

interface IAtStationOptions {
  stationCode: string
  isFinalStop: boolean
  serviceIntro: string
  terminatesAtCode: string
  doorSide: string
  thanks: string
}

interface IDisruptionOptions {
  disruptionType: DisruptionType
  delayDuration: DelayDuration
  delayReason: string
  stationCode: string
}

export const SENTENCE_GAP = 500

/**
 * Station recordings whose codes are missing from the national list, so they aren't stations the rest of the site knows about. The names are
 * inferred from the codes and the Merseyrail network, not confirmed against the recordings.
 */
const AdditionalStations: { crs: string; name: string }[] = [
  { crs: 'LIV2', name: 'Liverpool Lime Street (alternate recording)' },
  { crs: 'LSP', name: 'Liverpool South Parkway' },
  { crs: 'MHN', name: 'Maghull North' },
  { crs: 'WXM', name: 'Wrexham' },
]

const AdditionalStationsTitleValueMap = AdditionalStations.map(s => ({ title: `${s.name} (${s.crs})`, value: s.crs }))

const NORTHERN_LINE_INTRO = 'conjoiners.this is the merseyrail northern line service to'
const WIRRAL_LINE_INTRO = 'conjoiners.this is the merseyrail wirral line service to'

const SOUTHPORT_TO_HUNTS_CROSS = [
  'SOP',
  'BDL',
  'HIL',
  'ANS',
  'FRE',
  'FBY',
  'HTO',
  'HLR',
  'BLN',
  'WLO',
  'SFL',
  'BNW',
  'BOT',
  'BAH',
  'SDL',
  'MRF',
  'LVC',
  'BRW',
  'STM',
  'AIG',
  'CSG',
  'LSP',
  'HNX',
]
const ORMSKIRK_TO_LIVERPOOL_CENTRAL = ['OMS', 'AUG', 'TWN', 'MHN', 'MAG', 'ORN', 'AIN', 'OPK', 'WAO', 'KKD', 'SDL', 'MRF', 'LVC']
const HEADBOLT_LANE_TO_LIVERPOOL_CENTRAL = ['HBL', 'KIR', 'FAZ', 'RIL', 'KKD', 'SDL', 'MRF', 'LVC']

const LIVERPOOL_LOOP_FROM_HAMILTON_SQUARE = ['BKQ', 'LVJ', 'MRF', 'LIV', 'LVC']
// Trains leave the loop at Central and call at James Street again on the way back under the Mersey.
const HAMILTON_SQUARE_FROM_LIVERPOOL_CENTRAL = ['LVC', 'LVJ', 'BKQ']

const WEST_KIRBY_TO_HAMILTON_SQUARE = ['WKI', 'HYK', 'MNR', 'MEO', 'MRT', 'LSW', 'BID', 'BKN', 'BKP', 'CNP', 'BKQ']
const NEW_BRIGHTON_TO_HAMILTON_SQUARE = ['NBN', 'WLG', 'WLV', 'BKN', 'BKP', 'CNP', 'BKQ']
const CHESTER_TO_HAMILTON_SQUARE = ['CTR', 'BAC', 'CPU', 'HOO', 'ERA', 'BOM', 'BMR', 'SPI', 'PSL', 'BEB', 'RFY', 'GNL', 'BKC', 'BKQ']
const ELLESMERE_PORT_TO_HAMILTON_SQUARE = ['ELP', 'OVE', 'LTT', 'HOO', 'ERA', 'BOM', 'BMR', 'SPI', 'PSL', 'BEB', 'RFY', 'GNL', 'BKC', 'BKQ']

function wirralLineToLiverpool(branch: string[]): string[] {
  return [...branch.slice(0, -1), ...LIVERPOOL_LOOP_FROM_HAMILTON_SQUARE]
}

function wirralLineFromLiverpool(branch: string[]): string[] {
  return [...HAMILTON_SQUARE_FROM_LIVERPOOL_CENTRAL.slice(0, -1), ...[...branch].reverse()]
}

function journeyPreset(name: string, serviceIntro: string, stops: string[]): ICustomAnnouncementPreset<IStartOfJourneyOptions> {
  return {
    name,
    state: {
      serviceIntro,
      terminatesAtCode: stops[stops.length - 1],
      callingAtCodes: stops.slice(0, -1).map(crsToStationItemMapper),
    },
  }
}

const START_OF_JOURNEY_PRESETS: ICustomAnnouncementPreset<IStartOfJourneyOptions>[] = [
  journeyPreset('Southport to Hunts Cross', NORTHERN_LINE_INTRO, SOUTHPORT_TO_HUNTS_CROSS),
  journeyPreset('Hunts Cross to Southport', NORTHERN_LINE_INTRO, [...SOUTHPORT_TO_HUNTS_CROSS].reverse()),
  journeyPreset('Ormskirk to Liverpool Central', NORTHERN_LINE_INTRO, ORMSKIRK_TO_LIVERPOOL_CENTRAL),
  journeyPreset('Liverpool Central to Ormskirk', NORTHERN_LINE_INTRO, [...ORMSKIRK_TO_LIVERPOOL_CENTRAL].reverse()),
  journeyPreset('Headbolt Lane to Liverpool Central', NORTHERN_LINE_INTRO, HEADBOLT_LANE_TO_LIVERPOOL_CENTRAL),
  journeyPreset('Liverpool Central to Headbolt Lane', NORTHERN_LINE_INTRO, [...HEADBOLT_LANE_TO_LIVERPOOL_CENTRAL].reverse()),
  journeyPreset('West Kirby to Liverpool Central', WIRRAL_LINE_INTRO, wirralLineToLiverpool(WEST_KIRBY_TO_HAMILTON_SQUARE)),
  journeyPreset('Liverpool Central to West Kirby', WIRRAL_LINE_INTRO, wirralLineFromLiverpool(WEST_KIRBY_TO_HAMILTON_SQUARE)),
  journeyPreset('New Brighton to Liverpool Central', WIRRAL_LINE_INTRO, wirralLineToLiverpool(NEW_BRIGHTON_TO_HAMILTON_SQUARE)),
  journeyPreset('Liverpool Central to New Brighton', WIRRAL_LINE_INTRO, wirralLineFromLiverpool(NEW_BRIGHTON_TO_HAMILTON_SQUARE)),
  journeyPreset('Chester to Liverpool Central', WIRRAL_LINE_INTRO, wirralLineToLiverpool(CHESTER_TO_HAMILTON_SQUARE)),
  journeyPreset('Liverpool Central to Chester', WIRRAL_LINE_INTRO, wirralLineFromLiverpool(CHESTER_TO_HAMILTON_SQUARE)),
  journeyPreset('Ellesmere Port to Liverpool Central', WIRRAL_LINE_INTRO, wirralLineToLiverpool(ELLESMERE_PORT_TO_HAMILTON_SQUARE)),
  journeyPreset('Liverpool Central to Ellesmere Port', WIRRAL_LINE_INTRO, wirralLineFromLiverpool(ELLESMERE_PORT_TO_HAMILTON_SQUARE)),
]

const SERVICE_INTRO_OPTIONS: { title: string; value: string }[] = [
  { title: 'Welcome aboard this Merseyrail service to …', value: 'messages.welcome aboard this merseyrail service to' },
  { title: 'Welcome to the Merseyrail service to …', value: 'conjoiners.welcome to the merseyrail service to' },
  { title: 'This is the Merseyrail service to …', value: 'conjoiners.this is the merseyrail service to' },
  { title: 'This is the Merseyrail Northern Line service to …', value: 'conjoiners.this is the merseyrail northern line service to' },
  { title: 'This is the Merseyrail Wirral Line service to …', value: 'conjoiners.this is the merseyrail wirral line service to' },
  { title: 'This train is for …', value: 'messages.this train is for' },
  { title: 'This train is going to …', value: 'messages.this train is going to' },
  { title: 'Our destination is …', value: 'messages.our destination is' },
]

const NEXT_STOP_OPTIONS: { title: string; value: string }[] = [
  { title: 'The next station is …', value: 'conjoiners.the next station is' },
  { title: 'The next station stop will be …', value: 'conjoiners.the next station stop will be' },
  { title: 'The next stop is …', value: 'conjoiners.the next stop is' },
  { title: 'The next stop will be …', value: 'conjoiners.the next stop will be' },
]

const DOOR_WARNING_OPTIONS: { title: string; value: string }[] = [
  { title: 'None', value: '' },
  { title: 'Please mind the closing doors', value: 'messages.please mind the closing doors' },
  { title: 'Please stand clear of the doors', value: 'messages.please stand clear of the doors this train is about to depar' },
  { title: 'Ready to leave, stand clear of the closing doors', value: 'messages.this train is ready to leave please stand clear of the closi' },
  { title: 'Ready to leave, stand back from the platform edge', value: 'messages.this train is ready to leave please stand back from the plat' },
]

const DOOR_SIDE_OPTIONS: { title: string; value: string }[] = [
  { title: 'None', value: '' },
  { title: 'Doors open on the left hand side', value: 'messages.doors open on the left hand side' },
  { title: 'Doors open on the right hand side', value: 'messages.doors open on the right hand side' },
]

const SHORT_PLATFORM_OPTIONS: { title: string; value: string }[] = [
  { title: 'None', value: '' },
  { title: 'The doors in the rear 4 cars will not open', value: 'messages.the doors in the rear 4 cars will not open at this station' },
  { title: 'The front and rear passenger doors will not open', value: 'messages.the front and rear passenger doors will not open at this sta' },
]

const THANKS_OPTIONS: { title: string; value: string }[] = [
  { title: 'None', value: '' },
  { title: 'Thank you for travelling with Merseyrail', value: 'messages.thank you for travelling with merseyrail' },
  {
    title: 'Thank you for travelling with Merseyrail, we hope you have a …',
    value: 'messages.thank you for travelling with merseyrail we hoped you have a',
  },
  { title: 'Thank you for travelling with us', value: 'messages.thank you for travelling with us' },
]

const DISRUPTION_TYPE_OPTIONS: { title: string; value: DisruptionType }[] = [
  { title: 'Running late', value: 'running late' },
  { title: 'Delayed', value: 'delayed' },
  { title: 'Diverted', value: 'diverted' },
  { title: 'Terminating early', value: 'terminating early' },
  { title: 'Not calling at a station', value: 'not calling at' },
  { title: 'Engineering work', value: 'engineering work' },
]

const DELAY_DURATION_OPTIONS: { title: string; value: DelayDuration }[] = [
  { title: '10 minutes', value: '10' },
  { title: '15 minutes', value: '15' },
  { title: '20 minutes', value: '20' },
  { title: '30 minutes', value: '30' },
  { title: '40 minutes', value: '40' },
  { title: '50 minutes', value: '50' },
  { title: 'Over an hour', value: 'over-an-hour' },
]

const REASONS = [
  'a failed train ahead',
  'a lineside incident',
  'a points failure',
  'adverse weather conditions',
  'circumstances beyond our control',
  'operational difficulties',
  'power problems',
  'power supply problems',
  'signaling problems',
  'technical problems with this train',
  'technical problems',
  'vandalism',
]

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const MIND_THE_DOORS = 'messages.please mind the closing doors'
const THANK_YOU = 'messages.thank you for travelling with merseyrail'

function departingPreset(
  name: string,
  serviceIntro: string,
  terminatesAtCode: string,
  nextStationCode: string,
): ICustomAnnouncementPreset<IDepartingStationOptions> {
  return {
    name,
    state: {
      doorWarning: MIND_THE_DOORS,
      serviceIntro,
      terminatesAtCode,
      nextStopWording: 'conjoiners.the next station is',
      nextStationCode,
      shortPlatform: '',
    },
  }
}

function approachingPreset(name: string, stationCode: string, isFinalStop: boolean): ICustomAnnouncementPreset<IApproachingStationOptions> {
  return { name, state: { stationCode, isFinalStop, doorSide: '', shortPlatform: '', thanks: THANK_YOU } }
}

function atStationPreset(
  name: string,
  stationCode: string,
  onward: { serviceIntro: string; terminatesAtCode: string } | null,
): ICustomAnnouncementPreset<IAtStationOptions> {
  return {
    name,
    state: {
      stationCode,
      isFinalStop: onward === null,
      serviceIntro: onward?.serviceIntro ?? NORTHERN_LINE_INTRO,
      terminatesAtCode: onward?.terminatesAtCode ?? stationCode,
      doorSide: '',
      thanks: THANK_YOU,
    },
  }
}

const DEPARTING_STATION_PRESETS: ICustomAnnouncementPreset<IDepartingStationOptions>[] = [
  departingPreset('Southport, for Hunts Cross', NORTHERN_LINE_INTRO, 'HNX', 'BDL'),
  departingPreset('Liverpool Central, for Southport', NORTHERN_LINE_INTRO, 'SOP', 'MRF'),
  departingPreset('Ormskirk, for Liverpool Central', NORTHERN_LINE_INTRO, 'LVC', 'AUG'),
  departingPreset('Headbolt Lane, for Liverpool Central', NORTHERN_LINE_INTRO, 'LVC', 'KIR'),
  departingPreset('West Kirby, for Liverpool Central', WIRRAL_LINE_INTRO, 'LVC', 'HYK'),
  departingPreset('New Brighton, for Liverpool Central', WIRRAL_LINE_INTRO, 'LVC', 'WLG'),
  departingPreset('Chester, for Liverpool Central', WIRRAL_LINE_INTRO, 'LVC', 'BAC'),
  departingPreset('Liverpool Central, for Chester', WIRRAL_LINE_INTRO, 'CTR', 'LVJ'),
]

const APPROACHING_STATION_PRESETS: ICustomAnnouncementPreset<IApproachingStationOptions>[] = [
  approachingPreset('Moorfields', 'MRF', false),
  approachingPreset('Liverpool Central', 'LVC', false),
  approachingPreset('Hamilton Square', 'BKQ', false),
  approachingPreset('Liverpool Central (terminating)', 'LVC', true),
  approachingPreset('Southport (terminating)', 'SOP', true),
  approachingPreset('Hunts Cross (terminating)', 'HNX', true),
  approachingPreset('Chester (terminating)', 'CTR', true),
  approachingPreset('West Kirby (terminating)', 'WKI', true),
]

const AT_STATION_PRESETS: ICustomAnnouncementPreset<IAtStationOptions>[] = [
  atStationPreset('Moorfields, for Hunts Cross', 'MRF', { serviceIntro: NORTHERN_LINE_INTRO, terminatesAtCode: 'HNX' }),
  atStationPreset('Sandhills, for Southport', 'SDL', { serviceIntro: NORTHERN_LINE_INTRO, terminatesAtCode: 'SOP' }),
  atStationPreset('Hamilton Square, for Liverpool Central', 'BKQ', { serviceIntro: WIRRAL_LINE_INTRO, terminatesAtCode: 'LVC' }),
  atStationPreset('James Street, for New Brighton', 'LVJ', { serviceIntro: WIRRAL_LINE_INTRO, terminatesAtCode: 'NBN' }),
  atStationPreset('Liverpool Central (terminating)', 'LVC', null),
  atStationPreset('Ormskirk (terminating)', 'OMS', null),
  atStationPreset('Chester (terminating)', 'CTR', null),
  atStationPreset('New Brighton (terminating)', 'NBN', null),
]

const DISRUPTION_PRESETS: ICustomAnnouncementPreset<IDisruptionOptions>[] = [
  {
    name: 'Running 10 minutes late, signalling problems',
    state: { disruptionType: 'running late', delayDuration: '10', delayReason: 'signaling problems', stationCode: 'LIV' },
  },
  {
    name: 'Running over an hour late, power supply problems',
    state: { disruptionType: 'running late', delayDuration: 'over-an-hour', delayReason: 'power supply problems', stationCode: 'LIV' },
  },
  {
    name: 'Delayed, a failed train ahead',
    state: { disruptionType: 'delayed', delayDuration: '10', delayReason: 'a failed train ahead', stationCode: 'LIV' },
  },
  {
    name: 'Not calling at Liverpool Lime Street, operational difficulties',
    state: { disruptionType: 'not calling at', delayDuration: '10', delayReason: 'operational difficulties', stationCode: 'LIV' },
  },
  {
    name: 'Terminating early, a points failure',
    state: { disruptionType: 'terminating early', delayDuration: '10', delayReason: 'a points failure', stationCode: 'LIV' },
  },
  {
    name: 'Terminating early, engineering work',
    state: { disruptionType: 'engineering work', delayDuration: '10', delayReason: 'vandalism', stationCode: 'LIV' },
  },
]

export default class MerseyrailClass777 extends TrainAnnouncementSystem {
  readonly NAME = 'Merseyrail Class 777'
  readonly ID = 'MERSEYRAIL_CLASS_777_V1'
  readonly FILE_PREFIX = 'Class 777'
  readonly SYSTEM_TYPE = 'train'
  readonly DESCRIPTION = 'Generate Merseyrail Class 777 on-train announcements using real audio recordings.'

  private callingPointsAudio(callingAtCodes: CallingAtPoint[], terminatesAtCode: string): AudioItem[] {
    return this.pluraliseAudio([...callingAtCodes.map(stn => `stations.${stn.crsCode}`), `stations.${terminatesAtCode}`], {
      andId: 'conjoiners.and',
    })
  }

  private validateCallingPoints(callingAtCodes: CallingAtPoint[]): boolean {
    return callingAtCodes.every(stn => this.validateStationExists(stn.crsCode))
  }

  private delayDurationAudio(delayDuration: DelayDuration): AudioItem {
    return delayDuration === 'over-an-hour' ? 'delays.more than an hour late' : `time.${delayDuration} minutes late`
  }

  /** The chosen sentence after a pause, or nothing where the option's "None" is chosen. */
  private optionalSentenceAudio(id: string): AudioItem[] {
    return id ? [{ id, opts: { delayStart: SENTENCE_GAP } }] : []
  }

  private async playStartOfJourneyAnnouncement(options: IStartOfJourneyOptions, download: boolean = false): Promise<void> {
    const { serviceIntro, terminatesAtCode, callingAtCodes } = options

    if (!this.validateStationExists(terminatesAtCode)) return

    const files: AudioItem[] = [serviceIntro, `stations.${terminatesAtCode}`]

    if (callingAtCodes.length > 0) {
      if (!this.validateCallingPoints(callingAtCodes)) return

      files.push('conjoiners.calling at', ...this.callingPointsAudio(callingAtCodes, terminatesAtCode))
    }

    await this.playAudioFiles(files, download)
  }

  private async playDepartingStationAnnouncement(options: IDepartingStationOptions, download: boolean = false): Promise<void> {
    const { doorWarning, serviceIntro, terminatesAtCode, nextStopWording, nextStationCode, shortPlatform } = options

    if (!this.validateStationExists(terminatesAtCode) || !this.validateStationExists(nextStationCode)) return

    const files: AudioItem[] = [
      ...(doorWarning ? [doorWarning] : []),
      { id: serviceIntro, opts: { delayStart: doorWarning ? SENTENCE_GAP : 0 } },
      `stations.${terminatesAtCode}`,
      { id: nextStopWording, opts: { delayStart: SENTENCE_GAP } },
      `stations.${nextStationCode}`,
      ...this.optionalSentenceAudio(shortPlatform),
    ]

    await this.playAudioFiles(files, download)
  }

  private async playApproachingStationAnnouncement(options: IApproachingStationOptions, download: boolean = false): Promise<void> {
    const { stationCode, isFinalStop, doorSide, shortPlatform, thanks } = options

    if (!this.validateStationExists(stationCode)) return

    const files: AudioItem[] = ['messages.were now approaching', `stations.${stationCode}`]

    if (isFinalStop) {
      files.push('delays.where this train terminates')
    }

    files.push(...this.optionalSentenceAudio(doorSide), ...this.optionalSentenceAudio(shortPlatform))

    if (isFinalStop) {
      files.push(
        { id: 'messages.please ensure that you take all your personal belongings wit', opts: { delayStart: SENTENCE_GAP } },
        ...this.optionalSentenceAudio(thanks),
      )
    }

    await this.playAudioFiles(files, download)
  }

  private async playAtStationAnnouncement(options: IAtStationOptions, download: boolean = false): Promise<void> {
    const { stationCode, isFinalStop, serviceIntro, terminatesAtCode, doorSide, thanks } = options

    if (!this.validateStationExists(stationCode)) return

    const files: AudioItem[] = ['conjoiners.this is', `stations.${stationCode}`]

    if (isFinalStop) {
      files.push(
        { id: 'delays.this train terminates here', opts: { delayStart: SENTENCE_GAP } },
        { id: 'messages.all change please', opts: { delayStart: SENTENCE_GAP } },
        { id: 'messages.please ensure that you take all your personal belongings wit', opts: { delayStart: SENTENCE_GAP } },
        ...this.optionalSentenceAudio(doorSide),
        ...this.optionalSentenceAudio(thanks),
      )
    } else {
      if (!this.validateStationExists(terminatesAtCode)) return

      files.push(
        { id: serviceIntro, opts: { delayStart: SENTENCE_GAP } },
        `stations.${terminatesAtCode}`,
        ...this.optionalSentenceAudio(doorSide),
      )
    }

    await this.playAudioFiles(files, download)
  }

  private async playDisruptionAnnouncement(options: IDisruptionOptions, download: boolean = false): Promise<void> {
    const { disruptionType, delayDuration, delayReason, stationCode } = options

    const reason = `delays.reasons.${delayReason}`
    const apology: AudioItem = { id: 'delays.were sorry for the delay and inconvenience this will cause', opts: { delayStart: SENTENCE_GAP } }
    const files: AudioItem[] = []

    switch (disruptionType) {
      case 'running late':
        files.push(
          'delays.this train is being delayed due to',
          reason,
          { id: 'messages.this service is now running', opts: { delayStart: SENTENCE_GAP } },
          this.delayDurationAudio(delayDuration),
          { id: 'delays.were sorry for the late running of this service', opts: { delayStart: SENTENCE_GAP } },
        )
        break

      case 'delayed':
        files.push('delays.this train is being delayed due to', reason, apology)
        break

      case 'diverted':
        files.push('delays.this train is being diverted due to', reason, apology)
        break

      case 'terminating early':
        files.push(
          'delays.this train is terminating early due to',
          reason,
          { id: 'delays.this train will terminate at the next station', opts: { delayStart: SENTENCE_GAP } },
          apology,
        )
        break

      case 'not calling at':
        if (!this.validateStationExists(stationCode)) return

        files.push(
          'conjoiners.this train does not call at',
          `stations.${stationCode}`,
          { id: 'conjoiners.this is due to', opts: { delayStart: SENTENCE_GAP } },
          reason,
          apology,
        )
        break

      case 'engineering work':
        files.push('delays.due to engineering work this train will terminate at the nex', apology)
        break
    }

    await this.playAudioFiles(files, download)
  }

  readonly AllAvailableStationNames: string[] = [
    'AIG',
    'AIN',
    'ANS',
    'AUG',
    'BAC',
    'BAH',
    'BDL',
    'BEB',
    'BID',
    'BKC',
    'BKN',
    'BKP',
    'BKQ',
    'BLN',
    'BMR',
    'BNW',
    'BOM',
    'BOT',
    'BRW',
    'CNP',
    'CPU',
    'CSG',
    'CTR',
    'ELP',
    'ERA',
    'FAZ',
    'FBY',
    'FRE',
    'GNL',
    'HBL',
    'HIL',
    'HLR',
    'HNX',
    'HOO',
    'HTO',
    'HYK',
    'KIR',
    'KKD',
    'LIV',
    'LSW',
    'LTT',
    'LVC',
    'LVJ',
    'MAG',
    'MEO',
    'MNR',
    'MRF',
    'MRT',
    'NBN',
    'OMS',
    'OPK',
    'ORN',
    'OVE',
    'PRS',
    'PSL',
    'RFY',
    'RIL',
    'SDL',
    'SFL',
    'SKM',
    'SOP',
    'SPI',
    'STM',
    'TWN',
    'WAO',
    'WKI',
    'WLG',
    'WLO',
    'WLV',
    ...AdditionalStations.map(s => s.crs),
  ]

  readonly AvailableStationNames = {
    low: this.AllAvailableStationNames,
    high: this.AllAvailableStationNames,
  }

  readonly StationOptions: { title: string; value: string }[] = AllStationsTitleValueMap.filter(s =>
    this.AllAvailableStationNames.includes(s.value),
  )
    .concat(AdditionalStationsTitleValueMap)
    .sort((a, b) => a.title.localeCompare(b.title))

  readonly ReasonOptions: { title: string; value: string }[] = REASONS.map(reason => ({ title: capitalise(reason), value: reason }))

  readonly customAnnouncementTabs: Record<string, AnyCustomAnnouncementTab> = {
    startOfJourney: {
      name: 'Start of journey',
      component: CustomAnnouncementPane,
      defaultState: {
        serviceIntro: SERVICE_INTRO_OPTIONS[0].value,
        terminatesAtCode: this.StationOptions[0].value,
        callingAtCodes: [],
      },
      props: {
        playHandler: this.playStartOfJourneyAnnouncement.bind(this),
        presets: START_OF_JOURNEY_PRESETS,
        options: {
          serviceIntro: {
            name: 'Service wording',
            type: 'select',
            default: SERVICE_INTRO_OPTIONS[0].value,
            options: SERVICE_INTRO_OPTIONS,
          },
          terminatesAtCode: {
            name: 'Terminates at',
            type: 'select',
            default: this.StationOptions[0].value,
            options: this.StationOptions,
          },
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              selectLabel: 'Calling points before the terminus',
              placeholder: 'Add a station…',
              heading: 'Calling at…',
              availableStations: this.AllAvailableStationNames,
              additionalOptions: AdditionalStationsTitleValueMap,
            },
            default: [],
          },
        },
      },
    } satisfies CustomAnnouncementTab<IStartOfJourneyOptions>,
    departingStation: {
      name: 'Departing station',
      component: CustomAnnouncementPane,
      defaultState: {
        doorWarning: '',
        serviceIntro: 'conjoiners.this is the merseyrail service to',
        terminatesAtCode: this.StationOptions[0].value,
        nextStopWording: NEXT_STOP_OPTIONS[0].value,
        nextStationCode: this.StationOptions[0].value,
        shortPlatform: '',
      },
      props: {
        playHandler: this.playDepartingStationAnnouncement.bind(this),
        presets: DEPARTING_STATION_PRESETS,
        options: {
          doorWarning: {
            name: 'Door warning',
            type: 'select',
            default: '',
            options: DOOR_WARNING_OPTIONS,
          },
          serviceIntro: {
            name: 'Service wording',
            type: 'select',
            default: 'conjoiners.this is the merseyrail service to',
            options: SERVICE_INTRO_OPTIONS,
          },
          terminatesAtCode: {
            name: 'Terminates at',
            type: 'select',
            default: this.StationOptions[0].value,
            options: this.StationOptions,
          },
          nextStopWording: {
            name: 'Next stop wording',
            type: 'select',
            default: NEXT_STOP_OPTIONS[0].value,
            options: NEXT_STOP_OPTIONS,
          },
          nextStationCode: {
            name: 'Next station',
            type: 'select',
            default: this.StationOptions[0].value,
            options: this.StationOptions,
          },
          shortPlatform: {
            name: 'Short platform at next station',
            type: 'select',
            default: '',
            options: SHORT_PLATFORM_OPTIONS,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IDepartingStationOptions>,
    approachingStation: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      defaultState: {
        stationCode: this.StationOptions[0].value,
        isFinalStop: false,
        doorSide: '',
        shortPlatform: '',
        thanks: THANKS_OPTIONS[1].value,
      },
      props: {
        playHandler: this.playApproachingStationAnnouncement.bind(this),
        presets: APPROACHING_STATION_PRESETS,
        options: {
          stationCode: {
            name: 'Station',
            type: 'select',
            default: this.StationOptions[0].value,
            options: this.StationOptions,
          },
          isFinalStop: {
            name: 'Final stop for this service',
            type: 'boolean',
            default: false,
          },
          doorSide: {
            name: 'Door side',
            type: 'select',
            default: '',
            options: DOOR_SIDE_OPTIONS,
          },
          shortPlatform: {
            name: 'Short platform',
            type: 'select',
            default: '',
            options: SHORT_PLATFORM_OPTIONS,
          },
          thanks: {
            name: 'Thank you wording',
            type: 'select',
            default: THANKS_OPTIONS[1].value,
            options: THANKS_OPTIONS,
            onlyShowWhen: state => state.isFinalStop,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IApproachingStationOptions>,
    atStation: {
      name: 'At station',
      component: CustomAnnouncementPane,
      defaultState: {
        stationCode: this.StationOptions[0].value,
        isFinalStop: false,
        serviceIntro: 'conjoiners.this is the merseyrail service to',
        terminatesAtCode: this.StationOptions[0].value,
        doorSide: '',
        thanks: THANKS_OPTIONS[1].value,
      },
      props: {
        playHandler: this.playAtStationAnnouncement.bind(this),
        presets: AT_STATION_PRESETS,
        options: {
          stationCode: {
            name: 'This station',
            type: 'select',
            default: this.StationOptions[0].value,
            options: this.StationOptions,
          },
          isFinalStop: {
            name: 'Final stop for this service',
            type: 'boolean',
            default: false,
          },
          serviceIntro: {
            name: 'Service wording',
            type: 'select',
            default: 'conjoiners.this is the merseyrail service to',
            options: SERVICE_INTRO_OPTIONS,
            onlyShowWhen: state => !state.isFinalStop,
          },
          terminatesAtCode: {
            name: 'Terminates at',
            type: 'select',
            default: this.StationOptions[0].value,
            options: this.StationOptions,
            onlyShowWhen: state => !state.isFinalStop,
          },
          doorSide: {
            name: 'Door side',
            type: 'select',
            default: '',
            options: DOOR_SIDE_OPTIONS,
          },
          thanks: {
            name: 'Thank you wording',
            type: 'select',
            default: THANKS_OPTIONS[1].value,
            options: THANKS_OPTIONS,
            onlyShowWhen: state => state.isFinalStop,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IAtStationOptions>,
    disruption: {
      name: 'Delays & disruption',
      component: CustomAnnouncementPane,
      defaultState: {
        disruptionType: 'running late',
        delayDuration: '10',
        delayReason: 'vandalism',
        stationCode: this.StationOptions[0].value,
      },
      props: {
        playHandler: this.playDisruptionAnnouncement.bind(this),
        presets: DISRUPTION_PRESETS,
        options: {
          disruptionType: {
            name: 'Announcement',
            type: 'select',
            default: 'running late',
            options: DISRUPTION_TYPE_OPTIONS,
          },
          delayDuration: {
            name: 'Delay',
            type: 'select',
            default: '10',
            options: DELAY_DURATION_OPTIONS,
            onlyShowWhen: state => state.disruptionType === 'running late',
          },
          stationCode: {
            name: 'Station not being called at',
            type: 'select',
            default: this.StationOptions[0].value,
            options: this.StationOptions,
            onlyShowWhen: state => state.disruptionType === 'not calling at',
          },
          delayReason: {
            name: 'Reason',
            type: 'select',
            default: 'vandalism',
            options: this.ReasonOptions,
            onlyShowWhen: state => state.disruptionType !== 'engineering work',
          },
        },
      },
    } satisfies CustomAnnouncementTab<IDisruptionOptions>,
    announcements: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          Emergency: [
            { label: 'Important safety announcement', files: ['emergency.for your safety and security merseyrail control staff and br'] },
            { label: 'There is a fire on this train', files: ['emergency.there is a fire on this train'] },
            { label: 'Fire evacuation guidance', files: ['messages.do not attempt to leave the train until instructed move down'] },
            { label: 'Use the window hammers', files: ['emergency.please observe the window hammers for use in case it is nece'] },
            {
              label: 'Security staff patrol the Merseyrail system',
              files: ['emergency.security staff patrol the merseyrail systems at all times'],
            },
            { label: 'Security staff patrol trains and stations', files: ['emergency.security staff patrol merseyrail trains and stations'] },
            { label: 'This is a security alert', files: ['emergency.this is a security alert'] },
            { label: 'Please do not panic', files: ['emergency.please do not panic'] },
            { label: 'Emergency at the next station', files: ['emergency.due to an emergency at the next station'] },
            { label: 'If this train stops in an emergency', files: ['emergency.should it be necessary to stop this train in an emergency pl'] },
            { label: 'In the unlikely event of an emergency', files: ['emergency.in the unlikly event of an emergency arising your attention'] },
            { label: 'Emergency PA and visual messages', files: ['emergency.in the event of an emergency a pa announcement and visual me'] },
            { label: 'Passenger alarm activated', files: ['emergency.the activation of an alarm by a passenger'] },
            { label: 'Passenger alarm buttons', files: ['emergency.please observe the passenger alarm buttons above the doors t'] },
            { label: 'Fire extinguishers', files: ['emergency.fire extinguishers are provided in this train for use in an'] },
            {
              label: 'Emergency exits at the front and rear',
              files: ['emergency.there are emergency exits at the front and rear of the train'],
            },
            { label: 'Emergency exits in all carriages', files: ['emergency.there are emergency exits in all carriages and at the front'] },
          ],
          Evacuation: [
            { label: 'Evacuate the train', files: ['emergency.due to an emergency it is necessary to evacuate the train'] },
            { label: 'Evacuate this train', files: ['emergency.due to an emergency it is necessary to evacuate this train n'] },
            {
              label: 'Stopping to evacuate passengers and staff',
              files: ['emergency.we will be stopping to evacuate passengers and staff on the'],
            },
            { label: 'Stopping to evacuate onto the platform', files: ['emergency.we will be stopping to evacuate passengers on the platform'] },
            { label: 'Exit via the front cab', files: ['messages.move towards the front of the train and exit through the dri'] },
            { label: 'Exit via the rear cab', files: ['messages.move towards the rear of the train and exit through the rear'] },
            {
              label: 'Go to the front of the train and wait for staff',
              files: ['messages.please make your way to front of the train and await staff i'],
            },
            {
              label: 'Go to the rear of the train and wait for staff',
              files: ['messages.please make your way to rear of the train and await staff in'],
            },
            {
              label: 'Stay on the train and move away from the doors',
              files: ['messages.do not leave the train move away from the doors to make room'],
            },
            { label: 'Leave your belongings behind', files: ['messages.please leave belongings behind they will be collected and ca'] },
            { label: 'The train has been secured and protected', files: ['messages.the train has been secured and protected'] },
            { label: 'Follow rail staff instructions', files: ['messages.please follow the instructions given to you by rail staff'] },
            { label: 'Always follow staff instructions', files: ['messages.always follow the instructions given to you by our staff or'] },
            { label: 'Assistance is on the way', files: ['messages.assistance has been called for and is on route'] },
            { label: 'Medical training request', files: ['messages.if there is any person onboard with medical training please'] },
          ],
          'Safety & security': [
            { label: 'Passenger safety notice 1', files: ['emergency.in the interest of passenger safety your attention is drawn'] },
            { label: 'Passenger safety notice 2', files: ['emergency.in the interest of passenger safety your attention is drawn (2)'] },
            { label: 'Passenger safety notice 3', files: ['emergency.in the interest of passenger safety your attention is drawn (3)'] },
            { label: 'Passenger safety notice 4', files: ['emergency.in the interest of passenger safety your attention is drawn (4)'] },
            {
              label: 'Your safety and the safety of onboard staff',
              files: ['emergency.in the interest of your safety and the safety of onboard sta'],
            },
            { label: 'CCTV in operation', files: ['emergency.for your safety and security close circuit television is in'] },
            { label: 'Contact British Transport Police', files: ['emergency.if you wish to contact the british transport police neighbou'] },
            { label: 'Be vigilant for suspicious articles', files: ['emergency.please be vigilant for any suspicious articles left unattend'] },
            {
              label: "If you see something that doesn't look right",
              files: ['messages.if you see something that doesnt look right speak to staff o'],
            },
            { label: 'Unattended luggage', files: ['messages.please look after your luggage any unattended luggage may be'] },
            { label: 'Keep baggage with you', files: ['messages.passengers are requested to keep their baggage with them at'] },
            {
              label: 'Smoking and e-cigarettes not permitted',
              files: ['emergency.we remind passengers that smoking including the use of ecigr'],
            },
            {
              label: 'Smoking and e-cigarettes not permitted (alternate)',
              files: ['emergency.we remind passengers that smoking including the use of ecigr (2)'],
            },
            { label: 'Antisocial behaviour is not tolerated', files: ['messages.we do not tolerate anyone who commits acts of antisocial beh'] },
            { label: 'Face coverings', files: ['messages.customers are reminded that they must wear a face covering w'] },
            { label: 'Face coverings (alternate)', files: ['messages.customers are reminded that they must wear a face covering w (2)'] },
          ],
          'Doors & platforms': [
            { label: 'Doors open on the left', files: ['messages.doors open on the left'] },
            { label: 'Doors open on the left hand side', files: ['messages.doors open on the left hand side'] },
            { label: 'Doors open on the right', files: ['messages.doors open on the right'] },
            { label: 'Doors open on the right hand side', files: ['messages.doors open on the right hand side'] },
            { label: 'Please mind the closing doors', files: ['messages.please mind the closing doors'] },
            { label: 'Please stand clear of the doors', files: ['messages.please stand clear of the doors this train is about to depar'] },
            {
              label: 'Do not board when the doors are closing',
              files: ['messages.please do not attempt to board the train when the doors are'],
            },
            {
              label: 'Ready to leave, stand clear of the closing doors',
              files: ['messages.this train is ready to leave please stand clear of the closi'],
            },
            {
              label: 'Ready to leave, stand back from the platform edge',
              files: ['messages.this train is ready to leave please stand back from the plat'],
            },
            { label: 'Rear 4 cars will not open', files: ['messages.the doors in the rear 4 cars will not open at this station'] },
            { label: 'Front and rear doors will not open', files: ['messages.the front and rear passenger doors will not open at this sta'] },
            { label: 'Take care when boarding', files: ['messages.please take care when boarding the train'] },
            { label: 'Take care when stepping from the train', files: ['messages.please take care when stepping from the train'] },
            {
              label: 'Take care when leaving, reduced step height',
              files: ['messages.please take care when leaving the train due to the reduction'],
            },
            { label: 'Step-free access at this station', files: ['messages.stepfree access is available at this station'] },
            { label: 'Lifts at underground stations', files: ['messages.lifts are available at our underground stations if you need'] },
            { label: 'Lift at the next station', files: ['messages.we regret to announce that the lift at the next station is c'] },
            { label: 'Access from the next station', files: ['messages.passengers are advised that access from the next station is'] },
            {
              label: 'This train will not stop at the next station',
              files: ['messages.attention please this train will not stop at the next statio'],
            },
          ],
          'On board': [
            { label: 'Move down inside the cars', files: ['messages.please move down inside the cars and make use of all availab'] },
            { label: 'Move down to make room', files: ['messages.please move down the train to make room for passengers about'] },
            { label: 'Give up your seat if needed', files: ['messages.please give up your seat if a less able person needs it'] },
            { label: 'Tip-up seating for luggage', files: ['messages.please use the tipup seating base found in each coach to sto'] },
            { label: 'Charging points', files: ['messages.charging points are available adjacent to each seat'] },
            { label: 'Keep your feet off the seats', files: ['messages.passengers are reminded that they should keep their feet off'] },
            { label: 'Take your litter with you', files: ['messages.help us keep this train tidy please take your litter with yo'] },
            { label: 'Supervise children', files: ['messages.please ensure children are supervised at all times'] },
            { label: 'Ensure you take your belongings', files: ['messages.please ensure that you take all your personal belongings wit'] },
            { label: 'Make sure you take your belongings', files: ['messages.please make sure that you take all your personal belongings'] },
            { label: 'Request assistance from staff', files: ['messages.if you require assistance please contact one of our staff on'] },
            { label: 'Highest standard of service', files: ['messages.merseyrail aims to offer you the highest standard of service'] },
          ],
          Tickets: [
            { label: 'Have a valid ticket', files: ['messages.please make sure you have a valid ticket for your journey'] },
            { label: 'Have your ticket ready for inspection', files: ['messages.please have your ticket ready for inspection at all times'] },
            { label: 'Have your ticket ready, ask for help', files: ['messages.please have your ticket ready for inspection if you need any'] },
            { label: 'Ticket checks at any time', files: ['messages.staff may perform ticket checks at any time during your jour'] },
            { label: 'Ticket checking programme', files: ['messages.an intensive programme of ticket checking on stations and tr'] },
            { label: 'Revenue inspectors', files: ['messages.revenue inspectors work on our trains be sure you have the c'] },
            { label: 'Penalty fares', files: ['messages.penalty fares are in operation on this network if you are un'] },
          ],
          Delays: [
            { label: 'Please change here', files: ['messages.please change here'] },
            { label: 'Please change here (alternate)', files: ['messages.please change here (2)'] },
            { label: 'Change here, this train is terminating', files: ['delays.please change here this train is terminating'] },
            { label: 'This train terminates here', files: ['delays.this train terminates here'] },
            { label: 'All change please', files: ['messages.all change please'] },
            { label: 'This train will terminate at the next station', files: ['delays.this train will terminate at the next station'] },
            {
              label: "We're sorry, terminating at the next station",
              files: ['delays.were sorry to announce this train will terminate at the next'],
            },
            {
              label: 'Listen for announcements and information',
              files: ['messages.please listen for announcements and updated information to b'],
            },
            { label: 'Listen for further announcements', files: ['messages.please listen for further announcements and updated display'] },
            { label: 'Listen and await updated displays', files: ['messages.please listen to further announcements and await updated dis'] },
            { label: 'Check at stations and online', files: ['messages.check at stations and online for details'] },
            { label: 'Sorry for the delay, may cause', files: ['delays.were sorry for the delay and inconvenience this may cause'] },
            { label: 'Sorry for the delay, will cause', files: ['delays.were sorry for the delay and inconvenience this will cause'] },
            { label: 'Sorry for the delay to the train', files: ['delays.were sorry for the delay to the train and would ask passenge'] },
            { label: 'Sorry for the late running', files: ['delays.were sorry for the late running of this service'] },
            { label: 'Sorry for the late running (alternate)', files: ['delays.were sorry for the late running of this service (2)'] },
          ],
          'Thanks & apologies': [
            { label: 'Thank you', files: ['messages.thank you'] },
            { label: 'Thank you for travelling with Merseyrail', files: ['messages.thank you for travelling with merseyrail'] },
            { label: 'Thank you, we hope you have a …', files: ['messages.thank you for travelling with merseyrail we hoped you have a'] },
            { label: 'Thank you for travelling with us', files: ['messages.thank you for travelling with us'] },
            { label: 'Have a safe evening', files: ['messages.have a safe evening'] },
            { label: 'Merseyrail wish to apologise', files: ['messages.merseyrail wish to apologise for any inconvenience'] },
            { label: 'Sorry for any inconvenience', files: ['messages.were sorry for any inconvenience'] },
            { label: 'Sorry for the inconvenience, may cause', files: ['messages.were sorry for the inconvenience this may cause'] },
            { label: 'Sorry for the inconvenience, will cause', files: ['messages.were sorry for the inconvenience this will cause'] },
          ],
          'Events & attractions': [
            { label: 'Passengers for Chester Zoo', files: ['conjoiners.passengers for chester zoo should leave the train at the nex'] },
            {
              label: 'Passengers for Cheshire Oaks and Blue Planet',
              files: ['conjoiners.passengers for cheshire oaks outlet village and blue planet'],
            },
          ],
        },
      },
    } satisfies CustomButtonTab,
  }
}
