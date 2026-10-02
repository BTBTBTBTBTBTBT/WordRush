package com.wordocious.app.ui

import com.wordocious.core.BannerTier
import com.wordocious.core.DayStreaks
import com.wordocious.core.GroupProgress
import com.wordocious.core.groupStreak
import com.wordocious.core.groupTier

// FINISH_SPEC Z (founder 10-02: "toggling from daily to unlimited … keep the boards
// stationary, I don't want them to shift at all"). The Home banner is the only place
// on Android with the DAILY | UNLIMITED switch, and its tile rows are the "boards".
// Everything above them lives in slots that exist in BOTH modes: the scene band, the
// headline (both modes' headlines are laid out on top of each other, the hidden one
// invisible, so the slot is the taller of the two), the share slot (kept empty when
// there is nothing to share), the clock line (layered the same way), the switch
// (fixed-width segments, only the thumb slides) and each row's streak flame (kept,
// invisible, in Unlimited). This file is the pure model of those slots; it never
// reads the mode, and BannerSlotsTest pins that both modes produce the same layout
// inputs.

/** Fixed slot sizes (dp) shared by both modes. */
internal object BannerSlotSpec {
    /** The share control's square slot at the headline's end (kept even when empty). */
    const val SHARE = 36f
    /** The switch's segment height; the track adds [SWITCH_PAD] all round. */
    const val SWITCH_SEGMENT_H = 26f
    const val SWITCH_PAD = 2f
    /** Horizontal padding inside each switch segment, around its label. */
    const val SWITCH_LABEL_PAD = 10f
    /** The scene band: a 10 dp top bar, then art at 62% of the width, at most 140 dp, + 8 dp padding. */
    const val SCENE_BAR = 10f
    const val SCENE_ART_MAX = 140f
    const val SCENE_ART_FRACTION = 0.62f
    const val SCENE_PAD = 8f
}

/** The banner's mode-independent layout inputs. */
internal data class BannerSlots(
    /** Which scene band sits above the headline (NONE = no band). Decided by TODAY'S dailies. */
    val sceneBand: BannerTier,
    /** The W host peeks over the card only when there is no band (A7). */
    val hostShown: Boolean,
    /** Right padding the headline row keeps so the host never covers it. */
    val headlineEndClear: Float,
    /** The share slot (always reserved). */
    val shareSlot: Float,
    /** The switch's track height (always reserved). */
    val switchHeight: Float,
    /** Whether each row reserves a streak-flame slot in its label line (Wordocious, Puzzles). */
    val wordFlameSlot: Boolean,
    val puzzlesFlameSlot: Boolean,
)

/**
 * Z the banner's slots for today's progress. [unlimited] is accepted only so callers
 * can pass what they have — the slots never depend on it (that is the whole rule).
 */
@Suppress("UNUSED_PARAMETER")
internal fun bannerSlots(
    word: GroupProgress,
    puzzles: GroupProgress,
    wordStreaks: DayStreaks,
    puzzleStreaks: DayStreaks,
    unlimited: Boolean,
): BannerSlots {
    val wTier = groupTier(word)
    val pTier = groupTier(puzzles)
    val band = bannerArtTier(wTier, pTier, unlimited = false)
    return BannerSlots(
        sceneBand = band,
        hostShown = band == BannerTier.NONE,
        headlineEndClear = if (band == BannerTier.NONE) BANNER_HOST_CLEAR.value else 0f,
        shareSlot = BannerSlotSpec.SHARE,
        switchHeight = BannerSlotSpec.SWITCH_SEGMENT_H + BannerSlotSpec.SWITCH_PAD * 2,
        wordFlameSlot = groupStreak(wTier, wordStreaks) > 0,
        puzzlesFlameSlot = groupStreak(pTier, puzzleStreaks) > 0,
    )
}

/** Z the scene band's height (dp) for a banner [width] dp wide (0 when there is no band). */
internal fun sceneBandHeight(band: BannerTier, width: Float): Float =
    if (band == BannerTier.NONE) 0f
    else BannerSlotSpec.SCENE_BAR + BannerSlotSpec.SCENE_PAD +
        (width * BannerSlotSpec.SCENE_ART_FRACTION).coerceAtMost(BannerSlotSpec.SCENE_ART_MAX)

/** Z the switch geometry: fixed segment widths from the two labels' measured widths. */
internal data class SwitchGeometry(val dailyWidth: Float, val unlimitedWidth: Float) {
    /** The whole track's width — the same whichever segment is selected. */
    val trackWidth: Float get() = dailyWidth + unlimitedWidth + BannerSlotSpec.SWITCH_PAD * 2

    /** The sliding thumb's (x offset inside the padding, width) for the selected segment. */
    fun thumb(unlimited: Boolean): Pair<Float, Float> =
        if (unlimited) dailyWidth to unlimitedWidth else 0f to dailyWidth
}

/**
 * Z segment widths from the labels' text widths (measured once, in the SAME weight
 * for both states — only the thumb and the ink change on selection).
 */
internal fun switchGeometry(dailyLabelWidth: Float, unlimitedLabelWidth: Float): SwitchGeometry =
    SwitchGeometry(
        dailyLabelWidth + BannerSlotSpec.SWITCH_LABEL_PAD * 2,
        unlimitedLabelWidth + BannerSlotSpec.SWITCH_LABEL_PAD * 2,
    )
