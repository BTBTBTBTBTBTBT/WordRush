package com.wordocious.app.ui

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import com.wordocious.app.ui.theme.WTheme

// FINISH_SPEC AJ (founder 10-02: "tapping the home button on the footer always gets you back to
// the main page"): a footer tab tap from ANY depth closes every pushed page / layer / sheet and
// lands on that tab's root, scrolled to the top; re-tapping the current tab pops it to its root
// and scrolls up. The one exception is a live VS match, which asks first (leaving = a forfeit).

/** AJ the navigation layers a tab tap can clear (pure, unit-tested). */
data class TabNavState(
    val selectedTab: Int,
    /** Pages pushed inside a tab: a public profile, the Records screen. */
    val pushedPages: Int = 0,
    /** Full-screen layers over the tabs: a game, an info page, Settings, sign-in, the VS lobby, a pocket game… */
    val layers: Int = 0,
    /** A live VS match is on screen (leaving counts as a forfeit). */
    val liveVsMatch: Boolean = false,
)

/** AJ what a tab tap does. */
sealed class TabTapOutcome {
    /** Ask first: "Leave the match? It counts as a forfeit." [Stay] [Leave]. */
    data class ConfirmLeaveMatch(val tab: Int) : TabTapOutcome()
    /** Clear every push / layer, select [tab], and scroll it to the top. */
    data class GoToRoot(val tab: Int, val scrollToTop: Boolean) : TabTapOutcome()
}

object TabNav {
    const val HOME = 0

    /** The outcome of tapping [tab] in [state]. */
    fun onTabTap(state: TabNavState, tab: Int): TabTapOutcome {
        if (state.liveVsMatch) return TabTapOutcome.ConfirmLeaveMatch(tab)
        // A re-tap of the current tab (or Home from anywhere) always lands on the root, at the top.
        val reselect = tab == state.selectedTab || tab == HOME
        return TabTapOutcome.GoToRoot(tab, scrollToTop = reselect)
    }

    /** After [GoToRoot]: nothing pushed, no layers, on [tab]. */
    fun root(tab: Int): TabNavState = TabNavState(selectedTab = tab)
}

/**
 * AJ per-tab "go to the top" signal: MainScreen bumps a tab's counter when it is re-tapped (or
 * Home from anywhere); the tab's scroll container scrolls to the top when it changes.
 */
val LocalTabReselect = compositionLocalOf { 0 }

/** AJ scroll [state] to the top whenever the tab's reselect counter changes (not on first show). */
@Composable
fun ScrollToTopOnReselect(state: ScrollState) {
    val signal = LocalTabReselect.current
    val first = remember { intArrayOf(signal) }
    LaunchedEffect(signal) {
        if (signal == first[0]) return@LaunchedEffect
        if (WTheme.reducedMotion) state.scrollTo(0) else state.animateScrollTo(0)
    }
}

/** AJ the LazyColumn twin of [ScrollToTopOnReselect]. */
@Composable
fun ScrollToTopOnReselect(state: LazyListState) {
    val signal = LocalTabReselect.current
    val first = remember { intArrayOf(signal) }
    LaunchedEffect(signal) {
        if (signal == first[0]) return@LaunchedEffect
        if (WTheme.reducedMotion) state.scrollToItem(0) else state.animateScrollToItem(0)
    }
}
