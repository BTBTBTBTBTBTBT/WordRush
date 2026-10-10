package com.wordocious.app.ui.friends

import com.wordocious.core.avatarBackdrop
import com.wordocious.core.avatarColorHex
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Founder 10-09: the words on the friend card's "Pick a game" dropdown, the action menu's layout rule and the person's
// name color. Pure, so the three apps keep one rule (iOS FriendCardsView.gamesDropdown / FamilyMenuInk.isNotes /
// PlayerTint.nameColor, web lib/friend-card-copy.ts + lib/player-tint.ts). Pinned by FriendCardCopyTest.
object FriendCardCopy {
    /** The dropdown's subtitle: the first three game titles joined ", ", plus " and more" past three. */
    fun gamesSubtitle(titles: List<String>): String =
        titles.take(3).joinToString(", ") + if (titles.size > 3) " and more" else ""

    /** The shortest title that reads as a sentence: a non-danger action this long (React's quick notes) wears a speech bubble. */
    const val NOTE_TITLE_MIN = 19

    /** A menu whose (non-danger) choices are sentences lists them one per row as speech bubbles, whole. */
    fun isNotesMenu(titlesAndDanger: List<Pair<String, Boolean>>): Boolean =
        titlesAndDanger.any { (title, danger) -> !danger && title.length >= NOTE_TITLE_MIN }

    private const val BRAND_PURPLE = 0xFF8B5CF6.toInt()

    /**
     * A vivid version of the player's backdrop color, as ARGB: the backdrop's LAST color (the body color for "auto"), lifted to
     * saturation >= 0.78 and brightness >= 0.92 (lemon becomes a sunny gold); a gray or white backdrop (saturation < 0.12)
     * takes the brand purple.
     */
    fun nameColorArgb(bg: String?, bodyColorId: String): Int {
        val hex = avatarBackdrop(bg)?.colors?.lastOrNull() ?: avatarColorHex(bodyColorId)
        val rgb = parse(hex) ?: return BRAND_PURPLE
        val (r, g, b) = rgb
        val mx = max(r, max(g, b))
        val mn = min(r, min(g, b))
        val d = mx - mn
        val sat = if (mx == 0f) 0f else d / mx
        if (sat < 0.12f) return BRAND_PURPLE
        var h = 0f
        if (d > 0f) {
            h = when (mx) {
                r -> ((g - b) / d) % 6f
                g -> (b - r) / d + 2f
                else -> (r - g) / d + 4f
            } / 6f
            if (h < 0f) h += 1f
        }
        return hsb(h, max(sat, 0.78f), max(mx, 0.92f))
    }

    private fun parse(hex: String): Triple<Float, Float, Float>? {
        var h = hex.trim().removePrefix("#")
        if (h.length == 3) h = h.map { "$it$it" }.joinToString("")
        if (h.length < 6) return null
        val n = h.take(6).toLongOrNull(16) ?: return null
        return Triple(((n shr 16) and 255) / 255f, ((n shr 8) and 255) / 255f, (n and 255) / 255f)
    }

    private fun hsb(h: Float, s: Float, v: Float): Int {
        fun f(n: Int): Int {
            val k = (n + h * 6f) % 6f
            val c = v - v * s * max(0f, min(min(k, 4f - k), 1f))
            return (c * 255f).roundToInt().coerceIn(0, 255)
        }
        return (0xFF shl 24) or (f(5) shl 16) or (f(3) shl 8) or f(1)
    }
}
