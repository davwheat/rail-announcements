import React from 'react'

import { makeStyles } from '@material-ui/styles'
import getActiveSystem from '@helpers/getActiveSystem'
import type { CustomAnnouncementButton } from '@announcement-data/AnnouncementSystem'
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
  buttonList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
})

export interface ICustomButtonPaneProps {
  buttons: CustomAnnouncementButton[]
}

function CustomButtonPane({ buttons }: ICustomButtonPaneProps): JSX.Element {
  const classes = useStyles()

  const AnnouncementSystem = getActiveSystem()
  if (!AnnouncementSystem) return null

  const [isDisabled, setIsDisabled] = useIsPlayingAnnouncement()

  function createClickHandler(handler: () => Promise<void>): () => Promise<void> {
    return async () => {
      if (isDisabled) return
      setIsDisabled(true)
      await handler()
      setIsDisabled(false)
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
        <h3>Announcements</h3>

        {buttons.length === 0 && <p>No announcements available</p>}

        <div className={classes.buttonList}>
          {buttons.map(btn => (
            <button key={btn.label} disabled={isDisabled} onClick={createClickHandler(btn.onClick)}>
              {btn.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export default CustomButtonPane
