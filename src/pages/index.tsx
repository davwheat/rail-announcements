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
    background: '#fdd',
    padding: 16,

    '& :last-child': {
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
          <h2>Notice about Atos Worldline announcements</h2>

          <p>
            Following a legal notice from Worldline IT Services UK Limited, I have been forced to remove all copies of Atos Anne's recordings
            from this website. I am disappointed by their decision to request this.
          </p>

          <p>
            For more information, an open letter to the users of this site, and a copy of the legal notice and email conversation, please see{' '}
            <Link to="/atos-worldline">the new, dedicated Atos Worldline page</Link>.
          </p>
        </aside>

        <AnnouncementPanel />
      </main>
    </Layout>
  )
}

export default IndexPage
