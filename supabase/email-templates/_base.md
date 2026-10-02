# Supabase auth email templates

These are the transactional emails Supabase sends on our behalf. They are
**not** deployed by code — Supabase renders them from the dashboard at
Authentication → Emails. The copies here are the source of truth; paste a
change in the dashboard and commit it here in the same pass, or they drift.
Each file's first comment names its dashboard slot and its subject line.

## The templates (finishing build, FINISH_SPEC E3)

| File | Dashboard slot | Trigger | Variables |
|---|---|---|---|
| `reset-password.html` | Reset Password | `resetPassword()` — web, iOS, Android | `{{ .ConfirmationURL }}` |
| `confirm-signup.html` | Confirm signup | `signUp()` with `emailRedirectTo` | `{{ .ConfirmationURL }}` |
| `magic-link.html` | Magic Link | `signInWithOtp` (nothing calls it today; branded so it's ready) | `{{ .ConfirmationURL }}` |
| `change-email.html` | Change Email Address | `updateUser({ email })` (sent to the old and the new address) | `{{ .ConfirmationURL }}`, `{{ .Email }}` (current), `{{ .NewEmail }}` |

Invite user and Reauthentication stay at the Supabase defaults: nothing can
trigger them.

## One layout for all four

Table-based HTML with every style inline (email clients drop most `<style>`):

1. Page `#ece3fa`, the email itself a lilac wrapper `#f3ecfd`, max 560 wide, radius 22.
2. **Cast header**: `email-header.png`, the home wallpaper with the ten heroes
   baked into one image (top corners rounded to the wrapper).
3. **Message card**: very light lilac `#f8f3ff` (never white), 1.5px `#e2d3ff`
   border, radius 18, an 8px purple→pink top bar (`#7c3aed → #ec4899`, solid
   `#7c3aed` where gradients don't render).
4. **Headline** 25px Nunito Black `#3b1a78` with a **cast pose** beside it
   (each email has its own character: reset D eureka, confirm W wave, magic link
   U spin, change email C map). Body 15px `#4b3d66`, small print 12.5px `#7a6a95`.
5. **Candy button**: bulletproof table cell + anchor, purple pill
   (`#a66bff → #6d28d9`, solid `#7c3aed` fallback), 2px gold `#ffd166` outline
   and a 5px `#4c1d95` bottom lip (the app's candy button). The raw link stays
   under it for clients that block the button.
6. **Footer**: "Wordocious · Daily word games · wordocious.com".

## Images

Absolute URLs only (`https://wordocious.com/email/...`), served from
`apps/web/public/email/`. PNG, not WebP (Outlook and older Gmail apps don't
render WebP), quantized to stay small:

| File | Size | Used in |
|---|---|---|
| `email-header.png` | 1120×260 (560 pt @2x) | all four |
| `email-pose-d-eureka.png` | 192×192 (96 pt @2x) | reset-password |
| `email-pose-w-wave.png` | 192×192 | confirm-signup |
| `email-pose-u-spin.png` | 192×192 | magic-link |
| `email-pose-c-map.png` | 192×192 | change-email |

They come from `public/art/art-wall-home-wide.webp`,
`docs/design/brand/header/home-header-A.png` and `public/art/art-pose-*.webp`.
The images must be live on wordocious.com (deploy the web app) before the
templates are pasted into Supabase. Poses are decorative (`alt=""`).

## Email-client caveats

- **Webfonts** (Nunito) load in Apple Mail, iOS Mail and Thunderbird, but *not*
  in Gmail's web client or Outlook — those fall back to the system stack in the
  `font-family` list. This is fine; the layout doesn't depend on the face.
- **Gradients** (top bar, button) render in Apple Mail, iOS Mail and most
  WebKit clients; everyone else gets the solid `bgcolor` declared beside them.
- **Rounded corners** are ignored by Outlook desktop (square corners there).
- `color-scheme: light` asks dark-mode clients not to invert the lilac card.

Don't "fix" any of these by removing the fallbacks. American spelling only
(`apps/web/scripts/spelling-copy.test.ts` scans these files).
