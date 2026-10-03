package com.wordocious.app.ui.game

import com.wordocious.app.ui.gameBackground
import com.wordocious.app.ui.cardShadow
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.drawBehind
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
import androidx.compose.ui.unit.Dp
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
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.tintedPill
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
// Player-facing name from the catalog (the id `sudoku` and GameMode.SUDOKU stay; rename-proof rule).
private val SUDOKU_TITLE: String get() = com.wordocious.app.ModeGen.byDbKey(GameMode.SUDOKU.name)?.title?.uppercase() ?: "SUDOCIOUS"
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
    private var began = false
    /** Why the clock is stopped (guide open, app in background); it runs only while the set is empty. */
    enum class Pause { GUIDE, BACKGROUND }
    private val pausedFor = mutableSetOf<Pause>()
    private var pauseStart: Long? = null
    private var recorded = false

    val isFinished get() = state.status != SudokuStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, (((pauseStart ?: System.currentTimeMillis()) - startMs) / 1000).toInt())
    val dailyNumber get() = sudokuDailyNumber(todayLocalDate())

    // Declared BEFORE init: restore() runs inside init and needs it. Declared below the
    // block it was null during construction, decode threw inside runCatching and every
    // save was silently ignored on the next open (Doug, Android production, 2026-09-25).
    private val json = Json { ignoreUnknownKeys = true }

    init { restore() }

    fun beginTimer() {
        val now = System.currentTimeMillis()
        startMs = now - restoredElapsedMs; began = true
        if (pausedFor.isNotEmpty()) pauseStart = now // a pause that began before the clock starts from it
    }
    /** Stop the clock for [why]; idempotent, and the clock stays stopped until every reason is lifted. */
    fun pauseClock(why: Pause) {
        if (isFinished || why in pausedFor) return
        if (pausedFor.isEmpty()) pauseStart = System.currentTimeMillis()
        pausedFor.add(why)
    }
    fun resumeClock(why: Pause) {
        if (!pausedFor.remove(why) || pausedFor.isNotEmpty()) return
        pauseStart?.let { startMs += System.currentTimeMillis() - it; pauseStart = null }
    }
    fun pauseForGuide() = pauseClock(Pause.GUIDE)
    fun resumeFromGuide() = resumeClock(Pause.GUIDE)
    /** App in the background: stop the clock and save, so a process death restores without the time away. */
    fun enterBackground() { pauseClock(Pause.BACKGROUND); if (began && !isFinished) persist() }
    fun leaveBackground() = resumeClock(Pause.BACKGROUND)

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
    private val storageKey get() = if (isDaily) "sudoku-save-daily" else "sudoku-save-$seed"

    private fun persist() {
        if (!isDaily && isFinished) { SettingsPref.remove(storageKey); return }
        val s = state
        val dto = SaveDto(
            seed, todayLocalDate(), elapsed, System.currentTimeMillis(),
            s.difficulty.key, s.givens, s.solution, s.board, s.notes, s.hintMask, s.wrongMask,
            s.mistakes, s.hintsUsed, s.notesMode, s.autoClearNotes, s.status.key,
            s.history.takeLast(MAX_SAVED_UNDO).map { SnapDto(it.board, it.notes, it.hintMask, it.wrongMask) }, s.startTime, s.endTime,
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
    PauseClockInBackground(session, session::enterBackground, session::leaveBackground)
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

    // Physical keyboard (founder, 2026-09-30; web sudoku-game.tsx): 1–9 place, Backspace/Delete/0
    // erase, N notes, H hint, Ctrl/Cmd+Z undo, arrows move the selected cell (the first one
    // selects the top-left cell).
    ProvideFeedbackAnchor {
    Box(
        Modifier.fillMaxSize()
            .hardwareKeys(enabled = !session.isFinished && !showOverlay && !showGuide) { k ->
                when {
                    k is HwKey.Digit && k.n in 1..9 -> { session.place(k.n, onFinished); true }
                    k.isErase || (k is HwKey.Digit && k.n == 0) -> { session.erase(onFinished); true }
                    k == HwKey.Letter('N') -> { session.toggleNotes(onFinished); true }
                    k == HwKey.Letter('H') -> { session.hint(onFinished); true }
                    k == HwKey.Undo -> { session.undo(onFinished); true }
                    k == HwKey.Up || k == HwKey.Down || k == HwKey.Left || k == HwKey.Right -> {
                        // Nothing selected yet: the first arrow lands on the top-left cell (web parity).
                        val cur = session.selected ?: run { session.selected = 0; return@hardwareKeys true }
                        val r = cur / 9
                        val c = cur % 9
                        when (k) {
                            HwKey.Up -> if (r > 0) session.selected = cur - 9
                            HwKey.Down -> if (r < 8) session.selected = cur + 9
                            HwKey.Left -> if (c > 0) session.selected = cur - 1
                            else -> if (c < 8) session.selected = cur + 1
                        }
                        true
                    }
                    else -> false
                }
            }
            .gameBackground { background(WTheme.bg) }.statusBarsPadding(),
    ) {
        if (session.isFinished) {
            // FINISH_SPEC R2: the one-screen finished screen (header · strip · board · dock).
            SudokuFinished(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
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
        // The candy feedback toast, centered on the header meta row (never the title art or the board).
        GameFeedbackToast(session.toast)
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) SudokuOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain(session.state.difficulty) } } else null) { showOverlay = false }
        // The same corner Home / "?" pair as every game (§19).
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(SUDOKU_ACCENT, onBack) }
        CornerHelpButton(SUDOKU_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET))
        if (showGuide) GuideSheet(mode = GameMode.SUDOKU, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
    }
}

@Composable
private fun SudokuHeader(session: SudokuSession) {
    // One-second tick for the clock while playing.
    val tick by produceState(0, session.isFinished) {
        while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ }
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        // The game's title art: lettering + host (ART_SPEC §10).
        com.wordocious.app.ui.HostedGameTitle("SUDOKU") { Text(SUDOKU_TITLE, fontSize = 24.sp, fontWeight = FontWeight.Black, color = SUDOKU_ACCENT, fontFamily = Nunito) }
        Row(Modifier.feedbackAnchor(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
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
            // A1 / A9 a tinted segmented chip that squishes; the selected one filled.
            Text(
                DIFFICULTY_LABEL[d] ?: d.key, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                color = if (active) Color.White else SUDOKU_ACCENT,
                modifier = Modifier
                    .squishClickable(label = (DIFFICULTY_LABEL[d] ?: d.key) + if (active) ", selected" else "") { if (!active) onPick(d) }
                    .then(
                        if (active) Modifier.clip(CircleShape).background(SUDOKU_ACCENT)
                        else Modifier.tintedPill(SUDOKU_ACCENT, corner = 20.dp),
                    )
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }
    }
}

// ── Board ───────────────────────────────────────────────────────────────────

/**
 * FINISH_SPEC B1 the Sudocious board in the game kit: every cell is a game tile on a
 * frosted panel (boxes set apart by a wider gap). Givens = the plain light tile with a
 * dark purple digit; the player's digits = the purple tile (a hint the same, a wrong
 * digit the red conflict tile); empty = frosted glass with the pencil marks. The
 * selected cell is the solid purple tile with a deep ring; every other cell holding its
 * digit the medium lavender tile; its row, column and box pale lavender (BI6). Placing a
 * number swells in like typing (B3).
 */
@Composable
fun SudokuBoard(state: SudokuState, selected: Int?, revealSolution: Boolean, digitSize: Dp = 22.dp, onSelect: (Int) -> Unit) {
    fun boxOf(i: Int) = ((i / 9) / 3) * 3 + (i % 9) / 3
    val selRow = selected?.let { it / 9 } ?: -1; val selCol = selected?.let { it % 9 } ?: -1; val selBox = selected?.let(::boxOf) ?: -1
    val selDigit = selected?.let { state.board[it] }?.takeIf { it != '0' }
    val density = LocalDensity.current
    val cellGap = 2.5.dp
    val boxGap = 6.dp

    // FINISH_SPEC L: the board sits in the shared game tray (Sudocious accent; purple when
    // solved, slate when out of mistakes); the 3×3 boxes are set apart by soft darker
    // seams in the tray color, never black lines.
    val trayState = when (state.status) {
        SudokuStatus.WON -> TrayState.WON
        SudokuStatus.LOST -> TrayState.LOST
        else -> TrayState.PLAYING
    }
    val seam = if (WTheme.isDark) SUDOKU_ACCENT.copy(alpha = 0.35f) else GameTrayStyle.seam(GameTrayStyle.tint(SUDOKU_ACCENT, trayState))
    Box(
        Modifier.fillMaxWidth().widthIn(max = 420.dp).aspectRatio(1f)
            .gameTray(SUDOKU_ACCENT, trayState, padding = androidx.compose.foundation.layout.PaddingValues(8.dp)),
    ) {
        Column(
            Modifier.fillMaxSize().drawBehind {
                val g = boxGap.toPx()
                val bw = (size.width - 2 * g) / 3f
                val bh = (size.height - 2 * g) / 3f
                val sw = 2.dp.toPx()
                val cap = androidx.compose.ui.graphics.StrokeCap.Round
                for (k in 1..2) {
                    val x = k * bw + (k - 0.5f) * g
                    val y = k * bh + (k - 0.5f) * g
                    drawLine(seam, androidx.compose.ui.geometry.Offset(x, 4f), androidx.compose.ui.geometry.Offset(x, size.height - 4f), sw, cap)
                    drawLine(seam, androidx.compose.ui.geometry.Offset(4f, y), androidx.compose.ui.geometry.Offset(size.width - 4f, y), sw, cap)
                }
            },
            verticalArrangement = Arrangement.spacedBy(boxGap),
        ) {
            for (br in 0 until 3) Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(boxGap)) {
                for (bc in 0 until 3) Column(Modifier.weight(1f).fillMaxSize(), verticalArrangement = Arrangement.spacedBy(cellGap)) {
                    for (rr in 0 until 3) Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(cellGap)) {
                        for (cc in 0 until 3) {
                            val r = br * 3 + rr
                            val c = bc * 3 + cc
                            val i = r * 9 + c
                            val given = state.givens[i] != '0'
                            val boardCh = state.board[i]
                            val revealed = revealSolution && boardCh == '0'
                            val value: Char? = if (boardCh != '0') boardCh else if (revealed) state.solution[i] else null
                            val face = when {
                                value == null -> TileFace.EMPTY
                                revealed || given -> TileFace.GIVEN
                                state.wrongMask[i] == '1' -> TileFace.CONFLICT
                                else -> TileFace.CORRECT
                            }
                            SudokuCell(
                                value = value, face = face,
                                selected = i == selected,
                                washed = i != selected && (r == selRow || c == selCol || boxOf(i) == selBox),
                                sameDigit = selDigit != null && value == selDigit && i != selected,
                                mutedDigit = revealed,
                                notes = if (value == null) state.notes[i] else 0,
                                // BI6: only cells with pencil marks care which digit is selected.
                                noteMatch = if (value == null && state.notes[i] != 0) (selDigit?.minus('0') ?: 0) else 0,
                                digitSp = with(density) { digitSize.toSp() },
                                noteSp = with(density) { (digitSize * 0.39f).toSp() },
                                modifier = Modifier.weight(1f).fillMaxSize(),
                                onClick = { onSelect(i) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** FINISH_SPEC BI6: every other cell holding the selected digit — a medium lavender tile
 *  with a deep purple digit (secondary to the selected cell's solid purple). */
private val SUDOKU_SAME = TileLook(
    edge = Color(0xFF9F7AEA), faceTop = Color(0xFFC4A6F7), faceMid = Color(0xFFC4A6F7), faceBottom = Color(0xFFC4A6F7),
    ring = Color(0x8C7C3AED), ringFrac = 0.04f, gloss = 0.4f, glyph = Color(0xFF3B0F8C), glyphShadow = Color.Transparent, glow = Color.Transparent,
)
/** BI6: a given / empty cell in the selected cell's row, column or box — pale lavender, lighter than [SUDOKU_SAME]. */
private val SUDOKU_WASH = TileLook(
    edge = Color(0xFFC9B0F3), faceTop = Color(0xFFEADFFF), faceMid = Color(0xFFEADFFF), faceBottom = Color(0xFFEADFFF),
    ring = Color(0x2E7C3AED), ringFrac = 0.025f, gloss = 0.4f, glyph = Color(0xFF2A1650), glyphShadow = Color.Transparent, glow = Color.Transparent,
)
/** BI6: dark mode's washed empty cell (the frosted glass tinted lavender). */
private val SUDOKU_WASH_EMPTY_DARK = TileLook(
    edge = Color(0x80A78BFA), faceTop = Color(0x4DA78BFA), faceMid = Color(0x4DA78BFA), faceBottom = Color(0x4DA78BFA),
    ring = Color(0x66A78BFA), ringFrac = 0.033f, gloss = 0.12f, glyph = Color(0xFFF1EAFF), glyphShadow = Color.Transparent, glow = Color.Transparent,
)

/** One Sudocious cell as a game tile (B1), swelling in when a number is placed (B3). */
@Composable
private fun SudokuCell(
    value: Char?, face: TileFace, selected: Boolean, washed: Boolean, sameDigit: Boolean, mutedDigit: Boolean,
    notes: Int, digitSp: androidx.compose.ui.unit.TextUnit, noteSp: androidx.compose.ui.unit.TextUnit,
    modifier: Modifier, noteMatch: Int = 0, onClick: () -> Unit,
) {
    var last by remember { mutableStateOf(value) }
    val pop = remember { androidx.compose.animation.core.Animatable(1f) }
    LaunchedEffect(value) {
        val placed = last == null && value != null
        last = value
        if (placed && !WTheme.reducedMotion) {
            pop.snapTo(0.9f)
            pop.animateTo(1f, androidx.compose.animation.core.keyframes {
                durationMillis = TileMotion.TYPE_MS
                0.9f at 0
                1.07f at (TileMotion.TYPE_MS * 0.55f).toInt()
            })
        }
    }
    // FINISH_SPEC BI6: the selected cell is the solid purple tile with a deep ring; every
    // other cell with its digit the medium lavender tile; its row, column and box pale
    // lavender. A wrong digit stays the red conflict tile on top of all of it.
    val base = TileLooks.of(face, WTheme.colorblind, WTheme.isDark)
    val look = when {
        face == TileFace.CONFLICT -> base
        selected -> TileLooks.of(TileFace.CORRECT, WTheme.colorblind, WTheme.isDark)
        sameDigit -> SUDOKU_SAME
        washed && face == TileFace.EMPTY -> if (WTheme.isDark) SUDOKU_WASH_EMPTY_DARK else SUDOKU_WASH
        washed && face == TileFace.GIVEN && !mutedDigit -> SUDOKU_WASH
        else -> base
    }
    val ring = if (selected) Color(0xFF2E1065) else null
    Box(
        modifier
            .graphicsLayer { scaleX = pop.value; scaleY = pop.value }
            .drawBehind {
                drawGameTile(look)
                if (ring != null) {
                    val sw = 3.dp.toPx()
                    drawRoundRect(
                        ring, topLeft = Offset(-sw / 2, -sw / 2), size = Size(size.width + sw, size.height + sw),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(minOf(size.width, size.height) * TILE_CORNER + sw / 2),
                        style = androidx.compose.ui.graphics.drawscope.Stroke(sw),
                    )
                }
            }
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (value != null) {
            Text(
                value.toString(), fontSize = digitSp, fontWeight = FontWeight.Black, fontFamily = Nunito,
                color = if (mutedDigit) Color(0xFF8A78AD) else look.glyph,
                modifier = Modifier.padding(bottom = 2.dp),
                style = TextStyle(
                    shadow = if (look.glyphShadow.alpha > 0f) androidx.compose.ui.graphics.Shadow(look.glyphShadow, Offset(0f, 1.5f), 1f) else null,
                ),
            )
        } else if (notes != 0) {
            Column(Modifier.fillMaxSize().padding(2.dp)) {
                for (rr in 0 until 3) Row(Modifier.weight(1f).fillMaxWidth()) {
                    for (cc in 0 until 3) {
                        val d = rr * 3 + cc
                        Box(Modifier.weight(1f).fillMaxSize(), contentAlignment = Alignment.Center) {
                            if ((notes and (1 shl d)) != 0) {
                                // BI6: the selected digit's pencil mark goes bold purple.
                                val match = noteMatch == d + 1
                                Text(
                                    "${d + 1}", fontSize = if (match) noteSp * 1.12f else noteSp,
                                    fontWeight = if (match) FontWeight.Black else FontWeight.ExtraBold,
                                    color = if (selected) Color.White else if (match) Color(0xFF6D28D9) else Color(0xFF8A78AD), fontFamily = Nunito,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Pad ─────────────────────────────────────────────────────────────────────

/** Nine keys as key tiles (FINISH_SPEC B2: the keyboard's lilac lip, light face,
 *  dark-purple digit), under the action row Undo · Erase · Notes · Hint as small
 *  candy buttons (A8), each with its icon. Notes is a toggle: fixed label, state
 *  shown by the purple candy (and the pad's pencil tint). */
@Composable
private fun SudokuPad(session: SudokuSession, onFinished: () -> Unit) {
    val s = session.state
    Column(verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PadAction("Undo", Icons.AutoMirrored.Filled.Undo, onClick = { session.undo(onFinished) }, dim = s.history.isEmpty())
            PadAction("Erase", Icons.AutoMirrored.Filled.Backspace, onClick = { session.erase(onFinished) })
            PadAction("Notes", Icons.Filled.Edit, onClick = { session.toggleNotes(onFinished) }, active = s.notesMode)
            // BI22: a fixed "Hint" label; the used count is the corner badge (an overlay).
            PadAction(
                "Hint", Icons.Filled.Lightbulb,
                onClick = { session.hint(onFinished) }, color = com.wordocious.app.ui.CandyColor.AMBER,
                count = s.hintsUsed,
            )
        }
        val done = session.completeDigits
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            for (d in 1..9) {
                PadKey(
                    "$d", onClick = { session.place(d, onFinished) },
                    modifier = Modifier.weight(1f).height(50.dp),
                    notes = s.notesMode, faded = d in done,
                    contentDescription = if (s.notesMode) "Note $d" else "$d",
                )
            }
        }
    }
}

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun SudokuFinished(
    session: SudokuSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: ((SudokuDifficulty) -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == SudokuStatus.WON
    val secs = session.elapsed
    val remaining = sudokuRemaining(s)
    val context = LocalContext.current
    val day = if (session.isDaily) todayLocalDate() else null
    val points = com.wordocious.app.data.DailyScoring.breakdown(GameMode.SUDOKU.name, won, s.mistakes + 1, secs, if (won) 1 else 0, 1, s.hintsUsed, null, null, day).total.toInt()
    val share = {
        val num = if (session.isDaily) session.dailyNumber else null
        val meta = "${num?.let { "#$it · " } ?: ""}${DIFFICULTY_LABEL[s.difficulty]} · ${if (won) "${s.mistakes} mistake${if (s.mistakes == 1) "" else "s"}" else "Out of mistakes"} · ${timeText(secs)}"
        // Caption names each figure (founder, 2026-09-22): score, time, mistakes.
        val pts = com.wordocious.app.data.DailyScoring.breakdown(GameMode.SUDOKU.name, won, s.mistakes + 1, secs, if (won) 1 else 0, 1, s.hintsUsed).total.toInt()
        val text = "Wordocious Sudocious${num?.let { " #$it" } ?: ""} — Score $pts pts · Time ${timeText(secs)} · ${if (won) "${s.mistakes} mistake${if (s.mistakes == 1) "" else "s"}" else "Out of mistakes"} · wordocious.com/sudoku"
        val bmp = ShareImage.renderSudoku(context, s.givens, s.board, s.hintMask, won, meta)
        ShareImage.shareBitmap(context, bmp, text)
    }
    FinishedScreen(
        header = { SudokuHeader(session) },
        strip = {
            ResultStrip(
                won,
                listOf(
                    if (won) stripCount("${s.mistakes}", if (s.mistakes == 1) "mistake" else "mistakes", StripGlyph.CROWN)
                    else stripCount("$remaining", if (remaining == 1) "cell left" else "cells left"),
                    stripTime(secs), stripPoints(points),
                ),
                srText = (if (won) "Sudocious solved" else "Out of mistakes") + ". " +
                    (if (won) "${s.mistakes} mistake${if (s.mistakes == 1) "" else "s"}" else "$remaining cell${if (remaining == 1) "" else "s"} left") +
                    ", time ${timeText(secs)}, $points points",
            )
        },
        dock = {
            FinishedDock(
                GameMode.SUDOKU, isDaily = session.isDaily, accent = SUDOKU_ACCENT, onShare = share,
                onOpenDaily = onOpenDaily, onOpenLeaderboard = onOpenLeaderboard, onOpenUnlimited = onOpenUnlimited,
                onNewPuzzle = if (!session.isDaily && isPro && onPlayAgain != null) { { onPlayAgain(s.difficulty) } } else null,
                onOtherGames = onBack,
                more = {
                    if (session.isDaily) DailyRankBadge(GameMode.SUDOKU)
                    if (won && s.hintsUsed > 0) {
                        Text("${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                    }
                    ScoreBreakdownCard(GameMode.SUDOKU, won, s.mistakes + 1, secs, if (won) 1 else 0, 1, s.hintsUsed, day = day)
                },
            )
        },
    ) { maxW, maxH ->
        // R2: the finished grid as big as the height left allows (digits scale with it).
        FinishedSquare(maxW, maxH) { side ->
            SudokuBoard(
                s, selected = null, revealSolution = s.status == SudokuStatus.LOST,
                digitSize = (side.value / 9f * 0.52f).coerceIn(11f, 22f).dp,
            ) {}
        }
    }
}

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"

/** Victory / game-over card (VictoryOverlay's look for a non-word board). */
@Composable
private fun SudokuOverlay(session: SudokuSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == SudokuStatus.WON
    val secs = session.elapsed
    // FINISH_SPEC R1: the shared win / lose popup (no word answers for Sudoku).
    val pts = com.wordocious.app.data.DailyScoring.breakdown(GameMode.SUDOKU.name, won, session.state.mistakes + 1, secs, if (won) 1 else 0, 1, session.state.hintsUsed).total.toInt()
    WinPopup(
        won = won, hostKey = "SUDOKU", accent = SUDOKU_ACCENT, onContinue = onDismiss,
        stats = listOf(
            WinStat(WinStatKind.GUESSES, "${session.state.mistakes}", "Mistakes"),
            WinStat(WinStatKind.TIME, timeText(secs), "Time"),
            WinStat(WinStatKind.POINTS, "%,d".format(pts), "Points"),
        ),
        onPlayAgain = onPlayAgain,
    )
}

@Composable
private fun StatBlock(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(1.dp)) {
        com.wordocious.app.ui.SoftNumber(value, 22.sp)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.6.sp)
    }
}

// ── Completed-today card for custom engines ─────────────────────────────────

/** The Records / Leaderboard "completed today" card for a More Games title: the
 *  summary line (through the mode's guess semantics); expanded, the finished
 *  puzzle rebuilt from the matches row (CompletedCustomBoard.kt; summary alone
 *  when it can't be) and the score breakdown. */
@Composable
fun CustomCompletedDailyCard(mode: GameMode) {
    val seed = remember(mode) { com.wordocious.app.todayLocalSeed(mode.name) }
    val tick by DailyCompletionsService.completionTick.collectAsState()
    val cached = remember(mode, tick) { GameResultsService.prefetchedDailyMatch(seed) }
    var row by remember(mode, tick) { mutableStateOf(cached) }
    var expanded by remember { mutableStateOf(false) }
    // A row cached before `solutions` was selected can't rebuild the board: refetch it once.
    LaunchedEffect(mode, tick) { if (row?.solutions.isNullOrEmpty()) GameResultsService.fetchRecordedDailyMatch(seed)?.let { row = it } }
    // No disk-cached row yet (first view on this device): the header from today's cached
    // completion at its final height until the row lands, instead of no card and then a
    // card that shoves the rank banner and board down (founder, 2026-09-29).
    val r = row ?: run {
        DailyCompletionsService.readCache()[mode.name]?.let { c ->
            val gm = com.wordocious.app.ModeGen.byDbKey(mode.name)
            CompletedHeaderOnlyCard(
                won = c.completed,
                summary = "${formatGuessStat(gm?.guessSemantics ?: "guesses", gm?.guessBase ?: 1, c.guessCount)} · ${formatShortTime(c.timeSeconds)}",
            )
        }
        return
    }
    val uid = AuthService.profile.value?.id
    val won = r.winnerId != null && r.winnerId == uid
    val board = rememberFinishedBoard(mode, seed, r, won)
    val completion = DailyCompletionsService.readCache()[mode.name]
    val guessCount = completion?.guessCount ?: 1
    val g = com.wordocious.app.ModeGen.byDbKey(mode.name)
    Column(
        // 12dp under the card like every other completed-card variant (the leaderboard relies on
        // the card's own bottom gap; this one sat flush on the rank banner).
        Modifier.fillMaxWidth().padding(bottom = 12.dp).cardShadow(14.dp).clip(RoundedCornerShape(16.dp))
            .background(com.wordocious.app.ui.accentWash(if (won) Color(0xFF7C3AED) else Color(0xFF6B7891)))
            .border(1.5.dp, com.wordocious.app.ui.accentLine(if (won) Color(0xFF7C3AED) else Color(0xFF6B7891)), RoundedCornerShape(16.dp)),
    ) {
        Box(Modifier.fillMaxWidth().height(10.dp).background(Brush.horizontalGradient(
            if (won) listOf(Color(0xFF7C3AED), Color(0xFFA78BFA)) else listOf(Color(0xFF6B7891), Color(0xFF8D99B0)))))
        Row(
            Modifier.fillMaxWidth().clickableNoRipple { expanded = !expanded }.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            com.wordocious.app.ui.ResultBadge(won, size = 18.dp)
            Text(if (won) "COMPLETED TODAY" else "ATTEMPTED TODAY", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.6.sp,
                color = if (won) Color(0xFF7C3AED) else WTheme.textMuted)
            Spacer(Modifier.weight(1f))
            Text("${formatGuessStat(g?.guessSemantics ?: "guesses", g?.guessBase ?: 1, guessCount)} · ${formatShortTime(r.player1Time)}",
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        if (expanded) {
            Column(Modifier.padding(horizontal = 14.dp).padding(bottom = 14.dp, top = 4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                board?.let { FinishedBoardView(it) }
                ScoreBreakdownCard(mode, won, guessCount, r.player1Time, if (won) 1 else 0, 1, 0, day = todayLocalDate())
            }
        }
    }
}

/** Undo steps kept in a save (the reducer keeps 200 in memory); bounds the prefs write per move. */
private const val MAX_SAVED_UNDO = 50
