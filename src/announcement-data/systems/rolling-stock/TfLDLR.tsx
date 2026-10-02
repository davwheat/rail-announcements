import { useEffect } from 'react'
import Select from 'react-select'
import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import AnnouncementSystem, {
  AnnouncementState,
  AnyCustomAnnouncementTab,
  AudioItem,
  CustomAnnouncementButton,
  CustomAnnouncementTab,
  ICustomOptionComponentProps,
} from '../../AnnouncementSystem'
import {
  AllDestinations,
  AllStations,
  Clips,
  ElizabethLineEraStations,
  IDlrPosition,
  SDO_WARNING_PAUSE,
  approachMessage,
  bypassesWestIndiaQuay,
  destinationClip,
  getStation,
  locate,
  resolveRoute,
  upcomingStations,
} from './TfLDLRData'

interface IServiceOptions extends AnnouncementState {
  origin: string
  destination: string
  nextStation: string
  threeCar: boolean
}

interface IApproachingOptions extends IServiceOptions {
  elizabethLine: boolean
}

interface IDockedOptions {
  station: string
  terminating: boolean
  threeCar: boolean
}

function locateNextStation(options: IServiceOptions): IDlrPosition | null {
  const route = resolveRoute(options.origin, options.destination)

  return route && locate(route, options.nextStation)
}

interface IRouteStationSelectProps<State extends IServiceOptions> extends ICustomOptionComponentProps<string, State> {
  label: string
}

/**
 * A select offering only the stations the chosen service has yet to call at, which a plain select
 * can't do because its choices are fixed.
 */
function RouteStationSelect<State extends IServiceOptions>({ value, onChange, activeState, label }: IRouteStationSelectProps<State>) {
  const stations = activeState ? upcomingStations(resolveRoute(activeState.origin, activeState.destination)) : []
  const selected = stations.includes(value) ? value : stations[0]

  useEffect(() => {
    if (selected !== undefined && selected !== value) {
      onChange(selected)
    }
  }, [selected, value, onChange])

  const options = stations.map(name => ({ value: name, label: name }))

  return (
    <label className="option-select">
      {label}
      <Select
        options={options}
        value={options.find(option => option.value === selected) ?? null}
        onChange={option => option && onChange(option.value)}
      />
    </label>
  )
}

const stationOptions = AllStations.map(stn => ({ title: stn.name, value: stn.name }))
const destinationOptions = AllDestinations.map(dest => ({ title: dest.id, value: dest.id }))

const DefaultService: IServiceOptions = {
  origin: 'Bank',
  destination: 'Lewisham',
  nextStation: 'Shadwell',
  threeCar: false,
}

const announcementPresets: Readonly<{ approaching: ICustomAnnouncementPreset<IApproachingOptions>[] }> = {
  approaching: [
    {
      name: 'Bank to Lewisham, approaching Westferry',
      state: { ...DefaultService, nextStation: 'Westferry', elizabethLine: true },
    },
    {
      name: 'Bank to Lewisham, approaching Canary Wharf',
      state: { ...DefaultService, nextStation: 'Canary Wharf', elizabethLine: true },
    },
    {
      name: 'Three-car Bank to Lewisham, approaching Cutty Sark',
      state: { ...DefaultService, nextStation: 'Cutty Sark', threeCar: true, elizabethLine: true },
    },
    {
      name: 'Stratford to Canary Wharf, approaching Poplar',
      state: { origin: 'Stratford', destination: 'Canary Wharf', nextStation: 'Poplar', threeCar: false, elizabethLine: true },
    },
    {
      name: 'Beckton to Tower Gateway, approaching Tower Gateway',
      state: { origin: 'Beckton', destination: 'Tower Gateway', nextStation: 'Tower Gateway', threeCar: false, elizabethLine: true },
    },
  ],
}

function serviceOptions<State extends IServiceOptions>() {
  return {
    origin: {
      name: 'Origin',
      default: DefaultService.origin,
      options: stationOptions,
      type: 'select' as const,
    },
    destination: {
      name: 'Destination',
      default: DefaultService.destination,
      options: destinationOptions,
      type: 'select' as const,
    },
    nextStation: {
      name: '',
      default: DefaultService.nextStation,
      type: 'custom' as const,
      component: RouteStationSelect<State>,
      props: { label: 'Next station' },
    },
  }
}

function button(label: string, ...files: AudioItem[]): CustomAnnouncementButton {
  return { label, files }
}

export default class TfLDLR extends AnnouncementSystem {
  readonly NAME = 'TfL Docklands Light Railway'
  readonly ID = 'TFL_DLR_V1'
  readonly FILE_PREFIX = 'TfL/DLR'
  readonly SYSTEM_TYPE = 'train'
  readonly DESCRIPTION =
    'Generate Docklands Light Railway on-train announcements using real audio recordings from the DLR automatic voice information system.'

  headerComponent() {
    return 'Choose a service and the announcements follow its route, as on the real system: interchange messages, the terminating message and the West India Quay bypass all depend on where the train is and where it came from. An ordinary departure only updates the displays, so departure audio exists only for terminating, selective door opening and bypass departures.'
  }

  private async playApproachingAnnouncement(options: IApproachingOptions, download: boolean = false): Promise<void> {
    const position = locateNextStation(options)

    if (!position) {
      alert(`Invalid service.\n\n${options.origin} to ${options.destination}, next station ${options.nextStation}`)
      return
    }

    const { station, route, terminating } = position
    const selectiveDoors = options.threeCar && station.sdo
    const files: AudioItem[] = []

    if (terminating) {
      files.push(Clips.theNextStopIs, station.approachClip)

      if (selectiveDoors) {
        files.push(Clips.toAlightMoveToCentre, Clips.theNextStopIs, station.clip)
      }

      files.push(...approachMessage(position, options.elizabethLine))
    } else {
      files.push(Clips.thisTrainIsFor, destinationClip(route, station.name), Clips.theNextStopIs, station.approachClip)

      if (selectiveDoors) {
        files.push(Clips.toAlightMoveToCentre)
      }

      files.push(...approachMessage(position, options.elizabethLine))

      // The on-train recording has the bypass message here, inside the Westferry approach message. At
      // Canary Wharf the interchange message carries it instead, as "and DLR to West India Quay".
      if (station.name === 'Westferry' && bypassesWestIndiaQuay(position)) {
        files.push(Clips.wiqBypass)
      }

      if (station.belongings) {
        files.push(Clips.whenLeavingBelongings)
      }
    }

    await this.playAudioFiles(files, download)
  }

  private async playDockedAnnouncement(options: IDockedOptions, download: boolean = false): Promise<void> {
    const thisStation = getStation(options.station)

    if (!thisStation) {
      alert(`Invalid station.\n\n${options.station}`)
      return
    }

    const files: AudioItem[] = []

    if (thisStation.mindTheGap) {
      files.push(Clips.mindTheGap)
    }

    files.push(Clips.thisIs, thisStation.dockedClip)

    if (options.threeCar && thisStation.sdo) {
      files.push(Clips.toAlightMoveToCentre)
    }

    if (options.terminating) {
      files.push(Clips.thisTrainTerminatesHere)
    }

    await this.playAudioFiles(files, download)
  }

  private async playDepartingAnnouncement(options: IServiceOptions, download: boolean = false): Promise<void> {
    const position = locateNextStation(options)

    if (!position) {
      alert(`Invalid service.\n\n${options.origin} to ${options.destination}, next station ${options.nextStation}`)
      return
    }

    const { station, terminating } = position
    const followingStation = getStation(position.following)
    const files: AudioItem[] = []

    if (terminating) {
      files.push(Clips.theNextStopIs, station.departureClip)

      if (options.threeCar && station.sdo) {
        files.push(Clips.toAlightMoveToCentre, Clips.theNextStopIs, station.clip)
      }

      files.push(Clips.whereThisTrainTerminates)

      if (station.belongings) {
        files.push(Clips.pleaseRememberBelongings)
      }
    } else if (options.threeCar && station.sdo) {
      files.push(Clips.theNextStopIs, station.clip, Clips.toAlightMoveToCentre, Clips.as, Clips.firstAndLastDoorsWillNotOpen)
    } else if (options.threeCar && followingStation?.sdo) {
      files.push(
        Clips.theNextStopIs,
        station.clip,
        { id: Clips.at, opts: { delayStart: SDO_WARNING_PAUSE } },
        followingStation.clip,
        Clips.firstAndLastDoorsWillNotOpen,
        Clips.toAlightMoveToCentre,
      )
    } else if (bypassesWestIndiaQuay(position) && ['Westferry', 'Canary Wharf'].includes(station.name) && position.previous) {
      files.push(Clips.wiqBypassPlatform5)
    } else {
      alert('This departure only updates the displays and has no audio. Only terminating, selective door opening and bypass departures do.')
      return
    }

    await this.playAudioFiles(files, download)
  }

  readonly customAnnouncementTabs: Record<string, AnyCustomAnnouncementTab> = {
    approaching: {
      name: 'Approaching station',
      component: CustomAnnouncementPane,
      defaultState: { ...DefaultService, elizabethLine: true },
      props: {
        playHandler: this.playApproachingAnnouncement.bind(this),
        presets: announcementPresets.approaching,
        options: {
          ...serviceOptions<IApproachingOptions>(),
          threeCar: {
            name: 'Three-car train (selective door opening)',
            default: false,
            type: 'boolean',
            onlyShowWhen: ({ nextStation }) => getStation(nextStation)?.sdo ?? false,
          },
          elizabethLine: {
            name: 'Use Elizabeth line version',
            default: true,
            type: 'boolean',
            onlyShowWhen: ({ nextStation }) => ElizabethLineEraStations.includes(nextStation),
          },
        },
      },
    } satisfies CustomAnnouncementTab<IApproachingOptions>,
    docked: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      defaultState: {
        station: 'Shadwell',
        terminating: false,
        threeCar: false,
      },
      props: {
        playHandler: this.playDockedAnnouncement.bind(this),
        options: {
          station: {
            name: 'This station',
            default: 'Shadwell',
            options: stationOptions,
            type: 'select',
          },
          terminating: {
            name: 'Train terminates here',
            default: false,
            type: 'boolean',
          },
          threeCar: {
            name: 'Three-car train (selective door opening)',
            default: false,
            type: 'boolean',
            onlyShowWhen: ({ station }) => getStation(station)?.sdo ?? false,
          },
        },
      },
    } satisfies CustomAnnouncementTab<IDockedOptions>,
    departing: {
      name: 'Departing station',
      component: CustomAnnouncementPane,
      defaultState: { ...DefaultService, nextStation: 'Lewisham' },
      props: {
        playHandler: this.playDepartingAnnouncement.bind(this),
        options: {
          ...serviceOptions<IServiceOptions>(),
          threeCar: {
            name: 'Three-car train (selective door opening)',
            default: false,
            type: 'boolean',
            onlyShowWhen: options => {
              const position = locateNextStation(options)

              return !!position && (position.station.sdo || (!position.terminating && !!getStation(position.following)?.sdo))
            },
          },
        },
      },
    } satisfies CustomAnnouncementTab<IServiceOptions>,
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          Safety: [
            button('Mind the gap please', Clips.mindTheGap),
            button('Please contact the train captain or press the passenger alarm immediately', Clips.contactTrainCaptain),
            button('Please remember to take all your belongings with you', Clips.pleaseRememberBelongings),
            button('When leaving the train, please remember to take all your belongings with you', Clips.whenLeavingBelongings),
          ],
          Service: [
            button('This train is not in service', Clips.notInService),
            button('The train will terminate, all change', Clips.theTrainWillTerminateAllChange),
            button('The train will terminate. Please remember to take all your belongings with you', Clips.theTrainWillTerminateBelongings),
            button('The next stop is Poplar. The train will reverse en route', Clips.reverseAtPoplar),
            button('Please leave the train from the right hand side in the direction of travel', Clips.leaveFromRightHandSide),
          ],
        },
      },
    },
  }
}
