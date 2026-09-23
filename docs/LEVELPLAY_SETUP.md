# Unity LevelPlay setup (ads stage, started 2026-09-23)

Replaces `apps/ios/APPLOVIN_SETUP.md`. The history in one paragraph: Google
disabled the personal publisher account on 2026-08-22, closed the ShowLoud LLC
account on 08-25 and denied the appeal on 09-01 ("not eligible for further
participation in our publisher programs, and may not create new accounts" — an
entity-level ban across AdSense / AdMob / Ad Manager, never to be worked
around). AppLovin MAX was chosen as the replacement on 09-04; the code shipped
dormant; the account never activated, and on 2026-09-23 AppLovin Support
wrote "we are not accepting new signups or reactivating older accounts at this
time." No ad has served on any platform since 2026-08-22.

Unity LevelPlay (the ironSource mediation platform, now part of Unity) is a
separate company with its own policy. It mediates Unity Ads, Liftoff, Mintegral,
InMobi and Meta Audience Network bidding. **The AdMob / Google Ad Manager
adapter must never be enabled** — that would put Google demand back through a
banned entity.

## The code is dormant until the keys exist

Both apps carry the LevelPlay integration in place but **inert**: the app keys
and ad-unit ids are empty strings and every entry point checks `configured`
first. Nothing initializes, nothing requests, nothing draws. The apps are safe
to release in this state.

## What Brian has to do (account work — cannot be automated)

1. Create the account at the Unity LevelPlay dashboard
   (<https://platform.ironsrc.com> → "Sign up", or via Unity Cloud →
   LevelPlay) under **ShowLoud, LLC** with **bt@showloud.com**. If onboarding
   asks about prior ad networks or account terminations, answer honestly.
2. **Add two apps** — Wordocious iOS (App Store URL) and Wordocious Android
   (Play URL). Both listings are live, which LevelPlay requires for full
   serving.
3. Under each app → **Ad Units**, create one **Interstitial** and one
   **Rewarded** unit per platform. (Banners are deliberately not created: a
   daily-habit game pays a retention tax for pennies. They can be added later.)
4. **Mediation networks**: Unity Ads is on by default. Turn on **Liftoff
   Monetize, Mintegral, InMobi and Meta Audience Network (bidding)** under
   Setup → SDK Networks. Each of those asks for its own publisher account and
   API credentials — do them one at a time; none of them is Google. Leave
   AdMob / Google Ad Manager OFF.
5. Collect these values and hand them over (all identifiers, none secret):
   - **iOS App Key** and **Android App Key** (App Settings → the key at the
     top of each app)
   - Interstitial ad-unit id per platform, Rewarded ad-unit id per platform
   - The **advertising id of every device you or family install on**
     (iOS = IDFA, Android = GAID) — these go in the code's test lists AND in
     the dashboard under Setup → Test Devices
   - The whole `app-ads.txt` block from the dashboard (Setup → app-ads.txt).
     Do not hand-write it — every mediated network adds its own line and an
     unauthorized network will not bid. Paste it into
     `apps/web/public/app-ads.txt`.
   - The current **SKAdNetwork id list** for iOS from the LevelPlay docs
     (Integration → iOS → SKAdNetwork). Paste into `apps/ios/project.yml` →
     `SKAdNetworkItems`, replacing the AppLovin-era entries.

## Where each value goes

| Value | iOS | Android |
| --- | --- | --- |
| App key | `Sources/AdsManager.swift` → `AdsConfig.appKey` | `data/AdsManager.kt` → `APP_KEY` |
| Interstitial unit | `AdsConfig.interstitialAdUnitID` | `INTERSTITIAL_AD_UNIT` |
| Rewarded unit (wired later) | `AdsConfig.rewardedAdUnitID` | `REWARDED_AD_UNIT` |
| Test devices | `AdsConfig.testDeviceIDFAs` | `TEST_DEVICE_GAIDS` |

## Consent (the one thing AppLovin did for us that LevelPlay does not)

MAX shipped its own consent flow; LevelPlay does not. Google's UMP is unusable
(its forms live in the dead AdMob console). Until a consent-management platform
is integrated, the apps **do not initialize ads for users in the EEA, UK or
Switzerland** — those regions simply stay ad-free (`ConsentGate` on both
platforms, decided from the device region). Everywhere else the SDK starts
with `setConsent(false)` / `do_not_sell` honoured and serves.

Phase 2, when Brian wants EU inventory: create a **Usercentrics** App CMP
account (Unity's partner CMP; free tier for small apps), paste its settings id
into `ConsentGate`, and the gate lifts. That is a separate task.

iOS also shows the App Tracking Transparency prompt once, before the SDK
initializes, so personalized demand can bid where the user allows it.

## The safeguards that keep this from happening a third time

Invalid traffic is what killed the Google accounts. These rules are in code and
must stay:

- Debug builds and the `tester`/`admin` roles never request an ad
  (`AdsConfig.requestsAds`), on any platform.
- Every developer and family device is registered as a test device in BOTH the
  code lists and the LevelPlay dashboard before the first live impression.
- One account. Never a second LevelPlay account for the same apps.
- If LevelPlay ever asks about the Google history, tell it straight.

## Formats

- **Interstitial** before each daily game for free users — wired now, same
  entry point as before (`showGameStartInterstitial`), frequency unchanged.
- **Rewarded video** — the real prize ($10–30 eCPM, player-initiated). The
  unit is created and the id has a home in the code, but showing it needs a
  product decision on what a free player earns (a hint? an Unlimited game?).
  Not wired until Brian decides.
- **Banners** — off by choice; can be added with one unit and one view later.
