import React from 'react'

import MainSelector from '@components/MainSelector'
import Layout from '@components/Layout'
import AnnouncementPanel from '@components/AnnouncementPanel'

// @ts-expect-error
import LogoSmallUrl from '../images/logo_small.png'
import { makeStyles } from '@material-ui/styles'

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
      <main>
        <MainSelector />
        <AnnouncementPanel />
      </main>
    </Layout>
  )
}

export default IndexPage
