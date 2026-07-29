# Supabase auth email templates

These are the transactional emails Supabase sends on our behalf. They are
**not** deployed by code — Supabase renders them from the dashboard at
Authentication → Emails. The copies here are the source of truth; paste a
change in the dashboard and commit it here in the same pass, or they drift.

## Which templates are live

| Template | Reachable? | Trigger |
|---|---|---|
| `reset-password.html` | **yes** | `resetPassword()` — web, iOS, Android |
| `confirm-signup.html` | **yes** | `signUp()` with `emailRedirectTo` |
| Magic Link | no | nothing calls `signInWithOtp` |
| Invite user | no | no admin-invite flow |
| Change Email Address | no | no email-change UI |
| Reauthentication | no | not used |

Only edit the two live ones; leaving the rest at Supabase defaults is fine
because nothing can trigger them. If an email-change flow is ever added, brand
that template in the same pass.

## Brand tokens (keep in step with the app)

Taken from `apps/web/components/ui/app-header.tsx` and `globals.css`:

- Wordmark gradient — `linear-gradient(135deg, #a78bfa, #ec4899)`
- Primary button — `linear-gradient(135deg, #7c3aed, #6d28d9)`, shadow `0 4px 0 #4c1d95` (the `btn-3d` look)
- Page background `#f5f3ff` · surface `#ffffff` · border `#ddd6fe`
- Text `#1f2937` · muted `#6b7280`
- Font — Nunito (the app font), loaded from Google Fonts

## Email-client caveats

Email HTML is not web HTML. Two things degrade on purpose:

- **Webfonts** (Nunito) load in Apple Mail, iOS Mail and Thunderbird, but *not*
  in Gmail's web client or Outlook — those fall back to the system stack in the
  `font-family` list. This is fine; the layout doesn't depend on the face.
- **Gradient text** (`background-clip: text`) renders in WebKit clients. Every
  other client shows the solid `#7c3aed` fallback declared before it, so the
  wordmark is never invisible.

Don't "fix" either by removing the fallbacks.
