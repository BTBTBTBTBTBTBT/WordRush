package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** FINISH_SPEC AK: Home game cards press to 0.95 and spring back through 1.02, at full depth. */
class CardSquishTest {
    @Test
    fun card_press_values() {
        assertEquals(0.95f, Squish.CARD_DOWN, 0f)
        assertEquals(1.02f, Squish.CARD_OVERSHOOT, 0f)
        // Cards are not attenuated: a tall card still sinks the full 5%.
        assertEquals(0.95f, Squish.applied(Squish.CARD_DOWN, 1f), 1e-6f)
    }

    @Test
    fun home_card_components_route_through_the_card_squish() {
        val src = File("src/main/kotlin/com/wordocious/app/ui")
        fun read(name: String) = File(src, name).readText()
        assertTrue(read("ModeCardView.kt").contains("squishClickable(card = true"))
        assertTrue(read("GameTile.kt").contains("pressSquish(interaction, card = true)"))
        assertTrue(read("VSLiveTile.kt").contains("card = true"))
        assertTrue(read("HomeBannerView.kt").contains("card = true"))
    }
}
