import { AllAnnouncementSystems } from '@announcement-data/AllSystems'
import { atom } from 'recoil'
import { persistentAtom } from 'recoil-persistence/react'

interface GlobalPersistState {
  systemId: null | { label: string; value: string }
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
      if (typeof state.systemId !== 'object') return false

      if (
        !AllAnnouncementSystems.some(sys => {
          const system = new sys()
          const val = { value: system.ID, label: system.NAME }

          return JSON.stringify(val) === JSON.stringify(state.systemId)
        })
      )
        return false

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
