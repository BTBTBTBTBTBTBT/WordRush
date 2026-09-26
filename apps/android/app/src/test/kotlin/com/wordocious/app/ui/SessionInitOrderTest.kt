package com.wordocious.app.ui

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Regression guard for the More Games save bug (Doug, Android production, 2026-09-25:
 * "the card on the menu shows it as completed, but the actual puzzle is definitely
 * forgetting that I played"). Every custom-engine session restores its save from
 * `init { restore() }`, and restore decodes with a `private val json`. Kotlin runs
 * property initializers in source order, so a `json` declared BELOW the init block is
 * still null while restore() runs: the decode threw inside runCatching and every save
 * was dropped on the next open, on all nine games. The codec must be declared above init.
 */
class SessionInitOrderTest {
    private val screens = listOf(
        "MuddleScreen", "HubScreen", "KindredScreen", "SudokuScreen", "RegionsScreen",
        "LadderScreen", "CodebreakerScreen", "SpyglassScreen", "CrosswordScreen",
    )

    private fun source(name: String): String {
        val candidates = listOf(
            File("src/main/kotlin/com/wordocious/app/ui/game/$name.kt"),
            File("app/src/main/kotlin/com/wordocious/app/ui/game/$name.kt"),
        )
        return candidates.firstOrNull { it.exists() }?.readText() ?: error("cannot find $name.kt from ${File(".").absolutePath}")
    }

    @Test
    fun json_codec_is_declared_before_the_init_block_that_restores() {
        for (name in screens) {
            val s = source(name)
            val init = s.indexOf("\n    init {")
            val json = s.indexOf("private val json")
            assertTrue("$name: session has no init block", init > 0)
            assertTrue("$name: session has no private val json", json > 0)
            assertTrue("$name: init calls restore()", s.substring(init, minOf(s.length, init + 300)).contains("restore()"))
            assertTrue("$name: `private val json` must be declared ABOVE `init { restore() }` or restore decodes with null", json < init)
        }
    }
}
