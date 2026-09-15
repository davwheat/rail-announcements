import type { Announcement, AnnouncementType, Movement } from './types'

const stages: Partial<Record<AnnouncementType, number>> = { next: 1, approaching: 2, standing: 3 }

/** Audio can stall indefinitely on a suspended context or a hung clip fetch, and a stalled
 *  announcement must never hold the queue shut for the rest of the session. */
const PLAYBACK_TIMEOUT = 300_000

interface QueuedAnnouncement {
  announcement: Announcement
}

export class PlaybackQueue {
  private pending: QueuedAnnouncement[] = []
  private seen = new Set<string>()
  /** The furthest stage each movement has been announced at, so a disruption can be weighed
   *  against what the station has already been told about that train. */
  private reached = new Map<string, number>()
  private playing = new Set<string>()
  /** In-flight announcements by event, so a retraction can stop the one it names. */
  private active = new Map<string, AbortController>()
  private session = new AbortController()

  constructor(
    private play: (announcement: Announcement, signal: AbortSignal, valid: () => boolean) => Promise<void>,
    private now = Date.now,
    private onError: (error: unknown) => void = console.error,
    /** The lanes an announcement occupies while it plays. Announcements sharing a lane are
     *  played in turn; the single default lane keeps the whole station in turn. */
    private lanes: (announcement: Announcement) => string[] = () => [''],
  ) {}

  reset() {
    this.abortSession()
    this.pending = []
    this.seen.clear()
    this.reached.clear()
    this.playing.clear()
    this.active.clear()
  }

  private abortSession() {
    this.session.abort()
    this.session = new AbortController()
  }

  /** The service withdraws an announcement whose train is cancelled, suppressed, replatformed,
   *  departed or gone. Audio already started is stopped too: a train that will not arrive on
   *  the platform being announced is worse to finish than to cut short. */
  retract(eventId: string) {
    this.pending = this.pending.filter(({ announcement }) => announcement.event_id !== eventId)
    this.active.get(eventId)?.abort()
  }

  /** Replaces the details of an announcement still waiting its turn, so it speaks the current
   *  time rather than the one that was current when the service triggered it. */
  revise(eventId: string, details: Movement) {
    this.pending = this.pending.map(entry =>
      entry.announcement.event_id === eventId ? { ...entry, announcement: { ...entry.announcement, details } } : entry,
    )
  }

  private isValid({ announcement }: QueuedAnnouncement): boolean {
    const expiry = Date.parse(announcement.expires_at)
    return Number.isFinite(expiry) && expiry > this.now()
  }

  push(announcement: Announcement) {
    if (
      this.seen.has(announcement.event_id) ||
      !Number.isFinite(Date.parse(announcement.expires_at)) ||
      Date.parse(announcement.expires_at) <= this.now()
    )
      return

    const stage = stages[announcement.announcement_type] || 0
    const reached = this.reached.get(announcement.movement_id) ?? 0
    // A train announced as approaching is seconds from its platform. Its delay stopped being
    // news the moment the station was told to stand back from it.
    if (announcement.announcement_type === 'disrupted' && reached >= stages.approaching!) return

    this.seen.add(announcement.event_id)
    if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!)
    if (stage > reached) {
      this.reached.set(announcement.movement_id, stage)
      if (this.reached.size > 2048) this.reached.delete(this.reached.keys().next().value!)
    }

    this.pending = this.pending.filter(({ announcement: previous }) => {
      if (previous.movement_id !== announcement.movement_id) return true
      if (announcement.details.cancelled) return !stages[previous.announcement_type]
      return stage <= (stages[previous.announcement_type] ?? Infinity)
    })
    if (this.pending.length >= 64) this.pending.shift()
    this.pending.push({ announcement })
    this.drain()
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
        continue
      }

      for (const lane of lanes) this.playing.add(lane)
      this.active.set(entry.announcement.event_id, controller)
      void this.playBounded(entry.announcement, controller, valid)
        .catch(error => {
          if (!controller.signal.aborted) this.onError(error)
        })
        .finally(() => {
          session.signal.removeEventListener('abort', stopWithSession)
          if (this.active.get(entry.announcement.event_id) === controller) this.active.delete(entry.announcement.event_id)
          // A reset has already cleared the lanes, and they may belong to a new session by now.
          if (this.session === session) for (const lane of lanes) this.playing.delete(lane)
          this.drain()
        })
    }
  }

  private playBounded(announcement: Announcement, controller: AbortController, valid: () => boolean): Promise<void> {
    const { signal } = controller
    const timer = setTimeout(() => {
      this.onError(new Error('Announcement playback timed out'))
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
