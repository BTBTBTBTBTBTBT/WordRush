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
    /// The header's add-friend icon: a fresh id focuses the username field.
    var focusAdd: UUID? = nil

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
    struct QuickPlay: Identifiable { let id = UUID(); let friend: FriendsService.FriendProfile?; let kind: FriendlyKind }
    struct OpenGame: Identifiable { let id: String; let initial: FriendlyGameView? }
    @State private var quickPlay: QuickPlay?
    @State private var openGame: OpenGame?
    @State private var showRace = false
    @State private var raceRunFriend: String?
    @State private var showPro = false
    @State private var gamesVersion = 0

    var body: some View {
        let _ = version
        let _ = gamesVersion
        let friends = FriendsService.friends
        let incoming = FriendsService.incoming
        let outgoing = FriendsService.outgoingProfiles

        VStack(alignment: .leading, spacing: 18) {
            if let p = AuthService.shared.profile {
                FriendsBannerView(friends: friends, me: p, meDigest: FriendsService.meDigest,
                                  onFace: { quickPlay = QuickPlay(friend: $0, kind: .rps) },
                                  onRace: { showRace = true })
            }
            if !FriendlyGamesService.active.isEmpty {
                yourTurnSection
            }
            if AuthService.shared.profile != nil {
                playWithFriendsSection
            }
            if !podium.isEmpty {
                weeklyRaceSection
            }
            yourFriendsSection(friends, incoming: incoming, outgoing: outgoing)
            // §10 (founder, iOS 220): INVITES sits directly under YOUR FRIENDS.
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
        .sheet(item: $tauntTarget) { target in tauntSheet(target) }
        .sheet(item: $shareInvite) { item in ActivityShareSheet(text: item.text, url: item.url) }
        .sheet(item: $quickPlay) { q in
            FriendsQuickPlaySheet(
                friend: q.friend, kind: q.kind,
                onStarted: { g in after { openGame = OpenGame(id: g.id, initial: g) } },
                onVSBattle: { f in after { challenge(f) } },
                onRaceMyRun: { f in after { if AuthService.shared.isProActive { raceRunFriend = f.id } else { showPro = true } } })
        }
        .sheet(isPresented: $showRace) { todaysRaceSheet }
        .sheet(isPresented: $showPro) { ProView() }
        .fullScreenCover(item: $openGame, onDismiss: { Task { await FriendlyGamesService.load() } }) { g in
            FriendlyGameScreen(gameId: g.id, initial: g.initial)
        }
        // §289: the challenger lands in the private lobby with the code —
        // the same VSGameView(mode:inviteCode:) cover a pending-invite accept
        // and the /vs/join universal link use (RootTabView, VSLobbyView).
        .fullScreenCover(item: $challengeMatch) { m in
            NavigationStack { VSGameView(mode: m.mode, inviteCode: m.code) }
        }
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
                        TodaysRaceCard(
                            friends: FriendsService.friends, me: p, meDigest: FriendsService.meDigest,
                            challenging: challenging,
                            onTaunt: { f in showRace = false; after { tauntTarget = f } },
                            onChallenge: { f in showRace = false; after { challenge(f) } })
                            .padding(12).vsCard(radius: 14)
                    }
                }
                .padding(16)
            }
            .background(FriendsKit.page.ignoresSafeArea())
            .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    HeaderCircleButton(.symbol("xmark"), size: 32, label: "Done") { showRace = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: YOUR TURN (§2.4)

    private var yourTurnSection: some View {
        let games = FriendlyGamesService.active
        let mine = games.filter(\.yourTurn).count
        return VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: "YOUR TURN") {
                if mine > 0 {
                    Text("\(mine)").font(Brand.font(11, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 8).frame(height: 20)
                        .background(Capsule().fill(FriendsKit.solid))
                }
            }
            VStack(spacing: 8) {
                ForEach(games) { g in
                    Button { openGame = OpenGame(id: g.id, initial: g) } label: {
                        HStack(spacing: 12) {
                            FriendlyGameIcon(kind: g.kind, size: 40)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(g.title) vs @\(g.opponent.username)").font(Brand.font(13, .black))
                                    .foregroundStyle(Color(hex: 0x111827)).lineLimit(1).minimumScaleFactor(0.8)
                                Text(g.line).font(Brand.font(11, .heavy)).foregroundStyle(FriendsKit.solid).lineLimit(1)
                            }
                            Spacer(minLength: 6)
                            if g.yourTurn { FriendsPill(title: "PLAY") } else { FriendsPill(title: "WAITING", solid: false) }
                        }
                        .padding(12)
                        .vsCard(radius: 14)
                    }
                    .buttonStyle(PressableStyle())
                }
            }
        }
    }

    // MARK: PLAY WITH FRIENDS (§2.5)

    private var playWithFriendsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: "PLAY WITH FRIENDS") {
                Text("TAP A GAME, PICK A FRIEND").font(Brand.font(9.5, .black)).tracking(0.8)
                    .foregroundStyle(FriendsKit.solid).lineLimit(1).minimumScaleFactor(0.7)
            }
            // §9: six games, 3 across × 2 rows.
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(FriendlyKind.allCases) { k in
                    Button { quickPlay = QuickPlay(friend: nil, kind: k) } label: {
                        // The home mode card's tile (docs/GAME_TILE_STYLE.md): the game's
                        // color as a soft background, the bar on top, the icon in the accent.
                        GameTileCard(accent: FriendsKit.color(k), title: k.title, sub: FriendsKit.sub(k),
                                     titleLines: 2, minHeight: 128, light: true) {
                            FriendlyGameIcon(kind: k, size: 32, tinted: true)
                        }
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("\(k.title), \(FriendsKit.sub(k))")
                }
            }
        }
    }

    // MARK: THIS WEEK'S RACE (§2.6 — the weekly podium, restyled)

    private var weeklyRaceSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: "THIS WEEK'S RACE") {
                // §218: name the window and when it closes; §226 live clock.
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    Text(FriendsPanelView.weekEndsLabel(at: ctx.date).uppercased())
                        .font(Brand.font(9.5, .black)).tracking(0.6).foregroundStyle(FriendsKit.label)
                        .monospacedDigit().lineLimit(1)
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
                        Icon3D(.share, size: 15)
                    }
                    .buttonStyle(.plain)
                    .opacity(sharingRace ? 0.4 : 1)
                    .accessibilityLabel("Share weekly race")
                }
            }
            VStack(spacing: 6) {
                // D3.3 (§294) — the Sunday finish, settled server-side.
                if let r = FriendsService.lastWeek {
                    lastWeekBanner(r)
                }
                // §232/§238: Monday's answer — last week's winner, unfolding into history.
                if let lw = lastWeekWinner {
                    let history = pastWeeks
                    Button {
                        if history.count > 1 { withAnimation(.easeInOut(duration: 0.15)) { showPastWeeks.toggle() } }
                    } label: {
                        HStack(spacing: 3) {
                            Text("Last week:")
                                .font(Brand.font(10, .bold)).foregroundStyle(FriendsKit.label)
                            Icon3D(.crown, size: 13, label: "Winner")
                            Text("\(lw.name) · \(lw.pts.formatted()) pts")
                                .font(Brand.font(10, .bold)).foregroundStyle(FriendsKit.label)
                            if history.count > 1 {
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(FriendsKit.label)
                                    .rotationEffect(.degrees(showPastWeeks ? 180 : 0))
                            }
                            Spacer(minLength: 0)
                        }
                    }
                    .buttonStyle(.plain)
                    if showPastWeeks {
                        ForEach(history.filter { $0.k > 0 }, id: \.k) { wk in
                            HStack(spacing: 3) {
                                Text("\(FriendsPanelView.pastWeekLabel(wk.k)):")
                                Icon3D(.crown, size: 13, label: "Winner")
                                Text("\(wk.name) · \(wk.pts.formatted()) pts")
                            }
                                .font(Brand.font(10, .bold)).foregroundStyle(FriendsKit.label)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.leading, 4)
                        }
                    }
                }
                HStack(alignment: .bottom, spacing: 22) {
                    ForEach(podiumOrder, id: \.entry.id) { slot in
                        // §225: podium columns open profiles too.
                        NavigationLink(value: slot.entry.id) {
                            VStack(spacing: 2) {
                                Text(raceStarted ? ["🥇", "🥈", "🥉"][slot.rank] : "🏁")
                                    .font(.system(size: slot.rank == 0 ? 20 : 14))
                                AvatarView(url: slot.entry.avatarUrl, username: slot.entry.username, size: 34, emoji: slot.entry.avatarEmoji)
                                    .overlay(Circle().stroke(slot.entry.isMe ? FriendsKit.solid : .clear, lineWidth: 2))
                                Text(slot.entry.username).font(Brand.font(9, .black)).lineLimit(1)
                                    .minimumScaleFactor(0.75)
                                    .foregroundStyle(slot.entry.isMe ? FriendsKit.solid : FriendsKit.ink)
                                    .frame(maxWidth: 76)
                                Text("\(slot.entry.pts.formatted()) pts").font(Brand.font(9, .bold)).foregroundStyle(FriendsKit.label)
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.top, slot.rank == 0 ? 0 : 8)
                    }
                }
                .frame(maxWidth: .infinity)
                // §238: everyone past the medals, ranked.
                if standings.count > 3 {
                    VStack(spacing: 4) {
                        ForEach(Array(standings.dropFirst(3).enumerated()), id: \.element.id) { i, e in
                            NavigationLink(value: e.id) {
                                HStack(spacing: 8) {
                                    Text(FriendsPanelView.ordinal(i + 4))
                                        .font(Brand.font(10, .black)).foregroundStyle(FriendsKit.label)
                                        .frame(width: 28, alignment: .trailing)
                                    Text(e.username)
                                        .font(Brand.font(10, .heavy)).lineLimit(1)
                                        .foregroundStyle(e.isMe ? FriendsKit.solid : FriendsKit.ink)
                                    Spacer(minLength: 4)
                                    Text("\(e.pts.formatted()) pts")
                                        .font(Brand.font(10, .bold)).foregroundStyle(FriendsKit.label)
                                        .fixedSize()
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.top, 2)
                    .padding(.horizontal, 8)
                }
                if !raceStarted {
                    Text("Race resets Mondays — first daily takes the lead.")
                        .font(Brand.font(10, .bold)).foregroundStyle(FriendsKit.label)
                }
            }
            .padding(14)
            .vsCard(radius: 14)
        }
    }

    // MARK: YOUR FRIENDS (§2.7)

    @ViewBuilder
    private func yourFriendsSection(_ friends: [FriendsService.FriendProfile],
                                    incoming: [FriendsService.FriendProfile],
                                    outgoing: [FriendsService.FriendProfile]) -> some View {
        // §216: one-tap nudge for everyone who hasn't played today
        // (server still enforces 1 taunt per friend per day).
        let slackers = friends.filter { $0.playedToday == 0 && !isNewFriend($0) }
        VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: friends.isEmpty ? "YOUR FRIENDS" : "YOUR FRIENDS · \(friends.count)") {
                if !slackers.isEmpty {
                    Button {
                        Task {
                            var n = 0
                            for f in slackers {
                                let outcome = await FriendsService.taunt(
                                    friendId: f.id, tauntId: "slowpoke",
                                    day: LeaderboardService.todayLocal())
                                if outcome == .sent { n += 1 }
                            }
                            note = n > 0 ? "Nudged \(n) friend\(n == 1 ? "" : "s") 🔔" : "Everyone already nudged today"
                        }
                    } label: {
                        Text("Nudge all who haven't played").font(Brand.font(10.5, .black))
                            .foregroundStyle(FriendsKit.solid).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .buttonStyle(.plain)
                }
            }
            if friends.isEmpty {
                Group {
                    if !FriendsService.loaded {
                        // Roster not fetched yet (cold launch): hold the rows' place instead of
                        // flashing the no-friends teaching copy (founder, 2026-09-29).
                        VStack(spacing: 10) {
                            ForEach(0..<3, id: \.self) { _ in SkeletonBlock(height: 30, cornerRadius: 10) }
                        }
                    } else if incoming.isEmpty && outgoing.isEmpty {
                        // Teaching empty state: explain the whole loop (Tier 1, Aug 11),
                        // under I and its one line (MASCOT_SPEC §6).
                        VStack(alignment: .leading, spacing: 5) {
                            MascotMessage(host: Mascots.addFriends, line: Mascots.addFriendLine, size: 72,
                                          font: Brand.font(13, .black), color: FriendsKit.ink)
                                .frame(maxWidth: .infinity).padding(.bottom, 6)
                            Text("1. Add friends below by username, or with the Add Friend button on any player's profile.")
                            Text("2. Requests you send and receive land in INVITES.")
                            Text("3. Once a friend accepts, race them today, play pocket games and trade streaks.")
                        }
                        .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
                    } else {
                        Text("Your friends land here once they accept.")
                            .font(Brand.font(12, .bold)).foregroundStyle(FriendsKit.label)
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .vsCard(radius: 14)
            } else {
                // On now first, then by the most recent presence.
                let sorted = friends.sorted { a, b in
                    let ao = a.isOnline(), bo = b.isOnline()
                    if ao != bo { return ao }
                    return (FriendsService.ms(a.lastSeenAt) ?? 0) > (FriendsService.ms(b.lastSeenAt) ?? 0)
                }
                VStack(spacing: 0) {
                    ForEach(sorted) { f in
                        friendRow(f)
                        if f.id != sorted.last?.id { Divider().padding(.leading, 58) }
                    }
                }
                .vsCard(radius: 14)
            }
            if let note {
                Text(note).font(Brand.font(12, .heavy)).foregroundStyle(FriendsKit.label)
                    .padding(.horizontal, 2)
            }
        }
    }

    private func friendRow(_ f: FriendsService.FriendProfile) -> some View {
        let online = f.isOnline()
        let line = f.presenceLine() ?? FriendsKit.todayLine(f)
        // §225: the WHOLE row is the door to the profile; the pill Button nests
        // inside the label and its tap wins over the link.
        return NavigationLink(value: f.id) {
            HStack(spacing: 10) {
                FriendsPresenceAvatar(url: f.avatar_url, username: f.username, emoji: f.avatar_emoji, size: 36, online: online, ring: false)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text("@\(f.username)").font(Brand.font(13, .black))
                            .foregroundStyle(Color(hex: 0x111827)).lineLimit(1)
                        // §216: the week's leader wears the crown.
                        if f.id == crownId { Icon3D(.crown, size: 14, label: "This week's leader") }
                        if isNewFriend(f) {
                            Text("NEW").font(Brand.font(8, .black))
                                .foregroundStyle(FriendsKit.solid)
                                .padding(.horizontal, 4).padding(.vertical, 2)
                                .background(RoundedRectangle(cornerRadius: 4).fill(FriendsKit.soft))
                        }
                        // §216: friendversary chip on milestone days.
                        if let days = friendversary(f) {
                            Text("🎉 \(days) DAYS").font(Brand.font(8, .black))
                                .foregroundStyle(FriendsKit.solid)
                                .padding(.horizontal, 4).padding(.vertical, 2)
                                .background(RoundedRectangle(cornerRadius: 4).fill(FriendsKit.soft))
                        }
                    }
                    Text(line).font(Brand.font(11, .heavy))
                        .foregroundStyle(online ? FriendsKit.green : FriendsKit.label).lineLimit(1)
                }
                Spacer(minLength: 4)
                if let n = f.friendStreak, n > 0 {
                    HStack(spacing: 2) {
                        FlameMark(size: 11)
                        Text("\(n)").font(Brand.font(12, .black)).foregroundStyle(Color(hex: 0xC2410C))
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(n)-day friend streak")
                }
                actionPill(f, online: online)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // §225: long-press menu — profile, taunt, challenge, gift, unfriend.
        .contextMenu {
            Button { profileTarget = f.id } label: {
                Label("View Profile", systemImage: "person.crop.circle")
            }
            Button { quickPlay = QuickPlay(friend: f, kind: .rps) } label: {
                Label("Play a game", systemImage: "gamecontroller")
            }
            Button { tauntTarget = f } label: {
                Label("Taunt", systemImage: "bell")
            }
            // §289: a private Classic VS Battle, pushed to them.
            Button { challenge(f) } label: {
                Label("Challenge ⚔️", image: "swords")
            }
            .disabled(challenging != nil)
            // D3.4 (§294): gift one of your streak shields — only when you hold one.
            if (AuthService.shared.profile?.streakShields ?? 0) > 0 {
                Button { giftShield(f) } label: {
                    Label("🛡️ Gift a shield", systemImage: "shield")
                }
                .disabled(gifting != nil)
            }
            Button(role: .destructive) { unfriendTarget = f } label: {
                Label("Unfriend", systemImage: "person.badge.minus")
            }
        }
    }

    /// On now → Play (quick-play sheet); played today → Challenge (the free
    /// live VS challenge); hasn't played → Nudge (the taunt picker).
    @ViewBuilder private func actionPill(_ f: FriendsService.FriendProfile, online: Bool) -> some View {
        if online {
            Button { quickPlay = QuickPlay(friend: f, kind: .rps) } label: { FriendsPill(title: "Play") }
                .buttonStyle(.plain)
                .accessibilityLabel("Play with \(f.username)")
        } else if (f.playedToday ?? 0) > 0 {
            Button { challenge(f) } label: {
                FriendsPill(title: challenging == f.id ? "Sending…" : "Challenge", solid: false)
            }
            .buttonStyle(.plain)
            .disabled(challenging != nil)
            .opacity(challenging != nil && challenging != f.id ? 0.5 : 1)
            .accessibilityLabel("Challenge \(f.username) to a VS Battle")
        } else {
            Button { tauntTarget = f } label: { FriendsPill(title: "Nudge", solid: false) }
                .buttonStyle(.plain)
                .accessibilityLabel("Nudge \(f.username)")
        }
    }

    // MARK: Add by username (§2.9)

    private var addFriendSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: "ADD A FRIEND")
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    TextField("Add by username", text: $username)
                        .font(Brand.font(13, .bold))
                        .foregroundStyle(Color(hex: 0x111827))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($fieldFocused)
                        .padding(.horizontal, 12).frame(height: 40)
                        .background(RoundedRectangle(cornerRadius: 10).fill(FriendsKit.page))
                        .onSubmit { add() }
                    Button(action: add) {
                        HStack(spacing: 5) {
                            Icon3D(.addFriend, size: 15) // ART_SPEC §5
                            Text("ADD").font(Brand.font(12, .black)).tracking(0.5)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).frame(height: 40)
                        .background(RoundedRectangle(cornerRadius: 10).fill(FriendsKit.solid))
                    }
                    .buttonStyle(.plain)
                    .disabled(sending || username.trimmingCharacters(in: .whitespaces).isEmpty)
                    .opacity(sending || username.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
                }
                // Typeahead results — tap sends to that exact account (by id).
                if !suggestions.isEmpty {
                    VStack(spacing: 6) {
                        ForEach(suggestions) { u in
                            Button {
                                guard !sending else { return }
                                sending = true
                                suggestions = []
                                Task {
                                    let outcome = await FriendsService.request(addresseeId: u.id)
                                    switch outcome {
                                    case .accepted: addNote = "You're now friends! 🎉"; username = ""
                                    case .pending: addNote = "Request sent to \(u.username) 🤝"; username = ""
                                    case .failed(let msg): addNote = msg
                                    }
                                    sending = false
                                }
                            } label: {
                                HStack(spacing: 10) {
                                    AvatarView(url: u.avatar_url, username: u.username, size: 30, emoji: u.avatar_emoji)
                                    Text(u.username).font(Brand.font(12, .heavy))
                                        .foregroundStyle(Color(hex: 0x111827)).lineLimit(1)
                                    Spacer()
                                    Text("Lvl \(u.level)").font(Brand.font(10, .bold))
                                        .foregroundStyle(FriendsKit.label)
                                    Icon3D(.addFriend, size: 16) // ART_SPEC §5
                                }
                                .padding(.horizontal, 10).padding(.vertical, 7)
                                .background(RoundedRectangle(cornerRadius: 10).fill(FriendsKit.page))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                // §225/§289: the invite link (a Pro player's open referral first).
                if AuthService.shared.profile != nil {
                    Button { shareInviteLink() } label: {
                        HStack(spacing: 5) {
                            Icon3D(.share, size: 13)
                            Text("Share invite link").font(Brand.font(11, .black))
                        }
                        .foregroundStyle(FriendsKit.solid)
                    }
                    .buttonStyle(.plain)
                    .disabled(resolvingShare)
                    .opacity(resolvingShare ? 0.5 : 1)
                }
                if let addNote {
                    Text(addNote).font(Brand.font(12, .heavy)).foregroundStyle(FriendsKit.label)
                }
            }
            .padding(14)
            .vsCard(radius: 14)
        }
    }

    // MARK: INVITES (§2.3 — the existing card, restyled)

    /// Requests in flight (incoming + sent). Renders only when something is pending.
    @ViewBuilder private var invitesCard: some View {
        let incoming = FriendsService.incoming
        let outgoing = FriendsService.outgoingProfiles
        VStack(alignment: .leading, spacing: 8) {
            FriendsSectionHeader(title: "INVITES") {
                Text("\(incoming.count + outgoing.count)").font(Brand.font(11, .black)).foregroundStyle(.white)
                    .padding(.horizontal, 8).frame(height: 20)
                    .background(Capsule().fill(FriendsKit.solid))
            }
            VStack(alignment: .leading, spacing: 12) {
                // Incoming requests first — they're the actionable part.
                if !incoming.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("FRIEND REQUESTS").font(Brand.font(9.5, .black)).tracking(0.8)
                            .foregroundStyle(FriendsKit.label)
                        ForEach(incoming) { r in
                            HStack(spacing: 10) {
                                AvatarView(url: r.avatar_url, username: r.username, size: 32, emoji: r.avatar_emoji)
                                NavigationLink(value: r.id) {
                                    Text("@\(r.username)").font(Brand.font(13, .black))
                                        .foregroundStyle(Color(hex: 0x111827)).lineLimit(1)
                                }.buttonStyle(.plain)
                                Spacer()
                                Button { Task { await FriendsService.accept(requesterId: r.id) } } label: {
                                    FriendsPill(title: "Accept")
                                }.buttonStyle(.plain)
                                Button { Task { await FriendsService.decline(requesterId: r.id) } } label: {
                                    Image(systemName: "xmark").font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(FriendsKit.label).frame(width: 28, height: 28)
                                        .background(Circle().fill(Color(hex: 0xF3F4F6)))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Decline \(r.username)")
                            }
                        }
                    }
                }

                // Sent requests — the loop's missing feedback (Tier 1, Aug 11).
                if !outgoing.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("SENT — WAITING").font(Brand.font(9.5, .black)).tracking(0.8)
                            .foregroundStyle(FriendsKit.label)
                        ForEach(outgoing) { r in
                            HStack(spacing: 10) {
                                AvatarView(url: r.avatar_url, username: r.username, size: 32, emoji: r.avatar_emoji)
                                NavigationLink(value: r.id) {
                                    (Text("@\(r.username)").font(Brand.font(13, .black)).foregroundColor(Color(hex: 0x111827))
                                        + Text("  · \(agoShort(r.requestedAt))").font(Brand.font(10, .bold)).foregroundColor(FriendsKit.label))
                                        .lineLimit(1)
                                }.buttonStyle(.plain)
                                Spacer()
                                // §212: the invite usually died unseen — re-push, 1/24h.
                                Button {
                                    Task {
                                        switch await FriendsService.remind(addresseeId: r.id) {
                                        case .reminded: inviteNote = "Reminder sent to \(r.username) 🔔"
                                        case .already: inviteNote = "Already reminded today"
                                        case .failed: inviteNote = "Could not remind"
                                        }
                                    }
                                } label: {
                                    FriendsPill(title: withinDay(r.remindedAt) ? "Reminded" : "Remind", solid: false)
                                }
                                .buttonStyle(.plain)
                                .disabled(withinDay(r.remindedAt))
                                .opacity(withinDay(r.remindedAt) ? 0.55 : 1)
                                Button { Task { await FriendsService.decline(requesterId: r.id) } } label: {
                                    FriendsPill(title: "Cancel", solid: false, muted: true)
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                }

                if let inviteNote {
                    // Transient confirmation — clears itself after 2.5 s (tap dismisses).
                    Text(inviteNote).font(Brand.font(12, .heavy)).foregroundStyle(FriendsKit.label)
                        .onTapGesture { self.inviteNote = nil }
                        .task(id: inviteNote) {
                            try? await Task.sleep(nanoseconds: 2_500_000_000)
                            if !Task.isCancelled { self.inviteNote = nil }
                        }
                }
            }
            .padding(14)
            .vsCard(radius: 14)
        }
    }

    /// Taunt picker — the leaderboard sheet's twin (§207 fixed phrases).
    private func tauntSheet(_ target: FriendsService.FriendProfile) -> some View {
        VStack(spacing: 0) {
            Text("TAUNT \(target.username.uppercased())")
                .font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16).padding(.vertical, 14)
            Divider().overlay(Theme.border)
            if let status = tauntStatus {
                Text(status).font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                    .frame(maxWidth: .infinity).padding(.vertical, 32)
            } else {
                ForEach(FriendTaunts.all) { taunt in
                    Button {
                        Task {
                            let outcome = await FriendsService.taunt(
                                friendId: target.id, tauntId: taunt.id,
                                day: LeaderboardService.todayLocal())
                            switch outcome {
                            case .sent: tauntStatus = "Sent 😈"
                            case .alreadySent: tauntStatus = "Already taunted them today"
                            case .failed: tauntStatus = "Could not send"
                            }
                            try? await Task.sleep(nanoseconds: 1_400_000_000)
                            tauntTarget = nil
                            tauntStatus = nil
                        }
                    } label: {
                        Text(taunt.text).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16).padding(.vertical, 13)
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(Theme.border)
                }
                Button { tauntTarget = nil } label: {
                    Text("Cancel").font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
        .background(Theme.surface)
        .presentationDetents([.medium])
    }

    struct PodiumEntry {
        let id: String; let username: String; let avatarUrl: String?
        let avatarEmoji: String?; let pts: Int; let isMe: Bool
    }

    /// Me + friends by this week's daily points, best first (§212/§238).
    private var standings: [PodiumEntry] {
        let friends = FriendsService.friends
        guard !friends.isEmpty else { return [] }
        var entries = friends.map {
            PodiumEntry(id: $0.id, username: $0.username, avatarUrl: $0.avatar_url,
                        avatarEmoji: $0.avatar_emoji, pts: $0.weekPoints ?? 0, isMe: false)
        }
        if let p = AuthService.shared.profile {
            entries.append(PodiumEntry(id: p.id, username: "You", avatarUrl: p.avatarUrl,
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
    private var podium: [PodiumEntry] { Array(standings.prefix(3)) }

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

    /// Silver–gold–bronze display order, tagged with the medal rank.
    private var podiumOrder: [(rank: Int, entry: PodiumEntry)] {
        let p = podium
        return [1, 0, 2].compactMap { i in i < p.count ? (rank: i, entry: p[i]) : nil }
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
                note = "Challenge sent to \(f.username) ⚔️"
                challengeMatch = ChallengeMatch(mode: GameMode(rawValue: inv.gameMode) ?? .duel, code: inv.code)
            case .failure(let error):
                note = error.localizedDescription
            }
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            note = nil
        }
    }

    /// D3.3 (§294): "🏁 Last week you finished 2nd of 6 · 1,240 pts · 👑 Doug
    /// 1,900" — gold with a crown when you won. Same copy and colors as the
    /// web banner (friends-panel.tsx).
    private func lastWeekBanner(_ r: FriendsService.LastWeek) -> some View {
        let win = r.rank == 1
        let ink = win ? Color(hex: 0x92400E) : Theme.textPrimary
        var line = Text("Last week you finished ").font(Brand.font(11, .heavy)).foregroundColor(ink)
            + Text("\(WeeklyRace.ordinal(r.rank)) of \(r.circleSize)").font(Brand.font(11, .black)).foregroundColor(ink)
            + Text(" · \(r.points.formatted()) pts").font(Brand.font(11, .heavy)).foregroundColor(ink)
        if !win, let name = r.winnerName {
            line = line + Text(" · 👑 \(name) \(r.winnerPoints.formatted())").font(Brand.font(11, .heavy)).foregroundColor(Theme.textMuted)
        }
        return HStack(spacing: 8) {
            if win { Icon3D(.crown, size: 20) } else { Text("🏁").font(.system(size: 16)) }
            line.frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 12).fill(
                win
                    ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xFEF3C7), Color(hex: 0xFDE68A)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    : AnyShapeStyle(Theme.background)))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(win ? Color(hex: 0xF59E0B) : Theme.border, lineWidth: 1.5))
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
                note = "🛡️ Shield sent to \(f.username) · \(left) left"
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
            case .accepted: addNote = "You're now friends! 🎉"; username = ""
            case .pending: addNote = "Request sent 🤝"; username = ""
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
/// Friends overhaul §2.1: the bell (the notification prefs) and an add-friend
/// icon that jumps to Add by username.
/// Founder (2026-10-02): the TAB never loses the shared app header and drops the
/// FRIENDS title — `asTab` pins AppHeaderView above the scroll exactly like Home,
/// Leaderboard, Stats and Records, and the bell + add-friend circles move to a
/// compact right-aligned row atop the content (its left side is the room kept
/// for a future title graphic). Pushed / sheet copies keep the nav-bar title.
struct FriendsScreenView: View {
    // §218: pushed views don't inherit the root's safeAreaInset, so pad by the
    // reported chrome height (the tab root needs it too — see RootTabView).
    var padsForChrome = true
    var asTab = false
    @ObservedObject private var chrome = ChromeVisibility.shared
    @State private var focusAdd: UUID?

    var body: some View {
        ScrollViewReader { proxy in
            if asTab {
                VStack(spacing: 0) {
                    AppHeaderView()
                    scroll(proxy)
                }
                .background(FriendsKit.page.ignoresSafeArea())
                // navigationTitle stays for the next push's back label.
                .navigationTitle("Friends")
                .toolbar(.hidden, for: .navigationBar)
            } else {
                scroll(proxy)
                    .background(FriendsKit.page.ignoresSafeArea())
                    // navigationTitle stays for the next push's back label; the
                    // principal item is what renders.
                    .navigationTitle("Friends")
                    .navigationBarTitleDisplayMode(.inline)
                    // §10 (founder, iOS 220): the pinned header is opaque page color —
                    // the list never shows through the title and buttons.
                    .toolbarBackground(FriendsKit.page, for: .navigationBar)
                    .toolbarBackground(.visible, for: .navigationBar)
                    .toolbar {
                        ToolbarItem(placement: .principal) {
                            // HEADER_SPEC §5: the Friends banner's O1 is the page's host, so
                            // the title row doesn't repeat it.
                            PageTitle("FRIENDS", colors: FriendsKit.titleGradient)
                        }
                        ToolbarItemGroup(placement: .navigationBarTrailing) {
                            actions(proxy)
                        }
                    }
            }
        }
    }

    private func scroll(_ proxy: ScrollViewProxy) -> some View {
        ScrollView {
            VStack(spacing: 18) {
                if asTab {
                    // ART_SPEC §2: the whole-cast FRIENDS title art in the old title
                    // row's slot, the bell + add-friend circles stacked beside it.
                    HStack(alignment: .center, spacing: 8) {
                        ArtTitle(.friends, colors: FriendsKit.titleGradient)
                            .frame(maxWidth: .infinity)
                        VStack(spacing: 8) {
                            actions(proxy)
                        }
                    }
                }
                FriendsPanelView(focusAdd: focusAdd)
                // §212: recruiting and friending are the same motion — the
                // gift-Pro panel lives here too.
                InvitePanelView()
            }
            .padding(.horizontal, 16).padding(.top, 6)
            .padding(.bottom, 16 + (padsForChrome ? chrome.bottomInset : 0))
        }
    }

    @ViewBuilder private func actions(_ proxy: ScrollViewProxy) -> some View {
        NotificationPrefsButton()
        Button {
            withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo("add-friend", anchor: .center) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { focusAdd = UUID() }
        } label: {
            HeaderCircleLabel(glyph: .icon(.addFriend), size: 32)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add a friend")
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
                    Text("\(count)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted)
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
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .black))
                    .foregroundStyle(Color(hex: 0x7C3AED))
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .task { await FriendsService.load() }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            version = FriendsService.version
        }
    }
}
