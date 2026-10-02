package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.toSize
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// FINISH_SPEC AG: tablets and foldables (width ≥ 600 dp). The phone layout keeps its
// full width; a wide window gets a centered content column — game screens ~560 dp
// (their boards keep the one phone sizing rule, BoardSizing, inside it: never
// stretched), the tab pages ~600 dp — while the page background / game wallpaper
// still fills the whole window behind it. Popups cap at ~440 dp, centered. The cast
// header sits inside the page column, so it stays at 90% of the column. Pure rule:
// WideLayoutTest.

object WideLayout {
    /** A window this wide (dp) or wider is a tablet / unfolded foldable. */
    const val WIDE_MIN_DP = 600f
    /** The game screens' content column (the web's ~560 px). */
    const val GAME_COLUMN_DP = 560f
    /** The tab pages' content column (Home, Leaderboard, Stats, Friends). */
    const val PAGE_COLUMN_DP = 600f
    /** Popups and dialogs never get wider than this. */
    const val POPUP_MAX_DP = 440f
    /** The R1-style popup cards (win / help) keep their phone width, inside the popup cap. */
    const val POPUP_CARD_DP = 400f

    fun isWide(widthDp: Float): Boolean = widthDp >= WIDE_MIN_DP

    /**
     * The content column's width for [availableDp] of width: the full width on a phone
     * (< [WIDE_MIN_DP]), else [maxDp] (never more than what is there).
     */
    fun columnWidth(availableDp: Float, maxDp: Float): Float =
        if (!isWide(availableDp)) availableDp else min(availableDp, maxDp)

    /** The empty space each side of the column (0 on a phone). */
    fun sideGutter(availableDp: Float, maxDp: Float): Float = max(0f, (availableDp - columnWidth(availableDp, maxDp)) / 2f)
}

/**
 * AG the centered content column: on a wide window the content is measured at most
 * [maxDp] wide and centered; this node still takes the full width (so backgrounds drawn
 * BEFORE it in the chain fill the window). A phone is untouched. Put it after the
 * background / insets modifiers of a page or game root.
 */
fun Modifier.contentColumn(maxDp: Float = WideLayout.PAGE_COLUMN_DP): Modifier = this.layout { measurable, constraints ->
    if (!constraints.hasBoundedWidth) {
        val p = measurable.measure(constraints)
        return@layout layout(p.width, p.height) { p.place(0, 0) }
    }
    val availPx = constraints.maxWidth
    val colPx = WideLayout.columnWidth(availPx.toDp().value, maxDp).dp.roundToPx().coerceIn(0, availPx)
    if (colPx >= availPx) {
        val p = measurable.measure(constraints)
        return@layout layout(p.width, p.height) { p.place(0, 0) }
    }
    val p = measurable.measure(constraints.copy(minWidth = min(constraints.minWidth, colPx), maxWidth = colPx))
    val w = max(availPx, p.width)
    layout(w, p.height) { p.place(((w - p.width) / 2f).roundToInt(), 0) }
}

/** AG a game screen's centered column (~560 dp on a tablet). */
fun Modifier.gameColumn(): Modifier = contentColumn(WideLayout.GAME_COLUMN_DP)

/** AG a popup / dialog's width cap (~440 dp), for `modifier =` on AlertDialogs and dialog cards. */
val PopupWidth: Modifier = Modifier.widthIn(max = WideLayout.POPUP_MAX_DP.dp)

/**
 * AG a popup scrim's dim: on a phone a plain background; on a wide window the dim covers
 * the whole window even when the popup lives inside a centered content column (it
 * draws past its own bounds, anchored to the window).
 */
fun Modifier.windowScrim(color: Color): Modifier = composed {
    if (!WideLayout.isWide(LocalConfiguration.current.screenWidthDp.toFloat())) return@composed this.background(color)
    var origin by remember { mutableStateOf(Offset.Zero) }
    var rootSize by remember { mutableStateOf(Size.Zero) }
    this
        .onGloballyPositioned { c ->
            origin = c.positionInRoot()
            rootSize = c.findRootCoordinates().size.toSize()
        }
        .drawBehind {
            if (rootSize.width > 0f && rootSize.height > 0f) drawRect(color, topLeft = -origin, size = rootSize)
            else drawRect(color)
        }
}
