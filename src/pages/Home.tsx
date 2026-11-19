import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BookCover from '../components/BookCover'
import BookSheet, { type SheetRequest } from '../components/BookSheet'
import { PlusIcon, SearchIcon } from '../components/Icons'
import Stars from '../components/Stars'
import { fixCoversInBackground } from '../lib/covers'
import { allMyBooks, loadHome } from '../lib/data'
import { importSize, runImport } from '../lib/importLog'
import { supabase } from '../lib/supabase'
import './Home.css'

type HomeData = Awaited<ReturnType<typeof loadHome>>

const FORMAT_LABEL = { print: 'Print', ebook: 'Ebook', audio: 'Audio' } as const

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<SheetRequest | null>(null)

  const refresh = useCallback(() => {
    loadHome().then(setData, (e: Error) => setError(e.message))
  }, [])

  useEffect(refresh, [refresh])

  // Once your books are in, quietly swap any non-English covers for English ones.
  const hasBooks = !!data && !data.isEmpty
  useEffect(() => {
    if (!hasBooks) return
    allMyBooks().then((books) => fixCoversInBackground(books, refresh), () => {})
  }, [hasBooks, refresh])

  return (
    <main className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Next Book</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/search" className="icon-btn" aria-label="Search">
            <SearchIcon size={20} />
          </Link>
          <Link to="/search" className="icon-btn accent" aria-label="Add a book">
            <PlusIcon />
          </Link>
        </div>
      </header>

      {error && <div className="placeholder-card" role="alert">Couldn't load your books: {error}</div>}

      {data?.isEmpty && <ImportCard onDone={refresh} />}

      {data && !data.isEmpty && (
        <>
          {data.reading.length > 0 && (
            <section className="home-section">
              <h2 className="section-label">Currently reading</h2>
              {data.reading.map((r) => (
                <div key={r.id} className="reading-card">
                  <BookCover book={r.book} width={64} small onLongPress={() => setSheet({ book: r.book, current: r, status: 'reading', mode: 'quick' })} />
                  <div className="reading-info">
                    <div className="reading-title">{r.book.title}</div>
                    <div className="reading-author">{r.book.authors.join(' & ')}</div>
                    {r.format && <span className="chip">{FORMAT_LABEL[r.format]}</span>}
                  </div>
                  <button className="ghost-btn" onClick={() => setSheet({ book: r.book, current: r, status: 'read', mode: 'finish' })}>
                    Finish
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="feature-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 className="feature-title">What should I read next?</h2>
              <p className="feature-text">A quick mood check, then seven picks from your TBR and beyond.</p>
            </div>
            <Link to="/discover" className="feature-btn">
              Pick my next read
            </Link>
          </section>

          <Link to="/discover" className="swipe-prompt">
            <div className="swipe-stack" aria-hidden="true">
              <div style={{ left: 0, top: 8, background: '#3B4A5C', transform: 'rotate(-10deg)' }} />
              <div style={{ left: 20, top: 4, background: '#6B3A3A', transform: 'rotate(-2deg)' }} />
              <div style={{ left: 40, top: 6, background: '#4F5B3A', transform: 'rotate(8deg)' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div className="swipe-title">Remember what you've read</div>
              <div className="swipe-sub">Swipe through 15 books</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>

          {data.toCheck.length > 0 && (
            <section className="home-section">
              <h2 className="section-label">Check these ({data.toCheck.length})</h2>
              <div className="check-list">
                {data.toCheck.map((c) => (
                  <div key={c.id} className="check-row">
                    <div>
                      <div className="reading-title" style={{ fontSize: 14 }}>{c.raw_title}</div>
                      <div className="reading-author">{c.raw_author ?? 'Unknown author'}</div>
                    </div>
                    {c.rating != null && <Stars rating={c.rating} />}
                  </div>
                ))}
              </div>
              <p className="feature-text" style={{ fontSize: 13 }}>
                Open Library couldn't find these. You'll be able to search and match them soon.
              </p>
            </section>
          )}

          {data.tbr.length > 0 && (
            <section className="home-section">
              <div className="row-head">
                <h2 className="section-label">TBR</h2>
                <Link to="/books" className="row-link">See all</Link>
              </div>
              <div className="cover-row">
                {data.tbr.map((s) => (
                  <div key={s.id} className="row-item">
                    <BookCover book={s.book} width={100} onLongPress={() => setSheet({ book: s.book, current: null, status: 'tbr', mode: 'quick' })} />
                    <div className="row-caption">{s.book.title}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.recent.length > 0 && (
            <section className="home-section">
              <div className="row-head">
                <h2 className="section-label">Recently read</h2>
                <Link to="/books" className="row-link">Diary</Link>
              </div>
              <div className="cover-row">
                {data.recent.map((r) => (
                  <div key={r.id} className="row-item">
                    <BookCover book={r.book} width={100} onLongPress={() => setSheet({ book: r.book, current: r, status: 'read', mode: 'quick' })} />
                    {r.rating != null ? (
                      <Stars rating={r.rating} liked={r.liked} />
                    ) : (
                      <button className="rate-btn" onClick={() => setSheet({ book: r.book, current: r, status: 'read', mode: 'rate' })}>
                        Rate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {data && !data.isEmpty && (
        <p className="feature-text" style={{ fontSize: 13, textAlign: 'center' }}>
          Tip: tap a cover to open the book. Press and hold (or right-click) for quick actions.
        </p>
      )}

      <button className="link-signout" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>

      {sheet && <BookSheet {...sheet} onClose={() => setSheet(null)} onSaved={refresh} />}
    </main>
  )
}

function ImportCard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  async function go() {
    setBusy(true)
    setResult('')
    try {
      const r = await runImport(setStep)
      setResult(`Imported ${r.books} books.${r.toCheck ? ` ${r.toCheck} need checking.` : ''}`)
      onDone()
    } catch (e) {
      setResult(`Import stopped: ${(e as Error).message}`)
    } finally {
      setBusy(false)
      setStep('')
    }
  }

  return (
    <section className="feature-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 className="feature-title">Bring in your reading log</h2>
        <p className="feature-text">
          {importSize} books, with your ratings, current reads, DNF and TBR queue. Dates come in as 'Not sure'; you can add them later.
        </p>
      </div>
      <button className="feature-btn" onClick={go} disabled={busy || importSize === 0}>
        {importSize === 0 ? 'Still matching your books…' : busy ? step || 'Importing…' : 'Import my books'}
      </button>
      {result && <p className="feature-text" role="status">{result}</p>}
    </section>
  )
}
