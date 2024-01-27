import React, { useEffect } from 'react'

import LoadingSpinner from '@components/LoadingSpinner'
import getActiveSystem from '@helpers/getActiveSystem'
import createOptionField from '@helpers/createOptionField'
import useIsPlayingAnnouncement from '@helpers/useIsPlayingAnnouncement'

import * as Sentry from '@sentry/gatsby'

import PlayIcon from 'mdi-react/PlayIcon'
import ShareIcon from 'mdi-react/ShareVariantIcon'
import SaveIcon from 'mdi-react/ContentSaveIcon'
import PresetIcon from 'mdi-react/TextIcon'
import PersonalPresetIcon from 'mdi-react/TextAccountIcon'
import ReloadIcon from 'mdi-react/ReloadIcon'
import DownloadIcon from 'mdi-react/DownloadIcon'
import TickIcon from 'mdi-react/CheckIcon'
import DeleteIcon from 'mdi-react/DeleteOutlineIcon'
import CopyIcon from 'mdi-react/ContentCopyIcon'

import { useRecoilState } from 'recoil'
import { tabStatesState } from '@atoms/index'
import { SystemTabState } from '@data/SystemTabState'

import copy from 'copy-to-clipboard'
import { enqueueSnackbar, useSnackbar } from 'notistack'
import { v4 as uuid } from 'uuid'
import clsx from 'clsx'

import type { OptionsExplanation } from '@announcement-data/AnnouncementSystem'
import type { IPersonalPresetObject } from '@data/db'

export interface ICustomAnnouncementPreset<State = Record<string, unknown>> {
  name: string
  state: State
}

export interface ICustomAnnouncementPaneProps<OptionIds extends string> {
  options: Record<OptionIds, OptionsExplanation>
  playHandler: (options: { [key: string]: any }, download?: boolean) => Promise<void>
  name: string
  presets?: ICustomAnnouncementPreset[]
  systemId: string
  tabId: string
  isPersonalPresetsReady: boolean
  savePersonalPreset: (preset: IPersonalPresetObject) => Promise<void>
  getPersonalPresets: (systemId: string, tabId: string) => Promise<IPersonalPresetObject[]>
  deletePersonalPreset: (systemId: string, tabId: string, presetId: string) => Promise<void>
}

function CustomAnnouncementPane({
  options,
  playHandler,
  name,
  presets,
  systemId,
  tabId,
  isPersonalPresetsReady,
  savePersonalPreset,
  getPersonalPresets,
  deletePersonalPreset,
}: ICustomAnnouncementPaneProps<string>) {
  const { enqueueSnackbar } = useSnackbar()

  const [playError, setPlayError] = React.useState<Error | null>(null)
  const [isSharing, setIsSharing] = React.useState(false)
  const [personalPresets, setPersonalPresets] = React.useState<IPersonalPresetObject[] | null>(null)
  const [loadingPersonalPresets, setLoadingPersonalPresets] = React.useState(true)

  const [isPlayingAnnouncement, setIsPlayingAnnouncement] = useIsPlayingAnnouncement()
  const [allTabStates, setAllTabStates] = useRecoilState(tabStatesState)

  const optionsState = allTabStates?.[tabId]

  useEffect(() => {
    // Set default options if currently null
    if (!optionsState) {
      setAllTabStates(prevState => ({
        ...(prevState || {}),
        [tabId]: Object.entries(options).reduce((acc, [key, opt]) => {
          if (options[key].type === 'customNoState') return acc

          // @ts-expect-error
          acc[key] = opt.default

          return acc
        }, {}),
      }))
    }
  }, [optionsState])

  const AnnouncementSystem = getActiveSystem()
  const AnnouncementSystemInstance = new AnnouncementSystem!!()

  function createFieldUpdater(field: string): (value: any) => void {
    return (value): void => {
      if (isPlayingAnnouncement) return

      setAllTabStates(prevState => ({ ...(prevState || {}), [tabId]: { ...(prevState?.[tabId] || {}), [field]: value } }))
    }
  }

  const playAnnouncement = React.useCallback(
    async function playAnnouncement() {
      if (isPlayingAnnouncement) return

      setIsPlayingAnnouncement(true)

      Sentry.addBreadcrumb({
        category: 'announcement.play',
        data: {
          systemId: AnnouncementSystemInstance.ID,
          type: 'constructed',
          name,
          options: JSON.stringify(optionsState, null, 2),
        },
      })

      console.info('Playing announcement', name, optionsState)

      try {
        await playHandler(optionsState!!)
      } catch (err) {
        setPlayError(err as any)
      }

      setIsPlayingAnnouncement(false)
    },
    [isPlayingAnnouncement, playHandler, setIsPlayingAnnouncement, optionsState],
  )

  const downloadAnnouncement = React.useCallback(
    async function downloadAnnouncement() {
      if (isPlayingAnnouncement) return

      setIsPlayingAnnouncement(true)

      Sentry.addBreadcrumb({
        category: 'announcement.download',
        data: {
          systemId: AnnouncementSystemInstance.ID,
          type: 'constructed',
          name,
          options: JSON.stringify(optionsState, null, 2),
        },
      })

      console.info('Playing announcement', name, optionsState)

      try {
        await playHandler(optionsState!!, true)
      } catch (err) {
        setPlayError(err as any)
      }

      setIsPlayingAnnouncement(false)
    },
    [isPlayingAnnouncement, playHandler, setIsPlayingAnnouncement, optionsState],
  )

  const shareAnnouncement = React.useCallback(
    function shareAnnouncement() {
      setIsSharing(true)
      ;(async function () {
        const state = new SystemTabState(systemId, tabId, optionsState!!)

        console.log('Sharing announcement', state.toString())

        const id = await state.saveToApi()

        const url = new URL(window.location.href)
        url.searchParams.set('announcementId', id)

        copy(url.toString(), {
          format: 'text/plain',
          message: 'Copy the URL to share this announcement',
        })

        enqueueSnackbar('Copied sharable announcement URL to clipboard', { variant: 'success' })
      })()
        .catch(e => {
          Sentry.captureException(e)
          enqueueSnackbar('An error occurred while trying to share this announcement', { variant: 'error' })
          console.error(e)
        })
        .finally(() => setIsSharing(false))
    },
    [optionsState, systemId, tabId, setIsSharing, enqueueSnackbar],
  )

  const loadPersonalPresetsForTab = React.useCallback(
    async function getPersonalPresetsForTab() {
      setLoadingPersonalPresets(true)

      try {
        const presets = await getPersonalPresets(systemId, tabId)

        setPersonalPresets(presets)
      } catch (e) {
        console.error(e)
        Sentry.captureException(e)
      } finally {
        setLoadingPersonalPresets(false)
      }
    },
    [systemId, tabId, getPersonalPresets, setLoadingPersonalPresets],
  )

  const saveAnnouncementAsPersonalPreset = React.useCallback(
    function saveAnnouncementAsPersonalPreset() {
      const name = window.prompt('Enter a name for this preset')?.trim()

      if (name === null) return

      if (!name) {
        enqueueSnackbar("No name entered; preset can't be saved.", { variant: 'error' })
        return
      }

      ;(async function () {
        try {
          await savePersonalPreset({
            name,
            presetId: uuid(), // pray it won't collide
            systemId,
            tabId,
            state: optionsState!!,
          })

          enqueueSnackbar('Saved as personal preset', { variant: 'success' })
          loadPersonalPresetsForTab()
        } catch (e) {
          console.error(e)
          enqueueSnackbar('An error occurred while trying to save this preset', { variant: 'error' })
          Sentry.captureException(e)
        }
      })()
    },
    [optionsState, systemId, tabId, enqueueSnackbar, savePersonalPreset, loadPersonalPresetsForTab],
  )

  useEffect(() => {
    if (isPersonalPresetsReady && personalPresets === null) {
      loadPersonalPresetsForTab()
    }
  }, [isPersonalPresetsReady, personalPresets, loadPersonalPresetsForTab])

  if (playError) {
    throw playError
  }

  if (!AnnouncementSystem) return null

  if (!optionsState) {
    return (
      <div
        css={{
          padding: 16,
          backgroundColor: '#eee',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 24,
            textAlign: 'center',
          }}
        >
          <LoadingSpinner />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      css={{
        padding: 16,
        backgroundColor: '#eee',
      }}
    >
      {presets && (
        <section
          css={{
            paddingBottom: 24,
            marginBottom: 24,
            borderBottom: '2px solid black',
          }}
        >
          <h3>Presets</h3>

          <div
            css={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {presets.length === 0 && <p>Sorry, no presets are available for this announcement.</p>}

            {presets.map(preset => (
              <button
                key={preset.name}
                disabled={isPlayingAnnouncement}
                onClick={() => {
                  setAllTabStates(prevState => ({ ...(prevState || {}), [tabId]: preset.state }))
                }}
              >
                <span className="buttonLabel">
                  <PresetIcon />
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section
        css={{
          paddingBottom: 24,
          marginBottom: 24,
          borderBottom: '2px solid black',
        }}
      >
        <div css={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '0.7rem' }}>
          <h3 css={{ margin: 0 }}>Personal presets</h3>
          <button className="outlined icon" onClick={loadPersonalPresetsForTab}>
            <ReloadIcon size={24} css={{ verticalAlign: 'middle' }} />
            <span className="sr-only">Reload</span>
          </button>
        </div>

        {!isPersonalPresetsReady || loadingPersonalPresets || !personalPresets ? (
          <div
            css={{
              alignSelf: 'center',
              justifySelf: 'center',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <LoadingSpinner />
            <p>Loading your personal presets&hellip;</p>
          </div>
        ) : (
          <div
            css={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {personalPresets.length === 0 && (
              <p css={{ marginTop: 8, marginBottom: 0 }}>You have no personal presets for this announcement type.</p>
            )}

            {personalPresets.map(preset => (
              <PersonalPresetButton
                key={preset.presetId}
                disabled={isPlayingAnnouncement}
                presetData={preset}
                onClick={() => setAllTabStates(prevState => ({ ...(prevState || {}), [tabId]: preset.state }))}
                onDelete={() => deletePersonalPreset(systemId, tabId, preset.presetId).finally(loadPersonalPresetsForTab)}
              />
            ))}
          </div>
        )}
      </section>

      {isPlayingAnnouncement && (
        <p
          css={{
            background: 'rgba(255, 0, 0, 0.15)',
            borderLeft: '#f00 4px solid',
            padding: '8px 16px',
          }}
        >
          <strong>All options are disabled while an announcement is playing.</strong>
        </p>
      )}

      <fieldset
        css={[
          (isPlayingAnnouncement || isSharing) && {
            position: 'relative',
            '&::after': {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2em',
              content: '"Please wait..."',
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              left: 0,
              background: 'rgba(0, 0, 0, 0.25)',
              zIndex: 1,
            },
          },
          isPlayingAnnouncement && {
            '&::after': {
              content: '"Playing announcement..."',
            },
          },
          isSharing && {
            '&::after': {
              content: '"Sharing announcement..."',
            },
          },
        ]}
      >
        <h3>Options</h3>

        {Object.keys(options).length === 0 && <p>No options available</p>}

        <>
          {Object.entries(options)
            .map(([key, opt]) => {
              if (opt.onlyShowWhen && !opt.onlyShowWhen(optionsState)) return null

              return createOptionField(opt, { onChange: createFieldUpdater(key), value: optionsState[key], key, activeState: optionsState })
            })
            .filter(x => !!x)}
        </>
      </fieldset>

      <div css={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <div className="buttonGroup">
          <button disabled={isPlayingAnnouncement} onClick={playAnnouncement}>
            <span className="buttonLabel">
              <PlayIcon />
              Play announcement
            </span>
          </button>
          <button disabled={isPlayingAnnouncement} onClick={downloadAnnouncement} className="icon" aria-label="Download announcement">
            <DownloadIcon />
          </button>
        </div>

        <button className="outlined" onClick={shareAnnouncement} disabled={isSharing}>
          <span className="buttonLabel">
            <ShareIcon /> Copy sharable link to announcement
          </span>
        </button>

        <button className="outlined" onClick={saveAnnouncementAsPersonalPreset} disabled={isSharing}>
          <span className="buttonLabel">
            <SaveIcon /> Save as personal preset
          </span>
        </button>
      </div>

      {isPlayingAnnouncement && <p css={{ marginTop: 8 }}>Assembling and playing announcement...</p>}
    </div>
  )
}

export default React.memo(CustomAnnouncementPane)

interface IPersonalPresetButtonProps {
  presetData: IPersonalPresetObject
  onClick: () => void
  onDelete: () => void
  disabled: boolean
}

function PersonalPresetButton({ presetData, onClick, onDelete, disabled }: IPersonalPresetButtonProps) {
  const timeoutRef = React.useRef<number | null>(null)

  const [awaitingDeleteConfirmation, setAwaitingDeleteConfirmation] = React.useState(false)

  return (
    <div className="buttonGroup">
      <button disabled={disabled} onClick={() => onClick()} data-state={JSON.stringify(presetData.state)}>
        <span className="buttonLabel">
          <PersonalPresetIcon />
          {presetData.name}
        </span>
      </button>
      {process.env.NODE_ENV === 'development' && (
        <button
          className="icon outlined"
          disabled={disabled}
          onClick={() => {
            copy(JSON.stringify(presetData.state, null, 2), {
              format: 'text/plain',
              message: 'Copied preset state to clipboard',
            })
            enqueueSnackbar('Copied preset state to clipboard', { variant: 'success' })
          }}
        >
          <CopyIcon />
        </button>
      )}
      <button
        className={clsx('icon danger', { outlined: !awaitingDeleteConfirmation })}
        disabled={disabled}
        onClick={() => {
          if (!awaitingDeleteConfirmation) {
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
            setAwaitingDeleteConfirmation(true)
            timeoutRef.current = window.setTimeout(() => setAwaitingDeleteConfirmation(false), 5000)
          } else {
            // Confirming deletion
            onDelete()
          }
        }}
      >
        {awaitingDeleteConfirmation ? <TickIcon /> : <DeleteIcon />}
      </button>
    </div>
  )
}
