import React from 'react'

import SEO from './SEO'

import { makeStyles } from '@material-ui/styles'

import type { LocationContext } from '@gatsbyjs/reach-router'
import { ScrollContext } from 'gatsby-react-router-scroll'
import { RecoilRoot } from 'recoil'

const useStyles = makeStyles({
  mainContent: {
    padding: 24,
  },
})

interface Props {
  description?: string
  location: LocationContext
}

const Layout: React.FC<Props> = ({ children, description, location }) => {
  const classes = useStyles()

  return (
    <ScrollContext location={location}>
      <RecoilRoot>
        <SEO description={description} />

        <main className={classes.mainContent}>{children}</main>
      </RecoilRoot>
    </ScrollContext>
  )
}

export default Layout
