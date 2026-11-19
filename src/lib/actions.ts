// Everything that changes a reader's log: rate, finish, start, DNF, TBR, re-read.
import { supabase } from './supabase'
import type { Book, BookFormat, Reading } from './types'

export type DateChoice =
  | { precision: 'exact'; date: string } // yyyy-mm-dd
  | { precision: 'month'; year: number; month: number } // month 1-12
  | { precision: 'year'; year: number }
  | { precision: 'decade'; decade: number }
  | { precision: 'unknown' }

export type SheetStatus = 'read' | 'reading' | 'tbr' | 'dnf'

export type SheetValues = {
  status: SheetStatus
  rating: number | null
  liked: boolean
  note: string
  format: BookFormat | null
  date: DateChoice
}

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dateFields(c: DateChoice) {
  switch (c.precision) {
    case 'exact':
      return { finished_from: c.date, finished_to: c.date, date_precision: 'exact' as const }
    case 'month': {
      const mm = String(c.month).padStart(2, '0')
      const last = new Date(c.year, c.month, 0).getDate()
      return { finished_from: `${c.year}-${mm}-01`, finished_to: `${c.year}-${mm}-${last}`, date_precision: 'month' as const }
    }
    case 'year':
      return { finished_from: `${c.year}-01-01`, finished_to: `${c.year}-12-31`, date_precision: 'year' as const }
    case 'decade':
      return { finished_from: `${c.decade}-01-01`, finished_to: `${c.decade + 9}-12-31`, date_precision: 'decade' as const }
    default:
      return { finished_from: null, finished_to: null, date_precision: 'unknown' as const }
  }
}

export function dateChoiceOf(r: Pick<Reading, 'finished_from' | 'date_precision'>): DateChoice {
  const y = r.finished_from ? Number(r.finished_from.slice(0, 4)) : 0
  switch (r.date_precision) {
    case 'exact':
      return { precision: 'exact', date: r.finished_from! }
    case 'month':
      return { precision: 'month', year: y, month: Number(r.finished_from!.slice(5, 7)) }
    case 'year':
      return { precision: 'year', year: y }
    case 'decade':
      return { precision: 'decade', decade: y }
    default:
      return { precision: 'unknown' }
  }
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function describeDate(c: DateChoice) {
  switch (c.precision) {
    case 'exact': {
      const [y, m, d] = c.date.split('-').map(Number)
      return `${d} ${MONTHS[m - 1]} ${y}`
    }
    case 'month':
      return `${MONTHS[c.month - 1]} ${c.year}`
    case 'year':
      return String(c.year)
    case 'decade':
      return `${c.decade}s`
    default:
      return 'Not sure when'
  }
}

// Remembers the last format used, so the format chip defaults to it.
export function lastFormat(): BookFormat | null {
  try {
    return (localStorage.getItem('nb.lastFormat') as BookFormat | null) ?? null
  } catch {
    return null
  }
}

function rememberFormat(f: BookFormat | null) {
  try {
    if (f) localStorage.setItem('nb.lastFormat', f)
  } catch {
    /* private mode: ignore */
  }
}

function check<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new Error(res.error.message)
  return res
}

const removeFromTbr = async (bookId: string) =>
  check(await supabase.from('shelf_entries').delete().eq('book_id', bookId).eq('status', 'tbr'))

/**
 * Save what the sheet says about a book.
 * `current` is the reader's latest reading of this book (if any).
 * `newRead` forces a new reading row (Read again).
 */
export async function saveBook(book: Pick<Book, 'id'>, v: SheetValues, current: Reading | null, newRead = false) {
  rememberFormat(v.format)
  const note = v.note.trim() || null
  // Update the latest reading when it's unfinished (reading/DNF) or being edited; otherwise start a new one.
  const editable = current && !newRead && (current.status !== 'read' || v.status === 'read')

  if (v.status === 'tbr') {
    if (current?.status === 'reading') check(await supabase.from('readings').delete().eq('id', current.id))
    check(
      await supabase
        .from('shelf_entries')
        .upsert({ book_id: book.id, status: 'tbr', format: v.format }, { onConflict: 'user_id,book_id' }),
    )
    return 'Added to TBR'
  }

  const row =
    v.status === 'read'
      ? { status: 'read', rating: v.rating, liked: v.liked, note, format: v.format, ...dateFields(v.date) }
      : v.status === 'dnf'
        ? { status: 'dnf', rating: null, liked: v.liked, note, format: v.format, ...dateFields(v.date) }
        : { status: 'reading', format: v.format, started_on: todayIso() }

  if (editable) {
    const patch = v.status === 'reading' && current.status === 'reading' ? { format: v.format } : row
    check(await supabase.from('readings').update(patch).eq('id', current.id))
  } else {
    check(await supabase.from('readings').insert({ book_id: book.id, ...row }))
  }
  await removeFromTbr(book.id)

  if (v.status === 'read') return v.rating ? `Logged · ${v.rating} stars` : 'Logged as read'
  if (v.status === 'dnf') return 'Logged as DNF'
  return 'Moved to Currently reading'
}

export async function loadBookPage(bookId: string) {
  const [book, readings, shelf] = await Promise.all([
    supabase.from('books').select('*').eq('id', bookId).single(),
    supabase.from('readings').select('*, book:books(*)').eq('book_id', bookId).order('created_at', { ascending: false }),
    supabase.from('shelf_entries').select('*').eq('book_id', bookId).maybeSingle(),
  ])
  if (book.error) throw new Error(book.error.message)
  return {
    book: book.data as Book,
    readings: (readings.data ?? []) as Reading[],
    onTbr: shelf.data?.status === 'tbr',
  }
}

export async function latestReading(bookId: string): Promise<Reading | null> {
  const { data } = await supabase
    .from('readings')
    .select('*, book:books(*)')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })
    .limit(1)
  return ((data ?? [])[0] as Reading) ?? null
}

// Tiny app-wide toast.
export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('nb-toast', { detail: msg }))
