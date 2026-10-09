import Foundation

/// Are ads actually serving? (wave 6, 2026-10-09) Swift port of packages/core/src/ads.ts,
/// pinned to it by ad-copy-fixtures.json (AdCopyFixtureTests).
///
/// No ad serves anywhere right now (AdSense banned, AppLovin refused; LevelPlay returns in a
/// ~November 2.8.x), so "ad-free" / "no ads" is a Pro selling point with no difference behind
/// it. Every Pro-benefit, upsell, paywall, limit-modal, welcome and invite line that mentions
/// ads reads this flag: false drops the ad clause (and list rows like "Ad-free experience");
/// true restores today's wording. Flip on all three platforms together, only when an ad network
/// is live again.
public enum AdCopy {
    public static let adsServing = false
}
