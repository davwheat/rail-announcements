import { useRecoilValue } from 'recoil'

import { AllAnnouncementSystems } from '@announcement-data/AllSystems'
import { selectedSystemState } from '@atoms'

import AnnouncementSystem from '@announcement-data/AnnouncementSystem'
import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import TrainAnnouncementSystem from '@announcement-data/TrainAnnouncementSystem'

export default function getActiveSystem(): (new () => TrainAnnouncementSystem | StationAnnouncementSystem | AnnouncementSystem) | null {
  const selectedSystem = useRecoilValue(selectedSystemState)

  return AllAnnouncementSystems.find(sys => new sys().ID === selectedSystem?.value) ?? null
}
