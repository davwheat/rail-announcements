import React from 'react'

import { makeStyles } from '@material-ui/styles'
import getActiveSystem from '@helpers/getActiveSystem'
import type { CustomAnnouncementButton } from '@announcement-data/AnnouncementSystem'
import useIsPlayingAnnouncement from '@helpers/useIsPlayingAnnouncement'
import DownloadIcon from 'mdi-react/DownloadIcon'
import PlayIcon from 'mdi-react/PlayIcon'

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
            <div key={btn.label} className="buttonGroup">
              <button disabled={isDisabled} onClick={createClickHandler(btn.play)}>
                <span className="buttonLabel">
                  <PlayIcon />
                  {btn.label}
                </span>
              </button>
              <button disabled={isDisabled} onClick={createClickHandler(btn.download)} className="iconButton" aria-label="Download announcement">
                <DownloadIcon />
              </button>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export default CustomButtonPane
