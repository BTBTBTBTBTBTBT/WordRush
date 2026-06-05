package com.wordocious.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wordocious.app.data.GamePersistence
import com.wordocious.core.DictionaryLoader
import com.wordocious.core.GameAction
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.createInitialState
import com.wordocious.core.gameReducer
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * UI-state holder over the pure `:core` engine — the Kotlin analogue of the iOS
 * `GameViewModel`. Adds:
 *   - a live elapsed-time ticker (for the header + scoring),
 *   - local persistence (resume daily/in-progress games after backgrounding).
 *
 * All game rules live in [gameReducer]; this only tracks typed input + time and
 * forwards immutable state transitions to Compose.
 */
class GameViewModel(private val seed: String, private val mode: GameMode) : ViewModel() {

    private val _state = MutableStateFlow(run {
        DictionaryLoader.ensureLoaded()
        // Resume a saved game for this seed+mode, else start fresh.
        GamePersistence.load(seed, mode) ?: createInitialState(seed, mode)
    })
    val state: StateFlow<GameState> = _state.asStateFlow()

    private val _input = MutableStateFlow("")
    val currentInput: StateFlow<String> = _input.asStateFlow()

    /**
     * Live elapsed seconds. For an in-progress game this is wall-clock from
     * startTime. For an ALREADY-finished game (resumed from persistence) we use
     * the frozen elapsed-at-finish so the displayed time/score stays correct
     * instead of growing from the original startTime.
     */
    private val _elapsed = MutableStateFlow(
        if (_state.value.status != GameStatus.PLAYING)
            GamePersistence.loadElapsed(seed, mode) ?: elapsedSeconds()
        else elapsedSeconds()
    )
    val elapsed: StateFlow<Int> = _elapsed.asStateFlow()

    init {
        // Tick the elapsed timer once per second while the game is in progress.
        viewModelScope.launch {
            while (true) {
                if (!isFinished) _elapsed.value = elapsedSeconds()
                delay(1000)
            }
        }
    }

    /** Active board's solution length — guess/input length must match it. */
    val wordLength: Int
        get() = _state.value.boards[_state.value.currentBoardIndex].solution.length

    val isFinished: Boolean
        get() = _state.value.status != GameStatus.PLAYING

    fun elapsedSeconds(): Int =
        ((System.currentTimeMillis() - _state.value.startTime) / 1000).toInt().coerceAtLeast(0)

    fun typeLetter(c: Char) {
        if (isFinished) return
        if (_input.value.length >= wordLength) return
        if (!c.isLetter()) return
        _input.value = _input.value + c.uppercaseChar()
    }

    fun deleteLetter() {
        if (_input.value.isNotEmpty()) _input.value = _input.value.dropLast(1)
    }

    /** Submit the typed input. Returns false if rejected (length/validity/no-op). */
    fun submit(applyToAll: Boolean = false): Boolean {
        if (isFinished) return false
        val guess = _input.value
        if (guess.length != wordLength) return false
        val before = _state.value
        val after = gameReducer(before, GameAction.SubmitGuess(guess, applyToAll = applyToAll))
        if (after === before || after == before) return false  // dictionary-rejected or no-op
        _state.value = after
        _input.value = ""
        persist()
        if (after.status != GameStatus.PLAYING) {
            val finishElapsed = elapsedSeconds()
            _elapsed.value = finishElapsed                       // freeze the displayed timer
            GamePersistence.saveElapsed(seed, mode, finishElapsed) // persist for re-entry
        }
        return true
    }

    fun dispatch(action: GameAction) {
        _state.value = gameReducer(_state.value, action)
        persist()
    }

    private fun persist() = GamePersistence.save(seed, mode, _state.value)
}
