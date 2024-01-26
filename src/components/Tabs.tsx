import React from 'react'
import { Tabs as OGTabs, TabList, Tab, TabPanels, TabPanel } from '@reach/tabs'
import Breakpoints from '@data/breakpoints'

interface TabProps {
  tabNames: string[]
  tabItems: React.ReactElement[]
  customKeyPrefix?: string
  selectedTabIndex: number
  onTabChange?: (index: number) => void
}

const Tabs = React.memo(({ tabNames, tabItems, customKeyPrefix = '', selectedTabIndex, onTabChange }: TabProps) => {
  if (tabNames.length !== tabItems.length) {
    throw new Error('Different amount of tabNames and tabItems provided.')
  }

  return (
    <OGTabs
      index={selectedTabIndex}
      onChange={(index: number) => {
        onTabChange?.(index)
      }}
    >
      <TabList
        css={{
          display: 'grid',
          margin: 0,
          marginBottom: 16,

          gridTemplateColumns: 'repeat(auto-fit, minmax(10px, 1fr))',

          [Breakpoints.between.bigPhone.and.desktopSmall]: {
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: 'repeat(auto-fit, minmax(10px, 1fr))',
          },

          [Breakpoints.upTo.bigPhone]: {
            gridTemplateColumns: '1fr',
            gridTemplateRows: 'repeat(auto-fit, minmax(10px, 1fr))',
          },
        }}
      >
        {tabNames.map((name, i) => (
          <Tab
            key={`${i}__${name}`}
            className="native-button"
            css={{
              font: 'inherit',
              border: 'none',
              appearance: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              color: '#000',
              textAlign: 'center',
              fontWeight: 'bold',
              cursor: 'pointer',
              position: 'relative',

              [Breakpoints.upTo.bigPhone]: {
                padding: 8,
              },

              '&[aria-selected="true"]': {
                background: '#000',
                color: '#fff',
              },

              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              },
              '&:hover::after': {
                border: `2px solid #000`,
              },
            }}
          >
            <div>{name}</div>
          </Tab>
        ))}
      </TabList>

      <TabPanels>
        {tabItems.map((tab, i) => (
          <TabPanel key={`${customKeyPrefix}${tabNames[i]}`}>{tab}</TabPanel>
        ))}
      </TabPanels>
    </OGTabs>
  )
})

export default Tabs
