// ============================================================
// Are ads actually serving? (wave 6, 2026-10-09)
// ============================================================
// Google AdSense is banned for good and AppLovin refused us, so NO ad serves anywhere right
// now (the LevelPlay integration returns in a ~November 2.8.x). A free player therefore sees
// the same ad-free app a Pro player does, which makes "ad-free" / "no ads" a Pro selling point
// with no difference behind it — a misleading claim (App Store 3.1.1 / 2.3).
//
// Every Pro-benefit, upsell, paywall, limit-modal, welcome and invite line that mentions ads
// reads this flag: false → the ad clause is dropped (and list rows like "Ad-free experience"
// are removed so lists stay symmetric); true → today's wording. Flip it to true, on all three
// platforms in the same commit, only when an ad network is live again.
//
// Ported to Swift (AdCopy.adsServing) and Kotlin (ADS_SERVING); pinned by ad-copy-fixtures.json.
// Not touched by this flag: the privacy policy (it describes what MAY happen), the consent
// gates and the AdGate/AdsManager logic.

export const ADS_SERVING = false;
