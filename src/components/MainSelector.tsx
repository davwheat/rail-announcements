import React from 'react'

import { useRecoilState } from 'recoil'
import { globalPersistentStateAtom } from '@atoms/globalStateAtom'
import { AllAnnouncementSystems } from '@announcement-data/AllSystems'
import Select from 'react-select'

const allSystems = AllAnnouncementSystems.reduce(
  (acc, sys) => {
    const system = new sys()
    return [...acc, { value: system.ID, label: system.NAME }]
  },
  [] as { label: string; value: string }[],
)

const options = [{ label: 'None', value: 'none' }, ...allSystems]

interface SystemOption {
  readonly value: string
  readonly label: string
}

function MainSelector(): JSX.Element {
  const [globalState, setGlobalState] = useRecoilState(globalPersistentStateAtom)

  return (
    <div>
      <label htmlFor="system-select">
        Choose a system
        <Select<SystemOption, false>
          id="system-select"
          value={globalState.systemId || { label: 'None', value: 'none' }}
          onChange={val => {
            setGlobalState({ ...globalState, systemId: val })
          }}
          options={options}
        />
      </label>
    </div>
  )
}

export default MainSelector
