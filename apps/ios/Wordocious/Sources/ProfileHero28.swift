import SwiftUI
import WordociousCore

// FRIDAY-QUEUE item 17 (founder 10-07, Oliver's profile): the player's mascot full-body on a mini Stage (the Edit
// Profile podium + curtains), the name in the bubble lettering, a friendship badge + "Friends since Sep 2026" by the
// name (replacing the old top-right FRIENDS pill), rank + XP as one compact strip, and one clear family-button action
// row (Challenge · Pocket game · React · Add friend, or Requested / Accept–Decline) with Unfriend / Block / Report in
// the ⋯ menu. The state -> buttons rules are core StatsProfile.profileActions (same on web and Android).
// Web: components/profile/profile-hero.tsx.

/// The mini Stage: backdrop + curtains + podium, the player's full-body mascot standing on it (alive while the living
/// mascot is on — DressStage chooses), or their framed photo. `overlay` sits over the stage (the "N/M today" pill).
struct ProfileStageHero<Overlay: View>: View {
    let profile: Profile
    var height: CGFloat = 214
    var mascotSize: CGFloat = 132
    @ViewBuilder var overlay: () -> Overlay

    @ObservedObject private var directory = AvatarDirectory.shared

    var body: some View {
        let r = directory.look(username: profile.username, userId: profile.id, url: profile.avatarUrl, castId: nil, frame: nil,
                               mascot: nil, accentHex: LetterTileAvatar.defaultAccentHex(username: profile.username, accentHex: profile.accentColor),
                               lookup: true).resolved
        let photo: (url: String?, username: String, userId: String?)? = r.photoUrl.map { ($0, profile.username, profile.id) }
        DressStage(config: r.config, initial: AvatarCatalog.initial(profile.username), photo: photo,
                   height: height, mascotSize: mascotSize, curtains: true) { overlay() }
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .onAppear { directory.want(username: profile.username) }
    }
}

/// The friendship badge (art-pf-friendship-badge) beside the name.
struct FriendshipBadgeView: View {
    var size: CGFloat = 30
    var body: some View {
        Image("art-pf-friendship-badge").resizable().interpolation(.high).scaledToFit()
            .frame(width: size, height: size)
            .accessibilityLabel("Friends")
    }
}

/// The identity block under the stage: the name in the bubble lettering (+ friendship badge) and "Friends since".
struct ProfileIdentityBlock: View {
    let profile: Profile
    let isFriend: Bool
    let friendsSince: String?

    var body: some View {
        let palette: HeadlinePalette = ProfileAccent.isCustom(profile.accentColor) ? .accent(ProfileAccent.color(profile.accentColor)) : .home
        VStack(spacing: 4) {
            HStack(spacing: 8) {
                BubbleTextView(text: profile.username.uppercased(), palette: palette, maxSize: 38, minSize: 20)
                    .frame(maxWidth: 320)
                if isFriend { FriendshipBadgeView() }
            }
            if isFriend {
                Text(StatsProfile.friendsSinceLine(friendsSince) ?? "Friends")
                    .font(Brand.font(11, .heavy)).foregroundStyle(FinishInk.secondary)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// Rank + XP as ONE compact strip: the tier level badge, a thin XP bar, "N XP to next".
struct ProfileRankStrip: View {
    let level: Int
    let xp: Int

    var body: some View {
        let progress = Double(xp % 1000) / 10.0
        let toNext = 1000 - (xp % 1000)
        let tier = LevelTier.forLevel(level)
        HStack(spacing: 12) {
            LevelBadge(level: level, size: 30, showTier: true)
                .padding(.horizontal, 12).padding(.vertical, 4)
                .tintedPill(BadgeArt.tierAccent(tier))
            VStack(alignment: .leading, spacing: 2) {
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color(hex: 0x7C3AED).opacity(Theme.isDark ? 0.25 : 0.14))
                        Capsule().fill(LinearGradient(colors: [Color(hex: 0xA855F7), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                            .frame(width: g.size.width * progress / 100)
                    }
                }
                .frame(height: 8)
                Text("\(toNext) XP to next").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
        }
        .frame(maxWidth: 320)
        .frame(maxWidth: .infinity)
    }
}

/// The action row: family buttons by friendship state (core profileActions), the ⋯ menu at its end.
struct ProfileActionRow: View {
    let state: StatsProfile.FriendshipState
    var busy = false
    let onChallenge: () -> Void
    let onPocket: () -> Void
    let onReact: () -> Void
    let onAddFriend: () -> Void
    let onCancelRequest: () -> Void
    let onAccept: () -> Void
    let onDecline: () -> Void
    let onMenu: () -> Void

    var body: some View {
        let acts = StatsProfile.profileActions(state)
        HStack(spacing: 8) {
            ForEach(acts.row, id: \.rawValue) { a in
                Button { Haptics.tap(); run(a) } label: { CandyLabel(title: title(a)) { EmptyView() } }
                    .buttonStyle(CandyButtonStyle(variant: variant(a), size: .small, fullWidth: false))
                    .disabled(busy)
            }
            if !acts.menu.isEmpty {
                HeaderCircleButton(.symbol("ellipsis"), label: "More") { onMenu() }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func title(_ a: StatsProfile.ProfileAction) -> String {
        switch a {
        case .challenge: return "Challenge"
        case .pocket: return "Pocket game"
        case .react: return "React"
        case .addFriend: return "Add friend"
        case .requested: return "Requested"
        case .accept: return "Accept"
        case .decline: return "Decline"
        }
    }

    private func variant(_ a: StatsProfile.ProfileAction) -> CandyButtonStyle.Variant {
        switch a {
        case .challenge: return .pink
        case .pocket: return .teal
        case .react: return .amber
        case .requested, .decline: return .peach
        case .addFriend, .accept: return .purple
        }
    }

    private func run(_ a: StatsProfile.ProfileAction) {
        switch a {
        case .challenge: onChallenge()
        case .pocket: onPocket()
        case .react: onReact()
        case .addFriend: onAddFriend()
        case .requested: onCancelRequest()
        case .accept: onAccept()
        case .decline: onDecline()
        }
    }
}

/// HEAD TO HEAD (item 17): your record against this player — VS plus pocket games, the same numbers as the Stats page's
/// HEAD TO HEAD rows — one line over a two-color record bar. Friends only (the data is friend-scoped).
struct ProfileHeadToHeadStrip: View {
    let friend: FriendsService.FriendProfile
    let name: String
    @State private var records: StatsProfile.PocketRecords? = PocketRecordsService.cached

    var body: some View {
        let vs = StatsProfile.PocketRecord(wins: friend.h2hW ?? 0, losses: friend.h2hL ?? 0)
        let pocket = records?.byFriend[friend.id]?.total ?? StatsProfile.PocketRecord()
        let wins = vs.wins + pocket.wins, losses = vs.losses + pocket.losses
        Group {
            if wins + losses + pocket.draws > 0 {
                VStack(spacing: 6) {
                    HStack {
                        BubbleTextView(text: "HEAD TO HEAD", palette: .accent(.cast(StatsProfile.castD)), maxSize: 20, minSize: 13, alignment: .leading)
                            .frame(maxWidth: 240)
                        Spacer(minLength: 4)
                        Text("\(wins)–\(losses)").softNumber(20)
                    }
                    RecordBarView(wins: wins, losses: losses, height: 9)
                    Text("\(StatsProfile.headToHeadLine(vs: vs, pocket: pocket)) · you vs \(name)")
                        .font(Brand.font(10.5, .heavy)).foregroundStyle(FinishInk.secondary)
                }
                .padding(12)
                .statsCard(accent: .cast(StatsProfile.castD))
            }
        }
        .task { if let r = await PocketRecordsService.fetch() { records = r } }
    }
}
