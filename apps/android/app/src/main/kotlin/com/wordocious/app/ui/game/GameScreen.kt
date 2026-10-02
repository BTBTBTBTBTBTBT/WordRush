package com.wordocious.app.ui.game

import com.wordocious.app.ui.gameBackground
import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wordocious.app.GameViewModel
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameAction
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.createInitialState
import com.wordocious.core.evaluateGuess
import com.wordocious.core.gameReducer

/**
 * Full game screen — audit-then-match of the web game UI.
 *
 * Single-board (DUEL/DUEL_6/DUEL_7/PROPERNOUNDLE/TOURNAMENT):
 *   Board fills available space using BoxWithConstraints — same as the web's
 *   `w-full max-w-[400px] max-h-full aspect-ratio` approach.
 *
 * Multi-board (QUORDLE/OCTORDLE/SEQUENCE/RESCUE/GAUNTLET):
 *   MultiBoardLayout handles 2×2 / 4×2 grids with Sequence locking and
 *   OctoWord tap-to-zoom.
 *
 * Post-game: GameStatus.WON / LOST → PostGameScreen overlay.
 */
private class GameVMFactory(val seed: String, val mode: GameMode) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = GameViewModel(seed, mode) as T
}

/** Format elapsed seconds as M:SS for the game header. */
private fun fmtClock(secs: Int): String = "%d:%02d".format(secs / 60, secs % 60)

/** The header clock — the only thing that recomposes on the per-second tick. */
@Composable
private fun ClockText(elapsed: kotlinx.coroutines.flow.StateFlow<Int>, size: androidx.compose.ui.unit.TextUnit) {
    val secs by elapsed.collectAsState()
    Text(fmtClock(secs), color = WTheme.textMuted, fontSize = size, fontWeight = FontWeight.Bold)
}

/**
 * FINISH_SPEC B3 not a word: the row gives a small nudge (520 ms: −2 / +5 / −6 dp,
 * cubic-bezier(.36,.07,.19,.97)) while its letters turn red. Re-fires whenever
 * [shakeKey] changes. No-op under Reduced Motion.
 */
@Composable
internal fun Modifier.shakeOnReject(shakeKey: Int): Modifier {
    if (WTheme.reducedMotion) return this
    val anim = remember { androidx.compose.animation.core.Animatable(0f) }
    val density = androidx.compose.ui.platform.LocalDensity.current.density
    androidx.compose.runtime.LaunchedEffect(shakeKey) {
        if (shakeKey == 0) return@LaunchedEffect
        anim.snapTo(0f)
        anim.animateTo(0f, androidx.compose.animation.core.keyframes {
            durationMillis = TileMotion.NUDGE_MS
            val e = androidx.compose.animation.core.CubicBezierEasing(0.36f, 0.07f, 0.19f, 0.97f)
            0f at 0 using e
            -2f at (TileMotion.NUDGE_MS * 0.15f).toInt() using e
            5f at (TileMotion.NUDGE_MS * 0.30f).toInt() using e
            -6f at (TileMotion.NUDGE_MS * 0.45f).toInt() using e
            -6f at (TileMotion.NUDGE_MS * 0.55f).toInt() using e
            5f at (TileMotion.NUDGE_MS * 0.70f).toInt() using e
            -2f at (TileMotion.NUDGE_MS * 0.85f).toInt() using e
        })
    }
    return this.graphicsLayer { translationX = anim.value * density }
}

/**
 * Hint pills (spec Part 2 Hints UI) — Six/Seven/ProperNoundle. Two hints
 * (Vowel/Consonant) between board and keyboard. FINISH_SPEC A8: an unused hint
 * is a glossy candy button (vowel pink, consonant teal); a used one becomes a
 * tinted pill carrying "Vowel: X" / "No vowels left".
 */
// Non-private so the VS screen (ui.vs) can reuse the exact same pills for
// Six/Seven VS — parity by construction.
@Composable
fun HintPills(
    @Suppress("UNUSED_PARAMETER") accent: Color,
    vowelUsed: Boolean, vowelRevealed: String?,
    consonantUsed: Boolean, consonantRevealed: String?,
    onVowel: () -> Unit, onConsonant: () -> Unit,
) {
    Row(
        // iOS classicHintButtons: HStack(spacing: 12) inset 16pt. 16dp bottom
        // keeps the pills clear of the Q-row (fat-finger, Aug 11).
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HintCandy(
            label = "Vowel",
            usedLabel = if (vowelRevealed == "—") "No vowels left" else "Vowel: $vowelRevealed",
            used = vowelUsed, color = com.wordocious.app.ui.CandyColor.PINK, icon = Icons.Filled.Lightbulb,
            onClick = onVowel, modifier = Modifier.weight(1f), fill = true,
        )
        HintCandy(
            label = "Consonant",
            usedLabel = if (consonantRevealed == "—") "No consonants left" else "Consonant: $consonantRevealed",
            used = consonantUsed, color = com.wordocious.app.ui.CandyColor.TEAL, icon = Icons.Filled.Lightbulb,
            onClick = onConsonant, modifier = Modifier.weight(1f), fill = true,
        )
    }
}

/**
 * ProperNoundle hints (spec line 166) — Clue / Vowel / Consonant. FINISH_SPEC A8:
 * candy buttons sized to their labels and centered (Clue purple, Vowel pink,
 * Consonant teal); a used one becomes a tinted pill with the revealed letter.
 */
// Non-private so the VS screen (ui.vs) can reuse the exact same pills for
// ProperNoundle VS — parity by construction.
@Composable
fun ProperNoundleHints(
    clueUsed: Boolean, loadingClue: Boolean,
    vowelRevealed: String?, consonantRevealed: String?,
    onClue: () -> Unit, onVowel: () -> Unit, onConsonant: () -> Unit,
) {
    // iOS sizes each pill to its own label and centers the row; a pill SHRINKS when
    // its label collapses to the revealed letter.
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HintCandy(
            label = "Clue", usedLabel = "Clue used",
            used = clueUsed, color = com.wordocious.app.ui.CandyColor.PURPLE,
            icon = if (loadingClue) Icons.Filled.HourglassEmpty else Icons.Filled.Lightbulb,
            onClick = onClue,
        )
        HintCandy(
            label = "Vowel", usedLabel = vowelRevealed ?: "Vowel",
            used = vowelRevealed != null, color = com.wordocious.app.ui.CandyColor.PINK,
            icon = Icons.Filled.Visibility, onClick = onVowel,
        )
        HintCandy(
            label = "Consonant", usedLabel = consonantRevealed ?: "Consonant",
            used = consonantRevealed != null, color = com.wordocious.app.ui.CandyColor.TEAL,
            icon = Icons.Filled.Tag, onClick = onConsonant,
        )
    }
}

/** ProperNoundle category labels/colors — iOS ProperNoundleView.swift:4-13. */
internal val PN_CATEGORY_LABELS = mapOf(
    "music" to "Music", "videogames" to "Video Games", "movies" to "Movies & TV", "sports" to "Sports",
    "history" to "History", "science" to "Science", "currentevents" to "Current Events",
)
internal val PN_CATEGORY_COLORS = mapOf(
    "music" to Color(0xFFEC4899), "videogames" to Color(0xFF8B5CF6), "movies" to Color(0xFFF59E0B),
    "sports" to Color(0xFF10B981), "history" to Color(0xFF6366F1), "science" to Color(0xFF06B6D4),
    "currentevents" to Color(0xFFEF4444),
)

/** Theme-category capsule under the ProperNoundle title (iOS header parity). */
@Composable
internal fun PnCategoryPill(category: String) {
    Text(
        PN_CATEGORY_LABELS[category] ?: category,
        color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold,
        modifier = Modifier
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(50))
            .background(PN_CATEGORY_COLORS[category] ?: Color(0xFF7C3AED))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}



/**
 * Gauntlet 5-node stepper — 1:1 with iOS `gauntletStageNode` (GameScreen.swift
 * 330-347): a 20dp circle with a light tinted fill, a 2dp colored ring and a
 * colored glyph (✓ done / play active / number future), 16dp connectors, and a
 * pulsing halo on the active node (iOS StageGlow, 1.25s autoreversing).
 */
@Composable
fun GauntletStepper(current: Int, total: Int, modifier: Modifier = Modifier) {
    val glow = Color(0xFFA855F7)
    val pulse = if (WTheme.reducedMotion) 0f else {
        val transition = androidx.compose.animation.core.rememberInfiniteTransition(label = "stageGlow")
        transition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = androidx.compose.animation.core.infiniteRepeatable(
                androidx.compose.animation.core.tween(1250, easing = androidx.compose.animation.core.FastOutSlowInEasing),
                androidx.compose.animation.core.RepeatMode.Reverse,
            ),
            label = "stageGlowRadius",
        ).value
    }
    // iOS uses fixed 16pt connectors, but that only *just* fits between the
    // corner buttons on a ≥390pt iPhone — on a 360dp phone (most Samsungs)
    // the 5th node slid underneath the "?" button (Doug's screenshot). The
    // connectors shrink to whatever width keeps the whole stepper clear of
    // the corner-button gutters (44dp button + paddings ≈ 104dp each side).
    androidx.compose.foundation.layout.BoxWithConstraints(modifier) {
        val gutter = 104.dp
        val nodesW = (20 * total).dp + (4 * (total - 1)).dp // nodes + connector h-padding
        val connW = if (total > 1) {
            ((this.maxWidth - gutter * 2 - nodesW) / (total - 1)).coerceIn(6.dp, 16.dp)
        } else 16.dp
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.align(Alignment.Center)) {
        for (i in 0 until total) {
            val done = i < current
            val active = i == current
            // iOS draws the connector BEFORE node i, colored by node i's state.
            if (i > 0) {
                Box(
                    Modifier.padding(horizontal = 2.dp).width(connW).height(2.dp)
                        .background(
                            when {
                                done -> Color(0xFF8B5CF6)
                                active -> Color(0xFFD8B4FE)
                                else -> Color(0xFFE5E7EB)
                            },
                        ),
                )
            }
            val bg = when { done -> Color(0xFFEDE9FE); active -> Color(0xFFF3E8FF); else -> Color(0xFFF9FAFB) }
            val ring = when { done -> Color(0xFF8B5CF6); active -> Color(0xFFC084FC); else -> Color(0xFFE5E7EB) }
            val fg = when { done -> Color(0xFF6D28D9); active -> Color(0xFF9333EA); else -> Color(0xFF9CA3AF) }
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .then(
                        if (active) Modifier.shadow(
                            elevation = (3f + 5f * pulse).dp,
                            shape = androidx.compose.foundation.shape.CircleShape,
                            clip = false,
                            ambientColor = glow, spotColor = glow,
                        ) else Modifier,
                    )
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(bg)
                    .border(2.dp, ring, androidx.compose.foundation.shape.CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                when {
                    done -> com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.BADGE_CHECK, 14.dp)
                    active -> Icon(Icons.Filled.PlayArrow, null, tint = fg, modifier = Modifier.size(10.dp))
                    else -> Text("${i + 1}", color = fg, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
    }
}

/** Per-stage Gauntlet title gradient — mirrors iOS `gauntletStageGradient`. */
private fun gauntletStageGradient(name: String): List<Color> = when (name) {
    "QuadWord" -> listOf(Color(0xFFFACC15), Color(0xFFF472B6), Color(0xFFC084FC))
    "Succession" -> listOf(Color(0xFFFACC15), Color(0xFFFB923C), Color(0xFFF87171))
    "Deliverance" -> listOf(Color(0xFF818CF8), Color(0xFFC084FC), Color(0xFFE879F9))
    "OctoWord" -> listOf(Color(0xFF22D3EE), Color(0xFFC084FC), Color(0xFFF472B6))
    else -> listOf(Color(0xFFC084FC), Color(0xFFF472B6)) // The Opening / fallback
}

@Composable
fun GameScreen(mode: GameMode, title: String, seed: String, onBack: () -> Unit, onPlayAgain: (() -> Unit)? = null, onOpenDaily: ((GameMode) -> Unit)? = null, onOpenUnlimited: ((GameMode) -> Unit)? = null, onOpenLeaderboard: ((GameMode) -> Unit)? = null) {
    val vm: GameViewModel = viewModel(
        key = "game-$mode-$seed",
        factory = GameVMFactory(seed, mode),
    )
    val state by vm.state.collectAsState()
    val input by vm.currentInput.collectAsState()
    // The clock is NOT collected here (founder, 2026-09-29): reading it in this body
    // recomposed the whole game screen every second. ClockText subscribes on its own;
    // effects read vm.elapsed.value when they run; the finished views collect it below
    // (the ticker has stopped by then).

    // Active-play timer screen hooks (iOS GameScreen onAppear/onDisappear
    // parity): the VM is activity-scoped (no NavHost), so backing out to Home
    // does NOT clear it — pause on leave, rebase-resume on re-entry. App
    // background/foreground is handled by the VM's ProcessLifecycleOwner
    // observer (ON_STOP/ON_START).
    androidx.compose.runtime.DisposableEffect(vm) {
        vm.onScreenEnter()
        onDispose { vm.onScreenExit() }
    }

    val multiBoard = state.boards.size > 1
    // ProperNoundle row split ("Taylor Swift") — computed once, not on every keystroke recomposition.
    val pnWordGroups = remember(vm) { if (mode == GameMode.PROPERNOUNDLE) vm.pnPuzzle?.let { com.wordocious.core.ProperNoundle.wordGroups(it.display) } else null }
    // Sequence standalone OR the Gauntlet "Succession" stage. Read from the VM
    // so this can't drift from the activeBoardIndex it is paired with below —
    // when the two disagreed, every board rendered locked and the stage stalled.
    val isSequential = vm.isSequentialStage
    // Quadrant keyboard for parallel multi-board modes (Quad/Octo/Deliverance); NOT Sequence.
    val useQuadrant = multiBoard && !isSequential
    // Memoized on `state`: letter-states only change on submit (a new GameState),
    // but this composable recomposes on every keystroke (`input` above) — don't
    // rescan every board's guesses per keypress. isSequential/useQuadrant derive
    // from state + the stable `mode` param, so keying on state alone is exact.
    val letterStates = remember(state) {
        if (isSequential) {
            // Sequence: keyboard colors from the ACTIVE board only (spec hot-spot #8)
            // = the first still-PLAYING board (currentBoardIndex is never advanced).
            val active = state.boards.firstOrNull { it.status == GameStatus.PLAYING } ?: state.boards.last()
            computeCombinedLetterStates(listOf(active))
        } else {
            computeCombinedLetterStates(state.boards)
        }
    }
    val perBoardStatesNow = if (useQuadrant) remember(state) { computePerBoardLetterStates(state.boards) } else null
    // AQ1: each key takes its color as ITS tile lands (not after the whole row); a fast next
    // guess snaps the previous row in at once (Reduce Motion: at once).
    val reducedKeys = WTheme.reducedMotion
    val revealKey = remember(state) { state.boards.sumOf { it.guesses.size } }
    val newestRows = remember(state) { KeyReveal.newestRows(state.boards, isSequential) }
    val revealWidth = newestRows.maxOfOrNull { it.size } ?: 0
    val keyLetterStates = rememberTileByTile(letterStates, revealWidth, revealKey, reducedKeys) { base, n ->
        KeyReveal.during(base, letterStates, newestRows, n)
    }
    val perBoardStates = perBoardStatesNow?.let { now ->
        val boardRows = remember(state) {
            val newest = state.boards.maxOfOrNull { it.guesses.size } ?: 0
            state.boards.map { b -> if (newest > 0 && b.guesses.size == newest) KeyReveal.newestRows(listOf(b), false) else emptyList() }
        }
        rememberTileByTile(now, revealWidth, revealKey, reducedKeys) { base, n ->
            now.mapIndexed { i, target -> KeyReveal.during(base.getOrElse(i) { emptyMap() }, target, boardRows.getOrElse(i) { emptyList() }, n) }
        }
    }
    // ALL multi-board modes (incl. Sequence) apply each guess to every
    // still-PLAYING board — web sequence-game dispatches applyToAll:true and
    // iOS matches. The old !isSequential exception routed guesses to
    // currentBoardIndex, which nothing advances: Succession was unwinnable
    // past board 1 ("Not in word list" on every guess after the first solve).
    val isApplyToAll = multiBoard
    val isFinished = state.status != GameStatus.PLAYING

    // Two-phase finish (spec hot-spot #4): a game that finishes LIVE this session
    // shows the VictoryOverlay first, then taps through to the stats screen.
    // A game already finished on entry (resumed) skips straight to stats.
    val wasFinishedOnEntry = remember { state.status != GameStatus.PLAYING }
    var dismissedVictory by remember { mutableStateOf(false) }
    // vm.wasReplayed: a finish reconstructed from the server (daily completed on
    // another device) lands directly on PostGameScreen — no victory celebration.
    // FINISH_SPEC B3: a LIVE finish holds the board on screen while the final row
    // reveals and the win hop wave (or the loss sink) plays, THEN hands over to the
    // victory / result screens. Presentation only — the record pipeline below runs on
    // isFinished as before. Resumed, replayed and Reduce Motion finishes don't wait.
    var finishHoldDone by remember { mutableStateOf(false) }
    LaunchedEffect(isFinished) {
        if (isFinished && !wasFinishedOnEntry && !vm.wasReplayed && !finishHoldDone) {
            kotlinx.coroutines.delay(
                TileMotion.finishHoldMs(
                    tiles = state.boards.firstOrNull()?.solution?.length ?: 5,
                    won = state.status == GameStatus.WON,
                    multiBoard = state.boards.size > 1,
                    reduced = WTheme.reducedMotion,
                ).toLong(),
            )
            finishHoldDone = true
        }
    }
    val holdingFinishedBoard = isFinished && !wasFinishedOnEntry && !vm.wasReplayed && !finishHoldDone
    val showVictory = isFinished && !wasFinishedOnEntry && !dismissedVictory && !vm.wasReplayed && !holdingFinishedBoard

    // Game-start interstitial for free users (web AdGate / iOS parity). Shown
    // once per live game; the ad's duration is excluded from the game timer.
    var adGateDone by rememberSaveable { mutableStateOf(false) }
    val adActivity = androidx.compose.ui.platform.LocalContext.current as? android.app.Activity
    LaunchedEffect(Unit) {
        if (!adGateDone && !isFinished && adActivity != null && com.wordocious.app.data.AdsManager.active) {
            adGateDone = true
            val t0 = System.currentTimeMillis()
            com.wordocious.app.data.AdsManager.showGameStartInterstitial(adActivity) {
                vm.addPausedTime(System.currentTimeMillis() - t0)
            }
        } else {
            adGateDone = true
        }
    }

    // XP pipeline (#88): record matches/user_stats/profile progression EXACTLY
    // once on a live finish, and surface the earned XP in a top toast. Resumed
    // games (finished on entry) are skipped — their deltas were never owed here.
    // Keyed by SEED, not position: rememberSaveable's positional key let a
    // restored Activity hand a PREVIOUS game's saved `recorded=true` to a NEW
    // board composed at the same call site — the live-finish effect then
    // silently skipped record() with no queue entry and no telemetry (the
    // leading suspect for Doug's vanished DUEL daily: zero matches, zero
    // daily_results, zero pending payload, local save finished).
    var recorded by rememberSaveable(key = "recorded-$seed") { mutableStateOf(false) }
    var xpResult by remember { mutableStateOf<com.wordocious.app.data.GameResultsService.XpResult?>(null) }

    // Cross-device "view solved daily" fallback (iOS parity): the game starts
    // PLAYING with ZERO guesses on a daily seed (no local save), yet this mode's
    // daily was already recorded today (played on another device / local state
    // lost). Fetch the recorded matches row and replay its guesses through the
    // engine so the player sees the solved board instead of a fresh one. The
    // fresh board is briefly visible while the fetch is in flight — acceptable.
    val freshDailyOnEntry = remember {
        seed.startsWith("daily-") &&
            state.status == GameStatus.PLAYING &&
            state.boards.all { it.guesses.isEmpty() }
    }
    LaunchedEffect(Unit) {
        if (!freshDailyOnEntry || recorded) return@LaunchedEffect
        val playedToday = com.wordocious.app.data.DailyCompletionsService.readCache().containsKey(mode.name) ||
            com.wordocious.app.data.DailyCompletionsService.fetchTodayCompletions().containsKey(mode.name)
        if (!playedToday) return@LaunchedEffect
        // G6: the recorded row is usually already warmed in-session (prefetched
        // when DailyCompletionsService saw this mode played today) — instant
        // replay, no empty-board flash. Miss → network fetch, unchanged.
        val row = com.wordocious.app.data.GameResultsService.prefetchedDailyMatch(seed)
            ?: com.wordocious.app.data.GameResultsService.fetchRecordedDailyMatch(seed)
            ?: return@LaunchedEffect
        // Gauntlet: rebuild the finished run from the persisted per-stage
        // breakdown. player1_guesses only holds the FINAL stage, so the generic
        // guess-replay below can't reconstruct the earlier stages — gauntlet_stages
        // carries every stage's result + boardsSnapshot. iOS CompletedDailyCard parity.
        if (mode == GameMode.GAUNTLET) {
            val gs = com.wordocious.app.data.GameResultsService.fetchGauntletStages(seed)
            if (gs != null && gs.stages.isNotEmpty() && gs.stageResults.isNotEmpty()) {
                val runWon = gs.stageResults.size == gs.stages.size &&
                    gs.stageResults.all { it.status == GameStatus.WON }
                val lastResult = gs.stageResults.maxByOrNull { it.stageIndex }
                val base = createInitialState(seed, GameMode.GAUNTLET)
                val rebuilt = base.copy(
                    boards = lastResult?.boardsSnapshot?.takeIf { it.isNotEmpty() } ?: base.boards,
                    status = if (runWon) GameStatus.WON else GameStatus.LOST,
                    gauntlet = base.gauntlet?.copy(
                        currentStage = if (runWon) gs.stages.size else (lastResult?.stageIndex ?: 0),
                        totalStages = gs.stages.size,
                        stages = gs.stages,
                        stageResults = gs.stageResults,
                        allSolutions = emptyList(),
                    ),
                )
                recorded = true
                vm.installReplayedState(rebuilt, row.player1Time)
                return@LaunchedEffect
            }
            // No persisted breakdown (older row) → fall through to the best-effort
            // guess replay below.
        }
        if (row.player1Guesses.isEmpty()) return@LaunchedEffect
        var replayed = createInitialState(seed, mode)
        for (g in row.player1Guesses.take(200)) {
            if (replayed.status != GameStatus.PLAYING) break
            replayed = if (mode == GameMode.SEQUENCE) {
                // Web shape: flat per-board concatenation — each entry goes to
                // the first still-PLAYING board (use-game-snapshot parity).
                val idx = replayed.boards.indexOfFirst { it.status == GameStatus.PLAYING }
                if (idx < 0) break
                gameReducer(replayed, GameAction.SubmitGuess(g, boardIndex = idx, applyToAll = false))
            } else {
                // Recompute per guess: Gauntlet stages change board count
                // (stage 1 is single-board, later stages are multi).
                val applyAll = replayed.boards.size > 1
                gameReducer(replayed, GameAction.SubmitGuess(g, applyToAll = applyAll))
            }
            // Gauntlet: stage cleared but run not finished → advance (records
            // the won stage's result + boards snapshot, sets up the next
            // stage). iOS GauntletReconstruct (BoardView.swift) parity —
            // without this the replay stalls at stage 1.
            if (replayed.status == GameStatus.PLAYING && replayed.gauntlet != null &&
                replayed.boards.all { it.status == GameStatus.WON }
            ) {
                replayed = gameReducer(replayed, GameAction.NextStage(elapsedMs = null))
            }
        }
        // Only install a state that actually reached a finish — otherwise leave
        // the fresh board (replaying it live will record normally).
        if (replayed.status == GameStatus.PLAYING) return@LaunchedEffect
        // CRITICAL: wasFinishedOnEntry was captured with the ORIGINAL (fresh)
        // state, so the record effect below WOULD fire for this finish. Guard it
        // explicitly: mark recorded BEFORE installing (plus vm.wasReplayed).
        recorded = true
        vm.installReplayedState(replayed, row.player1Time)
    }

    // The record pipeline, callable from BOTH triggers below. Reads the
    // CURRENT state/vm when invoked, so a restored-finished game records the
    // same numbers a live finish would.
    val recordFinishedRun: suspend () -> Unit = {
            val g = state.gauntlet
            val isGauntletRun = mode == GameMode.GAUNTLET && g != null
            val rs = com.wordocious.app.data.GameResultsService.computeRunScore(state, mode)
            val runGuessList = when {
                isGauntletRun -> state.boards.flatMap { it.guesses } // web: final-stage flatMap
                mode == GameMode.SEQUENCE -> state.boards.flatMap { it.guesses } // web shape: per-board concatenation (its replayer feeds first-PLAYING board)
                else -> state.boards.maxByOrNull { it.guesses.size }?.guesses ?: emptyList() // longest board = full shared history
            }
            xpResult = com.wordocious.app.data.GameResultsService.record(
                gameMode = mode,
                won = rs.won,
                guessCount = rs.guessCount,
                timeSeconds = vm.elapsed.value,
                boardsSolved = rs.boardsSolved,
                totalBoards = rs.totalBoards,
                seed = seed,
                solutions = if (isGauntletRun) (g!!.allSolutions.ifEmpty { state.boards.map { it.solution } })
                    else state.boards.map { it.solution },
                guesses = runGuessList,
                hintsUsed = vm.hintsUsed,
                stagesCompleted = rs.stagesCompleted,
                bestCorrectLetters = rs.bestCorrectLetters,
            )
            // Persist the Gauntlet stage breakdown onto the just-inserted matches
            // row so the results screen renders cross-device (iOS/web parity).
            if (isGauntletRun) {
                com.wordocious.app.data.GameResultsService.recordGauntletStages(
                    seed = seed, stages = g!!.stages, stageResults = g.stageResults,
                )
            }
    }

    LaunchedEffect(isFinished) {
        if (isFinished && !wasFinishedOnEntry && !vm.wasReplayed && !recorded) {
            recorded = true
            // NonCancellable: the record flow used to run on THIS composition's
            // scope alone, so leaving the post-game (Home tap, "Next Daily",
            // leaderboard hop) canceled it mid-flight. A cancel landing after
            // the three primary writes but during the daily_results upsert was
            // swallowed as a plain Exception and never retried — Doug's DUEL:
            // local save completed, stats/match/XP recorded, no leaderboard
            // row. The writes are short and the retry queue still covers a
            // process kill; navigation must not abort them.
            kotlinx.coroutines.withContext(kotlinx.coroutines.NonCancellable) {
                recordFinishedRun()
            }
        }
    }

    // BACKFILL (Doug's lost OctoWord): a daily restored from local save in a
    // FINISHED state whose result never reached the server — the app was
    // killed between the finish and record(), so wasFinishedOnEntry blocks the
    // live-record effect above and NO pending payload exists to drain. Without
    // this, the result is silently lost forever: home shows the mode unplayed
    // while the board says finished.
    LaunchedEffect(Unit) {
        if (!wasFinishedOnEntry || vm.wasReplayed || recorded || !seed.startsWith("daily-")) return@LaunchedEffect
        if (com.wordocious.app.data.GameResultsService.fetchRecordedDailyMatch(seed) != null) {
            // The matches row landed — but the daily_results row is written
            // AFTER the three primary writes and can be lost on its own
            // (Doug's DUEL daily). Re-assert it from the finished local board:
            // recordDailyResult is an idempotent best-score upsert, a cheap
            // no-op when the row is already there, the missing leaderboard row
            // when it isn't.
            recorded = true
            val rs = com.wordocious.app.data.GameResultsService.computeRunScore(state, mode)
            kotlinx.coroutines.withContext(kotlinx.coroutines.NonCancellable) {
                com.wordocious.app.data.DailyResultsService.recordDailyResult(
                    mode = mode, completed = rs.won, guessCount = rs.guessCount,
                    elapsedSeconds = vm.elapsed.value, boardsSolved = rs.boardsSolved,
                    totalBoards = rs.totalBoards, hintsUsed = vm.hintsUsed, seed = seed,
                    stagesCompleted = rs.stagesCompleted, bestCorrectLetters = rs.bestCorrectLetters,
                )
            }
            return@LaunchedEffect
        }
        recorded = true
        kotlinx.coroutines.withContext(kotlinx.coroutines.NonCancellable) {
            recordFinishedRun()
        }
    }

    if (showVictory) {
        val elapsed by vm.elapsed.collectAsState()
        // Gauntlet only celebrates a WON run (web parity: a lost run goes
        // straight to the results screen, no overlay).
        if (mode != GameMode.GAUNTLET || state.status == GameStatus.WON) {
            // High-point review ask (WIN path only, never on loss): count the
            // win, then maybe show Play in-app review — 5+ wins, 14-day
            // cooldown, once per version, delayed past the confetti.
            if (state.status == GameStatus.WON) {
                val reviewCtx = androidx.compose.ui.platform.LocalContext.current
                LaunchedEffect(Unit) {
                    com.wordocious.app.data.RatingsPrompt.recordWin(reviewCtx)
                    (reviewCtx as? android.app.Activity)?.let {
                        com.wordocious.app.data.RatingsPrompt.maybeAsk(it)
                    }
                }
            }
            Box(modifier = Modifier.fillMaxSize()) {
                VictoryOverlay(
                    state = state, mode = mode,
                    // Gauntlet: the overlay celebrates the FINAL STAGE, so show the
                    // stage's time, not the whole run's (web parity: the last
                    // stageResult.timeMs feeds VictoryAnimation).
                    elapsedSeconds = if (mode == GameMode.GAUNTLET)
                        state.gauntlet?.stageResults?.lastOrNull()?.let { it.timeMs / 1000 } ?: elapsed
                    else elapsed,
                    // §242: unlimited games offer the next puzzle on the card
                    // (same seed-prefix + Pro gate as PostGameScreen's button).
                    onPlayAgain = if (onPlayAgain != null && seed.startsWith("unlimited-") &&
                        com.wordocious.app.data.AuthService.isProActive
                    ) ({ dismissedVictory = true; onPlayAgain() }) else null,
                    // The run's composite score — the same inputs the breakdown card uses.
                    points = run {
                        val rs = com.wordocious.app.data.GameResultsService.computeRunScore(state, mode)
                        com.wordocious.app.data.DailyScoring.breakdown(
                            mode.name, rs.won, rs.guessCount, elapsed, rs.boardsSolved, rs.totalBoards, vm.hintsUsed,
                            rs.stagesCompleted, rs.bestCorrectLetters, com.wordocious.core.getDailySeedDate(seed),
                        ).total.toInt()
                    },
                    onContinue = { dismissedVictory = true },
                )
                xpResult?.let { XpToast(it) { xpResult = null } }
            }
            return
        }
    }

    // Show the stats / post-game screen (after the finish hold, B3).
    if (isFinished && !holdingFinishedBoard) {
        val elapsed by vm.elapsed.collectAsState()
        // ProperNoundle: the revealed (redacted) Clue stays in the finished
        // header on iOS (ProperNoundleView.header shows vm.clue post-game too).
        val pnFinishedClue by vm.clue.collectAsState()
        Box(modifier = Modifier.fillMaxSize()) {
            PostGameScreen(
                state = state,
                mode = mode,
                seed = seed,
                elapsedSeconds = elapsed,
                hintsUsed = vm.hintsUsed,
                pnRevealedClue = if (mode == GameMode.PROPERNOUNDLE) pnFinishedClue else null,
                onBack = onBack,
                onPlayAgain = onPlayAgain,
                onOpenDaily = onOpenDaily,
                onOpenUnlimited = onOpenUnlimited,
                onOpenLeaderboard = onOpenLeaderboard,
            )
            xpResult?.let { XpToast(it) { xpResult = null } }
        }
        return
    }

    val accent = com.wordocious.app.ui.modeAccent(mode)
    var showGuide by remember { mutableStateOf(false) }
    // Gauntlet stage-cleared interstitial is up (see StageTransitionOverlay below).
    val stageCleared = mode == GameMode.GAUNTLET && state.gauntlet != null &&
        state.status == GameStatus.PLAYING && state.boards.isNotEmpty() &&
        state.boards.all { it.status == GameStatus.WON }
    Box(
        modifier = Modifier.fillMaxSize()
            // Physical keyboard (founder, 2026-09-30): A–Z / Enter / Backspace as the keys below.
            .hardwareKeys(enabled = !showGuide && !stageCleared) { k ->
                keyboardViewKeys(
                    onKey = { vm.typeLetter(it) },
                    onDelete = { vm.deleteLetter() },
                    onEnter = { vm.submit(applyToAll = isApplyToAll) },
                )(k)
            }
            // §19.1 the game's wallpaper behind the board; off a game context the old
            // #F8F7FF → #F3F0FF gradient.
            .gameBackground {
                background(
                    androidx.compose.ui.graphics.Brush.verticalGradient(
                        listOf(WTheme.bg, WTheme.surfaceHover), // #F8F7FF → #F3F0FF
                    ),
                )
            }
            // Keep content below the status bar. The gradient still paints
            // behind it (the inset is applied AFTER the background), but the
            // corner Home/? buttons were colliding with the clock and status
            // icons on a real device — targetSdk 35 draws under the status bar
            // on Android 15+ exactly as it does under the nav bar.
            .statusBarsPadding(),
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp)) {
            // Centered gradient mode title + progress + live clock (spec Part 2 Headers)
            val board0 = state.boards[0]
            // §19.3 header: the corner buttons keep their own top row and the title art
            // sits below it (GameHeaderTitle), the status line under the art, and the
            // board starts right after; Gauntlet keeps its stepper + stage name between
            // the corner buttons.
            Column(
                modifier = Modifier.fillMaxWidth().padding(top = if (mode == GameMode.GAUNTLET) 8.dp else 4.dp, bottom = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Gauntlet gets a 5-node stepper above the stage name (spec line 102).
                if (mode == GameMode.GAUNTLET) {
                    GauntletStepper(
                        current = state.gauntlet?.currentStage ?: 0,
                        total = state.gauntlet?.totalStages ?: 5,
                    )
                    Spacer(Modifier.height(6.dp))
                }
                // iOS titles the CURRENT STAGE in Gauntlet (gauntletHeader) and
                // draws ProperNoundle flat red at 24pt (ProperNoundleView header);
                // every other mode gets the 28pt gradient mode title.
                val stageName = state.gauntlet?.let { it.stages.getOrNull(it.currentStage)?.name }
                // The game's title art (ART_SPEC §10: lettering + host); Gauntlet keeps its
                // stage-name text with the host at its left (MASCOT_SPEC §5), static.
                com.wordocious.app.ui.HostedGameTitle(mode.name, art = mode != GameMode.GAUNTLET) {
                when {
                    mode == GameMode.GAUNTLET -> Text(
                        stageName ?: com.wordocious.app.ui.modeTitle(mode),
                        fontSize = 18.sp, fontWeight = FontWeight.Black,
                        style = androidx.compose.ui.text.TextStyle(
                            fontFamily = com.wordocious.app.ui.theme.Nunito,
                            brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                                gauntletStageGradient(stageName ?: ""),
                            ),
                        ),
                    )
                    mode == GameMode.PROPERNOUNDLE -> Text(
                        com.wordocious.app.ui.modeTitle(mode),
                        color = Color(0xFFDC2626),
                        fontSize = 24.sp, fontWeight = FontWeight.Black,
                    )
                    else -> Text(
                        com.wordocious.app.ui.modeTitle(mode),
                        fontSize = 28.sp, fontWeight = FontWeight.Black,
                        style = androidx.compose.ui.text.TextStyle(
                            fontFamily = com.wordocious.app.ui.theme.Nunito,
                            brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                                com.wordocious.app.ui.modeTitleGradient(mode),
                            ),
                        ),
                    )
                }
                }
                Spacer(Modifier.height(2.dp))
                // Header stat row — iOS `progressLabel` / `gauntletHeader`:
                // Gauntlet = trophy solved-count + guesses at 11pt; other
                // multi-board modes = ONE "x/n solved · u/m guesses" line (no
                // trophy — iOS reserves the amber trophy for Gauntlet).
                val statSp = if (mode == GameMode.GAUNTLET) 11.sp else 12.sp
                // iOS sizes the header glyphs a step below the text: 10pt in the
                // Gauntlet header, 11pt in the standard one. A flat 12dp made
                // both read a size larger than iOS next to the same numbers.
                val statIcon = if (mode == GameMode.GAUNTLET) 10.dp else 11.dp
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    val used = state.boards.maxOf { it.guesses.size }
                    if (mode == GameMode.PROPERNOUNDLE) {
                        // iOS ProperNoundleView header: category capsule, daily
                        // puzzle number, answer length — no guess counter.
                        vm.pnPuzzle?.themeCategory?.let { PnCategoryPill(it) }
                        if (seed.startsWith("daily-")) {
                            Text(
                                "#${com.wordocious.core.ProperNoundle.dailyPuzzleNumber(com.wordocious.app.todayLocalDate())}",
                                color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                            )
                            // §20 holiday title beside the number (Codebreaker/Crosswordocious parity).
                            com.wordocious.core.getDailySeedDate(seed)?.let { com.wordocious.core.ProperNoundle.holidayTitle(it) }?.let { Text(it, color = Color(0xFFDC2626), fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                        }
                        Text(
                            "${board0.solution.length} letters",
                            color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        )
                    } else if (mode == GameMode.GAUNTLET) {
                        if (state.boards.size > 1) {
                            val solved = state.boards.count { it.status == GameStatus.WON }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TROPHY, statIcon + 3.dp)
                                Spacer(Modifier.width(3.dp))
                                Text("$solved/${state.boards.size}", color = WTheme.textMuted, fontSize = statSp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Text(
                            "$used/${board0.maxGuesses} guesses",
                            color = WTheme.textMuted, fontSize = statSp, fontWeight = FontWeight.Bold,
                        )
                    } else if (state.boards.size > 1) {
                        val solved = state.boards.count { it.status == GameStatus.WON }
                        Text(
                            "$solved/${state.boards.size} solved · $used/${board0.maxGuesses} guesses",
                            color = WTheme.textMuted, fontSize = statSp, fontWeight = FontWeight.Bold,
                        )
                    } else {
                        Text(
                            "$used/${board0.maxGuesses} guesses",
                            color = WTheme.textMuted, fontSize = statSp, fontWeight = FontWeight.Bold,
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            androidx.compose.material.icons.Icons.Filled.Schedule, null,
                            tint = Color(0xFF60A5FA), modifier = Modifier.size(statIcon),
                        )
                        Spacer(Modifier.width(3.dp))
                        ClockText(vm.elapsed, statSp)
                    }
                }
                // ProperNoundle Clue text (italic, centered) once revealed (spec).
                if (mode == GameMode.PROPERNOUNDLE) {
                    val clueText by vm.clue.collectAsState()
                    clueText?.let {
                        Text(
                            it, color = WTheme.textSecondary, fontSize = 12.sp,
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 4.dp),
                        )
                    }
                }
            }

            // Board area — fills between header and keyboard
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            val invalid by vm.invalidWord.collectAsState()
            val shakeKey by vm.shakeKey.collectAsState()
            if (multiBoard) {
                MultiBoardLayout(
                    boards = state.boards,
                    currentGuess = input,
                    currentBoardIndex = vm.activeBoardIndex, // NOT state.currentBoardIndex — never advances
                    isSequential = isSequential,
                    isInvalid = invalid,
                    shakeKey = shakeKey,
                    modifier = Modifier.fillMaxSize().padding(4.dp),
                )
            } else {
                SingleBoard(
                    board = state.boards[0],
                    currentGuess = input,
                    isInvalid = invalid,
                    shakeKey = shakeKey,
                    modifier = Modifier.fillMaxSize(),
                    // ProperNoundle answers can be multi-word ("Taylor Swift") —
                    // iOS NoundleBoard splits the row on those word boundaries.
                    wordGroups = pnWordGroups,
                )
            }
        }

            // Hint pills — ProperNoundle = Clue/Vowel/Consonant capsules;
            // Six/Seven = Vowel/Consonant accent pills.
            if (vm.hasHints) {
                val vUsed by vm.vowelUsed.collectAsState()
                val cUsed by vm.consonantUsed.collectAsState()
                val vRev by vm.vowelRevealed.collectAsState()
                val cRev by vm.consonantRevealed.collectAsState()
                if (mode == GameMode.PROPERNOUNDLE) {
                    val clueText by vm.clue.collectAsState()
                    val loadingClue by vm.loadingClue.collectAsState()
                    ProperNoundleHints(
                        clueUsed = clueText != null || loadingClue, loadingClue = loadingClue,
                        vowelRevealed = vRev, consonantRevealed = cRev,
                        onClue = { vm.revealClue() }, onVowel = { vm.revealVowel() }, onConsonant = { vm.revealConsonant() },
                    )
                } else {
                    HintPills(
                        accent = accent,
                        vowelUsed = vUsed, vowelRevealed = vRev,
                        consonantUsed = cUsed, consonantRevealed = cRev,
                        onVowel = { vm.revealVowel() }, onConsonant = { vm.revealConsonant() },
                    )
                }
            }

            Spacer(Modifier.height(6.dp))

            KeyboardView(
                letterStates = keyLetterStates,
                onKey = { vm.typeLetter(it) },
                onDelete = { vm.deleteLetter() },
                onEnter = { vm.submit(applyToAll = isApplyToAll) },
                perBoardStates = perBoardStates,
            )

            Spacer(Modifier.height(8.dp))
        }

        // Corner Home button (top-left) — spec Part 2 Nav: 44dp circle, surface
        // fill, 2dp accent stroke, house icon, shadow. Visible in play + post-game.
        CornerHomeButton(accent = accent, onClick = onBack, modifier = Modifier.padding(GAME_CONTROLS_INSET))

        // Help "?" button (top-right corner) — opens this mode's strategy guide
        // and pauses the clock while it's open. iOS only shows a second corner
        // button (the sound toggle) in Gauntlet, so the help button only shifts
        // left there (GameScreen.swift:148).
        // B4: sound + help on the right of the controls row, in every game.
        CornerHelpButton(
            accent = accent,
            onClick = { showGuide = true; vm.pauseTimer() },
            modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET),
        )
        if (showGuide) {
            GuideSheet(mode = mode, onDismiss = { showGuide = false; vm.resumeTimer() })
        }

        // Gauntlet stage-transition interstitial (web stage-transition.tsx /
        // iOS stageCleared): shown the moment every board in the current stage
        // is won and the run is still live. Tapping (or, between stages, the
        // 2.5s auto-advance) dispatches NEXT_STAGE — which records the cleared
        // stage and either sets up the next stage or finishes the run. The
        // FINAL stage waits for a manual tap (StageTransitionOverlay gates its
        // auto-advance on `next != null`) so the run's finish isn't rushed.
        val gauntlet = state.gauntlet
        if (stageCleared && gauntlet != null) {
            StageTransitionOverlay(
                completed = gauntlet.stages[gauntlet.currentStage],
                next = gauntlet.stages.getOrNull(gauntlet.currentStage + 1),
                guessesSoFar = GauntletLook.guessesSoFar(gauntlet, state.boards),
            ) { vm.advanceGauntletStage() }
        }

        // Rejection toast — web: absolute @ top 90px, dark pill, white 12px bold
        // ("Not enough letters" / "Not in word list" / "Already guessed").
        val rejectMsg by vm.rejectMessage.collectAsState()
        rejectMsg?.let {
            Box(Modifier.fillMaxWidth().padding(top = 90.dp), contentAlignment = Alignment.TopCenter) {
                // FINISH_SPEC K1 / G5: the toast is a tinted pill in the reject red (a soft
                // wash, its line and a red top band) with dark-purple ink. FIXED ink on a
                // FIXED fill in both themes, so it never goes low-contrast in Dark.
                val shape = androidx.compose.foundation.shape.RoundedCornerShape(50)
                Text(
                    it, color = Color(0xFF2A1650), fontSize = 13.sp, fontWeight = FontWeight.Black,
                    modifier = Modifier
                        .shadow(6.dp, shape, clip = false, ambientColor = Color(0x33F0435F), spotColor = Color(0x33F0435F))
                        .clip(shape)
                        .background(Color(0xFFFFEEF1))
                        .drawWithContent {
                            drawContent()
                            drawRect(Color(0xFFF0435F), size = androidx.compose.ui.geometry.Size(size.width, 3.dp.toPx()))
                        }
                        .border(1.5.dp, Color(0xFFF8B4C0), shape)
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
        }
    }
}

/**
 * The game sound toggle (FINISH_SPEC A3 / B4: sound + help sit on the right of the
 * controls row in every game): the bare soft 3D sound icon, no bubble, squishing on
 * press. Persists to the same pref the Settings "Sound Effects" switch uses.
 */
@Composable
internal fun SoundToggleButton(@Suppress("UNUSED_PARAMETER") accent: Color, modifier: Modifier = Modifier) {
    var enabled by remember {
        mutableStateOf(com.wordocious.app.data.SettingsPref.get(com.wordocious.app.data.SettingsPref.SOUND, true))
    }
    com.wordocious.app.ui.HeaderCircle(
        onClick = {
            enabled = !enabled
            com.wordocious.app.data.SettingsPref.set(com.wordocious.app.data.SettingsPref.SOUND, enabled)
        },
        contentDescription = if (enabled) "Mute sounds" else "Unmute sounds",
        modifier = modifier,
        size = GAME_CORNER,
    ) {
        // Muted = faded + desaturated.
        com.wordocious.app.ui.Icon3D(
            com.wordocious.app.ui.Icon3DName.SOUND, com.wordocious.app.ui.SOFT_CONTROL_ICON,
            alpha = if (enabled) 1f else 0.4f,
            colorFilter = if (enabled) null else com.wordocious.app.ui.Icon3DMuted,
        )
    }
}

/** B4 the controls row sits tucked right under the status bar. */
internal val GAME_CONTROLS_INSET = 4.dp

/** The game controls' tap area (A3: a full 44 dp; the boards and titles are laid out around it). */
internal val GAME_CORNER = 44.dp

/**
 * The game's home control (top-left of the controls row, FINISH_SPEC A3 / B4): the
 * bare soft 3D home icon (`tab_home`), 23 dp, no bubble, squishing on press.
 * Visible in play + post-game. [accent] is kept for call-site parity.
 */
@Composable
internal fun CornerHomeButton(@Suppress("UNUSED_PARAMETER") accent: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    com.wordocious.app.ui.HeaderCircle(onClick, "Home", modifier, size = GAME_CORNER) {
        com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TAB_HOME, com.wordocious.app.ui.SOFT_CONTROL_ICON)
    }
}

/**
 * The right side of the game controls row (FINISH_SPEC B4): sound + help, both bare
 * soft 3D icons. Help opens the mode's guide (the caller pauses the clock).
 */
@Composable
internal fun CornerHelpButton(@Suppress("UNUSED_PARAMETER") accent: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        SoundToggleButton(accent)
        com.wordocious.app.ui.HeaderIconButton(
            com.wordocious.app.ui.Icon3DName.HELP, "How to play", onClick, size = GAME_CORNER,
        )
    }
}

/**
 * Single board — FINISH_SPEC B5: sized by the ONE shared rule ([BoardSizing.fitSquare]):
 * as wide as the space allows (a small side margin), square tiles, centered in the
 * height that is left. B3 motion: the last submitted row reveals (720 ms flips, 300 ms
 * apart, each landing with a glow); a rejected guess nudges and its red letters clear
 * right to left; a win hops the row in a wave and a loss sinks it once the reveal lands;
 * a fresh hint row glows gold.
 */
@Composable
internal fun SingleBoard(
    board: BoardState,
    currentGuess: String,
    isInvalid: Boolean = false,
    shakeKey: Int = 0,
    modifier: Modifier = Modifier,
    // ProperNoundle: per-word letter counts, so a multi-word name renders as
    // groups separated by a wider gap (iOS NoundleBoard). null = one flat row.
    // Trails `modifier` so existing positional callers keep compiling.
    wordGroups: List<Int>? = null,
    /** False on a static recap (the finished screen): no reveal / celebration replays. */
    animateLastRow: Boolean = true,
    /** FINISH_SPEC L the tray's accent (null = the game's tint, else Classic purple); false = no tray. */
    trayAccent: Color? = null,
    tray: Boolean = true,
) {
    val wordLen = board.solution.length
    val rows = board.maxGuesses
    val lastSubmittedRow = if (board.guesses.isNotEmpty()) board.guesses.size - 1 else -1
    val groups = wordGroups?.takeIf { it.size > 1 && it.sum() == wordLen }
    val playing = board.status == GameStatus.PLAYING
    // B3: the not-a-word clear keeps a ghost of the rejected letters while they go.
    val (shownGuess, clearOf) = rememberRejectClear(currentGuess, isInvalid, wordLen)
    val clearing = shownGuess != currentGuess
    // AQ1: each submitted row's evaluation once per board change (not on every keystroke).
    val rowEvals = remember(board) {
        board.guesses.indices.map { r -> board.hintEvaluations?.get(r.toString()) ?: evaluateGuess(board.solution, board.guesses[r]) }
    }

    val accent = trayAccent ?: com.wordocious.app.ui.LocalGameTint.current ?: Color(0xFF7C3AED)
    val trayState = when (board.status) {
        GameStatus.WON -> TrayState.WON
        GameStatus.LOST -> TrayState.LOST
        else -> TrayState.PLAYING
    }
    BoxWithConstraints(modifier = modifier, contentAlignment = Alignment.Center) {
        val gap = BOARD_TILE_GAP
        // Inter-word gaps are 14 dp where intra-word gaps are the tile gap (iOS NoundleBoard).
        val extraGroupGap = (WORD_GROUP_GAP - gap) * ((groups?.size ?: 1) - 1)
        // L: the tray's padding + lip come out of the space the tiles may use.
        val chromeW = if (tray) GameTrayStyle.PADDING.value * 2 else 0f
        val chromeH = if (tray) GameTrayStyle.PADDING.value * 2 + GameTrayStyle.LIP.value else 0f
        val fit = BoardSizing.fitSquare(
            availW = (maxWidth.value - chromeW).coerceAtLeast(0f), availH = (maxHeight.value - chromeH).coerceAtLeast(0f),
            cols = wordLen, rows = rows, gap = gap.value, extraWidth = extraGroupGap.value,
        )
        val tile = fit.cellW
        // Letter = 0.56 of the tile (game-kit.html), as a DP count: TileView converts it
        // through density WITHOUT the user's fontScale (the tile doesn't font-scale).
        val tileFontDp = (tile * 0.56f).coerceIn(4f, 40f)

        Box(if (tray) Modifier.gameTray(accent, trayState) else Modifier) {
        Column(
            modifier = Modifier.size(fit.width.dp, fit.height.dp),
            verticalArrangement = Arrangement.spacedBy(gap),
        ) {
            // Submitted rows
            for (rowIdx in 0 until board.guesses.size) {
                // Hint rows (Clue / vowel / consonant) carry a stored evaluation
                // keyed by row index — use it so the row paints as the faint hint
                // ghost instead of being re-evaluated into solid ABSENT tiles, and so
                // a revealed letter lands in its real slot.
                val hintEval = board.hintEvaluations?.get(rowIdx.toString())
                val eval = rowEvals[rowIdx]
                val isLastSubmitted = animateLastRow && rowIdx == lastSubmittedRow && hintEval == null
                val isFreshHint = animateLastRow && rowIdx == lastSubmittedRow && hintEval != null
                val celebrate = when {
                    !isLastSubmitted -> null
                    board.status == GameStatus.WON -> TileCelebration.HOP
                    board.status == GameStatus.LOST -> TileCelebration.SINK
                    else -> null
                }
                BoardRow(groups, wordLen, Modifier.weight(1f).fillMaxWidth()) { col ->
                    val t = eval.tiles.getOrNull(col)
                    val letter = t?.letter?.takeIf { it.isNotBlank() } ?: ""
                    TileView(
                        letter = letter,
                        state = t?.state ?: TileState.EMPTY,
                        flipDelay = if (isLastSubmitted || (isFreshHint && letter.isNotEmpty())) col * TileMotion.FLIP_STAGGER_MS else null,
                        fontSize = tileFontDp,
                        modifier = Modifier.weight(1f),
                        celebrate = celebrate,
                        celebrateDelay = TileMotion.revealMs(wordLen) +
                            col * (if (celebrate == TileCelebration.HOP) TileMotion.HOP_STAGGER_MS else 60),
                        hintGlow = isFreshHint && letter.isNotEmpty(),
                    )
                }
            }
            // Current input row — red + nudge on a rejected guess, then the clear.
            if (board.guesses.size < board.maxGuesses && playing) {
                BoardRow(groups, wordLen, Modifier.weight(1f).fillMaxWidth().shakeOnReject(shakeKey)) { col ->
                    val letter = shownGuess.getOrNull(col)?.toString() ?: ""
                    TileView(
                        letter = letter,
                        state = TileState.EMPTY,
                        isInvalid = (isInvalid || clearing) && letter.isNotEmpty(),
                        fontSize = tileFontDp,
                        modifier = Modifier.weight(1f),
                        clearProgress = clearOf(col),
                    )
                }
            }
            // Empty rows (frosted glass)
            val emptyStart = board.guesses.size + if (playing) 1 else 0
            for (rowIdx in emptyStart until board.maxGuesses) {
                BoardRow(groups, wordLen, Modifier.weight(1f).fillMaxWidth()) {
                    TileView(letter = "", state = TileState.EMPTY, fontSize = tileFontDp, modifier = Modifier.weight(1f))
                }
            }
        }
        }
    }
}

/** B1 the gap between board tiles (the mockup's 5 px at ~60 px tiles). */
internal val BOARD_TILE_GAP = 5.dp
/** ProperNoundle's gap between words. */
private val WORD_GROUP_GAP = 14.dp

/**
 * One board row of [count] tiles. When [groups] is non-null the tiles are split
 * into word groups laid out with a 14dp inter-word gap (iOS NoundleBoard);
 * otherwise it is one flat 4dp-spaced row.
 */
@Composable
private fun BoardRow(
    groups: List<Int>?,
    count: Int,
    modifier: Modifier = Modifier,
    tile: @Composable androidx.compose.foundation.layout.RowScope.(Int) -> Unit,
) {
    if (groups == null) {
        Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(BOARD_TILE_GAP)) {
            for (col in 0 until count) tile(col)
        }
        return
    }
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(WORD_GROUP_GAP)) {
        var start = 0
        for (len in groups) {
            val offset = start
            Row(
                modifier = Modifier.weight(len.toFloat()),
                horizontalArrangement = Arrangement.spacedBy(BOARD_TILE_GAP),
            ) {
                for (k in 0 until len) tile(offset + k)
            }
            start += len
        }
    }
}
