package com.wordocious.app.ui.game

import com.wordocious.app.ui.gameBackground
import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
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
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
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
import com.wordocious.app.ui.FitText
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.pressScale
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.HUB_DAILY_EPOCH
import com.wordocious.core.HUB_MIN_WORD
import com.wordocious.core.HUB_RANKS
import com.wordocious.core.HUB_SOLVED_RANK
import com.wordocious.core.HUB_TOTAL_BOARDS
import com.wordocious.core.HubAction
import com.wordocious.core.HubBank
import com.wordocious.core.HubPuzzle
import com.wordocious.core.HubReject
import com.wordocious.core.HubState
import com.wordocious.core.HubStatus
import com.wordocious.core.hubDailyNumber
import com.wordocious.core.hubIsPangram
import com.wordocious.core.hubMatchRow
import com.wordocious.core.hubPuzzleForDay
import com.wordocious.core.hubPuzzleForSeed
import com.wordocious.core.hubRankThreshold
import com.wordocious.core.hubReduce
import com.wordocious.core.hubWordScore
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Hubbub (More Games §12) — the Android twin of components/hub/* and
// HubView.swift. Seven letters, one required center, words of 4+ letters.
// Finalizes ONCE (Hubbub = win, End below it = loss); play continues after the
// win and each later rank-up goes through GameResultsService.improve.
//
// Clock contract (founder, 2026-09-28; identical on iOS/web): the clock runs
// ONLY while the board is visible — not under the victory card, not on the
// results view, never once ended. `recordedSeconds` is the time the current
// rank was reached (set at finalise and every improve); it is what results,
// the share text and the score breakdown show after a win, and what "I'm done"
// / Finish freezes as the final time. matches.player1_time stays the time to
// FIRST reach Hubbub (Fastest Win); daily_results.time_seconds moves with the
// final rank (leaderboard tiebreak).

private val HUB_ACCENT = Color(0xFFC026D3)

class HubSession(val seed: String, val isDaily: Boolean, private val scope: kotlinx.coroutines.CoroutineScope) {
    var state by mutableStateOf(
        HubState.create(
            run {
                val bank = HubBank.bundled ?: HubBank(1, HUB_DAILY_EPOCH, emptyList(), emptyList())
                val fallback = HubPuzzle("none", "UDELMNP", listOf("DUDE"), emptyList(), emptyList(), 1)
                (if (isDaily) hubPuzzleForDay(bank, todayLocalDate()) else hubPuzzleForSeed(bank, seed)) ?: fallback
            },
            seed, System.currentTimeMillis(),
        ),
    )
        private set
    var typing by mutableStateOf("")
    val outer = mutableStateListOf<Char>().apply { addAll(state.letters.drop(1).toList()) }
    var toast by mutableStateOf<String?>(null)
    var showResults by mutableStateOf(false)
    var finalTimeSeconds by mutableStateOf<Int?>(null)
        private set
    /** Seconds on the clock when the current rank was reached (finalise + every improve). 0 = never recorded. */
    var recordedSeconds by mutableStateOf(0)
        private set
    var xpResult by mutableStateOf<GameResultsService.XpResult?>(null)
    var restoredFinished = false
        private set
    /** Fires once when the game first finalizes (the overlay). */
    var onFinalised: (() -> Unit)? = null

    private var startMs = System.currentTimeMillis()
    private var restoredElapsedMs = 0L
    private var began = false
    private var recordedRank = -1

    /** Why the clock is stopped. It runs only while the set is empty. */
    enum class Pause { VIEW, GUIDE, BACKGROUND }
    private val pausedFor = mutableStateListOf<Pause>()
    private var pauseStart: Long? = null
    val clockRunning: Boolean get() = !state.ended && pausedFor.isEmpty()

    /** Wall-clock seconds while playing (pauses excluded); frozen once ended. */
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, (((pauseStart ?: System.currentTimeMillis()) - startMs) / 1000).toInt())
    /** What results, share and the score breakdown show: the recorded time after a win, the live clock otherwise. */
    val displaySeconds: Int get() = if (state.status == HubStatus.WON && recordedSeconds > 0) recordedSeconds else elapsed
    val dailyNumber get() = hubDailyNumber(todayLocalDate())
    val centre get() = state.centre
    val pct get() = if (state.max > 0) state.points * 100 / state.max else 0
    val pangramsFound get() = state.found.count { it in state.pangrams }
    val points: Int get() = com.wordocious.app.data.DailyScoring.breakdown(
        GameMode.HUB.name, state.status == HubStatus.WON, state.guessCount, displaySeconds, state.boardsSolved, HUB_TOTAL_BOARDS, state.hintsUsed,
    ).total.toInt()

    // Declared BEFORE init: restore() runs inside init and needs it. Declared below the
    // block it was null during construction, decode threw inside runCatching and every
    // save was silently ignored on the next open (Doug, Android production, 2026-09-25).
    private val json = Json { ignoreUnknownKeys = true }

    init { restore() }

    fun beginTimer() {
        val now = System.currentTimeMillis()
        startMs = now - restoredElapsedMs; began = true
        // A restored WON daily opens on results, already paused: the pause starts with the clock.
        if (pausedFor.isNotEmpty()) pauseStart = now
    }
    /** Stop the clock for [why]; idempotent, and the clock stays stopped until every reason is lifted. */
    fun pauseClock(why: Pause) {
        if (state.ended || why in pausedFor) return
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
    fun enterBackground() { pauseClock(Pause.BACKGROUND); if (began && !state.ended) persist() }
    fun leaveBackground() = resumeClock(Pause.BACKGROUND)

    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long, val recordedRank: Int,
        val id: String, val letters: String, val words: List<String>, val bonus: List<String>, val pangrams: List<String>, val max: Int,
        val found: List<String>, val bonusFound: List<String>, val revealed: List<String>, val hinted: List<String>,
        val points: Int, val hintsUsed: Int, val events: List<String>, val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
        val recordedSeconds: Int = 0, // default so saves from before 2026-09-28 still decode
    )
    private val storageKey get() = if (isDaily) "hub-save-daily" else "hub-save-$seed"

    private fun persist() {
        if (!isDaily && state.ended) { SettingsPref.remove(storageKey); return }
        val s = state
        val dto = SaveDto(seed, todayLocalDate(), elapsed, System.currentTimeMillis(), recordedRank,
            s.id, s.letters, s.words, s.bonus, s.pangrams, s.max, s.found, s.bonusFound, s.revealed, s.hinted,
            s.points, s.hintsUsed, s.events, s.status.key, s.ended, s.startTime, s.endTime, recordedSeconds)
        runCatching { SettingsPref.set(storageKey, json.encodeToString(dto)) }
    }
    private fun restore() {
        val raw = SettingsPref.get(storageKey, "")
        if (raw.isEmpty()) return
        val dto = runCatching { json.decodeFromString<SaveDto>(raw) }.getOrNull() ?: return
        val stale = dto.seed != seed || (isDaily && dto.date != todayLocalDate()) || (!isDaily && System.currentTimeMillis() - dto.savedAt > 24 * 60 * 60 * 1000L)
        if (stale) { SettingsPref.set(storageKey, ""); return }
        val status = HubStatus.values().firstOrNull { it.key == dto.status } ?: HubStatus.PLAYING
        state = HubState(seed, dto.id, dto.letters, dto.words, dto.bonus, dto.pangrams, dto.max, dto.found, dto.bonusFound, dto.revealed, dto.hinted,
            dto.points, dto.hintsUsed, dto.events, status, dto.ended, null, dto.startTime, dto.endTime)
        recordedRank = dto.recordedRank
        restoredElapsedMs = dto.elapsed * 1000L
        if (status != HubStatus.PLAYING) {
            restoredFinished = true
            // Saves from before recordedSeconds existed: the saved clock is the best time we have.
            recordedSeconds = if (dto.recordedSeconds > 0) dto.recordedSeconds else dto.elapsed
        }
        if (dto.ended) { finalTimeSeconds = if (status == HubStatus.WON) recordedSeconds else dto.elapsed; showResults = true }
        // A won-but-not-ended daily reopens on results with the clock stopped, not on a running board.
        else if (status == HubStatus.WON) { showResults = true; pauseClock(Pause.VIEW) }
    }

    private fun dispatch(a: HubAction) {
        if (state.ended) return
        val before = state
        state = hubReduce(state, a, System.currentTimeMillis())
        afterChange(before)
        persist()
    }
    fun type(ch: Char) { if (!state.ended && typing.length < 19) { typing += ch; SoundManager.playKeyTap() } }
    fun delete() { if (typing.isNotEmpty()) typing = typing.dropLast(1) }
    fun shuffle() { outer.shuffle(); SoundManager.playKeyTap() }
    fun submit() {
        if (state.ended) return
        if (typing.length < HUB_MIN_WORD) { toast = "Four letters or more"; return }
        val word = typing.uppercase()
        dispatch(HubAction.Submit(word))
        val r = state.reject
        if (r != null) {
            toast = rejectCopy(r); SoundManager.playInvalid()
            // Like the word games: the rejected entry erases after the shake so the next word starts clean.
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ if (typing == word) typing = "" }, 450)
        }
        else {
            typing = ""
            // Every accepted word scores (founder, 2026-09-25) — one message for all of them.
            SoundManager.playSuccess(); toast = if (hubIsPangram(word, state.letters)) "Pangram! +${hubWordScore(word, state.letters)}" else "+${hubWordScore(word, state.letters)}"
        }
    }
    fun hintStart() = dispatch(HubAction.HintStart)
    fun hintReveal() = dispatch(HubAction.HintReveal)
    /** "End puzzle" below Hubbub (a loss) or "I'm done" / Finish after the win: the game ends and
     *  the frozen time is the recorded one — the clock kept moving while the player played on. */
    fun end() {
        if (state.ended) { showResults = true; return }
        dispatch(HubAction.End) // a loss finalises here, recording its own seconds
        finalTimeSeconds = if (recordedSeconds > 0) recordedSeconds else elapsed
        showResults = true
    }

    private fun rejectCopy(r: HubReject) = when (r) {
        HubReject.ENDED -> "This puzzle is finished"; HubReject.SHORT -> "Four letters or more"; HubReject.CENTRE -> "Must use the center letter"
        HubReject.LETTERS -> "Only the seven letters"; HubReject.FOUND -> "Already found"; HubReject.NOTWORD -> "Not a word we know"
    }

    private fun afterChange(before: HubState) {
        if (state.status != HubStatus.PLAYING && recordedRank < 0) {
            if (state.status == HubStatus.WON) SoundManager.playSuccess() else SoundManager.playGameOver()
            finalise(); onFinalised?.invoke()
        } else if (state.status == HubStatus.WON && state.rank > before.rank && recordedRank >= 0) {
            improve(); toast = "Rank up: ${state.rankName}"
        }
    }
    private fun finalise() {
        recordedRank = state.rank
        recordedSeconds = elapsed
        val s = state; val won = s.status == HubStatus.WON; val secs = recordedSeconds
        val (solutions, guesses) = hubMatchRow(s)
        scope.launch {
            val xp = GameResultsService.record(
                gameMode = GameMode.HUB, won = won, guessCount = s.guessCount, timeSeconds = secs,
                boardsSolved = s.boardsSolved, totalBoards = HUB_TOTAL_BOARDS, seed = seed,
                solutions = solutions, guesses = guesses, hintsUsed = s.hintsUsed,
            )
            xpResult = xp
            if (isDaily) DailyCompletionsService.noteCompletion(GameMode.HUB.name, won, s.guessCount, secs)
        }
    }
    private fun improve() {
        if (state.rank <= recordedRank) return
        recordedRank = state.rank
        recordedSeconds = elapsed // the new rank's time; matches.player1_time keeps the first Hubbub time
        if (!isDaily) return
        val s = state; val secs = recordedSeconds
        val (_, guesses) = hubMatchRow(s)
        scope.launch { GameResultsService.improve(GameMode.HUB, seed, true, s.guessCount, secs, s.boardsSolved, HUB_TOTAL_BOARDS, s.hintsUsed, guesses) }
    }
}

@Composable
fun HubScreen(
    seed: String, isDaily: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)? = null,
    onOpenDaily: (GameMode) -> Unit = {}, onOpenUnlimited: ((GameMode) -> Unit)? = null, onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val scope = rememberCoroutineScope()
    val session = remember(seed) { HubSession(seed, isDaily, scope) }
    val context = LocalContext.current
    val isPro = AuthService.isProActive
    var showOverlay by remember(seed) { mutableStateOf(false) }
    var showGuide by remember { mutableStateOf(false) }
    var adGateDone by remember(seed) { mutableStateOf(false) }

    LaunchedEffect(seed) {
        session.onFinalised = {
            if (!session.restoredFinished) showOverlay = true
            if (session.state.status == HubStatus.WON) { RatingsPrompt.recordWin(context); scope.launch { (context as? Activity)?.let { RatingsPrompt.maybeAsk(it) } } }
        }
        val activity = context as? Activity
        if (!adGateDone && !session.state.ended && activity != null && AdsManager.active) { adGateDone = true; AdsManager.showGameStartInterstitial(activity) { session.beginTimer() } }
        else { adGateDone = true; session.beginTimer() }
    }
    PauseClockInBackground(session, session::enterBackground, session::leaveBackground)
    LaunchedEffect(session.toast) { if (session.toast != null) { kotlinx.coroutines.delay(1400); session.toast = null } }
    // The clock runs only while the board itself is on screen (founder, 2026-09-28).
    LaunchedEffect(showOverlay, session.showResults) {
        if (showOverlay || session.showResults) session.pauseClock(HubSession.Pause.VIEW) else session.resumeClock(HubSession.Pause.VIEW)
    }
    androidx.activity.compose.BackHandler { onBack() }

    // Physical keyboard (founder, 2026-09-30; web hub-game.tsx): only the seven puzzle letters type,
    // Enter submits, Backspace/Delete erases, Space shuffles. Board view only.
    Box(
        Modifier.fillMaxSize()
            .hardwareKeys(enabled = !session.state.ended && !session.showResults && !showOverlay && !showGuide) { k ->
                when {
                    k is HwKey.Letter -> { if (k.ch in session.state.letters.uppercase()) session.type(k.ch); true }
                    k == HwKey.Enter -> { session.submit(); true }
                    k.isErase -> { session.delete(); true }
                    k == HwKey.Space -> { session.shuffle(); true }
                    else -> false
                }
            }
            .gameBackground { background(WTheme.bg) }.statusBarsPadding(),
    ) {
        Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            HubHeader(session)
            if (session.showResults) HubResults(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
            else HubBoard(session)
        }
        session.toast?.let {
            Box(Modifier.fillMaxWidth().padding(top = 100.dp), contentAlignment = Alignment.TopCenter) {
                Text(it, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clip(CircleShape).background(WTheme.text.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 10.dp))
            }
        }
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) HubOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(HUB_ACCENT, onBack) }
        CornerHelpButton(HUB_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET))
        if (showGuide) GuideSheet(mode = GameMode.HUB, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@Composable
private fun HubHeader(session: HubSession) {
    val tick by produceState(0, session.state.ended) { while (!session.state.ended) { kotlinx.coroutines.delay(1000); value++ } }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        // The game's title art: lettering + host (ART_SPEC §10).
        com.wordocious.app.ui.HostedGameTitle("HUB") { Text("HUBBUB", fontSize = 24.sp, fontWeight = FontWeight.Black, color = HUB_ACCENT, fontFamily = Nunito) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text("${session.state.found.size}/${session.state.words.size} words", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text("${session.state.points}/${session.state.max} pts", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            if (!session.state.ended) {
                @Suppress("UNUSED_EXPRESSION") tick
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Icon(Icons.Filled.Schedule, null, tint = WTheme.textMuted, modifier = Modifier.size(11.dp))
                    val s = session.elapsed
                    Text("${s / 60}:${"%02d".format(s % 60)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    // After the win the clock keeps moving while the player chases a higher rank — say so.
                    if (session.state.status == HubStatus.WON) Text("· playing on", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted.copy(alpha = 0.8f))
                }
            }
        }
    }
}

@Composable
private fun RankBar(session: HubSession) {
    val s = session.state; val rank = s.rank
    val next = if (rank < 9) "${hubRankThreshold(rank + 1, s.max) - s.points} to ${HUB_RANKS[rank + 1].first}" else "maximum"
    Column(Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(s.rankName, fontSize = 12.sp, fontWeight = FontWeight.Black, color = HUB_ACCENT)
            Text("${s.points} pts · $next", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            for (i in HUB_RANKS.indices) Box(
                Modifier.weight(1f).height(8.dp).clip(CircleShape).background(if (i <= rank) HUB_ACCENT else WTheme.borderLight)
                    .then(if (i == HUB_SOLVED_RANK) Modifier.border(2.dp, HUB_ACCENT.copy(alpha = 0.5f), CircleShape) else Modifier),
            )
        }
    }
}

@Composable
private fun LetterTile(ch: Char, centre: Boolean, enabled: Boolean, side: androidx.compose.ui.unit.Dp, onTap: () -> Unit) {
    Box(
        Modifier.size(side).clip(RoundedCornerShape(8.dp)).background(if (centre) HUB_ACCENT else WTheme.surface)
            .border(2.dp, if (centre) HUB_ACCENT else WTheme.border, RoundedCornerShape(8.dp))
            .then(if (enabled) Modifier.pressScale { onTap() } else Modifier),
        contentAlignment = Alignment.Center,
    ) { Text(ch.toString(), fontSize = (side.value * 0.45f).sp, fontWeight = FontWeight.Black, color = if (centre) Color.White else WTheme.text, fontFamily = Nunito) }
}

@Composable
private fun Chip(session: HubSession, w: String, dim: Boolean = false) =
    HubChip(w, pangram = w in session.state.pangrams, revealed = w in session.state.revealed, dim = dim)

@Composable
private fun HubChip(w: String, pangram: Boolean, revealed: Boolean, dim: Boolean = false) {
    Text(
        if (pangram) "$w ★" else w, fontSize = 11.sp, fontWeight = FontWeight.Bold,
        color = if (pangram) HUB_ACCENT else if (revealed) Color(0xFF8B5CF6) else WTheme.text,
        modifier = Modifier.alpha(if (dim) 0.6f else 1f).clip(CircleShape).background(if (pangram) HUB_ACCENT.copy(alpha = 0.14f) else WTheme.surface)
            .border(1.dp, if (pangram) HUB_ACCENT else if (revealed) Color(0xFF8B5CF6) else WTheme.border, CircleShape).padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

@Composable
private fun ChipRows(session: HubSession, words: List<String>, dim: Boolean = false) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        for (row in words.chunked(4)) Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) { for (w in row) Chip(session, w, dim) }
    }
}

@Composable
private fun Capsule(label: String, icon: ImageVector, filled: Boolean = false, onClick: () -> Unit) {
    val fg = if (filled) Color.White else HUB_ACCENT
    Row(
        Modifier.clip(CircleShape).background(if (filled) HUB_ACCENT else HUB_ACCENT.copy(alpha = 0.05f))
            .border(1.5.dp, if (filled) HUB_ACCENT else HUB_ACCENT.copy(alpha = 0.4f), CircleShape)
            .clickableNoRipple(onClick).padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) { Icon(icon, null, tint = fg, modifier = Modifier.size(13.dp)); Text(label, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = fg) }
}

// Founder layout rule (plan §12, 2026-09-24): the 2-3-2 cluster is the hero and
// scales to the screen. Tile side = clamp((height left after header, rank bar,
// entry line, the two control rows and the pinned End link) / 3.3, 72, 100 dp)
// — 3.3 because three tiles plus two proportional gaps (0.15 × tile) stack to
// 3.3 tiles. On a ~411 × 914 dp phone that lands near 90 dp. The header sits
// outside HubBoard, so BoxWithConstraints.maxHeight is already "after header".
private val HUB_RANK_BAR_H = 32.dp     // rank name row + 4 dp gap + 8 dp bar
private val HUB_ENTRY_H = 44.dp        // entry line min height (28 sp bold)
private val HUB_CONTROL_ROW_H = 32.dp  // capsule row (7 dp padding × 2 + 11 sp label)
private val HUB_END_LINK_H = 18.dp     // "End puzzle and see answers"
private val HUB_ROW_GAP = 8.dp         // Column spacedBy between the stacked rows
private const val HUB_TILE_GAP_RATIO = 0.15f

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun HubBoard(session: HubSession) {
    val s = session.state
    BoxWithConstraints(Modifier.fillMaxSize().navigationBarsPadding()) {
        // Six gaps: rank→entry→cluster→controls→hints→header→(chips)→end. The
        // found-words header and chips are what the leftover height feeds.
        val fixed = HUB_RANK_BAR_H + HUB_ENTRY_H + HUB_CONTROL_ROW_H * 2 + HUB_END_LINK_H + HUB_ROW_GAP * 6 + 6.dp
        val byHeight = (maxHeight - fixed) / 3.3f
        val byWidth = maxWidth / (3 + 2 * HUB_TILE_GAP_RATIO) // never wider than three tiles + two gaps
        val tile = minOf(byHeight, byWidth).coerceIn(72.dp, 100.dp)
        val gap = tile * HUB_TILE_GAP_RATIO
        val band = tile * 3.3f
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(HUB_ROW_GAP)) {
            RankBar(session)
            HubEntryLine(session)
            val o = session.outer.toList() + List(maxOf(0, 6 - session.outer.size)) { ' ' }
            val enabled = !s.ended
            // The cluster sits vertically centered in its band between the entry line and the controls.
            Box(Modifier.fillMaxWidth().height(band), contentAlignment = Alignment.Center) {
                Column(verticalArrangement = Arrangement.spacedBy(gap), horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(horizontalArrangement = Arrangement.spacedBy(gap)) { LetterTile(o[0], false, enabled, tile) { session.type(o[0]) }; LetterTile(o[1], false, enabled, tile) { session.type(o[1]) } }
                    Row(horizontalArrangement = Arrangement.spacedBy(gap)) { LetterTile(o[2], false, enabled, tile) { session.type(o[2]) }; LetterTile(session.centre, true, enabled, tile) { session.type(session.centre) }; LetterTile(o[3], false, enabled, tile) { session.type(o[3]) } }
                    Row(horizontalArrangement = Arrangement.spacedBy(gap)) { LetterTile(o[4], false, enabled, tile) { session.type(o[4]) }; LetterTile(o[5], false, enabled, tile) { session.type(o[5]) } }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Capsule("Delete", Icons.AutoMirrored.Filled.Backspace) { session.delete() }
                Capsule("Shuffle", Icons.Filled.Shuffle) { session.shuffle() }
                Capsule("Enter", Icons.AutoMirrored.Filled.KeyboardReturn, filled = true) { session.submit() }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Capsule("Starts with…", Icons.Filled.Lightbulb) { session.hintStart() }
                Capsule("Reveal a word", Icons.Filled.Visibility) { session.hintReveal() }
            }
            val pending = s.hinted.filter { it !in s.found }
            if (pending.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (w in pending) Text("${w.take(2)}… · ${w.length} letters", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.border(1.dp, HUB_ACCENT, CircleShape).padding(horizontal = 8.dp, vertical = 3.dp))
            }
            // "N OF M WORDS" heads the found-words area directly under the hint capsules;
            // the chips wrap newest-first and fill the rest, scrolling once they overflow.
            val total = s.found.size + s.bonusFound.size
            Text("$total ${if (total == 1) "WORD" else "WORDS"} · ${s.points} ${if (s.points == 1) "PT" else "PTS"}", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted)
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    // Every accepted word, newest first, in the order found (the event log spans both lists).
                    for (w in hubFoundInOrder(s).asReversed()) Chip(session, w)
                }
            }
            // Pinned at the very bottom; the navigation-bar inset is respected by the BoxWithConstraints above.
            // Won: "Finish" is the same as the card's "I'm done" — ends the game at the recorded time.
            if (s.status == HubStatus.WON) Row(Modifier.clickableNoRipple { session.end() }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Filled.Flag, null, tint = HUB_ACCENT, modifier = Modifier.size(12.dp)); Text("Finish", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HUB_ACCENT)
            }
            else Row(Modifier.clickableNoRipple { session.end() }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Filled.Flag, null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp)); Text("End puzzle and see answers", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
            Spacer(Modifier.height(6.dp))
        }
    }
}

/** Current entry: 28 sp bold, center letter in the accent; placeholder when empty. Erase-on-reject lives in HubSession.submit. */
@Composable
private fun HubEntryLine(session: HubSession) {
    Box(Modifier.fillMaxWidth().heightIn(min = HUB_ENTRY_H), contentAlignment = Alignment.Center) {
        if (session.typing.isEmpty()) Text("Tap letters or type", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        else Text(
            buildAnnotatedString {
                for (ch in session.typing) withStyle(SpanStyle(color = if (ch == session.centre) HUB_ACCENT else WTheme.text)) { append(ch) }
            },
            fontSize = 28.sp, fontWeight = FontWeight.Bold, fontFamily = Nunito, letterSpacing = 1.sp, maxLines = 1, softWrap = false,
        )
    }
}

@Composable
private fun HubResults(
    session: HubSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state; val won = s.status == HubStatus.WON; val secs = session.displaySeconds
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        RankBar(session)
        Text(if (won) (if (s.rank == 9) "Pandemonium — every word" else s.rankName) else "${s.rankName} — below Hubbub", fontSize = 20.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF7C3AED) else Color(0xFFEF4444), fontFamily = Nunito)
        Text("${s.points}/${s.max} pts · ${s.found.size}/${s.words.size} words · ${session.pangramsFound}/${s.pangrams.size} pangram${if (s.pangrams.size == 1) "" else "s"} · ${timeText(secs)}" + (if (s.hintsUsed > 0) " · ${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}" else ""),
            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center)
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            ResultAction(Icons.Filled.Home, "Home", HUB_ACCENT, onBack)
            ResultAction(Icons.Filled.Share, "Share", HUB_ACCENT) {
                val num = if (session.isDaily) session.dailyNumber else null
                val meta = "${num?.let { "#$it · " } ?: ""}${s.rankName} · ${session.pct}% · ${s.found.size} word${if (s.found.size == 1) "" else "s"} · ${session.pangramsFound} pangram${if (session.pangramsFound == 1) "" else "s"}"
                val text = "Wordocious Hubbub${num?.let { " #$it" } ?: ""} — Rank ${s.rankName} · ${session.pct}% of the maximum · ${s.found.size}/${s.words.size} words · Score ${session.points} pts · wordocious.com/hubbub"
                ShareImage.shareBitmap(context, ShareImage.renderHub(context, s.rankName, session.pct, won, meta), text)
            }
            if (!s.ended) ResultAction(Icons.AutoMirrored.Filled.Undo, "Keep going", HUB_ACCENT) { session.showResults = false }
            if (!session.isDaily && isPro && onPlayAgain != null) ResultAction(Icons.Filled.Refresh, "Play Again", Color(0xFFD97706)) { onPlayAgain() }
        }
        Text(if (s.ended) "ALL WORDS" else "FOUND SO FAR · ${s.words.size - s.found.size} MORE TO FIND", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted)
        if (s.ended) Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
            for (row in (s.words + s.bonusFound).sorted().chunked(4)) Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                for (w in row) if (w in s.found || w in s.bonusFound) Chip(session, w) else Text(w, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF9CA3AF),
                    modifier = Modifier.clip(CircleShape).background(Color(0xFFF9FAFB)).border(1.dp, Color(0xFFE5E7EB), CircleShape).padding(horizontal = 8.dp, vertical = 3.dp))
            }
        } else ChipRows(session, (s.found + s.bonusFound).sorted())
        if (session.isDaily) DailyRankBadge(GameMode.HUB)
        ScoreBreakdownCard(GameMode.HUB, won, s.guessCount, secs, s.boardsSolved, HUB_TOTAL_BOARDS, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.HUB, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
    }
}

@Composable
private fun ResultAction(icon: ImageVector, label: String, color: Color, onClick: () -> Unit) =
    GameResultAction(icon, label, color, onClick)

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"

@Composable
private fun HubOverlay(session: HubSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == HubStatus.WON; val secs = session.displaySeconds
    // Won: the card is a decision (Keep playing / I'm done), so a stray tap must not dismiss it; a loss still taps away.
    Box(Modifier.fillMaxSize().background(Color(0xFF18182E).copy(alpha = 0.6f)).clickableNoRipple(if (won) ({}) else onDismiss), contentAlignment = Alignment.Center) {
        // The game's host stands on the card: pops on a win, R on a loss (MASCOT_SPEC §3, §5).
        com.wordocious.app.ui.ResultHostBox(won, "HUB") { hostInset ->
            Column(Modifier.padding(top = hostInset, start = 24.dp, end = 24.dp).widthIn(max = 380.dp).clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.fillMaxWidth().height(6.dp).background(androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
                Column(Modifier.padding(horizontal = 20.dp, vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Moment lettering (ART_SPEC §6).
                    com.wordocious.app.ui.MomentTitle(if (won) com.wordocious.app.ui.MomentArt.VICTORY else com.wordocious.app.ui.MomentArt.SO_CLOSE)
                    Text(session.state.rankName, fontSize = 16.sp, fontWeight = FontWeight.Black, color = HUB_ACCENT, fontFamily = Nunito)
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        StatBlock("${session.state.found.size}", "WORDS"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
                    }
                    onPlayAgain?.let {
                        Text(if (won) "Play again" else "Try again", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White,
                            modifier = Modifier.clip(CircleShape).background(if (won) androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899))) else androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFF87171), Color(0xFFF87171)))).clickableNoRipple(it).padding(horizontal = 28.dp, vertical = 10.dp))
                    }
                    if (won) Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        // Keep playing → back to the board, clock resumes. I'm done → End at the recorded time, results.
                        // Keep playing is the filled (primary) choice on all three platforms.
                        Text("Keep playing", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White,
                            modifier = Modifier.clip(CircleShape).background(HUB_ACCENT).clickableNoRipple(onDismiss).padding(horizontal = 18.dp, vertical = 9.dp))
                        Text("I'm done", fontSize = 13.sp, fontWeight = FontWeight.Black, color = HUB_ACCENT,
                            modifier = Modifier.clip(CircleShape).border(1.5.dp, HUB_ACCENT, CircleShape).clickableNoRipple { session.end(); onDismiss() }.padding(horizontal = 18.dp, vertical = 9.dp))
                    }
                    else Text("Tap anywhere to continue", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFC4B5FD))
                }
            }
        }
    }
}

@Composable
private fun StatBlock(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(1.dp)) {
        // One line always — "35:17" must never break inside its cell (founder, 2026-09-28).
        FitText(value, fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.text, fontFamily = Nunito)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, letterSpacing = 0.6.sp)
    }
}

/** The finished hive for the Completed-Today card (founder, 2026-09-29), rebuilt
 *  from the matches row alone: rank line, the 2-3-2 cluster read-only, and every
 *  word found (pangram = all seven letters, starred like the game). */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
internal fun HubFinishedBoard(r: com.wordocious.core.HubReconstruction) {
    val o = r.letters.drop(1).toList(); val tile = 40.dp; val gap = 6.dp
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("${r.rankName} · ${r.points}/${r.max} pts", fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (r.solved) Color(0xFF7C3AED) else WTheme.textMuted, fontFamily = Nunito)
        Column(verticalArrangement = Arrangement.spacedBy(gap), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) { LetterTile(o[0], false, false, tile) {}; LetterTile(o[1], false, false, tile) {} }
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) { LetterTile(o[2], false, false, tile) {}; LetterTile(r.letters[0], true, false, tile) {}; LetterTile(o[3], false, false, tile) {} }
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) { LetterTile(o[4], false, false, tile) {}; LetterTile(o[5], false, false, tile) {} }
        }
        val words = (r.found + r.bonusFound).distinct().sorted()
        Text("${words.size} ${if (words.size == 1) "WORD" else "WORDS"} FOUND", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted)
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            for (w in words) HubChip(w, pangram = w.toSet().size == 7, revealed = w in r.revealed)
        }
    }
}

/** Every accepted word in the order it was found — the event log carries "+" (core list), "=" (rarer word) and "!" (revealed). */
private fun hubFoundInOrder(s: com.wordocious.core.HubState): List<String> {
    val out = ArrayList<String>()
    for (ev in s.events) if (ev.isNotEmpty() && ev[0] in "+=!") { val w = ev.substring(1); if (w !in out) out.add(w) }
    return out
}
