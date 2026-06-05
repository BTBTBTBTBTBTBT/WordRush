package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
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
 * Full game screen — audit-then-match of the web game UI.
 *
 * Single-board (DUEL/DUEL_6/DUEL_7/PROPERNOUNDLE/TOURNAMENT):
 *   Board fills available space using BoxWithConstraints — same as the web's
 *   `w-full max-w-[400px] max-h-full aspect-ratio` approach.
 *
 * Multi-board (QUORDLE/OCTORDLE/SEQUENCE/RESCUE/GAUNTLET):
 *   MultiBoardLayout handles 2×2 / 4×2 grids with Sequence locking and
 *   OctoWord tap-to-zoom.
 *
 * Post-game: GameStatus.WON / LOST → PostGameScreen overlay.
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
    val isFinished = state.status != GameStatus.PLAYING

    // Show post-game overlay once all tiles have revealed
    if (isFinished) {
        PostGameScreen(
            state = state,
            mode = mode,
            seed = seed,
            onBack = onBack,
        )
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().background(WTheme.bg).padding(horizontal = 4.dp),
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "‹", color = WTheme.primary, fontSize = 24.sp, fontWeight = FontWeight.Black,
                modifier = Modifier.clickableNoRipple(onBack).padding(end = 8.dp),
            )
            Text(title, color = WTheme.text, fontSize = 16.sp, fontWeight = FontWeight.Black)
            if (mode == GameMode.GAUNTLET) {
                val stageNum = (state.gauntlet?.currentStage ?: 0) + 1
                val totalStages = state.gauntlet?.totalStages ?: 5
                val stageName = state.gauntlet?.stages?.getOrNull(state.gauntlet!!.currentStage)?.name ?: ""
                Spacer(Modifier.weight(1f))
                Text(
                    "Stage $stageNum/$totalStages · $stageName",
                    color = WTheme.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                )
            }
        }

        // Board area — fills between header and keyboard
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
                SingleBoard(
                    board = state.boards[0],
                    currentGuess = input,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }

        Spacer(Modifier.height(6.dp))

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
 * Single-board — fills available space like the web's `max-w-[400px] max-h-full
 * aspect-ratio` board. Uses BoxWithConstraints to compute the largest board that
 * fits width AND height, then centres it. Font size scales with tile size.
 */
@Composable
internal fun SingleBoard(board: BoardState, currentGuess: String, modifier: Modifier = Modifier) {
    val wordLen = board.solution.length
    val rows = board.maxGuesses
    val lastSubmittedRow = if (board.guesses.isNotEmpty()) board.guesses.size - 1 else -1

    BoxWithConstraints(modifier = modifier, contentAlignment = Alignment.Center) {
        // Max board width per web (400px ≈ 380dp accounting for padding)
        val maxBoardW = minOf(maxWidth, 380.dp)
        val maxBoardH = maxHeight

        // Board aspect ratio is wordLen:rows (each tile square)
        val ratio = wordLen.toFloat() / rows.toFloat()
        val fromWidth: Dp = maxBoardW
        val fromWidthH: Dp = fromWidth / ratio

        val (boardW, boardH) = if (fromWidthH <= maxBoardH) {
            fromWidth to fromWidthH
        } else {
            (maxBoardH * ratio) to maxBoardH
        }

        // Scale font size to tile height
        val gapTotal = 4.dp * (rows - 1)
        val tileHValue = (boardH.value - gapTotal.value) / rows
        val tileFontSp = (tileHValue * 0.44f).coerceIn(14f, 28f)

        Column(
            modifier = Modifier.size(boardW, boardH),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // Submitted rows
            for (rowIdx in 0 until board.guesses.size) {
                val guess = board.guesses[rowIdx]
                val eval = evaluateGuess(board.solution, guess)
                val isLastSubmitted = rowIdx == lastSubmittedRow
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    eval.tiles.forEachIndexed { col, tile ->
                        TileView(
                            letter = tile.letter,
                            state = tile.state,
                            flipDelay = if (isLastSubmitted) col * 150 else null,
                            fontSize = tileFontSp,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            // Current input row
            if (board.guesses.size < board.maxGuesses && board.status == GameStatus.PLAYING) {
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    for (col in 0 until wordLen) {
                        TileView(
                            letter = currentGuess.getOrNull(col)?.toString() ?: "",
                            state = TileState.EMPTY,
                            fontSize = tileFontSp,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            // Empty rows
            val emptyStart = board.guesses.size + if (board.status == GameStatus.PLAYING) 1 else 0
            for (rowIdx in emptyStart until board.maxGuesses) {
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    repeat(wordLen) {
                        TileView(letter = "", state = TileState.EMPTY, fontSize = tileFontSp, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
