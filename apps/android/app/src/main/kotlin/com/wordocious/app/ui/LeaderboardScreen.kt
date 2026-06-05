package com.wordocious.app.ui

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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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

private val MODE_OPTIONS = listOf(
    "DUEL" to "Classic", "QUORDLE" to "QuadWord", "OCTORDLE" to "OctoWord",
    "SEQUENCE" to "Succession", "RESCUE" to "Deliverance",
    "DUEL_6" to "Six", "DUEL_7" to "Seven",
    "GAUNTLET" to "Gauntlet", "PROPERNOUNDLE" to "ProperNoundle",
)

/**
 * Leaderboard screen — ported from the web /daily page.
 * Shows today's daily leaderboard for a selected game mode with:
 * - Mode picker row, countdown timer
 * - User's current rank card
 * - Top 50 entries with rank badges (🥇🥈🥉 for top 3), username, score, guesses/time
 */
@Composable
fun LeaderboardScreen() {
    var selectedMode by remember { mutableStateOf("DUEL") }
    var entries by remember { mutableStateOf<List<LeaderboardService.LeaderboardEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val userId = AuthService.profile.value?.id

    // Reload when mode changes
    LaunchedEffect(selectedMode) {
        loading = true
        entries = LeaderboardService.fetchDailyLeaderboard(selectedMode)
        loading = false
    }

    Column(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        // (Shared AppHeader is above.) Page title per spec: DAILY CHALLENGE + countdown.
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "DAILY CHALLENGE", fontSize = 28.sp, fontWeight = FontWeight.Black,
                style = TextStyle(brush = WTheme.wordmarkGradient),
            )
            DailyCountdownChip()
        }

        // Mode picker
        ModePickerRow(selectedMode) { selectedMode = it }

        // User rank
        val userIdx = if (userId != null) entries.indexOfFirst { it.userId == userId } else -1
        if (userIdx >= 0) {
            UserRankCard(rank = userIdx + 1, total = entries.size, entry = entries[userIdx])
        }

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = WTheme.primary)
            }
        } else if (entries.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No results today yet. Be the first!", color = WTheme.textMuted, fontWeight = FontWeight.Bold)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
                item {
                    Text(
                        "TODAY'S LEADERBOARD",
                        fontSize = 10.sp, fontWeight = FontWeight.Black,
                        color = WTheme.textMuted, letterSpacing = 1.sp,
                        modifier = Modifier.padding(vertical = 8.dp),
                    )
                }
                itemsIndexed(entries) { index, entry ->
                    LeaderboardRow(
                        rank = index + 1,
                        entry = entry,
                        isCurrentUser = entry.userId == userId,
                    )
                    Spacer(Modifier.height(4.dp))
                }
                item { Spacer(Modifier.height(16.dp)) }
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
    Text(
        "Resets %02d:%02d:%02d".format(h, m, s),
        fontSize = 11.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold,
    )
}

private fun secondsUntilMidnight(): Long {
    val ms = 86_400_000L
    return (ms - (System.currentTimeMillis() % ms)) / 1000L
}

@Composable
internal fun ModePickerRow(selected: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)
            .horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        MODE_OPTIONS.forEach { (id, name) ->
            val isSelected = id == selected
            Text(
                name,
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(if (isSelected) WTheme.primary else WTheme.surfaceAlt)
                    .clickableNoRipple { onSelect(id) }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = if (isSelected) Color.White else WTheme.textSecondary,
            )
        }
    }
}

@Composable
private fun UserRankCard(rank: Int, total: Int, entry: LeaderboardService.LeaderboardEntry) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFFFFBEB))
            .border(1.5.dp, Color(0xFFFDE68A), RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.gold, modifier = Modifier.size(16.dp))
        Text("Your rank: #$rank of $total", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Spacer(Modifier.weight(1f))
        Text("${entry.compositeScore.toInt()} pts", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.primary)
    }
}

@Composable
internal fun LeaderboardRow(rank: Int, entry: LeaderboardService.LeaderboardEntry, isCurrentUser: Boolean) {
    val bg = when {
        isCurrentUser -> Color(0xFFFFFBEB)
        rank <= 3 -> Color(0xFFF5F3FF)
        else -> WTheme.surface
    }
    val border = when {
        isCurrentUser -> Color(0xFFFDE68A)
        rank <= 3 -> Color(0xFFE9D5FF)
        else -> WTheme.border
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Rank badge
        Box(
            modifier = Modifier.size(28.dp).clip(CircleShape)
                .background(rankBadgeBg(rank)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                rankLabel(rank),
                fontSize = if (rank <= 3) 14.sp else 11.sp,
                fontWeight = FontWeight.Black,
                color = if (rank <= 3) Color.White else WTheme.textSecondary,
            )
        }
        // Username
        Text(
            entry.username ?: "Player",
            fontSize = 13.sp, fontWeight = FontWeight.Black,
            color = WTheme.text, modifier = Modifier.weight(1f),
        )
        // Stats
        Text(
            "${entry.guessCount}g · ${fmtTime(entry.timeSeconds)}",
            fontSize = 10.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold,
        )
        // Score
        Text(
            "${entry.compositeScore.toInt()}",
            fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.primary,
        )
        // W/L badge
        Box(
            Modifier.size(20.dp).clip(RoundedCornerShape(4.dp))
                .background(if (entry.completed) WTheme.winText else WTheme.lossText),
            contentAlignment = Alignment.Center,
        ) {
            Text(if (entry.completed) "W" else "L", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White)
        }
    }
}

private fun rankLabel(r: Int) = when (r) {
    1 -> "🥇"; 2 -> "🥈"; 3 -> "🥉"; else -> "#$r"
}
private fun rankBadgeBg(r: Int) = when (r) {
    1 -> Color(0xFFD97706); 2 -> Color(0xFF9CA3AF); 3 -> Color(0xFF92400E)
    else -> WTheme.surfaceAlt
}
private fun fmtTime(s: Int) = if (s <= 0) "—" else if (s < 60) "${s}s" else "${s / 60}m${s % 60}s"
