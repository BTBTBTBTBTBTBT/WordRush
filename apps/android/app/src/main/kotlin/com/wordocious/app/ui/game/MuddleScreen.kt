package com.wordocious.app.ui.game

import com.wordocious.app.ui.gameBackground
import android.app.Activity
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Backspace
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
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
import com.wordocious.app.ui.tintedPill
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.HolidayTable
import com.wordocious.core.SCRAMBLE_DAILY_EPOCH
import com.wordocious.core.SCRAMBLE_FINAL
import com.wordocious.core.SCRAMBLE_MAX_CHECKS
import com.wordocious.core.SCRAMBLE_TOTAL_BOARDS
import com.wordocious.core.ScrambleAction
import com.wordocious.core.ScrambleBank
import com.wordocious.core.ScrambleFinal
import com.wordocious.core.ScramblePuzzle
import com.wordocious.core.ScrambleResult
import com.wordocious.core.ScrambleState
import com.wordocious.core.ScrambleStatus
import com.wordocious.core.ScrambleWord
import com.wordocious.core.createScrambleState
import com.wordocious.core.scrambleActiveRow
import com.wordocious.core.scrambleBoardsSolved
import com.wordocious.core.scrambleDailyNumber
import com.wordocious.core.scrambleFinalOpen
import com.wordocious.core.scrambleGuessCount
import com.wordocious.core.scrambleMatchRow
import com.wordocious.core.scramblePuzzleForDay
import com.wordocious.core.scramblePuzzleForSeed
import com.wordocious.core.scrambleReduce
import com.wordocious.core.scrambleRemaining
import com.wordocious.core.scrambleTarget
import com.wordocious.core.scrambleTray
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Muddle (More Games §5) — the Android twin of components/scramble/* and
// MuddleView.swift: the newspaper scramble. Four scrambled words; the CIRCLED
// letters of their answers, in word order, spell the pun that completes the
// caption under the cartoon. Letters are placed one at a time (tap a scrambled
// letter or type); a full word checks itself — right locks, wrong shakes and
// hands the letters back, and counts. Every check counts (guess_count = checks,
// perfect 5); thirteen lose. Hints never count: Letter (1) pins the next correct
// letter, Solve (2) fills the word. The punchline row opens after the four words.

private val MUDDLE_ACCENT = Color(0xFFF97316)
private val PURPLE = Color(0xFF7C3AED)
private val HINT = Color(0xFF8B5CF6)
private val LILAC = Color(0xFFF5F3FF)
private val LILAC_BORDER = Color(0xFFC4B5FD)
private val LILAC_TEXT = Color(0xFF5B21B6)
/** The cartoon panel's cream paper tone (§8). */
private val PAPER = Color(0xFFFDF8EC)
/** ONE fixed six-column grid for every word (the sixth slot simply empty for a five-letter word). */
private const val COLS = 6
/** Where the cartoon batch is hosted (the web serves /muddle/<file> from public/muddle). */
private const val CARTOON_HOST = "https://wordocious.com/muddle/"
/** App-identifying UA for the cartoon fetch (OkHttp's default "okhttp/x" has been refused by hosts before). */
private const val CARTOON_USER_AGENT = "Wordocious-Android (Muddle cartoons; +https://wordocious.com)"

// Release blocker (founder, 2026-10-02: "the picture and the tagline need to appear the
// whole time"). The SHARED layout model (iOS MuddleView + web muddle-game implement the
// same; dp = pt = px): the cartoon + caption sit at the top of the middle area in EVERY
// phase and are never scrolled or squeezed away; the word rows compact instead (only the
// active word is a full block, the others one line each; solved words a line of small
// locked tiles, a 2x2 grid once the punchline opens). The cartoon takes what the rows
// leave, between a 150 dp floor and a cap of 36 % of the screen height (and 3/4 of the
// width); if the rows still don't fit, the ROWS scroll internally.
/** The cartoon's height cap as a fraction of the screen height. */
private const val CARTOON_SCREEN_FRACTION = 0.36f
/** The cartoon never drops below this (unless the middle area itself cannot hold it). */
private val CARTOON_FLOOR = 150.dp
/** The rows always keep at least this much height when the floor has to give. */
private val ROWS_MIN = 56.dp
/** The compact header's band: the corner-button row (48 dp tap area + 4 dp inset); the title art sits inside it. */
private val HEADER_BAND = 52.dp
/** The title art's cap inside the band. */
private val HEADER_ART_MAX = 44.dp
/** The art keeps clear of the Home button (left) and sound + help (right). */
private val HEADER_ART_INSET = 90.dp

/**
 * The Muddle sizes: [tile] / [chip] the ACTIVE word's answer tiles and scrambled chips;
 * [smallTile] / [smallChip] the compact one-line rows (inactive + solved words); [line]
 * a compact row's height; [ring] the locked punchline's pattern rings; [coin] the open
 * punchline's answer coins; [trayChip] its scrambled tray chips; [keyH] the keyboard.
 */
private data class MuddleSizes(
    val tile: Dp, val chip: Dp, val smallTile: Dp, val smallChip: Dp, val line: Dp,
    val ring: Dp, val coin: Dp, val trayChip: Dp, val keyH: Dp,
    val hintRow: Dp, val hintCircle: Dp,
    val captionSp: androidx.compose.ui.unit.TextUnit, val captionLine: androidx.compose.ui.unit.TextUnit,
    /** Short phones: the locked punchline is ONE line (label left, pattern rings right). */
    val lockedOneLine: Boolean = false,
)
private val MUDDLE_REGULAR = MuddleSizes(34.dp, 24.dp, 22.dp, 20.dp, 28.dp, 18.dp, 30.dp, 22.dp, 44.dp, 30.dp, 28.dp, 14.sp, 18.sp)
private val MUDDLE_SHORT = MuddleSizes(32.dp, 22.dp, 22.dp, 20.dp, 24.dp, 18.dp, 28.dp, 22.dp, 40.dp, 28.dp, 26.dp, 13.sp, 16.sp, lockedOneLine = true)
private fun muddleSizesFor(screenHeightDp: Int) = if (screenHeightDp < SHORT_SCREEN_DP) MUDDLE_SHORT else MUDDLE_REGULAR
private val LocalMuddleSizes = androidx.compose.runtime.compositionLocalOf { MUDDLE_REGULAR }
@Composable private fun wordTile(): Dp = LocalMuddleSizes.current.tile
/** Gap between the active word's tiles. */
private val TILE_GAP = 6.dp
/** Gap between a compact row's small tiles / chips. */
private val SMALL_GAP = 3.dp
/** The circled ring is ~60 % of the tile, drawn inside it. */
private const val RING_FRACTION = 0.60f

/** Display titles for the shared holiday calendar keys (§20) — mirrors apps/web/lib/holidays.ts HOLIDAY_TITLES exactly. */
private val HOLIDAY_TITLES = mapOf(
    "newyear" to "New Year", "mlkday" to "MLK Day", "groundhog" to "Groundhog Day", "valentines" to "Valentine's Day", "presidents" to "Presidents' Day",
    "leapday" to "Leap Day", "mardigras" to "Mardi Gras", "stpatricks" to "St Patrick's Day", "aprilfools" to "April Fools", "easter" to "Easter",
    "earthday" to "Earth Day", "cincodemayo" to "Cinco de Mayo", "mothersday" to "Mother's Day", "memorial" to "Memorial Day", "fathersday" to "Father's Day",
    "juneteenth" to "Juneteenth", "july4" to "Fourth of July", "labor" to "Labor Day", "indigenous" to "Harvest Moon", "halloween" to "Halloween",
    "veterans" to "Veterans Day", "thanksgiving" to "Thanksgiving", "christmas" to "Christmas", "kwanzaa" to "Kwanzaa", "lunarnewyear" to "Lunar New Year",
    "passover" to "Passover", "diwali" to "Diwali", "hanukkah" to "Hanukkah",
)

/** Never a crash when the bundled bank is missing: one small valid puzzle (tray PLAEYD → PLAYED). */
private val FALLBACK_PUZZLE = ScramblePuzzle(
    "none",
    listOf(
        ScrambleWord("PLANT", "TNALP", listOf(0, 1)), ScrambleWord("ADORE", "EROAD", listOf(0, 4)),
        ScrambleWord("STORY", "YROTS", listOf(4)), ScrambleWord("GRIND", "DNIRG", listOf(4)),
    ),
    ScrambleFinal("PLAYED", listOf(6)), "When the lights went out, the band ____ on.", "A band playing in the dark",
)

// ── Session ─────────────────────────────────────────────────────────────────

class MuddleSession(val seed: String, val isDaily: Boolean) {
    private val bank: ScrambleBank = ScrambleBank.bundled ?: ScrambleBank(1, SCRAMBLE_DAILY_EPOCH, emptyList(), emptyList())

    var state by mutableStateOf(
        createScrambleState(
            (if (isDaily) scramblePuzzleForDay(bank, todayLocalDate(), HolidayTable.bundled) else scramblePuzzleForSeed(bank, seed)) ?: FALLBACK_PUZZLE,
            seed, System.currentTimeMillis(),
        ),
    )
        private set
    /** The row the keyboard writes to: 0–3 the words, 4 the punchline. Follows the game after every check. */
    var row by mutableStateOf(0)
        private set
    var toast by mutableStateOf<String?>(null)
    /** The row a wrong check just judged (shakes for 500ms) and a key that bumps per shake. */
    var shakeRow by mutableStateOf<Int?>(null)
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

    val isFinished get() = state.status != ScrambleStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, (((pauseStart ?: System.currentTimeMillis()) - startMs) / 1000).toInt())
    val dailyNumber get() = scrambleDailyNumber(todayLocalDate())
    /** The bank entry behind the state (for the cartoon + alt text); null only for the fallback. */
    val puzzle: ScramblePuzzle? get() {
        val id = state.id
        return bank.daily.firstOrNull { it.id == id } ?: bank.extra.firstOrNull { it.id == id }
            ?: bank.holiday?.values?.asSequence()?.flatten()?.firstOrNull { it.id == id }
    }
    /** The holiday this puzzle was drawn from (its display title), or null for an everyday puzzle. */
    val holidayTitle: String? get() {
        val id = state.id
        val key = bank.holiday?.entries?.firstOrNull { (_, list) -> list.any { it.id == id } }?.key ?: return null
        return HOLIDAY_TITLES[key]
    }
    val checksLabel: String get() = "${state.checks} check${if (state.checks == 1) "" else "s"}"
    val points: Int get() = DailyScoring.breakdown(
        GameMode.SCRAMBLE.name, state.status == ScrambleStatus.WON, scrambleGuessCount(state), elapsed,
        scrambleBoardsSolved(state), SCRAMBLE_TOTAL_BOARDS, state.hintsUsed,
    ).total.toInt()

    // Declared BEFORE init: restore() runs inside init and needs it. Declared below the
    // block it was null during construction, decode threw inside runCatching and every
    // save was silently ignored on the next open (Doug, Android production, 2026-09-25).
    private val json = Json { ignoreUnknownKeys = true }

    init {
        restore()
        row = scrambleActiveRow(state) ?: 0
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
        val id: String, val words: List<ScrambleWord>, val final: ScrambleFinal, val caption: String,
        val entries: List<String>, val solved: List<Boolean>, val revealed: List<String>,
        val checks: Int, val mistakes: Int, val hintsUsed: Int, val lastRow: Int?, val lastResult: String?,
        val events: List<String>, val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
        val row: Int = 0,
    )
    private val storageKey get() = if (isDaily) "muddle-save-daily" else "muddle-save-$seed"

    private fun persist() {
        if (!isDaily && isFinished) { SettingsPref.remove(storageKey); return }
        val s = state
        val dto = SaveDto(
            seed, todayLocalDate(), elapsed, System.currentTimeMillis(),
            s.id, s.words, s.final, s.caption, s.entries, s.solved, s.revealed,
            s.checks, s.mistakes, s.hintsUsed, s.lastRow, s.lastResult?.key, s.events, s.status.key, s.ended, s.startTime, s.endTime, row,
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
        if (dto.words.size != 4 || dto.entries.size != 5 || dto.solved.size != 5 || dto.revealed.size != 5) return
        val status = ScrambleStatus.values().firstOrNull { it.key == dto.status } ?: ScrambleStatus.PLAYING
        val result = dto.lastResult?.let { k -> ScrambleResult.values().firstOrNull { it.key == k } }
        state = ScrambleState(
            seed, dto.id, dto.words, dto.final, dto.caption, dto.entries, dto.solved, dto.revealed,
            dto.checks, dto.mistakes, dto.hintsUsed, dto.lastRow, result, dto.events, status, dto.ended, dto.startTime, dto.endTime,
        )
        row = dto.row.coerceIn(0, SCRAMBLE_FINAL)
        restoredElapsedMs = dto.elapsed * 1000L
        if (status != ScrambleStatus.PLAYING) { finalTimeSeconds = dto.elapsed; recorded = true; restoredFinished = true }
    }

    /** Web parity (muddle-game.tsx dispatch): judge feedback, then the active row follows the game to the next open word, then the punchline. */
    private fun dispatch(a: ScrambleAction, actedRow: Int, onFinished: () -> Unit) {
        if (isFinished) return
        val prev = state
        val next = scrambleReduce(prev, a, System.currentTimeMillis())
        state = next
        if (next.checks != prev.checks) {
            when (next.lastResult) {
                ScrambleResult.WRONG -> {
                    flash(if (next.lastRow == SCRAMBLE_FINAL) "Not the punchline" else "Not that word")
                    SoundManager.playInvalid(); shakeRow = next.lastRow; shakeKey++
                }
                ScrambleResult.CORRECT -> SoundManager.playPartial()
                null -> {}
            }
        }
        val active = scrambleActiveRow(next)
        if (active != null && (next.solved[actedRow] || next.checks != prev.checks)) row = active
        if (isFinished) onFinished()
        persist()
    }

    /** Tap a row to work on it (the punchline only once it has opened). */
    fun selectRow(r: Int) {
        if (isFinished || r !in 0..SCRAMBLE_FINAL || state.solved[r]) return
        if (r == SCRAMBLE_FINAL && !scrambleFinalOpen(state)) { flash("Solve the four words first"); return }
        row = r
        persist()
    }
    /** A keyboard letter goes to the active row. */
    fun type(ch: Char, onFinished: () -> Unit) {
        if (isFinished) return
        val letter = ch.uppercaseChar()
        if (letter !in 'A'..'Z') return
        if (row == SCRAMBLE_FINAL && !scrambleFinalOpen(state)) { flash("Solve the four words first"); return }
        if (state.solved[row]) return
        dispatch(ScrambleAction.Type(row, letter.toString()), row, onFinished)
    }
    /** Tapping a scrambled letter (or a circled letter in the punchline tray) makes that row active and places it. */
    fun tapTile(r: Int, ch: Char, onFinished: () -> Unit) {
        if (isFinished || state.solved[r]) return
        if (r == SCRAMBLE_FINAL && !scrambleFinalOpen(state)) { flash("Solve the four words first"); return }
        SoundManager.playKeyTap()
        row = r
        dispatch(ScrambleAction.Type(r, ch.toString()), r, onFinished)
    }
    fun back() { if (!isFinished) dispatch(ScrambleAction.Back(row), row) {} }
    fun clear() { if (!isFinished) dispatch(ScrambleAction.Clear(row), row) {} }
    /** Enter jumps to the row the game wants next. */
    fun jumpToActive() { if (!isFinished) scrambleActiveRow(state)?.let { row = it; persist() } }
    /** ↑/↓ on a physical keyboard (web muddle-game.tsx): the nearest unsolved row that way. */
    fun stepRow(dir: Int) {
        if (isFinished) return
        var r = row + dir
        while (r in 0..SCRAMBLE_FINAL && state.solved[r]) r += dir
        if (r in 0..SCRAMBLE_FINAL) selectRow(r)
    }
    fun revealLetter(r: Int, onFinished: () -> Unit) { if (!isFinished) dispatch(ScrambleAction.RevealLetter(r), r, onFinished) }
    fun solveWord(r: Int, onFinished: () -> Unit) { if (!isFinished) dispatch(ScrambleAction.SolveWord(r), r, onFinished) }

    suspend fun finish() {
        finalTimeSeconds = elapsed
        if (state.status == ScrambleStatus.WON) SoundManager.playSuccess() else SoundManager.playGameOver()
        if (recorded) return
        recorded = true
        val won = state.status == ScrambleStatus.WON
        val (solutions, guesses) = scrambleMatchRow(state)
        val xp = GameResultsService.record(
            gameMode = GameMode.SCRAMBLE, won = won, guessCount = scrambleGuessCount(state), timeSeconds = elapsed,
            boardsSolved = scrambleBoardsSolved(state), totalBoards = SCRAMBLE_TOTAL_BOARDS, seed = seed,
            solutions = solutions, guesses = guesses, hintsUsed = state.hintsUsed,
        )
        xpResult = xp
        if (isDaily) DailyCompletionsService.notePuzzleFinish(seed, GameMode.SCRAMBLE.name, won, scrambleGuessCount(state), elapsed)
    }

    private fun flash(m: String) { toast = m }
}

// ── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun MuddleScreen(
    seed: String,
    isDaily: Boolean,
    onBack: () -> Unit,
    onPlayAgain: (() -> Unit)? = null,
    onOpenDaily: (GameMode) -> Unit = {},
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val session = remember(seed) { MuddleSession(seed, isDaily) }
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
    LaunchedEffect(session.shakeKey) { if (session.shakeRow != null) { kotlinx.coroutines.delay(500); session.shakeRow = null } }

    val onFinished: () -> Unit = {
        scope.launch {
            session.finish()
            if (!session.restoredFinished) showOverlay = true
            if (session.state.status == ScrambleStatus.WON) {
                RatingsPrompt.recordWin(context)
                (context as? Activity)?.let { RatingsPrompt.maybeAsk(it) }
            }
        }
    }

    androidx.activity.compose.BackHandler { onBack() }


    // Physical keyboard (founder, 2026-09-30; web muddle-game.tsx): A–Z types into the active row,
    // Backspace/Delete erases, Enter/Tab jumps to the next open row, ↑/↓ move between rows.
    val muddleKeys = keyboardViewKeys(onKey = { session.type(it, onFinished) }, onDelete = { session.back() }, onEnter = { session.jumpToActive() })
    Box(
        Modifier.fillMaxSize()
            .hardwareKeys(enabled = !session.isFinished && !showOverlay && !showGuide) { k ->
                when (k) {
                    HwKey.Tab -> { session.jumpToActive(); true }
                    HwKey.Down -> { session.stepRow(1); true }
                    HwKey.Up -> { session.stepRow(-1); true }
                    else -> muddleKeys(k)
                }
            }
            .gameBackground { background(WTheme.bg) }.statusBarsPadding(),
    ) {
        if (session.isFinished) {
            // FINISH_SPEC R2: the one-screen finished screen (header · strip · board · dock).
            MuddleFinished(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard, onFinished)
        } else {
            // The whole puzzle on one screen with the keyboard pinned (release blocker 10-02):
            // compact header · the stage (cartoon + caption ALWAYS shown at the top, the rows
            // under them, scrolling internally only if they must) · Delete · Clear · keyboard.
            val screenH = LocalConfiguration.current.screenHeightDp
            val sizes = muddleSizesFor(screenH)
            androidx.compose.runtime.CompositionLocalProvider(LocalMuddleSizes provides sizes) {
                Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    MuddleHeader(session, compact = true)
                    val puzzle = session.puzzle
                    MuddleStage(
                        Modifier.weight(1f).fillMaxWidth().widthIn(max = 420.dp),
                        cap = screenH.dp * CARTOON_SCREEN_FRACTION, fill = true,
                        cartoon = { h -> CartoonPanel(puzzle?.cartoon, puzzle?.altText ?: "Cartoon", height = h) },
                        caption = { Caption(session.state, finished = false) },
                        rows = { MuddlePuzzle(session, finished = false, onFinished) },
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Capsule("Delete", Icons.AutoMirrored.Outlined.Backspace) { SoundManager.playDelete(); session.back() }
                        Capsule("Clear", Icons.Filled.Cancel) { SoundManager.playKeyTap(); session.clear() }
                    }
                    KeyboardView(onKey = { session.type(it, onFinished) }, onDelete = { session.back() }, onEnter = { session.jumpToActive() },
                                 keyHeight = sizes.keyH)
                    Spacer(Modifier.height(4.dp))
                }
            }
        }
        // The candy feedback toast (no anchor here: Muddle's layout is owned elsewhere; fixed spot below the header).
        GameFeedbackToast(session.toast, fallbackTop = 112.dp)
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) MuddleOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(MUDDLE_ACCENT, onBack) }
        CornerHelpButton(MUDDLE_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET))
        if (showGuide) GuideSheet(mode = GameMode.SCRAMBLE, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MuddleHeader(session: MuddleSession, compact: Boolean) {
    val tick by produceState(0, session.isFinished) { while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ } }
    val s = session.state
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(top = if (compact) 0.dp else 2.dp)) {
        // The game's host (R, groggy: MASCOT_SPEC §5) + the name: the fallback when there is no title art.
        val fallback: @Composable () -> Unit = {
            Row(Modifier.padding(horizontal = if (compact) 0.dp else 52.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                com.wordocious.app.ui.Mascots.hostFor("SCRAMBLE")?.let {
                    Box(Modifier.size(30.dp, 22.dp), contentAlignment = Alignment.Center) {
                        com.wordocious.app.ui.Mascot(it, 30.dp, Modifier.wrapContentSize(unbounded = true))
                    }
                }
                Text("MUDDLE", fontSize = 20.sp, lineHeight = 22.sp, fontWeight = FontWeight.Black, color = MUDDLE_ACCENT, fontFamily = Nunito, maxLines = 1)
            }
        }
        if (compact) {
            // Release blocker 10-02: the title art sits INSIDE the corner-button row (capped at
            // 44 dp, clear of Home on the left and sound + help on the right) so the cartoon gets
            // the height; the one meta line follows under the row.
            val res = com.wordocious.app.ui.gameTitleArtResForKey("SCRAMBLE")
            Box(Modifier.fillMaxWidth().height(HEADER_BAND).padding(top = GAME_CONTROLS_INSET).padding(horizontal = HEADER_ART_INSET), contentAlignment = Alignment.Center) {
                if (res != null) com.wordocious.app.ui.FittedGameTitleArt(res, com.wordocious.app.ui.gameTitleLabelForKey("SCRAMBLE"), maxHeight = HEADER_ART_MAX)
                else fallback()
            }
        } else {
            // ART_SPEC §14 / §19.3: the title art below the corner-button row.
            com.wordocious.app.ui.GameHeaderTitle("SCRAMBLE") { fallback() }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.Center, modifier = Modifier.padding(horizontal = if (compact) 0.dp else 48.dp)) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
            session.holidayTitle?.let { Text(it, fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.Bold, color = MUDDLE_ACCENT, maxLines = 1) }
            Text("${scrambleBoardsSolved(s)}/$SCRAMBLE_TOTAL_BOARDS solved", fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
            Text("${session.checksLabel} · ${SCRAMBLE_MAX_CHECKS - s.checks} left", fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
            @Suppress("UNUSED_EXPRESSION") tick
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Icon(Icons.Filled.Schedule, null, tint = WTheme.textMuted, modifier = Modifier.size(10.dp))
                Text(clockText(session.elapsed), fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
            }
        }
    }
}

// ── Board ───────────────────────────────────────────────────────────────────

/**
 * The middle area (release blocker 10-02, the shared layout model): the cartoon on top, the
 * caption under it, then the rows. The caption and the rows are measured at their natural
 * height first; the cartoon takes what is left — never below [CARTOON_FLOOR] (unless this
 * area itself cannot hold it next to the caption and [ROWS_MIN] of rows), never above [cap]
 * or 3/4 of the width. Rows that don't fit scroll INSIDE their own area; the cartoon and the
 * caption never move. [fill] = take the whole height (play: the rows center in what is
 * left under the caption); else report only the height used (the finished board).
 */
@Composable
private fun MuddleStage(
    modifier: Modifier,
    cap: Dp,
    fill: Boolean,
    gap: Dp = 4.dp,
    cartoon: @Composable (Dp) -> Unit,
    caption: @Composable () -> Unit,
    rows: @Composable () -> Unit,
) {
    val scroll = rememberScrollState()
    androidx.compose.ui.layout.SubcomposeLayout(modifier) { c ->
        val w = c.maxWidth
        val total = if (c.hasBoundedHeight) c.maxHeight else 2000.dp.roundToPx()
        val loose = androidx.compose.ui.unit.Constraints(maxWidth = w)
        val gapPx = gap.roundToPx()
        val captionP = subcompose("caption") { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { caption() } }.map { it.measure(loose) }
        val captionH = captionP.maxOfOrNull { it.height } ?: 0
        // The floor gives only when the area cannot hold it beside the caption and a minimum of rows.
        val floor = minOf(CARTOON_FLOOR.roundToPx(), total - captionH - gapPx * 2 - ROWS_MIN.roundToPx()).coerceAtLeast(0)
        val rowsMax = (total - captionH - gapPx * 2 - floor).coerceAtLeast(0)
        val rowsP = subcompose("rows") {
            Box(Modifier.fillMaxWidth().verticalScroll(scroll), contentAlignment = Alignment.TopCenter) { rows() }
        }.map { it.measure(androidx.compose.ui.unit.Constraints(maxWidth = w, maxHeight = rowsMax)) }
        val rowsH = (rowsP.maxOfOrNull { it.height } ?: 0).coerceAtMost(rowsMax)
        val ceiling = minOf(cap.roundToPx(), (w * 0.75f).toInt())
        val h = (total - rowsH - captionH - gapPx * 2).coerceAtMost(ceiling).coerceAtLeast(minOf(floor, ceiling)).coerceAtLeast(0)
        val cartoonP = subcompose("cartoon") { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { cartoon(h.toDp()) } }.map { it.measure(loose) }
        val cartoonH = cartoonP.maxOfOrNull { it.height } ?: 0
        val used = cartoonH + gapPx + captionH + gapPx + rowsH
        val height = if (fill) total else minOf(used, total)
        layout(w, height) {
            cartoonP.forEach { it.place(0, 0) }
            captionP.forEach { it.place(0, cartoonH + gapPx) }
            val top = cartoonH + gapPx + captionH + gapPx
            val slack = if (fill) ((height - top - rowsH) / 2).coerceAtLeast(0) else 0
            rowsP.forEach { it.place(0, top + slack) }
        }
    }
}

/**
 * The puzzle half (release blocker 10-02): only the ACTIVE word is a full block; the other
 * open words are one compact line each, a solved word a line of small locked tiles; the
 * punchline is a short locked strip until the four are solved — then the four solved words
 * pack into a 2x2 grid and the punchline opens with its tray and coins.
 */
@Composable
private fun MuddlePuzzle(session: MuddleSession, finished: Boolean, onFinished: () -> Unit) {
    // FINISH_SPEC L: Muddle's word rows sit in the shared game tray; I4 the punchline solved = confetti.
    val s = session.state
    val trayState = when {
        !finished -> TrayState.PLAYING
        s.status == ScrambleStatus.WON -> TrayState.WON
        else -> TrayState.LOST
    }
    val finalOpen = finished || scrambleFinalOpen(s)
    // The expanded word: the selected row while it is an open word, else the game's next open word.
    val expanded = if (session.row in 0 until SCRAMBLE_FINAL && !s.solved[session.row]) session.row
        else scrambleActiveRow(s)?.takeIf { it < SCRAMBLE_FINAL && !s.solved[it] }
    Box(Modifier.fillMaxWidth().widthIn(max = 420.dp)) {
    Column(
        Modifier.fillMaxWidth().gameTray(MUDDLE_ACCENT, trayState, padding = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp, vertical = 4.dp)),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        if (finalOpen) {
            // The four words as a 2x2 grid of locked lines: two compact lines in all.
            for (pair in listOf(0 to 1, 2 to 3)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    SolvedLine(s, pair.first, Modifier.weight(1f))
                    SolvedLine(s, pair.second, Modifier.weight(1f))
                }
            }
        } else {
            for (i in 0 until SCRAMBLE_FINAL) {
                when {
                    s.solved[i] -> SolvedLine(s, i, Modifier.fillMaxWidth())
                    i == expanded -> WordRow(
                        session, i, active = !finished && session.row == i, shaking = session.shakeRow == i, finished = finished,
                        onSelect = { session.selectRow(i) }, onTapTile = { ch -> session.tapTile(i, ch, onFinished) },
                        onRevealLetter = { SoundManager.playKeyTap(); session.revealLetter(i, onFinished) }, onSolveWord = { SoundManager.playKeyTap(); session.solveWord(i, onFinished) },
                    )
                    else -> CompactWordLine(
                        session, i, shaking = session.shakeRow == i,
                        onSelect = { session.selectRow(i) }, onTapTile = { ch -> session.tapTile(i, ch, onFinished) },
                    )
                }
            }
        }
        FinalRow(
            session, active = !finished && session.row == SCRAMBLE_FINAL, shaking = session.shakeRow == SCRAMBLE_FINAL, finished = finished,
            onSelect = { session.selectRow(SCRAMBLE_FINAL) }, onTapTile = { ch -> session.tapTile(SCRAMBLE_FINAL, ch, onFinished) },
            onRevealLetter = { SoundManager.playKeyTap(); session.revealLetter(SCRAMBLE_FINAL, onFinished) },
        )
    }
    MuddleConfetti(trigger = !finished && s.solved[SCRAMBLE_FINAL], modifier = Modifier.matchParentSize())
    }
}

/** Scrolls [requester]'s row into view whenever it becomes active (the rows may scroll on a short phone). */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun bringActiveIntoView(active: Boolean): Modifier {
    val requester = remember { androidx.compose.foundation.relocation.BringIntoViewRequester() }
    LaunchedEffect(active) { if (active) runCatching { requester.bringIntoView() } }
    return Modifier.bringIntoViewRequester(requester)
}

/** A solved (or, finished, never-solved = muted) word: ONE line of small locked tiles, circled letters as coins. */
@Composable
private fun SolvedLine(s: ScrambleState, row: Int, modifier: Modifier) {
    val w = s.words[row]
    val solved = s.solved[row]
    val circled = w.circled.toSet()
    val revealed = s.revealed[row]
    val small = LocalMuddleSizes.current.smallTile
    Row(
        modifier.height(LocalMuddleSizes.current.line).semantics(mergeDescendants = true) {
            contentDescription = if (solved) "Word ${row + 1} solved: ${w.answer}" else "Word ${row + 1}: ${w.answer}"
        },
        horizontalArrangement = Arrangement.spacedBy(SMALL_GAP, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
    ) {
        w.answer.forEachIndexed { i, ch ->
            MuddleSlot(ch.toString(), pinned = revealed.getOrNull(i)?.let { it != '_' } == true, circled = i in circled, size = small, solved = solved, muted = !solved)
        }
    }
}

/**
 * An open word that is not the active one: ONE compact line — its scrambled letters as
 * small chips on the left (a tap selects the word AND places the letter), small answer
 * tiles with the current entry on the right (circled slots as coins), no hint buttons.
 * Tapping the line selects it (it expands to the full block).
 */
@Composable
private fun CompactWordLine(session: MuddleSession, row: Int, shaking: Boolean, onSelect: () -> Unit, onTapTile: (Char) -> Unit) {
    val s = session.state
    val w = s.words[row]
    val entry = s.entries[row]
    val dimmed = usedMask(w.scramble, entry)
    val circled = w.circled.toSet()
    val revealed = s.revealed[row]
    val sz = LocalMuddleSizes.current
    Row(
        Modifier.fillMaxWidth().height(sz.line)
            .then(if (shaking) Modifier.shakeOnReject(session.shakeKey) else Modifier)
            .clip(RoundedCornerShape(8.dp))
            .clickableNoRipple { onSelect() }
            .padding(horizontal = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(SMALL_GAP), verticalAlignment = Alignment.CenterVertically) {
            w.scramble.forEachIndexed { i, ch ->
                MuddleChip(
                    ch.toString(), used = dimmed[i], size = sz.smallChip,
                    modifier = Modifier.size(sz.smallChip)
                        .then(if (!dimmed[i]) Modifier.squishClickable(label = "Letter $ch") { onTapTile(ch) } else Modifier),
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(SMALL_GAP), verticalAlignment = Alignment.CenterVertically) {
            for (i in 0 until COLS) {
                if (i >= w.answer.length) { Spacer(Modifier.size(sz.smallTile)); continue }
                MuddleSlot(entry.getOrNull(i)?.toString() ?: "", pinned = revealed.getOrNull(i)?.let { it != '_' } == true, circled = i in circled, size = sz.smallTile)
            }
        }
    }
}

/**
 * The cartoon panel (§5/§8): a standard card in the cream paper tone, always
 * 4:3, sized from the height the screen leaves it (compact rule: capped at
 * ~26 % of the screen) and centered. The puzzle's cartoon loads from the web
 * host (prewarmed at launch); the paper card alone holds its place until it has
 * decoded. The caption is ALWAYS typeset by the app beneath the panel.
 */
@Composable
private fun CartoonPanel(cartoon: String?, altText: String, height: Dp) {
    val shape = RoundedCornerShape(16.dp)
    val context = LocalContext.current
    // Doug (Android, 2026-09-26): the panel stayed a blank cream card. The plain
    // AsyncImage renders NOTHING on a failed load and tells nobody why. Now every
    // phase draws something (the sketch while loading, the sketch + "tap to retry"
    // on failure), a failure is reported to Sentry with the real cause, and a tap
    // re-issues the request. The request carries an app User-Agent like the
    // ProperNoundle photo does (Wikimedia refused OkHttp's default one, §PostGame).
    var attempt by remember(cartoon) { mutableStateOf(0) }
    var failed by remember(cartoon) { mutableStateOf(false) }
    Box(
        // I4: the cream paper card keeps its tone with the A1 border + soft shadow.
        Modifier.size(width = height * 4f / 3f, height = height)
            .shadow(6.dp, shape, clip = false, ambientColor = com.wordocious.app.ui.FinishInk.cardShadow, spotColor = com.wordocious.app.ui.FinishInk.cardShadow)
            .clip(shape).background(PAPER).border(1.5.dp, com.wordocious.app.ui.accentLine(MUDDLE_ACCENT), shape)
            .then(if (failed) Modifier.clickableNoRipple { failed = false; attempt++ } else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        if (cartoon != null) {
            val url = CARTOON_HOST + cartoon
            val request = remember(url, attempt) { MuddleCartoons.request(context, cartoon, attempt) }
            // Founder 10-03 (no placeholder states): prewarmed into Coil's memory cache at launch
            // (MuddleCartoons.prewarm), so it paints on the first frame; until then (and on a
            // failure) the slot is the plain paper card at its exact size — never a sketch.
            coil.compose.SubcomposeAsyncImage(
                model = request, contentDescription = altText, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(),
                loading = {},
                error = {},
                onError = { st ->
                    failed = true
                    val t = st.result.throwable
                    val why = "${t.javaClass.simpleName}: ${t.message}"
                    android.util.Log.w("Muddle", "cartoon failed $url (attempt $attempt): $why", t)
                    runCatching { io.sentry.Sentry.captureMessage("muddle cartoon failed: $cartoon attempt=$attempt $why") }
                },
                onSuccess = { failed = false },
            )
            // Drawn by the OUTER Box (a real BoxScope): Coil's error slot ignored align().
            if (failed) Text(
                "Tap to retry", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF6B7280), fontFamily = Nunito, maxLines = 1,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 8.dp)
                    .background(PAPER.copy(alpha = 0.92f), RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 3.dp),
            )
        }
    }
}

/** Founder 10-03: the Muddle cartoon requests (one shape, so the prewarm and the panel share Coil's memory cache key). */
object MuddleCartoons {
    fun request(context: android.content.Context, cartoon: String, attempt: Int = 0): coil.request.ImageRequest =
        coil.request.ImageRequest.Builder(context)
            .data(CARTOON_HOST + cartoon)
            .setHeader("User-Agent", CARTOON_USER_AGENT)
            .setHeader("Accept", "image/webp,image/*;q=0.9,*/*;q=0.8")
            .setParameter("attempt", attempt)
            .build()

    /** Today's daily cartoon downloaded + decoded into Coil's memory cache (call off the first frame). */
    fun prewarm(context: android.content.Context) {
        val bank = ScrambleBank.bundled ?: return
        val cartoon = scramblePuzzleForDay(bank, todayLocalDate(), HolidayTable.bundled)?.cartoon ?: return
        coil.Coil.imageLoader(context).enqueue(request(context, cartoon))
    }
}

/** The caption, centered, with the blank as an accent underline — filled with the punchline in lowercase purple once it is solved (or the game is over). */
@Composable
private fun Caption(s: ScrambleState, finished: Boolean) {
    val parts = s.caption.split("____")
    val answer = if (finished || s.solved[SCRAMBLE_FINAL]) s.final.answer.lowercase() else ""
    val blankEm = maxOf(3.5f, answer.length * 0.58f)
    Text(
        buildAnnotatedString {
            append(parts.getOrElse(0) { "" })
            append(" ")
            appendInlineContent("blank", "____")
            append(" ")
            append(parts.getOrElse(1) { "" })
        },
        inlineContent = mapOf(
            "blank" to InlineTextContent(Placeholder(blankEm.em, 1.25.em, PlaceholderVerticalAlign.TextCenter)) {
                Box(
                    Modifier.fillMaxSize().drawBehind {
                        val w = 2.dp.toPx()
                        drawLine(MUDDLE_ACCENT, Offset(0f, size.height - w / 2f), Offset(size.width, size.height - w / 2f), w)
                    },
                    contentAlignment = Alignment.BottomCenter,
                ) {
                    Text(answer, fontSize = LocalMuddleSizes.current.captionSp, fontWeight = FontWeight.ExtraBold, color = LILAC_TEXT, fontFamily = Nunito, maxLines = 1, softWrap = false)
                }
            },
        ),
        fontSize = LocalMuddleSizes.current.captionSp, lineHeight = LocalMuddleSizes.current.captionLine, fontWeight = FontWeight.ExtraBold, color = WTheme.text, fontFamily = Nunito, textAlign = TextAlign.Center,
        maxLines = 4, overflow = TextOverflow.Ellipsis,
        modifier = Modifier.widthIn(max = 420.dp).padding(horizontal = 6.dp),
    )
}

/**
 * The finished Muddle for the Completed-Today card (founder, 2026-09-29): the
 * cartoon, the caption with the punchline filled in, then each word's answer
 * tiles (purple solved, violet solved by hint, muted where it was never
 * solved) and the punchline in its lilac groups — read-only, the middle fit tier.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MuddleFinishedBoard(s: ScrambleState, puzzle: ScramblePuzzle, solvedByHint: Set<Int>) {
    androidx.compose.runtime.CompositionLocalProvider(LocalMuddleSizes provides MUDDLE_SHORT) {
        Column(Modifier.fillMaxWidth().widthIn(max = 420.dp), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            CartoonPanel(puzzle.cartoon, puzzle.altText, height = 150.dp)
            Caption(s, finished = true)
            for (row in 0 until SCRAMBLE_FINAL) {
                val w = s.words[row]; val solved = s.solved[row]; val circled = w.circled.toSet()
                val fill = if (row in solvedByHint) HINT else PURPLE
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    w.answer.forEachIndexed { i, ch ->
                        @Suppress("UNUSED_VARIABLE") val unusedFill = fill
                        MuddleSlot(ch.toString(), pinned = row in solvedByHint, circled = i in circled, size = wordTile(), muted = !solved)
                    }
                }
            }
            HorizontalDivider(color = WTheme.border, thickness = 1.5.dp, modifier = Modifier.padding(horizontal = 24.dp))
            val target = scrambleTarget(s, SCRAMBLE_FINAL); val solved = s.solved[SCRAMBLE_FINAL]
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                var pos = 0
                for (len in s.final.pattern) {
                    val start = pos; pos += len
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        for (k in 0 until len) MuddleSlot(
                            if (solved) target.getOrNull(start + k)?.toString() ?: "" else "", pinned = false, circled = true, size = 24.dp, punchline = true,
                        )
                    }
                }
            }
        }
    }
}

/** Which tray letters are already placed, marked left-to-right by multiset (web parity: `dimmed`). */
private fun usedMask(tray: String, entry: String): List<Boolean> {
    val left = scrambleRemaining(tray, entry).toMutableList()
    return tray.map { ch -> val k = left.indexOf(ch); if (k >= 0) { left.removeAt(k); false } else true }
}

/**
 * One word as ONE compact block (compact rule, §5): the scrambled letters as
 * 17 sp bold type with light tracking on the left and the Letter · Solve icon
 * circles on the right, then the answer tiles directly beneath on ONE fixed
 * six-column grid (the sixth slot simply empty for a five-letter word). A
 * placed letter is a purple tile with white ink, a pinned letter violet; a
 * circled position is a ring ~60 % of the tile drawn INSIDE it — white on a
 * filled tile, purple on an empty one. Tapping a scrambled letter places it;
 * used letters dim. No card frame per word: the active row wears a light lilac
 * tint and border only; a wrong row shakes.
 *
 * Touch targets: the glyphs are small but every tappable thing carries padding,
 * and Compose's hit test dispatches a touch within the 48 dp minimum touch
 * target to the nearest pointer-input node, so a letter or a hint circle still
 * takes a finger-sized tap without the layout growing to 48 dp.
 */
@Composable
private fun WordRow(
    session: MuddleSession, row: Int, active: Boolean, shaking: Boolean, finished: Boolean,
    onSelect: () -> Unit, onTapTile: (Char) -> Unit, onRevealLetter: () -> Unit, onSolveWord: () -> Unit,
) {
    val s = session.state
    val w = s.words[row]
    val entry = s.entries[row]
    val solved = s.solved[row]
    val dimmed = usedMask(w.scramble, entry)
    val circled = w.circled.toSet()
    val revealed = s.revealed[row]
    val shape = RoundedCornerShape(10.dp)
    Column(
        Modifier.fillMaxWidth()
            .then(bringActiveIntoView(active))
            .then(if (shaking) Modifier.shakeOnReject(session.shakeKey) else Modifier)
            // I4: the active word row is a tinted card (A1), not a lilac fill.
            .then(if (active) Modifier.tintedPill(MUDDLE_ACCENT, corner = 12.dp) else Modifier.clip(shape))
            .clickableNoRipple { if (!solved && !finished) onSelect() }
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(Modifier.fillMaxWidth().heightIn(min = LocalMuddleSizes.current.hintRow), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                // I3: the scrambled letters are small glossy amber chips; a used one sinks.
                val chip = LocalMuddleSizes.current.chip
                w.scramble.forEachIndexed { i, ch ->
                    val dim = dimmed[i] || solved
                    MuddleChip(
                        ch.toString(), used = dim, size = chip,
                        modifier = Modifier.size(chip)
                            .then(if (!dim && !finished) Modifier.squishClickable(label = "Letter $ch") { onTapTile(ch) } else Modifier),
                    )
                }
            }
            if (!solved && !finished) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    HintCircle(Icons.Filled.Lightbulb, "Reveal a letter", onRevealLetter)
                    HintCircle(Icons.Filled.Visibility, "Solve this word", onSolveWord)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(TILE_GAP)) {
            for (i in 0 until COLS) {
                if (i >= w.answer.length) { Spacer(Modifier.size(wordTile())); continue }
                val ch = if (solved) w.answer[i].toString() else entry.getOrNull(i)?.toString() ?: ""
                val pinned = revealed[i] != '_'
                // I1: circled slots are coins, the rest the B1 square glossy tiles.
                MuddleSlot(ch, pinned, circled = i in circled, size = wordTile(), solved = solved, flipDelayMs = i * TileMotion.FLIP_STAGGER_MS)
            }
        }
    }
}

/** One answer tile: rounded, 2dp border, letter centered; the circled ring drawn INSIDE at ~60 % of the tile (never an outline around it). */
@Composable
private fun AnswerBox(
    ch: String, bg: Color, border: Color, ink: Color, ring: Boolean, ringColor: Color, ringAlpha: Float,
    fontSize: androidx.compose.ui.unit.TextUnit, modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(7.dp)
    Box(
        modifier.clip(shape).background(bg).border(2.dp, border, shape)
            .drawWithContent {
                drawContent()
                if (ring) drawCircle(ringColor.copy(alpha = ringAlpha), radius = size.minDimension * RING_FRACTION / 2f, style = Stroke(2.dp.toPx()))
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(ch, fontSize = fontSize, fontWeight = FontWeight.Black, color = ink, fontFamily = Nunito, maxLines = 1, softWrap = false)
    }
}

/**
 * The punchline under a divider (§5): grouped by word in the light lilac tint
 * with purple text and purple rings; its tray is the circled letters in word
 * order; it opens only after the four words are solved.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FinalRow(
    session: MuddleSession, active: Boolean, shaking: Boolean, finished: Boolean,
    onSelect: () -> Unit, onTapTile: (Char) -> Unit, onRevealLetter: () -> Unit,
) {
    val s = session.state
    val open = scrambleFinalOpen(s)
    val entry = s.entries[SCRAMBLE_FINAL]
    val solved = s.solved[SCRAMBLE_FINAL]
    val target = scrambleTarget(s, SCRAMBLE_FINAL)
    val tray = scrambleTray(s, SCRAMBLE_FINAL)
    val dimmed = usedMask(tray, entry)
    val shape = RoundedCornerShape(10.dp)
    val playable = open && !solved && !finished
    val sz = LocalMuddleSizes.current
    Column(Modifier.fillMaxWidth().padding(top = 1.dp)) {
        HorizontalDivider(color = WTheme.border, thickness = 1.5.dp)
        if (!open && !finished) {
            // LOCKED (word phase): compact — the label and the letter pattern as small rings (~40 dp in all).
            val rings: @Composable () -> Unit = {
                Row(horizontalArrangement = Arrangement.spacedBy(if (sz.lockedOneLine) 6.dp else 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    for (len in s.final.pattern) {
                        Row(horizontalArrangement = Arrangement.spacedBy(if (sz.lockedOneLine) 2.dp else SMALL_GAP)) {
                            for (k in 0 until len) MuddleSlot("", pinned = false, circled = true, size = sz.ring, punchline = true)
                        }
                    }
                }
            }
            val lockedMod = Modifier.fillMaxWidth().alpha(0.55f).padding(horizontal = 6.dp, vertical = 2.dp)
                .semantics(mergeDescendants = true) { contentDescription = "Punchline, locked: solve the four words to unlock it" }
            if (sz.lockedOneLine) {
                Row(lockedMod.heightIn(min = 24.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    com.wordocious.app.ui.FitText(
                        "PUNCHLINE", fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp,
                        modifier = Modifier.weight(1f),
                    )
                    rings()
                }
            } else {
                Column(lockedMod, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    com.wordocious.app.ui.FitText(
                        "PUNCHLINE \u00B7 SOLVE THE FOUR WORDS TO UNLOCK",
                        fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp,
                    )
                    rings()
                }
            }
            return@Column
        }
        Column(
            Modifier.fillMaxWidth()
                .then(bringActiveIntoView(active))
                .then(if (shaking) Modifier.shakeOnReject(session.shakeKey) else Modifier)
                .then(if (active) Modifier.tintedPill(Color(0xFFF5A524), corner = 12.dp) else Modifier.clip(shape))
                .clickableNoRipple { if (playable) onSelect() }
                .padding(horizontal = 6.dp, vertical = 3.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            // OPEN: one line — the heading, the circled-letter tray (wrapping) and the Letter circle.
            Row(Modifier.fillMaxWidth().heightIn(min = if (playable) sz.hintRow else 0.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                com.wordocious.app.ui.FitText(
                    "PUNCHLINE",
                    fontSize = 10.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp,
                )
                if (playable) {
                    FlowRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(3.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        // I3: the circled letters to place, as glossy chips that sink when used.
                        tray.forEachIndexed { i, ch ->
                            MuddleChip(
                                ch.toString(), used = dimmed[i], size = sz.trayChip,
                                modifier = Modifier.size(sz.trayChip)
                                    .then(if (!dimmed[i]) Modifier.squishClickable(label = "Letter $ch") { onTapTile(ch) } else Modifier),
                            )
                        }
                    }
                    HintCircle(Icons.Filled.Lightbulb, "Reveal a letter", onRevealLetter)
                }
            }
            BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            // A word group never wraps, so the coin shrinks until the LONGEST group fits the row
            // (floor 22 dp) — a ten-letter punchline lost its last letter on a narrower phone.
            val longest = s.final.pattern.maxOrNull() ?: 1
            val letters = s.final.pattern.sum().coerceAtLeast(1)
            val groups = s.final.pattern.size.coerceAtLeast(1)
            val fitTile = ((maxWidth - 4.dp * (longest - 1)) / longest)
            // Every group on one row if the coins can shrink to 22 dp for it; else the longest group sets the size.
            val oneRow = (maxWidth - 12.dp * (groups - 1) - 4.dp * (letters - groups)) / letters
            val tile = when {
                oneRow >= 22.dp -> minOf(sz.coin, oneRow)
                fitTile < sz.coin -> maxOf(22.dp, fitTile)
                else -> sz.coin
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                var pos = 0
                for (len in s.final.pattern) {
                    val start = pos; pos += len
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        for (k in 0 until len) {
                            val idx = start + k
                            val ch = if (solved || finished) target.getOrNull(idx)?.toString() ?: "" else entry.getOrNull(idx)?.toString() ?: ""
                            // I2: the punchline letters are gold coins; solved = the hop wave.
                            MuddleSlot(
                                ch, pinned = false, circled = true, size = tile, punchline = true,
                                hop = solved && !finished, hopDelayMs = TileMotion.revealMs(1) + idx * TileMotion.HOP_STAGGER_MS,
                            )
                        }
                    }
                }
            }
            }
        }
    }
}

/**
 * I4 the in-row hint control (Letter = lightbulb, Solve = eye): a small round candy
 * button (A8) — amber bulb, purple eye — icon only, the label in the content
 * description. It sits in a 40 × hint-row touch box.
 */
@Composable
private fun HintCircle(icon: ImageVector, description: String, onClick: () -> Unit) {
    val d = LocalMuddleSizes.current.hintCircle
    Box(Modifier.size(width = 40.dp, height = LocalMuddleSizes.current.hintRow), contentAlignment = Alignment.Center) {
        com.wordocious.app.ui.CandyRoundButton(
            contentDescription = description, onClick = onClick, diameter = d,
            color = if (icon == Icons.Filled.Visibility) com.wordocious.app.ui.CandyColor.PURPLE else com.wordocious.app.ui.CandyColor.AMBER,
            modifier = Modifier.padding(bottom = 2.dp),
        ) {
            // The helper circle: the family art when the icon has one, else the vector in the deep tint.
            val art = com.wordocious.app.ui.FamIcon.of(icon)
            if (art != null) com.wordocious.app.ui.FamIconImage(art, androidx.compose.material3.LocalContentColor.current, d * 0.56f)
            else Icon(icon, contentDescription = null, tint = androidx.compose.material3.LocalContentColor.current, modifier = Modifier.size(d * 0.5f))
        }
    }
}

/** Delete · Clear: small candy buttons (A8) on one row. */
@Composable
private fun Capsule(label: String, icon: ImageVector, onClick: () -> Unit) {
    PadAction(label, icon, onClick = onClick)
}

/** I1 one answer slot: a coin when [circled], the square glossy tile otherwise. */
@Composable
private fun MuddleSlot(
    ch: String, pinned: Boolean, circled: Boolean, size: Dp,
    solved: Boolean = false, flipDelayMs: Int = 0, punchline: Boolean = false, hop: Boolean = false, hopDelayMs: Int = 0,
    muted: Boolean = false,
) {
    if (circled || punchline) {
        MuddleCoin(ch, pinned, punchline, size, Modifier.size(size), solved = solved, hop = hop, flipDelayMs = flipDelayMs, hopDelayMs = hopDelayMs)
    } else {
        MuddleSquare(ch, pinned, size, Modifier.size(size), solved = solved, hop = hop, flipDelayMs = flipDelayMs, hopDelayMs = hopDelayMs, muted = muted)
    }
}

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun MuddleFinished(
    session: MuddleSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
    onFinished: () -> Unit,
) {
    val s = session.state
    val won = s.status == ScrambleStatus.WON
    val secs = session.elapsed
    val gc = scrambleGuessCount(s)
    val solvedCount = scrambleBoardsSolved(s)
    val context = LocalContext.current
    val hintsText = if (s.hintsUsed > 0) " · ${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}" else ""
    val title = if (won) (if (s.checks == 5 && s.hintsUsed == 0) "Muddle solved clean" else "Muddle solved") else "Out of checks"
    val screenH = LocalConfiguration.current.screenHeightDp
    val cartoonCap = screenH.dp * CARTOON_SCREEN_FRACTION
    val share = {
        val num = if (session.isDaily) session.dailyNumber else null
        val meta = "${num?.let { "#$it · " } ?: ""}$solvedCount/$SCRAMBLE_TOTAL_BOARDS solved · ${session.checksLabel} · ${clockText(secs)}"
        val text = "Wordocious Muddle${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${clockText(secs)} · $solvedCount/$SCRAMBLE_TOTAL_BOARDS solved · ${session.checksLabel} · wordocious.com/muddle"
        val bmp = ShareImage.renderScramble(
            context, s.words.map { it.answer.length }, s.words.map { it.circled }, s.final.pattern, s.checks, solvedCount, won, meta,
        )
        ShareImage.shareBitmap(context, bmp, text)
    }
    FinishedScreen(
        // Short phones keep the compact header so the cartoon stays >= 150 dp (release blocker 10-02).
        header = { MuddleHeader(session, compact = screenH < SHORT_SCREEN_DP) },
        strip = {
            ResultStrip(
                won,
                listOfNotNull(
                    if (!won) stripCount("$solvedCount/$SCRAMBLE_TOTAL_BOARDS", "solved") else null,
                    stripCount("${s.checks}", if (s.checks == 1) "check" else "checks", StripGlyph.CROWN),
                    stripTime(secs), stripPoints(session.points),
                ),
                srText = "$title. $solvedCount of $SCRAMBLE_TOTAL_BOARDS solved, ${session.checksLabel}, time ${timeText(secs)}$hintsText, ${session.points} points",
            )
        },
        dock = {
            FinishedDock(
                GameMode.SCRAMBLE, isDaily = session.isDaily, accent = MUDDLE_ACCENT, onShare = share,
                onOpenDaily = onOpenDaily, onOpenLeaderboard = onOpenLeaderboard, onOpenUnlimited = onOpenUnlimited,
                onNewPuzzle = if (!session.isDaily && isPro && onPlayAgain != null) onPlayAgain else null,
                onOtherGames = onBack,
                more = {
                    Text(
                        "$title · $solvedCount/$SCRAMBLE_TOTAL_BOARDS solved · ${session.checksLabel} · ${timeText(secs)}$hintsText",
                        fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted, textAlign = TextAlign.Center,
                    )
                    if (session.isDaily) DailyRankBadge(GameMode.SCRAMBLE)
                    ScoreBreakdownCard(GameMode.SCRAMBLE, won, gc, secs, solvedCount, SCRAMBLE_TOTAL_BOARDS, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
                },
            )
        },
    ) { _, maxH ->
        // R2 + the shared layout model (release blocker 10-02): the cartoon and the caption on
        // top, then the four words (2x2) and the punchline; the cartoon takes what the rows
        // leave (floor 150, cap 36 % of the screen). Only if even that cannot fit does a
        // "See the cartoon" chip open it in a sheet.
        var showCartoon by remember { mutableStateOf(false) }
        val puzzle = session.puzzle
        androidx.compose.runtime.CompositionLocalProvider(LocalMuddleSizes provides muddleSizesFor(screenH)) {
            MuddleStage(
                Modifier.fillMaxWidth().widthIn(max = 420.dp).heightIn(max = maxH),
                cap = cartoonCap, fill = false, gap = 6.dp,
                cartoon = { h ->
                    if (h >= 64.dp) CartoonPanel(puzzle?.cartoon, puzzle?.altText ?: "Cartoon", height = h)
                    else FinishedChip("See the cartoon", MUDDLE_ACCENT) { showCartoon = true }
                },
                caption = { Caption(s, finished = true) },
                rows = { MuddlePuzzle(session, finished = true, onFinished) },
            )
        }
        if (showCartoon) {
            FinishedSheet("The cartoon", MUDDLE_ACCENT, onDismiss = { showCartoon = false }) {
                CartoonPanel(puzzle?.cartoon, puzzle?.altText ?: "Cartoon", height = 220.dp)
                Caption(s, finished = true)
            }
        }
    }
}

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"
/** Always m:ss — the header clock and the share caption. */
private fun clockText(s: Int) = "${s / 60}:${"%02d".format(s % 60)}"

@Composable
private fun MuddleOverlay(session: MuddleSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == ScrambleStatus.WON
    val secs = session.elapsed
    // FINISH_SPEC R1: the shared win / lose popup; the punchline is the answer on the tiles.
    val punchline = session.state.final.answer.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    WinPopup(
        won = won, hostKey = "SCRAMBLE", accent = MUDDLE_ACCENT, onContinue = onDismiss,
        answers = if (punchline.isNotEmpty()) WinAnswers(punchline) else null,
        stats = listOf(
            WinStat(WinStatKind.GUESSES, "${session.state.checks}", "Checks"),
            WinStat(WinStatKind.TIME, timeText(secs), "Time"),
            WinStat(WinStatKind.POINTS, "%,d".format(session.points), "Points"),
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
