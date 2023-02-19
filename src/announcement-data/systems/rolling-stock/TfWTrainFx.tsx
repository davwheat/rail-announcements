import React from 'react'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AllStationsTitleValueMap, getStationByCrs } from '@data/StationManipulators'
import { AudioItem, AudioItemObject, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'

interface IApproachingStationAnnouncementOptions {
  stationCode: string
  isAto: boolean
  terminatesHere: boolean
  takeCareAsYouLeave: boolean
  changeFor: string[]
}

interface IStoppedAtStationAnnouncementOptions {
  thisStationCode: string
  terminatesAtCode: string
}

interface IInitialDepartureAnnouncementOptions {
  terminatesAtCode: string
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
  isSoutheastern: boolean
}

// const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
//   stopped: [
//     {
//       name: 'Burgess Hill to Brighton',
//       state: {
//         thisStationCode: 'BUG',
//         terminatesAtCode: 'BTN',
//         callingAtCodes: ['HSK', 'PRP'].map(crsToStationItemMapper),
//         mindTheGap: true,
//       },
//     },
//   ],
// }

export default class TfWTrainFx extends TrainAnnouncementSystem {
  readonly NAME = 'Transport for Wales - TrainFX'
  readonly ID = 'TFW_TRAINFX_V1'
  readonly FILE_PREFIX = 'TfW/TrainFX'
  readonly SYSTEM_TYPE = 'train'

  private async playStoppedAtStationAnnouncement(options: IStoppedAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { thisStationCode, terminatesAtCode } = options

    const files: AudioItem[] = []

    if (!this.validateStationExists(thisStationCode, 'high') || !this.validateStationExists(terminatesAtCode, 'high')) {
      return
    }

    files.push('conjoiners.we are now at', `stations.high.${thisStationCode}`)

    if (thisStationCode === terminatesAtCode) {
      files.push('conjoiners.our final station')
    } else {
      files.push(
        {
          id: 'conjoiners.this train is for',
          opts: { delayStart: 750 },
        },
        `stations.high.${terminatesAtCode}`,
      )
    }

    await this.playAudioFiles(files, download)
  }

  readonly AllAvailableStationNames: string[] = [
    'ABA',
    'ABE',
    'ABH',
    'ACY',
    'AGL',
    'AGV',
    'ALB',
    'ALD',
    'AMF',
    'AVY',
    'AYW',
    'BAJ',
    'BBK',
    'BCG',
    'BCK',
    'BGD',
    'BGN',
    'BHD',
    'BHI',
    'BHM',
    'BHR',
    'BID',
    'BME',
    'BNF',
    'BNG',
    'BOR',
    'BOW',
    'BRH',
    'BRM',
    'BRY',
    'BUK',
    'BYD',
    'BYE',
    'BYI',
    'CAD',
    'CBR',
    'CCC',
    'CDB',
    'CDF',
    'CDQ',
    'CDT',
    'CGN',
    'CGW',
    'CIM',
    'CKY',
    'CMH',
    'CMN',
    'CNM',
    'CNW',
    'COS',
    'COY',
    'CPH',
    'CPW',
    'CRE',
    'CRK',
    'CRV',
    'CSL',
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
    'DMG',
    'DNS',
    'DOL',
    'DVY',
    'DYF',
    'EBB',
    'EBK',
    'EBV',
    'ECP',
    'EDY',
    'ERL',
    'FER',
    'FFA',
    'FGH',
    'FGW',
    'FLN',
    'FRB',
    'FRD',
    'FRW',
    'FYS',
    'GCR',
    'GFF',
    'GMG',
    'GOB',
    'GTH',
    'GTN',
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
    'HVF',
    'HWB',
    'HWD',
    'JOH',
    'KGT',
    'KNI',
    'KNU',
    'KWL',
    'LAM',
    'LAS',
    'LBR',
    'LDN',
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
    'LTH',
    'LUD',
    'LVT',
    'LWM',
    'LYD',
    'MAN',
    'MCN',
    'MCO',
    'MCV',
    'MER',
    'MEV',
    'MEW',
    'MFA',
    'MFF',
    'MFH',
    'MIA',
    'MRB',
    'MST',
    'MTA',
    'NAN',
    'NAR',
    'NBE',
    'NES',
    'NLW',
    'NNP',
    'NTH',
    'NWP',
    'NWT',
    'OKN',
    'PBY',
    'PCD',
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
    'QYD',
    'RCA',
    'RDR',
    'RHI',
    'RHL',
    'RHO',
    'RHY',
    'RIA',
    'ROR',
    'RUA',
    'RUE',
    'RUN',
    'SDF',
    'SFN',
    'SGB',
    'SHR',
    'SHT',
    'SKE',
    'SPT',
    'SRR',
    'STA',
    'STJ',
    'SUG',
    'SWA',
    'SYB',
    'TAF',
    'TAL',
    'TDU',
    'TEN',
    'TFC',
    'TGS',
    'TIR',
    'TLB',
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
    'YNW',
    'YRT',
    'YSM',
    'YSR',
  ]

  readonly AvailableStationNames = {
    low: this.AllAvailableStationNames,
    high: this.AllAvailableStationNames,
  }

  readonly AvailableStationItemMaps = {
    low: this.AllAvailableStationNames.map(crsToStationItemMapper).map(item => ({ value: item.crsCode, title: item.name })),
    high: this.AllAvailableStationNames.map(crsToStationItemMapper).map(item => ({ value: item.crsCode, title: item.name })),
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab> = {
    stoppedAtStation: {
      name: 'At station',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playStoppedAtStationAnnouncement.bind(this),
        options: {
          thisStationCode: {
            name: 'This station',
            default: this.AvailableStationItemMaps.high[0].value,
            options: this.AvailableStationItemMaps.high,
            type: 'select',
          },
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.AvailableStationItemMaps.high[0].value,
            options: this.AvailableStationItemMaps.high,
            type: 'select',
          },
          // callingAtCodes: {
          //   name: '',
          //   type: 'custom',
          //   component: CallingAtSelector,
          //   props: {
          //     availableStations: this.AllAvailableStationNames,
          //   },
          //   default: [],
          // },
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
