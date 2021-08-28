import { AllTrainAnnouncementSystems } from '@announcement-data/AllSystems'
import { globalStateAtom } from '@atoms/globalStateAtom'
import { useRecoilValue } from 'recoil'

export default function getActiveSystem() {
  const globalState = useRecoilValue(globalStateAtom)

  return AllTrainAnnouncementSystems.find(sys => new sys().ID === globalState.systemId)
}
