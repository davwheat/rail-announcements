import React from 'react'
import CustomAnnouncementPane from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { getStationByCrs } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import CallingAtSelector from '@components/CallingAtSelector'

interface IStartOfJourneyAnnouncementOptions {
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
}

export default class TfWTelevic extends TrainAnnouncementSystem {
  readonly NAME = 'Transport for Wales - Televic (Elin Llwyd & Eryl Jones)'
  readonly ID = 'TFW_TELEVIC_V1'
  readonly FILE_PREFIX = 'TfW/Televic'
  readonly SYSTEM_TYPE = 'train'

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

    files.push('intro.welcome on board', 'intro.we will be ready to depart for')
    files.push(`station.e.${callingAtCodes[callingAtCodes.length - 1].crsCode}`)

    files.push({ id: 'intro.calling at', opts: { delayStart: 300 } })
    files.push(...this.pluraliseStations(callingAtCodes.map(stn => stn.crsCode)))

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
      props: {
        playHandler: this.playStartOfJourneyAnnouncement.bind(this),
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
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          Safety: [
            {
              label: 'Security message',
              files: ['safety.security tell staff'],
            },
            {
              label: 'Familiarise yourself with safety information',
              files: ['safety.safety information'],
            },
          ],
          General: [
            {
              label: 'Bing Bong',
              files: ['fx.bing bong'],
            },
            {
              label: 'Jingle',
              files: ['fx.jingle'],
            },
          ],
        },
      },
    },
  }
}
