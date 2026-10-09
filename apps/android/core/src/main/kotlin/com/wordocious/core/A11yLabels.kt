package com.wordocious.core

/**
 * 2.8 item 40 (screen readers): the spoken words for everything new in 2.8, in ONE place so TalkBack, VoiceOver and ARIA
 * say the same thing. Port of packages/core/src/a11y-labels.ts (pinned by a11y-labels-fixtures.json). Every helper returns
 * a non-empty string, so no image title, headline or mascot is ever silent.
 */
object A11yLabels {
    /** "First" / "Second" / "Third" / "#4". */
    fun placeWord(place: Int): String = when (place) { 1 -> "First"; 2 -> "Second"; 3 -> "Third"; else -> "#$place" }

    /** A podium place as one spoken line: "First place, doug, 2,005, 4 Guesses · 1m 45s". */
    fun podiumPlace(place: Int, name: String, points: String, detail: String?): String {
        val d = detail?.trim().orEmpty()
        return "${placeWord(place)} place, $name, $points${if (d.isEmpty()) "" else ", $d"}"
    }

    /** A free podium place. */
    fun podiumOpenSpot(place: Int): String = "${placeWord(place)} place, open spot"

    /** The button that opens a podium mascot's mini Stage card. */
    fun podiumStageCard(name: String, place: Int): String = "$name, ${placeWord(place).lowercase()} place. Opens their stage"

    /** The gold seal on the Flawless popup. */
    fun flawlessSeal(days: Int): String = "$days Flawless ${if (days == 1) "day" else "days"} in a row"

    /** A changing headline set in bubble letters (or split over lines): the plain sentence, whitespace collapsed. */
    fun headline(lines: List<String>): String {
        val text = lines.joinToString(" ").split(Regex("\\s+")).filter { it.isNotEmpty() }.joinToString(" ")
        return text.ifEmpty { "Headline" }
    }

    /** A mascot picture: yours, or another player's. */
    fun mascot(own: Boolean, name: String?): String {
        if (own) return "Your mascot"
        val n = name?.trim().orEmpty()
        return if (n.isEmpty()) "Mascot" else "$n's mascot"
    }

    /** The Home counter ("7 OF 18"). */
    fun progress(played: Int, total: Int): String = "$played of $total played today"
}
