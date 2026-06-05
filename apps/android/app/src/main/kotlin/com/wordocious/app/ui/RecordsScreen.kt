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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
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
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "WORDOCIOUS", fontSize = 20.sp, fontWeight = FontWeight.Black,
                style = TextStyle(brush = WTheme.wordmarkGradient),
            )
        }

        Text(
            "RECORDS",
            fontSize = 22.sp, fontWeight = FontWeight.Black, color = WTheme.text,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
        Text(
            "Daily rankings & all-time hall of fame",
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
                    LeaderboardRow(rank = rank, entry = entry, isCurrentUser = entry.userId == userId)
                    Spacer(Modifier.height(4.dp))
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }
}

@Composable
private fun AllTimeTab() {
    var records by remember { mutableStateOf<List<LeaderboardService.AllTimeRecord>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        records = LeaderboardService.fetchAllTimeRecords()
        loading = false
    }

    if (loading) {
        Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = WTheme.primary) }
        return
    }

    if (records.isEmpty()) {
        Box(Modifier.fillMaxSize(), Alignment.Center) {
            Text("Hall of fame coming soon", color = WTheme.textMuted, fontWeight = FontWeight.Bold)
        }
        return
    }

    val hallOfFame = listOf("longest_streak", "highest_level", "most_gold_medals", "most_daily_completions")
    val hallRecords = hallOfFame.map { type -> records.find { it.recordType == type } }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("HALL OF FAME", fontSize = 10.sp, fontWeight = FontWeight.Black,
            color = WTheme.textMuted, letterSpacing = 1.sp)

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            hallRecords.chunked(2).forEach { row ->
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { rec ->
                        RecordCell(rec)
                    }
                }
            }
        }
    }
}

@Composable
private fun RecordCell(record: LeaderboardService.AllTimeRecord?) {
    val label = when (record?.recordType) {
        "longest_streak" -> "Longest Streak"
        "highest_level" -> "Highest Level"
        "most_gold_medals" -> "Most Gold Medals"
        "most_daily_completions" -> "Most Dailies"
        else -> record?.recordType ?: "—"
    }
    Column(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
            .padding(10.dp),
    ) {
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.5.sp)
        Text(
            record?.recordValue?.toInt()?.toString() ?: "—",
            fontSize = 22.sp, fontWeight = FontWeight.Black, color = WTheme.primary,
        )
        Text(
            record?.holderUsername ?: "—",
            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary,
        )
    }
}

// Remove fmtTime — not needed in this file
