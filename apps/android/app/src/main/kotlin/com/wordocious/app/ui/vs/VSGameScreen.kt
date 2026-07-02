package com.wordocious.app.ui.vs

import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import com.wordocious.app.data.BotPersonas
import com.wordocious.app.data.BotTier
import com.wordocious.app.data.CpuKind
import com.wordocious.app.data.CpuProgressionStore
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wordocious.app.ui.InviteSheet
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.game.GauntletStepper
import com.wordocious.app.ui.game.HintPills
import com.wordocious.app.ui.game.KeyboardView
import com.wordocious.app.ui.game.MultiBoardLayout
import com.wordocious.app.ui.game.ProperNoundleHints
import com.wordocious.app.ui.game.SingleBoard
import com.wordocious.app.ui.game.StageTransitionOverlay
import com.wordocious.app.ui.game.computeCombinedLetterStates
import com.wordocious.app.ui.game.computePerBoardLetterStates
import com.wordocious.app.ui.game.XpToast
import com.wordocious.app.ui.modeTitle
import com.wordocious.app.ui.modeTitleGradient
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus

private class VSVMFactory(val mode: GameMode, val isDaily: Boolean, val inviteCode: String?) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        VSMatchViewModel(mode, isDaily, inviteCode) as T
}

private fun vsModeLabel(mode: GameMode): String = when (mode) {
    GameMode.DUEL_6 -> "SIX"; GameMode.DUEL_7 -> "SEVEN"; else -> modeTitle(mode)
}

/**
 * VS match UI — ports iOS VSGameView / web vs-game.tsx screens
 * (queue → countdown → match → waiting → result → rematch). Board modes only in
 * this increment.
 */
@Composable
fun VSGameScreen(mode: GameMode, isDaily: Boolean = false, inviteCode: String? = null, onHome: () -> Unit, onGoPro: () -> Unit, onPlayUnlimited: () -> Unit = {}) {
    val vm: VSMatchViewModel = viewModel(key = "vs-$mode-${inviteCode ?: "rand"}", factory = VSVMFactory(mode, isDaily, inviteCode))
    LaunchedEffect(Unit) { vm.start() }
    val gradient = modeTitleGradient(mode)
    val label = "VS ${vsModeLabel(mode)}"

    fun goHome() { vm.forfeit(); onHome() }

    Box(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(WTheme.bg, WTheme.surfaceHover))),
        contentAlignment = Alignment.Center,
    ) {
        when (vm.screen) {
            VSScreen.NOT_CONFIGURED -> NotConfigured(label, gradient, ::goHome)
            VSScreen.ENTRY -> EntryScreen(label, gradient, vm, onGoPro, ::goHome)
            VSScreen.QUEUE -> QueueScreen(label, gradient, vm.queuePosition, vm.queueSize, vm.message, vm.inviteCode, vm, onGoPro, ::goHome)
            VSScreen.MATCH -> MatchScreen(vm, label, gradient, ::goHome)
            VSScreen.WAITING -> WaitingScreen(vm, gradient, ::goHome)
            VSScreen.RESULT -> ResultScreen(vm, gradient, ::goHome, onGoPro)
            VSScreen.OPPONENT_LEFT -> OpponentLeft(::goHome)
            VSScreen.ALREADY_PLAYED_DAILY -> AlreadyPlayedDaily(vm.dailyAnswer, gradient, vm.isPro, vm.dailyWon, ::goHome, onGoPro, onPlayUnlimited)
        }

        // Don't stack the countdown under the dark intro splash (it ticked behind
        // it and then popped in color); show it only once the intro is gone.
        vm.countdown?.let { if (!vm.showIntro) CountdownOverlay(it, gradient, vm.countdownIsRematch) }
        // Match-intro splash — sits above the countdown for 2.5s (or until tapped).
        if (vm.showIntro) {
            val profile by com.wordocious.app.data.AuthService.profile.collectAsState()
            MatchIntro(
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
        if (vm.screen == VSScreen.RESULT) vm.xpResult?.let { XpToast(it) { vm.xpResult = null } }
    }
}

@Composable
private fun VsTitle(label: String, gradient: List<Color>, size: Int) {
    Text(label, fontSize = size.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.horizontalGradient(gradient)))
}

@Composable
private fun QueueScreen(label: String, gradient: List<Color>, position: Int, queueSize: Int, message: String?, inviteCode: String?, vm: VSMatchViewModel, onGoPro: () -> Unit, onHome: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    // CPU: no human matchmaking queue — a brief branded warmup while the bot
    // spins up (the intro splash covers it a beat later).
    if (vm.isCpu) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(22.dp)) {
            VsTitle(label, gradient, 36)
            CircularProgressIndicator(color = WTheme.primary)
            Text(
                vm.cpuPersona?.let { "Matching you with ${it.name} ${it.avatar}…" } ?: "Setting up your match…",
                fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, textAlign = TextAlign.Center,
            )
        }
        return
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(22.dp)) {
        VsTitle(label, gradient, 36)
        // Private match: surface the shareable code/link so the host can invite a
        // friend (the matchmaker buckets both by the same code).
        if (inviteCode != null) {
            Column(
                Modifier.padding(horizontal = 24.dp).clip(RoundedCornerShape(16.dp))
                    .background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("PRIVATE MATCH", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = WTheme.textMuted)
                Text(inviteCode, fontSize = 30.sp, fontWeight = FontWeight.Black, letterSpacing = 6.sp, style = TextStyle(brush = Brush.horizontalGradient(gradient)))
                Text("Share this code — the match starts when your friend joins.", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center)
                Box(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.primary)
                        .clickableNoRipple {
                            com.wordocious.app.data.ShareHelper.share(context, "Join my Wordocious VS match — code $inviteCode\nhttps://wordocious.com/vs/join/$inviteCode")
                        }.padding(vertical = 12.dp),
                    Alignment.Center,
                ) {
                    Text("Share invite", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
        }
        CircularProgressIndicator(color = WTheme.primary)
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            CyclingStatus()
            Text("Position in queue: ${position + 1}", fontSize = 13.sp, color = WTheme.textMuted)
            if (queueSize > 1) {
                Text("$queueSize players waiting", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
        // Play the CPU — explicit choice + auto-offer once the queue is quiet.
        if (!vm.isCpu) {
            CpuChooser(vm, onGoPro)
        }
        Pill("Cancel") { onHome() }
        message?.let { Text(it, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.clip(RoundedCornerShape(50)).background(WTheme.text.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 8.dp)) }
    }
}

// Difficulty/opponent grid — shared by the entry chooser's Bot Match and the
// queue-screen auto-offer. Pro-gated (non-Pro sees an unlock CTA).
@Composable
private fun CpuChooserBody(vm: VSMatchViewModel, onGoPro: () -> Unit, ghostRun: Pair<Int, Double>?) {
    if (vm.isPro) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(BotTier.EASY, BotTier.MEDIUM, BotTier.HARD).forEach { tier ->
                val p = BotPersonas.persona(tier)
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(WTheme.surfaceHover)
                        .border(1.5.dp, Color(p.color), RoundedCornerShape(12.dp))
                        .clickableNoRipple { vm.startCpu(CpuKind.valueOf(tier.name)) }.padding(vertical = 10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(p.avatar, fontSize = 20.sp)
                    Text(BotPersonas.tierLabel(tier), fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(p.color))
                    Text(p.name, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
        }
        CpuSpecial("⚖️ Adaptive — matched to your form", 0xFF7C3AED, Modifier.fillMaxWidth()) { vm.startCpu(CpuKind.ADAPTIVE) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CpuSpecial(
                if (ghostRun == null) "👻 Beat Your Best (win first)" else "👻 Beat Your Best",
                0xFF64748B, Modifier.weight(1f).then(if (ghostRun == null) Modifier.alpha(0.45f) else Modifier),
            ) { ghostRun?.let { (g, t) -> vm.startCpu(CpuKind.GHOST, ghostGuesses = g, ghostTimeMs = t) } }
            CpuSpecial("📅 Bot of the Day", 0xFFF59E0B, Modifier.weight(1f)) {
                vm.startCpu(CpuKind.DAILY, fixedSeed = com.wordocious.core.generateDailySeed(CpuProgressionStore.todayUtc(), "${vm.mode.name}_CPU"))
            }
        }
        Text("Practice only — doesn’t affect your ranked stats", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    } else {
        Box(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                .background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899))))
                .clickableNoRipple { onGoPro() }.padding(vertical = 10.dp),
            Alignment.Center,
        ) { Text("🔒 Unlock with Pro", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White) }
    }
}

// Queue-screen auto-offer once the human queue sits quiet (the explicit Bot
// Match choice now lives on the entry chooser).
@Composable
private fun CpuChooser(vm: VSMatchViewModel, onGoPro: () -> Unit) {
    var autoOffer by remember { mutableStateOf(false) }
    var ghostRun by remember { mutableStateOf<Pair<Int, Double>?>(null) }
    LaunchedEffect(Unit) { kotlinx.coroutines.delay(15_000); if (!vm.isCpu) autoOffer = true }
    LaunchedEffect(vm.mode) {
        val uid = com.wordocious.app.data.AuthService.userId
        if (vm.isPro && uid != null) ghostRun = com.wordocious.app.data.MatchStatsService.ghostBestRun(uid, vm.mode.name)
    }
    if (autoOffer) {
        Column(
            Modifier.widthIn(max = 340.dp).clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("No players right now — play the CPU?", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            CpuChooserBody(vm, onGoPro, ghostRun)
        }
    }
}

// Entry chooser — the first screen when tapping a VS mode: Quick Match (live
// queue), Bot Match (CPU practice), or Invite a Friend (private match).
@Composable
private fun EntryScreen(label: String, gradient: List<Color>, vm: VSMatchViewModel, onGoPro: () -> Unit, onHome: () -> Unit) {
    var showBot by remember { mutableStateOf(false) }
    var showInvite by remember { mutableStateOf(false) }
    var ghostRun by remember { mutableStateOf<Pair<Int, Double>?>(null) }
    LaunchedEffect(vm.mode) {
        val uid = com.wordocious.app.data.AuthService.userId
        if (vm.isPro && uid != null) ghostRun = com.wordocious.app.data.MatchStatsService.ghostBestRun(uid, vm.mode.name)
    }
    if (showInvite) InviteSheet { showInvite = false }
    Column(
        Modifier.fillMaxSize().padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
    ) {
        VsTitle(label, gradient, 36)
        if (showBot) {
            Column(
                Modifier.widthIn(max = 360.dp).clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(14.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("‹", fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted,
                        modifier = Modifier.clickableNoRipple { showBot = false })
                    Text("🤖 Choose your opponent", fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                }
                CpuChooserBody(vm, onGoPro, ghostRun)
            }
        } else {
            Column(Modifier.widthIn(max = 380.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                EntryOption("⚡", listOf(Color(0xFFA78BFA), Color(0xFFEC4899)), "Quick Match", "Get matched with a live opponent") { vm.joinHumanQueue() }
                EntryOption("🤖", null, "Bot Match", "Practice vs the CPU — pick a difficulty", locked = !vm.isPro) {
                    if (vm.isPro) showBot = true else onGoPro()
                }
                EntryOption("👥", null, "Invite a Friend", "Send a private match link or @username") { showInvite = true }
            }
            Text("Cancel", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                modifier = Modifier.clickableNoRipple { onHome() })
        }
    }
}

@Composable
private fun EntryOption(emoji: String, iconGradient: List<Color>?, title: String, subtitle: String, locked: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).clickableNoRipple(onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(
            Modifier.size(48.dp).clip(RoundedCornerShape(12.dp))
                .then(if (iconGradient != null) Modifier.background(Brush.linearGradient(iconGradient)) else Modifier.background(Color(0xFF64748B).copy(alpha = 0.12f))),
            Alignment.Center,
        ) { Text(emoji, fontSize = 22.sp) }
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(title, fontSize = 16.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                if (locked) Text("🔒", fontSize = 11.sp)
            }
            Text(subtitle, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
    }
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
        fontSize = 30.sp, fontWeight = FontWeight.Black,
        style = TextStyle(brush = Brush.horizontalGradient(listOf(Color(0xFFFACC15), Color(0xFFF97316), Color(0xFFEC4899)))),
        modifier = Modifier.graphicsLayer { scaleX = scale; scaleY = scale; rotationZ = -6f; alpha = if (shown) 1f else 0f },
    )
}

@Composable
private fun CpuSpecial(title: String, color: Long, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(12.dp)).background(WTheme.surfaceHover)
            .border(1.5.dp, Color(color), RoundedCornerShape(12.dp)).clickableNoRipple { onClick() }.padding(vertical = 9.dp),
        Alignment.Center,
    ) { Text(title, fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(color)) }
}

@Composable
private fun CountdownOverlay(count: Int, gradient: List<Color>, isRematch: Boolean = false) {
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.6f)), Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(if (isRematch) "REMATCH STARTING IN" else "MATCH FOUND", fontSize = 15.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp, color = Color.White.copy(alpha = 0.7f))
            Text("$count", fontSize = 96.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.horizontalGradient(gradient)))
        }
    }
}

@Composable
private fun MatchScreen(vm: VSMatchViewModel, label: String, gradient: List<Color>, onHome: () -> Unit) {
    val game = vm.game ?: return
    val state by game.state.collectAsState()
    val input by game.currentInput.collectAsState()
    val invalid by game.invalidWord.collectAsState()
    val shakeKey by game.shakeKey.collectAsState()
    val multiBoard = state.boards.size > 1
    val isSequential = mode(vm) == GameMode.SEQUENCE
    val useQuadrant = multiBoard && !isSequential
    val letterStates = if (isSequential)
        computeCombinedLetterStates(listOf(state.boards[state.currentBoardIndex]))
    else computeCombinedLetterStates(state.boards)
    val perBoardStates = if (useQuadrant) computePerBoardLetterStates(state.boards) else null

    // Throttled typing relay — ping while letters are in the current row (web onTyping).
    LaunchedEffect(input) { if (input.isNotEmpty()) vm.notifyTyping() }
    // Light haptic on every opponent guess row (web navigator.vibrate parity).
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    LaunchedEffect(vm.opponentGuessTick) {
        if (vm.opponentGuessTick > 0) haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove)
    }

    val profile by com.wordocious.app.data.AuthService.profile.collectAsState()
    // Leaving an in-progress match forfeits it (a recorded loss) — confirm first.
    var confirmForfeit by remember { mutableStateOf(false) }
    if (confirmForfeit) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmForfeit = false },
            title = { Text("Forfeit match?") },
            text = { Text("Leaving now forfeits the match — it counts as a loss" + (if (vm.isDaily) " and uses today's daily VS." else ".")) },
            confirmButton = { androidx.compose.material3.TextButton(onClick = { confirmForfeit = false; onHome() }) { Text("Forfeit & Leave") } },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { confirmForfeit = false }) { Text("Keep Playing") } },
        )
    }

    Box(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxSize().padding(horizontal = 10.dp)) {
        // Header: home button + VS title
        Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(34.dp).clip(CircleShape).background(WTheme.surface).border(1.5.dp, WTheme.border, CircleShape).clickableNoRipple { confirmForfeit = true }, Alignment.Center) {
                Text("⌂", fontSize = 18.sp, color = WTheme.primary, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                VsTitle(label, gradient, 20)
                // Live guesses + elapsed clock (web vs-classic top stat row).
                var tick by remember { mutableStateOf(0) }
                LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); tick++ } }
                @Suppress("UNUSED_EXPRESSION") tick
                val secs = vm.matchElapsedSeconds
                Text(
                    "${game.rowsUsed}/${game.maxGuesses} guesses · ${secs / 60}:${"%02d".format(secs % 60)}",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
            }
            Spacer(Modifier.weight(1f))
            Spacer(Modifier.size(34.dp))
        }
        // Persistent VS header: you vs opponent + tug-of-war lead bar + typing.
        VsMatchHeader(
            me = HeaderPlayer(
                username = profile?.username ?: "You",
                avatarUrl = profile?.avatarUrl,
                guesses = vm.myGuessCount,
                progress = computeVsProgress(
                    boardsSolved = state.boards.count { it.status == GameStatus.WON },
                    totalBoards = state.boards.size,
                    bestGreens = myBestRowGreens(state.boards, vm.mode),
                    wordLen = vm.wordLen,
                ),
            ),
            opponent = HeaderPlayer(
                username = vm.opponentName,
                avatarUrl = vm.opponentInfo?.avatarUrl,
                guesses = vm.opponent.attempts,
                progress = computeVsProgress(
                    boardsSolved = vm.opponent.boardsSolved,
                    totalBoards = state.boards.size,
                    bestGreens = bestRowGreens(vm.opponent.tiles),
                    wordLen = vm.wordLen,
                ),
            ),
            opponentTyping = vm.opponentTyping,
            modifier = Modifier.padding(top = 6.dp),
        )
        OpponentStrip(vm.opponent, game.maxGuesses, game.wordLength, Modifier.padding(top = 6.dp))

        // Gauntlet VS: the 5-node stage stepper (parity with the solo header).
        if (vm.mode == GameMode.GAUNTLET) {
            Spacer(Modifier.height(6.dp))
            GauntletStepper(current = state.gauntlet?.currentStage ?: 0, total = state.gauntlet?.totalStages ?: 5)
        }
        // ProperNoundle VS: the Wikipedia clue (italic, centered) once revealed.
        if (vm.mode == GameMode.PROPERNOUNDLE) {
            val clueText by game.clue.collectAsState()
            clueText?.let {
                Text(
                    it, color = WTheme.textSecondary, fontSize = 12.sp,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
                )
            }
        }

        Box(Modifier.weight(1f).fillMaxWidth().padding(vertical = 4.dp)) {
            if (multiBoard) {
                MultiBoardLayout(
                    boards = state.boards, currentGuess = input, currentBoardIndex = state.currentBoardIndex,
                    isSequential = isSequential, isInvalid = invalid, shakeKey = shakeKey,
                    modifier = Modifier.fillMaxSize().padding(4.dp),
                )
            } else {
                SingleBoard(state.boards[0], input, invalid, shakeKey, Modifier.fillMaxSize())
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
            Spacer(Modifier.height(6.dp))
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
            Spacer(Modifier.height(6.dp))
        }
        KeyboardView(
            letterStates = letterStates,
            onKey = { game.typeLetter(it) },
            onDelete = { game.deleteLetter() },
            onEnter = { game.submit(applyToAll = useQuadrant) },
            perBoardStates = perBoardStates,
        )
        Spacer(Modifier.height(6.dp))
    }

    // Gauntlet VS stage-transition overlay — the same interstitial as solo, shown
    // the moment every board in the current stage is won and the run is live.
    val gauntlet = state.gauntlet
    if (vm.mode == GameMode.GAUNTLET && gauntlet != null &&
        state.status == GameStatus.PLAYING && state.boards.isNotEmpty() &&
        state.boards.all { it.status == GameStatus.WON }
    ) {
        StageTransitionOverlay(
            completed = gauntlet.stages[gauntlet.currentStage],
            next = gauntlet.stages.getOrNull(gauntlet.currentStage + 1),
        ) { game.advanceGauntletStage() }
    }

    // Moment callout — opponent milestones (greens / board solved / last guess).
    vm.callout?.let { text ->
        Box(Modifier.fillMaxWidth().padding(top = 48.dp), Alignment.TopCenter) {
            VsCalloutPill(text)
        }
    }
    }
}

private fun mode(vm: VSMatchViewModel) = vm.mode

/**
 * Spectator waiting screen — you finished; watch the opponent's live board
 * (colors only, ~2x tiles), with live guess counter + clock and stakes copy.
 * Ports web vs-game.tsx's `waiting` screen.
 */
@Composable
private fun WaitingScreen(vm: VSMatchViewModel, gradient: List<Color>, onHome: () -> Unit) {
    val oppName = vm.opponentName
    val totalBoardsLocal = vm.game?.boardCount ?: 1
    val liveTotalBoards = if (vm.opponent.totalBoards > 0) vm.opponent.totalBoards else totalBoardsLocal
    val oppRowsUsed = vm.opponent.tiles.values.maxOfOrNull { it.size } ?: 0
    // Cap rendered empty rows so Gauntlet's 50-guess budget doesn't blow up the layout.
    val spectatorRows = minOf(vm.modeMaxGuesses, maxOf(6, oppRowsUsed + 1))

    // Live m:ss clock since match start.
    var tick by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); tick++ } }
    @Suppress("UNUSED_EXPRESSION") tick
    val clockSecs = vm.matchElapsedSeconds
    val clockStr = "${clockSecs / 60}:${"%02d".format(clockSecs % 60)}"

    // STAKES copy — web parity. The real win rule is: solve, then tie-break on
    // boardsSolved, then composite score = guesses + timeSeconds/45. The
    // opponent is still playing, so they're almost always behind on time and
    // need strictly FEWER guesses; if they're somehow still ahead of your
    // clock, matching your guess count could win on time.
    val myGuesses = vm.myGuessCount
    val stakes: String = run {
        val boardsLeft = liveTotalBoards - vm.opponent.boardsSolved
        if (vm.myStatus == GameStatus.LOST) {
            if (liveTotalBoards > 1) "$oppName needs $boardsLeft more board${if (boardsLeft == 1) "" else "s"} to win"
            else "$oppName just needs to solve to win"
        } else if (liveTotalBoards > 1 && boardsLeft > 1) {
            "$oppName needs $boardsLeft more boards to stay alive"
        } else {
            val opponentTimeBehind = vm.matchElapsedSeconds * 1000L > vm.playerTimeMs
            val target = if (opponentTimeBehind) myGuesses - 1 else myGuesses
            if (target <= 0 || vm.opponent.attempts >= target) "$oppName can no longer beat your score!"
            else "$oppName must solve in $target or fewer to beat you"
        }
    }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item { Spacer(Modifier.height(24.dp)) }
        item {
            Text(
                "$oppName is still playing...", fontSize = 24.sp, fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center, style = TextStyle(brush = Brush.horizontalGradient(gradient)),
            )
        }
        // Opponent identity + live counters (+ typing dots while pings arrive).
        item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                // Breathing "live" ring signals an active opponent while you wait.
                Box(contentAlignment = Alignment.Center) {
                    if (!WTheme.reducedMotion) {
                        val inf = androidx.compose.animation.core.rememberInfiniteTransition(label = "pulse")
                        val s by inf.animateFloat(
                            0.9f, 1.45f,
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
                                .border(2.dp, gradient.firstOrNull() ?: WTheme.primary, androidx.compose.foundation.shape.CircleShape),
                        )
                    }
                    VsAvatar(oppName, vm.opponentInfo?.avatarUrl, size = 48.dp, borderColor = WTheme.border)
                }
                Column {
                    Text(oppName, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
                    val attempts = vm.opponent.attempts
                    Text(
                        buildString {
                            append("$attempts ${if (attempts == 1) "guess" else "guesses"} · $clockStr")
                            if (liveTotalBoards > 1) append(" · ${vm.opponent.boardsSolved}/$liveTotalBoards boards")
                        },
                        fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    )
                }
                if (vm.opponentTyping) TypingDots(dotSize = 6.dp)
            }
        }
        // Stakes pill
        if (stakes.isNotEmpty()) {
            item {
                Text(
                    stakes, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(WTheme.surfaceHover)
                        .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
        }
        // Opponent live board — bigger now so it fills the space and the flip-in
        // reveal reads clearly while you watch.
        item {
            val specCell = if (liveTotalBoards <= 1) 34.dp else if (liveTotalBoards <= 4) 24.dp else 14.dp
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(18.dp)).padding(20.dp),
                Alignment.Center,
            ) {
                if (liveTotalBoards <= 1) {
                    OpponentMiniBoard(vm.opponent.tiles[0] ?: emptyList(), spectatorRows, vm.wordLen, specCell)
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            (0 until liveTotalBoards).chunked(4).forEach { rowBoards ->
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    rowBoards.forEach { i ->
                                        OpponentMiniBoard(vm.opponent.tiles[i] ?: emptyList(), spectatorRows, vm.wordLen, specCell)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // Your stats
        item {
            StatCard("YOUR RESULT", listOf("Guesses" to "$myGuesses", "Time" to fmtTime(vm.playerTimeMs.toDouble())))
        }
        // CPU spectator: skip watching the bot grind out its boards — the outcome
        // is already fixed by its plan. Win-locked → 'Claim your win'; else a
        // neutral 'Skip to result' (may resolve to a win OR a loss).
        if (vm.isCpu) {
            item {
                val boardsLeft = liveTotalBoards - vm.opponent.boardsSolved
                val winLocked = vm.myStatus != GameStatus.LOST && !(liveTotalBoards > 1 && boardsLeft > 1) && run {
                    val behind = vm.matchElapsedSeconds * 1000L > vm.playerTimeMs
                    val target = if (behind) myGuesses - 1 else myGuesses
                    target <= 0 || vm.opponent.attempts >= target
                }
                Box(
                    Modifier.clip(RoundedCornerShape(14.dp))
                        .then(
                            if (winLocked) Modifier.background(Brush.horizontalGradient(gradient))
                            else Modifier.background(WTheme.surfaceHover).border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp)),
                        )
                        .clickableNoRipple { vm.finishCpuNow() }
                        .padding(horizontal = 22.dp, vertical = 12.dp),
                    Alignment.Center,
                ) {
                    Text(
                        if (winLocked) "🏁 Claim your win" else "⏩ Skip to result",
                        fontSize = 15.sp, fontWeight = FontWeight.Black,
                        color = if (winLocked) Color.White else WTheme.primary,
                    )
                }
            }
        }
        item { Pill("Leave") { onHome() } }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun ResultScreen(vm: VSMatchViewModel, gradient: List<Color>, onHome: () -> Unit, onGoPro: () -> Unit) {
    // Web parity: non-Pro Rematch opens the VsLimitModal Pro upsell.
    var showRematchUpsell by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val profile by com.wordocious.app.data.AuthService.profile.collectAsState()
    val winner = vm.result?.winner
    val isWin = winner == "player"; val isDraw = winner == "draw"
    // Web headline: WINNER / DRAW / DEFEAT (green / yellow / red gradients).
    val headline = if (isWin) "WINNER" else if (isDraw) "DRAW" else "DEFEAT"
    val colors = if (isWin) listOf(Color(0xFFA78BFA), Color(0xFFC4B5FD))
    else if (isDraw) listOf(Color(0xFFFACC15), Color(0xFFFDBA74))
    else listOf(Color(0xFFF87171), Color(0xFFFDA4AF))
    val myName = profile?.username ?: "You"
    val oppName = vm.opponentName
    val modeLabel = vsModeLabel(vm.mode)
    // Solve status decides most matches (solving beats score), so spell it out —
    // the loser often has "better" numbers, which reads as a mistake otherwise.
    val mySolved = vm.myStatus == GameStatus.WON
    val oppSolved = logSolved(
        (vm.result?.opponentGuessLog ?: emptyList()).map { GuessLogEntry(it.boardIndex, it.guess) },
        vm.result?.solutions ?: emptyList(),
    )
    val whyLine = when {
        vm.result == null -> null
        isDraw -> "Dead even — identical scores"
        isWin -> if (mySolved && !oppSolved) "You solved it — $oppName didn’t" else "Both solved — you won on score"
        else -> if (oppSolved && !mySolved) "$oppName solved it — you didn’t" else "Both solved — $oppName won on score"
    }

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Spacer(Modifier.height(40.dp)) }
        item { Text(headline, fontSize = 56.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.horizontalGradient(colors))) }
        // Why you won/lost, in plain English.
        whyLine?.let { line ->
            item {
                Text(line, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textSecondary, modifier = Modifier.padding(top = 6.dp))
            }
        }
        // CPU practice: photo-finish flourish + streak / milestone / cosmetic /
        // run-it-back session tally.
        if (vm.isCpu) {
            item {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.padding(top = 6.dp)) {
                    vm.photoFinish?.let { pf -> PhotoFinishStamp(pf == "clutch") }
                    vm.cpuMilestone?.let { m -> Text("🔥 $m-win CPU streak!", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color(0xFFF97316)) }
                        ?: run { if (vm.cpuStreak > 0) Text("CPU win streak: ${vm.cpuStreak}", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted) }
                    vm.cpuUnlock?.let {
                        Text("🏅 Unlocked ${BotPersonas.persona(vm.cpuPersona?.tier ?: BotTier.HARD).name}’s badge!", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(vm.cpuPersona?.color ?: 0xFFEF4444))
                    }
                    if (vm.cpuSessionWins + vm.cpuSessionLosses > 0) {
                        Text("This session — You ${vm.cpuSessionWins} · CPU ${vm.cpuSessionLosses}", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                    }
                    Text("Practice — not counted in ranked stats", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
        }
        // Updated all-time head-to-head (refetched ~1.2s after the match was recorded).
        if (vm.opponentUserId != null && !vm.isCpu) {
            vm.headToHead?.let { h2h ->
                item {
                    Text(
                        com.wordocious.app.data.HeadToHeadService.headToHeadLine(oppName, h2h),
                        fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textSecondary,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
        // Prominent head-to-head FINAL SCORE — big totals with the exact
        // calculation + solve badges (replaces the inverted comparison bars).
        vm.result?.let { r ->
            item {
                ScoreCard(
                    me = ScoreCardPlayer(myName, r.playerScore, r.playerGuesses, r.playerTime, mySolved, isWin),
                    opponent = ScoreCardPlayer(oppName, r.opponentScore, r.opponentGuesses, r.opponentTime, oppSolved, !isWin && !isDraw),
                    isDraw = isDraw,
                )
            }
        }
        if (vm.rematch == RematchState.RECEIVED) {
            item {
                Column(Modifier.padding(top = 14.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).border(2.dp, WTheme.primary, RoundedCornerShape(14.dp)).padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Opponent wants a rematch!", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Pill("Decline") { vm.declineRematch() }
                        GradientPill("Accept", gradient) { vm.acceptRematch() }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
        // Actions — prominent Rematch on top, Home/Share below (web parity).
        when (vm.rematch) {
            RematchState.DECLINED -> item { Pill("No Rematch", Modifier.fillMaxWidth()) {} }
            RematchState.OFFERED -> item { GradientPill("Waiting…", gradient, Modifier.fillMaxWidth()) {} }
            RematchState.RECEIVED -> {}
            RematchState.IDLE -> item {
                GradientPill("Rematch", gradient, Modifier.fillMaxWidth()) {
                    if (vm.isPro) vm.offerRematch() else showRematchUpsell = true
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Pill("Home", Modifier.weight(1f)) { onHome() }
                Pill("Share", Modifier.weight(1f)) {
                    val text = if (isWin) "I just beat $oppName in a Wordocious VS $modeLabel duel! ⚔️🏆"
                    else if (isDraw) "$oppName and I battled to a draw in VS $modeLabel on Wordocious! ⚔️"
                    else "Epic VS $modeLabel duel against $oppName on Wordocious! ⚔️"
                    val payload = "$text\nhttps://wordocious.com"
                    // Render the VS share card (same aesthetic as the daily cards);
                    // text-only fallback when there's no result payload.
                    val r = vm.result
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
        // Final boards with letters — opponent's reconstructed from the
        // match-end guess log + solutions; mine from local play.
        val solutions = vm.result?.solutions ?: emptyList()
        if (solutions.isNotEmpty()) {
            item {
                val myLog = vm.game?.state?.value?.boards.orEmpty().flatMapIndexed { i, b ->
                    b.guesses.map { GuessLogEntry(i, it) }
                }
                val oppLog = (vm.result?.opponentGuessLog ?: emptyList()).map { GuessLogEntry(it.boardIndex, it.guess) }
                Box(Modifier.padding(top = 16.dp)) {
                    FinalBoards(
                        myName = myName, opponentName = oppName,
                        myGuessLog = myLog, opponentGuessLog = oppLog, solutions = solutions,
                    )
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
    // Confetti for wins only (web Confetti / VictoryOverlay parity).
    if (isWin && !WTheme.reducedMotion) VsConfetti()
    if (showRematchUpsell) {
        VSLimitUpsellModal(onGoPro = onGoPro, onClose = { showRematchUpsell = false })
    }
}

@Composable
private fun OpponentLeft(onHome: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Opponent left the match", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text("Home", fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.primary, modifier = Modifier.clickableNoRipple(onHome))
    }
}

@Composable
private fun NotConfigured(label: String, gradient: List<Color>, onHome: () -> Unit) {
    Column(Modifier.padding(horizontal = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        VsTitle(label, gradient, 30)
        Text("VS is almost ready", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text("Real-time matches turn on once the multiplayer server is connected.", fontSize = 13.sp, color = WTheme.textMuted, textAlign = TextAlign.Center)
        Text("Back", fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.primary, modifier = Modifier.clickableNoRipple(onHome))
    }
}

@Composable
private fun AlreadyPlayedDaily(answer: String, gradient: List<Color>, isPro: Boolean, won: Boolean?, onHome: () -> Unit, onGoPro: () -> Unit, onPlayUnlimited: () -> Unit) {
    Column(Modifier.padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("TODAY'S VS PUZZLE", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = WTheme.textMuted)
            Text("Already Played", fontSize = 32.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.horizontalGradient(gradient)))
        }
        // Today's daily VS outcome — W/L pill (the user asked for an explicit result here).
        won?.let {
            Text(
                if (it) "YOU WON" else "YOU LOST",
                fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White,
                modifier = Modifier.clip(RoundedCornerShape(50))
                    .background(Color(if (it) 0xFF7C3AED else 0xFFDC2626))
                    .padding(horizontal = 14.dp, vertical = 6.dp),
            )
        }
        if (answer.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                answer.uppercase().forEach { ch ->
                    Box(Modifier.size(44.dp).clip(RoundedCornerShape(6.dp)).background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9)))), Alignment.Center) {
                        Text(ch.toString(), fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }
            }
        }
        // Live "next daily VS" countdown (web parity — getSecondsUntilMidnight pill).
        var cdTick by remember { mutableStateOf(0) }
        LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); cdTick++ } }
        @Suppress("UNUSED_EXPRESSION") cdTick
        val s = vsSecondsUntilLocalMidnight()
        Text(
            "Next daily VS in ${"%02d:%02d:%02d".format(s / 3600, (s % 3600) / 60, s % 60)}",
            fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.primary,
            modifier = Modifier.clip(RoundedCornerShape(50))
                .background(WTheme.primary.copy(alpha = 0.12f))
                .padding(horizontal = 12.dp, vertical = 6.dp),
        )
        Text(
            if (isPro) "Want more? Jump into unlimited VS battles with fresh puzzles."
            else "Upgrade to Pro for unlimited VS matches, rematches, and ad-free battles.",
            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary, textAlign = TextAlign.Center,
        )
        if (isPro) {
            // Pro: route to the VS lobby for unlimited (any-mode) battles (web parity).
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))))
                    .clickableNoRipple(onPlayUnlimited).padding(vertical = 13.dp),
                Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords), null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Text("Play Unlimited VS", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
        } else {
            // Gold "Upgrade to Pro" CTA (web parity — links to the Pro page).
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))))
                    .clickableNoRipple(onGoPro).padding(vertical = 13.dp),
                Alignment.Center,
            ) {
                Text("Upgrade to Pro", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
        }
        Pill("Home") { onHome() }
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
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)).clickableNoRipple(onClose),
        Alignment.Center,
    ) {
        Column(
            Modifier.padding(horizontal = 24.dp).clip(RoundedCornerShape(20.dp))
                .background(WTheme.surface).clickableNoRipple { }
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Icon(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords), null,
                tint = WTheme.textMuted, modifier = Modifier.size(44.dp),
            )
            Text("Daily VS Used", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(
                "You've played your free daily VS match for today. Upgrade to Pro for unlimited ad-free battles and rematches, or come back tomorrow.",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
            )
            var tick by remember { mutableStateOf(0) }
            LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); tick++ } }
            @Suppress("UNUSED_EXPRESSION") tick
            val s = vsSecondsUntilLocalMidnight()
            Text(
                "Resets in ${"%02d:%02d:%02d".format(s / 3600, (s % 3600) / 60, s % 60)}",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.primary,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(WTheme.surfaceHover)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            )
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))))
                    .clickableNoRipple { onClose(); onGoPro() }.padding(vertical = 12.dp),
                Alignment.Center,
            ) {
                Text("Go Pro", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
            Text(
                "Maybe later", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                modifier = Modifier.clickableNoRipple(onClose),
            )
        }
    }
}

// ── Shared bits ────────────────────────────────────────────────────────────────
@Composable
private fun StatCard(title: String?, rows: List<Pair<String, String>>) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        title?.let { Text(it, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted) }
        rows.forEach { (k, v) ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(k, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                Text(v, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
            }
        }
    }
}

@Composable
private fun Pill(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(modifier.clip(RoundedCornerShape(50)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(50)).clickableNoRipple(onClick).padding(horizontal = 20.dp, vertical = 12.dp), Alignment.Center) {
        Text(text, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

@Composable
private fun GradientPill(text: String, gradient: List<Color>, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(modifier.clip(RoundedCornerShape(12.dp)).background(Brush.horizontalGradient(gradient)).clickableNoRipple(onClick).padding(horizontal = 20.dp, vertical = 12.dp), Alignment.Center) {
        Text(text, fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
    }
}

private fun fmtTime(ms: Double): String {
    val total = (ms / 1000).toInt()
    if (total < 60) return "${total}s"
    val m = total / 60; val s = total % 60
    return if (s > 0) "${m}m ${s}s" else "${m}m"
}
