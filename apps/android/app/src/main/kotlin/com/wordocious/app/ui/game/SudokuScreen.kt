package com.wordocious.app.ui.game

import android.app.Activity
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AchievementService
import com.wordocious.app.data.AdsManager
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.GameResultsService
import com.wordocious.app.data.RatingsPrompt
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.data.ShareImage
import com.wordocious.app.data.SoundManager
import com.wordocious.app.todayLocalDate
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.formatGuessStat
import com.wordocious.app.ui.formatShortTime
import com.wordocious.app.ui.pressScale
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.SUDOKU_MAX_MISTAKES
import com.wordocious.core.SudokuAction
import com.wordocious.core.SudokuDifficulty
import com.wordocious.core.SudokuSnapshot
import com.wordocious.core.SudokuState
import com.wordocious.core.SudokuStatus
import com.wordocious.core.generateSudoku
import com.wordocious.core.sudokuDailyNumber
import com.wordocious.core.sudokuDifficultyForSeed
import com.wordocious.core.sudokuMatchRow
import com.wordocious.core.sudokuReduce
import com.wordocious.core.sudokuRemaining
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Daily Sudoku (More Games §4) — the Android twin of components/sudoku/* and
// SudokuView.swift. One fixed Medium puzzle a day generated on the device from
// the daily seed; Pro Unlimited picks Easy / Medium / Hard. Three wrong digits
// lose; hints fill a cell and cost score but never a mistake. guess_count =
// mistakes + 1.

private val SUDOKU_ACCENT = Color(0xFF1E40AF)
private val DIFFICULTY_LABEL = mapOf(SudokuDifficulty.EASY to "Easy", SudokuDifficulty.MEDIUM to "Medium", SudokuDifficulty.HARD to "Hard")

// ── Session (state holder: reducer, clock, save, recording) ─────────────────

class SudokuSession(val seed: String, val isDaily: Boolean) {
    var state by mutableStateOf(
        SudokuState.create(
            generateSudoku(seed, if (isDaily) SudokuDifficulty.MEDIUM else sudokuDifficultyForSeed(seed)),
            System.currentTimeMillis(),
        ),
    )
        private set
    var selected by mutableStateOf<Int?>(null)
    var toast by mutableStateOf<String?>(null)
    var finalTimeSeconds by mutableStateOf<Int?>(null)
        private set
    var xpResult by mutableStateOf<GameResultsService.XpResult?>(null)
    /** True when a finished board was restored — the overlay must not replay. */
    var restoredFinished = false
        private set

    private var startMs = System.currentTimeMillis()
    private var restoredElapsedMs = 0L
    private var guidePauseStart: Long? = null
    private var recorded = false

    val isFinished get() = state.status != SudokuStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, ((System.currentTimeMillis() - startMs) / 1000).toInt())
    val dailyNumber get() = sudokuDailyNumber(todayLocalDate())

    init { restore() }

    fun beginTimer() { startMs = System.currentTimeMillis() - restoredElapsedMs }
    fun pauseForGuide() { if (guidePauseStart == null && !isFinished) guidePauseStart = System.currentTimeMillis() }
    fun resumeFromGuide() { guidePauseStart?.let { startMs += System.currentTimeMillis() - it; guidePauseStart = null } }

    // Persistence (mirrors components/sudoku/persistence.ts): the reducer state
    // whole, history included, plus the clock.
    @Serializable private data class SnapDto(val board: String, val notes: List<Int>, val hintMask: String, val wrongMask: String)
    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
        val difficulty: String, val givens: String, val solution: String,
        val board: String, val notes: List<Int>, val hintMask: String, val wrongMask: String,
        val mistakes: Int, val hintsUsed: Int, val notesMode: Boolean, val autoClearNotes: Boolean,
        val status: String, val history: List<SnapDto>, val startTime: Long, val endTime: Long?,
    )
    private val json = Json { ignoreUnknownKeys = true }
    private val storageKey get() = if (isDaily) "sudoku-save-daily" else "sudoku-save-$seed"

    private fun persist() {
        val s = state
        val dto = SaveDto(
            seed, todayLocalDate(), elapsed, System.currentTimeMillis(),
            s.difficulty.key, s.givens, s.solution, s.board, s.notes, s.hintMask, s.wrongMask,
            s.mistakes, s.hintsUsed, s.notesMode, s.autoClearNotes, s.status.key,
            s.history.map { SnapDto(it.board, it.notes, it.hintMask, it.wrongMask) }, s.startTime, s.endTime,
        )
        runCatching { SettingsPref.set(storageKey, json.encodeToString(dto)) }
    }

    private fun restore() {
        val raw = SettingsPref.get(storageKey, "")
        if (raw.isEmpty()) return
        val dto = runCatching { json.decodeFromString<SaveDto>(raw) }.getOrNull() ?: return
        val stale = dto.seed != seed ||
            (isDaily && dto.date != todayLocalDate()) ||
            (!isDaily && System.currentTimeMillis() - dto.savedAt > 24 * 60 * 60 * 1000L)
        if (stale) { SettingsPref.set(storageKey, ""); return }
        val difficulty = SudokuDifficulty.fromKey(dto.difficulty) ?: SudokuDifficulty.MEDIUM
        val status = SudokuStatus.values().firstOrNull { it.key == dto.status } ?: SudokuStatus.PLAYING
        state = SudokuState(
            seed, difficulty, dto.givens, dto.solution, dto.board, dto.notes, dto.hintMask, dto.wrongMask,
            dto.mistakes, dto.hintsUsed, dto.notesMode, dto.autoClearNotes, status,
            dto.history.map { SudokuSnapshot(it.board, it.notes, it.hintMask, it.wrongMask) }, dto.startTime, dto.endTime,
        )
        restoredElapsedMs = dto.elapsed * 1000L
        if (status != SudokuStatus.PLAYING) { finalTimeSeconds = dto.elapsed; recorded = true; restoredFinished = true }
    }

    // Actions
    private fun dispatch(a: SudokuAction, onFinished: () -> Unit) {
        if (isFinished) return
        state = sudokuReduce(state, a, System.currentTimeMillis())
        if (isFinished) onFinished()
        persist()
    }

    fun place(digit: Int, onFinished: () -> Unit) {
        if (isFinished) return
        val cell = selected ?: run { flash("Tap a cell first"); return }
        if (state.givens[cell] != '0') { SoundManager.playInvalid(); return }
        val wrong = !state.notesMode && state.solution[cell] != ('0' + digit)
        dispatch(SudokuAction.Place(cell, digit), onFinished)
        if (wrong && !isFinished) SoundManager.playInvalid() else SoundManager.playKeyTap()
    }
    fun erase(onFinished: () -> Unit) { selected?.let { dispatch(SudokuAction.Erase(it), onFinished) } }
    fun undo(onFinished: () -> Unit) = dispatch(SudokuAction.Undo, onFinished)
    fun toggleNotes(onFinished: () -> Unit) = dispatch(SudokuAction.ToggleNotes, onFinished)
    fun hint(onFinished: () -> Unit) = dispatch(SudokuAction.Hint(selected), onFinished)

    /** Digits with all nine correct placements — dimmed on the pad. */
    val completeDigits: Set<Int>
        get() = (1..9).filter { d -> (0 until 81).count { state.board[it] == '0' + d && state.solution[it] == '0' + d } == 9 }.toSet()

    /** Freeze the clock, play the sound, record ONCE. */
    suspend fun finish() {
        finalTimeSeconds = elapsed
        if (state.status == SudokuStatus.WON) SoundManager.playSuccess() else SoundManager.playGameOver()
        if (recorded) return
        recorded = true
        val won = state.status == SudokuStatus.WON
        val gc = state.mistakes + 1
        val (solutions, guesses) = sudokuMatchRow(state)
        // record() writes daily_results (daily seeds), matches, user_stats, XP,
        // medals and runs the achievement pass — one call, like every mode.
        val xp = GameResultsService.record(
            gameMode = GameMode.SUDOKU, won = won, guessCount = gc, timeSeconds = elapsed,
            boardsSolved = if (won) 1 else 0, totalBoards = 1, seed = seed,
            solutions = solutions, guesses = guesses, hintsUsed = state.hintsUsed,
        )
        xpResult = xp
        if (isDaily) DailyCompletionsService.noteCompletion(GameMode.SUDOKU.name, won, gc, elapsed)
    }

    private fun flash(m: String) {
        toast = m
    }
}

// ── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun SudokuScreen(
    seed: String,
    isDaily: Boolean,
    onBack: () -> Unit,
    /** Pro Unlimited "Play Again" / difficulty switch — MainScreen mints a fresh seed. */
    onPlayAgain: ((SudokuDifficulty) -> Unit)? = null,
    onOpenDaily: (GameMode) -> Unit = {},
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val session = remember(seed) { SudokuSession(seed, isDaily) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val isPro = AuthService.isProActive
    var showOverlay by remember(seed) { mutableStateOf(false) }
    var showGuide by remember { mutableStateOf(false) }
    var adGateDone by remember(seed) { mutableStateOf(false) }

    // Game-start ad for free users; the clock starts after it (GameScreen parity).
    LaunchedEffect(seed) {
        val activity = context as? Activity
        if (!adGateDone && !session.isFinished && activity != null && AdsManager.active) {
            adGateDone = true
            AdsManager.showGameStartInterstitial(activity) { session.beginTimer() }
        } else { adGateDone = true; session.beginTimer() }
    }
    // Toast auto-clear.
    LaunchedEffect(session.toast) { if (session.toast != null) { kotlinx.coroutines.delay(1200); session.toast = null } }

    val onFinished: () -> Unit = {
        scope.launch {
            session.finish()
            if (!session.restoredFinished) showOverlay = true
            if (session.state.status == SudokuStatus.WON) {
                RatingsPrompt.recordWin(context)
                (context as? Activity)?.let { RatingsPrompt.maybeAsk(it) }
            }
        }
    }

    androidx.activity.compose.BackHandler { onBack() }

    Box(Modifier.fillMaxSize().background(WTheme.bg).statusBarsPadding()) {
        if (session.isFinished) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                SudokuHeader(session)
                SudokuBoard(session.state, selected = null, revealSolution = session.state.status == SudokuStatus.LOST) {}
                SudokuResult(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
            }
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                SudokuHeader(session)
                if (!isDaily && isPro && onPlayAgain != null) DifficultyPicker(session.state.difficulty) { onPlayAgain(it) }
                Spacer(Modifier.weight(1f))
                SudokuBoard(session.state, session.selected, revealSolution = false) { session.selected = it }
                Spacer(Modifier.weight(1f))
                SudokuPad(session, onFinished)
                Spacer(Modifier.height(6.dp))
            }
        }
        session.toast?.let {
            Box(Modifier.fillMaxWidth().padding(top = 100.dp), contentAlignment = Alignment.TopCenter) {
                Text(it, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clip(CircleShape).background(WTheme.text.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 10.dp))
            }
        }
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) SudokuOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain(session.state.difficulty) } } else null) { showOverlay = false }
        // The same corner Home / "?" pair as every game (§19).
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(SUDOKU_ACCENT, onBack) }
        CornerHelpButton(SUDOKU_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
        if (showGuide) GuideSheet(mode = GameMode.SUDOKU, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@Composable
private fun SudokuHeader(session: SudokuSession) {
    // One-second tick for the clock while playing.
    val tick by produceState(0, session.isFinished) {
        while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ }
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        Text("SUDOKU", fontSize = 24.sp, fontWeight = FontWeight.Black, color = SUDOKU_ACCENT, fontFamily = Nunito)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text(DIFFICULTY_LABEL[session.state.difficulty] ?: "Medium", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Mistakes", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                repeat(SUDOKU_MAX_MISTAKES) { i ->
                    Box(Modifier.size(8.dp).clip(CircleShape).background(if (i < session.state.mistakes) Color(0xFFDC2626) else WTheme.borderLight))
                }
            }
            if (!session.isFinished) {
                @Suppress("UNUSED_EXPRESSION") tick
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Icon(Icons.Filled.Schedule, null, tint = WTheme.textMuted, modifier = Modifier.size(11.dp))
                    val s = session.elapsed
                    Text("${s / 60}:${"%02d".format(s % 60)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
        }
    }
}

@Composable
private fun DifficultyPicker(current: SudokuDifficulty, onPick: (SudokuDifficulty) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SudokuDifficulty.values().forEach { d ->
            val active = d == current
            Text(
                DIFFICULTY_LABEL[d] ?: d.key, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                color = if (active) Color.White else SUDOKU_ACCENT,
                modifier = Modifier.clip(CircleShape)
                    .background(if (active) SUDOKU_ACCENT else Color.Transparent)
                    .border(1.5.dp, SUDOKU_ACCENT.copy(alpha = if (active) 1f else 0.35f), CircleShape)
                    .clickableNoRipple { if (!active) onPick(d) }
                    .padding(horizontal = 12.dp, vertical = 5.dp),
            )
        }
    }
}

// ── Board ───────────────────────────────────────────────────────────────────

/** ONE continuous ruled grid (§8): hairline lilac rules between cells, heavy
 *  rules around each 3 × 3 box and the edge. Givens dark and heaviest, the
 *  player's digits purple, hint digits violet, a wrong digit red; the selected
 *  cell in the stronger lilac fill with its row, column and box washed; every
 *  cell holding the selected digit emphasised. Pencil marks: the 3 × 3 mini-grid. */
@Composable
fun SudokuBoard(state: SudokuState, selected: Int?, revealSolution: Boolean, onSelect: (Int) -> Unit) {
    val rule = Color(0xFFC4B5FD); val heavy = Color(0xFF4C1D95)
    val selectedFill = Color(0xFFDDD6FE); val sameFill = Color(0xFFEDE9FE)
    val player = Color(0xFF7C3AED); val hint = Color(0xFF8B5CF6); val wrong = Color(0xFFDC2626)
    fun boxOf(i: Int) = ((i / 9) / 3) * 3 + (i % 9) / 3
    val selRow = selected?.let { it / 9 } ?: -1; val selCol = selected?.let { it % 9 } ?: -1; val selBox = selected?.let(::boxOf) ?: -1
    val selDigit = selected?.let { state.board[it] }?.takeIf { it != '0' }
    val density = LocalDensity.current

    Box(
        Modifier.fillMaxWidth().widthIn(max = 420.dp).aspectRatio(1f)
            .clip(RoundedCornerShape(14.dp)).background(WTheme.surface)
            .border(2.5.dp, heavy, RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.fillMaxSize()) {
            for (r in 0 until 9) {
                Row(Modifier.weight(1f).fillMaxWidth()) {
                    for (c in 0 until 9) {
                        val i = r * 9 + c
                        val given = state.givens[i] != '0'
                        val boardCh = state.board[i]
                        val revealed = revealSolution && boardCh == '0'
                        val value: Char? = if (boardCh != '0') boardCh else if (revealed) state.solution[i] else null
                        val isWrong = state.wrongMask[i] == '1'
                        val hinted = state.hintMask[i] == '1'
                        val isSelected = i == selected
                        val inWash = r == selRow || c == selCol || boxOf(i) == selBox
                        val sameDigit = selDigit != null && value == selDigit && !isSelected
                        val color = when { revealed -> WTheme.textMuted; isWrong -> wrong; hinted -> hint; given -> WTheme.text; else -> player }
                        val bg = when { isSelected -> selectedFill; sameDigit -> sameFill; inWash -> WTheme.winBg; else -> Color.Transparent }
                        Box(
                            Modifier.weight(1f).fillMaxSize().background(bg).clickableNoRipple { onSelect(i) },
                            contentAlignment = Alignment.Center,
                        ) {
                            if (value != null) {
                                // Derived from dp through density (TileView rule): a fixed cell must not grow with font scale.
                                val fs = with(density) { 22.dp.toSp() }
                                Text(value.toString(), fontSize = fs, fontWeight = if (given) FontWeight.Black else FontWeight.ExtraBold, color = color, fontFamily = Nunito)
                            } else if (state.notes[i] != 0) {
                                val m = state.notes[i]
                                val fs = with(density) { 8.5.dp.toSp() }
                                Column(Modifier.fillMaxSize().padding(2.dp)) {
                                    for (rr in 0 until 3) Row(Modifier.weight(1f).fillMaxWidth()) {
                                        for (cc in 0 until 3) {
                                            val d = rr * 3 + cc
                                            Box(Modifier.weight(1f).fillMaxSize(), contentAlignment = Alignment.Center) {
                                                if ((m and (1 shl d)) != 0) Text("${d + 1}", fontSize = fs, fontWeight = FontWeight.Bold, color = WTheme.textSecondary, fontFamily = Nunito)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // Rules — hairlines everywhere, heavy on the box boundaries.
        Canvas(Modifier.fillMaxSize()) {
            val side = size.width
            val cell = side / 9f
            for (k in 1 until 9) {
                val heavyLine = k % 3 == 0
                val w = if (heavyLine) 2.dp.toPx() else 1.dp.toPx()
                val colr = if (heavyLine) heavy else rule
                val p = k * cell
                drawRect(colr, topLeft = Offset(p - w / 2, 0f), size = Size(w, side))
                drawRect(colr, topLeft = Offset(0f, p - w / 2), size = Size(side, w))
            }
        }
    }
}

// ── Pad ─────────────────────────────────────────────────────────────────────

/** Nine keys styled like KeyboardView's keys, under the action row Undo · Erase
 *  · Notes · Hint, each with its icon. Notes is a toggle: fixed label, state
 *  shown by filling with the accent. */
@Composable
private fun SudokuPad(session: SudokuSession, onFinished: () -> Unit) {
    val s = session.state
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Capsule("Undo", Icons.AutoMirrored.Filled.Undo, dim = s.history.isEmpty()) { session.undo(onFinished) }
            Capsule("Erase", Icons.AutoMirrored.Filled.Backspace) { session.erase(onFinished) }
            Capsule("Notes", Icons.Filled.Edit, active = s.notesMode) { session.toggleNotes(onFinished) }
            Capsule(if (s.hintsUsed > 0) "Hint · ${s.hintsUsed}" else "Hint", Icons.Filled.Lightbulb) { session.hint(onFinished) }
        }
        val done = session.completeDigits
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            for (d in 1..9) {
                Box(
                    Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(6.dp))
                        .background(if (s.notesMode) SUDOKU_ACCENT.copy(alpha = 0.08f) else WTheme.keyDefault)
                        .border(1.5.dp, if (s.notesMode) SUDOKU_ACCENT.copy(alpha = 0.35f) else WTheme.border, RoundedCornerShape(6.dp))
                        .alpha(if (d in done) 0.4f else 1f)
                        .pressScale { session.place(d, onFinished) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("$d", fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.keyInk, fontFamily = Nunito)
                }
            }
        }
    }
}

@Composable
private fun Capsule(label: String, icon: ImageVector, active: Boolean = false, dim: Boolean = false, onClick: () -> Unit) {
    val fg = if (dim) WTheme.textMuted.copy(alpha = 0.5f) else if (active) Color.White else SUDOKU_ACCENT
    Row(
        Modifier.clip(CircleShape)
            .background(if (active) SUDOKU_ACCENT else if (dim) Color.Transparent else SUDOKU_ACCENT.copy(alpha = 0.05f))
            .border(1.5.dp, if (dim) WTheme.border else if (active) SUDOKU_ACCENT else SUDOKU_ACCENT.copy(alpha = 0.4f), CircleShape)
            .clickableNoRipple { if (!dim) onClick() }
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = fg, modifier = Modifier.size(13.dp))
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = fg)
    }
}

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun SudokuResult(
    session: SudokuSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: ((SudokuDifficulty) -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == SudokuStatus.WON
    val secs = session.elapsed
    val remaining = sudokuRemaining(s)
    val context = LocalContext.current
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 12.dp)) {
        Text(if (won) "Sudoku solved" else "Out of mistakes", fontSize = 20.sp, fontWeight = FontWeight.Black,
            color = if (won) Color(0xFF7C3AED) else Color(0xFFEF4444), fontFamily = Nunito)
        Text(
            if (won) "${formatGuessStat("mistakes", 1, s.mistakes + 1)} · ${timeText(secs)}" + (if (s.hintsUsed > 0) " · ${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}" else "")
            else "$remaining cell${if (remaining == 1) "" else "s"} left · ${timeText(secs)}",
            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            ResultAction(Icons.Filled.Home, "Home", SUDOKU_ACCENT, onBack)
            ResultAction(Icons.Filled.Share, "Share", SUDOKU_ACCENT) {
                val num = if (session.isDaily) session.dailyNumber else null
                val meta = "${num?.let { "#$it · " } ?: ""}${DIFFICULTY_LABEL[s.difficulty]} · ${if (won) "${s.mistakes} mistake${if (s.mistakes == 1) "" else "s"}" else "Out of mistakes"} · ${timeText(secs)}"
                // Caption names each figure (founder, 2026-09-22): score, time, mistakes.
                val pts = com.wordocious.app.data.DailyScoring.breakdown(GameMode.SUDOKU.name, won, s.mistakes + 1, secs, if (won) 1 else 0, 1, s.hintsUsed).total.toInt()
                val text = "Wordocious Sudoku${num?.let { " #$it" } ?: ""} — Score $pts pts · Time ${timeText(secs)} · ${if (won) "${s.mistakes} mistake${if (s.mistakes == 1) "" else "s"}" else "Out of mistakes"} · wordocious.com/sudoku"
                val bmp = ShareImage.renderSudoku(context, s.givens, s.board, s.hintMask, won, meta)
                ShareImage.shareBitmap(context, bmp, text)
            }
            if (!session.isDaily && isPro && onPlayAgain != null) ResultAction(Icons.Filled.Refresh, "Play Again", Color(0xFFD97706)) { onPlayAgain(s.difficulty) }
        }
        if (session.isDaily) DailyRankBadge(GameMode.SUDOKU)
        ScoreBreakdownCard(GameMode.SUDOKU, won, s.mistakes + 1, secs, if (won) 1 else 0, 1, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.SUDOKU, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
    }
}

@Composable
private fun ResultAction(icon: ImageVector, label: String, color: Color, onClick: () -> Unit) {
    Row(Modifier.clickableNoRipple(onClick), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(icon, null, tint = color, modifier = Modifier.size(14.dp))
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.Black, color = color)
    }
}

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"

/** Victory / game-over card (VictoryOverlay's look for a non-word board). */
@Composable
private fun SudokuOverlay(session: SudokuSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == SudokuStatus.WON
    val secs = session.elapsed
    Box(Modifier.fillMaxSize().background(Color(0xFF18182E).copy(alpha = 0.6f)).clickableNoRipple(onDismiss), contentAlignment = Alignment.Center) {
        Column(
            Modifier.padding(horizontal = 24.dp).widthIn(max = 380.dp).clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.fillMaxWidth().height(6.dp).background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
            Column(Modifier.padding(horizontal = 20.dp, vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    if (won) "VICTORY!" else "GAME OVER", fontSize = 36.sp, fontWeight = FontWeight.Black,
                    style = if (won) TextStyle(fontFamily = Nunito, brush = Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))) else TextStyle(fontFamily = Nunito, color = Color(0xFFF87171)),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    StatBlock("${session.state.mistakes}", "MISTAKES"); StatBlock(timeText(secs), "TIME")
                }
                onPlayAgain?.let {
                    Text(
                        if (won) "Play again" else "Try again", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White,
                        modifier = Modifier.clip(CircleShape)
                            .background(if (won) Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899))) else Brush.horizontalGradient(listOf(Color(0xFFF87171), Color(0xFFF87171))))
                            .clickableNoRipple(it).padding(horizontal = 28.dp, vertical = 10.dp),
                    )
                }
                Text("Tap anywhere to continue", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFC4B5FD))
            }
        }
    }
}

@Composable
private fun StatBlock(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(value, fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, letterSpacing = 0.6.sp)
    }
}

// ── Completed-today card for custom engines ─────────────────────────────────

/** The Records / Leaderboard "completed today" card for a More Games title: the
 *  word-board reconstruction does not apply, so this shows the summary line
 *  (through the mode's guess semantics) and the score breakdown. */
@Composable
fun CustomCompletedDailyCard(mode: GameMode) {
    val seed = remember(mode) { com.wordocious.app.todayLocalSeed(mode.name) }
    val tick by DailyCompletionsService.completionTick.collectAsState()
    val cached = remember(mode, tick) { GameResultsService.prefetchedDailyMatch(seed) }
    var row by remember(mode, tick) { mutableStateOf(cached) }
    var expanded by remember { mutableStateOf(false) }
    LaunchedEffect(mode, tick) { if (row == null) row = GameResultsService.fetchRecordedDailyMatch(seed) }
    val r = row ?: return
    val uid = AuthService.profile.value?.id
    val won = r.winnerId != null && r.winnerId == uid
    val completion = DailyCompletionsService.readCache()[mode.name]
    val guessCount = completion?.guessCount ?: 1
    val g = com.wordocious.app.ModeGen.byDbKey(mode.name)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
    ) {
        Box(Modifier.fillMaxWidth().height(4.dp).background(Brush.horizontalGradient(
            if (won) listOf(Color(0xFF7C3AED), Color(0xFFA78BFA)) else listOf(Color(0xFF9CA3AF), Color(0xFFD1D5DB)))))
        Row(
            Modifier.fillMaxWidth().clickableNoRipple { expanded = !expanded }.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.size(16.dp).clip(CircleShape).background(if (won) Color(0xFFF5F3FF) else Color(0xFFFEE2E2)), contentAlignment = Alignment.Center) {
                Text(if (won) "✓" else "✗", fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626))
            }
            Text(if (won) "COMPLETED TODAY" else "ATTEMPTED TODAY", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.6.sp,
                color = if (won) Color(0xFF7C3AED) else WTheme.textMuted)
            Spacer(Modifier.weight(1f))
            Text("${formatGuessStat(g?.guessSemantics ?: "guesses", g?.guessBase ?: 1, guessCount)} · ${formatShortTime(r.player1Time)}",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        if (expanded) {
            Box(Modifier.padding(horizontal = 14.dp).padding(bottom = 14.dp, top = 4.dp)) {
                ScoreBreakdownCard(mode, won, guessCount, r.player1Time, if (won) 1 else 0, 1, 0, day = todayLocalDate())
            }
        }
    }
}
