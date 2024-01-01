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

interface IStoppedAtStationAnnouncementOptions {
  thisStationCode: string
  terminatesAtCode: string
}

interface IDepartingStopAnnouncementOptions {
  nextStationCode: string
  terminatesHere: boolean
}

interface IApproachingStopAnnouncementOptions {
  nextStationCode: string
  gapType: 'gap' | 'step' | 'step down' | 'none'
}

export default class TfWTrainFx extends TrainAnnouncementSystem {
  readonly NAME = 'Transport for Wales - TrainFX'
  readonly ID = 'TFW_TRAINFX_V1'
  readonly FILE_PREFIX = 'TfW/TrainFX'
  readonly SYSTEM_TYPE = 'train'

  private async playStartOfJourneyAnnouncement(options: IStartOfJourneyAnnouncementOptions, download: boolean = false): Promise<void> {
    const { callingAtCodes } = options

    const files: AudioItem[] = []

    files.push('conjoiners.welcome aboard', {
      id: 'conjoiners.we will be calling at the following principal stations',
      opts: { delayStart: 750 },
    })

    files.push(
      ...this.pluraliseAudio(
        callingAtCodes.map(stn => stn.crsCode),
        { andId: 'conjoiners.and', prefix: 'stations.high.', finalPrefix: 'stations.low.' },
      ),
    )

    await this.playAudioFiles(files, download)
  }

  private async playStoppedAtStationAnnouncement(options: IStoppedAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { thisStationCode, terminatesAtCode } = options

    const files: AudioItem[] = []

    if (!this.validateStationExists(thisStationCode, 'high')) {
      return
    }

    files.push('conjoiners.we are now at', `stations.high.${thisStationCode}`)

    if (thisStationCode === terminatesAtCode) {
      files.push('conjoiners.our final station')
    } else {
      files.push(...this.getTerminationInfo(terminatesAtCode, 'high'))
    }

    await this.playAudioFiles(files, download)
  }

  private async playDepartingStopAnnouncement(options: IDepartingStopAnnouncementOptions, download: boolean = false): Promise<void> {
    const { nextStationCode, terminatesHere } = options

    const files: AudioItem[] = []

    if (!this.validateStationExists(nextStationCode, 'high')) {
      return
    }

    files.push(
      {
        id: 'conjoiners.the next stop is',
        opts: { delayStart: 750 },
      },
      `stations.high.${nextStationCode}`,
    )

    if (terminatesHere) {
      files.push('conjoiners.our final station')
    }

    files.push({
      id: 'conjoiners.thank you',
      opts: { delayStart: 750 },
    })

    await this.playAudioFiles(files, download)
  }

  private async playApproachingStopAnnouncement(options: IApproachingStopAnnouncementOptions, download: boolean = false): Promise<void> {
    const { nextStationCode, gapType } = options

    const files: AudioItem[] = []

    if (!this.validateStationExists(nextStationCode, 'high')) {
      return
    }

    files.push('conjoiners.we will shortly be arriving at slower', `stations.high.${nextStationCode}`, 'conjoiners.thank you')

    switch (gapType) {
      case 'none':
      default:
        break

      case 'gap':
        files.push('safety.gap between the train and the platform')
        break

      case 'step':
        files.push('safety.large step between train and platform')
        break

      case 'step down':
        files.push('safety.large step down from the train')
        break
    }

    await this.playAudioFiles(files, download)
  }

  getTerminationInfo(stationCode: string, pitch: 'high' | 'low', delay: number = 0): AudioItem[] {
    if (stationCode.startsWith('^^')) {
      // Custom destination message
      return this.AvailableDestinatons.find(d => d.label === stationCode.substring(2))?.customFiles ?? []
    }

    if (!this.validateStationExists(stationCode, pitch)) {
      return
    }

    return [{ id: 'conjoiners.this train is for', opts: { delayStart: delay } }, `stations.${pitch}.${stationCode}`]
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
    'CCC',
    'CDB',
    'CDF',
    'CDQ',
    'CDT',
    'CGN',
    'CGW',
    'CIM',
    'CKY',
    'CLR',
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

  readonly AvailableDestinatons: { label: string; customFiles?: AudioItem[]; divCrs?: string }[] = (
    [
      {
        label: 'Aberystwyth and Pwllheli, dividing Machynlleth',
        customFiles: ['dividing.AYW and PWL div MCN'],
        divCrs: 'SHR',
      },
      {
        label: 'Birmingham Intl, dividing Shrewsbury',
        customFiles: ['dividing.BHI div SHR'],
        divCrs: 'SHR',
      },
      {
        label: 'Birmingham New Street, dividing Shrewsbury',
        customFiles: ['dividing.BHM div SHR'],
        divCrs: 'SHR',
      },
      {
        label: 'Chester and Aberystwyth, dividing Shrewsbury',
        customFiles: ['dividing.CTR and AYW div SHR'],
        divCrs: 'CTR',
      },
      {
        label: 'Holyhead, dividing Chester',
        customFiles: ['dividing.HHD div CTR'],
        divCrs: 'CTR',
      },
      {
        label: 'Holyhead, dividing Llandudno Junction',
        customFiles: ['dividing.HHD div LLJ'],
        divCrs: 'LLJ',
      },
      {
        label: 'Holyhead, dividing Shrewsbury',
        customFiles: ['dividing.HHD div SHR'],
        divCrs: 'SHR',
      },
    ] as { label: string; customFiles?: AudioItem[]; divCrs?: string }[]
  ).concat(
    this.AllAvailableStationNames.map(crs => ({
      label: crs,
    })),
  )

  readonly AvailableDestinationOptions: { title: string; value: string }[] = this.AvailableDestinatons.map(item => {
    if (item.customFiles) {
      return {
        title: item.label,
        value: '^^' + item.label,
      }
    }

    return {
      title: getStationByCrs(item.label).stationName,
      value: item.label,
    }
  })

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab> = {
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
              availableStations: this.AvailableStationNames.high,
            },
            default: [],
          },
        },
      },
    },
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
            default: this.AvailableDestinationOptions[0].value,
            options: this.AvailableDestinationOptions,
            type: 'select',
          },
        },
      },
    },
    departingStop: {
      name: 'Departing stop',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playDepartingStopAnnouncement.bind(this),
        options: {
          nextStationCode: {
            name: 'Next station',
            default: this.AvailableStationItemMaps.high[0].value,
            options: this.AvailableStationItemMaps.high,
            type: 'select',
          },
          terminatesHere: {
            name: 'Terminates here',
            default: false,
            type: 'boolean',
          },
        },
      },
    },
    approachingStation: {
      name: 'Approaching stop',
      component: CustomAnnouncementPane,
      props: {
        playHandler: this.playApproachingStopAnnouncement.bind(this),
        options: {
          nextStationCode: {
            name: 'Next station',
            default: this.AvailableStationItemMaps.high[0].value,
            options: this.AvailableStationItemMaps.high,
            type: 'select',
          },
          gapType: {
            name: 'Gap type',
            default: 'none',
            options: [
              {
                title: 'None',
                value: 'none',
              },
              {
                title: 'Large step between',
                value: 'step',
              },
              {
                title: 'Large step down',
                value: 'step down',
              },
              {
                title: 'Gap between',
                value: 'gap',
              },
            ],
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
