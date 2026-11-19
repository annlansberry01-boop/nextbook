// Sorts a book into one of a short fixed list of genres, from Open Library's subject tags.
// A genre set by hand (books.genre) always wins.
import type { Book } from './types'

export const GENRES = ['Sci-fi', 'Fantasy', 'Crime', 'Gothic', 'Historical', 'Literary', 'Contemporary'] as const
export type Genre = (typeof GENRES)[number]

// Order matters for ties: earlier wins (e.g. Rebecca is gothic before crime).
const RULES: [Genre, RegExp][] = [
  ['Gothic', /gothic|horror|ghost|vampire|haunted/],
  ['Crime', /crime|detective|mystery|murder|thriller|suspense|police|noir/],
  ['Sci-fi', /science.?fiction|sci-fi|dystopi|time travel|space (opera|warfare)|robot|artificial intelligence|extraterrestrial|interplanetary|cyberpunk|alien/],
  ['Fantasy', /fantasy|magic|wizard|dragon|fairies|discworld|witches/],
  ['Historical', /historical|biographical fiction|history|world war|vietnam war|civil war|victorian/],
  ['Literary', /literary|classic|literature|booker/],
  ['Contemporary', /contemporary/],
]

export function guessGenre(subjects: string[], year: number | null): Genre {
  const text = subjects.map((s) => s.toLowerCase())
  let best: Genre | null = null
  let bestScore = 0
  for (const [genre, re] of RULES) {
    const score = text.filter((s) => re.test(s)).length
    if (score > bestScore) {
      best = genre
      bestScore = score
    }
  }
  if (best) return best
  // No useful tags: newer books default to Contemporary, older ones to Literary.
  return year == null || year >= 2000 ? 'Contemporary' : 'Literary'
}

export const genreOf = (b: Pick<Book, 'genre' | 'subjects' | 'year'>): Genre =>
  (GENRES as readonly string[]).includes(b.genre ?? '') ? (b.genre as Genre) : guessGenre(b.subjects ?? [], b.year)
