-- Next Book: v1 schema (from docs/SPEC.md, Data model).
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Every user-owned row has user_id and row-level security, so each reader only sees their own data.

-- ---------- Types ----------
create type reading_status   as enum ('reading', 'read', 'dnf');
create type book_format      as enum ('print', 'ebook', 'audio');
create type date_precision   as enum ('exact', 'year', 'decade', 'unknown');
create type shelf_status     as enum ('tbr', 'dismissed');

-- ---------- Profiles (one per user) ----------
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  birth_year  int check (birth_year between 1900 and 2100),
  preferences jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Create a profile automatically when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Books (shared catalogue) ----------
create table books (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  authors          text[] not null default '{}',
  year             int,
  ol_work_key      text unique,          -- Open Library work, e.g. /works/OL45804W
  google_books_id  text unique,          -- fallback source
  cover_id         bigint,               -- Open Library cover ID
  cover_url        text,                 -- cached link after first lookup
  page_count       int,
  audio_hours      numeric(4,1),         -- optional, often entered by hand
  genre            text,
  subjects         text[] not null default '{}',
  dimensions       jsonb,                -- phase 2: 9 scores, 1-5, hidden
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index books_title_idx on books (lower(title));

-- ---------- Readings (one row per read; a re-read is a new row) ----------
create table readings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id         uuid not null references books (id) on delete cascade,
  status          reading_status not null,
  rating          numeric(2,1) check (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)),
  liked           boolean not null default false,
  note            text,                  -- one-line reaction, or DNF reason
  format          book_format,
  started_on      date,
  finished_from   date,                  -- fuzzy range start (or the exact day)
  finished_to     date,                  -- fuzzy range end
  date_precision  date_precision not null default 'unknown',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint dnf_has_no_rating check (status <> 'dnf' or rating is null)
);

create index readings_user_idx on readings (user_id, status);
create index readings_book_idx on readings (book_id);

-- ---------- Shelf entries (TBR or dismissed) ----------
create table shelf_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id     uuid not null references books (id) on delete cascade,
  status      shelf_status not null default 'tbr',
  position    int,                       -- optional queue order ("next after...")
  format      book_format,
  date_added  timestamptz not null default now(),
  unique (user_id, book_id)
);

-- ---------- 'Check these' list (import rows that didn't match) ----------
create table import_review (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  raw_title   text not null,
  raw_author  text,
  status      text,                      -- read / reading / dnf / tbr
  rating      numeric(2,1),
  format      book_format,
  note        text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- Keep updated_at fresh ----------
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger books_touch    before update on books    for each row execute function public.touch_updated_at();
create trigger readings_touch before update on readings for each row execute function public.touch_updated_at();

-- ---------- Row-level security ----------
alter table profiles      enable row level security;
alter table books         enable row level security;
alter table readings      enable row level security;
alter table shelf_entries enable row level security;
alter table import_review enable row level security;

-- Profiles: you can see and edit only your own.
create policy "own profile read"   on profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Books: shared catalogue. Signed-in readers can look up and add books, and cache covers.
-- No deletes from the app. Phase 2 AI scores are written by server functions only.
create policy "books read"   on books for select to authenticated using (true);
create policy "books insert" on books for insert to authenticated with check (true);
create policy "books update" on books for update to authenticated using (true) with check (true);

-- Readings, shelf entries and the review list: yours only, for every action.
create policy "own readings" on readings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own shelf" on shelf_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own review list" on import_review for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Stop the app from overwriting titles or AI scores: signed-in readers may only fill in
-- lookup details (covers, page count, genre). The server (service role) can change anything.
revoke update on books from authenticated, anon;
grant update (cover_id, cover_url, google_books_id, page_count, audio_hours, genre, subjects, year)
  on books to authenticated;
