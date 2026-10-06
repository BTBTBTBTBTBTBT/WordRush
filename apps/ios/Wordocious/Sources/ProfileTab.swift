import SwiftUI
import WordociousCore

/// STATS (Stats + Friends redesign D2, founder 2026-09-26: "option 2" — Profile
/// and Records merge into one Stats tab that "flows like butter"). Port of
/// app/stats/page.tsx:
///   STATS headline → player card → the game picker window (GamePickerCard,
///   FINISH_SPEC §C3 — the Leaderboard's picker) → ONE scroll below it (FINISH_SPEC
///   BJ1, founder 10-03: no Today | All-time toggle): the picked game's — or
///   Overview's — TODAY section first, its ALL-TIME section beneath.
///   Overview: TodayCard + today's games, then the snapshot hero, Your Records, every
///   chart, Signature, Standing trend, Progression, VS and Recent Matches. A game:
///   today's result (or "Not played today" + Play), then its all-time stats. The
///   Sweep tile: today's sweep runs, then the sweep records.
/// A horizontal swipe moves one step through the picker. Everything sits in ONE
/// LazyVStack (every card its own lazy element) — BJ1's measured scroll fix.
struct ProfileTab: View {
    /// §AJ: a footer tap pops this tab's stack (token).
    @ObservedObject private var tabRouter = TabRouterModel.shared
    @EnvironmentObject private var auth: AuthService
    @StateObject private var completions = DailyCompletionsStore()
    @State private var showAuth = false
    @State private var showPro = false
    @State private var statRows: [UserStatRow] = []
    /// FINISH_SPEC BJ1: the picked GAME (nil = Overview). Core `StatsSelection.sections`
    /// resolves the two sections shown — Today first, All-time beneath.
    @State private var sel = StatsSelection.initial
    /// The picked game's key, or "overview" — the page id and the lookups below.
    private var selected: String { sel.game ?? "overview" }
    /// BJ1: the quick crossfade on a pick (opacity only) and the scroll-to-top request.
    @State private var pageFade: Double = 1
    @State private var scrollTopToken = 0
    /// Bumped by select(.vs): content() scrolls All-time to its VS section.
    @State private var vsScrollToken = 0
    /// A drag started in a horizontal-scrolling row — it never pages the game.
    @State private var pageSwipeBlocked = false
    /// The All-time VS section's per-game board — one word game at a time (Classic by default).
    @State private var vsMode: GameMode = .duel
    /// Today's daily VS outcome (nil = not played) — the Today card's VS pill
    /// and the VS RECORD card's "Today:" line.
    @State private var vsDailyWon: Bool? = nil
    /// Sweep + flawless streaks for the Today card (MatchStatsService, §244).
    @State private var sweepStats = MatchStatsService.DailySweepStats()
    /// Today's field standing — the ONE formula the old standing strip used.
    @State private var standing: StatsDeepService.DailyStanding? = nil
    /// An own-engine More Games daily opened from its game page ("Play →").
    @State private var badgeMore: HomeMode?
    // Per-mode win streak for the mode-detail grid (computed from match history,
    // mirrors web mode-detail-panel's fetchModeWinStreak). Not stored in
    // user_stats, so it's fetched when the selected mode changes.
    // + the selected mode's pure aggregate over the player's own matches rows
    // (ModeStats.modeAggregates) — the custom games' grid cells (Clean, Avg
    // Mistakes, Pangrams, …) read from it; word modes ignore it.
    // Keyed "uid:mode:tab" and mirrored to StatsMemo (founder, 2026-09-29): one shared pair used to
    // be RESET to zero on every page switch, so the grid showed "0" / "—" cells for a frame (or a
    // round trip) and then filled. Now the new page's cells read their own entry in the first frame.
    private struct ModeCells { var streak: (current: Int, best: Int); var aggregates: ModeAggregates }
    @State private var modeCells: [String: ModeCells] = [:]
    private func modeCellsKey(_ mode: GameMode, _ tab: String) -> String {
        "modeCells:\(auth.profile?.id ?? "anon"):\(mode.rawValue):\(tab)"
    }
    // Solo/VS scope for the per-game charts (restat B1). A game page's
    // Solo | VS toggle drives it; the All-time charts read it like the web.
    // (Never vs_cpu any more — All-time's VS section keeps its own vsSectionTab.)
    @State private var activeTab = "solo"
    /// All-time's VS section People | Bots ("vs" | "vs_cpu") — its OWN state, never activeTab
    /// (founder, 2026-10-01): picking Bots there must not rebuild the All-time page, re-scope
    /// its charts or show the Bots note up top. Web `vsTab`.
    @State private var vsSectionTab = "vs"
    @State private var unlockedAchievements: Set<String> = []
    /// §V1: key → `unlocked_at` (the date under each unlocked badge).
    @State private var achievementDates: [String: String] = [:]
    /// §V1: the badge tapped in the grid (its detail sheet).
    @State private var achievementDetail: AchievementDef?
    @StateObject private var achievementCatalog = AchievementCatalog.shared
    @State private var medals: [MedalRow] = []
    @State private var showAllMedals = false
    @State private var gamesThisWeek = 0
    @State private var socialLinks: [String: String] = [:]
    @State private var recentMatches: [PublicProfileService.RecentMatch] = []
    /// Today's Games rows (filtered to today + Unlimited grouped), rebuilt by setRecent / refreshToday.
    @State private var todayEntries: [TodayGamesList.Entry] = []
    @State private var reloadToken = 0
    @State private var opponentNames: [String: String] = [:]
    @State private var recentLoading = true
    @State private var showEditProfile = false
    /// §263: the daily badges present games FULL-SCREEN (like Home and the
    /// Leaderboard Play CTA), not pushed onto this tab's NavigationStack. A
    /// pushed game's `dismiss()` + the results screen's tab switch left the
    /// bottom nav hidden and the "Next Daily" hand-off waiting forever
    /// (founder, Sep 13: no footer on Leaderboard, Next Daily went nowhere).
    @State private var badgeGame: LeaderboardTab.LbGame?
    @State private var badgeSolved: LeaderboardTab.LbGame?
    @State private var badgePN = false
    // Account section (web parity): notification toggle + Delete Account flow.
    @AppStorage("pref-daily-reminder") private var dailyReminder = false
    @State private var reminderDenied = false
    @State private var showDeleteConfirm = false
    @State private var deleting = false
    @State private var deleteError = false
    // Games played in the last 7 days — powers the Insights "this week" line.
    @State private var sevenDayTotal = 0
    /// D2 step 3: the old Records → You view's data (records held, sweep
    /// ranks, record chases) — the per-game Your Records cards and the
    /// All-time page's YOUR RECORDS section read it.
    @State private var yours = YourRecordsData()
    /// Founder, 2026-10-01 stats audit: the Puzzles row's current runs (Today card), its
    /// lifetime sweep totals (All-time "Puzzles Sweeps") and the Word of the Day record.
    @State private var puzzleStreaks = HomeStreaksService.cachedStreaks(.puzzles)
    @State private var puzzleTotals = DayRunTotals(sweepDays: 0, flawlessDays: 0, bestSweep: 0, bestFlawless: 0)
    @State private var quizRecord = HomeStreaksService.QuizRecord(streak: 0, best: 0, right: 0, answered: 0)

    // Every daily mode this viewer can see — the sweep modes plus the More Games
    // titles (ProperNoundle lives there since Stage 9; its HomeMode has `mode:
    // nil` but a GameMode case + stats rows). Only VS (dbKey nil) is excluded.
    // Flag-gated titles stay hidden until their flag is on, so an unlaunched
    // game never leaks. Lookup for the selected game page's title/icon/accent.
    private var dailyModes: [HomeMode] {
        (homeModes + moreModes).filter { $0.dbKey != nil && $0.dailyEligible && FlagsService.shared.isOn($0.flagKey) }
    }
    // The Today card's tiles = the Daily Sweep set only (ModeGen.sweep via the
    // core grid), so its N/M matches the completions store.
    private let dailyTiles: [HomeMode] = homeModes.filter { $0.dbKey != nil && $0.sweep }
    /// The More Games dailies on the rail: catalog ∩ remote flags.
    private var visibleMore: [HomeMode] {
        moreModes.filter { $0.dailyEligible && $0.dbKey != nil && FlagsService.shared.isOn($0.flagKey) }
    }
    /// FINISH_SPEC §C3: the picker window's order — Today, All-time, the WORDOCIOUS
    /// row (the same filter `GamePickerCard` draws), the Sweep tile, then the PUZZLES
    /// row. The horizontal swipe walks it one step at a time.
    private var pickerOrder: [String] {
        let flags = FlagsService.shared
        let words = homeModes.filter { flags.isOn($0.flagKey) && !$0.homeWide && $0.dbKey != nil }.compactMap(\.dbKey)
        let puzzles: [String] = homeModes.contains(where: { $0.id == "more" && flags.isOn($0.flagKey) })
            ? moreDailyModes(moreModes.filter { flags.isOn($0.flagKey) }).compactMap(\.dbKey) : []
        return [StatsRailKey.today, StatsRailKey.all] + words + [GamePicker.sweep] + puzzles
    }
    /// Today's W / L per game for the picker tiles (completed → won, as the old rail dot).
    private var todayResults: [String: Bool] { completions.byMode.mapValues { $0.completed } }
    /// The picker header's label: what the page below shows.
    private var pickerTitle: String {
        // BG: the header names the GAME (or Overview); the scope rides its chip.
        switch sel.game {
        case nil: return "Overview"
        case GamePicker.sweep?: return "Daily Sweep"
        default: return selectedMeta?.title ?? "Overview"
        }
    }
    /// Word-engine games and ProperNoundle have live VS boards; the More Games titles do not.
    private func hasVs(_ dbKey: String) -> Bool {
        guard let meta = ModeGen.byDbKey(dbKey) else { return false }
        return meta.engine == "word" || dbKey == "PROPERNOUNDLE"
    }
    /// All-time's VS board picker: every game with live VS boards — the sweep word
    /// games plus ProperNoundle (BJ12: it was missing; web `vsModes`).
    private var vsModes: [HomeMode] { dailyModes.filter { hasVs($0.dbKey ?? "") } }
    /// The selected game page's catalog record (nil on Today / All-time).
    private var selectedMeta: HomeMode? { dailyModes.first { $0.dbKey == selected } }
    /// The play-type a game page scopes to: VS only where the game has a live board.
    private var gamePageTab: String { activeTab == "vs" && hasVs(selected) ? "vs" : "solo" }

    /// Rail selection — web `setSelected`: landing on a game without a VS board
    /// drops the scope to Solo. StatsRailKey.vs (the Today card's VS Battle pill)
    /// is All-time's VS section now (founder, 2026-10-01: VS left the rail).
    private func select(_ key: String) {
        // The page swaps in ONE un-animated transaction (founder, 2026-09-29: the rail showed a
        // "page loading in" — the 0.18 s crossfade kept the old page laid out under the new one
        // while it faded, and the new page's cards then filled in behind it). Every card now
        // paints from the session memo in its first frame, so there is nothing left to fade.
        // (2026-09-26: the old implicit `.animation(value:)` on the scroll content is what left
        // the page magnified and stuck — never reintroduce it.)
        var t = Transaction(); t.disablesAnimations = true
        if key == StatsRailKey.vs {
            // Overview, then glide to its All-time VS section.
            withTransaction(t) { sel = .initial }
            vsScrollToken += 1
            return
        }
        // BJ1: a picker tap picks the GAME (the picked game again → Overview); the legacy
        // Today / All-time keys both mean Overview now.
        switch key {
        case StatsRailKey.today, StatsRailKey.all: apply(sel.opening(nil))
        default: apply(sel.picking(key))
        }
    }

    /// Show `next`: the content swaps in one un-animated transaction, fades in from 35%
    /// (opacity only — cheap, no layout animation) and the scroll returns to the top.
    private func apply(_ next: StatsSelection) {
        guard next != sel else { return }
        var t = Transaction(); t.disablesAnimations = true
        withTransaction(t) {
            sel = next
            if let g = next.game, g != GamePicker.sweep, !hasVs(g) { activeTab = "solo" }
            pageFade = Theme.reduceMotion ? 1 : 0.35
            scrollTopToken += 1
        }
        withAnimation(.easeOut(duration: 0.16)) { pageFade = 1 }
    }

    /// A Today-card row → that game (never toggles it off).
    private func jump(to key: String) {
        if key == StatsRailKey.vs || key == StatsRailKey.today || key == StatsRailKey.all { select(key); return }
        apply(sel.opening(key))
    }

    /// Solo | VS and People | Bots — the same un-animated swap as the rail.
    private func setActiveTab(_ t: String) {
        var tx = Transaction(); tx.disablesAnimations = true
        withTransaction(tx) { activeTab = t }
    }

    /// All-time's VS People | Bots — the same un-animated swap, scoped to the VS section only.
    private func setVsSectionTab(_ t: String) {
        var tx = Transaction(); tx.disablesAnimations = true
        withTransaction(tx) { vsSectionTab = t }
    }

    /// Swipe on the page moves one step through the picker (founder: no 19-page
    /// swipe — but a swipe between neighbors is the natural gesture).
    private func step(_ delta: Int) {
        // BJ1: the swipe walks the GAME (Overview first).
        let games = pickerOrder.filter { $0 != StatsRailKey.today && $0 != StatsRailKey.all }
        let next = sel.swiped(delta, order: games)
        guard next != sel else { return }
        Haptics.tap()
        apply(next)
    }

    var body: some View {
        NavigationStack {
            Group {
            ZStack {
                PageBackground(tint: .stats)
                VStack(spacing: 0) {
                    AppHeaderView()   // shared header (settings now lives here)
                    // §241: during the launch-restore window a returning
                    // player must never see the signed-out pitch — the cached
                    // profile usually fills this gap; a brief spinner covers a
                    // cacheless upgrade launch.
                    if let profile = auth.profile {
                        content(profile)
                    } else if auth.isLoading && AuthService.hadPersistedSession {
                        CastLoader(showTips: false).frame(maxWidth: .infinity, minHeight: 240)
                    } else {
                        signedOut
                    }
                }
                // BI23: the header stays at the top whatever the branch's height.
                .frame(maxHeight: .infinity, alignment: .top)
                .wideColumn(.page)   // §AG: iPad column, centered on the wallpaper
            }
            .environment(\.pageTint, .stats)
            .toolbar(.hidden, for: .navigationBar)
            // The VS lobby's Rivals "See all" → All-time's VS section.
            .onReceive(NotificationCenter.default.publisher(for: StatsJump.openVS)) { _ in
                if StatsJump.consumeVS() { select(StatsRailKey.vs) }
            }
            .onAppear {
                if StatsJump.consumeVS() { select(StatsRailKey.vs) }
                if StatsJump.consumeAchievements() { apply(.initial) }
            }
            // BF2 "See all" from an unlock popup: Overview's All-time holds the achievements grid.
            .onReceive(NotificationCenter.default.publisher(for: StatsJump.openAchievements)) { _ in
                if StatsJump.consumeAchievements() { apply(.initial) }
            }
            .gameCover(item: $badgeGame) { g in
                NavigationStack {
                    if let id = CustomDailyView.customId(for: g.mode) { CustomDailyView(id: id) }
                    else { GameScreen(seed: DailySeed.today(mode: g.mode), mode: g.mode, title: g.title) }
                }
            }
            .gameCover(item: $badgeSolved) { g in
                NavigationStack {
                    if let id = CustomDailyView.customId(for: g.mode) { CustomDailyView(id: id) }
                    else { SolvedPuzzleView(mode: g.mode, title: g.title) }
                }
            }
            .gameCover(isPresented: $badgePN) {
                NavigationStack { ProperNoundleView() }
            }
            // Own-engine More Games dailies (nil seed = today's; each view
            // restores its finished board when already played) — the same
            // switch RootTabView's Next Daily hand-off and Home use.
            .gameCover(item: $badgeMore) { m in
                NavigationStack { CustomDailyView(id: m.id) }
            }
            .onDailyRecorded { reloadToken += 1 }
            .onGameRecorded { reloadAfterGame() }
            .onAppear { if let uid = auth.profile?.id { seedFromMemo(uid) }; refreshToday(); prewarmBadges() }   // refresh: the day may have rolled over
            .onChange(of: auth.isProActive) { _ in refreshToday() }
            .task(id: "\(auth.profile?.id ?? "")-\(reloadToken)") {
                // P1: every independent fetch runs concurrently (was 8+ serial
                // round trips). Only the opponent-name lookup chains off
                // recentMatches; the 7-day activity calendar is fetched ONCE
                // and feeds both gamesThisWeek and sevenDayTotal.
                async let completionsLoad: Void = completions.load()
                async let catalogLoad: Void = achievementCatalog.load()
                if let uid = auth.profile?.id {
                    // P-cache: paint everything from the session memo first (also
                    // done in onAppear, before the first frame, so cached rows never
                    // flash the skeleton); the fresh fetches below swap in.
                    seedFromMemo(uid)
                    let memo = StatsMemo.shared
                    // D2: today's VS result (the rail dot + VS card), the sweep
                    // streak and today's standing (the Today card).
                    async let vsTodayF = DailyResultsService.dailyVSResult()
                    async let sweepF = MatchStatsService.dailySweepStats()
                    async let standingF = StatsDeepService.todayDailyStanding()
                    async let statsF = UserStatsService.fetch(userId: uid)
                    async let achievementsF = AchievementService.fetchUnlockedDates(userId: uid)
                    async let medalsF = MedalsService.recent(userId: uid, limit: 120)
                    async let weekF = MatchStatsService.activityCalendar(days: 7)
                    async let socialF = ProfileExtras.socialLinks(userId: uid)
                    async let matchesF = PublicProfileService.recentMatches(id: uid)
                    // D2 step 3: the all-time record table + sweep ranks; the
                    // chases fold the user_stats rows in once they land.
                    async let yoursF = YourRecordsData.fetch(userId: uid)
                    // The Puzzles runs + lifetime totals (one daily_results fetch, the home
                    // banner's) and the Word of the Day record.
                    let puzzleKeys = visibleMore.compactMap(\.dbKey)
                    async let puzzlesF = HomeStreaksService.puzzleRecords(dbKeys: puzzleKeys)
                    async let quizF = HomeStreaksService.quizRecord()
                    // Smoothness (founder, 2026-09-29: "not really fluid, seems kind of glitchy
                    // in the loading and scrolling"): gather every result first, then assign
                    // them together without animation so the page re-lays out ONCE instead of
                    // after each await.
                    let fStats = await statsF, fAch = await achievementsF, fMedals = await medalsF, fSocial = await socialF
                    let fMatches = await matchesF
                    let fNames = await PublicProfileService.usernames(ids: Array(Set(fMatches.compactMap { $0.opponentId(uid) })))
                    let week = await weekF
                    // Last-7-days game count for the Insights "this week" line.
                    let cal = Calendar.current
                    let cutoff = cal.date(byAdding: .day, value: -6, to: cal.startOfDay(for: Date()))
                    let fWeekTotal = week.reduce(0) { $0 + $1.played }
                    let fSeven = week.filter { cutoff == nil || $0.day >= cutoff! }.reduce(0) { $0 + $1.played }
                    let fVs = await vsTodayF, fSweep = await sweepF, fStanding = await standingF
                    let fYours = await yoursF.resolved(userId: uid, stats: fStats)
                    let fPuzzles = await puzzlesF, fQuiz = await quizF
                    guard !Task.isCancelled else { return }
                    var t = Transaction(); t.disablesAnimations = true
                    // BI19: never blank the page. The services swallow errors into
                    // empties, so an empty result over cached data is a failed fetch
                    // (stats, unlocks, medals and match history never shrink to
                    // nothing): keep what's showing. Assign only what changed.
                    let keepStats = CacheFirst.keep(fresh: fStats, cached: statRows)
                    let keepAch = CacheFirst.keep(fresh: fAch, cached: achievementDates)
                    let keepMedals = CacheFirst.keep(fresh: fMedals, cached: medals)
                    let weekFailed = week.isEmpty && gamesThisWeek > 0
                    let fetchFailed = fStats.isEmpty && !statRows.isEmpty
                    withTransaction(t) {
                        if keepStats != statRows { statRows = keepStats }
                        if keepAch != achievementDates { unlockedAchievements = Set(keepAch.keys); achievementDates = keepAch }
                        if keepMedals != medals { medals = keepMedals }
                        if !fSocial.isEmpty || socialLinks.isEmpty { socialLinks = fSocial }
                        if !fMatches.isEmpty || recentMatches.isEmpty {
                            opponentNames = fNames
                            if fMatches != recentMatches || recentLoading { setRecent(fMatches) }
                        } else { recentLoading = false }
                        if !weekFailed { gamesThisWeek = fWeekTotal; sevenDayTotal = fSeven }
                        vsDailyWon = CacheFirst.keep(fresh: fVs, cached: vsDailyWon)
                        standing = CacheFirst.keep(fresh: fStanding, cached: standing)
                        // Whole-page outage (the stats read failed too): the rest of
                        // the cached page stays rather than mixing in zeroed records.
                        if !fetchFailed {
                            sweepStats = fSweep; yours = fYours
                            puzzleStreaks = fPuzzles.streaks; puzzleTotals = fPuzzles.totals; quizRecord = fQuiz
                        }
                    }
                    if fetchFailed { return }   // don't write the failure back into the cache
                    HomeStreaksService.storeStreaks(puzzleStreaks, .puzzles)
                    // Store the fresh results back into the session memo.
                    memo.set("yourRecords:\(uid)", yours)
                    memo.set("sweepStats:\(uid)", sweepStats)
                    memo.set("vsDailyWon:\(uid)", vsDailyWon)
                    memo.set("standing:\(uid)", standing)
                    memo.set("statRows:\(uid)", statRows)
                    memo.set("achievements:\(uid)", unlockedAchievements)
                    memo.set("achievementDates:\(uid)", achievementDates)
                    memo.set("medals:\(uid)", medals)
                    memo.set("socialLinks:\(uid)", socialLinks)
                    memo.set("recentMatches:\(uid)", recentMatches)
                    memo.set("opponentNames:\(uid)", opponentNames)
                    memo.set("gamesThisWeek:\(uid)", gamesThisWeek)
                    memo.set("sevenDayTotal:\(uid)", sevenDayTotal)
                    memo.set("puzzleTotals:\(uid)", puzzleTotals)
                    memo.set("quizRecord:\(uid)", quizRecord)
                }
                _ = await (completionsLoad, catalogLoad)
                prewarmBadges()
            }
            // Banner inside the NavigationStack so the ScrollView insets for it
            // (the Sign-out button stays scrollable above the banner) and it
            // doesn't leak onto pushed detail views.
                    }
            // §AJ: this tab's root (a push over it is tracked) — a footer tap pops it.
            .tabRootTracked(.stats)
        }
        .id(TabRouterModel.shared.token(.stats))
    }

    /// BJ1: decode + downsample (and pre-gray the locked) achievement badges off the main
    /// thread, so scrolling into the grid never decodes art mid-scroll.
    private func prewarmBadges() {
        let unlocked = unlockedAchievements
        BadgeArt.prewarm(achievementCatalog.all.map {
            (name: BadgeArt.achievementAsset(key: $0.key, icon: $0.icon, category: $0.category), gray: !unlocked.contains($0.key))
        }, points: 54)
    }

    /// Paint from the session memo in one pass (no animation). Cheap and synchronous,
    /// so onAppear can run it before the first frame.
    private func seedFromMemo(_ uid: String) {
        let memo = StatsMemo.shared
        var t = Transaction(); t.disablesAnimations = true
        withTransaction(t) {
            if let v: [UserStatRow] = memo.get("statRows:\(uid)") { statRows = v }
            if let v: Set<String> = memo.get("achievements:\(uid)") { unlockedAchievements = v }
            if let v: [String: String] = memo.get("achievementDates:\(uid)") { achievementDates = v }
            if let v: [MedalRow] = memo.get("medals:\(uid)") { medals = v }
            if let v: [String: String] = memo.get("socialLinks:\(uid)") { socialLinks = v }
            if let v: [PublicProfileService.RecentMatch] = memo.get("recentMatches:\(uid)") {
                if let n: [String: String] = memo.get("opponentNames:\(uid)") { opponentNames = n }
                if v != recentMatches || recentLoading { setRecent(v) }
            }
            if let v: Int = memo.get("gamesThisWeek:\(uid)") { gamesThisWeek = v }
            if let v: Int = memo.get("sevenDayTotal:\(uid)") { sevenDayTotal = v }
            if let v: MatchStatsService.DailySweepStats = memo.get("sweepStats:\(uid)") { sweepStats = v }
            if let v: Bool? = memo.get("vsDailyWon:\(uid)") { vsDailyWon = v }
            if let v: StatsDeepService.DailyStanding? = memo.get("standing:\(uid)") { standing = v }
            if let v: YourRecordsData = memo.get("yourRecords:\(uid)") { yours = v }
            if let v: DayRunTotals = memo.get("puzzleTotals:\(uid)") { puzzleTotals = v }
            if let v: HomeStreaksService.QuizRecord = memo.get("quizRecord:\(uid)") { quizRecord = v }
        }
    }

    /// BJ12: ANY recorded game (Unlimited, VS, bots — `onDailyRecorded` reloads the
    /// whole page for dailies) re-reads just the match list and the per-game totals,
    /// so Today's Games, Recent Matches and All-time never sit a game behind.
    private func reloadAfterGame() {
        guard let uid = auth.profile?.id else { return }
        Task {
            async let statsF = UserStatsService.fetch(userId: uid)
            async let matchesF = PublicProfileService.recentMatches(id: uid)
            let fStats = await statsF, fMatches = await matchesF
            var fNames: [String: String] = [:]
            if !fMatches.isEmpty { fNames = await PublicProfileService.usernames(ids: Array(Set(fMatches.compactMap { $0.opponentId(uid) }))) }
            guard auth.profile?.id == uid else { return }
            var t = Transaction(); t.disablesAnimations = true
            withTransaction(t) {
                // BI19: an empty read is a failed fetch — keep what's showing.
                if !fStats.isEmpty && fStats != statRows { statRows = fStats }
                if !fMatches.isEmpty && fMatches != recentMatches { opponentNames = fNames; setRecent(fMatches) }
            }
            let memo = StatsMemo.shared
            memo.set("statRows:\(uid)", statRows)
            memo.set("recentMatches:\(uid)", recentMatches)
            memo.set("opponentNames:\(uid)", opponentNames)
        }
    }

    /// The one place recentMatches changes: today's list (filtered and grouped) is
    /// computed here, once, never inside `body` (founder, 2026-09-29).
    private func setRecent(_ m: [PublicProfileService.RecentMatch]) {
        recentMatches = m
        recentLoading = false
        refreshToday()
    }

    private func refreshToday() {
        guard let uid = auth.profile?.id else { todayEntries = []; return }
        todayEntries = TodayGamesList.entries(recentMatches.filter { RecentMatchesList.isToday($0.created_at) },
                                              profileId: uid, isPro: auth.isProActive)
    }

    /// FINISH_SPEC BI23: D hosts the signed-out pitch, centered BELOW the pinned header
    /// (the old body was content-sized, so header + pitch centered together mid-screen).
    private var signedOut: some View {
        // BJ16 quick win: the STATS page title above the pitch (never a page without its lettering).
        VStack(spacing: 0) {
        PageHeadline(.stats, bleed: 12).padding(.top, 4)
        GuestPitch(hosts: [Mascots.stats], title: "Your stats live here",
                   subtitle: "Sign in to track your stats, streaks and every game's history.",
                   colors: [Color(hex: 0x2563EB), Color(hex: 0x8B5CF6)],
                   preview: .chips(GuestPitch.statsChips), onSignIn: { showAuth = true })
        }
            .softSheet(isPresented: $showAuth) { AuthView() }
    }

    /// The scroll's top anchor (a pick scrolls back here).
    private let topAnchorId = "stats-top"
    /// The page id: a pick (or the Solo | VS toggle) builds the sections fresh, so every card
    /// paints the new game's memo in its first frame.
    private var pageKey: String { "page-\(selected)-\(activeTab)" }

    private func content(_ p: Profile) -> some View {
        // FINISH_SPEC BJ1 (founder 10-03 on 241: "stats was almost unscrollable because it was going
        // so slow"). Measured: the page was ONE VStack that built and laid out every card — every
        // Swift Chart, ~120 achievement badges (each a grayscale filter + an image shadow, both
        // offscreen passes), the medal list, the VS board — at once, and re-evaluated all of it on
        // any state change. Now everything sits in ONE LazyVStack, every card its own element
        // (the achievements grid one element per row), so only what's on screen is built.
        ScrollViewReader { proxy in
        ScrollView {
            LazyVStack(spacing: 16) {
                statsTitle.id(topAnchorId)
                header(p)
                gamePicker
                // BJ1: ONE scroll — Today, then All-time. The single-element ForEach keys the
                // sections on the page, so a pick builds them fresh (no stale cards).
                ForEach([pageKey], id: \.self) { _ in
                    pageSections(p)
                }
                .opacity(pageFade)
            }
            .padding(.horizontal, 12).padding(.top, 8)
            // §AS3: the last section always ends clear of the docked footer (its
            // measured height + 16 pt) and stays tappable.
            .tabScrollTail()
            // Scroll-jump fix (founder, build 237): the swipe is measured in SCREEN space, and
            // only a clearly horizontal swipe (≥ 70 pt, twice as wide as tall — core StatsSwipe)
            // pages, never one that started in a horizontal-scrolling row. Only `onEnded`:
            // nothing is written while the finger moves.
            .simultaneousGesture(
                DragGesture(minimumDistance: 24, coordinateSpace: .global).onEnded { v in
                    defer { pageSwipeBlocked = false }
                    guard !pageSwipeBlocked,
                          let dir = StatsSwipe.step(dx: Double(v.translation.width), dy: Double(v.translation.height))
                    else { return }
                    step(dir)
                }
            )
        }
        .reportsScrollMotion()   // §AQ2: idle loops pause while scrolling
        // select(.vs) swapped to Overview un-animated; once it is laid out, glide down to
        // its VS section (web: scrollIntoView smooth, block start).
        .onChange(of: vsScrollToken) { _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.06) {
                withAnimation(Theme.animation(.easeOut(duration: 0.35))) { proxy.scrollTo(vsSectionId, anchor: .top) }
            }
        }
        #if DEBUG
        // Store-demo QA (BJ17): `-storeStatsScroll <anchor id>` lands the page on one section
        // (e.g. standing-trend) so a locked state can be shot without manual scrolling.
        .task {
            let a = ProcessInfo.processInfo.arguments
            guard let i = a.firstIndex(of: "-storeStatsScroll"), i + 1 < a.count else { return }
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            proxy.scrollTo(a[i + 1], anchor: .top)
        }
        #endif
        // BJ1: a pick resets the scroll to the top (instant).
        .onChange(of: scrollTopToken) { _ in proxy.scrollTo(topAnchorId, anchor: .top) }
        }
        // §V1: tap a badge = the detail sheet with the big badge (lifted off the lazy grid rows).
        .softSheet(item: $achievementDetail) { a in
            let on = unlockedAchievements.contains(a.key)
            AchievementDetailSheet(def: a, unlocked: on, unlockedAt: achievementDates[a.key],
                                   progress: on ? nil : achievementProgressMap()[a.key],
                                   accent: Color(hex: achCategories.first { $0.key == a.category }?.color ?? 0x7C3AED))
        }
    }

    /// BJ1: the view's two sections — TODAY first, ALL-TIME beneath (core StatsSelection).
    @ViewBuilder private func pageSections(_ p: Profile) -> some View {
        let secs = sel.sections
        StatsSectionBanner(today: true, note: Self.todayNote())
        switch secs.first {
        case .todayGame(let g)?:
            if let m = selectedMeta, let gm = GameMode(rawValue: g) { gameTodayPage(m, mode: gm) } else { todayPage }
        case .todaySweep?:
            sweepToday
        default:
            todayPage
        }
        StatsSectionBanner(today: false, note: memberSince(p).map { "Since \($0)" })
        switch secs.last {
        case .allTimeGame(let g)?:
            if let m = selectedMeta, let gm = GameMode(rawValue: g) { gamePage(p, meta: m, mode: gm) } else { allTimePage(p) }
        case .allTimeSweep?:
            sweepAllTime
        default:
            allTimePage(p)
        }
    }

    private static let todayNoteFormatter: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "EEE, MMM d"
        return f
    }()
    private static func todayNote() -> String { todayNoteFormatter.string(from: Date()) }

    // MARK: Pages

    /// Today — the landing page: the eight sweep tiles, the Puzzles / VS /
    /// Standing pills, the ten Puzzles chips, sweep streaks + best moment,
    /// then the five newest games (founder, 2026-09-26: "the most recent games
    /// — daily AND unlimited — right on Today"; the full history stays on All-time).
    @ViewBuilder private var todayPage: some View {
        TodayCard(
            sweepModes: dailyTiles, visibleMore: visibleMore, byMode: completions.byMode,
            vsDailyWon: vsDailyWon, standing: standing,
            sweepStreak: sweepStats.currentSweepStreak, flawlessStreak: sweepStats.currentFlawlessStreak,
            puzzleStreaks: puzzleStreaks,
            onJump: { key in Haptics.tap(); jump(to: key) },
            onOpenDaily: openDaily)
        if let p = auth.profile {
            // Founder, 2026-09-27: every game played TODAY, no cap, no "See all" link — the
            // full history lives on All-time. 2026-09-29: Unlimited solo games fold into one
            // row per game (Pro only); todayEntries is computed once per fetch, not per render.
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader("Today's Games", accent: Color(hex: 0x2563EB))
                TodayGamesList(entries: todayEntries, profileId: p.id, opponentNames: opponentNames,
                               loading: recentLoading && recentMatches.isEmpty,
                               emptyText: Mascots.statsEmptyLine, emptyHost: Mascots.stats, emptyScene: .noStats)
            }
        }
    }

    /// The Sweep tile's TODAY (FINISH_SPEC §C2b / §C3, BJ1): today's sweep progress and the
    /// running sweep / flawless / Puzzles streaks as tinted tiles. From data the page holds.
    @ViewBuilder private var sweepToday: some View {
        let done = completions.completedCount
        let total = DailyCompletionsStore.totalDailyModes
        HStack(spacing: 10) {
            StatsTile(label: "Today", value: "\(done) / \(total)",
                      sub: completions.flawless ? "Flawless victory!" : (completions.allDone ? "Daily Sweep!" : "dailies played"),
                      accent: StatsTileColor.blue.accent, ink: StatsTileColor.blue.ink) {
                Icon3D(.badgeCheck, size: 22)
            }
            StatsTile(label: "Sweep streak", value: "\(sweepStats.currentSweepStreak)",
                      sub: sweepStats.currentSweepStreak == 1 ? "day in a row" : "days in a row",
                      accent: StatsTileColor.gold.accent, ink: StatsTileColor.gold.ink) {
                if ArtAsset.exists("game-sweep") { GameArtImage(asset: "game-sweep", size: 22) }
                else { Icon3D(.flame, size: 22) }
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        HStack(spacing: 10) {
            StatsTile(label: "Flawless streak", value: "\(sweepStats.currentFlawlessStreak)",
                      sub: "best \(sweepStats.bestFlawlessStreak)",
                      accent: StatsTileColor.pink.accent, ink: StatsTileColor.pink.ink) {
                Icon3D(.trophy, size: 22)
            }
            StatsTile(label: "Puzzles streak", value: "\(puzzleStreaks.sweep)",
                      sub: puzzleStreaks.flawless >= 2 ? "\(puzzleStreaks.flawless) flawless" : (puzzleStreaks.sweep == 1 ? "day" : "days"),
                      accent: StatsTileColor.purple.accent, ink: StatsTileColor.purple.ink) {
                Icon3D(.flame, size: 22)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    /// The Sweep tile's ALL-TIME (BJ1): the Daily Sweeps and Puzzles Sweeps record cards and
    /// the daily points trend (sweep / flawless days marked).
    @ViewBuilder private var sweepAllTime: some View {
        SweepRecordsCard(sweep: sweepStats, sweepRankToday: yours.sweepRankToday, sweepRankAllTime: yours.sweepRankAllTime)
        PuzzleSweepsCard(totals: puzzleTotals)
        DailyPointsChartCard(puzzleKeys: visibleMore.compactMap(\.dbKey))
    }

    /// A game page: Solo | VS toggle (live boards only), today's line, then the
    /// EXISTING per-mode stats content (registry cells, dashboard, deep insights).
    @ViewBuilder private func gamePage(_ p: Profile, meta m: HomeMode, mode gm: GameMode) -> some View {
        let tab = gamePageTab
        if hasVs(gm.rawValue) { soloVsToggle(accent: m.accent) }
        // BJ1: the game's ALL-TIME section (its TODAY sits above it).
        // Your records in this game (the old Records → You "bests by mode" card).
        if tab == "solo" {
            GameRecordsCard(dbKey: gm.rawValue,
                            my: statRows.first { $0.gameMode == gm.rawValue && $0.playType == "solo" },
                            recordsHeld: yours.recordsHeld, chases: yours.chases)
        }
        modeDetailHeader(gm, tab: tab)
        modeStats(p, mode: gm, tab: tab)
        hintsLine(mode: gm, tab: tab, accent: m.accent)
        ProfileDashboard(mode: gm, playType: tab)
        ProDeepModeCard(gameMode: gm.rawValue, isPro: auth.isProActive, accent: ModeStyle.accent(gm), playType: tab)
    }

    /// FINISH_SPEC BJ1: the game's TODAY section — its result line, today's rank and today's
    /// rows for it (Unlimited folded in); not played yet → the brand empty state + Play.
    @ViewBuilder private func gameTodayPage(_ m: HomeMode, mode gm: GameMode) -> some View {
        let played = m.dbKey.flatMap({ completions.byMode[$0] }) != nil
        let key = m.dbKey ?? gm.rawValue
        let mine = todayEntries.filter { e in
            switch e {
            case .single(let r): return r.game_mode == key
            case .group(let mode, _): return mode == key
            }
        }
        if played {
            todayLine(m)
            DailyRankBadge(gameMode: gm)
        } else {
            BrandEmptyState(title: "Not played today",
                            line: "Today's \(m.title) is waiting. Your result lands here.",
                            scene: .noStats, host: Mascots.stats, artHeight: 96,
                            actionTitle: "Play \(m.title)", actionSymbol: "play.fill",
                            action: { Haptics.tap(); openDaily(m) })
        }
        if let p = auth.profile, played || !mine.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader("Today's \(m.title) games", accent: m.accent)
                TodayGamesList(entries: mine, profileId: p.id, opponentNames: opponentNames,
                               loading: recentLoading && recentMatches.isEmpty,
                               emptyText: "No \(m.title) games yet today.", emptyHost: Mascots.stats, emptyScene: .noStats)
            }
        }
    }

    /// Hints line under the grid (founder, 2026-10-01 stats audit): every Puzzles game
    /// (ProperNoundle included) has hints — how often the player leans on them, and how
    /// many wins needed none. "HINTS · 0.4 per game · 23 no-hint wins"; hidden with no games.
    /// Reads the same per-mode aggregate the grid does (web mode-detail-panel parity).
    @ViewBuilder private func hintsLine(mode: GameMode, tab: String, accent: Color) -> some View {
        let key = modeCellsKey(mode, tab)
        if ModeGen.byDbKey(mode.rawValue)?.group == "more",
           let agg = (modeCells[key] ?? StatsMemo.shared.get(key))?.aggregates, agg.games > 0 {
            HStack(spacing: 8) {
                FinishLabel("Hints", color: accent.mixed(over: .black, 0.75))
                Text("\(WordociousCore.ModeStats.avg1(agg.hintsTotal, agg.games)) per game · \(agg.noHintWins) no-hint \(agg.noHintWins == 1 ? "win" : "wins")")
                    .font(Brand.font(11, .heavy)).foregroundStyle(FinishInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12).padding(.top, 11).padding(.bottom, 8)
            .tintedPill(accent, radius: 12)
        }
    }

    /// "Won · 4 guesses · 1m 12s · 1,940 pts  Open →" or "Not played yet — play
    /// today's <Title>  Play →", in the mode's accent tint. Tap opens the daily
    /// exactly as the Today card's tile does.
    private func todayLine(_ m: HomeMode) -> some View {
        let today = m.dbKey.flatMap { completions.byMode[$0] }
        let text: String = {
            guard let t = today else { return "Not played yet — play today's \(m.title)" }
            var s = "\(t.completed ? "Won" : "Lost") · \(formatGuessStat(semantics: m.guessSemantics, guessBase: m.guessBase, guessCount: t.guessCount))"
            if t.timeSeconds > 0 { s += " · \(formatShortTime(Int(t.timeSeconds)))" }
            let f = NumberFormatter(); f.numberStyle = .decimal
            let pts = Int(t.score.rounded())
            s += " · \(f.string(from: NSNumber(value: pts)) ?? "\(pts)") pts"
            return s
        }()
        let ink = Theme.isDark ? Theme.textSecondary : m.accent.mixed(over: .black, 0.75)
        return Button { Haptics.tap(); openDaily(m) } label: {
            HStack(spacing: 10) {
                FinishLabel("Today", color: ink)
                Text(text).font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 3) {
                    Text(today == nil ? "Play" : "Open").font(Brand.font(11, .black))
                    Image(systemName: "chevron.right").font(.system(size: 10, weight: .black))
                }
                .foregroundStyle(ink)
            }
            .padding(.horizontal, 14).padding(.top, 13).padding(.bottom, 10)
            .tintedPill(m.accent, radius: 14)
        }
        .buttonStyle(.squish)
    }

    /// All-time's VS section scroll anchor (select(.vs) lands here).
    private let vsSectionId = "vs-section"

    /// VS (founder, 2026-10-01: VS left the rail — rarely played, and the grid now comes out
    /// even; its page moved here, the bottom of All-time): the record (with today's result),
    /// Rivalries, the Bots card, then one word game's VS board: a picker + People | Bots
    /// (VS overhaul §10, 2026-10-01: was Live | CPU; People = user_stats 'vs', Bots = 'vs_cpu',
    /// the same sums the VS banner's RECORD row shows)
    /// over the per-mode view.
    @ViewBuilder private func vsSection(_ p: Profile) -> some View {
        let tab = vsSectionTab
        SectionHeader("VS", accent: Color(hex: 0xEC4899)).id(vsSectionId)
        vsRecordCard
        // Rivalries — most-faced opponents with head-to-head bars (Pro).
        if UserStatsService.vsRecord(statRows).total > 0 {
            RivalriesCard(isPro: auth.isProActive)
        }
        cpuRecordCard
        HStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(vsModes) { m in
                        let active = m.dbKey == vsMode.rawValue
                        Button { if let gm = m.mode { Haptics.tap(); vsMode = gm } } label: {
                            // Square game tile (docs/GAME_TILE_STYLE.md).
                            GameTileSquare(accent: m.accent, label: ModeGen.byId(m.id)?.shortTitle ?? m.title,
                                           selected: active, side: 56) { chip in
                                ModeIconView(icon: m.icon, accent: m.accent, box: chip)
                            }
                        }.buttonStyle(.squish)
                        .accessibilityAddTraits(active ? .isSelected : [])
                    }
                }
                .padding(.horizontal, 4).padding(.vertical, 6)
            }
            // A drag that starts in this sideways row never pages the game.
            .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in
                if !pageSwipeBlocked { pageSwipeBlocked = true }
            })
            // People | Bots — the soft segmented toggle (§A9 squish per option).
            SoftSegmented(options: [(key: "vs", label: "People"), (key: "vs_cpu", label: "Bots")],
                          selection: Binding(get: { vsSectionTab }, set: { setVsSectionTab($0) }),
                          accent: Color(hex: 0xEC4899), accessibilityLabel: "People or bots")
        }
        // Keyed on the game so a board-chip tap builds fresh cards that paint the new game's memo
        // in their first frame (founder, 2026-09-29: the page id doesn't carry vsMode, so the charts
        // kept the PREVIOUS game's data under the new header until their .task swapped it). Same
        // 16 pt spacing as the page stack, so the layout is unchanged.
        VStack(spacing: 16) {
            modeDetailHeader(vsMode, tab: tab)
            modeStats(p, mode: vsMode, tab: tab)
            ProfileDashboard(mode: vsMode, playType: tab)
            ProDeepModeCard(gameMode: vsMode.rawValue, isPro: auth.isProActive, accent: ModeStyle.accent(vsMode), playType: tab)
        }
        // + the People | Bots pick, so a toggle builds fresh cards too (the page id no longer carries it).
        .id("\(vsMode.rawValue)-\(tab)")
        // Bot games write aggregate totals only — per-game charts
        // have no data to draw from, so say so instead of blanks.
        if tab == "vs_cpu" {
            Text("Bot games record totals only — per-game charts track Solo and People matches.")
                .font(Brand.font(11, .bold)).foregroundStyle(FinishInk.secondary)
                .frame(maxWidth: .infinity).multilineTextAlignment(.center)
                .padding(.vertical, 8)
        }
    }

    /// All-time — the snapshot hero, YOUR RECORDS, every chart the old
    /// "All" view had, Insights, Pro Stats, Skill Radar, then Progression
    /// (medals, achievements), VS and Recent Matches.
    @ViewBuilder private func allTimePage(_ p: Profile) -> some View {
        SnapshotHero(profile: p, gamesThisWeek: gamesThisWeek, isPro: auth.isProActive)
        // Your records (D2 step 3): what the Records → You view used to hold.
        SectionHeader("Your Records", accent: Color(hex: 0xD97706))
        NextUpCard(dailyStreak: p.dailyLoginStreak, chases: yours.chases)
        SweepRecordsCard(sweep: sweepStats, sweepRankToday: yours.sweepRankToday, sweepRankAllTime: yours.sweepRankAllTime)
        // Founder, 2026-10-01 stats audit: the Puzzles' own sweep record, then the Word of the Day.
        PuzzleSweepsCard(totals: puzzleTotals)
        WordOfTheDayRecordCard(record: quizRecord)
        // D3.3 (§294): the settled weekly race finishes, under Daily Sweeps.
        WeeklyFinishesCard(userId: p.id)
        RecordsHeldRow(recordsHeld: yours.recordsHeld)
        TrophyShelf(recordsHeld: yours.recordsHeld)
        // Trends charts (web order inside ProfileDashboard: activity calendar,
        // last 7 days, guess distribution, solve time, daily points, top words,
        // opener lab, weekday form), then Insights, Pro Stats, Skill Radar.
        ProfileDashboard(mode: nil, playType: activeTab)
        ProfileInsightsCard(insights: allViewInsights(p))
        // Signature (audit, 2026-09-26): best day, best week, comebacks, perfects — free.
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Signature", accent: Color(hex: 0xF97316))
            SignatureCard(userId: p.id)
        }
        // Standing trend — your Top X% per day over 30 days (Pro); the card
        // carries its own STANDING TREND header so both hide together.
        StandingTrendCard(userId: p.id, isPro: auth.isProActive)
            .id("standing-trend")
        ProStatsCard(statRows: statRows)
        SkillRadarCard(isPro: auth.isProActive, statRows: statRows)
        // Progression: medals + achievements under one banner.
        SectionHeader("Progression", accent: Color(hex: 0xF59E0B))
        medalsSection(p)
        achievementsSection
        vsSection(p)
        recentMatchesSection(p)
    }

    /// Opens a daily the way the Today's Dailies tile always has: played → the
    /// read-only solved board; not played → today's game. §263: presented as a
    /// full-screen cover (badgeGame & co.), never pushed.
    private func openDaily(_ m: HomeMode) {
        let played = m.dbKey.flatMap { completions.byMode[$0] } != nil
        if let gm = m.mode, !gm.isCustomEngine {
            if played { badgeSolved = LeaderboardTab.LbGame(mode: gm, title: m.title) }
            else { badgeGame = LeaderboardTab.LbGame(mode: gm, title: m.title) }
        } else if m.id == "propernoundle" {
            // ProperNoundle has its own engine (no GameMode); the view
            // restores the completed daily board when already played.
            badgePN = true
        } else {
            badgeMore = m
        }
    }

    /// Account actions — ports profile/page.tsx section H (notification toggle,
    /// Sign Out, Delete Account with confirm).
    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ACCOUNT").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            // Daily reminder toggle (web NotificationToggle).
            Toggle(isOn: $dailyReminder) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Daily Reminders").font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                    Text("A nudge to play today's puzzles").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                }
            }
            .toggleStyle(.candy).padding(14)   // button family §4
            .statsCard()

            Button { Task { await auth.signOut() } } label: {
                HStack(spacing: 12) {
                    Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 18)).foregroundStyle(Theme.textMuted)
                    Text("Sign Out").font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                    Spacer()
                }
                .padding(16)
                .statsCard()
            }.buttonStyle(.squish)

            Button(role: .destructive) { showDeleteConfirm = true } label: {
                HStack(spacing: 12) {
                    Image(systemName: "trash").font(.system(size: 18)).foregroundStyle(Color(hex: 0xDC2626))
                    Text("Delete Account").font(Brand.font(14, .heavy)).foregroundStyle(Color(hex: 0xDC2626))
                    Spacer()
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface).pageCardShadow())
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xFECACA), lineWidth: 1.5))
            }.buttonStyle(.squish).disabled(deleting)
        }
        .onChange(of: dailyReminder) { on in
            if on {
                Task {
                    let granted = await NotificationService.requestAndSchedule()
                    if !granted { dailyReminder = false; reminderDenied = true }
                }
            } else {
                NotificationService.cancel()
            }
        }
        .alert("Notifications are off", isPresented: $reminderDenied) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Enable notifications for Wordocious in iOS Settings to get a daily reminder.")
        }
        .alert("Delete your account?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button(deleting ? "Deleting…" : "Delete Forever", role: .destructive) {
                deleting = true
                Task { let ok = await auth.deleteAccount(); deleting = false; if !ok { deleteError = true } }
            }.disabled(deleting)
        } message: {
            Text("This will permanently delete your profile, stats, streak, medals, achievements, and all game data. This action cannot be undone.")
        }
        .alert("Couldn't delete account", isPresented: $deleteError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Please try again or contact support@wordocious.com.")
        }
    }

    /// Insight strings for the All view — ports the web `insights` IIFE
    /// (profile/page.tsx): strongest mode, weekly volume, XP-to-next, dailies.
    /// Capped at 2, matching `.slice(0, 2)`.
    private func allViewInsights(_ p: Profile) -> [String] {
        var out: [String] = []
        // Strongest mode by win rate (all play types, matching the web which uses the
        // unfiltered `stats`). Founder, 2026-10-01 stats audit: only modes with ≥ 5 games
        // and a win rate ≤ 95% — a 100% rate over a few easy games isn't a strength; if
        // none qualify, no strongest-mode line.
        let qualifying = statRows.filter { $0.totalGames >= 5 && $0.wins * 100 <= $0.totalGames * 95 }
        if let strongest = qualifying.max(by: {
            (Double($0.wins) / Double(max($0.totalGames, 1))) < (Double($1.wins) / Double(max($1.totalGames, 1)))
        }) {
            let name = GameMode(rawValue: strongest.gameMode).map { ModeStyle.title($0) } ?? strongest.gameMode
            let rate = Int((Double(strongest.wins) / Double(strongest.totalGames) * 100).rounded())
            out.append("Your strongest mode is \(name) at \(rate)% win rate.")
        }
        // Weekly volume.
        let weekTotal = sevenDayTotal
        if weekTotal >= 10 { out.append("You've played \(weekTotal) games this week — on a roll!") }
        else if weekTotal >= 1 && weekTotal < 5 { out.append("Only \(weekTotal) game\(weekTotal == 1 ? "" : "s") this week — warm up with a daily.") }
        // XP to next level.
        let toNext = 1000 - (p.xp % 1000)
        if toNext <= 300 { out.append("Just \(toNext) XP away from Level \(p.level + 1).") }
        // Dailies progress.
        let done = completions.completedCount
        let total = DailyCompletionsStore.totalDailyModes
        if done == total {
            out.append(completions.flawless ? "Flawless Victory — all \(total) dailies won today." : "All \(total) dailies done today. Legendary.")
        } else if done >= 3 {
            out.append("\(done)/\(total) dailies complete today — keep going.")
        }
        return Array(out.prefix(2))
    }

    /// FINISH_SPEC §A6: the STATS title is a headline — the whole-cast art
    /// (`art-titlecast-stats`) full width, edge to edge (bleeds past the page's 12-pt
    /// padding), right on the wallpaper: no box, no float.
    private var statsTitle: some View {
        PageHeadline(.stats, bleed: 12)
    }

    // MARK: Game picker (§C3)

    /// The page's picker accent (blue) and row-label ink.
    private static let pickerAccent = Color(hex: 0x2563EB)
    private static let pickerInk = Color(hex: 0x2456A8)

    /// FINISH_SPEC §C3: the Stats game picker IS the Leaderboard picker — the shared
    /// `GamePickerCard` (every game visible, WORDOCIOUS row + the Sweep tile, PUZZLES
    /// row; today's W / L on each tile). BJ1: no Today | All-time toggle — the page below
    /// always shows both, as section banners.
    private var gamePicker: some View {
        GamePickerCard(selection: sel.game ?? "", accent: Self.pickerAccent, ink: Self.pickerInk,
                       results: todayResults,
                       sweepResult: completions.allDone ? true : nil,
                       onSelect: { select($0) }) {
            // FINISH_SPEC BB1: the selected game's own title art as the header
            // (LiveHeadline in its accent when there's no art); pops on change.
            pickerHeadline
                .id(sel.game ?? "overview")
                .frame(maxWidth: .infinity)
        }
    }

    /// BB1/BB2: the selected game's accent (the page blue on Today / All-time).
    private var pickerHeadAccent: Color {
        if sel.game == GamePicker.sweep { return GamePicker.sweepAccent }
        return selectedMeta?.accent ?? Self.pickerAccent
    }

    /// BB1: the header — a game's title art (~48 pt), else the live lettering.
    @ViewBuilder private var pickerHeadline: some View {
        if let g = ModeGen.byDbKey(selected), ArtAsset.exists("art-game-\(g.id)") {
            // Any game with its lettering art (word games and Puzzles alike).
            GameTitleArtView(asset: "art-game-\(g.id)", label: g.shareLabel, maxHeight: 48, minHeight: 40)
                .padding(.horizontal, 8)
        } else if sel.game == nil || sel.game == GamePicker.sweep {
            // BJ16: OVERVIEW / DAILY SWEEP lettering, not live text.
            HeadingArtView(sel.game == nil ? .overview : .sweep, height: 40, maxWidth: 280, motion: false)
        } else {
            LiveHeadline(text: pickerTitle.uppercased(),
                         palette: sel.game == nil ? .stats : .accent(pickerHeadAccent),
                         size: 24, maxLines: 1, minimumScale: 0.6)
        }
    }

    // MARK: Player card

    /// The player card (founder, 2026-09-26: "the top looks unfinished with the
    /// random buttons"): ONE card. Avatar · name + PRO · "Playing since" · the
    /// featured / favorite chips + bio on the first row, with Edit and Share as
    /// quiet 32 pt icon circles top-right (the header's ? and ⚙ idiom); the
    /// level pill + XP bar + "N XP to next" spanning the card; a footer row —
    /// social links · Private · Go Pro · the dev Pro pill — only when it applies.
    private func header(_ p: Profile) -> some View {
        let tier = levelTier(p.level)
        let progress = Double(p.xp % 1000) / 1000.0
        let toNext = 1000 - (p.xp % 1000)
        let hasSocial = socialLinks.values.contains { !$0.isEmpty }
        let showFooter = hasSocial || p.isPrivate == true || !auth.isProActive || auth.profile?.isAdmin == true
        let dark = Theme.isDark
        let levelInk = dark ? Theme.textSecondary : Color(hex: 0x5B3C96)
        // FINISH_SPEC §C3: the player card is lavender with the purple → pink top bar,
        // the letter-tile avatar (a photo when set), name + "Playing since", the level
        // line and a gradient level bar.
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                // Founder 10-05 (door 1): your avatar IS the way in — a tap opens the Stage; the small
                // "Dress up" tag replaces the old pencil.
                Button { DressUp.shared.open() } label: {
                    AvatarView(url: p.avatarUrl, username: p.username, size: 56, accentHex: p.accentColor, emoji: p.avatarEmoji, pro: auth.isProActive,
                               living: true)
                        .overlay(alignment: .bottom) {
                            StageArt("art-dress-tag-dressup", height: 17).offset(y: 9)
                        }
                        .padding(.bottom, 6)
                }
                .buttonStyle(.squish)
                .accessibilityLabel("Dress up your mascot")
                .accessibilityHint("Opens Edit Profile")
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(p.username).font(Brand.font(20, .black))
                            .foregroundStyle(ProfileAccent.isCustom(p.accentColor) ? ProfileAccent.color(p.accentColor) : FinishInk.heading)
                            .lineLimit(1).minimumScaleFactor(0.7)
                        // §V3 / §AA4: Pro members wear the level-pro mark (no PRO pill).
                        if auth.isProActive { ProMark(size: 22) }
                    }
                    if let since = memberSince(p) {
                        Text("Playing since \(since)").font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                // §A3: bare icon controls (no bubbles) that squish.
                HStack(spacing: 0) {
                    Button { Haptics.tap(); shareProfile(p) } label: {
                        Icon3D(.share, size: 23).frame(width: 40, height: 44).contentShape(Rectangle())
                    }
                    .buttonStyle(.squishIcon)
                    .accessibilityLabel("Share profile card")
                }
                .softSheet(isPresented: $showEditProfile) { EditProfileView() }
            }
            // Featured title, favorite game and bio (whatever the player set).
            ProfilePersonalizationRow(profile: p, leading: true)
            // The level line + the gradient level bar (#a855f7 → #ec4899 on a 14% purple track).
            VStack(spacing: 6) {
                HStack {
                    // §V3: the tier badge + the level in soft numbers.
                    LevelBadge(level: p.level, size: 30, showTier: true)
                    Spacer()
                    Text("\(p.xp % 1000) / 1,000 XP").font(Brand.font(12, .black)).foregroundStyle(levelInk)
                        .monospacedDigit()
                }
                .lineLimit(1).minimumScaleFactor(0.8)
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(FinishInk.purple.opacity(dark ? 0.25 : 0.14))
                        Capsule().fill(LinearGradient(colors: [Color(hex: 0xA855F7), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(10, g.size.width * progress))
                    }
                }
                .frame(height: 10)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Level \(p.level), \(tier.label). \(toNext) XP to next level.")
            // Footer row — only when something applies.
            if showFooter {
                HStack(spacing: 8) {
                    socialLinkButtons()
                    // PRIVATE PROFILES: the owner's always-on reminder that others
                    // see only the teaser card. Tap opens the edit surface (where
                    // the toggle lives).
                    if p.isPrivate == true {
                        Button { DressUp.shared.open() } label: {
                            Label("Private", systemImage: "lock.fill").font(Brand.font(10, .heavy))
                                .foregroundStyle(dark ? Theme.textSecondary : Color(hex: 0x6D28D9))
                                .padding(.horizontal, 10).padding(.top, 7).padding(.bottom, 5)
                                .tintedPill(FinishInk.purple)
                        }
                        .buttonStyle(.squish)
                        .accessibilityHint("Your profile is private — other players see a limited card. Tap to change.")
                    }
                    Spacer(minLength: 0)
                    if !auth.isProActive {
                        // §A8: the Pro upsell is an amber candy button.
                        Button { Haptics.tap(); showPro = true } label: {
                            CandyLabel(title: "Go Pro") { Icon3D(.crown, size: 16) }
                        }
                        .buttonStyle(CandyButtonStyle(variant: .amber, size: .small, fullWidth: false))
                        .softSheet(isPresented: $showPro) { ProView() }
                    }
                    // DEV-ONLY (profiles.is_admin): the Simulate Pro toggle as a
                    // quiet gray dashed tool pill with a status dot — flips is_pro
                    // so free-vs-Pro gating can be exercised in testing. Renders
                    // ONLY for the developer's account (mirrors the web gate).
                    if auth.profile?.isAdmin == true {
                        let isPro = auth.isProActive
                        Button { Haptics.tap(); Task { await auth.setSimulatePro(!isPro) } } label: {
                            HStack(spacing: 6) {
                                Circle().fill(isPro ? Theme.win : Color(hex: 0x9CA3AF)).frame(width: 6, height: 6)
                                Text("DEV · PRO \(isPro ? "ON" : "OFF")").font(Brand.font(10, .black)).tracking(0.6)
                            }
                            .foregroundStyle(FinishInk.secondary)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Capsule().fill(dark ? Theme.surfaceHover : FinishInk.purple.wash(0.10)))
                            .overlay(Capsule().stroke(FinishInk.purple.opacity(0.3), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])))
                        }
                        .buttonStyle(.squish)
                        .accessibilityLabel("Developer: toggle Pro on this account")
                    }
                }
                .padding(.top, 10)
                .overlay(alignment: .top) { Rectangle().fill(FinishInk.purple.opacity(0.12)).frame(height: 1) }
            }
        }
        .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 14)
        .tintedCard(accent: FinishInk.purple, bar: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)])
    }

    /// The existing profile share card (ShareService.shareProfile).
    private func shareProfile(_ p: Profile) {
        ShareEvents.log(kind: "image", gameMode: "", surface: "profile")
        let total = p.totalWins + p.totalLosses
        ShareService.shareProfile(ProfileShareInput(
            username: p.username, level: p.level, tier: levelTier(p.level).label,
            accentHex: ProfileAccent.hex(p.accentColor),
            totalWins: p.totalWins,
            winRate: total > 0 ? Int((Double(p.totalWins) / Double(total) * 100).rounded()) : 0,
            currentStreak: p.currentStreak, dailyStreak: p.dailyLoginStreak,
            gold: p.goldMedals, silver: p.silverMedals, bronze: p.bronzeMedals,
            achievementsUnlocked: unlockedAchievements.count, achievementsTotal: achievementCatalog.all.count))
    }

    private let socialOrder = ["twitter", "instagram", "tiktok", "threads", "discord", "website"]

    /// The social-link circles — the leading items of the action row.
    @ViewBuilder
    private func socialLinkButtons() -> some View {
        let links = socialLinks.filter { !$0.value.isEmpty }
        ForEach(socialOrder.filter { links[$0] != nil }, id: \.self) { key in
            if let handle = links[key], let url = socialURL(key, handle) {
                Link(destination: url) {
                    Image(systemName: key == "website" ? "globe" : (key == "discord" ? "message.fill" : "at"))
                        .font(.system(size: 14, weight: .black))
                }
                // §AB: icon-only — a spoken name; button family §1: the helper circle (no outlined ring).
                .buttonStyle(HelperButtonStyle(fallback: Color(hex: 0x7C3AED), circle: true))
                .accessibilityLabel(key == "website" ? "Website" : key.capitalized)
            }
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

    private func levelTier(_ lvl: Int) -> (label: String, bg: Color, border: Color, color: Color) {
        if lvl >= 100 { return ("Diamond", Color(hex: 0xEFF6FF), Color(hex: 0xBFDBFE), Color(hex: 0x1D4ED8)) }
        if lvl >= 51 { return ("Platinum", Color(hex: 0xF5F3FF), Color(hex: 0xC4B5FD), Color(hex: 0x6D28D9)) }
        if lvl >= 26 { return ("Gold", Color(hex: 0xFEF9EC), Color(hex: 0xFDE68A), Color(hex: 0x92400E)) }
        if lvl >= 11 { return ("Silver", Color(hex: 0xF3F4F6), Color(hex: 0xD1D5DB), Color(hex: 0x374151)) }
        return ("Bronze", Color(hex: 0xFEF2E8), Color(hex: 0xFED7AA), Color(hex: 0x9A3412))
    }

    private func memberSince(_ p: Profile) -> String? {
        guard let c = p.createdAt, let d = parseTimestamp(c) else { return nil }
        let f = DateFormatter(); f.dateFormat = "MMM yyyy"; f.locale = Locale(identifier: "en_US")
        return f.string(from: d)
    }

    // (Today's Dailies moved into TodayCard — D2. Global summary + "This Week"
    // recap merged into SnapshotHero — restat R1.)

    // MARK: Daily Medals (ports the web profile medals section)

    /// The signed-in user's own recent matches (solo + VS), mirroring the web
    /// profile's Recent Matches list and the public-profile view — the full
    /// list with View all / Show less (RecentMatchesList; Today shows the same
    /// rows capped at five). Shares RecentMatchRow with the public profile.
    @ViewBuilder private func recentMatchesSection(_ p: Profile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Recent Matches", accent: Color(hex: 0x2563EB))
            RecentMatchesList(matches: recentMatches, profileId: p.id, opponentNames: opponentNames,
                              loading: recentLoading, limit: 5,
                              emptyText: Mascots.statsEmptyLine, emptyHost: Mascots.stats, emptyScene: .noStats)
        }
    }

    private func medalsSection(_ p: Profile) -> some View {
        // Sits under the shared "PROGRESSION" banner (web parity): the card
        // carries its own small "Daily Medals" title instead of a section header.
        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 12) {
                FinishLabel("Daily medals", color: Color(hex: 0xA2560C))
                HStack(spacing: 12) {
                    medalCount("gold", "crown.fill", p.goldMedals, "Gold", Color(hex: 0xD97706))
                    medalCount("silver", "medal.fill", p.silverMedals, "Silver", Color(hex: 0x94A3B8))
                    medalCount("bronze", "medal.fill", p.bronzeMedals, "Bronze", Color(hex: 0xB45309))
                }
                if !medals.isEmpty {
                    if showAllMedals {
                        ScrollView { VStack(spacing: 6) { ForEach(medals) { m in medalRow(m) } } }.frame(maxHeight: 320)
                    } else {
                        VStack(spacing: 6) { ForEach(Array(medals.prefix(5))) { m in medalRow(m) } }
                    }
                    if medals.count > 5 {
                        // §A8: a small candy action, not a text link.
                        Button { showAllMedals.toggle() } label: {
                            CandyLabel(title: showAllMedals ? "Show less" : "View all \(medals.count) medals",
                                       symbol: showAllMedals ? "chevron.up" : "chevron.down")
                        }
                        .buttonStyle(CandyButtonStyle(variant: showAllMedals ? .peach : .purple, size: .small, fullWidth: false))
                        .frame(maxWidth: .infinity).padding(.top, 4)
                    }
                } else {
                    // Web parity: empty-state copy instead of a bare grid.
                    Text("Play daily challenges to earn medals!")
                        .font(Brand.font(12, .bold)).foregroundStyle(FinishInk.secondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                }
            }
            .padding(12).frame(maxWidth: .infinity)
            .tintedCard(accent: Color(hex: 0xF5A524), bar: [Color(hex: 0xF5A524), Color(hex: 0xFFD166)], radius: 18, barHeight: 8)
        }
    }

    private func medalCount(_ kind: String, _ icon: String, _ count: Int, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            MedalArt(kind: kind, size: 30, fallbackSymbol: icon, fallbackColor: color)
            Text("\(count)").softNumber(20)
            Text(label.uppercased()).font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(FinishInk.secondary)
        }
        .frame(maxWidth: .infinity).padding(.top, 12).padding(.bottom, 8)
        .tintedPill(color, radius: 12)
        .accessibilityElement(children: .combine)
    }

    private func medalRow(_ m: MedalRow) -> some View {
        let icon: String, color: Color, label: String
        switch m.medalType {
        case "gold":      (icon, color) = ("crown.fill", Color(hex: 0xD97706))
        case "silver":    (icon, color) = ("medal.fill", Theme.textMuted)
        case "bronze":    (icon, color) = ("medal.fill", Color(hex: 0xB45309))
        case "streak_7":  (icon, color) = ("flame.fill", Color(hex: 0xEA580C))
        case "streak_30": (icon, color) = ("flame.fill", Color(hex: 0xDC2626))
        case "streak_100":(icon, color) = ("flame.fill", Color(hex: 0x7C3AED))
        case "perfect":   (icon, color) = ("star.fill", Color(hex: 0x7C3AED))
        default:          (icon, color) = ("medal.fill", Theme.textMuted)
        }
        switch m.medalType {
        case "streak_7": label = "7-Day Streak"
        case "streak_30": label = "30-Day Streak"
        case "streak_100": label = "100-Day Streak"
        case "perfect": label = "Perfect!"
        default: label = m.gameMode.flatMap { GameMode(rawValue: $0).map { ModeStyle.title($0) } } ?? (m.gameMode ?? "")
        }
        // Gold / silver / bronze (and any other medal) draw the glossy medal art;
        // streak and perfect medals keep their flame / star.
        let art: String? = ["gold", "silver", "bronze"].contains(m.medalType) ? m.medalType
            : (["streak_7", "streak_30", "streak_100", "perfect"].contains(m.medalType) ? nil : "trophy")
        return HStack(spacing: 10) {
            if let art {
                MedalArt(kind: art, size: 20, fallbackSymbol: icon, fallbackColor: color)
            } else {
                SymbolGlyph(icon, size: 14, color: color)
            }
            Text(label).font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.heading)
            Spacer()
            Text(shortMedalDate(m.day)).font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
        }
        .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(StatsInk.rowFill(Color(hex: 0xF5A524))))
    }

    private func shortMedalDate(_ day: String) -> String {
        let inF = DateFormatter(); inF.dateFormat = "yyyy-MM-dd"
        guard let d = inF.date(from: day) else { return day }
        let outF = DateFormatter(); outF.dateFormat = "MMM d"
        return outF.string(from: d)
    }

    // MARK: Per-mode stats (8 stats)

    // MARK: Achievements (collapsible grid)

    private let achCategories: [(key: String, label: String, color: UInt)] = [
        ("beginner", "Getting Started", 0x7C3AED), ("consistency", "Consistency", 0xF97316),
        ("skill", "Skill", 0x2563EB), ("social", "Social", 0x0D9488), ("collection", "Collection", 0xD97706),
    ]

    private var extraAchCategories: [(key: String, label: String, color: UInt)] {
        let known = Set(achCategories.map(\.key))
        var seen = Set<String>()
        return achievementCatalog.all.map(\.category).filter { !known.contains($0) && seen.insert($0).inserted }
            .map { (key: $0, label: $0.replacingOccurrences(of: "_", with: " ").capitalized, color: 0x7C3AED) }
    }

    /// BJ1: the achievements grid as lazy rows — the header, then per category its label
    /// and its badge rows (3 a row), each row its own lazy element, so only the rows on
    /// screen are built (the eager grid built all ~120 badges at once). The locked badges'
    /// progress is computed ONCE per pass (it used to rebuild the whole table per badge).
    @ViewBuilder private var achievementsSection: some View {
        let progress = achievementProgressMap()
        HStack {
            // Under the shared "PROGRESSION" banner (web parity): a plain
            // card-style title rather than an all-caps section header.
            FinishLabel("Achievements")
            Spacer()
            Text("\(unlockedAchievements.count) / \(achievementCatalog.all.count)").softNumber(14)
        }
        // FINISH_SPEC BE: any category the catalog adds beyond the five known ones
        // still shows (its own group, purple) — new achievements never vanish.
        ForEach(achCategories + extraAchCategories, id: \.key) { cat in
            let items = achievementCatalog.all.filter { $0.category == cat.key }
            if !items.isEmpty {
                let n = items.filter { unlockedAchievements.contains($0.key) }.count
                let color = Color(hex: cat.color)
                LazyVStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text(cat.label.uppercased()).font(Brand.font(11, .black)).tracking(0.4).foregroundStyle(color)
                        Text("\(n)/\(items.count)").font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
                    }
                    ForEach(Array(stride(from: 0, to: items.count, by: 3)), id: \.self) { i in
                        HStack(alignment: .top, spacing: 8) {
                            ForEach(i..<min(i + 3, items.count), id: \.self) { j in
                                achievementCell(items[j], color: color, progress: progress[items[j].key])
                            }
                            ForEach(0..<(3 - min(3, items.count - i)), id: \.self) { _ in
                                Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
                            }
                        }
                    }
                }
            }
        }
    }

    /// §V1: the badge art instead of the ✓ / ? text tile — unlocked = full color +
    /// glow + name + date; locked = grayscale, 45%, the 3D lock, name + progress.
    private func achievementCell(_ a: AchievementDef, color: Color, progress: (c: Int, t: Int)?) -> some View {
        let on = unlockedAchievements.contains(a.key)
        return Button { Haptics.tap(); achievementDetail = a } label: {
            AchievementBadgeCell(def: a, unlocked: on, unlockedAt: achievementDates[a.key],
                                 progress: on ? nil : progress, accent: color)
        }
        .buttonStyle(.squish)
    }

    /// Progress toward each locked achievement from the data this page already holds
    /// (the profile row + user_stats); a missing key = no known progress (no bar).
    /// BJ1: built once per pass (was rebuilt for every badge).
    private func achievementProgressMap() -> [String: (c: Int, t: Int)] {
        guard let p = auth.profile else { return [:] }
        let medalsTotal = p.goldMedals + p.silverMedals + p.bronzeMedals
        let soloWins: (String) -> Int = { m in statRows.filter { $0.gameMode == m && $0.playType == "solo" }.reduce(0) { $0 + $1.wins } }
        let played = statRows.reduce(0) { $0 + $1.totalGames }
        let vsRows = statRows.filter { $0.playType == "vs" }
        let vsPlayed = vsRows.reduce(0) { $0 + $1.totalGames }, vsWins = vsRows.reduce(0) { $0 + $1.wins }
        var map: [String: (Int, Int)] = [
            "streak_7": (p.dailyLoginStreak, 7), "streak_14": (p.dailyLoginStreak, 14),
            "streak_30": (p.dailyLoginStreak, 30), "streak_master": (p.dailyLoginStreak, 50),
            "year_one": (p.dailyLoginStreak, 365),
            "medal_10": (medalsTotal, 10), "medal_50": (medalsTotal, 50), "medal_wall": (medalsTotal, 100),
            "golden_touch": (p.goldMedals, 10), "gold_rush": (p.goldMedals, 50), "diamond_hands": (p.goldMedals, 100),
            "century_club": (p.totalWins, 100), "wordsmith": (p.totalWins, 500), "thousand_words": (p.totalWins, 1000),
            "rising_star": (p.level, 10), "elite": (p.level, 50),
            "unstoppable": (p.currentStreak, 5), "unbreakable": (max(p.currentStreak, p.bestStreak), 25),
        ]
        if !statRows.isEmpty {
            map["dedicated"] = (played, 500); map["endurance"] = (played, 1000); map["obsessed"] = (played, 2000)
            map["rival"] = (vsPlayed, 50); map["vs_marathoner"] = (vsPlayed, 100)
            map["dominant"] = (vsWins, 50); map["vs_centurion"] = (vsWins, 100)
            // The per-game mastery ladder (AchievementService's thresholds).
            let mastery: [(String, String, Int)] = [
                ("quad_king", "QUORDLE", 50), ("octo_boss", "OCTORDLE", 50), ("sequence_ace", "SEQUENCE", 50),
                ("rescue_hero", "RESCUE", 50), ("six_shooter", "DUEL_6", 50), ("lucky_seven", "DUEL_7", 50),
                ("proper_scholar", "PROPERNOUNDLE", 50), ("classic_master", "DUEL", 100), ("sudoku_scholar", "SUDOKU", 50),
                ("regions_regular", "REGIONS", 50), ("ladder_regular", "LADDER", 50), ("wordsearch_regular", "WORDSEARCH", 50),
                ("hub_regular", "HUB", 50), ("cryptogram_regular", "CRYPTOGRAM", 50), ("groups_regular", "GROUPS", 50),
                ("crossword_regular", "CROSSWORD", 50), ("scramble_regular", "SCRAMBLE", 50),
            ]
            for (k, mode, t) in mastery { map[k] = (soloWins(mode), t) }
        }
        var out: [String: (c: Int, t: Int)] = [:]
        for (k, m) in map where m.0 < m.1 { out[k] = (max(0, m.0), m.1) }
        return out
    }

    // MARK: Solo/VS toggle + VS RECORD card (ports profile/page.tsx section D)

    /// user_stats rows scoped to a play type.
    private func stats(for tab: String) -> [UserStatRow] { statRows.filter { $0.playType == tab } }

    /// Solo | VS toggle on a game page — only where the game has a live VS
    /// board (word engines + ProperNoundle). The old page-level Solo/VS/VS-CPU
    /// toggle is gone; All-time's VS section's People | Bots pair covers bot games.
    private func soloVsToggle(accent: Color) -> some View {
        // Instant, like the picker (founder, 2026-09-29) — the page re-keys on activeTab.
        // §A9: the soft segmented toggle (each option squishes).
        HStack {
            SoftSegmented(options: [(key: "solo", label: "Solo"), (key: "vs", label: "VS")],
                          selection: Binding(get: { gamePageTab }, set: { setActiveTab($0) }),
                          accent: accent, accessibilityLabel: "Solo or VS")
            Spacer()
        }
    }

    /// "VS RECORD" summary card (All-time VS section): aggregate W–L, win rate, total.
    /// The record against bots — its own dashed box in All-time's VS section, clearly
    /// unranked. Best streak comes from the client-side progression store (the same
    /// one the VS banner's flame reads).
    @ViewBuilder private var cpuRecordCard: some View {
        let rec = UserStatsService.cpuRecord(statRows)
        let bestStreak = CpuProgressionStore.load().bestStreak
        // Always shown in the VS section (even at 0–0) so the practice record is
        // discoverable before your first bot match; it fills in once you play one.
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0x64748B).opacity(0.10)).frame(width: 40, height: 40)
                BotArtCircle(art: BotPersonas.art("lexi"), size: 32, background: .clear)
            }
            VStack(alignment: .leading, spacing: 1) {
                FinishLabel("VS Bots", color: Color(hex: 0x475569))
                Text("\(rec.wins)–\(rec.losses)").softNumber(22)
                if rec.total == 0 {
                    Text("Beat a bot to start your record").font(Brand.font(10, .heavy)).foregroundStyle(FinishInk.secondary)
                } else if bestStreak > 0 {
                    HStack(spacing: 3) {
                        Icon3D(.flame, size: 13)
                        Text("Best streak: \(bestStreak)").font(Brand.font(10, .heavy)).foregroundStyle(Color(hex: 0xF97316))
                    }
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(rec.total == 0 ? "—" : "\(rec.winRate)%").softNumber(22)
                Text(rec.total == 0 ? "NO GAMES YET" : "WIN RATE · \(rec.total) \(rec.total == 1 ? "MATCH" : "MATCHES")")
                    .font(Brand.font(9, .heavy)).tracking(0.4).foregroundStyle(FinishInk.secondary)
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        // §A1: a slate wash (clearly unranked: the dashed border stays).
        .background(RoundedRectangle(cornerRadius: 18).fill(Theme.isDark ? Theme.surface : Color(hex: 0x64748B).wash(0.09)).pageCardShadow())
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.isDark ? Theme.border : Color(hex: 0x64748B).wash(0.40), style: StrokeStyle(lineWidth: 1.5, dash: [5])))
    }

    private var vsRecordCard: some View {
        let rec = UserStatsService.vsRecord(statRows)
        return HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(Theme.primary.opacity(0.08))
                    .frame(width: 40, height: 40)
                Image("swords").renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 20, height: 20).foregroundStyle(Theme.primary)
            }
            VStack(alignment: .leading, spacing: 1) {
                FinishLabel("VS record", color: Color(hex: 0x6D28D9))
                Text("\(rec.wins)–\(rec.losses)").softNumber(22)
                // D2: today's daily VS outcome (DailyResultsService.dailyVSResult).
                Text("Today: \(vsDailyWon == nil ? "not played" : (vsDailyWon! ? "won" : "lost"))")
                    .font(Brand.font(10, .heavy))
                    .foregroundStyle(vsDailyWon == nil ? FinishInk.secondary : (vsDailyWon! ? Theme.win : Color(hex: 0xDC2626)))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(rec.winRate)%").softNumber(22)
                Text("WIN RATE · \(rec.total) \(rec.total == 1 ? "MATCH" : "MATCHES")")
                    .font(Brand.font(9, .heavy)).tracking(0.4).foregroundStyle(FinishInk.secondary)
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .tintedCard(accent: Color(hex: 0x7C3AED), bar: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], radius: 18, barHeight: 8)
    }

    /// Mode-detail header — ports the mode-detail-panel.tsx header row: mode
    /// icon tile + title in the mode accent, and a read-only play-type chip that
    /// reflects the page's scope (a game page's Solo | VS toggle, or the VS
    /// page's People | Bots pair — the panel has no toggle of its own).
    private func modeDetailHeader(_ mode: GameMode, tab: String) -> some View {
        let m = dailyModes.first { $0.dbKey == mode.rawValue }
        let accent = ModeStyle.accent(mode)
        return HStack {
            HStack(spacing: 8) {
                if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                Text(m?.title ?? ModeStyle.title(mode)).font(Brand.font(15, .black))
                    .foregroundStyle(Theme.isDark ? Theme.textPrimary : accent.mixed(over: .black, 0.8))
            }
            Spacer()
            HStack(spacing: 4) {
                if tab == "solo" {
                    Image(systemName: "person.fill").font(.system(size: 10, weight: .bold))
                } else if tab == "vs" {
                    Image("swords").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 12, height: 12)
                } else {
                    BotArtCircle(art: BotPersonas.art("lexi"), size: 14, background: .clear)
                }
                Text(tab == "solo" ? "Solo" : tab == "vs" ? "VS" : "VS Bots")
                    .font(Brand.font(10, .heavy))
            }
            .foregroundStyle(Theme.isDark ? Theme.textSecondary : accent.mixed(over: .black, 0.8))
            .padding(.horizontal, 10).padding(.top, 8).padding(.bottom, 5)
            .tintedPill(accent, radius: 10)
        }
    }

    private func modeStats(_ p: Profile, mode: GameMode, tab: String) -> some View {
        let s = UserStatsService.aggregate(stats(for: tab), mode: mode.rawValue)
        // The eight cells come from the shared per-mode stats registry (ModeStats,
        // More Games §18) — same lines, same fixtures as web and Android.
        let meta = ModeGen.byDbKey(mode.rawValue)
        let cellsKey = modeCellsKey(mode, tab)
        let known = modeCells[cellsKey] ?? StatsMemo.shared.get(cellsKey)
        let streak: (current: Int, best: Int) = known?.streak ?? (0, 0)
        // WordociousCore.ModeStats — the app has its own `ModeStats` aggregate struct in UserStatsService.
        let cells: [(String, String)] = WordociousCore.ModeStats.statLines(
            dbKey: mode.rawValue,
            totals: StatTotals(wins: s.wins, losses: s.losses, totalGames: s.totalGames, bestScore: s.bestScore,
                               fastestTime: s.fastestTime, streak: streak.current, bestStreak: streak.best),
            semantics: meta?.guessSemantics ?? "guesses", guessBase: meta?.guessBase ?? 1,
            aggregates: known?.aggregates ?? .empty
        ).map { ($0.label, $0.value) }
        return EagerGrid(items: cells, columns: 4, rowSpacing: 12) { c in
            VStack(spacing: 2) {
                // §A2: every big number is a soft number.
                Text(c.1).softNumber(18).lineLimit(1).minimumScaleFactor(0.6)
                Text(c.0.uppercased()).font(Brand.font(9, .black)).tracking(0.4).foregroundStyle(FinishInk.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(16)
        .statsCard(accent: ModeStyle.accent(mode))
        // Fetch the per-mode win streak AND the mode's matches aggregate from
        // match history whenever the selected mode OR the play-type toggle
        // changes (web mode-detail-panel parity — restat B1 scopes both to the
        // toggle). Keyed per mode+tab, so a previous mode's value can never
        // show here — and this mode's last value shows at once.
        .task(id: cellsKey) {
            if let uid = auth.profile?.id {
                async let streakF = MatchStatsService.modeWinStreak(uid: uid, mode: mode, playType: tab)
                async let rows = MatchStatsService.modeMatches(uid: uid, mode: mode, playType: tab)
                let fresh = ModeCells(streak: await streakF,
                                      aggregates: WordociousCore.ModeStats.modeAggregates(mode.rawValue, await rows, guessBase: meta?.guessBase ?? 1))
                guard !Task.isCancelled else { return }
                modeCells[cellsKey] = fresh
                StatsMemo.shared.set(cellsKey, fresh)
            }
        }
    }

    private func fmtTime(_ s: Int) -> String {
        s <= 0 ? "-" : (s < 60 ? "\(s)s" : (s % 60 > 0 ? "\(s/60)m \(s%60)s" : "\(s/60)m"))
    }
}
