import React from 'react'

import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import CallingAtSelector, { CallingAtPoint, ICallingAtSelectorProps } from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import { getStationByCrs } from '@data/StationManipulators'
import crsToStationItemMapper, { stationItemCompleter } from '@helpers/crsToStationItemMapper'
import { AudioItem, CustomAnnouncementButton, CustomAnnouncementTab } from '../../AnnouncementSystem'
import DelayCodeMapping from './DarwinDelayCodes_Male1.json'
import NamedServices from './named-services.json'

import type { RttResponse } from '../../../../functions/api/get-service-rtt'
import { RttUtils } from '@data/RttUtils'

export type ChimeType = 'three' | 'four' | 'none'
export type FirstClassLocation = 'none' | 'front' | 'middle' | 'rear'

export interface INextTrainAnnouncementOptions {
  chime: ChimeType
  platform: string
  hour: string
  min: string
  isDelayed: boolean
  toc: string
  terminatingStationCode: string
  vias: CallingAtPoint[]
  callingAt: CallingAtPoint[]
  firstClassLocation: FirstClassLocation
  coaches: string
  announceShortPlatformsAfterSplit: boolean
  notCallingAtStations: { crsCode: string }[]
}

export interface IStandingTrainAnnouncementOptions extends Omit<INextTrainAnnouncementOptions, 'chime'> {
  thisStationCode: string
  mindTheGap: boolean
}

export interface IDisruptedTrainAnnouncementOptions {
  chime: ChimeType
  hour: string
  min: string
  toc: string
  terminatingStationCode: string
  vias: CallingAtPoint[]
  disruptionType: 'delay' | 'delayedBy' | 'cancel'
  disruptionReason: string | string[]
  delayTime: string
}

interface IFastTrainAnnouncementOptions {
  chime: ChimeType
  daktronicsFanfare: boolean
  platform: string
  fastTrainApproaching: boolean
}

export interface ITrainApproachingAnnouncementOptions {
  chime: ChimeType
  platform: string
  hour: string
  min: string
  isDelayed: boolean
  toc: string
  terminatingStationCode: string
  vias: CallingAtPoint[]
  originStationCode: string
}

export interface IPlatformAlterationAnnouncementOptions {
  chime: ChimeType
  announceOldPlatform: boolean
  oldPlatform: string
  newPlatform: string
  hour: string
  min: string
  isDelayed: boolean
  toc: string
  terminatingStationCode: string
  vias: CallingAtPoint[]
  callingAt?: CallingAtPoint[]
}

export interface ILivePlatformAlterationAnnouncementOptions {
  chime: ChimeType
  announceOldPlatform: boolean
  oldPlatform: string
  newPlatform: string
  hour: string
  min: string
  isDelayed: boolean
  toc: string
  terminatingStationCode: string[]
  vias: CallingAtPoint[][]
  callingAt?: CallingAtPoint[]
  coaches: string
  fromLive: true
}

export interface ILiveTrainApproachingAnnouncementOptions {
  chime: ChimeType
  platform: string
  hour: string
  min: string
  isDelayed: boolean
  toc: string
  terminatingStationCode: string[]
  vias: CallingAtPoint[][]
  originStationCode: string
  callingAt?: CallingAtPoint[]
  fromLive: true
}

interface SplitInfoStop {
  crsCode: string
  shortPlatform: string
  requestStop: boolean
  portion: {
    position: 'any' | 'front' | 'middle' | 'rear' | 'unknown'
    length: number | null
  }
}

export default class AmeyPhil extends StationAnnouncementSystem {
  readonly NAME: string = 'Amey/Ditra - Phil Sayer'
  readonly ID: string = 'AMEY_PHIL_V1'
  readonly FILE_PREFIX: string = 'station/ketech/phil'
  readonly SYSTEM_TYPE = 'station'

  protected readonly BEFORE_TOC_DELAY: number = 150
  protected readonly BEFORE_SECTION_DELAY: number = 550
  protected readonly SHORT_DELAY: number = 500

  readonly DelayCodeMapping: Record<string, { e: string; m: string }> = DelayCodeMapping

  protected readonly genericOptions = {
    platform: 's.platform-2',
    platformZeroM: 'm.0',
    // No end inflection
    platformZeroE: 'm.0',
  }

  protected readonly callingPointsOptions = {
    beforeCallingAtDelay: 870,
    afterCallingAtDelay: 0,
    betweenStopsDelay: 320,
    aroundAndDelay: 100,
    rrbTerminateAudio: 'e.where the train will then terminate due to engineering work',
  }

  protected readonly requestStopOptions = {
    andId: 'm.or-2',
  }

  protected readonly shortPlatformOptions = {
    unknownLocation: 'w.please listen for announcements on board the train',
  }

  protected readonly standingOptions = {
    thisIsId: 's.this is',
    nowStandingAtId: 's.the train now standing at platform',
  }

  get DEFAULT_CHIME(): ChimeType {
    return 'four'
  }

  protected get announcementPresets(): Readonly<{
    nextTrain: ICustomAnnouncementPreset<
      INextTrainAnnouncementOptions & IStandingTrainAnnouncementOptions & IPlatformAlterationAnnouncementOptions
    >[]
    disruptedTrain: ICustomAnnouncementPreset<IDisruptedTrainAnnouncementOptions>[]
  }> {
    const presets: {
      nextTrain: ICustomAnnouncementPreset<
        INextTrainAnnouncementOptions & IStandingTrainAnnouncementOptions & IPlatformAlterationAnnouncementOptions
      >[]
      disruptedTrain: ICustomAnnouncementPreset<IDisruptedTrainAnnouncementOptions>[]
    } = {
      nextTrain: [
        {
          name: '12:28 | SN Littlehampton to Brighton',
          state: {
            chime: this.DEFAULT_CHIME,
            isDelayed: false,
            platform: '2',
            newPlatform: '3',
            oldPlatform: '2',
            announceOldPlatform: true,
            hour: '12',
            min: '28',
            toc: 'southern',
            terminatingStationCode: 'BTN',
            vias: [],
            callingAt: ['ANG', 'GBS', 'DUR', 'WWO', 'WRH', 'SWK', 'PLD', 'HOV'].map(crsToStationItemMapper),
            coaches: '8 coaches',
            mindTheGap: true,
            thisStationCode: 'LIT',
            firstClassLocation: 'none',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
        {
          name: '16:05 | SN Victoria to Portsmouth & Bognor',
          state: {
            chime: this.DEFAULT_CHIME,
            isDelayed: false,
            platform: '12',
            newPlatform: '13',
            oldPlatform: '12',
            announceOldPlatform: true,
            hour: '16',
            min: '05',
            toc: 'southern',
            terminatingStationCode: 'PMS',
            vias: [],
            callingAt: [
              'CLJ',
              'ECR',
              'GTW',
              'TBD',
              'CRW',
              {
                crsCode: 'HRH',
                splitType: 'splits' as const,
                splitForm: 'rear.4',
                splitCallingPoints: ['CHH', 'BIG', 'PUL', 'AMY', 'ARU', 'FOD', 'BAA', 'BOG'].map(crsToStationItemMapper),
              },
              'BAA',
              'CCH',
              'FSB',
              'BOH',
              'SOB',
              'EMS',
              'HAV',
              'FTN',
            ].map(stationItemCompleter),
            coaches: '8 coaches',
            mindTheGap: false,
            thisStationCode: 'VIC',
            firstClassLocation: 'none',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
        {
          name: '17:15 | GX Brighton to London Victoria',
          state: {
            chime: this.DEFAULT_CHIME,
            isDelayed: false,
            platform: '5',
            newPlatform: '4',
            oldPlatform: '5',
            announceOldPlatform: true,
            hour: '17',
            min: '15',
            toc: 'gatwick express',
            terminatingStationCode: 'VIC',
            vias: ['GTW'].map(crsToStationItemMapper),
            callingAt: ['PRP', 'HSK', 'BUG', 'HHE', 'GTW'].map(crsToStationItemMapper),
            coaches: '8 coaches',
            mindTheGap: false,
            thisStationCode: 'BTN',
            firstClassLocation: 'none',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
        {
          name: '11:18 | VT Euston to Edinburgh',
          state: {
            chime: this.DEFAULT_CHIME,
            thisStationCode: 'WFJ',
            isDelayed: false,
            platform: '6',
            newPlatform: '5',
            oldPlatform: '6',
            announceOldPlatform: true,
            hour: '11',
            min: '18',
            toc: 'virgin pendolino',
            terminatingStationCode: 'EDB',
            vias: ['BHM'].map(crsToStationItemMapper),
            callingAt: [
              'MKC',
              'RUG',
              'COV',
              'BHI',
              'BHM',
              'SAD',
              'WVH',
              'STA',
              'CRE',
              'WBQ',
              'WGN',
              'PRE',
              'LAN',
              'PNR',
              'CAR',
              { crsCode: 'HYM', shortPlatform: 'front.9' },
            ].map(stationItemCompleter),
            coaches: '11 coaches',
            mindTheGap: false,
            firstClassLocation: 'rear',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
        {
          name: '13:15 | VT Manchester to Euston',
          state: {
            chime: this.DEFAULT_CHIME,
            isDelayed: false,
            platform: '6',
            newPlatform: '5',
            oldPlatform: '6',
            announceOldPlatform: true,
            hour: '13',
            min: '15',
            toc: 'virgin pendolino',
            terminatingStationCode: 'EUS',
            vias: [],
            callingAt: ['SPT', 'MAC', 'SOT', 'RUG', 'MKC'].map(stationItemCompleter),
            coaches: '9 coaches',
            mindTheGap: false,
            thisStationCode: 'MAN',
            firstClassLocation: 'front',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
        {
          name: '08:20 | XC Aberdeen to Penzance',
          state: {
            chime: this.DEFAULT_CHIME,
            isDelayed: false,
            platform: '3',
            newPlatform: '2',
            oldPlatform: '3',
            announceOldPlatform: true,
            hour: '08',
            min: '20',
            toc: 'crosscountry',
            terminatingStationCode: 'PNZ',
            vias: ['LDS'].map(crsToStationItemMapper),
            callingAt: [
              'STN',
              'MTS',
              'ARB',
              'DEE',
              'LEU',
              'CUP',
              'LDY',
              'MNC',
              'KDY',
              'INK',
              'HYM',
              'EDB',
              'BWK',
              'ALM',
              'NCL',
              'DHM',
              'DAR',
              'YRK',
              'LDS',
              'WKF',
              'SHF',
              'DBY',
              'BUT',
              'BHM',
              'CNM',
              'BPW',
              'BRI',
              'TAU',
              'TVP',
              'EXD',
              'NTA',
              'TOT',
              'PLY',
              'LSK',
              'BOD',
              'SAU',
              'TRU',
              'RED',
              'SER',
            ].map(crsToStationItemMapper),
            coaches: '5 coaches',
            mindTheGap: false,
            thisStationCode: 'ABD',
            firstClassLocation: 'front',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
        {
          // http://www.1s76.com/1S76%202008.htm
          name: '08:20 | 1O23 XC Manchester to Brighton (2008)',
          state: {
            chime: this.DEFAULT_CHIME,
            isDelayed: false,
            platform: '3',
            newPlatform: '2',
            oldPlatform: '3',
            announceOldPlatform: false,
            hour: '08',
            min: '20',
            toc: 'crosscountry',
            terminatingStationCode: 'BTN',
            vias: ['BHM', 'KPA'].map(crsToStationItemMapper),
            callingAt: ['SPT', 'MAC', 'CNG', 'SOT', 'WVH', 'BHM', 'LMS', 'BAN', 'OXF', 'RDG', 'KPA', 'ECR', 'GTW', 'HHE'].map(
              crsToStationItemMapper,
            ),
            coaches: '5 coaches',
            mindTheGap: false,
            thisStationCode: 'MAN',
            firstClassLocation: 'front',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
        {
          name: '18:07 | Chiltern MYB - Stourbridge',
          state: {
            chime: this.DEFAULT_CHIME,
            isDelayed: false,
            platform: '2',
            newPlatform: '4',
            oldPlatform: '2',
            announceOldPlatform: false,
            hour: '18',
            min: '07',
            toc: 'chiltern railways',
            terminatingStationCode: 'SBJ',
            vias: [],
            callingAt: ['HDM', 'BCS', 'BAN', 'LMS', 'WRW', 'WRP', 'DDG', 'SOL', 'BMO', 'BSW', 'ROW'].map(crsToStationItemMapper),
            coaches: '5 coaches',
            mindTheGap: false,
            thisStationCode: 'MYB',
            firstClassLocation: 'none',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
        {
          name: '12:50 | SN Eastbourne - Ashford',
          state: {
            chime: this.DEFAULT_CHIME,
            thisStationCode: 'EBN',
            isDelayed: false,
            platform: '2',
            newPlatform: '3',
            oldPlatform: '2',
            announceOldPlatform: false,
            hour: '12',
            min: '50',
            toc: 'southern',
            terminatingStationCode: 'AFK',
            vias: [],
            callingAt: [
              'HMD',
              'COB',
              'PEV',
              'CLL',
              'BEX',
              'SLQ',
              'HGS',
              'ORE',
              { crsCode: 'TOK', shortPlatform: 'front.1' },
              'WSE',
              'RYE',
              { crsCode: 'APD', shortPlatform: 'front.2' },
              'HMT',
            ].map(stationItemCompleter),
            coaches: '3 coaches',
            mindTheGap: false,
            firstClassLocation: 'none',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
        {
          name: 'Elizabeth | PAD to ABW',
          state: {
            chime: 'four',
            platform: 'a',
            newPlatform: 'b',
            oldPlatform: 'a',
            announceOldPlatform: true,
            hour: '12',
            min: '04',
            thisStationCode: 'PAD',
            isDelayed: false,
            toc: '',
            terminatingStationCode: 'ABW',
            vias: ['CWX'].map(crsToStationItemMapper),
            callingAt: ['BDS', 'TCR', 'ZFD', 'LST', 'ZLW', 'CWX', 'CUS', 'WWC'].map(crsToStationItemMapper),
            coaches: '9 coaches',
            mindTheGap: false,
            firstClassLocation: 'none',
            announceShortPlatformsAfterSplit: false,
            notCallingAtStations: [],
          },
        },
      ],
      disruptedTrain: [
        {
          name: '21:39 +44 | SN Havant to SOU',
          // Modelled on https://www.realtimetrains.co.uk/service/gb-nr:Y50425/2023-11-24/detailed
          state: {
            chime: this.DEFAULT_CHIME,
            hour: '21',
            min: '39',
            toc: 'southern',
            terminatingStationCode: 'SOU',
            vias: ['FRM'].map(crsToStationItemMapper),
            disruptionType: 'delayedBy',
            delayTime: '44',
            disruptionReason: 'awaiting a member of the train crew',
          },
        },
      ],
    }

    presets.nextTrain.push({
      name: '23:45 | Calling at every station (needs a powerful device)',
      state: {
        chime: this.DEFAULT_CHIME,
        platform: '1',
        newPlatform: '1',
        oldPlatform: '18',
        announceOldPlatform: true,
        firstClassLocation: 'middle',
        isDelayed: false,
        mindTheGap: true,
        thisStationCode: 'North Pole International',
        hour: '23',
        min: '45',
        toc: '',
        terminatingStationCode: 'North Pole International',
        vias: ['SLO'].map(stationItemCompleter),
        callingAt: this.STATIONS.map(stationItemCompleter),
        coaches: '1 coach',
        announceShortPlatformsAfterSplit: false,
        notCallingAtStations: [],
      },
    })

    return presets
  }

  protected get AVAILABLE_TOCS() {
    return {
      withServiceToFrom: [
        'a replacement bus',
        'additional',
        'additional Chiltern Railways',
        'additional football special',
        'Alphaline',
        'Anglia Railways',
        'Anglia Railways Train',
        'Arriva CrossCountry',
        'Arriva Trains Merseyside',
        'Arriva Trains Northern',
        'Arriva Trains Wales',
        'Blackheath and Woolwich',
        'Blackheath and Woolwich Arsenal',
        'Blackheath and Woolwich Arsenal Line',
        'c2c',
        'c2c Rail',
        'Cardiff Railways',
        'Central Trains',
        'Charter',
        'Chiltern Line',
        'Chiltern Railway Company',
        'Chiltern Railways',
        'Chiselhurst and Maidstone East',
        'Chiselhurst and Maidstone East Line',
        'Chiselhurst Sevenoaks and Canterbury West',
        'Chiselhurst Sevenoaks and Canterbury West Line',
        'Connex',
        'Connex Express',
        'Connex Metro',
        'Connex Racecourse Special',
        'Connex Rail',
        'Connex South Central',
        'Connex South Eastern',
        'Country',
        'CrossCountry',
        'diverted',
        'East Midlands',
        'East Midlands Railway',
        'East Midlands Trains',
        'Eurostar',
        'express',
        'First Capital Connect',
        'First Great Eastern',
        'First Great Western',
        'First Great Western Adelante',
        'First Great Western Atlantic Coast Express',
        'First Great Western Bristolian',
        'First Great Western Cathedrals Express',
        'First Great Western Cheltenham Flier',
        'First Great Western Cheltenham Spa Express',
        'First Great Western Cornish Riviera',
        'First Great Western Devon Belle',
        'First Great Western Golden Hind',
        'First Great Western Hibernian',
        'First Great Western High Speed',
        'First Great Western Intercity',
        'First Great Western Link',
        'First Great Western Mayflower',
        'First Great Western Merchant Venturer',
        'First Great Western Motorail',
        'First Great Western Night Riviera',
        'First Great Western Pembroke Coast Express',
        'First Great Western Red Dragon',
        'First Great Western Royal Duchy',
        'First Great Western Royal Wessex',
        'First Great Western St David',
        'First Great Western Torbay Express',
        'First Transpennine Express',
        'First Transpennine Service',
        'football special',
        'for seat reservations holders only',
        'Gatwick Express',
        'GNER',
        'Grand Central',
        'Great Eastern',
        'Great Eastern Railway',
        'Great North Eastern Railway',
        'Great North Eastern Railways',
        'Great North Eastern Railways White Rose',
        'Great North Eastern Railways Yorkshire Pullman',
        'Great Northern',
        'Great Western',
        'Great Western Railway',
        'Greater Anglia',
        'Heathrow Express',
        'Holidaymaker',
        'Holidaymaker Express',
        'Hull Trains',
        'Island Line',
        'London Midland',
        'London Midland City',
        'London Midland Express',
        'London North Eastern Railway',
        'London Overground',
        'London Transport Buses',
        'London Underground',
        'LTS Rail',
        'Maidstone East and Ashford International Line',
        'Maidstone East and Ashford Line',
        'Maidstone East and Canterbury West Line',
        'Maidstone East and Dover Priory Line',
        'Merseyside Electrics',
        'Midland Mainline',
        'Midland Mainline High Speed Train',
        'Midland Mainline Turbostar',
        'National Express',
        'National Express East Coast',
        'New Southern Railway',
        'New Southern Railway Brighton Express',
        'North London Railway',
        'Northern',
        'Northern Rail',
        'Northern Spirit',
        'One',
        'One Anglia',
        'Orient Express',
        'private charter train',
        'Racecourse Special',
        'replacement bus',
        'return charter train',
        'rugby special',
        'ScotRail',
        'ScotRail Railways',
        'Silverlink County',
        'Silverlink Metro',
        'South Central',
        'South Central Trains',
        'South West Trains',
        'South Western Railway',
        'Southeastern',
        'Southeastern Trains',
        'Southern',
        'Southern Railway',
        'Southern Railway Brighton Express',
        'special charter',
        'Stansted Express',
        'steam charter train',
        'stopping',
        'Tarka Line',
        'Thames Trains',
        'Thameslink',
        'Thameslink City Flier',
        'Thameslink City Metro',
        'The Mid Hants Steam Railway',
        'The National Express East Coast',
        // 'The Swanage Railway',
        'The Watercress Line',
        'The Yorkshire Pullman',
        'Tramlink',
        'Tyne and Wear Metro',
        'Valley Lines',
        'Virgin Pendolino',
        'Virgin Trains',
        'Virgin Trains Armada',
        'Virgin Trains Cornish Scot',
        'Virgin Trains Cornishman',
        'Virgin Trains Cross Country',
        'Virgin Trains Devon Scot',
        'Virgin Trains Devonian',
        'Virgin Trains Dorset Scot',
        'Virgin Trains Midland Scot',
        'Virgin Trains Pines Express',
        'Virgin Trains Sussex Scot',
        'Virgin Trains Wessex Scot',
        'Virgin Voyager',
        'WAGN',
        'Wales and Borders',
        'Wales and West',
        'Wales and West Alphaline',
        'Wales and West Weymouth Sand and Cycle Explorer',
        'Wessex',
        'West Anglia',
        'West Anglia Great Northern Railway',
        'West Anglia Great Northern Railways',
        'West Coast Railway Company',
        'White Rose',
        'Yorkshire Pullman',
      ],
      standaloneOnly: [
        'Avanti West Coast',
        'Avanti West Coast Pendolino',
        'Avanti West Coast Voyager',
        'Avanti West Coast Evero',
        'Channel Tunnel Rail Link',
        'Chiltern Railway company',
        'Croydon Tramlink',
        'First Transpennine',
        'Great Western Railway Atlantic Coast Express',
        'Great Western Railway Bristolian',
        'Great Western Railway Cathedrals Express',
        'Great Western Railway Cheltenham Flier',
        'Great Western Railway Cheltenham Spa Express',
        'Great Western Railway Cornish Riviera',
        'Great Western Railway Devon Belle',
        'Great Western Railway Devon Express',
        'Great Western Railway Golden Hind',
        'Great Western Railway Hibernian',
        'Great Western Railway High Speed',
        'Great Western Railway Intercity',
        'Great Western Railway Mayflower',
        'Great Western Railway Merchant Venturer',
        'Great Western Railway Night Riviera',
        'Great Western Railway Pembroke Coast Express',
        'Great Western Railway Red Dragon',
        'Great Western Railway Royal Duchy',
        'Great Western Railway Royal Wessex',
        'Great Western Railway St David',
        'Great Western Railway Torbay Express',
        'intercity charter train',
        'international',
        'London Northwestern Railway',
        'mainline',
        'North London Railways',
        'North Western Trains',
        'Regional Railways charter train',
        'ScotRail Express',
        'South London Metro',
        'Sussex Scot',
        'Transpennine',
        'Transpennine Express',
        'Virgin Trains the Sussex Scot',
        'West Midlands Railway',
        'West Yorkshire metro train',
      ],
    }
  }

  protected get DISRUPTION_REASONS() {
    return [
      'a broken down freight train',
      'a broken down preceding train',
      'a broken down train',
      'a broken rail',
      'a cable fire',
      'a chemical spillage',
      'a currently unidentified reason which is under investigation',
      'a customer having been taken ill on a preceding train',
      'a customer having been taken ill on this train',
      'a dangerous gas leak',
      'a derailment',
      'a driver shortage',
      'a failed train',
      'a failure of level crossing apparatus',
      'a failure of signalling equipment',
      'a fallen tree on the line',
      'a fatality',
      'a fault on a level crossing',
      'a fault on a preceding that has now been rectified',
      'a fault on a preceding train',
      'a fault on the train that has now been rectified',
      'a fault on the train',
      'a fault on this train which cannot be rectified',
      'a fault on this train which is being attended to',
      'a fault on trackside equipment',
      'a fault that has occurred whilst attaching coaches to this train',
      'a fault that has occurred whilst detaching coaches from this train',
      'a fault with the door mechanism on board a preceding train',
      'a fault with the door mechanism on board this train',
      'a fire',
      'a gas leak in the area',
      'a lack of suitable carriages',
      'a landslide',
      'a landslip',
      'a late-running preceding service',
      'a lightning strike affecting the signalling equipment',
      'a lightning strike',
      'a line blockage',
      'a lineside fire',
      'a major electrical power fault',
      'a mechanical fault on a level crossing',
      'a member of staff providing assistance to a passenger',
      'a passenger incident',
      'a passenger requiring urgent attention',
      'a points failure',
      'a power failure',
      'a problem on property adjacent to the railway',
      'a report of an injury to a person on the track',
      'a road vehicle damaging a level crossing',
      'a road vehicle on the line',
      'a road vehicle striking a railway bridge',
      'a security alert',
      'a shortage of available coaches',
      'a shortage of serviceable trains',
      'a shortage of train dispatch staff',
      'a signal failure',
      'a signalling apparatus failure',
      'a slow-running preceding freight train running behind schedule',
      'a slow-running preceding train with a technical fault',
      'a staff shortage',
      'a suspected fatality',
      'a technical fault on the service',
      'a technical fault to lineside equipment',
      'a technical problem',
      'a temporary fault with the signalling equipment',
      'a temporary shortage of drivers',
      'a temporary shortage of train crews',
      'a temporary speed restriction because of signalling equipment repairs',
      'a temporary speed restriction because of track repairs',
      // 'a temporary speed restriction',
      'a ticket irregularity on board a preceding train',
      'a ticket irregularity on board this train',
      'a track circuit failure',
      'a train failure',
      'a train speed restriction caused by a technical fault on this train',
      'additional cleaning duties',
      'additional coaches being attached to the train',
      'additional maintenance requirements at the depot',
      'additional safety duties being carried out on board this train',
      'additional train movements to remove a broken down train',
      'adverse weather conditions',
      // 'after having been held awaiting late running connection (old cut)',
      // 'after having been held for a late running connection',
      'ambulance attending an incident on the train',
      'ambulance attending an incident on this train',
      'an accident on a level crossing',
      'an accident to a member of the public',
      'an act of vandalism on this train',
      'an earlier act of vandalism on this train',
      'an earlier blockage of the line',
      'an earlier broken down train causing congestion',
      'an earlier broken down train',
      'an earlier electrical power supply problem',
      'an earlier fallen tree on the line',
      'an earlier fallen tree',
      'an earlier fatality',
      'an earlier fault on a level crossing',
      'an earlier fault that occurred whilst attaching coaches to this train',
      'an earlier fault that occurred whilst detaching coaches from this train',
      'an earlier fault with the door mechanism on board a preceding train',
      'an earlier fault with the door mechanism on board this train',
      'an earlier fault with the signalling equipment',
      'an earlier landslide',
      'an earlier lineside fire',
      'an earlier road vehicle striking a railway bridge',
      'an earlier security alert',
      'an earlier trespassing incident causing congestion',
      'an earlier trespassing incident',
      'an electrical power supply problem',
      'an external cause beyond our control',
      'an incident on the line',
      'an injury to a person on the track',
      'an obstruction on the line',
      'animals on the railway line',
      'animals on the track',
      'awaiting a connecting service',
      'awaiting a member of the train crew',
      // 'awaiting a member of train crew',
      'awaiting a portion of the train',
      'awaiting a replacement driver',
      'awaiting an available platform because of service congestion',
      'awaiting replacement coaches',
      'awaiting signal clearance',
      'bad weather conditions',
      'being held awaiting a late running connection',
      'being held awaiting a replacement bus connection',
      'cancellation of the incoming service',
      'caused by servicing problems in the depot',
      'children playing near the line',
      'christmas holidays',
      'coaches being detached from this train',
      'conductor rail problems',
      'confusion caused by a fault with the station information board',
      'congestion caused by a failed train',
      'congestion',
      'crewing difficulties',
      'damaged track',
      'debris blown on the line',
      'debris on the line',
      'delay to a preceding train',
      'earlier emergency track repairs',
      'earlier engineering works',
      'earlier overrunning engineering work',
      'earlier reports of a disturbance on board this train',
      'earlier reports of animals on the line',
      'earlier reports of debris on the line',
      'earlier reports of trespassers on the line',
      'earlier vandalism',
      'electric conductor rail problems',
      'electrical problems with the train',
      'emergency engineering work',
      'emergency track repairs',
      'engineering works',
      'engineering work',
      'extreme weather conditions',
      'failure of a preceding train',
      'flooding on the line',
      'flooding',
      'fog',
      'following signal staff instructions',
      'heavy rain',
      'high winds',
      'industrial action',
      // 'large numbers of passengers alighting from the trains at',
      // 'large numbers of passengers joining the trains at',
      'late running of a previous train',
      'mechanical problems with the train',
      'mechanical problems',
      'no driver available',
      'objects being thrown onto the line',
      'objects on the line',
      // 'on a preceding train',
      'overcrowding caused by the short formation of this service today',
      'overcrowding caused by the',
      'overcrowding on the train',
      'overcrowding',
      'overhead electric line problems',
      'overhead line damage',
      'overhead line problems',
      'overrunning engineering work',
      'passenger illness',
      'police activity on the line',
      'police attending a disturbance on a preceding train',
      'police attending a disturbance on this train',
      'police attending an incident on the train',
      'police attending an incident on this train',
      'police persuing suspects on the line',
      'poor rail conditions caused by frost',
      'poor rail conditions caused by leaf fall',
      'poor rail conditions',
      'power car problems',
      'replacing emergency equipment on this train',
      'reports of a blockage on the line',
      'reports of a disturbance on board this train',
      'reports of animals on the line',
      'reports of debris on the line',
      'reports of trespass on the line',
      'revenue protection officers attending this train',
      'severe weather conditions',
      'short formation of this train',
      'signal testing',
      'signalling difficulties',
      'signalling equipment repairs',
      'sliding train door problems',
      'slippery rail conditions',
      'snow',
      'staff shortages',
      'staff sickness',
      'suspected damage to a railway bridge by a road vehicle',
      'suspected damage to a railway bridge',
      'suspected terrorist threat',
      'the advice of the emergency services',
      'the emergency communication cord being activated on this train',
      'the emergency communication cord being activated',
      'the emergency communication cord being pulled on the service',
      'the emergency communication cord being pulled on the train',
      'the emergency cord being pulled on the service',
      'the emergency cord being pulled on the train',
      'the extreme heat',
      'the fire brigade attending an incident on the train',
      'the fire brigade attending an incident on this train',
      'the late arrival of an incoming train',
      // 'the late arrival of the coaches and train crew to form this service',
      // 'the late running of a preceding train',
      'the london fire brigade attending an incident on the train',
      'the london fire brigade attending an incident on this train',
      'the previous service being delayed',
      'the short formation of this train',
      'the train being diverted from its scheduled route',
      'the train running on reduced engine power',
      'the unfortunate action of vandals',
      'third rail problems',
      'this train making additional stops on its journey',
      // ['a temporary speed restriction', 'to run at a reduced speed while inspecting the line'],
      'track repairs',
      'train being held awaiting an available platform',
      'train door problems',
      'trespass on the line',
      'vandalism on a preceding train',
      'vandalism on the service',
      'vandalism',
      // 'who has been delayed by the earlier disruption',
      // 'who in turn has been delayed by the current disruption',
      // 'who is delayed on a late-running service',
    ]
  }

  get PLATFORMS() {
    return ['0'].concat(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        .flatMap(x => [`${x}`, `${x}a`, `${x}b`, `${x}c`, `${x}d`])
        .concat(['13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', 'a', 'b', 'c', 'd']),
    )
  }

  get STATIONS() {
    return [
      'AAP',
      'AAT',
      'ABA',
      'ABC',
      'ABD',
      'ABE',
      'ABH',
      'ABW',
      'ABY',
      'ACB',
      'ACC',
      'ACG',
      'ACH',
      'ACK',
      'ACL',
      'ACN',
      'ACR',
      'ACT',
      'ACY',
      'ADC',
      'ADD',
      'ADK',
      'ADL',
      'ADM',
      'ADN',
      'ADR',
      'ADS',
      'ADV',
      'ADW',
      'AFK',
      'AFS',
      'AFV',
      'AGL',
      'AGS',
      'AGT',
      'AGV',
      'AHD',
      'AHN',
      'AHS',
      'AHT',
      'AHV',
      'AIG',
      'AIN',
      'AIR',
      'ALB',
      'ALD',
      'ALF',
      'ALK',
      'ALM',
      'ALN',
      'ALP',
      'ALR',
      'ALT',
      'ALV',
      'ALW',
      'ALX',
      'AMB',
      'AMF',
      'AML',
      'AMR',
      'AMT',
      'AMY',
      'ANC',
      'AND',
      'ANF',
      'ANG',
      'ANL',
      'ANN',
      'ANS',
      'ANZ',
      'AON',
      'APB',
      'APD',
      'APF',
      'APG',
      'APP',
      'APS',
      'APY',
      'ARB',
      'ARD',
      'ARG',
      'ARL',
      'ARM',
      'ARN',
      'ARR',
      'ART',
      'ARU',
      'ASB',
      'ASC',
      'ASF',
      'ASG',
      'ASH',
      'ASK',
      'ASN',
      'ASP',
      'ASS',
      'AST',
      'ASY',
      'ATB',
      'ATH',
      'ATL',
      'ATN',
      'ATT',
      'AUD',
      'AUG',
      'AUI',
      'AUK',
      'AUR',
      'AUW',
      'AVF',
      'AVM',
      'AVN',
      'AVP',
      'AVY',
      'AWK',
      'AWM',
      'AWT',
      'AXM',
      'AXP',
      'AYH',
      'AYL',
      'AYP',
      'AYR',
      'AYS',
      'AYW',
      'BAA',
      'BAB',
      'BAC',
      'BAD',
      'BAG',
      'BAH',
      'BAI',
      'BAJ',
      'BAK',
      'BAL',
      'BAM',
      'BAN',
      'BAR',
      'BAS',
      'BAT',
      'BAU',
      'BAV',
      'BAW',
      'BAY',
      'BBG',
      'BBK',
      'BBL',
      'BBN',
      'BBS',
      'BBW',
      'BCB',
      'BCC',
      'BCE',
      'BCF',
      'BCG',
      'BCH',
      'BCJ',
      'BCK',
      'BCN',
      'BCS',
      'BCU',
      'BCV',
      'BCY',
      'BCZ',
      'BDA',
      'BDB',
      'BDG',
      'BDH',
      'BDI',
      'BDK',
      'BDL',
      'BDM',
      'BDN',
      'BDQ',
      'BDS',
      'BDT',
      'BDW',
      'BDY',
      'BEA',
      'BEB',
      'BEC',
      'BEE',
      'BEF',
      'BEG',
      'BEH',
      'BEL',
      'BEM',
      'BEN',
      'BES',
      'BET',
      'BEU',
      'BEV',
      'BEX',
      'BEY',
      'BFD',
      'BFE',
      'BFF',
      'BFN',
      'BFR',
      'BGA',
      'BGD',
      'BGE',
      'BGG',
      'BGH',
      'BGI',
      'BGL',
      'BGM',
      'BGN',
      'BGS',
      'BGV',
      'BHC',
      'BHD',
      'BHG',
      'BHI',
      'BHK',
      'BHM',
      'BHO',
      'BHR',
      'BHS',
      'BIA',
      'BIC',
      'BID',
      'BIF',
      'BIG',
      'BIK',
      'BIL',
      'BIN',
      'BIO',
      'BIP',
      'BIS',
      'BIW',
      'BIY',
      'BKA',
      'BKC',
      'BKD',
      'BKG',
      'BKH',
      'BKJ',
      'BKL',
      'BKM',
      'BKN',
      'BKO',
      'BKP',
      'BKQ',
      'BKS',
      'BKT',
      'BKW',
      'BLA',
      'BLB',
      'BLD',
      'BLE',
      'BLG',
      'BLH',
      'BLK',
      'BLL',
      'BLM',
      'BLN',
      'BLO',
      'BLP',
      'BLT',
      'BLV',
      'BLW',
      'BLX',
      'BLY',
      'BMB',
      'BMC',
      'BMD',
      'BME',
      'BMF',
      'BMG',
      'BMH',
      'BML',
      'BMN',
      'BMO',
      'BMP',
      'BMR',
      'BMS',
      'BMT',
      'BMV',
      'BMY',
      'BNA',
      'BNC',
      'BND',
      'BNE',
      'BNF',
      'BNG',
      'BNH',
      'BNI',
      'BNL',
      'BNM',
      'BNP',
      'BNR',
      'BNS',
      'BNT',
      'BNV',
      'BNW',
      'BNY',
      'BOA',
      'BOC',
      'BOD',
      'BOE',
      'BOG',
      'BOH',
      'BOM',
      'BON',
      'BOP',
      'BOR',
      'BOT',
      'BOW',
      'BPB',
      'BPK',
      'BPN',
      'BPS',
      'BPT',
      'BPW',
      'BRA',
      'BRC',
      'BRE',
      'BRF',
      'BRG',
      'BRH',
      'BRI',
      'BRK',
      'BRL',
      'BRM',
      'BRN',
      'BRO',
      'BRP',
      'BRR',
      'BRS',
      'BRT',
      'BRU',
      'BRV',
      'BRW',
      'BRX',
      'BRY',
      'BSB',
      'BSC',
      'BSD',
      'BSE',
      'BSH',
      'BSI',
      'BSJ',
      'BSK',
      'BSL',
      'BSM',
      'BSN',
      'BSO',
      'BSP',
      'BSR',
      'BSS',
      'BSW',
      'BSY',
      'BTB',
      'BTD',
      'BTE',
      'BTF',
      'BTG',
      'BTH',
      'BTL',
      'BTN',
      'BTO',
      'BTR',
      'BTS',
      'BTT',
      'BTY',
      'BUB',
      'BUC',
      'BUD',
      'BUE',
      'BUG',
      'BUH',
      'BUI',
      'BUJ',
      'BUK',
      'BUL',
      'BUO',
      'BUS',
      'BUT',
      'BUU',
      'BUW',
      'BUX',
      'BUY',
      'BVD',
      'BWB',
      'BWD',
      'BWG',
      'BWK',
      'BWN',
      'BWO',
      'BWS',
      'BWT',
      'BXB',
      'BXD',
      'BXH',
      'BXW',
      'BXY',
      'BYA',
      'BYB',
      'BYC',
      'BYD',
      'BYE',
      'BYF',
      'BYI',
      'BYK',
      'BYL',
      'BYM',
      'BYN',
      'BYS',
      'CAD',
      'CAG',
      'CAK',
      'CAM',
      'CAN',
      'CAO',
      'CAR',
      'CAT',
      'CAU',
      'CAY',
      'CBB',
      'CBC',
      'CBE',
      'CBG',
      'CBH',
      'CBL',
      'CBN',
      'CBP',
      'CBR',
      'CBS',
      'CBW',
      'CBY',
      'CCC',
      'CCH',
      'CCT',
      'CDB',
      'CDD',
      'CDF',
      'CDI',
      'CDN',
      'CDO',
      'CDQ',
      'CDR',
      'CDS',
      'CDT',
      'CDU',
      'CDY',
      'CEA',
      'CED',
      'CEF',
      'CEH',
      'CEL',
      'CES',
      'CET',
      'CEY',
      'CFB',
      'CFC',
      'CFD',
      'CFF',
      'CFH',
      'CFL',
      'CFN',
      'CFO',
      'CFR',
      'CFT',
      'CGD',
      'CGM',
      'CGN',
      'CGW',
      'CHC',
      'CHD',
      'CHE',
      'CHF',
      'CHG',
      'CHH',
      'CHI',
      'CHK',
      'CHL',
      'CHM',
      'CHN',
      'CHO',
      'CHP',
      'CHR',
      'CHT',
      'CHU',
      'CHW',
      'CHX',
      'CHY',
      'CIL',
      'CIM',
      'CIR',
      'CIT',
      'CKH',
      'CKL',
      'CKN',
      'CKS',
      'CKT',
      'CLA',
      'CLC',
      'CLD',
      'CLE',
      'CLG',
      'CLH',
      'CLI',
      'CLJ',
      'CLK',
      'CLL',
      'CLM',
      'CLN',
      'CLP',
      'CLR',
      'CLS',
      'CLT',
      'CLU',
      'CLV',
      'CLW',
      'CLY',
      'CMD',
      'CME',
      'CMF',
      'CMH',
      'CML',
      'CMN',
      'CMO',
      'CMR',
      'CMY',
      'CNE',
      'CNF',
      'CNG',
      'CNL',
      'CNM',
      'CNN',
      'CNO',
      'CNP',
      'CNR',
      'CNS',
      'CNW',
      'CNY',
      'COB',
      'COH',
      'COI',
      'COL',
      'COM',
      'CON',
      'COO',
      'COP',
      'COR',
      'COS',
      'COT',
      'COV',
      'COW',
      'COY',
      'CPA',
      'CPH',
      'CPK',
      'CPM',
      'CPN',
      'CPT',
      'CPW',
      'CPY',
      'CRA',
      'CRB',
      'CRD',
      'CRE',
      'CRF',
      'CRG',
      'CRH',
      'CRI',
      'CRK',
      'CRL',
      'CRM',
      'CRN',
      'CRO',
      'CRR',
      'CRS',
      'CRT',
      'CRV',
      'CRW',
      'CRY',
      'CSA',
      'CSB',
      'CSD',
      'CSG',
      'CSH',
      'CSK',
      'CSL',
      'CSM',
      'CSN',
      'CSO',
      'CSR',
      'CSS',
      'CST',
      'CSW',
      'CSY',
      'CTF',
      'CTH',
      'CTK',
      'CTL',
      'CTM',
      'CTN',
      'CTO',
      'CTR',
      'CTT',
      'CTW',
      'CUA',
      'CUB',
      'CUD',
      'CUF',
      'CUH',
      'CUM',
      'CUP',
      'CUS',
      'CUW',
      'CUX',
      'CWB',
      'CWC',
      'CWD',
      'CWE',
      'CWH',
      'CWL',
      'CWM',
      'CWN',
      'CWS',
      'CWU',
      'CWX',
      'CYB',
      'CYK',
      'CYP',
      'CYS',
      'CYT',
      'DAG',
      'DAK',
      'DAL',
      'DAM',
      'DAN',
      'DAR',
      'DAT',
      'DBC',
      'DBD',
      'DBE',
      'DBG',
      'DBL',
      'DBR',
      'DBY',
      'DCG',
      'DCH',
      'DCT',
      'DCW',
      'DDG',
      'DDK',
      'DDP',
      'DEA',
      'DEE',
      'DEN',
      'DEP',
      'DEW',
      'DFD',
      'DFI',
      'DFR',
      'DGC',
      'DGL',
      'DGT',
      'DGY',
      'DHM',
      'DHN',
      'DID',
      'DIG',
      'DIN',
      'DIS',
      'DKD',
      'DKG',
      'DKT',
      'DLG',
      'DLH',
      'DLJ',
      'DLK',
      'DLM',
      'DLR',
      'DLS',
      'DLT',
      'DLW',
      'DLY',
      'DMC',
      'DMF',
      'DMH',
      'DMK',
      'DMP',
      'DMR',
      'DMS',
      'DMY',
      'DND',
      'DNG',
      'DNL',
      'DNM',
      'DNO',
      'DNS',
      'DNT',
      'DNY',
      'DOC',
      'DOD',
      'DOL',
      'DON',
      'DOR',
      'DOT',
      'DOW',
      'DPD',
      'DPT',
      'DRF',
      'DRG',
      'DRI',
      'DRM',
      'DRN',
      'DRO',
      'DRT',
      'DRU',
      'DSL',
      'DSM',
      'DST',
      'DSY',
      'DTG',
      'DTN',
      'DTW',
      'DUD',
      'DUL',
      'DUM',
      'DUN',
      'DUR',
      'DVC',
      'DVH',
      'DVN',
      'DVP',
      'DVY',
      'DWD',
      'DWL',
      'DWN',
      'DWW',
      'DYC',
      'DYF',
      'DYP',
      'DZY',
      'EAD',
      'EAG',
      'EAL',
      'EAR',
      'EAS',
      'EBA',
      'EBK',
      'EBL',
      'EBN',
      'EBR',
      'EBT',
      'ECC',
      'ECL',
      'ECR',
      'ECS',
      'ECW',
      'EDB',
      'EDG',
      'EDL',
      'EDN',
      'EDP',
      'EDR',
      'EDW',
      'EDY',
      'EFF',
      'EFL',
      'EGF',
      'EGG',
      'EGH',
      'EGN',
      'EGR',
      'EGT',
      'EKL',
      'ELD',
      'ELE',
      'ELG',
      'ELO',
      'ELP',
      'ELR',
      'ELS',
      'ELW',
      'ELY',
      'EMD',
      'EML',
      'EMP',
      'EMS',
      'ENC',
      'ENF',
      'ENL',
      'ENT',
      'EPD',
      'EPH',
      'EPS',
      'ERA',
      'ERD',
      'ERH',
      'ERI',
      'ERL',
      'ESD',
      'ESH',
      'ESL',
      'ESM',
      'EST',
      'ESW',
      'ETC',
      'ETL',
      'EUS',
      'EVE',
      'EWD',
      'EWE',
      'EWR',
      'EWW',
      'EXC',
      'EXD',
      'EXG',
      'EXM',
      'EXN',
      'EXR',
      'EXT',
      'EYN',
      'FAL',
      'FAV',
      'FAZ',
      'FBY',
      'FCN',
      'FEA',
      'FEL',
      'FEN',
      'FER',
      'FFA',
      'FFD',
      'FGH',
      'FGT',
      'FIL',
      'FIN',
      'FIT',
      'FKC',
      'FKG',
      'FKK',
      'FKW',
      'FLD',
      'FLE',
      'FLF',
      'FLI',
      'FLM',
      'FLN',
      'FLT',
      'FLW',
      'FLX',
      'FML',
      'FMR',
      'FMT',
      'FNB',
      'FNC',
      'FNH',
      'FNN',
      'FNR',
      'FNT',
      'FNV',
      'FNW',
      'FNY',
      'FOC',
      'FOD',
      'FOG',
      'FOH',
      'FOK',
      'FOR',
      'FOX',
      'FPK',
      'FRB',
      'FRD',
      'FRE',
      'FRF',
      'FRI',
      'FRL',
      'FRM',
      'FRN',
      'FRO',
      'FRS',
      'FRT',
      'FRW',
      'FRY',
      'FSB',
      'FSG',
      'FSK',
      'FST',
      'FTM',
      'FTN',
      'FTW',
      'FWY',
      'FXN',
      'FYS',
      'FZH',
      'FZP',
      'FZW',
      'GAL',
      'GAR',
      'GBD',
      'GBK',
      'GBL',
      'GBS',
      'GCH',
      'GCR',
      'GCT',
      'GCW',
      'GDH',
      'GDL',
      'GDN',
      'GDP',
      'GEA',
      'GER',
      'GFD',
      'GFF',
      'GFN',
      'GGJ',
      'GGV',
      'GIG',
      'GIL',
      'GIP',
      'GIR',
      'GKC',
      'GKW',
      'GLC',
      'GLD',
      'GLE',
      'GLF',
      'GLG',
      'GLH',
      'GLM',
      'GLO',
      'GLQ',
      'GLS',
      'GLT',
      'GLY',
      'GLZ',
      'GMB',
      'GMD',
      'GMG',
      'GMN',
      'GMT',
      'GMV',
      'GMY',
      'GNB',
      'GNF',
      'GNH',
      'GNL',
      'GNR',
      'GNT',
      'GNW',
      'GOB',
      'GOD',
      'GOE',
      'GOF',
      'GOL',
      'GOM',
      'GOO',
      'GOR',
      'GOS',
      'GOX',
      'GPK',
      'GPO',
      'GRA',
      'GRB',
      'GRC',
      'GRF',
      'GRK',
      'GRL',
      'GRN',
      'GRP',
      'GRS',
      'GRT',
      'GRV',
      'GRY',
      'GSD',
      'GSL',
      'GSN',
      'GST',
      'GSW',
      'GSY',
      'GTA',
      'GTH',
      'GTN',
      'GTO',
      'GTR',
      'GTW',
      'GTY',
      'GUI',
      'GUN',
      'GVH',
      'GWE',
      'GWN',
      'GYM',
      'GYP',
      'HAB',
      'HAC',
      'HAD',
      'HAG',
      'HAI',
      'HAL',
      'HAM',
      'HAN',
      'HAP',
      'HAS',
      'HAT',
      'HAV',
      'HAY',
      'HAZ',
      'HBB',
      'HBD',
      'HBL',
      'HBN',
      'HBP',
      'HBY',
      'HCB',
      'HCH',
      'HCN',
      'HCT',
      'HDB',
      'HDE',
      'HDF',
      'HDG',
      'HDH',
      'HDL',
      'HDM',
      'HDN',
      'HDW',
      'HDY',
      'HEC',
      'HED',
      // 'HEH',
      'HEI',
      'HEL',
      'HEN',
      'HER',
      'HES',
      'HEV',
      'HEW',
      'HEX',
      'HFD',
      'HFE',
      'HFN',
      'HFS',
      'HFX',
      'HGD',
      'HGF',
      'HGG',
      'HGM',
      'HGN',
      'HGR',
      'HGS',
      'HGT',
      'HGY',
      'HHB',
      'HHD',
      'HHE',
      'HHL',
      'HHY',
      'HIA',
      'HIB',
      'HID',
      'HIG',
      'HIL',
      'HIN',
      'HIP',
      'HIR',
      'HIT',
      'HKC',
      'HKH',
      'HKM',
      'HKN',
      'HKW',
      'HLB',
      'HLC',
      'HLD',
      'HLE',
      'HLF',
      'HLG',
      'HLI',
      'HLL',
      'HLM',
      'HLN',
      'HLR',
      'HLS',
      'HLU',
      'HLW',
      'HLY',
      'HMC',
      'HMD',
      'HME',
      'HML',
      'HMM',
      'HMN',
      'HMP',
      'HMS',
      'HMT',
      'HMW',
      'HMY',
      'HNA',
      'HNB',
      'HNC',
      'HND',
      'HNF',
      'HNG',
      'HNH',
      'HNK',
      'HNL',
      'HNT',
      'HNW',
      'HNX',
      'HOC',
      'HOH',
      'HOK',
      'HOL',
      'HON',
      'HOO',
      'HOP',
      'HOR',
      'HOT',
      'HOU',
      'HOV',
      'HOW',
      'HOX',
      'HOY',
      'HOZ',
      'HPA',
      'HPD',
      'HPE',
      'HPL',
      'HPN',
      'HPQ',
      'HPT',
      'HRD',
      'HRE',
      'HRH',
      'HRL',
      'HRM',
      'HRN',
      'HRO',
      'HRR',
      'HRS',
      'HRW',
      'HRY',
      'HSB',
      'HSC',
      'HSD',
      'HSG',
      'HSK',
      'HSL',
      'HST',
      'HSW',
      'HSY',
      'HTC',
      'HTE',
      'HTF',
      'HTH',
      'HTN',
      'HTO',
      'HTW',
      'HTY',
      'HUB',
      'HUD',
      'HUL',
      'HUN',
      'HUP',
      'HUR',
      'HUT',
      'HUY',
      'HVF',
      'HVN',
      'HWB',
      'HWC',
      'HWD',
      'HWH',
      'HWI',
      'HWK',
      'HWM',
      'HWN',
      'HWW',
      'HWY',
      'HXM',
      'HYB',
      'HYC',
      'HYD',
      'HYH',
      'HYK',
      'HYL',
      'HYM',
      'HYN',
      'HYR',
      'HYS',
      'HYT',
      'HYW',
      'IFD',
      'IFI',
      'IGD',
      'ILK',
      'INC',
      'INE',
      'ING',
      'INH',
      'INK',
      'INP',
      'INR',
      'INS',
      'INT',
      'INV',
      'IPS',
      'IRL',
      'IRV',
      'ISL',
      'ISP',
      'IVR',
      'IVY',
      'JEQ',
      'JHN',
      'JOH',
      'JOR',
      'KBC',
      'KBF',
      'KBK',
      'KBN',
      'KBW',
      'KBX',
      'KCK',
      'KDB',
      'KDG',
      'KDY',
      'KEH',
      'KEI',
      'KEL',
      'KEM',
      'KEN',
      'KET',
      'KEY',
      'KGE',
      'KGH',
      'KGL',
      'KGM',
      'KGN',
      'KGP',
      'KGS',
      'KGT',
      'KGX',
      'KID',
      'KIL',
      'KIN',
      'KIR',
      'KIT',
      'KIV',
      'KKB',
      'KKD',
      'KKH',
      'KKM',
      'KKN',
      'KKS',
      'KLD',
      'KLM',
      'KLN',
      'KLY',
      'KMH',
      'KMK',
      'KML',
      'KMP',
      'KMS',
      'KNA',
      'KND',
      'KNE',
      'KNF',
      'KNG',
      'KNI',
      'KNL',
      'KNN',
      'KNO',
      'KNR',
      'KNS',
      'KNT',
      'KNU',
      'KPA',
      'KPT',
      'KRK',
      'KSL',
      'KSN',
      'KSW',
      'KTH',
      'KTL',
      'KTN',
      'KTW',
      'KVP',
      'KWB',
      'KWD',
      'KWG',
      'KWL',
      'KWN',
      'KYL',
      'KYN',
      'LAC',
      'LAD',
      'LAG',
      'LAI',
      'LAK',
      'LAM',
      'LAN',
      'LAP',
      'LAR',
      'LAS',
      'LAW',
      'LAY',
      'LBG',
      'LBK',
      'LBO',
      'LBR',
      'LBT',
      'LBZ',
      'LCC',
      'LCG',
      'LCK',
      'LCL',
      'LCN',
      'LCS',
      'LDN',
      'LDS',
      'LDY',
      'LEA',
      'LEB',
      'LED',
      'LEE',
      'LEH',
      'LEI',
      'LEL',
      'LEM',
      'LEN',
      'LEO',
      'LER',
      'LES',
      'LET',
      'LEU',
      'LEW',
      'LEY',
      'LFD',
      'LGB',
      'LGD',
      'LGE',
      'LGF',
      'LGG',
      'LGJ',
      'LGK',
      'LGM',
      'LGN',
      'LGO',
      'LGS',
      'LGW',
      'LHA',
      'LHD',
      'LHE',
      'LHL',
      'LHM',
      'LHO',
      'LHS',
      'LHW',
      'LIC',
      'LID',
      'LIH',
      'LIN',
      'LIP',
      'LIS',
      'LIT',
      'LIV',
      'LKE',
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
      'LLS',
      'LLT',
      'LLV',
      'LLW',
      'LLY',
      'LMR',
      'LMS',
      'LNB',
      'LND',
      'LNG',
      'LNK',
      'LNR',
      'LNW',
      'LNY',
      'LNZ',
      'LOB',
      'LOC',
      'LOF',
      'LOH',
      'LOO',
      'LOS',
      'LOT',
      'LOW',
      'LPG',
      'LPR',
      'LPT',
      'LPW',
      'LPY',
      'LRB',
      'LRD',
      'LRG',
      'LSK',
      'LSN',
      'LST',
      'LSW',
      'LSY',
      'LTG',
      'LTK',
      'LTL',
      'LTM',
      'LTN',
      'LTP',
      'LTS',
      'LTT',
      'LTV',
      'LUD',
      'LUT',
      'LUX',
      'LVC',
      'LVG',
      'LVJ',
      'LVM',
      'LVN',
      'LVT',
      'LWH',
      'LWR',
      'LWS',
      'LWT',
      'LYC',
      'LYD',
      'LYE',
      'LYM',
      'LYP',
      'LYT',
      'LZB',
      'MAC',
      'MAG',
      'MAI',
      'MAL',
      'MAN',
      'MAO',
      'MAR',
      'MAS',
      'MAT',
      'MAU',
      'MAX',
      'MAY',
      'MBK',
      'MBR',
      'MCB',
      'MCE',
      'MCH',
      'MCM',
      'MCN',
      'MCO',
      'MCV',
      'MDB',
      'MDE',
      'MDG',
      'MDL',
      'MDN',
      'MDS',
      'MDW',
      'MEC',
      'MEL',
      'MEN',
      'MEO',
      'MEP',
      'MER',
      'MES',
      'MEV',
      'MEW',
      'MEX',
      'MFA',
      'MFF',
      'MFH',
      'MFL',
      'MFT',
      'MGM',
      'MGN',
      'MHM',
      'MHR',
      'MHS',
      'MIA',
      'MIC',
      'MIH',
      'MIJ',
      'MIK',
      'MIL',
      'MIM',
      'MIN',
      'MIR',
      'MIS',
      'MKC',
      'MKM',
      'MKR',
      'MKT',
      'MLB',
      'MLD',
      'MLF',
      'MLG',
      'MLH',
      'MLM',
      'MLN',
      'MLS',
      'MLT',
      'MLW',
      'MLY',
      'MMO',
      'MNC',
      'MNE',
      'MNG',
      'MNN',
      'MNP',
      'MNR',
      'MOB',
      'MOG',
      'MON',
      'MOO',
      'MOR',
      'MOS',
      'MOT',
      'MPK',
      'MPL',
      'MPT',
      'MRB',
      'MRD',
      'MRF',
      'MRN',
      'MRP',
      'MRR',
      'MRS',
      'MRT',
      'MRY',
      'MSD',
      'MSH',
      'MSK',
      'MSL',
      'MSN',
      'MSO',
      'MSR',
      'MSS',
      'MST',
      'MSW',
      'MTA',
      'MTB',
      'MTC',
      'MTG',
      'MTH',
      'MTL',
      'MTM',
      'MTN',
      'MTO',
      'MTP',
      'MTS',
      'MTV',
      'MUB',
      'MUF',
      'MUI',
      'MVL',
      'MYB',
      'MYH',
      'MYL',
      'MYT',
      'MZH',
      'NAN',
      'NAR',
      'NAY',
      'NBA',
      'NBC',
      'NBN',
      'NBR',
      'NBT',
      'NBW',
      'NBY',
      'NCE',
      'NCK',
      'NCL',
      'NCM',
      'NCT',
      'NDL',
      'NEH',
      'NEI',
      'NEL',
      'NEM',
      'NES',
      'NET',
      'NFA',
      'NFD',
      'NFL',
      'NFN',
      'NGT',
      'NHD',
      'NHE',
      'NHL',
      'NIT',
      'NLN',
      'NLR',
      'NLS',
      'NLT',
      'NLW',
      'NMC',
      'NMK',
      'NMN',
      'NMP',
      'NMT',
      'NNG',
      'NNP',
      'NNT',
      'NOA',
      'NOR',
      'NOT',
      'NPD',
      'NQU',
      'NQY',
      'NRB',
      'NRC',
      'NRD',
      'NRN',
      'NRT',
      'NRW',
      'NSB',
      'NSD',
      'NSG',
      'NSH',
      'NTA',
      'NTB',
      'NTC',
      'NTH',
      'NTL',
      'NTN',
      'NTR',
      'NUF',
      'NUM',
      'NUN',
      'NUT',
      'NVH',
      'NVN',
      'NVR',
      'NWA',
      'NWB',
      'NWD',
      'NWE',
      'NWI',
      'NWM',
      'NWN',
      'NWP',
      'NWR',
      'NWT',
      'NWX',
      'NXG',
      'OBN',
      'OCK',
      'OHL',
      'OKE',
      'OKL',
      'OKM',
      'OKN',
      'OLD',
      'OLF',
      'OLT',
      'OLY',
      'OMS',
      'OPK',
      'ORE',
      'ORN',
      'ORP',
      'ORR',
      'OTF',
      'OUN',
      'OUS',
      'OUT',
      'OVE',
      'OVR',
      'OXF',
      'OXN',
      'OXS',
      'OXT',
      'PAD',
      'PAL',
      'PAN',
      'PAR',
      'PAT',
      'PBL',
      'PBO',
      'PBR',
      'PBY',
      'PCD',
      'PCN',
      'PDG',
      'PDW',
      'PEA',
      'PEB',
      'PEG',
      'PEM',
      'PEN',
      'PER',
      'PES',
      'PET',
      'PEV',
      'PEW',
      'PFL',
      'PFM',
      'PFR',
      'PFY',
      'PGM',
      'PGN',
      'PHG',
      'PHR',
      'PIL',
      'PIN',
      'PIT',
      'PKG',
      'PKS',
      'PKT',
      'PLC',
      'PLD',
      'PLE',
      'PLG',
      'PLK',
      'PLM',
      'PLN',
      'PLS',
      'PLT',
      'PLU',
      'PLW',
      'PLY',
      'PMA',
      'PMB',
      'PMD',
      'PMH',
      'PMP',
      'PMR',
      'PMS',
      'PMT',
      'PMW',
      'PNA',
      'PNC',
      'PNE',
      'PNF',
      'PNL',
      'PNM',
      'PNR',
      'PNS',
      'PNW',
      'PNY',
      'PNZ',
      'POK',
      'POL',
      'PON',
      'POO',
      'POP',
      'POR',
      'POT',
      'PPD',
      'PPK',
      'PPL',
      'PRA',
      'PRB',
      'PRE',
      'PRH',
      'PRL',
      'PRN',
      'PRP',
      'PRR',
      'PRS',
      'PRT',
      'PRU',
      'PRW',
      'PRY',
      'PSC',
      'PSE',
      'PSH',
      'PSL',
      'PSN',
      'PST',
      'PSW',
      'PTA',
      'PTB',
      'PTC',
      'PTD',
      'PTF',
      'PTG',
      'PTH',
      'PTK',
      'PTL',
      'PTM',
      'PTR',
      'PTT',
      'PTW',
      'PUL',
      'PUO',
      'PUR',
      'PUT',
      'PWE',
      'PWL',
      'PWW',
      'PWY',
      'PYC',
      'PYG',
      'PYJ',
      'PYL',
      'PYN',
      'PYP',
      'PYT',
      'QBR',
      'QPK',
      'QPW',
      'QRB',
      'QRP',
      'QUI',
      'QYD',
      'RAD',
      'RAI',
      'RAM',
      'RAN',
      'RAU',
      'RAV',
      'RAY',
      'RBR',
      'RCC',
      'RCD',
      'RCE',
      'RDA',
      'RDB',
      'RDC',
      'RDD',
      'RDF',
      'RDG',
      'RDH',
      'RDM',
      'RDN',
      'RDR',
      'RDS',
      'RDT',
      'RDW',
      'REC',
      'RED',
      'REE',
      'REI',
      'RET',
      'RFD',
      'RFY',
      'RGL',
      'RGP',
      'RGT',
      'RGW',
      'RHD',
      'RHI',
      'RHL',
      'RHM',
      'RHO',
      'RHY',
      'RIC',
      'RID',
      'RIL',
      'RIS',
      'RKT',
      'RLG',
      'RLN',
      'RMB',
      'RMC',
      'RMD',
      'RMF',
      'RML',
      'RNF',
      'RNH',
      'RNM',
      'RNR',
      'ROB',
      'ROC',
      'ROE',
      'ROG',
      'ROL',
      'ROM',
      'ROO',
      'ROS',
      'ROW',
      'RRB',
      'RSG',
      'RSH',
      'RTN',
      'RTR',
      'RUA',
      'RUE',
      'RUF',
      'RUG',
      'RUN',
      'RUS',
      'RUT',
      'RVB',
      'RVN',
      'RWC',
      'RYB',
      'RYD',
      'RYE',
      'RYH',
      'RYN',
      'RYP',
      'RYR',
      'RYS',
      'SAA',
      'SAC',
      'SAD',
      'SAE',
      'SAF',
      'SAH',
      'SAJ',
      'SAL',
      'SAM',
      'SAN',
      'SAR',
      'SAS',
      'SAT',
      'SAU',
      'SAV',
      'SAW',
      'SAX',
      'SAY',
      'SBE',
      'SBF',
      'SBJ',
      'SBK',
      'SBM',
      'SBP',
      'SBR',
      'SBS',
      'SBT',
      'SBU',
      'SBV',
      'SBY',
      'SCA',
      'SCF',
      'SCG',
      'SCH',
      'SCR',
      'SCS',
      'SCT',
      'SCU',
      'SCY',
      'SDA',
      'SDB',
      'SDC',
      'SDE',
      'SDF',
      'SDG',
      'SDH',
      'SDL',
      'SDM',
      'SDN',
      'SDP',
      'SDR',
      'SDW',
      'SDY',
      'SEA',
      'SEB',
      'SEC',
      'SED',
      'SEE',
      'SEF',
      'SEG',
      'SEH',
      'SEL',
      'SEM',
      'SEN',
      'SER',
      'SES',
      'SET',
      'SEV',
      'SFA',
      'SFD',
      'SFL',
      'SFN',
      'SFO',
      'SFR',
      'SGB',
      'SGL',
      'SGM',
      'SGN',
      'SGR',
      'SHB',
      'SHC',
      'SHD',
      'SHE',
      'SHF',
      'SHH',
      'SHI',
      'SHJ',
      'SHL',
      'SHM',
      'SHN',
      'SHO',
      'SHP',
      'SHR',
      'SHS',
      'SHT',
      'SHU',
      'SHW',
      'SHY',
      'SIA',
      'SIC',
      'SID',
      'SIE',
      'SIH',
      'SIL',
      'SIN',
      'SIP',
      'SIT',
      'SIV',
      'SJP',
      'SJS',
      'SKE',
      'SKG',
      'SKI',
      'SKK',
      'SKM',
      'SKN',
      'SKS',
      'SKW',
      'SLA',
      'SLB',
      'SLD',
      'SLH',
      'SLK',
      'SLL',
      'SLO',
      'SLQ',
      'SLR',
      'SLS',
      'SLT',
      'SLV',
      'SLW',
      'SLY',
      'SMA',
      'SMB',
      'SMD',
      'SMG',
      'SMH',
      'SMK',
      'SML',
      'SMN',
      'SMO',
      'SMR',
      'SMT',
      'SMY',
      'SNA',
      'SND',
      'SNE',
      'SNF',
      'SNG',
      'SNH',
      'SNI',
      'SNK',
      'SNL',
      'SNN',
      'SNO',
      'SNR',
      'SNS',
      'SNT',
      'SNW',
      'SNY',
      'SOA',
      'SOB',
      'SOC',
      'SOE',
      'SOF',
      'SOG',
      'SOH',
      'SOK',
      'SOL',
      'SOM',
      'SON',
      'SOO',
      'SOP',
      'SOR',
      'SOT',
      'SOU',
      'SOV',
      'SOW',
      'SPA',
      'SPB',
      'SPF',
      'SPH',
      'SPI',
      'SPK',
      'SPN',
      'SPO',
      'SPP',
      'SPR',
      'SPS',
      'SPT',
      'SPU',
      'SPY',
      'SQE',
      'SQH',
      'SQU',
      'SRA',
      'SRC',
      'SRD',
      'SRG',
      'SRH',
      'SRI',
      'SRL',
      'SRN',
      'SRO',
      'SRR',
      'SRS',
      'SRT',
      'SRU',
      'SRY',
      'SSC',
      'SSD',
      'SSE',
      'SSM',
      'SSS',
      'SST',
      'STA',
      'STC',
      'STD',
      'STE',
      'STF',
      'STG',
      'STH',
      'STJ',
      'STK',
      'STL',
      'STM',
      'STN',
      'STO',
      'STP',
      'STR',
      'STS',
      'STT',
      'STU',
      'STV',
      'STW',
      'SUC',
      'SUD',
      'SUG',
      'SUM',
      'SUN',
      'SUO',
      'SUP',
      'SUR',
      'SUT',
      'SUU',
      'SUY',
      'SVB',
      'SVG',
      'SVK',
      'SVL',
      'SVR',
      'SVS',
      'SWA',
      'SWD',
      'SWE',
      'SWG',
      'SWI',
      'SWK',
      'SWL',
      'SWM',
      'SWN',
      'SWO',
      'SWR',
      'SWS',
      'SWT',
      'SWY',
      'SXY',
      'SYA',
      'SYB',
      'SYD',
      'SYH',
      'SYL',
      'SYS',
      'SYT',
      'TAB',
      'TAC',
      'TAD',
      'TAF',
      'TAI',
      'TAL',
      'TAM',
      'TAP',
      'TAT',
      'TAU',
      'TAY',
      'TBD',
      'TBR',
      'TBW',
      'TBY',
      'TCR',
      'TDU',
      'TEA',
      'TED',
      'TEN',
      'TEO',
      'TEY',
      'TFC',
      'TGM',
      'TGS',
      'THA',
      'THB',
      'THC',
      'THD',
      'THE',
      'THH',
      'THI',
      'THL',
      'THO',
      'THP',
      'THS',
      'THT',
      'THU',
      'THW',
      'TIL',
      'TIP',
      'TIR',
      'TIS',
      'TLB',
      'TLC',
      'TLH',
      'TLK',
      'TLS',
      'TMC',
      'TNA',
      'TNF',
      'TNN',
      'TNP',
      'TNS',
      'TOD',
      'TOK',
      'TOL',
      'TOM',
      'TON',
      'TOO',
      'TOP',
      'TOT',
      'TPB',
      'TPC',
      'TPN',
      'TQY',
      'TRA',
      'TRB',
      'TRD',
      'TRE',
      'TRF',
      'TRH',
      'TRI',
      'TRM',
      'TRN',
      'TRO',
      'TRR',
      'TRS',
      'TRU',
      'TRY',
      'TTF',
      'TTH',
      'TTN',
      'TUH',
      'TUL',
      'TUR',
      'TUT',
      'TVP',
      'TWI',
      'TWN',
      'TWY',
      'TYC',
      'TYG',
      'TYL',
      'TYS',
      'TYW',
      'UCK',
      'UDD',
      'UHA',
      'UHL',
      'ULC',
      'ULL',
      'ULV',
      'UMB',
      'UNI',
      'UPH',
      'UPL',
      'UPM',
      'UPT',
      'UPW',
      'URM',
      'UTT',
      'UTY',
      'UWL',
      'VAL',
      'VIC',
      'VIR',
      'VXH',
      'WAC',
      'WAD',
      'WAE',
      'WAF',
      'WAL',
      'WAM',
      'WAN',
      'WAO',
      'WAR',
      'WAS',
      'WAT',
      'WAW',
      'WBC',
      'WBD',
      'WBL',
      'WBO',
      'WBP',
      'WBQ',
      'WBR',
      'WBY',
      'WCB',
      'WCF',
      'WCH',
      'WCK',
      'WCL',
      'WCM',
      'WCP',
      'WCR',
      'WCX',
      'WCY',
      'WDB',
      'WDD',
      'WDE',
      'WDH',
      'WDL',
      'WDM',
      'WDN',
      'WDO',
      'WDS',
      'WDT',
      'WDU',
      'WEA',
      'WED',
      'WEE',
      'WEH',
      'WEL',
      'WEM',
      'WET',
      'WEY',
      'WFF',
      'WFH',
      'WFI',
      'WFJ',
      'WFL',
      'WFN',
      'WGA',
      'WGC',
      'WGN',
      'WGR',
      'WGT',
      'WGV',
      'WGW',
      'WHA',
      'WHC',
      'WHD',
      'WHE',
      'WHG',
      'WHI',
      'WHL',
      'WHM',
      'WHN',
      'WHP',
      'WHR',
      'WHS',
      'WHT',
      'WHY',
      'WIC',
      'WID',
      'WIH',
      'WIJ',
      'WIL',
      'WIM',
      'WIN',
      'WIV',
      'WKB',
      'WKD',
      'WKF',
      'WKG',
      'WKI',
      'WKK',
      'WKM',
      'WLC',
      'WLD',
      'WLE',
      'WLF',
      'WLG',
      'WLI',
      'WLM',
      'WLN',
      'WLO',
      'WLP',
      'WLS',
      'WLT',
      'WLV',
      'WLW',
      'WLY',
      'WMA',
      'WMB',
      'WMC',
      'WMD',
      'WME',
      'WMG',
      'WMI',
      'WML',
      'WMN',
      'WMR',
      'WMS',
      'WMW',
      'WNC',
      'WND',
      'WNE',
      'WNF',
      'WNG',
      'WNH',
      'WNL',
      'WNM',
      'WNN',
      'WNP',
      'WNR',
      'WNS',
      'WNT',
      'WNW',
      'WNY',
      'WOB',
      'WOF',
      'WOH',
      'WOK',
      'WOL',
      'WOM',
      'WON',
      'WOO',
      'WOP',
      'WOR',
      'WOS',
      'WPE',
      'WPL',
      'WRB',
      'WRE',
      'WRH',
      'WRK',
      'WRL',
      'WRM',
      'WRN',
      'WRP',
      'WRS',
      'WRT',
      'WRU',
      'WRW',
      'WRX',
      'WRY',
      'WSA',
      'WSB',
      'WSE',
      'WSF',
      'WSH',
      'WSL',
      'WSM',
      'WSR',
      'WST',
      'WSU',
      'WSW',
      'WTA',
      'WTB',
      'WTC',
      'WTE',
      'WTG',
      'WTH',
      'WTI',
      'WTL',
      'WTM',
      'WTN',
      'WTO',
      'WTR',
      'WTS',
      'WTT',
      'WTY',
      'WVF',
      'WVH',
      'WWA',
      'WWC',
      'WWD',
      'WWI',
      'WWO',
      'WWR',
      'WWW',
      'WXC',
      'WYB',
      'WYE',
      'WYL',
      'WYM',
      'WYT',
      'YAE',
      'YAL',
      'YAT',
      'YEO',
      'YET',
      'YMH',
      'YNW',
      'YOK',
      'YRD',
      'YRK',
      'YRM',
      'YRT',
      'YSM',
      'YSR',
      'YVJ',
      'YVP',
      'ZCW',
      'ZFD',
      'ZLW',
    ]
  }

  get ADDITIONAL_STATIONS() {
    return [
      {
        title: 'Amsterdam Centraal (AMS)',
        value: 'AMS',
      },
      {
        title: 'Brodick (Bus) (BDC)',
        value: 'BDC',
      },
      {
        title: 'Benton (Tyne & Wear Metro) (BNO)',
        value: 'BNO',
      },
      {
        title: 'Brussels (Bruxelles) (BXS)',
        value: 'BXS',
      },
      {
        title: 'Craignure, Mull (Bus) (CRU)',
        value: 'CRU',
      },
      {
        title: 'Castlebay, Barra (Bus) (CTB)',
        value: 'CTB',
      },
      {
        title: 'Colonsay (Bus) (CYA)',
        value: 'CYA',
      },
      {
        title: 'Douglas, Isle of Man (DGS)',
        value: 'DGS',
      },
      {
        title: 'Derker, Metrolink (DKR)',
        value: 'DKR',
      },
      {
        title: 'Dean Lane, Metrolink (DNN)',
        value: 'DNN',
      },
      {
        title: 'Edinburgh Bus Station (EBS)',
        value: 'EBS',
      },
      {
        title: 'Eigg (Bus) (EIG)',
        value: 'EIG',
      },
      {
        title: 'Folkestone Harbour (Bus) (FKH)',
        value: 'FKH',
      },
      {
        title: 'Failsworth, Metrolink (FLS)',
        value: 'FLS',
      },
      {
        title: 'Groombridge (Bus) (GRO)',
        value: 'GRO',
      },
      {
        title: 'Hollinwood (HOD)',
        value: 'HOD',
      },
      {
        title: 'Hunstanton (Bus) (HUS)',
        value: 'HUS',
      },
      {
        title: 'Hythe Waterside (Bus) (HYZ)',
        value: 'HYZ',
      },
      {
        title: 'IBM (IBM)',
        value: 'IBM',
      },
      {
        title: 'Kilcreggan (Bus) (KCG)',
        value: 'KCG',
      },
      {
        title: 'Lochboisdale, South Uist (Bus) (LCB)',
        value: 'LCB',
      },
      {
        title: 'Lochmaddy, North Uist (Bus) (LCH)',
        value: 'LCH',
      },
      {
        title: 'Marne-la-Vallée (MCK)',
        value: 'MCK',
      },
      {
        title: 'Milnrow, Metrolink (MLR)',
        value: 'MLR',
      },
      {
        title: 'Monument (MMT)',
        value: 'MMT',
      },
      {
        title: 'Manors (MRM)',
        value: 'MRM',
      },
      {
        title: 'Muck (Bus) (MUK)',
        value: 'MUK',
      },
      {
        title: 'Newhey, Metrolink (NHY)',
        value: 'NHY',
      },
      {
        title: 'Norden, Swanage Railway (NOD)',
        value: 'NOD',
      },
      {
        title: 'Newhaven Marine (closed) (NVM)',
        value: 'NVM',
      },
      {
        title: 'Oldham Mumps, Metrolink (OLM)',
        value: 'OLM',
      },
      {
        title: 'Oldham Werneth (closed) (OLW)',
        value: 'OLW',
      },
      {
        title: 'Pelaw (Tyne & Wear Metro) (PAW)',
        value: 'PAW',
      },
      {
        title: 'Paris Nord (PBN)',
        value: 'PBN',
      },
      {
        title: 'Peebles Bus Stop (PBS)',
        value: 'PBS',
      },
      {
        title: 'Porthmadog Harbour (Bus) (PMG)',
        value: 'PMG',
      },
      {
        title: 'British Steel Redcar (closed) (RBS)',
        value: 'RBS',
      },
      {
        title: 'Rotterdam (ROT)',
        value: 'ROT',
      },
      {
        title: 'Rosslare Europort (RSB)',
        value: 'RSB',
      },
      {
        title: 'Rothesay, Bute (Bus) (RTY)',
        value: 'RTY',
      },
      {
        title: 'Scrabster (Bus) (SCB)',
        value: 'SCB',
      },
      {
        title: 'Swanage, Swanage Railway (SGE)',
        value: 'SGE',
      },
      {
        title: 'Shaw & Crompton, Metrolink (SHA)',
        value: 'SHA',
      },
      {
        title: 'Stretford, Metrolink (SRF)',
        value: 'SRF',
      },
      {
        title: 'Stranraer West Pier (Bus) (SWP)',
        value: 'SWP',
      },
      {
        title: 'Tarbert, Harris (Bus) (TBT)',
        value: 'TBT',
      },
      {
        title: 'Tiree (Bus) (TEE)',
        value: 'TEE',
      },
      {
        title: 'Tobermory, Mull (Bus) (TOB)',
        value: 'TOB',
      },
      {
        title: 'Ullapool (Bus) (ULP)',
        value: 'ULP',
      },
      {
        title: 'West Cowes (WTW)',
        value: 'WTW',
      },
      {
        title: 'Weymouth Quay (WYQ)',
        value: 'WYQ',
      },
      {
        title: 'Birmingham Airport (Bus) (XFG)',
        value: 'XFG',
      },
      {
        title: 'Barbican Underground (ZBB)',
        value: 'ZBB',
      },
    ]
  }

  protected stationItemCache: { title: string; value: string }[] | null = null

  get STATIONS_AS_ITEMS(): { title: string; value: string }[] {
    if (!this.stationItemCache) {
      this.stationItemCache = this.STATIONS.map(s => {
        const stn = getStationByCrs(s)
        return { title: stn ? `${stn.stationName} (${s})` : `Unknown name (${s})`, value: s }
      }).concat(this.ADDITIONAL_STATIONS)
    }

    return this.stationItemCache
  }

  protected get SHORT_PLATFORMS() {
    return [
      { value: 'front.1', title: 'Front coach' },
      { value: 'front.2', title: 'Front 2 coaches' },
      { value: 'front.3', title: 'Front 3 coaches' },
      { value: 'front.4', title: 'Front 4 coaches' },
      { value: 'front.5', title: 'Front 5 coaches' },
      { value: 'front.6', title: 'Front 6 coaches' },
      { value: 'front.7', title: 'Front 7 coaches' },
      { value: 'front.8', title: 'Front 8 coaches' },
      { value: 'front.9', title: 'Front 9 coaches' },
      { value: 'front.10', title: 'Front 10 coaches' },
      { value: 'front.11', title: 'Front 11 coaches' },
      { value: 'front.12', title: 'Front 12 coaches' },
      { value: 'middle.1', title: 'Middle coach' },
      { value: 'middle.2', title: 'Middle 2 coaches' },
      { value: 'middle.3', title: 'Middle 3 coaches' },
      { value: 'middle.4', title: 'Middle 4 coaches' },
      { value: 'middle.5', title: 'Middle 5 coaches' },
      { value: 'middle.6', title: 'Middle 6 coaches' },
      { value: 'middle.7', title: 'Middle 7 coaches' },
      { value: 'middle.8', title: 'Middle 8 coaches' },
      { value: 'middle.9', title: 'Middle 9 coaches' },
      { value: 'middle.10', title: 'Middle 10 coaches' },
      { value: 'middle.11', title: 'Middle 11 coaches' },
      { value: 'middle.12', title: 'Middle 12 coaches' },
      { value: 'rear.1', title: 'Rear coach' },
      { value: 'rear.2', title: 'Rear 2 coaches' },
      { value: 'rear.3', title: 'Rear 3 coaches' },
      { value: 'rear.4', title: 'Rear 4 coaches' },
      { value: 'rear.5', title: 'Rear 5 coaches' },
      { value: 'rear.6', title: 'Rear 6 coaches' },
      { value: 'rear.7', title: 'Rear 7 coaches' },
      { value: 'rear.8', title: 'Rear 8 coaches' },
      { value: 'rear.9', title: 'Rear 9 coaches' },
      { value: 'rear.10', title: 'Rear 10 coaches' },
      { value: 'rear.11', title: 'Rear 11 coaches' },
      { value: 'rear.12', title: 'Rear 12 coaches' },
    ]
  }

  protected get SPLITS() {
    return [
      { value: 'front.1', title: 'Front coach' },
      { value: 'front.2', title: 'Front 2 coaches' },
      { value: 'front.3', title: 'Front 3 coaches' },
      { value: 'front.4', title: 'Front 4 coaches' },
      { value: 'front.5', title: 'Front 5 coaches' },
      { value: 'front.6', title: 'Front 6 coaches' },
      { value: 'front.7', title: 'Front 7 coaches' },
      { value: 'front.8', title: 'Front 8 coaches' },
      { value: 'front.9', title: 'Front 9 coaches' },
      { value: 'front.10', title: 'Front 10 coaches' },
      { value: 'front.11', title: 'Front 11 coaches' },
      { value: 'front.12', title: 'Front 12 coaches' },
      // { value: 'middle.1', title: 'Middle coach' },
      // { value: 'middle.2', title: 'Middle 2 coaches' },
      // { value: 'middle.3', title: 'Middle 3 coaches' },
      // { value: 'middle.4', title: 'Middle 4 coaches' },
      // { value: 'middle.5', title: 'Middle 5 coaches' },
      // { value: 'middle.6', title: 'Middle 6 coaches' },
      // { value: 'middle.7', title: 'Middle 7 coaches' },
      // { value: 'middle.8', title: 'Middle 8 coaches' },
      // { value: 'middle.9', title: 'Middle 9 coaches' },
      // { value: 'middle.10', title: 'Middle 10 coaches' },
      // { value: 'middle.11', title: 'Middle 11 coaches' },
      // { value: 'middle.12', title: 'Middle 12 coaches' },
      { value: 'rear.1', title: 'Rear coach' },
      { value: 'rear.2', title: 'Rear 2 coaches' },
      { value: 'rear.3', title: 'Rear 3 coaches' },
      { value: 'rear.4', title: 'Rear 4 coaches' },
      { value: 'rear.5', title: 'Rear 5 coaches' },
      { value: 'rear.6', title: 'Rear 6 coaches' },
      { value: 'rear.7', title: 'Rear 7 coaches' },
      { value: 'rear.8', title: 'Rear 8 coaches' },
      { value: 'rear.9', title: 'Rear 9 coaches' },
      { value: 'rear.10', title: 'Rear 10 coaches' },
      { value: 'rear.11', title: 'Rear 11 coaches' },
      { value: 'rear.12', title: 'Rear 12 coaches' },
    ]
  }

  get ALL_AVAILABLE_TOCS() {
    return [...this.AVAILABLE_TOCS.standaloneOnly, ...this.AVAILABLE_TOCS.withServiceToFrom].sort((a, b) => a.localeCompare(b))
  }

  processTocForLiveTrains(
    tocName: string,
    tocCode: string,
    originCrs: string,
    destinationCrs: string,
    useLegacy: boolean,
    trainUid: string,
  ): string {
    if (useLegacy) {
      switch (tocCode.toUpperCase()) {
        case 'AW':
          return 'arriva trains wales'
        case 'CC':
          return 'c2c'
        case 'CH':
          return 'chiltern railways'
        case 'CS':
          return 'caledonian sleeper'
        case 'EM':
          return 'east midlands railway'
        case 'ES':
          return 'eurostar'
        case 'GC':
          return 'grand central'
        case 'GN':
          return 'first capital connect'
        case 'GR':
          return 'national express east coast'
        case 'GW':
          const namedMatch = Object.entries(NamedServices.GW.services)
            .find(([_, uids]) => uids.includes(trainUid))?.[0]
            ?.toLowerCase()

          console.log('GWR named service match: ', trainUid, namedMatch)

          if (namedMatch && this.ALL_AVAILABLE_TOCS.map(s => s.toLowerCase()).includes(`first great western ${namedMatch}`))
            return `first great western ${namedMatch}`

          return 'first great western'
        case 'GX':
          return 'gatwick express'
        case 'HT':
          return 'hull trains'
        case 'HX':
          return 'heathrow express'
        case 'IL':
          return 'island line'
        // case 'LD':
        //   return ''
        case 'LE':
          // Typically didn't appear in announcements because 'one' presents confusion with times
          // return 'one'
          return ''
        case 'LM':
          return 'london midland'
        case 'LO':
          return 'london overground'
        // return 'silverlink metro'
        case 'ME':
          return 'merseyrail'
        case 'NT':
          return 'northern rail'
        // return 'arriva trains northern'
        case 'SE':
          return 'southeastern'
        case 'SN':
          return 'southern'
        case 'SR':
          return 'scotrail'
        case 'SW':
          return 'south west trains'
        case 'TL':
          return 'first capital connect'
        case 'TP':
          return 'first transpennine express'
        case 'TW':
          return 'tyne and wear metro'
        case 'VT':
          return 'virgin trains'
        case 'XC':
          return 'virgin trains'
        // case 'XR':
        //   return ''

        default:
          return this.ALL_AVAILABLE_TOCS.find(t => t?.toLowerCase() === tocName?.toLowerCase()) ?? ''
      }
    }

    switch (tocCode.toUpperCase()) {
      default:
        return this.ALL_AVAILABLE_TOCS.find(t => t?.toLowerCase() === tocName?.toLowerCase()) ?? ''

      // LNER has different filename compared to TOC name
      case 'GR':
        return 'london north eastern railway'

      // Handle named GWR services
      case 'GW':
        const namedMatch = Object.entries(NamedServices.GW.services)
          .find(([_, uids]) => uids.includes(trainUid))?.[0]
          ?.toLowerCase()

        console.log('GWR named service match:', trainUid, namedMatch)

        if (namedMatch && this.ALL_AVAILABLE_TOCS.map(s => s.toLowerCase()).includes(`great western railway ${namedMatch}`))
          return `great western railway ${namedMatch}`

        return 'great western railway'

      // West Midlands Trains
      case 'LM':
        // https://www.westmidlandsrailway.co.uk/media/3657/download?inline
        const lnwr = ['EUS', 'CRE', 'BDM', 'SAA', 'MKC', 'TRI', 'LIV', 'NMP']
        if (lnwr.includes(originCrs) || lnwr.includes(destinationCrs)) {
          return 'london northwestern railway'
        } else {
          return 'west midlands railway'
        }
    }
  }

  liveTrainsTiplocStationOverrides(tiploc: string): string | null {
    switch (tiploc) {
      case 'STPX': // STP EMR
        return 'STP'
      case 'STPXBOX': // STP low level
      case 'STPANCI': // STP high speed
        return 'STP - St Pancras International'
    }

    return null
  }

  protected getChime(chime: ChimeType, addFanfare: boolean = false): AudioItem | null {
    switch (chime) {
      case 'none':
        if (addFanfare) return { id: 'sfx - fanfare', opts: { customPrefix: 'station/ketech' } }
        else return null

      default:
        return { id: `sfx - ${addFanfare ? 'fanfare and ' : ''}${chime} chimes`, opts: { customPrefix: 'station/ketech' } }
    }
  }

  private async getFilesForBasicTrainInfo(
    hour: string,
    min: string,
    toc: string,
    vias: string[],
    terminatingStation: string,
    callingPoints: CallingAtPoint[],
    stationsAlwaysMiddle: boolean = false,
    fromAudio: AudioItem[] = [],
    delay: number = 0,
  ): Promise<AudioItem[]> {
    const files: AudioItem[] = [{ id: `hour.s.${hour}`, opts: { delayStart: delay } }, `mins.m.${min}`]

    const _fromAudio = fromAudio.length ? [...fromAudio, 'm.to'] : []

    if (toc === '') {
      files.push(
        {
          id: _fromAudio.length ? `m.service from` : `m.service to`,
          opts: { delayStart: 50 },
        },
        ..._fromAudio,
      )
    } else {
      if (this.AVAILABLE_TOCS.standaloneOnly.some(x => x.toLowerCase() === toc.toLowerCase())) {
        files.push(
          {
            id: `toc.m.${toc.toLowerCase()}`,
            opts: { delayStart: this.BEFORE_TOC_DELAY },
          },
          _fromAudio.length ? `m.service from` : `m.service to`,
          ..._fromAudio,
        )
      } else {
        files.push(
          {
            id: `toc.m.${toc.toLowerCase()} ${_fromAudio.length ? 'service from' : 'service to'}`,
            opts: { delayStart: this.BEFORE_TOC_DELAY },
          },
          ..._fromAudio,
        )
      }
    }

    const dividesAt = callingPoints.find(s => s.splitType === 'splitTerminates' || s.splitType === 'splits')

    if (dividesAt && (dividesAt.splitCallingPoints?.length ?? 0) > 0) {
      const allDestinations = [
        terminatingStation,
        dividesAt.splitType === 'splitTerminates'
          ? dividesAt.crsCode
          : dividesAt.splitCallingPoints!![dividesAt.splitCallingPoints!!.length - 1].crsCode,
      ]

      files.push(
        ...this.pluraliseAudio(allDestinations, {
          prefix: 'station.m.',
          finalPrefix: stationsAlwaysMiddle ? 'station.m.' : 'station.e.',
          andId: 'm.and',
          firstItemDelay: 100,
          beforeAndDelay: 100,
          beforeItemDelay: 50,
        }),
      )
    } else {
      if (vias.length !== 0) {
        files.push(
          `station.m.${terminatingStation}`,
          'm.via',
          ...this.pluraliseAudio(
            vias.map((stn, i) => `station.${!stationsAlwaysMiddle && i === vias.length - 1 ? 'e' : 'm'}.${stn}`),
            {
              andId: 'm.and',
              beforeAndDelay: 100,
            },
          ),
        )
      } else {
        files.push(`station.${stationsAlwaysMiddle ? 'm' : 'e'}.${terminatingStation}`)
      }
    }

    return files
  }

  private async getFilesForBasicTrainInfoLive(
    hour: string,
    min: string,
    toc: string,
    vias: string[][],
    terminatingStation: string[],
    stationsAlwaysMiddle: boolean = false,
    fromAudio: AudioItem[] = [],
    delay: number = 0,
  ): Promise<AudioItem[]> {
    const files: AudioItem[] = [{ id: `hour.s.${hour}`, opts: { delayStart: delay } }, `mins.m.${min}`]

    const _fromAudio = fromAudio.length ? [...fromAudio, 'm.to'] : []

    if (toc === '') {
      files.push(
        {
          id: _fromAudio.length ? `m.service from` : `m.service to`,
          opts: { delayStart: 50 },
        },
        ..._fromAudio,
      )
    } else {
      if (this.AVAILABLE_TOCS.standaloneOnly.some(x => x.toLowerCase() === toc.toLowerCase())) {
        files.push(
          {
            id: `toc.m.${toc.toLowerCase()}`,
            opts: { delayStart: this.BEFORE_TOC_DELAY },
          },
          _fromAudio.length ? `m.service from` : `m.service to`,
          ..._fromAudio,
        )
      } else {
        files.push(
          {
            id: `toc.m.${toc.toLowerCase()} ${_fromAudio.length ? 'service from' : 'service to'}`,
            opts: { delayStart: this.BEFORE_TOC_DELAY },
          },
          ..._fromAudio,
        )
      }
    }

    const tStationLength = terminatingStation.length
    terminatingStation.forEach((t, i) => {
      const viasForThisTerminatingStation = vias[i]
      const isEnd = i === tStationLength - 1

      if (viasForThisTerminatingStation.length !== 0) {
        files.push(
          `station.m.${t}`,
          'm.via',
          ...this.pluraliseAudio(
            viasForThisTerminatingStation.map(
              (stn, i) => `station.${!stationsAlwaysMiddle && i === viasForThisTerminatingStation.length - 1 ? 'e' : 'm'}.${stn}`,
            ),
            {
              andId: 'm.and',
              beforeAndDelay: 100,
            },
          ),
        )
      } else {
        files.push(`station.${isEnd && !stationsAlwaysMiddle ? 'e' : 'm'}.${t}`)
      }

      if (!isEnd) {
        files.push('m.and')
      }
    })

    return files
  }

  private async getShortPlatforms(
    callingPoints: CallingAtPoint[],
    terminatingStation: string,
    overallLength: number | null,
    announceAfterSplit: boolean = false,
  ): Promise<AudioItem[]> {
    const files: AudioItem[] = []
    const unknownPositionSnippet = this.shortPlatformOptions.unknownLocation

    const splitData = this.getSplitInfo(callingPoints, terminatingStation, overallLength)
    const allStops = splitData.stopsUpToSplit.concat(splitData.splitA?.stops ?? []).concat(splitData.splitB?.stops ?? [])

    function shortDataToAudio(shortData: string, stopData: SplitInfoStop['portion']): AudioItem[] {
      const files: AudioItem[] = []

      const [pos, len] = shortData.split('.').map((x, i) => (i === 1 ? parseInt(x) : x)) as [string, number]

      if (stopData.position === 'any') {
        if (pos === 'unknown') {
          files.push(unknownPositionSnippet)
        } else {
          if (len === 1) {
            files.push(`e.should join the ${pos} coach only`)
          } else {
            files.push(`e.should join the ${pos} ${len} coaches`)
          }
        }
      } else if (announceAfterSplit) {
        if (pos === 'unknown') {
          files.push(unknownPositionSnippet)
        } else if (stopData.position === pos) {
          if (len === 1) {
            files.push(`e.should join the ${pos} coach only`)
          } else {
            files.push(`e.should join the ${pos} ${len} coaches`)
          }
        } else {
          if (len === 1) {
            files.push(`m.should join the ${pos} coach only`)
          } else {
            files.push(`e.should join the ${pos} ${len} coaches`)
          }
          if (stopData.length === 1) {
            files.push('m.of', 'm.the', `m.${stopData.position}`, 'e.coach')
          } else {
            files.push('m.of', 'm.the', `m.${stopData.position}`, `platform.s.${stopData.length}`, 'e.coaches')
          }
        }
      }

      return files
    }

    const shortPlatforms = allStops.reduce(
      (acc, curr) => {
        if (!curr.shortPlatform) return acc

        const data = shortDataToAudio(curr.shortPlatform, curr.portion).join(',')
        if (!data) return acc

        if (acc[data]) {
          acc[data].push(curr.crsCode)
        } else {
          acc[data] = [curr.crsCode]
        }

        return acc
      },
      {} as Record<string, string[]>,
    )

    const order = Object.keys(shortPlatforms).sort((a, b) => a.localeCompare(b))
    let firstAdded = false

    order.forEach((s, i) => {
      const plats = shortPlatforms[s]

      if (!firstAdded) {
        if (order.length === 1 && plats.length === 1) {
          files.push(
            { id: 'm.due to a short platform at', opts: { delayStart: this.BEFORE_SECTION_DELAY } },
            `station.m.${plats[0]}`,
            'm.customers for this station',
            ...s.split(','),
          )
        } else {
          files.push(
            { id: 's.due to short platforms customers for', opts: { delayStart: this.BEFORE_SECTION_DELAY } },
            ...this.pluraliseAudio(plats, {
              prefix: 'station.m.',
              finalPrefix: 'station.m.',
              andId: 'm.and',
              firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
              beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
              beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
              afterAndDelay: this.callingPointsOptions.aroundAndDelay,
            }),
            ...s.split(','),
          )
        }
      } else {
        files.push(
          {
            // If last set of short platforms, add 'and' before last item
            // See: https://github.com/davwheat/rail-announcements/issues/226#issuecomment-2212472715
            id: i === order.length - 1 ? 'm.and customers for' : 'm.customers for',
            opts: { delayStart: i === order.length - 1 ? 0 : 200 },
          },
          ...this.pluraliseAudio(plats, {
            prefix: 'station.m.',
            finalPrefix: 'station.m.',
            andId: 'm.and',
            firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
            beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
            beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
            afterAndDelay: this.callingPointsOptions.aroundAndDelay,
          }),
          ...s.split(','),
        )
      }

      firstAdded = true
    })

    return files
  }

  private async getRequestStops(
    callingPoints: CallingAtPoint[],
    terminatingStation: string,
    overallLength: number | null,
  ): Promise<AudioItem[]> {
    const files: AudioItem[] = []

    const splitData = this.getSplitInfo(callingPoints, terminatingStation, overallLength)
    const allStops = splitData.stopsUpToSplit.concat(splitData.splitA?.stops ?? []).concat(splitData.splitB?.stops ?? [])

    const reqStops = new Set(allStops.filter(s => s.requestStop).map(s => s.crsCode))
    if (reqStops.size === 0) return []

    //? KeTech style:
    //
    // files.push(
    //   ...this.pluraliseAudio(Array.from(reqStops), {
    //     prefix: 'station.m.',
    //     finalPrefix: 'station.m.',
    //     andId: 'm.and',
    // firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
    // beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
    // beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
    // afterAndDelay: this.callingPointsOptions.aroundAndDelay,
    //   }),
    //   reqStops.size === 1 ? 'm.is a request stop and customers for this station' : 'm.are request stops and customers for these stations',
    //   'm.should ask the conductor on the train to arrange for the train to stop',
    //   'e.to allow them to alight',
    // )

    files.push(
      { id: 's.customers may request to stop at', opts: { delayStart: 400 } },
      ...this.pluraliseAudio(Array.from(reqStops), {
        prefix: 'station.m.',
        finalPrefix: 'station.m.',
        andId: this.requestStopOptions.andId,
        firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
        beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
        beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
        afterAndDelay: this.callingPointsOptions.aroundAndDelay,
      }),
      'e.by contacting the conductor on board the train',
    )

    return files
  }

  private getSplitInfo(
    callingPoints: CallingAtPoint[],
    terminatingStation: string,
    overallLength: number | null,
  ): {
    divideType: CallingAtPoint['splitType']
    stopsUpToSplit: SplitInfoStop[]
    splitA: {
      stops: SplitInfoStop[]
      position: 'front' | 'middle' | 'rear' | 'unknown'
      length: number | null
    } | null
    splitB: {
      stops: SplitInfoStop[]
      position: 'front' | 'middle' | 'rear' | 'unknown'
      length: number | null
    } | null
  } {
    // If there are no splits, return an empty array
    if (callingPoints.every(p => p.splitType === 'none' || p.splitType === undefined)) {
      return {
        divideType: 'none',
        stopsUpToSplit: callingPoints.map(p => ({
          crsCode: p.crsCode,
          shortPlatform: p.shortPlatform ?? '',
          requestStop: p.requestStop ?? false,
          portion: { position: 'any', length: overallLength },
        })),
        splitA: null,
        splitB: null,
      }
    }

    const stopsUntilFormationChange: CallingAtPoint[] = []
    let dividePoint: CallingAtPoint | undefined = undefined
    const stopsAfterFormationChange: CallingAtPoint[] = []

    {
      let preSplit = true

      callingPoints.forEach(p => {
        if (preSplit) {
          stopsUntilFormationChange.push(p)

          if (p.splitType !== 'none' && p.splitType !== undefined) {
            dividePoint = p
          }
        } else {
          stopsAfterFormationChange.push(p)
        }

        preSplit &&= p.splitType === 'none' || p.splitType === undefined
      })
    }

    stopsAfterFormationChange.push(
      stationItemCompleter({
        crsCode: terminatingStation,
      }),
    )

    const [bPos, bCount] = (dividePoint!!.splitForm ?? 'front.1').split('.').map((x, i) => (i === 1 ? parseInt(x) : x)) as [
      'front' | 'middle' | 'rear' | 'unknown',
      number,
    ]
    const aPos = bPos === 'front' ? 'rear' : 'front'
    const aCount = !overallLength ? null : Math.min(Math.max(1, overallLength - bCount), 12)

    const missingLengthData = !overallLength || !bCount || !aCount

    console.log({ missingLengthData, overallLength, bPos, bCount, aPos, aCount })

    if (missingLengthData) {
      console.log('Missing split formation length data :(')

      return {
        divideType: dividePoint!!.splitType,
        stopsUpToSplit: stopsUntilFormationChange.map(p => ({
          crsCode: p.crsCode,
          shortPlatform: p.shortPlatform ?? '',
          requestStop: p.requestStop ?? false,
          portion: { position: 'any', length: null },
        })),
        splitB: {
          stops: (dividePoint!!.splitCallingPoints ?? []).map(p => ({
            crsCode: p.crsCode,
            shortPlatform: p.shortPlatform ? 'unknown' : '',
            requestStop: p.requestStop ?? false,
            portion: { position: bPos, length: null },
          })),
          position: bPos,
          length: null,
        },
        splitA: {
          stops: stopsAfterFormationChange.map(p => ({
            crsCode: p.crsCode,
            shortPlatform: p.shortPlatform ? 'unknown' : '',
            requestStop: p.requestStop ?? false,
            portion: { position: aPos, length: null },
          })),
          position: aPos,
          length: null,
        },
      }
    }

    console.log('Got split formation length data :)')
    console.log({ bPos, bCount, aPos, aCount })

    return {
      divideType: dividePoint!!.splitType,
      stopsUpToSplit: stopsUntilFormationChange.map(p => ({
        crsCode: p.crsCode,
        shortPlatform: p.shortPlatform ?? '',
        requestStop: p.requestStop ?? false,
        portion: { position: 'any', length: overallLength },
      })),
      splitB: {
        stops:
          dividePoint!!.splitType === 'splitTerminates'
            ? []
            : (dividePoint!!.splitCallingPoints ?? []).map(p => {
                let [shortPortion, shortLength] = (p.shortPlatform || '.').split('.')

                if (shortPortion && shortLength) {
                  const shortLengthNum = parseInt(shortLength)
                  // If the short length is greater than or equal to the length of the portion, it's not a short platform for this portion of the train
                  if (shortLengthNum >= bCount) {
                    shortPortion = ''
                    shortLength = ''
                  }
                }

                const shortPlatform = shortPortion && shortLength ? `${shortPortion}.${shortLength}` : ''

                return {
                  crsCode: p.crsCode,
                  shortPlatform,
                  requestStop: p.requestStop ?? false,
                  portion: { position: bPos as 'front' | 'middle' | 'rear', length: bCount },
                }
              }),
        position: bPos as 'front' | 'middle' | 'rear',
        length: bCount,
      },
      splitA: {
        stops: stopsAfterFormationChange.map(p => {
          let [shortPortion, shortLength] = (p.shortPlatform || '.').split('.')

          if (shortPortion && shortLength) {
            const shortLengthNum = parseInt(shortLength)
            // If the short length is greater than or equal to the length of the portion, it's not a short platform for this portion of the train
            if (shortLengthNum >= aCount) {
              shortPortion = ''
              shortLength = ''
            }
          }

          const shortPlatform = shortPortion && shortLength ? `${shortPortion}.${shortLength}` : ''

          return {
            crsCode: p.crsCode,
            shortPlatform,
            requestStop: p.requestStop ?? false,
            portion: { position: aPos, length: aCount },
          }
        }),
        position: aPos,
        length: aCount,
      },
    }
  }

  protected readonly splitOptions = {
    travelInCorrectPartId: ['s.please make sure you travel', 'e.in the correct part of this train'],
    travelInAnyPartIds: ['e.may travel in any part of the train'],
  }

  private async getCallingPointsWithBusContinuance(callingPoints: CallingAtPoint[], terminatingStation: string): Promise<AudioItem[]> {
    const files: AudioItem[] = []

    const rrbAfterIndex = callingPoints.findIndex(p => p.continuesAsRrbAfterHere)
    const restartAsTrainAfterIndex = callingPoints.findIndex(p => p.continuesAsTrainAfterHere)

    const upToRrb = callingPoints.slice(0, rrbAfterIndex + 1)
    const rrbCalls = callingPoints.slice(
      rrbAfterIndex + 1,
      restartAsTrainAfterIndex === -1 ? Number.MAX_SAFE_INTEGER : restartAsTrainAfterIndex + 1,
    )
    const restartedTrainCalls = restartAsTrainAfterIndex === -1 ? [] : callingPoints.slice(restartAsTrainAfterIndex + 1)

    if (upToRrb.length >= 1) {
      files.push({ id: 'm.calling at', opts: { delayStart: this.callingPointsOptions.beforeCallingAtDelay } })

      files.push(
        ...this.pluraliseAudio(
          upToRrb.map(s => `station.m.${s.crsCode}`),
          {
            andId: 'm.and',
            firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
            beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
            beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
            afterAndDelay: this.callingPointsOptions.aroundAndDelay,
          },
        ),
      )
    }

    files.push(this.callingPointsOptions.rrbTerminateAudio, {
      id: 's.a replacement bus service will then continue to',
      opts: { delayStart: this.SHORT_DELAY },
    })

    files.push(
      ...this.pluraliseAudio(
        rrbCalls.map(s => `station.m.${s.crsCode}`).concat(restartAsTrainAfterIndex !== -1 ? [] : [`station.m.${terminatingStation}`]),
        {
          andId: 'm.and',
          firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
          beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
          beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
          afterAndDelay: this.callingPointsOptions.aroundAndDelay,
        },
      ),
    )

    if (restartAsTrainAfterIndex !== -1) {
      files.push(
        'm.where the train will restart for-2',
        ...(restartedTrainCalls.length > 0
          ? this.pluraliseAudio(restartedTrainCalls.map(s => `station.m.${s.crsCode}`).concat([`station.e.${terminatingStation}`]), {
              andId: 'm.and',
              firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
              beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
              beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
              afterAndDelay: this.callingPointsOptions.aroundAndDelay,
            })
          : [`station.m.${terminatingStation}`, 'e.only']),
      )
    } else {
      files.push('e.where the train was originally due to terminate')
    }

    return files
  }

  private async getCallingPointsWithSplits(
    callingPoints: CallingAtPoint[],
    terminatingStation: string,
    overallLength: number | null,
    arriving: boolean,
  ): Promise<AudioItem[]> {
    const files: AudioItem[] = []

    const splitData = this.getSplitInfo(callingPoints, terminatingStation, overallLength)

    if (splitData.divideType === 'none') {
      return []
    }

    const splitPoint = splitData.stopsUpToSplit[splitData.stopsUpToSplit.length - 1]

    files.push(
      ...this.pluraliseAudio(
        splitData.stopsUpToSplit.filter(s => !s.requestStop).map(s => `station.m.${s.crsCode}`),
        {
          andId: 'm.and',
          firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
          beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
          beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
          afterAndDelay: this.callingPointsOptions.aroundAndDelay,
        },
      ),
    )

    switch (splitData.divideType) {
      case 'splitTerminates':
        files.push(
          'e.where the train will divide',
          {
            id: this.splitOptions.travelInCorrectPartId[0],
            opts: { delayStart: 400 },
          },
          ...this.splitOptions.travelInCorrectPartId.slice(1),
        )

        if (splitData.splitB!!.position === 'unknown') {
          files.push({ id: `s.please note that`, opts: { delayStart: 400 } }, `m.coaches`, `m.will be detached and will terminate at`)
        } else {
          files.push(
            { id: `s.please note that the ${splitData.splitB!!.position}`, opts: { delayStart: 400 } },
            `m.${splitData.splitB!!.length === 1 ? 'coach' : `${splitData.splitB!!.length} coaches`} will detach at`,
          )
        }

        files.push(`station.e.${splitPoint.crsCode}`)
        break

      case 'splits':
        files.push(
          'e.where the train will divide',
          {
            id: this.splitOptions.travelInCorrectPartId[0],
            opts: { delayStart: 400 },
          },
          ...this.splitOptions.travelInCorrectPartId.slice(1),
        )

        if (!splitData.splitB!!.stops.length) throw new Error("Splitting train doesn't have any calling points")
        break
    }

    const aPortionStops = splitData.splitA!!.stops.map(s => s.crsCode)
    const bPortionStops = splitData.splitB!!.stops.map(s => s.crsCode)
    const anyPortionStops = splitData.stopsUpToSplit.map(s => s.crsCode)

    // Fix for the split point being in the split portion calling points
    if (aPortionStops[0] === splitPoint.crsCode) aPortionStops.shift()
    if (bPortionStops[0] === splitPoint.crsCode) bPortionStops.shift()

    // Note to future me:
    //
    // The commented logic below handled common calling points in both portions of the train.
    // However, this is not needed as the logic on the real-world system didn't account for this.
    //
    // F.

    // const aPortionStops = new Set([...splitData.splitA!!.stops.map(s => s.crsCode)])
    // const bPortionStops = new Set([...splitData.splitB!!.stops.map(s => s.crsCode)])

    // const anyPortionStops = new Set([
    //   ...splitData.stopsUpToSplit.map(s => s.crsCode),
    //   ...Array.from(aPortionStops).filter(x => bPortionStops.has(x)),
    // ])

    // Array.from(anyPortionStops).forEach(s => {
    //   if (aPortionStops.has(s)) aPortionStops.delete(s)
    //   if (bPortionStops.has(s)) bPortionStops.delete(s)
    // })

    const listStops = (stops: string[]): AudioItem[] => {
      return [
        { id: 's.customers for', opts: { delayStart: 400 } },
        ...this.pluraliseAudio(
          stops.map(s => `station.m.${s}`),
          {
            andId: 'm.and',
            firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
            beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
            beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
            afterAndDelay: this.callingPointsOptions.aroundAndDelay,
          },
        ),
      ]
    }

    if (anyPortionStops.length !== 0) files.push(...listStops(Array.from(anyPortionStops)), ...this.splitOptions.travelInAnyPartIds)

    function shouldTravelIn(length: number | null, position: 'front' | 'middle' | 'rear'): AudioItem[] {
      if (length === null) {
        return [`e.should travel in the ${position} coaches of the train`]
      }

      if (length >= 2 && length <= 8) {
        return [`m.should travel in the ${position}`, `e.${length} coaches of the train`]
      } else if (length === 1) {
        return [`e.should travel in the ${position} coach of the train`]
      } else {
        return [`m.should travel in the ${position}`, `platform.s.${length}`, `e.coaches of the train`]
      }
    }

    const aFiles =
      aPortionStops.length === 0
        ? []
        : [
            ...listStops(Array.from(aPortionStops)),
            ...(splitData.splitA!!.position === 'unknown'
              ? ['w.please listen for announcements on board the train']
              : shouldTravelIn(splitData.splitA!!.length, splitData.splitA!!.position)),
          ]
    const bFiles =
      bPortionStops.length === 0
        ? []
        : [
            ...listStops(Array.from(bPortionStops)),
            ...(splitData.splitB!!.position === 'unknown'
              ? ['w.please listen for announcements on board the train']
              : shouldTravelIn(splitData.splitB!!.length, splitData.splitB!!.position)),
          ]

    if (splitData.splitA!!.position === 'front') {
      files.push(...aFiles, ...bFiles)
    } else {
      files.push(...bFiles, ...aFiles)
    }

    switch (splitData.divideType) {
      case 'splitTerminates':
      case 'splits':
        files.push(
          { id: `s.${arriving ? 'this' : 'the next'} train will divide at`, opts: { delayStart: 200 } },
          `station.e.${splitPoint.crsCode}`,
        )
        break
    }

    return files
  }

  private async getCallingPoints(
    callingPoints: CallingAtPoint[],
    terminatingStation: string,
    overallLength: number | null,
    arriving: boolean,
  ): Promise<AudioItem[]> {
    const files: AudioItem[] = []

    if (callingPoints.some(p => p.continuesAsRrbAfterHere)) {
      return await this.getCallingPointsWithBusContinuance(callingPoints, terminatingStation)
    }

    const callingPointsWithSplits = await this.getCallingPointsWithSplits(callingPoints, terminatingStation, overallLength, arriving)

    if (callingPointsWithSplits.length !== 0) {
      files.push({ id: 'm.calling at', opts: { delayStart: this.callingPointsOptions.beforeCallingAtDelay } }, ...callingPointsWithSplits)
      return files
    }

    files.push({ id: 'm.calling at', opts: { delayStart: this.callingPointsOptions.beforeCallingAtDelay } })

    if (callingPoints.length === 0) {
      files.push(`station.m.${terminatingStation}`, 'e.only')
    } else {
      files.push(
        ...this.pluraliseAudio(
          [...callingPoints.filter(s => !s.requestStop).map(stn => `station.m.${stn.crsCode}`), `station.e.${terminatingStation}`],
          {
            andId: 'm.and',
            firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
            beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
            beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
            afterAndDelay: this.callingPointsOptions.aroundAndDelay,
          },
        ),
      )
    }

    return files
  }

  async playNextTrainAnnouncement(options: INextTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    const chime = this.getChime(options.chime)
    if (chime) files.push(chime)

    const plat = parseInt(options.platform)

    const getPlatFiles = (delayStart: number = 250) => {
      const platFiles: AudioItem[] = []

      if (options.platform === '0') {
        platFiles.push({ id: this.genericOptions.platform, opts: { delayStart } }, `m.0`, options.isDelayed ? `m.for the delayed` : `m.for the`)
      } else if (plat <= 12 || ['a', 'b'].includes(options.platform.toLowerCase())) {
        platFiles.push({ id: `s.platform ${options.platform} for the`, opts: { delayStart } })
        if (options.isDelayed) platFiles.push('m.delayed')
      } else if (plat >= 21) {
        platFiles.push(
          { id: this.genericOptions.platform, opts: { delayStart } },
          `mins.m.${options.platform}`,
          options.isDelayed ? `m.for the delayed` : `m.for the`,
        )
      } else {
        platFiles.push(
          { id: this.genericOptions.platform, opts: { delayStart } },
          `platform.s.${options.platform}`,
          options.isDelayed ? `m.for the delayed` : `m.for the`,
        )
      }

      return platFiles
    }

    files.push(
      ...getPlatFiles(),
      ...(await this.getFilesForBasicTrainInfo(
        options.hour,
        options.min,
        options.toc,
        options.vias.map(s => s.crsCode),
        options.terminatingStationCode,
        options.callingAt,
      )),
    )

    try {
      files.push(
        ...(await this.getCallingPoints(
          options.callingAt,
          options.terminatingStationCode,
          options.coaches !== 'None' ? parseInt(options.coaches.split(' ')[0]) : null,
          false,
        )),
      )
    } catch (e) {
      if (e instanceof Error) {
        alert(e.message)
        console.error(e)
        return
      }
    }

    files.push(
      ...(await this.getShortPlatforms(
        options.callingAt,
        options.terminatingStationCode,
        options.coaches !== 'None' ? parseInt(options.coaches.split(' ')[0]) : null,
        options.announceShortPlatformsAfterSplit,
      )),
    )

    if (options.firstClassLocation !== 'none') {
      files.push(
        { id: `m.first class accommodation is situated at the`, opts: { delayStart: 500 } },
        `e.${options.firstClassLocation} of the train`,
      )
    }

    if (options.coaches !== 'None') {
      const coaches = options.coaches.split(' ')[0]

      // Platforms share the same audio as coach numbers
      files.push(
        { id: 's.this train is formed of', opts: { delayStart: 250 } },
        `platform.s.${coaches}`,
        `e.${coaches === '1' ? 'coach' : 'coaches'}`,
      )
    }

    files.push(
      ...(await this.getRequestStops(
        options.callingAt,
        options.terminatingStationCode,
        options.coaches !== 'None' ? parseInt(options.coaches.split(' ')[0]) : null,
      )),
    )

    if (options.notCallingAtStations.length > 0) {
      files.push(
        { id: 's.please note this train will not call at', opts: { delayStart: 250 } },
        ...this.pluraliseAudio(
          options.notCallingAtStations.map(s => s.crsCode),
          {
            prefix: 'station.m.',
            finalPrefix: 'station.e.',
            andId: 'm.and',
            firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
            beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
            beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
            afterAndDelay: this.callingPointsOptions.aroundAndDelay,
          },
        ),
      )
    }

    files.push(
      ...getPlatFiles(this.BEFORE_SECTION_DELAY),
      ...(await this.getFilesForBasicTrainInfo(
        options.hour,
        options.min,
        options.toc,
        options.vias.map(s => s.crsCode),
        options.terminatingStationCode,
        options.callingAt,
      )),
    )

    await this.playAudioFiles(files, download)
  }

  async playStandingTrainAnnouncement(options: IStandingTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push(`station.m.${options.thisStationCode}`, this.standingOptions.thisIsId, `station.e.${options.thisStationCode}`)

    if (options.mindTheGap) {
      files.push(
        { id: 'w.mind the gap between the train and the platform', opts: { delayStart: 250 } },
        { id: 'w.mind the gap', opts: { delayStart: 100 } },
      )
    }

    files.push({ id: this.standingOptions.nowStandingAtId, opts: { delayStart: this.BEFORE_SECTION_DELAY } })

    const plat = parseInt(options.platform)
    function getPlatFiles() {
      const platFiles: AudioItem[] = []

      if (options.platform === '0') {
        platFiles.push(`m.0`, options.isDelayed ? `m.is the delayed` : `m.is the`)
      } else if (plat >= 21) {
        platFiles.push(`mins.m.${options.platform}`, options.isDelayed ? `m.is the delayed` : `m.is the`)
      } else {
        platFiles.push(`platform.s.${options.platform}`, options.isDelayed ? `m.is the delayed` : `m.is the`)
      }

      return platFiles
    }

    files.push(
      ...getPlatFiles(),
      ...(await this.getFilesForBasicTrainInfo(
        options.hour,
        options.min,
        options.toc,
        options.vias.map(s => s.crsCode),
        options.terminatingStationCode,
        options.callingAt,
      )),
    )

    try {
      files.push(
        ...(await this.getCallingPoints(
          options.callingAt,
          options.terminatingStationCode,
          options.coaches !== 'None' ? parseInt(options.coaches.split(' ')[0]) : null,
          true,
        )),
      )
    } catch (e) {
      if (e instanceof Error) {
        alert(e.message)
        console.error(e)
        return
      }
    }

    files.push(
      ...(await this.getShortPlatforms(
        options.callingAt,
        options.terminatingStationCode,
        options.coaches !== 'None' ? parseInt(options.coaches.split(' ')[0]) : null,
        options.announceShortPlatformsAfterSplit,
      )),
    )

    files.push(
      ...(await this.getRequestStops(
        options.callingAt,
        options.terminatingStationCode,
        options.coaches !== 'None' ? parseInt(options.coaches.split(' ')[0]) : null,
      )),
    )

    if (options.firstClassLocation !== 'none') {
      files.push(
        { id: `m.first class accommodation is situated at the`, opts: { delayStart: 500 } },
        `e.${options.firstClassLocation} of the train`,
      )
    }

    if (options.notCallingAtStations.length > 0) {
      files.push(
        { id: 's.please note this train will not call at', opts: { delayStart: 250 } },
        ...this.pluraliseAudio(
          options.notCallingAtStations.map(s => s.crsCode),
          {
            prefix: 'station.m.',
            finalPrefix: 'station.e.',
            andId: 'm.and',
            firstItemDelay: this.callingPointsOptions.afterCallingAtDelay,
            beforeAndDelay: this.callingPointsOptions.aroundAndDelay,
            beforeItemDelay: this.callingPointsOptions.betweenStopsDelay,
            afterAndDelay: this.callingPointsOptions.aroundAndDelay,
          },
        ),
      )
    }

    await this.playAudioFiles(files, download)
  }

  protected readonly disruptionOptions = {
    thisStationAudio: 'e.this station-2',
  }

  async playDisruptedTrainAnnouncement(options: IDisruptedTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    const chime = this.getChime(options.chime)
    if (chime) files.push(chime)

    files.push('s.were sorry to announce that the')
    files.push(
      ...(await this.getFilesForBasicTrainInfo(
        options.hour,
        options.min,
        options.toc,
        options.vias.map(s => s.crsCode),
        options.terminatingStationCode,
        [],
        true,
        options.disruptionType === 'cancel' ? [this.disruptionOptions.thisStationAudio] : [],
      )),
    )

    function getNumber(num: number): string {
      if (num < 10) {
        return `platform.s.${num}`
      } else {
        return `mins.m.${num}`
      }
    }

    const endInflection = options.disruptionReason ? 'm' : 'e'

    switch (options.disruptionType) {
      case 'delayedBy':
        files.push('m.is delayed by approximately')

        const num = parseInt(options.delayTime)

        const hours = Math.floor(num / 60)
        const mins = num % 60

        if (hours > 0) {
          files.push(getNumber(hours), hours === 1 ? 'm.hour' : 'm.hours')
        }
        if (hours > 0 && mins > 0) {
          files.push('m.and')
        }
        if (mins > 0) {
          files.push(getNumber(mins), `${endInflection}.${mins !== 1 ? 'minutes' : 'minute'}`)
        }

        if (Array.isArray(options.disruptionReason)) {
          files.push('m.due to', ...options.disruptionReason)
        } else if (options.disruptionReason) {
          files.push('m.due to', `disruption-reason.e.${options.disruptionReason}`)
        }
        break
      case 'delay':
        if (options.disruptionReason) {
          files.push('m.is being delayed due to')

          if (Array.isArray(options.disruptionReason)) {
            files.push(...options.disruptionReason)
          } else {
            files.push(`disruption-reason.e.${options.disruptionReason}`)
          }
        } else {
          files.push('e.is being delayed')
        }
        break
      case 'cancel':
        if (options.disruptionReason) {
          files.push('m.has been cancelled due to')

          if (Array.isArray(options.disruptionReason)) {
            files.push(...options.disruptionReason)
          } else {
            files.push(`disruption-reason.e.${options.disruptionReason}`)
          }
        } else {
          files.push('e.has been cancelled')
        }
        break
    }

    files.push({ id: 'w.please listen for further announcements', opts: { delayStart: 250 } })

    switch (options.disruptionType) {
      case 'delayedBy':
        const num = parseInt(options.delayTime)
        if (num < 30) {
          files.push({ id: 'w.were sorry for the delay to this service', opts: { delayStart: 250 } })
        } else if (num < 45) {
          files.push({ id: 'w.were very sorry for the delay to this service', opts: { delayStart: 250 } })
        } else {
          files.push({ id: 'w.were extremely sorry for the severe delay to this service', opts: { delayStart: 250 } })
        }
        break

      case 'delay':
        files.push({ id: 'w.were sorry for the delay to this service', opts: { delayStart: 250 } })
        break

      case 'cancel':
        files.push({ id: 'w.were sorry for the delay this will cause to your journey', opts: { delayStart: 250 } })
        break
    }

    await this.playAudioFiles(files, download)
  }

  async playFastTrainAnnouncement(options: IFastTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    const chime = this.getChime(options.chime, options.daktronicsFanfare)
    if (chime) files.push(chime)

    let plat = parseInt(options.platform)

    const platformAudio = (() => {
      if (options.platform === '0') {
        return `e.0`
      } else if (isNaN(plat) || plat <= 20) {
        return `platform.e.${options.platform}`
      } else {
        return `mins.e.${options.platform}`
      }
    })()

    files.push('s.stand well away from the edge of platform', platformAudio, {
      id: 'w.the approaching train is not scheduled to stop at this station',
      opts: { delayStart: this.BEFORE_SECTION_DELAY },
    })

    if (options.fastTrainApproaching) {
      files.push({ id: 'w.fast train approaching', opts: { delayStart: this.BEFORE_SECTION_DELAY } })
    }

    await this.playAudioFiles(files, download)
  }

  async playTrainApproachingAnnouncement(
    options: ITrainApproachingAnnouncementOptions | ILiveTrainApproachingAnnouncementOptions,
    download: boolean = false,
  ): Promise<void> {
    const files: AudioItem[] = []

    const chime = this.getChime(options.chime)
    if (chime) files.push(chime)

    const plat = parseInt(options.platform)

    if (options.platform === '0') {
      files.push(`s.the train now approaching platform`, 'm.0')
    } else if (plat <= 20 && options.platform.match(/^\d+$/)) {
      files.push(`s.the train now approaching platform ${plat}`)
    } else if (plat >= 21) {
      files.push(`s.the train now approaching platform`, `mins.m.${options.platform}`)
    } else {
      files.push(`s.the train now approaching platform`, `platform.m.${options.platform}`)
    }

    files.push('m.is the')

    if (options.isDelayed) {
      files.push('m.delayed')
    }

    if ('fromLive' in options) {
      files.push(
        ...(await this.getFilesForBasicTrainInfoLive(
          options.hour,
          options.min,
          options.toc,
          options.vias.map(l => l.map(v => v.crsCode)),
          options.terminatingStationCode,
        )),
      )
    } else {
      files.push(
        ...(await this.getFilesForBasicTrainInfo(
          options.hour,
          options.min,
          options.toc,
          options.vias.map(s => s.crsCode),
          options.terminatingStationCode,
          [],
        )),
      )
    }

    files.push({ id: 's.this train is the service from', opts: { delayStart: this.SHORT_DELAY } }, `station.e.${options.originStationCode}`)

    await this.playAudioFiles(files, download)
  }

  async playPlatformAlterationAnnouncement(
    options: IPlatformAlterationAnnouncementOptions | ILivePlatformAlterationAnnouncementOptions,
    download: boolean = false,
  ): Promise<void> {
    const files: AudioItem[] = []

    const chime = this.getChime(options.chime)
    if (chime) files.push(chime)

    files.push('w.attention please')
    files.push({ id: 'w.this is a platform alteration', opts: { delayStart: 200 } })

    files.push({ id: 's.the', opts: { delayStart: 400 } })

    const getNewPlatFiles = (delayStart: number = 0) => {
      const platFiles: AudioItem[] = []
      const plat = parseInt(options.newPlatform)

      if (options.newPlatform === '0') {
        platFiles.push({ id: this.genericOptions.platform, opts: { delayStart } }, `m.0`, options.isDelayed ? `m.for the delayed` : `m.for the`)
      } else if (plat <= 12 || ['a', 'b'].includes(options.newPlatform.toLowerCase())) {
        platFiles.push({ id: `s.platform ${options.newPlatform} for the`, opts: { delayStart } })
        if (options.isDelayed) platFiles.push('m.delayed')
      } else if (plat >= 21) {
        platFiles.push(
          { id: this.genericOptions.platform, opts: { delayStart } },
          `mins.m.${options.newPlatform}`,
          options.isDelayed ? `m.for the delayed` : `m.for the`,
        )
      } else {
        platFiles.push(
          { id: this.genericOptions.platform, opts: { delayStart } },
          `platform.s.${options.newPlatform}`,
          options.isDelayed ? `m.for the delayed` : `m.for the`,
        )
      }

      return platFiles
    }

    if ('fromLive' in options) {
      files.push(
        ...(await this.getFilesForBasicTrainInfoLive(
          options.hour,
          options.min,
          options.toc,
          options.vias.map(l => l.map(v => v.crsCode)),
          options.terminatingStationCode,
          true,
        )),
      )
    } else {
      files.push(
        ...(await this.getFilesForBasicTrainInfo(
          options.hour,
          options.min,
          options.toc,
          options.vias.map(s => s.crsCode),
          options.terminatingStationCode,
          options.callingAt || [],
          true,
        )),
      )
    }

    if (options.announceOldPlatform) {
      files.push('m.originally due to depart from platform')

      if (options.oldPlatform === '0') {
        files.push(`m.0`)
      } else if (parseInt(options.oldPlatform) >= 21) {
        files.push(`mins.m.${options.oldPlatform}`)
      } else {
        files.push(`platform.m.${options.oldPlatform}`)
      }
    }

    files.push('m.will now depart from platform')
    if (options.newPlatform === '0') {
      files.push(`m.0`)
    } else if (parseInt(options.newPlatform) >= 21) {
      files.push(`mins.e.${options.newPlatform}`)
    } else {
      files.push(`platform.e.${options.newPlatform}`)
    }

    if ('fromLive' in options) {
      files.push(
        ...getNewPlatFiles(this.BEFORE_SECTION_DELAY),
        ...(await this.getFilesForBasicTrainInfoLive(
          options.hour,
          options.min,
          options.toc,
          options.vias.map(l => l.map(v => v.crsCode)),
          options.terminatingStationCode,
          false,
          undefined,
        )),
      )
    } else {
      files.push(
        ...getNewPlatFiles(this.BEFORE_SECTION_DELAY),
        ...(await this.getFilesForBasicTrainInfo(
          options.hour,
          options.min,
          options.toc,
          options.vias.map(s => s.crsCode),
          options.terminatingStationCode,
          options.callingAt || [],
          false,
          undefined,
        )),
      )
    }

    await this.playAudioFiles(files, download)
  }

  protected getAnnouncementButtons(): Record<string, CustomAnnouncementButton[]> {
    return {
      General: [
        {
          label: '3 chimes',
          play: this.playAudioFiles.bind(this, [this.getChime('three')!!]),
          download: this.playAudioFiles.bind(this, [this.getChime('three')!!], true),
        },
        {
          label: '4 chimes',
          play: this.playAudioFiles.bind(this, [this.getChime('four')!!]),
          download: this.playAudioFiles.bind(this, [this.getChime('four')!!], true),
        },
      ],
      Emergency: [
        {
          label: 'Newton Aycliffe chemical emergency',
          play: this.playAudioFiles.bind(this, [
            's.this is an emergency announcement',
            'e.for customers at newton aycliffe station',
            { id: 's.there is an emergency at a nearby chemical works', opts: { delayStart: 300 } },
            { id: 'm.please leave the station by the ramp from platform 1', opts: { delayStart: 300 } },
            'e.and turning left make your way to a position of safety',
            { id: 'e.listen for announcement by the emergency services', opts: { delayStart: 300 } },
          ]),
          download: this.playAudioFiles.bind(
            this,
            [
              's.this is an emergency announcement',
              'e.for customers at newton aycliffe station',
              { id: 's.there is an emergency at a nearby chemical works', opts: { delayStart: 300 } },
              { id: 'm.please leave the station by the ramp from platform 1', opts: { delayStart: 300 } },
              'e.and turning left make your way to a position of safety',
              { id: 'e.listen for announcement by the emergency services', opts: { delayStart: 300 } },
            ],
            true,
          ),
        },
        {
          label: 'Castleford chemical emergency',
          play: this.playAudioFiles.bind(this, [
            's.this is an emergency announcement',
            'e.for customers at castleford station',
            { id: 's.there is an emergency at a nearby chemical works', opts: { delayStart: 300 } },
            { id: 'm.please leave the station by the main exit', opts: { delayStart: 300 } },
            'e.and proceed to the town centre',
            { id: 'e.listen for announcement by the emergency services', opts: { delayStart: 300 } },
          ]),
          download: this.playAudioFiles.bind(
            this,
            [
              's.this is an emergency announcement',
              'e.for customers at castleford station',
              { id: 's.there is an emergency at a nearby chemical works', opts: { delayStart: 300 } },
              { id: 'm.please leave the station by the main exit', opts: { delayStart: 300 } },
              'e.and proceed to the town centre',
              { id: 'e.listen for announcement by the emergency services', opts: { delayStart: 300 } },
            ],
            true,
          ),
        },
        {
          label: 'Inspector Sands (Telent)',
          play: this.playAudioFiles.bind(this, ['w.would inspector sands please go to the operations room immediately']),
          download: this.playAudioFiles.bind(this, ['w.would inspector sands please go to the operations room immediately'], true),
        },
        {
          label: 'Station evacuation (Telent)',
          play: this.playAudioFiles.bind(this, ['w.due to a reported emergency would all passengers leave the station immediately']),
          download: this.playAudioFiles.bind(this, ['w.due to a reported emergency would all passengers leave the station immediately'], true),
        },
        {
          label: 'Superintendent to carriage depot',
          play: this.playAudioFiles.bind(this, ['w.would the superindendent of the line please go to the carriage depot']),
          download: this.playAudioFiles.bind(this, ['w.would the superindendent of the line please go to the carriage depot'], true),
        },
        {
          label: 'Mr Neptune to town centre',
          play: this.playAudioFiles.bind(this, ['w.would mr neptune please go to the town centre immediately']),
          download: this.playAudioFiles.bind(this, ['w.would mr neptune please go to the town centre immediately'], true),
        },
        {
          label: 'Unattended items',
          play: this.playAudioFiles.bind(this, [
            's.please do not leave cases or parcels',
            'e.unattended anywhere on the station',
            's.any unattended articles are likely to be removed',
            'e.without warning',
          ]),
          download: this.playAudioFiles.bind(
            this,
            [
              's.please do not leave cases or parcels',
              'e.unattended anywhere on the station',
              's.any unattended articles are likely to be removed',
              'e.without warning',
            ],
            true,
          ),
        },
        {
          label: 'Station evacuation',
          play: this.playAudioFiles.bind(this, [
            'w.attention please',
            { id: 'w.here is a special announcement', opts: { delayStart: 250 } },
            { id: 's.for reasons of security', opts: { delayStart: 500 } },
            'e.we are having to close the station',
            { id: 's.would all passengers kindly leave the station', opts: { delayStart: 500 } },
            'm.as quickly and as orderly as possible',
            'e.by the nearest available exit',
            { id: 's.please take your luggage with you', opts: { delayStart: 500 } },
            'e.and ensure that you keep it with you',
            { id: 's.there is no cause for panic', opts: { delayStart: 500 } },
            { id: 'm.i repeat', opts: { delayStart: 500 } },
            { id: 's.there is no cause for panic', opts: { delayStart: 200 } },
          ]),
          download: this.playAudioFiles.bind(
            this,
            [
              'w.attention please',
              { id: 'w.here is a special announcement', opts: { delayStart: 250 } },
              { id: 's.for reasons of security', opts: { delayStart: 500 } },
              'e.we are having to close the station',
              { id: 's.would all passengers kindly leave the station', opts: { delayStart: 500 } },
              'm.as quickly and as orderly as possible',
              'e.by the nearest available exit',
              { id: 's.please take your luggage with you', opts: { delayStart: 500 } },
              'e.and ensure that you keep it with you',
              { id: 's.there is no cause for panic', opts: { delayStart: 500 } },
              { id: 'm.i repeat', opts: { delayStart: 500 } },
              { id: 's.there is no cause for panic', opts: { delayStart: 200 } },
            ],
            true,
          ),
        },
        {
          label: 'Unattended items (French)',
          play: this.playAudioFiles.bind(this, [
            's.ne laissez pas trainer vos valises',
            'm.ou vos paquets abandonnés nulle part dans la gare',
            'm.tout articles non accompagné',
            'e.sera enlavé sans aucun avertissement',
          ]),
          download: this.playAudioFiles.bind(
            this,
            [
              's.ne laissez pas trainer vos valises',
              'm.ou vos paquets abandonnés nulle part dans la gare',
              'm.tout articles non accompagné',
              'e.sera enlavé sans aucun avertissement',
            ],
            true,
          ),
        },
        {
          label: 'Station evacuation (French)',
          play: this.playAudioFiles.bind(this, [
            'w.attention attention',
            'w.voici une annonce spéciale',
            { id: 's.pour de motifs et entrer à la sécurité', opts: { delayStart: 500 } },
            'e.nous sommes contraint de fermer la gare',
            { id: 's.vous êtes prier de quitter la gare aussi vite que possible', opts: { delayStart: 500 } },
            'e.et en bonne autre par la sortie la plus proche',
            { id: 's.emporter tous vos bagages avec vous', opts: { delayStart: 500 } },
            'e.et prenez soin de les garder avec vous',
          ]),
          download: this.playAudioFiles.bind(
            this,
            [
              'w.attention attention',
              'w.voici une annonce spéciale',
              { id: 's.pour de motifs et entrer à la sécurité', opts: { delayStart: 500 } },
              'e.nous sommes contraint de fermer la gare',
              { id: 's.vous êtes prier de quitter la gare aussi vite que possible', opts: { delayStart: 500 } },
              'e.et en bonne autre par la sortie la plus proche',
              { id: 's.emporter tous vos bagages avec vous', opts: { delayStart: 500 } },
              'e.et prenez soin de les garder avec vous',
            ],
            true,
          ),
        },
        {
          label: 'Unattended items (German)',
          play: this.playAudioFiles.bind(this, [
            's.koffer und pakete dürfen',
            'e.am bahnhof nirgends unbeaufsichtigt gelassen werden',
            { id: 's.unbeaufsichtigte artikel', opts: { delayStart: 500 } },
            'e.können ohne weitere warnung entfernt werden',
          ]),
          download: this.playAudioFiles.bind(
            this,
            [
              's.koffer und pakete dürfen',
              'e.am bahnhof nirgends unbeaufsichtigt gelassen werden',
              { id: 's.unbeaufsichtigte artikel', opts: { delayStart: 500 } },
              'e.können ohne weitere warnung entfernt werden',
            ],
            true,
          ),
        },
        {
          label: 'Station evacuation (German)',
          play: this.playAudioFiles.bind(this, [
            'w.achtung bitte',
            'w.eine sondermeldung',
            { id: 's.aus sicherheitsgründen', opts: { delayStart: 500 } },
            'e.muss der bahnhof geschlossen werden',
            { id: 's.bitte verlassen sie den bahnhof beim nächsten ausgang', opts: { delayStart: 500 } },
            'e.so schnell und so ruhig wie möglich',
            { id: 's.bitte nehmen sie ihr gepäck mit', opts: { delayStart: 500 } },
            'e.und behalten sie es bei sich',
          ]),
          download: this.playAudioFiles.bind(
            this,
            [
              'w.achtung bitte',
              'w.eine sondermeldung',
              { id: 's.aus sicherheitsgründen', opts: { delayStart: 500 } },
              'e.muss der bahnhof geschlossen werden',
              { id: 's.bitte verlassen sie den bahnhof beim nächsten ausgang', opts: { delayStart: 500 } },
              'e.so schnell und so ruhig wie möglich',
              { id: 's.bitte nehmen sie ihr gepäck mit', opts: { delayStart: 500 } },
              'e.und behalten sie es bei sich',
            ],
            true,
          ),
        },
      ],
    }
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab<string>> = {
    nextTrain: {
      name: 'Next train',
      component: CustomAnnouncementPane,
      importStateFromRttService: this.nextTrainOptionsFromRtt.bind(this),
      defaultState: {
        chime: 'three',
        platform: this.PLATFORMS[1],
        hour: '07',
        min: '33',
        isDelayed: false,
        toc: '',
        terminatingStationCode: this.STATIONS[0],
        vias: [],
        callingAt: [],
        coaches: '8 coaches',
        firstClassLocation: 'none',
        announceShortPlatformsAfterSplit: false,
        notCallingAtStations: [],
      },
      props: {
        presets: this.announcementPresets.nextTrain,
        playHandler: this.playNextTrainAnnouncement.bind(this),
        options: {
          chime: {
            name: 'Chime',
            type: 'select',
            default: this.DEFAULT_CHIME,
            options: [
              { title: '3 chimes', value: 'three' },
              { title: '4 chimes', value: 'four' },
              { title: 'No chime', value: 'none' },
            ],
          },
          platform: {
            name: 'Platform',
            default: this.PLATFORMS[1],
            options: this.PLATFORMS.map(p => ({ title: `Platform ${p.toUpperCase()}`, value: p })),
            type: 'select',
          },
          hour: {
            name: 'Hour',
            default: '07',
            options: [
              '00 - midnight',
              '01',
              '02',
              '03',
              '04',
              '05',
              '06',
              '07',
              '08',
              '09',
              '10',
              '11',
              '12',
              '13',
              '14',
              '15',
              '16',
              '17',
              '18',
              '19',
              '20',
              '21',
              '22',
              '23',
            ].map(h => ({ title: h, value: h })),
            type: 'select',
          },
          min: {
            name: 'Minute',
            default: '33',
            options: ['00 - hundred', '00 - hundred-hours']
              .concat(new Array(59).fill(0).map((_, i) => (i + 1).toString()))
              .map(m => ({ title: m.toString().padStart(2, '0'), value: m.toString().padStart(2, '0') })),
            type: 'select',
          },
          isDelayed: {
            name: 'Delayed?',
            default: false,
            type: 'boolean',
          },
          toc: {
            name: 'TOC',
            default: '',
            options: [{ title: 'None', value: '' }].concat(this.ALL_AVAILABLE_TOCS.map(m => ({ title: m, value: m.toLowerCase() }))),
            type: 'select',
          },
          terminatingStationCode: {
            name: 'Terminating station',
            default: this.STATIONS[0],
            options: this.STATIONS_AS_ITEMS,
            type: 'select',
          },
          vias: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: [] as string[],
              additionalOptions: this.STATIONS_AS_ITEMS,
              selectLabel: 'Via points (non-splitting services only)',
              placeholder: 'Add a via point…',
              heading: 'Via... (optional)',
            } as ICallingAtSelectorProps,
            default: [],
          },
          callingAt: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: [] as string[],
              additionalOptions: this.STATIONS_AS_ITEMS,
              enableShortPlatforms: this.SHORT_PLATFORMS,
              enableRequestStops: true,
              enableSplits: this.SPLITS,
              enableRrbContinuations: true,
            } as ICallingAtSelectorProps,
            default: [],
          },
          firstClassLocation: {
            name: 'First Class Location',
            type: 'select',
            default: 'none',
            options: [
              { title: 'None', value: 'none' },
              { title: 'Front of Train', value: 'front' },
              { title: 'Middle of Train', value: 'middle' },
              { title: 'Rear of Train', value: 'rear' },
            ],
          },
          coaches: {
            name: 'Coach count',
            default: '8 coaches',
            options: [
              'None',
              '1 coach',
              '2 coaches',
              '3 coaches',
              '4 coaches',
              '5 coaches',
              '6 coaches',
              '7 coaches',
              '8 coaches',
              '9 coaches',
              '10 coaches',
              '11 coaches',
              '12 coaches',
              '13 coaches',
              '14 coaches',
              '15 coaches',
              '16 coaches',
              '17 coaches',
              '18 coaches',
              '19 coaches',
              '20 coaches',
            ].map(c => ({ title: c, value: c })),
            type: 'select',
          },
          announceShortPlatformsAfterSplit: {
            name: 'Announce short platforms after split?',
            type: 'boolean',
            default: false,
          },
          notCallingAtStations: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: [] as string[],
              additionalOptions: this.STATIONS_AS_ITEMS,
              selectLabel: 'Train does not call at',
              placeholder: 'Add a "not" calling point…',
              heading: 'Not calling at… (optional)',
            } as ICallingAtSelectorProps,
            default: [],
          },
        },
      },
    } as CustomAnnouncementTab<keyof INextTrainAnnouncementOptions>,
    approachingTrain: {
      name: 'Approaching train',
      component: CustomAnnouncementPane,
      importStateFromRttService: this.approachingTrainOptionsFromRtt.bind(this),
      defaultState: {
        chime: 'three',
        platform: this.PLATFORMS[1],
        hour: '07',
        min: '33',
        isDelayed: false,
        toc: '',
        terminatingStationCode: this.STATIONS[0],
        vias: [],
        originStationCode: this.STATIONS[0],
      },
      props: {
        playHandler: this.playTrainApproachingAnnouncement.bind(this),
        options: {
          chime: {
            name: 'Chime',
            type: 'select',
            default: this.DEFAULT_CHIME,
            options: [
              { title: '3 chimes', value: 'three' },
              { title: '4 chimes', value: 'four' },
              { title: 'No chime', value: 'none' },
            ],
          },
          platform: {
            name: 'Platform',
            default: this.PLATFORMS[1],
            options: this.PLATFORMS.map(p => ({ title: `Platform ${p.toUpperCase()}`, value: p })),
            type: 'select',
          },
          hour: {
            name: 'Hour',
            default: '07',
            options: [
              '00 - midnight',
              '01',
              '02',
              '03',
              '04',
              '05',
              '06',
              '07',
              '08',
              '09',
              '10',
              '11',
              '12',
              '13',
              '14',
              '15',
              '16',
              '17',
              '18',
              '19',
              '20',
              '21',
              '22',
              '23',
            ].map(h => ({ title: h, value: h })),
            type: 'select',
          },
          min: {
            name: 'Minute',
            default: '33',
            options: ['00 - hundred', '00 - hundred-hours']
              .concat(new Array(59).fill(0).map((_, i) => (i + 1).toString()))
              .map(m => ({ title: m.toString().padStart(2, '0'), value: m.toString().padStart(2, '0') })),
            type: 'select',
          },
          isDelayed: {
            name: 'Delayed?',
            default: false,
            type: 'boolean',
          },
          toc: {
            name: 'TOC',
            default: '',
            options: [{ title: 'None', value: '' }].concat(this.ALL_AVAILABLE_TOCS.map(m => ({ title: m, value: m.toLowerCase() }))),
            type: 'select',
          },
          terminatingStationCode: {
            name: 'Terminating station',
            default: this.STATIONS[0],
            options: this.STATIONS_AS_ITEMS,
            type: 'select',
          },
          vias: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: [] as string[],
              additionalOptions: this.STATIONS_AS_ITEMS,
              selectLabel: 'Via points (non-splitting services only)',
              placeholder: 'Add a via point…',
              heading: 'Via... (optional)',
            } as ICallingAtSelectorProps,
            default: [],
          },
          originStationCode: {
            name: 'Origin station',
            default: this.STATIONS[0],
            options: this.STATIONS_AS_ITEMS,
            type: 'select',
          },
        },
      },
    } as CustomAnnouncementTab<keyof ITrainApproachingAnnouncementOptions>,
    standingTrain: {
      name: 'Standing train',
      component: CustomAnnouncementPane,
      importStateFromRttService: this.standingTrainOptionsFromRtt.bind(this),
      defaultState: {
        chime: 'three',
        thisStationCode: this.STATIONS[0],
        platform: this.PLATFORMS[1],
        hour: '07',
        min: '33',
        isDelayed: false,
        toc: '',
        terminatingStationCode: this.STATIONS[0],
        vias: [],
        callingAt: [],
        announceShortPlatformsAfterSplit: false,
        coaches: '8 coaches',
        firstClassLocation: 'none',
        mindTheGap: false,
        notCallingAtStations: [],
      },
      props: {
        presets: this.announcementPresets.nextTrain.filter(x => 'thisStationCode' in x.state),
        playHandler: this.playStandingTrainAnnouncement.bind(this),
        options: {
          thisStationCode: {
            name: 'This station',
            default: this.STATIONS[0],
            options: this.STATIONS_AS_ITEMS,
            type: 'select',
          },
          mindTheGap: {
            name: 'Mind the gap?',
            default: false,
            type: 'boolean',
          },
          platform: {
            name: 'Platform',
            default: this.PLATFORMS[1],
            options: this.PLATFORMS.map(p => ({ title: `Platform ${p.toUpperCase()}`, value: p })),
            type: 'select',
          },
          hour: {
            name: 'Hour',
            default: '07',
            options: [
              '00 - midnight',
              '01',
              '02',
              '03',
              '04',
              '05',
              '06',
              '07',
              '08',
              '09',
              '10',
              '11',
              '12',
              '13',
              '14',
              '15',
              '16',
              '17',
              '18',
              '19',
              '20',
              '21',
              '22',
              '23',
            ].map(h => ({ title: h, value: h })),
            type: 'select',
          },
          min: {
            name: 'Minute',
            default: '33',
            options: ['00 - hundred', '00 - hundred-hours']
              .concat(new Array(59).fill(0).map((_, i) => (i + 1).toString()))
              .map(m => ({ title: m.toString().padStart(2, '0'), value: m.toString().padStart(2, '0') })),
            type: 'select',
          },
          isDelayed: {
            name: 'Delayed?',
            default: false,
            type: 'boolean',
          },
          toc: {
            name: 'TOC',
            default: '',
            options: [{ title: 'None', value: '' }].concat(this.ALL_AVAILABLE_TOCS.map(m => ({ title: m, value: m.toLowerCase() }))),
            type: 'select',
          },
          terminatingStationCode: {
            name: 'Terminating station',
            default: this.STATIONS[0],
            options: this.STATIONS_AS_ITEMS,
            type: 'select',
          },
          vias: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: [] as string[],
              additionalOptions: this.STATIONS_AS_ITEMS,
              selectLabel: 'Via points (non-splitting services only)',
              placeholder: 'Add a via point…',
              heading: 'Via… (optional)',
            } as ICallingAtSelectorProps,
            default: [],
          },
          callingAt: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: [] as string[],
              additionalOptions: this.STATIONS_AS_ITEMS,
              enableShortPlatforms: this.SHORT_PLATFORMS,
              enableRequestStops: true,
              enableSplits: this.SPLITS,
              enableRrbContinuations: true,
            } as ICallingAtSelectorProps,
            default: [],
          },
          firstClassLocation: {
            name: 'First Class Location',
            type: 'select',
            default: 'none',
            options: [
              { title: 'None', value: 'none' },
              { title: 'Front of Train', value: 'front' },
              { title: 'Middle of Train', value: 'middle' },
              { title: 'Rear of Train', value: 'rear' },
            ],
          },
          coaches: {
            name: 'Coach count',
            default: '8 coaches',
            options: [
              'None',
              '1 coach',
              '2 coaches',
              '3 coaches',
              '4 coaches',
              '5 coaches',
              '6 coaches',
              '7 coaches',
              '8 coaches',
              '9 coaches',
              '10 coaches',
              '11 coaches',
              '12 coaches',
              '13 coaches',
              '14 coaches',
              '15 coaches',
              '16 coaches',
              '17 coaches',
              '18 coaches',
              '19 coaches',
              '20 coaches',
            ].map(c => ({ title: c, value: c })),
            type: 'select',
          },
          announceShortPlatformsAfterSplit: {
            name: 'Announce short platforms after split?',
            type: 'boolean',
            default: false,
          },
          notCallingAtStations: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: [] as string[],
              additionalOptions: this.STATIONS_AS_ITEMS,
              selectLabel: 'Train does not call at',
              placeholder: 'Add a "not" calling point…',
              heading: 'Not calling at… (optional)',
            } as ICallingAtSelectorProps,
            default: [],
          },
        },
      },
    } as CustomAnnouncementTab<keyof IStandingTrainAnnouncementOptions>,
    disruptedTrain: {
      name: 'Disrupted train',
      component: CustomAnnouncementPane,
      defaultState: {
        chime: 'three',
        hour: '07',
        min: '33',
        toc: '',
        terminatingStationCode: this.STATIONS[0],
        vias: [],
        disruptionType: 'delayedBy',
        delayTime: '65',
        disruptionReason: '',
      },
      props: {
        presets: this.announcementPresets.disruptedTrain,
        playHandler: this.playDisruptedTrainAnnouncement.bind(this),
        options: {
          chime: {
            name: 'Chime',
            type: 'select',
            default: this.DEFAULT_CHIME,
            options: [
              { title: '3 chimes', value: 'three' },
              { title: '4 chimes', value: 'four' },
              { title: 'No chime', value: 'none' },
            ],
          },
          hour: {
            name: 'Hour',
            default: '07',
            options: [
              '00 - midnight',
              '01',
              '02',
              '03',
              '04',
              '05',
              '06',
              '07',
              '08',
              '09',
              '10',
              '11',
              '12',
              '13',
              '14',
              '15',
              '16',
              '17',
              '18',
              '19',
              '20',
              '21',
              '22',
              '23',
            ].map(h => ({ title: h, value: h })),
            type: 'select',
          },
          min: {
            name: 'Minute',
            default: '33',
            options: ['00 - hundred', '00 - hundred-hours']
              .concat(new Array(59).fill(0).map((_, i) => (i + 1).toString()))
              .map(m => ({ title: m.toString().padStart(2, '0'), value: m.toString().padStart(2, '0') })),
            type: 'select',
          },
          toc: {
            name: 'TOC',
            default: '',
            options: [{ title: 'None', value: '' }].concat(this.ALL_AVAILABLE_TOCS.map(m => ({ title: m, value: m.toLowerCase() }))),
            type: 'select',
          },
          terminatingStationCode: {
            name: 'Terminating station',
            default: this.STATIONS[0],
            options: this.STATIONS_AS_ITEMS,
            type: 'select',
          },
          vias: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: [] as string[],
              additionalOptions: this.STATIONS_AS_ITEMS,
              selectLabel: 'Via points (non-splitting services only)',
              placeholder: 'Add a via point…',
              heading: 'Via… (optional)',
            } as ICallingAtSelectorProps,
            default: [],
          },
          disruptionType: {
            name: 'Disruption type',
            type: 'select',
            options: [
              { value: 'delayedBy', title: 'Delayed by…' },
              { value: 'delay', title: 'Delayed' },
              { value: 'cancel', title: 'Cancelled' },
            ],
            default: 'delayedBy',
          },
          delayTime: {
            name: 'Delay length',
            type: 'select',
            options: new Array(360).fill(0).map((_, i) => ({ value: (i + 1).toString(), title: `${i + 1} minute${i === 0 ? '' : 's'}` })),
            default: '65',
            onlyShowWhen(activeState) {
              return activeState.disruptionType === 'delayedBy'
            },
          },
          disruptionReason: {
            name: 'Disruption reason',
            type: 'select',
            options: [{ value: '', title: 'None' }, ...this.DISRUPTION_REASONS.map(r => ({ value: r, title: r }))],
            default: '',
          },
        },
      },
    } as CustomAnnouncementTab<keyof IDisruptedTrainAnnouncementOptions>,
    fastTrain: {
      name: 'Fast train',
      component: CustomAnnouncementPane,
      defaultState: {
        chime: 'three',
        daktronicsFanfare: false,
        fastTrainApproaching: false,
        platform: this.PLATFORMS[1],
      },
      props: {
        playHandler: this.playFastTrainAnnouncement.bind(this),
        options: {
          chime: {
            name: 'Chime',
            type: 'select',
            default: this.DEFAULT_CHIME,
            options: [
              { title: '3 chimes', value: 'three' },
              { title: '4 chimes', value: 'four' },
              { title: 'No chime', value: 'none' },
            ],
          },
          platform: {
            name: 'Platform',
            default: this.PLATFORMS[1],
            options: this.PLATFORMS.map(p => ({ title: `Platform ${p.toUpperCase()}`, value: p })),
            type: 'select',
          },
          fastTrainApproaching: {
            name: '"Fast train approaching"',
            type: 'boolean',
            default: false,
          },
          daktronicsFanfare: {
            name: 'Play Daktronics fanfare',
            type: 'boolean',
            default: false,
          },
        },
      },
    } as CustomAnnouncementTab<keyof IFastTrainAnnouncementOptions>,
    platformAlteration: {
      name: 'Platform alteration',
      component: CustomAnnouncementPane,
      defaultState: {
        chime: 'three',
        announceOldPlatform: false,
        oldPlatform: this.PLATFORMS[6],
        newPlatform: this.PLATFORMS[1],
        hour: '07',
        min: '33',
        isDelayed: false,
        toc: '',
        terminatingStationCode: this.STATIONS[0],
        vias: [],
        callingAt: [],
      },
      props: {
        presets: this.announcementPresets.nextTrain,
        playHandler: this.playPlatformAlterationAnnouncement.bind(this),
        options: {
          chime: {
            name: 'Chime',
            type: 'select',
            default: this.DEFAULT_CHIME,
            options: [
              { title: '3 chimes', value: 'three' },
              { title: '4 chimes', value: 'four' },
              { title: 'No chime', value: 'none' },
            ],
          },
          announceOldPlatform: {
            name: 'Announce old platform?',
            type: 'boolean',
            default: false,
          },
          oldPlatform: {
            name: 'Old platform',
            default: this.PLATFORMS[6],
            options: this.PLATFORMS.map(p => ({ title: `Platform ${p.toUpperCase()}`, value: p })),
            type: 'select',
            onlyShowWhen(activeState) {
              return activeState.announceOldPlatform
            },
          },
          newPlatform: {
            name: 'New platform',
            default: this.PLATFORMS[1],
            options: this.PLATFORMS.map(p => ({ title: `Platform ${p.toUpperCase()}`, value: p })),
            type: 'select',
          },
          hour: {
            name: 'Hour',
            default: '07',
            options: [
              '00 - midnight',
              '01',
              '02',
              '03',
              '04',
              '05',
              '06',
              '07',
              '08',
              '09',
              '10',
              '11',
              '12',
              '13',
              '14',
              '15',
              '16',
              '17',
              '18',
              '19',
              '20',
              '21',
              '22',
              '23',
            ].map(h => ({ title: h, value: h })),
            type: 'select',
          },
          min: {
            name: 'Minute',
            default: '33',
            options: ['00 - hundred', '00 - hundred-hours']
              .concat(new Array(59).fill(0).map((_, i) => (i + 1).toString()))
              .map(m => ({ title: m.toString().padStart(2, '0'), value: m.toString().padStart(2, '0') })),
            type: 'select',
          },
          isDelayed: {
            name: 'Delayed?',
            default: false,
            type: 'boolean',
          },
          toc: {
            name: 'TOC',
            default: '',
            options: [{ title: 'None', value: '' }].concat(this.ALL_AVAILABLE_TOCS.map(m => ({ title: m, value: m.toLowerCase() }))),
            type: 'select',
          },
          terminatingStationCode: {
            name: 'Terminating station',
            default: this.STATIONS[0],
            options: this.STATIONS_AS_ITEMS,
            type: 'select',
          },
          vias: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: [] as string[],
              additionalOptions: this.STATIONS_AS_ITEMS,
              selectLabel: 'Via points (non-splitting services only)',
              placeholder: 'Add a via point…',
              heading: 'Via… (optional)',
            } as ICallingAtSelectorProps,
            default: [],
          },
          callingAt: {
            name: '',
            type: 'customNoState',
            component: () => <></>,
          },
        },
      },
    } as CustomAnnouncementTab<keyof IPlatformAlterationAnnouncementOptions>,
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: this.getAnnouncementButtons(),
      },
    } as CustomAnnouncementTab<string>,
  }

  /**
   * @param rttService RTT service data
   * @param fromStation The station from which to interpret data from
   * @param existingOptions The existing options to copy other settings from (e.g., chime)
   * @returns The options to use for the next train announcement
   */
  private nextTrainOptionsFromRtt(
    rttService: RttResponse,
    fromLocationIndex: number,
    existingOptions: INextTrainAnnouncementOptions,
  ): INextTrainAnnouncementOptions {
    const originLocation = rttService.locations[fromLocationIndex]

    const callingPoints = RttUtils.getCallingPoints(rttService, fromLocationIndex)
    const destinationLocations = originLocation.destination.filter(d => {
      if (!d.crs) {
        console.warn('Destination location has no CRS', d)
        return false
      }
      return true
    })

    const h = originLocation.gbttBookedDeparture!!.substring(0, 2)
    const m = originLocation.gbttBookedDeparture!!.substring(2, 4)

    let platform = originLocation.platform?.toLowerCase() ?? existingOptions.platform
    if (!this.PLATFORMS.includes(platform)) platform = existingOptions.platform

    const invalidStationCrses = (
      [...destinationLocations.map(l => l.crs), ...callingPoints.map(l => l.crsCode)].filter(Boolean) as string[]
    ).filter(c => !this.STATIONS.includes(c))
    const invalidStationNames = invalidStationCrses.map(c => `- ${crsToStationItemMapper(c).name}`)
    if (invalidStationNames.length > 0) {
      alert(
        "Some stations in this train's calling pattern are not available with this announcement system. The following locations have been removed:\n" +
          invalidStationNames.join('\n'),
      )
    }

    const invalidDestinationCrses = destinationLocations.filter(d => !d.crs || !this.STATIONS.includes(d.crs)).map(d => d.crs!!)
    if (invalidDestinationCrses.length > 0) {
      alert(
        'The destination of this train is not available with this announcement system. The destination may have been reset to a default value.',
      )
    }

    return {
      chime: existingOptions.chime,
      announceShortPlatformsAfterSplit: existingOptions.announceShortPlatformsAfterSplit,
      coaches: existingOptions.coaches,
      firstClassLocation: existingOptions.firstClassLocation,

      hour: h === '00' ? '00 - midnight' : h,
      min: m === '00' ? '00 - hundred-hours' : m,
      isDelayed: RttUtils.getIsDelayedDeparture(rttService, fromLocationIndex),
      platform,
      callingAt: callingPoints.filter(c => !invalidStationCrses.includes(c.crsCode)),
      vias: [],
      notCallingAtStations: RttUtils.getCancelledCallingPoints(rttService, fromLocationIndex).filter(l => this.STATIONS.includes(l.crsCode)),
      terminatingStationCode:
        destinationLocations.filter(d => !invalidDestinationCrses.includes(d.crs!!)).map(d => d.crs!!)[0] || this.STATIONS[0],
      toc: this.processTocForLiveTrains(
        rttService.atocName,
        rttService.atocCode,
        originLocation.crs!!,
        destinationLocations.map(d => d.crs!!)[0],
        false,
        rttService.serviceUid,
      ).toLowerCase(),
    }
  }

  /**
   * @param rttService RTT service data
   * @param fromStation The station from which to interpret data from
   * @param existingOptions The existing options to copy other settings from (e.g., chime)
   * @returns The options to use for the next train announcement
   */
  private approachingTrainOptionsFromRtt(
    rttService: RttResponse,
    fromLocationIndex: number,
    existingOptions: ITrainApproachingAnnouncementOptions,
  ): ITrainApproachingAnnouncementOptions {
    const originLocation = rttService.locations[fromLocationIndex]

    const destinationLocations = originLocation.destination.filter(d => {
      if (!d.crs) {
        console.warn('Destination location has no CRS', d)
        return false
      }
      return true
    })

    const h = originLocation.gbttBookedDeparture!!.substring(0, 2)
    const m = originLocation.gbttBookedDeparture!!.substring(2, 4)

    let platform = originLocation.platform?.toLowerCase() ?? existingOptions.platform
    if (!this.PLATFORMS.includes(platform)) platform = existingOptions.platform

    const invalidDestinationCrses = destinationLocations.filter(d => !d.crs || !this.STATIONS.includes(d.crs)).map(d => d.crs!!)
    if (invalidDestinationCrses.length > 0) {
      alert(
        'The destination of this train is not available with this announcement system. The destination may have been reset to a default value.',
      )
    }

    const origin = originLocation.origin[0].crs ?? existingOptions.originStationCode
    const invalidOriginCrs = !this.STATIONS.includes(origin!!)
    if (invalidOriginCrs) {
      alert('The origin of this train is not available with this announcement system. The origin has been reset to a default value.')
    }

    return {
      chime: existingOptions.chime,

      hour: h === '00' ? '00 - midnight' : h,
      min: m === '00' ? '00 - hundred-hours' : m,
      isDelayed: RttUtils.getIsDelayedDeparture(rttService, fromLocationIndex),
      platform,
      vias: [],
      terminatingStationCode:
        destinationLocations.filter(d => !invalidDestinationCrses.includes(d.crs!!)).map(d => d.crs!!)[0] || this.STATIONS[0],
      toc: this.processTocForLiveTrains(
        rttService.atocName,
        rttService.atocCode,
        originLocation.crs!!,
        destinationLocations.map(d => d.crs!!)[0],
        false,
        rttService.serviceUid,
      ).toLowerCase(),
      originStationCode: invalidOriginCrs ? this.STATIONS[0] : origin,
    }
  }

  /**
   * @param rttService RTT service data
   * @param fromStation The station from which to interpret data from
   * @param existingOptions The existing options to copy other settings from (e.g., chime)
   * @returns The options to use for the next train announcement
   */
  private standingTrainOptionsFromRtt(
    rttService: RttResponse,
    fromLocationIndex: number,
    existingOptions: IStandingTrainAnnouncementOptions,
  ): IStandingTrainAnnouncementOptions {
    const originLocation = rttService.locations[fromLocationIndex]

    const callingPoints = RttUtils.getCallingPoints(rttService, fromLocationIndex)
    const destinationLocations = originLocation.destination.filter(d => {
      if (!d.crs) {
        console.warn('Destination location has no CRS', d)
        return false
      }
      return true
    })

    const h = originLocation.gbttBookedDeparture!!.substring(0, 2)
    const m = originLocation.gbttBookedDeparture!!.substring(2, 4)

    let platform = originLocation.platform?.toLowerCase() ?? existingOptions.platform
    if (!this.PLATFORMS.includes(platform)) platform = existingOptions.platform

    const invalidStationCrses = (callingPoints.map(l => l.crsCode).filter(Boolean) as string[]).filter(c => !this.STATIONS.includes(c))
    const invalidStationNames = invalidStationCrses.map(c => `- ${crsToStationItemMapper(c).name}`)
    if (invalidStationNames.length > 0) {
      alert(
        "Some stations in this train's calling pattern are not available with this announcement system. The following locations have been removed:\n" +
          invalidStationNames.join('\n'),
      )
    }

    const invalidDestinationCrses = destinationLocations.filter(d => !d.crs || !this.STATIONS.includes(d.crs)).map(d => d.crs!!)
    if (invalidDestinationCrses.length > 0) {
      alert(
        "The destination of this train's is not available with this announcement system. The destination may have been reset to a default value.",
      )
    }

    const invalidOriginCrs = !this.STATIONS.includes(originLocation.crs!!)
    if (invalidOriginCrs) {
      alert('The station location being emulated is not available with this announcement system. The station has been reset to a default value.')
    }

    return {
      announceShortPlatformsAfterSplit: existingOptions.announceShortPlatformsAfterSplit,
      coaches: existingOptions.coaches,
      firstClassLocation: existingOptions.firstClassLocation,
      mindTheGap: existingOptions.mindTheGap,

      thisStationCode: invalidOriginCrs ? this.STATIONS[0] : originLocation.crs!,
      hour: h === '00' ? '00 - midnight' : h,
      min: m === '00' ? '00 - hundred-hours' : m,
      isDelayed: RttUtils.getIsDelayedDeparture(rttService, fromLocationIndex),
      platform,
      callingAt: callingPoints.filter(c => !invalidStationCrses.includes(c.crsCode)),
      vias: [],
      notCallingAtStations: RttUtils.getCancelledCallingPoints(rttService, fromLocationIndex).filter(l => this.STATIONS.includes(l.crsCode)),
      terminatingStationCode:
        destinationLocations.filter(d => !invalidDestinationCrses.includes(d.crs!!)).map(d => d.crs!!)[0] || this.STATIONS[0],
      toc: this.processTocForLiveTrains(
        rttService.atocName,
        rttService.atocCode,
        originLocation.crs!!,
        destinationLocations.map(d => d.crs!!)[0],
        false,
        rttService.serviceUid,
      ).toLowerCase(),
    }
  }
}
