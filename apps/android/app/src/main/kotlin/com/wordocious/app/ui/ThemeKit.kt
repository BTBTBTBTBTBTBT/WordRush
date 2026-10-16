package com.wordocious.app.ui

import android.content.Context
import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.toArgb
import com.wordocious.app.ui.theme.Palette
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.FlagsService
import com.wordocious.app.ui.theme.WTheme
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.coroutines.flow.first
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Themes as data (FRIDAY-QUEUE item 25): Default / Ocean / Forest / Dark read from assets/theme-registry.json (the
 * Android copy of packages/core/src/theme-registry.json; the web test checks the copies match), the way SeasonKit
 * reads the season registry. A theme skins the slots a season does: the wall (3 stops + a code-drawn glow), card,
 * ink, accent, tab bar and the living wallpaper. Season skins layer on top when Seasonal is on.
 *
 * Also the LIVING WALLPAPER (items 15 + 45): slow drifting things on a MENU page's wall (tiles / bubbles / leaves,
 * and while Seasonal is on bats + a witch fly-by + fog + stars, or Thanksgiving's slow V of geese). One draw pass off a ~30 fps clock, no per-particle
 * composition. Static under Reduce Motion / Battery Saver (WTheme.reducedMotion), trimmed on low-RAM devices, off
 * with the `living_wallpapers` switch. Never drawn on a game or VS board (pageBackground only).
 */
object ThemeKit {
    @Serializable data class Look(
        val wall: List<String>, val glow: String, val card: String, val ink: String,
        val inkSecondary: String, val accent: String, val tabBar: String,
    )

    @Serializable data class Ambient(
        val kind: String, val count: Int, val sprites: List<String> = emptyList(),
        val size: List<Double>, val duration: List<Double>, val opacity: Double,
    )

    @Serializable data class Tiles(val correct: String, val present: String)

    @Serializable data class Entry(
        val id: String, val title: String, val subtitle: String, val tiles: Tiles,
        val light: Look? = null, val dark: Look, val ambient: Ambient,
    )

    @Serializable data class Tile(val letter: String, val color: String)

    @Serializable data class Bats(val count: Int, val sprite: String, val size: List<Double>, val duration: List<Double>)
    @Serializable data class Witch(val sprite: String, val size: Double, val every: Double, val duration: Double)
    @Serializable data class Fog(val sprite: String, val opacity: Double, val duration: Double)
    @Serializable data class Stars(val count: Int, val color: String)
    /** A V of geese crossing the top band slowly (10-16): size = one goose's width (dp), band = the lead's height [min, max] % of the wall, direction 1 = left to right (-1 mirrored). */
    @Serializable data class Flock(val sprite: String, val count: Int, val size: List<Double>, val duration: List<Double>, val band: List<Double>, val direction: Double)
    /** Every part is optional (Halloween: bats + witch + fog + stars; Thanksgiving: flock + stars). */
    @Serializable data class SeasonalAmbient(
        val bats: Bats? = null, val witch: Witch? = null, val fog: Fog? = null, val stars: Stars? = null, val flock: Flock? = null,
    )

    @Serializable data class Seasonal(
        val title: String, val subtitle: String, val previewWall: List<String>,
        val previewTiles: List<Tile>,
        /** The season's living wallpaper; null = the base theme's ambient keeps running. */
        val ambient: SeasonalAmbient? = null,
    )

    @Serializable private data class File(val themes: List<Entry>, val seasonal: Map<String, Seasonal>)

    private val json = Json { ignoreUnknownKeys = true }

    private val file: File? by lazy {
        runCatching {
            com.wordocious.app.App.instance.assets.open("theme-registry.json").bufferedReader().use { json.decodeFromString<File>(it.readText()) }
        }.getOrNull()
    }

    val entries: List<Entry> get() = file?.themes.orEmpty()

    fun entry(id: String): Entry? = entries.firstOrNull { it.id == id } ?: entries.firstOrNull()

    fun seasonal(season: String?): Seasonal? = season?.let { file?.seasonal?.get(it) }

    /** The look a theme draws in a scheme (Dark is always night). */
    fun look(id: String, dark: Boolean): Look? = entry(id)?.let { if (dark || it.light == null) it.dark else it.light }

    /** The wall look under a MENU page for [theme] (null = the page draws its own art: Default / a season's wall). */
    fun wallLook(theme: String, seasonActive: Boolean): Look? =
        if (theme == "default" || seasonActive) null else look(theme, theme == "dark")

    // ── The skin: every slot a theme paints reads the registry (season skins still win on top) ──

    private fun skinLook(): Look? = WTheme.themeSkin?.let { id -> entry(id)?.let { it.light ?: it.dark } }
    private fun tokens(l: Look) = com.wordocious.app.data.ThemeSurfaces.tokens(
        com.wordocious.app.data.ThemeSurfaces.Input(l.card, l.ink, l.inkSecondary, l.accent, l.tabBar),
    )

    private val paletteCache = HashMap<String, Palette>()

    /** The card / border / ink tokens for a theme, derived from its registry look ([fallback] when the registry can't load). */
    fun palette(id: String, fallback: Palette): Palette = paletteCache.getOrPut(id) {
        val e = entry(id) ?: return fallback
        if (e.id != id) return fallback
        val l = e.light ?: e.dark
        val t = tokens(l)
        fallback.copy(
            bg = color(l.wall[1]), surface = color(t.surface), border = color(t.border), borderLight = color(t.borderLight),
            borderAlt = color(t.borderAlt), divider = color(t.divider), surfaceHover = color(t.surfaceHover),
            surfaceAlt = color(t.surfaceAlt), text = color(t.text), textMuted = color(t.textMuted), textSecondary = color(t.textSecondary),
        )
    }

    /** The helper-pill tint: the theme's accent (null = Default / a season's palette wins in the caller). */
    fun buttonTint(): Color? = skinLook()?.let { color(it.accent) }
    /** The quiet-pill tint: the accent softened toward the card. */
    fun quietTint(): Color? = skinLook()?.let { color(com.wordocious.app.data.ThemeSurfaces.mix(it.accent, it.card, 0.35)) }
    fun tileCorrect(): Color? = WTheme.themeSkin?.let { id -> entry(id)?.let { color(it.tiles.correct) } }
    fun tilePresent(): Color? = WTheme.themeSkin?.let { id -> entry(id)?.let { color(it.tiles.present) } }
    fun keyCorrect(): Color? = tileCorrect()?.let { color(com.wordocious.app.data.ThemeSurfaces.mix(
        String.format("#%06X", it.toArgb() and 0xFFFFFF), "#000000", 0.12)) }
    /** A headline palette from one accent: lighter top, the accent, a deep shade. */
    // Founder 10-10 (readability): a label's ink is lifted on dark surfaces (the dark theme and a dark season's night cards)
    // until it reads (SurfaceInk.lift, idempotent); [lift] = false keeps the exact ink (page headlines, light-only pages).
    fun accentPalette(c0: Color, lift: Boolean = true, dark: Boolean = WTheme.isDark): HeadlinePalette {
        val c = if (lift) SurfaceInk.lift(c0, dark) else c0
        return HeadlinePalette(
            top = androidx.compose.ui.graphics.lerp(c, Color.White, 0.4f), bottom = c,
            deep = androidx.compose.ui.graphics.lerp(c, Color.Black, 0.5f),
            nameTop = androidx.compose.ui.graphics.lerp(c, Color.White, 0.4f), nameBottom = c,
        )
    }

    /** The accent page headlines (bubble lettering) wear. */
    fun headlineAccent(): Color? = buttonTint()
    /** The bottom nav's fill (top, bottom), top edge and selected ink. */
    fun tabLook(): Triple<Color, Color, Color>? = skinLook()?.let { l ->
        val t = tokens(l)
        val top = com.wordocious.app.data.ThemeSurfaces.mix(t.tabBar, "#FFFFFF", if (WTheme.themeSkin == "dark") 0.06 else 0.35)
        Triple(color(top), color(t.tabBar), color(t.tabEdge))
    }

    fun color(hex: String): Color = runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color.White)

    // ── Sprites (explicit table: resource shrinking must see every id) ──────────

    @DrawableRes
    private fun spriteRes(name: String): Int? = when (name) {
        "bubble-1" -> R.drawable.ambient_bubble_1; "bubble-2" -> R.drawable.ambient_bubble_2
        "bubble-3" -> R.drawable.ambient_bubble_3; "bubble-4" -> R.drawable.ambient_bubble_4
        "leaf-1" -> R.drawable.ambient_leaf_1; "leaf-2" -> R.drawable.ambient_leaf_2
        "leaf-3" -> R.drawable.ambient_leaf_3; "leaf-4" -> R.drawable.ambient_leaf_4
        "bat" -> R.drawable.ambient_bat; "witch" -> R.drawable.ambient_witch; "fog" -> R.drawable.ambient_fog
        "goose" -> R.drawable.ambient_goose
        else -> null
    }

    private val sprites = HashMap<String, ImageBitmap?>()
    fun sprite(context: Context, name: String): ImageBitmap? = sprites.getOrPut(name) {
        spriteRes(name)?.let { ArtBitmaps.get(context, it, 160) }
    }

    // ── The clock ───────────────────────────────────────────────────────────────

    /** Whether the wallpaper should be a frozen frame (Reduce Motion / Battery Saver / the in-app toggle). */
    val still: Boolean get() = WTheme.reducedMotion

    /** Fewer particles on a low-RAM device. */
    private fun trim(context: Context): Double =
        if ((context.getSystemService(Context.ACTIVITY_SERVICE) as? android.app.ActivityManager)?.isLowRamDevice == true) 0.5 else 1.0

    /**
     * The wallpaper's clock (ms), ~24 fps, or 0 forever when it should stand still / is switched off.
     * Founder 10-10 (smoothness): every tick redraws the whole window behind the page, so the clock stands down
     * while the page scrolls, while its tab is hidden (a game or another tab covers it) and for a beat after a page
     * opens or a scroll ends; the paused time is cut out of the clock, so the bats resume where they stopped.
     */
    @Composable
    fun rememberClock(enabled: Boolean): State<Long> =
        rememberPausableClock(enabled && FlagsService.isLive("living_wallpapers") && !WTheme.reducedMotion, settleMs = 500)

    /**
     * The shared ambient tick (ms, ~24 fps; 0 while [on] is false). Every instance fires on the SAME vsync frames (a
     * global 41.7 ms grid keyed on the frame time, not a per-instance timer), so the wallpaper, the Home banner trio
     * and a second page's wallpaper land in one rendered frame instead of staggered ones. Stands down while the tab
     * is hidden / its page scrolls and for [settleMs] after a page opens or a scroll ends; paused time is cut out of
     * the clock so motion resumes where it stopped. Read it inside a draw / graphicsLayer lambda, never in composition.
     */
    @Composable
    fun rememberPausableClock(on: Boolean, settleMs: Long): State<Long> {
        val clock = remember { mutableLongStateOf(0L) }
        val hidden = LocalTabHidden.current
        val scrolling = LocalScrollActive.current
        LaunchedEffect(on) {
            if (!on) { clock.longValue = 0L; return@LaunchedEffect }
            var lastBucket = -1L
            var skew = 0L
            // a page just opened: let it settle (its entrance + first layout) before things move
            kotlinx.coroutines.delay(settleMs)
            while (true) {
                if (hidden.value || scrolling.value) {
                    val from = withFrameNanos { it }
                    androidx.compose.runtime.snapshotFlow { hidden.value || scrolling.value }.first { !it }
                    kotlinx.coroutines.delay(250)
                    skew += withFrameNanos { it } - from
                }
                withFrameNanos { n ->
                    val bucket = n / TICK_NANOS
                    if (bucket != lastBucket) { lastBucket = bucket; clock.longValue = ((n - skew) / 1_000_000L).coerceAtLeast(1L) }
                }
            }
        }
        return clock
    }

    private const val TICK_NANOS = 41_666_667L

    // ── Drawing ─────────────────────────────────────────────────────────────────

    // A deterministic 0..1 sequence (same as web theme-wall.tsx `unit`): the layout never changes between draws.
    private fun unit(i: Int, salt: Double): Double {
        val x = sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453
        return x - floor(x)
    }
    private fun lerp(a: Double, b: Double, t: Double) = a + (b - a) * t

    private val TILE_HUES = listOf(0xFF7C3AED, 0xFFEC4899, 0xFFF59E0B, 0xFF10B981, 0xFF3B82F6).map { Color(it) }

    /** The theme wall: 3 stops top to bottom + a soft radial glow near the top. */
    fun DrawScope.drawThemeWall(look: Look, origin: Offset, root: Size) {
        val stops = look.wall.map(::color)
        drawRect(Brush.verticalGradient(stops, startY = -origin.y, endY = root.height - origin.y))
        val glow = color(look.glow)
        drawRect(Brush.radialGradient(
            listOf(glow.copy(alpha = 0.42f), glow.copy(alpha = 0f)),
            center = Offset(root.width / 2f - origin.x, -0.05f * root.height - origin.y), radius = root.height * 0.55f,
        ))
    }

    /** One frame of the wallpaper for [theme] / [season] at clock [ms] (0 = a frozen frame). */
    fun DrawScope.drawAmbient(
        context: Context, theme: String, season: String?, ms: Long, origin: Offset, root: Size, measurer: TextMeasurer,
    ) {
        val t = ms / 1000.0
        val tr = trim(context)
        val seasonal = seasonal(season)
        val w = root.width; val h = root.height
        val seasonalAmbient = seasonal?.ambient
        if (seasonalAmbient != null) {
            val a = seasonalAmbient
            // Every part is optional (Halloween: stars + fog + bats + witch; Thanksgiving: a flock of geese + a few stars).
            a.stars?.let { stars ->
                val starColor = color(stars.color)
                for (i in 0 until (stars.count * tr).roundToInt()) {
                    val dur = lerp(3.0, 7.0, unit(i, 13.0))
                    val tw = if (ms == 0L) 0.8 else 0.2 + 0.75 * abs(sin(PI * (t / dur + unit(i, 14.0))))
                    drawCircle(starColor.copy(alpha = tw.toFloat()), 1.5.dp.toPx(), Offset((unit(i, 11.0) * 0.96 * w - origin.x).toFloat(), (unit(i, 12.0) * 0.55 * h - origin.y).toFloat()))
                }
            }
            a.fog?.let { f -> sprite(context, f.sprite)?.let { fog ->
                val fw = w * 1.3f; val fh = fw * fog.height / fog.width
                val p = if (ms == 0L) 0.5 else (1 + sin(t / f.duration * PI * 2)) / 2
                drawImage(fog, dstOffset = IntOffset((-w * 0.14f + p.toFloat() * w * 0.1f - origin.x).roundToInt(), (h - fh - origin.y).roundToInt()),
                    dstSize = IntSize(fw.roundToInt(), fh.roundToInt()), alpha = f.opacity.toFloat())
            } }
            a.bats?.let { bats -> sprite(context, bats.sprite)?.let { bat ->
                for (i in 0 until maxOf(1, (bats.count * tr).roundToInt())) {
                    val bw = lerp(bats.size[0], bats.size[1], unit(i, 21.0)).dp.toPx()
                    val bh = bw * 0.69f
                    val dur = lerp(bats.duration[0], bats.duration[1], unit(i, 23.0))
                    val f = if (ms == 0L) 0.7 else (t / dur + unit(i, 24.0)) % 1.0
                    val x = lerp(-0.14, 1.16, f) * w
                    val y = (0.06 + unit(i, 22.0) * 0.4) * h + sin(f * PI * 4) * 14.dp.toPx()
                    // A soft wingbeat (~1.7/s, each bat out of step): the wings squash toward the body and open again.
                    val flap = if (ms == 0L) 1f else (0.78 + 0.22 * sin((t / 0.6 + unit(i, 25.0)) * PI * 2)).toFloat()
                    scale(1f, flap, pivot = Offset((x - origin.x).toFloat() + bw / 2, (y - origin.y).toFloat() + bh / 2)) {
                        drawImage(bat, dstOffset = IntOffset((x - origin.x).roundToInt(), (y - origin.y).roundToInt()), dstSize = IntSize(bw.roundToInt(), bh.roundToInt()))
                    }
                }
            } }
            a.flock?.let { drawFlock(context, it, ms, tr, origin, root) }
            val witchSpec = a.witch
            if (ms != 0L && witchSpec != null) {
                val f = (t / witchSpec.every) % 1.0
                if (f < 0.2) sprite(context, witchSpec.sprite)?.let { witch ->
                    val p = f / 0.2
                    val ww = witchSpec.size.dp.toPx(); val wh = ww * witch.height / witch.width
                    val x = lerp(-0.24, 1.24, p) * w
                    var y = h * 0.14 - sin(p * PI) * 28.dp.toPx()
                    // Every third pass she crosses the wall's own moon (a silhouette against it), on a gentle climb.
                    if ((t / witchSpec.every).toInt() % 3 == 2) {
                        // Every Halloween wall paints its moon at the same spot (1290x2796 art, aspect-fill).
                        val iw = 1290.0; val ih = 2796.0
                        val sc = maxOf(w / iw, h / ih)
                        val mx = (w - iw * sc) / 2 + 0.74 * iw * sc
                        val my = (h - ih * sc) / 2 + 0.071 * ih * sc
                        y = my + (mx - (x + ww / 2)) * 0.12 - wh / 2
                    }
                    drawImage(witch, dstOffset = IntOffset((x - origin.x).roundToInt(), (y - origin.y).roundToInt()), dstSize = IntSize(ww.roundToInt(), wh.roundToInt()), alpha = 0.95f)
                }
            }
            return
        }
        val a = entry(theme)?.ambient ?: return
        val n = maxOf(2, (a.count * tr).roundToInt())
        for (i in 0 until n) {
            val s = lerp(a.size[0], a.size[1], unit(i, 1.0)).dp.toPx()
            val dur = lerp(a.duration[0], a.duration[1], unit(i, 4.0))
            val f = (t / dur + unit(i, 5.0)) % 1.0
            val sway = lerp(-18.0, 18.0, unit(i, 6.0)) / 100 * w
            val rot = lerp(-25.0, 25.0, unit(i, 7.0))
            val x = unit(i, 2.0) * 0.92 * w + sway * f
            var angle = 0.0
            val y = when (a.kind) {
                "leaves" -> { angle = rot * f; lerp(-0.18, 1.12, f) * h }
                "bubbles" -> lerp(1.08, -0.22, f) * h
                else -> { angle = lerp(-rot, rot, f); lerp(1.08, -0.22, f) * h }
            }
            val topLeft = Offset((x - origin.x).toFloat(), (y - origin.y).toFloat())
            val c = Offset(topLeft.x + s / 2, topLeft.y + s / 2)
            rotate(angle.toFloat(), pivot = c) {
                if (a.sprites.isNotEmpty()) {
                    sprite(context, a.sprites[i % a.sprites.size])?.let {
                        drawImage(it, dstOffset = IntOffset(topLeft.x.roundToInt(), topLeft.y.roundToInt()), dstSize = IntSize(s.roundToInt(), s.roundToInt()), alpha = a.opacity.toFloat())
                    }
                } else {
                    val hue = TILE_HUES[i % TILE_HUES.size]
                    drawRoundRect(Brush.verticalGradient(listOf(hue.copy(alpha = 0.75f), hue), startY = topLeft.y, endY = topLeft.y + s),
                        topLeft = topLeft, size = Size(s, s), cornerRadius = CornerRadius(s * 0.24f), alpha = a.opacity.toFloat())
                    val letter = "WORDCISU"[i % 8].toString()
                    val layout = measurer.measure(letter, TextStyle(color = Color.White, fontSize = (s * 0.55f / density).sp, fontWeight = FontWeight.Black))
                    drawText(layout, topLeft = Offset(c.x - layout.size.width / 2f, c.y - layout.size.height / 2f), alpha = a.opacity.toFloat())
                }
            }
        }
    }
}

/** The V of geese (10-16, founder: "animate that V of ducks like the bats"): same numbers as web theme-wall.tsx flockGeese /
 *  iOS LivingWallpaper flockGeese: lead + two trailing arms (0.92 L step, 0.30 spread, the upper arm a little tighter),
 *  the wall engine's geese_v formation; each goose beats its wings with the bats' scaleY squash about its body. */
private data class Goose(val x: Double, val y: Double, val w: Double, val k: Int)

private fun flockGeese(count: Int, size: Double, direction: Double, salt: Double): Pair<List<Goose>, Double> {
    fun unit(i: Int, s: Double): Double { val x = sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453; return x - floor(x) }
    fun lerp(a: Double, b: Double, t: Double) = a + (b - a) * t
    val L = size * 0.56                       // the sprite is 1.78 L wide (goose() spans -0.70 L .. 1.00 L + padding)
    val perArm = (count - 1) / 2
    val geese = mutableListOf(Goose(0.0, 0.0, size, 0))
    var k = 1
    for ((dy, tight, extra) in listOf(Triple(-1.0, 0.78, 0), Triple(1.0, 1.0, (count - 1) % 2))) {
        for (i in 1..(perArm + extra)) {
            geese += Goose(
                x = -direction * (i * L * 0.92 + lerp(-0.05, 0.05, unit(k, salt + 1)) * L),
                y = dy * i * L * 0.30 * tight + lerp(-0.06, 0.06, unit(k, salt + 2)) * L,
                w = size * lerp(0.86, 1.0, unit(k, salt + 3)), k = k,
            )
            k++
        }
    }
    return geese to (perArm * L * 0.92 + size)
}

/** Two flocks: 0 = always on its way across (one slow linear pass, 40-70 s, a gentle rise and fall); 1 = a smaller one that
 *  passes once every third cycle (hidden the rest). Frozen (ms == 0): the main flock parks mid sky, the rare one is hidden. */
private fun DrawScope.drawFlock(context: Context, f: ThemeKit.Flock, ms: Long, tr: Double, origin: Offset, root: Size) {
    fun unit(i: Int, s: Double): Double { val x = sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453; return x - floor(x) }
    fun lerp(a: Double, b: Double, t: Double) = a + (b - a) * t
    val img = ThemeKit.sprite(context, f.sprite) ?: return
    val t = ms / 1000.0
    val w = root.width; val h = root.height
    val direction = if (f.direction < 0) -1.0 else 1.0
    for (which in 0..(if (tr >= 1) 1 else 0)) {
        val rare = which == 1
        if (rare && ms == 0L) continue
        val count = if (rare) maxOf(3, f.count - 2) else f.count
        val gw = lerp(f.size[0], f.size[1], unit(which, 31.0)) * (if (rare) 0.8 else 1.0)
        val dur = lerp(f.duration[0], f.duration[1], unit(which, 32.0)) * (if (rare) 1.15 else 1.0)
        val (geese, trailDp) = flockGeese(count, gw, direction, 40.0 + which * 10)
        val trail = trailDp.dp.toPx()
        val top = lerp(f.band[0], f.band[1], unit(which, 33.0)) / 100 * h
        val x0 = if (direction > 0) -0.1 * w else 1.1 * w + trail
        val x1 = if (direction > 0) 1.1 * w + trail else -0.1 * w
        val p = when {
            ms == 0L -> 0.5
            !rare -> (t / dur + unit(which, 34.0)) % 1.0
            else -> { val c = (t / (dur * 3)) % 1.0; if (c >= 1.0 / 3) continue else c * 3 }
        }
        val lx = lerp(x0, x1, p); val ly = top + sin(p * PI * 2) * -0.012 * h
        for (g in geese) {
            val bw = g.w.dp.toPx(); val bh = bw / 2
            val cx = (lx + g.x.dp.toPx() - origin.x).toFloat()
            val topY = (ly + g.y.dp.toPx() - bh * 0.85 - origin.y).toFloat()
            val flap = if (ms == 0L) 1f else (0.80 + 0.20 * sin((t / 1.1 + unit(g.k, 35.0 + which)) * PI * 2)).toFloat()
            scale(direction.toFloat(), flap, pivot = Offset(cx, topY + bh * 0.85f)) {
                drawImage(img, dstOffset = IntOffset((cx - bw / 2).roundToInt(), topY.roundToInt()), dstSize = IntSize(bw.roundToInt(), bh.roundToInt()))
            }
        }
    }
}

/** Settings > Theme: a row's REAL mini preview (wall + a small card of four tiles) is drawn in SettingsScreen. */
fun ThemeKit.Look.wallColors(): List<Color> = wall.map(ThemeKit::color)
