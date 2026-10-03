package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The mascot fit system — parity with packages/core avatar-layout.ts (avatar-layout-fixtures.json carries its manifest). */
class AvatarLayoutFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/avatar-layout-fixtures.json")!!.readText()).jsonObject
    }
    private val m: AvatarFitManifest by lazy { AvatarFitManifest.of(root["manifest"])!! }

    private fun d(o: JsonObject, k: String) = (o[k] as JsonPrimitive).doubleOrNull!!
    private fun rect(o: JsonObject?) = AvatarRect(d(o!!, "x"), d(o, "y"), d(o, "w"), d(o, "h"))
    private fun close(a: AvatarRect, b: AvatarRect, msg: String) {
        assertEquals(msg, b.x, a.x, 1e-3); assertEquals(msg, b.y, a.y, 1e-3); assertEquals(msg, b.w, a.w, 1e-3); assertEquals(msg, b.h, a.h, 1e-3)
    }

    @Test
    fun layouts_match() {
        val cases = root["cases"]!!.jsonArray.map { it.jsonObject }
        assertTrue(cases.size >= 20)
        for ((i, r) in cases.withIndex()) {
            val c = validateAvatar(r["config"], AvatarConfig())
            val small = (r["small"] as JsonPrimitive).booleanOrNull!!
            val want = r["layout"]!!.jsonObject
            val got = AvatarFit.layout(c, small, m)
            assertEquals("case $i", d(want, "scale"), got.scale, 1e-3)
            close(got.body, rect(want["body"] as JsonObject), "case $i body")
            close(got.letter, rect(want["letter"] as JsonObject), "case $i letter")
            close(got.bounds, rect(want["bounds"] as JsonObject), "case $i bounds")
            val layers = want["layers"]!!.jsonArray.map { it.jsonObject }
            assertEquals("case $i order", layers.map { (it["art"] as JsonPrimitive).content }, got.layers.map { it.art })
            for ((g, w) in got.layers.zip(layers)) {
                close(g.rect, rect(w["rect"] as JsonObject), "case $i ${g.art}")
                assertEquals("case $i ${g.art} tint", (w["tint"] as JsonPrimitive).booleanOrNull, g.tint)
                assertEquals((w["layer"] as JsonPrimitive).content, g.layer)
            }
        }
    }

    @Test
    fun picks_match() {
        for ((i, r) in root["picks"]!!.jsonArray.map { it.jsonObject }.withIndex()) {
            val c = validateAvatar(r["config"], AvatarConfig())
            val field = (r["field"] as JsonPrimitive).content
            val id = (r["id"] as JsonPrimitive).content
            val hit = AvatarFit.pickConflict(c, field, id, m)
            val want = r["conflict"]
            if (want is JsonObject) {
                assertEquals("pick $i", (want["field"] as JsonPrimitive).content, hit?.first)
                assertEquals("pick $i", (want["id"] as JsonPrimitive).content, hit?.second)
            } else {
                assertTrue(want == null || want is JsonNull); assertNull("pick $i", hit)
            }
            assertEquals("pick $i", validateAvatar(r["result"], AvatarConfig()), AvatarFit.applyPick(c, field, id, m))
        }
    }

    @Test
    fun pattern_shapes_match() {
        for (r in root["patterns"]!!.jsonArray.map { it.jsonObject }) {
            val p = (r["pattern"] as JsonPrimitive).content
            val want = r["shapes"]!!.jsonArray.map { it.jsonObject }
            val got = AvatarFit.patternShapes(p)
            assertEquals(p, want.size, got.size)
            for ((g, w) in got.zip(want)) {
                val t = (w["t"] as JsonPrimitive).content
                when (g) {
                    is AvatarFit.Shape.Rect -> { assertEquals("rect", t); assertEquals(d(w, "x"), g.x, 1e-4); assertEquals(d(w, "y"), g.y, 1e-4); assertEquals(d(w, "h"), g.h, 1e-4) }
                    is AvatarFit.Shape.Circle -> { assertEquals("circle", t); assertEquals(d(w, "x"), g.x, 1e-4); assertEquals(d(w, "r"), g.r, 1e-4); assertEquals((w["c"] as JsonPrimitive).content, g.c) }
                    is AvatarFit.Shape.Star -> { assertEquals("star", t); assertEquals(d(w, "x"), g.x, 1e-4); assertEquals((w["n"] as JsonPrimitive).intOrNull, g.n) }
                    is AvatarFit.Shape.Heart -> { assertEquals("heart", t); assertEquals(d(w, "s"), g.s, 1e-4) }
                    is AvatarFit.Shape.Poly -> { assertEquals("poly", t); assertEquals((w["pts"] as JsonArray).size, g.pts.size) }
                    is AvatarFit.Shape.Grad -> { assertEquals("grad", t); assertEquals((w["stops"] as JsonArray).size, g.stops.size) }
                }
            }
        }
    }

    @Test
    fun cheeks_migrate() {
        val c = validateAvatar(Json.parseToJsonElement("""{"nose":"blush"}"""), AvatarConfig())
        assertEquals("blush", c.cheeks); assertEquals("none", c.nose)
    }
}
