import React from 'react'

import { makeStyles } from '@material-ui/styles'
import getActiveSystem from '@helpers/getActiveSystem'
import createOptionField from '@helpers/createOptionField'
import type { OptionsExplanation } from '@announcement-data/AnnouncementSystem'
import useIsPlayingAnnouncement from '@helpers/useIsPlayingAnnouncement'

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
})

export interface ICustomAnnouncementPaneProps {
  options: Record<string, OptionsExplanation>
  playHandler: (options: { [key: string]: any }) => Promise<void>
}

function CustomAnnouncementPane({ options, playHandler }: ICustomAnnouncementPaneProps): JSX.Element {
  const classes = useStyles()

  const AnnouncementSystem = getActiveSystem()
  if (!AnnouncementSystem) return null

  const [optionsState, setOptionsState] = React.useState<Record<string, unknown>>(
    Object.entries(options).reduce((acc, [key, opt]) => ({ ...acc, [key]: opt.default }), {}),
  )
  const [isDisabled, setIsDisabled] = useIsPlayingAnnouncement()

  function createFieldUpdater(field: string): (value) => void {
    return (value): void => {
      if (isDisabled) return

      setOptionsState(prevState => ({ ...prevState, [field]: value }))
    }
  }

  return (
    <div className={classes.root}>
      {isDisabled && (
        <p className={classes.disabledMessage}>
          <strong>All options are disabled while an announcement is playing.</strong>
        </p>
      )}
      <fieldset>
        <h3>Options</h3>

        {Object.keys(options).length === 0 && <p>No options</p>}

        <>
          {Object.entries(options).map(([key, opt]) =>
            createOptionField(opt, { onChange: createFieldUpdater(key), value: optionsState[key], key }),
          )}
        </>
      </fieldset>
      <button
        disabled={isDisabled}
        onClick={React.useCallback(async () => {
          if (isDisabled) return

          setIsDisabled(true)
          await playHandler(optionsState)
          setIsDisabled(false)
        }, [isDisabled, playHandler, setIsDisabled, optionsState])}
      >
        Play announcement
      </button>
    </div>
  )
}

export default CustomAnnouncementPane
