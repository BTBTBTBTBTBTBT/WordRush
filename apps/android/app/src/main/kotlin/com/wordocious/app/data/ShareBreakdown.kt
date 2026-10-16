package com.wordocious.app.data

import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import com.wordocious.core.GameMode
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max

/**
 * The SCORE BREAKDOWN panel on a finished-game share card (SPEC share-cards-1016): the same rows the finished screen's
 * ScoreBreakdownCard renders (the shared [DailyScoring.breakdown], so the total always equals the recorded score), drawn on the
 * night frame: a dark panel with a purple top bar, the title row with the total, then each line with its detail and value.
 */
object ShareBreakdown {
    /** What the screen feeds ScoreBreakdownCard with. */
    data class Input(
        val mode: GameMode, val won: Boolean, val guessCount: Int, val elapsedSeconds: Int,
        val boardsSolved: Int, val totalBoards: Int, val hintsUsed: Int,
        val stagesCompleted: Int? = null, val bestCorrectLetters: Int? = null,
        /** The PUZZLE's day (yyyy-MM-dd); null = the current formula. */
        val day: String? = null,
    )

    data class Row(val label: String, val detail: String, val value: Double, val pure: Boolean = false)

    data class Rows(val total: Int, val rows: List<Row>)

    private fun fmtSecs(s: Int): String = if (s <= 0) "0s" else if (s >= 60) "${s / 60}m ${s % 60}s" else "${s}s"

    /** The rows exactly as the finished screen builds them (PostGameScreen.ScoreBreakdownCard). Pure. */
    fun rows(i: Input): Rows {
        val b = DailyScoring.breakdown(i.mode.name, i.won, i.guessCount, i.elapsedSeconds, i.boardsSolved, i.totalBoards, i.hintsUsed, i.stagesCompleted, i.bestCorrectLetters, i.day)
        val guessesLeft = max(0, b.maxGuesses - i.guessCount)
        val timeUnder = max(0, b.timeCap - i.elapsedSeconds)
        val out = ArrayList<Row>()
        out += Row(if (i.won) "Win bonus" else "Did not finish", if (i.won) "" else "no win bonus", b.basePoints)
        val bonusLabel = when (com.wordocious.app.ModeGen.byDbKey(i.mode.name)?.guessSemantics) {
            "mistakes" -> "Mistake bonus"
            "checks" -> "Check bonus"
            "misses" -> "Miss bonus"
            "overPar" -> "Par bonus"
            "rank" -> "Rank bonus"
            else -> "Guess bonus"
        }
        if (i.won && b.guessBonusApplies) out += Row(bonusLabel, "$guessesLeft unused × ${b.guessWeight}", b.guessBonus)
        if (i.won) out += Row("Speed bonus", if (i.elapsedSeconds > b.timeCap) "${fmtSecs(i.elapsedSeconds - b.timeCap)} over ${fmtSecs(b.timeCap)}" else "${fmtSecs(timeUnder)} under ${fmtSecs(b.timeCap)}", b.timeBonus)
        if (b.completionBonus > 0) {
            val (label, detail) = when {
                i.won -> "Completion bonus" to (if (i.totalBoards > 1) "${i.boardsSolved}/${i.totalBoards} boards" else "puzzle solved")
                i.mode == GameMode.GAUNTLET -> "Stage progress" to "${i.stagesCompleted ?: 0}/5 stages cleared"
                i.totalBoards == 1 -> {
                    val n = i.bestCorrectLetters ?: 0
                    "Near miss" to "$n correct letter${if (n == 1) "" else "s"}"
                }
                else -> "Completion bonus" to "${i.boardsSolved}/${i.totalBoards} boards"
            }
            out += Row(label, detail, b.completionBonus)
        }
        if (b.hasHints) {
            val detail = if (i.hintsUsed > 0) "${i.hintsUsed} hint${if (i.hintsUsed == 1) "" else "s"} × ${b.hintCost}" else "no hints — full credit"
            out += Row("Hint penalty", detail, -b.hintPenalty, pure = i.won && i.hintsUsed == 0)
        }
        return Rows(b.total.toInt(), out)
    }

    const val PAD = 30f
    const val TITLE_H = 70f
    const val ROW_H = 44f

    /** A drawable panel with its own height (the layout reserves it under the board). */
    class Panel(val data: Rows) {
        val height: Float = PAD * 0.6f + TITLE_H + data.rows.size * ROW_H + PAD * 0.7f

        internal fun draw(c: Canvas, fonts: ShareFinish.Fonts, left: Float, top: Float, w: Float) {
            val r = RectF(left, top, left + w, top + height)
            val rad = 30f
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF281650.toInt() }
            c.drawRoundRect(r, rad, rad, fill)
            // the purple top bar, clipped to the rounded top
            c.save()
            c.clipPath(Path().apply { addRoundRect(r, rad, rad, Path.Direction.CW) })
            val bar = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = LinearGradient(r.left, 0f, r.right, 0f, 0xFF7C3AED.toInt(), 0xFFA855F7.toInt(), Shader.TileMode.CLAMP)
            }
            c.drawRect(r.left, r.top, r.right, r.top + 9f, bar)
            c.restore()

            val title = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.black; textSize = 24f; color = ShareFinish.INK_LABEL; letterSpacing = 0.08f }
            val pts = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.black; textSize = 26f; color = ShareFinish.INK_PURPLE; textAlign = Paint.Align.RIGHT }
            val total = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.black; textSize = 58f; color = 0xFFFFFFFF.toInt(); textAlign = Paint.Align.RIGHT; fontFeatureSettings = "tnum" }
            val ty = r.top + PAD * 0.6f + TITLE_H / 2f
            val right = r.right - PAD
            c.drawText("PTS", right, ty + 20f, pts)
            val totalText = String.format(Locale.US, "%,d", data.total)
            c.drawText(totalText, right - pts.measureText("PTS") - 10f, ty + 20f, total)
            c.drawText("SCORE BREAKDOWN", r.left + PAD, ty + 6f, title)

            val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.black; textSize = 29f; color = 0xFFFFFFFF.toInt() }
            val detail = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.bold; textSize = 23f; color = ShareFinish.INK_MUTED }
            val value = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.black; textSize = 29f; textAlign = Paint.Align.RIGHT; fontFeatureSettings = "tnum" }
            var y = r.top + PAD * 0.6f + TITLE_H
            for (row in data.rows) {
                val cy = y + ROW_H / 2f
                label.color = if (row.pure) ShareFinish.INK_PURPLE else 0xFFFFFFFF.toInt()
                val base = cy - (label.ascent() + label.descent()) / 2f
                c.drawText(row.label, r.left + PAD, base, label)
                if (row.detail.isNotEmpty()) c.drawText(row.detail, r.left + PAD + label.measureText(row.label) + 14f, base, detail)
                val sign = if (row.value > 0) "+" else if (row.value < 0) "−" else ""
                value.color = if (row.value > 0) ShareFinish.INK_PURPLE else if (row.value < 0) ShareFinish.LOSS_RED else ShareFinish.INK_MUTED
                c.drawText("$sign${String.format(Locale.US, "%,d", abs(row.value).toInt())}", right, base, value)
                y += ROW_H
            }
        }
    }

    fun panel(i: Input): Panel? = runCatching { Panel(rows(i)) }.getOrNull()
}
