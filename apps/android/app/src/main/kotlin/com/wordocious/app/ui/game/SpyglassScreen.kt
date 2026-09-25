package com.wordocious.app.ui.game

import android.app.Activity
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
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
import com.wordocious.app.ui.formatGuessStat
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.WORDSEARCH_DAILY_EPOCH
import com.wordocious.core.WORDSEARCH_DIRS
import com.wordocious.core.WordsearchAction
import com.wordocious.core.WordsearchBank
import com.wordocious.core.WordsearchPlacement
import com.wordocious.core.WordsearchPuzzle
import com.wordocious.core.WordsearchState
import com.wordocious.core.WordsearchStatus
import com.wordocious.core.wordsearchCells
import com.wordocious.core.wordsearchDailyNumber
import com.wordocious.core.wordsearchLine
import com.wordocious.core.wordsearchMatchRow
import com.wordocious.core.wordsearchPuzzleForDay
import com.wordocious.core.wordsearchPuzzleForSeed
import com.wordocious.core.wordsearchReduce
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Spyglass (More Games §17) — the Android twin of components/wordsearch/* and
// SpyglassView.swift. Ten themed words hidden in a 10 × 10 grid, four forward
// directions in the daily. Tap-start / tap-end or drag to select; a straight
// line of four or more letters that spells no list word is a miss. Hint pulses
// a first letter; Reveal (after five minutes) records a loss with what was
// found. guess_count = min(10 + misses, 15).

private val SPY_ACCENT = Color(0xFF4D7C0F)
private val SPY_INK = Color(0xFF365314)
private const val REVEAL_AFTER_SECONDS = 300

class SpyglassSession(val seed: String, val isDaily: Boolean) {
    var state by mutableStateOf(
        WordsearchState.create(
            run {
                val bank = WordsearchBank.bundled ?: WordsearchBank(1, WORDSEARCH_DAILY_EPOCH, emptyList(), emptyList())
                val fallback = WordsearchPuzzle("none", "none", "none", "Spyglass", "A".repeat(100), listOf(WordsearchPlacement("AAAA", 0, 0, "E")))
                (if (isDaily) wordsearchPuzzleForDay(bank, todayLocalDate()) else wordsearchPuzzleForSeed(bank, seed)) ?: fallback
            },
            seed, System.currentTimeMillis(),
        ),
    )
        private set
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

    val isFinished get() = state.status != WordsearchStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, ((System.currentTimeMillis() - startMs) / 1000).toInt())
    val dailyNumber get() = wordsearchDailyNumber(todayLocalDate())
    val canReveal get() = elapsed >= REVEAL_AFTER_SECONDS
    val points: Int get() = com.wordocious.app.data.DailyScoring.breakdown(
        GameMode.WORDSEARCH.name, state.status == WordsearchStatus.WON, state.guessCount, elapsed, state.found.size, state.words.size, state.hintsUsed,
    ).total.toInt()

    init { restore() }

    fun beginTimer() { startMs = System.currentTimeMillis() - restoredElapsedMs }
    fun pauseForGuide() { if (guidePauseStart == null && !isFinished) guidePauseStart = System.currentTimeMillis() }
    fun resumeFromGuide() { guidePauseStart?.let { startMs += System.currentTimeMillis() - it; guidePauseStart = null } }

    @Serializable private data class PlaceDto(val w: String, val r: Int, val c: Int, val d: String)
    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
        val id: String, val title: String, val grid: String, val words: List<PlaceDto>,
        val found: List<String>, val misses: Int, val hintsUsed: Int, val hinted: List<String>, val events: List<String>,
        val status: String, val startTime: Long, val endTime: Long?,
    )
    private val json = Json { ignoreUnknownKeys = true }
    private val storageKey get() = if (isDaily) "wordsearch-save-daily" else "wordsearch-save-$seed"

    private fun persist() {
        val s = state
        val dto = SaveDto(
            seed, todayLocalDate(), elapsed, System.currentTimeMillis(),
            s.id, s.title, s.grid, s.words.map { PlaceDto(it.w, it.r, it.c, it.d) }, s.found, s.misses, s.hintsUsed, s.hinted, s.events,
            s.status.key, s.startTime, s.endTime,
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
        val status = WordsearchStatus.values().firstOrNull { it.key == dto.status } ?: WordsearchStatus.PLAYING
        state = WordsearchState(
            seed, dto.id, dto.title, 10, dto.grid, dto.words.map { WordsearchPlacement(it.w, it.r, it.c, it.d) },
            dto.found, dto.misses, dto.hintsUsed, dto.hinted, dto.events, status, dto.startTime, dto.endTime,
        )
        restoredElapsedMs = dto.elapsed * 1000L
        if (status != WordsearchStatus.PLAYING) { finalTimeSeconds = dto.elapsed; recorded = true; restoredFinished = true }
    }

    private fun dispatch(a: WordsearchAction, onFinished: () -> Unit) {
        if (isFinished) return
        state = wordsearchReduce(state, a, System.currentTimeMillis())
        if (isFinished) onFinished()
        persist()
    }

    fun select(from: Int, to: Int, onFinished: () -> Unit) {
        if (isFinished) return
        val before = state
        dispatch(WordsearchAction.Select(from, to), onFinished)
        if (state.found.size > before.found.size) SoundManager.playSuccess()
        else if (state.misses > before.misses) { SoundManager.playInvalid(); toast = "Not one of the words" }
    }
    fun hint(onFinished: () -> Unit) { val before = state.hintsUsed; dispatch(WordsearchAction.Hint, onFinished); if (state.hintsUsed > before) SoundManager.playKeyTap() }
    fun reveal(onFinished: () -> Unit) {
        if (!canReveal) { toast = "Reveal unlocks at ${REVEAL_AFTER_SECONDS / 60}:00"; return }
        dispatch(WordsearchAction.Reveal, onFinished)
    }

    suspend fun finish() {
        finalTimeSeconds = elapsed
        if (state.status == WordsearchStatus.WON) SoundManager.playSuccess() else SoundManager.playGameOver()
        if (recorded) return
        recorded = true
        val won = state.status == WordsearchStatus.WON
        val gc = state.guessCount
        val (solutions, guesses) = wordsearchMatchRow(state)
        val xp = GameResultsService.record(
            gameMode = GameMode.WORDSEARCH, won = won, guessCount = gc, timeSeconds = elapsed,
            boardsSolved = state.found.size, totalBoards = state.words.size, seed = seed,
            solutions = solutions, guesses = guesses, hintsUsed = state.hintsUsed,
        )
        xpResult = xp
        if (isDaily) DailyCompletionsService.noteCompletion(GameMode.WORDSEARCH.name, won, gc, elapsed)
    }
}

// ── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun SpyglassScreen(
    seed: String,
    isDaily: Boolean,
    onBack: () -> Unit,
    onPlayAgain: (() -> Unit)? = null,
    onOpenDaily: (GameMode) -> Unit = {},
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val session = remember(seed) { SpyglassSession(seed, isDaily) }
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

    val onFinished: () -> Unit = {
        scope.launch {
            session.finish()
            if (!session.restoredFinished) showOverlay = true
            if (session.state.status == WordsearchStatus.WON) {
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
                SpyglassHeader(session)
                SpyglassGrid(session, revealMissing = session.state.status == WordsearchStatus.LOST) { _, _ -> }
                WordChips(session)
                SpyglassResult(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
            }
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                SpyglassHeader(session)
                // Grid, word chips and the two capsules are one centered block (founder, 2026-09-24).
                Spacer(Modifier.weight(1f))
                SpyglassGrid(session, revealMissing = false) { from, to -> session.select(from, to, onFinished) }
                WordChips(session)
                val tick by produceState(0, session.isFinished) { while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ } }
                @Suppress("UNUSED_EXPRESSION") tick
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Capsule(if (session.state.hintsUsed > 0) "Hint · ${session.state.hintsUsed}" else "Hint", Icons.Filled.Lightbulb) { session.hint(onFinished) }
                    Capsule(if (session.canReveal) "Reveal" else "Reveal · ${timeText(maxOf(0, REVEAL_AFTER_SECONDS - session.elapsed))}", Icons.Filled.Visibility, dim = !session.canReveal) { session.reveal(onFinished) }
                }
                Spacer(Modifier.weight(1f))
                Spacer(Modifier.height(4.dp))
            }
        }
        session.toast?.let {
            Box(Modifier.fillMaxWidth().padding(top = 110.dp), contentAlignment = Alignment.TopCenter) {
                Text(it, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clip(CircleShape).background(WTheme.text.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 10.dp))
            }
        }
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) SpyglassOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(SPY_ACCENT, onBack) }
        CornerHelpButton(SPY_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
        if (showGuide) GuideSheet(mode = GameMode.WORDSEARCH, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@Composable
private fun SpyglassHeader(session: SpyglassSession) {
    val tick by produceState(0, session.isFinished) { while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ } }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.padding(top = 6.dp)) {
        Text("SPYGLASS", fontSize = 24.sp, fontWeight = FontWeight.Black, color = SPY_ACCENT, fontFamily = Nunito)
        Text(session.state.title, fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text("${session.state.found.size}/${session.state.words.size} found", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text("${session.state.misses} miss${if (session.state.misses == 1) "" else "es"}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
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

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun WordChips(session: SpyglassSession) {
    val s = session.state
    // Chips flow by width and never break inside a word (WOODPECKER used to wrap
    // to "WOODPECKE / R" in fixed rows of five).
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        for (w in s.words.map { it.w }) {
            val found = w in s.found; val hinted = w in s.hinted && !found
            Text(
                w, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = if (found) SPY_INK else WTheme.text,
                textDecoration = if (found) TextDecoration.LineThrough else null,
                maxLines = 1, softWrap = false,
                modifier = Modifier.clip(CircleShape).background(if (found) SPY_ACCENT.copy(alpha = 0.14f) else WTheme.surface)
                    .border(1.dp, if (found) SPY_ACCENT.copy(alpha = 0.35f) else if (hinted) SPY_ACCENT else WTheme.border, CircleShape)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }
    }
}

// ── Grid ────────────────────────────────────────────────────────────────────

@Composable
fun SpyglassGrid(session: SpyglassSession, revealMissing: Boolean, onSelect: (Int, Int) -> Unit) {
    val s = session.state
    val n = s.n
    val heavy = Color(0xFF4C1D95); val rule = Color(0xFF4C1D95).copy(alpha = 0.16f)
    var anchor by remember { mutableStateOf<Int?>(null) }
    var hover by remember { mutableStateOf<Int?>(null) }
    var pendingTap by remember { mutableStateOf<Int?>(null) }
    var sidePx by remember { mutableStateOf(1f) }
    val density = LocalDensity.current
    val foundCells = remember(s.found) { s.words.filter { it.w in s.found }.flatMap { wordsearchCells(n, it) }.toSet() }
    val hintCells = remember(s.hinted, s.found) { s.words.filter { it.w in s.hinted && it.w !in s.found }.mapNotNull { wordsearchCells(n, it).firstOrNull() }.toSet() }
    val preview = if (anchor != null && hover != null && hover != anchor) wordsearchLine(n, anchor!!, hover!!) else null
    val previewSet = preview?.toSet() ?: emptySet()
    fun cellAt(p: Offset): Int? {
        val cell = sidePx / n
        val c = (p.x / cell).toInt(); val r = (p.y / cell).toInt()
        return if (c in 0 until n && r in 0 until n) r * n + c else null
    }

    Box(
        Modifier.fillMaxWidth().widthIn(max = 440.dp).aspectRatio(1f)
            .clip(RoundedCornerShape(14.dp)).background(WTheme.surface)
            .border(2.5.dp, heavy, RoundedCornerShape(14.dp))
            .then(
                if (session.isFinished) Modifier else Modifier
                    .pointerInput(n) {
                        detectTapGestures { p ->
                            val cell = cellAt(p) ?: return@detectTapGestures
                            val pend = pendingTap
                            if (pend != null && pend != cell) { pendingTap = null; onSelect(pend, cell) } else pendingTap = cell
                        }
                    }
                    .pointerInput(n) {
                        detectDragGestures(
                            onDragStart = { p -> anchor = cellAt(p); hover = anchor },
                            onDrag = { change, _ -> cellAt(change.position)?.let { hover = it } },
                            onDragEnd = {
                                val a = anchor; val h = hover
                                if (a != null && h != null && h != a) { pendingTap = null; onSelect(a, h) }
                                anchor = null; hover = null
                            },
                            onDragCancel = { anchor = null; hover = null },
                        )
                    },
            ),
    ) {
        Canvas(Modifier.fillMaxSize()) {
            sidePx = size.width
            val cell = size.width / n
            fun center(i: Int) = Offset((i % n + 0.5f) * cell, (i / n + 0.5f) * cell)
            for (w in s.words) if (w.w in s.found) {
                val c = wordsearchCells(n, w)
                drawLine(SPY_ACCENT.copy(alpha = 0.28f), center(c.first()), center(c.last()), strokeWidth = cell * 0.72f, cap = StrokeCap.Round)
            }
            if (revealMissing) for (w in s.words) if (w.w !in s.found) {
                val c = wordsearchCells(n, w)
                drawLine(Color(0xFFDC2626).copy(alpha = 0.45f), center(c.first()), center(c.last()), strokeWidth = cell * 0.72f, cap = StrokeCap.Round,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 10f)))
            }
            if (preview != null) drawLine(SPY_ACCENT.copy(alpha = 0.18f), center(anchor!!), center(hover!!), strokeWidth = cell * 0.72f, cap = StrokeCap.Round)
            for (k in 1 until n) {
                val p = k * cell
                drawRect(rule, topLeft = Offset(p - 0.5f, 0f), size = Size(1f, size.height))
                drawRect(rule, topLeft = Offset(0f, p - 0.5f), size = Size(size.width, 1f))
            }
        }
        Column(Modifier.fillMaxSize()) {
            for (r in 0 until n) Row(Modifier.weight(1f).fillMaxWidth()) {
                for (c in 0 until n) {
                    val i = r * n + c
                    val bg = when { i == anchor || i == pendingTap -> SPY_ACCENT.copy(alpha = 0.2f); i in previewSet -> SPY_ACCENT.copy(alpha = 0.08f); else -> Color.Transparent }
                    Box(
                        Modifier.weight(1f).fillMaxSize().background(bg)
                            .then(if (i in hintCells) Modifier.padding(1.dp).border(2.dp, SPY_ACCENT) else Modifier),
                        contentAlignment = Alignment.Center,
                    ) {
                        val fs = with(density) { 18.dp.toSp() }
                        Text(s.grid[i].toString(), fontSize = fs, fontWeight = FontWeight.Black, color = if (i in foundCells) SPY_INK else WTheme.text, fontFamily = Nunito)
                    }
                }
            }
        }
    }
}

@Composable
private fun Capsule(label: String, icon: ImageVector, dim: Boolean = false, onClick: () -> Unit) {
    val fg = if (dim) WTheme.textMuted.copy(alpha = 0.5f) else SPY_ACCENT
    Row(
        Modifier.clip(CircleShape)
            .background(if (dim) Color.Transparent else SPY_ACCENT.copy(alpha = 0.05f))
            .border(1.5.dp, if (dim) WTheme.border else SPY_ACCENT.copy(alpha = 0.4f), CircleShape)
            .clickableNoRipple { onClick() }
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = fg, modifier = Modifier.size(13.dp))
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = fg)
    }
}

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun SpyglassResult(
    session: SpyglassSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == WordsearchStatus.WON
    val secs = session.elapsed
    val context = LocalContext.current
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 12.dp)) {
        Text(if (won) (if (s.misses == 0) "Clean clear" else "Grid cleared") else "Revealed", fontSize = 20.sp, fontWeight = FontWeight.Black,
            color = if (won) Color(0xFF7C3AED) else Color(0xFFEF4444), fontFamily = Nunito)
        Text(
            "${s.found.size}/${s.words.size} found · ${formatGuessStat("misses", 10, s.guessCount)} · ${timeText(secs)}" + (if (s.hintsUsed > 0) " · ${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}" else ""),
            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            ResultAction(Icons.Filled.Home, "Home", SPY_ACCENT, onBack)
            ResultAction(Icons.Filled.Share, "Share", SPY_ACCENT) {
                val num = if (session.isDaily) session.dailyNumber else null
                val meta = "${num?.let { "#$it · " } ?: ""}${s.found.size}/${s.words.size} · ${s.misses} miss${if (s.misses == 1) "" else "es"} · ${timeText(secs)}"
                val text = "Wordocious Spyglass${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${timeText(secs)} · ${s.found.size}/${s.words.size} found · ${s.misses} miss${if (s.misses == 1) "" else "es"} · wordocious.com/spyglass"
                val bmp = ShareImage.renderWordsearch(context, s.n, s.words, s.found, won, meta)
                ShareImage.shareBitmap(context, bmp, text)
            }
            if (!session.isDaily && isPro && onPlayAgain != null) ResultAction(Icons.Filled.Refresh, "Play Again", Color(0xFFD97706)) { onPlayAgain() }
        }
        if (session.isDaily) DailyRankBadge(GameMode.WORDSEARCH)
        ScoreBreakdownCard(GameMode.WORDSEARCH, won, s.guessCount, secs, s.found.size, s.words.size, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.WORDSEARCH, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
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

@Composable
private fun SpyglassOverlay(session: SpyglassSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == WordsearchStatus.WON
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
                    StatBlock("${session.state.found.size}/${session.state.words.size}", "FOUND"); StatBlock("${session.state.misses}", "MISSES")
                    StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
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
