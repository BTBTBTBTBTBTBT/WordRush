package com.wordocious.app.ui.game

import com.wordocious.app.ui.MascotId
import com.wordocious.core.BoardState
import com.wordocious.core.GameStatus
import com.wordocious.core.GauntletProgress
import com.wordocious.core.GauntletStageConfig

/**
 * The Gauntlet stage + finish screens (docs/FINISH_SPEC.md P, Q) — the pure parts:
 * which cast pose each screen shows, the 5-dot progress row, the 5-star row, the
 * stage rule pill and the failed stage's answers. Mirrors web lib/gauntlet-look.ts.
 */
object GauntletLook {
    /** The Gauntlet catalog accent (amber, `#d97706`). */
    const val ACCENT_ARGB: Long = 0xFFD97706

    /** Q: the 5-star row pops in one star at a time, this far apart. */
    const val STAR_STAGGER_MS = 90

    /** A cast pose: the character and its pose name (FinishKit CastPoses). */
    data class Pose(val mascot: MascotId, val pose: String)

    /**
     * P: the cast pose on the between-stage card, by the UPCOMING stage (1-based):
     * Stage 2 O1 cheering · 3 D eureka · 4 C telescope · 5 S flexing; after the final
     * stage (no next stage — the boss is down) W proud.
     */
    fun stagePose(nextStageNumber: Int?): Pose = when (nextStageNumber) {
        2 -> Pose(MascotId.O1, "cheer")
        3 -> Pose(MascotId.D, "eureka")
        4 -> Pose(MascotId.C, "telescope")
        5 -> Pose(MascotId.S, "flex")
        else -> Pose(MascotId.W, "proud")
    }

    /** P: a failed run's pose (kind, never sad). */
    val STAGE_FAILED_POSE = Pose(MascotId.R, "sit")

    /** Q: the LOST finish screen's two poses, side by side. */
    val LOST_POSES: List<Pose> = listOf(Pose(MascotId.R, "cocoa"), Pose(MascotId.I, "goodgame"))

    enum class Dot { DONE, CURRENT, TODO }

    /** The 5-dot progress row: [cleared] stages done, the next one current (none once all are cleared). */
    fun stageDots(total: Int, cleared: Int): List<Dot> =
        List(total.coerceAtLeast(0)) { i -> if (i < cleared) Dot.DONE else if (i == cleared) Dot.CURRENT else Dot.TODO }

    /** Q: the 5-star row — [cleared] filled gold, the rest soft gray. */
    fun starRow(total: Int, cleared: Int): List<Boolean> = List(total.coerceAtLeast(0)) { i -> i < cleared }

    /** The stage's rule pill: "4 boards · 9 guesses · sequential · pre-filled clues". */
    fun stageRuleLine(s: GauntletStageConfig): String = listOfNotNull(
        "${s.boardCount} board${if (s.boardCount == 1) "" else "s"}",
        "${s.maxGuesses} guesses",
        if (s.sequential) "sequential" else null,
        if (s.hasPrefill) "pre-filled clues" else null,
    ).joinToString(" · ")

    /**
     * The running score on the between-stage card: the guesses of every recorded
     * stage plus the stage just cleared (its longest board's guess count — the
     * boards share one guess list).
     */
    fun guessesSoFar(progress: GauntletProgress, currentBoards: List<BoardState>): Int =
        progress.stageResults.sumOf { it.guesses } + (currentBoards.maxOfOrNull { it.guesses.size } ?: 0)

    /** Q (LOST): the failed stage's unsolved answers (uppercase, at most four). */
    fun failedAnswers(progress: GauntletProgress): List<String> =
        progress.stageResults.firstOrNull { it.status == GameStatus.LOST }?.boardsSnapshot.orEmpty()
            .filter { it.status != GameStatus.WON }
            .map { it.solution.uppercase() }
            .take(4)
}
