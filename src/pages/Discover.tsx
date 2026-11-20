import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import BookSheet, { type SheetRequest } from '../components/BookSheet'
import Blurb from '../components/Blurb'
import Carousel from '../components/Carousel'
import { saveBook, toast } from '../lib/actions'
import { getBlurb } from '../lib/blurb'
import { ensureBook } from '../lib/catalogue'
import {
  buildDeck,
  loadDeckState,
  loadMine,
  progressLabel,
  recordOutcome,
  saveDeckState,
  THEMES,
  type Card,
  type DeckState,
  type Mine,
} from '../lib/decks'
import { dataChanged } from '../lib/maintenance'
import { supabase } from '../lib/supabase'
import './Discover.css'

type Outcome = DeckState['done'][string]

const OFFLINE = "Open Library isn't responding right now, so we can't deal a deck. Try again in a few minutes."

function remembered(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export default function Discover() {
  const [mode, setMode] = useState<'backfill' | 'next'>('backfill')
  const [themeId, setThemeId] = useState(() => remembered('nb.deckTheme', 'foryou'))
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  const [mine, setMine] = useState<Mine | null>(null)
  const [deck, setDeck] = useState<DeckState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<(SheetRequest & { card: Card }) | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMine().then(setMine, (e: Error) => setError(e.message))
  }, [])

  const deal = useCallback(
    async (fresh: boolean) => {
      if (!mine) return
      setError('')
      const saved = fresh ? null : loadDeckState(theme.id)
      if (saved) {
        setDeck(saved)
        return
      }
      setDeck(null)
      setLoading(true)
      try {
        const cards = await buildDeck(theme, mine)
        const state: DeckState = { cards, done: {}, centre: 0 }
        setDeck(state)
        saveDeckState(theme.id, cards.length ? state : null)
      } catch {
        setError(OFFLINE)
      } finally {
        setLoading(false)
      }
    },
    [mine, theme],
  )

  useEffect(() => {
    deal(false)
  }, [deal])

  const pickTheme = (id: string) => {
    try {
      localStorage.setItem('nb.deckTheme', id)
    } catch {
      /* ignore */
    }
    setThemeId(id)
  }

  const update = (next: DeckState) => {
    setDeck(next)
    saveDeckState(theme.id, next)
  }

  const card = deck?.cards[deck.centre]
  const finished = !!deck && deck.cards.length > 0 && deck.cards.every((c) => deck.done[c.key])

  function markDone(c: Card, outcome: Outcome) {
    if (!deck) return
    const done = { ...deck.done, [c.key]: outcome }
    // Move to the next card not yet dealt with (forwards first, then back to any skipped).
    const i = deck.cards.findIndex((x) => x.key === c.key)
    const order = [...deck.cards.slice(i + 1), ...deck.cards.slice(0, i)]
    const nextCard = order.find((x) => !done[x.key])
    const centre = nextCard ? deck.cards.indexOf(nextCard) : i
    update({ ...deck, done, centre })
    if (mine) mine.keys.add(c.key)
    recordOutcome(c.source, outcome !== 'notread')
    dataChanged()
  }

  async function act(kind: 'read' | 'notread' | 'tbr' | 'dnf') {
    if (!card || busy) return
    if (deck?.done[card.key]) {
      toast('Already done. Tap another cover.')
      return
    }
    setBusy(true)
    try {
      const book = await ensureBook(card)
      if (kind === 'read' || kind === 'dnf') {
        setSheet({ book, current: null, status: kind, mode: 'rate', backfill: true, card })
        return
      }
      if (kind === 'tbr') {
        await saveBook(book, { status: 'tbr', rating: null, liked: false, note: '', format: null, date: { precision: 'unknown' } }, null)
        toast('Added to TBR')
        markDone(card, 'tbr')
      } else {
        const { error } = await supabase
          .from('shelf_entries')
          .upsert({ book_id: book.id, status: 'dismissed' }, { onConflict: 'user_id,book_id' })
        if (error) throw new Error(error.message)
        toast("Won't show this again")
        markDone(card, 'notread')
      }
    } catch (e) {
      toast(`Couldn't save: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  // Fetch descriptions for the next couple of cards ahead of time, so they're ready when you get there.
  useEffect(() => {
    if (!deck) return
    for (const c of deck.cards.slice(deck.centre + 1, deck.centre + 3)) getBlurb(c.key, c.title, c.authors[0] ?? '')
  }, [deck])

  const doneCount = deck ? Object.keys(deck.done).length : 0
  const tally = deck
    ? Object.values(deck.done).reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {})
    : {}

  return (
    <main className="screen discover">
      <header className="screen-header">
        <h1 className="screen-title discover-title">Discover</h1>
        <div className="mode-toggle" role="tablist" aria-label="Discover mode">
          <button role="tab" aria-selected={mode === 'backfill'} className={mode === 'backfill' ? 'on' : ''} onClick={() => setMode('backfill')}>
            Backfill
          </button>
          <button role="tab" aria-selected={mode === 'next'} className={mode === 'next' ? 'on' : ''} onClick={() => setMode('next')}>
            Next read
          </button>
        </div>
      </header>

      {mode === 'next' ? (
        <div className="placeholder-card">
          <strong style={{ color: 'var(--text)' }}>Next read arrives in phase 2.</strong>
          <br />
          A quick mood check, then seven picks from your TBR and beyond, each with a reason. It needs the AI taste profile, which is the next phase.
        </div>
      ) : (
        <>
          <div className="theme-chips" role="group" aria-label="Deck themes" ref={chipsRef}>
            {THEMES.map((t) => (
              <button key={t.id} aria-pressed={t.id === theme.id} className={t.id === theme.id ? 'on' : ''} onClick={() => pickTheme(t.id)}>
                {t.label}
              </button>
            ))}
            <button className="make-deck" onClick={() => toast('Make a deck (any theme in your own words) arrives with AI in phase 2.')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Make a deck
            </button>
          </div>

          <div className="deck-area">
            <div className="deck-meta">
              {mine && <span>{progressLabel(theme, mine)}</span>}
              {deck && deck.cards.length > 0 && !finished && (
                <span>
                  {' · '}Card {deck.centre + 1} of {deck.cards.length}
                </span>
              )}
            </div>

            {error && <div className="placeholder-card" role="alert">{error}</div>}

            {loading && (
              <div className="deck-loading" role="status">
                <div className="loading-stack" aria-hidden="true">
                  <div />
                  <div />
                  <div />
                </div>
                Shuffling 15 books… Covers come from Open Library, so this can take a moment.
              </div>
            )}

            {!loading && deck && deck.cards.length === 0 && !error && (
              <div className="placeholder-card">
                Nothing left to show in {theme.label}: you've read, shelved or dismissed every book we could find. Try another theme.
              </div>
            )}

            {!loading && finished && (
              <div className="deck-done">
                <h2>Deck done</h2>
                <p>
                  {tally.read ?? 0} read · {tally.tbr ?? 0} to TBR · {tally.dnf ?? 0} DNF · {tally.notread ?? 0} not read
                </p>
                <button className="btn-primary" onClick={() => deal(true)}>
                  Deal another 15
                </button>
              </div>
            )}

            {!loading && deck && deck.cards.length > 0 && !finished && card && (
              <>
                <Carousel
                  cards={deck.cards}
                  centre={deck.centre}
                  done={deck.done}
                  onCentre={(i) => update({ ...deck, centre: i })}
                  onSwipeUp={() => act('tbr')}
                />
                <p className="browse-hint">Swipe or tap a cover to browse</p>
                <div className="card-details">
                  <div className="card-title">{card.title}</div>
                  <div className="card-sub">
                    {card.authors.join(' & ')}
                    {card.year ? ` · ${card.year}` : ''}
                  </div>
                  <div className="card-why">{card.why}</div>
                  <Blurb workKey={card.key} title={card.title} author={card.authors[0] ?? ''} />
                </div>

                <div className="deck-actions">
                  <ActionButton label="Not read" hint="" onClick={() => act('notread')} disabled={busy}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </ActionButton>
                  <ActionButton label="Didn't finish" hint="" onClick={() => act('dnf')} disabled={busy} aria="Started, didn't finish">
                    <span className="dnf-text">DNF</span>
                  </ActionButton>
                  <ActionButton label="TBR" hint="or swipe ↑" onClick={() => act('tbr')} disabled={busy} aria="Add to TBR">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 3h12v18l-6-4-6 4z" />
                    </svg>
                  </ActionButton>
                  <ActionButton label="Read it" hint="" onClick={() => act('read')} disabled={busy} primary>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </ActionButton>
                </div>
                {doneCount > 0 && <p className="deck-hint">You can stop any time. This deck picks up where you left off.</p>}
              </>
            )}
          </div>
        </>
      )}

      {sheet && (
        <BookSheet
          {...sheet}
          onClose={() => setSheet(null)}
          onSaved={() => {
            markDone(sheet.card, sheet.status === 'dnf' ? 'dnf' : 'read')
          }}
        />
      )}
    </main>
  )
}

function ActionButton({
  label,
  hint,
  onClick,
  disabled,
  primary,
  aria,
  children,
}: {
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  aria?: string
  children: ReactNode
}) {
  return (
    <div className="deck-action">
      <button className={`round-btn${primary ? ' primary' : ''}`} aria-label={aria ?? label} onClick={onClick} disabled={disabled}>
        {children}
      </button>
      <div className="action-label">
        {label}
        {hint && (
          <>
            <br />
            <span>{hint}</span>
          </>
        )}
      </div>
    </div>
  )
}
