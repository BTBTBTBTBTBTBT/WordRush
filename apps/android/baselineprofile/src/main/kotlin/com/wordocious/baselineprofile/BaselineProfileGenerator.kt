package com.wordocious.baselineprofile

import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Cold start → Home → Classic → type a guess → back → Leaderboard → scroll → Stats. */
@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {
    @get:Rule val rule = BaselineProfileRule()

    @Test
    fun generate() = rule.collect(packageName = "com.wordocious.app", includeInStartupProfile = true) {
        pressHome()
        startActivityAndWait()
        val d = device
        // Fresh install lands on the sign-in screen; guest mode reaches every game.
        d.wait(Until.findObject(By.text("Play without an account")), 3_000)?.click()
        d.wait(Until.hasObject(By.text("Classic")), 10_000)
        d.findObject(By.text("Classic"))?.click()
        d.wait(Until.hasObject(By.text("ENTER")), 10_000)
        for (ch in "CRANE") d.key(ch.toString())
        d.findObject(By.text("ENTER"))?.click()
        d.waitForIdle()
        d.pressBack()
        d.wait(Until.hasObject(By.text("Leaderboard")), 5_000)
        d.scroll() // Home
        d.findObjects(By.text("Leaderboard")).lastOrNull()?.click()
        d.waitForIdle()
        d.scroll() // Leaderboard (a guest sees the sign-in card; nothing to scroll is fine)
        d.findObjects(By.text("Stats")).lastOrNull()?.click()
        d.waitForIdle()
        d.findObjects(By.text("Home")).lastOrNull()?.click()
        d.waitForIdle()
    }

    /** Fling the first scrollable down and back up; re-found each time (recomposition can stale it). */
    private fun UiDevice.scroll() {
        for (dir in listOf(Direction.DOWN, Direction.UP)) runCatching {
            findObject(By.scrollable(true))?.apply { setGestureMargin(displayWidth / 5); fling(dir) }
            waitForIdle()
        }
    }

    /** The on-screen keyboard key (bottom-most match — board tiles can carry the same letter). */
    private fun UiDevice.key(label: String) {
        findObjects(By.text(label)).maxByOrNull { it.visibleBounds.top }?.click()
    }
}
