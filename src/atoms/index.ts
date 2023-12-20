import { AllAnnouncementSystems } from '@announcement-data/AllSystems'
import { atom } from 'recoil'
import { persistentAtom } from 'recoil-persistence/react'

export const selectedSystemState = persistentAtom<null | { label: string; value: string }>(
  {
    key: 'selectedSystem',
    default: null,
  },
  {
    validator: state => {
      if (typeof state !== 'object') return false

      if (
        !AllAnnouncementSystems.some(sys => {
          const system = new sys()
          const val = { value: system.ID, label: system.NAME }

          return JSON.stringify(val) === JSON.stringify(state)
        })
      ) {
        return false
      }

      return true
    },
  },
)

export const selectedTabIdsState = persistentAtom<Record<string, string> | null>(
  {
    key: 'selectedTabIds',
    default: {},
  },
  {
    validator: state => state !== null && typeof state === 'object',
  },
)

export const isPlayingAnnouncementState = atom<boolean>({
  key: 'isPlayingAnnouncement',
  default: false,
})

export const tabStatesState = atom<Record<string, Record<string, unknown>> | null>({
  key: 'tabStates',
  default: null,
})
