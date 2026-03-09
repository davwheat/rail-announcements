import React from 'react'

import Layout from '@components/Layout'
import Link from 'next/link'
import NavBar from '@components/NavBar'

export default function Error404Page(): React.JSX.Element {
  return (
    <Layout title="Page not found">
      <header>
        <h1>Error 404 - Not found</h1>
      </header>

      <NavBar />

      <main>
        <p>Oh no! Looks like this page couldn't be found.</p>
        <Link href="/">Go to home page</Link>
      </main>
    </Layout>
  )
}
