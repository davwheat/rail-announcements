import CustomAnnouncementPane from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import CallingAtSelector, { CallingAtPoint } from '@components/CallingAtSelector'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import { AnyCustomAnnouncementTab, AudioItem, CustomAnnouncementButton, CustomAnnouncementTab, CustomButtonTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'

type Brand = 'fgw' | 'gwr' | 'gwr short'

type BrandPhrase =
  | 'welcomes you aboard this service from'
  | 'welcomes you aboard this service to'
  | 'welcome aboard this service from'
  | 'thank you for travelling with'
  | 'apologise for the inconvenience'
  | 'this service has been delayed'
  | 'please check website for further details'

type ReasonIntro = 'none' | 'this is due to' | 'this is because of'

type DisruptionType = 'running late' | 'delayed' | 'waiting for' | 'continuing delay' | 'terminating early'

interface IWelcomeAboardOptions {
  brand: Brand
  announcementType: 'start of journey' | 'en route'
  originCode: string
  terminatesAtCode: string
  callingAtCodes: CallingAtPoint[]
}

interface IDepartingStationOptions {
  nextStationCode: string
}

interface IApproachingStationOptions {
  brand: Brand
  stationCode: string
  isFinalStop: boolean
}

interface IAtStationOptions {
  brand: Brand
  stationCode: string
  isFinalStop: boolean
  originCode: string
  terminatesAtCode: string
  callingAtCodes: CallingAtPoint[]
}

interface IDisruptionOptions {
  brand: Brand
  disruptionType: DisruptionType
  minutesLate: string
  reasonIntro: ReasonIntro
  reason: string
  waitingFor: string
  willContinue: boolean
  terminatesAtCode: string
  noLongerCallingAt: CallingAtPoint[]
  apologise: boolean
  checkWithStaff: boolean
  checkWebsite: boolean
}

interface IDividingTrainOptions {
  divideAtCode: string
  frontDestinationCode: string
  rearDestinationCode: string
}

const SENTENCE_GAP = 500

/**
 * Station-specific extras, taken from the TrainFX export's auxiliary announcement table.
 */
const APPROACH_EXTRAS: Record<string, AudioItem[]> = {
  TWY: [{ id: 'conjoiners.change here for connecting services to', opts: { delayStart: SENTENCE_GAP } }, 'stations.high.HOT'],
  MAI: [{ id: 'conjoiners.change here for connecting services to', opts: { delayStart: SENTENCE_GAP } }, 'stations.high.MLW'],
  FNN: [{ id: 'messages.do not use the foot crossing when the red light is showing', opts: { delayStart: SENTENCE_GAP } }],
  GOM: [{ id: 'messages.do not use the foot crossing until this train has left the station', opts: { delayStart: SENTENCE_GAP } }],
  BDW: [{ id: 'messages.do not cross the railway line', opts: { delayStart: SENTENCE_GAP } }],
}

const ARRIVAL_EXTRAS: Record<string, AudioItem[]> = {
  PAD: [{ id: 'messages.for taxis and buses please follow signage', opts: { delayStart: SENTENCE_GAP } }],
  RDG: [{ id: 'messages.if you are travelling with luggage please use the lifts', opts: { delayStart: SENTENCE_GAP } }],
}

/**
 * Arriving at these stations repeats the full welcome and security reminder rather than the short welcome.
 */
const PRINCIPAL_STATIONS = ['EAL', 'PAD', 'OXF', 'RDG', 'SLO', 'WOF']

const SECURITY_REMINDER: AudioItem[] = [
  { id: 'messages.please do not leave any items of luggage unattended', opts: { delayStart: SENTENCE_GAP } },
  { id: 'messages.safety information is on posters in the vestibule', opts: { delayStart: SENTENCE_GAP } },
]

const BRAND_OPTIONS: { title: string; value: Brand }[] = [
  { title: 'First Great Western', value: 'fgw' },
  { title: 'Great Western Railway', value: 'gwr' },
  { title: 'GWR', value: 'gwr short' },
]

/**
 * The GWR rebrand only re-recorded some phrases with the short name, so the rest borrow the full name.
 */
const SHORT_GWR_PHRASES: BrandPhrase[] = [
  'welcomes you aboard this service from',
  'welcome aboard this service from',
  'thank you for travelling with',
  'this service has been delayed',
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
  'a train departing late from the depot',
  'a train departing late from the depot earlier',
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
  'an external cause beyond our control',
  'an incident at Heathrow',
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
  'over running engineering works',
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
  'the failure of a freight train',
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

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default class FGWTrainFx extends TrainAnnouncementSystem {
  readonly NAME = 'First Great Western - TrainFX - Faye Dicker'
  readonly ID = 'FGW_TRAINFX_V1'
  readonly FILE_PREFIX = 'FGW/TrainFX'
  readonly SYSTEM_TYPE = 'train'
  readonly DESCRIPTION =
    'Generate First Great Western and Great Western Railway TrainFX on-train announcements, voiced by Faye Dicker, using real audio recordings.'

  private brandClip(brand: Brand, phrase: BrandPhrase, delayStart: number = 0): AudioItem {
    const availableBrand = brand === 'gwr short' && !SHORT_GWR_PHRASES.includes(phrase) ? 'gwr' : brand

    return { id: `brand.${availableBrand}.${phrase}`, opts: { delayStart } }
  }

  private callingPointsAudio(callingAtCodes: CallingAtPoint[], terminatesAtCode: string): AudioItem[] {
    return this.pluraliseAudio([...callingAtCodes.map(stn => `stations.high.${stn.crsCode}`), `stations.low.${terminatesAtCode}`], {
      andId: 'conjoiners.and',
    })
  }

  private validateCallingPoints(callingAtCodes: CallingAtPoint[]): boolean {
    return callingAtCodes.every(stn => this.validateStationExists(stn.crsCode, 'high'))
  }

  /**
   * Returns null when a station lacks audio, after the user has been told which one.
   */
  private journeyAudio(
    brand: Brand,
    phrase: BrandPhrase,
    originCode: string,
    terminatesAtCode: string,
    callingAtCodes: CallingAtPoint[],
  ): AudioItem[] | null {
    if (
      !this.validateStationExists(originCode, 'high') ||
      !this.validateStationExists(terminatesAtCode, 'high') ||
      !this.validateStationExists(terminatesAtCode, 'low') ||
      !this.validateCallingPoints(callingAtCodes)
    ) {
      return null
    }

    return [
      this.brandClip(brand, phrase),
      `stations.high.${originCode}`,
      'conjoiners.to',
      `stations.high.${terminatesAtCode}`,
      'conjoiners.calling at',
      ...this.callingPointsAudio(callingAtCodes, terminatesAtCode),
    ]
  }

  private async playWelcomeAboardAnnouncement(options: IWelcomeAboardOptions, download: boolean = false): Promise<void> {
    const { brand, announcementType, originCode, terminatesAtCode, callingAtCodes } = options

    const isStartOfJourney = announcementType === 'start of journey'
    const files = this.journeyAudio(
      brand,
      isStartOfJourney ? 'welcomes you aboard this service from' : 'welcome aboard this service from',
      originCode,
      terminatesAtCode,
      callingAtCodes,
    )
    if (!files) return

    if (isStartOfJourney) {
      files.push({ id: 'messages.safety information is on posters in the vestibule', opts: { delayStart: SENTENCE_GAP } })
    }

    await this.playAudioFiles(files, download)
  }

  private async playDepartingStationAnnouncement(options: IDepartingStationOptions, download: boolean = false): Promise<void> {
    const { nextStationCode } = options

    if (!this.validateStationExists(nextStationCode, 'low')) {
      return
    }

    await this.playAudioFiles(['conjoiners.our next station is', `stations.low.${nextStationCode}`], download)
  }

  private finalStopAudio(brand: Brand): AudioItem[] {
    return [
      'conjoiners.our final stop for this service',
      { id: 'messages.please have your tickets and travel documents ready', opts: { delayStart: SENTENCE_GAP } },
      { id: 'messages.please take care as you step from the train to the platform', opts: { delayStart: SENTENCE_GAP } },
      this.brandClip(brand, 'thank you for travelling with', SENTENCE_GAP),
    ]
  }

  private async playApproachingStationAnnouncement(options: IApproachingStationOptions, download: boolean = false): Promise<void> {
    const { brand, stationCode, isFinalStop } = options

    const files: AudioItem[] = []

    if (isFinalStop) {
      if (!this.validateStationExists(stationCode, 'high')) return

      files.push('conjoiners.we are now approaching', `stations.high.${stationCode}`, ...this.finalStopAudio(brand))
    } else {
      if (!this.validateStationExists(stationCode, 'low')) return

      files.push('conjoiners.we will shortly be arriving at', `stations.low.${stationCode}`)
    }

    files.push(...(APPROACH_EXTRAS[stationCode] ?? []))

    await this.playAudioFiles(files, download)
  }

  private async playAtStationAnnouncement(options: IAtStationOptions, download: boolean = false): Promise<void> {
    const { brand, stationCode, isFinalStop, originCode, terminatesAtCode, callingAtCodes } = options

    const files: AudioItem[] = []

    if (isFinalStop) {
      if (!this.validateStationExists(stationCode, 'high')) return

      files.push('conjoiners.this station is', `stations.high.${stationCode}`, ...this.finalStopAudio(brand))
    } else if (PRINCIPAL_STATIONS.includes(stationCode)) {
      const journey = this.journeyAudio(brand, 'welcome aboard this service from', originCode, terminatesAtCode, callingAtCodes)
      if (!journey) return

      files.push(...journey)
    } else {
      if (!this.validateStationExists(terminatesAtCode, 'low')) return

      files.push(this.brandClip(brand, 'welcomes you aboard this service to'), `stations.low.${terminatesAtCode}`)
    }

    files.push(...(ARRIVAL_EXTRAS[stationCode] ?? []))

    if (!isFinalStop && PRINCIPAL_STATIONS.includes(stationCode)) {
      files.push(...SECURITY_REMINDER)
    }

    await this.playAudioFiles(files, download)
  }

  private reasonAudio(reasonIntro: ReasonIntro, reason: string): AudioItem[] {
    if (reasonIntro === 'none' || !reason) return []

    return [{ id: `conjoiners.${reasonIntro}`, opts: { delayStart: SENTENCE_GAP } }, `reasons.${reason}`]
  }

  private async playDisruptionAnnouncement(options: IDisruptionOptions, download: boolean = false): Promise<void> {
    const {
      brand,
      disruptionType,
      minutesLate,
      reasonIntro,
      reason,
      waitingFor,
      willContinue,
      terminatesAtCode,
      noLongerCallingAt,
      apologise,
      checkWithStaff,
      checkWebsite,
    } = options

    const files: AudioItem[] = []

    switch (disruptionType) {
      case 'running late':
        files.push(
          'conjoiners.we apologise but this service is now running approximately',
          `numbers.${minutesLate}`,
          'conjoiners.minutes late',
          ...this.reasonAudio(reasonIntro, reason),
        )
        break

      case 'delayed':
        files.push(this.brandClip(brand, 'this service has been delayed'), ...this.reasonAudio(reasonIntro, reason))
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

        files.push('conjoiners.this service will now terminate at', `stations.low.${terminatesAtCode}`)

        if (noLongerCallingAt.length > 0) {
          if (!this.validateCallingPoints(noLongerCallingAt)) return

          const [lastStop, ...otherStops] = [...noLongerCallingAt].reverse()

          if (!this.validateStationExists(lastStop.crsCode, 'low')) return

          files.push('conjoiners.and will no longer call at', ...this.callingPointsAudio(otherStops.reverse(), lastStop.crsCode))
        }

        files.push(...this.reasonAudio(reasonIntro, reason))
        break
      }
    }

    if (willContinue && (disruptionType === 'waiting for' || disruptionType === 'continuing delay')) {
      files.push({ id: 'messages.this service will continue as soon as possible', opts: { delayStart: SENTENCE_GAP } })
    }

    if (checkWithStaff && disruptionType === 'terminating early') {
      files.push({ id: 'messages.please check with station staff for alternative services', opts: { delayStart: SENTENCE_GAP } })
    }

    if (checkWebsite && disruptionType === 'terminating early') {
      files.push(this.brandClip(brand, 'please check website for further details', SENTENCE_GAP))
    }

    if (apologise && disruptionType !== 'delayed') {
      files.push(this.brandClip(brand, 'apologise for the inconvenience', SENTENCE_GAP))
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

  private evacuationButton(position: 'front' | 'middle' | 'rear'): CustomAnnouncementButton {
    return {
      label: `Evacuate via ${position} of train`,
      files: [
        'emergency.your attention please this is an important safety announcement',
        { id: 'conjoiners.it has now become necessary for us to evacuate the train', opts: { delayStart: SENTENCE_GAP } },
        { id: 'conjoiners.will all customers please move towards the', opts: { delayStart: SENTENCE_GAP } },
        `conjoiners.${position}`,
        'conjoiners.of the train immediately and wait for more instructions',
      ],
    }
  }

  readonly AllAvailableStationNames: string[] = [
    'AML',
    'AMT',
    'APF',
    'ASC',
    'ASH',
    'AUW',
    'AVF',
    'AVN',
    'BAA',
    'BAN',
    'BAS',
    'BAW',
    'BDW',
    'BFE',
    'BGL',
    'BIT',
    'BMT',
    'BMY',
    'BNE',
    'BNM',
    'BNP',
    'BOA',
    'BOD',
    'BPW',
    'BRI',
    'BRU',
    'BSK',
    'BTH',
    'BTN',
    'BTO',
    'BWT',
    'CAU',
    'CBB',
    'CBN',
    'CBP',
    'CBY',
    'CCH',
    'CDF',
    'CDI',
    'CDU',
    'CFN',
    'CHL',
    'CHO',
    'CLC',
    'CME',
    'CNM',
    'CNO',
    'COE',
    'COO',
    'COP',
    'CPM',
    'CPN',
    'CRN',
    'CSA',
    'CSK',
    'CUM',
    'CWL',
    'DCW',
    'DID',
    'DIG',
    'DKG',
    'DKT',
    'DMH',
    'DOC',
    'DPD',
    'DPT',
    'DRG',
    'DWL',
    'DWW',
    'EAL',
    'EAR',
    'EGG',
    'ELD',
    'ESL',
    'EVE',
    'EXC',
    'EXD',
    'EXM',
    'EXN',
    'EXT',
    'FAL',
    'FFD',
    'FIN',
    'FIT',
    'FMT',
    'FNN',
    'FRM',
    'FRO',
    'FTN',
    'FZP',
    'GCR',
    'GFD',
    'GLD',
    'GMV',
    'GOM',
    'GOR',
    'GSL',
    'GTW',
    'HAN',
    'HAV',
    'HAY',
    'HFD',
    'HGD',
    'HIG',
    'HND',
    'HOR',
    'HOT',
    'HOV',
    'HYB',
    'HYD',
    'HYL',
    'ISP',
    'IVR',
    'IVY',
    'KEM',
    'KEY',
    'KGM',
    'KGN',
    'KGS',
    'KIT',
    'KYN',
    'LAP',
    'LED',
    'LEL',
    'LNY',
    'LOO',
    'LOS',
    'LSK',
    'LTS',
    'LUX',
    'LWH',
    'LYC',
    'LYM',
    'MAI',
    'MDG',
    'MDN',
    'MEN',
    'MIM',
    'MKM',
    'MLW',
    'MOR',
    'MRD',
    'MTP',
    'MVL',
    'NBY',
    'NCM',
    'NCO',
    'NLS',
    'NQY',
    'NRC',
    'NTA',
    'NTC',
    'NWP',
    'OKE',
    'OLF',
    'OXF',
    'PAD',
    'PAN',
    'PAR',
    'PEW',
    'PGN',
    'PIL',
    'PLY',
    'PMA',
    'PMH',
    'PMS',
    'PNM',
    'PNZ',
    'POL',
    'PRW',
    'PSH',
    'PSN',
    'PWY',
    'PYN',
    'QUI',
    'RAD',
    'RDA',
    'RDG',
    'RDH',
    'RDW',
    'RED',
    'REI',
    'ROC',
    'ROM',
    'SAF',
    'SAL',
    'SAR',
    'SAU',
    'SBF',
    'SBV',
    'SCR',
    'SCS',
    'SDP',
    'SER',
    'SFR',
    'SGM',
    'SGN',
    'SHH',
    'SHI',
    'SHU',
    'SIP',
    'SIV',
    'SJP',
    'SKN',
    'SLO',
    'SML',
    'SND',
    'SOA',
    'SOU',
    'SRD',
    'SSE',
    'STD',
    'STJ',
    'STL',
    'STS',
    'SVB',
    'SWI',
    'TAC',
    'TAP',
    'TAU',
    'TGM',
    'THA',
    'THE',
    'THO',
    'TLH',
    'TOP',
    'TOT',
    'TQY',
    'TRO',
    'TRR',
    'TRU',
    'TVP',
    'TWY',
    'UMB',
    'UPW',
    'WAN',
    'WDT',
    'WEA',
    'WEY',
    'WGV',
    'WKM',
    'WMN',
    'WNC',
    'WNM',
    'WNS',
    'WOF',
    'WOR',
    'WOS',
    'WRH',
    'WSB',
    'WSM',
    'WTI',
    'YAE',
    'YAT',
    'YEO',
    'YET',
    'YVP',
  ]

  readonly AvailableStationNames = {
    low: this.AllAvailableStationNames,
    high: this.AllAvailableStationNames,
  }

  readonly StationOptions: { title: string; value: string }[] = this.AllAvailableStationNames.map(crsToStationItemMapper)
    .map(item => ({ value: item.crsCode, title: item.name }))
    .sort((a, b) => a.title.localeCompare(b.title))

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

  readonly customAnnouncementTabs: Record<string, AnyCustomAnnouncementTab> = {
    welcomeAboard: {
      name: 'Welcome aboard',
      component: CustomAnnouncementPane,
      defaultState: {
        brand: 'fgw',
        announcementType: 'start of journey',
        originCode: 'PAD',
        terminatesAtCode: 'BRI',
        callingAtCodes: [],
      },
      props: {
        playHandler: this.playWelcomeAboardAnnouncement.bind(this),
        options: {
          brand: {
            name: 'Operator branding',
            type: 'select',
            default: 'fgw',
            options: BRAND_OPTIONS,
          },
          announcementType: {
            name: 'Announcement type',
            type: 'select',
            default: 'start of journey',
            options: [
              { title: 'Start of journey (with safety information)', value: 'start of journey' },
              { title: 'En route or at a principal station', value: 'en route' },
            ],
          },
          originCode: {
            name: 'Origin station',
            type: 'select',
            default: 'PAD',
            options: this.StationOptions,
          },
          terminatesAtCode: {
            name: 'Terminates at',
            type: 'select',
            default: 'BRI',
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
        },
      },
    } satisfies CustomAnnouncementTab<IWelcomeAboardOptions>,
    departingStation: {
      name: 'Departing station',
      component: CustomAnnouncementPane,
      defaultState: {
        nextStationCode: 'RDG',
      },
      props: {
        playHandler: this.playDepartingStationAnnouncement.bind(this),
        options: {
          nextStationCode: {
            name: 'Next station',
            type: 'select',
            default: 'RDG',
            options: this.StationOptions,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IDepartingStationOptions>,
    approachingStation: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      defaultState: {
        brand: 'fgw',
        stationCode: 'RDG',
        isFinalStop: false,
      },
      props: {
        playHandler: this.playApproachingStationAnnouncement.bind(this),
        options: {
          stationCode: {
            name: 'Station',
            type: 'select',
            default: 'RDG',
            options: this.StationOptions,
          },
          isFinalStop: {
            name: 'Final stop for this service',
            type: 'boolean',
            default: false,
          },
          brand: {
            name: 'Operator branding',
            type: 'select',
            default: 'fgw',
            options: BRAND_OPTIONS,
            onlyShowWhen: state => state.isFinalStop,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IApproachingStationOptions>,
    atStation: {
      name: 'At station',
      component: CustomAnnouncementPane,
      defaultState: {
        brand: 'fgw',
        stationCode: 'RDG',
        isFinalStop: false,
        originCode: 'PAD',
        terminatesAtCode: 'BRI',
        callingAtCodes: [],
      },
      props: {
        playHandler: this.playAtStationAnnouncement.bind(this),
        options: {
          brand: {
            name: 'Operator branding',
            type: 'select',
            default: 'fgw',
            options: BRAND_OPTIONS,
          },
          isFinalStop: {
            name: 'Final stop for this service',
            type: 'boolean',
            default: false,
          },
          stationCode: {
            name: 'This station',
            type: 'select',
            default: 'RDG',
            options: this.StationOptions,
          },
          originCode: {
            name: 'Origin station',
            type: 'select',
            default: 'PAD',
            options: this.StationOptions,
            onlyShowWhen: state => !state.isFinalStop && PRINCIPAL_STATIONS.includes(state.stationCode),
          },
          terminatesAtCode: {
            name: 'Terminates at',
            type: 'select',
            default: 'BRI',
            options: this.StationOptions,
            onlyShowWhen: state => !state.isFinalStop,
          },
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.AllAvailableStationNames,
            },
            default: [],
            onlyShowWhen: state => !state.isFinalStop && PRINCIPAL_STATIONS.includes(state.stationCode),
          },
        },
      },
    } satisfies CustomAnnouncementTab<IAtStationOptions>,
    disruption: {
      name: 'Delays & disruption',
      component: CustomAnnouncementPane,
      defaultState: {
        brand: 'fgw',
        disruptionType: 'running late',
        minutesLate: '5',
        reasonIntro: 'this is due to',
        reason: 'signalling problems',
        waitingFor: 'a platform at the next station',
        willContinue: true,
        terminatesAtCode: 'RDG',
        noLongerCallingAt: [],
        apologise: true,
        checkWithStaff: true,
        checkWebsite: false,
      },
      props: {
        playHandler: this.playDisruptionAnnouncement.bind(this),
        options: {
          brand: {
            name: 'Operator branding',
            type: 'select',
            default: 'fgw',
            options: BRAND_OPTIONS,
          },
          disruptionType: {
            name: 'Announcement',
            type: 'select',
            default: 'running late',
            options: [
              { title: 'Service is running approximately N minutes late', value: 'running late' },
              { title: 'Service has been delayed', value: 'delayed' },
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
          waitingFor: {
            name: 'Waiting for',
            type: 'select',
            default: 'a platform at the next station',
            options: this.WaitingForOptions,
            onlyShowWhen: state => state.disruptionType === 'waiting for',
          },
          terminatesAtCode: {
            name: 'Now terminates at',
            type: 'select',
            default: 'RDG',
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
          reasonIntro: {
            name: 'Reason wording',
            type: 'select',
            default: 'this is due to',
            options: [
              { title: 'No reason', value: 'none' },
              { title: 'This is due to…', value: 'this is due to' },
              { title: 'This is because of…', value: 'this is because of' },
            ],
            onlyShowWhen: state => ['running late', 'delayed', 'terminating early'].includes(state.disruptionType),
          },
          reason: {
            name: 'Reason',
            type: 'select',
            default: 'signalling problems',
            options: this.ReasonOptions,
            onlyShowWhen: state =>
              state.disruptionType === 'continuing delay' ||
              (['running late', 'delayed', 'terminating early'].includes(state.disruptionType) && state.reasonIntro !== 'none'),
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
          checkWebsite: {
            name: 'Check the website for further details',
            type: 'boolean',
            default: false,
            onlyShowWhen: state => state.disruptionType === 'terminating early',
          },
          apologise: {
            name: 'Apologise for the inconvenience',
            type: 'boolean',
            default: true,
            onlyShowWhen: state => state.disruptionType !== 'delayed',
          },
        },
      },
    } satisfies CustomAnnouncementTab<IDisruptionOptions>,
    dividingTrain: {
      name: 'Dividing train',
      component: CustomAnnouncementPane,
      defaultState: {
        divideAtCode: 'EXD',
        frontDestinationCode: 'PGN',
        rearDestinationCode: 'PLY',
      },
      props: {
        playHandler: this.playDividingTrainAnnouncement.bind(this),
        options: {
          divideAtCode: {
            name: 'Divides at',
            type: 'select',
            default: 'EXD',
            options: this.StationOptions,
          },
          frontDestinationCode: {
            name: 'Front coaches for',
            type: 'select',
            default: 'PGN',
            options: this.StationOptions,
          },
          rearDestinationCode: {
            name: 'Rear coaches for',
            type: 'select',
            default: 'PLY',
            options: this.StationOptions,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IDividingTrainOptions>,
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          'Safety & security': [
            { label: 'CCTV in operation', files: ['messages.this train is fitted with cctv'] },
            { label: 'Unattended luggage', files: ['messages.please do not leave any items of luggage unattended'] },
            { label: 'Safety posters in the vestibule', files: ['messages.safety information is on posters in the vestibule'] },
            { label: 'Tickets and travel documents ready', files: ['messages.please have your tickets and travel documents ready'] },
            { label: 'Take care stepping from the train', files: ['messages.please take care as you step from the train to the platform'] },
            {
              label: 'Do not board or alight when doors are closing',
              files: ['messages.please do not attempt to board or alight when the doors are closing'],
            },
            { label: 'Follow staff instructions', files: ['messages.please follow any instructions you are given by staff'] },
            { label: 'Use the lifts if travelling with luggage', files: ['messages.if you are travelling with luggage please use the lifts'] },
            { label: 'Tickets retained by automated gates', files: ['messages.tickets will be retained by the automated gates'] },
            { label: 'Taxis and buses signage', files: ['messages.for taxis and buses please follow signage'] },
            { label: 'Foot crossing: red light showing', files: ['messages.do not use the foot crossing when the red light is showing'] },
            {
              label: 'Foot crossing: wait until train has left',
              files: ['messages.do not use the foot crossing until this train has left the station'],
            },
            { label: 'Do not cross the railway line', files: ['messages.do not cross the railway line'] },
          ],
          Delays: [
            { label: 'Train is waiting here at the moment', files: ['messages.we apologise but the train is waiting here at the moment'] },
            { label: 'We will be moving as soon as we can', files: ['messages.we will be moving as soon as we can'] },
            { label: 'Driver is dealing with an incident', files: ['messages.the driver is currently dealing with an incident'] },
            { label: 'Service will continue as soon as possible', files: ['messages.this service will continue as soon as possible'] },
            { label: 'Apologise for the delay to this service', files: ['messages.we apologise for the delay to this service'] },
            { label: 'Apologise for the delay to your journey', files: ['messages.we apologise for the delay to your journey'] },
            { label: 'Apologise for the continued delay', files: ['messages.we apologise for the continued delay to this service'] },
            { label: 'Sorry for the delay to this service', files: ['messages.we are sorry for the delay to this service'] },
            { label: 'Apologise for the diversion', files: ['messages.we apologise for the diversion to your journey'] },
            { label: 'Thank you for your patience', files: ['messages.thank you for your patience'] },
            { label: 'Be patient and read the safety notices', files: ['messages.please be patient and read the safety notices'] },
            { label: 'Train will now end its service here', files: ['messages.we apologise but this train will now end its service here'] },
            { label: 'Check with station staff', files: ['messages.please check with station staff for alternative services'] },
            { label: 'See the display screens', files: ['messages.please see the display screens for further information'] },
          ],
          Crew: [
            { label: 'Train Manager contact the Driver', files: ['messages.will the train manager please contact the driver'] },
            { label: 'Guard contact the Driver', files: ['messages.will the guard please contact the driver'] },
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
            this.evacuationButton('rear'),
          ],
          'Sound effects': [
            { label: 'Announcement chime', files: ['fx.ann 999'] },
            { label: 'Delay chime', files: ['fx.delay'] },
            { label: 'Delay chime (75)', files: ['fx.delay 75'] },
            { label: 'Delay chime (100)', files: ['fx.delay 100'] },
          ],
          Miscellaneous: [
            { label: 'Thank you', files: ['messages.thank you'] },
            { label: 'Message on screen', files: ['messages.message on screen'] },
            { label: 'Coaches to Heathrow Airport', files: ['conjoiners.coaches to heathrow airport'] },
            { label: 'All Tube lines have a good service', files: ['messages.all tube lines from london paddington have a good service'] },
            { label: 'Check the TfL website', files: ['messages.please check tfl website for further information'] },
            { label: 'New timetable from 18 May 2014', files: ['brand.fgw.new timetable from 18 may 2014'] },
          ],
        },
      },
    } satisfies CustomButtonTab,
  }
}
