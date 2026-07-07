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
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import com.wordocious.app.R
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
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

    /**
     * Share the rendered card + text via the system sheet (FileProvider PNG).
     *
     * Mirrors iOS ShareService: first uploads the PNG to the public
     * `share-images/<uid>/<ShareMode>-<date>.png` bucket and appends the matching
     * https://wordocious.com/s/<key>?… hosted-result URL to the share text (so
     * Messages/social previews resolve to a rich card). The image attachment is
     * always included; if the upload can't happen (signed out / failure) we just
     * drop the hosted link and share image + text — same fallback as iOS.
     */
    fun share(
        context: Context, bitmap: Bitmap, text: String,
        state: GameState, mode: GameMode, elapsedSeconds: Int,
    ) {
        val uri = runCatching {
            val dir = File(context.cacheDir, "share").apply { mkdirs() }
            val file = File(dir, "wordocious-share.png")
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it) }
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        }.getOrNull()
        if (uri == null) { ShareHelper.share(context, text); return }

        CoroutineScope(Dispatchers.IO).launch {
            val url = uploadAndBuildUrl(bitmap, state, mode, elapsedSeconds)
            val finalText = if (url != null) "$text\n$url" else text
            withContext(Dispatchers.Main) {
                runCatching {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_TEXT, finalText)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(Intent.createChooser(intent, "Share your result").apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                }.onFailure {
                    // Fall back to the text-only share if the sheet can't open.
                    ShareHelper.share(context, finalText)
                }
            }
        }
    }

    // ── VS result card ─────────────────────────────────────────────────────────

    data class VsShareSide(
        val name: String,
        val score: Double,
        val won: Boolean,
        val solved: Boolean,
        /** Per board: rows of tile states (colors only — no daily-VS spoilers). */
        val grids: List<List<List<TileState>>>,
    )

    /**
     * VS result share card — same canvas + aesthetic as the daily card
     * (wordmark, accent label, result pill, tinted board cards, footer) with a
     * head-to-head center: name (winner crowned), score (accent vs dimmed),
     * solved line, and up to 2 color-only boards per side.
     */
    fun renderVs(
        context: Context, modeLabel: String, accent: Int,
        isWin: Boolean, isDraw: Boolean, me: VsShareSide, opp: VsShareSide,
    ): Bitmap {
        val bmp = Bitmap.createBitmap(W, 1080, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(BG)
        val black = nunito(context, true)
        val bold = nunito(context, false)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
        val cx = W / 2f

        // Header — hero wordmark (iOS VSShareCardView parity: the brand is the
        // headline of the share, 92pt on the 1080 canvas).
        p.typeface = black; p.textSize = 92f; p.isFakeBoldText = true
        p.shader = LinearGradient(cx - 330f, 0f, cx + 330f, 0f, 0xFFA78BFA.toInt(), 0xFFEC4899.toInt(), Shader.TileMode.CLAMP)
        c.drawText("WORDOCIOUS", cx, 128f, p)
        p.shader = null
        p.textSize = 40f; p.color = accent
        c.drawText(modeLabel.uppercase(), cx, 192f, p)

        val date = SimpleDateFormat("MMM d, yyyy", Locale.US).format(Date())
        p.typeface = bold; p.textSize = 24f; p.color = TEXT_MUTED
        c.drawText("%.2f vs %.2f · %s".format(me.score, opp.score, date), cx, 244f, p)

        // Victory / Defeat / Draw pill.
        run {
            p.textSize = 22f
            val label = if (isDraw) "Draw" else if (isWin) "Victory" else "Defeat"
            val tw = p.measureText(label)
            val rect = RectF(cx - tw / 2 - 16f, 262f, cx + tw / 2 + 16f, 300f)
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = (if (isDraw) 0xFFFEF3C7 else if (isWin) 0xFFF5F3FF else 0xFFFEE2E2).toInt()
            }
            c.drawRoundRect(rect, 10f, 10f, fill)
            p.color = (if (isDraw) 0xFFD97706 else if (isWin) 0xFF7C3AED else 0xFFDC2626).toInt()
            c.drawText(label, cx, rect.centerY() + 8f, p)
        }

        // Head-to-head sides — both sides' boards share ONE grid size (max
        // rows/cols across every shown board, short grids padded with empty
        // tiles) so the two columns are pixel-identical.
        val allShown = me.grids.take(2) + opp.grids.take(2)
        val sharedRows = maxOf(1, allShown.maxOfOrNull { it.size } ?: 1)
        val sharedCols = maxOf(1, allShown.maxOfOrNull { it.firstOrNull()?.size ?: 5 } ?: 5)
        val multiBoard = me.grids.size > 1 || opp.grids.size > 1

        // Deterministic block geometry (same math as drawVsBoard) so the
        // head-to-head centers in the space under the header and the VS mark
        // can sit exactly between the two boards (iOS parity).
        val maxSideB = if (multiBoard) 250f else 380f
        val gapB = maxOf(3f, maxSideB * 0.012f)
        val padB = maxSideB * 0.04f
        val innerB = maxSideB - padB * 2
        val tileB = minOf((innerB - gapB * (sharedCols - 1)) / sharedCols, (innerB - gapB * (sharedRows - 1)) / sharedRows)
        val cardH = tileB * sharedRows + gapB * (sharedRows - 1) + padB * 2
        val shownN = minOf(maxOf(me.grids.size, opp.grids.size), 2)
        val boardsBlockH = cardH * shownN + 14f * (shownN - 1)
        val headerBlockH = 158f            // name/score/solved block above the boards
        val contentTop = 316f              // below the pill
        val contentBottom = 990f           // above the footer
        val blockH = headerBlockH + boardsBlockH
        val blockTop = contentTop + maxOf(0f, (contentBottom - contentTop - blockH) / 2f)
        val nameBaseline = blockTop + 28f

        fun side(s: VsShareSide, sideAccent: Int, scx: Float) {
            val highlighted = s.won || isDraw
            var y = nameBaseline
            p.typeface = black; p.textSize = 28f; p.color = sideAccent
            val crown = if (s.won && !isDraw) "👑 " else ""
            c.drawText((crown + s.name).take(22), scx, y, p)
            y += 58f
            p.textSize = 52f; p.color = if (highlighted) sideAccent else TEXT_MUTED
            c.drawText("%.2f".format(s.score), scx, y, p)
            y += 40f
            p.typeface = bold; p.textSize = 20f
            p.color = (if (s.solved) 0xFF16A34A else 0xFFDC2626).toInt()
            c.drawText(if (s.solved) "✓ Solved" else "✗ Not solved", scx, y, p)
            y += 32f
            val shown = s.grids.take(2)
            for (grid in shown) {
                y += drawVsBoard(c, grid, scx, y, maxSideB, s.won, sharedRows, sharedCols) + 14f
            }
            if (s.grids.size > 2) {
                p.typeface = bold; p.textSize = 18f; p.color = TEXT_MUTED
                c.drawText("+${s.grids.size - 2} more", scx, y + 12f, p)
            }
        }
        side(me, 0xFF7C3AED.toInt(), W * 0.28f)
        side(opp, 0xFFEC4899.toInt(), W * 0.72f)
        // VS centered between the two boards (vertically on the board block).
        p.typeface = black; p.textSize = 44f; p.color = TEXT_MUTED
        c.drawText("VS", cx, blockTop + headerBlockH + boardsBlockH / 2f + 15f, p)

        p.typeface = bold; p.textSize = 22f; p.color = FOOT
        c.drawText("wordocious.com", cx, 1080f - 40f, p)
        return bmp
    }

    /** Grid-only board card (tinted + bordered like the daily card). Returns height.
     *  rows/cols are the SHARED dimensions across both players; short grids are
     *  padded with empty tiles so every card renders at identical size. */
    private fun drawVsBoard(c: Canvas, grid: List<List<TileState>>, scx: Float, top: Float, maxSide: Float, won: Boolean, rows: Int, cols: Int): Float {
        val gap = maxOf(3f, maxSide * 0.012f)
        val pad = maxSide * 0.04f
        val inner = maxSide - pad * 2
        val tile = minOf((inner - gap * (cols - 1)) / cols, (inner - gap * (rows - 1)) / rows)
        val cardW = tile * cols + gap * (cols - 1) + pad * 2
        val cardH = tile * rows + gap * (rows - 1) + pad * 2
        val x = scx - cardW / 2
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = (if (won) 0xFFF5F3FF else 0xFFFEF2F2).toInt() }
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = 4f
            color = (if (won) 0xFF7C3AED else 0xFFDC2626).toInt()
        }
        c.drawRoundRect(RectF(x, top, x + cardW, top + cardH), 18f, 18f, fill)
        c.drawRoundRect(RectF(x, top, x + cardW, top + cardH), 18f, 18f, stroke)
        val tilePaint = Paint(Paint.ANTI_ALIAS_FLAG)
        for (r in 0 until rows) {
            for (col in 0 until cols) {
                tilePaint.color = when (grid.getOrNull(r)?.getOrNull(col) ?: TileState.EMPTY) {
                    TileState.CORRECT -> 0xFF7C3AED.toInt()
                    TileState.PRESENT -> 0xFFF59E0B.toInt()
                    TileState.EMPTY -> 0xFFE5E7EB.toInt()
                    else -> 0xFF9CA3AF.toInt()
                }
                val tx = x + pad + col * (tile + gap)
                val ty = top + pad + r * (tile + gap)
                c.drawRoundRect(RectF(tx, ty, tx + tile, ty + tile), maxOf(4f, tile * 0.12f), maxOf(4f, tile * 0.12f), tilePaint)
            }
        }
        return cardH
    }

    /** Share the VS card image + text (no /s upload — that route is solo-keyed). */
    fun shareVs(context: Context, bitmap: Bitmap, text: String) {
        val uri = runCatching {
            val dir = File(context.cacheDir, "share").apply { mkdirs() }
            val file = File(dir, "wordocious-vs.png")
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it) }
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        }.getOrNull()
        if (uri == null) { ShareHelper.share(context, text); return }
        runCatching {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, text)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Share your result").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        }.onFailure { ShareHelper.share(context, text) }
    }

    /** ShareMode strings the web /s/[...key] route + iOS ShareService use. */
    private fun shareMode(mode: GameMode): String = when (mode) {
        GameMode.DUEL -> "Classic"
        GameMode.QUORDLE -> "QuadWord"
        GameMode.OCTORDLE -> "OctoWord"
        GameMode.SEQUENCE -> "Succession"
        GameMode.RESCUE -> "Deliverance"
        GameMode.DUEL_6 -> "Six"
        GameMode.DUEL_7 -> "Seven"
        GameMode.GAUNTLET -> "Gauntlet"
        GameMode.PROPERNOUNDLE -> "ProperNoundle"
        else -> mode.name
    }

    /**
     * Upload the PNG to `share-images/<uid>/<ShareMode>-<date>.png` and return the
     * matching https://wordocious.com/s/<uid>/<ShareMode>-<date> URL with the
     * result stats in its query (consumed by app/s/[...key]). Null if signed out
     * or the upload fails — caller then shares image + text only.
     */
    private suspend fun uploadAndBuildUrl(
        bitmap: Bitmap, state: GameState, mode: GameMode, elapsedSeconds: Int,
    ): String? = runCatching {
        // RLS keys the folder on auth.uid()::text, which is lowercase.
        val uid = AuthService.userId?.lowercase() ?: return null

        val sm = shareMode(mode)
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val key = "$uid/$sm-$dateStr"

        val png = ByteArrayOutputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it); it.toByteArray() }
        SupabaseConfig.client.storage.from("share-images").upload("$key.png", png) { upsert = true }

        val won = state.status == GameStatus.WON
        // Longest board's guess count = the complete shared history (solved
        // boards stop accumulating) — same MAX semantics as the recorded score.
        val guesses = state.boards.maxOfOrNull { it.guesses.size } ?: 0
        val maxGuesses = state.boards.maxOfOrNull { it.maxGuesses } ?: 0
        val isVertical = mode == GameMode.OCTORDLE || mode == GameMode.GAUNTLET

        val q = linkedMapOf(
            "m" to sm, "won" to if (won) "1" else "0",
            "g" to "$guesses", "mg" to "$maxGuesses", "t" to "$elapsedSeconds",
            "w" to "1080", "h" to if (isVertical) "1350" else "1080",
            "v" to "${if (won) "w" else "x"}$guesses-$elapsedSeconds",
        )
        val gauntlet = state.gauntlet
        if (gauntlet != null) {
            q["sc"] = "${gauntlet.stageResults.count { it.status == GameStatus.WON }}"
            q["ts"] = "${gauntlet.totalStages}"
        } else if (state.boards.size > 1) {
            q["bs"] = "${if (won) state.boards.size else state.boards.count { it.status == GameStatus.WON }}"
            q["tb"] = "${state.boards.size}"
        }

        "https://wordocious.com/s/$key?" + q.entries.joinToString("&") { "${it.key}=${Uri.encode(it.value)}" }
    }.getOrNull()
}
