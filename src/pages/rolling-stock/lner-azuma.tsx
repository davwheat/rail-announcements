import LnerAzuma from '@announcement-data/systems/rolling-stock/LNERAzuma'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function LnerAzumaPage({ location }: PageProps) {
  return <SystemPageTemplate system={LnerAzuma} location={location} />
}
