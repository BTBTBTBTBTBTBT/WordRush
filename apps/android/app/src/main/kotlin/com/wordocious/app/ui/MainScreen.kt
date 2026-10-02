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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.zIndex
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.flow.first
import com.wordocious.app.ui.game.GameScreen
import com.wordocious.app.ui.theme.WTheme

/**
 * Root 4-tab shell — matches the web BottomNav (Home / Leaderboard / Stats / Friends;
 * D1 of the Stats + Friends redesign, founder 2026-09-26 — Profile and Records merged
 * into Stats, Friends promoted to a tab).
 * The tab bar is hidden when a game screen is active (web hides it on game pages too).
 */
private data class TabItem(
    val label: String,
    /** The tab's 3D icon (HEADER_SPEC §3). */
    val icon: Icon3DName,
)

private val TABS = listOf(
    TabItem("Home", Icon3DName.TAB_HOME),
    TabItem("Leaderboard", Icon3DName.TAB_LEADERBOARD),
    TabItem("Stats", Icon3DName.TAB_STATS),
    TabItem("Friends", Icon3DName.TAB_FRIENDS),
)

/**
 * Bottom navigation — a 1:1 port of iOS `BottomNav` (RootTabView.swift).
 *
 * WHY THIS IS HAND-ROLLED: Material3's `NavigationBar` draws a tonal pill
 * behind the selected item and sits on `surface`. iOS draws neither — it uses
 * the page background and a 1.5dp top hairline. The tab icons are the 3D set
 * (HEADER_SPEC §3): selected = full color, a −2 dp lift and a #7c3aed 900 label;
 * unselected = 45% opacity at 60% saturation with a gray label. Using the
 * Material default made the single most permanently-visible element of the app
 * read as a different product.
 */
@Composable
private fun BottomNav(selected: Int, onSelect: (Int) -> Unit) {
    val haptics = LocalHapticFeedback.current
    // Red dot on Friends while friend requests wait (§207 Tier 1 — web/iOS
    // badge parity; moved from Profile in D1). Listener keeps it live as requests arrive or resolve.
    var friendsVersion by remember { mutableIntStateOf(com.wordocious.app.data.FriendsService.version) }
    androidx.compose.runtime.DisposableEffect(Unit) {
        val remove = com.wordocious.app.data.FriendsService.addListener {
            friendsVersion = com.wordocious.app.data.FriendsService.version
        }
        onDispose { remove() }
    }
    androidx.compose.runtime.LaunchedEffect(Unit) { com.wordocious.app.data.FriendsService.load() }
    // Friends overhaul §5: the badge = pending requests + pocket games where it's your turn.
    // The games list refreshes every minute while the app is in the foreground.
    val navLifecycle = androidx.lifecycle.compose.LocalLifecycleOwner.current.lifecycle
    androidx.compose.runtime.LaunchedEffect(Unit) {
        navLifecycle.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.RESUMED) {
            while (true) {
                if (com.wordocious.app.data.AuthService.userId != null) com.wordocious.app.data.FriendlyGamesService.load()
                kotlinx.coroutines.delay(60_000)
            }
        }
    }
    val activeGames by com.wordocious.app.data.FriendlyGamesService.active.collectAsState()
    val friendsBadge = remember(friendsVersion, activeGames) {
        com.wordocious.app.data.FriendsService.incoming.size + activeGames.count { it.yourTurn }
    }
    // ART_SPEC §18.3 (the ChatGPT home mockup): a floating frosted pill — inset 12 dp
    // from the sides and the bottom safe area (the root Surface in MainActivity applies
    // the nav-bar inset app-wide), radius 26, a soft violet shadow. The Scaffold lays
    // the pages out above it, so the last row always clears the pill and only the
    // page background shows around it. Compose can't blur what is drawn behind a node,
    // so the pill takes the spec's no-blur fill: the surface at 94%.
    val pillShape = RoundedCornerShape(TAB_PILL_CORNER)
    Box(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = 12.dp, top = 6.dp)) {
        Row(
            Modifier.fillMaxWidth()
                .shadow(10.dp, pillShape, clip = false, ambientColor = HeaderInk.shadow, spotColor = HeaderInk.shadow)
                .clip(pillShape)
                .background(WTheme.surface.copy(alpha = 0.94f))
                .padding(top = 8.dp, bottom = 5.dp),
        ) {
            TABS.forEachIndexed { i, tab ->
                val active = selected == i
                Column(
                    Modifier.weight(1f).clickableNoRipple {
                        // iOS pairs every tab tap with Haptics.tap() (RootTabView.swift:162);
                        // ripple is suppressed here, so this is the only press feedback.
                        if (!WTheme.reducedMotion) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onSelect(i)
                    }.semantics(mergeDescendants = true) {
                        role = androidx.compose.ui.semantics.Role.Tab
                        this.selected = active
                    },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Box {
                        // §3: selected = full color with a small lift (−2 dp); unselected =
                        // the same icon at 45% opacity and 60% saturation.
                        Icon3D(
                            tab.icon, 28.dp,
                            Modifier.offset(y = if (active) (-2).dp else 0.dp),
                            alpha = if (active) 1f else 0.45f,
                            colorFilter = if (active) null else Icon3DMuted,
                        )
                        // Pending requests + your-turn games → a count on the Friends icon.
                        if (tab.label == "Friends" && friendsBadge > 0) {
                            Box(
                                Modifier.align(Alignment.TopEnd).offset(x = 7.dp, y = (-4).dp)
                                    .size(width = if (friendsBadge > 9) 20.dp else 15.dp, height = 15.dp)
                                    .clip(CircleShape).background(Color(0xFF7C3AED)),   // win purple (founder, Aug 11)
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    if (friendsBadge > 99) "99+" else "$friendsBadge",
                                    fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color.White, maxLines = 1,
                                )
                            }
                        }
                    }
                    Text(
                        tab.label, fontSize = 10.sp, maxLines = 1,
                        fontWeight = if (active) FontWeight.Black else FontWeight.ExtraBold,
                        color = if (active) HeaderInk.tabSelected else WTheme.textMuted,
                    )
                    // §18.3 the selected tab's 3 dp purple underline pill under its label.
                    Box(
                        Modifier.size(width = 18.dp, height = 3.dp).clip(CircleShape)
                            .background(if (active) HeaderInk.tabSelected else Color.Transparent),
                    )
                }
            }
        }
    }
}

/** §18.3 the floating tab bar pill's corner radius. */
private val TAB_PILL_CORNER = 26.dp

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
 * True while a tab is off screen — another tab is selected, or a full-screen layer covers the
 * tabs. Its pollers and one-second tickers wait on it instead of running (founder, 2026-09-29).
 */
val LocalTabHidden = androidx.compose.runtime.staticCompositionLocalOf<androidx.compose.runtime.State<Boolean>> { androidx.compose.runtime.mutableStateOf(false) }

/** Suspends while the tab is hidden; returns at once when it is on screen. */
suspend fun androidx.compose.runtime.State<Boolean>.awaitShown() {
    if (value) androidx.compose.runtime.snapshotFlow { value }.first { !it }
}

/**
 * Hidden-but-alive tab: kept in composition so its state survives a tab switch
 * (iOS `TabView` keeps every tab alive — RootTabView.swift:8-9), but drawn as
 * nothing, laid under the active tab, and blocked from receiving touches.
 */
private fun Modifier.hiddenTab(): Modifier = this
    .zIndex(0f)
    .clearAndSetSemantics {} // off screen = out of the accessibility tree too (TalkBack read hidden tabs)
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
    // Home redesign (founder, 2026-10-01): the More Games sheet is gone (its games are
    // Home's PUZZLES section). Home stays composed under a game (2026-09-29), so leaving
    // a Puzzles game lands back at the same scroll position, where the sheet used to reopen.
    val exitGame: () -> Unit = { activeGame = null; activeSeed = null }
    var showSettings by remember { mutableStateOf(false) }
    var showSignIn by remember { mutableStateOf(false) }
    // Help / About / Privacy / Terms / Support overlay route (null = none).
    var infoRoute by remember { mutableStateOf<String?>(null) }
    // VS flow: lobby (true) → active match (mode, isDaily).
    var vsLobby by remember { mutableStateOf(false) }
    // The lobby page to open on (VS overhaul: CHALLENGE BACK lands on the Friend page).
    var vsLobbyPage by remember { mutableStateOf<com.wordocious.app.ui.vs.VsLobbyPage>(com.wordocious.app.ui.vs.VsLobbyPage.Main) }
    var vsActive by remember { mutableStateOf<com.wordocious.app.ui.vs.VsRoute?>(null) }
    // A challenge code to race (/vs/challenge/<code>: lobby card, code field, push, app link).
    var vsChallengeCode by remember { mutableStateOf<String?>(null) }
    // A Friends pocket game on screen (Friends overhaul §4; push url /friends/games/<id>).
    var friendlyGameId by remember { mutableStateOf<String?>(null) }
    // Bumped to open Stats → All-time → VS (the lobby's Rivals "See all").
    var statsVsJump by remember { mutableIntStateOf(0) }
    // Public profile overlay (web /profile/[id]) — opened from leaderboard/records usernames.
    var publicProfileId by remember { mutableStateOf<String?>(null) }
    // Records overlay (D1, 2026-09-26): Records left the tab bar; until D2 folds
    // its rows into Stats it opens from the Stats page's RECORDS row, pushed
    // in-tab like the public profile.
    var showRecords by remember { mutableStateOf(false) }
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
    // Challenge links + pushes (/vs/challenge/<code> via DeepLinkRouter) open the race flow.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        com.wordocious.app.data.DeepLinkRouter.vsChallenge.collect { code ->
            if (code != null) {
                com.wordocious.app.data.DeepLinkRouter.vsChallenge.value = null
                vsActive = null; vsInvite = null
                vsChallengeCode = code
            }
        }
    }
    // "Someone's looking" pushes (/vs/live/<MODE>, §13) open that mode's live
    // search — the lobby's LIVE tile with that mode selected (LIVE is Pro; a
    // lapsed Pro lands in the lobby instead).
    androidx.compose.runtime.LaunchedEffect(Unit) {
        com.wordocious.app.data.DeepLinkRouter.vsLive.collect { m ->
            if (m != null) {
                com.wordocious.app.data.DeepLinkRouter.vsLive.value = null
                // A cold start from the push: give the profile a moment to land so Pro reads true.
                kotlinx.coroutines.withTimeoutOrNull(5_000) {
                    com.wordocious.app.data.AuthService.profile.first { it != null }
                }
                activeGame = null; activeSeed = null
                vsInvite = null; vsChallengeCode = null
                com.wordocious.app.data.VsLobbyStore.setSelectedMode(m)
                vsLobbyPage = com.wordocious.app.ui.vs.VsLobbyPage.Main
                if (com.wordocious.app.data.AuthService.isProActive) {
                    vsActive = com.wordocious.app.ui.vs.VsRoute(m, false, com.wordocious.app.ui.vs.VsLaunch.Live)
                } else {
                    vsActive = null; vsLobby = true
                }
            }
        }
    }
    // Pocket-game pushes (/friends/games/<id>, Friends overhaul §7) open the game screen.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        com.wordocious.app.data.DeepLinkRouter.friendlyGame.collect { id ->
            if (id != null) {
                com.wordocious.app.data.DeepLinkRouter.friendlyGame.value = null
                activeGame = null; activeSeed = null
                vsActive = null; vsInvite = null; vsChallengeCode = null; vsLobby = false
                friendlyGameId = id
            }
        }
    }
    // Friends overhaul §1: the heartbeat names the game on screen (its db key) or nothing.
    androidx.compose.runtime.LaunchedEffect(activeGame, vsActive, vsInvite) {
        com.wordocious.app.data.PresenceService.setActivity(
            activeGame?.engineMode?.name ?: vsActive?.mode?.name ?: vsInvite?.first?.name,
        )
    }
    // Widget chip taps (wordocious://daily/KEY via DeepLinkRouter) open that
    // mode's daily — same launch state as the home grid / leaderboard Play CTA
    // (null seed = today's daily). One-shot: consume and clear.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        com.wordocious.app.data.DeepLinkRouter.dailyMode.collect { m ->
            if (m != null) {
                com.wordocious.app.data.DeepLinkRouter.dailyMode.value = null
                modeCardFor(m)?.let {
                    vsLobby = false; vsActive = null; vsInvite = null; vsChallengeCode = null
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
    // The check above can latch the modal while a game covers the screen —
    // the player finishes the daily, returns, and is told the streak they
    // just extended is at risk (iOS had the same race). Any completion
    // recorded today wins over the latch.
    val shieldCompletionTick by com.wordocious.app.data.DailyCompletionsService.completionTick.collectAsState()
    androidx.compose.runtime.LaunchedEffect(shieldCompletionTick, showShieldModal) {
        if (showShieldModal && com.wordocious.app.data.DailyCompletionsService.readCache().isNotEmpty()) {
            showShieldModal = false
        }
    }

    // Founder, 2026-09-29: the tab Scaffold stays composed UNDER every full-screen layer (VS,
    // games, info/settings/sign-in) instead of being torn down by early returns, so coming back
    // from a game keeps each tab's scroll position and fetched rows (it used to refetch it all).
    // While a layer covers them the tabs draw nothing, take no touches, leave the accessibility
    // tree, register their BackHandlers on an inert dispatcher (the layer's own back always
    // wins; they re-register in tree order once uncovered) and pause pollers via LocalTabHidden.
    val coveredState = remember {
        androidx.compose.runtime.derivedStateOf {
            friendlyGameId != null || vsInvite != null || vsActive != null || vsLobby || vsChallengeCode != null || activeGame?.engineMode != null ||
                infoRoute != null || showSignIn || showSettings
        }
    }
    val covered by coveredState
    val realBackOwner = androidx.activity.compose.LocalOnBackPressedDispatcherOwner.current
    val inertBackOwner = remember(mainLifecycleOwner) {
        object : androidx.activity.OnBackPressedDispatcherOwner {
            override val onBackPressedDispatcher = androidx.activity.OnBackPressedDispatcher()
            override val lifecycle get() = mainLifecycleOwner.lifecycle
        }
    }
    // ART_SPEC §11: the page tint of what shows under the shared header — a page pushed
    // inside the tab (Records, a public profile) wins over the tab's own tint.
    val headerTint = when {
        showRecords -> PageTint.LEADERBOARD
        publicProfileId != null -> PageTint.HOME
        else -> tabPageTint(selectedTab)
    }
    Box(Modifier.fillMaxSize()) {
      // The page background reaches behind the status bar and the shared header; each tab
      // and pushed page repaints the same window-anchored pixels behind its own content.
      Box(Modifier.fillMaxSize().then(if (covered) Modifier.hiddenTab() else Modifier).pageBackground(headerTint)) {
        androidx.compose.runtime.CompositionLocalProvider(
            androidx.activity.compose.LocalOnBackPressedDispatcherOwner provides (if (covered || realBackOwner == null) inertBackOwner else realBackOwner),
        ) {
            Scaffold(
                // Transparent: the page background (§11) shows through; the tab bar keeps its surface.
                containerColor = Color.Transparent,
                bottomBar = {
                    // §252: the ad banner that used to sit above the nav is gone. Banner
                    // RPM is pennies and it taxed every screen of a daily-habit game;
                    // the game-start interstitial carries the free tier instead.
                    Column(Modifier.fillMaxWidth()) {
                        // Switching tabs pops the public-profile push, mirroring iOS's
                        // per-tab path reset (RootTabView.swift:38-47).
                        BottomNav(selected = selectedTab, onSelect = { publicProfileId = null; showRecords = false; selectedTab = it })
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
                            val tabHidden = remember(tab) { androidx.compose.runtime.derivedStateOf { coveredState.value || selectedTab != tab } }
                            Box(Modifier.fillMaxSize().then(if (activeTab) Modifier.zIndex(1f) else Modifier.hiddenTab())) {
                              androidx.compose.runtime.CompositionLocalProvider(LocalTabHidden provides tabHidden, LocalPageTint provides tabPageTint(tab)) {
                                when (tab) {
                                    0 -> HomeScreen(
                                        onJoinInvite = { m, code -> vsInvite = m to code },
                                        onSelectMode = { card, unlimited ->
                                            if (card.id == "vs") {
                                                // VS overhaul (2026-10-01): every VS tap opens the lobby —
                                                // its banner holds today's Daily Battle for free and Pro alike.
                                                vsLobbyPage = com.wordocious.app.ui.vs.VsLobbyPage.Main
                                                vsLobby = true
                                            } else {
                                                activeGame = card
                                                activeSeed = if (unlimited && card.engineMode != null)
                                                    resolvedUnlimitedSeed(card.engineMode) else null
                                            }
                                        },
                                        onGoPro = { infoRoute = "pro" },
                                        onVs = { card -> card.engineMode?.let { vsActive = com.wordocious.app.ui.vs.VsRoute(it) } },
                                        onNavigate = { infoRoute = it },
                                    )
                                    1 -> LeaderboardScreen(
                                        onOpenProfile = { publicProfileId = it },
                                        onPlay = { mode -> modeCardFor(mode)?.let { activeGame = it; activeSeed = null } },
                                        // Empty Friends board CTA → the Friends tab (§207 Tier 2).
                                        onOpenFriends = { selectedTab = 3 },
                                        // "All-time →" in the header → the global Records screen (D2 step 3).
                                        onOpenRecords = { showRecords = true },
                                    )
                                    2 -> ProfileScreen(
                                        onGoPro = { infoRoute = "pro" },
                                        onEditProfile = { infoRoute = "edit" },
                                        // Today's Dailies badge → open that mode's daily game (completed
                                        // puzzle if played, fresh if not) — web parity.
                                        onPlayDaily = { mode -> modeCardFor(mode)?.let { activeGame = it; activeSeed = null } },
                                        // Friends card rows → push the friend's profile in-tab.
                                        onOpenProfile = { publicProfileId = it },
                                        // Compact FRIENDS row → the Friends tab (§207 Tier 3).
                                        onOpenFriends = { selectedTab = 3 },
                                        // D2 step 3: the Global Records tile on the All-time page → the Hall of Fame.
                                        onOpenRecords = { showRecords = true },
                                        vsJumpRequest = statsVsJump,
                                    )
                                    3 -> FriendsScreen(
                                        onOpenProfile = { publicProfileId = it },
                                        // D3: a Challenge (the free live VS Battle) opens the private lobby with its code.
                                        onJoinInvite = { m, code -> vsInvite = m to code },
                                        // Friends overhaul §4: a pocket game's screen.
                                        onOpenGame = { friendlyGameId = it },
                                        // §3 "Race my run": the VS Friend page with this friend picked (Pro).
                                        onRaceRun = { friendId ->
                                            if (com.wordocious.app.data.AuthService.isProActive) {
                                                vsLobbyPage = com.wordocious.app.ui.vs.VsLobbyPage.Friend(friendId)
                                                vsLobby = true
                                            } else infoRoute = "pro"
                                        },
                                    )
                                }
                              }
                            }
                        }

                        // Records — the GLOBAL Daily / All-Time boards, pushed inside the current
                        // tab (from the Leaderboard header's "All-time →" or the Stats page's
                        // Global Records tile). Your own records live on the Stats tab (D2 step 3).
                        if (showRecords) {
                            androidx.activity.compose.BackHandler { showRecords = false }
                            PageBackground(PageTint.LEADERBOARD, Modifier.fillMaxSize().zIndex(2f)) {
                                RecordsScreen(
                                    onOpenProfile = { publicProfileId = it },
                                    onOpenStats = { showRecords = false; selectedTab = 2 },
                                )
                            }
                        }

                        // Public profile is a PUSH INSIDE the tab, not a new root: iOS
                        // renders it in the tab's NavigationStack without .hidesBottomNav
                        // (ProfileTab.swift:1005-1015), so header + nav + ad banner stay.
                        publicProfileId?.let { pid ->
                            androidx.activity.compose.BackHandler { publicProfileId = null }
                            PageBackground(PageTint.HOME, Modifier.fillMaxSize().zIndex(2f)) {
                                PublicProfileScreen(
                                    userId = pid,
                                    onClose = { publicProfileId = null },
                                    // Profile-to-profile hop (nemesis row / podium rows):
                                    // same push-inside-the-tab pattern, new target id.
                                    onOpenProfile = { publicProfileId = it },
                                )
                            }
                        }

                        if (showShieldModal && !covered) {
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
      }

      // §11 card shadows on the covering pages: the VS pages lean teal, the rest home purple.
      // §15 / §19.1 a solo game screen gets its game's tint (card shadows, fallback
      // gradient) and its wallpaper; VS matches and pocket games get neither.
      val soloGame = activeGame?.takeIf {
          it.engineMode != null && friendlyGameId == null &&
              vsInvite == null && vsActive == null && vsChallengeCode == null && !vsLobby
      }
      val soloGameAccent = soloGame?.accent
      if (covered) androidx.compose.runtime.CompositionLocalProvider(
        LocalPageTint provides when {
            friendlyGameId != null -> null // a pocket game screen
            vsInvite != null || vsActive != null || vsChallengeCode != null || vsLobby -> PageTint.VS
            activeGame?.engineMode != null -> null // a game screen
            else -> PageTint.HOME // info pages, Pro, Settings, sign-in
        },
        LocalGameTint provides soloGameAccent,
        LocalGameWallpaper provides gameWallpaperRes(soloGame?.id),
      ) { Box(Modifier.fillMaxSize().zIndex(3f)) {
        val card = activeGame
        val invite = vsInvite
        val active = vsActive
        val route = infoRoute
        val friendly = friendlyGameId
        if (friendly != null) {
            // The game screen owns Back (it confirms leaving an active game).
            com.wordocious.app.ui.friends.FriendlyGameScreen(
                gameId = friendly,
                onClose = { friendlyGameId = null },
                onFriends = { friendlyGameId = null; publicProfileId = null; showRecords = false; selectedTab = 3 },
                onOpenGame = { friendlyGameId = it },
            )
        } else if (invite != null) {
            val (inviteMode, code) = invite
            androidx.activity.compose.BackHandler { vsInvite = null }
            com.wordocious.app.ui.vs.VSGameScreen(
                mode = inviteMode, isDaily = false, inviteCode = code,
                onHome = { vsInvite = null },
                onGoPro = { vsInvite = null; infoRoute = "pro" },
            )
        } else if (active != null) {
            // VS match (fullscreen, no bottom nav). VS HOME returns to the lobby.
            androidx.activity.compose.BackHandler { vsActive = null }
            com.wordocious.app.ui.vs.VSGameScreen(
                mode = active.mode, isDaily = active.isDaily, launch = active.launch,
                onHome = { vsActive = null; vsLobbyPage = com.wordocious.app.ui.vs.VsLobbyPage.Main; vsLobby = true },
                onGoPro = { vsActive = null; infoRoute = "pro" },
                // Pro "Play Unlimited VS" from the already-played daily screen → lobby.
                onPlayUnlimited = { vsActive = null; vsLobby = true },
                // CHALLENGE BACK → the Friend page with that friend picked (§5).
                onChallengeBack = { friendId ->
                    vsActive = null
                    vsLobbyPage = com.wordocious.app.ui.vs.VsLobbyPage.Friend(friendId)
                    vsLobby = true
                },
            )
        } else if (vsChallengeCode != null) {
            val code = vsChallengeCode!!
            androidx.activity.compose.BackHandler { vsChallengeCode = null }
            com.wordocious.app.ui.vs.ChallengeRouteScreen(
                code = code,
                onStart = { c ->
                    vsChallengeCode = null
                    val m = runCatching { com.wordocious.core.GameMode.valueOf(c.gameMode) }.getOrDefault(com.wordocious.core.GameMode.DUEL)
                    vsActive = com.wordocious.app.ui.vs.VsRoute(m, false, com.wordocious.app.ui.vs.VsLaunch.Race(c))
                },
                onHome = { vsChallengeCode = null; vsLobbyPage = com.wordocious.app.ui.vs.VsLobbyPage.Main; vsLobby = true },
                onGoPro = { vsChallengeCode = null; infoRoute = "pro" },
                onChallengeBack = { friendId ->
                    vsChallengeCode = null
                    vsLobbyPage = com.wordocious.app.ui.vs.VsLobbyPage.Friend(friendId)
                    vsLobby = true
                },
            )
        } else if (vsLobby) {
            androidx.activity.compose.BackHandler { vsLobby = false }
            com.wordocious.app.ui.vs.VSLobbyScreen(
                initialPage = vsLobbyPage,
                onPlay = { route -> vsActive = route },
                onEnterInvite = { m, code -> vsLobby = false; vsInvite = m to code },
                onOpenChallenge = { code -> vsChallengeCode = code },
                onSeeRivals = { vsLobby = false; publicProfileId = null; showRecords = false; selectedTab = 2; statsVsJump++ },
                onGoPro = { vsLobby = false; infoRoute = "pro" },
                onClose = { vsLobby = false },
            )
        } else if (card?.engineMode?.isCustomEngine == true) {
            // Game screen shown fullscreen (no bottom nav — matches web behavior)
            // More Games titles have their own screens (More Games §4): route them
            // BEFORE the word-engine fallthrough, which would hand a Sudoku card to the
            // shared GameScreen.
            val mode = card.engineMode
            androidx.activity.compose.BackHandler(onBack = exitGame)
            when (mode) {
                com.wordocious.core.GameMode.SUDOKU -> {
                    val isDaily = activeSeed == null
                    val seed = androidx.compose.runtime.remember(card, activeSeed) { activeSeed ?: com.wordocious.app.todayLocalSeed(mode.name) }
                    com.wordocious.app.ui.game.SudokuScreen(
                        seed = seed, isDaily = isDaily,
                        onBack = exitGame,
                        // Pro Unlimited: a fresh seed carrying the chosen difficulty.
                        onPlayAgain = { d -> activeSeed = "unlimited-SUDOKU-${System.currentTimeMillis()}-${d.key}" },
                        onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
                        onOpenUnlimited = { m -> modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it } },
                        onOpenLeaderboard = { m ->
                            activeGame = null; activeSeed = null
                            publicProfileId = null
                            LeaderboardDeepLink.pendingMode.value = m.name
                            selectedTab = 1
                        },
                    )
                }
                com.wordocious.core.GameMode.REGIONS -> {
                    val isDaily = activeSeed == null
                    val seed = androidx.compose.runtime.remember(card, activeSeed) { activeSeed ?: com.wordocious.app.todayLocalSeed(mode.name) }
                    com.wordocious.app.ui.game.RegionsScreen(
                        seed = seed, isDaily = isDaily,
                        onBack = exitGame,
                        // Pro Unlimited: a fresh seed whose trailing segment is the board size (regionsSizeForSeed).
                        onPlayAgain = { n -> activeSeed = "unlimited-REGIONS-${System.currentTimeMillis()}-$n" },
                        onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
                        onOpenUnlimited = { m -> modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it } },
                        onOpenLeaderboard = { m ->
                            activeGame = null; activeSeed = null
                            publicProfileId = null
                            LeaderboardDeepLink.pendingMode.value = m.name
                            selectedTab = 1
                        },
                    )
                }
                com.wordocious.core.GameMode.LADDER -> {
                    val isDaily = activeSeed == null
                    val seed = androidx.compose.runtime.remember(card, activeSeed) { activeSeed ?: com.wordocious.app.todayLocalSeed(mode.name) }
                    com.wordocious.app.ui.game.LadderScreen(
                        seed = seed, isDaily = isDaily,
                        onBack = exitGame,
                        onPlayAgain = { activeSeed = "unlimited-LADDER-${System.currentTimeMillis()}" },
                        onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
                        onOpenUnlimited = { m -> modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it } },
                        onOpenLeaderboard = { m ->
                            activeGame = null; activeSeed = null
                            publicProfileId = null
                            LeaderboardDeepLink.pendingMode.value = m.name
                            selectedTab = 1
                        },
                    )
                }
                com.wordocious.core.GameMode.WORDSEARCH -> {
                    val isDaily = activeSeed == null
                    val seed = androidx.compose.runtime.remember(card, activeSeed) { activeSeed ?: com.wordocious.app.todayLocalSeed(mode.name) }
                    com.wordocious.app.ui.game.SpyglassScreen(
                        seed = seed, isDaily = isDaily,
                        onBack = exitGame,
                        onPlayAgain = { activeSeed = "unlimited-WORDSEARCH-${System.currentTimeMillis()}" },
                        onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
                        onOpenUnlimited = { m -> modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it } },
                        onOpenLeaderboard = { m ->
                            activeGame = null; activeSeed = null
                            publicProfileId = null
                            LeaderboardDeepLink.pendingMode.value = m.name
                            selectedTab = 1
                        },
                    )
                }
                com.wordocious.core.GameMode.HUB -> {
                    val isDaily = activeSeed == null
                    val seed = androidx.compose.runtime.remember(card, activeSeed) { activeSeed ?: com.wordocious.app.todayLocalSeed(mode.name) }
                    com.wordocious.app.ui.game.HubScreen(
                        seed = seed, isDaily = isDaily,
                        onBack = exitGame,
                        onPlayAgain = { activeSeed = "unlimited-HUB-${System.currentTimeMillis()}" },
                        onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
                        onOpenUnlimited = { m -> modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it } },
                        onOpenLeaderboard = { m ->
                            activeGame = null; activeSeed = null
                            publicProfileId = null
                            LeaderboardDeepLink.pendingMode.value = m.name
                            selectedTab = 1
                        },
                    )
                }
                com.wordocious.core.GameMode.CRYPTOGRAM -> {
                    val isDaily = activeSeed == null
                    val seed = androidx.compose.runtime.remember(card, activeSeed) { activeSeed ?: com.wordocious.app.todayLocalSeed(mode.name) }
                    com.wordocious.app.ui.game.CodebreakerScreen(
                        seed = seed, isDaily = isDaily,
                        onBack = exitGame,
                        onPlayAgain = { activeSeed = "unlimited-CRYPTOGRAM-${System.currentTimeMillis()}" },
                        onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
                        onOpenUnlimited = { m -> modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it } },
                        onOpenLeaderboard = { m ->
                            activeGame = null; activeSeed = null
                            publicProfileId = null
                            LeaderboardDeepLink.pendingMode.value = m.name
                            selectedTab = 1
                        },
                    )
                }
                com.wordocious.core.GameMode.GROUPS -> {
                    val isDaily = activeSeed == null
                    val seed = androidx.compose.runtime.remember(card, activeSeed) { activeSeed ?: com.wordocious.app.todayLocalSeed(mode.name) }
                    com.wordocious.app.ui.game.KindredScreen(
                        seed = seed, isDaily = isDaily,
                        onBack = exitGame,
                        onPlayAgain = { activeSeed = "unlimited-GROUPS-${System.currentTimeMillis()}" },
                        onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
                        onOpenUnlimited = { m -> modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it } },
                        onOpenLeaderboard = { m ->
                            activeGame = null; activeSeed = null
                            publicProfileId = null
                            LeaderboardDeepLink.pendingMode.value = m.name
                            selectedTab = 1
                        },
                    )
                }
                com.wordocious.core.GameMode.CROSSWORD -> {
                    val isDaily = activeSeed == null
                    val seed = androidx.compose.runtime.remember(card, activeSeed) { activeSeed ?: com.wordocious.app.todayLocalSeed(mode.name) }
                    com.wordocious.app.ui.game.CrosswordScreen(
                        seed = seed, isDaily = isDaily,
                        onBack = exitGame,
                        onPlayAgain = { activeSeed = "unlimited-CROSSWORD-${System.currentTimeMillis()}" },
                        onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
                        onOpenUnlimited = { m -> modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it } },
                        onOpenLeaderboard = { m ->
                            activeGame = null; activeSeed = null
                            publicProfileId = null
                            LeaderboardDeepLink.pendingMode.value = m.name
                            selectedTab = 1
                        },
                    )
                }
                com.wordocious.core.GameMode.SCRAMBLE -> {
                    val isDaily = activeSeed == null
                    val seed = androidx.compose.runtime.remember(card, activeSeed) { activeSeed ?: com.wordocious.app.todayLocalSeed(mode.name) }
                    com.wordocious.app.ui.game.MuddleScreen(
                        seed = seed, isDaily = isDaily,
                        onBack = exitGame,
                        onPlayAgain = { activeSeed = "unlimited-SCRAMBLE-${System.currentTimeMillis()}" },
                        onOpenDaily = { m -> modeCardFor(m)?.let { activeSeed = null; activeGame = it } },
                        onOpenUnlimited = { m -> modeCardFor(m)?.let { activeSeed = freshUnlimitedSeed(m); activeGame = it } },
                        onOpenLeaderboard = { m ->
                            activeGame = null; activeSeed = null
                            publicProfileId = null
                            LeaderboardDeepLink.pendingMode.value = m.name
                            selectedTab = 1
                        },
                    )
                }
                else -> {
                    // A catalog record enabled before its screen landed — never a
                    // crash, just a plain note and the way back.
                    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().appBackground(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                        androidx.compose.material3.Text("${card.title} is coming soon", fontSize = 14.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                            color = com.wordocious.app.ui.theme.WTheme.textMuted,
                            modifier = Modifier.clickableNoRipple { activeGame = null; activeSeed = null })
                    }
                }
            }
        } else if (card?.engineMode != null) {
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
            androidx.activity.compose.BackHandler(onBack = exitGame)
            GameScreen(
                mode = card.engineMode,
                title = card.title,
                seed = seed,
                onBack = exitGame,
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
                // §214 (Lindsay): "View Leaderboard" from a daily result — close
                // the game and land on the Leaderboard tab with the mode selected.
                onOpenLeaderboard = { m ->
                    activeGame = null; activeSeed = null
                    publicProfileId = null
                    LeaderboardDeepLink.pendingMode.value = m.name
                    selectedTab = 1
                },
            )
        } else if (route != null) {
        // Status-bar inset for the OVERLAY surfaces. These three layers sit OVER
        // the Scaffold, not inside it, and the Scaffold is what supplies the top inset
        // (no topBar slot -> innerPadding.top == contentWindowInsets.top). The root
        // Surface in MainActivity supplies navigationBarsPadding ONLY, so under
        // targetSdk 35's forced edge-to-edge on Android 15+ the Done / Close / Save
        // controls on Settings, Pro, Edit Profile, Auth and the info screens drew
        // under the system clock — and the top-right ones were often untappable.
        // Paywall and profile-commit surfaces, so this was revenue and lost edits.
          androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().pageBackground(PageTint.HOME).statusBarsPadding()) {
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
        } else if (showSignIn) {
        // Settings overlay (opened from the shared header gear, on any tab)
        // Guest sign-in overlay (header "Sign In"). Presented OVER the tabs and
        // dismissible, like iOS's AuthView sheet — guest state is untouched, so
        // backing out returns you to the exact tab you were on. On success the
        // auth state flow flips and the root gate re-composes on its own.
            androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().pageBackground(PageTint.HOME).statusBarsPadding()) {
                AuthScreen(onAuthenticated = { showSignIn = false }, onDismiss = { showSignIn = false })
            }
        } else if (showSettings) {
            androidx.activity.compose.BackHandler { showSettings = false }
            androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().pageBackground(PageTint.HOME).statusBarsPadding()) {
                SettingsScreen(onDone = { showSettings = false }, onOpenInfo = { infoRoute = it })
            }
        }
      } }
    }
}

/** ART_SPEC §11: each tab's page tint (Home · Leaderboard · Stats · Friends). */
private fun tabPageTint(tab: Int): PageTint = when (tab) {
    1 -> PageTint.LEADERBOARD
    2 -> PageTint.STATS
    3 -> PageTint.FRIENDS
    else -> PageTint.HOME
}
