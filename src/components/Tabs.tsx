import { makeStyles } from '@material-ui/styles'
import React from 'react'
import { Tab, Tabs as OGTabs, TabList, TabPanel } from 'react-tabs'
import Breakpoints from '@data/breakpoints'

interface TabProps {
  tabNames: string[]
  tabItems: React.ReactElement[]
}

const useStyles = makeStyles({
  nav: {
    display: 'grid',
    margin: 0,
    marginBottom: 16,

    gridTemplateColumns: 'repeat(auto-fit, minmax(10px, 1fr))',

    [Breakpoints.between.phone.and.bigPhone]: {
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: 'repeat(auto-fit, minmax(10px, 1fr))',
    },

    [Breakpoints.upTo.phone]: {
      gridTemplateColumns: '1fr',
      gridTemplateRows: 'repeat(auto-fit, minmax(10px, 1fr))',
    },
  },
  tab: {
    padding: 16,
    color: '#000',
    textAlign: 'center',
    fontWeight: 'bold',
    cursor: 'pointer',
    position: 'relative',

    [Breakpoints.upTo.phone]: {
      padding: 12,
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

    '&:focus-visible)': {
      // outline: '4px solid #999',
    },
  },
})

const Tabs: React.FC<TabProps> = ({ tabNames, tabItems }) => {
  const classes = useStyles()

  if (tabNames.length !== tabItems.length) {
    throw new Error('Different amount of tabNames and tabItems provided.')
  }

  return (
    <OGTabs>
      <TabList className={classes.nav}>
        {tabNames.map(name => (
          <Tab key={name} className={classes.tab}>
            {name}
          </Tab>
        ))}
      </TabList>

      {tabItems.map((tab, i) => (
        <TabPanel key={tabNames[i]}>{tab}</TabPanel>
      ))}
    </OGTabs>
  )
}

export default Tabs
