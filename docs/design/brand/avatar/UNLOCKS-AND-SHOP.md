# Mascot unlocks + item shop (founder 10-05 — plan, not started)

"Mascot items unlocking when certain things are achieved… rare items only attainable by purchasing… or by getting a
certain puzzle at a certain time, a certain streak… when clicking on the item, it tells you that it's locked (with a
ChatGPT image) and explains you can purchase it or unlock it by (way)… a ton available for purchase or earn…
incorporate items we've already built and make new ones that make people want to pay or spend time."

## How an item can be owned
Every item gets an `access` rule in avatar-parts.json (core-validated, mirrored ×3):
- **free** (today's default) · **pro** (today's PRO tag) · **season** (free in its window, kept if saved — built)
- **earn** — one or more unlock conditions (below); once earned it's yours forever
- **buy** — a direct purchase (no random packs, ever)
- **earn OR buy** — the main model for rare items: grinders earn it, impatient players buy it
- **limited** — earnable/buyable only in a window (holiday, event), then retired (returns rarely, if ever)

## Unlock conditions (data, checked server-side, tied to Stats/Moments)
- Streaks: 7 / 30 / 100 / 365-day play streak; sweep streaks
- Feats: Classic in 2 guesses; flawless Daily Sweep; Gauntlet without a miss; all 18 games in a day; pangram ×10
- Timed puzzles: "solve the Daily before 7 AM", "the Friday-the-13th puzzle", "the Halloween night puzzle",
  "the 1-year anniversary puzzle", a secret word of the week
- Social: beat a friend 10 times, win 25 VS, gift Pro, refer a friend (referral program tie-in)
- Bots ladder: beat Webster (boss) → his monocle
- Collections: earn all items in a set → a set bonus item (completionist hook)
- Achievements: many existing achievements grant an item (badge + wearable)
Server is the source of truth (no client-side unlock hacks); unlock = a row in an owned-items table, synced ×3.

## The locked-item experience
- Locked tiles show the item dimmed with a small lock tag (ChatGPT lock art, family style) — never hidden, so
  people see what they could get.
- Tap → a "Locked" card (ChatGPT illustration: the cast member peeking at the item behind a velvet rope / in a
  gift box), the item on the mascot as a live PREVIEW (try it on!), and the ways to get it:
  "Earn it: keep a 30-day streak (you're at 12 — 18 to go)" with a progress bar, and/or "Get it now: $1.99".
- Unlock moment: a celebration popup (confetti, the mascot wearing it, the unlock sound) and it lands in Moments.

## Purchases (needs its own decision pass)
- Apple / Google require in-app purchase for digital items inside the apps; the web can use Stripe. One
  server-side owned-items ledger so a purchase on any platform shows up everywhere.
- Two shapes to choose between (founder decision):
  A) **Direct buy per item / per set** (non-consumable IAP; simplest, most transparent), or
  B) **A soft currency** (e.g. "Word Coins": earned slowly by playing, sold in bundles) that buys items —
     more flexible, more "consumable" feel, but more economy design + store review scrutiny.
- Pro members: a monthly free item or a discount (keeps Pro valuable).
- Guardrails: all-ages audience → no loot boxes / random paid packs, clear prices, parental-gate-friendly
  purchase flow, restore purchases, no pay-to-win (cosmetic only).

## Catalog plan
- Re-tag existing items: some become earn / earn-or-buy rares (e.g. crowns, golden chain, rainbow mohawk,
  supercape, the Halloween witch hat after the season = "limited").
- New premium lines: metallic + glitter variants of favorites, animated items (sparkle trails, glowing halos —
  ties into the rig), legendary sets (Royal, Space, Ocean, Dragon), team jerseys' pro templates, rare buddies
  (golden capybara, tiny dragon), rare letter finishes (gold, rainbow, glitter), rare poses/dances (ties to
  "earned moves").
- Target: dozens to start, growing every season (the season pipeline already ships items as data).

## Order (later, after the mascot round)
landmark system → new bodies/hair/etc. → access rules + owned-items ledger + locked UI → earn conditions (wire to
Stats/Moments) → purchase model decision (A vs B) + IAP/Stripe → catalog expansion. Lock/unlock art via ChatGPT.
