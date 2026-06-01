# StoreKit 2 IAP — testing + App Store Connect checklist

The iOS code is complete and compiles. ProView drives real `StoreManager`
purchases; a verified transaction writes Pro to the same `profiles` columns the
web uses (`is_pro` / `pro_expires_at` / `streak_shields`) via
`AuthService.applyProGrant` — 1:1 with `apps/web/lib/payment/purchase-service.ts`.

## Products (must match exactly)

| Plan | StoreKit Product ID | Type | Price | Entitlement |
|---|---|---|---|---|
| Monthly | `com.wordocious.app.pro_monthly` | Auto-renewable (group "Wordocious Pro") | $6.99 | +30d* + 4 shields |
| Yearly  | `com.wordocious.app.pro_yearly`  | Auto-renewable (same group) | $59.99 | +365d* + 4 shields |
| Day Pass | `com.wordocious.app.pro_day` | Consumable | $1.00 | +24h (stacks), no shields |

\* For auto-renewables the app trusts StoreKit's `expirationDate` (keeps renewals
in sync); the day pass is computed as `max(existing expiry, now) + 24h`, matching
the web's stacking semantics.

## A. Local testing in the simulator (no App Store Connect needed)

The repo ships `apps/ios/Wordocious.storekit` and the scheme references it.
**The config only loads when you RUN THROUGH THE SCHEME in Xcode — not via
`simctl launch`.**

1. Open `Wordocious.xcodeproj` in Xcode.
2. Scheme **Wordocious** → simulator → **Run** (⌘R).
3. Sign in (email/password works today), then **Profile tab → Go Pro**.
4. Tap a plan → the StoreKit **test** purchase sheet appears → Confirm.
5. The sheet dismisses, `applyProGrant` writes the entitlement, the profile
   refreshes, and ProView flips to the **ACTIVE PRO** state.
6. To reset: Xcode → Debug → StoreKit → Manage Transactions → delete.

> Editor → (the .storekit file) lets you toggle "Ask to Buy", renewal speed, and
> failures to test pending/declined paths.

## B. App Store Connect (for TestFlight / production)

1. App Store Connect → your app → **Subscriptions**:
   - Create a subscription group "Wordocious Pro".
   - Add **Pro Monthly** (`com.wordocious.app.pro_monthly`, 1 month, $6.99).
   - Add **Pro Yearly** (`com.wordocious.app.pro_yearly`, 1 year, $59.99).
2. **In-App Purchases** → add a **Consumable** **Day Pass**
   (`com.wordocious.app.pro_day`, $1.00).
3. Fill localized display name + description + review screenshot for each.
4. Add the **Paid Apps agreement** + banking/tax info (IAPs won't load until this
   is active).
5. Build with the StoreKit config **off** (or it's ignored for release) so the app
   uses live products. Test on TestFlight with a Sandbox Apple ID.

## C. Production hardening (recommended, not blocking)

Fulfillment currently runs **client-side**: after a verified StoreKit transaction
the app writes `is_pro` to its own `profiles` row (RLS already permits a user to
update their own row — same trust model the web relies on). For tamper-resistance,
move fulfillment server-side:

- Add **App Store Server Notifications V2** → a Supabase Edge Function / API route
  that verifies the signed transaction with Apple and writes the entitlement with
  the **service role** (bypassing the client). Reuse the web's `fulfillSubscription`.
- Then the client write becomes a fast-path optimism only; the server is truth.

## What the code already does (no action needed)
- `StoreManager`: loads products, `purchase()`, `Transaction.updates` listener,
  `Transaction.currentEntitlements` reconcile on launch, `AppStore.sync()` restore.
- `ProView`: live prices, per-plan purchasing spinners, **Restore Purchases**, and
  the required auto-renew **subscription disclosure** + Terms/Privacy links (Guideline 3.1.2).
- `AuthService.applyProGrant` / `syncProExpiry`: write the entitlement, +4 shields
  on monthly/yearly purchases & renewals only (never on day pass or launch reconcile).
