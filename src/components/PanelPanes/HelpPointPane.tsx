import { useMemo, useState } from 'react'

import Select from 'react-select'
import { addBreadcrumb } from '@sentry/react'

import NoSSR from '@components/NoSSR'
import useIsPlayingAnnouncement from '@helpers/useIsPlayingAnnouncement'
import useStateWithLocalStorage from '@hooks/useStateWithLocalStorage'
import { renderHelpPoint, type HelpPointVoice } from '../../live/announcementService'

import type { AnnouncementSystemClass } from '@announcement-data/AnnouncementSystem'
import type { Option } from '@helpers/createOptionField'

export interface IHelpPointPaneProps {
  voice: HelpPointVoice
  stations: { title: string; value: string }[]
  system: AnnouncementSystemClass
}

const YELLOW = '#f4b400'
const INK = '#161616'
const POST = '#9aa2a5'

// "Press button", "for next train", "information", with blank cells for the spaces.
const BRAILLE_LINES = ['⠏⠗⠑⠎⠎⠀⠃⠥⠞⠞⠕⠝', '⠋⠕⠗⠀⠝⠑⠭⠞⠀⠞⠗⠁⠊⠝', '⠊⠝⠋⠕⠗⠍⠁⠞⠊⠕⠝']

function Braille() {
  return (
    <div
      aria-hidden
      css={{ fontSize: '7.4cqw', lineHeight: 1.2, fontWeight: 400, textAlign: 'center', color: '#a87900', WebkitTextStroke: '0.35cqw #a87900' }}
    >
      {BRAILLE_LINES.map(line => (
        <div key={line}>{line}</div>
      ))}
    </div>
  )
}

const GRILLE_RADIUS = 50
const GRILLE_PITCH = 7.6

function Grille() {
  const holes = useMemo(() => {
    const points: [number, number][] = []
    const rowHeight = (GRILLE_PITCH * Math.sqrt(3)) / 2
    const rows = Math.ceil(GRILLE_RADIUS / rowHeight)
    for (let row = -rows; row <= rows; row++) {
      const offset = row % 2 === 0 ? 0 : GRILLE_PITCH / 2
      for (let column = -rows; column <= rows; column++) {
        const x = column * GRILLE_PITCH + offset
        const y = row * rowHeight
        if (Math.hypot(x, y) <= GRILLE_RADIUS - 2) points.push([x, y])
      }
    }
    return points
  }, [])

  return (
    <svg
      viewBox={`${-GRILLE_RADIUS} ${-GRILLE_RADIUS} ${GRILLE_RADIUS * 2} ${GRILLE_RADIUS * 2}`}
      aria-hidden
      css={{
        display: 'block',
        width: '42%',
        margin: '0 auto',
      }}
    >
      {holes.map(([x, y]) => (
        <circle key={`${x}:${y}`} cx={x} cy={y} r={2.1} fill={INK} />
      ))}
    </svg>
  )
}

function Screw({ corner }: { corner: { top?: string; bottom?: string; left?: string; right?: string } }) {
  return (
    <span
      aria-hidden
      css={{
        position: 'absolute',
        ...corner,
        width: '5.5cqw',
        aspectRatio: '1',
        borderRadius: '50%',
        background: '#8b9296',
        border: '0.6cqw solid #5d6468',
      }}
    />
  )
}

function errorMessage(error: unknown): string {
  if ((error as { code?: string })?.code === 'unknown_station') {
    return 'The live train feed has no departure board for this station. Choose another station.'
  }
  return "The announcement service can't be reached. Check your connection, then press the button again."
}

function HelpPoint({ voice, stations, system }: IHelpPointPaneProps) {
  const announcementSystem = useMemo(() => new system(), [system])
  const [busy, setIsPlaying] = useIsPlayingAnnouncement()
  const [problem, setProblem] = useState<string | null>(null)
  const [selectedCrs, setSelectedCrs] = useStateWithLocalStorage('help-point.selected-crs', 'ECR', value =>
    stations.some(station => station.value === value),
  )

  const options = useMemo(() => stations.map(station => ({ value: station.value, label: station.title })), [stations])
  const station = options.find(option => option.value === selectedCrs) ?? options[0]

  async function press() {
    // A real help point ignores its button until it has finished speaking.
    if (busy) return

    setIsPlaying(true)
    setProblem(null)
    addBreadcrumb({ category: 'announcement.play', data: { systemId: announcementSystem.ID, type: 'help-point', station: station.value } })

    try {
      const mp3 = await renderHelpPoint(station.value, voice)
      await announcementSystem.playRenderedAudio(mp3)
    } catch (error) {
      console.warn('[HelpPointPane] The departure board could not be spoken:', error)
      setProblem(errorMessage(error))
    } finally {
      setIsPlaying(false)
    }
  }

  return (
    <div css={{ padding: 24, backgroundColor: '#eee' }}>
      <label className="option-select" htmlFor="help-point-station-select">
        Station
        <Select<Option, false>
          id="help-point-station-select"
          instanceId="help-point-station"
          value={station}
          onChange={value => setSelectedCrs(value!!.value)}
          options={options}
          isDisabled={busy}
        />
      </label>

      <div css={{ background: POST, padding: '32px 16px', display: 'flex', justifyContent: 'center' }}>
        <section
          aria-label="Information point"
          css={{
            containerType: 'inline-size',
            userSelect: 'none',
            position: 'relative',
            width: 'min(300px, 100%)',
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            fontWeight: 700,
            color: INK,
          }}
        >
          <div
            css={{
              position: 'relative',
              aspectRatio: '11 / 20',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '15cqw 8cqw 17cqw',
              borderRadius: '5cqw',
              background: YELLOW,
            }}
          >
            <Screw corner={{ top: '3.5cqw', left: '3.5cqw' }} />
            <Screw corner={{ top: '3.5cqw', right: '3.5cqw' }} />
            <Screw corner={{ bottom: '3.5cqw', left: '3.5cqw' }} />
            <Screw corner={{ bottom: '3.5cqw', right: '3.5cqw' }} />

            <h3 css={{ margin: 0, fontSize: '15.5cqw', lineHeight: 1.08, textAlign: 'center', letterSpacing: '-0.02em', color: 'inherit' }}>
              Information point
            </h3>

            <Grille />

            <div css={{ display: 'grid', gridTemplateColumns: '17cqw 22cqw 1fr', alignItems: 'center', columnGap: '2cqw' }}>
              <svg viewBox="0 0 40 40" aria-hidden css={{ display: 'block', width: '100%' }}>
                <circle cx={20} cy={20} r={20} fill={INK} />
                <circle cx={20} cy={9.5} r={4} fill={YELLOW} />
                <path d="M13 15h10.5v14.5H27V33H13v-3.5h3.5v-11H13z" fill={YELLOW} />
              </svg>

              <button
                type="button"
                className="native-button"
                onClick={press}
                aria-disabled={busy}
                aria-label={`Press for next train information from ${station.label}`}
                css={{
                  width: '100%',
                  aspectRatio: '1',
                  minHeight: 0,
                  margin: 0,
                  padding: 0,
                  borderRadius: '50%',
                  cursor: busy ? 'default' : 'pointer',
                  position: 'relative',
                  background: '#c4c9cc',
                  border: 'none',
                  // The ring is the button itself and the cap sits inside it, so a press moves only the cap.
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: '1.6cqw',
                    borderRadius: '50%',
                    background: 'conic-gradient(from 20deg, #f4f6f7, #9aa1a5, #eef0f1, #868d91, #f4f6f7, #a3aaae, #f4f6f7)',
                    boxShadow: 'inset 0 0 0 0.4cqw #6d7478',
                    transition: 'transform 80ms ease-out, box-shadow 80ms ease-out',
                  },
                  '&:active::before': {
                    transform: 'scale(0.94)',
                    boxShadow: 'inset 0 0 0 0.4cqw #6d7478, inset 0 0.8cqw 1.6cqw rgba(0, 0, 0, 0.45)',
                  },
                  '&:focus-visible': { outline: `3px solid ${INK}`, outlineOffset: 3 },
                }}
              />

              <span css={{ fontSize: '6.6cqw', lineHeight: 1.1 }}>Press for next train information</span>
            </div>

            <Braille />
          </div>
        </section>
      </div>

      {problem && (
        <p role="alert" css={{ marginTop: 16, marginBottom: 0 }}>
          {problem}
        </p>
      )}
    </div>
  )
}

// The station is remembered on the device, so the server can't render the one that the browser will.
export default function HelpPointPane(props: IHelpPointPaneProps) {
  return (
    <NoSSR>
      <HelpPoint {...props} />
    </NoSSR>
  )
}
