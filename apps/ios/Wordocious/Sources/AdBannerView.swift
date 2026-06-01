import SwiftUI
import GoogleMobileAds

/// Bottom banner for free users — adaptive AdMob banner. Renders nothing for Pro
/// users or when ads are disabled (mirrors the web AdBanner). Mount once near the
/// app root; it sizes itself to a standard banner height.
struct AdBannerContainer: View {
    @ObservedObject private var auth = AuthService.shared
    var body: some View {
        if AdsConfig.enabled && !auth.isProActive {
            AdBannerRepresentable()
                .frame(height: 50)
                .frame(maxWidth: .infinity)
                .background(Theme.surface)
                .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 1) }
        }
    }
}

private struct AdBannerRepresentable: UIViewRepresentable {
    func makeUIView(context: Context) -> GADBannerView {
        let banner = GADBannerView(adSize: GADAdSizeBanner)
        banner.adUnitID = AdsConfig.bannerUnitID
        banner.rootViewController = AdsManager.rootViewController()
        banner.load(GADRequest())
        return banner
    }
    func updateUIView(_ uiView: GADBannerView, context: Context) {
        if uiView.rootViewController == nil { uiView.rootViewController = AdsManager.rootViewController() }
    }
}
