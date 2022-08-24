import React, { useCallback } from 'react'

import { makeStyles } from '@material-ui/styles'
import Tabs from './Tabs'
import getActiveSystem from '@helpers/getActiveSystem'
import AnnouncementTabErrorBoundary from './AnnouncementTabErrorBoundary'

import useStateWithLocalStorage from '@hooks/useStateWithLocalStorage'

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

  const [_selectedTab, _setSelectedTab] = useStateWithLocalStorage<Record<string, number>>('selectedSystemTabs', {}, tabs => {
    if (typeof tabs !== 'object' || tabs === null) return false

    if (!Object.values(tabs).every(i => typeof i === 'number')) return false

    return true
  })

  function getSelectedTab() {
    return _selectedTab?.[AnnouncementSystemInstance.ID] || 0
  }

  const setSelectedTab = useCallback(
    (index: number) => {
      _setSelectedTab(s => ({
        ...s,
        [AnnouncementSystemInstance.ID]: index,
      }))
    },
    [_setSelectedTab],
  )

  if (!AnnouncementSystem) return null

  return (
    <div className={classes.root}>
      <h2 className={classes.heading}>{AnnouncementSystemInstance.NAME}</h2>

      <Tabs
        selectedTabIndex={getSelectedTab()}
        onTabChange={setSelectedTab}
        tabNames={Object.values(customTabs).map(tab => tab.name)}
        tabItems={TabPanels}
        customKeyPrefix={AnnouncementSystemInstance.ID}
      />
    </div>
  )
}

export default AnnouncementPanel
