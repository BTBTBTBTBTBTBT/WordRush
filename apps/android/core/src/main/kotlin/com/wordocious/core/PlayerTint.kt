package com.wordocious.core

import kotlin.math.floor
import kotlin.math.max
import kotlin.math.pow

/**
 * A player's own mascot-maker colors (founder 10-09), for surfaces that wear them: the podium stat plates (their
 * backdrop as the fill, their frame as the border, ink chosen for contrast) and their name in the bubble lettering.
 * Kotlin port of packages/core/src/player-tint.ts, pinned by player-tint-fixtures.json (PlayerTintFixtureTest).
 */
object PlayerTint {
    data class Plate(val fill: List<String>, val border: List<String>, val borderWidth: Double, val lightInk: Boolean)

    private fun rgb(hex: String): Triple<Double, Double, Double> {
        val s = hex.removePrefix("#")
        val v = s.toLongOrNull(16)?.toInt() ?: 0
        return Triple(((v shr 16) and 0xff) / 255.0, ((v shr 8) and 0xff) / 255.0, (v and 0xff) / 255.0)
    }

    private fun byteHex(v: Double): String = Math.round(v).toInt().toString(16).padStart(2, '0')

    /** Blend two hexes (t = 0 gives a, 1 gives b), as lowercase #rrggbb. */
    fun mix(a: String, b: String, t: Double): String {
        val x = rgb(a)
        val y = rgb(b)
        fun c(p: Double, q: Double) = (p + (q - p) * t) * 255
        return "#" + byteHex(c(x.first, y.first)) + byteHex(c(x.second, y.second)) + byteHex(c(x.third, y.third))
    }

    /** WCAG relative luminance (0 black ... 1 white). */
    fun luminance(hex: String): Double {
        fun lin(v: Double) = if (v <= 0.03928) v / 12.92 else ((v + 0.055) / 1.055).pow(2.4)
        val (r, g, b) = rgb(hex)
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }

    /** The backdrop's colors ("auto" / unknown = a light tint of the body color). A pattern reads as its base color plus a whisper of its accent. */
    fun backdropHexes(bg: String, bodyHex: String): List<String> {
        val b = avatarBackdrop(bg) ?: return listOf(mix(bodyHex, "#ffffff", 0.78))
        return if (b.kind == "pattern") listOf(b.colors[0], mix(b.colors[0], b.colors[1], 0.3)) else b.colors
    }

    /** The frame's metal as a border gradient; "none" = a deeper shade of the fill so every plate has an edge. */
    fun frameHexes(frame: String, fill: List<String>): Pair<List<String>, Double> = when (frame) {
        "bronze" -> listOf("#F0B27A", "#B45309") to 2.5
        "silver" -> listOf("#F8FAFC", "#94A3B8") to 2.5
        "gold" -> listOf("#FDE68A", "#D97706") to 2.5
        "platinum" -> listOf("#E0F2FE", "#64748B") to 2.5
        "diamond" -> listOf("#A5F3FC", "#818CF8", "#F0ABFC") to 2.5
        "pro" -> listOf("#F5B82E", "#EC4899", "#8B5CF6") to 2.5
        else -> listOf(mix(fill[0], "#000000", 0.28)) to 1.5
    }

    fun plateHexes(bg: String, frame: String, bodyHex: String): Plate {
        val fill = backdropHexes(bg, bodyHex)
        val (border, width) = frameHexes(frame, fill)
        val lum = fill.map { luminance(it) }.sum() / max(1, fill.size)
        return Plate(fill, border, width, lum < 0.42)
    }

    private fun toHsb(hex: String): Triple<Double, Double, Double> {
        val (r, g, b) = rgb(hex)
        val mx = maxOf(r, g, b)
        val mn = minOf(r, g, b)
        val d = mx - mn
        var h = 0.0
        if (d > 0) {
            h = when (mx) {
                r -> ((g - b) / d) % 6
                g -> (b - r) / d + 2
                else -> (r - g) / d + 4
            }
            h /= 6
            if (h < 0) h += 1
        }
        return Triple(h, if (mx == 0.0) 0.0 else d / mx, mx)
    }

    private fun fromHsb(h: Double, s: Double, v: Double): String {
        val i = floor(h * 6).toInt() % 6
        val f = h * 6 - floor(h * 6)
        val p = v * (1 - s)
        val q = v * (1 - f * s)
        val t = v * (1 - (1 - f) * s)
        val (r, g, b) = when (i) {
            0 -> Triple(v, t, p)
            1 -> Triple(q, v, p)
            2 -> Triple(p, v, t)
            3 -> Triple(p, q, v)
            4 -> Triple(t, p, v)
            else -> Triple(v, p, q)
        }
        return "#" + byteHex(r * 255) + byteHex(g * 255) + byteHex(b * 255)
    }

    /** A vivid version of the player's backdrop color, for their name in the bubble lettering (lemon gives a sunny gold). */
    fun nameHex(bg: String, bodyHex: String): String {
        val base = avatarBackdrop(bg)?.colors?.last() ?: bodyHex
        val (h, s, v) = toHsb(base)
        if (s < 0.12) return "#8B5CF6" // a grey / white backdrop: the brand purple
        return fromHsb(h, max(s, 0.78), max(v, 0.92))
    }

    /** The same two from a resolved AvatarConfig. */
    fun plate(c: AvatarConfig): Plate = plateHexes(c.bg, c.frame, avatarColorHex(c.color))
    fun nameHex(c: AvatarConfig): String = nameHex(c.bg, avatarColorHex(c.color))
}
