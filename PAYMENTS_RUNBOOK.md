# Payments runbook — going server-authoritative for Pro

> STATUS 2026-07-20: LOCK APPLIED (admin-gated). protect_pro_columns_trg is live on
> profiles. Regular clients can no longer write is_pro/pro_expires_at/is_admin/
> is_banned; service-role (webhooks) + direct DB + is_admin accounts pass. Manage
> the Simulate Pro button per-tester via: update profiles set is_admin=<bool>.
> Remaining: re-enable Vercel Authentication (was disabled for sandbox testing).

This is the operator checklist for the steps that need YOUR Apple / Supabase /
Stripe credentials and consoles — the code side is committed, but these can't
be automated from the repo. Written 2026-07-17 after the Pro payment audit.

## Where things stand (code side, done)

- **Client purchase bugs fixed** (commit `d8296f2`): iOS refund-revoke, durable
  write before `finish()`, appAccountToken check; Android expiry-parse
  (fail-closed), restore-no-longer-revokes, launch reconcile, ProScreen
  `isProActive`. These ride the next iOS/Android builds. (The client-side
  renewal-shield grant listed here originally has since been REMOVED — see the
  shields model below.)
- **Clients never overwrite `pro_expires_at`** — every grant path takes the
  later of the store's expiry and the stored one, because the column also holds
  referral rewards, admin comps and stacked Day Passes. A subscribe that
  overwrote it destroyed banked days outright, with nothing to restore from.
- **Apple webhook hardened**: 500-on-failed-write, out-of-order/stale-expiry
  guard, sandbox-rejected-in-production, idempotency ledger. Writes
  `is_pro`/`pro_expires_at`, and grants the per-period streak shields (see the
  shields model below). Still **fails closed (503)** until the certs + env
  below exist.
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
it is **deliberately NOT locked** and the client is trusted to write it *for
game mechanics*. **Purchase/renewal shields (+4) are granted SERVER-SIDE ONLY,
on every platform.** No client grants them.

- **Web (Stripe):** `lib/payment/stripe-fulfillment.ts` (initial + each renewal).
- **iOS (StoreKit):** the App Store Server Notifications webhook,
  `/api/appstore/notifications`, on `SUBSCRIBED` / `DID_RENEW` only.
- **Android (Play):** the RTDN webhook, `/api/playstore/notifications`, on
  notification types `PURCHASED` (4) / `RENEWED` (2) / `RECOVERED` (1) only.
- The **verify endpoint never grants shields** (it only writes is_pro/expiry), so
  a sub confirm can't double with the webhook.
- **Day Pass never grants shields** on any platform — a $1 consumable must not
  buy a subscription perk.

⚠️ **This reverses the earlier rule** (which said the mobile *client* granted the
+4 and the webhooks did not). Both halves ended up live at once, so every mobile
subscriber was collecting **+8 per period**. The server was chosen as the owner
because it (a) sees a renewal even for a player who never reopens the app —
client grants silently never landed for those users — and (b) is not spoofable:
`streak_shields` is client-writable, so a client-side grant is a paid benefit any
signed-in user could PATCH onto their own row. The client code that granted
shields is gone (`StoreManager.swift`, `StoreManager.kt`), along with the local
"seen original transaction / order id" ledgers whose only purpose was deciding
when to credit. `applyProGrant` on both platforms no longer writes
`streak_shields` at all.

**Shields are keyed on the BILLING PERIOD, not on the notification.** The
`store_webhook_events` ledger is per-delivery and structurally cannot police
this: Apple sends `DID_CHANGE_RENEWAL_STATUS` with a fresh `notificationUUID`
every time a subscriber toggles auto-renew in iOS Settings, so it always looks
like a new event — that was an unlimited shield faucet (off +4, on +4, repeat,
no payment). Both webhooks now claim a `shields:<period>` key before crediting,
and only for genuine payment event types.

**Day Pass de-dupe is unchanged:** `StoreManager.kt` still keeps a persisted
seen-orderId set so a Day Pass re-delivered after a failed consume can't stack a
second +24h (iOS uses `processedTxIDs` for the same job).

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
   - ~~`APPSTORE_ACCEPT_SANDBOX`~~ — NOT needed: the sandbox-rejection guard
     only fires when `VERCEL_ENV === 'production'`, so *preview* deployments
     accept sandbox transactions inherently. Only ever set this flag if you
     deliberately want sandbox accepted on PRODUCTION (don't).
   - ✅ Verified 2026-07-20: all of the above are already set on **spellstrike**
     (since mid-June) with the correct values — nothing to add. (A duplicate set
     accidentally added to the unrelated **wordrush** Vercel project on 07-20
     can be deleted for tidiness; it does nothing there.)
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
   flips `is_pro`/`pro_expires_at` **and** `streak_shields += 4` (the webhook
   grants those now — see the shields model above — so verify them in the
   webhook log / the row, not on-device). While you're there, toggle auto-renew
   off and on in Settings and confirm shields do **not** move: that used to be
   a free +4 per toggle. Test a renewal (sandbox renews fast) and a refund
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

---

## ANDROID LAUNCH CHECKLIST (turnkey — do in order once the Play Console account exists)

Code is DONE and verified 2026-07-20 (StoreManager orderId-ledger, Play RTDN
webhook, billing-ktx 7.1.1, product-ID constants). Everything below is
console/config; nothing in the app needs new code except the AdMob ID swap
(one edit, noted).

**1. Google Play Console ($25 one-time)** → create the developer account + the
   Wordocious app record (package `com.wordocious.app`).

**2. Billing products — create with EXACTLY these IDs** (StoreManager.kt keys):
   - `pro_monthly` — auto-renewing subscription, $6.99/mo
   - `pro_yearly`  — auto-renewing subscription, $59.99/yr
   - `pro_day`     — one-time **consumable** product, $1.00
   A typo in any ID = that product silently won't load.

**3. Internal-testing track + license testers** (test purchases free, like iOS
   sandbox). Add your + testers' Google accounts as license testers.

**4. RTDN → Pub/Sub → the webhook** (mirrors the Apple ASSN flow):
   - Play Console → Monetization setup → Real-time developer notifications →
     topic name, verify.
   - Pub/Sub push subscription → endpoint `https://wordocious.com/api/playstore/notifications`.
   - Vercel env (Production): `PLAY_SA_EMAIL`, `PLAY_SA_PRIVATE_KEY` (service-account
     key; `\n`-escaped), `PLAY_PUBSUB_TOKEN` (matches the Pub/Sub verification
     token), and the shared `SUPABASE_SERVICE_ROLE_KEY`. The webhook fails closed
     until all four exist.
   - Service account (Play Console → Users & permissions → invite the SA email)
     with **View financial data + Manage orders**.
   - Sandbox-verify: internal-test purchase of each plan → webhook 200, `profiles`
     flips. Then the RLS lock (already applied) covers Android too — one trigger.

**5. Android AdMob — REQUIRED before production (currently on Google TEST IDs):**
   - Create an **Android** AdMob app (the approved `…~8393761846` is iOS-only).
   - Swap the real IDs into TWO places, then rebuild:
       `apps/android/app/src/main/AndroidManifest.xml` — the
         `com.google.android.gms.ads.APPLICATION_ID` meta-data (currently the test
         app id `ca-app-pub-3940256099942544~3347511713`).
       `apps/android/app/src/main/kotlin/com/wordocious/app/data/AdsManager.kt` —
         `INTERSTITIAL_UNIT` (currently test `…3940256099942544/5354046379`).
   - Shipping test IDs to production = zero revenue + an AdMob policy flag. (Ping
     me with the new IDs and I'll do the swap edit.)

**6. Android Google sign-in** — the app already sends the WEB client id as
   serverClientId; Google Cloud still needs an **Android OAuth client**:
   package `com.wordocious.app`, upload-cert SHA-1
   `7A:2C:E8:AC:82:B7:F7:F6:10:64:E1:9D:CC:88:23:0A:8E:63:79:B0`. No ID tokens
   vend until this exists.

**7. App Links** — `/.well-known/assetlinks.json` is published with the
   upload-cert SHA-256 (verify it still matches whatever Play App Signing assigns
   if you enroll — Play may re-sign with a different cert).

**8. ⚠️ BACK UP the upload keystore** `~/.android-keys/wordocious-upload.jks`
   (+ `key.properties` storepass) BEFORE first upload — losing it loses the
   ability to update the app unless Play App Signing is enrolled at submission.
