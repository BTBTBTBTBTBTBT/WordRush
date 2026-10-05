package com.wordocious.app.ui.game

import androidx.compose.ui.graphics.drawscope.inset
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
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.foundation.layout.offset
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
    // BI22: two equal fixed halves of a centered row (max 360 dp), so "Vowel" → "Vowel: A" /
    // "No consonants left" never resizes a pill or moves the other.
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
    Row(
        // iOS classicHintButtons: HStack(spacing: 12) inset 16pt. 16dp bottom
        // keeps the pills clear of the Q-row (fat-finger, Aug 11).
        modifier = Modifier.widthIn(max = 360.dp).fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 12.dp),
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
    // BI22: three equal fixed thirds of a centered row (max 420 dp) — a pill no longer
    // shrinks when its label collapses to the revealed letter, so nothing in the row moves.
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
    Row(
        modifier = Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HintCandy(
            // Doug 10-05: "Clue used" clipped to "Clue u…" in a third of the row; web/iOS keep "Clue".
            label = "Clue", usedLabel = "Clue",
            used = clueUsed, color = com.wordocious.app.ui.CandyColor.PURPLE,
            icon = if (loadingClue) Icons.Filled.HourglassEmpty else Icons.Filled.Lightbulb,
            onClick = onClue, modifier = Modifier.weight(1f), fill = true,
        )
        HintCandy(
            label = "Vowel", usedLabel = vowelRevealed ?: "Vowel",
            used = vowelRevealed != null, color = com.wordocious.app.ui.CandyColor.PINK,
            icon = Icons.Filled.Visibility, onClick = onVowel, modifier = Modifier.weight(1f), fill = true,
        )
        HintCandy(
            label = "Consonant", usedLabel = consonantRevealed ?: "Consonant",
            used = consonantRevealed != null, color = com.wordocious.app.ui.CandyColor.TEAL,
            icon = Icons.Filled.Tag, onClick = onConsonant, modifier = Modifier.weight(1f), fill = true,
        )
    }
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
 * The Gauntlet header geometry (night art 10-03): `art_gauntlet_header` — the GAUNTLET lettering
 * over a gold track of five silver sockets — with a medallion per stage set into its socket.
 * Socket centers + diameters from docs/design/brand/gauntlet/header-slots.json (x, d: fractions of
 * the header WIDTH; y: of its HEIGHT). Mirrors web lib/gauntlet-header.ts + iOS GauntletHeaderSpec.
 */
object GauntletHeaderSpec {
    enum class Medal { CLEARED, CURRENT, LOCKED }

    /** art_gauntlet_header's aspect (1200 × 416). */
    const val ASPECT = 1200f / 416f
    /** It takes the old stepper row + the stage-title row, so the boards don't move. */
    const val HEIGHT = 52f
    const val MEDAL_SCALE = 1.18f
    const val NUMERAL_SCALE = 0.5f
    /** (x, y, d) per socket. */
    val SLOTS: List<FloatArray> = listOf(
        floatArrayOf(0.1193f, 0.7678f, 0.1343f),
        floatArrayOf(0.3115f, 0.7693f, 0.1327f),
        floatArrayOf(0.5016f, 0.7693f, 0.1327f),
        floatArrayOf(0.6914f, 0.7701f, 0.1332f),
        floatArrayOf(0.8826f, 0.7701f, 0.1332f),
    )

    fun medals(stageCount: Int, current: Int, cleared: Set<Int>): List<Medal> =
        (0 until stageCount).map { if (it in cleared) Medal.CLEARED else if (it == current) Medal.CURRENT else Medal.LOCKED }

    fun label(current: Int, stageCount: Int, stageName: String): String =
        "Gauntlet, stage ${minOf(current + 1, stageCount)} of $stageCount, $stageName"
}

/**
 * The Gauntlet header (night art 10-03; was a row of code-drawn 20 dp nodes with a forever-pulsing
 * halo + an 18 sp stage title): the art header with a medallion in each socket — cleared (gold +
 * star), current (orange, white stage numeral with a soft orange shadow) and locked (silver, slate
 * numeral) — so "stage 3 of 5" reads at a glance. 52 dp tall: it takes the old stepper + title
 * rows. The current medallion scales in once when its stage starts (graphicsLayer transform only);
 * nothing loops. `cleared` = the stages with a result (defaults to every stage before `current`).
 */
@Composable
fun GauntletStepper(
    current: Int,
    total: Int,
    modifier: Modifier = Modifier,
    cleared: Set<Int> = (0 until current).toSet(),
    stageName: String = "",
) {
    val h = GauntletHeaderSpec.HEIGHT.dp
    val w = h * GauntletHeaderSpec.ASPECT
    val medals = GauntletHeaderSpec.medals(total, current, cleared)
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Box(
            Modifier.size(w, h).semantics(mergeDescendants = false) {
                contentDescription = GauntletHeaderSpec.label(current, total, stageName)
            },
        ) {
            androidx.compose.foundation.Image(
                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.art_gauntlet_header),
                contentDescription = null, modifier = Modifier.matchParentSize(),
            )
            medals.take(GauntletHeaderSpec.SLOTS.size).forEachIndexed { i, medal ->
                val slot = GauntletHeaderSpec.SLOTS[i]
                val side = w * (slot[2] * GauntletHeaderSpec.MEDAL_SCALE)
                androidx.compose.runtime.key(i, medal) {
                    GauntletMedal(
                        index = i, medal = medal, side = side,
                        modifier = Modifier.offset(x = w * slot[0] - side / 2, y = h * slot[1] - side / 2),
                    )
                }
            }
        }
    }
}

@Composable
private fun GauntletMedal(index: Int, medal: GauntletHeaderSpec.Medal, side: androidx.compose.ui.unit.Dp, modifier: Modifier) {
    val res = when (medal) {
        GauntletHeaderSpec.Medal.CLEARED -> com.wordocious.app.R.drawable.art_gauntlet_medal_cleared
        GauntletHeaderSpec.Medal.CURRENT -> com.wordocious.app.R.drawable.art_gauntlet_medal_current
        GauntletHeaderSpec.Medal.LOCKED -> com.wordocious.app.R.drawable.art_gauntlet_medal_locked
    }
    val animate = medal == GauntletHeaderSpec.Medal.CURRENT && !WTheme.reducedMotion
    val scale = remember { androidx.compose.animation.core.Animatable(if (animate) 0.55f else 1f) }
    if (animate) {
        androidx.compose.runtime.LaunchedEffect(Unit) {
            scale.animateTo(1f, androidx.compose.animation.core.spring(dampingRatio = 0.55f, stiffness = 420f))
        }
    }
    Box(
        modifier.size(side).graphicsLayer { scaleX = scale.value; scaleY = scale.value },
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.Image(
            androidx.compose.ui.res.painterResource(res), contentDescription = null, modifier = Modifier.matchParentSize(),
        )
        if (medal != GauntletHeaderSpec.Medal.CLEARED) {
            val current = medal == GauntletHeaderSpec.Medal.CURRENT
            Text(
                "${index + 1}",
                fontSize = (side.value * GauntletHeaderSpec.NUMERAL_SCALE).sp,
                fontWeight = FontWeight.Black,
                style = androidx.compose.ui.text.TextStyle(
                    fontFamily = com.wordocious.app.ui.theme.Nunito,
                    color = if (current) Color.White else Color(0xFF64748B),
                    shadow = androidx.compose.ui.graphics.Shadow(
                        color = if (current) Color(0xBFC2410C) else Color(0x99FFFFFF),
                        offset = androidx.compose.ui.geometry.Offset(0f, 2f),
                        blurRadius = if (current) 3f else 0f,
                    ),
                ),
            )
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
    // Where the candy feedback toast sits: the header stat row under the title art.
    val feedbackAnchor = remember { FeedbackAnchor() }
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

    // Perf (2026-10-02 measured audit): the stage card's big cast pose (StageTransitionOverlay →
    // SceneArtPop, 132 dp) was decoded on the main thread in the card's first frame, right as it
    // springs in. Decode the run's poses into the shared art cache off the main thread while
    // stage 1 is played, so every card's first frame is ready.
    if (mode == GameMode.GAUNTLET) {
        val poseCtx = androidx.compose.ui.platform.LocalContext.current
        val posePx = with(androidx.compose.ui.platform.LocalDensity.current) { (132.dp * 1.6f).roundToPx() }
        LaunchedEffect(Unit) {
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                val bucket = com.wordocious.app.ui.ArtBitmaps.bucketPx(posePx.coerceAtLeast(1))
                listOf(2, 3, 4, 5, null).forEach { n ->
                    val pose = GauntletLook.stagePose(n)
                    val res = com.wordocious.app.ui.CastPoses.res(pose.mascot, pose.pose) ?: pose.mascot.res
                    runCatching { com.wordocious.app.ui.ArtBitmaps.get(poseCtx, res, bucket) }
                }
            }
        }
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
    val keyLetterStates = rememberTileByTile(letterStates, revealWidth, revealKey, reducedKeys, mini = multiBoard) { base, n ->
        KeyReveal.during(base, letterStates, newestRows, n)
    }
    val perBoardStates = perBoardStatesNow?.let { now ->
        val boardRows = remember(state) {
            val newest = state.boards.maxOfOrNull { it.guesses.size } ?: 0
            state.boards.map { b -> if (newest > 0 && b.guesses.size == newest) KeyReveal.newestRows(listOf(b), false) else emptyList() }
        }
        rememberTileByTile(now, revealWidth, revealKey, reducedKeys, mini = multiBoard) { base, n ->
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
    // FINISH_SPEC BJ2: the win / lose card's art is decoded off main during the finish hold.
    if (isFinished) {
        val warmCtx = androidx.compose.ui.platform.LocalContext.current
        val warmDensity = androidx.compose.ui.platform.LocalDensity.current.density
        val warmWidth = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp
        LaunchedEffect(Unit) { FinishMotion.prewarm(warmCtx, warmDensity, warmWidth) }
    }

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
    // BI22: the full ProperNoundle clue card (opened from the two-line clue slot).
    var showClueCard by remember { mutableStateOf(false) }
    var clueTopPx by remember { androidx.compose.runtime.mutableFloatStateOf(0f) }
    // Gauntlet stage-cleared interstitial is up (see StageTransitionOverlay below).
    var stageSkip by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    val stageCleared = mode == GameMode.GAUNTLET && state.gauntlet != null &&
        state.status == GameStatus.PLAYING && state.boards.isNotEmpty() &&
        state.boards.all { it.status == GameStatus.WON }
    Box(
        modifier = Modifier.fillMaxSize()
            // Physical keyboard (founder, 2026-09-30): A–Z / Enter / Backspace as the keys below.
            .hardwareKeys(enabled = !showGuide) { k ->
                // AU3: while the stage card is up, Enter skips it (other keys do nothing).
                if (stageCleared) {
                    if (k == HwKey.Enter) stageSkip++
                    return@hardwareKeys true
                }
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
                // Gauntlet: the art header with its stage medallions (night art 10-03) in place of
                // the old stepper + stage-title rows; the stage name leads the status line below.
                if (mode == GameMode.GAUNTLET) {
                    val g = state.gauntlet
                    GauntletStepper(
                        current = g?.currentStage ?: 0,
                        total = g?.totalStages ?: 5,
                        cleared = g?.stageResults?.map { it.stageIndex }?.toSet() ?: emptySet(),
                        stageName = g?.let { it.stages.getOrNull(it.currentStage)?.name } ?: "",
                    )
                }
                // iOS titles the CURRENT STAGE in Gauntlet (gauntletHeader) and
                // draws ProperNoundle flat red at 24pt (ProperNoundleView header);
                // every other mode gets the 28pt gradient mode title.
                val stageName = state.gauntlet?.let { it.stages.getOrNull(it.currentStage)?.name }
                // The game's title art (ART_SPEC §10: lettering + host). Gauntlet's title is its art
                // header above (the stage name rides the status line).
                if (mode != GameMode.GAUNTLET) com.wordocious.app.ui.HostedGameTitle(mode.name, art = true) {
                when {
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
                Row(Modifier.feedbackAnchor(feedbackAnchor), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
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
                        Text(
                            stageName ?: com.wordocious.app.ui.modeTitle(mode),
                            fontSize = 13.sp, fontWeight = FontWeight.Black, maxLines = 1,
                            style = androidx.compose.ui.text.TextStyle(
                                fontFamily = com.wordocious.app.ui.theme.Nunito,
                                brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                                    gauntletStageGradient(stageName ?: ""),
                                ),
                            ),
                        )
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
                // ProperNoundle Clue (italic, centered) — BI22: a fixed three/four-line slot that is
                // ALWAYS present (empty until the Clue is used), so revealing the clue never
                // shrinks the board; tap it for the whole clue as an overlay card.
                if (mode == GameMode.PROPERNOUNDLE) {
                    val clueText by vm.clue.collectAsState()
                    val loadingClue by vm.loadingClue.collectAsState()
                    ProperNoundleClueSlot(clueText, loadingClue, onOpen = { showClueCard = true }, onPlaced = { clueTopPx = it })
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
        // The run's clock pauses while the stage card is up (recorded stage / run times exclude it).
        LaunchedEffect(stageCleared) { if (stageCleared) vm.pauseTimer() else vm.resumeTimer() }
        if (stageCleared && gauntlet != null) {
            StageTransitionOverlay(
                completed = gauntlet.stages[gauntlet.currentStage],
                next = gauntlet.stages.getOrNull(gauntlet.currentStage + 1),
                guessesSoFar = GauntletLook.guessesSoFar(gauntlet, state.boards),
                skipSignal = stageSkip,
            ) { stageSkip = 0; vm.advanceGauntletStage() }
        }

        // Rejection toast ("Not enough letters" / "Not in word list" / "Already guessed"):
        // the shared candy feedback toast (coral coin + shake), centered on the header
        // stat row under the title art — never over the art or the board.
        val rejectMsg by vm.rejectMessage.collectAsState()
        GameFeedbackToast(rejectMsg, fallbackTop = 90.dp, anchor = feedbackAnchor)

        // BI22 the whole ProperNoundle clue, over the game (the header slot shows three or four lines).
        if (showClueCard && mode == GameMode.PROPERNOUNDLE) {
            val clueText by vm.clue.collectAsState()
            clueText?.let { ProperNoundleClueOverlay(it, anchorTopPx = clueTopPx) { showClueCard = false } }
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
            com.wordocious.app.ui.Icon3DName.SOUND, GAME_CORNER_ICON,
            alpha = if (enabled) 1f else 0.4f,
            colorFilter = if (enabled) null else com.wordocious.app.ui.Icon3DMuted,
        )
    }
}

/** B4 the controls row sits tucked right under the status bar. */
internal val GAME_CONTROLS_INSET = 4.dp

/** The game controls' tap area (AX: 48 dp; the boards and titles are laid out around it). */
internal val GAME_CORNER = 48.dp

/** AX (founder 10-02: "they're really tiny") the home / sound / ? icons' visual size (was 23 dp). */
internal val GAME_CORNER_ICON = 30.dp

/**
 * The game's home control (top-left of the controls row, FINISH_SPEC A3 / B4): the
 * bare soft 3D home icon (`tab_home`), 23 dp, no bubble, squishing on press.
 * Visible in play + post-game. [accent] is kept for call-site parity.
 */
@Composable
internal fun CornerHomeButton(@Suppress("UNUSED_PARAMETER") accent: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    // AY: inside an app layer the home button goes to the Home ROOT (MainScreen's router),
    // single-fire; elsewhere it falls back to the screen's own action.
    val goHome = com.wordocious.app.ui.LocalGoHome.current ?: onClick
    com.wordocious.app.ui.HeaderCircle(goHome, "Home", modifier, size = GAME_CORNER) {
        com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.TAB_HOME, GAME_CORNER_ICON)
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
            com.wordocious.app.ui.Icon3DName.HELP, "How to play", onClick, size = GAME_CORNER, iconSize = GAME_CORNER_ICON,
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
                if (groups == null) {
                    // BJ14: an unplayed row is ONE Canvas (the same drawGameTile paint as
                    // TileView's empty face), not wordLen animated TileView composables.
                    EmptyTileRow(wordLen, Modifier.weight(1f).fillMaxWidth())
                } else {
                    BoardRow(groups, wordLen, Modifier.weight(1f).fillMaxWidth()) {
                        TileView(letter = "", state = TileState.EMPTY, fontSize = tileFontDp, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
        }
    }
}

/**
 * FINISH_SPEC BJ14: a row of [count] EMPTY tiles in one Canvas — the geometry of a
 * [BoardRow] of square TileViews ([BOARD_TILE_GAP] apart, top-aligned), painted with
 * the same [drawGameTile] look.
 */
@Composable
private fun EmptyTileRow(count: Int, modifier: Modifier = Modifier) {
    val look = TileLooks.of(TileFace.EMPTY, WTheme.colorblind, WTheme.isDark)
    androidx.compose.foundation.Canvas(modifier) {
        val gap = BOARD_TILE_GAP.toPx()
        val cellW = (size.width - gap * (count - 1)) / count
        val tileH = minOf(cellW, size.height)
        for (col in 0 until count) {
            val left = col * (cellW + gap)
            inset(left, 0f, size.width - left - cellW, size.height - tileH) { drawGameTile(look) }
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
