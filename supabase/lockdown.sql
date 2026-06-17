-- Trenche Hero — lock the board to verified writes only.
-- Run this AFTER deploying the submit-score Edge Function.
-- Removes the open anon-insert policy so direct/forged POSTs are rejected.
-- Reads stay public; the Edge Function writes with the service_role key
-- (which bypasses RLS), so legitimate signed scores still land.
drop policy if exists "insert any" on trenche_leaderboard;
-- no anon INSERT policy now => anon inserts denied; "read all" still allows SELECT
