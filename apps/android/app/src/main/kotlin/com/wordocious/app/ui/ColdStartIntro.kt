package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch
import kotlin.math.roundToInt
import kotlin.math.sin

// FINISH_SPEC F2: the cold-start intro. AQ3: the OS launch screen (Android 12+ SplashScreen,
// res/values-v31/themes.xml) is the bare lilac (no icon) and this overlay brings in the only W
// (cold start only, ≤ 1.6 s, tap to
// skip): W bounces once, the other nine cast heroes pop in beside it one after another
// until the row spells WORDOCIOUS, and the whole row glides up and shrinks into the
// Home header's cast row (CastHeaderAnchor) while Home fades in underneath. Reduce
// Motion: a 200 ms crossfade. Never shown on resume / warm start.

/** Whether this process already played the intro (a warm start never replays it). */
object ColdStart {
    var played = false

    /**
     * F2 fix (founder 10-02: "there are two of them"): true while the intro's own row is
     * on screen — the REAL header cast row stays laid out (so it can be measured) but
     * invisible until the intro lands on it.
     */
    var hidingHeader by mutableStateOf(false)

    /** F2 fix step 4: bumped on landing — the real row plays the all-cast hop flourish once. */
    var flourish by mutableStateOf(0)

    /** AU5: true once the intro has landed (or never ran) — heavy startup work waits on it. */
    val landed = kotlinx.coroutines.flow.MutableStateFlow(false)

    /** AU5 the intro's ten figures for this launch's season (decoded before the first frame). */
    fun introRes(): List<Int> {
        val season = SeasonSkins.current()
        return MascotId.entries.map { SeasonSkins.frame(it, season).res }
    }

    /**
     * AU5 decode every intro figure into the shared [ArtBitmaps] cache (full size) — called
     * off the main thread while the plain launch color is still up.
     */
    fun preload(context: android.content.Context) {
        introRes().forEach { ArtBitmaps.get(context, it, INTRO_DECODE_PX) }
    }

    /** The intro's decode size (the 512 px source, unsampled). */
    const val INTRO_DECODE_PX = 512
}

/** F2 fix step 4 the flourish timing: each character hops (the W hop) this long, this far apart. */
object IntroFlourish {
    const val HOP_MS = 420
    const val STAGGER_MS = 50
    /** The whole wave across the ten characters. */
    const val TOTAL_MS = HOP_MS + STAGGER_MS * 9

    /** Character [index]'s own hop progress (0..1) at [ms] into the wave; null = not hopping. */
    fun local(index: Int, ms: Float): Float? {
        val u = (ms - index * STAGGER_MS) / HOP_MS
        return if (u <= 0f || u >= 1f) null else u
    }
}

/** F2 the timeline (ms). */
private object IntroT {
    const val BOUNCE_END = 300f
    const val GLIDE_W_END = 650f
    const val POP_START = 320f
    const val POP_STAGGER = 50f
    const val POP_MS = 300f
    const val TO_HEADER_START = 1000f
    const val TO_HEADER_END = 1450f
    const val REDUCED_MS = 200
}

/** The launch W's box (the SplashScreen icon's 192 dp circle holds the full 512 image). */
private const val LAUNCH_W_DP = 192f

private fun easeInOut(t: Float): Float {
    val x = t.coerceIn(0f, 1f)
    return if (x < 0.5f) 4f * x * x * x else 1f - ((-2f * x + 2f).let { it * it * it }) / 2f
}

private fun lerp(a: Float, b: Float, t: Float) = a + (b - a) * t
private fun lerpRect(a: Rect, b: Rect, t: Float) = Rect(lerp(a.left, b.left, t), lerp(a.top, b.top, t), lerp(a.right, b.right, t), lerp(a.bottom, b.bottom, t))

/**
 * F2 the cold-start intro overlay. Covers the screen above whatever renders under it
 * and calls [onDone] when it has faded away (or was tapped away). Decorative.
 */
@Composable
fun ColdStartIntro(onDone: () -> Unit) {
    val reduced = WTheme.reducedMotion
    val clock = remember { Animatable(0f) }
    val skip = remember { Animatable(1f) }
    var skipping by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    // F2 fix step 1: the real header row hides while our row is up (Reduce Motion keeps it:
    // that path is a plain 200 ms crossfade over the real Home).
    remember { if (!reduced) ColdStart.hidingHeader = true; 0 }
    /** F2 fix step 3: land — in ONE frame the real row shows, this row goes, and the flourish starts. */
    fun land() {
        ColdStart.landed.value = true
        if (!ColdStart.hidingHeader && reduced) { onDone(); return }
        ColdStart.hidingHeader = false
        if (!reduced) ColdStart.flourish++
        onDone()
    }
    LaunchedEffect(Unit) {
        if (reduced) {
            skip.animateTo(0f, tween(IntroT.REDUCED_MS))
        } else {
            // Glide to exactly the measured header frame (no overshoot), then land.
            clock.animateTo(IntroT.TO_HEADER_END, tween(IntroT.TO_HEADER_END.toInt(), easing = LinearEasing))
        }
        // A tap-to-skip lands on its own (below).
        if (!skipping) land()
    }
    androidx.compose.runtime.DisposableEffect(Unit) { onDispose { ColdStart.hidingHeader = false; ColdStart.landed.value = true } }
    // X: in season (or the admin preview) the intro builds the row from the costumes.
    val season = rememberSeason()
    val frames = MascotId.entries.map { SeasonSkins.frame(it, season) }
    // AU5: the figures were decoded before the first frame (ColdStart.preload); a cache miss
    // decodes here as before.
    val context = androidx.compose.ui.platform.LocalContext.current
    val images = frames.map { f ->
        remember(f.res) { ArtBitmaps.get(context, f.res, ColdStart.INTRO_DECODE_PX) } ?: ImageBitmap.imageResource(f.res)
    }
    var origin by remember { mutableStateOf(Offset.Zero) }
    val density = LocalDensity.current

    BoxWithConstraints(
        Modifier.fillMaxSize()
            .onGloballyPositioned { origin = it.boundsInWindow().topLeft }
            .clearAndSetSemantics { }
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                // F2 fix step 5: tap to skip jumps straight to the landing.
                if (!skipping && !reduced) {
                    skipping = true
                    scope.launch { land() }
                }
            },
    ) {
        val wPx = constraints.maxWidth.toFloat()
        val hPx = constraints.maxHeight.toFloat()
        Canvas(Modifier.fillMaxSize()) {
            val t = clock.value
            val overall = skip.value
            // The lilac backdrop fades as the row heads for the header (Home fades in under it).
            val bgAlpha = if (reduced) overall else (1f - easeInOut((t - IntroT.TO_HEADER_START) / (IntroT.TO_HEADER_END - IntroT.TO_HEADER_START))) * overall
            drawRect(Color(0xFFECE0FB), alpha = bgAlpha.coerceIn(0f, 1f))

            // The row's geometry at intro size: ten trimmed figures at one height.
            val rowW = minOf(wPx * 0.92f, with(density) { 520.dp.toPx() })
            val figH = SeasonSkins.figureHeight(rowW, season)
            val lift = CastCrops.STAGGER * figH
            val rowH = figH + lift
            val rowLeft = (wPx - rowW) / 2f
            val rowTop = (hPx - rowH) / 2f
            val overlap = CastCrops.OVERLAP * rowW
            val slots = ArrayList<Rect>(10)
            var x = rowLeft
            MascotId.entries.forEachIndexed { i, _ ->
                val fw = frames[i].crop.aspect * figH
                val bottom = rowTop + rowH - (if (i % 2 == 1) lift else 0f)
                slots.add(Rect(x, bottom - figH, x + fw, bottom))
                x += fw - overlap
            }

            // Where the row lands: the header's cast row (its bottom-left, its width).
            val anchor = CastHeaderAnchor.bounds?.translate(-origin.x, -origin.y)
            val k: Float
            val dx: Float
            val dy: Float
            if (anchor != null && anchor.width > 0f) {
                k = anchor.width / rowW
                dx = anchor.left - rowLeft * k
                dy = anchor.bottom - (rowTop + rowH) * k
            } else {
                k = 1f; dx = 0f; dy = 0f
            }
            val toHeader = if (reduced) 0f else easeInOut((t - IntroT.TO_HEADER_START) / (IntroT.TO_HEADER_END - IntroT.TO_HEADER_START))
            // F2 fix: the row stays fully opaque all the way onto the header frame (no fade-out
            // overlapping the real row); without a measured header it fades as it rises.
            val rowAlpha = overall
                .let { if (anchor == null && !reduced) it * (1f - toHeader) else it }
                .coerceIn(0f, 1f)

            fun toFinal(r: Rect): Rect = if (toHeader <= 0f) r else lerpRect(
                r, Rect(r.left * k + dx, r.top * k + dy, r.right * k + dx, r.bottom * k + dy), toHeader,
            )

            MascotId.entries.forEachIndexed { i, id ->
                val img = images[i]
                val crop = frames[i].crop
                val source = frames[i].source.toFloat()
                val sc = img.width / source
                val srcOff = IntOffset((crop.left * sc).roundToInt(), (crop.top * sc).roundToInt())
                val srcSize = IntSize((crop.width * sc).roundToInt().coerceAtMost(img.width - srcOff.x), (crop.height * sc).roundToInt().coerceAtMost(img.height - srcOff.y))
                var rect: Rect
                var scale = 1f
                var alpha = rowAlpha
                if (id == MascotId.W) {
                    // Starts as the launch W (the whole image in a 192 dp box, centered).
                    val box = with(density) { LAUNCH_W_DP.dp.toPx() }
                    val bx = (wPx - box) / 2f
                    val by = (hPx - box) / 2f
                    val start = Rect(bx + crop.left / source * box, by + crop.top / source * box, bx + crop.right / source * box, by + crop.bottom / source * box)
                    rect = if (reduced) start else lerpRect(start, slots[i], easeInOut((t - IntroT.BOUNCE_END) / (IntroT.GLIDE_W_END - IntroT.BOUNCE_END)))
                    if (!reduced && t < IntroT.BOUNCE_END) {
                        // One bounce: up ~8% of its height and back, a little squash on landing.
                        val u = t / IntroT.BOUNCE_END
                        val hop = sin(u * Math.PI).toFloat()
                        rect = rect.translate(0f, -hop * rect.height * 0.08f)
                        scale = 1f + 0.04f * hop
                    }
                } else {
                    if (reduced) return@forEachIndexed
                    rect = slots[i]
                    val start = IntroT.POP_START + (i - 1) * IntroT.POP_STAGGER
                    val u = ((t - start) / IntroT.POP_MS).coerceIn(0f, 1f)
                    if (u <= 0f) return@forEachIndexed
                    // Spring pop: 0 → 1.12 → 1.
                    scale = if (u < 0.6f) 1.12f * easeInOut(u / 0.6f) else lerp(1.12f, 1f, (u - 0.6f) / 0.4f)
                    alpha *= (u * 3f).coerceAtMost(1f)
                }
                rect = toFinal(rect)
                if (scale != 1f) {
                    val c = Offset(rect.center.x, rect.bottom)
                    rect = Rect(c.x - rect.width * scale / 2f, c.y - rect.height * scale, c.x + rect.width * scale / 2f, c.y)
                }
                if (alpha <= 0f || rect.width <= 0f) return@forEachIndexed
                drawImage(
                    img, srcOffset = srcOff, srcSize = srcSize,
                    dstOffset = IntOffset(rect.left.roundToInt(), rect.top.roundToInt()),
                    dstSize = IntSize(rect.width.roundToInt().coerceAtLeast(1), rect.height.roundToInt().coerceAtLeast(1)),
                    alpha = alpha, filterQuality = FilterQuality.High,
                )
            }
        }
    }
}
