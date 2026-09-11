import CustomAnnouncementPane from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import CallingAtSelector, { CallingAtPoint } from '@components/CallingAtSelector'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import { AnyCustomAnnouncementTab, AudioItem, CustomAnnouncementButton, CustomAnnouncementTab, CustomButtonTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'

type Brand = 'northern rail' | 'northern electrics'

type ServicePhrasing = 'is' | 'will be' | 'delayed'

type ThanksWording = 'today' | 'this morning' | 'this afternoon' | 'this evening' | 'plain'

type PlatformWarning = 'step' | 'gap'

type DoorPosition = 'none' | 'front' | 'middle' | 'back'

type DisruptionType = 'running late' | 'delays may be experienced' | 'apology' | 'waiting for' | 'continuing delay' | 'terminating early'

interface IWelcomeAboardOptions {
  brand: Brand
  announcementType: 'start of journey' | 'en route'
  phrasing: ServicePhrasing
  terminatesAtCode: string
  callingAtCodes: CallingAtPoint[]
  announceArrivalTime: boolean
  arrivalHour: string
  arrivalMinute: string
}

interface IDepartingStationOptions {
  brand: Brand
  terminatesAtCode: string
  nextStationCode: string
  doorPosition: DoorPosition
}

interface IApproachingStationOptions {
  brand: Brand
  stationCode: string
  isFinalStop: boolean
  platformWarning: PlatformWarning
  thanks: ThanksWording
}

interface IAtStationOptions {
  brand: Brand
  stationCode: string
  isFinalStop: boolean
  terminatesAtCode: string
  platformWarning: PlatformWarning
  thanks: ThanksWording
}

interface IDisruptionOptions {
  brand: Brand
  disruptionType: DisruptionType
  minutesLate: string
  reason: string
  apologyWording: 'due to' | 'because of'
  affectedAreaCode: string
  waitingFor: string
  willContinue: boolean
  terminatePhrasing: 'terminate at' | 'end its service at'
  terminatesAtCode: string
  noLongerCallingAt: CallingAtPoint[]
  apologise: boolean
  checkWithStaff: boolean
}

interface IDividingTrainOptions {
  divideAtCode: string
  frontDestinationCode: string
  rearDestinationCode: string
}

interface IConnectionsOptions {
  wording: 'change here' | 'onward connections'
  connectionCodes: CallingAtPoint[]
}

const SENTENCE_GAP = 500

/**
 * Stations flagged as principal in the TrainFX export, where arrival repeats the safety reminders.
 */
const PRINCIPAL_STATIONS = [
  'BDI',
  'CHD',
  'DAR',
  'DON',
  'HUD',
  'LAN',
  'LDS',
  'LIV',
  'LPY',
  'MAN',
  'MCE',
  'MCO',
  'MCV',
  'MHS',
  'MIA',
  'NCL',
  'PRE',
  'SHF',
  'SHJ',
  'SNH',
  'WGN',
  'WGW',
  'WKF',
  'YRK',
]

const BRAND_OPTIONS: { title: string; value: Brand }[] = [
  { title: 'Northern Rail', value: 'northern rail' },
  { title: 'Northern Electrics', value: 'northern electrics' },
]

const THANKS_OPTIONS: { title: string; value: ThanksWording }[] = [
  { title: 'Thank you for travelling with … today', value: 'today' },
  { title: 'On behalf of …, thank you for travelling with us this morning', value: 'this morning' },
  { title: 'On behalf of …, thank you for travelling with us this afternoon', value: 'this afternoon' },
  { title: 'On behalf of …, thank you for travelling with us this evening', value: 'this evening' },
  { title: 'On behalf of …, thank you for travelling with us', value: 'plain' },
]

const PLATFORM_WARNING_OPTIONS: { title: string; value: PlatformWarning }[] = [
  { title: 'Mind the step between the train and the platform', value: 'step' },
  { title: 'Mind the gap between the train and the platform edge', value: 'gap' },
]

const START_OF_JOURNEY_SAFETY: AudioItem[] = [
  { id: 'messages.please take time to read the safety information', opts: { delayStart: SENTENCE_GAP } },
  { id: 'messages.smoking including the use of e-cigarettes is not permitted', opts: { delayStart: SENTENCE_GAP } },
  { id: 'messages.please keep your belongings with you during your journey', opts: { delayStart: SENTENCE_GAP } },
  { id: 'messages.if you see anything suspicious please tell a member of staff', opts: { delayStart: SENTENCE_GAP } },
]

const REASONS = [
  'a broken down train',
  'a delay on a previous journey',
  'a derailed train',
  'a fallen tree on the line',
  'a fire alarm at a station',
  'a fire at a station',
  'a fire at a station earlier',
  'a landslip',
  'a line side fire',
  'a member of train crew being unavailable',
  'a passenger being taken ill',
  'a passenger having been taken ill earlier',
  'a person hit by a train',
  'a person hit by a train earlier',
  'a problem at a level crossing',
  'a problem currently under investigation',
  'a problem near the railway',
  'a problem with a river bridge',
  'a problem with line side equipment',
  'a security alert',
  'a train fault',
  'a train late from the depot',
  'a train late from the depot earlier',
  'a trespass incident',
  'a vehicle striking a railway bridge',
  'an earlier broken down train',
  'an earlier derailed train',
  'an earlier fallen tree',
  'an earlier line side fire',
  'an earlier obstruction on the line',
  'an earlier operating incident',
  'an earlier problem near the railway',
  'an earlier problem with a river bridge',
  'an earlier problem with line side equipment',
  'an earlier security alert',
  'an earlier train fault',
  'an earlier trespass incident',
  'an obstruction on the line',
  'an operating incident',
  'an unusually large passenger flow',
  'an unusually large passenger flow earlier',
  'animals on the line',
  'animals on the line earlier',
  'congestion caused by earlier delays',
  'damage to overhead lines',
  'disruptive passengers',
  'disruptive passengers earlier',
  'earlier emergency engineering works',
  'earlier industrial action',
  'earlier over-running engineering works',
  'earlier overhead wire problems',
  'earlier signalling problems',
  'earlier vandalism',
  'electricity supply problems',
  'emergency engineering works',
  'emergency services dealing with a prior incident',
  'emergency services dealing with an incident',
  'fire alarms sounding earlier at a station',
  'flooding',
  'flooding earlier',
  'fog',
  'fog earlier',
  'high winds',
  'high winds earlier',
  'industrial action',
  'lightning having damaged equipment',
  'over-running engineering works',
  'overhead wire problems',
  'passengers transferring between trains',
  'passengers transferring between trains earlier',
  'poor rail conditions',
  'poor rail conditions earlier',
  'poor weather conditions',
  'poor weather conditions earlier',
  'safety checks being made',
  'safety checks being made earlier',
  'signalling problems',
  'snow',
  'snow earlier',
  'speed restrictions',
  'the need to make additional stops',
  'the train being diverted via an alternative route',
  'train crew having been unavailable earlier',
  'vandalism',
  'waiting for a member of train crew',
  'waiting for a member of train crew earlier',
]

const WAITING_FOR_REASONS = [
  'a platform at the next station',
  'a connecting service',
  'a member of the crew',
  'a signalling problem',
  'a technical fault on the train',
  'a technical fault with line-side equipment',
  'an obstruction on the line',
  'a preceding train breaking down',
  'a person having been struck by a train',
]

const OH_NUMBERS = ['', 'oh one', 'oh two', 'oh three', 'oh four', 'oh five', 'oh six', 'oh seven', 'oh eight', 'oh nine']

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function padTwoDigits(value: number): string {
  return value.toString().padStart(2, '0')
}

export default class NorthernTrainFx extends TrainAnnouncementSystem {
  readonly NAME = 'Northern - TrainFX'
  readonly ID = 'NORTHERN_TRAINFX_V1'
  readonly FILE_PREFIX = 'Northern/TrainFX'
  readonly SYSTEM_TYPE = 'train'
  readonly DESCRIPTION = 'Generate Northern Rail and Northern Electrics TrainFX on-train announcements using real audio recordings.'

  private serviceIntroAudio(brand: Brand, phrasing: ServicePhrasing, delayStart: number = 0): AudioItem[] {
    switch (phrasing) {
      case 'is':
        return [{ id: 'conjoiners.this train is the', opts: { delayStart } }, `brand.${brand}.name`, 'conjoiners.service to']
      case 'will be':
        return [{ id: 'conjoiners.this train will be the', opts: { delayStart } }, `brand.${brand}.name`, 'conjoiners.service to']
      case 'delayed':
        return [{ id: `brand.${brand}.this train is the delayed service to`, opts: { delayStart } }]
    }
  }

  private thanksAudio(brand: Brand, thanks: ThanksWording): AudioItem {
    const phrase = thanks === 'plain' ? 'thank you for travelling with us' : `thank you for travelling with us ${thanks}`

    return { id: `brand.${brand}.${phrase}`, opts: { delayStart: SENTENCE_GAP } }
  }

  private platformWarningAudio(platformWarning: PlatformWarning): AudioItem {
    return { id: `messages.please take care when leaving the train and mind the ${platformWarning}`, opts: { delayStart: SENTENCE_GAP } }
  }

  private timeAudio(hour: string, minute: string): AudioItem[] {
    const hourValue = parseInt(hour)
    const minuteValue = parseInt(minute)

    if (hourValue === 0 && minuteValue === 0) return ['time.midnight']

    const hourClip = hourValue === 0 ? 'time.zero' : hourValue < 10 ? `time.${OH_NUMBERS[hourValue]}` : `time.${hourValue}`
    const minuteClip = minuteValue === 0 ? 'time.hundred hours' : minuteValue < 10 ? `time.${OH_NUMBERS[minuteValue]}` : `time.${minuteValue}`

    return [hourClip, minuteClip]
  }

  private callingPointsAudio(callingAtCodes: CallingAtPoint[], terminatesAtCode: string): AudioItem[] {
    return this.pluraliseAudio([...callingAtCodes.map(stn => `stations.high.${stn.crsCode}`), `stations.low.${terminatesAtCode}`], {
      andId: 'conjoiners.and',
    })
  }

  private validateCallingPoints(callingAtCodes: CallingAtPoint[]): boolean {
    return callingAtCodes.every(stn => this.validateStationExists(stn.crsCode, 'high'))
  }

  private async playWelcomeAboardAnnouncement(options: IWelcomeAboardOptions, download: boolean = false): Promise<void> {
    const { brand, announcementType, phrasing, terminatesAtCode, callingAtCodes, announceArrivalTime, arrivalHour, arrivalMinute } = options

    if (
      !this.validateStationExists(terminatesAtCode, 'high') ||
      !this.validateStationExists(terminatesAtCode, 'low') ||
      !this.validateCallingPoints(callingAtCodes)
    ) {
      return
    }

    const isStartOfJourney = announcementType === 'start of journey'
    const files: AudioItem[] = []

    if (isStartOfJourney) {
      files.push('conjoiners.welcome aboard')
    }

    files.push(
      ...this.serviceIntroAudio(brand, phrasing),
      `stations.high.${terminatesAtCode}`,
      'conjoiners.calling at',
      ...this.callingPointsAudio(callingAtCodes, terminatesAtCode),
    )

    if (announceArrivalTime) {
      files.push(
        { id: 'conjoiners.we are due to arrive at', opts: { delayStart: SENTENCE_GAP } },
        `stations.high.${terminatesAtCode}`,
        'conjoiners.where our arrival time will be',
        ...this.timeAudio(arrivalHour, arrivalMinute),
      )
    }

    if (isStartOfJourney) {
      files.push(...START_OF_JOURNEY_SAFETY)
    }

    await this.playAudioFiles(files, download)
  }

  private async playDepartingStationAnnouncement(options: IDepartingStationOptions, download: boolean = false): Promise<void> {
    const { brand, terminatesAtCode, nextStationCode, doorPosition } = options

    if (!this.validateStationExists(terminatesAtCode, 'low') || !this.validateStationExists(nextStationCode, 'low')) {
      return
    }

    const files: AudioItem[] = [
      ...this.serviceIntroAudio(brand, 'is'),
      `stations.low.${terminatesAtCode}`,
      { id: 'conjoiners.the next station stop is', opts: { delayStart: SENTENCE_GAP } },
      `stations.low.${nextStationCode}`,
    ]

    if (doorPosition !== 'none') {
      files.push(
        { id: `messages.if you are getting off at the next station use the doors at the ${doorPosition}`, opts: { delayStart: SENTENCE_GAP } },
        'conjoiners.because our train is longer than the platform',
      )
    }

    await this.playAudioFiles(files, download)
  }

  private async playApproachingStationAnnouncement(options: IApproachingStationOptions, download: boolean = false): Promise<void> {
    const { brand, stationCode, isFinalStop, platformWarning, thanks } = options

    if (!this.validateStationExists(stationCode, 'high') || !this.validateStationExists(stationCode, 'low')) {
      return
    }

    const files: AudioItem[] = []

    if (isFinalStop) {
      files.push(
        'conjoiners.we are now approaching',
        `stations.high.${stationCode}`,
        'conjoiners.where this train terminates',
        { id: 'messages.please take all your personal belongings any luggage left may be destroyed', opts: { delayStart: SENTENCE_GAP } },
        { id: 'messages.if you see anything suspicious please tell a member of staff', opts: { delayStart: SENTENCE_GAP } },
        this.platformWarningAudio(platformWarning),
        this.thanksAudio(brand, thanks),
      )
    } else {
      files.push(
        'conjoiners.this service is now approaching',
        `stations.low.${stationCode}`,
        { id: 'conjoiners.if you are leaving the train here at', opts: { delayStart: SENTENCE_GAP } },
        `stations.high.${stationCode}`,
        'messages.please take all your personal belongings and hand luggage with you',
        this.platformWarningAudio(platformWarning),
      )
    }

    await this.playAudioFiles(files, download)
  }

  private async playAtStationAnnouncement(options: IAtStationOptions, download: boolean = false): Promise<void> {
    const { brand, stationCode, isFinalStop, terminatesAtCode, platformWarning, thanks } = options

    if (!this.validateStationExists(stationCode, 'high') || !this.validateStationExists(stationCode, 'low')) {
      return
    }

    const files: AudioItem[] = ['conjoiners.this is']

    if (isFinalStop) {
      files.push(
        `stations.high.${stationCode}`,
        'conjoiners.where this train terminates',
        this.platformWarningAudio(platformWarning),
        this.thanksAudio(brand, thanks),
      )
    } else {
      if (!this.validateStationExists(terminatesAtCode, 'low')) return

      files.push(`stations.low.${stationCode}`)

      if (PRINCIPAL_STATIONS.includes(stationCode)) {
        files.push(
          { id: 'conjoiners.if you are leaving the train here at', opts: { delayStart: SENTENCE_GAP } },
          `stations.high.${stationCode}`,
          'messages.please take all your personal belongings any luggage left may be destroyed',
          { id: 'messages.if you see anything suspicious please tell a member of staff', opts: { delayStart: SENTENCE_GAP } },
        )
      }

      files.push(...this.serviceIntroAudio(brand, 'is', SENTENCE_GAP), `stations.low.${terminatesAtCode}`)
    }

    await this.playAudioFiles(files, download)
  }

  private reasonAudio(reason: string): AudioItem[] {
    if (!reason) return []

    return [{ id: 'conjoiners.this is due to', opts: { delayStart: SENTENCE_GAP } }, `reasons.${reason}`]
  }

  private async playDisruptionAnnouncement(options: IDisruptionOptions, download: boolean = false): Promise<void> {
    const {
      brand,
      disruptionType,
      minutesLate,
      reason,
      apologyWording,
      affectedAreaCode,
      waitingFor,
      willContinue,
      terminatePhrasing,
      terminatesAtCode,
      noLongerCallingAt,
      apologise,
      checkWithStaff,
    } = options

    const files: AudioItem[] = []

    switch (disruptionType) {
      case 'running late':
        files.push(
          'conjoiners.we apologise but this service is now running approximately',
          `numbers.${minutesLate}`,
          minutesLate === '1' ? 'conjoiners.minute late' : 'conjoiners.minutes late',
          ...this.reasonAudio(reason),
        )
        break

      case 'delays may be experienced': {
        if (!reason) {
          alert('Please choose a reason for the delays.')
          return
        }

        files.push('conjoiners.we apologise but', 'conjoiners.due to', `reasons.${reason}`)

        if (affectedAreaCode) {
          if (!this.validateStationExists(affectedAreaCode, 'high')) return

          files.push('conjoiners.in the', `stations.high.${affectedAreaCode}`, 'conjoiners.area')
        }

        files.push('conjoiners.delays may be experienced')
        break
      }

      case 'apology':
        if (!reason) {
          alert('Please choose a reason for the apology.')
          return
        }

        files.push(`conjoiners.we apologise but ${apologyWording}`, `reasons.${reason}`)
        break

      case 'waiting for':
        files.push('conjoiners.we are waiting for', `reasons.legacy.${waitingFor}`)
        break

      case 'continuing delay':
        if (!reason) {
          alert('Please choose a reason for the continuing delay.')
          return
        }

        files.push('conjoiners.we apologise for the continuing delay but due to', `reasons.${reason}`)
        break

      case 'terminating early': {
        if (!this.validateStationExists(terminatesAtCode, 'low')) return

        files.push(
          terminatePhrasing === 'terminate at'
            ? 'conjoiners.this service will now terminate at'
            : 'conjoiners.this train will now end its service at',
          `stations.low.${terminatesAtCode}`,
        )

        if (noLongerCallingAt.length > 0) {
          if (!this.validateCallingPoints(noLongerCallingAt)) return

          const [lastStop, ...otherStops] = [...noLongerCallingAt].reverse()

          if (!this.validateStationExists(lastStop.crsCode, 'low')) return

          files.push('conjoiners.and', 'conjoiners.will no longer call at', ...this.callingPointsAudio(otherStops.reverse(), lastStop.crsCode))
        }

        files.push(...this.reasonAudio(reason))
        break
      }
    }

    if (willContinue && (disruptionType === 'waiting for' || disruptionType === 'continuing delay')) {
      files.push({ id: 'messages.this service will continue as soon as possible', opts: { delayStart: SENTENCE_GAP } })
    }

    if (checkWithStaff && disruptionType === 'terminating early') {
      files.push({ id: 'messages.please check with station staff for alternative services', opts: { delayStart: SENTENCE_GAP } })
    }

    if (apologise) {
      files.push({ id: `brand.${brand}.apologises for the inconvenience`, opts: { delayStart: SENTENCE_GAP } })
    }

    await this.playAudioFiles(files, download)
  }

  private async playDividingTrainAnnouncement(options: IDividingTrainOptions, download: boolean = false): Promise<void> {
    const { divideAtCode, frontDestinationCode, rearDestinationCode } = options

    if (
      !this.validateStationExists(divideAtCode, 'low') ||
      !this.validateStationExists(frontDestinationCode, 'high') ||
      !this.validateStationExists(rearDestinationCode, 'high')
    ) {
      return
    }

    await this.playAudioFiles(
      [
        'conjoiners.this train will divide at',
        `stations.low.${divideAtCode}`,
        { id: 'conjoiners.if you are travelling to', opts: { delayStart: SENTENCE_GAP } },
        `stations.high.${frontDestinationCode}`,
        'conjoiners.please sit in the front coaches',
        { id: 'conjoiners.if you are travelling to', opts: { delayStart: SENTENCE_GAP } },
        `stations.high.${rearDestinationCode}`,
        'conjoiners.please sit in the rear coaches',
      ],
      download,
    )
  }

  private async playConnectionsAnnouncement(options: IConnectionsOptions, download: boolean = false): Promise<void> {
    const { wording, connectionCodes } = options

    if (connectionCodes.length === 0) {
      alert('Please add at least one connecting destination.')
      return
    }

    if (!this.validateCallingPoints(connectionCodes)) return

    const [lastStop, ...otherStops] = [...connectionCodes].reverse()

    if (!this.validateStationExists(lastStop.crsCode, 'low')) return

    await this.playAudioFiles(
      [
        wording === 'change here' ? 'conjoiners.change here for connecting services to' : 'conjoiners.onward connections are available for',
        ...this.callingPointsAudio(otherStops.reverse(), lastStop.crsCode),
      ],
      download,
    )
  }

  private evacuationButton(position: 'front' | 'middle' | 'back'): CustomAnnouncementButton {
    return {
      label: `Evacuate via ${position} of train`,
      files: [
        'emergency.your attention please this is an important safety announcement',
        { id: 'conjoiners.it has now become necessary for us to evacuate the train', opts: { delayStart: SENTENCE_GAP } },
        { id: `emergency.move towards the ${position} of the train`, opts: { delayStart: SENTENCE_GAP } },
      ],
    }
  }

  readonly AllAvailableStationNames: string[] = [
    'ABY',
    'ACK',
    'ACR',
    'ADC',
    'ADK',
    'ADL',
    'AFV',
    'AHN',
    'ALD',
    'ALF',
    'ALM',
    'ALP',
    'ALT',
    'ALW',
    'ANN',
    'APB',
    'APP',
    'APY',
    'ARN',
    'ARR',
    'ASK',
    'ASP',
    'ASY',
    'ATN',
    'AWK',
    'AWT',
    'BAM',
    'BAR',
    'BAU',
    'BAV',
    'BBN',
    'BBW',
    'BCB',
    'BCJ',
    'BDB',
    'BDI',
    'BDQ',
    'BDT',
    'BDY',
    'BEM',
    'BEN',
    'BES',
    'BEV',
    'BEY',
    'BGE',
    'BGG',
    'BGH',
    'BHM',
    'BHS',
    'BIA',
    'BIF',
    'BIL',
    'BIY',
    'BLD',
    'BLE',
    'BLK',
    'BLL',
    'BLO',
    'BLV',
    'BMB',
    'BMC',
    'BMF',
    'BML',
    'BMP',
    'BNA',
    'BNC',
    'BNT',
    'BNY',
    'BOC',
    'BON',
    'BPB',
    'BPN',
    'BPS',
    'BRF',
    'BSV',
    'BTB',
    'BTD',
    'BTL',
    'BTT',
    'BUB',
    'BUH',
    'BUW',
    'BUX',
    'BUY',
    'BWD',
    'BYK',
    'BYM',
    'BYN',
    'BYS',
    'CAK',
    'CAR',
    'CAS',
    'CEF',
    'CEL',
    'CEY',
    'CFD',
    'CFL',
    'CGM',
    'CHD',
    'CHF',
    'CHT',
    'CHU',
    'CKL',
    'CLE',
    'CLH',
    'CLI',
    'CLN',
    'CLS',
    'CLY',
    'CNE',
    'CNF',
    'CNG',
    'CNS',
    'COM',
    'COT',
    'CPY',
    'CRB',
    'CRE',
    'CRG',
    'CRL',
    'CRM',
    'CSM',
    'CSO',
    'CSR',
    'CTL',
    'CTR',
    'CTW',
    'CUD',
    'CWE',
    'CYT',
    'DAN',
    'DAR',
    'DBD',
    'DBY',
    'DEW',
    'DGT',
    'DHM',
    'DHN',
    'DLM',
    'DLS',
    'DLT',
    'DMF',
    'DND',
    'DNT',
    'DNY',
    'DOD',
    'DON',
    'DOR',
    'DOT',
    'DRF',
    'DRI',
    'DRO',
    'DRT',
    'DSL',
    'DSY',
    'DTG',
    'DTN',
    'DVH',
    'DVN',
    'DWN',
    'EAG',
    'EBA',
    'ECC',
    'ECL',
    'EDB',
    'EDG',
    'EDL',
    'EDY',
    'EGF',
    'EGN',
    'EGT',
    'ELP',
    'ELR',
    'ENT',
    'ERL',
    'EUS',
    'FEA',
    'FIL',
    'FLF',
    'FLI',
    'FLM',
    'FNV',
    'FNW',
    'FOX',
    'FRD',
    'FRF',
    'FRY',
    'FZH',
    'FZW',
    'GBD',
    'GBK',
    'GBL',
    'GCT',
    'GDL',
    'GEA',
    'GGV',
    'GIG',
    'GLC',
    'GLH',
    'GLO',
    'GLS',
    'GLZ',
    'GMB',
    'GMD',
    'GMT',
    'GNB',
    'GNF',
    'GNR',
    'GOE',
    'GOO',
    'GOS',
    'GOX',
    'GRF',
    'GRN',
    'GSD',
    'GST',
    'GSW',
    'GSY',
    'GTA',
    'GTO',
    'GTR',
    'GTY',
    'GUI',
    'GYP',
    'HAB',
    'HAL',
    'HAZ',
    'HBD',
    'HBP',
    'HCH',
    'HCT',
    'HDB',
    'HDF',
    'HDG',
    'HDY',
    'HED',
    'HEI',
    'HEL',
    'HES',
    'HEW',
    'HEX',
    'HFS',
    'HFX',
    'HGF',
    'HGN',
    'HGT',
    'HHB',
    'HID',
    'HIN',
    'HIR',
    'HLD',
    'HLI',
    'HMM',
    'HNX',
    'HOP',
    'HOW',
    'HOY',
    'HPL',
    'HPN',
    'HRE',
    'HRR',
    'HRS',
    'HSB',
    'HSC',
    'HSG',
    'HTC',
    'HTH',
    'HTY',
    'HUB',
    'HUD',
    'HUL',
    'HUP',
    'HUT',
    'HUY',
    'HWH',
    'HWI',
    'HYC',
    'HYT',
    'ILK',
    'ILN',
    'INC',
    'INE',
    'IRL',
    'JCH',
    'KBF',
    'KBK',
    'KDG',
    'KEI',
    'KIR',
    'KIV',
    'KKM',
    'KKS',
    'KLD',
    'KLF',
    'KNA',
    'KNF',
    'KNO',
    'KSL',
    'KSW',
    'KTL',
    'KVP',
    'LAN',
    'LAY',
    'LCK',
    'LCN',
    'LDS',
    'LEG',
    'LEY',
    'LGK',
    'LGM',
    'LGW',
    'LHM',
    'LHO',
    'LIV',
    'LMR',
    'LOH',
    'LOT',
    'LPR',
    'LPT',
    'LPY',
    'LTG',
    'LTL',
    'LTM',
    'LVM',
    'LZB',
    'MAC',
    'MAN',
    'MAS',
    'MAU',
    'MBR',
    'MCE',
    'MCM',
    'MCO',
    'MCV',
    'MDL',
    'MEC',
    'MEX',
    'MHS',
    'MIA',
    'MIH',
    'MIK',
    'MIR',
    'MLD',
    'MLH',
    'MLM',
    'MLY',
    'MNN',
    'MOB',
    'MOS',
    'MPL',
    'MPT',
    'MRP',
    'MRY',
    'MSD',
    'MSH',
    'MSK',
    'MSL',
    'MSN',
    'MSO',
    'MSS',
    'MTO',
    'MUF',
    'MYT',
    'NAY',
    'NCE',
    'NCL',
    'NEL',
    'NFN',
    'NHL',
    'NLN',
    'NLW',
    'NMC',
    'NMN',
    'NNT',
    'NOR',
    'NOT',
    'NPD',
    'NRD',
    'NRT',
    'NRW',
    'NVR',
    'NWI',
    'NWN',
    'OMS',
    'ORR',
    'OUT',
    'PAT',
    'PBL',
    'PDG',
    'PEG',
    'PEM',
    'PFM',
    'PFR',
    'PFY',
    'PLM',
    'PLS',
    'PNL',
    'PNS',
    'POP',
    'POT',
    'PRB',
    'PRE',
    'PRN',
    'PRU',
    'PSC',
    'PYT',
    'RAV',
    'RCC',
    'RCD',
    'RCE',
    'RDM',
    'RDN',
    'RDS',
    'RET',
    'RGW',
    'RHD',
    'RIS',
    'RMC',
    'RML',
    'RNF',
    'RNH',
    'ROB',
    'ROO',
    'RRB',
    'RSG',
    'RSH',
    'RUE',
    'RUF',
    'RUS',
    'RVN',
    'RWC',
    'SAE',
    'SAM',
    'SAS',
    'SBE',
    'SBK',
    'SBS',
    'SBY',
    'SCA',
    'SCU',
    'SDB',
    'SEA',
    'SEC',
    'SEL',
    'SEM',
    'SES',
    'SET',
    'SFD',
    'SHC',
    'SHD',
    'SHF',
    'SHJ',
    'SHY',
    'SIC',
    'SIE',
    'SKI',
    'SKS',
    'SLB',
    'SLD',
    'SLH',
    'SLK',
    'SLL',
    'SLW',
    'SMB',
    'SNA',
    'SNH',
    'SNI',
    'SNK',
    'SNN',
    'SNT',
    'SOM',
    'SON',
    'SOP',
    'SOT',
    'SOU',
    'SOW',
    'SPT',
    'SPY',
    'SQU',
    'SRN',
    'SRO',
    'SSC',
    'SSM',
    'STK',
    'SUN',
    'SVR',
    'SWN',
    'SWT',
    'SXY',
    'SYA',
    'SYB',
    'TBY',
    'TEA',
    'THC',
    'THH',
    'TNA',
    'TNN',
    'TNS',
    'TOD',
    'TRA',
    'ULC',
    'ULL',
    'ULV',
    'UPL',
    'URM',
    'WAC',
    'WAV',
    'WBD',
    'WBQ',
    'WBR',
    'WDD',
    'WDH',
    'WDN',
    'WDS',
    'WET',
    'WGN',
    'WGT',
    'WGW',
    'WHE',
    'WHG',
    'WHN',
    'WID',
    'WKD',
    'WKF',
    'WKG',
    'WKK',
    'WLY',
    'WML',
    'WNN',
    'WOM',
    'WRK',
    'WRL',
    'WRS',
    'WSA',
    'WSR',
    'WTB',
    'WTH',
    'WVH',
    'WYM',
    'YRK',
  ]

  readonly AvailableStationNames = {
    low: this.AllAvailableStationNames,
    high: this.AllAvailableStationNames,
  }

  readonly StationOptions: { title: string; value: string }[] = this.AllAvailableStationNames.map(crsToStationItemMapper)
    .map(item => ({ value: item.crsCode, title: item.name }))
    .sort((a, b) => a.title.localeCompare(b.title))

  readonly OptionalStationOptions: { title: string; value: string }[] = [{ title: 'None', value: '' }, ...this.StationOptions]

  readonly ReasonOptions: { title: string; value: string }[] = [
    { title: 'None', value: '' },
    ...REASONS.map(reason => ({ title: capitalise(reason), value: reason })),
  ]

  readonly WaitingForOptions: { title: string; value: string }[] = WAITING_FOR_REASONS.map(reason => ({
    title: capitalise(reason),
    value: reason,
  }))

  readonly MinutesLateOptions: { title: string; value: string }[] = Array.from({ length: 60 }, (_, i) => ({
    title: `${i + 1}`,
    value: `${i + 1}`,
  }))

  readonly HourOptions: { title: string; value: string }[] = Array.from({ length: 24 }, (_, i) => ({
    title: padTwoDigits(i),
    value: `${i}`,
  }))

  readonly MinuteOptions: { title: string; value: string }[] = Array.from({ length: 60 }, (_, i) => ({
    title: padTwoDigits(i),
    value: `${i}`,
  }))

  readonly customAnnouncementTabs: Record<string, AnyCustomAnnouncementTab> = {
    welcomeAboard: {
      name: 'Welcome aboard',
      component: CustomAnnouncementPane,
      defaultState: {
        brand: 'northern rail',
        announcementType: 'start of journey',
        phrasing: 'is',
        terminatesAtCode: 'LIV',
        callingAtCodes: [],
        announceArrivalTime: false,
        arrivalHour: '12',
        arrivalMinute: '0',
      },
      props: {
        playHandler: this.playWelcomeAboardAnnouncement.bind(this),
        options: {
          brand: {
            name: 'Operator branding',
            type: 'select',
            default: 'northern rail',
            options: BRAND_OPTIONS,
          },
          announcementType: {
            name: 'Announcement type',
            type: 'select',
            default: 'start of journey',
            options: [
              { title: 'Start of journey (with safety information)', value: 'start of journey' },
              { title: 'En route', value: 'en route' },
            ],
          },
          phrasing: {
            name: 'Service wording',
            type: 'select',
            default: 'is',
            options: [
              { title: 'This train is the … service to', value: 'is' },
              { title: 'This train will be the … service to', value: 'will be' },
              { title: 'This train is the delayed … service to', value: 'delayed' },
            ],
          },
          terminatesAtCode: {
            name: 'Terminates at',
            type: 'select',
            default: 'LIV',
            options: this.StationOptions,
          },
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.AllAvailableStationNames,
            },
            default: [],
          },
          announceArrivalTime: {
            name: 'Announce arrival time at destination',
            type: 'boolean',
            default: false,
          },
          arrivalHour: {
            name: 'Arrival hour',
            type: 'select',
            default: '12',
            options: this.HourOptions,
            onlyShowWhen: state => state.announceArrivalTime,
          },
          arrivalMinute: {
            name: 'Arrival minute',
            type: 'select',
            default: '0',
            options: this.MinuteOptions,
            onlyShowWhen: state => state.announceArrivalTime,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IWelcomeAboardOptions>,
    departingStation: {
      name: 'Departing station',
      component: CustomAnnouncementPane,
      defaultState: {
        brand: 'northern rail',
        terminatesAtCode: 'LIV',
        nextStationCode: 'MAN',
        doorPosition: 'none',
      },
      props: {
        playHandler: this.playDepartingStationAnnouncement.bind(this),
        options: {
          brand: {
            name: 'Operator branding',
            type: 'select',
            default: 'northern rail',
            options: BRAND_OPTIONS,
          },
          terminatesAtCode: {
            name: 'Terminates at',
            type: 'select',
            default: 'LIV',
            options: this.StationOptions,
          },
          nextStationCode: {
            name: 'Next station',
            type: 'select',
            default: 'MAN',
            options: this.StationOptions,
          },
          doorPosition: {
            name: 'Short platform at next station',
            type: 'select',
            default: 'none',
            options: [
              { title: 'No short platform', value: 'none' },
              { title: 'Use the doors at the front', value: 'front' },
              { title: 'Use the doors at the middle', value: 'middle' },
              { title: 'Use the doors at the back', value: 'back' },
            ],
          },
        },
      },
    } satisfies CustomAnnouncementTab<IDepartingStationOptions>,
    approachingStation: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      defaultState: {
        brand: 'northern rail',
        stationCode: 'MAN',
        isFinalStop: false,
        platformWarning: 'step',
        thanks: 'today',
      },
      props: {
        playHandler: this.playApproachingStationAnnouncement.bind(this),
        options: {
          stationCode: {
            name: 'Station',
            type: 'select',
            default: 'MAN',
            options: this.StationOptions,
          },
          isFinalStop: {
            name: 'Final stop for this service',
            type: 'boolean',
            default: false,
          },
          platformWarning: {
            name: 'Platform warning',
            type: 'select',
            default: 'step',
            options: PLATFORM_WARNING_OPTIONS,
          },
          brand: {
            name: 'Operator branding',
            type: 'select',
            default: 'northern rail',
            options: BRAND_OPTIONS,
            onlyShowWhen: state => state.isFinalStop,
          },
          thanks: {
            name: 'Thank you wording',
            type: 'select',
            default: 'today',
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
        brand: 'northern rail',
        stationCode: 'MAN',
        isFinalStop: false,
        terminatesAtCode: 'LIV',
        platformWarning: 'step',
        thanks: 'today',
      },
      props: {
        playHandler: this.playAtStationAnnouncement.bind(this),
        options: {
          brand: {
            name: 'Operator branding',
            type: 'select',
            default: 'northern rail',
            options: BRAND_OPTIONS,
          },
          stationCode: {
            name: 'This station',
            type: 'select',
            default: 'MAN',
            options: this.StationOptions,
          },
          isFinalStop: {
            name: 'Final stop for this service',
            type: 'boolean',
            default: false,
          },
          terminatesAtCode: {
            name: 'Terminates at',
            type: 'select',
            default: 'LIV',
            options: this.StationOptions,
            onlyShowWhen: state => !state.isFinalStop,
          },
          platformWarning: {
            name: 'Platform warning',
            type: 'select',
            default: 'step',
            options: PLATFORM_WARNING_OPTIONS,
            onlyShowWhen: state => state.isFinalStop,
          },
          thanks: {
            name: 'Thank you wording',
            type: 'select',
            default: 'today',
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
        brand: 'northern rail',
        disruptionType: 'running late',
        minutesLate: '5',
        reason: 'signalling problems',
        apologyWording: 'due to',
        affectedAreaCode: '',
        waitingFor: 'a platform at the next station',
        willContinue: true,
        terminatePhrasing: 'terminate at',
        terminatesAtCode: 'MAN',
        noLongerCallingAt: [],
        apologise: true,
        checkWithStaff: true,
      },
      props: {
        playHandler: this.playDisruptionAnnouncement.bind(this),
        options: {
          brand: {
            name: 'Operator branding',
            type: 'select',
            default: 'northern rail',
            options: BRAND_OPTIONS,
          },
          disruptionType: {
            name: 'Announcement',
            type: 'select',
            default: 'running late',
            options: [
              { title: 'Service is running approximately N minutes late', value: 'running late' },
              { title: 'Delays may be experienced', value: 'delays may be experienced' },
              { title: 'Apology with reason', value: 'apology' },
              { title: 'We are waiting for…', value: 'waiting for' },
              { title: 'Continuing delay', value: 'continuing delay' },
              { title: 'Service will now terminate early', value: 'terminating early' },
            ],
          },
          minutesLate: {
            name: 'Minutes late',
            type: 'select',
            default: '5',
            options: this.MinutesLateOptions,
            onlyShowWhen: state => state.disruptionType === 'running late',
          },
          apologyWording: {
            name: 'Wording',
            type: 'select',
            default: 'due to',
            options: [
              { title: 'We apologise but due to…', value: 'due to' },
              { title: 'We apologise but because of…', value: 'because of' },
            ],
            onlyShowWhen: state => state.disruptionType === 'apology',
          },
          waitingFor: {
            name: 'Waiting for',
            type: 'select',
            default: 'a platform at the next station',
            options: this.WaitingForOptions,
            onlyShowWhen: state => state.disruptionType === 'waiting for',
          },
          terminatePhrasing: {
            name: 'Wording',
            type: 'select',
            default: 'terminate at',
            options: [
              { title: 'This service will now terminate at…', value: 'terminate at' },
              { title: 'This train will now end its service at…', value: 'end its service at' },
            ],
            onlyShowWhen: state => state.disruptionType === 'terminating early',
          },
          terminatesAtCode: {
            name: 'Now terminates at',
            type: 'select',
            default: 'MAN',
            options: this.StationOptions,
            onlyShowWhen: state => state.disruptionType === 'terminating early',
          },
          noLongerCallingAt: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.AllAvailableStationNames,
              selectLabel: 'Cancelled calling points',
              placeholder: 'Add a cancelled calling point…',
              heading: 'Will no longer call at…',
            },
            default: [],
            onlyShowWhen: state => state.disruptionType === 'terminating early',
          },
          reason: {
            name: 'Reason',
            type: 'select',
            default: 'signalling problems',
            options: this.ReasonOptions,
            onlyShowWhen: state => state.disruptionType !== 'waiting for',
          },
          affectedAreaCode: {
            name: 'Affected area',
            type: 'select',
            default: '',
            options: this.OptionalStationOptions,
            onlyShowWhen: state => state.disruptionType === 'delays may be experienced',
          },
          willContinue: {
            name: 'Service will continue as soon as possible',
            type: 'boolean',
            default: true,
            onlyShowWhen: state => state.disruptionType === 'waiting for' || state.disruptionType === 'continuing delay',
          },
          checkWithStaff: {
            name: 'Check with station staff for alternative services',
            type: 'boolean',
            default: true,
            onlyShowWhen: state => state.disruptionType === 'terminating early',
          },
          apologise: {
            name: 'Apologise for the inconvenience',
            type: 'boolean',
            default: true,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IDisruptionOptions>,
    dividingTrain: {
      name: 'Dividing train',
      component: CustomAnnouncementPane,
      defaultState: {
        divideAtCode: 'MAN',
        frontDestinationCode: 'MIA',
        rearDestinationCode: 'LIV',
      },
      props: {
        playHandler: this.playDividingTrainAnnouncement.bind(this),
        options: {
          divideAtCode: {
            name: 'Divides at',
            type: 'select',
            default: 'MAN',
            options: this.StationOptions,
          },
          frontDestinationCode: {
            name: 'Front coaches for',
            type: 'select',
            default: 'MIA',
            options: this.StationOptions,
          },
          rearDestinationCode: {
            name: 'Rear coaches for',
            type: 'select',
            default: 'LIV',
            options: this.StationOptions,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IDividingTrainOptions>,
    connections: {
      name: 'Connections',
      component: CustomAnnouncementPane,
      defaultState: {
        wording: 'change here',
        connectionCodes: [],
      },
      props: {
        playHandler: this.playConnectionsAnnouncement.bind(this),
        options: {
          wording: {
            name: 'Wording',
            type: 'select',
            default: 'change here',
            options: [
              { title: 'Change here for connecting services to…', value: 'change here' },
              { title: 'Onward connections are available for…', value: 'onward connections' },
            ],
          },
          connectionCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.AllAvailableStationNames,
              selectLabel: 'Connecting destinations',
              placeholder: 'Add a connecting destination…',
              heading: 'Connections to…',
            },
            default: [],
          },
        },
      },
    } satisfies CustomAnnouncementTab<IConnectionsOptions>,
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          'Safety & security': [
            { label: 'Read the safety information', files: ['messages.please take time to read the safety information'] },
            { label: 'Smoking is not permitted', files: ['messages.smoking is not permitted on board any part of this train'] },
            { label: 'Smoking and e-cigarettes not permitted', files: ['messages.smoking including the use of e-cigarettes is not permitted'] },
            { label: 'Keep your belongings with you', files: ['messages.please keep your belongings with you during your journey'] },
            { label: 'Report anything suspicious', files: ['messages.if you see anything suspicious please tell a member of staff'] },
            { label: 'CCTV in operation', files: ['messages.this train is fitted with cctv'] },
            {
              label: 'Take all belongings (luggage may be destroyed)',
              files: ['messages.please take all your personal belongings any luggage left may be destroyed'],
            },
            {
              label: 'Take all belongings and hand luggage',
              files: ['messages.please take all your personal belongings and hand luggage with you'],
            },
            { label: 'Mind the step', files: ['messages.please take care when leaving the train and mind the step'] },
            { label: 'Mind the gap', files: ['messages.please take care when leaving the train and mind the gap'] },
            { label: 'Travelling with young children', files: ['messages.if you are travelling with young children'] },
            { label: 'Follow staff instructions', files: ['messages.please follow any instructions you are given by staff'] },
            { label: 'Foot crossing: red light showing', files: ['messages.do not use the foot crossing when the red light is showing'] },
            {
              label: 'Foot crossing: cross only at green',
              files: ['messages.only cross the line at the crossing when the lights are at green'],
            },
            { label: 'Do not cross the railway line', files: ['messages.do not cross the railway line'] },
          ],
          'Tickets & station': [
            { label: 'Tickets and passes ready for inspection', files: ['messages.please have your tickets and passes ready for inspection'] },
            { label: 'Keep tickets handy for the gates', files: ['messages.please keep your tickets handy for the gates'] },
            { label: 'Tickets retained by automated gates', files: ['messages.tickets will be retained by the automated gates'] },
            { label: 'Taxis and buses signage', files: ['messages.for taxis and buses please follow signage'] },
            { label: 'Check the platform monitor', files: ['messages.check the platform monitor or ask a member of the station team'] },
            { label: 'Enjoy the rest of your journey', files: ['messages.enjoy the rest of your journey'] },
          ],
          'On board': [
            {
              label: 'Bags in luggage compartments or racks',
              files: ['messages.please make sure that all bags are placed safely in the luggage compartments'],
            },
            {
              label: 'Busy service: bags off seats',
              files: ['messages.we have got a busy service today so please make sure your bags are not taking up a seat'],
            },
            { label: 'Move down the carriage', files: ['messages.lots of people trying to get on please move down the carriage'] },
            { label: 'Fold pushchairs and buggies', files: ['messages.please fold pushchairs and buggies'] },
            { label: 'Switch devices to silent', files: ['messages.please switch electronic devices to silent'] },
            { label: 'Toilets out of use', files: ['messages.the toilets on this train are out of use'] },
            { label: 'Temperature system not working', files: ['messages.the temperature system is not working correctly today'] },
            { label: 'No reported problems on the route', files: ['messages.there are no reported problems on the route today'] },
            {
              label: 'Doors closing while coupling',
              files: ['messages.the train doors will close temporarily while we couple to another train'],
            },
          ],
          Delays: [
            { label: 'We will be moving as soon as we can', files: ['messages.we will be moving as soon as we can'] },
            { label: 'Service will continue as soon as possible', files: ['messages.this service will continue as soon as possible'] },
            { label: 'Apologise for the delay to this service', files: ['messages.we apologise for the delay to this service'] },
            { label: 'Apologise for the delay to your journey', files: ['messages.we apologise for the delay to your journey'] },
            { label: 'Apologise for the continued delay', files: ['messages.we apologise for the continued delay to this service'] },
            { label: 'Apologise for the diversion', files: ['messages.we apologise for the diversion to your journey'] },
            { label: 'Thank you for your patience', files: ['messages.thank you for your patience'] },
            { label: 'Be patient and read the safety notices', files: ['messages.please be patient and read the safety notices'] },
            { label: 'Train will now end its service here', files: ['messages.we apologise but this train will now end its service here'] },
            { label: 'Check with station staff', files: ['messages.please check with station staff for alternative services'] },
            { label: 'See the display screens', files: ['messages.please see the display screens for further information'] },
          ],
          Crew: [
            { label: 'Conductor contact the Driver', files: ['messages.will the conductor please contact the driver'] },
            { label: 'Cab to cab', files: ['fx.cab to cab'] },
            { label: 'Call for aid', files: ['fx.call for aid'] },
          ],
          Emergency: [
            { label: 'Important safety announcement', files: ['emergency.your attention please this is an important safety announcement'] },
            { label: 'Do not attempt to leave the train', files: ['emergency.please do not attempt to leave the train'] },
            {
              label: 'Do not try to leave, wait for announcements',
              files: ['emergency.please do not try to leave the train but wait for further announcements'],
            },
            { label: 'Do not open any train doors', files: ['emergency.do not open any train doors'] },
            { label: 'Do not try to leave the train', files: ['emergency.do not try to leave the train'] },
            {
              label: 'Making arrangements to leave the train',
              files: ['emergency.we are currently making arrangements for you to leave the train in safety'],
            },
            { label: 'Leave all luggage in the coach', files: ['emergency.leave all luggage in the coach'] },
            {
              label: 'If you cannot walk through the train',
              files: ['emergency.if you cannot walk through the train please remain in your seat'],
            },
            { label: 'If there is smoke in your coach', files: ['emergency.if there is smoke in your coach'] },
            { label: 'Stay calm, help will arrive shortly', files: ['emergency.please stay calm help will arrive shortly'] },
            this.evacuationButton('front'),
            this.evacuationButton('middle'),
            this.evacuationButton('back'),
          ],
          'Northern Electrics': [
            { label: 'Welcome to the future: travel, relax, enjoy', files: ['electrics.welcome to the future travel relax enjoy'] },
            { label: "Welcome to the future: we're going electric", files: ['electrics.welcome to the future we are going electric'] },
            { label: 'Benefits of the new trains include', files: ['electrics.benefits of the new northern electrics trains include'] },
            { label: 'Saving 251,000 kg of carbon each year', files: ['electrics.saving 251000kg of carbon each year'] },
            { label: 'An extra 3,000 seats at peak times', files: ['electrics.an extra 3000 seats at peak times'] },
            { label: 'An additional 132,000 journeys per year', files: ['electrics.an additional 132000 journeys per year'] },
            { label: 'Approximately 60 new employees', files: ['electrics.approximately 60 new employees'] },
            { label: 'Stats about delivery', files: ['electrics.stats about delivery'] },
            { label: 'Route will be 26.5 miles long', files: ['electrics.the new electric route will be 26 and a half miles long'] },
            { label: 'The same length as a marathon', files: ['electrics.the same length as a marathon'] },
            { label: '114 km of cable', files: ['electrics.114km of cable'] },
            { label: 'Enough cable to reach Calais and back', files: ['electrics.enough cable to get from dover to calais and back'] },
            { label: '1,485 concrete foundations', files: ['electrics.1485 concrete foundations'] },
            { label: '1,861 steelwork structures', files: ['electrics.1861 steelwork structures'] },
            { label: '4,200 new seats in 14 trains', files: ['electrics.4200 new seats in 14 trains'] },
            { label: 'Enough seats to fill the Sage Gateshead', files: ['electrics.more than enough seats to fill the sage gateshead'] },
            { label: 'About 450 staff trained', files: ['electrics.about 450 staff have been trained'] },
            { label: 'Approximately 15,000 hours of training', files: ['electrics.approximately 15000 hours of training'] },
          ],
          'Sound effects': [
            { label: 'PA chime', files: ['fx.pa'] },
            { label: 'Increase / decrease', files: ['fx.increase decrease'] },
          ],
          Miscellaneous: [
            { label: 'Ladies and gentlemen', files: ['conjoiners.ladies and gentlemen'] },
            { label: 'Thank you', files: ['messages.thank you'] },
            { label: 'Out of service', files: ['stations.alt.Out of service'] },
          ],
        },
      },
    } satisfies CustomButtonTab,
  }
}
