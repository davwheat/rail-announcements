import ScotRail from '@announcement-data/systems/stations/ScotRail'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function ScotRailStationsPage({ location }: PageProps) {
  return <SystemPageTemplate system={ScotRail} location={location} />
}
