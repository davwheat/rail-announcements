import { announcementName, describeAnnouncement, describeMovement } from './describe'
import { announcementPlatforms } from './playAnnouncement'
import type { Announcement, AnnouncementType, Movement } from './types'

const stages: Partial<Record<AnnouncementType, number>> = { next: 1, approaching: 2, standing: 3 }

/** Audio can stall indefinitely on a suspended context or a hung clip fetch, and a stalled
 *  announcement must never hold the queue shut for the rest of the session. */
const PLAYBACK_TIMEOUT = 300_000

const QUEUE_BOUND = 64

interface QueuedAnnouncement {
  announcement: Announcement
}

function platformsOf(announcement: Announcement): string[] {
  return announcementPlatforms(announcement).filter((platform): platform is string => !!platform)
}

/** The only two announcements worth cutting a speaking one short for. Everything else waits its
 *  turn: the platform hears one announcement finish before the next begins. */
function supersedesSpeaking(incoming: Announcement, speaking: Announcement): boolean {
  // The platform already being spoken is now the wrong one, so finishing it sends the platform there.
  if (incoming.announcement_type === 'platform_alteration') return incoming.movement_id === speaking.movement_id
  // Standing back from a train that is seconds away outranks the delay the platform is hearing about.
  if (incoming.announcement_type === 'passing' && speaking.announcement_type === 'disrupted') {
    const warned = new Set(platformsOf(incoming))
    return platformsOf(speaking).some(platform => warned.has(platform))
  }
  return false
}

export class PlaybackQueue {
  private pending: QueuedAnnouncement[] = []
  private seen = new Set<string>()
  /** The furthest stage each movement has been announced at, so a disruption can be weighed
   *  against what the station has already been told about that train. */
  private reached = new Map<string, number>()
  private playing = new Set<string>()
  /** In-flight announcements by event, so a later one can be weighed against what is being spoken. */
  private active = new Map<string, { controller: AbortController; announcement: Announcement }>()
  private session = new AbortController()

  constructor(
    private play: (announcement: Announcement, signal: AbortSignal, valid: () => boolean) => Promise<void>,
    private now = Date.now,
    private onError: (error: unknown) => void = console.error,
    /** The lanes an announcement occupies while it plays. Announcements sharing a lane are
     *  played in turn; the single default lane keeps the whole station in turn. */
    private lanes: (announcement: Announcement) => string[] = () => [''],
    private log: (message: string) => void = () => {},
  ) {}

  reset() {
    const waiting = this.pending.length
    const inProgress = this.active.size
    this.abortSession()
    this.pending = []
    this.seen.clear()
    this.reached.clear()
    this.playing.clear()
    this.active.clear()
    if (waiting || inProgress) this.log(`Cleared the queue: ${waiting} waiting, ${inProgress} part way through`)
  }

  private abortSession() {
    this.session.abort()
    this.session = new AbortController()
  }

  /** The service withdraws an announcement whose train is cancelled, suppressed, replatformed,
   *  departed or gone. A withdrawal only discards what is still waiting: audio already speaking
   *  is left to finish, because a half-spoken announcement is heard as a broken station rather
   *  than as a correction. Only {@link interrupt} cuts one short. */
  retract(eventId: string, reason?: string) {
    const because = reason ? ` (${reason})` : ''
    const queued = this.pending.find(({ announcement }) => announcement.event_id === eventId)
    const active = this.active.get(eventId)
    this.pending = this.pending.filter(({ announcement }) => announcement.event_id !== eventId)
    if (queued) this.log(`Withdrawn${because}: ${describeAnnouncement(queued.announcement)}`)
    if (active) this.log(`Withdrawn too late to stop, so it finishes${because}: ${describeAnnouncement(active.announcement)}`)
    // A withdrawal for something already spoken is routine. One for an event that never arrived is not.
    if (!queued && !active && !this.seen.has(eventId)) this.log(`Withdrawal for an announcement that never arrived${because}`)
  }

  /** Replaces the details of an announcement still waiting its turn, so it speaks the current
   *  time rather than the one that was current when the service triggered it. */
  revise(eventId: string, details: Movement) {
    let revised: Announcement | undefined
    this.pending = this.pending.map(entry => {
      if (entry.announcement.event_id !== eventId) return entry
      revised = { ...entry.announcement, details }
      return { ...entry, announcement: revised }
    })
    if (revised) this.log(`Revised while queued: ${describeAnnouncement(revised)}`)
  }

  private isValid({ announcement }: QueuedAnnouncement): boolean {
    const expiry = Date.parse(announcement.expires_at)
    return Number.isFinite(expiry) && expiry > this.now()
  }

  push(announcement: Announcement) {
    if (this.seen.has(announcement.event_id)) {
      this.log(`Repeat ignored: ${describeAnnouncement(announcement)}`)
      return
    }
    if (!Number.isFinite(Date.parse(announcement.expires_at)) || Date.parse(announcement.expires_at) <= this.now()) {
      this.log(`Expired on arrival: ${describeAnnouncement(announcement)}`)
      return
    }

    const stage = stages[announcement.announcement_type] || 0
    const reached = this.reached.get(announcement.movement_id) ?? 0
    // A train announced as approaching is seconds from its platform. Its delay stopped being
    // news the moment the station was told to stand back from it.
    if (announcement.announcement_type === 'disrupted' && reached >= stages.approaching!) {
      this.log(`Not announcing the delay to ${describeMovement(announcement.details)}: it has already been announced as approaching`)
      return
    }

    this.seen.add(announcement.event_id)
    if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!)
    if (stage > reached) {
      this.reached.set(announcement.movement_id, stage)
      if (this.reached.size > 2048) this.reached.delete(this.reached.keys().next().value!)
    }

    this.pending = this.pending.filter(({ announcement: previous }) => {
      if (previous.movement_id !== announcement.movement_id) return true
      const keep = announcement.details.cancelled
        ? !stages[previous.announcement_type]
        : stage <= (stages[previous.announcement_type] ?? Infinity)
      if (!keep) this.log(`Superseded by the ${announcementName(announcement.announcement_type)}: ${describeAnnouncement(previous)}`)
      return keep
    })
    if (this.pending.length >= QUEUE_BOUND) {
      const dropped = this.pending.shift()!
      this.log(`Queue is full at ${QUEUE_BOUND}, so the oldest was dropped: ${describeAnnouncement(dropped.announcement)}`)
    }
    this.pending.push({ announcement })
    const ahead = this.pending.length - 1
    this.log(`Queued${ahead > 0 ? ` behind ${ahead} other${ahead === 1 ? '' : 's'}` : ''}: ${describeAnnouncement(announcement)}`)
    this.interrupt(announcement)
    this.drain()
  }

  /** Stops the audio this announcement is worth cutting short. Its lanes free as it unwinds,
   *  so the interrupting announcement starts from the drain that follows. */
  private interrupt(announcement: Announcement) {
    for (const active of this.active.values()) {
      if (!supersedesSpeaking(announcement, active.announcement)) continue
      this.log(`Cut short by the ${announcementName(announcement.announcement_type)}: ${describeAnnouncement(active.announcement)}`)
      active.controller.abort()
    }
  }

  /** Starts everything whose lanes are free, leaving the rest in order behind them. */
  private drain() {
    for (let index = 0; index < this.pending.length; index++) {
      const entry = this.pending[index]
      const lanes = this.lanes(entry.announcement)
      if (lanes.some(lane => this.playing.has(lane))) continue
      this.pending.splice(index--, 1)

      const session = this.session
      const controller = new AbortController()
      const stopWithSession = () => controller.abort()
      session.signal.addEventListener('abort', stopWithSession, { once: true })
      const valid = () => !controller.signal.aborted && this.isValid(entry)
      if (!valid()) {
        session.signal.removeEventListener('abort', stopWithSession)
        this.log(`Expired while it waited its turn: ${describeAnnouncement(entry.announcement)}`)
        continue
      }

      for (const lane of lanes) this.playing.add(lane)
      this.active.set(entry.announcement.event_id, { controller, announcement: entry.announcement })
      void this.playBounded(entry.announcement, controller, valid)
        .catch(error => {
          if (!controller.signal.aborted) this.onError(error)
        })
        .finally(() => {
          session.signal.removeEventListener('abort', stopWithSession)
          if (this.active.get(entry.announcement.event_id)?.controller === controller) this.active.delete(entry.announcement.event_id)
          if (!controller.signal.aborted) this.log(`Finished: ${describeAnnouncement(entry.announcement)}`)
          // A reset has already cleared the lanes, and they may belong to a new session by now.
          if (this.session === session) for (const lane of lanes) this.playing.delete(lane)
          this.drain()
        })
    }
  }

  private playBounded(announcement: Announcement, controller: AbortController, valid: () => boolean): Promise<void> {
    const { signal } = controller
    const timer = setTimeout(() => {
      this.onError(new Error(`Playback timed out after ${PLAYBACK_TIMEOUT / 1000}s: ${describeAnnouncement(announcement)}`))
      // Aborting this announcement alone stops its audio and frees its lanes.
      controller.abort()
    }, PLAYBACK_TIMEOUT)
    const stalled = new Promise<void>(resolve => {
      if (signal.aborted) return resolve()
      signal.addEventListener('abort', () => resolve(), { once: true })
    })
    return Promise.race([this.play(announcement, signal, valid), stalled]).finally(() => clearTimeout(timer))
  }
}
