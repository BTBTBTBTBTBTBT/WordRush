import SwiftUI
import WordociousCore

/// TODAY'S RACE (Friends D3.1, §289) — the friend leaderboard for TODAY: you
/// and every friend ranked by today's daily points (the digest's todayPoints:
/// composite score summed over every daily played today, sweep and More Games
/// alike). Ties share a rank (competition ranking), then sort alphabetically.
/// Pure twin of apps/web/lib/todays-race.ts so the three platforms agree.
enum TodaysRace {
    struct Entrant {
        let id: String
        let username: String
        let points: Int
        /// Sweep dailies played today (the "N/8" line).
        let played: Int
        let me: Bool
    }

    struct Row: Identifiable {
        let id: String
        let username: String
        let points: Int
        let played: Int
        let me: Bool
        let rank: Int
    }

    static func rankToday(_ entrants: [Entrant]) -> [Row] {
        let sorted = entrants.sorted { a, b in
            if a.points != b.points { return a.points > b.points }
            return a.username.localizedCompare(b.username) == .orderedAscending
        }
        var out: [Row] = []
        for (i, e) in sorted.enumerated() {
            let rank = (out.last.map { $0.points == e.points } ?? false) ? out.last!.rank : i + 1
            out.append(Row(id: e.id, username: e.username, points: e.points, played: e.played, me: e.me, rank: rank))
        }
        return out
    }

    /// "Leading by 340" / "120 behind Doug" / "Tied with Doug" / "Play a daily to join the race".
    static func raceStatusLine(_ rows: [Row]) -> String {
        guard let me = rows.first(where: { $0.me }) else { return "" }
        if me.points == 0 { return "Play a daily to join the race" }
        let others = rows.filter { !$0.me }
        guard let next = others.first else { return "\(me.points.formatted()) pts today" }
        if me.rank == 1 {
            return next.points == me.points ? "Tied with \(next.username)" : "Leading by \((me.points - next.points).formatted())"
        }
        let ahead = others.filter { $0.points > me.points }.min { $0.points < $1.points }!
        return "\((ahead.points - me.points).formatted()) behind \(ahead.username)"
    }
}

/// The TODAY'S RACE section at the top of the FRIENDS card (§289; twin of
/// components/friends/todays-race.tsx). Every row has a reason to tap:
/// Challenge (a private Classic VS Battle, pushed to the friend, free for
/// friends) and the bell for a friend who hasn't played yet. Tapping a
/// friend's row opens their profile — the same NavigationLink(value:) push
/// the roster rows use; your own row goes nowhere.
struct TodaysRaceCard: View {
    let friends: [FriendsService.FriendProfile]
    let me: Profile
    let meDigest: FriendsService.MeDigest?
    /// The friend id whose challenge is in flight (dims the other buttons).
    let challenging: String?
    let onTaunt: (FriendsService.FriendProfile) -> Void
    let onChallenge: (FriendsService.FriendProfile) -> Void

    private static let purple = Color(hex: 0x7C3AED)
    private static let pink = Color(hex: 0xEC4899)

    var body: some View {
        let rows = TodaysRace.rankToday(
            friends.map { .init(id: $0.id, username: $0.username, points: $0.todayPoints ?? 0, played: $0.playedToday ?? 0, me: false) }
            + [.init(id: me.id, username: me.username, points: meDigest?.todayPoints ?? 0, played: meDigest?.playedToday ?? 0, me: true)])
        let byId = Dictionary(uniqueKeysWithValues: friends.map { ($0.id, $0) })
        let anyPoints = rows.contains { $0.points > 0 }

        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Image(systemName: "flag.fill").font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Self.purple)
                Text("TODAY'S RACE").font(Brand.font(9, .black)).tracking(0.8)
                    .foregroundStyle(Theme.textMuted)
                Spacer(minLength: 6)
                Text(TodaysRace.raceStatusLine(rows))
                    .font(Brand.font(10, .black))
                    .foregroundStyle(anyPoints ? Self.purple : Theme.textMuted)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            VStack(spacing: 6) {
                ForEach(rows) { r in
                    if r.me {
                        row(r, friend: nil, anyPoints: anyPoints)
                    } else if let f = byId[r.id] {
                        NavigationLink(value: r.id) {
                            row(r, friend: f, anyPoints: anyPoints)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            Text("Today's points across every daily · Challenge = a private Classic battle, free for friends")
                .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func row(_ r: TodaysRace.Row, friend f: FriendsService.FriendProfile?, anyPoints: Bool) -> some View {
        let medal: String? = anyPoints && r.points > 0 && r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : nil
        HStack(spacing: 10) {
            Text(medal ?? "\(r.rank)")
                .font(medal == nil ? Brand.font(11, .black) : .system(size: 14))
                .foregroundStyle(Theme.textMuted)
                .frame(width: 24)
            if let f {
                AvatarView(url: f.avatar_url, username: f.username, size: 30, emoji: f.avatar_emoji)
            } else {
                AvatarView(url: me.avatarUrl, username: me.username, size: 30, emoji: me.avatarEmoji)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(r.me ? "You" : r.username).font(Brand.font(12, .heavy))
                    .foregroundStyle(r.me ? Self.purple : Theme.textPrimary).lineLimit(1)
                Text(r.points > 0
                     ? "\(r.points.formatted()) pts · \(r.played)/\(DailyCompletionsStore.totalDailyModes) dailies"
                     : "hasn't played today")
                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
            }
            Spacer(minLength: 4)
            if let f {
                if r.points == 0 {
                    // Slacker bell — the existing canned-taunt picker.
                    Button { onTaunt(f) } label: {
                        Image(systemName: "bell.fill").font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Self.purple)
                            .frame(width: 26, height: 26)
                            .background(Circle().fill(Theme.surfaceAlt))
                            .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Nudge \(f.username)")
                }
                Button { onChallenge(f) } label: {
                    HStack(spacing: 4) {
                        Image("swords").renderingMode(.template).resizable().scaledToFit()
                            .frame(width: 11, height: 11)
                        Text(challenging == f.id ? "Sending…" : "Challenge").font(Brand.font(10, .black))
                    }
                    .foregroundStyle(Self.pink)
                    .padding(.horizontal, 8).padding(.vertical, 5)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Self.pink.opacity(0.08)))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Self.pink, lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .disabled(challenging != nil)
                .opacity(challenging != nil && challenging != f.id ? 0.5 : 1)
                .accessibilityLabel("Challenge \(f.username) to a VS Battle")
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 12).fill(r.me ? Self.purple.opacity(0.06) : Color.clear))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(r.me ? Color(hex: 0xC4B5FD) : Color.clear, lineWidth: 1))
    }
}
