import { dateChoiceOf, describeDate } from './actions'
import { supabase } from './supabase'
import type { Reading, ShelfEntry } from './types'

export async function loadMyBooks() {
  const [readings, shelf] = await Promise.all([
    supabase.from('readings').select('*, book:books(*)').order('created_at', { ascending: false }),
    supabase.from('shelf_entries').select('*, book:books(*)').eq('status', 'tbr').order('date_added', { ascending: false }),
  ])
  if (readings.error) throw new Error(readings.error.message)
  if (shelf.error) throw new Error(shelf.error.message)
  const all = (readings.data ?? []) as Reading[]
  const tbr = (shelf.data ?? []) as ShelfEntry[]

  // Latest reading per book decides where it shows (Read, DNF, Reading).
  const latest = new Map<string, Reading>()
  for (const r of all) if (!latest.has(r.book_id)) latest.set(r.book_id, r)
  const latestList = [...latest.values()]
  // For Read: the latest *finished* read of each book (a re-read in progress keeps its last rating).
  const lastRead = new Map<string, Reading>()
  for (const r of all) if (r.status === 'read' && !lastRead.has(r.book_id)) lastRead.set(r.book_id, r)

  return {
    all,
    read: [...lastRead.values()],
    dnf: latestList.filter((r) => r.status === 'dnf'),
    liked: [...lastRead.values()].filter((r) => r.liked),
    tbr,
  }
}

/** Newest first; dated reads before undated ones. */
export const byDate = (a: Reading, b: Reading) => {
  const da = a.finished_to ?? ''
  const db = b.finished_to ?? ''
  if (da !== db) return db.localeCompare(da)
  return b.created_at.localeCompare(a.created_at)
}

export const surname = (r: { book: { authors: string[] } }) => (r.book.authors[0] ?? '').split(' ').pop()!.toLowerCase()

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Downloads the reader's whole log as a CSV file. */
export async function exportCsv() {
  const { all, tbr } = await loadMyBooks()
  const head = ['title', 'authors', 'year', 'status', 'rating', 'liked', 'format', 'when', 'finished_from', 'finished_to', 'date_precision', 'started_on', 'note', 'date_added', 'open_library_key']
  const rows = [
    ...all.map((r) => [
      r.book.title,
      r.book.authors.join('; '),
      r.book.year,
      r.status,
      r.rating,
      r.liked ? 'yes' : '',
      r.format,
      r.status === 'reading' ? '' : describeDate(dateChoiceOf(r)),
      r.finished_from,
      r.finished_to,
      r.date_precision,
      r.started_on,
      r.note,
      r.created_at.slice(0, 10),
      r.book.ol_work_key,
    ]),
    ...tbr.map((s) => [s.book.title, s.book.authors.join('; '), s.book.year, 'tbr', '', '', s.format, '', '', '', '', '', '', s.date_added.slice(0, 10), s.book.ol_work_key]),
  ]
  const csv = [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  a.href = url
  a.download = `next-book-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return rows.length
}
