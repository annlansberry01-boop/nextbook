// Background tidy-ups that run once you're signed in, whichever page you open:
// hand-set genres for the import, then English covers. Pages listening with
// useDataChanged() refresh when something changes.
import { useEffect } from 'react'
import { toast } from './actions'
import { fixCoversInBackground } from './covers'
import { allMyBooks } from './data'
import { seedGenres } from './genreSeed'

const EVENT = 'nb-data-changed'
export const dataChanged = () => window.dispatchEvent(new Event(EVENT))

export function useDataChanged(fn: () => void) {
  useEffect(() => {
    window.addEventListener(EVENT, fn)
    return () => window.removeEventListener(EVENT, fn)
  }, [fn])
}

let started = false

export async function runMaintenance() {
  if (started) return
  started = true
  try {
    const books = await allMyBooks()
    if (!books.length) {
      started = false // nothing imported yet; try again after the import
      return
    }
    const seeded = await seedGenres(books)
    if (seeded.updated) {
      toast(`Genres set for ${seeded.updated} books`)
      dataChanged()
    }
    if (seeded.error) toast(`Couldn't set genres: ${seeded.error}`)
    await fixCoversInBackground(books, dataChanged)
  } catch (e) {
    console.error('Background tidy-up failed', e)
    started = false
  }
}
