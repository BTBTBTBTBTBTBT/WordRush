package com.wordocious.app.ui

import android.content.Context
import android.graphics.BitmapFactory
import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp

// FINISH_SPEC AQ2: menus + scrolling smoothness. Two shared tools:
//  1. a "the page is scrolling" signal, so ambient loops (bobbing, pulses, rays, shimmer)
//     hold still while a list moves, and
//  2. a process-wide cache of art decoded at its DISPLAY size, so a 900–1200 px scene or
//     game icon shown at 30–60 dp is never decoded full size again for every list row.

/**
 * AS3 (founder 10-02: "Home can't scroll to the very bottom"): every tab page's scroll
 * content ends this far above the docked tab bar (the Scaffold already reserves the bar +
 * the system nav inset; this is the breathing room + the bar's squish overhang).
 */
val TAB_CONTENT_BOTTOM_PAD: Dp = 32.dp

/**
 * True while the tab's content is being dragged or flung. Provided per tab by MainScreen
 * (one [ScrollActivity] on the tab's root catches every nested list's scroll).
 */
val LocalScrollActive = staticCompositionLocalOf<State<Boolean>> { mutableStateOf(false) }

/**
 * AQ2 watches every scroll under it through nested scrolling: active from the first
 * consumed scroll delta until the drag's fling (zero-velocity flings included) settles.
 */
class ScrollActivity : NestedScrollConnection {
    val active = mutableStateOf(false)

    override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
        if (consumed != Offset.Zero && !active.value) active.value = true
        return Offset.Zero
    }

    override suspend fun onPostFling(consumed: Velocity, available: Velocity): Velocity {
        if (active.value) active.value = false
        return Velocity.Zero
    }
}

/**
 * AQ2 should ambient (looping, decorative) motion hold still right now? While the tab is
 * hidden or its content is scrolling. Read it in composition; it flips twice per gesture.
 */
@Composable
fun ambientMotionPaused(): Boolean = LocalTabHidden.current.value || LocalScrollActive.current.value

/**
 * AQ2 the display-size art cache. Raster art (the nodpi webp/png set) decodes with an
 * inSampleSize that keeps it at least as big as its on-screen size (bucketed so nearby
 * sizes share one bitmap), bounded by bytes. Vector / non-bitmap drawables report null
 * and the caller falls back to painterResource.
 */
object ArtBitmaps {
    private const val NOT_BITMAP = -1L
    private val cache = object : android.util.LruCache<Long, ImageBitmap>(32 * 1024 * 1024) {
        override fun sizeOf(key: Long, value: ImageBitmap): Int = value.width * value.height * 4
    }
    private val notBitmaps = HashSet<Int>()

    /** Display px → the cache bucket (the next step up of 48·1.5ⁿ px), so 40 dp and 44 dp share a bitmap. */
    fun bucketPx(px: Int): Int {
        var b = 48
        while (b < px) b = (b * 3) / 2
        return b
    }

    /** The largest power-of-two sample that keeps [srcW]×[srcH] at least [targetPx] on its longer side. */
    fun sampleSizeFor(srcW: Int, srcH: Int, targetPx: Int): Int {
        val longer = maxOf(srcW, srcH)
        if (longer <= 0 || targetPx <= 0) return 1
        var sample = 1
        while (longer / (sample * 2) >= targetPx) sample *= 2
        return sample
    }

    // Not @Synchronized (perf, 2026-10-02): a background prewarm decoding a big pose must
    // never make a main-thread cache hit wait on the lock. LruCache is thread-safe on its
    // own; two threads missing the same key at once just decode it twice (same pixels).
    fun get(context: Context, @DrawableRes res: Int, targetPx: Int): ImageBitmap? {
        if (synchronized(notBitmaps) { res in notBitmaps }) return null
        val key = (res.toLong() shl 20) or targetPx.toLong()
        cache.get(key)?.let { return it }
        val bmp = runCatching {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true; inScaled = false }
            BitmapFactory.decodeResource(context.resources, res, bounds)
            if (bounds.outWidth <= 0) return@runCatching null
            BitmapFactory.decodeResource(
                context.resources, res,
                BitmapFactory.Options().apply { inScaled = false; inSampleSize = sampleSizeFor(bounds.outWidth, bounds.outHeight, targetPx) },
            )
        }.getOrNull()
        if (bmp == null) { synchronized(notBitmaps) { notBitmaps.add(res) }; return null }
        return bmp.asImageBitmap().also { cache.put(key, it) }
    }

    fun clear() { cache.evictAll() }
}

/**
 * AQ2 painterResource for art shown at [displaySize] (its longer side): decoded once per
 * size bucket and shared by every row that shows it. Vector drawables pass through.
 */
@Composable
fun artPainter(@DrawableRes res: Int, displaySize: Dp): Painter {
    val context = LocalContext.current
    val px = with(LocalDensity.current) { displaySize.roundToPx() }.coerceAtLeast(1)
    val bucket = ArtBitmaps.bucketPx(px)
    val bitmap = remember(res, bucket) { ArtBitmaps.get(context, res, bucket) }
    return if (bitmap != null) remember(bitmap) { BitmapPainter(bitmap) } else painterResource(res)
}

/**
 * AZ (founder 10-02: "make it run as smooth as possible") the ONE spring family every popup,
 * card and sheet springs in with (≈ response 0.38 s, damping 0.82), and the matching quick
 * exit. Animate transforms + opacity only (graphicsLayer), never size / padding / blur.
 */
object Motion {
    const val DAMPING = 0.82f
    const val STIFFNESS = 380f
    /** The exit: a short fade + settle (never an instant pop out). */
    const val EXIT_MS = 170
    /** The confetti ceiling (particles per burst). */
    const val CONFETTI_MAX = 48

    fun <T> springIn(): androidx.compose.animation.core.SpringSpec<T> =
        androidx.compose.animation.core.spring(dampingRatio = DAMPING, stiffness = STIFFNESS)

    fun <T> exit(): androidx.compose.animation.core.TweenSpec<T> =
        androidx.compose.animation.core.tween(EXIT_MS, easing = androidx.compose.animation.core.FastOutLinearInEasing)
}
