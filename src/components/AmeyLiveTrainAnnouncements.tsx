import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import FullscreenIcon from 'mdi-react/FullscreenIcon'
import NREPowered from '@assets/NRE_Powered_logo.png'
import FullScreen from 'react-fullscreen-crossbrowser'
import Select from 'react-select'
import dayjs from 'dayjs'
import { makeStyles } from '@material-ui/styles'

import type { CallingAtPoint } from '@components/CallingAtSelector'
import type { Option } from '@helpers/createOptionField'
import type {
  INextTrainAnnouncementOptions,
  IDisruptedTrainAnnouncementOptions,
  default as AmeyPhil,
  ITrainApproachingAnnouncementOptions,
} from '../announcement-data/systems/stations/AmeyPhil'
import type { ICustomAnnouncementPaneProps } from './PanelPanes/CustomAnnouncementPane'

const MIN_TIME_TO_ANNOUNCE = 4

export interface LiveTrainAnnouncementsProps extends ICustomAnnouncementPaneProps<never> {
  system: AmeyPhil
  nextTrainHandler: (options: INextTrainAnnouncementOptions) => Promise<void>
  disruptedTrainHandler: (options: IDisruptedTrainAnnouncementOptions) => Promise<void>
  approachingTrainHandler: (options: ITrainApproachingAnnouncementOptions) => Promise<void>
}

interface ServicesResponse {
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

interface TrainService {
  previousLocations: any
  subsequentLocations: SubsequentLocation[]
  cancelReason: CancelReason | null
  delayReason: DelayReason | null
  category: string
  activities: string
  length: number
  isReverseFormation: boolean
  detachFront: boolean
  origin: Origin[]
  destination: Destination[]
  currentOrigins: any
  currentDestinations: any
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

interface SubsequentLocation {
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
  associations?: Association[]
  adhocAlerts: any
}

interface Association {
  category: number
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
}

interface CancelReason {
  tiploc: string
  near: boolean
  value: number
}

interface DelayReason {
  tiploc: string
  near: boolean
  value: number
}

interface Origin {
  isOperationalEndPoint: boolean
  locationName: string
  crs: string
  tiploc: string
  via: any
  futureChangeTo: number
  futureChangeToSpecified: boolean
}

interface Destination {
  isOperationalEndPoint: boolean
  locationName: string
  crs: string
  tiploc: string
  via: any
  futureChangeTo: number
  futureChangeToSpecified: boolean
}

interface NrccMessage {
  category: number
  severity: number
  xhtmlMessage: string
}

const useLiveTrainsStyles = makeStyles({
  fullscreenButton: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 16,

    '&:last-child': {
      marginBottom: 0,
    },
  },
  iframe: {
    border: 'none',
    width: '100%',
    height: 400,

    ':fullscreen &': {
      height: '100%',
    },
  },
  poweredBy: {
    maxWidth: '100%',
    width: 300,
    marginTop: 16,
  },
  logs: {
    marginTop: 16,
  },
})

type DisplayType = 'gtr-new' | 'tfwm-lcd'

const DisplayNames: Record<DisplayType, string> = {
  'gtr-new': 'Infotec DMI (yellow)',
  'tfwm-lcd': 'WMR/LNWR LCD',
}

export function LiveTrainAnnouncements({
  nextTrainHandler,
  disruptedTrainHandler,
  approachingTrainHandler,
  system,
}: LiveTrainAnnouncementsProps) {
  const classes = useLiveTrainsStyles()

  const supportedStations: Option[] = useMemo(
    () =>
      system.STATIONS.map(s => {
        const r = crsToStationItemMapper(s)

        return {
          value: r.crsCode,
          label: r.name,
        }
      }),
    [system.STATIONS],
  )

  const [displayType, setDisplayType] = useState<DisplayType>('gtr-new')
  const [isFullscreen, setFullscreen] = useState(false)
  const [selectedCrs, setSelectedCrs] = useState('ECR')
  const [hasEnabledFeature, setHasEnabledFeature] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Array of log messages using useReducer
  const [logs, addLog] = useReducer((state: string[], action: string) => [action, ...state].slice(0, 200), [])

  const approachingTrainAnnounced = useRef<Record<string, number>>({})
  const nextTrainAnnounced = useRef<Record<string, number>>({})
  const disruptedTrainAnnounced = useRef<Record<string, number>>({})

  const stationNameToCrsMap = useMemo(
    () =>
      Object.fromEntries(
        supportedStations
          .map(s => {
            if (!s.label) {
              // console.warn(`[Live Trains] Station ${s.value} has no label!`)
              return null
            }

            return [s.label.toLowerCase(), s.value]
          })
          .filter(x => x) as [string, string][],
      ),
    [supportedStations],
  )

  const removeOldIds = useCallback(
    function removeOldIds() {
      const now = Date.now()

      // Remove older than 1h
      const nextApproaching = Object.fromEntries(Object.entries(approachingTrainAnnounced.current).filter(([_, v]) => now - v < 1000 * 60 * 60))
      approachingTrainAnnounced.current = nextApproaching

      // Remove older than 1h
      const nextNew = Object.fromEntries(Object.entries(nextTrainAnnounced.current).filter(([_, v]) => now - v < 1000 * 60 * 60))
      nextTrainAnnounced.current = nextNew

      // Remove older than 10 mins
      const nextDisrupted = Object.fromEntries(Object.entries(disruptedTrainAnnounced.current).filter(([_, v]) => now - v < 1000 * 60 * 10))
      disruptedTrainAnnounced.current = nextDisrupted
    },
    [approachingTrainAnnounced, nextTrainAnnounced, disruptedTrainAnnounced],
  )

  const markApproachingTrainAnnounced = useCallback(
    function markApproachingTrainAnnounced(id: string) {
      approachingTrainAnnounced.current[id] = Date.now()
      // We don't want to announce this train again
      nextTrainAnnounced.current[id] = Date.now()
    },
    [approachingTrainAnnounced, nextTrainAnnounced],
  )

  const markNextTrainAnnounced = useCallback(
    function markNextTrainAnnounced(id: string) {
      nextTrainAnnounced.current[id] = Date.now()
    },
    [nextTrainAnnounced],
  )

  const markDisruptedTrainAnnounced = useCallback(
    function markDisruptedTrainAnnounced(id: string) {
      disruptedTrainAnnounced.current[id] = Date.now()
    },
    [disruptedTrainAnnounced],
  )

  const getPlatform = useCallback(
    function getPlatform(dataPlatform: string) {
      dataPlatform = dataPlatform.toLowerCase()

      if (system.PLATFORMS.includes(dataPlatform)) return dataPlatform

      // Fix for stations with letter-suffixed platforms
      dataPlatform = dataPlatform.replace(/[a-z]/g, '')

      if (system.PLATFORMS.includes(dataPlatform)) return dataPlatform

      return '1'
    },
    [system.PLATFORMS],
  )

  useEffect(() => {
    const key = setInterval(removeOldIds, 1000 * 60)

    return () => {
      clearInterval(key)
    }
  }, [removeOldIds])

  const calculateDelayMins = useCallback(function calculateDelayMins(std: Date, etd: Date): number {
    return Math.floor((etd.getTime() - std.getTime()) / 1000 / 60)
  }, [])

  const calculateArrivalInMins = useCallback(function calculateArrivalInMins(etd: Date): number {
    return Math.floor((etd.getTime() - new Date().getTime()) / 1000 / 60)
  }, [])

  const getStation = useCallback(
    function getStation(location: SubsequentLocation | Destination | Origin): string {
      return system.liveTrainsTiplocStationOverrides(location.tiploc) ?? location.crs!!
    },
    [system],
  )

  const guessViaPoint = useCallback(function guessViaPoint(via: string, stops: (SubsequentLocation | Destination)[]): string | null {
    if (stationNameToCrsMap[via]) return stationNameToCrsMap[via]

    // Manual entries
    switch (via) {
      case 'cobham':
        return 'CSD'

      case 'worcester':
        const stopCrs = stops.find(s => s.crs === 'WOF' || s.crs === 'WOS' || s.crs === 'WOP')
        return stopCrs?.crs ?? null

      case 'university':
        return 'UNI'
    }

    return null
  }, [])

  const announceApproachingTrain = useCallback(
    async function announceApproachingTrain(train: TrainService, abortController: AbortController) {
      console.log(train)
      addLog(`Announcing approaching train: ${train.rid} (${train.std} to ${train.destination[0].locationName})`)

      markApproachingTrainAnnounced(train.rid)

      const h = dayjs(train.std).format('HH')
      const m = dayjs(train.std).format('mm')

      const delayMins = calculateDelayMins(new Date(train.std), new Date(train.etd))

      addLog(`Train is delayed by ${delayMins} mins`)
      console.log(`[Live Trains] Train is delayed by ${delayMins} mins`)

      const toc = system.processTocForLiveTrains(train.operator, train.origin[0].crs, train.destination[0].crs)

      const vias: CallingAtPoint[] = []

      if (train.destination[0].via) {
        const v: string = train.destination[0].via.startsWith('via ') ? train.destination[0].via.slice(4) : train.destination[0].via

        v.split(/(&|and)/).forEach(via => {
          const guessViaCrs = guessViaPoint(via.trim().toLowerCase())

          addLog(`Guessed via ${guessViaCrs} for ${via}`)
          console.log(`[Live Trains] Guessed via ${guessViaCrs} for ${via}`)

          if (guessViaCrs && system.STATIONS.includes(guessViaCrs)) {
            const point = train.subsequentLocations.find(p => p.crs === guessViaCrs)

            vias.push({
              crsCode: point ? getStation(point) : guessViaCrs,
              name: '',
              randomId: '',
            })
          }
        })
      }

      const options: ITrainApproachingAnnouncementOptions = {
        chime: system.DEFAULT_CHIME,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        isDelayed: delayMins > 5,
        toc,
        platform: getPlatform(train.platform),
        terminatingStationCode: getStation(train.destination[0]),
        vias,
        originStationCode: getStation(train.origin[0]),
      }

      console.log(options)
      try {
        if (abortController.signal.aborted) {
          console.warn('[Live Trains] Aborted; skipping announcement')
          return
        }

        setIsPlaying(true)
        console.log(`[Live Trains] Playing next train announcement for ${train.rid} (${train.std} to ${train.destination[0].locationName})`)
        await approachingTrainHandler(options)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
        console.error(e)
      }
      console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 5s until next`)
      setTimeout(() => setIsPlaying(false), 5000)
    },
    [markNextTrainAnnounced, calculateDelayMins, system, setIsPlaying, approachingTrainHandler, getStation, addLog],
  )

  const announceNextTrain = useCallback(
    async function announceNextTrain(train: TrainService, abortController: AbortController) {
      console.log(train)
      addLog(`Announcing next train: ${train.rid} (${train.std} to ${train.destination[0].locationName})`)

      markNextTrainAnnounced(train.rid)

      const h = dayjs(train.std).format('HH')
      const m = dayjs(train.std).format('mm')

      const delayMins = calculateDelayMins(new Date(train.std), new Date(train.etd))

      addLog(`Train is delayed by ${delayMins} mins`)
      console.log(`[Live Trains] Train is delayed by ${delayMins} mins`)

      const toc = system.processTocForLiveTrains(train.operator, train.origin[0].crs, train.destination[0].crs)

      const callingPoints = train.subsequentLocations.filter(s => {
        if (!s.crs) return false
        if (s.isCancelled || s.isOperational || s.isPass) return false
        if (!system.STATIONS.includes(s.crs)) return false
        return true
      })

      if (train.destination[0].tiploc !== callingPoints[callingPoints.length - 1].tiploc) {
        // False destination -- need to trim calling points
        const lastRealCallingPoint = callingPoints.findIndex(s => s.tiploc == train.destination[0].tiploc)

        console.log(`Fake destination detected. Last real calling point index is ${lastRealCallingPoint}`)

        for (let i = lastRealCallingPoint; i < callingPoints.length; i++) delete callingPoints[i]
      }

      const callingAt = callingPoints
        .map((p, i, arr): CallingAtPoint | null => {
          console.log(`[${i} of ${arr.length - 1}]: ${p.crs} - ${p.tiploc}`)

          // Hide last station if it's the train destination
          if (i === arr.length - 1 && p.crs === train.destination[0].crs) return null

          return {
            crsCode: getStation(p),
            name: '',
            randomId: '',
          }
        })
        .filter(x => !!x) as CallingAtPoint[]

      const vias: CallingAtPoint[] = []

      if (train.destination[0].via) {
        const v: string = train.destination[0].via.startsWith('via ') ? train.destination[0].via.slice(4) : train.destination[0].via

        v.split(/(&|and)/).forEach(via => {
          const guessViaCrs = guessViaPoint(via.trim().toLowerCase())

          addLog(`Guessed via ${guessViaCrs} for ${via}`)
          console.log(`[Live Trains] Guessed via ${guessViaCrs} for ${via}`)

          if (guessViaCrs && system.STATIONS.includes(guessViaCrs)) {
            const point = train.subsequentLocations.find(p => p.crs === guessViaCrs)

            vias.push({
              crsCode: point ? getStation(point) : guessViaCrs,
              name: '',
              randomId: '',
            })
          }
        })
      }

      const options: INextTrainAnnouncementOptions = {
        chime: system.DEFAULT_CHIME,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        isDelayed: delayMins > 5,
        toc,
        coaches: train.length ? `${train.length} coaches` : null,
        platform: getPlatform(train.platform),
        terminatingStationCode: getStation(train.destination[0]),
        vias,
        callingAt,
      }

      console.log(options)
      try {
        if (abortController.signal.aborted) {
          console.warn('[Live Trains] Aborted; skipping announcement')
          return
        }

        setIsPlaying(true)
        console.log(`[Live Trains] Playing next train announcement for ${train.rid} (${train.std} to ${train.destination[0].locationName})`)
        await nextTrainHandler(options)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
        console.error(e)
      }
      console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 5s until next`)
      setTimeout(() => setIsPlaying(false), 5000)
    },
    [markNextTrainAnnounced, calculateDelayMins, system, setIsPlaying, nextTrainHandler, getStation, addLog],
  )

  const announceDisruptedTrain = useCallback(
    async function announceNextTrain(train: TrainService, abortController: AbortController) {
      console.log(train)

      markDisruptedTrainAnnounced(train.rid)

      const h = dayjs(train.std).format('HH')
      const m = dayjs(train.std).format('mm')

      const cancelled = train.isCancelled
      const unknownDelay = !train.etdSpecified
      const delayMins = calculateDelayMins(new Date(train.std), new Date(train.etd))

      const toc = system.processTocForLiveTrains(train.operator, train.origin[0].crs, train.destination[0].crs)

      const vias: CallingAtPoint[] = []

      if (train.destination[0].via) {
        const v: string = train.destination[0].via.startsWith('via ') ? train.destination[0].via.slice(4) : train.destination[0].via

        v.split(/(&|and)/).forEach(via => {
          const guessViaCrs = stationNameToCrsMap[via.trim().toLowerCase()]

          console.log(`[Live Trains] Guessed via ${guessViaCrs} for ${via}`)

          if (guessViaCrs) {
            vias.push({
              crsCode: guessViaCrs,
              name: '',
              randomId: '',
            })
          }
        })
      }

      let delayReason: string[] | null = null

      const reasonData = cancelled ? train.cancelReason : train.delayReason

      if (reasonData?.value) {
        const audioOptions = system.DelayCodeMapping[reasonData.value.toString()]?.e

        if (audioOptions) {
          delayReason = audioOptions.split(',')
        }
      }

      const options: IDisruptedTrainAnnouncementOptions = {
        chime: system.DEFAULT_CHIME,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        toc,
        terminatingStationCode: train.destination[0].crs,
        vias,
        delayTime: delayMins.toString(),
        disruptionType: cancelled ? 'cancel' : unknownDelay || delayMins > 59 || delayMins < 0 ? 'delay' : 'delayedBy',
        disruptionReason: delayReason ?? '',
      }

      console.log(options)
      try {
        if (abortController.signal.aborted) {
          console.warn('[Live Trains] Aborted; skipping announcement')
          return
        }

        setIsPlaying(true)
        console.log(`[Live Trains] Playing disrupted announcement for ${train.rid} (${train.std} to ${train.destination[0].locationName})`)
        await disruptedTrainHandler(options)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)

        if (delayReason) {
          // Try without
          const options2 = { ...options, disruptionReason: '' }

          try {
            console.log(
              `[Live Trains] Playing disrupted announcement (attempt 2) for ${train.rid} (${train.std} to ${train.destination[0].locationName})`,
            )
            await disruptedTrainHandler(options2)
          } catch (e) {
            console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
            console.error(e)
          }
        }

        console.error(e)
      }
      console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 5s until next`)
      setTimeout(() => setIsPlaying(false), 5000)
    },
    [markDisruptedTrainAnnounced, calculateDelayMins, system, setIsPlaying, disruptedTrainHandler, addLog],
  )

  useEffect(() => {
    if (!hasEnabledFeature) return

    const abortController = new AbortController()

    const checkAndPlay = async () => {
      if (isPlaying) {
        addLog('Still playing an announcement; skipping this check')
        console.log('[Live Trains] Still playing an announcement; skipping this check')
        return
      }

      addLog('Checking for new services')
      console.log('[Live Trains] Checking for new services')

      let services: TrainService[] | null = null

      try {
        const resp = await fetch(
          `https://national-rail-api.davwheat.dev/staffdepartures/${selectedCrs}/10?expand=true&timeOffset=0&timeWindow=30`,
        )

        if (!resp.ok) {
          addLog("Couldn't fetch data from API")
          console.warn("[Live Trains] Couldn't fetch data from API")
          return
        }

        try {
          const data: ServicesResponse = await resp.json()
          services = data.trainServices
        } catch {
          addLog("Couldn't parse JSON from API")
          console.warn("[Live Trains] Couldn't parse JSON from API")
          return
        }
      } catch (e) {
        addLog('Failed to fetch')
        console.warn('[Live Trains] Failed to fetch')
        return
      }

      if (!services) {
        addLog('No services in API response')
        console.log('[Live Trains] No services in API response')
        return
      }

      addLog(`${services.length} services found`)
      console.log(`[Live Trains] ${services.length} services found`)
      services = services.filter(s => s.isPassengerService)
      addLog(`${services.length} of which are passenger services`)
      console.log(`[Live Trains] ${services.length} of which are passenger services`)

      addLog("Finding suitable train for 'approaching train'")
      console.log("[Live Trains] Finding suitable train for 'approaching train'")

      const unannouncedApproachingTrain = services.find(s => {
        if (approachingTrainAnnounced.current[s.rid]) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it was announced recently`)
          console.log(`[Live Trains] Skipping ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it was announced recently`)
          return false
        }

        if (s.isCancelled) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it is cancelled`)
          console.log(`[Live Trains] Skipping ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it is cancelled`)
          return false
        }

        if (s.atdSpecified) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it has already departed`)
          console.log(`[Live Trains] Skipping ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it has already departed`)
          return false
        }

        if (s.platform === null) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it has no confirmed platform`)
          console.log(`[Live Trains] Skipping ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it has no confirmed platform`)
          return false
        }

        return s.ataSpecified
      })

      if (unannouncedApproachingTrain) {
        announceApproachingTrain(unannouncedApproachingTrain, abortController)
        return
      }

      addLog("Finding suitable train for 'next train'")
      console.log("[Live Trains] Finding suitable train for 'next train'")

      const unannouncedNextTrain = services.find(s => {
        const std = new Date(s.std).toLocaleString('en-GB', { hour12: false })

        if (nextTrainAnnounced.current[s.rid]) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${std} to ${s.destination[0].locationName}) as it was announced recently`)
          console.log(`[Live Trains] Skipping ${s.rid} (${std} to ${s.destination[0].locationName}) as it was announced recently`)
          return false
        }
        if (s.isCancelled) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${std} to ${s.destination[0].locationName}) as it is cancelled`)
          console.log(`[Live Trains] Skipping ${s.rid} (${std} to ${s.destination[0].locationName}) as it is cancelled`)
          return false
        }
        if (s.atdSpecified) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${std} to ${s.destination[0].locationName}) as it has already departed`)
          console.log(`[Live Trains] Skipping ${s.rid} (${std} to ${s.destination[0].locationName}) as it has already departed`)
          return false
        }
        if (!s.etdSpecified) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${std} to ${s.destination[0].locationName}) as it has no estimated time`)
          console.log(`[Live Trains] Skipping ${s.rid} (${std} to ${s.destination[0].locationName}) as it has no estimated time`)
          return false
        }
        if (s.platform === null) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${std} to ${s.destination[0].locationName}) as it has no confirmed platform`)
          console.log(`[Live Trains] Skipping ${s.rid} (${std} to ${s.destination[0].locationName}) as it has no confirmed platform`)
          return false
        }
        if (calculateArrivalInMins(new Date(s.etd)) > MIN_TIME_TO_ANNOUNCE) {
          addLog(
            `Skipping ${s.trainid} ${s.rid} (${std} to ${s.destination[0].locationName}) as it is more than ${MIN_TIME_TO_ANNOUNCE} mins away`,
          )
          console.log(
            `[Live Trains] Skipping ${s.rid} (${std} to ${s.destination[0].locationName}) as it is more than ${MIN_TIME_TO_ANNOUNCE} mins away`,
          )
          return false
        }

        return true
      })

      if (unannouncedNextTrain) {
        announceNextTrain(unannouncedNextTrain, abortController)
        return
      }

      addLog("Finding suitable train for 'disrupted train'")
      console.log("[Live Trains] Finding suitable train for 'disrupted train'")

      const unannouncedDisruptedTrain = services.find(s => {
        if (disruptedTrainAnnounced.current[s.rid]) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it was announced recently`)
          console.log(`[Live Trains] Skipping ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it was announced recently`)
          return false
        }
        if (s.atdSpecified) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it has already departed`)
          console.log(`[Live Trains] Skipping ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it has already departed`)
          return false
        }
        if (!s.isCancelled && calculateDelayMins(new Date(s.std), new Date(s.etd)) < 5 && s.etdSpecified && s.stdSpecified) {
          addLog(`Skipping ${s.trainid} ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it is not delayed`)
          console.log(`[Live Trains] Skipping ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it is not delayed`)
          return false
        }

        return true
      })

      if (unannouncedDisruptedTrain) {
        announceDisruptedTrain(unannouncedDisruptedTrain, abortController)
        return
      }

      addLog('No suitable unannounced services found')
      console.log('No suitable unannounced services found')
      addLog('--------------------------------------')
    }

    const refreshInterval = setInterval(checkAndPlay, 10000)
    checkAndPlay()

    return () => {
      console.log('Clearing interval', refreshInterval)
      clearInterval(refreshInterval)
      abortController.abort()
    }
  }, [
    hasEnabledFeature,
    nextTrainAnnounced,
    disruptedTrainAnnounced,
    markNextTrainAnnounced,
    system,
    nextTrainHandler,
    selectedCrs,
    isPlaying,
    announceNextTrain,
    addLog,
  ])

  return (
    <div>
      <label className="option-select" htmlFor="station-select">
        Station
        <Select<Option, false>
          id="station-select"
          value={{ value: selectedCrs, label: supportedStations.find(option => option.value === selectedCrs)?.label || '' }}
          onChange={val => {
            nextTrainAnnounced.current = {}
            disruptedTrainAnnounced.current = {}

            setSelectedCrs(val!!.value)
          }}
          options={supportedStations}
        />
      </label>

      <label htmlFor="display-type-select" className="option-select">
        Display type
        <Select<Option<DisplayType>, false>
          id="display-type-select"
          value={{ value: displayType, label: DisplayNames[displayType] }}
          onChange={val => setDisplayType(val!!.value)}
          options={Object.entries(DisplayNames).map(([value, label]) => ({ value: value as DisplayType, label }))}
        />
      </label>

      <p style={{ margin: '16px 0' }}>
        This is a beta feature, and isn't complete or fully functional. Please report any issues you face on GitHub.
      </p>
      <p style={{ margin: '16px 0' }}>
        This page will auto-announce all departures in the next {MIN_TIME_TO_ANNOUNCE} minutes from the selected station. Departures outside this
        timeframe will appear on the board below, but won't be announced until closer to the time.
      </p>
      <p style={{ margin: '16px 0' }}>At the moment, we also won't announce services which:</p>
      <ul className="list" style={{ margin: '16px 16px' }}>
        <li>have no platform allocated in data feeds (common at larger stations, even at the time of departure)</li>
        <li>have already been announced by the system in the last hour (only affects services which suddenly get delayed)</li>
        <li>are terminating at the selected station</li>
      </ul>
      <p>
        We also can't handle splits (we'll only announce the main portion), request stops, short platforms and several more features. As I said,
        it's a beta!
      </p>

      {!hasEnabledFeature ? (
        <>
          <button className={classes.fullscreenButton} onClick={() => setHasEnabledFeature(true)}>
            Enable live trains
          </button>
        </>
      ) : (
        <>
          <button className={classes.fullscreenButton} onClick={() => setFullscreen(true)}>
            <FullscreenIcon style={{ marginRight: 4 }} /> Fullscreen
          </button>

          <FullScreen enabled={isFullscreen} onChange={setFullscreen}>
            <iframe
              className={classes.iframe}
              src={`https://raildotmatrix.co.uk/board/?type=${encodeURIComponent(displayType)}&station=${selectedCrs}&noBg=1&hideSettings=1`}
            />
          </FullScreen>

          <Logs className={classes.logs} logs={logs} />

          <img src={NREPowered} alt="Powered by National Rail Enquiries" className={classes.poweredBy} />
        </>
      )}
    </div>
  )
}

export function Logs({ logs, className }: { logs: string[]; className?: string }) {
  return (
    <div className={className}>
      <h2>Logs</h2>

      <textarea value={logs.join('\n')} style={{ width: '100%', minHeight: 250, maxHeight: '90vh', resize: 'vertical', padding: 8 }} />
    </div>
  )
}
