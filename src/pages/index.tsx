import MainSelector from '@components/MainSelector'
import Layout from '@components/Layout'
import AnnouncementPanel from '@components/AnnouncementPanel'
import NavBar from '@components/NavBar'
import Disclaimers from '@components/Disclaimers'

import RailSymbol from '@assets/rail-symbol-2/white-on-red-inset.svg'
import MegaphoneIcon from 'mdi-react/MegaphoneOutlineIcon'

import { Link, PageProps } from 'gatsby'
import Breakpoints from '@data/breakpoints'

function IndexPage({ location }: PageProps) {
  return (
    <Layout location={location}>
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

      <main>
        <MainSelector />

        <aside
          css={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'center',
            padding: 24,
            background: 'hsl(204 50% 85% / 1)',
            gap: 16,
            marginTop: 16,
            [Breakpoints.upTo.tablet]: {
              flexDirection: 'column',
              justifyContent: 'center',
            },
          }}
        >
          Listen to real-time train announcements for almost any UK station
          <Link className="button" to="/amey-live-train-announcements">
            <span className="buttonLabel">
              <MegaphoneIcon />
              Yes please!
            </span>
          </Link>
        </aside>

        <AnnouncementPanel />
      </main>

      <Disclaimers
        customDisclaimers={[
          <p>
            Files relating to the Atos Worldline system have been removed from this site. <Link to="/atos-worldline">Learn more</Link>
          </p>,
        ]}
      />
    </Layout>
  )
}

export default IndexPage
