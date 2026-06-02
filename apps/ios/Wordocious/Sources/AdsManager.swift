import Foundation
import SwiftUI
import GoogleMobileAds
import AppTrackingTransparency

/// AdMob configuration. Defaults to Google's TEST ad unit IDs so test ads render
/// in the simulator without an AdMob account. Replace with the real unit IDs
/// (and the GADApplicationIdentifier in Info.plist) before release — see
/// ADMOB_SETUP.md. Ads only show for non-Pro users (mirrors the web AdGate).
enum AdsConfig {
    /// Master switch. Real unit IDs + flipping the app ID is all that's needed for prod.
    static let enabled = true

    // Real AdMob unit IDs (Wordocious AdMob app, created 2026-06-03).
    static let bannerUnitID = "ca-app-pub-3015627373086578/4287985559"
    /// Rewarded interstitial = the full skippable-video format shown on game
    /// start ("Wordocious Game Start" unit).
    static let interstitialUnitID = "ca-app-pub-3015627373086578/6909445311"

    /// Whether ads should be shown right now (enabled + not Pro).
    @MainActor static var active: Bool { enabled && !AuthService.shared.isProActive }
}

/// Owns AdMob SDK lifecycle + the interstitial shown on game start.
@MainActor
final class AdsManager: NSObject, ObservableObject {
    static let shared = AdsManager()

    private var interstitial: GADRewardedInterstitialAd?
    private var started = false

    /// Call once at launch. Starts the SDK and (after a beat) requests ATT.
    func start() {
        guard AdsConfig.enabled, !started else { return }
        started = true
        GADMobileAds.sharedInstance().start(completionHandler: nil)
        // Request tracking authorization shortly after launch (Apple requires the
        // app to be active). Ads still serve (non-personalized) if denied.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            ATTrackingManager.requestTrackingAuthorization { _ in }
        }
        preloadInterstitial()
    }

    private func preloadInterstitial() {
        guard AdsConfig.enabled else { return }
        GADRewardedInterstitialAd.load(withAdUnitID: AdsConfig.interstitialUnitID, request: GADRequest()) { [weak self] ad, _ in
            self?.interstitial = ad
            ad?.fullScreenContentDelegate = self
        }
    }

    /// Present the game-start interstitial for free users. Calls `completion`
    /// when the ad is dismissed (or immediately if no ad / Pro / disabled), so
    /// the game can proceed either way. Mirrors the web AdGate.
    func showGameStartInterstitial(completion: @escaping () -> Void) {
        guard AdsConfig.active, let ad = interstitial, let vc = Self.rootViewController() else {
            completion(); return
        }
        onDismiss = completion
        ad.present(fromRootViewController: vc, userDidEarnRewardHandler: { /* cosmetic reward; play proceeds either way */ })
    }

    private var onDismiss: (() -> Void)?

    static func rootViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
        let keyWindow = scene?.windows.first { $0.isKeyWindow } ?? scene?.windows.first
        var top = keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

extension AdsManager: GADFullScreenContentDelegate {
    func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        interstitial = nil
        preloadInterstitial()   // load the next one
        onDismiss?(); onDismiss = nil
    }
    func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        interstitial = nil
        preloadInterstitial()
        onDismiss?(); onDismiss = nil
    }
}
