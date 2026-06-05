package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import com.wordocious.app.ui.clickableNoRipple
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess

/**
 * A compact board card used inside multi-board layouts (QuadWord/OctoWord/etc).
 * Matches the web's `MiniBoard` component precisely:
 *   - border-gray-200/white when PLAYING
 *   - border-green-400/bg-green-50 when WON, green ✓ badge top-right
 *   - border-red-400/bg-red-50 when LOST
 *   - prefill rows at 75% opacity above the player rows
 *   - current guess shown in the next available row
 *   - tile flip animation on last submitted row (stagger 80ms/tile)
 */
@Composable
fun MiniBoardView(
    board: BoardState,
    currentGuess: String = "",
    isExpanded: Boolean = false,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val isWon = board.status == GameStatus.WON
    val isLost = board.status == GameStatus.LOST
    val isPlaying = board.status == GameStatus.PLAYING

    val borderColor = when {
        isWon -> Color(0xFF4ADE80)   // green-400
        isLost -> Color(0xFFF87171)  // red-400
        else -> Color(0xFFE5E7EB)    // gray-200
    }
    val bgColor = when {
        isWon -> Color(0xFFF0FDF4)   // green-50
        isLost -> Color(0xFFFEF2F2)  // red-50
        else -> Color.White
    }

    val prefills = board.prefilledGuesses ?: emptyList()
    val totalRows = prefills.size + board.maxGuesses
    val lastSubmittedRow = if (board.guesses.isNotEmpty()) board.guesses.size - 1 else -1

    // Tile font size: larger when expanded (web `isExpanded ? text-base sm:text-lg : text-[10px]`)
    val fontSize = if (isExpanded) 18f else 10f
    val wordLen = board.solution.length

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bgColor)
            .border(2.dp, borderColor, RoundedCornerShape(8.dp))
            .then(if (onClick != null) Modifier.clickableNoRippleBox(onClick) else Modifier)
            .padding(4.dp),
    ) {
        // Grid of rows filling height equally (like web `grid-template-rows: repeat(N, 1fr)`)
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            // Prefill rows (75% opacity)
            prefills.forEach { prefill ->
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth().alpha(0.75f),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    prefill.evaluation.tiles.forEach { tile ->
                        TileView(
                            letter = tile.letter,
                            state = tile.state,
                            fontSize = fontSize,
                            cornerRadius = 3.dp,
                            square = isExpanded,  // fill (non-square) in the grid; square when zoomed
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            // Player guess rows
            for (rowIdx in 0 until board.maxGuesses) {
                val isPastGuess = rowIdx < board.guesses.size
                val isCurrentRow = isPlaying && !isPastGuess && rowIdx == board.guesses.size
                val guess = when {
                    isPastGuess -> board.guesses[rowIdx]
                    isCurrentRow -> currentGuess
                    else -> ""
                }
                val eval = if (isPastGuess) evaluateGuess(board.solution, board.guesses[rowIdx]) else null
                val isLastSubmitted = isPastGuess && rowIdx == lastSubmittedRow

                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    for (col in 0 until wordLen) {
                        val letter = guess.getOrNull(col)?.toString() ?: ""
                        val state = eval?.tiles?.getOrNull(col)?.state ?: TileState.EMPTY
                        val flipDelay = if (isLastSubmitted) col * 80 else null
                        TileView(
                            letter = letter,
                            state = state,
                            flipDelay = flipDelay,
                            fontSize = fontSize,
                            cornerRadius = 3.dp,
                            square = isExpanded,  // fill (non-square) in the grid; square when zoomed
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        // Won: green ✓ badge top-right (web: absolute -top-1.5 -right-1.5)
        if (isWon) {
            Box(
                modifier = Modifier
                    .size(18.dp)
                    .align(Alignment.TopEnd)
                    .clip(RoundedCornerShape(9.dp))
                    .background(Color(0xFF22C55E)),
                contentAlignment = Alignment.Center,
            ) {
                Text("✓", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

// Helper — delegates to the shared util (com.wordocious.app.ui package)
@Composable
private fun Modifier.clickableNoRippleBox(onClick: () -> Unit): Modifier =
    clickableNoRipple(onClick)
