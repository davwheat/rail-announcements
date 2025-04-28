import { selectedTabIdsState, tabStatesState } from '@atoms/index'
import { SystemTabState } from '@data/SystemTabState'
import { SnackbarKey, useSnackbar } from 'notistack'
import { useEffect } from 'react'
import { useSetRecoilState } from 'recoil'
import { navigate } from 'gatsby'

const idToPath: Record<string, string> = {
  // Rolling stock
  TL_CLASS_700_V1: '/rolling-stock/class-700-707-717',
  SN_CLASS_377_V1: '/rolling-stock/bombardier-xstar',
  TFW_TRAINFX_V1: '/rolling-stock/tfw-trainfx',
  TFW_TELEVIC_V1: '/rolling-stock/tfw-televic',
  LNER_AZUMA_V1: '/rolling-stock/lner-azuma',
  AVANTI_WEST_COAST_PENDOLINO_V1: '/rolling-stock/avanti-west-coast-pendolino',
  WMT_CLASS_172_V1: '/rolling-stock/wmt-class-172',
  WMT_CLASS_323_V1: '/rolling-stock/wmt-class-323',

  TFL_ELIZ_LINE_V1: '/rolling-stock/tfl/elizabeth-line',
  TFL_JUBILEE_LINE_V1: '/rolling-stock/tfl/jubilee-line',
  TFL_NORTHERN_LINE_V1: '/rolling-stock/tfl/northern-line',

  // Stations
  AMEY_CELIA_V1: '/stations/amey-celia-drummond',
  AMEY_PHIL_V1: '/stations/amey-phil-sayer',
  SCOTRAIL_STN_V1: '/stations/scotrail',
}

export default function useSavedAnnouncementApiLoader() {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar()

  const setSelectedTabIds = useSetRecoilState(selectedTabIdsState)
  const setTabState = useSetRecoilState(tabStatesState)

  useEffect(() => {
    const url = new URL(window.location.href)
    const params = url.searchParams

    let key: SnackbarKey | null = null

    if (params.has('announcementId')) {
      console.log('Restoring state from URL by ID')
      key = enqueueSnackbar("One moment… We're loading your saved announcement.", { variant: 'info' })

      const id = params.get('announcementId')!

      ;(async function restoreStateFromApi() {
        const state = await SystemTabState.fromApi(id)

        if (state) {
          console.log('System ID', state.systemId)
          const path = idToPath[state.systemId]

          if (path) {
            if (url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1)

            // Navigate to correct system page, then let it load it
            if (path !== url.pathname) {
              console.log('Navigating to', `${path}${url.search}`)

              navigate(`${path}${url.search}`)
              return
            }

            console.log('Setting selected tab', state.tabId)
            console.log('Setting state', { [state.tabId]: state.state })

            setTabState({ [state.tabId]: state.state })
            setSelectedTabIds(prev => ({ ...prev, [state.systemId]: state.tabId }))

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

    return () => {
      if (key) {
        closeSnackbar(key)
      }
    }
  }, [])
}
