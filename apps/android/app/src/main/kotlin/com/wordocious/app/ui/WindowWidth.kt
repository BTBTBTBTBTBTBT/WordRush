package com.wordocious.app.ui

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// Tablet slice 1: one width vocabulary for the top-level screens. COMPACT is every phone
// (< 600 dp) and stays byte-for-byte the layout it was; MEDIUM (600-839 dp) and EXPANDED
// (>= 840 dp) get one centered content column and a centered tab bar.

enum class WidthClass { COMPACT, MEDIUM, EXPANDED }

/** The width class for a window [widthDp] wide. */
fun widthClassOf(widthDp: Float): WidthClass = when {
    widthDp >= 840f -> WidthClass.EXPANDED
    widthDp >= 600f -> WidthClass.MEDIUM
    else -> WidthClass.COMPACT
}

/** The current window's width class, from the configuration's screen width. */
@Composable
fun rememberWidthClass(): WidthClass {
    val dp = LocalConfiguration.current.screenWidthDp
    return remember(dp) { widthClassOf(dp.toFloat()) }
}

/**
 * A centered column: this node takes the full width (so anything drawn before it, such
 * as the page wallpaper, still fills the window); its content is measured at most [max]
 * wide and centered.
 */
fun Modifier.tabletColumn(max: Dp = 640.dp): Modifier =
    fillMaxWidth().wrapContentWidth(Alignment.CenterHorizontally).widthIn(max = max)

/** [tabletColumn] on MEDIUM / EXPANDED only; a phone gets the modifier untouched. */
fun Modifier.tabletColumnFor(widthClass: WidthClass, max: Dp = 640.dp): Modifier =
    if (widthClass == WidthClass.COMPACT) this else this.tabletColumn(max)
