import SwiftUI
import WordociousCore

/// Read-only public profile — ports app/profile/[id]/page.tsx: header (avatar,
/// gradient username, level badge + XP bar), 4 overall-stat cards, a Solo/VS
/// toggle + mode picker + per-mode stats card, top words, and recent matches.
/// Reachable by tapping a leaderboard row.
struct PublicProfileView: View {
    let userId: String
    @Environment(\.dismiss) private var dismiss

    @State private var profile: Profile?
    @State private var stats: [PublicProfileService.StatRow] = []
    @State private var matches: [PublicProfileService.RecentMatch] = []
    @State private var topWords: [MatchStatsService.TopWord] = []
    @State private var socials: [String: String] = [:]
    @State private var loading = true
    @State private var notFound = false
    @State private var tab = "solo"                 // "solo" | "vs"
    @State private var selectedMode: GameMode = .duel
    @State private var showAllRecent = false
    // Moderation (App Review 1.2): report + block from the stranger's profile.
    @State private var showReportDialog = false
    @State private var showBlockConfirm = false
    @State private var moderationToast: String?
    /// The family action menu (Report / Block), open while non-nil.
    @State private var moreMenu: FamilyMenuToken?
    // 2.8 item 17: the action row's sheets — Challenge / Pocket game (the quick-play sheet), React (canned notes).
    @State private var quickPlay: FriendsService.FriendProfile?
    @State private var openGame: OpenProfileGame?
    @State private var challengeMatch: ProfileChallengeMatch?
    @State private var raceRunFriend: String?
    @State private var showPro = false
    @State private var reactMenu: FamilyMenuToken?
    @State private var actionBusy = false
    private struct OpenProfileGame: Identifiable { let id: String; let initial: FriendlyGameView? }
    private struct ProfileChallengeMatch: Identifiable { let id = UUID(); let mode: GameMode; let code: String }
    /// Profile-social redesign data (presence ring, persona chips, H2H, trophy
    /// case, highlights, Lately). Loads separately from the core profile so
    /// the page renders even if every social fetch fails.
    @State private var social = ProfileSocialData()
    // PRIVATE PROFILES: `gated` = viewer gets only the teaser card (target is
    // private and the viewer is neither the owner nor an admin — mirrors the
    // server gate, plus the typed-403 backstop). `deepAllowed` flips true only
    // after the gate opens, so no deep fetch ever fires for a gated profile
    // (spec §6: don't fire-then-discard, don't read the open tables).
    @State private var gated = false
    @State private var deepAllowed = false
    @ObservedObject private var chrome = ChromeVisibility.shared

    private let pickerModes: [HomeMode] = homeModes.filter { $0.mode != nil }

    private var isOwnProfile: Bool { AuthService.shared.profile?.id == userId }

    var body: some View {
        ZStack {
            PageBackground(tint: .home)
            if loading {
                CastLoader(label: "LOADING PROFILE", showTips: false)   // the brand loader (the cast wave), not a bare label
            } else if notFound || profile == nil {
                notFoundView
            } else if let p = profile {
                if gated { teaser(p) } else { content(p) }
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task { await ModerationService.loadBlockedIds() }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            friendsVersion = FriendsService.version
        }
        .task(id: userId) { await loadAll() }
        // FINISH_SPEC §AN3: their saved mascot (best effort; the column may not exist yet).
        .task(id: "mascot-\(userId)") { await MascotLooks.shared.fetchConfig(userId: userId) }
        // Social sections load on their own task — non-blocking, and the page
        // stays fully usable if any (or all) of these fetches fail. Keyed on
        // deepAllowed so nothing fires until the privacy gate has opened.
        .task(id: "social-\(userId)-\(deepAllowed)") {
            guard deepAllowed else { return }
            social = await ProfileSocialLoader.load(userId: userId)
        }
        .task(id: "\(tab)-\(selectedMode.rawValue)-\(deepAllowed)") {
            guard deepAllowed else { return }
            topWords = await PublicProfileService.topWords(userId: userId, mode: selectedMode, playType: tab)
        }
        .familyActionMenu(item: $moreMenu) { _ in moderationMenuModel() }
        .familyActionMenu(item: $reactMenu) { _ in reactMenuModel() }
        .softSheet(item: $quickPlay) { f in
            FriendsQuickPlaySheet(
                friend: f, kind: nil,
                onStarted: { g in after { openGame = OpenProfileGame(id: g.id, initial: g) } },
                onVSBattle: { fr in after { challenge(fr) } },
                onRaceMyRun: { fr in after { if AuthService.shared.isProActive { raceRunFriend = fr.id } else { showPro = true } } })
        }
        .softSheet(isPresented: $showPro) { ProView() }
        .gameCover(item: $openGame, onDismiss: { Task { await FriendlyGamesService.load() } }) { g in
            FriendlyGameScreen(gameId: g.id, initial: g.initial)
        }
        .gameCover(item: $challengeMatch) { m in
            NavigationStack { VSGameView(mode: m.mode, inviteCode: m.code) }
        }
        .softSheet(isPresented: Binding(get: { raceRunFriend != nil }, set: { if !$0 { raceRunFriend = nil } })) {
            if let id = raceRunFriend { VSFriendPage(mode: VsLobbyKit.selectedMode, preselected: [id]) }
        }
        #if DEBUG
        .onReceive(NotificationCenter.default.publisher(for: FamilyActionMenuDemo.open)) { n in
            if (n.object as? String) == "profile" { moreMenu = FamilyMenuToken(id: userId) }
        }
        #endif
        // Moderation dialogs live on the container (not inside the header) so
        // the private-profile teaser branch can open them too.
        // Founder 10-09: the reasons in the family menu (speech-bubble rows), not a system action sheet.
        .familyActionMenu(item: Binding(get: { showReportDialog ? FamilyMenuToken(id: "report") : nil },
                                        set: { if $0 == nil { showReportDialog = false } })) { _ in
            FamilyActionMenuModel(
                title: "Report this user?", subtitle: "Reports are reviewed by the Wordocious team.",
                actions: ["Inappropriate username", "Inappropriate profile content", "Cheating / fake scores", "Something else"].map { r in
                    FamilyMenuAction(id: r, title: r, icon: .clay("flag"), tint: FamilyMenuInk.pink) {
                        fileReport(r == "Something else" ? "Other" : r)
                    }
                }, notes: true)
        }
        .familyConfirm("Block this user?", isPresented: $showBlockConfirm,
                       message: "You won't see this player on leaderboards or records.", confirm: "Block", danger: true) {
            Task { await ModerationService.block(userId: userId); moderationToast = "User blocked" }
        }
    }

    private func loadAll() async {
        loading = true
        // PRIVATE PROFILES: let auth settle before deciding who the viewer is,
        // so the owner deep-linking into their own profile never flashes their
        // own teaser card (spec §6).
        while AuthService.shared.isLoading {
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        guard let p = await PublicProfileService.fetchProfile(id: userId) else {
            notFound = true; loading = false; return
        }
        profile = p
        let viewer = AuthService.shared.profile
        // Client mirror of the server gate (open for public targets, the
        // owner, and admins). The endpoints enforce it regardless — mirroring
        // means no doomed requests and no direct reads of the still-open
        // tables (user_stats / daily_results / medals) for a private target.
        // FRIENDS (§207): accepted friends see the full profile — "private"
        // means "friends only". The server gate opens for friends too.
        if viewer != nil { await FriendsService.load() }
        gated = (p.isPrivate == true) && viewer?.id != p.id && viewer?.isAdmin != true
            && !FriendsService.isFriend(p.id)
        if gated { loading = false; return }   // teaser renders from the profiles row alone
        async let st = PublicProfileService.stats(id: userId)
        async let mt = PublicProfileService.recentMatchesGated(id: userId)
        stats = await st
        switch await mt {
        case .ok(let rows): matches = rows
        case .privateProfile:
            // The profiles row read said public but the server said private —
            // the row was stale (the flag just flipped). The typed 403 wins.
            gated = true; loading = false; return
        case .failed: matches = []
        }
        socials = await ProfileExtras.socialLinks(userId: userId)
        // Default the mode picker to the player's first mode for this tab.
        if let firstMode = stats.first(where: { $0.playType == tab })?.gameMode,
           let gm = GameMode(rawValue: firstMode) { selectedMode = gm }
        deepAllowed = true
        loading = false
    }

    private func fileReport(_ reason: String) {
        Task {
            let ok = await ModerationService.report(userId: userId, reason: reason, context: "public_profile")
            moderationToast = ok ? "Report submitted — thank you" : "Could not submit report"
        }
    }

    private var notFoundView: some View {
        // O3 searching for the missing profile (ART_SPEC §7); BI24: brand headline.
        BrandEmptyState(title: "Player not found", line: "I looked everywhere. This profile doesn't exist or was removed.",
                        scene: .notFound, artHeight: 140, actionTitle: "Back", actionSymbol: "chevron.left",
                        action: { dismiss() }, heading: .notfound)   // BJ16
    }

    // MARK: Shared header bits (full page + teaser)

    // FRIENDS (§207): the Add Friend pill beside the moderation kebab.
    // States: Add Friend → Requested (tap = cancel) · Accept · Friends ✓
    // (two taps = unfriend — inline confirm, no system dialogs). Friending is
    // also the door into a private profile, so it renders on the teaser too.
    @State private var friendsVersion = 0
    @State private var confirmUnfriend = false

    @ViewBuilder private var addFriendButton: some View {
        let _ = friendsVersion
        if AuthService.shared.profile != nil && !isOwnProfile {
            let friend = FriendsService.isFriend(userId)
            let requested = FriendsService.hasRequested(userId)
            let incoming = FriendsService.hasIncomingFrom(userId)
            Button {
                Task {
                    if friend {
                        if confirmUnfriend {
                            await FriendsService.remove(friendId: userId)
                            confirmUnfriend = false
                            // Re-gate: unfriending a private profile closes it.
                            await loadAll()
                        } else {
                            confirmUnfriend = true
                            try? await Task.sleep(nanoseconds: 3_000_000_000)
                            confirmUnfriend = false
                        }
                    } else if incoming {
                        await FriendsService.accept(requesterId: userId)
                        await loadAll()   // may open a private profile
                    } else if requested {
                        await FriendsService.decline(requesterId: userId)
                    } else {
                        _ = await FriendsService.request(addresseeId: userId)
                        if FriendsService.isFriend(userId) { await loadAll() }  // mutual auto-accept
                    }
                }
            } label: {
                // §A8: one small candy button per state — Add / Accept purple,
                // Friends teal (pink while confirming the removal), Requested quiet peach.
                if friend {
                    CandyLabel(title: confirmUnfriend ? "Remove friend?" : "Friends",
                               symbol: confirmUnfriend ? "person.fill.xmark" : "person.fill.checkmark")
                } else if incoming {
                    CandyLabel(title: "Accept request") { Icon3D(.addFriend, size: 16) } // ART_SPEC §5
                } else if requested {
                    CandyLabel(title: "Requested")
                } else {
                    CandyLabel(title: "Add Friend") { Icon3D(.addFriend, size: 16) } // ART_SPEC §5
                }
            }
            .buttonStyle(CandyButtonStyle(
                variant: friend ? (confirmUnfriend ? .pink : .teal) : (requested ? .peach : .purple),
                size: .small, fullWidth: false))
        }
    }

    /// App Review 1.2: users must be able to report/block each other wherever
    /// strangers' content renders — including a private profile's teaser card.
    private var moderationMenu: some View {
        // The family action menu (founder 10-05: no plain-text menus) — same actions + confirmations.
        HeaderCircleButton(.symbol("ellipsis"), label: "More") { moreMenu = FamilyMenuToken(id: userId) }
    }

    /// The More menu's rows: Report, then Block / Unblock (all three keep their confirmation steps).
    private func moderationMenuModel() -> FamilyActionMenuModel {
        var rows: [FamilyMenuAction] = []
        // 2.8 item 17: Unfriend / Block / Report all live in the ⋯ menu (Unfriend only for friends).
        if FriendsService.isFriend(userId) {
            rows.append(FamilyMenuAction(id: "unfriend", title: "Unfriend", icon: .clay("xmark"), danger: true,
                                         accessibility: "Unfriend this player") {
                Task { await FriendsService.remove(friendId: userId); await loadAll() }   // re-gate a private profile
            })
        }
        rows.append(FamilyMenuAction(id: "report", title: "Report user", icon: .clay("flag"), danger: true,
                                     accessibility: "Report this user") { showReportDialog = true })
        if ModerationService.isBlocked(userId) {
            rows.append(FamilyMenuAction(id: "unblock", title: "Unblock user", icon: .clay("check"), tint: FamilyMenuInk.teal) {
                Task { await ModerationService.unblock(userId: userId); moderationToast = "User unblocked" }
            })
        } else {
            rows.append(FamilyMenuAction(id: "block", title: "Block user", icon: .clay("xmark"), danger: true,
                                         accessibility: "Block this user") { showBlockConfirm = true })
        }
        let name = profile?.username
        return FamilyActionMenuModel(
            title: name ?? "Player", subtitle: "Keep Wordocious friendly",
            avatar: profile.map { p in AnyView(AvatarView(url: p.avatarUrl, username: p.username, size: 44,
                                                         accentHex: p.accentColor, emoji: p.avatarEmoji, userId: userId, stroke: false)) },
            actions: rows)
    }

    private func moderationToastView(_ toast: String) -> some View {
        // §BI9: the shared candy toast (success / error coin), not a plain pill.
        G5Toast(text: toast, tone: toast.hasPrefix("Could not") ? .error : .success)
            .task { try? await Task.sleep(nanoseconds: 2_500_000_000); moderationToast = nil }
    }

    /// Accent-colored (or wordmark-gradient) username — same on both branches.
    @ViewBuilder private func usernameText(_ p: Profile, size: CGFloat = 30) -> some View {
        // Founder rule 10-10: the name is bubble lettering in the player's own color (their backdrop, else their custom accent).
        let cfg = PlayerTint.config(userId: p.id, username: p.username)
        let palette: HeadlinePalette = AvatarCatalog.backdrop(cfg.bg) != nil || !ProfileAccent.isCustom(p.accentColor)
            ? .accent(PlayerTint.nameColor(userId: p.id, username: p.username))
            : .accent(ProfileAccent.color(p.accentColor))
        BubbleTextView(text: p.username.uppercased(), palette: palette, maxSize: size + 8, minSize: 18, animated: false)
            .frame(maxWidth: 320)
    }

    // MARK: Item 17 action-row helpers

    /// Run after a sheet finishes dismissing (presenting mid-dismissal drops it).
    private func after(_ action: @escaping () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45, execute: action)
    }

    /// Challenge = a private Classic VS Battle (the Friends tab's flow): a targeted invite + a push, then the lobby.
    private func challenge(_ f: FriendsService.FriendProfile) {
        guard !actionBusy else { return }
        actionBusy = true
        Task {
            let result = await FriendsService.challenge(friendId: f.id, gameMode: "DUEL")
            actionBusy = false
            switch result {
            case .success(let inv): challengeMatch = ProfileChallengeMatch(mode: GameMode(rawValue: inv.gameMode) ?? .duel, code: inv.code)
            case .failure(let error): moderationToast = "Could not send: \(error.localizedDescription)"
            }
        }
    }

    private var viewerFriend: FriendsService.FriendProfile? { FriendsService.friends.first { $0.id == userId } }

    private var friendState: StatsProfile.FriendshipState {
        let _ = friendsVersion
        let signedIn = AuthService.shared.profile != nil
        return StatsProfile.friendshipState(isSelf: isOwnProfile, isFriend: signedIn && FriendsService.isFriend(userId),
                                            incoming: signedIn && !isOwnProfile && FriendsService.hasIncomingFrom(userId),
                                            requested: signedIn && !isOwnProfile && FriendsService.hasRequested(userId))
    }

    /// React: one tap sends a canned note (the Friends taunts), one per day per friend.
    private func reactMenuModel() -> FamilyActionMenuModel {
        let name = profile?.username ?? "Player"
        let rows = FriendTaunts.all.map { t in
            FamilyMenuAction(id: t.id, title: t.text, icon: .clay("heart"), tint: FamilyMenuInk.pink, accessibility: t.text) {
                Task {
                    let r = await FriendsService.taunt(friendId: userId, tauntId: t.id, day: LeaderboardService.todayLocal())
                    switch r {
                    case .sent: moderationToast = "Sent!"
                    case .alreadySent: moderationToast = "You already reacted to \(name) today"
                    case .failed: moderationToast = "Could not send. Try again."
                    }
                }
            }
        }
        return FamilyActionMenuModel(title: "React", subtitle: "Send \(name) a quick note", actions: rows, notes: true)
    }

    private func friendAct(_ work: @escaping () async -> Void) {
        guard !actionBusy else { return }
        actionBusy = true
        Task { await work(); actionBusy = false }
    }

    // MARK: Private-profile teaser (spec §3)

    private func teaserMemberSince(_ p: Profile) -> String? {
        guard let c = p.createdAt, let d = parseTimestamp(c) else { return nil }
        let f = DateFormatter(); f.dateFormat = "MMM yyyy"; f.locale = Locale(identifier: "en_US")
        return f.string(from: d)
    }

    /// One clean card styled like the profile header — identity + headline
    /// numbers, all from the world-readable profiles row. Nothing that reveals
    /// words or strategy renders; the deep endpoints 403 anyway, this is the
    /// face on that rule. Ports the web teaser (app/profile/[id]/page.tsx).
    private func teaser(_ p: Profile) -> some View {
        let tier = LevelTier.forLevel(p.level)
        // §AM3: medal art kinds (art-medal-*), never the emoji.
        let medals: [(String, Int)] = [("gold", p.goldMedals), ("silver", p.silverMedals), ("bronze", p.bronzeMedals)]
        let stats: [(String, Int)] = [("Wins", p.totalWins),
                                      ("Games", p.totalWins + p.totalLosses),
                                      ("Daily Streak", p.dailyLoginStreak)]
        return ScrollView {
            VStack(spacing: 16) {
                HStack {
                    HeaderCircleButton(.symbol("chevron.left"), label: "Back") { dismiss() }
                    Spacer()
                    // Report / Block still works on private profiles.
                    if !isOwnProfile {
                        addFriendButton
                        moderationMenu
                    }
                }
                if let toast = moderationToast { moderationToastView(toast) }

                VStack(spacing: 0) {
                    AvatarView(url: p.avatarUrl, username: p.username, size: 96,
                               accentHex: p.accentColor, emoji: p.avatarEmoji, pro: Wordocious.isProActive(p))
                    usernameText(p).padding(.top, 12)

                    // Lock badge — the notation the founder asked for.
                    HStack(spacing: 5) {
                        Image(systemName: "lock.fill").font(.system(size: 10, weight: .bold))
                        BubbleLabel("This profile is private", color: FinishInk.secondary, size: 13)
                    }
                    .foregroundStyle(FinishInk.secondary)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .tintedPill(Color(hex: 0x8B5CF6))
                    .padding(.top, 8)

                    Text("\(p.username) keeps their words and strategies to themselves. You can still meet them on the daily leaderboards.")
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                        .multilineTextAlignment(.center).frame(maxWidth: 240)
                        .padding(.top, 8)

                    // Level + tier chip, member since — same chips as the header.
                    // §V3: the tier badge + the level in soft numbers.
                    LevelBadge(level: p.level, size: 30, showTier: true)
                        .padding(.horizontal, 12).padding(.vertical, 4)
                        .tintedPill(BadgeArt.tierAccent(tier))
                        .padding(.top, 16)

                    if let since = teaserMemberSince(p) {
                        Text("Member since \(since)")
                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            .padding(.top, 6)
                    }

                    // Medal counts
                    HStack(spacing: 16) {
                        ForEach(medals, id: \.0) { m in
                            HStack(spacing: 4) {
                                MedalArt(kind: m.0, size: 22)
                                Text("\(m.1)").softNumber(16)
                            }
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("\(m.1) \(m.0) \(m.1 == 1 ? "medal" : "medals")")
                        }
                    }
                    .padding(.top, 16)

                    // Headline numbers
                    HStack(spacing: 12) {
                        ForEach(stats, id: \.0) { s in
                            VStack(spacing: 2) {
                                Text("\(s.1)").softNumber(20)
                                Text(s.0.uppercased()).font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(FinishInk.secondary)
                            }.frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.top, 12)
                    .overlay(Rectangle().fill(Color(hex: 0x7C3AED).opacity(0.14)).frame(height: 1), alignment: .top)
                    .padding(.top, 12)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                // §A1: the lavender card with its top bar.
                .tintedCard(accent: Color(hex: 0x7C3AED), bar: [Color(hex: 0xA855F7), Color(hex: 0xEC4899)])

                Button { dismiss() } label: { CandyLabel(title: "Back", symbol: "chevron.left") }
                    .buttonStyle(CandyButtonStyle(variant: .pink, size: .medium, fullWidth: false))
            }
            .padding(.horizontal, 12).padding(.top, 8)
            .padding(.bottom, chrome.bottomInset)
        }
    }

    // MARK: Content

    private func content(_ p: Profile) -> some View {
        ScrollView {
            // BJ7: 12 between sections (was 16).
            VStack(spacing: 12) {
                header(p)
                socialSections(p)
                overallCards(p)
                modeSection
                if !topWords.isEmpty { topWordsCard }
                recentMatches(p)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            // This view is always PUSHED (leaderboard/records/profile rows),
            // and the root-level banner+nav safeAreaInset doesn't extend to
            // pushed destinations — without this the last rows sit under the
            // nav and can never be scrolled into view.
            .padding(.bottom, chrome.bottomInset)
        }
    }

    // MARK: Header

    private func header(_ p: Profile) -> some View {
        let state = friendState
        let isFriend = state == .friends
        return VStack(spacing: 10) {
            HStack {
                HeaderCircleButton(.symbol("chevron.left"), label: "Back") { dismiss() }
                Spacer()
            }
            if let toast = moderationToast { moderationToastView(toast) }
            // Item 17: the mascot full-body on a mini Stage (alive while living_mascot is on) with the today pill.
            ProfileStageHero(profile: p) {
                VStack { Spacer()
                    if social.todayCount > 0 {
                        Text("\(social.todayCount)/\(MedalService.dailyModeCount) today")
                            .font(Brand.font(10, .black)).foregroundStyle(.white)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Capsule().fill(Theme.primary))
                            .padding(.bottom, 4)
                    }
                }
            }
            ProfileIdentityBlock(profile: p, isFriend: isFriend, friendsSince: viewerFriend?.since)
            // PRIVATE PROFILES: the owner (and admins) still see the full page
            // — this muted pill is the reminder that everyone else doesn't.
            if p.isPrivate == true {
                HStack(spacing: 4) {
                    Image(systemName: "lock.fill").font(.system(size: 9, weight: .bold))
                    BubbleLabel(isOwnProfile ? "Your profile is private" : "Private profile", color: FinishInk.secondary, size: 12)
                }
                .foregroundStyle(FinishInk.secondary)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .tintedPill(Color(hex: 0x8B5CF6))
            }
            // Presence line + the archetype / percentile / opener chips.
            if let seen = p.lastSeenAt {
                PresenceLine(lastSeenAt: seen)
            }
            ProfilePersonalizationRow(profile: p)
            ProfileIdentityChips(profile: p, persona: social.persona)
            ProfileRankStrip(level: p.level, xp: p.xp)
            if !isOwnProfile && AuthService.shared.profile != nil {
                ProfileActionRow(
                    state: state, busy: actionBusy,
                    onChallenge: { if let f = viewerFriend { challenge(f) } },
                    onPocket: { quickPlay = viewerFriend },
                    onReact: { reactMenu = FamilyMenuToken(id: userId) },
                    onAddFriend: { friendAct {
                        _ = await FriendsService.request(addresseeId: userId)
                        if FriendsService.isFriend(userId) { await loadAll() }   // mutual auto-accept
                    } },
                    onCancelRequest: { friendAct { _ = await FriendsService.decline(requesterId: userId) } },
                    onAccept: { friendAct { _ = await FriendsService.accept(requesterId: userId); await loadAll() } },
                    onDecline: { friendAct { _ = await FriendsService.decline(requesterId: userId) } },
                    onMenu: { moreMenu = FamilyMenuToken(id: userId) })
            }
            socialLinksRow()
        }
    }

    // Public-profile social links — web parity (SocialLinksDisplay on /profile/[id]).
    private let socialOrder = ["twitter", "instagram", "tiktok", "threads", "discord", "website"]

    @ViewBuilder
    private func socialLinksRow() -> some View {
        let links = socials.filter { !$0.value.isEmpty }
        if !links.isEmpty {
            HStack(spacing: 8) {
                ForEach(socialOrder.filter { links[$0] != nil }, id: \.self) { key in
                    if let handle = links[key], let url = socialURL(key, handle) {
                        Link(destination: url) {
                            Image(systemName: key == "website" ? "globe" : (key == "discord" ? "message.fill" : "at"))
                                .font(.system(size: 14, weight: .black))
                        }
                        .buttonStyle(HelperButtonStyle(fallback: Color(hex: 0x7C3AED), circle: true))   // family helper circle
                        .accessibilityLabel(key == "website" ? "Website" : key.capitalized)   // §AB: icon-only
                    }
                }
            }.padding(.top, 2)
        }
    }

    private func socialURL(_ key: String, _ handle: String) -> URL? {
        let h = handle.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? handle
        switch key {
        case "twitter": return URL(string: "https://twitter.com/\(h)")
        case "instagram": return URL(string: "https://instagram.com/\(h)")
        case "tiktok": return URL(string: "https://tiktok.com/@\(h)")
        case "threads": return URL(string: "https://threads.net/@\(h)")
        case "discord": return URL(string: "https://discord.com/users/\(h)")
        case "website": return URL(string: handle.hasPrefix("http") ? handle : "https://\(handle)")
        default: return nil
        }
    }

    // MARK: Social sections (profile-social redesign — above the stat cards)

    /// You-vs-Them, trophy case, highlights, and Lately. Every section guards
    /// on its own data and simply doesn't render without it, so the existing
    /// page below is untouched when the fetches fail or return nothing.
    @ViewBuilder private func socialSections(_ p: Profile) -> some View {
        if !isOwnProfile, let f = viewerFriend {
            ProfileHeadToHeadStrip(friend: f, name: p.username)
        }
        if let h2h = social.h2h, !h2h.shared.isEmpty,
           let viewerId = social.viewerId, viewerId != p.id {
            YouVsThemCard(target: p, h2h: h2h)
        }
        TrophyCaseCard(profile: p, persona: social.persona, medals: social.medals)
        HighlightsReel(profile: p, persona: social.persona, stats: stats,
                       hasPerfectOcto: social.hasPerfectOcto, calendar: social.calendar)
        LatelyCard(profile: p, medals: social.medals, persona: social.persona)
    }

    // MARK: Overall stat cards

    private func overallCards(_ p: Profile) -> some View {
        // The headline numbers, once (item 17): the four hero stats. The daily streak lives in LATELY; level + XP are the strip above.
        let fastest = stats.filter { $0.playType == "solo" && $0.fastestTime > 0 }.map(\.fastestTime).min() ?? 0
        return HeroStatsRow(wins: p.totalWins, losses: p.totalLosses, streak: p.currentStreak, bestStreak: p.bestStreak,
                            fastestSeconds: Double(fastest), accent: Color(hex: 0x7C3AED))
            .padding(16)
            .statsCard(accent: Color(hex: 0x7C3AED))
    }

    // MARK: Mode section (Solo/VS toggle + picker + stats card)

    private var modeSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            FinishLabel("Game mode statistics")
            // The Solo | VS toggle — the shared soft segmented control (§A9 squish).
            // The candy Solo | VS toggle (night art 10-03 sprites).
            CandySegmented(options: [(key: "solo", label: "Solo"), (key: "vs", label: "VS")],
                           selection: tab, accessibilityLabel: "Play type", height: 36) { tab = $0 }
                .frame(width: 160)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) { ForEach(pickerModes) { m in modeChip(m) } }.padding(.horizontal, 4).padding(.vertical, 4)
            }
            modeStatsCard
        }
    }

    private func modeChip(_ m: HomeMode) -> some View {
        let active = selectedMode == m.mode
        // Square game tile (docs/GAME_TILE_STYLE.md).
        return Button { if let gm = m.mode { selectedMode = gm } } label: {
            GameTileSquare(accent: m.accent, label: ModeGen.byId(m.id)?.shortTitle ?? m.title, selected: active, side: 64) { chip in
                ModeIconView(icon: m.icon, accent: m.accent, box: chip)
            }
        }.buttonStyle(.squish)
    }

    private var modeStatsCard: some View {
        let stat = stats.first { $0.gameMode == selectedMode.rawValue && $0.playType == tab }
        let accent = homeModes.first { $0.mode == selectedMode }?.accent ?? Theme.primary
        return VStack(spacing: 0) {
            HStack(spacing: 10) {
                ModeIconView(icon: homeModes.first { $0.mode == selectedMode }?.icon ?? .roman("?"), accent: accent, box: 28)
                BubbleLabel(ModeStyle.title(selectedMode), color: accent.bubbleInk, size: 16)
                Spacer()
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .overlay(Rectangle().fill(accent.opacity(0.16)).frame(height: 1), alignment: .bottom)
            if let s = stat {
                let cells: [(String, String, Color)] = [
                    ("Wins", "\(s.wins)", Color(hex: 0x7C3AED)),
                    ("Losses", "\(s.losses)", Color(hex: 0xDC2626)),
                    ("Best", s.bestScore > 0 ? "\(s.bestScore)" : "-", Color(hex: 0xD97706)),
                    ("Fastest", s.fastestTime > 0 ? fmtTime(s.fastestTime) : "-", Color(hex: 0x2563EB)),
                ]
                HStack(spacing: 12) {
                    ForEach(cells, id: \.0) { c in
                        VStack(spacing: 1) {
                            Text(c.1).softNumber(19).lineLimit(1).minimumScaleFactor(0.6)
                            Text(c.0.uppercased()).font(Brand.font(9, .black)).tracking(0.4).foregroundStyle(FinishInk.secondary)
                        }.frame(maxWidth: .infinity)
                    }
                }.padding(.horizontal, 12).padding(.vertical, 10)
            } else {
                // BI24: a host + brand headline, not a plain grey line.
                BrandEmptyState(title: "No \(tab) games yet", line: "Nothing played in this mode yet. Check back after a few rounds.",
                                scene: .noStats, artHeight: 72)
            }
        }
        // §A1: tinted in the mode's accent with its top bar.
        .tintedCard(accent: accent, bar: [accent], barHeight: 5)
    }

    // MARK: Top words

    private var topWordsCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            FinishLabel("Top words")
            VStack(spacing: 0) {
                ForEach(Array(topWords.enumerated()), id: \.element.id) { i, w in
                    HStack {
                        BubbleLabel(w.word, color: FinishInk.purple.bubbleInk, size: 15)
                        Spacer()
                        Text("\(w.count)").softNumber(14)
                        Text("×").font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .stripedRow(i, accent: Color(hex: 0x7C3AED))
                }
            }
            .padding(.vertical, 4)
            .tintedCard(accent: Color(hex: 0x7C3AED), bar: [Color(hex: 0x7C3AED)], barHeight: 5)
        }
    }

    // MARK: Recent matches

    private func recentMatches(_ p: Profile) -> some View {
        // BJ7: a 25% smaller header, 8 under it, 6 between rows, 12 padding.
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "clock").font(.system(size: 12, weight: .bold)).foregroundStyle(Color(hex: 0x2563EB))
                BubbleLabel("Recent Matches", color: FinishInk.purple.bubbleInk, size: 15)
            }
            if matches.isEmpty {
                // BI24: R asleep + brand headline, not a plain grey line.
                BrandEmptyState(title: "No matches yet", line: "Once games are played, the latest show up right here.",
                                scene: .asleep, artHeight: 72)
            } else {
                // Show 5 collapsed; the toggle expands the rest in place (no
                // inner ScrollView — the rows render straight into the VStack).
                VStack(spacing: 6) {
                    ForEach(showAllRecent ? matches : Array(matches.prefix(5))) { m in
                        RecentMatchRow(match: m, profileId: p.id)
                    }
                }
                if matches.count > 5 {
                    Button { showAllRecent.toggle() } label: {
                        CandyLabel(title: showAllRecent ? "Show less" : "View all \(matches.count)")
                    }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                    .frame(maxWidth: .infinity).padding(.top, 2)
                }
            }
        }
        .padding(12)
        // §A1: the blue card with its top bar.
        .tintedCard(accent: Color(hex: 0x2563EB), bar: [Color(hex: 0x2563EB), Color(hex: 0x60A5FA)], barHeight: 5, tint: 0.06)
    }

    private func fmtTime(_ s: Int) -> String {
        s < 60 ? "\(s)s" : (s % 60 > 0 ? "\(s/60)m \(s%60)s" : "\(s/60)m")
    }
}

/// One row in a "Recent Matches" list — ports the web profile row exactly:
/// a mode-accent-tinted icon box (the mode's own glyph), proper-case title +
/// a Solo/VS pill, an "N guesses · time" line, and "Win/Loss" + "Mon D · h:mm a".
/// Shared by the public profile and the signed-in user's own profile tab.
struct RecentMatchRow: View {
    let match: PublicProfileService.RecentMatch
    let profileId: String
    /// VS opponent's username — renders "· vs <name>" inline (web profile parity).
    var opponentName: String? = nil

    /// Home tiles first, then the More Games titles (Sudoku et al. live in moreModes).
    private var mode: HomeMode? { homeModes.first { $0.dbKey == match.game_mode } ?? moreModes.first { $0.dbKey == match.game_mode } }

    var body: some View {
        let won = match.isWinner(profileId)
        let guesses = match.guesses(profileId)
        let secs = match.playerTime(profileId)
        // BJ7: one top line — the icon, the title row and the W / L badge top-aligned;
        // the detail 4 under the title. No outline (BI23).
        return HStack(alignment: .top, spacing: 10) {
            // Mode icon in its accent-tinted box (matches web gameModeIcons).
            if let m = mode {
                ModeIconView(icon: m.icon, accent: m.accent, box: 36)
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(Color(hex: 0xD97706).opacity(0.1)).frame(width: 36, height: 36)
                    Image(systemName: "bolt.fill").font(.system(size: 15)).foregroundStyle(Color(hex: 0xD97706))
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    BubbleLabel(mode?.title ?? match.game_mode, color: FinishInk.purple.bubbleInk, size: 14, minScale: 0.5)
                    Text(match.isSolo ? "Solo" : "VS")
                        .font(Brand.font(9, .heavy))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: 5)
                            .fill(match.isSolo ? Color(hex: 0xEFF6FF) : Color(hex: 0xEDE9F6)))
                        .foregroundStyle(match.isSolo ? Color(hex: 0x2563EB) : Color(hex: 0x7C3AED))
                    if match.forfeit == true {
                        Text("FORFEIT")
                            .font(Brand.font(9, .heavy))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(RoundedRectangle(cornerRadius: 5).fill(Color(hex: 0xFEF3C7)))
                            .foregroundStyle(Color(hex: 0xB45309))
                    }
                    if !match.isSolo, let opponentName {
                        Text("· vs \(opponentName)")
                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                }
                // Through the mode's guess semantics (More Games §11): Sudoku reads "0 mistakes".
                Text("\(formatGuessStat(semantics: mode?.guessSemantics ?? "guesses", guessBase: mode?.guessBase ?? 1, guessCount: guesses)) · \(secs > 0 ? durationStr(secs) : "—")")
                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                // ART_SPEC §4: the 3D W / L badge.
                ResultBadge(won: won, size: 24)
                if let d = match.date {
                    Text(dateTimeStr(d)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        // §A1: a soft wash of the mode's accent, never plain white (BJ7: no outline).
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Theme.isDark ? Theme.surface : (mode?.accent ?? Color(hex: 0x7C3AED)).wash(0.10)))
    }

    private func durationStr(_ s: Int) -> String {
        s < 60 ? "\(s)s" : "\(s / 60)m \(s % 60)s"
    }

    private static let dateTimeFormatter: DateFormatter = { let f = DateFormatter(); f.dateFormat = "MMM d · h:mm a"; return f }()
    private func dateTimeStr(_ d: Date) -> String {
        Self.dateTimeFormatter.string(from: d)
    }
}
