import { atom } from 'recoil'
import { persistentAtom } from 'recoil-persistence/react'

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
