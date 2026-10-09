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
    /// Wave 3 (9e): false folds "On now" into the friend cards (the green dot + "playing Classic"),
    /// and the banner tells the race once: the pills, with the countdown small in the header.
    var showOnNow = true
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
        let online = friends.filter { $0.isOnline(now: now) }
            .sorted { (FriendsService.ms($0.lastSeenAt) ?? 0) > (FriendsService.ms($1.lastSeenAt) ?? 0) }
        let rows = self.rows
        let input = Self.input(friendCount: friends.count, online: online.map(\.username), rows: rows)
        // FINISH_SPEC §C4 (mockup `.banner`): the race banner is a pink tinted card
        // with a pink → gold top bar and O1 cheering at the top right.
        // BJ7: the banner hugs its rows (8 between, 10 / 12 padding, a smaller host).
        return VStack(alignment: .leading, spacing: 8) {
            if showOnNow {
                strip(input)
                onNowRow(online, now: now)
                raceRow(rows)
            } else {
                // The race, told once: the header (title, countdown small, O1 beside it) over the pills.
                raceHeader
                raceRow(rows, titled: false)
            }
        }
        .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            // Shimmers while anyone is on (behind the content, inside the card).
            if showOnNow && !online.isEmpty && !Theme.reduceMotion { BannerSweep().allowsHitTesting(false) }
        }
        .overlay(alignment: .topTrailing) {
            // The cast (docs/MASCOT_SPEC.md §1): O1, the four-armed cheerleader, hosts Friends.
            if showOnNow {
                PoseImage(Mascots.friends, "cheer", height: 68)
                    .padding(.trailing, 8).padding(.top, 2)
            }
        }
        .friendsCard(accent: FriendsInk.pink, bar: [FriendsInk.pink, FriendsInk.amber])
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

    // MARK: Headline + clock

    private func strip(_ input: FriendsBannerInput) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let s = secondsUntilLocalMidnight()
            let clock = String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
            VStack(alignment: .leading, spacing: 4) {
                // FINISH_SPEC §AR: the race headline in live lettering (pink → orange,
                // the leader's name in the accent, gold numbers).
                BubbleTextView(text: FriendlyGames.friendsBannerHeadline(input), palette: .friends,
                               names: [input.leaderName], maxSize: 20, minSize: 15, alignment: .leading)
                    .frame(maxWidth: .infinity, minHeight: 28, alignment: .leading)
                    .padding(.trailing, 72)
                Text(FriendlyGames.friendsBannerClockLine(input, clock: clock))
                    .font(Brand.font(11, .black)).tracking(0.6).monospacedDigit()
                    .foregroundStyle(FriendsInk.bannerLabel)
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .padding(.trailing, 64)
            }
        }
    }

    /// Wave 3 header: TODAY'S RACE with the countdown small beneath it, O1 cheering at the right.
    private var raceHeader: some View {
        HStack(alignment: .center, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                FriendsLabel("Today's race", color: FriendsInk.bannerLabel)
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    let s = secondsUntilLocalMidnight()
                    let clock = String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
                    Text("Ends in \(clock)")
                        .font(Brand.font(10, .black)).tracking(0.5).monospacedDigit()
                        .foregroundStyle(FriendsInk.bannerLabel)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            Spacer(minLength: 4)
            PoseImage(Mascots.friends, "cheer", height: 44)
        }
    }

    // MARK: ON NOW

    private func onNowRow(_ online: [FriendsService.FriendProfile], now: Date) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                FriendsLabel("On now", color: FriendsInk.bannerLabel)
                if !online.isEmpty {
                    Text("\(online.count)").font(Brand.font(11, .black)).monospacedDigit()
                        .foregroundStyle(FriendsInk.bannerLabel)
                }
                Spacer(minLength: 0)
            }
            if online.isEmpty {
                Text(nobodyLine(now: now))
                    .font(Brand.font(12, .heavy)).foregroundStyle(FriendsInk.faces)
                    .lineLimit(1).minimumScaleFactor(0.8)
            } else {
                // §C4: online friends as letter tiles with a green dot; tap a face to play.
                HStack(spacing: 8) {
                    ForEach(online.prefix(5)) { f in
                        Button { onFace(f) } label: {
                            FriendsPresenceAvatar(url: f.avatar_url, username: f.username, emoji: f.avatar_emoji,
                                                  size: 34, online: true, ring: false)
                                .padding(.trailing, 3).padding(.bottom, 1)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.squish)
                        .accessibilityLabel("Play with \(f.username), \(FriendsKit.doing(f))")
                    }
                    Text(facesLine(online))
                        .font(Brand.font(12, .heavy)).foregroundStyle(FriendsInk.faces)
                        .lineLimit(2).minimumScaleFactor(0.8)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityHidden(true)
                    Spacer(minLength: 0)
                }
            }
        }
    }

    /// "Doug is playing Gauntlet" (the first friend in a game) / "Doug is on now" /
    /// "3 friends are on now".
    private func facesLine(_ online: [FriendsService.FriendProfile]) -> String {
        if let p = online.first(where: { !($0.activity ?? "").isEmpty }), let a = p.activity {
            return "\(p.username) is playing \(a)"
        }
        if online.count == 1, let f = online.first { return "\(f.username) is on now" }
        return "\(online.count) friends are on now"
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

    private func raceRow(_ rows: [TodaysRace.Row], titled: Bool = true) -> some View {
        let best = friends.max { ($0.friendStreak ?? 0) < ($1.friendStreak ?? 0) }
        var chips = Array(rows.prefix(3))
        // Always see yourself: swap you in for third when you're further down.
        if !chips.contains(where: { $0.me }), let mine = rows.first(where: { $0.me }), chips.count == 3 {
            chips[2] = mine
        }
        return Button(action: onRace) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    if titled { FriendsLabel("Today's race", color: FriendsInk.bannerLabel) }
                    Spacer(minLength: 4)
                    if let b = best, let n = b.friendStreak, n > 0 {
                        HStack(spacing: 3) {
                            FlameMark(size: 11)
                            Text("\(b.username.uppercased()) \(n) DAY\(n == 1 ? "" : "S")")
                                .font(Brand.font(10, .black)).tracking(0.4).foregroundStyle(FriendsInk.dark ? Color(hex: 0xFDBA74) : Color(hex: 0xC2410C))
                                .lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .accessibilityLabel("\(n)-day friend streak with \(b.username)")
                    }
                }
                HStack(spacing: 6) {
                    ForEach(chips) { r in raceChip(r) }
                    Spacer(minLength: 0)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .accessibilityHint("Opens today's race")
    }

    /// One race chip (mockup `.rchip`): the place in a medal-colored disc (gold /
    /// silver / bronze for the scoring top three, purple otherwise), the name and
    /// the points as a soft number.
    private func raceChip(_ r: TodaysRace.Row) -> some View {
        let disc = r.points > 0 && r.rank <= 3 ? FriendsInk.medal(r.rank) : FriendsInk.purple
        return HStack(spacing: 6) {
            Text("\(r.rank)").font(Brand.font(11, .black)).foregroundStyle(.white)
                .frame(width: 20, height: 20)
                .background(Circle().fill(LinearGradient(colors: [disc.mixed(over: .white, 0.75), disc],
                                                         startPoint: .top, endPoint: .bottom)))
            Text(r.me ? "YOU" : r.username.uppercased()).font(Brand.font(12, .black))
                .foregroundStyle(FriendsInk.chip).lineLimit(1).minimumScaleFactor(0.7)
            Text(r.points.formatted()).softNumber(12, color: VsLobbyKit.numberInk)
                .lineLimit(1).fixedSize()
        }
        .padding(.leading, 4).padding(.trailing, 10).frame(minHeight: 28)
        .background(Capsule().fill(FriendsInk.dark ? (SeasonKit.surfaces?.raised ?? Color(hex: 0x2C1846)) : Color.white.opacity(0.72)))
        .overlay(Capsule().stroke(r.me ? FriendsKit.solid : FriendsInk.pink.vsWash(0.3), lineWidth: r.me ? 2 : 1))
        .frame(maxWidth: 130)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(r.me ? "You" : r.username), place \(r.rank), \(r.points) points")
    }
}
