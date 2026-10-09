package com.wordocious.core

import kotlin.math.floor

// 2.8 item 6: the bubble-lettering renderer's PURE half — a 1:1 port of
// packages/core/src/bubble-text.ts, pinned by bubble-text-fixtures.json. One line when it fits
// (the size scales UP to fill the slot, capped at maxSize), else a BALANCED 2-3 line wrap, else
// a hard character split; never an ellipsis, never a clip.

/** The glyphs the atlas draws (uppercase; anything else falls back to the live font). */
const val BUBBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789★!?,'·-&.:+%"

/** The glyph art is in the app (drawable `bubble_<stem>`, scripts/build-bubble-atlas.py). */
const val BUBBLE_ATLAS_READY = true
/** The lettering's cap height in em of the font size. */
const val BUBBLE_CAP_EM = 0.82
const val BUBBLE_MAX_SIZE = 38
const val BUBBLE_MIN_SIZE = 26
private const val BUBBLE_FLOOR_SIZE = 8
private const val BUBBLE_FALLBACK_EM = 1.128

private val BUBBLE_EXTRA_ADVANCE_EM: Map<String, Double> = mapOf("★" to 0.9, "&" to 0.78, "’" to 0.269, "+" to 0.6, "%" to 0.964)

private val BUBBLE_GLYPH_STEMS: Map<String, String> = mapOf(
    "★" to "star", "!" to "excl", "?" to "quest", "," to "comma", "'" to "apos", "’" to "apos",
    "·" to "dot", "-" to "hyphen", "&" to "amp", "." to "period", ":" to "colon", "+" to "plus", "%" to "percent",
)

/** The asset stem for a character ("a".."z", "0".."9", "star", "excl", "quest", "hyphen"…), or null when the atlas has no glyph. */
fun bubbleGlyphName(ch: String): String? {
    val up = ch.uppercase()
    if (up.codePointCount(0, up.length) != 1) return null
    val stem = BUBBLE_GLYPH_STEMS[up] ?: if (up.length == 1 && (up[0] in 'A'..'Z' || up[0] in '0'..'9')) up.lowercase() else null
    return if (stem != null && BubbleAtlasMetrics.glyphs.containsKey(stem)) stem else null
}

/** True when the atlas is ready and every non-space character of [text] has a glyph. */
fun bubbleAtlasCovers(text: String): Boolean {
    if (!BUBBLE_ATLAS_READY) return false
    for (c in text.codePointStrings()) if (c != " " && bubbleGlyphName(c) == null) return false
    return true
}

private fun String.codePointStrings(): List<String> {
    val out = ArrayList<String>(length)
    var i = 0
    while (i < length) {
        val cp = codePointAt(i)
        val n = Character.charCount(cp)
        out.add(substring(i, i + n))
        i += n
    }
    return out
}

/** One placed glyph, in cap-height units from the line box's top-left (ci = the character's index in the text). */
class BubblePlace(val stem: String, val ci: Int, val x: Double, val y: Double, val w: Double, val h: Double)

/** The composed line: placed glyphs, the line width and the shared ascent / descent, all in cap-height units. */
class BubbleAtlasLayout(val places: List<BubblePlace>, val width: Double, val asc: Double, val desc: Double)

private fun r4(v: Double): Double = floor(v * 10000 + 0.5) / 10000

/** Compose [text] from the atlas like the reference renderer (see core bubbleAtlasLayout). */
fun bubbleAtlasLayout(text: String): BubbleAtlasLayout {
    val places = ArrayList<BubblePlace>()
    var x = 0.0
    var ci = -1
    for (ch in text.codePointStrings()) {
        ci += 1
        if (ch == " ") { x += BubbleAtlasMetrics.SPACE; continue }
        val stem = bubbleGlyphName(ch) ?: continue
        val m = BubbleAtlasMetrics.glyphs[stem] ?: continue
        val top = if (m.a == 0 || m.a == 1) -m.b else if (m.a == 2) -1.0 else -0.5 - m.h / 2
        places.add(BubblePlace(stem, ci, r4(x), r4(top + BubbleAtlasMetrics.ASC), m.w, m.h))
        x += m.w + BubbleAtlasMetrics.GAP
    }
    val width = if (places.isEmpty()) x else x - BubbleAtlasMetrics.GAP
    return BubbleAtlasLayout(places, r4(width), BubbleAtlasMetrics.ASC, BubbleAtlasMetrics.DESC)
}

/** The live headline font's width of [text] in em: advances + tracking + the 0.24 em outline / edge. */
private fun liveWidthEm(text: String): Double {
    var w = 0.0
    for (ch in text.uppercase().codePointStrings()) {
        w += (BUBBLE_EXTRA_ADVANCE_EM[ch] ?: HEADLINE_ADVANCE_EM[ch] ?: BUBBLE_FALLBACK_EM) + HEADLINE_TRACKING_EM
    }
    return floor((w + HEADLINE_EDGE_EM) * 1000 + 0.5) / 1000
}

/**
 * The lettering width of [text] in em: the WIDER of the live font's and the atlas's when the atlas covers the text
 * (so a fit never clips whichever the `bubble_atlas` switch draws), else the live font's.
 */
fun bubbleWidthEm(text: String): Double {
    val live = liveWidthEm(text)
    if (!bubbleAtlasCovers(text)) return live
    val atlas = floor((bubbleAtlasLayout(text).width * BUBBLE_CAP_EM + 0.06) * 1000 + 0.5) / 1000
    return maxOf(live, atlas)
}

private fun milli(text: String): Int = floor(bubbleWidthEm(text) * 1000 + 0.5).toInt()

/** One fitted headline: the lines, the shared lettering size, and (Home only) which lines carry the name. */
data class BubbleFit(val lines: List<String>, val size: Int, val wrapped: Boolean, val nameLines: List<Int> = emptyList())

private fun sizeFor(slot: Double, widest: Int, maxSize: Int): Int {
    if (widest <= 0) return maxSize
    return maxOf(BUBBLE_FLOOR_SIZE, minOf(maxSize, floor(slot * 1000 / widest).toInt()))
}

private fun balancedSplit(words: List<String>, n: Int): List<String>? {
    val m = words.size
    if (n < 1 || m < n) return null
    val w = Array(m) { IntArray(m) }
    for (i in 0 until m) for (j in i until m) w[i][j] = milli(words.subList(i, j + 1).joinToString(" "))
    val inf = Int.MAX_VALUE / 4
    // best[k][j] = (widest, sumSquares, cut) for the first j words in k lines.
    val bw = Array(n + 1) { IntArray(m + 1) { inf } }
    val bs = Array(n + 1) { LongArray(m + 1) { Long.MAX_VALUE / 4 } }
    val bc = Array(n + 1) { IntArray(m + 1) { -1 } }
    bw[0][0] = 0; bs[0][0] = 0
    for (k in 1..n) {
        if (k > m) break
        for (j in k..m) {
            for (c in (k - 1) until j) {
                if (bw[k - 1][c] == inf) continue
                val last = w[c][j - 1]
                val widest = maxOf(bw[k - 1][c], last)
                val sq = bs[k - 1][c] + last.toLong() * last
                if (widest < bw[k][j] || (widest == bw[k][j] && sq < bs[k][j])) { bw[k][j] = widest; bs[k][j] = sq; bc[k][j] = c }
            }
        }
    }
    val out = ArrayList<String>()
    var j = m
    for (k in n downTo 1) {
        val c = bc[k][j]
        out.add(0, words.subList(c, j).joinToString(" "))
        j = c
    }
    return out
}

private fun bubbleHardSplit(text: String, maxMilli: Int): List<String> {
    val out = ArrayList<String>()
    var cur = ""
    for (ch in text.codePointStrings()) {
        if (cur.isNotEmpty() && milli(cur + ch) > maxMilli) { out.add(cur); cur = ch } else cur += ch
    }
    if (cur.isNotEmpty()) out.add(cur)
    return out
}

/** The fit for [text] in a slot [slotWidth] wide (see packages/core/src/bubble-text.ts for the rule). */
fun bubbleFit(
    text: String,
    slotWidth: Double,
    maxSize: Int = BUBBLE_MAX_SIZE,
    minSize: Int = BUBBLE_MIN_SIZE,
    maxLines: Int = 3,
): BubbleFit {
    val minS = minOf(minSize, maxSize)
    val maxN = maxOf(2, maxLines)
    val t = text.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.joinToString(" ")
    if (t.isEmpty() || !(slotWidth > 0)) return BubbleFit(listOf(t), maxSize, false)

    val one = sizeFor(slotWidth, milli(t), maxSize)
    if (one >= minS) return BubbleFit(listOf(t), one, false)

    val words = t.split(' ')
    var last: BubbleFit? = null
    for (n in 2..maxN) {
        val lines = balancedSplit(words, n) ?: break
        val size = sizeFor(slotWidth, lines.maxOf { milli(it) }, maxSize)
        last = BubbleFit(lines, size, true)
        if (size >= minS) return last
    }
    val longestWord = words.maxOf { milli(it) }
    if (longestWord.toDouble() * minS > slotWidth * 1000) {
        val maxMilli = floor(slotWidth * 1000 / minS).toInt()
        val lines = ArrayList<String>()
        for (w in words) {
            if (milli(w) <= maxMilli) lines.add(w) else lines.addAll(bubbleHardSplit(w, maxMilli))
        }
        val packed = ArrayList<String>()
        for (l in lines) {
            val tail = packed.lastOrNull()
            if (tail != null && milli("$tail $l") <= maxMilli) packed[packed.size - 1] = "$tail $l" else packed.add(l)
        }
        val size = sizeFor(slotWidth, packed.maxOf { milli(it) }, maxSize)
        return BubbleFit(packed, size, packed.size > 1)
    }
    return last ?: BubbleFit(listOf(t), one, false)
}

/**
 * The Home headline: the player's name keeps its stacked hero lines, every other headline goes
 * through [bubbleFit] so long ones wrap instead of truncating; size is capped at the device's full size.
 */
fun homeHeadlineFit(text: String, name: String, slotWidth: Double): BubbleFit {
    val size = headlineFontSize(slotWidth)
    val maxEm = slotWidth / size
    val layout = headlineLayout(text, name, maxEm)
    if (layout.lines.size > 1 || headlineWidthEm(text) <= maxEm) {
        // The atlas can be wider than the live font on some strings (many I's): shrink only then, never clip.
        val widest = layout.lines.maxOf { bubbleWidthEm(it) }
        val fitted = if (widest * size > slotWidth) maxOf(12, floor(slotWidth / widest).toInt()) else size
        return BubbleFit(layout.lines, fitted, layout.lines.size > 1, layout.nameLines)
    }
    return bubbleFit(text, slotWidth, maxSize = size, minSize = floor(size * 0.72 + 0.5).toInt())
}
