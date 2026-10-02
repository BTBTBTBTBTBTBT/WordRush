import SwiftUI
import WordociousCore

/// The Friends banner (Friends overhaul, founder 2026-10-01; spec
/// docs/FRIENDS_REDESIGN_SPEC.md §2.2) — the home banner's one-window shape in
/// Friends pink: a frosted headline strip over ON NOW (who's here, tap a face
/// to play) and TODAY'S RACE (the top three chips, tap for the full race). The
/// words come from FriendlyGames (WordociousCore), pinned to the web by
/// friendly-games-fixtures.json. Shimmers while anyone is on.
struct FriendsBannerView: View {
    let friends: [FriendsService.FriendProfile]
    let me: Profile
    let meDigest: FriendsService.MeDigest?
    /// Tap a face → the quick-play sheet with that friend.
    let onFace: (FriendsService.FriendProfile) -> Void
    /// Tap the race row → the full Today's Race sheet.
    let onRace: () -> Void

    private var rows: [TodaysRace.Row] {
        TodaysRace.rankToday(
            friends.map { .init(id: $0.id, username: $0.username, points: $0.todayPoints ?? 0, played: $0.playedToday ?? 0, me: false) }
            + [.init(id: me.id, username: me.username, points: meDigest?.todayPoints ?? 0, played: meDigest?.playedToday ?? 0, me: true)])
    }

    var body: some View {
        // Re-reads presence every 15 s so faces come and go while the tab is open.
        TimelineView(.periodic(from: .now, by: 15)) { ctx in
            content(now: ctx.date)
        }
    }

    private func content(now: Date) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        let online = friends.filter { $0.isOnline(now: now) }
            .sorted { (FriendsService.ms($0.lastSeenAt) ?? 0) > (FriendsService.ms($1.lastSeenAt) ?? 0) }
        let rows = self.rows
        let input = Self.input(friendCount: friends.count, online: online.map(\.username), rows: rows)
        return VStack(spacing: 0) {
            strip(input)
            onNowRow(online, now: now).padding(.top, 10).padding(.horizontal, 12)
            raceRow(rows).padding(.top, 12).padding(.horizontal, 12).padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xFCE7F3), Color(hex: 0xEDE9FE)], startPoint: .top, endPoint: .bottom)
                // The same white sheen as home.
                LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                if !online.isEmpty && !Theme.reduceMotion { BannerSweep().allowsHitTesting(false) }
            }
        }
        .clipShape(shape)
        .shadow(color: FriendsKit.ink.opacity(0.08), radius: 7, x: 0, y: 4)
    }

    /// The banner's core input from today's race (competition ranks, the same
    /// numbers Today's Race shows).
    static func input(friendCount: Int, online: [String], rows: [TodaysRace.Row]) -> FriendsBannerInput {
        let myIndex = rows.firstIndex { $0.me } ?? 0
        let mine = rows.indices.contains(myIndex) ? rows[myIndex] : nil
        let leader = rows.first
        let next = rows.indices.contains(myIndex + 1) ? rows[myIndex + 1].points : 0
        return FriendsBannerInput(
            friendCount: friendCount, online: online,
            myRank: mine?.rank ?? 1, myPoints: mine?.points ?? 0,
            leaderName: leader.map { $0.me ? "You" : $0.username } ?? "",
            leaderPoints: leader?.points ?? 0, nextPoints: next)
    }

    // MARK: Frosted strip

    private func strip(_ input: FriendsBannerInput) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let s = secondsUntilLocalMidnight()
            let clock = String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
            VStack(alignment: .leading, spacing: 4) {
                Text(FriendlyGames.friendsBannerHeadline(input))
                    .font(Brand.font(16, .black)).tracking(0.4).lineSpacing(3)
                    .foregroundStyle(FriendsKit.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, minHeight: 24, alignment: .leading)
                Text(FriendlyGames.friendsBannerClockLine(input, clock: clock))
                    .font(Brand.font(10.5, .heavy)).tracking(0.4).monospacedDigit()
                    .foregroundStyle(FriendsKit.mid)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .padding(.top, 12).padding(.horizontal, 12).padding(.bottom, 10)
        .background(Color.white.opacity(0.5))
    }

    // MARK: ON NOW

    private func onNowRow(_ online: [FriendsService.FriendProfile], now: Date) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text("ON NOW").font(Brand.font(10, .black)).tracking(1).foregroundStyle(FriendsKit.mid)
                if !online.isEmpty {
                    Text("\(online.count)").font(Brand.font(10, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 6).frame(height: 16)
                        .background(Capsule().fill(FriendsKit.green))
                }
                Spacer(minLength: 0)
            }
            if online.isEmpty {
                Text(nobodyLine(now: now))
                    .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.mid.opacity(0.8))
                    .lineLimit(1).minimumScaleFactor(0.8)
            } else {
                HStack(alignment: .top, spacing: 10) {
                    ForEach(online.prefix(5)) { f in
                        Button { onFace(f) } label: {
                            VStack(spacing: 3) {
                                FriendsPresenceAvatar(url: f.avatar_url, username: f.username, emoji: f.avatar_emoji, size: 40, online: true)
                                Text(f.username).font(Brand.font(10, .black)).foregroundStyle(FriendsKit.ink)
                                    .lineLimit(1).minimumScaleFactor(0.7)
                                Text(FriendsKit.doing(f)).font(Brand.font(9, .heavy)).foregroundStyle(FriendsKit.green)
                                    .lineLimit(1).minimumScaleFactor(0.7)
                            }
                            .frame(width: 58)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(PressableStyle())
                        .accessibilityLabel("Play with \(f.username), \(FriendsKit.doing(f))")
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }

    /// "Nobody's on right now · Doug was here 12 min ago" (the most recent presence).
    private func nobodyLine(now: Date) -> String {
        let latest = friends.compactMap { f -> (String, Int)? in
            guard let ms = FriendsService.ms(f.lastSeenAt) else { return nil }
            return (f.username, ms)
        }.max { $0.1 < $1.1 }
        if let (name, ms) = latest {
            let m = Int((Double(FriendsService.ms(now) - ms) / 60000).rounded(.down))
            if m >= 0 && m < 60 { return "Nobody's on right now · \(name) was here \(m) min ago" }
            if m >= 60 && m < 24 * 60 { return "Nobody's on right now · \(name) was here \(m / 60) h ago" }
        }
        return "Nobody's on right now"
    }

    // MARK: TODAY'S RACE

    private func raceRow(_ rows: [TodaysRace.Row]) -> some View {
        let best = friends.max { ($0.friendStreak ?? 0) < ($1.friendStreak ?? 0) }
        var chips = Array(rows.prefix(3))
        // Always see yourself: swap you in for third when you're further down.
        if !chips.contains(where: { $0.me }), let mine = rows.first(where: { $0.me }), chips.count == 3 {
            chips[2] = mine
        }
        return Button(action: onRace) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Text("TODAY'S RACE").font(Brand.font(10, .black)).tracking(1).foregroundStyle(FriendsKit.mid)
                    Spacer(minLength: 4)
                    if let b = best, let n = b.friendStreak, n > 0 {
                        HStack(spacing: 3) {
                            FlameMark(size: 11)
                            Text("\(b.username.uppercased()) \(n) DAY\(n == 1 ? "" : "S")")
                                .font(Brand.font(10, .black)).tracking(0.4).foregroundStyle(Color(hex: 0xC2410C))
                                .lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .accessibilityLabel("\(n)-day friend streak with \(b.username)")
                    }
                    Image(systemName: "chevron.right").font(.system(size: 10, weight: .black)).foregroundStyle(FriendsKit.mid)
                }
                HStack(spacing: 6) {
                    ForEach(chips) { r in raceChip(r) }
                    Spacer(minLength: 0)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens today's race")
    }

    private func raceChip(_ r: TodaysRace.Row) -> some View {
        let medal: Color = r.rank == 1 ? Color(hex: 0xF59E0B) : r.rank == 2 ? Color(hex: 0x9CA3AF) : Color(hex: 0xB45309)
        return HStack(spacing: 5) {
            Text("\(r.rank)").font(Brand.font(10, .black)).foregroundStyle(.white)
                .frame(width: 18, height: 18)
                .background(Circle().fill(r.points > 0 && r.rank <= 3 ? medal : Color(hex: 0xC4B5FD)))
            Text(r.me ? "YOU" : r.username.uppercased()).font(Brand.font(10, .black)).tracking(0.3)
                .foregroundStyle(FriendsKit.ink).lineLimit(1).minimumScaleFactor(0.7)
            Text(r.points.formatted()).font(Brand.font(10, .heavy)).monospacedDigit()
                .foregroundStyle(FriendsKit.mid).lineLimit(1).fixedSize()
        }
        .padding(.leading, 4).padding(.trailing, 8).frame(height: 28)
        .background(Capsule().fill(Color.white.opacity(0.85)))
        .overlay(Capsule().stroke(r.me ? FriendsKit.solid : .clear, lineWidth: 2))
        .frame(maxWidth: 118)
    }
}
