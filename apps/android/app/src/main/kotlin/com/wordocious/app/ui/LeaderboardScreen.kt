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
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
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

internal val MODE_OPTIONS = listOf(
    "DUEL" to "Classic", "QUORDLE" to "QuadWord", "OCTORDLE" to "OctoWord",
    "SEQUENCE" to "Succession", "RESCUE" to "Deliverance",
    "DUEL_6" to "Six", "DUEL_7" to "Seven",
    "GAUNTLET" to "Gauntlet", "PROPERNOUNDLE" to "ProperNoundle",
    // Synthetic 10th picker id (NOT a `:core` GameMode) — the Daily Sweep board,
    // shown only on the Leaderboard + Records pickers, never the Home grid.
    SWEEP_ID to "Sweep",
)

/** Synthetic picker id for the Daily Sweep leaderboard. `GameMode.valueOf(SWEEP_ID)`
 *  THROWS — every picker-reachable valueOf must short-circuit on this first. */
internal const val SWEEP_ID = "SWEEP"

/** §214 (Lindsay): the post-game "View Leaderboard" capsule lands on this
 *  tab with its mode preselected — set before switching tabs, consumed once. */
object LeaderboardDeepLink {
    val pendingMode = androidx.compose.runtime.mutableStateOf<String?>(null)
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
    if (id == SWEEP_ID) null
    else runCatching { com.wordocious.core.GameMode.valueOf(id) }.getOrNull()

/**
 * Leaderboard screen — ported from the web /daily page.
 * Shows today's daily leaderboard for a selected game mode with:
 * - Mode picker row, countdown timer
 * - User's current rank card
 * - Top 50 entries with rank badges (🥇🥈🥉 for top 3), username, score, guesses/time
 */
@Composable
fun LeaderboardScreen(onOpenProfile: (String) -> Unit = {}, onPlay: (com.wordocious.core.GameMode) -> Unit = {}, onOpenFriends: () -> Unit = {}) {
    val isAuthenticated by AuthService.isAuthenticated.collectAsState()

    // Signed-out gate (iOS ProfileTab `signedOut`): guests get a trophy
    // placeholder + Sign in instead of the live board.
    if (!isAuthenticated) {
        Column(
            Modifier.fillMaxSize().background(WTheme.bg).padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.weight(1f))
            Icon(
                Icons.Filled.EmojiEvents, null,
                tint = WTheme.primary.copy(alpha = 0.7f), modifier = Modifier.size(56.dp),
            )
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

    var selectedMode by remember { mutableStateOf("DUEL") }
    // §214: consume a post-game deep link (View Leaderboard → this mode).
    LaunchedEffect(LeaderboardDeepLink.pendingMode.value) {
        LeaderboardDeepLink.pendingMode.value?.let { m ->
            selectedMode = m
            LeaderboardDeepLink.pendingMode.value = null
        }
    }
    var entries by remember { mutableStateOf<List<LeaderboardService.LeaderboardEntry>>(emptyList()) }
    var yesterday by remember { mutableStateOf<List<LeaderboardService.LeaderboardEntry>>(emptyList()) }
    var yesterdaySweep by remember { mutableStateOf<List<LeaderboardService.SweepEntry>>(emptyList()) }
    var showYesterday by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    val userId = AuthService.profile.value?.id

    var playerCount by remember { mutableStateOf(0) }
    // Rank banner ("You're ranked #N of M") — web getUserDailyRank parity:
    // true total even past a full page, and a computed rank when the user
    // sits outside the top 50.
    var userRank by remember { mutableStateOf<LeaderboardService.RankInfo?>(null) }
    // "Your neighborhood" rows when the user placed past the top-50 list
    // (e.g. #425 sees ~421–429 below a "···" separator, own row highlighted).
    var rankWindow by remember { mutableStateOf<LeaderboardService.RankWindow?>(null) }
    // Daily Sweep board (10th "Sweep" tile) — RPC-backed, separate from the
    // per-mode `daily_results` path above. Only populated when SWEEP is selected.
    val isSweep = selectedMode == SWEEP_ID
    var sweepEntries by remember { mutableStateOf<List<LeaderboardService.SweepEntry>>(emptyList()) }
    var sweepRank by remember { mutableStateOf<LeaderboardService.RankInfo?>(null) }
    // §223: per-user dot-strip details (per-mode score/win + guess/hint totals)
    // for today's and yesterday's sweep rows, keyed by user id. A missing entry
    // renders a row without dots or g/h — the detail fetch never blocks a row.
    var sweepDetails by remember { mutableStateOf<Map<String, LeaderboardService.SweepDetails>>(emptyMap()) }
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
                playerCount = cachedSweep.entries.size
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
            playerCount = rows.size
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
        // FRIENDS board (§207): one fetch restricted to friends∪me holds the
        // whole board — rank is the dense index, no rank query or window.
        if (friends) {
            val ids = (FriendsService.friendIds + userId!!.lowercase()).toList()
            val lbF = LeaderboardService.fetchDailyLeaderboardOrNull(mode, day = day, userIds = ids)
            ensureActive()
            if (lbF == null) { loading = false; return@LaunchedEffect }
            entries = lbF
            playerCount = lbF.size
            loading = false
            val idx = lbF.indexOfFirst { it.userId == userId }
            // §217: exact (score, time) ties share the rank on the friends board too.
            val rank = if (idx >= 0) LeaderboardService.RankInfo(LeaderboardService.competitionRank(lbF, idx), lbF.size) else null
            userRank = rank
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
        entries = lb
        playerCount = count
        loading = false
        val rank = if (userId != null) {
            LeaderboardService.getUserDailyRank(userId, mode, day = day, topEntries = lb)
        } else null
        ensureActive()
        userRank = rank
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
    }

    val modeLabel = MODE_OPTIONS.firstOrNull { it.first == selectedMode }?.second ?: selectedMode

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

    Column(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        // iOS keeps the title, countdown and mode grid INSIDE the scroll
        // container (ProfileTab `content`), so scrolling the board reclaims
        // their height instead of leaving them pinned to the top.
        LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
            // (Shared AppHeader is above.) Page title: DAILY CHALLENGE + countdown.
            item {
                // §227 (founder side-by-side): iOS `header` is VStack(spacing: 4),
                // 28pt black with -0.5 tracking, 4pt under it, inside the 8pt
                // content inset — same numbers here.
                Column(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        "DAILY CHALLENGE", fontSize = 28.sp, fontWeight = FontWeight.Black,
                        letterSpacing = (-0.5).sp,
                        style = TextStyle(brush = WTheme.wordmarkGradient, fontFamily = Nunito),
                    )
                    DailyCountdownChip()
                }
            }
            // Mode picker — the LazyColumn already supplies the 12.dp gutter.
            item { ModePickerRow(selectedMode, horizontalPadding = 0.dp) { selectedMode = it } }
            // Play CTA + your-board are per-mode; the Sweep board has no single
            // mode to play or a completed grid, so both are skipped for it.
            if (!isSweep) {
                // Play CTA card — mode icon + "{n} players today" + Play button.
                item {
                    ModeInfoCard(
                        modeId = selectedMode, players = playerCount,
                        // iOS: cached completions answer instantly; the rank confirms.
                        played = completions[selectedMode] != null || userRank != null,
                        onPlay = onPlay,
                    )
                    Spacer(Modifier.height(12.dp))
                }
                // Completed-daily dropdown (your board for this mode), web parity:
                // collapsible "Completed/Attempted Today" card above the user rank.
                item(key = "completed-$selectedMode") {
                    com.wordocious.app.ui.game.CompletedDailyBoard(selectedMode)
                }
            }
            // User rank — "You're ranked #N of M" (true total; shows even when
            // the user is outside the visible top 50, web/iOS parity). For SWEEP
            // this is the user's daily-sweep rank.
            (if (isSweep) sweepRank else userRank)?.let { rank ->
                item {
                    UserRankCard(rank = rank.rank, total = rank.totalPlayers, mode = selectedMode, friends = friendsOnly && !isSweep)
                    Spacer(Modifier.height(12.dp))
                }
            }
            // Leaderboard label
            item {
                // iOS relabels the section when the cross-mode Sweep board is up.
                if (isSweep) {
                    Row(
                        Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "DAILY SWEEP", fontSize = 10.sp, fontWeight = FontWeight.Black,
                            color = WTheme.textMuted, letterSpacing = 0.8.sp,
                        )
                        // §223 microcopy (web "Daily games only" slot): pre-answers
                        // "why is 9/9 below 8/9" — the board ranks by points, not wins.
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                "Ranked by total points across all modes",
                                fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                            )
                            // Today's sweep-board share (§231) — the RPC rows
                            // and the sharer's sweep rank are already on the page.
                            if (!loading && sweepEntries.isNotEmpty()) {
                                Icon(
                                    Icons.Filled.Share, "Share sweep board",
                                    tint = WTheme.textMuted.copy(alpha = if (sharingLb) 0.4f else 1f),
                                    modifier = Modifier.size(14.dp).clickableNoRipple {
                                        if (!sharingLb) {
                                            sharingLb = true
                                            shareScope.launch {
                                                try {
                                                    com.wordocious.app.data.LeaderboardShare.shareDailySweepCard(
                                                        shareContext, sweepEntries, userId, sweepRank,
                                                    )
                                                } finally { sharingLb = false }
                                            }
                                        }
                                    },
                                )
                            }
                        }
                    }
                } else {
                    // Founder-approved clarity (iOS parity): this board ranks
                    // DAILY games only — Unlimited runs never appear here.
                    Row(
                        Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "LEADERBOARD", fontSize = 10.sp, fontWeight = FontWeight.Black,
                            color = WTheme.textMuted, letterSpacing = 0.8.sp,
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            // FRIENDS toggle (§207) — segmented shell, compact.
                            if (userId != null) {
                                val accent = Color(0xFF7C3AED)
                                Row(
                                    Modifier.clip(RoundedCornerShape(8.dp))
                                        .border(1.5.dp, WTheme.border, RoundedCornerShape(8.dp)),
                                ) {
                                    listOf(false, true).forEach { f ->
                                        val sel = friendsOnly == f
                                        Text(
                                            if (f) "Friends" else "All",
                                            fontSize = 9.sp, fontWeight = FontWeight.Black,
                                            color = if (sel) accent else WTheme.textMuted,
                                            modifier = Modifier
                                                .background(if (sel) accent.copy(alpha = 0.08f) else WTheme.surface)
                                                .clickableNoRipple { friendsOnly = f }
                                                .padding(horizontal = 8.dp, vertical = 3.dp),
                                        )
                                    }
                                }
                            }
                            Text(
                                "Daily games only", fontSize = 9.sp, fontWeight = FontWeight.Bold,
                                color = WTheme.textMuted,
                            )
                            // Today's-board share (web: Share icon beside the caption).
                            if (!loading && entries.isNotEmpty()) {
                                Icon(
                                    Icons.Filled.Share, "Share leaderboard",
                                    tint = WTheme.textMuted.copy(alpha = if (sharingLb) 0.4f else 1f),
                                    modifier = Modifier.size(14.dp).clickableNoRipple {
                                        if (!sharingLb) {
                                            sharingLb = true
                                            shareScope.launch {
                                                try {
                                                    com.wordocious.app.data.LeaderboardShare.shareDailyLeaderboardCard(
                                                        shareContext, selectedMode, "solo",
                                                        entries, rankWindow, userId, userRank,
                                                        friends = friendsOnly,
                                                    )
                                                } finally { sharingLb = false }
                                            }
                                        }
                                    },
                                )
                            }
                        }
                    }
                }
            }
            // Leaderboard body
            if (loading) {
                // Web parity: animate-pulse skeleton rows, not a spinner.
                item { LeaderboardSkeleton() }
            } else if (isSweep) {
                if (sweepEntries.isEmpty()) {
                    item { EmptyBoardCard("No sweeps yet today. Be the first!") }
                } else {
                    item {
                        Column(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                                .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
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
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                                .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
                        ) {
                            ghostFriends.forEachIndexed { index, f ->
                                GhostFriendRow(f, onOpenProfile) { tauntTarget = f }
                                if (index < ghostFriends.size - 1) Divider()
                            }
                        }
                    } else {
                        Column(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                                .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
                                .padding(vertical = 40.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Icon(Icons.Outlined.EmojiEvents, null, tint = WTheme.textMuted.copy(alpha = 0.4f), modifier = Modifier.size(32.dp))
                            Spacer(Modifier.height(8.dp))
                            Text(
                                if (friendsOnly) "No friends yet — add them from any profile" else "No daily results yet. Be the first!",
                                color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
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
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
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
            // Yesterday's Winners (collapsible) — per-mode top 3, or yesterday's
            // top sweepers when the Sweep tile is selected.
            item {
                Spacer(Modifier.height(16.dp))
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        Modifier.clickableNoRipple { showYesterday = !showYesterday },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Yesterday's Winners", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                        Spacer(Modifier.width(4.dp))
                        Icon(
                            if (showYesterday) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                            null, tint = WTheme.textMuted, modifier = Modifier.size(16.dp),
                        )
                    }
                    // Settled-podium share — only once the dropdown is open with
                    // rows (web parity). The Sweep tile shares yesterday's
                    // sweep podium instead (§231).
                    if (showYesterday && (if (isSweep) yesterdaySweep else yesterday).isNotEmpty()) {
                        Spacer(Modifier.width(6.dp))
                        Icon(
                            Icons.Filled.Share, "Share yesterday's podium",
                            tint = WTheme.textMuted.copy(alpha = if (sharingPodium) 0.4f else 1f),
                            modifier = Modifier.size(14.dp).clickableNoRipple {
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
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
                    ) {
                        if (isSweep) {
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
private fun LbAvatar(avatarUrl: String?, avatarEmoji: String?, username: String) {
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

/** Rank icon — Crown (#1 gold), Medal (#2 muted / #3 bronze), else "N". Web parity. */
@Composable
private fun RankIcon(rank: Int) {
    when (rank) {
        1 -> Icon(
            androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown),
            null, tint = Color(0xFFD97706), modifier = Modifier.size(20.dp),
        )
        // WorkspacePremium is the rosette-medal glyph — visually the twin of
        // iOS's medal.fill / web's lucide Medal; MilitaryTech read as a
        // different icon set on Doug's screenshots.
        2 -> Icon(Icons.Filled.WorkspacePremium, null, tint = WTheme.textMuted, modifier = Modifier.size(20.dp))
        3 -> Icon(Icons.Filled.WorkspacePremium, null, tint = Color(0xFFB45309), modifier = Modifier.size(20.dp))
        // width(), NOT size(): a 20dp SQUARE constrained the height too, so a
        // 3-digit rank wrapped to a second line that was then clipped — rank
        // 425 displayed as "42". iOS uses .frame(width: 20) for exactly this.
        else -> Box(Modifier.width(20.dp), contentAlignment = Alignment.Center) {
            // iOS renders the bare number here — no "#" prefix.
            Text("$rank", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
    }
}

@Composable
private fun ModeInfoCard(modeId: String, players: Int, played: Boolean, onPlay: (com.wordocious.core.GameMode) -> Unit) {
    // Per-mode card (web /daily Play CTA): accent bar + icon + title + players
    // today + an orange Play button that launches today's daily for this mode.
    val card = MODE_CARDS.firstOrNull { it.engineMode?.name == modeId }
    val accent = card?.accent ?: WTheme.primary
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
    ) {
        Box(Modifier.fillMaxWidth().height(3.dp).background(
            Brush.horizontalGradient(listOf(accent, accent.copy(alpha = 0.5f))),
        ))
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.10f)),
                contentAlignment = Alignment.Center,
            ) {
                if (card != null) ModeGlyph(card, accent, box = 32.dp)
                else Icon(Icons.Filled.EmojiEvents, null, tint = accent, modifier = Modifier.size(16.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(card?.title ?: modeId, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Filled.People, null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp))
                    Text(
                        "$players player${if (players != 1) "s" else ""} today",
                        fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    )
                }
            }
            card?.engineMode?.let { gm ->
                Row(
                    Modifier
                        // iOS gives the CTA a 30%-accent drop shadow.
                        .shadow(
                            4.dp, RoundedCornerShape(50),
                            ambientColor = accent.copy(alpha = 0.3f), spotColor = accent.copy(alpha = 0.3f),
                        )
                        .clip(RoundedCornerShape(50))
                        .background(accent)
                        .clickableNoRipple { onPlay(gm) }
                        .padding(horizontal = 16.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    // Already finished today's daily for this mode → eye + "View"
                    // (the route already reconstructs the completed board). iOS parity.
                    Icon(
                        if (played) Icons.Filled.Visibility else Icons.Filled.PlayArrow,
                        null, tint = Color.White, modifier = Modifier.size(11.dp),
                    )
                    Text(if (played) "View" else "Play", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
        }
    }
}

@Composable
private fun DailyCountdownChip() {
    val secs by androidx.compose.runtime.produceState(
        initialValue = secondsUntilMidnight()
    ) {
        while (true) { value = secondsUntilMidnight(); kotlinx.coroutines.delay(1000) }
    }
    val h = secs / 3600; val m = (secs % 3600) / 60; val s = secs % 60
    // iOS pairs the countdown with a calendar chip carrying today's abbreviated
    // date ("Jul 29"); web parity for the clock half (no "Resets" label).
    val today = remember(secs / 3600) {
        java.text.SimpleDateFormat("MMM d", java.util.Locale.US).format(java.util.Date())
    }
    androidx.compose.foundation.layout.Row(
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp),
    ) {
        androidx.compose.foundation.layout.Row(
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(4.dp),
        ) {
            androidx.compose.material3.Icon(
                Icons.Filled.CalendarMonth, null,
                tint = WTheme.textMuted, modifier = Modifier.size(11.dp),   // iOS .system(size: 11)
            )
            Text(today, fontSize = 12.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold)
        }
        androidx.compose.foundation.layout.Row(
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(4.dp),
        ) {
            androidx.compose.material3.Icon(
                Icons.Filled.Schedule, null,
                tint = WTheme.textMuted, modifier = Modifier.size(11.dp),   // iOS .system(size: 11)
            )
            Text(
                "%02d:%02d:%02d".format(h, m, s),
                fontSize = 12.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold,
            )
        }
    }
}

/**
 * Seconds until the next LOCAL midnight — the daily resets at local midnight
 * (matches the local-date puzzle/leaderboard grouping and iOS
 * `secondsUntilLocalMidnight()`), not UTC.
 */
private fun secondsUntilMidnight(): Long {
    val cal = java.util.Calendar.getInstance().apply {
        add(java.util.Calendar.DAY_OF_YEAR, 1)
        set(java.util.Calendar.HOUR_OF_DAY, 0)
        set(java.util.Calendar.MINUTE, 0)
        set(java.util.Calendar.SECOND, 0)
        set(java.util.Calendar.MILLISECOND, 0)
    }
    return ((cal.timeInMillis - System.currentTimeMillis()) / 1000L).coerceAtLeast(0)
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
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = horizontalPadding, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // With the 10th Sweep tile the grid is a clean 5-over-5 (no centering
        // spacers). Any partial last row (should not happen at 10) is padded on
        // the right so each cell stays 1/5 width.
        MODE_OPTIONS.chunked(5).forEach { rowItems ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                rowItems.forEach { (id, _) -> ModeCell(id, selected == id, Modifier.weight(1f)) { onSelect(id) } }
                repeat(5 - rowItems.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun ModeCell(id: String, active: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    // GUARDED valueOf: SWEEP is a synthetic id (no `:core` GameMode) → indigo
    // broom tile; every other id maps to its GameMode's accent + web glyph.
    val isSweep = id == SWEEP_ID
    val mode = pickerGameModeOrNull(id)
    val accent = if (isSweep) SWEEP_ACCENT else (mode?.let { modeAccent(it) } ?: WTheme.primary)
    val short = LB_SHORT[id] ?: id
    // The cell is a FIXED 52dp tile: cap the effective fontScale at 1.3x so a
    // huge system text size can't shear the label out of the box (iOS caps its
    // dynamic type at 1.6x but also shrinks labels to fit; Compose has no
    // autosize in this BOM, so 1.3x is the honest ceiling).
    val d = androidx.compose.ui.platform.LocalDensity.current
    androidx.compose.runtime.CompositionLocalProvider(
        androidx.compose.ui.platform.LocalDensity provides
            androidx.compose.ui.unit.Density(d.density, d.fontScale.coerceAtMost(1.3f)),
    ) {
        Column(
            modifier.clip(RoundedCornerShape(12.dp))
                .background(if (active) accent.copy(alpha = 0.08f) else WTheme.surface)
                .border(1.5.dp, if (active) accent else WTheme.border, RoundedCornerShape(12.dp))
                .clickableNoRipple(onClick).height(52.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
        ) {
            // §227: iOS ModeIconView(box: 26) — radius box*0.27 (7), fill
            // accent@0.08 (this was 0.12/8dp: a heavier, rounder box than the
            // iPhone's), glyph box*0.5 (13).
            Box(Modifier.size(26.dp).clip(RoundedCornerShape(7.dp)).background(accent.copy(alpha = 0.08f)), Alignment.Center) {
                // Web-faithful mode icon (WordleGrid/IV/VIII/TrendingUp/Shield/6/7/Skull/Crown);
                // the sweep tile draws the broom line-art.
                if (isSweep) {
                    Icon(
                        androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_broom),
                        null, tint = accent, modifier = Modifier.size(13.dp),
                    )
                } else {
                    mode?.let { ModeGlyph(it, accent, box = 26.dp) }
                }
            }
            Text(
                short, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold,
                color = if (active) accent else WTheme.textMuted,
                maxLines = 1, softWrap = false,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun UserRankCard(rank: Int, total: Int, mode: String, friends: Boolean = false) {
    Box(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(WTheme.highlightGold, WTheme.surface)))
            .border(1.5.dp, WTheme.goldBorder, RoundedCornerShape(16.dp))
            .padding(12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("You're ranked ", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            // Gold on BOTH boards — iOS uses one rankBanner for per-mode + sweep.
            Text("#$rank", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color(0xFFD97706))
            // Transient "+N/−N" movement pill since you last looked (web parity).
            // Friends mode keeps its own memory — a friend-rank must never
            // compare against a stored global rank (§207).
            RankDeltaBadge(mode = mode, playType = "solo", pageKey = if (friends) "daily-friends" else "daily", currentRank = rank)
            Text(if (friends) " of $total friends" else " of $total", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
}

/** Win/Loss pill (full word "Win"/"Loss"). */
@Composable
private fun WinLossPill(completed: Boolean, abbrev: Boolean = false) {
    Box(
        Modifier.clip(RoundedCornerShape(4.dp))
            .background(if (completed) WTheme.winBg else WTheme.lossBg)
            .padding(horizontal = 5.dp, vertical = 1.dp),
    ) {
        Text(
            if (abbrev) (if (completed) "W" else "L") else (if (completed) "Win" else "Loss"),
            fontSize = 9.sp, fontWeight = FontWeight.ExtraBold,
            color = if (completed) WTheme.winText else WTheme.lossText,
        )
    }
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
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
            .padding(vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Outlined.EmojiEvents,
            null, tint = WTheme.textMuted.copy(alpha = 0.4f), modifier = Modifier.size(32.dp),
        )
        Spacer(Modifier.height(8.dp))
        Text(message, color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
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
    val bg = when {
        isCurrentUser -> WTheme.highlightGold
        rank <= 3 -> WTheme.surfaceAlt
        else -> Color.Transparent
    }
    Row(
        modifier = Modifier.fillMaxWidth().background(bg).padding(horizontal = 14.dp, vertical = 10.dp),
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
                sweepStatsLine(entry, details), fontSize = 10.sp, fontWeight = FontWeight.Bold,
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
private fun sweepStatsLine(entry: LeaderboardService.SweepEntry, details: LeaderboardService.SweepDetails?): String = buildString {
    append("${fmtTime(entry.totalTime)} · ${entry.modesWon}/9")
    if (details != null) {
        append(" · ${details.guesses} guess${if (details.guesses == 1) "" else "es"}")
        if (details.hints > 0) append(" · ${details.hints} hint${if (details.hints == 1) "" else "s"}")
    }
}

/** §223: the Sweep board's nine-dot mode strip — fixed order = the mode grid. */
private val SWEEP_DOT_MODES = listOf(
    "DUEL", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE",
    "DUEL_6", "DUEL_7", "GAUNTLET", "PROPERNOUNDLE",
)

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
        SWEEP_DOT_MODES.forEach { mode ->
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
    val bg = when {
        isCurrentUser -> WTheme.highlightGold
        rank <= 3 -> WTheme.surfaceAlt
        else -> Color.Transparent
    }
    Row(
        modifier = Modifier.fillMaxWidth().background(bg).padding(horizontal = 14.dp, vertical = 10.dp),
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

@Composable
internal fun LeaderboardRow(rank: Int, entry: LeaderboardService.LeaderboardEntry, mode: String, isCurrentUser: Boolean, onOpenProfile: (String) -> Unit = {}, playType: String = "solo", showHints: Boolean = true, onTaunt: (() -> Unit)? = null, scoreLabel: String? = null, crownId: String? = null) {
    val bg = when {
        isCurrentUser -> WTheme.highlightGold
        rank <= 3 -> WTheme.surfaceAlt
        else -> Color.Transparent
    }
    Row(
        modifier = Modifier.fillMaxWidth().background(bg).padding(horizontal = 14.dp, vertical = 10.dp),
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
                    if (entry.userId == crownId) append(" 👑")
                    if (isCurrentUser) {
                        withStyle(androidx.compose.ui.text.SpanStyle(color = Color(0xFFD97706))) { append(" (you)") }
                    }
                },
                fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
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
                sweepStatsLine(entry, details), fontSize = 10.sp, fontWeight = FontWeight.Bold,
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

/** Row detail: "{guesses} Guesses · m s [· bs/tb] [· hint label]". Mirrors web. */
private fun rowDetail(
    entry: LeaderboardService.LeaderboardEntry,
    mode: String,
    /** Records rows omit the hints segment — iOS shows it on the Leaderboard only. */
    showHints: Boolean = true,
): String {
    val sb = StringBuilder("${entry.guessCount} Guesses · ${fmtTime(entry.timeSeconds)}")
    if (entry.totalBoards > 1) sb.append(" · ${entry.boardsSolved}/${entry.totalBoards}")
    if (showHints) formatHintsLabel(mode, entry.hintsUsed)?.let { sb.append(" · $it") }
    return sb.toString()
}

private val HINT_BEARING = setOf("DUEL_6", "DUEL_7", "PROPERNOUNDLE")
private fun formatHintsLabel(mode: String, hints: Int): String? {
    if (mode !in HINT_BEARING) return null
    if (hints <= 0) return "No hints"
    return "$hints hint${if (hints == 1) "" else "s"}"
}

// fmtTime is the shared formatShortTime (ui/Format.kt) — the local copy is
// what let the t=0 rendering drift across platforms.
private fun fmtTime(s: Int): String = formatShortTime(s)
