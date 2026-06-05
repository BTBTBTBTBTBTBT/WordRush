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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.AuthScreen
import com.wordocious.app.ui.MainScreen
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.theme.WordociousTheme
import com.wordocious.core.generateDailySeed
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
        AuthService.initialize()
        setContent {
            WordociousTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = WTheme.bg) {
                    val isLoading by AuthService.isLoading.collectAsState()
                    val isAuthenticated by AuthService.isAuthenticated.collectAsState()

                    when {
                        isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = WTheme.primary)
                        }
                        !isAuthenticated -> AuthScreen(onAuthenticated = { /* state flow re-composes */ })
                        else -> MainScreen()
                    }
                }
            }
        }
    }
}

/** UTC date string matching the web's `getDailyDate()` → "YYYY-MM-DD". */
fun todayUtcDate(): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    return sdf.format(Date())
}

/** Daily seed for a given mode — matches `generateDailySeed(date, modeName)` in Kotlin core. */
fun todayUtcSeed(modeName: String): String = generateDailySeed(todayUtcDate(), modeName)
