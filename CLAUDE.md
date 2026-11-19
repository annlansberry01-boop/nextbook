# Next Book: build brief for Claude Code

You are building **Next Book**, a mobile-first book tracking web app for Ann (Bendigo, Australia). She is the product owner, not a developer. Explain choices in plain language, ask before anything that costs money or can't be undone, and show her the app running often.

Ann's style: direct, no fluff, practical. Ask her questions before big decisions. Don't use em dashes in anything you write for her.

## Read these first

- `docs/SPEC.md`: the full v1 spec. This is the source of truth.
- `docs/design/Home.dc.html`, `Discover.dc.html`, `NextRead.dc.html`: approved screen designs. They are HTML mockups in a design-tool format (`<x-dc>` templates, `{{holes}}`, `<sc-for>`/`<sc-if>`, a `class Component extends DCLogic` script with sample data). Treat them as the visual reference: layout, spacing, colours, type, carousel geometry and interactions. Rebuild them as real components; don't try to run the mockup format.
- `data/reading-log.md`: Ann's books to import.
- `data/taste-and-framework.md`: her taste profile and the 9-dimension framework (phase 2).

## Stack (decided)

- **Front end:** Vite + React + TypeScript, installed to the home screen as a PWA.
- **Data and sign-in:** Supabase (Ann's existing account, free plan). Postgres with row-level security; every user-owned row has `user_id`. Use email magic-link sign-in.
- **Hosting:** Netlify (Ann's existing account). Server-side code as Netlify Functions.
- **Code:** GitHub (Ann's existing account). Ask her for the repo name before creating it; suggest `next-book`.
- **Book data:** Open Library search and covers (by cover ID), Google Books fallback. See the spec's cover section.
- **AI (phase 2 only):** Claude via the Anthropic API, called only from Netlify Functions. The key never reaches the browser.

Secrets go in `.env.local` (git-ignored) locally and in Netlify environment variables when live. Never commit keys.

## Design tokens (from the approved mockups)

| Token | Value |
| --- | --- |
| Background | #111113 |
| Surface | #1B1B1F |
| Surface raised | #26262B |
| Border | #2E2E34 / #3A3A41 |
| Text | #F2EFE9 |
| Text muted | #A7A39B |
| Accent (brass) | #D9B46A, text on accent #1A1406 |
| Like heart | #E07A7A |
| Fonts | Inter (body), Space Grotesk (headings, cover placeholders) |
| Tap targets | 44px minimum |

Dark is the default; add a light theme that follows the phone setting. Covers without art use the placeholder card style from the mockups (muted colour, title, author).

**Curved carousel geometry** (Discover and Next read): 7 covers visible. Container `perspective: 640px`. Base cover 80×120px. For offset 0 to ±3 from centre: translateX 0 / 64 / 108 / 146px, translateZ 0 / 18 / 40 / 64px, rotateY 0 / 14 / 26 / 34 degrees (angled inward), brightness 1 / 0.72 / 0.5 / 0.5. Centre cover scale 1.35 with a 2px accent outline. Tap a side cover to centre it; add swipe gestures in the real build.

## Build in phases

Show Ann the app running locally at the end of each phase and get her OK before moving on.

### Phase 1: core app, no AI (no API cost)

1. Scaffold the project, push to a new GitHub repo, and run it locally (`npm run dev`). Tell Ann how to open it on her laptop and on her phone over the same wifi.
2. Set up Supabase: walk Ann through creating a project in her account and copying the URL and anon key into `.env.local`. Create the schema from the spec's data model, with row-level security.
3. Import her log: expand the shorthand titles in `data/reading-log.md` into a CSV (title, author, rating, status, format), show Ann anything you're unsure of, then match to Open Library and import. Unmatched books go to a 'Check these' list in the app.
4. Build Home, My books (cover grid, views, TBR sort by date added and genre), book page, quick-action sheet, rating sheet (half stars, Like, fuzzy decade date, note), search and add.
5. Build the Discover carousel with the curved layout. Phase 1 decks come from fixed lists you compile (same authors as her log, prize winners, decades, genres, Top 250). No AI yet.
6. Diary timeline, DNF list, Liked view, 'Export my data' CSV button.

### Phase 2: AI features

1. Ask Ann to create an Anthropic API key at console.anthropic.com and set a monthly spend limit there. Put the key in `.env.local` and later in Netlify.
2. With Ann, agree anchor books for each of the 9 dimensions, then batch-score her imported books and cache the scores.
3. Next read: mood check, Surprise me, seven picks ranked by the engine in the spec, 'Why this pick', Not for me.
4. 'For you' deck using 5-star similarity; custom 'Make a deck' themes; TBR sort by fit.
5. Snap a cover / bedside pile (Claude vision) and Paste a list.

Keep AI calls cheap: cache everything, score each book once, batch where possible, and use a smaller Claude model where quality allows.

### Phase 3: go live

0. Remove the one-off import card and Ann's personal data files from the app and repo (spec, 'Data import').
1. Connect the GitHub repo to Netlify; set environment variables.
2. Add the daily Netlify scheduled function that reads Supabase so the free project doesn't pause.
3. Configure Supabase sign-in redirect URLs for the live site.
4. Buy and borrow buttons (spec, Feature 4): library setting, Libby/BorrowBox/uLibrary/catalogue links, affiliate Buy links. Ask Ann before signing up to any affiliate or developer program; she does the sign-ups herself.
5. Daily per-user caps on AI features.
6. Test on Ann's phone, including installing it to the home screen.

## Working rules

- Keep the app usable at every step; commit after each working piece with a clear message.
- Prefer simple, well-known libraries. Explain any new paid service before using it.
- If the spec and the designs disagree, the spec wins; ask Ann if it matters.
- Open questions are listed at the end of the spec. Raise each one when you reach the feature it affects.
- The GitHub repo is public. Never commit keys, and treat Ann's reading log and taste files as personal. Before go-live, remove the one-off import and her personal files (see the spec, 'Data import').
