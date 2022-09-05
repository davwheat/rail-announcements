/**
 * Implement Gatsby's Browser APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/browser-apis/
 */

import { AllTrainAnnouncementSystems } from '@announcement-data/AllSystems'
import './src/styles/main.less'

window.__audioDrivers = {}

AllTrainAnnouncementSystems.forEach(system => (window.__audioDrivers[new system().ID] = system))

export function onClientEntry() {
  if (process.env.NODE_ENV === 'production') {
    require(`preact/devtools`)
  }
}
