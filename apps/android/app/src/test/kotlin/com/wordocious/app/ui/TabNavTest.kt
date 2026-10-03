package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC AJ: the footer Home tab always lands on the Home root (BI11: where it was left). */
class TabNavTest {
    @Test
    fun home_from_three_levels_deep_lands_on_the_root_where_it_was_left() {
        // Stats tab → a public profile + Records pushed → Settings layered on top.
        val deep = TabNavState(selectedTab = 2, pushedPages = 2, layers = 1)
        // BI11: back on Home at the position the player left (no scroll to the top).
        assertEquals(TabTapOutcome.GoToRoot(TabNav.HOME, scrollToTop = false), TabNav.onTabTap(deep, TabNav.HOME))
        assertEquals(TabNavState(selectedTab = 0), TabNav.root(0))
    }

    @Test
    fun coming_back_from_another_tab_keeps_the_scroll_position() {
        // BI11: Home (scrolled halfway) → Leaderboard → Home: Home is where it was.
        assertEquals(TabTapOutcome.GoToRoot(TabNav.HOME, scrollToTop = false), TabNav.onTabTap(TabNavState(1), TabNav.HOME))
        // Same for every tab.
        assertEquals(TabTapOutcome.GoToRoot(3, scrollToTop = false), TabNav.onTabTap(TabNavState(1), 3))
        assertEquals(TabTapOutcome.GoToRoot(2, scrollToTop = false), TabNav.onTabTap(TabNavState(0), 2))
    }

    @Test
    fun re_tapping_the_current_tab_pops_it_then_a_re_tap_at_the_root_scrolls_up() {
        assertEquals(TabTapOutcome.GoToRoot(1, scrollToTop = false), TabNav.onTabTap(TabNavState(1, pushedPages = 1), 1))
        for (tab in 0..3) assertEquals(TabTapOutcome.GoToRoot(tab, scrollToTop = true), TabNav.onTabTap(TabNavState(tab), tab))
    }

    @Test
    fun a_live_vs_match_asks_first() {
        assertEquals(TabTapOutcome.ConfirmLeaveMatch(0), TabNav.onTabTap(TabNavState(0, layers = 1, liveVsMatch = true), 0))
    }
}
