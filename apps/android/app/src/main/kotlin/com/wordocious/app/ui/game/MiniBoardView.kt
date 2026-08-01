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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material3.Icon
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
    // Sequence (hot-spot #8): locked = future board → committed rows masked as •;
    // active = current board → yellow border.
    locked: Boolean = false,
    active: Boolean = false,
    // Rejected-guess feedback on the current input row (red tiles + shake).
    isInvalid: Boolean = false,
    shakeKey: Int = 0,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val isWon = board.status == GameStatus.WON
    val isLost = board.status == GameStatus.LOST
    val isPlaying = board.status == GameStatus.PLAYING

    val borderColor = when {
        active -> Color(0xFFFACC15)  // active board yellow border (spec)
        isWon -> Color(0xFFA78BFA)   // green-400
        isLost -> Color(0xFFF87171)  // red-400
        else -> Color(0xFFE5E7EB)    // gray-200
    }
    val bgColor = when {
        isWon -> Color(0xFFF5F3FF)   // green-50
        isLost -> Color(0xFFFEF2F2)  // red-50
        // No locked tint: iOS conveys locked purely by the 0.6 dim that
        // MultiBoardLayout applies. A gray-50 card UNDER that dim read as a
        // second, muddier state that iOS never shows.
        else -> Color.White
    }

    val prefills = board.prefilledGuesses ?: emptyList()
    val totalRows = prefills.size + board.maxGuesses
    val lastSubmittedRow = if (board.guesses.isNotEmpty()) board.guesses.size - 1 else -1

    // Font is derived per tile now (TileView: min(w,h) * 0.5, iOS parity).
    // A fixed 10sp/18sp could not survive OctoWord's 13 rows in a mini card —
    // the glyph was taller than the cell and every letter rendered clipped.
    val fontSize: Float? = null
    val wordLen = board.solution.length

    // Outer box is NOT clipped so the ✓ badge can float above the card edge
    // (iOS SolvedBoardFrame offsets it -30% of its height). The old structure
    // put the badge INSIDE the clipped, padded card, where it sat directly on
    // top of the first row's last tile — Doug's screenshot showed the check
    // covering the letter D.
    Box(modifier = modifier) {
        Box(
            modifier = Modifier
                .fillMaxSize()
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
                            cornerRadius = 4.dp, // web mini `rounded` = 4px
                            // NEVER square here: aspectRatio(1f) overflows the
                            // weight-sized row whenever cellW > rowH (OctoWord
                            // zoom clipped every letter). The expanded card's
                            // HEIGHT is sized for square cells instead.
                            square = false,
                            mini = true,
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
                // Hint rows (Six/Seven) carry a stored evaluation keyed by row
                // index — use it (letter + state travel together) so a hint tile
                // never renders its letter in the wrong slot or the wrong color.
                // Re-evaluating the space-padded hint string dropped the hint
                // styling and could misplace the letter.
                val hintEval = if (isPastGuess) board.hintEvaluations?.get(rowIdx.toString()) else null
                val eval = hintEval ?: if (isPastGuess) evaluateGuess(board.solution, board.guesses[rowIdx]) else null
                val isLastSubmitted = isPastGuess && rowIdx == lastSubmittedRow && hintEval == null

                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth()
                        .then(if (isCurrentRow) Modifier.shakeOnReject(shakeKey) else Modifier),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    for (col in 0 until wordLen) {
                        // Locked (future Sequence board): mask committed letters as •
                        // on gray-100/gray-300 tiles (web sequence-game masked rows).
                        val masked = locked && isPastGuess
                        val letter = when {
                            masked -> "•"
                            // Hint row: letter from the evaluation tile so it lands
                            // in the revealed letter's real slot regardless of how
                            // the guess string was stored.
                            hintEval != null -> hintEval.tiles.getOrNull(col)?.letter?.takeIf { it.isNotBlank() } ?: ""
                            else -> guess.getOrNull(col)?.toString() ?: ""
                        }
                        val state = if (masked) TileState.EMPTY else (eval?.tiles?.getOrNull(col)?.state ?: TileState.EMPTY)
                        val flipDelay = if (isLastSubmitted && !locked) col * 80 else null
                        TileView(
                            letter = letter,
                            state = state,
                            flipDelay = flipDelay,
                            isInvalid = isInvalid && isCurrentRow && letter.isNotEmpty(),
                            fontSize = fontSize,
                            cornerRadius = 4.dp, // web mini `rounded` = 4px
                            square = false,      // see prefill note — card height makes cells square
                            masked = masked,
                            mini = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

            // NO lock-icon overlay. Web draws one; iOS does not (BoardView.swift:152
            // dims to 0.6 and masks committed rows as bullets, nothing more), and a
            // 32dp padlock stamped over a grid of bullets reads as clutter on a
            // phone — the tester's word was "horrendous". Android follows iOS here.
        }

        // Won: ✓ badge on the card FRAME, not its content — flush to the right
        // edge, floated up 30% of its height (iOS SolvedBoardFrame offset
        // x:0, y:-badge*0.3) so it rides the border instead of a letter tile.
        if (isWon) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(y = (-5).dp)
                    .size(18.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(Color(0xFF8B5CF6)),
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
