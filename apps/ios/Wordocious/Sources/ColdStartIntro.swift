import SwiftUI
import WordociousCore

/// FINISH_SPEC §F2: the cold-start intro. The static launch screen (Info.plist
/// `UILaunchScreen`: the Home wallpaper color + `launch-w`, the app icon's W mascot,
/// centered) hands off to this overlay, which starts from exactly that frame:
/// the W bounces once, glides into the first slot of a centered WORDOCIOUS row
/// while the other nine cast heroes pop in one after another (60 ms apart, spring),
/// then the whole row glides up into the Home header's cast row as the backdrop
/// fades and Home shows underneath. ≤ 1.6 s, tap to skip, cold start only (never on
/// resume / warm start). Reduce Motion: a 200 ms crossfade. Decorative.
struct ColdStartIntroHost: View {
    /// Once per process: a warm start never replays it.
    private static var played = false
    @State private var visible = !ColdStartIntroHost.played

    var body: some View {
        if visible {
            ColdStartIntro {
                ColdStartIntroHost.played = true
                visible = false
            }
            .onAppear { ColdStartIntroHost.played = true }
        }
    }
}

private struct ColdStartIntro: View {
    let onDone: () -> Void

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @State private var start = Date()
    @State private var fade: Double = 1
    @State private var finishing = false

    /// The launch image's size: 512 px @3x.
    private static let launchSize: CGFloat = 512 / 3
    private static let total: Double = 1.6
    private static let background = Color(hex: 0xF1D7F6)

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            let safeTop = geo.safeAreaInsets.top
            ZStack {
                if still {
                    Self.background
                    Image(MascotID.w.assetName).resizable().interpolation(.high).scaledToFit()
                        .frame(width: Self.launchSize, height: Self.launchSize)
                        .position(x: size.width / 2, y: size.height / 2)
                } else {
                    TimelineView(.animation) { ctx in
                        frame(t: ctx.date.timeIntervalSince(start), size: size, safeTop: safeTop)
                    }
                }
            }
            .opacity(fade)
        }
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture { finish(after: 0, fadeOut: 0.15) }
        .accessibilityHidden(true)
        .task {
            if still {
                finish(after: 0.05, fadeOut: 0.2)
            } else {
                finish(after: Self.total - 0.05, fadeOut: 0.05)
            }
        }
    }

    private func finish(after delay: Double, fadeOut: Double) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            guard !finishing else { return }
            finishing = true
            withAnimation(.easeOut(duration: fadeOut)) { fade = 0 }
            DispatchQueue.main.asyncAfter(deadline: .now() + fadeOut) { onDone() }
        }
    }

    // MARK: The choreography (t in seconds)

    private func ease(_ x: Double) -> Double { CubicBezier.easeInOut.value(at: min(1, max(0, x))) }

    /// The slot centers of a WORDOCIOUS row laid out like the living cast header
    /// (same figure size, packing and stagger), with its bottom edge at `bottom`.
    private func slots(width: CGFloat, bottom: CGFloat) -> [CGPoint] {
        let s = LivingCastHeader.figure
        var x = LivingCastHeader.inset
        return Mascots.cast.enumerated().map { i, m in
            let w = s * (LivingCastHeader.visibleWidth[m] ?? 1)
            let c = CGPoint(x: x + w / 2, y: bottom - s / 2 - (i % 2 == 1 ? LivingCastHeader.stagger : 0))
            x += w - s * LivingCastHeader.overlap
            return c
        }
    }

    private func frame(t: Double, size: CGSize, safeTop: CGFloat) -> some View {
        let s = LivingCastHeader.figure
        let mid = slots(width: size.width, bottom: size.height / 2 + s / 2)
        let header = slots(width: size.width, bottom: safeTop + LivingCastHeader.height(pro: AuthService.shared.isProActive))
        // 1.20 → 1.55 s: the row glides up into the header while the backdrop fades.
        let glide = ease((t - 1.2) / 0.35)
        let backdrop = 1 - ease((t - 1.15) / 0.4)
        return ZStack {
            Self.background.opacity(backdrop)
            ForEach(0..<Mascots.cast.count, id: \.self) { i in
                figure(i, t: t, s: s, mid: mid[i], header: header[i], glide: glide, size: size)
            }
        }
    }

    @ViewBuilder
    private func figure(_ i: Int, t: Double, s: CGFloat, mid: CGPoint, header: CGPoint, glide: Double, size: CGSize) -> some View {
        let m = Mascots.cast[i]
        let rowPoint = CGPoint(x: mid.x + (header.x - mid.x) * glide, y: mid.y + (header.y - mid.y) * glide)
        if i == 0 {
            // W: the launch frame → one bounce (0–0.32 s) → into slot 0 (0.32–0.6 s).
            let bounce = Keyframes.sample([(0, .identity), (0.38, CastPose(ty: -0.07, sx: 1.08, sy: 1.08)),
                                           (0.7, CastPose(sx: 0.95, sy: 0.95)), (1, .identity)],
                                          at: min(1, t / 0.32), easing: .easeInOut)
            let k = ease((t - 0.32) / 0.28)
            let side = Self.launchSize + (s - Self.launchSize) * k
            let center = CGPoint(x: size.width / 2 + (rowPoint.x - size.width / 2) * k,
                                 y: size.height / 2 + (rowPoint.y - size.height / 2) * k)
            Image(m.assetName).resizable().interpolation(.high).scaledToFit()
                .frame(width: side, height: side)
                .scaleEffect(x: CGFloat(bounce.sx), y: CGFloat(bounce.sy), anchor: .bottom)
                .offset(y: CGFloat(bounce.ty) * side)
                .position(center)
        } else {
            // The other nine pop in, 60 ms apart, with a spring.
            let start = 0.42 + Double(i - 1) * 0.06
            let p = (t - start) / 0.3
            let pop = p <= 0 ? CastPose(sx: 0, sy: 0)
                : Keyframes.sample([(0, CastPose(sx: 0.2, sy: 0.2)), (0.6, CastPose(sx: 1.12, sy: 1.12)), (1, .identity)],
                                   at: min(1, p), easing: CubicBezier(0.3, 1.4, 0.5, 1))
            Image(m.assetName).resizable().interpolation(.high).scaledToFit()
                .frame(width: s, height: s)
                .scaleEffect(x: CGFloat(pop.sx), y: CGFloat(pop.sy), anchor: .bottom)
                .opacity(p <= 0 ? 0 : 1)
                .position(rowPoint)
        }
    }
}
