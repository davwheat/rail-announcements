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
    const val = data[crs][platformNumber.toLowerCase()][toc]

    var out: string | null = null

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
    '1': {
      SN: 'front.4',
      TL: 'front.4',
      GN: 'front.4',
      GX: 'front.4',
      SE: 'front.4',
    },
    '2': {
      SN: 'front.4',
      TL: 'front.4',
      GN: 'front.4',
      GX: 'front.4',
      SE: 'front.4',
    },
  },
  AMY: {
    '1': {
      SN: 'front.5',
      TL: 'front.5',
      GN: 'front.5',
      GX: 'front.5',
      SE: 'front.5',
    },
    '2': {
      SN: 'front.5',
      TL: 'front.5',
      GN: 'front.5',
      GX: 'front.5',
      SE: 'front.5',
    },
  },
  ANZ: {
    '1': {
      SN: 'front.9',
      TL: 'front.9',
      GN: 'front.9',
      GX: 'front.9',
      SE: 'front.9',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
  },
  ANG: {
    '1': {
      SN: 'front.7',
      TL: 'front.7',
      GN: 'front.7',
      GX: 'front.7',
      SE: 'front.7',
    },
    '2': {
      SN: 'front.7',
      TL: 'front.7',
      GN: 'front.7',
      GX: 'front.7',
      SE: 'front.7',
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
      SE: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
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
  BDH: {
    '1': {
      SN: 'front.6',
      TL: 'front.6',
      GN: 'front.6',
      GX: 'front.6',
      SE: 'front.6',
    },
    '2': {
      SN: 'front.6',
      TL: 'front.6',
      GN: 'front.6',
      GX: 'front.6',
      SE: 'front.6',
    },
  },
  BLM: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
  },
  BRK: {
    '1': {
      SN: 'front.7',
      TL: 'front.7',
      GN: 'front.7',
      GX: 'front.7',
      SE: 'front.7',
    },
    '2': {
      SN: 'front.7',
      TL: 'front.7',
      GN: 'front.7',
      GX: 'front.7',
      SE: 'front.7',
    },
  },
  BIG: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
  },
  BIK: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
      GN: 'front.8',
      GX: 'front.8',
      SE: 'front.8',
    },
  },
  BIP: {
    '1': {
      SN: 'front.5',
    },
  },
  BTE: {
    '1': {
      SN: 'front.7',
    },
    '2': {
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
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  BOH: {
    '1': {
      SN: 'front.7',
    },
    '2': {
      SN: 'front.7',
    },
  },
  BOE: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.6',
    },
  },
  BXW: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  BCY: {
    '1': {
      SN: 'front.10',
    },
    '2': {
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
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  CSH: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  CSB: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  CHP: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.6',
    },
  },
  CHH: {
    '1': {
      SN: 'front.7',
    },
    '2': {
      SN: 'front.7',
    },
  },
  CLA: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  CLP: {
    '1': {
      SN: 'front.5',
      TL: 'front.5',
    },
    '2': {
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
    '1': {
      SN: 'front.4',
    },
    '2': {
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
    '2': {
      SN: 'front.6',
    },
  },
  CSA: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  CDN: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
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
    '3': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '4': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '5': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '6': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  DMK: {
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
  DLH: {
    '1': {
      SN: 'front.1',
    },
  },
  DMS: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
    '3': {
      SN: 'front.8',
    },
  },
  DUR: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.6',
    },
  },
  ELD: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  EDW: {
    '1': {
      SN: 'front.7',
    },
    '2': {
      SN: 'front.7',
    },
  },
  EWR: {
    '1': {
      SN: 'front.4',
    },
    '2': {
      SN: 'front.4',
    },
  },
  EBR: {
    '1': {
      SN: 'front.5',
    },
    '2': {
      SN: 'front.5',
    },
  },
  EFF: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  EMS: {
    '1': {
      SN: 'front.7',
    },
    '2': {
      SN: 'front.7',
    },
  },
  EPS: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
    '3': {
      SN: 'front.10',
    },
    '4': {
      SN: 'front.10',
    },
  },
  EPD: {
    '1': {
      SN: 'front.10',
    },
  },
  EWE: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  FMR: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  FRM: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  FGT: {
    '1': {
      SN: 'front.4',
      TL: 'front.4',
    },
    '2': {
      SN: 'front.4',
      TL: 'front.4',
    },
  },
  FSB: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.6',
    },
  },
  FSG: {
    '1': {
      SN: 'front.4',
    },
    '2': {
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
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
      SN: 'front.10',
      TL: 'front.10',
    },
  },
  FTN: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
    '3': {
      SN: 'front.8',
    },
  },
  GIP: {
    '1': {
      SN: 'front.10',
      TL: 'front.10',
    },
    '2': {
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
    '1': {
      SN: 'front.7',
      TL: 'front.7',
    },
    '2': {
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
    '1': {
      SN: southernTurboElectro('front.7', 'front.8'),
    },
    '2': {
      SN: southernTurboElectro('front.7', 'front.8'),
    },
  },
  HGS: {
    '1': {
      SN: southernTurboElectro('front.6', 'front.8'),
    },
  },
  HYR: {
    '1': {
      SN: 'front.8',
      TL: 'front.8',
    },
    '2': {
      SN: 'front.8',
      TL: 'front.8',
    },
  },
  HDE: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  HLS: {
    '1': {
      SN: 'front.8',
    },
    '2': {
      SN: 'front.8',
    },
  },
  HLM: {
    '1': {
      SN: 'front.6',
    },
    '2': {
      SN: 'front.6',
    },
  },
  HPA: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  HSY: {
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  IFI: {
    '1': {
      SN: 'front.5',
      TL: 'front.5',
    },
    '2': {
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
    '1': {
      SN: 'front.5',
      TL: 'front.5',
    },
    '2': {
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
    '1': {
      SN: 'front.10',
    },
    '2': {
      SN: 'front.10',
    },
  },
  KND: {
    '1': {
      SN: 'front.6',
    },
    '2': {
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
      SE: 'front.9',
    },
    '4': {
      SN: 'front.9',
      SE: 'front.9',
    },
    '8': {
      SN: 'front.10',
      SE: 'front.10',
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
