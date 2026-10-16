# App size review (2026-10-16)

Founder ask: "look into different ways to make the app smaller in size and/or image compression without degradation to aesthetic or flow." Analysis only; no app code changed. Evidence files live next to this report (`crops/`, `trial_fast.json`).

## 1. Where the bytes are

### iOS (last export: `apps/ios/build/export/Wordocious.ipa`, 2.8.4 build 264, 190.7 MB)

| Component | Size | Share of what the store ships |
|---|---|---|
| `Assets.car` (3,537 images, all lossless `deepmap2`) | **160.0 MB** (167.8 MB on disk) | ~84% |
| App binary `Wordocious` (arm64, Swift + Supabase/Sentry/IronSource/Socket.io/GoogleSignIn statically linked) | 30.0 MB (packs to roughly a third) | ~10% |
| `word-definitions.json` + puzzle banks (12 JSON files) | 7.0 MB raw (zip-packed to ~1.6 MB) | ~1% |
| Widget + push PlugIns | 4.5 MB | 2% |
| Fonts (Nunito) + 55 AAC sfx | 0.8 MB | <1% |
| `Symbols/` | 94.9 MB in the export only; App Store strips it, not downloaded | 0 |

Catalog facts that matter:
- Every one of the 3,633 imagesets is single-scale ("universal", no 1x/2x/3x duplicates). Good: app thinning has nothing left to remove.
- actool compression is the default (`automatic` = lossless deepmap2). No imageset sets `compression-type`.
- Inside the catalog by family: **art-av (avatar maker) 41.3 MB / 2,488 images (30%)**, art-titlecast 22.1 MB / 88, art-scene 12.7 MB / 25, art-pose 9.0 MB, art-ach 7.8 MB, art-pocket 5.6 MB, art-game 5.3 MB, art-title 4.3 MB, buttons + labels 4.9 MB, podium/gopro/mascot/badge/day/moment 10 MB, seasonal (halloween/dress/pumpkin/witch) 10.8 MB.
- Largest single images: art-podium-stage 1536x1024 (2.05 MB PNG), art-celebration-stage-halloween 1586x992 (1.46 MB), the art-scene-* set at 900-1200 px (0.7-1.2 MB each).
- Source PNG total 201 MB; 3,482 are RGBA, 1 is RGB (art-celebration-stage-halloween) and 2 RGBA files are fully opaque (art-pocket-coin-backdrop, art-pocket-rps-backdrop). This matters for recommendation 1.

### Android (last release bundle: `app-release.aab` 229, 67.5 MB; Play warned the bundle grew)

| Component | Raw | Packed (what Play actually downloads) |
|---|---|---|
| `res/drawable-nodpi` (3,475 WebP + 78 PNG) | 45.5 MB | **45.4 MB** (WebP does not zip; ~82% of download) |
| dex (2 files) | 14.8 MB | 6.7 MB |
| assets (word-definitions.json 4.5 MB, avatar-parts.json) | 6.6 MB | 1.6 MB |
| root/data puzzle banks | 2.9 MB | 0.8 MB |
| native libs (per ABI, split by Play) | 1.2 MB | 0.4 MB |
| sfx raw, font, mipmaps | 1.2 MB | 0.8 MB |
| `BUNDLE-METADATA` R8 map | 131.8 MB / 8.9 MB packed | not shipped to users |

Android facts:
- Art is already lossy WebP from `docs/design/brand/ship-art.py` (q86 for cast / q92 for the rest, method 6). 3,440 files are VP8X+ALPH+VP8 (lossy with alpha), 32 plain VP8, 3 lossless.
- R8 minify + `shrinkResources` are on; `res/raw/keep_*.xml` whitelists keep the dynamically-named families (art_av_*, rigs, seasonal), so shrinking removes almost nothing from art, by design.
- `drawable-nodpi` is the right bucket for this art (scale-independent, drawn to fit), so Play density splits cannot help; there is one copy per device already.
- The 78 remaining PNGs (mascot_*, bot_*, bubble_*) are 3.67 MB; the same art as WebP q92 = 0.93 MB.
- By family: art_av 16.5 MB, art_titlecast 5.9, art_scene 3.2, art_title 2.8, art_pose 2.5, mascot 2.0 (PNG), art_ach 1.8. Seasonal 3.1 MB.
- Estimated Play download today: ~55 MB; install ~70 MB.

### Web (`apps/web/public`, 104 MB, served per page, not an install size)

- `art/` 50 MB (3,926 WebP, same files as Android), `muddle/` 30 MB cartoons (content-hashed, long-cache), `banks/` 15 MB JSON.
- Art is served as plain `<img src="/art/...webp">` (140 uses); `next/image` is used only for Supabase/wiki images. No AVIF, no responsive sizes. Only the pages that use a given art file pay for it, so this is a page-weight topic, not an app-size one.

### Cross-platform duplication

- The same master art is exported three times (iOS PNG, Android WebP, web WebP) by `ship-art.py`; that is by design and each platform ships only its own copy.
- **Exact duplicates inside each platform:** 94 groups on iOS (4.6 MB of PNG, ~3 MB in the car), 104 groups on Android (1.25 MB). All are avatar "pet" accessories exported once per body shape even though the pet does not change with the body (e.g. `art-av-acc-puppy-{egg,bunnyear,can,moon,potato,cone,...}-pet` are byte-identical x11).
- **Unreferenced candidates (iOS):** 81 imagesets, 1.9 MB raw, almost all `rig-*` parts (the old W/O1/D/S rig engine), 4 `bot-*` portraits, `art-pocket-chain-connector`, `art-pocket-ttt-board`, `game-more`. Found by scanning every Swift/TS literal and prefix construction; rigs may be built from string pieces, so confirm in the rig code before removing. 2,774 names are referenced literally, 629 by prefix construction.

## 2. Compression trials (measured)

Method: representative sample (stage/podium, celebration stage, scene banners, title cast, poses, avatar bodies/eyes/mouth/accessory, pocket backdrops, mascots, button labels, bubbles, badges). Each candidate was decoded back and compared with the source PNG composited over the app's dark purple and over a light background: SSIM (gaussian window, luminance, worst of the two backgrounds), PSNR, alpha PSNR. 3x zoomed crops of the worst 96-px window per image, with an 8x-amplified difference panel, are in `crops/<asset>__<format>.png` (original | candidate | diff).

### 2a. Aggregate over the small/medium sample (15 assets, 3.1 MB of PNG; per-asset numbers in `trial_fast.json`)

| Format | Size | vs PNG | SSIM min / mean | PSNR min / mean |
|---|---|---|---|---|
| WebP lossless | 2.62 MB | 84% | 1.000 | - |
| WebP q90 (alpha lossless) | 0.51 MB | 16% | 0.990 / 0.995 | 25.8 / 40.5 |
| WebP q85 | 0.43 MB | 14% | 0.985 / 0.993 | 25.7 / 39.7 |
| WebP q80 | 0.39 MB | 12.5% | 0.982 / 0.991 | 25.7 / 39.1 |
| HEIC q80 (ImageIO via sips, alpha kept) | 0.44 MB | 14% | 0.989 / 0.995 | 24.5 / 38.6 |
| AVIF q65 | 0.37 MB | 12% | 0.972 / 0.989 | 25.6 / 38.2 |

Lossless PNG re-optimization (Pillow level 9) and lossless WebP save only 10-30%: these PNGs are already well packed and the content (painted gradients, grain, glows) is not lossless-friendly. Only lossy formats move the needle.

The most delicate pieces keep SSIM >= 0.99 at HEIC q80 / WebP q90: art-av-body-bat 0.997/0.996, mascot-w 0.996/0.996, art-pose-w-cheer 0.996/0.995, art-av-eyes-happy 0.995/0.994, art-pocket-ttt-grid 0.995/0.995. The lowest scores are tiny UI pieces (bubble-a 0.989/0.990, art-btnlabel-play 0.993/0.992) where the window is dominated by a hard-edged outline; the crops show no visible change at 3x zoom.

### 2b. Large hero art (podium stage, celebration stage, flawless star, pro crown, sweep banner, VS face-off)

Crops reviewed: `art-podium-stage__heic-q80`, `__webp-q85`, `art-scene-flawless-star__webp-q85`, `__heic-q80`, `art-celebration-stage-halloween__webp-q85`, `art-scene-vs-faceoff__heic-q80`. At 3x the glossy stage gradient keeps its grain, facet edges on the star stay crisp, the glow around the celebration cast is intact; the amplified diff shows only sub-visible noise and thin edge halos. AVIF q65 and WebP q80 begin to smooth the stage grain and are not recommended for hero art.

### 2c. The real iOS test: actool `compression-type: lossy` on the whole catalog

Rather than guessing from HEIC files, the full `Assets.xcassets` was copied, every imageset's `Contents.json` given `"properties": {"compression-type": "lossy"}`, and compiled with the same actool (`--platform iphoneos --minimum-deployment-target 16.0`). 0 errors, 69 s.

| | Lossless (shipped) | Lossy | Saved |
|---|---|---|---|
| `Assets.car` | **167.8 MB** | **49.75 MB** | **-118 MB (-70%)** |
| art-av | 41.3 | 12.8 | -69% |
| art-titlecast | 22.1 | 5.4 | -75% |
| art-scene | 12.7 | 2.4 | -81% |
| art-pose | 9.0 | 2.5 | -72% |
| art-ach | 7.8 | 2.1 | -73% |
| art-pocket | 5.6 | 1.8 | -68% |
| art-title / art-game / buttons / podium / mascot | 17 | 4.8 | -72% |

actool encodes the 3,516 alpha images as **HEVC (HEIF)** and the 3 fully-opaque images as `lzfse/RGB555` (15-bit color: banding risk on gradients). The three (`art-celebration-stage-halloween`, `art-pocket-coin-backdrop`, `art-pocket-rps-backdrop`) should stay lossless or be exported with an alpha channel so they take the HEVC path. Sample-catalog check for reference: 17 imagesets lossless 7.6 MB -> lossy 2.75 MB -> `gpu-optimized-smallest` (ASTC) 4.0 MB; ASTC is both bigger and visibly blockier, not recommended.

Estimated App Store download after this: catalog ~160 MB -> ~45 MB, i.e. roughly **190 MB -> ~70 MB** total.

### 2d. Audio and JSON

- 55 sfx, AAC mono 44.1 kHz at 47-98 kbps, 0.5 MB in total. Not worth touching.
- `word-definitions.json` 4.53 MB: minify saves nothing (already compact), gzip takes it to 1.08 MB, which is what the IPA/AAB zip already does on the wire. Install footprint could drop ~3.4 MB per platform by shipping it gzipped and inflating on first use (or moving it to SQLite); download would not change. Low priority.

## 3. Structural options

| Option | Effect | Verdict |
|---|---|---|
| iOS on-demand resources / seasonal packs | Seasonal art is 10.8 MB lossless, ~3 MB after lossy; Android seasonal 3.1 MB | Not worth the offline/first-launch and review complexity once lossy is in; instead retire each season's art from the bundle after it ends |
| iOS scale variants | None shipped (all single-scale) | Nothing to do |
| Ship Android's WebP files on iOS (native WebP decode since iOS 14) | Catalog 160 MB -> ~42 MB | Bigger code change (every `Image("art-...")` goes through a loader, no catalog caching, software decode). actool lossy gets about the same size with no code change; prefer it |
| Android density splits | nodpi art is one copy already | Nothing to do |
| Android App Bundle / R8 / shrinkResources | On; keep lists intentionally retain dynamic art | Nothing to do |
| Android Play Asset Delivery (on-demand) for avatar maker or seasons | art_av 16.5 MB could move to an install-time or on-demand pack | Install-time packs do not shrink download; on-demand breaks the avatar maker offline. Not recommended |
| Debug-only assets in release | None found in either app (test fixtures live under `Tests/`) | Nothing to do |
| Avatar canvases: 640x640 with the body covering a median 20% of the canvas (accessories/brows fill 99%) | Trimming + stored offsets would cut decode memory (1.6 MB per decoded layer, ~10 layers per avatar), not download size | Smoothness win, separate task; `avatar-parts.json` already carries layout so offsets have a home |
| Web: serve art through `next/image` (AVIF/WebP, responsive widths) or pre-generate AVIF | ~25-30% lighter art per page at matched SSIM | Nice-to-have; AVIF decode is slower on low-end phones, and the current WebP is already small per page |

## 4. Smoothness flags

- HEVC in the asset catalog is decoded by the hardware HEVC decoder (every device that runs iOS 16 has it). Per-image decode has a fixed setup cost of a few milliseconds that lossless deepmap2 does not have, and the first decode of a large image (podium stage, 1.5 Mpx) happens on the thread that first draws it. Expect no change in steady-state scrolling (UIImage caches decoded bitmaps) but check first-draw of: Finished/podium screen, celebration stage, avatar maker (10+ layers at once), title cast on Home. Gate: PerfTour A/B against build 264 before cutting (per the perf-gate rule). If a screen stutters on first entry, pre-warm with `UIImage.byPreparingForDisplay()` (already used in 10 places).
- `gpu-optimized-*` (ASTC) would avoid decode entirely but is larger than HEVC and visibly lower quality on gradients; rejected.
- WebP on iOS (if ever chosen) is software-decoded; slower than both HEVC and PNG for large images.
- AVIF on web decodes slower than WebP on older Android phones; only use it with `<picture>` fallbacks if at all.
- Android is unchanged by the first batch (already lossy WebP; Coil/BitmapFactory paths stay as they are).

## 5. Ranked recommendations

| # | Change | Platform | Saves | Quality evidence | Risk | Effort |
|---|---|---|---|---|---|---|
| 1 | Set `compression-type: lossy` on every imageset in `Assets.xcassets` (not Wallpapers, which are JPEG already; keep the 3 opaque backdrops lossless) | iOS | **-118 MB catalog, ~-120 MB download (-65%)** | Full-catalog compile measured; HEIC-q80 proxy SSIM >= 0.989 on all samples; crops in `crops/` | Low-medium: actool's quality is not tunable; must be eyeballed on device, plus PerfTour first-draw check | Small: `ship-art.py` writes `Contents.json`; add the property there and run a one-off script for existing imagesets |
| 2 | Convert the 78 nodpi PNGs (mascot_*, bot_*, bubble_*) to WebP q92 via the pipeline | Android | -2.7 MB download | Same quality setting the rest of the app already uses | Low | Small |
| 3 | De-duplicate avatar pet accessories: export one `...-pet` per pet and point the per-body name at it (iOS: one imageset, Android: drawable alias XML or name mapping in the avatar layout) | iOS + Android | iOS ~-1 MB after lossy (-3 MB today), Android -1.25 MB | Byte-identical files, zero visual change | Low | Small-medium (touch the avatar part lookup) |
| 4 | Remove unreferenced legacy assets after confirming (81 iOS imagesets: rig-* engine parts, bot-* portraits, 2 pocket pieces; Android `keep_rigs.xml` keeps the same rigs alive) | iOS + Android | ~-1.9 MB raw iOS, ~-0.7 MB Android | n/a | Medium: rigs are referenced by constructed names; verify in the rig engine | Small |
| 5 | Keep seasonal art out of the bundle after the season ends (move Halloween to the Art Library once 11-01 passes; keep only the current + next season in the catalog) | iOS + Android | ~-3 MB iOS (post-lossy), -3 MB Android per retired season | n/a | Low, process rule | Small, recurring |
| 6 | Avatar canvas trim + offsets (decode memory, not bytes) | iOS + Android | ~-10 MB resident memory in the avatar maker | n/a | Medium | Medium; separate smoothness task |
| 7 | Android WebP q86/92 -> q85 across the board | Android | ~-6 MB (45 -> ~39 MB) | SSIM mean 0.993 at q85 vs 0.995 at q90; hero crops OK at q85, grain softens at q80 | Low-medium; re-export is a full pipeline run; gain is modest | Small |
| 8 | Web: AVIF or `next/image` for `/art` | Web | ~25-30% per page | SSIM mean 0.989 at AVIF q65 (lowest of the formats) | Decode cost on low-end devices | Medium; skip for now |

## 6. Safe first batch (one build)

1. iOS: add `"properties": {"compression-type": "lossy"}` to every imageset in `Assets.xcassets` except `art-celebration-stage-halloween`, `art-pocket-coin-backdrop`, `art-pocket-rps-backdrop` (leave those on default/lossless), and make `ship-art.py` emit the property for new art. Expect `Assets.car` ~50 MB (verify in the archive). Cut a TestFlight build, PerfTour A/B vs 264, and have Brian look at Home title cast, Finished/podium, the Halloween celebration stage, and the avatar maker. Rollback is deleting the property.
2. Android: run the pipeline for the 78 PNG assets to WebP q92 (`mascot_*` are the large ones; the PNG `bot_*` portraits are also in the iOS unreferenced list, so check whether they are used at all first).
3. Both: pet accessory de-duplication (byte-identical files, no visual risk) in the same pipeline pass.

Together: iOS ~190 -> ~70 MB store download, Android ~55 -> ~51 MB download (~67.5 -> ~63 MB bundle). Item 7 (q85 on Android) is the next lever if Play keeps complaining, and it should be reviewed on the hero crops the same way.

## Appendix: how the numbers were produced

- IPA/AAB breakdowns: `unzip -l` / `unzip -v` of the 10-15 export and bundle; catalog contents via `xcrun assetutil --info Assets.car`.
- Lossy catalog: copy of `Assets.xcassets` with every `Contents.json` rewritten, `xcrun actool --compile` (scratch only; nothing in the repo changed).
- Format trial: Pillow 12 (libwebp, libavif) + macOS `sips` for HEIC; SSIM/PSNR in numpy/scipy; crops in `crops/`.
- Unreferenced scan: imageset names vs all string literals and `prefix\(` / `prefix"` constructions in `apps/ios/**/*.swift`, `packages/**`, and the resource JSON.

## Applied 10-16 (safe first batch, partial proof)

Time-boxed run on a machine at load average 30-46 (other agents' Next/vitest/xcodebuild jobs); background builds ran at nice 5 and starved. What is done, what is proven, what is not.

### Done (working tree, nothing committed)

1. **iOS lossy compression.** `scripts/ios-asset-compression.py` writes `"properties": {"compression-type": ...}` into every raster imageset of `Assets.xcassets` (3,471 `lossy`, 52 explicit `lossless`, 13 skipped: 12 SVG vector sets + `launch-w` multi-scale). `--check` fails on any imageset with no property, or an opaque / data one marked lossy; `packages/core/src/asset-size-guards.test.ts` runs it in CI (needs no Pillow for the "missing" half). New art from the ship scripts has no property until the script is re-run (the test says so).
   - Lossless exceptions: the report named 3 opaque images; there are now **4** (`art-celebration-stage-halloween`, `art-celebration-stage-thanksgiving` (new), `art-pocket-coin-backdrop`, `art-pocket-rps-backdrop`), because actool encodes opaque images as RGB555 when lossy.
   - **New finding, not in the first report: the 48 `bubble-*` glyph imagesets must stay lossless.** They are a tint-map atlas (R/G/B carry data, decoded per pixel by `BubbleGlyphTint`, byte-identical across web/iOS/Android, asserted by `bubble-text.test.ts`). Lossy would corrupt the lettering. Same on Android (below).
   - `Wallpapers.xcassets` left alone: 34 opaque JPEG sets, 2.1 MB; lossy would drop them to RGB555 for no real saving.
2. **Android.** `scripts/android-art-optimize.py`: the 30 non-bubble leftover PNGs (mascot 10, icon3d 10, bot 5, friends 5) became WebP q92 method 6: **3.05 MB -> 0.73 MB**, worst SSIM 0.994 (composited over dark purple and light grey), alpha channel exact (max diff 0). The 48 `bubble_*` PNGs stay (data atlas). `ship-cast.py` now writes the mascot as WebP so a re-ship cannot re-add a PNG next to it (aapt2 would fail on a duplicate).
   - Dedupe: 265 byte-identical `art_av_*` files (pets, brows, extras, belt) removed (**1.22 MB**) and replaced by 265 `<item type="drawable">` aliases in generated `res/values/art_aliases.xml`; `R.drawable.*`, `getIdentifier` and the keep rules are unchanged. `AvatarArtCoverageTest` (`ships()`) now accepts an alias. The web tests that check Android file names (rigs, season art, gopro signs) are outside the `art_av_` scope, so unaffected. `--check` (CI) fails if a PNG or an un-aliased duplicate comes back.
3. **Unreferenced legacy imagesets** untouched (the `rig-*` ones are in fact built by name in `AppHeaderView.swift`: `"rig-\(id)-\(layer)"`; do not remove).

### Proven

| Check | Result |
|---|---|
| `Assets.car` (Perf config, thinned for iPhone17,5, same actool command Xcode runs) | **181,603,064 -> 59,104,584 bytes (-122.5 MB, -67.5%)**. The 181.6 MB "before" is from a real Perf xcodebuild of the current tree; "after" is that exact actool invocation over the new catalog. |
| `assetutil --info` of the new car | 4,032 renditions `hevc`; the 80 lossless are the 48 bubble glyphs, the 4 opaque images, and vector/icon sets; 33 wallpapers JPEG |
| vitest `asset-size-guards` + `bubble-text` | 27 passed |
| Android PNG -> WebP quality | table above (SSIM >= 0.994, alpha exact) |
| Android resources link | `aapt2 compile --dir res` + `aapt2 link` over the new `res/` (aliases + WebP, no PNG twins): clean; `dump resources` shows `drawable/art_av_acc_bat_cone_pet` -> `@drawable/art_av_acc_bat_bell_pet`. |
| Gradle `:core:test --tests *AvatarArtCoverageTest` + `:app:compileDebugKotlin` + `:app:testDebugUnitTest` | core coverage test and compile pass; app unit tests 593/595: the 2 failures are other sessions' uncommitted work, not this batch (`StreakSummaryTest.liveHeadlineCopy` expects "SOLVED IN 4 GUESSES"; `NoEmojiInUiTest` flags emoji in `ShareSheetV2.kt:343`) |

### NOT proven (blocked by the starved machine; do before shipping)

- The before/after **PerfTour** A/B and **-storeShot home/leaderboard/flawless SSIM** shots: the Perf xcodebuild of the unchanged tree needed >60 min wall time at nice 5 and was killed at the time box (DerivedData deleted). Rerun on a quiet machine: `apps/ios/scripts/perf-tour.sh --build --only home,tabs,leaderboard,season,friends,pocket --loops 2 --demo` (label before) with `git stash`-free approach = build once with the property removed (`git checkout -- apps/ios/Wordocious/Resources/Assets.xcassets`-style revert) and once with it, then compare warm-loop hitch ms/s and main busy %. The report's expectations stand: first-draw HEVC decode of podium/celebration stage/avatar maker must be eyeballed, and pre-warm with `byPreparingForDisplay()` if a step regresses. Rollback = `git checkout` of the Contents.json files.
- Android `bundleRelease` before/after size: started, not finished at the time box and stopped (last AAB on disk is the 10-15 build, 70.7 MB, older tree). Estimated effect from the files: drawable-nodpi -3.5 MB (PNG->WebP -2.3 MB, aliases -1.2 MB); run `./gradlew :app:bundleRelease` (upload key) on a quiet machine to measure.
- iOS avatar dedupe NOT applied: `scripts/ios-art-dedupe.py` (staged, not wired) would remove ~40 pure-pet groups + brows/extras groups (4.8 MB of PNG today, ~1.3 MB after lossy) but needs a name-alias lookup in `MascotArtCache.uiImage` / `ArtAsset.exists` (the only funnels that load avatar layer art; verified) plus the Swift coverage test reading `Resources/art-aliases.json`, and a full Swift rebuild to verify. Left for the next batch rather than ship an unbuilt Swift edit.
