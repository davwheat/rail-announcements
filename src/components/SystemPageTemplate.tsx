import Layout from '@components/Layout'
import AnnouncementPanel from '@components/AnnouncementPanel'
import NavBar from '@components/NavBar'
import Disclaimers from '@components/Disclaimers'

import RailSymbol from '@assets/rail-symbol-2/white-on-red-inset.svg'

import { Link, PageProps } from 'gatsby'

import BackIcon from 'mdi-react/ArrowLeftIcon'

import type AnnouncementSystem from '@announcement-data/AnnouncementSystem'
import type StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import type TrainAnnouncementSystem from '@announcement-data/TrainAnnouncementSystem'

interface IProps {
  location: PageProps['location']
  system: new () => TrainAnnouncementSystem | StationAnnouncementSystem | AnnouncementSystem
}

export default function SystemPageTemplate({ location, system }: IProps) {
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

      <main css={{ margin: '0 24px' }}>
        <Link css={{ marginTop: 24, display: 'inline-block' }} className="button" to="/">
          <span className="buttonLabel">
            <BackIcon /> Back to system selection
          </span>
        </Link>

        <AnnouncementPanel system={system} />
      </main>

      <Disclaimers />
    </Layout>
  )
}
