package com.wordocious.app.ui.game

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
private val CRYPTOGRAM_HINT = Color(0xFF8B5CF6)
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
    private var guidePauseStart: Long? = null
    private var recorded = false

    val isFinished get() = state.status != CryptogramStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, ((System.currentTimeMillis() - startMs) / 1000).toInt())
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

    fun beginTimer() { startMs = System.currentTimeMillis() - restoredElapsedMs }
    fun pauseForGuide() { if (guidePauseStart == null && !isFinished) guidePauseStart = System.currentTimeMillis() }
    fun resumeFromGuide() { guidePauseStart?.let { startMs += System.currentTimeMillis() - it; guidePauseStart = null } }

    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
        val id: String, val text: String, val key: String, val given: List<String>,
        val mapping: Map<String, String>, val locked: List<String>, val hinted: List<String>,
        val hintsUsed: Int, val checks: Int, val events: List<String>,
        val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
    )
    private val storageKey get() = if (isDaily) "cryptogram-save-daily" else "cryptogram-save-$seed"

    private fun persist() {
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
    fun check(onFinished: () -> Unit) {
        if (isFinished) return
        if (state.mapping.keys.none { it !in state.locked }) { flash("Pencil some letters first"); return }
        dispatch(CryptogramAction.Check, onFinished)
        val wrong = state.lastWrong.size
        if (wrong > 0) { flash("$wrong wrong letter${if (wrong == 1) "" else "s"} cleared"); SoundManager.playInvalid() }
        else { flash("Everything penciled is right"); SoundManager.playSuccess() }
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

    // One clock for the header and the Reveal countdown.
    val tick by produceState(0, session.isFinished) {
        while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ }
    }

    Box(Modifier.fillMaxSize().background(WTheme.bg).statusBarsPadding()) {
        if (session.isFinished) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CodebreakerHeader(session, tick)
                CipherBoard(session, finished = true)
                Text(
                    "“${session.state.text}”", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
                    textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 420.dp).padding(horizontal = 8.dp),
                )
                CodebreakerResult(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
            }
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                CodebreakerHeader(session, tick)
                // The board + frequency strip block is centered in the band between the
                // header and the capsule row; capsules and keyboard stay pinned below.
                CipherBand(session, Modifier.weight(1f).fillMaxWidth())
                @Suppress("UNUSED_EXPRESSION") tick
                val revealIn = maxOf(0, CRYPTOGRAM_REVEAL_AFTER_SECONDS - session.elapsed)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Capsule("Delete", Icons.AutoMirrored.Filled.Backspace) { session.delete() }
                    Capsule(if (session.state.checks > 0) "Check · ${session.state.checks}" else "Check", Icons.Filled.DoneAll) { session.check(onFinished) }
                    Capsule(if (session.state.hintsUsed > 0) "Hint · ${session.state.hintsUsed}" else "Hint", Icons.Filled.Lightbulb) { session.hint(onFinished) }
                    Capsule(if (revealIn > 0) "Reveal · ${clockText(revealIn)}" else "Reveal", Icons.Filled.Visibility, dim = revealIn > 0) { session.reveal(onFinished) }
                }
                KeyboardView(onKey = { session.type(it, onFinished) }, onDelete = { session.delete() }, onEnter = { session.advance() })
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
        if (showOverlay) CodebreakerOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(CRYPTOGRAM_ACCENT, onBack) }
        CornerHelpButton(CRYPTOGRAM_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
        if (showGuide) GuideSheet(mode = GameMode.CRYPTOGRAM, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@Composable
private fun CodebreakerHeader(session: CodebreakerSession, tick: Int) {
    val s = session.state
    val codes = cryptogramCodeLetters(s.cipher)
    val resolved = codes.count { it in s.locked || !s.mapping[it].isNullOrEmpty() }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        Text("CODEBREAKER", fontSize = 24.sp, fontWeight = FontWeight.Black, color = CRYPTOGRAM_ACCENT, fontFamily = Nunito)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
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
private const val CIPHER_CELL_MIN = 40f
private const val CIPHER_CELL_STEP = 4f
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

/** Code letter under a cell: 10 sp at the floor, 14 sp at the 64 dp top end. */
internal fun cipherCodeSp(cell: Float): Float =
    (10f + (cell - CIPHER_CELL_MIN) / (CIPHER_CELL_MAX - CIPHER_CELL_MIN) * 4f).coerceIn(10f, 14f)

/** Frequency chip text: 11 sp at the floor, 14 sp at the 64 dp top end. */
internal fun cipherChipSp(cell: Float): Float =
    (11f + (cell - CIPHER_CELL_MIN) / (CIPHER_CELL_MAX - CIPHER_CELL_MIN) * 3f).coerceIn(11f, 14f)

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
internal fun cipherBlockHeight(lines: Int, codeCount: Int, freqDigits: Int, cell: Float, width: Float, fontScale: Float): Float {
    val board = lines * cipherLineHeight(cell, fontScale) + (lines - 1).coerceAtLeast(0) * cipherLineGap(cell)
    return board + CIPHER_BLOCK_GAP + CIPHER_CONFLICT_SLOT + CIPHER_BLOCK_GAP + cipherStripHeight(codeCount, freqDigits, cell, width, fontScale)
}

internal data class CipherFit(val cell: Float, val lines: Int, val fits: Boolean)

/** Cell side for a band of [width] × [height] dp: 64 → 40 in 4 dp steps until the wrapped cipher plus the
 *  strip fit the height and the widest word fits the width. Below 40 only a too-wide word may push further
 *  (to 20). [fits] false = even the floor overflows the height; the caller then scrolls instead of centering. */
internal fun cipherCellFit(words: List<String>, codeCount: Int, freqDigits: Int, width: Float, height: Float, fontScale: Float): CipherFit {
    var cell = CIPHER_CELL_MAX
    while (true) {
        val lines = cipherLineCount(words, cell, width)
        val wide = (words.maxOfOrNull { cipherWordWidth(it, cell) } ?: 0f) > width
        val tall = cipherBlockHeight(lines, codeCount, freqDigits, cell, width, fontScale) > height
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
        // The board caps at 480 dp wide and pads 4 dp a side; wrap against that, not the raw band.
        val innerWidth = minOf(maxWidth, 480.dp) - 8.dp
        val fit = remember(s.cipher, maxWidth, maxHeight, fontScale) {
            cipherCellFit(words, codeCount, freqDigits, innerWidth.value, maxHeight.value, fontScale)
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
            FrequencyStrip(session, chipSp = cipherChipSp(fit.cell).sp)
        }
    }
}

/** One cipher cell — the Classic tile geometry with the penciled plain letter
 *  inside and the code letter in small monospace beneath (scaled with the cell
 *  by [cipherCodeSp]). The selected code letter wears an accent ring on every
 *  occurrence. */
@Composable
private fun CipherTile(plain: String, code: String, fill: Color, border: Color, ink: Color, selected: Boolean, size: Dp, onClick: () -> Unit) {
    val density = LocalDensity.current
    val fs = with(density) { (size * 0.55f).toSp() }
    val codeSp = cipherCodeSp(size.value).sp
    val h = size * CIPHER_TILE_ASPECT
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.clickableNoRipple(onClick)) {
        Box(
            Modifier.size(size + 6.dp, h + 6.dp)
                .then(if (selected) Modifier.border(2.dp, CRYPTOGRAM_ACCENT, RoundedCornerShape(size * 0.14f + 4.dp)) else Modifier)
                .padding(3.dp),
        ) {
            Box(
                Modifier.fillMaxSize().clip(RoundedCornerShape(size * 0.14f)).background(fill).border(2.dp, border, RoundedCornerShape(size * 0.14f)),
                contentAlignment = Alignment.Center,
            ) { Text(plain, fontSize = fs, fontWeight = FontWeight.Black, color = ink, fontFamily = Nunito) }
        }
        Text(code, fontSize = codeSp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace, color = if (selected) CRYPTOGRAM_ACCENT else WTheme.textMuted, lineHeight = codeSp * 1.1f)
    }
}

/** The saying as the player sees it: word chunks that never break across lines,
 *  punctuation as plain bold text. Given = accent filled, hinted = violet,
 *  locked by a Check = accent tint, conflict or just-cleared = red.
 *  [cell] is the side chosen by [cipherCellFit] while playing; the results
 *  screen passes none and keeps its compact width-driven cells. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CipherBoard(session: CodebreakerSession, finished: Boolean, cell: Dp? = null) {
    val s = session.state
    val conflicts = s.conflicts.toSet()
    val words = s.cipher.split(" ")
    val longest = words.maxOfOrNull { w -> w.count { it in CRYPTOGRAM_ALPHABET } + (w.length - w.count { it in CRYPTOGRAM_ALPHABET }) / 2 }?.coerceAtLeast(1) ?: 1
    val selected = if (finished) null else session.selected
    val density = LocalDensity.current
    BoxWithConstraints(Modifier.fillMaxWidth().widthIn(max = 480.dp)) {
        val side = cell ?: ((maxWidth - 8.dp - 3.dp * (longest - 1)) / longest - 6.dp).coerceIn(18.dp, 30.dp)
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
                            var fill = WTheme.surface; var border = WTheme.border; var ink = WTheme.text
                            when {
                                locked && hinted -> { fill = CRYPTOGRAM_HINT; border = CRYPTOGRAM_HINT; ink = Color.White }
                                locked && plain in s.given -> { fill = CRYPTOGRAM_ACCENT; border = CRYPTOGRAM_ACCENT; ink = Color.White }
                                locked -> { fill = CRYPTOGRAM_ACCENT.copy(alpha = 0.13f); border = CRYPTOGRAM_ACCENT; ink = CRYPTOGRAM_ACCENT }
                                conflict || wrong -> { border = CRYPTOGRAM_WRONG; ink = CRYPTOGRAM_WRONG }
                                correct -> ink = CRYPTOGRAM_ACCENT
                            }
                            CipherTile(plain, code, fill, border, ink, selected == code, side) { if (!finished) session.select(code) }
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
            Row(
                Modifier.clip(CircleShape)
                    .background(if (isSel) CRYPTOGRAM_ACCENT.copy(alpha = 0.07f) else WTheme.surface)
                    .border(1.dp, if (isSel) CRYPTOGRAM_ACCENT else WTheme.border, CircleShape)
                    .clickableNoRipple { session.select(c) }
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

@Composable
private fun Capsule(label: String, icon: ImageVector, dim: Boolean = false, onClick: () -> Unit) {
    val fg = if (dim) WTheme.textMuted.copy(alpha = 0.5f) else CRYPTOGRAM_ACCENT
    Row(
        Modifier.clip(CircleShape)
            .background(if (dim) Color.Transparent else CRYPTOGRAM_ACCENT.copy(alpha = 0.05f))
            .border(1.5.dp, if (dim) WTheme.border else CRYPTOGRAM_ACCENT.copy(alpha = 0.4f), CircleShape)
            .clickableNoRipple { if (!dim) onClick() }
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = fg, modifier = Modifier.size(13.dp))
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = fg)
    }
}

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun CodebreakerResult(
    session: CodebreakerSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == CryptogramStatus.WON
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
                Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(CRYPTOGRAM_ACCENT.copy(alpha = 0.08f))
                    .border(2.dp, CRYPTOGRAM_ACCENT.copy(alpha = 0.27f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(if (won) (if (s.checks == 0) "✓" else "${s.checks}") else "✗", fontSize = 20.sp, fontWeight = FontWeight.Black, color = CRYPTOGRAM_ACCENT, fontFamily = Nunito)
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    if (won) (if (s.checks == 0) "Code cracked clean" else "Code cracked") else "Answer revealed",
                    fontSize = 15.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF16A34A) else Color(0xFFEF4444), fontFamily = Nunito,
                )
                Text("${session.checksLabel} · ${timeText(secs)}$hintsText", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            ResultAction(Icons.Filled.Home, "Home", CRYPTOGRAM_ACCENT, onBack)
            ResultAction(Icons.Filled.Share, "Share", CRYPTOGRAM_ACCENT) {
                val num = if (session.isDaily) session.dailyNumber else null
                val meta = "${num?.let { "#$it · " } ?: ""}${session.checksLabel} · ${timeText(secs)}"
                val text = "Wordocious Codebreaker${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${timeText(secs)} · ${session.checksLabel} · wordocious.com/codebreaker"
                val bmp = ShareImage.renderCryptogram(context, s.cipher, s.checks, won, meta)
                ShareImage.shareBitmap(context, bmp, text)
            }
            if (!session.isDaily && isPro && onPlayAgain != null) ResultAction(Icons.Filled.Refresh, "Play Again", Color(0xFFD97706)) { onPlayAgain() }
        }
        if (session.isDaily) DailyRankBadge(GameMode.CRYPTOGRAM)
        ScoreBreakdownCard(GameMode.CRYPTOGRAM, won, gc, secs, if (won) 1 else 0, 1, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.CRYPTOGRAM, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
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
/** Always m:ss — the header clock and the Reveal countdown. */
private fun clockText(s: Int) = "${s / 60}:${"%02d".format(s % 60)}"

@Composable
private fun CodebreakerOverlay(session: CodebreakerSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == CryptogramStatus.WON
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
