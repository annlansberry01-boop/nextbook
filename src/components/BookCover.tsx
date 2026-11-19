import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Book } from '../lib/types'
import Cover from './Cover'

type Props = {
  book: Book
  width: number
  small?: boolean
  onLongPress: () => void
}

const HOLD_MS = 450

// A cover you can tap (opens the book page) or press and hold (opens the quick-action sheet).
export default function BookCover({ book, width, small, onLongPress }: Props) {
  const navigate = useNavigate()
  const timer = useRef<number | null>(null)
  const held = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }

  return (
    <button
      className="cover-btn"
      aria-label={`${book.title}. Tap to open, press and hold for quick actions`}
      onPointerDown={(e) => {
        held.current = false
        start.current = { x: e.clientX, y: e.clientY }
        timer.current = window.setTimeout(() => {
          held.current = true
          navigator.vibrate?.(10)
          onLongPress()
        }, HOLD_MS)
      }}
      onPointerMove={(e) => {
        // Scrolling the row cancels the hold.
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel()
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        // Right-click on a laptop does the same as press-and-hold.
        e.preventDefault()
        cancel()
        if (!held.current) onLongPress()
        held.current = true
      }}
      onClick={() => {
        if (held.current) return
        navigate(`/book/${book.id}`)
      }}
    >
      <Cover book={book} width={width} small={small} />
    </button>
  )
}
