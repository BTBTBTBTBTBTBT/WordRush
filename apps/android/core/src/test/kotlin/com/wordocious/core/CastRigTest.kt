package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * 2.7.1 cast puppets: Android reads the SAME rig bundle as web and iOS (byte-identical copies
 * written by ship-rigs.py) and draws the same frames as the reference evaluator
 * (rig-engine/rig-golden.json; web cast-rig.test.ts and iOS CastRigTests check it too).
 */
class CastRigTest {
    /** Gradle runs unit tests from the module dir (apps/android/core). */
    private val repo = File("../../..")
    private val droid = File(repo, "apps/android/app/src/main/res/raw/cast_rigs.json")
    private val bundle by lazy { CastRigBundle.parse(droid.readText()) }

    @Test fun sameBundleOnAllThreePlatforms() {
        val bytes = droid.readBytes()
        assertArrayEquals(bytes, File(repo, "apps/web/public/art/rig/cast-rigs.json").readBytes())
        assertArrayEquals(bytes, File(repo, "apps/ios/Wordocious/Resources/Assets.xcassets/cast-rigs.dataset/cast-rigs.json").readBytes())
    }

    @Test fun everyLayerShipsAndIsKept() {
        val keep = File(repo, "apps/android/app/src/main/res/raw/keep_rigs.xml").readText()
        assertEquals(listOf("w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"), bundle.cast)
        for (id in bundle.cast) {
            val rig = bundle.rigs.getValue(id)
            assertTrue(id, rig.gestureSeconds > 1)
            for (layer in rig.lay.keys) {
                val name = "rig_${id}_$layer".replace('-', '_')
                assertTrue(name, File(repo, "apps/android/app/src/main/res/drawable-nodpi/$name.webp").exists())
                assertTrue(name, keep.contains("@drawable/$name"))
            }
        }
    }

    @Test fun laughFadesInAndOut() {
        assertEquals(0.0, CastRig.kfVal(bundle.tap.laugh, 0.0), 1e-9)
        assertTrue(CastRig.kfVal(bundle.tap.laugh, 0.075) in 0.2..0.8)
        assertEquals(1.0, CastRig.kfVal(bundle.tap.laugh, 0.5), 1e-9)
        assertEquals(0.0, CastRig.kfVal(bundle.tap.laugh, 0.99), 1e-9)
    }

    @Test fun matchesGoldenFrames() {
        val golden = Json.parseToJsonElement(File(repo, "docs/design/brand/animation/rig-engine/rig-golden.json").readText()).jsonArray
        assertTrue(golden.size > 50)
        for (fe in golden) {
            val f = fe.jsonObject
            val id = f["id"]!!.jsonPrimitive.content
            val t = f["t"]!!.jsonPrimitive.doubleOrNull!!
            val g = f["g"]!!.takeUnless { it is JsonNull }?.jsonPrimitive?.doubleOrNull
            val tap = f["tap"]!!.takeUnless { it is JsonNull }?.jsonPrimitive?.doubleOrNull
            val still = f["still"]!!.jsonPrimitive.booleanOrNull!!
            val want = f["ops"]!!.jsonArray
            val ops = bundle.rigs.getValue(id).evaluate(bundle, t, g, tap, still)
            val at = "$id t=$t g=$g tap=$tap still=$still"
            assertEquals(at, want.map { it.jsonArray[0].jsonPrimitive.content }, ops.map { it.layer })
            ops.forEachIndexed { i, op ->
                val w = want[i].jsonArray
                val m = w[1].jsonArray.map { it.jsonPrimitive.doubleOrNull!! }
                for (k in 0 until 6) assertEquals("$at ${op.layer} m$k", m[k], op.m[k], 2e-3)
                assertEquals("$at ${op.layer} alpha", w[2].jsonPrimitive.doubleOrNull!!, op.alpha, 2e-3)
            }
        }
    }
}
