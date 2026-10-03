package com.wordocious.app.ui.game

import android.content.Context
import com.wordocious.app.ui.ArtBitmaps
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.Mascots
import com.wordocious.app.ui.MomentArt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

/**
 * FINISH_SPEC BJ2 (founder 10-03 on iOS 2.7 (241): "make the completion screens less
 * choppy … it all feels like it can use some fluidity"): the finish plays ONE big thing
 * at a time. The win / lose card springs in → its answer tiles flip → the points count
 * up → ONE gloss sweep → the host's idle bob; CONTINUE → the finished screen → the XP
 * toast → achievement / level-up popups. The reveal + finish hold (BI5) are untouched —
 * nothing is faster than before, only ordered. Same numbers as iOS `FinishMotion`
 * (PostGameEffects.swift) and web `FINISH_MOTION` (lib/finish-motion.ts).
 */
object FinishMotion {
    /** The finished strip's headline waits for the win card's exit. */
    const val AFTER_CARD_MS = 300L
    /** The XP toast rises this long after the win card has closed. */
    const val XP_AFTER_HOLD_MS = 450L
    /** Achievement / level-up popups this long after the win card has closed. */
    const val ACHIEVEMENTS_AFTER_HOLD_MS = 850L
    /** Win card internals, from its spring-in. */
    const val TILES_START_MS = 250
    const val COUNT_START_MS = 450L
    const val SWEEP_START_MS = 900L
    const val SPARKLE_START_MS = 1150L
    const val BOB_START_MS = 1200L

    /** The win card's moment lettering width (MomentTitle's default fraction). */
    private const val MOMENT_FRACTION = 0.7f

    /**
     * BJ2: the win / lose card's art — both moment letterings at their shown width and
     * every cast host at the card's 90 / 82 dp — decoded into [ArtBitmaps] off the main
     * thread when the game ends, so the card's first frame never decodes on main.
     */
    suspend fun prewarm(context: Context, density: Float, screenWidthDp: Int) = withContext(Dispatchers.IO) {
        val momentPx = ArtBitmaps.bucketPx((screenWidthDp * MOMENT_FRACTION * density).roundToInt().coerceAtLeast(1))
        listOf(MomentArt.VICTORY, MomentArt.SO_CLOSE).forEach { runCatching { ArtBitmaps.get(context, it.res, momentPx) } }
        val hostPx = ArtBitmaps.bucketPx((90f * density).roundToInt())
        MascotId.entries.forEach { runCatching { ArtBitmaps.get(context, it.res, hostPx) } }
        runCatching { ArtBitmaps.get(context, Mascots.loss.res, ArtBitmaps.bucketPx((82f * density).roundToInt())) }
        Unit
    }
}
