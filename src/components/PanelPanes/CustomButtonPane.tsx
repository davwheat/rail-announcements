import { useMemo, useState } from 'react'

import useIsPlayingAnnouncement from '@helpers/useIsPlayingAnnouncement'
import DownloadIcon from 'mdi-react/DownloadIcon'
import PlayIcon from 'mdi-react/PlayIcon'

import { addBreadcrumb } from '@sentry/react'

import type { CustomAnnouncementButton } from '@announcement-data/AnnouncementSystem'
import type AnnouncementSystem from '@announcement-data/AnnouncementSystem'
export interface ICustomButtonPaneProps {
  buttons?: CustomAnnouncementButton[]
  buttonSections?: Record<string, CustomAnnouncementButton[]>
  system: typeof AnnouncementSystem
}

function CustomButtonPane({ system, buttons, buttonSections }: ICustomButtonPaneProps) {
  const [playError, setPlayError] = useState<Error | null>(null)

  const AnnouncementSystemInstance: AnnouncementSystem = useMemo(() => new (system as any)(), [system])

  const [isDisabled, setIsDisabled] = useIsPlayingAnnouncement()

  function createClickHandler(handler: () => Promise<void>, label: string, type: 'play' | 'download'): () => Promise<void> {
    return async () => {
      if (isDisabled) return
      setIsDisabled(true)

      addBreadcrumb({
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
      <div
        inert={isDisabled || undefined}
        data-scrim-message={isDisabled ? 'Playing announcement...' : undefined}
        css={{
          position: 'relative',
          '&[inert]::after': {
            content: 'attr(data-scrim-message)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2em',
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.25)',
            zIndex: 1,
          },
        }}
      >
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
    </div>
  )
}

export default CustomButtonPane
