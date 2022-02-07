import React from 'react'

import { makeStyles } from '@material-ui/styles'
import Tabs from './Tabs'
import getActiveSystem from '@helpers/getActiveSystem'
import AnnouncementTabErrorBoundary from './AnnouncementTabErrorBoundary'

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

  const AnnouncementSystemInstance = AnnouncementSystem ? new AnnouncementSystem() : null
  const customTabs = AnnouncementSystemInstance?.customAnnouncementTabs

  const TabPanels = React.useMemo(
    () =>
      !AnnouncementSystem
        ? null
        : Object.values(customTabs).map(({ component: TabComponent, ...opts }) => (
            <AnnouncementTabErrorBoundary key={opts.name} systemId={AnnouncementSystemInstance.ID} systemName={AnnouncementSystemInstance.NAME}>
              <TabComponent {...opts.props} name={opts.name} />
            </AnnouncementTabErrorBoundary>
          )),
    [customTabs, AnnouncementSystem],
  )

  if (!AnnouncementSystem) return null

  return (
    <div className={classes.root}>
      <h2 className={classes.heading}>{AnnouncementSystemInstance.NAME}</h2>

      <Tabs tabNames={Object.values(customTabs).map(tab => tab.name)} tabItems={TabPanels} customKeyPrefix={AnnouncementSystemInstance.ID} />
    </div>
  )
}

export default AnnouncementPanel
