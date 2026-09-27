import SwiftUI

/// Recent games — one RecentMatchRow per match (solo and VS, daily and
/// unlimited alike), newest first. Port of web
/// `components/stats/recent-matches.tsx`. Founder (2026-09-26): the same rows
/// sit on the Today page ("the most recent games played, even the unlimited
/// games") capped at five with a "See all N in All-time →" link, and on
/// All-time as the full list with View all / Show less.
struct RecentMatchesList: View {
    let matches: [PublicProfileService.RecentMatch]
    let profileId: String
    let opponentNames: [String: String]
    var loading: Bool = false
    /// Rows shown before "View all" (Today: 5, no expander — `onSeeAll` instead).
    var limit: Int = 5
    /// Today's page: a "See all →" link instead of expanding in place.
    var onSeeAll: (() -> Void)? = nil
    @State private var showAll = false

    var body: some View {
        // Web parity: skeleton rows while loading, then either the matches or
        // "No games played yet." — the section never just vanishes.
        if loading {
            VStack(spacing: 8) {
                ForEach(0..<min(5, limit), id: \.self) { _ in SkeletonBlock(height: 52, cornerRadius: 12) }
            }
        } else if matches.isEmpty {
            Text("No games played yet.").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
        } else {
            let shown = (showAll && onSeeAll == nil) ? matches : Array(matches.prefix(limit))
            VStack(spacing: 8) {
                ForEach(shown) { m in
                    RecentMatchRow(
                        match: m, profileId: profileId,
                        opponentName: m.opponentId(profileId).map { opponentNames[$0] ?? "Unknown" })
                }
            }
            if matches.count > limit {
                if let onSeeAll {
                    Button { Haptics.tap(); onSeeAll() } label: {
                        Text("See all \(matches.count) in All-time →")
                            .font(Brand.font(11, .heavy)).foregroundStyle(Theme.primary).frame(maxWidth: .infinity)
                    }.buttonStyle(.plain).padding(.top, 2)
                } else {
                    Button { showAll.toggle() } label: {
                        Text(showAll ? "Show less" : "View all \(matches.count) ›")
                            .font(Brand.font(11, .heavy)).foregroundStyle(Theme.primary).frame(maxWidth: .infinity)
                    }.buttonStyle(.plain).padding(.top, 2)
                }
            }
        }
    }
}
