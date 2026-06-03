# App Store Server Notifications V2 — Pro entitlement webhook

Server-authoritative Pro entitlement for iOS. Apple POSTs a signed notification
on every subscription lifecycle event; `notifications/route.ts` verifies it,
maps the transaction's `appAccountToken` (set by the native `StoreManager` =
the Supabase user id) to the user, and sets `profiles.is_pro` /
`pro_expires_at` via the service-role client.

**This route fails CLOSED until set up** (returns 503 / 401 and changes nothing),
so the existing client-side fulfillment keeps working and nothing breaks. Finish
these steps, then enforce server-only writes.

## Setup

1. **Dependency** — already added: `@apple/app-store-server-library` (run `pnpm install` if needed).

2. **Apple root certs** — download Apple's root CAs (public) and drop the `.cer`
   files into `apps/web/certs/`:
   - Apple Root CA - G3 (`AppleRootCA-G3.cer`) from https://www.apple.com/certificateauthority/
   (G2/G1 optional.) The route loads every `*.cer/*.der/*.pem` in that dir.

3. **Env vars** (Vercel project settings):
   - `SUPABASE_SERVICE_ROLE_KEY` — already set (used by other admin routes)
   - `APPSTORE_BUNDLE_ID` = `com.wordocious.app`
   - `APPSTORE_APP_APPLE_ID` = the numeric App Store app id (App Store Connect → App → App Information → "Apple ID")

4. **Register the webhook URL** in App Store Connect → your app → App Information
   → **App Store Server Notifications**:
   - Production Server URL: `https://wordocious.com/api/appstore/notifications`
   - Sandbox Server URL: same
   - Version: **Version 2**

5. **Sandbox test** — make a sandbox purchase on a TestFlight/dev build; confirm
   the webhook receives the notification (Vercel logs) and `profiles.is_pro` /
   `pro_expires_at` update for that user.

6. **Enforce server-only writes** — ONLY after step 5 passes, run migration
   `supabase/migrations/20260603000004_lock_pro_columns.sql`. It blocks clients
   from writing `is_pro` / `pro_expires_at`, making this webhook the sole source
   of truth and closing the self-grant hole. (Heads up: this also disables the
   dev "Simulate Pro" toggle — flip `is_pro` via SQL when testing afterwards.)

## How the user mapping works
`StoreManager.purchase(...)` sets `appAccountToken = <Supabase user UUID>` on
every purchase. Apple echoes it in the signed transaction, so the webhook knows
which profile to update — no extra lookup table needed.
