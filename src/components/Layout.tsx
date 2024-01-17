import React from 'react'

import SEO from './SEO'

import { ScrollContext } from 'gatsby-react-router-scroll'
import { RecoilRoot } from 'recoil'
import { SnackbarProvider } from 'notistack'

import type { WindowLocation } from '@gatsbyjs/reach-router'

interface Props {
  description?: string
  title?: string
  location: WindowLocation<unknown>
  children: React.ReactNode
}

const Layout: React.FC<Props> = ({ children, title, description, location }) => {
  return (
    <ScrollContext location={location}>
      <RecoilRoot>
        <SnackbarProvider>
          <SEO title={title} description={description} />

          <main
            css={{
              padding: 24,
            }}
          >
            {children}
          </main>

          <footer
            css={{
              padding: 24,
            }}
          >
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
