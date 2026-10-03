import SwiftUI
import UIKit
import QuartzCore
import WordociousCore

// FINISH_SPEC BJ10 — app menus and sheets "soft pop": the background dims and the
// sheet springs up gently from the bottom center (scale 0.94 → 1 + fade) instead of
// the system slide; dismiss reverses quickly. Swipe-to-dismiss keeps the system's
// finger-following drag.
//
// `.softSheet` is a drop-in for `.sheet(isPresented:)` / `.sheet(item:)`:
// - the sheet is presented WITHOUT the system slide, so its content is built in
//   that frame, before the pop starts (nothing is built mid-animation);
// - in the same commit a hook inside the content adds the pop as pure Core
//   Animation (transform + opacity on the sheet's container, opacity on the dim) —
//   additive-free from-values, so no model state changes and nothing to clean up;
// - a dismissal animator (the presented controller's transitioningDelegate) plays
//   the quick reverse for every programmatic close; a live swipe keeps UIKit's own
//   interactive dismissal.
//
// Exceptions stay on the system sheet (core `SoftPopPolicy`): share, purchase,
// Sign in with Apple / Google, photo picker, mail, Safari. Full-screen games use
// BJ9's grow (GameTransition.swift). In-view popups (header streak / shield /
// flawless, the Home modals) use `SoftPop.transition` + `SoftPop.animation`.

@MainActor
enum SoftPop {
    /// The in-view popup transition: from the bottom center, 0.94 → 1 + fade.
    static var transition: AnyTransition {
        .scale(scale: MotionSpec.popScale, anchor: .bottom).combined(with: .opacity)
    }

    /// The soft spring (Reduce Motion: a short fade via Theme.animation).
    static var animation: Animation {
        .spring(response: MotionSpec.popDuration, dampingFraction: Double(MotionSpec.popDamping))
    }

    /// The transform a popped view starts from: scaled about its bottom center.
    static func startTransform(height: CGFloat) -> CATransform3D {
        let s = MotionSpec.popScale
        let ty = (1 - s) * height / 2
        return CATransform3DConcat(CATransform3DMakeScale(s, s, 1), CATransform3DMakeTranslation(0, ty, 0))
    }

    /// A spring with the spec's response / damping, on iOS 16 (no perceptual init).
    static func spring(keyPath: String) -> CASpringAnimation {
        let a = CASpringAnimation(keyPath: keyPath)
        let response: Double = MotionSpec.popDuration
        let damping = Double(MotionSpec.popDamping)
        a.mass = 1
        a.stiffness = CGFloat(pow(2 * Double.pi / response, 2))
        a.damping = CGFloat(4 * Double.pi * damping / response)
        a.initialVelocity = 0
        a.duration = a.settlingDuration
        return a
    }

    static var reduceMotion: Bool { GameTransition.reduceMotion }

    /// Pop `container` (the sheet's own view) in and fade `dims` (the dimming
    /// views behind it) up from clear. Pure CA; plays on the render server.
    static func popIn(_ container: UIView, dims: [UIView]) {
        let now = CACurrentMediaTime()
        if !reduceMotion {
            let h = container.bounds.height > 0 ? container.bounds.height : (container.window?.bounds.height ?? 800) * 0.6
            let t = spring(keyPath: "transform")
            t.fromValue = NSValue(caTransform3D: startTransform(height: h))
            t.toValue = NSValue(caTransform3D: CATransform3DIdentity)
            t.beginTime = now
            t.fillMode = .backwards
            container.layer.add(t, forKey: "softPop.t")
        }
        let o = CABasicAnimation(keyPath: "opacity")
        o.fromValue = 0
        o.toValue = 1
        o.duration = reduceMotion ? MotionSpec.crossFadeDuration : MotionSpec.popDuration * 0.55
        o.timingFunction = CAMediaTimingFunction(name: .easeOut)
        o.beginTime = now
        o.fillMode = .backwards
        container.layer.add(o, forKey: "softPop.o")
        for d in dims {
            let f = CABasicAnimation(keyPath: "opacity")
            f.fromValue = 0
            f.toValue = d.layer.opacity
            f.duration = MotionSpec.popDuration * 0.6
            f.timingFunction = CAMediaTimingFunction(name: .easeOut)
            f.beginTime = now
            f.fillMode = .backwards
            d.layer.add(f, forKey: "softPop.dim")
        }
    }

    /// The views behind a presented sheet in its container (the system dimming view).
    static func dimViews(container: UIView?, presented: UIView) -> [UIView] {
        guard let container else { return [] }
        return container.subviews.filter { $0 !== presented && !presented.isDescendant(of: $0) }
    }
}

/// The quick reverse for every non-interactive close of a soft-popped sheet.
@MainActor
final class SoftPopDismissal: NSObject, UIViewControllerTransitioningDelegate, UIViewControllerAnimatedTransitioning {
    weak var presented: UIViewController?

    func animationController(forDismissed dismissed: UIViewController) -> UIViewControllerAnimatedTransitioning? {
        // A finger is dragging the sheet down: keep UIKit's interactive dismissal
        // (follows the finger, then finishes on release).
        if Self.isDragging(dismissed) { return nil }
        return self
    }

    static func isDragging(_ vc: UIViewController) -> Bool {
        let pc = vc.presentationController
        let views = [pc?.presentedView, pc?.containerView, vc.view].compactMap { $0 }
        for v in views {
            for g in v.gestureRecognizers ?? [] where g.state == .began || g.state == .changed { return true }
        }
        return false
    }

    func transitionDuration(using ctx: UIViewControllerContextTransitioning?) -> TimeInterval {
        MotionSpec.popDismissDuration
    }

    func animateTransition(using ctx: UIViewControllerContextTransitioning) {
        let container = ctx.containerView
        guard let fromVC = ctx.viewController(forKey: .from) else {
            ctx.completeTransition(!ctx.transitionWasCancelled)
            return
        }
        let sheet = fromVC.presentationController?.presentedView ?? ctx.view(forKey: .from) ?? fromVC.view!
        let dims = SoftPop.dimViews(container: container, presented: sheet)
        let reduce = SoftPop.reduceMotion
        let h = sheet.bounds.height
        UIView.animate(withDuration: MotionSpec.popDismissDuration, delay: 0, options: [.curveEaseIn, .beginFromCurrentState]) {
            if !reduce { sheet.layer.transform = SoftPop.startTransform(height: h) }
            sheet.alpha = 0
            for d in dims { d.alpha = 0 }
        } completion: { _ in
            let done = !ctx.transitionWasCancelled
            if !done {
                sheet.layer.transform = CATransform3DIdentity
                sheet.alpha = 1
                for d in dims { d.alpha = 1 }
            }
            ctx.completeTransition(done)
        }
    }
}

private var softPopKey: UInt8 = 0

/// Inside every soft sheet: pops it in (same commit as its first frame) and
/// installs the reverse.
private struct SoftPopHook: UIViewRepresentable {
    final class Hook: UIView {
        private var installed = false
        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard window != nil, !installed else { return }
            installed = true
            guard let vc = presentedRoot(of: self) else { return }
            let d = SoftPopDismissal()
            d.presented = vc
            objc_setAssociatedObject(vc, &softPopKey, d, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
            vc.transitioningDelegate = d
            let pc = vc.presentationController
            let sheet = pc?.presentedView ?? vc.view!
            SoftPop.popIn(sheet, dims: SoftPop.dimViews(container: pc?.containerView, presented: sheet))
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

private let noSlide: Transaction = {
    var t = Transaction()
    t.disablesAnimations = true
    return t
}()

private struct SoftSheetFlag<Sheet: View>: ViewModifier {
    @Binding var isPresented: Bool
    let onDismiss: (() -> Void)?
    let sheet: () -> Sheet
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .onChange(of: isPresented) { _ in sync() }
            .onAppear { if isPresented != shown { sync() } }
            .sheet(isPresented: Binding(get: { shown }, set: { v in
                shown = v
                if !v { isPresented = false }
            }), onDismiss: onDismiss) {
                sheet().background(SoftPopHook())
            }
    }

    private func sync() {
        if isPresented && !shown {
            withTransaction(noSlide) { shown = true }   // built this frame, then popped
        } else if !isPresented && shown {
            shown = false                               // animated → SoftPopDismissal
        }
    }
}

private struct SoftSheetItem<Item: Identifiable, Sheet: View>: ViewModifier {
    @Binding var item: Item?
    let onDismiss: (() -> Void)?
    let sheet: (Item) -> Sheet
    @State private var shown: Item?

    func body(content: Content) -> some View {
        content
            .onChange(of: item.map { AnyHashable($0.id) }) { _ in sync() }
            .onAppear { if item != nil, shown == nil { sync() } }
            .sheet(item: Binding(get: { shown }, set: { v in
                shown = v
                if v == nil { item = nil }
            }), onDismiss: onDismiss) { it in
                sheet(it).background(SoftPopHook())
            }
    }

    private func sync() {
        guard let next = item else {
            if shown != nil { shown = nil }
            return
        }
        if shown == nil {
            withTransaction(noSlide) { shown = next }
        } else {
            shown = next   // an in-place swap keeps SwiftUI's own behavior
        }
    }
}

extension View {
    /// BJ10: an app-owned sheet that soft-pops (drop-in for `.sheet(isPresented:)`).
    func softSheet<Sheet: View>(isPresented: Binding<Bool>, onDismiss: (() -> Void)? = nil,
                                @ViewBuilder content: @escaping () -> Sheet) -> some View {
        modifier(SoftSheetFlag(isPresented: isPresented, onDismiss: onDismiss, sheet: content))
    }

    /// BJ10: an app-owned sheet that soft-pops (drop-in for `.sheet(item:)`).
    func softSheet<Item: Identifiable, Sheet: View>(item: Binding<Item?>, onDismiss: (() -> Void)? = nil,
                                                    @ViewBuilder content: @escaping (Item) -> Sheet) -> some View {
        modifier(SoftSheetItem(item: item, onDismiss: onDismiss, sheet: content))
    }
}
