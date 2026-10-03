package com.wordocious.app.ui.game

import com.wordocious.app.ui.game.FeedbackToast.Tone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The shared feedback toast: score vs message classification, quality labels, tones, curves. */
class FeedbackToastTest {
    private fun score(text: String) = FeedbackToast.kind(text) as FeedbackToast.Score
    private fun tone(text: String) = (FeedbackToast.kind(text) as FeedbackToast.Message).tone

    @Test
    fun plus_n_is_a_score_with_a_quality_label() {
        assertEquals(FeedbackToast.Score(1, false, "Good!"), score("+1"))
        assertEquals("Good!", score("+4").label)
        assertEquals("Nice!", score("+5").label)
        assertEquals("Nice!", score("+6").label)
        assertEquals("Great!", score("+7").label)
        assertEquals("Amazing!", score("+8").label)
        assertEquals("Amazing!", score("+12").label)
    }

    @Test
    fun pangram_score_is_flagged_and_labelled() {
        val s = score("Pangram! +14")
        assertEquals(14, s.points)
        assertTrue(s.pangram)
        assertEquals("PANGRAM!", s.label)
        assertTrue(score("pangram!+9").pangram)
    }

    @Test
    fun non_scores_are_messages() {
        assertTrue(FeedbackToast.kind("+5 pts") is FeedbackToast.Message)
        assertTrue(FeedbackToast.kind("Rank up: Genius") is FeedbackToast.Message)
        assertTrue(FeedbackToast.kind("5") is FeedbackToast.Message)
    }

    @Test
    fun message_tones() {
        assertEquals(Tone.WIN, tone("Rank up: Genius"))
        assertEquals(Tone.WIN, tone("Solved!"))
        assertEquals(Tone.SUCCESS, tone("Copied!"))
        assertEquals(Tone.SUCCESS, tone("Saved"))
        assertEquals(Tone.ERROR, tone("Not in word list"))
        assertEquals(Tone.ERROR, tone("Already found"))
        assertEquals(Tone.ERROR, tone("Four letters or more"))
        assertEquals(Tone.ERROR, tone("Must use the center letter"))
        assertEquals(Tone.ERROR, tone("Only the seven letters"))
        assertEquals(Tone.ERROR, tone("Not enough letters"))
        assertEquals(Tone.LOSS, tone("The word was CRANE"))
        assertEquals(Tone.INFO, tone("Tap a cell first"))
        assertEquals(Tone.INFO, tone("Solve the four words first"))
    }

    @Test
    fun status_tones_for_confirmations() {
        assertEquals(Tone.SUCCESS, FeedbackToast.statusTone("Sent!"))
        assertEquals(Tone.SUCCESS, FeedbackToast.statusTone("User blocked"))
        assertEquals(Tone.SUCCESS, FeedbackToast.statusTone("Report submitted — thank you"))
        assertEquals(Tone.WARN, FeedbackToast.statusTone("Already nudged them today"))
        assertEquals(Tone.ERROR, FeedbackToast.statusTone("Could not send"))
    }

    @Test
    fun info_accent_is_never_blue() {
        val c = FeedbackToast.accent(Tone.INFO)
        assertTrue("info must read purple", c.red > c.green && c.blue > c.green)
    }

    @Test
    fun score_curve_pops_holds_and_floats_away() {
        val start = FeedbackToast.scoreFrame(0f, reduced = false)
        assertEquals(0.6f, start.scale, 1e-4f)
        assertEquals(0f, start.alpha, 1e-4f)
        assertEquals(1.08f, FeedbackToast.scoreFrame(170f, false).scale, 1e-3f)
        val hold = FeedbackToast.scoreFrame(500f, false)
        assertEquals(1f, hold.scale, 1e-4f); assertEquals(1f, hold.alpha, 1e-4f); assertEquals(0f, hold.dy, 1e-4f)
        val end = FeedbackToast.scoreFrame(FeedbackToast.SCORE_MS, false)
        assertEquals(0f, end.alpha, 1e-4f); assertEquals(-12f, end.dy, 1e-4f)
        assertTrue(FeedbackToast.scoreFrame(600f, false).sparkle < 0f)
    }

    @Test
    fun reduce_motion_is_a_plain_fade() {
        for (ms in listOf(0f, 100f, 300f, 800f, 1100f)) {
            val f = FeedbackToast.scoreFrame(ms, reduced = true)
            assertEquals(1f, f.scale, 0f); assertEquals(0f, f.dy, 0f); assertTrue(f.sparkle < 0f)
            val m = FeedbackToast.messageFrame(ms, shake = true, reduced = true)
            assertEquals(1f, m.scale, 0f); assertEquals(0f, m.dx, 0f)
        }
    }

    @Test
    fun error_shake_hits_its_keyframes_and_settles() {
        val seg = FeedbackToast.SHAKE_MS / 6f
        assertEquals(-8f, FeedbackToast.messageFrame(seg, shake = true, reduced = false).dx, 1e-3f)
        assertEquals(8f, FeedbackToast.messageFrame(seg * 2, shake = true, reduced = false).dx, 1e-3f)
        assertEquals(0f, FeedbackToast.messageFrame(FeedbackToast.SHAKE_MS, shake = true, reduced = false).dx, 1e-3f)
        assertEquals(0f, FeedbackToast.messageFrame(seg, shake = false, reduced = false).dx, 0f)
        assertEquals(0.9f, FeedbackToast.messageFrame(0f, false, false).scale, 1e-4f)
        assertEquals(1f, FeedbackToast.messageFrame(400f, false, false).scale, 1e-4f)
    }
}
