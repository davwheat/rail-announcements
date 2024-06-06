import { TrainService } from '../../../functions/api/get-services'

/**
 * Find short platform information for a station stop.
 *
 * @param crs Station CRS
 * @param platformNumber Scheduled/actual platform number
 * @param toc TOC code
 */
export function isShortPlatform(crs: string, platformNumber: string | null, train: TrainService): string | null {
  try {
    if (platformNumber === null) return null

    const toc = train.operatorCode
    const val = data?.[crs]?.[platformNumber.toLowerCase()]?.[toc] || data?.[crs]?.['*']?.[toc]

    let out: string | null = null

    if (typeof val === 'function') {
      out = val(train)
    } else {
      out = val
    }

    // Ignore short platforms when the train has fewer coaches than the platform accomodates.
    if (out) {
      const count = parseInt(out.split('.')[1])

      if (count && !isNaN(count) && train.length !== null && train.length > 0) {
        if (count <= train.length) {
          out = null
        }
      }
    }

    return out
  } catch (_) {
    console.warn('Failed to get short platform info for', crs)
    return null
  }
}

/**
 * Short platform data for stations.
 *
 * Mapped by CRS -> Platform -> TOC code
 *
 * Final value must match this format, where `n` is a number between 1 and 12:
 * `<front|middle|rear>.<n>`
 *
 * A platform named of `*` will be used as a default for all platforms.
 */
const data: Record<
  string,
  Record<
    string,
    Record<
      string,
      `${'front' | 'middle' | 'rear'}.${number}` | null | ((service: TrainService) => `${'front' | 'middle' | 'rear'}.${number}` | null)
    >
  >
> = {
  AGT: {
    '*': {
      SN: 'front.4',
      TL: 'front.4',
    },
  },
  AMY: {
    '*': {
      SN: 'front.5',
      TL: 'front.5',
    },
  },
  ANZ: {
    '*': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  ANG: {
    '*': {
      SN: 'front.7',
      TL: 'front.7',
    },
  },
  APD: {
    '1': {
      SN: 'front.2',
    },
    '2': {
      SN: 'front.2',
    },
  },
  APS: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  AHD: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  BAB: {
    '2': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
  },
  BAL: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
      GN: 'front.10',
      GX: 'front.10',
      SE: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
      GN: 'front.10',
      GX: 'front.10',
      SE: 'front.10',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
  },
  BAD: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
  },
  BAK: {
    '2': {
      SN: 'front.5',
      TL: 'front.5',
      GN: 'front.5',
      GX: 'front.5',
      SE: 'front.5',
    },
    '3': {
      SN: 'front.10',
      TL: 'front.10',
      GN: 'front.10',
      GX: 'front.10',
      SE: 'front.10',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
    '5': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
  },
  BEC: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
    },
    '*': {
      SE: 'front.8',
    },
  },
  BDH: {
    '*': {
      SN: 'front.6',
      TL: 'front.6',
    },
  },
  BLM: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  BRK: {
    '*': {
      SN: 'front.7',
      TL: 'front.7',
    },
  },
  BIG: {
    '*': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  BIK: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  BIP: {
    '1': {
      SN: 'front.5',
    },
  },
  BTE: {
    '*': {
      SN: 'front.7',
    },
  },
  BLY: {
    '6': {
      SN: 'front.6',
    },
  },
  BOG: {
    '4': {
      SN: 'front.4',
    },
  },
  BKA: {
    '*': {
      SN: 'front.10',
    },
  },
  BOH: {
    '*': {
      SN: 'front.7',
    },
  },
  BOE: {
    '*': {
      SN: 'front.6',
    },
  },
  BXW: {
    '*': {
      SN: 'front.10',
    },
  },
  BCY: {
    '*': {
      SN: 'front.10',
    },
  },
  BSH: {
    '3': {
      SN: 'front.4',
    },
    '4': {
      SN: 'front.10',
    },
  },
  BUO: {
    '*': {
      SN: 'front.8',
    },
  },
  CSH: {
    '*': {
      SN: 'front.10',
    },
  },
  CSB: {
    '*': {
      SN: 'front.8',
    },
  },
  CHP: {
    '*': {
      SN: 'front.6',
    },
  },
  CHH: {
    '*': {
      SN: 'front.7',
    },
  },
  CLA: {
    '*': {
      SN: 'front.10',
    },
  },
  CLP: {
    '*': {
      SE: 'front.5',
      SN: 'front.5',
      TL: 'front.5',
    },
  },
  CLJ: {
    '14': {
      SN: 'front.10',
    },
    '15': {
      SN: 'front.10',
    },
    '16': {
      SN: 'front.8',
    },
    '17': {
      SN: 'front.8',
    },
  },
  CLL: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.4',
    },
  },
  CBB: {
    '*': {
      SN: 'front.4',
    },
  },
  COB: {
    '1': {
      SN: southernTurboElectro('front.5', 'front.6'),
    },
    '2': {
      SN: southernTurboElectro('front.5', 'front.6'),
    },
  },
  CBR: {
    '1': {
      SN: 'front.8',
    },
    '*': {
      SN: 'front.6',
    },
  },
  CSA: {
    '*': {
      SN: 'front.8',
    },
  },
  CDN: {
    '*': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  CWN: {
    '1': {
      SN: 'front.10',
    },
  },
  CYP: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '4': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '6': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '*': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  DMK: {
    '*': {
      SE: 'front.8',
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  DLH: {
    '1': {
      SN: 'front.1',
    },
  },
  DMS: {
    '*': {
      SN: 'front.8',
    },
  },
  DUR: {
    '*': {
      SN: 'front.6',
    },
  },
  ELD: {
    '*': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  EDW: {
    '*': {
      SN: 'front.7',
    },
  },
  EWR: {
    '*': {
      SN: 'front.4',
    },
  },
  EBR: {
    '*': {
      SN: 'front.5',
    },
  },
  EFF: {
    '*': {
      SN: 'front.10',
    },
  },
  EMS: {
    '*': {
      SN: 'front.7',
    },
  },
  EPS: {
    '*': {
      SN: 'front.10',
    },
  },
  EPD: {
    '1': {
      SN: 'front.10',
    },
  },
  EWE: {
    '*': {
      SN: 'front.8',
    },
  },
  FMR: {
    '*': {
      SN: 'front.8',
    },
  },
  FRM: {
    '*': {
      SN: 'front.8',
    },
  },
  FGT: {
    '*': {
      SN: 'front.4',
      TL: 'front.4',
    },
  },
  FSB: {
    '*': {
      SN: 'front.6',
    },
  },
  FSG: {
    '*': {
      SN: 'front.4',
    },
  },
  FOD: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.6',
    },
  },
  FOH: {
    '*': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  FTN: {
    '*': {
      SN: 'front.8',
    },
  },
  GIP: {
    '*': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  GLY: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.6',
    },
  },
  GDN: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.6',
    },
  },
  GBS: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.5',
    },
  },
  HCB: {
    '*': {
      SN: 'front.7',
      TL: 'front.7',
    },
  },
  HMT: {
    '1': {
      SN: 'front.3',
    },
    '2': {
      SN: 'front.3',
    },
  },
  HME: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.4',
    },
  },
  HMD: {
    '*': {
      SN: southernTurboElectro('front.7', 'front.8'),
    },
  },
  HGS: {
    '1': {
      SN: southernTurboElectro('front.6', 'front.8'),
    },
  },
  HYR: {
    '*': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  HDE: {
    '*': {
      SN: 'front.8',
    },
  },
  HLS: {
    '*': {
      SN: 'front.8',
    },
  },
  HLM: {
    '*': {
      SN: 'front.6',
    },
  },
  HPA: {
    '*': {
      SN: 'front.10',
    },
  },
  HSY: {
    '*': {
      SN: 'front.10',
    },
  },
  IFI: {
    '*': {
      SN: 'front.5',
      TL: 'front.5',
    },
  },
  IMW: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  KLY: {
    '*': {
      SN: 'front.5',
      TL: 'front.5',
    },
  },
  KPA: {
    '2': {
      SN: 'front.8',
    },
  },
  KGL: {
    '*': {
      SN: 'front.10',
    },
  },
  KND: {
    '*': {
      SN: 'front.6',
    },
  },
  LAC: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.8',
    },
  },
  LIH: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.6',
    },
  },
  LWS: {
    '3': {
      SN: 'front.6',
    },
    '4': {
      SN: 'front.7',
    },
    '5': {
      SN: 'front.7',
    },
  },
  LFD: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  LIT: {
    '3': {
      SN: 'front.8',
    },
    '4': {
      SN: 'front.6',
    },
  },
  LRB: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.6',
    },
  },
  LRG: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  VIC: {
    '3': {
      SN: 'front.9',
    },
    '4': {
      SN: 'front.9',
    },
    '8': {
      SN: 'front.10',
    },
    '*': {
      SE: 'front.9',
    },
  },
  MKC: {
    '2a': {
      SN: 'front.6',
    },
  },
  MTC: {
    '1': {
      SN: 'front.9',
      TL: 'front.9',
    },
    '2': {
      SN: 'front.9',
      TL: 'front.9',
    },
  },
  MIJ: {
    '1': {
      SN: 'front.7',
      TL: 'front.7',
    },
    '2': {
      SN: 'front.7',
      TL: 'front.7',
    },
  },
  MDS: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  MCB: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.4',
    },
  },
  NTL: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  NXG: {
    '1': {
      SN: 'front.5',
      TL: 'front.5',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '5': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  NVH: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.4',
    },
  },
  NVN: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.4',
    },
  },
  NRB: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  NSB: {
    '1': {
      SN: 'front.3',
    },
    '2': {
      SN: 'front.3',
    },
  },
  NDL: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  NWD: {
    '1': {
      SN: southernTurboElectro('front.7', 'front.10'),
    },
    '2': {
      SN: southernTurboElectro('front.7', 'front.10'),
    },
    '3': {
      SN: southernTurboElectro('front.7', 'front.10'),
    },
    '4': {
      SN: southernTurboElectro('front.7', 'front.10'),
    },
    '5': {
      SN: southernTurboElectro('front.7', 'front.10'),
    },
    '6': {
      SN: southernTurboElectro('front.7', 'front.9'),
    },
    '*': {
      SE: 'front.8',
    },
  },
  NUT: {
    '1': {
      SN: 'front.5',
    },
    '2': {
      SN: 'front.5',
    },
  },
  OLY: {
    '1': {
      SN: 'front.7',
    },
    '2': {
      SN: 'front.7',
    },
  },
  ORE: {
    '1': {
      SN: southernTurboElectro('front.4', 'front.5'),
    },
    '2': {
      SN: southernTurboElectro('front.4', 'front.5'),
    },
    '*': {
      SE: 'front.5',
    },
  },
  OXT: {
    '1': {
      SN: southernTurboElectro('front.10', 'front.11'),
    },
    '2': {
      SN: southernTurboElectro('front.10', 'front.11'),
    },
    '3': {
      SN: southernTurboElectro('front.3', 'front.4'),
    },
  },
  PMR: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '*': {
      SE: 'front.8',
    },
  },
  PNW: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  PHR: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.4',
    },
  },
  PEV: {
    '1': {
      SN: southernTurboElectro('front.4', 'front.5'),
    },
    '2': {
      SN: southernTurboElectro('front.4', 'front.5'),
    },
  },
  PEB: {
    '1': {
      SN: southernTurboElectro('front.3', 'front.3'),
    },
    '2': {
      SN: southernTurboElectro('front.3', 'front.3'),
    },
  },
  PMP: {
    '1': {
      SN: 'front.7',
    },
    '2': {
      SN: 'front.7',
    },
  },
  PTC: {
    '1': {
      SN: 'front.5',
    },
    '2': {
      SN: 'front.5',
    },
  },
  PLD: {
    '2': {
      SN: 'front.7',
    },
  },
  PMH: {
    '1': {
      SN: 'front.8',
    },
  },
  PUL: {
    '1': {
      SN: 'front.9',
    },
    '2': {
      SN: 'front.9',
    },
  },
  PUR: {
    '5': {
      SN: 'front.10',
      TL: 'front.12',
    },
    '6': {
      SN: 'front.10',
      TL: 'front.12',
    },
  },
  PUO: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  QRP: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  RHM: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  REI: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.4',
      TL: 'front.4',
    },
  },
  RDD: {
    '1': {
      SN: southernTurboElectro('front.7', 'front.9'),
      TL: 'front.9',
    },
    '2': {
      SN: southernTurboElectro('front.7', 'front.9'),
      TL: 'front.9',
    },
  },
  RYE: {
    '1': {
      SN: 'front.3',
    },
    '2': {
      SN: 'front.3',
    },
  },
  SAF: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  SEF: {
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  SRS: {
    '1': {
      SN: 'front.10',
      GX: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      GX: 'front.10',
      TL: 'front.10',
    },
    '3': {
      SN: 'front.8',
      GX: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.8',
      GX: 'front.8',
      TL: 'front.8',
    },
  },
  SPB: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  SHO: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  SBM: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  SCY: {
    '1': {
      SN: southernTurboElectro('front.6', 'front.8'),
      TL: 'front.8',
    },
    '2': {
      SN: southernTurboElectro('front.6', 'front.8'),
      TL: 'front.8',
    },
    '3': {
      SN: southernTurboElectro('front.6', 'front.8'),
      TL: 'front.8',
    },
    '4': {
      SN: southernTurboElectro('front.6', 'front.8'),
      TL: 'front.8',
    },
    '5': {
      SN: southernTurboElectro('front.6', 'front.8'),
      TL: 'front.8',
    },
  },
  SMO: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  SOB: {
    '1': {
      SN: 'front.5',
    },
    '2': {
      SN: 'front.5',
    },
  },
  SEE: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.4',
    },
  },
  SWK: {
    '1': {
      SN: 'front.9',
    },
    '2': {
      SN: 'front.9',
    },
  },
  SDN: {
    '1': {
      SN: 'front.7',
    },
    '2': {
      SN: 'front.7',
    },
    '3': {
      SN: 'front.7',
    },
    '4': {
      SN: 'front.7',
    },
  },
  SIH: {
    '1': {
      SN: 'front.7',
      TL: 'front.7',
    },
    '2': {
      SN: 'front.7',
      TL: 'front.7',
    },
  },
  SLQ: {
    '1': {
      SN: southernTurboElectro('front.7', 'front.8'),
    },
    '2': {
      SN: southernTurboElectro('front.7', 'front.8'),
    },
    '*': {
      SE: 'front.8',
    },
  },
  STE: {
    '1': {
      SN: 'front.9',
      TL: 'front.9',
    },
    '2': {
      SN: 'front.9',
      TL: 'front.9',
    },
  },
  SRC: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  SRH: {
    '1': {
      SN: 'front.9',
      TL: 'front.9',
    },
    '2': {
      SN: 'front.9',
      TL: 'front.9',
    },
  },
  SUO: {
    '3': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '4': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  SUC: {
    '3': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  SNW: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  SWG: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.4',
    },
  },
  SYD: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  TAD: {
    '1': {
      SN: 'front.6',
      TL: 'front.6',
    },
    '2': {
      SN: 'front.6',
      TL: 'front.6',
    },
  },
  TAT: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '3': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  TTH: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
    '3': {
      SN: 'front.8',
    },
    '4': {
      SN: 'front.8',
    },
  },
  TOK: {
    '1': {
      SN: 'front.1',
    },
  },
  TON: {
    '4': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  TOO: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  TUH: {
    '1': {
      SN: 'front.8',
      TL: 'front.7',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.7',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.7',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.7',
    },
  },
  WDO: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  WLT: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  WSW: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  WWR: {
    '1': {
      SN: 'front.5',
      TL: 'front.5',
    },
    '2': {
      SN: 'front.5',
      TL: 'front.5',
    },
    '*': {
      SE: 'front.4',
    },
  },
  WBL: {
    '1': {
      SN: 'front.5',
    },
    '2': {
      SN: 'front.5',
    },
  },
  WNH: {
    '1': {
      SN: 'front.5',
    },
    '2': {
      SN: 'front.5',
    },
  },
  WFJ: {
    '11': {
      SN: 'front.4',
    },
  },
  WMB: {
    '3': {
      SN: 'front.7',
    },
    '4': {
      SN: 'front.7',
    },
    '5': {
      SN: 'front.7',
    },
    '6': {
      SN: 'front.7',
    },
  },
  WBP: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  WCY: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '3': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  WNW: {
    '1': {
      SN: 'front.7',
      TL: 'front.7',
    },
    '2': {
      SN: 'front.7',
      TL: 'front.7',
    },
  },
  WSU: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  WWO: {
    '1': {
      SN: 'front.6',
      TL: 'front.6',
    },
    '2': {
      SN: 'front.6',
      TL: 'front.6',
    },
  },
  WHY: {
    '1': {
      SN: 'front.7',
    },
    '2': {
      SN: 'front.7',
    },
  },
  WHS: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.5',
    },
  },
  WIM: {
    '9': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  WBO: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  WSE: {
    '1': {
      SN: 'front.3',
    },
  },
  WOH: {
    '1': {
      SN: southernTurboElectro('front.7', 'front.9'),
      TL: 'front.9',
    },
    '2': {
      SN: southernTurboElectro('front.7', 'front.9'),
      TL: 'front.9',
    },
  },
  WME: {
    '1': {
      SN: 'front.6',
      TL: 'front.6',
    },
    '2': {
      SN: 'front.6',
      TL: 'front.6',
    },
  },
  WLS: {
    '1': {
      SN: 'front.7',
      TL: 'front.7',
    },
    '2': {
      SN: 'front.7',
      TL: 'front.7',
    },
  },

  // ---- SE DATA -----

  BEG: {
    '*': {
      SE: 'front.3',
    },
  },
  WTR: {
    '*': {
      SE: 'front.3',
    },
  },
  AYL: {
    '*': {
      SE: 'front.4',
    },
  },
  CRT: {
    '*': {
      SE: 'front.4',
    },
  },
  CIL: {
    '*': {
      SE: 'front.4',
    },
  },
  CUX: {
    '*': {
      SE: 'front.4',
    },
  },
  EFL: {
    '*': {
      SE: 'front.4',
    },
  },
  HAI: {
    '*': {
      SE: 'front.4',
    },
  },
  MDB: {
    '*': {
      SE: 'front.4',
    },
  },
  NHE: {
    '*': {
      SE: 'front.4',
    },
  },
  SDA: {
    '*': {
      SE: 'front.4',
    },
  },
  STU: {
    '*': {
      SE: 'front.4',
    },
  },
  WYE: {
    '*': {
      SE: 'front.4',
    },
  },
  YAL: {
    '*': {
      SE: 'front.4',
    },
  },
  WHA: {
    '*': {
      SE: 'front.5',
    },
  },
  BMG: {
    '*': {
      SE: 'front.6',
    },
  },
  CHG: {
    '*': {
      SE: 'front.6',
    },
  },
  HRM: {
    '*': {
      SE: 'front.6',
    },
  },
  HBN: {
    '*': {
      SE: 'front.6',
    },
  },
  KMS: {
    '*': {
      SE: 'front.6',
    },
  },
  EPH: {
    '*': {
      SE: 'front.7',
    },
  },
  MDW: {
    '*': {
      SE: 'front.7',
    },
  },
  ADM: {
    '*': {
      SE: 'front.8',
    },
  },
  AYH: {
    '*': {
      SE: 'front.8',
    },
  },
  BBL: {
    '*': {
      SE: 'front.8',
    },
  },
  BAT: {
    '*': {
      SE: 'front.8',
    },
  },
  BSD: {
    '*': {
      SE: 'front.8',
    },
  },
  BKJ: {
    '*': {
      SE: 'front.8',
    },
  },
  BKS: {
    '*': {
      SE: 'front.8',
    },
  },
  BGM: {
    '*': {
      SE: 'front.8',
    },
  },
  BKL: {
    '*': {
      SE: 'front.8',
    },
  },
  BRG: {
    '*': {
      SE: 'front.8',
    },
  },
  BRX: {
    '*': {
      SE: 'front.8',
    },
  },
  CBE: {
    '*': {
      SE: 'front.8',
    },
  },
  CBW: {
    '*': {
      SE: 'front.8',
    },
  },
  CFT: {
    '*': {
      SE: 'front.8',
    },
  },
  CFB: {
    '*': {
      SE: 'front.8',
    },
  },
  CWU: {
    '*': {
      SE: 'front.8',
    },
  },
  DEA: {
    '*': {
      SE: 'front.8',
    },
  },
  DVP: {
    '*': {
      SE: 'front.8',
    },
  },
  EML: {
    '*': {
      SE: 'front.8',
    },
  },
  ETC: {
    '*': {
      SE: 'front.8',
    },
  },
  EYN: {
    '*': {
      SE: 'front.8',
    },
  },
  FNR: {
    '*': {
      SE: 'front.8',
    },
  },
  FRT: {
    '*': {
      SE: 'front.8',
    },
  },
  HNH: {
    '*': {
      SE: 'front.8',
    },
  },
  KSN: {
    '*': {
      SE: 'front.8',
    },
  },
  KML: {
    '*': {
      SE: 'front.8',
    },
  },
  KTH: {
    '*': {
      SE: 'front.8',
    },
  },
  LEN: {
    '*': {
      SE: 'front.8',
    },
  },
  LGJ: {
    '*': {
      SE: 'front.8',
    },
  },
  MDE: {
    '*': {
      SE: 'front.8',
    },
  },
  MTM: {
    '*': {
      SE: 'front.8',
    },
  },
  MSR: {
    '*': {
      SE: 'front.8',
    },
  },
  NHD: {
    '*': {
      SE: 'front.8',
    },
  },
  OTF: {
    '*': {
      SE: 'front.8',
    },
  },
  PNE: {
    '*': {
      SE: 'front.8',
    },
  },
  PLC: {
    '*': {
      SE: 'front.8',
    },
  },
  QBR: {
    '*': {
      SE: 'front.8',
    },
  },
  RVB: {
    '*': {
      SE: 'front.8',
    },
  },
  RDH: {
    '*': {
      SE: 'front.8',
    },
  },
  RBR: {
    '*': {
      SE: 'front.8',
    },
  },
  SDG: {
    '*': {
      SE: 'front.8',
    },
  },
  SEG: {
    '*': {
      SE: 'front.8',
    },
  },
  SSS: {
    '*': {
      SE: 'front.8',
    },
  },
  SPH: {
    '*': {
      SE: 'front.8',
    },
  },
  SEH: {
    '*': {
      SE: 'front.8',
    },
  },
  SRT: {
    '*': {
      SE: 'front.8',
    },
  },
  SWO: {
    '*': {
      SE: 'front.8',
    },
  },
  SOR: {
    '*': {
      SE: 'front.8',
    },
  },
  SOG: {
    '*': {
      SE: 'front.8',
    },
  },
  SWL: {
    '*': {
      SE: 'front.8',
    },
  },
  SYH: {
    '*': {
      SE: 'front.8',
    },
  },
  WAD: {
    '*': {
      SE: 'front.8',
    },
  },
  WAM: {
    '*': {
      SE: 'front.8',
    },
  },
  WDU: {
    '*': {
      SE: 'front.8',
    },
  },
  WMA: {
    '*': {
      SE: 'front.8',
    },
  },
  WLD: {
    '*': {
      SE: 'front.8',
    },
  },
  ABW: {
    '*': {
      SE: 'front.10',
    },
  },
  BNH: {
    '*': {
      SE: 'front.10',
    },
  },
  BMN: {
    '*': {
      SE: 'front.10',
    },
  },
  CTN: {
    '*': {
      SE: 'front.10',
    },
  },
  DFD: {
    '*': {
      SE: 'front.10',
    },
  },
  DEP: {
    '*': {
      SE: 'front.10',
    },
  },
  ELW: {
    '*': {
      SE: 'front.10',
    },
  },
  ERH: {
    '*': {
      SE: 'front.10',
    },
  },
  GRV: {
    '*': {
      SE: 'front.10',
    },
  },
  GNH: {
    '*': {
      SE: 'front.10',
    },
  },
  HGM: {
    '*': {
      SE: 'front.10',
    },
  },
  HGR: {
    '*': {
      SE: 'front.10',
    },
  },
  MZH: {
    '*': {
      SE: 'front.10',
    },
  },
  MTG: {
    '*': {
      SE: 'front.10',
    },
  },
  NWX: {
    '*': {
      SE: 'front.10',
    },
  },
  NEH: {
    '*': {
      SE: 'front.10',
    },
  },
  NFL: {
    '*': {
      SE: 'front.10',
    },
  },
  PLU: {
    '*': {
      SE: 'front.10',
    },
  },
  SGR: {
    '*': {
      SE: 'front.10',
    },
  },
  SAJ: {
    '*': {
      SE: 'front.10',
    },
  },
  SCG: {
    '*': {
      SE: 'front.10',
    },
  },
  SUP: {
    '*': {
      SE: 'front.10',
    },
  },
  SWM: {
    '*': {
      SE: 'front.10',
    },
  },
  TBW: {
    '*': {
      SE: 'front.10',
    },
  },
  WCB: {
    '*': {
      SE: 'front.10',
    },
  },
  WWD: {
    '*': {
      SE: 'front.10',
    },
  },
  CHX: {
    '*': {
      SE: 'front.11',
    },
  },
  HYM: {
    '*': {
      VT: 'front.9',
    },
  },
}

function southernTurboElectro(turboLen: `${'front' | 'middle' | 'rear'}.${number}`, electroLen: `${'front' | 'middle' | 'rear'}.${number}`) {
  return (trainService: TrainService): `${'front' | 'middle' | 'rear'}.${number}` | null => {
    const turboStns = ['AFK', 'UCK', 'APD', 'EBT']

    if (
      trainService.origin.some(s => turboStns.includes(s.crs)) ||
      trainService.destination.some(s => turboStns.includes(s.crs)) ||
      trainService.origin.some(s => turboStns.includes(s.crs)) ||
      trainService.destination.some(s => turboStns.includes(s.crs)) ||
      trainService.subsequentLocations.some(s => turboStns.includes(s.crs || ''))
    ) {
      return turboLen
    }

    return electroLen
  }
}
