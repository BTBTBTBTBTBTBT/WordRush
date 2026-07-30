package com.wordocious.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.AuthScreen
import com.wordocious.app.ui.MainScreen
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.theme.WordociousTheme
import com.wordocious.core.generateDailySeed
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * App entry. Initializes Supabase session, then routes to:
 *   - Loading spinner (session restore in progress)
 *   - AuthScreen (not signed in)
 *   - MainScreen / 4-tab shell (signed in)
 */
class MainActivity : ComponentActivity() {
    private companion object {
        const val LAST_LAUNCHED_VERSION = "last-launched-version-code"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // App links (wordocious.com/vs/join/*) — cold-start delivery. Warm
        // starts arrive via onNewIntent below. Before this, the intent-filter
        // matched but the path was silently discarded.
        com.wordocious.app.data.DeepLinkRouter.handle(intent?.data)
        // Return leg of the browser Google sign-in fallback: parses the session
        // out of wordocious://auth-callback and hands it to the Auth plugin.
        // No-op for every other intent, so it is safe to call unconditionally.
        intent?.let { com.wordocious.app.data.AuthService.completeBrowserSignIn(it) }
        com.wordocious.app.data.ThemePref.load()
        // Warm the ~635KB word-list JSON decode off-main at launch (iOS parity:
        // RootTabView.init preloads). DictionaryLoader.ensureLoaded() is
        // idempotent + thread-safe (double-checked locking), so the synchronous
        // call in GameViewModel stays as a no-op safety fallback.
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            com.wordocious.core.DictionaryLoader.ensureLoaded()
        }
        AuthService.initialize()
        // Re-fire any solo results whose record flow was cut off (killed
        // mid-flight / offline finish) — idempotent, solo-only, waits for a
        // session via AuthService.userId inside drain().
        com.wordocious.app.data.PendingRecords.init(this)
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            kotlinx.coroutines.delay(3_000) // let auth restore the session first
            com.wordocious.app.data.PendingRecords.drain()
            // Block-list cache so leaderboards can filter immediately (iOS
            // WordociousApp parity). No-ops if the session isn't restored yet —
            // PublicProfileScreen retries on open.
            com.wordocious.app.data.ModerationService.loadBlockedIds()
        }
        com.wordocious.app.data.StoreManager.start(this)
        // UMP consent -> Mobile Ads init -> preload the game-start interstitial.
        com.wordocious.app.data.AdsManager.start(this)
        tagLaunchAfterUpdate()
        setContent {
            WordociousTheme {
                // Tell the SYSTEM BARS which way the app's palette leans.
                //
                // Nothing did this before, and on API 35+ it is the only lever
                // that still works: android:statusBarColor (themes.xml, still a
                // hardcoded light brand_bg) is DEPRECATED AND IGNORED there, so
                // the platform draws transparent bars and picks icon colour
                // purely from these two flags. Left unset they stay in their
                // light-background default — dark icons — which is invisible
                // against Dark/Ocean/Forest. Caught by the API 36 dark sweep:
                // the clock and battery were near-black on a near-black bar and
                // the gesture pill sat in a light strip under a dark keyboard.
                //
                // Derived from the palette's own background luminance rather
                // than a theme-name check, so a future palette gets this right
                // without anyone remembering to update a when-branch.
                val bg = WTheme.palette.bg
                val lightBars = bg.luminance() > 0.5f
                val view = LocalView.current
                LaunchedEffect(lightBars) {
                    val window = (view.context as android.app.Activity).window
                    WindowCompat.getInsetsController(window, view).apply {
                        isAppearanceLightStatusBars = lightBars
                        isAppearanceLightNavigationBars = lightBars
                    }
                }
                // Keep content clear of the system navigation bar, app-wide.
                //
                // targetSdk 35 opts us into FORCED edge-to-edge on Android 15+:
                // the window extends under the system bars and it is the app's
                // job to inset. Only MainScreen's bottom bar and ProfileScreen
                // ever did, so on Android 15/16 the nav bar sat on top of every
                // other screen's bottom row — including the keyboard's Z-M row,
                // backspace and ENTER, which made the game close to unplayable
                // (reported by the first Play tester on Android 16).
                //
                // Applied at the root rather than per screen because ~20 screens
                // have the same defect. NAVIGATION BARS ONLY, not safeDrawing:
                // screens hand-roll their top spacing (`padding(top = 48.dp)`),
                // so adding status-bar padding here would double it. The Surface
                // keeps painting WTheme.bg behind the bar, so the inset reads as
                // background rather than a dead strip.
                // The padding moved OFF the Surface and onto a Box inside it.
                // While it was on the Surface, the Surface stopped at the top of
                // the nav bar, so nothing painted WTheme.bg behind the bar —
                // what showed through was the light android:windowBackground.
                // In Dark that was a white strip under a dark keyboard (visible
                // in the API 36 dark sweep), which is precisely the "background
                // rather than a dead strip" the old comment claimed to deliver.
                // Surface now fills the whole window and the Box insets content.
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = WTheme.bg,
                ) {
                  Box(Modifier.fillMaxSize().navigationBarsPadding()) {
                    val isLoading by AuthService.isLoading.collectAsState()
                    val isAuthenticated by AuthService.isAuthenticated.collectAsState()
                    val isGuest by AuthService.isGuest.collectAsState()
                    // Render the home immediately on launch if the last run was
                    // signed in (common case), while the session quietly restores —
                    // no loading-spinner flash. Falls back to AuthScreen if the
                    // restore reveals no session.
                    val hadSession = remember { AuthService.hadPersistedSession() }
                    // onResume fires before the session restores on a cold start,
                    // and PresenceService.start() no-ops without a user id — so
                    // also (re)connect whenever auth resolves or changes, exactly
                    // like iOS's onChange(of: userId) (WordociousApp.swift:66).
                    androidx.compose.runtime.LaunchedEffect(isAuthenticated) {
                        if (isAuthenticated) {
                            com.wordocious.app.data.PresenceService.start()
                            // FCM's first token can arrive before sign-in, when
                            // there is no user id to key the row on — so push it
                            // again here, mirroring iOS PushRegistration.register().
                            com.wordocious.app.data.PushRegistration.register()
                        } else {
                            com.wordocious.app.data.PresenceService.stop()
                        }
                    }

                    when {
                        isAuthenticated || isGuest || (isLoading && hadSession) -> {
                            val profile by AuthService.profile.collectAsState()
                            Box(Modifier.fillMaxSize()) {
                                MainScreen()
                                // First-run onboarding cover (web WelcomeModal / iOS WelcomeView).
                                if (profile?.hasOnboarded == false) {
                                    com.wordocious.app.ui.WelcomeScreen()
                                }
                            }
                        }
                        isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = WTheme.primary)
                        }
                        else -> AuthScreen(onAuthenticated = { /* state flow re-composes */ })
                    }
                  }
                }
            }
        }
    }

    /**
     * Tag whether THIS launch is the first one after the installed version
     * changed, so the next crash report says so instead of leaving us guessing.
     *
     * Two real users hit a fatal `RuntimeException: Window couldn't find
     * content container view` inside setContent on 2026-07-30, and both were on
     * the build that had just been replaced — one within eight minutes of the
     * new bundle going out. Every occurrence seen locally was also immediately
     * after `adb install -r` swapped the APK under a running app. That points
     * at stale resources after an in-place update rather than a defect in the
     * layout, but "points at" is not "proved", and a speculative theme change
     * to a crash that cannot be reproduced on demand is how you make it worse.
     *
     * The tag rides on any event Sentry sends from this process, so a single
     * further occurrence settles it: true means update-race and it will fade as
     * the build churn stops; false means a real defect and this comment is
     * wrong.
     */
    private fun tagLaunchAfterUpdate() {
        runCatching {
            val current = packageManager.getPackageInfo(packageName, 0).longVersionCode.toInt()
            val previous = com.wordocious.app.data.SettingsPref.get(LAST_LAUNCHED_VERSION, -1)
            io.sentry.Sentry.setTag("first_launch_after_update", (previous != -1 && previous != current).toString())
            io.sentry.Sentry.setTag("previous_version_code", previous.toString())
            if (previous != current) com.wordocious.app.data.SettingsPref.set(LAST_LAUNCHED_VERSION, current)
        }
    }

    /**
     * Presence socket lifecycle — iOS runs the same start/stop on scenePhase
     * (WordociousApp.swift:41-66). PresenceService was fully implemented on
     * Android but never called from anywhere, so Android players were missing
     * from the server's /presence total and the LIVE count on Home
     * systematically under-reported the real player base.
     */
    override fun onResume() {
        super.onResume()
        com.wordocious.app.data.PresenceService.start()
    }

    override fun onPause() {
        super.onPause()
        com.wordocious.app.data.PresenceService.stop()
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        // singleTask routes app links here instead of relaunching. setIntent
        // makes this the activity's current intent, so anything that later reads
        // getIntent() (and a config change) sees the link, not the launch intent.
        setIntent(intent)
        com.wordocious.app.data.DeepLinkRouter.handle(intent.data)
        // The browser fallback almost always lands HERE rather than onCreate —
        // the app is still alive behind the Custom Tab.
        com.wordocious.app.data.AuthService.completeBrowserSignIn(intent)
    }
}

/**
 * Device-LOCAL date string "YYYY-MM-DD" — matches web `getTodayLocal()` and iOS
 * `LeaderboardService.todayLocal()`. The daily puzzle, recording day, and
 * leaderboard grouping ALL key off local midnight (NOT UTC) for cross-platform
 * parity — two players in the same timezone share the same puzzle + leaderboard.
 */
fun todayLocalDate(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getDefault() }.format(Date())

/** UTC date — used ONLY for daily-VS matchmaking so all timezones share one
 *  queue bucket (mirrors web getTodayUTC). Solo dailies stay on local date. */
fun todayUTCDate(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())

/** Yesterday's local date — for "Yesterday's Winners" (web `getYesterdayLocal()`). */
fun yesterdayLocalDate(): String {
    val cal = java.util.Calendar.getInstance().apply { add(java.util.Calendar.DAY_OF_YEAR, -1) }
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getDefault() }.format(cal.time)
}

/** Daily seed for a given mode — matches `generateDailySeed(date, modeName)` in Kotlin core. */
fun todayLocalSeed(modeName: String): String = generateDailySeed(todayLocalDate(), modeName)
