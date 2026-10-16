package com.wordocious.core

import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Share-card spoiler parity guard: every puzzle game's `clean` / `full` share model must come out byte-equal to
 * packages/core/src/share-spoilers.ts (share-spoilers-fixtures.json), and a clean model must never carry the answer.
 */
class ShareSpoilersFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/share-spoilers-fixtures.json")!!.readText()).jsonObject
    }

    /** `encodeDefaults` writes the `kind` tag; nulls are explicit by default, so the model and the fixture object print alike. */
    private val json = Json { encodeDefaults = true }

    private fun JsonElement?.str(): String = (this as JsonPrimitive).content
    private fun JsonElement?.strOrNull(): String? = (this as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
    private fun JsonElement?.strings(): List<String> = this!!.jsonArray.map { it.jsonPrimitive.content }
    private fun JsonElement?.ints(): List<Int> = this!!.jsonArray.map { it.jsonPrimitive.int }

    private fun <M> check(name: String, serializer: KSerializer<M>, answers: (JsonObject) -> List<String>, make: (JsonObject, ShareVariant) -> M) {
        val cases = root[name]!!.jsonArray.map { it.jsonObject }
        assertTrue(name, cases.isNotEmpty())
        cases.forEachIndexed { i, c ->
            val input = c["input"]!!.jsonObject
            for (variant in ShareVariant.values()) {
                val want = json.encodeToString(JsonElement.serializer(), c[variant.id]!!)
                val got = json.encodeToString(serializer, make(input, variant))
                assertEquals("$name #$i ${variant.id}", want, got)
            }
            val clean = json.encodeToString(serializer, make(input, ShareVariant.CLEAN))
            for (a in answers(input)) if (a.isNotEmpty()) assertFalse("$name #$i clean leaks $a", clean.contains(a))
        }
    }

    @Test
    fun variant_copy_matches() {
        assertEquals(root["variants"].strings(), ShareVariant.values().map { it.id })
        val subtitles = root["subtitles"]!!.jsonObject
        assertEquals(subtitles.keys, ShareSpoilers.SUBTITLES.keys)
        for ((mode, pair) in subtitles) {
            assertEquals(mode, pair.strings()[0], ShareSpoilers.SUBTITLES[mode]!!.first)
            assertEquals(mode, pair.strings()[1], ShareSpoilers.SUBTITLES[mode]!!.second)
        }
        assertEquals(root["defaultSubtitles"].strings(), ShareSpoilers.DEFAULT_SUBTITLES.toList())
        val copy = root["copy"]!!.jsonArray.map { it.jsonObject }
        assertTrue(copy.isNotEmpty())
        for (c in copy) {
            val mode = c["mode"].str()
            val got = ShareSpoilers.variantCopy(mode)
            val clean = c["clean"]!!.jsonObject; val full = c["full"]!!.jsonObject
            assertEquals(mode, clean["title"].str(), got.clean.title); assertEquals(mode, clean["subtitle"].str(), got.clean.subtitle)
            assertEquals(mode, full["title"].str(), got.full.title); assertEquals(mode, full["subtitle"].str(), got.full.subtitle)
        }
    }

    @Test
    fun starsweep_matches() = check("starsweep", StarsweepShareModel.serializer(), { listOf(it["board"].str()) }) { g, v ->
        starsweepShareModel(StarsweepShareInput(g["n"]!!.jsonPrimitive.int, g["regions"].str(), g["solution"].str(), g["board"].str()), v)
    }

    @Test
    fun sudocious_matches() = check("sudocious", SudociousShareModel.serializer(), { listOf(it["solution"].str()) }) { g, v ->
        sudociousShareModel(SudociousShareInput(g["givens"].str(), g["solution"].str(), g["board"].str()), v)
    }

    @Test
    fun crossword_matches() = check("crossword", CrosswordShareModel.serializer(), { listOf(it["solution"].str(), it["fill"].str()) }) { g, v ->
        crosswordShareModel(CrosswordShareInput(g["w"]!!.jsonPrimitive.int, g["h"]!!.jsonPrimitive.int, g["solution"].str(), g["fill"].str()), v)
    }

    private fun groups(o: JsonObject): List<GroupsGroup> =
        o["groups"]!!.jsonArray.map { it.jsonObject }.map { GroupsGroup(it["tier"]!!.jsonPrimitive.int, it["label"].str(), it["words"].strings()) }

    @Test
    fun kindred_matches() = check("kindred", KindredShareModel.serializer(), { o -> groups(o).flatMap { it.words + it.label } }) { g, v ->
        kindredShareModel(KindredShareInput(groups(g), g["solvedTiers"].ints(), g["mistakes"]!!.jsonPrimitive.int), v)
    }

    private fun placements(o: JsonObject): List<WordsearchPlacement> =
        o["words"]!!.jsonArray.map { it.jsonObject }.map { WordsearchPlacement(it["w"].str(), it["r"]!!.jsonPrimitive.int, it["c"]!!.jsonPrimitive.int, it["d"].str()) }

    @Test
    fun spyglass_matches() = check("spyglass", SpyglassShareModel.serializer(), { o -> listOf(o["grid"].str()) + placements(o).map { it.w } }) { g, v ->
        spyglassShareModel(SpyglassShareInput(g["grid"].str(), placements(g), g["found"].strings()), v)
    }

    @Test
    fun hubbub_matches() = check("hubbub", HubbubShareModel.serializer(), { it["found"].strings() }) { g, v ->
        hubbubShareModel(
            HubbubShareInput(
                g["letters"].str(), g["found"].strings(), g["points"]!!.jsonPrimitive.int, g["max"]!!.jsonPrimitive.int,
                g["wordCount"]!!.jsonPrimitive.int, g["pangramCount"]!!.jsonPrimitive.int,
            ),
            v,
        )
    }

    @Test
    fun muddle_matches() = check("muddle", MuddleShareModel.serializer(), { it["words"].strings() + it["final"].str() + (it["caption"].strOrNull() ?: "") }) { g, v ->
        muddleShareModel(
            MuddleShareInput(
                g["words"].strings(), g["final"].str(), g["solved"]!!.jsonArray.map { it.jsonPrimitive.boolean },
                g["checks"]!!.jsonPrimitive.int, g["mistakes"]!!.jsonPrimitive.int, g["hintsUsed"]!!.jsonPrimitive.int,
            ),
            v, g["caption"].strOrNull(),
        )
    }

    @Test
    fun ladder_matches() = check("ladder", LadderShareModel.serializer(), { it["words"].strings() }) { g, v ->
        ladderShareModel(
            LadderShareInput(g["start"].str(), g["end"].str(), g["words"].strings(), g["hintMask"].str(), g["par"]!!.jsonPrimitive.int, g["moves"]!!.jsonPrimitive.int),
            v,
        )
    }

    @Test
    fun codebreaker_matches() = check("codebreaker", CodebreakerShareModel.serializer(), { listOf(it["text"].str()) }) { g, v ->
        codebreakerShareModel(
            CodebreakerShareInput(g["text"].str(), g["correct"]!!.jsonPrimitive.int, g["total"]!!.jsonPrimitive.int, g["checks"]!!.jsonPrimitive.int, g["solved"]!!.jsonPrimitive.boolean),
            v,
        )
    }

    @Test
    fun codebreaker_shapes_match() {
        val shapes = root["shapes"]!!.jsonArray.map { it.jsonObject }
        assertTrue(shapes.isNotEmpty())
        for (s in shapes) assertEquals(s["text"].str(), s["shape"].ints(), ShareSpoilers.codebreakerShape(s["text"].str()))
    }

    /** A muddle with no caption, or an empty one, keeps `caption` null in both variants. */
    @Test
    fun muddle_caption_null_when_missing() {
        val g = MuddleShareInput(listOf("A", "B", "C", "D"), "E F", listOf(true), 1, 0, 0)
        assertNull(muddleShareModel(g, ShareVariant.FULL).caption)
        assertNull(muddleShareModel(g, ShareVariant.FULL, "").caption)
        assertNull(muddleShareModel(g, ShareVariant.CLEAN, "Hi").caption)
        assertEquals("Hi", muddleShareModel(g, ShareVariant.FULL, "Hi").caption)
        assertEquals(listOf(true, false, false, false, false), muddleShareModel(g, ShareVariant.FULL).solved)
    }
}
