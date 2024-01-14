import React from 'react'

import SEO from './SEO'

import { makeStyles } from '@material-ui/styles'

import { ScrollContext } from 'gatsby-react-router-scroll'
import { RecoilRoot } from 'recoil'
import { SnackbarProvider } from 'notistack'

import type { LocationContext } from '@gatsbyjs/reach-router'

const useStyles = makeStyles({
  mainContent: {
    padding: 24,
  },
  footer: {
    padding: 24,
  },
})

interface Props {
  description?: string
  title?: string
  location: LocationContext
  children: React.ReactNode
}

const Layout: React.FC<Props> = ({ children, title, description, location }) => {
  const classes = useStyles()

  return (
    <ScrollContext location={location}>
      <RecoilRoot>
        <SnackbarProvider>
          <SEO title={title} description={description} />

          <main className={classes.mainContent}>{children}</main>

          <footer className={classes.footer}>
            <p>
              Made with love by{' '}
              <a href="https://davwheat.dev/" target="_blank">
                David Wheatley
              </a>
            </p>
            <p>
              <a href="https://github.com/davwheat/rail-announcements" target="_blank">
                This site is open source, and its code is available on GitHub.
              </a>
            </p>
          </footer>
        </SnackbarProvider>
      </RecoilRoot>
    </ScrollContext>
  )
}

export default Layout
