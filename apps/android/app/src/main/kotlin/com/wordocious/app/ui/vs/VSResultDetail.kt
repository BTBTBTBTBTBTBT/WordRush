package com.wordocious.app.ui.vs

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import kotlin.math.max
import kotlin.random.Random

/**
 * VS result-screen detail components — Android port of web
 * components/vs/vs-result-detail.tsx (ComparisonBars + FinalBoards) plus the
 * win confetti (same parameters as VictoryOverlay's ConfettiView / web
 * effects/confetti.tsx).
 */

// ── Final boards (letters revealed) ────────────────────────────────────────────

/** One guess entry (board index + word). */
data class GuessLogEntry(val boardIndex: Int, val guess: String)

private data class EvaluatedRow(val letters: List<String>, val states: List<TileState>)

/** Evaluate a guess log against the match solutions, grouped per board. */
private fun evaluateLog(log: List<GuessLogEntry>, solutions: List<String>): Map<Int, List<EvaluatedRow>> {
    val byBoard = LinkedHashMap<Int, MutableList<EvaluatedRow>>()
    for ((boardIndex, rawGuess) in log) {
        val word = rawGuess.uppercase()
        val solution = solutions.getOrNull(boardIndex)
        // ProperNoundle / length mismatches can throw — fall back to gray.
        val states: List<TileState> = if (solution != null) {
            runCatching { evaluateGuess(solution.uppercase(), word).tiles.map { it.state } }
                .getOrElse { word.map { TileState.ABSENT } }
        } else {
            word.map { TileState.ABSENT }
        }
        byBoard.getOrPut(boardIndex) { mutableListOf() }
            .add(EvaluatedRow(word.map { it.toString() }, states))
    }
    return byBoard
}

/** Did this guess log actually solve anything? True when any guess matches its
 *  board's solution — solving beats score, and the result screen spells it out. */
fun logSolved(log: List<GuessLogEntry>, solutions: List<String>): Boolean =
    log.any { (boardIndex, guess) ->
        solutions.getOrNull(boardIndex)?.uppercase() == guess.uppercase()
    }

@Composable
private fun SolveBadge(solved: Boolean, fontSize: Int = 10) {
    val color = if (solved) Color(0xFF16A34A) else Color(0xFFDC2626)
    Text(
        if (solved) "✓ Solved" else "✗ Not solved",
        fontSize = fontSize.sp, fontWeight = FontWeight.ExtraBold, color = color,
        modifier = Modifier.clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.10f))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

data class ScoreCardPlayer(
    val name: String,
    val score: Double,
    val guesses: Int,
    val timeMs: Double,
    val solved: Boolean,
    val isWinner: Boolean,
)

/**
 * Prominent head-to-head FINAL SCORE card — big totals (winner crowned +
 * highlighted, loser dimmed), the exact calculation under each, and solve
 * badges. Replaces the inverted comparison bars, which read backwards for
 * lower-is-better metrics.
 */
@Composable
fun ScoreCard(me: ScoreCardPlayer, opponent: ScoreCardPlayer, isDraw: Boolean) {
    fun clock(ms: Double): String {
        val s = (ms / 1000).toInt()
        return "${s / 60}m ${s % 60}s"
    }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("FINAL SCORE", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp, color = WTheme.textMuted)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ScoreColumn(me, Color(0xFF7C3AED), isDraw, ::clock, Modifier.weight(1f))
            Text("VS", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, modifier = Modifier.padding(top = 32.dp))
            ScoreColumn(opponent, Color(0xFFEC4899), isDraw, ::clock, Modifier.weight(1f))
        }
        Text(
            "Score = guesses + time (1 pt per 45s) · lowest score wins — but solving always beats not solving",
            fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

@Composable
private fun ScoreColumn(p: ScoreCardPlayer, accent: Color, isDraw: Boolean, clock: (Double) -> String, modifier: Modifier) {
    val highlighted = p.isWinner || isDraw
    val timePenalty = max(0.0, p.score - p.guesses)
    Column(
        modifier.then(if (highlighted) Modifier else Modifier.graphicsLayer { alpha = 0.75f }),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            if (p.isWinner && !isDraw) Text("👑", fontSize = 10.sp)
            Text(p.name, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(
            String.format("%.2f", p.score), fontSize = 34.sp, fontWeight = FontWeight.Black,
            color = if (highlighted) accent else WTheme.textMuted,
        )
        Text("${p.guesses} guesses + ${String.format("%.2f", timePenalty)} time", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        Text(clock(p.timeMs), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        SolveBadge(p.solved)
    }
}

private fun tileBrush(state: TileState): Brush = when (state) {
    TileState.CORRECT -> Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9)))
    TileState.PRESENT -> Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706)))
    else -> Brush.linearGradient(listOf(Color(0xFF9CA3AF), Color(0xFF9CA3AF)))
}

@Composable
private fun LetterBoard(rows: List<EvaluatedRow>) {
    // Shrink tiles for long words so two boards still fit side-by-side (web: 24/21/18).
    val wordLen = rows.firstOrNull()?.letters?.size ?: 5
    val tile = if (wordLen <= 5) 24.dp else if (wordLen == 6) 21.dp else 18.dp
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        rows.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                row.letters.forEachIndexed { ci, letter ->
                    Box(
                        Modifier.size(tile).clip(RoundedCornerShape(4.dp))
                            .background(tileBrush(row.states.getOrNull(ci) ?: TileState.ABSENT)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(letter, fontSize = (tile.value * 0.5f).sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }
            }
        }
    }
}

/**
 * Side-by-side final boards WITH letters — yours from local play, the
 * opponent's reconstructed from the match-end guess log. Multi-board modes
 * are capped at 2 rendered boards per player with a "+N more" note.
 */
@Composable
fun FinalBoards(
    myName: String,
    opponentName: String,
    myGuessLog: List<GuessLogEntry>,
    opponentGuessLog: List<GuessLogEntry>,
    solutions: List<String>,
) {
    val mine = remember(myGuessLog, solutions) { evaluateLog(myGuessLog, solutions) }
    val theirs = remember(opponentGuessLog, solutions) { evaluateLog(opponentGuessLog, solutions) }
    if (mine.isEmpty() && theirs.isEmpty()) return
    val mySolved = remember(myGuessLog, solutions) { logSolved(myGuessLog, solutions) }
    val oppSolved = remember(opponentGuessLog, solutions) { logSolved(opponentGuessLog, solutions) }

    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            FinalBoardsSide(myName, mine, Color(0xFF7C3AED), mySolved, Modifier.weight(1f))
            Box(Modifier.width(1.dp).fillMaxHeight().background(WTheme.border))
            FinalBoardsSide(opponentName, theirs, Color(0xFFEC4899), oppSolved, Modifier.weight(1f))
        }
        // Single-board modes: reveal the answer so a missed board isn't a mystery.
        if (solutions.size == 1) {
            Text(
                "Answer: ${solutions[0].uppercase()}", fontSize = 11.sp, fontWeight = FontWeight.Black,
                letterSpacing = 1.sp, color = WTheme.textSecondary,
            )
        }
    }
}

@Composable
private fun FinalBoardsSide(label: String, boards: Map<Int, List<EvaluatedRow>>, accent: Color, solved: Boolean, modifier: Modifier) {
    val indices = boards.keys.sorted()
    val shown = indices.take(2)
    val more = indices.size - shown.size
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp,
            color = accent, maxLines = 1, overflow = TextOverflow.Ellipsis,
        )
        // At-a-glance outcome for this side's boards.
        SolveBadge(solved, fontSize = 9)
        if (shown.isEmpty()) {
            Text("No guesses", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.padding(vertical = 12.dp))
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                shown.forEach { idx -> LetterBoard(boards[idx] ?: emptyList()) }
            }
        }
        if (more > 0) {
            Text("+$more more", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
}

// ── Comparison bars ────────────────────────────────────────────────────────────

data class ComparisonMetric(val label: String, val mine: Double, val theirs: Double, val format: (Double) -> String)

/**
 * Two horizontal bars per metric (you = purple, them = pink). All metrics are
 * lower-is-better, so bar length is inverted: the lower value gets the fuller
 * bar (width = other/(sum), min 6%).
 */
@Composable
fun ComparisonBars(myName: String, opponentName: String, metrics: List<ComparisonMetric>) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        metrics.forEach { m ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    m.label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black,
                    letterSpacing = 0.8.sp, color = WTheme.textMuted,
                )
                val total = m.mine + m.theirs
                val myFrac = if (total <= 0.0) 0.5f else (m.theirs / total).toFloat()
                val theirFrac = if (total <= 0.0) 0.5f else (m.mine / total).toFloat()
                ComparisonBarRow(m.format(m.mine), myFrac, Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFF7C3AED))))
                ComparisonBarRow(m.format(m.theirs), theirFrac, Brush.horizontalGradient(listOf(Color(0xFFF472B6), Color(0xFFEC4899))))
            }
        }
    }
}

@Composable
private fun ComparisonBarRow(value: String, fraction: Float, brush: Brush) {
    val dur = if (WTheme.reducedMotion) 0 else 600
    val animated by animateFloatAsState(max(0.06f, fraction.coerceIn(0f, 1f)), tween(dur), label = "vsBar")
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.weight(1f).height(12.dp).clip(RoundedCornerShape(50)).background(WTheme.border)) {
            Box(Modifier.fillMaxWidth(animated).fillMaxHeight().clip(RoundedCornerShape(50)).background(brush))
        }
        Text(
            value, fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.text,
            modifier = Modifier.width(56.dp), textAlign = TextAlign.End, maxLines = 1,
        )
    }
}

// ── Win confetti (VictoryOverlay ConfettiView / web effects/confetti.tsx) ──────

/** Confetti — 50 pieces, 12×12 rounded squares, 8-color palette, 2–4s linear fall, 720° spin. */
@Composable
fun VsConfetti() {
    val colors = listOf(
        Color(0xFFFFD700), Color(0xFFFF6B9D), Color(0xFFC084FC), Color(0xFF60A5FA),
        Color(0xFF34D399), Color(0xFFFBBF24), Color(0xFFF97316), Color(0xFFEC4899),
    )
    val pieces = remember {
        List(50) {
            VsConfettiPiece(
                xFrac = Random.nextFloat(),
                color = colors[Random.nextInt(colors.size)],
                delayMs = Random.nextInt(0, 500),
                durationMs = Random.nextInt(2000, 4000),
            )
        }
    }
    Box(Modifier.fillMaxSize()) { pieces.forEach { p -> VsConfettiRect(p) } }
}

private data class VsConfettiPiece(val xFrac: Float, val color: Color, val delayMs: Int, val durationMs: Int)

@Composable
private fun VsConfettiRect(p: VsConfettiPiece) {
    var go by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { go = true }
    val progress by animateFloatAsState(
        targetValue = if (go) 1f else 0f,
        animationSpec = tween(durationMillis = p.durationMs, delayMillis = p.delayMs, easing = LinearEasing),
        label = "vsConfetti",
    )
    val rot = progress * 720f
    val fade = (1f - progress).coerceIn(0f, 1f)
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val fall = maxHeight * progress
        Box(
            Modifier
                .padding(start = (p.xFrac * 360).dp)
                .offset(y = fall - 20.dp)
                .rotate(rot)
                .size(12.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(p.color.copy(alpha = fade)),
        )
    }
}
