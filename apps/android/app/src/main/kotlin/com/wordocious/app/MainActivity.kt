package com.wordocious.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.wordocious.app.ui.HomeScreen
import com.wordocious.app.ui.ModeCard
import com.wordocious.app.ui.game.GameScreen
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.theme.WordociousTheme
import com.wordocious.core.generateDailySeed
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * App entry + minimal Home ↔ Game navigation. The 4-tab shell
 * (Home/Leaderboard/Profile/Records) and NavHost land in the next UI phase.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WordociousTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = WTheme.bg) {
                    AppNav()
                }
            }
        }
    }
}

/** UTC date string "YYYY-MM-DD" — matches the web `getDailyDate()` */
private fun todayUtcDate(): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    return sdf.format(Date())
}

@Composable
private fun AppNav() {
    var activeCard by remember { mutableStateOf<ModeCard?>(null) }
    val card = activeCard

    if (card?.engineMode != null) {
        BackHandler { activeCard = null }
        val seed = generateDailySeed(todayUtcDate(), card.engineMode.name)
        GameScreen(
            mode = card.engineMode,
            title = card.title,
            seed = seed,
            onBack = { activeCard = null },
        )
    } else {
        // VS Battle (null engineMode) → stay on Home for now.
        HomeScreen(onSelectMode = { activeCard = it })
    }
}
