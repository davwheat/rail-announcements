import React from 'react'

import MainSelector from '@components/MainSelector'
import Layout from '@components/Layout'
import AnnouncementPanel from '@components/AnnouncementPanel'
import NavBar from '@components/NavBar'

// @ts-expect-error
import LogoSmallUrl from '../images/logo_small.png'
import { makeStyles } from '@material-ui/styles'
import { Link } from 'gatsby'

const useStyles = makeStyles({
  heading: {
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    height: 50,
    width: 50,
    marginRight: 16,
  },
  atosNotice: {
    background: '#fee',
    marginTop: 16,
    padding: 16,

    '& :last-child': {
      marginBottom: 0,
    },
  },
  copyrightWarning: {
    marginTop: 24,
    padding: 16,
    background: '#fdd',

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
          <img alt="" role="presentation" className={classes.logo} src={LogoSmallUrl} />
          <span>Rail announcements</span>
        </h1>
      </header>

      <NavBar />

      <main>
        <MainSelector />

        <aside className={classes.atosNotice}>
          <p>
            Files relating to the Atos Worldline system have been removed from this site. <Link to="/atos-worldline">Learn more</Link>
          </p>
        </aside>

        <AnnouncementPanel />
      </main>

      <aside className={classes.copyrightWarning}>
        <p>
          Content on this site has either been self-recorded, or released into the public domain via Freedom of Information requests. Copyright
          may still apply to these files, and may be held by either the respective TOCs, PIS/CIS manufacturers or even the voice artists.
        </p>
        <p>
          You <u>must not</u> use the content on this site for commercial purposes. These files and systems are provided for personal use
          only in an attempt to archive historial PIS/CIS systems. Abuse of the website and its contents could result in legal action against you
          by copyright holders, and/or cause this site to be taken down.
        </p>
      </aside>
    </Layout>
  )
}

export default IndexPage
