import SwiftUI
import WordociousCore

/// Daily leaderboard — matches app/daily/page.tsx (full mode picker,
/// your-rank banner, rank icons, current-user highlight, win/loss pill,
/// yesterday toggle, player count).
struct LeaderboardTab: View {
    @EnvironmentObject private var auth: AuthService
    @ObservedObject private var chrome = ChromeVisibility.shared
    /// Owned by RootTabView so tab gestures can pop it to root.
    @Binding var path: [String]
    @State private var mode: GameMode = .duel
    // Sweep chip (the banner's SWEEP pill, LeaderboardBannerView) — the cross-mode
    // "completed every sweep daily" board.
    @State private var isSweep = false
    @State private var sweepEntries: [SweepEntry] = []
    @State private var sweepRank: (rank: Int, total: Int)?
    @State private var sweepLoading = false
    @State private var entries: [LeaderboardEntry] = []
    // Yesterday's Winners, settled and so kept per "day:mode:scope" (founder, 2026-09-29): one
    // shared list used to keep the PREVIOUS mode's podium under the new mode until the refetch
    // landed, and flashed "No results from yesterday" before the first fetch. nil = not loaded.
    @State private var yesterdayByKey: [String: [LeaderboardEntry]] = [:]
    @State private var ySweepByDay: [String: [SweepEntry]] = [:]
    private var yesterdayKey: String {
        "\(LeaderboardService.yesterdayLocal()):\(mode.rawValue):\(friendsOnly ? "friends" : "all")"
    }
    private var yesterdayKnown: [LeaderboardEntry]? { yesterdayByKey[yesterdayKey] }
    private var yesterday: [LeaderboardEntry] { yesterdayKnown ?? [] }
    private var ySweepKnown: [SweepEntry]? { ySweepByDay[LeaderboardService.yesterdayLocal()] }
    private var yesterdaySweep: [SweepEntry] { ySweepKnown ?? [] }
    // §223: per-user mode detail behind the sweep dot strips + guess/hint totals.
    @State private var sweepDetails: [String: LeaderboardService.SweepDetails] = [:]
    // §248: current flawless streaks for FLAWLESS rows — the ×N pills.
    @State private var flawlessStreaks: [String: Int] = [:]
    @State private var yFlawlessStreaks: [String: Int] = [:]
    @State private var ySweepDetails: [String: LeaderboardService.SweepDetails] = [:]
    @State private var reloadToken = 0
    @State private var userRank: (rank: Int, total: Int)?
    // "Your neighborhood" rows when the user placed past the top-50 list.
    @State private var rankWindow: (startRank: Int, entries: [LeaderboardEntry])?

    // TIE-AWARE score display (web parity): rows sharing a whole number on the
    // same board render the decimals that rank them; everything else stays
    // integer. One map per board, keyed by the raw stored score.
    private var lbScoreLabels: [Double: String] {
        tieAwareScoreLabels(entries.map(\.compositeScore) + (rankWindow?.entries.map(\.compositeScore) ?? []))
    }
    private var sweepScoreLabels: [Double: String] { tieAwareScoreLabels(sweepEntries.map(\.totalScore)) }
    private var yLbScoreLabels: [Double: String] { tieAwareScoreLabels(yesterday.map(\.compositeScore)) }
    private var ySweepScoreLabels: [Double: String] { tieAwareScoreLabels(yesterdaySweep.map(\.totalScore)) }
    @State private var playerCount = 0
    @State private var loading = false
    @State private var showYesterday = false
    @State private var showAuth = false
    // LEADERBOARD SHARE — single-tap, spoiler-free by construction (names/
    // scores/stats only), so no variant chooser. The Sweep board shares too
    // (§231) — same flags, sweep variants.
    @State private var sharingLb = false
    @State private var sharingPodium = false
    // FRIENDS (§207): All|Friends toggle — dense friend ranks + ghost rows
    // for friends who haven't played this mode today, with the canned-taunt
    // sheet (fixed phrases only). friendsVersion re-keys the fetch tasks
    // whenever the FriendsService cache changes.
    @State private var friendsOnly = false
    /// Tier 2 (Aug 11): "Add friends" CTA on the empty Friends board.
    @State private var showFriendsSheet = false
    @State private var friendsVersion = 0
    @State private var tauntTarget: FriendsService.FriendProfile?
    @State private var tauntStatus: String?
    /// D2 step 3: the global Records screen (Hall of Fame, all-time boards)
    /// is reached from here now that the Stats row is gone.
    @State private var showRecords = false
    /// Today's completed dailies (seeded instantly from the on-device cache) so
    /// the Play CTA knows "View vs Play" with zero flash, before the per-mode
    /// leaderboard rank loads.
    @StateObject private var completions = DailyCompletionsStore()
    // Play CTA → launch the selected mode's daily (GameScreen, or ProperNoundle).
    @State private var lbGame: LbGame?
    @State private var lbSolved: LbGame?   // already-finished daily → read-only solved board
    @State private var showPNDaily = false
    struct LbGame: Identifiable { let id = UUID(); let mode: GameMode; let title: String }

    /// Every daily-recordable mode — sweep tiles AND More Games titles (incl.
    /// ProperNoundle, which has a dbKey but no GameMode enum on its HomeMode —
    /// its leaderboard keys off the dbKey). Lookup only (title/icon/accent of
    /// the picked mode); VS is excluded (no daily leaderboard).
    private let pickerModes: [HomeMode] = (homeModes + moreModes).filter { $0.dbKey != nil }

    /// The default board paints from the cache in the FIRST frame (founder, 2026-09-29: opening the
    /// tab showed "No daily results yet · 0 players" for a frame before load() ran). The player's
    /// own row folds in on appear (paintCachedBoard), before the network.
    init(path: Binding<[String]>) {
        _path = path
        let key = LeaderboardCache.key(mode: .duel, userId: AuthService.shared.profile?.id)
        if let c = LeaderboardCache.shared[key] {
            _entries = State(initialValue: c.entries)
            _playerCount = State(initialValue: c.playerCount)
            _userRank = State(initialValue: c.userRank)
            _rankWindow = State(initialValue: c.rankWindow)
        } else {
            _loading = State(initialValue: true)
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                PageBackground(tint: .leaderboard)
                VStack(spacing: 0) {
                    AppHeaderView()
                    if !auth.isAuthenticated { signedOut } else { content }
                }
                .wideColumn(.page)   // §AG: iPad column, centered on the wallpaper
            }
            .environment(\.pageTint, .leaderboard)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
            .fullScreenCover(item: $lbGame) { g in
                NavigationStack {
                    // A More Games title opens ITS view (which starts or restores today's daily).
                    if let id = CustomDailyView.customId(for: g.mode) { CustomDailyView(id: id) }
                    else { GameScreen(seed: DailySeed.today(mode: g.mode), mode: g.mode, title: g.title) }
                }
            }
            .fullScreenCover(item: $lbSolved) { g in
                // Read-only reconstruction (matches the home "View Solved Puzzle"),
                // so a finished daily never reopens as a fresh playable board.
                // Custom engines show their own finished screen instead (founder, 2026-09-27).
                NavigationStack {
                    if let id = CustomDailyView.customId(for: g.mode) { CustomDailyView(id: id) }
                    else { SolvedPuzzleView(mode: g.mode, title: g.title) }
                }
            }
            .fullScreenCover(isPresented: $showPNDaily) {
                NavigationStack { ProperNoundleView() }
            }
            // §225: this sheet's OWN NavigationStack never registered a String
            // destination, so friend rows animated on tap but navigated
            // nowhere (the pushed path resolves via line above; sheets don't
            // inherit the outer stack's destinations).
            .sheet(isPresented: $showFriendsSheet) {
                NavigationStack {
                    FriendsScreenView()
                        .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
                }
            }
            // §214 (Lindsay): the post-game "View Leaderboard" capsule lands
            // here with its mode preselected (root switches the tab).
            .onReceive(NotificationCenter.default.publisher(for: NextDailyCTA.openLeaderboard)) { note in
                guard let key = note.object as? String, let gm = GameMode(rawValue: key) else { return }
                NextDailyCTA.pendingLeaderboardMode = nil
                selectMode(gm)
            }
            // §264: the tab may not have EXISTED when the note was posted (TabView
            // builds tabs lazily) — pick the requested mode up on appear instead.
            .onAppear {
                if let key = NextDailyCTA.pendingLeaderboardMode, let gm = GameMode(rawValue: key) {
                    NextDailyCTA.pendingLeaderboardMode = nil
                    selectMode(gm)
                }
            }
        }
    }

    /// FINISH_SPEC §C2 play card: a tinted card in the game's accent (its own top bar,
    /// §A1), the game's title art, "N players today", and the medium glossy candy
    /// VIEW BOARD (pink) / PLAY (purple) — never the old tall blob.
    private var playCtaCard: some View {
        // The whole catalog — the More Games titles are not in the home grid, and the
        // fallback showed their raw keys ("SCRAMBLE", "HUB") with no icon (founder, 2026-09-27).
        let m = (homeModes + moreModes).first { $0.dbKey == mode.rawValue }
        let accent = ModeStyle.accent(mode)
        // ART_SPEC §10 / §14: the game's title art (lettering + host, filling the room
        // left of Play, ≤ 56 pt tall) stands in for the name text and the host beside Play.
        let titleArt = GameTitleArt.forMode(mode)
        // FINISH_SPEC §AS4: one compact row — small art, one line of text, a small candy button.
        return HStack(spacing: 8) {
            if titleArt == nil, let m { ModeIconView(icon: m.icon, accent: m.accent, box: 26) }
            if let titleArt {
                GameTitleArtView(asset: titleArt.asset, label: titleArt.label, maxHeight: 30, maxWidth: 130,
                                 alignment: .leading)
                    .fixedSize()
            } else {
                Text(m?.title ?? mode.rawValue).font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            HStack(spacing: 4) {
                Image(systemName: "person.2.fill").font(.system(size: 10, weight: .bold))
                // No count yet (nothing cached for this mode) → a redacted bar, not "0 players".
                if loading && playerCount == 0 {
                    Text("000 today").font(Brand.font(11, .heavy)).redacted(reason: .placeholder)
                } else {
                    Text("\(playerCount) today").font(Brand.font(11, .heavy))
                }
            }
            .foregroundStyle(FinishInk.secondary)
            .lineLimit(1).minimumScaleFactor(0.7)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(playerCount) player\(playerCount == 1 ? "" : "s") today")
            Spacer(minLength: 4)
            // Already finished today's daily for this mode → open the read-only
            // solved board, matching the home cards. The cached completions
            // answer instantly; userRank confirms once the leaderboard loads.
            let played = completions.byMode[mode.rawValue] != nil || userRank != nil
            Button {
                let title = m?.title ?? mode.rawValue
                if played { lbSolved = LbGame(mode: mode, title: title) }
                else if mode == .propernoundle { showPNDaily = true }
                else { lbGame = LbGame(mode: mode, title: title) }
            } label: {
                // FINISH_SPEC §A8 / §C2: a medium glossy candy pill — purple PLAY,
                // pink→purple VIEW BOARD.
                CandyLabel(title: played ? "View board" : "Play", symbol: played ? "eye.fill" : "play.fill")
            }
            .buttonStyle(CandyButtonStyle(variant: played ? .pink : .purple, size: .small, fullWidth: false))
            .layoutPriority(2)
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .tintedCard(accent: accent, bar: [accent, accent.wash(0.55)], radius: 16, barHeight: 4)
    }

    /// The Sweep board's play card in the same family (gold): the glossy broom, the
    /// name and its existing explanation instead of Play.
    private var sweepCtaCard: some View {
        let accent = GamePicker.sweepAccent
        return HStack(spacing: 12) {
            if ArtAsset.exists("game-sweep") {
                GameArtImage(asset: "game-sweep", size: 44)
            } else {
                ModeIconView(icon: .asset("broom"), accent: accent, box: 32)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Daily Sweep").font(Brand.font(17, .black)).foregroundStyle(FinishInk.heading)
                    .accessibilityAddTraits(.isHeader)
                // §223 microcopy: the sweep board pre-answers "why is 9/9 below
                // 8/9" — it ranks by points, not wins.
                Text("Ranked by total points across all modes").font(Brand.font(12, .heavy))
                    .foregroundStyle(FinishInk.secondary).lineLimit(2).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 12)
        .tintedCard(accent: accent, bar: [Color(hex: 0xF5A524), Color(hex: 0xFFD166)])
    }

    /// The bare share icon used by every board header.
    private func shareIcon(busy: Bool, label: String, action: @escaping () -> Void) -> some View {
        LbShareButton(busy: busy, label: label, action: action)
    }

    /// "YESTERDAY’S WINNERS" + chevron (the collapsible toggle) as a tinted chip.
    private var yesterdayToggle: some View {
        Button { showYesterday.toggle() } label: {
            HStack(spacing: 6) {
                LbSectionLabel("YESTERDAY\u{2019}S WINNERS")
                Image(systemName: showYesterday ? "chevron.up" : "chevron.down")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(Theme.isDark ? Theme.textMuted : Color(hex: 0x8A6A55))
            }
            .padding(.horizontal, 12).frame(height: 30)
            .tintedPill(LbStyle.gold)
            .contentShape(Capsule())
        }
        .buttonStyle(.squish)
    }

    /// The loading rows inside the cream board card (no bare skeleton on the wallpaper).
    private var boardSkeleton: some View { LeaderboardSkeleton().lbCard() }

    private var signedOut: some View {
        VStack(spacing: 16) {
            placeholder(icon: "trophy.fill", title: "Sign in to see rankings",
                        subtitle: "Daily leaderboards are available to signed-in players.")
            Button { showAuth = true } label: {
                CandyLabel(title: "Sign in", symbol: "person.crop.circle.fill")
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: .large, fullWidth: false))
        }
        .padding(.top, 24)
        .sheet(isPresented: $showAuth) { AuthView() }
    }

    private var content: some View {
        ScrollView {
            VStack(spacing: 12) {
                // §A6 / §C2: the day title as the headline, then the shared game picker
                // window (date + reset clock + ALL-TIME on its header strip; the Sweep
                // is the 9th WORDOCIOUS tile).
                LeaderboardBannerView(selected: modeSelection, isSweep: sweepSelection,
                                      onAllTime: { showRecords = true }, bleed: 16)
                if isSweep {
                    sweepBoard
                } else {
                    perModeBoard
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
            // Clear the banner+nav: every sibling tab hardcodes 72–80pt here,
            // but this tab never got ANY — invisible until Yesterday's Winners
            // made the page tall enough to cut off (founder screenshot). The
            // measured inset also handles the taller free-tier banner+nav stack
            // that the siblings' magic 72 quietly under-clears.
            .padding(.bottom, 16 + max(56, chrome.bottomInset))   // §AS3: + 16 pt breathing room
        }
        .reportsScrollMotion()   // §AQ2
        .sheet(isPresented: $showRecords) { RecordsTab().presentationDetents([.large]) }
        // Before the first frame: the selected board from the cache with the player's own row
        // (load() repeats this, but only after the render).
        .onAppear { if isSweep { paintCachedSweep() } else { paintCachedBoard() } }
        .task(id: "\(mode.rawValue)-\(reloadToken)-\(friendsOnly)-\(friendsVersion)") { await load() }
        .task(id: "sweep-\(isSweep)-\(reloadToken)") { if isSweep { await loadSweep() } }
        // Warms the modes the user has NOT opened yet today (§253). Keyed on
        // the tab's reload token, not the selected mode, so switching chips
        // does not restart the sweep from the top.
        .task(id: "prefetch-\(reloadToken)-\(friendsOnly)") { await prefetchOtherBoards() }
        // Yesterday's Winners keys on the MODE too (web/Android parity) — it
        // used to fetch only on toggle-open, so switching chips while the
        // dropdown was expanded kept showing the previous mode's podium until
        // you closed and reopened it.
        .task(id: "yesterday-\(mode.rawValue)-\(isSweep)-\(showYesterday)-\(friendsOnly)-\(friendsVersion)") {
            guard showYesterday else { return }
            await loadYesterday()
        }
        .task { if auth.isAuthenticated { await FriendsService.load() } }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            friendsVersion = FriendsService.version
        }
        .sheet(item: $tauntTarget) { target in tauntSheet(target) }
        .task { await completions.load() }
        .onDailyCompletion { Task { await completions.load() } }
        .onDailyRecorded { reloadToken += 1 }
        // The player's own result can land after the board was painted: fold it in right away.
        .onChange(of: completions.byMode[mode.rawValue]?.score) { _ in
            let (rows, n, mineRank) = withMine(entries, playerCount)
            guard rows.count != entries.count else { return }
            entries = rows; playerCount = n
            if userRank == nil { userRank = mineRank }
        }
    }

    /// The cross-mode Sweep board — players who completed every sweep daily today,
    /// ranked by total composite score. Same card stack as the per-mode board.
    @ViewBuilder private var sweepBoard: some View {
        // §AS4: your rank first, the standings next, the explainer row after them.
        if let r = sweepRank {
            let mine = sweepEntries.first { $0.userId.lowercased() == auth.profile?.id.lowercased() }
            LbResultCard(rank: r.rank, ofLine: "of \(r.total)",
                         line: mine.map { sweepResultLine($0, day: LeaderboardService.todayLocal()) },
                         points: mySweepScore.map { sweepScoreLabels[$0] ?? formatScore($0) },
                         compact: true,
                         delta: { rankDelta(r, friends: false) })
        }

        HStack(alignment: .center, spacing: 8) {
            LbSectionLabel("TODAY\u{2019}S BOARD")
            Spacer(minLength: 4)
            // §231: the same share icon as the per-mode board — today's sweep
            // board card with the sharer's sweep rank.
            if !sweepLoading && !sweepEntries.isEmpty {
                shareIcon(busy: sharingLb, label: "Share sweep leaderboard") {
                    guard !sharingLb else { return }
                    sharingLb = true
                    LeaderboardShareFlow.shareSweep(
                        podium: false, entries: sweepEntries,
                        userId: auth.profile?.id, userRank: sweepRank)
                    sharingLb = false
                }
            }
        }
        .padding(.top, 4).padding(.leading, 4)

        if sweepLoading {
            boardSkeleton
        } else if sweepEntries.isEmpty {
            MascotMessage(scene: .asleep, line: "No sweeps yet today. Be the first!")
                .frame(maxWidth: .infinity).padding(.vertical, 28)
            .lbCard()
        } else {
            VStack(spacing: 0) {
                ForEach(Array(sweepEntries.enumerated()), id: \.element.id) { idx, entry in
                    sweepRow(rank: entry.rank, entry: entry)
                        .stripedRow(idx, accent: LbStyle.gold)
                }
            }
            .lbCard()
        }

        sweepCtaCard

        // Yesterday's Winners — same toggle as the per-mode board, but the
        // podium is yesterday's top sweepers (rank/pill from the sweep RPC).
        HStack(spacing: 8) {
            yesterdayToggle
            Spacer(minLength: 4)
            // §231: settled sweep-podium share — only once the dropdown is
            // open with rows (per-mode parity).
            if showYesterday && !yesterdaySweep.isEmpty {
                shareIcon(busy: sharingPodium, label: "Share yesterday's sweep podium") {
                    guard !sharingPodium else { return }
                    sharingPodium = true
                    LeaderboardShareFlow.shareSweep(
                        podium: true, entries: yesterdaySweep,
                        userId: auth.profile?.id)
                    sharingPodium = false
                }
            }
        }
        .padding(.top, 4)
        if showYesterday {
            if ySweepKnown == nil {
                boardSkeleton
            } else if yesterdaySweep.isEmpty {
                Text("No sweeps yesterday")
                    .font(Brand.font(13, .heavy)).foregroundStyle(FinishInk.secondary)
                    .frame(maxWidth: .infinity).padding(24).multilineTextAlignment(.center)
                    .lbCard()
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(yesterdaySweep.enumerated()), id: \.element.id) { idx, entry in
                        yesterdaySweepRow(entry)
                            .stripedRow(idx, accent: LbStyle.gold)
                    }
                }
                .lbCard()
            }
        }
    }

    /// "Flawless · 8/8 won · 33m 10s" — how the player's sweep went (result card).
    private func sweepResultLine(_ e: SweepEntry, day: String) -> String {
        "\(e.isFlawless ? "Flawless" : "Swept") · \(e.modesWon)/\(ModeGen.requiredSweepCount(for: day)) won · \(formatShortTime(e.totalTime))"
    }

    /// Sweep-yesterday row — full detail (founder ask, Aug 17): the RPC
    /// already returns time + modes for any day, so mirror today's sweepRow
    /// shape (name over "time · X/9" + dots + pill; points in their column).
    private func yesterdaySweepRow(_ entry: SweepEntry) -> some View {
        LbBoardRow(rank: entry.rank, userId: entry.userId, username: entry.username,
                   avatarUrl: entry.avatarUrl, won: nil,
                   points: ySweepScoreLabels[entry.totalScore] ?? formatScore(entry.totalScore)) {
            // Yesterday's rows read yesterday's settled streaks (web/Android parity).
            LbSweepRowInfo(entry: entry, isMe: false, details: ySweepDetails[entry.userId],
                           day: LeaderboardService.yesterdayLocal(),
                           streak: yFlawlessStreaks[entry.userId] ?? 0)
        }
        .padding(.horizontal, 4)
    }

    /// Everyone | Friends repaints its cached board in the same transaction (founder,
    /// 2026-09-29: a frame of the global rows and "of N" under "Friends").
    private var friendsBinding: Binding<Bool> {
        Binding(get: { friendsOnly }, set: { f in instantly { friendsOnly = f; paintCachedBoard() } })
    }

    /// The completed-daily dropdown (your solved board + score breakdown). .id(mode) →
    /// a fresh card per mode so switching away from one mode can't render the previous
    /// mode's board data (which trapped when a board mode rendered stale ProperNoundle
    /// data mid-transition).
    @ViewBuilder private var completedCard: some View {
        if mode.isCustomEngine { CustomCompletedDailyCard(mode: mode).id(mode) } else { CompletedDailyCard(mode: mode).id(mode) }
    }

    @ViewBuilder private var perModeBoard: some View {
        // FINISH_SPEC §AS4: what matters first — YOUR result / rank, then the
        // standings; the compact play row and the rest follow.
        // §C2: ONE result card — your rank, how you solved it and your points, with the
        // completed-daily dropdown as its footer. Nothing known yet → the dropdown alone.
        modeResult

        HStack(alignment: .center, spacing: 8) {
            LbSectionLabel("TODAY\u{2019}S BOARD")
            Spacer(minLength: 4)
            // FRIENDS toggle (§207) — Everyone | Friends, the shared soft segmented toggle.
            if auth.isAuthenticated {
                SoftSegmented(options: [(key: false, label: "Everyone"), (key: true, label: "Friends")],
                              selection: friendsBinding, accent: LbStyle.gold,
                              accessibilityLabel: "Everyone or Friends")
            }
            if !loading && !entries.isEmpty {
                shareIcon(busy: sharingLb, label: "Share leaderboard") {
                    guard !sharingLb else { return }
                    sharingLb = true
                    Task {
                        await LeaderboardShareFlow.shareDaily(
                            mode: mode, playType: "solo",
                            entries: entries, rankWindow: rankWindow,
                            userId: auth.profile?.id, userRank: userRank,
                            friends: friendsOnly)
                        sharingLb = false
                    }
                }
            }
        }
        .padding(.top, 4).padding(.leading, 4)

        if loading {
            boardSkeleton   // web parity: animate-pulse rows, not a spinner
        } else if entries.isEmpty {
            if friendsOnly && !ghostFriends.isEmpty {
                // Nobody's played yet — the friends list still renders
                // as ghost rows so the board feels alive (and tauntable).
                VStack(spacing: 0) {
                    ForEach(Array(ghostFriends.enumerated()), id: \.element.id) { idx, f in
                        ghostRow(f).stripedRow(idx, accent: LbStyle.gold)
                    }
                }
                .lbCard()
            } else {
                VStack(spacing: 8) {
                    // The cast (MASCOT_SPEC §6, ART_SPEC §7): I's invite scene grows the
                    // circle; R asleep says it's quiet in here.
                    MascotMessage(scene: friendsOnly ? .invite : .asleep,
                                  line: friendsOnly ? Mascots.addFriendLine : "No daily results yet. Be the first!")
                    // Tier 2 (Aug 11): the empty Friends board is the
                    // best recruiting surface in the app — use it.
                    if friendsOnly {
                        Button { showFriendsSheet = true } label: {
                            CandyLabel(title: "Add friends", symbol: "person.badge.plus")
                        }
                        .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium, fullWidth: false))
                        .padding(.top, 4)
                    }
                }
                .frame(maxWidth: .infinity).padding(.vertical, 40)
                .lbCard()
            }
        } else {
            todayBoard
        }
        // Founder-approved clarity: this board ranks DAILY games
        // only — Unlimited runs never appear here (the founder's
        // sister played Unlimited and looked for her name).
        Text("Daily games only").font(Brand.font(10, .heavy))
            .foregroundStyle(FinishInk.secondary)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.top, -6).padding(.trailing, 4)

        // §AS4: the game + Play / View board as ONE compact row under the standings.
        playCtaCard

        HStack(spacing: 8) {
            yesterdayToggle
            Spacer(minLength: 4)
            // Settled-podium share — only once the dropdown is open with rows.
            if showYesterday && !yesterday.isEmpty {
                shareIcon(busy: sharingPodium, label: "Share yesterday's podium") {
                    guard !sharingPodium else { return }
                    sharingPodium = true
                    Task {
                        await LeaderboardShareFlow.sharePodium(
                            mode: mode, playType: "solo",
                            top3: yesterday, userId: auth.profile?.id,
                            friends: friendsOnly)
                        sharingPodium = false
                    }
                }
            }
        }
        if showYesterday {
            if yesterdayKnown == nil {
                boardSkeleton
            } else if yesterday.isEmpty {
                Text("No results from yesterday")
                    .font(Brand.font(13, .heavy)).foregroundStyle(FinishInk.secondary)
                    .frame(maxWidth: .infinity).padding(24).multilineTextAlignment(.center)
                    .lbCard()
            } else {
                // Full daily rows (founder ask, Aug 11): profile links, guesses + time
                // detail, W/L badge — the top three on the podium when they're 1-2-3.
                // §217: exact (score, time) ties share the rank.
                let ranks = yesterday.indices.map { LeaderboardService.competitionRank(yesterday, $0) }
                let podium = !friendsOnly && LbStyle.podiumFits(ranks)
                let start = podium ? 3 : 0
                VStack(spacing: 0) {
                    if podium {
                        PodiumView(entries: yesterday.prefix(3).map { podiumEntry($0, labels: yLbScoreLabels) },
                                   onTap: { path.append($0.id) })
                    }
                    ForEach(Array(yesterday.enumerated().dropFirst(start)), id: \.element.id) { idx, entry in
                        row(rank: ranks[idx], entry: entry, scoreLabels: yLbScoreLabels)
                            .stripedRow(idx - start, accent: LbStyle.gold)
                    }
                }
                .lbCard()
            }
        }
    }

    /// Today's board in ONE cream card: the top three on the podium (letter-tile
    /// avatars, crown on 1st — tapping a place opens that player, as their row did),
    /// then the rest as soft striped rows. The Friends board keeps plain rows so every
    /// friend keeps the taunt bell; exact ties at the top keep plain rows too.
    private var todayBoard: some View {
        // §217: exact (score, time) ties share the rank.
        let ranks = entries.indices.map { LeaderboardService.competitionRank(entries, $0) }
        let podium = !friendsOnly && LbStyle.podiumFits(ranks)
        let start = podium ? 3 : 0
        let shown = entries.count - start
        let windowCount = rankWindow?.entries.count ?? 0
        return VStack(spacing: 0) {
            if podium {
                PodiumView(entries: entries.prefix(3).map { podiumEntry($0, labels: lbScoreLabels) },
                           onTap: { path.append($0.id) })
            }
            ForEach(Array(entries.enumerated().dropFirst(start)), id: \.element.id) { idx, entry in
                row(rank: ranks[idx], entry: entry)
                    .stripedRow(idx - start, accent: LbStyle.gold)
            }
            // "Your neighborhood" — rows around the user's rank when
            // they placed past the top 50 (web daily page parity).
            if let win = rankWindow {
                Text("···").font(Brand.font(15, .black)).foregroundStyle(FinishInk.secondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 4)
                    .accessibilityLabel("More players")
                ForEach(Array(win.entries.enumerated()), id: \.element.id) { idx, entry in
                    row(rank: win.startRank + idx, entry: entry)
                        .stripedRow(shown + idx, accent: LbStyle.gold)
                }
            }
            // FRIENDS ghost rows — friends who haven't played this
            // mode today, muted, with the taunt bell (§207).
            if friendsOnly {
                ForEach(Array(ghostFriends.enumerated()), id: \.element.id) { idx, f in
                    ghostRow(f).stripedRow(shown + windowCount + idx, accent: LbStyle.gold)
                }
            }
        }
        .lbCard()
    }

    /// One podium place from a board row (tie-aware points).
    private func podiumEntry(_ e: LeaderboardEntry, labels: [Double: String]) -> PodiumEntry {
        let isMe = e.userId == auth.profile?.id
        return PodiumEntry(id: e.userId, name: isMe ? "You" : e.username, username: e.username,
                           emoji: e.profiles.avatarEmoji,
                           value: labels[e.compositeScore] ?? formatScore(e.compositeScore))
    }

    /// The player's own points on the selected board (their row, else today's cached result).
    private var myModeScore: Double? {
        guard let uid = auth.profile?.id.lowercased() else { return nil }
        let rows = entries + (rankWindow?.entries ?? [])
        return rows.first { $0.userId.lowercased() == uid }?.compositeScore
            ?? completions.byMode[mode.rawValue]?.score
    }

    /// The player's own total on the Sweep board.
    private var mySweepScore: Double? {
        guard let uid = auth.profile?.id.lowercased() else { return nil }
        return sweepEntries.first { $0.userId.lowercased() == uid }?.totalScore
    }

    /// The player's own row on the selected board (top list or the rank window).
    private var myModeRow: LeaderboardEntry? {
        guard let uid = auth.profile?.id.lowercased() else { return nil }
        return (entries + (rankWindow?.entries ?? [])).first { $0.userId.lowercased() == uid }
    }

    /// Today's cached completion for the selected mode (only when it IS today's).
    private var myCompletion: DailyCompletion? {
        guard completions.dataDay == LeaderboardService.todayLocal() else { return nil }
        return completions.byMode[mode.rawValue]
    }

    /// FINISH_SPEC §C2: ONE result card (the old "completed today" card + "your rank"
    /// merged): crown + rank, "OF N TODAY" (or friends) + the movement badge, how you
    /// solved it, your points, and the completed-daily dropdown as its footer.
    @ViewBuilder private var modeResult: some View {
        let mine = myModeRow
        let done = myCompletion
        if userRank != nil || mine != nil || done != nil {
            let friends = friendsOnly
            let won = mine?.completed ?? done?.completed ?? false
            // §AU2: the compact one-row card — "of 5" (friends: "of 5 friends").
            let ofLine = userRank.map { r in friends ? "of \(r.total) friends" : "of \(r.total)" }
                ?? (won ? "Completed today" : "Attempted today")
            let line: String? = mine.map {
                lbSolveLine(mode: mode, completed: $0.completed, guessCount: $0.guessCount, timeSeconds: $0.timeSeconds,
                            boardsSolved: $0.boardsSolved, totalBoards: $0.totalBoards)
            } ?? done.map {
                lbSolveLine(mode: mode, completed: $0.completed, guessCount: $0.guessCount, timeSeconds: $0.timeSeconds,
                            boardsSolved: $0.boardsSolved, totalBoards: $0.totalBoards)
            }
            LbResultCard(rank: userRank?.rank, ofLine: ofLine, line: line,
                         points: myModeScore.map { lbScoreLabels[$0] ?? formatScore($0) },
                         compact: true,
                         delta: { if let r = userRank { rankDelta(r, friends: friends) } },
                         footer: { LbResultFooter { completedCard } })
        } else {
            completedCard
        }
    }

    /// Transient "+N/−N" movement pill since you last looked (web parity). Friends mode
    /// keeps its own memory — a friend-rank must never compare against a stored global rank.
    private func rankDelta(_ r: (rank: Int, total: Int), friends: Bool) -> some View {
        RankDeltaBadge(mode: mode.rawValue, playType: "solo",
                       pageKey: friends ? "daily-friends" : "daily",
                       currentRank: r.rank)
    }

    /// One board row (§C2a): rank, letter-tile avatar, name over the detail line, the
    /// W / L badge in its own column left of the points (soft number).
    private func row(rank: Int, entry: LeaderboardEntry, scoreLabels: [Double: String]? = nil) -> some View {
        let isMe = entry.userId == auth.profile?.id
        // §212: photo → emoji → initial, left of every username — the
        // boards wear faces, not just names (web lbAvatar parity).
        // Doug's Aug-16 feedback: name on top, stats underneath, points alone on the right.
        return LbBoardRow(rank: rank, userId: entry.userId, username: entry.username,
                          avatarUrl: entry.profiles.avatarUrl, emoji: entry.profiles.avatarEmoji,
                          won: entry.completed,
                          points: (scoreLabels ?? lbScoreLabels)[entry.compositeScore] ?? formatScore(entry.compositeScore)) {
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    LbRowName(name: entry.username, isMe: isMe)
                    if entry.userId == crownId { Icon3D(.crown, size: 15, label: "This week's leader") }
                }
                LbRowSub(text: detail(entry))
            }
        } trailing: {
            // Friends board: one-tap canned taunt on any friend's row (§207).
            if friendsOnly && !isMe {
                Button {
                    tauntTarget = .init(id: entry.userId, username: entry.username,
                                        avatar_url: entry.profiles.avatarUrl, level: 0,
                                        since: nil, requestedAt: nil)
                } label: {
                    Icon3D(.bell, size: 18) // ART_SPEC §5
                        .frame(width: 30, height: 34).contentShape(Rectangle())
                }
                .buttonStyle(.squishIcon)
                .accessibilityLabel("Taunt \(entry.username)")
            }
        }
        .youRow(isMe)
    }

    /// §216: on the FRIENDS board, the week's points leader wears the crown.
    private var crownId: String? {
        guard friendsOnly else { return nil }
        _ = friendsVersion
        var entries = FriendsService.friends.map { (id: $0.id, pts: $0.weekPoints ?? 0) }
        if let uid = auth.profile?.id {
            entries.append((id: uid, pts: FriendsService.meDigest?.weekPoints ?? 0))
        }
        entries.sort { $0.pts > $1.pts }
        guard let top = entries.first, top.pts > 0 else { return nil }
        return top.id
    }

    /// FRIENDS ghost row — a friend who hasn't played this mode today, in the
    /// standard row shell at muted opacity. The taunt bell is the point.
    private var ghostFriends: [FriendsService.FriendProfile] {
        _ = friendsVersion // re-derive when the friends cache changes
        return FriendsService.friends.filter { f in
            !entries.contains { $0.userId == f.id } && !ModerationService.isBlocked(f.id)
        }
    }

    /// One ghost row (§C2a shell, no rank / points), muted, with the taunt bell.
    private func ghostRow(_ f: FriendsService.FriendProfile) -> some View {
        LbBoardRow(rank: nil, userId: f.id, username: f.username, avatarUrl: f.avatar_url) {
            VStack(alignment: .leading, spacing: 1) {
                LbRowName(name: f.username)
                LbRowSub(text: "Hasn't played yet")
            }
        } trailing: {
            Button { tauntTarget = f } label: {
                Icon3D(.bell, size: 18) // ART_SPEC §5
                    .frame(width: 30, height: 34).contentShape(Rectangle())
            }
            .buttonStyle(.squishIcon)
            .accessibilityLabel("Nudge \(f.username)")
        }
        .padding(.horizontal, 4)
        .opacity(0.55)
    }

    /// Canned-taunt picker (§207): fixed phrases, one per friend per day. The phrases
    /// are tinted option cards (they carry emoji, so no outlined candy text); Cancel is
    /// the quiet peach candy button.
    private func tauntSheet(_ target: FriendsService.FriendProfile) -> some View {
        let accent = Color(hex: 0x7C3AED)
        return VStack(spacing: 12) {
            FinishLabel("Taunt \(target.username)", color: Color(hex: 0x5B3C96))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20).padding(.top, 20)
            if let status = tauntStatus {
                Text(status).font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                    .frame(maxWidth: .infinity).padding(.vertical, 32)
            } else {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(FriendTaunts.all) { taunt in
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
                                Text(taunt.text).font(Brand.font(14, .heavy)).foregroundStyle(FinishInk.heading)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 11)
                                    .tintedPill(accent, radius: 14)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.squish)
                        }
                    }
                    .padding(.horizontal, 16).padding(.vertical, 4)
                }
                Button { tauntTarget = nil } label: {
                    CandyLabel(title: "Cancel")
                }
                .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium))
                .padding(.horizontal, 16)
            }
            Spacer(minLength: 0)
        }
        .padding(.bottom, 12)
        .background((Theme.isDark ? Theme.surface : FinishInk.lavender).ignoresSafeArea())
        .presentationDetents([.medium])
    }

    private func detail(_ e: LeaderboardEntry) -> String {
        // Web parity: time as "Ns" / "Nm Ns" (formatTime in app/daily/page.tsx), not M:SS.
        let t = formatShortTime(Int(e.timeSeconds))
        // Through the mode's guess semantics (ModeStats.guessRowLabel, web daily
        // page parity): "4 Guesses", "0 Mistakes", "5 Checks", "Par", "Hubbub".
        let meta = ModeGen.byDbKey(mode.rawValue)
        var s = "\(WordociousCore.ModeStats.guessRowLabel(semantics: meta?.guessSemantics ?? "guesses", guessBase: meta?.guessBase ?? 1, guessCount: e.guessCount)) · \(t)"
        if e.totalBoards > 1 { s += " · \(e.boardsSolved)/\(e.totalBoards)" }
        if HINT_BEARING_MODES.contains(mode.rawValue), let h = e.hintsUsed { s += h > 0 ? " · \(h) hint\(h == 1 ? "" : "s")" : " · No hints" }
        return s
    }

    /// A sweep-board row — the per-mode row shell (§C2a): rank, avatar, name over
    /// "total time · X/9 · guesses · hints" + the dot strip with the FLAWLESS/SWEEP
    /// pill; no W / L badge (the slot stays empty), the total in the points column.
    private func sweepRow(rank: Int, entry: SweepEntry) -> some View {
        let isMe = entry.userId == auth.profile?.id
        // §212: faces on the sweep board too (RPC has no emoji column — photo → initial here).
        return LbBoardRow(rank: rank, userId: entry.userId, username: entry.username,
                          avatarUrl: entry.avatarUrl, won: nil,
                          points: sweepScoreLabels[entry.totalScore] ?? formatScore(entry.totalScore)) {
            LbSweepRowInfo(entry: entry, isMe: isMe, details: sweepDetails[entry.userId],
                           day: LeaderboardService.todayLocal(),
                           streak: flawlessStreaks[entry.userId] ?? 0)
        }
        .youRow(isMe)
    }

    /// §253: warm the OTHER modes' boards in the background so a chip tap
    /// paints instantly instead of starting a fresh round trip.
    ///
    /// Persisting the cache fixed cold starts, but only for boards already
    /// visited that day — with nine modes, each one was still a skeleton the
    /// first time it was opened. This fills those slots ahead of the tap.
    ///
    /// Deliberately a trickle, not a burst: it starts only after the visible
    /// board has had a moment, runs one mode at a time with a gap between, and
    /// SKIPS anything already cached (load()'s revalidate owns freshness). Rank
    /// and window are left nil — load() fills those when the mode is opened for
    /// real, and they are the part nobody sees on first paint anyway.
    private func prefetchOtherBoards() async {
        guard !friendsOnly else { return }
        try? await Task.sleep(nanoseconds: 1_200_000_000)
        guard !Task.isCancelled else { return }
        let uid = auth.profile?.id
        let others = homeModes.compactMap(\.dbKey).compactMap { GameMode(rawValue: $0) }
        for m in others where m != mode {
            guard !Task.isCancelled else { return }
            let key = LeaderboardCache.key(mode: m, userId: uid)
            if LeaderboardCache.shared[key] != nil { continue }
            async let rowsOpt = try? LeaderboardService.fetch(gameMode: m)
            async let countV = LeaderboardService.playerCount(gameMode: m)
            let rows = await rowsOpt
            let count = await countV
            guard !Task.isCancelled else { return }
            guard let rows else { continue }
            LeaderboardCache.shared[key] = .init(
                entries: rows, playerCount: count, userRank: nil, rankWindow: nil)
            try? await Task.sleep(nanoseconds: 300_000_000)
        }
    }

    /// The player's own daily result on the board at once (founder, 2026-09-29: "Completed today"
    /// was instant but the leaderboard showed "No daily results yet" until a refetch). Built from
    /// today's completion the phone already holds and placed by (score desc, time asc) — the
    /// server's order — whenever the rows in hand don't include the player yet.
    private func withMine(_ rows: [LeaderboardEntry], _ count: Int) -> ([LeaderboardEntry], Int, (rank: Int, total: Int)?) {
        guard let p = auth.profile, let c = completions.byMode[mode.rawValue], c.score > 0,
              completions.dataDay == LeaderboardService.todayLocal(),
              !rows.contains(where: { $0.userId.lowercased() == p.id.lowercased() }) else { return (rows, count, nil) }
        let mine = LeaderboardEntry(
            userId: p.id, compositeScore: c.score, guessCount: c.guessCount, timeSeconds: c.timeSeconds,
            boardsSolved: c.boardsSolved ?? (c.completed ? 1 : 0), totalBoards: c.totalBoards ?? 1, hintsUsed: c.hintsUsed,
            vsWins: nil, vsLosses: nil, vsGames: nil, completed: c.completed,
            profiles: .init(username: p.username, avatarUrl: p.avatarUrl, avatarEmoji: p.avatarEmoji))
        var out = rows
        let i = out.firstIndex { $0.compositeScore < c.score || ($0.compositeScore == c.score && $0.timeSeconds > c.timeSeconds) } ?? out.count
        // Past a full top-50 list the player's row belongs in the rank window, not here.
        if i >= 50 { return (rows, count, nil) }
        out.insert(mine, at: i)
        let total = max(count + 1, out.count)
        return (out, total, (rank: i + 1, total: total))
    }

    /// A mode tap sets the mode AND paints that mode's cached board in the same update (founder,
    /// 2026-09-29: switching showed one frame of the new header over the previous mode's rows and
    /// count before load() — which only runs after the render — swapped them).
    private var modeSelection: Binding<GameMode> {
        Binding(get: { mode }, set: { new in instantly { mode = new; paintCachedBoard() } })
    }

    /// Post-game "View Leaderboard" hand-off — the same one-transaction paint as a tile tap.
    private func selectMode(_ gm: GameMode) {
        instantly { isSweep = false; mode = gm; paintCachedBoard() }
    }

    /// The Sweep tile paints the cached sweep board in the same transaction as the selection
    /// (founder, 2026-09-29: one frame of "No sweeps yet today. Be the first!" before loadSweep ran).
    private var sweepSelection: Binding<Bool> {
        Binding(get: { isSweep }, set: { on in instantly { isSweep = on; if on { paintCachedSweep() } } })
    }

    /// Paints the selected board (mode + All/Friends) from the cache with the player's own row
    /// folded in — no network. Nothing cached → the player's row alone, else the skeleton.
    private func paintCachedBoard() {
        let key = LeaderboardCache.key(mode: mode, userId: auth.profile?.id) + (friendsOnly ? ":friends" : "")
        if let cached = LeaderboardCache.shared[key] {
            let (rows, n, mineRank) = withMine(cached.entries, cached.playerCount)
            entries = rows; playerCount = n
            userRank = cached.userRank ?? mineRank ?? rowsRank(rows, n)
            rankWindow = cached.rankWindow; loading = false
        } else {
            let seeded = withMine([], 0)
            entries = seeded.0; playerCount = seeded.1; userRank = seeded.2; rankWindow = nil
            loading = seeded.0.isEmpty
        }
    }

    /// The player's rank read off the rows in hand when they're on the list — the same
    /// (competition rank, total) LeaderboardService.userRank returns for a top-list hit. The
    /// prefetched boards cache no rank, so the banner used to pop in (pushing the board down)
    /// only after the rank query (founder, 2026-09-29).
    private func rowsRank(_ rows: [LeaderboardEntry], _ count: Int) -> (rank: Int, total: Int)? {
        guard let uid = auth.profile?.id.lowercased(),
              let i = rows.firstIndex(where: { $0.userId.lowercased() == uid }) else { return nil }
        return (LeaderboardService.competitionRank(rows, i), rows.count < 50 ? rows.count : max(count, rows.count))
    }

    private func paintCachedSweep() {
        if let cached = SweepCache.shared.daily(SweepCache.dailyKey()) {
            sweepEntries = cached.entries
            sweepRank = cached.userRank
            sweepDetails = cached.details
            sweepLoading = false
        } else {
            sweepLoading = true
            sweepRank = nil
            sweepEntries = []
            sweepDetails = [:]
        }
    }

    private func load() async {
        // Stale-while-revalidate (web parity: lbCache in app/daily/page.tsx) —
        // a cache hit paints the last-known rows instantly (no skeleton) while
        // the fresh fetch below swaps in silently. Skeleton = true first load only.
        let cacheKey = LeaderboardCache.key(mode: mode, userId: auth.profile?.id)
            + (friendsOnly ? ":friends" : "")
        // Cached board (or the player's own row, or the skeleton) — the same paint a tap does.
        paintCachedBoard()

        // FRIENDS board (§207): one fetch restricted to friends∪me holds the
        // whole board — rank is the dense index, no rank query or window.
        if friendsOnly, let uid = auth.profile?.id {
            let ids = Array(Set(FriendsService.friendIds).union([uid.lowercased()]))
            let fetchedOpt = try? await LeaderboardService.fetch(gameMode: mode, userIds: ids)
            guard !Task.isCancelled else { return }
            guard let fetched = fetchedOpt else { loading = false; return }
            let (shown, shownCount, _) = withMine(fetched, fetched.count)
            entries = shown
            playerCount = shownCount
            loading = false
            // §217: exact (score, time) ties share the rank on the friends board too.
            let rank: (rank: Int, total: Int)? = fetched
                .firstIndex { $0.userId == uid }
                .map { (rank: LeaderboardService.competitionRank(fetched, $0), total: fetched.count) }
            userRank = rank
            rankWindow = nil
            LeaderboardCache.shared[cacheKey] = .init(
                entries: fetched, playerCount: fetched.count, userRank: rank, rankWindow: nil)
            return
        }

        async let e = try? LeaderboardService.fetch(gameMode: mode)
        async let pc = LeaderboardService.playerCount(gameMode: mode)
        let fetchedOpt = await e
        let count = await pc
        // .task(id:) cancels this on mode switch, but the awaits above aren't
        // cancellation-checked — bail before assigning so a slow prior-mode
        // response can't overwrite the new mode's rows.
        guard !Task.isCancelled else { return }
        // Network error (nil, not an empty day): keep whatever is showing —
        // cached rows beat clobbering them with a blank list, and never cache
        // the failure.
        guard let fetched = fetchedOpt else { loading = false; return }
        // Paint the rows the moment they arrive — the rank banner fills in on
        // its own instead of holding the whole list behind its extra queries.
        // A result recorded a moment ago may not be in them yet: keep the player's own row.
        let (shown, shownCount, mineRank) = withMine(fetched, count)
        entries = shown
        playerCount = shownCount
        loading = false
        // The banner lands WITH the rows when the player is on them (the rank query only refines it).
        if userRank == nil { userRank = mineRank ?? rowsRank(shown, shownCount) }

        var rank: (rank: Int, total: Int)? = nil
        var win: (startRank: Int, entries: [LeaderboardEntry])? = nil
        if let uid = auth.profile?.id {
            rank = await LeaderboardService.userRank(gameMode: mode, userId: uid, topEntries: fetched)
            guard !Task.isCancelled else { return }
            userRank = rank ?? mineRank
            // Ranked past the visible list → also fetch the rows around them.
            if let r = rank, r.rank > 50 {
                win = await LeaderboardService.fetchRankWindow(gameMode: mode, userRank: r.rank)
                guard !Task.isCancelled else { return }
            }
            rankWindow = win
        }
        LeaderboardCache.shared[cacheKey] = .init(entries: fetched, playerCount: count, userRank: rank, rankWindow: win)
    }

    private func loadYesterday() async {
        if isSweep {
            let day = LeaderboardService.yesterdayLocal()
            let rows = (try? await SweepLeaderboardService.fetchDailySweep(day: day, limit: 5)) ?? []
            guard !Task.isCancelled else { return }
            ySweepByDay[day] = rows
            // §223: dot-strip + guess/hint detail rides in behind the rows —
            // the podium paints first, dots fill in when the fetch lands.
            let details = await LeaderboardService.fetchSweepModeDetails(
                day: day, userIds: rows.map(\.userId))
            guard !Task.isCancelled else { return }
            ySweepDetails = details
            // §248: streaks as they stood at yesterday's settled board.
            let streaks = await LeaderboardService.fetchFlawlessStreaks(
                day: day, userIds: rows.filter(\.isFlawless).map(\.userId))
            guard !Task.isCancelled else { return }
            yFlawlessStreaks = streaks
            return
        }
        // Friends toggle carries into Yesterday's Winners: podium among friends.
        let key = yesterdayKey
        var ids: [String]? = nil
        if friendsOnly, let uid = auth.profile?.id {
            ids = Array(Set(FriendsService.friendIds).union([uid.lowercased()]))
        }
        let rows = (try? await LeaderboardService.fetch(
            gameMode: mode, day: LeaderboardService.yesterdayLocal(), limit: 5, userIds: ids)) ?? []
        // .task(id:) cancels this on a mode switch — don't let the previous
        // mode's slow response overwrite the new mode's podium.
        guard !Task.isCancelled else { return }
        yesterdayByKey[key] = rows
    }

    /// Loads the daily-sweep board (stale-while-revalidate, same shape as load()).
    private func loadSweep() async {
        let cacheKey = SweepCache.dailyKey()
        paintCachedSweep()

        let fetchedOpt = try? await SweepLeaderboardService.fetchDailySweep()
        guard !Task.isCancelled else { return }
        guard let fetched = fetchedOpt else { sweepLoading = false; return }
        sweepEntries = fetched
        sweepLoading = false

        // §223: dot-strip + guess/hint detail rides in behind the rows — the
        // board paints first, dots fill in when the fetch lands (web parity).
        let details = await LeaderboardService.fetchSweepModeDetails(
            day: LeaderboardService.todayLocal(), userIds: fetched.map(\.userId))
        guard !Task.isCancelled else { return }
        sweepDetails = details
        // §248: only rows already FLAWLESS can be on a live streak.
        let streaks = await LeaderboardService.fetchFlawlessStreaks(
            day: LeaderboardService.todayLocal(),
            userIds: fetched.filter(\.isFlawless).map(\.userId))
        guard !Task.isCancelled else { return }
        flawlessStreaks = streaks

        var rank: (rank: Int, total: Int)? = nil
        if let uid = auth.profile?.id {
            rank = await SweepLeaderboardService.dailySweepRank(userId: uid)
            guard !Task.isCancelled else { return }
            sweepRank = rank
        }
        SweepCache.shared.setDaily(cacheKey, .init(entries: fetched, userRank: rank, details: details))
    }
}

let HINT_MODES: Set<String> = ["DUEL_6", "DUEL_7", "PROPERNOUNDLE"]
/// Every mode with a hint button — rows show " · N hints" / " · No hints" for all of them (web
/// HINT_BEARING_MODES; founder, 2026-09-30: a Codebreaker row hid 4 hints that explained the ranking).
let HINT_BEARING_MODES: Set<String> = ["DUEL_6", "DUEL_7", "PROPERNOUNDLE", "SUDOKU", "REGIONS", "LADDER", "WORDSEARCH", "HUB", "CRYPTOGRAM", "GROUPS", "CROSSWORD", "SCRAMBLE"]

// §223: guesses (and hints) are the numbers that actually explain the
// ranking — the formula is guess-first, so 9 slow wins can trail 8 sharp
// ones (founder double-take, Aug 18). Details still loading → the plain
// line, never a blocked row. §232: file-scope (was private to the daily
// board) so Records' daily-sweep rows render the identical line — the web
// twin lives in components/leaderboard/sweep-mode-dots.tsx for the same
// reason (founder ask, Aug 24: Records must match).
func sweepStatsLine(_ entry: SweepEntry, details: LeaderboardService.SweepDetails?, day: String) -> String {
    // §227: full words — the founder read "2h" as hours-since-completion.
    // Room comes from the pill living on the dots row, not this line.
    // The denominator is that day's sweep-era size (Stage 4/9), never a literal.
    var s = "\(formatShortTime(entry.totalTime)) · \(entry.modesWon)/\(ModeGen.requiredSweepCount(for: day))"
    if let d = details {
        s += " · \(d.guesses) guess\(d.guesses == 1 ? "" : "es")"
        if d.hints > 0 { s += " · \(d.hints) hint\(d.hints == 1 ? "" : "s")" }
    }
    return s
}

/// A sweep row's info column (Leaderboard + Records, §232 parity): the name, the
/// "time · X/9 · guesses · hints" line (§246: wraps, never truncates), then the
/// SweepModeDots strip with the FLAWLESS / SWEEP pill riding it (§227).
struct LbSweepRowInfo: View {
    let entry: SweepEntry
    var isMe: Bool = false
    let details: LeaderboardService.SweepDetails?
    let day: String
    var streak: Int = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            LbRowName(name: entry.username, isMe: isMe)
            LbRowSub(text: sweepStatsLine(entry, details: details, day: day), lines: 3)
            HStack(spacing: 6) {
                SweepModeDots(details: details, day: day)
                sweepPill(isFlawless: entry.isFlawless, streak: streak)
            }
        }
    }
}

/// §223: the Sweep board's mode-dot strip. Order = that day's sweep set in
/// catalog order (ModeGen.sweepModes(for:)), so a pre-Stage-9 day still shows
/// its ProperNoundle dot and a post-launch day shows eight.
/// One dot per mode, graded ABSOLUTELY — intensity is the score as a fraction
/// of that mode's theoretical ceiling, never a comparison to the field, so the
/// strip reads identically with three players or three thousand (founder call,
/// Aug 18: relative "best on board" dies in a crowd). Red = loss, hollow =
/// not played. The [0.35, 0.9] remap spreads real-world ratios (~0.4–0.9)
/// across the full visual range. Mirrors SweepModeDots in app/daily/page.tsx.
struct SweepModeDots: View {
    let details: LeaderboardService.SweepDetails?
    let day: String

    private var dotModes: [String] { ModeGen.sweepModes(for: day) }

    var body: some View {
        if let details {
            HStack(spacing: 3) {
                ForEach(dotModes, id: \.self) { mode in
                    dot(details.modes[mode], mode: mode)
                }
            }
            .accessibilityLabel("Per-mode results")
        }
    }

    @ViewBuilder private func dot(_ d: LeaderboardService.SweepModeDetail?, mode: String) -> some View {
        if let d {
            if d.completed {
                let ratio = d.score / DailyScoring.modeScoreCeiling(gameMode: mode, dateKey: day)
                let t = min(1, max(0, (ratio - 0.35) / 0.55))
                Circle().fill(Color(hex: 0x7C3AED).opacity(0.18 + 0.82 * t))
                    .frame(width: 7, height: 7)
            } else {
                Circle().fill(Color(hex: 0xEF4444)).frame(width: 7, height: 7)
            }
        } else {
            Circle().stroke(Theme.border, lineWidth: 1).frame(width: 7, height: 7)
        }
    }
}

/// Sweep-board rank pill — GOLD "FLAWLESS" (won every sweep mode) vs VIOLET "SWEEP"
/// (completed every sweep mode but dropped a board). Mirrors the per-mode Win/Loss pill
/// shape; the sweep-celebration colors (amber #D97706 / violet #A78BFA).
@ViewBuilder func sweepPill(isFlawless: Bool, streak: Int = 0) -> some View {
    let color = isFlawless ? Color(hex: 0xD97706) : Color(hex: 0xA78BFA)
    // §248: a live streak shows its length on the pill — "FLAWLESS ×4".
    Text(isFlawless ? (streak >= 2 ? "FLAWLESS ×\(streak)" : "FLAWLESS") : "SWEEP").font(Brand.font(9, .heavy))
        .foregroundStyle(color)
        // The §223 g/h stats can squeeze this row — the pill never wraps or
        // truncates (the "FLAWLES\nS" lesson from the Android port); the
        // stats text is the flexible element.
        .lineLimit(1).fixedSize()
        .padding(.horizontal, 5).padding(.vertical, 1)
        .background(RoundedRectangle(cornerRadius: 4).fill(color.opacity(0.14)))
}

/// Selector buttons (banner game tiles, pill switches): no pressed-state fade: `.plain` dims a tile while pressed and eases it back after release, so the
/// newly selected tile read as unselected for ~0.15 s after every tap (founder, 2026-09-29).
struct InstantButtonStyle: ButtonStyle {
    /// FINISH_SPEC §A9: still no fade, but the shared squish.
    func makeBody(configuration: Configuration) -> some View {
        SquishButtonStyle().makeBody(configuration: configuration).contentShape(Rectangle())
    }
}

/// One un-animated transaction: a selection and the cached content it paints land in the SAME
/// frame, with nothing easing in (founder, 2026-09-29).
@MainActor func instantly(_ body: () -> Void) {
    var t = Transaction(); t.disablesAnimations = true
    withTransaction(t, body)
}

@ViewBuilder
func placeholder(icon: String, title: String, subtitle: String) -> some View {
    VStack(spacing: 12) {
        SymbolGlyph(icon, size: 56, color: Theme.primary.opacity(0.7))
        Text(title).font(Brand.headline()).foregroundStyle(Theme.textPrimary)
        Text(subtitle).font(Brand.body(14)).foregroundStyle(Theme.textSecondary)
            .multilineTextAlignment(.center).padding(.horizontal, 40)
    }
}

/// §244 (founder: "I just got my third flawless victory in a row and I have
/// no way of easily identifying that or even show it off"): the flawless
/// banner's footer — streak-aware copy ("3-DAY FLAWLESS STREAK") plus the
/// share button for the brag card. Self-contained fetch so the banner view
/// builder stays state-free.
struct FlawlessBannerFooter: View {
    let total: Int
    /// The Stats tab's session memo in the first frame (founder, 2026-09-29: the streak line popped in
    /// above the footer after .task, pushing the card taller).
    @State private var sweep: MatchStatsService.DailySweepStats =
        StatsMemo.shared.get("sweepStats:\(StatsMemo.uid)") ?? MatchStatsService.DailySweepStats()
    @State private var sharing = false

    var body: some View {
        VStack(spacing: 2) {
            if sweep.currentFlawlessStreak >= 2 {
                HStack(spacing: 4) {
                    Icon3D(.trophy, size: 16)
                    Text("\(sweep.currentFlawlessStreak)-DAY FLAWLESS STREAK")
                        .font(Brand.font(13, .black)).tracking(0.5).foregroundStyle(A11yInk.on(Color(hex: 0xB45309)))
                }
            }
            HStack(spacing: 6) {
                Text("All \(total) dailies won today · +600 XP earned")
                    .font(Brand.font(11, .heavy)).foregroundStyle(A11yInk.on(Color(hex: 0xB45309)))
                if sweep.currentFlawlessStreak >= 1 {
                    Button {
                        guard !sharing else { return }
                        sharing = true
                        LeaderboardShareFlow.shareFlawlessStreak(
                            streak: sweep.currentFlawlessStreak,
                            bestStreak: sweep.bestFlawlessStreak,
                            username: AuthService.shared.profile?.username)
                        sharing = false
                    } label: {
                        Icon3D(.share, size: 14)
                    }
                    .buttonStyle(.squishIcon)
                    .opacity(sharing ? 0.4 : 1)
                    .accessibilityLabel("Share flawless streak")
                }
            }
        }
        .task { sweep = await MatchStatsService.dailySweepStats() }
    }
}


