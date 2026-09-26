package com.wordocious.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Timeline
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ModeGen
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FriendsService
import com.wordocious.app.data.ModeStats
import com.wordocious.app.todayLocalDate
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme

// ACTIVITY (§290, Friends D3.2) — the Friends tab's feed: the last seven days
// of your circle's moments — Daily Sweeps, Flawless Victories, podium /
// perfect / streak medals, all-time records set, More Games Sweeps — newest
// first, each row a door to the profile. Read-only over the existing tables
// (GET /api/friends/feed). Twin of web components/friends/activity-feed.tsx.

private val PURPLE = Color(0xFF7C3AED)

/** One feed sentence + its icon (a vector, or the crown drawable for gold). */
private data class FeedLine(val text: String, val icon: ImageVector?, val crown: Boolean, val tint: Color)

// Mirrors web RECORD_LABELS label + format (RecordsScreen's copy is private).
private val RECORD_LABEL: Map<String, Pair<String, (Int) -> String>> = mapOf(
    "fastest_win" to ("Fastest Win" to { v -> if (v < 60) "${v}s" else "${v / 60}m ${v % 60}s" }),
    "fewest_guesses" to ("Fewest Guesses" to { v -> "$v guesses" }),
    "most_games_played" to ("Most Games Played" to { v -> "$v games" }),
    "longest_streak" to ("Longest Streak" to { v -> "$v wins" }),
    "most_gold_medals" to ("Most Gold Medals" to { v -> "$v golds" }),
    "highest_level" to ("Highest Level" to { v -> "Level $v" }),
    "most_daily_completions" to ("Most Dailies Completed" to { v -> "$v dailies" }),
)

/** The record's title and value read through the mode's guess semantics (More Games §11). */
private fun recordLabelAndValue(kind: String, value: Int?, gameMode: String?): Pair<String, String> {
    val base = RECORD_LABEL[kind]
    val meta = gameMode?.let { ModeGen.byDbKey(it) }
    if (kind == "fewest_guesses" && meta != null && meta.guessSemantics != "guesses") {
        return ModeStats.fewestRecordLabel(meta.guessSemantics) to
            (value?.let { formatGuessStat(meta.guessSemantics, meta.guessBase, it) } ?: "")
    }
    return (base?.first ?: kind) to (value?.let { v -> base?.second?.invoke(v) ?: v.toString() } ?: "")
}

/** The sentence exactly as web describe() writes it. */
private fun describe(e: FriendsService.FeedEvent): FeedLine {
    val who = if (e.me) "You" else e.username
    val game = e.gameTitle ?: e.gameMode ?: ""
    return when (e.type) {
        "flawless" -> FeedLine("$who won every daily — Flawless Victory", Icons.Filled.EmojiEvents, false, Color(0xFFB45309))
        "sweep" -> FeedLine("$who swept the dailies", Icons.Filled.AutoAwesome, false, PURPLE)
        "more_flawless" -> FeedLine("$who — Flawless More Games, all ten won", Icons.Filled.GridView, false, Color(0xFFB45309))
        "more_sweep" -> FeedLine("$who — More Games Sweep, all ten played", Icons.Filled.GridView, false, Color(0xFF4F46E5))
        "record" -> {
            val (label, value) = e.kind?.let { recordLabelAndValue(it, e.value, e.gameMode) } ?: ("record" to "")
            val title = e.gameTitle?.let { "$it " } ?: ""
            val tail = if (value.isNotEmpty()) " · $value" else ""
            FeedLine("$who set the all-time $title$label$tail", Icons.Filled.Star, false, Color(0xFFD97706))
        }
        else -> {
            val k = e.kind ?: ""
            when {
                k == "gold" -> FeedLine("$who took gold in $game", null, true, Color(0xFFD97706))
                k == "silver" -> FeedLine("$who took silver in $game", Icons.Filled.MilitaryTech, false, Color(0xFF9CA3AF))
                k == "bronze" -> FeedLine("$who took bronze in $game", Icons.Filled.MilitaryTech, false, Color(0xFFB45309))
                k == "perfect" -> FeedLine("$who played a perfect $game", Icons.Filled.Star, false, PURPLE)
                k.startsWith("streak_") -> FeedLine("$who hit a ${k.removePrefix("streak_")}-day streak", Icons.Filled.LocalFireDepartment, false, Color(0xFFF97316))
                else -> FeedLine("$who earned a medal in $game", Icons.Filled.MilitaryTech, false, Color(0xFF9CA3AF))
            }
        }
    }
}

/** "today" / "yesterday" / "Mon" — the row's right edge. */
internal fun feedDayLabel(day: String, today: String): String {
    if (day == today) return "today"
    val d = runCatching { java.time.LocalDate.parse(day) }.getOrNull() ?: return day
    val t = runCatching { java.time.LocalDate.parse(today) }.getOrNull() ?: return day
    if (java.time.temporal.ChronoUnit.DAYS.between(d, t) == 1L) return "yesterday"
    return d.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.US)
}

@Composable
fun ActivityFeed(onOpenProfile: (String) -> Unit = {}) {
    val userId = AuthService.userId ?: return
    // null = loading (skeleton); empty = the quiet-week line.
    var events by remember { mutableStateOf<List<FriendsService.FeedEvent>?>(null) }
    var expanded by remember { mutableStateOf(false) }
    LaunchedEffect(userId) { events = FriendsService.fetchFeed(todayLocalDate()) }
    val today = todayLocalDate()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(WTheme.surface, RoundedCornerShape(20.dp))
            .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(20.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Filled.Timeline, null, tint = PURPLE, modifier = Modifier.size(16.dp))
            Text(
                "ACTIVITY",
                fontSize = 15.sp, fontWeight = FontWeight.Black,
                style = TextStyle(
                    brush = Brush.linearGradient(listOf(PURPLE, Color(0xFFEC4899))),
                    fontFamily = Nunito,
                ),
            )
            Spacer(Modifier.weight(1f))
            Text(
                "last 7 days", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                color = WTheme.textMuted, fontFamily = Nunito,
            )
        }
        val list = events
        when {
            list == null -> {
                val pulse = rememberInfiniteTransition(label = "feed-skeleton")
                val a by pulse.animateFloat(
                    initialValue = 0.35f, targetValue = 0.9f,
                    animationSpec = infiniteRepeatable(tween(800, easing = LinearEasing), RepeatMode.Reverse),
                    label = "feed-skeleton-alpha",
                )
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    repeat(3) {
                        Box(
                            Modifier.fillMaxWidth().height(32.dp).clip(RoundedCornerShape(12.dp))
                                .background(WTheme.border).alpha(a),
                        )
                    }
                }
            }
            list.isEmpty() -> Text(
                "Quiet week so far — a sweep, a medal or a record from anyone in your circle shows up here.",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, fontFamily = Nunito,
            )
            else -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val shown = if (expanded) list else list.take(8)
                shown.forEach { e ->
                    val line = describe(e)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (e.me) PURPLE.copy(alpha = 0.06f) else WTheme.bg)
                            // Friends' rows open the profile; your own row stays put.
                            .let { m -> if (e.me) m else m.clickableNoRipple { onOpenProfile(e.userId) } }
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                    ) {
                        FriendAvatar(
                            FriendsService.FriendProfile(
                                id = e.userId, username = e.username,
                                avatarUrl = e.avatarUrl, avatarEmoji = e.avatarEmoji,
                            ),
                        )
                        if (line.crown) {
                            Icon(painterResource(R.drawable.ic_crown), null, tint = line.tint, modifier = Modifier.size(16.dp))
                        } else if (line.icon != null) {
                            Icon(line.icon, null, tint = line.tint, modifier = Modifier.size(16.dp))
                        }
                        Text(
                            line.text, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                            color = WTheme.text, fontFamily = Nunito, lineHeight = 14.sp,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            feedDayLabel(e.day, today), fontSize = 9.sp, fontWeight = FontWeight.Bold,
                            color = WTheme.textMuted, fontFamily = Nunito,
                        )
                    }
                }
                if (list.size > 8) {
                    Text(
                        if (expanded) "Show less" else "Show all ${list.size}",
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = PURPLE, fontFamily = Nunito,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().clickableNoRipple { expanded = !expanded }.padding(vertical = 4.dp),
                    )
                }
            }
        }
    }
}
