package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Poses + the living mascot — parity with packages/core avatar-pose.ts and the posed path of avatar-layout.ts
 * (avatar-pose-fixtures.json carries its own poses `data`; the fit manifest comes from avatar-layout-fixtures.json).
 */
class AvatarPoseFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/avatar-pose-fixtures.json")!!.readText()).jsonObject
    }
    private val data: AvatarPosesData by lazy { AvatarPosesData.of(root["data"])!! }
    private val manifest: AvatarFitManifest by lazy {
        val layout = Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/avatar-layout-fixtures.json")!!.readText()).jsonObject
        AvatarFitManifest.of(layout["manifest"])!!
    }

    private val tol = 1e-9

    private fun d(e: JsonElement?): Double = (e as JsonPrimitive).doubleOrNull!!
    private fun str(e: JsonElement?): String = (e as JsonPrimitive).content
    private fun mat(e: JsonElement?): List<Double> = e!!.jsonArray.map { d(it) }

    private fun closeMat(msg: String, want: List<Double>, got: List<Double>) {
        assertEquals("$msg size", 6, got.size)
        for (i in 0 until 6) assertEquals("$msg[$i]", want[i], got[i], tol)
    }

    private fun closeRect(msg: String, want: JsonObject, got: AvatarRect) {
        assertEquals("$msg.x", d(want["x"]), got.x, tol); assertEquals("$msg.y", d(want["y"]), got.y, tol)
        assertEquals("$msg.w", d(want["w"]), got.w, tol); assertEquals("$msg.h", d(want["h"]), got.h, tol)
    }

    /** A fixture spec object → the Kotlin spec (missing fields stay null, like the TS `?? default`). */
    private fun spec(o: JsonObject): AvatarPoseSpec = AvatarPosesData.spec(o)

    private fun assertSpec(msg: String, want: JsonObject, got: AvatarPoseSpec) {
        val arms = want["arms"]!!.jsonObject
        for ((side, limb) in listOf("L" to got.armL!!, "R" to got.armR!!)) {
            val w = arms[side]!!.jsonObject
            assertEquals("$msg arms.$side.rot", d(w["rot"]), limb.rot!!, tol)
            assertEquals("$msg arms.$side.dx", d(w["dx"]), limb.dx!!, tol)
            assertEquals("$msg arms.$side.dy", d(w["dy"]), limb.dy!!, tol)
        }
        val b = want["body"]!!.jsonObject
        assertEquals("$msg body.dy", d(b["dy"]), got.body!!.dy!!, tol)
        assertEquals("$msg body.rot", d(b["rot"]), got.body.rot!!, tol)
        assertEquals("$msg body.sx", d(b["sx"]), got.body.sx!!, tol)
        assertEquals("$msg body.sy", d(b["sy"]), got.body.sy!!, tol)
        val f = want["feet"]!!.jsonObject
        assertEquals("$msg feet.dy", d(f["dy"]), got.feet!!.dy!!, tol)
        assertEquals("$msg feet.sx", d(f["sx"]), got.feet.sx!!, tol)
        assertEquals("$msg feet.sy", d(f["sy"]), got.feet.sy!!, tol)
    }

    private fun assertLayout(msg: String, want: JsonObject, got: AvatarLayout) {
        assertEquals("$msg scale", d(want["scale"]), got.scale, tol)
        closeRect("$msg body", want["body"]!!.jsonObject, got.body)
        closeRect("$msg letter", want["letter"]!!.jsonObject, got.letter)
        closeRect("$msg bounds", want["bounds"]!!.jsonObject, got.bounds)
        assertEquals("$msg letterIndex", str(want["letterIndex"]).toInt(), got.letterIndex)
        val layers = want["layers"]!!.jsonArray.map { it.jsonObject }
        assertEquals("$msg order", layers.map { str(it["art"]) }, got.layers.map { it.art })
        for ((g, w) in got.layers.zip(layers)) {
            val k = "$msg ${g.art}"
            closeRect(k, w["rect"]!!.jsonObject, g.rect)
            assertEquals("$k layer", str(w["layer"]), g.layer)
            assertEquals("$k field", str(w["field"]), g.field)
            assertEquals("$k id", str(w["id"]), g.id)
            assertEquals("$k tint", (w["tint"] as JsonPrimitive).booleanOrNull, g.tint)
            if (w["m"] == null) assertNull("$k m", g.m) else closeMat("$k m", mat(w["m"]), g.m!!)
            if (w["ride"] == null) assertNull("$k ride", g.ride) else assertEquals("$k ride", str(w["ride"]), g.ride)
        }
        val lm = want["letterM"]
        if (lm == null) assertNull("$msg letterM", got.letterM) else closeMat("$msg letterM", mat(lm), got.letterM!!)
        val pose = want["pose"]?.jsonObject
        if (pose == null) {
            assertNull("$msg pose", got.pose)
        } else {
            val gp = got.pose!!
            assertEquals("$msg pose.id", str(pose["id"]), gp.id)
            val parts = pose["parts"]!!.jsonObject
            assertEquals(setOf("root", "armL", "armR", "handL", "handR", "feet"), parts.keys)
            for (k in parts.keys) closeMat("$msg pose.$k", mat(parts[k]), gp.parts[k])
        }
    }

    @Test
    fun flag_and_constants_match() {
        val flag = root["flag"]!!.jsonObject
        assertEquals((flag["livingMascot"] as JsonPrimitive).booleanOrNull, AvatarLiveConfig.LIVING_MASCOT)
        assertEquals(str(flag["maxAnimated"]).toInt(), AvatarLiveConfig.MAX_ANIMATED)
        assertEquals((flag["androidIdleStill"] as JsonPrimitive).booleanOrNull, AvatarLiveConfig.ANDROID_IDLE_STILL)
        assertEquals(root["poses"]!!.jsonArray.map { str(it) }, AvatarPoses.IDS)
        val rp = root["reactionPose"]!!.jsonObject
        assertEquals(rp.keys, AvatarReaction.entries.map { it.id }.toSet())
        for (r in AvatarReaction.entries) assertEquals(str(rp[r.id]), AvatarPoses.REACTION_POSE[r])
        // the flag off: the default layout pose is none
        assertNull(AvatarFit.defaultPose)
        // every rigged body has a laugh rate
        for (body in data.rigs.keys) assertNotNull(body, AvatarPoses.LAUGH_RATE[body])
    }

    @Test
    fun data_parses() {
        assertEquals(AvatarPoses.IDS.drop(1).toSet(), data.poses.keys)
        assertEquals(AvatarOptions.BODIES.toSet(), data.rigs.keys)
        assertEquals("L", data.poses["wave"]!!.live!!.wave!!.limb)
        assertTrue(data.needsHandArt.isNotEmpty())
        // the bundled asset is the same file
        val asset = java.io.File("../app/src/main/assets/avatar-poses.json").takeIf { it.exists() }
        if (asset != null) {
            val bundled = AvatarPosesData.parse(asset.readText())!!
            assertEquals(data.poses, bundled.poses)
            assertEquals(data.rigs, bundled.rigs)
            assertEquals(data.withheld, bundled.withheld)
        }
    }

    @Test
    fun matrices_match() {
        val rows = root["matrices"]!!.jsonArray.map { it.jsonObject }
        assertEquals(data.rigs.size * (AvatarPoses.IDS.size - 1), rows.size)
        for (r in rows) {
            val body = str(r["body"]); val pose = str(r["pose"])
            val got = AvatarPoses.matrices(data.rigs.getValue(body), data.poses.getValue(pose).spec)
            val m = r["m"]!!.jsonObject
            assertEquals(setOf("root", "base", "armL", "armR", "handL", "handR", "feet"), m.keys)
            for (k in m.keys) closeMat("$body/$pose.$k", mat(m[k]), got[k])
        }
    }

    @Test
    fun live_frames_match() {
        val rows = root["frames"]!!.jsonArray.map { it.jsonObject }
        assertTrue(rows.size >= 20)
        for ((i, r) in rows.withIndex()) {
            val inp = r["input"]!!.jsonObject
            fun opt(k: String) = inp[k]?.takeUnless { it is JsonNull }?.let { d(it) }
            val rx = inp["reaction"]?.takeUnless { it is JsonNull }?.jsonObject?.let { AvatarReactionPlay(AvatarReaction.of(str(it["kind"]))!!, d(it["t"])) }
            val input = AvatarLiveInput(
                pose = str(inp["pose"]), t = d(inp["t"]), tap = opt("tap"), reaction = rx, press = opt("press"),
                still = (inp["still"] as? JsonPrimitive)?.booleanOrNull ?: false,
                ambient = (inp["ambient"] as? JsonPrimitive)?.booleanOrNull ?: true,
                blinkSeed = opt("blinkSeed"),
            )
            val got = AvatarPoses.liveFrame(input, data)
            val want = r["frame"]!!.jsonObject
            assertSpec("frame $i", want["spec"]!!.jsonObject, got.spec)
            assertEquals("frame $i eyes", d(want["eyes"]), got.eyes, tol)
            assertEquals("frame $i laugh", d(want["laugh"]), got.laugh, tol)
        }
    }

    @Test
    fun layouts_match() {
        val rows = root["layouts"]!!.jsonArray.map { it.jsonObject }
        assertTrue(rows.size >= 8)
        for ((i, r) in rows.withIndex()) {
            val c = validateAvatar(r["config"], AvatarConfig())
            assertEquals("case $i pose saved", str(r["config"]!!.jsonObject["pose"]), c.pose)
            assertLayout("case $i saved", r["saved"]!!.jsonObject, AvatarFit.layout(c, false, manifest, AvatarLayoutPose.Saved, poses = data))
            assertLayout("case $i saved(id)", r["saved"]!!.jsonObject, AvatarFit.layout(c, false, manifest, AvatarLayoutPose.Id("saved"), poses = data))
            assertLayout("case $i small", r["small"]!!.jsonObject, AvatarFit.layout(c, true, manifest, AvatarLayoutPose.Saved, poses = data))
            val spec = AvatarPoses.liveFrame(AvatarLiveInput(pose = c.pose, t = 1.7, tap = 0.3), data).spec
            val live = AvatarFit.layout(c, false, manifest, AvatarLayoutPose.Live(c.pose, spec), poses = data)
            assertLayout("case $i live", r["live"]!!.jsonObject, live)
            assertLayout("case $i none", r["none"]!!.jsonObject, AvatarFit.layout(c, false, manifest, null, poses = data))
            // the un-posed path is the original layout exactly (no matrices)
            val plain = AvatarFit.layout(c, false, manifest, null, poses = null)
            assertNull(plain.letterM); assertTrue(plain.layers.all { it.m == null && it.ride == null })
            // per frame: the live layout's own pose parts reproduce at its fixed fit
            val parts = AvatarFit.layoutPoseParts(live, c.body, spec, data)!!
            for (k in listOf("root", "armL", "armR", "handL", "handR", "feet")) {
                val a = parts[k]; val b = live.pose!!.parts[k]
                for (j in 0 until 6) assertEquals("case $i parts.$k[$j]", b[j], a[j], 5e-4)
            }
        }
    }

    @Test
    fun live_transforms_face() {
        val c = validateAvatar(Json.parseToJsonElement("""{"body":"classic","pose":"wave","eyes":"beady","mouth":"smile"}"""), AvatarConfig())
        val spec = data.poses["wave"]!!.spec
        val layout = AvatarFit.layout(c, false, manifest, AvatarLayoutPose.Live("wave", spec), AvatarPoses.liveRoom(data), data)
        val rest = AvatarFit.liveTransforms(layout, c.body, AvatarLiveFrame(spec, eyes = 1.0, laugh = 0.0), poses = data)
        // eyes open, no laugh, no look: the face rides the root exactly
        closeMat("eyes", rest.getValue("root"), rest.getValue("eyes"))
        closeMat("mouth", rest.getValue("root"), rest.getValue("mouth"))
        closeMat("none", AvatarPoses.IDENTITY, rest.getValue("none"))
        // a blink squashes about the eyes' center: that center stays put
        val eyes = layout.layers.first { it.layer == "eyes" }
        val cy = eyes.rect.y + eyes.rect.h / 2; val cx = eyes.rect.x + eyes.rect.w / 2
        val blink = AvatarFit.liveTransforms(layout, c.body, AvatarLiveFrame(spec, eyes = 0.1, laugh = 1.0), poses = data)
        val a = AvatarPoses.matApply(blink.getValue("eyes"), cx, cy); val b = AvatarPoses.matApply(rest.getValue("root"), cx, cy)
        assertEquals(b.first, a.first, 1e-12); assertEquals(b.second, a.second, 1e-12)
        assertEquals(1.25 * rest.getValue("root")[0], blink.getValue("mouth")[0], 1e-12)
        // the look nudges the eyes (clamped to ±1)
        val look = AvatarFit.liveTransforms(layout, c.body, AvatarLiveFrame(spec, 1.0, 0.0), lookX = 5.0, lookY = 0.0, poses = data)
        val moved = AvatarPoses.matApply(look.getValue("eyes"), 0.0, 0.0).first - AvatarPoses.matApply(rest.getValue("eyes"), 0.0, 0.0).first
        assertEquals(0.012 * rest.getValue("root")[0], moved, 1e-12)
        assertTrue(AvatarFit.liveTransforms(layout, "nobody", AvatarLiveFrame(spec, 1.0, 0.0), poses = data).isEmpty())
    }

    @Test
    fun withheld_match() {
        val rows = root["withheld"]!!.jsonArray.map { it.jsonObject }
        assertEquals((AvatarPoses.IDS.size - 1 + AvatarPoses.CODE_POSES.size) * data.rigs.size, rows.size)
        for (r in rows) {
            val pose = str(r["pose"]); val body = str(r["body"])
            assertEquals("$pose/$body", r["items"]!!.jsonArray.map { str(it) }, AvatarPoses.withheld(pose, body, data))
        }
        assertTrue(AvatarPoses.withheld("none", "classic", data).isEmpty())
    }

    @Test
    fun live_room_and_lerp() {
        val room = AvatarPoses.liveRoom(data)
        assertEquals(4, room.size)
        assertEquals(data.poses["cheer"]!!.spec, room[0])
        val a = data.poses["wave"]!!.spec; val b = data.poses["cheer"]!!.spec
        val k0 = AvatarPoses.lerp(a, b, 0.0)
        assertEquals(a.armL!!.rot!!, k0.armL!!.rot!!, tol)
        assertEquals(1.0, k0.feet!!.sx!!, tol)
        val k1 = AvatarPoses.lerp(a, b, 1.0)
        assertEquals(b.body!!.sy!!, k1.body!!.sy!!, tol)
        // r5: five decimals (JS Math.round(v * 1e5) / 1e5)
        assertEquals(1.0, AvatarPoses.r5(1.000004), 0.0)
        assertEquals(0.12346, AvatarPoses.r5(0.123456), 1e-12)
        // the live layout (room) never rescales: still posed, and its fit is no larger than the plain posed fit
        val c = validateAvatar(Json.parseToJsonElement("""{"body":"classic","pose":"wave"}"""), AvatarConfig())
        val roomy = AvatarFit.layout(c, false, manifest, AvatarLayoutPose.Live("wave", data.poses["wave"]!!.spec), room, data)
        val tight = AvatarFit.layout(c, false, manifest, AvatarLayoutPose.Saved, poses = data)
        assertNotNull(roomy.pose)
        assertTrue(roomy.scale <= tight.scale)
        assertFalse(roomy.layers.isEmpty())
    }

    @Test
    fun config_pose_validates() {
        val fb = AvatarConfig()
        fun v(s: String) = validateAvatar(Json.parseToJsonElement(s), fb)
        assertEquals("wave", v("""{"pose":"wave"}""").pose)
        assertEquals("none", v("""{"pose":"moonwalk"}""").pose)
        assertEquals("none", v("""{"pose":7}""").pose)
        assertFalse(avatarToJson(v("""{"pose":"none"}""")).containsKey("pose"))
        assertEquals(JsonPrimitive("jump"), avatarToJson(v("""{"pose":"jump","body":"star"}"""))["pose"])
        // Founder 10-09 trim: a saved pose the picker no longer offers reads as standing.
        assertFalse(avatarToJson(v("""{"pose":"hug","body":"star"}""")).containsKey("pose"))
        assertFalse(avatarToJson(fb).containsKey("pose"))
    }

    // ── 2.8 item 13: reactions, place poses, the code-composed clap ──

    @Test
    fun place_poses_reactions_and_clap_match() {
        for (row in root["placePoses"]!!.jsonArray.map { it.jsonObject }) {
            assertEquals("place $row", str(row["pose"]), AvatarPoses.placePose(d(row["place"]).toInt()))
        }
        val secs = root["reactionSeconds"]!!.jsonObject
        for (r in AvatarReaction.entries) assertEquals(r.id, d(secs[r.id]), AvatarPoses.REACTION_SECONDS.getValue(r), tol)
        val hops = root["reactionHops"]!!.jsonObject
        for (r in AvatarReaction.entries) {
            val h = AvatarPoses.REACTION_HOPS[r]
            if (h == null) assertFalse(r.id, hops.containsKey(r.id))
            else {
                val w = hops[r.id]!!.jsonObject
                assertEquals(d(w["n"]), h.n, tol); assertEquals(d(w["per"]), h.per, tol); assertEquals(d(w["amp"]), h.amp, tol)
            }
        }
        val clap = AvatarPoses.poseDef("clap", data)!!
        assertFalse(AvatarPoses.IDS.contains("clap"))
        for (r in root["clapMatrices"]!!.jsonArray.map { it.jsonObject }) {
            val m = AvatarPoses.matrices(data.rigs.getValue(str(r["body"])), clap.spec)
            val want = r["m"]!!.jsonObject
            closeMat("clap root", mat(want["root"]), m.root); closeMat("clap armL", mat(want["armL"]), m.armL)
            closeMat("clap armR", mat(want["armR"]), m.armR); closeMat("clap feet", mat(want["feet"]), m.feet)
        }
        assertEquals(AvatarPoses.withheld("hug", "classic", data), AvatarPoses.withheld("clap", "classic", data))
    }
}
