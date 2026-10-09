package com.wordocious.app.ui.game

import com.wordocious.app.ui.gameBackground
import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
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
import androidx.compose.ui.text.font.FontWeight
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
import com.wordocious.app.ui.formatGuessStat
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameDictionary
import com.wordocious.core.GameMode
import com.wordocious.core.LADDER_DAILY_EPOCH
import com.wordocious.core.LADDER_WORD_LENGTH
import com.wordocious.core.LadderAction
import com.wordocious.core.LadderBank
import com.wordocious.core.LadderPuzzle
import com.wordocious.core.LadderReject
import com.wordocious.core.LadderState
import com.wordocious.core.LadderStatus
import com.wordocious.core.ladderDailyNumber
import com.wordocious.core.ladderMatchRow
import com.wordocious.core.ladderPuzzleForDay
import com.wordocious.core.ladderPuzzleForSeed
import com.wordocious.core.ladderReduce
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Letter Ladder (More Games §15) — the Android twin of components/ladder/* and
// LadderView.swift. Change one letter at a time from START to END. Rejected
// entries are free; every accepted word is a move; the budget is par + 5; Undo
// is free but spent moves stay spent; Hint places the next rung on a shortest
// path and counts as a move. guess_count = moves − par + 1.

private val LADDER_ACCENT = Color(0xFF0284C7)

// ── Session ─────────────────────────────────────────────────────────────────

class LadderSession(val seed: String, val isDaily: Boolean) {
    private val allowed: Set<String> = LadderBank.words ?: GameDictionary.getAllowedWords().filter { it.length == 5 }.map { it.uppercase() }.toHashSet()

    var state by mutableStateOf(
        LadderState.create(
            run {
                val bank = LadderBank.bundled ?: LadderBank(1, LADDER_DAILY_EPOCH, emptyList(), emptyList())
                val fallback = LadderPuzzle("none", "STONE", "STARE", 2, listOf("STONE", "STORE", "STARE"))
                (if (isDaily) ladderPuzzleForDay(bank, todayLocalDate()) else ladderPuzzleForSeed(bank, seed)) ?: fallback
            },
            seed, System.currentTimeMillis(),
        ),
    )
        private set
    var typing by mutableStateOf("")
    var invalid by mutableStateOf(false)
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

    val isFinished get() = state.status != LadderStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, (((pauseStart ?: System.currentTimeMillis()) - startMs) / 1000).toInt())
    val dailyNumber get() = ladderDailyNumber(todayLocalDate())
    val movesLeft get() = maxOf(0, state.maxMoves - state.moves)
    val points: Int get() = com.wordocious.app.data.DailyScoring.breakdown(
        GameMode.LADDER.name, state.status == LadderStatus.WON, state.guessCount, elapsed,
        if (state.status == LadderStatus.WON) 1 else 0, 1, state.hintsUsed,
    ).total.toInt()

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

    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
        val id: String, val start: String, val end: String, val par: Int, val path: List<String>,
        val words: List<String>, val hintMask: String, val moves: Int, val hintsUsed: Int, val events: List<String>,
        val status: String, val startTime: Long, val endTime: Long?,
    )
    private val storageKey get() = if (isDaily) "ladder-save-daily" else "ladder-save-$seed"

    private fun persist() {
        if (!isDaily && isFinished) { SettingsPref.remove(storageKey); return }
        val s = state
        val dto = SaveDto(
            seed, todayLocalDate(), elapsed, System.currentTimeMillis(),
            s.id, s.start, s.end, s.par, s.path, s.words, s.hintMask, s.moves, s.hintsUsed, s.events, s.status.key, s.startTime, s.endTime,
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
        val status = LadderStatus.values().firstOrNull { it.key == dto.status } ?: LadderStatus.PLAYING
        state = LadderState(
            seed, dto.id, dto.start, dto.end, dto.par, dto.path, dto.words, dto.hintMask, dto.moves, dto.hintsUsed, dto.events,
            status, null, dto.startTime, dto.endTime,
        )
        restoredElapsedMs = dto.elapsed * 1000L
        if (status != LadderStatus.PLAYING) { finalTimeSeconds = dto.elapsed; recorded = true; restoredFinished = true }
    }

    private fun dispatch(a: LadderAction, onFinished: () -> Unit) {
        if (isFinished) return
        state = ladderReduce(state, a, allowed, System.currentTimeMillis())
        if (isFinished) onFinished()
        persist()
    }

    fun type(ch: Char) { if (!isFinished && typing.length < LADDER_WORD_LENGTH) typing += ch.uppercaseChar() }
    fun delete() { if (typing.isNotEmpty()) typing = typing.dropLast(1) }
    fun submit(onFinished: () -> Unit) {
        if (isFinished) return
        if (typing.length != LADDER_WORD_LENGTH) { flash("Five letters, please"); return }
        val before = state.words.size
        dispatch(LadderAction.Submit(typing), onFinished)
        val r = state.reject
        if (r != null) {
            flash(rejectCopy(r)); SoundManager.playInvalid(); invalid = true
            val rejected = typing
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ if (typing == rejected) typing = "" }, 500)
        }
        else if (state.words.size > before) { typing = ""; SoundManager.playKeyTap() }
    }
    fun undo(onFinished: () -> Unit) { dispatch(LadderAction.Undo, onFinished); typing = "" }
    fun hint(onFinished: () -> Unit) { val before = state.words.size; dispatch(LadderAction.Hint, onFinished); if (state.words.size > before) typing = "" }

    private fun rejectCopy(r: LadderReject) = when (r) {
        LadderReject.FINISHED -> "This ladder is finished"
        LadderReject.LENGTH -> "Five letters, please"
        LadderReject.NOT_ONE_LETTER -> "Change exactly one letter"
        LadderReject.REVISIT -> "Already on the ladder"
        LadderReject.NOT_WORD -> "Not in word list"
    }

    suspend fun finish() {
        finalTimeSeconds = elapsed
        if (state.status == LadderStatus.WON) SoundManager.playSuccess() else SoundManager.playGameOver()
        if (recorded) return
        recorded = true
        val won = state.status == LadderStatus.WON
        val gc = state.guessCount
        val (solutions, guesses) = ladderMatchRow(state)
        val xp = GameResultsService.record(
            gameMode = GameMode.LADDER, won = won, guessCount = gc, timeSeconds = elapsed,
            boardsSolved = if (won) 1 else 0, totalBoards = 1, seed = seed,
            solutions = solutions, guesses = guesses, hintsUsed = state.hintsUsed,
        )
        xpResult = xp
        if (isDaily) DailyCompletionsService.notePuzzleFinish(seed, GameMode.LADDER.name, won, gc, elapsed)
    }

    private fun flash(m: String) { toast = m }
}

// ── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun LadderScreen(
    seed: String,
    isDaily: Boolean,
    onBack: () -> Unit,
    onPlayAgain: (() -> Unit)? = null,
    onOpenDaily: (GameMode) -> Unit = {},
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val session = remember(seed) { LadderSession(seed, isDaily) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val isPro = AuthService.isProActive
    var showOverlay by remember(seed) { mutableStateOf(false) }
    var showGuide by remember { mutableStateOf(false) }
    // First play (item 12): the help card opens by itself once, then only on tap.
    val firstPlay = rememberFirstPlayAutoShow(com.wordocious.app.data.GuideService.slugFor(GameMode.LADDER))
    LaunchedEffect(firstPlay) { if (firstPlay) { showGuide = true; session.pauseForGuide() } }
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
    LaunchedEffect(session.invalid) { if (session.invalid) { kotlinx.coroutines.delay(500); session.invalid = false } }

    val onFinished: () -> Unit = {
        scope.launch {
            session.finish()
            if (!session.restoredFinished) showOverlay = true
            if (session.state.status == LadderStatus.WON) {
                RatingsPrompt.recordWin(context)
                (context as? Activity)?.let { RatingsPrompt.maybeAsk(it) }
            }
        }
    }

    androidx.activity.compose.BackHandler { onBack() }

    // Physical keyboard (founder, 2026-09-30; web ladder-game.tsx): A–Z / Enter / Backspace as the
    // keys below, Ctrl/Cmd+Z = Undo.
    val ladderKeys = keyboardViewKeys(onKey = { session.type(it) }, onDelete = { session.delete() }, onEnter = { session.submit(onFinished) })
    ProvideFeedbackAnchor {
    Box(
        Modifier.fillMaxSize()
            .hardwareKeys(enabled = !session.isFinished && !showOverlay && !showGuide) { k ->
                if (k == HwKey.Undo) { if (session.state.words.size > 1) session.undo(onFinished); true } else ladderKeys(k)
            }
            .gameBackground { background(WTheme.bg) }.statusBarsPadding(),
    ) {
        if (session.isFinished) {
            // FINISH_SPEC R2: the one-screen finished screen (header · strip · board · dock).
            LadderFinished(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                LadderHeader(session)
                // Doug (Android, 10-05): the board scrolled as one block, so a few rungs pushed
                // the REACH row under the controls. Now the tiles size to the height between the
                // header and Undo/Hint, and a ladder too long even at the smallest tile scrolls
                // only its climbed rungs — the typing row and the target stay pinned in view.
                androidx.compose.foundation.layout.BoxWithConstraints(
                    Modifier.weight(1f).fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.TopCenter,
                ) { LadderPlayBoard(session, maxHeight) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Capsule("Undo", Icons.AutoMirrored.Filled.Undo, dim = session.state.words.size <= 1) { session.undo(onFinished) }
                    Capsule("Hint", Icons.Filled.Lightbulb, color = com.wordocious.app.ui.CandyColor.AMBER, count = session.state.hintsUsed) { session.hint(onFinished) }
                }
                KeyboardView(onKey = { session.type(it) }, onDelete = { session.delete() }, onEnter = { session.submit(onFinished) })
                Spacer(Modifier.height(6.dp))
            }
        }
        // G5 a toast is a tinted pill (no dark slab, no white).
        // The candy feedback toast, centered on the header meta row (never the title art or the board).
        GameFeedbackToast(session.toast, fallbackTop = 100.dp)
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) LadderOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(LADDER_ACCENT, onBack) }
        CornerHelpButton(LADDER_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET))
        if (showGuide) GuideSheet(mode = GameMode.LADDER, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
    }
}

@Composable
private fun LadderHeader(session: LadderSession) {
    val tick by produceState(0, session.isFinished) {
        while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ }
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        // The game's title art: lettering + host (ART_SPEC §10).
        com.wordocious.app.ui.HostedGameTitle("LADDER") { Text("LETTER LADDER", fontSize = 24.sp, fontWeight = FontWeight.Black, color = LADDER_ACCENT, fontFamily = Nunito) }
        Row(Modifier.feedbackAnchor(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text("Par ${session.state.par}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text("${session.state.moves} move${if (session.state.moves == 1) "" else "s"} · ${session.movesLeft} left", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
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

// ── Board ───────────────────────────────────────────────────────────────────

/** A changed letter on a rung: the ladder's sky-blue glossy tile. */
private val LADDER_RUNG = solidChipLook(LADDER_ACCENT)
/** The target rung: frosted, the letters in the accent. */
private val LADDER_END = TileLooks.EMPTY.copy(ring = Color(0x8C0284C7), glyph = Color(0xFF0369A1))
private val LADDER_END_DARK = TileLooks.EMPTY_DARK.copy(ring = Color(0x8C38BDF8), glyph = Color(0xFF7DD3FC))

/** One tile of the ladder — FINISH_SPEC J3: a B1 glossy tile (the game kit's recipe)
 *  in the ladder's looks: START purple, a changed letter in the accent (violet for a
 *  hint rung), plain letters the light "given" tile, the typing row the typed / empty /
 *  not-a-word tiles, END a frosted target in the accent, the revealed route muted. A
 *  typed letter pops in (B3). */
@Composable
private fun LadderTile(letter: String, look: TileLook, size: androidx.compose.ui.unit.Dp = 44.dp) {
    Box(
        Modifier.size(size).typePop(letter).drawBehind { drawGameTile(look) },
        contentAlignment = Alignment.Center,
    ) { TileGlyph(letter, look.glyph, look.glyphShadow, size.value * 0.5f, size.value) }
}

@Composable
private fun LadderRow(word: String, prev: String?, kind: String, invalid: Boolean = false, tile: androidx.compose.ui.unit.Dp = 44.dp) {
    val chars = word.padEnd(5, ' ')
    val dark = WTheme.isDark
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        for (i in 0 until 5) {
            val ch = if (chars[i] == ' ') "" else chars[i].toString()
            val changed = prev != null && prev[i] != chars[i]
            val look = when (kind) {
                "start" -> TileLooks.CORRECT
                "rung", "hint" -> if (changed) (if (kind == "hint") VIOLET_LOOK else LADDER_RUNG) else TileLooks.GIVEN
                "typing" -> when {
                    invalid -> TileLooks.BAD
                    ch.isEmpty() -> TileLooks.of(TileFace.EMPTY, dark = dark)
                    else -> TileLooks.TYPED
                }
                "end" -> if (dark) LADDER_END_DARK else LADDER_END
                else -> TileLooks.HINT
            }
            LadderTile(ch, look, tile)
        }
    }
}

@Composable
fun LadderBoard(session: LadderSession, revealPath: Boolean) = LadderBoard(session.state, session.typing, session.invalid, revealPath)

/** The rungs from a state alone — the game above, and the finished ladder in the
 *  Completed-Today card at a smaller [tile] (founder, 2026-09-29). */
@Composable
fun LadderBoard(s: LadderState, typing: String, invalid: Boolean, revealPath: Boolean, tile: androidx.compose.ui.unit.Dp = 44.dp) {
    val gap = if (tile < 44.dp) 4.dp else 6.dp
    // L the rungs sit in the shared game tray (purple when climbed, slate when out of moves).
    Column(
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(gap),
        modifier = Modifier.widthIn(max = 420.dp).gameTray(
            LADDER_ACCENT, finishTray(s.status != LadderStatus.PLAYING, s.status == LadderStatus.WON),
            corner = if (tile < 44.dp) 14.dp else GameTrayStyle.CORNER,
            padding = androidx.compose.foundation.layout.PaddingValues(if (tile < 44.dp) 8.dp else 12.dp),
        ),
    ) {
        s.words.forEachIndexed { i, w -> LadderRow(w, if (i > 0) s.words[i - 1] else null, if (i == 0) "start" else if (s.hintMask.getOrNull(i) == '1') "hint" else "rung", tile = tile) }
        if (s.status == LadderStatus.PLAYING) LadderRow(typing, s.current, "typing", invalid, tile)
        if (s.current != s.end) {
            Text("↓ ${if (s.status == LadderStatus.PLAYING) "REACH" else "TARGET"}", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = if (WTheme.isDark) Color(0xFF7DD3FC) else Color(0xFF0369A1))
            LadderRow(s.end, null, "end", tile = tile)
        }
        if (revealPath) {
            Text("ONE SHORTEST ROUTE", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted, modifier = Modifier.padding(top = 8.dp))
            s.path.forEachIndexed { i, w -> LadderRow(w, if (i > 0) s.path[i - 1] else null, "reveal", tile = tile) }
        }
    }
}

/** The live ladder: every rung, the typing row and the target fit [maxH] (tiles from
 *  [LadderFit.tile]); when even the smallest tile is too tall, only the climbed rungs
 *  scroll (kept at the newest) and the typing row + REACH + target stay pinned. */
@Composable
private fun LadderPlayBoard(session: LadderSession, maxH: androidx.compose.ui.unit.Dp) {
    val s = session.state
    val showEnd = s.current != s.end
    val fontScale = LocalDensity.current.fontScale
    val fit = LadderFit.tile(maxH.value, rungs = s.words.size, showEnd = showEnd, labelLine = 15f * fontScale)
    val tile = fit.tile.dp
    val gap = fit.gap.dp
    val scroll = rememberScrollState()
    LaunchedEffect(s.words.size, scroll.maxValue) { scroll.animateScrollTo(scroll.maxValue) }
    Column(
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(gap),
        modifier = Modifier.widthIn(max = 420.dp).gameTray(
            LADDER_ACCENT, finishTray(false, false),
            padding = androidx.compose.foundation.layout.PaddingValues(LadderFit.PAD.dp),
        ),
    ) {
        Column(
            Modifier.weight(1f, fill = false).verticalScroll(scroll),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(gap),
        ) {
            s.words.forEachIndexed { i, w -> LadderRow(w, if (i > 0) s.words[i - 1] else null, if (i == 0) "start" else if (s.hintMask.getOrNull(i) == '1') "hint" else "rung", tile = tile) }
        }
        LadderRow(session.typing, s.current, "typing", session.invalid, tile)
        if (showEnd) {
            Text("↓ REACH", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = if (WTheme.isDark) Color(0xFF7DD3FC) else Color(0xFF0369A1))
            LadderRow(s.end, null, "end", tile = tile)
        }
    }
}

/** The live ladder's tile size for the height it has (pure; LadderFitTest). */
object LadderFit {
    const val PAD = 12f
    const val MAX_TILE = 44f
    const val MIN_TILE = 26f
    data class Fit(val tile: Float, val gap: Float, val scrolls: Boolean)

    /** [rungs] climbed words (START included) + the typing row (+ the REACH label of
     *  [labelLine] dp and the target when [showEnd]) inside a tray of [PAD] padding and
     *  the lip, in [availH] dp. */
    fun tile(availH: Float, rungs: Int, showEnd: Boolean, labelLine: Float): Fit {
        val rows = rungs + 1 + (if (showEnd) 1 else 0)
        for (gap in floatArrayOf(6f, 4f)) {
            val fixed = PAD * 2 + GameTrayStyle.LIP.value + (if (showEnd) labelLine + gap else 0f)
            val t = FinishedSizing.rowTile(availH, rows, gap, fixed, MAX_TILE, if (gap == 6f) 36f else MIN_TILE)
            if (t != null) return Fit(kotlin.math.floor(t), gap, scrolls = false)
        }
        return Fit(MIN_TILE, 4f, scrolls = true)
    }
}

/** A8 a game control: a small candy button with its icon; [dim] = nothing to undo (taps ignored, as before). */
@Composable
private fun Capsule(label: String, icon: ImageVector, dim: Boolean = false, color: com.wordocious.app.ui.CandyColor = com.wordocious.app.ui.CandyColor.PEACH, reserve: String? = null, count: Int = 0, onClick: () -> Unit) =
    PadAction(label, icon, onClick = onClick, color = color, dim = dim, reserveLabel = reserve, count = count)

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun LadderFinished(
    session: LadderSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == LadderStatus.WON
    val secs = session.elapsed
    val gc = s.guessCount
    val parLabel = formatGuessStat("overPar", 1, gc)
    val context = LocalContext.current
    val revealPath = s.status == LadderStatus.LOST
    val title = if (won) (if (gc == 1) "Ladder climbed on par" else "Ladder climbed") else "Out of moves"
    val note = listOfNotNull("Par ${s.par}", if (won) parLabel else null, hintsNote(s.hintsUsed)).joinToString(" · ")
    val share = {
        val num = if (session.isDaily) session.dailyNumber else null
        val over = s.moves - s.par
        val meta = "${num?.let { "#$it · " } ?: ""}Par ${s.par} · ${if (won) (if (over <= 0) "On par" else "+$over") else "Out of moves"} · ${timeText(secs)}"
        val text = "Wordocious Letter Ladder${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${timeText(secs)} · Par ${s.par} · ${if (won) (if (over <= 0) "On par" else "+$over over par") else "Out of moves"} · wordocious.com/letter-ladder"
        val bmp = ShareImage.renderLadder(context, s.start, s.end, s.words, s.hintMask, won, meta)
        ShareImage.shareBitmap(context, bmp, text)
    }
    FinishedScreen(
        header = { LadderHeader(session) },
        strip = {
            ResultStrip(
                won,
                listOf(stripCount("${s.moves}", if (s.moves == 1) "move" else "moves"), stripTime(secs), stripPoints(session.points)),
                srText = "$title. $note. ${s.moves} move${if (s.moves == 1) "" else "s"}, time ${timeText(secs)}, ${session.points} points",
            )
        },
        dock = {
            FinishedDock(
                GameMode.LADDER, isDaily = session.isDaily, accent = LADDER_ACCENT, onShare = share,
                onOpenDaily = onOpenDaily, onOpenLeaderboard = onOpenLeaderboard, onOpenUnlimited = onOpenUnlimited,
                onNewPuzzle = if (!session.isDaily && isPro && onPlayAgain != null) onPlayAgain else null,
                onOtherGames = onBack,
                more = {
                    Text(note, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                    if (session.isDaily) DailyRankBadge(GameMode.LADDER)
                    ScoreBreakdownCard(GameMode.LADDER, won, gc, secs, if (won) 1 else 0, 1, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
                },
            )
        },
    ) { _, maxH ->
        // R2: the rungs shrink to fit the height left; a ladder too long even at the
        // smallest rung collapses (it still scrolls in place) behind "See all".
        val rows = s.words.size + (if (s.current != s.end) 1 else 0) + (if (revealPath) s.path.size else 0)
        val labels = (if (s.current != s.end) 16f else 0f) + (if (revealPath) 24f else 0f)
        val tile = FinishedSizing.rowTile(maxH.value, rows, gap = 4f, fixed = 20f + labels + GameTrayStyle.LIP.value, maxTile = 44f, minTile = 24f)
        if (tile != null) {
            LadderBoard(s, "", false, revealPath, tile = tile.dp)
        } else {
            FinishedListSlot(
                maxHeight = maxH, accent = LADDER_ACCENT, seeAllTitle = "The whole ladder",
                full = { LadderBoard(s, "", false, revealPath, tile = 34.dp) },
            ) {
                LadderBoard(s, "", false, revealPath, tile = 24.dp)
            }
        }
    }
}

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"

@Composable
private fun LadderOverlay(session: LadderSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == LadderStatus.WON
    val secs = session.elapsed
    PieceOverlay(won, "LADDER", LADDER_ACCENT, onScrimTap = onDismiss) {
        // Moment lettering (ART_SPEC §6).
        com.wordocious.app.ui.MomentTitle(if (won) com.wordocious.app.ui.MomentArt.VICTORY else com.wordocious.app.ui.MomentArt.SO_CLOSE)
        Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            StatBlock("${session.state.moves}", "MOVES"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
        }
        onPlayAgain?.let { PiecePlayAgain(won, it) }
        PieceTapHint()
    }
}

/** A2 a soft-number stat. */
@Composable
private fun StatBlock(value: String, label: String) = PieceStat(value, label)
