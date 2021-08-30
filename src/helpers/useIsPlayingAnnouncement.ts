import { globalStateAtom } from '@atoms/globalStateAtom'
import { useRecoilState } from 'recoil'

export default function useIsPlayingAnnouncement(): [boolean, (newVal: boolean) => void] {
  const [globalState, setGlobalState] = useRecoilState(globalStateAtom)

  return [
    globalState.isPlayingAnnouncement,
    (newVal: boolean) => {
      setGlobalState(state => ({ ...state, isPlayingAnnouncement: newVal }))
    },
  ]
}
