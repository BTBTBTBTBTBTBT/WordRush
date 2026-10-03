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
// lands on that tab's root — BI11: at the position the player left it; only a re-tap of the
// current tab at its root scrolls up. The one exception is a live VS match, which asks first
// (leaving = a forfeit).

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
        // Every tap lands on the tab's root. BI11 (founder 10-02: "if you were … mid way down, and
        // on another tab and click right back, the position should persist"): only a re-tap of the
        // tab you're on, at its root with nothing over it, scrolls to the top — coming back from
        // another tab, out of a pushed page or out of a game keeps the root where it was left.
        val reTapAtRoot = tab == state.selectedTab && state.pushedPages == 0 && state.layers == 0
        return TabTapOutcome.GoToRoot(tab, scrollToTop = reTapAtRoot)
    }

    /** After [GoToRoot]: nothing pushed, no layers, on [tab]. */
    fun root(tab: Int): TabNavState = TabNavState(selectedTab = tab)
}

/**
 * AJ per-tab "go to the top" signal: MainScreen bumps a tab's counter when it is re-tapped at its
 * root (BI11 — never on a return from another tab or a game); the tab's scroll container scrolls
 * to the top when it changes.
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

/**
 * AY (founder 10-02: "sometimes the new home buttons open another game and I need to hit home
 * again"): the top-left home button ALWAYS lands on the Home root — through the same router as
 * AJ (every layer, push and sheet cleared, Home selected), never "one level back" to whatever
 * the game was opened from — and it can't tap through onto the Home card that ends up under the
 * finger: the home action is single-fire, and Home's cards ignore taps for [TAP_GUARD_MS] after
 * it. Pure (unit tested); MainScreen provides [LocalGoHome] to every game layer.
 */
object HomeNav {
    const val TAP_GUARD_MS = 400L

    @Volatile private var lastHomeAt = Long.MIN_VALUE / 2

    /** True when a home tap at [nowMs] should act (false = a repeat inside the guard window). */
    fun tryGoHome(nowMs: Long): Boolean {
        if (nowMs - lastHomeAt < TAP_GUARD_MS) return false
        lastHomeAt = nowMs
        return true
    }

    /** May a Home card take a tap at [nowMs]? Not within [TAP_GUARD_MS] of going Home. */
    fun cardTapAllowed(nowMs: Long): Boolean = nowMs - lastHomeAt >= TAP_GUARD_MS

    /** For tests. */
    fun reset() { lastHomeAt = Long.MIN_VALUE / 2 }

    /** The home button's outcome from any [state]: the Home root (AJ's GoToRoot on Home). */
    fun onHomeButton(state: TabNavState): TabNavState = TabNav.root(TabNav.HOME)
}

/** AY the "go to the Home root" action for a layer's top-left home button (null = the screen's own onBack). */
val LocalGoHome = androidx.compose.runtime.staticCompositionLocalOf<(() -> Unit)?> { null }
