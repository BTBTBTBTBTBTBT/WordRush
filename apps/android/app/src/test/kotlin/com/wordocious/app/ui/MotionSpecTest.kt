package com.wordocious.app.ui

import com.wordocious.core.MotionSpec
import com.wordocious.core.SoftPopPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** FINISH_SPEC BJ9 / BJ10 (iOS MotionSpecTests, web motion-spec.test.ts). */
class MotionSpecTest {
    private val screen = MotionSpec.Box(0f, 0f, 1080f, 2400f)
    private val card = MotionSpec.Box(48f, 900f, 480f, 200f)

    @Test fun openTimingMatchesTheDemo() {
        assertEquals(120, MotionSpec.LIFT_MS)
        assertEquals(440, MotionSpec.GROW_MS)
        assertEquals(1.03f, MotionSpec.LIFT_SCALE)
        val (delay, dur) = MotionSpec.revealTiming(MotionSpec.OpenKind.GROW)
        assertEquals(120 + 176, delay)   // the game fades in over the LAST 60% of the grow
        assertEquals(264, dur)
        assertEquals(560, MotionSpec.openDurationMs(MotionSpec.OpenKind.GROW))
        assertEquals(560, MotionSpec.closeDurationMs(MotionSpec.OpenKind.GROW))
        for (k in MotionSpec.OpenKind.values()) assertTrue(MotionSpec.closeDurationMs(k) < 600)
    }

    @Test fun openKind() {
        assertEquals(MotionSpec.OpenKind.GROW, MotionSpec.openKind(true, false))
        assertEquals(MotionSpec.OpenKind.RISE, MotionSpec.openKind(false, false))
        assertEquals(MotionSpec.OpenKind.CROSS_FADE, MotionSpec.openKind(true, true))
    }

    @Test fun liftAndRiseGeometry() {
        val l = MotionSpec.liftedFrame(card, 4f)
        assertEquals(card.width * 1.03f, l.width, 1e-3f)
        assertEquals(card.centerX, l.centerX, 1e-3f)
        assertEquals(card.centerY - 4f, l.centerY, 1e-3f)
        val r = MotionSpec.riseStartFrame(screen, 14f)
        assertEquals(screen.width * 0.96f, r.width, 1e-3f)
        assertEquals(screen.centerY + 14f, r.centerY, 1e-3f)
    }

    @Test fun usableSource() {
        assertNull(MotionSpec.usableSource(null, screen))
        assertNull(MotionSpec.usableSource(MotionSpec.Box(0f, 0f, 0f, 0f), screen))
        assertNull(MotionSpec.usableSource(MotionSpec.Box(48f, 5000f, 480f, 200f), screen))
        assertNotNull(MotionSpec.usableSource(card, screen))
    }

    @Test fun openFramesGrowFromTheCardAndRevealLate() {
        val k = MotionSpec.OpenKind.GROW
        val f0 = MotionSpec.openFrame(k, 0f, card, screen, 40f, 4f, 14f)
        assertEquals(0f, f0.shellAlpha)                      // only the card, lifting
        assertEquals(0f, f0.gameAlpha)
        val lifted = MotionSpec.openFrame(k, 120f, card, screen, 40f, 4f, 14f)
        assertEquals(1.03f, lifted.liftScale, 1e-4f)
        assertEquals(MotionSpec.liftedFrame(card, 4f), lifted.shell)   // the grow starts at the lifted card
        val mid = MotionSpec.openFrame(k, 290f, card, screen, 40f, 4f, 14f)
        assertEquals(0f, mid.gameAlpha)                     // not before the last 60%
        val end = MotionSpec.openFrame(k, 560f, card, screen, 40f, 4f, 14f)
        assertEquals(1f, end.gameAlpha)
        assertEquals(screen.width, end.shell.width, 1f)
        assertEquals(0f, end.shellRadius, 0.1f)
    }

    @Test fun closeFramesFadeThenShrinkIntoTheCard() {
        val k = MotionSpec.OpenKind.GROW
        val f0 = MotionSpec.closeFrame(k, 0f, card, screen, 40f, 14f)
        assertEquals(1f, f0.gameAlpha)
        assertEquals(screen, f0.shell)
        val faded = MotionSpec.closeFrame(k, 180f, card, screen, 40f, 14f)
        assertEquals(0f, faded.gameAlpha)
        val end = MotionSpec.closeFrame(k, 560f, card, screen, 40f, 14f)
        assertEquals(card.left, end.shell.left, 1f)
        assertEquals(card.width, end.shell.width, 1f)
        assertEquals(0f, end.shellAlpha, 1e-3f)
        // No card: the reverse soft rise.
        val rise = MotionSpec.closeFrame(MotionSpec.OpenKind.RISE, 180f + 238f, null, screen, 40f, 14f)
        assertEquals(0f, rise.shellAlpha, 1e-3f)
    }

    @Test fun systemSheetsStayNative() {
        for (k in listOf("share", "purchase", "signInApple", "signInGoogle", "photoPicker", "mail", "safari")) {
            assertFalse(k, SoftPopPolicy.usesSoftPop(k))
        }
        assertFalse(SoftPopPolicy.usesSoftPop(SoftPopPolicy.FULL_SCREEN_GAMES))
        for (k in listOf("help", "settings", "streak", "guide", "strategy", "pro", "friend", "pocketGame", "achievements")) {
            assertTrue(k, SoftPopPolicy.usesSoftPop(k))
        }
    }

    /** Every app bottom sheet is the soft sheet: no Material ModalBottomSheet call is left. */
    @Test fun appSheetsSoftPop() {
        val root = generateSequence(File("").absoluteFile) { it.parentFile }
            .map { File(it, "app/src/main/kotlin") }.firstOrNull { it.isDirectory }
            ?: generateSequence(File("").absoluteFile) { it.parentFile }.map { File(it, "src/main/kotlin") }.first { it.isDirectory }
        val offenders = root.walkTopDown().filter { it.extension == "kt" }.flatMap { f ->
            f.readLines().mapIndexedNotNull { i, line ->
                if (Regex("""(?<![\w.])ModalBottomSheet\(|material3\.ModalBottomSheet\(""").containsMatchIn(line)) "${f.name}:${i + 1}" else null
            }
        }.toList()
        assertEquals(emptyList<String>(), offenders)
        // The dialog theme pops every app dialog window.
        val res = File(root.parentFile, "res/values/themes.xml").readText()
        assertTrue(res.contains("@style/WordociousSoftPopDialog"))
    }
}
