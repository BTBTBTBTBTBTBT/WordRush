package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.window.Dialog
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameStatus
import com.wordocious.core.GauntletProgress
import com.wordocious.core.GauntletStageConfig
import com.wordocious.core.GauntletStageResult
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import kotlinx.coroutines.delay

/**
 * Gauntlet stage-transition overlay — ports web gauntlet/stage-transition.tsx:
 * a 2.5s full-screen interstitial after clearing a stage (tap to skip) with the
 * green check, "STAGE COMPLETE" + cleared name, and "NEXT UP" + gradient name
 * + the next stage's board/guess detail line.
 */
@Composable
fun StageTransitionOverlay(
    completed: GauntletStageConfig,
    next: GauntletStageConfig?,
    onComplete: () -> Unit,
) {
    LaunchedEffect(completed.stageIndex) {
        delay(2500)
        onComplete()
    }
    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.8f)).clickableNoRipple(onComplete),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(24.dp)) {
            Box(
                Modifier.size(80.dp).clip(CircleShape)
                    .background(Color(0xFF8B5CF6).copy(alpha = 0.3f))
                    .border(4.dp, Color(0xFFA78BFA), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Check, null, tint = Color(0xFFC4B5FD), modifier = Modifier.size(40.dp))
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "STAGE COMPLETE",
                    color = Color(0xFFA78BFA), fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp,
                )
                Text(completed.name, color = Color.White.copy(alpha = 0.6f), fontSize = 17.sp, fontWeight = FontWeight.Bold)
            }
            if (next != null) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Filled.Bolt, null, tint = Color(0xFFFACC15), modifier = Modifier.size(16.dp))
                        Text("NEXT UP", color = Color(0xFFFACC15), fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                        Icon(Icons.Filled.Bolt, null, tint = Color(0xFFFACC15), modifier = Modifier.size(16.dp))
                    }
                    Text(
                        next.name,
                        fontSize = 34.sp, fontWeight = FontWeight.Black,
                        style = TextStyle(
                            brush = Brush.horizontalGradient(
                                listOf(Color(0xFFFBBF24), Color(0xFFEC4899), Color(0xFFA78BFA)),
                            ),
                        ),
                    )
                    Text(
                        buildString {
                            append("${next.boardCount} board${if (next.boardCount > 1) "s" else ""} · ${next.maxGuesses} guesses")
                            if (next.sequential) append(" · sequential")
                            if (next.hasPrefill) append(" · pre-filled clues")
                        },
                        color = Color.White.copy(alpha = 0.4f), fontSize = 13.sp, fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

/**
 * Gauntlet stage list on the results screen — ports the web gauntlet-results
 * stage rows: cleared = green tint + ✓ + guesses, failed = red tint + ✗,
 * unreached = gray. Rows with a board snapshot tap through to the review.
 */
@Composable
fun GauntletStagesCard(g: GauntletProgress, won: Boolean, onReview: (Int) -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("STAGES", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp)
        g.stages.forEachIndexed { i, stage ->
            val result = g.stageResults.firstOrNull { it.stageIndex == i }
            val cleared = result?.status == GameStatus.WON
            val failed = result?.status == GameStatus.LOST
            val canReview = !result?.boardsSnapshot.isNullOrEmpty()
            Row(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        when {
                            cleared -> Color(0xFF8B5CF6).copy(alpha = 0.1f)
                            failed -> Color(0xFFEF4444).copy(alpha = 0.1f)
                            else -> WTheme.surfaceAlt
                        },
                    )
                    .then(if (canReview) Modifier.clickableNoRipple { onReview(i) } else Modifier)
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stage.name,
                    fontSize = 12.sp, fontWeight = FontWeight.Black,
                    color = WTheme.text, modifier = Modifier.weight(1f),
                )
                if (result != null) {
                    Text(
                        "${result.guesses} guess${if (result.guesses != 1) "es" else ""}",
                        fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    )
                    Spacer(Modifier.size(8.dp))
                }
                Text(
                    if (cleared) "✓" else if (failed) "✗" else "·",
                    fontSize = 14.sp, fontWeight = FontWeight.Black,
                    color = when {
                        cleared -> Color(0xFF6D28D9)
                        failed -> Color(0xFFDC2626)
                        else -> WTheme.textMuted
                    },
                )
            }
        }
    }
}

/**
 * Stage review modal — ports web StageReviewModal: stage header, the revealed
 * solutions as win/loss pills, and the stage's final boards rendered from the
 * reducer's boardsSnapshot (prefills + guesses + padded empty rows).
 */
@Composable
fun StageReviewModal(stage: GauntletStageConfig, result: GauntletStageResult, onClose: () -> Unit) {
    val boards = result.boardsSnapshot ?: return
    val won = result.status == GameStatus.WON
    val cols = if (boards.size == 1) 1 else if (boards.size <= 4) 2 else 4

    Dialog(onDismissRequest = onClose) {
        Column(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Color.White)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Filled.Visibility, null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(14.dp))
                Text(
                    "STAGE ${stage.stageIndex + 1}",
                    fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF9CA3AF), letterSpacing = 1.sp,
                )
                Spacer(Modifier.weight(1f))
                Icon(
                    Icons.Filled.Close, "Close", tint = Color(0xFF9CA3AF),
                    modifier = Modifier.size(18.dp).clickableNoRipple(onClose),
                )
            }
            Text(
                stage.name,
                fontSize = 22.sp, fontWeight = FontWeight.Black,
                color = if (won) Color(0xFF7C3AED) else Color(0xFFF87171),
            )
            Text(
                "${if (won) "Cleared" else "Failed"} · ${result.guesses} guess${if (result.guesses != 1) "es" else ""} · ${fmtMs(result.timeMs)}",
                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6B7280),
            )
            // Solutions pills
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFF9FAFB))
                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    if (boards.size == 1) "ANSWER" else "ANSWERS",
                    fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF9CA3AF), letterSpacing = 1.sp,
                )
                boards.chunked(cols).forEach { rowBoards ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        rowBoards.forEach { b ->
                            val boardWon = b.status == GameStatus.WON
                            val boardFailed = !won && !boardWon
                            Text(
                                b.solution.uppercase(),
                                fontSize = 11.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
                                color = if (boardWon) Color(0xFF15803D) else if (boardFailed) Color(0xFFB91C1C) else Color(0xFF374151),
                                modifier = Modifier.weight(1f)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(
                                        if (boardWon) Color(0xFFF5F3FF)
                                        else if (boardFailed) Color(0xFFFEE2E2)
                                        else Color(0xFFE5E7EB),
                                    )
                                    .padding(vertical = 3.dp),
                            )
                        }
                        repeat(cols - rowBoards.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
            // Final boards
            boards.chunked(cols).forEach { rowBoards ->
                Row(Modifier.fillMaxWidth().height(if (cols == 1) 280.dp else 170.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    rowBoards.forEach { b -> StageReviewBoard(b, won, Modifier.weight(1f).fillMaxHeight()) }
                    repeat(cols - rowBoards.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun StageReviewBoard(board: BoardState, stageWon: Boolean, modifier: Modifier = Modifier) {
    val won = board.status == GameStatus.WON
    val lost = !stageWon && !won
    val prefills = board.prefilledGuesses ?: emptyList()
    val totalRows = prefills.size + board.maxGuesses

    Column(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (won) Color(0xFFF5F3FF) else if (lost) Color(0xFFFEF2F2) else Color.White)
            .border(
                2.dp,
                if (won) Color(0xFFA78BFA) else if (lost) Color(0xFFF87171) else Color(0xFFE5E7EB),
                RoundedCornerShape(10.dp),
            )
            .padding(4.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        val rows: List<List<Pair<String, TileState>>> = buildList {
            prefills.forEach { p -> add(p.evaluation.tiles.map { it.letter to it.state }) }
            board.guesses.forEach { g ->
                add(evaluateGuess(board.solution, g).tiles.map { it.letter to it.state })
            }
            while (size < totalRows) add(List(board.solution.length) { "" to TileState.EMPTY })
        }
        rows.forEach { tiles ->
            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                tiles.forEach { (letter, st) ->
                    TileView(
                        letter = letter, state = st, fontSize = 10f,
                        cornerRadius = 4.dp, square = false, mini = true,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

private fun fmtMs(ms: Int): String {
    val secs = ms / 1000
    return "%d:%02d".format(secs / 60, secs % 60)
}
