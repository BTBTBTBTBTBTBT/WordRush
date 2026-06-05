package com.wordocious.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.wordocious.core.TileState

/**
 * Design tokens ported 1:1 from the web app (`apps/web/app/globals.css` :root)
 * and the iOS `Theme.swift`. The web/iOS are the source of truth (AUDIT-THEN-MATCH).
 * Light palette only for now; dark/ocean/forest are the same structure and get
 * added with the settings screen (web drives them via `[data-theme]`).
 */
object WTheme {
    // --color-* (globals.css :root)
    val bg = Color(0xFFF8F7FF)
    val surface = Color(0xFFFFFFFF)
    val border = Color(0xFFEDE9F6)
    val borderLight = Color(0xFFE0DAF0)
    val borderAlt = Color(0xFFE5E7EB)
    val divider = Color(0xFFF0F0F0)
    val surfaceHover = Color(0xFFF3F0FF)
    val surfaceAlt = Color(0xFFF3F4F6)
    val text = Color(0xFF1A1A2E)
    val textMuted = Color(0xFF9CA3AF)
    val textSecondary = Color(0xFF6B7280)

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
