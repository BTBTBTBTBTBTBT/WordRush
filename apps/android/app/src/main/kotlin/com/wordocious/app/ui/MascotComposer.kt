package com.wordocious.app.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color as AColor
import android.graphics.CornerPathEffect
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.wordocious.app.R
import com.wordocious.app.data.AvatarFrame
import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarFit
import com.wordocious.core.AvatarFitManifest
import com.wordocious.core.AvatarLayout
import com.wordocious.core.AvatarOptions
import com.wordocious.core.AvatarRect
import com.wordocious.core.AvatarSwatch
import com.wordocious.core.avatarBackdrop
import com.wordocious.core.avatarColorHex
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// FINISH_SPEC AN1/AN5 — the ONE mascot composer: a pure android.graphics function
// (config + initial + size → Bitmap) that the Compose renderer (MascotAvatar) and
// the offscreen share images both use. Layers back → front per MascotLayers.plan:
// tile, cape, body (white glossy art × color by multiply), pattern (inside the same
// multiply layer, so it is clipped to the body alpha), the white Nunito Black
// initial (soft emboss + shadow), cheeks/nose, eyes, mouth, face accessory, bow
// tie, hat, front frame. Every part uses its `art_av_*` drawable when it has
// shipped (looked up by name) and a simple code-drawn placeholder otherwise.

object MascotComposer {
    /** Composed avatars: ~24 MB of bitmaps (≈ 160 list-size avatars). */
    private val cache = WeightedLru<MascotKey, ImageBitmap>(24L * 1024 * 1024) { k, _ -> k.bytes }

    /** Decoded part art by drawable id (0 = known missing), ~12 MB. */
    private val parts = WeightedLru<Int, Bitmap>(12L * 1024 * 1024) { _, b -> b.byteCount.toLong() }
    private val ids = HashMap<String, Int>()

    @Volatile private var manifest: AvatarManifest? = null
    @Volatile private var fit: AvatarFitManifest? = null
    @Volatile private var fitLoaded = false
    @Volatile private var typeface: Typeface? = null

    /** The cached composed avatar for [key] (composing it on a miss). */
    fun image(context: Context, key: MascotKey): ImageBitmap =
        cache.getOrPut(key) { render(context, key).asImageBitmap() }

    /** The composed avatar for [key] when it's already cached (never composes). */
    fun cached(key: MascotKey): ImageBitmap? = cache.get(key)

    /**
     * Compose [key] OUTSIDE the cache lock (for a background thread): a main-thread [cached]
     * hit never waits on a render in flight. Two threads missing at once just compose twice.
     */
    fun compose(context: Context, key: MascotKey): ImageBitmap =
        cache.get(key) ?: render(context, key).asImageBitmap().also { cache.put(key, it) }

    /** For tests / memory pressure. */
    fun clearCache() { cache.clear(); parts.clear() }

    /** A fresh composed bitmap ([px] square) — the share images use this. */
    fun render(
        context: Context,
        config: AvatarConfig,
        initial: String,
        px: Int,
        sizeDp: Float = px / context.resources.displayMetrics.density,
        dark: Boolean = false,
        crown: Boolean = false,
    ): Bitmap = render(context, MascotKey.of(config, initial, sizeDp, px, dark, crown))

    fun render(context: Context, key: MascotKey): Bitmap {
        val bmp = Bitmap.createBitmap(key.px, key.px, Bitmap.Config.ARGB_8888)
        draw(context, Canvas(bmp), 0f, 0f, key.px.toFloat(), key)
        return bmp
    }

    /** Draw the mascot into [c] at ([left], [top]), [size] px square. [key].config is drawn as is (already simplified). */
    fun draw(context: Context, c: Canvas, left: Float, top: Float, size: Float, key: MascotKey) {
        val cfg = key.config
        val sizeDp = size / context.resources.displayMetrics.density
        val layers = MascotLayers.plan(cfg, sizeDp.coerceAtLeast(MascotLayers.SMALL_DP + 1f)) // already simplified
        val m = manifest(context)
        val base = colorOf(avatarColorHex(cfg.color), 0xFF7C3AED.toInt())
        val fm = fitManifest(context)
        if (fm != null && drawableId(context, "art_av_body_${cfg.body}") != 0) {
            drawFromLayout(context, c, left, top, size, key, fm, base, sizeDp <= MascotLayers.SMALL_DP)
            return
        }
        c.save()
        c.translate(left, top)
        val fw = if (cfg.frame != "none" && !key.cutout) frameWidth(size) else 0f
        // The content square (inside the frame).
        val cs = size - fw * 2f
        // The body box: square, lower when a hat needs the headroom.
        val hat = cfg.head != "none"
        val bSide = cs * (if (hat) 0.74f else 0.86f)
        val bLeft = fw + (cs - bSide) / 2f
        val bTop = fw + cs * (if (hat) 0.245f else 0.115f)
        val body = RectF(bLeft, bTop, bLeft + bSide, bTop + bSide)
        val anchors = m.anchors(cfg.body)

        for (layer in layers) when (layer) {
            MascotLayer.TILE -> if (!key.cutout) drawTile(c, size, fw, base, cfg.bg, key.dark)
            MascotLayer.BACK_ACC -> drawAccessory(context, c, m, "neck", cfg.neck, body, anchors, base)
            MascotLayer.BODY -> drawBody(context, c, cfg, body, base, m)
            MascotLayer.PATTERN -> Unit // drawn inside the body's multiply layer
            MascotLayer.LETTER -> drawLetter(context, c, key.initial, body, anchors, base)
            MascotLayer.NOSE -> drawPart(context, c, m, "nose", cfg.nose, body, anchors, base)
            MascotLayer.EYES -> drawPart(context, c, m, "eyes", cfg.eyes, body, anchors, base)
            MascotLayer.MOUTH -> drawPart(context, c, m, "mouth", cfg.mouth, body, anchors, base)
            MascotLayer.FACE_ACC -> drawAccessory(context, c, m, "face", cfg.face, body, anchors, base)
            MascotLayer.NECK_ACC -> drawAccessory(context, c, m, "neck", cfg.neck, body, anchors, base)
            MascotLayer.HEAD_ACC -> drawAccessory(context, c, m, "head", cfg.head, body, anchors, base)
            MascotLayer.FRAME -> if (!key.cutout) drawFrame(c, cfg.frame, size, context)
        }
        if (key.crown) drawCrown(context, c, size)
        c.restore()
    }

    // ── Round 2: the art path at the core FIT layout (parity with web + iOS) ──

    /** The fit manifest (avatar-parts.json v2), or null when the asset is a v1 file. */
    fun fitManifest(context: Context): AvatarFitManifest? {
        if (fitLoaded) return fit
        val text = runCatching { context.assets.open(AvatarManifests.ASSET).bufferedReader().use { it.readText() } }.getOrNull()
        fit = AvatarFitManifest.parse(text)?.takeIf { it.items.isNotEmpty() }
        fitLoaded = true
        return fit
    }

    /**
     * Decode the parts the defaults + cast presets wear (and the classic body) into the
     * part cache on the caller's thread — App.onCreate runs it on the IO pool, so Home /
     * the Leaderboard never decode an avatar part on main for the common looks.
     */
    fun prewarm(context: Context) {
        val fm = fitManifest(context) ?: return
        val configs = listOf(com.wordocious.core.defaultAvatar("warm")) + listOf("w", "o1", "r", "d").map { com.wordocious.core.castPreset(it) }
        val names = LinkedHashSet<String>()
        configs.forEach { c -> listOf(false, true).forEach { small -> AvatarFit.layout(c, small, fm).layers.forEach { names += it.art } } }
        names.forEach { n -> drawableId(context, n.replace('-', '_')).takeIf { it != 0 }?.let { runCatching { partBitmap(context, it) } } }
    }

    private fun solidPaint(color: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; style = Paint.Style.FILL }

    /** A swatch's paint shader across [r]: flat color, or its Pro gradient. */
    private fun swatchPaint(sw: AvatarSwatch, r: RectF): Paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        if (sw.stops.size >= 2) {
            val (x1, y1) = when (sw.dir) { "h" -> r.right to r.top; "d" -> r.right to r.bottom; else -> r.left to r.bottom }
            shader = LinearGradient(r.left, r.top, x1, y1, sw.stops.map { colorOf(it, AColor.WHITE) }.toIntArray(), null, Shader.TileMode.CLAMP)
        } else {
            color = colorOf(sw.hex, 0xFF7C3AED.toInt())
        }
    }

    /** White art [bmp] in [r], multiplied by [fill] (+ [extra] shapes) over its own alpha. */
    private fun drawTinted(c: Canvas, bmp: Bitmap, r: RectF, fill: Paint, extra: ((Canvas) -> Unit)? = null) {
        val p = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
        val layer = c.saveLayer(r, null)
        c.drawBitmap(bmp, null, r, p)
        val mul = Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY) }
        c.saveLayer(r, mul)
        c.drawRect(r, fill)
        extra?.invoke(c)
        // keep only the art's alpha
        c.drawBitmap(bmp, null, r, Paint(Paint.FILTER_BITMAP_FLAG).apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN) })
        c.restore()
        c.restoreToCount(layer)
    }

    private fun drawFromLayout(context: Context, c: Canvas, left: Float, top: Float, size: Float, key: MascotKey, fm: AvatarFitManifest, base: Int, small: Boolean) {
        val cfg = key.config
        val layout: AvatarLayout = AvatarFit.layout(cfg, small, fm)
        c.save()
        c.translate(left, top)
        val fw = if (cfg.frame != "none" && !key.cutout) frameWidth(size) else 0f
        val cs = size - fw * 2f
        fun box(r: AvatarRect) = RectF(fw + (r.x * cs).toFloat(), fw + (r.y * cs).toFloat(), fw + ((r.x + r.w) * cs).toFloat(), fw + ((r.y + r.h) * cs).toFloat())
        // BJ6 round 5: a cutout (the Good Morning host) has no tile and no tile-floor shadow.
        if (!key.cutout) drawTile(c, size, fw, base, cfg.bg, key.dark)
        val b = box(layout.body)
        if (!key.cutout) c.drawOval(RectF(b.centerX() - b.width() * 0.3f, b.top + b.height() * 0.95f, b.centerX() + b.width() * 0.3f, b.top + b.height() * 1.0f),
            solidPaint(withAlpha(AColor.BLACK, 0.12f)))
        val acc = if (cfg.accColor == "default") null else AvatarOptions.swatch(cfg.accColor)
        val patInk = if (cfg.patternColor == cfg.color) mix(base, AColor.WHITE, 0.5f) else colorOf(avatarColorHex(cfg.patternColor), base)
        for (l in layout.layers) {
            val r = box(l.rect)
            val id = drawableId(context, l.art.replace('-', '_'))
            val bmp = if (id != 0) partBitmap(context, id) else null
            if (l.layer == "body") {
                if (bmp != null) drawTinted(c, bmp, r, swatchPaint(AvatarOptions.swatch(cfg.color), r)) { cv ->
                    if (!small && cfg.pattern != "solid") drawShapes(cv, AvatarFit.patternShapes(cfg.pattern), r, patInk, base)
                }
                drawLetterBox(context, c, key.initial, box(layout.letter), base)
                continue
            }
            bmp ?: continue
            if (l.tint && acc != null) drawTinted(c, bmp, r, swatchPaint(acc, r))
            else c.drawBitmap(bmp, null, r, Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
        }
        if (!key.cutout) drawFrame(c, cfg.frame, size, context)
        if (key.crown) drawCrown(context, c, size)
        c.restore()
    }

    /** The shared pattern shapes (body-square units → [r]). */
    private fun drawShapes(c: Canvas, shapes: List<AvatarFit.Shape>, r: RectF, ink: Int, base: Int) {
        fun col(k: String, a: Double) = withAlpha(when (k) { "ink" -> ink; "base" -> base; else -> AColor.WHITE }, a.toFloat())
        fun X(v: Double) = r.left + (v * r.width()).toFloat()
        fun Y(v: Double) = r.top + (v * r.height()).toFloat()
        for (s in shapes) when (s) {
            is AvatarFit.Shape.Rect -> c.drawRect(X(s.x), Y(s.y), X(s.x + s.w), Y(s.y + s.h), solidPaint(col(s.c, s.a)))
            is AvatarFit.Shape.Circle -> c.drawCircle(X(s.x), Y(s.y), (s.r * r.width()).toFloat(), solidPaint(col(s.c, s.a)))
            is AvatarFit.Shape.Star -> {
                val path = Path()
                for (k in 0 until s.n * 2) {
                    val rad = if (k % 2 == 0) s.r else s.inner
                    val ang = -PI / 2 + k * PI / s.n
                    val px = X(s.x + rad * cos(ang)); val py = Y(s.y + rad * sin(ang))
                    if (k == 0) path.moveTo(px, py) else path.lineTo(px, py)
                }
                path.close(); c.drawPath(path, solidPaint(col(s.c, s.a)))
            }
            is AvatarFit.Shape.Heart -> {
                val k = s.s
                val path = Path()
                path.moveTo(X(s.x), Y(s.y + k))
                path.lineTo(X(s.x - k * 0.97), Y(s.y - k * 0.1))
                path.arcTo(RectF(X(s.x - k), Y(s.y - k * 0.75), X(s.x), Y(s.y + k * 0.25)), 160f, 200f)
                path.arcTo(RectF(X(s.x), Y(s.y - k * 0.75), X(s.x + k), Y(s.y + k * 0.25)), 180f, 200f)
                path.close(); c.drawPath(path, solidPaint(col(s.c, s.a)))
            }
            is AvatarFit.Shape.Poly -> {
                val path = Path()
                s.pts.forEachIndexed { i, (a, b2) -> if (i == 0) path.moveTo(X(a), Y(b2)) else path.lineTo(X(a), Y(b2)) }
                path.close(); c.drawPath(path, solidPaint(col(s.c, s.a)))
            }
            is AvatarFit.Shape.Grad -> {
                val p = Paint(Paint.ANTI_ALIAS_FLAG)
                p.shader = LinearGradient(X(s.x1), Y(s.y1), X(s.x2), Y(s.y2), s.stops.map { col(it.second, it.third) }.toIntArray(),
                    s.stops.map { it.first.toFloat() }.toFloatArray(), Shader.TileMode.CLAMP)
                c.drawRect(r, p)
            }
        }
    }

    /** The white initial fitted into [box] (the cast letters' emboss). */
    private fun drawLetterBox(context: Context, c: Canvas, initial: String, box: RectF, base: Int) {
        val s = box.height() * 3.5f
        val text = initial.ifEmpty { "?" }
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = font(context); textAlign = Paint.Align.CENTER; textSize = box.height() }
        val bounds = Rect()
        p.getTextBounds(text, 0, text.length, bounds)
        val fit = min(box.height() / max(bounds.height(), 1).toFloat(), box.width() / max(bounds.width(), 1).toFloat())
        p.textSize = p.textSize * min(fit, 1.6f)
        p.getTextBounds(text, 0, text.length, bounds)
        val x = box.centerX(); val y = box.centerY() - bounds.exactCenterY()
        p.color = mix(base, AColor.BLACK, 0.45f); p.alpha = 150
        c.drawText(text, x, y + s * 0.025f, p)
        p.setShadowLayer(s * 0.03f, 0f, s * 0.012f, withAlpha(mix(base, AColor.BLACK, 0.5f), 0.45f))
        p.color = AColor.WHITE
        c.drawText(text, x, y, p)
        p.clearShadowLayer()
    }

    // ── shared helpers (also used by the photo frame) ─────────────────────

    /** The frame's stroke width for a [size] px avatar. */
    fun frameWidth(size: Float): Float = (size * 0.07f).coerceAtLeast(1.5f)

    /** The tile corner radius (AN6: ≈ 22%). */
    fun cornerRadius(size: Float): Float = size * 0.22f

    /** The frame's metallic colors (light, base, deep) as ARGB ints, or null for an unknown frame. */
    fun frameColors(frame: String): IntArray? = when (frame) {
        "pro" -> intArrayOf(0xFFFFE08A.toInt(), 0xFFF5A524.toInt(), 0xFFB45309.toInt())
        else -> AvatarFrame.ringRgb(frame)?.let { rgb ->
            val b = 0xFF000000.toInt() or rgb
            intArrayOf(mix(b, AColor.WHITE, 0.55f), b, mix(b, AColor.BLACK, 0.3f))
        }
    }

    /**
     * The rounded-square frame (AN6) filling a [size] px box at the canvas origin ("none" draws
     * nothing). A level tier draws its `art_frame_<tier>` art (night art 10-03; outer edge = the
     * canvas, iOS AvatarFrameRing parity) when [context] is given and the art shipped; else
     * (and for "pro") the code-drawn metal.
     */
    fun drawFrame(c: Canvas, frame: String, size: Float, context: Context? = null) {
        if (frame == "none") return
        if (context != null && frame != "pro") {
            val id = drawableId(context, com.wordocious.app.data.AvatarFrame.artName(frame))
            val art = if (id != 0) partBitmap(context, id) else null
            if (art != null) {
                c.drawBitmap(art, null, RectF(0f, 0f, size, size), Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
                return
            }
        }
        val (light, base, deep) = frameColors(frame)?.toList() ?: return
        val w = frameWidth(size)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = w
            shader = LinearGradient(0f, 0f, size, size, intArrayOf(light, base, deep, base, light), null, Shader.TileMode.CLAMP)
        }
        val r = cornerRadius(size)
        c.drawRoundRect(RectF(w / 2f, w / 2f, size - w / 2f, size - w / 2f), r - w / 2f, r - w / 2f, p)
        // A thin bright inner edge reads as polished metal.
        p.shader = null
        p.color = withAlpha(AColor.WHITE, 0.5f)
        p.strokeWidth = (w * 0.2f).coerceAtLeast(0.6f)
        val ii = w * 0.9f
        c.drawRoundRect(RectF(ii, ii, size - ii, size - ii), max(r - ii, 0f), max(r - ii, 0f), p)
        if (frame == "diamond" || frame == "pro") {
            // A glint on the top-left corner.
            p.style = Paint.Style.FILL
            p.color = withAlpha(AColor.WHITE, 0.9f)
            star4(c, size * 0.16f, size * 0.07f, w * 0.9f, p)
        }
    }

    private fun drawCrown(context: Context, c: Canvas, size: Float) {
        val bmp = partBitmap(context, R.drawable.art_badge_pro_crown_sprite) ?: return
        val cw = size * 0.34f
        val ch = cw * bmp.height / bmp.width.toFloat()
        val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        c.save()
        c.rotate(12f, size - cw * 0.5f, ch * 0.5f)
        c.drawBitmap(bmp, null, RectF(size - cw, 0f, size, ch), p)
        c.restore()
    }

    // ── tile + body ───────────────────────────────────────────────────────

    /**
     * The tile behind the mascot (AN addendum "Backdrop"): "auto" = a light tint of the body
     * color (a deeper one in dark mode); solid = colors[0]; gradient = a top-left → bottom-right
     * blend; pattern = colors[0] + its motif in colors[1..].
     */
    private fun drawTile(c: Canvas, size: Float, fw: Float, base: Int, bg: String, dark: Boolean) {
        val inset = fw * 0.5f
        val r = max(cornerRadius(size) - inset, 0f)
        val rect = RectF(inset, inset, size - inset, size - inset)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        val backdrop = avatarBackdrop(bg)
        if (backdrop == null) {
            val top = if (dark) mix(0xFF1E1633.toInt(), base, 0.30f) else mix(AColor.WHITE, base, 0.16f)
            val bottom = if (dark) mix(0xFF1E1633.toInt(), base, 0.46f) else mix(AColor.WHITE, base, 0.34f)
            p.shader = LinearGradient(0f, 0f, 0f, size, top, bottom, Shader.TileMode.CLAMP)
            c.drawRoundRect(rect, r, r, p)
            return
        }
        val cols = backdrop.colors.map { colorOf(it, base) }
        when (backdrop.kind) {
            "gradient" -> {
                p.shader = if (cols.size >= 2) LinearGradient(0f, 0f, size, size, cols.toIntArray(), null, Shader.TileMode.CLAMP) else null
                if (cols.size < 2) p.color = cols.firstOrNull() ?: base
                c.drawRoundRect(rect, r, r, p)
            }
            "pattern" -> {
                p.color = cols.first()
                c.drawRoundRect(rect, r, r, p)
                c.save()
                c.clipPath(Path().apply { addRoundRect(rect, r, r, Path.Direction.CW) })
                MascotBackdrops.motif(c, backdrop.id, cols, size)
                c.restore()
            }
            else -> { p.color = cols.firstOrNull() ?: base; c.drawRoundRect(rect, r, r, p) }
        }
    }

    /** The code-drawn placeholder body outline in a [b] box (stubby arms + feet unioned in). */
    fun bodyPath(shape: String, b: RectF): Path {
        val s = b.width()
        fun x(f: Float) = b.left + s * f
        fun y(f: Float) = b.top + s * f
        val r = AvatarManifests.BODY_RECTS[shape] ?: AvatarManifests.BODY_RECTS.getValue("classic")
        val main = Path()
        val rect = RectF(x(r[0]), y(r[1]), x(r[2]), y(r[3]))
        when (shape) {
            "blob" -> main.addOval(rect, Path.Direction.CW)
            "bean" -> {
                // A soft kidney: a tall pill with a gentle dent on the right.
                val w = rect.width(); val h = rect.height()
                main.moveTo(rect.left + w * 0.5f, rect.top)
                main.cubicTo(rect.left + w * 1.02f, rect.top, rect.right + w * 0.02f, rect.top + h * 0.34f, rect.right - w * 0.1f, rect.top + h * 0.5f)
                main.cubicTo(rect.right + w * 0.04f, rect.top + h * 0.66f, rect.right, rect.bottom, rect.left + w * 0.52f, rect.bottom)
                main.cubicTo(rect.left - w * 0.02f, rect.bottom, rect.left, rect.top + h * 0.7f, rect.left, rect.top + h * 0.5f)
                main.cubicTo(rect.left, rect.top + h * 0.2f, rect.left + w * 0.12f, rect.top, rect.left + w * 0.5f, rect.top)
                main.close()
            }
            "star" -> {
                val cx = rect.centerX(); val cy = rect.top + rect.height() * 0.54f
                val ro = rect.width() * 0.5f; val ri = ro * 0.58f
                for (i in 0 until 10) {
                    val a = -PI / 2 + i * PI / 5
                    val rr = if (i % 2 == 0) ro else ri
                    val px = cx + (rr * cos(a)).toFloat(); val py = cy + (rr * sin(a)).toFloat()
                    if (i == 0) main.moveTo(px, py) else main.lineTo(px, py)
                }
                main.close()
            }
            else -> {
                val corner = rect.width() * (if (shape == "tall") 0.36f else 0.3f)
                main.addRoundRect(rect, corner, corner, Path.Direction.CW)
            }
        }
        if (shape != "star") {
            // Stubby arms + feet.
            val armW = s * 0.12f; val armH = s * 0.17f
            val ay = rect.top + rect.height() * 0.58f
            main.op(Path().apply { addOval(RectF(rect.left - armW * 0.55f, ay, rect.left + armW * 0.45f, ay + armH), Path.Direction.CW) }, Path.Op.UNION)
            main.op(Path().apply { addOval(RectF(rect.right - armW * 0.45f, ay, rect.right + armW * 0.55f, ay + armH), Path.Direction.CW) }, Path.Op.UNION)
            val fW = s * 0.2f; val fH = s * 0.11f
            val fy = min(rect.bottom - fH * 0.45f, b.bottom - fH)
            main.op(Path().apply { addOval(RectF(rect.centerX() - s * 0.24f, fy, rect.centerX() - s * 0.24f + fW, fy + fH), Path.Direction.CW) }, Path.Op.UNION)
            main.op(Path().apply { addOval(RectF(rect.centerX() + s * 0.04f, fy, rect.centerX() + s * 0.04f + fW, fy + fH), Path.Direction.CW) }, Path.Op.UNION)
        }
        return main
    }

    private fun drawBody(context: Context, c: Canvas, cfg: AvatarConfig, b: RectF, base: Int, m: AvatarManifest) {
        val art = drawableId(context, "art_av_body_${cfg.body}").takeIf { it != 0 }?.let { partBitmap(context, it) }
        val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        val path = if (art == null) bodyPath(cfg.body, b) else null
        // Soft ground shadow under the feet.
        p.color = withAlpha(AColor.BLACK, 0.12f)
        c.drawOval(RectF(b.left + b.width() * 0.2f, b.bottom - b.width() * 0.05f, b.right - b.width() * 0.2f, b.bottom + b.width() * 0.02f), p)
        // 1) The white glossy body (art, or the placeholder) in its own layer.
        val layer = c.saveLayer(RectF(b.left - b.width() * 0.1f, b.top - b.width() * 0.1f, b.right + b.width() * 0.1f, b.bottom + b.width() * 0.1f), null)
        if (art != null) {
            c.drawBitmap(art, null, b, p)
        } else if (path != null) {
            val lip = Path(path).apply { offset(0f, b.width() * 0.035f) }
            p.color = 0xFFB4B9C8.toInt()
            c.drawPath(lip, p)
            p.shader = LinearGradient(0f, b.top, 0f, b.bottom, 0xFFFFFFFF.toInt(), 0xFFD5D9E4.toInt(), Shader.TileMode.CLAMP)
            c.drawPath(path, p)
            p.shader = null
        }
        // 2) Color + pattern multiplied onto it (SRC alpha 1 → the body's alpha is kept: clipped).
        val mul = Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY) }
        c.saveLayer(RectF(b.left - b.width() * 0.1f, b.top - b.width() * 0.1f, b.right + b.width() * 0.1f, b.bottom + b.width() * 0.1f), mul)
        drawFill(c, cfg, RectF(b.left - b.width() * 0.1f, b.top - b.width() * 0.1f, b.right + b.width() * 0.1f, b.bottom + b.width() * 0.1f), b, base)
        c.restore()
        c.restoreToCount(layer)
        // 3) Placeholder gloss (art carries its own shading).
        if (path != null) {
            c.save()
            c.clipPath(path)
            p.shader = LinearGradient(0f, b.top, 0f, b.top + b.height() * 0.4f, withAlpha(AColor.WHITE, 0.45f), withAlpha(AColor.WHITE, 0f), Shader.TileMode.CLAMP)
            c.drawOval(RectF(b.left + b.width() * 0.2f, b.top + b.width() * 0.02f, b.right - b.width() * 0.2f, b.top + b.height() * 0.36f), p)
            p.shader = null
            c.restore()
        }
    }

    /** The opaque fill (base color + pattern) multiplied onto the body. */
    private fun drawFill(c: Canvas, cfg: AvatarConfig, area: RectF, b: RectF, base: Int) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.color = base
        c.drawRect(area, p)
        // The second color: the chosen swatch, else (same as the body) a shade of the body.
        val second = cfg.patternColor.takeIf { it != cfg.color }?.let { colorOf(avatarColorHex(it), base) }
        val s = b.width()
        when (cfg.pattern) {
            "twotone" -> {
                p.color = second ?: mix(base, AColor.BLACK, 0.28f)
                c.drawRect(area.left, b.top + s * 0.56f, area.right, area.bottom, p)
            }
            "stripes" -> {
                p.color = second ?: mix(base, AColor.WHITE, 0.4f)
                var y = b.top + s * 0.08f
                while (y < area.bottom) { c.drawRect(area.left, y, area.right, y + s * 0.09f, p); y += s * 0.19f }
            }
            "dots" -> {
                p.color = second ?: mix(base, AColor.WHITE, 0.5f)
                val step = s * 0.17f
                var row = 0
                var y = b.top + step * 0.5f
                while (y < area.bottom) {
                    var x = b.left + (if (row % 2 == 0) step * 0.5f else step)
                    while (x < area.right) { c.drawCircle(x, y, s * 0.045f, p); x += step }
                    y += step; row++
                }
            }
            "gradient" -> {
                p.shader = LinearGradient(0f, b.top, 0f, b.bottom, second ?: mix(base, AColor.WHITE, 0.55f), base, Shader.TileMode.CLAMP)
                c.drawRect(area, p)
                p.shader = null
            }
            "sparkle" -> {
                p.color = second ?: mix(base, AColor.WHITE, 0.75f)
                // A fixed scatter so the same config always sparkles the same.
                val pts = floatArrayOf(0.2f, 0.18f, 0.72f, 0.14f, 0.5f, 0.3f, 0.82f, 0.42f, 0.16f, 0.5f, 0.62f, 0.6f, 0.3f, 0.74f, 0.78f, 0.78f, 0.48f, 0.88f, 0.1f, 0.84f)
                for (i in pts.indices step 2) {
                    val r = s * (if (i % 4 == 0) 0.045f else 0.03f)
                    star4(c, b.left + s * pts[i], b.top + s * pts[i + 1], r, p)
                }
            }
        }
    }

    // ── the letter ────────────────────────────────────────────────────────

    private fun font(context: Context): Typeface =
        typeface ?: runCatching { com.wordocious.app.data.ShareFinish.nunito(context, 900) }.getOrDefault(Typeface.DEFAULT_BOLD).also { typeface = it }

    private fun drawLetter(context: Context, c: Canvas, initial: String, b: RectF, a: BodyAnchors, base: Int) {
        val s = b.width()
        val box = RectF(b.left + s * a.letterBox.x, b.top + s * a.letterBox.y, b.left + s * (a.letterBox.x + a.letterBox.w), b.top + s * (a.letterBox.y + a.letterBox.h))
        val text = initial.ifEmpty { "?" }
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = font(context)
            textAlign = Paint.Align.CENTER
            textSize = box.height()
        }
        val bounds = Rect()
        p.getTextBounds(text, 0, text.length, bounds)
        // Fit the glyph's ink box into the letter box.
        val fit = min(box.height() / max(bounds.height(), 1).toFloat(), box.width() / max(bounds.width(), 1).toFloat())
        p.textSize = p.textSize * min(fit, 1.6f)
        p.getTextBounds(text, 0, text.length, bounds)
        val x = box.centerX()
        val y = box.centerY() - bounds.exactCenterY()
        // Soft shadow + a darker lip below = the cast letters' emboss.
        p.color = mix(base, AColor.BLACK, 0.45f)
        p.alpha = 150
        c.drawText(text, x, y + s * 0.025f, p)
        p.setShadowLayer(s * 0.03f, 0f, s * 0.012f, withAlpha(mix(base, AColor.BLACK, 0.5f), 0.45f))
        p.color = AColor.WHITE
        c.drawText(text, x, y, p)
        p.clearShadowLayer()
        // A faint top shine inside the letter.
        c.save()
        c.clipRect(box.left - s, y + bounds.top, box.right + s, y + bounds.top + bounds.height() * 0.35f)
        p.color = withAlpha(0xFFFFF7FF.toInt(), 0.6f)
        c.drawText(text, x, y, p)
        c.restore()
    }

    // ── face parts ────────────────────────────────────────────────────────

    private fun slotCenter(slot: String, b: RectF, a: BodyAnchors, pl: PartPlacement): Pair<Float, Float> {
        val s = b.width()
        val y = when (slot) {
            "eyes" -> a.eyeY
            "mouth" -> a.mouthY
            "cheeks" -> a.cheekY
            "nose" -> (a.eyeY + a.mouthY) / 2f
            "face" -> a.eyeY
            "neck" -> a.neckY
            "head" -> a.headTop.y
            "back" -> 0.5f
            else -> a.faceCenter.y
        }
        val x = if (slot == "head") a.headTop.x else a.faceCenter.x
        return (b.left + s * (x + pl.dx)) to (b.top + s * (y + pl.dy))
    }

    /** Draw `art_av_<category>_<id>` at its slot, else the placeholder. */
    private fun drawPart(context: Context, c: Canvas, m: AvatarManifest, category: String, id: String, b: RectF, a: BodyAnchors, base: Int) {
        if (category == "nose" && id == "none") return
        val pl = m.placement(category, id)
        val (cx, cy) = slotCenter(pl.slot, b, a, pl)
        val art = drawableId(context, "art_av_${category}_${id.replace('-', '_')}").takeIf { it != 0 }?.let { partBitmap(context, it) }
        if (art != null) { drawArt(c, art, cx, cy, b.width() * pl.scale, center = true); return }
        val s = b.width()
        when (category) {
            "eyes" -> MascotPlaceholders.eyes(c, id, cx, cy, s)
            "mouth" -> MascotPlaceholders.mouth(c, id, cx, cy, s)
            "nose" -> MascotPlaceholders.nose(c, id, cx, cy, s, base)
        }
    }

    private fun drawAccessory(context: Context, c: Canvas, m: AvatarManifest, field: String, id: String, b: RectF, a: BodyAnchors, base: Int) {
        if (id == "none") return
        val pl = m.placement("acc", id, field)
        val (cx, cy) = slotCenter(pl.slot, b, a, pl)
        val art = drawableId(context, "art_av_acc_${id.replace('-', '_')}").takeIf { it != 0 }?.let { partBitmap(context, it) }
        val s = b.width()
        if (art != null) {
            when (pl.slot) {
                // A hat sits on the head: its bottom 18% overlaps the top of the body.
                "head" -> {
                    val w = s * a.headTop.w * pl.scale
                    val h = w * art.height / art.width.toFloat()
                    c.drawBitmap(art, null, RectF(cx - w / 2f, cy - h * 0.82f, cx + w / 2f, cy + h * 0.18f), Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
                }
                "back" -> c.drawBitmap(art, null, RectF(b.left, b.top, b.right, b.bottom), Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
                else -> drawArt(c, art, cx, cy, s * pl.scale, center = true)
            }
            return
        }
        MascotPlaceholders.accessory(c, id, cx, cy, s, a.headTop.w * s, b, base)
    }

    private fun drawArt(c: Canvas, art: Bitmap, cx: Float, cy: Float, w: Float, center: Boolean) {
        val h = w * art.height / art.width.toFloat()
        val top = if (center) cy - h / 2f else cy
        c.drawBitmap(art, null, RectF(cx - w / 2f, top, cx + w / 2f, top + h), Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
    }

    // ── resources ─────────────────────────────────────────────────────────

    /** A drawable id by name (0 when the art hasn't shipped), cached. */
    @Synchronized
    fun drawableId(context: Context, name: String): Int = ids.getOrPut(name) {
        runCatching { context.resources.getIdentifier(name, "drawable", context.packageName) }.getOrDefault(0)
    }

    private fun partBitmap(context: Context, resId: Int): Bitmap? {
        parts.get(resId)?.let { return it }
        val bmp = runCatching {
            val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeResource(context.resources, resId, opts)
            var sample = 1
            while (max(opts.outWidth, opts.outHeight) / (sample * 2) >= 512) sample *= 2
            BitmapFactory.decodeResource(context.resources, resId, BitmapFactory.Options().apply { inSampleSize = sample })
        }.getOrNull() ?: return null
        parts.put(resId, bmp)
        return bmp
    }

    /** The parts manifest: the shipped asset when present, else the code defaults. */
    fun manifest(context: Context): AvatarManifest = manifest ?: run {
        val text = runCatching { context.assets.open(AvatarManifests.ASSET).bufferedReader().use { it.readText() } }.getOrNull()
        AvatarManifests.parse(text).also { manifest = it }
    }

    // ── color math ────────────────────────────────────────────────────────

    /** "#rrggbb" → opaque ARGB, else [fallback]. */
    fun colorOf(hex: String?, fallback: Int): Int {
        val h = hex?.trim()?.removePrefix("#") ?: return fallback
        if (h.length != 6) return fallback
        return h.toIntOrNull(16)?.let { 0xFF000000.toInt() or it } ?: fallback
    }

    fun mix(a: Int, b: Int, f: Float): Int {
        fun ch(v: Int, sh: Int) = (v shr sh) and 0xFF
        fun m(sh: Int) = (ch(a, sh) + (ch(b, sh) - ch(a, sh)) * f).toInt().coerceIn(0, 255)
        return (0xFF shl 24) or (m(16) shl 16) or (m(8) shl 8) or m(0)
    }

    fun withAlpha(color: Int, alpha: Float): Int = ((alpha * 255).toInt().coerceIn(0, 255) shl 24) or (color and 0xFFFFFF)

    /** A four-point sparkle star. */
    fun star4(c: Canvas, cx: Float, cy: Float, r: Float, p: Paint) {
        val w = r * 0.3f
        val path = Path().apply {
            moveTo(cx, cy - r); lineTo(cx + w, cy - w); lineTo(cx + r, cy); lineTo(cx + w, cy + w)
            lineTo(cx, cy + r); lineTo(cx - w, cy + w); lineTo(cx - r, cy); lineTo(cx - w, cy - w); close()
        }
        c.drawPath(path, p)
    }
}

/** The simple code-drawn stand-ins for the part art (AN2, until the art lands). */
internal object MascotPlaceholders {
    private const val INK = 0xFF2A1650.toInt()
    private const val TONGUE = 0xFFFF6B9A.toInt()
    private const val HEART = 0xFFFF3B7F.toInt()
    private const val GOLD = 0xFFF5B82E.toInt()

    private fun fill(color: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; style = Paint.Style.FILL }
    private fun stroke(color: Int, w: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color; style = Paint.Style.STROKE; strokeWidth = w; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }

    private fun heart(c: Canvas, cx: Float, cy: Float, r: Float, p: Paint) {
        val path = Path().apply {
            moveTo(cx, cy + r * 0.9f)
            cubicTo(cx - r * 1.4f, cy - r * 0.1f, cx - r * 0.7f, cy - r * 1.2f, cx, cy - r * 0.45f)
            cubicTo(cx + r * 0.7f, cy - r * 1.2f, cx + r * 1.4f, cy - r * 0.1f, cx, cy + r * 0.9f)
            close()
        }
        c.drawPath(path, p)
    }

    private fun star5(c: Canvas, cx: Float, cy: Float, r: Float, p: Paint) {
        val path = Path()
        for (i in 0 until 10) {
            val a = -PI / 2 + i * PI / 5
            val rr = if (i % 2 == 0) r else r * 0.45f
            val x = cx + (rr * cos(a)).toFloat(); val y = cy + (rr * sin(a)).toFloat()
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
        c.drawPath(path, p)
    }

    private fun beady(c: Canvas, x: Float, y: Float, r: Float) {
        c.drawOval(RectF(x - r * 0.8f, y - r, x + r * 0.8f, y + r), fill(INK))
        c.drawCircle(x + r * 0.25f, y - r * 0.4f, r * 0.32f, fill(AColor.WHITE))
    }

    fun eyes(c: Canvas, id: String, cx: Float, cy: Float, s: Float) {
        val gap = s * 0.13f
        val r = s * 0.055f
        val lx = cx - gap; val rx = cx + gap
        val sw = (s * 0.03f).coerceAtLeast(1f)
        when (id) {
            "happy" -> for (x in listOf(lx, rx)) c.drawArc(RectF(x - r, cy - r * 0.6f, x + r, cy + r * 1.2f), 200f, 140f, false, stroke(INK, sw))
            "sparkly" -> for (x in listOf(lx, rx)) {
                c.drawCircle(x, cy, r * 1.35f, fill(INK))
                c.drawCircle(x + r * 0.4f, cy - r * 0.45f, r * 0.5f, fill(AColor.WHITE))
                c.drawCircle(x - r * 0.45f, cy + r * 0.5f, r * 0.25f, fill(AColor.WHITE))
            }
            "sleepy" -> for (x in listOf(lx, rx)) c.drawArc(RectF(x - r, cy - r, x + r, cy + r * 0.6f), 20f, 140f, false, stroke(INK, sw))
            "wink" -> {
                beady(c, lx, cy, r)
                c.drawArc(RectF(rx - r, cy - r * 0.6f, rx + r, cy + r * 1.2f), 200f, 140f, false, stroke(INK, sw))
            }
            "hearts" -> for (x in listOf(lx, rx)) heart(c, x, cy, r * 1.3f, fill(HEART))
            "stars" -> for (x in listOf(lx, rx)) star5(c, x, cy, r * 1.5f, fill(GOLD).apply { pathEffect = CornerPathEffect(r * 0.2f) })
            "glasses" -> {
                for (x in listOf(lx, rx)) beady(c, x, cy, r * 0.8f)
                val ring = stroke(INK, sw * 0.8f)
                for (x in listOf(lx, rx)) c.drawCircle(x, cy, r * 1.75f, ring)
                c.drawLine(lx + r * 1.75f, cy, rx - r * 1.75f, cy, ring)
            }
            "cyclops" -> {
                c.drawCircle(cx, cy, r * 2.1f, fill(AColor.WHITE))
                c.drawCircle(cx, cy, r * 2.1f, stroke(INK, sw * 0.7f))
                c.drawCircle(cx, cy + r * 0.2f, r * 1.1f, fill(INK))
                c.drawCircle(cx + r * 0.4f, cy - r * 0.3f, r * 0.4f, fill(AColor.WHITE))
            }
            else -> { beady(c, lx, cy, r); beady(c, rx, cy, r) } // beady
        }
    }

    fun mouth(c: Canvas, id: String, cx: Float, cy: Float, s: Float) {
        val w = s * 0.11f
        val sw = (s * 0.028f).coerceAtLeast(1f)
        when (id) {
            "grin" -> {
                val path = Path().apply { moveTo(cx - w, cy - w * 0.25f); quadTo(cx, cy + w * 1.3f, cx + w, cy - w * 0.25f); close() }
                c.drawPath(path, fill(INK))
                c.drawOval(RectF(cx - w * 0.45f, cy + w * 0.2f, cx + w * 0.45f, cy + w * 0.55f), fill(TONGUE))
            }
            "tongue" -> {
                c.drawOval(RectF(cx - w * 0.35f, cy, cx + w * 0.35f, cy + w * 0.8f), fill(TONGUE))
                c.drawArc(RectF(cx - w, cy - w * 0.9f, cx + w, cy + w * 0.4f), 20f, 140f, false, stroke(INK, sw))
            }
            "o" -> c.drawOval(RectF(cx - w * 0.3f, cy - w * 0.3f, cx + w * 0.3f, cy + w * 0.35f), fill(INK))
            "cat" -> {
                val st = stroke(INK, sw)
                c.drawArc(RectF(cx - w * 0.8f, cy - w * 0.5f, cx, cy + w * 0.3f), 0f, 180f, false, st)
                c.drawArc(RectF(cx, cy - w * 0.5f, cx + w * 0.8f, cy + w * 0.3f), 0f, 180f, false, st)
            }
            "toothy" -> {
                val path = Path().apply { moveTo(cx - w, cy - w * 0.3f); lineTo(cx + w, cy - w * 0.3f); quadTo(cx + w, cy + w * 0.9f, cx, cy + w * 0.9f); quadTo(cx - w, cy + w * 0.9f, cx - w, cy - w * 0.3f); close() }
                c.drawPath(path, fill(INK))
                c.drawRect(cx - w * 0.75f, cy - w * 0.3f, cx + w * 0.75f, cy + w * 0.08f, fill(AColor.WHITE))
            }
            "smirk" -> {
                val path = Path().apply { moveTo(cx - w * 0.8f, cy + w * 0.15f); quadTo(cx + w * 0.1f, cy + w * 0.4f, cx + w * 0.9f, cy - w * 0.35f) }
                c.drawPath(path, stroke(INK, sw))
            }
            "tiny" -> c.drawArc(RectF(cx - w * 0.45f, cy - w * 0.5f, cx + w * 0.45f, cy + w * 0.25f), 20f, 140f, false, stroke(INK, sw))
            "gasp" -> c.drawOval(RectF(cx - w * 0.5f, cy - w * 0.45f, cx + w * 0.5f, cy + w * 0.75f), fill(INK))
            else -> c.drawArc(RectF(cx - w, cy - w * 0.9f, cx + w, cy + w * 0.5f), 20f, 140f, false, stroke(INK, sw)) // smile
        }
    }

    fun nose(c: Canvas, id: String, cx: Float, cy: Float, s: Float, base: Int) {
        val r = s * 0.03f
        when (id) {
            "button" -> c.drawOval(RectF(cx - r, cy - r * 0.7f, cx + r, cy + r * 0.7f), fill(MascotComposer.mix(base, AColor.BLACK, 0.45f)))
            "red" -> {
                c.drawCircle(cx, cy, r * 1.7f, fill(0xFFEF4444.toInt()))
                c.drawCircle(cx - r * 0.5f, cy - r * 0.6f, r * 0.5f, fill(MascotComposer.withAlpha(AColor.WHITE, 0.8f)))
            }
            "blush" -> {
                val p = fill(MascotComposer.withAlpha(0xFFFF6B9A.toInt(), 0.55f))
                for (x in listOf(cx - s * 0.22f, cx + s * 0.22f)) c.drawOval(RectF(x - r * 2f, cy - r, x + r * 2f, cy + r), p)
            }
            "freckles" -> {
                val p = fill(MascotComposer.withAlpha(MascotComposer.mix(base, AColor.BLACK, 0.5f), 0.7f))
                for (x in listOf(cx - s * 0.22f, cx + s * 0.22f)) {
                    c.drawCircle(x - r, cy, r * 0.45f, p); c.drawCircle(x + r, cy - r * 0.4f, r * 0.45f, p); c.drawCircle(x + r * 0.2f, cy + r, r * 0.45f, p)
                }
            }
        }
    }

    /** Accessories: (cx, cy) is the slot center; hats sit on (cx, cy) = the head top, [hw] wide. */
    fun accessory(c: Canvas, id: String, cx: Float, cy: Float, s: Float, hw: Float, b: RectF, base: Int) {
        val sw = (s * 0.03f).coerceAtLeast(1f)
        val half = hw / 2f
        when (id) {
            "crown" -> {
                val h = hw * 0.42f
                val path = Path().apply {
                    moveTo(cx - half * 0.8f, cy + h * 0.15f); lineTo(cx - half * 0.9f, cy - h * 0.75f); lineTo(cx - half * 0.4f, cy - h * 0.3f)
                    lineTo(cx, cy - h); lineTo(cx + half * 0.4f, cy - h * 0.3f); lineTo(cx + half * 0.9f, cy - h * 0.75f); lineTo(cx + half * 0.8f, cy + h * 0.15f); close()
                }
                c.drawPath(path, fill(GOLD).apply { pathEffect = CornerPathEffect(h * 0.08f) })
                c.drawCircle(cx, cy - h * 0.25f, h * 0.1f, fill(0xFFEF4444.toInt()))
            }
            "nightcap" -> {
                val path = Path().apply { moveTo(cx - half, cy + hw * 0.08f); quadTo(cx - half * 0.2f, cy - hw * 0.7f, cx + half * 1.15f, cy - hw * 0.15f); lineTo(cx + half, cy + hw * 0.08f); close() }
                c.drawPath(path, fill(0xFF3B82F6.toInt()))
                c.drawRoundRect(RectF(cx - half * 1.05f, cy - hw * 0.02f, cx + half * 1.05f, cy + hw * 0.14f), hw * 0.07f, hw * 0.07f, fill(AColor.WHITE))
                c.drawCircle(cx + half * 1.15f, cy - hw * 0.15f, hw * 0.09f, fill(AColor.WHITE))
            }
            "sweatband" -> c.drawRoundRect(RectF(cx - half * 1.1f, cy + hw * 0.08f, cx + half * 1.1f, cy + hw * 0.24f), hw * 0.06f, hw * 0.06f, fill(0xFFEF4444.toInt()))
            "sprout" -> {
                c.drawLine(cx, cy + hw * 0.05f, cx, cy - hw * 0.28f, stroke(0xFF16A34A.toInt(), sw))
                c.drawOval(RectF(cx - hw * 0.3f, cy - hw * 0.4f, cx, cy - hw * 0.22f), fill(0xFF22C55E.toInt()))
                c.drawOval(RectF(cx, cy - hw * 0.46f, cx + hw * 0.3f, cy - hw * 0.28f), fill(0xFF22C55E.toInt()))
            }
            "beanie" -> {
                c.drawArc(RectF(cx - half, cy - hw * 0.45f, cx + half, cy + hw * 0.45f), 180f, 180f, true, fill(0xFF0EA5E9.toInt()))
                c.drawRoundRect(RectF(cx - half * 1.05f, cy - hw * 0.05f, cx + half * 1.05f, cy + hw * 0.12f), hw * 0.05f, hw * 0.05f, fill(0xFF0369A1.toInt()))
                c.drawCircle(cx, cy - hw * 0.47f, hw * 0.08f, fill(0xFF0369A1.toInt()))
            }
            "bow" -> {
                val bx = cx + half * 0.45f; val by = cy - hw * 0.02f; val r = hw * 0.16f
                val p = fill(0xFFEC4899.toInt())
                c.drawPath(Path().apply { moveTo(bx, by); lineTo(bx - r * 1.4f, by - r); lineTo(bx - r * 1.4f, by + r); close() }, p)
                c.drawPath(Path().apply { moveTo(bx, by); lineTo(bx + r * 1.4f, by - r); lineTo(bx + r * 1.4f, by + r); close() }, p)
                c.drawCircle(bx, by, r * 0.4f, fill(0xFFBE185D.toInt()))
            }
            "headphones" -> {
                val st = stroke(0xFF334155.toInt(), sw * 1.2f)
                c.drawArc(RectF(b.left + s * 0.14f, cy - hw * 0.15f, b.right - s * 0.14f, cy + s * 0.5f), 190f, 160f, false, st)
                val cup = fill(0xFFEF4444.toInt())
                c.drawRoundRect(RectF(b.left + s * 0.08f, cy + s * 0.12f, b.left + s * 0.2f, cy + s * 0.3f), s * 0.04f, s * 0.04f, cup)
                c.drawRoundRect(RectF(b.right - s * 0.2f, cy + s * 0.12f, b.right - s * 0.08f, cy + s * 0.3f), s * 0.04f, s * 0.04f, cup)
            }
            "wizard", "party" -> {
                val h = hw * 0.9f
                val color = if (id == "wizard") 0xFF6D28D9.toInt() else 0xFFF97316.toInt()
                val cone = Path().apply { moveTo(cx - half * 0.75f, cy + hw * 0.08f); lineTo(cx + half * 0.1f, cy - h); lineTo(cx + half * 0.75f, cy + hw * 0.08f); close() }
                c.drawPath(cone, fill(color).apply { pathEffect = CornerPathEffect(hw * 0.05f) })
                if (id == "wizard") {
                    c.drawRoundRect(RectF(cx - half * 1.15f, cy, cx + half * 1.15f, cy + hw * 0.12f), hw * 0.06f, hw * 0.06f, fill(0xFF5B21B6.toInt()))
                    MascotComposer.star4(c, cx, cy - h * 0.42f, hw * 0.1f, fill(GOLD))
                } else {
                    c.save(); c.clipPath(cone)
                    val sp = fill(0xFFFDE047.toInt())
                    var y = cy - h; while (y < cy + hw * 0.1f) { c.drawRect(cx - half, y, cx + half, y + h * 0.1f, sp); y += h * 0.26f }
                    c.restore()
                    c.drawCircle(cx + half * 0.1f, cy - h, hw * 0.07f, fill(0xFFEC4899.toInt()))
                }
            }
            "pirate" -> {
                val path = Path().apply {
                    moveTo(cx - half * 1.2f, cy + hw * 0.08f); quadTo(cx, cy - hw * 0.75f, cx + half * 1.2f, cy + hw * 0.08f)
                    quadTo(cx, cy - hw * 0.08f, cx - half * 1.2f, cy + hw * 0.08f); close()
                }
                c.drawPath(path, fill(0xFF1F2937.toInt()))
                c.drawCircle(cx, cy - hw * 0.22f, hw * 0.07f, fill(AColor.WHITE))
            }
            "flower" -> {
                val fx = cx + half * 0.5f; val fy = cy - hw * 0.02f; val r = hw * 0.1f
                val petal = fill(0xFFF472B6.toInt())
                for (i in 0 until 5) {
                    val a = i * 2 * PI / 5
                    c.drawCircle(fx + (r * cos(a)).toFloat(), fy + (r * sin(a)).toFloat(), r * 0.75f, petal)
                }
                c.drawCircle(fx, fy, r * 0.6f, fill(0xFFFDE047.toInt()))
            }
            "cowboy" -> {
                val brown = 0xFF92400E.toInt()
                c.drawOval(RectF(cx - half * 1.35f, cy - hw * 0.06f, cx + half * 1.35f, cy + hw * 0.14f), fill(brown))
                c.drawRoundRect(RectF(cx - half * 0.65f, cy - hw * 0.45f, cx + half * 0.65f, cy + hw * 0.04f), hw * 0.12f, hw * 0.12f, fill(brown))
                c.drawRect(cx - half * 0.65f, cy - hw * 0.1f, cx + half * 0.65f, cy - hw * 0.02f, fill(0xFF451A03.toInt()))
            }
            "chef" -> {
                val white = fill(AColor.WHITE)
                val edge = stroke(0xFFCBD5E1.toInt(), sw * 0.5f)
                for ((dx, r) in listOf(-0.32f to 0.22f, 0.32f to 0.22f, 0f to 0.27f)) {
                    c.drawCircle(cx + hw * dx, cy - hw * 0.36f, hw * r, white); c.drawCircle(cx + hw * dx, cy - hw * 0.36f, hw * r, edge)
                }
                c.drawRect(cx - half * 0.75f, cy - hw * 0.32f, cx + half * 0.75f, cy + hw * 0.1f, white)
            }
            "grad" -> {
                val ink = fill(0xFF1F2937.toInt())
                c.drawRect(cx - half * 0.6f, cy - hw * 0.12f, cx + half * 0.6f, cy + hw * 0.1f, ink)
                c.drawPath(Path().apply { moveTo(cx, cy - hw * 0.42f); lineTo(cx + half * 1.15f, cy - hw * 0.2f); lineTo(cx, cy + hw * 0.0f); lineTo(cx - half * 1.15f, cy - hw * 0.2f); close() }, ink)
                c.drawLine(cx + half * 0.7f, cy - hw * 0.22f, cx + half * 0.8f, cy + hw * 0.18f, stroke(GOLD, sw * 0.8f))
            }
            "halo" -> c.drawOval(RectF(cx - half * 0.75f, cy - hw * 0.3f, cx + half * 0.75f, cy - hw * 0.1f), stroke(GOLD, sw * 1.4f))
            "heart-glasses" -> {
                val r = s * 0.085f
                for (x in listOf(cx - s * 0.13f, cx + s * 0.13f)) heart(c, x, cy + r * 0.1f, r, fill(HEART))
                c.drawLine(cx - s * 0.06f, cy - r * 0.2f, cx + s * 0.06f, cy - r * 0.2f, stroke(HEART, sw * 0.8f))
            }
            "mustache" -> {
                val w = s * 0.12f
                val p = fill(0xFF3F2A1D.toInt())
                c.drawPath(Path().apply { moveTo(cx, cy - w * 0.1f); cubicTo(cx - w * 0.4f, cy - w * 0.5f, cx - w * 1.2f, cy - w * 0.3f, cx - w * 1.1f, cy + w * 0.15f); cubicTo(cx - w * 0.7f, cy + w * 0.05f, cx - w * 0.3f, cy + w * 0.3f, cx, cy + w * 0.1f); close() }, p)
                c.drawPath(Path().apply { moveTo(cx, cy - w * 0.1f); cubicTo(cx + w * 0.4f, cy - w * 0.5f, cx + w * 1.2f, cy - w * 0.3f, cx + w * 1.1f, cy + w * 0.15f); cubicTo(cx + w * 0.7f, cy + w * 0.05f, cx + w * 0.3f, cy + w * 0.3f, cx, cy + w * 0.1f); close() }, p)
            }
            "bowtie" -> {
                val r = s * 0.07f
                val p = fill(0xFFEF4444.toInt())
                c.drawPath(Path().apply { moveTo(cx, cy); lineTo(cx - r * 1.5f, cy - r); lineTo(cx - r * 1.5f, cy + r); close() }, p)
                c.drawPath(Path().apply { moveTo(cx, cy); lineTo(cx + r * 1.5f, cy - r); lineTo(cx + r * 1.5f, cy + r); close() }, p)
                c.drawCircle(cx, cy, r * 0.42f, fill(0xFFB91C1C.toInt()))
            }
            "tophat" -> {
                val ink = 0xFF1F2937.toInt()
                c.drawRoundRect(RectF(cx - half * 1.2f, cy - hw * 0.02f, cx + half * 1.2f, cy + hw * 0.1f), hw * 0.05f, hw * 0.05f, fill(ink))
                c.drawRoundRect(RectF(cx - half * 0.72f, cy - hw * 0.62f, cx + half * 0.72f, cy + hw * 0.04f), hw * 0.06f, hw * 0.06f, fill(ink))
                c.drawRect(cx - half * 0.72f, cy - hw * 0.14f, cx + half * 0.72f, cy - hw * 0.04f, fill(0xFFDC2626.toInt()))
            }
            "propeller" -> {
                c.drawArc(RectF(cx - half * 0.8f, cy - hw * 0.4f, cx + half * 0.8f, cy + hw * 0.4f), 180f, 180f, true, fill(0xFFFACC15.toInt()))
                c.drawArc(RectF(cx - half * 0.8f, cy - hw * 0.4f, cx + half * 0.8f, cy + hw * 0.4f), 240f, 60f, true, fill(0xFFEF4444.toInt()))
                c.drawLine(cx, cy - hw * 0.4f, cx, cy - hw * 0.55f, stroke(INK, sw))
                c.drawOval(RectF(cx - half * 0.75f, cy - hw * 0.62f, cx, cy - hw * 0.5f), fill(0xFF3B82F6.toInt()))
                c.drawOval(RectF(cx, cy - hw * 0.62f, cx + half * 0.75f, cy - hw * 0.5f), fill(0xFF22C55E.toInt()))
            }
            "catears", "bunnyears" -> {
                val outer = MascotComposer.mix(base, AColor.BLACK, 0.2f)
                val inner = 0xFFFFB3C7.toInt()
                for (sx in listOf(-1f, 1f)) {
                    val ex = cx + sx * half * 0.55f
                    if (id == "catears") {
                        c.drawPath(Path().apply { moveTo(ex - hw * 0.16f, cy + hw * 0.1f); lineTo(ex + sx * hw * 0.04f, cy - hw * 0.32f); lineTo(ex + hw * 0.16f, cy + hw * 0.1f); close() }, fill(outer).apply { pathEffect = CornerPathEffect(hw * 0.04f) })
                        c.drawPath(Path().apply { moveTo(ex - hw * 0.08f, cy + hw * 0.06f); lineTo(ex + sx * hw * 0.03f, cy - hw * 0.2f); lineTo(ex + hw * 0.08f, cy + hw * 0.06f); close() }, fill(inner))
                    } else {
                        c.drawOval(RectF(ex - hw * 0.1f, cy - hw * 0.62f, ex + hw * 0.1f, cy + hw * 0.1f), fill(AColor.WHITE))
                        c.drawOval(RectF(ex - hw * 0.05f, cy - hw * 0.52f, ex + hw * 0.05f, cy + hw * 0.02f), fill(inner))
                    }
                }
            }
            "tiara" -> {
                val h = hw * 0.3f
                val path = Path().apply {
                    moveTo(cx - half * 0.7f, cy + h * 0.2f); lineTo(cx - half * 0.45f, cy - h * 0.4f); lineTo(cx - half * 0.2f, cy - h * 0.1f)
                    lineTo(cx, cy - h); lineTo(cx + half * 0.2f, cy - h * 0.1f); lineTo(cx + half * 0.45f, cy - h * 0.4f); lineTo(cx + half * 0.7f, cy + h * 0.2f); close()
                }
                c.drawPath(path, fill(0xFFE2E8F0.toInt()).apply { pathEffect = CornerPathEffect(h * 0.1f) })
                c.drawCircle(cx, cy - h * 0.45f, h * 0.16f, fill(0xFFEC4899.toInt()))
            }
            "viking" -> {
                c.drawArc(RectF(cx - half * 0.9f, cy - hw * 0.4f, cx + half * 0.9f, cy + hw * 0.4f), 180f, 180f, true, fill(0xFF94A3B8.toInt()))
                c.drawRect(cx - half * 0.95f, cy - hw * 0.04f, cx + half * 0.95f, cy + hw * 0.08f, fill(0xFF92400E.toInt()))
                val horn = fill(0xFFFEF3C7.toInt())
                for (sx in listOf(-1f, 1f)) {
                    c.drawPath(Path().apply {
                        moveTo(cx + sx * half * 0.8f, cy - hw * 0.12f); quadTo(cx + sx * half * 1.35f, cy - hw * 0.2f, cx + sx * half * 1.3f, cy - hw * 0.6f)
                        quadTo(cx + sx * half * 1.05f, cy - hw * 0.3f, cx + sx * half * 0.75f, cy - hw * 0.3f); close()
                    }, horn)
                }
            }
            "monocle" -> {
                c.drawCircle(cx, cy, s * 0.07f, stroke(GOLD, sw * 0.8f))
                c.drawLine(cx + s * 0.05f, cy + s * 0.05f, cx + s * 0.09f, cy + s * 0.2f, stroke(GOLD, sw * 0.4f))
            }
            "scarf" -> {
                val red = 0xFFDC2626.toInt()
                c.drawRoundRect(RectF(cx - s * 0.3f, cy - s * 0.05f, cx + s * 0.3f, cy + s * 0.06f), s * 0.05f, s * 0.05f, fill(red))
                c.drawRoundRect(RectF(cx + s * 0.1f, cy, cx + s * 0.2f, cy + s * 0.24f), s * 0.03f, s * 0.03f, fill(0xFFB91C1C.toInt()))
            }
            "chain" -> {
                c.drawArc(RectF(cx - s * 0.2f, cy - s * 0.16f, cx + s * 0.2f, cy + s * 0.1f), 20f, 140f, false, stroke(GOLD, sw * 0.9f))
                c.drawCircle(cx, cy + s * 0.12f, s * 0.045f, fill(GOLD))
            }
            "wings" -> {
                // Behind the body: two white wings at the shoulders.
                val p = fill(0xFFF8FAFC.toInt())
                val e = stroke(0xFFCBD5E1.toInt(), sw * 0.5f)
                for (sx in listOf(-1f, 1f)) {
                    val wx = cx + sx * s * 0.36f; val wy = b.top + s * 0.42f
                    val path = Path().apply {
                        moveTo(cx + sx * s * 0.2f, wy); quadTo(wx + sx * s * 0.2f, wy - s * 0.3f, wx + sx * s * 0.16f, wy + s * 0.04f)
                        quadTo(wx + sx * s * 0.08f, wy + s * 0.18f, cx + sx * s * 0.2f, wy + s * 0.14f); close()
                    }
                    c.drawPath(path, p); c.drawPath(path, e)
                }
            }
            "cape" -> {
                // Behind the body: a flared cape peeking out at the sides and bottom.
                val path = Path().apply {
                    moveTo(b.left + s * 0.24f, b.top + s * 0.4f); lineTo(b.right - s * 0.24f, b.top + s * 0.4f)
                    lineTo(b.right + s * 0.04f, b.bottom - s * 0.02f); lineTo(b.left - s * 0.04f, b.bottom - s * 0.02f); close()
                }
                c.drawPath(path, fill(0xFFDC2626.toInt()).apply { pathEffect = CornerPathEffect(s * 0.06f) })
            }
        }
    }
}

/** The code-drawn backdrop motifs (AN addendum): colors[0] is already painted; motif colors follow. */
internal object MascotBackdrops {
    private fun fill(color: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }

    fun motif(c: Canvas, id: String, cols: List<Int>, size: Float) {
        val m = cols.getOrElse(1) { cols.first() }
        when (id) {
            "galaxy", "starry" -> {
                val pts = floatArrayOf(0.14f, 0.16f, 0.8f, 0.12f, 0.5f, 0.08f, 0.9f, 0.46f, 0.08f, 0.52f, 0.86f, 0.82f, 0.18f, 0.86f, 0.62f, 0.3f, 0.32f, 0.36f)
                val p = fill(m)
                for (i in pts.indices step 2) {
                    val r = size * (if (i % 4 == 0) 0.045f else 0.03f)
                    if (id == "galaxy") MascotComposer.star4(c, size * pts[i], size * pts[i + 1], r, p)
                    else c.drawCircle(size * pts[i], size * pts[i + 1], r * 0.45f, p)
                }
                if (id == "galaxy") {
                    val haze = fill(MascotComposer.withAlpha(0xFFEC4899.toInt(), 0.25f))
                    c.drawOval(RectF(size * 0.1f, size * 0.55f, size * 0.9f, size * 0.85f), haze)
                }
            }
            "polka" -> {
                val p = fill(m)
                val step = size * 0.2f
                var row = 0; var y = step * 0.5f
                while (y < size + step) {
                    var x = if (row % 2 == 0) step * 0.5f else step
                    while (x < size + step) { c.drawCircle(x, y, size * 0.045f, p); x += step }
                    y += step; row++
                }
            }
            "sunburst" -> {
                val p = fill(MascotComposer.withAlpha(m, 0.55f))
                val cx = size / 2f; val cy = size * 0.55f; val r = size * 1.2f
                for (i in 0 until 12) {
                    val a0 = i * 2 * PI / 12; val a1 = a0 + PI / 12
                    c.drawPath(Path().apply {
                        moveTo(cx, cy); lineTo(cx + (r * cos(a0)).toFloat(), cy + (r * sin(a0)).toFloat())
                        lineTo(cx + (r * cos(a1)).toFloat(), cy + (r * sin(a1)).toFloat()); close()
                    }, p)
                }
            }
            "checkers" -> {
                val p = fill(m)
                val n = 6; val cell = size / n
                for (r in 0 until n) for (col in 0 until n) if ((r + col) % 2 == 0) c.drawRect(col * cell, r * cell, (col + 1) * cell, (r + 1) * cell, p)
            }
            "confetti" -> {
                val pts = floatArrayOf(0.12f, 0.14f, 0.7f, 0.1f, 0.44f, 0.22f, 0.88f, 0.34f, 0.2f, 0.46f, 0.78f, 0.62f, 0.1f, 0.8f, 0.5f, 0.9f, 0.9f, 0.88f, 0.32f, 0.66f)
                for (i in pts.indices step 2) {
                    val color = cols.getOrElse(1 + (i / 2) % (cols.size - 1).coerceAtLeast(1)) { m }
                    val x = size * pts[i]; val y = size * pts[i + 1]; val w = size * 0.05f
                    c.save(); c.rotate((i * 37 % 90).toFloat(), x, y)
                    c.drawRoundRect(RectF(x - w, y - w * 0.4f, x + w, y + w * 0.4f), w * 0.3f, w * 0.3f, fill(color))
                    c.restore()
                }
            }
        }
    }
}
