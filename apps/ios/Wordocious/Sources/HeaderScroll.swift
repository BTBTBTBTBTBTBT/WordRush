import SwiftUI

// 2.8 item 14 (founder 10-07): a clean scroll edge under the cast header on Home, Leaderboard,
// Stats and Friends.
//  - Content no longer meets the header in a hard cut: the scroll view's top edge dissolves
//    (an alpha mask, so it works over any wallpaper / Halloween surface), growing from 0 to
//    `HeaderScrollSpec.fadeHeight` over the first few points of scroll — at rest the first row
//    is fully opaque.
//  - The cast row gently condenses (a slimmer row; the counters / help / settings row stays) as
//    the page scrolls and expands again at the top.
//  - Reduce Motion (OS or in-app) = fade only, the row never changes size.
// Cost: the offset is read by one zero-height probe inside the scroll content; the model
// publishes only when the quantized progress changes (40 steps), and only the cast row + the
// mask observe it — never the page's body — so scrolling stays at 60 fps.
//
// Off-switch (suggested flag): `header_condense` (the fade stays; only the condense is gated).

enum HeaderScrollSpec {
    /// Points of scroll over which the cast row reaches its slimmest.
    static let condenseDistance: CGFloat = 64
    /// The slimmest the cast row gets (fraction of its full size).
    static let minScale: CGFloat = 0.64
    /// The soft fade at the scroll view's top edge.
    static let fadeHeight: CGFloat = 16
    /// Points of scroll before the fade is fully in (so the first row is opaque at rest).
    static let fadeRamp: CGFloat = 8
    static let coordinateSpace = "wordociousHeaderScroll"

    /// Condense progress (0...1) for a scroll offset, quantized to 1/40 so it publishes rarely.
    static func progress(offset: CGFloat) -> CGFloat {
        let p = min(1, max(0, offset / condenseDistance))
        return (p * 40).rounded() / 40
    }

    /// Fade strength (0...1) for a scroll offset, quantized to 1/10.
    static func fade(offset: CGFloat) -> CGFloat {
        let f = min(1, max(0, offset / fadeRamp))
        return (f * 10).rounded() / 10
    }

    /// The cast row's scale for a progress (1 = full).
    static func scale(progress: CGFloat) -> CGFloat { 1 - (1 - minScale) * progress }
}

@MainActor
final class HeaderScrollModel: ObservableObject {
    @Published private(set) var progress: CGFloat = 0
    @Published private(set) var fade: CGFloat = 0

    func update(offset: CGFloat) {
        let p = HeaderScrollSpec.progress(offset: offset)
        if p != progress { progress = p }
        let f = HeaderScrollSpec.fade(offset: offset)
        if f != fade { fade = f }
    }
}

private struct HeaderScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

/// Drop this as the FIRST child of a scroll view's content: it reports how far the content has scrolled.
struct HeaderScrollProbe: View {
    var body: some View {
        GeometryReader { g in
            Color.clear.preference(key: HeaderScrollOffsetKey.self,
                                   value: -g.frame(in: .named(HeaderScrollSpec.coordinateSpace)).minY)
        }
        .frame(height: 0)
        .accessibilityHidden(true)
    }
}

private struct HeaderScrollFadeModifier: ViewModifier {
    @ObservedObject var model: HeaderScrollModel

    func body(content: Content) -> some View {
        content
            .coordinateSpace(name: HeaderScrollSpec.coordinateSpace)
            .onPreferenceChange(HeaderScrollOffsetKey.self) { model.update(offset: $0) }
            .mask(
                VStack(spacing: 0) {
                    LinearGradient(colors: [.black.opacity(1 - model.fade), .black], startPoint: .top, endPoint: .bottom)
                        .frame(height: HeaderScrollSpec.fadeHeight * model.fade)
                    Rectangle().fill(Color.black)
                }
            )
    }
}

extension View {
    /// Put on the page's `ScrollView` (with a `HeaderScrollProbe()` as the first child of its content).
    func headerScrollFade(_ model: HeaderScrollModel) -> some View {
        modifier(HeaderScrollFadeModifier(model: model))
    }
}

/// The cast row that slims down as the page scrolls. Reports a height scaled by the progress and
/// draws the row scaled from its top, so nothing re-lays out inside the row.
struct CondensingCast: View {
    @ObservedObject var model: HeaderScrollModel
    var pro: Bool
    @Environment(\.accessibilityReduceMotion) private var envReduceMotion

    var body: some View {
        let scale = Motion.calm(envReduceMotion) ? 1 : HeaderScrollSpec.scale(progress: model.progress)
        LivingCastHeader(pro: pro)
            .scaleEffect(scale, anchor: .top)
            .modifier(ScaledHeight(scale: scale))
    }
}

/// Reports the child's height times `scale` to the parent (the child itself is not resized).
private struct ScaledHeight: ViewModifier {
    var scale: CGFloat
    func body(content: Content) -> some View {
        ScaledHeightLayout(scale: scale) { content }
    }
}

private struct ScaledHeightLayout: Layout {
    var scale: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let v = subviews.first else { return .zero }
        let s = v.sizeThatFits(proposal)
        return CGSize(width: s.width, height: s.height * scale)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let v = subviews.first else { return }
        let s = v.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
        v.place(at: CGPoint(x: bounds.minX, y: bounds.minY), anchor: .topLeading,
                proposal: ProposedViewSize(width: bounds.width, height: s.height))
    }
}
