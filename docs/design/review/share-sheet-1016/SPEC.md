# Share sheet (direction A) — shared model API

*2026-10-16. Founder picked `option-a.png`: carousel of card previews → slim "No spoilers | Full results" toggle → look swatches (season / Normal, only in a season) → PEOPLE row → CHANNELS row. This page is the contract the iOS, Android and web shells build against. Research + channel table: `docs/review/share-sheet-plan.md` (§2 channels, §3 architecture).*

## 1. Where the model lives

| | Path | Entry point |
|---|---|---|
| Core (source of truth) | `packages/core/src/share-sheet.ts` (exported from `@wordocious/core`) | `shareSheetModel(ctx, platform)` |
| iOS | `apps/ios/Sources/Core/ShareSheet.swift` | `shareSheetModel(ctx, platform)` / `ShareSheet.model` |
| Android | `apps/android/core/src/main/kotlin/com/wordocious/core/ShareSheet.kt` | `shareSheetModel(ctx, platform)` / `ShareSheet.model` |
| Parity | `share-sheet-fixtures.json` (iOS `Tests/Fixtures`, Android `core/src/test/resources/fixtures`), section `renderShareSheetFixtures` in `packages/core/scripts/gen-parity-fixtures.ts`; tests `share-sheet.test.ts`, `ShareSheetFixtureTests.swift`, `ShareSheetFixtureTest.kt` | regenerate: `apps/server/node_modules/.bin/tsx packages/core/scripts/gen-parity-fixtures.ts` |
| SQL (not run yet) | `docs/sql/20261016-share-sheet-slugs.sql` adds `marketing_links` slugs `copy`, `msg`, `wa`, `snapchat` | apply before the sheet ships |

Pure functions, no I/O. The PEOPLE row (friends + system contact picker) is platform data and is **not** in the model.

## 2. Input: `ShareSheetContext`

```ts
interface ShareSheetContext {
  surface: 'finished' | 'leaderboard' | 'sweep' | 'vs' | 'profile' | 'moment';
  mode: string;                 // catalog mode id for a finished game ('regions', 'quordle', …); '' elsewhere
  play: 'daily' | 'unlimited' | null;
  cards: ShareCardKind[];       // the card kinds this surface can render for THIS share (any order); [] = the surface default
  hasSpoilerVariant: boolean;   // the result card has a clean variant (share-spoilers.ts models; word games too)
  season: string | null;        // currentSeason(today) — a ready season id, or null
  caption: { kind: ShareCaptionKind; date; game; n?; t?; b?; d?; k?; opp? } | null;   // share-captions.ts pick; null on profile / moment
}
type ShareCardKind = 'result' | 'vs-result' | 'daily-sweep' | 'leaderboard' | 'moment' | 'profile' | 'streak' | 'achievement';
type SharePlatform = 'ios' | 'android' | 'web';
```

Swift: `ShareSheetContext(surface:mode:play:cards:hasSpoilerVariant:season:caption:)` with `ShareSheetCaption(kind: ShareCaptions.Kind, …)`. Kotlin: the same data classes (`ShareSheetContext`, `ShareSheetCaption(kind: ShareCaptions.Kind, …)`).

## 3. Output: `ShareSheetModel`

```ts
interface ShareSheetModel {
  cards: { kind: ShareCardKind; frame: 'message'; title: string }[];   // carousel order; titles 'Result', 'Race result', 'Daily sweep', 'Leaderboard', 'Moment', 'Profile', 'Streak', 'Achievement'
  variant: { shown: boolean; initial: 'clean'; copy: ShareVariantCopy };  // shown = hasSpoilerVariant && a result card; copy = shareVariantCopy(mode) ("No spoilers / Regions only" …)
  looks: { shown: boolean; options: { id: string; label: string }[]; initial: string };  // in a season: [season, 'normal'], initial = season; else shown=false, ['normal']
  channels: ShareSheetChannel[];        // ordered tiles to RENDER (availability 'ready')
  hiddenChannels: ShareSheetChannel[];  // ordered tiles parked until their registration exists (Stories = Meta App ID, Snapchat = Snap Kit, TikTok = Share Kit)
}
interface ShareSheetChannel {
  id: 'copy' | 'messages' | 'whatsapp' | 'stories' | 'x' | 'facebook' | 'snapchat' | 'tiktok' | 'save' | 'more';
  label: string;                        // 'Copy link', 'Messages', 'WhatsApp', 'Stories', 'X', 'Facebook', 'Snapchat', 'TikTok', 'Save image', 'More'
  availability: 'ready' | 'needsRegistration';
  payload: 'image' | 'imageText' | 'text' | 'link';   // what travels
  link: string | null;                  // https://wordocious.com/go/<slug>?s=<surface>[&m=<mode>]; null for image-only channels (§S1) and save / more
  caption: string | null;               // share-captions line; only for text / imageText channels with a caption in the context
  text: string | null;                  // `${caption} ${link}` (or whichever exists) for one-body APIs: sms: body, wa.me text, EXTRA_TEXT; null for image-only
  mobileOnly: boolean;                  // web only: messages + whatsapp exist on phones, hide on desktop
}
```

Helpers: `channelFrame(id)` ('story' for stories / snapchat / tiktok, else 'message'), `channelCarriesImage(id, platform)`, `channelCarriesLink(id, platform)`, `shareChannelLink(id, surface, mode)`, `shareSheetCards(surface, available)`, `shareSheetLooks(season)`, and the tables `SHARE_CHANNEL_ORDER`, `SHARE_CHANNEL_PAYLOADS`, `SHARE_CHANNEL_SLUGS`, `SHARE_CHANNEL_AVAILABILITY`, `SHARE_CARD_ORDER`, `SHARE_LOOK_LABELS` (Swift `ShareSheet.*`, Kotlin `ShareSheet.*`).

## 4. The channel table the model encodes (plan §2, MVP)

Order: copy, messages, whatsapp, stories, x, facebook, snapchat, tiktok, save, more. **Rendered today (ready):** Copy link, Messages, WhatsApp, X, Facebook, Save image, More. **Hidden (needsRegistration):** Stories, Snapchat, TikTok.

| id | iOS | Android | Web | slug |
|---|---|---|---|---|
| copy | link | link | link | `copy` (new) |
| messages | image (MFMessageCompose + attachment) | image (ACTION_SEND → default SMS app) | text (`sms:?&body=`), mobileOnly | `msg` (new) |
| whatsapp | image (UIDocumentInteraction `.wai`) | image (ACTION_SEND → com.whatsapp) | text (`wa.me/?text=`), mobileOnly | `wa` (new) |
| stories | image, story frame | image, story frame | — | `instagram` |
| x | image (system sheet → X extension) | imageText (ACTION_SEND + EXTRA_TEXT) | text (x.com/intent/post text + url) | `x` |
| facebook | image | image | link (sharer.php?u=) | `facebook` |
| snapchat | image, story frame | image, story frame | link | `snapchat` (new) |
| tiktok | image, story frame | image, story frame | — | `tiktok` |
| save | image | image | image (download) | — |
| more | image (UIActivityViewController) | image (createChooser) | image (navigator.share files → clipboard → download) | — |

Rules: a result share to a messaging app is the image alone, no link, no caption (§S1), so Messages / WhatsApp / More on the apps get `link: null`. Copy link is the link only. Text channels with no caption in the context (profile, moment) carry just the link. The `?s=&m=` query is ignored by `/go/[slug]` (it counts the slug) and only rides along for logs.

## 5. How a shell uses it

1. Build the context at the Share tap (surface, mode, cards it can render, `hasSpoilerVariant`, `currentSeason(today)`, the caption pick it already computes for the old chooser).
2. `model = shareSheetModel(ctx, platform)`; render `model.cards` previews at `(variant.initial, looks.initial, 'message')`; re-render on toggle / swatch; `channelFrame(id)` says when a tap needs the story frame.
3. Render `model.channels` in order; skip `mobileOnly` tiles on desktop web. Never render `hiddenChannels` yet.
4. On a tile tap use `payload` to pick the mechanism (plan §2) and pass `link` / `caption` / `text` as that API wants them. Log `share_events` once per tap with the channel id (plan §3 analytics).

## 6. Fixture contexts pinned

finished (regions daily, Halloween, win caption), finished (quordle unlimited, no season, multiWin), finished (scramble lost, Thanksgiving), finished without a spoiler variant (gauntlet), leaderboard (Halloween, no caption), sweep, vs (hub, vsWin), profile, moment (ladder, Halloween), unknown season label (`winter` → "Winter"); all three platforms each.
