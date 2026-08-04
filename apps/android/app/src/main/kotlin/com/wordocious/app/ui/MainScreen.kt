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
import androidx.compose.foundation.layout.statusBarsPadding
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
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.zIndex
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
    /** Filled twin of [drawable], shown while the tab is active. */
    val drawableFilled: Int? = null,
)

private val TABS = listOf(
    TabItem("Home", Icons.Filled.Home, Icons.Outlined.Home),
    TabItem("Leaderboard", Icons.Filled.EmojiEvents, Icons.Outlined.EmojiEvents),
    TabItem("Profile", Icons.Filled.Person, Icons.Outlined.Person),
    // iOS/web use a crown for Records; Material has no crown, so use our asset.
    TabItem("Records", null, null, R.drawable.ic_crown, R.drawable.ic_crown_filled),
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
    val haptics = LocalHapticFeedback.current
    Column(
        Modifier.fillMaxWidth().background(WTheme.bg),
    ) {
        Box(Modifier.fillMaxWidth().height(1.5.dp).background(WTheme.border))
        Row(
            // Root Surface (MainActivity) now applies the nav-bar inset app-wide;
            // padding here too would leave a gap above the bar.
            Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp),
        ) {
            TABS.forEachIndexed { i, tab ->
                val active = selected == i
                val tint = if (active) WTheme.primary else WTheme.textMuted
                Column(
                    Modifier.weight(1f).clickableNoRipple {
                        // iOS pairs every tab tap with Haptics.tap() (RootTabView.swift:162);
                        // ripple is suppressed here, so this is the only press feedback.
                        if (!WTheme.reducedMotion) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onSelect(i)
                    },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    if (tab.drawable != null) {
                        // Same outline→filled swap the Material tabs get.
                        val res = if (active) (tab.drawableFilled ?: tab.drawable) else tab.drawable
                        Icon(painterResource(res), tab.label, tint = tint, modifier = Modifier.size(20.dp))
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

/**
 * Unlimited seed for a mode — 1:1 port of iOS `resolvedUnlimitedSeed`
 * (HomeView.swift:613-626). Resumes the in-progress non-daily puzzle if one
 * exists, isn't finished, and is <24h old (web purges practice saves after a
 * day); otherwise mints a fresh seed and remembers it as the current one.
 * Without this, every tap of an Unlimited card discarded a half-solved board.
 */
private fun resolvedUnlimitedSeed(mode: com.wordocious.core.GameMode): String {
    val key = "unlimited-current-${mode.name}"
    val saved = com.wordocious.app.data.SettingsPref.get(key, "")
    if (saved.isNotEmpty()) {
        val state = com.wordocious.app.data.GamePersistence.load(saved, mode)
        if (state != null && state.status == com.wordocious.core.GameStatus.PLAYING &&
            System.currentTimeMillis() - state.startTime < 24.0 * 3600 * 1000
        ) {
            return saved
        }
    }
    val fresh = "unlimited-${mode.name}-${System.currentTimeMillis()}"
    com.wordocious.app.data.SettingsPref.set(key, fresh)
    return fresh
}

/**
 * Fresh unlimited seed for a mode — mirrors iOS RootTabView.mintUnlimitedSeed:
 * always a NEW puzzle (the post-game "Keep playing" CTA promises one), recorded
 * as the mode's current unlimited game so the Home card resumes it if the
 * player bails mid-board.
 */
private fun freshUnlimitedSeed(mode: com.wordocious.core.GameMode): String {
    val fresh = "unlimited-${mode.name}-${System.currentTimeMillis()}"
    com.wordocious.app.data.SettingsPref.set("unlimited-current-${mode.name}", fresh)
    return fresh
}

/**
 * Hidden-but-alive tab: kept in composition so its state survives a tab switch
 * (iOS `TabView` keeps every tab alive — RootTabView.swift:8-9), but drawn as
 * nothing, laid under the active tab, and blocked from receiving touches.
 */
private fun Modifier.hiddenTab(): Modifier = this
    .zIndex(0f)
    .drawWithContent { /* inactive tab: composed for state only, never drawn */ }
    .pointerInput(Unit) {
        awaitPointerEventScope {
            while (true) {
                awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() }
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
    // Warm-resume day rollover (founder-approved UX, iOS WordociousApp parity):
    // if the LOCAL day changed while backgrounded, reset the landing surface
    // exactly like a cold start — Home tab, Daily toggle (App.onCreate resets
    // the pref on cold start; HomeScreen resets its own composed state), and no
    // solo game auto-showing. The in-progress unlimited board is NOT deleted:
    // its save + "unlimited-current-*" marker survive, so the Unlimited grid
    // resumes it. Same-day resumes leave everything untouched (nobody gets
    // yanked out of a game they backgrounded minutes ago). Live VS surfaces
    // (vsActive / vsLobby / vsInvite) are deliberately left alone.
    val mainLifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    var lastActiveDay by remember { mutableStateOf(com.wordocious.app.todayLocalDate()) }
    androidx.compose.runtime.DisposableEffect(mainLifecycleOwner) {
        val obs = androidx.lifecycle.LifecycleEventObserver { _, event ->
            when (event) {
                androidx.lifecycle.Lifecycle.Event.ON_RESUME -> {
                    val today = com.wordocious.app.todayLocalDate()
                    if (today != lastActiveDay) {
                        lastActiveDay = today
                        com.wordocious.app.data.SettingsPref.set("pref-play-mode", "daily")
                        if (activeGame != null) { activeGame = null; activeSeed = null }
                        publicProfileId = null
                        selectedTab = 0
                    }
                }
                // Track the day the app was last ACTIVE, so a session that
                // stays foregrounded across midnight isn't reset on its next
                // brief background/return.
                androidx.lifecycle.Lifecycle.Event.ON_PAUSE -> {
                    lastActiveDay = com.wordocious.app.todayLocalDate()
                }
                else -> {}
            }
        }
        mainLifecycleOwner.lifecycle.addObserver(obs)
        onDispose { mainLifecycleOwner.lifecycle.removeObserver(obs) }
    }
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
    // Widget chip taps (wordocious://daily/KEY via DeepLinkRouter) open that
    // mode's daily — same launch state as the home grid / leaderboard Play CTA
    // (null seed = today's daily). One-shot: consume and clear.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        com.wordocious.app.data.DeepLinkRouter.dailyMode.collect { m ->
            if (m != null) {
                com.wordocious.app.data.DeepLinkRouter.dailyMode.value = null
                modeCardFor(m)?.let {
                    vsLobby = false; vsActive = null; vsInvite = null
                    activeSeed = null; activeGame = it
                }
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
        // Fresh server check — the cached profile here can predate a game
        // played on another device, which showed this modal after the user
        // had already played today (iOS/web get the same fix).
        val fresh = com.wordocious.app.data.ShieldService.freshStreakAtRisk(p.id) ?: return@LaunchedEffect
        if (fresh.second) showShieldModal = true
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
        // activeSeed IS a key: Play Again / "Keep playing: Unlimited" swap in a
        // fresh unlimited seed for the SAME card, which must re-latch (card
        // alone left the old seed — and the old VM — in place).
        val seed = androidx.compose.runtime.remember(card, activeSeed) {
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
            // "Keep playing: Unlimited <Mode>" (Pro) from a daily result — the
            // SAME mode with a fresh unlimited seed (same launch state the home
            // grid's Unlimited cards set).
            onOpenUnlimited = { m ->
                modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it }
            },
        )
        return
    }

    // Status-bar inset for the OVERLAY surfaces. These three blocks `return`
    // before the Scaffold below, and the Scaffold is what supplies the top inset
    // (no topBar slot -> innerPadding.top == contentWindowInsets.top). The root
    // Surface in MainActivity supplies navigationBarsPadding ONLY, so under
    // targetSdk 35's forced edge-to-edge on Android 15+ the Done / Close / Save
    // controls on Settings, Pro, Edit Profile, Auth and the info screens drew
    // under the system clock — and the top-right ones were often untappable.
    // Paywall and profile-commit surfaces, so this was revenue and lost edits.
    infoRoute?.let { route ->
      androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().statusBarsPadding()) {
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
      }
        return
    }

    // Settings overlay (opened from the shared header gear, on any tab)
    // Guest sign-in overlay (header "Sign In"). Presented OVER the tabs and
    // dismissible, like iOS's AuthView sheet — guest state is untouched, so
    // backing out returns you to the exact tab you were on. On success the
    // auth state flow flips and the root gate re-composes on its own.
    if (showSignIn) {
        androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().statusBarsPadding()) {
            AuthScreen(onAuthenticated = { showSignIn = false }, onDismiss = { showSignIn = false })
        }
        return
    }

    if (showSettings) {
        androidx.activity.compose.BackHandler { showSettings = false }
        androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().statusBarsPadding()) {
            SettingsScreen(onDone = { showSettings = false }, onOpenInfo = { infoRoute = it })
        }
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
                // Switching tabs pops the public-profile push, mirroring iOS's
                // per-tab path reset (RootTabView.swift:38-47).
                BottomNav(selected = selectedTab, onSelect = { publicProfileId = null; selectedTab = it })
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
                // iOS hosts all four tabs in a TabView, "which keeps every tab's
                // state alive" (RootTabView.swift:8-9). A `when` disposed the whole
                // subtree, so e.g. the leaderboard's mode pick, scroll position and
                // fetched rows reset on every tab switch. Compose each tab on first
                // visit and keep it alive thereafter, hidden when inactive.
                // Plain (non-snapshot) set: adding to it must not itself trigger a
                // recomposition — the tab switch already did.
                val visitedTabs = remember { mutableSetOf(0) }
                visitedTabs.add(selectedTab)
                // Insertion-ordered and append-only, so each tab keeps its slot
                // (and therefore its state) across recompositions.
                visitedTabs.forEach { tab ->
                    val activeTab = tab == selectedTab
                    Box(Modifier.fillMaxSize().then(if (activeTab) Modifier.zIndex(1f) else Modifier.hiddenTab())) {
                        when (tab) {
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
                                            resolvedUnlimitedSeed(card.engineMode) else null
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
                    }
                }

                // Public profile is a PUSH INSIDE the tab, not a new root: iOS
                // renders it in the tab's NavigationStack without .hidesBottomNav
                // (ProfileTab.swift:1005-1015), so header + nav + ad banner stay.
                publicProfileId?.let { pid ->
                    androidx.activity.compose.BackHandler { publicProfileId = null }
                    Box(Modifier.fillMaxSize().zIndex(2f).background(WTheme.bg)) {
                        PublicProfileScreen(
                            userId = pid,
                            onClose = { publicProfileId = null },
                            // Profile-to-profile hop (nemesis row / podium rows):
                            // same push-inside-the-tab pattern, new target id.
                            onOpenProfile = { publicProfileId = it },
                        )
                    }
                }

                if (showShieldModal) {
                    val p = profile
                    StreakShieldModal(
                        streak = p?.dailyLoginStreak ?: 0,
                        shields = p?.streakShields ?: 0,
                        onUseShield = {
                            p?.id?.let { com.wordocious.app.data.ShieldService.useShield(it) }
                            com.wordocious.app.data.AuthService.refreshProfile()
                            // Modal shows its "Streak saved!" beat, then calls onClose itself.
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
