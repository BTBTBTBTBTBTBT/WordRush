package com.wordocious.app.ui.game

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.wordocious.app.ui.modeAccent
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus

/**
 * Victory / game-over celebration overlay (spec line 150). Shown for a game that
 * finished LIVE this session, before the post-game stats screen. FINISH_SPEC R1: the
 * shared [WinPopup] — the host on its stage, VICTORY! / SO CLOSE!, the answer(s) on
 * glossy tiles in the tinted tray (multi-board: the 2-column grid with checks), the
 * definition under a single word, the stat chips and the CONTINUE candy.
 */
@Composable
fun VictoryOverlay(
    state: GameState,
    mode: GameMode,
    elapsedSeconds: Int,
    // §242 (founder: "go right into the next game without going back"): a
    // Play/Try-again button on the card. Callers pass it ONLY on unlimited
    // games — same non-daily + Pro gate as the post-game screen's button.
    onPlayAgain: (() -> Unit)? = null,
    /** Composite score of the run — a stat chip on the card (founder,
     *  2026-09-22: the points are the number players care about). */
    points: Int? = null,
    onContinue: () -> Unit,
    /** R1 extra chips, only when the caller knows them. */
    streakDay: Int? = null,
    flawless: Boolean = false,
    newRecord: Boolean = false,
) {
    val won = state.status == GameStatus.WON
    val board = state.boards[0]
    val multi = state.boards.size > 1
    val boardsSolved = state.boards.count { it.status == GameStatus.WON }
    // iOS feeds the overlay vm.rowsUsed (max across boards), not board 0's count —
    // on multi-board modes board 0 stops accumulating once it solves.
    val rowsUsed = state.boards.maxOf { it.guesses.size }

    // Web parity: victory-animation plays the success jingle on mount,
    // game-over-animation the descending jingle (gauntlet losses never mount
    // this overlay, so they stay silent — matches web/iOS).
    LaunchedEffect(Unit) {
        if (won) com.wordocious.app.data.SoundManager.playSuccess()
        else com.wordocious.app.data.SoundManager.playGameOver()
        // 10-06 the living mascot cheers / shrugs (a no-op while AvatarLiveConfig.LIVING_MASCOT is off)
        com.wordocious.app.data.MascotMoments.emit(if (won) com.wordocious.core.AvatarReaction.WIN else com.wordocious.core.AvatarReaction.LOSS)
    }

    val answers = if (!multi) {
        // ProperNoundle answers are stored normalized ("TAYLORSWIFT"); the spaced
        // display name gives one word per row.
        val display = if (mode == GameMode.PROPERNOUNDLE)
            com.wordocious.core.ProperNoundle.puzzleFor(board.solution)?.display ?: board.solution
        else board.solution
        WinAnswers(display.trim().split(Regex("\\s+")).filter { it.isNotEmpty() })
    } else {
        WinAnswers(state.boards.map { it.solution }, state.boards.map { it.status == GameStatus.WON })
    }

    WinPopup(
        won = won,
        hostKey = mode.name,
        accent = modeAccent(mode),
        onContinue = onContinue,
        answers = answers,
        stats = WinPopupMath.wordGameStats(
            multi, boardsSolved, state.boards.size, rowsUsed, board.maxGuesses, elapsedSeconds, points,
        ),
        onPlayAgain = onPlayAgain,
        streakDay = streakDay,
        flawless = flawless,
        newRecord = newRecord,
        // iOS shows the dictionary definition right under the word —
        // ProperNoundle skips it (proper noun; its Wikipedia clue stands in).
        extra = if (!multi && mode != GameMode.PROPERNOUNDLE) ({ DefinitionCard(board.solution.uppercase()) }) else null,
    )
}
