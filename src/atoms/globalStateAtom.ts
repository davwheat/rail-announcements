import { AllAnnouncementSystems } from '@announcement-data/AllSystems'
import { atom } from 'recoil'
import { persistentAtom } from 'recoil-persistence/react'

interface GlobalPersistState {
  systemId: null | string
}

interface GlobalState {
  isPlayingAnnouncement: boolean
}

export const globalPersistentStateAtom = persistentAtom<GlobalPersistState>(
  {
    key: 'globalPersistentState',
    default: {
      systemId: null,
    },
  },
  {
    validator: state => {
      if (!AllAnnouncementSystems.some(sys => new sys().ID === state.systemId)) return false

      return true
    },
  },
)

export const globalStateAtom = atom<GlobalState>({
  key: 'globalState',
  default: {
    isPlayingAnnouncement: false,
  },
})
