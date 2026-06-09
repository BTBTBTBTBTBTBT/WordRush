import SwiftUI

/// Pulsing placeholder block — the SwiftUI analogue of the web's
/// `animate-pulse` skeletons (gray rounded bars that breathe while loading).
/// Used instead of spinners on data-heavy surfaces, matching the web.
struct SkeletonBlock: View {
    var height: CGFloat
    var width: CGFloat? = nil
    var cornerRadius: CGFloat = 8
    @State private var pulse = false

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Theme.surfaceAlt)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil)
            .opacity(pulse ? 0.45 : 1)
            .onAppear {
                guard !Theme.reduceMotion else { return }
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulse = true }
            }
    }
}

/// N pulsing leaderboard-row placeholders (web LeaderboardSkeleton — 5 rows).
struct LeaderboardSkeleton: View {
    var rows: Int = 5
    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<rows, id: \.self) { _ in SkeletonBlock(height: 44, cornerRadius: 10) }
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
