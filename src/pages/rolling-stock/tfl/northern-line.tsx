import TfLNorthernLine from '@announcement-data/systems/rolling-stock/TfLNorthernLine'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function TfLNorthernLinePage({ location }: PageProps) {
  return <SystemPageTemplate system={TfLNorthernLine} location={location} />
}
