// One-off for Ann's import: writes hand-set genres (src/data/genres.json) onto her books,
// so they don't depend on Open Library's patchy subject tags and dates.
// Remove with the rest of the import before go-live (see the spec, 'Data import').
import seed from '../data/genres.json'
import { supabase } from './supabase'
import type { Book } from './types'

const map = seed as Record<string, string>
// Bump the version whenever genres.json changes, so the new list is applied.
const VERSION = 'v3'
const DONE_KEY = 'nb.genreSeed'

const keyOf = (b: Book) => `${b.title}|${(b.authors[0] ?? '').split(' ').pop()!.toLowerCase()}`

export async function seedGenres(books: Book[]): Promise<{ updated: number; error?: string }> {
  try {
    if (localStorage.getItem(DONE_KEY) === VERSION) return { updated: 0 }
  } catch {
    /* no storage: run anyway, it's harmless to repeat */
  }
  // Apply to every imported book whose genre differs from the list (the list is the starting point;
  // after this runs, changes made on the book page are kept because the version is marked done).
  const todo = books.filter((b) => map[keyOf(b)] && b.genre !== map[keyOf(b)])
  let updated = 0
  let error: string | undefined
  for (let i = 0; i < todo.length; i += 20) {
    const results = await Promise.all(
      todo.slice(i, i + 20).map((b) => supabase.from('books').update({ genre: map[keyOf(b)] }).eq('id', b.id).select('id')),
    )
    for (const r of results) {
      if (r.error) error = r.error.message
      else if (r.data?.length) updated++
      else error = 'the database refused the change'
    }
  }
  if (!error) {
    try {
      localStorage.setItem(DONE_KEY, VERSION)
    } catch {
      /* ignore */
    }
  }
  return { updated, error }
}
