import React, { useEffect } from 'react'

import LoadingSpinner from '@components/LoadingSpinner'
import { makeStyles } from '@material-ui/styles'
import getActiveSystem from '@helpers/getActiveSystem'
import createOptionField from '@helpers/createOptionField'
import type { OptionsExplanation } from '@announcement-data/AnnouncementSystem'
import useIsPlayingAnnouncement from '@helpers/useIsPlayingAnnouncement'

import * as Sentry from '@sentry/gatsby'

import PlayIcon from 'mdi-react/PlayIcon'
import PresetIcon from 'mdi-react/FolderTextOutlineIcon'
import DownloadIcon from 'mdi-react/DownloadIcon'

import clsx from 'clsx'
import { useRecoilState } from 'recoil'
import { tabStatesState } from '@atoms/index'

const useStyles = makeStyles({
  root: {
    padding: 16,
    backgroundColor: '#eee',
  },
  disabledMessage: {
    background: 'rgba(255, 0, 0, 0.15)',
    borderLeft: '#f00 4px solid',
    padding: '8px 16px',
  },
  optionsDisabled: {
    position: 'relative',
    '&::after': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '2em',
      content: '"Playing announcement..."',
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      left: 0,
      background: 'rgba(0, 0, 0, 0.25)',
      zIndex: 1,
    },
  },
  presets: {
    paddingBottom: 24,
    marginBottom: 24,
    borderBottom: '2px solid black',
  },
  presetButtonList: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
})

export interface ICustomAnnouncementPreset {
  name: string
  state: Record<string, unknown>
}

export interface ICustomAnnouncementPaneProps {
  options: Record<string, OptionsExplanation>
  playHandler: (options: { [key: string]: any }, download?: boolean) => Promise<void>
  name: string
  presets?: ICustomAnnouncementPreset[]
  systemId: string
  tabId: string
}

function CustomAnnouncementPane({ options, playHandler, name, presets, systemId, tabId }: ICustomAnnouncementPaneProps) {
  const classes = useStyles()

  const [playError, setPlayError] = React.useState<Error | null>(null)

  const [allTabStates, setAllTabStates] = useRecoilState(tabStatesState)
  const optionsState = allTabStates?.[tabId]

  const [isDisabled, setIsDisabled] = useIsPlayingAnnouncement()

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

  const AnnouncementSystemInstance = new AnnouncementSystem()

  function createFieldUpdater(field: string): (value) => void {
    return (value): void => {
      if (isDisabled) return

      setAllTabStates(prevState => ({ ...(prevState || {}), [tabId]: { ...(prevState?.[tabId] || {}), [field]: value } }))
    }
  }

  const playAnnouncement = React.useCallback(
    async function playAnnouncement() {
      if (isDisabled) return

      setIsDisabled(true)

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
        setPlayError(err)
      }

      setIsDisabled(false)
    },
    [isDisabled, playHandler, setIsDisabled, optionsState],
  )

  const downloadAnnouncement = React.useCallback(
    async function downloadAnnouncement() {
      if (isDisabled) return

      setIsDisabled(true)

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
        setPlayError(err)
      }

      setIsDisabled(false)
    },
    [isDisabled, playHandler, setIsDisabled, optionsState],
  )

  if (playError) {
    throw playError
  }

  if (!AnnouncementSystem) return null

  if (!optionsState) {
    return (
      <div className={classes.root}>
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
    <div className={classes.root}>
      {presets && (
        <section className={classes.presets}>
          <h3>Presets</h3>

          <div className={classes.presetButtonList}>
            {presets.map(preset => (
              <button
                key={preset.name}
                disabled={isDisabled}
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

      {isDisabled && (
        <p className={classes.disabledMessage}>
          <strong>All options are disabled while an announcement is playing.</strong>
        </p>
      )}

      <fieldset className={clsx(isDisabled && classes.optionsDisabled)}>
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

      <div className="buttonGroup">
        <button disabled={isDisabled} onClick={playAnnouncement}>
          <span className="buttonLabel">
            <PlayIcon />
            Play announcement
          </span>
        </button>
        <button disabled={isDisabled} onClick={downloadAnnouncement} className="iconButton" aria-label="Download announcement">
          <DownloadIcon />
        </button>
      </div>

      {isDisabled && <p style={{ marginTop: 8 }}>Assembling and playing announcement...</p>}
    </div>
  )
}

export default React.memo(CustomAnnouncementPane)
