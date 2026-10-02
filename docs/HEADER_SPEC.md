# Headers, menus and icons with the cast's personality (founder, 2026-10-02)

Founder (screenshot of the home header: "WORDOCIOUS" text, PRO pill, ?, gear, 🔥81, 🏆2,
🛡68): "draping the cast across the whole top of the main screen … getting rid of the
wordocious pro part and incorporating a cast image for the title for the pro and premium
versions … all of the other buttons at the top stylized by our aesthetic and chatgpt
design. Even the streak flame I want some personality … many streak flames across the app
… consolidate the overall look" → "All the headers and menus on the app should also fit this
personality so it's cohesive." Builds on docs/MASCOT_SPEC.md. Parity ×3.

## 0. Icon set (ChatGPT-designed, same 3D style as the cast; 256 px transparent)

`docs/design/brand/icons/` → web `apps/web/public/icons3d/<name>.png`, iOS image sets
`icon3d-<name>`, Android `drawable-nodpi/icon3d_<name_with_underscores>.png`:
`flame` (the streak buddy with a face), `trophy` (with a face), `shield`, `gear`, `help`
(purple-pink ?), `crown` (gold), `tab-home`, `tab-leaderboard` (podium of tile buddies),
`tab-stats` (bars), `tab-friends` (two buddies). One shared `Icon3D(name, size)` per platform.

## 1. Home header

- Row 1, full width: the **cast title** — the ten mascots (docs/MASCOT_SPEC.md §0 art) side by
  side in WORDOCIOUS order, tightly packed with a slight overlap (each ~36 pt tall, ~8%
  overlap, bottoms aligned), centered, tappable to nothing. It replaces the WORDOCIOUS text
  and the PRO pill. A gentle one-time hop wave on first appearance (Reduce Motion: none).
- **Pro / premium**: W wears the `crown` icon (~45% of W's width) on its top edge, and the
  row sits on a soft gold glow line beneath (`#f59e0b` at ~25%, 2 pt, blurred). Free: no crown,
  no glow. That is the only Pro marker in the header.
- Row 2: three stat pills on the left — streak (`flame` + current daily streak), trophies
  (`trophy` + count), shields (`shield` + count) — and two round icon buttons on the right —
  help (`help`) and settings (`gear`). Pills: white, radius 999, soft shadow, NO borders, icon
  20 pt + number 15 / 900 in the stat's ink (streak `#c2410c`, trophy `#92400e`, shield
  `#5b21b6`). Buttons: 38 pt white circles, soft shadow, icon 22 pt. Same taps as today.

## 2. Consolidate the icons app-wide

- Every streak flame (banner row streaks, Today card, Stats, Friends rows + friend streaks,
  VS record, weekly race, puzzles streaks, streak modals, toasts) uses `flame` at the local
  size (12–24 pt). Replace lucide Flame / emoji 🔥 / custom SVG flames.
- Every trophy/record trophy icon → `trophy`; every shield (streak shields) → `shield`;
  every crown (Flawless, last-week winner, Pro) → `crown`; settings gear → `gear`;
  help → `help`. Keep text emoji in user-facing copy only where it's part of a sentence.
- Medal discs (1/2/3) stay as they are.

## 3. Menus: the tab bar

- Tab icons: `tab-home`, `tab-leaderboard`, `tab-stats`, `tab-friends` at 28 pt. Selected:
  full color, a small lift (−2 pt) and the label in `#7c3aed` 900; unselected: the same
  icon at 45% opacity with 60% saturation and a grey label. Badges stay (numeric).

## 4. Every page header (cohesive)

All page/screen headers share one header style: the page title in caps 900 with the
purple→pink gradient (or the page's accent where one exists: VS teal, Friends pink,
Leaderboard gold), the page's host mascot (MASCOT_SPEC §1/§6) beside it, the back/close
control as a soft white circle with the icon in `#6d28d9`, and any right-side actions as the
same white icon circles using the icon set. Applies to: Home (§1), Leaderboard, Records,
Stats, Friends, VS lobby/pages, Settings, Pro, Help/Guides, game screens (title + game host),
profile pages, sheets' headers.

## 5. One host per page (parity fix after the mascot pass)

Where a page's banner already has its host peeking over it (VS, Friends, Leaderboard,
Records, Home), the page title row does NOT repeat that host: the title keeps the gradient
caps style and the banner host is the page's host. Web already does this; iOS and Android
drop the duplicate VS BATTLE / FRIENDS title hosts. The Leaderboard day title art (one
designed graphic per weekday) is a separate pass, so leave the Leaderboard banner title as is.

## 6. The Friends tab wears the app header (founder, 2026-10-02)

"Rework the friends page so it never loses the header like the rest of the pages have and
lose the Friends title." The Friends tab hosts the §1 home header exactly like Home,
Leaderboard, Stats and Records (iOS: `AppHeaderView` pinned above the scroll; Android: the
shell's shared `AppHeader`; web: `<AppHeader />` atop the page, as on /daily, /stats,
/records). The FRIENDS title row is gone; its bell and add-friend circles sit in a compact
right-aligned row atop the content, above the Friends banner. The leading space of that row
(and the STATS title spot on Stats) is where a future image title will go. The iOS Friends
screen pushed from a profile or the empty Friends board keeps its nav-bar FRIENDS title.
