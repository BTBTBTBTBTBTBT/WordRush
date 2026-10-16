package com.wordocious.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.LinearGradient
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import androidx.annotation.DrawableRes
import com.wordocious.app.R
import com.wordocious.app.data.ShareFinish.U
import com.wordocious.core.ShareHero
import com.wordocious.app.ui.CastCrops
import com.wordocious.app.ui.Mascots
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The share card, night style (SPEC share-cards-1016, founder 10-16 option B). Every share image (game results, More Games,
 * Gauntlet, VS, sweep / today, profile, leaderboard) is laid out top to bottom on the night gradient (#1A0E2E to #2E1440):
 *
 *   [the DAY title art, leaderboards] · the game's TITLE ART (the season variant in season, <= [TITLE_MAX_H] tall)
 *   · one info line (caps, #E2D6FF; a soft pill on leaderboards) · the status line (lavender) · the stat chips
 *   · the body block (the finished board / the podium + rows; tall bodies scale by height, never the text)
 *   · the score breakdown panel · the footer: the cast row (real transparent art, ~15% bigger than before) on a soft light
 *   with a bright "wordocious.com" under it.
 *
 * The canvas is 1080 wide; its height is the sum of those, clamped between 4:5 (1350) and 3:4 (1440, the iMessage fix).
 * The heights math is pure ([layout]) and unit-tested.
 */
internal object ShareCard {
    const val W = 1080
    /** 4:5. */
    const val MIN_H = 1350
    /**
     * 3:4. Founder 10-12: iMessage shows an image in a bubble of at most ~3:4 and center-crops anything taller, so a card never
     * passes 1440; a tall body scales by height instead.
     */
    const val MAX_H = 1440

    /** S2 the board block fills ~88% of the width. */
    const val BODY_FRAC = 0.88f
    /** The title art: the whole art inside these side margins, never taller than [TITLE_MAX_H] (SPEC: ~150 px). */
    const val TITLE_MARGIN = 90f
    const val TITLE_MAX_W = W - 2 * TITLE_MARGIN
    const val TITLE_MAX_H = 150f
    /** The leaderboards' day title above the game title (SPEC: ~210 px). */
    const val DAY_MAX_H = 210f
    const val DAY_MAX_W = 620f
    /** The lettered title's band when the art doesn't decode. */
    const val TITLE_FALLBACK_H = 96f
    /** The cast row spans ~92% of the width (SPEC: ~15% larger than the old 80%). */
    const val CAST_FRAC = 0.92f
    /** S3 neighbors overlap by ~6% of a figure (the Home header row's tuck). */
    const val CAST_OVERLAP = 0.06f
    /** The soft light's reach below the feet (fraction of the figure height). */
    const val CAST_SHADOW = 0.07f

    const val TOP = 28f
    const val G_TITLE = 8f
    const val INFO_H = 40f
    /** The leaderboards' info pill. */
    const val PILL_H = 54f
    const val G_INFO = 14f
    const val STATUS_H = 64f
    const val G_STATS = 18f
    const val G_BODY = 18f
    const val G_PANEL = 16f
    const val G_FOOT = 14f
    const val G_URL = 8f
    /** The site line: 34 px black weight, bright. */
    const val URL_SIZE = 34f
    const val URL_H = 44f
    const val BOTTOM = 22f

    /** A body block at its natural (reference) size, drawn in 0..[w] x 0..[h] and scaled to fit. */
    class Body(
        val w: Float,
        val h: Float,
        /** The widest the block may be drawn, as a fraction of the card width. */
        val widthFrac: Float = BODY_FRAC,
        /** A block under the scaled part that is drawn at its natural size (leaderboard rows: the podium scales, never the text). */
        val fixedH: Float = 0f,
        val drawFixed: ((Canvas) -> Unit)? = null,
        val draw: (Canvas) -> Unit,
    )

    class Spec(
        /** Ignored since the night frame (kept so every caller still compiles). */
        @DrawableRes val wallpaper: Int?,
        @DrawableRes val title: Int?,
        val titleFallback: String,
        /** The info line (drawn in caps). */
        val info: String,
        /** Ignored since the night frame (the W / L badge is gone from the info line). */
        val badge: Boolean? = null,
        val body: Body,
        val stats: List<ShareFinish.Stat> = emptyList(),
        val statsH: Float = ShareFinish.STATS_H,
        val titleMaxH: Float = TITLE_MAX_H,
        /** Ignored since the night frame (no hero band; the cast footer is the mascot moment). */
        val hero: ShareHero.Result? = null,
        val heroUserId: String? = null,
        val heroUsername: String? = null,
        /** The status line in lavender ("Board cleared", "Solved in 3"); null = none. */
        val status: String? = null,
        /** Leaderboards: the day title art ([DAY_MAX_H]) above the game title. */
        @DrawableRes val dayTitle: Int? = null,
        val dayMaxH: Float = DAY_MAX_H,
        /** Leaderboards: the info line sits in a soft white-10% pill. */
        val infoPill: Boolean = false,
        /** The finished card's score breakdown panel under the board. */
        val panel: ShareBreakdown.Panel? = null,
    )

    /** The settled vertical layout (all in card pixels). */
    data class Layout(
        val height: Int,
        val titleTop: Float, val titleH: Float,
        val infoTop: Float,
        val heroTop: Float = 0f,
        val bodyTop: Float, val bodyScale: Float, val bodyW: Float, val bodyH: Float,
        val statsTop: Float,
        /** The cast row's baseline (the feet). */
        val castBaseline: Float, val castFigH: Float,
        val urlTop: Float,
        val dayTop: Float = 0f, val dayH: Float = 0f,
        val statusTop: Float = 0f,
        val panelTop: Float = 0f, val panelH: Float = 0f,
    )

    /** The S3 cast figure height for a row [span] wide (ten trimmed figures, [CAST_OVERLAP] tuck). */
    fun castFigureHeight(span: Float): Float {
        val sum = Mascots.cast.sumOf { CastCrops.crops.getValue(it).aspect.toDouble() }.toFloat()
        return span / (sum - CAST_OVERLAP * (Mascots.cast.size - 1))
    }

    /** The cast block's height: the figures, the every-second step up, the light under the feet. */
    fun castBlockH(figH: Float): Float = figH * (1f + CastCrops.STAGGER) + figH * CAST_SHADOW

    /**
     * Pure layout: sums the sections top-down, scales a too-tall body by height so the card stays inside 3:4, and spreads any
     * shortfall under 4:5 across the gaps. [heroBand] is accepted for old callers and ignored (0).
     */
    @Suppress("UNUSED_PARAMETER")
    fun layout(
        titleH: Float, body: Body, hasStats: Boolean, statsH: Float = ShareFinish.STATS_H, heroBand: Float = 0f,
        dayH: Float = 0f, statusH: Float = 0f, panelH: Float = 0f, infoH: Float = INFO_H,
    ): Layout {
        val figH = castFigureHeight(W * CAST_FRAC)
        val castH = castBlockH(figH)
        val statsBlock = if (hasStats) statsH + G_STATS else 0f
        val panelBlock = if (panelH > 0f) panelH + G_PANEL else 0f
        val fixed = TOP + dayH + titleH + G_TITLE + infoH + G_INFO + statusH + statsBlock + G_BODY + panelBlock + G_FOOT + castH + G_URL + URL_H + BOTTOM + body.fixedH
        val s0 = W * body.widthFrac / body.w
        val budget = MAX_H - fixed
        val s = max(0.05f, min(s0, budget / body.h))
        val bw = body.w * s
        val bh = body.h * s
        val total = fixed + bh
        // Under 4:5: spread the rest over the gaps (more around the body than at the edges).
        val extra = max(0f, MIN_H - total)
        val weights = floatArrayOf(1f, 0.5f, 1f, if (hasStats) 1f else 0f, 1.5f, if (panelH > 0f) 1f else 0f, 1f)
        val wsum = weights.sum()
        fun add(i: Int) = extra * weights[i] / wsum
        val height = total + extra
        var y = TOP + add(0)
        val dayTop = y
        y += dayH
        val titleTop = y
        y += titleH + G_TITLE + add(1)
        val infoTop = y
        y += infoH + G_INFO + add(2)
        val statusTop = y
        y += statusH
        val statsTop = y
        if (hasStats) y += statsH + G_STATS + add(3)
        y += 0f
        val bodyTop = y
        y += bh + body.fixedH + G_BODY + add(4)
        val panelTop = y
        if (panelH > 0f) y += panelH + G_PANEL + add(5)
        y += G_FOOT
        val baseline = y + figH * (1f + CastCrops.STAGGER)
        val urlTop = baseline + figH * CAST_SHADOW + G_URL
        return Layout(
            height = height.roundToInt().coerceIn(MIN_H, MAX_H),
            titleTop = titleTop, titleH = titleH, infoTop = infoTop,
            bodyTop = bodyTop, bodyScale = s, bodyW = bw, bodyH = bh,
            statsTop = statsTop, castBaseline = baseline, castFigH = figH, urlTop = urlTop,
            dayTop = dayTop, dayH = dayH, statusTop = statusTop, panelTop = panelTop, panelH = panelH,
        )
    }

    /** The title art's drawn height: the whole art fit in [TITLE_MAX_W] x [maxH]; 0 aspect = undecodable. */
    fun titleHeight(aspect: Float, maxH: Float = TITLE_MAX_H): Float =
        if (aspect <= 0f) TITLE_FALLBACK_H else min(TITLE_MAX_W / aspect, maxH)

    /** The day title's drawn height ([DAY_MAX_H] / [DAY_MAX_W] fit); 0 = no day title. */
    fun dayHeight(aspect: Float, maxH: Float = DAY_MAX_H): Float = if (aspect <= 0f) 0f else min(DAY_MAX_W / aspect, maxH)

    /** A title box in card pixels (plain, so JVM unit tests can read it). */
    data class Box(val left: Float, val top: Float, val right: Float, val bottom: Float)

    /** Where the title art is drawn: the whole art centered on the card in its band at [Layout.titleTop]. */
    fun titleRect(aspect: Float, l: Layout): Box {
        val w = if (aspect > 0f) min(TITLE_MAX_W, l.titleH * aspect) else TITLE_MAX_W
        val h = if (aspect > 0f) w / aspect else l.titleH
        val top = l.titleTop + (l.titleH - h) / 2f
        return Box(W / 2f - w / 2f, top, W / 2f + w / 2f, top + h)
    }

    /** True when [r] sits fully on the card, inside the title margins and above the info line. */
    fun titleFits(r: Box, l: Layout): Boolean =
        r.left >= TITLE_MARGIN - 0.5f && r.right <= W - TITLE_MARGIN + 0.5f &&
            r.top >= 0f && r.bottom <= minOf(l.infoTop, l.height.toFloat()) + 0.5f

    /** width / height of a drawable (bounds only, no decode); 0 when unreadable. */
    fun artAspect(context: Context, @DrawableRes res: Int?): Float = res?.let {
        runCatching {
            val o = BitmapFactory.Options().apply { inJustDecodeBounds = true; inScaled = false }
            BitmapFactory.decodeResource(context.resources, it, o)
            if (o.outWidth > 0 && o.outHeight > 0) o.outWidth.toFloat() / o.outHeight else 0f
        }.getOrDefault(0f)
    } ?: 0f

    /** The night page: a vertical gradient, no wallpaper, no cream. */
    fun drawNight(c: Canvas) {
        val p = Paint().apply {
            shader = LinearGradient(0f, 0f, 0f, c.height.toFloat(), ShareFinish.NIGHT_TOP, ShareFinish.NIGHT_BOTTOM, Shader.TileMode.CLAMP)
        }
        c.drawRect(0f, 0f, c.width.toFloat(), c.height.toFloat(), p)
    }

    /** Render the whole card. */
    fun render(context: Context, spec: Spec): Bitmap {
        val season = com.wordocious.app.ui.SeasonSkins.current()
        // The game's title art, in its season variant (e.g. the Halloween drip) when one ships.
        val titleRes = spec.title?.let { runCatching { com.wordocious.app.ui.SeasonKit.title(context, it, season) }.getOrDefault(it) }
        val aspect = artAspect(context, titleRes)
        val dayAspect = artAspect(context, spec.dayTitle)
        val l = layout(
            titleHeight(aspect, spec.titleMaxH), spec.body, spec.stats.isNotEmpty(), spec.statsH,
            dayH = dayHeight(dayAspect, spec.dayMaxH), statusH = if (spec.status.isNullOrBlank()) 0f else STATUS_H,
            panelH = spec.panel?.height ?: 0f, infoH = if (spec.infoPill) PILL_H else INFO_H,
        )
        val bmp = Bitmap.createBitmap(W, l.height, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val fonts = ShareFinish.Fonts(context)
        drawNight(c)
        val cx = W / 2f

        if (spec.dayTitle != null && l.dayH > 0f) {
            ShareFinish.drawArtFit(context, c, spec.dayTitle, cx, l.dayTop, DAY_MAX_W, l.dayH, alignTop = false)
        }
        // The whole title art, or the fallback in soft type.
        val drawn = if (aspect > 0f && titleRes != null) ShareFinish.drawArtFit(context, c, titleRes, cx, l.titleTop, TITLE_MAX_W, l.titleH, alignTop = false) else null
        if (drawn == null) {
            val p = ShareFinish.softPaint(fonts, 64f)
            ShareFinish.fitText(p, spec.titleFallback, TITLE_MAX_W)
            c.drawText(spec.titleFallback, cx, l.titleTop + l.titleH / 2f - (p.ascent() + p.descent()) / 2f, p)
        }

        drawInfoLine(c, fonts, spec.info, l.infoTop, spec.infoPill)
        spec.status?.takeIf { it.isNotBlank() }?.let { drawStatus(c, fonts, it, l.statusTop) }

        if (spec.stats.isNotEmpty()) {
            val half = W * BODY_FRAC / 2f
            ShareFinish.drawStats(c, fonts, spec.stats, cx - half, cx + half, l.statsTop, spec.statsH)
        }

        // The body, scaled into its slot (centered).
        c.save()
        c.translate(cx - l.bodyW / 2f, l.bodyTop)
        c.scale(l.bodyScale, l.bodyScale)
        spec.body.draw(c)
        c.restore()
        spec.body.drawFixed?.let { fixed ->
            c.save()
            c.translate(cx - spec.body.w / 2f, l.bodyTop + l.bodyH)
            fixed(c)
            c.restore()
        }

        spec.panel?.let { it.draw(c, fonts, 40f, l.panelTop, W - 80f) }

        drawCastWordmark(context, c, cx, l.castBaseline, l.castFigH, season)
        drawSiteLine(c, fonts, l.urlTop)
        return bmp
    }

    /** The info line: caps, black weight ~27 px, #E2D6FF, centered; on [pill] a soft white-10% pill under it. */
    fun drawInfoLine(c: Canvas, fonts: ShareFinish.Fonts, text: String, top: Float, pill: Boolean = false) {
        val t = text.uppercase(Locale.US)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = if (pill) fonts.heavy else fonts.black; textSize = 27f; color = ShareFinish.INK_INFO; letterSpacing = if (pill) 0.04f else 0.08f
            textAlign = Paint.Align.CENTER
        }
        ShareFinish.fitText(p, t, W - 2 * 70f)
        val cy = top + (if (pill) PILL_H else INFO_H) / 2f
        if (pill) {
            val tw = p.measureText(t)
            val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x1AFFFFFF }
            c.drawRoundRect(RectF(W / 2f - tw / 2f - 26f, top, W / 2f + tw / 2f + 26f, top + PILL_H), PILL_H / 2f, PILL_H / 2f, bg)
        }
        c.drawText(t, W / 2f, cy - (p.ascent() + p.descent()) / 2f, p)
    }

    /** The status line in lavender, soft heavy type. */
    fun drawStatus(c: Canvas, fonts: ShareFinish.Fonts, text: String, top: Float) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = fonts.black; textSize = 44f; color = 0xFFC9B6FF.toInt(); textAlign = Paint.Align.CENTER
        }
        ShareFinish.fitText(p, text, W - 2 * 90f)
        c.drawText(text, W / 2f, top + STATUS_H / 2f - (p.ascent() + p.descent()) / 2f + 2f, p)
    }

    /**
     * The cast footer: the ten hero figures (the real transparent art, trimmed with CastCrops) in WORDOCIOUS order, touching
     * with a [CAST_OVERLAP] tuck, every second one a step higher, centered on [cx] with the feet on [baseline], over a wide soft
     * light (a radial glow, white ~12%) so the row reads on night. In [season] "halloween" the costumes are the wordmark.
     */
    fun drawCastWordmark(
        context: Context, c: Canvas, cx: Float, baseline: Float, figH: Float,
        season: String? = com.wordocious.app.ui.SeasonSkins.current(),
    ) {
        val cast = Mascots.cast
        val frames = cast.map { com.wordocious.app.ui.SeasonSkins.frame(it, season) }
        val widths = frames.map { it.crop.aspect * figH }
        val span = widths.sum() - CAST_OVERLAP * figH * (cast.size - 1)
        // The soft light under the row: a wide ellipse, white ~12% at its heart, fading to nothing.
        run {
            val gw = span * 0.62f
            val gh = figH * 0.95f
            val gcy = baseline - figH * 0.34f
            val g = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = RadialGradient(0f, 0f, gw, intArrayOf(0x1FFFFFFF, 0x12FFFFFF, 0x00FFFFFF), floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP)
            }
            c.save()
            c.translate(cx, gcy)
            c.scale(1f, gh / gw)
            c.drawCircle(0f, 0f, gw, g)
            c.restore()
        }
        val lift = CastCrops.STAGGER * figH
        var x = cx - span / 2f
        val sample = if (figH < 200f) 2 else 1
        cast.forEachIndexed { i, _ ->
            val w = widths[i]
            val bottom = baseline - (if (i % 2 == 1) lift else 0f)
            val frame = frames[i]
            // The 320 px costumes are smaller sources: decode them at full size.
            val src = ShareFinish.decode(context, frame.res, if (frame.source < 512) 1 else sample)
            if (src != null) {
                val crop = frame.crop
                val k = src.width / frame.source.toFloat()
                val l = (crop.left * k).roundToInt().coerceIn(0, src.width - 1)
                val t = (crop.top * k).roundToInt().coerceIn(0, src.height - 1)
                val cw = (crop.width * k).roundToInt().coerceIn(1, src.width - l)
                val ch = (crop.height * k).roundToInt().coerceIn(1, src.height - t)
                val fig = runCatching { Bitmap.createBitmap(src, l, t, cw, ch) }.getOrNull()
                if (fig != null) ShareFinish.drawWithDropShadow(c, fig, RectF(x, bottom - figH, x + w, bottom), shadowColor = 0x66000000)
            }
            x += w - CAST_OVERLAP * figH
        }
    }

    /** The site line under the cast: bright solid lettering, 34 px black weight, #EDE6FF. */
    fun drawSiteLine(c: Canvas, fonts: ShareFinish.Fonts, top: Float) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = fonts.black; textSize = URL_SIZE; color = 0xFFEDE6FF.toInt(); letterSpacing = 0.04f
            textAlign = Paint.Align.CENTER
            setShadowLayer(8f, 0f, 2f, 0x99000000.toInt())
        }
        c.drawText("wordocious.com", W / 2f, top + URL_H / 2f - (p.ascent() + p.descent()) / 2f, p)
    }
}
