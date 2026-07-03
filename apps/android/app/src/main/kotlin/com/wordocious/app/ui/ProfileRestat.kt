package com.wordocious.app.ui

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material.icons.filled.TrendingUp
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.MatchStatsService
import com.wordocious.app.data.StatsDeepService
import com.wordocious.app.ui.theme.WTheme

/**
 * Profile restructure cards (restat R1–R3) — ports snapshot-hero.tsx and the
 * new profile/page.tsx sections (and iOS ProfileRestat.swift): SnapshotHero
 * (lifetime stats + this-week strip in ONE card), the "top X% today" standing
 * strip, Opener Lab, Weekday Form, and the Daily Points trend (split out of
 * the old sweep-counts card — the counts' single home is now Records → You).
 */

// ── Snapshot hero ─────────────────────────────────────────────────────────────

/** Merges the old 4-card summary row + "This Week" recap into ONE card:
 *  lifetime headline stats up top, the week strip underneath, and a Pro
 *  upsell link for free users. */
@Composable
fun SnapshotHero(
    totalWins: Int,
    totalLosses: Int,
    currentStreak: Int,
    bestStreak: Int,
    dailyStreak: Int,
    bestDailyStreak: Int,
    gamesThisWeek: Int,
    level: Int,
    xpToNext: Int,
    isPro: Boolean,
    onGoPro: () -> Unit,
) {
    val totalGames = totalWins + totalLosses
    val winRate = if (totalGames > 0) Math.round(totalWins.toFloat() / totalGames * 100) else 0
    KitCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // F4: marquee numbers count up from 0 on first appear (Win Rate keeps "%").
            StatCell(Icons.Filled.EmojiEvents, "Wins", "$totalWins", color = Color(0xFF7C3AED), modifier = Modifier.weight(1f), countUp = totalWins)
            StatCell(Icons.Filled.TrackChanges, "Win Rate", "$winRate%", color = Color(0xFF2563EB), modifier = Modifier.weight(1f), countUp = winRate, countSuffix = "%")
            StatCell(Icons.Filled.Bolt, "Streak", "$currentStreak", sub = "Best: $bestStreak", color = WTheme.primary, modifier = Modifier.weight(1f), countUp = currentStreak)
            StatCell(Icons.Filled.LocalFireDepartment, "Daily", "$dailyStreak", sub = "Best: $bestDailyStreak", color = Color(0xFFF97316), modifier = Modifier.weight(1f), countUp = dailyStreak)
        }
        Spacer(Modifier.height(12.dp))
        Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.border))
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(Icons.Filled.AutoAwesome, null, tint = WTheme.primary, modifier = Modifier.size(13.dp))
            Text("THIS WEEK", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, color = Color(0xFF6D28D9))
            Text(
                "$gamesThisWeek ${if (gamesThisWeek == 1) "game" else "games"}",
                fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1,
            )
            Spacer(Modifier.weight(1f))
            Icon(Icons.Filled.TrendingUp, null, tint = Color(0xFF2563EB), modifier = Modifier.size(13.dp))
            Row {
                Text("$xpToNext XP ", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1)
                Text("to Lvl ${level + 1}", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted, maxLines = 1)
            }
        }
        if (!isPro) {
            Spacer(Modifier.height(10.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.border))
            Row(
                Modifier.fillMaxWidth().clickableNoRipple(onGoPro).padding(top = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Unlock your full insights with Pro", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.primary)
                Spacer(Modifier.weight(1f))
                Text("→", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.primary)
            }
        }
    }
}

// ── Daily standing strip ──────────────────────────────────────────────────────

/** "You're in the top X% today · across N dailies" — where today's composite
 *  scores sit in the field. Hidden when the user hasn't played a daily today.
 *  [reloadToken] bumps refetch (daily completions change the standing). */
@Composable
fun DailyStandingStrip(reloadToken: Int = 0) {
    var standing by remember { mutableStateOf<StatsDeepService.DailyStanding?>(null) }
    LaunchedEffect(reloadToken) {
        AuthService.userId?.let { standing = StatsDeepService.todayDailyStanding(it) }
    }
    val s = standing ?: return
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
            .background(Brush.linearGradient(listOf(Color(0xFFF5F3FF), Color(0xFFFCE7F3))))
            .border(1.5.dp, Color(0xFFE9D5FF), RoundedCornerShape(14.dp))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.TrendingUp, null, tint = WTheme.primary, modifier = Modifier.size(14.dp))
        Row {
            Text("You're in the ", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
            Text("top ${s.topPercent}%", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.primary)
            Text(" today", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
            Text(
                " · across ${s.modesCounted} ${if (s.modesCounted == 1) "daily" else "dailies"}",
                fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted,
            )
        }
    }
}

// ── Opener Lab (basic) ────────────────────────────────────────────────────────

/** Favorite starting words + how they convert (win rate of games opened with
 *  each word). Free-tier card — the deep yield version lives in Deep Insights. */
@Composable
fun OpenerLabCard(playType: String = "solo") {
    var openers by remember { mutableStateOf<List<StatsDeepService.OpenerStat>>(emptyList()) }
    LaunchedEffect(playType) {
        openers = AuthService.userId?.let { StatsDeepService.openerStats(it, 5, playType) } ?: emptyList()
    }
    if (openers.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Opener Lab", accent = Color(0xFF06B6D4))
        KitCard {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                openers.forEachIndexed { i, o ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(WTheme.bg).padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("${i + 1}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, modifier = Modifier.width(16.dp), textAlign = TextAlign.Center)
                        Text(o.word, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = WTheme.text, modifier = Modifier.weight(1f))
                        Text("${o.count}×", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        Text(
                            "${o.winRate}% W", fontSize = 12.sp, fontWeight = FontWeight.Black,
                            color = if (o.winRate >= 50) Color(0xFF7C3AED) else Color(0xFFDC2626),
                            modifier = Modifier.width(48.dp), textAlign = TextAlign.End,
                        )
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "Win rate of games opened with each word",
                fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
            )
        }
    }
}

// ── Weekday form ──────────────────────────────────────────────────────────────

/** Win rate by day of week — highlights your best day (gold bar). */
@Composable
fun WeekdayFormCard(playType: String = "solo") {
    var days by remember { mutableStateOf<List<StatsDeepService.WeekdayFormDay>>(emptyList()) }
    LaunchedEffect(playType) {
        days = AuthService.userId?.let { StatsDeepService.weekdayForm(it, playType) } ?: emptyList()
    }
    if (days.none { it.played > 0 }) return
    val labels = listOf("S", "M", "T", "W", "T", "F", "S")
    val dayNames = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
    val maxPlayed = maxOf(1, days.maxOf { it.played })
    val best = days.filter { it.played >= 3 }
        .maxByOrNull { it.won.toDouble() / it.played }
    val hint = best?.let { "Best: ${dayNames[it.dow]} (${Math.round(it.won * 100.0 / it.played)}%)" }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Weekday Form", accent = Color(0xFFF97316))
        ChartCard(title = "Win rate by day", hint = hint) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
                days.forEach { d ->
                    val rate = if (d.played > 0) d.won.toFloat() / d.played else 0f
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            if (d.played > 0) "${Math.round(rate * 100)}%" else " ",
                            fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        )
                        Box(Modifier.fillMaxWidth().height(44.dp), contentAlignment = Alignment.BottomCenter) {
                            val barMod = Modifier.fillMaxWidth()
                                .height(if (d.played == 0) 2.dp else (4.4f + rate * 39.6f).dp)
                                .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                            val alpha = if (d.played == 0) 1f else 0.5f + 0.5f * d.played / maxPlayed
                            when {
                                d.played == 0 -> Box(barMod.background(WTheme.border))
                                best?.dow == d.dow -> Box(barMod.background(Brush.verticalGradient(listOf(Color(0xFFFBBF24).copy(alpha = alpha), Color(0xFFF97316).copy(alpha = alpha)))))
                                else -> Box(barMod.background(Brush.verticalGradient(listOf(Color(0xFFA78BFA).copy(alpha = alpha), Color(0xFF7C3AED).copy(alpha = alpha)))))
                            }
                        }
                        Text(labels[d.dow], fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                    }
                }
            }
        }
    }
}

// ── Daily points trend ────────────────────────────────────────────────────────

/** Points-per-day line (sweep/flawless days marked) — split out of the old
 *  sweep-counts card; the counts moved to Records → You (single home). */
@Composable
fun DailyPointsChartCard(points: List<MatchStatsService.DailyPointsPoint>) {
    if (points.size < 2) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Daily Points", accent = Color(0xFFEC4899))
        ChartCard(title = "Points per day", hint = "Last 30 days · ● sweep · ● flawless") {
            val maxV = maxOf(1, points.maxOf { it.totalPoints })
            Canvas(Modifier.fillMaxWidth().height(110.dp)) {
                val w = size.width; val h = size.height
                fun x(i: Int) = w * i / (points.size - 1)
                fun y(v: Int) = h - (h * v / maxV)
                val areaPath = androidx.compose.ui.graphics.Path().apply {
                    moveTo(0f, h)
                    points.forEachIndexed { i, p -> lineTo(x(i), y(p.totalPoints)) }
                    lineTo(w, h); close()
                }
                drawPath(areaPath, brush = Brush.verticalGradient(listOf(Color(0xFFA78BFA).copy(alpha = 0.3f), Color.Transparent)))
                val linePath = androidx.compose.ui.graphics.Path().apply {
                    points.forEachIndexed { i, p -> if (i == 0) moveTo(x(i), y(p.totalPoints)) else lineTo(x(i), y(p.totalPoints)) }
                }
                drawPath(linePath, Color(0xFF7C3AED), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f))
                points.forEachIndexed { i, p ->
                    if (p.swept || p.flawless) {
                        drawCircle(
                            if (p.flawless) Color(0xFFF59E0B) else Color(0xFFEC4899),
                            radius = 5f, center = androidx.compose.ui.geometry.Offset(x(i), y(p.totalPoints)),
                        )
                    }
                }
            }
        }
    }
}
