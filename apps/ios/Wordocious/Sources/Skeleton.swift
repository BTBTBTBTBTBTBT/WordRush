import SwiftUI

/// Pulsing placeholder block — the SwiftUI analogue of the web's
/// `animate-pulse` skeletons (rounded bars that breathe while loading).
/// Used instead of spinners on data-heavy surfaces, matching the web.
/// FINISH_SPEC §G5: no plain white / grey — the block is a soft lilac wash with a
/// 1.5-pt tinted border and a gentle shimmer sweeping across it (Reduce Motion:
/// a still block).
struct SkeletonBlock: View {
    var height: CGFloat
    var width: CGFloat? = nil
    var cornerRadius: CGFloat = 8
    var accent: Color = Color(hex: 0x8B5CF6)
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var envReduce

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        let dark = Theme.isDark
        shape
            .fill(dark ? accent.opacity(0.14) : accent.wash(0.12))
            .overlay {
                GeometryReader { g in
                    LinearGradient(colors: [Color.white.opacity(0), Color.white.opacity(dark ? 0.10 : 0.55), Color.white.opacity(0)],
                                   startPoint: .leading, endPoint: .trailing)
                        .frame(width: max(40, g.size.width * 0.45))
                        .offset(x: phase * g.size.width * 1.3)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .clipShape(shape)
                .opacity(envReduce || Theme.reduceMotion ? 0 : 1)
            }
            // BI23: a soft filled shimmer row — no outline.
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil)
            .accessibilityHidden(true)
            .onAppear {
                guard !(envReduce || Theme.reduceMotion) else { return }
                withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: false)) { phase = 1 }
            }
    }
}

/// N pulsing leaderboard-row placeholders (web LeaderboardSkeleton — 5 rows).
struct LeaderboardSkeleton: View {
    var rows: Int = 5
    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<rows, id: \.self) { _ in SkeletonBlock(height: 44, cornerRadius: 10, accent: Color(hex: 0xF59E0B)) }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
    }
}

/// Three pulsing card blocks (web AllTimeSkeleton on the Records page).
struct CardsSkeleton: View {
    var cards: Int = 3
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<cards, id: \.self) { _ in SkeletonBlock(height: 120, cornerRadius: 16) }
        }
        .padding(.vertical, 8)
    }
}
