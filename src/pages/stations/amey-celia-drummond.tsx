import AmeyCelia from '@announcement-data/systems/stations/AmeyCelia'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function AmeyCeliaPage({ location }: PageProps) {
  return <SystemPageTemplate system={AmeyCelia} location={location} />
}
