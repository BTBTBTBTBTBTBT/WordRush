package com.wordocious.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.wordocious.core.TileState

/**
 * Theme-driven surface/text/border tokens — one set per `[data-theme]` from
 * globals.css. Brand/tile/keyboard colors are FIXED (defined below in WTheme).
 */
data class Palette(
    val bg: Color, val surface: Color, val border: Color, val borderLight: Color,
    val borderAlt: Color, val divider: Color, val surfaceHover: Color, val surfaceAlt: Color,
    val text: Color, val textMuted: Color, val textSecondary: Color,
)

object Palettes {
    val Light = Palette(
        bg = Color(0xFFF8F7FF), surface = Color(0xFFFFFFFF), border = Color(0xFFEDE9F6),
        borderLight = Color(0xFFE0DAF0), borderAlt = Color(0xFFE5E7EB), divider = Color(0xFFF0F0F0),
        surfaceHover = Color(0xFFF3F0FF), surfaceAlt = Color(0xFFF3F4F6),
        text = Color(0xFF1A1A2E), textMuted = Color(0xFF9CA3AF), textSecondary = Color(0xFF6B7280),
    )
    val Dark = Palette(
        bg = Color(0xFF1A1A2E), surface = Color(0xFF252542), border = Color(0xFF3A3A5C),
        borderLight = Color(0xFF2E2E4A), borderAlt = Color(0xFF3A3A5C), divider = Color(0xFF3A3A5C),
        surfaceHover = Color(0xFF2E2E4A), surfaceAlt = Color(0xFF2A2A48),
        text = Color(0xFFF0EEF6), textMuted = Color(0xFF9CA3AF), textSecondary = Color(0xFFA0A0B8),
    )
    val Ocean = Palette(
        bg = Color(0xFFF0F7FB), surface = Color(0xFFFFFFFF), border = Color(0xFFCFE4EF),
        borderLight = Color(0xFFDDEBF3), borderAlt = Color(0xFFD5E5EE), divider = Color(0xFFE8F1F6),
        surfaceHover = Color(0xFFE3F0F7), surfaceAlt = Color(0xFFEAF3F8),
        text = Color(0xFF0F2E3D), textMuted = Color(0xFF6B8A99), textSecondary = Color(0xFF4A6B7A),
    )
    val Forest = Palette(
        bg = Color(0xFFF3F8F1), surface = Color(0xFFFFFFFF), border = Color(0xFFD6E6CF),
        borderLight = Color(0xFFE0EBDA), borderAlt = Color(0xFFDBE7D4), divider = Color(0xFFECF3E9),
        surfaceHover = Color(0xFFE8F2E4), surfaceAlt = Color(0xFFEDF4EA),
        text = Color(0xFF1F3320), textMuted = Color(0xFF7A8C72), textSecondary = Color(0xFF56684F),
    )
    fun byKey(key: String) = when (key) {
        "dark" -> Dark; "ocean" -> Ocean; "forest" -> Forest; else -> Light
    }
}

/**
 * Design tokens (web globals.css + iOS Theme.swift). Surface/text/border are
 * theme-driven via [palette] (recomposes when the user switches theme); brand,
 * tile and keyboard colors are FIXED.
 */
object WTheme {
    // Active palette — change via ThemeState; reads here recompose the whole app.
    var palette by mutableStateOf(Palettes.Light)

    val bg get() = palette.bg
    val surface get() = palette.surface
    val border get() = palette.border
    val borderLight get() = palette.borderLight
    val borderAlt get() = palette.borderAlt
    val divider get() = palette.divider
    val surfaceHover get() = palette.surfaceHover
    val surfaceAlt get() = palette.surfaceAlt
    val text get() = palette.text
    val textMuted get() = palette.textMuted
    val textSecondary get() = palette.textSecondary

    val winBg = Color(0xFFDCFCE7)
    val lossBg = Color(0xFFFEE2E2)
    val winText = Color(0xFF16A34A)
    val lossText = Color(0xFFDC2626)

    // Brand
    val primary = Color(0xFF7C3AED)          // purple (hsl 263 70% 50%)
    val wordmarkStart = Color(0xFFA78BFA)    // gradient #a78bfa → #ec4899
    val wordmarkEnd = Color(0xFFEC4899)
    val gold = Color(0xFFF59E0B)

    // Board tiles — Tailwind green-500 / yellow-500 / gray-500
    val correct = Color(0xFF22C55E)
    val present = Color(0xFFEAB308)
    val absent = Color(0xFF6B7280)
    val emptyBorder = Color(0xFFD1D5DB)      // gray-300
    val hintUsed = Color(0xFFD1D5DB)         // web HINT_USED = gray (not present color)

    // Keyboard keys — darker 600-weight + gray-400 (distinct from board tiles)
    val keyDefault = Color(0xFFE8E5F0)
    val keyCorrect = Color(0xFF16A34A)       // green-600
    val keyPresent = Color(0xFFCA8A04)       // yellow-600
    val keyAbsent = Color(0xFF9CA3AF)        // gray-400

    val wordmarkGradient = Brush.linearGradient(
        colors = listOf(wordmarkStart, wordmarkEnd),
        start = Offset(0f, 0f),
        end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
    )

    /** Board-tile fill per letter state. EMPTY = transparent (border only). */
    fun tileColor(state: TileState): Color = when (state) {
        TileState.CORRECT -> correct
        TileState.PRESENT -> present
        TileState.ABSENT -> absent
        TileState.HINT_USED -> hintUsed
        TileState.EMPTY -> Color.Transparent
    }

    /** Keyboard-key fill per letter state (darker than board tiles). */
    fun keyColor(state: TileState): Color = when (state) {
        TileState.CORRECT -> keyCorrect
        TileState.PRESENT, TileState.HINT_USED -> keyPresent
        TileState.ABSENT -> keyAbsent
        TileState.EMPTY -> keyDefault
    }
}

private val WordociousColorScheme = lightColorScheme(
    primary = WTheme.primary,
    background = WTheme.bg,
    surface = WTheme.surface,
    onPrimary = Color.White,
    onBackground = WTheme.text,
    onSurface = WTheme.text,
)

@Composable
fun WordociousTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = WordociousColorScheme,
        typography = WordociousTypography,
    ) {
        // Make EVERY Text() default to Nunito (brand font) unless it overrides
        // fontFamily itself — none of our Texts do, so the whole app uses Nunito.
        androidx.compose.runtime.CompositionLocalProvider(
            androidx.compose.material3.LocalTextStyle provides
                androidx.compose.material3.LocalTextStyle.current.copy(fontFamily = Nunito),
            content = content,
        )
    }
}
