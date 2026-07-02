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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults.SecondaryIndicator
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.LeaderboardService
import com.wordocious.app.ui.theme.WTheme

/**
 * Records screen — ported from web /records/page.tsx.
 * Daily tab: mode-picker + leaderboard (reuses LeaderboardService)
 * All-time tab: Hall of Fame 2x2 grid (longest streak, highest level, most medals, most completions)
 */
@Composable
fun RecordsScreen(onOpenProfile: (String) -> Unit = {}) {
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Daily", "All-Time", "You")

    Column(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        // (Shared AppHeader is above.) Page title per spec: RECORDS gradient.
        Text(
            "RECORDS",
            fontSize = 28.sp, fontWeight = FontWeight.Black,
            style = TextStyle(brush = WTheme.wordmarkGradient),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )
        Text(
            "The best of the best across Wordocious",
            fontSize = 12.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
        )

        Spacer(Modifier.height(8.dp))

        // Tab row
        TabRow(
            selectedTabIndex = tab,
            containerColor = WTheme.bg,
            contentColor = WTheme.primary,
            indicator = { tabPositions ->
                SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[tab]),
                    color = WTheme.primary,
                )
            },
        ) {
            tabs.forEachIndexed { i, title ->
                Tab(
                    selected = tab == i,
                    onClick = { tab = i },
                    text = {
                        Text(
                            title, fontWeight = FontWeight.Black, fontSize = 13.sp,
                            color = if (tab == i) WTheme.primary else WTheme.textMuted,
                        )
                    },
                )
            }
        }

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
    var userRank by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    var loading by remember { mutableStateOf(true) }
    val userId = AuthService.profile.value?.id

    // Re-fetch the instant a daily is recorded (completionTick) so a finished
    // puzzle appears here immediately, without a tab round-trip.
    val tick by com.wordocious.app.data.DailyCompletionsService.completionTick.collectAsState()
    LaunchedEffect(selectedMode, playType, tick) {
        loading = true
        userRank = null
        entries = LeaderboardService.fetchDailyLeaderboard(selectedMode, playType)
        playerCount = LeaderboardService.playerCount(selectedMode)
        if (userId != null) userRank = LeaderboardService.userRankAndTotal(userId, selectedMode, playType)
        loading = false
    }

    Column {
        ModePickerRow(selectedMode) { selectedMode = it }
        SoloVsToggle(playType) { playType = it }

        // Player count + your rank/percentile (web/iOS parity — was missing on Android).
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Filled.People, null, tint = WTheme.textMuted, modifier = Modifier.size(14.dp))
                Text("$playerCount player${if (playerCount == 1) "" else "s"} today", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
            Spacer(Modifier.weight(1f))
            userRank?.let { (rank, total) ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("Your rank:", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    Text("#$rank", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFFD97706))
                    Text(
                        if (total > 1) "of $total · top ${maxOf(1, Math.round(rank.toDouble() / total * 100).toInt())}%" else "of $total",
                        fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    )
                }
            }
        }

        if (loading) {
            // Web parity: animate-pulse skeleton rows, not a spinner.
            Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) { LeaderboardSkeleton() }
        } else if (entries.isEmpty()) {
            // Web parity (records page): trophy + "No results yet today. Be the first!"
            Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.textMuted.copy(alpha = 0.3f), modifier = Modifier.size(32.dp))
                Spacer(Modifier.height(8.dp))
                Text("No results yet today. Be the first!", color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
                item { Spacer(Modifier.height(8.dp)) }
                items(entries) { entry ->
                    val rank = entries.indexOf(entry) + 1
                    LeaderboardRow(rank = rank, entry = entry, mode = selectedMode, isCurrentUser = entry.userId == userId, playType = playType)
                    Spacer(Modifier.height(4.dp))
                }
                item { YesterdayPodium(selectedMode, playType, onOpenProfile) }
                item { Spacer(Modifier.height(24.dp)) }
            }
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
            Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown), null, tint = Color(0xFFD97706), modifier = Modifier.size(14.dp))
            Spacer(Modifier.size(5.dp))
            Text("YESTERDAY'S PODIUM", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text, letterSpacing = 0.5.sp)
            Spacer(Modifier.weight(1f))
            Text(if (open) "▲" else "▼", fontSize = 10.sp, color = WTheme.textMuted)
        }
        if (open) {
            top3.forEachIndexed { i, e ->
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Filled.EmojiEvents, null, tint = medalColors[minOf(i, 2)], modifier = Modifier.size(18.dp))
                    Text(e.username ?: "", modifier = Modifier.weight(1f).clickableNoRipple { onOpenProfile(e.userId) }, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1)
                    Text("${e.compositeScore.toInt()}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = accent)
                }
            }
        }
    }
}

/** Solo|VS segmented toggle — icon + accent active state, web records-page parity. */
@Composable
private fun SoloVsToggle(playType: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier
            .padding(horizontal = 12.dp, vertical = 8.dp)
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

    LaunchedEffect(Unit) {
        records = LeaderboardService.fetchAllTimeRecords()
        loading = false
    }

    if (loading) {
        // Web parity: AllTimeSkeleton pulsing card blocks, not a spinner.
        Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) { CardsSkeleton() }
        return
    }

    val globalRecords = records.filter { it.gameMode == null && it.recordType in GLOBAL_RECORD_TYPES }
    val modeRecords = records.filter { it.gameMode == selectedMode }
    val accent = runCatching { modeAccent(com.wordocious.core.GameMode.valueOf(selectedMode)) }.getOrDefault(WTheme.primary)

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
            Text("BY GAME MODE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
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
                    Box(Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.08f)), contentAlignment = Alignment.Center) {
                        Text(
                            MODE_OPTIONS.firstOrNull { it.first == selectedMode }?.second?.take(2)?.uppercase() ?: "",
                            fontSize = 11.sp, fontWeight = FontWeight.Black, color = accent,
                        )
                    }
                    Text(MODE_OPTIONS.firstOrNull { it.first == selectedMode }?.second ?: selectedMode, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                }
                if (modeRecords.isEmpty()) {
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

private val STREAK_MILESTONES = listOf(7, 30, 100)
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

    LaunchedEffect(userId) {
        if (userId == null) { loading = false; return@LaunchedEffect }
        val s = com.wordocious.app.data.ProfileService.fetchUserStats(userId)
        sweep = com.wordocious.app.data.MatchStatsService.dailySweepStats()
        val recs = LeaderboardService.fetchAllTimeRecords()
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

    val accent = runCatching { modeAccent(com.wordocious.core.GameMode.valueOf(selectedMode)) }.getOrDefault(WTheme.primary)
    val streak = profile?.dailyLoginStreak ?: 0
    val nextMilestone = STREAK_MILESTONES.firstOrNull { it > streak }
    val my = stats.find { it.gameMode == selectedMode && it.playType == "solo" }

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        item { Spacer(Modifier.height(8.dp)) }
        // Milestone + Record Chase (top-3 beatable records with progress bars)
        if (nextMilestone != null || chases.isNotEmpty()) item {
            CardShell(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899)))) {
                Text("NEXT UP", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                if (nextMilestone != null) {
                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.LocalFireDepartment, null, tint = Color(0xFFF97316), modifier = Modifier.size(14.dp))
                        Spacer(Modifier.size(4.dp))
                        Text("$nextMilestone-day streak shield", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
                        Spacer(Modifier.weight(1f))
                        Text("$streak/$nextMilestone", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                    }
                    Spacer(Modifier.height(4.dp))
                    Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)).background(WTheme.border)) {
                        Box(Modifier.fillMaxWidth((streak.toFloat() / nextMilestone).coerceIn(0f, 1f)).height(8.dp).clip(RoundedCornerShape(50)).background(Brush.horizontalGradient(listOf(Color(0xFFF97316), Color(0xFFFBBF24)))))
                    }
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
        // Sweep totals
        if (sweep.hasData) item {
            CardShell(Brush.horizontalGradient(listOf(Color(0xFFFBBF24), Color(0xFFD97706)))) {
                Text("DAILY SWEEPS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                Spacer(Modifier.height(4.dp))
                Row(Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) { MeCell("${sweep.sweepCount}", "Daily Sweeps") }
                    Box(Modifier.weight(1f)) { MeCell("${sweep.flawlessCount}", "Flawless Wins") }
                }
                Row(Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) { MeCell("${sweep.currentSweepStreak}", "Sweep Streak") }
                    Box(Modifier.weight(1f)) { MeCell(if (sweep.bestSweepSecs > 0) fmtSecs(sweep.bestSweepSecs) else "—", "Best Sweep Time", dim = sweep.bestSweepSecs == 0) }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
        // Bests by mode
        item {
            Text("YOUR BESTS BY MODE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
            Spacer(Modifier.height(8.dp))
            ModePickerRow(selectedMode) { selectedMode = it }
            Spacer(Modifier.height(8.dp))
            CardShell(Brush.horizontalGradient(listOf(accent, accent.copy(alpha = 0.53f)))) {
                Text(recModeTitle(selectedMode), fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Spacer(Modifier.height(2.dp))
                Row(Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) { MeCell(if ((my?.fastestTime ?: 0) > 0) fmtSecs(my!!.fastestTime!!) else "—", "Fastest Win", dim = (my?.fastestTime ?: 0) == 0) }
                    Box(Modifier.weight(1f)) { MeCell(if ((my?.bestScore ?: 0.0) > 0) "${my!!.bestScore!!.toInt()} guesses" else "—", "Fewest Guesses", dim = (my?.bestScore ?: 0.0) == 0.0) }
                }
                Row(Modifier.fillMaxWidth()) {
                    Box(Modifier.weight(1f)) { MeCell(if (my != null) "${my.totalGames} games" else "—", "Games Played", dim = my == null) }
                    Box(Modifier.weight(1f)) { MeCell(if (my != null) "${my.wins}–${my.losses}" else "—", "Win–Loss", dim = my == null) }
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
                        MedalCount(com.wordocious.app.R.drawable.ic_crown, Color(0xFF9CA3AF), profile?.silverMedals ?: 0)
                        MedalCount(com.wordocious.app.R.drawable.ic_crown, Color(0xFFB45309), profile?.bronzeMedals ?: 0)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text("Daily top-3 finishes", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
                ) {
                    Text("GLOBAL RECORDS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                    Spacer(Modifier.height(2.dp))
                    Text("★ ${recordsHeld.size}", fontSize = 24.sp, fontWeight = FontWeight.Black, color = if (recordsHeld.isEmpty()) WTheme.textMuted else Color(0xFFD97706))
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

@Composable
private fun MeCell(value: String, label: String, dim: Boolean = false) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Text(value, fontSize = 15.sp, fontWeight = FontWeight.Black, color = if (dim) WTheme.textMuted else WTheme.text)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

@Composable
private fun MedalCount(res: Int, tint: Color, n: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Icon(androidx.compose.ui.res.painterResource(res), null, tint = tint, modifier = Modifier.size(14.dp))
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
