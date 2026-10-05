package com.wordocious.app.ui.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** BI22: a hint, reveal, check or hint message never changes a board's size or moves the layout. */
class HintLayoutTest {
    private val longClue = "______ is an American singer-songwriter. Her songwriting, artistry and entrepreneurship " +
        "have influenced the music industry and popular culture, and she is the subject of widespread media coverage."

    @Test
    fun propernoundle_clue_slot_is_the_same_height_with_and_without_a_clue() {
        for (lineDp in listOf(15.6f, 18f, 24f, 31.2f)) { // font scale 1.0 … 2.0
            val idle = HintLayout.clueSlotHeight(lineDp, clue = null)
            assertEquals(idle, HintLayout.clueSlotHeight(lineDp, clue = "Category: Music"), 0f)
            assertEquals(idle, HintLayout.clueSlotHeight(lineDp, clue = longClue), 0f)
            assertEquals(HintLayout.CLUE_TOP_PAD + lineDp * 3 + HintLayout.CLUE_SLACK, idle, 0.001f)
        }
    }

    @Test
    fun propernoundle_clue_wraps_three_lines_and_four_on_tall_screens() {
        // Doug 10-05: the clue read as one line ("His…"). It wraps to 3 lines, 4 on tall phones.
        assertEquals(3, HintLayout.clueLines(640))
        assertEquals(3, HintLayout.clueLines(HintLayout.CLUE_TALL_SCREEN_DP - 1))
        assertEquals(4, HintLayout.clueLines(HintLayout.CLUE_TALL_SCREEN_DP))
        assertTrue(HintLayout.CLUE_SP >= 13f)
        // The slot always has room for every line plus slack, at any font scale.
        for (lineDp in listOf(16.9f, 21.97f, 33.8f)) for (lines in 3..4) {
            assertTrue(HintLayout.clueSlotHeight(lineDp, null, lines) >= HintLayout.CLUE_TOP_PAD + lineDp * lines + 2f)
        }
    }

    @Test
    fun propernoundle_board_is_identical_with_and_without_the_clue_showing() {
        // The board band = the screen minus the fixed chrome, the clue slot included either way.
        val lineDp = HintLayout.CLUE_LINE_SP
        fun board(clue: String?): BoardSizing.Fit {
            val band = 780f - 96f /* header */ - HintLayout.clueSlotHeight(lineDp, clue) - 56f /* hint pills */ - 190f /* keyboard */
            return BoardSizing.fitSquare(availW = 392f, availH = band, cols = 12, rows = 6, gap = 5f, extraWidth = 14f)
        }
        assertEquals(board(null), board(longClue))
        assertEquals(board(null), board("Category: Music"))
    }

    @Test
    fun kindred_tiles_are_identical_before_and_after_naming_a_category() {
        for (band in listOf(300f, 380f, 460f, 560f, 700f)) for (solved in 0..3) {
            val rows = 4 - solved
            fun tile(revealed: Int) = HintLayout.kindredTileHeight(
                bandH = band, rows = rows, solved = solved, revealedLabels = revealed,
                chipSlotH = 24.3f + 8f, trayPad = 10f, trayLip = 4f,
            )
            val none = tile(0)
            for (revealed in 1..(4 - solved)) assertEquals("band $band solved $solved revealed $revealed", none, tile(revealed), 0f)
            assertTrue(none in HintLayout.KINDRED_TILE_MIN..HintLayout.KINDRED_TILE_MAX)
        }
    }

    @Test
    fun hint_count_badge_text_is_hidden_at_zero_and_caps_at_99_plus() {
        assertEquals("", hintCountText(0))
        assertEquals("", hintCountText(-3))
        assertEquals("1", hintCountText(1))
        assertEquals("9", hintCountText(9))
        assertEquals("42", hintCountText(42))
        assertEquals("99", hintCountText(99))
        assertEquals("99+", hintCountText(100))
        assertEquals("99+", hintCountText(1000))
    }

    @Test
    fun counted_buttons_keep_a_fixed_label_and_say_the_count_to_talkback() {
        assertEquals("Hint", hintCountDescription("Hint", 0))
        assertEquals("Hint (2 used)", hintCountDescription("Hint", 2))
        assertEquals("Show a pair (12 used)", hintCountDescription("Show a pair", 12))
    }

    @Test
    fun countdown_reserve_masks_every_digit() {
        assertEquals("Reveal · 8:88", HintLayout.countdownReserve("Reveal · 4:59"))
        assertEquals(HintLayout.countdownReserve("Reveal · 0:07"), HintLayout.countdownReserve("Reveal · 1:11"))
        assertEquals("Reveal", HintLayout.countdownReserve("Reveal"))
    }
}
