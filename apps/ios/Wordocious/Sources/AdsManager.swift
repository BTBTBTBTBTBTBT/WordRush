import Foundation
import SwiftUI
import AppLovinSDK

/// AppLovin MAX configuration (§252).
///
/// Replaces AdMob, which died with the publisher account: Google disabled
/// pub-3015 on 2026-08-22, swept the ShowLoud LLC account pub-6632 on 08-25,
/// and denied the appeal on 09-01 with "not eligible for further participation
/// in our publisher programs, and may not create new accounts". That is an
/// entity-level ban across AdSense/AdMob/Ad Manager and there is no route back.
/// AppLovin is a separate company with its own policy and does not inherit it.
///
/// Ads stay DORMANT until both dashboard IDs below are filled in, so this ships
/// safely before the AppLovin account exists — nothing requests, nothing draws.
enum AdsConfig {
    /// AppLovin dashboard → Account > General > Keys.
    static let sdkKey = ""
    /// AppLovin dashboard → MAX > Ad Units → the iOS *interstitial* unit.
    static let interstitialUnitID = ""

    /// Dormant until someone pastes the dashboard values in above.
    static var configured: Bool { !sdkKey.isEmpty && !interstitialUnitID.isEmpty }

    /// §228, hardened for MAX.
    ///
    /// Under AdMob a DEBUG build could point at Google's *sample unit IDs* and
    /// serve harmless fake ads. MAX has no such thing — test traffic there is
    /// identified by DEVICE, not by ad unit. So the gate is now absolute:
    /// DEBUG builds request no inventory whatsoever, and any device that should
    /// see real (non-billable) test ads is registered by IDFA below.
    ///
    /// Three months of unregistered family-beta devices hitting live inventory
    /// is precisely what cost us the AdMob account. This closes that door.
    #if DEBUG
    static let requestsAds = false
    #else
    static let requestsAds = true
    #endif

    /// IDFAs flagged to AppLovin as test devices: their impressions are
    /// non-billable and are never counted as invalid activity. Add a device
    /// HERE before installing a TestFlight build on it.
    static let testDeviceIDFAs: [String] = []

    /// Whether an ad may be shown right now (configured + a build that may
    /// request + not Pro + not an admin/tester account — §228).
    @MainActor static var active: Bool {
        configured && requestsAds
            && !AuthService.shared.isProActive
            && !AuthService.shared.isAdsExempt
    }
}

/// Owns the AppLovin MAX SDK lifecycle and the game-start interstitial.
///
/// Format note: this is a STANDARD interstitial, deliberately. It was briefly a
/// *rewarded* unit under AdMob, which is the wrong contract for a game-start
/// gate — rewarded suppresses the close button for the full ~30s because the
/// user is nominally earning something, and we granted nothing for watching.
/// A real rewarded placement needs a real perk to hand out; that is a product
/// decision, not an ad-plumbing one.
@MainActor
final class AdsManager: NSObject, ObservableObject {
    static let shared = AdsManager()

    private var interstitial: MAInterstitialAd?
    private var started = false
    private var retryAttempt = 0.0
    private var onDismiss: (() -> Void)?
    /// Set from the init callback; drives whether the Settings privacy row shows.
    private var inGDPRRegion = false

    /// Call once the app is foreground-active.
    ///
    /// AppLovin's CMP owns the ENTIRE consent sequence: the GDPR form where
    /// required, then Apple's ATT prompt. We deliberately do not race it with
    /// an ATT request of our own the way the old UMP path had to. App Review
    /// rejected build 8 for an ATT prompt that never appeared and build 129 for
    /// a GDPR form shown *after* ATT (5.1.1(iv)); the only way to guarantee the
    /// ordering is to let a single component own both ends of it.
    func start() {
        guard AdsConfig.configured, AdsConfig.requestsAds, !started else { return }
        started = true

        // Consent settings must be configured BEFORE initialize().
        let settings = ALSdk.shared().settings
        settings.termsAndPrivacyPolicyFlowSettings.isEnabled = true
        settings.termsAndPrivacyPolicyFlowSettings.privacyPolicyURL =
            URL(string: "https://wordocious.com/privacy")
        settings.termsAndPrivacyPolicyFlowSettings.termsOfServiceURL =
            URL(string: "https://wordocious.com/terms")

        let config = ALSdkInitializationConfiguration(sdkKey: AdsConfig.sdkKey) { builder in
            builder.mediationProvider = ALMediationProviderMAX
            builder.testDeviceAdvertisingIdentifiers = AdsConfig.testDeviceIDFAs
        }
        ALSdk.shared().initialize(with: config) { [weak self] sdkConfig in
            Task { @MainActor in
                self?.inGDPRRegion = sdkConfig.consentFlowUserGeography == .GDPR
                self?.preloadInterstitial()
            }
        }
    }

    /// True when the user is in a region whose consent choice must stay
    /// revisitable. GDPR requires a withdrawal path, and our own privacy policy
    /// promises one; outside those regions the CMP would present nothing, so
    /// the Settings row stays hidden rather than becoming a dead end.
    var privacyOptionsRequired: Bool { AdsConfig.configured && inGDPRRegion }

    /// Re-present the consent flow so a user can change or withdraw consent.
    /// Completion carries nil on success, or a message worth showing.
    func showPrivacyOptions(_ completion: @escaping (String?) -> Void) {
        ALSdk.shared().cmpService.showCMPForExistingUser { error in
            Task { @MainActor in
                completion(error == nil ? nil : "Could not open ad privacy settings.")
            }
        }
    }

    /// One long-lived interstitial instance, reloaded after each show — the
    /// pattern MAX documents (unlike AdMob, where each show consumed the object).
    private func preloadInterstitial() {
        guard AdsConfig.configured else { return }
        if interstitial == nil {
            let ad = MAInterstitialAd(adUnitIdentifier: AdsConfig.interstitialUnitID)
            ad.delegate = self
            interstitial = ad
        }
        interstitial?.load()
    }

    /// Present the game-start interstitial for free users. Calls `completion`
    /// when the ad is dismissed — or immediately when Pro / dormant / nothing
    /// loaded — so the game proceeds either way. Mirrors the web AdGate.
    func showGameStartInterstitial(completion: @escaping () -> Void) {
        guard AdsConfig.active, let ad = interstitial, ad.isReady else {
            completion(); return
        }
        onDismiss = completion
        ad.show()
    }

    /// Fires the pending completion exactly once, whatever the outcome, so a
    /// failed or dismissed ad can never strand the player on a blank screen.
    private func finish() {
        let done = onDismiss
        onDismiss = nil
        done?()
    }
}

// MAAdDelegate callbacks arrive on the main thread. They are nonisolated so the
// conformance does not cross actor isolation, hopping on via assumeIsolated to
// touch AdsManager's main-actor state — same shape as the old GADFullScreen path.
extension AdsManager: MAAdDelegate {
    nonisolated func didLoad(_ ad: MAAd) {
        MainActor.assumeIsolated { retryAttempt = 0 }
    }

    /// Exponential backoff, capped at 64s, per AppLovin's documented pattern.
    nonisolated func didFailToLoadAd(forAdUnitIdentifier adUnitIdentifier: String, withError error: MAError) {
        MainActor.assumeIsolated {
            retryAttempt += 1
            let delay = pow(2.0, min(6.0, retryAttempt))
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                MainActor.assumeIsolated { self?.interstitial?.load() }
            }
        }
    }

    nonisolated func didDisplay(_ ad: MAAd) {}
    nonisolated func didClick(_ ad: MAAd) {}

    nonisolated func didHide(_ ad: MAAd) {
        MainActor.assumeIsolated {
            finish()
            preloadInterstitial()   // load the next one
        }
    }

    nonisolated func didFail(toDisplay ad: MAAd, withError error: MAError) {
        MainActor.assumeIsolated {
            finish()
            preloadInterstitial()
        }
    }
}
