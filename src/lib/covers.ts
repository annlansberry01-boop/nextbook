// English covers: Open Library picks a cover from any edition of a work, so a book can
// show its German or Russian cover. These helpers find an English edition's cover instead.
import { supabase } from './supabase'
import { coverUrlFor, type Book } from './types'

type Edition = { title?: string; languages?: { key: string }[]; covers?: number[] }

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^(the|a|an) /, '')
    .replace(/[^a-z0-9]/g, '')

const covers = (e: Edition) => (e.covers ?? []).filter((c) => c > 0)
const langs = (e: Edition) => (e.languages ?? []).map((l) => l.key)
const isEnglish = (e: Edition) => langs(e).includes('/languages/eng')

/**
 * Returns the cover ID to use for a book, preferring an English edition.
 * Returns the current cover if it's already English (or nothing better exists).
 */
export async function englishCoverId(workKey: string, title: string, current: number | null): Promise<number | null> {
  const res = await fetch(`https://openlibrary.org${workKey}/editions.json?limit=100`)
  if (!res.ok) return current
  const editions = ((await res.json()).entries ?? []) as Edition[]
  const t = norm(title)
  const titleMatch = (e: Edition) => !!e.title && norm(e.title).startsWith(t)
  // English-looking: tagged English, or untagged with the English title.
  const english = (e: Edition) => isEnglish(e) || (langs(e).length === 0 && titleMatch(e))

  if (current) {
    // Which edition does the current cover belong to? Keep it unless we know it's not English.
    let owner: Edition | null = editions.find((e) => covers(e).includes(current)) ?? null
    if (!owner) {
      const meta = await fetch(`https://covers.openlibrary.org/b/id/${current}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      const olid: string | undefined = meta?.olid
      // A cover attached to the work itself (…W), or with no record, is left alone.
      if (!olid || !olid.endsWith('M')) return current
      owner = await fetch(`https://openlibrary.org/books/${olid}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      if (!owner) return current
    }
    if (english(owner)) return current
  }

  const best =
    editions.find((e) => isEnglish(e) && titleMatch(e) && covers(e).length) ??
    editions.find((e) => english(e) && covers(e).length) ??
    editions.find((e) => isEnglish(e) && covers(e).length)
  return best ? covers(best)[0] : current
}

const CHECKED_KEY = 'nb.englishCoversChecked'

function checkedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHECKED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function saveChecked(ids: Set<string>) {
  try {
    localStorage.setItem(CHECKED_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

let running = false

/**
 * Goes through the reader's books in the background, a few at a time, and swaps in
 * English covers where needed. Each book is checked once per device.
 * Calls onChanged after each batch that replaced a cover, so the screen can refresh.
 */
export async function fixCoversInBackground(books: Book[], onChanged: () => void) {
  if (running) return
  running = true
  try {
    const done = checkedIds()
    const todo = books.filter((b) => b.ol_work_key && !done.has(b.id))
    for (let i = 0; i < todo.length; i += 3) {
      const batch = todo.slice(i, i + 3)
      let changed = false
      await Promise.all(
        batch.map(async (b) => {
          try {
            const id = await englishCoverId(b.ol_work_key!, b.title, b.cover_id)
            if (id && id !== b.cover_id) {
              const { error } = await supabase.from('books').update({ cover_id: id, cover_url: coverUrlFor(id) }).eq('id', b.id)
              if (!error) changed = true
            }
            done.add(b.id)
          } catch {
            /* network hiccup: try again next time */
          }
        }),
      )
      saveChecked(done)
      if (changed) onChanged()
    }
  } finally {
    running = false
  }
}
