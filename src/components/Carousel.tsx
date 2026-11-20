import { useEffect, useRef, useState } from 'react'
import type { Card } from '../lib/decks'
import { coverUrlFor } from '../lib/types'
import Cover from './Cover'
import './Carousel.css'

// Curved (concave) carousel geometry from the approved design: 7 covers, centre scaled up.
const XS = [0, 64, 108, 146]
const ZS = [0, 18, 40, 64]
const ROTS = [0, 14, 26, 34]
const BRIGHT = [1, 0.72, 0.5, 0.5]

type Props = {
  cards: Card[]
  centre: number
  done: Record<string, string>
  onCentre: (i: number) => void
  /** Swipe up on the centre cover. */
  onSwipeUp: () => void
}

const DONE_MARK: Record<string, string> = { read: '✓', tbr: 'TBR', dnf: 'DNF', notread: '✕' }
const STEP_PX = 60 // how far a swipe moves per cover
const UP_PX = 60

/**
 * Swipe left or right anywhere on the carousel to browse (like flicking along a shelf),
 * or tap a side cover to bring it to the centre. Swipe the centre cover up to add it to the TBR.
 */
export default function Carousel({ cards, centre, done, onCentre, onSwipeUp }: Props) {
  const [drag, setDrag] = useState<{ x: number; y: number; onCentre: boolean } | null>(null)
  // Size: the design is drawn for a 390px-wide phone. Wider screens scale it up, to 1.6x at most.
  const box = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setK(Math.max(1, Math.min(1.6, el.clientWidth / 390)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const start = useRef<{ x: number; y: number; onCentre: boolean } | null>(null)
  const moved = useRef(false)

  const clamp = (i: number) => Math.max(0, Math.min(cards.length - 1, i))
  const vertical = (d: { x: number; y: number }) => Math.abs(d.y) > Math.abs(d.x)

  // The latest drag position, kept in a ref so the end of a swipe never reads a stale value.
  const dragRef = useRef<{ x: number; y: number; onCentre: boolean } | null>(null)

  function end() {
    const d = dragRef.current
    dragRef.current = null
    start.current = null
    setDrag(null)
    if (!d) return
    if (d.onCentre && vertical(d) && d.y < -UP_PX) return onSwipeUp()
    if (!vertical(d) && Math.abs(d.x) > 30) {
      const steps = Math.max(1, Math.min(3, Math.round(Math.abs(d.x) / STEP_PX)))
      onCentre(clamp(centre + (d.x < 0 ? steps : -steps)))
    }
  }

  // While dragging sideways the whole curve follows the finger a little.
  const shift = drag && !vertical(drag) ? Math.max(-90, Math.min(90, drag.x * 0.5)) : 0
  const lift = drag && drag.onCentre && vertical(drag) ? Math.min(0, drag.y) : 0

  return (
    <div
      ref={box}
      className={`carousel${drag ? ' dragging' : ''}`}
      style={{ height: 230 * k, perspective: `${640 * k}px` }}
      role="group"
      aria-roledescription="carousel"
      aria-label="Book carousel. Swipe or tap a side cover to browse."
      onPointerDown={(e) => {
        moved.current = false
        const onCentreCard = !!(e.target as HTMLElement).closest('.carousel-card.centre')
        start.current = { x: e.clientX, y: e.clientY, onCentre: onCentreCard }
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        const d = { x: e.clientX - start.current.x, y: e.clientY - start.current.y, onCentre: start.current.onCentre }
        // Only take over the pointer once it's clearly a swipe, so a simple tap still clicks a cover.
        if (!moved.current && Math.hypot(d.x, d.y) > 6) {
          moved.current = true
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* not essential: the swipe still works without capture */
          }
        }
        if (moved.current) {
          dragRef.current = d
          setDrag(d)
        }
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        start.current = null
        dragRef.current = null
        setDrag(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onCentre(clamp(centre - 1))
        if (e.key === 'ArrowRight') onCentre(clamp(centre + 1))
      }}
    >
      {[-3, -2, -1, 0, 1, 2, 3].map((o) => {
        const i = centre + o
        const card = cards[i]
        if (!card) return null
        const a = Math.abs(o)
        const sign = o < 0 ? -1 : 1
        const isCentre = o === 0
        const transform =
          `translateX(${sign * XS[a] * k + shift}px) translateY(${isCentre ? lift : 0}px) translateZ(${ZS[a] * k}px) rotateY(${-sign * ROTS[a]}deg)` +
          (isCentre ? ' scale(1.35)' : '')
        const mark = done[card.key]
        return (
          <button
            key={card.key}
            className={`carousel-card${isCentre ? ' centre' : ''}`}
            style={{
              transform,
              zIndex: 10 - a,
              filter: `brightness(${BRIGHT[a]})`,
              width: 80 * k,
              height: 120 * k,
              margin: `${-60 * k}px 0 0 ${-40 * k}px`,
            }}
            aria-label={isCentre ? `${card.title} by ${card.authors[0] ?? 'unknown'}, current card` : `Move to ${card.title}`}
            onClick={() => {
              if (moved.current) return
              if (!isCentre) onCentre(i)
            }}
          >
            <Cover book={{ title: card.title, authors: card.authors, cover_url: coverUrlFor(card.cover_id) }} width={Math.round(80 * k)} small={k < 1.3} />
            {mark && <span className={`done-mark ${mark}`}>{DONE_MARK[mark]}</span>}
            {isCentre && lift < -20 && <span className={`swipe-hint${lift < -UP_PX ? ' ready' : ''}`}>TBR</span>}
          </button>
        )
      })}
    </div>
  )
}
