package com.wordocious.app.ui

import com.wordocious.core.Season
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import androidx.compose.ui.graphics.toArgb
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

    /** Time of day (10-16): walls / stage are a string OR {night, morning, day, evening}; the REAL asset must parse with every season. */
    @Test fun realRegistryParsesWithTimeOfDaySlots() {
        val byId = seasons.associateBy { it.id }
        val h = byId.getValue("halloween")
        val t = byId.getValue("thanksgiving")
        assertEquals("art-celebration-stage-halloween", h.stage)
        assertEquals("art-celebration-stage-thanksgiving", t.stage)
        assertEquals("art-celebration-stage-thanksgiving-morning", t.stageTod["morning"])
        assertEquals("art-celebration-stage-thanksgiving-day", t.stageTod["day"])
        assertEquals("art-celebration-stage-thanksgiving-evening", t.stageTod["evening"])
        // night = the base art in `walls`; the other times ride in wallsTod.
        assertEquals("art-wall-thanksgiving-home", t.walls["art-wall-home"])
        assertEquals("art-wall-thanksgiving-home-morning", t.wallsTod.getValue("art-wall-home")["morning"])
        assertEquals("art-wall-halloween-home", h.walls["art-wall-home"])
        assertEquals("art-wall-halloween-home-evening", h.wallsTod.getValue("art-wall-home")["evening"])
        assertEquals("art-wall-thanksgiving-home", SeasonKit.lookup(t.walls, "art-wall-home"))
    }

    @Test fun surfacesByTimeOfDayMergePartiallyAndKeepTheCardTone() {
        val t = seasons.first { it.id == "thanksgiving" }
        val night = SeasonKit.surfacesAt(t, com.wordocious.core.TimeOfDay.Night)!!
        val morning = SeasonKit.surfacesAt(t, com.wordocious.core.TimeOfDay.Morning)!!
        val day = SeasonKit.surfacesAt(t, com.wordocious.core.TimeOfDay.Day)!!
        val evening = SeasonKit.surfacesAt(t, com.wordocious.core.TimeOfDay.Evening)!!
        assertTrue(night === t.surfaces)
        assertTrue(night.dark && morning.dark && day.dark && evening.dark) // tone "light" never flips the card tone
        assertTrue(day.wallInkDark && morning.wallInkDark && !night.wallInkDark && !evening.wallInkDark) // registry: morning + day skies are light
        assertEquals(0xFF4A3049.toInt(), morning.card!!.toArgb())
        assertEquals(0.9f, morning.cardOpacity, 0.001f)
        // evening overrides no cardOpacity: the base's is kept; its headline (not in tod) is the base's.
        assertEquals(night.cardOpacity, evening.cardOpacity, 0.0001f)
        assertEquals(night.headline, evening.headline)
        assertEquals(0xFFE6C4B2.toInt(), evening.textMuted!!.toArgb())
        assertEquals(night.text, evening.text)
    }

    @Test fun surfaceLerpEndsExactAndMidpointMixes() {
        val t = seasons.first { it.id == "thanksgiving" }
        val a = t.surfaces!!
        val b = SeasonKit.surfacesAt(t, com.wordocious.core.TimeOfDay.Day)!!
        assertEquals(a, com.wordocious.app.ui.theme.SeasonSurfaces.lerp(a, b, 0f))
        assertEquals(b, com.wordocious.app.ui.theme.SeasonSurfaces.lerp(a, b, 1f))
        val mid = com.wordocious.app.ui.theme.SeasonSurfaces.lerp(a, b, 0.5f)
        assertTrue(mid.card != a.card && mid.card != b.card)
    }
}
