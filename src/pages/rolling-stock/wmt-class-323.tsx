import WMTClass323 from '@announcement-data/systems/rolling-stock/WMTClass323'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function WMTClass323Page({ location }: PageProps) {
  return <SystemPageTemplate system={WMTClass323} location={location} />
}
