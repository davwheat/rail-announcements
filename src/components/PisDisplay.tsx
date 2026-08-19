import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { pisDisplayState } from '@atoms'
import { keyframes } from '@emotion/react'
import { useAtomValue } from 'jotai'

/** Advance width of “ThioThioThiockfosters” in the display face, which sets the screen's size. */
const SCREEN_WIDTH_EM = 12.3125

const SCROLL_SPEED_EM_PER_SECOND = 3.5
/** How much blank screen shows between a message leaving and coming back round. */
const PAUSE_BETWEEN_REPEATS_EM = 6
/** How long a message that fits the screen, and so never scrolls, stays up to be read. */
const MINIMUM_STATIC_MS = 5000

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const marquee = (start: number, period: number) =>
  keyframes({
    from: { transform: `translateX(${start}px)` },
    to: { transform: `translateX(${start - period}px)` },
  })

interface IScroll {
  /** Offset the message starts at, which puts it just beyond the right-hand edge. */
  start: number
  gap: number
  period: number
  seconds: number
}

interface IProps {
  /** Shown before anything has played. */
  idleText: string
  label: string
}

export default function PisDisplay({ idleText, label }: IProps) {
  const messages = useAtomValue(pisDisplayState)
  const [step, setStep] = useState(0)
  const [text, setText] = useState(idleText)
  const [scroll, setScroll] = useState<IScroll | null>(null)

  const viewportRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    setStep(0)
  }, [messages])

  useEffect(() => {
    const message = messages?.[step]

    if (message?.text != null) setText(message.text)
  }, [messages, step])

  // A message that scrolls stays until it has scrolled round once, so it is always read out in
  // full; one that fits the screen has no scroll to finish, so it stays up long enough to read
  // instead. Either way a message can outlast its own audio.
  //
  // An entry with no text of its own puts nothing new on the display, so it just waits out its
  // audio rather than holding the message already up there any longer.
  useEffect(() => {
    const message = messages?.[step]
    if (!message) return

    const minimumOnScreen = scroll ? scroll.seconds * 1000 : MINIMUM_STATIC_MS
    const hold = Math.max(message.duration, message.text === null ? 0 : minimumOnScreen)
    const timer = setTimeout(() => setStep(current => current + 1), hold)

    return () => clearTimeout(timer)
  }, [messages, step, scroll])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const copy = copyRef.current
    if (!viewport || !copy) return

    const reducedMotion = window.matchMedia(REDUCED_MOTION)

    function measure() {
      const screenWidth = viewport!.clientWidth

      if (copy!.offsetWidth <= screenWidth || reducedMotion.matches) {
        setScroll(null)
        return
      }

      // A trailing copy of the message follows one screen width plus the pause behind the first.
      // Scrolling by exactly that distance leaves the trailing copy where the first one started,
      // so the loop repeats without a jump, and the screen sits blank for the pause each time.
      const emSize = parseFloat(getComputedStyle(copy!).fontSize)
      const period = copy!.offsetWidth + screenWidth + PAUSE_BETWEEN_REPEATS_EM * emSize

      setScroll({
        start: screenWidth,
        gap: screenWidth + PAUSE_BETWEEN_REPEATS_EM * emSize,
        period,
        seconds: period / (SCROLL_SPEED_EM_PER_SECOND * emSize),
      })
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    reducedMotion.addEventListener('change', measure)

    return () => {
      observer.disconnect()
      reducedMotion.removeEventListener('change', measure)
    }
  }, [text])

  return (
    <figure
      css={{
        margin: 0,
        padding: 12,
        width: 'fit-content',
        background: 'linear-gradient(#2f2f2f, #151515)',
        borderRadius: 6,
        boxShadow: 'inset 0 0 0 1px #3d3d3d, 0 2px 8px rgba(0, 0, 0, 0.3)',
      }}
    >
      <figcaption className="sr-only">{label}</figcaption>

      <div
        ref={viewportRef}
        css={{
          // No horizontal padding: the lit area is exactly as wide as the screen it stands in for.
          padding: '10px 0',
          width: `${SCREEN_WIDTH_EM}em`,
          maxWidth: '100%',
          overflow: 'hidden',
          background: '#0b0b0b',
          borderRadius: 3,
          boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.9)',
          fontFamily: "'1995 Stock PIS Display', monospace",
          fontSize: 'clamp(1.05rem, 4.4vw, 2.25rem)',

          [`@media ${REDUCED_MOTION}`]: {
            overflowX: 'auto',
          },
        }}
      >
        <div
          role="status"
          css={{
            display: 'flex',
            width: 'max-content',
            minWidth: '100%',
            lineHeight: 1.3,
            whiteSpace: 'pre',
            color: '#ff9d1c',
            textShadow: '0 0 0.35em rgba(255, 157, 28, 0.45)',
            gap: scroll ? scroll.gap : undefined,
            justifyContent: scroll ? 'flex-start' : 'center',
            animation: scroll ? `${marquee(scroll.start, scroll.period)} ${scroll.seconds}s linear infinite` : undefined,
          }}
        >
          <span ref={copyRef} css={{ flexShrink: 0 }}>
            {text}
          </span>

          {scroll && (
            <span aria-hidden css={{ flexShrink: 0 }}>
              {text}
            </span>
          )}
        </div>
      </div>
    </figure>
  )
}
