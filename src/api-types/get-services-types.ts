interface CancelLatenessReason {
  tiploc: string
  near: boolean
  value: number
  stationName?: string | null
}

interface NrccMessage {
  category: number
  severity: number
  xhtmlMessage: string
}

export interface EndPointLocation {
  isOperationalEndPoint: boolean
  locationName: string
  crs: string
  tiploc: string
  via?: string
  futureChangeTo?: number
  futureChangeToSpecified: boolean
}

export enum AssociationCategory {
  Join = 0,
  Divide = 1,
  LinkedFrom = 2,
  LinkedTo = 3,
}

export interface TimingLocation {
  locationName: string
  tiploc: string
  crs?: string
  isOperational: boolean
  isPass: boolean
  isCancelled: boolean
  platform?: string
  platformIsHidden: boolean
  serviceIsSuppressed: boolean
  sta: string
  staSpecified: boolean
  ata: string
  ataSpecified: boolean
  eta: string
  etaSpecified: boolean
  arrivalType: number
  arrivalTypeSpecified: boolean
  arrivalSource: string | null
  arrivalSourceInstance: any
  std: string
  stdSpecified: boolean
  atd: string
  atdSpecified: boolean
  etd: string
  etdSpecified: boolean
  departureType: number
  departureTypeSpecified: boolean
  departureSource: string | null
  departureSourceInstance: any
  lateness: any
  associations: Association[] | null
  adhocAlerts: any
  activities?: string[]
}

export interface AssociatedServiceLocation extends TimingLocation {
  length: number | null
  falseDest: null | EndPointLocation[]
  cancelReason: CancelLatenessReason | null
  delayReason: CancelLatenessReason | null
}

export interface AssociatedServiceDetail {
  cancelReason: CancelLatenessReason | null
  delayReason: CancelLatenessReason | null
  isCharter: boolean
  isPassengerService: boolean
  category: string
  sta: string
  staSpecified: boolean
  ata: string
  ataSpecified: boolean
  eta: string
  etaSpecified: boolean
  std: string
  stdSpecified: boolean
  atd: string
  atdSpecified: boolean
  etd: string
  etdSpecified: boolean
  rid: string
  uid: string
  locations: AssociatedServiceLocation[]
  trainid: string
}

export interface Association<Category extends AssociationCategory = AssociationCategory> {
  /**
   * 0: Join
   * 1: Divide
   * 2: Linked-From (last service)
   * 3: Linked-To (next service)
   */
  category: AssociationCategory
  rid: string
  uid: string
  trainid: string
  rsid?: string
  sdd: string
  origin: string
  originCRS: string
  originTiploc: string
  destination: string
  destCRS: string
  destTiploc: string
  isCancelled: boolean

  /**
   * Added by this proxy
   */
  service: Category extends AssociationCategory.Divide ? AssociatedServiceDetail : undefined
}

export interface TrainService {
  previousLocations: any
  subsequentLocations: TimingLocation[]
  cancelReason: CancelLatenessReason | null
  delayReason: CancelLatenessReason | null
  category: string
  activities?: string[]
  length: number | null
  isReverseFormation: boolean
  detachFront: boolean
  origin: EndPointLocation[]
  destination: EndPointLocation[]
  currentOrigins: EndPointLocation[] | null
  currentDestinations: EndPointLocation[] | null
  formation: any
  rid: string
  uid: string
  trainid: string
  rsid: string | null
  sdd: string
  operator: string
  operatorCode: string
  isPassengerService: boolean
  isCharter: boolean
  isCancelled: boolean
  isCircularRoute: boolean
  filterLocationCancelled: boolean
  filterLocationOperational: boolean
  isOperationalCall: boolean
  sta: string
  staSpecified: boolean
  ata: string
  ataSpecified: boolean
  eta: string
  etaSpecified: boolean
  arrivalType: number
  arrivalTypeSpecified: boolean
  arrivalSource: string | null
  arrivalSourceInstance: any
  std: string
  stdSpecified: boolean
  atd: string
  atdSpecified: boolean
  etd: string
  etdSpecified: boolean
  departureType: number
  departureTypeSpecified: boolean
  departureSource: string | null
  departureSourceInstance: any
  platform: string
  platformIsHidden: boolean
  serviceIsSupressed: boolean
  adhocAlerts: any
}

export interface StaffServicesResponse {
  trainServices: TrainService[] | null
  busServices: null
  ferryServices: null
  isTruncated: boolean
  generatedAt: string
  locationName: string
  crs: string
  filterLocationName: null
  filtercrs: null
  filterType: number
  stationManager: string
  stationManagerCode: string
  nrccMessages: NrccMessage[]
  platformsAreHidden: boolean
  servicesAreUnavailable: boolean
}
