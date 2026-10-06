package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.zIndex
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay
import kotlin.math.roundToInt
import kotlin.random.Random

// FINISH_SPEC A5: the living cast header (option A) on Home and the tab pages. The ten
// cast heroes (`mascot_<id>`), each trimmed to its figure and drawn as its own image,
// spell WORDOCIOUS edge to edge; every 2.6–5 s ONE random character (never the same
// twice in a row) plays its move (CastMoves). Off with Reduce Motion (the in-app
// toggle or the system "Remove animations") and while its tab is hidden.
// Visual reference: the `.castrow` in docs/design/brand/mockups/game-kit.html.

/**
 * Where the header's cast row sits in the window (F2: the cold-start intro glides the
 * row it builds into exactly this rectangle). Null until a header has been laid out.
 */
object CastHeaderAnchor {
    var bounds by mutableStateOf<Rect?>(null)
}

/**
 * A cast hero trimmed to its figure (CastCrops), as a painter. X: [season] =
 * "halloween" draws the costume (`art_halloween_<id>`, its own 320-px crops).
 */
@Composable
fun rememberCastPainter(id: MascotId, season: String? = null): BitmapPainter {
    val frame = SeasonSkins.frame(id, season)
    // AQ2: the shared decoded figure (every tab's header paints the same ten bitmaps).
    val context = androidx.compose.ui.platform.LocalContext.current
    val bitmap: ImageBitmap = remember(frame.res) { ArtBitmaps.get(context, frame.res, 512) } ?: ImageBitmap.imageResource(frame.res)
    val crop = frame.crop
    return remember(bitmap, crop) {
        // Clamp to the decoded bitmap (the crops are in the skin's source coordinates).
        val k = bitmap.width / frame.source.toFloat()
        BitmapPainter(
            bitmap,
            IntOffset((crop.left * k).roundToInt(), (crop.top * k).roundToInt()),
            IntSize(
                (crop.width * k).roundToInt().coerceAtMost(bitmap.width - (crop.left * k).roundToInt()),
                (crop.height * k).roundToInt().coerceAtMost(bitmap.height - (crop.top * k).roundToInt()),
            ),
            filterQuality = FilterQuality.High,
        )
    }
}

/**
 * A5 The living cast header: the ten trimmed figures at one shared height across the
 * full width given (2.2% overlap, every second figure a step higher), with one
 * character at a time playing its move. [crown] puts the gold crown sprite on W (AA1,
 * the Pro identifier; tapping it opens the "You're Pro" sheet). [live] = false keeps it still (the cold-start intro's static copy).
 * Decorative row, announced once as "Wordocious".
 */
@Composable
fun LivingCastHeader(
    modifier: Modifier = Modifier,
    crown: Boolean = false,
    live: Boolean = true,
    reportAnchor: Boolean = true,
) {
    val hidden by LocalTabHidden.current
    // AQ2: the idle moves also wait while the page scrolls.
    val scrolling by LocalScrollActive.current
    val still = WTheme.reducedMotion || !live
    // FINISH_SPEC AD: the idle moves + crown twinkle are ambient — Battery Saver stops them too
    // (the one-shot intro flourish follows Reduce Motion alone).
    val calm = still || WTheme.calmMotion
    var acting by remember { mutableStateOf<MascotId?>(null) }
    val progress = remember { Animatable(0f) }
    // F2 fix step 4: after the cold-start intro lands, an all-cast hop wave on the real row.
    val wave = remember { Animatable(-1f) }
    val flourishKey = ColdStart.flourish
    LaunchedEffect(flourishKey) {
        // Spec U: the intro flourish's cast hop = one quiet `hop` (never the idle moves).
        if (flourishKey != 0 && reportAnchor && live) {
            com.wordocious.app.data.SoundManager.play(com.wordocious.app.data.Sfx.HOP, volume = 0.6f)
        }
        if (flourishKey == 0 || still || !reportAnchor) return@LaunchedEffect
        wave.snapTo(0f)
        wave.animateTo(IntroFlourish.TOTAL_MS.toFloat(), tween(IntroFlourish.TOTAL_MS, easing = LinearEasing))
        wave.snapTo(-1f)
    }
    // 2.7.1 cast puppets: out of season each figure is its rig (CastPuppets); a tap makes it
    // hop + laugh. In season the costumes stay, with a transform-only tap hop.
    val context = androidx.compose.ui.platform.LocalContext.current
    val view = androidx.compose.ui.platform.LocalView.current
    var rigs by remember { mutableStateOf(CastPuppets.loaded()) }
    LaunchedEffect(Unit) { if (rigs == null) rigs = CastPuppets.load(context) }
    val seasonNow = rememberSeason()
    val puppetsOn = rigs != null && seasonNow == null && live
    /** Frame clock (ms, System.nanoTime base) — read only while drawing, so a tick redraws without recomposing. */
    val clock = remember { androidx.compose.runtime.mutableLongStateOf(System.nanoTime() / 1_000_000) }
    val t0 = remember { System.nanoTime() / 1_000_000 }
    val gestures = remember { androidx.compose.runtime.mutableStateMapOf<MascotId, Long>() }
    val taps = remember { androidx.compose.runtime.mutableStateMapOf<MascotId, Long>() }
    var wake by remember { mutableStateOf(0) }
    fun busy(now: Long): Boolean {
        val b = rigs ?: return false
        if (taps.values.any { now - it < b.tap.dur * 1000 }) return true
        return gestures.any { (id, at) -> now - at < (b.rigs[id.key]?.gestureSeconds ?: 0.0) * 1000 }
    }
    // The puppets breathe at 15 fps (full rate while a move or tap plays); they hold still
    // while the page scrolls, the tab is hidden, or with Reduce Motion / Battery Saver (a tap
    // still plays: the laugh face fades; in season, the costume's hop).
    LaunchedEffect(rigs, puppetsOn, calm, hidden, scrolling, wake) {
        if (rigs == null || hidden) return@LaunchedEffect
        var last = 0L
        while (true) {
            val now = androidx.compose.runtime.withFrameNanos { it } / 1_000_000
            val active = busy(now)
            if (!active && (gestures.isNotEmpty() || taps.isNotEmpty())) { gestures.clear(); taps.clear() }
            if (!active && (!puppetsOn || calm || scrolling)) { clock.longValue = now; break }
            if (active || now - last >= 64) { clock.longValue = now; last = now } // idle: 15 fps (smooth over pretty)
        }
    }
    fun tapFigure(id: MascotId) {
        val now = System.nanoTime() / 1_000_000
        taps[id] = now
        if (puppetsOn && !calm && gestures[id]?.let { now - it < (rigs?.rigs?.get(id.key)?.gestureSeconds ?: 0.0) * 1000 } != true) gestures[id] = now
        com.wordocious.app.data.Haptics.light(view)
        com.wordocious.app.data.SoundManager.castLaugh(id.key)
        wake++
    }
    LaunchedEffect(calm, hidden, scrolling, flourishKey, puppetsOn) {
        acting = null
        if (calm || hidden || scrolling) return@LaunchedEffect
        if (puppetsOn) {
            // One signature move every 6–10 s, never the same character twice in a row.
            if (flourishKey > 0 && reportAnchor) delay(IntroFlourish.TOTAL_MS.toLong())
            delay(CastMoves.FIRST_DELAY_MS)
            val random = Random(System.nanoTime())
            var last: MascotId? = null
            while (true) {
                val now = System.nanoTime() / 1_000_000
                var playing = 0L
                if (!busy(now)) {
                    val id = MascotId.entries.filter { it != last }.random(random)
                    last = id
                    gestures[id] = now
                    playing = ((rigs?.rigs?.get(id.key)?.gestureSeconds ?: 0.0) * 1000).toLong()
                    wake++
                }
                // 6–10 s of rest after the move ends.
                delay(playing + 6000L + random.nextLong(4000L))
            }
        }
        val random = Random(System.nanoTime())
        // The personality moves resume after the flourish.
        if (flourishKey > 0 && reportAnchor) delay(IntroFlourish.TOTAL_MS.toLong())
        delay(CastMoves.FIRST_DELAY_MS)
        var last: MascotId? = null
        while (true) {
            val id = CastMoves.pickNext(last, random)
            last = id
            val move = CastMoves.moves.getValue(id)
            progress.snapTo(0f)
            acting = id
            progress.animateTo(1f, tween(move.durationMs, easing = LinearEasing))
            acting = null
            delay((CastMoves.nextGapMs(random) - move.durationMs).coerceAtLeast(400L))
        }
    }

    // X: Halloween (or the admin preview) dresses the row in costume.
    val season = rememberSeason()
    val painters = MascotId.entries.map { rememberCastPainter(it, season) }
    // F2 fix step 1: hidden (still laid out, still measured) while the intro's row is up.
    val hideForIntro = reportAnchor && ColdStart.hidingHeader
    // AA1: the crown's tap target (an invisible box over the crown) squishes the crown itself.
    val crownTap = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    var proSheet by remember { mutableStateOf(false) }
    if (proSheet) YoureProSheet(onDismiss = { proSheet = false })
    Layout(
        modifier = modifier
            .graphicsLayer { alpha = if (hideForIntro) 0f else 1f }
            .semantics { contentDescription = "Wordocious" }
            .then(
                if (reportAnchor) Modifier.onGloballyPositioned { CastHeaderAnchor.bounds = it.boundsInWindow() }
                else Modifier,
            ),
        content = {
            MascotId.entries.forEachIndexed { i, id ->
                val front = puppetsOn && (gestures.containsKey(id) || taps.containsKey(id))
                Box(
                    Modifier
                        .zIndex(if (front) 1f else 0f)
                        .clickable(
                            interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                            indication = null,
                        ) { tapFigure(id) }
                        .drawWithContent {
                        // In season: the costume's transform-only tap hop (squash + stretch, no face swap).
                        val b = rigs
                        val tapAt = taps[id]
                        if (!puppetsOn && b != null && tapAt != null && !still) {
                            val (hop, sq) = b.tap.pose((clock.longValue - tapAt) / 1000.0)
                            if (hop != 0.0 || sq != 0.0) {
                                val u = size.height / 470f
                                val canvas = drawContext.canvas
                                canvas.save()
                                canvas.translate(size.width / 2, size.height + (hop * 0.53 * u).toFloat())
                                canvas.scale((1 - sq * 0.6).toFloat(), (1 + sq).toFloat())
                                canvas.translate(-size.width / 2, -size.height)
                                drawContent()
                                canvas.restore()
                                return@drawWithContent
                            }
                        }
                        val who = acting
                        // The flourish: every character plays the W hop in a left-to-right wave.
                        val hop = if (wave.value >= 0f) IntroFlourish.local(i, wave.value) else null
                        if (who != id && hop == null) {
                            drawContent()
                            return@drawWithContent
                        }
                        val move = if (hop != null) CastMoves.moves.getValue(MascotId.W) else CastMoves.moves.getValue(id)
                        val xf = CastMoves.sample(move, hop ?: progress.value)
                        val w = size.width
                        val h = size.height
                        val px = w * move.originX
                        val py = h * move.originY
                        val canvas = drawContext.canvas
                        canvas.save()
                        canvas.translate(xf.tx * w + px, xf.ty * h + py)
                        if (xf.rot != 0f) canvas.rotate(xf.rot)
                        if (xf.sx != 1f || xf.sy != 1f) canvas.scale(xf.sx, xf.sy)
                        if (xf.skewX != 0f) canvas.skew(xf.skewX, 0f)
                        canvas.translate(-px, -py)
                        drawContent()
                        canvas.restore()
                    },
                ) {
                    val rig = rigs?.rigs?.get(id.key)
                    if (puppetsOn && rig != null) {
                        val crop = CastCrops.crops.getValue(id)
                        androidx.compose.foundation.layout.Spacer(
                            // Its own render layer: a clock tick re-records only this figure, not the page.
                            Modifier.fillMaxSize().graphicsLayer().drawBehind {
                                val b = rigs ?: return@drawBehind
                                val now = clock.longValue
                                val gr = gestures[id]?.let { (now - it) / 1000.0 }?.takeIf { it < rig.gestureSeconds }
                                val tp = taps[id]?.let { (now - it) / 1000.0 }?.takeIf { it < b.tap.dur }
                                with(CastPuppets) { drawPuppet(b, rig, crop, (now - t0) / 1000.0, gr, tp, calm) }
                            },
                        )
                    } else {
                        Image(painters[i], contentDescription = null, contentScale = ContentScale.FillBounds, modifier = Modifier.fillMaxSize())
                    }
                    if (crown && id == MascotId.W) {
                        CrownOnW(crownTap, twinkle = !calm && !hidden)
                    }
                }
            }
            // AA1 the crown's tap target, placed over the crown (after the ten figures).
            if (crown && live) {
                Box(
                    Modifier
                        .clickable(
                            interactionSource = crownTap, indication = null,
                            role = androidx.compose.ui.semantics.Role.Button,
                        ) { proSheet = true }
                        .semantics { contentDescription = "You're Pro: membership details" },
                )
            }
        },
    ) { measurables, constraints ->
        val width = if (constraints.hasBoundedWidth) constraints.maxWidth else (360.dp.roundToPx())
        val h = SeasonSkins.figureHeight(width.toFloat(), season)
        val lift = CastCrops.STAGGER * h
        val crownSpace = if (crown) h * CROWN_SPACE else 0f
        val total = (h + lift + crownSpace).roundToInt()
        val overlap = CastCrops.OVERLAP * width
        val placeables = measurables.take(MascotId.entries.size).mapIndexed { i, m ->
            val id = MascotId.entries[i]
            val w = (SeasonSkins.frame(id, season).crop.aspect * h).roundToInt().coerceAtLeast(1)
            m.measure(Constraints.fixed(w, h.roundToInt().coerceAtLeast(1)))
        }
        // AA1: the crown tap target covers W's headroom + the top of his head.
        val crownTarget = measurables.getOrNull(MascotId.entries.size)?.let { m ->
            val wW = placeables[MascotId.entries.indexOf(MascotId.W)].width
            m.measure(Constraints.fixed(wW, (crownSpace + h * 0.4f).roundToInt().coerceAtLeast(1)))
        }
        layout(width, total) {
            var x = 0f
            placeables.forEachIndexed { i, p ->
                val y = total - h - (if (i % 2 == 1) lift else 0f)
                p.place(x.roundToInt(), y.roundToInt())
                x += p.width - overlap
            }
            crownTarget?.place(0, 0)
        }
    }
}

/** The rig id of a cast member ("w", "o1", …). */
private val MascotId.key: String get() = name.lowercase()

/** How much headroom the Pro crown takes above the row (fraction of the figure height). */
private const val CROWN_SPACE = 0.32f

/**
 * AA1 the gold crown sprite (`art_badge_pro_crown_sprite`) sitting on W's head (~45% of
 * W's width), tilted -8°, riding W's moves (it is inside his transformed box, so it
 * bounces with the hop). A tiny sparkle twinkles every ~8 s ([twinkle]; never with
 * Reduce Motion); it squishes when its tap target ([tap]) is pressed.
 */
@Composable
private fun androidx.compose.foundation.layout.BoxScope.CrownOnW(
    tap: androidx.compose.foundation.interaction.InteractionSource,
    twinkle: Boolean,
) {
    androidx.compose.foundation.layout.BoxWithConstraints(Modifier.matchParentSize()) {
        val size = maxWidth * 0.45f
        ProCrownSprite(
            size,
            Modifier.align(Alignment.TopCenter).offset(x = -size * 0.04f, y = -size * 0.6f).pressSquish(tap, icon = true)
                // AP: after "Welcome to Pro" the crown drops onto W with a sparkle (ui/ProWelcome.kt).
                .proCrownDrop(),
            tilt = -8f, twinkle = twinkle,
        )
    }
}
