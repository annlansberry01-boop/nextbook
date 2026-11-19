import { supabase } from './supabase'
import type { Reading, ReviewItem, ShelfEntry } from './types'

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
  const finished = all
    .filter((r) => r.status === 'read')
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
    tbr: (shelf.data ?? []) as ShelfEntry[],
    toCheck: (review.data ?? []) as ReviewItem[],
    isEmpty: all.length === 0 && (shelf.data ?? []).length === 0 && (review.data ?? []).length === 0,
  }
}
