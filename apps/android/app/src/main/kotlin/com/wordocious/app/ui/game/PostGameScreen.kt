package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import kotlin.math.abs

/**
 * Post-game screen — ported from the web post-game-summary.tsx + score-breakdown.tsx.
 * Source of truth: the web. Shown immediately when game status transitions to WON/LOST.
 *
 * Layout (matching web):
 *   - Gradient header with mode title + WON/LOST status
 *   - Solution reveal (WON: "You solved it!", LOST: "The answer was…")
 *   - Score breakdown card (base + guess/time bonuses)
 *   - Home button + Share button
 *   - (Definition panel pending the networking layer)
 */
@Composable
fun PostGameScreen(
    state: GameState,
    mode: GameMode,
    seed: String,
    onBack: () -> Unit,
) {
    val won = state.status == GameStatus.WON
    val board = state.boards[0]
    val solution = board.solution.uppercase()

    // Elapsed time — not tracked yet in the VM; use 0 until timer lands
    val guessCount = board.guesses.size
    val boardsSolved = state.boards.count { it.status == GameStatus.WON }
    val totalBoards = state.boards.size

    Column(
        modifier = Modifier.fillMaxSize().background(WTheme.bg),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // ── Gradient header ──────────────────────────────────────
        val headerGradient = if (won)
            Brush.linearGradient(listOf(Color(0xFF22C55E), Color(0xFF16A34A)))
        else
            Brush.linearGradient(listOf(Color(0xFFEF4444), Color(0xFFDC2626)))

        Box(
            modifier = Modifier.fillMaxWidth()
                .background(headerGradient)
                .padding(vertical = 20.dp, horizontal = 16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    if (won) "🎉 Solved!" else "Better luck tomorrow",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                    textAlign = TextAlign.Center,
                )
                Text(
                    modeSubtitle(mode, state),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.85f),
                    textAlign = TextAlign.Center,
                )
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // ── Solution card ─────────────────────────────────────
            Column(
                modifier = Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    if (won) "You solved it!" else "The answer was",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold,
                    color = WTheme.textMuted, letterSpacing = 0.5.sp,
                )
                Text(
                    solution,
                    fontSize = 28.sp, fontWeight = FontWeight.Black,
                    color = if (won) WTheme.winText else WTheme.lossText,
                )
                if (mode != GameMode.DUEL && mode != GameMode.DUEL_6 && mode != GameMode.DUEL_7) {
                    Text(
                        "$boardsSolved / $totalBoards boards solved",
                        fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    )
                }
            }

            // ── Score breakdown ───────────────────────────────────
            ScoreBreakdownCard(
                guessCount = guessCount,
                won = won,
                mode = mode,
                boardsSolved = boardsSolved,
                totalBoards = totalBoards,
            )

            // ── Stats row ─────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                StatChip("Guesses", "$guessCount / ${board.maxGuesses}", Modifier.weight(1f))
                if (totalBoards > 1) StatChip("Boards", "$boardsSolved / $totalBoards", Modifier.weight(1f))
            }

            // ── Action buttons ────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(
                    onClick = onBack,
                    modifier = Modifier.weight(1f).height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = WTheme.surfaceAlt),
                ) {
                    Icon(Icons.Filled.Home, null, tint = WTheme.text)
                    Text(" Home", color = WTheme.text, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = { /* Share — wired with Android share sheet in next pass */ },
                    modifier = Modifier.weight(1f).height(48.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (won) WTheme.winText else WTheme.lossText,
                    ),
                ) {
                    Icon(Icons.Filled.Share, null, tint = Color.White)
                    Text(" Share", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }

            // Definition placeholder — wired with networking layer
            Box(
                modifier = Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
                    .padding(12.dp),
            ) {
                Text(
                    "Definition for ${solution} loads with the networking layer.",
                    fontSize = 12.sp, color = WTheme.textMuted,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                )
            }
        }
    }
}

@Composable
private fun StatChip(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(WTheme.surface)
            .border(1.dp, WTheme.border, RoundedCornerShape(10.dp))
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

/**
 * Score breakdown card — ported from web score-breakdown.tsx.
 * Simplified formula matching the web's `computeScoreBreakdown`:
 * base 1000 (win) or 0, + time bonus (deferred), + completion bonus for multi-board.
 */
@Composable
private fun ScoreBreakdownCard(
    guessCount: Int,
    won: Boolean,
    mode: GameMode,
    boardsSolved: Int,
    totalBoards: Int,
) {
    val maxGuesses = when (mode) {
        GameMode.DUEL, GameMode.RESCUE, GameMode.PROPERNOUNDLE -> 6
        GameMode.DUEL_6 -> 7
        GameMode.DUEL_7 -> 8
        GameMode.QUORDLE, GameMode.SEQUENCE -> 9
        GameMode.OCTORDLE -> 13
        GameMode.GAUNTLET -> 6
        GameMode.TOURNAMENT -> 6
        else -> 6
    }
    val basePoints = if (won) 1000 else 0
    val guessesLeft = if (won) maxOf(0, maxGuesses - guessCount) else 0
    val guessBonus = guessesLeft * 50
    val completionBonus = if (totalBoards > 1) (boardsSolved.toFloat() / totalBoards) * 200 else 0f
    val total = basePoints + guessBonus + completionBonus.toInt()

    Column(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "SCORE BREAKDOWN",
                fontSize = 10.sp, fontWeight = FontWeight.Black,
                color = WTheme.textMuted, letterSpacing = 1.sp,
            )
            Text(
                "$total pts",
                fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text,
            )
        }
        Spacer(Modifier.height(6.dp))
        ScoreRow("Win bonus", if (won) "" else "did not finish", basePoints)
        if (won && guessBonus > 0) ScoreRow("Guess bonus", "$guessesLeft unused × 50", guessBonus)
        if (totalBoards > 1) ScoreRow(
            "Completion", "$boardsSolved/$totalBoards boards",
            completionBonus.toInt(),
        )
    }
}

@Composable
private fun ScoreRow(label: String, detail: String, value: Int) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
            if (detail.isNotEmpty()) Text(detail, fontSize = 10.sp, color = WTheme.textMuted)
        }
        val sign = if (value > 0) "+" else if (value < 0) "−" else ""
        Text(
            "$sign${abs(value)}",
            fontSize = 12.sp, fontWeight = FontWeight.Black,
            color = if (value > 0) WTheme.text else if (value < 0) WTheme.lossText else WTheme.textMuted,
        )
    }
}

private fun modeSubtitle(mode: GameMode, state: GameState): String {
    val boards = state.boards
    return when (mode) {
        GameMode.DUEL, GameMode.DUEL_6, GameMode.DUEL_7, GameMode.PROPERNOUNDLE, GameMode.TOURNAMENT ->
            "in ${boards[0].guesses.size} ${if (boards[0].guesses.size == 1) "guess" else "guesses"}"
        GameMode.QUORDLE -> "${boards.count { it.status == GameStatus.WON }}/4 boards"
        GameMode.OCTORDLE -> "${boards.count { it.status == GameStatus.WON }}/8 boards"
        GameMode.SEQUENCE -> "Succession · ${boards.count { it.status == GameStatus.WON }}/4 boards"
        GameMode.RESCUE -> "Deliverance · ${boards.count { it.status == GameStatus.WON }}/4 boards"
        GameMode.GAUNTLET -> "${(state.gauntlet?.currentStage ?: 0) + 1} / ${state.gauntlet?.totalStages ?: 5} stages"
        else -> ""
    }
}
