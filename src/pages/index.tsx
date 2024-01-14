import React from 'react'

import MainSelector from '@components/MainSelector'
import Layout from '@components/Layout'
import AnnouncementPanel from '@components/AnnouncementPanel'
import NavBar from '@components/NavBar'
import Disclaimers from '@components/Disclaimers'

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
