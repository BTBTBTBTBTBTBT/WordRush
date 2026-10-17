# Social Playbook: how we run a social block, end to end

Last updated: 2026-10-16

Founder 10-16: "develop a social media roadmap same as what we did for the seasonality piece so when we continue on I'll have something to reference for you to pick it up as smooth as you currently are."

This is the operating manual for every social block after JP's first 45 days (Oct 13 to Nov 29, 2026). It mirrors the season playbook (`docs/design/brand/seasons/PLAYBOOK.md`): order of work, the full checklist, the quality bar, the lessons. The strategy itself (message house, voice, guardrails, series, cadence, KPIs) lives in `apps/web/lib/admin/social-plan.ts` (the Plan tab in admin > Growth > Social Studio). The visual system lives in `docs/design/brand/social/jp45/STYLE.md`. Block 1 is the worked example (`apps/web/lib/admin/jp45-posts.json`); block 2 (Nov 30 to Dec 27) is the first block built by this playbook (`docs/marketing/jp45/BLOCK-2-NOV30-DEC27.md`). Keep this file current: every block ends with a Lessons entry (section 8).

## 0. Block tracker (one place to see where each block stands)

Status words: **planned** (calendar written) · **seeded** (SQL applied, drafts in the Studio) · **art** (scenes accepted, media attached) · **approved** (BMT + JP) · **live** (published). Update it whenever an item moves.

| Block | Window | Plan | Posts seeded | Images | Approvals | Notes |
|---|---|---|---|---|---|---|
| 1 | Oct 13 to Nov 29 | `jp45-posts.json` | seeded 10-14 (122) + 5 greetings 10-15 | accepted (127 with media) | in progress | Halloween, Thanksgiving; first publish waits on account connections (section 6) |
| 2 | Nov 30 to Dec 27 | `BLOCK-2-NOV30-DEC27.md` | planned (SQL `20261016-jp45-block2-posts.sql`, not applied) | queued (`queue-block2.json`, 61 scenes) | todo | winter holidays + New Year teaser; 22 posts paused until facts/captures |
| 3 | Dec 28 to Jan 24 | not started | | | | New Year to Valentine's lead-in (kickoff list, section 8) |

---

## 1. Timeline (count back from the block's first day, "B")

| When | What |
|---|---|
| B − 14 days (the Monday two weeks before the block starts) | **Plan block N+1.** Read the season tracker and calendar (section 3) and the last two Monday reviews (section 7). Write the calendar doc + the post data file (`b2_data.py` pattern) + the image queue. The lead sends the founder the "calls needed" list (anything gated on a build, a feature or a fact). |
| B − 12 days | Seed the drafts: backup, SQL, read back (section 6). Start the ChatGPT image runs (priority: holiday greetings and the first week). |
| B − 7 days | Week 1 images accepted and attached; BMT + JP approve week 1. Week 2 images in progress. |
| Every Monday | KPI review (section 7), then approve the coming week's posts (both people) and attach any remaining media. A post must be fully approved before 07:00 CT on the day, or it simply does not publish. |
| Daily | Publish cron (every 15 minutes). Replies and community tasks are JP's. Videos: Brian captures (iPhone simulator demo mode) in two batches a week. |
| Last Sunday of the block | Day-N wrap post (numbers filled from the KPI tab, never invented), then the KPI re-base for the next block. |

If a week collapses, drop in this order (from the plan): Pinterest, Facebook, YouTube, Instagram feed. TikTok, the X daily and the Monday and Sunday rituals never drop. A missed day is recoverable; a missed week shows up at the Monday review.

## 2. Who does what

| Who | Does |
|---|---|
| **Founder (BMT)** | Approves every post (one of two required approvals), connects accounts (OAuth clicks, API credits, developer-app signups), decides anything on the "calls needed" list, tests real builds. Never asked to do QA the agents can do. |
| **JP (Jasson)** | The second required approval; runs community and press tasks (replies, Reddit participation, press emails, LinkedIn); fills the Day-45 style numbers from real data. |
| **Lead agent** | Owns the block: writes the plan, data and queue; runs the SQL (backup first); attaches media; keeps the tracker and this playbook current; reports in under 200 words. |
| **Image runner agent** | Drives the free ChatGPT web app in **the MacBook Chrome only** (never the Windows PC, never the paid API unless the founder says so explicitly). Up to four ChatGPT tabs in parallel, one queue group (A to D) per tab. NEVER clicks ChatGPT's Share button (it publishes a public link): find "Download" by its accessible name and click by ref after a screenshot; clear the prompt box before each prompt (drafts carry over between tabs). |
| **Vetting agent** | Compares every scene to the hero art, spells every headline letter by letter, logs checks in the manifest, finishes accepted scenes with `scene.py`. Needs a vision-capable model. |
| **Copy / data agent** | Writes captions and the post data file, runs the generator and the tests. A fast, cheaper model is enough (the tests catch rule breaks). |

Rules for agents: at most 3 agents at once (the cap from the ops guardrails), serial builds, one headless simulator, check `df -h` and `uptime` before any heavy job, time-box every agent (about 45 minutes, commit and report), no lingering polls (use `scripts/wait-for.sh`). Never `git stash`. Commit with a clear message; push only when the founder's standing orders allow it.

## 3. The block inventory (what every block must contain)

Build the block from this checklist; mark each line in the calendar doc.

**Slots per day** (all times America/Chicago, from block 1):

| Slot | Time | Platforms | Format | When |
|---|---|---|---|---|
| `holiday` | 07:00 | X, Threads, Instagram, Facebook | portrait + landscape, own image | every REAL holiday (rule below) |
| `x` | 08:00 | X + Threads | landscape 1600x900 | every day |
| `feed` | 11:30 | Instagram + Facebook + Threads | portrait 1080x1350 | Wednesday (Muddle), Friday (Friday's Finest), season and brand posts |
| `fb` | 11:30 | Facebook only | portrait | Sunday (Sweep Sunday), when no feed post |
| `pin` x3 | 13:00, 15:00, 17:00 | Pinterest | 1000x1500 | Thursday: game explainer, word card (a PAST word), cast art |
| `video` | 18:00 | TikTok + Instagram (Shorts/Reels) | 9:16, paused `[Needs capture]` | about four a week |

**Weekly series** (colors follow the season; the layout template never changes):

| Day | Series | Rule |
|---|---|---|
| Mon | MONDAY MASTERS | "New week. Zero points. The crown is open." Last week's champion is on the Leaderboard. |
| Tue | WORD OF THE DAY QUIZ (or a special) | The word is the real Word of the Day; three definition choices; the answer goes in the evening reply; correct letter stored in `wotd.answer`, never in a caption. |
| Wed | MUDDLE WEDNESDAY | YESTERDAY's already-played cartoon in a paper frame, "Caption this". |
| Thu | WOTD quiz + Hubbub pangram tease + 3 pins | "Seven letters, one pangram." Never the pangram. |
| Fri | FRIDAY'S FINEST | Best board of the week (founder's until real player shares exist; "Player of the Week" only with a real player's permission). |
| Sat | CAST SATURDAY | One bot-ladder character per week (Rip, Ivy, Ollie, Opal, Cosmo, Umi, Ozzy, Dewey, Scoot, Webster). |
| Sun | SWEEP SUNDAY | "Can you sweep all 18?" One board to prove it. |

**Holiday greeting rule (founder 10-15):** every REAL holiday gets its OWN early post (07:00 CT, "Happy <holiday>", a custom mascot image) in addition to the day's other posts. "Real" = a cultural or civic holiday that also gets a themed puzzle day or a place in the season (Halloween, Day of the Dead, Diwali, Veterans Day, Thanksgiving, Hanukkah, Christmas, Kwanzaa). Astronomical or minor observances (the solstice) get a nod inside a regular post, not a greeting. For a holiday that begins at sundown, post the morning it begins. Respect rules: objects, food, light and color, never religious garments as costumes; candles and letters drawn correctly (hanukkiah nine holders with the raised shamash and the right count for the night; kinara 3 red, 1 black, 3 green; dreidel nun, gimel, hei, shin); never claim themed puzzles on a day the app does not have them (`apps/web/data/holiday-days.json`).

**Season tie-ins:** take the dates from core `SEASON_WINDOWS` and the season tracker (`docs/design/brand/seasons/PLAYBOOK.md` section 0). Every season gets: a reveal post tied to the ship date (paused until the build is live), the holiday greetings, the season's palette on the series colors (section 4), season costumes on the cast, and a Cast Saturday or two with the new costumes. Season windows: Halloween Oct 9 to 31, Thanksgiving Nov 14 to 29, winter holidays Dec 1 to 26, New Year Dec 27 to Jan 2, then Valentine's (Feb 7 to 14), St. Patrick's (Mar 10 to 17), spring/Easter, July 4, back to school (see the season README).

**Releases:** each store release gets a post (what changed, shown not told) once it is live in both stores; check the release log (`WORDOCIOUS_BIBLE.md`) and the Studio release list (`STUDIO_RELEASES` in `lib/admin/studio.ts`). Paused until live.

**Launch-kit items:** Product Hunt day, press emails, founder LinkedIn posts, bios, and the one-pager live in `docs/marketing/jp45/` and `lib/admin/launch-kit.ts`; reuse and refresh them, do not rewrite.

**Video cuts:** `18 Days of Wordocious` episodes (one game each, finished in block 2), cast-led clips (`cast-scene.py`), season flips, in-app montages. Tooling: `docs/design/brand/social/jp45/video/` (`make-video.py` series template + end card + cover, `cast-scene.py`, `rigplay.py`, `build-jobs.py`). Videos stay out of git.

## 4. Making the images

Follow `docs/design/brand/social/jp45/STYLE.md` (the template) and `incoming/NOTES-FOR-RUNNER.md`.

1. **Brief.** One queue item per image in `incoming/full/queue.json` (`queue-block2.json` shows the format): id `<date>-<slot>-<n>`, `fmt`, `aspect`, `season`, `headline`, `sub`, `cast`, `refs`, `layout`, `notes`, plus a ready `prompt` and a `tab_group`. Layout rules: top 14 percent and bottom 9 percent are calm background only (the real wordmark and footer are overlaid in code); headline fully inside the middle 70 percent; Muddle and WOTD scenes leave an empty band or center for the content added in code.
2. **Freshness.** Rotate cast lineups, poses and group sizes (solo, duo, trio, four to six, full cast; never two full rows back to back on a channel); no fixed host per series; the same lineup never twice in a row on a channel; spread usage across all ten.
3. **Prompt.** Always attach: the canonical hero art for each character (`cast/hero/<id>.png`), the season costume art (`seasons/<season>/cast/<id>.png`), and one approved final of the same series as the layout and lettering example (ignore its season colors and props). The prompt names the exact headline and sub line, the setting, the costume per character, and ends with the DO NOT list (no wordmark, no footer, no extra text, no second copy of any character).
4. **Run.** Free ChatGPT in the MacBook Chrome, up to four tabs, one group each. Download full-size (1536x1024 or 1024x1536) to `incoming/full/<id>.png`. If the image limit hits, stop and note the reset time in the queue (block 1 hit it at about 23:00 CT and it reset at 9:56 AM).
5. **Finish.** From `docs/design/brand/social/jp45/`:
   - `python3 scene.py compare <id> <cast ids...>` (prep sheet of the candidate next to the hero art);
   - `python3 scene.py accept <id> --series <series> --y0 N --y1 N` (headline rows of the native scene only; recolors the headline to the season color; real wordmark and footer overlaid). Options: `--scale S --top T` (fit the scene so the headline top lands near y 120 landscape or 150 portrait), `--scale fill --top T`, `--content "wotd|WORD|note|1.2"`, `"cartoon|file|520"` or `"mystery|7"` with `--at cx,cy`, `--x0/--x1`, `--dil 4-5` on saturated skies, `--smin 0.6`, `--ex "x0,y0,x1,y1;..."` to exclude same-hue props, `--nl N` for stepped Cast Saturday bands;
   - `python3 scene.py reject <id> "<why>"` deletes the candidate and appends the redo request to `incoming/rejects.json`.
   Never run `compose.py` for the full build once scenes are accepted (it regenerates every composite and overwrites accepted finals).
6. **Vet (every image, logged in `manifest.json`).** (a) Every mascot cropped next to its hero/costume art: letter shape, colors, eyes, mouth and teeth, brows, limbs, proportions; W always friendly; S keeps angled determined brows; each character drawn exactly once. (b) The headline spelled letter by letter; no stray text; no emoji. (c) Season palette and series color right; no fringe or specks. (d) No puzzle answers; log any hint ("hint: none" or what subtle hint is shown). (e) The scene is not upscaled more than about 1.1x. (f) No bolted-on accessories: costumes sit on the body. (g) Cohesion: the contact sheet next to the previous block.
7. **Redo queue.** Rejects go to `incoming/rejects.json` with the exact reason; the next run redoes them first.
8. **Manifest.** Merge `manifest-block2.json`-style stubs into `manifest.json`, then fill `mascot_check`, `aesthetic_check`, `hint`, `series_color`, `source`.
9. **Storage.** The PNGs are git-ignored (`jp45/.gitignore`); finals go to the Art Library and the private `social-media` bucket; only tooling, queues, manifests and docs are committed. Attach with `node apps/web/scripts/social-attach.mjs <post-id> --portrait a.png --landscape b.png` (a version bump resets approvals).

Series colors per season are in STYLE.md (add each new season's column before the first accept; block 2 proposes the winter column).

## 5. Copy rules

- **Voice** (social-plan.ts PLAN_VOICE): no emoji; smack talk, never snark ("Your move."); never today's answers (yesterday's cartoon, a past word, today's empty grid); no competitor marks anywhere (the tests ban the names); American spelling (color, center, gray, neighbor); exact Pro prices only ($6.99 a month, $59.99 a year, about $5 a month, $1 day pass); "free" only where true (the core dailies).
- **Spoiler rule (founder 10-14):** subtle hints are fine (a partial tile, a cropped cartoon, a theme nod), never a dead giveaway: no full answer, no full anagram-and-answer pair, no full unplayed Muddle cartoon. Log the hint per image. The WOTD quiz word is the day's real Word of the Day and must not be a puzzle answer that day (the test checks every daily mode).
- **Shapes per platform:** X: caps title, blank line, one or two sentences (260 characters with the 23-character link; tags appended). Threads: the same, a little longer. Instagram: ends "Play free: link in bio." (no raw link). Facebook: one paragraph. Pinterest: one descriptive paragraph (about 250 characters) with the link in the pin field. TikTok/Instagram video: one caption ending "Play free: link in bio."
- **Hashtags:** `wordgames dailypuzzle wordocious` (plus `puzzlegames` off X); greetings use `#<holiday> #wordocious`; season posts add one season tag.
- **Tracked links:** every target has a `marketing_links` slug `p-<last 8 hex of post id>-<platform>`; the post's `link_target` is the page it lands on (home, `/guides/<slug>`, `/word/<past date>`, `/pro`). Product Hunt day retargets its slugs to the live listing.
- **Guardrails** (PLAN_GUARDRAILS): 13+ posture, label AI art where a platform asks, original audio only, no paid boosts yet, Reddit participation not promotion.
- Bracket placeholders (`[PLAYERS]`) only on paused posts; fill them from real data at approval time.

## 6. Loading into the Studio

1. **Data.** Posts live in a JSON in `apps/web/lib/admin/` (`jp45-posts.json`, `jp45-block2-posts.json`), same schema; a vitest file pins structure, budgets and brand rules (`jp45-block2.test.ts`). Run it.
2. **SQL.** The generator writes an idempotent file in `docs/sql/` (`social_posts`, `marketing_links`, `social_post_targets`; re-running only refreshes untouched drafts at version 1 with no review). Apply it yourself: `scripts/db-backup.sh` first, then libpq psql with the URL from `~/.wordocious-db-url` (never print it), then read back counts (posts, targets, links, paused). Mark the file header "APPLIED: date, backup id, read-back".
3. **Statuses.** `draft` until published, then `posted`, `partial` or `failed`. Targets: `pending`, `posting`, `posted`, `failed`, `skipped`. Holiday greetings and any post waiting on a fact, a capture, a build or a founder call are inserted `paused`; unpause only when the condition is met.
4. **Two approvers.** A post publishes only when BOTH BMT and JP have approved its current version. Any caption, hashtag or image edit bumps the version and resets both approvals ("Edited, needs re-approval"). Comments go to `social_feedback`; Claude reads `select * from public.social_open_feedback;` before every drafting pass.
5. **Controls.** Per-post **Hold** and the global **Pause all posting** stop publishing immediately. The publisher is `/api/cron/social-publish` (every 15 minutes), idempotent via the claim lock; failed targets retry with backoff and show the error.
6. **Auto-publish status (10-16).** The whole pipeline is built and DORMANT: nothing posts until an account is connected. Until then approved posts simply wait; nobody posts manually and no bots are used.
   - **X:** the founder loads about $15 of X API credits himself in the X developer console (about $0.20 per post that carries a link, roughly $10 to $12 for a 45-day plan; planned 10-17), then Studio > Accounts > Connect X and approves the OAuth screen.
   - **Meta (Facebook Page + Instagram):** needs a Meta developer account. The first signup (about 10-13) never received its SMS verification code; retry 10-16 evening. If SMS fails again, try a different number, the WhatsApp or email verification option, or wait 24 hours, and write down what worked in the log below. Then follow `docs/marketing/SOCIAL-CONNECT-CHECKLIST.md` (Instagram must be a Business account linked to the Page).
   - **Pinterest and TikTok:** connect through their own OAuth from the Accounts panel (TikTok posts land as drafts in the inbox until the app audit passes; the Business Center "ShowLoud LLC" exists and @playwordocious is linked).
   - **If an account disconnects:** the Accounts panel shows Not connected / last error; click Connect again (tokens are replaced in `social_accounts`); posts that failed stay `failed` with the error and can be retried after reconnecting; if it cannot be fixed that day, Pause all or Hold the affected posts so a half-posted day does not happen, and tell the founder.
7. **Account connection log** (add a row for every attempt):

| Date | Platform | Status | What worked / what failed |
|---|---|---|---|
| 2026-10-05 | Studio | built, dormant | Publisher cron + adapters live; no accounts connected |
| about 2026-10-13 | Meta developer account | failed | Founder's first signup never received the SMS verification code |
| 2026-10-16 (evening) | Meta developer account | **done** | Retry from developers.facebook.com/async/registration/: the SMS code arrived this time (same number). Email kept as bterchin@gmail.com, role Owner/founder. |
| 2026-10-16 (evening) | Instagram + Facebook Page | **CONNECTED** | Meta app **Wordocious Studio** (ID 2090705324895411, business portfolio Wordocious). Use cases: *Manage everything on your Page* + *Manage messaging & content on Instagram*; permissions added (all 'Ready for testing' — no App Review needed while we are app admins): pages_show_list, pages_read_engagement, pages_manage_posts, business_management, instagram_basic, instagram_content_publish. Gotchas: (1) the Facebook Login for Business **Valid OAuth Redirect URI** (`https://wordocious.com/api/admin/studio/callback/meta`) only sticks after pressing the page's **Save Changes** — the 'Changes saved' toast on Enter is not enough; verify with the Redirect URI Validator; (2) App settings › Basic needs **App domains = wordocious.com**, a **Website** platform (https://wordocious.com/), privacy + terms URLs, or the dialog says 'Can't load URL'; (3) env: META_APP_ID added by CLI; META_APP_SECRET added by the founder via `pbpaste | vercel env add META_APP_SECRET production` (secret never displayed); redeploy before Connect. Studio stores Facebook 'Wordocious' + Instagram '@playwordocious'. |
| 2026-10-16 (late night) | X | **CONNECTED** | Founder bought $15 of pay-per-use credits in the **X Developer Console** (console.x.com → Buy Credits; skip auto-recharge). X_CLIENT_ID/SECRET were already in Vercel. Connect → X's screen: tick **'I trust this app'** → Authorize app (as @wordocious). The app's default name was numeric ('2110…327wordocious'): renamed to **Wordocious Studio** + icon + description (Apps → pencil next to the name) so the approval screen reads properly. |
| 2026-10-16 (night) | Threads | **CONNECTED** | Meta app **Wordocious Threads** (separate app; Threads app ID 1448836647126567 — the *Threads* ID from Use cases › Threads API › Settings, not the main app ID). Permissions threads_basic + threads_content_publish; Redirect, Uninstall and Delete callback URLs all `https://wordocious.com/api/admin/studio/callback/threads` (pick the URL suggestion so it becomes a token, then Save, then reload to verify). Gotchas: (1) **@playwordocious had no Threads profile** → 'Invalid id' when adding the tester; the founder created it on threads.com ('Join using your Meta Account — playwordocious'); (2) add the tester by typing the username and **choosing the suggestion** (with the avatar), not just typing; (3) the tester accepts on **threads.com → Settings → Website permissions → Invites → Accept**. THREADS_APP_ID by CLI, THREADS_APP_SECRET by the founder's pbpaste one-liner; redeploy before Connect. Studio stores Threads '@playwordocious'. |
| 2026-10-16 (night) | Pinterest | waiting on Pinterest | App **Wordocious Social Studio** (ID 1624551, made 10-14) has the redirect URI; **the App secret stays hidden until Pinterest approves 'trial access'** (pending; usually days). When approved: copy the secret → `pbpaste … vercel env add PINTEREST_APP_SECRET production` → redeploy → Connect. PINTEREST_APP_ID already in Vercel. |
| 2026-10-16 (night) | TikTok | **CONNECTED (sandbox, drafts)** | The TikTok **developer** login is separate from the TikTok app and the Business Center. The first signup used bt@wordocious.com, which has no inbox we read, so the verification never arrived → re-registered on **bterchin@gmail.com**. Ownership = **Organization**: created **ShowLoud LLC** (org 7697454261814264853; the name can't be changed later — matched to the TikTok Business Center). App **Wordocious** (7697421110884501524); domain wordocious.com verified by URL prefix (file `apps/web/public/tiktok<code>.txt`). The Production draft can't even be saved without a demo video + explanation, so we connected through a **Sandbox 'Wordocious Studio'** (7697409094835882005): icon, Games, description, terms/privacy URLs, Web platform https://wordocious.com/, Login Kit redirect `https://wordocious.com/api/admin/studio/callback/tiktok`, Content Posting API (scopes user.info.basic + video.upload) → **Apply changes**. form_input on the Web checkbox doesn't register; real clicks do. **Target Users → Add account** must be the real TikTok *app* account **@playwordocious** (log in with that account's own credentials or the QR code from the phone app — the gmail developer login is NOT a TikTok app account: 'Account doesn't exist'). Sandbox client key `sbawjnj36h9ebhds54` (not secret) → TIKTOK_CLIENT_KEY by CLI; TIKTOK_CLIENT_SECRET by the founder's pbpaste one-liner; redeploy; Connect → approve as @playwordocious. Sandbox posts go to drafts only for target users. **Still to do:** record a short demo video of the Studio flow + write the explanation, submit Production for review, then swap TIKTOK_CLIENT_KEY/SECRET to the Production pair and reconnect. To add JP to the org he must first have his own TikTok developer account. |

8. **JP's access checklist (JP = Jasson Patterson, jp@pattersonlp.com — what JP does and what Brian does so JP is an admin everywhere):**

| Where | Status (10-16 night) | What JP does | What Brian does |
|---|---|---|---|
| Admin portal (wordocious.com/admin: Social Studio approvals, Seasons + Social playbooks) | confirm | Sign in to wordocious.com with jp@pattersonlp.com | Tell the lead to grant admin on that profile (one SQL flag, `profiles.is_admin`) |
| Meta business portfolio "Wordocious" (covers the Facebook Page, Instagram @playwordocious, and both developer apps: Wordocious Studio + Wordocious Threads) | to do | Accept the Meta Business Suite email invite (to jp@pattersonlp.com); for developer-app roles also create a Meta developer account at developers.facebook.com (SMS verify) | Meta Business Suite → Settings → People → Add → jp@pattersonlp.com → **Full control** (admin); then in each app's App roles confirm he appears |
| Threads @playwordocious | n/a | Nothing extra — Threads rides on the Instagram account; app access comes with the business portfolio | — |
| X @wordocious | blocked on JP | X → Settings → Privacy and safety → allow **Delegate** invites (so others can invite him) | Re-send the delegate invite from @wordocious (Settings → Account → Delegate) |
| Pinterest "wordocious" | invite sent 10-14 | Accept the Pinterest **Business Access / Manager** invite email | (Optional) Developer app "Wordocious Social Studio" → Collaborators → add his Pinterest email |
| TikTok Business Center "ShowLoud LLC" (@playwordocious linked) | invite pending | Accept the **Business Center admin** invite email (admins automatically get the linked TikTok account) | — (an email code to Brian is needed only when adding members) |
| TikTok developer organization (ShowLoud LLC, created 10-16) | to do | Create a TikTok **developer** account at developers.tiktok.com with jp@pattersonlp.com (required before he can be invited), then accept the member invite | Developer portal → Organization → Members → invite jp@pattersonlp.com |

Not needed for JP: Vercel, GitHub, App Store Connect, Play Console (ask Brian if that changes).

## 7. Measuring and the next block

- **KPIs** (PLAN_KPIS in `social-plan.ts`, checkpoints Day 15, 30, 45): posts published, combined followers, social-attributed installs and signups (admin Marketing, tracked links), referral redemptions from social CTAs, share rate (Weekly Five), videos over 5,000 views, press placements, Product Hunt. Targets are working numbers; the Week 2 Monday review re-bases them against actuals. A variance over 25 percent on installs or share rate gets a one-line written cause.
- **Monday review (30 minutes):** last week's tracked-link clicks per post (`/go` slugs), platform analytics, which series and cast posts won, which formats flopped, anything that broke (a failed target, a rejected image). Fill the KPI actuals. Kill rule: a series under 1 percent engagement across four consecutive posts is replaced; a video over 5x median views gets three follow-on variants within a week.
- **Feeding the next block:** the Monday notes and `social_open_feedback` decide the next calendar: promote winning series and formats, retire losers, rotate cast toward the characters that perform, and move the budget of effort accordingly. Write the numbers and the decisions into the block's Lessons entry.

## 8. Lessons log and the next-block kickoff

**Lessons from the block 2 image run (10-16 evening):**

- **ChatGPT's image limit is shared by every tab on the account:** two runners × 2 tabs made 34 images in about 20 minutes, then the whole account hit the limit (21:12 CT, reset ~13.5 h later, 10:40 AM). Plan a block's images across two sittings (about 30–35 per sitting) and put the time-critical posts (the next 7 days, holiday greetings) at the FRONT of the queue.
- **Landscape twins:** ask for the landscape version as a follow-up in the same chat as the portrait (same scene, same cast) instead of a fresh prompt — faster and the two stay consistent.
- **ChatGPT takes at most 10 attachments:** for 4–5 character scenes, attach one side-by-side sheet per character (hero + season costume in a single image) so every character still gets both references.
- **Rejects caught by the runners' own vetting:** a gift covering W's letter, mittens hiding I's letter (retry fixed it), a cream card drawn into the empty content band, and a Kwanzaa kinara with all seven candles lit on Dec 26 (day 1 = only the black center candle) — write candle counts and 'letter fully visible' into every holiday prompt.
- **Headlines drawn too high:** several scenes start the headline above the 14% calm band; fix at accept with `scene.py accept --scale/--top` (or ask for 'headline starting below the top fifth').

**Lessons from the first 45 days (blocks 1 and 2 prep):**
- Off-model mascots were the top reject: friendly raised brows on S (three scenes; S is the angry-determined one), R drawn twice in one scene, and a letter or costume drifting from the hero. Attach hero + costume art to every prompt and compare crops side by side.
- Spelling: "HALOWEEN" slipped through once; spell every headline letter by letter, and keep one canonical headline per queue item.
- Layout kills more scenes than art: the WOTD and Muddle scenes need an empty band or center (about 20 to 28 percent of the height, or the center 30 percent of the width) for content added in code; two redos each in block 1. Say it in the prompt (`layout`) and keep mascots small and low.
- Series color is fixed in code (`--series`, `--y0/--y1`); do not fight ChatGPT for the hue. Use `--x0/--x1`, `--ex` and `--dil` when floating tiles or a saturated sky eat the recolor.
- Dark scenes on light-season days get the light footer automatically (Day of the Dead night, Veterans night sky).
- Never run the full `compose.py` build after scenes are accepted; it overwrites them. The composite fallback only lasts until a scene replaces it.
- PNGs do not live in git (clones and Vercel deploys stay small); the Art Library and the `social-media` bucket hold finals.
- ChatGPT's Share button publishes a public link: one incident clicked it blind at a lightbox position; always screenshot, find by name, click by ref.
- The free ChatGPT image limit resets in the morning; queue holiday greetings first.
- Holiday greetings were added after the plan (founder 10-15): plan them from the start, with their own SQL ids (`uuid5(URL, 'wordocious.com/jp45/holiday/<date>')`).
- Season builds slip; keep reveal posts paused until the build is live in both stores.
- The app's themed-puzzle days (`holiday-days.json`) do not always match the real holiday date (Kwanzaa is mapped to Dec 27, it begins Dec 26): check before a caption claims "today's themed puzzles".

**Next block kickoff checklist (block 3, Dec 28 to Jan 24: New Year to Valentine's lead-in; plan it Mon Dec 14):**
- [ ] Read the Monday reviews for Dec 7 and Dec 14, the KPI tab, and `social_open_feedback`.
- [ ] Season tracker: New Year (Dec 27 to Jan 2) art status (party hats, confetti, countdown; none built as of 10-16) and Valentine's (Feb 7 to 14) art start date (D minus 6 weeks = Dec 27). Add both columns to STYLE.md before the first accept.
- [ ] Holidays in window: New Year's Eve (Dec 31, a themed puzzle day), New Year's Day (Jan 1; Kwanzaa ends), MLK Day (Jan 18; confirm it is a themed day), Epiphany/Lunar New Year only if the app has them (check `holiday-days.json`). Apply the greeting rule to each real one.
- [ ] Wrapped / year in review: only if the feature shipped; otherwise a gratitude and "your year" post with no numbers.
- [ ] Resolve the block-2 founder calls (Kwanzaa day, Wrapped, winter build date).
- [ ] 2.9 and later releases: any new feature worth a post.
- [ ] Copy the block-2 generator pattern (`b2_data.py`, `build-block2.py`, `b2_head.md`) to `b3_*`, regenerate, run the vitest file, produce the queue and SQL, backup, apply, read back.
- [ ] Reset the Day-N wrap and KPI checkpoints for the new block; refresh `PLAN_WINDOW` and `PLAN_PHASES` in `social-plan.ts` and the tracker above.
- [ ] Account log (section 6): confirm every platform is connected before approving week 1.
