package com.wordocious.app.ui.game

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.core.BoardState
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess

/**
 * Multi-board layout, ported 1:1 from the web `MultiBoard` component:
 * - 4 boards (QuadWord / Succession / Deliverance): 2-column grid
 * - 8 boards (OctoWord): 4-column grid; tap any board → fullscreen zoom overlay
 * - Sequence (Succession): boards are displayed in order; boards before the
 *   current one are solved/lost and don't receive the current guess; boards
 *   after the current one are locked (invisible/greyed out, per web behavior)
 *
 * Matches web `auto-rows-fr` height-fill: boards in a row share height equally.
 */
@Composable
fun MultiBoardLayout(
    boards: List<BoardState>,
    currentGuess: String,
    currentBoardIndex: Int,
    isSequential: Boolean,
    isInvalid: Boolean = false,
    shakeKey: Int = 0,
    modifier: Modifier = Modifier,
) {
    val isOctordle = boards.size > 4
    val cols = if (isOctordle) 4 else 2
    val rows = (boards.size + cols - 1) / cols

    // OctoWord tap-to-zoom state
    var expandedIndex by remember { mutableStateOf<Int?>(null) }

    BoxWithConstraints(modifier = modifier) {
        val containerW = maxWidth
        val containerH = maxHeight

        // Grid of mini boards filling width and height equally.
        Column(modifier = Modifier.fillMaxSize()) {
            for (rowIdx in 0 until rows) {
                Row(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    for (colIdx in 0 until cols) {
                        val boardIdx = rowIdx * cols + colIdx
                        if (boardIdx >= boards.size) {
                            Spacer(Modifier.weight(1f))
                            continue
                        }
                        val board = boards[boardIdx]
                        val isInvisible = expandedIndex == boardIdx
                        // Succession: boards after the active index are LOCKED (dimmed + masked,
                        // NOT hidden — spec hot-spot #8). The active board is highlighted.
                        val isLocked = isSequential && boardIdx > currentBoardIndex
                        val isActive = isSequential && boardIdx == currentBoardIndex && board.status == GameStatus.PLAYING
                        val receivesGuess = when {
                            isSequential && boardIdx == currentBoardIndex && board.status == GameStatus.PLAYING -> true
                            !isSequential && board.status == GameStatus.PLAYING -> true
                            else -> false
                        }
                        val liveGuess = if (receivesGuess) currentGuess else ""

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .padding(3.dp)
                                .then(
                                    when {
                                        isInvisible -> Modifier.alpha(0f)
                                        isLocked -> Modifier.alpha(0.6f) // dim locked boards
                                        else -> Modifier
                                    },
                                ),
                        ) {
                            MiniBoardView(
                                board = board,
                                currentGuess = liveGuess,
                                locked = isLocked,
                                active = isActive,
                                isInvalid = isInvalid && receivesGuess,
                                shakeKey = if (receivesGuess) shakeKey else 0,
                                modifier = Modifier.fillMaxSize(),
                                onClick = if (isOctordle && !isInvisible && !isLocked) {
                                    { expandedIndex = boardIdx }
                                } else null,
                            )
                        }
                    }
                }
            }
        }

        // OctoWord expanded overlay (web: fixed rect at center, dim backdrop,
        // animate-fade-in-scale). Web caps: w = min(0.9·availW, 384px),
        // h = min(0.95·availH, w·2.2).
        if (expandedIndex != null) {
            val targetW = minOf(containerW * 0.9f, 384.dp)
            val targetH = minOf(containerH * 0.95f, targetW * 2.2f)
            var appeared by remember(expandedIndex) { mutableStateOf(false) }
            androidx.compose.runtime.LaunchedEffect(expandedIndex) { appeared = true }
            val zoomT by animateFloatAsState(
                targetValue = if (appeared) 1f else 0f,
                animationSpec = tween(if (com.wordocious.app.ui.theme.WTheme.reducedMotion) 0 else 200),
                label = "octoZoom",
            )

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.6f * zoomT))
                    .clickableNoRipple { expandedIndex = null },
            )

            Box(
                modifier = Modifier
                    .size(targetW, targetH)
                    .offset(
                        x = (containerW - targetW) / 2,
                        y = (containerH - targetH) / 2,
                    )
                    .graphicsLayer {
                        alpha = zoomT
                        scaleX = 0.95f + 0.05f * zoomT
                        scaleY = 0.95f + 0.05f * zoomT
                    }
                    .background(Color.White, RoundedCornerShape(12.dp))
                    .clickableNoRipple { expandedIndex = null }
                    .padding(6.dp),
            ) {
                MiniBoardView(
                    board = boards[expandedIndex!!],
                    currentGuess = if (boards[expandedIndex!!].status == GameStatus.PLAYING) currentGuess else "",
                    isExpanded = true,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }
}

/**
 * Compute combined keyboard letter states from all PLAYING boards —
 * matches the web `computeActiveLetterStates` (multi-board.tsx skips
 * non-PLAYING boards). Best state wins: CORRECT > PRESENT > ABSENT > EMPTY.
 */
fun computeCombinedLetterStates(boards: List<BoardState>): Map<String, TileState> {
    val states = mutableMapOf<String, TileState>()
    for (board in boards) {
        if (board.status != GameStatus.PLAYING) continue
        val boardGuesses = buildList {
            board.prefilledGuesses?.forEach { addAll(it.evaluation.tiles.map { t -> t.letter to t.state }) }
            board.guesses.forEach { guess ->
                val eval = evaluateGuess(board.solution, guess)
                eval.tiles.forEach { t -> add(t.letter to t.state) }
            }
        }
        for ((letter, state) in boardGuesses) {
            val key = letter.uppercase()
            val current = states[key] ?: TileState.EMPTY
            states[key] = bestLetterState(current, state)
        }
    }
    return states
}

private fun bestLetterState(a: TileState, b: TileState): TileState {
    val priority = mapOf(TileState.CORRECT to 3, TileState.PRESENT to 2, TileState.ABSENT to 1, TileState.EMPTY to 0, TileState.HINT_USED to 2)
    return if ((priority[b] ?: 0) > (priority[a] ?: 0)) b else a
}

/**
 * Per-board keyboard letter states for the QUADRANT keyboard (Quad/Octo/Deliverance).
 * Mirrors web `computePerBoardLetterStates`: solved/lost boards return EMPTY maps
 * so their quadrant sub-cell goes dark.
 */
fun computePerBoardLetterStates(boards: List<BoardState>): List<Map<String, TileState>> =
    boards.map { board ->
        if (board.status != GameStatus.PLAYING) return@map emptyMap()
        val states = mutableMapOf<String, TileState>()
        board.prefilledGuesses?.forEach { pf ->
            pf.evaluation.tiles.forEach { t ->
                val k = t.letter.uppercase()
                states[k] = bestLetterState(states[k] ?: TileState.EMPTY, t.state)
            }
        }
        board.guesses.forEach { g ->
            evaluateGuess(board.solution, g).tiles.forEach { t ->
                val k = t.letter.uppercase()
                states[k] = bestLetterState(states[k] ?: TileState.EMPTY, t.state)
            }
        }
        states
    }
