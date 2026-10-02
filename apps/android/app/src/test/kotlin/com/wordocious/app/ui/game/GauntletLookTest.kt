package com.wordocious.app.ui.game

import com.wordocious.app.ui.CastPoses
import com.wordocious.app.ui.MascotId
import com.wordocious.core.BoardState
import com.wordocious.core.GameStatus
import com.wordocious.core.GauntletProgress
import com.wordocious.core.GauntletStageResult
import com.wordocious.core.gauntletStages
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/** FINISH_SPEC P / Q: the Gauntlet stage + finish screens' pure choices (web lib/gauntlet-look.ts parity). */
class GauntletLookTest {
    @Test fun stagePoseByUpcomingStage() {
        assertEquals(GauntletLook.Pose(MascotId.O1, "cheer"), GauntletLook.stagePose(2))
        assertEquals(GauntletLook.Pose(MascotId.D, "eureka"), GauntletLook.stagePose(3))
        assertEquals(GauntletLook.Pose(MascotId.C, "telescope"), GauntletLook.stagePose(4))
        assertEquals(GauntletLook.Pose(MascotId.S, "flex"), GauntletLook.stagePose(5))
        // After the final stage (no next stage) the boss is down: W proud.
        assertEquals(GauntletLook.Pose(MascotId.W, "proud"), GauntletLook.stagePose(null))
        assertEquals(GauntletLook.Pose(MascotId.W, "proud"), GauntletLook.stagePose(6))
    }

    @Test fun everyPoseShips() {
        val all = listOf(2, 3, 4, 5, null).map(GauntletLook::stagePose) +
            GauntletLook.LOST_POSES + GauntletLook.STAGE_FAILED_POSE
        all.forEach { p -> assertNotNull("${p.mascot} ${p.pose}", CastPoses.res(p.mascot, p.pose)) }
        assertEquals(listOf(MascotId.R, MascotId.I), GauntletLook.LOST_POSES.map { it.mascot })
    }

    @Test fun dotsAndStars() {
        val d = GauntletLook.Dot.DONE
        val c = GauntletLook.Dot.CURRENT
        val t = GauntletLook.Dot.TODO
        assertEquals(listOf(d, d, c, t, t), GauntletLook.stageDots(5, 2))
        assertEquals(listOf(d, d, d, d, d), GauntletLook.stageDots(5, 5))
        assertEquals(listOf(c, t, t, t, t), GauntletLook.stageDots(5, 0))
        assertEquals(listOf(true, true, true, false, false), GauntletLook.starRow(5, 3))
        assertEquals(List(5) { true }, GauntletLook.starRow(5, 5))
        assertEquals(emptyList<Boolean>(), GauntletLook.starRow(0, 0))
    }

    @Test fun ruleLine() {
        assertEquals("1 board · 6 guesses", GauntletLook.stageRuleLine(gauntletStages[0]))
        assertEquals("4 boards · 10 guesses · sequential", GauntletLook.stageRuleLine(gauntletStages[2]))
        assertEquals("4 boards · 6 guesses · pre-filled clues", GauntletLook.stageRuleLine(gauntletStages[3]))
    }

    private fun board(solution: String, status: GameStatus, guesses: List<String> = emptyList()) =
        BoardState(solution = solution, guesses = guesses, maxGuesses = 6, status = status)

    @Test fun runningScoreAndFailedAnswers() {
        val g = GauntletProgress(
            currentStage = 1, totalStages = 5, stages = gauntletStages,
            stageResults = listOf(
                GauntletStageResult(0, GameStatus.WON, 4, 30_000),
                GauntletStageResult(
                    1, GameStatus.LOST, 9, 90_000,
                    boardsSnapshot = listOf(
                        board("crane", GameStatus.WON), board("pilot", GameStatus.LOST),
                        board("ghost", GameStatus.LOST), board("tiger", GameStatus.WON),
                    ),
                ),
            ),
            stageStartTime = 0.0, allSolutions = emptyList(),
        )
        assertEquals(listOf("PILOT", "GHOST"), GauntletLook.failedAnswers(g))
        val current = listOf(board("a", GameStatus.WON, listOf("x", "y")), board("b", GameStatus.WON, listOf("x", "y", "z")))
        assertEquals(4 + 9 + 3, GauntletLook.guessesSoFar(g, current))
    }
}
