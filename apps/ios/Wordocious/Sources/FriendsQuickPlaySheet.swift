import SwiftUI
import WordociousCore

/// The quick-play sheet (Friends overhaul, founder 2026-10-01; spec
/// docs/FRIENDS_REDESIGN_SPEC.md §3): pick a pocket game (and a stake for Call
/// It) and invite a friend, or jump to the Wordocious ways to play them — a
/// live VS Battle (the free friends challenge) or Race my run (the VS Friend
/// page with them preselected, Pro). Opened from a face, a friend row's Play,
/// a game tile (then it starts with a friend picker) or a Rematch reaction.
struct FriendsQuickPlaySheet: View {
    /// nil = pick a friend first (opened from a game tile).
    @State var friend: FriendsService.FriendProfile?
    @State var kind: FriendlyKind
    /// The game started (or the open one returned) — present its screen.
    let onStarted: (FriendlyGameView) -> Void
    /// VS Battle, live — the existing free /api/friends/challenge.
    let onVSBattle: (FriendsService.FriendProfile) -> Void
    /// Race my run — the VS Friend page with this friend preselected (Pro).
    let onRaceMyRun: (FriendsService.FriendProfile) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var stake = FriendlyGames.coinStakes[0]
    @State private var starting = false
    @State private var error: String?

    init(friend: FriendsService.FriendProfile?, kind: FriendlyKind,
         onStarted: @escaping (FriendlyGameView) -> Void,
         onVSBattle: @escaping (FriendsService.FriendProfile) -> Void,
         onRaceMyRun: @escaping (FriendsService.FriendProfile) -> Void) {
        _friend = State(initialValue: friend)
        _kind = State(initialValue: kind)
        self.onStarted = onStarted
        self.onVSBattle = onVSBattle
        self.onRaceMyRun = onRaceMyRun
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Capsule().fill(Color(hex: 0xD1D5DB)).frame(width: 40, height: 5)
                    .frame(maxWidth: .infinity).padding(.top, 8)
                if let f = friend {
                    header(f)
                    gamesSection(f)
                    wordociousSection(f)
                    cta(f)
                } else {
                    picker
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 24)
        }
        .pageBackground(.friends, lightOnly: true)
        .presentationDetents(friend == nil ? [.medium, .large] : [.large])
    }

    // MARK: Friend picker (from a game tile)

    private var picker: some View {
        let friends = FriendsService.friends.sorted { a, b in
            let ao = a.isOnline(), bo = b.isOnline()
            if ao != bo { return ao }
            return a.username.localizedCaseInsensitiveCompare(b.username) == .orderedAscending
        }
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                FriendlyGameIcon(kind: kind, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(kind.title.uppercased()).font(Brand.font(17, .black)).tracking(0.3).foregroundStyle(FriendsKit.ink)
                    Text(FriendsKit.sub(kind)).font(Brand.font(11, .bold)).foregroundStyle(FriendsKit.label)
                }
            }
            FriendsSectionHeader(title: "PICK A FRIEND")
            if friends.isEmpty {
                Text("Add a friend first — then pick a game and play.")
                    .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
            }
            VStack(spacing: 0) {
                ForEach(friends) { f in
                    Button { withAnimation(.easeOut(duration: 0.15)) { friend = f } } label: {
                        HStack(spacing: 10) {
                            FriendsPresenceAvatar(url: f.avatar_url, username: f.username, emoji: f.avatar_emoji, size: 34, online: f.isOnline(), ring: false)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("@\(f.username)").font(Brand.font(13, .black)).foregroundStyle(Color(hex: 0x111827)).lineLimit(1)
                                Text(f.presenceLine() ?? FriendsKit.todayLine(f)).font(Brand.font(11, .bold))
                                    .foregroundStyle(f.isOnline() ? FriendsKit.green : FriendsKit.label).lineLimit(1)
                            }
                            Spacer(minLength: 4)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if f.id != friends.last?.id { Divider().padding(.leading, 56) }
                }
            }
            .vsCard(radius: 14)
        }
    }

    // MARK: Header

    private func header(_ f: FriendsService.FriendProfile) -> some View {
        let online = f.isOnline()
        let facts = [FriendsKit.rivalry(f), FriendsKit.streakText(f.friendStreak)].compactMap { $0 }
        return HStack(spacing: 12) {
            FriendsPresenceAvatar(url: f.avatar_url, username: f.username, emoji: f.avatar_emoji, size: 48, online: online)
            VStack(alignment: .leading, spacing: 2) {
                Text("PLAY WITH @\(f.username.uppercased())").font(Brand.font(17, .black)).tracking(0.3)
                    .foregroundStyle(FriendsKit.ink).lineLimit(1).minimumScaleFactor(0.7)
                if let p = f.presenceLine() {
                    Text(p).font(Brand.font(12, .heavy)).foregroundStyle(online ? FriendsKit.green : FriendsKit.label).lineLimit(1)
                }
                if !facts.isEmpty {
                    Text(facts.joined(separator: " · ")).font(Brand.font(11, .bold)).foregroundStyle(FriendsKit.label).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: Quick games

    private func gamesSection(_ f: FriendsService.FriendProfile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: f.isOnline() ? "QUICK GAMES · LIVE WHILE THEY'RE ON" : "QUICK GAMES")
            // §9: six tiles, 3 across × 2 rows.
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(FriendlyKind.allCases) { k in
                    Button { withAnimation(.easeOut(duration: 0.12)) { kind = k; error = nil } } label: {
                        // The square game tile (docs/GAME_TILE_STYLE.md); the picked game is selected.
                        GameTileSquare(accent: FriendsKit.color(k), label: k.title, selected: kind == k,
                                       light: true) { chip in
                            FriendlyGameIcon(kind: k, size: chip, tinted: true)
                        }
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("\(k.title), \(FriendsKit.sub(k))")
                    .accessibilityAddTraits(kind == k ? .isSelected : [])
                }
            }
            Text(FriendsKit.sub(kind)).font(Brand.font(11, .bold)).foregroundStyle(FriendsKit.label)
                .frame(maxWidth: .infinity, alignment: .center)
            if kind == .coin {
                VStack(alignment: .leading, spacing: 6) {
                    Text("WHAT'S ON THE LINE").font(Brand.font(10, .black)).tracking(1).foregroundStyle(FriendsKit.label)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(FriendlyGames.coinStakes, id: \.self) { s in
                                Button { stake = s } label: {
                                    Text(s).font(Brand.font(11, .heavy)).foregroundStyle(FriendsKit.ink)
                                        .padding(.horizontal, 12).frame(height: 30)
                                        .background(Capsule().fill(Color.white))
                                        .overlay(Capsule().stroke(stake == s ? FriendsKit.solid : Color(hex: 0xF3E8FF), lineWidth: stake == s ? 2 : 1))
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(stake == s ? .isSelected : [])
                            }
                        }
                        .padding(2)
                    }
                }
            }
        }
    }

    // MARK: Wordocious

    private func wordociousSection(_ f: FriendsService.FriendProfile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: "WORDOCIOUS")
            HStack(spacing: 10) {
                wordociousCard(title: "VS Battle, live", sub: "Classic · free for friends", solid: true) {
                    dismiss(); onVSBattle(f)
                }
                wordociousCard(title: "Race my run", sub: AuthService.shared.isProActive ? "They race your time" : "Pro · they race your time", solid: false) {
                    dismiss(); onRaceMyRun(f)
                }
            }
        }
    }

    private func wordociousCard(title: String, sub: String, solid: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Group {
                    if ArtAsset.exists("game-vs") {
                        // ART_SPEC §3: the VS game's 3D icon.
                        GameArtImage(asset: "game-vs", size: 26)
                    } else {
                        Image("swords").renderingMode(.template).resizable().scaledToFit()
                            .frame(width: 15, height: 15).foregroundStyle(solid ? .white : VsLobbyKit.ink)
                    }
                }
                    .frame(width: 30, height: 30)
                    .background(RoundedRectangle(cornerRadius: 9).fill(solid ? Color.white.opacity(0.2) : Color.white))
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(Brand.font(12, .black)).foregroundStyle(solid ? .white : VsLobbyKit.deep)
                        .lineLimit(1).minimumScaleFactor(0.75)
                    Text(sub).font(Brand.font(9.5, .bold)).foregroundStyle(solid ? Color.white.opacity(0.9) : VsLobbyKit.ink)
                        .lineLimit(1).minimumScaleFactor(0.75)
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(solid ? VsLobbyKit.ink : VsLobbyKit.soft))
        }
        .buttonStyle(PressableStyle())
    }

    // MARK: CTA

    private func cta(_ f: FriendsService.FriendProfile) -> some View {
        VStack(spacing: 8) {
            if let error {
                Text(error).font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0xDC2626))
                    .multilineTextAlignment(.center).frame(maxWidth: .infinity)
            }
            Button { start(f) } label: {
                Group {
                    if starting { ProgressView().tint(.white) }
                    else { Text("INVITE TO \(kind.title.uppercased())").font(Brand.font(14, .black)).tracking(0.6) }
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity).frame(height: 50)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(FriendsKit.solid)
                    .shadow(color: FriendsKit.solid.opacity(0.35), radius: 6, y: 3))
            }
            .buttonStyle(PressableStyle())
            .disabled(starting)
            Text("\(f.username) gets a ping. If they're busy, it waits as your turn.")
                .font(Brand.font(11, .bold)).foregroundStyle(FriendsKit.label)
                .multilineTextAlignment(.center).frame(maxWidth: .infinity)
        }
        .padding(.top, 4)
    }

    private func start(_ f: FriendsService.FriendProfile) {
        guard !starting else { return }
        starting = true
        error = nil
        Task {
            let r = await FriendlyGamesService.start(kind: kind, friendId: f.id, stake: kind == .coin ? stake : nil)
            starting = false
            switch r {
            case .success(let g):
                Haptics.tap()
                dismiss()
                onStarted(g)
            case .failure(.message(let m)): error = m
            case .failure: error = "Could not start the game — try again"
            }
        }
    }
}
