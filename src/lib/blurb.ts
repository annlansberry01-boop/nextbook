// A short description of a book for the Discover card: Open Library first, Google Books as a
// fallback. Both are free with no key. Each description is fetched once and remembered on this device.

const KEY = 'nb.blurb.v1'
let store: Record<string, string> | null = null

function cache() {
  if (!store) {
    try {
      store = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    } catch {
      store = {}
    }
  }
  return store!
}

function remember(workKey: string, text: string) {
  const c = cache()
  c[workKey] = text
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* storage full: fine, we'll fetch again next time */
  }
}

/** Tidies catalogue text: drops links, source notes and 'Also contained in' lists; trims to a few sentences. */
function clean(raw: string) {
  let t = raw
    .replace(/<[^>]+>/g, ' ') // html
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links
    .replace(/\(\[source\]\[\d+\]\)/gi, '')
    .replace(/\[\d+\]:\s*\S+/g, '')
    .split(/\n-{3,}|\n\*\*Also contained in|\nContains:|\n\s*\(source:/i)[0]
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length > 600) {
    const cut = t.slice(0, 600)
    const end = cut.lastIndexOf('. ')
    t = (end > 200 ? cut.slice(0, end + 1) : cut.trimEnd() + '…').trim()
  }
  return t
}

async function fromOpenLibrary(workKey: string): Promise<string> {
  const res = await fetch(`https://openlibrary.org${workKey}.json`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return ''
  const j = await res.json()
  const d = typeof j.description === 'string' ? j.description : (j.description?.value ?? '')
  return d ? clean(d) : ''
}

async function fromGoogleBooks(title: string, author: string): Promise<string> {
  const q = `intitle:"${title}"${author ? ` inauthor:"${author.split(' ').pop()}"` : ''}`
  const url = `https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({ q, maxResults: '5', printType: 'books', fields: 'items(volumeInfo(description,language))' })}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return ''
  type Item = { volumeInfo?: { description?: string; language?: string } }
  const items = ((await res.json()).items ?? []) as Item[]
  const best = items.find((i) => i.volumeInfo?.description && (i.volumeInfo.language ?? 'en') === 'en') ?? items.find((i) => i.volumeInfo?.description)
  return best?.volumeInfo?.description ? clean(best.volumeInfo.description) : ''
}

/** Returns a description, or '' if none could be found. Never throws. */
export async function getBlurb(workKey: string, title: string, author: string): Promise<string> {
  const c = cache()
  if (workKey in c) return c[workKey]
  let text = ''
  let answered = false // only remember 'no description' if a service actually answered
  try {
    text = await fromOpenLibrary(workKey)
    answered = true
  } catch {
    /* fall through */
  }
  // Very short catalogue notes aren't much help; try Google Books for something fuller.
  if (text.length < 80) {
    try {
      const g = await fromGoogleBooks(title, author)
      answered = true
      if (g.length > text.length) text = g
    } catch {
      /* none */
    }
  }
  if (answered) remember(workKey, text)
  return text
}

export const peekBlurb = (workKey: string): string | undefined => cache()[workKey]
