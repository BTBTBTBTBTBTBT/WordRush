import SwiftUI
import WordociousCore

/// ACTIVITY (Friends D3.2, §290) — the Friends tab's feed: the last seven
/// days of your circle's moments — Daily Sweeps, Flawless Victories, podium /
/// perfect / streak medals, all-time records set, More Games Sweeps — newest
/// first, each friend's row a door to the profile. Read-only over
/// GET /api/friends/feed (FriendsService.fetchFeed). Native twin of
/// components/friends/activity-feed.tsx. Friends overhaul (2026-10-01, spec
/// §6): titled MOMENTS on a white card, finished pocket games join the feed,
/// and every moment takes the fixed reactions (👏 🔥 😱 😤, Rematch on games).
struct ActivityFeedView: View {
    /// Friends overhaul §6: a Rematch reaction on a game moment opens the
    /// quick-play sheet with that game and friend.
    var onRematch: ((FriendlyKind, String) -> Void)? = nil

    /// The session's last feed in the FIRST frame (founder, 2026-09-29: every open of the Friends
    /// screen — the Leaderboard sheet, a profile push, the first tab visit — flashed the 3-row
    /// skeleton, then the feed snapped in at a different height). Refreshed underneath as before.
    @State private var events: [FriendsService.FeedEvent]? = StatsMemo.shared.get(Self.memoKey)
    private static var memoKey: String { "friendsFeed:\(StatsMemo.uid)" }
    @State private var reactions: [String: FriendsService.MomentReactions] = [:]
    /// The moment whose + picker is open.
    @State private var picking: String?
    @State private var expanded = false
    @State private var pulse = false

    private static let purple = Color(hex: 0x7C3AED)
    private static let shown = 8

    /// The fixed reaction set (server keys → what the chip shows).
    static let reactionKeys: [(key: String, label: String)] = [("clap", "👏"), ("fire", "🔥"), ("wow", "😱"), ("grr", "😤"), ("rematch", "Rematch")]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: "MOMENTS") {
                Text("LAST 7 DAYS").font(Brand.font(9.5, .black)).tracking(0.8).foregroundStyle(FriendsKit.label)
            }
            VStack(alignment: .leading, spacing: 8) {
                if let events {
                    if events.isEmpty {
                        Text("Quiet week so far — a sweep, a medal, a record or a game won from anyone in your circle shows up here.")
                            .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
                    } else {
                        let today = FriendsService.localDay()
                        ForEach(expanded ? events : Array(events.prefix(Self.shown))) { e in
                            VStack(alignment: .leading, spacing: 5) {
                                if e.me {
                                    row(e, today: today)
                                } else {
                                    NavigationLink(value: e.userId) { row(e, today: today) }
                                        .buttonStyle(.plain)
                                }
                                reactionRow(e)
                            }
                        }
                        if events.count > Self.shown {
                            Button {
                                withAnimation(.easeInOut(duration: 0.15)) { expanded.toggle() }
                            } label: {
                                Text(expanded ? "Show less" : "Show all \(events.count)")
                                    .font(Brand.font(11, .heavy)).foregroundStyle(FriendsKit.solid)
                                    .frame(maxWidth: .infinity).padding(.vertical, 4)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } else {
                    // Skeleton while the feed loads.
                    VStack(spacing: 8) {
                        ForEach(0..<3, id: \.self) { _ in
                            RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xEDE9FE)).frame(height: 32)
                        }
                    }
                    .opacity(pulse ? 0.45 : 1)
                    .onAppear {
                        withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulse = true }
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .vsCard(radius: 14)
        }
        .task(id: AuthService.shared.profile?.id) {
            guard AuthService.shared.profile != nil else { return }
            if let fresh = await FriendsService.fetchFeedWithReactions() {
                events = fresh.events
                reactions = fresh.reactions
                StatsMemo.shared.set(Self.memoKey, fresh.events)
            } else if events == nil {
                events = []
            }
        }
    }

    private func row(_ e: FriendsService.FeedEvent, today: String) -> some View {
        let d = Self.describe(e)
        return HStack(spacing: 10) {
            AvatarView(url: e.avatar_url, username: e.username, size: 30, emoji: e.avatar_emoji)
            Group {
                if e.type == "game", let k = e.friendlyKind {
                    FriendlyGameIcon(kind: k, size: 20, glow: false)
                } else {
                    Image(systemName: d.symbol).font(.system(size: 13, weight: .bold)).foregroundStyle(d.color)
                }
            }
            .frame(width: 20)
            Text(d.text).font(Brand.font(12, .heavy)).foregroundStyle(Color(hex: 0x111827))
                .lineLimit(2).multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(Self.dayLabel(e.day, today: today)).font(Brand.font(9.5, .bold)).foregroundStyle(FriendsKit.label)
                .fixedSize()
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 12).fill(e.me ? FriendsKit.soft.opacity(0.6) : FriendsKit.page))
    }

    // MARK: Reactions (§6)

    @ViewBuilder private func reactionRow(_ e: FriendsService.FeedEvent) -> some View {
        let r = reactions[e.id] ?? .init(counts: [:], mine: [])
        let isGame = e.type == "game"
        let options = Self.reactionKeys.filter { $0.key != "rematch" || isGame }
        HStack(spacing: 6) {
            ForEach(options.filter { (r.counts[$0.key] ?? 0) > 0 }, id: \.key) { o in
                chip(o.label, count: r.counts[o.key] ?? 0, mine: r.mine.contains(o.key)) { toggle(e, o.key) }
            }
            if picking == e.id {
                ForEach(options.filter { (r.counts[$0.key] ?? 0) == 0 }, id: \.key) { o in
                    chip(o.label, count: 0, mine: false) { picking = nil; toggle(e, o.key) }
                }
            }
            Button { withAnimation(.easeOut(duration: 0.15)) { picking = picking == e.id ? nil : e.id } } label: {
                Image(systemName: picking == e.id ? "xmark" : "plus")
                    .font(.system(size: 10, weight: .black)).foregroundStyle(FriendsKit.solid)
                    .frame(width: 28, height: 24)
                    .background(Capsule().fill(FriendsKit.soft))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(picking == e.id ? "Close reactions" : "React")
            Spacer(minLength: 0)
        }
        .padding(.leading, 48)
    }

    private func chip(_ label: String, count: Int, mine: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 3) {
                Text(label).font(label.count > 2 ? Brand.font(10.5, .black) : .system(size: 12))
                    .foregroundStyle(FriendsKit.solid)
                if count > 0 {
                    Text("\(count)").font(Brand.font(10.5, .black)).foregroundStyle(FriendsKit.ink)
                }
            }
            .padding(.horizontal, 8).frame(height: 24)
            .background(Capsule().fill(FriendsKit.soft))
            .overlay(Capsule().stroke(mine ? FriendsKit.solid : .clear, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(mine ? .isSelected : [])
    }

    /// Optimistic toggle; a Rematch tap on a game moment also opens quick play.
    private func toggle(_ e: FriendsService.FeedEvent, _ key: String) {
        var r = reactions[e.id] ?? .init(counts: [:], mine: [])
        let on = !r.mine.contains(key)
        if on { r.mine.append(key); r.counts[key, default: 0] += 1 }
        else { r.mine.removeAll { $0 == key }; r.counts[key] = max(0, (r.counts[key] ?? 1) - 1) }
        reactions[e.id] = r
        Haptics.tap()
        Task { await FriendsService.react(momentId: e.id, ownerId: e.userId, emoji: key, on: on) }
        if key == "rematch", on, e.type == "game", let kind = e.friendlyKind {
            // The friend in it: the other player when it's your moment, else its
            // owner — the winner (also between two other friends).
            let friendId = e.me ? e.otherId : e.userId
            if let friendId { onRematch?(kind, friendId) }
        }
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
        case "game":
            // Friends overhaul §6: "Doug beat you at Tic-Tac-Tile (2–1)" /
            // "You and Kate drew at Call It".
            let other = e.otherName ?? "a friend"
            let title = e.gameTitle ?? "a game"
            if e.kind == "draw" {
                return .init(text: "\(who) and \(other) drew at \(title)", symbol: "equal.circle.fill", color: Color(hex: 0xDB2777))
            }
            let score = e.score.map { " (\($0))" } ?? ""
            return .init(text: "\(who) beat \(other) at \(title)\(score)", symbol: "gamecontroller.fill", color: Color(hex: 0xDB2777))
        case "gift":
            // D3.4 (§294): a streak shield sent to a friend.
            return .init(text: "\(who) sent \(e.otherName ?? "a friend") a streak shield", symbol: "shield.fill", color: Color(hex: 0x0D9488))
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
