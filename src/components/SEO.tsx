import React from 'react'

import { Title, Meta } from 'react-head'
import { useStaticQuery, graphql } from 'gatsby'

type MetaEntry = {
  name: string
  content: string
}

interface Props {
  description?: string
  meta?: MetaEntry[]
  title: string
}

const SEO: React.FC<Props> = ({ description, meta, title }) => {
  const { site } = useStaticQuery(
    graphql`
      query {
        site {
          siteMetadata {
            title
            description
            author
          }
        }
      }
    `,
  )

  const metaDescription = description || site.siteMetadata.description

  return (
    <>
      <Title>{title ? `${title} | ${site.siteMetadata.title}` : site.siteMetadata.title}</Title>
      <Meta name="description" content={metaDescription} />

      <Meta name="og:title" content={title} />
      <Meta name="og:description" content={metaDescription} />
      <Meta name="og:type" content="website" />

      <Meta name="twitter:card" content="summary" />
      <Meta name="twitter:title" content={title} />
      <Meta name="twitter:description" content={metaDescription} />
      <Meta name="twitter:creator" content="@davwheat" />

      {meta && meta.map((m, i) => <Meta key={`${m.name}--${i}`} name={m.name} content={m.content} />)}
    </>
  )
}

export default SEO
