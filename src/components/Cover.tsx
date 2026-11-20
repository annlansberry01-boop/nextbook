import { useState } from 'react'
import { reportCoverFailure } from '../lib/coverStatus'
import type { Book } from '../lib/types'
import './Cover.css'

// Muted placeholder colours from the mockups.
const PALETTE = ['#7A2E2A', '#3E5A4A', '#8A5A1E', '#2F5C7A', '#5E6B3B', '#3B3A6B', '#4A3A2E', '#5A2E5C', '#2E4F5C', '#6B4A2A', '#7A6A1E', '#3A4A6B']

function colourFor(title: string) {
  let h = 0
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// width: a pixel width, or 'fluid' to fill the parent (e.g. a grid column) at book proportions.
type Props = { book: Pick<Book, 'title' | 'authors' | 'cover_url'>; width: number | 'fluid'; small?: boolean }

/**
 * The placeholder card (title and author on a muted colour) is always drawn first.
 * The real cover fades in on top once Open Library delivers it; while it's on its way
 * the card gently pulses. If the cover never arrives, the card simply stays.
 */
export default function Cover({ book, width, small }: Props) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(book.cover_url ? 'loading' : 'failed')
  const size =
    width === 'fluid'
      ? { width: '100%', aspectRatio: '2 / 3' }
      : { width, height: Math.round(width * 1.5) }
  const author = book.authors[0] ?? ''

  return (
    <div
      className={`cover placeholder${small ? ' small' : ''}${state === 'loading' ? ' loading' : ''}`}
      style={{ ...size, background: colourFor(book.title) }}
      role="img"
      aria-label={`${book.title} by ${author}`}
    >
      {state !== 'loaded' && (
        <>
          <div className="ph-title">{book.title}</div>
          <div className="ph-author">{small ? author.split(' ').pop() : author}</div>
        </>
      )}
      {book.cover_url && state !== 'failed' && (
        <img
          className={`cover-img${state === 'loaded' ? ' shown' : ''}`}
          src={book.cover_url}
          alt=""
          loading="lazy"
          onLoad={(e) => {
            // Open Library returns a 1x1 image when it has no art; keep the card.
            setState(e.currentTarget.naturalWidth < 10 ? 'failed' : 'loaded')
          }}
          onError={() => {
            setState('failed')
            reportCoverFailure()
          }}
        />
      )}
    </div>
  )
}
