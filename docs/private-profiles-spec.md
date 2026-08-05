# Private Profiles — cross-platform spec

Web is the reference implementation (shipped in this change). iOS and Android
port from THIS document, not from reading the web diff.

Founder intent: a player can make their profile private "if they don't want to
share their words or strategies. I want the private profiles to notate as such
when clicked, but also provide some basic information making the click worth
it."

## 1. Data model

`profiles.is_private boolean not null default false`
(manual migration: `supabase/manual-migrations/20260806000001_profile_privacy.sql`)

- Readable by any signed-in client (profiles SELECT is `using (true)`) — that
  is intentional; clients need it to render the teaser card.
- Owner-writable from the client like `bio` / `accent_color` (covered by the
  "Users can update own profile" policy; NOT pinned by `protect_pro_columns`).

## 2. Server contract (the only real enforcement)

The four public-profile routes gate on the target's `is_private`:

- `GET /api/profile/[id]/matches`
- `GET /api/profile/[id]/top-words?mode=…&play=…`
- `GET /api/profile/[id]/persona`
- `GET /api/profile/[id]/board?seed=…` (already Bearer-required; the privacy
  gate is IN ADDITION to the finished-that-daily guard)

Caller identity: optional `Authorization: Bearer <supabase access_token>`
header (same pattern as the board route). Send it on ALL FOUR calls whenever a
session exists — without it, the owner of a private profile is gated out of
their own deep data.

Gate logic (server, `apps/web/lib/profile-privacy.ts`):

```
target.is_private == false            → full response (unchanged)
caller.id == target id                → full response
caller profile has is_admin == true   → full response
otherwise                             → 403, body: { "error": "This profile is private", "private": true }
```

Clients MUST branch on `private: true` in a 403 body (do not string-match the
error). Cache-Control: gated 403s and owner/admin full responses are
`private, no-store`; public full responses keep their old shared-cache
headers.

## 3. What the viewer sees

### Private profile, viewer is someone else (the teaser card)

One clean card styled like the profile header. Fields — all from the
world-readable `profiles` row; no extra endpoint needed:

- avatar, username (accent color / gradient as usual)
- lock badge: `This profile is private`
- subline: `{username} keeps their words and strategies to themselves. You can
  still meet them on the daily leaderboards.`
- `Level {n} · {tier}` chip (tier ladder: Bronze <11, Silver 11–25, Gold
  26–50, Platinum 51–99, Diamond 100+)
- `Member since {Mon YYYY}` (profiles.created_at)
- medal counts: gold / silver / bronze
- Wins, Games (wins+losses), Daily Streak (profiles.daily_login_streak)
- Report / Block still available; Back navigation

NOTHING else renders. Hidden surfaces (each native app must gate every one it
has): top words, opener/persona/archetype/percentile chips, presence line,
today ring, recent games list, per-mode stats, You-vs-Them + head-to-head,
highlights reel, Lately feed, nemesis, streak calendar, medal-history
drilldowns/podiums, board viewer.

### Private profile, viewer is the owner or an admin

Full profile exactly as before, plus a subtle chip near the username:
owner sees `Your profile is private`, admin sees `Private profile`
(lock icon, muted pill).

### Owner's own profile tab

Small lock chip `Private` next to the Edit/Share buttons when private; tapping
opens the edit surface. Tooltip/accessibility copy: `Your profile is private —
other players see a limited card. Tap to change.`

## 4. The toggle

Lives in the profile edit surface (web: `ProfileEditModal`, section label
`Privacy`). Row: lock/globe icon + `Private profile` + ON/OFF pill; saves
`profiles.is_private` with the rest of the form. Helper copy:

> Hide your words, stats, and game history from other players. You'll still
> appear on leaderboards.

## 5. Explicitly unaffected

- **Leaderboards** (daily, sweep, records): a private player still appears —
  playing a daily/VS is public competition. Do not filter them.
- **Live VS surfaces**: match/result screens for a game the viewer played
  show the opponent's words as always (they saw them in the match).

## 6. Client-side hygiene (mirror on native)

Besides honoring the 403, do not read the still-world-readable tables
(`daily_results`, `user_stats`, `medals`) for another user's private profile —
skip those queries entirely when `profiles.is_private` is true and the viewer
is not the owner/an admin. Wait for auth to settle before deciding, so the
owner never flashes their own teaser.

## 7. Known residual gap (accepted, documented)

`daily_results` / `user_stats` / `medals` SELECT policies remain `using
(true)` because leaderboards read them client-side. A determined client can
still query a private user's rows there by user_id (scores, times, guess
counts — never guess words; those live in `matches` behind the
participants-only policy). Closing it requires moving leaderboard reads behind
a server route/RPC first — see the notes in the migration file. Follow-up, not
part of this change.

## 8. Copy strings (verbatim)

| Key | String |
|---|---|
| lock badge | `This profile is private` |
| teaser subline | `{username} keeps their words and strategies to themselves. You can still meet them on the daily leaderboards.` |
| owner chip (full page) | `Your profile is private` |
| admin chip (full page) | `Private profile` |
| own-tab chip | `Private` |
| own-tab chip tooltip | `Your profile is private — other players see a limited card. Tap to change.` |
| toggle section label | `Privacy` |
| toggle row | `Private profile` |
| toggle helper | `Hide your words, stats, and game history from other players. You'll still appear on leaderboards.` |
| 403 body error | `This profile is private` |
