package com.wordocious.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import com.wordocious.app.ModeGen
import com.wordocious.app.R
import com.wordocious.app.data.ShareFinish.U
import com.wordocious.app.data.ShareFinish.textMid
import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.gameTitleArtResForKey
import com.wordocious.app.ui.wallpaperRes
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.ShareHero
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import com.wordocious.core.getDailySeedDate
import java.util.Locale
import java.util.WeakHashMap
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Share-image renderer — FINISH_SPEC E1 look, S2 fit, S3 cast wordmark. Every game
 * result is a [ShareCard]: the game's wallpaper full bleed, its title art (~70%
 * width), one compact info line ("FRIDAY, OCT 2 · #217 · 4/6 · 2:14" + the 3D W / L
 * badge), the board block filling ~88% of the width (single boards big, multi-board
 * a tight 2 × 2 / 4 × 2, tall boards scaled by height), the tinted stat windows
 * (purple GUESSES, blue TIME, gold POINTS, soft numbers) and the ten-figure cast
 * wordmark with "wordocious.com" under it. Glossy tiles only (the B1 recipe: never a
 * flat square, never a white cell, no grid lines).
 *
 * S1: the share itself is the IMAGE ONLY ([ShareHelper.shareImage]) — no hosted /s
 * link is created anymore, no caption travels. The emoji text is only the fallback
 * when no PNG can be written.
 */
object ShareImage {
    fun accentFor(mode: GameMode): Int = when (mode) {
        GameMode.DUEL -> 0xFF7C3AED
        GameMode.QUORDLE -> 0xFFEC4899
        GameMode.OCTORDLE -> 0xFF7E22CE
        GameMode.SEQUENCE -> 0xFF2563EB
        GameMode.RESCUE -> 0xFF059669
        GameMode.GAUNTLET -> 0xFFD97706
        GameMode.PROPERNOUNDLE -> 0xFFDC2626
        GameMode.DUEL_6 -> 0xFF06B6D4
        GameMode.DUEL_7 -> 0xFF84CC16
        else -> 0xFF7C3AED
    }.toInt()

    private fun fmtTime(secs: Int): String = "%d:%02d".format(secs / 60, secs % 60)
    private fun grouped(n: Int): String = String.format(Locale.US, "%,d", n)

    /** The reference width every body is laid out at (the 88% band of the 1080 card). */
    private const val REF_W = 950f
    /** The reference tile every board is laid out with (the card scales it). */
    private const val T = 100f
    private const val TILE_GAP = 0.11f

    /** The game each rendered card shows — [shareBitmap] names its chooser + file after it. */
    private val gameOf = WeakHashMap<Bitmap, String>()

    private fun Bitmap.named(game: String): Bitmap = also { synchronized(gameOf) { gameOf[it] = game } }

    private fun gameTitle(dbKey: String, fallback: String): String =
        ModeGen.byDbKey(dbKey)?.title ?: fallback.lowercase(Locale.US).replaceFirstChar { it.titlecase(Locale.US) }

    /** "FRIDAY, OCT 2 · #217 · …extras". */
    private fun infoText(day: String?, puzzle: String?, extras: List<String>): String =
        (listOf(ShareFinish.dayCaps(day)) + listOfNotNull(puzzle) + extras).joinToString(" · ")

    // ── Boards ─────────────────────────────────────────────────────────────────

    /** One word board's grid at the reference tile: [rows] rows, ProperNoundle word-group gaps. */
    private class Grid(val cols: Int, val rows: Int, wordGroups: List<Int>?) {
        val groups = wordGroups?.takeIf { it.size > 1 && it.sum() == cols }
        val gap = T * TILE_GAP
        val groupGap = max(gap * 4, T)
        val w = cols * T + gap * (cols - 1) + (if (groups != null) (groups.size - 1) * (groupGap - gap) else 0f)
        val h = rows * T + gap * (rows - 1)
        private val boundaries = groups?.runningReduce { a, n -> a + n }?.dropLast(1)?.toSet() ?: emptySet()

        /** Glossy tiles from [left], [top]; rows past the board's own guesses are frosted. */
        fun draw(c: Canvas, board: BoardState, left: Float, top: Float, reveal: Boolean, face: Typeface) {
            for (r in 0 until rows) {
                val guess = board.guesses.getOrNull(r)
                val eval = guess?.let { evaluateGuess(board.solution, it) }
                var x = left
                for (col in 0 until cols) {
                    if (col in boundaries) x += groupGap - gap
                    val y = top + r * (T + gap)
                    val st = eval?.tiles?.getOrNull(col)?.state ?: TileState.EMPTY
                    val letter = if (reveal && st != TileState.EMPTY) eval?.tiles?.getOrNull(col)?.letter?.uppercase() else null
                    ShareFinish.drawTile(c, RectF(x, y, x + T, y + T), ShareFinish.lookFor(st), letter, face)
                    x += T + gap
                }
            }
        }
    }

    /** The red answer caption under a lost board ("Full results"). */
    private fun drawAnswer(c: Canvas, fonts: ShareFinish.Fonts, text: String, cx: Float, cy: Float, maxW: Float, size: Float) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER; typeface = fonts.black; color = ShareFinish.LOSS_RED
            textSize = size; letterSpacing = 0.06f
            ShareFinish.softShadow(this)
        }
        val t = text.uppercase(Locale.US)
        ShareFinish.fitText(p, t, maxW)
        c.textMid(t, cx, cy, p)
    }

    /** A single board, big: the grid fills the band; the answer under it on a lost "Full results". */
    private fun singleBody(board: BoardState, rows: Int, wordGroups: List<Int>?, reveal: Boolean, answer: String?, fonts: ShareFinish.Fonts): ShareCard.Body {
        val g = Grid(board.solution.length, rows, wordGroups)
        val capH = if (answer != null) T * 0.8f else 0f
        return ShareCard.Body(g.w, g.h + capH) { c ->
            g.draw(c, board, 0f, 0f, reveal, fonts.black)
            if (answer != null) drawAnswer(c, fonts, answer, g.w / 2f, g.h + capH / 2f + T * 0.05f, g.w, T * 0.5f)
        }
    }

    /**
     * Multi-board: a tight 2 × 2 (≤ 4 boards) or 4 × 2 (eight), the gap ≈ 4% of the
     * card width; every board on its soft tinted card (lavender solved / rose missed)
     * with the run's row count, so a board solved early frosts its remaining rows.
     */
    private fun multiBody(state: GameState, reveal: Boolean, fonts: ShareFinish.Fonts): ShareCard.Body {
        val boards = state.boards
        val cols = if (boards.size <= 4) 2 else 4
        val gridRows = (boards.size + cols - 1) / cols
        val shownRows = max(1, boards.maxOf { it.guesses.size })
        val g = Grid(boards.maxOf { it.solution.length }, shownRows, null)
        val pad = T * 0.32f
        val capH = if (reveal && boards.any { it.status != GameStatus.WON }) T * 0.75f else 0f
        val cardW = g.w + 2 * pad
        val cardH = g.h + 2 * pad + capH
        // gap ≈ 4% of the card width; the body is ~88% of it.
        val gap = 0.045f * (cols * cardW) / (1f - 0.045f * (cols - 1))
        val w = cols * cardW + (cols - 1) * gap
        val h = gridRows * cardH + (gridRows - 1) * gap
        return ShareCard.Body(w, h) { c ->
            boards.forEachIndexed { i, b ->
                val x = (i % cols) * (cardW + gap)
                val y = (i / cols) * (cardH + gap)
                val won = b.status == GameStatus.WON
                val (tint, line) = if (won) 0xFFF5EEFF.toInt() to 0xFFE2D3FF.toInt() else 0xFFFFF1F2.toInt() to 0xFFFECDD3.toInt()
                ShareFinish.drawTintedCard(c, RectF(x, y, x + cardW, y + cardH), pad * 1.3f, tint, line,
                    shadow = 0x1A3C1E6E, shadowDy = pad * 0.3f, shadowBlur = pad)
                g.draw(c, b, x + pad, y + pad, reveal, fonts.black)
                if (reveal && !won) drawAnswer(c, fonts, b.solution, x + cardW / 2f, y + pad + g.h + capH / 2f + T * 0.05f, g.w, T * 0.55f)
            }
        }
    }

    /** Gauntlet: one tinted chip per stage — a glossy stage number, name + stats, the W / L badge. */
    private fun gauntletBody(context: Context, state: GameState, fonts: ShareFinish.Fonts): ShareCard.Body? {
        val g = state.gauntlet ?: return null
        val n = g.totalStages
        val chipH = 124f
        val gap = 16f
        val w = REF_W
        val h = n * chipH + (n - 1) * gap
        return ShareCard.Body(w, h) { c ->
            val name = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.black; color = ShareFinish.INK_HEADING; textSize = 34f }
            val sub = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.bold; color = ShareFinish.INK_LABEL; textSize = 24f }
            var top = 0f
            for (i in 0 until n) {
                // Every configured stage is drawn; one never reached counts as a loss (iOS parity).
                val stage = g.stages.getOrNull(i)
                val res = g.stageResults.firstOrNull { it.stageIndex == (stage?.stageIndex ?: i) }
                val stageWon = res?.status == GameStatus.WON
                val boardCount = stage?.boardCount ?: 0
                val solved = if (stageWon) boardCount else (res?.boardsSnapshot?.count { it.status == GameStatus.WON } ?: 0)
                val rect = RectF(0f, top, w, top + chipH)
                val accent = if (stageWon) 0xFF7C3AED.toInt() else 0xFFE11D48.toInt()
                ShareFinish.drawAccentCard(c, rect, accent, 14f * U, barH = 4f * U, washAmount = 0.12f)
                val t = chipH * 0.62f
                val tr = RectF(rect.left + 20f, rect.centerY() - t / 2f + 4f, rect.left + 20f + t, rect.centerY() + t / 2f + 4f)
                ShareFinish.drawTile(c, tr, if (stageWon) ShareFinish.CORRECT else ShareFinish.ABSENT, "${i + 1}", fonts.black)
                val tx = tr.right + 24f
                val b = chipH * 0.6f
                val maxText = rect.right - 24f - b - 16f - tx
                val stageName = stage?.name ?: "Stage ${i + 1}"
                val line2 = "$solved/$boardCount boards · ${res?.guesses ?: 0} guesses"
                ShareFinish.fitText(name, stageName, maxText); ShareFinish.fitText(sub, line2, maxText)
                c.drawText(stageName, tx, rect.centerY() - 2f, name)
                c.drawText(line2, tx, rect.centerY() + 34f, sub)
                ShareFinish.drawArtInto(context, c, if (stageWon) R.drawable.icon3d_badge_w else R.drawable.icon3d_badge_l,
                    RectF(rect.right - 24f - b, rect.centerY() - b / 2f + 4f, rect.right - 24f, rect.centerY() + b / 2f + 4f))
                name.textSize = 34f; sub.textSize = 24f
                top += chipH + gap
            }
        }
    }

    // ── The word games (Classic, Six, Seven, QuadWord, OctoWord, Succession,
    //    Deliverance, ProperNoundle, Gauntlet) ───────────────────────────────

    /**
     * The result card. wordGroups (ProperNoundle): letters per word. reveal = the
     * "Full results" variant: guessed letters drawn in the tiles and the answer under
     * lost boards; false keeps the spoiler-free card. solutionDisplay overrides the
     * caption text (ProperNoundle display form). [points] = the recorded composite
     * (null = computed here with the record pipeline's own scoring inputs).
     */
    fun render(
        context: Context,
        state: GameState,
        mode: GameMode,
        modeLabel: String,
        elapsedSeconds: Int,
        category: String? = null,
        wordGroups: List<Int>? = null,
        reveal: Boolean = false,
        solutionDisplay: String? = null,
        points: Int? = null,
    ): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val won = state.status == GameStatus.WON
        val board0 = state.boards[0]
        val day = runCatching { getDailySeedDate(state.seed) }.getOrNull()
        val puzzle = day?.let { LeaderboardShare.puzzleNumberForDay(it) }?.let { "#$it" }
        val g = state.gauntlet
        val extras = ArrayList<String>()
        when {
            mode == GameMode.GAUNTLET -> extras += "${g?.stageResults?.count { it.status == GameStatus.WON } ?: 0}/${g?.totalStages ?: 5} stages"
            state.boards.size > 1 -> extras += "${state.boards.count { it.status == GameStatus.WON }}/${state.boards.size} boards"
            else -> extras += "${if (won) "${board0.guesses.size}" else "X"}/${board0.maxGuesses}"
        }
        extras += fmtTime(elapsedSeconds)
        category?.takeIf { it.isNotBlank() }?.let { extras += it }

        val body = when {
            mode == GameMode.GAUNTLET -> gauntletBody(context, state, fonts)
            state.boards.size > 1 -> multiBody(state, reveal, fonts)
            else -> null
        } ?: singleBody(
            board0, max(1, board0.guesses.size), wordGroups, reveal,
            if (reveal && board0.status == GameStatus.LOST) solutionDisplay ?: board0.solution else null, fonts,
        )

        // Stat windows: guesses · time · points.
        val rs = runCatching { GameResultsService.computeRunScore(state, mode) }.getOrNull()
        val guesses = when {
            mode == GameMode.GAUNTLET -> "${rs?.guessCount ?: g?.stageResults?.sumOf { it.guesses } ?: 0}"
            state.boards.size > 1 -> "${state.boards.maxOf { it.guesses.size }}/${board0.maxGuesses}"
            else -> "${if (won) "${board0.guesses.size}" else "X"}/${board0.maxGuesses}"
        }
        val pts = points ?: pointsFor(state, mode, elapsedSeconds, rs)
        val stats = listOfNotNull(
            ShareFinish.Stat(guesses, "GUESSES", ShareFinish.Window.PURPLE),
            ShareFinish.Stat(fmtTime(elapsedSeconds), "TIME", ShareFinish.Window.BLUE),
            pts?.let { ShareFinish.Stat(grouped(it), "POINTS", ShareFinish.Window.GOLD) },
        )
        return ShareCard.render(context, ShareCard.Spec(
            wallpaper = ShareFinish.gameWallpaperForKey(mode.name),
            title = gameTitleArtResForKey(mode.name),
            titleFallback = modeLabel.uppercase(Locale.US),
            info = infoText(day, puzzle, extras),
            badge = won,
            body = body,
            stats = stats,
            hero = ShareHero.result(won),
        )).named(modeLabel)
    }

    /**
     * The composite the record pipeline writes for this finish (GameResultsService
     * computeRunScore + DailyScoring.breakdown, hints read the way the backfill reads
     * them) — the number the post-game score card shows. Null when it can't be computed.
     */
    private fun pointsFor(state: GameState, mode: GameMode, elapsed: Int, rs: GameResultsService.RunScore?): Int? = runCatching {
        val run = rs ?: GameResultsService.computeRunScore(state, mode)
        val hints = if (mode == GameMode.PROPERNOUNDLE) {
            GamePersistence.loadHints(state.seed, mode)?.let { h -> listOf(h.clue, h.vowelRevealed, h.consonantRevealed).count { it != null } } ?: 0
        } else state.boards.firstOrNull()?.hintEvaluations?.size ?: 0
        DailyScoring.breakdown(
            mode.name, run.won, run.guessCount, elapsed, run.boardsSolved, run.totalBoards, hints,
            run.stagesCompleted, run.bestCorrectLetters, getDailySeedDate(state.seed),
        ).total.toInt()
    }.getOrNull()

    /**
     * S1 share the rendered result card — the image only (no hosted /s link, no
     * caption). [text] (the emoji grid) is used only when no PNG can be written.
     * The chooser reads "Share your QuadWord". Signature kept for the callers.
     */
    @Suppress("UNUSED_PARAMETER")
    fun share(
        context: Context, bitmap: Bitmap, text: String,
        state: GameState, mode: GameMode, elapsedSeconds: Int,
        reveal: Boolean = false,
    ) {
        ShareHelper.shareImage(context, bitmap, ShareHelper.modeLabel(mode), fallbackText = text)
    }

    // ── The More Games cards (§18d) — the same card, the game's own spoiler-free body ──

    /**
     * A More Games card: its meta line ("#12 · Medium · 0 mistakes · 3:58") becomes the
     * info line (date, puzzle number, words, time) and the stat windows (the first stat
     * purple, the time blue, the next stat gold).
     */
    private fun moreCard(
        context: Context, dbKey: String, fallbackTitle: String, meta: String, won: Boolean, body: ShareCard.Body,
        statsOverride: ((List<ShareFinish.Stat>) -> List<ShareFinish.Stat>)? = null,
    ): Bitmap {
        val m = SharePicks.parseMeta(meta)
        val windows = listOf(ShareFinish.Window.PURPLE, ShareFinish.Window.BLUE, ShareFinish.Window.GOLD)
        val ordered = ArrayList<Pair<String, String>>()
        m.stats.getOrNull(0)?.let { ordered += it.value to it.label }
        m.time?.let { ordered += it to "TIME" }
        m.stats.drop(1).forEach { ordered += it.value to it.label }
        var stats = ordered.take(3).mapIndexed { i, (v, l) -> ShareFinish.Stat(v, l, windows[i]) }
        statsOverride?.let { stats = it(stats) }
        return ShareCard.render(context, ShareCard.Spec(
            wallpaper = ShareFinish.gameWallpaperForKey(dbKey),
            title = gameTitleArtResForKey(dbKey),
            titleFallback = fallbackTitle,
            info = infoText(null, m.puzzle, m.words + listOfNotNull(m.time)),
            badge = won,
            body = body,
            stats = stats,
            hero = ShareHero.result(won),
        )).named(gameTitle(dbKey, fallbackTitle))
    }

    /** The soft headline under a More Games board (CODE CRACKED, FLAWLESS…): its block height. */
    private const val HEADLINE_H = 96f

    private fun drawHeadline(c: Canvas, fonts: ShareFinish.Fonts, text: String, cx: Float, top: Float, maxW: Float) {
        val p = ShareFinish.softPaint(fonts, 60f)
        p.letterSpacing = 0.02f
        ShareFinish.fitText(p, text, maxW)
        c.textMid(text, cx, top + HEADLINE_H / 2f + 6f, p)
    }

    /** A square board card (tinted in the accent, rose on a loss) at the reference width; [content] draws inside it. */
    private fun squareBody(accent: Int, won: Boolean, content: (Canvas, RectF) -> Unit): ShareCard.Body {
        val side = REF_W
        return ShareCard.Body(side, side) { c ->
            val r = RectF(0f, 0f, side, side)
            if (won) ShareFinish.drawAccentCard(c, r, accent, 18f * U, barH = 4f * U)
            else ShareFinish.drawTintedCard(c, r, 18f * U, 0xFFFFF1F2.toInt(), 0xFFFECDD3.toInt(), intArrayOf(0xFFE11D48.toInt()), 4f * U)
            content(c, r)
        }
    }

    private val HINT_VIOLET = 0xFF8B5CF6.toInt()

    /** Sudoku: the 9 × 9 as glossy squares — givens slate, the player's cells purple,
     *  hint cells violet, the rest frosted. No digits, so the card spoils nothing. */
    fun renderSudoku(context: Context, givens: String, board: String, hintMask: String, won: Boolean, meta: String): Bitmap {
        val body = squareBody(0xFF1E40AF.toInt(), won) { c, card ->
            val pad = card.width() * 0.04f; val gap = card.width() * 0.006f; val boxGap = card.width() * 0.018f
            val cell = (card.width() - pad * 2 - gap * 6 - boxGap * 2) / 9f
            val hint = ShareFinish.family(HINT_VIOLET)
            for (i in 0 until 81) {
                val r = i / 9; val col = i % 9
                val x = card.left + pad + col * (cell + gap) + (col / 3) * (boxGap - gap)
                val y = card.top + pad + 2f * U + r * (cell + gap) + (r / 3) * (boxGap - gap)
                val given = givens.getOrNull(i) != null && givens[i] != '0'
                val filled = board.getOrNull(i) != null && board[i] != '0'
                val hinted = hintMask.getOrNull(i) == '1'
                val look = when { given -> ShareFinish.ABSENT; hinted -> hint; filled -> ShareFinish.CORRECT; else -> ShareFinish.FROSTED }
                ShareFinish.drawTile(c, RectF(x, y, x + cell, y + cell), look)
            }
        }
        return moreCard(context, "SUDOKU", "SUDOCIOUS", meta, won, body)
    }

    /** Starsweep: the regions as soft glossy squares in their tints, the placed stars as
     *  dark dots (hint stars violet) — no crosses, never the missing stars. */
    fun renderRegions(context: Context, n: Int, regions: String, board: String, hintMask: String, won: Boolean, meta: String): Bitmap {
        val body = squareBody(0xFFCA8A04.toInt(), won) { c, card ->
            val count = maxOf(1, n)
            val pad = card.width() * 0.04f; val gap = card.width() * 0.007f
            val cell = (card.width() - pad * 2 - gap * (count - 1)) / count
            val tints = intArrayOf(0xFFDDD6FE.toInt(), 0xFFA7F3D0.toInt(), 0xFFBAE6FD.toInt(), 0xFFFBCFE8.toInt(), 0xFFFEF08A.toInt(),
                0xFF99F6E4.toInt(), 0xFFFED7AA.toInt(), 0xFFD9F99D.toInt(), 0xFFCBD5E1.toInt())
            val dot = Paint(Paint.ANTI_ALIAS_FLAG)
            for (i in 0 until count * count) {
                val r = i / count; val col = i % count
                val x = card.left + pad + col * (cell + gap)
                val y = card.top + pad + 2f * U + r * (cell + gap)
                val gIdx = ((regions.getOrNull(i) ?: '0') - '0').coerceAtLeast(0)
                ShareFinish.drawTile(c, RectF(x, y, x + cell, y + cell), ShareFinish.family(tints[gIdx % tints.size], gloss = 0.5f))
                if (board.getOrNull(i) == '*') {
                    dot.color = if (hintMask.getOrNull(i) == '1') HINT_VIOLET else ShareFinish.INK_HEADING
                    c.drawCircle(x + cell / 2f, y + cell * 0.465f, cell * 0.22f, dot)
                }
            }
        }
        return moreCard(context, "REGIONS", "STARSWEEP", meta, won, body)
    }

    /** Letter Ladder: START glossy purple with letters, END frosted with an accent ring and
     *  letters, every rung frosted with only the changed tile filled (accent; violet for a
     *  hint rung). No rung word is ever drawn. */
    fun renderLadder(context: Context, start: String, end: String, words: List<String>, hintMask: String, won: Boolean, meta: String): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val accent = 0xFF0284C7.toInt()
        val list = if (words.isEmpty()) listOf(start) else words
        data class Rw(val word: String, val prev: String?, val kind: String)
        val rows = ArrayList<Rw>()
        list.forEachIndexed { i, w -> rows.add(Rw(w, if (i > 0) list[i - 1] else null, if (i == 0) "start" else if (hintMask.getOrNull(i) == '1') "hint" else "rung")) }
        if (list.last() != end) rows.add(Rw(end, null, "end"))
        val cols = 5
        val gap = T * 0.12f
        val boardW = T * cols + gap * (cols - 1); val boardH = T * rows.size + gap * (rows.size - 1)
        val body = ShareCard.Body(boardW, boardH) { c ->
            val rung = ShareFinish.family(accent); val hint = ShareFinish.family(HINT_VIOLET)
            val endLook = ShareFinish.frostedRing(accent)
            rows.forEachIndexed { r, row ->
                for (col in 0 until cols) {
                    val x = col * (T + gap); val y = r * (T + gap)
                    val rect = RectF(x, y, x + T, y + T)
                    val ch = row.word.getOrNull(col)?.uppercaseChar()?.toString() ?: ""
                    val changed = row.prev != null && row.prev.getOrNull(col) != row.word.getOrNull(col)
                    when (row.kind) {
                        "start" -> ShareFinish.drawTile(c, rect, ShareFinish.CORRECT, ch, fonts.black)
                        "end" -> ShareFinish.drawTile(c, rect, endLook, ch, fonts.black)
                        else -> ShareFinish.drawTile(c, rect, if (changed) (if (row.kind == "hint") hint else rung) else ShareFinish.FROSTED)
                    }
                }
            }
        }
        return moreCard(context, "LADDER", "LETTER LADDER", meta, won, body)
    }

    /** Spyglass: a dot grid with the found words as accent capsules along their lines — no letters. */
    fun renderWordsearch(context: Context, n: Int, words: List<com.wordocious.core.WordsearchPlacement>, found: List<String>, won: Boolean, meta: String): Bitmap {
        val accent = 0xFF4D7C0F.toInt()
        val body = squareBody(accent, won) { c, card ->
            val count = maxOf(1, n)
            val pad = card.width() * 0.05f
            val cell = (card.width() - pad * 2) / count
            val capsule = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = cell * 0.72f; strokeCap = Paint.Cap.ROUND; color = (0x77 shl 24) or (accent and 0xFFFFFF) }
            fun center(r: Int, col: Int) = Pair(card.left + pad + (col + 0.5f) * cell, card.top + pad + 2f * U + (r + 0.5f) * cell)
            for (w in words) if (w.w in found) {
                val (dr, dc) = com.wordocious.core.WORDSEARCH_DIRS[w.d] ?: (0 to 1)
                val (ax, ay) = center(w.r, w.c); val (bx, by) = center(w.r + dr * (w.w.length - 1), w.c + dc * (w.w.length - 1))
                c.drawLine(ax, ay, bx, by, capsule)
            }
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFB9A3F0.toInt() }
            for (r in 0 until count) for (col in 0 until count) { val (px, py) = center(r, col); c.drawCircle(px, py, cell * 0.12f, fill) }
        }
        return moreCard(context, "WORDSEARCH", "SPYGLASS", meta, won, body)
    }

    /** Hubbub: the 2-3-2 silhouette (center glossy in the accent, the rest frosted), the rank name in soft type. No letters. */
    fun renderHub(context: Context, rankName: String, pct: Int, won: Boolean, meta: String): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val accent = 0xFFC026D3.toInt()
        val tile = 150f
        val gap = tile * 0.12f
        val clusterH = tile * 3 + gap * 2
        val rankH = 110f
        val w = 720f
        val body = ShareCard.Body(w, clusterH + rankH, widthFrac = 0.66f) { c ->
            val center = ShareFinish.family(accent)
            listOf(2, 3, 2).forEachIndexed { r, k ->
                val rowW = k * tile + (k - 1) * gap
                for (i in 0 until k) {
                    val x = w / 2f - rowW / 2f + i * (tile + gap); val y = r * (tile + gap)
                    ShareFinish.drawTile(c, RectF(x, y, x + tile, y + tile), if (r == 1 && i == 1) center else ShareFinish.FROSTED)
                }
            }
            val p = ShareFinish.softPaint(fonts, 76f)
            ShareFinish.fitText(p, rankName.uppercase(), w)
            c.textMid(rankName.uppercase(), w / 2f, clusterH + rankH / 2f + 10f, p)
        }
        val windows = listOf(ShareFinish.Window.PURPLE, ShareFinish.Window.BLUE, ShareFinish.Window.GOLD)
        return moreCard(context, "HUB", "HUBBUB", meta, won, body) { stats ->
            // The % of the maximum is a stat window when the meta line doesn't carry it.
            val withPct = if (stats.any { it.label == "OF MAX" }) stats
                else (listOf(ShareFinish.Stat("$pct%", "OF MAX", ShareFinish.Window.PURPLE)) + stats).take(3)
            withPct.mapIndexed { i, s -> s.copy(window = windows[i]) }
        }
    }

    /** Codebreaker: the CIPHERTEXT only — frosted cells with the code letter beneath each,
     *  words wrapped whole, no plain letters (no spoilers). */
    fun renderCryptogram(context: Context, cipher: String, checks: Int, won: Boolean, meta: String): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val words = cipher.split(" ").filter { it.isNotEmpty() }
        val maxRowW = REF_W
        fun widthOf(w: String, cell: Float, gap: Float): Float =
            w.sumOf { ch -> (if (ch in 'A'..'Z') cell + gap else cell * 0.45f + gap).toDouble() }.toFloat() - gap
        // The biggest cell (≤ 84) at which every word fits a row; then a greedy wrap.
        var cell = 84f
        while (cell > 20f && words.any { widthOf(it, cell, cell * 0.12f) > maxRowW }) cell -= 4f
        val gap = cell * 0.12f; val wordGap = cell * 0.7f
        val lineH = cell * 1.14f + cell * 0.42f + cell * 0.3f
        val lines = ArrayList<MutableList<String>>(); var cur = ArrayList<String>(); var curW = 0f
        for (w in words) {
            val ww = widthOf(w, cell, gap)
            if (cur.isNotEmpty() && curW + wordGap + ww > maxRowW) { lines.add(cur); cur = ArrayList(); curW = 0f }
            curW += (if (cur.isEmpty()) 0f else wordGap) + ww; cur.add(w)
        }
        if (cur.isNotEmpty()) lines.add(cur)
        val gridH = max(1, lines.size) * lineH
        val body = ShareCard.Body(REF_W, gridH + HEADLINE_H) { c ->
            val cellH = cell * 1.14f
            var y = 0f
            val code = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD); textSize = cell * 0.36f; color = ShareFinish.INK_LABEL }
            val punct = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = fonts.black; textSize = cell * 0.6f; color = ShareFinish.INK_HEADING }
            for (line in lines) {
                val lineW = line.sumOf { widthOf(it, cell, gap).toDouble() }.toFloat() + (line.size - 1) * wordGap
                var x = REF_W / 2f - lineW / 2f
                for ((wi, w) in line.withIndex()) {
                    for (ch in w) {
                        if (ch in 'A'..'Z') {
                            ShareFinish.drawTile(c, RectF(x, y, x + cell, y + cellH), ShareFinish.FROSTED)
                            c.drawText(ch.toString(), x + cell / 2f, y + cellH + cell * 0.38f, code)
                            x += cell + gap
                        } else {
                            val pw = cell * 0.45f
                            c.drawText(ch.toString(), x + pw / 2f, y + cellH - cell * 0.2f, punct)
                            x += pw + gap
                        }
                    }
                    if (wi < line.size - 1) x += wordGap - gap
                }
                y += lineH
            }
            drawHeadline(c, fonts, if (won) "CODE CRACKED" else "ANSWER REVEALED", REF_W / 2f, gridH, REF_W)
        }
        return moreCard(context, "CRYPTOGRAM", "CODEBREAKER", meta, won, body)
    }

    /** Kindred: four glossy tier bars in solve order (one to four pips), the unsolved tiers
     *  dashed beneath on a loss, then the four mistake dots. No words (no spoilers). */
    fun renderGroups(context: Context, solvedTiers: List<Int>, mistakes: Int, maxMistakes: Int, won: Boolean, meta: String): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val accent = 0xFF9F1239.toInt()
        // Tier ramp — one hue, four lightnesses, plus pips (never color alone).
        val tierBg = mapOf(1 to 0xFFDDD6FE.toInt(), 2 to 0xFFA78BFA.toInt(), 3 to 0xFF7C3AED.toInt(), 4 to 0xFF2A1650.toInt())
        val tierFg = mapOf(1 to 0xFF3B0764.toInt(), 2 to 0xFF1A1A2E.toInt(), 3 to 0xFFFFFFFF.toInt(), 4 to 0xFFFFFFFF.toInt())
        val solved = solvedTiers.filter { it in 1..4 }.distinct()
        val unsolved = (1..4).filter { it !in solved }
        val rows = max(1, solved.size + (if (won) 0 else unsolved.size))
        val dotsH = 64f; val barGap = 22f; val barH = 116f
        val barW = REF_W - 60f
        val blockH = rows * barH + (rows - 1) * barGap + dotsH
        val body = ShareCard.Body(REF_W, blockH + HEADLINE_H) { c ->
            var y = 0f
            val pip = Paint(Paint.ANTI_ALIAS_FLAG)
            fun drawPips(tier: Int, cy: Float, color: Int) {
                val r = 12f; val gap = 17f
                val total = tier * 2 * r + (tier - 1) * gap
                var x = REF_W / 2f - total / 2f + r
                pip.color = color
                repeat(tier) { c.drawCircle(x, cy, r, pip); x += 2 * r + gap }
            }
            for (t in solved) {
                val rect = RectF(REF_W / 2f - barW / 2f, y, REF_W / 2f + barW / 2f, y + barH)
                drawBar(c, rect, ShareFinish.family(tierBg[t]!!, gloss = 0.45f))
                drawPips(t, rect.top + rect.height() * 0.465f, tierFg[t]!!)
                y += barH + barGap
            }
            if (!won) for (t in unsolved) {
                val rect = RectF(REF_W / 2f - barW / 2f, y, REF_W / 2f + barW / 2f, y + barH)
                val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = (0x40 shl 24) or (tierBg[t]!! and 0xFFFFFF) }
                c.drawRoundRect(rect, barH * 0.22f, barH * 0.22f, fill)
                ShareFinish.drawDashed(c, rect, barH * 0.22f, tierBg[t]!!, 5f)
                drawPips(t, rect.centerY(), tierBg[t]!!)
                y += barH + barGap
            }
            run {
                val r = 14f; val gap = 24f
                val total = maxMistakes * 2 * r + (maxMistakes - 1) * gap
                var x = REF_W / 2f - total / 2f + r
                val cy = y + dotsH / 2f - barGap / 2f
                for (i in 0 until maxMistakes) {
                    pip.color = if (i < maxMistakes - mistakes) accent else 0xFFC9BEDD.toInt()
                    c.drawCircle(x, cy, r, pip); x += 2 * r + gap
                }
            }
            drawHeadline(c, fonts, if (won) (if (mistakes == 0) "FLAWLESS" else "ALL FOUR GROUPS") else "OUT OF MISTAKES", REF_W / 2f, blockH, REF_W)
        }
        return moreCard(context, "GROUPS", "KINDRED", meta, won, body)
    }

    /** A glossy bar: the tile recipe with a bar's proportions (lip, gradient face, gloss). */
    private fun drawBar(c: Canvas, r: RectF, look: ShareFinish.Look) {
        val rad = r.height() * 0.22f
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.color = look.edge; c.drawRoundRect(r, rad, rad, p)
        val face = RectF(r.left, r.top, r.right, r.bottom - r.height() * 0.07f)
        p.shader = android.graphics.LinearGradient(0f, face.top, 0f, face.bottom, intArrayOf(look.top, look.mid, look.bottom), floatArrayOf(0f, 0.7f, 1f), android.graphics.Shader.TileMode.CLAMP)
        c.drawRoundRect(face, rad, rad, p)
        val g = RectF(r.left + rad, r.top + r.height() * 0.06f, r.right - rad, r.top + r.height() * 0.44f)
        p.shader = android.graphics.LinearGradient(0f, g.top, 0f, g.bottom, ((look.gloss * 255).toInt() shl 24) or 0xFFFFFF, 0x00FFFFFF, android.graphics.Shader.TileMode.CLAMP)
        c.drawRoundRect(g, rad * 0.8f, rad * 0.8f, p)
    }

    /** Crosswordocious: the grid silhouette only — a glossy tile wherever a letter belongs
     *  (purple finished, slate revealed), nothing where a block is. No letters, no numbers. */
    fun renderCrossword(context: Context, w: Int, h: Int, solution: String, checks: Int, won: Boolean, meta: String): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val cols = maxOf(1, w); val rows = maxOf(1, h)
        val gap = T * 0.08f
        val blockW = cols * T + (cols - 1) * gap
        val blockH = rows * T + (rows - 1) * gap
        val headH = blockW * HEADLINE_H / REF_W
        val body = ShareCard.Body(blockW, blockH + headH) { c ->
            val look = if (won) ShareFinish.CORRECT else ShareFinish.ABSENT
            for (r in 0 until rows) for (col in 0 until cols) {
                val i = r * cols + col
                if (i >= solution.length || solution[i] == '.') continue
                val x = col * (T + gap); val y = r * (T + gap)
                ShareFinish.drawTile(c, RectF(x, y, x + T, y + T), look)
            }
            c.save(); c.translate(0f, blockH); c.scale(blockW / REF_W, blockW / REF_W)
            drawHeadline(c, fonts, if (won) "GRID FINISHED" else "PUZZLE REVEALED", REF_W / 2f, 0f, REF_W)
            c.restore()
        }
        return moreCard(context, "CROSSWORD", "CROSSWORDOCIOUS", meta, won, body)
    }

    /** Muddle: four rows of frosted tiles on one six-column grid with the circled positions
     *  ringed in purple, a divider, then the punchline row grouped by word on lilac-washed
     *  tiles with purple rings — no letters, no cartoon (no spoilers). */
    fun renderScramble(
        context: Context, wordLengths: List<Int>, circled: List<List<Int>>, pattern: List<Int>,
        checks: Int, solvedCount: Int, won: Boolean, meta: String,
    ): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val ring = 0xFF7C3AED.toInt()
        val tile = 120f
        val gap = tile * 0.11f; val rowGapT = tile * 0.24f; val cols = 6
        val boardW = cols * tile + (cols - 1) * gap
        val small = floor(tile * 0.78f)
        val sGap = tile * 0.065f; val wordGap = tile * 0.28f
        val totalLetters = pattern.sum()
        val punchW = totalLetters * small + (totalLetters - pattern.size).coerceAtLeast(0) * sGap + (pattern.size - 1).coerceAtLeast(0) * wordGap
        val w = max(boardW, punchW)
        val divider = tile * 0.42f
        val boardH = wordLengths.size * tile + (wordLengths.size - 1).coerceAtLeast(0) * rowGapT
        val headH = w * HEADLINE_H / REF_W
        val body = ShareCard.Body(w, boardH + divider + small + headH) { c ->
            val x0 = w / 2f - boardW / 2f
            var y = 0f
            val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = tile * 0.045f; color = ring }
            for ((wi, len) in wordLengths.withIndex()) {
                val rings = circled.getOrNull(wi) ?: emptyList()
                for (i in 0 until len.coerceAtMost(cols)) {
                    val x = x0 + i * (tile + gap)
                    ShareFinish.drawTile(c, RectF(x, y, x + tile, y + tile), ShareFinish.FROSTED)
                    if (i in rings) c.drawCircle(x + tile / 2f, y + tile * 0.465f, tile * 0.32f, ringPaint)
                }
                y += tile + rowGapT
            }
            y = boardH + divider / 2f
            c.drawLine(x0, y, x0 + boardW, y, Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeWidth = tile * 0.035f; color = 0x557C3AED })
            y = boardH + divider
            var x = w / 2f - punchW / 2f
            ringPaint.strokeWidth = tile * 0.035f
            val lilac = ShareFinish.family(0xFFDDD6FE.toInt(), gloss = 0.5f)
            for (len in pattern) {
                for (i in 0 until len) {
                    ShareFinish.drawTile(c, RectF(x, y, x + small, y + small), lilac)
                    c.drawCircle(x + small / 2f, y + small * 0.465f, small * 0.3f, ringPaint)
                    x += small + sGap
                }
                x += wordGap - sGap
            }
            c.save(); c.translate(0f, boardH + divider + small); c.scale(w / REF_W, w / REF_W)
            drawHeadline(c, fonts, if (won) "MUDDLE SOLVED" else "OUT OF CHECKS", REF_W / 2f, 0f, REF_W)
            c.restore()
        }
        return moreCard(context, "SCRAMBLE", "MUDDLE", meta, won, body)
    }

    /**
     * S1 share a rendered More Games card — the image only. [text] is used only when no
     * PNG can be written. The chooser + file are named for the card's game.
     */
    fun shareBitmap(context: Context, bitmap: Bitmap, text: String) {
        val game = synchronized(gameOf) { gameOf[bitmap] } ?: "result"
        ShareHelper.shareImage(context, bitmap, game, fallbackText = text)
    }

    // ── VS result card ─────────────────────────────────────────────────────────

    data class VsShareSide(
        val name: String,
        val score: Double,
        val won: Boolean,
        val solved: Boolean,
        /** Per board: rows of tile states (colors only — no daily-VS spoilers). */
        val grids: List<List<List<TileState>>>,
        /** BJ5: whose avatar heads the side (the shared resolver; "bot:<id>" = the bot's art). */
        val userId: String? = null,
        val avatarUrl: String? = null,
        /** The username behind [name] (the side's label may be "You" / "X · Bot"). */
        val username: String? = null,
    )

    /**
     * VS result share card (head to head, fitted): the VS wallpaper, the battle's mode
     * title art, the info line (date · VS BATTLE + the W / L badge), a tinted Victory /
     * Defeat / Draw pill, then each side — crown, name, soft score, solved line and up to
     * two boards as glossy tiles on tinted cards (one shared grid size) — and the cast
     * wordmark.
     */
    fun renderVs(
        context: Context, modeLabel: String, accent: Int,
        isWin: Boolean, isDraw: Boolean, me: VsShareSide, opp: VsShareSide,
        /** The battle's mode db key, for its title art. */
        modeKey: String? = null,
    ): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val allShown = me.grids.take(2) + opp.grids.take(2)
        val sharedRows = maxOf(1, allShown.maxOfOrNull { it.size } ?: 1)
        val sharedCols = maxOf(1, allShown.maxOfOrNull { it.firstOrNull()?.size ?: 5 } ?: 5)
        val multiBoard = me.grids.size > 1 || opp.grids.size > 1
        val shownN = minOf(maxOf(me.grids.size, opp.grids.size), 2).coerceAtLeast(1)
        val boardSide = if (multiBoard) 330f else 410f
        val cardH = vsCardH(boardSide, sharedRows, sharedCols)
        val pillH = 58f
        val blockTop = pillH + 26f
        // BJ5: each side's resolved avatar (~72 px) heads the side, the crown above it.
        val avatarPx = 72f
        val avatarShift = avatarPx - 10f
        val headerH = 212f + avatarShift
        val boardsTop = blockTop + headerH
        val boardsH = cardH * shownN + 16f * (shownN - 1)
        val more = if (me.grids.size > 2 || opp.grids.size > 2) 44f else 0f
        val w = REF_W
        val body = ShareCard.Body(w, boardsTop + boardsH + more) { c ->
            val cx = w / 2f
            // Victory / Defeat / Draw pill (tinted, A1).
            run {
                val label = if (isDraw) "DRAW" else if (isWin) "VICTORY" else "DEFEAT"
                val win = if (isDraw) ShareFinish.Window.GOLD else if (isWin) ShareFinish.Window.PURPLE else ShareFinish.Window.ROSE
                val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = fonts.black; textSize = 28f; color = win.label; letterSpacing = 0.12f }
                val tw = p.measureText(label)
                val rect = RectF(cx - tw / 2 - 34f, 0f, cx + tw / 2 + 34f, pillH)
                ShareFinish.drawTintedCard(c, rect, pillH / 2f, win.tint, win.line, win.bar, 8f, shadow = 0x143C1E6E, shadowDy = 6f, shadowBlur = 16f)
                c.textMid(label, cx, rect.centerY() + 3f, p)
            }
            fun side(s: VsShareSide, scx: Float) {
                val avTop = blockTop + 40f
                runCatching {
                    ShareAvatars.draw(context, c, scx - avatarPx / 2f, avTop, avatarPx, s.userId, s.username ?: s.name, s.avatarUrl)
                }
                if (s.won && !isDraw) {
                    val cw = 48f
                    ShareFinish.drawArtInto(context, c, R.drawable.icon3d_crown, RectF(scx - cw / 2f, blockTop - 4f, scx + cw / 2f, blockTop - 4f + cw))
                }
                var y = blockTop + 48f + 38f + avatarShift
                val name = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = fonts.black; textSize = 36f; color = ShareFinish.INK_HEADING; ShareFinish.softShadow(this) }
                ShareFinish.fitText(name, s.name, w * 0.42f)
                c.drawText(s.name, scx, y, name)
                y += 72f
                val score = ShareFinish.softPaint(fonts, 66f, color = if (s.won || isDraw) ShareFinish.INK_SOFT else ShareFinish.INK_MUTED)
                c.drawText("%.2f".format(s.score), scx, y, score)
                y += 40f
                val solved = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = fonts.black; textSize = 24f; letterSpacing = 0.08f
                    color = if (s.solved) 0xFF6D28D9.toInt() else 0xFFBE123C.toInt() }
                c.drawText(if (s.solved) "SOLVED" else "NOT SOLVED", scx, y, solved)
                var by = boardsTop
                for (grid in s.grids.take(2)) {
                    by += drawVsBoard(c, grid, scx, by, boardSide, s.won, sharedRows, sharedCols) + 16f
                }
                if (s.grids.size > 2) {
                    val m = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = fonts.bold; textSize = 24f; color = ShareFinish.INK_LABEL }
                    c.drawText("+${s.grids.size - 2} more", scx, by + 18f, m)
                }
            }
            side(me, w * 0.25f)
            side(opp, w * 0.75f)
            // VS between the two boards.
            c.textMid("VS", cx, boardsTop + boardsH / 2f, ShareFinish.softPaint(fonts, 56f))
        }
        val label = if (modeLabel.startsWith("VS ")) modeLabel else "VS $modeLabel"
        return ShareCard.render(context, ShareCard.Spec(
            wallpaper = PageTint.VS.wallpaperRes(),
            title = gameTitleArtResForKey(modeKey) ?: R.drawable.art_title_vs,
            titleFallback = label.uppercase(Locale.US),
            info = "${ShareFinish.dayCaps(null)} · VS BATTLE",
            badge = if (isDraw) null else isWin,
            body = body,
        )).named(label)
    }

    /** A VS board card's height for a [maxSide] square budget (shared rows / cols). */
    private fun vsCardH(maxSide: Float, rows: Int, cols: Int): Float {
        val pad = maxSide * 0.05f
        val gap = maxSide * 0.012f + 2f
        val inner = maxSide - pad * 2
        val tile = minOf((inner - gap * (cols - 1)) / cols, (inner - gap * (rows - 1)) / rows)
        return tile * rows + gap * (rows - 1) + pad * 2
    }

    /** A VS board as glossy tiles on a tinted card (shared rows / cols; short grids frosted). Returns its height. */
    private fun drawVsBoard(c: Canvas, grid: List<List<TileState>>, scx: Float, top: Float, maxSide: Float, won: Boolean, rows: Int, cols: Int): Float {
        val pad = maxSide * 0.05f
        val gap = maxSide * 0.012f + 2f
        val inner = maxSide - pad * 2
        val tile = minOf((inner - gap * (cols - 1)) / cols, (inner - gap * (rows - 1)) / rows)
        val cardW = tile * cols + gap * (cols - 1) + pad * 2
        val cardH = tile * rows + gap * (rows - 1) + pad * 2
        val x = scx - cardW / 2
        val (tint, line) = if (won) 0xFFF5EEFF.toInt() to 0xFFE2D3FF.toInt() else 0xFFFFF1F2.toInt() to 0xFFFECDD3.toInt()
        ShareFinish.drawTintedCard(c, RectF(x, top, x + cardW, top + cardH), 14f * U / 1.5f, tint, line, shadow = 0x143C1E6E, shadowDy = 6f, shadowBlur = 16f)
        for (r in 0 until rows) for (col in 0 until cols) {
            val tx = x + pad + col * (tile + gap)
            val ty = top + pad + r * (tile + gap)
            ShareFinish.drawTile(c, RectF(tx, ty, tx + tile, ty + tile), ShareFinish.lookFor(grid.getOrNull(r)?.getOrNull(col) ?: TileState.EMPTY))
        }
        return cardH
    }

    /** S1 share the VS card — the image only; [text] only when no PNG can be written. */
    fun shareVs(context: Context, bitmap: Bitmap, text: String) {
        val game = synchronized(gameOf) { gameOf[bitmap] } ?: "VS battle"
        ShareHelper.shareImage(context, bitmap, game.removePrefix("VS ").let { "VS $it" }, fallbackText = text,
            chooserTitle = "Share your VS battle")
    }
}
