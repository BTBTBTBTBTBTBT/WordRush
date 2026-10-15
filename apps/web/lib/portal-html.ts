// ─────────────────────────────────────────────────────────────────────────
// The Wordocious engineering portal — "everything someone would need to know
// about how Wordocious is built and works" (requested by Jasson, 2026-08-01).
//
// SINGLE SOURCE. Two consumers:
//   1. /admin/portal renders this in an iframe (admin-gated by middleware.ts;
//      /portal redirects there via next.config.js).
//   2. scripts/gen-portal-html.mjs extracts the HTML into WORDOCIOUS_PORTAL.html
//      at the repo root — the standalone copy that survives the site being down.
//      Regenerate after editing: node scripts/gen-portal-html.mjs
//      (apps/web/scripts/portal-sync.test.ts fails the build if you forget.)
//
// Deliberately self-contained: inline CSS only, no scripts, prints cleanly. The
// only requests are same-origin images shipped in apps/web/public (the cast and
// title art, absolute /paths), which fall back to nothing in the standalone copy.
// NO SECRETS — names of services and where keys LIVE, never values.
// Update the "as of" date when facts change.
//
// Look (refreshed 2026-10-15 to the app's current aesthetic): calm lilac/plum page,
// purple/gold/gray glossy tiles with no rim, hairline rows instead of bordered
// boxes, the cast and title art as small accents, centered and symmetric.
//
// The literal below must not contain backticks or ${ sequences.
// ─────────────────────────────────────────────────────────────────────────

export const PORTAL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>Wordocious — Engineering Portal</title>
<style>
  :root {
    --bg: #f8f7ff; --surface: #ffffff; --tint: #f1eafc; --tint2: #f5eeff; --line: #ece4f8;
    --text: #1a1a2e; --muted: #6b7280; --purple: #7c3aed; --purple-d: #4c1d95; --gold: #f59e0b;
    --gray: #64748b; --code: #efe7fb; --note: #fffbeb; --note-ink: #78350f; --wash: rgba(167, 139, 250, .22);
    --shadow: 0 1px 2px rgba(76, 29, 149, .06), 0 8px 22px rgba(76, 29, 149, .06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1a1a2e; --surface: #252542; --tint: #2a2a48; --tint2: #30305a; --line: #34345a;
      --text: #f0eef6; --muted: #a9a9c2; --purple: #a78bfa; --purple-d: #c4b5fd; --gold: #fbbf24;
      --gray: #94a3b8; --code: #343460; --note: #3a2a12; --note-ink: #fde68a; --wash: rgba(124, 58, 237, .28);
      --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 8px 22px rgba(0, 0, 0, .25);
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background: var(--bg) radial-gradient(900px 380px at 50% -140px, var(--wash), transparent) no-repeat;
    color: var(--text);
    font: 15px/1.65 ui-rounded, "SF Pro Rounded", Nunito, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 0 0 72px; -webkit-text-size-adjust: 100%;
  }
  .wrap { max-width: 860px; margin: 0 auto; padding: 28px 20px 0; }
  img { display: block; max-width: 100%; }

  /* header: centered, symmetric */
  .hero { text-align: center; padding: 6px 0 4px; }
  .hero .cast { width: min(520px, 100%); height: auto; margin: 0 auto 6px; }
  h1 {
    font-size: clamp(27px, 6.4vw, 42px); line-height: 1.1; font-weight: 900; letter-spacing: .03em; text-transform: uppercase;
    background: linear-gradient(180deg, #c4a2fb 0%, #9b5cf6 48%, #6d28d9 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 0 rgba(76, 29, 149, .55)) drop-shadow(0 6px 10px rgba(124, 58, 237, .25));
    margin: 10px 0 8px;
  }
  .sub { color: var(--muted); font-weight: 700; font-size: 13px; max-width: 560px; margin: 0 auto 22px; }

  /* table of contents: calm tiles */
  .toc { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin: 0 0 8px; }
  .toc a { display: flex; align-items: center; gap: 10px; background: var(--tint); color: var(--text); text-decoration: none; font-size: 13.5px; font-weight: 800; padding: 8px 12px; border-radius: 12px; min-height: 40px; }
  .toc a:hover { background: var(--tint2); }
  .toc b { flex: none; width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; font-size: 12px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #a78bfa, #7c3aed 65%, #6d28d9); box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, .35), 0 2px 5px rgba(76, 29, 149, .25); }

  /* sections */
  h2 { display: flex; align-items: center; gap: 10px; font-size: 18px; line-height: 1.25; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; margin: 46px 0 14px; scroll-margin-top: 14px; }
  h2 .num { flex: none; width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; font-size: 15px; letter-spacing: 0; color: #fff; background: linear-gradient(180deg, #b79bfb, #7c3aed 62%, #6d28d9); box-shadow: inset 0 2px 0 rgba(255, 255, 255, .38), 0 3px 8px rgba(76, 29, 149, .28); }
  h2 .t { flex: 1; min-width: 0; }
  h2 .mx { flex: none; width: 34px; height: 34px; margin-left: auto; opacity: .95; }
  h3 { font-size: 13px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; color: var(--purple); margin: 20px 0 6px; }
  p { margin: 0 0 10px; }
  ul { margin: 0 0 12px 20px; }
  li { margin-bottom: 5px; padding-left: 2px; }
  li::marker { color: var(--purple); }
  strong { font-weight: 800; }
  code { background: var(--code); border-radius: 6px; padding: 1px 6px; font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
  .muted { color: var(--muted); font-size: 13px; }

  /* key / value rows: hairlines only, no boxes */
  .rows { margin: 8px 0 16px; }
  .rows > div { display: grid; grid-template-columns: minmax(110px, 190px) 1fr; gap: 3px 18px; padding: 10px 2px; border-bottom: 1px solid var(--line); }
  .rows > div:last-child { border-bottom: 0; }
  .rows.c3 > div { grid-template-columns: minmax(110px, 170px) 1.25fr 1fr; }
  .rows .k { font-weight: 800; }
  .rows .v, .rows .w { min-width: 0; }
  .rows .w { color: var(--muted); font-size: 13.5px; }
  .rows .v p, .rows .v ul { margin-bottom: 4px; }
  .rows .v ul { margin-top: 2px; }

  /* glossy tile family: purple / gold / gray, no rim */
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0 6px; }
  .tiles.three { grid-template-columns: repeat(3, 1fr); }
  .tile { text-align: center; padding: 14px 10px 13px; border-radius: 18px; color: #fff; box-shadow: inset 0 2px 0 rgba(255, 255, 255, .32), inset 0 -10px 18px rgba(0, 0, 0, .10), 0 6px 16px rgba(76, 29, 149, .16); }
  .tile.p { background: linear-gradient(180deg, #a78bfa 0%, #7c3aed 58%, #6d28d9 100%); }
  .tile.g { background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 62%, #e08e07 100%); color: #3b2300; box-shadow: inset 0 2px 0 rgba(255, 255, 255, .5), inset 0 -10px 18px rgba(0, 0, 0, .06), 0 6px 16px rgba(180, 100, 0, .18); }
  .tile.s { background: linear-gradient(180deg, #94a3b8 0%, #64748b 60%, #566377 100%); }
  .tile .l { font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; opacity: .92; }
  .tile .n { font-size: 20px; line-height: 1.2; font-weight: 900; margin: 3px 0 2px; overflow-wrap: anywhere; }
  .tile .d { font-size: 12.5px; font-weight: 700; line-height: 1.35; opacity: .95; }

  /* the game shelf: real shipped title art */
  .shelf { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px 16px; margin: 14px 0 12px; }
  .shelf img { height: 28px; width: auto; }
  .stack { text-align: center; color: var(--muted); font-size: 13px; font-weight: 600; max-width: 640px; margin: 8px auto 4px; }
  .cap { text-align: center; font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin: 18px 0 0; }

  .note { background: var(--note); color: var(--note-ink); border-radius: 14px; padding: 12px 16px; margin: 12px 0; font-size: 14px; }
  .note strong { color: inherit; }
  .foot { text-align: center; margin-top: 54px; }
  .cast-row { display: flex; justify-content: center; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
  .cast-row img { width: 38px; height: 38px; }

  @media (max-width: 720px) {
    .tiles { grid-template-columns: repeat(2, 1fr); }
    .rows > div, .rows.c3 > div { grid-template-columns: 1fr; }
    .rows .k { font-size: 14.5px; }
    h2 { font-size: 16.5px; margin-top: 38px; }
    h2 .mx { width: 30px; height: 30px; }
    .tile .n { font-size: 18px; }
  }
  @media (max-width: 420px) {
    .wrap { padding: 20px 16px 0; }
    .tiles.three { grid-template-columns: 1fr; }
    .toc { grid-template-columns: 1fr 1fr; gap: 6px; }
    .toc a { font-size: 12.5px; padding: 7px 8px; gap: 7px; }
    .shelf img { height: 22px; }
  }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  @media print {
    body { background: #fff; padding: 0; } h2 { break-after: avoid; }
    .rows > div, .tile, .note { break-inside: avoid; }
    .toc a { background: none; }
  }
</style>
</head>
<body>
<div class="wrap">

<header class="hero">
  <img class="cast" src="/og/og-cast.png" width="1000" height="136" alt="The WORDOCIOUS cast of ten letters">
  <h1>Engineering Portal</h1>
  <p class="sub">How Wordocious is built and works &middot; ShowLoud, LLC &middot; as of October 15, 2026 &middot; no secrets: services and key locations only</p>
</header>

<nav class="toc" aria-label="Contents">
  <a href="#overview"><b>1</b>Overview &amp; status</a>
  <a href="#games"><b>2</b>The 18 games &amp; more</a>
  <a href="#app"><b>3</b>The app: four tabs</a>
  <a href="#repo"><b>4</b>Repository map</a>
  <a href="#core"><b>5</b>The deterministic core</a>
  <a href="#words"><b>6</b>Word &amp; puzzle banks</a>
  <a href="#scoring"><b>7</b>Scoring</a>
  <a href="#backend"><b>8</b>Backend (Supabase)</a>
  <a href="#web"><b>9</b>Web app &amp; content APIs</a>
  <a href="#vs"><b>10</b>VS multiplayer &amp; bots</a>
  <a href="#payments"><b>11</b>Payments</a>
  <a href="#ads"><b>12</b>Ads, push, crashes</a>
  <a href="#referrals"><b>13</b>Gifts &amp; referrals</a>
  <a href="#seasons"><b>14</b>Seasons &amp; Halloween</a>
  <a href="#admin"><b>15</b>The admin portal</a>
  <a href="#studio"><b>16</b>Studio &amp; libraries</a>
  <a href="#release"><b>17</b>Release &amp; deploy</a>
  <a href="#ci"><b>18</b>CI, guards &amp; ops</a>
  <a href="#integrations"><b>19</b>Integrations</a>
  <a href="#secrets"><b>20</b>Secrets &amp; access</a>
  <a href="#conventions"><b>21</b>Conventions</a>
</nav>

<!-- 1 -->
<h2 id="overview"><span class="num">1</span><span class="t">Overview &amp; status</span><img class="mx" src="/mascots/w.png" alt="" width="34" height="34" loading="lazy"></h2>
<p><strong>Wordocious</strong> is a free daily puzzle app: <strong>18 daily games</strong>, one score and one streak across all of them, live head-to-head VS, six pocket games to play with friends, and a cast of ten letter characters. <strong>ShowLoud, LLC</strong> ships it on three clients that share one deterministic game engine. Every game has one shared daily puzzle worldwide; Pro adds unlimited extra puzzles.</p>

<div class="tiles">
  <div class="tile p"><div class="l">Web</div><div class="n">Live</div><div class="d">wordocious.com<br>deploys on push to main</div></div>
  <div class="tile g"><div class="l">iOS</div><div class="n">2.8.2 (259)</div><div class="d">live on the App Store<br>since Oct 14</div></div>
  <div class="tile s"><div class="l">Android</div><div class="n">2.8.2 (224)</div><div class="d">live in Play production<br>since Oct 13</div></div>
  <div class="tile p"><div class="l">VS server</div><div class="n">Live</div><div class="d">Railway<br>auto-deploys from main</div></div>
</div>

<p class="stack">Web: Next.js (App Router) on Vercel Pro &middot; iOS: SwiftUI + the <code>WordociousCore</code> Swift package, 13+ &middot; Android: Kotlin / Jetpack Compose + <code>:core</code>, portrait phones &middot; VS server: Node + socket.io (<code>apps/server</code>) on the same engine and word lists</p>

<h3>In flight &amp; parked</h3>
<ul>
  <li><strong>Tablet layouts</strong> are built but <strong>not shipped</strong>: slices 1 to 5 live on the branch <code>claude/tablet-layouts</code> (bottom tab bar kept, tab bar edge to edge, wide pages up to 1000 pt, every game filling the screen). Android tablets passed a perf pass; the iPad still needs a real-device fluidity test. Phones must stay unchanged.</li>
  <li><strong>Foldables</strong> are tabled: prep only, nothing built.</li>
  <li><strong>Halloween</strong> is live in the apps now (Oct 9 to Oct 31). The Thanksgiving kit and winter holidays are next (section 14).</li>
  <li><strong>JP&rsquo;s 45-day social plan</strong> (Oct 13 to Nov 29, launch Oct 16) is loaded into Social Studio (section 16).</li>
  <li><strong>Dated content cutover:</strong> the next answer-swap batch takes effect <strong>2026-11-16</strong> on all three clients (date-gated), so the store builds that carry it must be live first.</li>
</ul>

<!-- 2 -->
<h2 id="games"><span class="num">2</span><span class="t">The 18 games &amp; more</span><img class="mx" src="/mascots/c.png" alt="" width="34" height="34" loading="lazy"></h2>
<p>The catalog is data: <code>packages/core/modes.json</code> feeds generated code on web, iOS and Android and the SQL sweep-era functions, so the platforms cannot disagree about which games exist.</p>

<div class="cap">Eight word dailies</div>
<div class="shelf">
  <img src="/art/art-game-practice.webp" alt="Classic" loading="lazy" decoding="async">
  <img src="/art/art-game-six.webp" alt="Six" loading="lazy" decoding="async">
  <img src="/art/art-game-seven.webp" alt="Seven" loading="lazy" decoding="async">
  <img src="/art/art-game-quordle.webp" alt="QuadWord" loading="lazy" decoding="async">
  <img src="/art/art-game-octordle.webp" alt="OctoWord" loading="lazy" decoding="async">
  <img src="/art/art-game-sequence.webp" alt="Succession" loading="lazy" decoding="async">
  <img src="/art/art-game-rescue.webp" alt="Deliverance" loading="lazy" decoding="async">
  <img src="/art/art-game-gauntlet.webp" alt="Gauntlet" loading="lazy" decoding="async">
</div>
<div class="cap">Ten puzzles</div>
<div class="shelf">
  <img src="/art/art-game-propernoundle.webp" alt="ProperNoundle" loading="lazy" decoding="async">
  <img src="/art/art-game-sudoku.webp" alt="Sudocious" loading="lazy" decoding="async">
  <img src="/art/art-game-scramble.webp" alt="Muddle" loading="lazy" decoding="async">
  <img src="/art/art-game-hub.webp" alt="Hubbub" loading="lazy" decoding="async">
  <img src="/art/art-game-crossword.webp" alt="Crosswordocious" loading="lazy" decoding="async">
  <img src="/art/art-game-groups.webp" alt="Kindred" loading="lazy" decoding="async">
  <img src="/art/art-game-ladder.webp" alt="Letter Ladder" loading="lazy" decoding="async">
  <img src="/art/art-game-cryptogram.webp" alt="Codebreaker" loading="lazy" decoding="async">
  <img src="/art/art-game-wordsearch.webp" alt="Spyglass" loading="lazy" decoding="async">
  <img src="/art/art-game-regions.webp" alt="Starsweep" loading="lazy" decoding="async">
</div>

<div class="rows">
  <div><div class="k">Word dailies</div><div class="v">Classic, Six and Seven (5, 6 and 7 letters), QuadWord and OctoWord (4 and 8 boards at once), Succession, Deliverance, and the 5-stage Gauntlet that chains the modes.</div></div>
  <div><div class="k">Puzzles</div><div class="v">ProperNoundle (famous names), Sudocious (sudoku), Muddle (cartoon word scramble), Hubbub (letter hive), Crosswordocious, Kindred (group sorting), Letter Ladder, Codebreaker (cryptogram), Spyglass (word search), Starsweep (regions). Shipped as &ldquo;More Games&rdquo; and shown as the Puzzles section on Home.</div></div>
  <div><div class="k">Daily Sweep</div><div class="v">Finish every daily of the day for a sweep (a flawless day for a perfect one). The required set is a dated table (<code>sweepEras</code> in <code>modes.json</code>), never inferred from what players happened to record.</div></div>
  <div><div class="k">VS Battle</div><div class="v">Live and async head-to-head in nine modes (Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance, Gauntlet, ProperNoundle). See section 10.</div></div>
</div>

<div class="cap">Six pocket games for friends</div>
<div class="shelf">
  <img src="/art/art-titlecast-pocket-rps.webp" alt="Rock Paper Scissors" loading="lazy" decoding="async">
  <img src="/art/art-titlecast-pocket-ttt.webp" alt="Tic-Tac-Tile" loading="lazy" decoding="async">
  <img src="/art/art-titlecast-pocket-coin.webp" alt="Call It" loading="lazy" decoding="async">
  <img src="/art/art-titlecast-pocket-pass.webp" alt="Pass the Puzzle" loading="lazy" decoding="async">
  <img src="/art/art-titlecast-pocket-chain.webp" alt="Word Chain" loading="lazy" decoding="async">
  <img src="/art/art-titlecast-pocket-ghost.webp" alt="Ghost" loading="lazy" decoding="async">
</div>
<ul>
  <li><strong>Rock Paper Scissors</strong> and <strong>Tic-Tac-Tile</strong> are best of 3, <strong>Call It</strong> is a server coin flip, best of 5, <strong>Pass the Puzzle</strong> alternates guesses on one Classic board (6 total, the solver wins), <strong>Word Chain</strong> takes 5 to 15 letter words and races to 50, <strong>Ghost</strong> uses 5 to 7 letter words.</li>
  <li>Free for everyone, free and Pro alike. Rules live in <code>packages/core/src/friendly-games.ts</code> (Swift and Kotlin ports, parity fixtures). State is server-authoritative: the <code>friendly_games</code> table is written only through <code>/api/friends/games</code> with optimistic concurrency, and clients poll about every 2 seconds.</li>
</ul>

<!-- 3 -->
<h2 id="app"><span class="num">3</span><span class="t">The app: four tabs</span><img class="mx" src="/mascots/o1.png" alt="" width="34" height="34" loading="lazy"></h2>
<div class="rows">
  <div><div class="k">Home</div><div class="v">One-window banner, the Dailies and Puzzles tile sections, and the Word of the Day quiz. Tiles carry plain-caps names with W / L badges.</div></div>
  <div><div class="k">Leaderboard</div><div class="v">A living day stage (your mascot and the day&rsquo;s title), daily and all-time boards per game, Records, and friends boards.</div></div>
  <div><div class="k">Stats</div><div class="v">Scope by game, medals, level tiers, achievements, records and a glossary of every stat.</div></div>
  <div><div class="k">Friends</div><div class="v">One-window Friends banner (ON NOW faces, friend streaks, the weekly race), the six pocket games, reactions, moments, invites and VS challenges.</div></div>
</div>
<ul>
  <li><strong>Navigation:</strong> a bottom bar on phones; on desktop web (1024 px and up) a sticky top bar with the cast wordmark and candy tab pills. Gameplay screens open from these tabs and keep the same shared header.</li>
  <li><strong>The cast:</strong> ten letters spelling WORDOCIOUS (<code>w o1 r d o2 c i o3 u s</code>), art in <code>apps/web/public/mascots</code> and mirrored in iOS and Android assets. Each page has one host. Spec: <code>docs/MASCOT_SPEC.md</code>.</li>
  <li><strong>Your mascot:</strong> Edit Profile is the Stage, the maker is the Dressing Room (ten tabs, 35 integrated parts, &ldquo;None&rdquo; on every part), plus Title Shelves, level-tier avatar frames, and the cast heroes as avatars.</li>
  <li><strong>Achievements and levels:</strong> medals and XP are awarded server-side; unlock popups are shared across all three clients.</li>
  <li><strong>Age:</strong> Wordocious is 13+. An age check at sign-up flags under-13 answers, and a daily cron deletes those accounts after a 7-day grace window.</li>
</ul>

<!-- 4 -->
<h2 id="repo"><span class="num">4</span><span class="t">Repository map</span><img class="mx" src="/mascots/r.png" alt="" width="34" height="34" loading="lazy"></h2>
<p>One monorepo: <code>github.com/BTBTBTBTBTBTBT/WordRush</code> (directory names predate the Wordocious rename).</p>
<div class="rows">
  <div><div class="k"><code>packages/core</code></div><div class="v">The canonical TypeScript engine: seeds, reducer, dictionary, scoring, plus shared rules for VS lobby, bot cast, pocket games, seasons, level tiers and avatars. Web and the VS server consume it directly.</div></div>
  <div><div class="k"><code>apps/web</code></div><div class="v">Next.js site and every API route (content, payments webhooks, push, VS challenges, friends, admin, crons).</div></div>
  <div><div class="k"><code>apps/ios</code></div><div class="v">SwiftUI app + <code>Sources/Core</code>, a 1:1 Swift port of the engine, pinned by shared fixtures.</div></div>
  <div><div class="k"><code>apps/android</code></div><div class="v">Compose app + <code>:core</code>, the Kotlin port of the same engine, same fixtures.</div></div>
  <div><div class="k"><code>apps/server</code></div><div class="v">socket.io VS server (Railway). Loads the same word lists so both sides resolve identical seeds.</div></div>
  <div><div class="k"><code>supabase/</code></div><div class="v"><code>migrations</code> and <code>manual-migrations</code> hold the schema history; <code>docs/sql</code> holds later hand-applied SQL; <code>email-templates</code> holds the auth emails. Hand SQL is applied with the scripts in <code>scripts/</code> (section 17).</div></div>
  <div><div class="k"><code>scripts/</code></div><div class="v">Operational tooling: word-bank curation, Play upload and product creation, ASC submit, DB backup and apply, perf tours, screenshot rigs, this portal&rsquo;s generator.</div></div>
  <div><div class="k"><code>docs/</code></div><div class="v">Specs (home, VS, friends, finish, mascot), the LevelPlay setup, marketing and the JP launch kit, and <code>docs/design/brand</code> (cast, titles, seasons, sounds, social).</div></div>
  <div><div class="k"><code>.github/workflows</code></div><div class="v">CI and the monthly ProperNoundle validator (section 18).</div></div>
  <div><div class="k"><code>WORDOCIOUS_BIBLE.md</code></div><div class="v">The chronicle: every decision, bug and lesson as numbered entries, newest first (it runs past 380 now). This portal is the map; the bible is the history.</div></div>
</div>

<!-- 5 -->
<h2 id="core"><span class="num">5</span><span class="t">The deterministic core</span><img class="mx" src="/mascots/d.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>Seeded dailies.</strong> A puzzle is fully determined by its seed (<code>daily-YYYY-MM-DD-MODE</code>). No server round-trip starts a game; every client derives the same answers from the same seed and word lists.</li>
  <li><strong>One engine, three ports.</strong> TypeScript is canonical; Swift and Kotlin mirror it exactly. Shared JSON fixtures (seeds, prefills, scoring, VS lobby, pocket games, seasons) are generated from the TS core and asserted by all three test suites, so an engine change that lands without regenerating them fails the web tests first.</li>
  <li><strong>The reducer</strong> (<code>packages/core/src/reducer.ts</code> and ports) is the single state machine for every word mode: guess validation, multi-board apply-to-all, sequential stages, Gauntlet chaining, prefills. UI layers never re-implement rules.</li>
  <li><strong>The puzzle games</strong> (Sudocious, Muddle, Hubbub and the rest) are seeded from versioned banks the same way, with their own engines under <code>packages/core/src/games</code>.</li>
  <li><strong>ProperNoundle</strong> is the deliberate exception for words: answers are famous names from a curated pool (669 puzzles with category and Wikipedia clues), and guesses skip dictionary validation on every platform.</li>
</ul>

<!-- 6 -->
<h2 id="words"><span class="num">6</span><span class="t">Word &amp; puzzle banks</span><img class="mx" src="/mascots/i.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>Two tiers.</strong> Answers are small curated lists (Classic 1,734, Six 2,860, Seven 2,912); guesses are far more permissive (10,150 five-letter, 11,872 six-letter, 13,786 seven-letter). Counts are the shipped files in <code>apps/web/data</code>.</li>
  <li><strong>The G1 to G8 rules</strong> (<code>scripts/curate-solutions.py</code>) govern the guess lists: length purity, answers always guessable, generated inflections, an offensive blocklist, proper-noun exclusion, <strong>monotonic growth</strong> (the guess list never shrinks) and a hand-vouched modern-words list.</li>
  <li><strong>History is protected by tests</strong> (<code>word-list-sync.test.ts</code>): every answer ever served stays guessable, all copies are byte-identical across platforms, and no shipped guess derives from a slur. A word that left the list would silently rewrite replayed games.</li>
  <li><strong>Dated answer swaps.</strong> Answers can be swapped out (profanity, British spellings, jargon) behind a content-release date, so older days replay unchanged. Spelling is American everywhere in copy, banks and the dictionary; answers and word lists are exempt.</li>
  <li><strong>Puzzle banks.</strong> Each puzzle game draws from a versioned bank (<code>apps/web/lib/banks-manifest.json</code>, served from <code>public/banks</code>, epoch 2026-09-23) with daily and extra puzzles and dated holiday puzzles. A bank-runway report warns before any bank runs dry.</li>
  <li><strong>Pocket words.</strong> Word Chain checks against a server-only 8 to 15 letter list (about 29,000 words) so the apps stay small; Ghost uses the normal guess lists.</li>
  <li>Players report gaps to <strong>support@wordocious.com</strong> (invited in-app under How to Play, Which Words Count?). Content safety lives in a registry with gates for every bank (<code>docs/CONTENT-SAFETY.md</code>).</li>
</ul>

<!-- 7 -->
<h2 id="scoring"><span class="num">7</span><span class="t">Scoring</span><img class="mx" src="/mascots/o2.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>V2, guess-first</strong> (days from 2026-07-14): 1,000 base + a per-mode guess bonus for every unused guess + a speed bonus capped at 80% of one guess-step (time only breaks ties) + completion up to 200 + hint penalties. Losses bank partial credit (letters, boards, Gauntlet stages).</li>
  <li><strong>Refinements, all dated:</strong> a loss earns a fractional time bonus so equal-board losses rank by speed (2026-08-24); the speed bonus never reaches zero, so two different times always score differently (2026-09-28: &ldquo;all games need a winner, no ties&rdquo;).</li>
  <li><strong>V1 is frozen forever</strong> and selected by the puzzle&rsquo;s date, so older leaderboards recompute exactly what was recorded.</li>
  <li>Single source: <code>apps/web/lib/composite-scoring.ts</code>, mirrored by <code>DailyScoring.swift</code> and <code>DailyScoring.kt</code>, pinned by generated fixtures. Every points surface (share cards, results, boards) shows the leaderboard&rsquo;s whole number. VS matches use a separate breakdown in <code>packages/core/src/scoring.ts</code>.</li>
</ul>

<!-- 8 -->
<h2 id="backend"><span class="num">8</span><span class="t">Backend (Supabase)</span><img class="mx" src="/mascots/u.png" alt="" width="34" height="34" loading="lazy"></h2>
<p>Project ref <code>eniiqqsxpmuyrspvepiw</code> &mdash; Postgres + Auth + RLS, on the <strong>Pro plan ($25/month) with Micro compute since Oct 3, 2026</strong> (daily backups, leaked-password protection, spend cap on). There is no bespoke app server for game data; clients talk to Supabase directly under row-level security, and privileged writes go through Next.js API routes using the service-role key.</p>
<ul>
  <li><strong>Auth:</strong> Google OAuth, Sign in with Apple (iOS), email + password with confirmation and reset. Guests can play without an account; their results live only on the device.</li>
  <li><strong>Core tables:</strong> <code>profiles</code> (identity, <code>role</code>, <code>is_pro</code> and <code>pro_expires_at</code> &mdash; the single Pro entitlement all three clients read), <code>daily_results</code> (stored per-day scores behind every leaderboard), <code>matches</code>, <code>medals</code>, <code>streak_shields</code>, <code>daily_bonuses</code>, <code>device_tokens</code>, <code>announcements</code>, <code>reports</code>, <code>store_webhook_events</code> (payments idempotency ledger).</li>
  <li><strong>Newer tables:</strong> <code>friendly_games</code> and <code>moment_reactions</code> (pocket games), <code>vs_challenges</code> and <code>vs_challenge_entries</code>, <code>weekly_race_results</code>, <code>shield_gifts</code>, <code>referrals</code>, <code>app_flags</code>, and the Studio, Art Library and Sound Library tables.</li>
  <li><strong>RLS posture:</strong> users write only their own rows with value clamps; Pro columns are locked by a trigger so only admin or service-role can grant entitlements; reports and <code>is_banned</code> drive moderation. Roles are <code>user</code>, <code>admin</code> and <code>tester</code> (testers never generate ad traffic).</li>
  <li><strong>Remote flags:</strong> <code>app_flags</code> rows (key, enabled, audience) are served by <code>/api/flags</code>, CDN-cached for 60 seconds, so a kill switch lands everywhere within a minute. Ads fail closed. Admin changes to a flag or audience confirm first.</li>
  <li><strong>Changing the database:</strong> take a full dump with <code>scripts/db-backup.sh</code>, apply the SQL with <code>scripts/db-apply.sh</code>, read the result back, and keep the file in the repo.</li>
</ul>

<!-- 9 -->
<h2 id="web"><span class="num">9</span><span class="t">Web app &amp; content APIs</span><img class="mx" src="/mascots/o3.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>Hosting:</strong> Vercel (Pro plan), project <code>wordocious</code>, domain wordocious.com. Push to <code>main</code> = production deploy. Nothing deploys from branches.</li>
  <li><strong>Crons</strong> (<code>vercel.json</code>): daily medals 12:05 UTC, daily reminder push 14:00 UTC, <code>expire-pro</code> hourly, <code>purge-under13</code> 13:30 UTC, <code>friends-recap</code> Mondays 13:00 UTC, <code>integrity</code> 11:30 UTC, <code>social-publish</code> every 15 minutes. Frequent crons need the Pro plan; on Hobby an hourly cron silently breaks ALL deploys.</li>
  <li><strong>Single-sourced editorial content:</strong> How to Play, FAQ, mode help, About, Support, Guides, Strategy and Word-of-Day archives live in <code>apps/web/lib/*-content.ts</code> and are served at <code>/api/howtoplay</code>, <code>/api/content</code>, <code>/api/guides</code>, <code>/api/strategy</code>, <code>/api/words</code>. <strong>Both native apps fetch and cache these</strong>, so editing help copy is a web deploy, not an app release. Only Privacy and Terms are hardcoded per platform (offline compliance).</li>
  <li><strong>Public pages</strong> for SEO: guides, strategy articles, word archives, FAQ, privacy, terms, delete-account. <code>AuthGate</code> keeps them crawlable while gating gameplay.</li>
  <li><strong>Links:</strong> tracked short links at <code>/go/slug</code> (admin Marketing), friend invites at <code>/join/CODE</code> and <code>/vs/join/CODE</code>, VS challenges at <code>/vs/challenge/CODE</code> (universal links on iOS, App Links on Android), and branded invite preview images.</li>
  <li><strong>Desktop web</strong> (1024 px and up) is a real website layout: top bar, Home dashboard, two-column pocket games. Phones are untouched by it.</li>
</ul>

<!-- 10 -->
<h2 id="vs"><span class="num">10</span><span class="t">VS multiplayer &amp; bots</span><img class="mx" src="/mascots/s.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>Live matches:</strong> socket.io server on Railway, auto-deployed from main. It validates guesses with the same core engine and word lists, relays opponent progress and records results. Both players race the same puzzle.</li>
  <li><strong>Four ways to play:</strong> friend invite links, the live queue, <strong>race my run</strong> (async challenges: the racer plays the challenger&rsquo;s seed against a ghost of their pace; sending one is Pro), and <strong>built-in bots</strong>.</li>
  <li><strong>The bot ladder:</strong> ten cast characters from Rip (rung 1) to Webster (the boss) with easy, medium, adaptive and hard tiers (<code>packages/core/src/bot-cast.ts</code>). Win 3 in a row against the next bot to clear a rung. Bot matches satisfy the same transport interface as the socket and record under a separate <code>vs_cpu</code> play type; a named bot steps in automatically when the queue is empty (free Daily Battle: today&rsquo;s bot).</li>
  <li><strong>Lobby and record:</strong> one-window VS banner (Daily Battle, Bot of the Day, People and Bots records, ladder progress) from the shared rules in <code>vs-lobby.ts</code>; Stats read the same sums. Result screens use Wordocious colors, never the green/yellow of other word games.</li>
  <li>Free players get a daily VS allowance; Pro adds VS in every mode, invites, rematches and challenges.</li>
</ul>

<!-- 11 -->
<h2 id="payments"><span class="num">11</span><span class="t">Payments: three rails</span><img class="mx" src="/mascots/o1.png" alt="" width="34" height="34" loading="lazy"></h2>
<div class="note"><strong>The policy fact behind it all:</strong> Apple requires IAP in the iOS app, Google requires Play Billing in the Android app, and Stripe may only sell on the web. The three rails never mix; parity of products and prices across them is a deliberate invariant.</div>
<div class="tiles three">
  <div class="tile p"><div class="l">pro_monthly</div><div class="n">$6.99</div><div class="d">auto-renewing monthly</div></div>
  <div class="tile g"><div class="l">pro_yearly</div><div class="n">$59.99</div><div class="d">auto-renewing yearly</div></div>
  <div class="tile s"><div class="l">pro_day</div><div class="n">$1.00</div><div class="d">consumable 24-hour day pass</div></div>
</div>
<ul>
  <li><strong>Pro includes:</strong> no ads, unlimited puzzles in every game, VS in every mode and challenges, streak shields (subscriptions add 4), extra mascot items and deeper stats.</li>
  <li><strong>Entitlement is one row:</strong> <code>profiles.is_pro</code> + <code>pro_expires_at</code>, read by each client&rsquo;s <code>isProActive</code>. A grant from any rail lights up all three platforms instantly, with no build.</li>
  <li><strong>Server-authoritative fulfillment:</strong> App Store Server Notifications at <code>/api/appstore/notifications</code>, Play RTDN at <code>/api/playstore/notifications</code>, Stripe webhooks at <code>/api/stripe/*</code>. All claim events in the <code>store_webhook_events</code> ledger (idempotent) and extend entitlement additively, so a grant never truncates an existing window. An hourly cron expires lapsed Pro.</li>
  <li><strong>Status:</strong> StoreKit 2 on iOS and Stripe Checkout on web (/pro) are live; Google Play Billing on Android carries the same three products under the ShowLoud merchant account (products via <code>scripts/play-create-products.mjs</code>; setup in bible entry 194). Admin Revenue reads Apple sales and the store feed. Runbook: <code>PAYMENTS_RUNBOOK.md</code>.</li>
</ul>

<!-- 12 -->
<h2 id="ads"><span class="num">12</span><span class="t">Ads, push, crashes</span><img class="mx" src="/mascots/c.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>Ads: Unity LevelPlay, live in 2.8.2 on both stores</strong> (interstitials for free players; Pro sees none; the web serves no ads). They are gated twice: the SDK must be compiled in, and the remote <code>ads</code> flag must be on (audience all since Oct 13, fail closed). The SDK never starts for admin or tester accounts, debug builds, consent-gated regions or listed test devices; Settings has an ad-ID row and a LevelPlay test suite for admins.</li>
  <li><strong><code>app-ads.txt</code>:</strong> <code>apps/web/public/app-ads.txt</code> is copied verbatim from the Unity Monetization dashboard (Settings, Organization, App-ads.txt). If Unity lists new missing sellers, re-copy the whole block and never hand-edit it. Admin Revenue shows the LevelPlay numbers and the file state.</li>
  <li><strong>Never use Google ad products.</strong> Google disabled the publisher accounts in August and denied the appeal on Sep 1 (an entity-level ban). The LevelPlay AdMob and Ad Manager adapter must never be enabled. Setup history: <code>docs/LEVELPLAY_SETUP.md</code>.</li>
  <li><strong>Push:</strong> APNs (iOS) and FCM (Android). Tokens live in <code>device_tokens</code>, sends go through <code>/api/push</code>, with a daily reminder cron at 14:00 UTC, a Monday friends recap, rich push, and per-player notification preferences.</li>
  <li><strong>Crash reporting:</strong> Sentry on web, iOS and Android, including capture of rejected Supabase writes so silent RLS failures surface.</li>
</ul>

<!-- 13 -->
<h2 id="referrals"><span class="num">13</span><span class="t">Gifts &amp; referrals</span><img class="mx" src="/mascots/o2.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li>Any signed-in player creates up to 3 pending invite links (<code>/join/CODE</code>, 30-day expiry). A new user who redeems gets <strong>7 days of Pro</strong> (the gifted week). The inviter gets +3 days for each of the first 5 redemptions, +4 streak shields when the 3rd friend redeems, and, if the friend later subscribes, <strong>+30 days</strong> (monthly) or <strong>+90 days</strong> (yearly), granted once via <code>reward_granted_at</code> so renewals never double-pay.</li>
  <li>Anti-fraud: one redemption per account ever (DB-enforced), no self-referral, the redeemer must never have had Pro, and <code>pro_day</code> never triggers rewards. All grants extend Pro additively.</li>
  <li>Hooked into all three fulfillment paths; native apps deep-link via universal links and App Links. Admin <strong>Pro &amp; Gifts</strong> shows members, the Gifts tab and the store feed. A larger referral program is parked pending a founder decision.</li>
</ul>

<!-- 14 -->
<h2 id="seasons"><span class="num">14</span><span class="t">Seasons &amp; the Halloween kit</span><img class="mx" src="/mascots/r.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>Seasons are data.</strong> <code>packages/core/src/season-registry.json</code> (byte-identical copies in iOS and Android, checked by a test) names each season&rsquo;s art slots and palette; <code>SEASON_WINDOWS</code> in <code>level-season.ts</code> (and its Swift and Kotlin ports) holds the dates. Any missing slot falls back to the normal art. Recipe: <code>docs/design/brand/seasons/README.md</code>.</li>
  <li><strong>Halloween runs Oct 9 to Oct 31</strong>, every year, by the player&rsquo;s local date; it turns off at local midnight Nov 1 with no build or server change. The social calendar uses Oct 17 to 31 for the Halloween look.</li>
  <li><strong>The kit:</strong> the costumed cast skins, 24 Halloween title treatments, midnight walls, a seasonal banner and props, button tints, and recolored <strong>surfaces</strong> (&ldquo;Haunted glass&rdquo;: night-plum glass cards, orange drip caps, light inks, cobwebs). The founder rule: a season skins the windows, not just the wallpaper.</li>
  <li><strong>Seasonal mascot items:</strong> 11 Halloween items (hats, bat ears and wings, a cat tail, a candy pail, buddies) on their own shelf in the Dressing Room, free in season; saved looks are kept after.</li>
  <li><strong>Preview:</strong> admin-only Settings, Season preview picker on the apps, and the admin <strong>Seasons</strong> page (status, web preview, the costumed cast). Art Library tags assets LIVE IN PREVIEW.</li>
  <li><strong>Next:</strong> a Thanksgiving kit (social looks from Nov 14), then the winter holidays, mixing Christmas with a real share of Hanukkah and a sprinkle of Kwanzaa under written respect rules.</li>
</ul>

<!-- 15 -->
<h2 id="admin"><span class="num">15</span><span class="t">The admin portal</span><img class="mx" src="/mascots/d.png" alt="" width="34" height="34" loading="lazy"></h2>
<p>At <code>/admin</code>, gated server-side by <code>middleware.ts</code> (<code>profiles.role = 'admin'</code>) and re-verified by every <code>/api/admin/*</code> route. In October the portal was consolidated from 28 pages into the <strong>7 groups</strong> below; pages with several views use <code>?tab=</code> deep links and fetch a tab only when it opens. Old URLs redirect in <code>next.config.js</code>. The map lives in one file, <code>app/admin/components/admin-nav.ts</code>.</p>
<div class="rows">
  <div><div class="k">Overview</div><div class="v"><strong>Dashboard</strong> (key counts, jump-to directory) &middot; <strong>Metrics</strong> (Weekly Five, Activation)</div></div>
  <div><div class="k">Monetization</div><div class="v"><strong>Revenue</strong> (subscriptions, LevelPlay ads, store revenue, expenses) &middot; <strong>Pro &amp; Gifts</strong> (Pro members, Gifts, Store feed)</div></div>
  <div><div class="k">Growth</div><div class="v"><strong>Marketing</strong> (Channels, Shares) &middot; <strong>Social Studio</strong> (Calendar, JP&rsquo;s plan, Accounts) &middot; <strong>Messaging &amp; Push</strong> (Announcements, Campaigns, Push health, Copy)</div></div>
  <div><div class="k">Design</div><div class="v"><strong>Art Library</strong> &middot; <strong>Sound Library</strong> &middot; <strong>Seasons</strong></div></div>
  <div><div class="k">Players</div><div class="v"><strong>Users &amp; Moderation</strong> (Search, New, Banned, Audit log; bans ask for a reason and confirm)</div></div>
  <div><div class="k">Games &amp; Puzzles</div><div class="v"><strong>Dailies</strong> (Today, Word of the Day, Content banks; &ldquo;today&rdquo; is the viewer&rsquo;s local date) &middot; <strong>Games</strong> (Leaderboards, Puzzles, VS &amp; Bots with match health) &middot; <strong>Friends &amp; Pocket Games</strong> &middot; <strong>Progression</strong> (Achievements, Levels, Avatars)</div></div>
  <div><div class="k">System</div><div class="v"><strong>Ops</strong> (Health, Flags) &middot; <strong>Engineering</strong> (Releases, Portal &mdash; this page)</div></div>
</div>

<!-- 16 -->
<h2 id="studio"><span class="num">16</span><span class="t">Social Studio &amp; the libraries</span><img class="mx" src="/mascots/s.png" alt="" width="34" height="34" loading="lazy"></h2>
<h3>Social Studio (admin, Growth)</h3>
<ul>
  <li>A marketing calendar (month and week views, status colors, season bands) over review cards with per-platform captions. <strong>Approved posts auto-publish</strong>: the <code>social-publish</code> cron (every 15 minutes) posts only when a post is due, <strong>both BMT and JP have approved its current version</strong>, it is not paused and its account is connected. Any caption edit resets both approvals; there is a Pause all and a per-post Hold.</li>
  <li>Tracked links <code>/go/p-ID-platform</code> attribute clicks per post. Tables <code>social_*</code> are RLS-locked to the service role; Claude reads open feedback from a view.</li>
  <li><strong>JP&rsquo;s plan</strong> tab: strategy, KPI targets vs actuals, setup tasks (S1 to S7), a live account change log, and the copyable launch kit (press one-pager, press list, Product Hunt, founder posts, bios with <code>/go</code> links). The 45-day calendar is imported as draft posts, with video slots held for capture.</li>
  <li><strong>Accounts</strong> tab holds the handle registry: X @wordocious; Instagram, TikTok and Threads @playwordocious; Facebook and Pinterest &ldquo;wordocious&rdquo;. @wordocious on Instagram and TikTok is held by dormant strangers and is a trademark-route follow-up.</li>
  <li><strong>Post art</strong> is whole scenes drawn in the free ChatGPT (background, headline and mascots together), each checked side by side against the real cast art, then finished in code with the real wordmark and footer (<code>docs/design/brand/social/jp45/STYLE.md</code>). The PNGs live in the Art Library and the <code>social-media</code> bucket, not in the repo.</li>
</ul>
<h3>Art Library &amp; Sound Library (admin, Design)</h3>
<ul>
  <li><strong>Art Library:</strong> every new piece of art in sections with side-by-side previews, inline approve, reject and comment (and Approve all per section), Before &amp; After, and LIVE IN PREVIEW tags from <code>season-preview-wired.json</code>. Files live in the private repo <code>wordocious-art</code> and the <code>art-library</code> bucket.</li>
  <li><strong>Sound Library:</strong> every app sound grouped by game, the shipped sound (LIVE) beside its options, BMT and JP picking one per event, with feedback Claude reads. The catalog is generated from the Sound Lab by <code>docs/design/brand/sounds/export-sound-catalog.py</code>.</li>
  <li>Both use the <strong>two-approver rule</strong> (BMT and JP) and are modeled on each other, so a review habit learned in one works in the other.</li>
</ul>

<!-- 17 -->
<h2 id="release"><span class="num">17</span><span class="t">Release &amp; deploy runbook</span><img class="mx" src="/mascots/u.png" alt="" width="34" height="34" loading="lazy"></h2>
<div class="rows">
  <div><div class="k">Web</div><div class="v">Merge or push to <code>main</code> and Vercel builds and aliases wordocious.com. Always check the deployment status after a push. Run the <strong>full</strong> web test suite before pushing, even for data-only changes.</div></div>
  <div><div class="k">Android</div><div class="v">Bump <code>versionCode</code> in <code>apps/android/app/build.gradle.kts</code>, then <code>node scripts/play-upload.mjs</code> builds the AAB and uploads to the <strong>internal track</strong>. Production is the next step, a promote in the Play Console. The upload key deliberately cannot reach production, and the console (not git) is the authority on used version codes.</div></div>
  <div><div class="k">iOS</div><div class="v">Shipped <strong>on request</strong>. Bump <code>CURRENT_PROJECT_VERSION</code> in <code>apps/ios/project.yml</code> (app + widget), <code>xcodegen generate</code>, archive unsigned, export with the manual-signing plist, then <strong>re-sign restoring the four stripped entitlements</strong> (applesignin, associated-domains, application-groups, aps-environment; frameworks, then appex, then app) and <code>altool</code> validate + upload. Submission and release run through <code>scripts/store-screenshots/asc-submit.rb</code> with automatic release after approval.</div></div>
  <div><div class="k">Paired stores</div><div class="v"><strong>Every iOS App Store submission is paired with a Play production submission of the same version.</strong> Both auto-release on approval, so there is no manual release step. Submit only when nothing else is waiting in review.</div></div>
  <div><div class="k">VS server</div><div class="v">Railway auto-deploys <code>apps/server</code> from main.</div></div>
  <div><div class="k">Database</div><div class="v">Hand SQL: <code>scripts/db-backup.sh</code> first (full dump), <code>scripts/db-apply.sh</code> to run a file or a read-back query, then keep the file in <code>supabase/manual-migrations</code> or <code>docs/sql</code>. Never edit production schema without a file.</div></div>
  <div><div class="k">Before any build</div><div class="v">Check free disk, run the perf tour against the live build (a smoothness regression pulls a build; when looks and speed conflict, speed wins), and confirm the native test suites and parity fixtures are green. Builds are serial, one headless simulator at a time.</div></div>
  <div><div class="k">Editorial &amp; flags</div><div class="v">Help copy, banks and flags change without a build: help copy through a web deploy, flags in admin Ops.</div></div>
</div>

<!-- 18 -->
<h2 id="ci"><span class="num">18</span><span class="t">CI, guard tests &amp; ops</span><img class="mx" src="/mascots/c.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>CI</strong> (<code>.github/workflows/ci.yml</code>) runs on every push to main and every PR: typecheck the web app and the VS server, <code>packages/core</code> unit tests, the content gate, the full <code>apps/web</code> test suite, and the composite-scoring check. A failed run emails the founder. Native builds are not in CI; the ship scripts compile them.</li>
  <li><strong>Guard tests</strong> fail the build instead of relying on memory: engine and scoring parity fixtures, <code>word-list-sync</code>, the content-safety registry, <code>spelling-copy</code> and <code>content-american</code> (American spelling), <code>no-emoji-ui</code> (our own art, never system emoji), <code>sweep-copy</code> (the daily set size is a catalog fact, never a literal), <code>button-family-guard</code>, season-registry copy checks, <code>jp45-posts</code> captions, and <code>portal-sync</code> (this page and its standalone copy must match).</li>
  <li><strong>Nightly integrity cron</strong> (11:30 UTC): paged sweeps compared with exact counts, zero-guess wins, implausible times, Word of the Day definitions, bank runway, and cron heartbeats shown in admin Ops. A plausibility floor also lives in the database as a trigger.</li>
  <li><strong>Monthly</strong> (1st, 12:00 UTC): the ProperNoundle bank validator re-checks every Wikipedia clue and opens a GitHub issue listing failures.</li>
  <li><strong>Perf harness</strong> (<code>docs/PERF_HARNESS.md</code>, <code>scripts/web-perf-tour.mjs</code>, native tours): the gate before every build.</li>
</ul>

<!-- 19 -->
<h2 id="integrations"><span class="num">19</span><span class="t">Integrations directory</span><img class="mx" src="/mascots/i.png" alt="" width="34" height="34" loading="lazy"></h2>
<div class="rows c3">
  <div><div class="k">Vercel</div><div class="w">Web hosting, crons, env secrets</div><div class="w">project <code>wordocious</code></div></div>
  <div><div class="k">Supabase</div><div class="w">Auth + Postgres + RLS (Pro plan, $25/month)</div><div class="w"><code>eniiqqsxpmuyrspvepiw</code></div></div>
  <div><div class="k">Railway</div><div class="w">VS socket server</div><div class="w">auto-deploy from main</div></div>
  <div><div class="k">GitHub</div><div class="w">Monorepo, CI, monthly validator</div><div class="w"><code>BTBTBTBTBTBTBT/WordRush</code></div></div>
  <div><div class="k">App Store Connect</div><div class="w">iOS distribution, IAP, sales reports</div><div class="w">app <code>6775966055</code>, team <code>Q32F6GRDYG</code></div></div>
  <div><div class="k">Google Play Console</div><div class="w">Android distribution + billing</div><div class="w">org account <code>ShowLoud</code>, pkg <code>com.wordocious.app</code></div></div>
  <div><div class="k">Google Payments</div><div class="w">Play merchant account / payouts</div><div class="w">ShowLoud LLC, statement name Wordocious</div></div>
  <div><div class="k">Google Cloud</div><div class="w">OAuth clients + service accounts (sign-in and Play API only, never ads)</div><div class="w">project <code>spellstrike-490819</code></div></div>
  <div><div class="k">Stripe</div><div class="w">Web Pro billing</div><div class="w">live on /pro</div></div>
  <div><div class="k">Unity LevelPlay</div><div class="w">Mobile ads mediation and reporting</div><div class="w">live in 2.8.2, <code>ads</code> flag</div></div>
  <div><div class="k">Sentry</div><div class="w">Crash and error reporting, all platforms</div><div class="w">three DSNs (web, iOS, Android)</div></div>
  <div><div class="k">APNs / FCM</div><div class="w">Push delivery</div><div class="w">via <code>/api/push</code></div></div>
  <div><div class="k">ChatGPT (free)</div><div class="w">All art generation, run in the browser</div><div class="w">outputs live in the Art Library</div></div>
</div>

<!-- 20 -->
<h2 id="secrets"><span class="num">20</span><span class="t">Secrets &amp; access</span><img class="mx" src="/mascots/w.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>This document contains no secrets.</strong> Web and server secrets (Supabase service role, Stripe keys, webhook secrets, the FCM service account, the LevelPlay reporting keys) live in <strong>Vercel environment variables</strong>. Local material lives outside the repo: <code>~/.appstoreconnect/</code> (ASC API key and export plists), <code>~/.android-keys/</code> (upload keystore and Play publisher service-account JSON), and <code>~/.wordocious-db-url</code> (the database connection string used by the DB scripts, never printed).</li>
  <li>The Play service account is least-privilege by design: testing tracks and store presence, no production release, no financial data. Production promotion on Play is a human console action.</li>
  <li>Admin portal access = <code>profiles.role = 'admin'</code>, enforced server-side. This page sits inside that gate; treat the standalone HTML copy as internal.</li>
</ul>

<!-- 21 -->
<h2 id="conventions"><span class="num">21</span><span class="t">Conventions &amp; guard rails</span><img class="mx" src="/mascots/o3.png" alt="" width="34" height="34" loading="lazy"></h2>
<ul>
  <li><strong>iOS is the design foundation; Android and web match it.</strong> Every fix is checked and brought to parity on iOS, Android and web in the same batch.</li>
  <li><strong>Drift guards over discipline:</strong> parity fixtures, word-list sync, scoring fixtures and content invariants fail builds rather than relying on memory.</li>
  <li><strong>The house look:</strong> a purple, gold and gray glossy family, with ChatGPT bubble lettering for headlines and plain bold caps for small labels, cast art in the windows, calm backgrounds, compact symmetric cards, and no outlined boxes around stats. Every new screen or menu is designed first, and no placeholder screens ship.</li>
  <li><strong>Smooth over pretty:</strong> when performance and looks conflict, cut the effect.</li>
  <li><strong>The bible</strong> (<code>WORDOCIOUS_BIBLE.md</code>) records every incident and decision as numbered entries, newest first; read it before re-deriving a past decision. This portal is regenerated from <code>apps/web/lib/portal-html.ts</code> via <code>node scripts/gen-portal-html.mjs</code>.</li>
  <li><strong>Editorial copy is code:</strong> it ships through the content APIs, rots silently, and gets audited. When a formula or feature changes, grep the content files for every description of it.</li>
</ul>

<div class="foot">
  <div class="cast-row" aria-hidden="true">
    <img src="/mascots/w.png" alt="" loading="lazy"><img src="/mascots/o1.png" alt="" loading="lazy"><img src="/mascots/r.png" alt="" loading="lazy"><img src="/mascots/d.png" alt="" loading="lazy"><img src="/mascots/o2.png" alt="" loading="lazy"><img src="/mascots/c.png" alt="" loading="lazy"><img src="/mascots/i.png" alt="" loading="lazy"><img src="/mascots/o3.png" alt="" loading="lazy"><img src="/mascots/u.png" alt="" loading="lazy"><img src="/mascots/s.png" alt="" loading="lazy">
  </div>
  <p class="muted">Wordocious &middot; ShowLoud, LLC &middot; questions: support@wordocious.com &middot; regenerate from apps/web/lib/portal-html.ts</p>
</div>
</div>
</body>
</html>
`;
