# Native OAuth — config checklist (do these to make Apple + Google sign-in work)

The iOS code is complete and compiles. Sign in with Apple + Continue with Google
are wired in `AuthView` → `AuthService.signInWithApple` / `signInWithGoogle`.
They will FAIL at the token-exchange step until the steps below are done.
Email/password already works today.

Bundle id: `com.wordocious.app` · Apple Team: `Q32F6GRDYG` · Supabase project: (same as web)

---

## 1. Apple Developer portal — enable the capability (5 min)

1. https://developer.apple.com/account → Certificates, IDs & Profiles → Identifiers.
2. Open the App ID `com.wordocious.app` (create it if it doesn't exist).
3. Tick **Sign In with Apple** capability → Save.
   - The app's `Wordocious.entitlements` already declares `com.apple.developer.applesignin = [Default]`;
     this portal step is what lets automatic signing provision it.

### For the Supabase Apple provider you also need a Services ID + key:
4. Identifiers → **+** → **Services IDs** → e.g. `com.wordocious.app.signin`.
   - Enable Sign In with Apple → Configure → add your Supabase auth callback domain:
     - Domain: `<PROJECT_REF>.supabase.co`
     - Return URL: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
5. Keys → **+** → enable **Sign in with Apple** → register → **download the `.p8` key**.
   Note the **Key ID** and your **Team ID** (`Q32F6GRDYG`).

## 2. Supabase dashboard — Apple provider (3 min)

Authentication → Providers → **Apple** → enable, then fill:
- **Services ID** (the `client_id`): `com.wordocious.app.signin`
- **Team ID**: `Q32F6GRDYG`
- **Key ID**: from step 1.5
- **Private key**: paste the contents of the `.p8` file
- (Supabase generates the client secret JWT from these automatically.)

> Native Sign in with Apple sends an **OIDC id_token** straight to Supabase
> (`signInWithIdToken`), so you do NOT need the redirect URL for the Apple path —
> but the Services ID + key are still required for Supabase to verify the token.

## 3. Supabase dashboard — Google provider (already enabled?) + redirect URL (2 min)

Google provider is already enabled server-side (used by the web). For the **native**
flow (ASWebAuthenticationSession) you must allow-list the app's custom-scheme redirect:

Authentication → URL Configuration → **Redirect URLs** → add:
```
com.wordocious.app://auth-callback
```
(The iOS app already registers the `com.wordocious.app` URL scheme in Info.plist.)

## 4. Verify on a real device or iCloud-signed-in simulator

- Sign in with Apple requires the device/simulator to be signed into an iCloud account
  (Simulator: Settings → Sign in to your iPhone).
- Tap **Sign in with Apple** → native sheet → Face ID/confirm → lands in the app.
- Tap **Continue with Google** → web sheet → Google consent → redirects back → lands in app.
- First OAuth sign-in auto-creates a `profiles` row (username `Wordocious#####`,
  avatar from provider metadata, `has_onboarded = false`) — matches the web.

---

### What the code already does (no action needed)
- `AuthView`: official `SignInWithAppleButton` (HIG-compliant) + Google button; Facebook removed.
- Nonce generation + SHA-256 hashing for the Apple request (raw nonce sent to Supabase).
- `AuthService.signInWithApple(idToken:rawNonce:)` → `signInWithIdToken(.apple)`.
- `AuthService.signInWithGoogle()` → `signInWithOAuth(.google, redirectTo: com.wordocious.app://auth-callback)`.
- Auto-create profile on OAuth first sign-in (mirrors `apps/web/lib/auth-context.tsx`).
- User-cancellation errors are swallowed (no scary error text when the sheet is dismissed).
