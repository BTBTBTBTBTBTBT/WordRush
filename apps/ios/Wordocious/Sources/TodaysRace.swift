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

        // FINISH_SPEC §C4: the race on the pink card family — fixed light inks (the
        // Friends pages stay light in dark mode), medal-colored places, soft numbers,
        // candy actions.
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                FriendsLabel("Today's race", color: FriendsInk.bannerLabel)
                Spacer(minLength: 6)
                Text(TodaysRace.raceStatusLine(rows))
                    .font(Brand.font(11, .black))
                    .foregroundStyle(anyPoints ? Self.purple : FriendsInk.muted)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                    Group {
                        if r.me {
                            row(r, friend: nil, anyPoints: anyPoints)
                        } else if let f = byId[r.id] {
                            NavigationLink(value: r.id) {
                                row(r, friend: f, anyPoints: anyPoints)
                            }
                            .buttonStyle(.squish)
                        }
                    }
                    .friendsStripe(i, accent: Self.pink)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            Text("Today's points across every daily · Challenge = a private Classic battle, free for friends")
                .font(Brand.font(9.5, .bold)).foregroundStyle(FriendsInk.muted)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func row(_ r: TodaysRace.Row, friend f: FriendsService.FriendProfile?, anyPoints: Bool) -> some View {
        let medal = anyPoints && r.points > 0 && r.rank <= 3
        let disc = medal ? FriendsInk.medal(r.rank) : Self.purple.wash(0.55)
        HStack(spacing: 10) {
            Text("\(r.rank)")
                .font(Brand.font(12, .black)).foregroundStyle(.white)
                .frame(width: 24, height: 24)
                .background(Circle().fill(LinearGradient(colors: [disc.mixed(over: .white, 0.75), disc],
                                                         startPoint: .top, endPoint: .bottom)))
                .accessibilityLabel("Place \(r.rank)")
            if let f {
                AvatarView(url: f.avatar_url, username: f.username, size: 32, emoji: f.avatar_emoji)
            } else {
                AvatarView(url: me.avatarUrl, username: me.username, size: 32, accentHex: me.accentColor, emoji: me.avatarEmoji, pro: Wordocious.isProActive(me))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(r.me ? "You" : r.username).font(Brand.font(13, .black))
                    .foregroundStyle(r.me ? Self.purple : FriendsInk.heading).lineLimit(1)
                if r.points > 0 {
                    HStack(spacing: 3) {
                        Text(r.points.formatted()).softNumber(12, color: FinishInk.softNumber)
                        Text("pts · \(r.played)/\(DailyCompletionsStore.totalDailyModes) dailies")
                            .font(Brand.font(10, .bold)).foregroundStyle(FriendsInk.rowSub)
                    }
                    .lineLimit(1)
                } else {
                    Text("hasn't played today")
                        .font(Brand.font(10, .bold)).foregroundStyle(FriendsInk.rowSub).lineLimit(1)
                }
            }
            Spacer(minLength: 4)
            if let f {
                if r.points == 0 {
                    // Slacker bell — the existing canned-taunt picker (§A8: round amber candy).
                    Button { onTaunt(f) } label: {
                        OutlinedSymbol(name: "bell.fill", size: 13, width: 1.25)
                    }
                    .buttonStyle(CandyButtonStyle(variant: .amber, size: .small, fullWidth: false, circle: true))
                    .accessibilityLabel("Nudge \(f.username)")
                }
                Button { onChallenge(f) } label: {
                    CandyLabel(title: challenging == f.id ? "Sending…" : "Challenge")
                }
                .buttonStyle(CandyButtonStyle(variant: .purple, size: .small, fullWidth: false))
                .disabled(challenging != nil)
                .accessibilityLabel("Challenge \(f.username) to a VS Battle")
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .background(r.me ? Self.purple.wash(0.10) : Color.clear)
        .contentShape(Rectangle())
    }
}
