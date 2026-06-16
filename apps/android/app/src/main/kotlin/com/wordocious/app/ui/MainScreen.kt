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
import androidx.compose.runtime.collectAsState
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
    // Explicit seed for the active game — non-null only for Pro Unlimited (a fresh
    // non-daily seed); null falls back to today's daily seed.
    var activeSeed by remember { mutableStateOf<String?>(null) }
    var showSettings by remember { mutableStateOf(false) }
    // Help / About / Privacy / Terms / Support overlay route (null = none).
    var infoRoute by remember { mutableStateOf<String?>(null) }
    // VS flow: lobby (true) → active match (mode, isDaily).
    var vsLobby by remember { mutableStateOf(false) }
    var vsActive by remember { mutableStateOf<Pair<com.wordocious.core.GameMode, Boolean>?>(null) }
    // Public profile overlay (web /profile/[id]) — opened from leaderboard/records usernames.
    var publicProfileId by remember { mutableStateOf<String?>(null) }
    // Invite-accepted VS match (mode + invite code) from the pending-invites banner.
    var vsInvite by remember { mutableStateOf<Pair<com.wordocious.core.GameMode, String>?>(null) }
    // Streak-shield prompt — web StreakShieldProvider: checked once per session
    // when the profile is available and the streak is at risk.
    val profile by com.wordocious.app.data.AuthService.profile.collectAsState()
    var shieldChecked by remember { mutableStateOf(false) }
    var showShieldModal by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(profile?.id) {
        val p = profile ?: return@LaunchedEffect
        if (shieldChecked) return@LaunchedEffect
        shieldChecked = true
        if (p.dailyLoginStreak > 0 && com.wordocious.app.data.ShieldService.isStreakAtRisk(p.lastPlayedAt)) {
            showShieldModal = true
        }
    }

    vsInvite?.let { (inviteMode, code) ->
        androidx.activity.compose.BackHandler { vsInvite = null }
        com.wordocious.app.ui.vs.VSGameScreen(
            mode = inviteMode, isDaily = false, inviteCode = code,
            onHome = { vsInvite = null },
            onGoPro = { vsInvite = null; infoRoute = "pro" },
        )
        return
    }

    publicProfileId?.let { pid ->
        androidx.activity.compose.BackHandler { publicProfileId = null }
        PublicProfileScreen(userId = pid, onClose = { publicProfileId = null })
        return
    }

    // VS match (fullscreen, no bottom nav)
    vsActive?.let { (vsMode, vsDaily) ->
        androidx.activity.compose.BackHandler { vsActive = null }
        com.wordocious.app.ui.vs.VSGameScreen(
            mode = vsMode, isDaily = vsDaily,
            onHome = { vsActive = null; vsLobby = false },
            onGoPro = { vsActive = null; infoRoute = "pro" },
        )
        return
    }
    if (vsLobby) {
        androidx.activity.compose.BackHandler { vsLobby = false }
        com.wordocious.app.ui.vs.VSLobbyScreen(
            onPlay = { m, daily -> vsActive = m to daily },
            onGoPro = { vsLobby = false; infoRoute = "pro" },
            onClose = { vsLobby = false },
        )
        return
    }

    // Game screen shown fullscreen (no bottom nav — matches web behavior)
    val card = activeGame
    if (card?.engineMode != null) {
        // Latch the seed for the lifetime of this game: todayLocalSeed()
        // re-evaluated on every recomposition, so any recomposition after
        // local midnight (foreground return, profile refresh) minted the NEXT
        // day's seed and replaced the in-progress board with a fresh puzzle.
        val seed = androidx.compose.runtime.remember(card) {
            activeSeed ?: com.wordocious.app.todayLocalSeed(card.engineMode.name)
        }
        androidx.activity.compose.BackHandler { activeGame = null; activeSeed = null }
        GameScreen(
            mode = card.engineMode,
            title = card.title,
            seed = seed,
            onBack = { activeGame = null; activeSeed = null },
            // Pro Unlimited: "Play Again" mints a fresh non-daily seed for the
            // same mode (web parity — Play Again on non-daily games).
            onPlayAgain = { activeSeed = "unlimited-${card.engineMode.name}-${System.nanoTime()}" },
        )
        return
    }

    // Help / Info overlay (Help from header; About/Privacy/Terms/Support from Settings)
    infoRoute?.let { route ->
        androidx.activity.compose.BackHandler { infoRoute = null }
        when (route) {
            "help" -> HelpScreen(onDone = { infoRoute = null })
            "pro" -> ProScreen(onDone = { infoRoute = null })
            "edit" -> EditProfileScreen(onDone = { infoRoute = null })
            else -> InfoScreen(kind = route, onDone = { infoRoute = null })
        }
        return
    }

    // Settings overlay (opened from the shared header gear, on any tab)
    if (showSettings) {
        androidx.activity.compose.BackHandler { showSettings = false }
        SettingsScreen(onDone = { showSettings = false }, onOpenInfo = { infoRoute = it })
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
        androidx.compose.foundation.layout.Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            // Shared header on EVERY tab (wordmark + PRO + Help + Settings + streak/shield)
            AppHeader(onSettings = { showSettings = true }, onHelp = { infoRoute = "help" })
            Box(modifier = Modifier.weight(1f).fillMaxSize()) {
                when (selectedTab) {
                    0 -> HomeScreen(
                        onJoinInvite = { m, code -> vsInvite = m to code },
                        onSelectMode = { card, unlimited ->
                            if (card.id == "vs") vsLobby = true
                            else {
                                activeGame = card
                                activeSeed = if (unlimited && card.engineMode != null)
                                    "unlimited-${card.engineMode.name}-${System.nanoTime()}" else null
                            }
                        },
                        onGoPro = { infoRoute = "pro" },
                        onVs = { card -> card.engineMode?.let { vsActive = it to false } },
                        onNavigate = { infoRoute = it },
                    )
                    1 -> LeaderboardScreen(
                        onOpenProfile = { publicProfileId = it },
                        onPlay = { mode -> modeCardFor(mode)?.let { activeGame = it; activeSeed = null } },
                    )
                    2 -> ProfileScreen(
                        onGoPro = { infoRoute = "pro" },
                        onEditProfile = { infoRoute = "edit" },
                        // Today's Dailies badge → open that mode's daily game (completed
                        // puzzle if played, fresh if not) — web parity.
                        onPlayDaily = { mode -> modeCardFor(mode)?.let { activeGame = it; activeSeed = null } },
                    )
                    3 -> RecordsScreen(onOpenProfile = { publicProfileId = it })
                }

                if (showShieldModal) {
                    val p = profile
                    StreakShieldModal(
                        streak = p?.dailyLoginStreak ?: 0,
                        shields = p?.streakShields ?: 0,
                        onUseShield = {
                            p?.id?.let { com.wordocious.app.data.ShieldService.useShield(it) }
                            com.wordocious.app.data.AuthService.refreshProfile()
                            showShieldModal = false
                        },
                        onDecline = {
                            p?.id?.let { com.wordocious.app.data.ShieldService.declineStreak(it) }
                            com.wordocious.app.data.AuthService.refreshProfile()
                            showShieldModal = false
                        },
                        onClose = { showShieldModal = false },
                    )
                }
            }
        }
    }
}
