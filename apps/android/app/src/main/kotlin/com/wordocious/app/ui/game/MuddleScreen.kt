package com.wordocious.app.ui.game

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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
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
private val SKETCH_INK = Color(0xFF1A1A2E)
/** ONE fixed six-column grid for every word (the sixth slot simply empty for a five-letter word). */
private const val COLS = 6
/** Where the cartoon batch is hosted (the web serves /muddle/<file> from public/muddle). */
private const val CARTOON_HOST = "https://wordocious.com/muddle/"

// Compact rule sizes (founder, 2026-09-23 — plan §5): the whole puzzle on one screen.
/** The cartoon's height cap as a fraction of the screen height (~26 %). */
private const val CARTOON_SCREEN_FRACTION = 0.26f
/** Below this the cartoon stops shrinking and the picture area scrolls instead (never the keyboard). */
private val CARTOON_FLOOR = 120.dp
/** Word tiles on the fixed six-column grid (36–40 dp by the rule). */
private val WORD_TILE = 36.dp
/** The punchline tiles (~32 dp). */
private val FINAL_TILE = 32.dp
/** Gap between tiles on the grid. */
private val TILE_GAP = 6.dp
/** The Letter · Solve icon circles (28–30 dp). */
private val HINT_CIRCLE = 28.dp
/** The circled ring is ~60 % of the tile, drawn inside it. */
private const val RING_FRACTION = 0.60f
private val CAPTION_FONT = 14.sp
private val CAPTION_LINE_HEIGHT = 18.sp

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
    private var guidePauseStart: Long? = null
    private var recorded = false

    val isFinished get() = state.status != ScrambleStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, ((System.currentTimeMillis() - startMs) / 1000).toInt())
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

    fun beginTimer() { startMs = System.currentTimeMillis() - restoredElapsedMs }
    fun pauseForGuide() { if (guidePauseStart == null && !isFinished) guidePauseStart = System.currentTimeMillis() }
    fun resumeFromGuide() { guidePauseStart?.let { startMs += System.currentTimeMillis() - it; guidePauseStart = null } }

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
                ScrambleResult.CORRECT -> SoundManager.playSuccess()
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
        if (isDaily) DailyCompletionsService.noteCompletion(GameMode.SCRAMBLE.name, won, scrambleGuessCount(state), elapsed)
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

    // One clock for the header.
    val tick by produceState(0, session.isFinished) {
        while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ }
    }

    Box(Modifier.fillMaxSize().background(WTheme.bg).statusBarsPadding()) {
        if (session.isFinished) {
            val cartoonH = LocalConfiguration.current.screenHeightDp.dp * CARTOON_SCREEN_FRACTION
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                MuddleHeader(session, tick)
                MuddlePicture(session, finished = true, cartoonHeight = cartoonH)
                MuddlePuzzle(session, finished = true, onFinished)
                MuddleResult(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
            }
        } else {
            // Compact rule (founder, 2026-09-23): the WHOLE puzzle on one screen with the
            // keyboard pinned. Header, the four words, the punchline, Delete · Clear and the
            // keyboard are fixed-height; the cartoon takes what they leave (capped at ~26 % of
            // the screen) and shrinks first on shorter phones — only below its floor does the
            // picture area scroll, and then only the cartoon and caption ever move.
            BoxWithConstraints(Modifier.fillMaxSize()) {
                val cartoonCap = maxHeight * CARTOON_SCREEN_FRACTION
                Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    MuddleHeader(session, tick)
                    BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                        // Two caption lines (font-scaled) plus the gap under the cartoon.
                        val captionAllowance = with(LocalDensity.current) { (CAPTION_LINE_HEIGHT * 2).toDp() } + 8.dp
                        val cartoonH = minOf(cartoonCap, maxWidth * 0.75f, maxOf(maxHeight - captionAllowance, CARTOON_FLOOR))
                        Column(
                            Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
                        ) {
                            MuddlePicture(session, finished = false, cartoonHeight = cartoonH)
                        }
                    }
                    MuddlePuzzle(session, finished = false, onFinished)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Capsule("Delete", Icons.AutoMirrored.Outlined.Backspace) { SoundManager.playKeyTap(); session.back() }
                        Capsule("Clear", Icons.Filled.Cancel) { SoundManager.playKeyTap(); session.clear() }
                    }
                    KeyboardView(onKey = { session.type(it, onFinished) }, onDelete = { session.back() }, onEnter = { session.jumpToActive() })
                    Spacer(Modifier.height(4.dp))
                }
            }
        }
        session.toast?.let {
            Box(Modifier.fillMaxWidth().padding(top = 112.dp), contentAlignment = Alignment.TopCenter) {
                Text(it, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 24.dp).clip(RoundedCornerShape(10.dp)).background(WTheme.text.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 10.dp))
            }
        }
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) MuddleOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(MUDDLE_ACCENT, onBack) }
        CornerHelpButton(MUDDLE_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
        if (showGuide) GuideSheet(mode = GameMode.SCRAMBLE, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MuddleHeader(session: MuddleSession, tick: Int) {
    val s = session.state
    // Compact rule: the title and ONE meta line, tight — the corner buttons (44 dp + 8) sit either side.
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(top = 2.dp)) {
        Text("MUDDLE", fontSize = 20.sp, lineHeight = 22.sp, fontWeight = FontWeight.Black, color = MUDDLE_ACCENT, fontFamily = Nunito, maxLines = 1, modifier = Modifier.padding(horizontal = 52.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.Center, modifier = Modifier.padding(horizontal = 48.dp)) {
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

/** The picture half of the founder's newspaper layout: the cartoon (at the height the screen allows) and its caption. */
@Composable
private fun MuddlePicture(session: MuddleSession, finished: Boolean, cartoonHeight: Dp) {
    val puzzle = session.puzzle
    CartoonPanel(puzzle?.cartoon, puzzle?.altText ?: "Cartoon", height = cartoonHeight)
    Caption(session.state, finished)
}

/** The puzzle half, fixed-height: the four words as compact blocks, a divider, the punchline. */
@Composable
private fun MuddlePuzzle(session: MuddleSession, finished: Boolean, onFinished: () -> Unit) {
    Column(Modifier.fillMaxWidth().widthIn(max = 420.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        for (i in 0 until SCRAMBLE_FINAL) {
            WordRow(
                session, i, active = !finished && session.row == i, shaking = session.shakeRow == i, finished = finished,
                onSelect = { session.selectRow(i) }, onTapTile = { ch -> session.tapTile(i, ch, onFinished) },
                onRevealLetter = { SoundManager.playKeyTap(); session.revealLetter(i, onFinished) }, onSolveWord = { SoundManager.playKeyTap(); session.solveWord(i, onFinished) },
            )
        }
        FinalRow(
            session, active = !finished && session.row == SCRAMBLE_FINAL, shaking = session.shakeRow == SCRAMBLE_FINAL, finished = finished,
            onSelect = { session.selectRow(SCRAMBLE_FINAL) }, onTapTile = { ch -> session.tapTile(SCRAMBLE_FINAL, ch, onFinished) },
            onRevealLetter = { SoundManager.playKeyTap(); session.revealLetter(SCRAMBLE_FINAL, onFinished) },
        )
    }
}

/**
 * The cartoon panel (§5/§8): a standard card in the cream paper tone, always
 * 4:3, sized from the height the screen leaves it (compact rule: capped at
 * ~26 % of the screen) and centered. The puzzle's cartoon loads from the web
 * host when set; until the founder's image batch runs a placeholder sketch
 * stands in. The caption is ALWAYS typeset by the app beneath the panel.
 */
@Composable
private fun CartoonPanel(cartoon: String?, altText: String, height: Dp) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        Modifier.size(width = height * 4f / 3f, height = height).clip(shape).background(PAPER).border(1.dp, WTheme.border, shape),
        contentAlignment = Alignment.Center,
    ) {
        if (cartoon != null) {
            coil.compose.AsyncImage(model = CARTOON_HOST + cartoon, contentDescription = altText, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            PlaceholderSketch()
            Text(
                "Cartoon panel — art batch pending", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF6B7280), fontFamily = Nunito,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 10.dp),
            )
        }
    }
}

/** The web placeholder sketch (muddle-board.tsx CartoonPanel) in a 400×300 frame: dashed border, a smiling face, a purple and an orange dot. */
@Composable
private fun PlaceholderSketch() {
    Canvas(Modifier.fillMaxSize()) {
        val sx = size.width / 400f; val sy = size.height / 300f
        val stroke = 3f * sx
        drawRoundRect(
            SKETCH_INK.copy(alpha = 0.35f), Offset(34f * sx, 30f * sy), Size(332f * sx, 240f * sy), CornerRadius(18f * sx),
            style = Stroke(stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f * sx, 8f * sx)), cap = StrokeCap.Round),
        )
        val ink = Stroke(stroke, cap = StrokeCap.Round)
        // Shoulders: M120 215 Q200 120 280 215
        drawPath(Path().apply { moveTo(120f * sx, 215f * sy); quadraticBezierTo(200f * sx, 120f * sy, 280f * sx, 215f * sy) }, SKETCH_INK, style = ink)
        // Head
        drawCircle(SKETCH_INK, 34f * sx, Offset(200f * sx, 130f * sy), style = ink)
        // Eyes: M186 124 q6 -8 12 0 / M202 124 q6 -8 12 0
        drawPath(Path().apply { moveTo(186f * sx, 124f * sy); quadraticBezierTo(192f * sx, 116f * sy, 198f * sx, 124f * sy) }, SKETCH_INK, style = ink)
        drawPath(Path().apply { moveTo(202f * sx, 124f * sy); quadraticBezierTo(208f * sx, 116f * sy, 214f * sx, 124f * sy) }, SKETCH_INK, style = ink)
        // Smile: M188 146 q12 12 24 0
        drawPath(Path().apply { moveTo(188f * sx, 146f * sy); quadraticBezierTo(200f * sx, 158f * sy, 212f * sx, 146f * sy) }, SKETCH_INK, style = ink)
        drawCircle(MUDDLE_ACCENT.copy(alpha = 0.9f), 14f * sx, Offset(300f * sx, 90f * sy))
        drawCircle(PURPLE.copy(alpha = 0.9f), 9f * sx, Offset(100f * sx, 90f * sy))
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
                    Text(answer, fontSize = CAPTION_FONT, fontWeight = FontWeight.ExtraBold, color = LILAC_TEXT, fontFamily = Nunito, maxLines = 1, softWrap = false)
                }
            },
        ),
        fontSize = CAPTION_FONT, lineHeight = CAPTION_LINE_HEIGHT, fontWeight = FontWeight.ExtraBold, color = WTheme.text, fontFamily = Nunito, textAlign = TextAlign.Center,
        maxLines = 2, overflow = TextOverflow.Ellipsis,
        modifier = Modifier.widthIn(max = 420.dp).padding(horizontal = 6.dp),
    )
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
            .then(if (shaking) Modifier.shakeOnReject(session.shakeKey) else Modifier)
            .clip(shape)
            .background(if (active) LILAC else Color.Transparent)
            .border(1.dp, if (active) LILAC_BORDER else Color.Transparent, shape)
            .clickableNoRipple { if (!solved && !finished) onSelect() }
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(Modifier.fillMaxWidth().height(HINT_ROW_HEIGHT), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                w.scramble.forEachIndexed { i, ch ->
                    val dim = dimmed[i] || solved
                    Text(
                        ch.toString(), fontSize = 17.sp, lineHeight = 20.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito, letterSpacing = 1.sp,
                        modifier = Modifier.alpha(if (dim) 0.25f else 1f)
                            .then(if (!dim && !finished) Modifier.clickableNoRipple { onTapTile(ch) } else Modifier)
                            .padding(horizontal = 3.dp, vertical = 6.dp),
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
                if (i >= w.answer.length) { Spacer(Modifier.size(WORD_TILE)); continue }
                val ch = if (solved) w.answer[i].toString() else entry.getOrNull(i)?.toString() ?: ""
                val filled = ch.isNotEmpty()
                val pinned = revealed[i] != '_'
                val bg = if (solved) PURPLE else if (filled) (if (pinned) HINT else PURPLE) else WTheme.surface
                AnswerBox(ch, bg, if (filled) bg else WTheme.border, if (filled) Color.White else WTheme.text, ring = i in circled, ringColor = if (filled) Color.White else PURPLE, ringAlpha = 0.9f, fontSize = 18.sp, modifier = Modifier.size(WORD_TILE))
            }
        }
    }
}

/** The top line of a word block — the hint circles set its height so the scramble letters never jump when they hide. */
private val HINT_ROW_HEIGHT = 32.dp

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
    Column(Modifier.fillMaxWidth().padding(top = 2.dp)) {
        HorizontalDivider(color = WTheme.border, thickness = 1.5.dp)
        Column(
            Modifier.fillMaxWidth()
                .then(if (shaking) Modifier.shakeOnReject(session.shakeKey) else Modifier)
                .clip(shape)
                .background(if (active) LILAC else Color.Transparent)
                .border(1.dp, if (active) LILAC_BORDER else Color.Transparent, shape)
                .alpha(if (open || finished) 1f else 0.55f)
                .clickableNoRipple { if (playable) onSelect() }
                .padding(horizontal = 6.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            // One line: the heading, then (once open) the circled-letter tray and the Letter circle.
            Row(Modifier.fillMaxWidth().heightIn(min = if (playable) HINT_ROW_HEIGHT else 0.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (open || finished) "PUNCHLINE" else "SOLVE THE FOUR WORDS TO UNLOCK THE PUNCHLINE",
                    fontSize = 10.sp, lineHeight = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 1.sp, maxLines = 1,
                    modifier = if (playable) Modifier else Modifier.weight(1f),
                )
                if (playable) {
                    FlowRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalArrangement = Arrangement.Center) {
                        tray.forEachIndexed { i, ch ->
                            Text(
                                ch.toString(), fontSize = 17.sp, lineHeight = 20.sp, fontWeight = FontWeight.Black, color = LILAC_TEXT, fontFamily = Nunito, letterSpacing = 1.sp,
                                modifier = Modifier.alpha(if (dimmed[i]) 0.25f else 1f)
                                    .then(if (!dimmed[i]) Modifier.clickableNoRipple { onTapTile(ch) } else Modifier)
                                    .padding(horizontal = 3.dp, vertical = 6.dp),
                            )
                        }
                    }
                    HintCircle(Icons.Filled.Lightbulb, "Reveal a letter", onRevealLetter)
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                var pos = 0
                for (len in s.final.pattern) {
                    val start = pos; pos += len
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        for (k in 0 until len) {
                            val idx = start + k
                            val ch = if (solved || finished) target.getOrNull(idx)?.toString() ?: "" else entry.getOrNull(idx)?.toString() ?: ""
                            val filled = ch.isNotEmpty()
                            AnswerBox(
                                ch, if (filled) LILAC else WTheme.surface, if (filled) LILAC_BORDER else WTheme.border, LILAC_TEXT,
                                ring = true, ringColor = PURPLE, ringAlpha = if (filled) 0.9f else 0.35f, fontSize = 17.sp, modifier = Modifier.size(FINAL_TILE),
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * The in-row hint control (Letter = lightbulb, Solve = eye): a 28 dp accent
 * circle, icon only — the label lives in the content description (and the
 * guide). It sits in a 40 × 32 dp touch box, and Compose's 48 dp minimum touch
 * target rounds the rest out.
 */
@Composable
private fun HintCircle(icon: ImageVector, description: String, onClick: () -> Unit) {
    Box(Modifier.size(width = 40.dp, height = HINT_ROW_HEIGHT).clickableNoRipple(onClick), contentAlignment = Alignment.Center) {
        Box(
            Modifier.size(HINT_CIRCLE).clip(CircleShape).background(MUDDLE_ACCENT.copy(alpha = 0.08f)).border(1.dp, MUDDLE_ACCENT.copy(alpha = 0.45f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = description, tint = MUDDLE_ACCENT, modifier = Modifier.size(15.dp))
        }
    }
}

/** Delete · Clear: 30 dp capsules on one row. */
@Composable
private fun Capsule(label: String, icon: ImageVector, onClick: () -> Unit) {
    Row(
        Modifier.height(30.dp)
            .clip(CircleShape)
            .background(MUDDLE_ACCENT.copy(alpha = 0.05f))
            .border(1.5.dp, MUDDLE_ACCENT.copy(alpha = 0.4f), CircleShape)
            .clickableNoRipple(onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = MUDDLE_ACCENT, modifier = Modifier.size(13.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = MUDDLE_ACCENT, maxLines = 1, softWrap = false)
    }
}

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun MuddleResult(
    session: MuddleSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == ScrambleStatus.WON
    val secs = session.elapsed
    val gc = scrambleGuessCount(s)
    val solvedCount = scrambleBoardsSolved(s)
    val context = LocalContext.current
    val hintsText = if (s.hintsUsed > 0) " · ${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}" else ""
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 12.dp)) {
        Row(
            Modifier.widthIn(max = 420.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.surface)
                .border(1.dp, WTheme.border, RoundedCornerShape(12.dp)).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(MUDDLE_ACCENT.copy(alpha = 0.08f))
                    .border(2.dp, MUDDLE_ACCENT.copy(alpha = 0.27f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(if (won) "${s.checks}" else "✗", fontSize = 20.sp, fontWeight = FontWeight.Black, color = MUDDLE_ACCENT, fontFamily = Nunito)
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    if (won) (if (s.checks == 5 && s.hintsUsed == 0) "Muddle solved clean" else "Muddle solved") else "Out of checks",
                    fontSize = 15.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF16A34A) else Color(0xFFEF4444), fontFamily = Nunito,
                )
                Text("$solvedCount/$SCRAMBLE_TOTAL_BOARDS solved · ${session.checksLabel} · ${timeText(secs)}$hintsText", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            ResultAction(Icons.Filled.Home, "Home", MUDDLE_ACCENT, onBack)
            ResultAction(Icons.Filled.Share, "Share", MUDDLE_ACCENT) {
                val num = if (session.isDaily) session.dailyNumber else null
                val meta = "${num?.let { "#$it · " } ?: ""}$solvedCount/$SCRAMBLE_TOTAL_BOARDS solved · ${session.checksLabel} · ${clockText(secs)}"
                val text = "Wordocious Muddle${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${clockText(secs)} · $solvedCount/$SCRAMBLE_TOTAL_BOARDS solved · ${session.checksLabel} · wordocious.com/muddle"
                val bmp = ShareImage.renderScramble(
                    context, s.words.map { it.answer.length }, s.words.map { it.circled }, s.final.pattern, s.checks, solvedCount, won, meta,
                )
                ShareImage.shareBitmap(context, bmp, text)
            }
            if (!session.isDaily && isPro && onPlayAgain != null) ResultAction(Icons.Filled.Refresh, "Play Again", Color(0xFFD97706)) { onPlayAgain() }
        }
        if (session.isDaily) DailyRankBadge(GameMode.SCRAMBLE)
        ScoreBreakdownCard(GameMode.SCRAMBLE, won, gc, secs, solvedCount, SCRAMBLE_TOTAL_BOARDS, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.SCRAMBLE, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
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
private fun MuddleOverlay(session: MuddleSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == ScrambleStatus.WON
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
