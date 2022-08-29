import React from 'react'
import * as Sentry from '@sentry/gatsby'

interface IAnnouncementTabErrorBoundaryProps {
  systemId: string
  systemName: string
  children: React.ReactNode
}

export default function AnnouncementTabErrorBoundary(props: IAnnouncementTabErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      beforeCapture={scope => {
        scope.setTag('location', 'announcement tab')
        scope.setContext('announcement system', {
          id: props.systemId,
          name: props.systemName,
        })
        scope.setContext('audio ids', { ids: window.__audio })
      }}
      fallback={({ eventId, resetError }) => (
        <div>
          <p>Uh oh, something went wrong while playing this announcement!</p>
          <p>
            If this happens again, message{' '}
            <a
              href={`https://twitter.com/messages/compose?recipient_id=1033075771659747329&text=${encodeURIComponent(
                'I had an issue while creating an announcement. Event ID: ' + eventId,
              )}`}
            >
              <code>@davwheat_</code>
            </a>{' '}
            on Twitter or open a GitHub issue, and quote event ID: <code>{eventId}</code>
          </p>
          <p>
            <button onClick={() => resetError()}>Try again</button>
          </p>
        </div>
      )}
    >
      {props.children}
    </Sentry.ErrorBoundary>
  )
}
