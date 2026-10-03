package com.wordocious.core

import kotlin.math.floor

// FINISH_SPEC BJ6 (founder 10-03: "make sure we have a clever way to populate longer usernames
// without shrinking anything down or scrolling off screen"): the Home greeting's line layout,
// decided identically on every platform. 1:1 port of the bottom of
// packages/core/src/headline-tokens.ts; pinned by headline-tokens-fixtures.json
// (sizingLine / widths / sizes / layouts). Widths are in em of the brand lettering (Nunito
// Black, wght 900 advances), plus 1% tracking per character and the 0.24 em outline / 3D edge.
//   1. the whole headline fits maxEm → one line;
//   2. else a headline with the player's name stacks: the words before the name, then the NAME
//      + its "!" / "?" (the gold hero line), all at the full designed size;
//   3. a name that still doesn't fit breaks at a natural boundary (space, _ . -, a letter↔digit
//      run, camelCase), then by characters — never shrunk, truncated or clipped.

/** Nunito Black (wght 900) advance widths in em, for the lettering's characters. */
val HEADLINE_ADVANCE_EM: Map<String, Double> = mapOf(
    "A" to 0.763, "B" to 0.702, "C" to 0.688, "D" to 0.786, "E" to 0.614, "F" to 0.579, "G" to 0.747, "H" to 0.786,
    "I" to 0.312, "J" to 0.39, "K" to 0.712, "L" to 0.585, "M" to 0.884, "N" to 0.758, "O" to 0.807, "P" to 0.676,
    "Q" to 0.807, "R" to 0.706, "S" to 0.651, "T" to 0.644, "U" to 0.748, "V" to 0.742, "W" to 1.128, "X" to 0.698,
    "Y" to 0.645, "Z" to 0.625,
    "0" to 0.6, "1" to 0.6, "2" to 0.6, "3" to 0.6, "4" to 0.6, "5" to 0.6, "6" to 0.6, "7" to 0.6, "8" to 0.6, "9" to 0.6,
    " " to 0.286, "," to 0.272, "." to 0.272, "!" to 0.272, "?" to 0.478, "_" to 0.5, "-" to 0.445, "'" to 0.269,
    "#" to 0.6, ":" to 0.272, "/" to 0.349, "%" to 0.964, "+" to 0.6, "·" to 0.272,
)

/** Unknown characters count as the widest letter (never under-measure). */
private const val ADVANCE_FALLBACK_EM = 1.128

/** Tracking per character and the outline / 3D edge on both ends. */
const val HEADLINE_TRACKING_EM = 0.01
const val HEADLINE_EDGE_EM = 0.24

/** The largest designed lettering size (pt / dp / px). */
const val HEADLINE_MAX_SIZE = 38

/** The longest fixed greeting line: it sets the device's full size. */
const val HEADLINE_SIZING_LINE = "GOOD AFTERNOON,"

/** The string's code points as strings (JS `for (const ch of s)`). */
private fun codePointStrings(s: String): List<String> {
    val out = ArrayList<String>(s.length)
    var i = 0
    while (i < s.length) {
        val cp = s.codePointAt(i)
        val n = Character.charCount(cp)
        out.add(s.substring(i, i + n))
        i += n
    }
    return out
}

/** JS Math.round (halves toward +∞). */
private fun jsRound(x: Double): Double = floor(x + 0.5)

/** The lettering width of [text] (uppercased) in em, rounded to 3 decimals. */
fun headlineWidthEm(text: String): Double {
    val up = text.uppercase()
    var w = 0.0
    for (ch in codePointStrings(up)) w += (HEADLINE_ADVANCE_EM[ch] ?: ADVANCE_FALLBACK_EM) + HEADLINE_TRACKING_EM
    return jsRound((w + HEADLINE_EDGE_EM) * 1000) / 1000
}

/** The device's full lettering size: the longest fixed greeting line fits [availableWidth], capped at [max]. */
fun headlineFontSize(availableWidth: Double, max: Int = HEADLINE_MAX_SIZE): Int {
    if (!(availableWidth > 0)) return max
    return maxOf(12, minOf(max, floor(availableWidth / headlineWidthEm(HEADLINE_SIZING_LINE)).toInt()))
}

private fun wrapWords(text: String, maxEm: Double): List<String> {
    val words = text.split(' ').filter { it.isNotEmpty() }
    val out = ArrayList<String>()
    var cur = ""
    for (w in words) {
        val next = if (cur.isNotEmpty()) "$cur $w" else w
        if (cur.isNotEmpty() && headlineWidthEm(next) > maxEm) { out.add(cur); cur = w } else cur = next
    }
    if (cur.isNotEmpty()) out.add(cur)
    return out
}

private fun charKind(c: Char): Char = when (c) {
    in '0'..'9' -> 'd'
    in 'A'..'Z', in 'a'..'z' -> 'a'
    else -> 's'
}

/** The name's natural pieces (a new piece starts after a separator, at a letter↔digit change, at camelCase). */
private fun nameSegments(name: String): MutableList<String> {
    val segs = ArrayList<String>()
    var cur = ""
    for (i in name.indices) {
        val c = name[i]
        val boundary = cur.isNotEmpty() && i > 0 && run {
            val prev = name[i - 1]
            charKind(prev) == 's' ||
                (charKind(prev) != 's' && charKind(c) != 's' && charKind(prev) != charKind(c)) ||
                (prev in 'a'..'z' && c in 'A'..'Z')
        }
        if (boundary) { segs.add(cur); cur = "" }
        cur += c
    }
    if (cur.isNotEmpty()) segs.add(cur)
    return segs
}

private fun hardSplit(piece: String, maxEm: Double): List<String> {
    val out = ArrayList<String>()
    var cur = ""
    for (ch in codePointStrings(piece)) {
        if (cur.isNotEmpty() && headlineWidthEm(cur + ch) > maxEm) { out.add(cur); cur = ch } else cur += ch
    }
    if (cur.isNotEmpty()) out.add(cur)
    return out
}

/** JS String.prototype.trim (whitespace at both ends). */
private fun jsTrim(s: String): String = s.trim { it.isWhitespace() || it == '﻿' }

/** The name (+ trailing punctuation) as full-size lines no wider than [maxEm]. */
private fun nameLines(name: String, suffix: String, maxEm: Double): List<String> {
    val whole = name.uppercase() + suffix
    if (headlineWidthEm(whole) <= maxEm) return listOf(whole)
    // The punctuation rides with the last piece, so it never lands on a line of its own.
    val pieces = nameSegments(name).map { it.uppercase() }.toMutableList()
    pieces[pieces.size - 1] = pieces[pieces.size - 1] + suffix
    val out = ArrayList<String>()
    var cur = ""
    for (p in pieces) {
        val next = cur + p
        if (headlineWidthEm(jsTrim(next)) <= maxEm) { cur = next; continue }
        if (jsTrim(cur).isNotEmpty()) out.add(jsTrim(cur))
        if (headlineWidthEm(jsTrim(p)) <= maxEm) cur = p
        else {
            val parts = hardSplit(jsTrim(p), maxEm)
            out.addAll(parts.dropLast(1))
            cur = parts.lastOrNull() ?: ""
        }
    }
    if (jsTrim(cur).isNotEmpty()) out.add(jsTrim(cur))
    return out
}

/** A headline's lines (top to bottom; one when it fits) and which lines carry the name (gold hero lines). */
data class HeadlineLayout(val lines: List<String>, val nameLines: List<Int>)

private fun isNameNeighbor(c: Char?): Boolean = c != null && (c in 'A'..'Z' || c in '0'..'9' || c == '_')

private val PUNCT_ONLY = Regex("^[!?.,]*$")

/**
 * BJ6: lay out a Home headline for [maxEm] (the available width ÷ the font size). [name] is the
 * player's username as stored (its spelling decides camelCase breaks).
 */
fun headlineLayout(text: String, name: String, maxEm: Double): HeadlineLayout {
    if (headlineWidthEm(text) <= maxEm) return HeadlineLayout(listOf(text), emptyList())
    val n = jsTrim(name)
    if (n.isEmpty()) return HeadlineLayout(listOf(text), emptyList())
    val up = text.uppercase()
    val nUp = n.uppercase()
    var idx = -1
    var i = up.indexOf(nUp)
    while (i >= 0) {
        val before = if (i > 0) up[i - 1] else null
        val after = up.getOrNull(i + nUp.length)
        if (!isNameNeighbor(before) && !isNameNeighbor(after)) { idx = i; break }
        i = up.indexOf(nUp, i + 1)
    }
    if (idx < 0) return HeadlineLayout(listOf(text), emptyList())
    val before = jsTrim(text.substring(0, idx))
    val after = if (idx + n.length <= text.length) text.substring(idx + n.length) else ""
    val punct = if (PUNCT_ONLY.matches(after)) after else ""
    val lines = ArrayList<String>()
    if (before.isNotEmpty()) lines.addAll(wrapWords(before, maxEm))
    val first = lines.size
    lines.addAll(nameLines(n, punct, maxEm))
    val named = (first until lines.size).toList()
    if (punct.isEmpty() && jsTrim(after).isNotEmpty()) lines.addAll(wrapWords(jsTrim(after), maxEm))
    return HeadlineLayout(lines, named)
}
