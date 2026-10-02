package com.wordocious.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import androidx.annotation.DrawableRes
import com.wordocious.app.R
import com.wordocious.app.data.ShareFinish.U
import com.wordocious.app.ui.CastCrops
import com.wordocious.app.ui.Mascots
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * FINISH_SPEC S2 + S3 — the share card fitted to its content. Every share image
 * (game results, More Games, Gauntlet, VS, sweep / today, profile, leaderboard) is
 * laid out top to bottom with no dead space:
 *
 *   title art (~70% width) · one compact info line (date · guesses · time · W/L badge)
 *   · the body block (~88% width; tall bodies scale by height) · the E1 stat windows
 *   · the cast wordmark (S3: W·O·R·D·O·C·I·O·U·S standing together, ~90% width,
 *   soft ground shadow) · one tiny "wordocious.com" line.
 *
 * The canvas is 1080 wide; its height is the sum of those, clamped between 4:5
 * (1350) and 9:16 (1920). There is no separate "WORDOCIOUS" text wordmark: the cast
 * is the only wordmark. The heights math is pure ([layout]) and unit-tested.
 */
internal object ShareCard {
    const val W = 1080
    /** 4:5. */
    const val MIN_H = 1350
    /** 9:16. */
    const val MAX_H = 1920

    /** S2 the board block fills ~88% of the width. */
    const val BODY_FRAC = 0.88f
    /** S2 the title art at ~70% width. */
    const val TITLE_FRAC = 0.70f
    /** S3 the cast row spans ~90% of the width. */
    const val CAST_FRAC = 0.90f
    /** S3 neighbors overlap by ~6% of a figure (the Home header row's tuck). */
    const val CAST_OVERLAP = 0.06f
    /** S3 the ground shadow's reach below the feet (fraction of the figure height). */
    const val CAST_SHADOW = 0.07f

    // Base gaps (3× the 360 px mockup units).
    const val TOP = 14f * U
    const val G_TITLE = 4f * U
    const val INFO_H = 15f * U
    const val G_INFO = 8f * U
    const val G_BODY = 9f * U
    const val G_STATS = 9f * U
    const val G_URL = 3f * U
    const val URL_H = 10f * U
    const val BOTTOM = 10f * U

    /** A body block at its natural (reference) size, drawn in 0..[w] × 0..[h] and scaled to fit. */
    class Body(
        val w: Float,
        val h: Float,
        /** The widest the block may be drawn, as a fraction of the card width. */
        val widthFrac: Float = BODY_FRAC,
        val draw: (Canvas) -> Unit,
    )

    class Spec(
        @DrawableRes val wallpaper: Int?,
        @DrawableRes val title: Int?,
        val titleFallback: String,
        /** The compact info line (drawn in caps). */
        val info: String,
        /** The 3D W (true) / L (false) badge after the info line; null = none. */
        val badge: Boolean? = null,
        val body: Body,
        val stats: List<ShareFinish.Stat> = emptyList(),
        val statsH: Float = ShareFinish.STATS_H,
        val titleMaxH: Float = 300f,
    )

    /** The settled vertical layout (all in card pixels). */
    data class Layout(
        val height: Int,
        val titleTop: Float, val titleH: Float,
        val infoTop: Float,
        val bodyTop: Float, val bodyScale: Float, val bodyW: Float, val bodyH: Float,
        val statsTop: Float,
        /** The cast row's baseline (the feet). */
        val castBaseline: Float, val castFigH: Float,
        val urlTop: Float,
    )

    /** The S3 cast figure height for a row [span] wide (ten trimmed figures, [CAST_OVERLAP] tuck). */
    fun castFigureHeight(span: Float): Float {
        val sum = Mascots.cast.sumOf { CastCrops.crops.getValue(it).aspect.toDouble() }.toFloat()
        return span / (sum - CAST_OVERLAP * (Mascots.cast.size - 1))
    }

    /** The cast block's height: the figures, the every-second step up, the ground shadow under the feet. */
    fun castBlockH(figH: Float): Float = figH * (1f + CastCrops.STAGGER) + figH * CAST_SHADOW

    /**
     * Pure S2 layout: sums the sections, scales a too-tall body by height so the card
     * stays inside 9:16, and spreads any shortfall under 4:5 across the gaps.
     */
    fun layout(titleH: Float, body: Body, hasStats: Boolean, statsH: Float = ShareFinish.STATS_H): Layout {
        val figH = castFigureHeight(W * CAST_FRAC)
        val castH = castBlockH(figH)
        val statsBlock = if (hasStats) statsH + G_STATS else 0f
        val fixed = TOP + titleH + G_TITLE + INFO_H + G_INFO + G_BODY + statsBlock + castH + G_URL + URL_H + BOTTOM
        val s0 = W * body.widthFrac / body.w
        val budget = MAX_H - fixed
        val s = max(0.05f, min(s0, budget / body.h))
        val bw = body.w * s
        val bh = body.h * s
        val total = fixed + bh
        // Under 4:5: spread the rest over the gaps (more around the body than at the edges).
        val extra = max(0f, MIN_H - total)
        val weights = floatArrayOf(1f, 0.5f, 1.5f, 1.5f, if (hasStats) 1f else 0f, 1f)
        val wsum = weights.sum()
        fun add(i: Int) = extra * weights[i] / wsum
        val height = total + extra
        var y = TOP + add(0)
        val titleTop = y
        y += titleH + G_TITLE + add(1)
        val infoTop = y
        y += INFO_H + G_INFO + add(2)
        val bodyTop = y
        y += bh + G_BODY + add(3)
        val statsTop = y
        if (hasStats) y += statsH + G_STATS + add(4)
        val baseline = y + figH * (1f + CastCrops.STAGGER)
        val urlTop = baseline + figH * CAST_SHADOW + G_URL
        return Layout(
            height = height.roundToInt().coerceIn(MIN_H, MAX_H),
            titleTop = titleTop, titleH = titleH, infoTop = infoTop,
            bodyTop = bodyTop, bodyScale = s, bodyW = bw, bodyH = bh,
            statsTop = statsTop, castBaseline = baseline, castFigH = figH, urlTop = urlTop,
        )
    }

    /** The title art's drawn height at [TITLE_FRAC] of the width (capped at [maxH]); 0 aspect = undecodable. */
    fun titleHeight(aspect: Float, maxH: Float): Float =
        if (aspect <= 0f) 80f else min(W * TITLE_FRAC / aspect, maxH)

    /** width / height of a drawable (bounds only, no decode); 0 when unreadable. */
    fun artAspect(context: Context, @DrawableRes res: Int?): Float = res?.let {
        runCatching {
            val o = BitmapFactory.Options().apply { inJustDecodeBounds = true; inScaled = false }
            BitmapFactory.decodeResource(context.resources, it, o)
            if (o.outWidth > 0 && o.outHeight > 0) o.outWidth.toFloat() / o.outHeight else 0f
        }.getOrDefault(0f)
    } ?: 0f

    /** Render the whole card. */
    fun render(context: Context, spec: Spec): Bitmap {
        val aspect = artAspect(context, spec.title)
        val l = layout(titleHeight(aspect, spec.titleMaxH), spec.body, spec.stats.isNotEmpty(), spec.statsH)
        val bmp = Bitmap.createBitmap(W, l.height, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val fonts = ShareFinish.Fonts(context)
        ShareFinish.drawWallpaper(context, c, spec.wallpaper ?: R.drawable.art_wall_home)
        val cx = W / 2f

        // Title art (~70% width), or the fallback in soft type.
        val drawn = if (aspect > 0f) spec.title?.let { ShareFinish.drawArtFit(context, c, it, cx, l.titleTop, W * TITLE_FRAC, l.titleH, alignTop = false) } else null
        if (drawn == null) {
            val p = ShareFinish.softPaint(fonts, 64f)
            ShareFinish.fitText(p, spec.titleFallback, W * TITLE_FRAC)
            c.drawText(spec.titleFallback, cx, l.titleTop + l.titleH / 2f - (p.ascent() + p.descent()) / 2f, p)
        }

        drawInfoLine(context, c, fonts, spec.info, spec.badge, l.infoTop)

        // The body, scaled into its slot (centered).
        c.save()
        c.translate(cx - l.bodyW / 2f, l.bodyTop)
        c.scale(l.bodyScale, l.bodyScale)
        spec.body.draw(c)
        c.restore()

        if (spec.stats.isNotEmpty()) {
            val half = W * BODY_FRAC / 2f
            ShareFinish.drawStats(c, fonts, spec.stats, cx - half, cx + half, l.statsTop, spec.statsH)
        }

        drawCastWordmark(context, c, cx, l.castBaseline, l.castFigH)
        drawSiteLine(c, fonts, l.urlTop)
        return bmp
    }

    /** The compact info line: caps, weight 900, #5b3c96, the 3D W / L badge after it; centered. */
    fun drawInfoLine(context: Context, c: Canvas, fonts: ShareFinish.Fonts, text: String, badge: Boolean?, top: Float) {
        val t = text.uppercase(Locale.US)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = fonts.black; textSize = 12f * U; color = ShareFinish.INK_LABEL; letterSpacing = 0.12f
            textAlign = Paint.Align.LEFT
            ShareFinish.softShadow(this)
        }
        val b = if (badge != null) INFO_H else 0f
        val gap = if (badge != null) 3f * U else 0f
        ShareFinish.fitText(p, t, W - 2 * 18f * U - b - gap)
        val tw = p.measureText(t)
        val x0 = W / 2f - (tw + gap + b) / 2f
        val cy = top + INFO_H / 2f
        c.drawText(t, x0, cy - (p.ascent() + p.descent()) / 2f, p)
        if (badge != null) {
            ShareFinish.drawArtInto(context, c, if (badge) R.drawable.icon3d_badge_w else R.drawable.icon3d_badge_l,
                RectF(x0 + tw + gap, cy - b / 2f, x0 + tw + gap + b, cy + b / 2f))
        }
    }

    /**
     * S3 the cast wordmark: the ten hero figures (trimmed with CastCrops) in WORDOCIOUS
     * order, touching with a [CAST_OVERLAP] tuck, every second one a step higher (the
     * Home header's stagger), centered on [cx] with the feet on [baseline], over one
     * soft ground shadow. Each figure keeps its own soft drop shadow, no bubbles.
     * X: in [season] "halloween" the costumes (`art_halloween_<id>`) are the wordmark.
     */
    fun drawCastWordmark(
        context: Context, c: Canvas, cx: Float, baseline: Float, figH: Float,
        season: String? = com.wordocious.app.ui.SeasonSkins.current(),
    ) {
        val cast = Mascots.cast
        val frames = cast.map { com.wordocious.app.ui.SeasonSkins.frame(it, season) }
        val widths = frames.map { it.crop.aspect * figH }
        val span = widths.sum() - CAST_OVERLAP * figH * (cast.size - 1)
        // The ground shadow: one soft oval under the whole row.
        runCatching {
            val g = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0x473C1E6E
                maskFilter = BlurMaskFilter(figH * 0.07f, BlurMaskFilter.Blur.NORMAL)
            }
            c.drawOval(RectF(cx - span * 0.5f, baseline - figH * 0.05f, cx + span * 0.5f, baseline + figH * CAST_SHADOW), g)
        }
        val lift = CastCrops.STAGGER * figH
        var x = cx - span / 2f
        val sample = if (figH < 200f) 2 else 1
        cast.forEachIndexed { i, _ ->
            val w = widths[i]
            val bottom = baseline - (if (i % 2 == 1) lift else 0f)
            val frame = frames[i]
            // The 320² costumes are smaller sources: decode them at full size.
            val src = ShareFinish.decode(context, frame.res, if (frame.source < 512) 1 else sample)
            if (src != null) {
                val crop = frame.crop
                val k = src.width / frame.source.toFloat()
                val l = (crop.left * k).roundToInt().coerceIn(0, src.width - 1)
                val t = (crop.top * k).roundToInt().coerceIn(0, src.height - 1)
                val cw = (crop.width * k).roundToInt().coerceIn(1, src.width - l)
                val ch = (crop.height * k).roundToInt().coerceIn(1, src.height - t)
                val fig = runCatching { Bitmap.createBitmap(src, l, t, cw, ch) }.getOrNull()
                if (fig != null) ShareFinish.drawWithDropShadow(c, fig, RectF(x, bottom - figH, x + w, bottom))
            }
            x += w - CAST_OVERLAP * figH
        }
    }

    /** The one tiny line under the cast (there is no link anymore, so this says where to play). */
    fun drawSiteLine(c: Canvas, fonts: ShareFinish.Fonts, top: Float) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = fonts.black; textSize = 9f * U; color = ShareFinish.INK_PURPLE; letterSpacing = 0.08f
            textAlign = Paint.Align.CENTER
            ShareFinish.softShadow(this)
        }
        c.drawText("wordocious.com", W / 2f, top + URL_H / 2f - (p.ascent() + p.descent()) / 2f, p)
    }
}
