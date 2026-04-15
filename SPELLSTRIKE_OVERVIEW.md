# SpellStrike - Product Overview

**Live URL**: https://spellstrike.vercel.app
**Status**: Fully deployed and operational (as of April 2026)

SpellStrike is a competitive word puzzle platform featuring 6 distinct game modes, real-time multiplayer VS battles, daily challenges with leaderboards, a medal/achievement system, and comprehensive player progression. Think Wordle meets competitive gaming — built for retention, social competition, and daily engagement.

---

## Tech Stack & Architecture

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 13.5 (App Router), React 18, Tailwind CSS, Framer Motion |
| **UI Components** | Radix UI (headless), Lucide icons, Recharts (stats visualization) |
| **Real-time Multiplayer** | Socket.IO (client + dedicated server) |
| **Database** | Supabase (managed PostgreSQL) with Row Level Security |
| **Auth** | Supabase Auth — Google OAuth + email/password |
| **Game Engine** | `@wordle-duel/core` — shared package for dictionary, seed generation, tile evaluation, scoring |
| **Monorepo** | pnpm workspaces (`apps/web`, `apps/server`, `packages/core`) |

### Deployment Topology

| Service | Host | URL |
|---------|------|-----|
| Web App (Next.js) | Vercel | spellstrike.vercel.app |
| VS Server (Socket.IO) | Railway | wordrush-production.up.railway.app |
| Database + Auth | Supabase | eniiqqsxpmuyrspvepiw.supabase.co |

---

## Game Modes (6 Total)

Every mode supports **Solo**, **VS** (real-time multiplayer), and **Daily** (same puzzle for all players).

| Mode | Route | Mechanics |
|------|-------|-----------|
| **Classic** | `/practice` | Single 5-letter word, 6 guesses. The core Wordle experience. |
| **QuadWord** | `/quordle` | 4 simultaneous puzzles, 9 shared guesses across all boards. |
| **OctoWord** | `/octordle` | 8 simultaneous puzzles, 13 shared guesses. Highest difficulty. |
| **Succession** | `/sequence` | 4 sequential puzzles, 10 total guesses. Complete one before moving to the next. |
| **Deliverance** | `/rescue` | 4 puzzles with pre-filled clue guesses. Decode the hints and solve. |
| **The Gauntlet** | `/gauntlet` | 5-stage escalating challenge: Classic (1 board) → QuadWord (4) → Succession (4) → Deliverance (4) → OctoWord (8). 21 total boards, 50 guesses. |

---

## Multiplayer VS System

Real-time WebSocket-based matchmaking and gameplay:

- **Matchmaking queue** per game mode — server pairs players automatically
- **3-second synchronized countdown** before match start
- **Live opponent progress** streamed in real-time (attempts, boards solved, stage)
- **Winner determination**: boards solved → fewest guesses → fastest time
- **Rematch system**: both players can offer/accept rematches instantly
- **Disconnect handling**: opponent gets notified, match cleaned up

---

## User System

### Authentication
- **Google OAuth** (one-click sign-in, auto-creates profile from Google metadata)
- **Email/password** (with username selection)

### Player Profile
- Username, avatar (from Google or custom)
- Level & XP progression (displayed on home page and profile)
- Lifetime stats: total wins, losses, current streak, best streak
- Medal counters: gold, silver, bronze
- Per-mode stats: wins, losses, best score, average time, fastest time
- Match history with full replay data

### XP & Leveling
- Win: **100 XP** + 50 XP streak bonus (if streak > 1)
- Loss: **25 XP**
- Level = floor(XP / 1000) + 1
- Visible progression creates engagement loop

---

## Daily Challenge System

### How It Works
- **Deterministic seeds**: `generateDailySeed(date, gameMode)` ensures every player gets the same puzzle
- **Seed format**: `daily-YYYY-MM-DD-GAMEMODE`
- Available for all 6 modes — each mode has its own daily puzzle
- **UTC midnight** resets the daily challenge with a countdown timer on the leaderboard

### Composite Scoring
Weighted formula balancing completion, speed, and guess efficiency:

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

**VS daily ranking**: `(wins * 100) + (win_rate * 50) + (games * 5)`, minimum 3 games to qualify.

### Leaderboard Page (`/daily`)
- Mode selector tabs (all 6 modes)
- Solo / VS toggle
- Top 50 players ranked by composite score
- Gold/silver/bronze medal icons on top 3
- Current user's row highlighted
- "Play Today's [Mode]" CTA if user hasn't played yet
- Collapsible "Yesterday's Winners" section
- Countdown timer to next daily reset

### Home Page Integration
- Featured "Daily Challenge" card above the game mode grid
- Each game mode card has Solo, VS, and **Daily** buttons
- Quick links to Leaderboard and Records pages

---

## Medals, Records & Achievements

### Medal System
- **Gold, Silver, Bronze** awarded to daily top-3 finishers per mode per play type
- Stored permanently in `medals` table
- Cumulative counters on player profile (gold_medals, silver_medals, bronze_medals)
- Recent medals displayed on profile page

### All-Time Records (`/records`)
Tracks record holders across 4 categories:

| Category | Records |
|----------|---------|
| **Speed** | Fastest win (per mode) |
| **Efficiency** | Fewest guesses (per mode) |
| **Endurance** | Most games played, longest streak, highest level |
| **Collection** | Most gold medals, most daily completions |

- Crown icon on records held by the current user
- Auto-updated after every game result

### Achievements (13 Total)

| Category | Achievement | Trigger |
|----------|-------------|---------|
| Beginner | First Win | Win any game |
| Beginner | All Modes Played | Play each of 6 modes |
| Beginner | Daily Debut | Complete first daily challenge |
| Consistency | 7-Day Warrior | Play 7 consecutive days |
| Consistency | 30-Day Streak | Play 30 consecutive days |
| Skill | Speed Demon | Classic solve under 30 seconds |
| Skill | Perfectionist | Win in 1 guess |
| Skill | Gauntlet Master | Complete entire Gauntlet |
| Social | VS Veteran | Win 10 VS matches |
| Social | Unstoppable | 5-win VS streak |
| Collection | Medal Collector | Earn 10/50/100 medals |
| Collection | Golden Touch | Earn 10 gold medals |

- Displayed as badge grid on profile (locked = greyed out, unlocked = colored with date)
- Checked automatically after every game (fire-and-forget, non-blocking)

---

## Retention & Engagement Features

### Daily Login Streak
- Tracked via `last_played_at` and `daily_login_streak` on profile
- Consecutive day detection (UTC-based)
- Resets if a day is missed

### Win Streaks
- Current streak increments on wins, resets to 0 on losses
- Best streak tracked permanently
- Streak bonus XP (50 XP extra when streak > 1)

### Spoiler-Free Share Text
After completing a daily challenge, players can copy a share-friendly result:
```
SpellStrike Daily — Classic
2026-04-07
3/6 in 1:45

https://spellstrike.vercel.app/daily
```
- Multi-board modes include "X/Y boards" solved
- Drives organic social sharing and FOMO

### Visual Polish
- Framer Motion animations throughout (tile flips, victory overlays, confetti)
- Gradient glassmorphism UI (purple/pink/orange theme)
- Staggered card entrance animations on home page
- Victory animation with rotating trophy, orbiting stars, and confetti particles

---

## Database Schema (7 Tables)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **profiles** | User identity & progression | username, avatar, level, xp, wins, losses, streaks, medal counters, login streak |
| **user_stats** | Per-mode per-play-type stats | game_mode, play_type, wins, losses, best_score, fastest_time |
| **matches** | Full game history | players, scores, times, seed, solutions, guesses (JSON) |
| **daily_seeds** | Deterministic daily puzzles | day, game_mode, seed, solutions |
| **daily_results** | Player daily performance | composite_score, guess_count, time, boards_solved (leaderboard data) |
| **medals** | Daily top-3 awards | medal_type (gold/silver/bronze), composite_score |
| **all_time_records** | Record holders | record_type, holder, record_value |
| **achievements** | Unlocked badges | achievement_key, unlocked_at |

All tables have Row Level Security (RLS) policies. Leaderboard data is publicly readable; write access restricted to the owning user.

---

## What's Already Built That Supports Monetization

### Engagement Hooks Already In Place
1. **Daily challenges** — built-in reason to return every day across 6 modes
2. **Leaderboards** — competitive ranking drives repeat play
3. **Medal system** — collectible prestige items (gold/silver/bronze)
4. **Achievement badges** — 13 unlockable badges across 5 categories
5. **XP & leveling** — visible progression system
6. **Win/login streaks** — loss aversion keeps players coming back
7. **Social sharing** — spoiler-free share text for organic virality
8. **Match history** — full game replay data stored for every match
9. **All-time records** — hall of fame creates aspirational targets
10. **Real-time VS** — multiplayer infrastructure ready for competitive features

### Infrastructure Ready For
- **User accounts & profiles** — identity system fully built (Google OAuth + email)
- **Per-mode granular stats** — can gate premium stats/analytics behind paywall
- **Cosmetic system hooks** — profile already has avatar, level, medals, badges
- **Tournament infrastructure** — VS matchmaking + scoring + match history all in place
- **Seasonal competition** — daily_results table supports monthly aggregation

### Unbuilt Features Designed In The Plan (Ready to Implement)
- **Streak shields** — earn shields through consecutive play, auto-protect missed days
- **Seasonal rankings** — monthly leaderboard seasons with end-of-season badges
- **Progression unlocks** — profile borders/frames at level milestones
- **Titles** — "Daily Warrior", "Speed Demon" etc. earned through play
- **Play of the Day replay** — watch the #1 solver's game step-by-step
- **Welcome back bonus** — 2x XP for returning after 3+ days away
- **Escalating streak rewards** — Day 1 = 10 XP, Day 7 = 100 XP
