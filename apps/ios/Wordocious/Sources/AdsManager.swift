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
/// The dashboard ids below are filled in (2026-10-13), so ads are gated by the
/// REMOTE KILL SWITCH instead: nothing initializes, requests or draws unless
/// the "ads" flag is live (`flagLive`). To go live, flip "ads" in
/// Admin → Flags: audience "testers" first, then "everyone". Unknown or
/// unreachable flags mean OFF (fail closed), so a fresh install with no flag
/// table never serves an ad. Every other gate in `active` still applies.
enum AdsConfig {
    /// LevelPlay dashboard → the iOS app → App Settings → App Key.
    static let appKey = "28b3f4525"
    /// LevelPlay dashboard → the iOS app → Ad Units → the *Interstitial* unit.
    static let interstitialAdUnitID = "bmgovp2d7wtby939"
    /// LevelPlay dashboard → Ad Units → the *Rewarded* unit. Has a home here so
    /// the id can be pasted with the others, but nothing shows it yet: what a
    /// free player earns for watching is a product decision Brian has not made.
    static let rewardedAdUnitID = "3nqphrfccd0xsl5g"

    /// True when the dashboard ids are present (they are, as of 2026-10-13).
    /// Not sufficient on its own: see `flagLive`.
    static var configured: Bool { !appKey.isEmpty && !interstitialAdUnitID.isEmpty }

    /// The remote kill switch: the "ads" row in app_flags (Admin → Flags).
    /// Uses the FAIL-CLOSED resolver (`isOn`, not `isLive`): flags unknown,
    /// unreachable or missing a row all read OFF. Audience "testers" is on for
    /// admins/testers only, which `isAdsExempt` then removes again — so the
    /// "testers first" stage proves the plumbing without any tester seeing an
    /// ad; "everyone" is the real go-live.
    @MainActor static var flagLive: Bool { FlagsService.shared.isOn("ads") }

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
    /// braces against a repeat of the AdMob invalid-traffic strike.
    ///
    /// HOW TO ADD A DEVICE (Brian's, JP's, any family phone): on that device,
    /// signed in as an admin, open Settings → Admin → Ads → "My ad ID" → Copy
    /// (allow tracking when asked). Paste the ID as a string HERE, AND in
    /// LevelPlay dashboard → Setup → Test devices. Both, before that device
    /// runs a build with the "ads" flag live. Currently empty: no devices added yet.
    static let testDeviceIDFAs: [String] = [
        "9FA1D3A0-F2FB-4C0D-A2AC-6018863D16CF", // Brian (BMT) iPhone, registered 2026-10-13
    ]

    /// True when this device's IDFA is in `testDeviceIDFAs`. Without tracking
    /// authorization the IDFA reads as all zeros and never matches, which is
    /// fine: an unmatched test device still hits the dashboard-side registration.
    static var isLocalTestDevice: Bool {
        guard !testDeviceIDFAs.isEmpty else { return false }
        let idfa = ASIdentifierManager.shared().advertisingIdentifier.uuidString
        return testDeviceIDFAs.contains { $0.caseInsensitiveCompare(idfa) == .orderedSame }
    }

    /// Whether an ad may be shown right now (configured + remote "ads" flag
    /// live + a build that may request + region allowed + not a listed test
    /// device + not Pro + not an admin/tester account — §228).
    @MainActor static var active: Bool {
        configured && flagLive && requestsAds
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
    /// True once this session's SDK init was started by the admin Test Suite
    /// (with `is_test_suite` metadata). A test-suite session never preloads or
    /// shows game-start ads: the suite is the only thing that loads inventory.
    private var testSuiteMode = false

    /// Call once the app is foreground-active.
    ///
    /// Order, and why: (1) the region gate — LevelPlay has no CMP, so users in
    /// the EEA/UK/CH/EFTA never see the SDK start until phase 2 wires one;
    /// (2) privacy defaults, which LevelPlay wants BEFORE init; (3) Apple's ATT
    /// prompt, once, so personalized demand can bid where the user allows it;
    /// (4) `LevelPlay.initWith`, then the first interstitial preload from the
    /// init callback (LevelPlay requires ad objects be created after
    /// initialization succeeds).
    ///
    /// The remote "ads" flag is checked FIRST and fails closed. It is read once
    /// per launch here (flags load before `startServices` in the launch task,
    /// from the cached table at worst); a flag that turns live mid-session
    /// takes effect on the next launch. Turning it OFF takes effect at the
    /// next foreground flag refresh: `AdsConfig.active` gates every show/load.
    /// Admin/tester accounts never initialize through here — the only way they
    /// start the SDK is the explicit Test Suite tap (`launchTestSuite`).
    func start() {
        guard AdsConfig.configured, AdsConfig.flagLive, AdsConfig.requestsAds, !started else { return }
        guard ConsentGate.decision == .allowed else { return }
        guard !AdsConfig.isLocalTestDevice else { return }
        guard !AuthService.shared.isAdsExempt else { return }
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

    // MARK: - Admin diagnostics (Settings → Admin → Ads)

    /// Opens LevelPlay's Integration Test Suite. ADMIN-ONLY and EXPLICIT-TAP-ONLY:
    /// this is the one path that may start the SDK for an ads-exempt account,
    /// and it ignores the remote flag / region (an admin chose to run it). It
    /// never preloads or shows a game-start ad; the suite drives its own loads.
    ///
    /// LevelPlay requires `is_test_suite` = `enable` metadata BEFORE init, so if
    /// the SDK already started this session without it (a normal `start()`), the
    /// suite cannot open until the next launch. Completes with nil on success or
    /// a human-readable reason.
    func launchTestSuite(completion: @escaping (String?) -> Void) {
        guard AuthService.shared.profile?.isAdmin == true else { completion("Admins only."); return }
        guard AdsConfig.configured else { completion("Ads are not configured."); return }
        if initialized && !testSuiteMode {
            completion("The ad SDK already started this session. Quit and relaunch the app, then open the Test Suite first.")
            return
        }
        guard let host = Self.topViewController() else { completion("Nothing to present from."); return }
        if initialized {
            Self.presentTestSuite(from: host); completion(nil); return
        }
        testSuiteMode = true
        LPMPrivacySettings.setGDPRConsent(false)
        LPMPrivacySettings.setCCPA(true)
        LPMPrivacySettings.setCOPPA(false)
        // TODO(verify against the LevelPlay 9.6.0 headers before shipping): exact names
        // `LevelPlay.setMetaDataWithKey(_:value:)` and `LevelPlay.launchTestSuite(_:)`
        // (IronSource.xcframework headers were not available offline).
        LevelPlay.setMetaDataWithKey("is_test_suite", value: "enable")
        let request = LPMInitRequestBuilder(appKey: AdsConfig.appKey).build()
        LevelPlay.initWith(request) { [weak self] _, error in
            Task { @MainActor in
                guard let self else { return }
                if let error { self.testSuiteMode = false; completion("SDK init failed: \(error.localizedDescription)"); return }
                self.initialized = true
                if let top = Self.topViewController() { Self.presentTestSuite(from: top); completion(nil) }
                else { completion("Nothing to present from.") }
            }
        }
    }

    private static func presentTestSuite(from host: UIViewController) {
        LevelPlay.launchTestSuite(host)
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
        // `active` (not just `configured`): a flag switched off, an admin whose
        // profile landed after init, or a Pro purchase must stop inventory requests.
        guard AdsConfig.active, initialized else { return }
        if interstitial == nil {
            let ad = LPMInterstitialAd(adUnitId: AdsConfig.interstitialAdUnitID)
            ad.setDelegate(self)
            interstitial = ad
        }
        interstitial?.loadAd()
    }

    /// Present the game-start interstitial for free users. Calls `completion`
    /// exactly once: when the ad closes, when it fails to display, or
    /// immediately when flag-off / not allowed / Pro / nothing loaded — so the
    /// game proceeds either way. Mirrors the web AdGate.
    func showGameStartInterstitial(completion: @escaping () -> Void) {
        guard AdsConfig.active, !testSuiteMode, let ad = interstitial, ad.isAdReady(),
              let host = Self.topViewController() else {
            // Active but nothing requested yet (init finished before the flag /
            // profile allowed it): start the load now so a later game has one.
            if AdsConfig.active, !testSuiteMode, initialized, interstitial == nil { preloadInterstitial() }
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
                MainActor.assumeIsolated {
                    if AdsConfig.active { self?.interstitial?.loadAd() }
                }
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

// MARK: - Admin diagnostics

extension AdsConfig {
    /// This device's advertising ID, or nil when tracking is not authorized
    /// (iOS returns all zeros then).
    static var deviceIDFA: String? {
        guard ATTrackingManager.trackingAuthorizationStatus == .authorized else { return nil }
        let id = ASIdentifierManager.shared().advertisingIdentifier.uuidString
        return id.allSatisfy { $0 == "0" || $0 == "-" } ? nil : id
    }

    /// One line for Settings → Admin → Ads. Every gate, in the order `active` applies them.
    @MainActor static var statusLine: String {
        let auth = AuthService.shared
        let exempt: String = {
            if auth.profile?.isAdmin == true || auth.profile?.role == "admin" { return "admin" }
            if auth.isAdsExempt { return "tester" }
            if auth.isProActive { return "Pro" }
            return "no"
        }()
        return "\(configured ? "configured" : "NOT configured") \u{00B7} flag \(flagLive ? "live" : "off")"
            + " \u{00B7} region \(ConsentGate.decision == .allowed ? "allowed" : "blocked")"
            + " \u{00B7} exempt: \(exempt)"
            + " \u{00B7} test device \(isLocalTestDevice ? "yes" : "no")"
            + (requestsAds ? "" : " \u{00B7} DEBUG build (no requests)")
            + " \u{00B7} \(active ? "ADS ACTIVE" : "ads inactive")"
    }
}

/// Settings → Admin → Ads. Rendered only inside the admin-gated ADMIN section.
struct AdsAdminSection: View {
    @ObservedObject private var flags = FlagsService.shared
    @ObservedObject private var auth = AuthService.shared
    @State private var idfa: String? = AdsConfig.deviceIDFA
    @State private var copied = false
    @State private var notice: String?
    @State private var launching = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ads").font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
            Text(AdsConfig.statusLine)
                .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("My ad ID").font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                    Text(idfa ?? "Tap to read (asks for tracking permission once)")
                        .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
                        .textSelection(.enabled)
                        .lineLimit(2).minimumScaleFactor(0.7)
                }
                Spacer(minLength: 6)
                Button { Haptics.tap(); idTapped() } label: { CandyLabel(title: copied ? "Copied" : (idfa == nil ? "Read" : "Copy")) }
                    .buttonStyle(QuietButtonStyle(size: .small, fullWidth: false))
            }
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Ads test suite").font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                    Text("LevelPlay Integration Test Suite. Starts the ad SDK on this tap only.")
                        .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 6)
                Button { Haptics.tap(); openSuite() } label: { CandyLabel(title: launching ? "Opening\u{2026}" : "Open") }
                    .buttonStyle(QuietButtonStyle(size: .small, fullWidth: false))
                    .disabled(launching)
            }
        }
        .padding(.vertical, 4)
        .familyNotice("Ads", isPresented: Binding(get: { notice != nil }, set: { if !$0 { notice = nil } }),
                      message: notice ?? "")
    }

    private static let offMessage = "Tracking is off \u{2014} allow it in Settings \u{203A} Privacy \u{203A} Tracking to read the ad ID"

    private func idTapped() {
        if let id = idfa {
            UIPasteboard.general.string = id
            copied = true
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                copied = false
            }
            return
        }
        if ATTrackingManager.trackingAuthorizationStatus == .notDetermined {
            ATTrackingManager.requestTrackingAuthorization { _ in
                Task { @MainActor in refreshID() }
            }
        } else {
            refreshID()
        }
    }

    private func refreshID() {
        idfa = AdsConfig.deviceIDFA
        if idfa == nil { notice = Self.offMessage }
    }

    private func openSuite() {
        launching = true
        AdsManager.shared.launchTestSuite { err in
            launching = false
            if let err { notice = err }
        }
    }
}
