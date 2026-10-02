package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
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
    // placeholder + Sign in (A8: the large purple candy button) instead of the live board.
    if (!isAuthenticated) {
        Column(
            Modifier.fillMaxSize().pageBackground(PageTint.LEADERBOARD).padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.weight(1f))
            Icon3D(Icon3DName.TROPHY, 64.dp)
            Text(
                "Sign in to see rankings", fontSize = 18.sp, fontWeight = FontWeight.Black, color = lbNameInk(),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Text(
                "Daily leaderboards are available to signed-in players.",
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = lbSubInk(),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
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
    // Canned-taunt picker (§207): fixed phrases, one per friend per day. A tinted sheet
    // (A1) of candy buttons (A8): the phrases pink, Cancel peach.
    tauntTarget?.let { target ->
        androidx.compose.ui.window.Dialog(onDismissRequest = { tauntTarget = null; tauntStatus = null }) {
            LbTintedCard(
                Color(0xFFEC4899),
                modifier = com.wordocious.app.ui.PopupWidth.fillMaxWidth(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FinishLabel(
                    "TAUNT ${target.username.uppercase()}", color = darkenInk(Color(0xFFEC4899)),
                    modifier = Modifier.padding(bottom = 2.dp),
                )
                val status = tauntStatus
                if (status != null) {
                    Text(
                        status, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = lbNameInk(),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp),
                    )
                } else {
                    FriendTaunts.ALL.forEach { taunt ->
                        CandyButton(
                            text = withoutEmoji(taunt.text), // AM3: emoji only in the push text
                            onClick = {
                                shareScope.launch {
                                    val outcome = FriendsService.taunt(
                                        target.id, taunt.id, com.wordocious.app.todayLocalDate())
                                    tauntStatus = when (outcome) {
                                        FriendsService.TauntOutcome.SENT -> "Sent!"
                                        FriendsService.TauntOutcome.ALREADY_SENT -> "Already taunted them today"
                                        FriendsService.TauntOutcome.FAILED -> "Could not send"
                                    }
                                    kotlinx.coroutines.delay(1400)
                                    tauntTarget = null
                                    tauntStatus = null
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            color = CandyColor.PINK,
                            size = CandySize.MEDIUM,
                            fill = true,
                            fontSize = 13.sp,
                        )
                    }
                    CandyButton(
                        text = "Cancel", onClick = { tauntTarget = null },
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        color = CandyColor.PEACH, size = CandySize.MEDIUM, fill = true,
                    )
                }
            }
        }
    }

    // How you solved today's board, for the result card (C2): your row on the board when it
    // is in hand, else today's cached completion.
    val myEntry = (entries + (rankWindow?.entries ?: emptyList())).firstOrNull { it.userId == userId }
    val mySweep = sweepEntries.firstOrNull { it.userId == userId }

    Column(modifier = Modifier.fillMaxSize().pageBackground(PageTint.LEADERBOARD)) {
        // iOS keeps the title, countdown and mode grid INSIDE the scroll
        // container (ProfileTab `content`), so scrolling the board reclaims
        // their height instead of leaving them pinned to the top.
        val lbListState = androidx.compose.foundation.lazy.rememberLazyListState()
        ScrollToTopOnReselect(lbListState) // AJ: a re-tap of Leaderboard scrolls to the top.
        LazyColumn(state = lbListState, modifier = Modifier.fillMaxSize().padding(horizontal = LB_SIDE)) {
            // A6: the day title is the page headline — full width, edge to edge, on the wallpaper.
            item(key = "headline") {
                Box(Modifier.padding(top = 4.dp, bottom = LB_CARD_GAP)) { LeaderboardHeadline(bleed = LB_SIDE) }
            }
            // C2 / C2b: THE game picker (Sweep = the 9th Wordocious tile); its tinted header
            // strip carries the date · reset clock and the ALL-TIME door. Same selectMode path.
            item(key = "picker") {
                LeaderboardPicker(selected = selectedMode, onSelect = { selectMode(it) }, onOpenRecords = onOpenRecords)
                Spacer(Modifier.height(LB_CARD_GAP))
            }
            // §2.1 Play card for the selected game. The Sweep board has no single mode to
            // play, so its card carries the ranking explanation.
            item(key = "play") {
                if (isSweep) {
                    SweepInfoCard(sweepers = playerCount)
                } else {
                    ModeInfoCard(
                        modeId = selectedMode, players = playerCount,
                        // iOS: cached completions answer instantly; the rank confirms.
                        played = completions[selectedMode] != null || userRank != null,
                        onPlay = onPlay,
                    )
                }
                Spacer(Modifier.height(LB_CARD_GAP))
            }
            // §2.3 / C2: ONE result card — crown + your rank (true total; shows even when you
            // sit outside the visible top 50), how you solved it, your points. For SWEEP this
            // is your daily-sweep rank.
            (if (isSweep) sweepRank else userRank)?.let { rank ->
                item(key = "result") {
                    val myPoints = if (isSweep) mySweep?.totalScore
                        else myEntry?.compositeScore ?: completions[selectedMode]?.score
                    val solved = if (isSweep) mySweep?.let { sweepSolvedLine(it.isFlawless, it.modesWon, it.totalTime, com.wordocious.app.todayLocalDate()) }
                    else myEntry?.let { solvedLine(selectedMode, it.completed, it.guessCount, it.timeSeconds, it.boardsSolved, it.totalBoards) }
                        ?: completions[selectedMode]?.let { solvedLine(selectedMode, it.completed, it.guessCount, it.timeSeconds) }
                    UserRankCard(
                        rank = rank.rank, total = rank.totalPlayers, mode = selectedMode,
                        friends = friendsOnly && !isSweep, points = myPoints, solvedLine = solved,
                    )
                    Spacer(Modifier.height(LB_CARD_GAP))
                }
            }
            // §2.2 Your board for this mode (the replay, collapsible), tinted, under the result.
            if (!isSweep) {
                item(key = "completed-$selectedMode") {
                    com.wordocious.app.ui.game.CompletedDailyBoard(selectedMode)
                }
            }
            // §2.4 TODAY'S BOARD: label + Everyone | Friends + the bare 3D share icon.
            item(key = "board-head") {
                Row(
                    Modifier.fillMaxWidth().padding(start = 4.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    LbBoardLabel("TODAY’S BOARD", Modifier.weight(1f).semantics { heading() })
                    // FRIENDS toggle (§207) — per-mode boards only, as before.
                    if (!isSweep && userId != null) {
                        FriendsSegment(friendsOnly) { selectFriendsOnly(it) }
                    }
                    val canShare = if (isSweep) !loading && sweepEntries.isNotEmpty() else !boardLoading && entries.isNotEmpty()
                    if (canShare) {
                        SoftControl(
                            Icon3DName.SHARE,
                            contentDescription = if (isSweep) "Share sweep board" else "Share leaderboard",
                            alpha = if (sharingLb) 0.4f else 1f,
                            onClick = {
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
                        )
                    }
                }
            }
            // Leaderboard body: one cream card — the top-3 podium, then soft striped rows.
            item(key = "board") {
                if (boardLoading) {
                    // Web parity: animate-pulse skeleton rows, not a spinner.
                    Column(Modifier.lbBoardCard().padding(horizontal = 12.dp, vertical = 10.dp)) { LeaderboardSkeleton() }
                } else if (isSweep) {
                    if (sweepEntries.isEmpty()) {
                        EmptyBoardCard("No sweeps yet today. Be the first!")
                    } else {
                        Column(Modifier.lbBoardCard()) {
                            sweepEntries.forEachIndexed { index, entry ->
                                SweepRow(
                                    rank = index + 1, entry = entry,
                                    isCurrentUser = entry.userId == userId,
                                    onOpenProfile = onOpenProfile,
                                    scoreLabel = sweepScoreLabels[entry.totalScore],
                                    details = sweepDetails[entry.userId],
                                    day = com.wordocious.app.todayLocalDate(),
                                    flawlessStreak = flawlessStreaks[entry.userId] ?: 0,
                                    index = index,
                                )
                            }
                        }
                    }
                } else if (entries.isEmpty()) {
                    if (friendsOnly && ghostFriends.isNotEmpty()) {
                        // Nobody's played yet — the friends list still renders
                        // as ghost rows so the board feels alive (and tauntable).
                        Column(Modifier.lbBoardCard()) {
                            ghostFriends.forEachIndexed { index, f ->
                                GhostFriendRow(f, onOpenProfile, index = index) { tauntTarget = f }
                            }
                        }
                    } else {
                        // R asleep on an empty board; I's invite scene on an empty Friends board (ART_SPEC §7).
                        SceneEmptyState(
                            if (friendsOnly) SceneArt.INVITE else SceneArt.ASLEEP,
                            if (friendsOnly) Mascots.addFriendLine else "No daily results yet. Be the first!",
                            Modifier.lbBoardCard().padding(vertical = 24.dp, horizontal = 16.dp),
                            height = 120.dp,
                            color = lbSubInk(),
                        ) {
                            // Empty Friends board → recruit (§207 Tier 2, web parity).
                            if (friendsOnly) {
                                CandyButton(
                                    "Add friends", onClick = onOpenFriends,
                                    color = CandyColor.PURPLE, size = CandySize.MEDIUM,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                        }
                    }
                } else {
                    Column(Modifier.lbBoardCard()) {
                        // C2: the top three on the medal podium (the Everyone board; the
                        // Friends board keeps every friend as a tauntable row instead).
                        val podium = !friendsOnly
                        if (podium) {
                            MedalPodium(
                                entries.take(3).mapIndexed { i, e ->
                                    PodiumSpot(
                                        place = i + 1,
                                        name = if (e.userId == userId) "You" else (e.username ?: "Player"),
                                        points = lbScoreLabels[e.compositeScore] ?: formatScore(e.compositeScore),
                                        username = e.username ?: "Player",
                                        emoji = e.profiles?.avatarEmoji,
                                        onClick = { onOpenProfile(e.userId) },
                                    )
                                },
                            )
                        }
                        val rows = if (podium) entries.drop(3) else entries
                        val first = if (podium) 3 else 0
                        rows.forEachIndexed { i, entry ->
                            val index = first + i
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
                                index = i,
                                topRule = !(podium && i == 0),
                            )
                        }
                        // "Your neighborhood" — rows around the user's rank when
                        // they placed past the top 50 (web/iOS parity).
                        rankWindow?.let { win ->
                            NeighborhoodGap()
                            win.entries.forEachIndexed { index, entry ->
                                LeaderboardRow(
                                    rank = win.startRank + index, entry = entry, mode = selectedMode,
                                    isCurrentUser = entry.userId == userId,
                                    onOpenProfile = onOpenProfile,
                                    scoreLabel = lbScoreLabels[entry.compositeScore],
                                    index = index,
                                )
                            }
                        }
                        // FRIENDS ghost rows — friends who haven't played this
                        // mode today, muted, with the taunt bell (§207).
                        if (friendsOnly) {
                            ghostFriends.forEachIndexed { i, f ->
                                GhostFriendRow(f, onOpenProfile, index = rows.size + i) { tauntTarget = f }
                            }
                        }
                    }
                }
            }
            // §2.5 YESTERDAY'S WINNERS (collapsible) — per-mode top 3, or yesterday's
            // top sweepers when the Sweep tile is selected. One cream card: the caps
            // header (chevron + bare share) and, open, the striped rows under it.
            item(key = "yesterday") {
                Spacer(Modifier.height(16.dp))
                Column(Modifier.lbBoardCard()) {
                    Row(
                        Modifier.fillMaxWidth().padding(start = 14.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(
                            Modifier.weight(1f)
                                .squishClickable(
                                    label = "Yesterday's winners, " + if (showYesterday) "expanded" else "collapsed",
                                ) {
                                    showYesterday = !showYesterday
                                    if (showYesterday) paintCachedYesterday(selectedMode)
                                }
                                .padding(vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LbBoardLabel("YESTERDAY’S WINNERS")
                            Spacer(Modifier.width(4.dp))
                            Icon(
                                if (showYesterday) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                                null, tint = if (WTheme.isDark) WTheme.textSecondary else LB_SECTION_INK, modifier = Modifier.size(18.dp),
                            )
                        }
                        // Settled-podium share — only once the dropdown is open with
                        // rows (web parity). The Sweep tile shares yesterday's
                        // sweep podium instead (§231).
                        if (showYesterday && (if (isSweep) yesterdaySweep else yesterday).isNotEmpty()) {
                            SoftControl(
                                Icon3DName.SHARE, contentDescription = "Share yesterday's podium",
                                alpha = if (sharingPodium) 0.4f else 1f,
                                onClick = {
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
                            )
                        }
                    }
                    if (showYesterday) {
                        if (yesterdayPending) {
                            // Not this mode's rows yet — the empty-state's footprint, blank, instead
                            // of the previous mode's podium or a false "No results" (founder, 2026-09-29).
                            Text(
                                " ", fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                modifier = Modifier.fillMaxWidth().padding(24.dp),
                            )
                        } else if (isSweep) {
                            if (yesterdaySweep.isEmpty()) {
                                LbEmptyLine("No sweeps yesterday")
                            } else {
                                yesterdaySweep.forEachIndexed { i, e ->
                                    SweepRow(
                                        rank = e.rank.toInt(), entry = e,
                                        isCurrentUser = e.userId == userId,
                                        onOpenProfile = onOpenProfile,
                                        scoreLabel = ySweepScoreLabels[e.totalScore],
                                        details = ySweepDetails[e.userId],
                                        day = com.wordocious.app.yesterdayLocalDate(),
                                        flawlessStreak = yFlawlessStreaks[e.userId] ?: 0,
                                        index = i, topRule = true,
                                    )
                                }
                            }
                        } else if (yesterday.isEmpty()) {
                            LbEmptyLine("No results from yesterday")
                        } else {
                            // Full daily rows (founder ask, Aug 11): profile
                            // taps, guesses + time detail, W/L badge column.
                            yesterday.forEachIndexed { i, e ->
                                LeaderboardRow(
                                    // §217: exact (score, time) ties share the rank.
                                    rank = LeaderboardService.competitionRank(yesterday, i),
                                    entry = e, mode = selectedMode,
                                    isCurrentUser = e.userId == userId,
                                    onOpenProfile = onOpenProfile,
                                    scoreLabel = yLbScoreLabels[e.compositeScore],
                                    index = i, topRule = true,
                                )
                            }
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

/** The page's side padding (the headline bleeds past it to the screen edges). */
internal val LB_SIDE = 12.dp

/** "···" between the top-50 rows and your neighborhood window. */
@Composable
internal fun NeighborhoodGap() {
    Text(
        "···", fontSize = 16.sp, fontWeight = FontWeight.Black,
        color = if (WTheme.isDark) WTheme.textMuted else LB_RANK_INK,
        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)
            .semantics { contentDescription = "Rows around your rank" },
    )
}

/** A short muted line in a board card (yesterday's empty states). */
@Composable
internal fun LbEmptyLine(text: String) {
    Text(
        text, fontSize = 13.sp, fontWeight = FontWeight.Bold,
        color = lbSubInk(), modifier = Modifier.fillMaxWidth().padding(24.dp),
        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
    )
}

/** §212: photo → emoji → initial, left of every username (web lbAvatar twin). */
@Composable
internal fun LbAvatar(
    avatarUrl: String?, avatarEmoji: String?, username: String, size: Dp = 24.dp,
    /** AA2: the Pro ring + crown (rows carry no Pro flag, so: the signed-in Pro player's own rows). */
    pro: Boolean = isOwnProAvatar(username),
) {
    // AH/AN: a worn character or saved mascot beats the photo.
    val url = avatarUrl?.takeIf { it.isNotBlank() && !com.wordocious.app.data.MascotAvatars.wearsMascot(username) }
    if (url == null) {
        // AN5: no photo → the player's mascot with their initial.
        LetterTileAvatar(username, size, emoji = avatarEmoji, pro = pro)
        return
    }
    // AN6: the photo is a rounded square with the player's frame.
    PhotoAvatar(url, size, frame = com.wordocious.app.data.MascotAvatars.photoFrame(username), pro = pro)
}

/** Section label (Records' caps labels): the board label style. */
@Composable
internal fun LbSectionLabel(text: String, modifier: Modifier = Modifier) = LbBoardLabel(text, modifier)

/** Everyone | Friends (§207 toggle) as the tinted segmented control. */
@Composable
private fun FriendsSegment(friendsOnly: Boolean, onChange: (Boolean) -> Unit) =
    SoftSegment(listOf(false to "Everyone", true to "Friends"), friendsOnly, onChange)

/**
 * The play card (FINISH_SPEC C2, mockup `.card` + `.play`): a tinted card in the game's
 * own accent with its top bar; the game's title art on the left with "N players today"
 * under it, and a MEDIUM candy pill on the right — VIEW BOARD (eye) once today's daily
 * is done (the route reconstructs the finished board), else PLAY. Never the old blob.
 */
@Composable
private fun ModeInfoCard(modeId: String, players: Int, played: Boolean, onPlay: (com.wordocious.core.GameMode) -> Unit) {
    val card = modeCardForKey(modeId)
    val accent = card?.accent ?: Color(0xFF7C3AED)
    LbTintedCard(accent, contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                // ART_SPEC §10 / §14: the selected game's title art (lettering + host).
                val titleArt = gameTitleArtResForKey(modeId)
                if (titleArt != null) {
                    FittedGameTitleArt(
                        titleArt, card?.title ?: gameTitleLabelForKey(modeId),
                        maxHeight = GAME_TITLE_ART_CARD_HEIGHT, alignment = Alignment.CenterStart, heading = false,
                    )
                } else Text(
                    card?.title ?: modeTitleForKey(modeId), fontSize = 18.sp, fontWeight = FontWeight.Black, color = lbNameInk(),
                    maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                )
                Text(
                    "$players player${if (players != 1) "s" else ""} today",
                    fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = lbSubInk(), maxLines = 1,
                )
                // Founder-approved clarity (iOS parity): this board ranks DAILY games only.
                Text("Daily games only", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = lbSubInk(), maxLines = 1)
            }
            card?.engineMode?.let { gm ->
                CandyButton(
                    text = if (played) "VIEW BOARD" else "PLAY",
                    onClick = { onPlay(gm) },
                    color = CandyColor.PURPLE,
                    size = CandySize.MEDIUM,
                    icon = if (played) CandyIcon.EYE else CandyIcon.PLAY,
                    contentDescription = if (played) "View your ${card.title} board" else "Play ${card.title}",
                )
            }
        }
    }
}

/** The Sweep board's card (same family, gold): the broom game icon + the ranking explanation (§223). */
@Composable
private fun SweepInfoCard(sweepers: Int) {
    LbTintedCard(LB_SWEEP_GOLD) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            androidx.compose.foundation.Image(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.game_sweep), null,
                modifier = Modifier.size(48.dp),
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    "Daily Sweep", fontSize = 18.sp, fontWeight = FontWeight.Black, color = lbNameInk(), maxLines = 1,
                    modifier = Modifier.semantics { heading() },
                )
                // §223 microcopy: pre-answers "why is 9/9 below 8/9" — the board ranks by points, not wins.
                Text(
                    "Ranked by total points across all modes",
                    fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = lbSubInk(),
                )
                if (sweepers > 0) {
                    Text(
                        "$sweepers sweeper${if (sweepers == 1) "" else "s"} today",
                        fontSize = 10.sp, fontWeight = FontWeight.Bold, color = lbSubInk(), maxLines = 1,
                    )
                }
            }
        }
    }
}

/**
 * C2 Your rank as THE result card (gold): crown over "#rank", "OF N TODAY" (or friends,
 * [totalNoun]) + the movement pill, [solvedLine] (how you solved it), your points.
 */
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
    /** How you solved it ("Solved in 4 guesses · 48s"); null = no line. */
    solvedLine: String? = null,
) {
    val top = if (showTopPercent && total > 1) " · TOP ${maxOf(1, Math.round(rank.toDouble() / total * 100).toInt())}%" else ""
    LbResultCard(
        rank = rank,
        ofLine = (if (friends) "OF $total FRIENDS" else "OF $total $totalNoun") + top,
        solvedLine = solvedLine,
        points = points?.let { formatScore(it) },
        delta = if (showDelta) {
            // Transient "+N/−N" movement pill since you last looked (web parity). Friends
            // mode keeps its own memory — a friend rank never compares against a global one (§207).
            { RankDeltaBadge(mode = mode, playType = playType, pageKey = pageKey, currentRank = rank) }
        } else null,
    )
}

/**
 * C2 "Solved in 4 guesses · 48s" — how you solved today's board, read through the mode's
 * guess semantics (More Games §18: "Solved · 0 mistakes · 1m 2s"); a missed board reads
 * "Not solved · 6 guesses · 2m 10s", a multi-board miss adds its boards ("3/4 boards").
 */
internal fun solvedLine(
    mode: String,
    completed: Boolean,
    guessCount: Int,
    timeSeconds: Int,
    boardsSolved: Int = if (completed) 1 else 0,
    totalBoards: Int = 1,
): String {
    val meta = com.wordocious.app.ModeGen.byDbKey(mode)
    val semantics = meta?.guessSemantics ?: "guesses"
    val stat = formatGuessStat(semantics, meta?.guessBase ?: 1, guessCount)
    val time = formatShortTime(timeSeconds)
    return when {
        completed && semantics == "guesses" -> "Solved in $stat · $time"
        completed -> "Solved · $stat · $time"
        totalBoards > 1 -> "$boardsSolved/$totalBoards boards · $stat · $time"
        else -> "Not solved · $stat · $time"
    }
}

/** C2 the Sweep's "how": "Flawless sweep · 12m 4s" or "Won 7 of 8 · 12m 4s". */
internal fun sweepSolvedLine(flawless: Boolean, modesWon: Int, totalTime: Int, day: String): String {
    val n = com.wordocious.app.ModeGen.requiredSweepCount(day)
    val time = formatShortTime(totalTime)
    return if (flawless) "Flawless sweep · $time" else "Won $modesWon of $n · $time"
}

/** GOLD "FLAWLESS" (won all 9) vs VIOLET "SWEEP" (completed all 9 but lost ≥1)
 *  pill. Gold #d97706 / violet #a78bfa per spec, on a tinted wash so it reads in
 *  both light + dark themes. */
@Composable
private fun SweepPill(flawless: Boolean, streak: Int = 0) {
    val fg = if (flawless) Color(0xFFD97706) else Color(0xFF8B5CF6)
    Box(
        Modifier.clip(RoundedCornerShape(6.dp))
            .background(fg.copy(alpha = 0.15f))
            .border(1.dp, fg.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
            .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            // §248: a live streak shows its length on the pill.
            if (flawless) (if (streak >= 2) "FLAWLESS ×$streak" else "FLAWLESS") else "SWEEP",
            fontSize = 9.sp, fontWeight = FontWeight.Black, color = fg, letterSpacing = 0.04.em,
            // The §223 g/h stats squeezed this pill into wrapping ("FLAWLES\nS"
            // on Doug's phone) — a pill never wraps; the stats text ellipsizes.
            maxLines = 1, softWrap = false,
        )
    }
}

/** Empty-state card for the Sweep boards: R asleep (ART_SPEC §7 scene) on the cream card. */
@Composable
private fun EmptyBoardCard(message: String) {
    SceneEmptyState(
        SceneArt.ASLEEP, message, Modifier.lbBoardCard().padding(vertical = 24.dp, horizontal = 16.dp),
        height = 120.dp, color = lbSubInk(),
    )
}

/**
 * One Daily Sweep row — rank, avatar, name over "total time · X/9[ · Ng][ · Nh]" and
 * the §223 dot strip + FLAWLESS / SWEEP pill; the (empty) W / L column then the total
 * points in soft numbers on the right (C2a: the points line up down the list).
 */
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
    /** Stripe index within its card (C2 soft striped rows). */
    index: Int = 0,
    topRule: Boolean = index > 0,
) {
    Row(
        modifier = Modifier.squishClickable { onOpenProfile(entry.userId) }
            .lbRow(index, isCurrentUser, topRule),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LbRankNumber(rank)
        // §212: faces on the sweep boards too (RPCs have no emoji column).
        LbAvatar(entry.avatarUrl, null, entry.username ?: "Player", size = 34.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            LbRowName(entry.username ?: "Player", isCurrentUser)
            Text(
                sweepStatsLine(entry, details, day), fontSize = 12.sp, fontWeight = FontWeight.Bold,
                // §246: the hints segment fell off the row's end — wrap, never truncate.
                color = lbSubInk(), maxLines = 3,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                SweepModeDots(details, day)
                SweepPill(entry.isFlawless, flawlessStreak)
            }
        }
        ResultBadgeColumn(null)
        SoftNumber(scoreLabel ?: formatScore(entry.totalScore), 16.sp)
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

/**
 * §223: the Sweep board's dot strip — that day's sweep-era modes in mode-grid
 * order ([sweepDotModes]); an era-2 day still shows nine dots. One dot per mode,
 * graded ABSOLUTELY — intensity is the score as a fraction of that mode's
 * theoretical ceiling ([DailyScoring.modeScoreCeiling]), never a comparison to the
 * field, so the strip reads identically with three players or three thousand
 * (founder call, Aug 18). Red = loss, hollow = not played. The [0.35, 0.9] remap
 * spreads real-world ratios (~0.4–0.9) across the full visual range. Renders
 * nothing until details land — the row never waits on the detail fetch.
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
                d == null -> Box(dot.border(1.dp, if (WTheme.isDark) WTheme.border else Color(0xFFD9C3A8), CircleShape))
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

/** One all-time sweep row — total sweeps (soft number) over "N flawless · {time}". */
@Composable
internal fun AllTimeSweepRow(
    rank: Int, entry: LeaderboardService.AllTimeSweepEntry, isCurrentUser: Boolean,
    onOpenProfile: (String) -> Unit = {},
    index: Int = 0,
) {
    Row(
        modifier = Modifier.squishClickable { onOpenProfile(entry.userId) }.lbRow(index, isCurrentUser),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LbRankNumber(rank)
        // §212: faces on the sweep boards too (RPCs have no emoji column).
        LbAvatar(entry.avatarUrl, null, entry.username ?: "Player", size = 34.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            LbRowName(entry.username ?: "Player", isCurrentUser)
            // iOS appends the time unprefixed and always (0 renders as "0s").
            Text(
                "${entry.flawlessCount} flawless · ${fmtTime(entry.bestSweepTime)}",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = lbSubInk(), maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
        }
        ResultBadgeColumn(null)
        Column(horizontalAlignment = Alignment.End) {
            SoftNumber("${entry.sweepCount}", 16.sp)
            Text(
                if (entry.sweepCount == 1) "SWEEP" else "SWEEPS", fontSize = 9.sp, fontWeight = FontWeight.Black,
                letterSpacing = 0.1.em, color = if (WTheme.isDark) WTheme.textSecondary else LB_LABEL, maxLines = 1,
            )
        }
    }
}

/**
 * A board row's shell (Leaderboard + Records): soft stripes by [index], your own row
 * the stronger gold tint (C2). Kept as the old name for the Records rows.
 */
internal fun Modifier.lbRowShell(isCurrentUser: Boolean, index: Int = 1): Modifier = lbRow(index, isCurrentUser)

/** [lbStripedRow] with an explicit top hairline choice (the first row under a podium / header). */
internal fun Modifier.lbRow(index: Int, isCurrentUser: Boolean, topRule: Boolean = index > 0): Modifier =
    lbStripedRow(index, isCurrentUser, topRule)

/** The row's name: ONE Text (an AnnotatedString) for name + crown + " (you)" — as siblings, a
 *  squeezed row wrapped " (you)" one character per line (iOS `Text + Text` parity). */
@Composable
private fun LbRowName(name: String, isCurrentUser: Boolean, crown: Boolean = false) {
    Text(
        androidx.compose.ui.text.buildAnnotatedString {
            append(name)
            // §216: the week's leader wears the crown (friends board).
            if (crown) { append(" "); appendIcon3D(Icon3DName.CROWN) }
            if (isCurrentUser) {
                withStyle(androidx.compose.ui.text.SpanStyle(color = Color(0xFFD97706))) { append(" (you)") }
            }
        },
        fontSize = 15.sp, fontWeight = FontWeight.Black, color = lbNameInk(),
        maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
        inlineContent = icon3DInline(),
    )
}

/**
 * One board row (mockup `.lrow`, C2 / C2a): rank, letter-tile avatar, name over its
 * subtitle ("4 Guesses · 48s"), the W / L badge in its own column immediately left of
 * the points (soft numbers, right-aligned), then the friends-board taunt bell. The
 * whole row opens the profile and squishes.
 */
@Composable
internal fun LeaderboardRow(
    rank: Int, entry: LeaderboardService.LeaderboardEntry, mode: String, isCurrentUser: Boolean,
    onOpenProfile: (String) -> Unit = {}, playType: String = "solo", showHints: Boolean = true,
    onTaunt: (() -> Unit)? = null, scoreLabel: String? = null, crownId: String? = null,
    /** Stripe index within its card (C2 soft striped rows). */
    index: Int = 0,
    topRule: Boolean = index > 0,
) {
    Row(
        modifier = Modifier.squishClickable { onOpenProfile(entry.userId) }
            .lbRow(index, isCurrentUser, topRule),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LbRankNumber(rank)
        // §212: photo → emoji → initial, left of every username.
        LbAvatar(entry.profiles?.avatarUrl, entry.profiles?.avatarEmoji, entry.username ?: "Player", size = 36.dp)
        // Doug's Aug-16 feedback: name on top, stats underneath, the score alone on the
        // right — the name gets the row's flexible width.
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            LbRowName(entry.username ?: "Player", isCurrentUser, crown = entry.userId == crownId)
            Text(
                // VS records show the head-to-head W/L tally instead of the solo
                // guesses/time (web records page parity).
                if (playType == "vs") "${entry.vsWins}W / ${entry.vsGames}G" else rowDetail(entry, mode, showHints),
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = lbSubInk(),
                maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
        }
        // C2a: the W / L badge in its own column, left of the points (none on VS rows).
        ResultBadgeColumn(if (playType == "vs") null else entry.completed)
        SoftNumber(scoreLabel ?: formatScore(entry.compositeScore), 16.sp)
        // Friends board: one-tap canned taunt on any friend's row (§207).
        if (onTaunt != null) {
            SoftControl(Icon3DName.BELL, "Taunt ${entry.username ?: "friend"}", onTaunt, iconSize = 18.dp,
                modifier = Modifier.width(34.dp))
        }
    }
}

/** FRIENDS ghost row (§207) — a friend who hasn't played this mode today, muted in
 *  the striped row shell. The taunt bell is the point (it stays full strength). */
@Composable
internal fun GhostFriendRow(
    friend: FriendsService.FriendProfile,
    onOpenProfile: (String) -> Unit = {},
    index: Int = 0,
    onTaunt: () -> Unit,
) {
    Row(
        Modifier.squishClickable { onOpenProfile(friend.id) }.lbRow(index, isCurrentUser = false),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            Modifier.weight(1f).alpha(0.55f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "–", fontSize = 15.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textMuted else LB_RANK_INK,
                modifier = Modifier.width(28.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            LbAvatar(friend.avatarUrl, null, friend.username, size = 36.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                LbRowName(friend.username, isCurrentUser = false)
                Text("Hasn't played yet", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = lbSubInk(), maxLines = 1)
            }
            ResultBadgeColumn(null)
        }
        SoftControl(Icon3DName.BELL, "Nudge ${friend.username}", onTaunt, iconSize = 18.dp, modifier = Modifier.width(34.dp))
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
