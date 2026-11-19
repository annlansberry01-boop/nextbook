// One-time import of Ann's reading log (src/data/import.json, built by scripts/match-openlibrary.mjs).
import data from '../data/import.json'
import { supabase } from './supabase'
import { coverUrlFor, type BookFormat } from './types'

type Row = {
  title: string
  authors: string[]
  status: 'read' | 'reading' | 'dnf' | 'tbr'
  rating: number | null
  format: BookFormat | null
  queue: number | null
  note: string | null
  match: {
    ol_work_key: string
    ol_title: string
    ol_authors: string[]
    year: number | null
    cover_id: number | null
    page_count: number | null
    subjects: string[]
  } | null
}

const rows = data as Row[]
export const importSize = rows.length

const chunk = <T,>(arr: T[], n: number) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export async function hasAnyData(): Promise<boolean> {
  const counts = await Promise.all(
    ['readings', 'shelf_entries', 'import_review'].map((t) =>
      supabase.from(t).select('id', { count: 'exact', head: true }),
    ),
  )
  return counts.some((c) => (c.count ?? 0) > 0)
}

export async function runImport(onStep: (msg: string) => void) {
  if (await hasAnyData()) throw new Error('Your books are already imported.')

  const matched = rows.filter((r) => r.match)
  const unmatched = rows.filter((r) => !r.match)

  // 1. Add each book to the shared catalogue (skip any already there).
  onStep('Adding books to the catalogue…')
  const seen = new Map<string, Row['match'] & object>()
  for (const r of matched) seen.set(r.match!.ol_work_key, r.match!)
  const bookRows = [...seen.values()].map((m) => {
    const csvRow = matched.find((r) => r.match!.ol_work_key === m.ol_work_key)!
    return {
      // Keep Ann's spelling of title and author; Open Library supplies the rest.
      title: csvRow.title,
      authors: csvRow.authors.length ? csvRow.authors : m.ol_authors,
      year: m.year,
      ol_work_key: m.ol_work_key,
      cover_id: m.cover_id,
      cover_url: coverUrlFor(m.cover_id),
      page_count: m.page_count,
      subjects: m.subjects,
    }
  })
  for (const part of chunk(bookRows, 50)) {
    must(await supabase.from('books').upsert(part, { onConflict: 'ol_work_key', ignoreDuplicates: true }))
  }

  // 2. Look up the catalogue IDs.
  const idByKey = new Map<string, string>()
  for (const part of chunk([...seen.keys()], 80)) {
    const found = must(await supabase.from('books').select('id, ol_work_key').in('ol_work_key', part))
    for (const b of found ?? []) idByKey.set(b.ol_work_key!, b.id)
  }

  // 3. Your readings (read, reading, DNF). Imported dates are 'Not sure'.
  onStep('Adding your ratings…')
  const readings = matched
    .filter((r) => r.status !== 'tbr')
    .map((r) => ({
      book_id: idByKey.get(r.match!.ol_work_key)!,
      status: r.status,
      rating: r.status === 'dnf' ? null : r.rating,
      format: r.format,
      note: r.status === 'read' && r.note === 'Needs rating' ? null : r.note,
      date_precision: 'unknown' as const,
    }))
  for (const part of chunk(readings, 100)) must(await supabase.from('readings').insert(part))

  // 4. Your TBR shelf, keeping the queue order.
  onStep('Filling your TBR…')
  const shelf = matched
    .filter((r) => r.status === 'tbr')
    .map((r) => ({
      book_id: idByKey.get(r.match!.ol_work_key)!,
      status: 'tbr' as const,
      position: r.queue,
      format: r.format,
    }))
  if (shelf.length) must(await supabase.from('shelf_entries').upsert(shelf, { onConflict: 'user_id,book_id' }))

  // 5. Anything Open Library couldn't find goes on the 'Check these' list.
  if (unmatched.length) {
    onStep('Listing books to check…')
    must(
      await supabase.from('import_review').insert(
        unmatched.map((r) => ({
          raw_title: r.title,
          raw_author: r.authors.join('; ') || null,
          status: r.status,
          rating: r.rating,
          format: r.format,
          note: r.note,
        })),
      ),
    )
  }

  return { books: readings.length + shelf.length, toCheck: unmatched.length }
}
