// One-off for Ann's import: writes hand-set genres (src/data/genres.json) onto her books,
// so they don't depend on Open Library's patchy subject tags and dates.
// Remove with the rest of the import before go-live (see the spec, 'Data import').
import seed from '../data/genres.json'
import { supabase } from './supabase'
import type { Book } from './types'

const map = seed as Record<string, string>
const DONE_KEY = 'nb.genreSeed.v1'

export async function seedGenres(books: Book[], onChanged: () => void) {
  try {
    if (localStorage.getItem(DONE_KEY)) return
  } catch {
    /* no storage: run anyway, it's harmless to repeat */
  }
  const keyOf = (b: Book) => `${b.title}|${(b.authors[0] ?? '').split(' ').pop()!.toLowerCase()}`
  const todo = books.filter((b) => !b.genre && map[keyOf(b)])
  let failed = false
  for (let i = 0; i < todo.length; i += 20) {
    const results = await Promise.all(
      todo.slice(i, i + 20).map((b) => supabase.from('books').update({ genre: map[keyOf(b)] }).eq('id', b.id)),
    )
    if (results.some((r) => r.error)) failed = true
  }
  if (!failed) {
    try {
      localStorage.setItem(DONE_KEY, '1')
    } catch {
      /* ignore */
    }
  }
  if (todo.length) onChanged()
}
