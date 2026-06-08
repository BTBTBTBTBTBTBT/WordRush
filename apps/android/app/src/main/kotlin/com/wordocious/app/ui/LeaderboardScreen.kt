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
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Schedule
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

internal val MODE_OPTIONS = listOf(
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
    var yesterday by remember { mutableStateOf<List<LeaderboardService.LeaderboardEntry>>(emptyList()) }
    var showYesterday by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    val userId = AuthService.profile.value?.id

    // Reload when mode changes
    LaunchedEffect(selectedMode) {
        loading = true
        entries = LeaderboardService.fetchDailyLeaderboard(selectedMode)
        loading = false
    }
    LaunchedEffect(selectedMode, showYesterday) {
        yesterday = if (showYesterday) LeaderboardService.fetchYesterdayWinners(selectedMode) else emptyList()
    }

    val modeLabel = MODE_OPTIONS.firstOrNull { it.first == selectedMode }?.second ?: selectedMode
    val userIdx = if (userId != null) entries.indexOfFirst { it.userId == userId } else -1

    Column(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        // (Shared AppHeader is above.) Page title: DAILY CHALLENGE + countdown.
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

        LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
            // Mode info card — icon box + "{n} players today"
            item {
                ModeInfoCard(modeLabel = modeLabel, players = entries.size)
                Spacer(Modifier.height(12.dp))
            }
            // Completed-daily dropdown (your board for this mode), web parity:
            // collapsible "Completed/Attempted Today" card above the user rank.
            item(key = "completed-$selectedMode") {
                com.wordocious.app.ui.game.CompletedDailyBoard(selectedMode)
            }
            // User rank — "You're ranked #N of M"
            if (userIdx >= 0) {
                item {
                    UserRankCard(rank = userIdx + 1, total = entries.size)
                    Spacer(Modifier.height(12.dp))
                }
            }
            // Leaderboard label
            item {
                Text(
                    "LEADERBOARD", fontSize = 10.sp, fontWeight = FontWeight.Black,
                    color = WTheme.textMuted, letterSpacing = 1.sp,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }
            // Leaderboard body
            if (loading) {
                item {
                    Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = WTheme.primary)
                    }
                }
            } else if (entries.isEmpty()) {
                item {
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.textMuted.copy(alpha = 0.3f), modifier = Modifier.size(32.dp))
                        Spacer(Modifier.height(8.dp))
                        Text("No results yet. Be the first!", color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
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
                                rank = index + 1, entry = entry, mode = selectedMode,
                                isCurrentUser = entry.userId == userId,
                            )
                            if (index < entries.size - 1) Divider()
                        }
                    }
                }
            }
            // Yesterday's Winners (collapsible)
            item {
                Spacer(Modifier.height(16.dp))
                Row(
                    Modifier.fillMaxWidth().clickableNoRipple { showYesterday = !showYesterday }.padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Yesterday's Winners", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                    Spacer(Modifier.width(4.dp))
                    Icon(
                        if (showYesterday) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                        null, tint = WTheme.textMuted, modifier = Modifier.size(16.dp),
                    )
                }
                if (showYesterday) {
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
                    ) {
                        if (yesterday.isEmpty()) {
                            Text(
                                "No results from yesterday", fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                color = WTheme.textMuted, modifier = Modifier.fillMaxWidth().padding(24.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        } else {
                            yesterday.forEachIndexed { i, e ->
                                YesterdayRow(rank = i + 1, entry = e)
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

/** Rank icon — Crown (#1 gold), Medal (#2 muted / #3 bronze), else "#N". Web parity. */
@Composable
private fun RankIcon(rank: Int) {
    when (rank) {
        1 -> Icon(
            androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_crown),
            null, tint = Color(0xFFD97706), modifier = Modifier.size(20.dp),
        )
        2 -> Icon(Icons.Filled.MilitaryTech, null, tint = WTheme.textMuted, modifier = Modifier.size(20.dp))
        3 -> Icon(Icons.Filled.MilitaryTech, null, tint = Color(0xFFB45309), modifier = Modifier.size(20.dp))
        else -> Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
            Text("#$rank", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
    }
}

@Composable
private fun ModeInfoCard(modeLabel: String, players: Int) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(WTheme.primary.copy(alpha = 0.10f)),
            contentAlignment = Alignment.Center,
        ) { Icon(Icons.Filled.EmojiEvents, null, tint = WTheme.primary, modifier = Modifier.size(16.dp)) }
        Column {
            Text(modeLabel, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Filled.People, null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp))
                Text(
                    "$players player${if (players != 1) "s" else ""} today",
                    fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
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
    // Web parity (daily/page.tsx): Clock icon + time, no "Resets" label.
    androidx.compose.foundation.layout.Row(
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(4.dp),
    ) {
        androidx.compose.material3.Icon(
            Icons.Filled.Schedule, null,
            tint = WTheme.textMuted, modifier = Modifier.size(12.dp),
        )
        Text(
            "%02d:%02d:%02d".format(h, m, s),
            fontSize = 11.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold,
        )
    }
}

private fun secondsUntilMidnight(): Long {
    val ms = 86_400_000L
    return (ms - (System.currentTimeMillis() % ms)) / 1000L
}

private val LB_SHORT = mapOf(
    "DUEL" to "Classic", "QUORDLE" to "Quad", "OCTORDLE" to "Octo", "SEQUENCE" to "Succ.",
    "RESCUE" to "Deliv.", "DUEL_6" to "Six", "DUEL_7" to "Seven", "GAUNTLET" to "Gauntlet", "PROPERNOUNDLE" to "Proper",
)
private val LB_GLYPH = mapOf("QUORDLE" to "IV", "OCTORDLE" to "VIII", "DUEL_6" to "6", "DUEL_7" to "7")

/**
 * 5-over-4 stacked mode grid (all 9 modes visible, no horizontal scroll) — ports
 * the web `<ModePicker grid>` used on /daily + /records and the Profile dailies
 * layout, so you don't have to scroll to find a game.
 */
@Composable
internal fun ModePickerRow(selected: String, onSelect: (String) -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MODE_OPTIONS.take(5).forEach { (id, _) -> ModeCell(id, selected == id, Modifier.weight(1f)) { onSelect(id) } }
        }
        // Bottom 4 centered under the top 5 (each cell = 1/5 width, web parity).
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Spacer(Modifier.weight(0.5f))
            MODE_OPTIONS.drop(5).forEach { (id, _) -> ModeCell(id, selected == id, Modifier.weight(1f)) { onSelect(id) } }
            Spacer(Modifier.weight(0.5f))
        }
    }
}

@Composable
private fun ModeCell(id: String, active: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val accent = runCatching { modeAccent(com.wordocious.core.GameMode.valueOf(id)) }.getOrDefault(WTheme.primary)
    val short = LB_SHORT[id] ?: id
    val glyph = LB_GLYPH[id] ?: short.take(1)
    Column(
        modifier.clip(RoundedCornerShape(12.dp))
            .background(if (active) accent.copy(alpha = 0.08f) else WTheme.surface)
            .border(1.5.dp, if (active) accent else WTheme.border, RoundedCornerShape(12.dp))
            .clickableNoRipple(onClick).padding(horizontal = 4.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = 0.12f)), Alignment.Center) {
            Text(glyph, fontSize = 10.sp, fontWeight = FontWeight.Black, color = accent)
        }
        Text(short, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = if (active) accent else WTheme.textMuted, maxLines = 1)
    }
}

@Composable
private fun UserRankCard(rank: Int, total: Int) {
    Box(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(Color(0xFFFFFBEB), WTheme.surface)))
            .border(1.5.dp, Color(0xFFFDE68A), RoundedCornerShape(16.dp))
            .padding(12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("You're ranked ", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text("#$rank", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color(0xFFD97706))
            Text(" of $total", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
}

/** Win/Loss pill (full word "Win"/"Loss"). */
@Composable
private fun WinLossPill(completed: Boolean, abbrev: Boolean = false) {
    Box(
        Modifier.clip(RoundedCornerShape(4.dp))
            .background(if (completed) WTheme.winBg else WTheme.lossBg)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(
            if (abbrev) (if (completed) "W" else "L") else (if (completed) "Win" else "Loss"),
            fontSize = 9.sp, fontWeight = FontWeight.ExtraBold,
            color = if (completed) WTheme.winText else WTheme.lossText,
        )
    }
}

@Composable
internal fun LeaderboardRow(rank: Int, entry: LeaderboardService.LeaderboardEntry, mode: String, isCurrentUser: Boolean) {
    val bg = when {
        isCurrentUser -> Color(0xFFFFFBEB)   // highlight-gold
        rank <= 3 -> WTheme.surfaceAlt
        else -> Color.Transparent
    }
    Row(
        modifier = Modifier.fillMaxWidth().background(bg).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RankIcon(rank)
        // Username (+ " (you)" gold suffix)
        Row(Modifier.weight(1f)) {
            Text(
                entry.username ?: "Player",
                fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
            if (isCurrentUser) Text(" (you)", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFD97706))
        }
        // Right column: score over detail line
        Column(horizontalAlignment = Alignment.End) {
            Text("${entry.compositeScore.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(rowDetail(entry, mode), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                WinLossPill(entry.completed)
            }
        }
    }
}

@Composable
private fun YesterdayRow(rank: Int, entry: LeaderboardService.LeaderboardEntry) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RankIcon(rank)
        Text(entry.username ?: "Player", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, modifier = Modifier.weight(1f), maxLines = 1)
        WinLossPill(entry.completed, abbrev = true)
        Text("${entry.compositeScore.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
    }
}

/** Row detail: "{guesses} Guesses · m s [· bs/tb] [· hint label]". Mirrors web. */
private fun rowDetail(entry: LeaderboardService.LeaderboardEntry, mode: String): String {
    val sb = StringBuilder("${entry.guessCount} Guesses · ${fmtTime(entry.timeSeconds)}")
    if (entry.totalBoards > 1) sb.append(" · ${entry.boardsSolved}/${entry.totalBoards}")
    formatHintsLabel(mode, entry.hintsUsed)?.let { sb.append(" · $it") }
    return sb.toString()
}

private val HINT_BEARING = setOf("DUEL_6", "DUEL_7", "PROPERNOUNDLE")
private fun formatHintsLabel(mode: String, hints: Int): String? {
    if (mode !in HINT_BEARING) return null
    if (hints <= 0) return "No hints"
    return "$hints hint${if (hints == 1) "" else "s"}"
}

private fun fmtTime(s: Int): String =
    if (s < 60) "${s}s" else (s % 60).let { sec -> if (sec > 0) "${s / 60}m ${sec}s" else "${s / 60}m" }
