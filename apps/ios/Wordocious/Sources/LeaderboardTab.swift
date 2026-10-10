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
    /// 2.8 item 14: scroll-driven header fade + condense.
    @StateObject private var headerScroll = HeaderScrollModel()
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
                    AppHeaderView(scroll: headerScroll)
                    if !auth.isAuthenticated { signedOut } else { content }
                }
                .frame(maxHeight: .infinity, alignment: .top)   // BI23: header pinned
                .wideColumn(.page)   // §AG: iPad column, centered on the wallpaper
            }
            .environment(\.pageTint, .leaderboard)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
            .gameCover(item: $lbGame, hint: { $0.mode.rawValue }) { g in
                NavigationStack {
                    // A More Games title opens ITS view (which starts or restores today's daily).
                    if let id = CustomDailyView.customId(for: g.mode) { CustomDailyView(id: id) }
                    else { GameScreen(seed: DailySeed.today(mode: g.mode), mode: g.mode, title: g.title) }
                }
            }
            .gameCover(item: $lbSolved) { g in
                // Read-only reconstruction (matches the home "View Solved Puzzle"),
                // so a finished daily never reopens as a fresh playable board.
                // Custom engines show their own finished screen instead (founder, 2026-09-27).
                NavigationStack {
                    if let id = CustomDailyView.customId(for: g.mode) { CustomDailyView(id: id) }
                    else { SolvedPuzzleView(mode: g.mode, title: g.title) }
                }
            }
            .gameCover(isPresented: $showPNDaily) {
                NavigationStack { ProperNoundleView() }
            }
            // §225: this sheet's OWN NavigationStack never registered a String
            // destination, so friend rows animated on tap but navigated
            // nowhere (the pushed path resolves via line above; sheets don't
            // inherit the outer stack's destinations).
            .softSheet(isPresented: $showFriendsSheet) {
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

    // MARK: - The living stage (items 11 + 11b)

    /// The stage's tint: the selected game's accent (the Sweep's gold on the Sweep board).
    /// The stage podium's fixed height (tallest case: 1st with crown + three-line plaques), so switching games never shifts.
    static let stagePodiumHeight: CGFloat = 240
    private var stageAccent: Color { isSweep ? GamePicker.sweepAccent : ModeStyle.accent(mode) }

    /// Opens today's solved board (the old VIEW BOARD) or the daily to play, exactly as before.
    private func openMyBoard(played: Bool) {
        let m = (homeModes + moreModes).first { $0.dbKey == mode.rawValue }
        let title = m?.title ?? mode.rawValue
        GameTransition.shared.arm("lb:play")   // BJ9: the game grows from this strip
        if played { lbSolved = LbGame(mode: mode, title: title) }
        else if mode == .propernoundle { showPNDaily = true }
        else { lbGame = LbGame(mode: mode, title: title) }
    }

    /// "#2 of 5 · 2,005 PTS · Solved in 4 · 48s" — your rank + stats on ONE line; "Not played yet" before.
    private var modeRankLine: String {
        let mine = myModeRow
        let done = myCompletion
        guard userRank != nil || mine != nil || done != nil else { return "Not played yet" }
        let won = mine?.completed ?? done?.completed ?? false
        let ofLine = userRank.map { r in friendsOnly ? "of \(r.total) friends" : "of \(r.total)" }
            ?? (won ? "Completed today" : "Attempted today")
        let line: String? = mine.map {
            lbSolveLine(mode: mode, completed: $0.completed, guessCount: $0.guessCount, timeSeconds: $0.timeSeconds,
                        boardsSolved: $0.boardsSolved, totalBoards: $0.totalBoards)
        } ?? done.map {
            lbSolveLine(mode: mode, completed: $0.completed, guessCount: $0.guessCount, timeSeconds: $0.timeSeconds,
                        boardsSolved: $0.boardsSolved, totalBoards: $0.totalBoards)
        }
        var parts = [userRank.map { "#\($0.rank) \(ofLine)" } ?? ofLine]
        if let p = myModeScore { parts.append("\(lbScoreLabels[p] ?? formatScore(p)) PTS") }
        if let line { parts.append(line) }
        return parts.joined(separator: " · ")
    }

    /// The selected-game strip: the game's title art, "N today", YOUR rank + stats, and one compact button —
    /// PLAY before today's daily, the Your board pill (= the old VIEW BOARD) after.
    private var modeStrip: some View {
        let m = (homeModes + moreModes).first { $0.dbKey == mode.rawValue }
        let accent = ModeStyle.accent(mode)
        let titleArt = GameTitleArt.forMode(mode)
        let played = completions.byMode[mode.rawValue] != nil || userRank != nil
        return HStack(spacing: 8) {
            if titleArt == nil, let m { ModeIconView(icon: m.icon, accent: m.accent, box: 28) }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    if let titleArt {
                        let shown = SeasonKit.title(titleArt.asset)
                        let size = LeaderboardArt.cardTitleSize(shown)
                        ArtThumbs.image(shown, points: LeaderboardArt.cardTitlePoints)
                            .resizable().interpolation(.high).scaledToFit()
                            .frame(maxWidth: size.width, maxHeight: size.height)
                            .accessibilityLabel(titleArt.label)
                            .accessibilityAddTraits(.isHeader)
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
                    .lineLimit(1).fixedSize().layoutPriority(1)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(playerCount) player\(playerCount == 1 ? "" : "s") today")
                }
                HStack(spacing: 6) {
                    Text(modeRankLine)
                        .font(Brand.font(11.5, .black))
                        .foregroundStyle(Theme.isDark ? Theme.textSecondary : LbStyle.goldInk)
                        .lineLimit(1).minimumScaleFactor(0.65)
                    if let r = userRank { rankDelta(r, friends: friendsOnly) }
                }
            }
            Spacer(minLength: 4)
            if played {
                YourBoardPill(accent: stageAccent) { openMyBoard(played: true) }
            } else {
                Button { openMyBoard(played: false) } label: { CandyLabel(title: "Play", symbol: "play.fill") }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .small, fullWidth: false))
                    .layoutPriority(2)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 4)
        // One fixed height for every game, so switching games never nudges the podium below.
        .frame(minHeight: max(LeaderboardArt.cardHeight, 46))
        .gameLaunchSource("lb:play", color: accent.wash(0.10), radius: 16)
    }

    /// The Sweep board's strip in the same family: the glossy broom, the name + its explainer, your sweep rank.
    private var sweepStrip: some View {
        HStack(spacing: 10) {
            if ArtAsset.exists("game-sweep") {
                GameArtImage(asset: "game-sweep", size: 38)
            } else {
                ModeIconView(icon: .asset("broom"), accent: GamePicker.sweepAccent, box: 30)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Daily Sweep · \(sweepEntries.count) swept").font(Brand.font(14, .black)).foregroundStyle(FinishInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .accessibilityAddTraits(.isHeader)
                // §223: the sweep board ranks by points, not wins.
                Text(sweepRankLine).font(Brand.font(11.5, .black))
                    .foregroundStyle(Theme.isDark ? Theme.textSecondary : LbStyle.goldInk)
                    .lineLimit(1).minimumScaleFactor(0.65)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14).padding(.vertical, 4)
        .frame(minHeight: 46)
    }

    private var sweepRankLine: String {
        guard let r = sweepRank else { return "Ranked by total points across all modes" }
        let mine = sweepEntries.first { $0.userId.lowercased() == auth.profile?.id.lowercased() }
        var parts = ["#\(r.rank) of \(r.total)"]
        if let p = mySweepScore { parts.append("\(sweepScoreLabels[p] ?? formatScore(p)) PTS") }
        if let mine { parts.append(sweepResultLine(mine, day: LeaderboardService.todayLocal())) }
        return parts.joined(separator: " · ")
    }

    /// The bare share icon used by every board header.
    private func shareIcon(busy: Bool, label: String, action: @escaping () -> Void) -> some View {
        LbShareButton(busy: busy, label: label, action: action)
    }

    /// The loading rows inside the cream board card (no bare skeleton on the wallpaper).
    private var boardSkeleton: some View { LeaderboardSkeleton().lbCard() }

    /// FINISH_SPEC BI23: O2 hosts the signed-out pitch, centered BELOW the pinned header.
    private var signedOut: some View {
        // BJ16 quick win: the LEADERBOARD page title above the pitch.
        VStack(spacing: 0) {
        PageHeadline(.leaderboard, bleed: 12).padding(.top, 4)
        GuestPitch(hosts: [Mascots.leaderboard], title: "Climb the boards",
                   subtitle: "Sign in to see today's rankings and earn medals.",
                   colors: [Color(hex: 0xF59E0B), Color(hex: 0xEA580C)],
                   preview: .podium, onSignIn: { showAuth = true })
        }
            .softSheet(isPresented: $showAuth) { AuthView() }
    }

    private var content: some View {
        ScrollView {
            // BJ7: 10 between blocks (was 12).
            VStack(spacing: 10) {
                // §A6 / §C2: the day title as the headline, then the shared game picker
                // window (date + reset clock + ALL-TIME on its header strip; the Sweep
                // is the 9th WORDOCIOUS tile).
                // 11 + 11b: ONE living stage — the day's bubble title with your mascot + the day's host, the picker
                // (no card), the selected-game strip, the podium and Yesterday's ledge on one continuous backdrop in
                // the game's tint; ranks 4+ and your finished board list below it.
                LeaderboardStageCard(accent: stageAccent) {
                    LeaderboardBannerView(selected: modeSelection, isSweep: sweepSelection,
                                          bleed: 16,
                                          results: completions.dataDay == LeaderboardService.todayLocal() ? completions.byMode.mapValues { $0.completed } : [:],
                                          sweepResult: completions.dataDay == LeaderboardService.todayLocal() && completions.allDone ? true : nil)
                    if isSweep { sweepStageBody } else { modeStageBody }
                }
                if isSweep { sweepRanksBlock } else { modeRanksBlock }
                if isSweep { sweepYesterdayBlock } else { modeYesterdayBlock }
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
            .background(alignment: .top) { HeaderScrollProbe() }   // 2.8 item 14
            // Clear the banner+nav: every sibling tab hardcodes 72–80pt here,
            // but this tab never got ANY — invisible until Yesterday's Winners
            // made the page tall enough to cut off (founder screenshot). The
            // measured inset also handles the taller free-tier banner+nav stack
            // that the siblings' magic 72 quietly under-clears.
            .padding(.bottom, 16 + max(56, chrome.bottomInset))   // §AS3: + 16 pt breathing room
        }
        .reportsScrollMotion()   // §AQ2
        .headerScrollFade(headerScroll)   // 2.8 item 14
        .softSheet(isPresented: $showRecords) { RecordsTab().presentationDetents([.large]) }
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
        // (It loads as soon as the board is up, not only on open: the ledge under the podium shows yesterday's winners,
        // or collapses to one calm line when nobody played.)
        .task(id: "yesterday-\(mode.rawValue)-\(isSweep)-\(friendsOnly)-\(friendsVersion)") {
            await loadYesterday()
        }
        .task { if auth.isAuthenticated { await FriendsService.load() } }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            friendsVersion = FriendsService.version
        }
        .softSheet(item: $tauntTarget) { target in tauntSheet(target) }
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

    /// The cross-mode Sweep board — players who completed every sweep daily today, ranked by total composite
    /// score. The stage holds the strip, the podium and Yesterday's ledge; ranks 4+ list below it.
    @ViewBuilder private var sweepStageBody: some View {
        sweepStrip

        // The podium's header line: share (the Sweep has no Everyone/Friends split).
        HStack {
            Spacer(minLength: 0)
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
        .padding(.horizontal, 12).frame(minHeight: 30)

        if sweepLoading {
            LeaderboardSkeleton().padding(.horizontal, 12).padding(.bottom, 8)
        } else if sweepEntries.isEmpty {
            // BI24: brand headline over R asleep's voice line.
            BrandEmptyState(title: "No sweeps yet", line: "Nobody has swept today. Be the first!", scene: .asleep, artHeight: 100)
                .frame(maxWidth: .infinity).padding(.vertical, 8)
        } else {
            let layout = PodiumLayout.layout(sweepEntries.map(\.rank))
            if layout.filled > 0 {
                PodiumView(entries: sweepEntries.prefix(layout.filled).map { sweepPodiumEntry($0, labels: sweepScoreLabels, details: sweepDetails, day: LeaderboardService.todayLocal()) },
                           open: layout.open, stage: nil, onTap: { path.append($0.id) })
                    .frame(minHeight: Self.stagePodiumHeight, alignment: .bottom)
            }
        }

    }

    /// Founder 10-09: Yesterday sits UNDER today's last player (it used to split the podium from today's rows):
    /// a small copy of the podium (top three + stats + glows), tap to open everyone else.
    @ViewBuilder private var modeYesterdayBlock: some View {
        // The stage's base: Yesterday's top three on the ledge; tap to expand the full list in place.
        let yRanks = yesterday.indices.map { LeaderboardService.competitionRank(yesterday, $0) }
        let yLayout = PodiumLayout.layout(yRanks)
        StageYesterdayLedge(
            minis: yesterday.prefix(yLayout.filled).enumerated().map { podiumEntry($1, rank: yRanks[$0], labels: yLbScoreLabels) },
            open: $showYesterday, loading: yesterdayKnown == nil,
            share: {
                // Settled-podium share — only with rows.
                if !yesterday.isEmpty {
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
            },
            expanded: {
                if yesterdayKnown == nil {
                    boardSkeleton
                } else if yesterday.isEmpty {
                    BrandEmptyState(title: "Quiet yesterday", line: "No results from yesterday. Today's board is wide open.",
                                    scene: .asleep, artHeight: 90)
                        .lbCard()
                } else {
                    // Full daily rows (founder ask, Aug 11): profile links, guesses + time detail, W/L badge.
                    VStack(spacing: 0) {
                        ForEach(Array(yesterday.enumerated().dropFirst(yLayout.filled)), id: \.element.id) { idx, entry in
                            row(rank: yRanks[idx], entry: entry, scoreLabels: yLbScoreLabels)
                                .stripedRow(idx - yLayout.filled, accent: LbStyle.gold)
                        }
                    }
                    .lbCard()
                }
            })
    }

    @ViewBuilder private var sweepYesterdayBlock: some View {
        // The stage's base: Yesterday's top sweepers on the ledge; tap to expand the full list in place.
        let yLayout = PodiumLayout.layout(yesterdaySweep.map(\.rank))
        StageYesterdayLedge(
            minis: yesterdaySweep.prefix(yLayout.filled).map { sweepPodiumEntry($0, labels: ySweepScoreLabels, details: ySweepDetails, day: LeaderboardService.yesterdayLocal()) },
            open: $showYesterday, loading: ySweepKnown == nil,
            share: {
                // §231: settled sweep-podium share — only with rows.
                if !yesterdaySweep.isEmpty {
                    shareIcon(busy: sharingPodium, label: "Share yesterday's sweep podium") {
                        guard !sharingPodium else { return }
                        sharingPodium = true
                        LeaderboardShareFlow.shareSweep(podium: true, entries: yesterdaySweep, userId: auth.profile?.id)
                        sharingPodium = false
                    }
                }
            },
            expanded: {
                if ySweepKnown == nil {
                    boardSkeleton
                } else if yesterdaySweep.isEmpty {
                    BrandEmptyState(title: "No sweeps yesterday", line: "Nobody cleared every daily. Today's board is wide open.",
                                    scene: .asleep, artHeight: 90)
                        .lbCard()
                } else {
                    sweepPodiumBoard(yesterdaySweep, labels: ySweepScoreLabels, details: ySweepDetails, day: LeaderboardService.yesterdayLocal()) { yesterdaySweepRow($0) }
                }
            })
    }

    /// Sweep ranks 4+ below the stage (the podium places live on the stage).
    @ViewBuilder private var sweepRanksBlock: some View {
        let layout = PodiumLayout.layout(sweepEntries.map(\.rank))
        if !sweepLoading, sweepEntries.count > layout.filled {
            VStack(spacing: 0) {
                ForEach(Array(sweepEntries.enumerated().dropFirst(layout.filled)), id: \.element.id) { idx, entry in
                    sweepRow(rank: entry.rank, entry: entry).stripedRow(idx - layout.filled, accent: LbStyle.gold)
                }
            }
            .lbCard()
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

    /// Per-mode stage: the strip, the Everyone/Friends + share line, the podium (or its empty state), and
    /// Yesterday's ledge as the base. Ranks 4+, the completed-daily card and the daily-only note sit below it.
    @ViewBuilder private var modeStageBody: some View {
        modeStrip

        // The podium's header line: Everyone | Friends (§207) on the left, share on the right.
        HStack(alignment: .center, spacing: 8) {
            if auth.isAuthenticated {
                SoftSegmented(options: [(key: false, label: "Everyone"), (key: true, label: "Friends")],
                              selection: friendsBinding, accent: LbStyle.gold,
                              accessibilityLabel: "Everyone or Friends")
            }
            Spacer(minLength: 4)
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
        .padding(.horizontal, 12).frame(minHeight: 34)

        if loading {
            LeaderboardSkeleton().padding(.horizontal, 12).padding(.bottom, 8)   // animate-pulse rows, not a spinner
        } else if entries.isEmpty {
            if friendsOnly && !ghostFriends.isEmpty {
                EmptyView()   // the ghost rows list below the stage
            } else {
                VStack(spacing: 8) {
                    // The cast (MASCOT_SPEC §6, ART_SPEC §7): I's invite scene grows the circle; R asleep says it's quiet in here.
                    BrandEmptyState(title: friendsOnly ? "Your board is empty" : "No results yet",
                                    line: friendsOnly ? Mascots.addFriendLine : "Nobody has finished today. Be the first!",
                                    scene: friendsOnly ? .invite : .asleep)
                    // Tier 2 (Aug 11): the empty Friends board is the best recruiting surface in the app — use it.
                    if friendsOnly {
                        Button { showFriendsSheet = true } label: {
                            CandyLabel(title: "Add friends", symbol: "person.badge.plus")
                        }
                        .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium, fullWidth: false))
                        .padding(.top, 4)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: Self.stagePodiumHeight).padding(.vertical, 24)
            }
        } else {
            // §217: exact (score, time) ties share the rank. BJ4: the podium from ONE result up, open spots for the rest.
            let ranks = entries.indices.map { LeaderboardService.competitionRank(entries, $0) }
            let layout = PodiumLayout.layout(ranks)
            if layout.filled > 0 {
                PodiumView(entries: entries.prefix(layout.filled).enumerated().map { podiumEntry($1, rank: ranks[$0], labels: lbScoreLabels) },
                           open: layout.open, stage: nil, onTap: { path.append($0.id) })
                    // Founder 10-09: one fixed podium height for every game (no shift while clicking through the boards).
                    .frame(minHeight: Self.stagePodiumHeight, alignment: .bottom)
            }
        }

    }

    /// Ranks 4+ (plus your neighborhood and the friends' ghost rows), then the daily-only note and your finished board.
    @ViewBuilder private var modeRanksBlock: some View {
        if !loading {
            if entries.isEmpty {
                if friendsOnly && !ghostFriends.isEmpty {
                    // Nobody's played yet — the friends list still renders as ghost rows so the board feels alive (and tauntable).
                    VStack(spacing: 0) {
                        ForEach(Array(ghostFriends.enumerated()), id: \.element.id) { idx, f in
                            ghostRow(f).stripedRow(idx, accent: LbStyle.gold)
                        }
                    }
                    .lbCard()
                }
            } else {
                let ranks = entries.indices.map { LeaderboardService.competitionRank(entries, $0) }
                let start = PodiumLayout.layout(ranks).filled
                let shown = entries.count - start
                let windowCount = rankWindow?.entries.count ?? 0
                if shown > 0 || rankWindow != nil || (friendsOnly && !ghostFriends.isEmpty) {
                    VStack(spacing: 0) {
                        ForEach(Array(entries.enumerated().dropFirst(start)), id: \.element.id) { idx, entry in
                            row(rank: ranks[idx], entry: entry)
                                .stripedRow(idx - start, accent: LbStyle.gold)
                        }
                        // "Your neighborhood" — rows around the user's rank when they placed past the top 50 (web daily page parity).
                        if let win = rankWindow {
                            Text("···").font(Brand.font(15, .black)).foregroundStyle(FinishInk.secondary)
                                .frame(maxWidth: .infinity).padding(.vertical, 4)
                                .accessibilityLabel("More players")
                            ForEach(Array(win.entries.enumerated()), id: \.element.id) { idx, entry in
                                row(rank: win.startRank + idx, entry: entry)
                                    .stripedRow(shown + idx, accent: LbStyle.gold)
                            }
                        }
                        // FRIENDS ghost rows — friends who haven't played this mode today, muted, with the taunt bell (§207).
                        if friendsOnly {
                            ForEach(Array(ghostFriends.enumerated()), id: \.element.id) { idx, f in
                                ghostRow(f).stripedRow(shown + windowCount + idx, accent: LbStyle.gold)
                            }
                        }
                    }
                    .lbCard()
                }
            }
        }
        // Founder-approved clarity: this board ranks DAILY games only — Unlimited runs never appear here.
        Text("Daily games only").font(Brand.font(10, .heavy))
            .foregroundStyle(FinishInk.secondary)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.top, -6).padding(.trailing, 4)

        // Your finished board (the completed-daily dropdown): your rank + points now live on the strip.
        completedCard
    }

    /// One podium place from a board row (tie-aware points). BJ5: the row's photo + look —
    /// the same avatar the rows draw (the own place resolves from the live profile).
    private func podiumEntry(_ e: LeaderboardEntry, rank: Int, labels: [Double: String]) -> PodiumEntry {
        let isMe = e.userId.lowercased() == auth.profile?.id.lowercased()
        let bell: (() -> Void)? = friendsOnly && !isMe ? {
            tauntTarget = .init(id: e.userId, username: e.username, avatar_url: e.profiles.avatarUrl, level: 0,
                                since: nil, requestedAt: nil)
        } : nil
        return PodiumEntry(id: e.userId, name: isMe ? "You" : e.username, username: e.username,
                           accentHex: e.profiles.accentColor, emoji: e.profiles.avatarEmoji,
                           value: labels[e.compositeScore] ?? formatScore(e.compositeScore),
                           avatarUrl: e.profiles.avatarUrl, rank: rank, bell: bell, detail: detail(e))
    }

    /// One podium place from a Sweep row.
    private func sweepPodiumEntry(_ e: SweepEntry, labels: [Double: String],
                                  details: [String: LeaderboardService.SweepDetails], day: String) -> PodiumEntry {
        let isMe = e.userId.lowercased() == auth.profile?.id.lowercased()
        return PodiumEntry(id: e.userId, name: isMe ? "You" : e.username, username: e.username,
                           value: labels[e.totalScore] ?? formatScore(e.totalScore),
                           avatarUrl: e.avatarUrl, rank: e.rank,
                           detail: sweepStatsLine(e, details: details[e.userId], day: day))
    }

    /// BJ4: a Sweep board (today / yesterday) with its leaders on the gold stage.
    @ViewBuilder private func sweepPodiumBoard(_ rows: [SweepEntry], labels: [Double: String],
                                               details: [String: LeaderboardService.SweepDetails], day: String,
                                               row: @escaping (SweepEntry) -> some View) -> some View {
        let layout = PodiumLayout.layout(rows.map(\.rank))
        VStack(spacing: 0) {
            if layout.filled > 0 {
                PodiumView(entries: rows.prefix(layout.filled).map { sweepPodiumEntry($0, labels: labels, details: details, day: day) },
                           open: layout.open, stage: GamePicker.sweepAccent,
                           onTap: { path.append($0.id) })
            }
            ForEach(Array(rows.enumerated().dropFirst(layout.filled)), id: \.element.id) { idx, entry in
                row(entry).stripedRow(idx - layout.filled, accent: LbStyle.gold)
            }
        }
        .lbCard()
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
                .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23: the family round icon, compact (row-sized)
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
            .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23: the family round icon, compact (row-sized)
            .accessibilityLabel("Nudge \(f.username)")
        }
        .padding(.horizontal, 4)
        .opacity(0.55)
    }

    /// Canned-taunt picker (§207): fixed phrases, one per friend per day. The phrases
    /// are tinted option cards (they carry emoji, so no outlined candy text); Cancel is
    /// the quiet peach candy button.
    private func tauntSheet(_ target: FriendsService.FriendProfile) -> some View {
        return VStack(spacing: 12) {
            // BJ16: the NUDGE! lettering; who rides under it.
            VStack(alignment: .leading, spacing: 0) {
                BubbleTextView(text: "NUDGE!", palette: .accent(FriendsInk.purple), maxSize: 32, minSize: 22,
                               slotWidth: 150, animated: false, alignment: .leading)
                    .frame(width: 150, alignment: .leading)
                    .accessibilityLabel("Nudge \(target.username)")
                FinishLabel("@\(target.username)", color: FriendsInk.lavender).accessibilityHidden(true)
            }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20).padding(.top, 20)
            if let status = tauntStatus {
                // §BI9: the taunt result as the shared candy message (coin + pop).
                G5CandyMessage(text: status, tone: status == "Sent!" ? .success : (status.hasPrefix("Could not") ? .error : .warn))
                    .frame(maxWidth: .infinity).padding(.vertical, 32)
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(FriendTaunts.all) { taunt in
                            TauntNoteRow(text: taunt.text, tint: FriendsInk.purple) {
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
                            }
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
        .background((FriendsInk.nightCard ?? (Theme.isDark ? Theme.surface : FinishInk.lavender)).ignoresSafeArea())
        .presentationDetents([.medium])
    }

    private func detail(_ e: LeaderboardEntry) -> String { lbDetailLine(e, mode: mode) }

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
        // BI19: core OptimisticResults (unit tested) — placed by (score desc, time asc),
        // never past the top 50 (the rank window owns that), and the server's own row
        // for the player always wins once it lands.
        let r = OptimisticResults.merge(
            rows: rows, playerCount: count, local: mine, userId: p.id,
            score: c.score, time: c.timeSeconds,
            rowUserId: \.userId, rowScore: \.compositeScore, rowTime: \.timeSeconds)
        return (r.rows, r.playerCount, r.rank)
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
/// A board row's detail line (the Leaderboard + Records rows AND the podium places, so the
/// wording matches exactly): web parity "Ns"/"Nm Ns" time, the mode's guess semantics
/// (ModeStats.guessRowLabel: "4 Guesses", "0 Mistakes", "5 Checks", "Par"), the multi-board
/// fraction and hints on the hint-bearing modes (§254).
func lbDetailLine(_ e: LeaderboardEntry, mode: GameMode) -> String {
    let t = formatShortTime(Int(e.timeSeconds))
    let meta = ModeGen.byDbKey(mode.rawValue)
    var s = "\(WordociousCore.ModeStats.guessRowLabel(semantics: meta?.guessSemantics ?? "guesses", guessBase: meta?.guessBase ?? 1, guessCount: e.guessCount)) · \(t)"
    if e.totalBoards > 1 { s += " · \(e.boardsSolved)/\(e.totalBoards)" }
    if HINT_BEARING_MODES.contains(mode.rawValue), let h = e.hintsUsed { s += h > 0 ? " · \(h) hint\(h == 1 ? "" : "s")" : " · No hints" }
    return s
}

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
                    .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23: the family round icon, compact (row-sized)
                    .opacity(sharing ? 0.4 : 1)
                    .accessibilityLabel("Share flawless streak")
                }
            }
        }
        .task { sweep = await MatchStatsService.dailySweepStats() }
    }
}


