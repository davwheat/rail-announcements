import TfWTrainFx from '@announcement-data/systems/rolling-stock/TfWTrainFx'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function TfWTrainFxPage({ location }: PageProps) {
  return <SystemPageTemplate system={TfWTrainFx} location={location} />
}
