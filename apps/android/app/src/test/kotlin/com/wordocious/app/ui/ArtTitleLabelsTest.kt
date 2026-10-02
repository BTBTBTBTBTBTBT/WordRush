package com.wordocious.app.ui

import com.wordocious.app.ModeGen
import com.wordocious.core.leaderboardTitle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/**
 * FINISH_SPEC AB: every art title in the registries has a real label (the words it
 * shows), so TalkBack never reads an empty or keyed heading.
 */
class ArtTitleLabelsTest {
    @Test fun everyPageTitleHasALabel() {
        TitleArt.entries.forEach { assertTrue("TitleArt.$it has no label", it.label.isNotBlank()) }
    }

    @Test fun everyMomentTitleHasALabel() {
        MomentArt.entries.forEach { assertTrue("MomentArt.$it has no label", it.label.isNotBlank()) }
    }

    @Test fun everyGameTitleArtHasTheCatalogTitleAsItsLabel() {
        var withArt = 0
        ModeGen.all.forEach { m ->
            if (gameTitleArtRes(m.id) == null) return@forEach
            withArt++
            val key = m.dbKey
            assertNotNull("game title art for ${m.id} has no db key to label it by", key)
            assertNotNull(gameTitleArtResForKey(key))
            val label = gameTitleLabelForKey(key!!)
            assertTrue("game title ${m.id} has no label", label.isNotBlank())
            // The label is the words on the art (the catalog title), never the raw key.
            assertEquals(m.title, label)
            assertNotEquals(key, label)
        }
        assertTrue("the game title registry is empty", withArt > 0)
    }

    @Test fun everyDayTitleHasALabel() {
        // 2026-10-05 is a Monday: one full week.
        repeat(7) { i ->
            val day = LocalDate.of(2026, 10, 5).plusDays(i.toLong()).toString()
            assertNotNull("no day art for $day", dayTitleArtRes(day, null))
            val label = titleCaseLabel(leaderboardTitle(day))
            assertTrue("day title for $day has no label", label.isNotBlank())
            assertNotEquals(label.uppercase(), label)
        }
        // A holiday keeps its text title (no art to label).
        assertNull(dayTitleArtRes("2026-10-31", "Halloween"))
    }

    @Test fun titleCaseLabelReadsLikeWords() {
        assertEquals("Friday’s Finest", titleCaseLabel("FRIDAY’S FINEST"))
    }
}
