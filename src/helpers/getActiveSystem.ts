import { AllTrainAnnouncementSystems } from '@announcement-data/AllSystems'
import { globalPersistentStateAtom } from '@atoms/globalStateAtom'
import { useRecoilValue } from 'recoil'

export default function getActiveSystem() {
  const globalState = useRecoilValue(globalPersistentStateAtom)

  return AllTrainAnnouncementSystems.find(sys => new sys().ID === globalState.systemId)
}
