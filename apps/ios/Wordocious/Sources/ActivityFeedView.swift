import SwiftUI
import WordociousCore

/// ACTIVITY (Friends D3.2, §290) — the Friends tab's feed: the last seven
/// days of your circle's moments — Daily Sweeps, Flawless Victories, podium /
/// perfect / streak medals, all-time records set, More Games Sweeps — newest
/// first, each friend's row a door to the profile. Read-only over
/// GET /api/friends/feed (FriendsService.fetchFeed). Native twin of
/// components/friends/activity-feed.tsx, wearing the FRIENDS card shell.
struct ActivityFeedView: View {
    @State private var events: [FriendsService.FeedEvent]?
    @State private var expanded = false
    @State private var pulse = false

    private static let purple = Color(hex: 0x7C3AED)
    private static let shown = 8

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "waveform.path.ecg").font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Self.purple)
                Text("ACTIVITY")
                    .font(Brand.font(16, .black)).tracking(0.3)
                    .foregroundStyle(LinearGradient(colors: [Self.purple, Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                Spacer()
                Text("last 7 days").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }

            if let events {
                if events.isEmpty {
                    Text("Quiet week so far — a sweep, a medal or a record from anyone in your circle shows up here.")
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                } else {
                    let today = FriendsService.localDay()
                    VStack(spacing: 6) {
                        ForEach(expanded ? events : Array(events.prefix(Self.shown))) { e in
                            if e.me {
                                row(e, today: today)
                            } else {
                                NavigationLink(value: e.userId) { row(e, today: today) }
                                    .buttonStyle(.plain)
                            }
                        }
                        if events.count > Self.shown {
                            Button {
                                withAnimation(.easeInOut(duration: 0.15)) { expanded.toggle() }
                            } label: {
                                Text(expanded ? "Show less" : "Show all \(events.count)")
                                    .font(Brand.font(11, .heavy)).foregroundStyle(Self.purple)
                                    .frame(maxWidth: .infinity).padding(.vertical, 4)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            } else {
                // Skeleton while the feed loads.
                VStack(spacing: 8) {
                    ForEach(0..<3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 12).fill(Theme.border).frame(height: 32)
                    }
                }
                .opacity(pulse ? 0.45 : 1)
                .onAppear {
                    withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulse = true }
                }
            }
        }
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
        .task(id: AuthService.shared.profile?.id) {
            guard AuthService.shared.profile != nil else { return }
            events = await FriendsService.fetchFeed()
        }
    }

    private func row(_ e: FriendsService.FeedEvent, today: String) -> some View {
        let d = Self.describe(e)
        return HStack(spacing: 10) {
            AvatarView(url: e.avatar_url, username: e.username, size: 28, emoji: e.avatar_emoji)
            Image(systemName: d.symbol).font(.system(size: 13, weight: .bold))
                .foregroundStyle(d.color)
                .frame(width: 18)
            Text(d.text).font(Brand.font(11, .heavy)).foregroundStyle(Theme.textPrimary)
                .lineLimit(2).multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(Self.dayLabel(e.day, today: today)).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                .fixedSize()
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 12).fill(e.me ? Self.purple.opacity(0.06) : Theme.background))
    }

    // MARK: copy — mirrors activity-feed.tsx describe() / dayLabel()

    struct Description { let text: String; let symbol: String; let color: Color }

    /// "Doug took gold in Classic" / "You swept the dailies" / "Amy set the
    /// all-time Six Fastest Win · 42s" / "Doug hit a 7-day streak".
    static func describe(_ e: FriendsService.FeedEvent) -> Description {
        let who = e.me ? "You" : e.username
        let game = e.gameTitle ?? e.gameMode ?? ""
        switch e.type {
        case "flawless":
            return .init(text: "\(who) won every daily — Flawless Victory", symbol: "trophy.fill", color: Color(hex: 0xB45309))
        case "sweep":
            return .init(text: "\(who) swept the dailies", symbol: "sparkles", color: purple)
        case "more_flawless":
            return .init(text: "\(who) — Flawless More Games, all ten won", symbol: "square.grid.2x2.fill", color: Color(hex: 0xB45309))
        case "more_sweep":
            return .init(text: "\(who) — More Games Sweep, all ten played", symbol: "square.grid.2x2", color: Color(hex: 0x4F46E5))
        case "record":
            let label = e.kind.map { RecordCatalog.labels[$0]?.label ?? $0 } ?? "record"
            let value = (e.kind != nil && e.value != nil) ? recordValue(e.kind!, Int(e.value!), gameMode: e.gameMode) : ""
            let title = e.gameTitle.map { "\($0) " } ?? ""
            return .init(text: "\(who) set the all-time \(title)\(label)\(value.isEmpty ? "" : " · \(value)")",
                         symbol: "star.fill", color: Color(hex: 0xD97706))
        default:
            let k = e.kind ?? ""
            if k == "gold" { return .init(text: "\(who) took gold in \(game)", symbol: "crown.fill", color: Color(hex: 0xD97706)) }
            if k == "silver" { return .init(text: "\(who) took silver in \(game)", symbol: "medal.fill", color: Color(hex: 0x9CA3AF)) }
            if k == "bronze" { return .init(text: "\(who) took bronze in \(game)", symbol: "medal.fill", color: Color(hex: 0xB45309)) }
            if k == "perfect" { return .init(text: "\(who) played a perfect \(game)", symbol: "star.fill", color: Theme.win) }
            if k.hasPrefix("streak_") {
                return .init(text: "\(who) hit a \(k.dropFirst(7))-day streak", symbol: "flame.fill", color: Color(hex: 0xF97316))
            }
            return .init(text: "\(who) earned a medal in \(game)", symbol: "medal", color: Theme.textMuted)
        }
    }

    /// A record's value per type — the RECORD_LABELS formats, with
    /// "fewest_guesses" read through the mode's guess semantics (records-ui
    /// recordValue; iOS AllTimeRecord.formattedValue).
    static func recordValue(_ type: String, _ v: Int, gameMode: String?) -> String {
        switch type {
        case "fastest_win": return v < 60 ? "\(v)s" : "\(v / 60)m \(v % 60)s"
        case "fewest_guesses": return RecordCatalog.fewestValue(v, gameMode: gameMode)
        case "most_games_played": return "\(v) games"
        case "longest_streak": return "\(v) wins"
        case "most_gold_medals": return "\(v) golds"
        case "highest_level": return "Level \(v)"
        case "most_daily_completions": return "\(v) dailies"
        default: return "\(v)"
        }
    }

    /// "today" / "yesterday" / "Mon" — both days are local YYYY-MM-DD.
    static func dayLabel(_ day: String, today: String) -> String {
        if day == today { return "today" }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        guard let d = f.date(from: day), let t = f.date(from: today) else { return day }
        let diff = Int((t.timeIntervalSince(d) / 86_400).rounded())
        if diff == 1 { return "yesterday" }
        let w = DateFormatter()
        w.locale = Locale(identifier: "en_US"); w.dateFormat = "EEE"
        return w.string(from: d)
    }
}
