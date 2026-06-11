package com.wordocious.app.ui.game

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.DefinitionService
import com.wordocious.app.data.GamePersistence
import com.wordocious.app.todayLocalSeed
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus

/**
 * Completed-daily "dropdown" shown above the leaderboard for the selected mode —
 * ports the web CompletedDailyBoard / CollapsibleCompletedCard. Reads the local
 * finished daily session (GamePersistence) for today's seed; collapsed by
 * default, expands to the board(s) + solution + definition + score breakdown.
 * Renders nothing if the user hasn't finished today's daily for this mode.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CompletedDailyBoard(modeId: String) {
    val mode = remember(modeId) { runCatching { GameMode.valueOf(modeId) }.getOrNull() } ?: return
    val seed = remember(modeId) { todayLocalSeed(modeId) }
    val state = remember(modeId) { GamePersistence.load(seed, mode) }
    if (state == null || state.status == GameStatus.PLAYING) return

    val won = state.status == GameStatus.WON
    val boards = state.boards
    val isMulti = boards.size > 1
    val boardsSolved = boards.count { it.status == GameStatus.WON }
    val totalBoards = boards.size
    val guesses = boards.maxOfOrNull { it.guesses.size } ?: 0 // MAX across boards (board 0 stops at its solve)
    val maxGuesses = boards.firstOrNull()?.maxGuesses ?: 6
    val timeSeconds = remember(modeId) { GamePersistence.loadElapsed(seed, mode) ?: 0 }
    val hints = boards.firstOrNull()?.hintEvaluations?.size ?: 0
    val hintLabel = formatHints(mode, hints)

    val summary = if (isMulti)
        "$boardsSolved/$totalBoards · ${guesses}g · ${fmt(timeSeconds)}"
    else
        "$guesses/$maxGuesses · ${fmt(timeSeconds)}${hintLabel?.let { " · $it" } ?: ""}"

    var expanded by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
    ) {
        // Top accent bar (green won / gray attempted)
        Box(
            Modifier.fillMaxWidth().height(4.dp).background(
                Brush.horizontalGradient(
                    if (won) listOf(Color(0xFF7C3AED), Color(0xFFA78BFA))
                    else listOf(Color(0xFF9CA3AF), Color(0xFFD1D5DB)),
                ),
            ),
        )
        // Header
        Row(
            Modifier.fillMaxWidth().clickableNoRipple { expanded = !expanded }.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(16.dp).clip(CircleShape).background(if (won) Color(0xFFF5F3FF) else Color(0xFFFEE2E2)), Alignment.Center) {
                Text(if (won) "✓" else "✗", fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626))
            }
            Spacer(Modifier.width(8.dp))
            Text(
                if (won) "COMPLETED TODAY" else "ATTEMPTED TODAY",
                fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp,
                color = if (won) Color(0xFF7C3AED) else WTheme.textMuted,
            )
            Spacer(Modifier.weight(1f))
            Text(summary, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Spacer(Modifier.width(6.dp))
            Icon(Icons.Filled.KeyboardArrowDown, null, tint = WTheme.textMuted, modifier = Modifier.size(16.dp).rotate(if (expanded) 180f else 0f))
        }
        // Collapsible content
        AnimatedVisibility(visible = expanded) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                if (isMulti) {
                    FlowRow(horizontalArrangement = Arrangement.Center, verticalArrangement = Arrangement.Center) {
                        boards.forEach { b ->
                            // Aspect ratio (cols/rows) gives the weight-based MiniBoardView a
                            // concrete height so its rows don't collapse to ~0.
                            Box(Modifier.padding(4.dp).width(if (totalBoards > 4) 64.dp else 96.dp)
                                .aspectRatio(b.solution.length.toFloat() / b.maxGuesses)) {
                                MiniBoardView(board = b)
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    StatsRow(listOf("$boardsSolved/$totalBoards" to "Boards", "$guesses" to "Guesses", fmt(timeSeconds) to "Time"))
                } else {
                    Box(Modifier.width(180.dp).aspectRatio(boards[0].solution.length.toFloat() / boards[0].maxGuesses)) {
                        MiniBoardView(board = boards[0])
                    }
                    Spacer(Modifier.height(12.dp))
                    val solution = boards[0].solution.uppercase()
                    Text(solution, fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = WTheme.text)
                    // Definition (Classic-style single-board modes only).
                    if (mode != GameMode.PROPERNOUNDLE) DefinitionBlock(solution)
                    Spacer(Modifier.height(12.dp))
                    StatsRow(listOf("$guesses/$maxGuesses" to "Guesses", fmt(timeSeconds) to "Time"))
                }
                Spacer(Modifier.height(12.dp))
                ScoreBreakdownCard(
                    mode = mode, won = won, guessCount = guesses, elapsedSeconds = timeSeconds,
                    boardsSolved = boardsSolved, totalBoards = totalBoards, hintsUsed = hints,
                )
            }
        }
    }
}

@Composable
private fun DefinitionBlock(solution: String) {
    var def by remember(solution) { mutableStateOf<DefinitionService.WordDefinition?>(null) }
    var loaded by remember(solution) { mutableStateOf(false) }
    LaunchedEffect(solution) { def = DefinitionService.fetch(solution); loaded = true }
    if (!loaded) return
    Spacer(Modifier.height(8.dp))
    Column(
        Modifier.widthIn(max = 320.dp).fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(WTheme.bg)
            .border(1.dp, WTheme.border, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        val d = def
        if (d != null && d.definition.isNotBlank()) {
            if (d.partOfSpeech.isNotBlank()) {
                Text(d.partOfSpeech.lowercase(), fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF7C3AED))
            }
            Text(d.definition, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = WTheme.textSecondary, modifier = Modifier.padding(top = 2.dp))
        } else {
            Text("No definition available for this word.", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = WTheme.textMuted)
        }
    }
}

@Composable
private fun StatsRow(stats: List<Pair<String, String>>) {
    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        stats.forEach { (value, label) ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(value, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp, color = WTheme.textMuted, textAlign = TextAlign.Center)
            }
        }
    }
}

private fun formatHints(mode: GameMode, hints: Int): String? {
    if (hints <= 0) return null
    if (mode != GameMode.DUEL_6 && mode != GameMode.DUEL_7 && mode != GameMode.PROPERNOUNDLE) return null
    return "$hints hint${if (hints > 1) "s" else ""}"
}

private fun fmt(s: Int): String = if (s < 60) "${s}s" else "${s / 60}m ${s % 60}s"
