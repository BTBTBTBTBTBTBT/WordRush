package com.wordocious.app.ui.game

import android.app.Activity
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AdsManager
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.DailyScoring
import com.wordocious.app.data.GameResultsService
import com.wordocious.app.data.RatingsPrompt
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.data.ShareImage
import com.wordocious.app.data.SoundManager
import com.wordocious.app.todayLocalDate
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.CROSSWORD_BLOCK
import com.wordocious.core.CROSSWORD_DAILY_EPOCH
import com.wordocious.core.CROSSWORD_EMPTY
import com.wordocious.core.CROSSWORD_TOTAL_BOARDS
import com.wordocious.core.CrosswordAction
import com.wordocious.core.CrosswordBank
import com.wordocious.core.CrosswordEntry
import com.wordocious.core.CrosswordPuzzle
import com.wordocious.core.CrosswordState
import com.wordocious.core.CrosswordStatus
import com.wordocious.core.GameMode
import com.wordocious.core.HolidayTable
import com.wordocious.core.createCrosswordState
import com.wordocious.core.crosswordDailyNumber
import com.wordocious.core.crosswordEntriesAt
import com.wordocious.core.crosswordEntryCells
import com.wordocious.core.crosswordEntrySolved
import com.wordocious.core.crosswordGuessCount
import com.wordocious.core.crosswordMatchRow
import com.wordocious.core.crosswordPuzzleForDay
import com.wordocious.core.crosswordPuzzleForSeed
import com.wordocious.core.crosswordReduce
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Crosswordocious (More Games §13) — the Android twin of components/crossword/*
// and CrosswordView.swift. A themed fill-in sayings crossword: every clue is a
// familiar phrase with one blank, the answer the missing word. Tap a cell or a
// clue, type; letters are free to set and clear. Check locks right letters,
// clears wrong ones and counts (guess_count = min(checks, 98) + 1). Reveal a
// letter (1 hint) or a word (2). "Reveal all" is the only loss. The grid
// completes itself the moment every cell is right.

private val CROSSWORD_ACCENT = Color(0xFF475569)
/** One purple look (founder, §13): every cell the purple tile tint, every number a purple badge; nothing marks the theme. */
private val CELL_BG = Color(0xFFEDE9FE)
private val CELL_BORDER = Color(0xFFC4B5FD)
private val CELL_TEXT = Color(0xFF5B21B6)
private val PURPLE = Color(0xFF7C3AED)
private val CROSSWORD_HINT = Color(0xFF8B5CF6)
private val CROSSWORD_WRONG = Color(0xFFDC2626)
private val LOCKED_BG = Color(0xFFDDD6FE)

/** Display titles for the shared holiday calendar keys (§20) — mirrors apps/web/lib/holidays.ts HOLIDAY_TITLES exactly. */
private val HOLIDAY_TITLES = mapOf(
    "newyear" to "New Year", "mlkday" to "MLK Day", "groundhog" to "Groundhog Day", "valentines" to "Valentine's Day", "presidents" to "Presidents' Day",
    "leapday" to "Leap Day", "mardigras" to "Mardi Gras", "stpatricks" to "St Patrick's Day", "aprilfools" to "April Fools", "easter" to "Easter",
    "earthday" to "Earth Day", "cincodemayo" to "Cinco de Mayo", "mothersday" to "Mother's Day", "memorial" to "Memorial Day", "fathersday" to "Father's Day",
    "juneteenth" to "Juneteenth", "july4" to "Fourth of July", "labor" to "Labor Day", "indigenous" to "Harvest Moon", "halloween" to "Halloween",
    "veterans" to "Veterans Day", "thanksgiving" to "Thanksgiving", "christmas" to "Christmas", "kwanzaa" to "Kwanzaa", "lunarnewyear" to "Lunar New Year",
    "passover" to "Passover", "diwali" to "Diwali", "hanukkah" to "Hanukkah",
)

// ── Session ─────────────────────────────────────────────────────────────────

class CrosswordSession(val seed: String, val isDaily: Boolean) {
    private val bank: CrosswordBank = CrosswordBank.bundled ?: CrosswordBank(1, CROSSWORD_DAILY_EPOCH, emptyList(), emptyList())

    var state by mutableStateOf(
        createCrosswordState(
            run {
                val fallback = CrosswordPuzzle(
                    "none", "Little sayings", "sayings", 4, 3,
                    listOf(
                        CrosswordEntry(1, "A", 0, 0, "TEAM", "Work as a ___"),
                        CrosswordEntry(1, "D", 0, 0, "TIE", "___ the knot"),
                        CrosswordEntry(2, "A", 2, 0, "EASY", "___ does it"),
                    ),
                )
                (if (isDaily) crosswordPuzzleForDay(bank, todayLocalDate(), HolidayTable.bundled) else crosswordPuzzleForSeed(bank, seed)) ?: fallback
            },
            seed, System.currentTimeMillis(),
        ),
    )
        private set
    /** The cell the keyboard writes to, and the direction the cursor travels ("A" across / "D" down). */
    var selected by mutableStateOf<Int?>(null)
        private set
    var dir by mutableStateOf("A")
        private set
    var toast by mutableStateOf<String?>(null)
    /** Reveal all is two-tap: armed for three seconds, red while it waits. */
    var armReveal by mutableStateOf(false)
    /** Bumps on every Check that cleared letters so those cells shake once. */
    var shakeKey by mutableStateOf(0)
        private set
    var finalTimeSeconds by mutableStateOf<Int?>(null)
        private set
    var xpResult by mutableStateOf<GameResultsService.XpResult?>(null)
    var restoredFinished = false
        private set

    private var startMs = System.currentTimeMillis()
    private var restoredElapsedMs = 0L
    private var guidePauseStart: Long? = null
    private var recorded = false

    val isFinished get() = state.status != CrosswordStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, ((System.currentTimeMillis() - startMs) / 1000).toInt())
    val dailyNumber get() = crosswordDailyNumber(todayLocalDate())
    /** The holiday this puzzle was drawn from (its display title), or null for an everyday puzzle. */
    val holidayTitle: String? get() {
        val id = state.id
        val key = bank.holiday?.entries?.firstOrNull { (_, list) -> list.any { it.id == id } }?.key ?: return null
        return HOLIDAY_TITLES[key]
    }
    val checksLabel: String get() = if (state.checks == 0) "No checks" else "${state.checks} check${if (state.checks == 1) "" else "s"}"
    val points: Int get() = DailyScoring.breakdown(
        GameMode.CROSSWORD.name, state.status == CrosswordStatus.WON, state.guessCount, elapsed,
        if (state.status == CrosswordStatus.WON) 1 else 0, CROSSWORD_TOTAL_BOARDS, state.hintsUsed,
    ).total.toInt()

    /** The entry the cursor is in: the one running in [dir] through the selected cell, else whichever passes through it. */
    val activeEntry: CrosswordEntry? get() {
        val sel = selected ?: return null
        val here = crosswordEntriesAt(state, sel)
        return here.firstOrNull { it.dir == dir } ?: here.firstOrNull()
    }
    val activeCells: List<Int> get() = activeEntry?.let { crosswordEntryCells(state, it) } ?: emptyList()

    // Declared BEFORE init: restore() runs inside init and needs it. Declared below the
    // block it was null during construction, decode threw inside runCatching and every
    // save was silently ignored on the next open (Doug, Android production, 2026-09-25).
    private val json = Json { ignoreUnknownKeys = true }

    init {
        restore()
        if (selected == null) { selected = firstOpenCell(state); dir = state.entries.firstOrNull()?.dir ?: "A" }
    }

    fun beginTimer() { startMs = System.currentTimeMillis() - restoredElapsedMs }
    fun pauseForGuide() { if (guidePauseStart == null && !isFinished) guidePauseStart = System.currentTimeMillis() }
    fun resumeFromGuide() { guidePauseStart?.let { startMs += System.currentTimeMillis() - it; guidePauseStart = null } }

    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
        val id: String, val title: String, val w: Int, val h: Int, val entries: List<CrosswordEntry>, val solution: String,
        val fill: String, val locked: String, val revealed: String, val checks: Int, val hintsUsed: Int, val events: List<String>,
        val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
        val selected: Int? = null, val dir: String = "A",
    )
    private val storageKey get() = if (isDaily) "crossword-save-daily" else "crossword-save-$seed"

    private fun persist() {
        val s = state
        val dto = SaveDto(
            seed, todayLocalDate(), elapsed, System.currentTimeMillis(),
            s.id, s.title, s.w, s.h, s.entries, s.solution, s.fill, s.locked, s.revealed, s.checks, s.hintsUsed, s.events,
            s.status.key, s.ended, s.startTime, s.endTime, selected, dir,
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
        val n = dto.w * dto.h
        if (dto.w <= 0 || dto.h <= 0 || dto.solution.length != n || dto.fill.length != n || dto.locked.length != n || dto.revealed.length != n) return
        val status = CrosswordStatus.values().firstOrNull { it.key == dto.status } ?: CrosswordStatus.PLAYING
        state = CrosswordState(
            seed, dto.id, dto.title, dto.w, dto.h, dto.entries, dto.solution,
            dto.fill, dto.locked, dto.revealed, dto.checks, dto.hintsUsed, emptyList(), dto.events,
            status, dto.ended, dto.startTime, dto.endTime,
        )
        selected = dto.selected?.takeIf { it in 0 until n && dto.solution[it] != CROSSWORD_BLOCK }
        dir = if (dto.dir == "D") "D" else "A"
        restoredElapsedMs = dto.elapsed * 1000L
        if (status != CrosswordStatus.PLAYING) { finalTimeSeconds = dto.elapsed; recorded = true; restoredFinished = true }
    }

    private fun firstOpenCell(s: CrosswordState): Int? {
        val e = s.entries.firstOrNull() ?: return null
        val cells = crosswordEntryCells(s, e)
        return cells.firstOrNull { s.fill[it] == CROSSWORD_EMPTY } ?: cells.firstOrNull()
    }

    private fun dispatch(a: CrosswordAction, onFinished: () -> Unit) {
        if (isFinished) return
        state = crosswordReduce(state, a, System.currentTimeMillis())
        if (isFinished) onFinished()
        persist()
    }

    // ── Selection (web parity: crossword-game.tsx selectCell / pickEntry / advance) ──

    /** Tap a cell: select it; tap the selected cell again to switch Across/Down when both pass through it. */
    fun selectCell(cell: Int) {
        if (isFinished) return
        val s = state
        if (cell < 0 || cell >= s.solution.length || s.solution[cell] == CROSSWORD_BLOCK) return
        SoundManager.playKeyTap()
        val here = crosswordEntriesAt(s, cell)
        if (cell == selected) { if (here.size > 1) toggleDir(); return }
        if (here.isNotEmpty() && here.none { it.dir == dir }) dir = here[0].dir
        selected = cell
        persist()
    }
    fun toggleDir() { if (!isFinished) { dir = if (dir == "A") "D" else "A"; persist() } }
    /** Tap a clue: its first empty cell (or its first cell) in that direction. */
    fun pickEntry(e: CrosswordEntry) {
        if (isFinished) return
        SoundManager.playKeyTap()
        val cells = crosswordEntryCells(state, e)
        dir = e.dir
        selected = cells.firstOrNull { state.fill[it] == CROSSWORD_EMPTY } ?: cells.firstOrNull()
        persist()
    }
    /** After typing: the next open cell in the active entry, else the next unfinished entry's first empty cell. */
    private fun advance(s: CrosswordState, from: Int, entry: CrosswordEntry?) {
        if (entry == null) return
        val cells = crosswordEntryCells(s, entry)
        val k = cells.indexOf(from)
        val nextIn = cells.drop(k + 1).firstOrNull { s.fill[it] == CROSSWORD_EMPTY || s.locked[it] == '0' }
        if (nextIn != null) { selected = nextIn; return }
        val order = s.entries
        if (order.isEmpty()) return
        val idx = order.indexOfFirst { it.n == entry.n && it.dir == entry.dir }
        for (step in 1..order.size) {
            val e = order[((idx + step) % order.size + order.size) % order.size]
            if (crosswordEntrySolved(s, e)) continue
            val ec = crosswordEntryCells(s, e)
            dir = e.dir
            selected = ec.firstOrNull { s.fill[it] == CROSSWORD_EMPTY } ?: ec.firstOrNull()
            return
        }
    }

    fun type(ch: Char, onFinished: () -> Unit) {
        if (isFinished) return
        val sel = selected ?: return
        val letter = ch.uppercaseChar()
        if (letter !in 'A'..'Z') return
        if (state.locked[sel] == '1') { flash("That letter is locked"); return }
        val entry = activeEntry
        dispatch(CrosswordAction.Set(sel, letter.toString()), onFinished)
        if (!isFinished) { advance(state, sel, entry); persist() }
    }
    /** Delete clears the selected letter, or steps back along the entry (clearing what it lands on). */
    fun delete() {
        if (isFinished) return
        val sel = selected ?: return
        val s = state
        if (s.fill[sel] != CROSSWORD_EMPTY && s.locked[sel] == '0') { dispatch(CrosswordAction.Clear(sel)) {}; return }
        val cells = activeCells
        val k = cells.indexOf(sel)
        if (k > 0) {
            val prev = cells[k - 1]
            selected = prev
            if (s.locked[prev] == '0') dispatch(CrosswordAction.Clear(prev)) {} else persist()
        }
    }
    /** Enter jumps to the next unfinished entry. */
    fun advanceEntry() {
        if (isFinished) return
        val e = activeEntry ?: return
        val cells = activeCells
        if (cells.isEmpty()) return
        advance(state, cells.last(), e)
        persist()
    }

    fun check(onFinished: () -> Unit) {
        if (isFinished) return
        val s = state
        val any = s.fill.indices.any { s.fill[it] != CROSSWORD_EMPTY && s.fill[it] != CROSSWORD_BLOCK && s.locked[it] == '0' }
        if (!any) { flash("Fill in some letters first"); return }
        dispatch(CrosswordAction.Check, onFinished)
        val wrong = state.lastWrong.size
        if (wrong > 0) { flash("$wrong wrong letter${if (wrong == 1) "" else "s"} cleared"); SoundManager.playInvalid(); shakeKey++ }
        else { flash("Everything filled is right"); SoundManager.playSuccess() }
    }
    /** The red flash on letters a Check cleared lasts 700ms (web parity). */
    fun clearLastWrong() { if (state.lastWrong.isNotEmpty()) state = state.copy(lastWrong = emptyList()) }
    fun revealLetter(onFinished: () -> Unit) {
        if (isFinished) return
        val sel = selected ?: return
        dispatch(CrosswordAction.RevealLetter(sel), onFinished)
    }
    fun revealWord(onFinished: () -> Unit) {
        if (isFinished) return
        val e = activeEntry ?: return
        dispatch(CrosswordAction.RevealWord(e.n, e.dir), onFinished)
    }
    fun revealPuzzle(onFinished: () -> Unit) {
        if (isFinished) return
        if (!armReveal) { armReveal = true; flash("Tap again to reveal the whole puzzle (records a loss)"); return }
        armReveal = false
        dispatch(CrosswordAction.RevealPuzzle, onFinished)
    }

    suspend fun finish() {
        finalTimeSeconds = elapsed
        if (state.status == CrosswordStatus.WON) SoundManager.playSuccess() else SoundManager.playGameOver()
        if (recorded) return
        recorded = true
        val won = state.status == CrosswordStatus.WON
        val gc = crosswordGuessCount(state.checks)
        val (solutions, guesses) = crosswordMatchRow(state)
        val xp = GameResultsService.record(
            gameMode = GameMode.CROSSWORD, won = won, guessCount = gc, timeSeconds = elapsed,
            boardsSolved = if (won) 1 else 0, totalBoards = CROSSWORD_TOTAL_BOARDS, seed = seed,
            solutions = solutions, guesses = guesses, hintsUsed = state.hintsUsed,
        )
        xpResult = xp
        if (isDaily) DailyCompletionsService.noteCompletion(GameMode.CROSSWORD.name, won, gc, elapsed)
    }

    private fun flash(m: String) { toast = m }
}

// ── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun CrosswordScreen(
    seed: String,
    isDaily: Boolean,
    onBack: () -> Unit,
    onPlayAgain: (() -> Unit)? = null,
    onOpenDaily: (GameMode) -> Unit = {},
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val session = remember(seed) { CrosswordSession(seed, isDaily) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val isPro = AuthService.isProActive
    var showOverlay by remember(seed) { mutableStateOf(false) }
    var showGuide by remember { mutableStateOf(false) }
    var adGateDone by remember(seed) { mutableStateOf(false) }

    LaunchedEffect(seed) {
        val activity = context as? Activity
        if (!adGateDone && !session.isFinished && activity != null && AdsManager.active) {
            adGateDone = true
            AdsManager.showGameStartInterstitial(activity) { session.beginTimer() }
        } else { adGateDone = true; session.beginTimer() }
    }
    LaunchedEffect(session.toast) { if (session.toast != null) { kotlinx.coroutines.delay(1400); session.toast = null } }
    LaunchedEffect(session.state.lastWrong) { if (session.state.lastWrong.isNotEmpty()) { kotlinx.coroutines.delay(700); session.clearLastWrong() } }
    LaunchedEffect(session.armReveal) { if (session.armReveal) { kotlinx.coroutines.delay(3000); session.armReveal = false } }

    val onFinished: () -> Unit = {
        scope.launch {
            session.finish()
            if (!session.restoredFinished) showOverlay = true
            if (session.state.status == CrosswordStatus.WON) {
                RatingsPrompt.recordWin(context)
                (context as? Activity)?.let { RatingsPrompt.maybeAsk(it) }
            }
        }
    }

    androidx.activity.compose.BackHandler { onBack() }

    // One clock for the header.
    val tick by produceState(0, session.isFinished) {
        while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ }
    }

    Box(Modifier.fillMaxSize().background(WTheme.bg).statusBarsPadding()) {
        if (session.isFinished) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CrosswordHeader(session, tick)
                CrosswordGrid(session, finished = true)
                ClueColumns(session, finished = true)
                CrosswordResult(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
            }
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                CrosswordHeader(session, tick)
                Column(
                    Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CrosswordGrid(session, finished = false)
                    ClueColumns(session, finished = false)
                }
                ActiveClueBar(session)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Capsule(if (session.state.checks > 0) "Check · ${session.state.checks}" else "Check", Icons.Filled.DoneAll) { SoundManager.playKeyTap(); session.check(onFinished) }
                    Capsule("Letter", Icons.Filled.Lightbulb) { SoundManager.playKeyTap(); session.revealLetter(onFinished) }
                    Capsule(if (session.state.hintsUsed > 0) "Word · ${session.state.hintsUsed}" else "Word", Icons.Filled.Visibility) { SoundManager.playKeyTap(); session.revealWord(onFinished) }
                    Capsule(if (session.armReveal) "Reveal all?" else "Reveal all", Icons.Filled.Flag, danger = session.armReveal) { session.revealPuzzle(onFinished) }
                }
                KeyboardView(onKey = { session.type(it, onFinished) }, onDelete = { session.delete() }, onEnter = { session.advanceEntry() })
                Spacer(Modifier.height(6.dp))
            }
        }
        session.toast?.let {
            Box(Modifier.fillMaxWidth().padding(top = 112.dp), contentAlignment = Alignment.TopCenter) {
                Text(it, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 24.dp).clip(RoundedCornerShape(10.dp)).background(WTheme.text.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 10.dp))
            }
        }
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) CrosswordOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(CROSSWORD_ACCENT, onBack) }
        CornerHelpButton(CROSSWORD_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
        if (showGuide) GuideSheet(mode = GameMode.CROSSWORD, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

/** CROSSWORDOCIOUS on one line at any phone width — shrinks from 24sp until it fits between the corner buttons (web: clamp(17px, 5.6vw, 24px)). */
@Composable
private fun FitTitle(text: String) {
    var fontSize by remember { mutableStateOf(24.sp) }
    var settled by remember { mutableStateOf(false) }
    Text(
        text, fontSize = fontSize, fontWeight = FontWeight.Black, color = CROSSWORD_ACCENT, fontFamily = Nunito,
        maxLines = 1, softWrap = false, textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 52.dp).drawWithContent { if (settled) drawContent() },
        onTextLayout = { r -> if (r.didOverflowWidth && fontSize.value > 14f) fontSize = (fontSize.value * 0.92f).sp else settled = true },
    )
}

@Composable
private fun CrosswordHeader(session: CrosswordSession, tick: Int) {
    val s = session.state
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(top = 6.dp)) {
        FitTitle("CROSSWORDOCIOUS")
        Text(s.title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.padding(horizontal = 52.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            session.holidayTitle?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CROSSWORD_ACCENT) }
            Text("${s.correctCount}/${s.letterCount} letters", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text(session.checksLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            @Suppress("UNUSED_EXPRESSION") tick
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Icon(Icons.Filled.Schedule, null, tint = WTheme.textMuted, modifier = Modifier.size(11.dp))
                Text(clockText(session.elapsed), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
    }
}

// ── Grid ────────────────────────────────────────────────────────────────────

/**
 * The grid, always centered (§13 round 11): a sparse criss-cross of purple tiles;
 * blocks are simply absent. The letter is centered in its cell exactly like a
 * Classic tile; the clue number is a small top-left badge that never touches
 * the letter. The active entry wears a 10% accent wash and the selected cell an
 * accent cursor ring; checked-locked cells go a deeper purple, revealed cells
 * violet with white ink, and cells a Check just cleared flash red for 700ms.
 */
@Composable
private fun CrosswordGrid(session: CrosswordSession, finished: Boolean) {
    val s = session.state
    val numbers = HashMap<Int, Int>()
    for (e in s.entries) { val start = e.r * s.w + e.c; if (start !in numbers) numbers[start] = e.n }
    val selected = if (finished) null else session.selected
    val active = if (finished) emptySet() else session.activeCells.toSet()
    val wrongCells = s.lastWrong.toSet()
    val gap = 3.dp
    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val cell = ((maxWidth - gap * (s.w - 1)) / s.w).coerceAtMost(42.dp)
        val fs = (cell.value * 0.43f).coerceIn(12f, 18f).sp
        val ns = (cell.value * 0.2f).coerceIn(7f, 9f).sp
        Column(verticalArrangement = Arrangement.spacedBy(gap)) {
            for (r in 0 until s.h) {
                Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                    for (c in 0 until s.w) {
                        val i = r * s.w + c
                        if (i >= s.solution.length || s.solution[i] == CROSSWORD_BLOCK) { Spacer(Modifier.size(cell)); continue }
                        val ch = if (s.fill[i] == CROSSWORD_EMPTY) "" else s.fill[i].toString()
                        val locked = s.locked[i] == '1'
                        val revealed = s.revealed[i] != '.'
                        val isSel = selected == i
                        val inActive = i in active
                        val wrong = i in wrongCells
                        var bg = CELL_BG; var border = CELL_BORDER; var ink = CELL_TEXT
                        if (revealed) { bg = CROSSWORD_HINT; border = CROSSWORD_HINT; ink = Color.White }
                        else if (locked) { bg = LOCKED_BG; border = PURPLE; ink = PURPLE }
                        if (inActive && !revealed) bg = CROSSWORD_ACCENT.copy(alpha = 0.1f)
                        if (wrong) { border = CROSSWORD_WRONG; ink = CROSSWORD_WRONG }
                        if (isSel) border = CROSSWORD_ACCENT
                        CrosswordCell(
                            ch, numbers[i], bg, border, ink, if (revealed) Color.White else PURPLE,
                            isSel, wrong, session.shakeKey, cell, fs, ns,
                        ) { if (!finished) session.selectCell(i) }
                    }
                }
            }
        }
    }
}

@Composable
private fun CrosswordCell(
    ch: String, number: Int?, bg: Color, border: Color, ink: Color, numberInk: Color,
    selected: Boolean, wrong: Boolean, shakeKey: Int, cellSize: Dp, fs: TextUnit, ns: TextUnit, onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(6.dp)
    val surface = WTheme.surface
    Box(
        Modifier.size(cellSize)
            .then(if (wrong) Modifier.shakeOnReject(shakeKey) else Modifier)
            .drawBehind {
                if (selected) {
                    // The web's double box-shadow: a 2px surface gap, then a 2px accent ring outside the tile.
                    val s2 = 2.dp.toPx()
                    drawRoundRect(surface, Offset(-s2 / 2f, -s2 / 2f), Size(size.width + s2, size.height + s2), CornerRadius(7.dp.toPx()), style = Stroke(s2))
                    drawRoundRect(CROSSWORD_ACCENT, Offset(-s2 * 1.5f, -s2 * 1.5f), Size(size.width + s2 * 3f, size.height + s2 * 3f), CornerRadius(8.dp.toPx()), style = Stroke(s2))
                }
            }
            .clip(shape).background(bg).border(2.dp, border, shape)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(ch, fontSize = fs, fontWeight = FontWeight.Black, color = ink, fontFamily = Nunito, maxLines = 1, softWrap = false)
        if (number != null) {
            Text(
                "$number", fontSize = ns, lineHeight = ns, fontWeight = FontWeight.Black, color = numberInk, fontFamily = Nunito,
                modifier = Modifier.align(Alignment.TopStart).padding(start = 2.dp, top = 1.dp),
            )
        }
    }
}

/** The clue-number badge: purple tile tint, purple ink — the same badge in the clue lists and the active-clue bar. */
@Composable
private fun NumberBadge(label: String, size: Dp, fontSize: TextUnit) {
    Box(
        Modifier.size(size).clip(RoundedCornerShape(4.dp)).background(CELL_BG).border(1.dp, CELL_BORDER, RoundedCornerShape(4.dp)),
        contentAlignment = Alignment.Center,
    ) { Text(label, fontSize = fontSize, fontWeight = FontWeight.Black, color = PURPLE, fontFamily = Nunito, maxLines = 1, softWrap = false) }
}

// ── Clues ───────────────────────────────────────────────────────────────────

/** Across and Down side by side (§13 round 10), centered under the grid; solved entries strike through and dim; the active clue is washed in the accent. */
@Composable
private fun ClueColumns(session: CrosswordSession, finished: Boolean) {
    Row(
        Modifier.fillMaxWidth().widthIn(max = 700.dp).padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ClueColumn(session, "A", "Across", finished, Modifier.weight(1f))
        ClueColumn(session, "D", "Down", finished, Modifier.weight(1f))
    }
}

@Composable
private fun ClueColumn(session: CrosswordSession, dir: String, title: String, finished: Boolean, modifier: Modifier) {
    val s = session.state
    val active = if (finished) null else session.activeEntry
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.5.sp, modifier = Modifier.padding(start = 4.dp))
        s.entries.filter { it.dir == dir }.forEach { e ->
            val solved = crosswordEntrySolved(s, e)
            val isActive = active != null && active.n == e.n && active.dir == e.dir
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp))
                    .background(if (isActive) CROSSWORD_ACCENT.copy(alpha = 0.08f) else Color.Transparent)
                    .clickableNoRipple { if (!finished) session.pickEntry(e) }
                    .padding(horizontal = 4.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top,
            ) {
                NumberBadge("${e.n}", 20.dp, 10.sp)
                Text(
                    buildAnnotatedString {
                        append(e.clue)
                        if (finished) { append(" "); withStyle(SpanStyle(color = PURPLE, fontWeight = FontWeight.Black)) { append(e.answer) } }
                    },
                    fontSize = 12.sp, lineHeight = 15.sp, fontWeight = if (solved) FontWeight.Normal else FontWeight.Bold, color = WTheme.text,
                    textDecoration = if (solved) TextDecoration.LineThrough else null,
                    modifier = Modifier.weight(1f).alpha(if (solved) 0.5f else 1f).padding(top = 2.dp),
                )
            }
        }
    }
}

/** The sticky active-clue bar above the keyboard: "3A" badge + the clue; tap to switch direction. */
@Composable
private fun ActiveClueBar(session: CrosswordSession) {
    val e = session.activeEntry ?: return
    Row(
        Modifier.fillMaxWidth().widthIn(max = 700.dp).clip(RoundedCornerShape(12.dp))
            .background(CROSSWORD_ACCENT.copy(alpha = 0.07f))
            .border(1.5.dp, CROSSWORD_ACCENT.copy(alpha = 0.27f), RoundedCornerShape(12.dp))
            .clickableNoRipple { SoundManager.playKeyTap(); session.toggleDir() }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        NumberBadge("${e.n}${e.dir}", 24.dp, 11.sp)
        Text(e.clue, fontSize = 15.sp, lineHeight = 19.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, modifier = Modifier.weight(1f))
        Icon(Icons.Filled.SwapHoriz, "Switch direction", tint = CROSSWORD_ACCENT, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun Capsule(label: String, icon: ImageVector, danger: Boolean = false, onClick: () -> Unit) {
    val fg = if (danger) CROSSWORD_WRONG else CROSSWORD_ACCENT
    Row(
        Modifier.clip(CircleShape)
            .background(fg.copy(alpha = 0.05f))
            .border(1.5.dp, fg.copy(alpha = 0.4f), CircleShape)
            .clickableNoRipple(onClick)
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = fg, modifier = Modifier.size(13.dp))
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = fg, maxLines = 1, softWrap = false)
    }
}

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun CrosswordResult(
    session: CrosswordSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == CrosswordStatus.WON
    val secs = session.elapsed
    val gc = s.guessCount
    val context = LocalContext.current
    val hintsText = if (s.hintsUsed > 0) " · ${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}" else ""
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 12.dp)) {
        Row(
            Modifier.widthIn(max = 420.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.surface)
                .border(1.dp, WTheme.border, RoundedCornerShape(12.dp)).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(CROSSWORD_ACCENT.copy(alpha = 0.08f))
                    .border(2.dp, CROSSWORD_ACCENT.copy(alpha = 0.27f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(if (won) (if (s.checks == 0) "✓" else "${s.checks}") else "✗", fontSize = 20.sp, fontWeight = FontWeight.Black, color = CROSSWORD_ACCENT, fontFamily = Nunito)
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    if (won) (if (s.checks == 0) "Grid finished clean" else "Grid finished") else "Puzzle revealed",
                    fontSize = 15.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF16A34A) else Color(0xFFEF4444), fontFamily = Nunito,
                )
                Text("${session.checksLabel} · ${timeText(secs)}$hintsText", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            ResultAction(Icons.Filled.Home, "Home", CROSSWORD_ACCENT, onBack)
            ResultAction(Icons.Filled.Share, "Share", CROSSWORD_ACCENT) {
                val num = if (session.isDaily) session.dailyNumber else null
                val meta = "${num?.let { "#$it · " } ?: ""}${session.checksLabel} · ${clockText(secs)}"
                val cleanLabel = if (s.checks == 0) "Clean" else session.checksLabel
                val text = "Wordocious Crosswordocious${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${clockText(secs)} · $cleanLabel · wordocious.com/crosswordocious"
                val bmp = ShareImage.renderCrossword(context, s.w, s.h, s.solution, s.checks, won, meta)
                ShareImage.shareBitmap(context, bmp, text)
            }
            if (!session.isDaily && isPro && onPlayAgain != null) ResultAction(Icons.Filled.Refresh, "Play Again", Color(0xFFD97706)) { onPlayAgain() }
        }
        if (session.isDaily) DailyRankBadge(GameMode.CROSSWORD)
        ScoreBreakdownCard(GameMode.CROSSWORD, won, gc, secs, if (won) 1 else 0, CROSSWORD_TOTAL_BOARDS, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.CROSSWORD, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
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
/** Always m:ss — the header clock and the share caption. */
private fun clockText(s: Int) = "${s / 60}:${"%02d".format(s % 60)}"

@Composable
private fun CrosswordOverlay(session: CrosswordSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == CrosswordStatus.WON
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
                    StatBlock("${session.state.checks}", "CHECKS"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
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
