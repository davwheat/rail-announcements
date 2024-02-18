import BombardierXstar from '@announcement-data/systems/rolling-stock/BombardierXstar'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function BombardierXstarPage({ location }: PageProps) {
  return <SystemPageTemplate system={BombardierXstar} location={location} />
}
