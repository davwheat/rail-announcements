import React from 'react'

import Layout from '@components/Layout'
import { Link } from 'gatsby'

function Error404Page({ location }): JSX.Element {
  return (
    <Layout location={location}>
      <header>
        <h1>Error 404 - Not found</h1>
      </header>
      <main>
        <p>Oh no! Looks like this page couldn't be found.</p>
        <Link to="/">Go to home page</Link>
      </main>
    </Layout>
  )
}

export default Error404Page
