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
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
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

/** All-time's head (finishing build C3): the "ALL-TIME" label over the four tiles, each in
 *  its own color with its 3D icon and a soft count-up number — purple WINS, green WIN
 *  RATE, gold WIN STREAK, pink DAILY STREAK — then the this-week strip (a tinted pill)
 *  and, for free players, the amber Pro candy button. */
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
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        FinishLabel("ALL-TIME", Modifier.padding(horizontal = 4.dp).semantics { heading() })
        // F4: marquee numbers count up from 0 on first appear (Win Rate keeps "%").
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatsTile(
                StatsInk.LAVENDER, "Wins", "$totalWins", Modifier.weight(1f).fillMaxHeight(),
                icon = Icon3DName.TROPHY, sub = "all games", countUp = totalWins,
            )
            StatsTile(
                StatsInk.GREEN, "Win Rate", "$winRate%", Modifier.weight(1f).fillMaxHeight(),
                icon = Icon3DName.BADGE_W, sub = "$totalGames ${if (totalGames == 1) "game" else "games"}",
                countUp = winRate, countSuffix = "%",
            )
        }
        // Glossary (StatLabels, §296): Win Streak = consecutive wins; Daily Streak = days with a daily.
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatsTile(
                StatsInk.GOLD, StatLabels.winStreak, "$currentStreak", Modifier.weight(1f).fillMaxHeight(),
                icon = Icon3DName.CROWN, sub = "best $bestStreak", countUp = currentStreak,
            )
            StatsTile(
                StatsInk.PINK, StatLabels.dailyStreak, "$dailyStreak", Modifier.weight(1f).fillMaxHeight(),
                icon = Icon3DName.FLAME, sub = "best $bestDailyStreak", countUp = dailyStreak,
            )
        }
        val purple = Color(0xFF7C3AED)
        Row(
            Modifier.fillMaxWidth().tintedPill(purple).padding(start = 12.dp, end = 12.dp, top = 11.dp, bottom = 8.dp)
                .semantics(mergeDescendants = true) { },
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(Icons.Filled.AutoAwesome, null, tint = purple, modifier = Modifier.size(13.dp))
            Text("THIS WEEK", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, color = if (WTheme.isDark) WTheme.textSecondary else Color(0xFF6D28D9))
            SoftNumber("$gamesThisWeek", 15.sp)
            Text(if (gamesThisWeek == 1) "game" else "games", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.text else FinishInk.heading, maxLines = 1)
            Spacer(Modifier.weight(1f))
            SoftNumber(formatCount(xpToNext), 15.sp)
            Text("XP to Lvl ${level + 1}", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted, maxLines = 1)
        }
        if (!isPro) {
            CandyButton(
                "Unlock your full insights with Pro", onGoPro, Modifier.fillMaxWidth(),
                color = CandyColor.AMBER, size = CandySize.MEDIUM, fill = true, fontSize = 13.sp,
                leading = { Icon3D(Icon3DName.CROWN, 18.dp) },
            )
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
        Modifier.fillMaxWidth().tintedPill(Color(0xFFF5A524), corner = 14.dp)
            .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 9.dp),
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
    // Seeded from the session memo in the FIRST composition, not in the effect a frame later —
    // the card used to be absent on every Stats page swap, then pop in and shove the page
    // down (founder, 2026-09-29).
    val memoKey = "openerLab:${AuthService.userId}:$playType"
    val seed = remember(playType) { com.wordocious.app.data.StatsMemo.get<List<StatsDeepService.OpenerStat>>(memoKey) }
    var openers by remember(playType) { mutableStateOf(seed ?: emptyList()) }
    var loaded by remember(playType) { mutableStateOf(seed != null) }
    LaunchedEffect(playType) {
        openers = AuthService.userId?.let { StatsDeepService.openerStats(it, 5, playType) } ?: emptyList()
        loaded = true
        com.wordocious.app.data.StatsMemo.set(memoKey, openers)
    }
    if (openers.isEmpty()) {
        if (loaded && playType != "vs_cpu") StatsEmptyCard("Opener Lab", accent = Color(0xFF06B6D4),
            hint = "Win a few games and your favorite starting words show up here.")
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Opener Lab", accent = Color(0xFF06B6D4))
        KitCard(accent = Color(0xFF06B6D4)) {
            Column(Modifier.clip(RoundedCornerShape(10.dp))) {
                openers.forEachIndexed { i, o ->
                    Row(
                        Modifier.fillMaxWidth().stripedRow(i, Color(0xFF06B6D4)).padding(horizontal = 8.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("${i + 1}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, modifier = Modifier.width(16.dp), textAlign = TextAlign.Center)
                        Text(o.word, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = if (WTheme.isDark) WTheme.text else FinishInk.heading, modifier = Modifier.weight(1f))
                        Text("${o.count}×", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        // Width 56 + single line: "100% W" overflowed the old 48dp
                        // column and wrapped the W onto its own line (web w-14 +
                        // nowrap parity).
                        Text(
                            "${o.winRate}% W", fontSize = 12.sp, fontWeight = FontWeight.Black,
                            color = if (o.winRate >= 50) Color(0xFF7C3AED) else Color(0xFFDC2626),
                            modifier = Modifier.width(56.dp), textAlign = TextAlign.End,
                            maxLines = 1, softWrap = false,
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
    // Seeded from the session memo in the FIRST composition, not in the effect a frame later —
    // the card used to be absent on every Stats page swap, then pop in and shove the page
    // down (founder, 2026-09-29).
    val memoKey = "weekdayForm:${AuthService.userId}:$playType"
    val seed = remember(playType) { com.wordocious.app.data.StatsMemo.get<List<StatsDeepService.WeekdayFormDay>>(memoKey) }
    var days by remember(playType) { mutableStateOf(seed ?: emptyList()) }
    var loaded by remember(playType) { mutableStateOf(seed != null) }
    LaunchedEffect(playType) {
        days = AuthService.userId?.let { StatsDeepService.weekdayForm(it, playType) } ?: emptyList()
        loaded = true
        com.wordocious.app.data.StatsMemo.set(memoKey, days)
    }
    if (days.none { it.played > 0 }) {
        if (loaded && playType != "vs_cpu") StatsEmptyCard("Weekday Form", accent = Color(0xFFF97316),
            hint = "Play across the week to see your win rate by day.")
        return
    }
    val labels = listOf("S", "M", "T", "W", "T", "F", "S")
    val dayNames = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
    val maxPlayed = maxOf(1, days.maxOf { it.played })
    val best = days.filter { it.played >= 3 }
        .maxByOrNull { it.won.toDouble() / it.played }
    val hint = best?.let { "Best: ${dayNames[it.dow]} (${Math.round(it.won * 100.0 / it.played)}%)" }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Weekday Form", accent = Color(0xFFF97316))
        ChartCard(title = "Win rate by day", hint = hint, accent = Color(0xFFF97316)) {
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
                                d.played == 0 -> Box(barMod.background(Color(0xFF7C3AED).copy(alpha = 0.14f)))
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

/** Points-per-day lines (sweep/flawless days marked) — split out of the old
 *  sweep-counts card; the counts moved to Records → You (single home).
 *  Founder, 2026-10-01 stats audit: two lines, Wordocious in violet and Puzzles
 *  in pink, each dot marking that row's own sweep (its color) or flawless (gold)
 *  day — one total jumped at the Puzzles launch and read as a big improvement. */
@Composable
fun DailyPointsChartCard(points: List<MatchStatsService.DailyPointsPoint>) {
    if (points.size < 2) return
    val wordColor = Color(0xFF7C3AED)
    val puzzleColor = Color(0xFFDB2777)
    val gold = Color(0xFFF59E0B)
    val hasPuzzles = points.any { it.puzzlePoints > 0 }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Daily Points", accent = Color(0xFFEC4899))
        ChartCard(title = "Points per day", hint = "Last 30 days · ● sweep · ● flawless", accent = Color(0xFFEC4899)) {
            val maxV = maxOf(1, points.maxOf { maxOf(it.wordPoints, it.puzzlePoints) })
            Canvas(Modifier.fillMaxWidth().height(110.dp)) {
                val w = size.width; val h = size.height
                fun x(i: Int) = w * i / (points.size - 1)
                fun y(v: Int) = h - (h * v / maxV)
                fun line(v: (MatchStatsService.DailyPointsPoint) -> Int) = androidx.compose.ui.graphics.Path().apply {
                    points.forEachIndexed { i, p -> if (i == 0) moveTo(x(i), y(v(p))) else lineTo(x(i), y(v(p))) }
                }
                val areaPath = androidx.compose.ui.graphics.Path().apply {
                    moveTo(0f, h)
                    points.forEachIndexed { i, p -> lineTo(x(i), y(p.wordPoints)) }
                    lineTo(w, h); close()
                }
                drawPath(areaPath, brush = Brush.verticalGradient(listOf(Color(0xFFA78BFA).copy(alpha = 0.3f), Color.Transparent)))
                drawPath(line { it.wordPoints }, wordColor, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f))
                if (hasPuzzles) drawPath(line { it.puzzlePoints }, puzzleColor, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f))
                fun dot(i: Int, v: Int, color: Color) {
                    val c = androidx.compose.ui.geometry.Offset(x(i), y(v))
                    drawCircle(Color.White, radius = 6.5f, center = c)
                    drawCircle(color, radius = 5f, center = c)
                }
                points.forEachIndexed { i, p ->
                    if (p.swept || p.flawless) dot(i, p.wordPoints, if (p.flawless) gold else wordColor)
                    if (hasPuzzles && (p.puzzleSwept || p.puzzleFlawless)) dot(i, p.puzzlePoints, if (p.puzzleFlawless) gold else puzzleColor)
                }
            }
            Spacer(Modifier.height(6.dp))
            Row(
                Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
            ) {
                PointsLegend("Wordocious", wordColor, line = true)
                if (hasPuzzles) PointsLegend("Puzzles", puzzleColor, line = true)
                PointsLegend("flawless", gold, line = false)
            }
        }
    }
}

@Composable
private fun PointsLegend(label: String, color: Color, line: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            Modifier.size(width = if (line) 10.dp else 8.dp, height = if (line) 2.dp else 8.dp)
                .clip(RoundedCornerShape(50)).background(color),
        )
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}
