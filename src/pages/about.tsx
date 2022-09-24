import React from 'react'

import Layout from '@components/Layout'
import NavBar from '@components/NavBar'

import { StaticImage } from 'gatsby-plugin-image'
import { makeStyles } from '@material-ui/styles'
import Breakpoints from '@data/breakpoints'

const useStyles = makeStyles({
  root: {
    margin: 'auto',
    maxWidth: 900,

    [Breakpoints.downTo.bigPhone]: {
      marginTop: 64,
    },

    [Breakpoints.upTo.bigPhone]: {
      marginTop: 38,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
  },
  portrait: {
    float: 'left',
    marginTop: 10,
    marginRight: 32,
    marginBottom: 32,
    borderRadius: '50%',
    shapeOutside: 'circle(50%)',

    [Breakpoints.upTo.bigPhone]: {
      margin: 'auto',
      marginBottom: 32,
      float: 'none',
      textAlign: 'center',
    },
  },
})

function AboutPage({ location }): JSX.Element {
  const classes = useStyles()

  return (
    <Layout location={location}>
      <header>
        <h1>About</h1>
      </header>

      <NavBar />

      <main className={classes.root}>
        <StaticImage class={classes.portrait} width={150} src="../assets/dav.jpg" alt="Portrait image of David" />

        <p>
          This site is developed and maintained by <a href="https://github.com/davwheat">David Wheatley</a>, a train, plane, and mobile
          networking enthusiast.
        </p>

        <p>
          Most of the announcements on this site are recorded in-person, so quality can be quite sketchy. If you have any better recordings of
          any snippets, please get in touch over on <a href="https://github.com/davwheat/rail-announcements">this site's GitHub repository</a>!
        </p>

        <p>
          Some announcements are collated from various Freedom of Information requests, such as: ScotRail; Class 700; and all TfL systems. The
          announcements are <strong>not</strong> licensed under the same MIT license that this website's source code is licensed under. Please
          ensure you follow the appropriate licensing terms when using these announcements.
        </p>
      </main>
    </Layout>
  )
}

export default AboutPage
