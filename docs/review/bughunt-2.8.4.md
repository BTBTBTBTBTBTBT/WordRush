# Bug hunt: 2.8.4 (29b806b9f..357ca8f3b)

Read-only review of everything that went into 2.8.4 since 2.8.3 (`git diff 29b806b9f..357ca8f3b -- apps packages`, docs / social art excluded). Line numbers are from the committed revision 357ca8f3b (the working tree has unrelated share-card edits in flight in `FinishPages.swift`, so its live line numbers drift by ~28). Tablet / web-desktop layout differences are intentional and are not reported. Suggested fixes are the smallest safe change; anything that would visibly change the look is marked **needs founder approval**.

## Findings, by severity

### 1. Medium: Android podium draws the #1 mascot in a box narrower than it asks for (feet float, winner 8% smaller than spec)

- `apps/android/app/src/main/kotlin/com/wordocious/app/ui/BoardPodium.kt:234` sizes the gold figure at `w * 0.36`, but `:258` sets the gold column `colW = NAME_WIDTH_GOLD (0.33) * w`, and `:293-294` measures the whole column with `Constraints(maxWidth = colW)` + `.width(colW)`.
- `PlayerAvatar` → `LivingMascot` lays out with `Box(modifier.size(size))` (`LivingMascot.kt:292`), which `Modifier.size` coerces into the incoming constraints, so the winner's box becomes `0.33w x 0.36w`. `MascotComposer.drawLive` (`MascotComposer.kt:327-346`) then draws the figure at `size.minDimension` (0.33w) anchored at the box's top-left.
- Scenario: any board whose #1 is a standing mascot. The mascot is drawn 0.33w instead of 0.36w, and its feet end `0.03w` above the column bottom (about 11 dp on a 360 dp phone stage, 20 dp on the 680 dp tablet stage) before `CHEER_FEET_DROP` is applied. The glow (`matchParentSize`, centered in the non-square box), the `HEAD_TOP` name spacer (`:318`, computed from the 0.36w figure) and the headroom (`:240-243`) all assume the 0.36w box. `CHEER_FEET_DROP = 0.19` ("measured on the emulator", `:144`) most likely absorbed the phone error, which is why it looked planted in review; the tablet error is nearly twice as large, and any later retune of the drop will chase a phantom.
- Fix (1-2 lines): measure the column wide enough for the figure, e.g. in `:293` pass `maxOf(colW, figure.roundToPx())` to `anchoredBottomCenter` and drop `.width(colW.toDp())` (keep the name's own width via `PodiumNameAbove`'s modifier), or give the figure `Modifier.requiredSize(figure)`. Then re-measure `CHEER_FEET_DROP` on the emulator. **Needs founder approval**: the gold mascot grows ~9% and lands lower.

### 2. Medium (perf): iOS podium decodes mascot part PNGs on the main thread during layout

- `apps/ios/Wordocious/Sources/FinishPages.swift:997-1013` (`PodiumFigure.bounds`) runs inside `PodiumPlace.body` (`:862`) and calls `MascotArtCache.inkTop($0.art)` for every non-arm layer.
- `apps/ios/Wordocious/Sources/MascotAvatar.swift:84-103` (`inkTop`) is synchronous: on a cache miss it calls `uiImage(name)` (`:64-71`, `preparingForDisplay()` = a full decode) and draws a 128-row alpha thumbnail. The launch prewarm (`:104-120`) only covers the default avatar, the four cast presets and the crown head per body.
- `LivingMascotView.swift:137` deliberately decodes the same parts on a global queue, so this is the one path in the podium that decodes on main.
- Scenario: a Leaderboard / Yesterday / Friends-race / Records podium whose standing players wear anything outside that set (a witch hat, glasses, a beanie: most real players). The first frame that shows the podium decodes up to ~10 part PNGs on main inside `body` (perf gate: "image decode on main"). Steady state is fine (cached per name), and `PodiumPlace` re-evaluates on every `AvatarDirectory` change so the miss can also land mid-scroll when a lookup lands.
- Fix (2-3 lines): add a non-decoding `MascotArtCache.cachedInkTop(name) -> Double?` (same lock, no `uiImage`), use `cachedInkTop(art) ?? PodiumArt.headTop` in `bounds`, and have `inkTop` run on the utility queue when it misses (the name settles one frame later, 4-10 pt). Alternatively prewarm the podium entries' layers when the board rows arrive, before `PodiumView` appears.

### 3. Low: the Halloween stage card shows a different cast in Unlimited on each platform

- iOS `HomeBannerView.swift:291-317` (`stageCast`): in Unlimited (`!slots.showsMomentArt`) the trio is hidden and U stands in the middle pool (the "Unlimited U clear of the meta line" change).
- Android `HomeBannerView.kt:143-147`: in Unlimited the `else` branch picks the costumed O, W, R trio; no U is drawn in stage mode (the U band lives only in the non-stage branch, `:155`).
- Web `home-banner.tsx:593` + `:623`: `stageTrio` falls back to `HALLOWEEN_TRIO` in Unlimited and the U-loop box is hidden under `!stage`.
- Scenario: flip the Home switch to Unlimited during Halloween: iOS shows U on stage, Android and web show the Halloween trio. Fix: Android / web mirror iOS (draw U at the middle pool when `unlimited`), or iOS keeps the trio. **Needs founder approval** (which cast he wants in Unlimited).

### 4. Low (parity): an un-started Friends race crowns the gold step on iOS / Android, not on web

- Web `podium.tsx:229` honors `crown: started` (`friends-panel.tsx:393`): no crown hat, no sparkles until someone has points.
- iOS `FinishPages.swift:1017-1020` always swaps the gold step's hat to the crown and `:888-902` always plays the glow + sparkles; `FriendsPanelView.swift:1213` already computes `raceStarted` but `PodiumView` has no way to receive it. Android `PlayerAvatar.kt:80-83` and `BoardPodium.kt:331` likewise always crown place 1.
- Scenario: Monday morning, friends with 0 pts: the first listed friend wears the crown and gets the winner intro on iOS / Android, while web shows a plain podium. Pre-existing for the crown icon in 2.8.3; the new hat swap + glow + sparkles make it louder. Fix: add `crown: Bool = true` to `PodiumEntry` (iOS) / `BoardPodiumSpot` (Android), pass `raceStarted`, and skip the head swap, icon crown and intro when false.

### 5. Low: Word Chain tile width has no floor (negative frame / font size on a zero-width pass)

- `apps/ios/Wordocious/Sources/FriendlyGameScreen.swift:1536-1539`: `t = min(30, (geo.size.width - gap * (n - 1)) / n)`; a 0-width proposal (a `GeometryReader` measured during a transition or an ideal-size pass) gives a negative `t`, which reaches `.frame(width: t, height: t)` in `PocketTile` (`PocketArt.swift:138`, SwiftUI logs "Invalid frame dimension" per tile) and `Brand.font(width * 0.52)` (`:134`). No crash observed in code, but it is undefined input. Fix: `let t = max(8, min(30, ...))`.

### 6. Low: web Home now hydrates with a different game order than the server rendered

- `apps/web/lib/game-order-store.ts:65-82`: before auth resolves, `userId = cacheUser()` and `local` reads `localStorage` on the first client render, so a signed-in player with a saved order gets their order on the hydration render while the server HTML (no `window`) carried the default order. `useSeason` (`season.ts:197-205`) deliberately returns `null` on the first client render "so hydration matches"; this hook now breaks that rule. React recovers by discarding the server markup and client-rendering the root (console: "Hydration failed…" in dev, error #418/#423 in prod), so the visible result is right but SSR is thrown away on every load for those players.
- Verify: open `/` signed in with a custom order and check the console. Fix options are a trade-off (gating `local` behind a `useSyncExternalStore` hydrated flag restores SSR but brings back a one-paint re-sort), so this is a decision, not a one-liner. **Needs founder approval** if the re-sort returns.

### 7. Low: "+N more" fold copy differs on iOS

- iOS `FriendCardsView.swift:236` reads "Show fewer"; Android `FriendCardsView.kt:173` and web `friend-cards.tsx:231` read "Show less". All three accessibility labels say "Show fewer games". Fix: pick one string ("Show fewer" matches the a11y label).

### 8. Low (perf): Android friend-card `FitText` shrinks by trial recomposition

- `apps/android/app/src/main/kotlin/com/wordocious/app/ui/friends/FriendCardsView.kt:229-236`: each overflow lowers `scale` by 0.05 in `onTextLayout`, so a long game word in a narrow column recomposes that `Text` up to 14 times on first layout (two `FitText` per row, three rows per card). Fix: compute the ratio in one step from the layout result, e.g. `scale = (scale * it.size.width / it.multiParagraph.maxIntrinsicWidth).coerceAtLeast(minScale)` (1 line).

## Checked and found clean

- Core `PODIUM_ART` / `CELEBRATION_STAGE` / `PODIUM_WINNER_INTRO` and the Swift / Kotlin ports: every constant matches; `podiumWinnerHead` keeps crown / minicrown / tiara on all three.
- Crown slot vs rank ties: all three platforms crown the gold STEP (entry index 0), never a tied rank, so a 1-1-3 board looks the same everywhere; `tone` still follows rank for the stage card.
- Open spots: iOS, Android and web all draw "Open spot · Claim #N" from `podiumLayout`; empty races return early on Android (`FriendsPanel.kt:583`, `:809`), iOS (`podium.isEmpty ? [] : …`) and web (`Podium` returns `null` when `slots` is empty), so no stage shows three empty clouds.
- `GameOrderStore` x3 session-restore paths: iOS `init` + `bind` were walked through restore-ok, restore-fails (profile nil / `isLoading` false), offline keep-signed-in, sign-out and account switch; `bind(nil)` while `isLoading` keeps the launch order and `fetchedFor` prevents a second fetch. Android `bind` is idempotent inside `remember(orderUserId)` and the cached profile row is set synchronously in `AuthService` init before Home composes. Web mirrors the profile row to local storage without a bump loop.
- Home headline slot: the two-line reference on iOS (`headlineReference`), Android (`reserve`) and web (`headlineReserveHeight`) is width-based (one lettering size per width), so a 3-line long-username headline only grows the slot once, from frame 1, never on a later headline change.
- Halloween stage art: iOS `StageArtLayer` lays out from the zone size (bitmap decoded off main, fades in); web `StageFrame` keeps hooks before its early return and fades the image in; Android uses `artPainter` with cover-fit; `useSeason` reads in a layout effect so the card never grows on load.
- Winner intro: transform + opacity only on all three; Reduce Motion rests the glow and hides sparkles (iOS `calm`, Android `WTheme.calmMotion`, web `prefers-reduced-motion`); iOS `asyncAfter` state writes are harmless if the view is gone.
- Dynamic Type / long usernames: podium names use fixed sizes with a 0.3 min scale on all three; Android `CappedFontScale` guards the stage; Friends chips use `fixedFont` / `FixedFont` / px; web `FitLine` and `BubbleOneLine` use `ResizeObserver` on a transform-free box (no observe loop).
- Yesterday ledge placeholders keep the podium's exact aspect on iOS; Android `heightIn(min)` only grows.
- Friends cards: 0 games → start strip; 1-3 games → rows; 4+ → "+N more" fold on all three; resign confirm stays inside the row; `NudgeAllButton` sends one taunt per slacker and reports the count; the nudge row draws up to 4 faces.
- LANCE allowlist: `scripts/data/name-word-allowlist.txt:72` carries LANCE and `widen-acceptance.mjs` exempts only the names blocklist; LANCE now appears in the regenerated `hub-puzzles.json`.
- No force-unwraps added on the new paths (`PodiumArt.step` clamps its index; `podiumArtStep(...)!` only receives 1-3 from `PODIUM_ART_ORDER`).
