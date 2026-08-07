package com.wordocious.app.data

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import com.wordocious.app.ModeGen
import com.wordocious.app.R
import com.wordocious.app.todayLocalDate
import com.wordocious.app.yesterdayLocalDate
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.LocalDate
import java.util.Calendar
import kotlin.math.max
import kotlin.math.min

/**
 * LEADERBOARD SHARE — Android port of web lib/leaderboard-share.ts (pure card
 * builders), lib/share-image.ts drawLeaderboardCard/drawLbRow (the 1080²
 * canvas renderer), and lib/share-utils.ts shareResult linkOnly + the
 * leaderboard-share-flow.ts fetch glue.
 *
 * Three variants of one card: today's solo board, today's VS battle board, and
 * yesterday's settled podium. Spoiler-free by construction — names, scores and
 * stats only, never words or tiles. The share itself is LINK-ONLY: the PNG is
 * uploaded to the share-images bucket and the /s/ URL is shared alone (its
 * unfurl IS the card — attaching the image too double-renders in Messages);
 * the PNG attachment is only the fallback when the upload can't happen.
 */
object LeaderboardShare {
    private const val W = 1080
    private const val H = 1080
    private const val TEXT_DARK = 0xFF1A1A2E.toInt()
    private const val TEXT_MUTED = 0xFF6B7280.toInt()
    private const val VS_ACCENT = 0xFF0D9488.toInt()
    private const val SURFACE = "leaderboard"

    // ── Variant identity (web LB_THEME / LB_LABEL) ─────────────────────────────

    // FRIENDS (§207): friends-only board + settled friends podium — same
    // geometry, indigo identity, dense friend ranks in rows/you/shareRank.
    enum class Variant { SOLO, VS, PODIUM, FRIENDS, FRIENDS_PODIUM }

    private data class Theme(val bg: Int, val label: Int, val panelBorder: Int, val footer: Int)

    // Lavender for the daily board + podium, mint/teal for the VS battle board.
    private fun theme(v: Variant): Theme = when (v) {
        Variant.SOLO -> Theme(0xFFF5F3FF.toInt(), 0xFF7C3AED.toInt(), 0x55A78BFA, 0xFF7C3AED.toInt())
        Variant.VS -> Theme(0xFFF0FDFA.toInt(), VS_ACCENT, 0x550D9488, VS_ACCENT)
        Variant.PODIUM -> Theme(0xFFF5F3FF.toInt(), 0xFFD97706.toInt(), 0x55F59E0B, 0xFF7C3AED.toInt())
        // Friends: indigo — the leaderboard tab's own accent family.
        Variant.FRIENDS -> Theme(0xFFEEF2FF.toInt(), 0xFF4F46E5.toInt(), 0x556366F1, 0xFF4F46E5.toInt())
        Variant.FRIENDS_PODIUM -> Theme(0xFFEEF2FF.toInt(), 0xFFD97706.toInt(), 0x55F59E0B, 0xFF4F46E5.toInt())
    }

    private fun label(v: Variant): String = when (v) {
        Variant.SOLO -> "DAILY LEADERBOARD"
        Variant.VS -> "VS BATTLE LEADERBOARD"
        Variant.PODIUM -> "YESTERDAY’S PODIUM"
        Variant.FRIENDS -> "FRIENDS LEADERBOARD"
        Variant.FRIENDS_PODIUM -> "FRIENDS PODIUM"
    }

    // ── Card input (web ShareLeaderboardInput) ─────────────────────────────────

    /** One row, all strings preformatted by the pure builders below so the
     *  renderer stays a dumb layout pass (web ShareLeaderboardRowInput). */
    data class RowInput(
        val rank: Int,
        val name: String,
        val scoreDisplay: String,
        /** Full-stats subline; null on the compressed top-5 rows of the
         *  sharer-below-top-5 layout. */
        val subline: String?,
        val isYou: Boolean,
    )

    /** "▲3 vs yesterday" (green) / "▼2 vs yesterday" (red) pill. */
    data class Delta(val text: String, val improved: Boolean)

    data class CardInput(
        val variant: Variant,
        /** Web ShareMode title ("Classic", "Six", …) — /s/ key + `lm` param. */
        val shareMode: String,
        /** Lowercased engine-mode name for share_events instrumentation. */
        val gameModeLower: String,
        /** Mode chip accent (solo/podium; the VS chip is always teal). */
        val accent: Int,
        val modeChip: String,
        val dateChip: String,
        /** Top rows (≤5; podium ≤3), ordered by rank. */
        val rows: List<RowInput>,
        /** Sharer's row when ranked below the top rows (after a "• • •" divider). */
        val you: RowInput? = null,
        /** "#12 of 87" under the out-of-top you-row. */
        val youRankLine: String? = null,
        val delta: Delta? = null,
        val footer: String,
        /** Board day (yyyy-MM-dd) — keys the storage object. */
        val day: String,
        val shareRank: Int? = null,
        val sharePlayers: Int? = null,
    )

    // ── Pure builders (web lib/leaderboard-share.ts) ───────────────────────────

    /** Day #1 of the daily system (migration 20260407000001) — drives the
     *  "#123" puzzle number on the date chip. */
    private val DAILY_PUZZLE_EPOCH: LocalDate = LocalDate.of(2026, 4, 7)

    /** 1-based daily puzzle number for a yyyy-MM-dd day; null for bad input or
     *  pre-epoch days (defensive — those never had a daily board). */
    fun puzzleNumberForDay(day: String): Int? = runCatching {
        (LocalDate.parse(day).toEpochDay() - DAILY_PUZZLE_EPOCH.toEpochDay() + 1).toInt()
    }.getOrNull()?.takeIf { it >= 1 }

    private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

    /** "Aug 7, 2026" from a yyyy-MM-dd day string (no timezone involved). */
    fun formatBoardDate(day: String): String {
        val m = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(day) ?: return day
        val (y, mo, d) = m.destructured
        val mon = MONTHS.getOrNull(mo.toInt() - 1) ?: return day
        return "$mon ${d.toInt()}, $y"
    }

    /** "11:15 AM" — local clock time for the "as of" snapshot stamp. */
    fun formatClockTime(cal: Calendar = Calendar.getInstance()): String {
        var h = cal.get(Calendar.HOUR_OF_DAY)
        val ampm = if (h >= 12) "PM" else "AM"
        h %= 12; if (h == 0) h = 12
        return "%d:%02d %s".format(h, cal.get(Calendar.MINUTE), ampm)
    }

    /** Omitted entirely (null) when the sharer didn't play yesterday or their
     *  rank is unchanged — exactly per spec. */
    fun buildRankDelta(yesterdayRank: Int?, todayRank: Int): Delta? {
        if (yesterdayRank == null) return null
        val d = yesterdayRank - todayRank
        if (d == 0) return null
        return if (d > 0) Delta("▲$d vs yesterday", true) else Delta("▼${-d} vs yesterday", false)
    }

    private fun fmtClock(seconds: Int): String {
        val s = max(0, seconds)
        return "%d:%02d".format(s / 60, s % 60)
    }

    private fun soloSubline(e: LeaderboardService.LeaderboardEntry): String =
        "${e.guessCount} guesses · ${fmtClock(e.timeSeconds)} · ${if (e.completed) "Win" else "Loss"}"

    private fun vsSubline(e: LeaderboardService.LeaderboardEntry): String {
        // W-L today. vs_losses excludes draws; older rows without the column
        // fall back to games-minus-wins (web parity).
        val losses = e.vsLosses ?: max(0, e.vsGames - e.vsWins)
        return "${e.vsWins}-$losses today"
    }

    private fun toRow(
        rank: Int,
        e: LeaderboardService.LeaderboardEntry,
        userId: String?,
        subline: ((LeaderboardService.LeaderboardEntry) -> String)?,
    ): RowInput = RowInput(
        rank = rank,
        name = e.username ?: "Player",
        scoreDisplay = formatScoreDisplay(e.compositeScore),
        subline = subline?.invoke(e),
        isYou = userId != null && e.userId == userId,
    )

    /** Same integer formatting as web formatScore / ui formatScore. */
    private fun formatScoreDisplay(score: Double): String =
        java.text.NumberFormat.getIntegerInstance(java.util.Locale.US).format(score.toLong())

    /**
     * Today's-board card (web buildDailyLeaderboardShareInput). Top 5 rows with
     * full stats; if the sharer sits below the top 5, the top rows compress to
     * name+score and their highlighted full-stats row follows a "• • •" divider
     * with "#R of TOTAL". A sharer who hasn't played today gets no you-row.
     * Returns null for an empty board.
     */
    fun buildDailyInput(
        variant: Variant,
        friends: Boolean = false,
        meta: com.wordocious.app.GenMode,
        day: String,
        entries: List<LeaderboardService.LeaderboardEntry>,
        userId: String?,
        userRank: LeaderboardService.RankInfo?,
        userEntry: LeaderboardService.LeaderboardEntry?,
        yesterdayRank: Int?,
        now: Calendar = Calendar.getInstance(),
    ): CardInput? {
        val top = entries.take(5)
        if (top.isEmpty()) return null

        // FRIENDS keeps solo/vs sublines; only the identity changes.
        val cardVariant = if (friends) Variant.FRIENDS else variant
        val subline: (LeaderboardService.LeaderboardEntry) -> String =
            if (variant == Variant.VS) ::vsSubline else ::soloSubline
        val youInTop = userId != null && top.any { it.userId == userId }
        val belowTop = !youInTop && userId != null && userRank != null && userEntry != null
        val delta = userRank?.let { buildRankDelta(yesterdayRank, it.rank) }

        val puzzle = puzzleNumberForDay(day)
        return CardInput(
            variant = cardVariant,
            shareMode = meta.title,
            gameModeLower = (meta.dbKey ?: meta.title).lowercase(),
            accent = meta.accentInt,
            modeChip = if (variant == Variant.VS) "${meta.shareLabel} VS" else meta.shareLabel,
            // "as of h:mm" marks the card as a SNAPSHOT of a live board —
            // today's standings keep moving. The settled Podium says "· Final".
            dateChip = "${formatBoardDate(day)}${if (puzzle != null) " · #$puzzle" else ""} · as of ${formatClockTime(now)}",
            // Sharer below the top 5 → compress the top rows to name+score only.
            rows = top.mapIndexed { i, e -> toRow(i + 1, e, userId, if (belowTop) null else subline) },
            you = if (belowTop) toRow(userRank!!.rank, userEntry!!, userId, subline) else null,
            youRankLine = if (belowTop) "#${userRank!!.rank} of ${userRank!!.totalPlayers}" else null,
            delta = delta,
            footer = when (cardVariant) {
                Variant.FRIENDS -> "Add your friends — play free at wordocious.com"
                Variant.VS -> "Think you can take them? wordocious.com"
                else -> "Can you beat them? Play free at wordocious.com"
            },
            day = day,
            shareRank = userRank?.rank,
            sharePlayers = userRank?.totalPlayers,
        )
    }

    /**
     * The settled variant for the Yesterday's Winners surface (web
     * buildYesterdayPodiumShareInput): "YESTERDAY'S PODIUM" identity,
     * "MMM d, yyyy · Final" chip, top-3 rows with full stats. Null when
     * yesterday had no finishers.
     */
    fun buildPodiumInput(
        playType: String,
        friends: Boolean = false,
        meta: com.wordocious.app.GenMode,
        day: String,
        entries: List<LeaderboardService.LeaderboardEntry>,
        userId: String?,
    ): CardInput? {
        val top = entries.take(3)
        if (top.isEmpty()) return null
        val subline: (LeaderboardService.LeaderboardEntry) -> String =
            if (playType == "vs") ::vsSubline else ::soloSubline
        return CardInput(
            variant = if (friends) Variant.FRIENDS_PODIUM else Variant.PODIUM,
            shareMode = meta.title,
            gameModeLower = (meta.dbKey ?: meta.title).lowercase(),
            accent = meta.accentInt,
            modeChip = if (playType == "vs") "${meta.shareLabel} VS" else meta.shareLabel,
            dateChip = "${formatBoardDate(day)} · Final",
            rows = top.mapIndexed { i, e -> toRow(i + 1, e, userId, subline) },
            footer = "Today’s board is open — wordocious.com",
            day = day,
        )
    }

    // ── Renderer (web drawLeaderboardCard / drawLbRow) ─────────────────────────

    private fun nunito(context: Context, weight: Int): Typeface {
        val base = ResourcesCompat.getFont(context, R.font.nunito) ?: Typeface.DEFAULT
        // Nunito.ttf is a variable font whose default instance is ExtraLight; the
        // weighted create (API 28+) drives the real `wght` axis.
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
            Typeface.create(base, weight, false)
        else Typeface.create(base, if (weight >= 800) Typeface.BOLD else Typeface.NORMAL)
    }

    /** Vertically-centered text (web textBaseline='middle'). */
    private fun Canvas.textV(text: String, x: Float, cy: Float, p: Paint) {
        drawText(text, x, cy - (p.ascent() + p.descent()) / 2, p)
    }

    /** Truncate with an ellipsis to fit maxWidth at the paint's current font. */
    private fun clampText(p: Paint, text: String, maxWidth: Float): String {
        if (p.measureText(text) <= maxWidth) return text
        var t = text
        while (t.length > 1 && p.measureText(t + "…") > maxWidth) t = t.dropLast(1)
        return t + "…"
    }

    /** Draw a lucide stroke drawable (crown/medal/swords) tinted, centered at
     *  (cx, cy) in a size×size box — same pattern as DailySweepShare's badges. */
    private fun drawIcon(context: Context, c: Canvas, res: Int, cx: Float, cy: Float, size: Float, tint: Int) {
        val d = ContextCompat.getDrawable(context, res)?.mutate() ?: return
        d.setTint(tint)
        val half = size / 2
        d.setBounds((cx - half).toInt(), (cy - half).toInt(), (cx + half).toInt(), (cy + half).toInt())
        d.draw(c)
    }

    // Rank iconography — same colors as the in-app RankIcon (crown gold, medal
    // silver, medal bronze).
    private val RANK_ICON_COLORS = intArrayOf(0xFFD97706.toInt(), 0xFF9CA3AF.toInt(), 0xFFB45309.toInt())

    private fun drawRankGlyph(context: Context, c: Canvas, p: Paint, black: Typeface, rank: Int, cx: Float, cy: Float) {
        when (rank) {
            1 -> drawIcon(context, c, R.drawable.ic_crown, cx, cy, 40f, RANK_ICON_COLORS[0])
            2 -> drawIcon(context, c, R.drawable.ic_medal, cx, cy, 40f, RANK_ICON_COLORS[1])
            3 -> drawIcon(context, c, R.drawable.ic_medal, cx, cy, 40f, RANK_ICON_COLORS[2])
            else -> {
                p.typeface = black; p.textSize = 30f; p.color = TEXT_MUTED
                p.textAlign = Paint.Align.CENTER
                c.textV("$rank", cx, cy, p)
                p.textAlign = Paint.Align.LEFT
            }
        }
    }

    /** One leaderboard row — ports web drawLbRow: gold "you" treatment (full
     *  bleed, soft amber glow, edge-aware corners), rank glyph, name (+ "· YOU"
     *  + delta pill), right-aligned score with optional stats subline. */
    private fun drawRow(
        context: Context, c: Canvas, row: RowInput,
        x: Float, y: Float, w: Float, h: Float,
        black: Typeface, w800: Typeface, bold: Typeface,
        rankLine: String? = null, delta: Delta? = null, separator: Boolean = false,
        edgeTop: Boolean = false, edgeBottom: Boolean = false, bleed: Float = 16f,
    ) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        // Gold "you" highlight — full-bleed across the panel with a soft amber
        // glow instead of a hard border; flush to the panel edge (and matching
        // its corner radius) when it sits at the first/last slot.
        if (row.isYou) {
            val hy = if (edgeTop) y - bleed + 2f else y + 4f
            val hb = if (edgeBottom) y + h + bleed - 2f else y + h - 4f
            val rTop = if (edgeTop) 26f else 16f
            val rBot = if (edgeBottom) 26f else 16f
            val gold = Path().apply {
                addRoundRect(
                    RectF(x + 2f, hy, x + w - 2f, hb),
                    floatArrayOf(rTop, rTop, rTop, rTop, rBot, rBot, rBot, rBot),
                    Path.Direction.CW,
                )
            }
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0xFFFEF3C7.toInt()
                // rgba(245,158,11,0.5) blur 26 — the soft amber glow.
                setShadowLayer(26f, 0f, 0f, 0x80F59E0B.toInt())
            }
            c.drawPath(gold, fill)
            val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = 2f
                // Top-lit gradient stroke instead of a hard border.
                shader = LinearGradient(x, hy, x, hb, 0x8CFCD34D.toInt(), 0x40F59E0B, Shader.TileMode.CLAMP)
            }
            c.drawPath(gold, stroke)
        }

        val midY = y + h / 2
        drawRankGlyph(context, c, p, black, row.rank, x + 56f, midY)

        // Right block: bold score, optional subline underneath.
        val rightX = x + w - 30f
        p.textAlign = Paint.Align.RIGHT
        p.typeface = black; p.textSize = 34f; p.color = TEXT_DARK
        c.textV(row.scoreDisplay, rightX, if (row.subline != null) midY - 13f else midY, p)
        var rightBlockW = p.measureText(row.scoreDisplay)
        if (row.subline != null) {
            p.typeface = bold; p.textSize = 21f; p.color = TEXT_MUTED
            c.textV(row.subline, rightX, midY + 16f, p)
            rightBlockW = max(rightBlockW, p.measureText(row.subline))
        }

        // Left block: name (+ YOU label + delta pill), optional "#R of TOTAL".
        val nameX = x + 96f
        val nameMaxW = w - 96f - 30f - rightBlockW - 24f
        val nameY = if (rankLine != null) midY - 14f else midY
        p.textAlign = Paint.Align.LEFT
        var reserved = 0f
        if (row.isYou) {
            p.typeface = black; p.textSize = 24f
            reserved = p.measureText(" · YOU")
        }
        p.typeface = black; p.textSize = 30f; p.color = TEXT_DARK
        val name = clampText(p, row.name, max(60f, nameMaxW - reserved))
        c.textV(name, nameX, nameY, p)
        var cursorX = nameX + p.measureText(name)
        if (row.isYou) {
            p.textSize = 24f; p.color = 0xFFD97706.toInt()
            c.textV(" · YOU", cursorX, nameY, p)
            cursorX += p.measureText(" · YOU")
        }

        // Rank-delta pill on the sharer's row — under the name when the
        // "#R of TOTAL" line isn't there, sharing the second line otherwise.
        if (row.isYou && (delta != null || rankLine != null)) {
            val lineY = midY + 17f
            var lx = nameX
            if (rankLine != null) {
                p.typeface = w800; p.textSize = 21f; p.color = 0xFFB45309.toInt()
                c.textV(rankLine, lx, lineY, p)
                lx += p.measureText(rankLine) + 12f
            }
            if (delta != null) {
                p.typeface = w800; p.textSize = 18f
                val pillW = p.measureText(delta.text) + 20f
                val pillH = 28f
                // No rank line → pill rides the name line instead of a second one.
                val pillTop = if (rankLine != null) lineY - pillH / 2 else nameY - pillH / 2
                val pillX = if (rankLine != null) lx else cursorX + 12f
                val pillRect = RectF(pillX, pillTop, pillX + pillW, pillTop + pillH)
                val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = (if (delta.improved) 0xFFDCFCE7 else 0xFFFEE2E2).toInt()
                }
                c.drawRoundRect(pillRect, 14f, 14f, fill)
                p.color = (if (delta.improved) 0xFF16A34A else 0xFFDC2626).toInt()
                c.textV(delta.text, pillX + 10f, pillRect.centerY(), p)
            }
        }

        if (separator && !row.isYou) {
            val sep = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0xFFE5E7EB.toInt(); strokeWidth = 1.5f
            }
            c.drawLine(x + 26f, y + h, x + w - 26f, y + h, sep)
        }
    }

    /** Render the 1080² card (web drawLeaderboardCard). */
    fun render(context: Context, input: CardInput): Bitmap {
        val bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val th = theme(input.variant)
        c.drawColor(th.bg)

        val black = nunito(context, 900)
        val w800 = nunito(context, 800)
        val bold = nunito(context, 700)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
        val cx = W / 2f

        // Wordmark — the established two-tone (violet→pink) treatment.
        val wordmarkY = 96f
        p.typeface = black; p.textSize = 60f
        p.shader = LinearGradient(cx - 220f, 0f, cx + 220f, 0f, 0xFFA78BFA.toInt(), 0xFFEC4899.toInt(), Shader.TileMode.CLAMP)
        c.drawText("WORDOCIOUS", cx, wordmarkY, p)
        p.shader = null

        // Letterspaced variant label (web letterSpacing: 10px @ 36px ≈ 0.278em).
        val labelY = wordmarkY + 74f
        p.textSize = 36f; p.color = th.label
        p.letterSpacing = 10f / 36f
        c.drawText(label(input.variant), cx, labelY, p)
        p.letterSpacing = 0f

        // Chips: mode (accent bg; swords glyph on the VS variant) + white date chip.
        val chipH = 56f
        val chipY = labelY + 36f
        p.typeface = w800; p.textSize = 27f
        val swordsSize = if (input.variant == Variant.VS) 30f else 0f
        val swordsGap = if (input.variant == Variant.VS) 10f else 0f
        val modeTextW = p.measureText(input.modeChip)
        val modeChipW = modeTextW + swordsSize + swordsGap + 48f
        val dateTextW = p.measureText(input.dateChip)
        val dateChipW = dateTextW + 44f
        val chipGap = 16f
        var chipX = (W - modeChipW - chipGap - dateChipW) / 2f

        val modeAccent = if (input.variant == Variant.VS) VS_ACCENT else input.accent
        val chipRect = RectF(chipX, chipY, chipX + modeChipW, chipY + chipH)
        c.drawRoundRect(chipRect, chipH / 2, chipH / 2, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = modeAccent })
        var modeTextX = chipX + 24f
        if (input.variant == Variant.VS) {
            drawIcon(context, c, R.drawable.ic_swords, modeTextX + swordsSize / 2, chipY + chipH / 2, swordsSize, Color.WHITE)
            modeTextX += swordsSize + swordsGap
        }
        p.textAlign = Paint.Align.LEFT
        p.color = Color.WHITE
        c.textV(input.modeChip, modeTextX, chipY + chipH / 2, p)

        chipX += modeChipW + chipGap
        val dateRect = RectF(chipX, chipY, chipX + dateChipW, chipY + chipH)
        c.drawRoundRect(dateRect, chipH / 2, chipH / 2, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })
        c.drawRoundRect(dateRect, chipH / 2, chipH / 2, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = 2f; color = 0xFFE5E7EB.toInt()
        })
        p.color = TEXT_MUTED
        c.textV(input.dateChip, chipX + 22f, chipY + chipH / 2, p)

        // Rows panel — sized to its content, then centered between the chips and
        // the footer, so short boards don't strand dead padding.
        val panelX = 64f
        val panelW = W - panelX * 2
        val areaTop = chipY + chipH + 40f
        val footerY = H - 52f
        val areaBottom = footerY - 46f
        val pad = 16f
        val dividerH = if (input.you != null) 46f else 0f
        val nRows = input.rows.size + (if (input.you != null) 1 else 0)
        if (nRows > 0) {
            // Max row height — roomier for the 3-row podium than a 6-slot board.
            val band = if (input.variant == Variant.PODIUM || input.variant == Variant.FRIENDS_PODIUM) 170f else 130f
            val rowH = min(band, (areaBottom - areaTop - pad * 2 - dividerH) / nRows)
            val contentH = rowH * nRows + dividerH + pad * 2
            val panelTop = areaTop + (areaBottom - areaTop - contentH) / 2
            val panel = RectF(panelX, panelTop, panelX + panelW, panelTop + contentH)
            c.drawRoundRect(panel, 28f, 28f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })
            c.drawRoundRect(panel, 28f, 28f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = 3f; color = th.panelBorder
            })
            var y = panelTop + pad

            input.rows.forEachIndexed { i, row ->
                drawRow(
                    context, c, row, panelX, y, panelW, rowH, black, w800, bold,
                    delta = if (row.isYou) input.delta else null,
                    separator = i < input.rows.size - 1 || input.you != null,
                    edgeTop = i == 0,
                    edgeBottom = i == input.rows.size - 1 && input.you == null,
                    bleed = pad,
                )
                y += rowH
            }

            if (input.you != null) {
                // "• • •" divider between the compressed top rows and the sharer.
                p.typeface = black; p.textSize = 26f; p.color = TEXT_MUTED
                p.textAlign = Paint.Align.CENTER
                c.textV("• • •", W / 2f, y + dividerH / 2, p)
                y += dividerH
                drawRow(
                    context, c, input.you, panelX, y, panelW, rowH, black, w800, bold,
                    rankLine = input.youRankLine, delta = input.delta,
                    edgeBottom = true, bleed = pad,
                )
            }
        }

        // Footer hook.
        p.typeface = w800; p.textSize = 29f; p.color = th.footer
        p.textAlign = Paint.Align.CENTER
        c.drawText(input.footer, cx, footerY + 30f, p)
        return bmp
    }

    // ── Upload + link-only share (web shareResult linkOnly) ────────────────────

    private fun kind(variant: Variant): String = when (variant) {
        Variant.VS -> "VsLeaderboard"
        Variant.PODIUM -> "Podium"
        Variant.SOLO -> "Leaderboard"
        Variant.FRIENDS -> "FriendsBoard"
        Variant.FRIENDS_PODIUM -> "FriendsPodium"
    }

    /**
     * Upload the PNG to `share-images/<uid>/<Kind>-<ShareMode>-<day>.png` and
     * return the matching https://wordocious.com/s/<key>?… URL (consumed by
     * app/s/[...key], whose unfurl IS this card). Null if signed out or the
     * upload fails — caller then falls back to sharing the PNG.
     */
    private suspend fun uploadAndBuildUrl(bitmap: Bitmap, input: CardInput): String? = runCatching {
        // RLS keys the folder on auth.uid()::text, which is lowercase.
        val uid = AuthService.userId?.lowercase() ?: return null
        val key = "$uid/${kind(input.variant)}-${input.shareMode}-${input.day}"
        val png = ByteArrayOutputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it); it.toByteArray() }
        SupabaseConfig.client.storage.from("share-images").upload("$key.png", png) { upsert = true }

        val q = linkedMapOf("m" to kind(input.variant), "lm" to input.shareMode)
        input.shareRank?.let { q["r"] = "$it" }
        input.sharePlayers?.let { q["tp"] = "$it" }
        q["w"] = "1080"; q["h"] = "1080"
        // Unlike a puzzle result, a board changes all day — a minute-granular
        // buster makes a later re-share re-scrape the fresh standings.
        q["v"] = "lb${input.shareRank ?: 0}-${System.currentTimeMillis() / 60000}"
        "https://wordocious.com/s/$key?" + q.entries.joinToString("&") { "${it.key}=${Uri.encode(it.value)}" }
    }.getOrNull()

    /**
     * Render → upload → share. LINK-ONLY when the upload succeeds: the /s/
     * unfurl already carries the pixels, so image+link would render the card
     * TWICE in the compose sheet. Falls back to sharing the PNG (with the bare
     * site URL as caption) only when there is no hosted URL.
     */
    suspend fun renderAndShare(context: Context, input: CardInput) {
        val bitmap = render(context, input)
        val url = withContext(Dispatchers.IO) { uploadAndBuildUrl(bitmap, input) }
        withContext(Dispatchers.Main) {
            if (url != null) {
                ShareEvents.log("other", input.gameModeLower, SURFACE)
                runCatching {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, url)
                    }
                    context.startActivity(Intent.createChooser(intent, "Share leaderboard").apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                }.onFailure { ShareHelper.share(context, url) }
                return@withContext
            }
            // Upload couldn't happen (signed out / network) → PNG fallback.
            val uri = runCatching {
                val dir = File(context.cacheDir, "share").apply { mkdirs() }
                val file = File(dir, "wordocious-leaderboard.png")
                file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 95, it) }
                FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            }.getOrNull()
            ShareEvents.log(if (uri != null) "image" else "text", input.gameModeLower, SURFACE)
            if (uri == null) { ShareHelper.share(context, "https://wordocious.com"); return@withContext }
            runCatching {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_TEXT, "https://wordocious.com")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(intent, "Share leaderboard").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
            }.onFailure { ShareHelper.share(context, "https://wordocious.com") }
        }
    }

    // ── Fetch-and-share glue (web leaderboard-share-flow.ts) ───────────────────

    /**
     * Share today's board (solo or VS variant per the caller's toggle). The
     * page's already-fetched rows + rank come in; this adds the two cheap
     * lookups the card needs — the sharer's row when they rank below the
     * visible list, and yesterday's final rank for the delta pill. No-op for
     * an empty board or the synthetic Sweep id (no card design).
     */
    suspend fun shareDailyLeaderboardCard(
        context: Context,
        dbMode: String,
        playType: String,
        entries: List<LeaderboardService.LeaderboardEntry>,
        rankWindow: LeaderboardService.RankWindow?,
        userId: String?,
        userRank: LeaderboardService.RankInfo?,
        friends: Boolean = false,
    ) {
        val meta = ModeGen.byDbKey(dbMode) ?: return
        if (entries.isEmpty()) return
        val day = todayLocalDate()
        val variant = if (playType == "vs") Variant.VS else Variant.SOLO

        val inTop5 = userId != null && entries.take(5).any { it.userId == userId }

        // Sharer ranks below the top 5 and the page doesn't hold their row →
        // read a small window around their offset in the same ranked ordering
        // (ties can shift the exact offset — the window absorbs that). Not
        // found → the card simply omits the you-row.
        var userEntry = if (userId != null) {
            entries.firstOrNull { it.userId == userId }
                ?: rankWindow?.entries?.firstOrNull { it.userId == userId }
        } else null
        if (userId != null && userRank != null && !inTop5 && userEntry == null && !friends) {
            // Global board only — a friends board is entirely in `entries`.
            val offset = max(0, userRank.rank - 6)
            userEntry = LeaderboardService.fetchDailyLeaderboardOrNull(
                dbMode, playType, day, limit = 11, offset = offset,
            )?.firstOrNull { it.userId == userId }
        }

        // Yesterday's final rank for the delta pill — only meaningful when the
        // sharer is on today's board at all. Null = didn't play yesterday.
        val yesterdayRank = if (userId != null && userRank != null) {
            if (friends) {
                // Friend-rank vs friend-rank: dense index into yesterday's
                // friends-filtered board (§207).
                val ids = (FriendsService.friendIds + userId.lowercase()).toList()
                LeaderboardService.fetchDailyLeaderboardOrNull(
                    dbMode, playType, yesterdayLocalDate(), userIds = ids,
                )?.indexOfFirst { it.userId == userId }?.takeIf { it >= 0 }?.plus(1)
            } else {
                LeaderboardService.getUserDailyRank(userId, dbMode, playType, day = yesterdayLocalDate())?.rank
            }
        } else null

        val input = buildDailyInput(variant, friends, meta, day, entries, userId, userRank, userEntry, yesterdayRank) ?: return
        renderAndShare(context, input)
    }

    /** Share yesterday's settled podium (top 3, "· Final" chip). */
    suspend fun shareYesterdayPodiumCard(
        context: Context,
        dbMode: String,
        playType: String,
        entries: List<LeaderboardService.LeaderboardEntry>,
        userId: String?,
        friends: Boolean = false,
    ) {
        val meta = ModeGen.byDbKey(dbMode) ?: return
        val input = buildPodiumInput(playType, friends, meta, yesterdayLocalDate(), entries, userId) ?: return
        renderAndShare(context, input)
    }
}
