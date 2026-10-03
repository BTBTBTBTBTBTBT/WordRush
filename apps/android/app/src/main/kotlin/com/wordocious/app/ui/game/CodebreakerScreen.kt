package com.wordocious.app.ui.game

import com.wordocious.app.ui.gameBackground
import android.app.Activity
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.CRYPTOGRAM_ALPHABET
import com.wordocious.core.CRYPTOGRAM_DAILY_EPOCH
import com.wordocious.core.CRYPTOGRAM_REVEAL_AFTER_SECONDS
import com.wordocious.core.CryptogramAction
import com.wordocious.core.CryptogramBank
import com.wordocious.core.CryptogramPuzzle
import com.wordocious.core.CryptogramState
import com.wordocious.core.CryptogramStatus
import com.wordocious.core.GameMode
import com.wordocious.core.HolidayTable
import com.wordocious.core.createCryptogramState
import com.wordocious.core.cryptogramCodeLetters
import com.wordocious.core.cryptogramDailyNumber
import com.wordocious.core.cryptogramEncipher
import com.wordocious.core.cryptogramFrequencies
import com.wordocious.core.cryptogramGuessCount
import com.wordocious.core.cryptogramMatchRow
import com.wordocious.core.cryptogramPlainFor
import com.wordocious.core.cryptogramPuzzleForDay
import com.wordocious.core.cryptogramPuzzleForSeed
import com.wordocious.core.cryptogramReduce
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Codebreaker (More Games §16) — the Android twin of components/cryptogram/*
// and CodebreakerView.swift. A saying in a substitution cipher; three letters
// given. Letters are pencil — set, change and clear freely; a plain letter used
// for two code letters reads red. Check (counts, guess_count = min(checks,3)+1)
// locks right letters and clears wrong ones; Hint reveals the most frequent
// unresolved letter; Reveal (after 5:00) shows the answer and records a loss.
// The puzzle completes itself the moment every letter is right.

private val CRYPTOGRAM_ACCENT = Color(0xFF92400E)
private val CRYPTOGRAM_WRONG = Color(0xFFDC2626)

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

class CodebreakerSession(val seed: String, val isDaily: Boolean) {
    private val bank: CryptogramBank = CryptogramBank.bundled ?: CryptogramBank(1, CRYPTOGRAM_DAILY_EPOCH, emptyList(), emptyList())

    var state by mutableStateOf(
        createCryptogramState(
            run {
                val fallback = CryptogramPuzzle("none", "Practice makes perfect.", "QWERTYUIOPASDFGHJKLZXCVBNM", listOf("E", "T", "A"))
                (if (isDaily) cryptogramPuzzleForDay(bank, todayLocalDate(), HolidayTable.bundled) else cryptogramPuzzleForSeed(bank, seed)) ?: fallback
            },
            seed, System.currentTimeMillis(),
        ),
    )
        private set
    /** The code letter the keyboard writes to — every occurrence highlights. */
    var selected by mutableStateOf<String?>(null)
    var toast by mutableStateOf<String?>(null)
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

    val isFinished get() = state.status != CryptogramStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, (((pauseStart ?: System.currentTimeMillis()) - startMs) / 1000).toInt())
    val dailyNumber get() = cryptogramDailyNumber(todayLocalDate())
    /** The holiday this puzzle was drawn from (its display title), or null for an everyday puzzle. */
    val holidayTitle: String? get() {
        val id = state.id
        val key = bank.holiday?.entries?.firstOrNull { (_, list) -> list.any { it.id == id } }?.key ?: return null
        return HOLIDAY_TITLES[key]
    }
    val checksLabel: String get() = if (state.checks == 0) "No checks" else "${state.checks} check${if (state.checks == 1) "" else "s"}"
    val points: Int get() = com.wordocious.app.data.DailyScoring.breakdown(
        GameMode.CRYPTOGRAM.name, state.status == CryptogramStatus.WON, state.guessCount, elapsed,
        if (state.status == CryptogramStatus.WON) 1 else 0, 1, state.hintsUsed,
    ).total.toInt()

    // Declared BEFORE init: restore() runs inside init and needs it. Declared below the
    // block it was null during construction, decode threw inside runCatching and every
    // save was silently ignored on the next open (Doug, Android production, 2026-09-25).
    private val json = Json { ignoreUnknownKeys = true }

    init { restore(); if (selected == null) selected = nextOpen(state, null) }

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
        val id: String, val text: String, val key: String, val given: List<String>,
        val mapping: Map<String, String>, val locked: List<String>, val hinted: List<String>,
        val hintsUsed: Int, val checks: Int, val events: List<String>,
        val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
    )
    private val storageKey get() = if (isDaily) "cryptogram-save-daily" else "cryptogram-save-$seed"

    private fun persist() {
        if (!isDaily && isFinished) { SettingsPref.remove(storageKey); return }
        val s = state
        val dto = SaveDto(
            seed, todayLocalDate(), elapsed, System.currentTimeMillis(),
            s.id, s.text, s.key, s.given, s.mapping, s.locked, s.hinted, s.hintsUsed, s.checks, s.events,
            s.status.key, s.ended, s.startTime, s.endTime,
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
        if (dto.key.length != 26) return
        val status = CryptogramStatus.values().firstOrNull { it.key == dto.status } ?: CryptogramStatus.PLAYING
        state = CryptogramState(
            seed, dto.id, dto.text, dto.key, cryptogramEncipher(dto.text, dto.key), dto.given,
            dto.mapping, dto.locked, dto.hinted, dto.hintsUsed, dto.checks, emptyList(), dto.events,
            status, dto.ended, dto.startTime, dto.endTime,
        )
        restoredElapsedMs = dto.elapsed * 1000L
        if (status != CryptogramStatus.PLAYING) { finalTimeSeconds = dto.elapsed; recorded = true; restoredFinished = true }
    }

    /** Reading-order code letters not yet resolved (unmapped, or mapped but not locked) — the next one after [after]. */
    private fun nextOpen(s: CryptogramState, after: String?): String? {
        val order = ArrayList<String>()
        for (ch in s.cipher) if (ch in CRYPTOGRAM_ALPHABET) { val c = ch.toString(); if (c !in order) order.add(c) }
        val open = order.filter { it !in s.locked && s.mapping[it].isNullOrEmpty() }
        if (open.isEmpty()) { val any = order.filter { it !in s.locked }; return any.firstOrNull { it != after } ?: any.firstOrNull() }
        val i = if (after != null) order.indexOf(after) else -1
        return open.firstOrNull { order.indexOf(it) > i } ?: open[0]
    }

    private fun dispatch(a: CryptogramAction, onFinished: () -> Unit) {
        if (isFinished) return
        state = cryptogramReduce(state, a, System.currentTimeMillis())
        if (isFinished) onFinished()
        persist()
    }

    fun select(code: String) { if (code in CRYPTOGRAM_ALPHABET && code in state.cipher) selected = code }
    fun type(ch: Char, onFinished: () -> Unit) {
        if (isFinished) return
        val sel = selected ?: return
        if (sel in state.locked) { flash("That letter is locked"); return }
        val plain = ch.uppercaseChar().toString()
        if (plain !in CRYPTOGRAM_ALPHABET) return
        dispatch(CryptogramAction.Set(sel, plain), onFinished)
        if (!isFinished) selected = nextOpen(state, sel)
    }
    fun delete() {
        if (isFinished) return
        val sel = selected ?: return
        if (sel in state.locked) { flash("That letter is locked"); return }
        if (!state.mapping[sel].isNullOrEmpty()) dispatch(CryptogramAction.Set(sel, null)) {}
    }
    fun advance() { if (!isFinished) selected = nextOpen(state, selected) }
    /** ← / → on a physical keyboard (web cryptogram-game.tsx): every unlocked code letter in reading
     *  order, filled or not, wrapping at both ends (Enter/Tab jump to the next OPEN one instead). */
    fun step(dir: Int) {
        if (isFinished) return
        val order = ArrayList<String>()
        for (ch in state.cipher) if (ch in CRYPTOGRAM_ALPHABET) { val c = ch.toString(); if (c !in order && c !in state.locked) order.add(c) }
        if (order.isEmpty()) return
        val i = selected?.let { order.indexOf(it) } ?: -1
        selected = if (i < 0) order[if (dir > 0) 0 else order.size - 1] else order[(i + dir + order.size) % order.size]
    }
    fun check(onFinished: () -> Unit) {
        if (isFinished) return
        if (state.mapping.keys.none { it !in state.locked }) { flash("Pencil some letters first"); return }
        dispatch(CryptogramAction.Check, onFinished)
        val wrong = state.lastWrong.size
        if (wrong > 0) { flash("$wrong wrong letter${if (wrong == 1) "" else "s"} cleared"); SoundManager.playInvalid() }
        else { flash("Everything penciled is right"); SoundManager.playPartial() }
    }
    /** The red flash on letters a Check cleared lasts 700ms (web parity). */
    fun clearLastWrong() { if (state.lastWrong.isNotEmpty()) state = state.copy(lastWrong = emptyList()) }
    fun hint(onFinished: () -> Unit) {
        if (isFinished) return
        dispatch(CryptogramAction.Hint, onFinished)
        if (!isFinished && selected != null && selected in state.locked) selected = nextOpen(state, selected)
    }
    fun reveal(onFinished: () -> Unit) { if (!isFinished && elapsed >= CRYPTOGRAM_REVEAL_AFTER_SECONDS) dispatch(CryptogramAction.Reveal, onFinished) }

    suspend fun finish() {
        finalTimeSeconds = elapsed
        if (state.status == CryptogramStatus.WON) SoundManager.playSuccess() else SoundManager.playGameOver()
        if (recorded) return
        recorded = true
        val won = state.status == CryptogramStatus.WON
        val gc = cryptogramGuessCount(state.checks)
        val (solutions, guesses) = cryptogramMatchRow(state)
        val xp = GameResultsService.record(
            gameMode = GameMode.CRYPTOGRAM, won = won, guessCount = gc, timeSeconds = elapsed,
            boardsSolved = if (won) 1 else 0, totalBoards = 1, seed = seed,
            solutions = solutions, guesses = guesses, hintsUsed = state.hintsUsed,
        )
        xpResult = xp
        if (isDaily) DailyCompletionsService.noteCompletion(GameMode.CRYPTOGRAM.name, won, gc, elapsed)
    }

    private fun flash(m: String) { toast = m }
}

// ── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun CodebreakerScreen(
    seed: String,
    isDaily: Boolean,
    onBack: () -> Unit,
    onPlayAgain: (() -> Unit)? = null,
    onOpenDaily: (GameMode) -> Unit = {},
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val session = remember(seed) { CodebreakerSession(seed, isDaily) }
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

    val onFinished: () -> Unit = {
        scope.launch {
            session.finish()
            if (!session.restoredFinished) showOverlay = true
            if (session.state.status == CryptogramStatus.WON) {
                RatingsPrompt.recordWin(context)
                (context as? Activity)?.let { RatingsPrompt.maybeAsk(it) }
            }
        }
    }

    androidx.activity.compose.BackHandler { onBack() }


    // Physical keyboard (founder, 2026-09-30; web cryptogram-game.tsx): A–Z pencils the selected
    // code letter, Backspace/Delete clears it, Enter/Tab moves to the next open code letter,
    // ← / → step through every unlocked code letter (wrapping).
    val cbKeys = keyboardViewKeys(onKey = { session.type(it, onFinished) }, onDelete = { session.delete() }, onEnter = { session.advance() })
    ProvideFeedbackAnchor {
    Box(
        Modifier.fillMaxSize()
            .hardwareKeys(enabled = !session.isFinished && !showOverlay && !showGuide) { k ->
                when (k) {
                    HwKey.Tab -> { session.advance(); true }
                    HwKey.Right -> { session.step(1); true }
                    HwKey.Left -> { session.step(-1); true }
                    else -> cbKeys(k)
                }
            }
            .gameBackground { background(WTheme.bg) }.statusBarsPadding(),
    ) {
        if (session.isFinished) {
            // FINISH_SPEC R2: the one-screen finished screen (header · strip · board · dock).
            CodebreakerFinished(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                CodebreakerHeader(session)
                // The board + frequency strip block is centered in the band between the
                // header and the capsule row; capsules and keyboard stay pinned below.
                CipherBand(session, Modifier.weight(1f).fillMaxWidth())
                // Pinned: the letter frequencies always sit right above the buttons and keyboard.
                FrequencyStrip(session, chipSp = 12.sp)
                CodebreakerCapsules(session, onFinished)
                // Settled plain letters (given, checked-correct, hinted) fill their keys (founder, 2026-09-28).
                val usedFills = session.state.locked.mapNotNull { session.state.mapping[it] }.associateWith { CRYPTOGRAM_ACCENT }
                KeyboardView(onKey = { session.type(it, onFinished) }, onDelete = { session.delete() }, onEnter = { session.advance() }, keyFills = usedFills)
                Spacer(Modifier.height(6.dp))
            }
        }
        // G5 a toast is a tinted pill (no dark slab, no white).
        // The candy feedback toast, centered on the header meta row (never the title art or the board).
        GameFeedbackToast(session.toast, fallbackTop = 100.dp)
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) CodebreakerOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(CRYPTOGRAM_ACCENT, onBack) }
        CornerHelpButton(CRYPTOGRAM_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET))
        if (showGuide) GuideSheet(mode = GameMode.CRYPTOGRAM, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
    }
}

/** The capsule row owns the Reveal countdown's tick, so the countdown recomposes only this row. */
@Composable
private fun CodebreakerCapsules(session: CodebreakerSession, onFinished: () -> Unit) {
    val tick by produceState(0, session.isFinished) { while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ } }
    @Suppress("UNUSED_EXPRESSION") tick
    val revealIn = maxOf(0, CRYPTOGRAM_REVEAL_AFTER_SECONDS - session.elapsed)
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Capsule("Delete", Icons.AutoMirrored.Filled.Backspace) { session.delete() }
        // BI22: fixed labels — the check / hint counts are corner badges (overlays) — and the
        // ticking Reveal countdown keeps its widest width, so nothing ever nudges the row.
        Capsule("Check", Icons.Filled.DoneAll, color = com.wordocious.app.ui.CandyColor.PURPLE, count = session.state.checks) { session.check(onFinished) }
        Capsule("Hint", Icons.Filled.Lightbulb, color = com.wordocious.app.ui.CandyColor.AMBER, count = session.state.hintsUsed) { session.hint(onFinished) }
        val revealLabel = if (revealIn > 0) "Reveal · ${clockText(revealIn)}" else "Reveal"
        Capsule(revealLabel, Icons.Filled.Visibility, dim = revealIn > 0, reserve = HintLayout.countdownReserve("Reveal · ${clockText(CRYPTOGRAM_REVEAL_AFTER_SECONDS)}")) { session.reveal(onFinished) }
    }
}

@Composable
private fun CodebreakerHeader(session: CodebreakerSession) {
    val tick by produceState(0, session.isFinished) { while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ } }
    val s = session.state
    val codes = cryptogramCodeLetters(s.cipher)
    val resolved = codes.count { it in s.locked || !s.mapping[it].isNullOrEmpty() }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        // The game's title art: lettering + host (ART_SPEC §10).
        com.wordocious.app.ui.HostedGameTitle("CRYPTOGRAM") { Text("CODEBREAKER", fontSize = 24.sp, fontWeight = FontWeight.Black, color = CRYPTOGRAM_ACCENT, fontFamily = Nunito) }
        Row(Modifier.feedbackAnchor(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            session.holidayTitle?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CRYPTOGRAM_ACCENT) }
            Text("$resolved/${codes.size} letters", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text(session.checksLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            @Suppress("UNUSED_EXPRESSION") tick
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Icon(Icons.Filled.Schedule, null, tint = WTheme.textMuted, modifier = Modifier.size(11.dp))
                Text(clockText(session.elapsed), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
    }
}

// ── Sizing (§16 layout rule, founder 2026-09-24) ───────────────────────────
// The cipher board and the frequency strip are ONE block centered vertically in
// the band between the header and the Delete · Check · Hint · Reveal row. The
// cell side starts at 64 dp and steps down 4 dp at a time until the whole
// cipher, wrapped word-by-word at the band's width, fits the band's height
// together with the strip; floor 40 dp. The code letter under each cell and
// the frequency chips scale with the cell. Pure dp arithmetic, no Compose, so
// the wrap and the fit are checkable without a device.

private const val CIPHER_CELL_MAX = 64f
/** Floor 26 dp (was 40): a long saying must fit the band with no scroll (founder, 2026-09-26). */
private const val CIPHER_CELL_MIN = 26f
/** Type scales from here, not from the new floor: a 26 dp cell keeps the old floor's 10 sp / 11 sp text. */
private const val CIPHER_FONT_FLOOR = 40f
private const val CIPHER_CELL_STEP = 2f
/** Below the 40 dp floor only the WIDTH may push: a word that will not fit one line is worse than a smaller cell. */
private const val CIPHER_CELL_WIDTH_FLOOR = 20f
private const val CIPHER_TILE_RING = 6f          // 3 dp ring padding either side of the tile box
private const val CIPHER_TILE_ASPECT = 1.14f     // tile height / cell side (Classic tile geometry)
private const val CIPHER_WORD_GAP_RATIO = 0.45f  // gap between word chunks as a fraction of the cell
private const val CIPHER_LINE_GAP_MIN = 6f
private const val CIPHER_LINE_GAP_RATIO = 0.15f
private const val CIPHER_BLOCK_GAP = 10f         // board → conflict slot → strip
private const val CIPHER_CONFLICT_SLOT = 16f     // fixed-height slot so a conflict appearing never resizes the board
private const val CIPHER_CHIP_GAP = 4f
/** L the board's game tray: inner padding across / down (dp); the tray adds its 4 dp lip below. */
private const val CIPHER_TRAY_H = 8f
private const val CIPHER_TRAY_V = 10f

/** Code letter under a cell: 10 sp at the floor, 14 sp at the 64 dp top end. */
internal fun cipherCodeSp(cell: Float): Float =
    (10f + (cell - CIPHER_FONT_FLOOR) / (CIPHER_CELL_MAX - CIPHER_FONT_FLOOR) * 4f).coerceIn(10f, 14f)

/** Frequency chip text: 11 sp at the floor, 14 sp at the 64 dp top end. */
internal fun cipherChipSp(cell: Float): Float =
    (11f + (cell - CIPHER_FONT_FLOOR) / (CIPHER_CELL_MAX - CIPHER_FONT_FLOOR) * 3f).coerceIn(11f, 14f)

/** Punctuation between cells, as plain bold text: 18 sp up to the old compact cells, growing with the cell. */
internal fun cipherPunctSp(cell: Float): Float = (cell * 0.45f).coerceIn(18f, 28f)

internal fun cipherLineGap(cell: Float): Float = maxOf(CIPHER_LINE_GAP_MIN, cell * CIPHER_LINE_GAP_RATIO)

/** Height of one wrapped line in dp: tile box (ring included) + 2 dp + the code label. */
internal fun cipherLineHeight(cell: Float, fontScale: Float): Float =
    cell * CIPHER_TILE_ASPECT + CIPHER_TILE_RING + 2f + cipherCodeSp(cell) * 1.1f * fontScale

/** Width of one word chunk in dp: letter cells side by side (ring padding included), punctuation as narrow bold text. */
internal fun cipherWordWidth(word: String, cell: Float): Float {
    var w = 0f
    for (ch in word) w += if (ch in CRYPTOGRAM_ALPHABET) cell + CIPHER_TILE_RING else cipherPunctSp(cell) * 0.55f + 4f
    return w
}

/** Wrapped line count for the cipher at [cell]: greedy word-by-word at [width]; words never split —
 *  a word wider than the line takes a line of its own (the fit check catches that case by width). */
internal fun cipherLineCount(words: List<String>, cell: Float, width: Float): Int {
    val gap = cell * CIPHER_WORD_GAP_RATIO
    var lines = 0
    var x = 0f
    for (w in words) {
        val ww = cipherWordWidth(w, cell)
        when {
            lines == 0 -> { lines = 1; x = ww }
            x + gap + ww <= width -> x += gap + ww
            else -> { lines++; x = ww }
        }
    }
    return lines
}

/** Frequency strip height in dp: chips wrap greedily at [width]; every chip is costed as if it already
 *  shows "→X" so the strip cannot outgrow the estimate as letters fill in. */
internal fun cipherStripHeight(codeCount: Int, freqDigits: Int, cell: Float, width: Float, fontScale: Float): Float {
    val sp = cipherChipSp(cell) * fontScale
    val chipH = sp * 1.3f + 8f                              // 3 dp padding × 2 + 1 dp border × 2
    val chipW = 18f + 6f + sp * 0.65f * (1 + freqDigits + 2) // 8 dp padding × 2 + border, two 3 dp gaps, "B 3 →A"
    var rows = 0
    var x = 0f
    repeat(codeCount) {
        when {
            rows == 0 -> { rows = 1; x = chipW }
            x + CIPHER_CHIP_GAP + chipW <= width -> x += CIPHER_CHIP_GAP + chipW
            else -> { rows++; x = chipW }
        }
    }
    return rows * chipH + (rows - 1).coerceAtLeast(0) * CIPHER_CHIP_GAP
}

/** The whole block — board lines, the conflict slot and the strip — at [cell]. */
internal fun cipherBlockHeight(lines: Int, codeCount: Int, freqDigits: Int, cell: Float, width: Float, fontScale: Float, withStrip: Boolean = true): Float {
    val board = lines * cipherLineHeight(cell, fontScale) + (lines - 1).coerceAtLeast(0) * cipherLineGap(cell)
    val strip = if (withStrip) CIPHER_BLOCK_GAP + cipherStripHeight(codeCount, freqDigits, cell, width, fontScale) else 0f
    return board + CIPHER_BLOCK_GAP + CIPHER_CONFLICT_SLOT + strip
}

internal data class CipherFit(val cell: Float, val lines: Int, val fits: Boolean)

/** Cell side for a band of [width] × [height] dp: 64 → 40 in 4 dp steps until the wrapped cipher plus the
 *  strip fit the height and the widest word fits the width. Below 40 only a too-wide word may push further
 *  (to 20). [fits] false = even the floor overflows the height; the caller then scrolls instead of centering. */
internal fun cipherCellFit(words: List<String>, codeCount: Int, freqDigits: Int, width: Float, height: Float, fontScale: Float, withStrip: Boolean = true): CipherFit {
    var cell = CIPHER_CELL_MAX
    while (true) {
        val lines = cipherLineCount(words, cell, width)
        val wide = (words.maxOfOrNull { cipherWordWidth(it, cell) } ?: 0f) > width
        val tall = cipherBlockHeight(lines, codeCount, freqDigits, cell, width, fontScale, withStrip) > height
        if (!wide && !tall) return CipherFit(cell, lines, fits = true)
        if (cell <= CIPHER_CELL_MIN && (!wide || cell <= CIPHER_CELL_WIDTH_FLOOR)) return CipherFit(cell, lines, fits = false)
        cell -= CIPHER_CELL_STEP
    }
}

// ── Board ───────────────────────────────────────────────────────────────────

/** The band between the header and the capsule row: the board and the frequency
 *  strip as one block, centered vertically, with the cell side chosen by
 *  [cipherCellFit] for the band's measured size. If even the 40 dp floor cannot
 *  fit the height, the block top-aligns and scrolls. */
@Composable
private fun CipherBand(session: CodebreakerSession, modifier: Modifier) {
    val s = session.state
    val fontScale = LocalDensity.current.fontScale
    BoxWithConstraints(modifier.padding(vertical = 4.dp)) {
        val words = remember(s.cipher) { s.cipher.split(" ") }
        val codeCount = remember(s.cipher) { cryptogramCodeLetters(s.cipher).size }
        val freqDigits = remember(s.cipher) { (cryptogramFrequencies(s.cipher).values.maxOrNull() ?: 1).toString().length }
        // The board caps at 480 dp wide, sits in its tray and pads 4 dp a side; wrap against that, not the raw band.
        val innerWidth = minOf(maxWidth, 480.dp) - 8.dp - (CIPHER_TRAY_H * 2).dp
        val trayHeight = CIPHER_TRAY_V * 2 + GameTrayStyle.LIP.value
        // The strip is pinned BELOW the band (founder, 2026-09-26: always visible over the
        // keyboard, never scrolled away), so the board alone has to fit this height.
        val fit = remember(s.cipher, maxWidth, maxHeight, fontScale) {
            cipherCellFit(words, codeCount, freqDigits, innerWidth.value, maxHeight.value - trayHeight, fontScale, withStrip = false)
        }
        Column(
            Modifier.fillMaxSize().then(if (fit.fits) Modifier else Modifier.verticalScroll(rememberScrollState())),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(CIPHER_BLOCK_GAP.dp, if (fit.fits) Alignment.CenterVertically else Alignment.Top),
        ) {
            CipherBoard(session, finished = false, cell = fit.cell.dp)
            // Fixed-height slot: the conflict line comes and goes without moving the board.
            Box(Modifier.height(CIPHER_CONFLICT_SLOT.dp), contentAlignment = Alignment.Center) {
                val conflicts = s.conflicts
                if (conflicts.isNotEmpty()) {
                    Text("${conflicts.joinToString(", ")} used for two code letters", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = CRYPTOGRAM_WRONG)
                }
            }
        }
    }
}

/** The given letters: a solid glossy tile in the game's amber-brown. */
private val CIPHER_GIVEN = solidChipLook(Color(0xFFB45309))

/** One cipher cell — FINISH_SPEC J3: a B1 glossy tile (the Classic geometry) with the
 *  penciled plain letter on it and the code letter as a small chip beneath (scaled
 *  with the cell by [cipherCodeSp]). The selected code letter wears an accent ring on
 *  every occurrence and its chip fills with the accent. */
@Composable
private fun CipherTile(plain: String, code: String, look: TileLook, selected: Boolean, size: Dp, interactive: Boolean, onClick: () -> Unit) {
    val codeSp = cipherCodeSp(size.value).sp
    val h = size * CIPHER_TILE_ASPECT
    val dark = WTheme.isDark
    Column(
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
        modifier = if (interactive) Modifier.squishClickable(onClick = onClick) else Modifier,
    ) {
        Box(
            Modifier.size(size + 6.dp, h + 6.dp)
                .then(if (selected) Modifier.border(2.dp, CRYPTOGRAM_ACCENT, RoundedCornerShape(size * TILE_CORNER + 4.dp)) else Modifier)
                .padding(3.dp),
        ) {
            Box(Modifier.fillMaxSize().typePop(plain).drawBehind { drawGameTile(look) }) {
                TileGlyph(plain, look.glyph, look.glyphShadow, size.value * 0.55f, h.value)
            }
        }
        Text(
            code, fontSize = codeSp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace, lineHeight = codeSp * 1.1f,
            color = if (selected) Color.White else if (dark) WTheme.textMuted else Color(0xFF7C2D12),
            modifier = Modifier.clip(RoundedCornerShape(50))
                .background(if (selected) CRYPTOGRAM_ACCENT else com.wordocious.app.ui.accentWash(CRYPTOGRAM_ACCENT, 0.16f))
                .padding(horizontal = 4.dp),
        )
    }
}

/** The saying as the player sees it: word chunks that never break across lines,
 *  punctuation as plain bold text. Given = accent filled, hinted = violet,
 *  locked by a Check = accent tint, conflict or just-cleared = red.
 *  [cell] is the side chosen by [cipherCellFit] while playing; the results
 *  screen passes none and keeps its compact width-driven cells. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CipherBoard(session: CodebreakerSession, finished: Boolean, cell: Dp? = null) =
    CipherBoard(session.state, if (finished) null else session.selected, finished, cell) { if (!finished) session.select(it) }

/** The saying from a state alone: the game above, and the finished cipher in the
 *  Completed-Today card (founder, 2026-09-29). [maxCell] caps the width-driven cells. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun CipherBoard(s: CryptogramState, selected: String?, finished: Boolean, cell: Dp? = null, maxCell: Dp = 30.dp, onSelect: (String) -> Unit) {
    val conflicts = s.conflicts.toSet()
    val words = s.cipher.split(" ")
    val longest = words.maxOfOrNull { w -> w.count { it in CRYPTOGRAM_ALPHABET } + (w.length - w.count { it in CRYPTOGRAM_ALPHABET }) / 2 }?.coerceAtLeast(1) ?: 1
    val density = LocalDensity.current
    val dark = WTheme.isDark
    // L the saying sits in the shared game tray (purple when cracked, slate when revealed).
    BoxWithConstraints(
        Modifier.fillMaxWidth().widthIn(max = 480.dp).gameTray(
            CRYPTOGRAM_ACCENT, finishTray(s.status != CryptogramStatus.PLAYING, s.status == CryptogramStatus.WON),
            padding = androidx.compose.foundation.layout.PaddingValues(horizontal = CIPHER_TRAY_H.dp, vertical = CIPHER_TRAY_V.dp),
        ),
    ) {
        val side = cell ?: ((maxWidth - 8.dp - 3.dp * (longest - 1)) / longest - 6.dp).coerceIn(minOf(18.dp, maxCell), maxCell)
        val punctSp = cipherPunctSp(side.value).sp
        // Punctuation sits just above the code-label row so it reads against the tile bottoms.
        val punctBottom = with(density) { (cipherCodeSp(side.value) * 1.1f).sp.toDp() } + 2.dp + side * 0.15f
        FlowRow(
            Modifier.fillMaxWidth().padding(horizontal = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(side * CIPHER_WORD_GAP_RATIO, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(cipherLineGap(side.value).dp),
        ) {
            words.forEach { w ->
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(0.dp)) {
                    w.forEach { ch ->
                        if (ch !in CRYPTOGRAM_ALPHABET) {
                            Text(ch.toString(), fontSize = punctSp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito, modifier = Modifier.padding(horizontal = 2.dp).padding(bottom = punctBottom))
                        } else {
                            val code = ch.toString()
                            val plain = s.mapping[code] ?: ""
                            val locked = code in s.locked
                            val hinted = code in s.hinted
                            val wrong = code in s.lastWrong
                            val conflict = plain.isNotEmpty() && plain in conflicts && !locked
                            val correct = finished && plain == cryptogramPlainFor(code, s.key)
                            // J3 the B1 tiles: given = the game's amber-brown, hinted = violet, locked by a
                            // Check (or right at the finish) = purple, a conflict / just-cleared = the red
                            // not-a-word tile, a penciled letter = typed, empty = frosted.
                            val look = when {
                                locked && hinted -> VIOLET_LOOK
                                locked && plain in s.given -> CIPHER_GIVEN
                                locked || correct -> TileLooks.CORRECT
                                conflict || wrong -> TileLooks.BAD
                                plain.isEmpty() -> TileLooks.of(TileFace.EMPTY, dark = dark)
                                else -> TileLooks.TYPED
                            }
                            CipherTile(plain, code, look, selected == code, side, interactive = !finished) { onSelect(code) }
                        }
                    }
                }
            }
        }
    }
}

/** Code letters by how often they occur, with the penciled letter shown; tap to select.
 *  [chipSp] scales with the cell ([cipherChipSp]): 11 sp at the floor, 14 sp at the top end. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FrequencyStrip(session: CodebreakerSession, chipSp: TextUnit = 11.sp) {
    val s = session.state
    val freq = cryptogramFrequencies(s.cipher)
    val codes = freq.keys.sortedWith(compareByDescending<String> { freq[it]!! }.thenBy { it })
    FlowRow(
        Modifier.fillMaxWidth().padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(CIPHER_CHIP_GAP.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(CIPHER_CHIP_GAP.dp),
    ) {
        codes.forEach { c ->
            val plain = s.mapping[c]
            val locked = c in s.locked
            val isSel = session.selected == c
            // A1 + A9 a soft tinted chip that squishes.
            Row(
                Modifier.squishClickable { session.select(c) }
                    .softChip(CRYPTOGRAM_ACCENT, selected = isSel)
                    .padding(horizontal = 8.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(c, fontSize = chipSp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = if (locked) CRYPTOGRAM_ACCENT else WTheme.textMuted)
                Text("${freq[c]}", fontSize = chipSp, fontWeight = FontWeight.Bold, color = (if (locked) CRYPTOGRAM_ACCENT else WTheme.textMuted).copy(alpha = 0.7f))
                if (!plain.isNullOrEmpty()) Text("→$plain", fontSize = chipSp, fontWeight = FontWeight.Black, color = if (locked) CRYPTOGRAM_ACCENT else WTheme.text)
            }
        }
    }
}

/** A8 a game control: a small candy button with its icon; [dim] = not yet (taps ignored, as before). */
@Composable
private fun Capsule(label: String, icon: ImageVector, dim: Boolean = false, color: com.wordocious.app.ui.CandyColor = com.wordocious.app.ui.CandyColor.PEACH, reserve: String? = null, count: Int = 0, onClick: () -> Unit) =
    PadAction(label, icon, onClick = onClick, color = color, dim = dim, reserveLabel = reserve, count = count)

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun CodebreakerFinished(
    session: CodebreakerSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == CryptogramStatus.WON
    val secs = session.elapsed
    val gc = s.guessCount
    val context = LocalContext.current
    val title = if (won) (if (s.checks == 0) "Code cracked clean" else "Code cracked") else "Answer revealed"
    val share = {
        val num = if (session.isDaily) session.dailyNumber else null
        val meta = "${num?.let { "#$it · " } ?: ""}${session.checksLabel} · ${timeText(secs)}"
        val text = "Wordocious Codebreaker${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${timeText(secs)} · ${session.checksLabel} · wordocious.com/codebreaker"
        val bmp = ShareImage.renderCryptogram(context, s.cipher, s.checks, won, meta)
        ShareImage.shareBitmap(context, bmp, text)
    }
    FinishedScreen(
        header = { CodebreakerHeader(session) },
        strip = {
            ResultStrip(
                won,
                listOf(stripCount("${s.checks}", if (s.checks == 1) "check" else "checks"), stripTime(secs), stripPoints(session.points)),
                srText = "$title. ${listOfNotNull(hintsNote(s.hintsUsed)).joinToString()} ${s.checks} check${if (s.checks == 1) "" else "s"}, time ${timeText(secs)}, ${session.points} points",
            )
        },
        dock = {
            FinishedDock(
                GameMode.CRYPTOGRAM, isDaily = session.isDaily, accent = CRYPTOGRAM_ACCENT, onShare = share,
                onOpenDaily = onOpenDaily, onOpenLeaderboard = onOpenLeaderboard, onOpenUnlimited = onOpenUnlimited,
                onNewPuzzle = if (!session.isDaily && isPro && onPlayAgain != null) onPlayAgain else null,
                onOtherGames = onBack,
                more = {
                    hintsNote(s.hintsUsed)?.let { Text("$title · $it", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted) }
                    if (session.isDaily) DailyRankBadge(GameMode.CRYPTOGRAM)
                    ScoreBreakdownCard(GameMode.CRYPTOGRAM, won, gc, secs, if (won) 1 else 0, 1, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
                },
            )
        },
    ) { maxW, maxH ->
        // R2: the cracked saying sized by [cipherCellFit] to the height left (minus the
        // plain-text quote under it); a long saying keeps scrolling in place + "See all".
        val fontScale = LocalDensity.current.fontScale
        val words = remember(s.cipher) { s.cipher.split(" ") }
        val codeCount = remember(s.cipher) { cryptogramCodeLetters(s.cipher).size }
        val freqDigits = remember(s.cipher) { (cryptogramFrequencies(s.cipher).values.maxOrNull() ?: 1).toString().length }
        val innerWidth = minOf(maxW, 480.dp) - 8.dp - (CIPHER_TRAY_H * 2).dp
        val quoteReserve = 74f
        val fit = remember(s.cipher, maxW, maxH, fontScale) {
            cipherCellFit(
                words, codeCount, freqDigits, innerWidth.value,
                maxH.value - quoteReserve - (CIPHER_TRAY_V * 2 + GameTrayStyle.LIP.value), fontScale, withStrip = false,
            )
        }
        val quote = @Composable {
            Text(
                "“${s.text}”", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 420.dp).padding(horizontal = 8.dp),
            )
        }
        FinishedListSlot(
            maxHeight = maxH, accent = CRYPTOGRAM_ACCENT, seeAllTitle = "The whole saying",
            full = { CipherBoard(s, null, true) {}; quote() },
        ) {
            CipherBoard(s, null, true, cell = fit.cell.dp, maxCell = fit.cell.dp) {}
            quote()
        }
    }
}

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"
/** Always m:ss — the header clock and the Reveal countdown. */
private fun clockText(s: Int) = "${s / 60}:${"%02d".format(s % 60)}"

@Composable
private fun CodebreakerOverlay(session: CodebreakerSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == CryptogramStatus.WON
    val secs = session.elapsed
    PieceOverlay(won, "CRYPTOGRAM", CRYPTOGRAM_ACCENT, onScrimTap = onDismiss) {
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
