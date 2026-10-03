import Foundation
import CoreGraphics

/// FINISH_SPEC BJ9 / BJ10 — the one source of truth for the game open/close
/// ("grow + soft rise") and the menu/sheet "soft pop" timing and geometry.
/// Mirrored by Android `core/MotionSpec.kt` and web `lib/motion-spec.ts`
/// (same numbers; each platform's unit tests pin them).
///
/// Rules (founder, 10-03, "making sure it isn't choppy at all"):
/// - Only a cheap shell (a rounded shape in the card's color) and snapshots move;
///   the live game view is never transformed, only revealed by fading what's over it.
/// - The game is built under the shell before the reveal; the reveal waits for it.
/// - Transform / opacity / frame-of-one-plain-shape only, one driver, no blur.
public enum MotionSpec {
    // MARK: BJ9 — game open

    /// The tapped card lifts first: scale 1.03, up 4 pt, ~0.12 s.
    public static let liftScale: CGFloat = 1.03
    public static let liftRise: CGFloat = 4
    public static let liftDuration: Double = 0.12

    /// Then the shell grows from the lifted card to full screen on a soft settling
    /// spring (~0.44 s, ease-out-expo-like; damping just under critical).
    public static let growDuration: Double = 0.44
    public static let growDamping: CGFloat = 0.88
    /// The shell fades in over the card snapshot during the grow's first part.
    public static let shellFadeIn: Double = 0.10

    /// The real game fades in over the LAST 60% of the grow.
    public static let revealFraction: Double = 0.6

    // MARK: BJ9 — game close

    /// The game fades out (0.18 s), then the shell shrinks back into the same card's
    /// CURRENT frame (0.38 s) and disappears.
    public static let closeFadeDuration: Double = 0.18
    public static let shrinkDuration: Double = 0.38
    /// The shell's own fade at the very end of the shrink (the card shows through).
    public static let shrinkFadeFraction: Double = 0.3

    // MARK: BJ9 — no source frame (widget / deep link / handoffs)

    /// A centered soft rise: scale 0.96 → 1, up 14 pt, fade.
    public static let riseScale: CGFloat = 0.96
    public static let riseOffset: CGFloat = 14
    public static let riseDuration: Double = 0.34

    /// Reduce Motion: a plain cross-fade, both ways.
    public static let crossFadeDuration: Double = 0.22

    /// An armed source card is consumed by a cover presented within this window
    /// (a tap that ends in a modal / paywall instead never leaks into a later open).
    public static let armWindow: Double = 0.8
    /// A frame-only source (Strategy's PLAY: the sheet closes before the game opens)
    /// waits for the dismiss + the handoff.
    public static let frameOnlyArmWindow: Double = 1.6

    // MARK: BJ10 — soft pop

    /// The sheet / menu springs up from the bottom center: scale 0.94 → 1 + fade.
    public static let popScale: CGFloat = 0.94
    public static let popDuration: Double = 0.42
    public static let popDamping: CGFloat = 0.82
    /// Dismiss reverses quickly.
    public static let popDismissDuration: Double = 0.2
    /// The background dim behind a popped sheet / menu.
    public static let dimAlpha: Double = 0.28

    // MARK: - Helpers

    /// How a game opens.
    public enum OpenKind: Equatable { case grow, rise, crossFade }

    public static func openKind(hasSource: Bool, reduceMotion: Bool) -> OpenKind {
        if reduceMotion { return .crossFade }
        return hasSource ? .grow : .rise
    }

    /// The card's frame after the lift: scaled about its center, raised `liftRise`.
    public static func liftedFrame(_ card: CGRect) -> CGRect {
        let w = card.width * liftScale, h = card.height * liftScale
        return CGRect(x: card.midX - w / 2, y: card.midY - h / 2 - liftRise, width: w, height: h)
    }

    /// When (seconds after the tap) the game starts fading in, and for how long.
    public static func revealTiming(kind: OpenKind) -> (delay: Double, duration: Double) {
        switch kind {
        case .grow:
            return (liftDuration + growDuration * (1 - revealFraction), growDuration * revealFraction)
        case .rise:
            return (riseDuration * (1 - revealFraction), riseDuration * revealFraction)
        case .crossFade:
            return (0, crossFadeDuration)
        }
    }

    /// Total open time from the tap to the game fully shown.
    public static func openDuration(kind: OpenKind) -> Double {
        let r = revealTiming(kind: kind)
        return r.delay + r.duration
    }

    /// Total close time from the dismiss to Home fully back.
    public static func closeDuration(kind: OpenKind) -> Double {
        switch kind {
        case .grow: return closeFadeDuration + shrinkDuration
        case .rise: return closeFadeDuration + riseDuration * 0.7
        case .crossFade: return crossFadeDuration
        }
    }

    /// The soft rise's starting frame: the screen scaled 0.96 about its center,
    /// 14 pt lower.
    public static func riseStartFrame(_ screen: CGRect) -> CGRect {
        let w = screen.width * riseScale, h = screen.height * riseScale
        return CGRect(x: screen.midX - w / 2, y: screen.midY - h / 2 + riseOffset, width: w, height: h)
    }

    /// A source frame worth growing from: non-degenerate and at least partly on
    /// screen (a card scrolled away, or a probe that left the window, falls back to
    /// the soft rise).
    public static func usableSource(_ frame: CGRect?, in screen: CGRect) -> CGRect? {
        guard let f = frame, f.width >= 24, f.height >= 24, f.width.isFinite, f.height.isFinite else { return nil }
        let visible = f.intersection(screen)
        guard !visible.isNull, visible.width * visible.height >= f.width * f.height * 0.25 else { return nil }
        return f
    }

    /// Ease-out-expo (the web / Android curve for the grow; iOS uses the spring).
    public static func expoOut(_ t: Double) -> Double {
        t >= 1 ? 1 : 1 - pow(2, -10 * max(0, t))
    }

    /// Linear interpolation of a rect (progress 0 → `from`, 1 → `to`).
    public static func lerp(_ from: CGRect, _ to: CGRect, _ p: CGFloat) -> CGRect {
        CGRect(x: from.minX + (to.minX - from.minX) * p, y: from.minY + (to.minY - from.minY) * p,
               width: from.width + (to.width - from.width) * p, height: from.height + (to.height - from.height) * p)
    }

    /// The anchor point (unit coordinates) a sheet pops from: bottom center.
    public static let popAnchor = CGPoint(x: 0.5, y: 1)
}

/// FINISH_SPEC BJ10: which presentations keep the SYSTEM sheet. Everything else the
/// app presents (menus, sheets, popups, guides, pocket games…) soft-pops.
public enum SoftPopPolicy {
    /// The system presenters that stay native (their look and motion belong to the OS).
    public static let systemSheets: [String] = [
        "share",          // UIActivityViewController / ShareLink
        "purchase",       // StoreKit / Play Billing / manage subscriptions
        "signInApple",    // Sign in with Apple
        "signInGoogle",   // Google sign-in
        "photoPicker",    // PhotosPicker / PHPicker / camera
        "mail",           // MFMailComposeViewController / mailto
        "safari",         // SFSafariViewController (auth fallbacks, links)
    ]

    /// The SwiftUI types (file-level names) that wrap a system presenter; a `.sheet`
    /// whose content is one of these keeps the system slide.
    public static let systemSheetTypes: [String] = [
        "ShareSheet", "ActivityView", "SafariSheet", "SafariView", "MailComposer",
        "MailView", "CameraPicker", "ImagePicker", "PhotoPicker", "PHPicker",
    ]

    /// Full-screen games use BJ9's grow instead of a pop.
    public static let fullScreenGames = "game"

    public static func usesSoftPop(_ kind: String) -> Bool {
        kind != fullScreenGames && !systemSheets.contains(kind)
    }
}
