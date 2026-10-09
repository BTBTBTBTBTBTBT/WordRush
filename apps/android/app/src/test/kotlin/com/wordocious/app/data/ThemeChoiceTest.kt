package com.wordocious.app.data

import com.wordocious.app.data.ThemeChoiceRules.Choice
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Parity with core theme-choice.ts: reads the shared theme-choice-fixtures.json. */
class ThemeChoiceTest {
    private val root: JsonObject = Json.parseToJsonElement(
        javaClass.classLoader!!.getResource("fixtures/theme-choice-fixtures.json")!!.readText(),
    ).jsonObject

    private fun str(e: JsonElement): String? = if (e is JsonNull) null else (e as JsonPrimitive).contentOrNull
    private fun bool(e: JsonElement): Boolean = (e as JsonPrimitive).boolean

    @Test fun `effective theme matches the shared fixture`() {
        for (row in root["effective"]!!.jsonArray) {
            val i = row.jsonObject["in"]!!.jsonArray
            val o = row.jsonObject["out"]!!.jsonArray
            val r = ThemeChoiceRules.effective(Choice(str(i[0])!!, str(i[1])), str(i[2]), bool(i[3]), str(i[4])!!)
            assertEquals("$i", str(o[0]), r.first)
            assertEquals("$i", bool(o[1]), r.second)
        }
    }

    @Test fun `pick matches the shared fixture`() {
        for (row in root["pick"]!!.jsonArray) {
            val i = row.jsonObject["in"]!!.jsonArray
            val o = row.jsonObject["out"]!!.jsonArray
            val r = ThemeChoiceRules.pick(Choice(str(i[0])!!, str(i[1])), str(i[2])!!, str(i[3]), str(i[4])!!)
            assertEquals("$i", str(o[0]), r.theme)
            assertEquals("$i", str(o[1]), r.seasonOptOut)
        }
    }

    @Test fun `row and end label match the shared fixture`() {
        for (row in root["showRow"]!!.jsonArray) {
            val i = row.jsonObject["in"]!!.jsonArray
            assertEquals(bool(row.jsonObject["out"]!!), ThemeChoiceRules.showSeasonalRow(str(i[0]), bool(i[1])))
        }
        for (row in root["endLabel"]!!.jsonArray) {
            assertEquals(str(row.jsonObject["out"]!!), ThemeChoiceRules.endLabel(str(row.jsonObject["in"]!!)!!))
        }
    }

    @Test fun `season end restores the previous theme`() {
        val c = ThemeChoiceRules.pick(Choice("ocean"), "seasonal", "halloween", "2026-10-12")
        assertTrue(ThemeChoiceRules.effective(c, "halloween", true, "2026-10-12").second)
        val after = ThemeChoiceRules.effective(c, null, true, "2026-11-01")
        assertEquals("ocean", after.first)
        assertFalse(after.second)
    }

    @Test fun `stored keys map to registry ids`() {
        assertEquals("default", ThemeChoiceRules.fromStored("light"))
        assertEquals("forest", ThemeChoiceRules.fromStored("forest"))
        assertEquals("light", ThemeChoiceRules.toStored("default"))
    }
}
