import React from 'react'

import { Link } from 'gatsby'
import { makeStyles } from '@material-ui/styles'
import Breakpoints from '@data/breakpoints'

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    justifyItems: 'center',
    marginBlock: 24,
    textAlign: 'center',

    [Breakpoints.upTo.tablet]: {
      gridTemplateColumns: '1fr',
    },
  },
})

export default function NavBar() {
  const classes = useStyles()

  return (
    <nav className={classes.root}>
      <Link to="/">Generator</Link>
      <Link to="/amey-live-train-announcements">Live announcements</Link>
      <Link to="/about">About</Link>
      <Link to="/changelog">Latest changes</Link>
    </nav>
  )
}
