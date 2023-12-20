import React, { useCallback } from 'react'

import { makeStyles } from '@material-ui/styles'
import Tabs from './Tabs'
import getActiveSystem from '@helpers/getActiveSystem'
import AnnouncementTabErrorBoundary from './AnnouncementTabErrorBoundary'

import { useRecoilState } from 'recoil'
import { selectedTabIdsState } from '@atoms'

const useStyles = makeStyles({
  root: {
    padding: 16,
    backgroundColor: '#eee',
    marginTop: 24,
  },
  heading: {
    marginBottom: 16,
  },
  instanceHeader: {
    marginBottom: 16,
  },
})

function AnnouncementPanel() {
  const classes = useStyles()
  const AnnouncementSystem = getActiveSystem()

  if (typeof window !== 'undefined') {
    window.__system = AnnouncementSystem
  }

  const AnnouncementSystemInstance = AnnouncementSystem ? new AnnouncementSystem() : null
  const customTabs = AnnouncementSystemInstance?.customAnnouncementTabs ?? {}

  const TabPanelMap = React.useMemo(
    () =>
      !AnnouncementSystem || !AnnouncementSystemInstance
        ? null
        : Object.entries(customTabs).reduce(
            (acc, [id, { component: TabComponent, ...opts }], i) => {
              acc[opts.name] = (
                <AnnouncementTabErrorBoundary
                  key={opts.name}
                  systemId={AnnouncementSystemInstance.ID}
                  systemName={AnnouncementSystemInstance.NAME}
                >
                  <TabComponent {...opts.props} name={opts.name} tabId={id} systemId={AnnouncementSystemInstance.ID} />
                </AnnouncementTabErrorBoundary>
              )

              return acc
            },
            {} as Record<string, React.ReactElement>,
          ),
    [customTabs, AnnouncementSystem, AnnouncementSystemInstance],
  )
  const TabPanels: React.ReactElement[] = Object.values(TabPanelMap ?? {})

  const [selectedTabIds, setSelectedTabIds] = useRecoilState(selectedTabIdsState)

  function getSelectedTab() {
    const tabId = selectedTabIds?.[AnnouncementSystemInstance?.ID ?? '']

    if (tabId) {
      const index = Object.keys(customTabs).findIndex(tab => tab === tabId)

      if (index !== -1) {
        return index
      }
    }

    return 0
  }

  const setSelectedTab = useCallback(
    (index: number) => {
      const tabName = Object.values(customTabs)[index].name

      setSelectedTabIds(prevState => ({
        ...(prevState || {}),
        [AnnouncementSystemInstance?.ID ?? '']: tabName,
      }))
    },
    [setSelectedTabIds],
  )

  if (!AnnouncementSystem) return null

  return (
    <div className={classes.root}>
      <h2 className={classes.heading}>{AnnouncementSystemInstance?.NAME}</h2>

      <div className={classes.instanceHeader}>{AnnouncementSystemInstance?.headerComponent()}</div>

      <Tabs
        selectedTabIndex={getSelectedTab()}
        onTabChange={setSelectedTab}
        tabNames={Object.values(customTabs).map(tab => tab.name)}
        tabItems={TabPanels ?? []}
        customKeyPrefix={AnnouncementSystemInstance?.ID}
      />
    </div>
  )
}

export default AnnouncementPanel
