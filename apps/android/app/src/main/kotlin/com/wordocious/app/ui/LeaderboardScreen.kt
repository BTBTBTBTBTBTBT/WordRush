package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.DailyScoring
import com.wordocious.app.data.FriendTaunts
import com.wordocious.app.data.FriendsService
import com.wordocious.app.data.LeaderboardService
import com.wordocious.app.data.ModerationService
import kotlinx.coroutines.async
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import com.wordocious.app.ui.theme.WTheme

// The picker's daily modes come from the catalog (More Games Stage 4: no second
// hand-typed list); the sweep set first, then the synthetic Sweep entry.
internal val MODE_OPTIONS: List<Pair<String, String>> = com.wordocious.app.ModeGen.sweep.mapNotNull { m -> m.dbKey?.let { it to m.title } } + listOf(
    // Synthetic 10th picker id (NOT a `:core` GameMode) — the Daily Sweep board,
    // shown only on the Leaderboard + Records pickers, never the Home grid.
    SWEEP_ID to "Sweep",
)

/** Synthetic picker id for the Daily Sweep leaderboard. `GameMode.valueOf(SWEEP_ID)`
 *  THROWS — every picker-reachable valueOf must short-circuit on this first. */
internal const val SWEEP_ID = "SWEEP"

/** Synthetic picker id for the "More" chip (More Games §18) — opens the sectioned
 *  More Games list; never a `:core` GameMode, never a leaderboard of its own. */
internal const val MORE_ID = "MORE"

/** §214 (Lindsay): the post-game "View Leaderboard" capsule lands on this
 *  tab with its mode preselected — set before switching tabs, consumed once. */
object LeaderboardDeepLink {
    val pendingMode = androidx.compose.runtime.mutableStateOf<String?>(null)
}
/** Session copy of Yesterday's Winners per (yesterday, mode, All|Friends, user) — the board is
 *  settled, so a mode switch with the dropdown open repaints it at once instead of showing the
 *  previous mode's podium until the refetch lands (founder, 2026-09-29). Paint-only: the effect
 *  still refetches every time, exactly as before. */
private object YesterdayBoards {
    data class Entry(
        val entries: List<LeaderboardService.LeaderboardEntry>,
        val sweep: List<LeaderboardService.SweepEntry>,
        val sweepDetails: Map<String, LeaderboardService.SweepDetails>,
        val flawlessStreaks: Map<String, Int>,
    )
    private val map = mutableMapOf<String, Entry>()
    fun get(key: String): Entry? = map[key]
    fun put(key: String, e: Entry) { map[key] = e }
}

/** The sweep tile's accent — the ONLY place indigo #4F46E5 is used. */
internal val SWEEP_ACCENT = Color(0xFF4F46E5)

/**
 * The `:core` GameMode a picker id maps to, or `null` for the synthetic
 * [SWEEP_ID] (which has no engine mode). This is the single guarded entry point
 * every picker surface must route through — `GameMode.valueOf("SWEEP")` throws
 * IllegalArgumentException, so callers must never hand a raw picker id to it.
 */
internal fun pickerGameModeOrNull(id: String): com.wordocious.core.GameMode? =
    if (id == SWEEP_ID || id == MORE_ID) null
    else runCatching { com.wordocious.core.GameMode.valueOf(id) }.getOrNull()

/**
 * Leaderboard screen — ported from the web /daily page.
 * Shows today's daily leaderboard for a selected game mode with:
 * - Mode picker row, countdown timer
 * - User's current rank card
 * - Top 50 entries with rank badges (🥇🥈🥉 for top 3), username, score, guesses/time
 */
@Composable
fun LeaderboardScreen(onOpenProfile: (String) -> Unit = {}, onPlay: (com.wordocious.core.GameMode) -> Unit = {}, onOpenFriends: () -> Unit = {}, onOpenRecords: () -> Unit = {}) {
    val isAuthenticated by AuthService.isAuthenticated.collectAsState()

    // Signed-out gate (iOS ProfileTab `signedOut`): guests get a trophy
    // placeholder + Sign in instead of the live board.
    if (!isAuthenticated) {
        Column(
            Modifier.fillMaxSize().pageBackground(PageTint.LEADERBOARD).padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.weight(1f))
            Icon3D(Icon3DName.TROPHY, 64.dp)
            Text(
                "Sign in to see rankings", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Text(
                "Daily leaderboards are available to signed-in players.",
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Box(
                Modifier.clip(RoundedCornerShape(12.dp)).background(WTheme.primary)
                    .clickableNoRipple { AuthService.exitGuest() }.padding(horizontal = 32.dp, vertical = 13.dp),
                contentAlignment = Alignment.Center,
            ) { Text("Sign in", color = Color.White, fontWeight = FontWeight.Black, fontSize = 15.sp) }
            Spacer(Modifier.weight(1f))
        }
        return
    }

    val userId = AuthService.profile.value?.id
    // A post-game deep link (§214) picks the first mode directly, so the first frame is that board.
    var selectedMode by remember { mutableStateOf(LeaderboardDeepLink.pendingMode.value ?: "DUEL") }
    // First frame paints the (disk-backed) cached board instead of a skeleton that the fetch
    // effect replaces a frame later (founder, 2026-09-29: no one-frame "page loading in").
    val seedDay = remember { com.wordocious.app.todayLocalDate() }
    val seedBoard = remember {
        if (selectedMode == SWEEP_ID) null
        else LeaderboardService.cachedBoard(LeaderboardService.cacheKey(selectedMode, seedDay, userId))
    }
    val seedSweep = remember {
        if (selectedMode == SWEEP_ID) LeaderboardService.cachedSweep(LeaderboardService.sweepCacheKey(seedDay)) else null
    }
    var fetchedEntries by remember { mutableStateOf(seedBoard?.entries ?: emptyList()) }
    var yesterday by remember { mutableStateOf<List<LeaderboardService.LeaderboardEntry>>(emptyList()) }
    var yesterdaySweep by remember { mutableStateOf<List<LeaderboardService.SweepEntry>>(emptyList()) }
    var showYesterday by remember { mutableStateOf(false) }
    // Yesterday's rows in hand are not for the current mode/filter yet (no cached copy) —
    // the card shows a blank body rather than the previous mode's podium or "No results".
    var yesterdayPending by remember { mutableStateOf(true) }
    var loading by remember { mutableStateOf(seedBoard == null && seedSweep == null) }

    var fetchedPlayerCount by remember { mutableStateOf(seedBoard?.playerCount ?: seedSweep?.entries?.size ?: 0) }
    // Rank banner ("You're ranked #N of M") — web getUserDailyRank parity:
    // true total even past a full page, and a computed rank when the user
    // sits outside the top 50.
    var fetchedUserRank by remember { mutableStateOf(seedBoard?.rank) }
    // "Your neighborhood" rows when the user placed past the top-50 list
    // (e.g. #425 sees ~421–429 below a "···" separator, own row highlighted).
    var rankWindow by remember { mutableStateOf(seedBoard?.rankWindow) }
    // Daily Sweep board (10th "Sweep" tile) — RPC-backed, separate from the
    // per-mode `daily_results` path above. Only populated when SWEEP is selected.
    val isSweep = selectedMode == SWEEP_ID
    var sweepEntries by remember { mutableStateOf(seedSweep?.entries ?: emptyList()) }
    var sweepRank by remember { mutableStateOf(seedSweep?.rank) }
    // §223: per-user dot-strip details (per-mode score/win + guess/hint totals)
    // for today's and yesterday's sweep rows, keyed by user id. A missing entry
    // renders a row without dots or g/h — the detail fetch never blocks a row.
    var sweepDetails by remember { mutableStateOf(seedSweep?.details ?: emptyMap()) }
    // §248: current flawless streaks for FLAWLESS rows.
    var flawlessStreaks by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var ySweepDetails by remember { mutableStateOf<Map<String, LeaderboardService.SweepDetails>>(emptyMap()) }
    var yFlawlessStreaks by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    // Reload when mode changes OR once a daily result row has LANDED on the
    // server (recordedTick) so a just-finished puzzle shows on the board
    // without a tab round-trip. The optimistic completionTick fires BEFORE the
    // insert — keying on it fetched (and cached) the pre-result leaderboard.
    val tick by com.wordocious.app.data.DailyCompletionsService.recordedTick.collectAsState()
    // Today's completions (seeded from the on-device cache) so the Play CTA
    // knows "View vs Play" with no flash, before the rank lands — iOS parity.
    val completionTick by com.wordocious.app.data.DailyCompletionsService.completionTick.collectAsState()
    val completions by androidx.compose.runtime.produceState(
        initialValue = com.wordocious.app.data.DailyCompletionsService.readCache(), key1 = completionTick
    ) {
        value = com.wordocious.app.data.DailyCompletionsService.fetchTodayCompletions()
    }
    // The player's own daily row on the board at once (founder, 2026-09-29 — iOS parity): the board
    // paints a cached copy (often from before they played) and the refetch can race the insert,
    // while today's completion is already on the phone. Placed by the server's order (score desc,
    // time asc) whenever the rows in hand lack it; not past a full top 50 (the rank window's job).
    // The fetched rows, count and rank stay server-only in the cache.
    val profileNow = AuthService.profile.value
    val mine = run {
        val c = completions[selectedMode]
        if (isSweep || c == null || c.score <= 0.0 || profileNow == null) return@run null
        if (fetchedEntries.any { it.userId.equals(profileNow.id, ignoreCase = true) }) return@run null
        val i = fetchedEntries.indexOfFirst { it.compositeScore < c.score || (it.compositeScore == c.score && it.timeSeconds > c.timeSeconds) }
        val at = if (i < 0) fetchedEntries.size else i
        if (at >= 50) return@run null
        val row = LeaderboardService.LeaderboardEntry(
            userId = profileNow.id,
            profiles = LeaderboardService.ProfileRef(profileNow.username, profileNow.avatarUrl, profileNow.avatarEmoji),
            compositeScore = c.score, guessCount = c.guessCount, timeSeconds = c.timeSeconds,
            boardsSolved = if (c.completed) 1 else 0, totalBoards = 1, completed = c.completed,
        )
        val rows = fetchedEntries.take(at) + row + fetchedEntries.drop(at)
        val total = maxOf(fetchedPlayerCount + 1, rows.size)
        Triple(rows, total, LeaderboardService.RankInfo(at + 1, total))
    }
    val entries = mine?.first ?: fetchedEntries
    val playerCount = mine?.second ?: fetchedPlayerCount
    val userRank = fetchedUserRank ?: mine?.third
    val boardLoading = loading && mine == null

    // FRIENDS (§207): All|Friends toggle — dense friend ranks + ghost rows
    // for friends who haven't played this mode today, with the canned-taunt
    // dialog (fixed phrases only). friendsVersion re-keys the fetches when
    // the FriendsService cache changes. Declared before the board fetch that
    // keys on them.
    var friendsOnly by remember { mutableStateOf(false) }
    var friendsVersion by remember { mutableStateOf(FriendsService.version) }
    var tauntTarget by remember { mutableStateOf<FriendsService.FriendProfile?>(null) }
    var tauntStatus by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(userId) { if (userId != null) FriendsService.load() }
    androidx.compose.runtime.DisposableEffect(Unit) {
        val remove = FriendsService.addListener { friendsVersion = FriendsService.version }
        onDispose { remove() }
    }

    // A mode tap (or the All|Friends toggle) paints that board's cached rows, count and rank in the
    // SAME update as the selection, iOS 3edd33c2 parity (founder, 2026-09-29: the tap frame showed
    // the new header over the previous mode's rows and player count, because the cache was only
    // read inside the fetch LaunchedEffect — a frame later). No cached copy → the skeleton at once,
    // never the old mode's rows. The fetch effect below still revalidates exactly as before; the
    // player's own row (`mine`) keeps deriving from fetchedEntries.
    fun paintCachedBoard(mode: String) {
        val day = com.wordocious.app.todayLocalDate()
        if (mode == SWEEP_ID) {
            val c = LeaderboardService.cachedSweep(LeaderboardService.sweepCacheKey(day))
            sweepEntries = c?.entries ?: emptyList()
            sweepRank = c?.rank
            sweepDetails = c?.details ?: emptyMap()
            fetchedPlayerCount = c?.entries?.size ?: 0
            loading = c == null
            return
        }
        val friends = friendsOnly && userId != null
        val c = LeaderboardService.cachedBoard(LeaderboardService.cacheKey(mode, day, userId) + if (friends) ":friends" else "")
        fetchedEntries = c?.entries ?: emptyList()
        fetchedPlayerCount = c?.playerCount ?: 0
        fetchedUserRank = c?.rank
        rankWindow = c?.rankWindow
        loading = c == null
    }
    // Yesterday's Winners, same rule: the settled podium for the new mode/filter from the session
    // copy, else a blank body until it lands — never the previous mode's podium under the new tile.
    fun yesterdayKey(mode: String) =
        "${com.wordocious.app.yesterdayLocalDate()}:$mode:${if (friendsOnly && userId != null) "friends" else "all"}:$userId"
    fun paintCachedYesterday(mode: String) {
        val y = YesterdayBoards.get(yesterdayKey(mode))
        yesterday = y?.entries ?: emptyList()
        yesterdaySweep = y?.sweep ?: emptyList()
        ySweepDetails = y?.sweepDetails ?: emptyMap()
        yFlawlessStreaks = y?.flawlessStreaks ?: emptyMap()
        yesterdayPending = y == null
    }
    fun selectMode(mode: String) {
        if (mode == selectedMode) return
        selectedMode = mode
        paintCachedBoard(mode)
        if (showYesterday) paintCachedYesterday(mode)
    }
    fun selectFriendsOnly(f: Boolean) {
        if (f == friendsOnly) return
        friendsOnly = f
        paintCachedBoard(selectedMode)
        if (showYesterday) paintCachedYesterday(selectedMode)
    }
    // §214: consume a post-game deep link (View Leaderboard → this mode) — also while the tab
    // is alive, where the remember seed above has already run.
    LaunchedEffect(LeaderboardDeepLink.pendingMode.value) {
        LeaderboardDeepLink.pendingMode.value?.let { m ->
            selectMode(m)
            LeaderboardDeepLink.pendingMode.value = null
        }
    }
    // §253: warm the modes the user has NOT opened yet today, so a chip tap
    // paints instantly instead of starting a fresh round trip.
    //
    // Persisting the cache fixed cold starts, but only for boards already
    // visited that day — with nine modes each was still a skeleton the first
    // time it was opened. This fills those slots ahead of the tap.
    //
    // Deliberately a trickle, not a burst: it waits for the visible board to
    // land, goes one mode at a time with a gap, and SKIPS anything already
    // cached (the revalidate below owns freshness). Rank/window are left null —
    // the real load fills those, and they are not part of first paint anyway.
    LaunchedEffect(userId, friendsOnly) {
        if (friendsOnly) return@LaunchedEffect
        kotlinx.coroutines.delay(1200)
        val day = com.wordocious.app.todayLocalDate()
        for ((id, _) in MODE_OPTIONS) {
            if (id == SWEEP_ID || id == selectedMode) continue
            val key = LeaderboardService.cacheKey(id, day, userId)
            if (LeaderboardService.cachedBoard(key) != null) continue
            val rows = LeaderboardService.fetchDailyLeaderboardOrNull(id, day = day) ?: continue
            ensureActive()
            val count = LeaderboardService.playerCount(id)
            ensureActive()
            LeaderboardService.cacheBoard(key, LeaderboardService.CachedBoard(rows, count, null, null))
            kotlinx.coroutines.delay(300)
        }
    }
    LaunchedEffect(selectedMode, tick, friendsOnly, friendsVersion) {
        val mode = selectedMode
        val day = com.wordocious.app.todayLocalDate()
        // Daily Sweep board takes its own RPC path (no play-type / rank-window
        // machinery). Kept ahead of the per-mode fetch so `daily_results` is
        // never queried with the synthetic SWEEP id.
        if (mode == SWEEP_ID) {
            // Same stale-while-revalidate treatment as the per-mode boards (iOS
            // SweepCache) — re-entering the Sweep tile repaints the last-known
            // rows instead of dropping to the skeleton.
            val sweepKey = LeaderboardService.sweepCacheKey(day)
            val cachedSweep = LeaderboardService.cachedSweep(sweepKey)
            if (cachedSweep != null) {
                sweepEntries = cachedSweep.entries
                fetchedPlayerCount = cachedSweep.entries.size
                sweepRank = cachedSweep.rank
                sweepDetails = cachedSweep.details
                loading = false
            } else {
                loading = true
            }
            val rows = LeaderboardService.fetchDailySweepOrNull(day)
            ensureActive()
            if (rows == null) { loading = false; return@LaunchedEffect }
            sweepEntries = rows
            fetchedPlayerCount = rows.size
            loading = false
            // §223: the dot strip + guess/hint totals land AFTER the rows paint,
            // so the board never waits on the detail query (web parity — the
            // details swap in silently; a fetch failure just leaves plain rows).
            val details = LeaderboardService.fetchSweepModeDetails(day, rows.map { it.userId })
            ensureActive()
            sweepDetails = details
            // §248: only rows already FLAWLESS can be on a live streak.
            flawlessStreaks = LeaderboardService.fetchFlawlessStreaks(day, rows.filter { it.isFlawless }.map { it.userId })
            ensureActive()
            sweepRank = if (userId != null) LeaderboardService.getUserSweepRank(userId, day) else null
            ensureActive()
            LeaderboardService.cacheSweep(sweepKey, LeaderboardService.CachedSweep(rows, sweepRank, details))
            return@LaunchedEffect
        }
        // Stale-while-revalidate: a mode-chip tap or screen re-entry paints the
        // last-known rows instantly; the skeleton only shows on a true first load.
        val friends = friendsOnly && userId != null
        val key = LeaderboardService.cacheKey(mode, day, userId) + if (friends) ":friends" else ""
        val cached = LeaderboardService.cachedBoard(key)
        if (cached != null) {
            fetchedEntries = cached.entries
            fetchedPlayerCount = cached.playerCount
            fetchedUserRank = cached.rank
            rankWindow = cached.rankWindow
            loading = false
        } else {
            loading = true
            fetchedEntries = emptyList()
            fetchedUserRank = null
            rankWindow = null
        }
        // FRIENDS board (§207): one fetch restricted to friends∪me holds the
        // whole board — rank is the dense index, no rank query or window.
        if (friends) {
            val ids = (FriendsService.friendIds + userId!!.lowercase()).toList()
            val lbF = LeaderboardService.fetchDailyLeaderboardOrNull(mode, day = day, userIds = ids)
            ensureActive()
            if (lbF == null) { loading = false; return@LaunchedEffect }
            fetchedEntries = lbF
            fetchedPlayerCount = lbF.size
            loading = false
            val idx = lbF.indexOfFirst { it.userId == userId }
            // §217: exact (score, time) ties share the rank on the friends board too.
            val rank = if (idx >= 0) LeaderboardService.RankInfo(LeaderboardService.competitionRank(lbF, idx), lbF.size) else null
            fetchedUserRank = rank
            rankWindow = null
            LeaderboardService.cacheBoard(key, LeaderboardService.CachedBoard(lbF, lbF.size, rank, null))
            return@LaunchedEffect
        }
        // Rows + "{n} players today" (ALL play types, exact server count) in
        // parallel — paint the rows the moment they land; the rank banner fills
        // in on its own instead of holding the whole list behind its queries.
        val (lbOpt, count) = kotlinx.coroutines.coroutineScope {
            val lbD = async { LeaderboardService.fetchDailyLeaderboardOrNull(mode, day = day) }
            val countD = async { LeaderboardService.playerCount(mode) }
            lbD.await() to countD.await()
        }
        // Race guard: a mode switch cancels this effect; never let a late
        // response from the old mode overwrite the new mode's rows.
        ensureActive()
        // Network error (null, not an empty day): keep whatever is showing —
        // cached rows beat clobbering them with a blank list; never cache the failure.
        if (lbOpt == null) { loading = false; return@LaunchedEffect }
        val lb = lbOpt
        fetchedEntries = lb
        fetchedPlayerCount = count
        loading = false
        val rank = if (userId != null) {
            LeaderboardService.getUserDailyRank(userId, mode, day = day, topEntries = lb)
        } else null
        ensureActive()
        fetchedUserRank = rank
        // Ranked past the visible list → also fetch the rows around them.
        val win = if (rank != null && rank.rank > 50) {
            LeaderboardService.fetchRankWindow(mode, userRank = rank.rank, day = day)
        } else null
        ensureActive()
        rankWindow = win
        LeaderboardService.cacheBoard(key, LeaderboardService.CachedBoard(lb, count, rank, win))
    }
    LaunchedEffect(selectedMode, showYesterday, friendsOnly, friendsVersion) {
        // Friends toggle carries into Yesterday's Winners: podium among friends.
        yesterday = if (showYesterday && selectedMode != SWEEP_ID) {
            val ids = if (friendsOnly && userId != null)
                (FriendsService.friendIds + userId.lowercase()).toList() else null
            if (ids != null) {
                LeaderboardService.fetchDailyLeaderboardOrNull(
                    selectedMode, day = com.wordocious.app.yesterdayLocalDate(), limit = 5, userIds = ids,
                ) ?: emptyList()
            } else LeaderboardService.fetchYesterdayWinners(selectedMode)
        } else emptyList()
        yesterdaySweep = if (showYesterday && selectedMode == SWEEP_ID) {
            LeaderboardService.fetchDailySweepOrNull(day = com.wordocious.app.yesterdayLocalDate(), limit = 5) ?: emptyList()
        } else emptyList()
        // §223: yesterday's rows carry the same dot strip + g/h numbers. Fetched
        // after the rows land so the card opens immediately even when the detail
        // query is slow (missing details just render plain rows).
        ySweepDetails = if (yesterdaySweep.isNotEmpty()) {
            LeaderboardService.fetchSweepModeDetails(com.wordocious.app.yesterdayLocalDate(), yesterdaySweep.map { it.userId })
        } else emptyMap()
        // §248: streaks as they stood at yesterday's settled board.
        yFlawlessStreaks = if (yesterdaySweep.isNotEmpty()) {
            LeaderboardService.fetchFlawlessStreaks(com.wordocious.app.yesterdayLocalDate(), yesterdaySweep.filter { it.isFlawless }.map { it.userId })
        } else emptyMap()
        ensureActive()
        yesterdayPending = false
        // Yesterday is settled — keep the session copy that paints the next switch back instantly
        // (an empty result may be a failed fetch, so it is never kept).
        if (showYesterday && (yesterday.isNotEmpty() || yesterdaySweep.isNotEmpty())) {
            YesterdayBoards.put(yesterdayKey(selectedMode), YesterdayBoards.Entry(yesterday, yesterdaySweep, ySweepDetails, yFlawlessStreaks))
        }
    }

    // A More Games pick (via the More chip) is not in MODE_OPTIONS — read its catalog title.
    val modeLabel = MODE_OPTIONS.firstOrNull { it.first == selectedMode }?.second ?: modeTitleForKey(selectedMode)

    // LEADERBOARD SHARE — today's board card + yesterday's podium card (web
    // /daily parity). Single-tap, spoiler-free by construction, so no variant
    // chooser. The Sweep board shares its own card (§231) — same two buttons.
    val shareContext = androidx.compose.ui.platform.LocalContext.current
    val shareScope = androidx.compose.runtime.rememberCoroutineScope()
    var sharingLb by remember { mutableStateOf(false) }
    var sharingPodium by remember { mutableStateOf(false) }

    // TIE-AWARE score display (web parity): rows sharing a whole number on the
    // same board render the decimals that rank them (2,328.8 over 2,328.0
    // instead of a phantom tie). One map per board, keyed by the raw score.
    val lbScoreLabels = remember(entries, rankWindow) {
        tieAwareScoreLabels(entries.map { it.compositeScore } + (rankWindow?.entries?.map { it.compositeScore } ?: emptyList()))
    }
    val sweepScoreLabels = remember(sweepEntries) { tieAwareScoreLabels(sweepEntries.map { it.totalScore }) }
    val yLbScoreLabels = remember(yesterday) { tieAwareScoreLabels(yesterday.map { it.compositeScore }) }
    val ySweepScoreLabels = remember(yesterdaySweep) { tieAwareScoreLabels(yesterdaySweep.map { it.totalScore }) }
    val ghostFriends = remember(friendsOnly, friendsVersion, entries, isSweep) {
        if (friendsOnly && userId != null && !isSweep) {
            FriendsService.friends.filter { f ->
                entries.none { it.userId == f.id } && !ModerationService.isBlocked(f.id)
            }
        } else emptyList()
    }
    // §216: on the FRIENDS board, the week's points leader wears the crown.
    val crownId = remember(friendsOnly, friendsVersion) {
        if (!friendsOnly || userId == null) null
        else {
            val racers = FriendsService.friends.map { it.id to (it.weekPoints ?: 0) } +
                (userId to (FriendsService.meDigest?.weekPoints ?: 0))
            val top = racers.maxByOrNull { it.second }
            if (top != null && top.second > 0) top.first else null
        }
    }
    // Canned-taunt picker (§207): fixed phrases, one per friend per day.
    tauntTarget?.let { target ->
        androidx.compose.ui.window.Dialog(onDismissRequest = { tauntTarget = null; tauntStatus = null }) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                    .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
            ) {
                Text(
                    "TAUNT ${target.username.uppercase()}",
                    fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                )
                Divider()
                val status = tauntStatus
                if (status != null) {
                    Text(
                        status, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    )
                } else {
                    FriendTaunts.ALL.forEach { taunt ->
                        Text(
                            taunt.text, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                            modifier = Modifier.fillMaxWidth().clickableNoRipple {
                                shareScope.launch {
                                    val outcome = FriendsService.taunt(
                                        target.id, taunt.id, com.wordocious.app.todayLocalDate())
                                    tauntStatus = when (outcome) {
                                        FriendsService.TauntOutcome.SENT -> "Sent 😈"
                                        FriendsService.TauntOutcome.ALREADY_SENT -> "Already taunted them today"
                                        FriendsService.TauntOutcome.FAILED -> "Could not send"
                                    }
                                    kotlinx.coroutines.delay(1400)
                                    tauntTarget = null
                                    tauntStatus = null
                                }
                            }.padding(horizontal = 16.dp, vertical = 13.dp),
                        )
                        Divider()
                    }
                    Text(
                        "Cancel", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().clickableNoRipple { tauntTarget = null }
                            .padding(vertical = 13.dp),
                    )
                }
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().pageBackground(PageTint.LEADERBOARD)) {
        // iOS keeps the title, countdown and mode grid INSIDE the scroll
        // container (ProfileTab `content`), so scrolling the board reclaims
        // their height instead of leaving them pinned to the top.
        LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
            // The Leaderboard banner (docs/LEADERBOARD_REDESIGN_SPEC.md §1): the core day
            // title, date · reset clock, ALL-TIME → Records, and the game picker — eight
            // Wordocious squares + the SWEEP chip, then the ten Puzzles. Replaces the old
            // DAILY CHALLENGE title, countdown row and mode grid. Same selectMode path.
            item {
                Box(Modifier.padding(top = 8.dp, bottom = 16.dp)) {
                    LeaderboardBanner(selected = selectedMode, onSelect = { selectMode(it) }, onOpenRecords = onOpenRecords)
                }
            }
            // §2.1 Play card for the selected game (game-tile CARD style). The Sweep board
            // has no single mode to play, so its card carries the ranking explanation.
            if (isSweep) {
                item {
                    SweepInfoCard()
                    Spacer(Modifier.height(12.dp))
                }
            } else {
                item {
                    ModeInfoCard(
                        modeId = selectedMode, players = playerCount,
                        // iOS: cached completions answer instantly; the rank confirms.
                        played = completions[selectedMode] != null || userRank != null,
                        onPlay = onPlay,
                    )
                    Spacer(Modifier.height(12.dp))
                }
                // §2.2 Completed-daily dropdown (your board for this mode), web parity:
                // collapsible "Completed/Attempted Today" card above the user rank.
                item(key = "completed-$selectedMode") {
                    com.wordocious.app.ui.game.CompletedDailyBoard(selectedMode)
                }
            }
            // §2.3 Your rank (true total; shows even when the user is outside the visible
            // top 50, web/iOS parity). For SWEEP this is the user's daily-sweep rank.
            (if (isSweep) sweepRank else userRank)?.let { rank ->
                item {
                    val myPoints = if (isSweep) {
                        sweepEntries.firstOrNull { it.userId == userId }?.totalScore
                    } else {
                        (entries + (rankWindow?.entries ?: emptyList())).firstOrNull { it.userId == userId }?.compositeScore
                            ?: completions[selectedMode]?.score
                    }
                    UserRankCard(
                        rank = rank.rank, total = rank.totalPlayers, mode = selectedMode,
                        friends = friendsOnly && !isSweep, points = myPoints,
                    )
                    Spacer(Modifier.height(16.dp))
                }
            }
            // §2.4 TODAY'S BOARD: label + Everyone | Friends + the bare share icon.
            item {
                Row(
                    Modifier.fillMaxWidth().padding(start = 2.dp, bottom = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    LbSectionLabel("TODAY\u2019S BOARD", Modifier.weight(1f))
                    // FRIENDS toggle (§207) — per-mode boards only, as before.
                    if (!isSweep && userId != null) {
                        FriendsSegment(friendsOnly) { selectFriendsOnly(it) }
                    }
                    val canShare = if (isSweep) !loading && sweepEntries.isNotEmpty() else !boardLoading && entries.isNotEmpty()
                    if (canShare) {
                        Box(
                            Modifier.size(28.dp).clickableNoRipple {
                                if (!sharingLb) {
                                    sharingLb = true
                                    shareScope.launch {
                                        try {
                                            if (isSweep) {
                                                // Today's sweep-board share (§231).
                                                com.wordocious.app.data.LeaderboardShare.shareDailySweepCard(
                                                    shareContext, sweepEntries, userId, sweepRank,
                                                )
                                            } else {
                                                com.wordocious.app.data.LeaderboardShare.shareDailyLeaderboardCard(
                                                    shareContext, selectedMode, "solo",
                                                    entries, rankWindow, userId, userRank,
                                                    friends = friendsOnly,
                                                )
                                            }
                                        } finally { sharingLb = false }
                                    }
                                }
                            },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon3D(Icon3DName.SHARE, 19.dp, contentDescription = if (isSweep) "Share sweep board" else "Share leaderboard", alpha = if (sharingLb) 0.4f else 1f, modifier = Modifier,
                            )
                        }
                    }
                }
            }
            // Leaderboard body
            if (boardLoading) {
                // Web parity: animate-pulse skeleton rows, not a spinner.
                item { LeaderboardSkeleton() }
            } else if (isSweep) {
                if (sweepEntries.isEmpty()) {
                    item { EmptyBoardCard("No sweeps yet today. Be the first!") }
                } else {
                    item {
                        Column(
                            Modifier.lbSoftCard(),
                        ) {
                            sweepEntries.forEachIndexed { index, entry ->
                                SweepRow(
                                    rank = index + 1, entry = entry,
                                    isCurrentUser = entry.userId == userId,
                                    onOpenProfile = onOpenProfile,
                                    scoreLabel = sweepScoreLabels[entry.totalScore],
                                    details = sweepDetails[entry.userId],
                                    day = com.wordocious.app.todayLocalDate(),
                                    flawlessStreak = flawlessStreaks[entry.userId] ?: 0,
                                )
                                if (index < sweepEntries.size - 1) Divider()
                            }
                        }
                    }
                }
            } else if (entries.isEmpty()) {
                item {
                    if (friendsOnly && ghostFriends.isNotEmpty()) {
                        // Nobody's played yet — the friends list still renders
                        // as ghost rows so the board feels alive (and tauntable).
                        Column(
                            Modifier.lbSoftCard(),
                        ) {
                            ghostFriends.forEachIndexed { index, f ->
                                GhostFriendRow(f, onOpenProfile) { tauntTarget = f }
                                if (index < ghostFriends.size - 1) Divider()
                            }
                        }
                    } else {
                        Column(
                            Modifier.lbSoftCard()
                                .padding(vertical = 40.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            // R asleep on an empty board; I's invite scene on an empty Friends board (ART_SPEC §7).
                            SceneImage(if (friendsOnly) SceneArt.INVITE else SceneArt.ASLEEP)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                if (friendsOnly) Mascots.addFriendLine else "No daily results yet. Be the first!",
                                color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                            // Empty Friends board → recruit (§207 Tier 2, web parity).
                            if (friendsOnly) {
                                Spacer(Modifier.height(12.dp))
                                Button3D(
                                    onClick = onOpenFriends,
                                    face = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))),
                                    shadow = Color(0xFF4C1D95),
                                ) {
                                    Text(
                                        "Add friends", color = Color.White,
                                        fontWeight = FontWeight.Black, fontSize = 13.sp, fontFamily = Nunito,
                                    )
                                }
                            }
                        }
                    }
                }
            } else {
                item {
                    // Card wrapper with dividers between rows (web: rounded surface card).
                    Column(
                        Modifier.lbSoftCard(),
                    ) {
                        entries.forEachIndexed { index, entry ->
                            LeaderboardRow(
                                // §217: exact (score, time) ties share the rank.
                                rank = LeaderboardService.competitionRank(entries, index),
                                entry = entry, mode = selectedMode,
                                isCurrentUser = entry.userId == userId,
                                onOpenProfile = onOpenProfile,
                                // Friends board: one-tap canned taunt (§207).
                                onTaunt = if (friendsOnly && entry.userId != userId) {
                                    {
                                        tauntTarget = FriendsService.FriendProfile(
                                            id = entry.userId, username = entry.username ?: "Player",
                                            avatarUrl = entry.avatarUrl,
                                        )
                                    }
                                } else null,
                                scoreLabel = lbScoreLabels[entry.compositeScore],
                                crownId = crownId,
                            )
                            if (index < entries.size - 1) Divider()
                        }
                        // "Your neighborhood" — rows around the user's rank when
                        // they placed past the top 50 (web/iOS parity).
                        rankWindow?.let { win ->
                            Divider()
                            Text(
                                "···", fontSize = 14.sp, fontWeight = FontWeight.Black,
                                color = WTheme.textMuted,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            )
                            Divider()
                            win.entries.forEachIndexed { index, entry ->
                                LeaderboardRow(
                                    rank = win.startRank + index, entry = entry, mode = selectedMode,
                                    isCurrentUser = entry.userId == userId,
                                    onOpenProfile = onOpenProfile,
                                    scoreLabel = lbScoreLabels[entry.compositeScore],
                                )
                                if (index < win.entries.size - 1) Divider()
                            }
                        }
                        // FRIENDS ghost rows — friends who haven't played this
                        // mode today, muted, with the taunt bell (§207).
                        if (friendsOnly) {
                            ghostFriends.forEach { f ->
                                Divider()
                                GhostFriendRow(f, onOpenProfile) { tauntTarget = f }
                            }
                        }
                    }
                }
            }
            // §2.5 YESTERDAY'S WINNERS (collapsible) — per-mode top 3, or yesterday's
            // top sweepers when the Sweep chip is selected. One soft card: the caps
            // header (chevron + bare share) and, open, the podium rows under it.
            item {
                Spacer(Modifier.height(16.dp))
                Column(Modifier.lbSoftCard()) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 14.dp, end = 6.dp, top = 4.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        Modifier.weight(1f).clickableNoRipple {
                            showYesterday = !showYesterday
                            if (showYesterday) paintCachedYesterday(selectedMode)
                        }.padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        LbSectionLabel("YESTERDAY\u2019S WINNERS")
                        Spacer(Modifier.width(4.dp))
                        Icon(
                            if (showYesterday) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                            if (showYesterday) "Collapse" else "Expand", tint = WTheme.textSecondary, modifier = Modifier.size(16.dp),
                        )
                    }
                    // Settled-podium share — only once the dropdown is open with
                    // rows (web parity). The Sweep tile shares yesterday's
                    // sweep podium instead (§231).
                    if (showYesterday && (if (isSweep) yesterdaySweep else yesterday).isNotEmpty()) {
                        Box(
                            Modifier.size(32.dp).clickableNoRipple {
                                if (!sharingPodium) {
                                    sharingPodium = true
                                    shareScope.launch {
                                        try {
                                            if (isSweep) {
                                                com.wordocious.app.data.LeaderboardShare.shareYesterdaySweepPodiumCard(
                                                    shareContext, yesterdaySweep, userId,
                                                )
                                            } else {
                                                com.wordocious.app.data.LeaderboardShare.shareYesterdayPodiumCard(
                                                    shareContext, selectedMode, "solo", yesterday, userId,
                                                    friends = friendsOnly,
                                                )
                                            }
                                        } finally { sharingPodium = false }
                                    }
                                }
                            },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon3D(Icon3DName.SHARE, 19.dp, contentDescription = "Share yesterday's podium", alpha = if (sharingPodium) 0.4f else 1f, modifier = Modifier,
                            )
                        }
                    }
                }
                if (showYesterday) {
                    Divider()
                    Column {
                        if (yesterdayPending) {
                            // Not this mode's rows yet — the empty-state's footprint, blank, instead
                            // of the previous mode's podium or a false "No results" (founder, 2026-09-29).
                            Text(
                                " ", fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                modifier = Modifier.fillMaxWidth().padding(24.dp),
                            )
                        } else if (isSweep) {
                            if (yesterdaySweep.isEmpty()) {
                                Text(
                                    "No sweeps yesterday", fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                    color = WTheme.textMuted, modifier = Modifier.fillMaxWidth().padding(24.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                )
                            } else {
                                yesterdaySweep.forEachIndexed { i, e ->
                                    YesterdaySweepRow(
                                        entry = e, scoreLabel = ySweepScoreLabels[e.totalScore],
                                        onOpenProfile = onOpenProfile,
                                        details = ySweepDetails[e.userId],
                                        day = com.wordocious.app.yesterdayLocalDate(),
                                        flawlessStreak = yFlawlessStreaks[e.userId] ?: 0,
                                    )
                                    if (i < yesterdaySweep.size - 1) Divider()
                                }
                            }
                        } else if (yesterday.isEmpty()) {
                            Text(
                                "No results from yesterday", fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                color = WTheme.textMuted, modifier = Modifier.fillMaxWidth().padding(24.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        } else {
                            // Full daily rows (founder ask, Aug 11): profile
                            // taps, guesses + time detail, W/L pill.
                            yesterday.forEachIndexed { i, e ->
                                LeaderboardRow(
                                    // §217: exact (score, time) ties share the rank.
                                    rank = LeaderboardService.competitionRank(yesterday, i),
                                    entry = e, mode = selectedMode,
                                    isCurrentUser = e.userId == userId,
                                    onOpenProfile = onOpenProfile,
                                    scoreLabel = yLbScoreLabels[e.compositeScore],
                                )
                                if (i < yesterday.size - 1) Divider()
                            }
                        }
                    }
                }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun Divider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.border))
}

/** §212: photo → emoji → initial, left of every username (web lbAvatar twin). */
@Composable
internal fun LbAvatar(avatarUrl: String?, avatarEmoji: String?, username: String) {
    val url = avatarUrl?.takeIf { it.isNotBlank() }
    // iOS AvatarView parity (founder, Aug 20: "make the android version look
    // more like the iphone version") — the fallback is TWO-letter initials in
    // white on the wordmark gradient (#A78BFA → #EC4899), not a single letter
    // on a washed flat.
    Box(
        Modifier.size(24.dp).clip(CircleShape)
            .background(
                if (url == null) {
                    androidx.compose.ui.graphics.Brush.linearGradient(
                        listOf(Color(0xFFA78BFA), Color(0xFFEC4899)),
                    )
                } else {
                    androidx.compose.ui.graphics.SolidColor(Color.Transparent)
                },
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (url != null) {
            coil.compose.AsyncImage(
                model = url, contentDescription = null,
                modifier = Modifier.fillMaxSize().clip(CircleShape),
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            )
        } else {
            val emoji = avatarEmoji?.trim().orEmpty()
            Text(
                if (emoji.isNotEmpty()) emoji else username.take(2).uppercase(),
                fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White,
            )
        }
    }
}

/** Rank badge (Leaderboard + Records, spec §2.4): numbered gold / silver / bronze
 *  discs for 1–3, the plain number after. */
@Composable
private fun RankIcon(rank: Int) {
    val medal = medalColor(rank)
    if (medal != null) {
        Box(
            Modifier.size(22.dp).clip(CircleShape)
                .background(Brush.verticalGradient(listOf(medal.copy(alpha = 0.85f), medal))),
            contentAlignment = Alignment.Center,
        ) {
            Text("$rank", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White, maxLines = 1)
        }
        return
    }
    // width(), NOT size(): a square constrained the height too, so a 3-digit rank
    // wrapped and clipped (425 read as "42"). iOS uses .frame(width:) for this.
    Box(Modifier.width(22.dp), contentAlignment = Alignment.Center) {
        Text("$rank", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, maxLines = 1, softWrap = false)
    }
}

/** The redesign's card shell (spec §2): surface, radius 14, the soft card shadow, no border. */
internal fun Modifier.lbSoftCard(): Modifier =
    this.fillMaxWidth().cardShadow(14.dp).clip(RoundedCornerShape(14.dp)).background(WTheme.surface)

/** Section label: 11 / 900, letter-spacing 1.2, #6b7280. */
@Composable
internal fun LbSectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
        color = WTheme.textSecondary, maxLines = 1, modifier = modifier,
    )
}

/** Everyone | Friends (§207 toggle) as a soft pill segmented control. */
@Composable
private fun FriendsSegment(friendsOnly: Boolean, onChange: (Boolean) -> Unit) =
    SoftSegment(listOf(false to "Everyone", true to "Friends"), friendsOnly, onChange)

/** A soft pill segmented control (Leaderboard / Records): violet track, white selected segment. */
@Composable
internal fun <T> SoftSegment(options: List<Pair<T, String>>, selected: T, onChange: (T) -> Unit) {
    val accent = Color(0xFF7C3AED)
    Row(Modifier.clip(RoundedCornerShape(50)).background(accent.copy(alpha = 0.10f)).padding(2.dp)) {
        options.forEach { (value, label) ->
            val on = selected == value
            Box(
                Modifier.height(24.dp).clip(RoundedCornerShape(50))
                    .background(if (on) WTheme.surface else Color.Transparent)
                    .clickableNoRipple { onChange(value) }
                    .padding(horizontal = 10.dp)
                    .semantics { contentDescription = label + if (on) ", selected" else "" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label, fontSize = 10.5.sp, fontWeight = FontWeight.Black,
                    color = if (on) accent else WTheme.textSecondary, maxLines = 1,
                )
            }
        }
    }
}

/** The solid-accent caps CTA (Play / View) on the play card. */
@Composable
private fun LbPlayButton(accent: Color, played: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .gameTilePress(onClick = onClick)
            .shadow(4.dp, RoundedCornerShape(50), ambientColor = accent.copy(alpha = 0.3f), spotColor = accent.copy(alpha = 0.3f))
            .clip(RoundedCornerShape(50))
            .background(accent)
            .padding(horizontal = 16.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        // Already finished today's daily for this mode → eye + VIEW (the route
        // already reconstructs the completed board). iOS parity.
        Icon(
            if (played) Icons.Filled.Visibility else Icons.Filled.PlayArrow,
            null, tint = Color.White, modifier = Modifier.size(12.dp),
        )
        Text(
            if (played) "VIEW" else "PLAY", fontSize = 13.sp, fontWeight = FontWeight.Black,
            letterSpacing = 0.6.sp, color = Color.White, maxLines = 1,
        )
    }
}

@Composable
private fun ModeInfoCard(modeId: String, players: Int, played: Boolean, onPlay: (com.wordocious.core.GameMode) -> Unit) {
    // §2.1 Play card (game-tile CARD style: wash, 1.5 accent border, top bar,
    // icon chip): name, "{n} players today" (+ the daily-only note), Play / View.
    val card = modeCardForKey(modeId)
    val accent = card?.accent ?: WTheme.primary
    Row(
        Modifier.fillMaxWidth().gameTileChrome(accent, WTheme.surface)
            .padding(start = 14.dp, end = 12.dp, top = 16.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        GameTileChip(accent, 36.dp) {
            if (card != null) ModeGlyph(card, accent, box = 36.dp)
            else Icon3D(Icon3DName.TROPHY, 22.dp)
        }
        // ART_SPEC §10 / §14: the selected game's title art (lettering + host) in place
        // of the game name text and the separate host, filling the space left of Play
        // (up to 52 dp tall).
        val titleArt = gameTitleArtResForKey(modeId)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (titleArt != null) {
                FittedGameTitleArt(
                    titleArt, card?.title ?: gameTitleLabelForKey(modeId),
                    maxHeight = GAME_TITLE_ART_CARD_HEIGHT, alignment = Alignment.CenterStart, heading = false,
                )
            } else Text(
                card?.title ?: modeId, fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.text,
                maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Filled.People, null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp))
                Text(
                    "$players player${if (players != 1) "s" else ""} today",
                    fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1,
                )
            }
            // Founder-approved clarity (iOS parity): this board ranks DAILY games only.
            Text("Daily games only", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
        }
        // No title art: the selected game's host stands inside the card, right side (MASCOT_SPEC §5), static.
        if (titleArt == null) Mascots.hostFor(modeId)?.let { Mascot(it, 44.dp) }
        card?.engineMode?.let { gm -> LbPlayButton(accent, played) { onPlay(gm) } }
    }
}

/** The Sweep board's card: no single game to play, so its ranking explanation (§223). */
@Composable
private fun SweepInfoCard() {
    val accent = LB_SWEEP_GOLD
    Row(
        Modifier.fillMaxWidth().gameTileChrome(accent, WTheme.surface)
            .padding(start = 14.dp, end = 12.dp, top = 16.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        GameTileChip(accent, 36.dp) {
            Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_broom),
                null, tint = accent, modifier = Modifier.size(18.dp),
            )
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Daily Sweep", fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1)
            // §223 microcopy: pre-answers "why is 9/9 below 8/9" — the board ranks by points, not wins.
            Text(
                "Ranked by total points across all modes",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }
    }
}

private val LB_SHORT = mapOf(
    "DUEL" to "Classic", "QUORDLE" to "Quad", "OCTORDLE" to "Octo", "SEQUENCE" to "Succ",
    "RESCUE" to "Deliv", "DUEL_6" to "Six", "DUEL_7" to "Seven", "GAUNTLET" to "Gauntlet", "PROPERNOUNDLE" to "Proper",
    SWEEP_ID to "Sweep",
)

/**
 * 5-over-4 stacked mode grid (all 9 modes visible, no horizontal scroll) — ports
 * the web `<ModePicker grid>` used on /daily + /records and the Profile dailies
 * layout, so you don't have to scroll to find a game.
 */
@Composable
internal fun ModePickerRow(
    selected: String,
    // 0.dp when the caller's container already supplies the horizontal gutter.
    horizontalPadding: androidx.compose.ui.unit.Dp = 12.dp,
    onSelect: (String) -> Unit,
) {
    // More Games (§18): the grid cannot hold every daily mode in its 5-over-N
    // layout, so the non-sweep dailies sit behind ONE "More" chip that opens the
    // sectioned More Games list (Stage 9: ProperNoundle and the new titles).
    // The chip is hidden only when no non-sweep daily is visible to this viewer.
    val flagTable by com.wordocious.app.data.FlagsService.flags.collectAsState()
    val flagsLoaded by com.wordocious.app.data.FlagsService.loaded.collectAsState()
    val morePicker = MORE_CARDS.filter { it.dailyEligible && it.dbKey != null && com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) }
    val ids = MODE_OPTIONS.map { it.first } + (if (morePicker.isNotEmpty()) listOf(MORE_ID) else emptyList())
    var showMore by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = horizontalPadding, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // With the Sweep tile the grid is a clean 5-over-5 (no centering
        // spacers). Any partial last row is padded on the right so each cell
        // stays 1/5 width.
        ids.chunked(5).forEach { rowItems ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                rowItems.forEach { id ->
                    if (id == MORE_ID) ModeCell(id, active = morePicker.any { it.dbKey == selected }, Modifier.weight(1f), selectedId = selected) { showMore = true }
                    else ModeCell(id, selected == id, Modifier.weight(1f)) { onSelect(id) }
                }
                repeat(5 - rowItems.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
    if (showMore) MoreModePickerSheet(onPick = { showMore = false; onSelect(it) }, onDismiss = { showMore = false })
}

@Composable
private fun ModeCell(id: String, active: Boolean, modifier: Modifier = Modifier, selectedId: String? = null, onClick: () -> Unit) {
    // GUARDED valueOf: SWEEP and MORE are synthetic ids (no `:core` GameMode) →
    // indigo broom / grid tile; every other id maps to its GameMode's accent +
    // web glyph. The More chip wears the selected More Games mode's icon, title
    // and accent when one is picked, so the grid still shows the filter.
    val isSweep = id == SWEEP_ID
    val isMore = id == MORE_ID
    val pickedMore = if (isMore) MORE_CARDS.firstOrNull { it.dbKey == selectedId } else null
    val mode = pickerGameModeOrNull(id)
    val accent = if (isSweep) SWEEP_ACCENT else if (isMore) (pickedMore?.accent ?: SWEEP_ACCENT) else (mode?.let { modeAccent(it) } ?: WTheme.primary)
    val short = if (isMore) (pickedMore?.let { LB_SHORT[it.dbKey] ?: com.wordocious.app.ModeGen.byId(it.id)?.shortTitle } ?: "More")
        else (LB_SHORT[id] ?: com.wordocious.app.ModeGen.byDbKey(id)?.shortTitle ?: id)
    // The square game tile (docs/GAME_TILE_STYLE.md): the home card's wash, top
    // bar and chip at 1 : 1, the picked mode selected. GameTileSquare caps the
    // fontScale (1.3x) so huge system text can't shear the label out of the box.
    GameTileSquare(accent = accent, label = short, selected = active, modifier = modifier, onClick = onClick) { chip ->
        // Web-faithful mode icon (WordleGrid/IV/VIII/TrendingUp/Shield/6/7/Skull/Crown);
        // the sweep tile draws the broom line-art.
        if (isSweep) {
            Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_broom),
                null, tint = accent, modifier = Modifier.size(chip * 0.5f),
            )
        } else if (isMore) {
            if (pickedMore != null) ModeGlyph(pickedMore, accent, box = chip)
            else Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_layout_grid),
                null, tint = accent, modifier = Modifier.size(chip * 0.5f),
            )
        } else {
            mode?.let { ModeGlyph(it, accent, box = chip) }
        }
    }
}

/** Medal tints for ranks 1–3 (gold / silver / bronze); null past the podium. */
internal fun medalColor(rank: Int): Color? = when (rank) {
    1 -> Color(0xFFF59E0B)
    2 -> Color(0xFF9CA3AF)
    3 -> Color(0xFFB45309)
    else -> null
}

/** §2.3 Your rank: a soft gold card — the rank in big numerals (medal-tinted on the
 *  podium), OF N TODAY (or friends), the movement badge, and your points. */
@Composable
internal fun UserRankCard(
    rank: Int, total: Int, mode: String, friends: Boolean = false, points: Double? = null,
    playType: String = "solo",
    pageKey: String = if (friends) "daily-friends" else "daily",
    /** Records: "OF N TODAY · TOP 5%" (the old rank line's percentile). */
    showTopPercent: Boolean = false,
    /** false hides the movement badge (the Records sweep boards never had one). */
    showDelta: Boolean = true,
    totalNoun: String = "TODAY",
) {
    val ink = medalColor(rank) ?: Color(0xFFD97706)
    Row(
        modifier = Modifier.fillMaxWidth()
            .cardShadow(14.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Brush.linearGradient(listOf(WTheme.highlightGold, WTheme.surface)))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Gold on BOTH boards — iOS uses one rankBanner for per-mode + sweep.
        Text(
            "#$rank", fontSize = 30.sp, fontWeight = FontWeight.Black, color = ink, maxLines = 1,
            style = TextStyle(fontFamily = Nunito),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("YOUR RANK", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = WTheme.textSecondary)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                val top = if (showTopPercent && total > 1) " · TOP ${maxOf(1, Math.round(rank.toDouble() / total * 100).toInt())}%" else ""
                Text(
                    (if (friends) "OF $total FRIENDS" else "OF $total $totalNoun") + top,
                    fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = WTheme.text, maxLines = 1,
                )
                // Transient "+N/−N" movement pill since you last looked (web parity).
                // Friends mode keeps its own memory — a friend-rank must never
                // compare against a stored global rank (§207).
                if (showDelta) RankDeltaBadge(mode = mode, playType = playType, pageKey = pageKey, currentRank = rank)
            }
        }
        if (points != null) {
            Column(horizontalAlignment = Alignment.End) {
                Text(formatScore(points), fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1)
                Text("POINTS", fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textSecondary)
            }
        }
    }
}

/** A row's daily result: the 3D W / L badge (ART_SPEC §4 / §13; was a "Win" / "Loss" text pill). */
@Composable
private fun WinLossPill(completed: Boolean, @Suppress("UNUSED_PARAMETER") abbrev: Boolean = false) {
    ResultBadge(completed, ROW_RESULT_BADGE_SIZE, contentDescription = if (completed) "Win" else "Loss")
}

/** GOLD "FLAWLESS" (won all 9) vs VIOLET "SWEEP" (completed all 9 but lost ≥1)
 *  pill — mirrors [WinLossPill]. Gold #d97706 / violet #a78bfa per spec, on a
 *  tinted wash so it reads in both light + dark themes. */
@Composable
private fun SweepPill(flawless: Boolean, streak: Int = 0) {
    val fg = if (flawless) Color(0xFFD97706) else Color(0xFFA78BFA)
    Box(
        Modifier.clip(RoundedCornerShape(4.dp))
            .background(fg.copy(alpha = 0.15f))
            .padding(horizontal = 5.dp, vertical = 1.dp),
    ) {
        Text(
            // §248: a live streak shows its length on the pill.
            if (flawless) (if (streak >= 2) "FLAWLESS ×$streak" else "FLAWLESS") else "SWEEP",
            fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = fg,
            // The §223 g/h stats squeezed this pill into wrapping ("FLAWLES\nS"
            // on Doug's phone) — a pill never wraps; the stats text ellipsizes.
            maxLines = 1, softWrap = false,
        )
    }
}

/** Empty-state card for the Sweep boards. iOS uses the SAME outline trophy here
 *  as on the per-mode empty board — not the broom. */
@Composable
private fun EmptyBoardCard(message: String) {
    // An empty board gets R asleep (ART_SPEC §7 scene).
    SceneEmptyState(
        SceneArt.ASLEEP, message, Modifier.lbSoftCard().padding(vertical = 28.dp, horizontal = 16.dp),
        color = WTheme.textMuted,
    )
}

/** One Daily Sweep row — total score over "total time · X/9[ · Ng][ · Nh]" +
 *  FLAWLESS/SWEEP pill, with the §223 dot strip beneath. Reuses [RankIcon] +
 *  the LeaderboardRow shell (score/time formatters). */
@Composable
internal fun SweepRow(
    rank: Int, entry: LeaderboardService.SweepEntry, isCurrentUser: Boolean,
    onOpenProfile: (String) -> Unit = {}, scoreLabel: String? = null,
    // §223 dot-strip inputs, defaulted so pre-§223 call sites (RecordsScreen)
    // keep compiling: null details render the plain row — never a blocked one.
    details: LeaderboardService.SweepDetails? = null,
    day: String = com.wordocious.app.todayLocalDate(),
    // §248: current flawless streak — the pill reads "FLAWLESS ×4" when >= 2.
    flawlessStreak: Int = 0,
) {
    Row(
        modifier = Modifier.lbRowShell(isCurrentUser),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RankIcon(rank)
        // §212: faces on the sweep boards too (RPCs have no emoji column).
        LbAvatar(entry.avatarUrl, null, entry.username ?: "Player")
        // Same shape as LeaderboardRow (Doug's Aug-16 feedback): stats under
        // the name so the name keeps the row's flexible width.
        Column(
            Modifier.weight(1f).clickableNoRipple { onOpenProfile(entry.userId) },
            verticalArrangement = Arrangement.spacedBy(2.dp),   // iOS VStack(spacing: 2)
        ) {
            // §236 (founder: stats "cut off"): the score shared the row with
            // the flexible column and squeezed the stats. It now rides the
            // NAME line (the name ellipsizes harmlessly); the stats line owns
            // the full row width. ONE AnnotatedString for name+(you) — as two
            // siblings, a squeezed row wrapped " (you)" one char per line.
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    androidx.compose.ui.text.buildAnnotatedString {
                        append(entry.username ?: "Player")
                        if (isCurrentUser) {
                            withStyle(androidx.compose.ui.text.SpanStyle(color = Color(0xFFD97706))) { append(" (you)") }
                        }
                    },
                    fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                    maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    scoreLabel ?: formatScore(entry.totalScore),
                    fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text,
                    maxLines = 1, softWrap = false,
                )
            }
            Text(
                sweepStatsLine(entry, details, day), fontSize = 10.sp, fontWeight = FontWeight.Bold,
                // §246: the hints segment fell off the row's end — wrap, never truncate.
                color = WTheme.textMuted, maxLines = 2,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                SweepModeDots(details, day)
                SweepPill(entry.isFlawless, flawlessStreak)
            }
        }
    }
}

/** §223: "{time} · {won}/9[ · N guesses][ · N hints]" — guesses (and hints,
 *  when any) are the numbers that actually explain the ranking: the formula is
 *  guess-first, so 9 slow wins can trail 8 sharp ones (founder double-take,
 *  Aug 18). The segments appear only once details land. §227: spelled out —
 *  the founder read "2h" as HOURS; the pill moved off this line so the words
 *  have the width (iOS sweepStatsLine parity). */
private fun sweepStatsLine(entry: LeaderboardService.SweepEntry, details: LeaderboardService.SweepDetails?, day: String): String = buildString {
    // The denominator is that day's sweep-era size (Stage 9: 8 today, 9 before).
    append("${fmtTime(entry.totalTime)} · ${entry.modesWon}/${com.wordocious.app.ModeGen.requiredSweepCount(day)}")
    if (details != null) {
        append(" · ${details.guesses} guess${if (details.guesses == 1) "" else "es"}")
        if (details.hints > 0) append(" · ${details.hints} hint${if (details.hints == 1) "" else "s"}")
    }
}

/** §223: the Sweep board's dot strip — that day's sweep-era modes in mode-grid
 *  order ([sweepDotModes]); an era-2 day still shows nine dots. */

/**
 * One dot per mode, graded ABSOLUTELY — intensity is the score as a fraction of
 * that mode's theoretical ceiling ([DailyScoring.modeScoreCeiling]), never a
 * comparison to the field, so the strip reads identically with three players or
 * three thousand (founder call, Aug 18: relative "best on board" dies in a
 * crowd). Red = loss, hollow = not played. The [0.35, 0.9] remap spreads
 * real-world ratios (~0.4–0.9) across the full visual range. Renders nothing
 * until details land — the row never waits on the detail fetch.
 */
@Composable
private fun SweepModeDots(details: LeaderboardService.SweepDetails?, day: String) {
    if (details == null) return
    Row(
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        sweepDotModes(day).forEach { mode ->
            val d = details.modes[mode]
            val dot = Modifier.size(7.dp).clip(CircleShape)
            when {
                d == null -> Box(dot.border(1.dp, WTheme.border, CircleShape))
                !d.completed -> Box(dot.background(Color(0xFFEF4444)))
                else -> {
                    val ratio = (d.score / DailyScoring.modeScoreCeiling(mode, day)).toFloat()
                    val t = ((ratio - 0.35f) / 0.55f).coerceIn(0f, 1f)
                    Box(dot.background(Color(0xFF7C3AED).copy(alpha = 0.18f + 0.82f * t)))
                }
            }
        }
    }
}

/** One all-time sweep row — total sweeps over "N flawless · {time}". */
@Composable
internal fun AllTimeSweepRow(rank: Int, entry: LeaderboardService.AllTimeSweepEntry, isCurrentUser: Boolean, onOpenProfile: (String) -> Unit = {}) {
    Row(
        modifier = Modifier.lbRowShell(isCurrentUser),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RankIcon(rank)
        // §212: faces on the sweep boards too (RPCs have no emoji column).
        LbAvatar(entry.avatarUrl, null, entry.username ?: "Player")
        // Same shape as LeaderboardRow (Doug's Aug-16 feedback): stats under
        // the name so the name keeps the row's flexible width.
        Column(
            Modifier.weight(1f).clickableNoRipple { onOpenProfile(entry.userId) },
            verticalArrangement = Arrangement.spacedBy(2.dp),   // iOS VStack(spacing: 2)
        ) {
            // ONE Text like iOS (`Text(username) + Text(" (you)")`) — as two
            // siblings, a squeezed row wrapped " (you)" one character per line.
            Text(
                androidx.compose.ui.text.buildAnnotatedString {
                    append(entry.username ?: "Player")
                    if (isCurrentUser) {
                        withStyle(androidx.compose.ui.text.SpanStyle(color = Color(0xFFD97706))) { append(" (you)") }
                    }
                },
                fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
            // iOS appends the time unprefixed and always (0 renders as "0s").
            Text(
                "${entry.flawlessCount} flawless · ${fmtTime(entry.bestSweepTime)}",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }
        Text("${entry.sweepCount} sweep${if (entry.sweepCount == 1) "" else "s"}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
    }
}

/**
 * A board row's shell (Leaderboard + Records, spec §2.4): plain rows; your row tinted
 * #fef3c7 inside a 1.5 dp #f59e0b ring, inset so the ring clears the card edge.
 */
internal fun Modifier.lbRowShell(isCurrentUser: Boolean): Modifier {
    if (!isCurrentUser) return this.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp)
    val shape = RoundedCornerShape(10.dp)
    return this.fillMaxWidth().padding(horizontal = 6.dp, vertical = 3.dp)
        .clip(shape).background(WTheme.goldBorderLight).border(1.5.dp, Color(0xFFF59E0B), shape)
        .padding(horizontal = 8.dp, vertical = 7.dp)
}

@Composable
internal fun LeaderboardRow(rank: Int, entry: LeaderboardService.LeaderboardEntry, mode: String, isCurrentUser: Boolean, onOpenProfile: (String) -> Unit = {}, playType: String = "solo", showHints: Boolean = true, onTaunt: (() -> Unit)? = null, scoreLabel: String? = null, crownId: String? = null) {
    Row(
        modifier = Modifier.lbRowShell(isCurrentUser),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RankIcon(rank)
        // §212: photo → emoji → initial, left of every username — the boards
        // wear faces, not just names (web lbAvatar parity).
        LbAvatar(entry.profiles?.avatarUrl, entry.profiles?.avatarEmoji, entry.username ?: "Player")
        // Doug's Aug-16 feedback: the stats line lived under the SCORE, so the
        // right column's width was set by the widest stats string and names
        // truncated at ~5 chars ("nanc…"). Name on top, stats underneath,
        // score alone on the right — the name gets the row's flexible width.
        Column(
            Modifier.weight(1f).clickableNoRipple { onOpenProfile(entry.userId) },
            verticalArrangement = Arrangement.spacedBy(2.dp),   // iOS VStack(spacing: 2)
        ) {
            // ONE Text like iOS (`Text(username) + Text(" (you)")`) — as two
            // siblings, a squeezed row wrapped " (you)" one character per line.
            Text(
                androidx.compose.ui.text.buildAnnotatedString {
                    append(entry.username ?: "Player")
                    // §216: the week's leader wears the crown (friends board).
                    if (entry.userId == crownId) { append(" "); appendIcon3D(Icon3DName.CROWN) }
                    if (isCurrentUser) {
                        withStyle(androidx.compose.ui.text.SpanStyle(color = Color(0xFFD97706))) { append(" (you)") }
                    }
                },
                fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                inlineContent = icon3DInline(),
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                if (playType == "vs") {
                    // VS records show the head-to-head W/L tally instead of the
                    // solo guesses/time + Win/Loss pill (web records page parity).
                    Text("${entry.vsWins}W / ${entry.vsGames}G", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                } else {
                    Text(
                        rowDetail(entry, mode, showHints), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    WinLossPill(entry.completed)
                }
            }
        }
        Text(scoreLabel ?: formatScore(entry.compositeScore), fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        // Friends board: one-tap canned taunt on any friend's row (§207).
        if (onTaunt != null) {
            Icon(
                Icons.Outlined.Notifications, "Taunt ${entry.username ?: "friend"}",
                tint = WTheme.textMuted,
                modifier = Modifier.size(14.dp).clickableNoRipple(onTaunt),
            )
        }
    }
}

/** FRIENDS ghost row (§207) — a friend who hasn't played this mode today, in
 *  the standard row shell at muted opacity. The taunt bell is the point. */
@Composable
internal fun GhostFriendRow(
    friend: FriendsService.FriendProfile,
    onOpenProfile: (String) -> Unit = {},
    onTaunt: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().alpha(0.55f).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("–", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted,
            modifier = Modifier.width(20.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Column(Modifier.weight(1f).clickableNoRipple { onOpenProfile(friend.id) }) {
            Text(friend.username, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1)
            Text("Hasn't played yet", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Icon(
            Icons.Outlined.Notifications, "Nudge ${friend.username}",
            tint = WTheme.textMuted,
            modifier = Modifier.size(14.dp).clickableNoRipple(onTaunt),
        )
    }
}

@Composable
private fun YesterdayRow(rank: Int, entry: LeaderboardService.LeaderboardEntry, scoreLabel: String? = null) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RankIcon(rank)
        Text(entry.username ?: "Player", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, modifier = Modifier.weight(1f), maxLines = 1)
        WinLossPill(entry.completed, abbrev = true)
        Text(scoreLabel ?: formatScore(entry.compositeScore), fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
    }
}

/** Sweep-yesterday row — RankIcon, name, then the same score-over-stats right
 *  column as [SweepRow] (§223: yesterday's card gained the guess/hint numbers
 *  and dot strip too, so it explains its ranking the same way today's board
 *  does — web renders full sweep rows for any day). Rank comes from the RPC;
 *  the score stays muted, matching [YesterdayRow]. */
@Composable
private fun YesterdaySweepRow(
    entry: LeaderboardService.SweepEntry, scoreLabel: String? = null,
    onOpenProfile: (String) -> Unit = {},
    details: LeaderboardService.SweepDetails? = null,
    day: String = com.wordocious.app.yesterdayLocalDate(),
    // §248: current flawless streak as of this board's day.
    flawlessStreak: Int = 0,
) {
    // Full detail (founder ask, Aug 17): the RPC already returns time + modes
    // for any day — mirror today's SweepRow shape (name over "time · X/9").
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RankIcon(entry.rank.toInt())
        LbAvatar(entry.avatarUrl, null, entry.username ?: "Player")
        Column(
            Modifier.weight(1f).clickableNoRipple { onOpenProfile(entry.userId) },
            verticalArrangement = Arrangement.spacedBy(2.dp),   // iOS VStack(spacing: 2)
        ) {
            // §236: score rides the name line (see SweepRow).
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(entry.username ?: "Player", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Text(scoreLabel ?: formatScore(entry.totalScore), fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, maxLines = 1, softWrap = false)
            }
            Text(
                sweepStatsLine(entry, details, day), fontSize = 10.sp, fontWeight = FontWeight.Bold,
                // §246: the hints segment fell off the row's end — wrap, never truncate.
                color = WTheme.textMuted, maxLines = 2,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                SweepModeDots(details, day)
                SweepPill(entry.isFlawless, flawlessStreak)
            }
        }
    }
}

/** Row detail: "{guesses} Guesses · m s [· bs/tb] [· hint label]". Mirrors web.
 *  The guess stat reads through the mode's semantics (ModeStats.guessRowLabel,
 *  More Games §18): "0 Mistakes", "5 Checks", "Par", "+2 over par", "Hubbub". */
private fun rowDetail(
    entry: LeaderboardService.LeaderboardEntry,
    mode: String,
    /** Records rows omit the hints segment — iOS shows it on the Leaderboard only. */
    showHints: Boolean = true,
): String {
    val meta = com.wordocious.app.ModeGen.byDbKey(mode)
    val guessLabel = com.wordocious.app.data.ModeStats.guessRowLabel(meta?.guessSemantics ?: "guesses", meta?.guessBase ?: 1, entry.guessCount)
    val sb = StringBuilder("$guessLabel · ${fmtTime(entry.timeSeconds)}")
    if (entry.totalBoards > 1) sb.append(" · ${entry.boardsSolved}/${entry.totalBoards}")
    if (showHints) formatHintsLabel(mode, entry.hintsUsed)?.let { sb.append(" · $it") }
    return sb.toString()
}

/** Every mode with a hint button (web HINT_BEARING_MODES; founder, 2026-09-30: a Codebreaker row hid 4 hints). */
internal val HINT_BEARING = setOf("DUEL_6", "DUEL_7", "PROPERNOUNDLE", "SUDOKU", "REGIONS", "LADDER", "WORDSEARCH", "HUB", "CRYPTOGRAM", "GROUPS", "CROSSWORD", "SCRAMBLE")
private fun formatHintsLabel(mode: String, hints: Int): String? {
    if (mode !in HINT_BEARING) return null
    if (hints <= 0) return "No hints"
    return "$hints hint${if (hints == 1) "" else "s"}"
}

// fmtTime is the shared formatShortTime (ui/Format.kt) — the local copy is
// what let the t=0 rendering drift across platforms.
private fun fmtTime(s: Int): String = formatShortTime(s)
