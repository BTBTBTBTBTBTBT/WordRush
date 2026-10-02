package com.wordocious.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import androidx.annotation.DrawableRes
import com.wordocious.app.R
import com.wordocious.app.ui.Mascots
import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.TintMath
import com.wordocious.app.ui.gameTitleArtResForKey
import com.wordocious.app.ui.lightArgb

/**
 * ART_SPEC §17 "Share cards with the cast": the pieces every generated share image
 * (result, sweep, profile, leaderboard, VS) shares — the page-tint background (home
 * or the game's §15 tint, always the light stops: a shared image has no dark mode),
 * the title art header in place of a drawn game / page name, and a small cast strip
 * (the ten mascots spelling WORDOCIOUS) along the bottom above the footer. Numbers,
 * grids and results are drawn by each renderer exactly as before.
 */
internal object ShareArt {
    /** §17 cast strip: one mascot's size on the 1080 px cards, and the gap between them. */
    const val CAST_SIZE = 40f
    private const val CAST_GAP = 8f

    /**
     * Height the cast strip adds above a renderer's footer line: content that used to
     * end at `footer − x` now ends at `footer − x − STRIP_BAND`.
     */
    const val STRIP_BAND = 36f

    /** The game header art band on the result cards (between the wordmark and the stats row). */
    const val GAME_ART_TOP = 100f
    const val GAME_ART_HEIGHT = 76f
    private const val GAME_ART_MAX_WIDTH = 820f

    /**
     * §18.1 tiles on a share card (the v2 pattern, opacity baked in): ~970 px per tile at
     * 1080 wide (the on-screen 360 dp / 400 dp ratio), 100% on home / page tints, 55% on
     * a game's tint.
     */
    private const val TILE_PX = 972f
    const val TILE_ALPHA_PAGE = 1f
    private const val TILE_ALPHA_HOME = TILE_ALPHA_PAGE
    private const val TILE_ALPHA_GAME = 0.55f

    /** §11 the home tint, light. */
    fun homeStops(): IntArray = PageTint.HOME.lightArgb()

    /** §15 a game's tint (light) from its accent. */
    fun gameStops(accent: Int): IntArray = TintMath.gameLight(accent)

    /** Fill the whole card with the home tint + tiles. */
    fun drawHomeTint(context: Context, c: Canvas) = drawTint(context, c, homeStops(), TILE_ALPHA_HOME)

    /** Fill the whole card with the game's tint ([accent]) + quieter tiles. */
    fun drawGameTint(context: Context, c: Canvas, accent: Int) = drawTint(context, c, gameStops(accent), TILE_ALPHA_GAME)

    /**
     * The §11 / §15 page background on a card: a 3-stop diagonal gradient (top-left →
     * bottom-right) and the seamless letter-tile pattern on top at [tileAlpha].
     */
    fun drawTint(context: Context, c: Canvas, stops: IntArray, tileAlpha: Float) {
        val w = c.width.toFloat()
        val h = c.height.toFloat()
        val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        p.shader = LinearGradient(0f, 0f, w, h, stops, null, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, w, h, p)
        val tiles = decode(context, R.drawable.art_bg_tiles) ?: return
        val shader = BitmapShader(tiles, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
        shader.setLocalMatrix(Matrix().apply { setScale(TILE_PX / tiles.width, TILE_PX / tiles.width) })
        p.shader = shader
        p.alpha = (tileAlpha * 255).toInt()
        c.drawRect(0f, 0f, w, h, p)
    }

    /**
     * Draw the art [res] fitted (aspect kept, never stretched) inside a [maxWidth] ×
     * [maxHeight] band whose top is [top], centered on [cx] and vertically in the band.
     * Returns the drawn rect, or null when the art can't be decoded (callers then draw
     * their old text).
     */
    fun drawArt(context: Context, c: Canvas, @DrawableRes res: Int, cx: Float, top: Float, maxWidth: Float, maxHeight: Float): RectF? {
        val bmp = decode(context, res) ?: return null
        val scale = minOf(maxWidth / bmp.width, maxHeight / bmp.height)
        val w = bmp.width * scale
        val h = bmp.height * scale
        val y = top + (maxHeight - h) / 2f
        val dst = RectF(cx - w / 2f, y, cx + w / 2f, y + h)
        c.drawBitmap(bmp, null, dst, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        return dst
    }

    /**
     * The result cards' header: the game's title art (`art_game_<id>`, lettering in its
     * accent + host) in the band where the mode name used to be drawn. False when the
     * mode has no art — the caller keeps its text.
     */
    fun drawGameTitle(context: Context, c: Canvas, dbKey: String?, cx: Float): Boolean {
        val res = gameTitleArtResForKey(dbKey) ?: return false
        return drawArt(context, c, res, cx, GAME_ART_TOP, GAME_ART_MAX_WIDTH, GAME_ART_HEIGHT) != null
    }

    /**
     * §17 The cast strip: the ten mascots (WORDOCIOUS order), [size] px each, in one
     * row centered on [cx] with its vertical center at [cy].
     */
    fun drawCastStrip(context: Context, c: Canvas, cx: Float, cy: Float, size: Float = CAST_SIZE) {
        val cast = Mascots.cast
        val total = cast.size * size + (cast.size - 1) * CAST_GAP
        var x = cx - total / 2f
        val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        for (m in cast) {
            decode(context, m.res, sample = 4)?.let { bmp -> c.drawBitmap(bmp, null, RectF(x, cy - size / 2f, x + size, cy + size / 2f), p) }
            x += size + CAST_GAP
        }
    }

    /**
     * The cast strip placed just above a footer line whose text baseline is
     * [footerBaseline] (the 22 px "wordocious.com" footers): its bottom sits 12 px
     * above the footer's cap line, inside the [STRIP_BAND] the renderer freed.
     */
    fun drawCastStripAboveFooter(context: Context, c: Canvas, cx: Float, footerBaseline: Float, footerTextSize: Float = 22f) {
        val capTop = footerBaseline - footerTextSize * 0.75f
        drawCastStrip(context, c, cx, capTop - 12f - CAST_SIZE / 2f)
    }

    /** Decodes a drawable at full size (or 1/[sample]); null on failure. Share renders are rare, so no cache. */
    private fun decode(context: Context, @DrawableRes res: Int, sample: Int = 1): Bitmap? = runCatching {
        BitmapFactory.decodeResource(context.resources, res, BitmapFactory.Options().apply { inScaled = false; inSampleSize = sample })
    }.getOrNull()
}
