import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import crsToStationItemMapper from '@helpers/crsToStationItemMapper'
import useStateWithLocalStorage from '@hooks/useStateWithLocalStorage'
import FullscreenIcon from 'mdi-react/FullscreenIcon'
import ShuffleIcon from 'mdi-react/DieMultipleIcon'
import NREPowered from '@assets/NRE_Powered_logo.png'
import FullScreen from 'react-fullscreen-crossbrowser'
import Select from 'react-select'

import {
  AssociationCategory,
  type TrainService,
  type StaffServicesResponse,
  type TimingLocation,
  type EndPointLocation,
  AssociatedServiceDetail,
} from '../../cf-workers/src/get-services'

import './AmeyLiveTrainAnnouncements.css'

import type { CallingAtPoint } from '@components/CallingAtSelector'
import type { Option } from '@helpers/createOptionField'
import type {
  INextTrainAnnouncementOptions,
  IDisruptedTrainAnnouncementOptions,
  default as AmeyPhil,
  ILiveTrainApproachingAnnouncementOptions,
  IStandingTrainAnnouncementOptions,
} from '../announcement-data/systems/stations/AmeyPhil'

import dayjs from 'dayjs'
import dayjsUtc from 'dayjs/plugin/utc'
import dayjsTz from 'dayjs/plugin/timezone'
import Breakpoints from '@data/breakpoints'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

dayjs.tz.setDefault('Europe/London')

const MIN_TIME_TO_ANNOUNCE = 4
const RDM_BASE_URL = 'https://raildotmatrix.co.uk/board'
// const RDM_BASE_URL = 'http://localhost:8788/board'
const RDM_BASE_URL_ORIGIN = new URL(RDM_BASE_URL).origin

function pluraliseStrings(...strings: string[]): string {
  if (strings.length === 1) return strings[0]

  const last = strings.pop()!!

  return `${strings.join(', ')} and ${last}`
}

function getCallingPoints(
  train: TrainService,
  stations: string[],
  getStation: (location: TimingLocation | EndPointLocation) => string,
): CallingAtPoint[] {
  const callingPoints = train.subsequentLocations.filter(s => {
    if (!s.crs) return false
    if (s.isCancelled || s.isOperational || s.isPass) return false
    if (!stations.includes(s.crs)) return false
    return true
  })

  if (train.destination[0].tiploc !== callingPoints[callingPoints.length - 1]?.tiploc) {
    // False destination -- need to trim calling points
    const lastRealCallingPoint = callingPoints.findIndex(s => s.tiploc === train.destination[0].tiploc)

    console.log(`Fake destination detected. Last real calling point index is ${lastRealCallingPoint}`)

    if (lastRealCallingPoint === -1) {
      console.log("-1 doesn't seem right, so we'll ignore it.")
    } else {
      for (let i = lastRealCallingPoint; i < callingPoints.length; i++) delete callingPoints[i]
    }
  }

  let busContinuationService: AssociatedServiceDetail | null = null

  const callingAt = callingPoints
    .map((p, i, arr): CallingAtPoint | null => {
      console.log(`[${i} of ${arr.length - 1}]: ${p.crs} - ${p.tiploc}`)

      // Hide last station if it's the train destination
      if (i === arr.length - 1 && p.crs === train.destination[0].crs) return null

      const stop: CallingAtPoint = {
        crsCode: getStation(p),
        name: '',
        randomId: '',
        requestStop: p.activities === 'R',
      }

      p.associations
        ?.filter(a => a.category === AssociationCategory.Divide)
        .forEach(a => {
          // We have a dividing service
          stop.splitType = 'splits'
          const len = a.service!!.locations[0].length
          stop.splitForm = `rear.${len}`
          stop.splitCallingPoints = a
            .service!!.locations.filter(s => {
              if (!s.crs) return false
              if (s.isCancelled || s.isOperational || s.isPass) return false
              if (!stations.includes(s.crs)) return false
              return true
            })
            .map(l => ({ crsCode: l.crs!!, name: l.locationName, randomId: '', requestStop: p.activities === 'R' }))
        })

      if (i === callingPoints.length - 1 && p.associations?.some(a => a.category === AssociationCategory.LinkedTo && a.trainid === '0B00')) {
        // Bus continuation. These are used by some TOCs for engineering work.
        const assoc = p.associations.find(a => a.category === AssociationCategory.LinkedTo && a.trainid === '0B00')

        if (assoc?.service) {
          stop.continuesAsRrbAfterHere = true
          busContinuationService = assoc.service
        }
      }

      return stop
    })
    .filter(Boolean) as CallingAtPoint[]

  if (busContinuationService) {
    let trainContinuationService: AssociatedServiceDetail | null = null

    const busCalls = (busContinuationService as AssociatedServiceDetail).locations
      .filter(p => !p.isCancelled && !p.isPass && !p.isOperational)
      .map((p, i, arr) => {
        // Hide last station if it's the train destination
        if (i === arr.length - 1 && p.crs === train.destination[0].crs) return null

        const stop: CallingAtPoint = {
          crsCode: getStation(p),
          name: '',
          randomId: '',
          requestStop: p.activities === 'R',
        }

        if (p.associations?.some(a => a.category === AssociationCategory.LinkedTo && a.trainid !== '0B00')) {
          const assoc = p.associations?.find(a => a.category === AssociationCategory.LinkedTo && a.trainid !== '0B00')

          if (assoc?.service) {
            stop.continuesAsTrainAfterHere = true
            trainContinuationService = assoc.service
          }
        }

        return stop
      })
      .filter(Boolean) as CallingAtPoint[]

    if (busCalls[0]?.crsCode === callingAt[callingAt.length - 1]?.crsCode) {
      busCalls.shift()
    }

    callingAt.push(...busCalls)

    if (trainContinuationService) {
      const trainCalls = (trainContinuationService as AssociatedServiceDetail).locations
        .filter(p => !p.isCancelled && !p.isPass && !p.isOperational)
        .map((p, i, arr) => {
          // Hide last station if it's the train destination
          if (i === arr.length - 1 && p.crs === train.destination[0].crs) return null

          return {
            crsCode: getStation(p),
            name: '',
            randomId: '',
            requestStop: p.activities === 'R',
          }
        })
        .filter(Boolean) as CallingAtPoint[]

      if (trainCalls[0]?.crsCode === callingAt[callingAt.length - 1]?.crsCode) {
        trainCalls.shift()
      }

      callingAt.push(...trainCalls)
    }
  }

  return callingAt
}

function guessViaPoint(via: string, stops: (TimingLocation | EndPointLocation)[], stationNameToCrsMap: Record<string, string>): string | null {
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
}

function getViaPoints(
  train: TrainService,
  stations: string[],
  stationNameToCrsMap: Record<string, string>,
  getStation: (location: TimingLocation | EndPointLocation) => string,
): CallingAtPoint[][] {
  const vias: CallingAtPoint[][] = []

  ;(train.currentDestinations ?? train.destination).forEach((d, i) => {
    vias[i] ||= []

    if (d.via) {
      const v: string = d.via.startsWith('via ') ? d.via.slice(4) : d.via

      v.split(/(&|and)/).forEach(via => {
        const guessViaCrs = guessViaPoint(via.trim().toLowerCase(), train.subsequentLocations, stationNameToCrsMap)

        console.log(`[Live Trains] Guessed via ${guessViaCrs} for ${via.trim()}`)

        if (guessViaCrs && stations.includes(guessViaCrs)) {
          const point = train.subsequentLocations.find(p => p.crs === guessViaCrs)

          vias[i].push({
            crsCode: point ? getStation(point) : guessViaCrs,
            name: '',
            randomId: '',
          })
        }
      })
    }
  })

  return vias
}

enum AnnouncementType {
  Next = 'next',
  Approaching = 'approaching',
  Standing = 'standing',
  Disrupted = 'disrupted',
}

export interface LiveTrainAnnouncementsProps<SystemKeys extends string> {
  systems: Record<SystemKeys, AmeyPhil>
  supportedPlatforms: Record<string, SystemKeys[]>
  nextTrainHandler: Record<SystemKeys, (options: INextTrainAnnouncementOptions) => Promise<void>>
  disruptedTrainHandler: Record<SystemKeys, (options: IDisruptedTrainAnnouncementOptions) => Promise<void>>
  approachingTrainHandler: Record<SystemKeys, (options: ILiveTrainApproachingAnnouncementOptions) => Promise<void>>
  standingTrainHandler: Record<SystemKeys, (options: IStandingTrainAnnouncementOptions) => Promise<void>>
}

type DisplayType = 'infotec-landscape-dmi' | 'blackbox-landscape-lcd'

const MindTheGapStations: Record<string, string[]> = {
  WVF: ['1', '2'],
  LWS: ['1', '2', '3', '4', '5'],
}

const DisplayNames: Record<DisplayType, string> = {
  'infotec-landscape-dmi': 'Infotec landscape DMI',
  'blackbox-landscape-lcd': 'Blackbox landscape LCD',
}

export function LiveTrainAnnouncements<SystemKeys extends string>({
  nextTrainHandler,
  disruptedTrainHandler,
  approachingTrainHandler,
  standingTrainHandler,
  systems,
  supportedPlatforms,
}: LiveTrainAnnouncementsProps<SystemKeys>) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const systemKeys = Object.keys(systems) as SystemKeys[]

  const perSystemSupportedStations: Record<string, Option[]> = useMemo(
    () =>
      Object.fromEntries(
        Object.entries<AmeyPhil>(systems).map(([key, system]) => {
          return [
            key,
            system.STATIONS.map(s => {
              const r = crsToStationItemMapper(s)

              return {
                value: r.crsCode,
                label: r.name,
              }
            }),
          ] as [string, Option[]]
        }),
      ),
    [systems],
  )

  // Ignore duplicates
  const allSupportedStations = useMemo(
    () =>
      Object.values(perSystemSupportedStations)
        .flat()
        .filter((s, i, arr) => arr.findIndex(s2 => s2.value === s.value) === i),
    [perSystemSupportedStations],
  )

  interface SetSystemForPlatformAction {
    platforms: string[]
    systemKey: SystemKeys | null
  }

  const [systemKeyForPlatform, dispatchSystemKeyForPlatform] = useReducer(
    (state: Record<string, SystemKeys | null>, action: SetSystemForPlatformAction) => {
      const { platforms, systemKey } = action

      const current = { ...state }

      platforms.forEach(p => {
        current[p] = systemKey
      })

      localStorage.setItem('amey.live-trains.system-per-platform', JSON.stringify(current))

      return current
    },
    Object.fromEntries(Object.entries(supportedPlatforms).map(([platform, systemKeys]) => [platform, systemKeys[0]] as [string, SystemKeys])),
    init => {
      if (typeof window === 'undefined') {
        return init
      }

      try {
        const stored = localStorage.getItem('amey.live-trains.system-per-platform')

        if (stored) {
          const objData = JSON.parse(stored)

          if (typeof objData === 'object') {
            Object.keys(init).forEach(k => {
              if (objData[k] && (systemKeys.includes(objData[k]) || objData[k] === null)) {
                init[k] = objData[k]
              }
            })
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        return init
      }
    },
  )

  const [displayType, setDisplayType] = useState<DisplayType>('infotec-landscape-dmi')
  const [isFullscreen, setFullscreen] = useState(false)
  const [selectedCrs, setSelectedCrs] = useState('ECR')
  const [hasEnabledFeature, setHasEnabledFeature] = useState(false)
  const [useLegacyTocNames, setUseLegacyTocNames] = useStateWithLocalStorage<boolean>('amey.live-trains.use-legacy-toc-names', false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [enabledAnnouncements, setEnabledAnnouncements] = useStateWithLocalStorage<AnnouncementType[]>('amey.live-trains.announcement-types', [
    AnnouncementType.Next,
    AnnouncementType.Approaching,
    AnnouncementType.Disrupted,
    AnnouncementType.Standing,
  ])

  // Array of log messages using useReducer
  const [logs, addLog] = useReducer((state: string[], action: string) => [action, ...state].slice(0, 200), [])

  const standingTrainAnnounced = useRef<Record<string, number>>({})
  const approachingTrainAnnounced = useRef<Record<string, number>>({})
  const nextTrainAnnounced = useRef<Record<string, number>>({})
  const disruptedTrainAnnounced = useRef<Record<string, number>>({})

  const stationNameToCrsMap = useMemo(
    () =>
      Object.fromEntries(
        Object.values(perSystemSupportedStations)
          .flat()
          .map(s => {
            if (!s.label) {
              return null
            }

            // Remove CRS from end of label
            return [s.label.toLowerCase().replace(/ \([A-Z0-9]{3}\)$/i, ''), s.value]
          })
          .filter(x => x) as [string, string][],
      ),
    [perSystemSupportedStations],
  )

  const removeOldIds = useCallback(
    function removeOldIds() {
      const now = Date.now()

      // Remove older than 1h
      const nextStanding = Object.fromEntries(Object.entries(standingTrainAnnounced.current).filter(([_, v]) => now - v < 1000 * 60 * 60))
      standingTrainAnnounced.current = nextStanding

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

  const markStandingTrainAnnounced = useCallback(
    function markStandingTrainAnnounced(id: string) {
      standingTrainAnnounced.current[id] = Date.now()
      // We don't want to announce this train again
      approachingTrainAnnounced.current[id] = Date.now()
      nextTrainAnnounced.current[id] = Date.now()
    },
    [standingTrainAnnounced, nextTrainAnnounced],
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
    function getPlatform(dataPlatform: string, systemKey: SystemKeys) {
      dataPlatform = dataPlatform.toLowerCase()

      if (systems[systemKey].PLATFORMS.includes(dataPlatform)) return dataPlatform

      // Fix for stations with letter-suffixed platforms
      dataPlatform = dataPlatform.replace(/[a-z]/g, '')

      if (systems[systemKey].PLATFORMS.includes(dataPlatform)) return dataPlatform

      return '1'
    },
    [systems],
  )

  const getPlatformForSystemSelection = useCallback(function getPlatform(dataPlatform: string) {
    dataPlatform = dataPlatform.toLowerCase()

    if (dataPlatform.match(/^[a-z]$/)) return dataPlatform

    const intVal = parseInt(dataPlatform)

    if (intVal <= 12) {
      // Fix for stations with letter-suffixed platforms
      dataPlatform = dataPlatform.replace(/[e-z]/gi, '')

      return dataPlatform
    } else {
      // Fix for stations with letter-suffixed platforms
      dataPlatform = dataPlatform.replace(/[a-z]/gi, '')

      return dataPlatform
    }
  }, [])

  useEffect(() => {
    const key = setInterval(removeOldIds, 1000 * 60)

    return () => {
      clearInterval(key)
    }
  }, [removeOldIds])

  const getStation = useCallback(
    function getStation(location: TimingLocation | EndPointLocation, systemKey: SystemKeys): string {
      return systems[systemKey].liveTrainsTiplocStationOverrides(location?.tiploc) ?? location.crs!!
    },
    [systems],
  )

  const announceStandingTrain = useCallback(
    async function announceStandingTrain(train: TrainService, abortController: AbortController, systemKey: SystemKeys) {
      console.log(train)
      addLog(`Announcing standing train: ${train.rid} (${train.std} to ${pluraliseStrings(...train.destination.map(l => l.locationName))})`)

      markStandingTrainAnnounced(train.rid)

      const h = dayjs(train.std).format('HH')
      const m = dayjs(train.std).format('mm')

      const delayMins = dayjs(train.etd).diff(dayjs(train.std), 'minutes')

      addLog(`Train is delayed by ${delayMins} mins`)
      console.log(`[Live Trains] Train is delayed by ${delayMins} mins`)

      const toc = systems[systemKey].processTocForLiveTrains(
        train.operator,
        train.operatorCode,
        train.origin[0].crs,
        train.destination[0].crs,
        useLegacyTocNames,
      )

      const callingAt = getCallingPoints(train, systems[systemKey].STATIONS, loc => getStation(loc, systemKey))
      const [vias] = getViaPoints(train, systems[systemKey].STATIONS, stationNameToCrsMap, loc => getStation(loc, systemKey))

      const mindTheGap = !!MindTheGapStations[selectedCrs]?.includes(train.platform)

      console.log(`Mind the gap: ${mindTheGap}`)

      const options: IStandingTrainAnnouncementOptions = {
        thisStationCode: selectedCrs,
        mindTheGap: mindTheGap,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        isDelayed: delayMins > 5,
        toc,
        coaches: train.length ? `${train.length} coaches` : null,
        platform: getPlatform(train.platform, systemKey),
        terminatingStationCode: getStation(train.destination[0], systemKey),
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
        console.log(
          `[Live Trains] Playing standing train announcement for ${train.rid} (${train.std} to ${pluraliseStrings(
            ...train.destination.map(l => l.locationName),
          )})`,
        )
        await standingTrainHandler[systemKey](options)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
        console.error(e)
      }
      console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 5s until next`)
      setTimeout(() => setIsPlaying(false), 5000)
    },
    [markNextTrainAnnounced, systems, setIsPlaying, standingTrainHandler, selectedCrs, getStation, addLog, useLegacyTocNames],
  )

  const announceApproachingTrain = useCallback(
    async function announceApproachingTrain(train: TrainService, abortController: AbortController, systemKey: SystemKeys) {
      console.log(train)
      addLog(`Announcing approaching train: ${train.rid} (${train.std} to ${pluraliseStrings(...train.destination.map(l => l.locationName))})`)

      markApproachingTrainAnnounced(train.rid)

      const h = dayjs(train.std).format('HH')
      const m = dayjs(train.std).format('mm')

      const delayMins = dayjs(train.etd).diff(dayjs(train.std), 'minutes')

      addLog(`Train is delayed by ${delayMins} mins`)
      console.log(`[Live Trains] Train is delayed by ${delayMins} mins`)

      const toc = systems[systemKey].processTocForLiveTrains(
        train.operator,
        train.operatorCode,
        train.origin[0].crs,
        train.destination[0].crs,
        useLegacyTocNames,
      )

      const vias = getViaPoints(train, systems[systemKey].STATIONS, stationNameToCrsMap, loc => getStation(loc, systemKey))

      const options: ILiveTrainApproachingAnnouncementOptions = {
        chime: systems[systemKey].DEFAULT_CHIME,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        isDelayed: delayMins > 5,
        toc,
        platform: getPlatform(train.platform, systemKey),
        terminatingStationCode: (train.currentDestinations ?? train.destination).map(d => getStation(d, systemKey)),
        vias: vias,
        originStationCode: getStation(train.origin[0], systemKey),
        fromLive: true,
      }

      console.log(options)
      try {
        if (abortController.signal.aborted) {
          console.warn('[Live Trains] Aborted; skipping announcement')
          return
        }

        setIsPlaying(true)
        console.log(
          `[Live Trains] Playing next train announcement for ${train.rid} (${train.std} to ${pluraliseStrings(
            ...train.destination.map(l => l.locationName),
          )})`,
        )
        await approachingTrainHandler[systemKey](options)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
        console.error(e)
      }
      console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 5s until next`)
      setTimeout(() => setIsPlaying(false), 5000)
    },
    [markNextTrainAnnounced, systems, setIsPlaying, approachingTrainHandler, getStation, addLog, useLegacyTocNames],
  )

  const announceNextTrain = useCallback(
    async function announceNextTrain(train: TrainService, abortController: AbortController, systemKey: SystemKeys) {
      console.log(train)
      addLog(`Announcing next train: ${train.rid} (${train.std} to ${pluraliseStrings(...train.destination.map(l => l.locationName))})`)

      markNextTrainAnnounced(train.rid)

      const h = dayjs(train.std).format('HH')
      const m = dayjs(train.std).format('mm')

      const delayMins = dayjs(train.etd).diff(dayjs(train.std), 'minutes')

      addLog(`Train is delayed by ${delayMins} mins`)
      console.log(`[Live Trains] Train is delayed by ${delayMins} mins`)

      const toc = systems[systemKey].processTocForLiveTrains(
        train.operator,
        train.operatorCode,
        train.origin[0].crs,
        train.destination[0].crs,
        useLegacyTocNames,
      )

      const callingAt = getCallingPoints(train, systems[systemKey].STATIONS, loc => getStation(loc, systemKey))
      const [vias] = getViaPoints(train, systems[systemKey].STATIONS, stationNameToCrsMap, loc => getStation(loc, systemKey))

      const options: INextTrainAnnouncementOptions = {
        chime: systems[systemKey].DEFAULT_CHIME,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        isDelayed: delayMins > 5,
        toc,
        coaches: train.length ? `${train.length} coaches` : null,
        platform: getPlatform(train.platform, systemKey),
        terminatingStationCode: getStation(train.destination[0], systemKey),
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
        console.log(
          `[Live Trains] Playing next train announcement for ${train.rid} (${train.std} to ${pluraliseStrings(
            ...train.destination.map(l => l.locationName),
          )})`,
        )
        await nextTrainHandler[systemKey](options)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
        console.error(e)
      }
      console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 5s until next`)
      setTimeout(() => setIsPlaying(false), 5000)
    },
    [markNextTrainAnnounced, systems, setIsPlaying, nextTrainHandler, getStation, addLog, useLegacyTocNames],
  )

  const announceDisruptedTrain = useCallback(
    async function announceNextTrain(train: TrainService, abortController: AbortController, systemKey: SystemKeys) {
      console.log(train)

      markDisruptedTrainAnnounced(train.rid)

      const h = dayjs(train.std).format('HH')
      const m = dayjs(train.std).format('mm')

      const cancelled = train.isCancelled
      const unknownDelay = !train.etdSpecified
      const delayMins = dayjs(train.etd).diff(dayjs(train.std), 'minutes')

      const toc = systems[systemKey].processTocForLiveTrains(
        train.operator,
        train.operatorCode,
        train.origin[0].crs,
        train.destination[0].crs,
        useLegacyTocNames,
      )

      const [vias] = getViaPoints(train, systems[systemKey].STATIONS, stationNameToCrsMap, loc => getStation(loc, systemKey))

      let delayReason: string[] | null = null

      const reasonData = cancelled ? train.cancelReason : train.delayReason

      if (reasonData?.value) {
        const audioOptions = systems[systemKey].DelayCodeMapping[reasonData.value.toString()]?.e

        if (audioOptions) {
          delayReason = audioOptions.split(',')
        }
      }

      const options: IDisruptedTrainAnnouncementOptions = {
        chime: systems[systemKey].DEFAULT_CHIME,
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
        console.log(
          `[Live Trains] Playing disrupted announcement for ${train.rid} (${train.std} to ${pluraliseStrings(
            ...train.destination.map(l => l.locationName),
          )})`,
        )
        await disruptedTrainHandler[systemKey](options)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)

        if (delayReason) {
          // Try without
          const options2 = { ...options, disruptionReason: '' }

          try {
            console.log(
              `[Live Trains] Playing disrupted announcement (attempt 2) for ${train.rid} (${train.std} to ${pluraliseStrings(
                ...train.destination.map(l => l.locationName),
              )})`,
            )
            await disruptedTrainHandler[systemKey](options2)
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
    [markDisruptedTrainAnnounced, systems, setIsPlaying, disruptedTrainHandler, addLog, useLegacyTocNames],
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

      if (!iframeReady) {
        addLog('Departure board iframe not ready; waiting...')
        console.log('[Live Trains] Departure board iframe not ready; waiting...')
        return
      }

      addLog('Checking for new services')
      console.log('[Live Trains] Checking for new services')

      let services: TrainService[] | null = null

      const params = new URLSearchParams()
      params.set('station', selectedCrs)
      params.set('maxServices', '10')
      params.set('timeOffset', '0')
      params.set('timeWindow', '40')

      try {
        const resp = await fetch(
          process.env.NODE_ENV === 'development'
            ? `http://localhost:8787/get-services?${params}`
            : `https://api.railannouncements.co.uk/get-services?${params}`,
        )

        if (!resp.ok) {
          addLog("Couldn't fetch data from API")
          console.warn("[Live Trains] Couldn't fetch data from API")
          return
        }

        try {
          const data: StaffServicesResponse = await resp.json()
          services = data.trainServices

          // Send data to iframe
          if (iframeReady && iframeRef.current) {
            console.log('Sending service information to iframe')
            iframeRef.current.contentWindow?.postMessage(data, RDM_BASE_URL_ORIGIN)
          }
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
      services = services.filter(
        s => s.isPassengerService && (s.platform === null || systemKeyForPlatform[getPlatformForSystemSelection(s.platform)] !== null),
      )
      addLog(`${services.length} of which are passenger services`)
      console.log(`[Live Trains] ${services.length} of which are passenger services`)

      addLog("Finding suitable train for 'standing train'")
      console.log("[Live Trains] Finding suitable train for 'standing train'")

      const unannouncedStandingTrain = !enabledAnnouncements.includes(AnnouncementType.Standing)
        ? null
        : services.find(s => {
            if (standingTrainAnnounced.current[s.rid]) {
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

            if (!s.ataSpecified || dayjs(s.ata).add(15, 'seconds').isAfter(dayjs())) {
              addLog(`Skipping ${s.trainid} ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it has not stopped yet (${s.ata} +15s)`)
              console.log(
                `[Live Trains] Skipping ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it has not stopped yet (${s.ata} +15s)`,
              )
              return false
            }

            // Wait n seconds after arrival to announce
            return true
          })

      if (unannouncedStandingTrain) {
        const systemKey = systemKeyForPlatform[getPlatformForSystemSelection(unannouncedStandingTrain.platform)]!!
        announceStandingTrain(unannouncedStandingTrain, abortController, systemKey)
        return
      }

      addLog("Finding suitable train for 'approaching train'")
      console.log("[Live Trains] Finding suitable train for 'approaching train'")

      const unannouncedApproachingTrain = !enabledAnnouncements.includes(AnnouncementType.Approaching)
        ? null
        : services.find(s => {
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
        const systemKey = systemKeyForPlatform[getPlatformForSystemSelection(unannouncedApproachingTrain.platform)]!!
        announceApproachingTrain(unannouncedApproachingTrain, abortController, systemKey)
        return
      }

      addLog("Finding suitable train for 'next train'")
      console.log("[Live Trains] Finding suitable train for 'next train'")

      const unannouncedNextTrain = !enabledAnnouncements.includes(AnnouncementType.Next)
        ? null
        : services.find(s => {
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
            if (dayjs(s.etd).diff(dayjs(), 'minutes') > MIN_TIME_TO_ANNOUNCE) {
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
        const systemKey = systemKeyForPlatform[getPlatformForSystemSelection(unannouncedNextTrain.platform)]!!
        announceNextTrain(unannouncedNextTrain, abortController, systemKey)
        return
      }

      addLog("Finding suitable train for 'disrupted train'")
      console.log("[Live Trains] Finding suitable train for 'disrupted train'")

      const unannouncedDisruptedTrain = !enabledAnnouncements.includes(AnnouncementType.Disrupted)
        ? null
        : services.find(s => {
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
            if (!s.isCancelled && dayjs(s.etd).diff(dayjs(s.std), 'minutes') < 5 && s.etdSpecified && s.stdSpecified) {
              addLog(`Skipping ${s.trainid} ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it is not delayed`)
              console.log(`[Live Trains] Skipping ${s.rid} (${s.std} to ${s.destination[0].locationName}) as it is not delayed`)
              return false
            }

            return true
          })

      if (unannouncedDisruptedTrain) {
        const systemKey = systemKeyForPlatform[getPlatformForSystemSelection(unannouncedDisruptedTrain.platform)]!!
        announceDisruptedTrain(unannouncedDisruptedTrain, abortController, systemKey)
        return
      }

      addLog('No suitable unannounced services found')
      console.log('No suitable unannounced services found')
      addLog('--------------------------------------')
    }

    const refreshInterval = setInterval(checkAndPlay, iframeReady ? 10000 : 1000)
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
    systems,
    nextTrainHandler,
    selectedCrs,
    isPlaying,
    announceNextTrain,
    addLog,
    enabledAnnouncements,
    iframeReady,
  ])

  const iframeQueryParams = new URLSearchParams({
    station: selectedCrs,
    noBg: '1',
    hideSettings: '1',
    'from-railannouncements.co.uk': '1',
  })

  if (useLegacyTocNames) {
    iframeQueryParams.append('useLegacyTocNames', '1')
  }

  Object.entries(systemKeyForPlatform)
    .filter(([_, system]) => system !== null)
    .forEach(([p]) => {
      iframeQueryParams.append('platform', p)
    })

  return (
    <div style={{ width: '100%' }}>
      <label className="option-select" htmlFor="station-select">
        Station
        <Select<Option, false>
          id="station-select"
          value={{ value: selectedCrs, label: allSupportedStations.find(option => option.value === selectedCrs)?.label || '' }}
          onChange={val => {
            nextTrainAnnounced.current = {}
            disruptedTrainAnnounced.current = {}

            setSelectedCrs(val!!.value)
          }}
          options={allSupportedStations}
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

      <label htmlFor="use-legacy-tocs">
        <input
          type="checkbox"
          name="use-legacy-tocs"
          id="use-legacy-tocs"
          checked={useLegacyTocNames}
          onChange={e => setUseLegacyTocNames(e.target.checked)}
        />
        Use legacy TOC names
      </label>

      <fieldset>
        <legend>Toggle announcement types</legend>

        <label htmlFor="announcement-types--next">
          <input
            type="checkbox"
            name="announcement-types"
            id="announcement-types--next"
            checked={enabledAnnouncements.includes(AnnouncementType.Next)}
            onChange={e => {
              if (e.target.checked) {
                setEnabledAnnouncements([...enabledAnnouncements, AnnouncementType.Next])
              } else {
                setEnabledAnnouncements(enabledAnnouncements.filter(x => x !== AnnouncementType.Next))
              }
            }}
          />
          Next train
        </label>

        <label htmlFor="announcement-types--approaching">
          <input
            type="checkbox"
            name="announcement-types"
            id="announcement-types--approaching"
            checked={enabledAnnouncements.includes(AnnouncementType.Approaching)}
            onChange={e => {
              if (e.target.checked) {
                setEnabledAnnouncements([...enabledAnnouncements, AnnouncementType.Approaching])
              } else {
                setEnabledAnnouncements(enabledAnnouncements.filter(x => x !== AnnouncementType.Approaching))
              }
            }}
          />
          Approaching train
        </label>

        <label htmlFor="announcement-types--standing">
          <input
            type="checkbox"
            name="announcement-types"
            id="announcement-types--standing"
            checked={enabledAnnouncements.includes(AnnouncementType.Standing)}
            onChange={e => {
              if (e.target.checked) {
                setEnabledAnnouncements([...enabledAnnouncements, AnnouncementType.Standing])
              } else {
                setEnabledAnnouncements(enabledAnnouncements.filter(x => x !== AnnouncementType.Standing))
              }
            }}
          />
          Standing train
        </label>

        <label htmlFor="announcement-types--disruption">
          <input
            type="checkbox"
            name="announcement-types"
            id="announcement-types--disruption"
            checked={enabledAnnouncements.includes(AnnouncementType.Disrupted)}
            onChange={e => {
              if (e.target.checked) {
                setEnabledAnnouncements([...enabledAnnouncements, AnnouncementType.Disrupted])
              } else {
                setEnabledAnnouncements(enabledAnnouncements.filter(x => x !== AnnouncementType.Disrupted))
              }
            }}
          />
          Delays and cancellations
        </label>
      </fieldset>

      <fieldset
        css={{
          padding: 0,
          width: '100%',
        }}
      >
        <div
          css={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'stretch',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {systemKeys.map(systemKey => {
            return (
              <button
                key={systemKey}
                onClick={() => {
                  const platformsSupportedBySystem = Object.entries(supportedPlatforms)
                    .filter(([_, keys]) => keys.includes(systemKey))
                    .map(([key]) => key)

                  dispatchSystemKeyForPlatform({ platforms: platformsSupportedBySystem, systemKey })
                }}
              >
                Use {systemKey} on all platforms
              </button>
            )
          })}

          <button
            key="__random"
            className="danger"
            onClick={() => {
              const platforms: Record<string, SystemKeys> = {}

              for (const [p, keys] of Object.entries(supportedPlatforms)) {
                platforms[p] = keys[Math.floor(Math.random() * keys.length)]
              }

              Object.entries(platforms).forEach(([p, systemKey]) => {
                dispatchSystemKeyForPlatform({ platforms: [p], systemKey })
              })
            }}
          >
            <span className="buttonLabel">
              <ShuffleIcon />
              Randomise (on)
            </span>
          </button>

          <button
            key="__off"
            className="danger"
            onClick={() => {
              dispatchSystemKeyForPlatform({ platforms: Object.keys(supportedPlatforms), systemKey: null })
            }}
          >
            <span className="buttonLabel">All off</span>
          </button>
        </div>

        <details
          css={{
            '&:not([open]) summary::before': {
              transform: 'rotate(-90deg)',
            },
          }}
        >
          <summary
            css={{
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              padding: '8px 16px',
              background: '#eee',
              cursor: 'pointer',

              '&::before': {
                '--size': '6px',
                content: '""',
                display: 'inline-block',
                width: 0,
                height: 0,
                borderLeft: 'var(--size) solid transparent',
                borderRight: 'var(--size) solid transparent',
                borderTop: 'calc(2 * var(--size)) solid currentColor',
                marginRight: 8,
              },
            }}
          >
            <legend
              css={{
                appearance: 'none',
                display: 'inline-block',
                padding: 0,
                margin: 0,
                float: 'left',
                fontWeight: 'bold',
              }}
            >
              Configure per-platform voices
            </legend>
          </summary>

          <p style={{ marginTop: 16 }}>We'll remember these settings on your device.</p>

          <div
            css={{
              display: 'grid',
              overflowX: 'scroll',

              [Breakpoints.downTo.desktopLarge]: {
                gridTemplateColumns: '1fr 1fr',

                '& fieldset:nth-of-type(4n - 1), & fieldset:nth-of-type(4n)': {
                  background: '#eee',
                },
              },

              [Breakpoints.upTo.desktopLarge]: {
                gridTemplateColumns: 'minmax(0, 1fr)',

                '& fieldset:nth-of-type(even)': {
                  background: '#eee',
                },
              },
            }}
          >
            {Object.entries(supportedPlatforms)
              .sort(([a], [b]) => {
                const aInt = parseInt(a)
                const bInt = parseInt(b)

                if (!isNaN(aInt) && !isNaN(bInt)) {
                  const diff = aInt - bInt

                  if (diff !== 0) return diff
                }

                return a.localeCompare(b)
              })
              .map(([platform, systems]) => {
                return (
                  <fieldset
                    css={{
                      appearance: 'none',
                      padding: 0,
                      margin: 0,
                      border: 'none',
                      minInlineSize: 'min-content',

                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      paddingLeft: 16,
                      paddingRight: 16,
                    }}
                    key={platform}
                  >
                    <legend
                      css={{
                        appearance: 'none',
                        display: 'inline-block',
                        padding: 0,
                        margin: 0,
                        float: 'left',
                        width: '150px',
                        fontWeight: 'bold',
                      }}
                    >
                      Platform {platform}
                    </legend>

                    <label
                      key={`platform-system-select-${platform}-none`}
                      htmlFor={`platform-system-select-${platform}-none`}
                      css={{
                        display: 'flex',
                        whiteSpace: 'nowrap',
                        alignItems: 'center',
                        fontWeight: 'normal',

                        '&:has([disabled])': {
                          color: '#666',

                          '&, & input': {
                            cursor: 'not-allowed',
                          },
                        },
                      }}
                    >
                      None
                      <input
                        type="radio"
                        name={`platform-system-select-${platform}`}
                        id={`platform-system-select-${platform}-none`}
                        checked={systemKeyForPlatform[platform] === null}
                        onChange={() => {
                          dispatchSystemKeyForPlatform({ platforms: [platform], systemKey: null })
                        }}
                      />
                    </label>

                    {systemKeys.map(systemKey => {
                      return (
                        <label
                          key={`platform-system-select-${platform}-${systemKey}`}
                          htmlFor={`platform-system-select-${platform}-${systemKey}`}
                        >
                          {systemKey}

                          <input
                            type="radio"
                            name={`platform-system-select-${platform}`}
                            id={`platform-system-select-${platform}-${systemKey}`}
                            disabled={!systems.includes(systemKey as any)}
                            checked={systemKeyForPlatform[platform] === systemKey}
                            onChange={() => {
                              dispatchSystemKeyForPlatform({ platforms: [platform], systemKey: systemKey })
                            }}
                          />
                        </label>
                      )
                    })}
                  </fieldset>
                )
              })}
          </div>
        </details>
      </fieldset>

      <p style={{ margin: '16px 0' }}>
        This is a beta feature, and isn't complete or fully functional. Please report any issues you face{' '}
        <a href="https://github.com/davwheat/rail-announcements/issues">on GitHub</a>.
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
        We also can't handle short platforms and some other features as this information isn't contained within the open data provided by
        National Rail.
      </p>

      {!hasEnabledFeature ? (
        <>
          <button
            css={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 0,
            }}
            onClick={() => setHasEnabledFeature(true)}
          >
            Enable live trains
          </button>
        </>
      ) : (
        <>
          <button
            css={{
              marginBottom: 16,
            }}
            onClick={() => setFullscreen(true)}
          >
            <span className="buttonLabel">
              <FullscreenIcon /> Fullscreen
            </span>
          </button>

          <FullScreen enabled={isFullscreen} onChange={setFullscreen}>
            <iframe
              ref={iframeRef}
              onLoad={() => {
                console.log('Marking iframe ready for data')
                setIframeReady(true)
              }}
              css={{
                border: 'none',
                width: '100%',
                height: 400,

                ':fullscreen &': {
                  height: '100%',
                },
              }}
              src={`${RDM_BASE_URL}/${displayType}?${iframeQueryParams}`}
            />
          </FullScreen>

          <Logs css={{ marginTop: 16 }} logs={logs} />

          <img
            src={NREPowered}
            alt="Powered by National Rail Enquiries"
            css={{
              maxWidth: '100%',
              width: 300,
              marginTop: 16,
            }}
          />
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
