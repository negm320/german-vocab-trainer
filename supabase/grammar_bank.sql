-- Sentence bank for grammar.html. Run once in Supabase → SQL Editor.
-- Safe to re-run.

create table if not exists grammar_bank (
  id           bigint generated always as identity primary key,
  german       text not null unique,          -- the sentence; also the key the app updates by
  english      text not null,
  verbs        jsonb not null default '[]',   -- verb tokens, to colour the chips
  prefixes     jsonb not null default '[]',   -- separated prefixes ("an" in "rufe … an")
  connector    text,
  word         text,                          -- vocab word it was built around, if any
  theme        text,
  model        text,
  source       text not null default 'picked',-- 'picked' = shown when generated, 'alt' = unseen candidate
  created_at   timestamptz not null default now(),
  seen         int not null default 0,        -- times answered
  correct      int not null default 0,        -- times answered right
  last_seen    timestamptz,
  last_correct boolean,
  flagged      boolean not null default false -- flagged as unnatural: never served again
);

create index if not exists grammar_bank_serve_idx on grammar_bank (flagged, seen, last_seen);

-- Same access model as kv_state: the app talks to Supabase with the
-- publishable (anon) key, so anon needs read/insert/update on this table.
alter table grammar_bank enable row level security;
drop policy if exists "app access" on grammar_bank;
create policy "app access" on grammar_bank for all to anon using (true) with check (true);
grant select, insert, update on grammar_bank to anon;
