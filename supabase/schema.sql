-- Trenche Hero — leaderboard schema
-- Run this in the Supabase SQL Editor (or via the Supabase CLI).

create table if not exists trenche_leaderboard (
  id          bigint generated always as identity primary key,
  player      text not null,
  wallet      text,
  score       int  not null check (score >= 0 and score < 1000000000),
  rounds      int  default 1,
  mode        text,
  created_at  timestamptz default now()
);

-- Row Level Security: read open to all, inserts sanity-bounded.
-- NOTE: the anon key is public by design and safe to ship client-side
-- *because* RLS is enabled. Scores are still client-submitted, so this
-- is not tamper-proof — see README "Anti-cheat" for the signed-score path.
alter table trenche_leaderboard enable row level security;

drop policy if exists "read all"   on trenche_leaderboard;
drop policy if exists "insert any" on trenche_leaderboard;

create policy "read all"   on trenche_leaderboard
  for select using (true);

create policy "insert any" on trenche_leaderboard
  for insert with check (char_length(player) <= 24);

create index if not exists trenche_leaderboard_score_idx
  on trenche_leaderboard (score desc);
