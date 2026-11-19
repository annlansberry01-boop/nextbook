import { useEffect, useState } from 'react'
import {
  dateChoiceOf,
  lastFormat,
  saveBook,
  todayIso,
  toast,
  type DateChoice,
  type SheetStatus,
} from '../lib/actions'
import type { Book, BookFormat, Reading } from '../lib/types'
import Cover from './Cover'
import DatePicker from './DatePicker'
import './BookSheet.css'

const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z'
const HEART = 'M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z'
const FORMATS: [BookFormat, string][] = [
  ['print', 'Print'],
  ['ebook', 'Ebook'],
  ['audio', 'Audio'],
]
const STATUSES: [SheetStatus, string][] = [
  ['read', 'Read'],
  ['reading', 'Reading'],
  ['tbr', 'TBR'],
  ['dnf', 'DNF'],
]
const DNF_REASONS = ['Content', 'Pacing', 'Not in the mood', 'Writing style']

export type SheetRequest = {
  book: Book
  current: Reading | null // latest reading of this book, if any
  status: SheetStatus // which status the sheet opens on
  mode: 'finish' | 'rate' | 'quick' | 'reread'
}

type Props = SheetRequest & { onClose: () => void; onSaved: () => void }

export default function BookSheet({ book, current, status: initialStatus, mode, onClose, onSaved }: Props) {
  // Pre-fill from the latest reading; a re-read keeps the old rating unless changed.
  const prior = current && (current.status === 'read' || current.status === 'dnf') ? current : null
  const [status, setStatus] = useState<SheetStatus>(initialStatus)
  const [rating, setRating] = useState<number>(prior?.rating ?? 0)
  const [liked, setLiked] = useState(prior?.liked ?? false)
  const [note, setNote] = useState(mode === 'reread' ? '' : (prior?.note ?? ''))
  const [format, setFormat] = useState<BookFormat | null>(current?.format ?? lastFormat())
  const [date, setDate] = useState<DateChoice>(() => {
    // Finishing now stamps today; back-catalogue books start as 'Not sure'.
    if (mode === 'finish' || mode === 'reread' || current?.status === 'reading') return { precision: 'exact', date: todayIso() }
    if (prior) return dateChoiceOf(prior)
    return { precision: 'unknown' }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    setSaving(true)
    setError('')
    try {
      const msg = await saveBook(
        book,
        { status, rating: rating || null, liked, note, format, date },
        current,
        mode === 'reread',
      )
      toast(msg)
      onSaved()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const tapStar = (i: number) => setRating(rating === i ? i - 0.5 : i)

  const title =
    mode === 'finish' ? 'Finished' : mode === 'reread' ? 'Read again' : mode === 'rate' ? 'Rate this book' : 'Update'

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${title}: ${book.title}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="sheet-head">
          <Cover book={book} width={48} small />
          <div className="sheet-head-text">
            <div className="sheet-book-title">{book.title}</div>
            <div className="sheet-book-author">{book.authors.join(' & ')}</div>
          </div>
          {status !== 'tbr' && status !== 'reading' && (
            <button
              className="heart-btn"
              aria-label="Like"
              aria-pressed={liked}
              onClick={() => setLiked(!liked)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill={liked ? 'var(--like)' : 'none'} stroke={liked ? 'var(--like)' : 'var(--text-muted)'} strokeWidth="1.8">
                <path d={HEART} />
              </svg>
            </button>
          )}
        </div>

        {mode === 'quick' && (
          <div className="seg" role="group" aria-label="Status">
            {STATUSES.map(([s, label]) => (
              <button key={s} aria-pressed={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {status === 'read' && (
          <div className="stars-block">
            <div className="stars-row" role="group" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((i) => {
                const w = rating >= i ? 38 : rating === i - 0.5 ? 19 : 0
                return (
                  <button key={i} className="star-btn" aria-label={`${i} stars`} onClick={() => tapStar(i)}>
                    <span className="star-wrap">
                      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4" aria-hidden="true" className="star-abs">
                        <path d={STAR} />
                      </svg>
                      <span className="star-fill" style={{ width: w }}>
                        <svg width="38" height="38" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden="true">
                          <path d={STAR} />
                        </svg>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="sheet-hint">
              {rating > 0 ? `${rating} out of 5${liked ? ' · liked' : ''}` : 'Tap a star. Tap again for a half.'}
              {rating > 0 && (
                <button className="inline-link" onClick={() => setRating(0)}>
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {status === 'dnf' && (
          <div className="field">
            <div className="field-label">Why did you stop? (optional)</div>
            <div className="chips">
              {DNF_REASONS.map((r) => (
                <button key={r} className={`chip-btn${note === r ? ' on' : ''}`} aria-pressed={note === r} onClick={() => setNote(note === r ? '' : r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {(status === 'read' || status === 'dnf') && (
          <DatePicker value={date} onChange={setDate} label={status === 'dnf' ? 'When did you stop?' : 'When did you finish?'} />
        )}

        {status !== 'tbr' && (
          <div className="field">
            <div className="field-label">Format</div>
            <div className="chips">
              {FORMATS.map(([f, label]) => (
                <button key={f} className={`chip-btn${format === f ? ' on' : ''}`} aria-pressed={format === f} onClick={() => setFormat(format === f ? null : f)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'read' && (
          <label className="field">
            <span className="field-label">Note (optional)</span>
            <input className="text-input" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line on what stayed with you" />
          </label>
        )}

        {error && (
          <p className="sheet-error" role="alert">
            Couldn't save: {error}
          </p>
        )}

        <div className="sheet-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save to my books'}
          </button>
        </div>
      </div>
    </div>
  )
}
