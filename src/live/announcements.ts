import { connectStream, streamUrl, type ConnectionStatus } from './connection'
import { announcementName } from './describe'
import { PlaybackQueue } from './playbackQueue'
import type { Announcement, AnnouncementType, Heartbeat, Ready, Retraction, Revision } from './types'

/** Heartbeats fill a quiet station's silence, so silence this long is a dead connection
 *  rather than an uneventful hour. Matches the service's own pong deadline. */
const ANNOUNCEMENT_IDLE_TIMEOUT = 75_000
const HEARTBEAT_SECONDS = '30'

type Incoming = Ready | Announcement | Retraction | Revision | Heartbeat

/** The service withdraws and revises the announcements it has sent, so this one stream carries
 *  everything playback needs. A second connection for the train list would only duplicate the
 *  projection it is already speaking for. */
export function connectAnnouncements(
  baseUrl: string,
  crs: string,
  types: AnnouncementType[],
  queue: PlaybackQueue,
  onStatus: (status: ConnectionStatus) => void,
  log: (message: string) => void = () => {},
): () => void {
  const url = streamUrl(baseUrl, 'announcements', crs)
  url.searchParams.set('type', types.join(','))
  url.searchParams.set('heartbeat', HEARTBEAT_SECONDS)
  if (types.length === 0) {
    log('No announcement types are selected, so the live feed is not connected')
    queue.reset()
    return () => queue.reset()
  }

  log(`Subscribing to ${crs} for ${types.map(announcementName).join(', ')}`)

  let ready = false
  return connectStream(
    url,
    message => {
      const incoming = message as Incoming
      if (incoming.version !== 1) throw new Error('Invalid announcement stream')
      switch (incoming.type) {
        case 'heartbeat':
          return
        case 'ready':
          if (incoming.station.crs !== crs) throw new Error('Invalid announcement stream')
          // Repeated whenever the service's health changes, and each one re-baselines it.
          queue.reset()
          ready = incoming.healthy
          onStatus(ready ? 'live' : 'recovering')
          log(
            ready
              ? `${incoming.station.name || crs} is live; announcements start from now`
              : `${incoming.station.name || crs} is recovering; announcements are paused until the service catches up`,
          )
          return
        case 'announcement':
          if (incoming.station.crs !== crs) throw new Error('Invalid announcement stream')
          if (!incoming.event_id || incoming.movement_id !== incoming.details.id) throw new Error('Invalid announcement')
          if (ready) queue.push(incoming)
          else log(`Ignoring a ${announcementName(incoming.announcement_type)} sent while the service is recovering`)
          return
        case 'retraction':
          if (!incoming.event_id) throw new Error('Invalid retraction')
          if (ready) queue.retract(incoming.event_id, incoming.reason)
          return
        case 'revision':
          if (!incoming.event_id || incoming.movement_id !== incoming.details.id) throw new Error('Invalid revision')
          if (ready) queue.revise(incoming.event_id, incoming.details)
          return
        default:
          throw new Error('Unexpected announcement message')
      }
    },
    () => {
      ready = false
      queue.reset()
    },
    onStatus,
    ANNOUNCEMENT_IDLE_TIMEOUT,
    log,
  )
}
