# Trenche Hero

A mobile-first browser rhythm game for the Solana trenches. Trade the chart — hit
notes on falling candlesticks to pump your meme-coin character to the moon.

> Hit the beats. Pump the chart. Don't get rugged.

Single self-contained `index.html`. No build step, no dependencies. Synth music is
generated live in Web Audio (no audio files needed). Works offline; add to home screen.

## Play
Open `index.html`, or run any static server:

```bash
python3 -m http.server 8080   # then visit http://localhost:8080
```

- **Stages** — survive escalating rounds; each round is faster and denser.
- **Quick** — one 75s pump session.
- **Endless** — speed ramps until you're liquidated.
- Desktop keys: `D F SPACE J K` (or `1`–`5`). Mobile: tap the lane.
- `☠ RUG` notes: don't touch them — let them pass the hit line.

## Leaderboard (Supabase)
With no keys set, the board is **local** (per-device, via localStorage). Add Supabase
to make it **global**.

1. Create a project at https://supabase.com/dashboard
2. SQL Editor → run `supabase/schema.sql`
3. Settings → API → copy the **Project URL** and **anon public** key
4. Paste them into the config block near the top of the `<script>` in `index.html`:

```js
const SUPABASE_URL = 'https://YOURPROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...'; // anon / public key
```

The anon key is public by design and safe to commit **because RLS is enabled**
(see `supabase/schema.sql`).

## Wallet sign-in
Connect Phantom/Solflare (injected `window.solana`) to use your address as your
handle, with a sign-in signature (SIWS). No wallet → type a guest tag.

## Verified scores (anti-cheat)
The global board accepts **wallet-signed scores only**. On game over the connected
wallet signs the exact score payload; the `submit-score` Edge Function verifies the
ed25519 signature, checks the signed message matches the claimed score (anti-tamper),
rejects stale signatures (anti-replay), bounds the score, and inserts with the
service-role key. Direct anon inserts are revoked (`supabase/lockdown.sql`), so the
function is the only write path — forged `curl` POSTs bounce. Guests without a wallet
get a local-only board.

Deploy it:

```bash
supabase login
supabase link --project-ref vihhprynybfhnucuqjkx
supabase functions deploy submit-score --no-verify-jwt
```

Then lock direct inserts (SQL Editor, or psql with the lockdown file):

```sql
-- contents of supabase/lockdown.sql
drop policy if exists "insert any" on trenche_leaderboard;
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the function
automatically — no secrets to set. Tune `MAX_SCORE` / `MAX_AGE_MS` at the top of
`supabase/functions/submit-score/index.ts`.

## Deploy
Static, so anything works:
- **Vercel**: import the repo at vercel.com/new (auto-deploys on push), or `vercel --prod`.
- **GitHub Pages**: repo Settings → Pages → deploy from `main` / root.

## License
MIT — see `LICENSE`.
