package com.wordocious.app.ui

import com.wordocious.app.R
import com.wordocious.core.LevelTier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId

/** FINISH_SPEC V: the badge kit's pure bits (art mapping, unlock queue, level-up gate, progress, dates). */
class BadgeKitTest {
    /** Every `icon` key web lib/achievement-service.ts uses today. */
    private val webIcons = listOf(
        "calendar", "crown", "flame", "grid", "group", "key-round", "medal", "quote", "shuffle",
        "sparkles", "star", "swords", "target", "trending-up", "trophy", "zap",
    )

    @Test
    fun every_web_icon_has_its_own_badge() {
        webIcons.forEach { icon ->
            val slug = BadgeArt.slug(icon)
            assertEquals(icon.replace('-', '_'), slug)
            if (icon != "star") assertTrue("$icon maps to its own art", BadgeArt.achievement(icon) != R.drawable.art_badge_star)
        }
        assertEquals(16, BadgeArt.ACHIEVEMENT_SLUGS.size)
        assertEquals(16, BadgeArt.ACHIEVEMENT_SLUGS.map { BadgeArt.achievement(it) }.toSet().size)
    }

    @Test
    fun unknown_icons_fall_back_to_star() {
        assertEquals("star", BadgeArt.slug(null))
        assertEquals("star", BadgeArt.slug(""))
        assertEquals("star", BadgeArt.slug("rocket"))
        assertEquals("trending_up", BadgeArt.slug(" Trending-Up "))
        assertEquals(R.drawable.art_badge_star, BadgeArt.achievement("rocket"))
    }

    @Test
    fun level_art_per_tier() {
        assertEquals(5, LevelTier.entries.map { BadgeArt.level(it) }.toSet().size)
        assertEquals(R.drawable.art_badge_level_gold, BadgeArt.level(LevelTier.GOLD))
    }

    @Test
    fun queue_dedupes_against_queued_seen_and_itself() {
        val a = BadgeMoment.Achievement("first_win")
        val b = BadgeMoment.Achievement("daily_debut")
        val l = BadgeMoment.LevelUp(11)
        assertEquals(listOf(a, b, l), BadgeMath.toEnqueue(emptyList(), emptySet(), listOf(a, b, l)))
        assertEquals(listOf(b), BadgeMath.toEnqueue(listOf(a), emptySet(), listOf(a, b, b)))
        assertEquals(emptyList<BadgeMoment>(), BadgeMath.toEnqueue(emptyList(), setOf(l.id), listOf(BadgeMoment.LevelUp(11))))
        // An achievement key and a level never collide.
        assertEquals(2, BadgeMath.toEnqueue(emptyList(), emptySet(), listOf(BadgeMoment.Achievement("11"), BadgeMoment.LevelUp(11))).size)
    }

    @Test
    fun level_up_popup_only_when_the_tier_changes() {
        assertTrue(BadgeMath.tierChangedOnLevelUp(true, 11))
        assertTrue(BadgeMath.tierChangedOnLevelUp(true, 26))
        assertTrue(BadgeMath.tierChangedOnLevelUp(true, 51))
        assertTrue(BadgeMath.tierChangedOnLevelUp(true, 100))
        assertFalse(BadgeMath.tierChangedOnLevelUp(true, 12))
        assertFalse(BadgeMath.tierChangedOnLevelUp(false, 11))
        assertFalse(BadgeMath.tierChangedOnLevelUp(true, 1))
    }

    @Test
    fun progress_reads_the_profile_and_hides_when_reached() {
        val p = AchievementProgressInputs(
            dailyStreak = 4, totalMedals = 37, goldMedals = 12, totalWins = 120, totalGames = 160, level = 9, bestWinStreak = 3,
        )
        assertEquals(4 to 7, BadgeMath.progress("streak_7", p))
        assertEquals(37 to 50, BadgeMath.progress("medal_50", p))
        assertNull(BadgeMath.progress("medal_10", p))          // reached
        assertNull(BadgeMath.progress("golden_touch", p))      // reached
        assertEquals(12 to 50, BadgeMath.progress("gold_rush", p))
        assertNull(BadgeMath.progress("century_club", p))      // reached
        assertEquals(120 to 500, BadgeMath.progress("wordsmith", p))
        assertEquals(160 to 500, BadgeMath.progress("dedicated", p))
        assertEquals(9 to 10, BadgeMath.progress("rising_star", p))
        assertEquals(3 to 5, BadgeMath.progress("unstoppable", p))
        assertNull(BadgeMath.progress("first_win", p))         // nothing to count
        assertEquals(0f, BadgeMath.fraction(0, 0))
        assertEquals(0.74f, BadgeMath.fraction(37, 50), 0.0001f)
        assertEquals(1f, BadgeMath.fraction(80, 50))
    }

    @Test
    fun unlock_dates() {
        val utc = ZoneId.of("UTC")
        assertEquals("Oct 2, 2026", BadgeMath.unlockDate("2026-10-02T14:03:11.123456+00:00", utc))
        assertEquals("Oct 2, 2026", BadgeMath.unlockDate("2026-10-02T14:03:11Z", utc))
        assertEquals("Oct 1, 2026", BadgeMath.unlockDate("2026-10-02T03:00:00+00:00", ZoneId.of("America/Los_Angeles")))
        assertEquals("Oct 2, 2026", BadgeMath.unlockDate("2026-10-02T14:03:11", utc))
        assertEquals("Oct 2, 2026", BadgeMath.unlockDate("2026-10-02", utc))
        assertNull(BadgeMath.unlockDate(null, utc))
        assertNull(BadgeMath.unlockDate("nope", utc))
    }

    @Test
    fun fallback_names() {
        assertEquals("First Win", BadgeMath.fallbackName("first_win"))
        assertEquals("Pure Sudoku Master", BadgeMath.fallbackName("pure_sudoku_master"))
    }
}
