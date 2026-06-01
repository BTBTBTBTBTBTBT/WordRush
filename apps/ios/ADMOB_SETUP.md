# Native AdMob — setup checklist

The native ad system is built and verified with Google's **test** ad units
(test banner + test interstitial render in the simulator). Ads show only for
**free** users — Pro hides both (the Simulate Pro toggle flips this live).
Swap in your real IDs before release.

## What's implemented
- `AdsManager` — starts the Google Mobile Ads SDK at launch, requests App
  Tracking Transparency, preloads + presents the **game-start interstitial**
  (full-screen, Google's own skip-countdown), reloads after each dismissal.
- `AdBannerContainer` / `AdBannerRepresentable` — **bottom banner**, mounted on
  RootTabView via `safeAreaInset` (free users only).
- Interstitial fires from `GameScreen.onAppear` for free users; the game timer
  starts only after the ad is dismissed (ad time isn't counted).
- `AdsConfig` — `enabled` master switch + the (currently test) unit IDs.
- Info.plist (via project.yml): `GADApplicationIdentifier` (test app ID),
  `NSUserTrackingUsageDescription`, a starter `SKAdNetworkItems` entry.

## To go live (your steps)
1. **AdMob console** → create account (can share payments with your AdSense
   account) → **Add app** → iOS, bundle id `com.wordocious.app`. Copy the real
   **App ID** `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`.
2. Create two **ad units**: a **Banner** and an **Interstitial** (or Rewarded
   Interstitial if you want the longer opt-in video). Copy each unit ID
   `ca-app-pub-XXXX/ZZZZ`.
3. **Replace the test IDs** in two files:
   - `project.yml` → `GADApplicationIdentifier:` → your real app ID, then run
     `xcodegen generate`.
   - `Wordocious/Sources/AdsManager.swift` → `AdsConfig.bannerUnitID` and
     `interstitialUnitID` → your real unit IDs.
4. Add the **full SKAdNetwork ID list** Google publishes (for attribution) to
   `SKAdNetworkItems` in project.yml — I included one entry as a placeholder.
5. App Store Connect: fill the **privacy nutrition labels** (this app collects
   IDFA / uses data for ads) and keep the ATT prompt (already wired).
6. Register **test devices** in AdMob while developing so you never click live
   ads on your own device (using real IDs in dev without test-device
   registration is an invalid-traffic policy violation).

## Notes / parity with web
- The web uses AdSense (`AdGate` interstitial + bottom `AdBanner`); native uses
  AdMob — same free-vs-Pro gating, same "ad on game start + bottom banner" model.
- The game-start ad uses a **Rewarded Interstitial** (`GADRewardedInterstitialAd`)
  — the full skippable-video format (verified: video plays, "Reward in Ns" →
  "Reward granted" → close). Real unit ID type to create: **Rewarded
  Interstitial**. (To use the shorter plain interstitial instead, swap back to
  `GADInterstitialAd` + unit `.../4411468910`.)
- It fires on **solo `GameScreen`, `VSGameView` (before matchmaking), and
  `ProperNoundleView`** — all gated to free users; the game timer starts only
  after the ad is dismissed. Gauntlet/Six/Seven run through `GameScreen` so
  they're covered.
