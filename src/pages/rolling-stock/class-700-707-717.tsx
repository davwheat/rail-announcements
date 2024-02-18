import ThameslinkClass700 from '@announcement-data/systems/rolling-stock/TLClass700'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function Class700Page({ location }: PageProps) {
  return <SystemPageTemplate system={ThameslinkClass700} location={location} />
}
