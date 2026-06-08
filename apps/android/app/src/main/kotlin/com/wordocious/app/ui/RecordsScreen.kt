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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults.SecondaryIndicator
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
fun RecordsScreen() {
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Daily", "All-Time")

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
            0 -> DailyRecordsTab()
            1 -> AllTimeTab()
        }
    }
}

@Composable
private fun DailyRecordsTab() {
    var selectedMode by remember { mutableStateOf("DUEL") }
    var entries by remember { mutableStateOf<List<LeaderboardService.LeaderboardEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val userId = AuthService.profile.value?.id

    LaunchedEffect(selectedMode) {
        loading = true
        entries = LeaderboardService.fetchDailyLeaderboard(selectedMode)
        loading = false
    }

    Column {
        ModePickerRow(selectedMode) { selectedMode = it }

        if (loading) {
            Box(Modifier.fillMaxSize(), Alignment.Center) {
                CircularProgressIndicator(color = WTheme.primary)
            }
        } else if (entries.isEmpty()) {
            Box(Modifier.fillMaxSize(), Alignment.Center) {
                Text("No results yet today", color = WTheme.textMuted, fontWeight = FontWeight.Bold)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
                item { Spacer(Modifier.height(8.dp)) }
                items(entries) { entry ->
                    val rank = entries.indexOf(entry) + 1
                    LeaderboardRow(rank = rank, entry = entry, mode = selectedMode, isCurrentUser = entry.userId == userId)
                    Spacer(Modifier.height(4.dp))
                }
                item { Spacer(Modifier.height(24.dp)) }
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
private fun AllTimeTab() {
    var records by remember { mutableStateOf<List<LeaderboardService.AllTimeRecord>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var selectedMode by remember { mutableStateOf("DUEL") }
    val userId = AuthService.profile.value?.id

    LaunchedEffect(Unit) {
        records = LeaderboardService.fetchAllTimeRecords()
        loading = false
    }

    if (loading) {
        Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = WTheme.primary) }
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
                    .background(WTheme.surface).border(1.5.dp, Color(0xFFFDE68A), RoundedCornerShape(16.dp)),
            ) {
                Box(Modifier.fillMaxWidth().height(3.dp).background(Brush.horizontalGradient(listOf(Color(0xFFF59E0B), Color(0xFFFDE68A)))))
                Column(Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 12.dp)) {
                    GLOBAL_RECORD_TYPES.chunked(2).forEach { rowTypes ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            rowTypes.forEach { rt ->
                                val rec = globalRecords.find { it.recordType == rt }
                                Box(Modifier.weight(1f)) {
                                    StatCell(rt, rec, Color(0xFFD97706), isCurrentUser = userId != null && rec?.holderId == userId)
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
                                        StatCell(rt, rec, accent, isCurrentUser = userId != null && rec?.holderId == userId)
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

/** Record stat cell — icon + formatted value + label + holder (me-highlight). Mirrors web StatCell. */
@Composable
private fun StatCell(recordType: String, record: LeaderboardService.AllTimeRecord?, accent: Color, isCurrentUser: Boolean) {
    val cfg = RECORD_CFG[recordType] ?: return
    val hasRecord = record != null
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .then(
                if (isCurrentUser && hasRecord)
                    Modifier.background(Color(0xFFFFFBEB)).border(1.dp, Color(0xFFFDE68A), RoundedCornerShape(8.dp))
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
