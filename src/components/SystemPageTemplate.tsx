import Layout from '@components/Layout'
import AnnouncementPanel from '@components/AnnouncementPanel'
import NavBar from '@components/NavBar'
import Disclaimers from '@components/Disclaimers'
import SavedAnnouncementLoader from '@components/SavedAnnouncementLoader'

import RailSymbol from '@assets/rail-symbol-2/white-on-red-inset.svg'

import { Link, PageProps } from 'gatsby'

import BackIcon from 'mdi-react/ArrowLeftIcon'

import type AnnouncementSystem from '@announcement-data/AnnouncementSystem'

interface IProps {
  location: PageProps['location']
  system: typeof AnnouncementSystem
}

export default function SystemPageTemplate({ location, system }: IProps) {
  const s: AnnouncementSystem = new (system as any)()

  return (
    <Layout location={location} title={s.NAME}>
      <SavedAnnouncementLoader />

      <header>
        <h1
          css={{
            fontSize: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            alt=""
            role="presentation"
            css={{
              height: 64,
              width: 64,
              marginRight: 16,
              marginTop: -3,
            }}
            src={RailSymbol}
          />
          <span>Rail announcements</span>
        </h1>
      </header>

      <NavBar />

      <main css={{ margin: '0 24px' }}>
        <Link css={{ marginTop: 24, display: 'inline-block' }} className="button" to="/">
          <span className="buttonLabel">
            <BackIcon /> Back to system selection
          </span>
        </Link>

        <noscript>
          <div css={{ marginTop: 24, padding: '12px 16px', borderLeft: '8px solid #ca2d25', background: '#ca2d2511' }}>
            <p>
              <strong>JavaScript is disabled</strong>
            </p>
            <p css={{ marginBottom: 0 }}>
              This website requires JavaScript to be enabled in order to work. Please enable JavaScript in your browser settings and refresh the
              page.
            </p>
          </div>
        </noscript>

        <AnnouncementPanel system={system} />
      </main>

      <Disclaimers />
    </Layout>
  )
}
