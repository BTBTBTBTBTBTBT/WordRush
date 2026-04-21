# Wordocious — Product & Monetization Bible

> Current, comprehensive snapshot of the platform for partners evaluating
> monetization, product, and technical readiness. Everything below reflects
> what is live today; sections explicitly mark items that are scaffolded but
> not yet fully shipped.

**Brand**: Wordocious
**Live URL**: https://wordocious.com (+ www.wordocious.com)
**Legacy alias**: spellstrike.vercel.app (pre-rebrand; still live)
**Document date**: 2026-04-21
**Latest production commit**: `86996db` on `main`
**Status**: All features below are live in production unless explicitly noted.

---

## 1. Elevator Pitch

A competitive word puzzle platform with 7 game modes, real-time multiplayer
VS battles, daily challenges with global leaderboards, and deep player
progression. The core loop is Wordle-style guessing, but modes escalate from
a single board up to a 21-board Gauntlet. Players return daily for the
shared challenge, climb leaderboards, earn medals, and compete head-to-head.

**One-liner**: Wordle meets competitive gaming — built for retention, social
competition, and daily engagement.

---

## 2. Target Audience

| Segment | Motivation | Session Pattern |
|---|---|---|
| Casual word gamers | Daily puzzle fix | 1 daily challenge, 2 minutes |
| Competitive puzzlers | Leaderboard rank, speed optimization | Multiple modes daily, composite-score grind |
| Social competitors | Beat friends, bragging rights | VS matches, shared results |
| Completionists | Every badge, every record | Medals, achievements, records hunt |
| Mobile-first players | Commute / break session | Responsive PWA; Capacitor wrappers ready |

**Age range**: 16–45. Word puzzle skews older than average mobile.
**Platform today**: Web-first responsive PWA. Capacitor 8.3 configured for
iOS/Android native wrappers (shells ready; store submission pending).

---

## 3. Game Modes (7)

Every mode supports **Solo** (random seed), **Daily** (same puzzle for all
players, resets at each player's **local midnight**), and **VS** (real-time
PvP via WebSocket).

| # | Mode | Route | Mechanics |
|---|---|---|---|
| 1 | Classic | `/practice` | 1 word, 6 guesses. The core Wordle experience. |
| 2 | QuadWord | `/quordle` | 4 boards simultaneous, 9 shared guesses. |
| 3 | OctoWord | `/octordle` | 8 boards simultaneous, 13 shared guesses. |
| 4 | Succession | `/sequence` | 4 boards solved sequentially. Complete one to unlock the next. 10 total guesses. |
| 5 | Deliverance | `/rescue` | 4 boards with pre-filled clue guesses. Decode hints + solve. |
| 6 | Gauntlet | `/gauntlet` | 5-stage escalating marathon: Classic → QuadWord → Succession → Deliverance → OctoWord. 21 boards, 50 guesses. |
| 7 | ProperNoundle | `/propernoundle` | Guess famous proper nouns (names, places, brands). Variable-length multi-word answers. 7 categories (Music / Video Games / Movies / Sports / History / Science / Current Events). Includes Wikipedia image hints. |

VS variants live at `/<mode>/vs`. Daily variants reached via `/<mode>?daily=true`.

**Mode identity colors** (used throughout UI):
- Classic `#7c3aed` · QuadWord `#ec4899` · OctoWord `#7e22ce`
- Succession `#2563eb` · Deliverance `#059669` · Gauntlet `#d97706`
- ProperNoundle `#dc2626`

---

## 4. Monetization Model

### Freemium Structure

| Feature | Free | Pro |
|---|---|---|
| Game modes | All 7 | All 7 |
| Daily plays per mode | 1 | Unlimited |
| VS battles | 1 daily match (shared puzzle) | Unlimited (random + daily) |
| Interstitial ads before games | Yes | None |
| Stats dashboard | Basic | Extended (per-mode charts) |
| Streak shields | None | 4 per billing period |
| Pro badge on profile | No | Yes |
| Early access to new modes | No | Yes |
| Pro-only Invite button on home | No | Yes |

### Pro Pricing (3 tiers)

| Plan | Price | Per-day | Streak Shields |
|---|---|---|---|
| Day Pass | **$1.00 / 24h** | $1.00 | None |
| Monthly | **$6.99 / month** | $0.23 | 4/period |
| Yearly | **$59.99 / year** | $0.16 | 4/period |

- The Day Pass is a low-friction impulse buy. 7 day passes cost more than a
  month, so repeat buyers funnel into Monthly.
- Day Pass **stacks**: buying mid-subscription extends expiry by 24h instead
  of resetting.

### Ad Revenue

- Google AdSense integration (`ca-pub-3015627373086578`)
- Interstitial ad gate before each game for free users only
- Countdown timer before "Continue" button appears
- Pro users skip ads entirely

### Payment Integration Status

- `PaymentProvider` interface + `DemoProvider` (instant fulfillment, no real
  charges) is what's running today — scaffolding for paid fulfillment is
  complete, but real charges are not enabled.
- `profiles.stripe_customer_id` and `profiles.stripe_subscription_id`
  columns exist and are wired into the provider interface. Swapping to
  Stripe is a single-file change: drop `StripeProvider` into
  `lib/payment/` and return it from `lib/payment/index.ts` when
  `STRIPE_SECRET_KEY` is set.
- For native (iOS/Android), the same interface is designed to accept a
  `RevenueCatProvider` swap.

---

## 5. Player System

### Authentication
- Google OAuth (one-click, auto-creates profile from Google metadata)
- Email + password (with username selection on first sign-in)
- Managed entirely by Supabase Auth

### Player Profile (`/profile`)
- Custom username (editable) + avatar (Google-sourced or uploaded)
- Level & XP bar
- Lifetime stats: wins, losses, win rate, current + best streak
- Medal display: gold/silver/bronze counts + recent medal history
- **Social links**: Twitter/X, Instagram, TikTok, Threads, Discord, website
- Achievement badge grid (locked = greyed, unlocked = colored + date)
- Per-mode extended stats (Pro): win rate chart, average solve time chart
- Match history with full replay data

### Public Profiles (`/profile/[id]`)
- Any player's public profile, linked from leaderboards and records
- Shows username, avatar, mode icons, win/loss stats, medal counts, socials
- No private data surfaced

### XP & Leveling

| Action | XP |
|---|---|
| Win | 100 |
| Loss | 25 |
| Streak bonus (streak > 1) | +50 |
| Daily bonus | +50 |
| Daily Sweep bonus (all 7 daily modes completed) | +200 |
| Flawless Victory bonus (all 7 dailies won) | +400 additional |
| Medal bonuses | Varies (gold 100 / silver 50 / bronze 25) |

**Level formula**: `floor(XP / 1000) + 1`

### Streaks
- **Daily login streak**: consecutive days played (player-local)
- **Win streak**: consecutive wins, resets on loss
- **Best streak**: permanent high watermark
- **Streak shields** (Pro): auto-protect a missed day without breaking
  streak; 4 credited per billing period
- **Streak medals**: automatic awards at 7, 30, and 100 consecutive days
- **Perfect medal**: for flawless single-game performance

---

## 6. Daily Challenge System

### Core Mechanics
- **Deterministic seeds**: `generateDailySeed(date, gameMode)` — every
  player worldwide gets the same puzzle on the same date.
- **Seed format**: `daily-YYYY-MM-DD-GAMEMODE`
- All 7 modes have independent daily puzzles.
- **Player-local midnight reset** (matches NYT Wordle). Daily date is
  computed from the user's device timezone, not UTC. A bfcache /
  visibility-change handler at the root layout forces a reload when the
  local day rolls over while the tab was frozen, so iOS Safari users who
  leave the tab open for days still see today's puzzle when they return.

### Composite Scoring Formula

```
composite_score = base_points + guess_bonus + time_bonus + board_bonus

base_points:  1000 if completed, 0 if DNF
guess_bonus:  max(0, maxGuesses - used) * weight
time_bonus:   max(0, timeCap - seconds)
board_bonus:  (boardsSolved / totalBoards) * 200
```

Per-mode tuning:

| Mode | Max Guesses | Guess Weight | Time Cap |
|---|---|---|---|
| Classic | 6 | 100 | 300s |
| QuadWord | 9 | 50 | 600s |
| OctoWord | 13 | 30 | 900s |
| Succession | 10 | 60 | 480s |
| Deliverance | 6 | 80 | 480s |
| Gauntlet | 44 | 20 | 1800s |
| ProperNoundle | 6 | 100 | 300s |

### Leaderboard (`/daily`)
- Mode selector tabs across all 7 modes
- Top 50 players ranked by composite score
- Gold/silver/bronze medal icons for top 3
- Current user's row highlighted with rank callout
- Completed puzzle preview below the CTA
- Collapsible "Yesterday's Winners" section
- Countdown to next daily reset

### Daily Sweep + Flawless Victory
- **Daily Sweep**: Completing all 7 daily modes in a single day → +200 XP + achievement.
- **Flawless Victory**: Winning all 7 daily modes in a single day → +400 additional XP.
- Tracked server-side in `daily_bonuses`; unique-per-day constraint prevents double-award even on client double-submits.
- Home hero + profile card swap to a celebratory variant when a sweep or flawless is complete.

### Spoiler-Free Social Sharing
Copy-to-clipboard share text (no solution leaked):

```
Wordocious Daily — Classic
2026-04-21
3/6 in 1:45

https://wordocious.com/daily
```

Multi-board modes include boards-solved ratio.

---

## 7. Multiplayer VS System

Real-time WebSocket-based competitive play powered by a dedicated
Socket.IO server on Railway:

- **Matchmaking queue** per game mode — server pairs players automatically
- **3-second synchronized countdown** before match start
- **Live opponent progress** streamed in real-time (attempts, boards, stage)
- **Winner determination**: boards solved → fewest guesses → fastest time
- **Rematch system**: both players can offer/accept rematches instantly
- **Disconnect handling**: opponent notified, match cleaned up
- **Freemium gating**: free users get 1 daily VS match (shared daily seed); Pro gets unlimited random + daily
- **Duplicate guess rejection** enforced both client and server-side across every solo and VS mode

### Match Invites
- Invite by **username** (targeted) or by **link** (share with anyone).
- Pro feature. Invites generate a unique `invite_code`.
- Matchmaking server pairs the two clients bearing the same code and
  bypasses the public queue.
- Invite state tracked server-side in `match_invites` with
  pending / accepted / declined / expired / cancelled statuses.
- Invitee sees a pending-invite badge in their header; tapping opens the
  invite modal.

### LIVE Presence Banner
- Home screen shows a real-time count of players currently on the site.
- Powered by a `/presence` endpoint on the Socket.IO server that dedupes
  connected sockets by a stable `presenceId` (signed-in user id, or a
  localStorage UUID for anonymous visitors).
- A player on multiple tabs, mid-VS, or across devices counts as **1**.
- Every page on the site mounts a `SitePresenceProvider` that opens a
  lightweight idle socket, so the count reflects the whole site, not just
  VS-page traffic.

---

## 8. Medals, Records & Achievements

### Medals
- **Gold / Silver / Bronze**: awarded to daily top-3 finishers per mode
- **Streak medals**: 7-day / 30-day / 100-day consecutive-play awards
- **Perfect medal**: single-game flawless performance
- Permanently stored; cumulative counts displayed on profile
- Recent medals shown in profile medal history

### All-Time Records (`/records`)

| Category | Records |
|---|---|
| Speed | Fastest win per mode |
| Efficiency | Fewest guesses per mode |
| Endurance | Most games played, longest streak, highest level |
| Collection | Most gold medals, most daily completions |

Crown icon overlays on records held by the viewing user.

### Achievements (12 Badges)

| Category | Badge | Trigger |
|---|---|---|
| Beginner | First Win | Win any game |
| Beginner | All Modes Played | Play each of 7 modes |
| Beginner | Daily Debut | Complete first daily challenge |
| Consistency | 7-Day Warrior | 7 consecutive days |
| Consistency | 30-Day Streak | 30 consecutive days |
| Skill | Speed Demon | Classic under 30 seconds |
| Skill | Perfectionist | Win in 1 guess |
| Skill | Gauntlet Master | Complete the Gauntlet |
| Social | VS Veteran | Win 10 VS matches |
| Social | Unstoppable | 5-win VS streak |
| Collection | Medal Collector | 10 medals |
| Collection | Medal Hoarder | 50 medals |
| Collection | Golden Touch | 10 gold medals |

Daily Sweep + Flawless Victory achievements also exist, awarded on first
occurrence.

---

## 9. Admin System

Live admin dashboard at `/admin` (role-gated by `profiles.role`):

| Section | Capability |
|---|---|
| `/admin` | User search, ban/unban, grant/revoke Pro, view audit log |
| `/admin/users/[id]` | Per-user deep dive: level, stats, medals, match history |
| `/admin/games` | Per-mode daily seed overrides, live leaderboard inspection |
| `/admin/content` | Announcements (create / edit / expire) — shown in-app as banner |
| `/admin/moderation` | Reports queue (scaffolded) |

All admin actions write to `admin_audit_log` with actor, target, action, and
reason for a full paper trail.

---

## 10. Visual Identity & Design Language

| Element | Details |
|---|---|
| Font | Nunito (700 / 800 / 900) — round, friendly, bold |
| Background | `#f8f7ff` (very light lavender) |
| Primary purple | `#7c3aed` |
| Brand gradient | `linear-gradient(135deg, #a78bfa, #ec4899)` |
| Accent gold / amber | `#d97706` / `#f59e0b` (CTAs, Pro, medals) |
| Card style | White, `1.5px solid #ede9f6` border, `16px` radius |
| Buttons | 3D effect with bottom shadow (`btn-3d`), gradient bgs |
| Section headers | ALL CAPS, `10px`, extrabold, `#9ca3af`, wide tracking |
| Animations | Framer Motion throughout: tile flips, staggered entrances, victory confetti, rotating trophy with orbiting stars |
| Theme | "Gradient glassmorphism" — purple/pink/orange warmth, playful but polished |

**Overall vibe**: Mobile-game energy with web-game accessibility. Playful,
bold, competitive — feels like opening an arcade, not a test.

---

## 11. Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 13.5 (App Router), React 18 |
| Styling | Tailwind CSS + Framer Motion |
| UI primitives | Radix UI (headless), Lucide icons |
| Charts | Recharts |
| Multiplayer | Socket.IO (dedicated server, WebSocket + polling fallback) |
| Database | Supabase (managed PostgreSQL, Row Level Security) |
| Auth | Supabase Auth (Google OAuth + email/password) |
| Payments | `PaymentProvider` interface (DemoProvider today; Stripe-ready) |
| Game engine | `@wordle-duel/core` shared package (dictionary, seeds, tile eval, scoring) |
| Monorepo | pnpm workspaces: `apps/web`, `apps/server`, `packages/core` |
| Native shell | Capacitor 8.3 (iOS + Android) |
| Ads | Google AdSense |

### Infrastructure

| Service | Host | Purpose | URL / ID |
|---|---|---|---|
| Web app (Next.js) | **Vercel** | Front-end + server routes + OG images | wordocious.com |
| VS server (Socket.IO) | **Railway** | Matchmaking + real-time play + `/presence` | wordrush-production.up.railway.app |
| Database + Auth | **Supabase** | Postgres + Auth + Storage | eniiqqsxpmuyrspvepiw |
| Storage | Supabase Storage | Avatars bucket (public) | bucket: `avatars` |
| DNS | Registrar + Vercel | apex + www | wordocious.com |

**Deploy pipeline**: auto-deploy on push to `main` for both Vercel and
Railway. A single commit rolls both front-end and real-time server at
once.

### Database (14 public tables)

| Table | Purpose |
|---|---|
| `profiles` | User identity, XP, level, wins/losses, streaks, medal counts, Pro status, Stripe ids, social links, role, ban state |
| `user_stats` | Per-mode per-play-type granular stats |
| `matches` | Full game history with replay data (guesses JSON) |
| `daily_seeds` | Deterministic daily puzzle storage |
| `daily_results` | Composite scores for daily leaderboards |
| `daily_bonuses` | Daily Sweep + Flawless Victory XP awards (one per user per day) |
| `medals` | Gold / silver / bronze / streak / perfect awards |
| `all_time_records` | Record holders per category |
| `achievements` | Unlocked badge tracking |
| `play_limits` | DB-backed daily play caps (replaces old localStorage — can't be bypassed by clearing site data, incognito, or switching browsers) |
| `match_invites` | VS invites by username or by link, with pending / accepted / declined / expired / cancelled statuses |
| `announcements` | Admin-pushed banner announcements |
| `admin_audit_log` | Every admin action with actor, target, reason |

All tables use **Row Level Security**:
- Leaderboard data is publicly readable
- Write access restricted to the owning user
- Admin-only tables gated by role

**Migration tracking**: `supabase_migrations.schema_migrations` is backfilled
with all 16 applied migrations, so `supabase db push` is a clean no-op
except for new migration files.

---

## 12. Retention Mechanics (Summary)

| Mechanic | How It Works | Psychological Hook |
|---|---|---|
| Daily challenges | New puzzle every local midnight, 7 modes | Appointment, FOMO |
| Countdown timer | Visible on home + leaderboard | Urgency, anticipation |
| Login streak | Consecutive day counter, resets on miss | Loss aversion |
| Win streak | Resets on loss, best streak tracked | Momentum |
| Streak shields (Pro) | Auto-protect missed days | Safety net → Pro conversion |
| Leaderboard rank | Top 50 + personal rank callout | Social comparison |
| Daily Sweep / Flawless | All-7 bonuses + achievements | Completionism per-day |
| Medal collection | Gold / silver / bronze / streak / perfect | Collectibility |
| Achievement badges | 12 across 5 categories | Completionism, long-horizon |
| All-time records | Hall of fame with crown icons | Aspirational targets |
| XP & levels | Visible number that always goes up | Progress illusion |
| Social sharing | Spoiler-free copy text | Organic virality |
| Pro upsell modals | Shown when free plays exhausted | Friction-at-peak-intent conversion |
| Word of the Day | Dictionary entry on home page | Daily educational hook |
| LIVE player count | Real-time count on home | Social proof |
| Match invites | Invite by username or link | Social re-engagement |

---

## 13. Recent Product Updates (last 2 weeks)

High-signal changes since the original SpellStrike snapshot, in roughly
chronological order:

- **Rebrand SpellStrike → Wordocious.** New domain (`wordocious.com`),
  metadata, OG images, share text, Capacitor config, etc.
- **$1 Day Pass tier** + Pro expiry correctness fixes.
- **Match invites**: invite by username (targets a specific user) or by
  link (share with anyone). Matchmaking server pairs clients by shared
  invite code.
- **Profile social links**: Twitter/X, Instagram, TikTok, Threads, Discord,
  website. Handles stored without leading `@`; rendered with safe `rel`
  attrs.
- **DB-backed play limits**: daily freemium caps moved from localStorage
  into `play_limits` so they can't be bypassed by clearing site data,
  using incognito, or switching browsers.
- **Streak + Perfect medals**: 7/30/100-day consecutive play medals plus a
  single-game perfect medal.
- **Daily Sweep + Flawless Victory** bonus XP (+200 / +400) + achievements.
- **Player-local daily reset**: daily puzzles rotate at each user's local
  midnight (was UTC). Matches NYT Wordle.
- **bfcache / day-rollover reload**: root-level handler forces a reload
  when a frozen iOS Safari tab resumes on a new day, so stale state
  can't persist across midnight.
- **Site-wide LIVE player count**: real-time home-screen banner showing
  everyone on the site, deduped per-user (no double counting across
  tabs, matches, or devices).
- **ProperNoundle URL-driven mode**: dropped the in-page Daily/Practice
  switcher in favour of URL-driven mode (`?daily=true`), matching every
  other puzzle's pattern.
- **Pro home Daily/Unlimited toggle**: Pro users can flip the whole home
  screen into Unlimited mode. Both heroes are now pixel-matched so cards
  below don't shift on toggle.
- **In-game Home button** in every solo game header so players can always
  exit mid-game (BottomNav is hidden during play).
- **Gauntlet correctness**: victory popup shows final-stage time (not
  total), stage timers use active-play clock (not wall-clock), return
  flow preserved.
- **Duplicate-guess rejection** enforced across every solo and VS mode,
  client + server.
- **LIVE multi-board win credit**: reducer now credits same-submission
  winning guesses on multi-board modes (Rescue / Quordle / Octordle /
  Sequence / Gauntlet) that would previously have been silently dropped.

---

## 14. Competitive Landscape

| Competitor | What They Do | Our Differentiator |
|---|---|---|
| Wordle (NYT) | Single daily puzzle, no modes, no accounts | 7 modes, progression, multiplayer |
| Quordle | 4-board daily, basic sharing | We have 4-board + 6 other modes + VS + medals |
| Octordle | 8-board daily | We have OctoWord plus the full progression system |
| Wordle Unlimited | Unlimited random puzzles | We add competition, daily shared seeds, social |
| Squabble | Multiplayer Wordle battle royale | More mode variety + solo + daily |
| NYT Spelling Bee | Different mechanic (letter-finding) | Different game type entirely |

**Core positioning**: The only platform that combines Wordle-style puzzles
with competitive gaming infrastructure (leaderboards, medals, achievements,
VS, XP, streak shields). Casual enough for the daily puzzle crowd, deep
enough for the competitive grind.

---

## 15. Business Context

- **Revenue streams**: Pro subscriptions (3 tiers: Day Pass / Monthly /
  Yearly) + ad revenue (free tier).
- **Conversion funnel**: Free play → hit mode limit → Pro upsell modal →
  `/pro` page → subscribe (Day Pass as low-friction entry).
- **Day Pass role**: $1 impulse buy for players who hit the limit but
  aren't ready to commit monthly; naturally funnels into Monthly after
  7+ uses (since 7 × $1 > $6.99).
- **Ad model**: Google AdSense interstitials for free users; Pro removes
  all ads.
- **Payment status**: DemoProvider active (instant fulfillment for
  testing); Stripe scaffolding in place, columns provisioned on profiles,
  one-file swap to enable real charges.
- **Replay data**: Full game state stored for every match — supports
  future features like Play of the Day, spectating, coaching, anti-cheat.
- **Native readiness**: Capacitor 8.3 configured for iOS/Android store
  submission; RevenueCat-ready via the PaymentProvider interface.

---

## 16. Roadmap (designed, not yet shipped)

- **Stripe live**: swap `DemoProvider` for `StripeProvider`, enable real
  charges. Webhook plumbing pending.
- **Native app store launches**: Capacitor config already wired, awaiting
  store submission + RevenueCat integration for IAP.
- **Seasonal rankings**: monthly leaderboard seasons with end-of-season
  badges.
- **Progression unlocks**: profile borders/frames at level milestones.
- **Titles**: earned labels like "Daily Warrior", "Speed Demon".
- **Play of the Day replay**: watch the #1 solver's game step-by-step.
- **Welcome back bonus**: 2× XP for returning after 3+ days away.
- **Escalating streak rewards**: Day 1 = 10 XP, Day 7 = 100 XP.
- **Extended streak shield earning**: earn through consecutive play, not
  just billing.

---

## 17. Key Numbers & Metrics Tracked

Per-user, per-match, per-day data captured for every play:

- Match: mode, seed, solutions, guesses (full word list), boards solved,
  time, win/loss, composite score, opponent data if VS.
- Daily: per-mode result row, composite score, medals awarded, bonus XP.
- Profile: XP, level, total wins, total losses, current streak, best
  streak, daily login streak, best daily login streak, medal counts (gold,
  silver, bronze), streak shield balance, Pro status, Pro expiry, social
  links, role, ban state.
- Admin audit: every admin action with actor + target + reason.

This replay-level fidelity is the foundation for future features
(spectating, anti-cheat, coaching, Play of the Day) and for monetization
analytics (cohort retention, conversion trigger points, Pro LTV).

---

## 18. Contact & Links

- **Live site**: https://wordocious.com
- **Inspector (Vercel prod)**: https://vercel.com/bterchin-1609s-projects/spellstrike
- **Supabase project**: `eniiqqsxpmuyrspvepiw`
- **Source (GitHub)**: https://github.com/BTBTBTBTBTBTBT/WordRush
- **Support**: support@wordocious.com
- **Privacy**: privacy@wordocious.com
- **Legal**: legal@wordocious.com
