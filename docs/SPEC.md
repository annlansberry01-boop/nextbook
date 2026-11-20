# Next Book app: v1 spec

As of 11 Nov 2026 · Ann

## Purpose and principles

Next Book is a mobile-first web app that makes logging, rating and choosing books fast enough to do in a spare minute. It is built for Ann first, structured so other readers can be added later without a rebuild.

**V1 is done when** all four core features work end to end: log, rate, carousel backfill, next-read suggestion. The diary timeline is in v1; stats are not.

Design principles:

- **Two taps to log.** Any book can be marked read and rated in two taps from wherever it appears.
- **Fuzzy is fine.** Old reads never block on a precise date.
- **Ratings are high-signal.** Ann reads selectively, so low ratings and DNFs carry real weight in recommendations.
- **DNF is not a low rating.** It is its own status, with an optional reason.
- **Explain the pick.** Every recommendation can show why it was suggested.
- **Multi-user ready.** Every record belongs to a user ID from day one, even while there is only one user.

## Data model

Three core records: a **Book** (shared catalogue data), a **Reading** (one user's experience of one book, one row per read), and a **Shelf entry** (status for books not yet read or dismissed).

| Record | Field | Type | Notes |
| --- | --- | --- | --- |
| Book | id, title, author(s), year, cover URL, page count, audio length (hrs), genre | catalogue | Pulled from a public book API; audio length optional |
| Book | dimension profile | 9 scores, 1-5 | Hidden. AI-scored once per book, reused for all users |
| Reading | user ID, book ID | keys | One row per read; a re-read is a new row |
| Reading | status | Reading / Read / DNF | DNF kept separate from ratings |
| Reading | rating | 0.5-5, half steps | Required for Read; not used for DNF |
| Reading | liked | yes/no | Like heart, independent of the rating |
| Reading | note | text, optional | One-line reaction, or DNF reason |
| Reading | format | Print / Ebook / Audio | Filter tag only |
| Reading | date finished | exact date or fuzzy range | See Feature 1 |
| Reading | date precision | exact / year / decade / unknown | Drives display and sorting |
| Shelf entry | status, date added | TBR / Not read (dismissed) | Dismissed books never reappear in the carousel |
| User | id, name, birth year (optional), preferences | profile | Ready for more users later |

The 9 dimensions are: Ideas Density, Literary Register, Pacing, Thematic Weight, Structural Ambition, World-building, Emotional Register (1 bleak to 5 warm), Warmth & Wit, Social Consciousness (1 apolitical to 5 centrally socially conscious). See `data/rating-framework.md`.

## Feature 1: Log and rate

Any book can be logged in two taps: mark it read, tap a star rating. Note, format and date are optional and pre-filled where possible.

**Three ways to add, from one '+' button** (each ends with the same choice: TBR, Read it, Reading now, DNF; TBR is the default)

1. **Search.** Type a title or author; tap a result.
2. **Snap a cover.** Take a photo of a cover or spine, or pick one from the camera roll. AI reads the title and author, matches it to the catalogue and shows the match to confirm. A photo of a shelf or a stacked bedside pile returns each spine as a tick-list, all pre-ticked for TBR. Spine text often runs sideways, so the reader handles rotated text, and any spine it can't read is shown cropped for Ann to identify or skip.
3. **Paste a list.** Paste any text with titles in it (an article, a friend's message, a reading list). The app pulls out each title, matches it, and shows a tick-list with covers. Unmatched lines are flagged to fix or skip; books already logged are marked so they aren't added twice.

**Rating**

- 1-5 stars with half stars (tap once for full, tap again for half).
- Optional one-line note under the stars, and a Like heart beside them, independent of the rating.
- Format chip: Print / Ebook / Audio (defaults to last used).

**Dating a read**

- **New reads:** finishing a book in the app stamps today's date automatically. Editable.
- **Back-catalogue (carousel and manual adds):** fuzzy picker. Step 1, pick a decade (1980s, 1990s, 2000s...). Step 2, optionally pick a year in that decade. Step 3, or tap Not sure.
- Stored as a range (e.g. 2000-2009 for a decade) plus a precision flag, so sorting still works.

**Re-reads**

- Tapping Read again on a finished book creates a new Reading with today's date.
- The previous rating is pre-filled; it only changes if Ann actively changes it.
- The book page shows read history: each date and rating.

**DNF**

- Logged with an optional reason (e.g. content, pacing, not in the mood).
- No star rating. Shown in its own list, never averaged into ratings.

## Feature 2: 'Might have read' carousel

The carousel backfills reading history in short bursts: a deck of 15 cards, swipe or tap to act. A progress counter shows 'Card 6 of 15'; Ann can stop anytime and pick up later.

**Layout:** a curved (concave) carousel showing 7 covers at once. The centre cover is larger, outlined in the accent colour and fully bright; side covers angle inward and are dimmed. Tapping a side cover brings it to the centre. See `docs/design/Discover.dc.html`.

**Card content:** cover, title, author, year, and a one-line 'why you're seeing this' (e.g. 'Another McEwan', 'Booker Prize 1998').

**Card actions**

| Action | Gesture | Result |
| --- | --- | --- |
| Read it | Swipe right | Opens quick rate: stars, Like, fuzzy date, optional note |
| Not read | Swipe left | Dismissed for good |
| Add to TBR | Swipe up | Saved to TBR |
| Started, didn't finish | Tap DNF button | Logged as DNF, optional reason |

**Where 'For you' suggestions come from** (mixed in each deck, weighted to what's producing 'Read it' hits):

1. **Same authors** as books already logged, excluding titles already logged or dismissed.
2. **Classics and prize lists:** Booker, Hugo, Nebula, Miles Franklin, Stella, Pulitzer, a 1001-books-style canon.
3. **Similar to 5-star books:** AI picks titles close to her top-rated books on the 9-dimension profile.
4. **Big sellers by era:** bestsellers from years she was likely reading them.

**Learning:** if a source keeps producing 'Not read', its share of the deck drops. A deck never repeats a dismissed or logged book.

**Themed decks**

The carousel opens on the personalised 'For you' deck. A row of theme chips above it switches to a themed deck in one tap; 'For you' is always the first chip.

| Group | Preset themes |
| --- | --- |
| Curated | Top 250 novels |
| Decades | 70s, 80s, 90s, 2000s, 2010s, 2020s: bestsellers and notable books |
| Prizes | Booker, Hugo, Nebula, Miles Franklin, Stella, Pulitzer, Women's Prize |
| Genres | Sci-fi classics, fantasy, crime, gothic, literary, historical |
| Author identity | Women authors, LGBTIQA+ authors, First Nations authors, translated fiction |

- **Type your own:** a 'Make a deck' box takes any theme in plain words (e.g. 'Australian crime', 'books set in Japan'). AI builds a 15-card deck and checks each title exists in the catalogue before showing it.
- **Saved themes:** a custom theme can be pinned as a chip for next time.
- **Same rules in every deck:** same card actions, no logged or dismissed books, covers loaded the same way.
- **Theme progress:** closed lists show a total, open themes show a count. Prize winners and Top 250 have fixed lists, so they show 'Booker: 14 of 57 read'. Genres, decades, author identity and custom themes have no true total, so they show 'Sci-fi classics: 23 read'.

## Feature 3: Next-read suggestion

A 15-second mood check produces seven picks, ranked best fit first and shown in the same curved carousel as Discover, each with a one-line reason. Tapping 'Why this pick' reveals the reasoning, including the 9-dimension match. See `docs/design/NextRead.dc.html`.

**Surprise me:** a button above the mood check skips it entirely. It returns seven picks with no filters, at least two wildcards outside Ann's usual genres but close to her 5-star profile.

**Mood check** (one screen, all optional, tap chips):

- Appetite: Like my recent reads (close to the profile of her last few books) / Something different (steps away from them).
- Genres (multi-select): sci-fi, contemporary, literary, gothic, historical, comic.
- Weight: Light / Medium / Heavy.
- Format: Print / Ebook / Audio. Choosing Audio applies the 10-12 hour length cap.
- Length: Short / Any / Long.

**The seven picks**

- A mix of TBR and new titles, labelled 'From your TBR' or 'New to you'.
- At least one pick from TBR when the TBR has a match.
- Never a book currently marked Reading.
- The details card under the carousel follows the centre book: label, title, author, one-line reason, 'Why this pick', actions Start reading / Add to TBR (new books only) / Not for me.
- 'Why this pick' shows bars comparing the book with Ann's 5-star average on four dimensions, plus the three logged books it is closest to.

**How it ranks (hidden engine)**

1. Build Ann's taste profile from her ratings against each book's 9-dimension scores. 5s pull toward their profile; 2s and 3s push away. Liked books add a boost.
2. Weight recent ratings more, so a shift away from sci-fi shows up quickly.
3. Apply the mood check as filters and boosts.
4. Penalise patterns she rates low: stream-of-consciousness, style over substance, late books in sprawling series.
5. Ask the LLM to write the one-line reason from the top matches.

'Not for me' feeds back into ranking and removes the book from future picks.

## Feature 4: Buy and borrow (phase 3)

Every next-read pick and book page gets a **Borrow** button and a **Buy** button side by side. Borrowing earns nothing but keeps the app on the reader's side; buying through affiliate links covers AI and hosting costs.

**Library setting (one time):** 'My library' (e.g. Goldfields Libraries) plus ticks for the library apps the reader uses: Libby, BorrowBox, uLibrary, and the library catalogue for print copies.

| Button | Opens | How |
| --- | --- | --- |
| Borrow: Libby | The title in Libby | OverDrive's Title Link API returns a share link showing availability at nearby libraries; needs a free OverDrive developer sign-up |
| Borrow: BorrowBox | A title search on the library's BorrowBox site (e.g. goldfields.borrowbox.com) | Link format to be confirmed during the build |
| Borrow: uLibrary / catalogue | A title search on the library's own site | Print copies and holds |
| Buy | The book at the reader's chosen shop | Affiliate link: Booktopia (up to 8.5%), QBD, Kobo or Amazon AU |

- Borrow opens the reader's preferred library app first; for audiobooks, Borrow sits before Buy.
- Affiliate links are labelled clearly in the app.
- Daily caps on AI use stay in place until buy links prove they cover costs. A supporter tier is a later option if the app grows.
- Leave room for both buttons on the next-read details card and book page from phase 1, so phase 3 doesn't need a redesign.

## Screens and navigation

Four tabs on a bottom bar, sized for one-thumb use on a phone. The app installs to the home screen as a web app (PWA).

| Tab | What's on it |
| --- | --- |
| Home | Horizontal cover rows: Currently reading (tap to finish and rate), TBR, Recently read. 'Pick my next read' button and a 'Swipe 15' carousel prompt |
| Discover | Two modes, Backfill (carousel deck with theme chips) and Next read (mood check and seven picks) |
| My books | Cover grid with stars under each cover, not text rows. Views: Read, TBR, DNF, Liked, Diary. Sort by date, rating, author; filter by format. TBR sorts three ways: date added (newest first), genre (grouped under genre headings) or fit (best match to Ann's taste first) |
| Search | Find any book, act on it from the result |

**Book page:** cover, details, read history with dates and ratings, note, actions (Read again, Edit, Move to TBR, DNF).

**Visual tone:** dark and gallery-like, light mode as an option (follow the phone setting). Cover-led. Large tap targets (44px minimum). No social feed, no streaks, no badges in v1.

**Patterns borrowed from Letterboxd** (interaction patterns only; Next Book has its own name, colours and look):

1. **Covers, not lists.** Every collection is a cover grid or cover row; text lists only in search results.
2. **Quick-action sheet.** Long-press any cover anywhere for one sheet: stars, Like heart, Read / Reading / TBR / DNF, add note, set date.
3. **Like heart.** Separate from the star rating. Feeds the Liked view and boosts similar books in next-read picks.
4. **Diary timeline.** Reverse-chronological, grouped by month, then year, then decade for fuzzy dates, showing covers with stars. Undated books sit in an 'Undated' shelf with a prompt to date them.
5. **Top 250 novels** is one more theme chip alongside the others.
6. **Horizontal rows on Home.** One swipeable cover row per shelf.

## Data import

The app launches with Ann's existing log already loaded: about 200 rated books, the TBR queue, current reads and DNFs. Source: `data/reading-log.md`.

1. Expand shorthand titles to full titles and authors (e.g. 'LHoD' to The Left Hand of Darkness, Ursula K. Le Guin). Write the expanded list to a CSV and have Ann confirm anything ambiguous.
2. Match each row to a catalogue book; anything unmatched goes to a 'Check these' list for Ann to confirm.
3. Import dates as Not sure; Ann can date them later through the fuzzy picker.
4. Score every imported book on the 9 dimensions in one batch (phase 2), so recommendations work from day one of phase 2.

Current state to carry over: Prophet Song (reading, print), Roadside Picnic (reading, audio), A Memory Called Empire (finished, needs rating), Demon Copperhead (DNF, content).

**The import is a one-off for Ann, not a feature (added 20 Nov 2026).** In phase 1 her matched log is bundled into the app (`src/data/import.json`) and an 'Import my books' card on Home copies it into whoever is signed in. That is only safe while Ann is the only user. Before phase 3 (go live), once her import has worked:

1. Remove the import card, `src/lib/importLog.ts`, `src/data/import.json`, `src/lib/genreSeed.ts` and `src/data/genres.json` from the app, so no other reader can import Ann's books and her log is never shipped to visitors' phones.
2. Remove Ann's personal files from the public GitHub repo: `data/reading-log.md`, `data/reading-log.csv` and `data/taste-and-framework.md`. Keep them in a private place (her OneDrive 'Book app' folder already has the originals). Ask Ann whether the repo should go private instead, and whether to scrub them from git history.
3. Check nothing else in the repo or the built app contains Ann's personal data or email.

**Other readers** start with an empty shelf and add books through the '+' button (search), the 'Might have read' carousel, and in phase 2 Snap a cover and Paste a list. A general 'Import a CSV' for new readers is a possible v2 addition (Goodreads/StoryGraph import stays out of v1).

## Technical notes

Build path is locked: code on GitHub, app hosted on Netlify, data and sign-in on Supabase (free plan), using Ann's existing accounts. Built locally first with Claude Code.

- **Book data:** Open Library (free, no key) for titles, authors, page counts and covers; Google Books as fallback.
- **AI:** Claude via the Anthropic API, phase 2 only. Used for 9-dimension scoring (once per book, cached), pick reasons, cover/spine photo reading, paste-a-list title extraction, and custom theme decks. Ranking itself is plain code, so it stays fast and cheap. The API key lives only in server-side functions, never in the browser. Ann sets a monthly spend limit in the Anthropic console.
- **Storage:** one Supabase database, every row keyed by user ID with row-level security, Supabase sign-in ready for more users. A Netlify scheduled function reads the database once a day so the free project never pauses for inactivity. An 'Export my data' button downloads the full log as CSV, because the free plan has no automatic backups.
- **Offline:** logging works offline and syncs later; carousel and picks need a connection.

**Cover images**

1. **Open Library first, by cover ID.** The book search returns a cover ID; fetch the medium-size image with it (`https://covers.openlibrary.org/b/id/{cover_id}-M.jpg`). Lookups by cover ID have no rate limit, unlike ISBN lookups, which are capped at 100 per 5 minutes per IP.
2. **Google Books fallback** only when Open Library has no cover, because its image server has an undocumented rate limit.
3. **Placeholder card** when neither source has a cover: a coloured card with title and author (as in the designs), never a broken image.
4. **Cache the cover link** on the Book record after the first lookup, so each cover is fetched once.
5. **Expect gaps** on older or obscure editions. Ann can tap a placeholder to retry or pick a different edition.

**Out of scope for v1**

- Stats and books-per-year charts (v2).
- Social features, sharing, friends.
- Goodreads/StoryGraph import.
- Visible 9-dimension profile on book pages.

**Open questions**

- [ ] App name: keep 'Next Book'?
- [ ] Carousel deck size: is 15 right, or 10?
- [ ] Audio length data is patchy in public APIs. Acceptable to enter it manually when missing?
- [x] Genre labels: decided 20 Nov 2026. Eight bookshop labels: Science fiction, Fantasy, Crime & thriller, Gothic & horror, Historical fiction, Literary fiction, Contemporary fiction, Classics. Classics = first published before 1960, except science fiction, fantasy and crime keep their genre. Ann's imported books were set by hand; new books are guessed from Open Library subjects and year (often wrong for old books), and any genre can be changed on the book page. TBR, Read and Liked can all be grouped by genre.
- [ ] Hand-set genres are stored on the shared catalogue (books.genre), so every reader sees them. Move to a per-reader setting before adding other users.
