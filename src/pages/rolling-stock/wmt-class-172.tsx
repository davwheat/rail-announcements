import WMTClass172 from '@announcement-data/systems/rolling-stock/WMTClass172'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function WMTClass172Page({ location }: PageProps) {
  return <SystemPageTemplate system={WMTClass172} location={location} />
}
