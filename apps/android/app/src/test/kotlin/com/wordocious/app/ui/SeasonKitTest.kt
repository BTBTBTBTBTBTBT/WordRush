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

    /** 2.8 item 49: the seasonal sound slots are data (registry slots.sounds), so a future season needs no code. */
    @Test fun halloweenSoundSlots() {
        val h = seasons.first { it.id == Season.HALLOWEEN }
        assertEquals("intro-halloween", SeasonKit.introSound(h))
        assertEquals("note-h-w", SeasonKit.noteSound(h, "w"))
        assertEquals("note-h-o3", SeasonKit.noteSound(h, "o3"))
        // The core's prefix mirror agrees with the registry pattern for every cast member.
        for (id in com.wordocious.core.MusicalCast.CAST_IDS) {
            assertEquals(com.wordocious.core.MusicalCast.note(id, Season.HALLOWEEN)!!.sound, SeasonKit.noteSound(h, id))
        }
        // res/raw names: dashes become underscores under the sfx_ prefix.
        assertEquals("sfx_intro_halloween", SeasonKit.rawName("intro-halloween"))
        assertEquals("sfx_note_h_o1", SeasonKit.rawName("note-h-o1"))
    }

    @Test fun seasonsWithoutSoundSlotsKeepTheNormalSounds() {
        assertNull(SeasonKit.introSound(null))
        assertNull(SeasonKit.noteSound(null, "w"))
        for (s in seasons.filter { it.id != Season.HALLOWEEN }) {
            assertNull(s.id, SeasonKit.introSound(s))
            assertNull(s.id, SeasonKit.noteSound(s, "w"))
        }
    }

    /** Every cast note / intro the registry names has a shipped sample (res/raw), so the spooky voicing never falls back silently. */
    @Test fun seasonSoundFilesShip() {
        val raw = File("src/main/res/raw")
        for (s in seasons) {
            val names = listOfNotNull(SeasonKit.introSound(s)) + com.wordocious.core.MusicalCast.CAST_IDS.mapNotNull { SeasonKit.noteSound(s, it) }
            for (n in names) assertTrue("${s.id}: ${SeasonKit.rawName(n)}.m4a", File(raw, SeasonKit.rawName(n) + ".m4a").exists())
        }
    }
}
