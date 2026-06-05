package com.wordocious.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.wordocious.app.ui.MainScreen
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.theme.WordociousTheme
import com.wordocious.core.generateDailySeed
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * App entry. Navigation is owned by [MainScreen] (4-tab shell + game overlay).
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WordociousTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = WTheme.bg) {
                    MainScreen()
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
