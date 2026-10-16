# Custom share sheet (Spotify-style) — research + plan

*Written 2026-10-16 (research only, no code). Founder ask: top = swipeable carousel of our share-card previews, a "No spoilers / Full results" toggle (+ maybe season/normal swatches), then a PEOPLE row (phone contacts + in-app friends), then a CHANNELS row (Copy link, Messages, WhatsApp, Instagram Stories, X, Facebook, Snapchat, TikTok, More).*

## 0. Where we stand today

| | iOS | Android | Web |
|---|---|---|---|
| Card render | SwiftUI `ImageRenderer` (`ShareKit.swift` `renderCard`, 1080-px canvas, message / story / square frames in core `share-hero.ts`) | `Canvas` (`data/ShareImage.kt`, `MomentCard.kt`) | Canvas (`lib/share-image.ts`, `vs-share-image.ts`, `share-hero-canvas.ts`) |
| Chooser | `ShareVariantSheet.swift` (two candy buttons, No spoilers / Full results) | chooser inside the game screens | `components/share/share-variant-modal.tsx` |
| Send | `ShareService.present` → `UIActivityViewController`, image only (§S1) | `ShareHelper.shareImages` → `ACTION_SEND image/png` + FileProvider + ClipData, image only | `share-utils.ts`: Web Share (files) → clipboard image → download → `share-preview-modal.tsx` |
| Spoiler model | core `share-spoilers.ts` (`ShareVariant = 'clean' | 'full'`, per-game models + chooser copy), ported to `apps/ios/Sources/Core/ShareSpoilers.swift` (Android port pending, like `ShareHero.kt` / `ShareCaptions.kt`) |||
| Analytics | `share_events` (platform, game_mode, kind ∈ text/image/link_invite/other, surface) — logged at the chooser tap, no channel recorded |||
| Tracked links | `wordocious.com/go/<slug>` (`apps/web/app/go/[slug]/route.ts`): counts the click + 30-day `wr_src` first-touch cookie → `profiles.signup_source`. Seeded slugs: `tiktok instagram x youtube threads facebook pinterest reddit linkedin producthunt press`; Studio posts use `p-<id>-<platform>` |||
| Registrations | No Meta app yet (SOCIAL-CONNECT-CHECKLIST: Meta signup pending), no Snap Kit, no TikTok dev app (TikTok Business Center exists), no `LSApplicationQueriesSchemes`, no `<queries>`, no contacts/photo purpose strings |||

The rule that shaped everything below: **§S1 — a result share is the IMAGE, no link, no caption**, so Messages/WhatsApp show the picture, not a link-preview card. A custom sheet only changes *who picks the target*; what travels stays the image (plus an optional tracked link where a channel can carry both).

---

## 1. PEOPLE row

### What Spotify actually does
Spotify's row is its own data: recent in-app recipients + system share suggestions. On iOS the "suggested people" strip in the system share sheet is rendered by the system from Messages/other apps' `INSendMessageIntent` donations; **no public API lets an app read that list** — an app can only *donate* its own conversations so they appear in the system sheet for its own share extension ([Supporting suggestions in your app's share extension](https://developer.apple.com/documentation/foundation/supporting-suggestions-in-your-app-s-share-extension)). Android's direct-share targets (`ChooserTarget` / sharing shortcuts) are likewise published by other apps *to* the system chooser; there is no read API. **Conclusion: "recent people" must be our own list.**

### iOS
- **Full contacts access** = `NSContactsUsageDescription` (app crashes without it) + `CNContactStore.requestAccess`; since iOS 18 the user may grant *limited* access ([Accessing the contact store](https://developer.apple.com/documentation/contacts/accessing-the-contact-store)). Review guideline 5.1.1(iii) says "Where possible, use the out-of-process picker or a share sheet rather than requesting full access to protected resources like Photos or Contacts"; 5.1.2(iv)–(v) forbid building a contact database from Contacts and require that any message to a contact be at the user's individual initiative, no Select All, and that the user sees what the message will look like before it is sent ([App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). A word game asking for full contacts is a review flag and a trust cost; skip it.
- **Out-of-process pickers (no permission prompt, nothing leaves the picker but the chosen contact):**
  - `CNContactPickerViewController` (iOS 9+) — a one-tap "Pick a contact" that returns name + phone; no usage string needed.
  - iOS 18 `ContactAccessButton(queryString:)` — an inline search field whose results come from the system; tapping a result grants access to just that contact. Fits "search for the people in your phone" exactly, but iOS 18+ only and has known rough edges (Apple forums thread 762077: can't hide when no matches); use it with the picker as the fallback.
- **Sending the card to a chosen contact:** `MFMessageComposeViewController` — prefill `recipients = [phone]`, `addAttachmentData(png, typeIdentifier: "public.png", filename:)` (check `canSendText()` / `canSendAttachments()`), the user reviews and taps Send; the app can't send silently ([MFMessageComposeViewController](https://developer.apple.com/documentation/messageui/mfmessagecomposeviewcontroller)). This also satisfies 5.1.2(v): the recipient sees the real composer with the image before sending. Simulator can't send; test on device.
- **In-app friends:** we have them (`friendships`, Friends tab, `friend-cards.ts`). "Send to a friend" = our own channel: the card goes as a friend-chat / challenge item (today there is no DM; the simplest is a push "X sent you their Classic 4/6" + the card stored under the friendly-games or reactions tables — see §3). Recents = last N in-app recipients kept in UserDefaults, nothing uploaded.

### Android
- `READ_CONTACTS` is now policed: Play's Contacts Permission policy (announced 2026-04-15; declaration in Console from 09/2026; mandatory for API 37+ targets 2027-01-27) says the permission is **not permitted** when used only for "sharing files, inviting or referring someone, or choosing a contact to transact with" — exactly our case — and a custom contact picker is not a valid reason ([Contacts Permission policy](https://support.google.com/googleplay/android-developer/answer/16935362)). So: never declare it.
- **Picker without permission:** `ACTION_PICK` with `ContactsContract.CommonDataKinds.Phone.CONTENT_URI` returns one phone row (name + number) via the system picker, no permission; Android 17 adds `ACTION_PICK_CONTACTS` and auto-upgrades `ACTION_PICK` for API 37 targets. No search-as-you-type inline UI exists without the permission — the row shows a "Pick a contact" chip.
- **Sending the image to that number:** there is no composer API. Options, best-effort by OEM: `ACTION_SEND image/png` with `setPackage(Telephony.Sms.getDefaultSmsPackage())` + `EXTRA_STREAM` + `putExtra("address", number)` (Google Messages honors `address`; Samsung Messages mostly; others ignore it and open the picker), or `ACTION_SENDTO smsto:<number>` + `EXTRA_STREAM` (less consistent; some apps drop the stream). Also needs `<queries><intent><action SEND/><data image/png/></intent></queries>` on API 30+ ([Package visibility](https://developer.android.com/training/package-visibility/declaring)). Treat recipient prefill as a nicety, never a promise: if the SMS app ignores it the user still lands in a composer with the image.
- In-app friends: same as iOS.

### Web
- **Contact Picker API** (`navigator.contacts.select`) — Chromium on Android only, HTTPS + user gesture, no persistence, no desktop, no iOS Safari ([MDN Contact Picker API](https://developer.mozilla.org/en-US/docs/Web/API/Contact_Picker_API)). It returns name/tel; there is then **no way to open an SMS composer with an image** from a web page (`sms:` URLs carry text only). So on web the people row is in-app friends only, plus "Messages" as a channel (`sms:?&body=<link>` text only) on mobile.

### Recommendation (privacy-safe, same on all three)
1. **Row = "Friends" first**: avatars of in-app friends sorted by recency of play-together / last share, with a "recent" subset first (local list, never uploaded). Tap → sends the card in-app (push + stored moment) — our only channel that keeps the card *inside* Wordocious and works identically ×3.
2. **"From your phone" chip** at the end of the row: taps the system picker (`CNContactPickerViewController` / `ContactAccessButton` on iOS 18; `ACTION_PICK` phone on Android; hidden on web). Permission is requested only there, only the chosen contact comes back, nothing is stored or uploaded, and the number goes straight into the native Messages composer with the image attached. No full-contacts prompt, ever, on either store.
3. Never a "select all", never an invite blast; one person per tap (5.1.2(v)).
4. Purpose strings: iOS needs none for the picker; add `NSPhotoLibraryAddUsageDescription` only if "Save image" ships (it should).

---

## 2. CHANNELS row

Legend: **works now** (no registration), **needs registration**, **not possible**. "Image?" = does our PNG travel.

| Channel | iOS mechanism | Android mechanism | Web mechanism | Image? | Status | /go slug |
|---|---|---|---|---|---|---|
| **Copy link** | `UIPasteboard.general.string` | `ClipboardManager` | `navigator.clipboard.writeText` | no (link) | works now | per-context (`share-<game>`? see below) |
| **Save image** | `UIImageWriteToSavedPhotosAlbum` / `PHPhotoLibrary` (add-only, needs `NSPhotoLibraryAddUsageDescription`) | `MediaStore.Images` insert (no permission on API 29+) | `<a download>` (exists) | yes | works now | — |
| **Messages** | `MFMessageComposeViewController` with `addAttachmentData` (+ optional recipient) | `ACTION_SEND image/png` + `setPackage(default SMS app)` | `sms:?&body=<link>` (mobile only, text) | iOS/Android yes; web link only | works now | `msg` |
| **WhatsApp** | `whatsapp://send?text=` is **text only**. Image: `UIDocumentInteractionController` with `uti = "net.whatsapp.image"` on a `.wai` file (community-documented, long-standing, WhatsApp removed its FAQ page — treat as "works today, unofficial"); it opens WhatsApp's contact picker with the image. Needs `whatsapp` in `LSApplicationQueriesSchemes`. | `ACTION_SEND image/png` + `setPackage("com.whatsapp")` + `EXTRA_STREAM` (+ `EXTRA_TEXT` caption — WhatsApp keeps both). `<queries><package com.whatsapp/>`. | `https://wa.me/?text=<link>` (text only) | iOS/Android yes; web link | works now (iOS = unofficial UTI, keep the system sheet as fallback) | `wa` |
| **Instagram Stories** | `instagram-stories://share?source_application=<FB_APP_ID>` + pasteboard `com.instagram.sharedSticker.backgroundImage` (JPG/PNG ≥ 720×1280, 9:16) and/or `stickerImage`, `backgroundTopColor/BottomColor`; App ID **required since Jan 2023**; `instagram-stories` in `LSApplicationQueriesSchemes` ([Sharing to Stories](https://developers.facebook.com/docs/instagram-platform/sharing-to-stories)) | `Intent("com.instagram.share.ADD_TO_STORY")` + `source_application` = App ID + `setDataAndType(contentUri, "image/*")` + `FLAG_GRANT_READ_URI_PERMISSION`; `<queries><package com.instagram.android/>` | not possible (no web entry point) | yes (our `story` frame 1080×1920; card as sticker over a season-colour gradient looks best) | **needs registration** — a Meta app ID (no review needed for Stories sharing per the doc; the pending Meta app from the Studio checklist can be the same app) | `instagram` (stickers can't carry links; the link is only useful in the caption the user types) |
| **Instagram feed** | `UIDocumentInteractionController`, file `.igo`, UTI `com.instagram.exclusivegram` → Instagram's filter screen (no App ID) ([Sharing to Feed](https://developers.facebook.com/docs/instagram-platform/sharing-to-feed)) | `ACTION_SEND image/*` + `setPackage("com.instagram.android")` (Instagram then offers Feed / Story / Message) | not possible | yes | works now | `instagram` |
| **Facebook Stories** | `facebook-stories://share` + pasteboard `com.facebook.sharedSticker.appID` (required) + `backgroundImage` / `stickerImage`; `facebook-stories` in `LSApplicationQueriesSchemes` ([FB Stories iOS](https://developers.facebook.com/docs/sharing/sharing-to-stories/ios-developers)) | `com.facebook.stories.ADD_TO_STORY` + `com.facebook.platform.extra.APPLICATION_ID` | not possible | yes | **needs registration** (same Meta App ID) | `facebook` |
| **Facebook feed** | system share → Facebook app accepts the image (text is ignored by FB) | `ACTION_SEND image/png` + `setPackage("com.facebook.katana")` | `https://www.facebook.com/sharer/sharer.php?u=<link>` (link only, OG image from the landing page) | app yes; web no | works now | `facebook` |
| **X** | X web intent `https://x.com/intent/post?text=&url=` is **text + link only** ([Web Intent](https://docs.x.com/x-for-websites/post-button/guides/web-intent)); image only via the system share sheet (X's share extension accepts images; `twitter://post` is dead) | `ACTION_SEND image/png` + `setPackage("com.twitter.android")` + `EXTRA_TEXT` → composer with image + text | web intent (text + link) | iOS: via system sheet only; Android yes; web no | works now | `x` |
| **Threads** | `https://www.threads.com/intent/post?text=&url=` (text + link attachment only) ([Threads Web Intents](https://developers.facebook.com/documentation/threads/threads-web-intents)); image via system sheet | `ACTION_SEND image/png` + `setPackage("com.instagram.barcelona")` | web intent | Android yes; iOS/web link only | works now | `threads` |
| **Snapchat** | Creative Kit "code-only" (Creative Kit Lite): deep link + pasteboard, needs `SCSDKClientId` from the Snap Kit developer portal; Snap Kit apps go through Snap's review before non-tester users can share ([Creative Kit](https://developers.snap.com/snap-kit/creative-kit/overview)) | same (Creative Kit Lite intent) | Creative Kit Web = a script-tag button that shares a **URL** (+ a 400×400 PNG sticker via `snapchat:sticker` meta tag; optional app id for metrics) ([Creative Kit Web](https://developers.snap.com/snap-kit/creative-kit/web)) | app yes (background or sticker + caption + attachment URL); web link + sticker | **needs registration** (free, review before public) | `snapchat` (new slug) |
| **TikTok** | Share Kit: TikTok dev app + Share Kit product + review → client key; media must be in the **Photos library** (`localIdentifiers`; needs photo-library read access, 1–35 images, aspect 1/2.2–2.2) ([Share Kit iOS](https://developers.tiktok.com/doc/share-kit-ios-quickstart-v2)) | Share Kit Android, same registration, local file URIs | not possible | yes, but only after saving to Photos + extra permission | **needs registration** + review; heavy. Fallback that works now: "Save image" then open TikTok (`ACTION_SEND image/*` + `setPackage("com.zhiliaoapp.musically")` works on Android without the SDK) | `tiktok` |
| **More** | `UIActivityViewController` (today's path) | `Intent.createChooser` (today's path) | `navigator.share({files})` where supported (Safari ≥ 15 iOS, Chrome/Edge desktop + Android; not Firefox desktop) else clipboard → download ([Web Share API](https://developer.mozilla.org/en-us/docs/web/api/web_share_api)) | yes | works now | — |
| **Pinterest** | system sheet | `ACTION_SEND` + `setPackage("com.pinterest")` | `https://pinterest.com/pin/create/button/?url=&media=&description=` (needs a hosted image URL → not for §S1 image-only) | app yes | works now (low priority) | `pinterest` |

Notes
- **Target pinning on iOS**: `UIActivityViewController` cannot pre-select a target, so every iOS "named" tile needs its own mechanism (table above) or falls back to the system sheet with the image. Where the mechanism is unofficial (WhatsApp UTI), guard with `canOpenURL` + try/catch and fall back to the sheet.
- **`LSApplicationQueriesSchemes`** to add on iOS: `whatsapp`, `instagram`, `instagram-stories`, `facebook-stories`, `fb`, `snapchat`, `tiktok` (+ TikTok's `tiktoksharesdk` if Share Kit). **`<queries>`** to add on Android: `com.whatsapp`, `com.instagram.android`, `com.instagram.barcelona`, `com.facebook.katana`, `com.twitter.android`, `com.snapchat.android`, `com.zhiliaoapp.musically`, `com.pinterest`, plus an `ACTION_SEND image/png` intent query. Tiles hide when the app isn't installed (web: hide app-only tiles on desktop, keep intents).
- **Tracked link per channel**: keep the image-only rule for messaging (Messages/WhatsApp/More) — no link in the image share — but **Copy link** and the text-only intents (X, Threads, FB sharer, wa.me on web) carry `https://wordocious.com/go/<slug>`. Add slugs `msg`, `wa`, `snapchat`, `copy`, `friend` so `signup_source` distinguishes share-driven channels from bio links; optionally `s-<slug>` prefix (e.g. `s-x`) so Studio bio links and in-app share links are separable in `marketing_links.clicks`. Targets can point at a per-game landing (`/play/<game>`) later without changing the slug.
- **Season swatches**: the renderers already take the season (Halloween/Thanksgiving art); a "Season / Classic" pill is just a renderer flag — cheap, include in MVP if the renderers expose it, otherwise phase 2.

---

## 3. Architecture

### Core model (`packages/core/src/share-sheet.ts`, ported to `apps/ios/Sources/Core/ShareSheet.swift` + `apps/android/core/.../ShareSheet.kt` with a parity fixture, like `share-hero` / `share-captions`)
```ts
export type ShareCardKind = 'result' | 'moment' | 'leaderboard' | 'daily-sweep' | 'streak' | 'vs-result' | 'achievement';
export type ShareFrame = 'message' | 'story' | 'square';            // exists in share-hero.ts
export type ShareChannel = 'friend' | 'contact' | 'copy' | 'save' | 'messages' | 'whatsapp'
  | 'ig-stories' | 'ig-feed' | 'fb-stories' | 'facebook' | 'x' | 'threads' | 'snapchat' | 'tiktok' | 'pinterest' | 'more';
export interface ShareSheetContext { surface: string; game: string; hasSpoilerVariants: boolean; season: SeasonKey | null; signedIn: boolean; friendsCount: number; }
export interface ShareSheetModel {
  cards: { kind: ShareCardKind; frame: ShareFrame; title: string }[];   // carousel order for this context
  variant: ShareVariant;                 // 'clean' | 'full' — default clean (share-spoilers.ts)
  variantCopy: ShareVariantCopy;         // from shareVariantCopy(mode)
  look: 'season' | 'classic';
  channels: ShareChannel[];              // ordered, filtered by ChannelAvailability the platform passes in
  link: (channel: ShareChannel) => string | null;   // /go/<slug> or null for image-only channels
  caption: (channel: ShareChannel) => string | null; // share-captions.ts bank; null for image-only
}
export function shareSheetModel(ctx: ShareSheetContext, avail: Partial<Record<ShareChannel, boolean>>): ShareSheetModel;
export function channelFrame(channel: ShareChannel): ShareFrame;   // ig-stories/fb-stories/snapchat → 'story', else 'message'
export function channelCarriesImage(channel, platform): boolean;   // the table above, encoded + unit-tested
```
Pure functions, no I/O; tests pin the channel order, the per-platform image/link rules and the variant defaults (clean first, full only when the game has spoilers).

### Platform shells
- **iOS**: `ShareSheetView` (SwiftUI `.sheet` with `.medium/.large` detents, `MenuScaffold` chrome like `ShareVariantSheet`) replaces `ShareVariantSheet`. Carousel = `TabView(.page)` of pre-rendered `UIImage`s (render lazily per variant/look with `renderCard`; cache by key). `ShareChannels.swift` implements the table (`MessageUI`, `UIDocumentInteractionController`, pasteboard + `openURL`, `UIActivityViewController` for More). `ShareService.share(...)` keeps its signature; it now builds a `ShareRequest { renderers: [kind: (variant, look, frame) -> UIImage] }` and presents the sheet.
- **Android**: `ShareSheet.kt` Compose `ModalBottomSheet`; `HorizontalPager` of bitmaps from `ShareImage.kt`; `ShareChannels.kt` builds the intents (all `ACTION_SEND` + `setPackage`, Stories intents, `MediaStore` save, clipboard). `ShareHelper.shareImages` stays as the "More" path.
- **Web**: `components/share/share-sheet.tsx` (bottom sheet, same look as the soft popups) replaces `share-variant-modal` + `share-preview-modal`; carousel of `<img>` from the canvas blobs; channels = Web Share (files) for More/Messages-ish, `window.open` intents for X/Threads/FB/wa.me, clipboard, download. Desktop shows Copy link / Save / X / Threads / Facebook / More; mobile adds Messages (`sms:`), WhatsApp (`wa.me`).
- **People row**: `FriendsRow` (shared friends query the Friends tab already uses) + a platform `ContactPickerBridge` (iOS picker / Android `ACTION_PICK` / hidden on web). "Send to friend" needs one small backend piece: a `share_deliveries` row (sender, recipient, card kind, storage path of the PNG in a `shares` bucket, 7-day TTL) + a push "{name} sent you their {game}" + a Friends-tab inbox cell. Cards are rendered client-side, so the upload is the PNG we already have.

### Plugging into existing renderers
Every render entry point already takes `(reveal/variant)`; add `look` and `frame` parameters (frame exists in core `SHARE_FRAMES`). The sheet asks the renderer for `cards[i]` at `(variant, look, channelFrame(channel))` on demand — carousel previews use `message`, Stories/Snap re-render in `story` at tap time.

### Analytics
Extend `share_events`: `alter table add column channel text check (...)`, `card text`, `variant text`, `look text`, `outcome text` ('opened' | 'sent' | 'cancelled' where the API tells us — `MessageComposeResult`, `navigator.share` resolve/AbortError, `startActivityForResult` for Stories). Log once per tile tap (today's "log at the choice" rule) and update on outcome where known. `scripts/weekly-five.sql` gets a channel breakdown. Clicks on `/go/<share slug>` + `signup_source` close the loop.

---

## 4. Effort + phases

Estimates are focused build time, after design in ChatGPT per the standing rule (sheet layout, tile icons in the soft-3D kit, people avatars).

| Phase | Scope | iOS | Android | Web | Core/backend |
|---|---|---|---|---|---|
| **1 MVP** | Sheet shell; carousel of the context's cards; No spoilers / Full results toggle (+ Season/Classic if renderers expose it); channels **Copy link, Messages, Save image, More**; `share_events.channel`; `/go` share slugs; hide the old choosers | 1.5–2 d (sheet + MessageUI + Photos add + plist strings) | 1.5 d (Compose sheet + default-SMS intent + MediaStore) | 1 d (sheet + `sms:` + download/clipboard) | 0.5 d core model + fixtures; 0.25 d SQL |
| **2 Social** | WhatsApp, Instagram feed, X, Threads, Facebook feed (all no-registration); then **Instagram Stories + Facebook Stories** the day the Meta App ID exists (story frame render); install-aware tile hiding (`LSApplicationQueriesSchemes` / `<queries>`) | 1.5 d (+0.5 d Stories) | 1 d (+0.5 d Stories) | 0.5 d (intents) | — |
| **3 People** | Friends row + recents; in-app "send to friend" (bucket + `share_deliveries` + push + inbox cell); "From your phone" picker → Messages composer with recipient | 1.5 d | 1.5 d | 0.5 d (friends only) | 1 d (table, RLS, push, TTL cleanup) |
| **4 Registered kits** | Snapchat Creative Kit Lite (after Snap Kit review); TikTok Share Kit only if the Save-then-open fallback proves insufficient | 0.5–1 d each | 0.5–1 d each | Snap web button 0.25 d | founder: Snap Kit + TikTok dev app registrations |

Total to a complete sheet (phases 1–3): roughly 5 d iOS, 5 d Android, 2.5 d web, 2 d shared — plus founder-side registrations for phases 2b/4.

### Decisions needed from the founder
1. Meta App ID: create the Facebook/Instagram developer app now (same app the Studio checklist needs) — it unblocks both Stories tiles with no review.
2. People row: approve the "friends first + system picker, no contacts permission" design (it rules out an inline phone-contacts search on Android and iOS < 18, by store policy).
3. Snapchat / TikTok: register now (free, review time) or ship with the Save-image fallback and decide after the share_events channel numbers come in.
4. Link policy: confirm image-only stays for messaging channels and `/go/s-<channel>` rides only Copy link and the text-only intents.

### Sources
- App Store Review Guidelines 5.1.1(iii), 5.1.2(iv)–(v): https://developer.apple.com/app-store/review/guidelines/
- Accessing the contact store (limited access, ContactAccessButton, picker): https://developer.apple.com/documentation/contacts/accessing-the-contact-store
- MFMessageComposeViewController (recipients, addAttachmentData, user must send): https://developer.apple.com/documentation/messageui/mfmessagecomposeviewcontroller
- Share-sheet suggestions are donation-only: https://developer.apple.com/documentation/foundation/supporting-suggestions-in-your-app-s-share-extension
- Play Contacts Permission policy (invites/sharing not permitted; picker instead): https://support.google.com/googleplay/android-developer/answer/16935362
- Android package visibility (`<queries>`): https://developer.android.com/training/package-visibility/declaring
- Contact Picker API (Chromium Android only): https://developer.mozilla.org/en-US/docs/Web/API/Contact_Picker_API
- Web Share API: https://developer.mozilla.org/en-us/docs/web/api/web_share_api
- Instagram Sharing to Stories (App ID required, pasteboard keys, Android intent): https://developers.facebook.com/docs/instagram-platform/sharing-to-stories
- Instagram Sharing to Feed (`.igo` / `com.instagram.exclusivegram`, Android ACTION_SEND): https://developers.facebook.com/docs/instagram-platform/sharing-to-feed
- Facebook Sharing to Stories iOS (`facebook-stories://share`, `sharedSticker.appID` required): https://developers.facebook.com/docs/sharing/sharing-to-stories/ios-developers
- X web intent (text/url/hashtags only): https://docs.x.com/x-for-websites/post-button/guides/web-intent
- Threads web intents (text, url attachment only): https://developers.facebook.com/documentation/threads/threads-web-intents
- Snap Creative Kit overview + Web: https://developers.snap.com/snap-kit/creative-kit/overview , https://developers.snap.com/snap-kit/creative-kit/web
- TikTok Share Kit iOS (client key, Photos-library media, 35 images): https://developers.tiktok.com/doc/share-kit-ios-quickstart-v2
- WhatsApp iOS image UTI is community-documented only (WhatsApp's FAQ page is gone): https://www.technetexperts.com/interact-with-whatsapp-from-ios-application/
