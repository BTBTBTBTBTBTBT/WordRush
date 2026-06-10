package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Lightbulb
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
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess

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

/**
 * Horizontal shake for a rejected guess (spec: ±4px `4*sin(d*π*6)` linear 0.4s).
 * Re-fires whenever [shakeKey] changes. No-op under Reduced Motion.
 */
@Composable
internal fun Modifier.shakeOnReject(shakeKey: Int): Modifier {
    if (WTheme.reducedMotion) return this
    val anim = remember { androidx.compose.animation.core.Animatable(0f) }
    val amplitudePx = with(androidx.compose.ui.platform.LocalDensity.current) { 4.dp.toPx() }
    androidx.compose.runtime.LaunchedEffect(shakeKey) {
        if (shakeKey == 0) return@LaunchedEffect
        anim.snapTo(0f)
        anim.animateTo(1f, androidx.compose.animation.core.tween(400, easing = androidx.compose.animation.core.LinearEasing))
    }
    return this.graphicsLayer {
        translationX = amplitudePx * kotlin.math.sin(anim.value * Math.PI.toFloat() * 6f)
    }
}

/**
 * Hint pills (spec Part 2 Hints UI) — Six/Seven/ProperNoundle. Two pills
 * (Vowel/Consonant) between board and keyboard. Unused = accent text + accent@8%
 * bg + 1.5dp accent border; used = muted + #F3F4F6 + disabled. Label shows
 * "💡 Vowel" → "Vowel: X" or "No vowels left".
 */
@Composable
private fun HintPills(
    accent: Color,
    vowelUsed: Boolean, vowelRevealed: String?,
    consonantUsed: Boolean, consonantRevealed: String?,
    onVowel: () -> Unit, onConsonant: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        HintPill(
            accent = accent, used = vowelUsed,
            label = if (!vowelUsed) "💡 Vowel"
            else if (vowelRevealed == "—") "No vowels left" else "Vowel: $vowelRevealed",
            onClick = onVowel, modifier = Modifier.weight(1f),
        )
        HintPill(
            accent = accent, used = consonantUsed,
            label = if (!consonantUsed) "💡 Consonant"
            else if (consonantRevealed == "—") "No consonants left" else "Consonant: $consonantRevealed",
            onClick = onConsonant, modifier = Modifier.weight(1f),
        )
    }
}

/**
 * ProperNoundle hints (spec line 166) — 3 capsule pills Clue/Vowel/Consonant.
 * Clue #9333EA/#D8B4FE/#FAF5FF (lightbulb→hourglass), Vowel #2563EB/#93C5FD/#EFF6FF
 * (eye), Consonant #16A34A/#86EFAC/#F0FDF4 (number). Used = grey + disabled.
 */
@Composable
private fun ProperNoundleHints(
    clueUsed: Boolean, loadingClue: Boolean,
    vowelRevealed: String?, consonantRevealed: String?,
    onClue: () -> Unit, onVowel: () -> Unit, onConsonant: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        NoundlePill(
            label = "Clue",
            icon = if (loadingClue) Icons.Filled.HourglassEmpty else Icons.Filled.Lightbulb,
            used = clueUsed, text = Color(0xFF9333EA), border = Color(0xFFD8B4FE), bg = Color(0xFFFAF5FF),
            onClick = onClue, modifier = Modifier.weight(1f),
        )
        NoundlePill(
            label = vowelRevealed ?: "Vowel",
            icon = Icons.Filled.Visibility,
            used = vowelRevealed != null, text = Color(0xFF2563EB), border = Color(0xFF93C5FD), bg = Color(0xFFEFF6FF),
            onClick = onVowel, modifier = Modifier.weight(1f),
        )
        NoundlePill(
            label = consonantRevealed ?: "Consonant",
            icon = Icons.Filled.Tag,
            used = consonantRevealed != null, text = Color(0xFF16A34A), border = Color(0xFF86EFAC), bg = Color(0xFFF0FDF4),
            onClick = onConsonant, modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun NoundlePill(
    label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, used: Boolean,
    text: Color, border: Color, bg: Color, onClick: () -> Unit, modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(50))
            .background(if (used) Color.Transparent else bg)
            .border(1.5.dp, if (used) Color(0xFFE5E7EB) else border, androidx.compose.foundation.shape.RoundedCornerShape(50))
            .then(if (used) Modifier else Modifier.clickableNoRipple(onClick))
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = if (used) Color(0xFFD1D5DB) else text, modifier = Modifier.size(14.dp))
        Text(
            label, color = if (used) Color(0xFFD1D5DB) else text,
            fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1,
        )
    }
}

@Composable
private fun HintPill(accent: Color, used: Boolean, label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(10.dp))
            .background(if (used) Color(0xFFF3F4F6) else accent.copy(alpha = 0.08f))
            .border(1.5.dp, if (used) WTheme.border else accent, androidx.compose.foundation.shape.RoundedCornerShape(10.dp))
            .then(if (used) Modifier else Modifier.clickableNoRipple(onClick))
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (used) WTheme.textMuted else accent,
            fontSize = 13.sp, fontWeight = FontWeight.Black,
        )
    }
}

/**
 * Gauntlet 5-node stepper (spec line 102): done = green ✓, active = purple
 * (glow), future = number; connectors between nodes (green up to active).
 */
@Composable
private fun GauntletStepper(current: Int, total: Int) {
    val green = Color(0xFF22C55E)
    val purple = Color(0xFFA855F7)
    val gray = Color(0xFFD1D5DB)
    Row(verticalAlignment = Alignment.CenterVertically) {
        for (i in 0 until total) {
            val done = i < current
            val active = i == current
            val nodeColor = when { done -> green; active -> purple; else -> WTheme.surfaceAlt }
            Box(
                modifier = Modifier
                    .size(if (active) 26.dp else 22.dp)
                    .then(if (active) Modifier.shadow(8.dp, androidx.compose.foundation.shape.CircleShape, clip = false, spotColor = purple) else Modifier)
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(nodeColor)
                    .border(if (done || active) 0.dp else 1.5.dp, gray, androidx.compose.foundation.shape.CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (done) "✓" else "${i + 1}",
                    color = if (done || active) Color.White else WTheme.textMuted,
                    fontSize = if (active) 13.sp else 11.sp,
                    fontWeight = FontWeight.Black,
                )
            }
            if (i < total - 1) {
                Box(
                    Modifier.width(14.dp).height(2.dp)
                        .background(if (i < current) green else gray),
                )
            }
        }
    }
}

@Composable
fun GameScreen(mode: GameMode, title: String, seed: String, onBack: () -> Unit) {
    val vm: GameViewModel = viewModel(
        key = "game-$mode-$seed",
        factory = GameVMFactory(seed, mode),
    )
    val state by vm.state.collectAsState()
    val input by vm.currentInput.collectAsState()
    val elapsed by vm.elapsed.collectAsState()

    val multiBoard = state.boards.size > 1
    val isSequential = mode == GameMode.SEQUENCE
    // Quadrant keyboard for parallel multi-board modes (Quad/Octo/Deliverance); NOT Sequence.
    val useQuadrant = multiBoard && !isSequential
    val letterStates = if (isSequential) {
        // Sequence: keyboard colors from the ACTIVE board only (spec hot-spot #8).
        computeCombinedLetterStates(listOf(state.boards[state.currentBoardIndex]))
    } else {
        computeCombinedLetterStates(state.boards)
    }
    val perBoardStates = if (useQuadrant) computePerBoardLetterStates(state.boards) else null
    val isApplyToAll = multiBoard && !isSequential
    val isFinished = state.status != GameStatus.PLAYING

    // Two-phase finish (spec hot-spot #4): a game that finishes LIVE this session
    // shows the VictoryOverlay first, then taps through to the stats screen.
    // A game already finished on entry (resumed) skips straight to stats.
    val wasFinishedOnEntry = remember { state.status != GameStatus.PLAYING }
    var dismissedVictory by remember { mutableStateOf(false) }
    val showVictory = isFinished && !wasFinishedOnEntry && !dismissedVictory

    // XP pipeline (#88): record matches/user_stats/profile progression EXACTLY
    // once on a live finish, and surface the earned XP in a top toast. Resumed
    // games (finished on entry) are skipped — their deltas were never owed here.
    var recorded by rememberSaveable { mutableStateOf(false) }
    var xpResult by remember { mutableStateOf<com.wordocious.app.data.GameResultsService.XpResult?>(null) }
    LaunchedEffect(isFinished) {
        if (isFinished && !wasFinishedOnEntry && !recorded) {
            recorded = true
            xpResult = com.wordocious.app.data.GameResultsService.record(
                gameMode = mode,
                won = state.status == GameStatus.WON,
                guessCount = state.boards.first().guesses.size,
                timeSeconds = elapsed,
                boardsSolved = state.boards.count { it.status == GameStatus.WON },
                totalBoards = state.boards.size,
                seed = seed,
                solutions = state.boards.map { it.solution },
                guesses = state.boards.first().guesses,
                hintsUsed = vm.hintsUsed,
            )
        }
    }

    if (showVictory) {
        // Gauntlet only celebrates a WON run (web parity: a lost run goes
        // straight to the results screen, no overlay).
        if (mode != GameMode.GAUNTLET || state.status == GameStatus.WON) {
            Box(modifier = Modifier.fillMaxSize()) {
                VictoryOverlay(
                    state = state, mode = mode, elapsedSeconds = elapsed,
                    onContinue = { dismissedVictory = true },
                )
                xpResult?.let { XpToast(it) { xpResult = null } }
            }
            return
        }
    }

    // Show the stats / post-game screen
    if (isFinished) {
        Box(modifier = Modifier.fillMaxSize()) {
            PostGameScreen(
                state = state,
                mode = mode,
                seed = seed,
                elapsedSeconds = elapsed,
                hintsUsed = vm.hintsUsed,
                onBack = onBack,
            )
            xpResult?.let { XpToast(it) { xpResult = null } }
        }
        return
    }

    val accent = com.wordocious.app.ui.modeAccent(mode)
    Box(
        modifier = Modifier.fillMaxSize()
            .background(
                androidx.compose.ui.graphics.Brush.verticalGradient(
                    listOf(WTheme.bg, WTheme.surfaceHover), // #F8F7FF → #F3F0FF
                ),
            ),
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp)) {
            // Centered gradient mode title + progress + live clock (spec Part 2 Headers)
            val board0 = state.boards[0]
            Column(
                modifier = Modifier.fillMaxWidth().padding(top = 48.dp, bottom = 4.dp),
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
                Text(
                    com.wordocious.app.ui.modeTitle(mode),
                    // Web headers are text-3xl (30px) font-black.
                    fontSize = 30.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
                    style = androidx.compose.ui.text.TextStyle(
                        brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                            com.wordocious.app.ui.modeTitleGradient(mode),
                        ),
                    ),
                )
                Spacer(Modifier.height(2.dp))
                // Web header stat row: gap-3 spans (no "·" separators) — Trophy
                // (amber) solved count on multi modes, "{used}/{max} guesses",
                // Clock (blue) time. Gauntlet keeps its stage label.
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Daily ProperNoundle puzzle number (web "#{getDailyPuzzleNumber()}").
                    if (mode == GameMode.PROPERNOUNDLE && seed.startsWith("daily-")) {
                        Text(
                            "#${com.wordocious.core.ProperNoundle.dailyPuzzleNumber(com.wordocious.app.todayLocalDate())}",
                            color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        )
                    }
                    if (mode == GameMode.GAUNTLET) {
                        val sn = (state.gauntlet?.currentStage ?: 0) + 1
                        Text(
                            "Stage $sn / ${state.gauntlet?.totalStages ?: 5}",
                            color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        )
                    } else if (state.boards.size > 1) {
                        val solved = state.boards.count { it.status == GameStatus.WON }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                androidx.compose.material.icons.Icons.Filled.EmojiEvents, null,
                                tint = Color(0xFFD97706), modifier = Modifier.size(12.dp),
                            )
                            Spacer(Modifier.width(3.dp))
                            Text("$solved/${state.boards.size}", color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Text(
                        "${board0.guesses.size}/${board0.maxGuesses} guesses",
                        color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            androidx.compose.material.icons.Icons.Filled.Schedule, null,
                            tint = Color(0xFF60A5FA), modifier = Modifier.size(12.dp),
                        )
                        Spacer(Modifier.width(3.dp))
                        Text(fmtClock(elapsed), color = WTheme.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.Black)
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
                    currentBoardIndex = state.currentBoardIndex,
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
                letterStates = letterStates,
                onKey = { vm.typeLetter(it) },
                onDelete = { vm.deleteLetter() },
                onEnter = { vm.submit(applyToAll = isApplyToAll) },
                perBoardStates = perBoardStates,
            )

            Spacer(Modifier.height(8.dp))
        }

        // Corner Home button (top-left) — spec Part 2 Nav: 44dp circle, surface
        // fill, 2dp accent stroke, house icon, shadow. Visible in play + post-game.
        CornerHomeButton(accent = accent, onClick = onBack, modifier = Modifier.padding(8.dp))

        // Sound toggle (top-right) — web SoundToggle sits on every game header.
        SoundToggleButton(accent = accent, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))

        // Rejection toast — web: absolute @ top 90px, dark pill, white 12px bold
        // ("Not enough letters" / "Not in word list" / "Already guessed").
        val rejectMsg by vm.rejectMessage.collectAsState()
        rejectMsg?.let {
            Box(Modifier.fillMaxWidth().padding(top = 90.dp), contentAlignment = Alignment.TopCenter) {
                Text(
                    it, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(androidx.compose.foundation.shape.RoundedCornerShape(8.dp))
                        .background(Color(0xFF1A1A2E))
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                )
            }
        }
    }
}

/**
 * Web game/sound-toggle.tsx: 44px circle, surface fill, 2px accent stroke,
 * Volume2/VolumeX icon, active scale press. Persists to the same pref the
 * Settings "Sound Effects" switch uses.
 */
@Composable
internal fun SoundToggleButton(accent: Color, modifier: Modifier = Modifier) {
    var enabled by remember {
        mutableStateOf(com.wordocious.app.data.SettingsPref.get(com.wordocious.app.data.SettingsPref.SOUND, true))
    }
    val circle = androidx.compose.foundation.shape.CircleShape
    Box(
        modifier = modifier
            .size(44.dp)
            .shadow(4.dp, circle, clip = false)
            .clip(circle)
            .background(WTheme.surface)
            .border(2.dp, accent, circle)
            .clickableNoRipple {
                enabled = !enabled
                com.wordocious.app.data.SettingsPref.set(com.wordocious.app.data.SettingsPref.SOUND, enabled)
            },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            if (enabled) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff,
            contentDescription = if (enabled) "Mute sounds" else "Unmute sounds",
            tint = accent,
            modifier = Modifier.size(20.dp),
        )
    }
}

@Composable
private fun CornerHomeButton(accent: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val circle = androidx.compose.foundation.shape.CircleShape
    Box(
        modifier = modifier
            .size(44.dp)
            .shadow(4.dp, circle, clip = false)
            .clip(circle)
            .background(WTheme.surface)
            .border(2.dp, accent, circle)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            androidx.compose.material.icons.Icons.Filled.Home,
            contentDescription = "Home",
            tint = accent,
            modifier = Modifier.size(20.dp),
        )
    }
}

/**
 * Single-board — fills available space like the web's `max-w-[400px] max-h-full
 * aspect-ratio` board. Uses BoxWithConstraints to compute the largest board that
 * fits width AND height, then centres it. Font size scales with tile size.
 */
@Composable
internal fun SingleBoard(
    board: BoardState,
    currentGuess: String,
    isInvalid: Boolean = false,
    shakeKey: Int = 0,
    modifier: Modifier = Modifier,
) {
    val wordLen = board.solution.length
    val rows = board.maxGuesses
    val lastSubmittedRow = if (board.guesses.isNotEmpty()) board.guesses.size - 1 else -1

    BoxWithConstraints(modifier = modifier, contentAlignment = Alignment.Center) {
        // Max board width per web (400px ≈ 380dp accounting for padding)
        val maxBoardW = minOf(maxWidth, 380.dp)
        val maxBoardH = maxHeight

        // Board aspect ratio is wordLen:rows (each tile square)
        val ratio = wordLen.toFloat() / rows.toFloat()
        val fromWidth: Dp = maxBoardW
        val fromWidthH: Dp = fromWidth / ratio

        val (boardW, boardH) = if (fromWidthH <= maxBoardH) {
            fromWidth to fromWidthH
        } else {
            (maxBoardH * ratio) to maxBoardH
        }

        // Scale font size to tile height
        val gapTotal = 4.dp * (rows - 1)
        val tileHValue = (boardH.value - gapTotal.value) / rows
        val tileFontSp = (tileHValue * 0.44f).coerceIn(14f, 28f)

        Column(
            modifier = Modifier.size(boardW, boardH),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // Submitted rows
            for (rowIdx in 0 until board.guesses.size) {
                val guess = board.guesses[rowIdx]
                val eval = evaluateGuess(board.solution, guess)
                val isLastSubmitted = rowIdx == lastSubmittedRow
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    eval.tiles.forEachIndexed { col, tile ->
                        TileView(
                            letter = tile.letter,
                            state = tile.state,
                            flipDelay = if (isLastSubmitted) col * 150 else null,
                            flipDuration = 500, // web tile-flip 0.5s (full board)
                            fontSize = tileFontSp,
                            cornerRadius = 0.dp, // web single-board tiles are sharp-cornered
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            // Current input row — turns red + shakes on a rejected guess.
            if (board.guesses.size < board.maxGuesses && board.status == GameStatus.PLAYING) {
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth().shakeOnReject(shakeKey),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    for (col in 0 until wordLen) {
                        val letter = currentGuess.getOrNull(col)?.toString() ?: ""
                        TileView(
                            letter = letter,
                            state = TileState.EMPTY,
                            isInvalid = isInvalid && letter.isNotEmpty(),
                            fontSize = tileFontSp,
                            cornerRadius = 0.dp,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            // Empty rows
            val emptyStart = board.guesses.size + if (board.status == GameStatus.PLAYING) 1 else 0
            for (rowIdx in emptyStart until board.maxGuesses) {
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    repeat(wordLen) {
                        TileView(letter = "", state = TileState.EMPTY, fontSize = tileFontSp, cornerRadius = 0.dp, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
