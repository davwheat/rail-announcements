import React, { useMemo } from 'react'

import Layout from '@components/Layout'
import NavBar from '@components/NavBar'
import Disclaimers from '@components/Disclaimers'
import { LiveTrainAnnouncements } from '@components/AmeyLiveTrainAnnouncements'

import Breakpoints from '@data/breakpoints'
import { makeStyles } from '@material-ui/styles'
import { PageProps } from 'gatsby'

import RailSymbol from '@assets/rail-symbol-2/white-on-red-inset.svg'
import AmeyPhil from '@announcement-data/systems/stations/AmeyPhil'
import AmeyCelia from '@announcement-data/systems/stations/AmeyCelia'
import AnnouncementTabErrorBoundary from '@components/AnnouncementTabErrorBoundary'

const useStyles = makeStyles({
  root: {
    margin: 'auto',
    maxWidth: 1280,

    [Breakpoints.downTo.bigPhone]: {
      marginTop: 64,
    },

    [Breakpoints.upTo.bigPhone]: {
      marginTop: 38,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },

    '& p': {
      marginBottom: 16,
    },
  },
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

function AmeyTrainAnnouncementsPage({ location }: PageProps): JSX.Element {
  const classes = useStyles()

  const systems = useMemo<Record<'Phil Sayer' | 'Celia Drummond', AmeyPhil>>(() => {
    return {
      'Phil Sayer': new AmeyPhil(),
      'Celia Drummond': new AmeyCelia(),
    } as const
  }, [])

  const supportedPlatforms: Record<string, (keyof typeof systems)[]> = useMemo(() => {
    const platsPerSystem = Object.fromEntries(Object.entries(systems).map(([key, system]) => [key, system.PLATFORMS]))
    const allPlatforms = Array.from(new Set(Object.values(platsPerSystem).flat()))

    return Object.fromEntries(
      allPlatforms.map(key => {
        const systems: string[] = []

        Object.entries(platsPerSystem).forEach(([systemName, systemPlatforms]) => {
          if (systemPlatforms.includes(key)) {
            systems.push(systemName)
          }
        })

        return [key, systems]
      }),
    ) as any
  }, [systems])

  return (
    <Layout
      location={location}
      title="Live announcements"
      description="Listen to real-time train announcements for (almost) any UK railway station."
    >
      <header>
        <h1 className={classes.heading}>
          <img alt="" role="presentation" className={classes.logo} src={RailSymbol} />
          <span>Amey Live Train Announcements</span>
        </h1>
      </header>

      <NavBar />

      <main className={classes.root}>
        <p style={{ fontWeight: 'bold' }}>Listen to live train announcements for (almost) any UK railway station</p>
        <p>
          Live train announcements is powered by audio snippets released under Ireland's Freedom of Information Act 2014 by Irish Rail. These
          audio files were sourced from KeTech, who provided announcement systems for the majority of the UK railway network in the 2000s and
          2010s. KeTech acquired the audio from numerous predecessors, such as Amey and Ditra, who also provided railway announcement systems.
        </p>
        <p>
          You may not use the announcements on this site for any commercial purposes. Freedom of information does not change the rights of
          copyright holders, such as KeTech, and use of the information for commercial purposes could result in legal action.
        </p>

        <AnnouncementTabErrorBoundary systemId="AmeyLiveTrains" systemName="Amey Live Trains">
          <LiveTrainAnnouncements<keyof typeof systems>
            systems={systems}
            supportedPlatforms={supportedPlatforms}
            approachingTrainHandler={Object.entries(systems).reduce(
              (acc, [key, system]) => {
                acc[key] = system.playTrainApproachingAnnouncement.bind(system)
                return acc
              },
              {} as Record<keyof typeof systems, any>,
            )}
            nextTrainHandler={Object.entries(systems).reduce(
              (acc, [key, system]) => {
                acc[key] = system.playNextTrainAnnouncement.bind(system)
                return acc
              },
              {} as Record<keyof typeof systems, any>,
            )}
            standingTrainHandler={Object.entries(systems).reduce(
              (acc, [key, system]) => {
                acc[key] = system.playStandingTrainAnnouncement.bind(system)
                return acc
              },
              {} as Record<keyof typeof systems, any>,
            )}
            disruptedTrainHandler={Object.entries(systems).reduce(
              (acc, [key, system]) => {
                acc[key] = system.playDisruptedTrainAnnouncement.bind(system)
                return acc
              },
              {} as Record<keyof typeof systems, any>,
            )}
          />
        </AnnouncementTabErrorBoundary>
      </main>

      <Disclaimers />
    </Layout>
  )
}

export default AmeyTrainAnnouncementsPage
