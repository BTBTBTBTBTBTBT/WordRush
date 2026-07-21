package com.wordocious.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
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
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
        setContent {
            WordociousTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = WTheme.bg) {
                    val isLoading by AuthService.isLoading.collectAsState()
                    val isAuthenticated by AuthService.isAuthenticated.collectAsState()
                    val isGuest by AuthService.isGuest.collectAsState()
                    // Render the home immediately on launch if the last run was
                    // signed in (common case), while the session quietly restores —
                    // no loading-spinner flash. Falls back to AuthScreen if the
                    // restore reveals no session.
                    val hadSession = remember { AuthService.hadPersistedSession() }

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
