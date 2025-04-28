import Layout from '@components/Layout'
import NavBar from '@components/NavBar'
import Disclaimers from '@components/Disclaimers'
import CardLink from '@components/CardLink'
import SavedAnnouncementLoader from '@components/SavedAnnouncementLoader'

import RailSymbol from '@assets/rail-symbol-2/white-on-red-inset.svg'
import MegaphoneIcon from 'mdi-react/MegaphoneOutlineIcon'

import { Link, PageProps } from 'gatsby'
import Breakpoints from '@data/breakpoints'
import { Fragment } from 'react'

// Remember to set up in `useSavedAnnouncementApiLoader`!
const Systems = [
  {
    groupTitle: 'Rolling stock',
    systems: [
      { title: 'SN/SE Bombardier Xstar', url: '/rolling-stock/bombardier-xstar' },
      { title: 'Class 700/707/717', url: '/rolling-stock/class-700-707-717' },
      { title: 'LNER Azuma', url: '/rolling-stock/lner-azuma' },
      { title: 'Transport for Wales TrainFX', url: '/rolling-stock/tfw-trainfx' },
      { title: 'Transport for Wales Televic', url: '/rolling-stock/tfw-televic' },
      { title: 'TfL Jubilee Line', url: '/rolling-stock/tfl/jubilee-line' },
      { title: 'TfL Northern Line', url: '/rolling-stock/tfl/northern-line' },
      { title: 'TfL Elizabeth Line', url: '/rolling-stock/tfl/elizabeth-line' },
      { title: 'Avanti West Coast Pendolino', url: '/rolling-stock/avanti-west-coast-pendolino', new: true },
      { title: 'West Midlands Trains Class 172', url: '/rolling-stock/wmt-class-172', new: true },
    ],
  },
  {
    groupTitle: 'Stations',
    systems: [
      { title: 'Amey — Phil Sayer', url: '/stations/amey-phil-sayer' },
      { title: 'Amey — Celia Drummond', url: '/stations/amey-celia-drummond' },
      { title: 'ScotRail', url: '/stations/scotrail' },
    ],
  },
]

function IndexPage({ location }: PageProps) {
  return (
    <Layout location={location}>
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

      <main>
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
            marginTop: 32,
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

        <div css={{ maxWidth: 800, margin: '64px auto' }}>
          <h2 css={{ margin: '32px 12px', fontSize: '1.25em' }}>Select a system</h2>

          {Systems.map(group => (
            <Fragment key={group.groupTitle}>
              <h3 css={{ margin: '24px 12px' }}>{group.groupTitle}</h3>

              <ul css={{ padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {group.systems.map(system => (
                  <li key={system.url}>
                    <CardLink
                      to={system.url}
                      title={
                        <>
                          {system.new && (
                            <>
                              <span
                                css={{
                                  textTransform: 'uppercase',
                                  display: 'inline-block',
                                  padding: '3px 6px',
                                  paddingTop: 5,
                                  borderRadius: 4,
                                  background: 'hsl(204 50% 85% / 1)',
                                  fontSize: '0.75em',
                                  lineHeight: 1,
                                  transform: 'translateY(-2px)',
                                  marginRight: 8,
                                }}
                              >
                                New!
                              </span>
                            </>
                          )}
                          {system.title}
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            </Fragment>
          ))}
        </div>
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
