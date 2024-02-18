import TfLJubileeLine from '@announcement-data/systems/rolling-stock/TfLJubileeLine'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function TfLJubileeLinePage({ location }: PageProps) {
  return <SystemPageTemplate system={TfLJubileeLine} location={location} />
}
