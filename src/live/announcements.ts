import { connectCIS } from './cis'
import { connectStream, streamUrl, type ConnectionStatus } from './connection'
import { PlaybackQueue } from './playbackQueue'
import type { Announcement, AnnouncementType, Ready } from './types'

/** The CIS stream proves itself live by resyncing; announcements can be silent for as long
 *  as the station is quiet, so only a long silence is taken as a dead connection. */
const ANNOUNCEMENT_IDLE_TIMEOUT = 600_000

/** CIS validates queued audio; the announcement endpoint alone supplies triggers. */
export function connectAnnouncements(
  baseUrl: string,
  crs: string,
  types: AnnouncementType[],
  queue: PlaybackQueue,
  onStatus: (status: ConnectionStatus) => void,
): () => void {
  let stopAnnouncements: (() => void) | undefined
  const cisUrl = streamUrl(baseUrl, 'cis', crs)
  cisUrl.searchParams.set('limit', '1000')
  const announcementUrl = streamUrl(baseUrl, 'announcements', crs)
  announcementUrl.searchParams.set('type', types.join(','))

  function reset() {
    stopAnnouncements?.()
    stopAnnouncements = undefined
    queue.reset()
  }

  const stopCIS = connectCIS(
    cisUrl,
    state => {
      if (!state) {
        reset()
        return
      }
      queue.updateState(state)
      if (stopAnnouncements || types.length === 0) return
      let ready = false
      stopAnnouncements = connectStream(
        announcementUrl,
        message => {
          const incoming = message as Ready | Announcement
          if (!['ready', 'announcement'].includes(incoming.type)) throw new Error('Unexpected announcement message')
          if (incoming.version !== 1 || incoming.station.crs !== crs) throw new Error('Invalid announcement stream')
          if (incoming.type === 'ready') {
            queue.reset()
            ready = incoming.healthy
            onStatus(ready ? 'live' : 'recovering')
          } else if (incoming.type === 'announcement' && ready) {
            if (!incoming.event_id || incoming.movement_id !== incoming.details.id) throw new Error('Invalid announcement')
            queue.push(incoming)
          }
        },
        () => {
          ready = false
          queue.reset()
        },
        onStatus,
        ANNOUNCEMENT_IDLE_TIMEOUT,
      )
    },
    status => {
      if (status !== 'live') onStatus(status)
    },
  )

  return () => {
    stopCIS()
    reset()
  }
}
