package com.wordocious.app.data

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * 2.7.1 review: MainActivity handled its launch intent's deep link in EVERY onCreate. After the
 * small widget opened the app (wordocious://home, f00cbf47) any recreation — rotation, dark mode,
 * font scale, restore after process death — set DeepLinkRouter.homeRequest again and threw the
 * player back to Home (a `wordocious://daily/X` launch reopened that daily), undoing the tab kept
 * across config changes (93413361). Cold-start links are handled only on a fresh launch; warm taps
 * arrive through onNewIntent. A Robolectric / instrumented ActivityScenario.recreate() test is
 * the full check; the app has JUnit only, so the contract is pinned in the source.
 */
class DeepLinkRecreateTest {
    private val src = File("src/main/kotlin/com/wordocious/app/MainActivity.kt").readText()

    @Test fun launchLinksAreHandledOnlyOnAFreshLaunch() {
        val onCreate = src.substringAfter("override fun onCreate(savedInstanceState: Bundle?)").substringBefore("override fun onNewIntent(")
        val guard = onCreate.indexOf("if (savedInstanceState == null) {")
        assertTrue("onCreate guards the launch deep links with savedInstanceState == null", guard >= 0)
        val block = onCreate.substring(guard, onCreate.indexOf("\n        }", guard))
        assertTrue(block.contains("DeepLinkRouter.handle(intent?.data)"))
        assertTrue(block.contains("DeepLinkRouter.handlePushUrl("))
        // No unguarded copy elsewhere in onCreate.
        assertTrue(Regex("""DeepLinkRouter\.handle\(""").findAll(onCreate).count() == 1)
    }

    @Test fun warmTapsStillRouteThroughOnNewIntent() {
        val onNewIntent = src.substringAfter("override fun onNewIntent(")
        assertTrue(onNewIntent.substringBefore("\n    }\n").contains("DeepLinkRouter.handle("))
    }
}
