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
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.pressScale
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.HUB_DAILY_EPOCH
import com.wordocious.core.HUB_FOUND_LABEL
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
import com.wordocious.core.hubIsBonus
import com.wordocious.core.hubIsPangram
import com.wordocious.core.hubMatchRow
import com.wordocious.core.hubPuzzleForDay
import com.wordocious.core.hubPuzzleForSeed
import com.wordocious.core.hubRankThreshold
import com.wordocious.core.hubReduce
import com.wordocious.core.hubWordCount
import com.wordocious.core.hubWordScore
import com.wordocious.core.hubWordsLabel
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
    /** Bumped on every submit so the same toast text ("+1" twice) replays its burst. */
    var toastSeq by mutableStateOf(0)
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
        toastSeq++
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
            SoundManager.playPartial(); toast = if (hubIsPangram(word, state.letters)) "Pangram! +${hubWordScore(word, state.letters)}" else "+${hubWordScore(word, state.letters)}"
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
            if (isDaily) DailyCompletionsService.notePuzzleFinish(seed, GameMode.HUB.name, won, s.guessCount, secs)
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
    // FINISH_SPEC BJ2: Hubbub's card opens the moment the hunt is won (no finish hold), so its
    // art is decoded off main while the board is played.
    val warmDensity = androidx.compose.ui.platform.LocalDensity.current.density
    val warmWidth = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp
    LaunchedEffect(Unit) { FinishMotion.prewarm(context, warmDensity, warmWidth) }
    LaunchedEffect(session.toast, session.toastSeq) { if (session.toast != null) { kotlinx.coroutines.delay(1400); session.toast = null } }
    // The clock runs only while the board itself is on screen (founder, 2026-09-28).
    LaunchedEffect(showOverlay, session.showResults) {
        if (showOverlay || session.showResults) session.pauseClock(HubSession.Pause.VIEW) else session.resumeClock(HubSession.Pause.VIEW)
    }
    androidx.activity.compose.BackHandler { onBack() }

    // Physical keyboard (founder, 2026-09-30; web hub-game.tsx): only the seven puzzle letters type,
    // Enter submits, Backspace/Delete erases, Space shuffles. Board view only.
    ProvideFeedbackAnchor {
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
        if (session.showResults) {
            // FINISH_SPEC R2: the one-screen results screen (header · strip · words · dock).
            HubFinished(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                HubHeader(session)
                HubBoard(session)
            }
        }
        // The candy feedback toast (score burst / calm message), centered on the entry line above the hive.
        GameFeedbackToast(session.toast, nonce = session.toastSeq)
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) HubOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(HUB_ACCENT, onBack) }
        CornerHelpButton(HUB_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET))
        if (showGuide) GuideSheet(mode = GameMode.HUB, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
    }
}

@Composable
private fun HubHeader(session: HubSession, counts: Boolean = true) {
    val tick by produceState(0, session.state.ended) { while (!session.state.ended) { kotlinx.coroutines.delay(1000); value++ } }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        // The game's title art: lettering + host (ART_SPEC §10).
        com.wordocious.app.ui.HostedGameTitle("HUB") { Text("HUBBUB", fontSize = 24.sp, fontWeight = FontWeight.Black, color = HUB_ACCENT, fontFamily = Nunito) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            // The one "N/M words · pts" line (hubWordsLabel). On results the strip carries the
            // word count, so the header drops both rather than say them twice.
            if (counts) {
                Text(hubWordsLabel(session.state), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                Text("${session.state.points}/${session.state.max} pts", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
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
private fun RankBar(session: HubSession, points: Boolean = true) {
    val s = session.state; val rank = s.rank
    val next = if (rank < 9) "${hubRankThreshold(rank + 1, s.max) - s.points} to ${HUB_RANKS[rank + 1].first}" else "maximum"
    Column(Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(s.rankName, fontSize = 12.sp, fontWeight = FontWeight.Black, color = HUB_ACCENT)
            Text(if (points) "${s.points} pts · $next" else next, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            for (i in HUB_RANKS.indices) Box(
                Modifier.weight(1f).height(8.dp).clip(CircleShape).background(if (i <= rank) HUB_ACCENT else com.wordocious.app.ui.accentLine(HUB_ACCENT, 0.24f))
                    .then(if (i == HUB_SOLVED_RANK) Modifier.border(2.dp, HUB_ACCENT.copy(alpha = 0.5f), CircleShape) else Modifier),
            )
        }
    }
}

@Composable
private fun Chip(session: HubSession, w: String, dim: Boolean = false) =
    HubChip(w, pangram = w in session.state.pangrams, revealed = w in session.state.revealed, dim = dim, bonus = hubIsBonus(session.state.bonusFound, w))

/** A found word: a soft tinted chip (A1); a pangram a glossy capsule in the accent (J3); a revealed word violet;
 *  a rarer word (scores, outside the N/M words count) the plain chip with a small "BONUS" tag. */
@Composable
private fun HubChip(w: String, pangram: Boolean, revealed: Boolean, dim: Boolean = false, bonus: Boolean = false) {
    val tone = if (revealed && !pangram) Color(0xFF8B5CF6) else HUB_ACCENT
    androidx.compose.foundation.layout.Row(
        Modifier.alpha(if (dim) 0.6f else 1f)
            .then(if (pangram) Modifier.glossyCapsule(HUB_ACCENT, glow = 0.6f) else Modifier.softChip(tone))
            .padding(start = 9.dp, end = 9.dp, top = 3.dp, bottom = if (pangram) 5.5.dp else 3.dp)
            .then(if (pangram) Modifier.semantics(mergeDescendants = true) { contentDescription = "$w, pangram" }
                else if (bonus) Modifier.semantics(mergeDescendants = true) { contentDescription = "$w, bonus word" } else Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(3.dp),
    ) {
        Text(
            w, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
            color = if (pangram) Color.White else if (revealed) Color(0xFF6D28D9) else if (WTheme.isDark) WTheme.text else com.wordocious.app.ui.FinishInk.heading,
            modifier = if (pangram || bonus) Modifier.clearAndSetSemantics { } else Modifier,
        )
        if (bonus && !pangram) Text(
            "BONUS", fontSize = 7.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, color = WTheme.textMuted,
            modifier = Modifier.clearAndSetSemantics { },
        )
        // AL addendum 2: a pangram wears the gold star art, not a ★ glyph.
        if (pangram) com.wordocious.app.ui.GlyphArtImage(com.wordocious.app.ui.GlyphArt.STAR, 12.dp)
    }
}

/** BI22 a pending "Starts with…" hint: a soft filled amber chip (no outline) with a small bulb, "AB… · 6 letters". */
@Composable
private fun PendingHintChip(w: String) {
    val amber = Color(0xFFF5A524)
    Row(
        Modifier.clip(CircleShape).background(amber.copy(alpha = if (WTheme.isDark) 0.28f else 0.20f))
            .padding(start = 7.dp, end = 9.dp, top = 3.dp, bottom = 3.dp)
            .semantics(mergeDescendants = true) { contentDescription = "Hint: starts with ${w.take(2)}, ${w.length} letters" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Icon(Icons.Filled.Lightbulb, null, tint = Color(0xFFD97706), modifier = Modifier.size(12.dp))
        Text(
            "${w.take(2)}… · ${w.length} letters", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, softWrap = false,
            color = if (WTheme.isDark) WTheme.text else com.wordocious.app.ui.FinishInk.heading,
            modifier = Modifier.clearAndSetSemantics { },
        )
    }
}

/** An unfound word on the results screen: a quiet slate chip. */
@Composable
private fun MissedChip(w: String) {
    Text(
        w, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (WTheme.isDark) WTheme.textMuted else Color(0xFF6B7891),
        modifier = Modifier.softChip(PIECE_LOST).padding(horizontal = 9.dp, vertical = 3.dp),
    )
}

@Composable
private fun ChipRows(session: HubSession, words: List<String>, dim: Boolean = false) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        for (row in words.chunked(4)) Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) { for (w in row) Chip(session, w, dim) }
    }
}

/** A8 a hive control: a small candy button with its icon (Enter the purple primary). */
@Composable
private fun Capsule(label: String, icon: ImageVector, color: com.wordocious.app.ui.CandyColor = com.wordocious.app.ui.CandyColor.PEACH, onClick: () -> Unit) =
    PadAction(label, icon, onClick = onClick, color = color)

// Founder layout rule (plan §12, 2026-09-24): the hive is the hero and scales to
// the screen. FINISH_SPEC J1: it is a honeycomb of glossy hexes (the gold center +
// six lilac around it) in the game tray. Hex side = clamp(the largest that fits the
// width and the height left after header, rank bar, entry line, the two control rows
// and the pinned End button — less the tray — 70, 112 dp); Honeycomb holds the
// geometry. The header sits outside HubBoard, so BoxWithConstraints.maxHeight is
// already "after header".
private val HUB_RANK_BAR_H = 32.dp     // rank name row + 4 dp gap + 8 dp bar
private val HUB_ENTRY_H = 44.dp        // entry line min height (28 sp bold)
private val HUB_CONTROL_ROW_H = 38.dp  // a small candy row (34 dp + its 4 dp lip)
private val HUB_END_LINK_H = 38.dp     // "End puzzle and see answers" (a small candy too)
private val HUB_ROW_GAP = 8.dp         // Column spacedBy between the stacked rows
/** The "FOUND" label over the found-word flow (10 sp black caps; no count, see hubWordsLabel). */
private val HUB_FOUND_HEADER_H = 14.dp
/**
 * The found-word flow's guaranteed height: two chip rows (a ~22 dp chip, 5 dp apart) plus a
 * little slack. Doug (Android, 2026-10-05: "I've lost the ability to see what words I've already
 * guessed"): the J1 honeycomb sizing fit the hive to ALL the height left over and never counted
 * the "N WORDS" header, so on a short or display-size-large phone the weighted flow got 0 dp and
 * the found words vanished. The flow is now reserved before the hive is sized (iOS/web keep the
 * equivalent room with their 3.3-unit rule).
 */
private val HUB_FOUND_MIN_H = 54.dp
/** J1 + L the hive tray's inner padding; the tray adds its 4 dp lip under that. */
private val HUB_TRAY_PAD = 10.dp

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun HubBoard(session: HubSession) {
    val s = session.state
    BoxWithConstraints(Modifier.fillMaxSize().navigationBarsPadding()) {
        // Seven gaps: rank→entry→cluster→controls→hints→header→chips→end. The found-word
        // header and at least two chip rows are reserved BEFORE the hive is sized, so the
        // found words always show (the hive gives way first, down to a 60 dp side); any
        // height beyond that goes back to the flow.
        val fixed = HUB_RANK_BAR_H + HUB_ENTRY_H + HUB_CONTROL_ROW_H * 2 + HUB_END_LINK_H + HUB_FOUND_HEADER_H + HUB_FOUND_MIN_H + HUB_ROW_GAP * 7 + 6.dp
        val trayW = HUB_TRAY_PAD * 2
        val trayH = HUB_TRAY_PAD * 2 + GameTrayStyle.LIP
        val side = Honeycomb.sideFor((maxWidth - trayW).value, (maxHeight - fixed - trayH).value).dp.coerceIn(60.dp, 112.dp)
        val band = side * Honeycomb.height() + trayH
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(HUB_ROW_GAP)) {
            // The header already says "N/M pts" on the board.
            RankBar(session, points = false)
            HubEntryLine(session)
            val o = session.outer.toList() + List(maxOf(0, 6 - session.outer.size)) { ' ' }
            val enabled = !s.ended
            // The cluster sits vertically centered in its band between the entry line and the controls.
            Box(Modifier.fillMaxWidth().height(band), contentAlignment = Alignment.Center) {
                HubHoneycomb(session.centre, o, side, HUB_ACCENT, enabled, trayPadding = HUB_TRAY_PAD, state = hubTrayState(s)) { session.type(it) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Capsule("Delete", Icons.AutoMirrored.Filled.Backspace) { session.delete() }
                Capsule("Shuffle", Icons.Filled.Shuffle) { session.shuffle() }
                Capsule("Enter", Icons.AutoMirrored.Filled.KeyboardReturn, color = com.wordocious.app.ui.CandyColor.PURPLE) { session.submit() }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Capsule("Starts with…", Icons.Filled.Lightbulb, color = com.wordocious.app.ui.CandyColor.AMBER) { session.hintStart() }
                Capsule("Reveal a word", Icons.Filled.Visibility, color = com.wordocious.app.ui.CandyColor.AMBER) { session.hintReveal() }
            }
            // BI22: the pending "Starts with…" hints are NOT a row in this column any more (that row
            // appearing moved everything under the hint capsules): they lead the found-words flow
            // below, which is already the flexible, scrolling area.
            val pending = s.hinted.filter { it !in s.found }
            // "FOUND" heads the found-words area directly under the hint capsules — a label, never a
            // second count: the header's hubWordsLabel is the one word count (Doug 10-05: 8 vs 18).
            // The chips wrap newest-first and fill the rest, scrolling once they overflow.
            Text(HUB_FOUND_LABEL, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted)
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    for (w in pending) PendingHintChip(w)
                    // Every accepted word, newest first, in the order found (the event log spans both lists).
                    for (w in hubFoundInOrder(s).asReversed()) Chip(session, w)
                }
            }
            // Pinned at the very bottom; the navigation-bar inset is respected by the BoxWithConstraints above.
            // Won: "Finish" is the same as the card's "I'm done" — ends the game at the recorded time.
            // A8: candy buttons, never a text link.
            if (s.status == HubStatus.WON) Capsule("Finish", Icons.Filled.Flag, color = com.wordocious.app.ui.CandyColor.PURPLE) { session.end() }
            else Capsule("End puzzle and see answers", Icons.Filled.Flag) { session.end() }
            Spacer(Modifier.height(6.dp))
        }
    }
}

/** Current entry: 28 sp bold, center letter in the accent; placeholder when empty. Erase-on-reject lives in HubSession.submit. */
@Composable
private fun HubEntryLine(session: HubSession) {
    Box(Modifier.fillMaxWidth().heightIn(min = HUB_ENTRY_H).feedbackAnchor(), contentAlignment = Alignment.Center) {
        if (session.typing.isEmpty()) Text("Tap letters or type", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        else Text(
            buildAnnotatedString {
                for (ch in session.typing) withStyle(SpanStyle(color = if (ch == session.centre) Color(0xFFD97706) else WTheme.text)) { append(ch) }
            },
            fontSize = 28.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, letterSpacing = 1.sp, maxLines = 1, softWrap = false,
        )
    }
}

@Composable
private fun HubFinished(
    session: HubSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state; val won = s.status == HubStatus.WON; val secs = session.displaySeconds
    val context = LocalContext.current
    val title = if (won) (if (s.rank == 9) "Pandemonium, every word" else s.rankName) else "${s.rankName}, below Hubbub"
    val note = listOfNotNull("${session.pangramsFound}/${s.pangrams.size} pangram${if (s.pangrams.size == 1) "" else "s"}", hintsNote(s.hintsUsed)).joinToString(" · ")
    val share = {
        val num = if (session.isDaily) session.dailyNumber else null
        val meta = "${num?.let { "#$it · " } ?: ""}${s.rankName} · ${session.pct}% · ${s.found.size} word${if (s.found.size == 1) "" else "s"} · ${session.pangramsFound} pangram${if (session.pangramsFound == 1) "" else "s"}"
        val text = "Wordocious Hubbub${num?.let { " #$it" } ?: ""} — Rank ${s.rankName} · ${session.pct}% of the maximum · ${s.found.size}/${s.words.size} words · Score ${session.points} pts · wordocious.com/hubbub"
        ShareImage.shareBitmap(context, ShareImage.renderHub(context, s.rankName, session.pct, won, meta), text)
    }
    val words = @Composable {
        Text(if (s.ended) "ALL WORDS" else "FOUND SO FAR · ${s.words.size - s.found.size} MORE TO FIND", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted)
        if (s.ended) Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
            for (row in (s.words + s.bonusFound).sorted().chunked(4)) Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                for (w in row) if (w in s.found || w in s.bonusFound) Chip(session, w) else MissedChip(w)
            }
        } else ChipRows(session, (s.found + s.bonusFound).sorted())
    }
    FinishedScreen(
        header = { HubHeader(session, counts = false) },
        strip = {
            ResultStrip(
                won,
                listOf(hubWordCount(s).let { stripCount("${it.found}/${it.total}", "words", accent = HUB_ACCENT) }, stripTime(secs), stripPoints(session.points)),
                srText = "$title. $note. ${s.points} of ${s.max} game points, ${s.found.size} of ${s.words.size} words, time ${timeText(secs)}, ${session.points} points",
            )
        },
        dock = {
            FinishedDock(
                GameMode.HUB, isDaily = session.isDaily, accent = HUB_ACCENT, onShare = share,
                onOpenDaily = onOpenDaily, onOpenLeaderboard = onOpenLeaderboard, onOpenUnlimited = onOpenUnlimited,
                onNewPuzzle = if (!session.isDaily && isPro && onPlayAgain != null) onPlayAgain else null,
                onOtherGames = onBack,
                more = {
                    Text("$title · $note", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted, textAlign = TextAlign.Center)
                    if (session.isDaily) DailyRankBadge(GameMode.HUB)
                    ScoreBreakdownCard(GameMode.HUB, won, s.guessCount, secs, s.boardsSolved, HUB_TOTAL_BOARDS, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
                },
            )
        },
    ) { _, maxH ->
        // R2: the rank bar, then the word list in the height left — a long list
        // keeps scrolling in place, and "See all" opens the whole thing.
        FinishedListSlot(
            maxHeight = maxH, accent = HUB_ACCENT, seeAllTitle = if (s.ended) "All words" else "Found so far",
            full = { words() },
        ) {
            RankBar(session)
            // Won but not ended: back to the board, the clock resumes.
            if (!s.ended) {
                com.wordocious.app.ui.CandyButton(
                    "Keep going", onClick = { session.showResults = false },
                    color = com.wordocious.app.ui.CandyColor.PEACH, size = com.wordocious.app.ui.CandySize.SMALL,
                )
            }
            words()
        }
    }
}

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"

@Composable
private fun HubOverlay(session: HubSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == HubStatus.WON; val secs = session.displaySeconds
    // Won: the card is a decision (Keep playing / I'm done), so a stray tap must not dismiss it; a loss still taps away.
    PieceOverlay(won, "HUB", HUB_ACCENT, onScrimTap = if (won) ({}) else onDismiss) {
        // Moment lettering (ART_SPEC §6).
        com.wordocious.app.ui.MomentTitle(if (won) com.wordocious.app.ui.MomentArt.VICTORY else com.wordocious.app.ui.MomentArt.SO_CLOSE)
        Text(session.state.rankName, fontSize = 16.sp, fontWeight = FontWeight.Black, color = HUB_ACCENT, fontFamily = Nunito)
        Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            StatBlock("${session.state.found.size}", "WORDS"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
        }
        onPlayAgain?.let { PiecePlayAgain(won, it) }
        if (won) Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            // Keep playing → back to the board, clock resumes. I'm done → End at the recorded time, results.
            // Keep playing is the filled (primary) choice on all three platforms.
            com.wordocious.app.ui.CandyButton("Keep playing", onClick = onDismiss, color = com.wordocious.app.ui.CandyColor.PURPLE, size = com.wordocious.app.ui.CandySize.MEDIUM)
            com.wordocious.app.ui.CandyButton("I'm done", onClick = { session.end(); onDismiss() }, color = com.wordocious.app.ui.CandyColor.PEACH, size = com.wordocious.app.ui.CandySize.MEDIUM)
        }
        else PieceTapHint()
    }
}

/** A2 a soft-number stat. One line always — "35:17" must never break inside its cell (founder, 2026-09-28). */
@Composable
private fun StatBlock(value: String, label: String) = PieceStat(value, label)

/** L the hive tray: purple once won and ended, slate once ended below Hubbub. */
private fun hubTrayState(s: HubState): TrayState = when {
    !s.ended -> TrayState.PLAYING
    s.status == HubStatus.WON -> TrayState.WON
    else -> TrayState.LOST
}

/** The finished hive for the Completed-Today card (founder, 2026-09-29), rebuilt
 *  from the matches row alone: rank line, the 2-3-2 cluster read-only, and every
 *  word found (pangram = all seven letters, starred like the game). */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
internal fun HubFinishedBoard(r: com.wordocious.core.HubReconstruction) {
    val o = r.letters.drop(1).toList()
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("${r.rankName} · ${r.points}/${r.max} pts", fontSize = 13.sp, fontWeight = FontWeight.Black, color = if (r.solved) Color(0xFF7C3AED) else WTheme.textMuted, fontFamily = Nunito)
        // J1 + L the read-only hive: the honeycomb in its tray, purple when solved, slate when not.
        HubHoneycomb(r.letters[0], o, 46.dp, HUB_ACCENT, enabled = false, state = if (r.solved) TrayState.WON else TrayState.LOST, trayPadding = 8.dp) {}
        val words = (r.found + r.bonusFound).distinct().sorted()
        Text("WORDS FOUND", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted)
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            for (w in words) HubChip(w, pangram = w.toSet().size == 7, revealed = w in r.revealed, bonus = hubIsBonus(r.bonusFound, w))
        }
    }
}

/** Every accepted word in the order it was found — the event log carries "+" (core list), "=" (rarer word) and "!" (revealed). */
private fun hubFoundInOrder(s: com.wordocious.core.HubState): List<String> {
    val out = ArrayList<String>()
    for (ev in s.events) if (ev.isNotEmpty() && ev[0] in "+=!") { val w = ev.substring(1); if (w !in out) out.add(w) }
    return out
}
