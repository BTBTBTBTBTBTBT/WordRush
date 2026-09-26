package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ModeGen
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.StatsDeepService
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode

/**
 * The Stats tab's landing page — "your day in one card" (Stats + Friends
 * redesign D2, founder 2026-09-26): the eight sweep tiles with today's W/L,
 * then More Games N of 10, VS W/L, today's field standing (the leaderboard's
 * (better+1)/total — the ONE formula, via StatsDeepService.todayDailyStanding),
 * the sweep streak and a "best moment" line. Free tier throughout — today's
 * facts. Sweep/Flawless days keep the banner treatment the old Today's Dailies
 * card had (the §244 footer is passed in). Twin of web
 * components/stats/today-card.tsx and iOS TodayCard.
 */

/** The single best thing that happened today: a perfect game first, else the
 *  fastest win. Pure over today's completions — no fetch. Returns (text, dbKey). */
fun bestMomentToday(todayDailies: Map<String, DailyCompletionsService.Completion>): Pair<String, String>? {
    data class Perfect(val key: String, val title: String, val n: Int, val noun: String, val semantics: String)
    data class Fastest(val key: String, val title: String, val secs: Int)
    var perfect: Perfect? = null
    var fastest: Fastest? = null
    // Catalog order so two equal candidates resolve the same way every time.
    for (meta in ModeGen.daily) {
        val key = meta.dbKey ?: continue
        val r = todayDailies[key] ?: continue
        if (!r.completed) continue
        if (r.guessCount <= meta.guessBase && perfect == null) {
            val noun = com.wordocious.app.data.ModeStats.guessNoun(meta.guessSemantics)
            perfect = Perfect(key, meta.title, r.guessCount, if (r.guessCount == 1) noun.one else noun.many, meta.guessSemantics)
        }
        if (r.timeSeconds > 0 && (fastest == null || r.timeSeconds < fastest.secs)) fastest = Fastest(key, meta.title, r.timeSeconds)
    }
    perfect?.let { p ->
        val detail = if (p.semantics == "guesses") " in ${p.n} ${p.noun}" else ""
        return "Perfect ${p.title}$detail" to p.key
    }
    fastest?.let { f -> return "Fastest win: ${f.title} in ${fmtMomentTime(f.secs)}" to f.key }
    return null
}

/** "2:45" / "45s" — web today-card fmtTime. */
private fun fmtMomentTime(s: Int): String {
    val m = s / 60
    val r = s % 60
    return if (m > 0) "$m:${r.toString().padStart(2, '0')}" else "${r}s"
}

@Composable
fun TodayCard(
    /** The sweep set's dbKeys, canonical order. */
    sweepModes: List<String>,
    /** The More Games titles this viewer can see (daily-eligible, flag on). */
    moreModes: List<ModeCard>,
    todayDailies: Map<String, DailyCompletionsService.Completion>,
    vsDailyWon: Boolean?,
    standing: StatsDeepService.DailyStanding?,
    sweepStreak: Int,
    flawlessStreak: Int,
    /** Rendered under the tiles on a Flawless day (the §244 streak + share footer). */
    flawlessFooter: @Composable () -> Unit,
    onPlayDaily: (GameMode) -> Unit,
    onJump: (String) -> Unit,
) {
    val completed = sweepModes.count { todayDailies.containsKey(it) }
    val wins = sweepModes.count { todayDailies[it]?.completed == true }
    val total = sweepModes.size
    val allDone = total > 0 && completed >= total
    val flawless = allDone && wins == total
    val moreDaily = moreModes.filter { it.dailyEligible && it.dbKey != null }
    val morePlayed = moreDaily.count { todayDailies.containsKey(it.dbKey!!) }
    val moment = bestMomentToday(todayDailies)
    val dateLabel = java.text.SimpleDateFormat("EEE, MMM d", java.util.Locale.US).format(java.util.Date())

    val cardBg = when {
        flawless -> Brush.linearGradient(listOf(Color(0xFFFEF3C7), Color(0xFFFDE68A)))
        allDone -> Brush.linearGradient(listOf(Color(0xFFF5F3FF), Color(0xFFFCE7F3)))
        else -> Brush.linearGradient(listOf(WTheme.surface, WTheme.surface))
    }
    val cardBorder = if (flawless) Color(0xFFF59E0B) else if (allDone) Color(0xFFC4B5FD) else WTheme.border

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(cardBg)
                .border(1.5.dp, cardBorder, RoundedCornerShape(16.dp)).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (allDone) {
                // Flanking trophy/sparkle glyphs + gradient banner text (the old Today's Dailies card).
                val bannerIcon = if (flawless) Icons.Filled.EmojiEvents else Icons.Filled.AutoAwesome
                val iconSize = if (flawless) 18.dp else 15.dp
                Row(
                    Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                ) {
                    Icon(bannerIcon, null, tint = if (flawless) Color(0xFFB45309) else Color(0xFF7C3AED), modifier = Modifier.size(iconSize))
                    Text(
                        if (flawless) "FLAWLESS VICTORY!" else "DAILY SWEEP!",
                        fontSize = 16.sp, fontWeight = FontWeight.Black,
                        style = TextStyle(
                            fontFamily = Nunito,
                            brush = Brush.linearGradient(
                                if (flawless) listOf(Color(0xFFD97706), Color(0xFFB45309))
                                else listOf(Color(0xFFA78BFA), Color(0xFFEC4899)),
                            ),
                        ),
                    )
                    Icon(bannerIcon, null, tint = if (flawless) Color(0xFFB45309) else Color(0xFFEC4899), modifier = Modifier.size(iconSize))
                }
            } else {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("TODAY · ${dateLabel.uppercase()}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
                    Text("$completed/$total", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
                }
            }

            // The eight sweep tiles, one row — tap plays (or reopens) that daily.
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                sweepModes.forEach { id -> SweepTile(id, todayDailies[id], Modifier.weight(1f), onPlayDaily) }
            }

            if (allDone) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    if (flawless) flawlessFooter()
                    else Text(
                        "All $total dailies completed · +200 XP earned",
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF6D28D9),
                    )
                }
            }

            // The rest of the day: More Games, VS, where you stand.
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TodayPill(
                    label = "More Games", value = if (moreDaily.isNotEmpty()) "$morePlayed of ${moreDaily.size}" else "—",
                    color = Color(0xFF4F46E5), modifier = Modifier.weight(1f),
                    icon = { Icon(Icons.Filled.GridView, null, tint = Color(0xFF4F46E5), modifier = Modifier.size(11.dp)) },
                    onClick = { onJump(moreDaily.firstOrNull()?.dbKey ?: RAIL_TODAY) },
                )
                TodayPill(
                    label = "VS Battle", value = when (vsDailyWon) { null -> "—"; true -> "W"; false -> "L" },
                    color = Color(0xFFEC4899), modifier = Modifier.weight(1f),
                    icon = { Icon(painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = Color(0xFFEC4899), modifier = Modifier.size(11.dp)) },
                    onClick = { onJump(RAIL_VS) },
                )
                TodayPill(
                    label = "Standing", value = standing?.let { "Top ${it.topPercent}%" } ?: "—",
                    color = Color(0xFF7C3AED), modifier = Modifier.weight(1f),
                    icon = { Icon(Icons.Filled.TrendingUp, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(11.dp)) },
                    onClick = null,
                )
            }

            // The ten More Games as tiny chips, so the day reads at a glance.
            if (moreDaily.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
                ) {
                    moreDaily.forEach { c ->
                        val r = todayDailies[c.dbKey!!]
                        val done = r != null
                        val bg = if (!done) c.accent.copy(alpha = 0.13f) else if (r!!.completed) c.accent else RAIL_LOSS_RED
                        Box(
                            Modifier.size(20.dp).clip(RoundedCornerShape(5.dp)).background(bg)
                                .then(if (done) Modifier else Modifier.border(1.dp, c.accent.copy(alpha = 0.33f), RoundedCornerShape(5.dp)))
                                .clickableNoRipple { onJump(c.dbKey) },
                            contentAlignment = Alignment.Center,
                        ) {
                            ModeGlyph(c, if (done) Color.White else c.accent, box = 20.dp)
                        }
                    }
                }
            }
        }

        // Streaks + the best thing that happened today.
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Filled.LocalFireDepartment, null, tint = Color(0xFFF97316), modifier = Modifier.size(16.dp))
                Column {
                    Text("SWEEP STREAK", fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.6.sp)
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            "$sweepStreak ${if (sweepStreak == 1) "day" else "days"}",
                            fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1,
                        )
                        if (flawlessStreak >= 2) {
                            Text("· $flawlessStreak flawless", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFFB45309), maxLines = 1)
                        }
                    }
                }
            }
            val isPerfect = moment?.first?.startsWith("Perfect") == true
            Row(
                Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp))
                    .then(if (moment != null) Modifier.clickableNoRipple { onJump(moment.second) } else Modifier)
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (isPerfect) Icon(Icons.Filled.Star, null, tint = WTheme.correct, modifier = Modifier.size(16.dp))
                else Icon(Icons.Filled.Timer, null, tint = Color(0xFF2563EB), modifier = Modifier.size(16.dp))
                Column(Modifier.weight(1f)) {
                    Text("BEST MOMENT", fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.6.sp)
                    Text(
                        moment?.first ?: "Play a daily to start your day",
                        fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

/** One of the three day pills: uppercase 9sp label in the accent, 14sp value. */
@Composable
private fun TodayPill(
    label: String,
    value: String,
    color: Color,
    modifier: Modifier,
    icon: @Composable () -> Unit,
    onClick: (() -> Unit)?,
) {
    Column(
        modifier.clip(RoundedCornerShape(12.dp)).background(WTheme.bg).border(1.dp, WTheme.border, RoundedCornerShape(12.dp))
            .then(if (onClick != null) Modifier.clickableNoRipple(onClick) else Modifier)
            .padding(horizontal = 4.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            icon()
            Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = color, letterSpacing = 0.6.sp, maxLines = 1)
        }
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text, maxLines = 1, textAlign = TextAlign.Center)
    }
}

/** One sweep tile: W/L filled when played (win purple / loss red), the mode's
 *  glyph when not, 8sp label — the old Today's Dailies badge, one row wide. */
@Composable
fun SweepTile(modeId: String, completion: DailyCompletionsService.Completion?, modifier: Modifier = Modifier, onPlayDaily: (GameMode) -> Unit) {
    val played = completion != null
    val won = completion?.completed == true
    val mode = runCatching { GameMode.valueOf(modeId) }.getOrNull()
    val accent = mode?.let { modeAccent(it) } ?: WTheme.primary
    val tileBg = if (!played) WTheme.bg else if (won) WTheme.correct else RAIL_LOSS_RED
    val tileBorder = if (!played) WTheme.border else tileBg
    Column(
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier.then(if (mode != null) Modifier.clickableNoRipple { onPlayDaily(mode) } else Modifier),
    ) {
        Box(
            Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(tileBg)
                .border(1.5.dp, tileBorder, RoundedCornerShape(10.dp)).alpha(if (played) 1f else 0.7f),
            contentAlignment = Alignment.Center,
        ) {
            if (played) Text(if (won) "W" else "L", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
            else mode?.let { ModeGlyph(it, accent, box = 36.dp) }
        }
        Text(
            ModeGen.byDbKey(modeId)?.shortTitle ?: modeId, fontSize = 8.sp, fontWeight = FontWeight.Bold,
            color = if (played) WTheme.text else WTheme.textMuted,
            maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis,
        )
    }
}
