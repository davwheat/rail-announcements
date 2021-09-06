import React, { useState } from 'react'

import { makeStyles } from '@material-ui/styles'
import getActiveSystem from '@helpers/getActiveSystem'
import type { CustomAnnouncementButton } from '@announcement-data/AnnouncementSystem'
import useIsPlayingAnnouncement from '@helpers/useIsPlayingAnnouncement'
import DownloadIcon from 'mdi-react/DownloadIcon'
import PlayIcon from 'mdi-react/PlayIcon'

import * as Sentry from '@sentry/react'

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

  const [playError, setPlayError] = useState<Error>(null)

  const AnnouncementSystem = getActiveSystem()
  if (!AnnouncementSystem) return null

  const AnnouncementSystemInstance = new AnnouncementSystem()

  const [isDisabled, setIsDisabled] = useIsPlayingAnnouncement()

  function createClickHandler(handler: () => Promise<void>, label: string, type: 'play' | 'download'): () => Promise<void> {
    return async () => {
      if (isDisabled) return
      setIsDisabled(true)

      Sentry.addBreadcrumb({
        category: `announcement.${type}`,
        data: {
          systemId: AnnouncementSystemInstance.ID,
          type: 'button',
          label,
        },
      })

      try {
        await handler()
      } catch (err) {}

      setIsDisabled(false)
    }
  }

  if (playError) {
    throw playError
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
              <button
                disabled={isDisabled}
                onClick={() =>
                  createClickHandler(btn.play, btn.label, 'play')().catch(e => {
                    setPlayError(e)
                  })
                }
              >
                <span className="buttonLabel">
                  <PlayIcon />
                  {btn.label}
                </span>
              </button>
              <button
                disabled={isDisabled}
                onClick={() =>
                  createClickHandler(btn.download, btn.label, 'download')().catch(e => {
                    setPlayError(e)
                  })
                }
                className="iconButton"
                aria-label="Download announcement"
              >
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
