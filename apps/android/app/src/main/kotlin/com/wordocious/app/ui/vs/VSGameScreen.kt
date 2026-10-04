package com.wordocious.app.ui.vs

import com.wordocious.app.ui.PageTint
import com.wordocious.app.ui.pageBackground
import com.wordocious.app.ui.Icon3D
import com.wordocious.app.ui.Icon3DName
import com.wordocious.app.ui.theme.Nunito

import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import com.wordocious.app.data.BotPersonas
import com.wordocious.app.data.BotTier
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SportsScore
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.PersonOff
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TimerOff
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wordocious.app.ui.bannerShimmer
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.miniGameCard
import com.wordocious.app.ui.game.gameTray
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.heading
import com.wordocious.app.ui.game.CornerHomeButton
import com.wordocious.app.GameViewModel
import com.wordocious.app.ui.game.GauntletStepper
import com.wordocious.app.ui.game.HintPills
import com.wordocious.app.ui.game.KeyboardView
import com.wordocious.app.ui.game.MiniBoardView
import com.wordocious.app.ui.game.hardwareKeys
import com.wordocious.app.ui.game.keyboardViewKeys
import com.wordocious.app.ui.game.MultiBoardLayout
import com.wordocious.app.ui.game.ProperNoundleHints
import com.wordocious.app.ui.game.SingleBoard
import com.wordocious.app.ui.game.StageTransitionOverlay
import com.wordocious.app.ui.game.computeCombinedLetterStates
import com.wordocious.app.ui.game.computePerBoardLetterStates
import com.wordocious.app.ui.game.XpToast
import com.wordocious.app.ui.modeAccent
import com.wordocious.app.ui.modeTitle
import com.wordocious.app.ui.modeTitleGradient
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.VsOutcome
import com.wordocious.core.VsRun
import com.wordocious.core.vsMargin
import com.wordocious.core.vsOutcome
import java.util.Locale

private class VSVMFactory(val mode: GameMode, val isDaily: Boolean, val inviteCode: String?, val launch: VsLaunch) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        VSMatchViewModel(mode, isDaily, inviteCode, launch) as T
}

private fun vsModeLabel(mode: GameMode): String = when (mode) {
    GameMode.DUEL_6 -> "SIX"; GameMode.DUEL_7 -> "SEVEN"; else -> modeTitle(mode)
}

/** Per-stage Gauntlet accent gradient — mirrors iOS `gauntletStageGradient`. */
private fun gauntletStageGradient(name: String): List<Color> = when (name) {
    "QuadWord" -> listOf(Color(0xFFFACC15), Color(0xFFF472B6), Color(0xFFC084FC))
    "Succession" -> listOf(Color(0xFFFACC15), Color(0xFFFB923C), Color(0xFFF87171))
    "Deliverance" -> listOf(Color(0xFF818CF8), Color(0xFFC084FC), Color(0xFFE879F9))
    "OctoWord" -> listOf(Color(0xFF22D3EE), Color(0xFFC084FC), Color(0xFFF472B6))
    else -> listOf(Color(0xFFC084FC), Color(0xFFF472B6))  // The Opening / fallback
}


/**
 * VS match UI — ports iOS VSGameView / web vs-game.tsx screens
 * (queue → countdown → match → waiting → result → rematch).
 *
 * VS polish (founder 2026-10-01, docs/VS_POLISH_SPEC.md): the match renders
 * the SOLO board, header and keyboard exactly, plus only a teal VS pill, the
 * compact opponent strip and the callout; every screen around it uses the
 * home/VS aesthetic (#f8f7ff page, caps 900 headlines, borderless cards) and
 * stays inside the safe area.
 */
@Composable
fun VSGameScreen(
    mode: GameMode,
    isDaily: Boolean = false,
    inviteCode: String? = null,
    launch: VsLaunch = VsLaunch.Live,
    onHome: () -> Unit,
    onGoPro: () -> Unit,
    onPlayUnlimited: () -> Unit = {},
    /** CHALLENGE BACK (§5): the Friend page with this friend preselected. */
    onChallengeBack: (friendId: String) -> Unit = {},
) {
    // Fresh VM per screen entry (iOS parity: every VSGameView push creates a new
    // @StateObject VM). The activity-scoped store kept the previous VM for the
    // same mode forever — after daily VS, "Play Unlimited VS" → lobby → Classic
    // reattached the stale daily VM (started=true, screen=ALREADY_PLAYED_DAILY),
    // so an unlimited match could never start (and finished matches re-entered on
    // their old RESULT screen). A screen-local store is disposed with the screen,
    // which also runs onCleared (socket disconnect) for abandoned matches.
    val vmOwner = remember { object : ViewModelStoreOwner { override val viewModelStore = ViewModelStore() } }
    DisposableEffect(vmOwner) { onDispose { vmOwner.viewModelStore.clear() } }
    val vm: VSMatchViewModel = viewModel(
        viewModelStoreOwner = vmOwner,
        key = "vs-$mode-$isDaily-${inviteCode ?: "rand"}-${launch.key}",
        factory = VSVMFactory(mode, isDaily, inviteCode, launch),
    )
    // Free users watch the game-start interstitial before matchmaking begins
    // (iOS VSGameView.onAppear / solo GameScreen parity). Shown once per screen.
    var adShown by rememberSaveable { mutableStateOf(false) }
    val adActivity = androidx.compose.ui.platform.LocalContext.current as? android.app.Activity
    LaunchedEffect(Unit) {
        if (!adShown && adActivity != null && com.wordocious.app.data.AdsManager.active) {
            adShown = true
            com.wordocious.app.data.AdsManager.showGameStartInterstitial(adActivity) { vm.start() }
        } else {
            adShown = true
            vm.start()
        }
    }

    fun goHome() {
        // A finished racer leaving the spectator screen settles the race now
        // (the ghost's plan is fixed) so the result still posts, then shows it.
        if (vm.race != null && vm.screen == VSScreen.WAITING) { vm.finishCpuNow(); return }
        vm.forfeit(); onHome()
    }

    // The match keeps the solo screen's page; everything around it is the VS page.
    // ART_SPEC §11: the VS pages sit on the VS page tint + tiles.
    val pageBg = if (vm.screen == VSScreen.MATCH) Modifier.background(Brush.verticalGradient(listOf(WTheme.bg, WTheme.surfaceHover)))
    else Modifier.pageBackground(PageTint.VS, alwaysLight = true)
    Box(Modifier.fillMaxSize().then(pageBg), contentAlignment = Alignment.Center) {
        when (vm.screen) {
            VSScreen.NOT_CONFIGURED -> VsNoticeScreen(
                icon = { Icon(painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = VsTeal.ink, modifier = Modifier.size(24.dp)) },
                title = "VS IS ALMOST READY",
                body = "Real-time matches turn on once the multiplayer server is connected.",
                button = "BACK", onButton = ::goHome,
                pose = com.wordocious.app.ui.MascotId.C to "map",
            )
            VSScreen.QUEUE -> QueueScreen(vm.queuePosition, vm.queueSize, vm.message, vm.inviteCode, vm, ::goHome)
            VSScreen.MATCH -> MatchScreen(vm, ::goHome)
            VSScreen.WAITING -> WaitingScreen(vm, ::goHome)
            VSScreen.RESULT -> when {
                // Async challenges finish on the home-palette screens (§3, §5).
                vm.race != null -> RaceResultScreen(vm, onHome = ::goHome, onGoPro = onGoPro, onChallengeBack = onChallengeBack)
                vm.sendLaunch != null -> ChallengeSentScreen(vm, onHome = ::goHome)
                else -> ResultScreen(vm, ::goHome, onGoPro)
            }
            VSScreen.OPPONENT_LEFT -> VsNoticeScreen(
                icon = { Icon(Icons.Filled.PersonOff, null, tint = VsTeal.ink, modifier = Modifier.size(24.dp)) },
                title = "OPPONENT LEFT THE MATCH",
                body = null,
                button = "HOME", onButton = ::goHome,
                pose = com.wordocious.app.ui.MascotId.O2 to "gasp",
            )
            // Zombie-match recovery — the server dropped the match while the app
            // was backgrounded past the reconnect grace. Nothing was recorded (no
            // spurious loss); just a clean explanation + Home.
            VSScreen.MATCH_GONE -> VsNoticeScreen(
                icon = { Icon(Icons.Filled.TimerOff, null, tint = VsTeal.ink, modifier = Modifier.size(24.dp)) },
                title = "MATCH ENDED WHILE YOU WERE AWAY",
                body = vm.message ?: "The server couldn’t hold the match open that long.",
                button = "HOME", onButton = ::goHome,
                pose = com.wordocious.app.ui.MascotId.R to "wake",
            )
            VSScreen.ALREADY_PLAYED_DAILY -> AlreadyPlayedDaily(vm.dailyAnswer, vm.isPro, vm.dailyWon, ::goHome, onGoPro, onPlayUnlimited)
        }

        // Opponent-disconnected grace banner — pinned to the top over the live
        // match / waiting screens: counts down the server's reconnect window
        // (cleared by opponent_reconnected / match_ended).
        vm.opponentDisconnectedSeconds?.let { secs ->
            if (vm.screen == VSScreen.MATCH || vm.screen == VSScreen.WAITING) {
                Box(Modifier.fillMaxSize().statusBarsPadding().padding(top = 8.dp), Alignment.TopCenter) {
                    // K1: a tinted notice in the alert red with its band, the seconds soft (A2).
                    Row(
                        Modifier.padding(horizontal = 24.dp).vsPill(Color(0xFFDC2626), 14.dp, amount = 0.14f)
                            .semantics(mergeDescendants = true) {
                                liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite
                            }
                            .padding(start = 12.dp, end = 14.dp, top = 9.dp, bottom = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        com.wordocious.app.ui.game.ToneCoin(com.wordocious.app.ui.game.FeedbackToast.Tone.ERROR, 20.dp, glyph = Icons.Filled.WifiOff)
                        Text(
                            "${vm.opponentName} disconnected — you win by forfeit in",
                            fontSize = 12.sp, fontWeight = FontWeight.Black, color = com.wordocious.app.ui.FinishInk.heading,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        VsNumber("${secs}s", 15.sp)
                        Text("unless they return", fontSize = 12.sp, fontWeight = FontWeight.Black, color = com.wordocious.app.ui.FinishInk.heading)
                    }
                }
            }
        }

        // Don't stack the countdown under the intro splash (it ticked behind
        // it and then popped in color); show it only once the intro is gone.
        vm.countdown?.let { if (!vm.showIntro) CountdownOverlay(it, vm.mode, vm.countdownIsRematch, vm.countdownTitle) }
        // Match-intro splash — sits above the countdown for 2.5s (or until tapped).
        if (vm.showIntro) {
            val profile by com.wordocious.app.data.AuthService.profile.collectAsState()
            MatchIntro(
                mode = vm.mode,
                me = IntroPlayer(
                    username = profile?.username ?: "You",
                    avatarUrl = profile?.avatarUrl,
                    level = profile?.level,
                    accentHex = profile?.accentColor,
                    avatarEmoji = profile?.avatarEmoji,
                    userId = profile?.id,
                ),
                opponent = vm.opponentUserId?.let {
                    IntroPlayer(
                        username = vm.opponentInfo?.displayName ?: "…",
                        avatarUrl = vm.opponentInfo?.avatarUrl,
                        level = vm.opponentInfo?.level,
                        userId = vm.opponentInfo?.id,
                    )
                },
                headToHead = vm.headToHead,
                onDone = { vm.showIntro = false; vm.startCountdownTick() },
            )
        }
        // The race result shows its XP in the H2H chip instead (§5).
        if (vm.screen == VSScreen.RESULT && vm.race == null) vm.xpResult?.let { XpToast(it) { vm.xpResult = null } }
    }
}

// ── Loading / queue ────────────────────────────────────────────────────────────

/**
 * Loading / entry (VS polish §2): the mode icon in its color, a teal ring
 * spinner and `LOADING <MODE>` on the VS page — never bare text or a blank
 * screen. [sub] names who is coming (a bot, a race) when known.
 */
@Composable
private fun VsLoadingScreen(mode: GameMode, sub: String? = null, botArtId: String? = null) {
    Column(
        Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true).statusBarsPadding().navigationBarsPadding().padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
    ) {
        VsModeTile(mode, 60.dp)
        // The cast's staggered wave replaces the spinner (MASCOT_SPEC §3); the label stays.
        com.wordocious.app.ui.CastRow(22.dp, motion = com.wordocious.app.ui.MascotMotion.WAVE)
        VsCapsLabel("LOADING ${vsModeName(mode).uppercase()}", color = VsTeal.label, fontSize = 12.sp)
        if (sub != null) {
            // D3: the bot coming to play waits in its own "waiting" pose on a tinted card.
            VsTintedCard(Modifier.widthIn(max = 360.dp).fillMaxWidth(), corner = 18.dp, contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (botArtId != null) VsBotPose(botArtId, "waiting", 64.dp)
                    Text(sub, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun QueueScreen(position: Int, queueSize: Int, message: String?, inviteCode: String?, vm: VSMatchViewModel, onHome: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    // CPU / race / send: no human matchmaking queue — the loading state while
    // the bot or the run spins up (the intro splash covers it a beat later).
    if (vm.isCpu || vm.race != null || vm.sendLaunch != null) {
        val persona = vm.cpuPersona
        VsLoadingScreen(
            vm.mode,
            sub = vm.race?.let { "Loading @${it.challenger.username}’s run…" }
                ?: vm.sendLaunch?.let { "Setting up a fresh puzzle…" }
                ?: persona?.let { "Matching you with ${it.name}…" },
            botArtId = persona?.artId,
        )
        return
    }
    // Private match: surface the shareable code/link so the host can invite a
    // friend (the matchmaker buckets both by the same code). No bot steps in.
    if (inviteCode != null) {
        Column(Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true)) {
            VsNavBar("PRIVATE MATCH", onBack = onHome, heading = com.wordocious.app.ui.Heading.PRIVATEMATCH) { VsModeChip(vm.mode) }
            Column(
                Modifier.fillMaxSize().navigationBarsPadding().padding(horizontal = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            ) {
                VsTintedCard(Modifier.widthIn(max = 380.dp).fillMaxWidth(), corner = 18.dp, contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp)) {
                  Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    // A7: a waiting character that isn't the page host (S).
                    VsCastPose(com.wordocious.app.ui.MascotId.I, "waiting", 84.dp)
                    VsSectionLabel("YOUR INVITE CODE")
                    VsNumber(inviteCode, 30.sp, Modifier.semantics { contentDescription = "Invite code " + inviteCode.toCharArray().joinToString(" ") })
                    Text(
                        "Share this code — the match starts when your friend joins.",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center,
                    )
                    VsTealButton("SHARE INVITE", Modifier.fillMaxWidth(), fill = true, size = com.wordocious.app.ui.CandySize.LARGE, icon = com.wordocious.app.ui.CandyIcon.SHARE) {
                        com.wordocious.app.data.ShareEvents.log("link_invite", vm.mode.name.lowercase(), "vs_lobby")
                        com.wordocious.app.data.ShareHelper.share(context, com.wordocious.app.data.ShareHelper.vsInviteText(vsModeName(vm.mode), "https://wordocious.com/vs/join/$inviteCode"), "Invite a friend")
                    }
                  }
                }
                // BI24: the cast wave, not a bare spinner.
                com.wordocious.app.ui.CastLoader(null)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    VsCapsLabel("WAITING FOR YOUR FRIEND ·", color = VsTeal.label, fontSize = 11.sp)
                    VsNumber("#${position + 1}", 13.sp)
                }
                VsSoftPill("CANCEL", color = com.wordocious.app.ui.CandyColor.PEACH) { onHome() }
                message?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center) }
            }
        }
        return
    }
    // The live search (§6): never a dead end — a bot steps in at 0:15.
    LiveSearchScreen(vm, queueSize, message, onHome)
}

/** Photo-finish flourish — a spring-in stamp for a CPU close/last-guess win,
 *  distinct from the normal win overlay. Animates on appear. */
@Composable
private fun PhotoFinishStamp(clutch: Boolean) {
    // Reduce Motion: the stamp is simply there.
    val still = WTheme.reducedMotion
    var shown by remember { mutableStateOf(still) }
    val scale by androidx.compose.animation.core.animateFloatAsState(
        targetValue = if (shown || still) 1f else 0.3f,
        animationSpec = androidx.compose.animation.core.spring(dampingRatio = 0.55f, stiffness = 260f),
        label = "pf",
    )
    LaunchedEffect(Unit) { shown = true }
    Text(
        if (clutch) "CLUTCH!" else "PHOTO FINISH!",
        fontSize = 26.sp, fontWeight = FontWeight.Black, color = VsPurple.ink,
        modifier = Modifier.graphicsLayer { scaleX = scale; scaleY = scale; rotationZ = -6f; alpha = if (shown) 1f else 0f },
    )
}

/**
 * 3-2-1-GO (VS polish §2): big digits in the MODE color on a white disc over
 * the dimmed screen — no gradient text. A light scrim keeps the intro →
 * countdown hand-off on the same page and still hides the queue underneath.
 */
@Composable
private fun CountdownOverlay(count: Int, mode: GameMode, isRematch: Boolean = false, title: String? = null) {
    val accent = modeAccent(mode)
    Box(
        Modifier.fillMaxSize().background(VsTeal.page.copy(alpha = 0.94f)),
        Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
            // BJ16: MATCH FOUND! as lettering (other countdown labels stay caps text).
            if (title == null && !isRematch) com.wordocious.app.ui.HeadingArt(com.wordocious.app.ui.Heading.MATCHFOUND, height = 40.dp)
            else Text(
                title ?: if (isRematch) "REMATCH STARTING IN" else "MATCH FOUND",
                fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 2.4.sp, color = VsTeal.label,
            )
            VsModeChip(mode)
            Box(Modifier.size(170.dp), Alignment.Center) {
                // A ring pulses out from behind each tick, so the number bursts
                // instead of just swapping (iOS parity).
                CountdownRing(count, accent)
                // A1 the disc takes the mode's wash; A2 the digits are soft numbers.
                Box(
                    Modifier.size(132.dp)
                        .shadow(8.dp, CircleShape, ambientColor = accent.copy(alpha = 0.35f), spotColor = accent.copy(alpha = 0.35f))
                        .clip(CircleShape).background(vsWash(accent, 0.14f)).border(2.dp, vsLine(accent), CircleShape)
                        .semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite; contentDescription = if (count == 0) "Go" else "$count" },
                    Alignment.Center,
                ) {
                    VsNumber(if (count == 0) "GO!" else "$count", if (count == 0) 50.sp else 80.sp, Modifier.clearAndSetSemantics { })
                }
            }
        }
    }
}

/** The countdown's pulsing ring — expands from 0.4x and fades out on each tick
 *  (iOS `.transition(.scale(scale: 0.4).combined(with: .opacity))`). */
@Composable
private fun CountdownRing(count: Int, accent: Color) {
    if (WTheme.reducedMotion) {
        Box(Modifier.size(160.dp).border(3.dp, accent, CircleShape))
        return
    }
    val anim = remember(count) { androidx.compose.animation.core.Animatable(0.4f) }
    LaunchedEffect(count) {
        anim.animateTo(1f, androidx.compose.animation.core.spring(dampingRatio = 0.6f, stiffness = 260f))
    }
    Box(
        Modifier.size(160.dp)
            .graphicsLayer {
                val v = anim.value
                scaleX = v; scaleY = v
                alpha = ((v - 0.4f) / 0.6f).coerceIn(0f, 1f)
            }
            .border(3.dp, accent, CircleShape),
    )
}

// ── The match ──────────────────────────────────────────────────────────────────

@Composable
private fun MatchScreen(vm: VSMatchViewModel, onHome: () -> Unit) {
    val game = vm.game
    if (game == null) { VsLoadingScreen(vm.mode); return }
    val state by game.state.collectAsState()
    val input by game.currentInput.collectAsState()
    val invalid by game.invalidWord.collectAsState()
    val shakeKey by game.shakeKey.collectAsState()
    val multiBoard = state.boards.size > 1
    // Same predicate the solo screen uses: VS Gauntlet has a Succession stage
    // too, and a mode-only test rendered it as QuadWord with a frozen board.
    val isSequential = game.isSequentialStage
    val useQuadrant = multiBoard && !isSequential
    // AQ2: memoized on the state (this body recomposes on every keystroke).
    val letterStatesNow = remember(state) {
        if (isSequential) computeCombinedLetterStates(listOf(state.boards[game.activeBoardIndex]))
        else computeCombinedLetterStates(state.boards)
    }
    val perBoardNow = if (useQuadrant) remember(state) { computePerBoardLetterStates(state.boards) } else null
    // AQ1: keys take their colors tile by tile as the row lands (solo parity).
    val reducedKeys = WTheme.reducedMotion
    val revealKey = remember(state) { state.boards.sumOf { it.guesses.size } }
    val newestRows = remember(state) { com.wordocious.app.ui.game.KeyReveal.newestRows(state.boards, isSequential) }
    val revealWidth = newestRows.maxOfOrNull { it.size } ?: 0
    val letterStates = com.wordocious.app.ui.game.rememberTileByTile(letterStatesNow, revealWidth, revealKey, reducedKeys, mini = multiBoard) { base, n ->
        com.wordocious.app.ui.game.KeyReveal.during(base, letterStatesNow, newestRows, n)
    }
    val perBoardStates = perBoardNow?.let { now ->
        val boardRows = remember(state) {
            val newest = state.boards.maxOfOrNull { it.guesses.size } ?: 0
            state.boards.map { b -> if (newest > 0 && b.guesses.size == newest) com.wordocious.app.ui.game.KeyReveal.newestRows(listOf(b), false) else emptyList() }
        }
        com.wordocious.app.ui.game.rememberTileByTile(now, revealWidth, revealKey, reducedKeys, mini = multiBoard) { base, n ->
            now.mapIndexed { i, target -> com.wordocious.app.ui.game.KeyReveal.during(base.getOrElse(i) { emptyMap() }, target, boardRows.getOrElse(i) { emptyList() }, n) }
        }
    }
    // ProperNoundle: multi-word names split into word groups exactly like solo
    // (the server's puzzle display first, the seed's puzzle as a fallback;
    // SingleBoard ignores groups that don't add up to the row).
    val pnGroups = remember(game, vm.puzzleDisplay) {
        if (vm.mode != GameMode.PROPERNOUNDLE) null
        else (vm.puzzleDisplay ?: game.pnPuzzle?.display)?.let { com.wordocious.core.ProperNoundle.wordGroups(it) }
    }

    // Throttled typing relay — ping while letters are in the current row (web onTyping).
    LaunchedEffect(input) { if (input.isNotEmpty()) vm.notifyTyping() }
    // Light haptic on every opponent guess row (web navigator.vibrate parity).
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    LaunchedEffect(vm.opponentGuessTick) {
        if (vm.opponentGuessTick > 0) haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove)
    }

    // Leaving an in-progress match forfeits it (a recorded loss) — confirm first.
    var confirmForfeit by remember { mutableStateOf(false) }
    // BI22: the whole ProperNoundle clue card (opened from the two-line clue slot).
    var showClueCard by remember { mutableStateOf(false) }
    // Confirm only when leaving would TRULY forfeit (a recorded loss): CPU
    // practice and already-resolved matches leave without the scary "counts as
    // a loss" dialog, which would be lying there.
    val leave: () -> Unit = { if (vm.leaveWouldForfeit) confirmForfeit = true else onHome() }
    // System Back asks too — only during a live match (VS polish §3).
    androidx.activity.compose.BackHandler(enabled = vm.leaveWouldForfeit && !confirmForfeit) { confirmForfeit = true }
    if (confirmForfeit) {
        VsConfirmDialog(
            title = "FORFEIT MATCH?",
            body = "Leaving now forfeits the match — it counts as a loss" + (if (vm.isDaily) " and uses today’s daily VS." else "."),
            confirm = "FORFEIT & LEAVE",
            dismiss = "KEEP PLAYING",
            onConfirm = { confirmForfeit = false; onHome() },
            onDismiss = { confirmForfeit = false },
        )
    }

    // Physical keyboard (founder, 2026-09-30): same keys as the on-screen keyboard; inert during
    // the intro/countdown, a Gauntlet stage interstitial, the forfeit dialog and once finished.
    val vsStageCleared = vm.mode == GameMode.GAUNTLET && state.gauntlet != null &&
        state.status == GameStatus.PLAYING && state.boards.isNotEmpty() &&
        state.boards.all { it.status == GameStatus.WON }
    val keysLive = state.status == GameStatus.PLAYING && vm.countdown == null && !vm.showIntro &&
        !confirmForfeit && !vsStageCleared
    Box(
        Modifier.fillMaxSize().hardwareKeys(enabled = keysLive) { k ->
            keyboardViewKeys(
                onKey = { game.typeLetter(it) },
                onDelete = { game.deleteLetter() },
                onEnter = { game.submit(applyToAll = multiBoard) },
            )(k)
        },
    ) {
    // statusBarsPadding: content stays below the status bar (Android 15+
    // draws edge to edge), exactly like the solo screen.
    Column(Modifier.fillMaxSize().statusBarsPadding().padding(horizontal = 10.dp)) {
        // The SOLO header (VS polish §1): Gauntlet stepper, the mode title in
        // its usual style + a small solid teal VS pill, the solo stat row with
        // the match clock. Side insets clear the corner Home button.
        Column(
            Modifier.fillMaxWidth().padding(start = 46.dp, end = 46.dp, top = 8.dp, bottom = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (vm.mode == GameMode.GAUNTLET) {
                val g = state.gauntlet
                GauntletStepper(
                    current = g?.currentStage ?: 0, total = g?.totalStages ?: 5,
                    cleared = g?.stageResults?.map { it.stageIndex }?.toSet() ?: emptySet(),
                    stageName = g?.let { it.stages.getOrNull(it.currentStage)?.name } ?: "",
                )
                Spacer(Modifier.height(2.dp))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val stageName = state.gauntlet?.let { it.stages.getOrNull(it.currentStage)?.name }
                VsSoloTitle(vm.mode, stageName, Modifier.weight(1f, fill = false))
                VsPill()
            }
            Spacer(Modifier.height(2.dp))
            VsStatRow(vm, game, state)
            // ProperNoundle VS: the Wikipedia clue (italic, centered) — BI22: the solo screen's
            // fixed two-line slot, always present, so revealing it never shrinks the board;
            // tap it for the whole clue as an overlay card.
            if (vm.mode == GameMode.PROPERNOUNDLE) {
                val clueText by game.clue.collectAsState()
                val loadingClue by game.loadingClue.collectAsState()
                com.wordocious.app.ui.game.ProperNoundleClueSlot(clueText, loadingClue, onOpen = { showClueCard = true })
            }
        }
        // A run to send has no opponent: the panel says who will race it (§3).
        val send = vm.sendLaunch
        if (send != null) {
            SendRunPanel(send, Modifier.padding(top = 4.dp))
        } else {
            // Gauntlet: the strip shows the opponent's stage in its accent
            // instead of a meaningless "x/21 boards".
            val oppStageName = if (vm.mode == GameMode.GAUNTLET)
                com.wordocious.core.gauntletStages.getOrNull(vm.opponent.stagesCleared)?.name else null
            VsOpponentBar(
                // A race shows whose run the ghost is replaying (§4).
                name = vm.race?.let { "@${it.challenger.username}’s run" } ?: vm.opponentName,
                avatarUrl = vm.opponentInfo?.avatarUrl,
                opponent = vm.opponent,
                // The STARTING row budget (live maxGuesses can shrink, e.g. Gauntlet steal-guess).
                maxGuesses = game.initialMaxGuesses,
                wordLength = game.wordLength,
                typing = vm.opponentTyping,
                modifier = Modifier.padding(top = 4.dp),
                totalBoards = vm.totalBoards,
                stageName = oppStageName,
                stageGradient = oppStageName?.let { gauntletStageGradient(it) } ?: emptyList(),
                avatarName = vm.race?.challenger?.username ?: vm.opponentName,
                avatarUserId = vm.opponentInfo?.id,
            )
        }

        // Board area — the solo components with the solo arguments.
        Box(Modifier.weight(1f).fillMaxWidth().padding(top = 4.dp)) {
            if (multiBoard) {
                MultiBoardLayout(
                    boards = state.boards, currentGuess = input, currentBoardIndex = game.activeBoardIndex,
                    isSequential = isSequential, isInvalid = invalid, shakeKey = shakeKey,
                    modifier = Modifier.fillMaxSize().padding(4.dp),
                )
            } else {
                SingleBoard(
                    board = state.boards[0], currentGuess = input, isInvalid = invalid, shakeKey = shakeKey,
                    modifier = Modifier.fillMaxSize(), wordGroups = pnGroups,
                )
            }
            // Moment callout — opponent milestones (greens / board solved /
            // last guess) as a soft pill floating over the top of the board,
            // right under the opponent strip in every mode.
            // D3: the bot's banter bubble (kind, per character) under the strip, its
            // tail toward the bot; the K1 callout below it. A7: the callout's O2 steps
            // aside when Opal is the bot on screen.
            Column(Modifier.fillMaxWidth().padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val castId = vm.cpuCastId
                if (castId != null) {
                    VsBanterBubble(vm.banter, BotPersonas.name(castId), vsBotColor(castId), Modifier.padding(start = 14.dp))
                }
                vm.callout?.let { text ->
                    val botMascot = vsBotMascot(castId)
                    Box(Modifier.fillMaxWidth(), Alignment.TopCenter) {
                        VsCalloutPill(
                            text,
                            pose = (if (botMascot == com.wordocious.app.ui.MascotId.O2) vsSpareCast(botMascot, preferred = listOf(com.wordocious.app.ui.MascotId.I, com.wordocious.app.ui.MascotId.O1)) to "cheer"
                            else com.wordocious.app.ui.MascotId.O2 to "gasp"),
                        )
                    }
                }
            }
        }
        // ProperNoundle VS: Clue/Vowel/Consonant hint pills (parity with solo).
        if (vm.mode == GameMode.PROPERNOUNDLE && game.hasHints) {
            val clueText by game.clue.collectAsState()
            val loadingClue by game.loadingClue.collectAsState()
            val vRev by game.vowelRevealed.collectAsState()
            val cRev by game.consonantRevealed.collectAsState()
            ProperNoundleHints(
                clueUsed = clueText != null || loadingClue, loadingClue = loadingClue,
                vowelRevealed = vRev, consonantRevealed = cRev,
                onClue = { game.revealClue() }, onVowel = { game.revealVowel() }, onConsonant = { game.revealConsonant() },
            )
        }
        // Six/Seven VS: Vowel/Consonant hint pills (parity with solo — each reveal
        // is a board row → counts as a guess, the VS cost). Cyan Six / lime Seven.
        if ((vm.mode == GameMode.DUEL_6 || vm.mode == GameMode.DUEL_7) && game.hasHints) {
            val vUsed by game.vowelUsed.collectAsState()
            val cUsed by game.consonantUsed.collectAsState()
            val vRev by game.vowelRevealed.collectAsState()
            val cRev by game.consonantRevealed.collectAsState()
            HintPills(
                accent = if (vm.mode == GameMode.DUEL_7) Color(0xFF84CC16) else Color(0xFF06B6D4),
                vowelUsed = vUsed, vowelRevealed = vRev, consonantUsed = cUsed, consonantRevealed = cRev,
                onVowel = { game.revealVowel() }, onConsonant = { game.revealConsonant() },
            )
        }
        Spacer(Modifier.height(6.dp))
        KeyboardView(
            letterStates = letterStates,
            onKey = { game.typeLetter(it) },
            onDelete = { game.deleteLetter() },
            // applyToAll tracks BOARD COUNT, not the keyboard layout. They differ
            // on exactly one case — a sequential stage — and passing useQuadrant
            // here sent VS Succession guesses down the single-board path, where
            // the reducer falls back to currentBoardIndex (always 0, already WON)
            // and drops every guess. Same stall the solo screen had; solo already
            // uses `multiBoard`, and iOS uses `isMultiBoard`.
            onEnter = { game.submit(applyToAll = multiBoard) },
            perBoardStates = perBoardStates,
        )
        Spacer(Modifier.height(8.dp))
    }

    // Corner Home button — the solo one (44 dp circle, accent stroke).
    CornerHomeButton(
        accent = modeAccent(vm.mode), onClick = leave,
        modifier = Modifier.statusBarsPadding().padding(8.dp),
    )

    // Gauntlet VS stage-transition overlay — the same interstitial as solo, shown
    // the moment every board in the current stage is won and the run is live.
    val gauntlet = state.gauntlet
    val stageCardUp = vm.mode == GameMode.GAUNTLET && gauntlet != null &&
        state.status == GameStatus.PLAYING && state.boards.isNotEmpty() &&
        state.boards.all { it.status == GameStatus.WON }
    // Founder 10-02: this player's race clock pauses while their own stage card is up (solo parity).
    androidx.compose.runtime.LaunchedEffect(stageCardUp) { vm.stageCardShown(stageCardUp) }
    if (stageCardUp && gauntlet != null) {
        StageTransitionOverlay(
            isVersus = true,
            completed = gauntlet.stages[gauntlet.currentStage],
            next = gauntlet.stages.getOrNull(gauntlet.currentStage + 1),
            guessesSoFar = com.wordocious.app.ui.game.GauntletLook.guessesSoFar(gauntlet, state.boards),
        ) { game.advanceGauntletStage() }
    }

    // BI22 the whole ProperNoundle clue, over the match (the header slot shows two lines).
    if (showClueCard && vm.mode == GameMode.PROPERNOUNDLE) {
        val clueText by game.clue.collectAsState()
        clueText?.let { com.wordocious.app.ui.game.ProperNoundleClueOverlay(it) { showClueCard = false } }
    }

    }
}

/** The solo screen's title for this mode (Gauntlet: the stage in its accent;
 *  ProperNoundle flat red 24; others the 28 gradient title), shrinking to fit
 *  beside the VS pill on narrow phones. */
@Composable
private fun VsSoloTitle(mode: GameMode, stageName: String?, modifier: Modifier = Modifier) {
    val text: String
    val base: TextUnit
    val style: TextStyle
    when (mode) {
        GameMode.GAUNTLET -> {
            text = stageName ?: modeTitle(mode); base = 13.sp // the art header above is the title
            style = TextStyle(fontFamily = Nunito, brush = Brush.horizontalGradient(gauntletStageGradient(stageName ?: "")))
        }
        GameMode.PROPERNOUNDLE -> {
            text = modeTitle(mode); base = 24.sp
            style = TextStyle(fontFamily = Nunito, color = Color(0xFFDC2626))
        }
        else -> {
            text = modeTitle(mode); base = 28.sp
            style = TextStyle(fontFamily = Nunito, brush = Brush.horizontalGradient(modeTitleGradient(mode)))
        }
    }
    var size by remember(text) { mutableStateOf(base) }
    Text(
        text, fontSize = size, fontWeight = FontWeight.Black, style = style,
        maxLines = 1, softWrap = false,
        onTextLayout = { r -> if (r.didOverflowWidth && size > 14.sp) size *= 0.9f },
        modifier = modifier,
    )
}

/** The small solid teal `VS` pill beside the mode title. */
@Composable
private fun VsPill() {
    Text(
        "VS", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = Color.White,
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(VsTeal.ink).padding(horizontal = 7.dp, vertical = 2.dp),
    )
}

/** The solo header's stat row (iOS progressLabel / gauntletHeader) with the
 *  match clock in place of the solo clock. */
@Composable
private fun VsStatRow(vm: VSMatchViewModel, game: GameViewModel, state: GameState) {
    val isGauntlet = vm.mode == GameMode.GAUNTLET
    val statSp = if (isGauntlet) 11.sp else 12.sp
    val statIcon = if (isGauntlet) 10.dp else 11.dp
    val used = game.rowsUsed
    val max = game.maxGuesses
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        val solved = state.boards.count { it.status == GameStatus.WON }
        // A2: the counts and the clock are soft numbers (theme-aware: the match page follows the theme).
        val numSp = statSp * 1.18f
        @Composable
        fun Stat(num: String, label: String) {
            Row(
                Modifier.semantics(mergeDescendants = true) { },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                com.wordocious.app.ui.SoftNumber(num, numSp)
                Text(label, color = WTheme.textMuted, fontSize = statSp, fontWeight = FontWeight.Bold)
            }
        }
        when {
            isGauntlet -> {
                if (state.boards.size > 1) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TROPHY, statIcon + 3.dp)
                        Spacer(Modifier.width(3.dp))
                        com.wordocious.app.ui.SoftNumber("$solved/${state.boards.size}", numSp)
                    }
                }
                Stat("$used/$max", "guesses")
            }
            state.boards.size > 1 -> Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Stat("$solved/${state.boards.size}", "solved ·")
                Stat("$used/$max", "guesses")
            }
            else -> Stat("$used/$max", "guesses")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Schedule, null, tint = Color(0xFF60A5FA), modifier = Modifier.size(statIcon))
            Spacer(Modifier.width(3.dp))
            VsMatchClock(vm, numSp, soft = true)
        }
    }
}

/** m:ss since match start — the only thing that recomposes every second. */
@Composable
private fun VsMatchClock(vm: VSMatchViewModel, size: TextUnit, color: Color = WTheme.textMuted, soft: Boolean = false, light: Boolean = false) {
    var tick by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); tick++ } }
    @Suppress("UNUSED_EXPRESSION") tick
    val secs = vm.matchElapsedSeconds
    val text = "${secs / 60}:${"%02d".format(secs % 60)}"
    // A2 soft digits: theme-aware on the match page, pinned light on the VS pages.
    when {
        light -> VsNumber(text, size)
        soft -> com.wordocious.app.ui.SoftNumber(text, size)
        else -> Text(text, color = color, fontSize = size, fontWeight = FontWeight.Bold)
    }
}

/** Soft confirm card (VS polish §2): caps title, purple primary, soft secondary. */
@Composable
private fun VsConfirmDialog(title: String, body: String, confirm: String, dismiss: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        // A1 a tinted dialog card; A8 the action pink, keep-playing peach.
        VsTintedCard(com.wordocious.app.ui.PopupWidth.fillMaxWidth(), accent = VS_RESULT_ACCENT, corner = 20.dp, contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp)) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                VsCastPose(com.wordocious.app.ui.MascotId.O2, "gasp", 84.dp)
                Text(
                    title, fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsPurple.deep, textAlign = TextAlign.Center,
                    modifier = Modifier.semantics { heading() },
                )
                Text(body, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center)
                CandyButtonFill(confirm, onConfirm, color = com.wordocious.app.ui.CandyColor.PINK, size = com.wordocious.app.ui.CandySize.MEDIUM)
                CandyButtonFill(dismiss, onDismiss, color = com.wordocious.app.ui.CandyColor.PEACH, size = com.wordocious.app.ui.CandySize.MEDIUM)
            }
        }
    }
}

// ── "Still playing" waiting screen ─────────────────────────────────────────────

/**
 * Spectator waiting screen (VS polish §2) — you finished; a teal one-window
 * card says who is still playing and what they need, then their live boards
 * drawn with the SOLO mini-board (colors only) in a fixed grid that never
 * overlaps or overflows, your result, SKIP TO RESULT (bots/races) and LEAVE.
 */
@Composable
private fun WaitingScreen(vm: VSMatchViewModel, onHome: () -> Unit) {
    val oppName = vm.opponentName
    // Bots read "ROOK", races the challenger — never "ROOK · BOT".
    val headName = vm.cpuPersona?.name ?: vm.race?.challenger?.username ?: oppName
    val totalBoardsLocal = vm.game?.boardCount ?: 1
    val liveTotalBoards = if (vm.opponent.totalBoards > 0) vm.opponent.totalBoards else totalBoardsLocal

    // STAKES copy — web parity. The real win rule is: solve, then tie-break on
    // boardsSolved, then composite score = guesses + timeSeconds/45. The
    // opponent is still playing, so they're almost always behind on time and
    // need strictly FEWER guesses; if they're somehow still ahead of your
    // clock, matching your guess count could win on time.
    // The completion-reported total, not myGuessCount — Six/Seven hint reveals
    // add a board row without hitting onGuessCommitted (iOS myFinalGuesses).
    val myGuesses = vm.myFinalGuesses ?: vm.myGuessCount
    val stakes: String = run {
        val boardsLeft = liveTotalBoards - vm.opponent.boardsSolved
        if (vm.myStatus == GameStatus.LOST) {
            if (liveTotalBoards > 1) "$headName needs $boardsLeft more board${if (boardsLeft == 1) "" else "s"} to win"
            else "$headName just needs to solve to win"
        } else if (liveTotalBoards > 1 && boardsLeft > 1) {
            "$headName needs $boardsLeft more boards to stay alive"
        } else {
            val opponentTimeBehind = vm.matchElapsedSeconds * 1000L > vm.playerTimeMs
            val target = if (opponentTimeBehind) myGuesses - 1 else myGuesses
            if (target <= 0 || vm.opponent.attempts >= target) "$headName can no longer beat your score!"
            else "$headName must solve in $target or fewer to beat you"
        }
    }

    LazyColumn(
        Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true).statusBarsPadding().navigationBarsPadding().padding(horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { Spacer(Modifier.height(4.dp)) }
        // The one-window card (A1 tinted, top bar): the opponent waits in character —
        // a bot in its own "waiting" pose (D3), a person beside S waiting (A7: one of each).
        item {
            val botId = vm.cpuPersona?.artId
            val oppMascot = vsBotMascot(botId)
            VsTintedCard(
                Modifier.widthIn(max = 520.dp).fillMaxWidth(), corner = 18.dp, barHeight = 10.dp,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp), verticalArrangement = Arrangement.spacedBy(0.dp),
            ) {
                Column(
                    Modifier.fillMaxWidth().background(vsWash(VS_ACCENT, 0.20f))
                        .padding(start = 14.dp, top = 10.dp, end = 12.dp, bottom = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        "${headName.uppercase()} IS STILL PLAYING", fontSize = 16.sp, fontWeight = FontWeight.Black,
                        letterSpacing = 0.4.sp, color = VsTeal.deep, maxLines = 2, modifier = Modifier.semantics { heading() },
                    )
                    Text(stakes, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.2.sp, color = VsTeal.ink)
                }
                Row(
                    Modifier.fillMaxWidth().padding(start = 8.dp, end = 14.dp, top = 8.dp, bottom = 12.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (botId != null) {
                        VsBotPose(botId, "waiting", 84.dp)
                    } else {
                        // Breathing "live" ring signals an active opponent while you wait.
                        Box(Modifier.padding(start = 6.dp), contentAlignment = Alignment.Center) {
                            if (!WTheme.reducedMotion) {
                                val inf = androidx.compose.animation.core.rememberInfiniteTransition(label = "pulse")
                                val s by inf.animateFloat(
                                    0.9f, 1.4f,
                                    androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(1500), androidx.compose.animation.core.RepeatMode.Restart),
                                    label = "s",
                                )
                                val a by inf.animateFloat(
                                    0.7f, 0f,
                                    androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(1500), androidx.compose.animation.core.RepeatMode.Restart),
                                    label = "a",
                                )
                                // ART_SPEC §20: around a letter tile the ring is a concentric rounded square.
                                // AN6 / BJ5: photos and mascots are both rounded squares.
                                val ringShape = RoundedCornerShape(48.dp * 0.24f + 2.dp)
                                Box(
                                    Modifier.size(52.dp)
                                        .graphicsLayer { scaleX = s; scaleY = s; alpha = a }
                                        .border(2.dp, VS_ACCENT, ringShape),
                                )
                            }
                            VsAvatar(oppName, vm.opponentInfo?.avatarUrl, size = 48.dp, borderColor = Color.Transparent, userId = vm.opponentInfo?.id)
                        }
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(oppName, fontSize = 14.sp, fontWeight = FontWeight.Black, color = com.wordocious.app.ui.FinishInk.heading, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        val attempts = vm.opponent.attempts
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                            VsNumber("$attempts", 14.sp)
                            Text(
                                "${if (attempts == 1) "guess" else "guesses"} ·",
                                fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub,
                            )
                            VsMatchClock(vm, 14.sp, light = true)
                            if (liveTotalBoards > 1) {
                                Text("·", fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub)
                                VsNumber("${vm.opponent.boardsSolved}/$liveTotalBoards", 14.sp)
                                Text("boards", fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub)
                            }
                        }
                        // D3: the bot keeps chatting while you wait.
                        if (botId != null && vm.cpuCastId != null) {
                            VsBanterBubble(vm.banter, headName, vsBotColor(botId))
                        }
                    }
                    if (vm.opponentTyping) TypingDots(dotSize = 6.dp, color = VS_ACCENT)
                    if (botId == null) VsCastPose(vsSpareCast(oppMascot, preferred = listOf(com.wordocious.app.ui.MascotId.S, com.wordocious.app.ui.MascotId.U)), "waiting", 64.dp)
                }
            }
        }
        // Their live board(s). Gauntlet spectates by STAGE (its 21 boards are
        // meaningless as a flat wall) — a card per stage.
        if (vm.mode == GameMode.GAUNTLET) {
            items(com.wordocious.core.gauntletStages.size) { idx ->
                GauntletSpectatorStage(idx, vm.opponent, vm.wordLen)
            }
        } else {
            item {
                val template = vm.game?.state?.value?.boards.orEmpty()
                val startRows = vm.game?.initialMaxGuesses ?: 6
                val boards = (0 until liveTotalBoards).map { i ->
                    spectatorBoard(template.getOrNull(i), vm.opponent.tiles[i].orEmpty(), vm.wordLen, startRows)
                }
                Box(
                    Modifier.widthIn(max = 520.dp).fillMaxWidth().vsCard(16.dp).padding(14.dp),
                    Alignment.Center,
                ) {
                    SpectatorBoardGrid(boards, vm.opponent.tiles)
                }
            }
        }
        // Your result, in the soft card style.
        item {
            val solvedLine = if (vm.totalBoards > 1) "${vm.myBoardsSolved}/${vm.totalBoards}"
            else if (vm.myStatus == GameStatus.WON) "Solved" else "Not solved"
            VsTintedCard(
                Modifier.widthIn(max = 520.dp).fillMaxWidth(), accent = VS_RESULT_ACCENT, corner = 18.dp,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                VsSectionLabel("YOUR RESULT", modifier = Modifier.semantics { heading() })
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    VsStatTile("GUESSES", "$myGuesses", Modifier.weight(1f), accent = VS_RESULT_ACCENT)
                    VsStatTile("TIME", com.wordocious.core.vsClock(vm.playerTimeMs.toLong()), Modifier.weight(1f), accent = VS_RESULT_ACCENT)
                    VsStatTile(if (vm.totalBoards > 1) "BOARDS" else "RESULT", solvedLine, Modifier.weight(1f), accent = VS_RESULT_ACCENT, valueSize = if (solvedLine.length > 6) 15.sp else 22.sp)
                }
            }
        }
        // CPU / race spectator: skip watching the bot grind out its boards — the
        // outcome is already fixed by its plan. Win-locked → CLAIM YOUR WIN;
        // else a neutral SKIP TO RESULT (may resolve to a win OR a loss).
        if (vm.isCpu || vm.race != null) {
            item {
                val boardsLeft = liveTotalBoards - vm.opponent.boardsSolved
                val winLocked = vm.myStatus != GameStatus.LOST && !(liveTotalBoards > 1 && boardsLeft > 1) && run {
                    val behind = vm.matchElapsedSeconds * 1000L > vm.playerTimeMs
                    val target = if (behind) myGuesses - 1 else myGuesses
                    target <= 0 || vm.opponent.attempts >= target
                }
                val skipHaptic = androidx.compose.ui.platform.LocalHapticFeedback.current
                // A8: CLAIM YOUR WIN is the purple primary; SKIP TO RESULT the teal action.
                CandyButtonFill(
                    if (winLocked) "CLAIM YOUR WIN" else "SKIP TO RESULT",
                    onClick = {
                        skipHaptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                        vm.finishCpuNow()
                    },
                    modifier = Modifier.widthIn(max = 520.dp),
                    color = if (winLocked) com.wordocious.app.ui.CandyColor.PURPLE else com.wordocious.app.ui.CandyColor.TEAL,
                    icon = if (winLocked) null else com.wordocious.app.ui.CandyIcon.ARROW,
                )
            }
        }
        item { VsSoftPill("LEAVE", color = com.wordocious.app.ui.CandyColor.PEACH) { onHome() } }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

/** The teal one-window look (VS banner): gradient, gloss, soft shadow, r16. */
private fun Modifier.vsTealWindow(): Modifier =
    // A1: the tinted teal window with the game-card top bar.
    this.shadow(6.dp, RoundedCornerShape(18.dp), ambientColor = Color(0x144C1D95), spotColor = Color(0x144C1D95))
        .clip(RoundedCornerShape(18.dp))
        .background(vsWash(VS_ACCENT))
        .drawWithContent {
            drawContent()
            drawRect(VS_ACCENT, size = Size(size.width, 10.dp.toPx()))
        }
        .border(1.5.dp, vsLine(VS_ACCENT), RoundedCornerShape(18.dp))

/**
 * A spectator board for the solo MiniBoardView: the local board's shape (word
 * length, row budget, Deliverance prefills) with the opponent's color rows.
 * Won when a row is all green; out of rows reads as lost.
 */
private fun spectatorBoard(template: BoardState?, rows: List<List<TileState>>, wordLen: Int, startRows: Int): BoardState {
    val len = template?.solution?.length?.takeIf { it > 0 } ?: wordLen
    val max = template?.maxGuesses?.coerceAtLeast(startRows) ?: startRows
    val won = rows.any { r -> r.isNotEmpty() && r.all { it == TileState.CORRECT } }
    val status = when {
        won -> GameStatus.WON
        rows.size >= max -> GameStatus.LOST
        else -> GameStatus.PLAYING
    }
    return BoardState(
        solution = template?.solution ?: " ".repeat(len),
        maxGuesses = max,
        status = status,
        prefilledGuesses = template?.prefilledGuesses,
    )
}

/**
 * The opponent's boards as solo mini boards in a FIXED grid — 1 board
 * centered, 2–4 in 2 columns, more in 4 — every cell weighted inside the card
 * width with square-ish tiles, so boards can never overlap or overflow
 * horizontally (the old fixed-dp chunked rows did on 360 dp phones).
 */
@Composable
private fun SpectatorBoardGrid(boards: List<BoardState>, tiles: Map<Int, List<List<TileState>>>, singleMaxWidth: Dp = 210.dp) {
    fun ratio(b: BoardState, rows: Int): Float =
        b.solution.length.toFloat() / ((b.prefilledGuesses?.size ?: 0) + maxOf(b.maxGuesses, rows)).coerceAtLeast(1)
    if (boards.size <= 1) {
        val b = boards.firstOrNull() ?: return
        val rows = tiles[0].orEmpty()
        // L: each spectated board sits in the shared game tray (won purple / lost slate).
        Box(Modifier.widthIn(max = singleMaxWidth + 16.dp).fillMaxWidth().gameTray(VS_ACCENT, trayState(b), corner = 14.dp, padding = androidx.compose.foundation.layout.PaddingValues(7.dp))) {
            Box(Modifier.fillMaxWidth().aspectRatio(ratio(b, rows.size))) {
                MiniBoardView(board = b, stateRows = rows, modifier = Modifier.fillMaxSize())
            }
        }
        return
    }
    val cols = if (boards.size > 4) 4 else 2
    val gap = if (cols == 4) 6.dp else 10.dp
    Column(Modifier.fillMaxWidth().padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(gap + 2.dp)) {
        boards.indices.chunked(cols).forEach { rowIdx ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap)) {
                rowIdx.forEach { i ->
                    val rows = tiles[i].orEmpty()
                    Box(Modifier.weight(1f).gameTray(VS_ACCENT, trayState(boards[i]), corner = 10.dp, padding = androidx.compose.foundation.layout.PaddingValues(4.dp), shadow = false)) {
                        Box(Modifier.fillMaxWidth().aspectRatio(ratio(boards[i], rows.size))) {
                            MiniBoardView(board = boards[i], stateRows = rows, modifier = Modifier.fillMaxSize())
                        }
                    }
                }
                repeat(cols - rowIdx.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** L the tray state for a spectated board. */
private fun trayState(b: BoardState): com.wordocious.app.ui.game.TrayState = when (b.status) {
    GameStatus.WON -> com.wordocious.app.ui.game.TrayState.WON
    GameStatus.LOST -> com.wordocious.app.ui.game.TrayState.LOST
    else -> com.wordocious.app.ui.game.TrayState.PLAYING
}

/**
 * One Gauntlet spectator stage card — the stage name in its accent, a
 * CLEARED / PLAYING / locked chip, and that stage's boards (iOS
 * GauntletSpectatorView). Cleared stages compact to the rows actually used;
 * the active stage renders its full frame; locked stages hide their boards.
 */
@Composable
private fun GauntletSpectatorStage(idx: Int, opponent: OpponentProgressState, wordLen: Int) {
    val stage = com.wordocious.core.gauntletStages[idx]
    val accent = gauntletStageGradient(stage.name).first()
    val cleared = idx < opponent.stagesCleared
    val active = idx == opponent.stagesCleared
    val locked = idx > opponent.stagesCleared
    val offset = com.wordocious.core.gauntletStages.take(idx).sumOf { it.boardCount }
    Column(
        Modifier.widthIn(max = 520.dp).fillMaxWidth().alpha(if (locked) 0.55f else 1f)
            .vsRow(accent, 16.dp, selected = active).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(28.dp).miniGameCardCompat(accent, locked), Alignment.Center) {
                if (cleared) {
                    com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.BADGE_CHECK, 16.dp)
                } else {
                    VsNumber("${idx + 1}", 13.sp)
                }
            }
            Text(stage.name.uppercase(), fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = if (locked) VsTeal.label else com.wordocious.app.ui.FinishInk.heading)
            Spacer(Modifier.weight(1f))
            when {
                cleared -> VsCapsLabel("CLEARED", color = vsInk(accent))
                active -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    VsCapsLabel("PLAYING", color = vsInk(accent))
                    TypingDots(dotSize = 5.dp, color = accent)
                }
                else -> Icon3D(Icon3DName.LOCK, 14.dp) // ART_SPEC §5
            }
        }
        if (!locked) {
            // The ACTIVE stage renders its full frame so you can tell how many
            // guesses are left; a CLEARED stage is over, so it compacts to the
            // rows actually used instead of towers of empty rows.
            val used = (0 until stage.boardCount).maxOfOrNull { opponent.tiles[offset + it]?.size ?: 0 } ?: 0
            val rows = if (active) stage.maxGuesses else minOf(stage.maxGuesses, maxOf(1, used))
            val boards = (0 until stage.boardCount).map { b ->
                spectatorBoard(null, opponent.tiles[offset + b].orEmpty(), wordLen, rows)
            }
            val stageTiles = (0 until stage.boardCount).associateWith { b -> opponent.tiles[offset + b].orEmpty() }
            SpectatorBoardGrid(boards, stageTiles, singleMaxWidth = 170.dp)
        }
    }
}

/** A small numbered stage chip: a 28 dp mini game card in the stage accent. */
private fun Modifier.miniGameCardCompat(accent: Color, locked: Boolean): Modifier =
    this.miniGameCard(if (locked) Color(0xFF94A3B8) else accent, 8.dp)

// ── Result (live + bot) ────────────────────────────────────────────────────────

/**
 * The live / bot result (VS polish §2) in the home palette, like the
 * challenge result: a split window (winner's half lavender; draw both pale),
 * the frosted strip with the YOU WIN! / YOU LOSE / DRAW moment art and the deciding
 * margin, each side's score, the score rule, REMATCH (solid purple), HOME and
 * SHARE (soft), the bot tally below, then the final boards.
 */
@Composable
private fun ResultScreen(vm: VSMatchViewModel, onHome: () -> Unit, onGoPro: () -> Unit) {
    // Web parity: non-Pro Rematch opens the VsLimitModal Pro upsell.
    var showRematchUpsell by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val profile by com.wordocious.app.data.AuthService.profile.collectAsState()
    val winner = vm.result?.winner
    val isWin = winner == "player"; val isDraw = winner == "draw"
    val myName = profile?.username ?: "You"
    val oppName = vm.opponentName
    // Bots read "ROOK WINS", not "ROOK · BOT WINS".
    val headName = vm.cpuPersona?.name ?: oppName
    val modeLabel = vsModeLabel(vm.mode)
    // Solve status decides most matches (solving beats score), so spell it out —
    // the loser often has "better" numbers, which reads as a mistake otherwise.
    val mySolved = vm.myStatus == GameStatus.WON
    val oppSolved = logSolved(
        (vm.result?.opponentGuessLog ?: emptyList()).map { GuessLogEntry(it.boardIndex, it.guess) },
        vm.result?.solutions ?: emptyList(),
    )
    // Forfeit-aware copy (match_ended.forfeit): the numbers don't decide a
    // forfeited match, so score-based explanations would read as a mistake.
    val isForfeit = vm.result?.forfeit == true
    val whyLine = when {
        vm.result == null -> null
        isForfeit && isWin -> "$oppName left the match — you win by forfeit"
        isForfeit && !isWin && !isDraw -> "Match forfeited — $oppName wins"
        isDraw -> "Dead even — identical scores"
        // Server timeout resolution: neither solved, board progress decided it.
        isWin -> if (mySolved && !oppSolved) "You solved it — $oppName didn’t"
        else if (mySolved && oppSolved) "Both solved — you won on score"
        else "Neither solved — you won on progress"
        else -> if (oppSolved && !mySolved) "$oppName solved it — you didn’t"
        else if (oppSolved && mySolved) "Both solved — $oppName won on score"
        else "Neither solved — $oppName won on progress"
    }
    // Moment lettering (ART_SPEC §6): YOU WIN! / YOU LOSE / DRAW; TalkBack keeps the winner's name.
    val headlineArt = when {
        isDraw -> com.wordocious.app.ui.MomentArt.DRAW
        isWin -> com.wordocious.app.ui.MomentArt.YOU_WIN
        else -> com.wordocious.app.ui.MomentArt.YOU_LOSE
    }
    val headlineLabel = when { isDraw -> "It’s a draw"; isWin -> "You win!"; else -> "You lose, $headName wins" }
    // The deciding margin (core vsMargin) — only when core's reading of the
    // numbers agrees with the server's verdict (forfeits / timeouts don't).
    val margin: String? = vm.result?.let { r ->
        if (isForfeit) return@let null
        val total = maxOf(1, vm.totalBoards)
        val me = VsRun(mySolved, if (total > 1) vm.myBoardsSolved else (if (mySolved) 1 else 0), r.playerGuesses, r.playerTime.toLong())
        val them = VsRun(oppSolved, if (total > 1) vm.opponent.boardsSolved else (if (oppSolved) 1 else 0), r.opponentGuesses, r.opponentTime.toLong())
        val expected = if (isDraw) VsOutcome.DRAW else if (isWin) VsOutcome.WIN else VsOutcome.LOSS
        if (vsOutcome(me, them) == expected) vsMargin(me, them) else null
    }
    val subLine = margin ?: whyLine?.uppercase()
    val leftBg = if (isDraw) VsPurple.draw else if (isWin) VsPurple.won else VsPurple.plain
    val rightBg = if (isDraw) VsPurple.draw else if (!isWin) VsPurple.won else VsPurple.plain

    Column(Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true)) {
        ResultTopBar(onHome)
        LazyColumn(
            Modifier.fillMaxSize().navigationBarsPadding().padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // The window (A1: a tinted card in the results' purple with its top bar).
            item {
                // D3: a bot stands on the window in character — its "victory" pose when it
                // won, "goodgame" when you won or drew. People keep the result hosts
                // (MASCOT_SPEC §3): S pops on a win, R stands still on a loss, U on a draw.
                val botId = vm.cpuPersona?.artId?.takeIf { vm.isCpu && it != com.wordocious.core.BotCast.GHOST_ID }
                Box(Modifier.widthIn(max = 520.dp).fillMaxWidth().padding(top = com.wordocious.app.ui.BANNER_HOST_PEEK + if (botId != null) 18.dp else 0.dp)) {
                    VsTintedCard(
                        Modifier.widthIn(max = 520.dp).fillMaxWidth()
                            .then(if (isWin && !WTheme.reducedMotion) Modifier.clip(RoundedCornerShape(18.dp)).bannerShimmer() else Modifier),
                        accent = VS_RESULT_ACCENT, corner = 18.dp, barHeight = 10.dp,
                        barColor = if (isWin) VS_RESULT_ACCENT else if (isDraw) Color(0xFF94A3B8) else Color(0xFF64748B),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp), verticalArrangement = Arrangement.spacedBy(0.dp),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().background(vsWash(VS_RESULT_ACCENT, 0.20f)).padding(start = 12.dp, top = 10.dp, end = 12.dp, bottom = 10.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            com.wordocious.app.ui.MomentTitle(
                                headlineArt, Modifier.padding(end = com.wordocious.app.ui.BANNER_HOST_CLEAR + if (botId != null) 26.dp else (-4).dp),
                                widthFraction = 0.8f, maxHeight = 60.dp, contentDescription = headlineLabel,
                                alignment = Alignment.CenterStart,
                            )
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Box(Modifier.size(18.dp), Alignment.Center) { com.wordocious.app.ui.ModeGlyph(vm.mode, modeAccent(vm.mode), 18.dp) }
                                Text(
                                    listOfNotNull(vsModeName(vm.mode).uppercase(), subLine).joinToString(" · "),
                                    fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = VsPurple.mid,
                                )
                            }
                        }
                        vm.result?.let { r ->
                            Row(Modifier.fillMaxWidth().padding(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ResultSide(myName, r.playerScore, r.playerGuesses, r.playerTime, mySolved, isWin && !isDraw, Modifier.weight(1f))
                                ResultSide(oppName, r.opponentScore, r.opponentGuesses, r.opponentTime, oppSolved, !isWin && !isDraw, Modifier.weight(1f))
                            }
                        }
                    }
                    if (botId != null) {
                        VsBotPose(
                            botId, if (!isWin && !isDraw) "victory" else "goodgame", 92.dp,
                            Modifier.align(Alignment.TopEnd).offset(x = 4.dp, y = -(com.wordocious.app.ui.BANNER_HOST_PEEK + 18.dp)),
                        )
                    } else {
                        com.wordocious.app.ui.Mascot(
                            if (isDraw) com.wordocious.app.ui.Mascots.vsDraw else if (isWin) com.wordocious.app.ui.Mascots.vsWin else com.wordocious.app.ui.Mascots.vsLoss,
                            56.dp,
                            Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = -com.wordocious.app.ui.BANNER_HOST_PEEK),
                            motion = if (isWin && !isDraw) com.wordocious.app.ui.MascotMotion.POP else com.wordocious.app.ui.MascotMotion.NONE,
                        )
                    }
                }
            }
            // D3: the bot's last word (its win / good-game line), in its bubble.
            vm.endBanter?.let { line ->
                vm.cpuCastId?.let { castId ->
                    item {
                        Box(Modifier.widthIn(max = 520.dp).fillMaxWidth(), Alignment.CenterEnd) {
                            VsBanterBubble(line, BotPersonas.name(castId), vsBotColor(castId))
                        }
                    }
                }
            }
            item {
                Text(
                    "Score = guesses + time (1 pt per 45 s) · lowest wins — solving always beats not solving",
                    fontSize = 10.sp, fontWeight = FontWeight.Bold, color = VsTeal.label, textAlign = TextAlign.Center,
                    modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth(),
                )
            }
            // Updated all-time head-to-head (refetched ~1.2s after the match was recorded).
            if (vm.opponentUserId != null && !vm.isCpu) {
                vm.headToHead?.let { h2h ->
                    item {
                        Text(
                            com.wordocious.app.data.HeadToHeadService.headToHeadLine(oppName, h2h),
                            fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = VsPurple.deep, textAlign = TextAlign.Center,
                            modifier = Modifier.vsPill(VS_RESULT_ACCENT, 12.dp).padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 5.dp),
                        )
                    }
                }
            }
            // CPU practice flourish: photo finish + streak / milestone / cosmetic.
            if (vm.isCpu && (vm.photoFinish != null || vm.cpuMilestone != null || vm.cpuStreak > 0 || vm.cpuUnlock != null || vm.ladderJustCleared)) {
                item {
                    // A1: the streak / milestone / unlock lines sit on a gold-tinted card.
                    VsTintedCard(
                        Modifier.widthIn(max = 520.dp).fillMaxWidth(), accent = VS_GOLD_ACCENT, corner = 16.dp, barHeight = 6.dp,
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                    ) {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        vm.photoFinish?.let { pf -> PhotoFinishStamp(pf == "clutch") }
                        vm.cpuMilestone?.let { m ->
                            // Streak milestone: the STREAK! moment lettering (ART_SPEC §6) over the count.
                            Column(
                                Modifier.semantics(mergeDescendants = true) { },
                                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
                            ) {
                                com.wordocious.app.ui.MomentTitle(com.wordocious.app.ui.MomentArt.STREAK, widthFraction = 0.5f, maxHeight = 48.dp)
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.FLAME, 18.dp)
                                    VsNumber("$m", 20.sp)
                                    Text("-win bot streak", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFFC2410C))
                                }
                            }
                        }
                            ?: run {
                                if (vm.cpuStreak > 0) Row(
                                    Modifier.semantics(mergeDescendants = true) { },
                                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.FLAME, 16.dp)
                                    Text("Bot win streak", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF92400E))
                                    VsNumber("${vm.cpuStreak}", 16.sp)
                                }
                            }
                        vm.cpuUnlock?.let {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                androidx.compose.foundation.Image(
                                    androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.art_medal_trophy), contentDescription = null,
                                    modifier = Modifier.size(22.dp).clearAndSetSemantics { },
                                )
                                Text("Unlocked ${vm.cpuPersona?.name ?: "the bot"}’s badge!", fontSize = 12.sp, fontWeight = FontWeight.Black, color = vsInk(Color(vm.cpuPersona?.color ?: 0xFFEF4444)))
                            }
                        }
                        // The whole ladder, cleared (all ten rungs): the celebration art.
                        if (vm.ladderJustCleared) {
                            androidx.compose.foundation.Image(
                                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.art_scene_ladder_cleared), contentDescription = null,
                                modifier = Modifier.size(150.dp).clearAndSetSemantics { },
                            )
                            Text(
                                "LADDER CLEARED! You beat all ten bots.", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF78350F),
                                textAlign = TextAlign.Center, modifier = Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
                            )
                        }
                    }
                    }
                }
            }
            if (vm.rematch == RematchState.RECEIVED) {
                item {
                    // K1: the rematch offer as a notice — pink, the sender's tile, S ready.
                    VsNoticeCard(
                        accent = Color(0xFFEC4899),
                        label = "$headName wants a rematch",
                        onClick = null,
                        modifier = Modifier.widthIn(max = 520.dp),
                        avatar = { VsAvatar(oppName, vm.opponentInfo?.avatarUrl, size = 38.dp, borderColor = Color.Transparent, userId = vm.opponentInfo?.id) },
                        pose = vsSpareCast(vsBotMascot(vm.cpuCastId), preferred = listOf(com.wordocious.app.ui.MascotId.S, com.wordocious.app.ui.MascotId.O1)) to "ready",
                    ) {
                        Text("${headName.uppercase()} WANTS A REMATCH", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsPurple.deep)
                        Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            SoftPurpleButton("DECLINE", Modifier.weight(1f)) { vm.declineRematch() }
                            PurpleButton("ACCEPT", modifier = Modifier.weight(1f)) { vm.acceptRematch() }
                        }
                    }
                }
            }
            // Actions — REMATCH (solid purple) on top, HOME / SHARE (soft) below.
            item {
                Column(Modifier.widthIn(max = 520.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (vm.rematch) {
                        RematchState.DECLINED -> SoftPurpleButton("NO REMATCH", enabled = false) {}
                        RematchState.OFFERED -> PurpleButton("WAITING…", enabled = false) {}
                        RematchState.RECEIVED -> {}
                        RematchState.IDLE -> PurpleButton(if (vm.isCpu) "PLAY AGAIN" else "REMATCH") {
                            if (vm.isPro) vm.offerRematch() else showRematchUpsell = true
                        }
                    }
                    // A8: Home is a round candy icon; SHARE the pink secondary.
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        com.wordocious.app.ui.CandyRoundButton(
                            "Home", onClick = { onHome() }, color = com.wordocious.app.ui.CandyColor.PEACH, diameter = 44.dp,
                        ) { com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TAB_HOME, 24.dp) }
                        com.wordocious.app.ui.CandyButton("SHARE", modifier = Modifier.weight(1f), color = com.wordocious.app.ui.CandyColor.PINK, size = com.wordocious.app.ui.CandySize.MEDIUM, icon = com.wordocious.app.ui.CandyIcon.SHARE, fill = true, onClick = {
                            // S4 copy; S1: the card goes out as the image only — this text is
                            // only the fallback when no image can be written.
                            val text = com.wordocious.app.data.ShareHelper.vsResultText(isWin, isDraw, oppName, vsModeName(vm.mode))
                            val payload = "$text\nwordocious.com"
                            // Render the VS share card (same aesthetic as the daily cards);
                            // text-only fallback when there's no result payload.
                            val r = vm.result
                            com.wordocious.app.data.ShareEvents.log(
                                kind = if (r != null) "image" else "text",
                                gameMode = vm.mode.name.lowercase(),
                                surface = "vs_result",
                            )
                            if (r != null) {
                                val solutions = r.solutions ?: emptyList()
                                val myLog = vm.game?.state?.value?.boards.orEmpty().flatMapIndexed { i, b ->
                                    b.guesses.map { GuessLogEntry(i, it) }
                                }
                                val oppLog = (r.opponentGuessLog ?: emptyList()).map { GuessLogEntry(it.boardIndex, it.guess) }
                                val bmp = com.wordocious.app.data.ShareImage.renderVs(
                                    context, "VS $modeLabel", com.wordocious.app.data.ShareImage.accentFor(vm.mode),
                                    isWin = isWin, isDraw = isDraw,
                                    me = com.wordocious.app.data.ShareImage.VsShareSide(
                                        myName, r.playerScore, isWin, mySolved, logToGrids(myLog, solutions),
                                        userId = com.wordocious.app.data.AuthService.userId,
                                        username = com.wordocious.app.data.AuthService.profile.value?.username),
                                    opp = com.wordocious.app.data.ShareImage.VsShareSide(
                                        oppName, r.opponentScore, !isWin && !isDraw, oppSolved, logToGrids(oppLog, solutions),
                                        userId = vm.opponentInfo?.id, avatarUrl = vm.opponentInfo?.avatarUrl,
                                        username = vm.race?.challenger?.username ?: vm.opponentInfo?.username),
                                    modeKey = vm.mode.name,
                                )
                                com.wordocious.app.data.ShareImage.shareVs(context, bmp, payload)
                            } else {
                                com.wordocious.app.data.ShareHelper.share(context, payload)
                            }
                        })
                    }
                }
            }
            // Session tally + the bots-record note sit BELOW the window.
            if (vm.isCpu) {
                item {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        if (vm.cpuSessionWins + vm.cpuSessionLosses > 0) {
                            Row(
                                Modifier.vsPill(VS_ACCENT, 12.dp).padding(start = 10.dp, end = 10.dp, top = 7.dp, bottom = 4.dp)
                                    .semantics(mergeDescendants = true) { contentDescription = "This session: you ${vm.cpuSessionWins}, bots ${vm.cpuSessionLosses}" },
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                VsCapsLabel("THIS SESSION · YOU", color = VsTeal.ink)
                                VsNumber("${vm.cpuSessionWins}", 14.sp)
                                VsCapsLabel("· BOTS", color = VsTeal.ink)
                                VsNumber("${vm.cpuSessionLosses}", 14.sp)
                            }
                        }
                        Text("Bot game — counts in your Bots record, not People", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = VsTeal.label)
                    }
                }
            }
            // Final boards with letters — opponent's reconstructed from the
            // match-end guess log + solutions; mine from local play.
            val solutions = vm.result?.solutions ?: emptyList()
            if (solutions.isNotEmpty()) {
                item {
                    val myLog = vm.game?.state?.value?.boards.orEmpty().flatMapIndexed { i, b ->
                        b.guesses.map { GuessLogEntry(i, it) }
                    }
                    val oppLog = (vm.result?.opponentGuessLog ?: emptyList()).map { GuessLogEntry(it.boardIndex, it.guess) }
                    Box(Modifier.widthIn(max = 520.dp).padding(top = 4.dp)) {
                        FinalBoards(
                            myName = myName, opponentName = oppName,
                            myGuessLog = myLog, opponentGuessLog = oppLog, solutions = solutions,
                            mode = vm.mode, seed = vm.seed,
                            // Submission-ordered flat log — the per-board myLog above
                            // duplicates shared guesses on applyToAll modes, which
                            // would corrupt the engine replay.
                            myWords = vm.myGuessLog.toList(),
                            myTimeMs = (vm.result?.playerTime ?: 0.0).toInt(),
                            opponentTimeMs = (vm.result?.opponentTime ?: 0.0).toInt(),
                            answerDisplay = vm.puzzleDisplay,
                            // My ACTUAL final board state (match_ended snapshot) —
                            // keeps Six/Seven/PN hint rows in the recap.
                            myFinalBoards = vm.myFinalBoards,
                        )
                    }
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
    // Confetti for wins only (web Confetti / VictoryOverlay parity).
    if (isWin && !WTheme.reducedMotion) VsConfetti()
    if (showRematchUpsell) {
        VSLimitUpsellModal(onGoPro = onGoPro, onClose = { showRematchUpsell = false }, exclude = vsBotMascot(vm.cpuCastId))
    }
    // Free tier received a rematch offer — it was auto-declined in the VM
    // (non-Pro can't accept, and the opponent must not hang on "Waiting…");
    // iOS parity: surface the same Pro-limit modal instead of an inline card.
    if (vm.rematchProUpsell) {
        VSLimitUpsellModal(onGoPro = onGoPro, onClose = { vm.rematchProUpsell = false }, exclude = vsBotMascot(vm.cpuCastId))
    }
}

/** One side of the result window: name, the score in big numerals, the exact
 *  calculation, time, and a Solved (purple) / Not solved (slate) chip. */
@Composable
private fun ResultSide(name: String, score: Double, guesses: Int, timeMs: Double, solved: Boolean, winner: Boolean, modifier: Modifier) {
    val penalty = kotlin.math.max(0.0, score - guesses)
    val secs = kotlin.math.round(timeMs / 1000).toInt()   // iOS rounds, not truncates
    // A1 / A2: each side is a tinted stat tile (the winner's stronger, with a ring), the score soft.
    Column(
        modifier.vsRow(if (winner) VS_RESULT_ACCENT else Color(0xFF94A3B8), 14.dp, selected = winner).padding(horizontal = 6.dp, vertical = 10.dp)
            .semantics(mergeDescendants = true) { },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (winner) com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TROPHY, 16.dp)
            Text(name.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = VsPurple.deep, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        VsNumber(String.format(Locale.US, "%.2f", score), 32.sp)
        Text(
            "$guesses ${if (guesses == 1) "guess" else "guesses"} + ${String.format(Locale.US, "%.2f", penalty)} time",
            fontSize = 10.sp, fontWeight = FontWeight.Bold, color = VsPurple.mid, textAlign = TextAlign.Center,
        )
        VsNumber("${secs / 60}:${"%02d".format(secs % 60)}", 13.sp)
        Text(
            if (solved) "SOLVED" else "NOT SOLVED",
            fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
            color = if (solved) VsPurple.deep else Color(0xFF475569),
            modifier = Modifier.vsPill(if (solved) VS_RESULT_ACCENT else Color(0xFF64748B), 50.dp, amount = if (solved) 0.2f else 0.12f)
                .padding(start = 10.dp, end = 10.dp, top = 6.dp, bottom = 3.dp),
        )
    }
}

// ── Notices ────────────────────────────────────────────────────────────────────

/** A one-card notice on the VS page (opponent left, match gone, not configured). */
@Composable
private fun VsNoticeScreen(
    icon: @Composable () -> Unit,
    title: String,
    body: String?,
    button: String,
    onButton: () -> Unit,
    /** A cast pose that fits the notice (A7: never the page host twice). */
    pose: Pair<com.wordocious.app.ui.MascotId, String>? = null,
) {
    Box(
        Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true).statusBarsPadding().navigationBarsPadding().padding(horizontal = 24.dp),
        Alignment.Center,
    ) {
        VsTintedCard(Modifier.widthIn(max = 420.dp).fillMaxWidth(), corner = 20.dp, contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp)) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (pose != null) VsCastPose(pose.first, pose.second, 110.dp)
                else VsIconSquare { icon() }
                Text(
                    title, fontSize = 17.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsTeal.deep, textAlign = TextAlign.Center,
                    modifier = Modifier.semantics { heading() },
                )
                body?.let { Text(it, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center) }
                CandyButtonFill(button, onButton, color = com.wordocious.app.ui.CandyColor.TEAL)
            }
        }
    }
}

@Composable
private fun AlreadyPlayedDaily(answer: String, isPro: Boolean, won: Boolean?, onHome: () -> Unit, onGoPro: () -> Unit, onPlayUnlimited: () -> Unit) {
    Column(Modifier.fillMaxSize().pageBackground(PageTint.VS, alwaysLight = true)) {
        VsNavBar("DAILY BATTLE", onBack = onHome)
        Column(
            Modifier.fillMaxSize().navigationBarsPadding().padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        ) {
            Column(Modifier.widthIn(max = 520.dp).fillMaxWidth().vsTealWindow()) {
                Column(
                    Modifier.fillMaxWidth().padding(top = 10.dp).background(vsWash(VS_ACCENT, 0.20f))
                        .padding(start = 14.dp, top = 10.dp, end = 12.dp, bottom = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    // BJ16: the ALREADY PLAYED lettering, not plain text.
                    com.wordocious.app.ui.HeadingArt(com.wordocious.app.ui.Heading.ALREADYPLAYED, height = 28.dp, maxWidth = 220.dp, alignment = Alignment.CenterStart)
                    // Live "next daily VS" countdown (web parity — getSecondsUntilMidnight), soft (A2).
                    var cdTick by remember { mutableStateOf(0) }
                    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); cdTick++ } }
                    @Suppress("UNUSED_EXPRESSION") cdTick
                    val s = vsSecondsUntilLocalMidnight()
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        VsCapsLabel("TODAY’S VS PUZZLE · NEXT IN", color = VsTeal.ink, fontSize = 10.sp)
                        VsNumber("%02d:%02d:%02d".format(s / 3600, (s % 3600) / 60, s % 60), 13.sp)
                    }
                }
                Column(
                    Modifier.fillMaxWidth().padding(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Today's daily VS outcome — W/L pill (the user asked for an explicit result here).
                    // Played today: U waiting for tomorrow (a cast pose, G5).
                    VsCastPose(com.wordocious.app.ui.MascotId.U, "waiting", 110.dp)
                    // Moment lettering (ART_SPEC §6): YOU WIN! / YOU LOSE.
                    won?.let {
                        com.wordocious.app.ui.MomentTitle(
                            if (it) com.wordocious.app.ui.MomentArt.YOU_WIN else com.wordocious.app.ui.MomentArt.YOU_LOSE,
                            widthFraction = 0.6f, maxHeight = 28.dp,
                        )
                    }
                    if (answer.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            answer.uppercase().forEach { ch ->
                                // The game kit's purple tile (B1): gradient face, darker lip.
                                Box(
                                    Modifier.size(40.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFF4C1D95))
                                        .padding(bottom = 3.dp).clip(RoundedCornerShape(8.dp))
                                        .background(Brush.verticalGradient(listOf(Color(0xFFA66BFF), VsPurple.ink))),
                                    Alignment.Center,
                                ) {
                                    Text(ch.toString(), fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White)
                                }
                            }
                        }
                    }
                    Text(
                        if (isPro) "Want more? Jump into unlimited VS battles with fresh puzzles."
                        else "Upgrade to Pro for unlimited VS matches, rematches, and ad-free battles.",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center,
                    )
                }
            }
            Column(Modifier.widthIn(max = 520.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Pro: route to the VS lobby for unlimited (any-mode) battles (web parity).
                if (isPro) CandyButtonFill("PLAY UNLIMITED VS", onPlayUnlimited, color = com.wordocious.app.ui.CandyColor.TEAL, icon = com.wordocious.app.ui.CandyIcon.PLAY)
                else CandyButtonFill("UPGRADE TO PRO", onGoPro, color = com.wordocious.app.ui.CandyColor.AMBER)
                VsSoftPill("HOME", Modifier.align(Alignment.CenterHorizontally), color = com.wordocious.app.ui.CandyColor.PEACH) { onHome() }
            }
        }
    }
}

/** Seconds until the next LOCAL midnight (daily VS resets locally). */
private fun vsSecondsUntilLocalMidnight(): Long {
    val cal = java.util.Calendar.getInstance()
    val now = cal.timeInMillis
    cal.add(java.util.Calendar.DAY_OF_YEAR, 1)
    cal.set(java.util.Calendar.HOUR_OF_DAY, 0); cal.set(java.util.Calendar.MINUTE, 0)
    cal.set(java.util.Calendar.SECOND, 0); cal.set(java.util.Calendar.MILLISECOND, 0)
    return ((cal.timeInMillis - now) / 1000).coerceAtLeast(0)
}

/**
 * VS Pro-upsell modal — ports web vs-limit-modal.tsx (shown on non-Pro Rematch).
 * G5 / FINISH_SPEC D3: the gold-tinted card family with its top bar, a waiting cast
 * pose (A7: not the bot on screen), the reset clock soft, Go Pro = the large amber
 * candy, Maybe later = peach.
 */
@Composable
private fun VSLimitUpsellModal(onGoPro: () -> Unit, onClose: () -> Unit, exclude: com.wordocious.app.ui.MascotId? = null) {
    VsLimitWindow(
        title = "DAILY VS USED",
        body = "You've played your free daily VS match for today. Upgrade to Pro for unlimited ad-free battles and rematches, or come back tomorrow.",
        secondsUntilReset = ::vsSecondsUntilLocalMidnight,
        onGoPro = onGoPro, onClose = onClose,
        pose = vsSpareCast(exclude, com.wordocious.app.ui.Mascots.vsWin, com.wordocious.app.ui.Mascots.vsLoss) to "waiting",
    )
}
