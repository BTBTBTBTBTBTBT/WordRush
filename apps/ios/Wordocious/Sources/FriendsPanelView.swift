import SwiftUI
import WordociousCore

/// The Friends tab, top to bottom (Friends overhaul, founder 2026-10-01; spec
/// docs/FRIENDS_REDESIGN_SPEC.md §2): the Friends banner (on now + today's
/// race), INVITES, YOUR TURN (pocket games in play), PLAY WITH FRIENDS (the
/// four pocket games), THIS WEEK'S RACE, YOUR FRIENDS (presence, friend
/// streaks, one action each), MOMENTS (with reactions) and Add by username.
/// Same look as the home and VS pages (FriendsKit). Started life as the §207
/// friends card (components/friends/friends-panel.tsx twin); every earlier
/// action — taunts, Challenge, shield gifts, Unfriend, the weekly podium —
/// lives on in the new sections.
struct FriendsPanelView: View {
    /// A fresh id focuses the username field (the "Add a friend" button's jump).
    var focusAdd: UUID? = nil
    /// FINISH_SPEC §C4b: the "Your friends" header's Add a friend candy button —
    /// the screen scrolls to Add by username and focuses the field (what the old
    /// header circle did). nil → focus the field in place.
    var onAddFriend: (() -> Void)? = nil

    @State private var version = 0
    @State private var username = ""
    @State private var sending = false
    @State private var note: String?
    @State private var addNote: String?
    @State private var inviteNote: String?
    @FocusState private var fieldFocused: Bool
    // Typeahead (Aug 11): 2+ letters → matching users, so invites go to the
    // right Carlie instead of a blind exact-match fire.
    @State private var suggestions: [FriendsService.FriendProfile] = []
    @State private var searchTask: Task<Void, Never>?
    // §212: one-tap taunts from friend rows (leaderboard sheet twin).
    @State private var tauntTarget: FriendsService.FriendProfile?
    @State private var tauntStatus: String?
    // §225: context-menu targets — Unfriend confirmation, and a programmatic
    // profile push (menu items can't be NavigationLinks).
    @State private var unfriendTarget: FriendsService.FriendProfile?
    @State private var profileTarget: String?
    /// The family action menu's friend (the row's long-press), open while non-nil.
    @State private var menuFriend: FriendsService.FriendProfile?
    // §234: double-tap guard for the weekly-race share card.
    @State private var sharingRace = false
    // §238: the "Last week" line unfolds into the settled-week history.
    @State private var showPastWeeks = false
    // §289: Challenge from any row — the friend id in flight (double-tap
    // guard + button dimming) and the private Classic match to present.
    @State private var challenging: String?
    @State private var challengeMatch: ChallengeMatch?
    private struct ChallengeMatch: Identifiable { let id = UUID(); let mode: GameMode; let code: String }
    // D3.4 (§294): shield gift in flight — the friend id (double-tap guard).
    @State private var gifting: String?
    // §289: the share sheet for the invite link (profile, or a Pro player's
    // open referral code) — message + separate URL, the ActivityShareSheet way.
    @State private var shareInvite: ShareInvite?
    @State private var resolvingShare = false
    private struct ShareInvite: Identifiable { let id = UUID(); let text: String; let url: URL }

    // Friends overhaul: the quick-play sheet, the game screen, the full
    // Today's Race sheet and Race my run (the VS Friend page, Pro).
    /// `friend` nil = game first (pick a friend next); `kind` nil = friend first (pick a game next).
    /// Both set = straight in (Call It stops at its stake step).
    struct QuickPlay: Identifiable { let id = UUID(); let friend: FriendsService.FriendProfile?; let kind: FriendlyKind? }
    // Wave 3 (9e): their-turn lines expanded on tap, the collapsible All friends list, and the
    // resign confirmation (Resign lives in the friend's more menu now, not inside the game).
    @State private var theirTurnOpen: Set<String> = []
    @State private var allFriendsOpen: Bool?
    @State private var resignTarget: FriendlyGameView?
    struct OpenGame: Identifiable { let id: String; let initial: FriendlyGameView? }
    @State private var quickPlay: QuickPlay?
    @State private var openGame: OpenGame?
    @State private var showRace = false
    @State private var raceRunFriend: String?
    @State private var showPro = false
    @State private var gamesVersion = 0
    // FINISH_SPEC §T1 / §T3: the invite-sent card (a request now pending) and the
    // NEW FRIENDS card (a request accepted — yours, or theirs via mutual add).
    @State private var sentRequestTo: String?
    struct NewFriend: Equatable { let id: String?; let name: String; let avatar: String?; let emoji: String? }
    @State private var newFriend: NewFriend?

    var body: some View {
        let _ = version
        let _ = gamesVersion
        let friends = FriendsService.friends
        let incoming = FriendsService.incoming
        let outgoing = FriendsService.outgoingProfiles

        // BJ7: crisp page rhythm — 14 between sections (was 18).
        VStack(alignment: .leading, spacing: 14) {
            if let p = AuthService.shared.profile {
                // Wave 3 (9e): "On now" folds into the friend cards below (green dot + "playing
                // Classic"), and the race is told once (the pills, countdown small in the header).
                FriendsBannerView(friends: friends, me: p, meDigest: FriendsService.meDigest,
                                  showOnNow: false,
                                  onFace: { quickPlay = QuickPlay(friend: $0, kind: nil) },
                                  onRace: { showRace = true })
            }
            // 9f: the branded Invites row and ONE obvious "Have a code?" button (both hide themselves when
            // branded_invites is off). Accepting hands the code to the same DeepLink state the universal links use,
            // so RootTabView presents the private match / the race exactly like a tapped link.
            InvitesRow { item in
                switch item.variant {
                case .race: DeepLink.shared.vsChallenge = DeepLink.VSChallengeLink(code: item.code)
                case .live:
                    if let m = GameMode(rawValue: item.gameMode) { DeepLink.shared.vsInvite = DeepLink.VSInviteLink(mode: m, code: item.code) }
                }
            }
            HaveACodeButton(color: .pink) { result in
                switch result {
                case .race(let code): DeepLink.shared.vsChallenge = DeepLink.VSChallengeLink(code: code)
                case .live(let mode, let code): DeepLink.shared.vsInvite = DeepLink.VSInviteLink(mode: mode, code: code)
                case .friend(let code): if let u = URL(string: "https://wordocious.com/join/\(code)") { UIApplication.shared.open(u) }
                }
            }
            // Wave 3 (items 9 + 9e): the friends list at the top, one card per friend (online
            // first), their games as tiles inside the card, the rest under "All friends".
            yourFriendsSection(friends, incoming: incoming, outgoing: outgoing)
            if AuthService.shared.profile != nil {
                playWithFriendsSection
            }
            if !podium.isEmpty {
                weeklyRaceSection
            }
            if let nf = newFriend {
                FriendsNewFriendsCard(
                    me: AuthService.shared.profile, friendName: nf.name, friendAvatar: nf.avatar, friendEmoji: nf.emoji,
                    onChallenge: {
                        // The existing challenge path (a private Classic VS race).
                        let f = nf.id.flatMap(FriendsKit.friend)
                            ?? FriendsService.friends.first { $0.username.caseInsensitiveCompare(nf.name) == .orderedSame }
                        if let f { newFriend = nil; challenge(f) }
                    },
                    onSeeFriends: { newFriend = nil })
                    .transition(.opacity)
            }
            // §10 (founder, iOS 220): INVITES sits near YOUR FRIENDS.
            if !incoming.isEmpty || !outgoing.isEmpty {
                invitesCard
            }
            if AuthService.shared.profile != nil {
                // §290 + §6: the circle's moments, with reactions and game moments.
                ActivityFeedView(onRematch: { kind, friendId in
                    if let f = FriendsKit.friend(friendId) { quickPlay = QuickPlay(friend: f, kind: kind) }
                })
            }
            addFriendSection.id("add-friend")
        }
        .task {
            // Presence and games come and go while the tab is open: refresh
            // the digest (stale-while-revalidate) and the game list each minute.
            while !Task.isCancelled {
                await FriendsService.load()
                await FriendlyGamesService.load()
                try? await Task.sleep(nanoseconds: 60_000_000_000)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            version = FriendsService.version
        }
        .onReceive(NotificationCenter.default.publisher(for: FriendlyGamesService.changed)) { _ in
            gamesVersion += 1
        }
        .onChange(of: focusAdd) { _ in fieldFocused = true }
        .softSheet(item: $tauntTarget) { target in tauntSheet(target) }
        .sheet(item: $shareInvite) { item in ActivityShareSheet(text: item.text, url: item.url) }
        .softSheet(item: $quickPlay) { q in
            FriendsQuickPlaySheet(
                friend: q.friend, kind: q.kind,
                onStarted: { g in after { openGame = OpenGame(id: g.id, initial: g) } },
                onVSBattle: { f in after { challenge(f) } },
                onRaceMyRun: { f in after { if AuthService.shared.isProActive { raceRunFriend = f.id } else { showPro = true } } })
        }
        .softSheet(isPresented: $showRace) { todaysRaceSheet }
        .softSheet(isPresented: $showPro) { ProView() }
        .gameCover(item: $openGame, onDismiss: { Task { await FriendlyGamesService.load() } }) { g in
            FriendlyGameScreen(gameId: g.id, initial: g.initial)
        }
        // §289: the challenger lands in the private lobby with the code —
        // the same VSGameView(mode:inviteCode:) cover a pending-invite accept
        // and the /vs/join universal link use (RootTabView, VSLobbyView).
        .gameCover(item: $challengeMatch) { m in
            NavigationStack { VSGameView(mode: m.mode, inviteCode: m.code) }
        }
        .familyActionMenu(item: $menuFriend) { f in friendMenuModel(f) }
        #if DEBUG
        .onReceive(NotificationCenter.default.publisher(for: FamilyActionMenuDemo.open)) { n in
            if (n.object as? String) == "friend" { menuFriend = FriendsService.friends.first }
            if (n.object as? String) == "close" { menuFriend = nil }
        }
        #endif
        // §225: Unfriend confirmation — the mutation was only reachable from a
        // profile page the rows couldn't open. remove() prunes the cache and
        // notifies, so the roster refreshes itself.
        .confirmationDialog(
            "Unfriend \(unfriendTarget?.username ?? "")?",
            isPresented: Binding(
                get: { unfriendTarget != nil },
                set: { if !$0 { unfriendTarget = nil } }),
            titleVisibility: .visible
        ) {
            Button("Unfriend", role: .destructive) {
                if let f = unfriendTarget {
                    Task { _ = await FriendsService.remove(friendId: f.id) }
                }
                unfriendTarget = nil
            }
            Button("Cancel", role: .cancel) { unfriendTarget = nil }
        } message: {
            Text("You can re-add them anytime.")
        }
        // §225: programmatic push for the context menu's View Profile — the
        // HomeView isPresented idiom (menu items can't be NavigationLinks).
        .navigationDestination(isPresented: Binding(
            get: { profileTarget != nil },
            set: { if !$0 { profileTarget = nil } })) {
            if let id = profileTarget { PublicProfileView(userId: id) }
        }
        // Race my run (§3): the VS Friend page with this friend preselected.
        .navigationDestination(isPresented: Binding(
            get: { raceRunFriend != nil },
            set: { if !$0 { raceRunFriend = nil } })) {
            if let id = raceRunFriend { VSFriendPage(mode: VsLobbyKit.selectedMode, preselected: [id]) }
        }
        .onChange(of: username) { q in
            searchTask?.cancel()
            let query = q.trimmingCharacters(in: .whitespaces)
            guard query.count >= 2 else { suggestions = []; return }
            searchTask = Task {
                try? await Task.sleep(nanoseconds: 250_000_000)   // debounce
                guard !Task.isCancelled else { return }
                let users = await FriendsService.search(query)
                guard !Task.isCancelled else { return }
                suggestions = users.filter {
                    !FriendsService.isFriend($0.id) && !FriendsService.hasRequested($0.id)
                }
            }
        }
    }

    /// Run after a sheet finishes dismissing (presenting mid-dismissal drops it).
    private func after(_ action: @escaping () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45, execute: action)
    }

    // MARK: Today's Race sheet (§2.2 — tap the banner's race row)

    private var todaysRaceSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    PageHostTitle(text: "TODAY'S RACE", colors: FriendsKit.titleGradient, host: Mascots.friends)
                        .frame(maxWidth: .infinity)
                    if let p = AuthService.shared.profile {
                        // §C4: the race on the pink banner card.
                        TodaysRaceCard(
                            friends: FriendsService.friends, me: p, meDigest: FriendsService.meDigest,
                            challenging: challenging,
                            onTaunt: { f in showRace = false; after { tauntTarget = f } },
                            onChallenge: { f in showRace = false; after { challenge(f) } })
                            .padding(12)
                            .friendsCard(accent: FriendsInk.pink, bar: [FriendsInk.pink, FriendsInk.amber])
                    }
                }
                .padding(16)
            }
            .wideColumn(.page)   // §AG: iPad column, centered on the wallpaper
            .pageBackground(.friends, lightOnly: true)
            .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Done") { showRace = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: PLAY WITH FRIENDS (§2.5)

    private var playWithFriendsSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            FriendsSectionHeader(title: "PLAY WITH FRIENDS") {
                Text("TAP A GAME, PICK A FRIEND").font(Brand.font(9.5, .black)).tracking(0.8)
                    .foregroundStyle(FriendsInk.section).lineLimit(1).minimumScaleFactor(0.7)
            }
            // §9: six games, 3 across × 2 rows. §C4: each a small card tinted in its
            // OWN color with its own top bar (mockup `.gt`).
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(FriendlyKind.allCases) { k in
                    let accent = FriendsKit.tileAccent(k)
                    Button { quickPlay = QuickPlay(friend: nil, kind: k) } label: {
                        // BJ7: the card hugs its content (no 116 floor): icon, a one-line
                        // name (scales down, never wraps), the detail held to two lines so
                        // every card in the grid stays the same height.
                        VStack(alignment: .leading, spacing: 3) {
                            pocketIcon(k, size: 32)
                            Text(k.title).font(Brand.font(12, .black)).foregroundStyle(FriendsInk.heading)
                                .lineLimit(1).minimumScaleFactor(0.7)
                            Text(FriendsKit.sub(k)).font(Brand.font(10, .bold)).foregroundStyle(FriendsInk.muted)
                                .lineLimit(2, reservesSpace: true).minimumScaleFactor(0.8).multilineTextAlignment(.leading)
                        }
                        .padding(.horizontal, 8).padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                        .friendsCard(accent: accent, bar: [accent], radius: 16, barHeight: 5, tint: 0.10, line: 0.28)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.squish)
                    .accessibilityLabel("\(k.title), \(FriendsKit.sub(k))")
                }
            }
        }
    }

    // MARK: THIS WEEK'S RACE (§2.6 — the weekly podium, restyled)

    /// The gold card's ink (light-only, like the rest of the Friends tab).
    private var weekInk: Color { FriendsInk.gold }

    private var weeklyRaceSection: some View {
        // §C4: this week's race on a warm gold card with the shared podium.
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                FriendsLabel("This week's race", color: weekInk)
                Spacer(minLength: 6)
                // §218: name the window and when it closes; §226 live clock.
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    Text(FriendsPanelView.weekEndsLabel(at: ctx.date).uppercased())
                        .font(Brand.font(9.5, .black)).tracking(0.6).foregroundStyle(weekInk)
                        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.8)
                }
                // §234: share the race once someone has actually scored this week.
                if raceStarted {
                    Button {
                        guard !sharingRace else { return }
                        sharingRace = true
                        LeaderboardShareFlow.shareWeeklyRace(
                            friends: FriendsService.friends,
                            meDigest: FriendsService.meDigest,
                            username: AuthService.shared.profile?.username)
                        sharingRace = false
                    } label: {
                        Icon3D(.share, size: 20)
                            .frame(width: 32, height: 32)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23: the family round icon, compact (row-sized)
                    .opacity(sharingRace ? 0.4 : 1)
                    .accessibilityLabel("Share weekly race")
                }
            }
            .padding(.horizontal, 12).padding(.top, 8)
            VStack(spacing: 4) {
                // D3.3 (§294) — the Sunday finish, settled server-side.
                if let r = FriendsService.lastWeek {
                    lastWeekBanner(r)
                }
                // §232/§238: Monday's answer — last week's winner, unfolding into history.
                if let lw = lastWeekWinner {
                    let history = pastWeeks
                    Button {
                        if history.count > 1 {
                            if Theme.reduceMotion { showPastWeeks.toggle() }
                            else { withAnimation(.easeInOut(duration: 0.15)) { showPastWeeks.toggle() } }
                        }
                    } label: {
                        HStack(spacing: 3) {
                            Text("Last week:")
                                .font(Brand.font(10, .bold)).foregroundStyle(weekInk)
                            Icon3D(.crown, size: 13, label: "Winner")
                            Text("\(lw.name) · \(lw.pts.formatted()) pts")
                                .font(Brand.font(10, .heavy)).foregroundStyle(weekInk)
                            if history.count > 1 {
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(weekInk)
                                    .rotationEffect(.degrees(showPastWeeks ? 180 : 0))
                            }
                            Spacer(minLength: 0)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.squish)
                    if showPastWeeks {
                        ForEach(history.filter { $0.k > 0 }, id: \.k) { wk in
                            HStack(spacing: 3) {
                                Text("\(FriendsPanelView.pastWeekLabel(wk.k)):")
                                Icon3D(.crown, size: 13, label: "Winner")
                                Text("\(wk.name) · \(wk.pts.formatted()) pts")
                            }
                                .font(Brand.font(10, .bold)).foregroundStyle(weekInk)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.leading, 4)
                        }
                    }
                }
            }
            .padding(.horizontal, 12)
            // The podium (shared with the Leaderboard): gold / silver / bronze steps;
            // §225: podium columns open profiles too.
            // BJ4: the free places as open spots once anyone is on it (ties keep plain order).
            PodiumView(entries: podium.map(podiumEntry), compact: true, lightOnly: true,
                       open: podium.isEmpty ? [] : Array(stride(from: podium.count + 1, through: 3, by: 1)),
                       stage: FriendsInk.goldAccent) { e in profileTarget = e.id }
                .padding(.horizontal, 4)
            // §238: everyone past the medals, ranked, on soft striped rows.
            if standings.count > 3 {
                VStack(spacing: 0) {
                    ForEach(Array(standings.dropFirst(3).enumerated()), id: \.element.id) { i, e in
                        OwnOrProfileLink(id: e.id, own: e.isMe) {
                            HStack(spacing: 8) {
                                Text(FriendsPanelView.ordinal(i + 4))
                                    .font(Brand.font(11, .black)).foregroundStyle(weekInk)
                                    .frame(width: 30, alignment: .trailing)
                                Text(e.username)
                                    .font(Brand.font(12, .black)).lineLimit(1)
                                    .foregroundStyle(e.isMe ? FriendsKit.solid : FriendsInk.heading)
                                Spacer(minLength: 4)
                                Text(e.pts.formatted()).softNumber(13, color: VsLobbyKit.numberInk)
                                    .fixedSize()
                                Text("pts").font(Brand.font(10, .bold)).foregroundStyle(FriendsInk.muted)
                            }
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.squish)
                        .friendsStripe(i, accent: FriendsInk.goldAccent)
                    }
                }
            }
            if !raceStarted {
                Text("Race resets Mondays — first daily takes the lead.")
                    .font(Brand.font(10, .bold)).foregroundStyle(weekInk)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 12)
            }
            Color.clear.frame(height: 2)
        }
        .friendsCard(accent: FriendsInk.goldAccent, bar: [FriendsInk.goldAccent, Color(hex: 0xFFD166)],
                     tint: 0.09, line: 0.28)
    }

    /// A race entry on the shared podium (letter-tile avatar, soft points).
    private func podiumEntry(_ e: RaceEntry) -> PodiumEntry {
        let me = AuthService.shared.profile
        return PodiumEntry(id: e.id, name: e.username,
                           username: e.isMe ? (me?.username ?? e.username) : e.username,
                           accentHex: e.isMe ? me?.accentColor : nil, emoji: e.avatarEmoji,
                           value: "\(e.pts.formatted()) pts", avatarUrl: e.avatarUrl)
    }

    /// The small game icon on the Friends cards: the glossy 3D pocket art when it
    /// ships (ART_SPEC §9), else the outline chip.
    @ViewBuilder private func pocketIcon(_ k: FriendlyKind, size: CGFloat) -> some View {
        if let art = k.pocketArt {
            GameArtImage(asset: art, size: size).frame(width: size, height: size).accessibilityHidden(true)
        } else {
            FriendlyGameIcon(kind: k, size: size, tinted: true)
        }
    }

    // MARK: YOUR FRIENDS (§2.7)

    /// §C4: the friends list's lavender card.
    private static let lavender = Color(hex: 0x7C3AED)

    @ViewBuilder
    private func yourFriendsSection(_ friends: [FriendsService.FriendProfile],
                                    incoming: [FriendsService.FriendProfile],
                                    outgoing: [FriendsService.FriendProfile]) -> some View {
        // §216: one-tap nudge for everyone who hasn't played today
        // (server still enforces 1 taunt per friend per day).
        let slackers = friends.filter { $0.playedToday == 0 && !isNewFriend($0) }
        VStack(alignment: .leading, spacing: 6) {
            // §C4b: "Add a friend" lives here now — a small candy button in the
            // section header (the old circle beside the FRIENDS title is gone).
            FriendsSectionHeader(title: friends.isEmpty ? "YOUR FRIENDS" : "YOUR FRIENDS · \(friends.count)") {
                Button {
                    if let onAddFriend { onAddFriend() } else { fieldFocused = true }
                } label: {
                    CandyLabel(title: "Add a friend", symbol: "plus")
                }
                .buttonStyle(CastButtonStyle(color: .pink, size: .small, fullWidth: false))
                .accessibilityLabel("Add a friend")
            }
            if friends.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                    Group {
                        if !FriendsService.loaded {
                            // Roster not fetched yet (cold launch): hold the rows' place instead of
                            // flashing the no-friends teaching copy (founder, 2026-09-29).
                            VStack(spacing: 8) {
                                ForEach(0..<3, id: \.self) { _ in SkeletonBlock(height: 30, cornerRadius: 10) }
                            }
                        } else if incoming.isEmpty && outgoing.isEmpty {
                            // Teaching empty state: explain the whole loop (Tier 1, Aug 11),
                            // under I's invite scene and its one line (MASCOT_SPEC §6, ART_SPEC §7;
                            // §A7: I, not the page host O1).
                            VStack(alignment: .leading, spacing: 5) {
                                MascotMessage(scene: .invite, line: Mascots.addFriendLine, size: 60,
                                              font: Brand.font(13, .black), color: FriendsInk.heading)
                                    .frame(maxWidth: .infinity).padding(.bottom, 4)
                                Text("1. Add friends below by username, or with the Add Friend button on any player's profile.")
                                Text("2. Requests you send and receive land in INVITES.")
                                Text("3. Once a friend accepts, race them today, play pocket games and trade streaks.")
                            }
                            .font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                        } else {
                            Text("Your friends land here once they accept.")
                                .font(Brand.font(12, .bold)).foregroundStyle(FriendsInk.muted)
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .friendsCard(accent: Self.lavender, tint: 0.075, line: 0.21)
            } else {
                // Wave 3 (items 9 + 9e): one card per friend, then the All friends list.
                friendCardsBlock(friends, slackers: slackers)
            }
            if let note {
                Text(note).font(Brand.font(12, .heavy)).foregroundStyle(FriendsInk.section)
                    .padding(.horizontal, 2)
            }
        }
    }

    // MARK: Wave 3 — one card per friend, then All friends (items 9 + 9e)

    /// The cards (online friends first, then friends with games waiting on you) and the
    /// collapsible "All friends · N" list. Layout and words: FriendCards (WordociousCore).
    @ViewBuilder
    private func friendCardsBlock(_ friends: [FriendsService.FriendProfile],
                                  slackers: [FriendsService.FriendProfile]) -> some View {
        let now = Date()
        let cardFriends = friends.map { f in
            CardFriend(id: f.id.lowercased(), username: f.username, online: f.isOnline(now: now),
                       activity: f.activity, lastSeenMs: FriendsService.ms(f.lastSeenAt).map { Double($0) })
        }
        let active = FriendlyGamesService.active
        let cardGames = active.map { g in
            CardGame(id: g.id, kind: g.kind, opponentId: g.opponent.id.lowercased(), opponentName: g.opponent.username,
                     me: g.me, state: g.state, yourTurn: g.yourTurn, updatedAt: g.updatedAt)
        }
        let layout = FriendCards.friendsLayout(friends: cardFriends, games: cardGames)
        let byId = Dictionary(active.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        VStack(spacing: 8) {
            ForEach(layout.cards) { c in
                let f = FriendsKit.friend(c.friendId)
                let opp = active.first { $0.opponent.id.lowercased() == c.friendId }?.opponent
                let menu: (() -> Void)? = f.map { fr in { menuFriend = fr } }
                FriendCardView(
                    card: c, friend: f, fallbackOpponent: opp, games: byId,
                    expanded: theirTurnOpen.contains(c.friendId),
                    onOpenGame: { g in openGame = OpenGame(id: g.id, initial: g) },
                    onStartGame: { k in if let f { quickPlay = QuickPlay(friend: f, kind: k) } },
                    onToggleTheirs: { toggleTheirTurn(c.friendId) },
                    onProfile: { profileTarget = f?.id ?? opp?.id ?? c.friendId },
                    onMenu: menu)
            }
            allFriendsBlock(layout.rest, friends: friends, slackers: slackers, openByDefault: layout.cards.isEmpty)
        }
        .confirmationDialog(
            "Resign \(resignTarget?.title ?? "this game")?",
            isPresented: Binding(get: { resignTarget != nil }, set: { if !$0 { resignTarget = nil } }),
            titleVisibility: .visible
        ) {
            Button("Resign", role: .destructive) {
                if let g = resignTarget {
                    Task {
                        _ = await FriendlyGamesService.resign(g.id)
                        await FriendlyGamesService.load()
                    }
                }
                resignTarget = nil
            }
            Button("Keep playing", role: .cancel) { resignTarget = nil }
        } message: {
            Text("Resigning hands \(resignTarget?.opponent.username ?? "them") the win.")
        }
    }

    private func toggleTheirTurn(_ id: String) {
        let change = {
            if theirTurnOpen.contains(id) { theirTurnOpen.remove(id) } else { theirTurnOpen.insert(id) }
        }
        if Theme.reduceMotion { change() } else { withAnimation(.easeInOut(duration: 0.18), change) }
    }

    /// "All friends · N": everyone with no game going who is not on now, A to Z, collapsed
    /// unless nobody else has a card. The "hasn't played today" nudge lives at its top.
    @ViewBuilder
    private func allFriendsBlock(_ rest: [String], friends: [FriendsService.FriendProfile],
                                 slackers: [FriendsService.FriendProfile], openByDefault: Bool) -> some View {
        let restFriends = rest.compactMap { name in friends.first { $0.username == name } }
        let open = allFriendsOpen ?? openByDefault
        if !restFriends.isEmpty || !slackers.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                if !slackers.isEmpty {
                    HStack(spacing: 8) {
                        Text(slackers.count == 1 ? "1 friend hasn't played today" : "\(slackers.count) haven't played today")
                            .font(Brand.font(11, .heavy)).foregroundStyle(FriendsInk.rowSub)
                            .lineLimit(1).minimumScaleFactor(0.8)
                        Spacer(minLength: 6)
                        Button {
                            Task {
                                var n = 0
                                for f in slackers {
                                    let outcome = await FriendsService.taunt(
                                        friendId: f.id, tauntId: "slowpoke",
                                        day: LeaderboardService.todayLocal())
                                    if outcome == .sent { n += 1 }
                                }
                                note = n > 0 ? "Nudged \(n) friend\(n == 1 ? "" : "s")!" : "Everyone already nudged today"
                            }
                        } label: {
                            CandyLabel(title: "Nudge all", symbol: "bell.fill")
                        }
                        .buttonStyle(CastButtonStyle(color: .gold, size: .small, fullWidth: false))
                        .accessibilityLabel("Nudge all who haven't played")
                    }
                    .padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 4)
                }
                if !restFriends.isEmpty {
                    Button {
                        let change = { allFriendsOpen = !open }
                        if Theme.reduceMotion { change() } else { withAnimation(.easeInOut(duration: 0.18), change) }
                    } label: {
                        HStack(spacing: 6) {
                            Text(FriendCards.allFriendsLabel(restFriends.count))
                                .font(Brand.font(12, .black)).foregroundStyle(FriendsInk.lavender)
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold))
                                .foregroundStyle(FriendsInk.lavender)
                                .rotationEffect(.degrees(open ? 180 : 0))
                        }
                        .padding(.horizontal, 12).padding(.vertical, 11)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.squish)
                    .accessibilityLabel(FriendCards.allFriendsLabel(restFriends.count))
                    .accessibilityHint(open ? "Hides the list" : "Shows the list")
                    if open {
                        ForEach(Array(restFriends.enumerated()), id: \.element.id) { i, f in
                            friendRow(f)
                                .friendsStripe(i + 1, accent: Self.lavender)
                        }
                    }
                }
            }
            .friendsCard(accent: Self.lavender, tint: 0.075, line: 0.21)
        }
    }

    private func friendRow(_ f: FriendsService.FriendProfile) -> some View {
        let online = f.isOnline()
        let line = f.presenceLine() ?? FriendsKit.todayLine(f)
        // §225: the WHOLE row is the door to the profile; the candy Button nests
        // inside the label and its tap wins over the link.
        return Button {
            // A long-press release lands here with the menu already open — don't push too.
            guard menuFriend == nil else { return }
            profileTarget = f.id
        } label: {
            // BJ7: one top line — avatar, name + badges and the streak / action all
            // top-aligned; the presence line 4 under the name.
            HStack(alignment: .top, spacing: 10) {
                // Wave 3: their mascot (the shared resolver), the green dot when they are on.
                AvatarView(url: f.avatar_url, username: f.username, size: 38, emoji: f.avatar_emoji,
                           castId: f.avatar_cast_id, frame: f.avatar_frame, userId: f.id, stroke: false)
                    .overlay(alignment: .bottomTrailing) {
                        if online {
                            Circle().fill(FriendsInk.online).frame(width: 11, height: 11)
                                .overlay(Circle().stroke(Color.white, lineWidth: 2)).offset(x: 2, y: 2)
                        }
                    }
                    .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 5) {
                        Text("@\(f.username)").font(Brand.font(14, .black))
                            .foregroundStyle(FriendsInk.heading).lineLimit(1)
                        // §V3: the tier badge + level beside the name.
                        if f.level > 0 { LevelBadge(level: f.level, size: 16) }
                        // §216: the week's leader wears the crown.
                        if f.id == crownId { Icon3D(.crown, size: 15, label: "This week's leader") }
                        if isNewFriend(f) {
                            Text("NEW").font(Brand.font(8, .black))
                                .foregroundStyle(FriendsKit.solid)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .friendsChip(FriendsKit.solid)
                        }
                        // §216: friendversary chip on milestone days.
                        if let days = friendversary(f) {
                            // §AM3: the gold star art, not the party emoji.
                            HStack(spacing: 2) {
                                if ArtAsset.exists("art-badge-icon-star-sprite") {
                                    Image("art-badge-icon-star-sprite").resizable().interpolation(.high).scaledToFit()
                                        .frame(width: 10, height: 10).accessibilityHidden(true)
                                }
                                Text("\(days) DAYS").font(Brand.font(8, .black))
                            }
                                .foregroundStyle(FriendsKit.solid)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .friendsChip(FriendsKit.solid)
                        }
                    }
                    Text(line).font(Brand.font(11, .bold))
                        .foregroundStyle(online ? FriendsKit.green : FriendsInk.rowSub).lineLimit(1)
                }
                Spacer(minLength: 4)
                if let n = f.friendStreak, n > 0 {
                    HStack(spacing: 2) {
                        FlameMark(size: 12)
                        Text("\(n)").softNumber(14, color: Color(hex: 0xC2410C))
                    }
                    .frame(minHeight: 34)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(n)-day friend streak")
                }
                actionPill(f, online: online)
            }
            .padding(.horizontal, 12).padding(.vertical, 7)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        // §225: long-press menu — profile, play, taunt, challenge, gift, unfriend — now the
        // family action menu (founder 10-05: no plain-text menus). The release after the hold
        // finds the menu open, so the row's push doesn't also fire.
        .simultaneousGesture(LongPressGesture(minimumDuration: 0.45).onEnded { _ in
            Feedback.press(true)
            menuFriend = f
        })
        .accessibilityAction(named: "More actions") { menuFriend = f }
    }

    /// The friend row's long-press menu (the old context menu's rows, in order).
    private func friendMenuModel(_ f: FriendsService.FriendProfile) -> FamilyActionMenuModel {
        var rows: [FamilyMenuAction] = [
            FamilyMenuAction(id: "profile", title: "View profile", icon: .clay("eye")) { profileTarget = f.id },
            FamilyMenuAction(id: "play", title: "Play a game", icon: .clay("play"), tint: FamilyMenuInk.pink) {
                // Friend first: pick a game tile next, then straight into it.
                quickPlay = QuickPlay(friend: f, kind: nil)
            },
            FamilyMenuAction(id: "taunt", title: "Taunt", icon: .art("icon3d-bell"), tint: FamilyMenuInk.amber,
                             accessibility: "Taunt \(f.username)") { tauntTarget = f },
            // §289: a private Classic VS Battle, pushed to them.
            FamilyMenuAction(id: "challenge", title: "Challenge", icon: .art("art-badge-swords"),
                             disabled: challenging != nil,
                             accessibility: "Challenge \(f.username) to a VS Battle") { challenge(f) },
        ]
        // D3.4 (§294): gift one of your streak shields — only when you hold one.
        if (AuthService.shared.profile?.streakShields ?? 0) > 0 {
            rows.append(FamilyMenuAction(id: "gift", title: "Gift a shield", icon: .art("icon3d-shield"),
                                         tint: FamilyMenuInk.teal, disabled: gifting != nil) { giftShield(f) })
        }
        // Wave 3: Resign / Decline lives here (not inside the game): one row per game going with them.
        for g in FriendlyGamesService.active where g.opponent.id.caseInsensitiveCompare(f.id) == .orderedSame {
            rows.append(FamilyMenuAction(id: "resign-\(g.id)", title: "Resign \(g.title)", icon: .clay("flag"), danger: true,
                                         accessibility: "Resign \(g.title) against \(f.username)") { resignTarget = g })
        }
        rows.append(FamilyMenuAction(id: "unfriend", title: "Unfriend", icon: .clay("xmark"), danger: true,
                                     accessibility: "Unfriend \(f.username)") { unfriendTarget = f })
        return FamilyActionMenuModel(
            title: f.username, subtitle: f.presenceLine() ?? FriendsKit.todayLine(f),
            avatar: AnyView(AvatarView(url: f.avatar_url, username: f.username, size: 44, emoji: f.avatar_emoji,
                                       castId: f.avatar_cast_id, frame: f.avatar_frame, userId: f.id, stroke: false)),
            actions: rows)
    }

    /// On now → Play (quick-play sheet); played today → Challenge (the free
    /// live VS challenge); hasn't played → Nudge (the taunt picker).
    /// §C4 / §A8: chunky small candy buttons — Play / Challenge purple, Nudge amber.
    @ViewBuilder private func actionPill(_ f: FriendsService.FriendProfile, online: Bool) -> some View {
        if online {
            Button { quickPlay = QuickPlay(friend: f, kind: nil) } label: { CandyLabel(title: "Play") }
                .buttonStyle(CastButtonStyle(color: .pink, size: .small, fullWidth: false))
                .accessibilityLabel("Play with \(f.username)")
        } else if (f.playedToday ?? 0) > 0 {
            Button { challenge(f) } label: {
                CandyLabel(title: challenging == f.id ? "Sending…" : "Challenge")
            }
            .buttonStyle(CastButtonStyle(color: .pink, size: .small, fullWidth: false))
            .disabled(challenging != nil)
            .accessibilityLabel("Challenge \(f.username) to a VS Battle")
        } else {
            Button { tauntTarget = f } label: { CandyLabel(title: "Nudge") }
                .buttonStyle(CastButtonStyle(color: .gold, size: .small, fullWidth: false))
                .accessibilityLabel("Nudge \(f.username)")
        }
    }

    // MARK: Add by username (§2.9)

    private var addFriendSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            FriendsSectionHeader(title: "ADD A FRIEND")
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    TextField("Add by username", text: $username)
                        .font(Brand.font(13, .bold))
                        .foregroundStyle(FriendsInk.heading)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($fieldFocused)
                        .padding(.horizontal, 12).frame(height: 40)
                        // BI23: a soft filled field (no outline); focus deepens the fill.
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Self.lavender.wash(fieldFocused ? 0.22 : 0.14)))
                        .onSubmit { add() }
                    Button(action: add) {
                        CandyLabel(title: "Add") { Icon3D(.addFriend, size: 16) } // ART_SPEC §5
                    }
                    .buttonStyle(CastButtonStyle(color: .pink, size: .small, fullWidth: false))
                    .disabled(sending || username.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityLabel("Add friend")
                }
                // Typeahead results — tap sends to that exact account (by id).
                if !suggestions.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(suggestions.enumerated()), id: \.element.id) { i, u in
                            Button {
                                guard !sending else { return }
                                sending = true
                                suggestions = []
                                Task {
                                    let outcome = await FriendsService.request(addresseeId: u.id)
                                    switch outcome {
                                    case .accepted:
                                        username = ""
                                        newFriend = NewFriend(id: u.id, name: u.username, avatar: u.avatar_url, emoji: u.avatar_emoji)
                                    case .pending: sentRequestTo = u.username; username = ""
                                    case .failed(let msg): addNote = msg
                                    }
                                    sending = false
                                }
                            } label: {
                                HStack(spacing: 10) {
                                    AvatarView(url: u.avatar_url, username: u.username, size: 30, emoji: u.avatar_emoji)
                                    Text(u.username).font(Brand.font(13, .black))
                                        .foregroundStyle(FriendsInk.heading).lineLimit(1)
                                    Spacer()
                                    LevelBadge(level: u.level, size: 18) // §V3
                                    Icon3D(.addFriend, size: 18) // ART_SPEC §5
                                }
                                .padding(.horizontal, 10).padding(.vertical, 8)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.squish)
                            .friendsStripe(i, accent: Self.lavender)
                        }
                    }
                    .friendsCard(accent: Self.lavender, radius: 14, tint: 0.05, line: 0.22)
                }
                // §225/§289: the invite link (a Pro player's open referral first).
                if AuthService.shared.profile != nil {
                    Button { shareInviteLink() } label: {
                        CandyLabel(title: "Share invite link") { Icon3D(.share, size: 16) }
                    }
                    .buttonStyle(CastButtonStyle(color: .pink, size: .small, fullWidth: false))
                    .disabled(resolvingShare)
                }
                if let addNote {
                    Text(addNote).font(Brand.font(12, .heavy)).foregroundStyle(FriendsInk.section)
                }
                // §T1: the request is out — INVITE SENT! with the name on a glossy pill.
                if let sent = sentRequestTo {
                    FriendsInviteSentCard(
                        name: sent, line: "It waits in INVITES until they accept.",
                        onSendAnother: { sentRequestTo = nil; fieldFocused = true },
                        onDone: { sentRequestTo = nil })
                }
            }
            .padding(12)
            .friendsCard(accent: Self.lavender, tint: 0.075, line: 0.21)
        }
    }

    // MARK: INVITES (§2.3 — the existing card, restyled)

    /// Requests in flight (incoming + sent). Renders only when something is pending.
    /// §C4: the same lavender card family, striped rows, candy actions.
    @ViewBuilder private var invitesCard: some View {
        let incoming = FriendsService.incoming
        let outgoing = FriendsService.outgoingProfiles
        VStack(alignment: .leading, spacing: 6) {
            FriendsSectionHeader(title: "INVITES") {
                // §M: incoming requests are what's waiting on you — the candy badge;
                // with only sent requests, a quiet count.
                if !incoming.isEmpty {
                    CandyCountBadge(count: incoming.count, size: 18)
                        .accessibilityElement().accessibilityLabel("\(incoming.count) new \(incoming.count == 1 ? "request" : "requests")")
                } else {
                    Text("\(outgoing.count)").font(Brand.font(11, .black)).monospacedDigit()
                        .foregroundStyle(FriendsInk.section)
                }
            }
            VStack(alignment: .leading, spacing: 0) {
                // Incoming requests first — they're the actionable part.
                if !incoming.isEmpty {
                    FriendsLabel("Friend requests", color: FriendsInk.lavender)
                        .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 4)
                    ForEach(Array(incoming.enumerated()), id: \.element.id) { i, r in
                        HStack(spacing: 10) {
                            AvatarView(url: r.avatar_url, username: r.username, size: 36, emoji: r.avatar_emoji)
                                // §M: each waiting request wears the small candy badge.
                                .overlay(alignment: .topTrailing) { CandyCountBadge(count: 1, size: 16).offset(x: 6, y: -6) }
                            NavigationLink(value: r.id) {
                                Text("@\(r.username)").font(Brand.font(14, .black))
                                    .foregroundStyle(FriendsInk.heading).lineLimit(1)
                            }.buttonStyle(.squish)
                            Spacer()
                            // §T2: Accept is the green (teal) candy; §T3 a yes shows NEW FRIENDS!.
                            Button {
                                Task {
                                    if await FriendsService.accept(requesterId: r.id) {
                                        newFriend = NewFriend(id: r.id, name: r.username, avatar: r.avatar_url, emoji: r.avatar_emoji)
                                    }
                                }
                            } label: {
                                CandyLabel(title: "Accept", symbol: "checkmark")
                            }
                            .buttonStyle(CastButtonStyle(color: .teal, size: .small, fullWidth: false))
                            Button { Task { await FriendsService.decline(requesterId: r.id) } } label: {
                                Image(systemName: "xmark").font(.system(size: 12, weight: .black))
                                    .foregroundStyle(FinishInk.softNumber)
                            }
                            .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false, circle: true))
                            .accessibilityLabel("Decline \(r.username)")
                        }
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .friendsStripe(i, accent: Self.lavender)
                    }
                }

                // Sent requests — the loop's missing feedback (Tier 1, Aug 11).
                if !outgoing.isEmpty {
                    FriendsLabel("Sent — waiting", color: FriendsInk.lavender)
                        .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 4)
                    ForEach(Array(outgoing.enumerated()), id: \.element.id) { i, r in
                        HStack(alignment: .top, spacing: 8) {
                            AvatarView(url: r.avatar_url, username: r.username, size: 36, emoji: r.avatar_emoji)
                            NavigationLink(value: r.id) {
                                VStack(alignment: .leading, spacing: 4) {
                                    (Text("@\(r.username)").font(Brand.font(14, .black)).foregroundColor(FriendsInk.heading)
                                        + Text("  · \(agoShort(r.requestedAt))").font(Brand.font(10, .bold)).foregroundColor(FriendsInk.rowSub))
                                        .lineLimit(1).minimumScaleFactor(0.8)
                                    // §T1: a request-pending row wears a small glossy "Pending" pill.
                                    FriendsGlossyPill(text: "Pending", accent: FriendsInk.amber, size: 9)
                                }
                            }.buttonStyle(.squish)
                            Spacer(minLength: 4)
                            // §212: the invite usually died unseen — re-push, 1/24h.
                            Button {
                                Task {
                                    switch await FriendsService.remind(addresseeId: r.id) {
                                    case .reminded: inviteNote = "Reminder sent to \(r.username)!"
                                    case .already: inviteNote = "Already reminded today"
                                    case .failed: inviteNote = "Could not remind"
                                    }
                                }
                            } label: {
                                CandyLabel(title: withinDay(r.remindedAt) ? "Reminded" : "Remind")
                            }
                            .buttonStyle(CastButtonStyle(color: .pink, size: .small, fullWidth: false))
                            .disabled(withinDay(r.remindedAt))
                            Button { Task { await FriendsService.decline(requesterId: r.id) } } label: {
                                CandyLabel(title: "Cancel")
                            }
                            .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                        }
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .friendsStripe(i, accent: Self.lavender)
                    }
                }

                if let inviteNote {
                    // Transient confirmation — clears itself after 2.5 s (tap dismisses).
                    Text(inviteNote).font(Brand.font(12, .heavy)).foregroundStyle(FriendsInk.section)
                        .padding(.horizontal, 12).padding(.top, 6)
                        .onTapGesture { self.inviteNote = nil }
                        .task(id: inviteNote) {
                            try? await Task.sleep(nanoseconds: 2_500_000_000)
                            if !Task.isCancelled { self.inviteNote = nil }
                        }
                }
                Color.clear.frame(height: 4)
            }
            .friendsCard(accent: Self.lavender, tint: 0.075, line: 0.21)
        }
    }

    /// Taunt picker — the leaderboard sheet's twin (§207 fixed phrases).
    /// §A1 / §A8: tinted rows that squish, a quiet peach Cancel.
    private func tauntSheet(_ target: FriendsService.FriendProfile) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                // BJ16: the NUDGE! lettering; who rides under it.
                VStack(alignment: .leading, spacing: 0) {
                    HeadingArtView(.nudge, height: 30, maxWidth: 140, label: "Nudge \(target.username)", alignment: .leading)
                    FriendsLabel("@\(target.username)", color: FriendsInk.section).accessibilityHidden(true)
                }
                Spacer(minLength: 0)
                // §A7: a secondary spot — R, not the page host O1.
                PoseImage(.r, "wake", height: 44)
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 8)
            if let status = tauntStatus {
                // §BI9: the taunt result as the shared candy message (coin + pop).
                G5CandyMessage(text: status, tone: status == "Sent!" ? .success : (status.hasPrefix("Could not") ? .error : .warn))
                    .frame(maxWidth: .infinity).padding(.vertical, 32)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(FriendTaunts.all.enumerated()), id: \.element.id) { i, taunt in
                        Button {
                            Task {
                                let outcome = await FriendsService.taunt(
                                    friendId: target.id, tauntId: taunt.id,
                                    day: LeaderboardService.todayLocal())
                                switch outcome {
                                case .sent: tauntStatus = "Sent!"
                                case .alreadySent: tauntStatus = "Already taunted them today"
                                case .failed: tauntStatus = "Could not send"
                                }
                                try? await Task.sleep(nanoseconds: 1_400_000_000)
                                tauntTarget = nil
                                tauntStatus = nil
                            }
                        } label: {
                            Text(taunt.text).font(Brand.font(13, .heavy)).foregroundStyle(FriendsInk.heading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 14).padding(.vertical, 12)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.squish)
                        .friendsStripe(i, accent: FriendsInk.pink)
                    }
                }
                .friendsCard(accent: FriendsInk.pink, radius: 16)
                .padding(.horizontal, 16)
                Button { tauntTarget = nil } label: { CandyLabel(title: "Cancel") }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium, fullWidth: true))
                    .padding(.horizontal, 16).padding(.top, 12)
            }
            Spacer(minLength: 0)
        }
        .background(Color(hex: 0xFFF0F7).ignoresSafeArea())
        .presentationDetents([.medium])
    }

    struct RaceEntry {
        let id: String; let username: String; let avatarUrl: String?
        let avatarEmoji: String?; let pts: Int; let isMe: Bool
    }

    /// Me + friends by this week's daily points, best first (§212/§238).
    private var standings: [RaceEntry] {
        let friends = FriendsService.friends
        guard !friends.isEmpty else { return [] }
        var entries = friends.map {
            RaceEntry(id: $0.id, username: $0.username, avatarUrl: $0.avatar_url,
                        avatarEmoji: $0.avatar_emoji, pts: $0.weekPoints ?? 0, isMe: false)
        }
        if let p = AuthService.shared.profile {
            entries.append(RaceEntry(id: p.id, username: "You", avatarUrl: p.avatarUrl,
                                       avatarEmoji: p.avatarEmoji,
                                       pts: FriendsService.meDigest?.weekPoints ?? 0, isMe: true))
        }
        entries.sort { $0.pts > $1.pts }
        // Always on (§216): a Monday-morning zero-point podium still shows
        // the race — medals wait for the first score (see raceStarted).
        return entries
    }

    /// §238 (founder: "see the rankings of 4th, 5th, 6th"): the podium keeps
    /// its three medals; everyone else gets a ranked row beneath it.
    private var podium: [RaceEntry] { Array(standings.prefix(3)) }

    private var raceStarted: Bool { standings.contains { $0.pts > 0 } }

    /// §232: Monday's question — "who won last week?" — answered in place.
    /// lastWeekPoints is the settled previous week (Mon–Sun) from the digest;
    /// nil (line hidden) when nobody scored.
    private var lastWeekWinner: (name: String, pts: Int)? {
        var entries = FriendsService.friends.map { (name: $0.username, pts: $0.lastWeekPoints ?? 0) }
        if AuthService.shared.profile != nil {
            entries.append((name: "You", pts: FriendsService.meDigest?.lastWeekPoints ?? 0))
        }
        entries.sort { $0.pts > $1.pts }
        guard let top = entries.first, top.pts > 0 else { return nil }
        return top
    }

    /// §238: winner per settled week — k indexes pastWeekPoints (0 = last
    /// week, 1 = two weeks ago …); weeks nobody scored in are dropped.
    private var pastWeeks: [(k: Int, name: String, pts: Int)] {
        let meArr = FriendsService.meDigest?.pastWeekPoints ?? []
        let len = max(meArr.count, FriendsService.friends.map { $0.pastWeekPoints?.count ?? 0 }.max() ?? 0)
        var out: [(k: Int, name: String, pts: Int)] = []
        for k in 0..<len {
            var entries = FriendsService.friends.map { f in
                (name: f.username, pts: (f.pastWeekPoints?.indices.contains(k) == true) ? f.pastWeekPoints![k] : 0)
            }
            if AuthService.shared.profile != nil {
                entries.append((name: "You", pts: k < meArr.count ? meArr[k] : 0))
            }
            entries.sort { $0.pts > $1.pts }
            if let top = entries.first, top.pts > 0 { out.append((k: k, name: top.name, pts: top.pts)) }
        }
        return out
    }

    /// §238: "Aug 10–16" — the local Mon–Sun range k+1 Mondays back (same
    /// local week boundary as weekStart everywhere else).
    private static func pastWeekLabel(_ k: Int) -> String {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let dow = (cal.component(.weekday, from: today) + 5) % 7 // 0 Mon … 6 Sun
        guard let mon = cal.date(byAdding: .day, value: -dow - 7 * (k + 1), to: today),
              let sun = cal.date(byAdding: .day, value: 6, to: mon) else { return "" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d"
        return "\(f.string(from: mon))–\(f.string(from: sun))"
    }

    /// §238: 4th/5th/…/21st/22nd — the ranked rows under the podium.
    private static func ordinal(_ n: Int) -> String {
        let v = n % 100
        if (11...13).contains(v) { return "\(n)th" }
        switch n % 10 {
        case 1: return "\(n)st"; case 2: return "\(n)nd"; case 3: return "\(n)rd"
        default: return "\(n)th"
        }
    }

    /// §218/§226: when the weekly race closes — weeks run Mon–Sun, reset
    /// Monday 00:00 local (same boundary as weekStart in the friends digest).
    /// Live clock (founder: a static "4d" carried no urgency) — the Text is
    /// driven by a TimelineView so it ticks like the daily countdown.
    static func weekEndsLabel(at now: Date) -> String {
        let cal = Calendar.current
        let dow = cal.component(.weekday, from: now) // 1 Sun … 7 Sat
        let daysToMonday = dow == 1 ? 1 : 9 - dow // Mon→7 … Sat→2, Sun→1
        let end = cal.startOfDay(for: cal.date(byAdding: .day, value: daysToMonday, to: now)!)
        let secs = max(0, Int(end.timeIntervalSince(now)))
        let d = secs / 86400
        let clock = String(format: "%02d:%02d:%02d", (secs % 86400) / 3600, (secs % 3600) / 60, secs % 60)
        return d >= 1 ? "ends Sunday · \(d)d \(clock)" : "ends tonight · \(clock)"
    }

    /// §216: the week's leader wears the crown — only once someone scored.
    private var crownId: String? { raceStarted ? podium.first?.id : nil }

    /// §216: friendversary chip on milestone days.
    private func friendversary(_ f: FriendsService.FriendProfile) -> Int? {
        guard let since = f.since, let date = parseISO(since) else { return nil }
        let days = Int(Date().timeIntervalSince(date) / 86_400)
        return [7, 30, 100, 365].contains(days) ? days : nil
    }

    /// "2d" / "5h" / "now" — how long a sent invite has been waiting (§212).
    private func agoShort(_ iso: String?) -> String {
        guard let iso, let date = parseISO(iso) else { return "" }
        let h = Int(Date().timeIntervalSince(date) / 3600)
        if h < 1 { return "now" }
        if h < 24 { return "\(h)h" }
        return "\(h / 24)d"
    }

    private func withinDay(_ iso: String?) -> Bool {
        guard let iso, let date = parseISO(iso) else { return false }
        return Date().timeIntervalSince(date) < 24 * 3600
    }

    private func parseISO(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    /// Accepted within the last 24h — wears the NEW chip (Tier 2, Aug 11).
    private func isNewFriend(_ f: FriendsService.FriendProfile) -> Bool {
        guard let since = f.since else { return false }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: since) ?? ISO8601DateFormatter().date(from: since)
        guard let date else { return false }
        return Date().timeIntervalSince(date) < 24 * 60 * 60
    }

    /// §289: Challenge = a private Classic VS Battle. The server inserts a
    /// targeted invite and pushes it to the friend; we note it and drop into
    /// the same lobby with the code. Free for friends (the code bypasses the
    /// Pro gate on both ends). Web twin: todays-race.tsx challenge().
    private func challenge(_ f: FriendsService.FriendProfile) {
        guard challenging == nil else { return }
        challenging = f.id
        Task {
            let result = await FriendsService.challenge(friendId: f.id, gameMode: "DUEL")
            challenging = nil
            switch result {
            case .success(let inv):
                note = "Challenge sent to \(f.username)!"
                challengeMatch = ChallengeMatch(mode: GameMode(rawValue: inv.gameMode) ?? .duel, code: inv.code)
            case .failure(let error):
                note = error.localizedDescription
            }
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            note = nil
        }
    }

    /// D3.3 (§294): "Last week you finished 2nd of 6 · 1,240 pts · Doug won
    /// with 1,900" — gold with a crown when you won (§AM3: 3D art, no emoji). Same copy and colors as the
    /// web banner (friends-panel.tsx).
    private func lastWeekBanner(_ r: FriendsService.LastWeek) -> some View {
        let win = r.rank == 1
        let ink = win ? Color(hex: 0x92400E) : FriendsInk.heading
        var line = Text("Last week you finished ").font(Brand.font(11, .heavy)).foregroundColor(ink)
            + Text("\(WeeklyRace.ordinal(r.rank)) of \(r.circleSize)").font(Brand.font(11, .black)).foregroundColor(ink)
            + Text(" · \(r.points.formatted()) pts").font(Brand.font(11, .heavy)).foregroundColor(ink)
        if !win, let name = r.winnerName {
            line = line + Text(" · \(name) won with \(r.winnerPoints.formatted())").font(Brand.font(11, .heavy)).foregroundColor(FriendsInk.muted)
        }
        return HStack(spacing: 8) {
            if win { Icon3D(.crown, size: 20) }
            else if r.rank == 2 || r.rank == 3 { MedalArt(kind: r.rank == 2 ? "silver" : "bronze", size: 20) }
            else { SymbolGlyph("flag.checkered", size: 15, weight: .bold, color: FriendsInk.goldAccent).accessibilityHidden(true) }
            line.frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        // §A1: tinted, never plain — gold when you won, a soft gold wash otherwise.
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(
                win
                    ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xFEF3C7), Color(hex: 0xFDE68A)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    : AnyShapeStyle(FriendsInk.goldAccent.wash(0.13))))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
            .stroke(win ? Color(hex: 0xF59E0B) : FriendsInk.goldAccent.wash(0.34), lineWidth: 1.5))
        .padding(.vertical, 2)
    }

    /// D3.4 (§294): send a friend one of your streak shields. The server owns
    /// the once-per-week rule and the transfer; we note the outcome and
    /// refresh the profile so the shield count (and the menu item) update.
    private func giftShield(_ f: FriendsService.FriendProfile) {
        guard gifting == nil else { return }
        gifting = f.id
        Task {
            let result = await FriendsService.giftShield(friendId: f.id)
            gifting = nil
            switch result {
            case .success(let left):
                note = "Shield sent to \(f.username) · \(left) left"
                await AuthService.shared.refreshProfile()
            case .failure(let error):
                note = error.localizedDescription
            }
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            note = nil
        }
    }

    /// §289: the invite link. A Pro player's newest OPEN referral (pending,
    /// unexpired — the same PostgREST read InvitePanelView does) shares
    /// /join/<code> with the 7-days-of-Pro line; else the profile link.
    private func shareInviteLink() {
        guard !resolvingShare, let p = AuthService.shared.profile else { return }
        resolvingShare = true
        Task {
            var text = "Add me on Wordocious — I'm \(p.username)"
            var url = URL(string: "https://wordocious.com/profile/\(p.id)")
            if AuthService.shared.isProActive {
                struct OpenReferral: Decodable { let code: String }
                let rows: [OpenReferral]? = try? await AuthService.shared.client.from("referrals")
                    .select("code")
                    .eq("inviter_id", value: p.id)
                    .eq("status", value: "pending")
                    .gt("expires_at", value: ISO8601DateFormatter().string(from: Date()))
                    .order("created_at", ascending: false)
                    .limit(1)
                    .execute().value
                if let code = rows?.first?.code, let joinUrl = URL(string: "https://wordocious.com/join/\(code)") {
                    url = joinUrl
                    text = "I'm gifting you 7 days of Wordocious Pro — add me once you're in: \(p.username)"
                }
            }
            resolvingShare = false
            if let url { shareInvite = ShareInvite(text: text, url: url) }
        }
    }

    private func add() {
        let name = username.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, !sending else { return }
        sending = true
        fieldFocused = false
        Task {
            let outcome = await FriendsService.request(username: name)
            switch outcome {
            case .accepted:
                username = ""
                let f = FriendsService.friends.first { $0.username.caseInsensitiveCompare(name) == .orderedSame }
                newFriend = NewFriend(id: f?.id, name: f?.username ?? name, avatar: f?.avatar_url, emoji: f?.avatar_emoji)
            case .pending: sentRequestTo = name; username = ""
            case .failed(let msg): addNote = msg
            }
            sending = false
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            addNote = nil
        }
    }
}



/// FRIENDS — the Friends tab (D1, 2026-09-26) and the dedicated friends
/// screen pushed from the profile / presented from the empty Friends board.
/// Founder (2026-10-02): the TAB never loses the shared app header — `asTab` pins
/// AppHeaderView above the scroll exactly like Home, Leaderboard, Stats and Records.
/// FINISH_SPEC §C4b: nothing sits beside the FRIENDS title any more — the bell
/// (notification prefs) moved to Settings → Notifications and "Add a friend" is a
/// candy button in the "Your friends" header — so the title is a centered §A6
/// headline, edge to edge on the wallpaper. Pushed / sheet copies show the same
/// headline under their nav bar (back / swipe to close).
struct FriendsScreenView: View {
    // §218: pushed views don't inherit the root's safeAreaInset, so pad by the
    // reported chrome height (the tab root needs it too — see RootTabView).
    var padsForChrome = true
    var asTab = false
    @ObservedObject private var chrome = ChromeVisibility.shared
    @ObservedObject private var auth = AuthService.shared
    @State private var focusAdd: UUID?
    @State private var showAuth = false
    /// 2.8 item 14: scroll-driven header fade + condense (the tab form only).
    @StateObject private var headerScroll = HeaderScrollModel()

    /// The scroll's horizontal padding (the headline bleeds past it to the edges).
    private static let sidePadding: CGFloat = 16

    var body: some View {
        ScrollViewReader { proxy in
            if asTab {
                VStack(spacing: 0) {
                    AppHeaderView(scroll: headerScroll)
                    // §241: a returning player never sees the pitch during the launch restore.
                    if auth.isAuthenticated || (auth.isLoading && AuthService.hadPersistedSession) {
                        scroll(proxy)
                    } else {
                        // FINISH_SPEC BI23: O1 hosts the signed-out pitch (web / Android parity),
                        // centered BELOW the pinned header.
                        // The FRIENDS title art stays on top; O1 + I (the add-friends host) as a duo.
                        PageHeadline(.friends, bleed: Self.sidePadding)
                            .padding(.horizontal, Self.sidePadding).padding(.top, 6)
                        GuestPitch(hosts: [Mascots.friends, Mascots.addFriends], title: "Play with friends", heading: .playwithfriends,
                                   subtitle: "Sign in to add friends, race them every day and play pocket games together.",
                                   colors: [Color(hex: 0xDB2777), Color(hex: 0xF97316)],
                                   preview: .none, onSignIn: { showAuth = true })
                            .softSheet(isPresented: $showAuth) { AuthView() }
                    }
                }
                .frame(maxHeight: .infinity, alignment: .top)
                .pageBackground(.friends, lightOnly: true)
                // navigationTitle stays for the next push's back label.
                .navigationTitle("Friends")
                .toolbar(.hidden, for: .navigationBar)
            } else {
                scroll(proxy)
                    .pageBackground(.friends, lightOnly: true)
                    // navigationTitle stays for the next push's back label; the
                    // headline in the scroll is the visible title.
                    .navigationTitle("Friends")
                    .navigationBarTitleDisplayMode(.inline)
                    // §10 (founder, iOS 220): the pinned header is opaque page color —
                    // the list never shows through it.
                    .toolbarBackground(PageTint.friends.barColor, for: .navigationBar)
                    .toolbarBackground(.visible, for: .navigationBar)
                    .toolbar {
                        ToolbarItem(placement: .principal) {
                            Color.clear.frame(width: 1, height: 1).accessibilityHidden(true)
                        }
                    }
            }
        }
    }

    private func scroll(_ proxy: ScrollViewProxy) -> some View {
        ScrollView {
            VStack(spacing: 14) {
                // §A6 / §C4b: the whole-cast FRIENDS title art as a centered headline.
                PageHeadline(.friends, bleed: Self.sidePadding)
                FriendsPanelView(focusAdd: focusAdd, onAddFriend: { addFriend(proxy) })
                // §212: recruiting and friending are the same motion — the
                // gift-Pro panel lives here too.
                InvitePanelView()
            }
            .padding(.horizontal, Self.sidePadding).padding(.top, 6)
            .padding(.bottom, 16 + (padsForChrome ? chrome.bottomInset : 0))
            .background(alignment: .top) { HeaderScrollProbe() }   // 2.8 item 14
        }
        .reportsScrollMotion()   // §AQ2
        .headerScrollFade(headerScroll)   // 2.8 item 14
    }

    /// What the old header add-friend circle did: scroll to Add by username and
    /// focus the field.
    private func addFriend(_ proxy: ScrollViewProxy) {
        if Theme.reduceMotion {
            proxy.scrollTo("add-friend", anchor: .center)
        } else {
            withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo("add-friend", anchor: .center) }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { focusAdd = UUID() }
    }
}


/// Compact "FRIENDS (N) →" row for the profile page — the door to
/// FriendsScreenView, wearing the pending-request badge.
struct FriendsRowLink: View {
    @State private var version = 0
    var body: some View {
        let _ = version
        let count = FriendsService.friends.count
        let pending = FriendsService.incoming.count
        NavigationLink { FriendsScreenView() } label: {
            HStack(spacing: 10) {
                Image(systemName: "person.2.fill").font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color(hex: 0x7C3AED))
                Text("FRIENDS")
                    .font(Brand.font(16, .black)).tracking(0.3)
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                if count > 0 {
                    Text("\(count)").softNumber(15)
                }
                if pending > 0 {
                    // Spelled out (web/Android parity) — a bare number here
                    // could read as the friend count sitting beside it.
                    Text(pending == 1 ? "1 request" : "\(pending) requests")
                        .font(Brand.font(10, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Capsule().fill(Color(hex: 0xDC2626)))
                }
                Spacer()
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .contentShape(Rectangle())
            // §A1: a tinted lavender card, never plain white.
            .tintedCard(accent: Color(hex: 0x7C3AED), bar: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], barHeight: 6)
        }
        .buttonStyle(.squish)
        .task { await FriendsService.load() }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            version = FriendsService.version
        }
    }
}
