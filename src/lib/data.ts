import { supabase } from './supabase'
import type { Book, Reading, ReviewItem, ShelfEntry } from './types'

/** Every book the reader has (read, reading, DNF or TBR), once each. */
export async function allMyBooks(): Promise<Book[]> {
  const [r, s] = await Promise.all([
    supabase.from('readings').select('book:books(*)'),
    supabase.from('shelf_entries').select('book:books(*)'),
  ])
  const map = new Map<string, Book>()
  for (const row of [...(r.data ?? []), ...(s.data ?? [])] as unknown as { book: Book | null }[])
    if (row.book) map.set(row.book.id, row.book)
  return [...map.values()]
}

export async function loadHome() {
  const [readings, shelf, review] = await Promise.all([
    supabase.from('readings').select('*, book:books(*)').order('created_at', { ascending: false }),
    supabase
      .from('shelf_entries')
      .select('*, book:books(*)')
      .eq('status', 'tbr')
      .order('position', { ascending: true, nullsFirst: false })
      .order('date_added', { ascending: false }),
    supabase.from('import_review').select('*').eq('resolved', false),
  ])
  for (const r of [readings, shelf, review]) if (r.error) throw new Error(r.error.message)

  const all = (readings.data ?? []) as Reading[]
  const tbr = (shelf.data ?? []) as ShelfEntry[]
  // A book back on the TBR, or being read again, belongs in that row, not in Recently read.
  const busy = new Set([...tbr.map((s) => s.book_id), ...all.filter((r) => r.status === 'reading').map((r) => r.book_id)])
  // Only the latest reading of each book counts for Recently read.
  const latestByBook = new Map<string, Reading>()
  for (const r of all) if (!latestByBook.has(r.book_id)) latestByBook.set(r.book_id, r)
  const finished = [...latestByBook.values()]
    .filter((r) => r.status === 'read' && !busy.has(r.book_id))
    .sort((a, b) => {
      // Unrated first (they need attention), then most recently finished or added.
      if ((a.rating == null) !== (b.rating == null)) return a.rating == null ? -1 : 1
      const da = a.finished_to ?? a.created_at
      const db = b.finished_to ?? b.created_at
      return db.localeCompare(da)
    })

  return {
    reading: all.filter((r) => r.status === 'reading'),
    recent: finished.slice(0, 12),
    tbr,
    toCheck: (review.data ?? []) as ReviewItem[],
    isEmpty: all.length === 0 && (shelf.data ?? []).length === 0 && (review.data ?? []).length === 0,
  }
}
