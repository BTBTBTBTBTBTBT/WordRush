package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.game.GameScreen
import com.wordocious.app.ui.theme.WTheme

/**
 * Root 4-tab shell — matches the web BottomNav (Home / Leaderboard / Profile / Records).
 * The tab bar is hidden when a game screen is active (web hides it on game pages too).
 */
private data class TabItem(
    val label: String,
    /** Filled variant — shown only while the tab is active (iOS `<icon>.fill`). */
    val icon: ImageVector?,
    /** Outline variant — the inactive state. */
    val outlineIcon: ImageVector?,
    /** Vector-asset fallback for icons Material doesn't ship (Records = crown). */
    val drawable: Int? = null,
)

private val TABS = listOf(
    TabItem("Home", Icons.Filled.Home, Icons.Outlined.Home),
    TabItem("Leaderboard", Icons.Filled.EmojiEvents, Icons.Outlined.EmojiEvents),
    TabItem("Profile", Icons.Filled.Person, Icons.Outlined.Person),
    // iOS/web use a crown for Records; Material has no crown, so use our asset.
    TabItem("Records", null, null, R.drawable.ic_crown),
)

/**
 * Bottom navigation — a 1:1 port of iOS `BottomNav` (RootTabView.swift).
 *
 * WHY THIS IS HAND-ROLLED: Material3's `NavigationBar` draws a tonal pill
 * behind the selected item and sits on `surface`. iOS draws neither — it uses
 * the page background, a 1.5dp top hairline, an outline→filled icon swap, and a
 * 4dp dot under the active label. Using the Material default made the single
 * most permanently-visible element of the app read as a different product.
 */
@Composable
private fun BottomNav(selected: Int, onSelect: (Int) -> Unit) {
    Column(
        Modifier.fillMaxWidth().background(WTheme.bg),
    ) {
        Box(Modifier.fillMaxWidth().height(1.5.dp).background(WTheme.border))
        Row(
            Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp).navigationBarsPadding(),
        ) {
            TABS.forEachIndexed { i, tab ->
                val active = selected == i
                val tint = if (active) WTheme.primary else WTheme.textMuted
                Column(
                    Modifier.weight(1f).clickableNoRipple { onSelect(i) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    if (tab.drawable != null) {
                        Icon(painterResource(tab.drawable), tab.label, tint = tint, modifier = Modifier.size(20.dp))
                    } else {
                        Icon(
                            (if (active) tab.icon else tab.outlineIcon)!!,
                            tab.label, tint = tint, modifier = Modifier.size(20.dp),
                        )
                    }
                    Text(tab.label, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = tint, maxLines = 1)
                    // 4dp active dot — transparent when inactive so labels stay aligned.
                    Box(
                        Modifier.size(4.dp).clip(CircleShape)
                            .background(if (active) WTheme.primary else Color.Transparent),
                    )
                }
            }
        }
    }
}

@Composable
fun MainScreen() {
    var selectedTab by remember { mutableIntStateOf(0) }
    var activeGame by remember { mutableStateOf<ModeCard?>(null) }
    // Explicit seed for the active game — non-null only for Pro Unlimited (a fresh
    // non-daily seed); null falls back to today's daily seed.
    var activeSeed by remember { mutableStateOf<String?>(null) }
    var showSettings by remember { mutableStateOf(false) }
    var showSignIn by remember { mutableStateOf(false) }
    // Help / About / Privacy / Terms / Support overlay route (null = none).
    var infoRoute by remember { mutableStateOf<String?>(null) }
    // VS flow: lobby (true) → active match (mode, isDaily).
    var vsLobby by remember { mutableStateOf(false) }
    var vsActive by remember { mutableStateOf<Pair<com.wordocious.core.GameMode, Boolean>?>(null) }
    // Public profile overlay (web /profile/[id]) — opened from leaderboard/records usernames.
    var publicProfileId by remember { mutableStateOf<String?>(null) }
    // Invite-accepted VS match (mode + invite code) from the pending-invites banner.
    var vsInvite by remember { mutableStateOf<Pair<com.wordocious.core.GameMode, String>?>(null) }
    // App-link VS invites (wordocious.com/vs/join/* via DeepLinkRouter) feed the
    // same state — one-shot: consume and clear so back doesn't re-open it.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        com.wordocious.app.data.DeepLinkRouter.vsInvite.collect { link ->
            if (link != null) {
                vsInvite = link
                com.wordocious.app.data.DeepLinkRouter.vsInvite.value = null
            }
        }
    }
    // Password-recovery app link → native new-password dialog (session already
    // established by the code exchange in DeepLinkRouter).
    val showNewPassword by com.wordocious.app.data.DeepLinkRouter.showNewPassword.collectAsState()
    if (showNewPassword) {
        NewPasswordDialog(onDone = { com.wordocious.app.data.DeepLinkRouter.showNewPassword.value = false })
    }
    // Cross-device auth links can't exchange in-app — hand off to a browser
    // explicitly (a plain VIEW intent would loop back into the app link).
    val fallbackContext = androidx.compose.ui.platform.LocalContext.current
    val fallbackUrl by com.wordocious.app.data.DeepLinkRouter.browserFallback.collectAsState()
    androidx.compose.runtime.LaunchedEffect(fallbackUrl) {
        val url = fallbackUrl ?: return@LaunchedEffect
        com.wordocious.app.data.DeepLinkRouter.browserFallback.value = null
        val browse = android.content.Intent.makeMainSelectorActivity(
            android.content.Intent.ACTION_MAIN, android.content.Intent.CATEGORY_APP_BROWSER,
        ).setData(android.net.Uri.parse(url))
        runCatching { fallbackContext.startActivity(browse) }
    }
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
            // Pro "Play Unlimited VS" from the already-played daily screen → lobby.
            onPlayUnlimited = { vsActive = null; vsLobby = true },
        )
        return
    }
    if (vsLobby) {
        androidx.activity.compose.BackHandler { vsLobby = false }
        com.wordocious.app.ui.vs.VSLobbyScreen(
            onPlay = { m, daily -> vsActive = m to daily },
            onEnterInvite = { m, code -> vsLobby = false; vsInvite = m to code },
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
            // U3: "Next Daily" handoff from the results screen — same route as
            // the leaderboard Play CTA (swap activeGame; null seed = today's
            // daily). remember(card) re-mints the seed for the new mode.
            onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
        )
        return
    }

    // Help / Info overlay (Help from header; About/Privacy/Terms/Support from Settings)
    infoRoute?.let { route ->
        androidx.activity.compose.BackHandler { infoRoute = null }
        when (route) {
            "help" -> HowToPlayScreen(onDone = { infoRoute = null })
            "faq" -> HelpScreen(onDone = { infoRoute = null }, initialTab = 2, showTabs = false)
            "guides" -> GuidesIndexScreen(onDone = { infoRoute = null })
            "strategy" -> StrategyScreen(onDone = { infoRoute = null })
            "words" -> WordsScreen(onDone = { infoRoute = null })
            "pastwords" -> WordsScreen(onDone = { infoRoute = null }, navTitle = "Word of the Day")
            "pro" -> ProScreen(onDone = { infoRoute = null })
            "edit" -> EditProfileScreen(onDone = { infoRoute = null })
            else -> InfoScreen(kind = route, onDone = { infoRoute = null })
        }
        return
    }

    // Settings overlay (opened from the shared header gear, on any tab)
    // Guest sign-in overlay (header "Sign In"). Presented OVER the tabs and
    // dismissible, like iOS's AuthView sheet — guest state is untouched, so
    // backing out returns you to the exact tab you were on. On success the
    // auth state flow flips and the root gate re-composes on its own.
    if (showSignIn) {
        AuthScreen(onAuthenticated = { showSignIn = false }, onDismiss = { showSignIn = false })
        return
    }

    if (showSettings) {
        androidx.activity.compose.BackHandler { showSettings = false }
        SettingsScreen(onDone = { showSettings = false }, onOpenInfo = { infoRoute = it })
        return
    }

    Scaffold(
        containerColor = WTheme.bg,
        bottomBar = {
            // iOS mounts the ad banner and the nav in ONE bottom inset so the
            // banner always sits directly above the nav on every tab and both
            // disappear together on immersive game screens (RootTabView.swift).
            Column(Modifier.fillMaxWidth()) {
                AdBannerContainer()
                BottomNav(selected = selectedTab, onSelect = { selectedTab = it })
            }
        },
    ) { innerPadding ->
        androidx.compose.foundation.layout.Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            // Shared header on EVERY tab (wordmark + PRO + Help + Settings + streak/shield)
            AppHeader(
                onSettings = { showSettings = true },
                onNav = { infoRoute = it },
                onSignIn = { showSignIn = true },
            )
            Box(modifier = Modifier.weight(1f).fillMaxSize()) {
                when (selectedTab) {
                    0 -> HomeScreen(
                        onJoinInvite = { m, code -> vsInvite = m to code },
                        onSelectMode = { card, unlimited ->
                            if (card.id == "vs") {
                                // Unlimited VS (Pro): the mode-picker lobby. Daily VS:
                                // launch the shared daily Classic match directly (queue
                                // or already-played finished screen).
                                if (unlimited) vsLobby = true
                                else vsActive = com.wordocious.core.GameMode.DUEL to true
                            } else {
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
