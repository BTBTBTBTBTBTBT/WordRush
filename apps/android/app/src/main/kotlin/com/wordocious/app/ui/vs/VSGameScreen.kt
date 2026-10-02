package com.wordocious.app.ui.vs

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
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Lock
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
import com.wordocious.app.ui.clickableNoRipple
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

/** Soft grey for the small LEAVE / CANCEL pills (VS polish §2). */
private val VsSoftGrey = Color(0xFFF1F5F9)

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
    val pageBg = if (vm.screen == VSScreen.MATCH) Brush.verticalGradient(listOf(WTheme.bg, WTheme.surfaceHover))
    else Brush.verticalGradient(listOf(VsTeal.page, VsTeal.page))
    Box(Modifier.fillMaxSize().background(pageBg), contentAlignment = Alignment.Center) {
        when (vm.screen) {
            VSScreen.NOT_CONFIGURED -> VsNoticeScreen(
                icon = { Icon(painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = VsTeal.ink, modifier = Modifier.size(24.dp)) },
                title = "VS IS ALMOST READY",
                body = "Real-time matches turn on once the multiplayer server is connected.",
                button = "BACK", onButton = ::goHome,
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
            )
            // Zombie-match recovery — the server dropped the match while the app
            // was backgrounded past the reconnect grace. Nothing was recorded (no
            // spurious loss); just a clean explanation + Home.
            VSScreen.MATCH_GONE -> VsNoticeScreen(
                icon = { Icon(Icons.Filled.TimerOff, null, tint = VsTeal.ink, modifier = Modifier.size(24.dp)) },
                title = "MATCH ENDED WHILE YOU WERE AWAY",
                body = vm.message ?: "The server couldn’t hold the match open that long.",
                button = "HOME", onButton = ::goHome,
            )
            VSScreen.ALREADY_PLAYED_DAILY -> AlreadyPlayedDaily(vm.dailyAnswer, vm.isPro, vm.dailyWon, ::goHome, onGoPro, onPlayUnlimited)
        }

        // Opponent-disconnected grace banner — pinned to the top over the live
        // match / waiting screens: counts down the server's reconnect window
        // (cleared by opponent_reconnected / match_ended).
        vm.opponentDisconnectedSeconds?.let { secs ->
            if (vm.screen == VSScreen.MATCH || vm.screen == VSScreen.WAITING) {
                Box(Modifier.fillMaxSize().statusBarsPadding().padding(top = 8.dp), Alignment.TopCenter) {
                    Row(
                        Modifier.padding(horizontal = 24.dp).clip(RoundedCornerShape(12.dp))
                            .background(Color(0xEBDC2626))
                            .padding(horizontal = 14.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(Icons.Filled.WifiOff, null, tint = Color.White, modifier = Modifier.size(14.dp))
                        Text(
                            "${vm.opponentName} disconnected — you win by forfeit in ${secs}s unless they return",
                            fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White,
                            textAlign = TextAlign.Center,
                        )
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
                ),
                opponent = vm.opponentUserId?.let {
                    IntroPlayer(
                        username = vm.opponentInfo?.displayName ?: "…",
                        avatarUrl = vm.opponentInfo?.avatarUrl,
                        level = vm.opponentInfo?.level,
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
        Modifier.fillMaxSize().background(VsTeal.page).statusBarsPadding().navigationBarsPadding().padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
    ) {
        Box(Modifier.vsCard(16.dp)) { VsModeTile(mode, 56.dp) }
        // The cast's staggered wave replaces the spinner (MASCOT_SPEC §3); the label stays.
        com.wordocious.app.ui.CastRow(22.dp, motion = com.wordocious.app.ui.MascotMotion.WAVE)
        Text(
            "LOADING ${vsModeName(mode).uppercase()}",
            fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = VsTeal.label,
        )
        if (sub != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (botArtId != null) BotAvatar(botArtId, 28.dp)
                Text(sub, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center)
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
        Column(Modifier.fillMaxSize().background(VsTeal.page)) {
            VsNavBar("PRIVATE MATCH", onBack = onHome) { VsModeChip(vm.mode) }
            Column(
                Modifier.fillMaxSize().navigationBarsPadding().padding(horizontal = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            ) {
                Column(
                    Modifier.widthIn(max = 380.dp).fillMaxWidth().vsCard(14.dp).padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    VsSectionLabel("YOUR INVITE CODE")
                    Text(inviteCode, fontSize = 30.sp, fontWeight = FontWeight.Black, letterSpacing = 6.sp, color = VsTeal.deep)
                    Text(
                        "Share this code — the match starts when your friend joins.",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center,
                    )
                    VsTealButton("SHARE INVITE", Modifier.fillMaxWidth()) {
                        com.wordocious.app.data.ShareEvents.log("link_invite", vm.mode.name.lowercase(), "vs_lobby")
                        com.wordocious.app.data.ShareHelper.share(context, "Join my Wordocious VS match — code $inviteCode\nhttps://wordocious.com/vs/join/$inviteCode")
                    }
                }
                CircularProgressIndicator(color = VsTeal.ink, trackColor = VsTeal.soft, strokeWidth = 4.dp, modifier = Modifier.size(36.dp))
                Text("WAITING FOR YOUR FRIEND · #${position + 1}", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = VsTeal.label)
                VsSoftPill("CANCEL", bg = VsSoftGrey, ink = VsTeal.label) { onHome() }
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
    var shown by remember { mutableStateOf(false) }
    val scale by androidx.compose.animation.core.animateFloatAsState(
        targetValue = if (shown) 1f else 0.3f,
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
            Text(
                title ?: if (isRematch) "REMATCH STARTING IN" else "MATCH FOUND",
                fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 2.4.sp, color = VsTeal.label,
            )
            VsModeChip(mode)
            Box(Modifier.size(170.dp), Alignment.Center) {
                // A ring pulses out from behind each tick, so the number bursts
                // instead of just swapping (iOS parity).
                CountdownRing(count, accent)
                Box(
                    Modifier.size(132.dp)
                        .shadow(8.dp, CircleShape, ambientColor = accent.copy(alpha = 0.35f), spotColor = accent.copy(alpha = 0.35f))
                        .clip(CircleShape).background(Color.White),
                    Alignment.Center,
                ) {
                    Text(
                        if (count == 0) "GO!" else "$count",
                        fontSize = if (count == 0) 52.sp else 80.sp, fontWeight = FontWeight.Black, color = accent,
                    )
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
    val letterStates = if (isSequential)
        computeCombinedLetterStates(listOf(state.boards[game.activeBoardIndex]))
    else computeCombinedLetterStates(state.boards)
    val perBoardStates = if (useQuadrant) computePerBoardLetterStates(state.boards) else null
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
                GauntletStepper(current = state.gauntlet?.currentStage ?: 0, total = state.gauntlet?.totalStages ?: 5)
                Spacer(Modifier.height(6.dp))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val stageName = state.gauntlet?.let { it.stages.getOrNull(it.currentStage)?.name }
                VsSoloTitle(vm.mode, stageName, Modifier.weight(1f, fill = false))
                VsPill()
            }
            Spacer(Modifier.height(2.dp))
            VsStatRow(vm, game, state)
            // ProperNoundle VS: the Wikipedia clue (italic, centered) once revealed.
            if (vm.mode == GameMode.PROPERNOUNDLE) {
                val clueText by game.clue.collectAsState()
                clueText?.let {
                    Text(
                        it, color = WTheme.textSecondary, fontSize = 12.sp,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
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
            vm.callout?.let { text ->
                Box(Modifier.fillMaxWidth().padding(top = 6.dp), Alignment.TopCenter) { VsCalloutPill(text) }
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
    if (vm.mode == GameMode.GAUNTLET && gauntlet != null &&
        state.status == GameStatus.PLAYING && state.boards.isNotEmpty() &&
        state.boards.all { it.status == GameStatus.WON }
    ) {
        StageTransitionOverlay(
            isVersus = true,
            completed = gauntlet.stages[gauntlet.currentStage],
            next = gauntlet.stages.getOrNull(gauntlet.currentStage + 1),
        ) { game.advanceGauntletStage() }
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
            text = stageName ?: modeTitle(mode); base = 18.sp
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
        when {
            isGauntlet -> {
                if (state.boards.size > 1) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFD97706), modifier = Modifier.size(statIcon))
                        Spacer(Modifier.width(3.dp))
                        Text("$solved/${state.boards.size}", color = WTheme.textMuted, fontSize = statSp, fontWeight = FontWeight.Bold)
                    }
                }
                Text("$used/$max guesses", color = WTheme.textMuted, fontSize = statSp, fontWeight = FontWeight.Bold)
            }
            state.boards.size > 1 -> Text(
                "$solved/${state.boards.size} solved · $used/$max guesses",
                color = WTheme.textMuted, fontSize = statSp, fontWeight = FontWeight.Bold,
            )
            else -> Text("$used/$max guesses", color = WTheme.textMuted, fontSize = statSp, fontWeight = FontWeight.Bold)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Schedule, null, tint = Color(0xFF60A5FA), modifier = Modifier.size(statIcon))
            Spacer(Modifier.width(3.dp))
            VsMatchClock(vm, statSp)
        }
    }
}

/** m:ss since match start — the only thing that recomposes every second. */
@Composable
private fun VsMatchClock(vm: VSMatchViewModel, size: TextUnit, color: Color = WTheme.textMuted) {
    var tick by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); tick++ } }
    @Suppress("UNUSED_EXPRESSION") tick
    val secs = vm.matchElapsedSeconds
    Text("${secs / 60}:${"%02d".format(secs % 60)}", color = color, fontSize = size, fontWeight = FontWeight.Bold)
}

/** Soft confirm card (VS polish §2): caps title, purple primary, soft secondary. */
@Composable
private fun VsConfirmDialog(title: String, body: String, confirm: String, dismiss: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().vsCard(18.dp).padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsPurple.deep, textAlign = TextAlign.Center)
            Text(body, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center)
            PurpleButton(confirm, onClick = onConfirm)
            SoftPurpleButton(dismiss, onClick = onDismiss)
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
        Modifier.fillMaxSize().background(VsTeal.page).statusBarsPadding().navigationBarsPadding().padding(horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { Spacer(Modifier.height(4.dp)) }
        // The one-window card.
        item {
            Column(Modifier.widthIn(max = 520.dp).fillMaxWidth().vsTealWindow()) {
                Column(
                    Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f))
                        .padding(start = 14.dp, top = 12.dp, end = 12.dp, bottom = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        "${headName.uppercase()} IS STILL PLAYING", fontSize = 16.sp, fontWeight = FontWeight.Black,
                        letterSpacing = 0.4.sp, color = VsTeal.deep, maxLines = 2,
                    )
                    Text(stakes, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.2.sp, color = VsTeal.ink)
                }
                Row(
                    Modifier.fillMaxWidth().padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Breathing "live" ring signals an active opponent while you wait.
                    Box(contentAlignment = Alignment.Center) {
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
                            Box(
                                Modifier.size(52.dp)
                                    .graphicsLayer { scaleX = s; scaleY = s; alpha = a }
                                    .border(2.dp, VsTeal.ink, CircleShape),
                            )
                        }
                        VsAvatar(oppName, vm.opponentInfo?.avatarUrl, size = 48.dp, borderColor = Color.Transparent)
                    }
                    Column(Modifier.weight(1f)) {
                        Text(oppName, fontSize = 14.sp, fontWeight = FontWeight.Black, color = VsTeal.deep, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        val attempts = vm.opponent.attempts
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "$attempts ${if (attempts == 1) "guess" else "guesses"} · ",
                                fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub,
                            )
                            VsMatchClock(vm, 11.5.sp, VsTeal.sub)
                            if (liveTotalBoards > 1) {
                                Text(
                                    " · ${vm.opponent.boardsSolved}/$liveTotalBoards boards",
                                    fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub,
                                )
                            }
                        }
                    }
                    if (vm.opponentTyping) TypingDots(dotSize = 6.dp, color = VsTeal.ink)
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
                    Modifier.widthIn(max = 520.dp).fillMaxWidth().vsCard(14.dp).padding(14.dp),
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
            Column(
                Modifier.widthIn(max = 520.dp).fillMaxWidth().vsCard(14.dp).padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                VsSectionLabel("YOUR RESULT")
                Row(Modifier.fillMaxWidth()) {
                    ResultStat("$myGuesses", "GUESSES", Modifier.weight(1f))
                    ResultStat(com.wordocious.core.vsClock(vm.playerTimeMs.toLong()), "TIME", Modifier.weight(1f))
                    ResultStat(solvedLine, if (vm.totalBoards > 1) "BOARDS" else "RESULT", Modifier.weight(1f))
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
                Row(
                    Modifier.widthIn(max = 520.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(VsTeal.soft)
                        .clickableNoRipple {
                            skipHaptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                            vm.finishCpuNow()
                        }
                        .padding(vertical = 13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                ) {
                    Icon(
                        if (winLocked) Icons.Filled.SportsScore else Icons.Filled.FastForward,
                        null, tint = VsTeal.ink, modifier = Modifier.size(18.dp),
                    )
                    Text(
                        if (winLocked) "CLAIM YOUR WIN" else "SKIP TO RESULT",
                        fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.ink,
                    )
                }
            }
        }
        item { VsSoftPill("LEAVE", bg = VsSoftGrey, ink = VsTeal.label) { onHome() } }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun ResultStat(value: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = VsTeal.deep, maxLines = 1)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = VsTeal.label)
    }
}

/** The teal one-window look (VS banner): gradient, gloss, soft shadow, r16. */
private fun Modifier.vsTealWindow(): Modifier =
    this.shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x144C1D95), spotColor = Color(0x144C1D95))
        .clip(RoundedCornerShape(16.dp))
        .drawBehind {
            drawRect(Brush.verticalGradient(listOf(Color(0xFFD5F5EE), Color(0xFFE0F2FE))))
            drawRect(Brush.linearGradient(
                0f to Color.White.copy(alpha = 0.35f), 0.55f to Color.White.copy(alpha = 0f),
                start = Offset.Zero, end = Offset(size.width, size.height),
            ))
        }

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
        Box(Modifier.widthIn(max = singleMaxWidth).fillMaxWidth().aspectRatio(ratio(b, rows.size))) {
            MiniBoardView(board = b, stateRows = rows, modifier = Modifier.fillMaxSize())
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
                    Box(Modifier.weight(1f).aspectRatio(ratio(boards[i], rows.size))) {
                        MiniBoardView(board = boards[i], stateRows = rows, modifier = Modifier.fillMaxSize())
                    }
                }
                repeat(cols - rowIdx.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
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
            .vsCard(14.dp).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(26.dp).clip(CircleShape).background(accent.copy(alpha = if (locked) 0.10f else 0.18f)), Alignment.Center) {
                if (cleared) {
                    Icon(Icons.Filled.Check, null, tint = accent, modifier = Modifier.size(12.dp))
                } else {
                    Text("${idx + 1}", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (locked) VsTeal.label else accent)
                }
            }
            Text(stage.name.uppercase(), fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = if (locked) VsTeal.label else VsTeal.deep)
            Spacer(Modifier.weight(1f))
            when {
                cleared -> Text("CLEARED", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.ink)
                active -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("PLAYING", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.ink)
                    TypingDots(dotSize = 5.dp, color = VsTeal.ink)
                }
                else -> Icon(Icons.Filled.Lock, null, tint = VsTeal.label, modifier = Modifier.size(12.dp))
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

// ── Result (live + bot) ────────────────────────────────────────────────────────

/**
 * The live / bot result (VS polish §2) in the home palette, like the
 * challenge result: a split window (winner's half lavender; draw both pale),
 * the frosted strip with YOU WIN! / <NAME> WINS / IT'S A DRAW and the deciding
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
    val headline = when { isDraw -> "IT’S A DRAW"; isWin -> "YOU WIN!"; else -> "${headName.uppercase()} WINS" }
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

    Column(Modifier.fillMaxSize().background(VsTeal.page)) {
        ResultTopBar(onHome)
        LazyColumn(
            Modifier.fillMaxSize().navigationBarsPadding().padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // The window.
            item {
                // The result's host stands on the window (MASCOT_SPEC §3): S pops on a win,
                // R stands still on a loss, U (calm) on a draw.
                Box(Modifier.widthIn(max = 520.dp).fillMaxWidth().padding(top = com.wordocious.app.ui.BANNER_HOST_PEEK)) {
                    Column(
                        Modifier.widthIn(max = 520.dp).fillMaxWidth()
                            .shadow(6.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x144C1D95), spotColor = Color(0x144C1D95))
                            .clip(RoundedCornerShape(16.dp))
                            .drawBehind {
                                drawRect(leftBg, size = Size(size.width / 2f, size.height))
                                drawRect(rightBg, topLeft = Offset(size.width / 2f, 0f), size = Size(size.width / 2f, size.height))
                                drawRect(Brush.linearGradient(
                                    0f to Color.White.copy(alpha = 0.35f), 0.55f to Color.White.copy(alpha = 0f),
                                    start = Offset.Zero, end = Offset(size.width, size.height),
                                ))
                            }
                            .then(if (isWin && !WTheme.reducedMotion) Modifier.bannerShimmer() else Modifier),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f)).padding(start = 12.dp, top = 10.dp, end = 12.dp, bottom = 10.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Row(Modifier.padding(end = com.wordocious.app.ui.BANNER_HOST_CLEAR - 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = VsPurple.ink, modifier = Modifier.size(18.dp))
                                Text(headline, fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsPurple.deep, maxLines = 2)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Box(Modifier.size(18.dp), Alignment.Center) { com.wordocious.app.ui.ModeGlyph(vm.mode, modeAccent(vm.mode), 18.dp) }
                                Text(
                                    listOfNotNull(vsModeName(vm.mode).uppercase(), subLine).joinToString(" · "),
                                    fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = VsPurple.mid,
                                )
                            }
                        }
                        vm.result?.let { r ->
                            Row(Modifier.fillMaxWidth().padding(vertical = 14.dp)) {
                                ResultSide(myName, r.playerScore, r.playerGuesses, r.playerTime, mySolved, isWin && !isDraw, Modifier.weight(1f))
                                ResultSide(oppName, r.opponentScore, r.opponentGuesses, r.opponentTime, oppSolved, !isWin && !isDraw, Modifier.weight(1f))
                            }
                        }
                    }
                    com.wordocious.app.ui.Mascot(
                        if (isDraw) com.wordocious.app.ui.Mascots.vsDraw else if (isWin) com.wordocious.app.ui.Mascots.vsWin else com.wordocious.app.ui.Mascots.vsLoss,
                        56.dp,
                        Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = -com.wordocious.app.ui.BANNER_HOST_PEEK),
                        motion = if (isWin && !isDraw) com.wordocious.app.ui.MascotMotion.POP else com.wordocious.app.ui.MascotMotion.NONE,
                    )
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
                            fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = VsPurple.mid, textAlign = TextAlign.Center,
                        )
                    }
                }
            }
            // CPU practice flourish: photo finish + streak / milestone / cosmetic.
            if (vm.isCpu && (vm.photoFinish != null || vm.cpuMilestone != null || vm.cpuStreak > 0 || vm.cpuUnlock != null)) {
                item {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        vm.photoFinish?.let { pf -> PhotoFinishStamp(pf == "clutch") }
                        vm.cpuMilestone?.let { m -> Text("🔥 $m-win bot streak!", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color(0xFFC2410C)) }
                            ?: run { if (vm.cpuStreak > 0) Text("Bot win streak: ${vm.cpuStreak}", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub) }
                        vm.cpuUnlock?.let {
                            Text("🏅 Unlocked ${BotPersonas.persona(vm.cpuPersona?.tier ?: BotTier.HARD).name}’s badge!", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(vm.cpuPersona?.color ?: 0xFFEF4444))
                        }
                    }
                }
            }
            if (vm.rematch == RematchState.RECEIVED) {
                item {
                    Column(
                        Modifier.widthIn(max = 520.dp).fillMaxWidth().vsCard(14.dp).padding(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("${headName.uppercase()} WANTS A REMATCH", fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsPurple.deep, textAlign = TextAlign.Center)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
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
                        RematchState.DECLINED -> SoftPurpleButton("NO REMATCH", Modifier.alpha(0.6f)) {}
                        RematchState.OFFERED -> PurpleButton("WAITING…", modifier = Modifier.alpha(0.7f)) {}
                        RematchState.RECEIVED -> {}
                        RematchState.IDLE -> PurpleButton("REMATCH") {
                            if (vm.isPro) vm.offerRematch() else showRematchUpsell = true
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SoftPurpleButton("HOME", Modifier.weight(1f)) { onHome() }
                        SoftPurpleButton("SHARE", Modifier.weight(1f)) {
                            val text = if (isWin) "I just beat $oppName in a Wordocious VS $modeLabel duel! ⚔️🏆"
                            else if (isDraw) "$oppName and I battled to a draw in VS $modeLabel on Wordocious! ⚔️"
                            else "Epic VS $modeLabel duel against $oppName on Wordocious! ⚔️"
                            val payload = "$text\nhttps://wordocious.com"
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
                                        myName, r.playerScore, isWin, mySolved, logToGrids(myLog, solutions)),
                                    opp = com.wordocious.app.data.ShareImage.VsShareSide(
                                        oppName, r.opponentScore, !isWin && !isDraw, oppSolved, logToGrids(oppLog, solutions)),
                                )
                                com.wordocious.app.data.ShareImage.shareVs(context, bmp, payload)
                            } else {
                                com.wordocious.app.data.ShareHelper.share(context, payload)
                            }
                        }
                    }
                }
            }
            // Session tally + the bots-record note sit BELOW the window.
            if (vm.isCpu) {
                item {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        if (vm.cpuSessionWins + vm.cpuSessionLosses > 0) {
                            Text("This session — You ${vm.cpuSessionWins} · Bots ${vm.cpuSessionLosses}", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub)
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
        VSLimitUpsellModal(onGoPro = onGoPro, onClose = { showRematchUpsell = false })
    }
    // Free tier received a rematch offer — it was auto-declined in the VM
    // (non-Pro can't accept, and the opponent must not hang on "Waiting…");
    // iOS parity: surface the same Pro-limit modal instead of an inline card.
    if (vm.rematchProUpsell) {
        VSLimitUpsellModal(onGoPro = onGoPro, onClose = { vm.rematchProUpsell = false })
    }
}

/** One side of the result window: name, the score in big numerals, the exact
 *  calculation, time, and a Solved (purple) / Not solved (slate) chip. */
@Composable
private fun ResultSide(name: String, score: Double, guesses: Int, timeMs: Double, solved: Boolean, winner: Boolean, modifier: Modifier) {
    val penalty = kotlin.math.max(0.0, score - guesses)
    val secs = kotlin.math.round(timeMs / 1000).toInt()   // iOS rounds, not truncates
    Column(modifier.padding(horizontal = 6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (winner) Icon(Icons.Filled.EmojiEvents, null, tint = Color(0xFFB45309), modifier = Modifier.size(13.dp))
            Text(name.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = VsPurple.deep, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(String.format(Locale.US, "%.2f", score), fontSize = 34.sp, fontWeight = FontWeight.Black, color = VsPurple.deep)
        Text(
            "$guesses ${if (guesses == 1) "guess" else "guesses"} + ${String.format(Locale.US, "%.2f", penalty)} time",
            fontSize = 10.sp, fontWeight = FontWeight.Bold, color = VsPurple.mid, textAlign = TextAlign.Center,
        )
        Text("${secs / 60}:${"%02d".format(secs % 60)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = VsPurple.mid)
        Text(
            if (solved) "SOLVED" else "NOT SOLVED",
            fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
            color = if (solved) Color.White else Color(0xFF475569),
            modifier = Modifier.clip(RoundedCornerShape(50))
                .background(if (solved) VsPurple.ink else Color(0xFFE2E8F0))
                .padding(horizontal = 10.dp, vertical = 3.dp),
        )
    }
}

// ── Notices ────────────────────────────────────────────────────────────────────

/** A one-card notice on the VS page (opponent left, match gone, not configured). */
@Composable
private fun VsNoticeScreen(icon: @Composable () -> Unit, title: String, body: String?, button: String, onButton: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(VsTeal.page).statusBarsPadding().navigationBarsPadding().padding(horizontal = 24.dp),
        Alignment.Center,
    ) {
        Column(
            Modifier.widthIn(max = 420.dp).fillMaxWidth().vsCard(16.dp).padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.size(48.dp).clip(CircleShape).background(VsTeal.soft), Alignment.Center) { icon() }
            Text(title, fontSize = 17.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsTeal.deep, textAlign = TextAlign.Center)
            body?.let { Text(it, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center) }
            VsTealButton(button, Modifier.fillMaxWidth(), onClick = onButton)
        }
    }
}

@Composable
private fun AlreadyPlayedDaily(answer: String, isPro: Boolean, won: Boolean?, onHome: () -> Unit, onGoPro: () -> Unit, onPlayUnlimited: () -> Unit) {
    Column(Modifier.fillMaxSize().background(VsTeal.page)) {
        VsNavBar("DAILY BATTLE", onBack = onHome)
        Column(
            Modifier.fillMaxSize().navigationBarsPadding().padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        ) {
            Column(Modifier.widthIn(max = 520.dp).fillMaxWidth().vsTealWindow()) {
                Column(
                    Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f))
                        .padding(start = 14.dp, top = 12.dp, end = 12.dp, bottom = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text("ALREADY PLAYED", fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsTeal.deep)
                    // Live "next daily VS" countdown (web parity — getSecondsUntilMidnight).
                    var cdTick by remember { mutableStateOf(0) }
                    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); cdTick++ } }
                    @Suppress("UNUSED_EXPRESSION") cdTick
                    val s = vsSecondsUntilLocalMidnight()
                    Text(
                        "TODAY’S VS PUZZLE · NEXT IN ${"%02d:%02d:%02d".format(s / 3600, (s % 3600) / 60, s % 60)}",
                        fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, color = VsTeal.ink,
                    )
                }
                Column(
                    Modifier.fillMaxWidth().padding(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Today's daily VS outcome — W/L pill (the user asked for an explicit result here).
                    won?.let {
                        Text(
                            if (it) "YOU WON" else "YOU LOST",
                            fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
                            color = if (it) Color.White else Color(0xFF475569),
                            modifier = Modifier.clip(RoundedCornerShape(50))
                                .background(if (it) VsPurple.ink else Color(0xFFE2E8F0))
                                .padding(horizontal = 14.dp, vertical = 5.dp),
                        )
                    }
                    if (answer.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            answer.uppercase().forEach { ch ->
                                Box(Modifier.size(40.dp).clip(RoundedCornerShape(6.dp)).background(VsPurple.ink), Alignment.Center) {
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
                if (isPro) VsTealButton("PLAY UNLIMITED VS", Modifier.fillMaxWidth(), onClick = onPlayUnlimited)
                else PurpleButton("UPGRADE TO PRO", onClick = onGoPro)
                VsSoftPill("HOME", Modifier.align(Alignment.CenterHorizontally), bg = VsSoftGrey, ink = VsTeal.label) { onHome() }
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

/** VS Pro-upsell modal — ports web vs-limit-modal.tsx (shown on non-Pro Rematch). */
@Composable
private fun VSLimitUpsellModal(onGoPro: () -> Unit, onClose: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.45f)).clickableNoRipple(onClose)
            .statusBarsPadding().navigationBarsPadding(),
        Alignment.Center,
    ) {
        Column(
            Modifier.padding(horizontal = 24.dp).widthIn(max = 420.dp).fillMaxWidth().vsCard(18.dp).clickableNoRipple { }
                .padding(22.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.size(48.dp).clip(CircleShape).background(VsTeal.soft), Alignment.Center) {
                Icon(painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = VsTeal.ink, modifier = Modifier.size(24.dp))
            }
            Text("DAILY VS USED", fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = VsPurple.deep)
            Text(
                "You've played your free daily VS match for today. Upgrade to Pro for unlimited ad-free battles and rematches, or come back tomorrow.",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VsTeal.sub, textAlign = TextAlign.Center,
            )
            var tick by remember { mutableStateOf(0) }
            LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); tick++ } }
            @Suppress("UNUSED_EXPRESSION") tick
            val s = vsSecondsUntilLocalMidnight()
            Text(
                "RESETS IN ${"%02d:%02d:%02d".format(s / 3600, (s % 3600) / 60, s % 60)}",
                fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.ink,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(VsTeal.soft)
                    .padding(horizontal = 14.dp, vertical = 7.dp),
            )
            PurpleButton("GO PRO") { onClose(); onGoPro() }
            SoftPurpleButton("MAYBE LATER", onClick = onClose)
        }
    }
}
