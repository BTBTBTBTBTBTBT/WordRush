package com.wordocious.app.ui.game

import com.wordocious.app.ui.CastPoses
import com.wordocious.app.ui.MascotId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** FINISH_SPEC AF: the "?" popup's quick steps, their example rows and timing. */
class GuideStepsTest {
    private fun guideSlugs(): List<String> {
        val f = listOf(File("src/main/assets/guides.generated.json"), File("app/src/main/assets/guides.generated.json"))
            .firstOrNull { it.exists() } ?: error("guides.generated.json not found from ${File(".").absolutePath}")
        return Regex("\"slug\"\\s*:\\s*\"([a-z0-9-]+)\"").findAll(f.readText()).map { it.groupValues[1] }.toList()
    }

    @Test fun everyGuideHasThreeOrFourSteps() {
        val slugs = guideSlugs()
        assertTrue(slugs.isNotEmpty())
        slugs.forEach { slug ->
            assertTrue("$slug has hand-shortened steps", slug in GuideSteps.slugs)
            val steps = GuideSteps.stepsFor(slug)
            assertTrue("$slug: ${steps.size} steps", steps.size in 3..GuideSteps.MAX_STEPS)
        }
    }

    @Test fun stepsAreShortAmericanAndShowTiles() {
        val british = Regex("\\b(colour|centre|grey|favourite|cancelled|realise|recognise)\\b", RegexOption.IGNORE_CASE)
        GuideSteps.slugs.forEach { slug ->
            GuideSteps.stepsFor(slug).forEach { s ->
                assertTrue("$slug: \"${s.text}\" too long", s.text.length <= GuideSteps.MAX_TEXT)
                assertTrue("$slug: blank step", s.text.isNotBlank())
                assertTrue("$slug: no em dash", '—' !in s.text)
                assertTrue("$slug: British spelling in \"${s.text}\"", !british.containsMatchIn(s.text))
                assertTrue("$slug: every step has an example row", s.tiles.isNotEmpty())
                assertTrue("$slug: row fits the card", s.tiles.size <= 9)
            }
        }
    }

    @Test fun rowCodesMapToFaces() {
        val r = GuideSteps.row("CRANE", "apcaa")
        assertEquals(listOf("C", "R", "A", "N", "E"), r.map { it.glyph })
        assertEquals(
            listOf(TileFace.ABSENT, TileFace.PRESENT, TileFace.CORRECT, TileFace.ABSENT, TileFace.ABSENT),
            r.map { it.face },
        )
        assertEquals("", GuideSteps.row("_A", "ec")[0].glyph)
        assertEquals(TileFace.TYPED, GuideSteps.row("AB", "c")[1].face) // a missing code = typed
        assertEquals(listOf("LIME", "FIG"), GuideSteps.row("", "tt", listOf("LIME", "FIG")).map { it.glyph })
    }

    @Test fun tilesAnimateLeftToRightThenHoldAndLoop() {
        val n = 5
        assertEquals(0f, GuideSteps.tileProgress(0f, 0, n), 0.001f)
        assertEquals(1f, GuideSteps.tileProgress(GuideSteps.TILE_MS.toFloat(), 0, n), 0.001f)
        // The second tile starts one stagger later.
        assertEquals(0f, GuideSteps.tileProgress(GuideSteps.STAGGER_MS.toFloat(), 1, n), 0.001f)
        // Everything is done before the hold ends.
        val lastDone = ((n - 1) * GuideSteps.STAGGER_MS + GuideSteps.TILE_MS).toFloat()
        (0 until n).forEach { assertEquals(1f, GuideSteps.tileProgress(lastDone, it, n), 0.001f) }
        assertEquals(lastDone + GuideSteps.HOLD_MS, GuideSteps.cycleMs(n).toFloat(), 0.001f)
        // The next cycle starts over.
        assertEquals(0f, GuideSteps.tileProgress(GuideSteps.cycleMs(n).toFloat(), 0, n), 0.001f)
    }

    @Test fun unknownGameFallsBackToFirstSentences() {
        val steps = GuideSteps.stepsFor("brand-new", listOf("First idea here. More words.", "Second idea! Extra.", "", "Third.", "Fourth.", "Fifth."))
        assertEquals(listOf("First idea here.", "Second idea!", "Third.", "Fourth."), steps.map { it.text })
        val long = GuideSteps.firstSentence("word ".repeat(40).trim() + ".")
        assertTrue(long.length <= GuideSteps.MAX_TEXT)
        assertTrue(long.endsWith("…"))
    }

    @Test fun everyHostPoseIsDrawn() {
        MascotId.entries.forEach { id ->
            assertNotNull("$id ${GuideSteps.hostPose(id)}", CastPoses.res(id, GuideSteps.hostPose(id)))
        }
    }
}
