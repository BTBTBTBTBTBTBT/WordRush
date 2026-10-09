# 2.8 inventory — art asset sizes per platform

Date: 2026-10-09 · Feeds Friday-queue item 44 (art compression everywhere, no visible quality loss; `ship-art.py` should do it by default).
Measured on branch `prep/inventories-2-8` (tip of `claude/wordocious-store-text-audit-f32609`) with `stat`/`du` and header parsing (PNG IHDR, WebP VP8/VP8L/VP8X, JPEG SOF). Read-only; nothing was re-encoded.

## 1. Totals

| Platform | Location | Files | Bytes | Formats |
|---|---|---|---|---|
| iOS | `apps/ios/Wordocious/Resources/Assets.xcassets` | 1,661 (1,658 imagesets) | 140.7 MB on disk | 1,647 PNG (1,646 RGBA, 1 RGB), 13 SVG, 1 JSON data |
| iOS | `apps/ios/Wordocious/Resources/Wallpapers.xcassets` | 28 | 1.4 MB | 28 JPEG (1290×2796, q88) |
| iOS | **both catalogs, file bytes** | 1,689 | **135,049,141 B = 128.8 MB** | — |
| iOS | `apps/ios/WordociousWidget/Assets.xcassets` (widget target, extra) | 10 mascots | 7.0 MB | PNG (≈ 230–254 KB each, same files as Android `mascot_*.png`) |
| Android | `apps/android/app/src/main/res/drawable-nodpi` | 1,672 | 35.5 MB on disk | 1,642 WebP, 30 PNG |
| Android | `apps/android/app/src/main/res/drawable` | 34 | 0.14 MB | 34 XML vectors |
| Android | **all `drawable*`, file bytes** | 1,706 | **32,924,302 B = 31.4 MB** | (+ `mipmap-*` launcher icons 0.5 MB) |
| Web | `apps/web/public/art` | 1,671 | **30,620,215 B = 29.2 MB** | 1,670 WebP, 1 JSON |
| Web | other `apps/web/public` images (not `art/`) | 496 | 33.6 MB | mostly `public/muddle` (442 WebP, 30.7 MB cartoon panels, web-only), `mascots` 2.1 MB, `social` 1.2 MB, `icons3d` 0.5 MB |

Confirms the item-44 premise: iOS ships ~4.4× the bytes of web/Android for the same art.
Same-name match across all three platforms: **1,540 assets → iOS 122.1 MB vs Android 27.5 MB vs web 27.5 MB** (Android and web WebP are byte-identical outputs of `ship-art.py`).

## 2. How the pipeline encodes today (`docs/design/brand/ship-art.py`)

| Target | Encode | Line |
|---|---|---|
| Web + Android (normal art) | `WEBP quality=92, method=6` (lossy, alpha kept) | 101–102 |
| iOS (normal art) | `PNG optimize=True` — full RGBA PNG, one `universal` file, no @2x/@3x variants (only 2 files in the catalog carry a scale suffix) | 104–108 |
| Wallpapers (`art-wall-*`) | web/Android WebP q86; iOS JPEG q88 (already the "light" path, comment notes a PNG would add ~100 MB) | 83–98 |
| Resize | `wide(width=1080)` and `square(size=256)` helpers exist but are opt-in per family; scenes/day titles ship at their generated 900–1200 px | 59–70 |

No quality guard (SSIM/pixel diff) exists; no HEIF/lossless-WebP path for iOS; no AVIF/srcset on web.

## 3. iOS size distribution (both catalogs, 1,689 files)

| Bucket | Files | MB |
|---|---|---|
| ≥ 2 MB | 0 | 0 |
| 1–2 MB | 5 | 5.2 |
| 500 KB–1 MB | 25 | 16.5 |
| 100–500 KB | 303 | 60.3 |
| < 100 KB | 1,356 | 46.7 |

Most common PNG dimensions: 256×256 ×233 (avatar items), 320×320 ×112, 640×640 ×12, 512×512 ×11; small keyed icons (76–180 px) in sets of 8–12. 64 PNGs have a side ≥ 1024 px.
Imageset families by count: `art-av` 824 · `art-ach` 117 · `art-pose` 102 · `art-btn` 96 · `art-titlecast` 88 · `art-btnlabel` 40 · `art-dress` 30 · `art-badge` 26 · `art-title` 25 · `art-scene` 25 · `art-fam` 22 · `art-game` 18 · `art-halloween` 14 · `art-toggle` 12 · `rig-*` (mascot rigs) 67 · `art-gopro` 10 · `art-moment` 9 · `art-podium` 7 · `art-day` 7.

Where the bytes are: the 330 files ≥ 100 KB hold 82 MB (64 %) — scenes, day titles, titlecasts, game headers. The 824 avatar items at 256²/320² hold most of the remaining 47 MB.

## 4. The 60 largest iOS images

Rank · file size · pixel dimensions · imageset (all under `Assets.xcassets/`, single universal PNG unless noted).

| # | Size | Pixels | Imageset |
|---|---|---|---|
| 1 | 1217 KB | 875x926 | art-scene-ladder-cleared |
| 2 | 1104 KB | 796x914 | art-scene-flawless-star |
| 3 | 1046 KB | 746x939 | art-scene-pro-crown |
| 4 | 1001 KB | 802x870 | art-scene-invite-sent |
| 5 | 997 KB | 894x775 | art-scene-shield-guard |
| 6 | 949 KB | 1200x832 | art-scene-friends-match |
| 7 | 908 KB | 1200x774 | art-scene-banner-flawless |
| 8 | 815 KB | 900x861 | art-day-monday |
| 9 | 814 KB | 900x809 | art-scene-onboard-score |
| 10 | 807 KB | 1024x1024 | AppIcon.appiconset/AppIcon-1024.png (required by Apple, leave) |
| 11 | 803 KB | 1200x734 | art-scene-banner-sweep |
| 12 | 800 KB | 900x755 | art-scene-gift-pro |
| 13 | 791 KB | 1200x638 | art-scene-vs-faceoff |
| 14 | 788 KB | 900x840 | art-day-wednesday |
| 15 | 761 KB | 900x807 | art-scene-sweep-broom |
| 16 | 744 KB | 1200x815 | art-scene-gauntlet-champion |
| 17 | 680 KB | 900x759 | art-scene-unlimited-loop |
| 18 | 627 KB | 951x389 | art-titlecast-bots |
| 19 | 609 KB | 902x570 | art-scene-banner-halloween |
| 20 | 605 KB | 1200x416 | art-gauntlet-header |
| 21 | 589 KB | 1200x402 | art-scene-welcome-cast |
| 22 | 575 KB | 900x540 | art-day-sunday |
| 23 | 566 KB | 1200x565 | art-scene-onboard-tiles |
| 24 | 559 KB | 898x502 | art-day-saturday |
| 25 | 558 KB | 1200x381 | art-scene-all-set |
| 26 | 536 KB | 853x591 | art-day-friday |
| 27 | 535 KB | 879x482 | art-day-thursday |
| 28 | 516 KB | 842x250 | art-titlecast-pocket-ghost |
| 29 | 510 KB | 900x540 | art-day-tuesday |
| 30 | 496 KB | 1080x293 | art-titlecast-levelup |
| 31 | 484 KB | 1200x519 | art-scene-achievement |
| 32 | 466 KB | 947x262 | art-titlecast-achievement |
| 33 | 461 KB | 894x311 | art-titlecast-more |
| 34 | 455 KB | 1200x436 | art-game-sudoku |
| 35 | 431 KB | 1080x202 | art-titlecast-pocket-chain |
| 36 | 410 KB | 1020x198 | art-titlecast-nottoday |
| 37 | 378 KB | 1080x185 | art-titlecast-pick-friend |
| 38 | 378 KB | 1200x305 | art-game-practice |
| 39 | 369 KB | 1200x314 | art-game-wordsearch |
| 40 | 365 KB | 953x204 | art-titlecast-h2h |
| 41 | 361 KB | 1200x290 | art-game-sequence |
| 42 | 358 KB | 1001x211 | art-titlecast-trophycase |
| 43 | 358 KB | 1200x325 | art-game-hub |
| 44 | 356 KB | 1200x321 | art-game-groups |
| 45 | 352 KB | 975x204 | art-titlecast-overview |
| 46 | 350 KB | 1080x201 | art-titlecast-jointhefun |
| 47 | 350 KB | 1080x182 | art-titlecast-matchfound |
| 48 | 348 KB | 1200x302 | art-game-crossword |
| 49 | 346 KB | 1080x184 | art-titlecast-onastreak |
| 50 | 344 KB | 1080x182 | art-titlecast-invitesent |
| 51 | 344 KB | 1200x275 | art-game-quordle |
| 52 | 340 KB | 1080x170 | art-titlecast-welcomeback |
| 53 | 339 KB | 1200x329 | art-game-scramble |
| 54 | 337 KB | 1029x172 | art-titlecast-sweep |
| 55 | 335 KB | 1200x271 | art-game-regions |
| 56 | 333 KB | 1200x255 | art-game-octordle |
| 57 | 331 KB | 877x204 | art-titlecast-support |
| 58 | 331 KB | 1200x268 | art-game-six |
| 59 | 327 KB | 1200x273 | art-game-gauntlet |
| 60 | 327 KB | 1021x225 | art-title-halloween-sequence |

Top-60 total ≈ 32 MB (≈ 25 % of iOS art bytes) in 60 of 1,689 files.

## 5. Same asset ×3 (illustrative ratios)

| Asset | iOS PNG | Android WebP | Web WebP |
|---|---|---|---|
| art-scene-banner-flawless (1200×774) | 908 KB | 263 KB | 263 KB |
| art-day-monday (900×861) | 815 KB | 139 KB | 139 KB |
| mascot_* (widget, 10 files) | ~230–254 KB PNG each | same PNGs (the only 30 Android PNGs: `mascot_*`, `bot_*`, `friends_*`, `icon3d_*`) | `public/mascots` |

Web WebP dimension histogram matches iOS (256², 320², 900–1200 px scenes) — nothing is right-sized per platform today; the only web-specific sizes are wallpapers (2400×1500 wide ×28, 1179×2556 ×23).

## 6. Notes for item 44

- **iOS is the only lossy-free target**: 1,646 RGBA PNGs at generation size. Options per asset type: opaque scenes → HEIF/JPEG (like wallpapers already do); keyed art with alpha → lossless WebP (iOS 14+) or palette/quantized PNG where the SSIM guard passes; keep PNG for AppIcon and any asset the guard rejects.
- **Right-sizing**: scenes/day titles are 900–1200 px but render at ≤ ~390 pt wide on phone (≤ 1170 px @3x) — mostly already at the ceiling; the real wins are encode format, not resolution. The 824 avatar items (256²/320²) and 102 poses are the volume; keycaps/btn/toggle sets are already small.
- **Android/web** are already WebP q92; AVIF on web and `sizes`/lazy-load in the portal are the remaining items (44.4). `public/muddle` (442 panels, 30.7 MB) is web-only and the largest non-`art/` directory — confirm whether it is served to the apps or only to the web Muddle game before compressing.
- **Widget target** duplicates 7 MB of mascot PNGs that also exist in `Assets.xcassets` (`art-av-*`/rigs); a shared asset catalog or on-demand resource would drop them.
- **Guard**: none exists; item 44 (3) asks for SSIM ≥ 0.995 + max pixel diff + alpha-edge check with original-keeps-if-fail; add to `ship-art.py` so the default path is the compressed one.
- Cellular limit: Apple's 200 MB over-cellular threshold — 129 MB art + binary/other resources is close enough that App Store Connect's reported size should be checked after 2.8's archive (FINISH_SPEC.md AC line 617 asks for the before/after).
