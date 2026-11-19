// Book search (Open Library) and adding a result to the shared catalogue.
import { supabase } from './supabase'
import { coverUrlFor, type Book } from './types'

export type SearchResult = {
  key: string // Open Library work key
  title: string
  authors: string[]
  year: number | null
  cover_id: number | null
  page_count: number | null
  subjects: string[]
}

const FIELDS = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject,edition_count'

export async function searchBooks(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const url = `https://openlibrary.org/search.json?${new URLSearchParams({ q: query, limit: '20', fields: FIELDS })}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Open Library is not responding (${res.status})`)
  const json = await res.json()
  type Doc = {
    key: string
    title: string
    author_name?: string[]
    first_publish_year?: number
    cover_i?: number
    number_of_pages_median?: number
    subject?: string[]
  }
  return ((json.docs ?? []) as Doc[]).map((d) => ({
    key: d.key,
    title: d.title,
    authors: d.author_name?.slice(0, 3) ?? [],
    year: d.first_publish_year ?? null,
    cover_id: d.cover_i ?? null,
    page_count: d.number_of_pages_median ?? null,
    subjects: (d.subject ?? []).slice(0, 12),
  }))
}

/** Adds a search result to the catalogue (if it isn't there yet) and returns the catalogue book. */
export async function ensureBook(r: SearchResult): Promise<Book> {
  const ins = await supabase.from('books').upsert(
    {
      title: r.title,
      authors: r.authors,
      year: r.year,
      ol_work_key: r.key,
      cover_id: r.cover_id,
      cover_url: coverUrlFor(r.cover_id),
      page_count: r.page_count,
      subjects: r.subjects,
    },
    { onConflict: 'ol_work_key', ignoreDuplicates: true },
  )
  if (ins.error) throw new Error(ins.error.message)
  const { data, error } = await supabase.from('books').select('*').eq('ol_work_key', r.key).single()
  if (error) throw new Error(error.message)
  return data as Book
}

export type MyStatus = 'reading' | 'read' | 'dnf' | 'tbr'

/** What the reader already has, keyed by Open Library work key, so results can say 'On your TBR' etc. */
export async function myBookStatuses(): Promise<Map<string, { id: string; status: MyStatus }>> {
  const [readings, shelf] = await Promise.all([
    supabase.from('readings').select('status, created_at, book:books(id, ol_work_key)').order('created_at', { ascending: true }),
    supabase.from('shelf_entries').select('status, book:books(id, ol_work_key)').eq('status', 'tbr'),
  ])
  const map = new Map<string, { id: string; status: MyStatus }>()
  type Row = { status: string; book: { id: string; ol_work_key: string | null } | null }
  for (const r of (shelf.data ?? []) as unknown as Row[])
    if (r.book?.ol_work_key) map.set(r.book.ol_work_key, { id: r.book.id, status: 'tbr' })
  // Readings come oldest first, so the latest one wins.
  for (const r of (readings.data ?? []) as unknown as Row[])
    if (r.book?.ol_work_key) map.set(r.book.ol_work_key, { id: r.book.id, status: r.status as MyStatus })
  return map
}
