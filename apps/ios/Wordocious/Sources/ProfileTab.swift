import SwiftUI
import WordociousCore

/// STATS (Stats + Friends redesign D2, founder 2026-09-26: "option 2" — Profile
/// and Records merge into one Stats tab that "flows like butter"). Port of
/// app/stats/page.tsx:
///   player card → StatsRail → ONE page below it, chosen from the rail:
///   Today (landing, TodayCard + the five newest games) · a game page per
///   daily mode (Solo | VS toggle where a live VS board exists, today's line,
///   the §18 registry stats) · All-time (snapshot hero, Your Records, every
///   chart, Signature, Standing trend, Progression, VS — record + rivalries +
///   CPU + a word-game board — then Recent Matches).
/// A horizontal swipe on the page moves one rail chip; hold Today (or the grid
/// button) for every game at once. Zero new fetches beyond the old page except
/// today's VS result, the sweep streak and today's standing.
struct ProfileTab: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var completions = DailyCompletionsStore()
    @State private var showAuth = false
    @State private var showPro = false
    @State private var statRows: [UserStatRow] = []
    /// Which page the rail shows: StatsRailKey.today | .all | a mode dbKey (.vs maps to .all).
    @State private var selected: String = StatsRailKey.today
    /// Bumped by select(.vs): content() scrolls All-time to its VS section.
    @State private var vsScrollToken = 0
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
    /// All-time's VS section Live | CPU ("vs" | "vs_cpu") — its OWN state, never activeTab
    /// (founder, 2026-10-01): picking CPU there must not rebuild the All-time page, re-scope
    /// its charts or show the CPU note up top. Web `vsTab`.
    @State private var vsSectionTab = "vs"
    @State private var unlockedAchievements: Set<String> = []
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
    private var railItems: [StatsRailItem] {
        buildStatsRailItems(sweep: dailyTiles, more: visibleMore, byMode: completions.byMode)
    }
    /// Word-engine games and ProperNoundle have live VS boards; the More Games titles do not.
    private func hasVs(_ dbKey: String) -> Bool {
        guard let meta = ModeGen.byDbKey(dbKey) else { return false }
        return meta.engine == "word" || dbKey == "PROPERNOUNDLE"
    }
    /// All-time's VS board picker: the sweep word games (web `vsModes`).
    private var vsModes: [HomeMode] { dailyTiles.filter { hasVs($0.dbKey ?? "") } }
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
            withTransaction(t) { selected = StatsRailKey.all }
            vsScrollToken += 1
            return
        }
        withTransaction(t) {
            selected = key
            if key != StatsRailKey.all && key != StatsRailKey.today && !hasVs(key) {
                activeTab = "solo"
            }
        }
    }

    /// Solo | VS and Live | CPU — the same un-animated swap as the rail.
    private func setActiveTab(_ t: String) {
        var tx = Transaction(); tx.disablesAnimations = true
        withTransaction(tx) { activeTab = t }
    }

    /// All-time's VS Live | CPU — the same un-animated swap, scoped to the VS section only.
    private func setVsSectionTab(_ t: String) {
        var tx = Transaction(); tx.disablesAnimations = true
        withTransaction(tx) { vsSectionTab = t }
    }

    /// Swipe on the page moves one chip along the rail (founder: no 19-page
    /// swipe — but a swipe between neighbors is the natural gesture).
    private func step(_ delta: Int) {
        let items = railItems
        guard let i = items.firstIndex(where: { $0.key == selected }) else { return }
        let j = i + delta
        guard items.indices.contains(j) else { return }
        Haptics.tap()
        select(items[j].key)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                VStack(spacing: 0) {
                    AppHeaderView()   // shared header (settings now lives here)
                    // §241: during the launch-restore window a returning
                    // player must never see the signed-out pitch — the cached
                    // profile usually fills this gap; a brief spinner covers a
                    // cacheless upgrade launch.
                    if let profile = auth.profile {
                        content(profile)
                    } else if auth.isLoading && AuthService.hadPersistedSession {
                        ProgressView().frame(maxWidth: .infinity, minHeight: 240)
                    } else {
                        signedOut
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .fullScreenCover(item: $badgeGame) { g in
                NavigationStack {
                    if let id = CustomDailyView.customId(for: g.mode) { CustomDailyView(id: id) }
                    else { GameScreen(seed: DailySeed.today(mode: g.mode), mode: g.mode, title: g.title) }
                }
            }
            .fullScreenCover(item: $badgeSolved) { g in
                NavigationStack {
                    if let id = CustomDailyView.customId(for: g.mode) { CustomDailyView(id: id) }
                    else { SolvedPuzzleView(mode: g.mode, title: g.title) }
                }
            }
            .fullScreenCover(isPresented: $badgePN) {
                NavigationStack { ProperNoundleView() }
            }
            // Own-engine More Games dailies (nil seed = today's; each view
            // restores its finished board when already played) — the same
            // switch RootTabView's Next Daily hand-off and Home use.
            .fullScreenCover(item: $badgeMore) { m in
                NavigationStack { CustomDailyView(id: m.id) }
            }
            .onDailyRecorded { reloadToken += 1 }
            .onAppear { if let uid = auth.profile?.id { seedFromMemo(uid) }; refreshToday() }   // refresh: the day may have rolled over
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
                    async let achievementsF = AchievementService.fetchUnlocked(userId: uid)
                    async let medalsF = MedalsService.recent(userId: uid, limit: 120)
                    async let weekF = MatchStatsService.activityCalendar(days: 7)
                    async let socialF = ProfileExtras.socialLinks(userId: uid)
                    async let matchesF = PublicProfileService.recentMatches(id: uid)
                    // D2 step 3: the all-time record table + sweep ranks; the
                    // chases fold the user_stats rows in once they land.
                    async let yoursF = YourRecordsData.fetch(userId: uid)
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
                    guard !Task.isCancelled else { return }
                    var t = Transaction(); t.disablesAnimations = true
                    withTransaction(t) {
                        statRows = fStats; unlockedAchievements = fAch; medals = fMedals; socialLinks = fSocial
                        opponentNames = fNames; setRecent(fMatches)
                        gamesThisWeek = fWeekTotal; sevenDayTotal = fSeven
                        vsDailyWon = fVs; sweepStats = fSweep; standing = fStanding; yours = fYours
                    }
                    // Store the fresh results back into the session memo.
                    memo.set("yourRecords:\(uid)", yours)
                    memo.set("sweepStats:\(uid)", sweepStats)
                    memo.set("vsDailyWon:\(uid)", vsDailyWon)
                    memo.set("standing:\(uid)", standing)
                    memo.set("statRows:\(uid)", statRows)
                    memo.set("achievements:\(uid)", unlockedAchievements)
                    memo.set("medals:\(uid)", medals)
                    memo.set("socialLinks:\(uid)", socialLinks)
                    memo.set("recentMatches:\(uid)", recentMatches)
                    memo.set("opponentNames:\(uid)", opponentNames)
                    memo.set("gamesThisWeek:\(uid)", gamesThisWeek)
                    memo.set("sevenDayTotal:\(uid)", sevenDayTotal)
                }
                _ = await (completionsLoad, catalogLoad)
            }
            // Banner inside the NavigationStack so the ScrollView insets for it
            // (the Sign-out button stays scrollable above the banner) and it
            // doesn't leak onto pushed detail views.
        }
    }

    /// Paint from the session memo in one pass (no animation). Cheap and synchronous,
    /// so onAppear can run it before the first frame.
    private func seedFromMemo(_ uid: String) {
        let memo = StatsMemo.shared
        var t = Transaction(); t.disablesAnimations = true
        withTransaction(t) {
            if let v: [UserStatRow] = memo.get("statRows:\(uid)") { statRows = v }
            if let v: Set<String> = memo.get("achievements:\(uid)") { unlockedAchievements = v }
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

    private var signedOut: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle").font(.system(size: 64)).foregroundStyle(Theme.textMuted)
            Text("Sign in to track your stats").font(Brand.headline()).foregroundStyle(Theme.textPrimary)
            Button("Sign in") { showAuth = true }.buttonStyle(.borderedProminent).tint(Theme.primary)
        }
        .sheet(isPresented: $showAuth) { AuthView() }
    }

    private func content(_ p: Profile) -> some View {
        // Web order (app/stats/page.tsx, D2): player card →
        // StatsRail → ONE page keyed on the selection (Today · a game page ·
        // All-time). The page swaps instantly (select()); a horizontal
        // swipe on it moves one chip along the rail.
        ScrollViewReader { proxy in
        ScrollView {
            VStack(spacing: 16) {
                header(p)
                StatsRail(items: railItems, selected: $selected, onSelect: select)
                Group {
                    if selected == StatsRailKey.today {
                        todayPage
                    } else if selected == StatsRailKey.all {
                        allTimePage(p)
                    } else if let m = selectedMeta, let gm = GameMode(rawValue: selected) {
                        gamePage(p, meta: m, mode: gm)
                    } else {
                        todayPage
                    }
                }
                .id("page-\(selected)-\(activeTab)")
                .simultaneousGesture(
                    DragGesture(minimumDistance: 24).onEnded { v in
                        guard abs(v.translation.width) >= 70, abs(v.translation.height) <= 50 else { return }
                        step(v.translation.width < 0 ? 1 : -1)
                    }
                )
            }
            .padding(.horizontal, 12).padding(.top, 8)
            // Generous bottom clearance so the last section always sits above the
            // custom bottom nav and stays tappable (Account actions live in
            // Settings now, not here).
            .padding(.bottom, 72)
        }
        // select(.vs) swapped to All-time un-animated; once that page is laid out, glide
        // down to its VS section (web: scrollIntoView smooth, block start).
        .onChange(of: vsScrollToken) { _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.06) {
                withAnimation(Theme.animation(.easeOut(duration: 0.35))) { proxy.scrollTo(vsSectionId, anchor: .top) }
            }
        }
        }
    }

    // MARK: Pages

    /// Today — the landing page: the eight sweep tiles, the More Games / VS /
    /// Standing pills, the ten More Games chips, sweep streak + best moment,
    /// then the five newest games (founder, 2026-09-26: "the most recent games
    /// — daily AND unlimited — right on Today"; the full history stays on All-time).
    @ViewBuilder private var todayPage: some View {
        TodayCard(
            sweepModes: dailyTiles, visibleMore: visibleMore, byMode: completions.byMode,
            vsDailyWon: vsDailyWon, standing: standing,
            sweepStreak: sweepStats.currentSweepStreak, flawlessStreak: sweepStats.currentFlawlessStreak,
            onJump: { key in Haptics.tap(); select(key) },
            onOpenDaily: openDaily)
        if let p = auth.profile {
            // Founder, 2026-09-27: every game played TODAY, no cap, no "See all" link — the
            // full history lives on All-time. 2026-09-29: Unlimited solo games fold into one
            // row per game (Pro only); todayEntries is computed once per fetch, not per render.
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader("Today's Games", accent: Color(hex: 0x2563EB))
                TodayGamesList(entries: todayEntries, profileId: p.id, opponentNames: opponentNames,
                               loading: recentLoading && recentMatches.isEmpty,
                               emptyText: "No games yet today — play a daily to start the list.")
            }
        }
    }

    /// A game page: Solo | VS toggle (live boards only), today's line, then the
    /// EXISTING per-mode stats content (registry cells, dashboard, deep insights).
    @ViewBuilder private func gamePage(_ p: Profile, meta m: HomeMode, mode gm: GameMode) -> some View {
        let tab = gamePageTab
        if hasVs(gm.rawValue) { soloVsToggle(accent: m.accent) }
        todayLine(m)
        // Your records in this game (the old Records → You "bests by mode" card).
        if tab == "solo" {
            GameRecordsCard(dbKey: gm.rawValue,
                            my: statRows.first { $0.gameMode == gm.rawValue && $0.playType == "solo" },
                            recordsHeld: yours.recordsHeld, chases: yours.chases)
        }
        modeDetailHeader(gm, tab: tab)
        modeStats(p, mode: gm, tab: tab)
        ProfileDashboard(mode: gm, playType: tab)
        ProDeepModeCard(gameMode: gm.rawValue, isPro: auth.isProActive, accent: ModeStyle.accent(gm), playType: tab)
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
        return Button { openDaily(m) } label: {
            HStack(spacing: 12) {
                Text("TODAY").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(m.accent)
                Text(text).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
                    .lineLimit(1).minimumScaleFactor(0.8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(today == nil ? "Play →" : "Open →").font(Brand.font(11, .black)).foregroundStyle(m.accent)
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 14).fill(m.accent.opacity(0.06)))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(m.accent.opacity(0.33), lineWidth: 1.5))
        }
        .buttonStyle(PressableStyle())
    }

    /// All-time's VS section scroll anchor (select(.vs) lands here).
    private let vsSectionId = "vs-section"

    /// VS (founder, 2026-10-01: VS left the rail — rarely played, and the grid now comes out
    /// even; its page moved here, the bottom of All-time): the record (with today's result),
    /// Rivalries, the CPU practice card, then one word game's VS board: a picker + Live | CPU
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
                            Text(ModeGen.byId(m.id)?.shortTitle ?? m.title).font(Brand.font(10, .heavy))
                                .foregroundStyle(active ? m.accent : Theme.textMuted)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(RoundedRectangle(cornerRadius: 8).fill(active ? m.accent.opacity(0.08) : Theme.surface))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? m.accent : Theme.border, lineWidth: 1.5))
                        }.buttonStyle(PressableStyle())
                    }
                }
                .padding(.horizontal, 1)
            }
            HStack(spacing: 4) {
                ForEach(["vs", "vs_cpu"], id: \.self) { t in
                    let active = tab == t
                    Button { setVsSectionTab(t) } label: {
                        Text(t == "vs" ? "Live" : "CPU").font(Brand.font(10, .heavy))
                            .foregroundStyle(active ? Theme.primary : Theme.textMuted)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(RoundedRectangle(cornerRadius: 8).fill(active ? Theme.primary.opacity(0.08) : Theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? Theme.primary : Theme.border, lineWidth: 1.5))
                    }.buttonStyle(PressableStyle())
                }
            }
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
        // + the Live | CPU pick, so a toggle builds fresh cards too (the page id no longer carries it).
        .id("\(vsMode.rawValue)-\(tab)")
        // CPU practice writes aggregate totals only — per-game charts
        // have no data to draw from, so say so instead of blanks.
        if tab == "vs_cpu" {
            Text("CPU practice records totals only — per-game charts track Solo and VS matches.")
                .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
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
            .tint(Theme.primary).padding(14)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))

            Button { Task { await auth.signOut() } } label: {
                HStack(spacing: 12) {
                    Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 18)).foregroundStyle(Theme.textMuted)
                    Text("Sign Out").font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                    Spacer()
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            }.buttonStyle(.plain)

            Button(role: .destructive) { showDeleteConfirm = true } label: {
                HStack(spacing: 12) {
                    Image(systemName: "trash").font(.system(size: 18)).foregroundStyle(Color(hex: 0xDC2626))
                    Text("Delete Account").font(Brand.font(14, .heavy)).foregroundStyle(Color(hex: 0xDC2626))
                    Spacer()
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xFECACA), lineWidth: 1.5))
            }.buttonStyle(.plain).disabled(deleting)
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
        // Strongest mode by win rate among modes with ≥3 games (all play types,
        // matching the web which uses the unfiltered `stats`).
        let qualifying = statRows.filter { $0.totalGames >= 3 }
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
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                AvatarView(url: p.avatarUrl, username: p.username, size: 64, accentHex: p.accentColor, emoji: p.avatarEmoji)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        if ProfileAccent.isCustom(p.accentColor) {
                            Text(p.username).font(Brand.title(22)).foregroundStyle(ProfileAccent.color(p.accentColor))
                                .lineLimit(1).minimumScaleFactor(0.7)
                        } else {
                            Text(p.username).font(Brand.title(22))
                                .foregroundStyle(LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xEC4899), Color(hex: 0xA78BFA)], startPoint: .leading, endPoint: .trailing))
                                .lineLimit(1).minimumScaleFactor(0.7)
                        }
                        if auth.isProActive {
                            Text("PRO").font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(.white)
                                .padding(.horizontal, 8).padding(.vertical, 2)
                                .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                        }
                    }
                    if let since = memberSince(p) {
                        Text("Playing since \(since)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    ProfilePersonalizationRow(profile: p, leading: true).padding(.top, 3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                // Quiet icon actions — the same 32 pt circles as the header's ? and ⚙.
                HStack(spacing: 6) {
                    iconCircle("pencil", label: "Edit profile") { showEditProfile = true }
                    iconCircle("square.and.arrow.up", label: "Share profile card") { shareProfile(p) }
                }
                .sheet(isPresented: $showEditProfile) { EditProfileView() }
            }
            // Level row spans the card: pill · bar · XP to next.
            HStack(spacing: 10) {
                HStack(spacing: 4) {
                    Image(systemName: "star.fill").font(.system(size: 10))
                    Text("Lvl \(p.level)").font(Brand.font(11, .heavy))
                    Text("·").opacity(0.7)
                    Text(tier.label).font(Brand.font(11, .heavy))
                }
                .foregroundStyle(tier.color)
                .padding(.horizontal, 10).padding(.vertical, 3)
                .background(Capsule().fill(tier.bg)).overlay(Capsule().stroke(tier.border, lineWidth: 1.5))
                .fixedSize()
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.border)
                        Capsule().fill(LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xF97316)], startPoint: .leading, endPoint: .trailing))
                            .frame(width: g.size.width * progress)
                    }
                }
                .frame(height: 8)
                Text("\(toNext) XP to next").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    .lineLimit(1).fixedSize()
            }
            // Footer row — only when something applies.
            if showFooter {
                HStack(spacing: 8) {
                    socialLinkButtons()
                    // PRIVATE PROFILES: the owner's always-on reminder that others
                    // see only the teaser card. Tap opens the edit surface (where
                    // the toggle lives).
                    if p.isPrivate == true {
                        Button { showEditProfile = true } label: {
                            Label("Private", systemImage: "lock.fill").font(Brand.font(10, .heavy)).foregroundStyle(Color(hex: 0x7C3AED))
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(Capsule().fill(Color(hex: 0xF3F0FF)))
                                .overlay(Capsule().stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
                        }
                        .buttonStyle(PressableStyle())
                        .accessibilityHint("Your profile is private — other players see a limited card. Tap to change.")
                    }
                    Spacer(minLength: 0)
                    if !auth.isProActive {
                        Button { showPro = true } label: {
                            Text("Go Pro").font(Brand.font(12, .heavy)).foregroundStyle(.white)
                                .padding(.horizontal, 16).padding(.vertical, 6)
                                .background(RoundedRectangle(cornerRadius: 8).fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing))
                                    .shadow(color: Color(hex: 0x92400E), radius: 0, x: 0, y: 2))
                        }
                        .buttonStyle(PressableStyle())
                        .sheet(isPresented: $showPro) { ProView() }
                    }
                    // DEV-ONLY (profiles.is_admin): the Simulate Pro toggle as a
                    // quiet gray dashed tool pill with a status dot — flips is_pro
                    // so free-vs-Pro gating can be exercised in testing. Renders
                    // ONLY for the developer's account (mirrors the web gate).
                    if auth.profile?.isAdmin == true {
                        let isPro = auth.isProActive
                        Button { Task { await auth.setSimulatePro(!isPro) } } label: {
                            HStack(spacing: 6) {
                                Circle().fill(isPro ? Theme.win : Color(hex: 0x9CA3AF)).frame(width: 6, height: 6)
                                Text("DEV · PRO \(isPro ? "ON" : "OFF")").font(Brand.font(10, .black)).tracking(0.6)
                            }
                            .foregroundStyle(Theme.textMuted)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Capsule().fill(Theme.surfaceHover))
                            .overlay(Capsule().stroke(Theme.border, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])))
                        }
                        .buttonStyle(PressableStyle())
                        .accessibilityLabel("Developer: toggle Pro on this account")
                    }
                }
                .padding(.top, 12)
                .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 1) }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.border, lineWidth: 1.5))
    }

    /// A quiet 32 pt circle icon button — the app header's ? / ⚙ idiom with the brand purple glyph.
    private func iconCircle(_ system: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 13, weight: .bold)).foregroundStyle(Color(hex: 0x7C3AED))
                .frame(width: 32, height: 32)
                .background(Circle().fill(Theme.surfaceAlt))
                .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(label)
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
                        .font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                        .frame(width: 30, height: 30)
                        .background(Circle().fill(Theme.surfaceHover))
                        .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
                }
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
                              loading: recentLoading, limit: 5)
        }
    }

    private func medalsSection(_ p: Profile) -> some View {
        // Sits under the shared "PROGRESSION" banner (web parity): the card
        // carries its own small "Daily Medals" title instead of a section header.
        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Daily Medals").font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 12) {
                    medalCount("crown.fill", p.goldMedals, "Gold", Color(hex: 0xD97706))
                    medalCount("medal.fill", p.silverMedals, "Silver", Theme.textMuted)
                    medalCount("medal.fill", p.bronzeMedals, "Bronze", Color(hex: 0xB45309))
                }
                if !medals.isEmpty {
                    if showAllMedals {
                        ScrollView { VStack(spacing: 6) { ForEach(medals) { m in medalRow(m) } } }.frame(maxHeight: 320)
                    } else {
                        VStack(spacing: 6) { ForEach(Array(medals.prefix(5))) { m in medalRow(m) } }
                    }
                    if medals.count > 5 {
                        Button { showAllMedals.toggle() } label: {
                            Text(showAllMedals ? "Show less" : "View all \(medals.count) medals ›")
                                .font(Brand.font(11, .heavy)).foregroundStyle(Theme.primary).frame(maxWidth: .infinity)
                        }.buttonStyle(.plain).padding(.top, 2)
                    }
                } else {
                    // Web parity: empty-state copy instead of a bare grid.
                    Text("Play daily challenges to earn medals!")
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                }
            }
            .padding(12).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    private func medalCount(_ icon: String, _ count: Int, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 22)).foregroundStyle(color)
            Text("\(count)").font(Brand.font(18, .black)).foregroundStyle(color)
            Text(label).font(Brand.font(9, .heavy)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
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
        return HStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(color)
            Text(label).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
            Spacer()
            Text(shortMedalDate(m.day)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
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

    private var achievementsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                // Under the shared "PROGRESSION" banner (web parity): a plain
                // card-style title rather than an all-caps section header.
                Text("Achievements").font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
                Spacer()
                Text("\(unlockedAchievements.count)/\(achievementCatalog.all.count)").font(Brand.font(10, .black)).foregroundStyle(Theme.primary)
                    .padding(.horizontal, 8).padding(.vertical, 2).background(Capsule().fill(Color(hex: 0xF3F0FF)))
            }
            ForEach(achCategories, id: \.key) { cat in
                let items = achievementCatalog.all.filter { $0.category == cat.key }
                if !items.isEmpty {
                    let n = items.filter { unlockedAchievements.contains($0.key) }.count
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Text(cat.label.uppercased()).font(Brand.font(11, .black)).tracking(0.4).foregroundStyle(Color(hex: cat.color))
                            Text("\(n)/\(items.count)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                        }
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                            ForEach(items) { achievementCell($0) }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private func achievementCell(_ a: AchievementDef) -> some View {
        let on = unlockedAchievements.contains(a.key)
        let prog = on ? nil : achievementProgress(a.key)
        VStack(spacing: 2) {
            Text(on ? "✓" : "?").font(Brand.font(18, .black)).foregroundStyle(on ? Theme.primary : Theme.textMuted)
            Text(a.name).font(Brand.font(10, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            .minimumScaleFactor(0.7)
            Text(a.description).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center).lineLimit(2)
            if let prog {
                GeometryReader { g in ZStack(alignment: .leading) { Capsule().fill(Theme.border); Capsule().fill(Theme.primary).frame(width: g.size.width * min(1, Double(prog.c) / Double(prog.t))) } }.frame(height: 4).padding(.top, 1)
                Text("\(prog.c)/\(prog.t)").font(Brand.font(8, .bold)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(10).frame(maxWidth: .infinity, minHeight: 84, alignment: .top)
        .background(RoundedRectangle(cornerRadius: 12).fill(on ? Color(hex: 0xF3F0FF) : Color(hex: 0xFAFAFA)))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(on ? Color(hex: 0xC4B5FD) : Theme.border, lineWidth: 1.5))
        .opacity(on ? 1 : (prog != nil ? 0.8 : 0.4))
    }

    private func achievementProgress(_ key: String) -> (c: Int, t: Int)? {
        guard let p = auth.profile else { return nil }
        let medalsTotal = p.goldMedals + p.silverMedals + p.bronzeMedals
        let map: [String: (Int, Int)] = ["streak_7": (p.dailyLoginStreak, 7), "streak_30": (p.dailyLoginStreak, 30), "medal_10": (medalsTotal, 10), "medal_50": (medalsTotal, 50)]
        if let m = map[key], m.0 < m.1 { return (m.0, m.1) }
        return nil
    }

    // MARK: Solo/VS toggle + VS RECORD card (ports profile/page.tsx section D)

    /// user_stats rows scoped to a play type.
    private func stats(for tab: String) -> [UserStatRow] { statRows.filter { $0.playType == tab } }

    /// Solo | VS toggle on a game page — only where the game has a live VS
    /// board (word engines + ProperNoundle). The old page-level Solo/VS/VS-CPU
    /// toggle is gone; All-time's VS section's Live | CPU pair covers practice.
    private func soloVsToggle(accent: Color) -> some View {
        HStack(spacing: 8) {
            ForEach(["solo", "vs"], id: \.self) { t in
                let active = gamePageTab == t
                // Instant, like the rail (founder, 2026-09-29) — the page re-keys on activeTab.
                Button { Haptics.tap(); setActiveTab(t) } label: {
                    HStack(spacing: 6) {
                        if t == "solo" {
                            Image(systemName: "person.fill").font(.system(size: 12, weight: .bold))
                        } else {
                            Image("swords").renderingMode(.template).resizable().scaledToFit()
                                .frame(width: 14, height: 14)
                        }
                        Text(t == "solo" ? "Solo" : "VS").font(Brand.font(12, .heavy))
                    }
                    .foregroundStyle(active ? accent : Theme.textMuted)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.surface : Theme.surfaceHover))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? accent : Theme.border, lineWidth: 1.5))
                }.buttonStyle(PressableStyle())
            }
            Spacer()
        }
    }

    /// "VS RECORD" summary card (All-time VS section): aggregate W–L, win rate, total.
    /// Practice record vs the CPU — its own dashed box in All-time's VS section, clearly
    /// unranked. Best CPU streak comes from the client-side progression store.
    @ViewBuilder private var cpuRecordCard: some View {
        let rec = UserStatsService.cpuRecord(statRows)
        let bestStreak = CpuProgressionStore.load().bestStreak
        // Always shown in the VS section (even at 0–0) so the practice record is
        // discoverable before your first bot match; it fills in once you play one.
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0x64748B).opacity(0.10)).frame(width: 40, height: 40)
                Image(systemName: "cpu").font(.system(size: 18)).foregroundStyle(Color(hex: 0x64748B))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("VS CPU").font(Brand.font(10, .heavy)).tracking(0.8).foregroundStyle(Color(hex: 0x64748B))
                Text("\(rec.wins)–\(rec.losses)").font(Brand.font(20, .black)).foregroundStyle(Theme.textPrimary)
                if rec.total == 0 {
                    Text("Beat a bot to start your record").font(Brand.font(10, .heavy)).foregroundStyle(Theme.textMuted)
                } else if bestStreak > 0 {
                    Text("🔥 Best streak: \(bestStreak)").font(Brand.font(10, .heavy)).foregroundStyle(Color(hex: 0xF97316))
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(rec.total == 0 ? "—" : "\(rec.winRate)%").font(Brand.font(20, .black)).foregroundStyle(Color(hex: 0x64748B))
                Text(rec.total == 0 ? "NO GAMES YET" : "WIN RATE · \(rec.total) \(rec.total == 1 ? "MATCH" : "MATCHES")")
                    .font(Brand.font(9, .heavy)).tracking(0.4).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, style: StrokeStyle(lineWidth: 1.5, dash: [5])))
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
                Text("VS RECORD").font(Brand.font(10, .heavy)).tracking(0.8)
                    .foregroundStyle(Color(hex: 0x6D28D9))
                Text("\(rec.wins)–\(rec.losses)").font(Brand.font(20, .black))
                    .foregroundStyle(Theme.textPrimary)
                // D2: today's daily VS outcome (DailyResultsService.dailyVSResult).
                Text("Today: \(vsDailyWon == nil ? "not played" : (vsDailyWon! ? "won" : "lost"))")
                    .font(Brand.font(10, .heavy))
                    .foregroundStyle(vsDailyWon == nil ? Theme.textMuted : (vsDailyWon! ? Theme.win : Color(hex: 0xDC2626)))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(rec.winRate)%").font(Brand.font(20, .black)).foregroundStyle(Theme.primary)
                Text("WIN RATE · \(rec.total) \(rec.total == 1 ? "MATCH" : "MATCHES")")
                    .font(Brand.font(9, .heavy)).tracking(0.4).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(LinearGradient(
            colors: [Color(hex: 0xF5F3FF), Color(hex: 0xFCE7F3)],
            startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
    }

    /// Mode-detail header — ports the mode-detail-panel.tsx header row: mode
    /// icon tile + title in the mode accent, and a read-only play-type chip that
    /// reflects the page's scope (a game page's Solo | VS toggle, or the VS
    /// page's Live | CPU pair — the panel has no toggle of its own).
    private func modeDetailHeader(_ mode: GameMode, tab: String) -> some View {
        let m = dailyModes.first { $0.dbKey == mode.rawValue }
        let accent = ModeStyle.accent(mode)
        return HStack {
            HStack(spacing: 8) {
                if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                Text(m?.title ?? ModeStyle.title(mode)).font(Brand.font(14, .black)).foregroundStyle(accent)
            }
            Spacer()
            HStack(spacing: 4) {
                if tab == "solo" {
                    Image(systemName: "person.fill").font(.system(size: 10, weight: .bold))
                } else if tab == "vs" {
                    Image("swords").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 12, height: 12)
                } else {
                    Image(systemName: "cpu").font(.system(size: 10, weight: .bold))
                }
                Text(tab == "solo" ? "Solo" : tab == "vs" ? "VS" : "VS CPU")
                    .font(Brand.font(10, .heavy))
            }
            .foregroundStyle(accent)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 8).fill(accent.opacity(0.08)))
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
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 12) {
            ForEach(cells, id: \.0) { c in
                VStack(spacing: 1) {
                    Text(c.1).font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
                    Text(c.0.uppercased()).font(Brand.font(9, .bold)).tracking(0.4).foregroundStyle(Theme.textMuted)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
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

/// Daily leaderboard — matches app/daily/page.tsx (full mode picker,
/// your-rank banner, rank icons, current-user highlight, win/loss pill,
/// yesterday toggle, player count).
struct LeaderboardTab: View {
    @EnvironmentObject private var auth: AuthService
    @ObservedObject private var chrome = ChromeVisibility.shared
    /// Owned by RootTabView so tab gestures can pop it to root.
    @Binding var path: [String]
    @State private var mode: GameMode = .duel
    // Sweep tile (HModePicker cell after the sweep modes) — the cross-mode
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
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                VStack(spacing: 0) {
                    AppHeaderView()
                    if !auth.isAuthenticated { signedOut } else { content }
                }
            }
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

    /// "Play CTA" card (web /daily): mode icon + title + players-today + a Play
    /// button that launches today's daily for the selected mode.
    private var playCtaCard: some View {
        // The whole catalog — the More Games titles are not in the home grid, and the
        // fallback showed their raw keys ("SCRAMBLE", "HUB") with no icon (founder, 2026-09-27).
        let m = (homeModes + moreModes).first { $0.dbKey == mode.rawValue }
        let accent = ModeStyle.accent(mode)
        return VStack(spacing: 0) {
            LinearGradient(colors: [accent, accent.opacity(0.5)], startPoint: .leading, endPoint: .trailing)
                .frame(height: 3)
            HStack(spacing: 10) {
                if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                VStack(alignment: .leading, spacing: 1) {
                    Text(m?.title ?? mode.rawValue).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                    HStack(spacing: 4) {
                        Image(systemName: "person.2.fill").font(.system(size: 10))
                        // No count yet (nothing cached for this mode) → a redacted bar, not "0 players".
                        if loading && playerCount == 0 {
                            Text("000 players today").font(Brand.font(10, .bold)).redacted(reason: .placeholder)
                        } else {
                            Text("\(playerCount) player\(playerCount == 1 ? "" : "s") today").font(Brand.font(10, .bold))
                        }
                    }.foregroundStyle(Theme.textMuted)
                }
                Spacer()
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
                    HStack(spacing: 5) {
                        Image(systemName: played ? "eye.fill" : "play.fill").font(.system(size: 11))
                        Text(played ? "View" : "Play").font(Brand.font(13, .black))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(Capsule().fill(accent))
                    .shadow(color: accent.opacity(0.3), radius: 4, x: 0, y: 2)
                }.buttonStyle(.plain)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("DAILY CHALLENGE").font(Brand.font(28, .black)).tracking(-0.5)
                .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .topLeading, endPoint: .bottomTrailing))
            HStack(spacing: 12) {
                DailyCountdownLabel()
                Button { showRecords = true } label: {
                    Text("All-time →").font(Brand.font(12, .black)).foregroundStyle(Color(hex: 0x7C3AED))
                }
                .buttonStyle(.plain)
            }
            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity).padding(.bottom, 4)
        .sheet(isPresented: $showRecords) { RecordsTab().presentationDetents([.large]) }
    }

    private var signedOut: some View {
        VStack(spacing: 16) {
            placeholder(icon: "trophy.fill", title: "Sign in to see rankings",
                        subtitle: "Daily leaderboards are available to signed-in players.")
            Button("Sign in") { showAuth = true }.buttonStyle(.borderedProminent).tint(Theme.primary)
        }
        .sheet(isPresented: $showAuth) { AuthView() }
    }

    private var content: some View {
        ScrollView {
            VStack(spacing: 12) {
                header
                HModePicker(selected: modeSelection, isSweep: sweepSelection)
                if isSweep {
                    sweepBoard
                } else {
                perModeBoard
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            // Clear the banner+nav: every sibling tab hardcodes 72–80pt here,
            // but this tab never got ANY — invisible until Yesterday's Winners
            // made the page tall enough to cut off (founder screenshot). The
            // measured inset also handles the taller free-tier banner+nav stack
            // that the siblings' magic 72 quietly under-clears.
            .padding(.bottom, max(72, chrome.bottomInset))
        }
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
    /// ranked by total composite score. Reuses the rank banner + rankIcon shell.
    @ViewBuilder private var sweepBoard: some View {
        if let r = sweepRank { rankBanner(r) }

        HStack(alignment: .center) {
            Text("DAILY SWEEP").font(Brand.font(10, .black)).tracking(0.8)
                .foregroundStyle(Theme.textMuted)
            Spacer()
            // §223 microcopy: the sweep board pre-answers "why is 9/9 below
            // 8/9" — it ranks by points, not wins.
            Text("Ranked by total points across all modes").font(Brand.font(9, .bold))
                .foregroundStyle(Theme.textMuted)
            // §231: the same share icon as the per-mode board — today's sweep
            // board card with the sharer's sweep rank.
            if !sweepLoading && !sweepEntries.isEmpty {
                Button {
                    guard !sharingLb else { return }
                    sharingLb = true
                    LeaderboardShareFlow.shareSweep(
                        podium: false, entries: sweepEntries,
                        userId: auth.profile?.id, userRank: sweepRank)
                    sharingLb = false
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
                .opacity(sharingLb ? 0.4 : 1)
                .accessibilityLabel("Share sweep leaderboard")
            }
        }

        if sweepLoading {
            LeaderboardSkeleton()
        } else if sweepEntries.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "trophy").font(.system(size: 32)).foregroundStyle(Theme.textMuted.opacity(0.4))
                Text("No sweeps yet today. Be the first!").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 40)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        } else {
            VStack(spacing: 0) {
                ForEach(Array(sweepEntries.enumerated()), id: \.element.id) { idx, entry in
                    sweepRow(rank: entry.rank, entry: entry)
                    if idx < sweepEntries.count - 1 { Divider().overlay(Theme.border) }
                }
            }
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }

        // Yesterday's Winners — same toggle as the per-mode board, but the
        // podium is yesterday's top sweepers (rank/pill from the sweep RPC).
        HStack(spacing: 8) {
            Button { showYesterday.toggle() } label: {
                HStack(spacing: 6) {
                    Text("Yesterday's Winners").font(Brand.font(12, .heavy))
                    Image(systemName: showYesterday ? "chevron.up" : "chevron.down").font(.system(size: 11))
                }.foregroundStyle(Theme.textMuted)
            }
            // §231: settled sweep-podium share — only once the dropdown is
            // open with rows (per-mode parity).
            if showYesterday && !yesterdaySweep.isEmpty {
                Button {
                    guard !sharingPodium else { return }
                    sharingPodium = true
                    LeaderboardShareFlow.shareSweep(
                        podium: true, entries: yesterdaySweep,
                        userId: auth.profile?.id)
                    sharingPodium = false
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
                .opacity(sharingPodium ? 0.4 : 1)
                .accessibilityLabel("Share yesterday's sweep podium")
            }
        }
        if showYesterday {
            if ySweepKnown == nil {
                LeaderboardSkeleton()
            } else if yesterdaySweep.isEmpty {
                Text("No sweeps yesterday")
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity).padding(24).multilineTextAlignment(.center)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(yesterdaySweep.enumerated()), id: \.element.id) { idx, entry in
                        yesterdaySweepRow(entry)
                        if idx < yesterdaySweep.count - 1 { Divider().overlay(Theme.border) }
                    }
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            }
        }
    }

    /// Sweep-yesterday row — full detail (founder ask, Aug 17): the RPC
    /// already returns time + modes for any day, so mirror today's sweepRow
    /// shape (name over "time · X/9" + pill; muted score at right).
    private func yesterdaySweepRow(_ entry: SweepEntry) -> some View {
        HStack(spacing: 12) {
            rankIcon(entry.rank).frame(width: 22)
            AvatarView(url: entry.avatarUrl, username: entry.username, size: 24)
            // §236: score rides the name line; the stats line owns the width.
            NavigationLink(value: entry.userId) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text(entry.username).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Spacer(minLength: 6)
                        Text(ySweepScoreLabels[entry.totalScore] ?? formatScore(entry.totalScore))
                            .font(Brand.font(13, .black)).foregroundStyle(Theme.textMuted)
                            .lineLimit(1).fixedSize()
                    }
                    Text(sweepStatsLine(entry, details: ySweepDetails[entry.userId], day: LeaderboardService.yesterdayLocal()))
                        .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                        // §246 (founder screenshot: "86 guesses ·…"): the hints
                        // segment fell off the row's end — wrap, never truncate.
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 6) {
                        SweepModeDots(details: ySweepDetails[entry.userId],
                                      day: LeaderboardService.yesterdayLocal())
                        // Yesterday's rows read yesterday's settled streaks (web/Android parity).
                        sweepPill(isFlawless: entry.isFlawless,
                                  streak: yFlawlessStreaks[entry.userId] ?? 0)
                    }
                }
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
    }

    @ViewBuilder private var perModeBoard: some View {
                playCtaCard
                // .id(mode) → a fresh card per mode so switching away from one mode
                // can't render the previous mode's board data (which trapped when a
                // board mode rendered stale ProperNoundle data mid-transition).
                if mode.isCustomEngine { CustomCompletedDailyCard(mode: mode).id(mode) } else { CompletedDailyCard(mode: mode).id(mode) }
                if let r = userRank { rankBanner(r) }

                HStack(alignment: .center) {
                    Text("LEADERBOARD").font(Brand.font(10, .black)).tracking(0.8)
                        .foregroundStyle(Theme.textMuted)
                    Spacer()
                    // FRIENDS toggle (§207) — the Solo/VS segmented shell, compact.
                    if auth.isAuthenticated {
                        let accent = ModeStyle.accent(mode)
                        HStack(spacing: 0) {
                            ForEach([false, true], id: \.self) { f in
                                // All|Friends repaints its cached board in the same transaction (founder,
                                // 2026-09-29: a frame of the global rows and "of N" under "Friends").
                                Button { if friendsOnly != f { instantly { friendsOnly = f; paintCachedBoard() } } } label: {
                                    Text(f ? "Friends" : "All")
                                        .font(Brand.font(9, .heavy))
                                        .foregroundStyle(friendsOnly == f ? accent : Theme.textMuted)
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(friendsOnly == f ? accent.opacity(0.08) : Theme.surface)
                                }
                                .buttonStyle(InstantButtonStyle())
                            }
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1.5))
                    }
                    // Founder-approved clarity: this board ranks DAILY games
                    // only — Unlimited runs never appear here (the founder's
                    // sister played Unlimited and looked for her name).
                    Text("Daily games only").font(Brand.font(9, .bold))
                        .foregroundStyle(Theme.textMuted)
                    if !loading && !entries.isEmpty {
                        Button {
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
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.textMuted)
                        }
                        .buttonStyle(.plain)
                        .opacity(sharingLb ? 0.4 : 1)
                        .accessibilityLabel("Share leaderboard")
                    }
                }

                if loading {
                    LeaderboardSkeleton()   // web parity: animate-pulse rows, not a spinner
                } else if entries.isEmpty {
                    if friendsOnly && !ghostFriends.isEmpty {
                        // Nobody's played yet — the friends list still renders
                        // as ghost rows so the board feels alive (and tauntable).
                        VStack(spacing: 0) {
                            ForEach(Array(ghostFriends.enumerated()), id: \.element.id) { idx, f in
                                ghostRow(f)
                                if idx < ghostFriends.count - 1 { Divider().overlay(Theme.border) }
                            }
                        }
                        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                    } else {
                        VStack(spacing: 8) {
                            Image(systemName: "trophy").font(.system(size: 32)).foregroundStyle(Theme.textMuted.opacity(0.4))
                            Text(friendsOnly ? "No friends yet — add them from any profile" : "No daily results yet. Be the first!")
                                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                                .multilineTextAlignment(.center)
                            // Tier 2 (Aug 11): the empty Friends board is the
                            // best recruiting surface in the app — use it.
                            if friendsOnly {
                                Button { showFriendsSheet = true } label: {
                                    Text("Add friends").font(Brand.font(12, .black)).foregroundStyle(.white)
                                        .padding(.horizontal, 16).padding(.vertical, 9)
                                        .background(RoundedRectangle(cornerRadius: 12)
                                            .fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                                }
                                .buttonStyle(.plain)
                                .padding(.top, 4)
                            }
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 40)
                        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                    }
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(entries.enumerated()), id: \.element.id) { idx, entry in
                            // §217: exact (score, time) ties share the rank.
                            row(rank: LeaderboardService.competitionRank(entries, idx), entry: entry)
                            if idx < entries.count - 1 { Divider().overlay(Theme.border) }
                        }
                        // "Your neighborhood" — rows around the user's rank when
                        // they placed past the top 50 (web daily page parity).
                        if let win = rankWindow {
                            Divider().overlay(Theme.border)
                            Text("···").font(Brand.font(14, .black)).foregroundStyle(Theme.textMuted)
                                .frame(maxWidth: .infinity).padding(.vertical, 4)
                            Divider().overlay(Theme.border)
                            ForEach(Array(win.entries.enumerated()), id: \.element.id) { idx, entry in
                                row(rank: win.startRank + idx, entry: entry)
                                if idx < win.entries.count - 1 { Divider().overlay(Theme.border) }
                            }
                        }
                        // FRIENDS ghost rows — friends who haven't played this
                        // mode today, muted, with the taunt bell (§207).
                        if friendsOnly {
                            ForEach(ghostFriends) { f in
                                Divider().overlay(Theme.border)
                                ghostRow(f)
                            }
                        }
                    }
                    .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                }

                HStack(spacing: 8) {
                    Button { showYesterday.toggle() } label: {
                        HStack(spacing: 6) {
                            Text("Yesterday's Winners").font(Brand.font(12, .heavy))
                            Image(systemName: showYesterday ? "chevron.up" : "chevron.down").font(.system(size: 11))
                        }.foregroundStyle(Theme.textMuted)
                    }
                    // Settled-podium share — only once the dropdown is open with rows.
                    if showYesterday && !yesterday.isEmpty {
                        Button {
                            guard !sharingPodium else { return }
                            sharingPodium = true
                            Task {
                                await LeaderboardShareFlow.sharePodium(
                                    mode: mode, playType: "solo",
                                    top3: yesterday, userId: auth.profile?.id,
                                    friends: friendsOnly)
                                sharingPodium = false
                            }
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.textMuted)
                        }
                        .buttonStyle(.plain)
                        .opacity(sharingPodium ? 0.4 : 1)
                        .accessibilityLabel("Share yesterday's podium")
                    }
                }
                if showYesterday {
                    if yesterdayKnown == nil {
                        LeaderboardSkeleton()
                    } else if yesterday.isEmpty {
                        Text("No results from yesterday")
                            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity).padding(24).multilineTextAlignment(.center)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                    } else {
                        VStack(spacing: 0) {
                            // Full daily rows (founder ask, Aug 11): profile
                            // links, guesses + time detail, W/L pill.
                            ForEach(Array(yesterday.enumerated()), id: \.element.id) { idx, entry in
                                // §217: exact (score, time) ties share the rank.
                                row(rank: LeaderboardService.competitionRank(yesterday, idx), entry: entry, scoreLabels: yLbScoreLabels)
                                if idx < yesterday.count - 1 { Divider().overlay(Theme.border) }
                            }
                        }
                        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                    }
                }
    }

    /// Compact yesterday row — RankIcon, name, small W/L pill, composite score (muted).
    private func yesterdayRow(rank: Int, entry: LeaderboardEntry) -> some View {
        HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            Text(entry.username).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            .minimumScaleFactor(0.7)
            Spacer()
            Text(entry.completed ? "W" : "L").font(Brand.font(9, .heavy))
                .foregroundStyle(entry.completed ? Theme.winText : Theme.lossText)
                .padding(.horizontal, 5).padding(.vertical, 1)
                .background(RoundedRectangle(cornerRadius: 4).fill(entry.completed ? Theme.winBG : Theme.lossBG))
            Text(yLbScoreLabels[entry.compositeScore] ?? formatScore(entry.compositeScore)).font(Brand.font(13, .black)).foregroundStyle(Theme.textMuted)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
    }


    private func rankBanner(_ r: (rank: Int, total: Int)) -> some View {
        HStack(spacing: 3) {
            (Text("You're ranked ").font(Brand.body(12)).foregroundColor(Theme.textMuted)
             + Text("#\(r.rank)").font(Brand.title(18)).foregroundColor(Color(hex: 0xD97706)))
            // Transient "+N/−N" movement pill since you last looked (web parity).
            // Friends mode keeps its own memory — a friend-rank must never
            // compare against a stored global rank.
            RankDeltaBadge(mode: mode.rawValue, playType: "solo",
                           pageKey: friendsOnly && !isSweep ? "daily-friends" : "daily",
                           currentRank: r.rank)
            Text(friendsOnly && !isSweep ? " of \(r.total) friends" : " of \(r.total)")
                .font(Brand.body(12)).foregroundColor(Theme.textMuted)
        }
            .frame(maxWidth: .infinity).padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 16).fill(
                LinearGradient(colors: [Theme.highlightGold, Theme.surface], startPoint: .topLeading, endPoint: .bottomTrailing)))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.goldBorder, lineWidth: 1.5))
    }

    @ViewBuilder
    private func rankIcon(_ rank: Int) -> some View {
        switch rank {
        case 1: Image(systemName: "crown.fill").foregroundStyle(Color(hex: 0xD97706))
        case 2: Image(systemName: "medal.fill").foregroundStyle(Theme.textMuted)
        case 3: Image(systemName: "medal.fill").foregroundStyle(Color(hex: 0xB45309))
        default: Text("\(rank)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted).frame(width: 20)
        }
    }

    private func row(rank: Int, entry: LeaderboardEntry, scoreLabels: [Double: String]? = nil) -> some View {
        let isMe = entry.userId == auth.profile?.id
        return HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            // §212: photo → emoji → initial, left of every username — the
            // boards wear faces, not just names (web lbAvatar parity).
            AvatarView(url: entry.profiles.avatarUrl, username: entry.username,
                       size: 24, emoji: entry.profiles.avatarEmoji)
            // Only the username links to the public profile — matches the web,
            // where the leaderboard wraps just the name in <Link href=/profile/[id]>.
            // Doug's Aug-16 feedback: the stats line lived under the SCORE, so
            // the trailing column's width was set by the widest stats string
            // and names truncated at ~5 chars. Name on top, stats underneath,
            // score alone on the right.
            NavigationLink(value: entry.userId) {
                VStack(alignment: .leading, spacing: 2) {
                    (Text(entry.username)
                        + (entry.userId == crownId ? Text(" 👑") : Text(""))
                        + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                        .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                        .minimumScaleFactor(0.7)
                    HStack(spacing: 5) {
                        Text(detail(entry)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            .lineLimit(1).minimumScaleFactor(0.8)
                        Text(entry.completed ? "Win" : "Loss").font(Brand.font(9, .heavy))
                            .foregroundStyle(entry.completed ? Theme.winText : Theme.lossText)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(RoundedRectangle(cornerRadius: 4).fill(entry.completed ? Theme.winBG : Theme.lossBG))
                    }
                }
            }.buttonStyle(.plain)
            Spacer()
            Text((scoreLabels ?? lbScoreLabels)[entry.compositeScore] ?? formatScore(entry.compositeScore))
                .font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
            // Friends board: one-tap canned taunt on any friend's row (§207).
            if friendsOnly && !isMe {
                Button {
                    tauntTarget = .init(id: entry.userId, username: entry.username,
                                        avatar_url: entry.profiles.avatarUrl, level: 0,
                                        since: nil, requestedAt: nil)
                } label: {
                    Image(systemName: "bell")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Taunt \(entry.username)")
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(isMe ? Theme.highlightGold : rank <= 3 ? Theme.surfaceAlt : Color.clear)
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

    private func ghostRow(_ f: FriendsService.FriendProfile) -> some View {
        HStack(spacing: 12) {
            Text("–").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted).frame(width: 22)
            NavigationLink(value: f.id) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(f.username).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                    Text("Hasn't played yet").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                }
            }.buttonStyle(.plain)
            Spacer()
            Button { tauntTarget = f } label: {
                Image(systemName: "bell")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.textMuted)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Nudge \(f.username)")
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .opacity(0.55)
    }

    /// Canned-taunt picker (§207): fixed phrases, one per friend per day.
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

    /// A sweep-board row — reuses the per-mode row shell: rankIcon, name,
    /// total score, then "total time · X/9" + the FLAWLESS/SWEEP pill.
    private func sweepRow(rank: Int, entry: SweepEntry) -> some View {
        let isMe = entry.userId == auth.profile?.id
        return HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            // §212: faces on the sweep board too (RPC has no emoji column —
            // photo → initial here).
            AvatarView(url: entry.avatarUrl, username: entry.username, size: 24)
            // Same shape as row() (Doug's Aug-16 feedback): stats under the
            // name so the name keeps the row's flexible width.
            // §236 (founder: "still can't see the information clearly — it's
            // cut off"): the score shared a line with the STATS, and "33m 10s ·
            // 8/9 · 90 guesses · 2 hints" lost the width war. The score now
            // rides the NAME line (the name truncates harmlessly); the stats
            // line owns the full row width, with a scale floor as the last
            // resort on the narrowest phones.
            NavigationLink(value: entry.userId) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        (Text(entry.username) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                            .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Spacer(minLength: 6)
                        Text(sweepScoreLabels[entry.totalScore] ?? formatScore(entry.totalScore))
                            .font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                            .lineLimit(1).fixedSize()
                    }
                    Text(sweepStatsLine(entry, details: sweepDetails[entry.userId], day: LeaderboardService.todayLocal()))
                        .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                        // §246 (founder screenshot: "86 guesses ·…"): the hints
                        // segment fell off the row's end — wrap, never truncate.
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    // §227: the pill rides the dots row (the dots are ~70pt wide,
                    // so the pill always fits).
                    HStack(spacing: 6) {
                        SweepModeDots(details: sweepDetails[entry.userId],
                                      day: LeaderboardService.todayLocal())
                        sweepPill(isFlawless: entry.isFlawless,
                                  streak: flawlessStreaks[entry.userId] ?? 0)
                    }
                }
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(isMe ? Theme.highlightGold : rank <= 3 ? Theme.surfaceAlt : Color.clear)
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

/// §223: the Sweep board's mode-dot strip. Order = that day's sweep set in
/// catalog order (ModeGen.sweepModes(for:)), so a pre-Stage-9 day still shows
/// its ProperNoundle dot and a post-launch day shows eight.
/// One dot per mode, graded ABSOLUTELY — intensity is the score as a fraction
/// of that mode's theoretical ceiling, never a comparison to the field, so the
/// strip reads identically with three players or three thousand (founder call,
/// Aug 18: relative "best on board" dies in a crowd). Red = loss, hollow =
/// not played. The [0.35, 0.9] remap spreads real-world ratios (~0.4–0.9)
/// across the full visual range. Mirrors SweepModeDots in app/daily/page.tsx.
/// The header's date + time-to-midnight. Only this label ticks each second —
/// a Timer at the LeaderboardTab root re-rendered the whole tab every second
/// (founder, 2026-09-29). The date shares the timeline so it flips at midnight.
private struct DailyCountdownLabel: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let left = secondsUntilLocalMidnight()
            HStack(spacing: 12) {
                HStack(spacing: 4) {
                    Image(systemName: "calendar").font(.system(size: 11))
                    Text(ctx.date.formatted(.dateTime.month(.abbreviated).day()))
                }
                HStack(spacing: 4) {
                    Image(systemName: "clock").font(.system(size: 11))
                    Text(String(format: "%02d:%02d:%02d", left / 3600, (left % 3600) / 60, left % 60)).monospacedDigit()
                }
            }
        }
    }
}

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

/// Shared mode picker — the sweep modes (+ Sweep, + a More chip once a More Games title is enabled) laid out 5-across on one screen
/// (no horizontal scroll), matching the Profile "Today's Dailies" arrangement.
/// Selecting a mode highlights it in the mode's accent color.
/// No pressed-state fade: `.plain` dims a tile while pressed and eases it back after release, so the
/// newly selected tile read as unselected for ~0.15 s after every tap (founder, 2026-09-29).
struct InstantButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { configuration.label.contentShape(Rectangle()) }
}

/// One un-animated transaction: a selection and the cached content it paints land in the SAME
/// frame, with nothing easing in (founder, 2026-09-29).
@MainActor func instantly(_ body: () -> Void) {
    var t = Transaction(); t.disablesAnimations = true
    withTransaction(t, body)
}

struct HModePicker: View {
    @Binding var selected: GameMode
    // Parallel selection flag for the Sweep tile — GameMode can't hold SWEEP, so
    // the picker tracks it alongside `selected` (untouched for the real cells).
    // Defaults to a constant binding so the Home-grid / non-sweep call sites keep
    // compiling unchanged; only the sweep-aware screens pass a live binding.
    @Binding var isSweep: Bool
    // The sweep modes (More Games §18): the grid cannot hold every daily mode in
    // its 5-over-N layout, so the non-sweep dailies sit behind ONE "More" chip
    // that opens the sectioned More Games list. Today every daily mode is in
    // the sweep, so the chip is hidden and the grid is unchanged (5-over-5).
    private let modes: [HomeMode] = homeModes.filter { $0.dbKey != nil && $0.sweep }
    @ObservedObject private var flags = FlagsService.shared
    private var morePickerModes: [HomeMode] { moreModes.filter { $0.dailyEligible && $0.dbKey != nil && flags.isOn($0.flagKey) } }
    private let spacing: CGFloat = 8
    // Sweep tile accent — indigo, used ONLY here (leaderboard/records sweep board).
    private let sweepAccent = Color(hex: 0x4F46E5)
    @State private var showMore = false

    init(selected: Binding<GameMode>, isSweep: Binding<Bool> = .constant(false)) {
        _selected = selected
        _isSweep = isSweep
    }

    // Short labels so each cell fits 5-across without truncating; the catalog's
    // shortTitle covers any mode not pinned here.
    private let shortTitles: [String: String] = [
        "practice": "Classic", "quordle": "Quad", "octordle": "Octo", "sequence": "Succ",
        "rescue": "Deliv", "six": "Six", "seven": "Seven", "gauntlet": "Gauntlet", "propernoundle": "Proper",
    ]
    private func shortTitle(_ m: HomeMode) -> String { shortTitles[m.id] ?? ModeGen.byId(m.id)?.shortTitle ?? m.title }

    /// Cells in order: sweep modes, the Sweep tile, then the More chip if needed.
    private enum Cell: Identifiable {
        case mode(HomeMode), sweep, more
        var id: String { switch self { case .mode(let m): return m.id; case .sweep: return "SWEEP"; case .more: return "MORE" } }
    }
    private var cells: [Cell] {
        var out: [Cell] = modes.map { .mode($0) } + [.sweep]
        if !morePickerModes.isEmpty { out.append(.more) }
        return out
    }
    private var rows: [[Cell]] {
        let all = cells
        return stride(from: 0, to: all.count, by: 5).map { Array(all[$0..<min($0 + 5, all.count)]) }
    }

    var body: some View {
        let rowCount = CGFloat(rows.count)
        GeometryReader { geo in
            let w = (geo.size.width - spacing * 4) / 5
            VStack(spacing: spacing) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: spacing) {
                        ForEach(row) { c in
                            switch c {
                            case .mode(let m): cell(m, w)
                            case .sweep: sweepCell(w)
                            case .more: moreCell(w)
                            }
                        }
                        // A partial last row keeps its cells at 1/5 width, left-aligned.
                        if row.count < 5 { Spacer(minLength: 0) }
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(height: 52 * rowCount + spacing * (rowCount - 1))
        .sheet(isPresented: $showMore) {
            MoreModePickerSheet { gm in isSweep = false; selected = gm }
                .presentationDetents([.large])
        }
    }

    private func cell(_ m: HomeMode, _ w: CGFloat) -> some View {
        let active = !isSweep && m.dbKey == selected.rawValue
        return Button {
            isSweep = false
            selected = m.mode ?? GameMode(rawValue: m.dbKey ?? "") ?? selected
        } label: {
            VStack(spacing: 4) {
                ModeIconView(icon: m.icon, accent: m.accent, box: 26)
                Text(shortTitle(m)).font(Brand.font(9, .heavy))
                    .foregroundStyle(active ? m.accent : Theme.textMuted).lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(width: w, height: 52)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? m.accent.opacity(0.08) : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? m.accent : Theme.border, lineWidth: 1.5))
        }.buttonStyle(InstantButtonStyle())
    }

    /// The "Sweep" tile — leaderboard/records only, never the Home grid.
    private func sweepCell(_ w: CGFloat) -> some View {
        Button { isSweep = true } label: {
            VStack(spacing: 4) {
                ModeIconView(icon: .asset("broom"), accent: sweepAccent, box: 26)
                Text("Sweep").font(Brand.font(9, .heavy))
                    .foregroundStyle(isSweep ? sweepAccent : Theme.textMuted).lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(width: w, height: 52)
            .background(RoundedRectangle(cornerRadius: 12).fill(isSweep ? sweepAccent.opacity(0.08) : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(isSweep ? sweepAccent : Theme.border, lineWidth: 1.5))
        }.buttonStyle(InstantButtonStyle())
    }

    /// The "More" chip: opens the More Games list. When one of those modes is
    /// selected the chip wears that mode's icon, title and accent so the grid
    /// still shows what the screen is filtered to.
    private func moreCell(_ w: CGFloat) -> some View {
        let picked = isSweep ? nil : morePickerModes.first { $0.dbKey == selected.rawValue }
        let accent = picked?.accent ?? sweepAccent
        let active = picked != nil
        return Button { showMore = true } label: {
            VStack(spacing: 4) {
                ModeIconView(icon: picked?.icon ?? .symbol("square.grid.2x2"), accent: accent, box: 26)
                Text(picked.map(shortTitle) ?? "More").font(Brand.font(9, .heavy))
                    .foregroundStyle(active ? accent : Theme.textMuted).lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(width: w, height: 52)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? accent.opacity(0.08) : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? accent : Theme.border, lineWidth: 1.5))
        }.buttonStyle(InstantButtonStyle())
    }
}

@ViewBuilder
func placeholder(icon: String, title: String, subtitle: String) -> some View {
    VStack(spacing: 12) {
        Image(systemName: icon).font(.system(size: 56)).foregroundStyle(Theme.primary.opacity(0.7))
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
                Text("🏆 \(sweep.currentFlawlessStreak)-DAY FLAWLESS STREAK")
                    .font(Brand.font(13, .black)).tracking(0.5).foregroundStyle(Color(hex: 0xB45309))
            }
            HStack(spacing: 6) {
                Text("All \(total) dailies won today · +600 XP earned")
                    .font(Brand.font(11, .heavy)).foregroundStyle(Color(hex: 0xB45309))
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
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 11, weight: .semibold)).foregroundStyle(Color(hex: 0xB45309))
                    }
                    .buttonStyle(.plain)
                    .opacity(sharing ? 0.4 : 1)
                    .accessibilityLabel("Share flawless streak")
                }
            }
        }
        .task { sweep = await MatchStatsService.dailySweepStats() }
    }
}

