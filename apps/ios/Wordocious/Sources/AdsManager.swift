import Foundation
import SwiftUI
import GoogleMobileAds
import AppTrackingTransparency
import UserMessagingPlatform

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

    /// Call once the app is foreground-active. Resolves Google UMP consent, then
    /// reliably presents the Apple ATT prompt, then initializes the Mobile Ads SDK.
    ///
    /// IMPORTANT (App Review 5.1.2i): the ATT prompt only displays when the app is
    /// `.active`. Requesting it during cold-launch `.task` (app still `.inactive`)
    /// makes iOS silently return `.denied` WITHOUT showing the prompt — which is
    /// why the reviewer never saw it. We now drive this from the first `.active`
    /// scene phase, and a watchdog guarantees ATT is requested even if the UMP
    /// network round-trip stalls or never calls back.
    func start() {
        guard AdsConfig.enabled, !started else { return }
        started = true
        // Gather GDPR / Google UMP consent first (required to serve ads in EEA/UK).
        // Order per Google: consent → (Apple) ATT → init Mobile Ads SDK.
        let params = UMPRequestParameters()
        params.tagForUnderAgeOfConsent = false
        UMPConsentInformation.sharedInstance.requestConsentInfoUpdate(with: params) { [weak self] _ in
            Task { @MainActor in self?.presentConsentFormThenStart() }
        }
        // Watchdog: if the UMP callback never fires (offline / unreachable during
        // review), still present ATT so we never silently skip the prompt.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
            self?.requestATTOnce()
        }
    }

    /// Show the consent form if the user's region requires one, then continue.
    private func presentConsentFormThenStart() {
        guard let vc = Self.rootViewController() else { afterConsent(); return }
        UMPConsentForm.loadAndPresentIfRequired(from: vc) { [weak self] _ in
            Task { @MainActor in self?.afterConsent() }
        }
    }

    /// After consent is resolved: request ATT, then (if we may request ads)
    /// initialize the Mobile Ads SDK and preload the interstitial.
    private func afterConsent() {
        requestATTOnce { [weak self] in
            guard UMPConsentInformation.sharedInstance.canRequestAds else { return }
            GADMobileAds.sharedInstance().start(completionHandler: nil)
            self?.preloadInterstitial()
        }
    }

    private var attRequested = false

    /// Presents the system ATT prompt exactly once. No-ops if already requested or
    /// already determined. Guarantees the app is `.active` first (the prompt is
    /// silently suppressed otherwise), retrying shortly if not yet active.
    func requestATTOnce(then completion: (@MainActor () -> Void)? = nil) {
        guard !attRequested else { completion?(); return }
        guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else {
            attRequested = true; completion?(); return
        }
        guard UIApplication.shared.applicationState == .active else {
            // Not active yet — try again shortly so the prompt actually shows.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
                self?.requestATTOnce(then: completion)
            }
            return
        }
        attRequested = true
        ATTrackingManager.requestTrackingAuthorization { _ in
            Task { @MainActor in completion?() }
        }
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
