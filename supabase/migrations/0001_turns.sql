-- Conversation history. One row per utterance (theirs in Serbian, or yours in Russian).
-- Later this feeds the training/error-tracking features.
create table if not exists public.turns (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  session_id  text not null,                       -- one id per conversation in the app
  direction   text not null check (direction in ('sr-ru', 'ru-sr')),
  source_text text not null,                       -- what was said (Serbian stored in Latin script)
  translation text not null default '',
  assist      jsonb                                -- notes + reply options returned by Claude
);

create index if not exists turns_session_idx on public.turns (session_id, created_at);
create index if not exists turns_created_idx on public.turns (created_at desc);

-- Only the server (secret key) writes/reads. No public access.
alter table public.turns enable row level security;
