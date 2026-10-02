import SwiftUI
import WordociousCore

// One-time full-screen celebration shown when every Daily Sweep puzzle is complete.
// Distinct from the per-game victory confetti (which would look redundant when
// the final daily was itself a win):
//   • Daily Sweep      → violet/pink sparkle burst + foil shimmer.
//   • Flawless Victory → gold fireworks + stronger foil shimmer.
// Mirrors web components/effects/sweep-celebration.tsx.
struct SweepCelebrationView: View {
    enum Variant { case daily, more }
    let byMode: [String: DailyCompletion]
    var onClose: () -> Void
    /// .daily = the Daily Sweep; .more = the More Games Sweep (founder, 2026-09-26) —
    /// the same celebration over the ten More Games dailies, indigo instead of violet,
    /// never awarding anything and never using the Daily Sweep wording.
    var variant: Variant = .daily

    private var more: Bool { variant == .more }
    private var moreT: MoreTotals { moreTotals(byMode: byMode) }
    private var totals: DailyTotals { DailyTotals(byMode) }
    private var flawless: Bool { more ? moreSweepTier(byMode: byMode) == .flawless : totals.flawless }
    private var rows: [DailySweepRow] { DailySweepCatalog.rows(from: byMode, over: more ? DailySweepCatalog.moreModes : nil) }
    private var wonCount: Int { more ? moreT.won : totals.won }
    private var totalCount: Int { more ? moreT.total : totals.total }
    private var timeSum: Double { more ? moreT.totalTimeSeconds : totals.totalTimeSeconds }
    private var scoreSum: Double { more ? moreT.totalScore : totals.totalScore }
    private var sweepA: Color { more ? Color(hex: 0x6366F1) : Color(hex: 0xA78BFA) }
    private var sweepB: Color { more ? Color(hex: 0x4F46E5) : Color(hex: 0xEC4899) }
    private var title: String {
        flawless ? (more ? MoreSweepTier.flawless.title : "FLAWLESS VICTORY!") : (more ? MoreSweepTier.sweep.title : "DAILY SWEEP!")
    }

    @State private var burst = false
    /// §G3: the big art springs in with a bounce (Reduce Motion: a plain fade).
    @State private var artIn = false
    @Environment(\.accessibilityReduceMotion) private var envReduce

    /// FINISH_SPEC §G3: the moment's color — pink for Flawless (the pink O on her gem),
    /// gold for the Daily Sweep (S racing the broom), indigo for the More Games Sweep.
    private var accent: Color {
        flawless ? Color(hex: 0xEC4899) : (more ? Color(hex: 0x6366F1) : Color(hex: 0xF59E0B))
    }
    private var accentText: Color {
        flawless ? Color(hex: 0xA0336B) : (more ? Color(hex: 0x4338CA) : Color(hex: 0x8A4A12))
    }
    private var artName: String { flawless ? "art-scene-flawless-star" : "art-scene-sweep-broom" }

    var body: some View {
        let still = envReduce || Theme.reduceMotion
        let dark = Theme.isDark
        ZStack {
            // §G3: a full-screen tinted overlay in the moment's color.
            LinearGradient(colors: dark ? [Color(hex: 0x17111F).opacity(0.94), accent.opacity(0.35)]
                                        : [accent.wash(0.22).opacity(0.96), accent.wash(0.40).opacity(0.96)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .onTapGesture { onClose() }

            SweepParticleBurst(flawless: flawless, more: more).allowsHitTesting(false)
            if !still { ConfettiView() }

            ScrollView(showsIndicators: false) {
                VStack(spacing: 10) {
                    // ART_SPEC §6: SWEEP! / FLAWLESS! lettering above the art; the text title is the fallback.
                    MomentLettering(flawless ? .flawless : .sweep) {
                        Text(title)
                            .font(Brand.font(more ? 24 : 28, .black)).minimumScaleFactor(0.7).lineLimit(1)
                            .foregroundStyle(accentText)
                    }
                    // §G3: the big art springing in.
                    if ArtAsset.exists(artName) {
                        Image(artName).resizable().interpolation(.high).scaledToFit()
                            .frame(maxWidth: 300, maxHeight: 210)
                            .scaleEffect(artIn ? 1 : (still ? 1 : 0.6))
                            .opacity(artIn ? 1 : 0)
                            .accessibilityHidden(true)
                    }
                    Text(flawless ? "All \(totalCount) \(more ? "More Games puzzles" : "daily puzzles") won today"
                                  : "All \(totalCount) \(more ? "More Games puzzles" : "daily puzzles") completed today")
                        .font(Brand.font(13, .heavy)).foregroundStyle(dark ? Theme.textSecondary : accentText)
                        .multilineTextAlignment(.center)

                    // §G3: soft-number stat tiles (tinted, top bars).
                    HStack(spacing: 8) {
                        stat("\(wonCount)/\(totalCount)", "Won", Color(hex: 0x7C3AED))
                        stat(fmt(Int(timeSum.rounded())), "Total Time", Color(hex: 0x2563EB))
                        stat(formatScore(scoreSum), "Total Pts", Color(hex: 0xF5A524))
                    }
                    .padding(.top, 2)

                    // Per-game list (3-column grid of badge + name + result)
                    let cols = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
                    LazyVGrid(columns: cols, spacing: 6) {
                        ForEach(rows) { r in
                            HStack(spacing: 5) {
                                // Real game icon (same as the home cards), mapped by dbKey;
                                // falls back to the letter glyph if a mode isn't found.
                                if let m = (homeModes + moreModes).first(where: { $0.dbKey == r.dbKey }) {
                                    ModeIconView(icon: m.icon, accent: r.accent, box: 22)
                                } else {
                                    Text(r.glyph).font(Brand.font(r.glyph.count >= 3 ? 9 : 12, .black)).foregroundStyle(.white)
                                        .frame(width: 22, height: 22)
                                        .background(RoundedRectangle(cornerRadius: 7).fill(r.accent))
                                }
                                Text(r.modeLabel).font(Brand.font(11, .bold)).foregroundStyle(FinishInk.heading).lineLimit(1)
                                .minimumScaleFactor(0.7)
                                Spacer(minLength: 0)
                                // ART_SPEC §4: the 3D W / L badge per daily.
                                ResultBadge(won: r.won, size: 18)
                            }
                        }
                    }
                    .padding(10)
                    .tintedCard(accent: accent, bar: [accent, accent.wash(0.55)], radius: 16, barHeight: 6)

                    HStack(spacing: 10) {
                        Button {
                            ShareEvents.log(kind: "image", gameMode: "", surface: more ? "more_sweep_celebration" : "sweep_celebration")
                            if more { ShareService.shareMoreSweep(byMode: byMode) } else { ShareService.shareDailySweep(byMode: byMode) }
                        } label: {
                            CandyLabel(title: "Share") { Icon3D(.share, size: 20) }
                        }
                        .buttonStyle(CandyButtonStyle(variant: flawless ? .pink : (more ? .purple : .amber), size: .large))
                        Button { onClose() } label: { CandyLabel(title: "Close") }
                            .buttonStyle(CandyButtonStyle(variant: .peach, size: .large, fullWidth: false))
                    }
                    .padding(.top, 4)
                }
                .padding(.horizontal, 22).padding(.vertical, 40)
                .frame(maxWidth: 440)
                .frame(maxWidth: .infinity)
            }
        }
        .onAppear {
            Feedback.celebrate()   // §U: celebrate · success+heavy
            if still { artIn = true } else {
                withAnimation(.spring(response: 0.55, dampingFraction: 0.55).delay(0.15)) { artIn = true }
            }
        }
    }

    private func stat(_ value: String, _ label: String, _ c: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).softNumber(20).lineLimit(1).minimumScaleFactor(0.6)
            Text(label.uppercased()).font(Brand.font(9, .black)).tracking(1).foregroundStyle(FinishInk.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 12).padding(.bottom, 8).padding(.horizontal, 4)
        .tintedPill(c, radius: 14)
    }

    private func fmt(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }
}

/// Radial particle burst — squares (sparkle) for Sweep, glowing dots (firework)
/// for Flawless. Deterministic angles so there's no per-render churn.
private struct SweepParticleBurst: View {
    let flawless: Bool
    var more: Bool = false
    @State private var animate = false
    /// §AD: Low Power Mode (or Reduce Motion) halves the burst and plays it once.
    private let calm = Motion.calm()

    var body: some View {
        let count = Motion.particles(flawless ? 28 : 20, calm: calm)
        GeometryReader { geo in
            let cx = geo.size.width / 2, cy = geo.size.height / 2 - 60
            ZStack {
                ForEach(0..<count, id: \.self) { i in
                    let angle = Double(i) / Double(count) * .pi * 2 + Double(i % 2) * 0.4
                    let dist = (flawless ? 180.0 : 140.0) + Double(i % 5) * 22
                    let dx = cos(angle) * dist, dy = sin(angle) * dist
                    let size: CGFloat = flawless ? CGFloat(10 + (i % 4) * 4) : CGFloat(8 + (i % 3) * 3)
                    Group {
                        if flawless {
                            Circle().fill(RadialGradient(colors: [Color(hex: 0xFDE68A), Color(hex: 0xF59E0B)],
                                                         center: .center, startRadius: 0, endRadius: size))
                        } else {
                            RoundedRectangle(cornerRadius: 2).fill(i % 2 == 0 ? (more ? Color(hex: 0xA5B4FC) : Color(hex: 0xC4B5FD)) : (more ? Color(hex: 0x818CF8) : Color(hex: 0xF9A8D4)))
                        }
                    }
                    .frame(width: size, height: size)
                    .position(x: cx + (animate ? dx : 0), y: cy + (animate ? dy : 0))
                    .opacity(animate ? 0 : 1)
                    .animation(Theme.animation(calm
                        ? .easeOut(duration: flawless ? 1.6 : 1.9).delay(Double(i % 7) * 0.12)
                        : .easeOut(duration: flawless ? 1.6 : 1.9).delay(Double(i % 7) * 0.12).repeatForever(autoreverses: false)),
                               value: animate)
                }
            }
        }
        .onAppear { animate = true }
    }
}

/// Diagonal foil shimmer sweeping across the card surface.
private struct FoilShimmer: View {
    let strong: Bool
    @State private var phase: CGFloat = -1

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            LinearGradient(colors: [.clear, .white.opacity(strong ? 0.7 : 0.45), .clear],
                           startPoint: .leading, endPoint: .trailing)
                .frame(width: w * 0.4)
                .rotationEffect(.degrees(-18))
                .offset(x: phase * w * 1.6)
                .onAppear {
                    // §AD: no endless shimmer in Low Power Mode / Reduce Motion.
                    guard !Motion.calm() else { return }
                    withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: false)) {
                        phase = 1.2
                    }
                }
        }
        .allowsHitTesting(false)
    }
}
