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
