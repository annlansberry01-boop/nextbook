// Sorts a book into one of a short fixed list of bookshop-style genres, from Open Library's
// subject tags and first-published year. A genre set by hand (books.genre) always wins.
import type { Book } from './types'

export const GENRES = [
  'Science fiction',
  'Fantasy',
  'Crime & thriller',
  'Gothic & horror',
  'Historical fiction',
  'Literary fiction',
  'Contemporary fiction',
  'Classics',
] as const
export type Genre = (typeof GENRES)[number]

// Before this year a book counts as a Classic, unless it's science fiction, fantasy or crime.
const CLASSIC_BEFORE = 1960
const KEEPS_GENRE: Genre[] = ['Science fiction', 'Fantasy', 'Crime & thriller']

// Order matters for ties: earlier wins (e.g. Rebecca is gothic before crime).
const RULES: [Genre, RegExp][] = [
  ['Gothic & horror', /gothic|horror|ghost|vampire|haunted/],
  ['Crime & thriller', /crime|detective|mystery|murder|thriller|suspense|police|noir/],
  ['Science fiction', /science.?fiction|sci-fi|dystopi|time travel|space (opera|warfare)|robot|artificial intelligence|extraterrestrial|interplanetary|cyberpunk|alien/],
  ['Fantasy', /fantasy|magic|wizard|dragon|fairies|discworld|witches/],
  ['Historical fiction', /historical|biographical fiction|history|world war|vietnam war|civil war|victorian/],
  ['Literary fiction', /literary|booker/],
  ['Contemporary fiction', /contemporary/],
]

// Names used before 20 Nov 2026, so genres already set by hand still work.
const OLD_NAMES: Record<string, Genre> = {
  'Sci-fi': 'Science fiction',
  Crime: 'Crime & thriller',
  Gothic: 'Gothic & horror',
  Historical: 'Historical fiction',
  Literary: 'Literary fiction',
  Contemporary: 'Contemporary fiction',
}

// 'Literary' and 'contemporary' describe register, not subject, so a specific genre always beats them
// (Wolf Hall is Historical fiction even though it's also literary).
const GENERAL: Genre[] = ['Literary fiction', 'Contemporary fiction']

export function guessGenre(subjects: string[], year: number | null): Genre {
  const text = subjects.map((s) => s.toLowerCase())
  let best: Genre | null = null
  let bestScore = 0
  for (const [genre, re] of RULES) {
    if (best && !GENERAL.includes(best) && GENERAL.includes(genre)) break
    const score = text.filter((s) => re.test(s)).length
    if (score > bestScore) {
      best = genre
      bestScore = score
    }
  }
  // A single stray tag (Dorian Gray tagged 'fantasy') isn't enough to stop an old book being a Classic.
  if (year != null && year < CLASSIC_BEFORE && !(best && KEEPS_GENRE.includes(best) && bestScore >= 2)) return 'Classics'
  if (best) return best
  // No useful tags: newer books default to Contemporary fiction, older ones to Literary fiction.
  return year == null || year >= 2000 ? 'Contemporary fiction' : 'Literary fiction'
}

export function genreOf(b: Pick<Book, 'genre' | 'subjects' | 'year'>): Genre {
  const set = b.genre ? (OLD_NAMES[b.genre] ?? b.genre) : null
  if (set && (GENRES as readonly string[]).includes(set)) return set as Genre
  return guessGenre(b.subjects ?? [], b.year)
}
