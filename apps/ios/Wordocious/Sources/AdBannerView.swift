import SwiftUI
import GoogleMobileAds

/// Bottom banner for free users — adaptive AdMob banner. Renders nothing for Pro
/// users or when ads are disabled (mirrors the web AdBanner). Mount once near the
/// app root; it sizes itself to a standard banner height.
struct AdBannerContainer: View {
    /// The banner slot's fixed height — the single source of truth that
    /// `bottomChromeClearance` uses to reserve scroll room on free accounts.
    static let height: CGFloat = 50
    /// Whether the banner slot is mounted right now (free account, ads on).
    /// Must stay in lockstep with the `body` condition below.
    @MainActor static var isShowing: Bool { AdsConfig.enabled && !AuthService.shared.isProActive }

    @ObservedObject private var auth = AuthService.shared
    var body: some View {
        if AdsConfig.enabled && !auth.isProActive {
            AdBannerRepresentable()
                .frame(height: Self.height)
                .frame(maxWidth: .infinity)
                .background(Theme.surface)
                .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 1) }
        }
    }
}



/// Bottom clearance for scrollable content on screens that coexist with the
/// bottom chrome (BottomNav + ad banner in RootTabView's safeAreaInset).
///
/// Each screen's `base` is the nav clearance it already used — those numbers
/// were tuned on Pro accounts, where no banner mounts. The banner's height is
/// added on top whenever the banner is showing, because the TabView-level
/// safeAreaInset does not reliably propagate into the tabs' scroll views (and
/// the banner can appear only after launch, once the profile resolves to
/// free), so without this the last ~50pt of every list hides under the ad.
/// Observes AuthService so the clearance tracks Pro upgrades live.
private struct BottomChromeClearance: ViewModifier {
    @ObservedObject private var auth = AuthService.shared
    let base: CGFloat
    func body(content: Content) -> some View {
        content.padding(.bottom, base + (AdBannerContainer.isShowing ? AdBannerContainer.height : 0))
    }
}

extension View {
    /// Replaces per-screen `.padding(.bottom, N)` magic numbers on scrollable
    /// tab content: keeps the screen's existing nav clearance and adds the ad
    /// banner height whenever the banner is mounted (free accounts).
    func bottomChromeClearance(base: CGFloat) -> some View {
        modifier(BottomChromeClearance(base: base))
    }
}

private struct AdBannerRepresentable: UIViewRepresentable {
    func makeUIView(context: Context) -> GADBannerView {
        // Anchored ADAPTIVE banner (not fixed 320x50): fills the device width
        // edge-to-edge — no black side bars — and typically monetizes better.
        let width = UIScreen.main.bounds.width
        let banner = GADBannerView(adSize: GADCurrentOrientationAnchoredAdaptiveBannerAdSizeWithWidth(width))
        // Clear, not the default black: if a creative renders narrower than the
        // slot (e.g. a 320x50 fill in the adaptive slot), the gaps show the
        // app's surface color instead of black side bars.
        banner.backgroundColor = .clear
        banner.adUnitID = AdsConfig.bannerUnitID
        banner.rootViewController = AdsManager.rootViewController()
        banner.load(GADRequest())
        return banner
    }
    func updateUIView(_ uiView: GADBannerView, context: Context) {
        if uiView.rootViewController == nil { uiView.rootViewController = AdsManager.rootViewController() }
    }
}
