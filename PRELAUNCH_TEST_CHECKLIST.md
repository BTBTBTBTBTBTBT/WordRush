# Pre-release manual test checklist (build 128+)

Run on a real device (TestFlight). Items marked ⚡ are the never-tested paths
from the 2026-07-21 audit; the rest are regression passes on tonight's changes.

## Payments (iOS sandbox)
- [ ] ⚡ Monthly → Yearly plan switch (Manage Subscription sheet): crossgrade applies, Pro stays active, no double shields
- [ ] ⚡ Refund path: request a sandbox refund (or cancel+expire) → app drops Pro within a day (fail-closed + daily sweep)
- [ ] Restore Purchases on a fresh install → Pro returns, shields NOT re-granted
- [ ] Day Pass while subbed → expiry stacks +24h beyond sub expiry

## Retry queue (new)
- [ ] Airplane mode ON → finish a daily → result "lost" → airplane OFF → force-quit → relaunch → result appears (leaderboard + profile), exactly once
- [ ] Finish a daily normally → relaunch → NOT double-counted

## Interruption matrix ⚡
- [ ] Phone call mid-VS match → return: match state sane (or clean forfeit)
- [ ] Background during VS countdown → return before timeout: game playable
- [ ] Force-quit mid-daily → relaunch: board restores, timer sane
- [ ] Network drop mid-guess → guess rejected gracefully, game continues

## Moderation (new)
- [ ] Public profile (someone else's) → ⋯ menu → Report → reason → "Report submitted"
- [ ] Block user → their row disappears from today's leaderboard after refresh
- [ ] Unblock → row returns
- [ ] Try setting username to something with a slur / "admin" → server rejects (after migration applied)

## Word lists (new)
- [ ] Today's dailies all load post-purge (all 9 modes)
- [ ] A removed slur is rejected as a guess in Six/Seven

## Crash reporting — SETUP (Brian, one-time)
1. Create account at sentry.io (free tier fine) → org `showloud`
2. Create 3 projects: wordocious-web (Next.js), wordocious-ios (Apple), wordocious-android (Android)
3. Paste the 3 DSNs into a message to Claude → wiring lands same session
   (web: env var + @sentry/nextjs; iOS: sentry-cocoa SPM in project.yml, init in
   WordociousApp gated on DSN presence; Android: sentry-android gradle plugin).
   Privacy label impact: none beyond existing (crash data = app diagnostics,
   not tracking) but re-check the ASC privacy questionnaire when adding.
