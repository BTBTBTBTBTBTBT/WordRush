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

    private var titleColors: [Color] {
        flawless ? [Color(hex: 0xFBBF24), Color(hex: 0xD97706), Color(hex: 0xB45309)]
                 : [sweepA, sweepB]
    }
    private var cardBG: [Color] {
        flawless ? [Color(hex: 0xFFFBEB), Color(hex: 0xFEF3C7)]
                 : (more ? [Color(hex: 0xEEF2FF), Color(hex: 0xE0E7FF)] : [Color(hex: 0xFAF5FF), Color(hex: 0xFCE7F3)])
    }
    private var borderC: Color { flawless ? Color(hex: 0xF59E0B) : (more ? Color(hex: 0xA5B4FC) : Color(hex: 0xC4B5FD)) }
    private var accentText: Color { flawless ? Color(hex: 0xB45309) : (more ? Color(hex: 0x4338CA) : Color(hex: 0x6D28D9)) }

    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea().onTapGesture { onClose() }

            SweepParticleBurst(flawless: flawless, more: more).allowsHitTesting(false)

            VStack(spacing: 0) {
                LinearGradient(colors: flawless
                    ? [Color(hex: 0xFBBF24), Color(hex: 0xD97706), Color(hex: 0xFBBF24)]
                    : [sweepA, sweepB, sweepA],
                    startPoint: .leading, endPoint: .trailing)
                    .frame(height: 6)

                VStack(spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: flawless ? "trophy.fill" : "sparkles")
                            .foregroundStyle(flawless ? Color(hex: 0xD97706) : (more ? Color(hex: 0x4F46E5) : Color(hex: 0x7C3AED)))
                        Text(title)
                            .font(Brand.font(more ? 22 : 26, .black)).minimumScaleFactor(0.7).lineLimit(1)
                            .foregroundStyle(LinearGradient(colors: titleColors, startPoint: .leading, endPoint: .trailing))
                        Image(systemName: flawless ? "trophy.fill" : "sparkles")
                            .foregroundStyle(flawless ? Color(hex: 0xD97706) : (more ? Color(hex: 0x6366F1) : Color(hex: 0xEC4899)))
                    }
                    Text(flawless ? "All \(totalCount) \(more ? "More Games puzzles" : "daily puzzles") won today"
                                  : "All \(totalCount) \(more ? "More Games puzzles" : "daily puzzles") completed today")
                        .font(Brand.font(12, .heavy)).foregroundStyle(accentText)

                    HStack(spacing: 28) {
                        stat("\(wonCount)/\(totalCount)", "Won")
                        stat(fmt(Int(timeSum.rounded())), "Total Time")
                        stat(formatScore(scoreSum), "Total Pts")
                    }
                    .padding(.top, 4)

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
                                Text(r.modeLabel).font(Brand.font(11, .bold)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                                .minimumScaleFactor(0.7)
                                Spacer(minLength: 0)
                                Text(r.won ? "✓" : "✗").font(Brand.font(12, .black))
                                    .foregroundStyle(r.won ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626))
                            }
                        }
                    }
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.55)))

                    HStack(spacing: 8) {
                        Button {
                            ShareEvents.log(kind: "image", gameMode: "", surface: more ? "more_sweep_celebration" : "sweep_celebration")
                            if more { ShareService.shareMoreSweep(byMode: byMode) } else { ShareService.shareDailySweep(byMode: byMode) }
                        } label: {
                            HStack(spacing: 6) { Image(systemName: "square.and.arrow.up"); Text("Share") }
                                .font(Brand.font(15, .black)).foregroundStyle(.white)
                                .frame(maxWidth: .infinity).padding(.vertical, 11)
                                .background(RoundedRectangle(cornerRadius: 12).fill(
                                    LinearGradient(colors: flawless
                                        ? [Color(hex: 0xD97706), Color(hex: 0xB45309)]
                                        : (more ? [Color(hex: 0x4F46E5), Color(hex: 0x6366F1)] : [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)]),
                                        startPoint: .leading, endPoint: .trailing)))
                        }
                        Button { onClose() } label: {
                            HStack(spacing: 5) { Image(systemName: "xmark"); Text("Close") }
                                .font(Brand.font(15, .black)).foregroundStyle(accentText)
                                .padding(.horizontal, 18).padding(.vertical, 11)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.7)))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                        }
                    }
                    .padding(.top, 4)
                }
                .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 18)
            }
            .background(
                ZStack {
                    LinearGradient(colors: cardBG, startPoint: .top, endPoint: .bottom)
                    FoilShimmer(strong: flawless)
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(borderC, lineWidth: 1.5))
            .shadow(color: .black.opacity(0.25), radius: 20, y: 12)
            .padding(.horizontal, 24)
        }
        .onAppear { Haptics.success(); SoundManager.shared.playSuccess() }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(Brand.font(20, .black)).foregroundStyle(Theme.textPrimary)
            Text(label.uppercased()).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
        }
    }

    private func fmt(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }
}

/// Radial particle burst — squares (sparkle) for Sweep, glowing dots (firework)
/// for Flawless. Deterministic angles so there's no per-render churn.
private struct SweepParticleBurst: View {
    let flawless: Bool
    var more: Bool = false
    @State private var animate = false

    var body: some View {
        let count = flawless ? 28 : 20
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
                    .animation(Theme.animation(.easeOut(duration: flawless ? 1.6 : 1.9)
                        .delay(Double(i % 7) * 0.12).repeatForever(autoreverses: false)), value: animate)
                }
            }
        }
        .onAppear { animate = true }
    }
}

/// Subtle diagonal shimmer for the home Sweep/Flawless banner.
struct BannerShimmer: View {
    @State private var phase: CGFloat = -1
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            LinearGradient(colors: [.clear, .white.opacity(0.45), .clear],
                           startPoint: .leading, endPoint: .trailing)
                .frame(width: w * 0.4)
                .rotationEffect(.degrees(-18))
                .offset(x: phase * w * 1.6)
                .onAppear {
                    withAnimation(Theme.animation(.easeInOut(duration: 2.4).repeatForever(autoreverses: false))) {
                        phase = 1.2
                    }
                }
        }
        .allowsHitTesting(false)
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
                    withAnimation(Theme.animation(.easeInOut(duration: 2.4).repeatForever(autoreverses: false))) {
                        phase = 1.2
                    }
                }
        }
        .allowsHitTesting(false)
    }
}
