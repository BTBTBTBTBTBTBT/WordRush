# Google Play RTDN webhook (server-authoritative Android Pro)

Mirrors `app/api/appstore/` for Android. Until configured, the route returns
503 and changes nothing — client-side fulfillment keeps working. Together with
the Apple webhook, this is the prerequisite for running the deferred
`supabase/migrations/20260603000004_lock_pro_columns.sql` (which blocks
client-side `is_pro` writes) without breaking Android purchases.

## Setup (one-time, ~20 min)

1. **Service account** (Google Cloud console, same project as the Android
   OAuth client):
   - Create a service account; create a JSON key.
   - Enable the **Google Play Android Developer API** for the project.
   - In **Play Console → Users & permissions → Invite new user**, invite the
     service-account email with *View financial data* + *Manage orders*.
2. **Env vars** (Vercel project `spellstrike`):
   - `PLAY_SA_EMAIL` — the service-account email.
   - `PLAY_SA_PRIVATE_KEY` — the PEM `private_key` from the JSON key
     (escape newlines as `\n` when pasting into Vercel).
   - `PLAY_PUBSUB_TOKEN` — any long random string (authenticates pushes).
   - `SUPABASE_SERVICE_ROLE_KEY` — already used by the Apple webhook.
   - Optional `PLAY_PACKAGE_NAME` (defaults `com.wordocious.app`).
3. **Pub/Sub** (Google Cloud console):
   - Create topic `play-rtdn`.
   - Grant `google-play-developer-notifications@system.gserviceaccount.com`
     the *Pub/Sub Publisher* role on the topic.
   - Create a **push** subscription to
     `https://wordocious.com/api/playstore/notifications?token=<PLAY_PUBSUB_TOKEN>`.
4. **Play Console → Monetize → Monetization setup**: set the topic name and
   click *Send test notification* — the route should log `kind: "other"`.
5. Buy a Pro sub with a license tester; confirm `profiles.is_pro` /
   `pro_expires_at` update on purchase and after cancel+expiry (test
   subscriptions renew every few minutes).

## Behavior

- **Subscriptions** (`pro_monthly`, `pro_yearly`): every RTDN event re-syncs
  the user from the verified `purchases.subscriptionsv2` resource — Pro iff
  the latest line-item expiry is in the future. Idempotent; re-deliveries and
  out-of-order events are harmless.
- **Day pass** (`pro_day`, consumable): on PURCHASED, verified via
  `purchases.products`, then 24h stacked onto the later of now / current
  expiry (matches StoreManager semantics).
- User mapping: `obfuscatedExternalAccountId`, which `StoreManager.kt` sets to
  the Supabase user id on every purchase. Purchases made before that wiring
  have no id and are left to the client grant.
