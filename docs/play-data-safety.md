# Play Data safety — the answers, derived from the code

Google's Data safety form is a **declaration you sign**, so I have not submitted
it. What follows is every answer traced to the line that makes it true, so
filling it in is transcription rather than recall — and so a reviewer comparing
the form against https://wordocious.com/privacy finds them consistent.

The privacy policy was rewritten on 2026-07-30 (`47180b0`) specifically so this
form would not contradict it. **If you change an answer here, change the policy
too.**

## Data collected

| Category → type | Collected | Shared | Required? | Purpose | Evidence |
|---|---|---|---|---|---|
| Personal info → **Email address** | Yes | No | Required | Account management | Supabase auth; `auth-context.tsx` signUp |
| Personal info → **Name** (username) | Yes | No | Required | Account management, **App functionality** | `profiles.username`, rendered on public leaderboards |
| Personal info → **User IDs** | Yes | No | Required | Account management, Analytics | Supabase `auth.uid`, sent to Sentry as user context |
| Photos and videos → **Photos** | Yes | No | Optional | App functionality | Avatar upload → Storage `avatars/<uid>/avatar.jpg` |
| Financial info → **Purchase history** | Yes | No | Optional | App functionality | Play Billing + `store_webhook_events` |
| App activity → **In-app search history** | No | — | — | — | no search over user content |
| App activity → **Other user-generated content** | Yes | No | Optional | App functionality | `bio`, `social_links` on the profile |
| App activity → **Other actions** | Yes | No | Required | Analytics, App functionality | game results, streaks, XP, `share_events` |
| App info and performance → **Crash logs** | Yes | No | Optional | Diagnostics | Sentry, `io.sentry.auto-init` |
| App info and performance → **Diagnostics** | Yes | No | Optional | Diagnostics | Sentry performance/context |
| Device or other IDs → **Device or other IDs** | Yes | **Yes** | Optional | **Advertising or marketing** | AdMob advertising ID; free tier only |

**The one that trips people up:** the advertising ID counts as **shared**,
because Google AdMob is a third party receiving it. Everything else stays with
us and our processors, which Google treats as "collected, not shared."

## Security practices

- **Encrypted in transit** — Yes. All traffic is HTTPS; Supabase and the socket
  server are TLS.
- **Users can request data deletion** — **Yes.** Settings → Delete Account
  exists on all three platforms and removes the profile, stats and the avatar
  from Storage (`05e6461` added the Storage cleanup).
- **Data deletion URL** — https://wordocious.com/settings (in-app path) — the
  form also accepts an account-deletion web URL.
- **Committed to the Play Families Policy** — No (not a children's app).
- **Independent security review** — No.

## Content rating questionnaire — expected answers

Also a declaration; these are the factual answers, you submit them.

- Violence, sexual content, profanity, controlled substances: **No.**
- **Does the app contain user-generated content? YES.** Usernames and bios are
  visible to other users on leaderboards and public profiles. Answering "no"
  here is the mistake that gets an app pulled later.
  - Moderation: a report flow (`reports` table), user blocking, an `is_banned`
    filter, and — as of `82964f4` — a database-enforced username policy.
- Does the app share user location? **No.**
- Digital purchases: **Yes** (Pro subscription + Day Pass).
- Ads: **Yes**, the app contains ads (free tier).

## Still yours to do in Play Console (task #49)

1. **In-app products** — create `pro_monthly`, `pro_yearly`, `pro_day` with
   prices. Pricing is a business decision, not one I should guess at.
2. **Data safety** — transcribe the table above and submit.
3. **Content rating** — answer the questionnaire above and submit.
4. **Store listing** — copy, screenshots, feature graphic.
5. **Testers** — add Doug's email to the internal track.

Items 2 and 3 are declarations, so they need you regardless of who does the
clicking. Item 1 needs your prices. Items 4 and 5 I can drive on request.
