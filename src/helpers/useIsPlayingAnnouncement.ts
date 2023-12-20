import { isPlayingAnnouncementState } from '@atoms'
import { useRecoilState } from 'recoil'

export default function useIsPlayingAnnouncement(): [boolean, (newVal: boolean) => void] {
  const [globalState, setGlobalState] = useRecoilState(isPlayingAnnouncementState)

  return [
    globalState,
    (newVal: boolean) => {
      setGlobalState(newVal)
    },
  ]
}
