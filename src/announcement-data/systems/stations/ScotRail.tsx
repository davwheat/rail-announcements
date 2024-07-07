import React from 'react'

import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import CallingAtSelector from '@components/CallingAtSelector'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import { AllStationsTitleValueMap } from '@data/StationManipulators'
import { AudioItem, CustomAnnouncementTab } from '../../AnnouncementSystem'
import type { IAlternativeServicesState } from '@components/AtosDisruptionAlternatives'
import { platform } from 'os'

interface INextTrainAnnouncementOptions {
  platform: string
  hour: string
  min: string
  toc: string
  terminatingStationCode: string
  via: string | 'none'
  callingAt: { crsCode: string; name: string; randomId: string }[]
  coaches: string
  // seating: string
  // special: string[]
}

interface IThroughTrainAnnouncementOptions {
  platform: string
}

interface IDelayedTrainAnnouncementOptions {
  hour: string
  min: string
  toc: string
  terminatingStationCode: string
  via: string | 'none'
  delayTime: string
  disruptionReason: string
  disruptionType: 'delayed' | 'cancelled'
  platform: string
  alternativeServices: IAlternativeServicesState
}

const AVAILABLE_TOCS = [
  'East Midlands',
  'First Capital Connect',
  'First Great Western',
  'GNER',
  'Grand Central',
  'The Grand Central',
  'London North Eastern Railway',
  'London Overground',
  'Midland Mainline',
  'Midland Mainline Turbostar',
  'ScotRail',
  'South West Trains',
  'Southeastern',
  'Southeastern Trains',
  'Southern',
  'Strathclyde Metro',
  'The Blue Pullman',
  'The Bluebell Railway',
  'The Cathedrals Express',
  'The Cathedrals Express Special Steam Service',
  'The Cathedrals Express Steam Service',
  'The Spa Valley Railway',
  'The Watercress Line',
  'Transport for London Overground',
  'Virgin Trains',
  'Virgin Trains East Coast',
]

const INTEGRATED_TOCS = [
  'London North Eastern Railway',
  'Midland Mainline',
  'Strathclyde Metro',
  'The Cathedrals Express Special Steam Service',
  'The Cathedrals Express Steam Service',
  'Virgin Trains East Coast',
]

const AVAILABLE_PLATFORMS = ['1', '2', '3', '4', '5', '6', '7', '8']

const ALL_AVAILABLE_STATIONS = [
  'AAT',
  'ABC',
  'ABD',
  'ABY',
  'ACH',
  'ACN',
  'ACR',
  'ADC',
  'ADK',
  'ADN',
  'ADR',
  'ADS',
  'ADW',
  'AFV',
  'AGS',
  'AHN',
  'AIR',
  'ALM',
  'ALN',
  'ALO',
  'ALX',
  'AND',
  'ANL',
  'ANN',
  'APB',
  'APP',
  'ARB',
  'ARD',
  'ARG',
  'ARR',
  'ART',
  'ASB',
  'ASF',
  'ASS',
  'ATB',
  'ATN',
  'ATT',
  'AUI',
  'AUK',
  'AUR',
  'AVM',
  'AWT',
  'AXP',
  'AYR',
  'BAI',
  'BAM',
  'BAN',
  'BAR',
  'BBG',
  'BBN',
  'BBW',
  'BCB',
  'BCH',
  'BCN',
  'BCU',
  'BDG',
  'BDI',
  'BDM',
  'BDQ',
  'BDT',
  'BDY',
  'BEA',
  'BEE',
  'BEL',
  'BEM',
  'BEN',
  'BES',
  'BEV',
  'BEY',
  'BGE',
  'BGH',
  'BGI',
  'BGL',
  'BGN',
  'BGS',
  'BHG',
  'BHI',
  'BHM',
  'BIL',
  'BIO',
  'BIY',
  'BLA',
  'BLD',
  'BLE',
  'BLG',
  'BLH',
  'BLK',
  'BLL',
  'BLO',
  'BLT',
  'BLV',
  'BMB',
  'BMH',
  'BMP',
  'BNA',
  'BNL',
  'BNV',
  'BNY',
  'BOD',
  'BON',
  'BPB',
  'BPN',
  'BPS',
  'BPT',
  'BPW',
  'BRA',
  'BRC',
  'BRI',
  'BRK',
  'BRL',
  'BRN',
  'BRO',
  'BRR',
  'BSE',
  'BSI',
  'BSK',
  'BSL',
  'BSM',
  'BSS',
  'BSU',
  'BTB',
  'BTH',
  'BTN',
  'BTS',
  'BUD',
  'BUI',
  'BUS',
  'BUT',
  'BWD',
  'BWG',
  'BWK',
  'BWT',
  'BYF',
  'BYK',
  'BYL',
  'CAG',
  'CAK',
  'CAN',
  'CAR',
  'CAY',
  'CBC',
  'CBD',
  'CBG',
  'CBL',
  'CBN',
  'CBS',
  'CCT',
  'CDB',
  'CDD',
  'CDF',
  'CDO',
  'CDQ',
  'CDR',
  'CDY',
  'CEA',
  'CEF',
  'CFF',
  'CGD',
  'CHC',
  'CHD',
  'CHF',
  'CHU',
  'CHX',
  'CKH',
  'CKS',
  'CKT',
  'CLS',
  'CLU',
  'CLY',
  'CML',
  'CMO',
  'CMY',
  'CNM',
  'CNR',
  'COA',
  'COI',
  'CON',
  'COR',
  'COV',
  'COW',
  'CPA',
  'CPM',
  'CRB',
  'CRE',
  'CRF',
  'CRL',
  'CRO',
  'CRR',
  'CRS',
  'CTE',
  'CTR',
  'CTW',
  'CUA',
  'CUB',
  'CUH',
  'CUP',
  'CYK',
  'CYT',
  'DAG',
  'DAK',
  'DAL',
  'DAM',
  'DAR',
  'DBC',
  'DBE',
  'DBL',
  'DBY',
  'DCG',
  'DEE',
  'DFE',
  'DFL',
  'DFR',
  'DHM',
  'DIN',
  'DKD',
  'DLR',
  'DLW',
  'DLY',
  'DMC',
  'DMF',
  'DMR',
  'DMY',
  'DNL',
  'DNO',
  'DOC',
  'DON',
  'DOT',
  'DPT',
  'DRM',
  'DRN',
  'DRU',
  'DST',
  'DUM',
  'DUN',
  'DWL',
  'DWW',
  'DYC',
  'EDB',
  'EDP',
  'EGY',
  'EKB',
  'EKL',
  'ELG',
  'EST',
  'EUS',
  'EXD',
  'EXG',
  'EXT',
  'FKG',
  'FKK',
  'FLD',
  'FMT',
  'FOC',
  'FOR',
  'FRL',
  'FRN',
  'FRS',
  'FTM',
  'FTW',
  'GAL',
  'GAR',
  'GBG',
  'GCH',
  'GEA',
  'GFN',
  'GGJ',
  'GIR',
  'GKC',
  'GKW',
  'GLC',
  // 'GLC_LL',
  'GLE',
  'GLF',
  'GLG',
  'GLQ',
  // 'GLQ_LL',
  'GLT',
  'GOF',
  'GOL',
  'GRA',
  'GRH',
  'GRK',
  'GRL',
  'GRS',
  'GSC',
  'GTR',
  'GVE',
  'HAL',
  'HBD',
  'HDB',
  'HDG',
  'HEX',
  'HKH',
  'HLC',
  'HLE',
  'HLF',
  'HLU',
  'HLW',
  'HLY',
  'HMS',
  'HMY',
  'HNC',
  'HNT',
  'HNW',
  'HNX',
  'HOZ',
  'HST',
  'HTW',
  'HUL',
  'HUN',
  'HWH',
  'HYM',
  'HYN',
  'IBM',
  'IGD',
  'ING',
  'INH',
  'INK',
  'INP',
  'INR',
  'INS',
  'INV',
  'IRV',
  'JHN',
  'JOR',
  'KBC',
  'KDY',
  'KEH',
  'KGE',
  'KGH',
  'KGP',
  'KGX',
  'KID',
  'KIL',
  'KIN',
  'KKH',
  'KKN',
  'KLM',
  'KMK',
  'KNS',
  'KPT',
  'KRK',
  'KTL',
  'KTR',
  'KVD',
  'KWD',
  'KWN',
  'KYL',
  'LAN',
  'LAR',
  'LAU',
  'LBT',
  'LCC',
  'LCG',
  'LCL',
  'LCS',
  'LDS',
  'LDY',
  'LEI',
  'LEU',
  'LGB',
  'LGS',
  'LHA',
  'LHE',
  'LHW',
  'LIN',
  'LIV',
  'LMS',
  'LND',
  'LNK',
  'LNZ',
  'LOC',
  'LOS',
  'LPY',
  'LRG',
  'LRH',
  'LSK',
  'LSN',
  'LVG',
  'MAN',
  'MAU',
  'MAX',
  'MAY',
  'MBR',
  'MCE',
  'MCO',
  'MCV',
  'MEN',
  'MEY',
  'MFL',
  'MHR',
  'MHS',
  'MIA',
  'MIN',
  'MKC',
  'MKM',
  'MLG',
  'MLN',
  'MNC',
  'MOG',
  'MON',
  'MOO',
  'MPK',
  'MPT',
  'MRR',
  'MTC',
  'MTH',
  'MTS',
  'MTV',
  'MUB',
  'MUI',
  'MYB',
  'MYH',
  'NBW',
  'NCK',
  'NCL',
  'NEG',
  'NEI',
  'NEW',
  'NIT',
  'NNG',
  'NOA',
  'NOT',
  'NQU',
  'NQY',
  'NRN',
  'NTA',
  'NTN',
  'NTR',
  'NWR',
  'OBN',
  'OXF',
  'OXN',
  'PAD',
  'PAR',
  'PBO',
  'PCN',
  'PDG',
  'PGN',
  'PIT',
  'PLE',
  'PLK',
  'PLN',
  'PLW',
  'PLY',
  'PMT',
  'PNR',
  'PNZ',
  'POO',
  'PPK',
  'PRA',
  'PRE',
  'PRU',
  'PST',
  'PTG',
  'PTH',
  'PTK',
  'PTL',
  'PTT',
  'PTW',
  'PWE',
  'PWW',
  'PYG',
  'PYJ',
  'QPK',
  'QUI',
  'RAN',
  'RDG',
  'RDM',
  'RED',
  'RET',
  'ROC',
  'ROG',
  'ROS',
  'RTN',
  'RUG',
  'RUT',
  'RYB',
  'SAD',
  'SAU',
  'SBF',
  'SBR',
  'SCA',
  'SCH',
  'SCR',
  'SCS',
  'SCT',
  'SDM',
  'SER',
  'SFA',
  'SFI',
  'SGL',
  'SGM',
  'SHF',
  'SHL',
  'SHS',
  'SIN',
  'SKS',
  'SLA',
  'SLD',
  'SLS',
  'SLT',
  'SOA',
  'SOI',
  'SOT',
  'SOU',
  'SPF',
  'SPH',
  'SPR',
  'SPS',
  'SPT',
  'SQH',
  'SRA',
  'STA',
  'STC',
  'STF',
  'STG',
  'STN',
  'STP',
  'STR',
  'STS',
  'STT',
  'STV',
  'SUM',
  'SUN',
  'SVG',
  'TAI',
  'TAM',
  'TAU',
  'TAY',
  'TGM',
  'THB',
  'THS',
  'THT',
  'TOT',
  'TRN',
  'TRO',
  'TRU',
  'TTF',
  'TUL',
  'TVP',
  'TWB',
  'TYL',
  'UDD',
  'UHA',
  'UTY',
  'WAF',
  'WBQ',
  'WCK',
  'WCL',
  'WCR',
  'WDL',
  'WDM',
  'WES',
  'WFF',
  'WFJ',
  'WGN',
  'WGW',
  'WHA',
  'WID',
  'WIN',
  'WKB',
  'WKF',
  'WLM',
  'WML',
  'WMS',
  'WNL',
  'WRL',
  'WSH',
  'WSM',
  'WTA',
  'WVH',
  'WYM',
  'YOK',
  'YRK',
]

const AVAILABLE_STATIONS = {
  low: ALL_AVAILABLE_STATIONS,
  high: ALL_AVAILABLE_STATIONS,
}

const AVAILABLE_DISRUPTION_REASONS = {
  'a bicycle on the track': ['earlier on this trains journey', 'earlier today', ''],
  'a boat colliding with a bridge': ['earlier today', ''],
  'a bridge being damaged by a boat': [''],
  'a bridge being damaged by a road vehicle': [''],
  'a bridge being damaged': [''],
  'a bridge having collapsed': [''],
  'a broken down train': ['earlier today', ''],
  'a broken rail': [''],
  'a broken windscreen on the train': [''],
  'a burst water main flooding the railway': ['earlier today', ''],
  'a burst water main near the railway': ['earlier today', 'yesterday', ''],
  'a bus colliding with a bridge': ['earlier on this trains journey', 'earlier today', ''],
  'a chemical spillage near the railway': ['earlier today', 'yesterday', ''],
  'a coach becoming uncoupled on a train': ['earlier in its journey', 'earlier today', ''],
  'a coach becoming uncoupled on this train': ['earlier in its journey', 'earlier today', ''],
  'a collision at a level crossing': ['earlier today', 'yesterday', ''],
  'a collision between trains': [''],
  'a collision with the buffers at a station': [''],
  'a derailed train': [''],
  'a derailment within the depot': [''],
  'a fault occurring when attaching a part of a train': [''],
  'a fault occurring when attaching a part of this train': [''],
  'a fault occurring when detaching a part of a train': [''],
  'a fault occurring when detaching a part of this train': [''],
  'a fault on a train in front of this one': [''],
  'a fault on this train which is now fixed': [''],
  'a fault on this train': [''],
  'a fault with a swing bridge over a river': ['earlier today', ''],
  'a fault with barriers at a level crossing': ['earlier today', 'yesterday', ''],
  'a fault with the electric third rail': ['earlier on this trains journey', 'earlier today', ''],
  'a fault with the on-train signalling system': ['earlier on this trains journey', 'earlier today', ''],
  'a fault with the radio system between the driver and the signaller': ['earlier on this trains journey', 'earlier today', ''],
  'a fault with the signalling system': ['earlier on this trains journey', 'earlier today', ''],
  'a fire at a station': ['earlier', ''],
  'a fire near the railway involving gas cylinders': ['earlier today', 'yesterday', ''],
  'a fire near the railway suspected to involve gas cylinders': ['earlier today', 'yesterday', ''],
  'a fire next to the track': ['earlier today', ''],
  'a fire on a train': ['earlier today', ''],
  'a fire on property near the railway': ['earlier today', 'yesterday', ''],
  'a gas leak near the railway': ['earlier today', 'yesterday', ''],
  'a landslip': [''],
  'a late departure while the train was cleaned specially': [''],
  'a late running freight train': [''],
  'a late running train being in front of this one': [''],
  'a lorry colliding with a bridge': ['earlier on this trains journey', 'earlier today', ''],
  'a low speed derailment': [''],
  'a member of on-train staff being taken ill': [''],
  'a passenger being taken ill at a station': ['earlier today', ''],
  'a passenger being taken ill on a train': ['earlier today', ''],
  'a passenger being taken ill on this train': ['earlier in its journey', ''],
  'a person being hit by a train': ['earlier', ''],
  'a points failure (new)': [''],
  'a points failure': [''],
  'a power cut at this station': [''],
  'a problem currently under investigation': [''],
  'a problem with a river bridge': ['earlier today', ''],
  'a problem with lineside equipment': [''],
  'a problem with the station lighting': [''],
  'a rail buckling in the heat': [''],
  'a railway embankment being damaged': [''],
  'a river flooding the railway': ['earlier today', ''],
  'a road accident at a level crossing': ['earlier today', 'yesterday', ''],
  'a road accident near the railway': ['earlier today', 'yesterday', ''],
  'a road vehicle blocking the railway': ['earlier on this trains journey', 'earlier today', ''],
  'a road vehicle colliding with a bridge': ['earlier on this trains journey', 'earlier today', ''],
  'a road vehicle colliding with level crossing barriers': ['earlier today', 'yesterday', ''],
  'a road vehicle damaging track at a level crossing': ['earlier today', 'yesterday', ''],
  'a safety inspection of the track': ['earlier today', ''],
  'a safety inspection on a train': ['earlier today', ''],
  'a safety inspection on this train': ['earlier in its journey', ''],
  'a security alert at a station': [''],
  'a security alert': ['earlier today', ''],
  'a security alert on another train': [''],
  'a security alert on this train': [''],
  'a shortage of on-train staff': [''],
  'a shortage of station staff': [''],
  'a shortage of train conductors': [''],
  'a shortage of train crew': [''],
  'a shortage of train drivers': [''],
  'a shortage of train guards': [''],
  'a shortage of train managers': [''],
  'a shortage of trains because of accident damage': [''],
  'a shortage of trains because of extra safety inspections': [''],
  'a shortage of trains because of vandalism': [''],
  'a shortage of trains following damage by snow and ice': [''],
  'a signalling apparatus failure': [''],
  'a speed restriction because of fog': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction because of heavy rain': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction because of high track temperatures': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction because of high winds': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction because of severe weather': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction because of snow and ice': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction in a tunnel': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction over a bridge': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction over an embankment': ['earlier on this trains journey', 'earlier today', ''],
  'a speed restriction over defective track': ['earlier on this trains journey', 'earlier today', ''],
  'a staff shortage': [''],
  'a supermarket trolley on the track': ['earlier on this trains journey', 'earlier today', ''],
  'a technical problem': [''],
  'a train being involved in an accident': [''],
  'a train derailment': ['earlier today', 'yesterday'],
  'a train failure': [''],
  'a train hitting an obstruction on the line': ['earlier on this trains journey', 'earlier today', ''],
  'a train not stopping at a station it was supposed to': ['earlier in its journey', 'earlier today', ''],
  'a train not stopping in the correct position at a station': ['earlier in its journey', 'earlier today', ''],
  'a trains automatic braking system being activated': ['earlier in its journey', 'earlier today', ''],
  'a tree blocking the railway': ['earlier on this trains journey', 'earlier today', ''],
  'a tunnel being closed for safety reasons': [''],
  'a wartime bomb near the railway': ['earlier today', 'yesterday', ''],
  'a wartime bomb which has now been made safe': [''],
  'adverse weather conditions': [''],
  'an earlier landslip': [''],
  'an earlier problem with lineside equipment': [''],
  'an incident at the airport': [''],
  'an incident on the line': [''],
  'an object being caught on the overhead electric wires': ['earlier on this trains journey', 'earlier today', ''],
  'an obstruction on the track': ['earlier on this trains journey', 'earlier today', ''],
  'an operational incident': ['earlier in its journey', 'earlier today', ''],
  'animals on the railway': ['earlier today', ''],
  'attempted theft of overhead line electrification equipment': ['earlier today', 'yesterday', ''],
  'attempted theft of railway equipment': ['earlier today', 'yesterday', ''],
  'attempted theft of signalling cables': ['earlier today', 'yesterday', ''],
  'attempted theft of third rail electrification equipment': ['earlier today', 'yesterday', ''],
  'bad weather conditions': [''],
  'cancellation of the incoming service': [''],
  'cattle on the railway': ['earlier today', ''],
  'checking reports of an obstruction on the line': ['earlier on this trains journey', 'earlier today', ''],
  congestion: [''],
  'damage to the electric third rail': ['earlier on this trains journey', 'earlier today', ''],
  'damage to the overhead electric wires': ['earlier on this trains journey', 'earlier today', ''],
  'due to operational problems': [''],
  'earlier engineering works not being finished on time': [''],
  'engineering work': [''],
  'engineering works not being finished on time': [''],
  'engineering works': [''],
  'expected industrial action': ['earlier today', 'yesterday', ''],
  'failure of the electricity supply': ['earlier on this trains journey', 'earlier today', ''],
  'flood water making the railway potentially unsafe': ['earlier today', ''],
  flooding: ['earlier in this trains journey', 'earlier today', ''],
  'horses on the railway': ['earlier today', ''],
  'industrial action': ['earlier today', 'yesterday', ''],
  'mechanical problems': [''],
  'more trains than usual needing repairs at the same time': [''],
  'overcrowding as this train has fewer coaches than normal': [''],
  'overcrowding because an earlier train had fewer coaches than normal': [''],
  'overcrowding because of a concert': [''],
  'overcrowding because of a football match': [''],
  'overcrowding because of a marathon': [''],
  'overcrowding because of a rugby match': [''],
  'overcrowding because of a sporting event': [''],
  'overcrowding because of an earlier cancellation': [''],
  'overcrowding because of an event': [''],
  overcrowding: ['earlier on this trains journey', ''],
  'overhead electric line problems': [''],
  'passengers causing a disturbance': ['earlier on this trains journey'],
  'passengers causing a disturbance on a train': ['earlier today', ''],
  'passengers causing a disturbance on this train': [''],
  'poor rail conditions': [''],
  'predicted flooding': ['earlier today', ''],
  'sheep on the railway': ['earlier today', ''],
  'signalling difficulties': [''],
  'signalling staff being taken ill': ['earlier on this trains journey', 'earlier today', ''],
  'slippery rails': ['earlier in this trains journey', 'earlier today', ''],
  'staff shortages (phil)': [''],
  'staff shortages': [''],
  'suspected damage to a railway bridge': [''],
  'the ambulance service dealing with an incident near the railway': ['earlier today', 'yesterday', ''],
  'the ambulance service dealing with an incident': [''],
  'the communication alarm being activated on a train': [''],
  'the communication alarm being activated on this train': [''],
  'the electricity being switched off for safety reasons': ['earlier on this trains journey', 'earlier today', ''],
  'the emergency services dealing with an incident': ['earlier today', ''],
  'the emergency services dealing with an incident near the railway': ['earlier today', 'yesterday', ''],
  'the fire alarm sounding at a station': ['earlier today', ''],
  'the fire alarm sounding in a signal box': ['earlier on this trains journey', 'earlier today', ''],
  'the fire alarm sounding in the signalling centre': ['earlier on this trains journey', 'earlier today', ''],
  'the fire brigade dealing with an incident near the railway': ['earlier today', 'yesterday', ''],
  'the fire brigade dealing with an incident': [''],
  'the late arrival of an incoming train': [''],
  'the police dealing with an incident near the railway': ['earlier today', 'yesterday', ''],
  'the police dealing with an incident': [''],
  'the sea flooding the railway': ['earlier today', ''],
  'the train conductor being taken ill': [''],
  'the train departing late to maintain customer connections': [''],
  'the train driver being taken ill': [''],
  'the train for this service having broken down': [''],
  'the train guard being taken ill': [''],
  'the train making extra stops because a train was cancelled': [''],
  'the train making extra stops because of service disruption': [''],
  'the train manager being taken ill': [''],
  'theft of overhead line electrification equipment': ['earlier today', 'yesterday', ''],
  'theft of railway equipment': ['earlier today', 'yesterday', ''],
  'theft of signalling cables': ['earlier today', 'yesterday', ''],
  'theft of third rail electrical equipment': ['earlier today', 'yesterday', ''],
  'this train being late from the depot': [''],
  'this train breaking down': [''],
  'this train hitting an obstruction on the line': ['earlier in its journey', 'earlier on this trains journey', 'earlier today', ''],
  'this train not stopping at a station it was supposed to': ['earlier in its journey', 'earlier today', ''],
  'this train not stopping in the correct position at a station': ['earlier in its journey', 'earlier today', ''],
  'this trains automatic braking system being activated': ['earlier in its journey', 'earlier today', ''],
  'train crew being delayed by service disruption': [''],
  'train crew being delayed': [''],
  'trains being involved in an accident': [''],
  'trespass on the line': [''],
  'trespassers on the railway': ['earlier in this trains journey', 'earlier today', ''],
  'urgent repairs to a bridge': ['earlier today', ''],
  'urgent repairs to a tunnel': ['earlier today', ''],
  'urgent repairs to the railway': ['earlier today', ''],
  'urgent repairs to the track': ['earlier today', ''],
  'vandalism at a station': ['earlier today', 'yesterday', ''],
  'vandalism of railway equipment': ['earlier today', 'yesterday', ''],
  'vandalism on a train': ['earlier today', 'yesterday', ''],
  'vandalism on this train': ['earlier today', 'yesterday', ''],
  vandalism: [''],
  'waiting for a part of the train to be attached': [''],
}

const AnnouncementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  nextTrain: [],
  disruptedTrain: [],
}

export default class ScotRail extends StationAnnouncementSystem {
  readonly NAME = 'ScotRail Stations'
  readonly ID = 'SCOTRAIL_STN_V1'
  readonly FILE_PREFIX = 'station/scotrail/audio'
  readonly SYSTEM_TYPE = 'station'

  private getTocService(toc: string, dir: 'from' | 'to'): AudioItem[] {
    const files: AudioItem[] = []

    if (INTEGRATED_TOCS.map(t => t.toLowerCase()).includes(toc)) {
      files.push(`tocs.${toc.toLowerCase()} service to`)
    } else {
      files.push(`tocs.high.${toc.toLowerCase()}`, `tocs.service to`)
    }

    return files
  }

  /**
   * @returns "HH:mm YYYYYY service to ZZZZ (via AAAA)."
   */
  private assembleTrainInfo({ hour, min, toc, via, terminatingStationCode, destAllHigh = false }): AudioItem[] {
    const files: AudioItem[] = [`time.hour.${hour}`, `time.min.${min}`, ...this.getTocService(toc, 'to')]

    if (destAllHigh) {
      if (via !== 'none') {
        files.push(`stations.high._${terminatingStationCode}`, 'conjoiner.via', `stations.high._${via}`)
      } else {
        files.push(`stations.high._${terminatingStationCode}`)
      }
    } else {
      if (via !== 'none') {
        files.push(`stations.high._${terminatingStationCode}`, 'conjoiner.via', `stations.low._${via}`)
      } else {
        files.push(`stations.low._${terminatingStationCode}`)
      }
    }

    return files
  }

  private async playNextTrainAnnouncement(options: INextTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const files: AudioItem[] = []

    files.push(`platform info.the next train at platform ${options.platform} is the`)
    files.push(...this.assembleTrainInfo(options))

    files.push('conjoiner.calling at')

    if (options.callingAt.length === 0) {
      files.push(`stations.high._${options.terminatingStationCode}`, 'conjoiner.only')
    } else {
      const callingAtStops = options.callingAt.map(stn => stn.crsCode)
      files.push(
        ...this.pluraliseAudio([...callingAtStops.map(stn => `stations.high._${stn}`), `stations.low._${options.terminatingStationCode}`], {
          andId: 'conjoiner.and',
        }),
      )
    }

    files.push(`formation.this train is formed of ${options.coaches} ${options.coaches === '1' ? 'coach' : 'coaches'}`)

    await this.playAudioFiles(files, download)
  }

  // private async playThroughTrainAnnouncement(options: IThroughTrainAnnouncementOptions, download: boolean = false): Promise<void> {
  //   const files: AudioItem[] = []

  //   files.push(
  //     'the train now approaching',
  //     `platforms.high.platform ${options.platform}`,
  //     'does not stop here',
  //     'please stand well clear of the edge of',
  //     `platforms.low.platform ${options.platform}`,
  //   )

  //   await this.playAudioFiles(files, download)
  // }

  private async playDisruptedTrainAnnouncement(options: IDelayedTrainAnnouncementOptions, download: boolean = false): Promise<void> {
    const { delayTime, disruptionReason, disruptionType, platform } = options
    const files: AudioItem[] = []

    if (disruptionType === 'cancelled') {
      files.push('may i have your attention please on', `platforms.low.platform ${platform}`)
    }

    files.push(
      disruptionType === 'delayed' ? 'we are sorry that the' : 'we are sorry to announce that the',
      ...this.assembleTrainInfo({ ...options }),
    )

    if (disruptionType === 'delayed') {
      if (delayTime === 'unknown') {
        files.push('is delayed')
      } else {
        files.push('is delayed by approximately', `numbers.${delayTime}`, 'minutes')
      }
    } else if (disruptionType === 'cancelled') {
      files.push('has been cancelled')
    }

    if (disruptionReason !== 'unknown') {
      files.push({ id: 'this is due to', opts: { delayStart: 250 } }, `disruption-reasons.${disruptionReason}`)
    }

    if (disruptionType === 'delayed' && delayTime === 'unknown') {
      files.push('please listen for further announcements')
    }

    // Only play if delay time is known or is cancelled, else the faster alternate services are not actually known
    if ((delayTime !== 'unknown' || disruptionType === 'cancelled') && options.alternativeServices.length > 0) {
      options.alternativeServices.forEach(alternativeService => {
        const { hour, minute, platform, terminatingCrs, via } = alternativeService.service

        files.push(
          { id: 'passengers for', opts: { delayStart: 400 } },
          ...this.pluraliseAudio(
            alternativeService.passengersFor.map(stop => `stations.high.${stop.crsCode}`),
            { andId: 'conjoiner.and' },
          ),
          'your next fastest direct service is now expected to be the',
          `times.hour.${hour}`,
          `times.mins.${minute}`,
          'conjoiner.to',
        )

        if (via !== 'none') {
          files.push(`stations.high.${terminatingCrs}`, 'conjoiner.via', `stations.low.${via}`)
        } else {
          files.push(`stations.low.${terminatingCrs}`)
        }

        files.push('departing from', `platforms.low.platform ${platform}`)
      })
    }

    await this.playAudioFiles(files, download)
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab<string>> = {
    nextTrain: {
      name: 'Next train',
      component: CustomAnnouncementPane,
      defaultState: {
        platform: AVAILABLE_PLATFORMS[0],
        hour: '07',
        min: '22',
        toc: AVAILABLE_TOCS[0].toLowerCase(),
        terminatingStationCode: AVAILABLE_STATIONS.low[0],
        via: 'none',
        callingAt: [],
        coaches: '6',
      },
      props: {
        playHandler: this.playNextTrainAnnouncement.bind(this),
        presets: AnnouncementPresets.nextTrain,
        options: {
          platform: {
            name: 'Platform',
            default: AVAILABLE_PLATFORMS[0],
            options: AVAILABLE_PLATFORMS.map(p => ({ title: `Platform ${p}`, value: p })),
            type: 'select',
          },
          hour: {
            name: 'Hour',
            default: '07',
            options: ([...new Array(24)] as number[]).map((_, i) => ({
              title: i.toString().padStart(2, '0'),
              value: i.toString().padStart(2, '0'),
            })),
            type: 'select',
          },
          min: {
            name: 'Minute',
            default: '22',
            options: ([...new Array(60)] as number[]).map((_, i) => ({
              title: i.toString().padStart(2, '0'),
              value: i.toString().padStart(2, '0'),
            })),
            type: 'select',
          },
          toc: {
            name: 'TOC',
            default: AVAILABLE_TOCS[0].toLowerCase(),
            options: AVAILABLE_TOCS.map(m => ({ title: m, value: m.toLowerCase() })),
            type: 'select',
          },
          terminatingStationCode: {
            name: 'Terminating station',
            default: AVAILABLE_STATIONS.low[0],
            options: AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value)),
            type: 'select',
          },
          via: {
            name: 'Via... (optional)',
            default: 'none',
            options: [{ title: 'NONE', value: 'none' }, ...AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value))],
            type: 'select',
          },
          callingAt: {
            name: '',
            type: 'custom',
            component: CallingAtSelector,
            props: {
              availableStations: AVAILABLE_STATIONS.high,
            },
            default: [],
          },
          coaches: {
            name: 'Coach count',
            default: '6',
            options: ([...new Array(12)] as number[]).map((_, i) => ({
              title: (i + 1).toString(),
              value: (i + 1).toString(),
            })),
            type: 'select',
          },
          // seating: {
          //   name: 'Seating availability',
          //   default: 'none',
          //   options: [{ title: '(not stated)', value: 'none' }, ...AVAILABLE_SEATING_AVAILABILITY.map(c => ({ title: c, value: c }))],
          //   type: 'select',
          // },
          // special: {
          //   name: 'Special remarks',
          //   default: [],
          //   options: AVAILABLE_SPECIAL_REMARKS,
          //   type: 'multiselect',
          // },
        },
      },
    } as CustomAnnouncementTab<keyof INextTrainAnnouncementOptions>,
    // fastTrain: {
    //   name: 'Fast train',
    //   component: CustomAnnouncementPane,
    //   props: {
    //     playHandler: this.playThroughTrainAnnouncement.bind(this),
    //     options: {
    //       platform: {
    //         name: 'Platform',
    //         default: AVAILABLE_PLATFORMS.low.filter(x => AVAILABLE_PLATFORMS.high.includes(x))[0],
    //         options: AVAILABLE_PLATFORMS.low.filter(x => AVAILABLE_PLATFORMS.high.includes(x)).map(p => ({ title: `Platform ${p}`, value: p })),
    //         type: 'select',
    //       },
    //     },
    //   },
    // },
    // disruptedTrain: {
    //   name: 'Delayed/cancelled train',
    //   component: CustomAnnouncementPane,
    //   props: {
    //     playHandler: this.playDisruptedTrainAnnouncement.bind(this),
    //     presets: AnnouncementPresets.disruptedTrain,
    //     options: {
    //       hour: {
    //         name: 'Hour',
    //         default: AVAILABLE_HOURS[0],
    //         options: AVAILABLE_HOURS.map(h => ({ title: h, value: h })),
    //         type: 'select',
    //       },
    //       min: {
    //         name: 'Minute',
    //         default: AVAILABLE_MINUTES[0],
    //         options: AVAILABLE_MINUTES.map(m => ({ title: m, value: m })),
    //         type: 'select',
    //       },
    //       toc: {
    //         name: 'TOC',
    //         default: AVAILABLE_TOCS[0].toLowerCase(),
    //         options: AVAILABLE_TOCS.map(m => ({ title: m, value: m.toLowerCase() })),
    //         type: 'select',
    //       },
    //       terminatingStationCode: {
    //         name: 'Terminating station',
    //         default: AVAILABLE_STATIONS.low[0],
    //         options: AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value)),
    //         type: 'select',
    //       },
    //       via: {
    //         name: 'Via... (optional)',
    //         default: 'none',
    //         options: [{ title: 'NONE', value: 'none' }, ...AllStationsTitleValueMap.filter(s => AVAILABLE_STATIONS.low.includes(s.value))],
    //         type: 'select',
    //       },
    //       disruptionType: {
    //         name: '',
    //         type: 'custom',
    //         default: 'delayed',
    //         component: ({ value, onChange }) => {
    //           return (
    //             <fieldset>
    //               <legend>Disruption type</legend>
    //               <input
    //                 type="radio"
    //                 id="disruptionTypeDelay"
    //                 checked={value === 'delayed'}
    //                 name="disruptionType"
    //                 onChange={e => {
    //                   if (e.target.checked) {
    //                     onChange('delayed')
    //                   }
    //                 }}
    //               />
    //               <label htmlFor="disruptionTypeDelay">Delay</label>
    //               <input
    //                 type="radio"
    //                 id="disruptionTypeCancel"
    //                 checked={value === 'cancelled'}
    //                 name="disruptionType"
    //                 onChange={e => {
    //                   if (e.target.checked) {
    //                     onChange('cancelled')
    //                   }
    //                 }}
    //               />
    //               <label htmlFor="disruptionTypeCancel">Cancelled</label>
    //             </fieldset>
    //           )
    //         },
    //         props: {},
    //       },
    //       delayTime: {
    //         name: '',
    //         type: 'custom',
    //         default: 'unknown',
    //         component: ({ activeState, value, onChange, availableDelayTimes }) => {
    //           if (activeState.disruptionType !== 'delayed') {
    //             return null
    //           }

    //           return (
    //             <label>
    //               Delay time
    //               <select
    //                 value={value}
    //                 onChange={e => {
    //                   onChange({ ...value, delayTime: e.target.value })
    //                 }}
    //               >
    //                 {availableDelayTimes.map(d => (
    //                   <option key={d.value} value={d.value}>
    //                     {d.title}
    //                   </option>
    //                 ))}
    //               </select>
    //             </label>
    //           )
    //         },
    //         props: {
    //           availableDelayTimes: [
    //             { title: 'Unknown', value: 'unknown' },
    //             ...AVAILABLE_NUMBERS.map(h => ({ title: `${h} minute(s)`, value: h })),
    //           ],
    //         },
    //       },
    //       platform: {
    //         name: '',
    //         type: 'custom',
    //         default: AVAILABLE_PLATFORMS.low[0],
    //         component: ({ activeState, value, onChange, availablePlatforms }) => {
    //           if (activeState.disruptionType !== 'cancelled') {
    //             return null
    //           }

    //           return (
    //             <label>
    //               Platform
    //               <select
    //                 value={value}
    //                 onChange={e => {
    //                   onChange({ ...value, platform: e.target.value })
    //                 }}
    //               >
    //                 {availablePlatforms.map(d => (
    //                   <option key={d.value} value={d.value}>
    //                     {d.title}
    //                   </option>
    //                 ))}
    //               </select>
    //             </label>
    //           )
    //         },
    //         props: {
    //           availablePlatforms: AVAILABLE_PLATFORMS.low.map(p => ({ title: `Platform ${p}`, value: p })),
    //         },
    //       },
    //       disruptionReason: {
    //         name: 'Delay reason',
    //         default: 'unknown',
    //         options: [{ title: 'Unknown', value: 'unknown' }, ...AVAILABLE_DISRUPTION_REASONS.map(h => ({ title: h, value: h.toLowerCase() }))],
    //         type: 'select',
    //       },
    //       alternativeServices: {
    //         name: '',
    //         type: 'custom',
    //         component: AtosDisruptionAlternatives,
    //         props: {
    //           availableStations: AVAILABLE_STATIONS,
    //           hours: AVAILABLE_HOURS,
    //           mins: AVAILABLE_MINUTES,
    //           platforms: AVAILABLE_PLATFORMS,
    //         },
    //         default: [],
    //       },
    //     },
    //   },
    // },
    // announcementButtons: {
    //   name: 'Announcement buttons',
    //   component: CustomButtonPane,
    //   props: {
    //     buttons: [
    //       {
    //         label: '3 chimes',
    //         play: this.playAudioFiles.bind(this, ['3 chime']),
    //         download: this.playAudioFiles.bind(this, ['3 chime'], true),
    //       },
    //       {
    //         label: '4 chimes',
    //         play: this.playAudioFiles.bind(this, ['4 chime']),
    //         download: this.playAudioFiles.bind(this, ['4 chime'], true),
    //       },
    //     ],
    //   },
    // },
  }
}
