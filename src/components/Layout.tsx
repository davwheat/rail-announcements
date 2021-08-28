import React from 'react'

// import Header from './PageComponents/Header'
// import Footer from './PageComponents/Footer'
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
  title: string
  description?: string
  location: LocationContext
}

const Layout: React.FC<Props> = ({ children, title, description, location }) => {
  const classes = useStyles()

  return (
    <ScrollContext location={location}>
      <RecoilRoot>
        {/* <ThemeProvider theme={theme}> */}
        <SEO title={title} description={description} />

        {/* <Header /> */}

        <main className={classes.mainContent}>{children}</main>

        {/* <Footer /> */}
        {/* </ThemeProvider> */}
      </RecoilRoot>
    </ScrollContext>
  )
}

export default Layout
