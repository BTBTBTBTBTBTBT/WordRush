package com.wordocious.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.game.GameScreen
import com.wordocious.app.ui.theme.WTheme

/**
 * Root 4-tab shell — matches the web BottomNav (Home / Leaderboard / Profile / Records).
 * The tab bar is hidden when a game screen is active (web hides it on game pages too).
 */
private data class TabItem(val label: String, val icon: ImageVector)

private val TABS = listOf(
    TabItem("Home", Icons.Filled.Home),
    TabItem("Leaderboard", Icons.Filled.EmojiEvents),
    TabItem("Profile", Icons.Filled.Person),
    TabItem("Records", Icons.Filled.BarChart),
)

@Composable
fun MainScreen() {
    var selectedTab by remember { mutableIntStateOf(0) }
    var activeGame by remember { mutableStateOf<ModeCard?>(null) }

    // Game screen shown fullscreen (no bottom nav — matches web behavior)
    val card = activeGame
    if (card?.engineMode != null) {
        val seed = com.wordocious.app.todayUtcSeed(card.engineMode.name)
        androidx.activity.compose.BackHandler { activeGame = null }
        GameScreen(
            mode = card.engineMode,
            title = card.title,
            seed = seed,
            onBack = { activeGame = null },
        )
        return
    }

    Scaffold(
        containerColor = WTheme.bg,
        bottomBar = {
            NavigationBar(
                containerColor = WTheme.surface,
                tonalElevation = androidx.compose.ui.unit.Dp.Unspecified,
            ) {
                TABS.forEachIndexed { i, tab ->
                    NavigationBarItem(
                        selected = selectedTab == i,
                        onClick = { selectedTab = i },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = {
                            Text(
                                tab.label,
                                fontSize = 10.sp,
                                fontWeight = if (selectedTab == i) FontWeight.Black else FontWeight.Bold,
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = WTheme.primary,
                            selectedTextColor = WTheme.primary,
                            unselectedIconColor = WTheme.textMuted,
                            unselectedTextColor = WTheme.textMuted,
                            indicatorColor = WTheme.primary.copy(alpha = 0.12f),
                        ),
                    )
                }
            }
        },
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selectedTab) {
                0 -> HomeScreen(onSelectMode = { activeGame = it })
                1 -> LeaderboardScreen()
                2 -> ProfileScreen()
                3 -> RecordsScreen()
            }
        }
    }
}
