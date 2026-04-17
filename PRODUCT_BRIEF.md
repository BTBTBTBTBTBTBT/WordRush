# Product Brief — Competitive Word Puzzle Platform

> This document captures every dimension of the product — what it is, how it
> works, who it's for, and where the money comes from. Use it as the single
> source of truth when brainstorming a new brand name, evaluating positioning,
> or briefing anyone who needs to understand the product cold.

**Current working name**: SpellStrike (must change — trademarked)
**Internal monorepo name**: `wordle-duel` / `@wordle-duel/core`
**Live URL**: https://spellstrike.vercel.app
**Status**: Fully deployed, all features operational (April 2026)

---

## 1. What It Is (Elevator Pitch)

A competitive word puzzle platform with 7 game modes, real-time multiplayer
VS battles, daily challenges with global leaderboards, and deep player
progression. The core loop is Wordle-style 5-letter word guessing, but the
modes escalate in complexity from a single board all the way to a 21-board
Gauntlet. Players come back daily for the shared challenge, climb the
leaderboard, earn medals, and compete head-to-head in real time.

**Think**: Wordle meets competitive gaming — built for retention, social
competition, and daily engagement.

---

## 2. Target Audience

| Segment | Motivation | Engagement Pattern |
|---------|-----------|-------------------|
| **Casual word gamers** | Daily puzzle fix, low commitment | 1 daily challenge, done in 2 minutes |
| **Competitive puzzlers** | Leaderboard rank, speed optimization | Multiple modes daily, grinds composite score |
| **Social competitors** | Beat friends, bragging rights | VS matches, share results on socials |
| **Completionists** | Collect all badges, hit every record | Chases achievements, medals, all-time records |
| **Mobile-first players** | Quick session on commute/break | PWA + Capacitor native wrapper ready |

**Age range**: 16–45 (word puzzle skews older than average mobile game)
**Platform**: Web-first (responsive PWA), Capacitor config ready for iOS/Android native wrappers

---

## 3. Game Modes (7 Total)

Every mode supports **Solo** (random seed), **Daily** (same puzzle for all
players, resets at UTC midnight), and **VS** (real-time PvP via WebSocket).

| # | Mode Name | Route | Mechanics | Difficulty |
|---|-----------|-------|-----------|------------|
| 1 | **Classic** | `/practice` | 1 word, 6 guesses. The core Wordle experience. | Easy |
| 2 | **QuadWord** | `/quordle` | 4 simultaneous boards, 9 shared guesses. | Medium |
| 3 | **OctoWord** | `/octordle` | 8 simultaneous boards, 13 shared guesses. | Hard |
| 4 | **Succession** | `/sequence` | 4 boards solved sequentially, 10 total guesses. Complete one to unlock the next. | Medium |
| 5 | **Deliverance** | `/rescue` | 4 boards with pre-filled clue guesses. Decode the hints and solve. | Medium |
| 6 | **The Gauntlet** | `/gauntlet` | 5-stage escalating marathon: Classic (1) -> QuadWord (4) -> Succession (4) -> Deliverance (4) -> OctoWord (8). 21 total boards, 50 guesses. | Expert |
| 7 | **ProperNoundle** | `/propernoundle` | Guess famous proper nouns (names, places, brands). Variable-length multi-word answers. 7 categories: Music, Video Games, Movies, Sports, History, Science, Current Events. Includes Wikipedia image hints. | Medium |

**Mode identity colors** (used throughout UI):
- Classic: `#7c3aed` (purple)
- QuadWord: `#ec4899` (pink)
- OctoWord: `#7e22ce` (deep purple)
- Succession: `#2563eb` (blue)
- Deliverance: `#059669` (green)
- Gauntlet: `#d97706` (amber)
- ProperNoundle: `#dc2626` (red)

---

## 4. Monetization Model

### Freemium Structure

| Feature | Free | Pro |
|---------|------|-----|
| Game modes | All 7 | All 7 |
| Daily plays per mode | 1 | Unlimited |
| VS battles | 1 daily match (shared puzzle) | Unlimited (random + daily) |
| Ads (interstitial before game) | Yes | None |
| Stats dashboard | Basic | Extended (win rate trends, per-mode speed charts) |
| Streak shields | None | 4 credited per billing period |
| Pro badge on profile | No | Yes |
| Early access to new modes | No | Yes |

### Pro Pricing (3 tiers)

| Plan | Price | Per-day cost | Streak Shields |
|------|-------|-------------|---------------|
| **Day Pass** | $1.00 / 24 hours | $1.00 | None |
| **Monthly** | $6.99 / month | $0.23 | 4 per period |
| **Yearly** | $59.99 / year | $0.16 | 4 per period |

Day pass exists as a low-friction impulse buy. 7 day passes cost more than
a month — the pricing naturally funnels repeat day-pass buyers into monthly.

Day pass **stacks** on active Pro: buying mid-subscription adds 24h to the
existing expiry rather than resetting it.

### Coin Economy

Coins are a virtual currency for purchasing cosmetics:

| Pack | Coins | Price | Per-coin |
|------|-------|-------|----------|
| Starter | 100 | $0.99 | $0.0099 |
| Popular | 550 | $4.99 | $0.0091 |
| Premium | 1,300 | $9.99 | $0.0077 |

### Cosmetics (Coin Purchases)

| Category | Items | Price Range |
|----------|-------|-------------|
| **Tile Themes** | Neon Glow, Pastel Dream, Golden Hour | 150-300 coins / $1.49-$2.99 |
| **Keyboard Skins** | Galaxy, Wooden Keys | 200-250 coins / $1.99-$2.49 |
| **Victory Animations** | Fireworks, Rainbow Wave | 300-350 coins / $2.99-$3.49 |

### Ad Revenue

- Google AdSense integration (`ca-pub-3015627373086578`)
- Interstitial ad gate shown before each game for free users only
- Countdown timer before "Continue" button appears
- Pro users skip ads entirely

---

## 5. Player System

### Authentication
- **Google OAuth** — one-click, auto-creates profile from Google metadata
- **Email + password** — with username selection on first sign-in

### Player Profile (`/profile`)
- Custom username (editable) + avatar (Google-sourced or uploaded)
- Level & XP bar with progress indicator
- Lifetime stats: wins, losses, win rate, current streak, best streak
- Medal display: gold/silver/bronze counts + recent medal history
- Achievement badge grid (locked = greyed, unlocked = colored with date)
- Per-mode extended stats (Pro feature): win rate chart, average solve time chart
- Match history with full replay data

### XP & Leveling
| Action | XP |
|--------|-----|
| Win | 100 |
| Loss | 25 |
| Streak bonus (streak > 1) | +50 |
| Daily bonus | +50 |
| Medal bonuses | Varies |

**Level formula**: `floor(XP / 1000) + 1`

### Streaks
- **Daily login streak**: consecutive days played (UTC-based), resets on miss
- **Win streak**: consecutive wins, resets on loss
- **Best streak**: permanently tracked high watermark
- **Streak shields** (Pro): auto-protect a missed day without breaking streak

---

## 6. Daily Challenge System

### Core Mechanics
- **Deterministic seeds**: `generateDailySeed(date, gameMode)` ensures every
  player worldwide gets the same puzzle on the same day
- **Seed format**: `daily-YYYY-MM-DD-GAMEMODE`
- All 7 modes have independent daily puzzles
- **UTC midnight reset** with visible countdown timer

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
|------|------------|-------------|----------|
| Classic | 6 | 100 | 300s |
| QuadWord | 9 | 50 | 600s |
| OctoWord | 13 | 30 | 900s |
| Succession | 10 | 60 | 480s |
| Deliverance | 6 | 80 | 480s |
| Gauntlet | 44 | 20 | 1800s |

### Leaderboard (`/daily`)
- Mode selector tabs across all 7 modes
- Top 50 players ranked by composite score
- Gold/silver/bronze medal icons for top 3
- Current user's row highlighted with rank callout
- Completed puzzle preview below the CTA
- Collapsible "Yesterday's Winners" section
- Countdown to next daily reset

### Spoiler-Free Social Sharing
Players can copy a shareable result:
```
[APP NAME] Daily — Classic
2026-04-07
3/6 in 1:45

https://[domain]/daily
```
Multi-board modes include boards-solved ratio.

---

## 7. Multiplayer VS System

Real-time WebSocket-based competitive play:

- **Matchmaking queue** per game mode — server pairs players automatically
- **3-second synchronized countdown** before match start
- **Live opponent progress** streamed in real-time (attempts, boards solved, stage)
- **Winner determination**: boards solved -> fewest guesses -> fastest time
- **Rematch system**: both players can offer/accept rematches instantly
- **Disconnect handling**: opponent notified, match cleaned up
- **Freemium gating**: free users get 1 daily VS match (shared daily seed); Pro users get unlimited random-seed matches

---

## 8. Medals, Records & Achievements

### Medals
- **Gold, Silver, Bronze** awarded to daily top-3 finishers per mode
- Permanently stored; cumulative counts displayed on profile
- Recent medals shown in profile medal history

### All-Time Records (`/records`)
| Category | Records |
|----------|---------|
| **Speed** | Fastest win per mode |
| **Efficiency** | Fewest guesses per mode |
| **Endurance** | Most games played, longest streak, highest level |
| **Collection** | Most gold medals, most daily completions |

Crown icon on records held by the viewing user.

### Achievements (12 Badges)
| Category | Badge | Trigger |
|----------|-------|---------|
| Beginner | First Win | Win any game |
| Beginner | All Modes Played | Play each of 6 modes |
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

Badge grid on profile: locked = greyed out, unlocked = colored with earned date.

---

## 9. Visual Identity & Design Language

| Element | Details |
|---------|---------|
| **Font** | Nunito (weights 700, 800, 900) — round, friendly, bold |
| **Background** | `#f8f7ff` (very light lavender) |
| **Primary purple** | `#7c3aed` |
| **Brand gradient** | `linear-gradient(135deg, #a78bfa, #ec4899)` (purple to pink) |
| **Accent gold/amber** | `#d97706` / `#f59e0b` (CTAs, Pro, medals) |
| **Card style** | White cards with `1.5px solid #ede9f6` borders, `16px` border-radius |
| **Buttons** | 3D effect with bottom shadow (`btn-3d` class), gradient backgrounds |
| **Section headers** | ALL CAPS, `10px` font, extrabold, `#9ca3af` gray, wide tracking |
| **Animations** | Framer Motion throughout: tile flips, staggered card entrances, victory confetti, rotating trophy with orbiting stars |
| **Theme** | "Gradient glassmorphism" — purple/pink/orange warmth, playful but polished |

**Overall vibe**: Mobile-game energy with web-game accessibility. Playful, bold, competitive — not serious/corporate. Feels like opening an arcade, not a test.

---

## 10. Technical Architecture

### Stack
| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 13.5 (App Router), React 18 |
| **Styling** | Tailwind CSS (inline styles for brand colors), Framer Motion |
| **UI primitives** | Radix UI (headless), Lucide icons |
| **Charts** | Recharts (stats visualization) |
| **Multiplayer** | Socket.IO (dedicated server) |
| **Database** | Supabase (managed PostgreSQL, Row Level Security) |
| **Auth** | Supabase Auth (Google OAuth + email/password) |
| **Payments** | PaymentProvider interface (currently DemoProvider; Stripe-ready) |
| **Game engine** | `@wordle-duel/core` shared package (dictionary, seeds, tile eval, scoring) |
| **Monorepo** | pnpm workspaces: `apps/web`, `apps/server`, `packages/core` |
| **Native** | Capacitor 8.3 config for iOS/Android wrappers |
| **Ads** | Google AdSense |

### Deployment
| Service | Host | URL |
|---------|------|-----|
| Web app (Next.js) | Vercel | spellstrike.vercel.app |
| VS server (Socket.IO) | Railway | wordrush-production.up.railway.app |
| Database + Auth | Supabase | eniiqqsxpmuyrspvepiw.supabase.co |

Auto-deploys: Vercel and Railway both deploy on push to `main`.

### Database Schema (8 Tables)
| Table | Purpose |
|-------|---------|
| `profiles` | User identity, XP, level, wins/losses, streaks, medal counts, Pro status |
| `user_stats` | Per-mode per-play-type granular stats |
| `matches` | Full game history with replay data (guesses JSON) |
| `daily_seeds` | Deterministic daily puzzle storage |
| `daily_results` | Composite scores for daily leaderboards |
| `medals` | Gold/silver/bronze awards |
| `all_time_records` | Record holders per category |
| `achievements` | Unlocked badge tracking |

All tables use Row Level Security. Leaderboard data is publicly readable;
write access restricted to the owning user.

---

## 11. Retention Mechanics Summary

| Mechanic | How It Works | Psychological Hook |
|----------|-------------|-------------------|
| Daily challenges | New puzzle every UTC midnight, 7 modes | Appointment mechanic, FOMO |
| Countdown timer | Visible on home + leaderboard | Urgency, anticipation |
| Login streak | Consecutive day counter, resets on miss | Loss aversion |
| Win streak | Resets on loss, best streak tracked | Momentum, fear of breaking |
| Streak shields (Pro) | Protect missed days | Safety net drives Pro conversion |
| Leaderboard rank | Top 50 + personal rank callout | Social comparison |
| Medal collection | Gold/silver/bronze permanence | Collectibility |
| Achievement badges | 12 unlockable across 5 categories | Completionism |
| All-time records | Hall of fame with crown icons | Aspirational targets |
| XP & levels | Visible number that always goes up | Progress illusion |
| Social sharing | Spoiler-free copy text | Organic virality, bragging |
| Pro upsell modals | Shown when free plays exhausted | Friction-at-peak-intent conversion |
| Word of the Day | Dictionary entry on home page | Daily educational hook |

---

## 12. Current Brand Touchpoints

Every place the name "SpellStrike" currently appears (all must change with rebrand):

| Location | File(s) |
|----------|---------|
| Page title / meta tags | `app/layout.tsx` (title, OG, Twitter, siteName, appleWebApp) |
| Metadata base URL | `app/layout.tsx` (metadataBase) |
| Open Graph image renderer | `lib/og-image-renderer.tsx`, `app/api/og/route.tsx` |
| Manifest (PWA) | `public/manifest.json` (name, short_name) |
| Capacitor config (native) | `capacitor.config.ts` (appId, appName, scheme) |
| Robots / sitemap | `public/robots.txt` |
| Offline fallback page | `public/offline.html` |
| Share text (daily results) | `lib/daily-service.ts`, `lib/share-utils.ts` |
| localStorage keys | `lib/play-limit-service.ts`, `hooks/use-game-snapshot.ts` |
| Terms of Service page | `app/terms/page.tsx` (multiple references + legal@spellstrike.com) |
| Support page | `app/support/page.tsx` (support@spellstrike.com) |
| Privacy policy | `app/privacy/page.tsx` (privacy@spellstrike.com) |
| OG image generation scripts | `scripts/generate-og-image.mjs`, `scripts/generate-icons.mjs` |

**Internal package names** that DON'T face users:
- `wordle-duel-monorepo` (root package.json)
- `@wordle-duel/core`, `@wordle-duel/web`, `@wordle-duel/server`

---

## 13. Planned Features (Roadmap — Designed but Unbuilt)

- **Streak shields (extended)**: earn through consecutive play, not just billing
- **Seasonal rankings**: monthly leaderboard seasons with end-of-season badges
- **Progression unlocks**: profile borders/frames at level milestones
- **Titles**: earned labels like "Daily Warrior", "Speed Demon"
- **Play of the Day replay**: watch the #1 solver's game step-by-step
- **Welcome back bonus**: 2x XP for returning after 3+ days away
- **Escalating streak rewards**: Day 1 = 10 XP, Day 7 = 100 XP
- **Stripe integration**: real payment processing (PaymentProvider swap)
- **Native app store launches**: Capacitor config already wired

---

## 14. Competitive Landscape

| Competitor | What They Do | Our Differentiator |
|-----------|-------------|-------------------|
| **Wordle** (NYT) | Single daily puzzle, no modes, no accounts | 7 modes, progression, multiplayer |
| **Quordle** | 4-board daily, basic sharing | We have 4-board + 6 other modes, VS, medals |
| **Octordle** | 8-board daily | We have OctoWord + the full progression system |
| **Wordle Unlimited** | Unlimited random puzzles | We add competition, daily shared seeds, social |
| **Squabble** | Multiplayer Wordle battle royale | We offer more mode variety + solo + daily |
| **Spelling Bee** (NYT) | Different mechanic (letter-finding) | Different game type entirely |

**Core positioning**: The only platform that combines Wordle-style puzzles
with competitive gaming infrastructure (leaderboards, medals, achievements,
VS, XP). Casual enough for the daily puzzle crowd, deep enough for the
competitive grind.

---

## 15. Business Context

- **Revenue streams**: Pro subscriptions (3 tiers), coin packs, cosmetic purchases, ad revenue (free tier)
- **Conversion funnel**: Free play -> hit mode limit -> Pro upsell modal -> /pro page -> subscribe
- **Day pass role**: Low-friction $1 impulse buy for players who hit the limit but aren't ready to commit monthly; naturally funnels into monthly after 7+ uses
- **Ad model**: Google AdSense interstitials for free users; Pro removes all ads
- **Payment status**: DemoProvider active (instant fulfillment for testing); Stripe integration TODO
- **User data**: Full game replay data stored for every match — supports future features like Play of the Day, spectating, coaching
- **Native readiness**: Capacitor 8.3 configured for iOS/Android store submission

---

## 16. What the Name Needs to Convey

Based on everything above, a successful name should evoke some combination of:

- **Words / letters / spelling** (it's a word puzzle game)
- **Competition / speed / battle** (it's competitive, not contemplative)
- **Daily ritual** (the daily challenge is the primary retention hook)
- **Energy / excitement** (the UI is bold, colorful, arcade-like)
- **Accessibility** (not intimidating — casual players are the on-ramp)

The name needs to work as:
- A web domain (`.com` or `.gg` or similar)
- An app store listing
- A social media handle
- A shareable word in conversation ("I play ___")
- A verb possibility is a bonus ("I ___'d today" or "Did you ___?")
