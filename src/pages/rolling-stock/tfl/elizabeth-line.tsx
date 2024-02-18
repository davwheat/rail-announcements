import TfLElizabethLine from '@announcement-data/systems/rolling-stock/TfLElizabeth'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function TfLElizabethLinePage({ location }: PageProps) {
  return <SystemPageTemplate system={TfLElizabethLine} location={location} />
}
