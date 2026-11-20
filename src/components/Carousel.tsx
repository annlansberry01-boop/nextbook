import { useRef, useState } from 'react'
import type { Card } from '../lib/decks'
import { coverUrlFor } from '../lib/types'
import Cover from './Cover'
import './Carousel.css'

// Curved (concave) carousel geometry from the approved design: 7 covers, centre scaled up.
const XS = [0, 64, 108, 146]
const ZS = [0, 18, 40, 64]
const ROTS = [0, 14, 26, 34]
const BRIGHT = [1, 0.72, 0.5, 0.5]

export type SwipeDir = 'right' | 'left' | 'up'

type Props = {
  cards: Card[]
  centre: number
  done: Record<string, string>
  onCentre: (i: number) => void
  onSwipe: (dir: SwipeDir) => void
}

const DONE_MARK: Record<string, string> = { read: '✓', tbr: 'TBR', dnf: 'DNF', notread: '✕' }

export default function Carousel({ cards, centre, done, onCentre, onSwipe }: Props) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)

  const threshold = 60

  function end() {
    const d = drag
    start.current = null
    setDrag(null)
    if (!d) return
    if (d.y < -threshold && Math.abs(d.y) > Math.abs(d.x)) onSwipe('up')
    else if (d.x > threshold) onSwipe('right')
    else if (d.x < -threshold) onSwipe('left')
  }

  return (
    <div
      className="carousel"
      role="group"
      aria-roledescription="carousel"
      aria-label="Book carousel"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' && centre > 0) onCentre(centre - 1)
        if (e.key === 'ArrowRight' && centre < cards.length - 1) onCentre(centre + 1)
      }}
    >
      {[-3, -2, -1, 0, 1, 2, 3].map((o) => {
        const i = centre + o
        const card = cards[i]
        if (!card) return null
        const a = Math.abs(o)
        const sign = o < 0 ? -1 : 1
        const isCentre = o === 0
        const dx = isCentre && drag ? drag.x : 0
        const dy = isCentre && drag ? Math.min(0, drag.y) : 0
        const tilt = isCentre && drag ? drag.x / 12 : 0
        const transform =
          `translateX(${sign * XS[a] + dx}px) translateY(${dy}px) translateZ(${ZS[a]}px) rotateY(${-sign * ROTS[a]}deg)` +
          (isCentre ? ` scale(1.35) rotate(${tilt}deg)` : '')
        const mark = done[card.key]
        return (
          <button
            key={card.key}
            className={`carousel-card${isCentre ? ' centre' : ''}${drag && isCentre ? ' dragging' : ''}`}
            style={{ transform, zIndex: 10 - a, filter: `brightness(${BRIGHT[a]})` }}
            aria-label={isCentre ? `${card.title} by ${card.authors[0] ?? 'unknown'}, current card` : `Move to ${card.title}`}
            onClick={() => {
              if (moved.current) return
              if (!isCentre) onCentre(i)
            }}
            onPointerDown={(e) => {
              moved.current = false
              if (!isCentre) return
              start.current = { x: e.clientX, y: e.clientY }
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!isCentre || !start.current) return
              const d = { x: e.clientX - start.current.x, y: e.clientY - start.current.y }
              if (Math.hypot(d.x, d.y) > 6) moved.current = true
              setDrag(d)
            }}
            onPointerUp={end}
            onPointerCancel={() => {
              start.current = null
              setDrag(null)
            }}
          >
            <Cover book={{ title: card.title, authors: card.authors, cover_url: coverUrlFor(card.cover_id) }} width={80} small />
            {mark && <span className={`done-mark ${mark}`}>{DONE_MARK[mark]}</span>}
            {isCentre && drag && (
              <span className={`swipe-hint${Math.abs(drag.x) > threshold || drag.y < -threshold ? ' ready' : ''}`}>
                {drag.y < -threshold && Math.abs(drag.y) > Math.abs(drag.x) ? 'TBR' : drag.x > 20 ? 'Read it' : drag.x < -20 ? 'Not read' : ''}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
