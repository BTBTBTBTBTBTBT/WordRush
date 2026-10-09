package com.wordocious.app.ui

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * 2.7.1 regression (3a04d181): the finished dock crashed the app (guest, daily Gauntlet, after
 * CONTINUE or VIEW SOLVED PUZZLE). [CastButtonRow] asked every item for maxIntrinsicWidth, and the
 * MORE chip (a QuietButton since 2a5bd3c4) draws its text with [FamLabel], a BoxWithConstraints
 * (a SubcomposeLayout), which throws on any intrinsic query; [CandyLabel] is built the same way.
 * The fix guards the query; such an item takes a line of its own.
 *
 * The app has no Compose UI test harness (JUnit only), so this pins the contract in the source,
 * like HomeCardTrimTest: every intrinsic query a custom measure policy makes on a child must be
 * guarded. The real check is a Compose UI test (createComposeRule) that composes
 * `CastButtonRow { CastButton(...); MoreChip(...) }` and asserts it measures without throwing.
 */
class CastButtonRowIntrinsicsTest {
    private val uiDir = File("src/main/kotlin/com/wordocious/app/ui")
    private val intrinsicCall = Regex("""\b\w+\.(max|min)Intrinsic(Width|Height)\(""")

    private fun codeOf(line: String) = line.substringBefore("//")

    @Test fun castButtonRowGuardsItsIntrinsicQuery() {
        val src = File(uiDir, "CastButton.kt").readText()
        val start = src.indexOf("fun CastButtonRow(")
        assertTrue("CastButtonRow moved; update this test", start >= 0)
        val end = src.indexOf("\n}\n", start).let { if (it < 0) src.length else it }
        val lines = src.substring(start, end).lines().map(::codeOf).filter { intrinsicCall.containsMatchIn(it) }
        assertTrue("CastButtonRow measures its items' natural widths", lines.isNotEmpty())
        for (l in lines) {
            assertTrue("CastButtonRow: an unguarded intrinsic query crashes on a SubcomposeLayout item: ${l.trim()}", l.contains("runCatching"))
        }
    }

    @Test fun theFamilyLabelsAreStillSubcomposeLayouts() {
        // Documents WHY the guard matters: if FamLabel / CandyLabel stop being BoxWithConstraints
        // (e.g. they learn to report a width, keeping MORE inline like iOS) this test can go.
        for ((file, fn) in listOf("FamilyButtons.kt" to "fun FamLabel(", "FinishKit.kt" to "fun CandyLabel(")) {
            val src = File(uiDir, file).readText()
            val start = src.indexOf(fn)
            assertTrue("$fn moved; update this test", start >= 0)
            assertTrue(fn, src.substring(start, minOf(src.length, start + 600)).contains("BoxWithConstraints"))
        }
    }

    @Test fun noUnguardedChildIntrinsicQueryInTheUi() {
        val offenders = uiDir.walkTopDown().filter { it.isFile && it.extension == "kt" }.flatMap { f ->
            f.readLines().mapIndexedNotNull { i, line ->
                val code = codeOf(line)
                if (intrinsicCall.containsMatchIn(code) && !code.contains("runCatching")) "${f.name}:${i + 1}: ${code.trim()}" else null
            }
        }.toList()
        assertTrue("unguarded intrinsic queries (a BoxWithConstraints child throws):\n" + offenders.joinToString("\n"), offenders.isEmpty())
    }
}
