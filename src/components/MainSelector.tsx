import React, { useEffect } from 'react'

import { useRecoilState, useSetRecoilState } from 'recoil'
import { selectedSystemState, selectedTabIdsState, tabStatesState } from '@atoms'
import { AllAnnouncementSystems } from '@announcement-data/AllSystems'
import { SystemTabState } from '@data/SystemTabState'

import Select from 'react-select'
import { useSnackbar } from 'notistack'

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

  const { enqueueSnackbar } = useSnackbar()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.has('announcementId')) {
      console.log('Restoring state from URL by ID')

      const id = params.get('announcementId')!

      ;(async function restoreStateFromApi() {
        const state = await SystemTabState.fromApi(id)

        if (state) {
          const matchingSystem = options.find(opt => opt.value === state.systemId)
          console.log('Matching system', matchingSystem)

          if (matchingSystem) {
            console.log('Setting selected tab', state.tabId)
            console.log('Setting state', { [state.tabId]: state.state })

            setSelectedTabIds(prev => ({ ...prev, [matchingSystem.value]: state.tabId }))
            setTabState({ [state.tabId]: state.state })
            setSelectedSystem(matchingSystem)

            enqueueSnackbar("We've loaded your shared announcement options", { variant: 'success' })

            // Remove ID from URL
            params.delete('announcementId')

            window.history.replaceState({}, '', `${window.location.pathname}${params.size > 0 ? '?' : ''}${params.toString()}`)
          }
        } else {
          // Wipe state param
          const url = new URL(window.location.href)
          url.searchParams.delete('state')
          window.history.replaceState({}, '', url.toString())

          // Show error on next tick
          setTimeout(() =>
            alert(
              "We failed to load the shared announcement\n\nYou might have an incomplete or invalid URL, or the announcement system isn't available anymore or has changed significantly.",
            ),
          )
        }
      })().catch(err => {
        console.error(err)

        if (err instanceof Error) {
          alert(
            `We failed to load the shared announcement\n\nThe saved announcement may no longer be available, your internet connection may be down/patchy, or there was an error with the backend system.\n\nMessage: ${err.message}`,
          )
        }
      })
    }
  }, [])

  return (
    <div>
      <label htmlFor="system-select">
        Choose a system
        <Select<SystemOption, false>
          id="system-select"
          value={selectedSystem || { label: 'None', value: 'none' }}
          onChange={val => {
            setTabState(null)
            setSelectedSystem(val)
          }}
          options={options}
        />
      </label>
    </div>
  )
}

export default MainSelector
