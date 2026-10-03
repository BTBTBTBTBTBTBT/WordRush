package com.wordocious.app.ui


import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.data.LeaderboardService
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.async
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch

/**
 * Records screen — ported from web /records/page.tsx. The GLOBAL views only:
 * Daily tab: mode-picker + leaderboard (reuses LeaderboardService)
 * All-time tab: Hall of Fame 2x2 grid (longest streak, highest level, most medals, most completions)
 * Your own records live on the Stats tab (D2 step 3, YourRecords.kt); the
 * shared record table (RECORD_CFG / recordCfgFor) lives there too.
 * FINISH_SPEC A6 / C2: the RECORDS headline, the shared game picker, tinted cards,
 * striped rows, soft numbers and the W / L column — the Leaderboard's family.
 */
@Composable
fun RecordsScreen(onOpenProfile: (String) -> Unit = {}, onOpenStats: () -> Unit = {}) {
    var tab by remember { mutableIntStateOf(0) }
    val isAuthenticated by AuthService.isAuthenticated.collectAsState()

    // Signed-out gate (iOS RecordsTab): the whole tab is a crown placeholder +
    // Sign in (A8: the large purple candy button) — guests never see the boards.
    if (!isAuthenticated) {
        Column(
            Modifier.fillMaxSize().pageBackground(PageTint.LEADERBOARD).padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.weight(1f))
            Icon3D(Icon3DName.CROWN, 64.dp)
            Text(
                "Sign in to see records", fontSize = 18.sp, fontWeight = FontWeight.Black, color = lbNameInk(),
                textAlign = TextAlign.Center,
            )
            Text(
                "Daily rankings and the all-time hall of records are available to signed-in players.",
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = lbSubInk(),
                textAlign = TextAlign.Center,
            )
            CandyButton(
                "Sign in", onClick = { AuthService.exitGuest() },
                color = CandyColor.PURPLE, size = CandySize.LARGE,
                modifier = Modifier.padding(top = 4.dp),
            )
            Spacer(Modifier.weight(1f))
        }
        return
    }

    // Each view keeps its own game pick across Daily ↔ All-Time switches (the views are
    // disposed on a switch, so the picks live here; web records page parity).
    var dailyMode by remember { mutableStateOf("DUEL") }
    var allTimeMode by remember { mutableStateOf("DUEL") }
    Column(
        modifier = Modifier.fillMaxSize().pageBackground(PageTint.LEADERBOARD),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // The RECORDS headline + the game picker (with the Daily | All-Time switch in its
        // header) top each view's own scroll, so they scroll away with the content.
        Box(Modifier.weight(1f)) {
            when (tab) {
                0 -> DailyRecordsTab(onOpenProfile, onTab = { tab = it }, initialMode = dailyMode, onModeChange = { dailyMode = it })
                1 -> AllTimeTab(onOpenProfile, onTab = { tab = it }, initialMode = allTimeMode, onModeChange = { allTimeMode = it })
            }
        }
        // D2 step 3 (2026-09-26): your own records live on the Stats tab now (A8: a quiet candy button).
        CandyButton(
            "Your personal records", onClick = onOpenStats,
            color = CandyColor.PEACH, size = CandySize.SMALL, trailing = "›",
            contentDescription = "Your personal records, on Stats",
            modifier = Modifier.padding(vertical = 8.dp),
        )
    }
}

@Composable
private fun DailyRecordsTab(
    onOpenProfile: (String) -> Unit = {},
    onTab: (Int) -> Unit = {},
    initialMode: String = "DUEL",
    onModeChange: (String) -> Unit = {},
) {
    val userId = AuthService.profile.value?.id
    var selectedMode by remember { mutableStateOf(initialMode) }
    var playType by remember { mutableStateOf("solo") }
    // FRIENDS (§207, web records parity): Everyone | Friends — the same board query
    // restricted to friends ∪ me, dense ranks, no rank window. friendsVersion re-keys
    // the fetch when the FriendsService cache changes (Leaderboard tab parity).
    var friendsOnly by remember { mutableStateOf(false) }
    var friendsVersion by remember { mutableStateOf(FriendsService.version) }
    LaunchedEffect(userId) { if (userId != null) FriendsService.load() }
    androidx.compose.runtime.DisposableEffect(Unit) {
        val remove = FriendsService.addListener { friendsVersion = FriendsService.version }
        onDispose { remove() }
    }
    /** The board's cache key: the Solo|VS key, plus ":friends" on the Friends board. */
    fun boardKey(mode: String, day: String, pt: String, friends: Boolean) =
        LeaderboardService.cacheKey(mode, day, userId, pt) + if (friends && userId != null) ":friends" else ""
    // First frame paints the (disk-backed) cached board, not a skeleton the fetch effect
    // replaces a frame later (founder, 2026-09-29 — LeaderboardScreen parity).
    val seedBoard = remember {
        LeaderboardService.cachedBoard(LeaderboardService.cacheKey(selectedMode, com.wordocious.app.todayLocalDate(), userId, playType))
    }
    var entries by remember { mutableStateOf(seedBoard?.entries ?: emptyList()) }
    var playerCount by remember { mutableIntStateOf(seedBoard?.playerCount ?: 0) }
    var userRank by remember { mutableStateOf(seedBoard?.rank) }
    // "Your neighborhood" rows when the user placed past the top-50 list.
    var rankWindow by remember { mutableStateOf(seedBoard?.rankWindow) }
    var loading by remember { mutableStateOf(seedBoard == null) }
    // Daily Sweep board (10th "Sweep" tile) — RPC path, mirrors LeaderboardScreen.
    val isSweep = selectedMode == SWEEP_ID
    var sweepEntries by remember { mutableStateOf<List<LeaderboardService.SweepEntry>>(emptyList()) }
    var sweepRank by remember { mutableStateOf<LeaderboardService.RankInfo?>(null) }
    // §232: dot-strip + guess/hint detail — daily-board parity (founder ask,
    // Aug 24): Records' sweep rows must read like the leaderboard's §223 rows.
    var sweepDetails by remember { mutableStateOf<Map<String, LeaderboardService.SweepDetails>>(emptyMap()) }
    // §248: current flawless streaks for FLAWLESS rows.
    var flawlessStreaks by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }

    // Re-fetch once a daily result row has LANDED on the server (recordedTick)
    // so a finished puzzle appears here immediately, without a tab round-trip
    // (the optimistic completionTick fires before the insert and cached stale).
    // L1/L2/L3 (mirrors LeaderboardScreen): session cache paints instantly,
    // rows + count fetch in parallel and paint immediately, rank fills in
    // after without blocking, and a failed fetch keeps whatever is showing.
    val tick by com.wordocious.app.data.DailyCompletionsService.recordedTick.collectAsState()

    // A mode or Solo|VS tap paints that board's cached rows, count and rank in the SAME update as
    // the selection (founder, 2026-09-29; LeaderboardScreen.selectMode / iOS 3edd33c2 parity): the
    // cache was only read inside the fetch effect below, a frame later, so the tap frame drew the
    // new header over the previous mode's rows and count. No cached copy → the skeleton at once.
    // Sweep paints the shared sweep cache the Leaderboard tab keeps. The fetch is unchanged.
    fun paintCachedBoard(mode: String, pt: String, friends: Boolean = friendsOnly) {
        val day = com.wordocious.app.todayLocalDate()
        if (mode == SWEEP_ID) {
            val c = LeaderboardService.cachedSweep(LeaderboardService.sweepCacheKey(day))
            sweepEntries = c?.entries ?: emptyList()
            sweepRank = c?.rank
            sweepDetails = c?.details ?: emptyMap()
            playerCount = c?.entries?.size ?: 0
            loading = c == null
            return
        }
        val c = LeaderboardService.cachedBoard(boardKey(mode, day, pt, friends))
        entries = c?.entries ?: emptyList()
        playerCount = c?.playerCount ?: 0
        userRank = c?.rank
        rankWindow = c?.rankWindow
        loading = c == null
    }
    fun select(mode: String = selectedMode, pt: String = playType, friends: Boolean = friendsOnly) {
        if (mode == selectedMode && pt == playType && friends == friendsOnly) return
        selectedMode = mode
        playType = pt
        friendsOnly = friends
        onModeChange(mode)
        paintCachedBoard(mode, pt, friends)
    }

    LaunchedEffect(selectedMode, playType, tick, friendsOnly, friendsVersion) {
        val mode = selectedMode
        val pt = playType
        val day = com.wordocious.app.todayLocalDate()
        // Daily Sweep board takes its own RPC path (play-type is irrelevant) —
        // kept ahead of the per-mode fetch so `daily_results` never sees SWEEP.
        if (mode == SWEEP_ID) {
            // Cached sweep rows (painted by select()) stay up while this refetches.
            if (LeaderboardService.cachedSweep(LeaderboardService.sweepCacheKey(day)) == null) loading = true
            val rows = LeaderboardService.fetchDailySweepOrNull(day)
            ensureActive()
            if (rows == null) { loading = false; return@LaunchedEffect }
            sweepEntries = rows
            playerCount = rows.size
            loading = false
            // §232: the dot strip + guess/hint totals land AFTER the rows paint
            // (LeaderboardScreen parity) — the board never waits on the detail
            // query, and a fetch failure just leaves plain rows.
            val details = LeaderboardService.fetchSweepModeDetails(day, rows.map { it.userId })
            ensureActive()
            sweepDetails = details
            // §248: only rows already FLAWLESS can be on a live streak.
            flawlessStreaks = LeaderboardService.fetchFlawlessStreaks(day, rows.filter { it.isFlawless }.map { it.userId })
            ensureActive()
            sweepRank = if (userId != null) LeaderboardService.getUserSweepRank(userId, day) else null
            ensureActive()
            return@LaunchedEffect
        }
        // Stale-while-revalidate: a chip/toggle tap or screen re-entry paints the
        // last-known rows instantly; the skeleton only shows on a true first load.
        val friends = friendsOnly && userId != null
        val key = boardKey(mode, day, pt, friends)
        val cached = LeaderboardService.cachedBoard(key)
        if (cached != null) {
            entries = cached.entries
            playerCount = cached.playerCount
            userRank = cached.rank
            rankWindow = cached.rankWindow
            loading = false
        } else {
            loading = true
            entries = emptyList()
            userRank = null
            rankWindow = null
        }
        // Friends board (web records parity): one fetch restricted to friends ∪ me holds
        // the whole board; the rank is the dense index, no count query or rank window.
        if (friends) {
            val ids = (FriendsService.friendIds + userId!!.lowercase()).toList()
            val lbF = LeaderboardService.fetchDailyLeaderboardOrNull(mode, pt, day = day, userIds = ids)
            ensureActive()
            if (lbF == null) { loading = false; return@LaunchedEffect }
            entries = lbF
            playerCount = lbF.size
            loading = false
            val idx = lbF.indexOfFirst { it.userId == userId }
            val rank = if (idx >= 0) LeaderboardService.RankInfo(idx + 1, lbF.size) else null
            userRank = rank
            rankWindow = null
            LeaderboardService.cacheBoard(key, LeaderboardService.CachedBoard(lbF, lbF.size, rank, null))
            return@LaunchedEffect
        }
        // Rows + "{n} players today" in parallel — paint the rows the moment they
        // land; the rank line fills in on its own instead of holding the list.
        val (lbOpt, count) = kotlinx.coroutines.coroutineScope {
            val lbD = async { LeaderboardService.fetchDailyLeaderboardOrNull(mode, pt, day = day) }
            val countD = async { LeaderboardService.playerCount(mode) }
            lbD.await() to countD.await()
        }
        // Race guard: a mode/toggle switch cancels this effect; never let a late
        // response from the old selection overwrite the new selection's rows.
        ensureActive()
        // Network error (null, not an empty day): keep whatever is showing —
        // cached rows beat clobbering them with a blank list; never cache the failure.
        if (lbOpt == null) { loading = false; return@LaunchedEffect }
        val lb = lbOpt
        entries = lb
        playerCount = count
        loading = false
        val rank = if (userId != null) {
            LeaderboardService.getUserDailyRank(userId, mode, pt, day = day, topEntries = lb)
        } else null
        ensureActive()
        userRank = rank
        // Ranked past the visible list → also fetch the rows around them.
        val win = if (rank != null && rank.rank > 50) {
            LeaderboardService.fetchRankWindow(mode, pt, userRank = rank.rank, day = day)
        } else null
        ensureActive()
        rankWindow = win
        LeaderboardService.cacheBoard(key, LeaderboardService.CachedBoard(lb, count, rank, win))
    }

    // GUARDED: SWEEP has no `:core` GameMode → the sweep gold; a game takes its catalog accent.
    val accent = if (isSweep) LB_SWEEP_GOLD else (modeCardForKey(selectedMode)?.accent ?: Color(0xFF7C3AED))

    // LEADERBOARD SHARE — today's board card (Solo or VS per the toggle).
    val shareContext = androidx.compose.ui.platform.LocalContext.current
    val shareScope = androidx.compose.runtime.rememberCoroutineScope()
    var sharingLb by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = LB_SIDE)) {
        Spacer(Modifier.height(4.dp))
        RecordsBanner(daily = true, onDaily = { if (!it) onTab(1) }, selected = selectedMode, onSelect = { select(mode = it) }, bleed = LB_SIDE)
        Spacer(Modifier.height(LB_CARD_GAP))
        // Per-game board card (the play-card family, A1): the game's title art, the player
        // count, the bare share icon, then the Solo | VS and Everyone | Friends toggles (both
        // meaningless for the composite Sweep board — hidden there). This view owns the
        // Solo/VS toggle, so its share is where the VS Battle card comes from.
        LbTintedCard(accent) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (isSweep) ModeIconBox(SWEEP_ID, accent, box = 44.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    RecordsGameTitle(selectedMode, if (isSweep) "Daily Sweep" else recModeTitle(selectedMode))
                    val noun = if (isSweep) "sweeper" else "player"
                    Text(
                        "$playerCount $noun${if (playerCount == 1) "" else "s"} today" +
                            if (isSweep) " · all ${com.wordocious.app.ModeGen.sweep.size} modes" else "",
                        fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = lbSubInk(), maxLines = 1,
                    )
                }
                if (!isSweep && !loading && entries.isNotEmpty()) {
                    SoftControl(
                        Icon3DName.SHARE, contentDescription = "Share leaderboard",
                        alpha = if (sharingLb) 0.4f else 1f,
                        onClick = {
                            if (!sharingLb) {
                                sharingLb = true
                                shareScope.launch {
                                    try {
                                        com.wordocious.app.data.LeaderboardShare.shareDailyLeaderboardCard(
                                            shareContext, selectedMode, playType,
                                            entries, rankWindow, userId, userRank,
                                            friends = friendsOnly && userId != null,
                                        )
                                    } finally { sharingLb = false }
                                }
                            }
                        },
                    )
                }
            }
            // Solo | VS + Everyone | Friends (per-mode only — Sweep is solo-only, cross-mode).
            if (!isSweep) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    SoftSegment(listOf("solo" to "Solo", "vs" to "VS"), playType) { select(pt = it) }
                    if (userId != null) {
                        SoftSegment(listOf(false to "Everyone", true to "Friends"), friendsOnly) { select(friends = it) }
                    }
                }
            }
        }
        Spacer(Modifier.height(LB_CARD_GAP))
        // Your rank (+ percentile and the records-daily movement badge) — the Leaderboard's
        // ONE gold result card (C2): crown, rank, how you solved it, points.
        (if (isSweep) sweepRank else userRank)?.let { r ->
            val mine = (entries + (rankWindow?.entries ?: emptyList())).firstOrNull { it.userId == userId }
            val mySweep = sweepEntries.firstOrNull { it.userId == userId }
            val myPoints = if (isSweep) mySweep?.totalScore else mine?.compositeScore
            UserRankCard(
                rank = r.rank, total = r.totalPlayers, mode = selectedMode, points = myPoints,
                friends = friendsOnly && !isSweep && userId != null,
                // A friend rank keeps its own movement memory — never compared to a global rank (§207).
                playType = playType, pageKey = if (friendsOnly && !isSweep) "records-daily-friends" else "records-daily",
                showTopPercent = true, showDelta = !isSweep,
                solvedLine = if (isSweep) mySweep?.let { sweepSolvedLine(it.isFlawless, it.modesWon, it.totalTime, com.wordocious.app.todayLocalDate()) }
                    else mine?.takeIf { playType != "vs" }?.let { solvedLine(selectedMode, it.completed, it.guessCount, it.timeSeconds, it.boardsSolved, it.totalBoards) },
            )
            Spacer(Modifier.height(LB_CARD_GAP))
        }
        // §254: the completed-daily dropdown (your board, tinted), mounted exactly as the
        // Leaderboard tab mounts it — the founder wants Records to mirror that page. The
        // card renders nothing for a mode not yet played; Sweep has no board.
        if (selectedMode != SWEEP_ID) {
            com.wordocious.app.ui.game.CompletedDailyBoard(selectedMode)
        }
        LbSectionLabel("TODAY’S BOARD", Modifier.padding(start = 4.dp, bottom = 8.dp).semantics { heading() })
        Column(Modifier.lbBoardCard()) {
            if (loading) {
                // Web parity: animate-pulse skeleton rows, not a spinner.
                Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) { LeaderboardSkeleton() }
            } else if (isSweep) {
                if (sweepEntries.isEmpty()) {
                    // An empty board gets R asleep (ART_SPEC §7 scene).
                    BrandEmptyState(
                        title = "NO SWEEPS YET", line = "Finish all of today's dailies to land on this board.",
                        scene = SceneArt.ASLEEP, lineColor = lbSubInk(),
                    )
                } else {
                    // TIE-AWARE score display (daily-board parity).
                    val sweepScoreLabels = tieAwareScoreLabels(sweepEntries.map { it.totalScore })
                    sweepEntries.forEachIndexed { i, entry ->
                        // §232: pass the per-user details + day so the words-not-
                        // codes stats, dot strip, and pill render here too.
                        SweepRow(
                            rank = i + 1, entry = entry, isCurrentUser = entry.userId == userId,
                            onOpenProfile = onOpenProfile, scoreLabel = sweepScoreLabels[entry.totalScore],
                            details = sweepDetails[entry.userId],
                            day = com.wordocious.app.todayLocalDate(),
                            flawlessStreak = flawlessStreaks[entry.userId] ?: 0,
                            index = i,
                        )
                    }
                }
            } else if (entries.isEmpty()) {
                // Web parity (records page): an empty board gets R asleep (ART_SPEC §7 scene).
                BrandEmptyState(
                    title = "NO RESULTS YET",
                    line = if (friendsOnly && userId != null) "None of your friends have played yet today." else "Nobody has finished this daily yet. Be the first!",
                    scene = SceneArt.ASLEEP, lineColor = lbSubInk(),
                )
            } else {
                // iOS's Records row is the same guesses/time + W/L line for Solo and VS
                // (dailyRow has no playType branch) — keep the solo detail rather than
                // LeaderboardRow's W/G tally.
                // TIE-AWARE score display (daily-board parity) — the rank window
                // is part of the same board, so it joins the collision set.
                val lbScoreLabels = tieAwareScoreLabels(
                    entries.map { it.compositeScore } + (rankWindow?.entries?.map { it.compositeScore } ?: emptyList()),
                )
                entries.forEachIndexed { i, entry ->
                    LeaderboardRow(rank = i + 1, entry = entry, mode = selectedMode, isCurrentUser = entry.userId == userId, onOpenProfile = onOpenProfile, showHints = true, scoreLabel = lbScoreLabels[entry.compositeScore], index = i)
                }
                // "Your neighborhood" — rows around the user's rank when they
                // placed past the top 50 (web/iOS parity).
                rankWindow?.let { win ->
                    NeighborhoodGap()
                    win.entries.forEachIndexed { i, entry ->
                        LeaderboardRow(rank = win.startRank + i, entry = entry, mode = selectedMode, isCurrentUser = entry.userId == userId, onOpenProfile = onOpenProfile, showHints = true, scoreLabel = lbScoreLabels[entry.compositeScore], index = i, topRule = true)
                    }
                }
            }
        }
        // Yesterday's podium sits below the board card and shows even when today's
        // board is still empty (iOS DailyRecordsView).
        if (!isSweep) YesterdayPodium(selectedMode, playType, userId, onOpenProfile)
        Spacer(Modifier.height(24.dp))
    }
}

/**
 * The game's title art (§10) filling the card's text column (up to 52 dp tall), else
 * the name as text — the Records cards' header line.
 */
@Composable
private fun RecordsGameTitle(mode: String, label: String) {
    val titleArt = if (mode == SWEEP_ID) null else gameTitleArtResForKey(mode)
    if (titleArt != null) {
        FittedGameTitleArt(
            titleArt, label,
            maxHeight = GAME_TITLE_ART_CARD_HEIGHT, alignment = Alignment.CenterStart, heading = false,
        )
    } else Text(
        label, fontSize = 18.sp, fontWeight = FontWeight.Black, color = lbNameInk(),
        maxLines = 1, overflow = TextOverflow.Ellipsis,
    )
}

/**
 * A game's 3D icon as a mini game card (A1 `.gi`): the game's glossy icon (the broom for
 * the Sweep) on its accent wash; a game without art keeps its glyph.
 */
@Composable
internal fun ModeIconBox(mode: String, accent: Color, box: androidx.compose.ui.unit.Dp = 32.dp) {
    val art = if (mode == SWEEP_ID) com.wordocious.app.R.drawable.game_sweep
        else gameArtRes(com.wordocious.app.ModeGen.byDbKey(mode)?.id)
    Box(Modifier.size(box).miniGameCard(accent, box / 4), contentAlignment = Alignment.Center) {
        if (art != null) {
            Image(painterResource(art), null, modifier = Modifier.size(box * 0.74f).padding(top = 2.dp))
        } else {
            pickerGameModeOrNull(mode)?.let { ModeGlyph(it, accent, box = box) }
        }
    }
}

/** Session copy of Records' Yesterday's podium per (yesterday, mode, play type) — paint-only. */
private val RecordsPodiumCache = mutableMapOf<String, List<LeaderboardService.LeaderboardEntry>>()

/** Yesterday's top-3 for the mode (collapsible) — the Leaderboard's YESTERDAY'S WINNERS card:
 *  one cream card, caps header with chevron + bare share, striped board rows (stats, avatars,
 *  the W / L column). */
@Composable
private fun YesterdayPodium(mode: String, playType: String, userId: String?, onOpenProfile: (String) -> Unit) {
    // Keyed on the selection and seeded from the session copy (yesterday is settled), so a mode or
    // Solo|VS switch never shows the previous mode's podium under the new header (founder, 2026-09-29).
    val podiumKey = "${com.wordocious.app.yesterdayLocalDate()}:records:$mode:$playType"
    var top3 by remember(mode, playType) { mutableStateOf(RecordsPodiumCache[podiumKey] ?: emptyList()) }
    var open by remember { mutableStateOf(false) }
    // iOS rotates the chevron 180° with an animation instead of swapping ▲/▼ (instant with Reduce Motion).
    val chevronRotation by animateFloatAsState(
        if (open) 180f else 0f,
        if (WTheme.reducedMotion) androidx.compose.animation.core.snap() else androidx.compose.animation.core.spring(),
        label = "podiumChevron",
    )
    LaunchedEffect(mode, playType) {
        top3 = LeaderboardService.fetchYesterdayWinners(mode, playType)
        if (top3.isNotEmpty()) RecordsPodiumCache[podiumKey] = top3
    }
    // Settled-podium share (web records YesterdayPodium parity).
    val shareContext = androidx.compose.ui.platform.LocalContext.current
    val shareScope = androidx.compose.runtime.rememberCoroutineScope()
    var sharing by remember { mutableStateOf(false) }
    if (top3.isEmpty()) return
    Spacer(Modifier.height(16.dp))
    Column(Modifier.lbBoardCard()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 14.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                Modifier.weight(1f)
                    .squishClickable(label = "Yesterday's winners, " + if (open) "expanded" else "collapsed") { open = !open }
                    .padding(vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                LbSectionLabel("YESTERDAY’S WINNERS")
                Spacer(Modifier.size(4.dp))
                Icon(
                    Icons.Filled.KeyboardArrowDown, null, tint = if (WTheme.isDark) WTheme.textSecondary else LB_SECTION_INK,
                    modifier = Modifier.size(18.dp).rotate(chevronRotation),
                )
            }
            // Share — only once the podium is open (web parity).
            if (open) {
                SoftControl(
                    Icon3DName.SHARE, contentDescription = "Share yesterday's podium",
                    alpha = if (sharing) 0.4f else 1f,
                    onClick = {
                        if (!sharing) {
                            sharing = true
                            shareScope.launch {
                                try {
                                    com.wordocious.app.data.LeaderboardShare.shareYesterdayPodiumCard(
                                        shareContext, mode, playType, top3, userId,
                                    )
                                } finally { sharing = false }
                            }
                        }
                    },
                )
            }
        }
        if (open) {
            val podiumScoreLabels = tieAwareScoreLabels(top3.map { it.compositeScore })
            top3.forEachIndexed { i, e ->
                LeaderboardRow(
                    // §217: exact (score, time) ties share the rank.
                    rank = LeaderboardService.competitionRank(top3, i),
                    entry = e, mode = mode, isCurrentUser = e.userId == userId,
                    onOpenProfile = onOpenProfile,
                    scoreLabel = podiumScoreLabels[e.compositeScore],
                    index = i, topRule = true,
                )
            }
        }
    }
}

private val GLOBAL_RECORD_TYPES = listOf("longest_streak", "highest_level", "most_gold_medals", "most_daily_completions")
private val PER_MODE_RECORD_TYPES = listOf("fastest_win", "fewest_guesses", "most_games_played", "longest_streak")

@Composable
private fun AllTimeTab(
    onOpenProfile: (String) -> Unit = {},
    onTab: (Int) -> Unit = {},
    initialMode: String = "DUEL",
    onModeChange: (String) -> Unit = {},
) {
    // Re-entering the All-time tab (it is disposed on every Daily ↔ All-time switch) paints the
    // session copy on the first frame instead of the card skeleton (founder, 2026-09-29).
    // BI19: persisted across launches too.
    val seedRecords = remember { com.wordocious.app.data.StatsMemo.getPersisted("allTimeRecords", kotlinx.serialization.builtins.ListSerializer(LeaderboardService.AllTimeRecord.serializer())) }
    var records by remember { mutableStateOf(seedRecords ?: emptyList()) }
    var loading by remember { mutableStateOf(seedRecords == null) }
    var selectedMode by remember { mutableStateOf(initialMode) }
    val userId = AuthService.profile.value?.id
    // All-time sweep ranking — loaded lazily the first time SWEEP is selected.
    val isSweep = selectedMode == SWEEP_ID
    var sweepBoard by remember { mutableStateOf<List<LeaderboardService.AllTimeSweepEntry>?>(null) }
    // Your own all-time sweep standing — iOS shows "Your rank: #N of T" on this card.
    var sweepRank by remember { mutableStateOf<LeaderboardService.RankInfo?>(null) }

    LaunchedEffect(Unit) {
        val fresh = LeaderboardService.fetchAllTimeRecords()
        // A failed fetch returns empty — keep the session copy on screen rather than blanking it.
        if (fresh.isNotEmpty() || seedRecords == null) records = fresh
        if (fresh.isNotEmpty()) com.wordocious.app.data.StatsMemo.setPersisted("allTimeRecords", fresh, kotlinx.serialization.builtins.ListSerializer(LeaderboardService.AllTimeRecord.serializer()))
        loading = false
    }
    LaunchedEffect(isSweep) {
        if (isSweep && sweepBoard == null) {
            sweepBoard = LeaderboardService.fetchAllTimeSweepOrNull() ?: emptyList()
            if (userId != null) sweepRank = LeaderboardService.getUserAllTimeSweepRank(userId)
        }
    }

    val globalRecords = records.filter { it.gameMode == null && it.recordType in GLOBAL_RECORD_TYPES }
    val modeRecords = records.filter { it.gameMode == selectedMode }
    val accent = if (isSweep) LB_SWEEP_GOLD else (modeCardForKey(selectedMode)?.accent ?: Color(0xFF7C3AED))

    LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = LB_SIDE)) {
        item {
            Spacer(Modifier.height(4.dp))
            RecordsBanner(
                daily = false, onDaily = { if (it) onTab(0) },
                selected = selectedMode, onSelect = { selectedMode = it; onModeChange(it) },
                recordCount = if (loading) null else records.size,
                bleed = LB_SIDE,
            )
            Spacer(Modifier.height(16.dp))
        }
        if (loading) {
            // Web parity: AllTimeSkeleton pulsing card blocks, not a spinner.
            item { CardsSkeleton() }
            return@LazyColumn
        }
        // HALL OF FAME — each global record its own tinted gold card, two across.
        item {
            LbSectionLabel("HALL OF FAME", Modifier.padding(start = 4.dp, bottom = 8.dp).semantics { heading() })
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                GLOBAL_RECORD_TYPES.chunked(2).forEach { rowTypes ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        rowTypes.forEach { rt ->
                            val rec = globalRecords.find { it.recordType == rt }
                            HallOfFameCard(
                                rt, rec, LB_GOLD,
                                isCurrentUser = userId != null && rec?.holderId == userId,
                                onOpenProfile = onOpenProfile, modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }
        // BY GAME MODE — only the game picked in the picker: the play-card family header,
        // then its records (or the all-time sweep ranking) in striped rows.
        item {
            Spacer(Modifier.height(20.dp))
            LbSectionLabel(if (isSweep) "SWEEP RANKING" else "BY GAME MODE", Modifier.padding(start = 4.dp, bottom = 8.dp).semantics { heading() })
            LbTintedCard(accent) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (isSweep) ModeIconBox(SWEEP_ID, accent, box = 44.dp)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        // ART_SPEC §10 / §14: the selected game's title art in place of its name text.
                        RecordsGameTitle(selectedMode, if (isSweep) "All-Time Sweeps" else recModeTitle(selectedMode))
                        if (isSweep) {
                            // Sweeper count (iOS sweepCard).
                            val sweepers = sweepRank?.totalPlayers ?: (sweepBoard?.size ?: 0)
                            Text(
                                "$sweepers sweeper${if (sweepers == 1) "" else "s"} · most daily sweeps ever",
                                fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = lbSubInk(), maxLines = 1,
                            )
                        } else {
                            Text("All-time bests", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = lbSubInk())
                        }
                    }
                }
            }
            Spacer(Modifier.height(LB_CARD_GAP))
            if (isSweep) {
                // Your all-time sweep standing — the gold result card.
                sweepRank?.let { r ->
                    UserRankCard(rank = r.rank, total = r.totalPlayers, mode = SWEEP_ID, showDelta = false, totalNoun = "SWEEPERS")
                    Spacer(Modifier.height(LB_CARD_GAP))
                }
            }
            Column(Modifier.lbBoardCard()) {
                if (isSweep) {
                    // All-time sweep ranking — most daily sweeps, tiebreak flawless / best time.
                    val board = sweepBoard
                    when {
                        // Still loading — the same pulsing rows every other board uses.
                        board == null -> Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) { LeaderboardSkeleton() }
                        board.isEmpty() -> BrandEmptyState(
                            title = "NO SWEEPS YET", line = "Sweep every daily in one day to start the all-time board.",
                            scene = SceneArt.ASLEEP, lineColor = lbSubInk(),
                        )
                        else -> board.forEachIndexed { i, e ->
                            AllTimeSweepRow(rank = (e.rank.takeIf { it > 0 }?.toInt()) ?: (i + 1), entry = e, isCurrentUser = userId != null && e.userId == userId, onOpenProfile = onOpenProfile, index = i)
                        }
                    }
                } else if (modeRecords.isEmpty()) {
                    BrandEmptyState(
                        title = "NO RECORDS YET", line = "The first big finish here sets the mark.",
                        scene = SceneArt.ASLEEP, lineColor = lbSubInk(),
                    )
                } else {
                    PER_MODE_RECORD_TYPES.forEachIndexed { i, rt ->
                        val cands = modeRecords.filter { it.recordType == rt }
                        val rec = cands.find { it.playType == "solo" } ?: cands.firstOrNull()
                        RecordRow(rt, rec, accent, isCurrentUser = userId != null && rec?.holderId == userId, onOpenProfile = onOpenProfile, gameMode = selectedMode, index = i)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** §254: " · N hints" / " · No hints" on a hint-mode record cell — the exact
 *  wording the leaderboard rows use, so All-Time and You match them. */
private fun recordHintSuffix(r: LeaderboardService.AllTimeRecord): String {
    val h = r.hintsUsed ?: return ""
    if (r.gameMode?.let { it in HINT_BEARING } != true) return ""
    return if (h > 0) " · $h hint${if (h == 1) "" else "s"}" else " · No hints"
}

/** The record's icon on a mini game card (A1) in [accent] (crown for the medal record). */
@Composable
private fun RecordChip(cfg: RecordCfg, accent: Color, hasRecord: Boolean) {
    val tint = if (hasRecord) accent else Color(0xFF9CA3AF)
    Box(Modifier.size(36.dp).miniGameCard(tint, 10.dp), contentAlignment = Alignment.Center) {
        val icon3d = if (cfg.crown) Icon3DName.CROWN else cfg.icon3d
        if (icon3d != null) {
            Icon3D(icon3d, 22.dp, Modifier.padding(top = 2.dp), alpha = if (hasRecord) 1f else 0.45f, colorFilter = if (hasRecord) null else Icon3DMuted)
        } else cfg.icon?.let { Icon(it, null, tint = if (hasRecord) darkenInk(tint) else WTheme.textMuted, modifier = Modifier.size(18.dp).padding(top = 2.dp)) }
    }
}

/** Holder line: avatar + name (profile tap, squish), a small gold crown on records you hold. */
@Composable
private fun RecordHolder(record: LeaderboardService.AllTimeRecord, isCurrentUser: Boolean, onOpenProfile: (String) -> Unit) {
    val name = record.holderUsername ?: "Unknown"
    Row(
        Modifier.squishClickable(label = "$name's profile") { record.holderId?.let(onOpenProfile) },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        LbAvatar(record.profiles?.avatarUrl, record.profiles?.avatarEmoji, name, size = 22.dp)
        Text(
            name, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold,
            color = if (isCurrentUser) Color(0xFFD97706) else lbNameInk(),
            maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        if (isCurrentUser) Icon3D(Icon3DName.CROWN, 14.dp, contentDescription = "Your record")
    }
}

/** A record's value: soft numbers (A2), or a muted dash when nobody holds it. */
@Composable
private fun RecordValue(text: String?, size: androidx.compose.ui.unit.TextUnit) {
    if (text != null) SoftNumber(text, size)
    else Text("—", fontSize = size, fontWeight = FontWeight.Black, color = lbSubInk(), maxLines = 1)
}

/** HALL OF FAME card (A1 tinted, gold): chip, the record name in caps, the value in soft numbers, the holder. */
@Composable
private fun HallOfFameCard(
    recordType: String, record: LeaderboardService.AllTimeRecord?, accent: Color, isCurrentUser: Boolean,
    onOpenProfile: (String) -> Unit, modifier: Modifier = Modifier,
) {
    val cfg = recordCfgFor(recordType, record?.gameMode) ?: return
    val mine = isCurrentUser && record != null
    TintedCard(
        accent, modifier,
        corner = 16.dp,
        bar = androidx.compose.ui.graphics.SolidColor(accent),
        barHeight = 6.dp,
        tint = accentWash(accent, if (mine) 0.22f else Wash.CARD),
        line = if (mine && !WTheme.isDark) accent else accentLine(accent),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        RecordChip(cfg, accent, record != null)
        Text(
            cfg.label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.08.em,
            color = if (WTheme.isDark) WTheme.textSecondary else LB_LABEL, maxLines = 2, lineHeight = 12.sp,
        )
        RecordValue(record?.let { cfg.format(it.recordValue.toInt()) + recordHintSuffix(it) }, 20.sp)
        if (record != null) RecordHolder(record, isCurrentUser, onOpenProfile)
    }
}

/** One per-game record (striped row): chip, name over holder, the (empty) W / L column, the value. */
@Composable
private fun RecordRow(
    recordType: String, record: LeaderboardService.AllTimeRecord?, accent: Color, isCurrentUser: Boolean,
    onOpenProfile: (String) -> Unit, gameMode: String, index: Int = 0,
) {
    val cfg = recordCfgFor(recordType, gameMode) ?: return
    Row(
        Modifier.lbRow(index, isCurrentUser && record != null),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        RecordChip(cfg, accent, record != null)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                cfg.label.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.08.em,
                color = if (WTheme.isDark) WTheme.textSecondary else LB_LABEL, maxLines = 1,
            )
            if (record != null) RecordHolder(record, isCurrentUser, onOpenProfile)
        }
        // C2a: records carry no W / L, but keep the column so the values line up with the boards.
        ResultBadgeColumn(null)
        RecordValue(record?.let { cfg.format(it.recordValue.toInt()) + recordHintSuffix(it) }, 15.sp)
    }
}
