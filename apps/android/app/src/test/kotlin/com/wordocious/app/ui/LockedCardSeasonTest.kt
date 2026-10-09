package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * 2.7.1 review: under Halloween's dark glass a free player's LOCKED, already-played game card wore
 * the finished glass (SeasonDone.WASH of its game color), so it read as a finished game. 370ee6e6
 * says locked cards keep their locked look; iOS passes the lock gray with `done && !locked`, web
 * returns its gray wash first. [gameCardBg] reads WTheme.season (Compose state), so the card's call
 * is pinned in the source; the colors themselves are covered by the web season-done test.
 */
class LockedCardSeasonTest {
    private val src = File("src/main/kotlin/com/wordocious/app/ui/ModeCardView.kt").readText()

    @Test fun aLockedCardIsNeverPaintedFinished() {
        // The mode card (the composable with `isLocked`) builds its background once, as `cardBg`.
        val calls = Regex("""val cardBg = gameCardBg\(([^\n]*)\)""").findAll(src).map { it.groupValues[1] }.toList()
        assertEquals("the mode card builds cardBg with gameCardBg once", 1, calls.size)
        val args = calls.single()
        assertTrue("a locked card is never 'done': $args", args.contains("isDone && !isLocked"))
        assertTrue("a locked card takes the lock gray, not its game color (iOS lockGray): $args", args.contains("if (isLocked) Color(0xFFD1D5DB)"))
    }
}
