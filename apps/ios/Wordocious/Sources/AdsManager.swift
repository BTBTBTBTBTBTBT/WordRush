import Foundation
import SwiftUI
import UIKit
import AdSupport
import AppTrackingTransparency
import IronSource

/// Unity LevelPlay (ironSource mediation) configuration — docs/LEVELPLAY_SETUP.md.
///
/// Third ad stack in a month, for reasons outside this file: Google banned the
/// publisher entity on 2026-09-01 (AdSense/AdMob/Ad Manager, no route back),
/// and AppLovin MAX — the §252 replacement — never activated an account and
/// stopped accepting signups on 2026-09-23. LevelPlay is a separate company
/// with its own policy. The AdMob / Google adapter must NEVER be enabled here
/// or in the dashboard: that would route Google demand through a banned entity.
///
/// Ads stay DORMANT until both dashboard ids below are filled in, so this ships
/// safely before the LevelPlay account exists — nothing initializes, nothing
/// requests, nothing draws.
enum AdsConfig {
    /// LevelPlay dashboard → the iOS app → App Settings → App Key.
    static let appKey = ""
    /// LevelPlay dashboard → the iOS app → Ad Units → the *Interstitial* unit.
    static let interstitialAdUnitID = ""
    /// LevelPlay dashboard → Ad Units → the *Rewarded* unit. Has a home here so
    /// the id can be pasted with the others, but nothing shows it yet: what a
    /// free player earns for watching is a product decision Brian has not made.
    static let rewardedAdUnitID = ""

    /// Dormant until someone pastes the dashboard values in above.
    static var configured: Bool { !appKey.isEmpty && !interstitialAdUnitID.isEmpty }

    /// §228, kept absolute.
    ///
    /// Under AdMob a DEBUG build could point at Google's *sample unit IDs* and
    /// serve harmless fake ads. LevelPlay, like MAX, has no such thing — test
    /// traffic is identified by DEVICE (dashboard → Setup → Test Devices), not
    /// by ad unit. So DEBUG builds request no inventory whatsoever.
    ///
    /// Three months of unregistered family-beta devices hitting live inventory
    /// is precisely what cost us the AdMob account. This closes that door.
    #if DEBUG
    static let requestsAds = false
    #else
    static let requestsAds = true
    #endif

    /// IDFAs of every developer and family device. LevelPlay has no client-side
    /// test-device API (only the dashboard list and its Test Suite), so this
    /// list does two things: it documents which devices MUST be registered in
    /// the dashboard before the first live impression, and it is checked
    /// locally so those devices never request inventory at all — belt and
    /// braces against a repeat of the AdMob invalid-traffic strike. Add a
    /// device HERE (and in the dashboard) before installing a TestFlight build
    /// on it.
    static let testDeviceIDFAs: [String] = []

    /// True when this device's IDFA is in `testDeviceIDFAs`. Without tracking
    /// authorization the IDFA reads as all zeros and never matches, which is
    /// fine: an unmatched test device still hits the dashboard-side registration.
    static var isLocalTestDevice: Bool {
        guard !testDeviceIDFAs.isEmpty else { return false }
        let idfa = ASIdentifierManager.shared().advertisingIdentifier.uuidString
        return testDeviceIDFAs.contains { $0.caseInsensitiveCompare(idfa) == .orderedSame }
    }

    /// Whether an ad may be shown right now (configured + a build that may
    /// request + region allowed + not a listed test device + not Pro + not an
    /// admin/tester account — §228).
    @MainActor static var active: Bool {
        configured && requestsAds
            && ConsentGate.decision == .allowed
            && !isLocalTestDevice
            && !AuthService.shared.isProActive
            && !AuthService.shared.isAdsExempt
    }
}

/// Owns the LevelPlay SDK lifecycle and the game-start interstitial.
///
/// Public surface is unchanged from the MAX and AdMob eras — `start()`,
/// `privacyOptionsRequired`, `showPrivacyOptions`, `showGameStartInterstitial`
/// — so no call site moves.
///
/// Format note: this is a STANDARD interstitial, deliberately. It was briefly a
/// *rewarded* unit under AdMob, which is the wrong contract for a game-start
/// gate — rewarded suppresses the close button for the full ~30s because the
/// user is nominally earning something, and we granted nothing for watching.
/// A real rewarded placement needs a real perk to hand out (see
/// `AdsConfig.rewardedAdUnitID`); that is a product decision, not plumbing.
@MainActor
final class AdsManager: NSObject, ObservableObject {
    static let shared = AdsManager()

    private var interstitial: LPMInterstitialAd?
    private var started = false
    private var initialized = false
    private var retryAttempt = 0.0
    private var onDismiss: (() -> Void)?

    /// Call once the app is foreground-active.
    ///
    /// Order, and why: (1) the region gate — LevelPlay has no CMP, so users in
    /// the EEA/UK/CH/EFTA never see the SDK start until phase 2 wires one;
    /// (2) privacy defaults, which LevelPlay wants BEFORE init; (3) Apple's ATT
    /// prompt, once, so personalized demand can bid where the user allows it;
    /// (4) `LevelPlay.initWith`, then the first interstitial preload from the
    /// init callback (LevelPlay requires ad objects be created after
    /// initialization succeeds).
    func start() {
        guard AdsConfig.configured, AdsConfig.requestsAds, !started else { return }
        guard ConsentGate.decision == .allowed else { return }
        guard !AdsConfig.isLocalTestDevice else { return }
        started = true

        // Regulation defaults, set before initialization as the SDK docs
        // recommend (LPMPrivacySettings replaces the deprecated
        // LevelPlay.setConsent / setMetaData("do_not_sell") pair from SDK 9.4).
        // No CMP means no affirmative GDPR consent record: say so. CCPA "do not
        // sell" is honored for everyone. The app is not child-directed.
        LPMPrivacySettings.setGDPRConsent(false)
        LPMPrivacySettings.setCCPA(true)
        LPMPrivacySettings.setCOPPA(false)

        requestTrackingAuthorizationIfNeeded { [weak self] in
            Task { @MainActor in self?.initializeSDK() }
        }
    }

    /// Shows the ATT prompt if the user has not answered it yet; completes
    /// immediately otherwise. The system only presents once per install, so
    /// calling this on every cold start is harmless and lets a user who
    /// dismissed the app mid-prompt see it again.
    private func requestTrackingAuthorizationIfNeeded(_ completion: @escaping () -> Void) {
        guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else {
            completion(); return
        }
        ATTrackingManager.requestTrackingAuthorization { _ in completion() }
    }

    private func initializeSDK() {
        guard !initialized else { return }
        let request = LPMInitRequestBuilder(appKey: AdsConfig.appKey).build()
        LevelPlay.initWith(request) { [weak self] _, error in
            Task { @MainActor in
                guard let self, error == nil else { return }
                self.initialized = true
                self.preloadInterstitial()
            }
        }
    }

    /// Whether Settings should show an "Ad Privacy Settings" row.
    ///
    /// Always false for now: there is no consent form to reopen. LevelPlay
    /// ships no CMP, and the regions whose law requires a revisitable choice
    /// never start the SDK (`ConsentGate`), so a row here would be a dead end.
    /// Phase 2 (Usercentrics) flips this on for gated regions.
    var privacyOptionsRequired: Bool { false }

    /// Re-present the consent flow. No-op until a CMP exists in phase 2;
    /// completes with nil (success) so a caller never shows an error for it.
    func showPrivacyOptions(_ completion: @escaping (String?) -> Void) {
        completion(nil)
    }

    /// One long-lived interstitial instance, reloaded after each show — the
    /// object is documented as reusable across loads and shows for the session.
    private func preloadInterstitial() {
        guard AdsConfig.configured, initialized else { return }
        if interstitial == nil {
            let ad = LPMInterstitialAd(adUnitId: AdsConfig.interstitialAdUnitID)
            ad.setDelegate(self)
            interstitial = ad
        }
        interstitial?.loadAd()
    }

    /// Present the game-start interstitial for free users. Calls `completion`
    /// exactly once: when the ad closes, when it fails to display, or
    /// immediately when dormant / not allowed / Pro / nothing loaded — so the
    /// game proceeds either way. Mirrors the web AdGate.
    func showGameStartInterstitial(completion: @escaping () -> Void) {
        guard AdsConfig.active, let ad = interstitial, ad.isAdReady(),
              let host = Self.topViewController() else {
            completion(); return
        }
        onDismiss = completion
        ad.showAd(viewController: host, placementName: nil)
    }

    /// Fires the pending completion exactly once, whatever the outcome, so a
    /// failed or dismissed ad can never strand the player on a blank screen.
    private func finish() {
        let done = onDismiss
        onDismiss = nil
        done?()
    }

    /// LevelPlay presents from a UIViewController (MAX found one itself). Walk
    /// the foreground scene's key window to the top-most presented controller
    /// so the interstitial covers whatever sheet the game is shown in.
    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .first { $0.activationState == .foregroundActive } as? UIWindowScene
        let window = scene?.windows.first { $0.isKeyWindow } ?? scene?.windows.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

// LPMInterstitialAdDelegate callbacks: the SDK does not document their thread,
// so each one hops onto the main actor with a Task rather than assuming it.
// The methods are nonisolated so the Objective-C conformance does not cross
// actor isolation — same shape as the MAX and GADFullScreen paths before it.
extension AdsManager: LPMInterstitialAdDelegate {
    nonisolated func didLoadAd(with adInfo: LPMAdInfo) {
        Task { @MainActor in retryAttempt = 0 }
    }

    /// Exponential backoff, capped at 64s, so a no-fill streak never turns
    /// into a request storm (the same curve we ran under MAX).
    nonisolated func didFailToLoadAd(withAdUnitId adUnitId: String, error: Error) {
        Task { @MainActor in
            retryAttempt += 1
            let delay = pow(2.0, min(6.0, retryAttempt))
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                MainActor.assumeIsolated { self?.interstitial?.loadAd() }
            }
        }
    }

    nonisolated func didDisplayAd(with adInfo: LPMAdInfo) {}
    nonisolated func didClickAd(with adInfo: LPMAdInfo) {}
    nonisolated func didChangeAdInfo(_ adInfo: LPMAdInfo) {}

    nonisolated func didCloseAd(with adInfo: LPMAdInfo) {
        Task { @MainActor in
            finish()
            preloadInterstitial()   // load the next one
        }
    }

    nonisolated func didFailToDisplayAd(with adInfo: LPMAdInfo, error: Error) {
        Task { @MainActor in
            finish()
            preloadInterstitial()
        }
    }
}
