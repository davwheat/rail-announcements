import CustomAnnouncementPane, { ICustomAnnouncementPreset } from '@components/PanelPanes/CustomAnnouncementPane'
import CustomButtonPane from '@components/PanelPanes/CustomButtonPane'
import PisDisplay from '@components/PisDisplay'

import { pisDisplayState, type IPisDisplayMessage } from '@atoms'
import { getDefaultStore } from 'jotai'

import AnnouncementSystem, { AudioItem, CustomAnnouncementButton, CustomAnnouncementTab } from '../../AnnouncementSystem'
import {
  EngineeringAnnouncements,
  GeneralAnnouncements,
  InterchangeApproaching,
  InterchangeAtStation,
  LocalInfoApproaching,
  LocalInfoAtStation,
  SafetyAnnouncements,
  Stations,
  type IPiccadillyClip,
} from './TfLPiccadillyLineData'

const GAP_BETWEEN_CLIPS = 400

const NONE = 'none'

/** Warns customers about stepping off the train, so it leads the announcement. */
const MIND_THE_GAP = 500

/**
 * The card carries the terminating announcement twice, in the tense each moment calls for: 301
 * says the train "will terminate here" and 302 that it "terminates here".
 */
const TERMINATING = { atStation: 302, approaching: 301 }

interface IExtraPair {
  atStation: number
  approaching: number
}

interface IStationExtras {
  interchange?: IExtraPair
  localInfo?: IExtraPair
}

/**
 * What the route database would play alongside each station name. The card carries the
 * recordings but not the route table, so these are the interchanges and points of interest the
 * line actually had when the recordings were made. Anything ambiguous is left out.
 */
const StationExtras: Record<number, IStationExtras> = {
  11: { interchange: { atStation: 400, approaching: 450 } },
  15: { interchange: { atStation: 401, approaching: 451 }, localInfo: { atStation: 600, approaching: 650 } },
  17: { interchange: { atStation: 402, approaching: 452 }, localInfo: { atStation: 601, approaching: 651 } },
  18: { localInfo: { atStation: 602, approaching: 652 } },
  19: { interchange: { atStation: 403, approaching: 453 } },
  20: { interchange: { atStation: 404, approaching: 454 } },
  21: { interchange: { atStation: 405, approaching: 455 }, localInfo: { atStation: 603, approaching: 653 } },
  24: { interchange: { atStation: 406, approaching: 456 }, localInfo: { atStation: 605, approaching: 655 } },
  25: { interchange: { atStation: 406, approaching: 456 } },
  26: { interchange: { atStation: 408, approaching: 458 }, localInfo: { atStation: 606, approaching: 656 } },
  27: { interchange: { atStation: 408, approaching: 458 } },
  28: { interchange: { atStation: 409, approaching: 459 } },
  29: { interchange: { atStation: 408, approaching: 458 } },
  30: { interchange: { atStation: 408, approaching: 458 } },
  31: { interchange: { atStation: 408, approaching: 458 } },
  32: { interchange: { atStation: 408, approaching: 458 } },
  33: { interchange: { atStation: 410, approaching: 460 } },
  46: { interchange: { atStation: 408, approaching: 458 } },
  47: { interchange: { atStation: 408, approaching: 458 } },
  55: { interchange: { atStation: 418, approaching: 471 } },
  56: { interchange: { atStation: 418, approaching: 471 } },
  57: { interchange: { atStation: 418, approaching: 471 } },
  58: { interchange: { atStation: 418, approaching: 471 } },
  60: { interchange: { atStation: 418, approaching: 471 } },
  61: { interchange: { atStation: 418, approaching: 471 } },
  63: { interchange: { atStation: 418, approaching: 471 } },
  64: { interchange: { atStation: 408, approaching: 458 } },
  65: { interchange: { atStation: 406, approaching: 456 } },
}

interface IServiceAnnouncement {
  atStation?: number
  approaching?: number
}

/**
 * Heathrow branch announcements that depend on where the train is going as well as where it is,
 * keyed by station number and then by the train's destination.
 *
 * The branch splits after Hatton Cross, so a train serves either Terminal 4 and then Terminals
 * 1, 2 and 3, or Terminals 1, 2 and 3 and then Terminal 5 — never both. Hatton Cross is where
 * customers for the terminals this train will miss have to change.
 *
 * Which message plays turns on which way the train is heading. A train running into the airport
 * leaves its customers on the same platform to wait for the service they need, whereas one
 * running back towards central London has to send customers for Terminal 4 across to the
 * opposite platform to catch a train going the other way, which is what audio IDs 424 and 472
 * are for.
 */
const ServiceAnnouncements: Record<number, Record<number, IServiceAnnouncement>> = {
  // Osterley
  38: {
    38: { approaching: 465 },
  },
  // Hatton Cross
  42: {
    // Heading back towards central London, so Terminal 4 is across the platform.
    1: { atStation: 424, approaching: 472 },
    3: { atStation: 424, approaching: 472 },
    5: { atStation: 424, approaching: 472 },
    42: { approaching: 462 },
    // Heading into the airport, so the connecting service is on this platform.
    43: { atStation: 415, approaching: 464 },
    44: { atStation: 416, approaching: 467 },
    66: { atStation: 416, approaching: 468 },
    67: { atStation: 417, approaching: 470 },
  },
  // Heathrow Terminal 4
  43: {
    67: { atStation: 423 },
  },
}

// Audio IDs 73, 302, 500 and 501 are left out: each is byte-for-byte the same recording as
// another ID already listed here.
const ButtonSections: Record<string, number[]> = {
  'Doors and platform': [1, 2, 3, 4],
  'Belongings and security': [6, 7, 29, 30],
  Terminating: [5, 301],
  'Station closures': [8, 9, 10, 11, 12, 13, 14, 15],
  'Lifts and escalators': [16, 17],
  Delays: [18, 19, 20, 21, 22, 23, 24, 25, 26],
  'Service alterations': [27, 28, 31],
  Emergency: [32, 33, 34],
}

/**
 * Shortest wording that still tells each clip apart in the button grid. Buttons sit in sections
 * that already say whether a clip is the "at station" or "approaching" wording, so the labels
 * leave that out. Clips without an entry, which is the engineering set, are already named
 * tersely enough on the card itself.
 */
const ButtonLabels: Record<number, string> = {
  1: 'Stand clear of the doors',
  2: 'Let customers off first',
  3: 'Move right down inside the cars',
  4: 'Mind the gap',
  5: 'Terminates here, all change',
  6: 'Keep belongings with you',
  7: 'Keep belongings with you, report items',
  8: 'Next station closed',
  9: 'Next station closed — security alert',
  10: 'Terminal 4 closed',
  11: 'Terminal 4 security alert',
  12: 'Terminal 5 closed',
  13: 'Terminal 5 security alert',
  14: 'Terminals 1, 2 and 3 closed',
  15: 'Terminals 1, 2 and 3 security alert',
  16: 'Restricted lift service',
  17: 'Restricted escalator service',
  18: 'Moving forward then stopping suddenly',
  19: 'Delayed — signalling difficulties',
  20: 'Delayed — technical difficulties',
  21: 'Delayed — adverse weather',
  22: 'Delayed — circumstances beyond our control',
  23: 'Delayed — earlier incident',
  24: 'Delayed — engineering work',
  25: 'Held to even out gaps in service',
  26: 'Passenger alarm operated',
  27: 'Additional calls from Ravenscourt Park',
  28: 'Additional calls from Chiswick Park',
  29: 'No smoking',
  30: 'Beggars and buskers',
  31: 'Not in service',
  32: 'Train defect — withdrawn from service',
  33: 'Train and station being evacuated',
  34: 'Leave the train now',
  301: 'Will terminate here, all change',
  400: 'Victoria Line and National Rail',
  401: 'Victoria, Northern, H&C, Met, Circle and Rail',
  402: 'Central Line',
  403: 'Northern Line',
  404: 'Bakerloo Line',
  405: 'Jubilee and Victoria Lines',
  406: 'District and Circle Lines',
  407: 'Circle Line',
  408: 'District Line',
  409: 'District and Hammersmith & City Lines',
  410: 'District Line and Piccadilly to other destinations',
  411: 'Central London — wait on this platform',
  412: 'Central London — cross the platform',
  413: 'Terminals 1, 2 and 3 — change here',
  414: 'Central London — change here',
  415: 'Terminals 1, 2, 3 and 5 — change here',
  416: 'Terminal 4 — change here',
  417: 'Terminal 5 — change here',
  418: 'Metropolitan Line',
  419: 'District and H&C Lines, next stop Turnham Green',
  420: 'District and Piccadilly to other destinations, next stop Turnham Green',
  421: 'District and H&C Lines, next stop Acton Town',
  422: 'District and Piccadilly to other destinations, next stop Hammersmith',
  423: 'Next stop Terminals 1, 2 and 3, may wait here',
  424: 'Terminal 4 — change across platform',
  425: 'Victoria Line',
  450: 'Victoria Line and National Rail',
  451: 'Victoria, Northern, H&C, Met, Circle and Rail',
  452: 'Central Line',
  453: 'Northern Line',
  454: 'Bakerloo Line',
  455: 'Jubilee and Victoria Lines',
  456: 'District and Circle Lines',
  457: 'Circle Line',
  458: 'District Line',
  459: 'District and Hammersmith & City Lines',
  460: 'District Line and Piccadilly to other destinations',
  461: 'Central London — wait for a train',
  462: 'For Hatton Cross only — Central London cross the platform',
  463: 'For Terminal 4 — Terminals 1, 2 and 3 change here',
  464: 'For Terminal 4 — Terminals 1, 2, 3 and 5 change here',
  465: 'For Osterley — Central London change here',
  466: 'For Terminals 1, 2 and 3',
  467: 'For Terminals 1, 2 and 3 — Terminal 4 change here',
  468: 'For Terminals 1, 2, 3 and 5 — Terminal 4 change here',
  469: 'For Terminals 1, 2, 3 via Terminal 4',
  470: 'For Terminals 4 and 1, 2, 3 — Terminal 5 change here',
  471: 'Metropolitan Line',
  472: 'Terminal 4 — change across platform at Hatton Cross',
  473: 'Victoria Line',
  500: 'Mind the gap',
  501: 'Keep belongings with you',
  600: 'Royal National Institute of the Blind',
  601: 'British Museum',
  602: "London's Transport Museum",
  603: 'Buckingham Palace',
  605: 'Museums and Royal Albert Hall',
  606: "Earl's Court Exhibition Centre",
  650: 'Royal National Institute of the Blind',
  651: 'British Museum',
  652: "London's Transport Museum",
  653: 'Buckingham Palace',
  655: 'Museums and Royal Albert Hall',
  656: "Earl's Court Exhibition and Royal Albert Hall",
}

/** Audio IDs 16 and 17, the only announcements the route database does not decide by itself. */
const ReducedAccessAnnouncements = generalClips([16, 17])

const StationsAtStation = Stations.filter(station => station.atStation)
const StationsApproaching = Stations.filter(station => station.approaching)
const StationsWithDestination = Stations.filter(station => station.destination)

function stationOptions(stations: typeof Stations) {
  return stations.map(station => ({ title: station.name, value: station.number.toString() }))
}

function generalClips(specIds: number[]): IPiccadillyClip[] {
  return specIds.map(specId => GeneralAnnouncements.find(clip => clip.specId === specId)).filter(clip => clip !== undefined)
}

function reducedAccessOptions() {
  return [
    { title: 'None', value: NONE },
    ...ReducedAccessAnnouncements.map(clip => ({ title: buttonLabel(clip), value: clip.specId.toString() })),
  ]
}

function findStation(stationNumber: string) {
  return Stations.find(station => station.number.toString() === stationNumber)
}

function findClip(clips: IPiccadillyClip[], specId: number | undefined): IPiccadillyClip | undefined {
  return specId === undefined ? undefined : clips.find(clip => clip.specId === specId)
}

function serviceAnnouncement(stationNumber: number, destinationNumber: string, when: keyof IServiceAnnouncement): IPiccadillyClip | undefined {
  const specId = ServiceAnnouncements[stationNumber]?.[parseInt(destinationNumber, 10)]?.[when]

  return findClip(when === 'atStation' ? InterchangeAtStation : InterchangeApproaching, specId)
}

/**
 * Turns an announcement into the messages its display shows. A clip with no display text of its
 * own leaves whatever is on the display up for its duration, which is what the real system does
 * with interchange, local and safety information.
 */
function buildDisplayMessages(clips: IPiccadillyClip[]): IPisDisplayMessage[] {
  return clips.reduce<IPisDisplayMessage[]>((messages, clip, index) => {
    const duration = clip.duration * 1000 + (index === 0 ? 0 : GAP_BETWEEN_CLIPS)
    const previous = messages[messages.length - 1]

    if (clip.screenText && clip.screenText !== previous?.text) {
      messages.push({ text: clip.screenText, duration })
    } else if (previous) {
      previous.duration += duration
    } else {
      messages.push({ text: null, duration })
    }

    return messages
  }, [])
}

function buttonLabel(clip: IPiccadillyClip): string {
  return ButtonLabels[clip.specId] ?? clip.text.replace(/\.+$/, '')
}

interface IApproachingStationOptions {
  stationNumber: string
  destinationNumber: string
  reducedAccess: string
}

interface IAtStationOptions {
  stationNumber: string
  destinationNumber: string
  announceDestination: boolean
  reducedAccess: string
  safety: string[]
}

interface IDestinationOptions {
  stationNumber: string
}

const announcementPresets: Readonly<Record<string, ICustomAnnouncementPreset[]>> = {
  approachingStation: [
    {
      name: 'Finsbury Park',
      state: { stationNumber: '11', destinationNumber: NONE, reducedAccess: NONE },
    },
    {
      name: 'Hammersmith',
      state: { stationNumber: '28', destinationNumber: NONE, reducedAccess: NONE },
    },
    {
      name: 'Acton Town',
      state: { stationNumber: '33', destinationNumber: NONE, reducedAccess: NONE },
    },
    {
      name: 'Hatton Cross — train to Terminals 4 and 1, 2, 3',
      state: { stationNumber: '42', destinationNumber: '67', reducedAccess: NONE },
    },
    {
      name: 'Cockfosters — terminating',
      state: { stationNumber: '1', destinationNumber: '1', reducedAccess: NONE },
    },
    {
      name: 'Hatton Cross — train to Terminals 1, 2, 3 and 5',
      state: { stationNumber: '42', destinationNumber: '66', reducedAccess: NONE },
    },
  ],
  atStation: [
    {
      name: 'Acton Town — Piccadilly Line to Cockfosters',
      state: {
        stationNumber: '33',
        destinationNumber: '1',
        announceDestination: true,
        reducedAccess: NONE,
        safety: [],
      },
    },
    {
      name: 'Green Park',
      state: {
        stationNumber: '21',
        destinationNumber: NONE,
        announceDestination: true,
        reducedAccess: NONE,
        safety: [],
      },
    },
    {
      name: "King's Cross St. Pancras — mind the gap",
      state: {
        stationNumber: '15',
        destinationNumber: NONE,
        announceDestination: true,
        reducedAccess: NONE,
        safety: ['500'],
      },
    },
    {
      name: 'Hatton Cross — train to Terminals 4 and 1, 2, 3',
      state: {
        stationNumber: '42',
        destinationNumber: '67',
        announceDestination: false,
        reducedAccess: NONE,
        safety: [],
      },
    },
    {
      name: 'Hatton Cross — train to Terminals 1, 2, 3 and 5',
      state: {
        stationNumber: '42',
        destinationNumber: '66',
        announceDestination: false,
        reducedAccess: NONE,
        safety: [],
      },
    },
    {
      name: 'Cockfosters — terminating',
      state: {
        stationNumber: '1',
        destinationNumber: '1',
        announceDestination: false,
        reducedAccess: NONE,
        safety: ['500'],
      },
    },
  ],
}

export default class TfLPiccadillyLine extends AnnouncementSystem {
  readonly NAME = 'TfL Piccadilly Line'
  readonly ID = 'TFL_PICCADILLY_LINE_V1'
  readonly FILE_PREFIX = 'TfL/Piccadilly Line'
  readonly SYSTEM_TYPE = 'train'
  readonly DESCRIPTION =
    'Generate TfL Piccadilly Line on-train announcements using the real audio recordings and display text from a 1973 Tube Stock announcement card.'

  headerComponent() {
    return (
      <>
        <PisDisplay label="Simulated 1973 Tube Stock passenger information display" idleText="Piccadilly Line" />

        <p css={{ marginTop: 12 }}>
          Audio and display text come from a KeTech announcement card read out of a 1973 Tube Stock announcer. Announcements that carry no
          display text of their own, such as interchange and local information, leave the previous message on screen.
        </p>
      </>
    )
  }

  private async playClips(clips: IPiccadillyClip[], download: boolean = false): Promise<void> {
    const files: AudioItem[] = clips.map((clip, index) => (index === 0 ? clip.clip : { id: clip.clip, opts: { delayStart: GAP_BETWEEN_CLIPS } }))

    if (download) {
      return await this.playAudioFiles(files, true)
    }

    const messages = buildDisplayMessages(clips)

    await this.playAudioFiles(files, false, 'skip-service', 0, () => getDefaultStore().set(pisDisplayState, messages))
  }

  private async playApproachingStationAnnouncement(options: IApproachingStationOptions, download: boolean = false): Promise<void> {
    const station = findStation(options.stationNumber)

    if (!station?.approaching) return

    const extras = StationExtras[station.number] ?? {}
    const terminating = options.stationNumber === options.destinationNumber

    const clips = [
      station.approaching,
      serviceAnnouncement(station.number, options.destinationNumber, 'approaching'),
      terminating ? findClip(GeneralAnnouncements, TERMINATING.approaching) : undefined,
      findClip(InterchangeApproaching, extras.interchange?.approaching),
      findClip(LocalInfoApproaching, extras.localInfo?.approaching),
      findClip(ReducedAccessAnnouncements, parseInt(options.reducedAccess, 10)),
    ].filter(clip => clip !== undefined)

    await this.playClips(clips, download)
  }

  private async playAtStationAnnouncement(options: IAtStationOptions, download: boolean = false): Promise<void> {
    const station = findStation(options.stationNumber)

    if (!station?.atStation) return

    const extras = StationExtras[station.number] ?? {}

    const safety = options.safety.map(specId => findClip(SafetyAnnouncements, parseInt(specId, 10))).filter(clip => clip !== undefined)
    const terminating = options.stationNumber === options.destinationNumber

    const clips = [
      ...safety.filter(clip => clip.specId === MIND_THE_GAP),
      station.atStation,
      serviceAnnouncement(station.number, options.destinationNumber, 'atStation'),
      terminating ? findClip(GeneralAnnouncements, TERMINATING.atStation) : undefined,
      findClip(InterchangeAtStation, extras.interchange?.atStation),
      findClip(LocalInfoAtStation, extras.localInfo?.atStation),
      findClip(ReducedAccessAnnouncements, parseInt(options.reducedAccess, 10)),
      options.announceDestination && !terminating ? (findStation(options.destinationNumber)?.destination ?? undefined) : undefined,
      ...safety.filter(clip => clip.specId !== MIND_THE_GAP),
    ].filter(clip => clip !== undefined)

    await this.playClips(clips, download)
  }

  private async playDestinationAnnouncement(options: IDestinationOptions, download: boolean = false): Promise<void> {
    const destination = findStation(options.stationNumber)?.destination

    if (!destination) return

    await this.playClips([destination], download)
  }

  private createButtons(clips: IPiccadillyClip[]): CustomAnnouncementButton[] {
    return clips.map(clip => ({
      label: buttonLabel(clip),
      play: () => this.playClips([clip]),
      download: () => this.playClips([clip], true),
    }))
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab<string>> = {
    approachingStation: {
      name: 'Next station',
      component: CustomAnnouncementPane,
      defaultState: {
        stationNumber: StationsApproaching[0].number.toString(),
        destinationNumber: NONE,
        reducedAccess: NONE,
      },
      props: {
        playHandler: this.playApproachingStationAnnouncement.bind(this),
        presets: announcementPresets.approachingStation,
        options: {
          stationNumber: {
            name: 'Next station',
            default: StationsApproaching[0].number.toString(),
            options: stationOptions(StationsApproaching),
            type: 'select',
          },
          destinationNumber: {
            name: "Train's destination",
            default: NONE,
            options: [{ title: 'Not specified', value: NONE }, ...stationOptions(StationsWithDestination)],
            type: 'select',
          },
          reducedAccess: {
            name: 'Reduced station access',
            default: NONE,
            options: reducedAccessOptions(),
            type: 'select',
          },
        },
      },
    } as CustomAnnouncementTab<keyof IApproachingStationOptions>,
    atStation: {
      name: 'Stopped at station',
      component: CustomAnnouncementPane,
      defaultState: {
        stationNumber: StationsAtStation[0].number.toString(),
        destinationNumber: NONE,
        announceDestination: true,
        reducedAccess: NONE,
        safety: [],
      },
      props: {
        playHandler: this.playAtStationAnnouncement.bind(this),
        presets: announcementPresets.atStation,
        options: {
          stationNumber: {
            name: 'This station',
            default: StationsAtStation[0].number.toString(),
            options: stationOptions(StationsAtStation),
            type: 'select',
          },
          destinationNumber: {
            name: "Train's destination",
            default: NONE,
            options: [{ title: 'Not specified', value: NONE }, ...stationOptions(StationsWithDestination)],
            type: 'select',
          },
          announceDestination: {
            name: 'Announce the destination',
            default: true,
            type: 'boolean',
            onlyShowWhen: ({ destinationNumber, stationNumber }: Record<string, unknown>) =>
              destinationNumber !== NONE && destinationNumber !== stationNumber,
          },
          reducedAccess: {
            name: 'Reduced station access',
            default: NONE,
            options: reducedAccessOptions(),
            type: 'select',
          },
          safety: {
            name: 'Safety announcements',
            default: [],
            options: SafetyAnnouncements.map(clip => ({ title: clip.text, value: clip.specId.toString() })),
            type: 'multiselect',
          },
        },
      },
    } as CustomAnnouncementTab<keyof IAtStationOptions>,
    destination: {
      name: 'Destination info',
      component: CustomAnnouncementPane,
      defaultState: {
        stationNumber: StationsWithDestination[0].number.toString(),
      },
      props: {
        playHandler: this.playDestinationAnnouncement.bind(this),
        options: {
          stationNumber: {
            name: 'Destination',
            default: StationsWithDestination[0].number.toString(),
            options: stationOptions(StationsWithDestination),
            type: 'select',
          },
        },
      },
    } as CustomAnnouncementTab<keyof IDestinationOptions>,
    announcementButtons: {
      name: 'Announcement buttons',
      component: CustomButtonPane,
      props: {
        buttonSections: {
          ...Object.fromEntries(
            Object.entries(ButtonSections).map(([section, specIds]) => [section, this.createButtons(generalClips(specIds))]),
          ),
          Safety: this.createButtons(SafetyAnnouncements),
          'Interchange (at station)': this.createButtons(InterchangeAtStation),
          'Interchange (approaching)': this.createButtons(InterchangeApproaching),
          'Local information (at station)': this.createButtons(LocalInfoAtStation),
          'Local information (approaching)': this.createButtons(LocalInfoApproaching),
          'Engineering and test': this.createButtons(EngineeringAnnouncements),
        },
      },
    },
  }
}
