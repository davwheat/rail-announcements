import React, { useEffect, useRef } from 'react'

import Layout from '@components/Layout'
import NavBar from '@components/NavBar'
import Breakpoints from '@data/breakpoints'
import Changelog from '@data/changelog'
import useStateWithLocalStorage from '@hooks/useStateWithLocalStorage'

import { makeStyles } from '@material-ui/styles'
import dayjs from 'dayjs'

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
  lastViewed: {
    marginBottom: 24,
  },
  timelineList: {
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    '--timeline-width': '4px',
    '--timeline-node-size': '1.5rem',
    '--timeline-color': 'var(--primary-blue)',
  },
  timelineItem: {
    borderLeft: `var(--timeline-width) solid var(--timeline-color)`,
    marginLeft: 'calc((var(--timeline-node-size) - var(--timeline-width)) / 2)',
    position: 'relative',
    paddingLeft: 48,
    paddingBottom: 24,

    '&[data-new=true]': {
      '--timeline-color': 'var(--primary-red)',
    },

    '&::before': {
      content: '""',
      position: 'absolute',
      left: 'calc((var(--timeline-node-size) + var(--timeline-width)) / -2)',
      width: 'var(--timeline-node-size)',
      height: 'var(--timeline-node-size)',
      borderRadius: '50%',
      border: `var(--timeline-width) solid var(--timeline-color)`,
      backgroundColor: 'white',
    },

    '& h2': {
      marginTop: -2,
      fontWeight: '600',
      display: 'flex',
    },

    '& h3': {
      marginTop: 16,
      fontWeight: '700',
      fontSize: '1.1rem',
    },
  },
  newBadge: {
    fontSize: '0.6em',
    padding: '2px 8px',
    textTransform: 'uppercase',
    display: 'inline-block',
    backgroundColor: 'var(--primary-red)',
    color: 'white',
    borderRadius: 4,
    marginRight: 12,
  },
  dataList: {
    listStyle: 'disc inside !important',
    fontSize: '1.1rem',
    lineHeight: 1.5,
  },
})

Changelog.sort((a, b) => {
  return b.date.localeCompare(a.date)
})

function ChangelogPage({ location }): JSX.Element {
  const classes = useStyles()

  const [lastViewed, setLastViewed] = useStateWithLocalStorage('changelog_lastViewedAt', +new Date(), val => {
    if (isNaN(new Date(val).getTime())) return false
    if (new Date(val) > new Date()) return false

    return true
  })
  const { current: realLastViewed } = useRef(lastViewed)

  useEffect(() => {
    setLastViewed(+new Date())
  }, [])

  return (
    <Layout location={location}>
      <header>
        <h1>Changelog</h1>
      </header>

      <NavBar />

      <main className={classes.root}>
        <p className={classes.lastViewed}>
          We've highlighted all changed since you last viewed this page on {dayjs(realLastViewed).format('DD MMM YYYY')}.
        </p>

        <ol className={classes.timelineList}>
          {Changelog.map((entry, i) => {
            const isNew = dayjs(realLastViewed).isBefore(entry.date + 'z')

            return (
              <li key={i} className={classes.timelineItem} data-new={isNew.toString()}>
                <h2>
                  {isNew && <span className={classes.newBadge}>New!</span>} {dayjs(entry.date + 'z').format('D MMM YYYY')}
                </h2>

                <div>
                  <h3>Additions</h3>
                  <ul className={classes.dataList}>{entry.additions?.map((detail, i) => <li key={i}>{detail}</li>) ?? <li>None</li>}</ul>

                  <h3>Fixes</h3>
                  <ul className={classes.dataList}>{entry.fixes?.map((detail, i) => <li key={i}>{detail}</li>) ?? <li>None</li>}</ul>

                  <h3>Other</h3>
                  <ul className={classes.dataList}>{entry.otherChanges?.map((detail, i) => <li key={i}>{detail}</li>) ?? <li>None</li>}</ul>
                </div>
              </li>
            )
          })}
        </ol>
      </main>
    </Layout>
  )
}

export default ChangelogPage
