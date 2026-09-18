import { connectAnnouncements } from '../live/announcements'
import { stationStream, type StationStream } from '../live/audioStreams'
import AnnouncementStreams from './AnnouncementStreams'
import { PlaybackQueue } from '../live/playbackQueue'
import { playAnnouncement, announcementPlatforms, audioPlatform } from '../live/playAnnouncement'
import { announcementName, describeAnnouncement, describeMovement } from '../live/describe'
import type { Announcement, AnnouncementType as FeedAnnouncementType } from '../live/types'
import type { ConnectionStatus } from '../live/connection'
import { useStationPlatforms } from '../live/stationPlatforms'
import {
  comparePlatforms,
  isPlatformZoneStore,
  moveToZone,
  resolveZones,
  zoneKey,
  zoneLanes,
  zonesToSave,
  type PlatformZoneStore,
} from '../live/platformZones'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
} from '../api-types/get-services-types'

import type { CallingAtPoint } from '@components/CallingAtSelector'
import type { Option } from '@helpers/createOptionField'
import type {
  INextTrainAnnouncementOptions,
  ILiveDisruptedTrainAnnouncementOptions,
  default as AmeyPhil,
  ILiveTrainApproachingAnnouncementOptions,
  IStandingTrainAnnouncementOptions,
  ChimeType,
  ServiceLoading,
} from '../announcement-data/systems/stations/AmeyPhil'
import type { MissingAudioMode } from '../announcement-data/AnnouncementSystem'

import dayjs from 'dayjs'
import dayjsUtc from 'dayjs/plugin/utc'
import dayjsTz from 'dayjs/plugin/timezone'
import Breakpoints from '@data/breakpoints'
import { isMindTheGapStation } from '@data/liveTrains/mindTheGap'
import { isShortPlatform } from '@data/liveTrains/shortPlatforms'
import NoSSR from './NoSSR'
import LoadingSpinner from './LoadingSpinner'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

dayjs.tz.setDefault('Europe/London')

const MIN_TIME_TO_ANNOUNCE = 4
const RDM_BASE_URL = 'https://raildotmatrix.co.uk/board'
// const RDM_BASE_URL = 'http://localhost:8788/board'
const LOCAL_LIVE_URL = process.env.NEXT_PUBLIC_LIVE_SERVICE_URL || 'ws://localhost:8080'
const LIVE_BOARD_URL = process.env.NEXT_PUBLIC_LIVE_BOARD_URL || 'http://localhost:8000/board'
const ANNOUNCEMENT_SERVICE_URL = process.env.NEXT_PUBLIC_ANNOUNCEMENT_SERVICE_URL || 'http://localhost:8090'
/** Without a deployed service there is nothing to stream from, so a production build only
 *  offers streamed audio once it has been told where the service is. */
const ANNOUNCEMENT_SERVICE_AVAILABLE = !!process.env.NEXT_PUBLIC_ANNOUNCEMENT_SERVICE_URL || process.env.NODE_ENV === 'development'
const RDM_BASE_URL_ORIGIN = new URL(RDM_BASE_URL).origin

function pluraliseStrings(...strings: string[]): string {
  if (strings.length === 1) return strings[0]

  const last = strings.pop()!!

  return `${strings.join(', ')} and ${last}`
}

function reverseShortPlatform(data: string | undefined | null): string | null {
  if (!data) return null

  if (data.includes('front')) {
    return data.replace('front', 'rear')
  } else if (data.includes('rear')) {
    return data.replace('rear', 'front')
  }

  return data
}

function getServiceLoadingFromFormation(formation: any): ServiceLoading {
  if (!formation) return 'none'

  let percentage: number | null = null

  // Try overall service loading first
  const overallPercentage = formation?.serviceLoading?.loadingPercentage?.Value
  if (typeof overallPercentage === 'number') {
    percentage = overallPercentage
  }

  // Fall back to averaging per-coach loading
  if (percentage === null && Array.isArray(formation?.coaches)) {
    const coachLoadings = formation.coaches.map((c: any) => c?.loading?.Value).filter((v: any) => typeof v === 'number') as number[]

    if (coachLoadings.length > 0) {
      percentage = coachLoadings.reduce((sum: number, v: number) => sum + v, 0) / coachLoadings.length
    }
  }

  if (percentage === null) return 'none'

  if (percentage > 70) return 'full and standing'
  return 'none'
}

function getCallingPoints(train: TrainService, getStation: (location: TimingLocation | EndPointLocation) => string): CallingAtPoint[] {
  const mainReversalMap: Record<string, boolean[]> = {}
  let rev = false
  train.subsequentLocations.forEach((l, i, arr) => {
    if (l.activities?.includes('RM')) rev = !rev
    mainReversalMap[l.tiploc] ||= []
    mainReversalMap[l.tiploc].push(rev)
  })

  const callingPoints = train.subsequentLocations.filter(s => {
    if (!s.crs) {
      mainReversalMap[s.tiploc].shift()
      return false
    }
    // Force the calling point if the train divides here
    if (s.associations?.filter(a => a.category === AssociationCategory.Divide).length) return true
    if (s.isCancelled || s.isOperational || s.isPass) {
      mainReversalMap[s.tiploc].shift()
      return false
    }
    // Ignore pick-up only
    if (s.activities?.includes('U')) {
      mainReversalMap[s.tiploc].shift()
      return false
    }
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

      let shortPlatform = p.crs ? isShortPlatform(p.crs, p.platform ?? null, train) || null : null
      const reversedHere = mainReversalMap[p.tiploc].shift()
      console.log(p.crs, 'reversed?', reversedHere)

      if (reversedHere) shortPlatform = reverseShortPlatform(shortPlatform)

      const stop: CallingAtPoint = {
        crsCode: getStation(p),
        name: '',
        randomId: '',
        requestStop: p.activities?.includes('R'),
        shortPlatform: shortPlatform || undefined,
      }

      p.associations
        ?.filter(a => a.category === AssociationCategory.Divide)
        .forEach(a => {
          // We have a dividing service
          stop.splitType = 'splits'
          const len = a.service!!.locations[0].length
          stop.splitForm = reversedHere ? `front.${len}` : `rear.${len}`
          stop.splitCallingPoints = a
            .service!!.locations.filter(s => {
              if (!s.crs) return false
              if (s.isCancelled || s.isOperational || s.isPass) return false
              return true
            })
            .map(l => ({ crsCode: l.crs!!, name: l.locationName, randomId: '', requestStop: p.activities?.includes('R') }))
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
          requestStop: p.activities?.includes('R'),
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
      const contReversalMap: Record<string, boolean[]> = {}
      let rev = false
      ;(trainContinuationService as AssociatedServiceDetail).locations.forEach((l, i, arr) => {
        if (l.activities?.includes('RM')) rev = !rev
        contReversalMap[l.tiploc] ||= []
        contReversalMap[l.tiploc].push(rev)
      })

      const trainCalls = (trainContinuationService as AssociatedServiceDetail).locations
        .filter(p => {
          if (p.isCancelled || p.isPass || p.isOperational) {
            contReversalMap[p.tiploc].shift()
            return false
          }
          return true
        })
        .map((p, i, arr) => {
          // Hide last station if it's the train destination
          if (i === arr.length - 1 && p.crs === train.destination[0].crs) return null

          let shortPlatform = p.crs ? isShortPlatform(p.crs, p.platform ?? null, train) || null : null
          if (contReversalMap[p.tiploc].shift()) shortPlatform = reverseShortPlatform(shortPlatform)

          return {
            crsCode: getStation(p),
            name: '',
            randomId: '',
            requestStop: p.activities?.includes('R'),
            shortPlatform,
          } as CallingAtPoint
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

function getCancelledCallingPoints(train: TrainService, getStation: (location: TimingLocation | EndPointLocation) => string): CallingAtPoint[] {
  const callingPoints = train.subsequentLocations.filter(s => {
    if (!s.crs) return false
    if (!s.isCancelled || s.isOperational || s.isPass) return false
    // Ignore pick-up only
    if (s.activities?.includes('U')) return false
    return true
  })

  let busContinuationService: AssociatedServiceDetail | null = null

  const callingAt = callingPoints
    .flatMap((p, i, arr): { crsCode: string }[] | null => {
      console.log(`[${i} of ${arr.length - 1}]: ${p.crs} - ${p.tiploc}`)

      // Hide last station if it's the train destination
      if (i === arr.length - 1 && p.crs === train.destination[0].crs) return null

      const stops = [
        {
          crsCode: getStation(p),
        },
      ]

      p.associations
        ?.filter(a => a.category === AssociationCategory.Divide)
        .forEach(a => {
          // We have a dividing service
          stops.push(
            ...a
              .service!!.locations.filter(s => {
                if (!s.crs) return false
                if (!s.isCancelled || s.isOperational || s.isPass) return false
                // Ignore pick-up only
                if (s.activities?.includes('U')) return false
                return true
              })
              .map(l => ({ crsCode: l.crs!! })),
          )
        })

      return Array.from(new Set(stops))
    })
    .filter(Boolean) as CallingAtPoint[]

  if (busContinuationService) {
    let trainContinuationService: AssociatedServiceDetail | null = null

    const busCalls = (busContinuationService as AssociatedServiceDetail).locations
      .filter(p => p.isCancelled && !p.isPass && !p.isOperational)
      .map((p, i, arr) => {
        // Ignore last station if it's the train destination
        if (i === arr.length - 1 && p.crs === train.destination[0].crs) return null

        return {
          crsCode: getStation(p),
        }
      })
      .filter(Boolean) as CallingAtPoint[]

    if (busCalls[0]?.crsCode === callingAt[callingAt.length - 1]?.crsCode) {
      busCalls.shift()
    }

    callingAt.push(...busCalls)

    if (trainContinuationService) {
      const trainCalls = (trainContinuationService as AssociatedServiceDetail).locations
        .filter(p => p.isCancelled && !p.isPass && !p.isOperational)
        .map((p, i, arr) => {
          // Hide last station if it's the train destination
          if (i === arr.length - 1 && p.crs === train.destination[0].crs) return null

          return {
            crsCode: getStation(p),
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
  Passing = 'passing',
  PlatformAlteration = 'platform_alteration',
}

export interface LiveTrainAnnouncementsProps<SystemKeys extends string> {
  systems: Record<SystemKeys, AmeyPhil>
  supportedPlatforms: Record<string, SystemKeys[]>
  nextTrainHandler: Record<SystemKeys, (options: INextTrainAnnouncementOptions) => Promise<void>>
  disruptedTrainHandler: Record<SystemKeys, (options: ILiveDisruptedTrainAnnouncementOptions) => Promise<void>>
  approachingTrainHandler: Record<SystemKeys, (options: ILiveTrainApproachingAnnouncementOptions) => Promise<void>>
  standingTrainHandler: Record<SystemKeys, (options: IStandingTrainAnnouncementOptions) => Promise<void>>
}

const DisplayTypes = ['infotec-landscape-dmi', 'daktronics-data-display-dmi', 'blackbox-landscape-lcd'] as const
type DisplayType = (typeof DisplayTypes)[number]

const DisplayNames: Record<DisplayType, string> = {
  'infotec-landscape-dmi': 'Infotec landscape DMI',
  'daktronics-data-display-dmi': 'Daktronics/Data Display DMI',
  'blackbox-landscape-lcd': 'Blackbox landscape LCD',
}

const DataSources = ['websocket', 'original'] as const
type DataSource = (typeof DataSources)[number]

const BoardLayouts = ['station', 'per-platform'] as const
type BoardLayout = (typeof BoardLayouts)[number]

const BoardLayoutNames: Record<BoardLayout, string> = {
  station: 'One board for the station',
  'per-platform': 'One board per platform',
}

/** Lines a sub-option up with the text of the checkbox it belongs to. */
const SUB_OPTION_INDENT = 'calc(1em + 8px)'

const ZONE_PREFIX = 'announcement-zone-'
const NEW_ZONE = 'new-announcement-zone'

const AudioSources = ['browser', 'service'] as const
type AudioSource = (typeof AudioSources)[number]

const AudioSourceNames: Record<AudioSource, string> = {
  browser: 'Built in this browser',
  service: 'Streamed from the announcement service',
}

const DataSourceNames: Record<DataSource, string> = {
  websocket: 'New (live updates)',
  original: 'Legacy (polling)',
}

const ChimeTypeNames: Record<ChimeType | '', string> = {
  '': 'Per-voice default',
  none: 'No chime',
  three: '3 chimes',
  four: '4 chimes',
}

const MissingAudioModeNames: Record<MissingAudioMode, string> = {
  'skip-service': 'Skip affected services',
  'play-silence': 'Play silence for missing audio',
  'repeat-last-station': 'Repeat last station name only',
  'repeat-last': 'Repeat last audio clip',
}

export function LiveTrainAnnouncements<SystemKeys extends string>({
  nextTrainHandler,
  disruptedTrainHandler,
  approachingTrainHandler,
  standingTrainHandler,
  systems,
  supportedPlatforms,
}: LiveTrainAnnouncementsProps<SystemKeys>) {
  // Per-platform layouts render a board each, so the legacy data source has to
  // reach every one of them, not just the first.
  const boardFrames = useRef(new Map<string, HTMLIFrameElement>())
  const [iframeReady, setIframeReady] = useState(false)
  const registerBoardFrame = useCallback(function registerBoardFrame(id: string, frame: HTMLIFrameElement | null) {
    if (frame) {
      boardFrames.current.set(id, frame)
    } else {
      boardFrames.current.delete(id)
    }
  }, [])
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
            }).concat(system.ADDITIONAL_STATIONS.map(s => ({ value: s.value, label: s.title }))),
          ] as [string, Option[]]
        }),
      ),
    [systems],
  )

  // Ignore duplicates
  const allSupportedStations = useMemo(
    () =>
      Object.values(perSystemSupportedStations)
        .concat(
          Object.values<AmeyPhil>(systems)
            .map(s => s.ADDITIONAL_STATIONS)
            .flat()
            .filter(o => o.value.length === 3)
            .map(o => ({ value: o.value, label: o.title })),
        )
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

  const [displayType, setDisplayType] = useStateWithLocalStorage<DisplayType>('amey.live-trains.board-type', 'infotec-landscape-dmi', val => {
    return DisplayTypes.includes(val)
  })
  const [dataSource, setDataSource] = useStateWithLocalStorage<DataSource>('amey.live-trains.data-source', 'original', value =>
    DataSources.includes(value),
  )
  const [liveServiceUrl, setLiveServiceUrl] = useStateWithLocalStorage('amey.live-trains.service-url', LOCAL_LIVE_URL)
  const [audioSource, setAudioSource] = useStateWithLocalStorage<AudioSource>('amey.live-trains.audio-source', 'browser', value =>
    AudioSources.includes(value),
  )
  const [announcementServiceUrl, setAnnouncementServiceUrl] = useStateWithLocalStorage(
    'amey.live-trains.announcement-service-url',
    ANNOUNCEMENT_SERVICE_URL,
  )
  // A saved choice of streamed audio must not outlive the service it was made for.
  const streamedAudio = ANNOUNCEMENT_SERVICE_AVAILABLE && dataSource === 'websocket' && audioSource === 'service'
  const [liveStatus, setLiveStatus] = useState<ConnectionStatus>('connecting')
  const [isFullscreen, setFullscreen] = useState(false)
  const [selectedCrs, setSelectedCrs] = useStateWithLocalStorage('amey.live-trains.selected-crs', 'ECR')
  const [chimeType, setChimeType] = useStateWithLocalStorage<ChimeType | ''>('amey.live-trains.chime-type', '', val =>
    ['', 'none', 'three', 'four'].includes(val),
  )
  const [hasEnabledFeature, setHasEnabledFeature] = useState(false)
  const [announceViaPoints, setAnnounceViaPoints] = useStateWithLocalStorage<boolean>(
    'amey.live-trains.announce-vias',
    true,
    x => x === true || x === false,
  )
  const [useLegacyTocNames, setUseLegacyTocNames] = useStateWithLocalStorage<boolean>(
    'amey.live-trains.use-legacy-toc-names',
    false,
    x => x === true || x === false,
  )
  const [showUnconfirmedPlatforms, setShowUnconfirmedPlatforms] = useStateWithLocalStorage<boolean>(
    'amey.live-trains.show-unconfirmed-platforms',
    false,
    x => x === true || x === false,
  )
  const [restrictPlatformsToStation, setRestrictPlatformsToStation] = useStateWithLocalStorage<boolean>(
    'amey.live-trains.restrict-platforms-to-station',
    true,
    x => x === true || x === false,
  )
  const [boardLayout, setBoardLayout] = useStateWithLocalStorage<BoardLayout>('amey.live-trains.board-layout', 'station', val =>
    BoardLayouts.includes(val),
  )
  const [savedZones, setSavedZones] = useStateWithLocalStorage<PlatformZoneStore>('amey.live-trains.platform-zones', {}, isPlatformZoneStore)
  const [announceShortPlatformsAfterSplit, setAnnounceShortPlatformsAfterSplit] = useStateWithLocalStorage<boolean>(
    'amey.live-trains.announce-short-platforms-after-split',
    false,
    x => x === true || x === false,
  )
  const [announcePlatformsConcurrently, setAnnouncePlatformsConcurrently] = useStateWithLocalStorage<boolean>(
    'amey.live-trains.concurrent-platforms',
    false,
    x => x === true || x === false,
  )
  const [announceFastTrainApproaching, setAnnounceFastTrainApproaching] = useStateWithLocalStorage<boolean>(
    'amey.live-trains.fast-train-approaching',
    true,
    x => x === true || x === false,
  )
  const [missingAudioMode, setMissingAudioMode] = useStateWithLocalStorage<MissingAudioMode>(
    'amey.live-trains.missing-audio-mode',
    'skip-service',
    (x): x is MissingAudioMode => ['skip-service', 'play-silence', 'repeat-last-station', 'repeat-last'].includes(x as string),
  )
  const [isPlaying, _setIsPlaying] = useState(false)
  const setIsPlaying = useCallback(
    function setIsPlaying(val: boolean) {
      console.log(`Setting isPlaying to ${val}`)

      _setIsPlaying(val)
    },
    [_setIsPlaying],
  )
  const setIsPlayingAfter = useCallback(
    function setIsPlayingAfter(val: boolean, timeout: number) {
      console.log(`Setting isPlaying to ${val} after ${timeout}ms`)

      setTimeout(() => {
        setIsPlaying(val)
      }, timeout)
    },
    [setIsPlaying],
  )

  const [enabledAnnouncements, setEnabledAnnouncements] = useStateWithLocalStorage<AnnouncementType[]>('amey.live-trains.announcement-types', [
    AnnouncementType.Next,
    AnnouncementType.Approaching,
    AnnouncementType.Disrupted,
    AnnouncementType.Standing,
    AnnouncementType.Passing,
    AnnouncementType.PlatformAlteration,
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

  const stationPlatforms = useStationPlatforms(liveServiceUrl, selectedCrs)

  /** The station's SMART platforms, as keys into `supportedPlatforms`. Null when SMART
   *  says nothing about this station, which must narrow nothing. */
  const stationPlatformKeys = useMemo(
    function stationPlatformKeys() {
      if (stationPlatforms.status !== 'ready') return null

      const keys = new Set(stationPlatforms.platforms.map(getPlatformForSystemSelection))
      const known = Object.keys(supportedPlatforms).filter(platform => keys.has(platform))

      // A station whose platforms no voice covers would otherwise leave an empty
      // list and no way back to it.
      return known.length > 0 ? new Set(known) : null
    },
    [stationPlatforms, supportedPlatforms, getPlatformForSystemSelection],
  )

  const filteringPlatforms = restrictPlatformsToStation && stationPlatformKeys !== null

  /** Platforms offered for a voice, in station order. */
  const visiblePlatforms = useMemo(
    function visiblePlatforms() {
      return Object.entries(supportedPlatforms)
        .filter(([platform]) => !filteringPlatforms || stationPlatformKeys!.has(platform))
        .sort(([a], [b]) => comparePlatforms(a, b))
    },
    [supportedPlatforms, filteringPlatforms, stationPlatformKeys],
  )

  const perPlatformBoards = boardLayout === 'per-platform' && stationPlatforms.status === 'ready'

  /** Zones group the station's own platforms, never the generic list: a zone is a physical
   *  part of a station, so without the station's platforms there is nothing to group. */
  const zonePlatforms = useMemo(
    function zonePlatforms() {
      if (stationPlatformKeys === null) return []

      return Object.keys(supportedPlatforms)
        .filter(platform => stationPlatformKeys.has(platform))
        .sort(comparePlatforms)
    },
    [supportedPlatforms, stationPlatformKeys],
  )

  const zones = useMemo(() => resolveZones(savedZones[selectedCrs], zonePlatforms), [savedZones, selectedCrs, zonePlatforms])

  const saveZones = useCallback(
    function saveZones(next: string[][]) {
      setSavedZones(current => ({ ...current, [selectedCrs]: zonesToSave(next) }))
    },
    [setSavedZones, selectedCrs],
  )

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

      const h = dayjs.tz(train.std).format('HH')
      const m = dayjs.tz(train.std).format('mm')

      const delayMins = dayjs.tz(train.etd).diff(dayjs.tz(train.std), 'minutes')

      addLog(`Train is delayed by ${delayMins} mins`)
      console.log(`[Live Trains] Train is delayed by ${delayMins} mins`)

      const toc = systems[systemKey].processTocForLiveTrains(
        train.operator,
        train.operatorCode,
        train.origin[0].crs,
        train.destination[0].crs,
        useLegacyTocNames,
        train.uid,
      )

      const callingAt = getCallingPoints(train, loc => getStation(loc, systemKey))
      const [vias] = announceViaPoints
        ? getViaPoints(train, systems[systemKey].STATIONS, stationNameToCrsMap, loc => getStation(loc, systemKey))
        : [[]]

      const mindTheGap = isMindTheGapStation(selectedCrs, train.platform)

      console.log(`Mind the gap: ${mindTheGap}`)

      const options: IStandingTrainAnnouncementOptions = {
        fromLive: true,
        missingAudioMode,
        thisStationCode: selectedCrs,
        mindTheGap: mindTheGap,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        isDelayed: delayMins > 5,
        toc,
        coaches: train.length ? `${train.length} coaches` : 'None',
        serviceLoading: getServiceLoadingFromFormation(train.formation),
        platform: getPlatform(train.platform, systemKey),
        terminatingStationCode: getStation(train.destination[0], systemKey),
        vias,
        callingAt,
        firstClassLocation: 'none',
        announceShortPlatformsAfterSplit,
        notCallingAtStations: getCancelledCallingPoints(train, loc => getStation(loc, systemKey)),
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
        console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 3s until next`)
        setIsPlayingAfter(false, 3000)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
        console.error(e)
        setIsPlaying(false)
      }
    },
    [
      markNextTrainAnnounced,
      systems,
      setIsPlaying,
      standingTrainHandler,
      selectedCrs,
      getStation,
      addLog,
      useLegacyTocNames,
      announceViaPoints,
      setIsPlayingAfter,
      announceShortPlatformsAfterSplit,
      missingAudioMode,
    ],
  )

  const announceApproachingTrain = useCallback(
    async function announceApproachingTrain(train: TrainService, abortController: AbortController, systemKey: SystemKeys) {
      console.log(train)
      addLog(`Announcing approaching train: ${train.rid} (${train.std} to ${pluraliseStrings(...train.destination.map(l => l.locationName))})`)

      markApproachingTrainAnnounced(train.rid)

      const h = dayjs.tz(train.std).format('HH')
      const m = dayjs.tz(train.std).format('mm')

      const delayMins = dayjs.tz(train.etd).diff(dayjs.tz(train.std), 'minutes')

      addLog(`Train is delayed by ${delayMins} mins`)
      console.log(`[Live Trains] Train is delayed by ${delayMins} mins`)

      const toc = systems[systemKey].processTocForLiveTrains(
        train.operator,
        train.operatorCode,
        train.origin[0].crs,
        train.destination[0].crs,
        useLegacyTocNames,
        train.uid,
      )

      const vias = announceViaPoints
        ? getViaPoints(train, systems[systemKey].STATIONS, stationNameToCrsMap, loc => getStation(loc, systemKey))
        : [[]]

      const options: ILiveTrainApproachingAnnouncementOptions = {
        chime: chimeType || systems[systemKey].DEFAULT_CHIME,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        isDelayed: delayMins > 5,
        toc,
        platform: getPlatform(train.platform, systemKey),
        terminatingStationCode: (train.currentDestinations ?? train.destination).map(d => getStation(d, systemKey)),
        vias: vias,
        originStationCode: (train.currentOrigins ?? train.origin).map(o => getStation(o, systemKey)),
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
        console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 3s until next`)
        setIsPlayingAfter(false, 3000)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
        console.error(e)
        setIsPlaying(false)
      }
    },
    [
      markNextTrainAnnounced,
      systems,
      setIsPlaying,
      approachingTrainHandler,
      getStation,
      addLog,
      useLegacyTocNames,
      chimeType,
      announceViaPoints,
      setIsPlayingAfter,
    ],
  )

  const announceNextTrain = useCallback(
    async function announceNextTrain(train: TrainService, abortController: AbortController, systemKey: SystemKeys) {
      console.log(train)
      addLog(`Announcing next train: ${train.rid} (${train.std} to ${pluraliseStrings(...train.destination.map(l => l.locationName))})`)

      markNextTrainAnnounced(train.rid)

      const h = dayjs.tz(train.std).format('HH')
      const m = dayjs.tz(train.std).format('mm')

      const delayMins = dayjs.tz(train.etd).diff(dayjs.tz(train.std), 'minutes')

      addLog(`Train is delayed by ${delayMins} mins`)
      console.log(`[Live Trains] Train is delayed by ${delayMins} mins`)

      const toc = systems[systemKey].processTocForLiveTrains(
        train.operator,
        train.operatorCode,
        train.origin[0].crs,
        train.destination[0].crs,
        useLegacyTocNames,
        train.uid,
      )

      const callingAt = getCallingPoints(train, loc => getStation(loc, systemKey))
      const [vias] = announceViaPoints
        ? getViaPoints(train, systems[systemKey].STATIONS, stationNameToCrsMap, loc => getStation(loc, systemKey))
        : [[]]

      const options: INextTrainAnnouncementOptions = {
        fromLive: true,
        missingAudioMode,
        chime: chimeType || systems[systemKey].DEFAULT_CHIME,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        isDelayed: delayMins > 5,
        toc,
        coaches: train.length ? `${train.length} coaches` : 'None',
        serviceLoading: getServiceLoadingFromFormation(train.formation),
        platform: getPlatform(train.platform, systemKey),
        terminatingStationCode: getStation(train.destination[0], systemKey),
        vias,
        callingAt,
        firstClassLocation: 'none',
        announceShortPlatformsAfterSplit,
        notCallingAtStations: getCancelledCallingPoints(train, loc => getStation(loc, systemKey)),
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
        console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 3s until next`)
        setIsPlayingAfter(false, 3000)
      } catch (e) {
        console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
        console.error(e)
        setIsPlaying(false)
      }
    },
    [
      markNextTrainAnnounced,
      systems,
      setIsPlaying,
      nextTrainHandler,
      getStation,
      addLog,
      useLegacyTocNames,
      chimeType,
      announceViaPoints,
      setIsPlayingAfter,
      announceShortPlatformsAfterSplit,
      missingAudioMode,
    ],
  )

  const announceDisruptedTrain = useCallback(
    async function announceNextTrain(train: TrainService, abortController: AbortController, systemKey: SystemKeys) {
      console.log(train)

      markDisruptedTrainAnnounced(train.rid)

      const h = dayjs.tz(train.std).format('HH')
      const m = dayjs.tz(train.std).format('mm')

      const cancelled = train.isCancelled
      const unknownDelay = !train.etdSpecified
      const delayMins = dayjs.tz(train.etd).diff(dayjs.tz(train.std), 'minutes')

      const toc = systems[systemKey].processTocForLiveTrains(
        train.operator,
        train.operatorCode,
        train.origin[0].crs,
        train.destination[0].crs,
        useLegacyTocNames,
        train.uid,
      )

      const vias = announceViaPoints
        ? getViaPoints(train, systems[systemKey].STATIONS, stationNameToCrsMap, loc => getStation(loc, systemKey))
        : [[]]

      let delayReason: string[] | null = null

      const reasonData = cancelled ? train.cancelReason : train.delayReason

      if (reasonData?.value) {
        const audioOptions = systems[systemKey].DelayCodeMapping[reasonData.value.toString()]?.e

        if (audioOptions) {
          delayReason = Array.isArray(audioOptions) ? audioOptions : [audioOptions]
        }
      }

      const options: ILiveDisruptedTrainAnnouncementOptions = {
        fromLive: true,
        missingAudioMode,
        chime: chimeType || systems[systemKey].DEFAULT_CHIME,
        hour: h === '00' ? '00 - midnight' : h,
        min: m === '00' ? '00 - hundred-hours' : m,
        toc,
        terminatingStationCode: (train.currentDestinations ?? train.destination).map(d => getStation(d, systemKey)),
        vias,
        delayTime: delayMins.toString(),
        disruptionType: cancelled ? 'cancel' : unknownDelay || delayMins < 0 ? 'delay' : 'delayedBy',
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
        console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 3s until next`)
        setIsPlayingAfter(false, 3000)
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
            console.log(`[Live Trains] Announcement for ${train.rid} complete: waiting 3s until next`)
            setIsPlayingAfter(false, 3000)
          } catch (e) {
            console.warn(`[Live Trains] Error playing announcement for ${train.rid}; see below`)
            console.error(e)
            setIsPlaying(false)
          }
        } else {
          console.error(e)
          setIsPlaying(false)
        }
      }
    },
    [
      markDisruptedTrainAnnounced,
      systems,
      setIsPlaying,
      disruptedTrainHandler,
      addLog,
      useLegacyTocNames,
      chimeType,
      announceViaPoints,
      setIsPlayingAfter,
      missingAudioMode,
    ],
  )

  useEffect(() => {
    if (!hasEnabledFeature || dataSource !== 'original') return

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
        const resp = await fetch(`/api/get-services?${params}`, { signal: abortController.signal })

        if (!resp.ok) {
          addLog("Couldn't fetch data from API")
          console.warn("[Live Trains] Couldn't fetch data from API")
          return
        }

        try {
          const data: StaffServicesResponse = await resp.json()
          if (abortController.signal.aborted) return
          services = data.trainServices

          // Send data to every board on the page
          if (iframeReady) {
            console.log(`Sending service information to ${boardFrames.current.size} board(s)`)
            boardFrames.current.forEach(frame => frame.contentWindow?.postMessage(data, RDM_BASE_URL_ORIGIN))
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
        s => s.isPassengerService && (!s.platform || systemKeyForPlatform[getPlatformForSystemSelection(s.platform)] !== null),
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

            if (!s.ataSpecified || dayjs.tz(s.ata, 'Europe/London').add(15, 'seconds').isAfter(dayjs.tz())) {
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

            if (!s.platform) {
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
            if (!s.platform) {
              addLog(`Skipping ${s.trainid} ${s.rid} (${std} to ${s.destination[0].locationName}) as it has no confirmed platform`)
              console.log(`[Live Trains] Skipping ${s.rid} (${std} to ${s.destination[0].locationName}) as it has no confirmed platform`)
              return false
            }

            if (dayjs.tz(s.etd, 'Europe/London').diff(dayjs.tz(), 'minutes') > MIN_TIME_TO_ANNOUNCE) {
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
            if (!s.isCancelled && dayjs.tz(s.etd, 'Europe/London').diff(dayjs.tz(s.std), 'minutes') < 5 && s.etdSpecified && s.stdSpecified) {
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

    const refreshInterval = setInterval(checkAndPlay, iframeReady ? 40_000 : 1000)
    checkAndPlay()

    return () => {
      console.log('Clearing interval', refreshInterval)
      clearInterval(refreshInterval)
      abortController.abort()
    }
  }, [
    hasEnabledFeature,
    dataSource,
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

  const legacyPlaying = useRef(isPlaying)
  legacyPlaying.current = isPlaying
  const concurrentPlatforms = useRef(announcePlatformsConcurrently)
  concurrentPlatforms.current = announcePlatformsConcurrently
  // Read through a ref like the flag above: re-zoning the station must not tear down the
  // queue that is part way through announcing a train.
  const lanes = useRef(zoneLanes(zones))
  lanes.current = zoneLanes(zones)
  const playFeedMessage = useRef<(announcement: Announcement, signal: AbortSignal, valid: () => boolean) => Promise<void>>(async () => {})
  playFeedMessage.current = async (announcement, signal, valid) => {
    // Let an already playing legacy announcement finish when the source changes.
    if (legacyPlaying.current && valid()) {
      addLog(`Waiting for the previous announcement to finish before: ${describeAnnouncement(announcement)}`)
      while (legacyPlaying.current && valid()) await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!valid() || dataSource !== 'websocket') return
    if (!enabledAnnouncements.includes(announcement.announcement_type as AnnouncementType)) {
      addLog(`Skipping the ${describeAnnouncement(announcement)}: that type is switched off`)
      return
    }
    if (announcement.audio) {
      // Rendered once for every platform it names, in the service's voice rather than a platform's.
      addLog(`Playing the service's own audio for the ${describeAnnouncement(announcement)}`)
      await Object.values<AmeyPhil>(systems)[0].withLivePlayback(signal, valid).playRenderedAudio(announcement.audio.data)
      return
    }
    for (const platform of announcementPlatforms(announcement)) {
      if (!valid()) return
      const train = describeMovement(announcement.details)
      const type = announcementName(announcement.announcement_type)
      if (!platform) {
        addLog(`Skipping the ${type} for ${train}: no platform has been allocated`)
        continue
      }
      const systemKey = systemKeyForPlatform[getPlatformForSystemSelection(platform)]
      if (!systemKey) {
        addLog(`Skipping the ${type} for ${train}: platform ${platform} has no voice selected`)
        continue
      }
      const system = systems[systemKey]
      const spokenPlatform = audioPlatform(platform, system)
      if (spokenPlatform === null) {
        addLog(`Skipping the ${type} for ${train}: ${systemKey} has no audio for platform ${platform}`)
        continue
      }
      addLog(`Announcing the ${type} for ${train} on platform ${platform} in ${systemKey}`)
      await playAnnouncement(
        announcement,
        system.withLivePlayback(signal, valid),
        {
          chime: chimeType,
          useLegacyTocNames,
          announceViaPoints,
          announceShortPlatformsAfterSplit,
          fastTrainApproaching: announceFastTrainApproaching,
          daktronicsFanfare: displayType === 'daktronics-data-display-dmi',
          missingAudioMode,
        },
        spokenPlatform,
        addLog,
      )
    }
  }

  // Keep one queue across effect restarts so a source/station change cannot
  // overlap an announcement that is still finishing its audio download.
  const playbackQueue = useRef<PlaybackQueue | null>(null)
  if (!playbackQueue.current) {
    playbackQueue.current = new PlaybackQueue(
      (announcement, signal, valid) => playFeedMessage.current(announcement, signal, valid),
      Date.now,
      error => addLog(`Announcement skipped: ${error instanceof Error ? error.message : String(error)}`),
      announcement => {
        if (!concurrentPlatforms.current) return ['']

        // A platformless announcement holds the whole station, and one warning naming two
        // platforms of the same zone holds that zone once.
        const occupied = announcementPlatforms(announcement).map(platform => {
          if (!platform) return ''

          const key = getPlatformForSystemSelection(platform)

          return lanes.current.get(key) ?? key
        })

        return [...new Set(occupied)]
      },
      addLog,
    )
  }
  const feedTypes = enabledAnnouncements.join(',')
  useEffect(() => {
    // The announcement service listens to the feed itself when it is the one speaking.
    if (!hasEnabledFeature || dataSource !== 'websocket' || streamedAudio) return
    const queue = playbackQueue.current!
    try {
      return connectAnnouncements(
        liveServiceUrl,
        selectedCrs,
        feedTypes.split(',').filter(Boolean) as FeedAnnouncementType[],
        queue,
        setLiveStatus,
        addLog,
      )
    } catch (error) {
      queue.reset()
      setLiveStatus('reconnecting')
      addLog(`Cannot connect to the live service: ${String(error)}`)
    }
    return () => queue.reset()
    // Per-platform voices are read at play time, so changing one must not disturb the feed.
  }, [hasEnabledFeature, dataSource, streamedAudio, liveServiceUrl, selectedCrs, feedTypes])

  const announcementStream = useMemo<StationStream | null | string>(() => {
    if (!hasEnabledFeature || !streamedAudio) return null
    try {
      return stationStream(
        announcementServiceUrl,
        selectedCrs,
        announcePlatformsConcurrently ? zones : null,
        Object.fromEntries(Object.entries(systemKeyForPlatform).map(([platform, key]) => [platform, key ? systems[key].ID : null])),
        feedTypes.split(',').filter(Boolean) as FeedAnnouncementType[],
        {
          chime: chimeType,
          useLegacyTocNames,
          announceViaPoints,
          announceShortPlatformsAfterSplit,
          fastTrainApproaching: announceFastTrainApproaching,
          daktronicsFanfare: displayType === 'daktronics-data-display-dmi',
          missingAudioMode,
        },
      )
    } catch (error) {
      return `Cannot use the announcement service: ${error instanceof Error ? error.message : String(error)}`
    }
  }, [
    hasEnabledFeature,
    streamedAudio,
    announcementServiceUrl,
    selectedCrs,
    announcePlatformsConcurrently,
    zones,
    systemKeyForPlatform,
    systems,
    feedTypes,
    chimeType,
    useLegacyTocNames,
    announceViaPoints,
    announceShortPlatformsAfterSplit,
    announceFastTrainApproaching,
    displayType,
    missingAudioMode,
  ])

  /** Builds one board's URL. `platform` gives that platform its own board; without it the
   *  board covers the station, showing the platforms that have a voice. */
  function boardUrl(platform?: string): string {
    const params = new URLSearchParams({
      station: selectedCrs,
      dataSource,
      ...(dataSource === 'websocket' ? { liveServiceUrl } : {}),
      noBg: '1',
      hideSettings: '1',
      'from-railannouncements.co.uk': '1',
    })

    if (useLegacyTocNames) {
      params.append('useLegacyTocNames', '1')
    }

    if (showUnconfirmedPlatforms) {
      params.append('showUnconfirmedPlatforms', '1')
    }

    if (platform !== undefined) {
      params.append('platform', platform)
    } else {
      if (Object.values(systemKeyForPlatform).every(system => system === null)) params.append('platform', '__none__')

      Object.entries(systemKeyForPlatform)
        .filter(([_, system]) => system !== null)
        .forEach(([p]) => {
          params.append('platform', p)
        })
    }

    return `${dataSource === 'websocket' ? LIVE_BOARD_URL : RDM_BASE_URL}/${displayType}?${params}`
  }

  return (
    <div css={{ width: '100%' }}>
      <NoSSR
        fallback={
          <div css={{ margin: 'auto', textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>
            <LoadingSpinner />

            <p css={{ marginTop: 24 }}>Loading live trains settings&hellip;</p>
          </div>
        }
      >
        <label className="option-select" htmlFor="data-source-select">
          Train data source
          <Select<Option<DataSource>, false>
            id="data-source-select"
            value={{ value: dataSource, label: DataSourceNames[dataSource] }}
            onChange={val => setDataSource(val!!.value)}
            options={DataSources.map(value => ({ value, label: DataSourceNames[value] }))}
          />
        </label>
        {dataSource === 'websocket' && process.env.NODE_ENV === 'development' && (
          <label htmlFor="live-service-url">
            Service URL
            <input
              id="live-service-url"
              key={liveServiceUrl}
              defaultValue={liveServiceUrl}
              onBlur={event => setLiveServiceUrl(event.target.value.trim())}
            />
          </label>
        )}
        {dataSource === 'websocket' && ANNOUNCEMENT_SERVICE_AVAILABLE && (
          <label className="option-select" htmlFor="audio-source-select">
            Announcement audio
            <Select<Option<AudioSource>, false>
              id="audio-source-select"
              value={{ value: audioSource, label: AudioSourceNames[audioSource] }}
              onChange={val => setAudioSource(val!!.value)}
              options={AudioSources.map(value => ({ value, label: AudioSourceNames[value] }))}
            />
          </label>
        )}
        {streamedAudio && process.env.NODE_ENV === 'development' && (
          <label htmlFor="announcement-service-url">
            Announcement service URL
            <input
              id="announcement-service-url"
              key={announcementServiceUrl}
              defaultValue={announcementServiceUrl}
              onBlur={event => setAnnouncementServiceUrl(event.target.value.trim())}
            />
          </label>
        )}
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

        <label htmlFor="board-layout-select" className="option-select">
          Board layout
          <Select<Option<BoardLayout>, false>
            id="board-layout-select"
            aria-describedby={stationPlatforms.status === 'unavailable' ? 'help-board-layout' : undefined}
            value={{ value: boardLayout, label: BoardLayoutNames[boardLayout] }}
            onChange={val => setBoardLayout(val!!.value)}
            options={Object.entries(BoardLayoutNames).map(([value, label]) => ({ value: value as BoardLayout, label }))}
            isOptionDisabled={option => option.value === 'per-platform' && stationPlatforms.status !== 'ready'}
          />
        </label>
        {stationPlatforms.status === 'unavailable' && (
          <p className="helpText" id="help-board-layout">
            We don't know which platforms this station has, so we can't show a board for each one.
          </p>
        )}

        <label htmlFor="use-legacy-tocs">
          <input
            type="checkbox"
            name="use-legacy-tocs"
            id="use-legacy-tocs"
            checked={useLegacyTocNames}
            onChange={e => setUseLegacyTocNames(e.target.checked)}
          />
          Use old TOC names?
        </label>

        <label htmlFor="announce-vias">
          <input
            type="checkbox"
            name="announce-vias"
            id="announce-vias"
            checked={announceViaPoints}
            onChange={e => setAnnounceViaPoints(e.target.checked)}
          />
          Announce via points?
        </label>

        <label htmlFor="announce-short-platforms-after-split">
          <input
            type="checkbox"
            name="announce-short-platforms-after-split"
            id="announce-short-platforms-after-split"
            checked={announceShortPlatformsAfterSplit}
            onChange={e => setAnnounceShortPlatformsAfterSplit(e.target.checked)}
          />
          Announce short platforms after split?
        </label>

        {dataSource === 'websocket' && (
          <label htmlFor="concurrent-platforms">
            <input
              type="checkbox"
              name="concurrent-platforms"
              id="concurrent-platforms"
              checked={announcePlatformsConcurrently}
              onChange={e => setAnnouncePlatformsConcurrently(e.target.checked)}
            />
            Announce different platforms at the same time?
          </label>
        )}

        {dataSource === 'websocket' && announcePlatformsConcurrently && (
          <fieldset
            css={{
              border: 'none',
              minWidth: 0,
              marginLeft: SUB_OPTION_INDENT,
              marginTop: 16,
              marginBottom: 24,
              padding: 16,
              background: '#eee',
            }}
          >
            <legend css={{ float: 'left', width: '100%', padding: 0, marginBottom: 8, fontWeight: 'bold' }}>Announcement zones</legend>

            {zonePlatforms.length === 0 ? (
              <p className="helpText">We don't know which platforms this station has, so each one announces on its own.</p>
            ) : (
              <>
                <p className="helpText">
                  Platforms in the same zone take turns. Separate zones announce at the same time. Drag a platform onto another to put them in
                  one zone.
                </p>

                <DragDropContext
                  onDragEnd={result => {
                    if (!result.destination) return

                    const { droppableId, index } = result.destination
                    // Zones are named by their lowest platform, so a drop resolves to a zone
                    // rather than to a row that a previous drop may have shifted.
                    const target =
                      droppableId === NEW_ZONE ? null : zones.findIndex(zone => zoneKey(zone) === droppableId.slice(ZONE_PREFIX.length))

                    saveZones(moveToZone(zones, result.draggableId, target, index))
                  }}
                >
                  <div css={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 8, marginTop: 8 }}>
                    {zones.map(zone => (
                      <Droppable droppableId={`${ZONE_PREFIX}${zoneKey(zone)}`} direction="horizontal" key={zoneKey(zone)}>
                        {provided => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            css={{
                              display: 'flex',
                              alignItems: 'center',
                              // Spacing lives on the chips, never here: a Droppable shifts its
                              // children by their margins while dragging and cannot see a gap,
                              // so a gap would be missing from the preview and appear on drop.
                              padding: '8px 0 8px 8px',
                              border: '2px solid #000',
                              background: '#fff',
                            }}
                          >
                            {zone.map((platform, position) => (
                              <Draggable draggableId={platform} index={position} key={platform}>
                                {provided => (
                                  <span
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    aria-label={`Platform ${platform}`}
                                    css={{
                                      display: 'inline-block',
                                      padding: '4px 12px',
                                      // The gap between chips, and the row's right padding.
                                      marginRight: 8,
                                      border: '1px solid #000',
                                      background: '#eee',
                                      cursor: 'grab',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {platform}
                                  </span>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    ))}

                    <Droppable droppableId={NEW_ZONE} direction="horizontal">
                      {provided => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          css={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 0 8px 8px',
                            minWidth: 180,
                            border: '2px dashed #666',
                            color: '#666',
                          }}
                        >
                          <span css={{ marginRight: 8 }}>Drop here for a zone of its own</span>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </DragDropContext>

                {zones.some(zone => zone.length > 1) && (
                  <button className="danger" css={{ marginTop: 16 }} onClick={() => saveZones([])}>
                    <span className="buttonLabel">Give every platform its own zone</span>
                  </button>
                )}
              </>
            )}
          </fieldset>
        )}

        <label htmlFor="chime-type-select" className="option-select">
          Chime
          <Select<Option<ChimeType | ''>, false>
            id="chime-type-select"
            value={{ value: chimeType, label: ChimeTypeNames[chimeType] }}
            onChange={val => setChimeType(val!.value!!)}
            options={Object.entries(ChimeTypeNames).map(([k, v]) => ({ value: k as ChimeType | '', label: v }))}
          />
        </label>

        <label htmlFor="missing-audio-mode-select" className="option-select">
          Missing audio
          <Select<Option<MissingAudioMode>, false>
            id="missing-audio-mode-select"
            value={{ value: missingAudioMode, label: MissingAudioModeNames[missingAudioMode] }}
            onChange={val => setMissingAudioMode(val!.value)}
            options={Object.entries(MissingAudioModeNames).map(([k, v]) => ({ value: k as MissingAudioMode, label: v }))}
          />
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
          {dataSource === 'websocket' &&
            [
              [AnnouncementType.Passing, 'Passing train warnings'],
              [AnnouncementType.PlatformAlteration, 'Platform alterations'],
            ].map(([type, label]) => (
              <Fragment key={type}>
                <label>
                  <input
                    type="checkbox"
                    checked={enabledAnnouncements.includes(type as AnnouncementType)}
                    onChange={event => {
                      setEnabledAnnouncements(
                        event.target.checked
                          ? [...enabledAnnouncements, type as AnnouncementType]
                          : enabledAnnouncements.filter(value => value !== type),
                      )
                    }}
                  />
                  {label}
                </label>

                {type === AnnouncementType.Passing && (
                  <label htmlFor="fast-train-approaching" css={{ marginLeft: SUB_OPTION_INDENT }}>
                    <input
                      type="checkbox"
                      name="fast-train-approaching"
                      id="fast-train-approaching"
                      checked={announceFastTrainApproaching}
                      onChange={e => setAnnounceFastTrainApproaching(e.target.checked)}
                    />
                    Announce "fast train approaching"?
                  </label>
                )}
              </Fragment>
            ))}
        </fieldset>

        <fieldset
          css={{
            padding: 0,
            width: '100%',
          }}
        >
          <label htmlFor="restrict-platforms-to-station">
            <input
              type="checkbox"
              name="restrict-platforms-to-station"
              id="restrict-platforms-to-station"
              checked={restrictPlatformsToStation}
              disabled={stationPlatformKeys === null}
              onChange={e => setRestrictPlatformsToStation(e.target.checked)}
            />
            Only show this station's platforms
          </label>

          <div
            css={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              gap: 8,
              marginBottom: 16,
              marginTop: 16,
            }}
          >
            {systemKeys.map(systemKey => {
              return (
                <button
                  key={systemKey}
                  onClick={() => {
                    const platformsSupportedBySystem = visiblePlatforms.filter(([_, keys]) => keys.includes(systemKey)).map(([key]) => key)

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

                for (const [p, keys] of visiblePlatforms) {
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
                dispatchSystemKeyForPlatform({ platforms: visiblePlatforms.map(([platform]) => platform), systemKey: null })
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

                '&::-webkit-details-marker': {
                  display: 'none',
                },

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

            <p css={{ marginTop: 16 }}>We'll remember these settings on your device.</p>

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
              {visiblePlatforms.map(([platform, systems]) => {
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

        <label htmlFor="show-unconfirmed-platforms">
          <input
            type="checkbox"
            name="show-unconfirmed-platforms"
            id="show-unconfirmed-platforms"
            aria-describedby="help-show-unconfirmed-platforms"
            checked={showUnconfirmedPlatforms}
            onChange={e => setShowUnconfirmedPlatforms(e.target.checked)}
          />
          Show trains with unconfirmed platforms
        </label>
        <p id="help-show-unconfirmed-platforms" css={{ fontSize: '0.8em', marginLeft: 40, marginTop: -8 }}>
          Useful for stations where platforms are suppressed from live data feeds, such as King's Cross.
        </p>
      </NoSSR>

      <p css={{ margin: '16px 0' }}>
        This is a beta feature, and isn't complete or fully functional. Please report any issues you face{' '}
        <a href="https://github.com/davwheat/rail-announcements/issues">on GitHub</a>.
      </p>
      <NoSSR>
        {dataSource === 'websocket' ? (
          <p>
            Announcements follow new triggers from the live feed. Connecting starts silently; expired messages are skipped. All train details and
            platform warnings come from the feed.
          </p>
        ) : (
          <>
            <p css={{ margin: '16px 0' }}>
              This page will auto-announce all departures in the next {MIN_TIME_TO_ANNOUNCE} minutes from the selected station. Departures
              outside this timeframe will appear on the board below, but won't be announced until closer to the time.
            </p>
            <p css={{ margin: '16px 0' }}>At the moment, we also won't announce services which:</p>
            <ul className="list" css={{ margin: '16px 16px' }}>
              <li>have no platform allocated in data feeds (common at larger stations, even at the time of departure)</li>
              <li>have already been announced by the system in the last hour (only affects services which suddenly get delayed)</li>
              <li>are terminating at the selected station</li>
            </ul>
            <p>
              We also can't handle most short platforms and various other features as this information isn't contained within the open data
              provided by National Rail.
            </p>
          </>
        )}
      </NoSSR>

      <div
        css={{
          padding: 12,
          paddingLeft: 16,
          borderLeft: '4px solid var(--primary-blue)',
          background: `color-mix(in srgb, var(--primary-blue), transparent 92%)`,
          marginBottom: 24,
        }}
      >
        <p>
          We're currently trialling <strong>automated short platform announcements</strong> for stations served by GTR (Southern, Thameslink,
          Gatwick Express, and Great Northern) and Southeastern.
        </p>
        <p>
          Please let us know if you know any short platforms that aren't correctly announced by the website for these TOCs. We'll seek
          information and feedback about other TOCs in the near future
        </p>
        <p css={{ marginBottom: 0 }}>
          Have feedback? Please post it on{' '}
          <a target="_blank" href="https://github.com/davwheat/rail-announcements/issues/226">
            this GitHub tracking issue
          </a>
          !
        </p>
      </div>

      {!hasEnabledFeature ? (
        <button
          css={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 0,
          }}
          onClick={() => setHasEnabledFeature(true)}
        >
          Start live trains
        </button>
      ) : (
        <>
          <button
            css={{
              marginBottom: 16,
            }}
            onClick={() => {
              // Is iPhone
              if (navigator.userAgent.match(/iPhone/i)) {
                alert('iPhones do not support the Fullscreen API. Please use a different device to use this feature.')
              } else {
                setFullscreen(true)
              }
            }}
          >
            <span className="buttonLabel">
              <FullscreenIcon /> Fullscreen
            </span>
          </button>

          <FullScreen enabled={isFullscreen} onChange={setFullscreen}>
            {perPlatformBoards ? (
              <div
                css={{
                  display: 'grid',
                  gap: 16,
                  gridTemplateColumns: 'minmax(0, 1fr)',

                  [Breakpoints.downTo.desktopLarge]: {
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  },
                }}
              >
                {stationPlatforms.platforms.map(platform => (
                  <section key={platform}>
                    <h3 css={{ marginBottom: 8 }}>Platform {platform}</h3>

                    <iframe
                      ref={frame => registerBoardFrame(platform, frame)}
                      title={`Departure board for platform ${platform}`}
                      onLoad={() => setIframeReady(true)}
                      css={{
                        border: 'none',
                        width: '100%',
                        height: 400,
                      }}
                      key={`${dataSource}:${selectedCrs}:${liveServiceUrl}:${platform}`}
                      src={boardUrl(platform)}
                    />
                  </section>
                ))}
              </div>
            ) : (
              <iframe
                ref={frame => registerBoardFrame('__station', frame)}
                title={`Departure board for ${selectedCrs}`}
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
                key={`${dataSource}:${selectedCrs}:${liveServiceUrl}`}
                src={boardUrl()}
              />
            )}
          </FullScreen>

          <div id="resume-audio-container" />

          {dataSource === 'websocket' && !streamedAudio && <p role="status">Live feed: {liveStatus}</p>}
          {streamedAudio &&
            (typeof announcementStream === 'string' ? (
              <p role="alert">{announcementStream}</p>
            ) : (
              <AnnouncementStreams stream={announcementStream} log={addLog} />
            ))}
          <Logs css={{ marginTop: 16 }} logs={logs} />

          <img
            src={NREPowered.src}
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

      <textarea value={logs.join('\n')} css={{ width: '100%', minHeight: 250, maxHeight: '90vh', resize: 'vertical', padding: 8 }} />
    </div>
  )
}
