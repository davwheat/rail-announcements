import { isPlayingAnnouncementState } from '@atoms'
import { useAtom } from 'jotai'

export default function useIsPlayingAnnouncement(): [boolean, (newVal: boolean) => void] {
  const [globalState, setGlobalState] = useAtom(isPlayingAnnouncementState)

  return [
    globalState,
    (newVal: boolean) => {
      setGlobalState(newVal)
    },
  ]
}
