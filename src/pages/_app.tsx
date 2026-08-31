import type { AppProps } from 'next/app'
import { AllTrainAnnouncementSystems } from '../announcement-data/AllSystems'
import '../styles/main.scss'
import '../components/AmeyLiveTrainAnnouncements.css'
import '../helpers/optionFields.scss'

if (typeof window !== 'undefined') {
  window.__audioDrivers = {}
  AllTrainAnnouncementSystems.forEach(system => (window.__audioDrivers![new system().ID] = system))
}

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
