import { atom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'
import { atomFamily } from 'jotai-family'

const ssrSafeLocalStorage = createJSONStorage<Record<string, string>>(() =>
  typeof window !== 'undefined' ? localStorage : ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage),
)

export const selectedTabIdsState = atomWithStorage<Record<string, string>>('selectedTabIds', {}, ssrSafeLocalStorage)

export const isPlayingAnnouncementState = atom<boolean>(false)

/** Per-tab state atom. Key is `${systemId}::${tabId}`. Each tab subscribes only to its own atom. */
export const tabStateFamily = atomFamily((_stateKey: string) => atom<Record<string, unknown> | null>(null))
