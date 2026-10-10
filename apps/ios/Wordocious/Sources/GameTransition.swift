import SwiftUI
import UIKit
import QuartzCore
import WordociousCore

// FINISH_SPEC BJ9 — games "grow + soft rise" from the tapped card and shrink back.
//
// How it stays smooth (founder 10-03: "making sure it isn't choppy at all"):
// - The live game view is never transformed. Everything that moves is a cheap
//   stand-in: a window snapshot of Home (the backdrop), a snapshot of the tapped
//   card, and the SHELL — one plain rounded UIView in the card's color.
// - Every motion is a Core Animation animation committed (and flushed) up front,
//   so the render server plays it even while the main thread builds the game.
// - The game cover presents WITHOUT the system slide in the very next run-loop
//   turn, so the game is built under the overlay while the card lifts and the
//   shell grows; the overlay only fades away (revealing the game) once the game's
//   first frame is committed — never before.
// - Closing runs as the cover's own UIKit dismissal animator (every close path —
//   the Home button, `dismiss()`, a binding cleared by BI10 routing — goes through
//   it): the game's snapshot fades, then the shell shrinks into the SAME card's
//   current frame, read live from the card's probe view.
//
// Geometry / timing live in core `MotionSpec` (unit tested, mirrored on Android
// and web). Reduce Motion: a plain cross-fade both ways.

@MainActor
final class GameTransition {
    static let shared = GameTransition()
    private init() {}

    // MARK: Sources

    /// A card that can launch a game: a zero-cost probe view inside it (read on
    /// demand, nothing reported per frame) + the card's shell color and radius.
    struct SourceInfo {
        weak var probe: UIView?
        var color: UIColor
        var radius: CGFloat
    }

    /// What the next game cover grows from.
    struct Armed {
        var key: String?
        var frame: CGRect
        var color: UIColor
        var radius: CGFloat
        /// The card is on screen right now (snapshot + lift); false for a frame-only
        /// source (Strategy's PLAY, whose sheet closes before the game opens).
        var live: Bool
        var at: CFTimeInterval
        var window: Double
    }

    private var sources: [String: SourceInfo] = [:]
    private var armed: Armed?

    func register(_ key: String, probe: UIView, color: UIColor, radius: CGFloat) {
        sources[key] = SourceInfo(probe: probe, color: color, radius: radius)
    }

    func unregister(_ key: String, probe: UIView) {
        if sources[key]?.probe === probe { sources[key] = nil }
    }

    /// The card's current frame in window coordinates (nil when it isn't in a window).
    func liveFrame(_ key: String?) -> CGRect? {
        guard let key, let p = sources[key]?.probe, let w = p.window else { return nil }
        return p.convert(p.bounds, to: w)
    }

    /// The tap that's about to open a game: remember the card it came from.
    /// `frameOnly`: the control's screen goes away before the game opens (Strategy's
    /// PLAY closes its sheet first) — grow from where it was, no card snapshot, and
    /// the close lands as a soft rise (the card is gone).
    func arm(_ key: String, frameOnly: Bool = false) {
        guard let info = sources[key], let frame = liveFrame(key) else { armed = nil; return }
        armed = Armed(key: frameOnly ? nil : key, frame: frame, color: info.color, radius: info.radius,
                      live: !frameOnly, at: CACurrentMediaTime(),
                      window: frameOnly ? MotionSpec.frameOnlyArmWindow : MotionSpec.armWindow)
    }

    private func takeArmed() -> Armed? {
        defer { armed = nil }
        guard let a = armed, CACurrentMediaTime() - a.at <= a.window else { return nil }
        return a
    }

    // MARK: Open

    /// The source the visible game cover came from (its close shrinks back into it).
    struct CloseTarget {
        var key: String?
        var color: UIColor
        var radius: CGFloat
        var kind: MotionSpec.OpenKind
    }
    private(set) var lastOpened: CloseTarget?

    private final class OpenRun {
        let stage: UIView
        let t0: CFTimeInterval
        let kind: MotionSpec.OpenKind
        var revealed = false
        init(stage: UIView, t0: CFTimeInterval, kind: MotionSpec.OpenKind) {
            self.stage = stage; self.t0 = t0; self.kind = kind
        }
    }
    private var run: OpenRun?
    private var overlay: UIWindow?

    static var reduceMotion: Bool { UIAccessibility.isReduceMotionEnabled || ThemeManager.shared.reducedMotion }

    static var keyWindow: UIWindow? {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows).first(where: \.isKeyWindow)
    }

    /// BJ14 round 7: the open's shell carries the game's page (its wallpaper / tint and
    /// its header title art in their final places), so the game's build frame reads as
    /// the page arriving, not an empty shell. While true, game title art skips its
    /// one-time pop (the overlay already shows it settled — a pop under it would jump).
    private(set) static var headerHandoff = false
    /// How long the page takes to fade in over the growing shell.
    static let pageFadeIn: Double = 0.16

    /// Put the overlay up and commit the whole open (lift → grow) to the render
    /// server. Call right before presenting the cover (next run-loop turn).
    /// `hint`: the opening game's mode key (GameMode raw value), when known.
    func beginOpen(color fallback: UIColor, hint: String? = nil) {
        Feedback.gameOpen()   // Sound Lab pick "Page Breeze", once per open (closes never play it)
        finishRun(animated: false)
        guard let window = Self.keyWindow, let scene = window.windowScene else { return }
        let screen = window.bounds
        let src = takeArmed()
        let frame = MotionSpec.usableSource(src?.frame, in: screen)
        let kind = MotionSpec.openKind(hasSource: frame != nil, reduceMotion: Self.reduceMotion)
        let color = src?.color ?? fallback
        let radius = src?.radius ?? 24
        // A frame-only source (no key) closes as the reverse soft rise.
        let closeKind: MotionSpec.OpenKind = kind == .grow && src?.key == nil ? .rise : kind
        lastOpened = CloseTarget(key: frame == nil ? nil : src?.key, color: color, radius: radius, kind: closeKind)

        let ov = overlayWindow(scene)
        let stage = UIView(frame: screen)
        stage.isUserInteractionEnabled = true   // swallows taps until the game is up
        ov.addSubview(stage)
        ov.isHidden = false
        #if DEBUG
        PerfTour.mark("open.begin")
        defer { PerfTour.mark("open.committed") }
        #endif
        if let backdrop = window.snapshotView(afterScreenUpdates: false) {
            backdrop.frame = screen
            stage.addSubview(backdrop)
        }

        // Images only (decoded off main ahead of time), no layout of the game's views.
        #if DEBUG
        let noPage = PerfTour.flag("noShellPage")   // A/B: the plain shell
        #else
        let noPage = false
        #endif
        let page = kind == .crossFade || noPage ? nil
            : GameCoverPreview.pageView(key: hint, screen: screen, dark: window.traitCollection.userInterfaceStyle == .dark)
        Self.headerHandoff = page?.hasArt == true

        switch kind {
        case .grow:
            let card = frame!
            let lifted = MotionSpec.liftedFrame(card)
            if src?.live == true, let snap = window.resizableSnapshotView(from: card, afterScreenUpdates: false, withCapInsets: .zero) {
                snap.frame = card
                stage.addSubview(snap)
                UIView.animate(withDuration: MotionSpec.liftDuration, delay: 0, options: [.curveEaseOut]) {
                    snap.transform = CGAffineTransform(translationX: 0, y: -MotionSpec.liftRise)
                        .scaledBy(x: MotionSpec.liftScale, y: MotionSpec.liftScale)
                }
                UIView.animate(withDuration: MotionSpec.shellFadeIn, delay: MotionSpec.liftDuration, options: [.curveEaseIn]) {
                    snap.alpha = 0
                }
            }
            let shell = Self.shell(frame: lifted, color: color, radius: radius)
            shell.alpha = 0
            stage.addSubview(shell)
            UIView.animate(withDuration: MotionSpec.shellFadeIn, delay: MotionSpec.liftDuration, options: [.curveEaseOut]) {
                shell.alpha = 1
            }
            // The page sits fixed at its final place, seen through a window that grows
            // exactly like the shell (same spring), and fades in just after the shell:
            // the card color becomes the game's page, its header already in place.
            var peek: UIView?
            if let page {
                let w = Self.shell(frame: lifted, color: .black, radius: radius)
                page.view.mask = w
                page.view.alpha = 0
                stage.addSubview(page.view)
                peek = w
                UIView.animate(withDuration: Self.pageFadeIn, delay: MotionSpec.liftDuration + MotionSpec.shellFadeIn * 0.5,
                               options: [.curveEaseOut]) {
                    page.view.alpha = 1
                }
            }
            UIView.animate(withDuration: MotionSpec.growDuration, delay: MotionSpec.liftDuration,
                           usingSpringWithDamping: MotionSpec.growDamping, initialSpringVelocity: 0, options: []) {
                shell.frame = screen
                shell.layer.cornerRadius = 0
                peek?.frame = screen
                peek?.layer.cornerRadius = 0
            }
        case .rise:
            let shell = Self.shell(frame: screen, color: color, radius: 28)
            if let page {
                // Inside the shell: it rises with it and lands exactly in place.
                shell.clipsToBounds = true
                shell.addSubview(page.view)
            }
            let start = MotionSpec.riseStartFrame(screen)
            shell.transform = CGAffineTransform(translationX: 0, y: start.midY - screen.midY)
                .scaledBy(x: MotionSpec.riseScale, y: MotionSpec.riseScale)
            shell.alpha = 0
            stage.addSubview(shell)
            UIView.animate(withDuration: MotionSpec.riseDuration, delay: 0,
                           usingSpringWithDamping: 0.9, initialSpringVelocity: 0, options: []) {
                shell.transform = .identity
                shell.layer.cornerRadius = 0
            }
            UIView.animate(withDuration: MotionSpec.riseDuration * 0.45, delay: 0, options: [.curveEaseOut]) {
                shell.alpha = 1
            }
        case .crossFade:
            break
        }
        let r = OpenRun(stage: stage, t0: CACurrentMediaTime(), kind: kind)
        run = r
        // Commit NOW: the render server plays the lift + grow while the main thread
        // builds the game in the next turn.
        CATransaction.flush()
        // Failsafe: a cover that never appears (presentation refused) never strands
        // the overlay.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self, weak r] in
            guard let self, let r, self.run === r, !r.revealed else { return }
            self.coverReady()
        }
    }

    /// The game's first frame is committed under the overlay: fade the overlay away
    /// (the game "fades in" over the last 60% of the grow), never earlier.
    func coverReady() {
        guard let r = run, !r.revealed else { return }
        r.revealed = true
        let timing = MotionSpec.revealTiming(kind: r.kind)
        let delay = max(0, r.t0 + timing.delay - CACurrentMediaTime())
        UIView.animate(withDuration: timing.duration, delay: delay, options: [.curveEaseInOut]) {
            r.stage.alpha = 0
        } completion: { [weak self, weak r] _ in
            guard let self, let r, self.run === r else { return }
            self.finishRun(animated: false)
        }
        CATransaction.flush()
    }

    /// The open was abandoned before the cover presented (its binding cleared).
    func cancelOpen() {
        guard let r = run, !r.revealed else { return }
        r.revealed = true
        UIView.animate(withDuration: 0.15, animations: { r.stage.alpha = 0 }) { [weak self, weak r] _ in
            guard let self, let r, self.run === r else { return }
            self.finishRun(animated: false)
        }
    }

    private func finishRun(animated: Bool) {
        Self.headerHandoff = false
        run?.stage.removeFromSuperview()
        run = nil
        overlay?.isHidden = true
    }

    private func overlayWindow(_ scene: UIWindowScene) -> UIWindow {
        if let o = overlay, o.windowScene === scene { o.frame = scene.coordinateSpace.bounds; return o }
        let o = PassiveWindow(windowScene: scene)
        o.frame = scene.coordinateSpace.bounds
        o.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue + 1)
        o.backgroundColor = .clear
        o.accessibilityElementsHidden = true
        #if DEBUG
        if GameTransitionMeasure.slow { o.layer.speed = 0.1 }
        #endif
        overlay = o
        return o
    }

    static func shell(frame: CGRect, color: UIColor, radius: CGFloat) -> UIView {
        let v = UIView(frame: frame)
        v.backgroundColor = color
        v.layer.cornerRadius = radius
        v.layer.cornerCurve = .continuous
        v.isUserInteractionEnabled = false
        return v
    }
}

/// The overlay window: never key, never the status bar's owner (no root controller).
private final class PassiveWindow: UIWindow {
    override var canBecomeKey: Bool { false }
}

// MARK: - Close: the cover's dismissal animator

/// Installed on the presented game cover (its controller's transitioningDelegate)
/// by `GameCoverHook`; UIKit asks it for EVERY animated dismissal of that cover.
@MainActor
final class GameCoverDismissal: NSObject, UIViewControllerTransitioningDelegate, UIViewControllerAnimatedTransitioning {
    let target: GameTransition.CloseTarget

    init(target: GameTransition.CloseTarget) { self.target = target }

    func animationController(forDismissed dismissed: UIViewController) -> UIViewControllerAnimatedTransitioning? { self }

    private var kind: MotionSpec.OpenKind {
        GameTransition.reduceMotion ? .crossFade : target.kind
    }

    func transitionDuration(using ctx: UIViewControllerContextTransitioning?) -> TimeInterval {
        MotionSpec.closeDuration(kind: kind)
    }

    func animateTransition(using ctx: UIViewControllerContextTransitioning) {
        #if DEBUG
        PerfTour.mark("close.animEntry")
        #endif
        let container = ctx.containerView
        guard let fromVC = ctx.viewController(forKey: .from), let fromView = ctx.view(forKey: .from) ?? fromVC.view else {
            ctx.completeTransition(!ctx.transitionWasCancelled)
            return
        }
        // BJ14: fade the LIVE game view (the render server animates its opacity). A
        // `snapshotView` of it was a synchronous render-server snapshot that cost ~200
        // ms on a finished OctoWord screen, right in the close's first frame.
        #if DEBUG
        let snap = PerfTour.flag("closeSnap") ? fromView.snapshotView(afterScreenUpdates: false) : nil
        #else
        let snap: UIView? = nil
        #endif
        #if DEBUG
        PerfTour.mark("close.snapped")
        #endif
        if let toVC = ctx.viewController(forKey: .to), let toView = ctx.view(forKey: .to) {
            toView.frame = ctx.finalFrame(for: toVC)
            container.insertSubview(toView, at: 0)
            // BJ14 round 7: lay Home out NOW, before any animation is stamped, so its
            // re-entry cost lands before the close starts (not as a stall mid-fade) and
            // the card's frame is known up front: the fade and the shrink are committed
            // together and play on the render server with no main-thread hand-off.
            toView.layoutIfNeeded()
        }
        let kind = self.kind
        let shell = GameTransition.shell(frame: container.bounds, color: target.color, radius: 0)
        if kind != .crossFade { container.addSubview(shell) }
        let fader: UIView
        if let snap {
            snap.frame = fromView.frame
            container.addSubview(snap)
            fromView.alpha = 0
            fader = snap
        } else {
            container.bringSubviewToFront(fromView)
            // Fade it as ONE flattened layer (rasterized by the render server, not
            // the main thread): sublayers never show through each other mid-fade.
            fromView.layer.allowsGroupOpacity = true
            fromView.layer.rasterizationScale = fromView.window?.screen.scale ?? UIScreen.main.scale
            fromView.layer.shouldRasterize = true
            fader = fromView
        }
        #if DEBUG
        PerfTour.mark("close.begin")
        #endif
        let finish = {
            #if DEBUG
            PerfTour.mark("close.finish")
            #endif
            snap?.removeFromSuperview()
            shell.removeFromSuperview()
            // The game's teardown (~45 ms) runs a turn AFTER the shell's removal has
            // committed, so it never holds the last frame of the close on screen. The
            // faded game stays (invisible) until then.
            DispatchQueue.main.async {
                fromView.layer.shouldRasterize = false
                fromView.alpha = 1
                ctx.completeTransition(!ctx.transitionWasCancelled)
                #if DEBUG
                PerfTour.mark("close.completed")
                DispatchQueue.main.async { PerfTour.mark("close.nextTurn") }
                #endif
            }
        }
        let fade = kind == .crossFade ? MotionSpec.crossFadeDuration : MotionSpec.closeFadeDuration
        let bounds = container.bounds
        /// The shrink into the card / the reverse rise, starting `delay` from now.
        let land: (Double) -> Void = { [target] delay in
            let live = GameTransition.shared.liveFrame(target.key).map { container.convert($0, from: nil) }
            if kind == .grow, let card = MotionSpec.usableSource(live, in: bounds) {
                let dur = MotionSpec.shrinkDuration
                UIView.animate(withDuration: dur, delay: delay, usingSpringWithDamping: 1, initialSpringVelocity: 0, options: []) {
                    shell.frame = card
                    shell.layer.cornerRadius = target.radius
                }
                UIView.animate(withDuration: dur * MotionSpec.shrinkFadeFraction, delay: delay + dur * (1 - MotionSpec.shrinkFadeFraction),
                               options: [.curveEaseIn], animations: { shell.alpha = 0 }) { _ in finish() }
            } else {
                // No card to land in: the soft rise in reverse.
                let dur = MotionSpec.riseDuration * 0.7
                let end = MotionSpec.riseStartFrame(bounds)
                UIView.animate(withDuration: dur, delay: delay, options: [.curveEaseIn]) {
                    shell.layer.cornerRadius = 28
                    shell.transform = CGAffineTransform(translationX: 0, y: end.midY - bounds.midY)
                        .scaledBy(x: MotionSpec.riseScale, y: MotionSpec.riseScale)
                    shell.alpha = 0
                } completion: { _ in finish() }
            }
        }
        UIView.animate(withDuration: fade, delay: 0, options: [.curveEaseOut]) {
            fader.alpha = 0
        } completion: { _ in
            if kind == .crossFade { finish() }
        }
        // Committed with the fade (Home is laid out above): no main-thread turn between them.
        if kind != .crossFade { land(fade) }
    }
}

// MARK: - SwiftUI: sources, covers, the hook

/// The probe: an empty, non-interactive UIView that only answers "where am I".
private struct GameSourceProbe: UIViewRepresentable {
    let key: String
    let color: UIColor
    let radius: CGFloat

    final class Probe: UIView {
        var key = ""
        var color: UIColor = .clear
        var radius: CGFloat = 0
        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window != nil {
                GameTransition.shared.register(key, probe: self, color: color, radius: radius)
                #if DEBUG
                GameTransitionMeasure.bootOnce()   // `-bj9Measure` / `-bj9Slow` only
                #endif
            }
        }
    }

    func makeUIView(context: Context) -> Probe {
        let p = Probe()
        p.isUserInteractionEnabled = false
        p.backgroundColor = .clear
        p.key = key; p.color = color; p.radius = radius
        return p
    }

    func updateUIView(_ p: Probe, context: Context) {
        let changed = p.key != key
        if changed { GameTransition.shared.unregister(p.key, probe: p) }
        p.key = key; p.color = color; p.radius = radius
        if p.window != nil { GameTransition.shared.register(key, probe: p, color: color, radius: radius) }
    }

    static func dismantleUIView(_ p: Probe, coordinator: ()) {
        MainActor.assumeIsolated { GameTransition.shared.unregister(p.key, probe: p) }
    }
}

extension View {
    /// BJ9: this view is a card that launches games (key: the source id the tap arms
    /// with `GameTransition.shared.arm`). Zero per-frame cost.
    func gameLaunchSource(_ key: String, color: Color, radius: CGFloat) -> some View {
        background(GameSourceProbe(key: key, color: UIColor(color), radius: radius).allowsHitTesting(false))
    }

    /// BJ9: `.fullScreenCover(item:)` for a GAME — no system slide; the shell grows
    /// from the armed card (or soft-rises), and every close shrinks back.
    /// `hint`: the game's mode key (GameMode raw value) so the shell can carry its page
    /// (default: the item's own `GameCoverHint`).
    /// `swipeToClose` (founder 10-10): a swipe in from the left edge closes the game back to the menu — off for live
    /// VS matches, where leaving forfeits.
    func gameCover<Item: Identifiable, Cover: View>(item: Binding<Item?>, onDismiss: (() -> Void)? = nil,
                                                    color: Color? = nil,
                                                    hint: ((Item) -> String?)? = nil,
                                                    swipeToClose: Bool = true,
                                                    @ViewBuilder content: @escaping (Item) -> Cover) -> some View {
        modifier(GameCoverItem(item: item, onDismiss: onDismiss, color: color,
                               hint: hint ?? { ($0 as? GameCoverHint)?.coverHintKey }, swipeToClose: swipeToClose, cover: content))
    }

    /// BJ9: `.fullScreenCover(isPresented:)` for a GAME.
    func gameCover<Cover: View>(isPresented: Binding<Bool>, onDismiss: (() -> Void)? = nil,
                                color: Color? = nil, hint: String? = nil, swipeToClose: Bool = true,
                                @ViewBuilder content: @escaping () -> Cover) -> some View {
        modifier(GameCoverFlag(isPresented: isPresented, onDismiss: onDismiss, color: color, hint: hint,
                               swipeToClose: swipeToClose, cover: content))
    }
}

/// The default shell color when no card says otherwise: the game page's middle stop.
private func defaultShellColor(_ c: Color?) -> UIColor {
    if let c { return UIColor(c) }
    return UIColor(PageTint.home.stops(dark: Theme.isDark)[1])
}

private let noSlide: Transaction = {
    var t = Transaction()
    t.disablesAnimations = true
    return t
}()

private struct GameCoverItem<Item: Identifiable, Cover: View>: ViewModifier {
    @Binding var item: Item?
    let onDismiss: (() -> Void)?
    let color: Color?
    let hint: (Item) -> String?
    let swipeToClose: Bool
    let cover: (Item) -> Cover
    @State private var shown: Item?

    func body(content: Content) -> some View {
        content
            .onChange(of: item.map { AnyHashable($0.id) }) { _ in sync() }
            .onAppear { if item != nil, shown == nil { sync() } }
            .fullScreenCover(item: Binding(get: { shown }, set: { v in
                shown = v
                if v == nil { item = nil }   // the cover closed itself (dismiss())
            }), onDismiss: onDismiss) { it in
                cover(it).background(GameCoverHook())
                    .modifier(EdgeSwipeClose(enabled: swipeToClose) { item = nil })
            }
    }

    private func sync() {
        guard let next = item else {
            if shown != nil { shown = nil }   // animated → GameCoverDismissal
            return
        }
        if shown == nil {
            #if DEBUG
            if PerfTour.flag("noXition") { withTransaction(noSlide) { shown = next }; return }
            #endif
            GameTransition.shared.beginOpen(color: defaultShellColor(color), hint: hint(next))
            let id = AnyHashable(next.id)
            DispatchQueue.main.async {
                guard let current = item, AnyHashable(current.id) == id else {
                    GameTransition.shared.cancelOpen()
                    return
                }
                withTransaction(noSlide) { shown = current }
            }
        } else {
            shown = next   // an in-place swap (Play Again): unchanged behavior
        }
    }
}

private struct GameCoverFlag<Cover: View>: ViewModifier {
    @Binding var isPresented: Bool
    let onDismiss: (() -> Void)?
    let color: Color?
    let hint: String?
    let swipeToClose: Bool
    let cover: () -> Cover
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .onChange(of: isPresented) { _ in sync() }
            .onAppear { if isPresented, !shown { sync() } }
            .fullScreenCover(isPresented: Binding(get: { shown }, set: { v in
                shown = v
                if !v { isPresented = false }
            }), onDismiss: onDismiss) {
                cover().background(GameCoverHook())
                    .modifier(EdgeSwipeClose(enabled: swipeToClose) { isPresented = false })
            }
    }

    private func sync() {
        guard isPresented else {
            if shown { shown = false }
            return
        }
        guard !shown else { return }
        #if DEBUG
        if PerfTour.flag("noXition") { withTransaction(noSlide) { shown = true }; return }
        #endif
        GameTransition.shared.beginOpen(color: defaultShellColor(color), hint: hint)
        DispatchQueue.main.async {
            guard isPresented else { GameTransition.shared.cancelOpen(); return }
            withTransaction(noSlide) { shown = true }
        }
    }
}

/// Founder 10-10: swipe in from the left edge to close a game (like the system back swipe). The drag must start within
/// 28 pt of the left edge and travel right; the game follows the finger, and past ~90 pt (or a quick flick) it closes
/// through the cover's own close (the shrink-back). It rides alongside the game's own touches (taps never trigger it).
struct EdgeSwipeClose: ViewModifier {
    let enabled: Bool
    let close: () -> Void
    @State private var dx: CGFloat = 0
    @State private var tracking = false

    func body(content: Content) -> some View {
        if enabled {
            content
                .offset(x: dx)
                .simultaneousGesture(
                    DragGesture(minimumDistance: 14, coordinateSpace: .global)
                        .onChanged { v in
                            if !tracking {
                                guard v.startLocation.x < 28, v.translation.width > abs(v.translation.height) else { return }
                                tracking = true
                            }
                            dx = max(0, v.translation.width) * 0.55
                        }
                        .onEnded { v in
                            guard tracking else { return }
                            tracking = false
                            let flick = v.predictedEndTranslation.width - v.translation.width > 140
                            if v.translation.width > 90 || flick {
                                Haptics.light()
                                close()
                                withAnimation(.easeOut(duration: 0.2)) { dx = 0 }
                            } else {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { dx = 0 }
                            }
                        }
                )
        } else {
            content
        }
    }
}

/// Inside every game cover: installs the dismissal animator on the presented
/// controller and reports the game's first frame (→ the reveal).
private struct GameCoverHook: UIViewRepresentable {
    final class Hook: UIView {
        private var installed = false
        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard window != nil, !installed else { return }
            installed = true
            #if DEBUG
            let skip = PerfTour.flag("noXition")
            #else
            let skip = false
            #endif
            if !skip, let vc = presentedRoot(of: self), let target = GameTransition.shared.lastOpened {
                let delegate = GameCoverDismissal(target: target)
                objc_setAssociatedObject(vc, &dismissalKey, delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
                vc.transitioningDelegate = delegate
            }
            // The first frame (this layout pass) commits at the end of this turn.
            DispatchQueue.main.async { GameTransition.shared.coverReady() }
        }
    }

    func makeUIView(context: Context) -> Hook {
        let h = Hook()
        h.isUserInteractionEnabled = false
        h.backgroundColor = .clear
        return h
    }

    func updateUIView(_ uiView: Hook, context: Context) {}
}

private var dismissalKey: UInt8 = 0

/// The presented controller a view lives in (the top of its containment chain).
@MainActor
func presentedRoot(of view: UIView) -> UIViewController? {
    var r: UIResponder? = view
    while let n = r, !(n is UIViewController) { r = n.next }
    guard var vc = r as? UIViewController else { return nil }
    while let p = vc.parent { vc = p }
    return vc.presentingViewController != nil ? vc : nil
}

// MARK: - BJ14 round 7: the shell carries the game's page

/// A game cover item that knows its game (a GameMode raw value), so the open's shell can
/// carry that game's page background + header title art.
protocol GameCoverHint {
    var coverHintKey: String? { get }
}

/// The game's page as plain image views for the open's shell: its wallpaper (or tint
/// gradient) and its header title art at the exact window frame the real header drew it
/// in last time (recorded by `HeaderArtProbe`, persisted per screen size). Everything is
/// decoded off main ahead of time; a cache miss draws without that piece (never decodes
/// at the tap).
@MainActor
enum GameCoverPreview {
    struct Page {
        let view: UIView
        let hasArt: Bool
    }

    private static let defaultsKey = "bj14.headerArtFrames.v1"
    /// "asset|WxH" → [x, y, w, h, lastUsed]
    private static var frames: [String: [Double]] = UserDefaults.standard.dictionary(forKey: defaultsKey) as? [String: [Double]] ?? [:]
    /// Decoded header art kept for the most recently opened games only.
    private static let keepRecent = 8

    private static func frameKey(_ asset: String, _ screen: CGSize) -> String {
        "\(asset)|\(Int(screen.width))x\(Int(screen.height))"
    }

    private static func rect(_ v: [Double]) -> CGRect? {
        v.count >= 4 ? CGRect(x: v[0], y: v[1], width: v[2], height: v[3]) : nil
    }

    static func pageView(key: String?, screen: CGRect, dark: Bool) -> Page? {
        guard let key, let mode = GameMode(rawValue: key) else { return nil }
        let tint = PageTint.forGame(mode)
        let v = UIView(frame: screen)
        v.isUserInteractionEnabled = false
        v.clipsToBounds = true
        let a11y = UIAccessibility.isReduceTransparencyEnabled || UIAccessibility.isDarkerSystemColorsEnabled
        if let wall = PreviewImages.shared.get(wallKey(tint)) {
            let iv = UIImageView(image: wall)
            iv.frame = v.bounds
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            v.addSubview(iv)
            let over = UIView(frame: v.bounds)
            over.backgroundColor = dark ? UIColor(red: 0x12 / 255, green: 0x0D / 255, blue: 0x1F / 255, alpha: a11y ? 0.70 : tint.darkOverlay)
                : UIColor.white.withAlphaComponent(a11y ? 0.20 : 0)
            v.addSubview(over)
        } else {
            // The tint's gradient: the page itself when the game has no wallpaper (PageBackground's
            // fallback), else the closest look until the wallpaper is decoded for next time.
            let g = CAGradientLayer()
            g.frame = v.bounds
            g.colors = tint.stops(dark: dark).map { UIColor($0).cgColor }
            g.startPoint = CGPoint(x: 0, y: 0)
            g.endPoint = CGPoint(x: 1, y: 1)
            v.layer.addSublayer(g)
            warmWallpaper(tint)
        }
        var hasArt = false
        if let art = GameTitleArt.forMode(mode)?.asset {
            let k = frameKey(art, screen.size)
            if let f = frames[k].flatMap(rect) {
                if let img = PreviewImages.shared.get(artKey(art, f)) {
                    let iv = UIImageView(image: img)
                    iv.frame = f
                    iv.contentMode = .scaleToFill
                    v.addSubview(iv)
                    hasArt = true
                } else {
                    warmArt(art, f)
                }
                touch(k)
            }
        }
        return Page(view: v, hasArt: hasArt)
    }

    /// The real header drew `asset` at `frame` (window coordinates): remember it and have its
    /// pieces decoded for the next open.
    static func record(asset: String, frame: CGRect, screen: CGSize, mode: GameMode?) {
        guard frame.width > 1, frame.height > 1 else { return }
        let k = frameKey(asset, screen)
        let r = frame   // exact: the shell's copy must land on the same pixels
        let old = frames[k].flatMap(rect)
        if old == nil || old != r {
            frames[k] = [r.minX, r.minY, r.width, r.height, Date().timeIntervalSince1970]
            UserDefaults.standard.set(frames, forKey: defaultsKey)
        }
        warmArt(asset, r)
        if let mode { warmWallpaper(PageTint.forGame(mode)) }
    }

    /// Launch (AppWarmup): every game's wallpaper at a fifth of its pixels (~0.5 MB each, so a
    /// first open shows its real page), and the recently opened games' header art, off main.
    static func prewarm() {
        for g in ModeGen.all {
            if let key = g.dbKey, let mode = GameMode(rawValue: key) { warmWallpaper(PageTint.forGame(mode)) }
        }
        let size = UIScreen.main.bounds.size
        let suffix = "|\(Int(size.width))x\(Int(size.height))"
        let recent = frames.filter { $0.key.hasSuffix(suffix) }
            .sorted { ($0.value.last ?? 0) > ($1.value.last ?? 0) }.prefix(keepRecent)
        for (k, v) in recent {
            guard let f = rect(v) else { continue }
            let asset = String(k.dropLast(suffix.count))
            warmArt(asset, f)
        }
    }

    private static func touch(_ k: String) {
        guard var v = frames[k], v.count >= 5 else { return }
        v[4] = Date().timeIntervalSince1970
        frames[k] = v
        UserDefaults.standard.set(frames, forKey: defaultsKey)
    }

    private static func wallKey(_ tint: PageTint) -> String { "wall|" + tint.wallpaper }
    private static func artKey(_ asset: String, _ f: CGRect) -> String { "art|\(asset)|\(Int(f.width * 10))x\(Int(f.height * 10))" }

    /// The wallpaper at a fifth of its pixels: it is a soft, blurred backdrop on screen for
    /// a fraction of a second under the real one (~0.5 MB each).
    private static func warmWallpaper(_ tint: PageTint) {
        let name = tint.wallpaper
        PreviewImages.shared.decode(wallKey(tint)) {
            guard let src = UIImage(named: name) else { return nil }
            let px = CGSize(width: src.size.width * src.scale / 5, height: src.size.height * src.scale / 5)
            return src.preparingThumbnail(of: CGSize(width: px.width.rounded(), height: px.height.rounded()))
        }
    }

    /// The header art at its exact on-screen pixel size (drawn 1:1, like the real one).
    private static func warmArt(_ asset: String, _ f: CGRect) {
        let scale = UIScreen.main.scale
        PreviewImages.shared.decode(artKey(asset, f)) {
            guard let src = UIImage(named: asset) else { return nil }
            let px = CGSize(width: (f.width * scale).rounded(), height: (f.height * scale).rounded())
            if src.size.width * src.scale <= px.width * 1.05 { return src.preparingForDisplay() }
            return src.preparingThumbnail(of: px)
        }
    }
}

/// Decoded images for the open's shell, filled on a utility thread.
final class PreviewImages: @unchecked Sendable {
    static let shared = PreviewImages()
    private let lock = NSLock()
    private var images: [String: UIImage] = [:]
    private var pending: Set<String> = []

    func get(_ key: String) -> UIImage? {
        lock.lock(); defer { lock.unlock() }
        return images[key]
    }

    func decode(_ key: String, make: @escaping @Sendable () -> UIImage?) {
        lock.lock()
        if images[key] != nil || pending.contains(key) { lock.unlock(); return }
        pending.insert(key)
        lock.unlock()
        DispatchQueue.global(qos: .utility).async {
            let img = make()
            self.lock.lock()
            self.pending.remove(key)
            if let img { self.images[key] = img }
            self.lock.unlock()
        }
    }
}

/// On a game header's title art: once the page has settled, records where the art is
/// drawn (window coordinates) for the next open's shell. Zero per-frame cost.
struct HeaderArtProbe: UIViewRepresentable {
    let asset: String
    let mode: GameMode?

    final class Probe: UIView {
        var asset = ""
        var mode: GameMode?
        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard window != nil else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in self?.record() }
        }
        private func record() {
            guard let w = window, w.bounds.size == w.screen.bounds.size else { return }
            GameCoverPreview.record(asset: asset, frame: convert(bounds, to: w), screen: w.bounds.size, mode: mode)
        }
    }

    func makeUIView(context: Context) -> Probe {
        let p = Probe()
        p.isUserInteractionEnabled = false
        p.backgroundColor = .clear
        p.asset = asset; p.mode = mode
        return p
    }

    func updateUIView(_ p: Probe, context: Context) { p.asset = asset; p.mode = mode }
}
