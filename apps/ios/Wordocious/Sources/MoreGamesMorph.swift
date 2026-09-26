import SwiftUI

/// The More Games band's frame in .global coordinates — the morph's origin.
struct MoreBandFrameKey: PreferenceKey {
    static var defaultValue: CGRect? = nil
    static func reduce(value: inout CGRect?, nextValue: () -> CGRect?) { value = nextValue() ?? value }
}

/// More Games opens by GROWING OUT OF the band (founder, 2026-09-26: "a fluid
/// entry into the menu from the current shape of the board, kind of like how we
/// do the OctoWord zooms"). Same grammar as the OctoWord board zoom in
/// BoardView: the panel starts as the band's exact rectangle (14 pt radius),
/// swells to a centered menu panel (20 pt) while the scrim fades in, and the
/// menu content fades in over the second half; dismissal runs the same path
/// backwards, shrinking onto the band before it vanishes. Replaces the system
/// sheet that used to fan up from the bottom. Web more-games-sheet.tsx and
/// Android MoreGamesMorphPanel are the twins.
struct MoreGamesMorph<Content: View>: View {
    /// The band's frame in .global coordinates (nil → grows from the centre).
    let origin: CGRect?
    /// Fires once the panel has fully collapsed — the caller unmounts and routes any pending pick.
    let onDismissed: () -> Void
    @ViewBuilder let content: (_ close: @escaping () -> Void) -> Content

    @State private var progress: CGFloat = 0
    @State private var closing = false
    private let spring: Animation = .spring(response: 0.45, dampingFraction: 0.82)

    var body: some View {
        GeometryReader { geo in
            let bounds = geo.frame(in: .global)
            let size = geo.size
            let target = CGRect(x: (size.width - min(size.width - 32, 384)) / 2,
                                y: (size.height - min(size.height - 48, 720)) / 2,
                                width: min(size.width - 32, 384),
                                height: min(size.height - 48, 720))
            let from: CGRect = origin.map {
                CGRect(x: $0.minX - bounds.minX, y: $0.minY - bounds.minY, width: $0.width, height: $0.height)
            } ?? target.insetBy(dx: target.width * 0.05, dy: target.height * 0.05)
            let p = progress
            let rect = CGRect(x: from.minX + (target.minX - from.minX) * p,
                              y: from.minY + (target.minY - from.minY) * p,
                              width: from.width + (target.width - from.width) * p,
                              height: from.height + (target.height - from.height) * p)
            let radius = 14 + 6 * p
            ZStack(alignment: .topLeading) {
                Color.black.opacity(0.4 * p)
                    .contentShape(Rectangle())
                    .onTapGesture { close() }
                // The menu is laid out at its FINAL size throughout and clipped to the
                // in-flight rectangle, so nothing reflows while the panel grows.
                content(close)
                    .frame(width: target.width, height: target.height)
                    .opacity(Double(max(0, (p - 0.5) * 2)))
                    .frame(width: rect.width, height: rect.height, alignment: .topLeading)
                    .background(Theme.background)
                    .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(Theme.border, lineWidth: 1.5))
                    .shadow(color: .black.opacity(0.12 * p), radius: 30, y: 20)
                    .opacity(Double(min(1, p * 2.5)))
                    .offset(x: rect.minX, y: rect.minY)
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
        }
        .ignoresSafeArea()
        .onAppear {
            progress = 0
            // Render at the band first, then grow — same two-step as the OctoWord zoom.
            DispatchQueue.main.async { withAnimation(Theme.animation(spring)) { progress = 1 } }
        }
    }

    private func close() {
        guard !closing else { return }
        closing = true
        withAnimation(Theme.animation(spring)) { progress = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { onDismissed() }
    }
}
