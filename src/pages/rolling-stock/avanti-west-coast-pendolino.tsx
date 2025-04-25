import AvantiPendolino from '@announcement-data/systems/rolling-stock/AvantiPendolino'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function AvantiPendolinoPage({ location }: PageProps) {
  return <SystemPageTemplate system={AvantiPendolino} location={location} />
}
