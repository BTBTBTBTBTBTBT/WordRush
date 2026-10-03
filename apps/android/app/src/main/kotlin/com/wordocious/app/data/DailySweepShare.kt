package com.wordocious.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.RectF
import com.wordocious.app.ModeGen
import com.wordocious.app.R
import com.wordocious.app.data.ShareFinish.U
import com.wordocious.core.ShareCaptions
import java.util.Locale

/**
 * All-dailies share card (Daily Sweep / Flawless Victory / today's progress /
 * Puzzles) — a [ShareCard] in the FINISH_SPEC E1 look, S2-fitted to its rows: the
 * home wallpaper, the section's title art, the info line, the headline and one
 * tinted row per daily (the game's mini game-card tile, its stats, the 3D W / L
 * badge), the won · time · points stat windows and the S3 cast wordmark. Mode order
 * stays the catalog's. S1: every share sends the image(s) only.
 */
object DailySweepShare {

    data class Row(
        val dbKey: String, val label: String, val accent: Int, val glyph: String,
        val won: Boolean, val guesses: Int, val timeSeconds: Int, val score: Int,
    )

    /** DB game_mode → (label, accent, glyph) in canonical daily order — order,
     *  accent and glyph are single-sourced from the catalog (modes.json → ModeGen).
     *  Only ProperNoundle's label is shortened to "Proper" to fit the row. */
    private val LABEL_OVERRIDE = mapOf("PROPERNOUNDLE" to "Proper")
    private val MODES: List<Pair<Triple<String, String, Int>, String>> =
        ModeGen.sweep.map { m ->
            val key = m.dbKey ?: ""
            Triple(key, LABEL_OVERRIDE[key] ?: m.shareLabel, m.accentInt) to (m.glyph ?: "")
        }

    /** The More Games dailies, catalog order — the More Games Sweep card lists these. */
    private val MORE_MODES: List<Pair<Triple<String, String, Int>, String>> =
        ModeGen.more.filter { it.dailyEligible && it.dbKey != null }.map { m ->
            Triple(m.dbKey!!, LABEL_OVERRIDE[m.dbKey!!] ?: m.shareLabel, m.accentInt) to (m.glyph ?: m.shortTitle.take(1))
        }

    fun rows(byMode: Map<String, DailyCompletionsService.Completion>, more: Boolean = false): List<Row> =
        (if (more) MORE_MODES else MODES).mapNotNull { (meta, glyph) ->
            val (dbKey, label, accent) = meta
            byMode[dbKey]?.let { c ->
                Row(dbKey, label, accent, glyph, c.completed, c.guessCount, c.timeSeconds, Math.round(c.score).toInt())
            }
        }

    private fun fmt(s: Int): String = "%d:%02d".format(s / 60, s % 60)

    fun render(
        context: Context, rows: List<Row>, totals: DailyCompletionsService.Totals, flawless: Boolean,
        /** Headline override — the More Games Sweep card (founder, 2026-09-26). */
        title: String? = null,
        /** ART_SPEC §17: the Puzzles card (the ten More Games dailies) heads with the PUZZLES art. */
        puzzles: Boolean = false,
    ): Bitmap {
        // FINISH_SPEC E1 + S2/S3: the home wallpaper, the section's title art, the info
        // line (date · puzzle number), the body (the soft headline, then one tinted row
        // per daily: the mini game-card tile with the game's icon, its stats and the 3D
        // W / L badge), the three stat windows and the cast wordmark, fitted to the rows.
        val fonts = ShareFinish.Fonts(context)
        val titleText = title ?: (if (flawless) "FLAWLESS VICTORY" else "DAILY SWEEP")
        val today = com.wordocious.app.todayLocalDate()
        val puzzleNo = LeaderboardShare.puzzleNumberForDay(today)?.let { "#$it" }
        val w = 950f
        val headH = 84f
        val n = rows.size
        val gap = 14f
        val rowH = 104f
        val rowsH = if (n > 0) rowH * n + gap * (n - 1) else 0f
        val body = ShareCard.Body(w, headH + 12f + rowsH) { c ->
            // Headline (soft type; the gold label ink for a flawless day).
            val tp = ShareFinish.softPaint(fonts, 60f, color = if (flawless) 0xFFA2560C.toInt() else ShareFinish.INK_SOFT)
            tp.letterSpacing = 0.02f
            ShareFinish.fitText(tp, titleText, w)
            c.drawText(titleText, w / 2f, headH / 2f - (tp.ascent() + tp.descent()) / 2f, tp)
            var top = headH + 12f
            val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.black; color = ShareFinish.INK_HEADING }
            val sub = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.bold; color = ShareFinish.INK_LABEL }
            for (r in rows) {
                label.textSize = 34f; sub.textSize = 25f
                val rect = RectF(0f, top, w, top + rowH)
                ShareFinish.drawAccentCard(c, rect, r.accent, minOf(16f * U, rowH * 0.3f), barH = 2f * U)
                // The mini game card (accent wash + border + 4-unit bar + the glossy game icon).
                val tile = rowH * 0.76f
                val tr = RectF(rect.left + 16f, rect.centerY() - tile / 2f + 2f, rect.left + 16f + tile, rect.centerY() + tile / 2f + 2f)
                val modeId = ModeGen.byDbKey(r.dbKey)?.id
                ShareFinish.drawMiniGameCard(context, c, tr, r.accent, com.wordocious.app.ui.gameArtRes(modeId), unit = tile / 40f)
                val textX = tr.right + 22f
                val guessDisp = if (r.won) "${r.guesses}g" else "X"
                val line2 = "$guessDisp · ${fmt(r.timeSeconds)} · ${String.format(Locale.US, "%,d", r.score)} pts"
                val badge = rowH * 0.62f
                val maxText = rect.right - 22f - badge - 16f - textX
                ShareFinish.fitText(label, r.label, maxText); ShareFinish.fitText(sub, line2, maxText)
                c.drawText(r.label, textX, rect.centerY() - 2f, label)
                c.drawText(line2, textX, rect.centerY() + sub.textSize + 4f, sub)
                ShareFinish.drawArtInto(context, c, if (r.won) R.drawable.icon3d_badge_w else R.drawable.icon3d_badge_l,
                    RectF(rect.right - 22f - badge, rect.centerY() - badge / 2f + 2f, rect.right - 22f, rect.centerY() + badge / 2f + 2f))
                top += rowH + gap
            }
        }
        return ShareCard.render(context, ShareCard.Spec(
            wallpaper = R.drawable.art_wall_home,
            title = if (puzzles) R.drawable.art_titlecast_puzzles else R.drawable.art_titlecast_dailies,
            titleFallback = if (puzzles) "PUZZLES" else "DAILIES",
            info = listOfNotNull(ShareFinish.dayCaps(today), puzzleNo).joinToString(" · "),
            body = body,
            stats = listOf(
                ShareFinish.Stat("${totals.won}/${totals.total}", "WON", ShareFinish.Window.PURPLE),
                ShareFinish.Stat(fmt(totals.totalTimeSeconds), "TIME", ShareFinish.Window.BLUE),
                ShareFinish.Stat(String.format(Locale.US, "%,d", totals.totalScore), "POINTS", ShareFinish.Window.GOLD),
            ),
        ))
    }

    /** S4 the sweep caption — only the text fallback when no image can be written. */
    private fun sweepCaption(): String {
        val day = com.wordocious.app.todayLocalDate()
        return ShareCaptions.caption(ShareCaptions.Kind.SWEEP, ShareCaptions.Vars(date = day, game = "Daily Sweep")) + "\nwordocious.com"
    }

    /**
     * The Puzzles card title (founder, 2026-10-01: the ten More Games titles are
     * "Puzzles" now): "PUZZLES FLAWLESS" / "PUZZLES SWEEP" once every one is done,
     * "PUZZLES · N/10" for a partly played day. Web daily-share.ts buildMoreSweepInput.
     */
    fun moreCardTitle(byMode: Map<String, DailyCompletionsService.Completion>): String {
        val t = com.wordocious.app.ui.moreTotals(byMode)
        return when (com.wordocious.app.ui.moreSweepTier(byMode)) {
            com.wordocious.app.ui.MoreSweepTier.FLAWLESS -> "PUZZLES FLAWLESS"
            com.wordocious.app.ui.MoreSweepTier.SWEEP -> "PUZZLES SWEEP"
            null -> "PUZZLES · ${t.completed}/${t.total}"
        }
    }

    private fun moreTotalsAsTotals(byMode: Map<String, DailyCompletionsService.Completion>): DailyCompletionsService.Totals {
        val t = com.wordocious.app.ui.moreTotals(byMode)
        return DailyCompletionsService.Totals(t.completed, t.won, t.total, 0, t.totalTimeSeconds, t.totalScore)
    }

    /**
     * Puzzles Sweep / Flawless share (founder, 2026-09-26; renamed from "More Games"
     * 2026-10-01): the same card over the ten More Games dailies, headed
     * "PUZZLES SWEEP" / "PUZZLES FLAWLESS". Image only — there is no Puzzles
     * sweep board to link, and nothing here scores.
     */
    fun shareMore(context: Context, byMode: Map<String, DailyCompletionsService.Completion>) {
        val rows = rows(byMode, more = true)
        if (rows.isEmpty()) return
        val totals = moreTotalsAsTotals(byMode)
        val flawless = com.wordocious.app.ui.moreSweepTier(byMode) == com.wordocious.app.ui.MoreSweepTier.FLAWLESS
        val bitmap = render(context, rows, totals, flawless, title = moreCardTitle(byMode), puzzles = true)
        val fallback = if (flawless) "Puzzles Flawless on Wordocious! All ${totals.total} puzzles won.\nwordocious.com"
                       else "Puzzles Sweep on Wordocious! All ${totals.total} puzzles done.\nwordocious.com"
        // S1: the image only (no hosted link, no caption).
        val sent = ShareHelper.shareImage(context, bitmap, "Puzzles", fallbackText = fallback)
        ShareEvents.log(if (sent) "image" else "text", "", "more_sweep")
    }

    /**
     * The home banner's share button (home redesign, founder 2026-10-01): today's
     * progress so far, mid-day or done. The Wordocious card (titled with the banner
     * headline) plus, when any Puzzles were played, the Puzzles card — both in one
     * ACTION_SEND_MULTIPLE (one 18-row card would be too cramped to read). With
     * only Puzzles played, that card alone carries the headline. Web
     * daily-share.ts shareTodayProgress.
     */
    fun shareTodayProgress(context: Context, byMode: Map<String, DailyCompletionsService.Completion>, headline: String) {
        val wordRows = rows(byMode)
        val moreRows = rows(byMode, more = true)
        if (wordRows.isEmpty() && moreRows.isEmpty()) return
        val totals = DailyCompletionsService.totals(byMode)
        val images = ArrayList<Pair<Bitmap, String>>()
        if (wordRows.isNotEmpty()) {
            images += render(context, wordRows, totals, totals.flawless, title = headline) to "Wordocious-Today.png"
        }
        if (moreRows.isNotEmpty()) {
            val moreTotals = moreTotalsAsTotals(byMode)
            val flawless = com.wordocious.app.ui.moreSweepTier(byMode) == com.wordocious.app.ui.MoreSweepTier.FLAWLESS
            val title = if (wordRows.isEmpty()) headline else moreCardTitle(byMode)
            images += render(context, moreRows, moreTotals, flawless, title = title, puzzles = true) to "Wordocious-Puzzles.png"
        }
        // S1: the images only (one ACTION_SEND, or SEND_MULTIPLE for both cards); no text.
        val sent = ShareHelper.shareImages(context, images, "Share today's progress", fallbackText = "$headline\nwordocious.com")
        ShareEvents.log(if (sent) "image" else "text", "", "home_banner")
    }

    /** Build + share the all-dailies card — S1: the image only. */
    fun share(context: Context, byMode: Map<String, DailyCompletionsService.Completion>) {
        val rows = rows(byMode)
        if (rows.isEmpty()) return
        val totals = DailyCompletionsService.totals(byMode)
        val bitmap = render(context, rows, totals, totals.flawless)
        val sent = ShareHelper.shareImage(context, bitmap, if (totals.flawless) "Flawless Victory" else "Daily Sweep", fallbackText = sweepCaption())
        ShareEvents.log(if (sent) "image" else "text", "", "daily_sweep")
    }
}

/** Profile stats share card (Wave B P4) in the E1 look, S2-fitted: the STATS title
 *  art, the info line (Level · Tier), the username over a 2 × 3 grid of tinted stat
 *  windows (soft numbers), then the S3 cast wordmark. */
object ProfileShare {
    data class ProfileInput(
        val username: String, val level: Int, val tier: String, val accent: Int,
        val totalWins: Int, val winRate: Int, val currentStreak: Int, val dailyStreak: Int,
        val gold: Int, val silver: Int, val bronze: Int,
        val achievementsUnlocked: Int, val achievementsTotal: Int,
        /** FINISH_SPEC AH: the worn cast character; null = the player's recorded choice (CastAvatars). */
        val castId: String? = null,
    )

    fun render(context: Context, input: ProfileInput): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val tiles = listOf(
            ShareFinish.Stat("${input.totalWins}", "TOTAL WINS", ShareFinish.Window.PURPLE),
            ShareFinish.Stat("${input.winRate}%", "WIN RATE", ShareFinish.Window.BLUE),
            ShareFinish.Stat("${input.currentStreak}", "WIN STREAK", ShareFinish.Window.GOLD),
            ShareFinish.Stat("${input.dailyStreak}", "DAILY STREAK", ShareFinish.Window.PINK),
            ShareFinish.Stat("${input.gold}·${input.silver}·${input.bronze}", "MEDALS G·S·B", ShareFinish.Window.TEAL),
            ShareFinish.Stat("${input.achievementsUnlocked}/${input.achievementsTotal}", "ACHIEVEMENTS", ShareFinish.Window.PURPLE),
        )
        val w = 950f
        val badgeH = 120f
        val nameH = 96f
        val gap = 6f * U
        val tileH = 230f
        val body = ShareCard.Body(w, badgeH + nameH + 14f + tileH * 2 + gap) { c ->
            // FINISH_SPEC V3: the tier badge with "LVL N" in soft numbers + the tier name, centered.
            val lvl = ShareFinish.softPaint(fonts, 64f, Paint.Align.LEFT)
            val cap = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.black; textSize = 36f; color = ShareFinish.INK_LABEL; letterSpacing = 0.06f; ShareFinish.softShadow(this) }
            val lvlText = "${input.level}"
            val tierText = input.tier.uppercase(Locale.US)
            val gapX = 18f
            val rowW = badgeH + gapX + cap.measureText("LVL ") + lvl.measureText(lvlText) + gapX + cap.measureText(tierText)
            var x = (w - rowW) / 2f
            ShareFinish.drawArtInto(context, c, com.wordocious.app.ui.BadgeArt.level(com.wordocious.core.levelTier(input.level)), RectF(x, 0f, x + badgeH, badgeH))
            x += badgeH + gapX
            val cy = badgeH / 2f
            c.drawText("LVL ", x, cy - (cap.ascent() + cap.descent()) / 2f, cap)
            x += cap.measureText("LVL ")
            c.drawText(lvlText, x, cy - (lvl.ascent() + lvl.descent()) / 2f, lvl)
            x += lvl.measureText(lvlText) + gapX
            c.drawText(tierText, x, cy - (cap.ascent() + cap.descent()) / 2f, cap)
            c.translate(0f, badgeH)
            val name = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = fonts.black; textSize = 72f; color = ShareFinish.INK_HEADING; ShareFinish.softShadow(this) }
            // AN5: the player's mascot (saved config / worn AH character's preset / default)
            // stands beside the name — the same composer as every on-screen avatar.
            run {
                val d = 92f
                val gapA = 18f
                ShareFinish.fitText(name, input.username, w - 40f - d - gapA)
                val tw = name.measureText(input.username)
                val left = (w - (d + gapA + tw)) / 2f
                val cyN = nameH / 2f
                drawMascot(context, c, input, left, cyN - d / 2f, d)
                c.drawText(input.username, left + d + gapA + tw / 2f, cyN - (name.ascent() + name.descent()) / 2f, name)
            }
            val y0 = nameH + 14f
            ShareFinish.drawStats(c, fonts, tiles.take(3), 0f, w, y0, tileH, gap, valueSize = 70f)
            ShareFinish.drawStats(c, fonts, tiles.drop(3), 0f, w, y0 + tileH + gap, tileH, gap, valueSize = 70f)
        }
        return ShareCard.render(context, ShareCard.Spec(
            wallpaper = R.drawable.art_wall_home,
            title = R.drawable.art_titlecast_stats,
            titleFallback = "STATS",
            // V3: the level now rides on the tier badge row in the body; the info line dates the card.
            info = ShareFinish.dayCaps(null),
            body = body,
        ))
    }

    /** AN5: the player's mascot avatar, [d] px square at ([left], [top]) (offscreen MascotComposer). */
    private fun drawMascot(context: Context, c: android.graphics.Canvas, input: ProfileInput, left: Float, top: Float, d: Float) {
        // BJ5: the player's RESOLVED avatar (custom photo from the cache, else their mascot) —
        // it used to draw only a worn cast hero / recorded mascot.
        ShareAvatars.draw(context, c, left, top, d, userId = null, username = input.username, castId = input.castId)
    }

    /** S1: the stats card, image only (no hosted link, no caption). */
    fun share(context: Context, input: ProfileInput) {
        val bitmap = render(context, input)
        val fallback = "My Wordocious stats: Level ${input.level} ${input.tier}, ${input.totalWins} wins.\nwordocious.com"
        val sent = ShareHelper.shareImage(context, bitmap, "Stats", fallbackText = fallback, chooserTitle = "Share your stats")
        ShareEvents.log(if (sent) "image" else "text", "", "profile")
    }
}
