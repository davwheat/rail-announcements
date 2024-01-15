import React from 'react'
import * as Sentry from '@sentry/gatsby'

interface IAnnouncementTabErrorBoundaryProps {
  systemId: string
  systemName: string
  children: React.ReactNode
}

export default function AnnouncementTabErrorBoundary(props: IAnnouncementTabErrorBoundaryProps): React.ReactElement {
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
      fallback={({ eventId, resetError, error, componentStack }) => (
        <div>
          <p>Uh oh, something went wrong while playing this announcement.</p>
          <p>If you use an ad blocking system, please disable this and try to reproduce the error.</p>
          <p>
            If this happens again, <a href="https://github.com/davwheat/rail-announcements/issues/new">open a GitHub issue</a>, and quote event
            ID <code>{eventId}</code> <strong>and</strong> provide the detailed error information below.
          </p>
          <details style={{ margin: '16px 0' }}>
            <summary>Detailed info</summary>

            <textarea
              style={{ width: '100%' }}
              rows={8}
              readOnly
              value={`${error?.name}: ${error.message}\n\n${error.stack || '<no stacktrace>'}`}
            />
            <textarea style={{ width: '100%' }} rows={25} readOnly value={componentStack} />
          </details>
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
