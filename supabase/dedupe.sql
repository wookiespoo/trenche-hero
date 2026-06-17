-- Trenche Hero — best-per-wallet board
-- Run ONCE in the SQL Editor. Collapses existing rows to each wallet's best,
-- enforces one row per wallet, and adds the atomic "keep best" upsert that the
-- submit-score Edge Function now calls.

-- 1) collapse current rows down to the best score per wallet
delete from trenche_leaderboard a
using trenche_leaderboard b
where a.wallet = b.wallet
  and a.wallet is not null
  and (a.score < b.score or (a.score = b.score and a.id > b.id));

-- 2) one row per wallet from now on
create unique index if not exists trenche_leaderboard_wallet_uniq
  on trenche_leaderboard (wallet)
  where wallet is not null;

-- 3) atomic upsert: insert, or update only if the new score is higher
create or replace function submit_best(
  p_player text, p_wallet text, p_score int, p_rounds int, p_mode text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into trenche_leaderboard (player, wallet, score, rounds, mode)
  values (p_player, p_wallet, p_score, p_rounds, p_mode)
  on conflict (wallet) where wallet is not null
  do update set
    score      = excluded.score,
    rounds     = excluded.rounds,
    mode       = excluded.mode,
    player     = excluded.player,
    created_at = now()
  where excluded.score > trenche_leaderboard.score;
end;
$$;

-- only the Edge Function (service role) may call it
grant execute on function submit_best(text, text, int, int, text) to service_role;
