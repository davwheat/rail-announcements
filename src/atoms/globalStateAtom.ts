import { atom } from 'recoil'

interface GlobalState {
  systemId: null | string
}

export const globalStateAtom = atom<GlobalState>({
  key: 'globalState',
  default: {
    systemId: null,
  },
})
