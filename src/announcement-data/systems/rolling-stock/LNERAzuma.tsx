import React from 'react'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import TrainAnnouncementSystem from '../../TrainAnnouncementSystem'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'

interface IStoppedAtStationAnnouncementOptions {
  thisStationCode: string
  terminatesAtCode: string
  callingAtCodes: { crsCode: string; name: string; randomId: string }[]
  // mindTheGap: boolean
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {}

export default class LnerAzuma extends TrainAnnouncementSystem {
  readonly NAME = 'LNER Azuma'
  readonly ID = 'LNER_AZUMA_V1'
  readonly FILE_PREFIX = 'LNER/Azuma'
  readonly SYSTEM_TYPE = 'train'

  readonly ALL_STATIONS = [
    'AAP',
    'ABD',
    'ACK',
    'ALM',
    'APY',
    'ARB',
    'ARL',
    'AVM',
    'BDQ',
    'BEA',
    'BHI',
    'BHM',
    'BIA',
    'BIL',
    'BIW',
    'BIY',
    'BLA',
    'BPK',
    'BSE',
    'BSN',
    'BUH',
    'BWK',
    'CAG',
    'CAN',
    'CAR',
    'CBG',
    'CEY',
    'CFD',
    'CFL',
    'CHD',
    'CHT',
    'CLE',
    'CLM',
    'CLS',
    'COT',
    'CRM',
    'CRO',
    'CRS',
    'CTL',
    'CUP',
    'DAR',
    'DBL',
    'DBY',
    'DEE',
    'DEW',
    'DHM',
    'DHN',
    //'DHN_1',
    'DKN',
    'DLW',
    'DON',
    'DUN',
    'EAG',
    'EDB',
    'EDP',
    'EGY',
    'ELY',
    'FIL',
    'FKG',
    'FKK',
    'FPK',
    //'FPK_1',
    'GBL',
    'GLC',
    'GLE',
    'GLQ',
    'GMB',
    'GOO',
    'GRF',
    'GRN',
    'HAB',
    'HAT',
    'HBP',
    'HDY',
    'HEI',
    'HES',
    'HEW',
    'HEX',
    'HFN',
    'HGT',
    'HGY',
    'HIT',
    'HKM',
    'HMM',
    'HOW',
    'HPL',
    'HRN',
    'HRS',
    'HUD',
    'HUL',
    'HUN',
    'HYM',
    'INK',
    'INV',
    'IPS',
    'KBW',
    'KDY',
    'KEI',
    'KGX',
    'KIN',
    'KLF',
    'KNA',
    'KNO',
    'LAU',
    'LBT',
    'LCN',
    'LDS',
    'LEI',
    'LEU',
    'LIN',
    'LNZ',
    'LST',
    'MAN',
    'MAS',
    'MBR',
    'MCE',
    'MCH',
    'MHS',
    'MIK',
    'MIR',
    'MKR',
    'MLT',
    'MLY',
    'MNC',
    'MPT',
    'MTH',
    'MTS',
    'MUB',
    'NAY',
    'NCL',
    'NNG',
    'NOR',
    'NOT',
    'NRD',
    //'NRD_1',
    'NRW',
    'NTR',
    'NWR',
    'OKM',
    'PBO',
    'PBR',
    'PEG',
    'PFM',
    'PIC',
    'PIT',
    'PLN',
    'PMT',
    'PNL',
    'POP',
    'PTH',
    'RCC',
    'RET',
    'RMC',
    'RVN',
    'RYS',
    'SAE',
    'SBE',
    'SBY',
    'SCA',
    'SCU',
    'SDY',
    'SEA',
    'SEC',
    'SEM',
    'SFO',
    'SHD',
    'SHF',
    'SHY',
    'SKG',
    'SKI',
    'SLB',
    'SLR',
    'SMK',
    'SNO',
    'SON',
    'SPA',
    'SPF',
    'STA',
    'STG',
    'STK',
    'STN',
    'STP',
    'SUN',
    'SVG',
    'SWD',
    'TBY',
    'THI',
    'TTF',
    'TWM',
    'WAF',
    'WDD',
    'WET',
    'WGC',
    'WKE',
    'WKK',
    'WLW',
    'WMG',
    'WRK',
    'WTB',
    'YRK',
    'YRM',
  ]

  AvailableStationNames = {
    high: this.ALL_STATIONS,
    low: this.ALL_STATIONS,
  }

  private async playStoppedAtStationAnnouncement(options: IStoppedAtStationAnnouncementOptions, download: boolean = false): Promise<void> {
    const { thisStationCode, terminatesAtCode, callingAtCodes } = options

    const files: AudioItem[] = []

    files.push({ id: 'we are now at' }, { id: `station.${thisStationCode}`, opts: { delayStart: 150 } })

    if (thisStationCode === terminatesAtCode) {
      // End of journey
      files.push('where we finish our journey today', {
        id: 'on behalf of the onboard team thank you for travelling with lner',
        opts: { delayStart: 2000 },
      })
    } else {
      files.push(
        { id: 'hello and welcome on board this lner azuma to', opts: { delayStart: 5000 } },
        { id: `station.${terminatesAtCode}`, opts: { delayStart: 150 } },
        { id: `we will call at`, opts: { delayStart: 5000 } },
      )

      if (callingAtCodes.length === 0) {
        files.push(`station.${terminatesAtCode}`, 'only')
      } else {
        files.push(
          ...this.pluraliseAudio([...callingAtCodes.map(({ crsCode }) => `station.${crsCode}`), `station.${terminatesAtCode}`], {
            beforeAndDelay: 150,
            afterAndDelay: 150,
            beforeItemDelay: 100,
          }),
        )
      }

      const nextStation = callingAtCodes.at(0)?.crsCode ?? terminatesAtCode

      files.push({ id: 'the next station will be', opts: { delayStart: 3000 } }, { id: `station.${nextStation}`, opts: { delayStart: 150 } })
      files.push({ id: 'male.cctv is in operation', opts: { delayStart: 3000 } }, { id: 'male.btp 61016', opts: { delayStart: 3000 } })
    }

    await this.playAudioFiles(files, download)
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab> = {
    stoppedAtStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      props: {
        presets: announcementPresets.stopped,
        playHandler: this.playStoppedAtStationAnnouncement.bind(this),
        options: {
          thisStationCode: {
            name: 'This station',
            default: this.ALL_STATIONS[0],
            options: this.ALL_STATIONS.map(crsToStationItemMapper).map(({ crsCode, name }) => ({ value: crsCode, title: name })),
            type: 'select',
          },
          terminatesAtCode: {
            name: 'Terminates at',
            default: this.ALL_STATIONS[0],
            options: this.ALL_STATIONS.map(crsToStationItemMapper).map(({ crsCode, name }) => ({ value: crsCode, title: name })),
            type: 'select',
          },
          callingAtCodes: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: this.ALL_STATIONS,
            },
            default: [],
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
              label: 'BTP 61016',
              play: this.playAudioFiles.bind(this, ['male.btp 61016']),
              download: this.playAudioFiles.bind(this, ['male.btp 61016'], true),
            },
            {
              label: 'BTP 61016 (threat level critical)',
              play: this.playAudioFiles.bind(this, ['male.btp 61016 critical']),
              download: this.playAudioFiles.bind(this, ['male.btp 61016 critical'], true),
            },
            {
              label: 'CCTV is in use',
              play: this.playAudioFiles.bind(this, ['male.cctv is in operation']),
              download: this.playAudioFiles.bind(this, ['male.cctv is in operation'], true),
            },
          ],
        },
      },
    },
  }
}
