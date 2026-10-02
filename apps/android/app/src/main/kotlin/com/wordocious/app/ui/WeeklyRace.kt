package com.wordocious.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Flag
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.WTheme
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription

// The Sunday finish (§294, Friends D3.3) — Android twin of web
// lib/weekly-race.ts (ordinal) and components/stats/weekly-finishes.tsx. The
// weekly friends race is SETTLED server-side once per (viewer, week) and
// written to weekly_race_results by /api/friends; this file only reads those
// rows (owner read via RLS) and says them in words.

/** "You finished 2nd of 6" — the ordinal helper shared by the banner and the Stats card. */
fun ordinal(n: Int): String {
    val v = n % 100
    if (v in 11..13) return "${n}th"
    val suffix = when (n % 10) { 1 -> "st"; 2 -> "nd"; 3 -> "rd"; else -> "th" }
    return "$n$suffix"
}

/** One settled week from weekly_race_results. */
@Serializable
data class WeeklyRaceRow(
    @SerialName("week_start") val weekStart: String,
    val rank: Int,
    val points: Int = 0,
    @SerialName("circle_size") val circleSize: Int = 0,
    @SerialName("winner_points") val winnerPoints: Int? = null,
)

/** "Sep 15–Sep 21" — the Monday–Sunday span of a settled week, exactly as the web card writes it. */
internal fun weekSpanLabel(weekStart: String): String {
    val mon = runCatching { java.time.LocalDate.parse(weekStart) }.getOrNull() ?: return weekStart
    val sun = mon.plusDays(6)
    val f = java.time.format.DateTimeFormatter.ofPattern("MMM d", java.util.Locale.US)
    return "${mon.format(f)}–${sun.format(f)}"
}

private val RACE_PURPLE = Color(0xFF7C3AED)

/**
 * Weekly Race Finishes — the Stats All-time card: how many times you won,
 * placed and showed across the settled weeks, and the last result in words.
 * Hidden until the first week has settled.
 */
@Composable
fun WeeklyFinishesCard(userId: String) {
    // Seeded from the session memo in the FIRST composition, not in the effect a frame later —
    // the card used to be absent on every Stats page swap, then pop in and shove the page
    // down (founder, 2026-09-29).
    var rows by remember(userId) { mutableStateOf(com.wordocious.app.data.StatsMemo.get<List<WeeklyRaceRow>>("weeklyFinishes:$userId") ?: emptyList()) }
    LaunchedEffect(userId) {
        rows = runCatching {
            SupabaseConfig.client.postgrest["weekly_race_results"]
                .select(Columns.raw("week_start, rank, points, circle_size, winner_points")) {
                    filter { eq("user_id", userId) }
                    order("week_start", Order.DESCENDING)
                    limit(52)
                }
                .decodeList<WeeklyRaceRow>()
                .also { com.wordocious.app.data.StatsMemo.set("weeklyFinishes:$userId", it) }
        }.getOrElse { emptyList() }
    }
    if (rows.isEmpty()) return
    val last = rows.first()
    fun count(r: Int) = rows.count { it.rank == r }

    CardShell(Brush.horizontalGradient(listOf(RACE_PURPLE, Color(0xFFEC4899)))) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Filled.Flag, null, tint = RACE_PURPLE, modifier = Modifier.size(16.dp))
            Text("Weekly Race Finishes", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Spacer(Modifier.weight(1f))
            Text(
                "${rows.size} ${if (rows.size == 1) "week" else "weeks"}",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
            // AL addendum 2: medal art (not 🥇 🥈 🥉 emoji); TalkBack reads "2 first-place finishes".
            listOf(Triple(GlyphArt.GOLD, count(1), "first"), Triple(GlyphArt.SILVER, count(2), "second"), Triple(GlyphArt.BRONZE, count(3), "third")).forEach { (medal, n, place) ->
                Column(
                    Modifier.clearAndSetSemantics { contentDescription = "$n $place-place ${if (n == 1) "finish" else "finishes"}" },
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    GlyphArtImage(medal, 24.dp)
                    SoftNumber("$n", 16.sp)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            "${weekSpanLabel(last.weekStart)}: finished ${ordinal(last.rank)} of ${last.circleSize} · ${String.format(java.util.Locale.US, "%,d", last.points)} pts",
            fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
        )
    }
}
