import TfWTelevic from '@announcement-data/systems/rolling-stock/TfWTelevic'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function TfWTelevicPage({ location }: PageProps) {
  return <SystemPageTemplate system={TfWTelevic} location={location} />
}
