import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BookSheet, { type SheetRequest } from '../components/BookSheet'
import Cover from '../components/Cover'
import Stars from '../components/Stars'
import { dateChoiceOf, describeDate, loadBookPage, saveBook, toast } from '../lib/actions'
import type { Reading } from '../lib/types'
import './BookPage.css'

type Data = Awaited<ReturnType<typeof loadBookPage>>

const FORMAT_LABEL = { print: 'Print', ebook: 'Ebook', audio: 'Audio' } as const

export default function BookPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<SheetRequest | null>(null)

  const refresh = useCallback(() => {
    loadBookPage(id).then(setData, (e: Error) => setError(e.message))
  }, [id])
  useEffect(refresh, [refresh])

  if (error) return <main className="screen"><div className="placeholder-card">Couldn't load this book: {error}</div></main>
  if (!data) return <main className="screen" />

  const { book, readings, onTbr } = data
  const latest = readings[0] ?? null
  const reads = readings.filter((r) => r.status === 'read')
  const open = (status: SheetRequest['status'], mode: SheetRequest['mode'], current: Reading | null = latest) =>
    setSheet({ book, current, status, mode })

  async function quick(status: 'reading' | 'tbr') {
    try {
      toast(await saveBook(book, { status, rating: null, liked: false, note: '', format: latest?.format ?? null, date: { precision: 'unknown' } }, latest))
      refresh()
    } catch (e) {
      toast(`Couldn't save: ${(e as Error).message}`)
    }
  }

  const statusLine =
    latest?.status === 'reading'
      ? 'Currently reading'
      : onTbr
        ? 'On your TBR'
        : latest?.status === 'dnf'
          ? 'Did not finish'
          : reads.length > 1
            ? `Read ${reads.length} times`
            : reads.length === 1
              ? 'Read'
              : 'Not in your books yet'

  const details = [book.year, book.page_count ? `${book.page_count} pages` : null].filter(Boolean).join(' · ')

  return (
    <main className="screen book-page">
      <header className="screen-header">
        <button className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </header>

      <section className="book-hero">
        <Cover book={book} width={140} />
        <div className="book-meta">
          <h1 className="book-title">{book.title}</h1>
          <div className="book-author">{book.authors.join(' & ')}</div>
          {details && <div className="book-details">{details}</div>}
          <div className="book-status">{statusLine}</div>
          {latest?.status === 'read' && latest.rating != null && <Stars rating={latest.rating} liked={latest.liked} size={18} />}
        </div>
      </section>

      <section className="book-actions">
        {latest?.status === 'reading' ? (
          <>
            <button className="btn-primary" onClick={() => open('read', 'finish')}>Finish and rate</button>
            <button className="btn-secondary" onClick={() => open('dnf', 'quick')}>DNF</button>
            <button className="btn-secondary" onClick={() => quick('tbr')}>Move to TBR</button>
          </>
        ) : reads.length > 0 ? (
          <>
            <button className="btn-primary" onClick={() => open('read', 'reread')}>Read again</button>
            <button className="btn-secondary" onClick={() => open('read', 'rate', reads[0])}>Edit</button>
            {!onTbr && <button className="btn-secondary" onClick={() => quick('tbr')}>Move to TBR</button>}
            <button className="btn-secondary" onClick={() => quick('reading')}>Reading now</button>
          </>
        ) : (
          <>
            <button className="btn-primary" onClick={() => quick('reading')}>Start reading</button>
            <button className="btn-secondary" onClick={() => open('read', 'rate', null)}>I've read it</button>
            {!onTbr && <button className="btn-secondary" onClick={() => quick('tbr')}>Add to TBR</button>}
            <button className="btn-secondary" onClick={() => open('dnf', 'quick', latest)}>DNF</button>
          </>
        )}
      </section>

      {readings.length > 0 && (
        <section className="home-section">
          <h2 className="section-label">Read history</h2>
          <div className="history">
            {readings.map((r) => (
              <button
                key={r.id}
                className="history-row"
                onClick={() => open(r.status === 'reading' ? 'read' : r.status, r.status === 'reading' ? 'finish' : 'rate', r)}
              >
                <div className="history-when">
                  {r.status === 'reading'
                    ? `Reading now${r.started_on ? `, since ${describeDate({ precision: 'exact', date: r.started_on })}` : ''}`
                    : describeDate(dateChoiceOf(r))}
                  {r.format && <span className="history-format"> · {FORMAT_LABEL[r.format]}</span>}
                </div>
                <div className="history-detail">
                  {r.status === 'read' && (r.rating != null ? <Stars rating={r.rating} liked={r.liked} /> : <span className="muted">Not rated yet</span>)}
                  {r.status === 'dnf' && <span className="muted">DNF{r.note ? `: ${r.note}` : ''}</span>}
                </div>
                {r.status === 'read' && r.note && <div className="history-note">“{r.note}”</div>}
              </button>
            ))}
          </div>
          <p className="feature-text" style={{ fontSize: 13 }}>Tap a read to edit it.</p>
        </section>
      )}

      {sheet && <BookSheet {...sheet} onClose={() => setSheet(null)} onSaved={refresh} />}
    </main>
  )
}
