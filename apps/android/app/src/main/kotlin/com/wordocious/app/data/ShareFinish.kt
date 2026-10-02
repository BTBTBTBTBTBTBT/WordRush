package com.wordocious.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import androidx.annotation.DrawableRes
import androidx.compose.ui.graphics.toArgb
import androidx.core.content.res.ResourcesCompat
import com.wordocious.app.R
import com.wordocious.app.ui.CastPoses
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.Mascots
import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.TintMath
import com.wordocious.app.ui.Wash
import com.wordocious.app.ui.game.TileLook
import com.wordocious.app.ui.game.TileLooks
import com.wordocious.app.ui.lightArgb
import com.wordocious.core.TileState
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max
import kotlin.math.min

/**
 * FINISH_SPEC E1 — the share-image kit every generated card (game results, the
 * sweep / today cards, profile, leaderboard, VS) is drawn with: the finishing-touches
 * `.sharecard` at 3 × the 360 px mockup — the wallpaper full bleed, glossy result
 * tiles (the B1 / §20 tile recipe: lip + gradient face + top gloss — never a flat
 * square, never a white empty cell), the tinted stat windows with top bars (purple /
 * blue / gold, soft numbers) and A1 tinted surfaces. [ShareCard] lays these out fitted
 * to the content (S2) and closes every card with the cast wordmark (S3). Pure drawing
 * helpers: the renderers own their data.
 */
internal object ShareFinish {
    /** The 1080 px card is the 360 px mockup at 3×. */
    const val U = 3f

    const val INK_LABEL = 0xFF5B3C96.toInt()
    const val INK_HEADING = 0xFF2A1650.toInt()
    const val INK_SOFT = 0xFF3B1A78.toInt()
    const val INK_PURPLE = 0xFF6D28D9.toInt()
    const val INK_MUTED = 0xFF6F5F8F.toInt()
    const val LOSS_RED = 0xFFDC2626.toInt()

    // ── fonts ────────────────────────────────────────────────────────────

    /** The bundled Nunito at [weight] (variable font: the weighted create drives the real `wght` axis). */
    fun nunito(context: Context, weight: Int): Typeface {
        val base = ResourcesCompat.getFont(context, R.font.nunito) ?: Typeface.DEFAULT
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Typeface.create(base, weight, false)
        else Typeface.create(base, if (weight >= 800) Typeface.BOLD else Typeface.NORMAL)
    }

    class Fonts(context: Context) {
        val black: Typeface = nunito(context, 900)
        val heavy: Typeface = nunito(context, 800)
        val bold: Typeface = nunito(context, 700)
    }

    // ── background ───────────────────────────────────────────────────────

    /**
     * The wallpaper full bleed (cover-cropped, centered) — [res] null or undecodable
     * falls back to the soft lilac → pink page gradient (the light home tint).
     */
    fun drawWallpaper(context: Context, c: Canvas, @DrawableRes res: Int?) {
        val w = c.width.toFloat(); val h = c.height.toFloat()
        val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        p.shader = LinearGradient(0f, 0f, w, h, PageTint.HOME.lightArgb(), null, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, w, h, p)
        p.shader = null
        val bmp = res?.let { decode(context, it, sampleFor(context, it, c.width)) } ?: return
        val scale = max(w / bmp.width, h / bmp.height)
        val dw = bmp.width * scale; val dh = bmp.height * scale
        c.drawBitmap(bmp, null, RectF((w - dw) / 2f, (h - dh) / 2f, (w + dw) / 2f, (h + dh) / 2f), p)
    }

    /** A catalog mode id's wallpaper (`art_wall_game_<id>`), else the Home wallpaper. */
    @DrawableRes
    fun gameWallpaper(modeId: String?): Int = com.wordocious.app.ui.gameWallpaperRes(modeId) ?: R.drawable.art_wall_home

    /** [gameWallpaper] for a mode db key (DUEL, SUDOKU, …). */
    @DrawableRes
    fun gameWallpaperForKey(dbKey: String?): Int = gameWallpaper(dbKey?.let { com.wordocious.app.ModeGen.byDbKey(it)?.id })

    // ── art ──────────────────────────────────────────────────────────────

    /** Art [res] fitted (aspect kept) in a [maxW] × [maxH] band whose top is [top], centered on [cx]; null when undecodable. */
    fun drawArtFit(context: Context, c: Canvas, @DrawableRes res: Int, cx: Float, top: Float, maxW: Float, maxH: Float, alignTop: Boolean = true): RectF? {
        val bmp = decode(context, res, 1) ?: return null
        val scale = min(maxW / bmp.width, maxH / bmp.height)
        val w = bmp.width * scale; val h = bmp.height * scale
        val y = if (alignTop) top else top + (maxH - h) / 2f
        val dst = RectF(cx - w / 2f, y, cx + w / 2f, y + h)
        c.drawBitmap(bmp, null, dst, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        return dst
    }

    /** Draw [res] into [dst] (stretched to it — callers pass the art's own aspect). */
    fun drawArtInto(context: Context, c: Canvas, @DrawableRes res: Int, dst: RectF, sample: Int = 1): Boolean {
        val bmp = decode(context, res, sample) ?: return false
        c.drawBitmap(bmp, null, dst, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        return true
    }

    // ── text ─────────────────────────────────────────────────────────────

    /** Shrink [p]'s text size until [text] fits [maxW]. */
    fun fitText(p: Paint, text: String, maxW: Float) {
        val w = p.measureText(text)
        if (w > maxW && w > 0f) p.textSize *= maxW / w
    }

    /** The soft white highlight under light-background text (text-shadow 0 1px 0 rgba(255,255,255,.8)). */
    fun softShadow(p: Paint, dy: Float = U) = p.setShadowLayer(0.01f, 0f, dy, 0xCCFFFFFF.toInt())

    /** A2 soft number on the card: Nunito Black #3b1a78, tabular figures, the soft white highlight. */
    fun softPaint(fonts: Fonts, size: Float, align: Paint.Align = Paint.Align.CENTER, color: Int = INK_SOFT): Paint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = fonts.black; textSize = size; this.color = color; textAlign = align
            fontFeatureSettings = "tnum"; letterSpacing = -0.01f
            softShadow(this)
        }

    /** Vertically centered text (web textBaseline = middle). */
    fun Canvas.textMid(text: String, x: Float, cy: Float, p: Paint) = drawText(text, x, cy - (p.ascent() + p.descent()) / 2f, p)

    /** "FRIDAY, OCT 2" for a yyyy-MM-dd [day] (today when null / unparseable). */
    fun dayCaps(day: String?): String {
        val d = day?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.now()
        return d.format(DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.US)).uppercase(Locale.US)
    }

    // ── glossy tiles (B1 / §20) ──────────────────────────────────────────

    /** A Canvas-ready tile look (ARGB ints). */
    class Look(
        val edge: Int, val top: Int, val mid: Int, val bottom: Int,
        val ring: Int = 0, val ringFrac: Float = 0f, val gloss: Float = 0.55f,
        val glyph: Int = 0xFFFFFFFF.toInt(), val glyphShadow: Int = 0x59000000,
    )

    private fun TileLook.argb() = Look(
        edge.toArgb(), faceTop.toArgb(), faceMid.toArgb(), faceBottom.toArgb(),
        ring?.toArgb() ?: 0, ringFrac, gloss, glyph.toArgb(), glyphShadow.toArgb(),
    )

    /** Purple right spot, gold wrong spot, slate absent, frosted empty (the game kit's own looks). */
    val CORRECT: Look by lazy { TileLooks.CORRECT.argb() }
    val PRESENT: Look by lazy { TileLooks.PRESENT.argb() }
    val ABSENT: Look by lazy { TileLooks.ABSENT.argb() }
    val FROSTED: Look by lazy { TileLooks.EMPTY.argb() }

    /** A board tile's look for an evaluated [state] (hint rows read as absent, iOS parity). */
    fun lookFor(state: TileState): Look = when (state) {
        TileState.CORRECT -> CORRECT
        TileState.PRESENT -> PRESENT
        TileState.ABSENT, TileState.HINT_USED -> ABSENT
        TileState.EMPTY -> FROSTED
    }

    /** A solid tile family from one [base] color (light top → base → a touch darker, a darker lip). */
    fun family(base: Int, gloss: Float = 0.55f): Look = Look(
        edge = TintMath.over(0xFF000000.toInt(), 0.38f, base),
        top = TintMath.over(0xFFFFFFFF.toInt(), 0.28f, base),
        mid = base or (0xFF shl 24),
        bottom = TintMath.over(0xFF000000.toInt(), 0.08f, base),
        gloss = gloss,
    )

    /** The frosted tile wearing an [accent] ring (an unsolved target / a ringed slot). */
    fun frostedRing(accent: Int): Look = FROSTED.let { Look(it.edge, it.top, it.mid, it.bottom, (accent and 0x00FFFFFF) or (0x99 shl 24), 0.05f, it.gloss, INK_SOFT, 0) }

    /** Paint one tile in [r]: the lip, the face 7% up with its vertical gradient (+ ring), then the gloss. */
    fun drawTile(c: Canvas, r: RectF, look: Look, glyph: String? = null, glyphFace: Typeface? = null, glyphScale: Float = 0.56f) {
        val s = min(r.width(), r.height())
        val rad = s * 0.22f
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.color = look.edge
        c.drawRoundRect(r, rad, rad, p)
        val faceBottom = r.top + r.height() * (1f - 0.07f)
        val face = RectF(r.left, r.top, r.right, faceBottom)
        p.shader = LinearGradient(0f, face.top, 0f, face.bottom, intArrayOf(look.top, look.mid, look.bottom), floatArrayOf(0f, 0.7f, 1f), Shader.TileMode.CLAMP)
        c.drawRoundRect(face, rad, rad, p)
        p.shader = null
        if (look.ring != 0 && look.ringFrac > 0f) {
            val sw = max(0.75f, s * look.ringFrac)
            p.style = Paint.Style.STROKE; p.strokeWidth = sw; p.color = look.ring
            c.drawRoundRect(RectF(face.left + sw / 2, face.top + sw / 2, face.right - sw / 2, face.bottom - sw / 2), max(0f, rad - sw / 2), max(0f, rad - sw / 2), p)
            p.style = Paint.Style.FILL
        }
        if (look.gloss > 0f) {
            val gx = r.width() * 0.08f; val gy = r.height() * 0.06f; val gh = r.height() * 0.38f
            val gr = RectF(r.left + gx, r.top + gy, r.right - gx, r.top + gy + gh)
            p.shader = LinearGradient(0f, gr.top, 0f, gr.bottom, ((look.gloss * 255).toInt() shl 24) or 0xFFFFFF, 0x00FFFFFF, Shader.TileMode.CLAMP)
            c.drawRoundRect(gr, s * 0.18f, s * 0.18f, p)
            p.shader = null
        }
        if (!glyph.isNullOrEmpty()) {
            val t = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                textAlign = Paint.Align.CENTER; typeface = glyphFace ?: Typeface.DEFAULT_BOLD
                color = look.glyph; textSize = max(8f, s * glyphScale)
                if (look.glyphShadow != 0) setShadowLayer(s * 0.02f, 0f, s * 0.03f, look.glyphShadow)
            }
            c.textMid(glyph, face.centerX(), face.centerY(), t)
        }
    }

    // ── tinted surfaces (A1) ─────────────────────────────────────────────

    fun wash(accent: Int, amount: Float = Wash.CARD): Int = Wash.mixArgb(accent, amount)

    /**
     * A1 tinted card: the accent wash, a 1.5-unit accent line, [radius], a soft violet
     * lift and (optional) the game-card top bar of [barH] in [bar] (a solid or 2-stop gradient).
     */
    fun drawTintedCard(
        c: Canvas, r: RectF, radius: Float, tint: Int, line: Int,
        bar: IntArray? = null, barH: Float = 0f, shadow: Int = 0x1F3C1E6E, shadowDy: Float = 6f * U, shadowBlur: Float = 14f * U,
    ) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.color = tint
        if (shadow != 0) p.setShadowLayer(shadowBlur / 2f, 0f, shadowDy, shadow)
        c.drawRoundRect(r, radius, radius, p)
        p.clearShadowLayer()
        if (bar != null && barH > 0f) {
            c.save()
            c.clipPath(Path().apply { addRoundRect(r, radius, radius, Path.Direction.CW) })
            p.shader = if (bar.size > 1) LinearGradient(r.left, 0f, r.right, 0f, bar, null, Shader.TileMode.CLAMP) else null
            if (bar.size == 1) p.color = bar[0]
            c.drawRect(r.left, r.top, r.right, r.top + barH, p)
            p.shader = null
            c.restore()
        }
        p.style = Paint.Style.STROKE; p.strokeWidth = 1.5f * U; p.color = line
        val i = p.strokeWidth / 2f
        c.drawRoundRect(RectF(r.left + i, r.top + i, r.right - i, r.bottom - i), radius - i, radius - i, p)
    }

    /** A1 an accent card: wash 13%, line 32%, the accent bar. */
    fun drawAccentCard(c: Canvas, r: RectF, accent: Int, radius: Float, barH: Float = 0f, washAmount: Float = Wash.CARD) =
        drawTintedCard(c, r, radius, wash(accent, washAmount), wash(accent, Wash.LINE), if (barH > 0f) intArrayOf(accent or (0xFF shl 24)) else null, barH,
            shadow = ((0x33 shl 24) or (accent and 0x00FFFFFF)), shadowDy = 3f * U, shadowBlur = 8f * U)

    /**
     * A1 icon tile as a mini game card (`.gi` / `.wt`): wash 13%, 1.5 border at 34%, a
     * 4-unit accent bar across the top, soft accent shadow, the game icon at 74%.
     */
    fun drawMiniGameCard(context: Context, c: Canvas, r: RectF, accent: Int, @DrawableRes icon: Int?, unit: Float = U, iconFrac: Float = 0.74f) {
        val a = accent or (0xFF shl 24)
        val radius = r.width() * 0.26f
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.color = Wash.mixArgb(a, Wash.CARD)
        p.setShadowLayer(4f * unit, 0f, 2f * unit, (0x33 shl 24) or (a and 0x00FFFFFF))
        c.drawRoundRect(r, radius, radius, p)
        p.clearShadowLayer()
        c.save()
        c.clipPath(Path().apply { addRoundRect(r, radius, radius, Path.Direction.CW) })
        p.color = a
        c.drawRect(r.left, r.top, r.right, r.top + 4f * unit, p)
        c.restore()
        p.style = Paint.Style.STROKE; p.strokeWidth = 1.5f * unit; p.color = Wash.mixArgb(a, 0.34f)
        val i = p.strokeWidth / 2f
        c.drawRoundRect(RectF(r.left + i, r.top + i, r.right - i, r.bottom - i), radius - i, radius - i, p)
        if (icon != null) {
            val s = r.width() * iconFrac
            val cy = r.centerY() + 2f * unit
            drawArtInto(context, c, icon, RectF(r.centerX() - s / 2, cy - s / 2, r.centerX() + s / 2, cy + s / 2))
        }
    }

    /** A dashed accent outline (an unplayed / unsolved slot). */
    fun drawDashed(c: Canvas, r: RectF, radius: Float, color: Int, width: Float = 1.5f * U) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = width; this.color = color
            pathEffect = DashPathEffect(floatArrayOf(6f * U, 4f * U), 0f)
        }
        c.drawRoundRect(r, radius, radius, p)
    }

    // ── stat windows ─────────────────────────────────────────────────────

    /** The three `.sc-stats` palettes: purple guesses, blue time, gold points. */
    enum class Window(val tint: Int, val line: Int, val bar: IntArray, val label: Int) {
        PURPLE(0xFFF5EEFF.toInt(), 0xFFE2D3FF.toInt(), intArrayOf(0xFF7C3AED.toInt(), 0xFFA855F7.toInt()), 0xFF6D28D9.toInt()),
        BLUE(0xFFEAF2FF.toInt(), 0xFFCFE0FF.toInt(), intArrayOf(0xFF0A6CFF.toInt(), 0xFF60A5FA.toInt()), 0xFF2456A8.toInt()),
        GOLD(0xFFFFF5DF.toInt(), 0xFFF8E2B4.toInt(), intArrayOf(0xFFF5A524.toInt(), 0xFFFFD166.toInt()), 0xFFA2560C.toInt()),
        PINK(0xFFFFEEF7.toInt(), 0xFFFBCFE8.toInt(), intArrayOf(0xFFEC4899.toInt(), 0xFFF9A8D4.toInt()), 0xFFBE185D.toInt()),
        TEAL(0xFFE6FAF6.toInt(), 0xFFB5EDE2.toInt(), intArrayOf(0xFF0D9488.toInt(), 0xFF5EEAD4.toInt()), 0xFF0F766E.toInt()),
        ROSE(0xFFFFF1F2.toInt(), 0xFFFECDD3.toInt(), intArrayOf(0xFFE11D48.toInt(), 0xFFFB7185.toInt()), 0xFFBE123C.toInt()),
    }

    data class Stat(val value: String, val label: String, val window: Window)

    /** The `.sc-stats` card height at 3×: 13 + 20 value + label + 7. */
    const val STATS_H = 150f

    /** A row of tinted stat windows across [left]..[right], [top] down, [h] tall (soft-number values). */
    fun drawStats(c: Canvas, fonts: Fonts, stats: List<Stat>, left: Float, right: Float, top: Float, h: Float = STATS_H, gap: Float = 6f * U, valueSize: Float = 20f * U) {
        if (stats.isEmpty()) return
        val n = stats.size
        val w = (right - left - gap * (n - 1)) / n
        stats.forEachIndexed { i, s ->
            val x = left + i * (w + gap)
            val r = RectF(x, top, x + w, top + h)
            drawTintedCard(c, r, 14f * U, s.window.tint, s.window.line, s.window.bar, 6f * U)
            val label = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                textAlign = Paint.Align.CENTER; typeface = fonts.black; textSize = 9f * U; color = s.window.label; letterSpacing = 0.12f
            }
            fitText(label, s.label, w - 8f * U)
            val v = softPaint(fonts, valueSize)
            fitText(v, s.value, w - 10f * U)
            // value centered in the space under the bar and above the label
            val labelBase = r.bottom - 9f * U
            val valueCy = (r.top + 6f * U + (labelBase - label.textSize)) / 2f + 2f * U
            c.textMid(s.value, r.centerX(), valueCy, v)
            c.drawText(s.label, r.centerX(), labelBase, label)
        }
    }

    // ── art shadows ──────────────────────────────────────────────────────

    /**
     * Draws [bmp] into [dst] over its own soft drop shadow (CSS `drop-shadow(0 4px 6px
     * rgba(60,30,110,.22))`): the silhouette's alpha, blurred, offset down. No bubble.
     */
    fun drawWithDropShadow(c: Canvas, bmp: Bitmap, dst: RectF, shadowColor: Int = 0x383C1E6E) {
        val sx = dst.width() / bmp.width
        runCatching {
            val blur = Paint().apply { maskFilter = android.graphics.BlurMaskFilter(max(1f, 3f * U / sx), android.graphics.BlurMaskFilter.Blur.NORMAL) }
            val off = IntArray(2)
            val alpha = bmp.extractAlpha(blur, off)
            val dy = 4f * U * dst.height() / (52f * U)
            val sd = RectF(dst.left + off[0] * sx, dst.top + off[1] * sx + dy, dst.left + (off[0] + alpha.width) * sx, dst.top + (off[1] + alpha.height) * sx + dy)
            c.drawBitmap(alpha, null, sd, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply { color = shadowColor })
        }
        c.drawBitmap(bmp, null, dst, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
    }

    // ── decode ───────────────────────────────────────────────────────────

    private fun sampleFor(context: Context, @DrawableRes res: Int, targetW: Int): Int = runCatching {
        val o = BitmapFactory.Options().apply { inJustDecodeBounds = true; inScaled = false }
        BitmapFactory.decodeResource(context.resources, res, o)
        var s = 1
        while (o.outWidth / (s * 2) >= targetW) s *= 2
        s
    }.getOrDefault(1)

    /** Decodes a drawable at full size (or 1/[sample]); null on failure. Share renders are rare, so no cache. */
    fun decode(context: Context, @DrawableRes res: Int, sample: Int = 1): Bitmap? = runCatching {
        BitmapFactory.decodeResource(context.resources, res, BitmapFactory.Options().apply { inScaled = false; inSampleSize = sample })
    }.getOrNull()
}

/** A footer character: who and which pose drawable. */
data class CastPick(val id: MascotId, @DrawableRes val res: Int)

/**
 * A7 for a single share-footer character: never the card's title host. Pure +
 * deterministic (unit-tested in SharePicksTest). Since S3 the cards close with the
 * whole cast wordmark ([ShareCard.drawCastWordmark]) instead, so the generated cards
 * no longer draw a single footer character; the table stays for any one-character spot.
 *
 * The footer table (title host → footer character, pose):
 *   W  → O1 cheer   (Classic, ProperNoundle)
 *   O1 → D  cheer   (QuadWord, Hubbub; the Friends title)
 *   R  → I  cheer   (Muddle)
 *   D  → O3 laugh   (OctoWord, Crosswordocious; the Stats title, Monday)
 *   O2 → U  spin    (Six, Kindred; Leaderboard / Records titles, Friday)
 *   C  → W  cheer   (Deliverance, Codebreaker)
 *   I  → S  flex    (Succession, Letter Ladder, Tuesday)
 *   O3 → C  cheer   (Spyglass, Sunday)
 *   U  → R  cheer   (Seven, Sudocious, Wednesday)
 *   S  → O2 cheer   (Gauntlet, Starsweep, VS, Thursday)
 * No host (sweep / today cards: the whole-cast title art) → O1 cheer. When a second
 * character must also be avoided (a VS mode host + S), the table walks on in
 * WORDOCIOUS order to the next free member.
 */
object SharePicks {
    val FOOTER: Map<MascotId, Pair<MascotId, String>> = mapOf(
        MascotId.W to (MascotId.O1 to "cheer"),
        MascotId.O1 to (MascotId.D to "cheer"),
        MascotId.R to (MascotId.I to "cheer"),
        MascotId.D to (MascotId.O3 to "laugh"),
        MascotId.O2 to (MascotId.U to "spin"),
        MascotId.C to (MascotId.W to "cheer"),
        MascotId.I to (MascotId.S to "flex"),
        MascotId.O3 to (MascotId.C to "cheer"),
        MascotId.U to (MascotId.R to "cheer"),
        MascotId.S to (MascotId.O2 to "cheer"),
    )

    /** Each member's footer pose when the table walks past its first choice. */
    val POSE: Map<MascotId, String> = mapOf(
        MascotId.W to "cheer", MascotId.O1 to "cheer", MascotId.R to "cheer", MascotId.D to "cheer",
        MascotId.O2 to "cheer", MascotId.C to "cheer", MascotId.I to "cheer", MascotId.O3 to "laugh",
        MascotId.U to "spin", MascotId.S to "flex",
    )

    /** The footer character + pose for a card whose title is hosted by [host], never any of [avoid]. */
    fun footerFor(host: MascotId?, avoid: Set<MascotId> = emptySet()): Pair<MascotId, String> {
        val all = avoid + listOfNotNull(host)
        val first = host?.let { FOOTER[it] } ?: (MascotId.O1 to "cheer")
        if (first.first !in all) return first
        val cast = Mascots.cast
        val start = cast.indexOf(first.first)
        for (k in 1..cast.size) {
            val m = cast[(start + k) % cast.size]
            if (m !in all) return m to (POSE[m] ?: "cheer")
        }
        return first
    }

    /** [footerFor] resolved to a drawable (the pose, else the hero image). */
    fun pick(host: MascotId?, avoid: Set<MascotId> = emptySet()): CastPick {
        val (id, pose) = footerFor(host, avoid)
        return CastPick(id, CastPoses.res(id, pose) ?: id.res)
    }

    /**
     * Splits a leaderboard footer ("Can you beat them? Play free at wordocious.com")
     * into the footer's two lines: the hook, then the site line ("Play free at
     * wordocious.com" / "wordocious.com").
     */
    fun footerLines(footer: String): Pair<String, String> {
        val site = "wordocious.com"
        val t = footer.trim()
        if (!t.endsWith(site)) return t to site
        var head = t.removeSuffix(site).trimEnd()
        var tail = site
        if (head.endsWith("Play free at")) { head = head.removeSuffix("Play free at").trimEnd(); tail = "Play free at $site" }
        head = head.trimEnd('·', '—', '-', ' ', ',')
        return (head.ifEmpty { "Can you beat me?" }) to tail
    }

    /** One parsed stat out of a More Games `meta` line. */
    data class MetaStat(val value: String, val label: String)

    /** A More Games `meta` line ("#12 · Par 5 · +1 · 2:10") taken apart for the card. */
    data class Meta(val puzzle: String?, val time: String?, val stats: List<MetaStat>, val words: List<String>)

    private val TIME = Regex("^\\d{1,2}:\\d{2}(:\\d{2})?$")
    private val NUM_LABEL = Regex("^([+\\-]?[\\d,./]+%?)\\s+([A-Za-z][A-Za-z ]*)$")
    private val BARE_NUM = Regex("^[+\\-]?[\\d,./]+%?$")
    private val PAR = Regex("^Par\\s+(\\d+)$")

    /**
     * Parses a More Games meta line: "#N" → the puzzle number, a clock → the time,
     * "0 mistakes" / "4/4 groups" / "Par 5" / "No checks" / "+1" → stats (value + caps
     * label), anything else ("Medium", "8 × 8", "Out of moves", a Hubbub rank) → words
     * for the date line.
     */
    fun parseMeta(meta: String): Meta {
        var puzzle: String? = null
        var time: String? = null
        val stats = ArrayList<MetaStat>()
        val words = ArrayList<String>()
        for (raw in meta.split("·")) {
            val s = raw.trim()
            if (s.isEmpty()) continue
            when {
                s.startsWith("#") && s.drop(1).all { it.isDigit() } -> puzzle = s
                TIME.matches(s) -> time = s
                s.equals("No checks", true) -> stats += MetaStat("0", "CHECKS")
                s.equals("On par", true) -> stats += MetaStat("0", "OVER PAR")
                PAR.matches(s) -> stats += MetaStat(PAR.find(s)!!.groupValues[1], "PAR")
                NUM_LABEL.matches(s) -> {
                    val m = NUM_LABEL.find(s)!!
                    val label = m.groupValues[2].trim().uppercase(Locale.US)
                    // Singular labels read as their plural on the window ("1 mistake" → MISTAKES).
                    stats += MetaStat(m.groupValues[1], pluralLabel(label))
                }
                BARE_NUM.matches(s) -> stats += MetaStat(s, when {
                    s.startsWith("+") || s.startsWith("-") -> "OVER PAR"
                    s.endsWith("%") -> "OF MAX"
                    s.contains("/") -> "FOUND"
                    else -> "SCORE"
                })
                else -> words += s
            }
        }
        return Meta(puzzle, time, stats, words)
    }

    private fun pluralLabel(l: String): String = when (l) {
        "MISTAKE" -> "MISTAKES"
        "CHECK" -> "CHECKS"
        "MISS" -> "MISSES"
        "WORD" -> "WORDS"
        "PANGRAM" -> "PANGRAMS"
        "GROUP" -> "GROUPS"
        else -> l
    }

    /**
     * The widget's small-size window: four consecutive tiles — the first four, or the
     * last four once the first four are all played and something later isn't.
     */
    fun smallWindow(played: List<Boolean>): IntRange {
        val n = played.size
        if (n <= 4) return 0 until n
        val firstOpen = played.indexOfFirst { !it }
        val start = if (firstOpen >= 4) (n - 4).coerceAtMost(4) else 0
        return start until (start + 4).coerceAtMost(n)
    }
}
