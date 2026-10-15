package com.wordocious.core

// FINISH_SPEC BJ4 (founder 10-03: "The podium only appears on classic right now"):
// every board — each game, Everyone and Friends, Sweep, Puzzles — stands its leaders
// on the podium as soon as ONE result is in. The podium takes the leading rows ranked
// within the top three (ties share a step: 1, 1, 3), at most three; the places still
// free show as open spots (a dimmed step with a sleepy cast member and
// "Open spot · Claim #N"). Rows after the podium list below it.
// 1:1 port of packages/core/src/podium-layout.ts; pinned by podium-layout-fixtures.json.

const val PODIUM_SIZE = 3

data class PodiumLayout(
    /** How many leading rows stand on the podium (0 = no podium: an empty board). */
    val filled: Int,
    /** The places (2, 3) still free — drawn as open spots. Empty when the podium is full. */
    val open: List<Int>,
)

/** The open spot's two lines (parity copy). */
data class PodiumOpenSpot(val title: String, val line: String)

/** Splits a board by its competition ranks (score desc order) into podium + open spots. */
fun podiumLayout(ranks: List<Int>, size: Int = PODIUM_SIZE): PodiumLayout {
    var filled = 0
    while (filled < ranks.size && filled < size && ranks[filled] <= size) filled++
    if (filled == 0) return PodiumLayout(0, emptyList())
    return PodiumLayout(filled, (filled until size).map { it + 1 })
}

/** The open spot's two lines (parity copy). */
fun podiumOpenSpot(place: Int): PodiumOpenSpot = PodiumOpenSpot("Open spot", "Claim #$place")

// 2.8 one-image podium (founder 10-15): ONE stadium image (1536x1024) replaces the three podium blocks and the
// per-player stat cards. Every renderer lays the image across the podium area (height = width / aspect), stands
// each mascot with its feet on the step-top center and prints the stats INSIDE the blank panel under each step's
// number. All numbers are fractions of the image (x of width, y of height). 1:1 port of PODIUM_ART in
// packages/core/src/podium-layout.ts, pinned by the "art" block of podium-layout-fixtures.json.

data class PodiumArtPanel(val x0: Double, val x1: Double, val y0: Double, val y1: Double)

data class PodiumArtStep(val place: Int, val feetX: Double, val feetY: Double, val panel: PodiumArtPanel)

object PodiumArtGeometry {
    /** Image width / height (1536 x 1024). */
    const val ASPECT = 1.5
    /** Tablets: the stage never grows past this many points wide (phones are narrower, so unchanged). */
    const val MAX_WIDTH_PT = 680.0
    /** Mascot lands this many points lower than the step-top center so it looks planted. */
    const val PLANT_PT = 5.0
    /** The name label's BOTTOM sits this many points above the DRAWN head / hat top (never tucked into the box). */
    const val NAME_GAP_PT = 12.0
    /** Where the drawn head / hat top is, as a fraction of the mascot box from the box's top edge (small end: tall hats). */
    const val HEAD_TOP = 0.04
    /** The first place's crown rises this fraction of the mascot box above the box's top. */
    const val CROWN_RISE = 0.05
    /** Extra points the first place's name clears the crown by (name bottom to crown top). */
    const val CROWN_GAP_PT = 10.0
    /** Contact shadow ellipse width as a fraction of the mascot width. */
    const val SHADOW_WIDTH = 0.9
    /** Panel text: the score line and the two detail lines, as fractions of the panel height. */
    const val SCORE_HEIGHT = 0.29
    const val DETAIL_HEIGHT = 0.19
    /** Dark purple on all three light satin panels: rgb(70, 30, 100). */
    val TEXT_RGB = intArrayOf(70, 30, 100)
    /** Left-to-right on screen: silver (2), gold (1), bronze (3). */
    val STEPS: List<PodiumArtStep> = listOf(
        PodiumArtStep(2, 0.220, 0.435, PodiumArtPanel(0.103, 0.335, 0.605, 0.810)),
        PodiumArtStep(1, 0.500, 0.366, PodiumArtPanel(0.383, 0.620, 0.581, 0.799)),
        PodiumArtStep(3, 0.783, 0.455, PodiumArtPanel(0.667, 0.902, 0.615, 0.810)),
    )
    /** Screen order (left to right) of the places on the podium art: 2, 1, 3. */
    val ORDER: List<Int> = listOf(2, 1, 3)

    /** The art step for a place (1..3). */
    fun step(place: Int): PodiumArtStep = STEPS.first { it.place == place }
}

/**
 * 2.8 winner intro (founder 10-15): ONE calm load-in for the #1 mascot, every season (no candy corn / confetti). Port of
 * PODIUM_WINNER_INTRO in packages/core/src/podium-layout.ts, pinned by the "winnerIntro" block of podium-layout-fixtures.json.
 */
object PodiumWinnerIntro {
    /** Soft gold radial glow behind the mascot: fades + scales in once, then rests at low opacity. */
    const val GLOW_SIZE = 1.5
    val GLOW_RGB = intArrayOf(255, 200, 61)
    const val GLOW_FROM_SCALE = 0.85
    const val GLOW_TO_SCALE = 1.0
    const val GLOW_DURATION_MS = 600
    /** Cubic-bezier ease-out. */
    val GLOW_EASE = floatArrayOf(0f, 0f, 0.58f, 1f)
    const val GLOW_REST_OPACITY = 0.5
    /** Sparkle offsets: fractions of the mascot box from its center (x right, y down). */
    val SPARKLE_OFFSETS: List<Pair<Double, Double>> = listOf(-0.42 to -0.06, 0.4 to 0.02, -0.24 to -0.34, 0.26 to -0.38)
    const val SPARKLE_SIZE = 0.07
    const val SPARKLE_DURATION_MS = 1200
    const val SPARKLE_DELAY_MS = 300
    const val SPARKLE_STAGGER_MS = 180
    const val SPARKLE_DRIFT_PT = 8.0
    const val SPARKLE_PEAK_OPACITY = 0.95
    val SPARKLE_RGB = intArrayOf(255, 236, 170)
    /** The crown drops in gently with a tiny settle. */
    const val CROWN_DELAY_MS = 200
    const val CROWN_DURATION_MS = 250
    const val CROWN_DROP_PT = 10.0
    const val CROWN_SETTLE_PT = 1.5
}
