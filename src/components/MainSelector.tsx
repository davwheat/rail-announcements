import React, { useEffect } from 'react'

import { useRecoilState, useSetRecoilState } from 'recoil'
import { selectedSystemState, selectedTabIdsState, tabStatesState } from '@atoms'
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
  const [selectedSystem, setSelectedSystem] = useRecoilState(selectedSystemState)
  const setSelectedTabIds = useSetRecoilState(selectedTabIdsState)
  const setTabState = useSetRecoilState(tabStatesState)


  return (
    <div>
      <label htmlFor="system-select">
        Choose a system
        <Select<SystemOption, false>
          id="system-select"
          value={selectedSystem || { label: 'None', value: 'none' }}
          onChange={val => {
            setSelectedSystem(val)
          }}
          options={options}
        />
      </label>
    </div>
  )
}

export default MainSelector
