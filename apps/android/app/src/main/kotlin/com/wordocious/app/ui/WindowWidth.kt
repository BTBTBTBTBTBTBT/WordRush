package com.wordocious.app.ui

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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

// Tablet slice 4: the top-level tabs (Home, Leaderboard, Stats, Friends) use the window's width.
// The page is min(width - 2 x margin, tabletPageMaxWidth), centered; games and sheets keep the 640 column.

/** The widest a top-level page gets (pt/dp). */
val tabletPageMaxWidth: Dp = 1000.dp

/** The side margin of a top-level page: 24 dp on MEDIUM, 32 dp on EXPANDED. */
fun tabletPageMargin(widthClass: WidthClass): Dp =
    if (widthClass == WidthClass.EXPANDED) 32.dp else 24.dp

/** The top-level page width on MEDIUM / EXPANDED; a phone gets the modifier untouched. */
fun Modifier.tabletPageFor(widthClass: WidthClass): Modifier =
    if (widthClass == WidthClass.COMPACT) this
    else fillMaxWidth()
        .padding(horizontal = tabletPageMargin(widthClass))
        .wrapContentWidth(Alignment.CenterHorizontally)
        .widthIn(max = tabletPageMaxWidth)

// Tablet slice 6: a page's side inset INSIDE a full-width scroll container (so a swipe in the margin scrolls):
// the page margin, or more when the 1000 dp cap centres the page. Phones: 0 (the modifier is unchanged).
@Composable
fun tabletPageInset(widthClass: WidthClass): Dp {
    if (widthClass == WidthClass.COMPACT) return 0.dp
    val w = LocalConfiguration.current.screenWidthDp.dp
    return maxOf(tabletPageMargin(widthClass), (w - tabletPageMaxWidth) / 2)
}

// Tablet slice 5: the game screens use the same page as the top-level tabs (min(width - 2 x margin,
// tabletPageMaxWidth)). A phone keeps its 10 dp side padding, byte for byte.

/** A game screen's page: the phone's 10 dp padding, or the tablet page on MEDIUM / EXPANDED. */
fun Modifier.gamePageFor(widthClass: WidthClass): Modifier =
    if (widthClass == WidthClass.COMPACT) this.padding(horizontal = 10.dp) else this.tabletPageFor(widthClass)

/** Game header title art scale (R4): 2x its phone height on EXPANDED, 1.6x on MEDIUM, 1 on a phone. */
fun titleArtScale(widthClass: WidthClass): Float = when (widthClass) {
    WidthClass.EXPANDED -> 2f
    WidthClass.MEDIUM -> 1.6f
    WidthClass.COMPACT -> 1f
}

/** Game header chrome scale (R4): the status line and the home / sound / help buttons, 1.3x on EXPANDED, 1.2x on MEDIUM. */
fun chromeScale(widthClass: WidthClass): Float = when (widthClass) {
    WidthClass.EXPANDED -> 1.3f
    WidthClass.MEDIUM -> 1.2f
    WidthClass.COMPACT -> 1f
}
