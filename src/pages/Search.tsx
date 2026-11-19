import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookSheet, { type SheetRequest } from '../components/BookSheet'
import Cover from '../components/Cover'
import { SearchIcon } from '../components/Icons'
import { ensureBook, myBookStatuses, searchBooks, type MyStatus, type SearchResult } from '../lib/catalogue'
import { coverUrlFor } from '../lib/types'
import './Search.css'

const STATUS_LABEL: Record<MyStatus, string> = {
  reading: 'Reading now',
  read: 'Read',
  dnf: 'DNF',
  tbr: 'On your TBR',
}

export default function Search() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mine, setMine] = useState(new Map<string, { id: string; status: MyStatus }>())
  const [sheet, setSheet] = useState<SheetRequest | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refreshMine = () => myBookStatuses().then(setMine, () => {})
  useEffect(() => {
    refreshMine()
    inputRef.current?.focus()
  }, [])

  // Search as you type, after a short pause.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults(null)
      setError('')
      return
    }
    const ctrl = new AbortController()
    const t = window.setTimeout(() => {
      setLoading(true)
      setError('')
      searchBooks(q, ctrl.signal)
        .then(setResults)
        .catch((e: Error) => e.name !== 'AbortError' && setError(e.message))
        .finally(() => setLoading(false))
    }, 400)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  async function pick(r: SearchResult) {
    const have = mine.get(r.key)
    if (have) return navigate(`/book/${have.id}`)
    setAdding(r.key)
    try {
      const book = await ensureBook(r)
      setSheet({ book, current: null, status: 'tbr', mode: 'quick' })
    } catch (e) {
      setError(`Couldn't add that book: ${(e as Error).message}`)
    } finally {
      setAdding(null)
    }
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Search</h1>
      </header>

      <div className="search-box">
        <SearchIcon size={20} />
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Title or author"
          aria-label="Search for a book by title or author"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="clear-btn" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus() }}>
            ×
          </button>
        )}
      </div>

      {error && <div className="placeholder-card" role="alert">{error}</div>}
      {loading && !results && <div className="search-note">Searching…</div>}
      {!results && !loading && !error && (
        <div className="search-note">Find any book, then add it to your TBR, mark it read, start it or DNF it.</div>
      )}
      {results && results.length === 0 && !loading && (
        <div className="search-note">No matches. Try fewer words, or just the author's surname.</div>
      )}

      {results && results.length > 0 && (
        <ul className="results" aria-busy={loading}>
          {results.map((r) => {
            const have = mine.get(r.key)
            return (
              <li key={r.key}>
                <button className="result" onClick={() => pick(r)} disabled={adding === r.key}>
                  <Cover book={{ title: r.title, authors: r.authors, cover_url: coverUrlFor(r.cover_id) }} width={48} small />
                  <div className="result-text">
                    <div className="result-title">{r.title}</div>
                    <div className="result-sub">
                      {r.authors.join(', ') || 'Unknown author'}
                      {r.year ? ` · ${r.year}` : ''}
                    </div>
                    {have && <span className="result-badge">{STATUS_LABEL[have.status]}</span>}
                  </div>
                  <span className="result-action" aria-hidden="true">
                    {adding === r.key ? '…' : have ? '›' : '+'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {sheet && (
        <BookSheet
          {...sheet}
          onClose={() => setSheet(null)}
          onSaved={() => {
            refreshMine()
          }}
        />
      )}
    </main>
  )
}
