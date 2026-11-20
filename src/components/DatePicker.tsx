import { useRef, useState } from 'react'
import { describeDate, MONTHS, todayIso, type DateChoice } from '../lib/actions'

const DECADES = [1970, 1980, 1990, 2000, 2010, 2020]

// startOlder: open on decades (for backfilling old reads from the Discover carousel).
type Props = { value: DateChoice; onChange: (d: DateChoice) => void; label: string; startOlder?: boolean }

// Recent reads first: Today, then the last 12 months, then an exact day.
// Older reads: decades, then an optional year. 'Not sure' is always there.
export default function DatePicker({ value, onChange, label, startOlder }: Props) {
  const now = new Date()
  const thisYear = now.getFullYear()
  const today = todayIso()

  const isOld =
    (value.precision === 'decade') ||
    (value.precision === 'year' && value.year < thisYear - 1) ||
    (value.precision === 'month' && value.year < thisYear - 1)
  const [view, setView] = useState<'recent' | 'older'>(isOld || startOlder ? 'older' : 'recent')
  const dayInput = useRef<HTMLInputElement>(null)

  // The last 12 months, newest first, with a year tag when it's not this year.
  const months = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(thisYear, now.getMonth() - k, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    return { y, m, label: `${MONTHS[m - 1]}${y !== thisYear ? ` '${String(y).slice(2)}` : ''}` }
  })

  const chip = (on: boolean, text: string, onClick: () => void, small = false) => (
    <button key={text} className={`chip-btn${small ? ' small' : ''}${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      {text}
    </button>
  )

  const isToday = value.precision === 'exact' && value.date === today
  const pickedDay = value.precision === 'exact' && !isToday
  const notSure = value.precision === 'unknown'
  const decadeOf = value.precision === 'decade' ? value.decade : value.precision === 'year' ? Math.floor(value.year / 10) * 10 : null

  return (
    <div className="field">
      <div className="field-label">
        {label}
        {!notSure && <span className="field-value">{describeDate(value)}</span>}
      </div>

      {view === 'recent' ? (
        <>
          <div className="chips">
            {chip(isToday, 'Today', () => onChange({ precision: 'exact', date: today }))}
            {months.map(({ y, m, label }) =>
              chip(value.precision === 'month' && value.year === y && value.month === m, label, () =>
                onChange({ precision: 'month', year: y, month: m }),
              ),
            )}
          </div>
          <div className="chips">
            <span className="date-chip">
              <button
                className={`chip-btn${pickedDay ? ' on' : ''}`}
                aria-pressed={pickedDay}
                onClick={() => {
                  const el = dayInput.current
                  if (!el) return
                  try {
                    el.showPicker()
                  } catch {
                    el.focus()
                  }
                }}
              >
                {pickedDay ? describeDate(value) : 'Pick a day'}
              </button>
              <input
                ref={dayInput}
                type="date"
                max={today}
                tabIndex={-1}
                aria-hidden="true"
                value={value.precision === 'exact' ? value.date : ''}
                onChange={(e) => e.target.value && onChange({ precision: 'exact', date: e.target.value })}
              />
            </span>
            {chip(false, 'Longer ago…', () => setView('older'))}
            {chip(notSure, 'Not sure', () => onChange({ precision: 'unknown' }))}
          </div>
        </>
      ) : (
        <>
          <div className="chips">
            {DECADES.map((d) => chip(decadeOf === d, `${d}s`, () => onChange({ precision: 'decade', decade: d })))}
            {chip(notSure, 'Not sure', () => onChange({ precision: 'unknown' }))}
          </div>
          {decadeOf != null && (
            <div className="chips years">
              <span className="field-sub">Exact year (optional):</span>
              {Array.from({ length: 10 }, (_, k) => decadeOf + k)
                .filter((y) => y <= thisYear)
                .map((y) => {
                  const on = value.precision === 'year' && value.year === y
                  return chip(on, String(y), () => onChange(on ? { precision: 'decade', decade: decadeOf } : { precision: 'year', year: y }), true)
                })}
            </div>
          )}
          <div className="chips">{chip(false, '← Recent months', () => setView('recent'))}</div>
        </>
      )}
    </div>
  )
}
