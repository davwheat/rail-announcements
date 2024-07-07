import React from 'react'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { getStationByCrs } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import CallingAtSelector from '@components/CallingAtSelector'

interface IStartOfJourneyAnnouncementOptions {
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
}

interface IStoppedAtStationAnnouncementOptions {
  thisStation: string
  terminus: string
  isTerminusNext: boolean
}

export default class TfWTelevic extends TrainAnnouncementSystem {
  readonly NAME = 'Transport for Wales - Televic (Elin Llwyd & Eryl Jones)'
  readonly ID = 'TFW_TELEVIC_V1'
  readonly FILE_PREFIX = 'TfW/Televic'
  readonly SYSTEM_TYPE = 'train'

  private readonly announcementPresets: Readonly<
    Record<string, ICustomAnnouncementPreset<IStartOfJourneyAnnouncementOptions | IStoppedAtStationAnnouncementOptions>[]>
  > = {
    startOfJourney: [
      {
        name: 'CDF to BYI',
        state: {
          callingAtCodes: ['GTN', 'CGN', 'EBK', 'DNS', 'CAD', 'BYD', 'BRY', 'BYI'].map(crsToStationItemMapper),
        },
      },
    ],
    stoppedAtStation: [
      {
        name: 'BRY, next BYI',
        state: {
          thisStation: 'BRY',
          terminus: 'BYI',
          isTerminusNext: true,
        },
      },
    ],
  }

  readonly AvailableStations: string[] = [
    'ABA',
    'ABE',
    'ABH',
    'ACY',
    'AGL',
    'AGV',
    'ALB',
    'ALD',
    'AMF',
    'ASC',
    'AVY',
    'AYW',
    'BAJ',
    'BBK',
    'BCG',
    'BCK',
    'BFF',
    'BFR',
    'BGD',
    'BGN',
    'BHD',
    'BHI',
    'BHM',
    'BHR',
    'BID',
    'BKC',
    'BKN',
    'BKP',
    'BKQ',
    'BME',
    'BNF',
    'BNG',
    'BOR',
    'BOW',
    'BPN',
    'BPS',
    'BPW',
    'BRH',
    'BRI',
    'BRM',
    'BRY',
    'BTH',
    'BUK',
    'BYC',
    'BYD',
    'BYE',
    'BYI',
    'CAD',
    'CCC',
    'CDB',
    'CDF',
    'CDQ',
    'CDT',
    'CGN',
    'CGW',
    'CHX',
    'CIM',
    'CKY',
    'CLR',
    'CMH',
    'CMN',
    'CNM',
    'CNN',
    'CNW',
    'COS',
    'COY',
    'CPH',
    'CPW',
    'CRE',
    'CRK',
    'CRV',
    'CSL',
    'CST',
    'CTR',
    'CTT',
    'CUW',
    'CWB',
    'CWM',
    'CWS',
    'CYB',
    'CYN',
    'CYS',
    'DCT',
    'DGL',
    'DGT',
    'DGY',
    'DID',
    'DLG',
    'DMG',
    'DNS',
    'DOL',
    'DVY',
    'DWD',
    'DYF',
    'EBB',
    'EBK',
    'EBV',
    'ECC',
    'ECP',
    'EDA',
    'EDB',
    'EDP',
    'EDY',
    'ERL',
    'EUS',
    'FER',
    'FFA',
    'FGH',
    'FGW',
    'FLN',
    'FRB',
    'FRD',
    'FRW',
    'FST',
    'FYS',
    'GCR',
    'GCW',
    'GFF',
    'GGT',
    'GLC',
    'GMG',
    'GOB',
    'GTH',
    'GTN',
    'GTW',
    'GWE',
    'GWN',
    'HFD',
    'HHD',
    'HHL',
    'HLL',
    'HNG',
    'HPE',
    'HPT',
    'HRL',
    'HSB',
    'HSW',
    'HTR',
    'HVF',
    'HWB',
    'HWD',
    'HWV',
    'HXX',
    'JOH',
    'KGT',
    'KGX',
    'KNI',
    'KNU',
    'KWL',
    'LAM',
    'LAN',
    'LAS',
    'LBR',
    'LDN',
    'LEI',
    'LEO',
    'LGO',
    'LIV',
    'LLA',
    'LLC',
    'LLD',
    'LLE',
    'LLF',
    'LLG',
    'LLH',
    'LLI',
    'LLJ',
    'LLL',
    'LLM',
    'LLN',
    'LLO',
    'LLR',
    'LLS',
    'LLT',
    'LLV',
    'LLW',
    'LLY',
    'LNB',
    'LNR',
    'LNW',
    'LPG',
    'LPY',
    'LST',
    'LTH',
    'LUD',
    'LVC',
    'LVJ',
    'LVT',
    'LWM',
    'LWR',
    'LYD',
    'MAN',
    'MCN',
    'MCO',
    'MER',
    'MEV',
    'MEW',
    'MFA',
    'MFF',
    'MFH',
    'MIA',
    'MKC',
    'MRB',
    'MST',
    'MTA',
    'MYB',
    'NAN',
    'NAR',
    'NBE',
    'NES',
    'NLR',
    'NLW',
    'NNP',
    'NRW',
    'NTH',
    'NWP',
    'NWT',
    'OKN',
    'OXF',
    'PAD',
    'PBY',
    'PCD',
    'PDK',
    'PEN',
    'PER',
    'PES',
    'PGM',
    'PHG',
    'PLT',
    'PMB',
    'PMD',
    'PMW',
    'PNA',
    'PNC',
    'PNF',
    'PNY',
    'POR',
    'PPD',
    'PPL',
    'PRH',
    'PRS',
    'PRT',
    'PTA',
    'PTB',
    'PTD',
    'PTF',
    'PTM',
    'PWL',
    'PYC',
    'PYE',
    'PYL',
    'PYP',
    'QYD',
    'RCA',
    'RDR',
    'RHI',
    'RHL',
    'RHO',
    'RHY',
    'RIA',
    // 'RIA2',
    'RMB',
    'ROR',
    'RUA',
    'RUE',
    'RUN',
    'SAL',
    'SDF',
    'SFN',
    'SGB',
    'SHT',
    'SKE',
    'SPT',
    'SRR',
    'STA',
    'STJ',
    'STP',
    'SUG',
    'SWA',
    'TAF',
    'TAL',
    'TDU',
    'TEN',
    'TFC',
    'TGS',
    'TIR',
    'TLB',
    'TLC',
    'TNF',
    'TNP',
    'TPN',
    'TRB',
    'TRD',
    'TRE',
    'TRF',
    'TRH',
    'TRY',
    'TYC',
    'TYG',
    'TYW',
    'UPT',
    'VAL',
    'VIC',
    'WAE',
    'WAT',
    'WBQ',
    'WEM',
    'WHT',
    'WLN',
    'WLP',
    'WMI',
    'WML',
    'WNG',
    'WRE',
    'WRX',
    'WTC',
    'WTL',
    'WVH',
    'WXC',
    'XPB',
    'YNW',
    'YRK',
    'YRT',
    'YSM',
    'YSR',
  ]

  readonly AdditionalOptions = [
    'Acton Grange Junction',
    'Astley',
    'Beeston Castle & Tarporley Signal Box',
    'Birkenhead',
    'Chester South Junction',
    'Crewe Steel Works',
    'Dallam Junction',
    'Frodsham Junction',
    'Gaerwen',
    'Menai Bridge',
    'Mickle Trafford',
    'Moston East Junction',
    'Ordsall Lane Junction',
    'Parkside Junction',
    'Saltney Junction',
    'Tan-y-Bwlch Ffestiniog',
    'Waterstreet Junction',
    'Winwick Junction',
  ].map(n => ({ title: n, value: n }))

  readonly StationsAsItems = this.AvailableStations.map(crsToStationItemMapper)
    .map(s => ({
      title: s.name,
      value: s.crsCode,
    }))
    .concat(this.AdditionalOptions)

  private multiLingual(audio: AudioItem[]): AudioItem[] {
    const cy = audio.map(a => {
      if (typeof a === 'string') return `cy.${a}`

      return { ...a, id: `cy.${a.id}` }
    })
    const en = audio.map(a => {
      if (typeof a === 'string') return `en.${a}`

      return { ...a, id: `en.${a.id}` }
    })

    let enFirst = en.shift()!!

    if (typeof enFirst === 'string') {
      enFirst = {
        id: enFirst,
        opts: { delayStart: 750 },
      }
    } else {
      enFirst.opts ||= {}
      enFirst.opts.delayStart = 750
    }

    return [...cy, enFirst, ...en]
  }

  private async playStartOfJourneyAnnouncement(options: IStartOfJourneyAnnouncementOptions, download: boolean = false): Promise<void> {
    const { callingAtCodes } = options
    if (callingAtCodes.length === 0) {
      alert('Please select at least one station to call at.')
      return
    }

    const files: AudioItem[] = []

    files.push('intro.start.welcome on board', 'intro.start.we will be ready to depart for')
    files.push(`station.e.${callingAtCodes[callingAtCodes.length - 1].crsCode}`)

    files.push({ id: 'intro.start.calling at', opts: { delayStart: 300 } })
    files.push(...this.pluraliseStations(callingAtCodes.map(stn => stn.crsCode)))

    await this.playAudioFiles(this.multiLingual(files), download)
  }

  private async playStoppedAtAnnouncement(options: IStoppedAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { terminus, isTerminusNext, thisStation } = options

    const files: AudioItem[] = []

    files.push('intro.arrived.welcome to', `station.e.${thisStation}`, 'intro.arrived.thank you for travelling with transport for wales')

    if (terminus !== thisStation) {
      if (isTerminusNext) {
        files.push(
          'intro.final.we will be travelling to',
          `station.m.${terminus}`,
          'intro.final.only',
          'intro.final.the next station will be our final stop',
        )
      } else {
        files.push('intro.mid.we will be travelling to', `station.e.${terminus}`)
      }
    }

    await this.playAudioFiles(this.multiLingual(files), download)
  }

  private pluraliseStations(stationAudioIds: string[]): AudioItem[] {
    if (stationAudioIds.length === 1) {
      return [`station.e.${stationAudioIds[0]}`]
    }

    return stationAudioIds.map((id, i, arr) => {
      return {
        id: `station.${arr.length - 1 === i ? 'and' : 'm'}.${id}`,
        opts: {
          delayStart: 100,
        },
      }
    })
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab<string>> = {
    startOfJourney: {
      name: 'Start of journey',
      component: CustomAnnouncementPane,
      defaultState: {
        callingAtCodes: [],
      },
      props: {
        playHandler: this.playStartOfJourneyAnnouncement.bind(this),
        presets: this.announcementPresets.startOfJourney,
        options: {
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              selectLabel: 'Calling at',
              placeholder: 'Add a station…',
              heading: 'Calling at… (incl. terminus)',
              availableStations: this.AvailableStations,
              additionalOptions: this.AdditionalOptions,
            },
            default: [],
          },
        },
      },
    } as CustomAnnouncementTab<keyof IStartOfJourneyAnnouncementOptions>,
    stoppedAtStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      defaultState: {
        thisStation: this.StationsAsItems[0].value,
        terminus: this.StationsAsItems[0].value,
        isTerminusNext: false,
      },
      props: {
        playHandler: this.playStoppedAtAnnouncement.bind(this),
        presets: this.announcementPresets.stoppedAtStation,
        options: {
          thisStation: {
            name: 'This station',
            default: this.StationsAsItems[0].value,
            options: this.StationsAsItems,
            type: 'select',
          },
          terminus: {
            name: 'Terminus',
            default: this.StationsAsItems[0].value,
            options: this.StationsAsItems,
            type: 'select',
          },
          isTerminusNext: {
            name: 'Is terminus next?',
            default: false,
            type: 'boolean',
          },
        },
      },
    } as CustomAnnouncementTab<keyof IStoppedAtStationAnnouncementOptions>,
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          Safety: [
            {
              label: 'BTP 61016',
              files: this.multiLingual(['generic.btp 61016']),
            },
            {
              label: 'BTP 61016 (Critical)',
              files: this.multiLingual(['generic.btp 61016 critical']),
            },
            {
              label: 'CCTV is in use',
              files: this.multiLingual(['generic.cctv is in use']),
            },
            {
              label: 'Dangers of high voltage',
              files: this.multiLingual(['generic.dangers of high voltage']),
            },
            {
              label: 'Take care due to weather',
              files: this.multiLingual(['generic.take care when leaving due to weather']),
            },
          ],
          General: [
            {
              label: 'Buy tickets from TfW',
              files: this.multiLingual(['generic.buy tickets from tfw']),
            },
            {
              label: 'Delay repay',
              files: this.multiLingual(['generic.delay repay']),
            },
            {
              label: 'Feet on seats',
              files: this.multiLingual(['generic.feet on seats']),
            },
            {
              label: 'Ticket inspection',
              files: this.multiLingual(['generic.have tickets ready for inspection']),
            },
            {
              label: 'Keep luggage off seats',
              files: this.multiLingual(['generic.make sure luggage is removed from seats']),
            },
            {
              label: 'Clear aisle for catering',
              files: this.multiLingual(['generic.make sure the aisles are free for catering']),
            },
            {
              label: 'Clear wheelchair space',
              files: this.multiLingual(['generic.make sure wheelchair space is kept clear']),
            },
            {
              label: 'Penalty fares',
              files: this.multiLingual(['generic.penalty fares']),
            },
            {
              label: 'Keep belongings with you',
              files: this.multiLingual(['generic.please keep your belongings with you']),
            },
            {
              label: 'Mind the gap',
              files: this.multiLingual(['generic.please mind the gap between the train at the platform']),
            },
            {
              label: 'No smoking or vaping',
              files: this.multiLingual(['generic.smoking or vaping is not allowed on trains or at station']),
            },
            {
              label: 'Busy trains due to event',
              files: this.multiLingual(['generic.trains may be busier due to an event']),
            },
          ],
        },
      },
    },
  }
}
