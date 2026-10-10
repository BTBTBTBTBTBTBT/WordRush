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
    /// nil = pick a game next (opened from a friend); set = the game is chosen.
    @State var kind: FriendlyKind?
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
    /// BJ13: the picker's measured width (the grid fills it).
    @State private var gridWidth: CGFloat = 343

    init(friend: FriendsService.FriendProfile?, kind: FriendlyKind?,
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
                Capsule().fill(FriendsInk.pink.wash(0.35)).frame(width: 40, height: 5)
                    .frame(maxWidth: .infinity).padding(.top, 8)
                if let f = friend {
                    // BJ13: a friend picked in this sheet soft-rises in (MotionSpec).
                    VStack(alignment: .leading, spacing: 14) {
                        header(f)
                        if let k = kind {
                            if k == .coin {
                                // Call It is the one game with a choice to make: its stake, then Start.
                                stakeStep(f)
                            } else {
                                // Wave 3: a game and a friend are chosen, so straight in (no second pick).
                                startingStep(f, k)
                            }
                        } else {
                            gamesSection(f)
                            wordociousSection(f)
                        }
                    }
                    .transition(Self.riseIn)
                } else {
                    picker.transition(.opacity)
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 24)
        }
        // BJ13 (mockup option 1): the picker sits on a calm lavender sheet; the play state
        // keeps the Friends page wash.
        .background { if friend == nil { Self.pickerSheet.ignoresSafeArea() } }
        .pageBackground(.friends, lightOnly: true)
        // No friends: the empty state needs only the medium height.
        .presentationDetents(friend == nil ? [Self.pickerSource.isEmpty ? .medium : Self.pickerDetent, .large] : [.large])
    }

    // MARK: Friend picker (from a game tile) — BJ13 character-select grid

    /// The shared soft rise (BJ9's no-source motion): 0.96 → 1, up 14, fade;
    /// Reduce Motion: a cross-fade.
    private static var riseIn: AnyTransition {
        if Theme.reduceMotion { return .opacity }
        return .asymmetric(
            insertion: .scale(scale: MotionSpec.riseScale, anchor: .top)
                .combined(with: .offset(y: MotionSpec.riseOffset)).combined(with: .opacity),
            removal: .opacity)
    }

    /// The rise's curve (web MOTION.growEase, ease-out-expo-like) / the cross-fade.
    private static var riseAnimation: Animation {
        Theme.reduceMotion ? .easeOut(duration: MotionSpec.crossFadeDuration)
            : .timingCurve(0.16, 1, 0.3, 1, duration: MotionSpec.riseDuration)
    }

    private var picker: some View {
        let now = Date()
        // Online first, then the freshest presence, then A–Z (web sortForPicker).
        let friends = Self.pickerSource.sorted { a, b in
            let ao = a.isOnline(now: now), bo = b.isOnline(now: now)
            if ao != bo { return ao }
            let la = FriendsService.ms(a.lastSeenAt) ?? 0, lb = FriendsService.ms(b.lastSeenAt) ?? 0
            if la != lb { return la > lb }
            return a.username.localizedCaseInsensitiveCompare(b.username) == .orderedAscending
        }
        let grid = FriendsKit.PickerGrid.layout(width: gridWidth)
        return VStack(spacing: 12) {
            pickerTitle
            if friends.isEmpty {
                // §A7 empty state: I with the invite scene (not the page host O1).
                // BI24: brand headline over I's voice line.
                BrandEmptyState(title: "No friends yet", line: "Add a friend first, then pick a game and play.",
                                scene: .invite, artHeight: 110, colors: [Color(hex: 0xDB2777), Color(hex: 0x7C3AED)],
                                lineColor: FriendsInk.muted)
            } else {
                // Rows of the grid's exact column width, each CENTERED, so a partial last
                // row sits in the middle (founder: symmetry) instead of pinned left.
                let gap = FriendsKit.PickerGrid.gap
                let cols = max(1, grid.cols)
                let cellW = (gridWidth - gap * CGFloat(cols - 1)) / CGFloat(cols)
                VStack(spacing: FriendsKit.PickerGrid.rowSpacing) {
                    ForEach(Array(stride(from: 0, to: friends.count, by: cols)), id: \.self) { start in
                        HStack(alignment: .top, spacing: gap) {
                            ForEach(friends[start..<min(start + cols, friends.count)], id: \.id) { f in
                                pickerCell(f, avatar: grid.avatar, now: now)
                                    .frame(width: cellW > 0 ? cellW : nil)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .background(GeometryReader { g in
            Color.clear
                .onAppear { gridWidth = g.size.width }
                .onChange(of: g.size.width) { gridWidth = $0 }
        })
    }

    /// The friends the picker offers.
    private static var pickerSource: [FriendsService.FriendProfile] { FriendsService.friends }

    /// The calm lavender picker sheet (mockup option 1).
    private static var pickerSheet: Color { FriendsInk.dark ? (SeasonKit.surfaces?.card ?? Color(hex: 0x1C0F30)) : Color(hex: 0xF4F0FF) }

    /// Opens tall enough for the header + two full rows of tiles.
    private static var pickerDetent: PresentationDetent {
        .height(FriendsKit.PickerGrid.twoRowHeight(width: UIScreen.main.bounds.width - 32))
    }

    /// The game's title art spanning the sheet (else the name in the live title
    /// lettering), the rules line in dark ink, then WHO ARE YOU PLAYING? in muted,
    /// letter-spaced caps (its art once it ships).
    private var pickerTitle: some View {
        VStack(spacing: 6) {
            let k = kind ?? .rps
            let art = FriendsKit.pocketTitleAsset(k)
            if ArtAsset.exists(art) {
                Image(art).resizable().interpolation(.high).scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: 84)
                    .accessibilityLabel(k.title).accessibilityAddTraits(.isHeader)
            } else {
                LiveHeadline(text: k.title, palette: .friends, size: 32, maxLines: 1, minimumScale: 0.5)
                    .frame(maxWidth: .infinity)
            }
            Text(FriendsKit.rules(k)).font(Brand.font(15, .heavy)).foregroundStyle(FriendsInk.heading)
            Group {
                if ArtAsset.exists(FriendsKit.pickFriendTitleAsset) {
                    Image(FriendsKit.pickFriendTitleAsset).resizable().interpolation(.high).scaledToFit()
                        .frame(maxWidth: 260, maxHeight: 30)
                        .accessibilityLabel("Who are you playing?").accessibilityAddTraits(.isHeader)
                } else {
                    BubbleLabel("Who are you playing?", color: FriendsInk.bannerHead, size: 16, alignment: .center)
                        .accessibilityAddTraits(.isHeader)
                }
            }
            .padding(.top, 6)
        }
        .frame(maxWidth: .infinity)
    }

    /// One character-select cell: the friend's REAL avatar (the shared resolver: their
    /// mascot, photo or cast pick) as a tile filling the cell, a soft green glow when
    /// they're on (no outline), the name (no @) and one short status, centered.
    /// Tap = squish, then the play state.
    private func pickerCell(_ f: FriendsService.FriendProfile, avatar: CGFloat, now: Date) -> some View {
        let st = FriendsKit.pickerStatus(f, now: now)
        return Button {
            withAnimation(Self.riseAnimation) { friend = f }
        } label: {
            VStack(spacing: 1) {
                AvatarView(url: f.avatar_url, username: f.username, size: avatar, emoji: f.avatar_emoji,
                           castId: f.avatar_cast_id, frame: f.avatar_frame, userId: f.id, stroke: false)
                    .shadow(color: st.online ? FriendsKit.green.opacity(0.55) : .clear, radius: 10)
                    .shadow(color: st.online ? FriendsKit.green.opacity(0.35) : .clear, radius: 4)
                    .padding(.bottom, 5)
                BubbleOneLine(text: f.username.uppercased(),
                              palette: .accent(PlayerTint.nameColor(userId: f.id, username: f.username, onLight: !FriendsInk.dark)),
                              size: 16, minScale: 0.45)
                Text(st.text).font(Brand.font(12, .heavy))
                    .foregroundStyle(st.online ? FriendsKit.green : FriendsInk.rowSub).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .accessibilityLabel("\(f.username), \(st.text)")
    }

    // MARK: Header

    private func header(_ f: FriendsService.FriendProfile) -> some View {
        let online = f.isOnline()
        let facts = [FriendsKit.rivalry(f), FriendsKit.streakText(f.friendStreak)].compactMap { $0 }
        return HStack(spacing: 12) {
            FriendsPresenceAvatar(url: f.avatar_url, username: f.username, emoji: f.avatar_emoji, size: 48, online: online, ring: false)
            VStack(alignment: .leading, spacing: 2) {
                // BJ16: the LET'S PLAY! lettering; the friend's @name rides under it.
                HeadingArtView(.letsplay, height: 28, maxWidth: 170, label: "Play with \(f.username)", alignment: .leading)
                BubbleLabel(f.username, color: PlayerTint.nameColor(userId: f.id, username: f.username, onLight: !FriendsInk.dark),
                            size: 15, minScale: 0.45)
                    .accessibilityHidden(true)
                if let p = f.presenceLine() {
                    Text(p).font(Brand.font(12, .heavy)).foregroundStyle(online ? FriendsKit.green : FriendsInk.muted).lineLimit(1)
                }
                if !facts.isEmpty {
                    Text(facts.joined(separator: " · ")).font(Brand.font(11, .bold)).foregroundStyle(FriendsInk.muted).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .friendsCard(accent: FriendsInk.pink, bar: [FriendsInk.pink, FriendsInk.amber], radius: 18, barHeight: 6)
    }

    // MARK: Quick games

    /// Friend first: one tap on a game tile goes straight in (Call It stops at its stake step).
    private func gamesSection(_ f: FriendsService.FriendProfile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: f.isOnline() ? "PICK A GAME · LIVE WHILE THEY'RE ON" : "PICK A GAME")
            // §9: six tiles, 3 across x 2 rows.
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(FriendlyKind.allCases) { k in
                    Button {
                        error = nil
                        if Theme.reduceMotion { kind = k }
                        else { withAnimation(.easeOut(duration: 0.12)) { kind = k } }
                    } label: {
                        // The square game tile (docs/GAME_TILE_STYLE.md) in the game's §C4 card color.
                        GameTileSquare(accent: FriendsKit.tileAccent(k), label: k.title, selected: false,
                                       light: true) { chip in
                            gameIcon(k, size: chip)
                        }
                    }
                    .buttonStyle(.squish)
                    .accessibilityLabel("\(k.title), \(FriendsKit.sub(k))")
                }
            }
        }
    }

    /// Call It's one extra step: what is on the line, then Start. Same sheet, no second game pick.
    private func stakeStep(_ f: FriendsService.FriendProfile) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(spacing: 4) {
                BubbleTextView(text: FriendlyKind.coin.title.uppercased(), palette: .accent(FriendsKit.tileAccent(.coin)),
                               maxSize: 34, minSize: 22, animated: true)
                Text(FriendsKit.rules(.coin)).font(Brand.font(12, .heavy)).foregroundStyle(FriendsInk.muted)
            }
            .frame(maxWidth: .infinity)
            VStack(alignment: .leading, spacing: 6) {
                PocketBubble(text: "What's on the line", color: FriendsKit.tileAccent(.coin), size: 15, minScale: 0.5)
                    .accessibilityAddTraits(.isHeader)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(FriendlyGames.coinStakes, id: \.self) { s in
                            Button { stake = s } label: {
                                // §A1 chips: tinted, the picked stake stronger + ringed.
                                PocketBubble(text: s, color: FriendsKit.purple, size: 13, palette: PlayerTint.platePalette(lightInk: FriendsInk.dark),
                                             fixed: true)
                                    .padding(.horizontal, 12).frame(minHeight: 30)
                                    .friendsChip(FriendsKit.tileAccent(.coin), strong: stake == s)
                            }
                            .buttonStyle(.squish)
                            .accessibilityAddTraits(stake == s ? .isSelected : [])
                        }
                    }
                    .padding(2)
                }
            }
            if let error {
                Text(error).font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0xDC2626))
                    .multilineTextAlignment(.center).frame(maxWidth: .infinity)
            }
            // §A8: the large purple candy Start.
            Button { start(f) } label: {
                if starting { ProgressView().tint(.white) }
                else { CandyLabel(title: "Start Call It", symbol: "play.fill") }
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: .large))
            .disabled(starting)
            Text("\(f.username) gets a ping. If they're busy, it waits as your turn.")
                .font(Brand.font(11, .bold)).foregroundStyle(FriendsInk.muted)
                .multilineTextAlignment(.center).frame(maxWidth: .infinity)
        }
    }

    /// Game and friend chosen: start at once. A refusal shows its message with a way back to the games.
    private func startingStep(_ f: FriendsService.FriendProfile, _ k: FriendlyKind) -> some View {
        VStack(spacing: 12) {
            gameIcon(k, size: 64)
            if let error {
                Text(error).font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0xDC2626))
                    .multilineTextAlignment(.center).frame(maxWidth: .infinity)
                Button { start(f) } label: { CandyLabel(title: "Try again", symbol: "arrow.clockwise") }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium, fullWidth: false))
                Button { self.error = nil; kind = nil } label: { CandyLabel(title: "Pick another game") }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium, fullWidth: false))
            } else {
                CastLoader(label: "STARTING \(k.title.uppercased())", labelColor: FriendsInk.muted, showTips: false)
            }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 24)
        .task(id: k) { if error == nil, !starting { start(f) } }
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

    /// The two Wordocious ways to play (§3): tinted teal cards (the VS accent) that
    /// squish; the live battle carries the stronger tint.
    private func wordociousCard(title: String, sub: String, solid: Bool, action: @escaping () -> Void) -> some View {
        let teal = Color(hex: 0x0D9488)
        return Button(action: action) {
            HStack(spacing: 8) {
                Group {
                    if ArtAsset.exists("game-vs") {
                        // ART_SPEC §3: the VS game's 3D icon.
                        GameArtImage(asset: "game-vs", size: 30)
                    } else {
                        Image("swords").renderingMode(.template).resizable().scaledToFit()
                            .frame(width: 15, height: 15).foregroundStyle(VsLobbyKit.ink)
                    }
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(Brand.font(12, .black)).foregroundStyle(VsLobbyKit.deep)
                        .lineLimit(1).minimumScaleFactor(0.75)
                    Text(sub).font(Brand.font(9.5, .bold)).foregroundStyle(VsLobbyKit.ink)
                        .lineLimit(1).minimumScaleFactor(0.75)
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .friendsCard(accent: teal, bar: [teal], radius: 14, barHeight: 4,
                         tint: solid ? 0.16 : 0.08, line: solid ? 0.45 : 0.26)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
    }

    /// The pocket game's icon: the glossy 3D art when it ships, else the outline chip.
    @ViewBuilder private func gameIcon(_ k: FriendlyKind, size: CGFloat) -> some View {
        if let art = k.pocketArt {
            GameArtImage(asset: art, size: size).frame(width: size, height: size).accessibilityHidden(true)
        } else {
            FriendlyGameIcon(kind: k, size: size, tinted: true)
        }
    }

    private func start(_ f: FriendsService.FriendProfile) {
        guard !starting, let kind else { return }
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
