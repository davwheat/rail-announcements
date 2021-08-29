import React from 'react'

import { makeStyles } from '@material-ui/styles'
import Tabs from './Tabs'
import getActiveSystem from '@helpers/getActiveSystem'

import ApproachingStationPane from './PanelPanes/ApproachingStation'
import StoppedAtStationPane from './PanelPanes/StoppedAtStation'

const TabPanels = [<ApproachingStationPane />, <StoppedAtStationPane />]

const useStyles = makeStyles({
  root: {
    padding: 16,
    backgroundColor: '#eee',
    marginTop: 24,
  },
  heading: {
    marginBottom: 16,
  },
})

function AnnouncementPanel(): JSX.Element {
  const classes = useStyles()
  const AnnouncementSystem = getActiveSystem()

  if (!AnnouncementSystem) return null

  const AnnouncementSystemInstance = new AnnouncementSystem()

  return (
    <div className={classes.root}>
      <h2 className={classes.heading}>{AnnouncementSystemInstance.NAME}</h2>

      <Tabs tabNames={['Approaching Station', 'Stopped at station']} tabItems={TabPanels} customKeyPrefix={AnnouncementSystemInstance.ID} />
    </div>
  )
}

export default AnnouncementPanel
