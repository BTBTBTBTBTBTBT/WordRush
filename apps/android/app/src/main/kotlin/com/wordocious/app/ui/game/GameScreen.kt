package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wordocious.app.GameViewModel
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess

/**
 * Full game screen — audit-then-match of the web game UI (apps/web/app/practice/page.tsx
 * and the shared Board / MultiBoard components). Source of truth: the web.
 *
 * Single-board modes (DUEL / DUEL_6 / DUEL_7 / PROPERNOUNDLE / TOURNAMENT):
 *   - Centered board, aspect-ratio matched to wordLen×maxGuesses
 *   - Tile flip on the last submitted row (stagger 150ms/tile — web Board)
 *
 * Multi-board modes (QUORDLE / OCTORDLE / SEQUENCE / RESCUE):
 *   - MultiBoardLayout: 2-col grid (4 boards) or 4-col grid (8 boards, OctoWord)
 *   - OctoWord boards: tap to zoom overlay (web MultiBoard behavior)
 *   - Succession/SEQUENCE: sequential — boards after current are locked/hidden
 *
 * Keyboard: letter states combined across all playing boards.
 *
 * Post-game: the post-game screens (web post-game-summary.tsx) are a separate
 * screen pending the results-screen pass.
 */

private class GameVMFactory(val seed: String, val mode: GameMode) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = GameViewModel(seed, mode) as T
}

@Composable
fun GameScreen(mode: GameMode, title: String, seed: String, onBack: () -> Unit) {
    val vm: GameViewModel = viewModel(
        key = "game-$mode-$seed",
        factory = GameVMFactory(seed, mode),
    )
    val state by vm.state.collectAsState()
    val input by vm.currentInput.collectAsState()

    val multiBoard = state.boards.size > 1
    val isSequential = mode == GameMode.SEQUENCE
    val letterStates = computeCombinedLetterStates(state.boards)
    val isApplyToAll = multiBoard && !isSequential

    Column(
        modifier = Modifier.fillMaxSize().background(WTheme.bg).padding(horizontal = 8.dp),
    ) {
        // Header — mode title + back
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("‹", color = WTheme.primary, fontSize = 22.sp, fontWeight = FontWeight.Black,
                modifier = Modifier.clickableNoRipple(onBack).padding(end = 8.dp))
            Text(title, color = WTheme.text, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            // Status pill
            val statusText = when (state.status) {
                GameStatus.WON -> "✓ Solved!"
                GameStatus.LOST -> "✗ ${state.boards.firstOrNull()?.solution ?: ""}"
                else -> ""
            }
            if (statusText.isNotEmpty()) {
                Text(
                    statusText,
                    color = if (state.status == GameStatus.WON) WTheme.winText else WTheme.lossText,
                    fontSize = 12.sp, fontWeight = FontWeight.Black,
                )
            }
        }

        // Board area — fills the space between header and keyboard
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            if (multiBoard) {
                MultiBoardLayout(
                    boards = state.boards,
                    currentGuess = input,
                    currentBoardIndex = state.currentBoardIndex,
                    isSequential = isSequential,
                    modifier = Modifier.fillMaxSize().padding(4.dp),
                )
            } else {
                // Single board — centered, correct aspect ratio (web max-w-[400px], aspect wordLen/maxGuesses)
                val board = state.boards[0]
                SingleBoard(
                    board = board,
                    currentGuess = input,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }

        Spacer(Modifier.height(6.dp))

        // Keyboard
        KeyboardView(
            letterStates = letterStates,
            onKey = { vm.typeLetter(it) },
            onDelete = { vm.deleteLetter() },
            onEnter = { vm.submit(applyToAll = isApplyToAll) },
        )

        Spacer(Modifier.height(8.dp))
    }
}

/**
 * Single-board rendering — matches the web `Board` component: rows × word-length tiles,
 * centered, max-width 400dp, aspect-ratio wordLen/maxGuesses (constrained to the available
 * space). Tile flip animates at 150ms stagger on the last submitted row.
 */
@Composable
private fun SingleBoard(board: BoardState, currentGuess: String, modifier: Modifier = Modifier) {
    val wordLen = board.solution.length
    val lastSubmittedRow = if (board.guesses.isNotEmpty()) board.guesses.size - 1 else -1

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier
                .width(320.dp)
                .aspectRatio(wordLen.toFloat() / board.maxGuesses.toFloat()),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // Submitted rows
            for (rowIdx in 0 until board.guesses.size) {
                val guess = board.guesses[rowIdx]
                val eval = evaluateGuess(board.solution, guess)
                val isLastSubmitted = rowIdx == lastSubmittedRow
                Row(modifier = Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    eval.tiles.forEachIndexed { col, tile ->
                        TileView(
                            letter = tile.letter,
                            state = tile.state,
                            flipDelay = if (isLastSubmitted) col * 150 else null,
                            fontSize = 22f,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            // Current input row
            if (board.guesses.size < board.maxGuesses && board.status == GameStatus.PLAYING) {
                Row(modifier = Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (col in 0 until wordLen) {
                        val letter = currentGuess.getOrNull(col)?.toString() ?: ""
                        TileView(
                            letter = letter,
                            state = TileState.EMPTY,
                            fontSize = 22f,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            // Empty rows
            val emptyStart = board.guesses.size + if (board.status == GameStatus.PLAYING) 1 else 0
            for (rowIdx in emptyStart until board.maxGuesses) {
                Row(modifier = Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (col in 0 until wordLen) {
                        TileView(letter = "", state = TileState.EMPTY, fontSize = 22f, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
