package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.LeaderboardService
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.async
import kotlinx.coroutines.ensureActive

/**
 * Records screen — ported from web /records/page.tsx.
 * Daily tab: mode-picker + leaderboard (reuses LeaderboardService)
 * All-time tab: Hall of Fame 2x2 grid (longest streak, highest level, most medals, most completions)
 */
@Composable
fun RecordsScreen(onOpenProfile: (String) -> Unit = {}) {
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Daily", "All-Time", "You")
    val isAuthenticated by AuthService.isAuthenticated.collectAsState()

    // Signed-out gate (iOS RecordsTab): the whole tab is a crown placeholder +
    // Sign in — guests never see the boards.
    if (!isAuthenticated) {
        Column(
            Modifier.fillMaxSize().appBackground().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.weight(1f))
            Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown), null,
                tint = WTheme.primary.copy(alpha = 0.7f), modifier = Modifier.size(56.dp),
            )
            Text(
                "Sign in to see records", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Text(
                "Daily rankings and the all-time hall of records are available to signed-in players.",
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

    Column(
        modifier = Modifier.fillMaxSize().appBackground(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // (Shared AppHeader is above.) Page title per spec: RECORDS gradient.
        Text(
            "RECORDS",
            fontSize = 28.sp, fontWeight = FontWeight.Black,
            style = TextStyle(brush = WTheme.wordmarkGradient, fontFamily = Nunito),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )
        Text(
            "The best of the best across Wordocious",
            fontSize = 12.sp, color = WTheme.textMuted, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
        )

        Spacer(Modifier.height(8.dp))

        // Three pill buttons (iOS RecordsTab.toggleButton), not a Material tab strip.
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            tabs.forEachIndexed { i, title ->
                val active = tab == i
                Box(
                    Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                        .background(if (active) WTheme.surface else WTheme.surfaceHover)
                        .border(1.5.dp, if (active) WTheme.primary else WTheme.border, RoundedCornerShape(12.dp))
                        .clickableNoRipple { tab = i }.padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        title, fontSize = 12.sp, fontWeight = FontWeight.Black,
                        color = if (active) WTheme.primary else WTheme.textMuted,
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))

        when (tab) {
            0 -> DailyRecordsTab(onOpenProfile)
            1 -> AllTimeTab(onOpenProfile)
            2 -> YourRecordsTab()
        }
    }
}

@Composable
private fun DailyRecordsTab(onOpenProfile: (String) -> Unit = {}) {
    var selectedMode by remember { mutableStateOf("DUEL") }
    var playType by remember { mutableStateOf("solo") }
    var entries by remember { mutableStateOf<List<LeaderboardService.LeaderboardEntry>>(emptyList()) }
    var playerCount by remember { mutableIntStateOf(0) }
    var userRank by remember { mutableStateOf<LeaderboardService.RankInfo?>(null) }
    // "Your neighborhood" rows when the user placed past the top-50 list.
    var rankWindow by remember { mutableStateOf<LeaderboardService.RankWindow?>(null) }
    var loading by remember { mutableStateOf(true) }
    val userId = AuthService.profile.value?.id
    // Daily Sweep board (10th "Sweep" tile) — RPC path, mirrors LeaderboardScreen.
    val isSweep = selectedMode == SWEEP_ID
    var sweepEntries by remember { mutableStateOf<List<LeaderboardService.SweepEntry>>(emptyList()) }
    var sweepRank by remember { mutableStateOf<LeaderboardService.RankInfo?>(null) }

    // Re-fetch once a daily result row has LANDED on the server (recordedTick)
    // so a finished puzzle appears here immediately, without a tab round-trip
    // (the optimistic completionTick fires before the insert and cached stale).
    // L1/L2/L3 (mirrors LeaderboardScreen): session cache paints instantly,
    // rows + count fetch in parallel and paint immediately, rank fills in
    // after without blocking, and a failed fetch keeps whatever is showing.
    val tick by com.wordocious.app.data.DailyCompletionsService.recordedTick.collectAsState()
    LaunchedEffect(selectedMode, playType, tick) {
        val mode = selectedMode
        val pt = playType
        val day = com.wordocious.app.todayLocalDate()
        // Daily Sweep board takes its own RPC path (play-type is irrelevant) —
        // kept ahead of the per-mode fetch so `daily_results` never sees SWEEP.
        if (mode == SWEEP_ID) {
            loading = true
            val rows = LeaderboardService.fetchDailySweepOrNull(day)
            ensureActive()
            if (rows == null) { loading = false; return@LaunchedEffect }
            sweepEntries = rows
            playerCount = rows.size
            loading = false
            sweepRank = if (userId != null) LeaderboardService.getUserSweepRank(userId, day) else null
            ensureActive()
            return@LaunchedEffect
        }
        // Stale-while-revalidate: a chip/toggle tap or screen re-entry paints the
        // last-known rows instantly; the skeleton only shows on a true first load.
        val key = LeaderboardService.cacheKey(mode, day, userId, pt)
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

    // GUARDED valueOf: SWEEP has no `:core` GameMode → the indigo sweep accent.
    val accent = if (isSweep) SWEEP_ACCENT else runCatching { modeAccent(com.wordocious.core.GameMode.valueOf(selectedMode)) }.getOrDefault(WTheme.primary)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        ModePickerRow(selectedMode) { selectedMode = it }
        Spacer(Modifier.height(8.dp))
        // One bordered leaderboard card (iOS DailyRecordsView): accent bar →
        // mode header (+ Solo|VS toggle) → count/your-rank row → rows.
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp).clip(RoundedCornerShape(16.dp))
                .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
        ) {
            Box(Modifier.fillMaxWidth().height(3.dp).background(Brush.horizontalGradient(listOf(accent, accent.copy(alpha = 0.53f)))))
            Row(
                Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ModeIconBox(selectedMode, accent)
                Column {
                    Text(
                        if (isSweep) "Daily Sweep" else recModeTitle(selectedMode),
                        fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text,
                    )
                    Text(
                        if (isSweep) "All 9 modes today" else "Today",
                        fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    )
                }
                Spacer(Modifier.weight(1f))
                // Solo|VS is meaningless for the composite Sweep board — hide it there.
                if (!isSweep) SoloVsToggle(playType) { playType = it }
            }

            // Player count + your rank/percentile (web/iOS parity — was missing on Android).
            Row(
                Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Filled.People, null, tint = WTheme.textMuted, modifier = Modifier.size(14.dp))
                    val noun = if (isSweep) "sweeper" else "player"
                    Text("$playerCount $noun${if (playerCount == 1) "" else "s"} today", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                Spacer(Modifier.weight(1f))
                (if (isSweep) sweepRank else userRank)?.let { r ->
                    val rank = r.rank
                    val total = r.totalPlayers
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("Your rank:", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        Text("#$rank", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFFD97706))
                        // Transient "+N/−N" movement pill (iOS pageKey records-daily).
                        if (!isSweep) RankDeltaBadge(mode = selectedMode, playType = playType, pageKey = "records-daily", currentRank = rank)
                        Text(
                            if (total > 1) "of $total · top ${maxOf(1, Math.round(rank.toDouble() / total * 100).toInt())}%" else "of $total",
                            fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        )
                    }
                }
            }

            HorizontalDivider(color = WTheme.border)

            if (loading) {
                // Web parity: animate-pulse skeleton rows, not a spinner.
                Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) { LeaderboardSkeleton() }
            } else if (isSweep) {
                if (sweepEntries.isEmpty()) {
                    Column(Modifier.fillMaxWidth().padding(vertical = 30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        // The broom brands the CARD HEADER; the body's empty state
                        // uses the same trophy every other empty board uses (iOS
                        // sweepCard). Drawing the broom here repeated it twice.
                        Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.textMuted.copy(alpha = 0.5f), modifier = Modifier.size(28.dp))
                        Spacer(Modifier.height(8.dp))
                        Text("No sweeps yet today. Be the first!", color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                } else {
                    sweepEntries.forEachIndexed { i, entry ->
                        SweepRow(rank = i + 1, entry = entry, isCurrentUser = entry.userId == userId, onOpenProfile = onOpenProfile)
                        if (i < sweepEntries.size - 1) HorizontalDivider(color = WTheme.border)
                    }
                }
            } else if (entries.isEmpty()) {
                // Web parity (records page): trophy + "No results yet today. Be the first!"
                Column(Modifier.fillMaxWidth().padding(vertical = 30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.textMuted.copy(alpha = 0.3f), modifier = Modifier.size(32.dp))
                    Spacer(Modifier.height(8.dp))
                    Text("No results yet today. Be the first!", color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            } else {
                // iOS's Records row is the same guesses/time + Win/Loss line for
                // Solo and VS (dailyRow has no playType branch) — keep the solo
                // detail rather than LeaderboardRow's W/G tally.
                entries.forEachIndexed { i, entry ->
                    LeaderboardRow(rank = i + 1, entry = entry, mode = selectedMode, isCurrentUser = entry.userId == userId, showHints = false)
                    if (i < entries.size - 1) HorizontalDivider(color = WTheme.border)
                }
                // "Your neighborhood" — rows around the user's rank when they
                // placed past the top 50 (web/iOS parity).
                rankWindow?.let { win ->
                    HorizontalDivider(color = WTheme.border)
                    Text(
                        "···", fontSize = 14.sp, fontWeight = FontWeight.Black,
                        color = WTheme.textMuted,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    )
                    HorizontalDivider(color = WTheme.border)
                    win.entries.forEachIndexed { i, entry ->
                        LeaderboardRow(rank = win.startRank + i, entry = entry, mode = selectedMode, isCurrentUser = entry.userId == userId, showHints = false)
                        if (i < win.entries.size - 1) HorizontalDivider(color = WTheme.border)
                    }
                }
            }
        }
        // Yesterday's podium sits below the board card and shows even when today's
        // board is still empty (iOS DailyRecordsView).
        if (!isSweep) {
            Column(Modifier.padding(horizontal = 12.dp)) { YesterdayPodium(selectedMode, playType, onOpenProfile) }
        }
        Spacer(Modifier.height(24.dp))
    }
}

/** 32dp accent-tinted mode glyph box — mirrors iOS `ModeIconView(box: 32)`. */
@Composable
private fun ModeIconBox(mode: String, accent: Color) {
    Box(Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.08f)), contentAlignment = Alignment.Center) {
        if (mode == SWEEP_ID) {
            Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_broom), null,
                tint = accent, modifier = Modifier.size(16.dp),
            )
        } else {
            pickerGameModeOrNull(mode)?.let { ModeGlyph(it, accent, glyphSize = 12.sp, iconSize = 16.dp) }
        }
    }
}

/** Yesterday's top-3 for the mode (collapsible). */
@Composable
private fun YesterdayPodium(mode: String, playType: String, onOpenProfile: (String) -> Unit) {
    var top3 by remember { mutableStateOf<List<LeaderboardService.LeaderboardEntry>>(emptyList()) }
    var open by remember { mutableStateOf(false) }
    val accent = runCatching { modeAccent(com.wordocious.core.GameMode.valueOf(mode)) }.getOrDefault(WTheme.primary)
    val medalColors = listOf(Color(0xFFD97706), Color(0xFF9CA3AF), Color(0xFFB45309))
    // iOS rotates the chevron 180° with an animation instead of swapping ▲/▼.
    val chevronRotation by animateFloatAsState(if (open) 180f else 0f, label = "podiumChevron")
    LaunchedEffect(mode, playType) { top3 = LeaderboardService.fetchYesterdayWinners(mode, playType) }
    if (top3.isEmpty()) return
    Column(
        Modifier.fillMaxWidth().padding(top = 8.dp).clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
    ) {
        Row(
            Modifier.fillMaxWidth().clickable { open = !open }.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown), null, tint = Color(0xFFD97706), modifier = Modifier.size(11.dp))
            Spacer(Modifier.size(5.dp))
            Text("YESTERDAY'S PODIUM", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text, letterSpacing = 0.5.sp)
            Spacer(Modifier.weight(1f))
            Icon(
                Icons.Filled.KeyboardArrowDown, null, tint = WTheme.textMuted,
                modifier = Modifier.size(12.dp).rotate(chevronRotation),
            )
        }
        if (open) {
            // iOS rules off the header and separates each podium row; Android drew
            // the rows flush, so the three winners ran together as one block.
            HorizontalDivider(color = WTheme.border)
            top3.forEachIndexed { i, e ->
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Filled.MilitaryTech, null, tint = medalColors[minOf(i, 2)], modifier = Modifier.size(20.dp))
                    Text(e.username ?: "", modifier = Modifier.weight(1f).clickableNoRipple { onOpenProfile(e.userId) }, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1)
                    Text(formatScore(e.compositeScore), fontSize = 13.sp, fontWeight = FontWeight.Black, color = accent)
                }
                if (i < top3.size - 1) HorizontalDivider(color = WTheme.border)
            }
        }
    }
}

/** Solo|VS segmented toggle — icon + accent active state, web records-page parity. */
@Composable
private fun SoloVsToggle(playType: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .border(1.5.dp, WTheme.border, RoundedCornerShape(8.dp)),
    ) {
        listOf("solo" to "Solo", "vs" to "VS").forEach { (key, label) ->
            val active = playType == key
            Row(
                modifier = Modifier
                    .background(if (active) WTheme.primary.copy(alpha = 0.10f) else WTheme.surface)
                    .clickable { onSelect(key) }
                    .padding(horizontal = 14.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(
                    if (key == "solo") Icons.Filled.Person else Icons.Filled.People, null,
                    tint = if (active) WTheme.primary else WTheme.textMuted, modifier = Modifier.size(14.dp),
                )
                Text(label, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = if (active) WTheme.primary else WTheme.textMuted)
            }
        }
    }
}

// ── Record label/format/icon config (mirrors web RECORD_LABELS) ──────────────
private data class RecordCfg(val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector?, val crown: Boolean, val format: (Int) -> String)

private val RECORD_CFG: Map<String, RecordCfg> = mapOf(
    "fastest_win" to RecordCfg("Fastest Win", androidx.compose.material.icons.Icons.Filled.Schedule, false) { v -> if (v < 60) "${v}s" else "${v / 60}m ${v % 60}s" },
    "fewest_guesses" to RecordCfg("Fewest Guesses", androidx.compose.material.icons.Icons.Filled.TrackChanges, false) { v -> "$v guesses" },
    "most_games_played" to RecordCfg("Most Games Played", androidx.compose.material.icons.Icons.Filled.Bolt, false) { v -> "$v games" },
    "longest_streak" to RecordCfg("Longest Streak", androidx.compose.material.icons.Icons.Filled.LocalFireDepartment, false) { v -> "$v wins" },
    "most_gold_medals" to RecordCfg("Most Gold Medals", null, true) { v -> "$v golds" },
    "highest_level" to RecordCfg("Highest Level", androidx.compose.material.icons.Icons.Filled.EmojiEvents, false) { v -> "Level $v" },
    "most_daily_completions" to RecordCfg("Most Dailies Completed", androidx.compose.material.icons.Icons.Filled.TrackChanges, false) { v -> "$v dailies" },
)
private val GLOBAL_RECORD_TYPES = listOf("longest_streak", "highest_level", "most_gold_medals", "most_daily_completions")
private val PER_MODE_RECORD_TYPES = listOf("fastest_win", "fewest_guesses", "most_games_played", "longest_streak")

@Composable
private fun AllTimeTab(onOpenProfile: (String) -> Unit = {}) {
    var records by remember { mutableStateOf<List<LeaderboardService.AllTimeRecord>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var selectedMode by remember { mutableStateOf("DUEL") }
    val userId = AuthService.profile.value?.id
    // All-time sweep ranking — loaded lazily the first time SWEEP is selected.
    val isSweep = selectedMode == SWEEP_ID
    var sweepBoard by remember { mutableStateOf<List<LeaderboardService.AllTimeSweepEntry>?>(null) }
    // Your own all-time sweep standing — iOS shows "Your rank: #N of T" on this card.
    var sweepRank by remember { mutableStateOf<LeaderboardService.RankInfo?>(null) }

    LaunchedEffect(Unit) {
        records = LeaderboardService.fetchAllTimeRecords()
        loading = false
    }
    LaunchedEffect(isSweep) {
        if (isSweep && sweepBoard == null) {
            sweepBoard = LeaderboardService.fetchAllTimeSweepOrNull() ?: emptyList()
            if (userId != null) sweepRank = LeaderboardService.getUserAllTimeSweepRank(userId)
        }
    }

    if (loading) {
        // Web parity: AllTimeSkeleton pulsing card blocks, not a spinner.
        Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) { CardsSkeleton() }
        return
    }

    val globalRecords = records.filter { it.gameMode == null && it.recordType in GLOBAL_RECORD_TYPES }
    val modeRecords = records.filter { it.gameMode == selectedMode }
    // GUARDED valueOf: SWEEP has no `:core` GameMode → keep the neutral primary
    // accent (indigo is reserved for the tile only).
    val accent = if (isSweep) SWEEP_ACCENT else runCatching { modeAccent(com.wordocious.core.GameMode.valueOf(selectedMode)) }.getOrDefault(WTheme.primary)

    LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        // Hall of Fame
        item {
            Spacer(Modifier.height(8.dp))
            Text("HALL OF FAME", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
            Spacer(Modifier.height(8.dp))
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                    .background(WTheme.surface).border(1.5.dp, WTheme.goldBorder, RoundedCornerShape(16.dp)),
            ) {
                Box(Modifier.fillMaxWidth().height(3.dp).background(Brush.horizontalGradient(listOf(Color(0xFFF59E0B), WTheme.goldBorder))))
                Column(Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 12.dp)) {
                    GLOBAL_RECORD_TYPES.chunked(2).forEach { rowTypes ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            rowTypes.forEach { rt ->
                                val rec = globalRecords.find { it.recordType == rt }
                                Box(Modifier.weight(1f)) {
                                    StatCell(rt, rec, Color(0xFFD97706), isCurrentUser = userId != null && rec?.holderId == userId, onOpenProfile = onOpenProfile)
                                }
                            }
                        }
                    }
                }
            }
        }
        // By Game Mode
        item {
            Spacer(Modifier.height(20.dp))
            Text(if (isSweep) "SWEEP RANKING" else "BY GAME MODE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
            Spacer(Modifier.height(8.dp))
            ModePickerRow(selectedMode) { selectedMode = it }
            Spacer(Modifier.height(8.dp))
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                    .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
            ) {
                Box(Modifier.fillMaxWidth().height(3.dp).background(Brush.horizontalGradient(listOf(accent, accent.copy(alpha = 0.53f)))))
                Row(
                    Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    ModeIconBox(selectedMode, accent)
                    if (isSweep) {
                        Column {
                            Text("All-Time Sweeps", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                            Text("Most daily sweeps ever", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        }
                    } else {
                        Text(recModeTitle(selectedMode), fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    }
                }
                if (isSweep) {
                    // Sweeper count + your all-time sweep rank (iOS sweepCard).
                    val sweepers = sweepRank?.totalPlayers ?: (sweepBoard?.size ?: 0)
                    Row(
                        Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Filled.People, null, tint = WTheme.textMuted, modifier = Modifier.size(14.dp))
                            Text("$sweepers sweeper${if (sweepers == 1) "" else "s"}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        }
                        Spacer(Modifier.weight(1f))
                        sweepRank?.let { r ->
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text("Your rank:", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                                Text("#${r.rank}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFFD97706))
                                Text("of ${r.totalPlayers}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                            }
                        }
                    }
                    // All-time sweep ranking — most daily sweeps, tiebreak flawless / best time.
                    val board = sweepBoard
                    when {
                        // Still loading — the same pulsing rows every other board uses.
                        board == null -> Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) { LeaderboardSkeleton() }
                        board.isEmpty() -> Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            // iOS uses the trophy glyph at 28 with textMuted @ 50%,
                            // and 12pt bold copy — not the broom at full strength.
                            Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.textMuted.copy(alpha = 0.5f), modifier = Modifier.size(28.dp))
                            Spacer(Modifier.height(8.dp))
                            Text("No sweeps yet. Be the first!", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        }
                        else -> Column {
                            board.forEachIndexed { i, e ->
                                AllTimeSweepRow(rank = (e.rank.takeIf { it > 0 }?.toInt()) ?: (i + 1), entry = e, isCurrentUser = userId != null && e.userId == userId, onOpenProfile = onOpenProfile)
                            }
                        }
                    }
                } else if (modeRecords.isEmpty()) {
                    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(androidx.compose.material.icons.Icons.Filled.EmojiEvents, null, tint = WTheme.textMuted, modifier = Modifier.size(28.dp))
                        Spacer(Modifier.height(6.dp))
                        Text("No records yet", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                    }
                } else {
                    Column(Modifier.padding(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 12.dp)) {
                        PER_MODE_RECORD_TYPES.chunked(2).forEach { rowTypes ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                rowTypes.forEach { rt ->
                                    val cands = modeRecords.filter { it.recordType == rt }
                                    val rec = cands.find { it.playType == "solo" } ?: cands.firstOrNull()
                                    Box(Modifier.weight(1f)) {
                                        StatCell(rt, rec, accent, isCurrentUser = userId != null && rec?.holderId == userId, onOpenProfile = onOpenProfile)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

// Streak shields are granted every 7 days (web /api/shields/grant-milestone
// MILESTONE_EVERY=7) — the "next shield" card counts toward the next multiple
// of 7, NOT the [7, 30, 100] streak MEDAL milestones.
private const val SHIELD_EVERY = 7
private fun recModeTitle(key: String) = MODE_OPTIONS.firstOrNull { it.first == key }?.second ?: key
private fun fmtSecs(v: Int) = if (v < 60) "${v}s" else "${v / 60}m ${v % 60}s"

/** One beatable all-time record: label, gap copy, progress (record/mine %). */
private data class RecordChase(val label: String, val gap: String, val pct: Int)

/** "You" tab — the player's own records: milestone progress + Record Chase,
 *  sweep totals (single home), per-mode personal bests, medals +
 *  global-records-held + Trophy Shelf. Mirrors web YourRecordsView. */
@Composable
private fun YourRecordsTab() {
    val profile by AuthService.profile.collectAsState()
    val userId = profile?.id
    var stats by remember { mutableStateOf<List<com.wordocious.app.data.ProfileService.UserStat>>(emptyList()) }
    var sweep by remember { mutableStateOf(com.wordocious.app.data.MatchStatsService.DailySweepStats()) }
    var recordsHeld by remember { mutableStateOf<List<LeaderboardService.AllTimeRecord>>(emptyList()) }
    var chases by remember { mutableStateOf<List<RecordChase>>(emptyList()) }
    var selectedMode by remember { mutableStateOf("DUEL") }
    var loading by remember { mutableStateOf(true) }
    // The user's sweep standings — shown in the Sweep-selected bests window:
    // today's daily-sweep board rank + the global all-time sweep rank.
    var sweepRankToday by remember { mutableStateOf<LeaderboardService.RankInfo?>(null) }
    var sweepRankAllTime by remember { mutableStateOf<LeaderboardService.RankInfo?>(null) }

    LaunchedEffect(userId) {
        if (userId == null) { loading = false; return@LaunchedEffect }
        val s = com.wordocious.app.data.ProfileService.fetchUserStats(userId)
        sweep = com.wordocious.app.data.MatchStatsService.dailySweepStats()
        val recs = LeaderboardService.fetchAllTimeRecords()
        sweepRankToday = LeaderboardService.getUserSweepRank(userId)
        sweepRankAllTime = LeaderboardService.getUserAllTimeSweepRank(userId)
        stats = s
        recordsHeld = recs.filter { it.holderId == userId }
        // Record Chase: EVERY beatable all-time record with your gap, sorted by
        // how close you are (relative gap), top 3. Lower-is-better types only.
        // Ports the web loop in records/page.tsx exactly.
        data class Cand(val chase: RecordChase, val rel: Double)
        val all = ArrayList<Cand>()
        for (r in recs) {
            if (r.holderId == userId || r.gameMode == null || r.playType != "solo") continue
            val mine = s.find { it.gameMode == r.gameMode && it.playType == "solo" } ?: continue
            val ft = mine.fastestTime ?: 0
            val bs = mine.bestScore ?: 0.0
            if (r.recordType == "fastest_win" && ft > 0 && ft.toDouble() > r.recordValue) {
                val gap = ft - r.recordValue
                all.add(Cand(RecordChase(
                    label = "${recModeTitle(r.gameMode!!)} fastest win",
                    gap = "${gap.toInt()}s away",
                    pct = Math.round(r.recordValue / ft * 100).toInt(),
                ), gap / maxOf(1.0, r.recordValue)))
            } else if (r.recordType == "fewest_guesses" && bs > 0 && bs > r.recordValue) {
                val gap = bs - r.recordValue
                all.add(Cand(RecordChase(
                    label = "${recModeTitle(r.gameMode!!)} fewest guesses",
                    gap = "${gap.toInt()} away",
                    pct = Math.round(r.recordValue / bs * 100).toInt(),
                ), gap / maxOf(1.0, r.recordValue)))
            }
        }
        chases = all.sortedBy { it.rel }.take(3).map { it.chase }
        loading = false
    }

    if (userId == null) {
        Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.textMuted.copy(alpha = 0.3f), modifier = Modifier.size(32.dp))
            Spacer(Modifier.height(8.dp)); Text("Sign in to see your personal records.", color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        return
    }
    if (loading) { Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) { CardsSkeleton() }; return }

    // GUARDED valueOf via pickerGameModeOrNull: the picker's SWEEP id has no
    // `:core` GameMode → neutral primary accent (indigo is reserved for the tile).
    val accent = pickerGameModeOrNull(selectedMode)?.let { modeAccent(it) } ?: WTheme.primary
    val streak = profile?.dailyLoginStreak ?: 0
    val nextShield = (streak / SHIELD_EVERY + 1) * SHIELD_EVERY
    val my = stats.find { it.gameMode == selectedMode && it.playType == "solo" }

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        item { Spacer(Modifier.height(8.dp)) }
        // Milestone + Record Chase (top-3 beatable records with progress bars)
        if (nextShield > 0 || chases.isNotEmpty()) item {
            CardShell(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899)))) {
                Text("NEXT UP", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.LocalFireDepartment, null, tint = Color(0xFFF97316), modifier = Modifier.size(14.dp))
                    Spacer(Modifier.size(4.dp))
                    Text("$nextShield-day streak shield", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
                    Spacer(Modifier.weight(1f))
                    Text("$streak/$nextShield", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                }
                Spacer(Modifier.height(4.dp))
                Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)).background(WTheme.border)) {
                    Box(Modifier.fillMaxWidth((streak.toFloat() / nextShield).coerceIn(0f, 1f)).height(8.dp).clip(RoundedCornerShape(50)).background(Brush.horizontalGradient(listOf(Color(0xFFF97316), Color(0xFFFBBF24)))))
                }
                chases.forEach { c ->
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Filled.TrendingUp, null, tint = WTheme.primary, modifier = Modifier.size(14.dp))
                        Row(Modifier.weight(1f)) {
                            Text("You're ", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
                            Text(c.gap, fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1)
                            Text(
                                " from the ${c.label} record", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                color = WTheme.textMuted, maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                            )
                        }
                    }
                    Spacer(Modifier.height(2.dp))
                    Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(50)).background(WTheme.border)) {
                        Box(
                            Modifier.fillMaxWidth((c.pct / 100f).coerceIn(0f, 1f)).height(6.dp)
                                .clip(RoundedCornerShape(50))
                                .background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFF7C3AED)))),
                        )
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
        // Bests by mode — the Sweep tile swaps the per-mode bests for the daily-
        // sweep window (totals + today/all-time rank), populating only on select.
        item {
            val isSweep = selectedMode == SWEEP_ID
            Text("YOUR BESTS BY MODE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
            Spacer(Modifier.height(8.dp))
            ModePickerRow(selectedMode) { selectedMode = it }
            Spacer(Modifier.height(8.dp))
            CardShell(Brush.horizontalGradient(listOf(accent, accent.copy(alpha = 0.53f)))) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ModeIconBox(selectedMode, if (isSweep) SWEEP_ACCENT else accent)
                    Text(if (isSweep) "Daily Sweeps" else recModeTitle(selectedMode), fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                }
                Spacer(Modifier.height(2.dp))
                if (isSweep) {
                    if (sweep.hasData) {
                        Row(Modifier.fillMaxWidth()) {
                            Box(Modifier.weight(1f)) { MeCell(Icons.Filled.AutoAwesome, "${sweep.sweepCount}", "Daily Sweeps", Color(0xFF7C3AED)) }
                            Box(Modifier.weight(1f)) { MeCell(Icons.Filled.EmojiEvents, "${sweep.flawlessCount}", "Flawless Victories", Color(0xFFD97706)) }
                        }
                        Row(Modifier.fillMaxWidth()) {
                            Box(Modifier.weight(1f)) { MeCell(Icons.Filled.LocalFireDepartment, "${sweep.currentSweepStreak}", "Current Sweep Streak", Color(0xFFF97316)) }
                            Box(Modifier.weight(1f)) { MeCell(Icons.Filled.Schedule, if (sweep.bestSweepSecs > 0) fmtSecs(sweep.bestSweepSecs) else "—", "Best Sweep Time", Color(0xFF2563EB), dim = sweep.bestSweepSecs == 0) }
                        }
                        // Sweep leaderboard standing — today's daily board + all-time
                        // (getUserSweepRank / getUserAllTimeSweepRank).
                        if (sweepRankToday != null || sweepRankAllTime != null) {
                            Spacer(Modifier.height(6.dp))
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_broom), null, tint = SWEEP_ACCENT, modifier = Modifier.size(13.dp))
                                sweepRankToday?.let { r ->
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                                        Text("Today", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                                        Text("#${r.rank}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFFD97706))
                                        Text("of ${r.totalPlayers}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                                    }
                                }
                                sweepRankAllTime?.let { r ->
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                                        Text("All-Time", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                                        Text("#${r.rank}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFFD97706))
                                        Text("of ${r.totalPlayers}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                                    }
                                }
                            }
                        }
                    } else {
                        Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.textMuted.copy(alpha = 0.5f), modifier = Modifier.size(28.dp))
                            Spacer(Modifier.height(8.dp))
                            Text("No sweeps yet", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        }
                    }
                } else {
                    Row(Modifier.fillMaxWidth()) {
                        Box(Modifier.weight(1f)) { MeCell(Icons.Filled.Schedule, if ((my?.fastestTime ?: 0) > 0) fmtSecs(my!!.fastestTime!!) else "—", "Fastest Win", accent, dim = (my?.fastestTime ?: 0) == 0) }
                        Box(Modifier.weight(1f)) { MeCell(Icons.Filled.TrackChanges, if ((my?.bestScore ?: 0.0) > 0) "${my!!.bestScore!!.toInt()} guesses" else "—", "Fewest Guesses", accent, dim = (my?.bestScore ?: 0.0) == 0.0) }
                    }
                    Row(Modifier.fillMaxWidth()) {
                        Box(Modifier.weight(1f)) { MeCell(Icons.Filled.Bolt, if (my != null) "${my.totalGames} games" else "—", "Games Played", accent, dim = my == null) }
                        Box(Modifier.weight(1f)) { MeCell(Icons.Filled.EmojiEvents, if (my != null) "${my.wins}–${my.losses}" else "—", "Win–Loss", accent, dim = my == null) }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
        // Medals + records held
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
                ) {
                    Text("MEDALS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        MedalCount(com.wordocious.app.R.drawable.ic_crown, Color(0xFFD97706), profile?.goldMedals ?: 0)
                        MedalCount(Icons.Filled.MilitaryTech, Color(0xFF9CA3AF), profile?.silverMedals ?: 0)
                        MedalCount(Icons.Filled.MilitaryTech, Color(0xFFB45309), profile?.bronzeMedals ?: 0)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text("Daily top-3 finishes", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
                ) {
                    Text("GLOBAL RECORDS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                    Spacer(Modifier.height(2.dp))
                    // Star icon + 13sp count (iOS Label(…, systemImage: "star.fill")),
                    // so this card doesn't outweigh the MEDALS card beside it.
                    val starTint = if (recordsHeld.isEmpty()) WTheme.textMuted else Color(0xFFD97706)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Icon(Icons.Filled.Star, null, tint = starTint, modifier = Modifier.size(14.dp))
                        Text("${recordsHeld.size}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = starTint)
                    }
                    Text("all-time record${if (recordsHeld.size == 1) "" else "s"} held", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
            Spacer(Modifier.height(16.dp))
        }
        // Trophy shelf — the specific records you hold, spelled out (web parity).
        if (recordsHeld.isNotEmpty()) item {
            CardShell(Brush.horizontalGradient(listOf(Color(0xFFFBBF24), Color(0xFFD97706)))) {
                Text("YOUR TROPHY SHELF", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                Spacer(Modifier.height(6.dp))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    recordsHeld.forEach { r ->
                        val cfg = RECORD_CFG[r.recordType]
                        val modeTitle = r.gameMode?.let { recModeTitle(it) } ?: "Global"
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(WTheme.bg).padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            if (cfg?.crown == true) {
                                Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown), null, tint = Color(0xFFD97706), modifier = Modifier.size(16.dp))
                            } else {
                                Icon(cfg?.icon ?: androidx.compose.material.icons.Icons.Filled.Star, null, tint = Color(0xFFD97706), modifier = Modifier.size(16.dp))
                            }
                            Text(
                                "$modeTitle · ${cfg?.label ?: r.recordType}",
                                fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                                maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                cfg?.format?.invoke(r.recordValue.toInt()) ?: "${r.recordValue.toInt()}",
                                fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFFD97706),
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun CardShell(barBrush: Brush, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))) {
        Box(Modifier.fillMaxWidth().height(3.dp).background(barBrush))
        Column(Modifier.padding(14.dp), content = content)
    }
}

/** Centered icon-over-value-over-label tile (iOS `meCell`). */
@Composable
private fun MeCell(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String,
    color: Color,
    dim: Boolean = false,
) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Icon(icon, null, tint = if (dim) WTheme.textMuted else color, modifier = Modifier.size(16.dp))
        Text(value, fontSize = 15.sp, fontWeight = FontWeight.Black, color = if (dim) WTheme.textMuted else WTheme.text, maxLines = 1)
        Text(
            label, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center, maxLines = 2,
        )
    }
}

@Composable
private fun MedalCount(res: Int, tint: Color, n: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Icon(androidx.compose.ui.res.painterResource(res), null, tint = tint, modifier = Modifier.size(14.dp))
        Text("$n", fontSize = 13.sp, fontWeight = FontWeight.Black, color = tint)
    }
}

/** Vector-icon medal tally — iOS uses a medal glyph for silver/bronze, a crown for gold. */
@Composable
private fun MedalCount(icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, n: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(14.dp))
        Text("$n", fontSize = 13.sp, fontWeight = FontWeight.Black, color = tint)
    }
}

/** Record stat cell — icon + formatted value + label + holder (me-highlight). Mirrors web StatCell. */
@Composable
private fun StatCell(recordType: String, record: LeaderboardService.AllTimeRecord?, accent: Color, isCurrentUser: Boolean, onOpenProfile: (String) -> Unit = {}) {
    val cfg = RECORD_CFG[recordType] ?: return
    val hasRecord = record != null
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .then(
                if (isCurrentUser && hasRecord)
                    Modifier.background(WTheme.highlightGold).border(1.dp, WTheme.goldBorder, RoundedCornerShape(8.dp))
                else Modifier,
            )
            .padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val tint = if (hasRecord) accent else WTheme.textMuted
        if (cfg.crown) {
            Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown), null, tint = tint, modifier = Modifier.size(16.dp))
        } else cfg.icon?.let { Icon(it, null, tint = tint, modifier = Modifier.size(16.dp)) }
        Column(Modifier.weight(1f)) {
            Text(
                if (hasRecord) cfg.format(record!!.recordValue.toInt()) else "—",
                fontSize = 16.sp, fontWeight = FontWeight.Black,
                color = if (hasRecord) WTheme.text else WTheme.textMuted, lineHeight = 18.sp,
            )
            Text(cfg.label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, lineHeight = 12.sp)
            if (hasRecord) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        record!!.holderUsername ?: "Unknown",
                        modifier = Modifier.clickableNoRipple { record.holderId?.let(onOpenProfile) },
                        fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                        color = if (isCurrentUser) Color(0xFFD97706) else accent,
                        maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    )
                    if (isCurrentUser) Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown), null, tint = Color(0xFFD97706), modifier = Modifier.size(10.dp))
                }
            }
        }
    }
}
