package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.float
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/** Item 46: the share hero's rules are the same as packages/core share-hero.ts (share-hero-fixtures.json). */
class ShareHeroFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/share-hero-fixtures.json")!!.readText()).jsonObject
    }

    @Test
    fun specsMatchTheSharedFixture() {
        val specs = root["specs"]!!.jsonArray
        assertEquals(ShareHero.Result.entries.size * 2, specs.size)
        for (s in specs) {
            val o = s.jsonObject
            val r = ShareHero.Result.of(o["result"]!!.jsonPrimitive.content)
            assertNotNull(o["result"].toString(), r)
            val h = o["halloween"]!!.jsonPrimitive.boolean
            val got = ShareHero.spec(r!!, h)
            assertEquals("$r $h", o["pose"]!!.jsonPrimitive.content, got.pose)
            assertEquals("$r $h", o["crown"]!!.jsonPrimitive.boolean, got.crown)
            assertEquals("$r $h", o["glow"]!!.jsonPrimitive.content, got.glow)
            assertEquals("$r $h", o["gold"]!!.jsonPrimitive.boolean, got.gold)
        }
    }

    @Test
    fun framesAndBandMatchTheFixture() {
        for ((k, v) in root["frames"]!!.jsonObject) {
            assertEquals(k, v.jsonObject["minH"]!!.jsonPrimitive.float, ShareHero.frames.getValue(k).first, 0f)
            assertEquals(k, v.jsonObject["maxH"]!!.jsonPrimitive.float, ShareHero.frames.getValue(k).second, 0f)
        }
        val hero = root["hero"]!!.jsonObject
        assertEquals(hero["height"]!!.jsonPrimitive.float, ShareHero.HEIGHT, 0f)
        assertEquals(hero["gap"]!!.jsonPrimitive.float, ShareHero.GAP, 0f)
        assertEquals(ShareHero.HEIGHT + ShareHero.GAP, ShareHero.band(true), 0f)
        assertEquals(0f, ShareHero.band(false), 0f)
    }

    @Test
    fun resultMapping() {
        assertEquals(ShareHero.Result.WIN, ShareHero.result(true))
        assertEquals(ShareHero.Result.LOSS, ShareHero.result(false))
        assertEquals(ShareHero.Result.NEUTRAL, ShareHero.result(null))
        assertEquals(
            listOf(ShareHero.Result.RANK1, ShareHero.Result.RANK2, ShareHero.Result.RANK3, ShareHero.Result.RANKED),
            listOf(1, 2, 3, 4).map { ShareHero.resultForRank(it) },
        )
    }
}
