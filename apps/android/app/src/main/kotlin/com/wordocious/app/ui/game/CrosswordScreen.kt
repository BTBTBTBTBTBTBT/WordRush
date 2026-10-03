package com.wordocious.app.ui.game

import com.wordocious.app.ui.gameBackground
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
import androidx.compose.material.icons.filled.FormatListNumbered
import androidx.compose.material.icons.filled.GridOn
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
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
import com.wordocious.app.ui.squishClickable
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
private val PURPLE = Color(0xFF7C3AED)

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
    /** BI18: the clue list in place of the grid (the Clues toggle beside the clue bar). */
    var showClues by mutableStateOf(false)
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
    private var began = false
    /** Why the clock is stopped (guide open, app in background); it runs only while the set is empty. */
    enum class Pause { GUIDE, BACKGROUND }
    private val pausedFor = mutableSetOf<Pause>()
    private var pauseStart: Long? = null
    private var recorded = false

    val isFinished get() = state.status != CrosswordStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, (((pauseStart ?: System.currentTimeMillis()) - startMs) / 1000).toInt())
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

    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
        val id: String, val title: String, val w: Int, val h: Int, val entries: List<CrosswordEntry>, val solution: String,
        val fill: String, val locked: String, val revealed: String, val checks: Int, val hintsUsed: Int, val events: List<String>,
        val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
        val selected: Int? = null, val dir: String = "A",
    )
    private val storageKey get() = if (isDaily) "crossword-save-daily" else "crossword-save-$seed"

    private fun persist() {
        if (!isDaily && isFinished) { SettingsPref.remove(storageKey); return }
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
    /** Arrow keys (web crossword-game.tsx move()): the next open cell that way; the cursor turns to match. */
    fun moveCursor(dr: Int, dc: Int) {
        if (isFinished) return
        val sel = selected ?: return
        val s = state
        var r = sel / s.w
        var c = sel % s.w
        repeat(maxOf(s.w, s.h)) {
            r += dr; c += dc
            if (r < 0 || c < 0 || r >= s.h || c >= s.w) return
            val i = r * s.w + c
            if (s.solution[i] != CROSSWORD_BLOCK) { selected = i; dir = if (dr != 0) "D" else "A"; persist(); return }
        }
    }
    /** Tap a clue: its first empty cell (or its first cell) in that direction. */
    fun pickEntry(e: CrosswordEntry) {
        if (isFinished) return
        SoundManager.playKeyTap()
        val cells = crosswordEntryCells(state, e)
        dir = e.dir
        selected = cells.firstOrNull { state.fill[it] == CROSSWORD_EMPTY } ?: cells.firstOrNull()
        showClues = false // BI18: a picked clue goes back to the grid
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
        else { flash("Everything filled is right"); SoundManager.playPartial() }
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
    PauseClockInBackground(session, session::enterBackground, session::leaveBackground)
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


    // Physical keyboard (founder, 2026-09-30; web crossword-game.tsx): A–Z fills the selected cell,
    // Backspace/Delete erases, Enter/Tab jumps to the next entry, arrows move, Space flips Across/Down.
    val xwKeys = keyboardViewKeys(onKey = { session.type(it, onFinished) }, onDelete = { session.delete() }, onEnter = { session.advanceEntry() })
    ProvideFeedbackAnchor {
    Box(
        Modifier.fillMaxSize()
            .hardwareKeys(enabled = !session.isFinished && !showOverlay && !showGuide) { k ->
                if (session.selected == null) return@hardwareKeys false
                when (k) {
                    HwKey.Left -> { session.moveCursor(0, -1); true }
                    HwKey.Right -> { session.moveCursor(0, 1); true }
                    HwKey.Up -> { session.moveCursor(-1, 0); true }
                    HwKey.Down -> { session.moveCursor(1, 0); true }
                    HwKey.Tab -> { session.advanceEntry(); true }
                    HwKey.Space -> { session.toggleDir(); true }
                    else -> xwKeys(k)
                }
            }
            .gameBackground { background(WTheme.bg) }.statusBarsPadding(),
    ) {
        if (session.isFinished) {
            // FINISH_SPEC R2: the one-screen finished screen (header · strip · board · dock).
            CrosswordFinished(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
        } else {
            // BI18 (founder 10-03: "the daily today required you to scroll"): the whole puzzle fits
            // one screen in play — the compact header, the grid sized from the band's width AND
            // height for its real cols × rows, the clue bar and the keyboard pinned. The clue list
            // sits behind the Clues toggle beside the clue bar (it scrolls inside the band).
            val shortScreen = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp < 700
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                CrosswordPlayHeader(session)
                if (session.showClues) {
                    Column(
                        Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) { ClueColumns(session, finished = false) }
                } else {
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CrosswordGrid(session, finished = false, fitHeight = true) }
                }
                Row(Modifier.fillMaxWidth().widthIn(max = 700.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) { ActiveClueBar(session) }
                    if (session.activeEntry != null) CluesToggle(session.showClues) { SoundManager.playKeyTap(); session.showClues = !session.showClues }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    // BI22: fixed labels — the used counts are corner badges (overlays); "Reveal all?" keeps its width.
                    Capsule("Check", Icons.Filled.DoneAll, com.wordocious.app.ui.CandyColor.PURPLE, count = session.state.checks) { SoundManager.playKeyTap(); session.check(onFinished) }
                    Capsule("Letter", Icons.Filled.Lightbulb, com.wordocious.app.ui.CandyColor.AMBER) { SoundManager.playKeyTap(); session.revealLetter(onFinished) }
                    Capsule("Word", Icons.Filled.Visibility, com.wordocious.app.ui.CandyColor.AMBER, count = session.state.hintsUsed) { SoundManager.playKeyTap(); session.revealWord(onFinished) }
                    Capsule(if (session.armReveal) "Reveal all?" else "Reveal all", Icons.Filled.Flag, if (session.armReveal) com.wordocious.app.ui.CandyColor.PINK else com.wordocious.app.ui.CandyColor.PEACH, reserve = "Reveal all?") { session.revealPuzzle(onFinished) }
                }
                // BI18: 44 dp keys on short phones, like Muddle's one-screen rule.
                KeyboardView(onKey = { session.type(it, onFinished) }, onDelete = { session.delete() }, onEnter = { session.advanceEntry() }, keyHeight = if (shortScreen) 44.dp else null)
                Spacer(Modifier.height(6.dp))
            }
        }
        // G5 a toast is a tinted pill (no dark slab, no white).
        // The candy feedback toast, centered on the header meta row (never the title art or the board).
        GameFeedbackToast(session.toast, fallbackTop = 112.dp)
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) CrosswordOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(CROSSWORD_ACCENT, onBack) }
        CornerHelpButton(CROSSWORD_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET))
        if (showGuide) GuideSheet(mode = GameMode.CROSSWORD, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
    }
}

/** CROSSWORDOCIOUS on one line at any phone width — shrinks from 24sp until it fits between the corner buttons (web: clamp(17px, 5.6vw, 24px)). */
@Composable
private fun FitTitle(text: String) {
    var fontSize by remember { mutableStateOf(24.sp) }
    var settled by remember { mutableStateOf(false) }
    // The game's host (D, glasses and a pencil: MASCOT_SPEC §5) stands at the left of the title, static.
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 52.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        com.wordocious.app.ui.Mascots.hostFor("CROSSWORD")?.let { com.wordocious.app.ui.Mascot(it, 30.dp) }
        Text(
            text, fontSize = fontSize, fontWeight = FontWeight.Black, color = CROSSWORD_ACCENT, fontFamily = Nunito,
            maxLines = 1, softWrap = false, textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f, fill = false).drawWithContent { if (settled) drawContent() },
            onTextLayout = { r -> if (r.didOverflowWidth && fontSize.value > 14f) fontSize = (fontSize.value * 0.92f).sp else settled = true },
        )
    }
}

@Composable
private fun CrosswordHeader(session: CrosswordSession) {
    // The tick lives HERE, not in the screen body, so only the header recomposes each second (founder, 2026-09-29).
    val tick by produceState(0, session.isFinished) { while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ } }
    val s = session.state
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(top = 6.dp)) {
        // The game's title art: lettering + host (ART_SPEC §10); the fitted text otherwise.
        com.wordocious.app.ui.GameHeaderTitle("CROSSWORD") { FitTitle("CROSSWORDOCIOUS") }
        Text(s.title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.padding(horizontal = 52.dp))
        Row(Modifier.feedbackAnchor(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
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

/**
 * BI18: the play header is compact like Muddle's — the title art (≤ 44 dp) IN the corner-button
 * row between Home and Help, then the puzzle title and the meta line.
 */
@Composable
private fun CrosswordPlayHeader(session: CrosswordSession) {
    val tick by produceState(0, session.isFinished) { while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ } }
    val s = session.state
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(1.dp)) {
        val res = com.wordocious.app.ui.gameTitleArtResForKey("CROSSWORD")
        Box(Modifier.fillMaxWidth().height(52.dp).padding(top = GAME_CONTROLS_INSET).padding(horizontal = 56.dp), contentAlignment = Alignment.Center) {
            if (res != null) com.wordocious.app.ui.FittedGameTitleArt(res, com.wordocious.app.ui.gameTitleLabelForKey("CROSSWORD"), maxHeight = 44.dp)
            else FitTitle("CROSSWORDOCIOUS")
        }
        Text(s.title, fontSize = 14.sp, lineHeight = 17.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.padding(horizontal = 12.dp))
        Row(Modifier.feedbackAnchor(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, lineHeight = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            session.holidayTitle?.let { Text(it, fontSize = 12.sp, lineHeight = 15.sp, fontWeight = FontWeight.Bold, color = CROSSWORD_ACCENT) }
            Text("${s.correctCount}/${s.letterCount} letters", fontSize = 12.sp, lineHeight = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text(session.checksLabel, fontSize = 12.sp, lineHeight = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            @Suppress("UNUSED_EXPRESSION") tick
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Icon(Icons.Filled.Schedule, null, tint = WTheme.textMuted, modifier = Modifier.size(11.dp))
                Text(clockText(session.elapsed), fontSize = 12.sp, lineHeight = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
    }
}

// ── Grid ────────────────────────────────────────────────────────────────────

/**
 * The grid, always centered (§13 round 11): a sparse criss-cross of tiles; blocks are
 * simply absent. FINISH_SPEC J3 + L: every cell is a B1 glossy tile (empty = frosted,
 * a penciled letter the typed tile, checked-locked purple, revealed violet, a cell a
 * Check just cleared the red not-a-word tile for 700ms) with the clue number as a small
 * soft badge in the top-left corner; the active entry's cells wear a lilac face and the
 * selected cell an accent cursor ring. The grid sits in the shared game tray (purple
 * when solved, slate when revealed). No grid lines — gaps only.
 */
@Composable
private fun CrosswordGrid(session: CrosswordSession, finished: Boolean, fitHeight: Boolean = false) = CrosswordGrid(
    session.state, if (finished) null else session.selected, if (finished) emptySet() else session.activeCells.toSet(), session.shakeKey,
    interactive = !finished, fitHeight = fitHeight,
) { if (!finished) session.selectCell(it) }

/** The active entry's faces: a soft lilac wash instead of frosted / white. */
private val ACTIVE_EMPTY = TileLooks.EMPTY.copy(faceTop = Color(0xFFF4EEFF), faceMid = Color(0xFFEDE4FF), faceBottom = Color(0xFFE6DAFF), ring = Color(0x597C3AED))
private val ACTIVE_EMPTY_DARK = TileLooks.EMPTY_DARK.copy(faceTop = Color(0x40A78BFA), faceMid = Color(0x33A78BFA), faceBottom = Color(0x2EA78BFA))
private val ACTIVE_TYPED = TileLooks.TYPED.copy(faceTop = Color(0xFFF7F2FF), faceMid = Color(0xFFF1E9FF), faceBottom = Color(0xFFEBE0FF))

/** The grid from a state alone: the game above, and the finished grid in the
 *  Completed-Today card with smaller cells (founder, 2026-09-29). [interactive] =
 *  the cells press (squish) and select. */
@Composable
internal fun CrosswordGrid(
    s: CrosswordState, selected: Int?, active: Set<Int>, shakeKey: Int, maxCell: Dp = 42.dp, interactive: Boolean = true,
    /** BI18: size the cell from the space's height too (the play band), so the whole grid is on screen. */
    fitHeight: Boolean = false,
    onSelect: (Int) -> Unit,
) {
    val numbers = HashMap<Int, Int>()
    for (e in s.entries) { val start = e.r * s.w + e.c; if (start !in numbers) numbers[start] = e.n }
    val wrongCells = s.lastWrong.toSet()
    val small = maxCell < 42.dp
    val gap = if (small) 2.dp else 3.dp
    val trayPad = if (small) 7.dp else 10.dp
    val dark = WTheme.isDark
    val tray = finishTray(s.status != CrosswordStatus.PLAYING, s.status == CrosswordStatus.WON)
    BoxWithConstraints(if (fitHeight) Modifier.fillMaxSize() else Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val cell = if (fitHeight) {
            // BI18: width AND height for the real cols × rows (BoardSizing.crosswordCell, unit-tested):
            // the tray's padding + border off both axes, its lip and the cursor ring's room off the height.
            val chrome = (trayPad + GameTrayStyle.BORDER).value * 2f
            BoardSizing.crosswordCell(
                maxWidth.value, maxHeight.value.takeIf { constraints.hasBoundedHeight }, s.w, s.h, gap.value,
                chromeX = chrome, chromeY = chrome + GameTrayStyle.LIP.value + 6f, maxCell = maxCell.value,
            ).dp
        } else ((maxWidth - trayPad * 2 - gap * (s.w - 1)) / s.w).coerceAtMost(maxCell)
        // Letters and clue numbers scale with the cell (BI18: readable down to the 14 dp floor).
        val glyph = if (fitHeight) maxOf(cell.value * 0.46f, minOf(11f, cell.value * 0.56f)).coerceAtMost(19f)
            else (cell.value * 0.46f).coerceIn(if (small) 9f else 12f, 19f)
        val ns = if (fitHeight) maxOf(5f, cell.value * 0.2f, minOf(7f, cell.value * 0.3f)).coerceAtMost(9f).sp
            else (cell.value * 0.2f).coerceIn(if (small) 5f else 7f, 9f).sp
        GameTray(
            CROSSWORD_ACCENT, state = tray, corner = if (small) 14.dp else GameTrayStyle.CORNER,
            padding = androidx.compose.foundation.layout.PaddingValues(trayPad),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                for (r in 0 until s.h) {
                    Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                        for (c in 0 until s.w) {
                            val i = r * s.w + c
                            if (i >= s.solution.length || s.solution[i] == CROSSWORD_BLOCK) { Spacer(Modifier.size(cell)); continue }
                            val ch = if (s.fill[i] == CROSSWORD_EMPTY) "" else s.fill[i].toString()
                            val locked = s.locked[i] == '1'
                            val revealed = s.revealed[i] != '.'
                            val inActive = i in active
                            val wrong = i in wrongCells
                            val look = when {
                                wrong -> TileLooks.BAD
                                revealed -> VIOLET_LOOK
                                locked -> TileLooks.CORRECT
                                ch.isNotEmpty() -> if (inActive) ACTIVE_TYPED else TileLooks.TYPED
                                inActive -> if (dark) ACTIVE_EMPTY_DARK else ACTIVE_EMPTY
                                else -> TileLooks.of(TileFace.EMPTY, dark = dark)
                            }
                            CrosswordCell(ch, numbers[i], look, selected == i, wrong, shakeKey, cell, glyph, ns, interactive) { onSelect(i) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CrosswordCell(
    ch: String, number: Int?, look: TileLook, selected: Boolean, wrong: Boolean, shakeKey: Int,
    cellSize: Dp, glyphDp: Float, ns: TextUnit, interactive: Boolean, onClick: () -> Unit,
) {
    val solid = look.glyph == Color.White
    Box(
        Modifier.size(cellSize)
            .then(if (wrong) Modifier.shakeOnReject(shakeKey) else Modifier)
            .then(if (interactive) Modifier.squishClickable(onClick = onClick) else Modifier)
            .typePop(ch)
            .drawBehind {
                if (selected) {
                    // The cursor ring, just outside the tile.
                    val s2 = 2.dp.toPx()
                    drawRoundRect(
                        CROSSWORD_ACCENT, Offset(-s2 * 1.5f, -s2 * 1.5f), Size(size.width + s2 * 3f, size.height + s2 * 3f),
                        CornerRadius(size.minDimension * TILE_CORNER + s2 * 1.5f), style = Stroke(s2),
                    )
                }
                drawGameTile(look, glowAlpha = if (wrong) 0.8f else 0f)
            },
        contentAlignment = Alignment.Center,
    ) {
        TileGlyph(ch, look.glyph, look.glyphShadow, glyphDp, cellSize.value)
        if (number != null) {
            // J3 the clue number: a small soft badge tucked in the corner, clear of the letter.
            Text(
                "$number", fontSize = ns, lineHeight = ns, fontWeight = FontWeight.Black, fontFamily = Nunito, maxLines = 1, softWrap = false,
                color = if (solid) Color(0xFF5B21B6) else Color(0xFF6D28D9),
                modifier = Modifier.align(Alignment.TopStart).padding(start = 2.dp, top = 2.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(if (solid) Color.White.copy(alpha = 0.85f) else Color(0xFFEDE4FF).copy(alpha = 0.95f))
                    .padding(horizontal = 1.5.dp),
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
                Modifier.fillMaxWidth()
                    .then(if (finished) Modifier else Modifier.squishClickable { session.pickEntry(e) })
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (isActive) com.wordocious.app.ui.accentWash(Color(0xFF7C3AED), 0.12f) else Color.Transparent)
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
    // BI22: the fixed two-line slot is ALWAYS laid out (empty with no active entry), so the
    // grid above never resizes when a clue appears or goes.
    val e = session.activeEntry ?: run { Spacer(Modifier.fillMaxWidth().widthIn(max = 700.dp).height(CLUE_BAR_HEIGHT)); return }
    Row(
        Modifier.fillMaxWidth().widthIn(max = 700.dp)
            .squishClickable { SoundManager.playKeyTap(); session.toggleDir() }
            .clip(RoundedCornerShape(14.dp))
            .background(com.wordocious.app.ui.accentWash(CROSSWORD_ACCENT))
            .border(1.5.dp, com.wordocious.app.ui.accentLine(CROSSWORD_ACCENT), RoundedCornerShape(14.dp))
            // BI18: a fixed two-line height so the grid never resizes between clues.
            .height(CLUE_BAR_HEIGHT)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        NumberBadge("${e.n}${e.dir}", 24.dp, 11.sp)
        Text(e.clue, fontSize = 15.sp, lineHeight = 19.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        Icon(Icons.Filled.SwapHoriz, "Switch direction", tint = CROSSWORD_ACCENT, modifier = Modifier.size(16.dp))
    }
}

private val CLUE_BAR_HEIGHT = 56.dp

/** BI18: the Clues toggle beside the clue bar — the clue list takes the grid's band (picking a clue goes back); "Grid" while it shows. */
@Composable
private fun CluesToggle(showing: Boolean, onClick: () -> Unit) {
    Column(
        Modifier.size(52.dp, CLUE_BAR_HEIGHT)
            .squishClickable(onClick = onClick)
            .clip(RoundedCornerShape(14.dp))
            .background(com.wordocious.app.ui.accentWash(CROSSWORD_ACCENT))
            .border(1.5.dp, com.wordocious.app.ui.accentLine(CROSSWORD_ACCENT), RoundedCornerShape(14.dp))
            .semantics { contentDescription = if (showing) "Show the grid" else "Show all clues"; selected = showing },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
    ) {
        Icon(if (showing) Icons.Filled.GridOn else Icons.Filled.FormatListNumbered, null, tint = CROSSWORD_ACCENT, modifier = Modifier.size(17.dp))
        Text(if (showing) "Grid" else "Clues", fontSize = 10.sp, lineHeight = 11.sp, fontWeight = FontWeight.Black, color = CROSSWORD_ACCENT, fontFamily = Nunito, maxLines = 1)
    }
}

/** A8 a game control: a small candy button with its icon. */
@Composable
private fun Capsule(label: String, icon: ImageVector, color: com.wordocious.app.ui.CandyColor, reserve: String? = null, count: Int = 0, onClick: () -> Unit) =
    PadAction(label, icon, onClick = onClick, color = color, reserveLabel = reserve, count = count)

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun CrosswordFinished(
    session: CrosswordSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == CrosswordStatus.WON
    val secs = session.elapsed
    val gc = s.guessCount
    val context = LocalContext.current
    val title = if (won) (if (s.checks == 0) "Grid finished clean" else "Grid finished") else "Puzzle revealed"
    val share = {
        val num = if (session.isDaily) session.dailyNumber else null
        val meta = "${num?.let { "#$it · " } ?: ""}${session.checksLabel} · ${clockText(secs)}"
        val cleanLabel = if (s.checks == 0) "Clean" else session.checksLabel
        val text = "Wordocious Crosswordocious${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${clockText(secs)} · $cleanLabel · wordocious.com/crosswordocious"
        val bmp = ShareImage.renderCrossword(context, s.w, s.h, s.solution, s.checks, won, meta)
        ShareImage.shareBitmap(context, bmp, text)
    }
    FinishedScreen(
        header = { CrosswordHeader(session) },
        strip = {
            ResultStrip(
                won,
                listOf(stripCount("${s.checks}", if (s.checks == 1) "check" else "checks"), stripTime(secs), stripPoints(session.points)),
                srText = "$title. ${s.checks} check${if (s.checks == 1) "" else "s"}, time ${timeText(secs)}, ${session.points} points",
            )
        },
        dock = {
            FinishedDock(
                GameMode.CROSSWORD, isDaily = session.isDaily, accent = CROSSWORD_ACCENT, onShare = share,
                onOpenDaily = onOpenDaily, onOpenLeaderboard = onOpenLeaderboard, onOpenUnlimited = onOpenUnlimited,
                onNewPuzzle = if (!session.isDaily && isPro && onPlayAgain != null) onPlayAgain else null,
                onOtherGames = onBack,
                more = {
                    hintsNote(s.hintsUsed)?.let { Text("$title · $it", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted) }
                    // The clues, Across and Down, under "More" (they never push the buttons down).
                    ClueColumns(session, finished = true)
                    if (session.isDaily) DailyRankBadge(GameMode.CROSSWORD)
                    ScoreBreakdownCard(GameMode.CROSSWORD, won, gc, secs, if (won) 1 else 0, CROSSWORD_TOTAL_BOARDS, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
                },
            )
        },
    ) { _, maxH ->
        // R2: the grid's cells scale to the height left (CrosswordGrid also caps them by width).
        val rows = s.h.coerceAtLeast(1)
        val big = (maxH.value - 20f - GameTrayStyle.LIP.value - 3f * (rows - 1)) / rows
        val cell = if (big >= 42f) 42f else ((maxH.value - 14f - GameTrayStyle.LIP.value - 2f * (rows - 1)) / rows).coerceIn(12f, 41.9f)
        CrosswordGrid(s, null, emptySet(), session.shakeKey, maxCell = cell.dp, interactive = false) {}
    }
}

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"
/** Always m:ss — the header clock and the share caption. */
private fun clockText(s: Int) = "${s / 60}:${"%02d".format(s % 60)}"

@Composable
private fun CrosswordOverlay(session: CrosswordSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == CrosswordStatus.WON
    val secs = session.elapsed
    PieceOverlay(won, "CROSSWORD", CROSSWORD_ACCENT, onScrimTap = onDismiss) {
        // Moment lettering (ART_SPEC §6).
        com.wordocious.app.ui.MomentTitle(if (won) com.wordocious.app.ui.MomentArt.VICTORY else com.wordocious.app.ui.MomentArt.SO_CLOSE)
        Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            StatBlock("${session.state.checks}", "CHECKS"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
        }
        onPlayAgain?.let { PiecePlayAgain(won, it) }
        PieceTapHint()
    }
}

/** A2 a soft-number stat. */
@Composable
private fun StatBlock(value: String, label: String) = PieceStat(value, label)
