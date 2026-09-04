# AppLovin MAX setup (§252)

Replaces `ADMOB_SETUP.md`. AdMob is permanently unavailable: Google disabled
publisher pub-3015 on 2026-08-22, closed the ShowLoud LLC account pub-6632 on
08-25, and denied the appeal on 09-01 with *"not eligible for further
participation in our publisher programs, and may not create new accounts."*
That ban is entity-level across AdSense / AdMob / Ad Manager. Do not open a new
Google publisher account under any name — it would be caught by the same
linking that swept pub-6632 within three days, and it risks the Google accounts
the business actually depends on.

AppLovin is a separate company with its own policy and does not inherit it.

## The code is already done and dormant

Both apps ship with the MAX integration in place but **inert**: `SDK_KEY` and
`INTERSTITIAL_UNIT` are empty strings, and every entry point checks
`configured` first. Nothing initializes, nothing requests, nothing draws. The
apps are safe to release in this state — ads simply don't exist until the four
values below are pasted in.

## What Brian has to do (account work — cannot be automated)

1. Create the AppLovin account at <https://dash.applovin.com/signup> under
   **ShowLoud, LLC** with **bt@showloud.com**. Use the LLC's details; this is
   the entity that should own it long-term.
2. Add two apps — Wordocious iOS and Wordocious Android. Until each app is live
   in its store and linked, serving is *limited*, not off (same as AdMob).
3. Under **MAX > Ad Units**, create one **Interstitial** unit per platform.
   (Not rewarded — see the format note below.)
4. Collect these values:
   - SDK key — **Account > General > Keys** (one key, shared by both apps)
   - iOS interstitial ad-unit ID
   - Android interstitial ad-unit ID
   - The **advertising ID of every device you or family will install on**
     (iOS = IDFA, Android = GAID)
   - The whole `app-ads.txt` block from **Account > General > App-ads.txt
     Info** — do not hand-write it. That page emits our account ID *and* a
     separate line per mediated network; every network has to be authorized
     or its demand will not bid.

Hand those over and the wiring is a few lines.

## Where each value goes

| Value | iOS | Android |
| --- | --- | --- |
| SDK key | `Sources/AdsManager.swift` → `AdsConfig.sdkKey` | `data/AdsManager.kt` → `SDK_KEY` |
| Interstitial unit | `AdsConfig.interstitialUnitID` | `INTERSTITIAL_UNIT` |
| Test devices | `AdsConfig.testDeviceIDFAs` | `TEST_DEVICE_GAIDS` |

Also paste AppLovin's full **SKAdNetwork** list (MAX > Networks publishes a
ready-made block) into `project.yml` → `SKAdNetworkItems`. Only AppLovin's own
`ludvb6z3bs.skadnetwork` is there now; every mediated network needs its own
entry or its iOS installs go unattributed.

## The safeguards that keep this from happening twice

Invalid traffic is what killed the AdMob account: from 2026-06-02 the builds
carried **live** ad unit IDs, and the family beta ran on them until 08-18 with
no device ever registered as a test device. Three layers now prevent a repeat,
and none of them depend on remembering anything at release time:

1. **Debug builds request nothing at all.** AdMob had sample unit IDs that
   served harmless fake ads, so a debug build could safely hit the network.
   MAX has no equivalent — test traffic there is identified by *device*, not by
   ad unit — so the gate is absolute (`requestsAds = !DEBUG`).
2. **Test devices are registered in code**, in the lists above. Their
   impressions are non-billable and are never scored as invalid activity. Add a
   device to the list *before* installing a TestFlight or internal-track build
   on it — those are release builds, so layer 1 does not cover them.
3. **The `isAdsExempt` role gate (§228) still applies.** Admin and tester
   accounts never request an ad on any platform, whatever the build type.

## Format note: interstitial, not rewarded

The game-start gate is a **standard interstitial** on purpose. It was briefly a
*rewarded* unit under AdMob and that was wrong: the rewarded contract suppresses
the close button for the full ~30s because the user is nominally earning
something, and nothing was granted for watching. Free players sat through the
whole ad for no benefit.

Rewarded video is worth revisiting — it carries the highest eCPM of any mobile
format ($10–30 vs $3–8 for interstitial), it is player-initiated so it costs
nothing in retention, and every time someone hits it, it advertises Pro. But it
needs a genuine perk to hand out, and choosing that perk is a product decision
about the free/Pro boundary: an extra unlimited puzzle, a streak shield, a hint.
A hint is the riskiest of the three — `hints_used` feeds the composite score, so
handing them out for ad views would distort the daily leaderboard.

## Consent

AppLovin's own CMP replaces Google's UMP entirely, which was forced rather than
chosen: UMP's consent forms are configured *inside the AdMob console*, so a dead
AdMob account cannot serve them. The MAX CMP handles the GDPR form and presents
the ATT prompt itself, in that order.

That ordering matters and is deliberately not second-guessed in our code. App
Review rejected build 8 for an ATT prompt that never appeared, and build 129 for
a GDPR form shown *after* ATT (5.1.1(iv)). The old UMP path needed a watchdog to
paper over a stalling network call, and that watchdog could itself invert the
order. Letting one component own both ends is the only way to guarantee it, so
there is no competing ATT request anywhere in the app.

Consent stays revisitable: Settings shows an ad-privacy row for users in GDPR
regions, wired to `showCMPForExistingUser`.
