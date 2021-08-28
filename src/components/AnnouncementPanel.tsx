import React from 'react'

import { makeStyles } from '@material-ui/styles'
import Tabs from './Tabs'
import getActiveSystem from '@helpers/getActiveSystem'
import ApproachingStation from './PanelPanes/ApproachingStation'

const useStyles = makeStyles({
  root: {
    padding: 16,
    backgroundColor: '#eee',
    marginTop: 24,
  },
})

function AnnouncementPanel(): JSX.Element {
  const classes = useStyles()
  const AnnouncementSystem = getActiveSystem()

  if (!AnnouncementSystem) return null

  const AnnouncementSystemInstance = new AnnouncementSystem()

  return (
    <div className={classes.root}>
      <h2>{AnnouncementSystemInstance.NAME}</h2>

      <Tabs tabNames={['Approaching Station', 'Stopped at station']} tabItems={[<ApproachingStation />, <ApproachingStation />]} />
    </div>
  )
}

export default AnnouncementPanel
