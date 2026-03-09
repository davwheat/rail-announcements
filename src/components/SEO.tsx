import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

const SITE_TITLE = 'UK Rail Announcement Generator'
const SITE_DESCRIPTION = 'Generate various station and on-train announcements for the UK rail network using real audio recordings.'
const SITE_URL = 'https://www.railannouncements.co.uk'
const OG_IMAGE = `${SITE_URL}/images/logo.png`

type MetaEntry = {
  name: string
  content: string
}

interface Props {
  description?: string
  title?: string
  meta?: MetaEntry[]
}

const SEO: React.FC<Props> = ({ description, title, meta }) => {
  const router = useRouter()
  const metaDescription = description || SITE_DESCRIPTION
  const formattedTitle = title ? `${title} | ${SITE_TITLE}` : SITE_TITLE
  const canonicalUrl = `${SITE_URL}${router.asPath.split('?')[0]}`

  return (
    <Head>
      <title>{formattedTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:title" content={formattedTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:site_name" content={SITE_TITLE} />

      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={formattedTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:creator" content="@davwheat_" />
      <meta name="twitter:image" content={OG_IMAGE} />

      {meta && meta.map((m, i) => <meta key={`${m.name}--${i}`} name={m.name} content={m.content} />)}
    </Head>
  )
}

export default SEO
