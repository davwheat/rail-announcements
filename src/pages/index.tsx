import React from 'react'

import MainSelector from '@components/MainSelector'
import Layout from '@components/Layout'
import AnnouncementPanel from '@components/AnnouncementPanel'

function IndexPage({ location }): JSX.Element {
  return (
    <Layout title="Rail announcements" location={location}>
      <header>
        <h1>Rail announcements</h1>
      </header>
      <main>
        <MainSelector />
        <AnnouncementPanel />
      </main>
    </Layout>
  )
}

export default IndexPage
