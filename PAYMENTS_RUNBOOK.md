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
  guard, sandbox-rejected-in-production, idempotency ledger. Writes ONLY
  `is_pro`/`pro_expires_at` — it does NOT grant streak shields (see the shields
  model below). Still **fails closed (503)** until the certs + env below exist.
- **Server expiry sweep**: `/api/cron/expire-pro` runs daily at 08:00 UTC, flips
  `is_pro` off for lapsed rows (added to `vercel.json`). Needs `CRON_SECRET`
  (already set for the other crons). NOTE: the Vercel account is on the **Hobby**
  plan, which caps crons at **once per day** — an hourly schedule (`0 * * * *`)
  makes every deploy fail with "Hobby accounts are limited to daily cron jobs."
  Keep all `vercel.json` crons at daily-or-less-frequent unless the plan upgrades.
- **RLS lock moved out of the auto-apply path** to
  `supabase/manual-migrations/…_lock_pro_columns.sql` so a routine `db push`
  can't apply it prematurely. It locks ONLY `is_pro` + `pro_expires_at`.
  (An earlier draft also locked `streak_shields` — REMOVED: shields are written
  client-side on every platform for spend/earn, so locking them would freeze
  every player's shield count. See the shields model below.)
- **Idempotency table**: `supabase/migrations/20260717000001_webhook_idempotency.sql`
  (safe to auto-apply — creates `store_webhook_events`, service-role only). The
  daily expire-pro cron prunes rows older than 30 days so it can't grow forever.

### Streak shields — where they're granted (do not re-introduce double-grants)

`streak_shields` is a game-mechanic column: the client spends it (−1, use a
shield) and earns it (+1, every 7-day login streak) on all three platforms, so
it is **deliberately NOT locked** and the client is trusted to write it.
Purchase/renewal shields (+4) therefore follow a per-platform rule to avoid ever
double-granting:

- **iOS / Android (StoreKit / Play):** the **client** grants the +4 (per new
  transaction / billing period). The App Store + Play **webhooks do NOT grant
  shields.** (If both did, a subscribe would mint +8 once the ASSN URL is
  registered.)
- **Web (Stripe):** there is no client, so **Stripe fulfillment grants the +4
  server-side** (initial + each renewal).
- The **verify endpoint never grants shields** (it only writes is_pro/expiry), so
  it can't double with the client on a sub confirm.

✅ **Android renewal shields — FIXED (client-side, iOS-matching):** Play mints a
new `orderId` per billing period on the same purchase ("GPA.xxxx..0", "..1", …),
so `StoreManager.kt` tracks seen orderIds (persisted) and credits +4 when launch
reconcile finds a new period of an already-known order. First sight of an
unknown base order (reinstall / new device) records without crediting, so a
device swap can't re-mint shields. The same ledger de-dupes Day Pass
re-delivery (+24h once per orderId). Rides the next Android build.

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
   `https://spellstrike-sandbox.vercel.app/api/appstore/notifications`.
   Choose **Version 2**.

   **The sandbox deployment:** `spellstrike-sandbox.vercel.app` is a stable
   alias pinned to a Vercel *Preview* deployment (Preview env →
   `APPSTORE_ACCEPT_SANDBOX=true`). The iOS app's `sandboxAPIBase` points at it
   too, so sandbox purchases verify there automatically. To refresh it after
   server-code changes: `vercel deploy --yes` (NO `--prod`) from the repo, then
   `vercel alias set <new-deployment-url> spellstrike-sandbox.vercel.app` — the
   alias moves, no app rebuild needed. (Git pushes to non-main branches do NOT
   auto-build on this project; the CLI is the path.)

   ⚠️ **One-time prerequisite: disable Vercel Authentication for previews.**
   Vercel → spellstrike → Settings → **Deployment Protection** → set *Vercel
   Authentication* to **Disabled**. Preview URLs are otherwise behind Vercel's
   SSO wall (401 before our code runs), which blocks BOTH Apple's sandbox
   webhook posts and the app's sandbox verify calls. Previews only expose the
   same app as production, so this is low-risk.
5. **Sandbox-verify:** make a sandbox purchase of monthly/yearly, watch the
   preview deployment logs — confirm the webhook 200s and the `profiles` row
   flips `is_pro`/`pro_expires_at`. (`streak_shields += 4` comes from the CLIENT,
   not the webhook — see the shields model above — so verify shields on-device,
   not in the webhook log.) Test a renewal (sandbox renews fast) and a refund
   (App Store Connect → refund) → confirm revoke.
6. **Day Pass caveat (must resolve before step 7):** Apple does NOT reliably
   send ASSN for consumables, so the Day Pass may never reach the webhook.
   Once the lock is applied the iOS client can no longer write it either →
   **Day Pass fulfillment would break.** ✅ **BUILT** (commit below):
   `apps/web/app/api/appstore/verify-transaction/route.ts` verifies the app's
   `Transaction.jwsRepresentation` with the same `SignedDataVerifier` and writes
   via service-role (idempotent on `tx:<transactionId>`, no shields — those stay
   webhook-only, so a sub's initial purchase can't be double-credited). It uses
   the SAME certs + env as the webhook, so it goes live automatically once steps
   1–2 are done — nothing extra to configure. iOS `StoreManager.handle()` routes
   the Day Pass through it (`verifyDayPassOnServer`): `.granted` → server truth,
   `503` → falls back to the pre-lock client write, transient failure → leaves
   the transaction unfinished so StoreKit re-delivers. This ships in the next
   iOS build. Sandbox-verify a Day Pass on the preview deployment (watch for the
   `POST /api/appstore/verify-transaction` 200 and `profiles` +24h) BEFORE step 7.
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

## Web (Stripe) — code done, needs your account setup

The free-Pro demo grant is GONE: absent Stripe keys the buy buttons render
**"Coming soon"** (disabled) and `/api/purchase` returns 503 — never a free
grant. Fulfillment is server-side only (Stripe webhook → service-role write),
so a checkout that isn't paid grants nothing. To turn it on:

1. **Stripe account** → create three Prices in the Stripe dashboard:
   - Monthly recurring $6.99 → note its `price_…` id
   - Yearly recurring $59.99 → `price_…`
   - Day Pass **one-time** $1.00 → `price_…`
2. **Env (Vercel, Production):**
   - `STRIPE_SECRET_KEY=sk_live_…`
   - `STRIPE_WEBHOOK_SECRET=whsec_…` (from step 4)
   - `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` / `STRIPE_PRICE_DAY` = the ids above
   - `NEXT_PUBLIC_STRIPE_ENABLED=true` (flips the buttons live)
   - (`SUPABASE_SERVICE_ROLE_KEY` — same one the App Store webhook needs)
   - For local dev without real charges: `PAYMENTS_DEMO=true` (NEVER in prod).
3. **Register the webhook** in Stripe → Developers → Webhooks → endpoint
   `https://wordocious.com/api/stripe/webhook`, events:
   `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.deleted`. Copy its signing secret into
   `STRIPE_WEBHOOK_SECRET`.
4. **Test mode first:** use `sk_test_…` + Stripe test cards, buy each plan,
   confirm the webhook 200s and `profiles` flips is_pro/pro_expires_at (+4
   shields on subs, none on Day Pass), then a renewal (Stripe test clock) and a
   cancel → revoke. Then swap to live keys.
5. The Stripe webhook shares the `store_webhook_events` idempotency table with
   the Apple one, so replays no-op there too. After Stripe + Apple are both
   verified, apply the lock (top of this file) — it covers all three grant
   paths since they all write `profiles` via service-role.

## Post-lock invariant

After the lock, every Pro grant flows: store → signed notification → verified
webhook → service-role write → `profiles`. Clients only READ `is_pro` /
`pro_expires_at` (expiry-gated, fail-closed) and never write them. The daily
sweep is the backstop for any missed EXPIRED event.
