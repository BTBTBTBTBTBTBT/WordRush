package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.float
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC BJ4 parity guard: podiumLayout / podiumOpenSpot match packages/core/src/podium-layout.ts. */
class PodiumLayoutFixtureTest {
    private val root: JsonObject by lazy {
        Json.parseToJsonElement(javaClass.classLoader!!.getResource("fixtures/podium-layout-fixtures.json")!!.readText()).jsonObject
    }

    @Test
    fun layout_cases_match() {
        for (c in root["cases"]!!.jsonArray.map { it.jsonObject }) {
            val ranks = c["ranks"]!!.jsonArray.map { it.jsonPrimitive.int }
            val layout = c["layout"]!!.jsonObject
            val got = podiumLayout(ranks)
            assertEquals("filled $ranks", layout["filled"]!!.jsonPrimitive.int, got.filled)
            assertEquals("open $ranks", layout["open"]!!.jsonArray.map { it.jsonPrimitive.int }, got.open)
        }
    }

    @Test
    fun open_spot_copy_matches() {
        for (o in root["open"]!!.jsonArray.map { it.jsonObject }) {
            val place = o["place"]!!.jsonPrimitive.int
            val spot = podiumOpenSpot(place)
            assertEquals(o["title"]!!.jsonPrimitive.content, spot.title)
            assertEquals(o["line"]!!.jsonPrimitive.content, spot.line)
        }
    }

    @Test
    fun podium_for_n_results() {
        assertEquals(PodiumLayout(0, emptyList()), podiumLayout(emptyList()))
        assertEquals(PodiumLayout(1, listOf(2, 3)), podiumLayout(listOf(1)))
        assertEquals(PodiumLayout(2, listOf(3)), podiumLayout(listOf(1, 2)))
        assertEquals(PodiumLayout(3, emptyList()), podiumLayout(listOf(1, 2, 3)))
        assertEquals(PodiumLayout(3, emptyList()), podiumLayout(listOf(1, 2, 3, 4, 5)))
        assertEquals(PodiumLayout(3, emptyList()), podiumLayout(listOf(1, 1, 1, 1)))
    }

    @Test
    fun art_geometry_matches() {
        val art = root["art"]!!.jsonObject
        assertEquals(art["aspect"]!!.jsonPrimitive.double, PodiumArtGeometry.ASPECT, 0.0)
        assertEquals(art["maxWidthPt"]!!.jsonPrimitive.double, PodiumArtGeometry.MAX_WIDTH_PT, 0.0)
        assertEquals(art["plantPt"]!!.jsonPrimitive.double, PodiumArtGeometry.PLANT_PT, 0.0)
        assertEquals(art["nameGapPt"]!!.jsonPrimitive.double, PodiumArtGeometry.NAME_GAP_PT, 0.0)
        assertEquals(art["headTop"]!!.jsonPrimitive.double, PodiumArtGeometry.HEAD_TOP, 0.0)
        assertEquals(art["crownRise"]!!.jsonPrimitive.double, PodiumArtGeometry.CROWN_RISE, 0.0)
        assertEquals(art["crownGapPt"]!!.jsonPrimitive.double, PodiumArtGeometry.CROWN_GAP_PT, 0.0)
        val ns = art["nameSize"]!!.jsonObject; val nw = art["nameWidth"]!!.jsonObject
        assertEquals(ns["gold"]!!.jsonPrimitive.double, PodiumArtGeometry.NAME_SIZE_GOLD, 0.0)
        assertEquals(ns["other"]!!.jsonPrimitive.double, PodiumArtGeometry.NAME_SIZE_OTHER, 0.0)
        assertEquals(nw["gold"]!!.jsonPrimitive.double, PodiumArtGeometry.NAME_WIDTH_GOLD, 0.0)
        assertEquals(nw["other"]!!.jsonPrimitive.double, PodiumArtGeometry.NAME_WIDTH_OTHER, 0.0)
        assertEquals(art["nameMinScale"]!!.jsonPrimitive.double, PodiumArtGeometry.NAME_MIN_SCALE, 0.0)
        root["winnerHead"]!!.jsonArray.map { it.jsonObject }.forEach { c ->
            val head = c["head"]!!.jsonPrimitive.content
            assertEquals(c["out"]!!.jsonPrimitive.content, PodiumArtGeometry.winnerHead(head.ifEmpty { null }))
        }
        val os = art["openSpot"]!!.jsonObject
        assertEquals(os["width"]!!.jsonPrimitive.double, PodiumArtGeometry.OPEN_SPOT_WIDTH, 0.0)
        assertEquals(os["aspect"]!!.jsonPrimitive.double, PodiumArtGeometry.OPEN_SPOT_ASPECT, 1e-12)
        assertEquals(os["plantPt"]!!.jsonPrimitive.double, PodiumArtGeometry.OPEN_SPOT_PLANT_PT, 0.0)
        assertEquals(art["shadowWidth"]!!.jsonPrimitive.double, PodiumArtGeometry.SHADOW_WIDTH, 0.0)
        assertEquals(art["scoreHeight"]!!.jsonPrimitive.double, PodiumArtGeometry.SCORE_HEIGHT, 0.0)
        assertEquals(art["detailHeight"]!!.jsonPrimitive.double, PodiumArtGeometry.DETAIL_HEIGHT, 0.0)
        assertEquals(art["textRgb"]!!.jsonArray.map { it.jsonPrimitive.int }, PodiumArtGeometry.TEXT_RGB.toList())
        val steps = art["steps"]!!.jsonArray.map { it.jsonObject }
        assertEquals(steps.size, PodiumArtGeometry.STEPS.size)
        steps.forEachIndexed { i, s ->
            val k = PodiumArtGeometry.STEPS[i]
            val feet = s["feet"]!!.jsonObject
            val panel = s["panel"]!!.jsonObject
            assertEquals(s["place"]!!.jsonPrimitive.int, k.place)
            assertEquals(feet["x"]!!.jsonPrimitive.double, k.feetX, 0.0)
            assertEquals(feet["y"]!!.jsonPrimitive.double, k.feetY, 0.0)
            assertEquals(panel["x0"]!!.jsonPrimitive.double, k.panel.x0, 0.0)
            assertEquals(panel["x1"]!!.jsonPrimitive.double, k.panel.x1, 0.0)
            assertEquals(panel["y0"]!!.jsonPrimitive.double, k.panel.y0, 0.0)
            assertEquals(panel["y1"]!!.jsonPrimitive.double, k.panel.y1, 0.0)
        }
        assertEquals(root["art"]!!.jsonObject["order"]?.jsonArray?.map { it.jsonPrimitive.int } ?: PodiumArtGeometry.ORDER, PodiumArtGeometry.ORDER)
    }

    @Test
    fun winner_intro_matches() {
        val w = root["winnerIntro"]!!.jsonObject
        val g = w["glow"]!!.jsonObject
        assertEquals(g["size"]!!.jsonPrimitive.double, PodiumWinnerIntro.GLOW_SIZE, 0.0)
        assertEquals(g["colorRgb"]!!.jsonArray.map { it.jsonPrimitive.int }, PodiumWinnerIntro.GLOW_RGB.toList())
        assertEquals(g["fromScale"]!!.jsonPrimitive.double, PodiumWinnerIntro.GLOW_FROM_SCALE, 0.0)
        assertEquals(g["toScale"]!!.jsonPrimitive.double, PodiumWinnerIntro.GLOW_TO_SCALE, 0.0)
        assertEquals(g["durationMs"]!!.jsonPrimitive.int, PodiumWinnerIntro.GLOW_DURATION_MS)
        assertEquals(g["ease"]!!.jsonArray.map { it.jsonPrimitive.float }, PodiumWinnerIntro.GLOW_EASE.toList())
        assertEquals(g["restOpacity"]!!.jsonPrimitive.double, PodiumWinnerIntro.GLOW_REST_OPACITY, 0.0)
        val s = w["sparkles"]!!.jsonObject
        assertEquals(
            s["offsets"]!!.jsonArray.map { it.jsonArray[0].jsonPrimitive.double to it.jsonArray[1].jsonPrimitive.double },
            PodiumWinnerIntro.SPARKLE_OFFSETS,
        )
        assertEquals(s["size"]!!.jsonPrimitive.double, PodiumWinnerIntro.SPARKLE_SIZE, 0.0)
        assertEquals(s["durationMs"]!!.jsonPrimitive.int, PodiumWinnerIntro.SPARKLE_DURATION_MS)
        assertEquals(s["delayMs"]!!.jsonPrimitive.int, PodiumWinnerIntro.SPARKLE_DELAY_MS)
        assertEquals(s["staggerMs"]!!.jsonPrimitive.int, PodiumWinnerIntro.SPARKLE_STAGGER_MS)
        assertEquals(s["driftPt"]!!.jsonPrimitive.double, PodiumWinnerIntro.SPARKLE_DRIFT_PT, 0.0)
        assertEquals(s["peakOpacity"]!!.jsonPrimitive.double, PodiumWinnerIntro.SPARKLE_PEAK_OPACITY, 0.0)
        assertEquals(s["colorRgb"]!!.jsonArray.map { it.jsonPrimitive.int }, PodiumWinnerIntro.SPARKLE_RGB.toList())
        val c = w["crown"]!!.jsonObject
        assertEquals(c["delayMs"]!!.jsonPrimitive.int, PodiumWinnerIntro.CROWN_DELAY_MS)
        assertEquals(c["durationMs"]!!.jsonPrimitive.int, PodiumWinnerIntro.CROWN_DURATION_MS)
        assertEquals(c["dropPt"]!!.jsonPrimitive.double, PodiumWinnerIntro.CROWN_DROP_PT, 0.0)
        assertEquals(c["settlePt"]!!.jsonPrimitive.double, PodiumWinnerIntro.CROWN_SETTLE_PT, 0.0)
    }
}
