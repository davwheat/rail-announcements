import type { Announcement, AnnouncementType, CISState } from './types'

const stages: Partial<Record<AnnouncementType, number>> = { next: 1, approaching: 2, standing: 3 }

/** Audio can stall indefinitely on a suspended context or a hung clip fetch, and a stalled
 *  announcement must never hold the queue shut for the rest of the session. */
const PLAYBACK_TIMEOUT = 300_000

interface QueuedAnnouncement {
  announcement: Announcement
  /** Arrival time, so a CIS frame only judges announcements it could have accounted for. */
  receivedAt: number
}

export class PlaybackQueue {
  private pending: QueuedAnnouncement[] = []
  private seen = new Set<string>()
  private draining = false
  private session = new AbortController()
  private state: CISState | null = null
  private stateAt = 0

  constructor(
    private play: (announcement: Announcement, signal: AbortSignal, valid: () => boolean) => Promise<void>,
    private now = Date.now,
    private onError: (error: unknown) => void = console.error,
  ) {}

  reset() {
    this.abortSession()
    this.pending = []
    this.seen.clear()
  }

  private abortSession() {
    this.session.abort()
    this.session = new AbortController()
  }

  updateState(state: CISState) {
    this.state = state
    this.stateAt = this.now()
    this.pending = this.pending
      .filter(entry => this.isValid(entry))
      .map(entry => {
        const movement = state.movements.get(entry.announcement.movement_id)
        if (!movement || !this.supersedes(entry)) return entry
        return { ...entry, announcement: { ...entry.announcement, details: movement } }
      })
  }

  /** The two sockets can deliver the same projection in either order, so a frame that arrived
   *  before the announcement did neither refutes it nor improves on its details. */
  private supersedes(entry: QueuedAnnouncement): boolean {
    return this.state !== null && this.stateAt >= entry.receivedAt
  }

  private isValid(entry: QueuedAnnouncement): boolean {
    const { announcement } = entry
    if (!Number.isFinite(Date.parse(announcement.expires_at)) || Date.parse(announcement.expires_at) <= this.now()) return false
    const state = this.state
    if (!state) return true
    // Whatever the frame holds is authoritative; only missing evidence depends on the ordering.
    const absenceIsFinal = this.supersedes(entry)
    if (announcement.announcement_type === 'passing') {
      const standClear = [...state.overrides.values()].some(
        override =>
          override.kind === 'stand_clear' &&
          Date.parse(override.expires_at) > this.now() &&
          // A stand clear raised from TD evidence alone carries no movement id.
          (override.movement_id === announcement.movement_id || announcement.affected_platforms.includes(override.platform)),
      )
      return standClear || !absenceIsFinal
    }
    const movement = state.movements.get(announcement.movement_id)
    if (!movement) return !absenceIsFinal
    if (movement.suppressed || movement.platform.suppressed) return false
    if (movement.cancelled && announcement.announcement_type !== 'disrupted') return false
    if (movement.departure.actual && Date.parse(movement.departure.actual) <= this.now()) return false
    if (movement.td?.event === 'departure' && Date.parse(movement.td.observed_at) <= this.now()) return false
    // A platform alteration exists because the platforms disagree, and CIS may still hold the old one.
    if (announcement.announcement_type !== 'platform_alteration' && movement.platform.number !== announcement.details.platform.number)
      return false
    return true
  }

  push(announcement: Announcement) {
    if (
      this.seen.has(announcement.event_id) ||
      !Number.isFinite(Date.parse(announcement.expires_at)) ||
      Date.parse(announcement.expires_at) <= this.now()
    )
      return
    this.seen.add(announcement.event_id)
    if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!)

    const stage = stages[announcement.announcement_type] || 0
    this.pending = this.pending.filter(({ announcement: previous }) => {
      if (previous.movement_id !== announcement.movement_id) return true
      if (announcement.details.cancelled) return !stages[previous.announcement_type]
      return stage <= (stages[previous.announcement_type] ?? Infinity)
    })
    if (this.pending.length >= 64) this.pending.shift()
    this.pending.push({ announcement, receivedAt: this.now() })
    void this.drain()
  }

  private async drain() {
    if (this.draining) return
    this.draining = true
    try {
      while (this.pending.length) {
        const entry = this.pending.shift()!
        const signal = this.session.signal
        const valid = () => !signal.aborted && this.isValid(entry)
        if (!valid()) continue
        try {
          await this.playBounded(entry.announcement, signal, valid)
        } catch (error) {
          if (!signal.aborted) this.onError(error)
        }
      }
    } finally {
      this.draining = false
    }
  }

  private playBounded(announcement: Announcement, signal: AbortSignal, valid: () => boolean): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    let onAbort: (() => void) | undefined
    const stalled = new Promise<void>(resolve => {
      if (signal.aborted) return resolve()
      onAbort = resolve
      signal.addEventListener('abort', onAbort, { once: true })
      timer = setTimeout(() => {
        this.onError(new Error('Announcement playback timed out'))
        // A fresh session stops the stalled audio and releases the queue for later messages.
        this.abortSession()
        resolve()
      }, PLAYBACK_TIMEOUT)
    })
    return Promise.race([this.play(announcement, signal, valid), stalled]).finally(() => {
      clearTimeout(timer)
      if (onAbort) signal.removeEventListener('abort', onAbort)
    })
  }
}
