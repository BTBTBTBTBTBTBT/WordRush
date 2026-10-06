package com.wordocious.app.ui

import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.nestedScroll
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.zIndex
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
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
    // FINISH_SPEC M: the badge also counts game invites and VS challenges waiting on the
    // player — refreshed with the games list (the same existing endpoints the Friends tab reads).
    var inviteIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var challengeCodes by remember { mutableStateOf<List<String>>(emptyList()) }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        navLifecycle.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.RESUMED) {
            while (true) {
                val uid = com.wordocious.app.data.AuthService.userId
                if (uid != null) {
                    com.wordocious.app.data.FriendlyGamesService.load()
                    runCatching { com.wordocious.app.data.InviteService.fetchPendingInvitesForUser(uid) }.getOrNull()
                        ?.let { list -> inviteIds = list.map { it.id } }
                    runCatching { com.wordocious.app.data.VsChallengeService.list() }.getOrNull()
                        ?.let { l -> challengeCodes = l.incoming.map { it.code } }
                }
                kotlinx.coroutines.delay(60_000)
            }
        }
    }
    val activeGames by com.wordocious.app.data.FriendlyGamesService.active.collectAsState()
    val waiting = remember(friendsVersion, activeGames, inviteIds, challengeCodes) {
        FriendsBadge.waitingKeys(
            requestIds = com.wordocious.app.data.FriendsService.incoming.map { it.id },
            inviteIds = inviteIds,
            challengeCodes = challengeCodes,
            yourTurnGames = activeGames.filter { it.yourTurn }.map { it.id to it.updatedAt },
        )
    }
    var seen by remember { mutableStateOf(FriendsBadge.loadSeen()) }
    // Opening Friends marks everything waiting as seen; the badge returns only for new items.
    androidx.compose.runtime.LaunchedEffect(selected, waiting) {
        if (selected == 3) { FriendsBadge.markSeen(waiting); seen = waiting }
    }
    val friendsBadge = FriendsBadge.unseen(waiting, seen)
    // A new item arriving springs the badge in and wiggles the tab icon.
    var arrivals by remember { mutableIntStateOf(0) }
    var lastCount by remember { mutableIntStateOf(friendsBadge) }
    androidx.compose.runtime.LaunchedEffect(friendsBadge) {
        if (friendsBadge > lastCount) arrivals++
        lastCount = friendsBadge
    }
    // FINISH_SPEC A4: the docked tab bar — flush to the bottom edge, edge to edge and
    // opaque, so the page content ends right above it and nothing shows underneath; a soft
    // page-tinted gradient (lilac Home, warm Leaderboard, blue Stats, pink Friends) with a
    // faint top line. The home-indicator strip under it is painted in the bar's bottom
    // color by MainScreen (dockedTabBarExtension), so it reads as part of the bar. Each
    // tab icon squishes on tap.
    val look = tabBarLook(selected)
    Row(
        Modifier.fillMaxWidth()
            .drawBehind {
                // Soft upward shadow (0 -6 16 rgba(76,29,149,.08)) and the faint top line.
                drawRect(
                    Brush.verticalGradient(listOf(Color.Transparent, Color(0x144C1D95)), startY = -16.dp.toPx(), endY = 0f),
                    topLeft = Offset(0f, -16.dp.toPx()), size = Size(size.width, 16.dp.toPx()),
                )
            }
            .background(Brush.verticalGradient(listOf(look.top, look.bottom)))
            .drawBehind { drawRect(look.line, size = Size(size.width, 1.dp.toPx())) }
            .padding(top = 8.dp, start = 6.dp, end = 6.dp, bottom = 4.dp),
    ) {
        TABS.forEachIndexed { i, tab ->
            val active = selected == i
            val interaction = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
            Column(
                Modifier.weight(1f)
                    .clickable(interactionSource = interaction, indication = null) {
                        // iOS pairs every tab tap with Haptics.tap() (RootTabView.swift:162);
                        // ripple is suppressed here, so the squish + haptic are the press feedback.
                        if (!WTheme.reducedMotion) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onSelect(i)
                    }.semantics(mergeDescendants = true) {
                        role = androidx.compose.ui.semantics.Role.Tab
                        this.selected = active
                        // M: "Friends, 3 new" (the label Text below is folded into this).
                        contentDescription = if (tab.label == "Friends") FriendsBadge.tabLabel(friendsBadge) else tab.label
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                // A4: the icon squishes on tap (the icon press, .86 / .80 → 1.08 → 1).
                Box(Modifier.pressSquish(interaction, icon = true).then(if (tab.label == "Friends") Modifier.friendsWiggle(arrivals) else Modifier)) {
                    // Selected = full color; unselected = the same icon at 55% opacity and
                    // 60% saturation (game-kit.html `.tab img`).
                    Icon3D(
                        tab.icon, 29.dp,
                        alpha = if (active) 1f else 0.55f,
                        colorFilter = if (active) null else Icon3DMuted,
                    )
                    // M: the glossy candy count on the Friends icon (requests + invites +
                    // challenges + your-turn games the player hasn't seen yet).
                    if (tab.label == "Friends" && friendsBadge > 0) {
                        FriendsCountBadge(
                            friendsBadge, arrivals = arrivals, pulsing = !active,
                            modifier = Modifier.align(Alignment.TopEnd).offset(x = 10.dp, y = (-6).dp),
                        )
                    }
                }
                Text(
                    tab.label, fontSize = 11.sp, maxLines = 1, modifier = Modifier.clearAndSetSemantics { },
                    fontWeight = if (active) FontWeight.Black else FontWeight.ExtraBold,
                    color = if (active) (if (WTheme.season?.card != null) Color(0xFFFDBA74) else Color(0xFF6D28D9))
                        else if (WTheme.isDark) WTheme.textMuted else Color(0xFF8A78AD),
                )
                // The selected tab's 3 dp purple underline pill under its label.
                Box(
                    Modifier.size(width = 22.dp, height = 3.dp).clip(CircleShape)
                        .background(if (!active) Color.Transparent else if (WTheme.season?.card != null) Color(0xFFF97316) else HeaderInk.tabSelected),
                )
            }
        }
    }
}

/** A4 the docked bar's page tint: gradient top → bottom and the faint top line. */
internal data class TabBarLook(val top: Color, val bottom: Color, val line: Color)

/** A4 the docked bar's look for the selected [tab] (dark mode: the dark surface). */
internal fun tabBarLook(tab: Int): TabBarLook {
    // Season surfaces: the season's night plum (raised -> card) with a faint orange line (iOS / web parity).
    WTheme.season?.card?.let { card -> return TabBarLook(WTheme.season?.raised ?: card, card, Color(0x38F97316)) }
    if (WTheme.isDark) return TabBarLook(WTheme.surface, WTheme.bg, WTheme.border)
    return when (tab) {
        1 -> TabBarLook(Color(0xFFFFF8EA), Color(0xFFFFEBC9), Color(0x33F59E0B))   // Leaderboard: warm
        2 -> TabBarLook(Color(0xFFF2F6FF), Color(0xFFE1EBFF), Color(0x242563EB))   // Stats: blue
        3 -> TabBarLook(Color(0xFFFFF2F8), Color(0xFFFBE0EE), Color(0x29EC4899))   // Friends: pink
        else -> TabBarLook(Color(0xFFF7F1FF), Color(0xFFECE0FF), Color(0x247C3AED)) // Home: lilac
    }
}

/**
 * A4 the home-indicator strip is part of the docked bar: paint the window's
 * navigation-bar inset (below this node's bottom edge) in the bar's bottom color.
 */
@Composable
private fun Modifier.dockedTabBarExtension(enabled: Boolean, tab: Int): Modifier {
    if (!enabled) return this
    val inset = androidx.compose.foundation.layout.WindowInsets.Companion.navigationBars
    val density = androidx.compose.ui.platform.LocalDensity.current
    val bottomPx = inset.getBottom(density)
    if (bottomPx <= 0) return this
    val color = tabBarLook(tab).bottom
    return this.drawBehind {
        drawRect(color, topLeft = Offset(0f, size.height), size = Size(size.width, bottomPx.toFloat()))
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
 * (iOS `TabView` keeps every tab alive — RootTabView.swift:8-9), but invisible,
 * laid under the active tab, and blocked from receiving touches.
 *
 * AW (founder 10-02: "the footer takes a second to repopulate" after closing a game): hidden
 * with a zero-alpha graphics LAYER instead of skipping the draw. A skipped draw dropped every
 * recorded display list, so uncovering re-recorded the whole tab tree — the tab bar included —
 * in one long frame. A zero-alpha layer is never rendered (the GPU skips it) but keeps its
 * recorded content, so dismissing a game reveals the tabs AND the footer in the same frame,
 * with no re-layout (nothing about the layout ever changed).
 */
private fun Modifier.hiddenTab(showing: () -> Boolean = { false }): Modifier = this
    .zIndex(0f)
    .clearAndSetSemantics {} // off screen = out of the accessibility tree too (TalkBack read hidden tabs)
    // BJ9: Home keeps drawing under the shell while a game grows open / shrinks closed
    // (read in the layer: no recomposition).
    .graphicsLayer { alpha = if (showing()) 1f else 0f }
    .pointerInput(Unit) {
        awaitPointerEventScope {
            while (true) {
                awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() }
            }
        }
    }

@Composable
fun MainScreen() {
    // 2026-10-05 (configuration changes): the shell's navigation is SAVED state, not plain
    // remember — rotation, fold/unfold, split-screen, a dark-mode or font-scale switch all
    // recreate the activity, and with `remember` they dropped the player back on Home in the
    // middle of a game. The game's board itself survives through its ViewModel/GamePersistence;
    // this keeps the route to it. ModeCard is restored by catalog id (ModeCardSaver).
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    var activeGame by rememberSaveable(stateSaver = ModeCardSaver) { mutableStateOf<ModeCard?>(null) }
    // Explicit seed for the active game — non-null only for Pro Unlimited (a fresh
    // non-daily seed); null falls back to today's daily seed.
    var activeSeed by rememberSaveable { mutableStateOf<String?>(null) }
    // Home redesign (founder, 2026-10-01): the More Games sheet is gone (its games are
    // Home's PUZZLES section). Home stays composed under a game (2026-09-29), so leaving
    // a Puzzles game lands back at the same scroll position, where the sheet used to reopen.
    // BJ9: the game fades (its layer), then the shell shrinks back into its card.
    val exitGame: () -> Unit = { GameMotion.close { activeGame = null; activeSeed = null } }
    var showSettings by rememberSaveable { mutableStateOf(false) }
    var showSignIn by rememberSaveable { mutableStateOf(false) }
    // Help / About / Privacy / Terms / Support overlay route (null = none).
    var infoRoute by rememberSaveable { mutableStateOf<String?>(null) }
    // Founder 10-05: every dress-up door (own avatar taps, the Home host, the party-hat offer) opens Edit Profile.
    val dressRequest by DressUp.request.collectAsState()
    androidx.compose.runtime.LaunchedEffect(dressRequest) { if (dressRequest != null) { infoRoute = "edit"; DressUp.request.value = null } }
    // VS flow: lobby (true) → active match (mode, isDaily).
    var vsLobby by remember { mutableStateOf(false) }
    // The lobby page to open on (VS overhaul: CHALLENGE BACK lands on the Friend page).
    var vsLobbyPage by remember { mutableStateOf<com.wordocious.app.ui.vs.VsLobbyPage>(com.wordocious.app.ui.vs.VsLobbyPage.Main) }
    var vsActive by remember { mutableStateOf<com.wordocious.app.ui.vs.VsRoute?>(null) }
    // A challenge code to race (/vs/challenge/<code>: lobby card, code field, push, app link).
    var vsChallengeCode by remember { mutableStateOf<String?>(null) }
    // A Friends pocket game on screen (Friends overhaul §4; push url /friends/games/<id>).
    var friendlyGameId by rememberSaveable { mutableStateOf<String?>(null) }
    // Bumped to open Stats → All-time → VS (the lobby's Rivals "See all").
    var statsVsJump by remember { mutableIntStateOf(0) }
    // Public profile overlay (web /profile/[id]) — opened from leaderboard/records usernames.
    var publicProfileId by rememberSaveable { mutableStateOf<String?>(null) }
    // Records overlay (D1, 2026-09-26): Records left the tab bar; until D2 folds
    // its rows into Stats it opens from the Stats page's RECORDS row, pushed
    // in-tab like the public profile.
    var showRecords by rememberSaveable { mutableStateOf(false) }
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
    // The small widget (wordocious://home): the Home tab (founder 10-05).
    androidx.compose.runtime.LaunchedEffect(Unit) {
        com.wordocious.app.data.DeepLinkRouter.homeRequest.collect { go ->
            if (go) {
                com.wordocious.app.data.DeepLinkRouter.homeRequest.value = false
                selectedTab = 0
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

    // FINISH_SPEC AJ: the per-tab "scroll to the top" counters and the leave-the-match confirm.
    val tabReselect = remember { androidx.compose.runtime.mutableStateListOf(0, 0, 0, 0) }
    var confirmLeaveTab by remember { mutableStateOf<Int?>(null) }
    // CelebrationGate (2026-10-03): late celebrations (sweeps, late unlocks) wait for the Home
    // tab at its root with nothing over it — see CelebrationQueue.
    val onHomeRoot = selectedTab == 0 && !covered && activeGame == null && publicProfileId == null && !showRecords
    androidx.compose.runtime.SideEffect { CelebrationCalm.homeRoot = onHomeRoot }
    androidx.compose.runtime.DisposableEffect(Unit) { onDispose { CelebrationCalm.homeRoot = false } }
    ReportPresented(confirmLeaveTab != null || showNewPassword)
    ReportPopup(showShieldModal && !covered)
    fun goToRoot(tab: Int, scrollToTop: Boolean) {
        publicProfileId = null; showRecords = false
        activeGame = null; activeSeed = null; infoRoute = null; showSettings = false; showSignIn = false
        vsLobby = false; vsActive = null; vsInvite = null; vsChallengeCode = null; friendlyGameId = null
        vsLobbyPage = com.wordocious.app.ui.vs.VsLobbyPage.Main
        selectedTab = tab
        if (scrollToTop && tab in tabReselect.indices) tabReselect[tab] = tabReselect[tab] + 1
    }
    fun onTabTap(tab: Int) {
        val state = TabNavState(
            selectedTab = selectedTab,
            pushedPages = (if (publicProfileId != null) 1 else 0) + (if (showRecords) 1 else 0),
            layers = if (covered) 1 else 0,
            liveVsMatch = vsActive != null || vsInvite != null,
        )
        when (val out = TabNav.onTabTap(state, tab)) {
            is TabTapOutcome.ConfirmLeaveMatch -> confirmLeaveTab = out.tab
            is TabTapOutcome.GoToRoot -> goToRoot(out.tab, out.scrollToTop)
        }
    }
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
    Box(Modifier.fillMaxSize().dockedTabBarExtension(!covered, selectedTab)) {
      // The page background reaches behind the status bar and the shared header; each tab
      // and pushed page repaints the same window-anchored pixels behind its own content.
      Box(Modifier.fillMaxSize().then(if (covered) Modifier.hiddenTab(GameMotion::homeShows) else Modifier).pageBackground(headerTint)) {
        androidx.compose.runtime.CompositionLocalProvider(
            androidx.activity.compose.LocalOnBackPressedDispatcherOwner provides (if (covered || realBackOwner == null) inertBackOwner else realBackOwner),
            // Perf (2026-10-02 measured audit): the shared header and the tab bar sit OUTSIDE
            // the per-tab LocalTabHidden below, so the header's living cast kept playing its
            // idle moves under every game / VS / settings layer (inside an invisible
            // zero-alpha layer) — a steady stream of frames competing with the board. While a
            // layer covers the tabs they count as hidden (each tab still provides its own).
            LocalTabHidden provides coveredState,
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
                        // FINISH_SPEC AJ: a tab tap lands on that tab's root from any depth (every push,
                        // layer and sheet cleared; Home / a re-tap also scrolls to the top). A live VS
                        // match asks first, since leaving counts as a forfeit.
                        BottomNav(selected = selectedTab, onSelect = { tab -> onTabTap(tab) })
                    }
                },
            ) { innerPadding ->
                androidx.compose.foundation.layout.Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                    // Shared header on EVERY tab (wordmark + PRO + Help + Settings + streak/shield).
                    // FINISH_SPEC AG: inside the page column on a tablet (the cast stays 90% of it).
                    Box(Modifier.fillMaxWidth().contentColumn()) {
                        AppHeader(
                            onSettings = { showSettings = true },
                            onNav = { infoRoute = it },
                            onSignIn = { showSignIn = true },
                            homeShare = selectedTab == 0, // BJ6: Home's share control
                        )
                    }
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
                            // FINISH_SPEC AG: a centered ~600 dp page column on a tablet (phones untouched).
                            // AQ2: one scroll watcher per tab — ambient loops hold still while any list in it moves.
                            val scrollWatch = remember(tab) { ScrollActivity() }
                            Box(Modifier.fillMaxSize().then(if (activeTab) Modifier.zIndex(1f) else Modifier.hiddenTab()).contentColumn()
                                .nestedScroll(scrollWatch)) {
                              androidx.compose.runtime.CompositionLocalProvider(LocalTabHidden provides tabHidden, LocalScrollActive provides scrollWatch.active, LocalPageTint provides tabPageTint(tab), LocalTabReselect provides tabReselect.getOrElse(tab) { 0 }) {
                                when (tab) {
                                    0 -> HomeScreen(
                                        onJoinInvite = { m, code -> vsInvite = m to code },
                                        onSelectMode = { card, unlimited ->
                                            // AY: a touch-up that followed a home tap never opens a card.
                                            if (!HomeNav.cardTapAllowed(android.os.SystemClock.uptimeMillis())) {
                                                // swallowed (tap-through guard)
                                            } else if (card.id == "vs") {
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
                                        onOpenProfile = { if (DressUp.isOwn(it)) DressUp.open() else publicProfileId = it },
                                        onPlay = { mode -> modeCardFor(mode)?.let { activeGame = it; activeSeed = null } },
                                        // Empty Friends board CTA → the Friends tab (§207 Tier 2).
                                        onOpenFriends = { selectedTab = 3 },
                                        // "All-time →" in the header → the global Records screen (D2 step 3).
                                        onOpenRecords = { showRecords = true },
                                        onGoHome = { goToRoot(TabNav.HOME, scrollToTop = false) },
                                        onSignIn = { showSignIn = true },
                                    )
                                    2 -> ProfileScreen(
                                        onGoPro = { infoRoute = "pro" },
                                        onEditProfile = { DressUp.open() },
                                        // Today's Dailies badge → open that mode's daily game (completed
                                        // puzzle if played, fresh if not) — web parity.
                                        onPlayDaily = { mode -> modeCardFor(mode)?.let { activeGame = it; activeSeed = null } },
                                        // Friends card rows → push the friend's profile in-tab.
                                        onOpenProfile = { if (DressUp.isOwn(it)) DressUp.open() else publicProfileId = it },
                                        // Compact FRIENDS row → the Friends tab (§207 Tier 3).
                                        onOpenFriends = { selectedTab = 3 },
                                        // D2 step 3: the Global Records tile on the All-time page → the Hall of Fame.
                                        onOpenRecords = { showRecords = true },
                                        vsJumpRequest = statsVsJump,
                                        onGoHome = { goToRoot(TabNav.HOME, scrollToTop = false) },
                                        onSignIn = { showSignIn = true },
                                    )
                                    3 -> FriendsScreen(
                                        onGoHome = { goToRoot(TabNav.HOME, scrollToTop = false) },
                                        onSignIn = { showSignIn = true },
                                        onOpenProfile = { if (DressUp.isOwn(it)) DressUp.open() else publicProfileId = it },
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
                                Box(Modifier.fillMaxSize().contentColumn()) {
                                    RecordsScreen(
                                        onOpenProfile = { if (DressUp.isOwn(it)) DressUp.open() else publicProfileId = it },
                                        onOpenStats = { showRecords = false; selectedTab = 2 },
                                    )
                                }
                            }
                        }

                        // Public profile is a PUSH INSIDE the tab, not a new root: iOS
                        // renders it in the tab's NavigationStack without .hidesBottomNav
                        // (ProfileTab.swift:1005-1015), so header + nav + ad banner stay.
                        publicProfileId?.let { pid ->
                            androidx.activity.compose.BackHandler { publicProfileId = null }
                            PageBackground(PageTint.HOME, Modifier.fillMaxSize().zIndex(2f)) {
                                Box(Modifier.fillMaxSize().contentColumn()) {
                                    PublicProfileScreen(
                                        userId = pid,
                                        onClose = { publicProfileId = null },
                                        // Profile-to-profile hop (nemesis row / podium rows):
                                        // same push-inside-the-tab pattern, new target id.
                                        onOpenProfile = { if (DressUp.isOwn(it)) DressUp.open() else publicProfileId = it },
                                    )
                                }
                            }
                        }

                        // AJ: leaving a live VS match from the tab bar asks first (it counts as a forfeit).
                        confirmLeaveTab?.let { tab ->
                            androidx.compose.ui.window.Dialog(onDismissRequest = { confirmLeaveTab = null }) {
                                TintedCard(Color(0xFF0D9488), corner = 24.dp, contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp)) {
                                    Text(
                                        "Leave the match? It counts as a forfeit.", fontSize = 16.sp, fontWeight = FontWeight.Black,
                                        color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        CandyButton("Stay", onClick = { confirmLeaveTab = null }, color = CandyColor.TEAL, size = CandySize.MEDIUM, modifier = Modifier.weight(1f), fill = true)
                                        CandyButton("Leave", onClick = { confirmLeaveTab = null; goToRoot(tab, true) }, color = CandyColor.PEACH, size = CandySize.MEDIUM, modifier = Modifier.weight(1f), fill = true)
                                    }
                                }
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
      // BF2: no achievement popup over a live VS match.
      if (vsActive != null || vsInvite != null) androidx.compose.runtime.DisposableEffect(Unit) {
          BadgeMoments.holds++
          onDispose { BadgeMoments.holds-- }
      }
      // BF2: the popup's "See all" opens Stats (its achievements live there).
      val seeAll = BadgeMoments.seeAllRequests
      androidx.compose.runtime.LaunchedEffect(seeAll) { if (seeAll > 0) goToRoot(2, scrollToTop = false) }
      // AY: every non-VS layer's top-left home button lands on the Home root (single-fire).
      // A live VS match keeps its own home (its leave-the-match confirm / the lobby).
      val goHome: (() -> Unit)? = if (vsActive == null && vsInvite == null) {
          { if (HomeNav.tryGoHome(android.os.SystemClock.uptimeMillis())) GameMotion.close { goToRoot(TabNav.HOME, scrollToTop = false) } }
      } else null
      // BJ9: the shell (one rounded rect) between the tabs and the game layer.
      GameMotionShell(Modifier.zIndex(2.5f))
      if (covered) androidx.compose.runtime.CompositionLocalProvider(
        LocalGoHome provides goHome,
        LocalPageTint provides when {
            friendlyGameId != null -> null // a pocket game screen
            vsInvite != null || vsActive != null || vsChallengeCode != null || vsLobby -> PageTint.VS
            activeGame?.engineMode != null -> null // a game screen
            else -> PageTint.HOME // info pages, Pro, Settings, sign-in
        },
        LocalGameTint provides soloGameAccent,
        LocalGameWallpaper provides gameWallpaperRes(soloGame?.id),
      ) { Box(
        // FINISH_SPEC AG: a solo game on a tablet sits in a centered ~560 dp column; its
        // window-anchored wallpaper also fills the sides (the game repaints the same pixels).
        Modifier.fillMaxSize().zIndex(3f)
            .gameMotionLayer()   // BJ9: the game is revealed / faded by its layer's alpha only
            .then(
                if (soloGame != null && WideLayout.isWide(androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.toFloat()))
                    Modifier.gameBackground { this }.gameColumn() else Modifier,
            ),
      ) {
        val card = activeGame
        val invite = vsInvite
        val active = vsActive
        val route = infoRoute
        val friendly = friendlyGameId
        // BJ9: a game (solo, VS, pocket) is up — it grows open on enter, shrinks closed on leave.
        if (friendly != null || invite != null || active != null || card?.engineMode != null) GameMotionMarker()
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
