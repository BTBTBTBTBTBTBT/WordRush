# Web → Native Parity Audit

**Rule:** every native screen is built by FIRST reading the real web implementation
in `apps/web` (page + components + data + copy + icons + UX), then replicating it
identically. The web is the source of truth. No approximating.

Status legend: ✅ matched · 🟡 built but needs re-audit vs web · ⛔ not started · 🚫 N/A (not in native scope)

## User-facing routes

| Web route | Web source | Native | Status |
|---|---|---|---|
| `/` (home) | `app/page.tsx` + `arcade/` | `HomeView` | ✅ audited + matched (grid/icons/banner/word-of-day/pills); verified live |
| `/practice` (Classic) | `app/practice/page.tsx` + `practice/`, `game/` | `GameScreen` | ✅ audited+matched: gradient title, timer, post-game score breakdown + definition + Home/Share, exact share image; verified live. (TODO: active-play timer, completed-daily read-only view) |
| `/quordle` `/octordle` `/sequence` `/rescue` `/six` `/seven` | `app/<mode>/page.tsx` + `<mode>/` | `GameScreen` (multi-board) | 🟡 shared GameScreen covers them; audit each page's title gradient + multi-board share layout |
| `/gauntlet` | `app/gauntlet/page.tsx` + `gauntlet/` | `GameScreen` (gauntlet) | 🟡 audit transition/results screens |
| `/propernoundle` | `app/propernoundle/` | `ProperNoundleView` | ✅ built: ProperNoundleEngine (normalize/evaluate/wordGroups/daily category round-robin) + word-group board + keyboard + hints (clue/vowel/consonant) + records. Bundled puzzle data. ✅ visually verified in sim (gradient title, category pill, live timer, word-group board, tile entry, hint buttons). (Deferred: Wikipedia hint fetch) |
| `/daily` (leaderboard) | `app/daily/page.tsx` | `LeaderboardTab` | ✅ audited+matched: full mode picker, your-rank banner, rank icons, current-user highlight, win/loss pill, player count, yesterday toggle. (TODO: CompletedDailyBoard preview, rank-delta badge) |
| `/records` | `app/records/page.tsx` | `RecordsTab` | ✅ audited+matched: RECORDS header, Daily\|All-Time toggle, Hall of Fame + By-Game-Mode picker, StatCell w/ current-user highlight, Daily solo/VS leaderboard. (Signed-in content not yet visually verified — needs a session) |
| `/profile` `/profile/[id]` | `app/profile/page.tsx` + `profile/` | `ProfileTab` | 🟡 CORE matched (header+level tier+XP, Today's Dailies, GlobalSummaryRow, mode picker + per-mode stats). DEFERRED: activity calendar, guess-distribution + solve-time charts, top words, time-of-day heatmap, Pro stats/insights, edit modal, social links, notification toggle, "All" dashboard |
| `/pro` | `app/pro/page.tsx` | `ProView` + `StoreManager` | ✅ page matched (header, 8 benefits, monthly/yearly + day pass, ACTIVE PRO state) + **real StoreKit 2 purchases**: live prices, purchasing spinners, Restore Purchases, auto-renew disclosure (Guideline 3.1.2). Verified transaction writes is_pro/pro_expires_at/streak_shields (mirrors web fulfillSubscription). ⚠️ needs App Store Connect products + run-via-scheme to test — see `STOREKIT_SETUP.md` |
| `/how-to-play` | `app/how-to-play/page.tsx` | Help modal | ✅ Help modal matched; verify standalone /how-to-play page too |
| `/about` `/privacy` `/terms` `/support` | `app/<x>/page.tsx` | `InfoPage` + `SettingsView` | ✅ Settings (theme picker + toggles, persisted; theming infra deferred) + 4 info pages, reached via gear in Profile. Legal prose summarized to canonical sections (keep in sync w/ web) |
| `/practice/vs` + all `/<mode>/vs` | `app/<mode>/vs/` + `vs/`, `pvp/` | — | ⛔ VS multiplayer (Phase 3, socket.io) |
| `/vs/join/[code]` | `app/vs/join/[code]/` | — | ⛔ invite join (Phase 3) |
| `/admin/*` | `app/admin/` | — | 🚫 internal admin, not in consumer app |

## Modals / overlays

| Web | Source | Native | Status |
|---|---|---|---|
| Help (How to Play / Game Modes / FAQ) | `modals/help-modal.tsx` | `HelpView` | ✅ identical port (copy/examples/modes/FAQ/accent bar) |
| Mode limit (free daily cap) | `modals/mode-limit-modal.tsx` | — | ⛔ (Pro gating) |
| Pro prompt | `modals/pro-prompt-modal.tsx` | — | ⛔ |
| Streak shield | `modals/streak-shield-modal.tsx` | — | ⛔ |
| VS limit | `modals/vs-limit-modal.tsx` | — | ⛔ (Phase 3) |
| Welcome / onboarding | `modals/welcome-modal.tsx` | — | ⛔ |
| Settings | `settings-dialog.tsx` | — | ⛔ |
| Share results | `share/` | — | ⛔ |
| Auth (sign-in) | `auth/` | `AuthView` | ✅ adapted login-screen.tsx (wordmark, Welcome/Join, email/password, toggle, Privacy\|Terms). **Native diverges intentionally: Apple replaces Facebook** (App Store 4.8 requires Sign in with Apple alongside any social login). Apple + Google + email all wired & functional in code. ⚠️ Apple/Google need server config — see `OAUTH_SETUP.md` |
| Auth gate (app-wide) | `auth/auth-gate.tsx` | `ContentView` + `LoadingSkeleton` | ✅ matched: loading→branded skeleton (header bar + hero + 2×2 cards, pulsing); no session→AuthView (no Close btn); signed-in→RootTabView. Zero unauthenticated gameplay, like web. Verified in sim |

## Process
Work top-down through this table; for each, read the web source, replicate, build,
verify in the simulator, commit, update this audit + WORDOCIOUS_BIBLE.md.
