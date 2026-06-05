# Wordocious — Native Android Build Plan (Kotlin + Jetpack Compose)

*Created 2026-06-05. Companion to `WORDOCIOUS_BIBLE.md` and `project_native_ios_build`. This is the authoritative plan for the third client: a fully-native Android app at **complete UX/UI parity with the iOS SwiftUI app**, sharing all backend state, and built by reusing every lesson from the iOS build so we don't re-pay for the same troubleshooting.*

> **Build-to spec:** the exhaustive, file-referenced functional/UX/data parity spec — every mode, screen, animation, completed-state, socket event, and Supabase column — lives in **`WORDOCIOUS_ANDROID_PARITY_SPEC.md`** (produced by a 6-agent audit of the iOS app, 2026-06-05). Build each surface against that spec; this document is the *plan/sequencing/decisions*, that one is the *checklist*.

---

## 0. Goal & non-negotiables

1. **Pixel-and-behavior parity with the iOS native app.** The iOS app is the source of truth (it itself mirrors wordocious.com). Every color, font, icon, mode card, menu item, animation, screen, and copy string must be identical. AUDIT-THEN-MATCH applies to every surface — read the iOS implementation first, replicate it, never approximate.
2. **All stats sync across web ⇄ iOS ⇄ Android.** Same Supabase tables, same daily seeds, same socket server. A daily played on Android shows on the web/iOS leaderboard and counts toward the same streak/XP/medals. VS works cross-platform.
3. **Native feel** — Jetpack Compose, native gestures/animations, Play Billing, AdMob, Google sign-in.
4. **Parity by fixtures, not by sharing code.** Hand-port the engine to Kotlin the same proven way we did Swift, and gate it behind the **same JSON fixtures**. Parity is guaranteed by the fixtures whether the engine is shared or copied — and since the engine is mature/stable, a third copy is a light, mechanical sync, not a drift trap. **KMP is explicitly deferred** (see §1) — it pays its cost up front on a solo learner for a benefit that's small for a stable engine.

---

## 1. Architecture

```
packages/core (TS)            ← web source of truth
apps/ios/Sources/Core (Swift) ← iOS engine (hand-port, validated vs fixtures)
apps/android …/core (Kotlin)  ← NEW: Android engine (hand-port, validated vs the SAME fixtures)
                                 └──> Android app (native Jetpack Compose UI)
Supabase (auth, profiles, user_stats, daily_results, matches, gauntlet_stages) ← shared by all 3
Railway socket.io server (server.wordocious.com)                               ← shared by all 3
```

**Engine — hand-ported Kotlin, fixture-validated.** Port `types · evaluator · seed · dictionary · scoring · reducer · prefill · gauntlet config` from TS to Kotlin exactly as we did for Swift, and gate it behind the **same JSON fixtures**. Parity is enforced by the fixtures, not by code-sharing. The engine is mature, so keeping a third copy in sync is a light, mechanical task (re-run fixtures on any change).

**Android app (Compose):** all UI, navigation, persistence, billing, ads, auth, socket client, notifications — native, mirrors the iOS app structure 1:1.

**KMP is deferred (not chosen).** Kotlin Multiplatform would *share* the engine instead of copying it — but it pays its real cost (multiplatform Gradle + iOS-framework export) **up front**, on a solo dev learning the stack, while its benefit (less sync effort) is **small** for a stable engine and only fully lands after a *future* iOS migration. It's a clean refactor to do **later** — once both apps are stable, or if the engine ever starts changing often — with zero risk to the live iOS app. (Decisive insight: fixtures give parity; KMP only saves sync effort.)

**Data layer:** Supabase access via `supabase-kt` lives in the **Android app**. The parity-critical part — the scoring/composite-score *values* — is in the engine port and fixture-checked; the Supabase plumbing is thin and store-specific.

---

## 2. Cross-platform sync (already mostly solved — Android just joins)

| Concern | Mechanism | Android work |
|---|---|---|
| Auth / identity | Supabase auth (email, Google, Apple) | Google sign-in via Credential Manager → `signInWithIdToken`; email; (Apple via web OAuth, optional). Same Supabase project. |
| Daily puzzles identical | Deterministic seed from date+mode in the engine | Kotlin engine port reproduces the exact seed → same words. **Validate against fixtures.** |
| Per-mode stats | `user_stats` (solo + vs, seconds) | Read/write the same rows. |
| Daily leaderboard | `daily_results` | Same composite-score logic (in the engine port, fixture-checked). |
| Profile/XP/streak/medals/shields | `profiles` | Same award logic (in the engine port / shared logic, fixture-checked). |
| Match history / VS | `matches` (+ `gauntlet_stages`) | Same client-writes design; designated-writer rule already on the server. |
| Realtime VS + presence | socket.io @ `server.wordocious.com` | Kotlin socket.io client; same event protocol. |
| Pro entitlement | `profiles.is_pro` / `pro_expires_at` | **Server-side only** (see §4) — never client-writable. |

> The backend is already multi-client. The risk isn't the schema — it's the **engine/scoring/seed logic drifting**. The **shared JSON fixtures** are the mitigation (every engine copy must pass them).

---

## 3. The "Apple Playbook" — apply every iOS learning up front

These are the things that cost us time on iOS. Pre-empt each on Android:

| iOS pain we hit | Android plan (do it from day 1) |
|---|---|
| Google sign-in: Supabase web-OAuth returned an empty auth code → switched to the GoogleSignIn SDK + `signInWithIdToken`; needed Supabase **"Skip nonce checks"**; needed resilient session storage. | Use **Credential Manager / Google Identity** → idToken → `signInWithIdToken` from the start. Supabase "Skip nonce checks" is already ON. Persist the session in **DataStore** (Android's keychain-equivalent is fine, no entitlement quirk). |
| App signing: `CODE_SIGNING_ALLOWED=NO` archive stripped the `applesignin` entitlement → manual re-sign every build. | **Play App Signing** (Google holds the app key; you hold an upload key). No entitlement-strip problem exists. Set up the upload keystore + Play App Signing once, day 1. |
| Build number hardcoded by xcodegen (`CFBundleVersion=1`). | `versionCode`/`versionName` in `build.gradle.kts` — trivial; bump `versionCode` per upload. No gotcha. |
| `is_pro` was client-writable (self-grant hole) → built App Store Server Notifications webhook; column lock deferred. | Reuse the **same lesson**: the `lock_pro_columns` migration locks the column for *all* clients. Wire **Play Real-time Developer Notifications (RTDN) + Play Developer API** server-side for Android entitlement, mirroring the Apple webhook. Lock the column before either store enforces. |
| Engine parity worry (TS vs Swift) → validated with JSON fixtures. | **Reuse the exact fixtures** to validate the Kotlin engine. Same test suite shape. Instant confidence, zero new fixtures. |
| Multi-board fill math (non-square tiles, fill width+height, 8px/2px gaps), OctoWord zoom. | Port the *solved* layout math directly to Compose (`Layout`/`BoxWithConstraints` + `graphicsLayer`). It's pure math — copy it. |
| Tile-flip: 0→180 face-swap looked wrong; the right answer is an **orthographic squash** (`scaleY = cos`), per-tile stagger; zoom = **deterministic scale+offset** (matchedGeometry flew from the top); confetti contention; victory sequencing (hold board → flip → spring in results). | Implement these the *correct* way immediately in Compose (`graphicsLayer { scaleY = … }`, `animate*AsState`, `AnimatedVisibility`). We already know the end state — skip the iteration. |
| Immersive nav: games must be full-screen over the tab bar (fragile `ChromeVisibility` counter → per-screen set + full-screen presentation). | In Compose Navigation, give game routes their own destinations that don't render the bottom bar. No counter hack. |
| Completed-screen re-entry: gauntlet showed a generic grid; fixed with deterministic **replay reconstruction** from seed+guesses; completed-card mode-leak (stale state). | Port `GauntletReconstruct` + the per-mode reset directly. Known solutions. |
| AdMob: new app serves blank ~1–2 days; UMP consent + ATT ordering. | Create the **AdMob Android app** early (so it's approved by launch); UMP consent flow (no ATT on Android, but GDPR/UMP applies). |
| Realtime server URL churn (Render→Railway, GoDaddy DNS). | Point at the stable `server.wordocious.com` from the start. |

---

## 4. Monetization on Android

- **Play Billing** (Billing Library / or RevenueCat to abstract both stores):
  - **Pro subscription** — monthly $6.99 (+ add the recommended **annual ~$35–40** tier; configure once, applies to iOS too).
  - **$0.99 day-pass** — modeled as a **consumable** that extends `pro_expires_at` (same approach as the iOS plan).
- **Server-side entitlement (critical):** **Play RTDN** (Pub/Sub) + **Play Developer API** verify purchases and set `is_pro`/`pro_expires_at` via the service role — mirroring the App Store Server Notifications webhook in `apps/web/app/api/appstore/`. Build a sibling `apps/web/app/api/play/` route. The `lock_pro_columns` migration must be live so neither client can self-grant.
- **AdMob Android:** new AdMob app + ad unit IDs (banner, rewarded-interstitial); UMP consent; free users see ads, Pro is ad-free. (Same gating logic as iOS.)
- **RevenueCat consideration:** since we now support two billing systems with server entitlement on both, RevenueCat could unify iOS + Android purchases + entitlement and reduce the bespoke webhook surface. Worth evaluating vs. the hand-rolled webhooks we already have on iOS.

---

## 5. Feature / screen parity matrix (don't miss anything)

Every item below must match the iOS app exactly (which matches the web). Build order roughly top-to-bottom.

**Foundation**
- Theme tokens: colors, gradients, **Nunito** font, `Brand` type scale, per-mode accent colors, light/dark, **color-blind mode**, **reduced-motion** honoring.
- Navigation shell: 4-tab bottom nav (Home / Leaderboard / Profile / Records) — outline+muted inactive, filled+purple+dot active; hidden on game screens (immersive).

**Game engine surfaces (all 9 modes)**
- Board/tile rendering: single-board + **multi-board fill** (non-square tiles, per-board gray card frame, win=green/loss=red).
- Keyboard: standard + **per-board quadrant** (Quad/Octo/Deliverance); Delete-left / Enter-right.
- Live invalid-word red row; **shake** on reject; "Already guessed"; toast styling.
- **Tile-flip reveal** (orthographic squash, per-tile stagger), win/loss flow, **victory + confetti** sequencing.
- Hints (Six/Seven vowel/consonant; ProperNoundle clue/Wikipedia).
- Per-mode specifics: Succession locked-board masking + active border; Deliverance prefilled rows; **OctoWord tap-to-zoom** (deterministic scale+offset morph).
- **Gauntlet:** stage stepper + **active-stage pulsing glow**, stage-transition overlay, stage-review, **animated `GauntletResults`** (win + loss), deterministic reconstruct on re-entry.
- **ProperNoundle:** board, clue, post-game, corner home button.
- Post-game: FinishedStatsHeader / corner home button, daily rank badge, **score breakdown**, definition card, share image (+ `/s/` parity).

**Tabs & pages**
- **Home:** DAILY CHALLENGE header + countdown, mode picker, 9 mode cards (icons in accent boxes), daily hero / sweep-flawless banners, Word of the Day, live-players bar, pending-invites banner, Pro play-mode toggle, streak/shield, **1-play/day greying** (incl. VS), sign-out, footer links.
- **Leaderboard:** mode picker, **Completed-Today card** (per-mode boards + stats + **score breakdown**, gauntlet stage breakdown), rank banner, leaderboard list, Yesterday's Winners.
- **Profile:** stats, **charts/dashboard**, **medals**, **Recent Matches** (mode icon, Solo/VS pill, guesses·time, win/loss, date), edit profile, avatar upload, public profiles (`/profile/[id]`).
- **Records.**
- **Pro:** paywall, plans (annual/monthly/day-pass), Pro insights, restore.
- **Settings + Info:** about, privacy, terms, support, **How to Play**, onboarding.

**Systems**
- Local persistence (resume mid-game) — DataStore/Room; per seed+mode keys.
- Daily reminder **notifications**.
- **VS multiplayer:** lobby, matchmaking, invites (incoming banner), live opponent mini-board, results, **rematch** (two `offer_rematch`), daily-VS leaderboard, XP toast, VS limit modal.
- Modals/toasts: XP / level-up toast, streak-shield modal, contextual pro-prompt, mode-limit modal.
- Account deletion.

---

## 6. Phase plan (mirrors the iOS sequence that worked)

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Setup** | Android Studio project + Kotlin engine module, Play Console app, **Play App Signing** + upload keystore, AdMob Android app, Google OAuth Android client, Supabase wired, `server.wordocious.com`. | Empty app installs + signs; Supabase session round-trips. |
| **1 — Engine port** | Hand-port the engine to Kotlin; wire the **existing JSON fixtures** into a Kotlin test suite. | All fixtures pass — seeds/evals/scoring identical to TS/Swift. |
| **2 — Core game** | Compose Tile/Board/Keyboard; Classic daily end-to-end; local persistence. | Play + win/lose Classic; resumes; flip/shake correct. |
| **3 — All modes + animations** | Six/Seven, Quad/Octo (+fill +zoom), Succession, Deliverance, Gauntlet (+results), ProperNoundle; victory/confetti; post-game + score breakdown + share. | Every mode at iOS parity, side-by-side. |
| **4 — Auth + data sync** | Google/email login gate; read/write `daily_results`/`user_stats`/`profiles`; medals/XP/streak. | A daily on Android appears on web/iOS leaderboard; stats match. |
| **5 — Tabs & pages** | Home, Leaderboard, Profile, Records, Settings, Info, onboarding — AUDIT-THEN-MATCH each vs iOS. | Pixel parity pass per screen. |
| **6 — Billing + entitlement** | Play Billing (Pro/annual/day-pass) + **Play RTDN webhook** + column lock. | Sandbox purchase sets `is_pro` server-side; ad-free toggles. |
| **7 — Ads** | AdMob banner + interstitial + (rewarded), UMP consent. | Free sees ads, Pro doesn't; consent compliant. |
| **8 — VS** | Kotlin socket client; lobby/invites/live board/results/rematch; daily-VS. | Cross-platform match: Android vs iOS/web works. |
| **9 — Polish** | Notifications, account deletion, animation parity sweep, color-blind/reduced-motion, edge cases. | Adversarial parity audit (web↔iOS↔Android). |
| **10 — Submit** | Play Console listing, content rating, data-safety, screenshots; internal testing → production (manual release). | Live on Play Store. |

---

## 7. Risks & mitigations

- **Engine drift (TS/Swift/Kotlin — three copies).** → Shared JSON fixtures gate every copy (proven on Swift); the engine is mature so syncs are rare + mechanical. Optional future KMP consolidation can collapse the two native copies into one.
- **WebView-vs-native expectation creep.** → We chose native specifically for UX; budget accordingly (this is months, not weeks).
- **Solo-dev load / bus factor** (partner flagged). → This roughly doubles native maintenance. Decision point: a focused solo stretch vs. an Android co-dev/contractor (also de-risks bus factor).
- **Billing parity across two stores.** → Evaluate RevenueCat to unify iOS+Android purchases/entitlement.
- **IP/trademark** (QuadWord/OctoWord vs Quordle/Octordle; "Wordle"). → Trademark read before a second store widens exposure.
- **Play "minimal functionality" / policy.** → Native app with real features — not an issue (unlike a TWA wrapper).

---

## 8. Decisions (locked 2026-06-05)

1. **Billing/entitlement → lean RevenueCat** (unify App Store + Play behind one entitlement source of truth). Reconsider only if we want to avoid reworking the iOS StoreKit path. *Decide for real at Phase 6, before building either store's billing twice.*
2. **Engine → hand-port to Kotlin, validate vs the same fixtures (NOT KMP).** Parity is guaranteed by the fixtures, not by sharing code; a third copy is a light sync given a stable engine, and it avoids the multiplatform-Gradle complexity tax on a solo learner. The parity-critical **scoring/composite-score** logic lives in the engine port. Supabase data-access lives in the Android app (`supabase-kt`). *(Revised from an earlier "both apps on KMP" lean after the ShowLoud-Claude critique — the decisive realization: fixtures give parity, KMP only saves sync effort, which is small for a stable engine.)*
3. **Apple sign-in on Android → yes, for account continuity** (so Apple-account users from iOS aren't locked out), added as a **later auth phase** (Google + email first). No Play requirement; purely continuity.
4. **Build approach → SOLO**, learning as we go. Division of labor with the assistant: **assistant drives the Kotlin engine port + Gradle/project setup + fixture wiring** (the setup-heavy, drift-critical plumbing); **owner drives the Compose UI** (maps directly onto existing SwiftUI experience — Compose ≈ SwiftUI). Bus-factor remains the open risk to revisit if/when there's a real user base.
5. **KMP consolidation → optional, later (not now).** Near-term reality: three fixture-validated engine copies (TS web, Swift iOS, Kotlin Android) — parity enforced by the shared fixtures. If the engine ever starts churning, or once both apps are stable, KMP can collapse the two native copies into one (and retire the Swift port) — done in a calm window, never by destabilizing the live iOS app.

**Net gating item to start Phase 0:** none remain. Begin Phase 0 (Android project + Kotlin engine-port scaffold, fixtures wired) when ready.

---

*Build cadence + learnings logged here as we go, same as the iOS build log in the Bible.*
