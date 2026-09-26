package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme

private val INDIGO = Color(0xFF4F46E5)

/**
 * The More Games band (founder + JP, 2026-09-26): a full-width tile directly UNDER
 * the game grid — indigo accent, the ten small game icons in catalog order, "N of
 * 10 played", chevron — so nobody hunts for the extra games but the page still opens
 * on the Daily Challenge and the eight word games.
 *
 * It is also the More Games "hero": every More Games daily played → filled indigo,
 * "MORE GAMES SWEEP!"; every one won → the gold Flawless treatment, "FLAWLESS MORE
 * GAMES!". Purely visual — derived from today's completions, never a bonus row, XP
 * or a leaderboard. Tap opens the sheet; Share (sweep states only) shares the More
 * Games card. Mirrors web more-games-band.tsx / iOS MoreGamesBand.swift.
 */
@Composable
fun MoreGamesBand(
    card: ModeCard,
    /** The More Games titles visible to this viewer (catalog ∩ remote flags). */
    modes: List<ModeCard>,
    unlimitedMode: Boolean,
    completions: Map<String, DailyCompletionsService.Completion>,
    onOpen: () -> Unit,
    onShare: () -> Unit,
) {
    val daily = moreDailyModes(modes)
    val tier = if (unlimitedMode) null else moreSweepTier(completions, modes)
    val gold = tier == MoreSweepTier.FLAWLESS
    val totals = moreTotals(completions, modes)
    val titleC = if (tier == null) WTheme.text else if (gold) Color(0xFF92400E) else Color.White
    val subC = if (tier == null) WTheme.textMuted else if (gold) Color(0xFFB45309) else Color(0xFFE0E7FF)
    val subtitle = when {
        tier != null -> "All ${totals.total} ${if (gold) "won" else "played"} · ${totals.totalTimeSeconds / 60}:${"%02d".format(totals.totalTimeSeconds % 60)} · ${formatScore(totals.totalScore.toDouble())} pts"
        unlimitedMode -> card.desc
        else -> morePlayedText(completions.keys, modes)
    }
    val shape = RoundedCornerShape(14.dp)
    val background = when {
        tier == null -> Brush.linearGradient(listOf(WTheme.surface, WTheme.surface))
        gold -> Brush.linearGradient(listOf(Color(0xFFFEF3C7), Color(0xFFFDE68A)))
        else -> Brush.linearGradient(listOf(INDIGO, Color(0xFF6366F1)))
    }
    val borderC = when { tier == null -> WTheme.border; gold -> Color(0xFFF59E0B); else -> INDIGO }

    Box(Modifier.fillMaxWidth().clip(shape).background(background).border(1.5.dp, borderC, shape)) {
        if (tier == null) Box(Modifier.width(4.dp).fillMaxHeight().padding(vertical = 6.dp).clip(CircleShape).background(INDIGO))
        Row(
            Modifier.fillMaxWidth().clickableNoRipple(onOpen).padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier.size(36.dp).clip(RoundedCornerShape(8.dp))
                    .background(if (tier == null) INDIGO.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.25f)),
                contentAlignment = Alignment.Center,
            ) {
                when {
                    gold -> Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFB45309), modifier = Modifier.size(20.dp))
                    tier != null -> Icon(Icons.Filled.AutoAwesome, null, tint = Color.White, modifier = Modifier.size(20.dp))
                    else -> Icon(Icons.Filled.GridView, null, tint = INDIGO, modifier = Modifier.size(20.dp))
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(tier?.title ?: card.title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = titleC, maxLines = 1, overflow = TextOverflow.Ellipsis, fontFamily = Nunito)
                // The ten game icons, catalog order; in a sweep state every tile is a check.
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (m in daily) {
                        val done = m.dbKey != null && completions.containsKey(m.dbKey)
                        if (tier != null) {
                            Box(Modifier.size(18.dp).clip(RoundedCornerShape(5.dp)).background(Color.White.copy(alpha = 0.9f)), contentAlignment = Alignment.Center) {
                                Icon(Icons.Filled.Check, null, tint = if (gold) Color(0xFFB45309) else INDIGO, modifier = Modifier.size(11.dp))
                            }
                        } else {
                            // Played today = full strength with an accent ring; still to play = faded.
                            Box(
                                Modifier.size(18.dp).clip(RoundedCornerShape(5.dp))
                                    .border(1.2.dp, m.accent.copy(alpha = if (done) 0.9f else 0.25f), RoundedCornerShape(5.dp))
                                    .alpha(if (done) 1f else 0.55f),
                                contentAlignment = Alignment.Center,
                            ) { ModeGlyph(m, m.accent, 18.dp) }
                        }
                    }
                }
                Text(subtitle, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = subC, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Filled.ChevronRight, null, tint = if (tier == null) INDIGO else if (gold) Color(0xFFB45309) else Color.White, modifier = Modifier.size(20.dp))
        }
        if (tier != null) {
            Text(
                "Share", fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (gold) Color(0xFFB45309) else INDIGO,
                modifier = Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 36.dp)
                    .clip(CircleShape).background(Color.White.copy(alpha = 0.85f)).clickable { onShare() }
                    .padding(horizontal = 8.dp, vertical = 3.dp),
                style = TextStyle(fontFamily = Nunito),
            )
        }
    }
}
