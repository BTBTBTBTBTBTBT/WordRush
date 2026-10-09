package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The musical cast easter egg (docs/cloud-prompts/10): [MusicalCast] must match packages/core/src/musical-cast.ts
 * case for case (musical-cast-fixtures.json; web musical-cast.test.ts and iOS read the same file).
 */
class MusicalCastFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText(Charsets.UTF_8)

    private val f: JsonObject by lazy { Json.parseToJsonElement(loadFixture("musical-cast-fixtures.json")).jsonObject }
    private fun ints(o: JsonObject, k: String) = o[k]!!.jsonArray.map { it.jsonPrimitive.int }

    @Test fun flag_on_in_debug_off_in_release() {
        assertTrue(MusicalCast.enabled(true))
        assertFalse(MusicalCast.enabled(false))
    }

    @Test fun scale_timing_gap() {
        assertEquals(ints(f, "scale"), MusicalCast.SCALE)
        val t = f["timing"]!!.jsonObject
        assertEquals(t["longPressMs"]!!.jsonPrimitive.long, MusicalTiming.longPressMs)
        assertEquals(t["moveSlop"]!!.jsonPrimitive.int, MusicalTiming.moveSlop)
        assertEquals(t["staggerMs"]!!.jsonPrimitive.long, MusicalTiming.staggerMs)
        assertEquals(t["popMs"]!!.jsonPrimitive.long, MusicalTiming.popMs)
        assertEquals(f["gapMs"]!!.jsonPrimitive.long, MusicalCast.MELODY_GAP_MS)
    }

    @Test fun pop_keys() {
        val keys = f["popKeys"]!!.jsonArray.map { it.jsonObject }
        assertEquals(keys.size, MusicalCast.POP_KEYS.size)
        keys.forEachIndexed { i, k ->
            val g = MusicalCast.POP_KEYS[i]
            assertEquals(k["t"]!!.jsonPrimitive.double, g.t, 1e-12)
            assertEquals(k["sx"]!!.jsonPrimitive.double, g.sx, 1e-12)
            assertEquals(k["sy"]!!.jsonPrimitive.double, g.sy, 1e-12)
            assertEquals(k["lift"]!!.jsonPrimitive.double, g.lift, 1e-12)
            assertEquals(g.sx, MusicalCast.popAt(g.t).sx, 1e-9)
            assertEquals(g.sy, MusicalCast.popAt(g.t).sy, 1e-9)
        }
    }

    @Test fun melodies_and_secrets() {
        val ms = f["melodies"]!!.jsonArray.map { it.jsonObject }
        assertEquals(ms.size, MusicalCast.MELODIES.size)
        ms.forEachIndexed { i, m ->
            val g = MusicalCast.MELODIES[i]
            assertEquals(m["id"]!!.jsonPrimitive.content, g.id)
            assertEquals(m["name"]!!.jsonPrimitive.content, g.name)
            assertEquals(m["achievement"]!!.jsonPrimitive.content, g.achievement)
            assertEquals(ints(m, "notes"), g.notes)
            assertEquals(ints(m, "intervals"), MusicalCast.melodyIntervals(g.notes))
            // Every note is on a cast key.
            assertTrue(g.id, g.notes.all { it in MusicalCast.SCALE })
        }
        val secrets = f["secrets"]!!.jsonArray.map { it.jsonPrimitive.content }
        assertEquals(secrets, MusicalCast.ACHIEVEMENT_KEYS)
        assertEquals(secrets, SECRET_ACHIEVEMENT_KEYS)
    }

    /** A fixture's nullable string (absent / JSON null → null). */
    private fun JsonObject.str(k: String): String? = this[k]?.takeIf { it !is JsonNull }?.jsonPrimitive?.contentOrNull

    // ── Halloween (item 49): the season's tunes, spooky voicing and season-aware matching ──────────────────────

    @Test fun halloween_melodies_todo_and_prefix() {
        val h = f["halloween"]!!.jsonObject
        val ms = h["melodies"]!!.jsonArray.map { it.jsonObject }
        assertEquals(ms.size, MusicalCast.HALLOWEEN_MELODIES.size)
        ms.forEachIndexed { i, m ->
            val g = MusicalCast.HALLOWEEN_MELODIES[i]
            assertEquals(m["id"]!!.jsonPrimitive.content, g.id)
            assertEquals(m["name"]!!.jsonPrimitive.content, g.name)
            assertEquals(m["achievement"]!!.jsonPrimitive.content, g.achievement)
            assertEquals(ints(m, "notes"), g.notes)
            assertEquals(ints(m, "intervals"), MusicalCast.melodyIntervals(g.notes))
            assertTrue(g.id, g.notes.all { it in MusicalCast.SCALE })
        }
        assertEquals(h["todo"]!!.jsonArray.map { it.jsonPrimitive.content }, MusicalCast.HALLOWEEN_TUNES_TODO)
        val prefixes = h["notePrefix"]!!.jsonObject.mapValues { it.value.jsonPrimitive.content }
        assertEquals(prefixes, MusicalCast.SEASON_NOTE_PREFIX)
    }

    @Test fun halloween_sounds_per_season() {
        for (e in f["halloween"]!!.jsonObject["sounds"]!!.jsonArray.map { it.jsonObject }) {
            val season = e.str("season")
            val id = e["id"]!!.jsonPrimitive.content
            assertEquals("$season/$id", e.str("sound"), MusicalCast.note(id, season)?.sound)
        }
    }

    @Test fun halloween_active_melodies_per_season() {
        for (e in f["halloween"]!!.jsonObject["active"]!!.jsonArray.map { it.jsonObject }) {
            val season = e.str("season")
            assertEquals("$season", e["ids"]!!.jsonArray.map { it.jsonPrimitive.content }, MusicalCast.activeMelodies(season).map { it.id })
        }
    }

    @Test fun halloween_taps_are_season_aware() {
        for (c in f["halloween"]!!.jsonObject["taps"]!!.jsonArray.map { it.jsonObject }) {
            val name = c["name"]!!.jsonPrimitive.content
            val season = c.str("season")
            var state = MusicalCast.MELODY_START
            c["steps"]!!.jsonArray.forEachIndexed { i, se ->
                val s = se.jsonObject
                val r = MusicalCast.melodyTap(state, s["id"]!!.jsonPrimitive.content, s["at"]!!.jsonPrimitive.long, season)
                val label = "$name step $i"
                assertEquals(label, s["midi"]!!.jsonPrimitive.intOrNull, r.note?.midi)
                assertEquals(label, s.str("sound"), r.note?.sound)
                assertEquals(label, s.str("matched"), r.matched?.id)
                state = r.state
            }
        }
    }

    @Test fun secrets_match_the_achievement_catalog() {
        val catalog = Json.parseToJsonElement(loadFixture("achievement-rules-fixtures.json")).jsonObject["catalog"]!!.jsonArray
        val secret = catalog.map { it.jsonObject }.filter { it["secret"]?.jsonPrimitive?.booleanOrNull == true }
        assertEquals(SECRET_ACHIEVEMENT_KEYS, secret.map { it["key"]!!.jsonPrimitive.content })
        for (a in secret) {
            assertEquals("mascot", a["category"]!!.jsonPrimitive.content)
            assertEquals("sparkles", a["icon"]!!.jsonPrimitive.content)
            assertNull(a["hidden"])
        }
    }

    @Test fun notes() {
        for (e in f["notes"]!!.jsonArray.map { it.jsonObject }) {
            val id = e["id"]!!.jsonPrimitive.content
            val want = e["note"]
            val got = MusicalCast.note(id)
            if (want == null || want is JsonNull) { assertNull(id, got); continue }
            val n = want.jsonObject
            assertEquals(MusicalNote(
                n["castId"]!!.jsonPrimitive.content, n["index"]!!.jsonPrimitive.int, n["midi"]!!.jsonPrimitive.int,
                n["name"]!!.jsonPrimitive.content, n["sound"]!!.jsonPrimitive.content,
            ), got)
        }
        assertNull(MusicalCast.note("zz"))
    }

    @Test fun names() {
        for (e in f["names"]!!.jsonArray.map { it.jsonObject }) {
            val midi = e["midi"]!!.jsonPrimitive.int
            assertEquals("$midi", e["name"]!!.jsonPrimitive.content, MusicalCast.midiNoteName(midi))
        }
    }

    @Test fun transform() {
        for (e in f["transform"]!!.jsonArray.map { it.jsonObject }) {
            val id = e["id"]!!.jsonPrimitive.content
            val reduce = e["reduce"]!!.jsonPrimitive.booleanOrNull!!
            assertEquals("$id/$reduce", e["delays"]!!.jsonArray.map { it.jsonPrimitive.long }, MusicalCast.transformDelays(id, reduce))
            assertEquals("$id/$reduce", e["duration"]!!.jsonPrimitive.long, MusicalCast.transformDuration(id, reduce))
        }
    }

    @Test fun taps() {
        for (c in f["taps"]!!.jsonArray.map { it.jsonObject }) {
            val name = c["name"]!!.jsonPrimitive.content
            var state = MusicalCast.MELODY_START
            c["steps"]!!.jsonArray.forEachIndexed { i, se ->
                val s = se.jsonObject
                val r = MusicalCast.melodyTap(state, s["id"]!!.jsonPrimitive.content, s["at"]!!.jsonPrimitive.long)
                val label = "$name step $i"
                assertEquals(label, s["midi"]!!.jsonPrimitive.intOrNull, r.note?.midi)
                assertEquals(label, s["matched"]!!.jsonPrimitive.contentOrNull, r.matched?.id)
                assertEquals(label, s["buffered"]!!.jsonPrimitive.int, r.state.notes.size)
                state = r.state
            }
        }
    }

    @Test fun matches() {
        for (e in f["matches"]!!.jsonArray.map { it.jsonObject }) {
            val played = ints(e, "played")
            assertEquals("$played", e["matched"]!!.jsonPrimitive.contentOrNull, MusicalCast.matchMelody(played)?.id)
        }
    }

    @Test fun listed() {
        for (e in f["listed"]!!.jsonArray.map { it.jsonObject }) {
            val a = e["a"]!!.jsonObject
            val unlocked = e["unlocked"]!!.jsonArray.map { it.jsonPrimitive.content }.toSet()
            val got = achievementListed(
                hidden = a["hidden"]?.jsonPrimitive?.booleanOrNull == true,
                secret = a["secret"]?.jsonPrimitive?.booleanOrNull == true,
                key = a["key"]!!.jsonPrimitive.content,
                unlocked = { it in unlocked },
            )
            assertEquals("$a / $unlocked", e["listed"]!!.jsonPrimitive.booleanOrNull, got)
        }
    }
}
