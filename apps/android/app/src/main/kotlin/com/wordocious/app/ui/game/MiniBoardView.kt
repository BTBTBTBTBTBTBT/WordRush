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
 *   - FINISH_SPEC L: a game tray (accent wash) when PLAYING, the stronger tint + ring
 *     when active / zoomed, a purple wash when WON (purple ✓ badge top-right), slate when LOST
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
    // VS spectator (founder 2026-10-01, VS polish §2): an opponent's live rows
    // arrive as colors only (no letters). When set, these rows replace
    // board.guesses — same card, frame, tiles and flip-in as the solo board.
    stateRows: List<List<TileState>>? = null,
    /** False on a static recap (a completed board): no reveal / hop replays. */
    animateLastRow: Boolean = true,
    /** AT2: draw at least this many rows in all (prefills included), padding with empty rows — a recap's shared height. */
    minTotalRows: Int = 0,
) {
    val isWon = board.status == GameStatus.WON
    val isLost = board.status == GameStatus.LOST
    val isPlaying = board.status == GameStatus.PLAYING

    // FINISH_SPEC L: each mini board is its own game tray (the game's accent wash, line,
    // lip and gloss — never plain white); the active / zoomed board takes the stronger
    // tint + ring, a solved board the purple wash, a failed one the slate wash.
    val trayAccent = com.wordocious.app.ui.LocalGameTint.current ?: Color(0xFF7C3AED)
    val trayState = when {
        isWon -> TrayState.WON
        isLost -> TrayState.LOST
        active || isExpanded -> TrayState.ACTIVE
        else -> TrayState.PLAYING
    }

    val prefills = board.prefilledGuesses ?: emptyList()
    val guessCount = stateRows?.size ?: board.guesses.size
    // A color-only opponent can outrun the starting row budget (Gauntlet steal
    // guess); never clip a filled row.
    val rowCount = maxOf(board.maxGuesses, guessCount, minTotalRows - prefills.size)
    val lastSubmittedRow = if (guessCount > 0) guessCount - 1 else -1

    // Font, corner radius and border are derived per tile now (TileView measures
    // itself: letter = min(w,h)*0.5, corner = 0.14×, stroke = 0.09× clamped
    // 1–2dp — iOS parity). Fixed 10sp/18sp fonts, 4dp corners and 2dp strokes
    // could not survive OctoWord's 13 rows in a mini card on a 360dp phone —
    // the glyph was taller than the cell and the chrome ate the tile.
    val wordLen = board.solution.length
    // B3: the rejected letters clear right to left (a ghost while they go).
    val (shownGuess, clearOf) = rememberRejectClear(currentGuess, isInvalid, wordLen)
    val clearing = shownGuess != currentGuess

    // Outer box is NOT clipped so the ✓ badge can float above the card edge
    // (iOS SolvedBoardFrame offsets it -30% of its height). The old structure
    // put the badge INSIDE the clipped, padded card, where it sat directly on
    // top of the first row's last tile — Doug's screenshot showed the check
    // covering the letter D.
    Box(modifier = modifier) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .then(if (onClick != null) Modifier.clickableNoRippleBox(onClick) else Modifier)
                .gameTray(
                    trayAccent, trayState, corner = 12.dp,
                    padding = androidx.compose.foundation.layout.PaddingValues(4.dp), shadow = !isExpanded,
                ),
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
            for (rowIdx in 0 until rowCount) {
                val isPastGuess = rowIdx < guessCount
                val isCurrentRow = isPlaying && !isPastGuess && rowIdx == guessCount
                val colorRow = if (isPastGuess) stateRows?.getOrNull(rowIdx) else null
                val guess = when {
                    stateRows != null -> ""
                    isPastGuess -> board.guesses[rowIdx]
                    isCurrentRow -> shownGuess
                    else -> ""
                }
                // Hint rows (Six/Seven) carry a stored evaluation keyed by row
                // index — use it (letter + state travel together) so a hint tile
                // never renders its letter in the wrong slot or the wrong color.
                // Re-evaluating the space-padded hint string dropped the hint
                // styling and could misplace the letter.
                val hintEval = if (isPastGuess && stateRows == null) board.hintEvaluations?.get(rowIdx.toString()) else null
                val eval = hintEval ?: if (isPastGuess && stateRows == null) evaluateGuess(board.solution, board.guesses[rowIdx]) else null
                val isLastSubmitted = animateLastRow && isPastGuess && rowIdx == lastSubmittedRow && hintEval == null

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
                        val state = when {
                        masked -> TileState.EMPTY
                        colorRow != null -> colorRow.getOrNull(col) ?: TileState.EMPTY
                        else -> eval?.tiles?.getOrNull(col)?.state ?: TileState.EMPTY
                    }
                        // B3: 720 ms turns, 300 ms apart (the same reveal as the big board).
                        val flipDelay = if (isLastSubmitted && !locked) col * TileMotion.FLIP_STAGGER_MS else null
                        TileView(
                            letter = letter,
                            state = state,
                            flipDelay = flipDelay,
                            isInvalid = (isInvalid || clearing) && isCurrentRow && letter.isNotEmpty(),
                            square = false,      // the fitted grid sizes the cells
                            masked = masked,
                            mini = true,
                            modifier = Modifier.weight(1f),
                            // B3: a board solved by this guess hops its row once it lands.
                            celebrate = if (isLastSubmitted && isWon && stateRows == null) TileCelebration.HOP else null,
                            celebrateDelay = TileMotion.revealMs(wordLen) + col * TileMotion.HOP_STAGGER_MS,
                            clearProgress = if (isCurrentRow) clearOf(col) else 0f,
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
                    .size(18.dp),
                contentAlignment = Alignment.Center,
            ) {
                // AL addendum 2: the 3D check badge (its own disc), not a ✓ glyph on a purple dot.
                com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.BADGE_CHECK, 18.dp)
            }
        }
    }
}

// Helper — delegates to the shared util (com.wordocious.app.ui package)
@Composable
private fun Modifier.clickableNoRippleBox(onClick: () -> Unit): Modifier =
    clickableNoRipple(onClick)
