import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import BookCover from '../components/BookCover'
import BookSheet, { type SheetRequest } from '../components/BookSheet'
import Stars from '../components/Stars'
import { toast } from '../lib/actions'
import { GENRES, genreOf } from '../lib/genre'
import { useDataChanged } from '../lib/maintenance'
import { byDate, exportCsv, loadMyBooks, surname } from '../lib/mybooks'
import type { BookFormat, Reading, ShelfEntry } from '../lib/types'
import Diary from './Diary'
import './MyBooks.css'

type View = 'read' | 'tbr' | 'dnf' | 'liked' | 'diary'
type ReadSort = 'date' | 'rating' | 'author' | 'title' | 'genre'
type TbrSort = 'added' | 'genre'

const VIEWS: [View, string][] = [
  ['read', 'Read'],
  ['tbr', 'TBR'],
  ['dnf', 'DNF'],
  ['liked', 'Liked'],
  ['diary', 'Diary'],
]

// Remember the last sort and filter on this device.
function remembered<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) ?? fallback
  } catch {
    return fallback
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

type Data = Awaited<ReturnType<typeof loadMyBooks>>

export default function MyBooks() {
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.some(([v]) => v === params.get('view')) ? params.get('view') : remembered('nb.view', 'read')) as View
  const [readSort, setReadSort] = useState<ReadSort>(() => remembered('nb.readSort', 'date'))
  const [tbrSort, setTbrSort] = useState<TbrSort>(() => remembered('nb.tbrSort', 'added'))
  const [format, setFormat] = useState<BookFormat | 'all'>('all')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState<SheetRequest | null>(null)
  const [exporting, setExporting] = useState(false)

  const refresh = useCallback(() => {
    loadMyBooks().then(setData, (e: Error) => setError(e.message))
  }, [])
  useEffect(refresh, [refresh])
  useDataChanged(refresh)

  const setView = (v: View) => {
    remember('nb.view', v)
    setParams({ view: v }, { replace: true })
  }

  const counts: Record<View, number> = {
    read: data?.read.length ?? 0,
    tbr: data?.tbr.length ?? 0,
    dnf: data?.dnf.length ?? 0,
    liked: data?.liked.length ?? 0,
    diary: data?.read.length ?? 0,
  }

  const readList = useMemo(() => {
    if (!data) return []
    const src = view === 'liked' ? data.liked : view === 'dnf' ? data.dnf : data.read
    const filtered = format === 'all' ? src : src.filter((r) => r.format === format)
    const sorted = [...filtered]
    if (readSort === 'date') sorted.sort(byDate)
    // Genre groups list best-rated first, so 'rating' order is used inside each group.
    if (readSort === 'rating' || readSort === 'genre') sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.book.title.localeCompare(b.book.title))
    if (readSort === 'author') sorted.sort((a, b) => surname(a).localeCompare(surname(b)) || a.book.title.localeCompare(b.book.title))
    if (readSort === 'title') sorted.sort((a, b) => a.book.title.replace(/^(the|a|an) /i, '').localeCompare(b.book.title.replace(/^(the|a|an) /i, '')))
    return sorted
  }, [data, view, readSort, format])

  async function doExport() {
    setExporting(true)
    try {
      const n = await exportCsv()
      toast(`Downloaded ${n} rows`)
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  const openReading = (r: Reading) => setSheet({ book: r.book, current: r, status: r.status === 'reading' ? 'reading' : r.status, mode: 'quick' })
  const openShelf = (s: ShelfEntry) => setSheet({ book: s.book, current: null, status: 'tbr', mode: 'quick' })

  return (
    <main className="screen">
      <header className="screen-header">
        <h1 className="screen-title">My books</h1>
        <button className="export-btn" onClick={doExport} disabled={exporting || !data}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
          {exporting ? 'Exporting…' : 'Export my data'}
        </button>
      </header>

      <div className="view-tabs" role="tablist" aria-label="Views">
        {VIEWS.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
            {label}
            {data && v !== 'diary' && <span className="count">{counts[v]}</span>}
          </button>
        ))}
      </div>

      {error && <div className="placeholder-card" role="alert">Couldn't load your books: {error}</div>}

      {data && view === 'diary' && <Diary readings={data.read} onLongPress={openReading} />}

      {data && view === 'tbr' && (
        <>
          <div className="controls">
            <label className="select">
              <span>Sort</span>
              <select value={tbrSort} onChange={(e) => { setTbrSort(e.target.value as TbrSort); remember('nb.tbrSort', e.target.value) }}>
                <option value="added">Date added</option>
                <option value="genre">Genre</option>
              </select>
            </label>
            <span className="controls-note">Sort by fit arrives with AI picks</span>
          </div>
          {data.tbr.length === 0 && <div className="placeholder-card">Your TBR is empty. Add books from Search.</div>}
          {tbrSort === 'added' ? (
            <Grid>
              {[...data.tbr]
                .sort((a, b) => b.date_added.localeCompare(a.date_added))
                .map((s) => (
                  <GridItem key={s.id} caption={s.book.title}>
                    <BookCover book={s.book} width="fluid" onLongPress={() => openShelf(s)} />
                  </GridItem>
                ))}
            </Grid>
          ) : (
            GENRES.map((g) => {
              const items = data.tbr.filter((s) => genreOf(s.book) === g)
              if (!items.length) return null
              return (
                <section key={g} className="home-section">
                  <h2 className="section-label">
                    {g} <span className="label-count">{items.length}</span>
                  </h2>
                  <Grid>
                    {items.map((s) => (
                      <GridItem key={s.id} caption={s.book.title}>
                        <BookCover book={s.book} width="fluid" onLongPress={() => openShelf(s)} />
                      </GridItem>
                    ))}
                  </Grid>
                </section>
              )
            })
          )}
        </>
      )}

      {data && (view === 'read' || view === 'liked' || view === 'dnf') && (
        <>
          <div className="controls">
            {view !== 'dnf' && (
              <label className="select">
                <span>Sort</span>
                <select value={readSort} onChange={(e) => { setReadSort(e.target.value as ReadSort); remember('nb.readSort', e.target.value) }}>
                  <option value="date">Date read</option>
                  <option value="rating">Rating</option>
                  <option value="author">Author</option>
                  <option value="title">Title</option>
                  <option value="genre">Genre</option>
                </select>
              </label>
            )}
            <label className="select">
              <span>Format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as BookFormat | 'all')}>
                <option value="all">All</option>
                <option value="print">Print</option>
                <option value="ebook">Ebook</option>
                <option value="audio">Audio</option>
              </select>
            </label>
          </div>
          {readList.length === 0 && (
            <div className="placeholder-card">
              {format !== 'all'
                ? 'Nothing in this format yet. Most imported books have no format set.'
                : view === 'liked'
                  ? 'Tap the heart when you rate a book and it shows up here.'
                  : view === 'dnf'
                    ? 'No DNFs.'
                    : 'Nothing here yet.'}
            </div>
          )}
          {(() => {
            const cell = (r: Reading) => (
              <GridItem key={r.id} caption={view === 'dnf' ? (r.note ?? 'DNF') : undefined}>
                <BookCover book={r.book} width="fluid" onLongPress={() => openReading(r)} />
                {view !== 'dnf' && (r.rating != null ? <Stars rating={r.rating} liked={r.liked} size={12} /> : <span className="unrated">Not rated</span>)}
              </GridItem>
            )
            if (readSort !== 'genre' || view === 'dnf') return <Grid>{readList.map(cell)}</Grid>
            return GENRES.map((g) => {
              const items = readList.filter((r) => genreOf(r.book) === g)
              if (!items.length) return null
              return (
                <section key={g} className="home-section">
                  <h2 className="section-label">
                    {g} <span className="label-count">{items.length}</span>
                  </h2>
                  <Grid>{items.map(cell)}</Grid>
                </section>
              )
            })
          })()}
        </>
      )}

      {sheet && <BookSheet {...sheet} onClose={() => setSheet(null)} onSaved={refresh} />}
    </main>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="cover-grid">{children}</div>
}

function GridItem({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="grid-item">
      {children}
      {caption && <div className="grid-caption">{caption}</div>}
    </div>
  )
}
