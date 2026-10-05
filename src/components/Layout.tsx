import React from 'react'

import SEO from './SEO'
import Crunker from '../helpers/crunker'

import { useAtom } from 'jotai'
import { SnackbarProvider } from 'notistack'

import { serviceAudioState } from '../atoms'
import { ANNOUNCEMENT_SERVICE_AVAILABLE } from '../live/announcementService'
import NoSSR from './NoSSR'

interface Props {
  description?: string
  title?: string
  children: React.ReactNode
}

/** Rendered only in the browser: the setting lives in local storage, which the server cannot see. */
const ServiceAudioToggle: React.FC = () => {
  const [serviceAudio, setServiceAudio] = useAtom(serviceAudioState)

  return (
    <p>
      <label htmlFor="service-audio">
        <input type="checkbox" id="service-audio" checked={serviceAudio} onChange={event => setServiceAudio(event.target.checked)} /> Build
        announcement audio on our server (beta)
      </label>
      <br />
      <small>
        Announcements are put together by our server and sent to you as one piece of audio, where it knows how. Everything else is still built in
        your browser.
      </small>
    </p>
  )
}

const NoWebAudioBanner: React.FC = () => {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    Crunker.notSupported(() => setShow(true))
  }, [])

  if (!show) return null

  return (
    <div
      role="alert"
      css={{
        padding: '12px 16px',
        borderLeft: '8px solid #ca2d25',
        background: '#ca2d2511',
        margin: 24,
        marginBottom: 0,
      }}
    >
      <p>
        <strong>Audio playback is not supported</strong>
      </p>
      <p css={{ marginBottom: 0 }}>
        Your browser does not support the Web Audio API, which is required for this website to play announcements. Please try using a modern
        browser such as Chrome, Firefox, Safari, or Edge.
      </p>
      {/iPad|iPhone|iPod|Macintosh|Mac OS/.test(navigator.userAgent) && (
        <p css={{ marginBottom: 0, marginTop: 12 }}>
          <strong>Apple device users:</strong> If you have Lockdown Mode enabled, the Web Audio API is disabled for security reasons. You will
          need to disable Lockdown Mode or use a different device to play announcements.
        </p>
      )}
    </div>
  )
}

const Layout: React.FC<Props> = ({ children, title, description }) => {
  return (
    <SnackbarProvider>
      <SEO title={title} description={description} />

      <NoWebAudioBanner />

      <main
        css={{
          padding: '24px 16px',
          '@media (min-width: 600px)': {
            padding: 24,
          },
        }}
      >
        {children}
      </main>

      <footer
        css={{
          padding: '24px 16px',
          '@media (min-width: 600px)': {
            padding: 24,
          },
        }}
      >
        {ANNOUNCEMENT_SERVICE_AVAILABLE && (
          <NoSSR>
            <ServiceAudioToggle />
          </NoSSR>
        )}
        <p>
          Made with love by{' '}
          <a href="https://davwheat.dev/" target="_blank">
            David Wheatley
          </a>
        </p>
        <p>
          <a href="https://github.com/davwheat/rail-announcements" target="_blank">
            This site is open source, and its code is available on GitHub.
          </a>
        </p>
      </footer>
    </SnackbarProvider>
  )
}

export default Layout
