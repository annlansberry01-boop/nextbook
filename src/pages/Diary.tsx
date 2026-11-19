import BookCover from '../components/BookCover'
import Stars from '../components/Stars'
import { MONTHS } from '../lib/actions'
import { byDate } from '../lib/mybooks'
import type { Reading } from '../lib/types'

const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Heading for a read: month for exact/month dates, then year, then decade.
function heading(r: Reading) {
  const from = r.finished_from
  if (!from || r.date_precision === 'unknown') return null
  const y = from.slice(0, 4)
  const m = Number(from.slice(5, 7))
  if (r.date_precision === 'exact' || r.date_precision === 'month') return `${FULL_MONTHS[m - 1]} ${y}`
  if (r.date_precision === 'year') return y
  return `${y}s`
}

function dayLabel(r: Reading) {
  if (r.date_precision !== 'exact' || !r.finished_from) return null
  return `${Number(r.finished_from.slice(8, 10))} ${MONTHS[Number(r.finished_from.slice(5, 7)) - 1]}`
}

/** Reverse-chronological reads, grouped by month, then year, then decade for fuzzy dates. Undated at the end. */
export default function Diary({ readings, onLongPress }: { readings: Reading[]; onLongPress: (r: Reading) => void }) {
  const dated = readings.filter((r) => heading(r)).sort(byDate)
  const undated = readings.filter((r) => !heading(r)).sort((a, b) => a.book.title.localeCompare(b.book.title))

  const groups: { label: string; items: Reading[] }[] = []
  for (const r of dated) {
    const label = heading(r)!
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(r)
    else groups.push({ label, items: [r] })
  }

  return (
    <div className="diary">
      {groups.length === 0 && (
        <div className="placeholder-card">
          No dated reads yet. When you finish a book it's dated automatically. For older ones, press and hold a cover below and pick a month, year or decade.
        </div>
      )}

      {groups.map((g) => (
        <section key={g.label} className="home-section">
          <h2 className="section-label">
            {/^\d{4}s$/.test(g.label) ? (
              <>
                {g.label.slice(0, 4)}
                <span style={{ textTransform: 'none' }}>s</span>
              </>
            ) : (
              g.label
            )}{' '}
            <span className="label-count">{g.items.length}</span>
          </h2>
          <div className="cover-grid">
            {g.items.map((r) => (
              <div key={r.id} className="grid-item">
                <BookCover book={r.book} width="fluid" onLongPress={() => onLongPress(r)} />
                {r.rating != null ? <Stars rating={r.rating} liked={r.liked} size={12} /> : <span className="unrated">Not rated</span>}
                {dayLabel(r) && <span className="unrated">{dayLabel(r)}</span>}
              </div>
            ))}
          </div>
        </section>
      ))}

      {undated.length > 0 && (
        <section className="home-section undated">
          <h2 className="section-label">
            Undated <span className="label-count">{undated.length}</span>
          </h2>
          <p className="feature-text" style={{ fontSize: 13 }}>
            Press and hold a cover (or right-click) to add roughly when you read it. A decade is plenty.
          </p>
          <div className="cover-grid">
            {undated.map((r) => (
              <div key={r.id} className="grid-item">
                <BookCover book={r.book} width="fluid" onLongPress={() => onLongPress(r)} />
                {r.rating != null ? <Stars rating={r.rating} liked={r.liked} size={12} /> : <span className="unrated">Not rated</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
