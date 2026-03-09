import type { AppProps } from 'next/app'
import type AnnouncementSystem from '../announcement-data/AnnouncementSystem'
import { AllTrainAnnouncementSystems } from '../announcement-data/AllSystems'
import '../styles/main.scss'
import '../components/AmeyLiveTrainAnnouncements.css'
import '../helpers/optionFields.scss'

type ConcreteAnnouncementSystem = new () => AnnouncementSystem

if (typeof window !== 'undefined') {
  window.__audioDrivers = {}
  AllTrainAnnouncementSystems.forEach(system => (window.__audioDrivers![new (system as unknown as ConcreteAnnouncementSystem)().ID] = system))
}

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
