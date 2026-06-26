package com.wordocious.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.DailySweepShare
import com.wordocious.app.ui.theme.WTheme
import kotlin.math.cos
import kotlin.math.sin

/**
 * One-time-per-day Daily Sweep / Flawless Victory celebration overlay. Distinct
 * effects from the per-game victory confetti: Daily Sweep = violet/pink sparkle
 * burst; Flawless = gold firework burst. Mirrors web sweep-celebration.tsx +
 * iOS SweepCelebrationView.
 */
@Composable
fun SweepCelebration(
    byMode: Map<String, DailyCompletionsService.Completion>,
    onShare: () -> Unit,
    onClose: () -> Unit,
) {
    val totals = remember(byMode) { DailyCompletionsService.totals(byMode) }
    val flawless = totals.flawless
    val rows = remember(byMode) { DailySweepShare.rows(byMode) }

    val titleColors = if (flawless) listOf(Color(0xFFFBBF24), Color(0xFFD97706), Color(0xFFB45309))
                      else listOf(Color(0xFFA78BFA), Color(0xFFEC4899))
    val cardGrad = if (flawless) listOf(Color(0xFFFFFBEB), Color(0xFFFEF3C7))
                   else listOf(Color(0xFFFAF5FF), Color(0xFFFCE7F3))
    val barGrad = if (flawless) listOf(Color(0xFFFBBF24), Color(0xFFD97706), Color(0xFFFBBF24))
                  else listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFA78BFA))
    val borderC = if (flawless) Color(0xFFF59E0B) else Color(0xFFC4B5FD)
    val accentText = if (flawless) Color(0xFFB45309) else Color(0xFF6D28D9)

    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.7f))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onClose() },
        contentAlignment = Alignment.Center,
    ) {
        ParticleBurst(flawless)

        Column(
            Modifier.padding(horizontal = 24.dp).fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(Brush.verticalGradient(cardGrad))
                .border(1.5.dp, borderC, RoundedCornerShape(18.dp))
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Top accent bar (web parity).
            Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(barGrad)))

            Column(
                Modifier.padding(horizontal = 18.dp, vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(if (flawless) Icons.Filled.EmojiEvents else Icons.Filled.AutoAwesome, null,
                        tint = if (flawless) Color(0xFFD97706) else Color(0xFF7C3AED), modifier = Modifier.size(if (flawless) 26.dp else 22.dp))
                    Text(if (flawless) "FLAWLESS VICTORY!" else "DAILY SWEEP!", fontSize = 24.sp, fontWeight = FontWeight.Black,
                        style = TextStyle(brush = Brush.linearGradient(titleColors)))
                    Icon(if (flawless) Icons.Filled.EmojiEvents else Icons.Filled.AutoAwesome, null,
                        tint = if (flawless) Color(0xFFD97706) else Color(0xFFEC4899), modifier = Modifier.size(if (flawless) 26.dp else 22.dp))
                }
                Text(
                    if (flawless) "All ${totals.total} daily puzzles won today" else "All ${totals.total} daily puzzles completed today",
                    fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = accentText,
                )

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    stat("${totals.won}/${totals.total}", "Won")
                    stat(fmt(totals.totalTimeSeconds), "Total Time")
                    stat("${totals.totalScore}", "Total Pts")
                }

                // Per-game list (3 columns)
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color.White.copy(alpha = 0.55f)).padding(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    rows.chunked(3).forEach { triple ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            triple.forEach { r ->
                                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                    // Real game icon (same as the home cards) in an accent box;
                                    // falls back to the letter glyph if the mode can't be resolved.
                                    Box(Modifier.size(22.dp).clip(RoundedCornerShape(7.dp)).background(Color(r.accent).copy(alpha = 0.10f)),
                                        contentAlignment = Alignment.Center) {
                                        val card = runCatching { com.wordocious.core.GameMode.valueOf(r.dbKey) }.getOrNull()?.let { modeCardFor(it) }
                                        if (card != null) ModeGlyph(card, tint = Color(r.accent), glyphSize = 12.sp, iconSize = 12.dp)
                                        else Text(r.glyph, fontSize = if (r.glyph.length >= 3) 9.sp else 12.sp, fontWeight = FontWeight.Black, color = Color(r.accent))
                                    }
                                    Text(r.label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.text, maxLines = 1)
                                    Spacer(Modifier.weight(1f))
                                    Text(if (r.won) "✓" else "✗", fontSize = 12.sp, fontWeight = FontWeight.Black,
                                        color = if (r.won) Color(0xFF16A34A) else Color(0xFFDC2626))
                                }
                            }
                            repeat(3 - triple.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                            .background(Brush.horizontalGradient(if (flawless) listOf(Color(0xFFD97706), Color(0xFFB45309)) else listOf(Color(0xFF7C3AED), Color(0xFFEC4899))))
                            .clickable { onShare() }.padding(vertical = 11.dp),
                        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.Share, null, tint = Color.White, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Share", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                    Row(
                        Modifier.clip(RoundedCornerShape(12.dp)).background(Color.White.copy(alpha = 0.7f))
                            .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
                            .clickable { onClose() }.padding(horizontal = 18.dp, vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.Close, null, tint = accentText, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(5.dp))
                        Text("Close", fontSize = 15.sp, fontWeight = FontWeight.Black, color = accentText)
                    }
                }
            }
        }
    }
}

@Composable
private fun stat(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

/** Radial burst of sparkles (Sweep) or glowing dots (Flawless) from center. */
@Composable
private fun ParticleBurst(flawless: Boolean) {
    val count = if (flawless) 28 else 20
    val transition = rememberInfiniteTransition(label = "burst")
    val t by transition.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(if (flawless) 1600 else 1900, easing = LinearEasing), RepeatMode.Restart),
        label = "t",
    )
    Box(Modifier.fillMaxSize()) {
        repeat(count) { i ->
            val angle = i.toDouble() / count * Math.PI * 2 + (i % 2) * 0.4
            val dist = (if (flawless) 180.0 else 140.0) + (i % 5) * 22
            val dx = (cos(angle) * dist * t).dp
            val dy = (sin(angle) * dist * t).dp
            val sz = (if (flawless) 10 + (i % 4) * 4 else 8 + (i % 3) * 3).dp
            Box(
                Modifier.align(Alignment.Center)
                    .offset(x = dx, y = dy)
                    .size(sz)
                    .clip(if (flawless) RoundedCornerShape(50) else RoundedCornerShape(2.dp))
                    .background((if (flawless) Color(0xFFF59E0B) else if (i % 2 == 0) Color(0xFFC4B5FD) else Color(0xFFF9A8D4)).copy(alpha = (1f - t)))
            )
        }
    }
}

private fun fmt(s: Int): String = "%d:%02d".format(s / 60, s % 60)
