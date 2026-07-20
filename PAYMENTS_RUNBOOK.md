# Payments runbook — going server-authoritative for Pro

This is the operator checklist for the steps that need YOUR Apple / Supabase /
Stripe credentials and consoles — the code side is committed, but these can't
be automated from the repo. Written 2026-07-17 after the Pro payment audit.

## Where things stand (code side, done)

- **Client purchase bugs fixed** (commit `d8296f2`): iOS refund-revoke, durable
  write before `finish()`, appAccountToken check, per-period renewal shields;
  Android expiry-parse (fail-closed), restore-no-longer-revokes, launch
  reconcile, ProScreen `isProActive`. These ride the next iOS/Android builds.
- **Apple webhook hardened**: 500-on-failed-write, out-of-order/stale-expiry
  guard, sandbox-rejected-in-production, idempotency ledger, +4 renewal shields.
  Still **fails closed (503)** until the certs + env below exist.
- **Server expiry sweep**: `/api/cron/expire-pro` runs hourly, flips `is_pro`
  off for lapsed rows (added to `vercel.json`). Needs `CRON_SECRET` (already set
  for the other crons).
- **RLS lock moved out of the auto-apply path** to
  `supabase/manual-migrations/…_lock_pro_columns.sql` so a routine `db push`
  can't apply it prematurely. It now also locks `streak_shields`.
- **Idempotency table**: `supabase/migrations/20260717000001_webhook_idempotency.sql`
  (safe to auto-apply — creates `store_webhook_events`, service-role only).

## ⚠️ The live security hole (do this first)

**Any authenticated user can `PATCH /rest/v1/profiles?id=eq.<self>` with
`{"is_pro":true,"pro_expires_at":"2099-01-01"}` and get free permanent Pro.**
The only thing that closes it is applying the lock migration — but that ALSO
kills the currently-working client-side fulfillment, so the webhook must be the
source of truth first. Sequence below. Until then, the exposure is real but
bounded by a tiny user base; the expiry sweep at least revokes forged rows once
their fake future expiry passes (2099 → never, so a forged permanent grant is
NOT swept — the lock is the real fix).

## Sequence to go server-authoritative (iOS)

1. **Apple root certs** → download `AppleRootCA-G3.cer` (already present at
   `apps/web/certs/`, valid to 2039) — confirm it deployed (it's gitignored;
   check the Vercel build includes `apps/web/certs/`). If missing, re-add.
2. **Env (Vercel, Production + Preview):**
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Project Settings → API.
   - `APPSTORE_BUNDLE_ID=com.wordocious.app`
   - `APPSTORE_APP_APPLE_ID=<your numeric App Store app id>`
   - `APPSTORE_ACCEPT_SANDBOX=true` on the **Preview** env only (so TestFlight /
     sandbox tests reach a non-prod deployment); leave it unset in Production.
3. **Apply the idempotency migration** (safe, auto-applies with `supabase db
   push`, or run it by hand).
4. **Register the webhook** in App Store Connect → your app → App Information →
   *App Store Server Notifications* → set the Production URL to
   `https://wordocious.com/api/appstore/notifications` and the Sandbox URL to
   your preview deployment's `/api/appstore/notifications`. Choose **Version 2**.
5. **Sandbox-verify:** make a sandbox purchase of monthly/yearly, watch the
   preview deployment logs — confirm the webhook 200s and the `profiles` row
   flips `is_pro`/`pro_expires_at` and `streak_shields += 4`. Test a renewal
   (sandbox renews fast) and a refund (App Store Connect → refund) → confirm
   revoke.
6. **Day Pass caveat (must resolve before step 7):** Apple does NOT reliably
   send ASSN for consumables, so the Day Pass may never reach the webhook.
   Once the lock is applied the iOS client can no longer write it either →
   **Day Pass fulfillment would break.** Fix before locking: add a
   `/api/appstore/verify-transaction` route the app POSTs its Day Pass
   `Transaction.jwsRepresentation` to; the server verifies with the same
   `SignedDataVerifier` and writes via service-role. (Not yet built — flagged
   as the one remaining code piece; ping me to implement when you reach this.)
7. **Apply the lock:**
   `psql "$SUPABASE_DB_URL" -f supabase/manual-migrations/20260603000004_lock_pro_columns.sql`
   Then re-test a sandbox purchase end-to-end: the webhook grant must still land
   (service-role bypasses the trigger) and a direct client `PATCH` of `is_pro`
   must be silently reverted.

## Android (Google Play RTDN) — same shape, when the store is set up

The Play webhook (`/api/playstore/notifications`) already re-fetches
authoritative subscription state and now 500s on DB errors. Before Android
sales: create the Play Console products (`pro_monthly`/`pro_yearly`/`pro_day`),
wire RTDN → Pub/Sub → this endpoint, set its env, Sandbox-verify, then the same
lock covers Android too (it's one trigger on `profiles`).

## Web (Stripe) — Track 2, in progress

The web "Subscribe" buttons currently grant Pro **free** via the demo provider.
Track 2 replaces that with real Stripe checkout + a `/api/stripe/webhook` that
writes via service-role, gated so the buttons DISABLE (never grant free Pro)
until Stripe keys exist. See that commit + the Stripe section appended here when
it lands.

## Post-lock invariant

After the lock, every Pro grant flows: store → signed notification → verified
webhook → service-role write → `profiles`. Clients only READ `is_pro` /
`pro_expires_at` (expiry-gated, fail-closed) and never write them. The hourly
sweep is the backstop for any missed EXPIRED event.
