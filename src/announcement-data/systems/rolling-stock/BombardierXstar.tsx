import CallingAtSelector, { CallingAtPoint } from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import { AnnouncementState, AnyCustomAnnouncementTab, AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'

/**
 * Stations with recorded audio whose CRS codes are absent from `uk-railway-stations`, so they need names supplying here to be selectable.
 *
 * These are alternate, historic or proposed names for stations which are unbuilt, closed, or already listed under a different code.
 */
const AdditionalStations: { crs: string; name: string }[] = [
  { crs: 'BCP', name: 'Brent Cross Parkway' },
  { crs: 'BCR', name: 'Brent Cross Cricklewood' },
  { crs: 'BCT', name: 'Brent Cross Thameslink' },
  { crs: 'BTC', name: 'Brent Cross' },
  { crs: 'CSP', name: 'Cambridge Science Park' },
  { crs: 'FKH', name: 'Folkestone Harbour' },
  { crs: 'MZO', name: 'Maze Hill (for Greenwich Park)' },
  { crs: 'NVM', name: 'Newhaven Marine' },
  { crs: 'SIO', name: 'Stratford International (for the Olympic Park)' },
  { crs: 'SMI', name: 'Smitham' },
  { crs: 'SVO', name: 'Sevenoaks (for Brands Hatch)' },
  { crs: 'WIX', name: 'Wixams' },
]

const AdditionalStationsTitleValueMap = AdditionalStations.map(s => ({ title: `${s.name} (${s.crs})`, value: s.crs }))

type PortionPosition = 'front' | 'rear'

/**
 * Coach numbers are read from the shared `numbers` clips, which only run as far as 12.
 */
const COACH_NUMBERS = Array.from({ length: 12 }, (_, i) => `${i + 1}`)

const COACH_NUMBER_OPTIONS = COACH_NUMBERS.map(coach => ({ value: coach, title: coach }))

/**
 * Short platform lengths are recorded as whole phrases rather than a number plus "coaches", so only these lengths can be announced.
 */
const SHORT_PLATFORM_LENGTHS = [
  { value: 'coach', title: '1 coach' },
  ...Array.from({ length: 8 }, (_, i) => ({ value: `${i + 2} coaches`, title: `${i + 2} coaches` })),
  { value: 'half of the train', title: 'Half of the train' },
]

const PORTION_POSITIONS: { value: PortionPosition; title: string }[] = [
  { value: 'front', title: 'Front' },
  { value: 'rear', title: 'Rear' },
]

const PORTION_ACTIONS: { value: PortionAction; title: string }[] = [
  { value: 'continueTo', title: 'Will continue to…' },
  { value: 'terminateAt', title: 'Will terminate at…' },
]

type PortionAction = 'continueTo' | 'terminateAt'

const DEFAULT_PORTION_ACTION: PortionAction = 'continueTo'

type ShortPlatformAlighting = 'none' | 'canOnly' | 'cannot'

const SHORT_PLATFORM_ALIGHTING: { value: ShortPlatformAlighting; title: string }[] = [
  { value: 'none', title: 'No' },
  { value: 'canOnly', title: 'Can only alight from…' },
  { value: 'cannot', title: 'Cannot alight from…' },
]

type StationOptions = { title: string; value: string }[]

const whenDividing = (activeState: IDivisionOptions & { terminatesHere?: boolean }) =>
  activeState.dividesEnRoute === true && activeState.terminatesHere !== true

const optionGroupHeading = <State extends AnnouncementState>(label: string, onlyShowWhen?: (activeState: State) => boolean) => ({
  type: 'customNoState' as const,
  component: () => <h4 css={{ margin: '20px 0 0' }}>{label}</h4>,
  onlyShowWhen,
})

const divisionToggle = <State extends AnnouncementState>(name: string, disabled?: (activeState: State) => boolean) => ({
  dividesEnRoute: {
    name,
    type: 'boolean' as const,
    default: false,
    disabled,
  },
})

/**
 * A dividing train splits at a single point, so the two portions are laid out as adjacent inclusive coach ranges.
 */
const divisionPortionOptions = (stationOptions: StationOptions) => ({
  portionAHeading: optionGroupHeading('First portion', whenDividing),
  portionAFirstCoach: {
    name: 'From coach',
    default: '1',
    options: COACH_NUMBER_OPTIONS,
    type: 'select' as const,
    onlyShowWhen: whenDividing,
  },
  portionALastCoach: {
    name: 'To coach',
    default: '4',
    options: COACH_NUMBER_OPTIONS,
    type: 'select' as const,
    onlyShowWhen: whenDividing,
  },
  portionAAction: {
    name: 'Then',
    default: DEFAULT_PORTION_ACTION,
    options: PORTION_ACTIONS,
    type: 'select' as const,
    onlyShowWhen: whenDividing,
  },
  portionADestinationCode: {
    name: 'Destination',
    default: 'BOG',
    options: stationOptions,
    type: 'select' as const,
    onlyShowWhen: whenDividing,
  },
  portionBHeading: optionGroupHeading('Second portion', whenDividing),
  portionBFirstCoach: {
    name: 'From coach',
    default: '5',
    options: COACH_NUMBER_OPTIONS,
    type: 'select' as const,
    onlyShowWhen: whenDividing,
  },
  portionBLastCoach: {
    name: 'To coach',
    default: '8',
    options: COACH_NUMBER_OPTIONS,
    type: 'select' as const,
    onlyShowWhen: whenDividing,
  },
  portionBAction: {
    name: 'Then',
    default: DEFAULT_PORTION_ACTION,
    options: PORTION_ACTIONS,
    type: 'select' as const,
    onlyShowWhen: whenDividing,
  },
  portionBDestinationCode: {
    name: 'Destination',
    default: 'EBN',
    options: stationOptions,
    type: 'select' as const,
    onlyShowWhen: whenDividing,
  },
})

const DIVISION_DEFAULT_STATE: IDivisionOptions = {
  dividesEnRoute: false,
  portionAFirstCoach: '1',
  portionALastCoach: '4',
  portionAAction: DEFAULT_PORTION_ACTION,
  portionADestinationCode: 'BOG',
  portionBFirstCoach: '5',
  portionBLastCoach: '8',
  portionBAction: DEFAULT_PORTION_ACTION,
  portionBDestinationCode: 'EBN',
}

const whenAnnouncingCoachNumber = (activeState: ICoachNumberOptions) => activeState.announceCoachNumber === true

const coachNumberOptions = {
  coachNumberHeading: optionGroupHeading('Coach number'),
  announceCoachNumber: {
    name: 'Announce coach number?',
    type: 'boolean' as const,
    default: false,
  },
  coachNumber: {
    name: 'This coach',
    default: '4',
    options: COACH_NUMBER_OPTIONS,
    type: 'select' as const,
    onlyShowWhen: whenAnnouncingCoachNumber,
  },
  totalCoaches: {
    name: 'Coaches in train',
    default: '8',
    options: COACH_NUMBER_OPTIONS,
    type: 'select' as const,
    onlyShowWhen: whenAnnouncingCoachNumber,
  },
}

const COACH_NUMBER_DEFAULT_STATE: ICoachNumberOptions = {
  announceCoachNumber: false,
  coachNumber: '4',
  totalCoaches: '8',
}

interface IShortPlatformOptions {
  shortPlatform: ShortPlatformAlighting
  shortPlatformPosition: PortionPosition
  shortPlatformLength: string
}

/**
 * Each portion of a dividing train is announced as an inclusive coach range, such as "coaches 1 to 4 will continue to …".
 */
interface IDivisionOptions {
  dividesEnRoute: boolean
  portionAFirstCoach: string
  portionALastCoach: string
  portionAAction: PortionAction
  portionADestinationCode: string
  portionBFirstCoach: string
  portionBLastCoach: string
  portionBAction: PortionAction
  portionBDestinationCode: string
}

interface ICoachNumberOptions {
  announceCoachNumber: boolean
  coachNumber: string
  totalCoaches: string
}

interface IApproachingStationAnnouncementOptions extends IShortPlatformOptions, IDivisionOptions, ICoachNumberOptions {
  stationCode: string
  terminatesHere: boolean
  serviceType: 'southern' | 'southeastern' | 'connex' | 'generic'
  mindTheGap: boolean
  keepBelongings: boolean
  cannotUseOyster: boolean
}

interface IStoppedAtStationAnnouncementOptions extends IDivisionOptions, ICoachNumberOptions {
  thisStationCode: string
  terminatesAtCode: string
  divideStationCode: string
  callingAtCodes: CallingAtPoint[]
  serviceType: 'southern' | 'southeastern' | 'connex' | 'generic'
}

interface IDepartingStationAnnouncementOptions extends IDivisionOptions, ICoachNumberOptions {
  terminatesAtCode: string
  nextStationCode: string
  serviceType: 'southern' | 'southeastern' | 'connex' | 'generic'
}

const announcementPresets: Readonly<{ stopped: ICustomAnnouncementPreset<IStoppedAtStationAnnouncementOptions>[] }> = {
  stopped: [
    {
      name: 'Haywards Heath to Ore',
      state: {
        thisStationCode: 'HHE',
        terminatesAtCode: 'ORE',
        callingAtCodes: ['WVF', 'PMP', 'LWS', 'PLG', 'EBN', 'HMD', 'PEB', 'COB', 'CLL', 'BEX', 'SLQ', 'HGS'].map(crsToStationItemMapper),
        serviceType: 'southern',
      },
    },
    {
      name: 'Preston Park to London Victoria',
      state: {
        thisStationCode: 'PRP',
        terminatesAtCode: 'VIC',
        callingAtCodes: ['HHE', 'GTW', 'ECR', 'CLJ'].map(crsToStationItemMapper),
        serviceType: 'southern',
      },
    },
    {
      name: 'Preston Park to Littlehampton',
      state: {
        thisStationCode: 'PRP',
        terminatesAtCode: 'LIT',
        callingAtCodes: ['HOV', 'PLD', 'SSE', 'LAC', 'WRH', 'WWO', 'DUR', 'GBS', 'ANG'].map(crsToStationItemMapper),
        serviceType: 'southern',
      },
    },
    {
      name: 'Dorking to London Victoria',
      state: {
        thisStationCode: 'DKG',
        terminatesAtCode: 'VIC',
        callingAtCodes: ['BXW', 'LHD', 'AHD', 'EPS', 'EWE', 'CHE', 'SUO', 'CSH', 'HCB', 'MIJ', 'MTC', 'BAL', 'CLJ'].map(crsToStationItemMapper),
        serviceType: 'southern',
      },
    },
  ],
}

export default class BombardierXstar extends TrainAnnouncementSystem {
  readonly NAME = 'Electrostar & Turbostar - Julie Berry'
  readonly ID = 'SN_CLASS_377_V1'
  readonly FILE_PREFIX = 'SN/377'
  readonly SYSTEM_TYPE = 'train'
  readonly DESCRIPTION =
    'Generate Bombardier Electrostar and Turbostar (Southeastern/Southern) on-train announcements using real audio recordings from Julie Berry.'

  private shortPlatformAudio(options: IShortPlatformOptions): AudioItem[] {
    if (options.shortPlatform === 'none') return []

    const alighting = options.shortPlatform === 'canOnly' ? 'can only' : 'cannot'

    return [
      { id: 'short plat.would customers please note that', opts: { delayStart: 500 } },
      `short plat.you ${alighting} alight from the ${options.shortPlatformPosition}`,
      `short plat.coaches.${options.shortPlatformLength}`,
      'short plat.as this station has a short platform',
    ]
  }

  /**
   * Builds one portion of a dividing train as an inclusive coach range, such as "coaches 1 to 4 will continue to Bognor Regis".
   */
  private portionAudio(firstCoach: string, lastCoach: string, action: PortionAction, destinationCode: string): AudioItem[] {
    return [
      { id: 'division.coaches', opts: { delayStart: 500 } },
      `numbers.high.${firstCoach}`,
      'division.to',
      `numbers.low.${lastCoach}`,
      action === 'continueTo' ? 'division.will continue to' : 'division.will terminate at',
      `stations.${destinationCode}`,
    ]
  }

  private divisionAudio(options: IDivisionOptions): AudioItem[] {
    if (!options.dividesEnRoute) return []

    return [
      ...this.portionAudio(options.portionAFirstCoach, options.portionALastCoach, options.portionAAction, options.portionADestinationCode),
      ...this.portionAudio(options.portionBFirstCoach, options.portionBLastCoach, options.portionBAction, options.portionBDestinationCode),
      { id: 'division.please ensure you are travelling in the correct part of the train', opts: { delayStart: 500 } },
    ]
  }

  /**
   * A dividing train is announced to both of its destinations, so the terminus is only named when the train stays intact.
   */
  private destinationAudio(options: IDivisionOptions, terminatesAtCode: string): AudioItem[] {
    if (!options.dividesEnRoute) return [`stations.${terminatesAtCode}`]

    return [`stations.${options.portionADestinationCode}`, 'and', `stations.${options.portionBDestinationCode}`]
  }

  private divisionStationCodes(options: IDivisionOptions): string[] {
    return options.dividesEnRoute ? [options.portionADestinationCode, options.portionBDestinationCode] : []
  }

  private coachNumberAudio(options: ICoachNumberOptions): AudioItem[] {
    if (!options.announceCoachNumber) return []

    return [
      { id: 'this is coach number', opts: { delayStart: 1000 } },
      `numbers.high.${options.coachNumber}`,
      'of',
      `numbers.low.${options.totalCoaches}`,
    ]
  }

  private async playApproachingStationAnnouncement(options: IApproachingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    // A train terminating here cannot also divide here, so terminating always wins.
    const dividesHere = options.dividesEnRoute && !options.terminatesHere

    if (dividesHere && this.divisionStationCodes(options).some(code => !this.validateStationExists(code))) return

    const files: AudioItem[] = []

    files.push('bing bong')
    files.push('we are now approaching', `stations.${options.stationCode}`)

    if (dividesHere) {
      files.push('division.where the train will divide')
      files.push(...this.divisionAudio(options))
    }

    if (options.terminatesHere) {
      files.push('our final destination')

      if (options.serviceType === 'southern') {
        files.push('thank you for travelling with southern')
      } else if (options.serviceType === 'connex') {
        files.push('thank you for travelling with connex')
      }
    }

    if (options.mindTheGap) {
      files.push('please mind the gap between the train and the platform')
    }

    if (options.keepBelongings) {
      if (options.mindTheGap) files.push('and')

      files.push('please do not leave unattended items of luggage in the train or on the station')
    }

    if (options.cannotUseOyster) {
      files.push('you cannot use oyster')
    }

    files.push(...this.shortPlatformAudio(options))

    // A dividing train already gets this line from divisionAudio, so a short platform only adds it when the train stays intact.
    if (options.shortPlatform !== 'none' && !dividesHere) {
      files.push({ id: 'division.please ensure you are travelling in the correct part of the train', opts: { delayStart: 500 } })
    }

    files.push(...this.coachNumberAudio(options))

    await this.playAudioFiles(files, download)
  }

  private async playStoppedAtStationAnnouncement(options: IStoppedAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { callingAtCodes: _callingAt, terminatesAtCode, thisStationCode, divideStationCode } = options

    const callingAtCodes = _callingAt.map(stop => stop.crsCode)

    if (!this.validateStationExists(terminatesAtCode)) return
    if (!this.validateStationExists(thisStationCode)) return
    if (this.divisionStationCodes(options).some(code => !this.validateStationExists(code))) return
    if (options.dividesEnRoute && !this.validateStationExists(divideStationCode)) return

    const files: AudioItem[] = []
    files.push('bing bong')
    files.push('this is', `stations.${thisStationCode}`)

    // When the train divides, the calling list runs as far as the dividing point and each portion is described separately afterwards.
    const finalStopCode = options.dividesEnRoute ? divideStationCode : terminatesAtCode

    const remainingStops = [
      ...callingAtCodes.map((crsCode): AudioItemObject => ({ id: `stations.${crsCode}`, opts: { delayStart: 50 } })),
      { id: `stations.${finalStopCode}`, opts: { delayStart: 50 } },
    ]

    if (callingAtCodes.some(code => !this.validateStationExists(code))) return

    const destination = this.destinationAudio(options, terminatesAtCode)

    switch (options.serviceType) {
      case 'generic':
        files.push('this train is for', ...destination)
        break
      case 'southern':
        files.push('this train is the southern service to', ...destination)
        break
      default:
        files.push('this train is the service to', ...destination)
        break
    }

    if (remainingStops.length > 1) {
      files.push('calling at')
      files.push(...this.pluraliseAudio(remainingStops, { beforeAndDelay: 75 }))
    }

    if (options.dividesEnRoute) {
      files.push({ id: 'division.where the train will divide', opts: { delayStart: 75 } })
      files.push(...this.divisionAudio(options))
    }

    files.push(...this.coachNumberAudio(options))

    await this.playAudioFiles(files, download)
  }

  private async playDepartingStationAnnouncement(options: IDepartingStationAnnouncementOptions, download: boolean = false): Promise<void> {
    if (!options.dividesEnRoute && !this.validateStationExists(options.terminatesAtCode)) return
    if (!this.validateStationExists(options.nextStationCode)) return
    if (this.divisionStationCodes(options).some(code => !this.validateStationExists(code))) return

    const files: AudioItem[] = []
    files.push('bing bong')

    switch (options.serviceType) {
      case 'southeastern':
        files.push('welcome aboard this southeastern service to')
        break
      case 'connex':
      case 'generic':
        files.push('welcome abord this service to')
        break
      default:
        files.push('welcome aboard the southern service to')
        break
    }

    files.push(...this.destinationAudio(options, options.terminatesAtCode))
    files.push(...this.divisionAudio(options))

    files.push('the next station is', `stations.${options.nextStationCode}`)
    files.push(...this.coachNumberAudio(options))

    await this.playAudioFiles(files, download)
  }

  private RealAvailableStationNames = [
    'AAP',
    'ABW',
    'ADM',
    'AFK',
    'AGT',
    'AHD',
    'AHS',
    'AMY',
    'ANF',
    'ANG',
    'ANZ',
    'APD',
    'APS',
    'ARL',
    'ARU',
    'AWM',
    'AYH',
    'AYL',
    'AYP',
    'BAA',
    'BAB',
    'BAD',
    'BAK',
    'BAL',
    'BAN',
    'BAT',
    'BAY',
    'BBL',
    'BCH',
    'BCP',
    'BCR',
    'BCS',
    'BCT',
    'BCU',
    'BCY',
    'BCZ',
    'BDH',
    'BDK',
    'BDM',
    'BEC',
    'BEG',
    'BEU',
    'BEX',
    'BFR',
    'BGM',
    'BHO',
    'BIG',
    'BIK',
    'BIP',
    'BIW',
    'BKA',
    'BKH',
    'BKJ',
    'BKL',
    'BKM',
    'BKS',
    'BLM',
    'BLY',
    'BMG',
    'BMH',
    'BMN',
    'BMO',
    'BMS',
    'BNH',
    'BOG',
    'BOH',
    'BOP',
    'BPK',
    'BRG',
    'BRK',
    'BRX',
    'BSD',
    'BSH',
    'BSR',
    'BTC',
    'BTE',
    'BTN',
    'BUG',
    'BUO',
    'BVD',
    'BXD',
    'BXH',
    'BXW',
    'BXY',
    'CAT',
    'CBE',
    'CBG',
    'CBR',
    'CBW',
    'CCH',
    'CDN',
    'CDS',
    'CED',
    'CFB',
    'CFT',
    'CHE',
    'CHG',
    'CHH',
    'CHP',
    'CHR',
    'CHX',
    'CIL',
    'CIT',
    'CLA',
    'CLD',
    'CLJ',
    'CLK',
    'CLL',
    'CLP',
    'CMB',
    'CNO',
    'COB',
    'COH',
    'COR',
    'CRI',
    'CRT',
    'CRW',
    'CRY',
    'CSA',
    'CSB',
    'CSH',
    'CSP',
    'CST',
    'CSW',
    'CTF',
    'CTK',
    'CTM',
    'CTN',
    'CUF',
    'CUX',
    'CWH',
    'CWN',
    'CWU',
    'CYP',
    'DBY',
    'DDG',
    'DEA',
    'DEP',
    'DFD',
    'DKG',
    'DLH',
    'DMK',
    'DMP',
    'DMS',
    'DNG',
    'DOW',
    'DUR',
    'DVP',
    'DYP',
    'EBD',
    'EBN',
    'EBR',
    'EBT',
    'ECR',
    'EDN',
    'EDW',
    'EFF',
    'EFL',
    'EGR',
    'ELD',
    'ELE',
    'ELS',
    'ELW',
    'ELY',
    'EMD',
    'EML',
    'EMS',
    'ENC',
    'EPD',
    'EPH',
    'EPS',
    'ERH',
    'ERI',
    'ESD',
    'ESL',
    'ETC',
    'EWE',
    'EWR',
    'EXR',
    'EYN',
    'FAV',
    'FCN',
    'FGT',
    'FKC',
    'FKH',
    'FKW',
    'FLT',
    'FMR',
    'FNR',
    'FOD',
    'FOH',
    'FPK',
    'FRM',
    'FRT',
    'FSB',
    'FSG',
    'FTN',
    'FXN',
    'GBS',
    'GDH',
    'GDN',
    'GIP',
    'GLD',
    'GLM',
    'GLY',
    'GNH',
    'GNW',
    'GPK',
    'GPO',
    'GRP',
    'GRV',
    'GTW',
    'HAI',
    'HAT',
    'HAV',
    'HBN',
    'HCB',
    'HCN',
    'HDM',
    'HDW',
    'HEN',
    'HEV',
    'HFN',
    'HGM',
    'HGR',
    'HGS',
    'HGY',
    'HHE',
    'HHY',
    'HIB',
    'HIT',
    'HLB',
    'HLM',
    'HLN',
    'HLS',
    'HMD',
    'HME',
    'HML',
    'HMT',
    'HNA',
    'HNB',
    'HNH',
    'HOR',
    'HOV',
    'HPA',
    'HPD',
    'HRH',
    'HRM',
    'HRN',
    'HRW',
    'HSK',
    'HSY',
    'HUN',
    'HUR',
    'HWY',
    'HYR',
    'HYS',
    'IFI',
    'IMW',
    'KBW',
    'KCK',
    'KDB',
    'KET',
    'KGL',
    'KGX',
    'KLN',
    'KLY',
    'KML',
    'KMS',
    'KND',
    'KPA',
    'KSN',
    'KTH',
    'KTN',
    'LAC',
    'LAD',
    'LBG',
    'LBZ',
    'LEA',
    'LEE',
    'LEI',
    'LEN',
    'LET',
    'LEW',
    'LFD',
    'LGF',
    'LGJ',
    'LHD',
    'LIH',
    'LIT',
    'LMS',
    'LRB',
    'LRD',
    'LSY',
    'LTN',
    'LTP',
    'LUT',
    'LVN',
    'LWS',
    'MAR',
    'MBK',
    'MCB',
    'MDB',
    'MDE',
    'MDS',
    'MDW',
    'MEL',
    'MEP',
    'MHM',
    'MHR',
    'MIJ',
    'MIL',
    'MKC',
    'MOG',
    'MRN',
    'MSR',
    'MTC',
    'MTG',
    'MTM',
    'MYB',
    'MZH',
    'MZO',
    'NBA',
    'NBC',
    'NDL',
    'NEH',
    'NFL',
    'NGT',
    'NHD',
    'NHE',
    'NLT',
    'NMP',
    'NOT',
    'NRB',
    'NSB',
    'NSG',
    'NTL',
    'NUF',
    'NUT',
    'NVH',
    'NVM',
    'NVN',
    'NWD',
    'NWM',
    'NWX',
    'NXG',
    'OKL',
    'OLD',
    'OLY',
    'ORE',
    'ORP',
    'OTF',
    'OXT',
    'PAL',
    'PBO',
    'PBR',
    'PDW',
    'PEB',
    'PET',
    'PEV',
    'PHR',
    'PLC',
    'PLD',
    'PLG',
    'PLU',
    'PMH',
    'PMP',
    'PMR',
    'PMS',
    'PNE',
    'PNW',
    'POK',
    'PRP',
    'PRR',
    'PTC',
    'PUL',
    'PUO',
    'PUR',
    'QBR',
    'QRP',
    'RAI',
    'RAM',
    'RBR',
    'RDB',
    'RDD',
    'RDH',
    'RDT',
    'REI',
    'RHM',
    'RTR',
    'RUG',
    'RVB',
    'RYE',
    'RYS',
    'SAC',
    'SAF',
    'SAJ',
    'SAY',
    'SBM',
    'SCG',
    'SCY',
    'SDA',
    'SDG',
    'SDH',
    'SDN',
    'SDW',
    'SDY',
    'SEE',
    'SEF',
    'SEG',
    'SEH',
    'SEV',
    'SGR',
    'SHF',
    'SHO',
    'SID',
    'SIH',
    'SIO',
    'SIT',
    'SLQ',
    'SMI',
    'SMO',
    'SMY',
    'SNO',
    'SNR',
    'SNW',
    'SOB',
    'SOG',
    'SOL',
    'SOO',
    'SOR',
    'SOU',
    'SPB',
    'SPH',
    'SPU',
    'SRA',
    'SRC',
    'SRH',
    'SRS',
    'SRT',
    'SRU',
    'SSE',
    'SSS',
    'STE',
    'STH',
    'STP',
    'STU',
    'SUC',
    'SUD',
    'SUO',
    'SUP',
    'SVG',
    'SVO',
    'SWK',
    'SWL',
    'SWM',
    'SWO',
    'SWY',
    'SYD',
    'SYH',
    'TAD',
    'TAT',
    'TBD',
    'TBW',
    'TEY',
    'TOK',
    'TON',
    'TOO',
    'TRI',
    'TTH',
    'TTN',
    'TUH',
    'UCK',
    'UWL',
    'VIC',
    'WAD',
    'WAE',
    'WAM',
    'WAS',
    'WAT',
    'WBC',
    'WBL',
    'WBO',
    'WBP',
    'WCB',
    'WCX',
    'WCY',
    'WDO',
    'WDU',
    'WEL',
    'WFJ',
    'WGA',
    'WGC',
    'WHA',
    'WHI',
    'WHP',
    'WHS',
    'WHY',
    'WIH',
    'WIM',
    'WIX',
    'WLD',
    'WLI',
    'WLS',
    'WLT',
    'WLW',
    'WMA',
    'WMB',
    'WME',
    'WMG',
    'WNH',
    'WNW',
    'WOH',
    'WRH',
    'WRP',
    'WRU',
    'WRW',
    'WSE',
    'WSU',
    'WSW',
    'WTG',
    'WTR',
    'WVF',
    'WWA',
    'WWD',
    'WWI',
    'WWO',
    'WWR',
    'WYE',
    'YAL',
    'ZFD',
  ]

  readonly AvailableStationNames = {
    high: this.RealAvailableStationNames,
    low: this.RealAvailableStationNames,
  }

  get allAvailableStationOptions() {
    const arr = AllStationsTitleValueMap.filter(s => this.RealAvailableStationNames.includes(s.value)).concat(AdditionalStationsTitleValueMap)

    arr.sort((a, b) => a.title.localeCompare(b.title))

    return arr
  }

  readonly customAnnouncementTabs: Record<string, AnyCustomAnnouncementTab> = {
    approachingStation: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      defaultState: {
        stationCode: this.RealAvailableStationNames[0],
        terminatesHere: false,
        serviceType: 'southern',
        mindTheGap: true,
        keepBelongings: false,
        cannotUseOyster: false,
        shortPlatform: 'none',
        shortPlatformPosition: 'front',
        shortPlatformLength: '4 coaches',
        ...DIVISION_DEFAULT_STATE,
        ...COACH_NUMBER_DEFAULT_STATE,
      },
      props: {
        playHandler: this.playApproachingStationAnnouncement.bind(this),
        // A train terminating here cannot also divide here.
        normaliseState: state => (state.terminatesHere ? { ...state, dividesEnRoute: false } : state),
        options: {
          stationCode: {
            name: 'Next station',
            default: this.RealAvailableStationNames[0],
            options: this.allAvailableStationOptions,
            type: 'select',
          },
          terminatesHere: {
            name: 'Terminates here?',
            type: 'boolean',
            default: false,
          },
          serviceType: {
            name: 'Service type',
            default: 'southern',
            options: [
              { title: 'Southern', value: 'southern' },
              { title: 'Southeastern', value: 'southeastern' },
              { title: 'Connex', value: 'connex' },
              { title: 'Generic', value: 'generic' },
            ],
            type: 'select',
          },
          mindTheGap: {
            name: 'Mind the gap?',
            type: 'boolean',
            default: true,
          },
          keepBelongings: {
            name: 'Keep belongings with you?',
            type: 'boolean',
            default: false,
          },
          cannotUseOyster: {
            name: 'Cannot use Oyster/Contactless beyond here?',
            type: 'boolean',
            default: false,
          },
          shortPlatformHeading: optionGroupHeading('Short platform'),
          shortPlatform: {
            name: 'Short platform',
            default: 'none',
            options: SHORT_PLATFORM_ALIGHTING,
            type: 'select',
          },
          shortPlatformPosition: {
            name: 'Short platform — portion',
            default: 'front',
            options: PORTION_POSITIONS,
            type: 'select',
            onlyShowWhen: activeState => activeState.shortPlatform !== 'none',
          },
          shortPlatformLength: {
            name: 'Short platform — length',
            default: '4 coaches',
            options: SHORT_PLATFORM_LENGTHS,
            type: 'select',
            onlyShowWhen: activeState => activeState.shortPlatform !== 'none',
          },
          optionGroupHeadingDivision: optionGroupHeading('Division'),
          ...divisionToggle('Divides here?', activeState => activeState.terminatesHere === true),
          ...divisionPortionOptions(this.allAvailableStationOptions),
          ...coachNumberOptions,
        },
      },
    } satisfies CustomAnnouncementTab<IApproachingStationAnnouncementOptions, 'shortPlatformHeading' | 'optionGroupHeadingDivision'>,
    stoppedAtStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      defaultState: {
        thisStationCode: this.RealAvailableStationNames[0],
        terminatesAtCode: this.RealAvailableStationNames[0],
        divideStationCode: this.RealAvailableStationNames[0],
        callingAtCodes: [],
        serviceType: 'southern',
        ...DIVISION_DEFAULT_STATE,
        ...COACH_NUMBER_DEFAULT_STATE,
      },
      props: {
        playHandler: this.playStoppedAtStationAnnouncement.bind(this),
        presets: announcementPresets.stopped,
        options: {
          thisStationCode: {
            name: 'This station',
            default: this.RealAvailableStationNames[0],
            options: this.allAvailableStationOptions,
            type: 'select',
          },
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.RealAvailableStationNames[0],
            options: this.allAvailableStationOptions,
            type: 'select',
            onlyShowWhen: activeState => activeState.dividesEnRoute !== true,
          },
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.RealAvailableStationNames,
              additionalOptions: AdditionalStationsTitleValueMap,
            },
            default: [],
          },
          serviceType: {
            name: 'Service type',
            default: 'southern',
            options: [
              { title: 'Southern', value: 'southern' },
              { title: 'Southeastern', value: 'southeastern' },
              { title: 'Connex', value: 'connex' },
              { title: 'Generic', value: 'generic' },
            ],
            type: 'select',
          },
          optionGroupHeadingDivision: optionGroupHeading('Division'),
          ...divisionToggle('Divides en route?'),
          divideStationCode: {
            name: 'Divides at',
            default: this.RealAvailableStationNames[0],
            options: this.allAvailableStationOptions,
            type: 'select',
            onlyShowWhen: whenDividing,
          },
          ...divisionPortionOptions(this.allAvailableStationOptions),
          ...coachNumberOptions,
        },
      },
    } satisfies CustomAnnouncementTab<IStoppedAtStationAnnouncementOptions, 'optionGroupHeadingDivision'>,
    departingStation: {
      name: 'Departing station',
      component: CustomAnnouncementPane,
      defaultState: {
        terminatesAtCode: this.RealAvailableStationNames[0],
        nextStationCode: this.RealAvailableStationNames[0],
        serviceType: 'southern',
        ...DIVISION_DEFAULT_STATE,
        ...COACH_NUMBER_DEFAULT_STATE,
      },
      props: {
        playHandler: this.playDepartingStationAnnouncement.bind(this),
        options: {
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.RealAvailableStationNames[0],
            options: this.allAvailableStationOptions,
            type: 'select',
            onlyShowWhen: activeState => activeState.dividesEnRoute !== true,
          },
          nextStationCode: {
            name: 'Next station',
            default: this.RealAvailableStationNames[0],
            options: this.allAvailableStationOptions,
            type: 'select',
          },
          serviceType: {
            name: 'Service type',
            default: 'southern',
            options: [
              { title: 'Southern', value: 'southern' },
              { title: 'Southeastern', value: 'southeastern' },
              { title: 'Connex', value: 'connex' },
              { title: 'Generic', value: 'generic' },
            ],
            type: 'select',
          },
          optionGroupHeadingDivision: optionGroupHeading('Division'),
          ...divisionToggle('Divides en route?'),
          ...divisionPortionOptions(this.allAvailableStationOptions),
          ...coachNumberOptions,
        },
      },
    } satisfies CustomAnnouncementTab<IDepartingStationAnnouncementOptions, 'optionGroupHeadingDivision'>,
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          General: [
            {
              label: 'Bing bong',
              play: this.playAudioFiles.bind(this, ['bing bong']),
              download: this.playAudioFiles.bind(this, ['bing bong'], true),
            },
            {
              label: 'You must wear a face covering',
              play: this.playAudioFiles.bind(this, ['you must wear a face covering on your jouney unless you are exempt']),
              download: this.playAudioFiles.bind(this, ['you must wear a face covering on your jouney unless you are exempt'], true),
            },
            {
              label: 'BTP 61016',
              play: this.playAudioFiles.bind(this, ['please keep your bags and personal belongings with you', '61016']),
              download: this.playAudioFiles.bind(this, ['please keep your bags and personal belongings with you', '61016'], true),
            },
          ],
          'Division & coupling': [
            {
              label: 'Travel in the correct part of the train',
              files: ['division.please ensure you are travelling in the correct part of the train'],
            },
            {
              label: 'More coaches will be attached',
              files: ['division.more coaches will be attached to this train'],
            },
            {
              label: 'Stand clear of the doors',
              files: ['division.please stand clear of the doors while the attachment is being made'],
            },
            {
              label: 'Remain seated until attachment complete',
              files: ['division.please remain seated until the attachment process has been completed'],
            },
            {
              label: 'Doors will not open until attached',
              files: ['division.the doors will not open', 'division.until the attachment has been made'],
            },
            {
              label: 'Doors will not open until detached',
              files: ['division.the doors will not open', 'division.until the detachment has been made'],
            },
            {
              label: 'Doors closing, will not open again',
              files: ['division.the doors will shortly close and will not open again'],
            },
          ],
          'Coach number': COACH_NUMBERS.map(coach => ({
            label: `This is coach number ${coach}`,
            files: ['this is coach number', `numbers.low.${coach}`],
          })),
        },
      },
    },
  }
}
