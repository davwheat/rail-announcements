import React, { useEffect, useRef, useState } from 'react'

import { playStream, type StationStream, type StreamStatus } from '../live/audioStreams'

const StatusNames: Record<StreamStatus, string> = {
  connecting: 'connecting',
  playing: 'live',
  blocked: 'waiting for you to press play',
  reconnecting: 'reconnecting',
}

/** Plays the station's one stream, in which the service has already mixed every zone. */
export default function AnnouncementStreams({ stream, log }: { stream: StationStream | null; log: (message: string) => void }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [status, setStatus] = useState<StreamStatus>('connecting')

  // Read through a ref so that a new log callback does not restart a stream that is speaking.
  const latestLog = useRef(log)
  latestLog.current = log

  const zones = stream?.zones.length ? `platforms ${stream.zones.map(zone => zone.join(', ')).join(' | ')}` : 'every platform'
  // Both URLs carry the same query, so either one identifies the stream.
  const identity = stream?.radioUrl

  useEffect(() => {
    if (!audio.current || !stream) return
    latestLog.current(`Playing announcements from the announcement service for ${zones}`)
    return playStream(stream, audio.current, setStatus, message => latestLog.current(message))
    // Keyed on the URL alone: a new object for the same stream must not restart the audio.
  }, [identity])

  if (!stream) return <p role="status">No platform has a voice selected, so there is nothing to play.</p>

  return (
    <div css={{ margin: '16px 0' }}>
      <p role="status">Announcement stream: {StatusNames[status]}</p>
      {/* Controls appear only when the browser refuses to start the audio without a click. */}
      <audio ref={audio} controls={status === 'blocked'} css={{ display: status === 'blocked' ? 'block' : 'none', marginTop: 4 }} />
    </div>
  )
}
