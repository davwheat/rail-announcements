import { useRecoilValue } from 'recoil'

import { AllAnnouncementSystems } from '@announcement-data/AllSystems'
import { globalPersistentStateAtom } from '@atoms/globalStateAtom'

import AnnouncementSystem from '@announcement-data/AnnouncementSystem'
import StationAnnouncementSystem from '@announcement-data/StationAnnouncementSystem'
import TrainAnnouncementSystem from '@announcement-data/TrainAnnouncementSystem'

export default function getActiveSystem(): (new () => TrainAnnouncementSystem | StationAnnouncementSystem | AnnouncementSystem) | null {
  const globalState = useRecoilValue(globalPersistentStateAtom)

  return AllAnnouncementSystems.find(sys => new sys().ID === globalState.systemId?.value) ?? null
}
