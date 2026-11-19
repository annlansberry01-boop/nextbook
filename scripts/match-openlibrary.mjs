// Matches each row of data/reading-log.csv to an Open Library work.
// Output: src/data/import.json, bundled into the app for the one-time import.
// Run: node scripts/match-openlibrary.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const UA = 'NextBook/0.1 (personal reading tracker)'
const FIELDS = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseCsv(text) {
  const rows = []
  for (const line of text.trim().split(/\r?\n/)) {
    const cells = []
    let cur = ''
    let quoted = false
    for (const ch of line) {
      if (ch === '"') quoted = !quoted
      else if (ch === ',' && !quoted) {
        cells.push(cur)
        cur = ''
      } else cur += ch
    }
    cells.push(cur)
    rows.push(cells)
  }
  const [head, ...body] = rows
  return body.map((c) => Object.fromEntries(head.map((h, i) => [h, c[i] ?? ''])))
}

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^(the|a|an) /, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const surname = (name) => norm(name).split(' ').pop()

const exactTitle = (want, got) => norm(want) === norm(got)

// Exact title, or the same title followed by a subtitle/edition note ("Title: ..." or "Title (...)").
// Rejects different works that merely start the same way ("... and Other Stories", "... Trilogy Box").
function titleOk(want, got) {
  if (exactTitle(want, got)) return true
  const g = got.toLowerCase().replace(/&/g, 'and').replace(/\bmr\.|\bmrs\./g, (m) => m.slice(0, -1))
  const w = want.toLowerCase().replace(/&/g, 'and')
  return g.startsWith(w) && /^\s*[:(]/.test(g.slice(w.length))
}

function authorOk(authors, docAuthors = []) {
  if (!authors.length) return true
  const have = docAuthors.map(norm).join(' | ')
  return authors.some((a) => have.includes(surname(a)))
}

async function search(params) {
  const url = `https://openlibrary.org/search.json?${new URLSearchParams({ ...params, limit: '10', fields: FIELDS })}`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.ok) return (await res.json()).docs ?? []
    } catch {
      /* retry */
    }
    await sleep(2000 * (attempt + 1))
  }
  return []
}

function pick(docs, title, authors) {
  const good = docs.filter((d) => titleOk(title, d.title) && authorOk(authors, d.author_name))
  // Prefer an exact title with a cover; otherwise the first acceptable match.
  return (
    good.find((d) => exactTitle(title, d.title) && d.cover_i) ??
    good.find((d) => d.cover_i) ??
    good.find((d) => exactTitle(title, d.title)) ??
    good[0]
  )
}

// Translated classics are filed under their original-language title on Open Library,
// so search misses them or finds a minor edition. Pin these to the main work.
const PINNED = {
  'Anna Karenina': '/works/OL267096W',
  'The Three-Body Problem': '/works/OL17267881W',
  'The Girl with the Dragon Tattoo': '/works/OL5784622W',
  'The Shadow of the Wind': '/works/OL278437W',
  "Foucault's Pendulum": '/works/OL8996438W',
  'The Name of the Rose': '/works/OL8996439W',
  MaddAddam: '/works/OL17046610W',
}

const rows = parseCsv(readFileSync('data/reading-log.csv', 'utf8'))
// ONLY="Title A|Title B" re-matches just those rows and keeps the rest of src/data/import.json.
const only = process.env.ONLY ? new Set(process.env.ONLY.split('|')) : null
const previous = only ? JSON.parse(readFileSync('src/data/import.json', 'utf8')) : []
const out = []
let matched = 0

for (const [i, r] of rows.entries()) {
  if (only && !only.has(r.title)) {
    const prev = previous.find((p) => p.title === r.title && p.status === r.status && (p.authors[0] ?? '') === (r.author.split(';')[0]?.trim() ?? ''))
    if (prev) {
      out.push(prev)
      if (prev.match) matched++
      continue
    }
  }
  const authors = r.author ? r.author.split(';').map((s) => s.trim()) : []
  let docs = []
  let doc
  if (PINNED[r.title]) {
    doc = (await search({ q: `key:"${PINNED[r.title]}"` }))[0]
  } else {
    docs = await search({ title: r.title, ...(authors[0] ? { author: authors[0] } : {}) })
    doc = pick(docs, r.title, authors)
  }
  if (!doc && !PINNED[r.title]) {
    await sleep(700)
    docs = await search({ q: `${r.title} ${authors[0] ? surname(authors[0]) : ''}`.trim() })
    doc = pick(docs, r.title, authors)
  }

  const entry = {
    title: r.title,
    authors,
    status: r.status,
    rating: r.rating ? Number(r.rating) : null,
    format: r.format || null,
    queue: r.queue ? Number(r.queue) : null,
    note: r.note || null,
    match: doc
      ? {
          ol_work_key: doc.key,
          ol_title: doc.title,
          ol_authors: doc.author_name ?? [],
          year: doc.first_publish_year ?? null,
          cover_id: doc.cover_i ?? null,
          page_count: doc.number_of_pages_median ?? null,
          subjects: (doc.subject ?? []).slice(0, 12),
        }
      : null,
  }
  if (doc) matched++
  out.push(entry)
  console.log(`${String(i + 1).padStart(3)}/${rows.length} ${doc ? 'OK  ' : 'MISS'} ${r.title}${doc ? `  ->  ${doc.title} (${doc.key}${doc.cover_i ? '' : ', no cover'})` : ''}`)
  await sleep(700)
}

mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/import.json', JSON.stringify(out, null, 2))
console.log(`\nMatched ${matched} of ${rows.length}. Wrote src/data/import.json`)
