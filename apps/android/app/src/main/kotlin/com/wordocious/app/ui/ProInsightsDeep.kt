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
 * self-fetches; free users see static sample content blurred behind the
 * gradient Pro pill.
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
fun SkillRadarCard(isPro: Boolean, onGoPro: () -> Unit) {
    var data by remember { mutableStateOf<StatsDeepService.SkillRadarData?>(null) }
    LaunchedEffect(isPro) {
        if (isPro) AuthService.userId?.let { uid ->
            // P-cache: seed from the session memo (instant repaint), refresh, store back.
            val memoKey = "skillRadar:$uid"
            com.wordocious.app.data.StatsMemo.get<StatsDeepService.SkillRadarData>(memoKey)?.let { data = it }
            StatsDeepService.skillRadar(uid)?.let { fresh ->
                data = fresh
                com.wordocious.app.data.StatsMemo.set(memoKey, fresh)
            }
        }
    }
    // Locked preview uses the web's static sample so free users see the shape.
    val d = if (isPro) data else StatsDeepService.SkillRadarData(62, 74, 55, 40, 68)
    if (d == null) return
    // F3: fade+rise when the fetch lands (static sample for free users → instant).
    AsyncEntrance(visible = true) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader("Skill Radar", accent = WTheme.primary)
        val card: @Composable () -> Unit = {
            KitCard {
                RadarChart(d)
                Text(
                    "Speed · win rate · steadiness · Gauntlet clears · mode spread — all 0–100",
                    fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp), textAlign = TextAlign.Center,
                )
            }
        }
        if (isPro) card() else ProLockOverlay("Unlock Skill Radar with Pro", onGoPro) { card() }
    }
    }
}

// ── Rivalries (VS) ────────────────────────────────────────────────────────────

/** Most-faced opponents with head-to-head W–L + win-share bar (Pro). */
@Composable
fun RivalriesCard(isPro: Boolean, onGoPro: () -> Unit) {
    var rows by remember { mutableStateOf<List<StatsDeepService.Rivalry>>(emptyList()) }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(isPro) {
        if (isPro) AuthService.userId?.let { uid ->
            // P-cache: seed from the session memo (instant repaint), refresh, store back.
            val memoKey = "rivalries:$uid"
            com.wordocious.app.data.StatsMemo.get<List<StatsDeepService.Rivalry>>(memoKey)?.let { rows = it }
            val fresh = StatsDeepService.rivalries(uid, 5)
            rows = fresh
            loaded = true
            com.wordocious.app.data.StatsMemo.set(memoKey, fresh)
        }
    }
    val display = if (isPro) rows else listOf(
        StatsDeepService.Rivalry("1", "WordSmith", 4, 2, 0, 6),
        StatsDeepService.Rivalry("2", "LexiconLou", 1, 3, 1, 5),
    )
    if (isPro && display.isEmpty()) {
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
            KitCard {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    display.forEach { RivalryRow(it) }
                }
            }
        }
        if (isPro) card() else ProLockOverlay("Unlock Rivalries with Pro", onGoPro) { card() }
    }
    }
}

@Composable
private fun RivalryRow(r: StatsDeepService.Rivalry) {
    val pct = if (r.total > 0) r.wins.toFloat() / r.total else 0f
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(WTheme.bg).padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords), null,
                tint = WTheme.primary, modifier = Modifier.size(14.dp),
            )
            Text(r.username, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1, modifier = Modifier.weight(1f))
            Text(
                "${r.wins}–${r.losses}" + if (r.draws > 0) "–${r.draws}" else "",
                fontSize = 12.sp, fontWeight = FontWeight.Black,
                color = if (r.wins >= r.losses) WIN_PURPLE else LOSS_RED,
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

/** Locked preview uses static sample content so free users see the shape (web parity). */
private val DEEP_SAMPLE = DeepData(
    openers = listOf(StatsDeepService.OpenerDeepStat("CRANE", 12, 1.2, 1.6, 75)),
    positions = StatsDeepService.PositionAccuracy(5, listOf(34, 22, 28, 31, 41), 120),
    almanac = listOf(
        StatsDeepService.AlmanacEntry("PIQUE", true, 4, 88, "sample-1"),
        StatsDeepService.AlmanacEntry("KNOLL", false, 6, 240, "sample-2"),
    ),
)

/**
 * Deep Insights (restat R4): opener yield, position accuracy, stage breakdown
 * (Gauntlet only), hint honesty (Six/Seven/ProperNoundle only), Word Almanac.
 * Pro-gated with a static sample preview for free users.
 */
@Composable
fun ProDeepModeCard(gameMode: String, isPro: Boolean, accent: Color, onGoPro: () -> Unit, playType: String = "solo") {
    var data by remember { mutableStateOf<DeepData?>(null) }
    LaunchedEffect(gameMode, isPro, playType) {
        if (!isPro || playType == "vs_cpu") return@LaunchedEffect
        data = null
        val uid = AuthService.userId ?: return@LaunchedEffect
        // P-cache: seed from the session memo (instant repaint on mode re-tap),
        // then fetch fresh below and store back (SWR).
        val memoKey = "deepMode:$uid:$gameMode:$playType"
        com.wordocious.app.data.StatsMemo.get<DeepData>(memoKey)?.let { data = it }
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
                openers = openersD.await(),
                positions = positionsD.await(),
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
    val d = if (isPro) data else DEEP_SAMPLE
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
        if (isPro) inner() else ProLockOverlay("Unlock Deep Insights with Pro", onGoPro) { inner() }
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
    KitCard {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DeepCardTitle(Icons.Filled.Lightbulb, "Opener Yield", accent)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                openers.forEach { o ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(WTheme.bg).padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(o.word, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = WTheme.text, modifier = Modifier.weight(1f))
                        Text("${fmt1(o.avgGreens)} 🟩", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WIN_PURPLE)
                        Text("${fmt1(o.avgYellows)} 🟨", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
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
    KitCard {
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
    KitCard {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_skull), null,
                    tint = Color(0xFFD97706), modifier = Modifier.size(14.dp),
                )
                Text("Stage Breakdown", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                stages.forEach { s ->
                    val clearPct = if (s.runs > 0) (s.clears.toDouble() / s.runs * 100).toInt() else 0
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(WTheme.bg).padding(8.dp),
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
    KitCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("💡 Hints", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Spacer(Modifier.weight(1f))
                Text("${h.gamesCounted} games", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("${h.hintlessWinRate}%", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WIN_PURPLE)
                    Text("HINTLESS WINS", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(fmt1(h.avgHintsPerGame), fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                    Text("HINTS / GAME", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
        }
    }
}

@Composable
private fun AlmanacCard(entries: List<StatsDeepService.AlmanacEntry>, accent: Color) {
    KitCard {
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
                                Text(
                                    if (a.won) "${a.guesses}g" else "✗",
                                    fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                                )
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
        KitCard {
            Text(
                hint,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = WTheme.textMuted,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
            )
        }
    }
}
