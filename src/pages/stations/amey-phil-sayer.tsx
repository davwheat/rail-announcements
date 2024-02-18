import AmeyPhil from '@announcement-data/systems/stations/AmeyPhil'

import SystemPageTemplate from '@components/SystemPageTemplate'

import type { PageProps } from 'gatsby'

export default function AmeyPhilPage({ location }: PageProps) {
  return <SystemPageTemplate system={AmeyPhil} location={location} />
}
