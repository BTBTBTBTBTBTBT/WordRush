package com.wordocious.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Undo
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.SignatureStats
import com.wordocious.app.ui.theme.WTheme
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

// The audit's new stats on the All-time page (D2) — Android twin of web
// components/stats/signature-cards.tsx. Free: SignatureCard — Best day, Best
// week, Comebacks (a win on the very last row), Perfect games. Pro:
// StandingTrendCard — your average Top X% per day over the last 30 days, the
// one badge formula, blurred behind the Pro lock for free players.

private val MONTH_DAY = DateTimeFormatter.ofPattern("MMM d", Locale.US)

/** "Sep 22" from "2026-09-22". */
internal fun fmtSignatureDay(day: String): String =
    runCatching { LocalDate.parse(day).format(MONTH_DAY) }.getOrDefault("")

/** "Sep 15–21" from the week's Monday (web fmtWeek: the Sunday shows its day number only). */
internal fun fmtSignatureWeek(monday: String): String = runCatching {
    val m = LocalDate.parse(monday)
    "${m.format(MONTH_DAY)}–${m.plusDays(6).dayOfMonth}"
}.getOrDefault("")

/** SIGNATURE — four free cells from the player's own solo matches. Renders
 *  nothing until the read lands (web returns null while loading). */
@Composable
fun SignatureCard(userId: String) {
    var sig by remember { mutableStateOf<SignatureStats.Signature?>(null) }
    LaunchedEffect(userId) {
        val memoKey = "signature:$userId"
        com.wordocious.app.data.StatsMemo.get<SignatureStats.Signature>(memoKey)?.let { sig = it }
        SignatureStats.fetchSignature(userId)?.let { fresh ->
            sig = fresh
            com.wordocious.app.data.StatsMemo.set(memoKey, fresh)
        }
    }
    val s = sig ?: return
    AsyncEntrance(visible = true) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionHeader("Signature", accent = Color(0xFFF97316))
            KitCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatCell(
                        Icons.Filled.CalendarToday, "Best day",
                        s.bestDay?.wins?.toString() ?: "—",
                        sub = s.bestDay?.let { "${fmtSignatureDay(it.day)} · wins" },
                        color = Color(0xFF7C3AED), modifier = Modifier.weight(1f),
                    )
                    StatCell(
                        Icons.Filled.DateRange, "Best week",
                        s.bestWeek?.wins?.toString() ?: "—",
                        sub = s.bestWeek?.let { "${fmtSignatureWeek(it.weekStart)} · wins" },
                        color = Color(0xFF2563EB), modifier = Modifier.weight(1f),
                    )
                    StatCell(Icons.Filled.Undo, "Comebacks", "${s.comebacks}", sub = "last-row wins", color = Color(0xFFF97316), modifier = Modifier.weight(1f))
                    StatCell(Icons.Filled.Star, StatLabels.perfect, "${s.perfectGames}", sub = "games", color = WTheme.correct, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

// A sample curve for the locked preview so free players see the shape.
private val STANDING_SAMPLE: List<SignatureStats.StandingPoint> =
    listOf(38, 31, 27, 22, 25, 18, 14, 16, 12, 9).mapIndexed { i, p -> SignatureStats.StandingPoint("d$i", p, 3) }

/** STANDING TREND (Pro) — average Top X% per day over the last 30 days as a
 *  sparkline (1 % at the top, dashed Top-25 % line). Hidden for a Pro player
 *  with fewer than two points; free players see the sample curve under the lock. */
@Composable
fun StandingTrendCard(userId: String, isPro: Boolean, onGoPro: () -> Unit) {
    var pts by remember { mutableStateOf<List<SignatureStats.StandingPoint>?>(null) }
    LaunchedEffect(userId, isPro) {
        if (!isPro) { pts = emptyList(); return@LaunchedEffect }
        val memoKey = "standingTrend:$userId"
        com.wordocious.app.data.StatsMemo.get<List<SignatureStats.StandingPoint>>(memoKey)?.let { pts = it }
        val fresh = SignatureStats.fetchStandingTrend(userId, 30)
        pts = fresh
        com.wordocious.app.data.StatsMemo.set(memoKey, fresh)
    }
    val data: List<SignatureStats.StandingPoint> = if (isPro) (pts ?: return) else STANDING_SAMPLE
    if (isPro && data.size < 2) return
    val latest = data.lastOrNull()
    val first = data.firstOrNull()
    val improving = latest != null && first != null && latest.topPercent < first.topPercent
    AsyncEntrance(visible = true) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionHeader("Standing Trend", accent = WTheme.primary)
            val card: @Composable () -> Unit = {
                ChartCard(
                    title = "Standing trend",
                    hint = latest?.let { "Last 30 days · now Top ${it.topPercent}%${if (improving) " · climbing" else ""}" },
                    empty = if (data.isEmpty()) "Play a few dailies to see your standing over time." else null,
                ) {
                    StandingSparkline(data)
                    Row(Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(first?.let { dayLabelOrBlank(it.day) } ?: "", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        Spacer(Modifier.weight(1f))
                        Icon(Icons.Filled.TrendingUp, null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp))
                        Text(" dashed = Top 25%", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        Spacer(Modifier.weight(1f))
                        Text(latest?.let { dayLabelOrBlank(it.day) } ?: "", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                }
            }
            if (isPro) card() else ProLockOverlay("Standing trend — Pro", onGoPro) { card() }
        }
    }
}

/** Only real "YYYY-MM-DD" days get a label; the sample curve's "d0…" stays blank. */
private fun dayLabelOrBlank(day: String): String =
    if (Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(day)) fmtSignatureDay(day) else ""

/** The line: 1 % at the top, 100 % at the bottom; dots amber when at or inside the Top 25 %. */
@Composable
private fun StandingSparkline(data: List<SignatureStats.StandingPoint>) {
    val lineColor = WTheme.primary
    val guideColor = WTheme.border
    val amber = Color(0xFFD97706)
    Canvas(Modifier.fillMaxWidth().height(80.dp)) {
        val pad = 6.dp.toPx()
        val w = size.width
        val h = size.height
        val n = data.size
        fun x(i: Int) = pad + i * (w - pad * 2) / maxOf(1, n - 1)
        fun y(p: Int) = pad + ((p - 1) / 99f) * (h - pad * 2)
        // Top 25 % guide.
        val y25 = y(25)
        drawLine(
            guideColor, Offset(pad, y25), Offset(w - pad, y25), strokeWidth = 1.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 3.dp.toPx())),
        )
        if (n == 0) return@Canvas
        val path = Path()
        data.forEachIndexed { i, d ->
            if (i == 0) path.moveTo(x(i), y(d.topPercent)) else path.lineTo(x(i), y(d.topPercent))
        }
        drawPath(path, lineColor, style = Stroke(width = 2.5.dp.toPx(), join = StrokeJoin.Round, cap = StrokeCap.Round))
        data.forEachIndexed { i, d ->
            drawCircle(if (d.topPercent <= 25) amber else lineColor, radius = 2.5.dp.toPx(), center = Offset(x(i), y(d.topPercent)))
        }
    }
}
