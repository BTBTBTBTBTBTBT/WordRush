package com.wordocious.app.data

import kotlin.math.roundToInt

/**
 * Theme surfaces (FRIDAY-QUEUE item 25): the card / border / ink tokens a theme derives from its registry look.
 * Port of core theme-surfaces.ts; theme-surfaces-fixtures.json pins the output of web, Swift and Kotlin
 * (ThemeSurfacesTest). Pure (no Android types).
 */
object ThemeSurfaces {
    data class Input(val card: String, val ink: String, val inkSecondary: String, val accent: String, val tabBar: String)

    data class Tokens(
        val surface: String, val surfaceHover: String, val surfaceAlt: String, val border: String, val borderAlt: String,
        val borderLight: String, val divider: String, val text: String, val textSecondary: String, val textMuted: String,
        val tabBar: String, val tabEdge: String,
    )

    private fun parse(hex: String): Triple<Double, Double, Double> {
        val h = hex.removePrefix("#")
        return Triple(h.substring(0, 2).toInt(16).toDouble(), h.substring(2, 4).toInt(16).toDouble(), h.substring(4, 6).toInt(16).toDouble())
    }

    private fun two(n: Double): String = n.roundToInt().coerceIn(0, 255).toString(16).padStart(2, '0').uppercase()

    /** `a` toward `b` by `t` (0..1), per channel, rounded half up: "#RRGGBB". */
    fun mix(a: String, b: String, t: Double): String {
        val (ar, ag, ab) = parse(a)
        val (br, bg, bb) = parse(b)
        return "#" + two(ar + (br - ar) * t) + two(ag + (bg - ag) * t) + two(ab + (bb - ab) * t)
    }

    fun tokens(l: Input): Tokens = Tokens(
        surface = l.card.uppercase(),
        surfaceHover = mix(l.card, l.accent, 0.08), surfaceAlt = mix(l.card, l.accent, 0.05),
        border = mix(l.card, l.accent, 0.24), borderAlt = mix(l.card, l.accent, 0.16),
        borderLight = mix(l.card, l.accent, 0.12), divider = mix(l.card, l.accent, 0.1),
        text = l.ink.uppercase(), textSecondary = l.inkSecondary.uppercase(),
        textMuted = mix(l.inkSecondary, l.card, 0.2),
        tabBar = l.tabBar.uppercase(), tabEdge = mix(l.tabBar, l.accent, 0.3),
    )
}
