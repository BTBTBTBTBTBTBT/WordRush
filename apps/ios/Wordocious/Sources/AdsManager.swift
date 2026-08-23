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
    // §228: DEBUG builds use Google's sample units — a developer's own device
    // must never touch live inventory (the untested-device beta traffic is what
    // got the publisher account disabled on 2026-08-22).
    #if DEBUG
    static let bannerUnitID = "ca-app-pub-3940256099942544/2934735716"
    #else
    static let bannerUnitID = "ca-app-pub-3015627373086578/4287985559"
    #endif
    /// STANDARD interstitial shown on game start ("Game Start Interstitial").
    ///
    /// This was a *rewarded* interstitial, which is the wrong format here: the
    /// rewarded contract requires the user to watch the whole thing to earn
    /// something, so AdMob suppresses the close button for the full ~30s — and
    /// we granted nothing for watching. A standard interstitial shows ✕ after a
    /// few seconds, which is what players expect from a game-start gate. (The
    /// old rewarded unit .../6909445311 still exists in AdMob, unused.)
    #if DEBUG
    static let interstitialUnitID = "ca-app-pub-3940256099942544/4411468910"
    #else
    static let interstitialUnitID = "ca-app-pub-3015627373086578/1609544807"
    #endif

    /// Whether ads should be shown right now (enabled + not Pro + not an
    /// admin/tester account — §228).
    @MainActor static var active: Bool {
        enabled && !AuthService.shared.isProActive && !AuthService.shared.isAdsExempt
    }
}

/// Owns AdMob SDK lifecycle + the interstitial shown on game start.
@MainActor
final class AdsManager: NSObject, ObservableObject {
    static let shared = AdsManager()

    private var interstitial: GADInterstitialAd?
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
    /// Set once the UMP requestConsentInfoUpdate callback has arrived. The ATT
    /// watchdog only fires while this is false.
    private var umpCallbackArrived = false
    /// Set when the watchdog had to request ATT because UMP stalled. From that
    /// point the GDPR form is SUPPRESSED for this session — App Review
    /// 5.1.1(iv) (build 129 rejection): a GDPR/consent prompt must never be
    /// shown after the user already answered the ATT request. Consent is
    /// simply re-attempted on the next launch, before ATT (which by then is
    /// already determined and never re-prompts).
    private var attFallbackFired = false

    func start() {
        guard AdsConfig.enabled, !started else { return }
        started = true
        // Gather GDPR / Google UMP consent first (required to serve ads in EEA/UK).
        // Order per BOTH Google and Apple 5.1.1(iv): consent form → (Apple) ATT →
        // init Mobile Ads SDK. Apple explicitly blesses GDPR-before-ATT and
        // rejects GDPR-after-ATT-denial.
        let params = UMPRequestParameters()
        params.tagForUnderAgeOfConsent = false
        UMPConsentInformation.sharedInstance.requestConsentInfoUpdate(with: params) { [weak self] _ in
            Task { @MainActor in self?.presentConsentFormThenStart() }
        }
        // Watchdog: if the UMP callback never fires (offline / unreachable during
        // review), still present ATT so we never silently skip the prompt
        // (App Review 5.1.2i, build 8 rejection). 8s — long enough that any
        // working network resolves UMP first, so the ATT-before-GDPR inversion
        // (build 129 rejection) can only happen when UMP is truly unreachable,
        // and then the form is suppressed for the session anyway.
        DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) { [weak self] in
            guard let self, !self.umpCallbackArrived else { return }
            self.attFallbackFired = true
            self.requestATTOnce()
        }
    }

    /// Show the consent form if the user's region requires one, then continue.
    private func presentConsentFormThenStart() {
        umpCallbackArrived = true
        if attFallbackFired {
            // UMP resolved only AFTER the watchdog already presented ATT.
            // Never show the GDPR form post-ATT (5.1.1(iv)) — skip it this
            // session; non-consent regions can still init ads below, consent
            // regions retry the form (pre-ATT) next launch.
            afterConsent()
            return
        }
        guard let vc = Self.rootViewController() else { afterConsent(); return }
        UMPConsentForm.loadAndPresentIfRequired(from: vc) { [weak self] _ in
            Task { @MainActor in self?.afterConsent() }
        }
    }

    /// True when Google says a privacy-options entry point must be offered.
    ///
    /// UMP requires a PERSISTENT way to change an ad-consent choice; a form
    /// shown once at first launch is a one-shot, not a choice, and our own
    /// privacy policy promised users one they could revisit. Gates the
    /// Settings row so it stays hidden outside consent regions, where Google's
    /// form would present nothing and the row would be a dead end.
    var privacyOptionsRequired: Bool {
        UMPConsentInformation.sharedInstance.privacyOptionsRequirementStatus == .required
    }

    /// Re-present the consent form so a user can withdraw or change consent.
    /// Completion carries nil on success, or a message worth showing.
    func showPrivacyOptions(_ completion: @escaping (String?) -> Void) {
        guard let vc = Self.rootViewController() else {
            completion("Could not open ad privacy settings.")
            return
        }
        UMPConsentForm.presentPrivacyOptionsForm(from: vc) { error in
            Task { @MainActor in completion(error?.localizedDescription) }
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
        GADInterstitialAd.load(withAdUnitID: AdsConfig.interstitialUnitID, request: GADRequest()) { [weak self] ad, _ in
            // GoogleMobileAds delivers the load completion on the main thread, so
            // touching main-actor state here is safe — assumeIsolated makes that
            // contract explicit without deferring onto a later runloop turn.
            MainActor.assumeIsolated {
                self?.interstitial = ad
                ad?.fullScreenContentDelegate = self
            }
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
        // No reward handler — standard interstitial. Dismissal (delegate) drives
        // the completion, same as before.
        ad.present(fromRootViewController: vc)
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

// GADFullScreenContentDelegate is an Obj-C protocol whose requirements are
// nonisolated, but GoogleMobileAds documents (and guarantees) that these
// callbacks fire on the main thread. We therefore satisfy them with nonisolated
// methods (so the conformance no longer crosses actor isolation) and hop onto
// the main actor via assumeIsolated to touch AdsManager's main-actor state.
extension AdsManager: GADFullScreenContentDelegate {
    nonisolated func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        MainActor.assumeIsolated {
            interstitial = nil
            preloadInterstitial()   // load the next one
            onDismiss?(); onDismiss = nil
        }
    }
    nonisolated func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        MainActor.assumeIsolated {
            interstitial = nil
            preloadInterstitial()
            onDismiss?(); onDismiss = nil
        }
    }
}
