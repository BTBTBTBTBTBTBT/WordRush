package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Parity guard for pocket How to Play + first-play decisions (packages/core/src/pocket-help.ts). */
class PocketHelpFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/pocket-help-fixtures.json")!!.readText()).jsonObject
    }

    private fun JsonElement?.strOrNull(): String? = (this as? JsonPrimitive)?.takeIf { this !is JsonNull }?.contentOrNull
    private fun JsonElement?.strings(): List<String> = (this as? JsonArray)?.map { it.jsonPrimitive.content } ?: emptyList()

    @Test
    fun help_cards_match_byte_for_byte() {
        assertEquals(PocketHelp.FIRST_PLAY_FLAG, root["flag"].strOrNull())
        val help = root["help"]!!.jsonObject
        assertEquals(FRIENDLY_KINDS.size, help.size)
        for (kind in FRIENDLY_KINDS) {
            val want = help[kind.raw]!!.jsonObject
            val got = PocketHelp.POCKET_HELP.getValue(kind)
            assertEquals(want["key"].strOrNull(), got.key)
            assertEquals(want["title"].strOrNull(), got.title)
            assertEquals(want["win"].strOrNull(), got.win)
            assertEquals(want["turns"].strOrNull(), got.turns)
            val steps = want["steps"]!!.jsonArray
            assertEquals(steps.size, got.steps.size)
            steps.forEachIndexed { i, st ->
                val o = st.jsonObject
                assertEquals(o["text"].strOrNull(), got.steps[i].text)
                assertEquals(o["picture"]!!.jsonObject["art"].strings(), got.steps[i].picture.art)
                assertEquals(o["picture"]!!.jsonObject["joiners"].strings(), got.steps[i].picture.joiners)
            }
            assertEquals(PocketHelp.pocketTutorialKey(kind), got.key)
        }
        assertEquals(root["keys"].strings(), FRIENDLY_KINDS.map { PocketHelp.pocketTutorialKey(it) })
    }

    @Test
    fun auto_show_decisions_match() {
        val decisions = root["decisions"]!!.jsonArray
        assertTrue(decisions.isNotEmpty())
        for (d in decisions) {
            val o = d.jsonObject
            val seen = (o["seen"] as? JsonArray)?.map { it.jsonPrimitive.content }
            assertEquals("decision $o", o["show"]!!.jsonPrimitive.boolean, PocketHelp.shouldAutoShowTutorial(o["live"]!!.jsonPrimitive.boolean, seen, o["key"]!!.jsonPrimitive.content))
        }
    }

    @Test
    fun existing_player_decisions_match() {
        val rows = root["withResults"]!!.jsonArray
        assertTrue(rows.isNotEmpty())
        for (d in rows) {
            val o = d.jsonObject
            val seen = (o["seen"] as? JsonArray)?.map { it.jsonPrimitive.content }
            val live = o["live"]!!.jsonPrimitive.boolean
            val key = o["key"]!!.jsonPrimitive.content
            val has = o["hasResults"]!!.jsonPrimitive.boolean
            assertEquals("show $o", o["show"]!!.jsonPrimitive.boolean, PocketHelp.shouldAutoShowTutorial(live, seen, key, has))
            assertEquals("record $o", o["record"]!!.jsonPrimitive.boolean, PocketHelp.tutorialShouldRecordSeen(live, seen, key, has))
        }
    }

    @Test
    fun seen_list_math_matches() {
        for (c in root["seen"]!!.jsonArray) {
            val o = c.jsonObject
            assertEquals("seen $o", o["result"].strings(), PocketHelp.withTutorialSeen(o["seen"].strings(), o["key"]!!.jsonPrimitive.content))
        }
        for (c in root["merged"]!!.jsonArray) {
            val o = c.jsonObject
            assertEquals("merged $o", o["result"].strings(), PocketHelp.mergeTutorialsSeen(o["a"].strings(), o["b"].strings()))
        }
    }
}
