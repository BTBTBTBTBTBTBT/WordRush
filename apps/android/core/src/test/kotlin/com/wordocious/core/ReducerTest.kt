package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test

/**
 * Behavior tests for the state machine. There's no shared fixture for the
 * reducer (the iOS reducer was validated by gameplay), so these assert the
 * key transitions: win/loss, multi-board completion semantics, Rescue prefill +
 * any-loss rule, and Gauntlet stage progression. Deterministic via seed "test".
 */
class ReducerTest {

    @Before fun setup() = DictionaryLoader.ensureLoaded()

    @Test
    fun duel_inits_and_wins() {
        val sol = generateSolutionsFromSeed("test", 1)[0]
        var s = createInitialState("test", GameMode.DUEL)
        assertEquals(1, s.boards.size)
        assertEquals(6, s.boards[0].maxGuesses)
        assertEquals(sol, s.boards[0].solution)
        assertEquals(GameStatus.PLAYING, s.status)

        s = gameReducer(s, GameAction.SubmitGuess(sol, boardIndex = 0))
        assertEquals(GameStatus.WON, s.status)
        assertEquals(GameStatus.WON, s.boards[0].status)
    }

    @Test
    fun quordle_applyToAll_solves_one_board_game_stays_playing() {
        val sols = generateSolutionsFromSeed("test", 4) // WRECK, ADORN, TRIED, BITCH
        var s = createInitialState("test", GameMode.QUORDLE)
        assertEquals(4, s.boards.size)
        assertEquals(9, s.boards[0].maxGuesses)

        s = gameReducer(s, GameAction.SubmitGuess(sols[0], applyToAll = true))
        assertEquals(GameStatus.WON, s.boards[0].status)
        assertEquals(GameStatus.PLAYING, s.boards[1].status)
        assertEquals(GameStatus.PLAYING, s.status) // game continues until all 4 resolve
    }

    @Test
    fun rescue_has_prefill_and_any_loss_ends_game() {
        val s = createInitialState("test", GameMode.RESCUE)
        assertEquals(4, s.boards.size)
        s.boards.forEach { assertEquals("3 prefilled rows", 3, it.prefilledGuesses?.size) }

        // Exhaust board 0's 6 guesses without solving → that single loss ends the whole game.
        val wrongPool = generateSolutionsFromSeed("test", 30).filter { it != s.boards[0].solution }
        var st = s
        for (i in 0 until 6) {
            st = gameReducer(st, GameAction.SubmitGuess(wrongPool[i], applyToAll = true))
        }
        assertEquals(GameStatus.LOST, st.boards[0].status)
        assertEquals(GameStatus.LOST, st.status) // RESCUE: any board loss = game lost
    }

    @Test
    fun gauntlet_advances_stage_on_clear() {
        var s = createInitialState("test", GameMode.GAUNTLET)
        assertNotNull(s.gauntlet)
        assertEquals(0, s.gauntlet!!.currentStage)
        assertEquals(1, s.boards.size) // stage 0 = The Opening (single board)

        // Solve stage 0, then advance.
        s = gameReducer(s, GameAction.SubmitGuess(s.boards[0].solution, boardIndex = 0))
        assertEquals(GameStatus.WON, s.boards[0].status)
        assertEquals(GameStatus.PLAYING, s.status) // gauntlet doesn't win on a stage clear

        s = gameReducer(s, GameAction.NextStage())
        assertEquals(1, s.gauntlet!!.currentStage)
        assertEquals(4, s.boards.size) // stage 1 = QuadWord
        assertEquals(1, s.gauntlet!!.stageResults.size)
        assertEquals(GameStatus.WON, s.gauntlet!!.stageResults[0].status)
    }

    /**
     * The Succession trap, pinned. A sequential stage leaves EVERY unsolved board
     * PLAYING, and nothing anywhere advances `currentBoardIndex` — so a guess that
     * reaches the single-board path defaults to board 0, finds it already WON, and
     * the reducer returns state unchanged. The UI reports that as "Not in word
     * list", which is what a stalled Succession stage actually looks like.
     *
     * Both call routes must survive board 0 being solved: applyToAll (what the
     * screens send for any multi-board stage) and an explicit boardIndex (what
     * GameViewModel.submit now always passes).
     */
    @Test
    fun sequential_stage_keeps_accepting_guesses_after_board0_is_solved() {
        var s = createInitialState("test", GameMode.SEQUENCE)
        assert(s.boards.size > 1) { "SEQUENCE must be multi-board for this test to mean anything" }

        // Solve board 0 the way the screens do.
        s = gameReducer(s, GameAction.SubmitGuess(s.boards[0].solution, applyToAll = true))
        assertEquals(GameStatus.WON, s.boards[0].status)
        assertEquals(GameStatus.PLAYING, s.boards[1].status)
        // currentBoardIndex is the trap: it did NOT move.
        assertEquals(0, s.currentBoardIndex)

        // Route 1 — applyToAll. Must land on the still-playing board 1.
        val before1 = s.boards[1].guesses.size
        s = gameReducer(s, GameAction.SubmitGuess(s.boards[1].solution, applyToAll = true))
        assert(s.boards[1].guesses.size > before1) { "applyToAll dropped the guess after board 0 was won" }
        assertEquals(GameStatus.WON, s.boards[1].status)

        // Route 2 — explicit index, the single-board path. Omitting boardIndex
        // here would silently no-op; that omission is the bug this pins.
        val active = s.boards.indexOfFirst { it.status == GameStatus.PLAYING }
        assert(active > 0) { "expected a later board to still be playing" }
        val before2 = s.boards[active].guesses.size
        s = gameReducer(
            s,
            GameAction.SubmitGuess(s.boards[active].solution, boardIndex = active, applyToAll = false),
        )
        assert(s.boards[active].guesses.size > before2) { "explicit boardIndex dropped the guess" }
        assertEquals(GameStatus.WON, s.boards[active].status)
    }
}
