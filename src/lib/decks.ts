// Discover decks (phase 1, no AI): fixed lists plus 'same authors', 15 cards at a time,
// never showing a book already logged, on the TBR, or dismissed.
import { BOOKER, DECADES, GENRE_LISTS, HUGO, MILES_FRANKLIN, NEBULA, PULITZER, STELLA, WOMENS_PRIZE, type Entry } from './deckLists'
import { genreOf } from './genre'
import { supabase } from './supabase'
import type { Book } from './types'

export const DECK_SIZE = 15

export type Card = {
  key: string // Open Library work key
  title: string
  authors: string[]
  year: number | null
  cover_id: number | null
  page_count: number | null
  subjects: string[]
  why: string
  source: Source
}

export type Source = 'authors' | 'prizes' | 'era' | 'genre'

export type Theme = {
  id: string
  label: string
  group: 'personal' | 'prize' | 'decade' | 'genre'
  /** Closed lists have a known total ('Booker: 14 of 59 read'). */
  closed: boolean
  entries?: Entry[]
  why?: (e: Entry) => string
}

const prize = (id: string, label: string, entries: Entry[], why: (e: Entry) => string): Theme => ({
  id,
  label,
  group: 'prize',
  closed: true,
  entries,
  why,
})

export const THEMES: Theme[] = [
  { id: 'foryou', label: 'For you', group: 'personal', closed: false },
  { id: 'authors', label: 'Same authors', group: 'personal', closed: false },
  prize('booker', 'Booker', BOOKER, (e) => `Booker Prize ${e[2]}`),
  prize('hugo', 'Hugo', HUGO, (e) => `Hugo Award ${e[2]}`),
  prize('nebula', 'Nebula', NEBULA, () => 'Nebula Award winner'),
  prize('milesfranklin', 'Miles Franklin', MILES_FRANKLIN, (e) => `Miles Franklin ${e[2]}`),
  prize('stella', 'Stella', STELLA, (e) => `Stella Prize ${e[2]}`),
  prize('pulitzer', 'Pulitzer', PULITZER, (e) => `Pulitzer Prize ${e[2]}`),
  prize('womens', "Women's Prize", WOMENS_PRIZE, (e) => `Women's Prize ${e[2]}`),
  ...Object.entries(DECADES).map(([d, entries]): Theme => ({
    id: `decade-${d}`,
    label: d,
    group: 'decade',
    closed: false,
    entries,
    why: (e) => `${d} · ${e[2]}`,
  })),
  ...Object.entries(GENRE_LISTS).map(([g, entries]): Theme => ({
    id: `genre-${g}`,
    label: g,
    group: 'genre',
    closed: false,
    entries,
    why: () => g,
  })),
]

// ---------- Matching helpers ----------

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^(the|a|an) /, '')
    .replace(/[^a-z0-9]/g, '')

const surname = (name: string) => norm(name.split(' ').pop() ?? '')
export const matchKey = (title: string, author: string) => `${norm(title)}|${surname(author)}`

// ---------- What the reader already has ----------

export type Mine = {
  keys: Set<string> // Open Library work keys: read, reading, DNF, TBR or dismissed
  titles: Set<string> // matchKey(title, author) of the same
  readTitles: Set<string> // matchKey of books read
  readBooks: Book[] // latest read of each book, for authors and genre counts
}

export async function loadMine(): Promise<Mine> {
  const [readings, shelf] = await Promise.all([
    supabase.from('readings').select('status, rating, book:books(*)'),
    supabase.from('shelf_entries').select('status, book:books(*)'),
  ])
  if (readings.error) throw new Error(readings.error.message)
  type Row = { status: string; rating?: number | null; book: Book | null }
  const keys = new Set<string>()
  const titles = new Set<string>()
  const readTitles = new Set<string>()
  const readMap = new Map<string, Book & { rating: number | null }>()
  for (const r of [...((readings.data ?? []) as unknown as Row[]), ...((shelf.data ?? []) as unknown as Row[])]) {
    if (!r.book) continue
    if (r.book.ol_work_key) keys.add(r.book.ol_work_key)
    const k = matchKey(r.book.title, r.book.authors[0] ?? '')
    titles.add(k)
    if (r.status === 'read') {
      readTitles.add(k)
      readMap.set(r.book.id, { ...r.book, rating: r.rating ?? null })
    }
  }
  return { keys, titles, readTitles, readBooks: [...readMap.values()] }
}

/** Progress label under the chips, e.g. 'Booker: 14 of 59 read' or 'Fantasy: 20 read'. */
export function progressLabel(theme: Theme, mine: Mine): string {
  if (theme.entries && theme.closed) {
    const unique = new Set(theme.entries.map(([t, a]) => matchKey(t, a)))
    const read = [...unique].filter((k) => mine.readTitles.has(k)).length
    return `${theme.label}: ${read} of ${unique.size} read`
  }
  if (theme.group === 'genre') {
    const g = theme.label === 'Sci-fi classics' ? 'Science fiction' : theme.label
    return `${theme.label}: ${mine.readBooks.filter((b) => genreOf(b) === g).length} read`
  }
  if (theme.group === 'decade') {
    const start = theme.label === '2000s' ? 2000 : theme.label === '2010s' ? 2010 : theme.label === '2020s' ? 2020 : 1900 + Number(theme.label.slice(0, 2))
    return `${theme.label}: ${mine.readBooks.filter((b) => b.year && b.year >= start && b.year < start + 10).length} read`
  }
  return `${mine.readBooks.length} books read`
}

// ---------- Finding books on Open Library ----------

const FIELDS = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject,edition_count'
type Doc = {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  number_of_pages_median?: number
  subject?: string[]
  edition_count?: number
}

const RESOLVE_KEY = 'nb.resolve.v1'
let resolveCache: Record<string, Omit<Card, 'why' | 'source'> | null> | null = null

function cache() {
  if (!resolveCache) {
    try {
      resolveCache = JSON.parse(localStorage.getItem(RESOLVE_KEY) ?? '{}')
    } catch {
      resolveCache = {}
    }
  }
  return resolveCache!
}

function saveCache() {
  try {
    localStorage.setItem(RESOLVE_KEY, JSON.stringify(resolveCache))
  } catch {
    /* storage full or blocked: fine, we just look things up again */
  }
}

async function olSearch(params: Record<string, string>): Promise<Doc[]> {
  const url = `https://openlibrary.org/search.json?${new URLSearchParams({ ...params, fields: FIELDS })}`
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`Open Library ${res.status}`)
  return ((await res.json()).docs ?? []) as Doc[]
}

/** Finds a list entry on Open Library. Keeps the list's own title and author. Cached on this device. */
async function resolveEntry([title, author, year]: Entry): Promise<Omit<Card, 'why' | 'source'> | null> {
  const k = matchKey(title, author)
  const c = cache()
  if (k in c) return c[k]
  const docs = await olSearch({ q: `${title} ${author.split(' ').pop()}`, limit: '8' })
  const sn = surname(author)
  const byAuthor = docs.filter((d) => (d.author_name ?? []).some((a) => surname(a) === sn || norm(a).includes(sn)))
  const t = norm(title)
  const doc =
    byAuthor.find((d) => norm(d.title) === t && d.cover_i) ??
    byAuthor.find((d) => norm(d.title).startsWith(t) && d.cover_i) ??
    byAuthor.find((d) => norm(d.title) === t) ??
    // Translated books are often filed under their original title; trust the best-known one by this author.
    [...byAuthor].sort((a, b) => (b.edition_count ?? 0) - (a.edition_count ?? 0))[0]
  const out = doc
    ? {
        key: doc.key,
        title,
        authors: [author],
        year,
        cover_id: doc.cover_i ?? null,
        page_count: doc.number_of_pages_median ?? null,
        subjects: (doc.subject ?? []).slice(0, 12),
      }
    : null
  c[k] = out
  saveCache()
  return out
}

// ---------- Same authors ----------

const AUTHOR_KEY = 'nb.authorWorks.v1'
const SKIP_TITLE = /collection|box ?set|omnibus|books? set|trilogy|quartet|complete|stories|novels|works|anthology|\bvol\b|volume|bundle/i

async function worksBy(author: string): Promise<Doc[]> {
  let store: Record<string, { at: number; docs: Doc[] }> = {}
  try {
    store = JSON.parse(localStorage.getItem(AUTHOR_KEY) ?? '{}')
  } catch {
    /* ignore */
  }
  const hit = store[author]
  if (hit && Date.now() - hit.at < 14 * 864e5) return hit.docs
  const docs = (await olSearch({ author, sort: 'editions', limit: '15' })).filter(
    (d) => !SKIP_TITLE.test(d.title) && (d.author_name?.length ?? 0) <= 2,
  )
  store[author] = { at: Date.now(), docs }
  try {
    localStorage.setItem(AUTHOR_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
  return docs
}

const docToCard = (d: Doc, why: string, source: Source): Card => ({
  key: d.key,
  title: d.title,
  authors: d.author_name?.slice(0, 2) ?? [],
  year: d.first_publish_year ?? null,
  cover_id: d.cover_i ?? null,
  page_count: d.number_of_pages_median ?? null,
  subjects: (d.subject ?? []).slice(0, 12),
  why,
  source,
})

async function sameAuthorCards(mine: Mine, want: number): Promise<Card[]> {
  // Authors of books rated 4 or more, most-read first, then shuffled within that.
  const counts = new Map<string, number>()
  for (const b of mine.readBooks as (Book & { rating: number | null })[])
    if ((b.rating ?? 0) >= 4 && b.authors[0]) counts.set(b.authors[0], (counts.get(b.authors[0]) ?? 0) + 1)
  const authors = shuffle([...counts.keys()])
  const out: Card[] = []
  for (let i = 0; i < authors.length && out.length < want; i += 4) {
    const batch = await Promise.all(authors.slice(i, i + 4).map((a) => worksBy(a).catch(() => [] as Doc[])))
    batch.forEach((docs, j) => {
      const a = authors[i + j]
      const pick = docs.find(
        (d) =>
          !mine.keys.has(d.key) &&
          !mine.titles.has(matchKey(d.title, d.author_name?.[0] ?? a)) &&
          !out.some((c) => c.key === d.key),
      )
      if (pick && out.length < want) out.push(docToCard(pick, `Another ${a.split(' ').pop()}`, 'authors'))
    })
  }
  return out
}

// ---------- Building a deck ----------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function cardsFromEntries(entries: Entry[], why: (e: Entry) => string, source: Source, mine: Mine, want: number, avoid: Set<string>) {
  const candidates = shuffle(entries).filter(([t, a]) => !mine.titles.has(matchKey(t, a)) && !avoid.has(matchKey(t, a)))
  const out: Card[] = []
  for (let i = 0; i < candidates.length && out.length < want; i += 4) {
    const batch = await Promise.all(candidates.slice(i, i + 4).map((e) => resolveEntry(e).catch(() => null)))
    batch.forEach((r, j) => {
      if (!r || out.length >= want) return
      if (mine.keys.has(r.key) || out.some((c) => c.key === r.key)) return
      out.push({ ...r, why: why(candidates[i + j]), source })
      avoid.add(matchKey(r.title, r.authors[0] ?? ''))
    })
  }
  return out
}

// How well each 'For you' source has done: 'Read it' and TBR count as hits, 'Not read' as a miss.
const STATS_KEY = 'nb.sourceStats'
type Stats = Record<Source, { hit: number; miss: number }>

function stats(): Stats {
  const blank = { hit: 0, miss: 0 }
  try {
    return { authors: blank, prizes: blank, era: blank, genre: blank, ...JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}') }
  } catch {
    return { authors: blank, prizes: blank, era: blank, genre: blank }
  }
}

export function recordOutcome(source: Source, hit: boolean) {
  const s = stats()
  s[source] = { hit: s[source].hit + (hit ? 1 : 0), miss: s[source].miss + (hit ? 0 : 1) }
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** Splits 15 cards across sources, giving more to sources that produce 'Read it'. */
function forYouSplit(): Record<'authors' | 'prizes' | 'era', number> {
  const s = stats()
  const w = (src: Source) => (s[src].hit + 2) / (s[src].hit + s[src].miss + 4) // starts at 0.5
  const base = { authors: 0.45 * w('authors'), prizes: 0.3 * w('prizes'), era: 0.25 * w('era') }
  const total = base.authors + base.prizes + base.era
  const authors = Math.max(2, Math.round((base.authors / total) * DECK_SIZE))
  const prizes = Math.max(2, Math.round((base.prizes / total) * DECK_SIZE))
  return { authors, prizes, era: Math.max(2, DECK_SIZE - authors - prizes) }
}

const ALL_PRIZES = THEMES.filter((t) => t.group === 'prize')

export async function buildDeck(theme: Theme, mine: Mine): Promise<Card[]> {
  const avoid = new Set<string>()
  if (theme.id === 'authors') return sameAuthorCards(mine, DECK_SIZE)
  if (theme.id === 'foryou') {
    const split = forYouSplit()
    const prizeEntries = ALL_PRIZES.flatMap((t) => t.entries!.map((e) => ({ e, why: t.why!(e) })))
    const eraEntries = Object.entries(DECADES).flatMap(([d, list]) =>
      d === '70s' ? [] : list.map((e) => ({ e, why: `${d} bestseller` })),
    )
    const whyOf = new Map([...prizeEntries, ...eraEntries].map((x) => [matchKey(x.e[0], x.e[1]), x.why]))
    const [a, p, r] = await Promise.all([
      sameAuthorCards(mine, split.authors),
      cardsFromEntries(prizeEntries.map((x) => x.e), (e) => whyOf.get(matchKey(e[0], e[1])) ?? 'Prize winner', 'prizes', mine, split.prizes, avoid),
      cardsFromEntries(eraEntries.map((x) => x.e), (e) => whyOf.get(matchKey(e[0], e[1])) ?? 'Bestseller', 'era', mine, split.era, avoid),
    ])
    const seen = new Set<string>()
    return shuffle([...a, ...p, ...r]).filter((c) => !seen.has(c.key) && seen.add(c.key)).slice(0, DECK_SIZE)
  }
  const source: Source = theme.group === 'prize' ? 'prizes' : theme.group === 'decade' ? 'era' : 'genre'
  return cardsFromEntries(theme.entries!, theme.why!, source, mine, DECK_SIZE, avoid)
}

// ---------- Saved progress (pick up where you left off) ----------

export type DeckState = { cards: Card[]; done: Record<string, 'read' | 'notread' | 'tbr' | 'dnf'>; centre: number }

const deckKey = (themeId: string) => `nb.deck.${themeId}`

export function loadDeckState(themeId: string): DeckState | null {
  try {
    const s = JSON.parse(localStorage.getItem(deckKey(themeId)) ?? 'null') as DeckState | null
    return s && Array.isArray(s.cards) && s.cards.length ? s : null
  } catch {
    return null
  }
}

export function saveDeckState(themeId: string, s: DeckState | null) {
  try {
    if (s) localStorage.setItem(deckKey(themeId), JSON.stringify(s))
    else localStorage.removeItem(deckKey(themeId))
  } catch {
    /* ignore */
  }
}
