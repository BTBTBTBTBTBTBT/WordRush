package com.wordocious.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.border
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Grid3x3
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.TheaterComedy
import androidx.compose.material3.Icon
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.StatsDeepService
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.async
import kotlin.math.cos
import kotlin.math.sin

/**
 * Pro Insights deep layer (restat R4) — ports components/profile/
 * pro-insights-deep.tsx (and iOS ProInsightsDeep.swift): Skill Radar,
 * Rivalries, and the per-mode deep card (opener yield, position accuracy,
 * gauntlet stage breakdown, hint honesty, Word Almanac). Every card
 * self-fetches; free users see the section header + the GO PRO sign
 * invitation (ProStatsInvite, FINISH_SPEC BJ17) — no blur, no sample numbers.
 */

private val WIN_PURPLE = Color(0xFF7C3AED)
private val LOSS_RED = Color(0xFFDC2626)

/** Modes with a stored hints_used count (web HINT_MODES). */
private val HINT_MODES = setOf("DUEL_6", "DUEL_7", "PROPERNOUNDLE")

// ── Skill Radar ───────────────────────────────────────────────────────────────

/** Five-axis pentagon on Canvas; labels drawn edge-aware at R+16 so side
 *  labels ("Versatility 97", "Accuracy 88") never clip (web RadarSvg geometry:
 *  R = 84, cy = H/2 + 8, 240-high chart). */
@Composable
private fun RadarChart(data: StatsDeepService.SkillRadarData) {
    val values = listOf(data.speed, data.accuracy, data.consistency, data.endurance, data.versatility)
    val axes = listOf("Speed", "Accuracy", "Consistency", "Endurance", "Versatility")
    val border = WTheme.border
    val primary = WTheme.primary
    val labelColor = WTheme.textMuted
    val measurer = rememberTextMeasurer()
    val labelStyle = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = labelColor)

    // F4: the value shape grows out from the center (0→1) on first appear.
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    val draw by androidx.compose.animation.core.animateFloatAsState(
        if (appeared || WTheme.reducedMotion) 1f else 0f,
        animationSpec = androidx.compose.animation.core.tween(if (WTheme.reducedMotion) 0 else 600),
        label = "radarDraw",
    )

    Canvas(Modifier.fillMaxWidth().height(240.dp).padding(horizontal = 8.dp)) {
        val r = 84.dp.toPx()
        val cx = size.width / 2f
        val cy = size.height / 2f + 8.dp.toPx()
        fun pt(i: Int, radius: Float): Offset {
            val a = -Math.PI / 2 + i * 2 * Math.PI / 5
            return Offset(cx + radius * cos(a).toFloat(), cy + radius * sin(a).toFloat())
        }
        fun poly(radius: (Int) -> Float): Path = Path().apply {
            for (i in 0 until 5) {
                val p = pt(i, radius(i))
                if (i == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y)
            }
            close()
        }
        // Rings + spokes.
        listOf(0.33f, 0.66f, 1f).forEach { f ->
            drawPath(poly { r * f }, border, style = Stroke(width = 1.dp.toPx()))
        }
        for (i in 0 until 5) {
            drawLine(border, Offset(cx, cy), pt(i, r), strokeWidth = 1.dp.toPx())
        }
        // Value shape (F4: radii scaled by the 0→1 draw factor so it grows out).
        val shape = poly { i -> r * maxOf(0.04f, values[i] / 100f) * draw }
        drawPath(shape, primary.copy(alpha = 0.2f))
        drawPath(shape, primary, style = Stroke(width = 2.dp.toPx(), join = StrokeJoin.Round))
        // Edge-aware labels at R+16.
        for (i in 0 until 5) {
            val p = pt(i, r + 16.dp.toPx())
            val layout = measurer.measure("${axes[i]} ${values[i]}", labelStyle)
            val tx = when {
                p.x > cx + 8.dp.toPx() -> p.x                                // right side → grow rightward
                p.x < cx - 8.dp.toPx() -> p.x - layout.size.width            // left side → grow leftward
                else -> p.x - layout.size.width / 2f                          // top → centered
            }
            drawText(layout, topLeft = Offset(tx, p.y - layout.size.height / 2f))
        }
    }
}

/** Skill Radar section — the five-axis signature chart (Pro). */
@Composable
fun SkillRadarCard(isPro: Boolean, onGoPro: () -> Unit, compact: Boolean = true) {
    // Seeded from the session memo in the FIRST composition, not in the effect a frame later —
    // the card used to be absent on every Stats page swap, then pop in and shove the page
    // down (founder, 2026-09-29).
    val seed = remember { AuthService.userId?.let { com.wordocious.app.data.StatsMemo.get<StatsDeepService.SkillRadarData>("skillRadar:$it") } }
    var data by remember { mutableStateOf(seed) }
    var radarLoaded by remember { mutableStateOf(seed != null) }
    LaunchedEffect(isPro) {
        if (isPro) AuthService.userId?.let { uid ->
            // P-cache: the memo seeded the first frame above; refresh, store back.
            val memoKey = "skillRadar:$uid"
            StatsDeepService.skillRadar(uid)?.let { fresh ->
                data = fresh
                com.wordocious.app.data.StatsMemo.set(memoKey, fresh)
            }
            radarLoaded = true
        }
    }
    // FINISH_SPEC BJ17: free players get the GO PRO sign invitation (no blur, no sample radar).
    if (!isPro) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionHeader("Skill Radar", accent = WTheme.primary)
            ProStatsInvite("See your speed, accuracy and steadiness on a skill radar with Pro", onGoPro, compact, cast = "d")
        }
        return
    }
    val d = data
    if (d == null) {
        // Pro user with too little history — say why, don't vanish (iOS parity).
        if (isPro && radarLoaded) {
            StatsEmptyCard("Skill Radar", hint = "Play 5+ solo games to generate your skill radar.")
        }
        return
    }
    // F3: fade+rise when the fetch lands (static sample for free users → instant).
    AsyncEntrance(visible = true) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Skill Radar", accent = WTheme.primary)
        val card: @Composable () -> Unit = {
            KitCard(accent = Color(0xFF7C3AED)) {
                RadarChart(d)
                Text(
                    "Speed · win rate · steadiness · Gauntlet clears · mode spread — all 0–100",
                    fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp), textAlign = TextAlign.Center,
                )
            }
        }
        card()
    }
    }
}

// ── Rivalries (VS) ────────────────────────────────────────────────────────────

/** Most-faced opponents with head-to-head W–L + win-share bar (Pro). */
@Composable
fun RivalriesCard(isPro: Boolean, onGoPro: () -> Unit, compact: Boolean = true) {
    // Seeded from the session memo in the FIRST composition, not in the effect a frame later —
    // the card used to be absent on every Stats page swap, then pop in and shove the page
    // down (founder, 2026-09-29).
    val seed = remember { AuthService.userId?.let { com.wordocious.app.data.StatsMemo.get<List<StatsDeepService.Rivalry>>("rivalries:$it") } }
    var rows by remember { mutableStateOf(seed ?: emptyList()) }
    var loaded by remember { mutableStateOf(seed != null) }
    LaunchedEffect(isPro) {
        if (isPro) AuthService.userId?.let { uid ->
            // P-cache: the memo seeded the first frame above; refresh, store back.
            val memoKey = "rivalries:$uid"
            val fresh = StatsDeepService.rivalries(uid, 5)
            rows = fresh
            loaded = true
            com.wordocious.app.data.StatsMemo.set(memoKey, fresh)
        }
    }
    // FINISH_SPEC BJ17: free players get the GO PRO sign invitation (no blur, no sample rivals).
    if (!isPro) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionHeader("Rivalries", accent = Color(0xFFEC4899))
            ProStatsInvite("See your head-to-head record against every rival with Pro", onGoPro, compact, cast = "o2")
        }
        return
    }
    val display = rows
    if (display.isEmpty()) {
        if (loaded) StatsEmptyCard("Rivalries", accent = Color(0xFFEC4899),
            hint = "Face the same opponent a few times to start a rivalry.")
        return
    }
    // F3: fade+rise when the fetch lands (row-count gate means this only renders
    // once rows exist, so the entrance runs on first appear).
    AsyncEntrance(visible = true) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Rivalries", accent = Color(0xFFEC4899))
        val card: @Composable () -> Unit = {
            KitCard(accent = Color(0xFFEC4899)) {
                Column(Modifier.clip(RoundedCornerShape(10.dp))) {
                    display.forEachIndexed { i, r -> RivalryRow(r, i) }
                }
            }
        }
        card()
    }
    }
}

@Composable
private fun RivalryRow(r: StatsDeepService.Rivalry, index: Int) {
    val pct = if (r.total > 0) r.wins.toFloat() / r.total else 0f
    Column(
        Modifier.fillMaxWidth().stripedRow(index, Color(0xFFEC4899)).padding(horizontal = 8.dp, vertical = 9.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords), null,
                tint = WTheme.primary, modifier = Modifier.size(14.dp),
            )
            Text(r.username, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.text else FinishInk.heading, maxLines = 1, modifier = Modifier.weight(1f))
            SoftNumber(
                "${r.wins}–${r.losses}" + if (r.draws > 0) "–${r.draws}" else "", 14.sp,
                color = if (r.wins >= r.losses) null else LOSS_RED,
            )
        }
        Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(50)).background(LOSS_RED.copy(alpha = 0.2f))) {
            Box(Modifier.fillMaxWidth(pct.coerceIn(0f, 1f)).height(6.dp).clip(RoundedCornerShape(50)).background(WIN_PURPLE))
        }
    }
}

// ── Per-mode deep card ────────────────────────────────────────────────────────

private data class DeepData(
    val openers: List<StatsDeepService.OpenerDeepStat> = emptyList(),
    val positions: StatsDeepService.PositionAccuracy? = null,
    val almanac: List<StatsDeepService.AlmanacEntry> = emptyList(),
    val hints: StatsDeepService.HintHonesty? = null,
    val gauntlet: List<StatsDeepService.GauntletStageStat> = emptyList(),
) {
    val hasAny: Boolean
        get() = openers.isNotEmpty() || positions != null || almanac.isNotEmpty() ||
            hints != null || gauntlet.isNotEmpty()
}

/**
 * Deep Insights (restat R4): opener yield, position accuracy, stage breakdown
 * (Gauntlet only), hint honesty (Six/Seven/ProperNoundle only), Word Almanac.
 * Pro-gated with a static sample preview for free users.
 */
@Composable
fun ProDeepModeCard(gameMode: String, isPro: Boolean, accent: Color, onGoPro: () -> Unit, playType: String = "solo") {
    // Word games only (founder, 2026-09-30: Sudocious/Starsweep store 81-cell boards as their
    // "words", and Position Accuracy drew 81 slots across the Stats page).
    val meta = com.wordocious.app.ModeGen.byDbKey(gameMode)
    if (meta?.engine != "word") return
    // The mode's statPanels flags — ProperNoundle names get neither card.
    val panels = com.wordocious.app.data.ModeStats.statPanels(gameMode, meta.guessSemantics)
    // Seeded from the session memo in the FIRST composition, not in the effect a frame later —
    // the card used to be absent on every Stats page swap, then pop in and shove the page
    // down (founder, 2026-09-29).
    // Keyed on the mode + play type, so a switch resets to THAT key's memo (or null), never
    // the previous mode's insights.
    var data by remember(gameMode, playType) {
        mutableStateOf(AuthService.userId?.let { com.wordocious.app.data.StatsMemo.get<DeepData>("deepMode:$it:$gameMode:$playType") })
    }
    LaunchedEffect(gameMode, isPro, playType) {
        if (!isPro || playType == "vs_cpu") return@LaunchedEffect
        val uid = AuthService.userId ?: return@LaunchedEffect
        // P-cache: the memo seeded the first frame above; fetch fresh below and store back (SWR).
        val memoKey = "deepMode:$uid:$gameMode:$playType"
        // All sub-stats CONCURRENTLY (was 5 serial round-trips). Openers /
        // positions / hint honesty all consume the identical myGuessRows
        // slice (mode, limit 400, play type) — fetch it ONCE and pass it down;
        // almanac (limit 24) and gauntlet hit different queries so they just
        // run in parallel.
        val fresh = kotlinx.coroutines.coroutineScope {
            val rowsD = async { StatsDeepService.myGuessRows(uid, gameMode, playType = playType) }
            val almanacD = async { StatsDeepService.wordAlmanac(uid, gameMode, 24, playType) }
            val gauntletD = async { if (gameMode == "GAUNTLET") StatsDeepService.gauntletStageStats(uid, playType) else emptyList() }
            val rows = rowsD.await()
            val openersD = async { StatsDeepService.openerDeep(uid, gameMode, 4, playType, preloaded = rows) }
            val positionsD = async { StatsDeepService.positionAccuracy(uid, gameMode, playType, preloaded = rows) }
            val hintsD = async { if (gameMode in HINT_MODES) StatsDeepService.hintHonesty(uid, gameMode, playType, preloaded = rows) else null }
            DeepData(
                openers = if (panels.openerYield) openersD.await() else emptyList(),
                positions = if (panels.positionAccuracy) positionsD.await() else null,
                almanac = almanacD.await(),
                hints = hintsD.await(),
                gauntlet = gauntletD.await(),
            )
        }
        data = fresh
        com.wordocious.app.data.StatsMemo.set(memoKey, fresh)
    }
    // No per-game rows exist for CPU practice — hide the deep card entirely
    // (the panel shows a "totals only" note instead; restat B1).
    if (playType == "vs_cpu") return
    // FINISH_SPEC BJ17: free players get the GO PRO sign invitation (no blur, no sample insights).
    if (!isPro) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionHeader("Deep Insights", accent = accent)
            ProStatsInvite("See your best openers, letter accuracy and word almanac with Pro", onGoPro, cast = "i")
        }
        return
    }
    val d = data
    if (isPro && data != null && !data!!.hasAny) {
        StatsEmptyCard("Deep Insights", accent = accent,
            hint = "Play more of this mode to unlock openers, accuracy and almanac insights.")
        return
    }
    if (d == null || !d.hasAny) return
    // F3: fade+rise when the fetch lands (only renders once data has rows).
    AsyncEntrance(visible = true) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Deep Insights", accent = accent)
        val inner: @Composable () -> Unit = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (d.openers.isNotEmpty()) OpenerYieldCard(d.openers, accent)
                d.positions?.let { PositionAccuracyCard(it, accent) }
                if (d.gauntlet.isNotEmpty()) StageBreakdownCard(d.gauntlet)
                d.hints?.let { HintsCard(it) }
                if (d.almanac.isNotEmpty()) AlmanacCard(d.almanac, accent)
            }
        }
        inner()
    }
    }
}

// ── Sub-cards ─────────────────────────────────────────────────────────────────

@Composable
private fun DeepCardTitle(icon: ImageVector, title: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(icon, null, tint = color, modifier = Modifier.size(14.dp))
        Text(title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
    }
}

@Composable
private fun DeepCaption(text: String) {
    Text(
        text, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
        modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
    )
}

private fun fmt1(v: Double): String = if (v == v.toInt().toDouble()) "${v.toInt()}" else "$v"

@Composable
private fun OpenerYieldCard(openers: List<StatsDeepService.OpenerDeepStat>, accent: Color) {
    KitCard(accent = accent) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DeepCardTitle(Icons.Filled.Lightbulb, "Opener Yield", accent)
            Column(Modifier.clip(RoundedCornerShape(10.dp))) {
                openers.forEachIndexed { i, o ->
                    Row(
                        Modifier.fillMaxWidth().stripedRow(i, accent).padding(horizontal = 8.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(o.word, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = WTheme.text, modifier = Modifier.weight(1f))
                        // AL addendum 2: code-drawn tile swatches in our colors, not 🟩 / 🟨 emoji.
                        OpenerYield(fmt1(o.avgGreens), WIN_PURPLE, "right spot")
                        OpenerYield(fmt1(o.avgYellows), Color(0xFFF59E0B), "wrong spot")
                        Text(
                            "${o.count}× · ${o.winRate}%", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            color = WTheme.textMuted, modifier = Modifier.width(60.dp), textAlign = TextAlign.End,
                        )
                    }
                }
            }
            DeepCaption("Average greens / yellows revealed by your first guess")
        }
    }
}

@Composable
private fun PositionAccuracyCard(p: StatsDeepService.PositionAccuracy, accent: Color) {
    KitCard(accent = accent) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DeepCardTitle(Icons.Filled.Grid3x3, "Position Accuracy", accent)
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
            ) {
                p.pct.forEachIndexed { i, pct ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(
                            Modifier.size(44.dp).clip(RoundedCornerShape(8.dp))
                                .background(accent.copy(alpha = (0.08f + pct / 100f * 0.78f).coerceIn(0f, 1f))),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("$pct%", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (pct > 45) Color.White else WTheme.text)
                        }
                        Text("${i + 1}", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                }
            }
            DeepCaption("How often each slot is green across ${p.sampleGuesses} guesses")
        }
    }
}

@Composable
private fun StageBreakdownCard(stages: List<StatsDeepService.GauntletStageStat>) {
    KitCard(accent = Color(0xFFD97706)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                // Theater masks, not the skull (which is the Gauntlet/Nemesis glyph) — iOS.
                Icon(Icons.Filled.TheaterComedy, null, tint = Color(0xFFD97706), modifier = Modifier.size(14.dp))
                Text("Stage Breakdown", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            }
            Column(Modifier.clip(RoundedCornerShape(10.dp))) {
                stages.forEachIndexed { i, s ->
                    val clearPct = if (s.runs > 0) (s.clears.toDouble() / s.runs * 100).toInt() else 0
                    Row(
                        Modifier.fillMaxWidth().stripedRow(i, Color(0xFFD97706)).padding(horizontal = 8.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("${s.stage + 1}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, modifier = Modifier.width(16.dp))
                        Text(s.name ?: "Stage ${s.stage + 1}", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1, modifier = Modifier.weight(1f))
                        if (s.avgTimeSecs > 0) {
                            Text("~${s.avgTimeSecs}s", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        }
                        Text(
                            "$clearPct%", fontSize = 12.sp, fontWeight = FontWeight.Black,
                            color = if (clearPct >= 50) WIN_PURPLE else LOSS_RED,
                            modifier = Modifier.width(44.dp), textAlign = TextAlign.End,
                        )
                    }
                }
            }
            DeepCaption("Clear rate + average time per stage")
        }
    }
}

@Composable
private fun HintsCard(h: StatsDeepService.HintHonesty) {
    KitCard(accent = Color(0xFFF5A524)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Lightbulb, null, tint = Color(0xFFF5A524), modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Hints", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Spacer(Modifier.weight(1f))
                Text("${h.gamesCounted} games", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    SoftNumber("${h.hintlessWinRate}%", 22.sp)
                    Text("HINTLESS WINS", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    SoftNumber(fmt1(h.avgHintsPerGame), 22.sp)
                    Text("HINTS / GAME", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
        }
    }
}

@Composable
private fun AlmanacCard(entries: List<StatsDeepService.AlmanacEntry>, accent: Color) {
    KitCard(accent = accent) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DeepCardTitle(Icons.Filled.MenuBook, "Word Almanac", accent)
            // 3-col purple/red grid, capped at ~224dp with inner scroll (web max-h-56).
            Column(
                Modifier.heightIn(max = 224.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                entries.chunked(3).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        row.forEach { a ->
                            Column(
                                Modifier.weight(1f).clip(RoundedCornerShape(8.dp))
                                    .background(if (a.won) Color(0xFFF5F3FF) else Color(0xFFFEF2F2))
                                    .border(1.dp, if (a.won) Color(0xFFDDD6FE) else Color(0xFFFECACA), RoundedCornerShape(8.dp))
                                    .padding(6.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(1.dp),
                            ) {
                                Text(
                                    a.word, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
                                    color = if (a.won) Color(0xFF6D28D9) else LOSS_RED, maxLines = 1,
                                )
                                if (a.won) Text(
                                    "${a.guesses}g",
                                    fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                                ) else Icon3D(Icon3DName.BADGE_L, 11.dp, contentDescription = "missed")
                            }
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
            DeepCaption("Every solution you've faced recently — solved in purple")
        }
    }
}


/** Visible "no data yet" chrome — replaces silent hiding for Pro users (an
 *  invisible card reads as a broken build; stuck-on-empty with real history
 *  behind it = a failing fetch). iOS StatsEmptyCard / web parity. */
@Composable
fun StatsEmptyCard(title: String, accent: Color = WTheme.primary, hint: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(title, accent = accent)
        // A1 / A7: a tinted card in the section's accent with a small cast pose (never D,
        // the Stats host; one character per title so two cards never repeat an image).
        val pose = StatsPoses.forTitle(title)
        KitCard(accent = accent) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                CastPose(pose.id, pose.pose, 64.dp)
                Text(
                    hint,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

/** Opener Yield's average + a code-drawn tile swatch in our color (AL addendum 2: no 🟩 / 🟨). */
@Composable
private fun OpenerYield(value: String, color: Color, spoken: String) {
    Row(
        Modifier.clearAndSetSemantics { contentDescription = "$value $spoken" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(value, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = color)
        GlyphSwatch(color, 9.dp)
    }
}
