package com.wordocious.app

import androidx.lifecycle.ViewModel
import com.wordocious.core.DictionaryLoader
import com.wordocious.core.GameAction
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.createInitialState
import com.wordocious.core.gameReducer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Thin UI-state holder over the pure `:core` engine — the Kotlin analogue of the
 * iOS `GameViewModel`. All game rules live in [gameReducer]; this only tracks the
 * in-progress typed input and forwards immutable state transitions to Compose.
 *
 * This is the foundation the audit-then-match Compose screens build on. Mirrors
 * the iOS shape: `state` (StateFlow) + `currentInput` + type/delete/submit.
 */
class GameViewModel(seed: String, mode: GameMode) : ViewModel() {

    private val _state = MutableStateFlow(run {
        DictionaryLoader.ensureLoaded()
        createInitialState(seed, mode)
    })
    val state: StateFlow<GameState> = _state.asStateFlow()

    private val _input = MutableStateFlow("")
    val currentInput: StateFlow<String> = _input.asStateFlow()

    /** Active board's solution length — guess/input length must match it. */
    val wordLength: Int
        get() = _state.value.boards[_state.value.currentBoardIndex].solution.length

    val isFinished: Boolean
        get() = _state.value.status != GameStatus.PLAYING

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
        return true
    }

    fun dispatch(action: GameAction) {
        _state.value = gameReducer(_state.value, action)
    }
}
