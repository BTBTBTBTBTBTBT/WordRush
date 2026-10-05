package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Parity: packages/core avatar-season.ts (avatar-season-fixtures.json) against the app's bundled avatar-parts.json. */
class AvatarSeasonFixtureTest {
    private val app = File("../app/src/main")
    private val m: AvatarFitManifest by lazy { AvatarFitManifest.parse(File(app, "assets/avatar-parts.json").readText())!! }

    private data class P(val field: String, val id: String)
    private data class Avail(val part: P, val date: String, val preview: String?, val saved: Map<String, String>?, val available: Boolean)
    private data class Seasons(val field: String, val id: String, val season: String?)
    private data class Active(val date: String, val preview: String?, val season: String?)
    private data class Wears(val config: Map<String, String>?, val season: String?, val wears: Boolean)
    private data class Nudge(val date: String, val preview: String?, val config: Map<String, String>?, val seen: List<String>, val due: String?)
    private data class Key(val season: String, val date: String, val key: String, val tag: String)
    private data class F(val available: List<Avail>, val seasons: List<Seasons>, val active: List<Active>, val shelf: Map<String, List<P>>,
                         val wears: List<Wears>, val nudge: List<Nudge>, val keys: List<Key>)

    @Test fun matchesSharedFixture() {
        val raw = javaClass.classLoader!!.getResource("fixtures/avatar-season-fixtures.json")!!.readText(Charsets.UTF_8)
        val f = Gson().fromJson(raw, F::class.java)
        for (c in f.available) assertEquals("$c", c.available, AvatarSeason.isPartAvailable(AvatarPart(c.part.field, c.part.id), c.date, c.preview, c.saved, m))
        for (c in f.seasons) assertEquals(c.id, c.season, AvatarSeason.partSeason(c.field, c.id, m))
        for (c in f.active) assertEquals("$c", c.season, AvatarSeason.active(c.date, c.preview))
        assertEquals(f.shelf["halloween"]!!.map { AvatarPart(it.field, it.id) }, AvatarSeason.shelf("halloween", m))
        assertEquals(emptyList<AvatarPart>(), AvatarSeason.shelf(null, m))
        assertEquals(emptyList<AvatarPart>(), AvatarSeason.shelf("arbor-day", m))
        for (c in f.wears) assertEquals("$c", c.wears, AvatarSeason.wearsSeasonalPart(c.config, c.season, m))
        for (c in f.nudge) assertEquals("$c", c.due, AvatarSeason.nudgeDue(c.date, c.preview, c.config, c.seen, m))
        for (c in f.keys) { assertEquals(c.key, AvatarSeason.nudgeKey(c.season, c.date)); assertEquals(c.tag, AvatarSeason.tag(c.season)) }
    }

    @Test fun seasonalArtShips() {
        for (a in listOf("art_dress_tag_halloween", "art_av_acc_pumpkinhat", "art_av_acc_candypail", "art_av_acc_ghost_classic_pet")) {
            assertTrue(a, File(app, "res/drawable-nodpi/$a.webp").exists())
        }
    }
}
