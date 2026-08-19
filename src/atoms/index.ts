import { atom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'
import { atomFamily } from 'jotai-family'

const ssrSafeLocalStorage = createJSONStorage<Record<string, string>>(() =>
  typeof window !== 'undefined' ? localStorage : ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage),
)

export const selectedTabIdsState = atomWithStorage<Record<string, string>>('selectedTabIds', {}, ssrSafeLocalStorage)

export const isPlayingAnnouncementState = atom<boolean>(false)

export interface IPisDisplayMessage {
  /** `null` holds whatever the display already shows, for audio that carries no display text. */
  text: string | null
  /** Milliseconds the message stays on the display before the next one replaces it. */
  duration: number
}

/**
 * Messages for a simulated passenger information display to step through, in step with the
 * announcement currently playing. Set as playback starts, and left in place afterwards so the
 * display holds its last message the way a real one does.
 */
export const pisDisplayState = atom<IPisDisplayMessage[] | null>(null)

/** Per-tab state atom. Key is `${systemId}::${tabId}`. Each tab subscribes only to its own atom. */
export const tabStateFamily = atomFamily((_stateKey: string) => atom<Record<string, unknown> | null>(null))
