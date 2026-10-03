import SwiftUI
import WordociousCore

struct HomeView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var completions = DailyCompletionsStore()
    @State private var comingSoon: String?
    @State private var limitModal: HomeMode?     // free user tapped a completed daily
    @State private var solvedMode: HomeMode?      // "View Solved Puzzle"
    @State private var showProSheet = false
    // Session-scoped by design: WordociousApp resets this to .daily on every
    // cold start (and on a day-rollover foreground return) so reopening the
    // app always lands on the Daily surface. UserDefaults is still used so the
    // choice survives view churn within a session.
    @AppStorage("pref-play-mode") private var playMode: PlayMode = .daily
    @State private var vsDailyWon: Bool? = nil     // today's daily VS outcome (nil = not played) → card W/L badge
    @State private var pendingGame: ActiveGame?    // tap-time-resolved Unlimited game
    @State private var showInvite = false
    /// Remote flags (Stage 7): the More tile and every More Games title are
    /// shown only when their app_flags row says so for this viewer.
    @ObservedObject private var flags = FlagsService.shared
    private var visibleHomeModes: [HomeMode] { homeModes.filter { flags.isOn($0.flagKey) } }
    private var visibleMoreModes: [HomeMode] { moreModes.filter { flags.isOn($0.flagKey) } }
    @State private var pendingInvites: [InviteService.PendingInvite] = []
    @State private var inviterNames: [String: String] = [:]

    /// An incoming invite the user accepted → launches the VS match.
    private struct AcceptedInvite: Identifiable { let mode: GameMode; let code: String; var id: String { code } }
    @State private var playInvite: AcceptedInvite?
    /// One-time Pro nudge once the daily-login streak hits 7 (ports pro-prompt-modal).
    /// Local flag instead of the web's profiles.pro_prompt_shown column (no migration).
    @AppStorage("pro-prompt-shown") private var proPromptShown = false
    @State private var showShieldModal = false
    @State private var shieldChecked = false

    /// One-time-per-day Daily Sweep / Flawless Victory celebration. Presented
    /// from a SNAPSHOT of the completions that earned it, so a concurrent
    /// reload (e.g. the new day replacing byMode with its empty set) can never
    /// blank the stats mid-celebration — the widget-launch "0/9 WON · 0:00 ·
    /// 0 pts" sweep modal.
    private struct SweepCeleb: Identifiable {
        let id = UUID()
        let byMode: [String: DailyCompletion]
        /// The local day it was earned on — a celebration still waiting at
        /// midnight belongs to a day that's over and is dropped (BI16).
        let day: String
        /// Daily Sweep / Flawless, or the Puzzles (More Games) sweep.
        var more = false
    }
    @State private var sweepCeleb: SweepCeleb?
    /// FINISH_SPEC BI16: celebrations earned but not yet shown. They wait for a
    /// calm moment — Home's root, nothing presented (the game cover that earned
    /// it, a sheet, an alert), no other popup — never popping over a game, another
    /// tab or a late write's awkward moment. (Presenting a second fullScreenCover
    /// from a covered hierarchy also collides with the game cover's dismissal —
    /// the overlap that latches the root shell's layout mid-transition.)
    @State private var celebQueue: [SweepCeleb] = []
    @State private var celebWaiter: Task<Void, Never>?
    @AppStorage("sweep-celebrated-day") private var sweepCelebratedDay = ""

    /// Show the celebration once per local day, ONLY at the moment a daily
    /// completes in this session (the 9th finish → Sweep; a replayed win →
    /// Flawless upgrade). Launch / deep-link / restore paths never celebrate:
    /// they can briefly hold yesterday's set (warm resume across midnight
    /// before the reload lands), and yesterday's 9/9 + today's once-per-day
    /// token fired the false celebration.
    private func checkSweepCelebration() {
        guard auth.isAuthenticated, completions.allDone else { return }
        let day = LeaderboardService.todayLocal()
        // Hard guards: the completed set must BELONG to today (the store day-
        // stamps its data), and a "sweep" with zero recorded wins is by
        // definition stale/degenerate data — never a real day of play.
        guard completions.dataDay == day, completions.wonCount > 0 else { return }
        let tier = completions.flawless ? "flawless" : "sweep"
        let token = "\(day):\(tier)"
        if sweepCelebratedDay == token || sweepCelebratedDay == "\(day):flawless" { return }
        sweepCelebratedDay = token
        // BI16: queued for a calm moment (a Flawless upgrade replaces a still-
        // waiting Sweep for the same day rather than stacking behind it).
        celebQueue.removeAll { !$0.more && $0.day == day }
        queueCelebration(SweepCeleb(byMode: completions.byMode, day: day))
    }

    /// BI16: queue a celebration and (re)start the single waiter that presents
    /// the queue, oldest first, each at its own calm moment.
    private func queueCelebration(_ celeb: SweepCeleb) {
        celebQueue.append(celeb)
        presentNextCelebrationWhenCalm()
    }

    private func presentNextCelebrationWhenCalm() {
        guard celebWaiter == nil, !celebQueue.isEmpty else { return }
        celebWaiter = Task { @MainActor in
            defer { celebWaiter = nil }
            while !Task.isCancelled {
                await CalmMoment.wait(extraBusy: { homePopupUp })
                guard !Task.isCancelled else { return }
                // Re-read after the wait: drops a sweep whose day has ended.
                if let next = CelebrationGate.next(&celebQueue, day: { $0.day },
                                                   today: LeaderboardService.todayLocal(),
                                                   calm: CalmMoment.isCalm(extraBusy: homePopupUp)) {
                    present(next)
                    return
                }
                if celebQueue.isEmpty { return }
            }
        }
    }

    /// Home's own popups (in-view modals) — a celebration never lands on them.
    private var homePopupUp: Bool {
        sweepCeleb != nil || moreCeleb != nil || showShieldModal || limitModal != nil || comingSoon != nil
    }

    private func present(_ celeb: SweepCeleb) {
        CelebrationBusy.shared.up = true
        if celeb.more { moreCeleb = celeb; return }
        sweepCeleb = celeb
        // FINISH_SPEC §AI: a Daily Sweep or a Flawless is a happy moment for the App
        // Store review prompt (core ReviewPromptPolicy throttles it). Delayed so the
        // celebration lands first; no custom pre-prompt.
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            RatingPrompt.maybeAsk()
        }
    }

    /// A celebration closed: the next queued one waits for its own calm moment.
    private func celebrationClosed() {
        CelebrationBusy.shared.up = false
        presentNextCelebrationWhenCalm()
    }

    /// An Unlimited ProperNoundle run (PN has its own view, not GameScreen).
    struct PNGame: Identifiable {
        let seed: String
        var id: String { seed }
    }
    @State private var pnGame: PNGame?
    /// Today's ProperNoundle daily (its PUZZLES card and banner tile launch it as a cover).
    @State private var pnDaily = false
    /// Puzzles (More Games) Sweep / Flawless celebration (visual only — never a bonus or score).
    @State private var moreCeleb: SweepCeleb?
    @AppStorage("more-sweep-celebrated") private var moreSweepCelebratedDay = ""
    /// A Sudoku run (own view, not GameScreen): nil seed = today's daily.
    struct SudokuGame: Identifiable { let seed: String?; var id: String { seed ?? "daily" } }
    @State private var sudokuGame: SudokuGame?
    private func freshSudokuSeed(_ d: SudokuDifficulty) -> String {
        "unlimited-SUDOKU-\(Int(Date().timeIntervalSince1970))-\(d.rawValue)"
    }
    /// A Starsweep run (own view): nil seed = today's daily; the trailing size is what regionsSizeForSeed reads.
    struct RegionsGame: Identifiable { let seed: String?; var id: String { seed ?? "daily" } }
    @State private var regionsGame: RegionsGame?
    private func freshRegionsSeed(_ n: Int) -> String {
        "unlimited-REGIONS-\(Int(Date().timeIntervalSince1970))-\(n)"
    }
    /// A Letter Ladder run (own view): nil seed = today's daily.
    struct LadderGame: Identifiable { let seed: String?; var id: String { seed ?? "daily" } }
    @State private var ladderGame: LadderGame?
    private func freshLadderSeed() -> String { "unlimited-LADDER-\(Int(Date().timeIntervalSince1970))" }
    /// A Spyglass run (own view): nil seed = today's daily.
    struct SpyglassGame: Identifiable { let seed: String?; var id: String { seed ?? "daily" } }
    @State private var spyglassGame: SpyglassGame?
    private func freshSpyglassSeed() -> String { "unlimited-WORDSEARCH-\(Int(Date().timeIntervalSince1970))" }
    /// A Hubbub run (own view): nil seed = today's daily.
    struct HubGame: Identifiable { let seed: String?; var id: String { seed ?? "daily" } }
    @State private var hubGame: HubGame?
    private func freshHubSeed() -> String { "unlimited-HUB-\(Int(Date().timeIntervalSince1970))" }
    /// A Codebreaker run (own view): nil seed = today's daily.
    struct CodebreakerGame: Identifiable { let seed: String?; var id: String { seed ?? "daily" } }
    @State private var codebreakerGame: CodebreakerGame?
    private func freshCodebreakerSeed() -> String { "unlimited-CRYPTOGRAM-\(Int(Date().timeIntervalSince1970))" }
    /// A Kindred run (own view): nil seed = today's daily.
    struct KindredGame: Identifiable { let seed: String?; var id: String { seed ?? "daily" } }
    @State private var kindredGame: KindredGame?
    private func freshKindredSeed() -> String { "unlimited-GROUPS-\(Int(Date().timeIntervalSince1970))" }
    /// A Crosswordocious run (own view): nil seed = today's daily.
    struct CrosswordGame: Identifiable { let seed: String?; var id: String { seed ?? "daily" } }
    @State private var crosswordGame: CrosswordGame?
    private func freshCrosswordSeed() -> String { "unlimited-CROSSWORD-\(Int(Date().timeIntervalSince1970))" }
    /// A Muddle run (own view): nil seed = today's daily.
    struct MuddleGame: Identifiable { let seed: String?; var id: String { seed ?? "daily" } }
    @State private var muddleGame: MuddleGame?
    private func freshMuddleSeed() -> String { "unlimited-SCRAMBLE-\(Int(Date().timeIntervalSince1970))" }

    private func freshPNSeed() -> String {
        "unlimited-PROPERNOUNDLE-\(Int(Date().timeIntervalSince1970))"
    }

    /// A game whose seed was resolved at tap time (Unlimited play).
    struct ActiveGame: Identifiable, Equatable {
        let seed: String; let mode: GameMode; let title: String
        var id: String { "\(mode.rawValue)-\(seed)" }
    }

    /// Free users are forced to Daily (toggle is Pro-only).
    private var effectiveMode: PlayMode { auth.isProActive ? playMode : .daily }

    // MARK: Home redesign (founder-approved, 2026-10-01; docs/HOME_REDESIGN_SPEC.md)

    /// The banner's row streaks: Wordocious from the Daily Sweep stats
    /// (daily_bonuses), Puzzles from the More Games dailies' daily_results. Seeded
    /// from the last value so the flames don't pop in on every launch.
    @State private var wordStreaks = HomeStreaksService.cachedStreaks(.word)
    @State private var puzzleStreaks = HomeStreaksService.cachedStreaks(.puzzles)
    /// Unlimited mode's per-game_mode count of today's finished unlimited games.
    @State private var unlimitedCounts: [String: Int] = [:]
    private static let puzzlesAnchor = "home-puzzles"

    /// WORDOCIOUS DAILIES: the eight sweep cards (grid order).
    private var wordModes: [HomeMode] { visibleHomeModes.filter { !$0.homeWide } }
    /// PUZZLES: the More Games dailies, catalog order, each behind its remote flag.
    /// The old More tile's flag (menu.more) still switches the whole group off.
    private var puzzleModes: [HomeMode] {
        visibleHomeModes.contains { $0.id == "more" } ? moreDailyModes(visibleMoreModes) : []
    }

    private func progress(_ modes: [HomeMode]) -> GroupProgress {
        let keys = modes.compactMap(\.dbKey)
        let rows = keys.compactMap { completions.byMode[$0] }
        return GroupProgress(played: rows.count, won: rows.filter(\.completed).count, total: keys.count)
    }

    private func unlimitedPlayed(_ modes: [HomeMode]) -> Int {
        modes.compactMap(\.dbKey).reduce(0) { $0 + (unlimitedCounts[$1] ?? 0) }
    }

    private var bannerName: String { auth.isAuthenticated ? (auth.profile?.username ?? "") : "" }

    private var homeBanner: some View {
        let w = wordModes, p = puzzleModes
        return HomeBannerView(
            word: .init(modes: w, progress: progress(w), streaks: wordStreaks, unlimitedPlayed: unlimitedPlayed(w)),
            puzzles: .init(modes: p, progress: progress(p), streaks: puzzleStreaks, unlimitedPlayed: unlimitedPlayed(p)),
            byMode: completions.byMode, playMode: effectiveMode, isPro: auth.isProActive,
            onModeChange: { m in withAnimation(Theme.animation(.easeInOut(duration: 0.15))) { playMode = m } },
            name: bannerName,
            onOpen: { open($0) },
            onShare: {
                let headline = HomeBanner.bannerHeadline(progress(w), progress(p), hour: Calendar.current.component(.hour, from: Date()),
                                                         name: bannerName)
                ShareEvents.log(kind: "image", gameMode: "", surface: "home_banner")
                ShareService.shareTodayProgress(byMode: completions.byMode, headline: headline)
            })
    }

    /// Row streaks (signed in only). Wordocious: the Daily Sweep stats' current
    /// sweep / flawless runs; Puzzles: dayStreaks over the visible More Games dailies.
    private func loadStreaks(word: Bool = true, puzzles: Bool = true) async {
        guard auth.isAuthenticated else {
            wordStreaks = GroupStreaks(sweep: 0, flawless: 0); puzzleStreaks = GroupStreaks(sweep: 0, flawless: 0); return
        }
        if word {
            let sweep = await MatchStatsService.dailySweepStats()
            wordStreaks = GroupStreaks(sweep: sweep.currentSweepStreak, flawless: sweep.currentFlawlessStreak)
            HomeStreaksService.storeStreaks(wordStreaks, .word)
        }
        if puzzles {
            puzzleStreaks = await HomeStreaksService.puzzleStreaks(dbKeys: puzzleModes.compactMap(\.dbKey))
            HomeStreaksService.storeStreaks(puzzleStreaks, .puzzles)
        }
        // The widget shows the row streaks too (read from that cache).
        WidgetBridge.update(completions: completions.byMode)
    }

    /// A row's streak can only move today once that row is swept, so a recorded
    /// daily refreshes just the rows that are. The Wordocious run reads the sweep
    /// bonus row, which the server awards right AFTER the result lands — hence the
    /// short wait (the cover-dismiss refresh catches a slow award).
    private func refreshSweptRowStreaks(afterAward: Bool) {
        let w = HomeBanner.groupTier(progress(wordModes)) != .none
        let p = HomeBanner.groupTier(progress(puzzleModes)) != .none
        guard w || p else { return }
        Task {
            if afterAward && w { try? await Task.sleep(nanoseconds: 3_000_000_000) }
            await loadStreaks(word: w, puzzles: p)
        }
    }

    /// Unlimited's "N PLAYED TODAY" (Pro in Unlimited only — nobody else sees it).
    private func loadUnlimitedCounts() async {
        guard auth.isAuthenticated, effectiveMode == .unlimited else { return }
        unlimitedCounts = await HomeStreaksService.unlimitedCountsToday()
    }

    private let columns = [GridItem(.flexible(), spacing: HomeCardSpec.gap), GridItem(.flexible(), spacing: HomeCardSpec.gap)]

    /// §AJ: the footer Home tab pops this stack (token) and scrolls to the top.
    @ObservedObject private var tabRouter = TabRouterModel.shared
    private static let topAnchor = "home-top"

    var body: some View {
        NavigationStack {
            Group {
            ZStack {
                PageBackground(tint: .home)

                VStack(spacing: 0) {
                    AppHeaderView()
                    ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 8) {
                            Color.clear.frame(height: 0).id(Self.topAnchor)
                            AnnouncementsBanner()
                            pendingInvitesBanner
                            // The banner replaces the old Pro pill, the Daily Challenge /
                            // Unlimited / Sweep heroes and the top Word of the Day card.
                            homeBanner
                            if showFirstGameCard { firstGameCard }
                            // ART_SPEC §12 / §19.2: the whole-cast DAILIES art, centered on the
                            // same width rule as PUZZLES and WORD OF THE DAY below.
                            SectionTitleArt(.dailies, compact: true)
                            LazyVGrid(columns: columns, spacing: HomeCardSpec.gap) {
                                ForEach(wordModes) { mode in card(mode) }
                            }
                            // The More Games dailies as plain cards (the band and its sheet are gone).
                            if !puzzleModes.isEmpty {
                                // ART_SPEC §2 / §19.2: the whole-cast PUZZLES art, centered.
                                SectionTitleArt(.puzzles, compact: true)
                                    .id(Self.puzzlesAnchor)
                                LazyVGrid(columns: columns, spacing: HomeCardSpec.gap) {
                                    ForEach(puzzleModes) { mode in card(mode) }
                                }
                            }
                            WordOfTheDayView()
                            if let vs = visibleHomeModes.first(where: { $0.id == "vs" }) {
                                // FINISH_SPEC §O1: VS BATTLE gets its own section title
                                // (same rule + spacing as DAILIES / PUZZLES / WORD OF THE DAY).
                                SectionTitleArt(.vsbattle)
                                    .padding(.top, 2)
                                VSLiveTile(mode: vs, vsDailyWon: vsDailyWon, playMode: effectiveMode,
                                           isPro: auth.isProActive, onInvite: { showInvite = true }) {
                                    // The VS lobby hosts today's Daily Battle (VS overhaul, 2026-10-01).
                                    VSLobbyView()
                                }
                            }
                            // Sign Out only when there's a real session — a guest
                            // has nothing to sign out of (the header shows "Sign In").
                            if auth.isAuthenticated { signOutButton }
                            footerLinks
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 4)
                        // FINISH_SPEC §A4 / §AS3: the content ends clear of the docked
                        // footer (its measured height + 16 pt) — never covered.
                        .tabScrollTail()
                    }
                    .reportsScrollMotion()   // §AQ2: idle loops pause while scrolling
                    // Anything that used to open the More Games sheet scrolls here instead.
                    .onReceive(NotificationCenter.default.publisher(for: TabRouterModel.scrollToTop)) { note in
                        guard note.object as? String == AppTab.home.rawValue else { return }
                        withAnimation(Theme.animation(.easeOut(duration: 0.3))) { proxy.scrollTo(Self.topAnchor, anchor: .top) }
                    }
                    .onReceive(DeepLink.shared.$puzzlesRequest) { req in
                        guard req != nil else { return }
                        DeepLink.shared.puzzlesRequest = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            withAnimation(Theme.animation(.easeInOut(duration: 0.35))) {
                                proxy.scrollTo(Self.puzzlesAnchor, anchor: .top)
                            }
                        }
                    }
                    }
                }
                .wideColumn(.page)   // §AG: iPad column, centered on the wallpaper

                if let m = limitModal {
                    ModeLimitModal(mode: m,
                                   showViewSolved: m.id != "vs",   // VS has no solo solved-puzzle to review
                                   onClose: { limitModal = nil },
                                   onUpgrade: { limitModal = nil; showProSheet = true },
                                   onViewSolved: { let mode = m; limitModal = nil; solvedMode = mode })
                        .transition(.opacity)
                }

                if showProPrompt {
                    proPromptBanner
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                        .padding(.horizontal, 16).padding(.bottom, 12)
                }

                // completedCount == 0: the launch check can latch the modal
                // while a game covers Home — the player finishes the daily,
                // returns, and is told the streak they just extended is at
                // risk. Any completion recorded today wins over the latch.
                if showShieldModal, completions.completedCount == 0, let p = auth.profile {
                    StreakShieldModal(
                        streak: p.dailyLoginStreak, shields: p.streakShields,
                        // The modal shows its "Streak saved" beat then calls
                        // onClose itself — closing here would cut it off.
                        onUseShield: { await ShieldService.useShield() },
                        onDecline: { await ShieldService.declineStreak(); closeShield() },
                        onClose: { closeShield() })
                    .transition(.opacity)
                }
            }
            .animation(Theme.animation(.easeInOut(duration: 0.15)), value: limitModal != nil)
            .animation(Theme.animation(.easeInOut(duration: 0.2)), value: showProPrompt)
            .sheet(isPresented: $showProSheet) { ProView() }
            // Games present full-screen OVER the tab bar (like the web's
            // full-screen game route) so the bottom nav is never behind them —
            // not on the board and not on the results/victory screen.
            .fullScreenCover(item: $pendingGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    GameScreen(seed: g.seed, mode: g.mode, title: g.title, onPlayAgain: {
                        // Mint a fresh Unlimited seed for the same mode and swap it in
                        // (item change re-presents the cover with a new game).
                        let fresh = "unlimited-\(g.mode.rawValue)-\(Int(Date().timeIntervalSince1970))"
                        UserDefaults.standard.set(fresh, forKey: "unlimited-current-\(g.mode.rawValue)")
                        pendingGame = ActiveGame(seed: fresh, mode: g.mode, title: g.title)
                    })
                    // Swapping `pendingGame` to a new seed while the cover is already
                    // up does NOT rebuild GameScreen's @StateObject (created once from
                    // the old seed) — so Play Again showed the old finished board.
                    // Keying on the seed forces a fresh view + a fresh game VM.
                    .id(g.seed)
                }
            }
            .fullScreenCover(item: $pnGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    ProperNoundleView(seed: g.seed, onPlayAgain: { pnGame = PNGame(seed: freshPNSeed()) })
                }
            }
            .fullScreenCover(isPresented: $pnDaily, onDismiss: { onGameCoverDismissed() }) {
                NavigationStack { ProperNoundleView() }
            }
            .fullScreenCover(item: $sudokuGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    SudokuView(seed: g.seed, onPlayAgain: { d in sudokuGame = SudokuGame(seed: freshSudokuSeed(d)) })
                        .id(g.id)   // a new seed = a new view + view model
                }
            }
            .fullScreenCover(item: $regionsGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    RegionsView(seed: g.seed, onPlayAgain: { n in regionsGame = RegionsGame(seed: freshRegionsSeed(n)) })
                        .id(g.id)
                }
            }
            .fullScreenCover(item: $ladderGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    LadderView(seed: g.seed, onPlayAgain: { ladderGame = LadderGame(seed: freshLadderSeed()) })
                        .id(g.id)
                }
            }
            .fullScreenCover(item: $spyglassGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    SpyglassView(seed: g.seed, onPlayAgain: { spyglassGame = SpyglassGame(seed: freshSpyglassSeed()) })
                        .id(g.id)
                }
            }
            .fullScreenCover(item: $hubGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    HubView(seed: g.seed, onPlayAgain: { hubGame = HubGame(seed: freshHubSeed()) })
                        .id(g.id)
                }
            }
            .fullScreenCover(item: $codebreakerGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    CodebreakerView(seed: g.seed, onPlayAgain: { codebreakerGame = CodebreakerGame(seed: freshCodebreakerSeed()) })
                        .id(g.id)
                }
            }
            .fullScreenCover(item: $kindredGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    KindredView(seed: g.seed, onPlayAgain: { kindredGame = KindredGame(seed: freshKindredSeed()) })
                        .id(g.id)
                }
            }
            .fullScreenCover(item: $crosswordGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    CrosswordView(seed: g.seed, onPlayAgain: { crosswordGame = CrosswordGame(seed: freshCrosswordSeed()) })
                        .id(g.id)
                }
            }
            .fullScreenCover(item: $muddleGame, onDismiss: { onGameCoverDismissed() }) { g in
                NavigationStack {
                    MuddleView(seed: g.seed, onPlayAgain: { muddleGame = MuddleGame(seed: freshMuddleSeed()) })
                        .id(g.id)
                }
            }
            .fullScreenCover(item: $solvedMode, onDismiss: { onGameCoverDismissed() }) { m in
                NavigationStack {
                    // Word engines only: reconstruct the solved board from the matches
                    // row (works cross-device, unlike the local-only GameScreen state).
                    // Every More Games title has a GameMode too (Stage 3), so this test
                    // must exclude custom engines — founder, 2026-09-26: Letter Ladder,
                    // Muddle and Hubbub were landing here and drawing empty word grids.
                    // Each custom game restores its finished daily from its own save.
                    if let gm = m.mode, !gm.isCustomEngine {
                        SolvedPuzzleView(mode: gm, title: m.title)
                    } else {
                        CustomDailyView(id: m.id)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showInvite) { InviteSheet() }
            .navigationDestination(isPresented: Binding(
                get: { playInvite != nil },
                set: { if !$0 { playInvite = nil } })) {
                if let inv = playInvite {
                    VSGameView(mode: inv.mode, inviteCode: inv.code)
                }
            }
            .task(id: auth.isAuthenticated) {
                await LaunchGate.wait()   // §AU5: after the cold-start intro lands
                // Concurrent, not serial — the three loads are independent.
                async let load: Void = completions.load()
                async let invites: Void = loadPendingInvites()
                async let won = DailyResultsService.dailyVSResult()
                _ = await load
                _ = await invites
                vsDailyWon = await won
                checkStreakAtRisk()
                await loadStreaks()
                // Deliberately NO checkSweepCelebration() here: launch/appear
                // must never celebrate (see checkSweepCelebration's doc).
            }
            // Widget deep link (wordocious://daily/<MODE>): open TODAY'S daily
            // exactly as tapping its card would in Daily mode — any of the eight
            // Wordocious dailies or the ten Puzzles (home redesign, 2026-10-01:
            // every Puzzles chip links too, ProperNoundle included).
            .onReceive(DeepLink.shared.$dailyMode) { m in
                guard let m else { return }
                DeepLink.shared.dailyMode = nil
                guard let hm = (wordModes + puzzleModes).first(where: { $0.dbKey == m.rawValue }) else { return }
                // BI10: a widget tap while a game is up must not set a second cover binding
                // (it can't present over the first and would linger, set, until a later
                // update presented it out of nowhere): close the games, then open.
                if ChromeVisibility.inModalPresentation() {
                    closeAllGames()
                    TabRouterModel.dismissAllOverlays(animated: true)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { open(hm, forceDaily: true) }
                } else {
                    open(hm, forceDaily: true)
                }
            }
            // FINISH_SPEC BI10: the top-left Home button means NO game — every game cover
            // this screen owns closes through its binding, so none is left set to be
            // presented again by a later update.
            .onReceive(NotificationCenter.default.publisher(for: HomeNav.goHome)) { _ in closeAllGames() }
            // Refresh today's daily completions whenever Home reappears (returning
            // from a daily push like ProperNoundle) so a just-finished game shows
            // its completed state immediately — no longer needs a tab round-trip.
            .onAppear {
                // §AU5: on a cold start this waits for the intro to land.
                if LaunchGate.isOpen { LivePlayerCount.shared.start(); reloadDaily() }
                else { Task { await LaunchGate.wait(); LivePlayerCount.shared.start(); reloadDaily() } }
            }
            // Stop the live-count poll while Home is off screen (founder, 2026-09-29).
            .onDisappear { LivePlayerCount.shared.stop() }
            // Today's Muddle cartoon into URLCache so its panel paints at once (founder,
            // 2026-09-29). Keyed on the flag: flags usually land after Home first appears.
            .task(id: visibleMoreModes.contains { $0.id == "scramble" }) {
                await LaunchGate.wait()   // §AU5
                if visibleMoreModes.contains(where: { $0.id == "scramble" }) { AppWarmup.prefetchMuddleCartoon() }
            }
            // Foreground return on a NEW local day (WordociousApp posts) → reset
            // Home to the Daily surface like a cold start: toggle back to Daily
            // and dismiss the solo game covers. The unlimited board's save (and
            // its "unlimited-current-*" marker) survive, so toggling back to
            // Unlimited still resumes it. Same-day resumes never fire this.
            .onReceive(NotificationCenter.default.publisher(for: .dayRolledOver)) { _ in
                playMode = .daily
                pendingGame = nil
                pnGame = nil
                // An unshown sweep belongs to yesterday (BI16 drops it either way).
                celebQueue.removeAll { $0.day != LeaderboardService.todayLocal() }
                unlimitedCounts = [:]
                Task { await loadStreaks() }
            }
            // Unlimited's per-row "N PLAYED TODAY": fetched when the switch flips to Unlimited.
            .task(id: effectiveMode) { await loadUnlimitedCounts() }
            // The row streaks once today's result has LANDED, so a sweep's flame ticks up right away.
            .onDailyRecorded { refreshSweptRowStreaks(afterAward: true) }
            // BI16: queued celebrations present from presentNextCelebrationWhenCalm
            // (Home root, nothing presented, no other popup) — not on a chrome flip.
            // The moment a daily is recorded (even mid-game-over, before the user
            // taps Home) refresh the word card + VS state. The completion badges
            // already react via the shared DailyCompletionsStore.
            .onDailyCompletion {
                reloadDaily()
                // The ONLY celebration trigger: a daily just finished in THIS
                // session. Check immediately (the store's observer has already
                // applied the finish) so the modal pops the instant the 9th
                // completes, and re-check after the server-confirming load in
                // case observer ordering ever changes.
                checkSweepCelebration()
                checkMoreSweepCelebration()
                Task {
                    await completions.load()
                    checkSweepCelebration()
                    checkMoreSweepCelebration()
                }
            }
            .fullScreenCover(item: $moreCeleb, onDismiss: celebrationClosed) { celeb in
                if #available(iOS 16.4, *) {
                    SweepCelebrationView(byMode: celeb.byMode, onClose: { moreCeleb = nil }, variant: .more)
                        .presentationBackground(.clear)
                } else {
                    SweepCelebrationView(byMode: celeb.byMode, onClose: { moreCeleb = nil }, variant: .more)
                }
            }
            .fullScreenCover(item: $sweepCeleb, onDismiss: celebrationClosed) { celeb in
                if #available(iOS 16.4, *) {
                    SweepCelebrationView(byMode: celeb.byMode) { sweepCeleb = nil }
                        .presentationBackground(.clear)
                } else {
                    SweepCelebrationView(byMode: celeb.byMode) { sweepCeleb = nil }
                }
            }
            // BI24: an in-app sheet with a host + brand headline, not a system alert.
            .sheet(isPresented: Binding(get: { comingSoon != nil }, set: { if !$0 { comingSoon = nil } })) {
                ZStack {
                    PageBackground(tint: .home)
                    BrandEmptyState(title: "Coming soon",
                                    line: "\(comingSoon ?? "This game") is on its way to the app. Hang tight!",
                                    host: .u, actionTitle: "Got it", action: { comingSoon = nil })
                }
                .presentationDetents([.medium])
            }

                    }
            // §AJ: this tab's root (a push over it is tracked) — a footer tap pops it.
            .tabRootTracked(.home)
        }
        .id(TabRouterModel.shared.token(.home))
    }

    // MARK: - First-game suggestion card (new accounts)

    /// One-time "where do I start?" nudge for brand-new accounts. Zero-games
    /// signal: profiles.total_wins + total_losses == 0 — GameResultsService
    /// increments one of the two on EVERY recorded game (solo daily, unlimited,
    /// gauntlet, PN, VS), so it's a direct games-played count that flips the
    /// instant any game records (more reliable than the xp/level proxy, which
    /// login-streak XP can inflate without a single game played).
    @AppStorage("first-game-card-dismissed") private var firstGameCardDismissed = false

    private var showFirstGameCard: Bool {
        guard !firstGameCardDismissed, auth.isAuthenticated, let p = auth.profile else { return false }
        return p.totalWins + p.totalLosses == 0
    }

    private var firstGameCard: some View {
        // Classic's catalog entry — accent + title stay single-sourced.
        let classic = homeModes.first { $0.id == "practice" }
        let accent = classic?.accent ?? Theme.primary
        return HStack(alignment: .top, spacing: 12) {
            // §G5 / §A7: a cast pose where there's room — O1 waves you in (Home's
            // host is W).
            PoseImage(.o1, "jump", height: 58)
            VStack(alignment: .leading, spacing: 2) {
                Text("New here? Start with Classic")
                    .font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                Text("The original 5-letter challenge — a fresh puzzle every day.")
                    .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 10) {
                    Button {
                        // Same route as the Classic mode card's daily launch.
                        if let gm = classic?.mode {
                            pendingGame = ActiveGame(seed: DailySeed.today(mode: gm), mode: gm, title: classic?.title ?? "Classic")
                        }
                    } label: {
                        CandyLabel(title: "Play", symbol: "play.fill")
                    }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .small, fullWidth: false))
                    NavigationLink { HowToPlayView() } label: {
                        CandyLabel(title: "How to play")
                    }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                }
                .padding(.top, 8)
            }
            Spacer(minLength: 4)
            Button { firstGameCardDismissed = true } label: {
                Image(systemName: "xmark").font(.system(size: 11, weight: .heavy)).foregroundStyle(FinishInk.secondary)
                    .frame(width: 26, height: 26).contentShape(Rectangle())
            }
            .buttonStyle(.squishIcon)
            .accessibilityLabel("Dismiss")
        }
        .padding(12)
        .tintedCard(accent: accent, bar: G5Accent.bar(accent), radius: 18, barHeight: 6)
    }

    // MARK: - Pro prompt (ports pro-prompt-modal)

    private var showProPrompt: Bool {
        // Honor the server-persisted dismissal too (web parity — a user who
        // dismissed on web shouldn't see the one-time prompt again on iOS).
        !proPromptShown && !(auth.profile?.proPromptShown ?? false)
            && !auth.isProActive && (auth.profile?.dailyLoginStreak ?? 0) >= 7
    }

    /// Dismiss the one-time Pro prompt locally AND persist it to the profile
    /// row, mirroring web pro-prompt-modal.tsx's `pro_prompt_shown` update.
    private func dismissProPrompt() {
        proPromptShown = true
        Task {
            struct Upd: Encodable { let pro_prompt_shown: Bool }
            if let uid = auth.profile?.id {
                _ = try? await auth.client.from("profiles").update(Upd(pro_prompt_shown: true))
                    .eq("id", value: uid).execute()
            }
        }
    }

    private var proPromptBanner: some View {
        HStack(spacing: 12) {
            Icon3D(.crown, size: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text("You're on a streak!").font(Brand.font(12, .black)).foregroundStyle(FinishInk.heading)
                Text("Upgrade to Pro for ad-free play, stats, shields, and more.")
                    .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary).lineLimit(2)
            }
            Spacer(minLength: 4)
            Button { dismissProPrompt(); showProSheet = true } label: {
                CandyLabel(title: "Go Pro")
            }
            .buttonStyle(CandyButtonStyle(variant: .amber, size: .small, fullWidth: false))
            Button { dismissProPrompt() } label: {
                Image(systemName: "xmark").font(.system(size: 12, weight: .heavy)).foregroundStyle(FinishInk.secondary)
                    .frame(width: 26, height: 26).contentShape(Rectangle())
            }
            .buttonStyle(.squishIcon)
            .accessibilityLabel("Dismiss")
        }
        .padding(14)
        // §G5: a gold-tinted card with its top bar (§A1).
        .tintedCard(accent: G5Accent.gold, bar: [Color(hex: 0xFFC56B), Color(hex: 0xF97316)], radius: 18, barHeight: 6)
        .shadow(color: .black.opacity(0.1), radius: 16, x: 0, y: 8)
    }

    // MARK: - Streak shield (ports StreakShieldProvider)

    private func checkStreakAtRisk() {
        guard !shieldChecked, auth.profile != nil else { return }
        shieldChecked = true
        Task {
            // The cached profile can predate a game played on ANOTHER device
            // (web, iPad) — the founder kept getting this modal after having
            // played. Refresh so last_played_at is the server's truth, and
            // treat any completion already recorded today (completions.load()
            // ran just before this) as proof of play regardless.
            await auth.refreshProfile()
            guard completions.completedCount == 0, let p = auth.profile else { return }
            if p.dailyLoginStreak > 0 && ShieldService.isStreakAtRisk(lastPlayedAt: p.lastPlayedAt) {
                withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { showShieldModal = true }
            }
        }
    }

    private func closeShield() {
        withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { showShieldModal = false }
    }

    // MARK: - Incoming VS invites (ports PendingInvitesBanner)

    /// Reload today's daily completions + the daily-VS result (cheap; the store
    /// seeds from cache so there's no flicker). Called on Home reappear and game
    /// dismissal so finished games show their completed state right away.
    private func reloadDaily() {
        Task {
            // Concurrent, not serial — the two loads are independent.
            async let load: Void = completions.load()
            async let won = DailyResultsService.dailyVSResult()
            _ = await load
            vsDailyWon = await won
        }
    }

    private func loadPendingInvites() async {
        guard let uid = auth.profile?.id else { return }
        let list = await InviteService.fetchPending(userId: uid)
        pendingInvites = list
        inviterNames = await InviteService.inviterUsernames(Array(Set(list.map(\.inviter_id))))
    }

    @ViewBuilder private var pendingInvitesBanner: some View {
        if let top = pendingInvites.first {
            let name = inviterNames[top.inviter_id] ?? "A friend"
            let mode = GameMode(rawValue: top.game_mode) ?? .duel
            // FINISH_SPEC §K1 / §T2: an invite received — a pink tinted card with its
            // top bar, the inviter's letter-tile avatar, I's invite-sent art, the
            // headline in Nunito Black, Accept (green / teal candy → the existing Play
            // path) and Decline (soft peach candy).
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    LetterTileAvatar(username: name, size: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("@\(name) invited you to \(ModeStyle.title(mode).capitalized)")
                            .font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading).lineLimit(2)
                            .minimumScaleFactor(0.7)
                        if pendingInvites.count > 1 {
                            Text("+\(pendingInvites.count - 1) more pending").font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0xA21CAF))
                        }
                    }
                    Spacer(minLength: 2)
                    FriendsSceneArt(asset: "art-scene-invite-sent", height: 54, maxWidth: 54)
                }
                HStack(spacing: 8) {
                    Button { playInvite = .init(mode: mode, code: top.invite_code) } label: {
                        CandyLabel(title: "Accept", symbol: "play.fill")
                    }
                    .buttonStyle(CandyButtonStyle(variant: .teal, size: .small))
                    Button {
                        let id = top.id
                        pendingInvites.removeAll { $0.id == id }
                        Task { await InviteService.decline(inviteId: id) }
                    } label: {
                        CandyLabel(title: "Decline")
                    }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .small))
                    .accessibilityLabel("Decline invite")
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .tintedCard(accent: G5Accent.pink, bar: [Color(hex: 0xF472B6), Color(hex: 0xA21CAF)], radius: 16, barHeight: 6)
            .transition(G5Toast.transition)
        }
    }

    // MARK: - Footer (ports the web home bottom; the LIVE count lives in VSLiveTile)

    private var signOutButton: some View {
        Button { Task { await auth.signOut() } } label: {
            CandyLabel(title: "Sign Out", symbol: "rectangle.portrait.and.arrow.right")
        }
        // §A8: a small quiet peach candy, not a text link.
        .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
        .frame(maxWidth: .infinity)
        .padding(.top, 2)
    }

    /// About · How to Play · Privacy · Terms — same destinations as Settings, so
    /// the content is the single source of truth and stays aligned with the web.
    // Full site-nav footer (How to Play / Guides / Strategy / Words / About /
    // FAQ / Privacy / Terms) — parity with the web home footer. Same destinations
    // as the header "?" dropdown.
    private var footerLinks: some View {
        InfoFooterLinks().padding(.top, 2)
    }

    private func footerLink(_ t: String) -> some View {
        Text(t).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
    }

    // MARK: - Mode card

    /// Freemium lock: a free user who has already played today's daily for this
    /// mode can't replay it (Pro unlocks unlimited replays). Mirrors the web's
    /// `isLocked = !isPro && (isDailyDone || hasPlayedModeToday)`. The VS card
    /// grays out the same way once today's free daily VS is used (web parity) —
    /// gated by the local VSPlayLimit, the same gate the lobby uses.
    private func isLocked(_ mode: HomeMode) -> Bool {
        guard !auth.isProActive else { return false }
        if mode.id == "vs" { return VSPlayLimit.hasPlayedToday() }
        guard let key = mode.dbKey else { return false }
        return completions.byMode[key] != nil
    }

    /// One card in WORDOCIOUS DAILIES or PUZZLES. VS is reachable ONLY from the
    /// dedicated VS Battle tile (the per-card swords shortcut was removed as
    /// redundant, all platforms). Every tap routes through `open`, the same path
    /// the banner tiles and the widget's deep links take.
    private func card(_ mode: HomeMode) -> some View {
        Button { open(mode) } label: { cardBody(mode, locked: isLocked(mode)) }
            // FINISH_SPEC §AK: the card squish (0.95 → spring back past 1).
            .buttonStyle(.squishCard)
    }

    /// A daily this user has already finished (in Daily mode). Revisiting it
    /// should show the solved review, not silently start a replay.
    private func isCompletedDaily(_ mode: HomeMode, daily: Bool) -> Bool {
        guard daily, mode.id != "vs", let key = mode.dbKey else { return false }
        return completions.byMode[key] != nil
    }

    /// Open a game exactly as its card would: a free player's finished daily →
    /// the Played Today modal; a Pro's finished daily → the solved review; else
    /// today's daily, or in Unlimited a fresh (or resumed) puzzle. `forceDaily`:
    /// the widget's chips always mean today's daily, whatever the switch says.
    private func open(_ mode: HomeMode, forceDaily: Bool = false) {
        // §AY: no tap-through — a card under the finger right after the Home button
        // ignores the press (deep links pass forceDaily and always open).
        guard forceDaily || HomeNav.cardTapsAllowed else { return }
        let unlimited = !forceDaily && effectiveMode == .unlimited
        if isLocked(mode) { limitModal = mode; return }
        if isCompletedDaily(mode, daily: !unlimited) { solvedMode = mode; return }
        if let gameMode = mode.mode {
            // Unlimited: resolve the seed at TAP time so an in-progress puzzle
            // resumes (persists until finished) and only a finished/none case
            // starts a fresh one — matching the web's non-daily session behavior.
            pendingGame = ActiveGame(
                seed: unlimited ? resolvedUnlimitedSeed(gameMode) : DailySeed.today(mode: gameMode),
                mode: gameMode, title: mode.title)
            return
        }
        switch mode.id {
        // Unlimited PN: a fresh random puzzle per tap.
        case "propernoundle": if unlimited { pnGame = PNGame(seed: freshPNSeed()) } else { pnDaily = true }
        case "sudoku": sudokuGame = SudokuGame(seed: unlimited ? freshSudokuSeed(.medium) : nil)
        case "regions": regionsGame = RegionsGame(seed: unlimited ? freshRegionsSeed(8) : nil)
        case "ladder": ladderGame = LadderGame(seed: unlimited ? freshLadderSeed() : nil)
        case "wordsearch": spyglassGame = SpyglassGame(seed: unlimited ? freshSpyglassSeed() : nil)
        case "hub": hubGame = HubGame(seed: unlimited ? freshHubSeed() : nil)
        case "cryptogram": codebreakerGame = CodebreakerGame(seed: unlimited ? freshCodebreakerSeed() : nil)
        case "groups": kindredGame = KindredGame(seed: unlimited ? freshKindredSeed() : nil)
        case "crossword": crosswordGame = CrosswordGame(seed: unlimited ? freshCrosswordSeed() : nil)
        case "scramble": muddleGame = MuddleGame(seed: unlimited ? freshMuddleSeed() : nil)
        default: comingSoon = mode.title
        }
    }

    /// Unlimited seed for a mode: resume the in-progress non-daily puzzle if one
    /// exists and isn't finished (web parity — the puzzle persists until solved);
    /// otherwise mint a fresh seed and remember it as the current one.
    private func resolvedUnlimitedSeed(_ gameMode: GameMode) -> String {
        let key = "unlimited-current-\(gameMode.rawValue)"
        // Resume an in-progress unlimited game only if it's <24h old (web purges
        // practice saves after 24h); otherwise start fresh.
        if let saved = UserDefaults.standard.string(forKey: key),
           let state = GamePersistence.shared.load(seed: saved, mode: gameMode),
           state.status == .playing,
           (Date().timeIntervalSince1970 * 1000 - state.startTime) < 24 * 3600 * 1000 {
            return saved
        }
        let fresh = "unlimited-\(gameMode.rawValue)-\(Int(Date().timeIntervalSince1970))"
        UserDefaults.standard.set(fresh, forKey: key)
        return fresh
    }

    /// The card itself lives in ModeCardView. Daily completion (W/L badge, "4
    /// guesses · 27s", accent tint) is a DAILY-only concept: in Unlimited the
    /// cards show the static description, no badge or tint, and a small infinity
    /// mark (Pro parity #91; home redesign 2026-10-01).
    private func cardBody(_ mode: HomeMode, locked: Bool) -> some View {
        let daily = effectiveMode == .daily
        let done = daily ? mode.dbKey.flatMap { completions.byMode[$0] } : nil
        return ModeCardView(mode: mode, done: done, locked: locked, unlimited: !daily)
    }

    /// FINISH_SPEC BI10: clear every game cover binding (and the Played Today modal).
    private func closeAllGames() {
        pendingGame = nil; pnGame = nil; pnDaily = false
        sudokuGame = nil; regionsGame = nil; ladderGame = nil; spyglassGame = nil
        hubGame = nil; codebreakerGame = nil; kindredGame = nil; crosswordGame = nil
        muddleGame = nil; solvedMode = nil; limitModal = nil
    }

    /// Runs when any game cover (or the solved-puzzle cover) has dismissed:
    /// refresh the day, and Unlimited's played-today counts.
    private func onGameCoverDismissed() {
        reloadDaily()
        Task { await loadUnlimitedCounts() }
        refreshSweptRowStreaks(afterAward: false)
    }

    /// Puzzles (More Games) Sweep / Flawless (founder, 2026-09-26): once per local day per tier, after
    /// the Daily Sweep celebration if both land together. Visual only — no bonus, XP or board.
    private func checkMoreSweepCelebration() {
        guard auth.isAuthenticated, completions.dataDay == LeaderboardService.todayLocal() else { return }
        guard let tier = moreSweepTier(byMode: completions.byMode, modes: visibleMoreModes) else { return }
        let day = LeaderboardService.todayLocal()
        let token = "\(day):\(tier == .flawless ? "flawless" : "sweep")"
        if moreSweepCelebratedDay == token || moreSweepCelebratedDay == "\(day):flawless" { return }
        moreSweepCelebratedDay = token
        // BI16: after any Daily Sweep already queued, at its own calm moment.
        celebQueue.removeAll { $0.more && $0.day == day }
        queueCelebration(SweepCeleb(byMode: completions.byMode, day: day, more: true))
    }
}

/// Freemium "Played Today" lock modal — ports modals/mode-limit-modal.tsx:
/// lock icon, "{mode} — Played Today", upsell copy, play-again countdown,
/// Upgrade to Pro (amber btn-3d), and View Solved Puzzle.
struct ModeLimitModal: View {
    let mode: HomeMode
    var showViewSolved: Bool = true
    let onClose: () -> Void
    let onUpgrade: () -> Void
    let onViewSolved: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.5).ignoresSafeArea().onTapGesture { onClose() }
            VStack(spacing: 0) {
                // FINISH_SPEC §R3: the Unlimited gate speaks the KEEP PLAYING card's
                // language — U in her loop of candy tiles (then U's all-done scene,
                // then the §5 lock as fallbacks).
                if ArtAsset.exists("art-scene-unlimited-loop") {
                    Image("art-scene-unlimited-loop").resizable().interpolation(.high).scaledToFit()
                        .frame(height: 120)
                        .accessibilityHidden(true)
                        .padding(.bottom, 10)
                } else if ArtScene.allDone.isAvailable {
                    SceneArt(.allDone, height: 120).padding(.bottom, 10)
                } else {
                    Icon3D(.lock, size: 52).padding(.bottom, 12)
                }
                Text("\(mode.title) — Played Today").font(Brand.font(18, .black)).foregroundStyle(FinishInk.heading)
                    .multilineTextAlignment(.center).padding(.bottom, 4)
                Text("You've used your free play of \(mode.title) for today. Upgrade to Pro for unlimited replays and ad-free gameplay across every mode.")
                    .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                    .multilineTextAlignment(.center).padding(.bottom, 16)

                // §A2: the countdown is a soft number on a tinted pill.
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    HStack(spacing: 6) {
                        Text("Play again in").font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.secondary)
                        Text(countdown()).softNumber(16)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Play again tomorrow in \(countdown())")
                }
                .padding(.horizontal, 16).padding(.top, 9).padding(.bottom, 7)
                .tintedPill(G5Accent.purple)
                .padding(.bottom, 18)

                // §G5 / §A8: amber "Go Pro" candy (the money CTA), then the solved
                // review, then the quiet peach "Not now".
                Button(action: onUpgrade) {
                    CandyLabel(title: "Go Pro") { Icon3D(.crown, size: 20) }
                }
                .buttonStyle(CandyButtonStyle(variant: .amber, size: .large))
                .accessibilityLabel("Upgrade to Pro")
                .padding(.bottom, 6)

                // Web parity: only show "View Solved Puzzle" when there IS a solved
                // puzzle to review (VS has none) — otherwise just the dismiss.
                // Previously showViewSolved was never read, so the locked VS card
                // dead-ended into an empty fullScreenCover.
                if showViewSolved {
                    Button(action: onViewSolved) {
                        CandyLabel(title: "View Solved Puzzle", symbol: "eye.fill")
                    }
                    .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium))
                    .padding(.bottom, 6)
                }
                Button(action: onClose) { CandyLabel(title: "Not now") }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .small, fullWidth: false))
                    .accessibilityHint(showViewSolved ? "" : "Come back tomorrow")
            }
            .padding(24)
            .frame(maxWidth: 360)
            // §G5 / §R3: the limit window is a peach-tinted card with its top bar
            // (the Unlimited card's language, §A1 — no white).
            .tintedCard(accent: Color(hex: 0xFB923C), bar: [Color(hex: 0xFFD6C2), Color(hex: 0xFB923C)], radius: 22, barHeight: 10,
                        tint: 0.10, line: 0.30)
            .shadow(color: .black.opacity(0.15), radius: 30, x: 0, y: 20)
            .padding(.horizontal, 24)
        }
    }

    private func countdown() -> String {
        let s = secondsUntilLocalMidnight()
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}

/// LIVE pulse dot — self-contained so the live-count poll re-rendering the
/// banner can't disturb/displace its animation. Pulses opacity in place
/// (layout-neutral); respects Reduce Motion.
struct LivePulseDot: View {
    @State private var dim = false
    var body: some View {
        Circle().fill(Color(hex: 0x22C55E)).frame(width: 8, height: 8)
            .opacity(dim ? 0.35 : 1)
            .onAppear {
                guard !ThemeManager.shared.reducedMotion else { return }
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { dim = true }
            }
    }
}
