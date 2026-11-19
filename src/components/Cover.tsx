import { useState } from 'react'
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

export default function Cover({ book, width, small }: Props) {
  const [failed, setFailed] = useState(false)
  const style =
    width === 'fluid'
      ? { width: '100%', height: 'auto', aspectRatio: '2 / 3' }
      : { width, height: Math.round(width * 1.5) }

  if (book.cover_url && !failed) {
    return (
      <img
        className="cover"
        style={style}
        src={book.cover_url}
        alt={`${book.title} cover`}
        loading="lazy"
        // Open Library returns a 1x1 image when it has no art; treat that as missing.
        onLoad={(e) => e.currentTarget.naturalWidth < 10 && setFailed(true)}
        onError={() => setFailed(true)}
      />
    )
  }

  const author = book.authors[0] ?? ''
  return (
    <div className={`cover placeholder${small ? ' small' : ''}`} style={{ ...style, background: colourFor(book.title) }} role="img" aria-label={`${book.title} by ${author}`}>
      <div className="ph-title">{book.title}</div>
      <div className="ph-author">{small ? author.split(' ').pop() : author}</div>
    </div>
  )
}
