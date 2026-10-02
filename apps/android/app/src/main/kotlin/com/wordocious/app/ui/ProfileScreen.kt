package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.offset
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.ui.graphics.toArgb
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.em
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.MatchStatsService
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.ProfileService
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * STATS (Stats + Friends redesign D2, founder 2026-09-26: "option 2" — Profile
 * and Records merge into one Stats tab that "flows like butter"). Ported from
 * web app/stats/page.tsx. One page:
 *   STATS headline (A6) → the player card → THE game picker (GamePickerCard, shared
 *   with the Leaderboard; finishing build C3) with its Today | All-time toggle → ONE
 *   page below it: Today (landing; also the Sweep tile) · All-time (VS at its bottom
 *   since 2026-10-01) · a game page per daily mode.
 * Swipe left/right on the page moves one item along the picker order. Every game is
 * visible at once in the picker. Zero new fetches beyond the old profile page
 * except today's VS result, the sweep streak and today's standing.
 */
// The sweep set, from the catalog (More Games Stage 5: no second hand-typed
// list; the eight word games since Stage 9).
private val DAILY_MODES: List<String> = com.wordocious.app.ModeGen.sweep.mapNotNull { it.dbKey }
// Every daily mode, canonical order (Pro Stats bars).
private val PICKER_MODES: List<String> = com.wordocious.app.ModeGen.daily.mapNotNull { it.dbKey }

/** Word-engine games and ProperNoundle have live VS boards; the More Games titles do not. */
private fun hasVs(dbKey: String): Boolean =
    com.wordocious.app.ModeGen.byDbKey(dbKey)?.let { it.engine == "word" || it.dbKey == "PROPERNOUNDLE" } == true

// ── P-cache memo bundles (session-lived StatsMemo snapshots; SWR seeds) ──────
private data class ProfileMainMemo(
    val stats: List<ProfileService.UserStat>,
    val recentMatches: List<ProfileService.RecentMatch>,
    val opponentNames: Map<String, String>,
    val medals: List<ProfileService.UserMedal>,
    val todayDailies: Map<String, DailyCompletionsService.Completion>,
    val unlocked: Set<String>,
    val activityCal: List<com.wordocious.app.data.MatchStatsService.DayActivity>,
    /** D2: today's daily VS outcome (null = not played), today's standing, the sweep streaks. */
    val vsDailyWon: Boolean? = null,
    val standing: com.wordocious.app.data.StatsDeepService.DailyStanding? = null,
    val sweepStats: MatchStatsService.DailySweepStats = MatchStatsService.DailySweepStats(),
)

/** The Puzzles-scoped fetches (founder, 2026-10-01 stats audit): they need the visible
 *  Puzzles list, so they run beside the main bundle, keyed on it. */
private data class ProfilePuzzlesMemo(
    val keys: List<String>,
    val records: com.wordocious.app.data.HomeStreaksService.PuzzleRecords?,
    val quiz: com.wordocious.app.data.HomeStreaksService.QuizRecord?,
    val sweepPoints: List<com.wordocious.app.data.MatchStatsService.DailyPointsPoint>,
)

private data class ProfileChartsMemo(
    val guessDist: List<com.wordocious.app.data.MatchStatsService.GuessBucket>,
    val activity7: List<com.wordocious.app.data.MatchStatsService.DayActivity>,
    val modeCal: List<com.wordocious.app.data.MatchStatsService.DayActivity>,
    val solveTimes: List<com.wordocious.app.data.MatchStatsService.SolvePoint>,
    val timeOfDay: List<com.wordocious.app.data.MatchStatsService.HourBucket>,
    val topWords: List<com.wordocious.app.data.MatchStatsService.TopWord>,
    val proInsights: com.wordocious.app.data.MatchStatsService.ProInsights,
    val modeStreaks: Map<String, Pair<Int, Int>>,
    /** Per-mode stats registry aggregate (More Games §18); EMPTY in the All view. */
    val modeAgg: com.wordocious.app.data.ModeStats.ModeAggregates = com.wordocious.app.data.ModeStats.EMPTY_AGGREGATES,
)

@Suppress("UNUSED_PARAMETER") // onOpenFriends: Friends is its own tab since D1; kept for the MainScreen call site.
@Composable
fun ProfileScreen(
    onGoPro: () -> Unit = {}, onEditProfile: () -> Unit = {}, onPlayDaily: (GameMode) -> Unit = {},
    onOpenProfile: (String) -> Unit = {}, onOpenFriends: () -> Unit = {}, onOpenRecords: () -> Unit = {},
    /** Bumped by the VS lobby's Rivals "See all": open All-time at its VS section. */
    vsJumpRequest: Int = 0,
) {
    val profile by AuthService.profile.collectAsState()
    val scope = rememberCoroutineScope()
    // The first frame paints the session memo (and today's on-device completions) instead of
    // an empty page the fetch effect fills a frame later (founder, 2026-09-29).
    val mainSeed = remember { profile?.id?.let { com.wordocious.app.data.StatsMemo.get<ProfileMainMemo>("profileMain:$it") } }
    var stats by remember { mutableStateOf(mainSeed?.stats ?: emptyList()) }
    var recentMatches by remember { mutableStateOf(mainSeed?.recentMatches ?: emptyList()) }
    // VS opponents' usernames for the "· vs <name>" line (web profile parity).
    var opponentNames by remember { mutableStateOf(mainSeed?.opponentNames ?: emptyMap()) }
    var medals by remember { mutableStateOf(mainSeed?.medals ?: emptyList()) }
    var todayDailies by remember { mutableStateOf(mainSeed?.todayDailies ?: DailyCompletionsService.readCache()) }
    var unlockedAchievements by remember { mutableStateOf(mainSeed?.unlocked ?: emptySet()) }
    var activityCal by remember { mutableStateOf(mainSeed?.activityCal ?: emptyList()) }
    // D2: today's daily VS outcome, today's field standing, the sweep streaks.
    var vsDailyWon by remember { mutableStateOf(mainSeed?.vsDailyWon) }
    var standing by remember { mutableStateOf(mainSeed?.standing) }
    var sweepStats by remember { mutableStateOf(mainSeed?.sweepStats ?: MatchStatsService.DailySweepStats()) }
    // Which page shows: RAIL_TODAY | RAIL_ALL | a daily mode dbKey | RAIL_SWEEP (the Today page).
    var selected by remember { mutableStateOf(RAIL_TODAY) }
    // A game page's Solo | VS toggle (only where the game has a live VS board).
    var gameTab by remember { mutableStateOf("solo") }
    // All-time's VS section: which word game's board, People ("vs") or Bots ("vs_cpu").
    var vsMode by remember { mutableStateOf("DUEL") }
    var vsTab by remember { mutableStateOf("vs") }
    // The per-mode chart fetch is scoped to the page: a game page → that mode
    // and its toggle; Today and All-time → the global Solo view (the charts the
    // All-time page draws). All-time's VS board has its own scope (vsCharts below).
    val isGamePage = com.wordocious.app.ModeGen.byDbKey(selected) != null
    val pageMode: String? = if (isGamePage) selected else null
    val pageTab: String = if (isGamePage && hasVs(selected) && gameTab == "vs") "vs" else "solo"
    var loading by remember { mutableStateOf(mainSeed == null) }
    // Account section (web §H) — Delete Account inline confirm + error/in-flight state.
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf(false) }
    // Daily Reminders toggle (web §H NotificationToggle parity) — backed by the
    // existing NotificationService (WorkManager chain) + SettingsPref, identical
    // to the Settings screen toggle.
    val context = androidx.compose.ui.platform.LocalContext.current
    var dailyReminder by remember { mutableStateOf(SettingsPref.get(SettingsPref.DAILY_REMINDER, false)) }
    val notifPermLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { granted -> if (granted) com.wordocious.app.data.NotificationService.schedule(context) }

    val userId = profile?.id
    // D2 step 3: your records (all-time records held, record chases, sweep board
    // ranks) — the old Records → You fetches, once for every page (YourRecords.kt).
    val yours = rememberYourRecords(userId, stats)
    // Re-run once a daily result row has LANDED on the server (recordedTick) so
    // Today's Dailies + stats update immediately, without a tab round-trip —
    // these are server fetches, and the optimistic completionTick fired before
    // the insert (stale refetch).
    val tick by DailyCompletionsService.recordedTick.collectAsState()
    LaunchedEffect(userId, tick) {
        if (userId != null) {
            // P-cache: seed from the session memo for an INSTANT repaint on
            // screen re-entry, then fetch fresh below and store back (SWR).
            val memoKey = "profileMain:$userId"
            com.wordocious.app.data.StatsMemo.get<ProfileMainMemo>(memoKey)?.let { saved ->
                stats = saved.stats
                recentMatches = saved.recentMatches
                opponentNames = saved.opponentNames
                medals = saved.medals
                todayDailies = saved.todayDailies
                unlockedAchievements = saved.unlocked
                activityCal = saved.activityCal
                vsDailyWon = saved.vsDailyWon
                standing = saved.standing
                sweepStats = saved.sweepStats
                loading = false
            }
            // All independent fetches run CONCURRENTLY (was 8 serial round-trips
            // gating the whole screen); only usernames chains off recentMatches.
            kotlinx.coroutines.coroutineScope {
                val statsD = async { ProfileService.fetchUserStats(userId) }
                val matchesD = async { ProfileService.fetchRecentAndTodayMatches(userId) }
                val medalsD = async { ProfileService.fetchUserMedals(userId, limit = 100) }
                val todayD = async { DailyCompletionsService.fetchTodayCompletions() }
                val unlockedD = async { com.wordocious.app.data.AchievementService.fetchUnlocked(userId) }
                val calD = async { com.wordocious.app.data.MatchStatsService.dailyCalendar(userId, days = 90) }
                // D2: today's VS result (the rail's VS dot + the Today pill), today's
                // standing (the ONE leaderboard formula) and the sweep streaks.
                val vsTodayD = async { runCatching { com.wordocious.app.data.DailyResultsService.dailyVsResult() }.getOrNull() }
                val standingD = async { runCatching { com.wordocious.app.data.StatsDeepService.todayDailyStanding(userId) }.getOrNull() }
                val sweepD = async { MatchStatsService.dailySweepStats() }
                val matches = matchesD.await()
                val oppIds = matches.filter { it.player2Id != null }
                    .map { if (it.player1Id == userId) it.player2Id!! else it.player1Id }
                    .distinct()
                val namesD = async { ProfileService.fetchUsernames(oppIds) }
                stats = statsD.await()
                recentMatches = matches
                opponentNames = namesD.await()
                medals = medalsD.await()
                todayDailies = todayD.await()
                unlockedAchievements = unlockedD.await()
                activityCal = calD.await()
                vsDailyWon = vsTodayD.await()
                standing = standingD.await()
                sweepStats = sweepD.await()
            }
            com.wordocious.app.data.StatsMemo.set(memoKey, ProfileMainMemo(
                stats = stats, recentMatches = recentMatches, opponentNames = opponentNames,
                medals = medals, todayDailies = todayDailies, unlocked = unlockedAchievements,
                activityCal = activityCal,
                vsDailyWon = vsDailyWon, standing = standing, sweepStats = sweepStats,
            ))
        }
        loading = false
    }
    // Mode-scoped chart data — reloads whenever the picker OR the play-type
    // toggle changes (restat B1: every per-game stat is scoped to the toggle;
    // vs_cpu fetchers return empty and a "totals only" note shows instead).
    val isProActive = AuthService.isProActive
    // The page's chart data is DERIVED from the selection in the same composition (founder,
    // 2026-09-29): it used to live in vars the fetch effect re-seeded from the memo a frame
    // AFTER a rail / Solo|VS / VS-board tap — so the new page drew the previous page's charts
    // (and with no memo, kept them until the fetch landed). Now: this key's last fetch, else its
    // session memo, else empty; the effect below only fetches and stores.
    val chartsKey = userId?.let { "profileCharts:$it:${pageMode ?: "ALL"}:$pageTab:$isProActive" }
    var chartsState by remember { mutableStateOf<Pair<String, ProfileChartsMemo>?>(null) }
    val charts: ProfileChartsMemo? = chartsState?.takeIf { it.first == chartsKey }?.second
        ?: chartsKey?.let { com.wordocious.app.data.StatsMemo.get<ProfileChartsMemo>(it) }
    val guessDist = charts?.guessDist ?: emptyList()
    val activity7 = charts?.activity7 ?: emptyList()
    // Mode-scoped 90-day calendar for the mode-detail view (iOS renders
    // ActivityCalendarView(mode:) there; the global one above is All-view only).
    val modeCal = charts?.modeCal ?: emptyList()
    val solveTimes = charts?.solveTimes ?: emptyList()
    val timeOfDay = charts?.timeOfDay ?: emptyList()
    val topWords = charts?.topWords ?: emptyList()
    val proInsights = charts?.proInsights ?: com.wordocious.app.data.MatchStatsService.ProInsights()
    // Per-mode win streak (current, best) from match history — mirrors web
    // mode-stats-card / iOS mode-detail streak. Play-type-scoped (restat B1).
    val modeStreaks = charts?.modeStreaks ?: emptyMap()
    // Per-mode stats registry aggregate over the player's own matches rows
    // (ModeStats.modeAggregates, More Games §18) — feeds the custom games'
    // grid cells (Clean, Avg Mistakes, Pangrams, …). EMPTY in the All view.
    val modeAgg = charts?.modeAgg ?: com.wordocious.app.data.ModeStats.EMPTY_AGGREGATES
    // True once THIS page's chart fetch has landed — gates the Top Words empty card
    // so it never flashes before the first result (iOS `loaded`).
    val chartsLoaded = charts != null
    LaunchedEffect(userId, pageMode, isProActive, pageTab, tick) {
        val uid = userId ?: return@LaunchedEffect
        val m = pageMode
        val activeTab = pageTab
        // P-cache: the composition above already paints the session memo; fetch fresh
        // below and store back (SWR).
        val memoKey = "profileCharts:$uid:${m ?: "ALL"}:$activeTab:$isProActive"
        loadProfileCharts(uid, m, activeTab, isProActive).let { fresh ->
            com.wordocious.app.data.StatsMemo.set(memoKey, fresh)
            chartsState = memoKey to fresh
        }
    }
    // All-time's VS board (founder, 2026-10-01: VS left the rail for the bottom of All-time) draws
    // one word game's Live/CPU charts while the page above it draws the global Solo ones, so it
    // keeps its own scope — same memo keys as a game page's VS tab, so the two share a cache.
    val onAllTime = selected == RAIL_ALL
    val vsChartsKey = userId?.let { "profileCharts:$it:$vsMode:$vsTab:$isProActive" }
    var vsChartsState by remember { mutableStateOf<Pair<String, ProfileChartsMemo>?>(null) }
    val vsCharts: ProfileChartsMemo? = vsChartsState?.takeIf { it.first == vsChartsKey }?.second
        ?: vsChartsKey?.let { com.wordocious.app.data.StatsMemo.get<ProfileChartsMemo>(it) }
    LaunchedEffect(userId, onAllTime, vsMode, vsTab, isProActive, tick) {
        val uid = userId ?: return@LaunchedEffect
        if (!onAllTime) return@LaunchedEffect
        val memoKey = "profileCharts:$uid:$vsMode:$vsTab:$isProActive"
        loadProfileCharts(uid, vsMode, vsTab, isProActive).let { fresh ->
            com.wordocious.app.data.StatsMemo.set(memoKey, fresh)
            vsChartsState = memoKey to fresh
        }
    }

    // ── The Puzzles titles this viewer can see for the Today card
    // can see (catalog ∩ remote flags, the HomeScreen filter). No VS chip (2026-10-01). ──
    val flagTable by com.wordocious.app.data.FlagsService.flags.collectAsState()
    val flagsLoaded by com.wordocious.app.data.FlagsService.loaded.collectAsState()
    val visibleMore = remember(flagTable, flagsLoaded) {
        MORE_CARDS.filter { it.dailyEligible && it.dbKey != null && com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) }
    }
    // ── Puzzles-scoped data (founder, 2026-10-01 stats audit): the Today card's Puzzles
    //    streak (the home banner's fetch), All-time's Puzzles Sweeps card, the Daily Points
    //    chart's two lines and the Word of the Day record. Keyed on the visible Puzzles. ──
    val puzzleKeys = remember(visibleMore) { visibleMore.mapNotNull { it.dbKey } }
    val puzzlesSeed = remember { profile?.id?.let { com.wordocious.app.data.StatsMemo.get<ProfilePuzzlesMemo>("profilePuzzles:$it") } }
    // Sweep COUNTS live in the All-time page's Daily Sweeps card (SweepRecordsCard,
    // fed by sweepStats above); this series is the Daily Points trend only.
    var sweepPoints by remember { mutableStateOf(puzzlesSeed?.sweepPoints ?: emptyList()) }
    var puzzleRecords by remember { mutableStateOf(puzzlesSeed?.records) }
    var quizRecord by remember { mutableStateOf(puzzlesSeed?.quiz) }
    // The banner's day-stamped row cache paints the Puzzles streak before the fetch lands.
    val cachedRows = remember { com.wordocious.app.data.HomeStreaksService.cachedRowStreaks() }
    val puzzleStreaks = puzzleRecords?.streaks
        ?: com.wordocious.core.DayStreaks(cachedRows?.puzzlesSweep ?: 0, cachedRows?.puzzlesFlawless ?: 0)
    LaunchedEffect(userId, tick, puzzleKeys) {
        val uid = userId ?: return@LaunchedEffect
        val memoKey = "profilePuzzles:$uid"
        kotlinx.coroutines.coroutineScope {
            val recordsD = async { com.wordocious.app.data.HomeStreaksService.puzzleRecords(puzzleKeys) }
            val quizD = async { com.wordocious.app.data.HomeStreaksService.quizRecord() }
            val pointsD = async { com.wordocious.app.data.MatchStatsService.dailyPointsOverTime(days = 30, puzzleKeys = puzzleKeys) }
            recordsD.await()?.let { puzzleRecords = it }
            quizD.await()?.let { quizRecord = it }
            sweepPoints = pointsD.await()
        }
        com.wordocious.app.data.StatsMemo.set(memoKey, ProfilePuzzlesMemo(puzzleKeys, puzzleRecords, quizRecord, sweepPoints))
    }
    // C3: the swipe order follows THE shared picker (GamePickerCard): Today, All-time, then
    // the WORDOCIOUS tiles (the Sweep tile after Seven) and the PUZZLES tiles — the same
    // catalog ∩ flags filter the picker draws from.
    val pageOrder = remember(flagTable, flagsLoaded) {
        val wordCards = MODE_CARDS.filter {
            !it.homeWide && it.dbKey != null && com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded)
        }
        val puzzleCards = moreDailyModes(MORE_CARDS.filter { com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) })
        val (words, puzzles) = pickerRows(wordCards, puzzleCards, withSweep = true, sweepKey = RAIL_SWEEP)
        statsPageOrder(words.map { it.key }, puzzles.map { it.key }, withSweep = false)
    }
    val haptics = androidx.compose.ui.platform.LocalHapticFeedback.current
    // A jump to RAIL_VS (the Today card's VS Battle pill) opens All-time and scrolls to its VS
    // section (founder, 2026-10-01). vsSectionY is that header's offset inside the page item.
    val listState = rememberLazyListState()
    ScrollToTopOnReselect(listState) // AJ: a re-tap of Stats scrolls to the top.
    var vsSectionY by remember { mutableStateOf(-1) }
    var vsJump by remember { mutableStateOf(0) }
    fun go(key: String) {
        if (key == RAIL_VS) { selected = RAIL_ALL; vsJump++ } else selected = key
    }
    LaunchedEffect(vsJumpRequest) { if (vsJumpRequest > 0) go(RAIL_VS) }
    LaunchedEffect(vsJump) {
        if (vsJump == 0) return@LaunchedEffect
        // Let the All-time page compose and measure first (web waits 60 ms too).
        kotlinx.coroutines.delay(60)
        val y = androidx.compose.runtime.snapshotFlow { vsSectionY }.first { it >= 0 }
        listState.animateScrollToItem(PAGE_ITEM_INDEX, y)
    }
    // A picker / toggle tap: the light tick the old rail gave (none under Reduce Motion).
    fun pick(key: String) {
        if (!WTheme.reducedMotion) haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove)
        go(key)
    }
    // Swipe on the page moves one item along the picker order (founder: no 19-page
    // swipe — but a swipe between neighbors is the natural gesture).
    val swipeModifier = Modifier.pointerInput(pageOrder, selected) {
        val threshold = 70.dp.toPx()
        var total = 0f
        detectHorizontalDragGestures(
            onDragStart = { total = 0f },
            onDragCancel = { total = 0f },
            onDragEnd = {
                if (kotlin.math.abs(total) >= threshold) {
                    statsSwipeTarget(pageOrder, selected, forward = total < 0)?.let { selected = it }
                }
                total = 0f
            },
        ) { _, dragAmount -> total += dragAmount }
    }

    val isGuest by AuthService.isGuest.collectAsState()
    if (isGuest) {
        // Guest — profile/stats are account-based. Prompt sign-in (web/iOS parity): the
        // STATS headline, then a tinted card with a cast pose (A7: not D, the Stats host)
        // and the candy Sign in button (A8).
        Column(
            Modifier.fillMaxSize().pageBackground(PageTint.STATS).padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            PageHeadline(TitleArt.STATS, bleed = 16.dp)
            Spacer(Modifier.weight(0.6f))
            StatsEmptyState(
                StatsPoses.guest,
                "Save your streaks, climb the daily leaderboards, and unlock achievements.",
                title = "Sign in to track your stats",
                swatch = StatsInk.LAVENDER,
                poseSize = 120.dp,
            ) {
                CandyButton("Sign in", { AuthService.exitGuest() }, size = CandySize.LARGE, icon = CandyIcon.ARROW)
            }
            Spacer(Modifier.weight(1f))
        }
        return
    }
    LazyColumn(
        // navigationBarsPadding keeps the bottom of the scroll (Sign Out / Delete
        // Account) clear of the system gesture-nav inset; the host Scaffold already
        // reserves the bottom-nav height. Extra 24dp tail matches web's pb-32.
        modifier = Modifier.fillMaxSize().pageBackground(PageTint.STATS)
            .padding(horizontal = 16.dp),
        state = listState,
        contentPadding = PaddingValues(bottom = TAB_CONTENT_BOTTOM_PAD + 8.dp), // AS3
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Spacer(Modifier.height(8.dp)) }

        // A6: the whole-cast STATS title is the headline — full width, edge to edge (it
        // bleeds past the list's 16 dp side padding), right on the wallpaper, no box.
        item {
            PageHeadline(TitleArt.STATS, bleed = 16.dp)
        }

        // ── A. Header ─────────────────────────────────────────────
        item { Column {
            ProfileHeader(profile, isProActive, onGoPro, onEditProfile, onShare = {
                profile?.let { pr ->
                    val total = pr.totalWins + pr.totalLosses
                    val achTotal = com.wordocious.app.data.AchievementCatalog.cached().size
                    com.wordocious.app.data.ProfileShare.share(context, com.wordocious.app.data.ProfileShare.ProfileInput(
                        username = pr.username ?: "Player",
                        level = pr.level, tier = levelTier(pr.level).label,
                        accent = ProfileAccent.color(pr.accentColor).toArgb(),
                        totalWins = pr.totalWins,
                        winRate = if (total > 0) Math.round(pr.totalWins * 100f / total) else 0,
                        currentStreak = pr.currentStreak, dailyStreak = pr.dailyLoginStreak,
                        gold = pr.goldMedals, silver = pr.silverMedals, bronze = pr.bronzeMedals,
                        achievementsUnlocked = unlockedAchievements.size,
                        achievementsTotal = if (achTotal > 0) achTotal else 72,
                    ))
                }
            })
            // AR: the Stats summary headline in the live lettering (blue → violet, gold numbers).
            profile?.let { pr ->
                val total = pr.totalWins + pr.totalLosses
                if (total > 0) {
                    LiveHeadline(
                        statsSummaryHeadline(pr.totalWins, total, pr.currentStreak),
                        HeadlinePalette.STATS, Modifier.fillMaxWidth().padding(top = 10.dp), maxSize = 22.sp, minSize = 14.sp,
                    )
                }
            }
        } }

        // The "GIFT PRO TO FRIENDS" panel lives on the Friends screen only
        // (founder, 2026-09-26: on the profile it was clutter and a duplicate).
        // The FRIENDS row is gone too: Friends is its own tab since D1.

        // ── C3: THE game picker (shared with the Leaderboard) — every game at once, the
        //    Today | All-time toggle in its header row, today's W / L on each tile. ──
        item {
            GamePickerCard(
                sweepLabel = "Daily Sweep",
                selected = selected.takeIf { it != RAIL_TODAY && it != RAIL_ALL },
                onSelect = { pick(it) },
                accent = StatsInk.accent,
                labelColor = StatsInk.pickerLabel,
                withSweep = true,
                sweepKey = RAIL_SWEEP,
                badge = { key -> todayDailies[key]?.completed },
                header = {
                    StatsSegmented(
                        options = listOf(RAIL_TODAY to "Today", RAIL_ALL to "All-time"),
                        selected = statsSegmentFor(selected),
                        onSelect = { pick(it) },
                        modifier = Modifier.weight(1f),
                        fontSize = 13.sp,
                    )
                },
            )
        }

        // ── ONE page below the picker; a horizontal swipe moves one picker item. The page swaps
        //    INSTANTLY (founder, 2026-09-29): the F1 SwapFade faded+rose the whole page for
        //    220 ms on every rail / Solo|VS / VS-board tap — the Solo|VS toggle and VS board
        //    picker live inside the page, so the tapped control itself faded back in, the old
        //    page cross-faded underneath, and AnimatedContent's size transform slid everything
        //    below. key() keeps the old per-page state reset. The 5th item: PAGE_ITEM_INDEX. ──
        item {
            val page = selected; val tab = pageTab; val mode = pageMode
            androidx.compose.runtime.key(page, tab, mode) {
                Column(Modifier.fillMaxWidth().then(swipeModifier), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    when {
                        // ── Today: your day in one card (TodayCard.kt). ──
                        // The Sweep tile shows the Today page (it holds the sweep), tile highlighted.
                        statsShowsToday(page) -> {
                        TodayCard(
                            sweepModes = DAILY_MODES,
                            moreModes = visibleMore,
                            todayDailies = todayDailies,
                            vsDailyWon = vsDailyWon,
                            standing = standing,
                            sweepStreak = sweepStats.currentSweepStreak,
                            flawlessStreak = sweepStats.currentFlawlessStreak,
                            puzzleStreaks = puzzleStreaks,
                            flawlessFooter = { FlawlessBannerFooter(DAILY_MODES.size, seed = sweepStats) },
                            onPlayDaily = onPlayDaily,
                            onJump = { go(it) },
                        )
                        // Founder (2026-09-26): the most recent games — daily AND unlimited —
                        // right under the Sweep streak / Best moment row; the full history
                        // stays on All-time. Same rows, same stats (RecentMatches.kt).
                        // Founder, 2026-09-27: every game played TODAY (daily and unlimited),
                        // no cap, no "See all" link — the full history lives on All-time.
                        SectionHeader("Today's Games", accent = Color(0xFF2563EB))
                        // Founder, 2026-09-29: dailies and VS keep a row each; Unlimited solo
                        // games fold into one row per game (Pro only — free players see none).
                        TodayGamesList(
                            matches = recentMatches, opponentNames = opponentNames, userId = userId,
                            loading = loading && recentMatches.isEmpty(), showUnlimited = isProActive,
                            emptyScene = SceneArt.NO_STATS, emptyText = Mascots.statsEmptyLine,
                        )
                        }

                        // ── All-time: the snapshot hero, YOUR RECORDS, every chart the old
                        //    "All" dashboard drew, then Progression, VS and Recent Matches. ──
                        page == RAIL_ALL -> {
                            SnapshotHero(
                                totalWins = profile?.totalWins ?: 0,
                                totalLosses = profile?.totalLosses ?: 0,
                                currentStreak = profile?.currentStreak ?: 0,
                                bestStreak = profile?.bestStreak ?: 0,
                                dailyStreak = profile?.dailyLoginStreak ?: 0,
                                bestDailyStreak = profile?.bestDailyLoginStreak ?: 0,
                                gamesThisWeek = activity7.sumOf { it.played },
                                level = profile?.level ?: 1,
                                xpToNext = 1000 - ((profile?.xp ?: 0) % 1000),
                                isPro = isProActive, onGoPro = onGoPro,
                            )
                            // ── Your records (D2 step 3): what the Records → You view used to hold —
                            //    Next Up, Daily Sweeps, Medals + Global Records held, the Trophy Shelf.
                            //    The Global Records tile is the door to the Hall of Fame (RecordsScreen). ──
                            SectionHeader("Your Records", accent = Color(0xFFD97706))
                            NextUpCard(dailyStreak = profile?.dailyLoginStreak ?: 0, chases = yours.chases)
                            SweepRecordsCard(sweep = sweepStats, sweepRankToday = yours.sweepRankToday, sweepRankAllTime = yours.sweepRankAllTime)
                            // Founder, 2026-10-01 stats audit: the Puzzles' own sweep records, then the
                            // Word of the Day record (hidden until the first answer).
                            PuzzleSweepsCard(puzzleRecords)
                            quizRecord?.takeIf { it.answered > 0 }?.let { WordOfTheDayRecordCard(it) }
                            // §294 (D3.3): settled weekly-race finishes, hidden until the first week settles.
                            userId?.let { WeeklyFinishesCard(it) }
                            RecordsHeldRow(recordsHeld = yours.recordsHeld, onOpenRecords = onOpenRecords)
                            TrophyShelf(recordsHeld = yours.recordsHeld)

                            // ── "All" global view — web Trends order (restat R1). ──
                            if (activityCal.any { it.played > 0 }) DailyCalendarCard(activityCal)
                            if (activity7.isNotEmpty()) ActivityCard(activity7)
                            // Guess distribution + solve time always render — their own
                            // empty copy is the guidance (iOS keeps both cards visible).
                            // The distribution counts the word games only (the custom
                            // engines score in their own units).
                            GuessDistributionCard(guessDist, hint = "word games")
                            // The eight Wordocious games only (founder, 2026-10-01 stats audit).
                            SolveTimeCard(solveTimes, hint = "Wordocious games")
                            // Daily points trend: Wordocious and Puzzles lines, sweep/flawless days marked.
                            DailyPointsChartCard(sweepPoints)
                            if (topWords.isNotEmpty()) TopWordsCard(topWords)
                            else if (chartsLoaded) {
                                StatsEmptyCard(
                                    "Top Words", accent = Color(0xFFD97706),
                                    hint = "Your most-guessed words appear here as you play.",
                                )
                            }
                            // Opener Lab (basic): favorite starting words + conversion.
                            OpenerLabCard(playType = tab)
                            // Weekday form: your best day of the week.
                            WeekdayFormCard(playType = tab)
                            // WHEN YOU PLAY (time-of-day) — closes the All view on iOS too.
                            if (timeOfDay.any { it.played > 0 }) WhenYouPlayCard(timeOfDay)
                            // Insights — up to two derived one-liners.
                            val insights = profileInsights(stats, activity7, profile, todayDailies)
                            if (insights.isNotEmpty()) InsightsCard(insights)
                            // Signature (audit, 2026-09-26): best day, best week, comebacks, perfects — free.
                            userId?.let { SignatureCard(it) }
                            // Standing trend — your Top X% per day over 30 days (Pro).
                            userId?.let { StandingTrendCard(it, isPro = isProActive, onGoPro = onGoPro) }
                            // Pro Stats (global view; SOLO rows only).
                            if (!isProActive || stats.isNotEmpty()) {
                                ProStatsCard(stats.filter { it.playType == "solo" }, isProActive, onGoPro)
                            }
                            // Skill Radar — the five-axis signature chart (Pro).
                            SkillRadarCard(isPro = isProActive, onGoPro = onGoPro)

                            // ── Progression: medals + achievements under one banner ──
                            SectionHeader("Progression", accent = Color(0xFFF59E0B))
                            DailyMedals(profile, medals)
                            AchievementsSection(unlockedAchievements, profile)

                            if (loading) {
                                StatsCard(StatsInk.LAVENDER, bar = null) {
                                    Box(Modifier.fillMaxWidth().padding(vertical = 20.dp), Alignment.Center) { CastLoader(null, tips = true) }
                                }
                            }

                            // ── VS (founder, 2026-10-01): VS left the game rail (rarely played; the grid
                            //    now comes out even). Its record (with today's result), Rivalries, the
                            //    Bots record and one word game's board — People or Bots — live here. ──
                            Box(Modifier.onGloballyPositioned { vsSectionY = it.positionInParent().y.toInt() }) {
                                SectionHeader("VS", accent = Color(0xFFEC4899))
                            }
                            VsRecordCard(stats, vsDailyWon)
                            // Rivalries — most-faced opponents with head-to-head bars
                            // (Pro), only once there's an actual VS record (web parity).
                            val vsTotal = stats.filter { it.playType == "vs" }.sumOf { it.wins + it.losses }
                            if (vsTotal > 0) RivalriesCard(isPro = isProActive, onGoPro = onGoPro)
                            CpuRecordCard(stats)
                            VsBoardPicker(
                                modes = DAILY_MODES.filter(::hasVs), selectedMode = vsMode, tab = vsTab,
                                onMode = { vsMode = it }, onTab = { vsTab = it },
                            )
                            ModeStatsBody(
                                mode = vsMode, tab = vsTab, stats = stats,
                                modeStreaks = vsCharts?.modeStreaks ?: emptyMap(),
                                modeAgg = vsCharts?.modeAgg ?: com.wordocious.app.data.ModeStats.EMPTY_AGGREGATES,
                                guessDist = vsCharts?.guessDist ?: emptyList(),
                                modeCal = vsCharts?.modeCal ?: emptyList(),
                                solveTimes = vsCharts?.solveTimes ?: emptyList(),
                                topWords = vsCharts?.topWords ?: emptyList(),
                                chartsLoaded = vsCharts != null,
                                timeOfDay = vsCharts?.timeOfDay ?: emptyList(),
                                proInsights = vsCharts?.proInsights ?: com.wordocious.app.data.MatchStatsService.ProInsights(),
                                isProActive = isProActive, onGoPro = onGoPro,
                            )

                            // ── Recent matches ──
                            // Web parity (profile/page.tsx): skeleton rows while loading, then the
                            // matches or "No matches played yet." — the section never just vanishes.
                            SectionHeader("Recent Matches", accent = Color(0xFF2563EB))
                            RecentMatchesList(
                                // The newest 50 — the list also carries all of today for Today's Games.
                                matches = recentMatches.take(50), opponentNames = opponentNames, userId = userId,
                                loading = loading, limit = 5,
                                emptyScene = SceneArt.NO_STATS, emptyText = Mascots.statsEmptyLine,
                            )
                        }

                        // ── A game page: Solo | VS (only with a live VS board), today's
                        //    line, your records in it, then the registry-driven per-mode stats. ──
                        else -> {
                            val gm = runCatching { GameMode.valueOf(page) }.getOrNull()
                            val accent = gm?.let { modeAccent(it) } ?: WTheme.primary
                            if (hasVs(page)) GameSoloVsToggle(active = gameTab, accent = accent) { gameTab = it }
                            TodayLineCard(dbKey = page, completion = todayDailies[page], accent = accent) { gm?.let(onPlayDaily) }
                            // Your records in this game (the old Records → You "bests by mode" card) — Solo only.
                            if (tab == "solo") {
                                GameRecordsCard(
                                    dbKey = page,
                                    my = stats.find { it.gameMode == page && it.playType == "solo" },
                                    recordsHeld = yours.recordsHeld,
                                    chases = yours.chases,
                                )
                            }
                            ModeStatsBody(
                                mode = page, tab = tab, stats = stats, modeStreaks = modeStreaks, modeAgg = modeAgg,
                                guessDist = guessDist, modeCal = modeCal, solveTimes = solveTimes, topWords = topWords,
                                chartsLoaded = chartsLoaded, timeOfDay = timeOfDay, proInsights = proInsights,
                                isProActive = isProActive, onGoPro = onGoPro,
                            )
                        }
                    }
                }
            }
        }

        // (Account actions — Daily Reminders / Sign Out / Delete Account — live
        // in Settings now; removed from the profile page per product direction.)
    }
}

/** AR the Stats summary headline: "128 WINS · 74% WIN RATE" (+ "· 6 STREAK" while one runs). */
internal fun statsSummaryHeadline(wins: Int, played: Int, streak: Int): String {
    val rate = if (played > 0) Math.round(wins * 100f / played) else 0
    val base = "${"%,d".format(wins)} WIN${if (wins == 1) "" else "S"} · $rate% WIN RATE"
    return if (streak >= 2) "$base · $streak STREAK" else base
}

/** The page item's index in the Stats LazyColumn (spacer · STATS headline · player card ·
 *  picker · page): the VS jump scrolls to it, offset by the VS section header's y inside it. */
private const val PAGE_ITEM_INDEX = 4

/** One chart scope's fetch: a mode (null = the global All view) and a play type. All chart
 *  fetches run CONCURRENTLY (was 6 serial round-trips + a 9-query per-mode streak N+1 — now
 *  one consolidated streak query). */
private suspend fun loadProfileCharts(uid: String, m: String?, activeTab: String, isProActive: Boolean): ProfileChartsMemo {
    return kotlinx.coroutines.coroutineScope {
        val gdD = async { com.wordocious.app.data.MatchStatsService.guessDistribution(uid, m, activeTab) }
        // LAST 7 DAYS is GLOBAL (web fetchActivityByDay takes no mode and no
        // play-type) and only rendered in the All view — load it unfiltered.
        val a7D = async { com.wordocious.app.data.MatchStatsService.activity(uid, days = 7, mode = null) }
        // Mode-scoped 90-day calendar for the mode-detail view (iOS
        // ActivityCalendarView(mode:)); skipped in the All view, which uses
        // the global dailyCalendar fetched above.
        val calD = async {
            if (m == null) emptyList()
            else com.wordocious.app.data.MatchStatsService.activity(uid, days = 90, mode = m)
        }
        // All-time's trend is the eight Wordocious games only (founder, 2026-10-01 stats audit).
        val stD = async { com.wordocious.app.data.MatchStatsService.solveTimes(uid, m, playType = activeTab, modes = if (m == null) DAILY_MODES else null) }
        val todD = async { com.wordocious.app.data.MatchStatsService.timeOfDay(uid, m, activeTab) }
        val twD = async { com.wordocious.app.data.MatchStatsService.topWords(uid, m, playType = activeTab) }
        val piD = async {
            if (m != null && isProActive) com.wordocious.app.data.MatchStatsService.proInsights(uid, m, activeTab)
            else com.wordocious.app.data.MatchStatsService.ProInsights()
        }
        // Per-mode win streaks (scoped to the toggle) — ONE query for every
        // mode at once (modeWinStreaks) instead of stats re-fetch + per-mode.
        val streaksD = async { com.wordocious.app.data.MatchStatsService.modeWinStreaks(uid, activeTab) }
        // Per-mode stats registry: the player's own rows for this mode →
        // pure aggregate (More Games §18). Only the aggregate is kept.
        val aggD = async {
            if (m == null) com.wordocious.app.data.ModeStats.EMPTY_AGGREGATES
            else com.wordocious.app.data.ModeStats.modeAggregates(
                m, com.wordocious.app.data.MatchStatsService.modeMatchRows(uid, m, activeTab),
                com.wordocious.app.ModeGen.byDbKey(m)?.guessBase ?: 1,
            )
        }
        ProfileChartsMemo(
            guessDist = gdD.await(), activity7 = a7D.await(), modeCal = calD.await(),
            solveTimes = stD.await(), timeOfDay = todD.await(), topWords = twD.await(),
            proInsights = piD.await(), modeStreaks = streaksD.await(), modeAgg = aggD.await(),
        )
    }
}

// ── Game page chrome: Solo | VS toggle, today's line ────────────────────────
/** Solo | VS on a game page — only where the game has a live VS board: the tinted
 *  segmented toggle (A1 / A9), the selected segment filled in the game's accent. */
@Composable
private fun GameSoloVsToggle(active: String, accent: Color, onSelect: (String) -> Unit) {
    StatsSegmented(
        options = listOf("solo" to "Solo", "vs" to "VS"),
        selected = active, onSelect = onSelect,
        track = accent, fill = accent,
        modifier = Modifier.width(180.dp),
    )
}

/** "1m 12s" / "45s" / "2m" — web stats page formatDuration. */
private fun fmtDuration(seconds: Int): String {
    if (seconds < 60) return "${seconds}s"
    val m = seconds / 60
    val s = seconds % 60
    return if (s > 0) "${m}m ${s}s" else "${m}m"
}

/** Today's result for this game on the mode's tint with its top band — "Won · 4 guesses ·
 *  1m 12s · 1,940 pts" + an Open candy button — or the door to play it ("Not played yet …"
 *  + Play). The whole row taps through too (A9). */
@Composable
private fun TodayLineCard(dbKey: String, completion: DailyCompletionsService.Completion?, accent: Color, onOpen: () -> Unit) {
    val meta = com.wordocious.app.ModeGen.byDbKey(dbKey)
    val text = if (completion != null) {
        buildString {
            append(if (completion.completed) "Won" else "Lost")
            append(" · ").append(formatGuessStat(meta?.guessSemantics ?: "guesses", meta?.guessBase ?: 1, completion.guessCount))
            if (completion.timeSeconds > 0) append(" · ").append(fmtDuration(completion.timeSeconds))
            append(" · ").append(formatScore(completion.score)).append(" pts")
        }
    } else "Not played yet — play today's ${meta?.title ?: modeLabel(dbKey)}"
    val swatch = StatsInk.of(accent)
    Row(
        Modifier.fillMaxWidth()
            .squishClickable(onClick = onOpen)
            .statsSurface(swatch, corner = 14.dp, bar = accent)
            .padding(start = 14.dp, end = 10.dp, top = 12.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (completion != null) ResultBadge(completion.completed, ROW_RESULT_BADGE_SIZE)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text("TODAY", fontSize = 10.sp, fontWeight = FontWeight.Black, color = swatch.label(), letterSpacing = 0.12.em)
            Text(
                text, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
        }
        CandyButton(
            if (completion != null) "Open" else "Play", onOpen,
            color = if (completion != null) CandyColor.PURPLE else CandyColor.AMBER, size = CandySize.SMALL,
            icon = if (completion != null) CandyIcon.ARROW else CandyIcon.PLAY,
        )
    }
}

/** All-time's VS board picker: the VS-capable word games as mini game cards (A1, selected =
 *  stronger tint + ring), and People | Bots as a tinted segmented toggle (VS overhaul §10). */
@Composable
private fun VsBoardPicker(modes: List<String>, selectedMode: String, tab: String, onMode: (String) -> Unit, onTab: (String) -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 1.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            modes.forEach { m ->
                val active = m == selectedMode
                val card = modeCardForKey(m)
                val gm = runCatching { GameMode.valueOf(m) }.getOrNull()
                val accent = card?.accent ?: gm?.let { modeAccent(it) } ?: WTheme.primary
                val label = com.wordocious.app.ModeGen.byDbKey(m)?.shortTitle ?: m
                Box(
                    Modifier.weight(1f).aspectRatio(1f)
                        .squishClickable(onClick = { onMode(m) })
                        .semantics(mergeDescendants = true) {
                            role = androidx.compose.ui.semantics.Role.Tab
                            selected = active
                            contentDescription = "$label VS board"
                        },
                ) {
                    Box(Modifier.fillMaxSize().miniGameCard(accent, 11.dp, selected = active), contentAlignment = Alignment.Center) {
                        val art = gameArtRes(card?.id)
                        if (art != null) {
                            androidx.compose.foundation.Image(
                                androidx.compose.ui.res.painterResource(art), null,
                                modifier = Modifier.fillMaxSize(0.72f).padding(top = 2.dp),
                            )
                        } else if (gm != null) {
                            androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ModeGlyph(gm, accent, box = maxWidth * 0.7f)
                            }
                        }
                    }
                }
            }
        }
        // VS overhaul §10: People | Bots (was Live | CPU) on all three platforms.
        StatsSegmented(
            options = listOf("vs" to "People", "vs_cpu" to "Bots"),
            selected = tab, onSelect = onTab,
            track = Color(0xFF0D9488), fill = Color(0xFF0D9488),
            modifier = Modifier.align(Alignment.End).width(180.dp),
        )
    }
}

/** The per-mode stats content (web mode-detail-panel.tsx): header, the §18
 *  registry grid, then the cards the mode's stats profile turns on. Shared by
 *  the game pages and All-time's VS section; unchanged from the old mode-detail view. */
@Composable
private fun ModeStatsBody(
    mode: String,
    tab: String,
    stats: List<ProfileService.UserStat>,
    modeStreaks: Map<String, Pair<Int, Int>>,
    modeAgg: com.wordocious.app.data.ModeStats.ModeAggregates,
    guessDist: List<com.wordocious.app.data.MatchStatsService.GuessBucket>,
    modeCal: List<com.wordocious.app.data.MatchStatsService.DayActivity>,
    solveTimes: List<com.wordocious.app.data.MatchStatsService.SolvePoint>,
    topWords: List<com.wordocious.app.data.MatchStatsService.TopWord>,
    chartsLoaded: Boolean,
    timeOfDay: List<com.wordocious.app.data.MatchStatsService.HourBucket>,
    proInsights: com.wordocious.app.data.MatchStatsService.ProInsights,
    isProActive: Boolean,
    onGoPro: () -> Unit,
) {
    ModeDetailHeader(mode, tab)
    val tabStats = stats.filter { it.playType == tab && it.gameMode == mode }
    // Always the grid — the aggregations zero out on an empty list, so an
    // unplayed mode reads 0/0/0 instead of swapping in a placeholder box (iOS
    // modeStats renders unconditionally).
    ModeStatsGrid(mode, tabStats, modeStreaks[mode], modeAgg)
    val modeMeta = com.wordocious.app.ModeGen.byDbKey(mode)
    // Hints line (founder, 2026-10-01 stats audit): every Puzzles game has hints — how
    // often the player leans on them, and how many wins needed none.
    if (modeMeta?.group == "more" && modeAgg.games > 0) {
        val accent = runCatching { modeAccent(GameMode.valueOf(mode)) }.getOrDefault(WTheme.primary)
        HintsLine(modeAgg, accent)
    }
    // The cards below the grid come from the mode's stats profile
    // (ModeStats.statPanels, More Games §18): Gauntlet's 50 guesses across 21
    // boards make a histogram meaningless; the custom engines have no word rows,
    // so the word-only cards stay off; every Puzzles game draws a histogram in
    // its own unit (ModeStats.distributionSpec; Hubbub counts every game's rank).
    val modeSemantics = modeMeta?.guessSemantics ?: "guesses"
    val panels = com.wordocious.app.data.ModeStats.statPanels(mode, modeSemantics)
    if (panels.guessDistribution) {
        GuessDistributionCard(
            guessDist, com.wordocious.app.data.ModeStats.guessNoun(modeSemantics),
            countsGames = com.wordocious.app.data.ModeStats.distributionSpec(mode)?.countsAll == true,
        )
    }
    // Per-mode 90-day heatmap (iOS ActivityCalendarView(mode:)).
    if (modeCal.any { it.played > 0 }) DailyCalendarCard(modeCal)
    if (panels.solveTime) SolveTimeCard(solveTimes)
    if (panels.topWords) {
        if (topWords.isNotEmpty()) TopWordsCard(topWords)
        else if (chartsLoaded && tab != "vs_cpu") {
            StatsEmptyCard(
                "Top Words", accent = Color(0xFFD97706),
                hint = "Your most-guessed words appear here as you play.",
            )
        }
    }
    // WHEN YOU PLAY (time-of-day).
    if (timeOfDay.any { it.played > 0 }) WhenYouPlayCard(timeOfDay)
    // Per-mode Pro Insights — Pro-only. Free users see no card here: the
    // blurred Deep Insights section below is the single Pro gate on the
    // profile (the old locked teaser was redundant with it).
    if (isProActive && proInsights != com.wordocious.app.data.MatchStatsService.ProInsights()) {
        ProInsightsCard(proInsights, mode)
    }
    // Deep Insights (restat R4). Hidden on vs_cpu (restat B1).
    if (tab != "vs_cpu") {
        val accent = runCatching { modeAccent(GameMode.valueOf(mode)) }.getOrDefault(WTheme.primary)
        ProDeepModeCard(gameMode = mode, isPro = isProActive, accent = accent, onGoPro = onGoPro, playType = tab)
    } else {
        Text(
            "Bot games record totals only — per-game charts track Solo and VS matches.",
            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            textAlign = TextAlign.Center,
        )
    }
}

/** "HINTS · 0.4 per game · 23 no-hint wins" — the line under a Puzzles game's grid (a tinted pill, A1). */
@Composable
private fun HintsLine(agg: com.wordocious.app.data.ModeStats.ModeAggregates, accent: Color) {
    Row(
        Modifier.fillMaxWidth().tintedPill(accent).padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("HINTS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textSecondary else darkenInk(accent), letterSpacing = 0.6.sp)
        Text(
            "${com.wordocious.app.data.ModeStats.avg1(agg.hintsTotal, agg.games)} per game · ${agg.noHintWins} no-hint ${if (agg.noHintWins == 1) "win" else "wins"}",
            fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.text else FinishInk.heading, maxLines = 1,
        )
    }
}

// ── A. Header ───────────────────────────────────────────────────────────────
private data class Tier(val label: String, val bg: Color, val border: Color, val color: Color)

private fun levelTier(level: Int): Tier = when {
    level >= 100 -> Tier("Diamond", Color(0xFFEFF6FF), Color(0xFFBFDBFE), Color(0xFF1D4ED8))
    level >= 51 -> Tier("Platinum", Color(0xFFF5F3FF), Color(0xFFC4B5FD), Color(0xFF6D28D9))
    level >= 26 -> Tier("Gold", Color(0xFFFEF9EC), Color(0xFFFDE68A), Color(0xFF92400E))
    level >= 11 -> Tier("Silver", Color(0xFFF3F4F6), Color(0xFFD1D5DB), Color(0xFF374151))
    else -> Tier("Bronze", Color(0xFFFEF2E8), Color(0xFFFED7AA), Color(0xFF9A3412))
}

private val MONTHS = arrayOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
/** "Member since Mon YYYY" from an ISO created_at (YYYY-MM-...). */
private fun memberSince(createdAt: String?): String? {
    val s = createdAt ?: return null
    val y = s.substring(0, 4)
    val m = s.substring(5, 7).toIntOrNull() ?: return null
    return "${MONTHS[(m - 1).coerceIn(0, 11)]} $y"
}

/**
 * The PLAYER CARD (founder, 2026-09-26: "the top looks unfinished with the random
 * buttons"; finishing build C3 2026-10-02): a lavender card (#f4eeff / #e2d3ff) with the
 * purple → pink top bar. Row 1: the letter-tile avatar (or photo) · name + PRO /
 * "Playing since Mon YYYY · Favorite: …" / the featured title and bio · Edit and Share
 * as small round candy buttons (A8). Then "LVL N · TIER" + the XP caps over the
 * purple → pink level bar. A footer row only when something applies: Private · Go Pro
 * (amber candy) · the admin-only dev Pro toggle (peach candy). Web app/stats/page.tsx parity.
 */
@Composable
private fun ProfileHeader(profile: com.wordocious.app.data.Profile?, isProActive: Boolean, onGoPro: () -> Unit = {}, onEditProfile: () -> Unit = {}, onShare: () -> Unit = {}) {
    val level = profile?.level ?: 1
    val xp = profile?.xp ?: 0
    val tier = levelTier(level)
    val levelProgress = (xp % 1000) / 10f / 100f       // (xp%1000)/10 as a 0..1 fraction
    val xpToNext = 1000 - (xp % 1000)
    // Letter-tile name (ART_SPEC §20 takes the first two characters itself).
    val initial = profile?.username ?: "P"
    val since = memberSince(profile?.createdAt)
    val favorite = modeCardForKey(profile?.favoriteMode)?.title
    val swatch = StatsInk.LAVENDER
    val dark = WTheme.isDark

    StatsCard(swatch, bar = StatsInk.playerBar, contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            // Avatar — real image (avatar_url) via Coil, else the §20 letter tile.
            // AH/AN: a worn character or saved mascot beats the photo.
            val avatarUrl = profile?.avatarUrl?.takeIf { it.isNotBlank() && !com.wordocious.app.data.MascotAvatars.wearsMascot(profile.username) }
            // AA2/AN6: a rounded-square photo in its frame (Pro gold + crown for a Pro member).
            if (avatarUrl != null) {
                PhotoAvatar(
                    avatarUrl, 52.dp, frame = com.wordocious.app.data.MascotAvatars.photoFrame(profile.username),
                    pro = isProActive, contentDescription = "Avatar",
                )
            } else {
                LetterTileAvatar(initial, 52.dp, accentHex = profile?.accentColor, emoji = profile?.avatarEmoji, pro = isProActive)
            }

            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        profile?.username ?: "Player", fontSize = 18.sp, fontWeight = FontWeight.Black,
                        color = if (ProfileAccent.isCustom(profile?.accentColor)) ProfileAccent.color(profile?.accentColor)
                        else if (dark) WTheme.text else FinishInk.heading,
                        maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    // FINISH_SPEC V3: the Pro member mark (art_badge_level_pro) where the PRO
                    // capsule was, gated on isProActive so an expired subscription drops it.
                    if (isProActive) ProMark(22.dp)
                }
                val sinceLine = listOfNotNull(since?.let { "Playing since $it" }, favorite?.let { "Favorite: $it" }).joinToString(" · ")
                if (sinceLine.isNotEmpty()) {
                    Text(
                        sinceLine, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        color = if (dark) WTheme.textMuted else FinishInk.muted, maxLines = 2,
                    )
                }
                // Personalization: featured title and bio (left-aligned; the favorite is in the
                // line above; renders nothing when the profile carries none).
                Box(Modifier.padding(top = 2.dp)) { ProfilePersonalizationRow(profile, start = true, showFavorite = false) }
            }

            // A8: Edit and Share as small round candy buttons.
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                CandyRoundButton("Edit profile", onEditProfile, color = CandyColor.PURPLE, diameter = 36.dp) {
                    Icon(Icons.Filled.Edit, null, tint = Color.White, modifier = Modifier.size(16.dp))
                }
                CandyRoundButton("Share profile card", onShare, color = CandyColor.PINK, diameter = 36.dp, icon = CandyIcon.SHARE)
            }
        }

        // LVL N · TIER  ·····  640 / 1,000 XP, then the gradient level bar.
        Column(
            Modifier.fillMaxWidth().semantics(mergeDescendants = true) {
                contentDescription = "Level $level, ${tier.label}. ${xp % 1000} of 1,000 XP, $xpToNext XP to next level."
            },
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                // FINISH_SPEC V3: the tier badge + "LVL N" in soft numbers + the tier name.
                LevelBadge(
                    level, 30.dp, Modifier.weight(1f), numberSize = 17.sp, prefix = "LVL", showTier = true,
                    labelColor = swatch.label(),
                )
                Text(
                    "${formatCount(xp % 1000)} / 1,000 XP", fontSize = 12.sp, fontWeight = FontWeight.Black,
                    color = swatch.label(), maxLines = 1,
                )
            }
            StatsLevelBar(levelProgress)
        }

        // Footer row — only when something applies. Social links: the own-profile
        // model carries none on Android yet (EditProfileScreen fetches them ad hoc).
        val isAdmin = profile?.isAdmin == true
        if (profile?.isPrivate == true || !isProActive || isAdmin) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // PRIVATE PROFILES: the owner's always-on reminder that others see
                // only the teaser card. Tap opens the edit surface (where the
                // toggle lives). Accessibility copy per the spec.
                if (profile?.isPrivate == true) {
                    val purple = Color(0xFF7C3AED)
                    Row(
                        modifier = Modifier
                            .squishClickable("Your profile is private — other players see a limited card. Tap to change.") { onEditProfile() }
                            .tintedPill(purple, corner = 50.dp)
                            .padding(start = 10.dp, end = 10.dp, top = 6.dp, bottom = 4.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon3D(Icon3DName.LOCK, 13.dp)
                        Text("Private", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (dark) WTheme.textSecondary else darkenInk(purple))
                    }
                }
                Spacer(Modifier.weight(1f))
                if (!isProActive) {
                    CandyButton(
                        "Go Pro", onGoPro, color = CandyColor.AMBER, size = CandySize.SMALL,
                        leading = { Icon3D(Icon3DName.CROWN, 16.dp) },
                    )
                }
                // DEV-ONLY (profiles.is_admin): a quiet peach tool button with a status
                // dot — never a stray red link. Flips is_pro and refreshes the profile.
                if (isAdmin) {
                    val pro = profile?.isPro == true
                    CandyButton(
                        "DEV · PRO ${if (pro) "ON" else "OFF"}", { com.wordocious.app.data.AuthService.setProDev(!pro) },
                        color = CandyColor.PEACH, size = CandySize.SMALL,
                        contentDescription = "Developer: toggle Pro on this account",
                        leading = { Box(Modifier.size(7.dp).clip(CircleShape).background(if (pro) WTheme.correct else Color(0xFF9CA3AF))) },
                    )
                }
            }
        }
    }
}

// (The old Today's Dailies card is TodayCard.kt now — the eight sweep tiles in
// one row, the Sweep/Flawless banner, the day pills and the streak/best-moment
// row. The §244 footer below is passed into it on a Flawless day.)
/** §244 (founder: "no way of easily identifying that or even show it off"):
 *  the flawless banner's footer — streak-aware copy plus the brag-card share
 *  button. Self-contained fetch (dailySweepStats). */
@Composable
private fun FlawlessBannerFooter(total: Int, seed: MatchStatsService.DailySweepStats = MatchStatsService.DailySweepStats()) {
    // Seeded with the page's own sweep stats so the streak line is there on the first frame
    // (founder, 2026-09-29); the fetch below still refreshes it.
    var sweep by remember { mutableStateOf(seed) }
    var sharing by remember { mutableStateOf(false) }
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    LaunchedEffect(Unit) { sweep = MatchStatsService.dailySweepStats() }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        if (sweep.currentFlawlessStreak >= 2) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                MedalArt(com.wordocious.app.R.drawable.art_medal_trophy, 20.dp)
                Text(
                    "${sweep.currentFlawlessStreak}-DAY FLAWLESS STREAK",
                    fontSize = 13.sp, fontWeight = FontWeight.Black, color = darkSafe(Color(0xFFB45309), DarkInk.amber), letterSpacing = 0.5.sp,
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "All $total dailies won today · +600 XP earned",
                fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = darkSafe(Color(0xFFB45309), DarkInk.amber),
            )
            if (sweep.currentFlawlessStreak >= 1) {
                // A8: the share action is a small round amber candy button.
                CandyRoundButton("Share flawless streak", diameter = 32.dp, color = CandyColor.AMBER, icon = CandyIcon.SHARE, modifier = Modifier.alpha(if (sharing) 0.5f else 1f), onClick = {
                        if (!sharing) {
                            sharing = true
                            scope.launch {
                                try {
                                    com.wordocious.app.data.LeaderboardShare.shareFlawlessStreakCard(
                                        ctx, sweep.currentFlawlessStreak, sweep.bestFlawlessStreak,
                                        AuthService.profile.value?.username,
                                    )
                                } finally { sharing = false }
                            }
                        }
                    },
                )
            }
        }
    }
}

// (The sweep tile — the old DailyBadge — now lives in TodayCard.kt as SweepTile.)

// (The recent match row — RecentMatchRow, fmtMatchTime, fmtMatchDate — lives in
// RecentMatches.kt now, shared by the Today page's Recent Games and All-time.)

// ── Mode-detail header + stats grid (web mode-detail-panel.tsx) ───────────────
/** Mode icon tile (a mini game card) + title in the mode's ink, and a read-only
 *  play-type pill that reflects the page-level Solo/VS/VS-CPU toggle. */
@Composable
private fun ModeDetailHeader(modeId: String, activeTab: String) {
    val mode = runCatching { GameMode.valueOf(modeId) }.getOrNull()
    val card = modeCardForKey(modeId)
    val accent = card?.accent ?: mode?.let { modeAccent(it) } ?: WTheme.primary
    val ink = if (WTheme.isDark) WTheme.text else darkenInk(accent)
    Row(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { heading() }, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(36.dp).miniGameCard(accent, 10.dp), Alignment.Center) {
            val art = gameArtRes(card?.id)
            if (art != null) androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(art), null, Modifier.size(26.dp).padding(top = 2.dp))
            else mode?.let { ModeGlyph(it, accent, box = 32.dp) }
        }
        Spacer(Modifier.width(10.dp))
        Text(modeLabel(modeId), fontSize = 16.sp, fontWeight = FontWeight.Black, color = ink)
        Spacer(Modifier.weight(1f))
        Row(
            Modifier.tintedPill(accent, corner = 10.dp).padding(start = 10.dp, end = 10.dp, top = 8.dp, bottom = 5.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            when (activeTab) {
                "solo" -> Icon(Icons.Filled.Person, null, tint = ink, modifier = Modifier.size(12.dp))
                "vs" -> Icon(
                    androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords), null,
                    tint = ink, modifier = Modifier.size(12.dp),
                )
                else -> Icon(Icons.Filled.Memory, null, tint = ink, modifier = Modifier.size(12.dp))
            }
            Text(
                if (activeTab == "solo") "Solo" else if (activeTab == "vs") "VS" else "VS Bots",
                fontSize = 10.sp, fontWeight = FontWeight.Black, color = ink,
            )
        }
    }
}

/** 4×2 stats grid for the selected mode (web ModeStatsCard): a tinted card in the game's
 *  accent with its top bar, every value a soft number (A2). */
@Composable
private fun ModeStatsGrid(
    dbKey: String,
    rows: List<ProfileService.UserStat>,
    streak: Pair<Int, Int>?,
    aggregates: com.wordocious.app.data.ModeStats.ModeAggregates,
) {
    val wins = rows.sumOf { it.wins }
    val losses = rows.sumOf { it.losses }
    val games = rows.sumOf { it.totalGames }
    val best = rows.mapNotNull { it.bestScore }.filter { it > 0 }.minOrNull()?.toInt() ?: 0
    val fastest = rows.mapNotNull { it.fastestTime }.filter { it > 0 }.minOrNull() ?: 0
    // The eight cells come from the shared per-mode stats registry (ModeStats,
    // More Games §18) — same lines, same fixtures as web and iOS. The custom
    // games' matches-derived cells read from the aggregate over own rows.
    val meta = com.wordocious.app.ModeGen.byDbKey(dbKey)
    val cells = com.wordocious.app.data.ModeStats.statLines(
        dbKey,
        com.wordocious.app.data.ModeStats.Totals(wins, losses, games, best, fastest, streak?.first ?: 0, streak?.second ?: 0),
        meta?.guessSemantics ?: "guesses", meta?.guessBase ?: 1, aggregates,
    ).map { it.label to it.value }
    val accent = modeCardForKey(dbKey)?.accent ?: runCatching { modeAccent(GameMode.valueOf(dbKey)) }.getOrDefault(WTheme.primary)
    val labelInk = if (WTheme.isDark) WTheme.textMuted else darkenInk(accent)
    KitCard(accent = accent) {
        cells.chunked(4).forEachIndexed { i, row ->
            if (i > 0) Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (label, value) ->
                    Column(
                        Modifier.weight(1f).semantics(mergeDescendants = true) { },
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        FitSoftNumber(value, 20.sp)
                        Text(
                            label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black,
                            color = labelInk, letterSpacing = 0.4.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}

/** A soft number that steps its size down to fit a narrow grid cell (A2). */
@Composable
private fun FitSoftNumber(text: String, max: androidx.compose.ui.unit.TextUnit) {
    val size = when {
        text.length > 8 -> max * 0.62f
        text.length > 6 -> max * 0.75f
        text.length > 4 -> max * 0.88f
        else -> max
    }
    SoftNumber(text, size)
}

// ── Insights (All view, web profile/page.tsx `insights` IIFE) ─────────────────
/** Up to two derived one-liners: strongest mode, weekly volume, XP-to-next,
 *  today's dailies progress. */
private fun profileInsights(
    stats: List<ProfileService.UserStat>,
    activity7: List<com.wordocious.app.data.MatchStatsService.DayActivity>,
    profile: com.wordocious.app.data.Profile?,
    todayDailies: Map<String, DailyCompletionsService.Completion>,
): List<String> {
    val out = ArrayList<String>()
    // Strongest mode by win rate (all play types, matching the web which uses the
    // unfiltered stats). Founder, 2026-10-01 stats audit: only modes with ≥ 5 games
    // and a win rate ≤ 95% — a near-certain win isn't a strength worth naming. None
    // qualifying = no strongest-mode line.
    val qualifying = stats.filter { it.totalGames >= 5 && it.wins * 100 <= it.totalGames * 95 }
    qualifying.maxByOrNull { it.wins.toDouble() / maxOf(1, it.totalGames) }?.let { strongest ->
        val rate = Math.round(strongest.wins * 100.0 / strongest.totalGames)
        out.add("Your strongest mode is ${modeLabel(strongest.gameMode)} at $rate% win rate.")
    }
    val weekTotal = activity7.sumOf { it.played }
    if (weekTotal >= 10) out.add("You've played $weekTotal games this week — on a roll!")
    else if (weekTotal in 1..4) out.add("Only $weekTotal game${if (weekTotal == 1) "" else "s"} this week — warm up with a daily.")
    val xpToNext = 1000 - ((profile?.xp ?: 0) % 1000)
    if (xpToNext <= 300) out.add("Just $xpToNext XP away from Level ${(profile?.level ?: 1) + 1}.")
    // Sweep cells only — a More Games daily on the books is not a sweep mode.
    val total = DAILY_MODES.size
    val sweepToday = DAILY_MODES.count { todayDailies.containsKey(it) }
    if (sweepToday == total) {
        val allWon = DAILY_MODES.all { todayDailies[it]?.completed == true }
        out.add(if (allWon) "Flawless Victory — all $total dailies won today." else "All $total dailies done today. Legendary.")
    } else if (sweepToday >= 3) {
        out.add("$sweepToday/$total dailies complete today — keep going.")
    }
    return out.take(2)
}

@Composable
private fun InsightsCard(insights: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Insights", accent = WTheme.primary)
        StatsCard(StatsInk.LAVENDER, bar = StatsInk.playerBar, contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            insights.forEach { text ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Filled.AutoAwesome, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(14.dp))
                    Text(text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (WTheme.isDark) WTheme.text else FinishInk.heading, lineHeight = 16.sp)
                }
            }
        }
    }
}

// ── D. Daily Medals ───────────────────────────────────────────────────────────
@Composable
private fun DailyMedals(profile: com.wordocious.app.data.Profile?, medals: List<ProfileService.UserMedal>) {
    // Prefer the aggregate columns; fall back to counting the medals list by type.
    val gold = profile?.goldMedals?.takeIf { it > 0 } ?: medals.count { it.medalType == "gold" }
    val silver = profile?.silverMedals?.takeIf { it > 0 } ?: medals.count { it.medalType == "silver" }
    val bronze = profile?.bronzeMedals?.takeIf { it > 0 } ?: medals.count { it.medalType == "bronze" }

    var showAll by remember { mutableStateOf(false) }
    SectionLabel("DAILY MEDALS")
    Spacer(Modifier.height(8.dp))
    StatsCard(StatsInk.GOLD, bar = Brush.horizontalGradient(listOf(Color(0xFFF59E0B), Color(0xFFFFD66B))), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MedalCard(art = com.wordocious.app.R.drawable.art_medal_gold, count = gold, label = "Gold", color = Color(0xFFF5A524), modifier = Modifier.weight(1f))
            MedalCard(art = com.wordocious.app.R.drawable.art_medal_silver, count = silver, label = "Silver", color = Color(0xFF8A94A8), modifier = Modifier.weight(1f))
            MedalCard(art = com.wordocious.app.R.drawable.art_medal_bronze, count = bronze, label = "Bronze", color = Color(0xFFD9844A), modifier = Modifier.weight(1f))
        }
        if (medals.isNotEmpty()) {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))) {
                (if (showAll) medals else medals.take(5)).forEachIndexed { i, m -> MedalHistoryRow(m, i) }
            }
            if (medals.size > 5) {
                CandyButton(
                    if (showAll) "Show less" else "View all ${medals.size} medals", { showAll = !showAll },
                    Modifier.align(Alignment.CenterHorizontally),
                    color = CandyColor.PEACH, size = CandySize.SMALL,
                )
            }
        } else {
            // The section always exists — empty copy where the history would be,
            // so the feature is discoverable before the first medal (iOS parity).
            Text(
                "Play daily challenges to earn medals!", fontSize = 12.sp, fontWeight = FontWeight.Bold,
                color = if (WTheme.isDark) WTheme.textMuted else StatsInk.GOLD.ink,
                modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

@Composable
private fun MedalHistoryRow(m: ProfileService.UserMedal, index: Int) {
    val color = when (m.medalType) {
        "gold" -> Color(0xFFD97706); "silver" -> WTheme.textMuted; "bronze" -> Color(0xFFB45309)
        "streak_7" -> Color(0xFFEA580C); "streak_30" -> Color(0xFFDC2626); "streak_100" -> Color(0xFF7C3AED)
        "perfect" -> Color(0xFF7C3AED); else -> WTheme.textMuted
    }
    val label = when (m.medalType) {
        "streak_7" -> "7-Day Streak"; "streak_30" -> "30-Day Streak"; "streak_100" -> "100-Day Streak"
        "perfect" -> "Perfect!"
        // MODE_OPTIONS is the sweep picker only — a More Games medal (ProperNoundle…) reads the catalog title.
        else -> MODE_OPTIONS.firstOrNull { it.first == m.gameMode }?.second ?: m.gameMode?.let(::modeTitleForKey) ?: ""
    }
    // C2 soft striped rows on the gold card.
    Row(
        Modifier.fillMaxWidth().stripedRow(index, Color(0xFFF5A524)).padding(horizontal = 10.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when (m.medalType) {
            // The medal art (decorative; the row's text speaks).
            "gold" -> MedalArt(com.wordocious.app.R.drawable.art_medal_gold, 20.dp)
            "silver" -> MedalArt(com.wordocious.app.R.drawable.art_medal_silver, 20.dp)
            "bronze" -> MedalArt(com.wordocious.app.R.drawable.art_medal_bronze, 20.dp)
            "streak_7", "streak_30", "streak_100" -> Icon3D(Icon3DName.FLAME, 18.dp)
            "perfect" -> Icon(Icons.Filled.Star, null, tint = color, modifier = Modifier.size(14.dp))
            else -> Icon(Icons.Filled.MilitaryTech, null, tint = color, modifier = Modifier.size(14.dp))
        }
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.text else FinishInk.heading)
        Spacer(Modifier.weight(1f))
        Text(shortMedalDate(m.day), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted)
    }
}

private fun shortMedalDate(day: String): String = runCatching {
    val d = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(day)!!
    java.text.SimpleDateFormat("MMM d", java.util.Locale.US).format(d)
}.getOrDefault(day)

/** A medal / trophy art image, decorative (hidden from TalkBack). */
@Composable
private fun MedalArt(@androidx.annotation.DrawableRes res: Int, size: androidx.compose.ui.unit.Dp) {
    androidx.compose.foundation.Image(
        androidx.compose.ui.res.painterResource(res), contentDescription = null,
        modifier = Modifier.size(size).clearAndSetSemantics { },
    )
}

/** One medal count: a tinted pill in the medal's color, the medal art, the soft count (A2). */
@Composable
private fun MedalCard(@androidx.annotation.DrawableRes art: Int, count: Int, label: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.tintedPill(color).padding(top = 12.dp, bottom = 8.dp)
            .semantics(mergeDescendants = true) { contentDescription = "$count $label" },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        MedalArt(art, 34.dp)
        SoftNumber(formatCount(count), 22.sp)
        Text(label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.08.em, color = if (WTheme.isDark) WTheme.textSecondary else darkenInk(color))
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.3.sp,
        color = if (WTheme.isDark) WTheme.textSecondary else FinishInk.label,
        modifier = Modifier.semantics { heading() },
    )
}

// ── Dashboard charts ──────────────────────────────────────────────────────────
/** Guess-distribution horizontal bars (1..6, or the mode's own range), bar
 *  width ∝ count. `noun` is the unit the histogram counts (ModeStats.guessNoun):
 *  "guess" for the word modes, "mistake" / "check" / "miss" / "par" / "rank" for the
 *  Puzzles (founder, 2026-10-01 stats audit). `countsGames`: Hubbub's chart counts
 *  every game, not just wins — its copy says "games". */
@Composable
private fun GuessDistributionCard(
    buckets: List<com.wordocious.app.data.MatchStatsService.GuessBucket>,
    noun: com.wordocious.app.data.ModeStats.Noun = com.wordocious.app.data.ModeStats.Noun("guess", "guesses"),
    /** A right-aligned scope note ("word games" on the All-time page). */
    hint: String? = null,
    countsGames: Boolean = false,
) {
    val max = (buckets.maxOfOrNull { it.count } ?: 1).coerceAtLeast(1)
    val totalWins = buckets.sumOf { it.count }
    val unitOne = if (countsGames) "game" else "win"
    val unitMany = if (countsGames) "games" else "wins"
    // Word labels (Par, +5+, Hubbub's ranks) get a wider label column than "1".."13".
    val longestLabel = buckets.maxOfOrNull { it.label.length } ?: 1
    val labelWidth = if (longestLabel > 2) (longestLabel * 8 + 4).coerceAtMost(96).dp else 24.dp
    // The color ramp reads from the FIRST bucket (fast wins purple → mid amber →
    // slow gray) so a histogram that starts at 5 (Muddle) still opens in purple.
    val firstBucket = buckets.firstOrNull()?.guesses ?: 1
    // Tap a row -> "N guesses · X wins · Y% of wins" detail (iOS parity).
    var selected by remember { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            SectionLabel("${noun.one.uppercase()} DISTRIBUTION")
            if (hint != null) Text(hint, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Column(
            Modifier.fillMaxWidth().statsSurface().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (buckets.none { it.count > 0 }) {
                // Web parity: chart-specific empty copy (guess-distribution.tsx).
                Text(
                    "${if (countsGames) "Play" else "Win"} a game to see your ${noun.one} distribution", fontSize = 12.sp,
                    fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                return@Column
            }
            buckets.forEach { b ->
                val dimmed = selected != null && selected != b.label
                Row(
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.squishClickable {
                        selected = if (selected == b.label || b.count == 0) null else b.label
                    },
                ) {
                    Text(
                        b.label, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textSecondary,
                        maxLines = 1, softWrap = false, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        modifier = Modifier.width(labelWidth),
                    )
                    Box(Modifier.weight(1f).height(20.dp), contentAlignment = Alignment.CenterStart) {
                        val frac = (b.count.toFloat() / max).coerceIn(0f, 1f)
                        // Bucket color ramp: fast wins purple → mid amber → slow gray (iOS).
                        val barColor = when {
                            b.guesses - firstBucket <= 1 -> Color(0xFF7C3AED)
                            b.guesses - firstBucket <= 3 -> Color(0xFFF59E0B)
                            else -> Color(0xFF9CA3AF)
                        }
                        Box(
                            Modifier.fillMaxWidth(frac.coerceAtLeast(if (b.count > 0) 0.06f else 0f)).height(20.dp)
                                .clip(RoundedCornerShape(4.dp)).background(if (dimmed) barColor.copy(alpha = 0.35f) else barColor),
                            contentAlignment = Alignment.CenterEnd,
                        ) {
                            if (b.count > 0) Text("${b.count}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White, modifier = Modifier.padding(end = 6.dp))
                        }
                    }
                }
            }
            // Footer: tapped-bar detail, or the plain running total (iOS parity).
            val selBucket = selected?.let { sel -> buckets.firstOrNull { it.label == sel && it.count > 0 } }
            if (selBucket != null) {
                val pct = (selBucket.count * 100f / totalWins.coerceAtLeast(1)).toInt()
                // A number reads "2 mistakes"; a word label (Par, +2, Pandemonium) stands alone.
                val head = if (Regex("^\\d+\\+?$").matches(selBucket.label)) {
                    "${selBucket.label} ${if (selBucket.label == "1") noun.one else noun.many}"
                } else selBucket.label
                Text(
                    "$head · ${selBucket.count} ${if (selBucket.count == 1) unitOne else unitMany} · $pct% of $unitMany",
                    fontSize = 11.sp, fontWeight = FontWeight.Black, color = purpleTextInk,
                    modifier = Modifier.padding(top = 2.dp),
                )
            } else {
                Text(
                    "$totalWins ${if (totalWins == 1) unitOne else unitMany} total",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

/** Last-7-days activity bars (height ∝ games played; won portion in green). */
@Composable
private fun ActivityCard(activity: List<com.wordocious.app.data.MatchStatsService.DayActivity>) {
    val max = (activity.maxOfOrNull { it.played } ?: 1).coerceAtLeast(1)
    val total = activity.sumOf { it.played }
    val barBrush = StatsInk.chartBars
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            SectionLabel("LAST 7 DAYS")
            Text("$total ${if (total == 1) "game" else "games"}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
        Row(
            Modifier.fillMaxWidth().statsSurface().padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.Bottom,
        ) {
            activity.forEach { d ->
                // Web: heightPct = count==0 ? 6 : 12 + (count/max)*88, over a 48px area.
                val frac = (if (d.played == 0) 0.06f else 0.12f + (d.played.toFloat() / max) * 0.88f).coerceIn(0.06f, 1f)
                val dow = runCatching {
                    java.time.LocalDate.parse(d.day).dayOfWeek.getDisplayName(java.time.format.TextStyle.NARROW, java.util.Locale.US)
                }.getOrDefault("")
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.BottomCenter) {
                        val barMod = Modifier.fillMaxWidth().fillMaxHeight(frac).clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                        if (d.played == 0) Box(barMod.background(Color(0xFF7C3AED).copy(alpha = 0.14f)))
                        else Box(barMod.background(barBrush))
                    }
                    Text(dow.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                }
            }
        }
    }
}

/** GitHub-style 90-day activity heatmap — ports web DailyCalendar (10dp cells,
 *  3dp gaps, win-ratio/intensity color ramp, month labels, Less..More legend). */
@Composable
private fun DailyCalendarCard(data: List<com.wordocious.app.data.MatchStatsService.DayActivity>) {
    if (data.isEmpty()) return
    // Tap a day -> "Jul 3 · 12 games · 9 wins" detail in the footer (iOS parity).
    var selected by remember { mutableStateOf<com.wordocious.app.data.MatchStatsService.DayActivity?>(null) }
    val maxGames = (data.maxOfOrNull { it.played } ?: 1).coerceAtLeast(1)
    val totalDaysPlayed = data.count { it.played > 0 }
    val totalGames = data.sumOf { it.played }

    // Build week-columns: pad leading nulls up to the first day's weekday (Sun=0).
    val firstDow = runCatching { java.time.LocalDate.parse(data.first().day).dayOfWeek.value % 7 }.getOrDefault(0)
    val cells = ArrayList<com.wordocious.app.data.MatchStatsService.DayActivity?>()
    repeat(firstDow) { cells.add(null) }
    cells.addAll(data)
    while (cells.size % 7 != 0) cells.add(null)
    val weeks = cells.chunked(7)

    // Month labels keyed to the week-column where the month first appears.
    val monthLabels = ArrayList<Pair<String, Int>>()
    var lastMonth = ""
    weeks.forEachIndexed { wi, week ->
        val firstDay = week.firstOrNull { it != null } ?: return@forEachIndexed
        val m = runCatching {
            java.time.LocalDate.parse(firstDay.day).month.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.US)
        }.getOrDefault("")
        if (m.isNotEmpty() && m != lastMonth) { monthLabels.add(m to wi); lastMonth = m }
    }
    // Drop a first label that would collide with the second one column over.
    if (monthLabels.size >= 2 && monthLabels[1].second - monthLabels[0].second < 3) monthLabels.removeAt(0)

    fun cellColor(d: com.wordocious.app.data.MatchStatsService.DayActivity?): Color {
        if (d == null || d.played == 0) return if (WTheme.isDark) WTheme.surfaceHover else Color(0xFFEDE5FF)
        val intensity = d.played.toFloat() / maxGames
        val winRatio = d.won.toFloat() / d.played
        return if (winRatio >= 0.8f) {
            when { intensity > 0.6f -> Color(0xFF7C3AED); intensity > 0.3f -> Color(0xFFA78BFA); else -> Color(0xFFDDD6FE) }
        } else {
            when { intensity > 0.6f -> Color(0xFF7C3AED); intensity > 0.3f -> Color(0xFFA78BFA); else -> Color(0xFFC4B5FD) }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("ACTIVITY (LAST 90 DAYS)")
        Column(
            Modifier.fillMaxWidth().statsSurface().padding(16.dp),
        ) {
            // Cells scale to FILL the card's width (the fixed 10dp grid left a
            // big dead zone on the right and needed a scroll). iOS parity.
            androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth()) {
                val n = weeks.size.coerceAtLeast(1)
                val gap = 3.dp
                val labelW = 26.dp
                val cell = ((maxWidth - labelW - 4.dp - gap * (n - 1)) / n).coerceAtLeast(6.dp)
                Column {
                    if (monthLabels.isNotEmpty()) {
                        Box(Modifier.fillMaxWidth().height(14.dp)) {
                            monthLabels.forEach { (label, wi) ->
                                Text(
                                    label, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                                    modifier = Modifier.offset(x = labelW + 4.dp + (cell + gap) * wi),
                                )
                            }
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        // Weekday guide (rows are Sun->Sat; label Mon/Wed/Fri).
                        Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                            (0..6).forEach { r ->
                                Box(Modifier.width(labelW).height(cell), contentAlignment = Alignment.CenterStart) {
                                    Text(
                                        when (r) { 1 -> "Mon"; 3 -> "Wed"; 5 -> "Fri"; else -> "" },
                                        fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                                    )
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                            weeks.forEach { week ->
                                Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                                    week.forEach { d ->
                                        val isSel = selected != null && d != null && selected?.day == d.day
                                        Box(
                                            Modifier.size(cell).clip(RoundedCornerShape(2.dp)).background(cellColor(d))
                                                .then(if (isSel) Modifier.border(1.5.dp, Color(0xFF7C3AED), RoundedCornerShape(2.dp)) else Modifier)
                                                .squishClickable {
                                                    selected = if (d != null && d.played > 0 && selected?.day != d.day) d else null
                                                },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            selected?.let { s2 ->
                val md = runCatching {
                    java.time.LocalDate.parse(s2.day).format(java.time.format.DateTimeFormatter.ofPattern("MMM d", java.util.Locale.US))
                }.getOrDefault(s2.day)
                Text(
                    "$md · ${s2.played} game${if (s2.played == 1) "" else "s"} · ${s2.won} win${if (s2.won == 1) "" else "s"}",
                    fontSize = 11.sp, fontWeight = FontWeight.Black, color = purpleTextInk,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            // Totals lead, Less→More legend trails (iOS footer order).
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "$totalDaysPlayed day${if (totalDaysPlayed == 1) "" else "s"} played · $totalGames games",
                    fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Less", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    listOf(0xFFF3F0FF, 0xFFC4B5FD, 0xFFA78BFA, 0xFF7C3AED, 0xFF6D28D9).forEach { c ->
                        Box(Modifier.size(8.dp).clip(RoundedCornerShape(2.dp)).background(Color(c)))
                    }
                    Text("More", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
        }
    }
}

// ── Achievements ──────────────────────────────────────────────────────────────
/**
 * FINISH_SPEC V1 the achievements grid: each achievement's 3D badge (ui/BadgeKit.kt) in a
 * tile tinted by its category — unlocked = full color, soft glow, name + date; locked =
 * grayscale at 45 %, a small 3D lock, name + progress in soft numbers. Tap = the detail sheet.
 */
@Composable
private fun AchievementsSection(unlocked: Set<String>, profile: com.wordocious.app.data.Profile?) {
    // Single-sourced via /api/achievements (cached); detection stays per-platform.
    val all by androidx.compose.runtime.produceState(
        initialValue = com.wordocious.app.data.AchievementCatalog.cached()
    ) { value = com.wordocious.app.data.AchievementCatalog.load() }
    // The unlock dates (achievements.unlocked_at), refetched when the unlocked set grows.
    val userId = com.wordocious.app.data.AuthService.userId
    val dates by androidx.compose.runtime.produceState(emptyMap<String, String>(), userId, unlocked.size) {
        if (userId != null && unlocked.isNotEmpty()) value = com.wordocious.app.data.AchievementService.fetchUnlockedDates(userId)
    }
    val inputs = AchievementProgressInputs(
        dailyStreak = profile?.dailyLoginStreak ?: 0,
        totalMedals = (profile?.goldMedals ?: 0) + (profile?.silverMedals ?: 0) + (profile?.bronzeMedals ?: 0),
        goldMedals = profile?.goldMedals ?: 0,
        totalWins = profile?.totalWins ?: 0,
        totalGames = (profile?.totalWins ?: 0) + (profile?.totalLosses ?: 0),
        level = profile?.level ?: 1,
        bestWinStreak = profile?.bestStreak ?: 0,
    )
    var detail by remember { mutableStateOf<com.wordocious.app.data.AchievementService.AchievementDef?>(null) }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SectionLabel("ACHIEVEMENTS")
            Spacer(Modifier.weight(1f))
            val purple = Color(0xFF7C3AED)
            Row(
                Modifier.tintedPill(purple).padding(start = 9.dp, end = 9.dp, top = 3.dp, bottom = 1.dp)
                    .semantics(mergeDescendants = true) { contentDescription = "${unlocked.size} of ${all.size} unlocked" },
                verticalAlignment = Alignment.CenterVertically,
            ) { SoftNumber("${unlocked.size}/${all.size}", 12.sp) }
        }
        AchievementInk.CATEGORIES.forEach { cat ->
            val items = all.filter { it.category == cat.key }
            if (items.isNotEmpty()) {
                val n = items.count { unlocked.contains(it.key) }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            cat.label.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp,
                            color = if (WTheme.isDark) cat.accent else darkenInk(cat.accent),
                            modifier = Modifier.semantics { heading() },
                        )
                        SoftNumber("$n/${items.size}", 11.sp)
                    }
                    items.chunked(3).forEach { row ->
                        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { a ->
                                val on = unlocked.contains(a.key)
                                AchievementTile(
                                    def = a, unlocked = on,
                                    date = if (on) BadgeMath.unlockDate(dates[a.key]) else null,
                                    progress = if (on) null else BadgeMath.progress(a.key, inputs),
                                    accent = cat.accent,
                                    modifier = Modifier.weight(1f).fillMaxHeight(),
                                ) { detail = a }
                            }
                            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
        }
    }
    detail?.let { a ->
        val on = unlocked.contains(a.key)
        AchievementDetailSheet(
            def = a, unlocked = on,
            date = if (on) BadgeMath.unlockDate(dates[a.key]) else null,
            progress = if (on) null else BadgeMath.progress(a.key, inputs),
            onDismiss = { detail = null },
        )
    }
}

// ── VS RECORD / CPU RECORD (the VS page) ──────────────────────────────────────
/** vs Bots record — unranked: no leaderboard, no XP, no streak. */
@Composable
private fun CpuRecordCard(stats: List<ProfileService.UserStat>) {
    val cpuStats = stats.filter { it.playType == "vs_cpu" }
    val wins = cpuStats.sumOf { it.wins }
    val losses = cpuStats.sumOf { it.losses }
    val total = wins + losses
    // Always shown on the VS tab (even at 0–0) so the practice record is
    // discoverable before the first bot match; it fills in once you play one.
    val winRate = if (total > 0) Math.round(wins.toFloat() / total * 100) else 0
    val bestStreak = com.wordocious.app.data.CpuProgressionStore.load().bestStreak
    val slate = Color(0xFF64748B)
    RecordCard(
        swatch = StatsInk.of(slate), label = "VS BOTS", record = "$wins–$losses",
        rate = if (total == 0) "—" else "$winRate%",
        rateCaption = if (total == 0) "NO GAMES YET" else "WIN RATE · $total ${if (total == 1) "MATCH" else "MATCHES"}",
        icon = { Icon(Icons.Filled.Memory, null, tint = slate, modifier = Modifier.size(20.dp)) },
    ) {
        if (total == 0) Text("Beat a bot to start your record", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted)
        else if (bestStreak > 0) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Icon3D(Icon3DName.FLAME, 13.dp)
            Text("Best streak: $bestStreak", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFF97316))
        }
    }
}

@Composable
private fun VsRecordCard(stats: List<ProfileService.UserStat>, vsDailyWon: Boolean? = null) {
    val vsStats = stats.filter { it.playType == "vs" }
    val wins = vsStats.sumOf { it.wins }
    val losses = vsStats.sumOf { it.losses }
    val total = wins + losses
    val winRate = if (total > 0) Math.round(wins.toFloat() / total * 100) else 0
    RecordCard(
        swatch = StatsInk.TEAL, label = "VS RECORD", record = "$wins–$losses", rate = "$winRate%",
        rateCaption = "WIN RATE · $total ${if (total == 1) "MATCH" else "MATCHES"}",
        icon = {
            Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords), null,
                tint = Color(0xFF0D9488), modifier = Modifier.size(20.dp),
            )
        },
    ) {
        // D2: today's daily VS outcome (DailyResultsService.dailyVsResult).
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "Today: ${when (vsDailyWon) { null -> "not played"; true -> "won"; false -> "lost" }}",
                fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                color = when (vsDailyWon) { null -> if (WTheme.isDark) WTheme.textMuted else FinishInk.muted; true -> WTheme.correct; false -> RAIL_LOSS_RED },
            )
            if (vsDailyWon != null) ResultBadge(vsDailyWon, 14.dp)
        }
    }
}

/** A VS / Bots record: a tinted card in [swatch] with its top bar, the icon on a mini card,
 *  the caps label, the soft W–L record and win rate (A2), and a small [line] under the record. */
@Composable
private fun RecordCard(
    swatch: StatsSwatch,
    label: String,
    record: String,
    rate: String,
    rateCaption: String,
    icon: @Composable () -> Unit,
    line: @Composable () -> Unit,
) {
    StatsCard(swatch, contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp)) {
        Row(
            Modifier.fillMaxWidth().semantics(mergeDescendants = true) { },
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(Modifier.size(40.dp).miniGameCard(swatch.accent, 12.dp), Alignment.Center) { icon() }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = swatch.label())
                SoftNumber(record, 22.sp)
                line()
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.dp)) {
                SoftNumber(rate, 22.sp)
                Text(rateCaption, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = swatch.label())
            }
        }
    }
}

// (The old 19-chip ProfileModePicker and the page-level Solo/VS/VS-CPU toggle
// are gone — the StatsRail, the per-game Solo|VS toggle and the VS page's
// Live|CPU toggle replace them. D2, 2026-09-26.)

// ── Solve-time line chart ────────────────────────────────────────────────────────
@Composable
private fun SolveTimeCard(
    points: List<com.wordocious.app.data.MatchStatsService.SolvePoint>,
    /** A right-aligned scope note ("Wordocious games" on the All-time page). */
    hint: String? = null,
) {
    val secs = points.map { it.seconds }
    val avg = if (secs.isEmpty()) 0 else secs.sum() / secs.size
    val maxV = (secs.maxOrNull() ?: 1).coerceAtLeast(1)
    // Tap the chart -> nearest win's detail: "Win #12 · Classic · 1:24" (iOS parity).
    var selected by remember(points) { mutableStateOf<Int?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            SectionLabel("SOLVE TIME — LAST ${points.size} WINS")
            if (hint != null) Text(hint, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Column(
            Modifier.fillMaxWidth().statsSurface().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (points.size < 2) {
                // Web parity: chart-specific empty copy (solve-time-chart.tsx).
                Text(
                    "Win more games to see your solve time trend", fontSize = 12.sp,
                    fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                return@Column
            }
            androidx.compose.foundation.Canvas(
                Modifier.fillMaxWidth().height(120.dp)
                    .pointerInput(points) {
                        detectTapGestures { off ->
                            val i = ((off.x / size.width) * (points.size - 1)).toInt()
                                .coerceIn(0, points.size - 1)
                            selected = if (selected == i) null else i
                        }
                    }
            ) {
                if (points.size < 2) return@Canvas
                val w = size.width; val h = size.height
                fun x(i: Int) = w * i / (points.size - 1)
                fun y(v: Int) = h - (h * v / maxV)
                // average rule line (dashed)
                val ay = y(avg)
                drawLine(
                    WTheme.textMuted.copy(alpha = 0.5f), androidx.compose.ui.geometry.Offset(0f, ay),
                    androidx.compose.ui.geometry.Offset(w, ay), strokeWidth = 1.5f,
                    pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(8f, 6f)),
                )
                // area fill
                val areaPath = androidx.compose.ui.graphics.Path().apply {
                    moveTo(0f, h)
                    points.forEachIndexed { i, p -> lineTo(x(i), y(p.seconds)) }
                    lineTo(w, h); close()
                }
                drawPath(areaPath, brush = Brush.verticalGradient(listOf(WTheme.primary.copy(alpha = 0.25f), Color.Transparent)))
                // line
                val linePath = androidx.compose.ui.graphics.Path().apply {
                    points.forEachIndexed { i, p -> if (i == 0) moveTo(x(i), y(p.seconds)) else lineTo(x(i), y(p.seconds)) }
                }
                drawPath(linePath, WTheme.primary, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f))
                points.forEachIndexed { i, p -> drawCircle(WTheme.primary, radius = 4f, center = androidx.compose.ui.geometry.Offset(x(i), y(p.seconds))) }
                selected?.let { si ->
                    points.getOrNull(si)?.let { p ->
                        drawLine(
                            Color(0xFF7C3AED).copy(alpha = 0.6f),
                            androidx.compose.ui.geometry.Offset(x(si), 0f),
                            androidx.compose.ui.geometry.Offset(x(si), h), strokeWidth = 1.5f,
                            pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(6f, 6f)),
                        )
                        drawCircle(Color(0xFF7C3AED), radius = 7f, center = androidx.compose.ui.geometry.Offset(x(si), y(p.seconds)))
                    }
                }
            }
            // Tapped-win detail: which win, mode, exact time.
            selected?.let { si ->
                points.getOrNull(si)?.let { p ->
                    Text(
                        "Win #${si + 1} · ${modeLabel(p.mode)} · ${fmtTime(p.seconds)}",
                        fontSize = 11.sp, fontWeight = FontWeight.Black, color = purpleTextInk,
                    )
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TimeStat("Fastest", secs.minOrNull() ?: 0, WTheme.correct)
                TimeStat("Average", avg, WTheme.text)
                TimeStat("Slowest", secs.maxOrNull() ?: 0, Color(0xFFEF4444))
            }
        }
    }
}

@Composable
private fun TimeStat(label: String, seconds: Int, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = color, letterSpacing = 0.4.sp)
        SoftNumber(fmtTime(seconds), 16.sp)
    }
}

// ── When you play (time-of-day) ──────────────────────────────────────────────────
@Composable
private fun WhenYouPlayCard(hours: List<com.wordocious.app.data.MatchStatsService.HourBucket>) {
    val maxPlayed = (hours.maxOfOrNull { it.played } ?: 1).coerceAtLeast(1)
    val peak = hours.maxByOrNull { it.played }?.takeIf { it.played > 0 }
    // Tap an hour -> "8am · 65 games · 52 wins" instead of the peak line (iOS parity).
    var selected by remember { mutableStateOf<Int?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("WHEN YOU PLAY")
        Column(
            Modifier.fillMaxWidth().statsSurface().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(Modifier.fillMaxWidth().height(40.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
                hours.forEach { h ->
                    val alpha = if (h.played == 0) 0.08f else 0.2f + (h.played.toFloat() / maxPlayed) * 0.8f
                    Box(
                        Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(2.dp)).background(WTheme.primary.copy(alpha = alpha))
                            .then(if (selected == h.hour) Modifier.border(1.5.dp, Color(0xFF7C3AED), RoundedCornerShape(2.dp)) else Modifier)
                            .squishClickable { selected = if (selected == h.hour || h.played == 0) null else h.hour },
                    )
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf("12a", "6a", "12p", "6p", "12a").forEach {
                    Text(it, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
            val sel = selected?.let { si -> hours.firstOrNull { it.hour == si && it.played > 0 } }
            if (sel != null) {
                Text(
                    "${hourLabelLower(sel.hour)} · ${sel.played} game${if (sel.played == 1) "" else "s"} · ${sel.won} win${if (sel.won == 1) "" else "s"}",
                    fontSize = 11.sp, fontWeight = FontWeight.Black, color = purpleTextInk,
                )
            } else if (peak != null) {
                Text("Peak: ${hourLabelLower(peak.hour)} · ${peak.played} games", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
    }
}

// ── Top words ────────────────────────────────────────────────────────────────────
@Composable
private fun TopWordsCard(words: List<com.wordocious.app.data.MatchStatsService.TopWord>) {
    val maxCount = (words.maxOfOrNull { it.count } ?: 1).coerceAtLeast(1)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("TOP WORDS")
        Column(
            Modifier.fillMaxWidth().statsSurface().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            words.forEachIndexed { i, w ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).stripedRow(i, Color(0xFF7C3AED), first = true).padding(horizontal = 6.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("${i + 1}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, modifier = Modifier.width(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        w.word.take(7).forEach { ch ->
                            Box(Modifier.size(18.dp).miniGameCard(Color(0xFF7C3AED), 4.dp), Alignment.Center) {
                                Text(ch.toString(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else FinishInk.softNumber)
                            }
                        }
                    }
                    Box(Modifier.weight(1f).height(6.dp), contentAlignment = Alignment.CenterStart) {
                        Box(Modifier.fillMaxWidth((w.count.toFloat() / maxCount).coerceIn(0.04f, 1f)).height(6.dp).clip(RoundedCornerShape(3.dp)).background(WTheme.primary.copy(alpha = 0.25f)))
                    }
                    Text("${w.count}x", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                    Text("${if (w.count > 0) w.wins * 100 / w.count else 0}%", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.width(34.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
                }
            }
        }
    }
}

// ── Pro Insights (per-mode, Pro-only; the call site gates on isProActive — free
// users see no card here, the blurred Deep Insights section is the one Pro gate) ──
@Composable
private fun ProInsightsCard(s: com.wordocious.app.data.MatchStatsService.ProInsights, gameMode: String? = null) {
    val gold = Color(0xFFD97706)
    // The fewest-guesses cell reads through the mode's guess semantics (More
    // Games §18): a Sudoku best of guess_count 1 is "Fewest Mistakes · 0 mistakes",
    // never "Fewest Guesses · 1". Word modes keep today's bare number.
    val meta = gameMode?.let { com.wordocious.app.ModeGen.byDbKey(it) }
    val semantics = meta?.guessSemantics ?: "guesses"
    val fewestLabel = com.wordocious.app.data.ModeStats.fewestRecordLabel(semantics)
    fun fewestValue(v: Int): String = if (semantics == "guesses") "$v" else formatGuessStat(semantics, meta?.guessBase ?: 1, v)
    // Avg guesses / first-try rate / lucky word / nemesis are word-game facts (web parity:
    // panels.topWords). Founder, 2026-10-01: Sudocious and Starsweep showed a board of digits
    // as their "Lucky Word".
    val wordFacts = gameMode == null || com.wordocious.app.data.ModeStats.statPanels(gameMode, semantics).topWords
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("PRO INSIGHTS")
        Column(
            Modifier.fillMaxWidth().statsSurface(StatsInk.GOLD, bar = Color(0xFFF5A524)).padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (!s.hasData) {
                // A7: a cast pose other than D (the Stats host).
                Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    CastPose(StatsPoses.proInsights.id, StatsPoses.proInsights.pose, 90.dp)
                    Text(Mascots.statsEmptyLine, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted, textAlign = TextAlign.Center)
                }
            } else {
                val cells = buildList<Triple<String, String, Any>> {
                    // The four base cells always render — an em dash where the
                    // metric is missing, so the 2×2 grid never reflows (iOS).
                    add(Triple("Fastest Win", s.fastestTime?.let { fmtTime(it) } ?: "—", Icons.Filled.Bolt))
                    add(Triple(fewestLabel, s.fewestGuesses?.let { fewestValue(it) } ?: "—", Icons.Filled.TrackChanges))
                    add(Triple("Perfect Games", "${s.perfectGames}", Icons.Filled.Star))
                    add(Triple("Consistency", if (s.consistencySample >= 3) "${s.consistency}" else "—", Icons.Filled.TrackChanges))
                    if (s.currentStreak > 0) add(Triple("Win Streak", "${s.currentStreak}", Icon3DName.FLAME))
                    if (wordFacts && s.avgGuesses > 0) add(Triple("Avg Guesses", fmtG(s.avgGuesses), Icons.Filled.TrackChanges))
                    if (wordFacts && s.firstTryRate > 0) add(Triple("First Try Rate", "${s.firstTryRate}%", Icons.Filled.Star))
                    s.peakHour?.let { add(Triple("Peak Hour", hourLabelUpper(it), Icons.Filled.Bolt)) }
                    if (wordFacts) s.luckyWord?.let { add(Triple("Lucky Word", it, Icons.Filled.Star)) }
                }
                cells.chunked(2).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { (label, value, icon) -> ProStatCell(label, value, icon, gold, Modifier.weight(1f)) }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
                if (wordFacts && s.nemesisWord != null && s.nemesisLosses >= 2) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_skull), null, tint = gold, modifier = Modifier.size(15.dp))
                        Text("Nemesis: ", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                        Text(s.nemesisWord, fontSize = 12.sp, fontWeight = FontWeight.Black, color = gold)
                        Spacer(Modifier.weight(1f))
                        Text("Lost ${s.nemesisLosses}×", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                }
                if (s.vsTotal > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon3D(Icon3DName.TROPHY, 18.dp)
                        Text("VS Record", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                        Spacer(Modifier.weight(1f))
                        Text("${s.vsWins}W · ${s.vsLosses}L · ${s.vsWinRate}%", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    }
                }
                if (s.recentAvg > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(if (s.improving) "↓" else "↑", fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (s.improving) WTheme.correct else Color(0xFFEF4444))
                        Text(if (s.improving) "Trending faster" else "Trending slower", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                        Spacer(Modifier.weight(1f))
                        Text("${kotlin.math.abs(s.percentChange)}% · last 10 avg ${fmtTime(s.recentAvg)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProStatCell(label: String, value: String, icon: Any, color: Color, modifier: Modifier = Modifier) {
    Row(
        modifier.tintedPill(color).padding(start = 10.dp, end = 10.dp, top = 12.dp, bottom = 9.dp)
            .semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // An ImageVector, or a 3D set icon (HEADER_SPEC §2: the win streak's flame).
        when (icon) {
            is Icon3DName -> Icon3D(icon, 18.dp)
            is ImageVector -> Icon(icon, null, tint = color, modifier = Modifier.size(16.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            FitSoftNumber(value, 16.sp)
            Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.3.sp, color = if (WTheme.isDark) WTheme.textMuted else darkenInk(color))
        }
    }
}

// ── Pro Stats (global "All" view, Pro-gated) ───────────────────────────────────────
@Composable
private fun ProStatsCard(stats: List<ProfileService.UserStat>, isPro: Boolean, onGoPro: () -> Unit) {
    data class Bar(val label: String, val winRate: Int, val avgTime: Int)
    // Every daily mode the catalog knows, in catalog order (a More Games title
    // only earns a bar once it has games); the short labels keep the legacy
    // abbreviations and fall back to the catalog shortTitle.
    val order = PICKER_MODES
    val shortLabel = mapOf("DUEL" to "Classic", "QUORDLE" to "Quad", "OCTORDLE" to "Octo", "SEQUENCE" to "Succ",
        "RESCUE" to "Deliv", "DUEL_6" to "Six", "DUEL_7" to "Seven", "GAUNTLET" to "Gaunt", "PROPERNOUNDLE" to "Proper")
    val bars = order.mapNotNull { m ->
        val rows = stats.filter { it.gameMode == m }
        val games = rows.sumOf { it.totalGames }
        if (games == 0) return@mapNotNull null
        val wins = rows.sumOf { it.wins }
        val weighted = rows.sumOf { it.averageTime * it.totalGames }
        Bar(shortLabel[m] ?: com.wordocious.app.ModeGen.byDbKey(m)?.shortTitle ?: m, wins * 100 / games, weighted / games)
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel("PRO STATS")
        Column(
            Modifier.fillMaxWidth().statsSurface(StatsInk.GOLD, bar = Color(0xFFF5A524)).padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (!isPro) {
                ProLockedTeaser("Pro Feature", onGoPro)
            } else if (bars.isEmpty()) {
                // A7: a cast pose other than D (the Stats host).
                Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    CastPose(StatsPoses.proStats.id, StatsPoses.proStats.pose, 90.dp)
                    Text(Mascots.statsEmptyLine, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted, textAlign = TextAlign.Center)
                }
            } else {
                Text("Win Rate by Mode", fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else FinishInk.heading)
                bars.forEach { b -> ProBarRow(b.label, "${b.winRate}%", b.winRate.toFloat() / 100f, Color(0xFFFACC15)) }
                Text("Avg Solve Time by Mode", fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else FinishInk.heading)
                val maxT = (bars.maxOfOrNull { it.avgTime } ?: 1).coerceAtLeast(1)
                bars.forEach { b -> ProBarRow(b.label, fmtTime(b.avgTime), b.avgTime.toFloat() / maxT, Color(0xFFA78BFA)) }
            }
        }
    }
}

@Composable
private fun ProBarRow(label: String, value: String, frac: Float, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FitText(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textSecondary, modifier = Modifier.width(72.dp))
        Box(Modifier.weight(1f).height(16.dp), contentAlignment = Alignment.CenterStart) {
            Box(Modifier.fillMaxWidth().height(16.dp).clip(RoundedCornerShape(5.dp)).background(color.copy(alpha = 0.16f)))
            Box(Modifier.fillMaxWidth(frac.coerceIn(0.02f, 1f)).height(16.dp).clip(RoundedCornerShape(5.dp)).background(Brush.horizontalGradient(listOf(color.copy(alpha = 0.75f), color))))
        }
        Text(value, fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text, modifier = Modifier.width(48.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
    }
}

/** Frosted locked teaser — lock glyph + label + Upgrade-to-Pro button (iOS locked overlay). */
@Composable
private fun ProLockedTeaser(label: String, onGoPro: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon3D(Icon3DName.LOCK, 32.dp) // ART_SPEC §5
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted)
        // A8: the upgrade action is an amber candy button with the 3D crown.
        CandyButton(
            "Upgrade to Pro", onGoPro, color = CandyColor.AMBER, size = CandySize.MEDIUM,
            leading = { Icon3D(Icon3DName.CROWN, 18.dp) },
        )
    }
}

/** "1m 23s" / "45s" — matches iOS fmt(seconds). */
private fun fmtTime(s: Int): String = if (s < 60) "${s}s" else "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
private fun fmtG(v: Double): String = if (v == v.toInt().toDouble()) "${v.toInt()}" else "$v"
/** "1am" / "12pm" lower (WhenYouPlay peak). */
private fun hourLabelLower(h: Int): String { val am = h < 12; val t = if (h % 12 == 0) 12 else h % 12; return "$t${if (am) "am" else "pm"}" }
/** "1 PM" / "12 AM" upper (Pro Insights peak hour). */
private fun hourLabelUpper(h: Int): String { val ampm = if (h >= 12) "PM" else "AM"; val h12 = if (h == 0) 12 else if (h > 12) h - 12 else h; return "$h12 $ampm" }

// (modeLabel — the mode's display title for a matches.game_mode key — is in RecentMatches.kt.)
