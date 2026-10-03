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

    /// Put the overlay up and commit the whole open (lift → grow) to the render
    /// server. Call right before presenting the cover (next run-loop turn).
    func beginOpen(color fallback: UIColor) {
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
        if let backdrop = window.snapshotView(afterScreenUpdates: false) {
            backdrop.frame = screen
            stage.addSubview(backdrop)
        }

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
            UIView.animate(withDuration: MotionSpec.growDuration, delay: MotionSpec.liftDuration,
                           usingSpringWithDamping: MotionSpec.growDamping, initialSpringVelocity: 0, options: []) {
                shell.frame = screen
                shell.layer.cornerRadius = 0
            }
        case .rise:
            let shell = Self.shell(frame: screen, color: color, radius: 28)
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
        let container = ctx.containerView
        guard let fromVC = ctx.viewController(forKey: .from), let fromView = ctx.view(forKey: .from) ?? fromVC.view else {
            ctx.completeTransition(!ctx.transitionWasCancelled)
            return
        }
        // The game's last frame as ONE flat layer (fading it is the cheapest thing
        // there is); the live hierarchy leaves right away.
        let snap = fromView.snapshotView(afterScreenUpdates: false)
        if let toVC = ctx.viewController(forKey: .to), let toView = ctx.view(forKey: .to) {
            toView.frame = ctx.finalFrame(for: toVC)
            container.insertSubview(toView, at: 0)
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
            fader = fromView
        }
        let finish = {
            snap?.removeFromSuperview()
            shell.removeFromSuperview()
            fromView.alpha = 1
            ctx.completeTransition(!ctx.transitionWasCancelled)
        }
        let fade = kind == .crossFade ? MotionSpec.crossFadeDuration : MotionSpec.closeFadeDuration
        UIView.animate(withDuration: fade, delay: 0, options: [.curveEaseOut]) {
            fader.alpha = 0
        } completion: { [target] _ in
            guard kind != .crossFade else { finish(); return }
            // The card's CURRENT frame (Home has re-laid out under the shell by now).
            let live = GameTransition.shared.liveFrame(target.key).map { container.convert($0, from: nil) }
            if kind == .grow, let card = MotionSpec.usableSource(live, in: container.bounds) {
                let dur = MotionSpec.shrinkDuration
                UIView.animate(withDuration: dur, delay: 0, usingSpringWithDamping: 1, initialSpringVelocity: 0, options: []) {
                    shell.frame = card
                    shell.layer.cornerRadius = target.radius
                }
                UIView.animate(withDuration: dur * MotionSpec.shrinkFadeFraction, delay: dur * (1 - MotionSpec.shrinkFadeFraction),
                               options: [.curveEaseIn], animations: { shell.alpha = 0 }) { _ in finish() }
            } else {
                // No card to land in: the soft rise in reverse.
                let dur = MotionSpec.riseDuration * 0.7
                let b = container.bounds
                let end = MotionSpec.riseStartFrame(b)
                UIView.animate(withDuration: dur, delay: 0, options: [.curveEaseIn]) {
                    shell.layer.cornerRadius = 28
                    shell.transform = CGAffineTransform(translationX: 0, y: end.midY - b.midY)
                        .scaledBy(x: MotionSpec.riseScale, y: MotionSpec.riseScale)
                    shell.alpha = 0
                } completion: { _ in finish() }
            }
        }
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
    func gameCover<Item: Identifiable, Cover: View>(item: Binding<Item?>, onDismiss: (() -> Void)? = nil,
                                                    color: Color? = nil,
                                                    @ViewBuilder content: @escaping (Item) -> Cover) -> some View {
        modifier(GameCoverItem(item: item, onDismiss: onDismiss, color: color, cover: content))
    }

    /// BJ9: `.fullScreenCover(isPresented:)` for a GAME.
    func gameCover<Cover: View>(isPresented: Binding<Bool>, onDismiss: (() -> Void)? = nil,
                                color: Color? = nil,
                                @ViewBuilder content: @escaping () -> Cover) -> some View {
        modifier(GameCoverFlag(isPresented: isPresented, onDismiss: onDismiss, color: color, cover: content))
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
            }
    }

    private func sync() {
        guard let next = item else {
            if shown != nil { shown = nil }   // animated → GameCoverDismissal
            return
        }
        if shown == nil {
            GameTransition.shared.beginOpen(color: defaultShellColor(color))
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
            }
    }

    private func sync() {
        guard isPresented else {
            if shown { shown = false }
            return
        }
        guard !shown else { return }
        GameTransition.shared.beginOpen(color: defaultShellColor(color))
        DispatchQueue.main.async {
            guard isPresented else { GameTransition.shared.cancelOpen(); return }
            withTransaction(noSlide) { shown = true }
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
            if let vc = presentedRoot(of: self), let target = GameTransition.shared.lastOpened {
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
