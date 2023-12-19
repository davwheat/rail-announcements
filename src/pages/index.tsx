import React from 'react'

import MainSelector from '@components/MainSelector'
import Layout from '@components/Layout'
import AnnouncementPanel from '@components/AnnouncementPanel'
import NavBar from '@components/NavBar'

import RailSymbol from '@assets/rail-symbol-2/white-on-red-inset.svg'

import { makeStyles } from '@material-ui/styles'
import { Link } from 'gatsby'
import clsx from 'clsx'

const useStyles = makeStyles({
  heading: {
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: 64,
    width: 64,
    marginRight: 16,
    marginTop: -3,
  },
  atosNotice: {
    background: '#fee',
  },
  noticeBlock: {
    marginTop: 24,
    padding: 16,
    background: '#eee',

    '& > :last-child': {
      marginBottom: 0,
    },
  },
})

function IndexPage({ location }): JSX.Element {
  const classes = useStyles()

  return (
    <Layout location={location}>
      <header>
        <h1 className={classes.heading}>
          <img alt="" role="presentation" className={classes.logo} src={RailSymbol} />
          <span>Rail announcements</span>
        </h1>
      </header>

      <NavBar />

      <main>
        <MainSelector />

        <AnnouncementPanel />
      </main>

      <aside className={clsx(classes.noticeBlock, classes.atosNotice)}>
        <p>
          Files relating to the Atos Worldline system have been removed from this site. <Link to="/atos-worldline">Learn more</Link>
        </p>
      </aside>

      <aside className={classes.noticeBlock}>
        <h2>Attribution and copyright</h2>
        <p>
          Content on this site has either been self-recorded, or released into the public domain via Freedom of Information requests. Copyright
          may still apply to these files, and may be held by either the respective TOCs, PIS/CIS manufacturers or even the voice artists.
        </p>
        <p>
          You <u>must not</u> use the content on this site for commercial purposes. These files and systems are provided for personal use only in
          an attempt to archive present-day and historical PIS/CIS systems. Abuse of the website and its contents could result in legal action
          against you by copyright holders, and/or cause this site to be taken down.
        </p>
      </aside>

      <aside className={classes.noticeBlock}>
        <h2>Health & safety</h2>
        <p>
          This website is provided for educations and entertainment purposes only. It may not be used as a replacement for a public customer
          information system or be used as a source of accurate real-time data.
        </p>
      </aside>
    </Layout>
  )
}

export default IndexPage
