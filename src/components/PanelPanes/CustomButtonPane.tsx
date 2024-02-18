import { useState } from 'react'

import getActiveSystem from '@helpers/getActiveSystem'
import useIsPlayingAnnouncement from '@helpers/useIsPlayingAnnouncement'
import DownloadIcon from 'mdi-react/DownloadIcon'
import PlayIcon from 'mdi-react/PlayIcon'

import * as Sentry from '@sentry/react'

import type { CustomAnnouncementButton } from '@announcement-data/AnnouncementSystem'
export interface ICustomButtonPaneProps {
  buttons?: CustomAnnouncementButton[]
  buttonSections?: Record<string, CustomAnnouncementButton[]>
}

function CustomButtonPane({ buttons, buttonSections }: ICustomButtonPaneProps) {
  const [playError, setPlayError] = useState<Error | null>(null)

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

  buttonSections ||= {}

  if (buttons?.length) {
    if ('Announcements' in buttonSections && Array.isArray(buttonSections.Announcements)) {
      buttonSections.Announcements.push(...buttons)
    } else {
      buttonSections.Announcements = buttons
    }
  }

  return (
    <div
      css={{
        padding: 24,
        backgroundColor: '#eee',
      }}
    >
      {isDisabled && (
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

      {Object.entries(buttonSections).map(([sectionName, sectionButtons]) => (
        <fieldset key={sectionName}>
          <h3>{sectionName}</h3>

          {sectionButtons?.length === 0 && <p>No announcements available</p>}

          <div
            css={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {sectionButtons?.map?.((btn: any) => {
              if (btn.files) {
                btn.play ||= () => AnnouncementSystemInstance.playAudioFiles(btn.files!!)
                btn.download ||= () => AnnouncementSystemInstance.playAudioFiles(btn.files!!, true)
              }

              return (
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
                    className="icon"
                    aria-label="Download announcement"
                  >
                    <DownloadIcon />
                  </button>
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

export default CustomButtonPane
