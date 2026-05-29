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
| `/propernoundle` | `app/propernoundle/` | — | ⛔ needs proper-noun data + UX |
| `/daily` (leaderboard) | `app/daily/page.tsx` | `LeaderboardTab` | 🟡 re-audit vs /daily page UX |
| `/records` | `app/records/page.tsx` | `RecordsTab` | 🟡 re-audit (sections, mode tabs, current-user highlight) |
| `/profile` `/profile/[id]` | `app/profile/page.tsx` + `profile/` | `ProfileTab` | 🟡 re-audit full profile (stats grid, heatmap, personality, edit) |
| `/pro` | `app/pro/page.tsx` | — | ⛔ Pro/subscription page + StoreKit (Phase 2) |
| `/how-to-play` | `app/how-to-play/page.tsx` | Help modal | ✅ Help modal matched; verify standalone /how-to-play page too |
| `/about` `/privacy` `/terms` `/support` | `app/<x>/page.tsx` | — | ⛔ static info pages (link from settings) |
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
| Auth (sign-in) | `auth/` | `AuthView` | 🟡 re-audit vs web auth UI |

## Process
Work top-down through this table; for each, read the web source, replicate, build,
verify in the simulator, commit, update this audit + WORDOCIOUS_BIBLE.md.
