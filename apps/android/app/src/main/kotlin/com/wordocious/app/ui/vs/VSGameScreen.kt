package com.wordocious.app.ui.vs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableIntStateOf
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
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.game.KeyboardView
import com.wordocious.app.ui.game.MultiBoardLayout
import com.wordocious.app.ui.game.SingleBoard
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
fun VSGameScreen(mode: GameMode, isDaily: Boolean = false, inviteCode: String? = null, onHome: () -> Unit, onGoPro: () -> Unit) {
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
            VSScreen.QUEUE -> QueueScreen(label, gradient, vm.queuePosition, vm.message, ::goHome)
            VSScreen.MATCH -> MatchScreen(vm, label, gradient, ::goHome)
            VSScreen.WAITING -> WaitingScreen(vm, gradient, ::goHome)
            VSScreen.RESULT -> ResultScreen(vm, gradient, ::goHome)
            VSScreen.OPPONENT_LEFT -> OpponentLeft(::goHome)
            VSScreen.ALREADY_PLAYED_DAILY -> AlreadyPlayedDaily(vm.dailyAnswer, gradient, ::goHome)
        }

        vm.countdown?.let { CountdownOverlay(it, gradient) }
        if (vm.screen == VSScreen.RESULT) vm.xpResult?.let { XpToast(it) { vm.xpResult = null } }
    }
}

@Composable
private fun VsTitle(label: String, gradient: List<Color>, size: Int) {
    Text(label, fontSize = size.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.horizontalGradient(gradient)))
}

@Composable
private fun QueueScreen(label: String, gradient: List<Color>, position: Int, message: String?, onHome: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(22.dp)) {
        VsTitle(label, gradient, 36)
        CircularProgressIndicator(color = WTheme.primary)
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            CyclingStatus()
            Text("Position in queue: ${position + 1}", fontSize = 13.sp, color = WTheme.textMuted)
        }
        Pill("Cancel") { onHome() }
        message?.let { Text(it, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.clip(RoundedCornerShape(50)).background(WTheme.text.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 8.dp)) }
    }
}

@Composable
private fun CountdownOverlay(count: Int, gradient: List<Color>) {
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.6f)), Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("MATCH FOUND", fontSize = 15.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp, color = Color.White.copy(alpha = 0.7f))
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

    Column(Modifier.fillMaxSize().padding(horizontal = 10.dp)) {
        // Header: home button + VS title
        Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(34.dp).clip(CircleShape).background(WTheme.surface).border(1.5.dp, WTheme.border, CircleShape).clickableNoRipple(onHome), Alignment.Center) {
                Text("⌂", fontSize = 18.sp, color = WTheme.primary, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.weight(1f))
            VsTitle(label, gradient, 20)
            Spacer(Modifier.weight(1f))
            Spacer(Modifier.size(34.dp))
        }
        OpponentStrip(vm.opponent, game.maxGuesses, game.wordLength, Modifier.padding(top = 6.dp))

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
        KeyboardView(
            letterStates = letterStates,
            onKey = { game.typeLetter(it) },
            onDelete = { game.deleteLetter() },
            onEnter = { game.submit(applyToAll = useQuadrant) },
            perBoardStates = perBoardStates,
        )
        Spacer(Modifier.height(6.dp))
    }
}

private fun mode(vm: VSMatchViewModel) = vm.mode

@Composable
private fun WaitingScreen(vm: VSMatchViewModel, gradient: List<Color>, onHome: () -> Unit) {
    Column(Modifier.padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Text("Waiting for opponent…", fontSize = 30.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, style = TextStyle(brush = Brush.horizontalGradient(gradient)))
        CircularProgressIndicator(color = WTheme.primary)
        vm.game?.let { g ->
            StatCard("YOUR RESULT", listOf("Guesses" to "${g.rowsUsed}", "Time" to fmtTime(vm.playerTimeMs.toDouble())))
        }
        val rows = buildList {
            add("Guesses" to "${vm.opponent.attempts}")
            if (vm.opponent.totalBoards > 1) add("Boards Solved" to "${vm.opponent.boardsSolved}/${vm.opponent.totalBoards}")
        }
        StatCard("OPPONENT PROGRESS", rows)
        Pill("Leave") { onHome() }
    }
}

@Composable
private fun ResultScreen(vm: VSMatchViewModel, gradient: List<Color>, onHome: () -> Unit) {
    val winner = vm.result?.winner
    val isWin = winner == "player"; val isDraw = winner == "draw"
    val headline = if (isWin) "VICTORY" else if (isDraw) "DRAW" else "DEFEAT"
    val colors = if (isWin) listOf(Color(0xFF4ADE80), Color(0xFF6EE7B7))
    else if (isDraw) listOf(Color(0xFFFACC15), Color(0xFFFDBA74))
    else listOf(Color(0xFFF87171), Color(0xFFFDA4AF))
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Spacer(Modifier.height(40.dp)) }
        item { Text(headline, fontSize = 60.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.horizontalGradient(colors))) }
        item { Spacer(Modifier.height(22.dp)) }
        vm.result?.let { r ->
            item {
                StatCard(null, listOf(
                    "Your Guesses" to "${r.playerGuesses}", "Opponent Guesses" to "${r.opponentGuesses}",
                    "Your Time" to fmtTime(r.playerTime), "Opponent Time" to fmtTime(r.opponentTime),
                    "Your Score" to String.format("%.2f", r.playerScore), "Opponent Score" to String.format("%.2f", r.opponentScore),
                ))
            }
            item { Text("Score = guesses + time penalty (lower is better)", fontSize = 10.sp, color = WTheme.textMuted, modifier = Modifier.padding(top = 8.dp)) }
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
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Pill("Home", Modifier.weight(1f)) { onHome() }
                when (vm.rematch) {
                    RematchState.DECLINED -> Pill("No Rematch", Modifier.weight(1f)) {}
                    RematchState.OFFERED -> GradientPill("Waiting…", gradient, Modifier.weight(1f)) {}
                    RematchState.RECEIVED -> {}
                    RematchState.IDLE -> GradientPill("Rematch", gradient, Modifier.weight(1f)) { vm.offerRematch() }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
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
private fun AlreadyPlayedDaily(answer: String, gradient: List<Color>, onHome: () -> Unit) {
    Column(Modifier.padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("TODAY'S VS PUZZLE", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = WTheme.textMuted)
            Text("Already Played", fontSize = 32.sp, fontWeight = FontWeight.Black, style = TextStyle(brush = Brush.horizontalGradient(gradient)))
        }
        if (answer.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                answer.uppercase().forEach { ch ->
                    Box(Modifier.size(44.dp).clip(RoundedCornerShape(6.dp)).background(Brush.linearGradient(listOf(Color(0xFF22C55E), Color(0xFF16A34A)))), Alignment.Center) {
                        Text(ch.toString(), fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }
            }
        }
        Text("Upgrade to Pro for unlimited VS matches, rematches, and ad-free battles.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary, textAlign = TextAlign.Center)
        Pill("Home") { onHome() }
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
