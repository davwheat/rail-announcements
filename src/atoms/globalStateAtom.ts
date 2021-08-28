import { persistentAtom } from 'recoil-persistence/react'

interface GlobalState {
  systemId: null | string
}

export const globalStateAtom = persistentAtom<GlobalState>({
  key: 'globalState',
  default: {
    systemId: null,
  },
})
