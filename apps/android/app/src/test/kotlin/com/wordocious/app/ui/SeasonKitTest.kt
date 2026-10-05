package com.wordocious.app.ui

import com.wordocious.core.Season
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The season registry (assets/season-registry.json, the copy of packages/core/src/season-registry.json). */
class SeasonKitTest {
    private val json = File("src/main/assets/season-registry.json").readText()
    private val seasons = SeasonKit.parse(json)

    @Test fun registryMatchesTheCoreWindows() {
        assertEquals(Season.ids, seasons.map { it.id })
    }

    @Test fun halloweenSlotsAndHalloweenCrops() {
        val h = seasons.first { it.id == Season.HALLOWEEN }
        assertEquals("art-title-halloween-dailies", SeasonKit.lookup(h.titles, "art-titlecast-dailies"))
        assertEquals("art-wall-halloween-games", SeasonKit.lookup(h.walls, "art-wall-game-quordle"))
        assertNull(SeasonKit.lookup(h.titles, "art-titlecast-settings"))
        assertEquals("art-scene-banner-halloween", h.banner)
        assertEquals(4, h.props.size)
        // The registry's measured boxes are the ones the cast row has always used.
        for (id in MascotId.entries) {
            val c = SeasonSkins.halloweenCrops.getValue(id)
            assertEquals(listOf(c.left, c.top, c.right, c.bottom), h.castTrim[id.name.lowercase()])
        }
        assertTrue(h.castSize == SeasonSkins.HALLOWEEN_SOURCE)
    }
}
