export type ReadingStatus = 'reading' | 'read' | 'dnf'
export type BookFormat = 'print' | 'ebook' | 'audio'
export type DatePrecision = 'exact' | 'year' | 'decade' | 'unknown'

export type Book = {
  id: string
  title: string
  authors: string[]
  year: number | null
  ol_work_key: string | null
  cover_id: number | null
  cover_url: string | null
  page_count: number | null
  genre: string | null
  subjects: string[]
}

export type Reading = {
  id: string
  book_id: string
  status: ReadingStatus
  rating: number | null
  liked: boolean
  note: string | null
  format: BookFormat | null
  started_on: string | null
  finished_from: string | null
  finished_to: string | null
  date_precision: DatePrecision
  created_at: string
  book: Book
}

export type ShelfEntry = {
  id: string
  book_id: string
  status: 'tbr' | 'dismissed'
  position: number | null
  format: BookFormat | null
  date_added: string
  book: Book
}

export type ReviewItem = {
  id: string
  raw_title: string
  raw_author: string | null
  status: string | null
  rating: number | null
  resolved: boolean
}

export const coverUrlFor = (coverId: number | null) =>
  coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null
