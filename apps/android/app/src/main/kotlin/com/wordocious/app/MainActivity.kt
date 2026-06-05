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
import com.wordocious.app.ui.GameSmokeScreen
import com.wordocious.app.ui.HomeScreen
import com.wordocious.app.ui.ModeCard
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.theme.WordociousTheme

/**
 * App entry + minimal in-app navigation (Home ↔ Game). A real nav graph
 * (and the 4-tab shell — Home/Leaderboard/Profile/Records) lands with the
 * audit-then-match pass; this keeps the tree shallow while the screens are
 * built out. Web is the source of truth for every screen.
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

@Composable
private fun AppNav() {
    var active by remember { mutableStateOf<ModeCard?>(null) }
    val card = active

    if (card?.engineMode != null) {
        BackHandler { active = null }
        GameSmokeScreen(mode = card.engineMode, title = card.title, onBack = { active = null })
    } else {
        // null engineMode (VS) currently has no single-player screen → stay on Home.
        HomeScreen(onSelectMode = { active = it })
    }
}
