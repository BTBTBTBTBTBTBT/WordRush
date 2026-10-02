import SwiftUI
import WordociousCore

/// FINISH_SPEC §F2 / §AQ3: the cold-start intro. The static launch screen (Info.plist
/// `UILaunchScreen`: the Home wallpaper color only — no image, so the system never
/// shows a second W of a different size or skin) hands off to this overlay on the
/// same color: the W pops in at the center, glides into the first slot of a centered WORDOCIOUS row
/// while the other nine cast heroes pop in one after another (60 ms apart, spring),
/// then the whole row glides up into the Home header's cast row as the backdrop
/// fades and Home shows underneath. ≤ 1.6 s, tap to skip, cold start only (never on
/// resume / warm start). Reduce Motion: a 200 ms crossfade. Decorative.
struct ColdStartIntroHost: View {
    /// Once per process: a warm start never replays it.
    private static var played = false
    @State private var visible = !ColdStartIntroHost.played

    var body: some View {
        ZStack {
            // FINISH_SPEC §W: first-run onboarding — only once the intro has landed
            // (never under it), only for players who have never played.
            OnboardingHost(introDone: !visible)
            if visible {
                ColdStartIntro {
                    ColdStartIntroHost.played = true
                    visible = false
                }
                .onAppear {
                    ColdStartIntroHost.played = true
                    CastHandoff.shared.introStarted = true
                }
            }
        }
    }
}

/// FINISH_SPEC §F2 fix (founder, iOS 234: "there are two of them and the one that
/// animates whips off the screen while the duplicate stays in place"): the hand-off
/// between the cold-start intro and the REAL Home header cast row.
///   1. While the intro runs, the real row is hidden (opacity 0, still laid out).
///   2. The real row reports each character's on-screen frame here; the intro glides
///      its row to exactly those frames (ease, no overshoot).
///   3. On landing, in the same frame, the real row shows and the intro is removed.
///   4. Then the real row plays the all-cast hop flourish (`CastMoves.flourishPose`).
@MainActor
final class CastHandoff: ObservableObject {
    static let shared = CastHandoff()

    /// The real header row is hidden while this is true. A cold process starts
    /// with it on (the intro is about to cover the screen); a fail-safe turns it
    /// off if the intro never runs.
    @Published var introRunning = true
    /// Each character's frame in the real row (global coordinates), reported by
    /// LivingCastHeader while the intro runs.
    @Published var frames: [MascotID: CGRect] = [:]
    /// When the landing flourish started (nil = none playing).
    @Published var flourishStart: Date?
    var introStarted = false

    private init() {
        // Fail-safe: never leave the real row hidden (the intro is ≤ 1.6 s).
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) { [weak self] in
            guard let self, self.introRunning else { return }
            self.introRunning = false
        }
    }

    /// Step 3 + 4: show the real row (same frame the intro is removed in), then
    /// the flourish unless `flourish` is false (Reduce Motion).
    func land(flourish: Bool) {
        introRunning = false
        guard flourish else { return }
        let start = Date()
        flourishStart = start
        // §U: the landing flourish's hops (the sound's min gap thins them to a quick cascade).
        for i in 0..<CastMoves.ids.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * CastMoves.flourishStagger) { Feedback.hop(volume: 0.7) }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + CastMoves.flourishDuration() + 0.05) { [weak self] in
            if self?.flourishStart == start { self?.flourishStart = nil }
        }
    }
}

/// The real row's per-character frames (global).
struct CastFramesKey: PreferenceKey {
    static var defaultValue: [MascotID: CGRect] = [:]
    static func reduce(value: inout [MascotID: CGRect], nextValue: () -> [MascotID: CGRect]) {
        value.merge(nextValue()) { $1 }
    }
}

private struct ColdStartIntro: View {
    let onDone: () -> Void

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    @ObservedObject private var handoff = CastHandoff.shared
    @State private var start = Date()
    @State private var fade: Double = 1
    @State private var finishing = false

    /// The W's size at the center (the old launch image's 512 px @3x).
    private static let launchSize: CGFloat = 512 / 3
    /// The glide lands at 1.55 s; the intro ends exactly then (≤ 1.6 s).
    private static let landing: Double = 1.55
    private static let background = Color(hex: 0xF1D7F6)

    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            let safeTop = geo.safeAreaInsets.top
            let origin = geo.frame(in: .global).origin
            ZStack {
                if still {
                    Self.background
                    Image(CastSkin.assetName(for: .w)).resizable().interpolation(.high).scaledToFit()
                        .frame(width: Self.launchSize, height: Self.launchSize)
                        .position(x: size.width / 2, y: size.height / 2)
                } else {
                    TimelineView(.animation) { ctx in
                        frame(t: ctx.date.timeIntervalSince(start), size: size, safeTop: safeTop, origin: origin)
                    }
                }
            }
            .opacity(fade)
        }
        .ignoresSafeArea()
        .contentShape(Rectangle())
        // Tap to skip: straight to the landing (step 3), then the flourish.
        .onTapGesture { land() }
        .accessibilityHidden(true)
        // §AQ3: the clock starts on the first frame shown, so a busy launch never
        // skips the W's entrance (or lands mid-glide).
        .onAppear { start = Date() }
        .task {
            if still {
                // Reduce Motion: a 200 ms crossfade over the real row, no flourish.
                handoff.introRunning = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    guard !finishing else { return }
                    finishing = true
                    withAnimation(.easeOut(duration: 0.2)) { fade = 0 }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { onDone() }
                }
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + Self.landing) { land() }
            }
        }
    }

    /// Step 3: in ONE frame the real row turns visible and the intro row is removed
    /// (no crossfade overlap, no second copy); step 4 the real row's flourish.
    private func land() {
        guard !finishing else { return }
        finishing = true
        var t = Transaction()
        t.disablesAnimations = true
        withTransaction(t) {
            handoff.land(flourish: !still)
            onDone()
        }
    }

    // MARK: The choreography (t in seconds)

    private func ease(_ x: Double) -> Double { CubicBezier.easeInOut.value(at: min(1, max(0, x))) }
    /// The glide eases OUT into the real row — it never passes its target.
    private func easeOut(_ x: Double) -> Double { CubicBezier.easeOut.value(at: min(1, max(0, x))) }

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

    /// Step 2: the real row's measured frames (in this overlay's coordinates) — the
    /// computed header slots only when the real row hasn't reported yet.
    private func targets(size: CGSize, safeTop: CGFloat, origin: CGPoint) -> [(center: CGPoint, side: CGFloat)] {
        let s = LivingCastHeader.figure
        // §AS2: the controls row sits above the cast row now.
        let fallback = slots(width: size.width,
                             bottom: safeTop + HeaderControl.tap + 2 + LivingCastHeader.height(pro: AuthService.shared.isProActive))
        return Mascots.cast.enumerated().map { i, m in
            if let f = handoff.frames[m], f.width > 0 {
                return (CGPoint(x: f.midX - origin.x, y: f.midY - origin.y), f.width)
            }
            return (fallback[i], s)
        }
    }

    private func frame(t: Double, size: CGSize, safeTop: CGFloat, origin: CGPoint) -> some View {
        let s = LivingCastHeader.figure
        let mid = slots(width: size.width, bottom: size.height / 2 + s / 2)
        let header = targets(size: size, safeTop: safeTop, origin: origin)
        // 1.20 → 1.55 s: the row glides up into the real header while the backdrop fades.
        let glide = easeOut((t - 1.2) / 0.35)
        let backdrop = 1 - ease((t - 1.15) / 0.4)
        return ZStack {
            Self.background.opacity(backdrop)
            ForEach(0..<Mascots.cast.count, id: \.self) { i in
                figure(i, t: t, s: s, mid: mid[i], header: header[i], glide: glide, size: size)
            }
        }
    }

    @ViewBuilder
    private func figure(_ i: Int, t: Double, s: CGFloat, mid: CGPoint, header: (center: CGPoint, side: CGFloat),
                        glide: Double, size: CGSize) -> some View {
        let m = Mascots.cast[i]
        let rowPoint = CGPoint(x: mid.x + (header.center.x - mid.x) * glide, y: mid.y + (header.center.y - mid.y) * glide)
        let rowSide = s + (header.side - s) * glide
        if i == 0 {
            // W: pops in on the launch color (0–0.32 s, the only W on screen) → into
            // slot 0 (0.32–0.6 s).
            let bounce = Keyframes.sample([(0, CastPose(sx: 0.55, sy: 0.55)), (0.55, CastPose(ty: -0.04, sx: 1.08, sy: 1.08)),
                                           (0.8, CastPose(sx: 0.97, sy: 0.97)), (1, .identity)],
                                          at: min(1, max(0, t) / 0.32), easing: .easeInOut)
            let k = ease((t - 0.32) / 0.28)
            let side = Self.launchSize + (rowSide - Self.launchSize) * k
            let center = CGPoint(x: size.width / 2 + (rowPoint.x - size.width / 2) * k,
                                 y: size.height / 2 + (rowPoint.y - size.height / 2) * k)
            Image(CastSkin.assetName(for: m)).resizable().interpolation(.high).scaledToFit()
                .frame(width: side, height: side)
                .scaleEffect(x: CGFloat(bounce.sx), y: CGFloat(bounce.sy), anchor: .bottom)
                .offset(y: CGFloat(bounce.ty) * side)
                .opacity(min(1, max(0, t) / 0.12))
                .position(center)
        } else {
            // The other nine pop in, 60 ms apart, with a spring.
            let start = 0.42 + Double(i - 1) * 0.06
            let p = (t - start) / 0.3
            let pop = p <= 0 ? CastPose(sx: 0, sy: 0)
                : Keyframes.sample([(0, CastPose(sx: 0.2, sy: 0.2)), (0.6, CastPose(sx: 1.12, sy: 1.12)), (1, .identity)],
                                   at: min(1, p), easing: CubicBezier(0.3, 1.4, 0.5, 1))
            Image(CastSkin.assetName(for: m)).resizable().interpolation(.high).scaledToFit()
                .frame(width: rowSide, height: rowSide)
                .scaleEffect(x: CGFloat(pop.sx), y: CGFloat(pop.sy), anchor: .bottom)
                .opacity(p <= 0 ? 0 : 1)
                .position(rowPoint)
        }
    }
}
