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
    /// Empty-state line (Today: "No games yet today…").
    var emptyText: String = "No games played yet."
    @State private var showAll = false

    /// Whether a `matches.created_at` stamp (UTC ISO-8601 from Supabase) falls on the
    /// device's local calendar day today. Parses the first 19 characters as UTC so
    /// microsecond fractions and "+00:00" never trip the parser.
    static func isToday(_ createdAt: String) -> Bool {
        guard createdAt.count >= 19, let d = utcFormatter.date(from: String(createdAt.prefix(19))) else { return false }
        return Calendar.current.isDateInToday(d)
    }
    /// Built once: a DateFormatter per call (every match, every render) made the Stats page stutter (founder, 2026-09-29).
    private static let utcFormatter: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian); f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f
    }()

    var body: some View {
        // Web parity: skeleton rows while loading, then either the matches or
        // "No games played yet." — the section never just vanishes.
        if loading {
            VStack(spacing: 8) {
                ForEach(0..<min(5, limit), id: \.self) { _ in SkeletonBlock(height: 52, cornerRadius: 12) }
            }
        } else if matches.isEmpty {
            Text(emptyText).font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
        } else {
            let shown = (showAll && onSeeAll == nil) ? matches : Array(matches.prefix(limit))
            LazyVStack(spacing: 8) {
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

/// Today's Games on the Stats Today page (founder, 2026-09-29): dailies and VS
/// games keep one row each; a game mode's solo Unlimited games fold into ONE
/// summary row ("Starsweep Unlimited · 34 played · 31 wins · best 1:12") at the
/// position of its newest game — tap to open the games beneath, tap again to
/// close. A one-game group is a plain row. Free players see no Unlimited rows
/// at all (dailies and VS only). Entries are built once per fetch by the caller.
struct TodayGamesList: View {
    enum Entry: Identifiable {
        case single(PublicProfileService.RecentMatch)
        case group(mode: String, games: [PublicProfileService.RecentMatch])
        var id: String {
            switch self { case .single(let m): return m.id; case .group(let mode, _): return "unlimited-\(mode)" }
        }
    }

    let entries: [Entry]
    let profileId: String
    let opponentNames: [String: String]
    var loading = false
    var emptyText = "No games played yet."
    @State private var open: Set<String> = []

    /// Newest-first matches → rows. Groupable = solo with daily == false; everything else is its own row.
    static func entries(_ matches: [PublicProfileService.RecentMatch], profileId: String, isPro: Bool) -> [Entry] {
        var order: [String] = []                       // row keys in first-seen (newest) order
        var singles: [String: PublicProfileService.RecentMatch] = [:]
        var groups: [String: [PublicProfileService.RecentMatch]] = [:]
        for m in matches {
            if m.isUnlimitedSolo {
                guard isPro else { continue }
                let key = "g:" + m.game_mode
                if groups[key] == nil { order.append(key); groups[key] = [] }
                groups[key]!.append(m)
            } else {
                let key = "m:" + m.id
                if singles[key] == nil { order.append(key); singles[key] = m }
            }
        }
        return order.compactMap { key in
            if let m = singles[key] { return .single(m) }
            guard let g = groups[key], let first = g.first else { return nil }
            return g.count == 1 ? .single(first) : .group(mode: first.game_mode, games: g)
        }
    }

    var body: some View {
        if loading {
            VStack(spacing: 8) { ForEach(0..<5, id: \.self) { _ in SkeletonBlock(height: 52, cornerRadius: 12) } }
        } else if entries.isEmpty {
            Text(emptyText).font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
        } else {
            LazyVStack(spacing: 8) {
                ForEach(entries) { e in
                    switch e {
                    case .single(let m): row(m)
                    case .group(let mode, let games):
                        let isOpen = open.contains(mode)
                        Button {
                            Haptics.tap()
                            withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { if isOpen { open.remove(mode) } else { open.insert(mode) } }
                        } label: { groupRow(mode, games, isOpen: isOpen) }
                        .buttonStyle(.plain)
                        if isOpen { ForEach(games) { row($0).padding(.leading, 14) } }
                    }
                }
            }
        }
    }

    private func row(_ m: PublicProfileService.RecentMatch) -> some View {
        RecentMatchRow(match: m, profileId: profileId, opponentName: m.opponentId(profileId).map { opponentNames[$0] ?? "Unknown" })
    }

    private func groupRow(_ mode: String, _ games: [PublicProfileService.RecentMatch], isOpen: Bool) -> some View {
        let meta = homeModes.first { $0.dbKey == mode } ?? moreModes.first { $0.dbKey == mode }
        let title = ModeGen.byDbKey(mode)?.title ?? meta?.title ?? mode
        let wins = games.filter { $0.isWinner(profileId) }
        let best = wins.map { $0.playerTime(profileId) }.filter { $0 > 0 }.min()
        let line = ["\(games.count) played", "\(wins.count) win\(wins.count == 1 ? "" : "s")", best.map { "best \($0 / 60):\(String(format: "%02d", $0 % 60))" }]
            .compactMap { $0 }.joined(separator: " · ")
        return HStack(spacing: 12) {
            if let meta { ModeIconView(icon: meta.icon, accent: meta.accent, box: 36) }
            VStack(alignment: .leading, spacing: 3) {
                Text("\(title) Unlimited").font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1).minimumScaleFactor(0.7)
                Text(line).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer()
            Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted)
                .rotationEffect(.degrees(isOpen ? 180 : 0))
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title) Unlimited, \(line)")
        .accessibilityHint(isOpen ? "Hides the games" : "Shows the games")
    }
}
