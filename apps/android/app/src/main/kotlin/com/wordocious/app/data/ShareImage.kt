package com.wordocious.app.data

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import com.wordocious.app.R
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Share-image renderer — Android port of web lib/share-image.ts (and iOS
 * ShareCardView): a 1080×1080 (1080×1350 for OctoWord/Gauntlet) PNG with the
 * WORDOCIOUS gradient wordmark, mode label, stats line + Win/Loss pill,
 * the evaluated board(s) as colored tile grids, and a wordocious.com footer.
 *
 * Exact web palette: bg #f8f7ff; tiles CORRECT #16a34a / PRESENT #eab308 /
 * ABSENT #9ca3af / EMPTY #e5e7eb (border #d1d5db); wordmark gradient
 * #a78bfa→#ec4899; win pill #dcfce7/#16a34a, loss #fee2e2/#dc2626; board card
 * tints green-50/red-50; tile radius 12% of size; card radius 18, border 3.
 */
object ShareImage {
    private const val W = 1080

    private val TILE = mapOf(
        TileState.CORRECT to 0xFF7C3AED.toInt(),
        TileState.PRESENT to 0xFFF59E0B.toInt(),
        TileState.HINT_USED to 0xFFF59E0B.toInt(),
        TileState.ABSENT to 0xFF9CA3AF.toInt(),
        TileState.EMPTY to 0xFFE5E7EB.toInt(),
    )
    private const val EMPTY_BORDER = 0xFFD1D5DB.toInt()
    private const val BG = 0xFFF8F7FF.toInt()
    private const val TEXT_MUTED = 0xFF6B7280.toInt()
    private const val FOOT = 0xFF9CA3AF.toInt()

    private fun accentFor(mode: GameMode): Int = when (mode) {
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

    private fun nunito(context: Context, black: Boolean): Typeface {
        val base = ResourcesCompat.getFont(context, R.font.nunito) ?: Typeface.DEFAULT
        return Typeface.create(base, if (black) Typeface.BOLD else Typeface.NORMAL)
    }

    private fun fmtTime(secs: Int): String = "%d:%02d".format(secs / 60, secs % 60)

    /** Render the share card. wordGroups (ProperNoundle): letters per word. */
    fun render(
        context: Context,
        state: GameState,
        mode: GameMode,
        modeLabel: String,
        elapsedSeconds: Int,
        category: String? = null,
        wordGroups: List<Int>? = null,
    ): Bitmap {
        val height = if (mode == GameMode.OCTORDLE || mode == GameMode.GAUNTLET) 1350 else 1080
        val bmp = Bitmap.createBitmap(W, height, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(BG)

        val black = nunito(context, true)
        val bold = nunito(context, false)
        val won = state.status == GameStatus.WON
        val accent = accentFor(mode)

        // ── Header (web drawHeader: wordmark@72, mode@+60, meta@+48) ─────────────
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
        val cx = W / 2f

        p.typeface = black; p.textSize = 56f; p.isFakeBoldText = true
        p.shader = LinearGradient(cx - 200f, 0f, cx + 200f, 0f, 0xFFA78BFA.toInt(), 0xFFEC4899.toInt(), Shader.TileMode.CLAMP)
        c.drawText("WORDOCIOUS", cx, 92f, p)
        p.shader = null

        p.textSize = 38f; p.color = accent
        c.drawText(modeLabel.uppercase(), cx, 152f, p)

        val board0 = state.boards[0]
        val date = SimpleDateFormat("MMM d", Locale.US).format(Date())
        val meta = when {
            mode == GameMode.GAUNTLET -> {
                val g = state.gauntlet
                val cleared = g?.currentStage?.let { if (won) g.totalStages else it } ?: 0
                val totalGuesses = state.boards.sumOf { it.guesses.size }
                "$cleared/${g?.totalStages ?: 5} stages · $totalGuesses guesses · ${fmtTime(elapsedSeconds)} · $date"
            }
            state.boards.size > 1 -> {
                val solved = state.boards.count { it.status == GameStatus.WON }
                "$solved/${state.boards.size} boards · ${board0.guesses.size}/${board0.maxGuesses} · ${fmtTime(elapsedSeconds)} · $date"
            }
            else -> "${if (won) "${board0.guesses.size}" else "X"}/${board0.maxGuesses} · ${fmtTime(elapsedSeconds)} · $date"
        }
        p.typeface = bold; p.isFakeBoldText = true; p.textSize = 24f; p.color = TEXT_MUTED
        c.drawText(meta, cx, 200f, p)

        // Win/Loss pill (web: 22px label, padX 16 padY 8, radius 10)
        var headerBottom = 218f
        run {
            p.textSize = 22f
            val label = if (won) "Win" else "Loss"
            val tw = p.measureText(label)
            val pillW = tw + 32f; val pillH = 38f
            val rect = RectF(cx - pillW / 2, headerBottom, cx + pillW / 2, headerBottom + pillH)
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = (if (won) 0xFFF5F3FF else 0xFFFEE2E2).toInt() }
            c.drawRoundRect(rect, 10f, 10f, fill)
            p.color = (if (won) 0xFF7C3AED else 0xFFDC2626).toInt()
            c.drawText(label, cx, rect.centerY() + 8f, p)
            headerBottom = rect.bottom + 14f
        }
        // ProperNoundle category pill (web: 18px white on accent, radius 14)
        if (category != null) {
            p.textSize = 18f
            val label = category.replaceFirstChar { it.uppercase() }
            val tw = p.measureText(label)
            val rect = RectF(cx - tw / 2 - 14f, headerBottom, cx + tw / 2 + 14f, headerBottom + 32f)
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent }
            c.drawRoundRect(rect, 14f, 14f, fill)
            p.color = Color.WHITE
            c.drawText(label, cx, rect.centerY() + 6f, p)
            headerBottom = rect.bottom + 14f
        }

        // ── Board area (between header and footer) ──────────────────────────────
        val areaTop = headerBottom + 16f
        val areaBottom = height - 80f
        when {
            mode == GameMode.GAUNTLET -> drawGauntlet(c, p, state, areaTop, areaBottom, black)
            state.boards.size > 1 -> drawMulti(c, state, areaTop, areaBottom)
            else -> drawBoardCard(
                c, board0, cx, (areaTop + areaBottom) / 2,
                maxW = W - 200f, maxH = areaBottom - areaTop,
                won = if (board0.status == GameStatus.PLAYING) null else board0.status == GameStatus.WON,
                wordGroups = wordGroups,
            )
        }

        // ── Footer ───────────────────────────────────────────────────────────────
        p.typeface = bold; p.isFakeBoldText = true; p.textSize = 22f; p.color = FOOT
        c.drawText("wordocious.com", cx, height - 40f, p)
        return bmp
    }

    /**
     * One board as a tile grid centered at (cx, cy) — ports web drawBoardCard:
     * cardPad 12 + 3px border when won != null, gap 4, tile radius 12% of size,
     * ProperNoundle two-pass wordGroups gaps (groupGap = max(4·gap, tileSize)).
     */
    private fun drawBoardCard(
        c: Canvas, board: BoardState, cx: Float, cy: Float,
        maxW: Float, maxH: Float, won: Boolean?, wordGroups: List<Int>? = null,
    ) {
        val gap = 4f
        val cardPad = if (won != null) 12f else 0f
        val borderW = if (won != null) 3f else 0f
        val cols = board.solution.length
        val rows = board.maxGuesses
        val innerMaxW = maxW - 2 * (cardPad + borderW)
        val innerMaxH = maxH - 2 * (cardPad + borderW)

        // Two-pass sizing for word-group gaps (ProperNoundle multi-word names).
        val groups = wordGroups?.takeIf { it.size > 1 && it.sum() == cols }
        var tile = floor(min((innerMaxW - gap * (cols - 1)) / cols, (innerMaxH - gap * (rows - 1)) / rows))
        var groupGap = 0f
        var extraGroupWidth = 0f
        if (groups != null) {
            groupGap = max(gap * 4, tile)
            extraGroupWidth = (groups.size - 1) * (groupGap - gap)
            tile = floor(min((innerMaxW - gap * (cols - 1) - extraGroupWidth) / cols, (innerMaxH - gap * (rows - 1)) / rows))
        }
        val totalW = cols * tile + gap * (cols - 1) + extraGroupWidth
        val totalH = rows * tile + gap * (rows - 1)
        val left = cx - totalW / 2
        val top = cy - totalH / 2

        // Card frame (win/loss tint + border)
        if (won != null) {
            val frame = RectF(
                left - cardPad - borderW, top - cardPad - borderW,
                left + totalW + cardPad + borderW, top + totalH + cardPad + borderW,
            )
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = (if (won) 0xFFF5F3FF else 0xFFFEF2F2).toInt() }
            c.drawRoundRect(frame, 18f, 18f, fill)
            val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = borderW
                color = (if (won) 0xFF7C3AED else 0xFFDC2626).toInt()
            }
            c.drawRoundRect(frame, 18f, 18f, stroke)
        }

        // Group-boundary x offsets
        val boundaries = groups?.runningReduce { acc, n -> acc + n }?.dropLast(1)?.toSet() ?: emptySet()

        val tilePaint = Paint(Paint.ANTI_ALIAS_FLAG)
        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
        val radius = max(4f, tile * 0.12f)
        for (r in 0 until rows) {
            val guess = board.guesses.getOrNull(r)
            val eval = guess?.let { evaluateGuess(board.solution, it) }
            var x = left
            for (col in 0 until cols) {
                if (col in boundaries) x += groupGap - gap
                val y = top + r * (tile + gap)
                val rect = RectF(x, y, x + tile, y + tile)
                val st = eval?.tiles?.getOrNull(col)?.state ?: TileState.EMPTY
                tilePaint.color = TILE[st] ?: TILE[TileState.EMPTY]!!
                c.drawRoundRect(rect, radius, radius, tilePaint)
                if (st == TileState.EMPTY) {
                    strokePaint.color = EMPTY_BORDER
                    strokePaint.strokeWidth = max(1f, tile * 0.025f)
                    c.drawRoundRect(rect, radius, radius, strokePaint)
                }
                x += tile + gap
            }
        }
    }

    /** Multi-board grid — web drawMulti: 2×2 (≤4 boards) or 4×2, rowGap 20 colGap 16. */
    private fun drawMulti(c: Canvas, state: GameState, areaTop: Float, areaBottom: Float) {
        val boards = state.boards
        val cols = if (boards.size <= 4) 2 else 4
        val rows = (boards.size + cols - 1) / cols
        val rowGap = 20f; val colGap = 16f
        val padV = 32f; val minPadH = 40f
        val areaH = areaBottom - areaTop - 2 * padV
        val cellH = (areaH - rowGap * (rows - 1)) / rows
        val cellW = (W - 2 * minPadH - colGap * (cols - 1)) / cols
        boards.forEachIndexed { i, b ->
            val r = i / cols; val col = i % cols
            val cx = minPadH + col * (cellW + colGap) + cellW / 2
            val cy = areaTop + padV + r * (cellH + rowGap) + cellH / 2
            drawBoardCard(
                c, b, cx, cy, maxW = cellW, maxH = cellH,
                won = if (b.status == GameStatus.PLAYING) false else b.status == GameStatus.WON,
            )
        }
    }

    /** Gauntlet — web drawGauntlet: one chip per stage with ✓/✗, name, stats. */
    private fun drawGauntlet(c: Canvas, p: Paint, state: GameState, areaTop: Float, areaBottom: Float, black: Typeface) {
        val g = state.gauntlet ?: return
        val n = g.totalStages
        val padH = 100f; val gap = 20f
        val chipH = floor((areaBottom - areaTop - gap * (n - 1)) / n)
        val won = state.status == GameStatus.WON
        for (i in 0 until n) {
            val top = areaTop + i * (chipH + gap)
            val rect = RectF(padH, top, W - padH, top + chipH)
            val reached = i <= g.currentStage
            val stageWon = i < g.currentStage || (i == g.currentStage && won)
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = (if (!reached) 0xFFF3F4F6 else if (stageWon) 0xFFF5F3FF else 0xFFFEF2F2).toInt()
            }
            c.drawRoundRect(rect, 18f, 18f, fill)
            val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = 3f
                color = (if (!reached) 0xFFE5E7EB else if (stageWon) 0xFF7C3AED else 0xFFDC2626).toInt()
            }
            c.drawRoundRect(rect, 18f, 18f, stroke)

            p.typeface = black; p.isFakeBoldText = true
            p.textAlign = Paint.Align.LEFT
            p.textSize = 32f; p.color = TEXT_MUTED
            c.drawText("${i + 1}", rect.left + 28f, rect.centerY() + 11f, p)
            p.textSize = 30f; p.color = 0xFF1A1A2E.toInt()
            c.drawText(g.stages.getOrNull(i)?.name ?: "Stage ${i + 1}", rect.left + 80f, rect.centerY() + 11f, p)
            p.textAlign = Paint.Align.RIGHT
            p.textSize = 56f
            p.color = (if (!reached) 0xFFD1D5DB else if (stageWon) 0xFF7C3AED else 0xFFDC2626).toInt()
            c.drawText(if (!reached) "·" else if (stageWon) "✓" else "✗", rect.right - 28f, rect.centerY() + 20f, p)
            p.textAlign = Paint.Align.CENTER
        }
    }

    /** Share the rendered card + text via the system sheet (FileProvider PNG). */
    fun share(context: Context, bitmap: Bitmap, text: String) {
        runCatching {
            val dir = File(context.cacheDir, "share").apply { mkdirs() }
            val file = File(dir, "wordocious-share.png")
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it) }
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, text)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Share your result").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        }.onFailure {
            // Fall back to the text-only share if rendering/IO fails.
            ShareHelper.share(context, text)
        }
    }
}
