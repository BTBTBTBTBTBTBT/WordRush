package com.wordocious.app.ui.game

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
private val LADDER_HINT = Color(0xFF8B5CF6)

// ── Session ─────────────────────────────────────────────────────────────────

class LadderSession(val seed: String, val isDaily: Boolean) {
    private val allowed: Set<String> = GameDictionary.getAllowedWords().filter { it.length == 5 }.map { it.uppercase() }.toHashSet()

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
    private var guidePauseStart: Long? = null
    private var recorded = false

    val isFinished get() = state.status != LadderStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, ((System.currentTimeMillis() - startMs) / 1000).toInt())
    val dailyNumber get() = ladderDailyNumber(todayLocalDate())
    val movesLeft get() = maxOf(0, state.maxMoves - state.moves)
    val points: Int get() = com.wordocious.app.data.DailyScoring.breakdown(
        GameMode.LADDER.name, state.status == LadderStatus.WON, state.guessCount, elapsed,
        if (state.status == LadderStatus.WON) 1 else 0, 1, state.hintsUsed,
    ).total.toInt()

    init { restore() }

    fun beginTimer() { startMs = System.currentTimeMillis() - restoredElapsedMs }
    fun pauseForGuide() { if (guidePauseStart == null && !isFinished) guidePauseStart = System.currentTimeMillis() }
    fun resumeFromGuide() { guidePauseStart?.let { startMs += System.currentTimeMillis() - it; guidePauseStart = null } }

    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
        val id: String, val start: String, val end: String, val par: Int, val path: List<String>,
        val words: List<String>, val hintMask: String, val moves: Int, val hintsUsed: Int, val events: List<String>,
        val status: String, val startTime: Long, val endTime: Long?,
    )
    private val json = Json { ignoreUnknownKeys = true }
    private val storageKey get() = if (isDaily) "ladder-save-daily" else "ladder-save-$seed"

    private fun persist() {
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
        if (isDaily) DailyCompletionsService.noteCompletion(GameMode.LADDER.name, won, gc, elapsed)
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
    var adGateDone by remember(seed) { mutableStateOf(false) }

    LaunchedEffect(seed) {
        val activity = context as? Activity
        if (!adGateDone && !session.isFinished && activity != null && AdsManager.active) {
            adGateDone = true
            AdsManager.showGameStartInterstitial(activity) { session.beginTimer() }
        } else { adGateDone = true; session.beginTimer() }
    }
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

    Box(Modifier.fillMaxSize().background(WTheme.bg).statusBarsPadding()) {
        if (session.isFinished) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                LadderHeader(session)
                LadderBoard(session, revealPath = session.state.status == LadderStatus.LOST)
                LadderResult(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
            }
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                LadderHeader(session)
                Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    LadderBoard(session, revealPath = false)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Capsule("Undo", Icons.AutoMirrored.Filled.Undo, dim = session.state.words.size <= 1) { session.undo(onFinished) }
                    Capsule(if (session.state.hintsUsed > 0) "Hint · ${session.state.hintsUsed}" else "Hint", Icons.Filled.Lightbulb) { session.hint(onFinished) }
                }
                KeyboardView(onKey = { session.type(it) }, onDelete = { session.delete() }, onEnter = { session.submit(onFinished) })
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
        if (showOverlay) LadderOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(LADDER_ACCENT, onBack) }
        CornerHelpButton(LADDER_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
        if (showGuide) GuideSheet(mode = GameMode.LADDER, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@Composable
private fun LadderHeader(session: LadderSession) {
    val tick by produceState(0, session.isFinished) {
        while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ }
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        Text("LETTER LADDER", fontSize = 24.sp, fontWeight = FontWeight.Black, color = LADDER_ACCENT, fontFamily = Nunito)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
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

/** One tile of the ladder — the Classic tile geometry (14% corner) with the
 *  ladder's own fills: START purple, a changed letter in the accent (violet for
 *  a hint rung), plain rungs white, END a dashed-look target, revealed route muted. */
@Composable
private fun LadderTile(letter: String, fill: Color, border: Color, ink: Color, size: androidx.compose.ui.unit.Dp = 44.dp, ring: Color? = null) {
    val density = LocalDensity.current
    val fs = with(density) { (size * 0.5f).toSp() }
    Box(
        Modifier.size(size)
            .then(if (ring != null) Modifier.border(2.dp, ring.copy(alpha = 0.35f), RoundedCornerShape(size * 0.14f + 3.dp)).padding(3.dp) else Modifier)
            .clip(RoundedCornerShape(size * 0.14f)).background(fill).border(2.dp, border, RoundedCornerShape(size * 0.14f)),
        contentAlignment = Alignment.Center,
    ) { Text(letter, fontSize = fs, fontWeight = FontWeight.Black, color = ink, fontFamily = Nunito) }
}

@Composable
private fun LadderRow(word: String, prev: String?, kind: String, invalid: Boolean = false) {
    val chars = word.padEnd(5, ' ')
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        for (i in 0 until 5) {
            val ch = if (chars[i] == ' ') "" else chars[i].toString()
            val changed = prev != null && prev[i] != chars[i]
            when (kind) {
                "start" -> LadderTile(ch, Color(0xFF7C3AED), Color(0xFF7C3AED), Color.White)
                "rung", "hint" -> if (changed) { val c = if (kind == "hint") LADDER_HINT else LADDER_ACCENT; LadderTile(ch, c, c, Color.White, ring = c) }
                    else LadderTile(ch, WTheme.surface, WTheme.border, WTheme.text)
                "typing" -> LadderTile(ch, if (invalid) Color(0xFFFEF2F2) else WTheme.surface, if (invalid) Color(0xFFF87171) else WTheme.border, if (invalid) Color(0xFFEF4444) else WTheme.text)
                "end" -> LadderTile(ch, Color.Transparent, LADDER_ACCENT.copy(alpha = 0.55f), LADDER_ACCENT)
                else -> LadderTile(ch, Color(0xFFF9FAFB), Color(0xFFE5E7EB), Color(0xFF9CA3AF))
            }
        }
    }
}

@Composable
fun LadderBoard(session: LadderSession, revealPath: Boolean) {
    val s = session.state
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.widthIn(max = 420.dp)) {
        s.words.forEachIndexed { i, w -> LadderRow(w, if (i > 0) s.words[i - 1] else null, if (i == 0) "start" else if (s.hintMask[i] == '1') "hint" else "rung") }
        if (s.status == LadderStatus.PLAYING) LadderRow(session.typing, s.current, "typing", session.invalid)
        if (s.current != s.end) {
            Text("↓ ${if (s.status == LadderStatus.PLAYING) "REACH" else "TARGET"}", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = LADDER_ACCENT.copy(alpha = 0.7f))
            LadderRow(s.end, null, "end")
        }
        if (revealPath) {
            Text("ONE SHORTEST ROUTE", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted, modifier = Modifier.padding(top = 8.dp))
            s.path.forEachIndexed { i, w -> LadderRow(w, if (i > 0) s.path[i - 1] else null, "reveal") }
        }
    }
}

@Composable
private fun Capsule(label: String, icon: ImageVector, dim: Boolean = false, onClick: () -> Unit) {
    val fg = if (dim) WTheme.textMuted.copy(alpha = 0.5f) else LADDER_ACCENT
    Row(
        Modifier.clip(CircleShape)
            .background(if (dim) Color.Transparent else LADDER_ACCENT.copy(alpha = 0.05f))
            .border(1.5.dp, if (dim) WTheme.border else LADDER_ACCENT.copy(alpha = 0.4f), CircleShape)
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
private fun LadderResult(
    session: LadderSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == LadderStatus.WON
    val secs = session.elapsed
    val gc = s.guessCount
    val parLabel = formatGuessStat("overPar", 1, gc)
    val context = LocalContext.current
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 12.dp)) {
        Text(if (won) (if (gc == 1) "Ladder climbed on par" else "Ladder climbed") else "Out of moves", fontSize = 20.sp, fontWeight = FontWeight.Black,
            color = if (won) Color(0xFF7C3AED) else Color(0xFFEF4444), fontFamily = Nunito)
        Text(
            "${s.moves} move${if (s.moves == 1) "" else "s"} · Par ${s.par}${if (won) " · $parLabel" else ""} · ${timeText(secs)}" + (if (s.hintsUsed > 0) " · ${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}" else ""),
            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            ResultAction(Icons.Filled.Home, "Home", LADDER_ACCENT, onBack)
            ResultAction(Icons.Filled.Share, "Share", LADDER_ACCENT) {
                val num = if (session.isDaily) session.dailyNumber else null
                val over = s.moves - s.par
                val meta = "${num?.let { "#$it · " } ?: ""}Par ${s.par} · ${if (won) (if (over <= 0) "On par" else "+$over") else "Out of moves"} · ${timeText(secs)}"
                val text = "Wordocious Letter Ladder${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${timeText(secs)} · Par ${s.par} · ${if (won) (if (over <= 0) "On par" else "+$over over par") else "Out of moves"} · wordocious.com/letter-ladder"
                val bmp = ShareImage.renderLadder(context, s.start, s.end, s.words, s.hintMask, won, meta)
                ShareImage.shareBitmap(context, bmp, text)
            }
            if (!session.isDaily && isPro && onPlayAgain != null) ResultAction(Icons.Filled.Refresh, "Play Again", Color(0xFFD97706)) { onPlayAgain() }
        }
        if (session.isDaily) DailyRankBadge(GameMode.LADDER)
        ScoreBreakdownCard(GameMode.LADDER, won, gc, secs, if (won) 1 else 0, 1, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.LADDER, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
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
private fun LadderOverlay(session: LadderSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == LadderStatus.WON
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
                    StatBlock("${session.state.moves}", "MOVES"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
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
