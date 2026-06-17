// Trenche Hero — verified score submission
//
// Verifies a wallet's ed25519 signature over the exact score payload, then
// inserts with the service-role key (which bypasses RLS). With the anon
// insert policy revoked (see ../lockdown.sql), this is the ONLY write path,
// so forged curl POSTs can't reach the board.
//
// Deploy (publicly callable — auth is the wallet signature, not a Supabase JWT):
//   supabase functions deploy submit-score --no-verify-jwt
//
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@5.0.0";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;              // injected by Supabase
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // injected by Supabase
const TABLE         = "trenche_leaderboard";
const MAX_SCORE     = 50_000_000;        // sane ceiling; tune to taste
const MAX_AGE_MS    = 5 * 60 * 1000;     // signature must be fresh (anti-replay window)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")   return json({ error: "POST only" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { player, wallet, score, rounds, mode, message, signature } = body ?? {};

  if (typeof wallet !== "string" || typeof message !== "string" || typeof signature !== "string")
    return json({ error: "missing wallet/message/signature" }, 400);
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > MAX_SCORE)
    return json({ error: "score out of range" }, 400);

  // 1) verify the signature actually came from `wallet`
  let ok = false;
  try {
    ok = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      b64ToBytes(signature),
      bs58.decode(wallet),
    );
  } catch { ok = false; }
  if (!ok) return json({ error: "bad signature" }, 401);

  // 2) the signed message must match the claimed payload (anti-tamper / anti-replay)
  const m = {
    score:  Number(/score:(\d+)/.exec(message)?.[1] ?? -1),
    rounds: Number(/rounds:(\d+)/.exec(message)?.[1] ?? -1),
    mode:   /mode:([a-z]+)/.exec(message)?.[1] ?? "",
    wallet: /wallet:([1-9A-HJ-NP-Za-km-z]+)/.exec(message)?.[1] ?? "",
    ts:     Number(/ts:(\d+)/.exec(message)?.[1] ?? 0),
  };
  if (m.score !== Math.floor(score) || m.rounds !== rounds || m.mode !== mode || m.wallet !== wallet)
    return json({ error: "payload/message mismatch" }, 400);
  if (!m.ts || Math.abs(Date.now() - m.ts) > MAX_AGE_MS)
    return json({ error: "stale signature" }, 400);

  // 3) insert with service role (bypasses RLS)
  const name = (typeof player === "string" && player.trim())
    ? player.slice(0, 24)
    : `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ player: name, wallet, score: Math.floor(score), rounds, mode }),
  });
  if (!res.ok) return json({ error: "insert failed", detail: await res.text() }, 500);

  return json({ ok: true, verified: true });
});
