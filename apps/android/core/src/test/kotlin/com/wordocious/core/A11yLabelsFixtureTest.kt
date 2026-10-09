package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** 2.8 item 40: the screen-reader labels match packages/core/src/a11y-labels.ts (shared fixture) and are never empty. */
class A11yLabelsFixtureTest {
    private data class Place(val place: Int, val word: String, val open: String)
    private data class Podium(val place: Int, val name: String, val points: String, val detail: String?, val label: String, val card: String)
    private data class Seal(val days: Int, val label: String)
    private data class Head(val lines: List<String>, val label: String)
    private data class Mascot(val own: Boolean, val name: String?, val label: String)
    private data class Progress(val played: Int, val total: Int, val label: String)
    private data class Fixtures(
        val places: List<Place>, val podium: List<Podium>, val seals: List<Seal>,
        val headlines: List<Head>, val mascots: List<Mascot>, val progress: List<Progress>,
    )

    private fun load(): Fixtures =
        Gson().fromJson(javaClass.classLoader!!.getResource("fixtures/a11y-labels-fixtures.json")!!.readText(), Fixtures::class.java)

    @Test fun matchesTheSharedFixture() {
        val f = load()
        assertTrue(f.places.isNotEmpty() && f.podium.isNotEmpty() && f.headlines.isNotEmpty())
        f.places.forEach { assertEquals(it.word, A11yLabels.placeWord(it.place)); assertEquals(it.open, A11yLabels.podiumOpenSpot(it.place)) }
        f.podium.forEach {
            assertEquals(it.label, A11yLabels.podiumPlace(it.place, it.name, it.points, it.detail))
            assertEquals(it.card, A11yLabels.podiumStageCard(it.name, it.place))
        }
        f.seals.forEach { assertEquals(it.label, A11yLabels.flawlessSeal(it.days)) }
        f.headlines.forEach { assertEquals(it.label, A11yLabels.headline(it.lines)) }
        f.mascots.forEach { assertEquals(it.label, A11yLabels.mascot(it.own, it.name)) }
        f.progress.forEach { assertEquals(it.label, A11yLabels.progress(it.played, it.total)) }
    }

    @Test fun neverEmpty() {
        val all = listOf(
            A11yLabels.placeWord(0), A11yLabels.podiumOpenSpot(9), A11yLabels.podiumPlace(1, "", "", null),
            A11yLabels.podiumStageCard("", 3), A11yLabels.flawlessSeal(0), A11yLabels.headline(emptyList()),
            A11yLabels.headline(listOf("", " ")), A11yLabels.mascot(false, null), A11yLabels.mascot(false, " "), A11yLabels.progress(0, 0),
        )
        all.forEach { assertTrue(it.isNotBlank()) }
    }
}
