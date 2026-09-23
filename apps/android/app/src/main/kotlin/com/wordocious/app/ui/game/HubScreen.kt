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
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
// HubView.swift. Seven letters, one required centre, words of 4+ letters.
// Finalises ONCE (Hubbub = win, End below it = loss); play continues after the
// win and each later rank-up goes through GameResultsService.improve.

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
    var xpResult by mutableStateOf<GameResultsService.XpResult?>(null)
    var restoredFinished = false
        private set
    /** Fires once when the game first finalises (the overlay). */
    var onFinalised: (() -> Unit)? = null

    private var startMs = System.currentTimeMillis()
    private var restoredElapsedMs = 0L
    private var guidePauseStart: Long? = null
    private var recordedRank = -1

    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, ((System.currentTimeMillis() - startMs) / 1000).toInt())
    val dailyNumber get() = hubDailyNumber(todayLocalDate())
    val centre get() = state.centre
    val pct get() = if (state.max > 0) state.points * 100 / state.max else 0
    val pangramsFound get() = state.found.count { it in state.pangrams }
    val points: Int get() = com.wordocious.app.data.DailyScoring.breakdown(
        GameMode.HUB.name, state.status == HubStatus.WON, state.guessCount, elapsed, state.boardsSolved, HUB_TOTAL_BOARDS, state.hintsUsed,
    ).total.toInt()

    init { restore() }

    fun beginTimer() { startMs = System.currentTimeMillis() - restoredElapsedMs }
    fun pauseForGuide() { if (guidePauseStart == null && !state.ended) guidePauseStart = System.currentTimeMillis() }
    fun resumeFromGuide() { guidePauseStart?.let { startMs += System.currentTimeMillis() - it; guidePauseStart = null } }

    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long, val recordedRank: Int,
        val id: String, val letters: String, val words: List<String>, val bonus: List<String>, val pangrams: List<String>, val max: Int,
        val found: List<String>, val bonusFound: List<String>, val revealed: List<String>, val hinted: List<String>,
        val points: Int, val hintsUsed: Int, val events: List<String>, val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
    )
    private val json = Json { ignoreUnknownKeys = true }
    private val storageKey get() = if (isDaily) "hub-save-daily" else "hub-save-$seed"

    private fun persist() {
        val s = state
        val dto = SaveDto(seed, todayLocalDate(), elapsed, System.currentTimeMillis(), recordedRank,
            s.id, s.letters, s.words, s.bonus, s.pangrams, s.max, s.found, s.bonusFound, s.revealed, s.hinted,
            s.points, s.hintsUsed, s.events, s.status.key, s.ended, s.startTime, s.endTime)
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
        if (status != HubStatus.PLAYING) restoredFinished = true
        if (dto.ended) { finalTimeSeconds = dto.elapsed; showResults = true }
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
        if (r != null) { toast = rejectCopy(r); SoundManager.playInvalid() }
        else {
            typing = ""
            if (word in state.words) { SoundManager.playSuccess(); toast = if (hubIsPangram(word, state.letters)) "Pangram! +${hubWordScore(word, state.letters)}" else "+${hubWordScore(word, state.letters)}" }
            else toast = "Bonus word — accepted, no points"
        }
    }
    fun hintStart() = dispatch(HubAction.HintStart)
    fun hintReveal() = dispatch(HubAction.HintReveal)
    fun end() { dispatch(HubAction.End); finalTimeSeconds = elapsed; showResults = true }

    private fun rejectCopy(r: HubReject) = when (r) {
        HubReject.ENDED -> "This puzzle is finished"; HubReject.SHORT -> "Four letters or more"; HubReject.CENTRE -> "Must use the centre letter"
        HubReject.LETTERS -> "Only the seven letters"; HubReject.FOUND -> "Already found"; HubReject.NOTWORD -> "Not in word list"
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
        val s = state; val won = s.status == HubStatus.WON; val secs = elapsed
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
        if (!isDaily) return
        val s = state; val secs = elapsed
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
    LaunchedEffect(session.toast) { if (session.toast != null) { kotlinx.coroutines.delay(1400); session.toast = null } }
    androidx.activity.compose.BackHandler { onBack() }

    Box(Modifier.fillMaxSize().background(WTheme.bg).statusBarsPadding()) {
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
        CornerHelpButton(HUB_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
        if (showGuide) GuideSheet(mode = GameMode.HUB, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@Composable
private fun HubHeader(session: HubSession) {
    val tick by produceState(0, session.state.ended) { while (!session.state.ended) { kotlinx.coroutines.delay(1000); value++ } }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        Text("HUBBUB", fontSize = 24.sp, fontWeight = FontWeight.Black, color = HUB_ACCENT, fontFamily = Nunito)
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
private fun LetterTile(ch: Char, centre: Boolean, enabled: Boolean, onTap: () -> Unit) {
    Box(
        Modifier.size(58.dp).clip(RoundedCornerShape(8.dp)).background(if (centre) HUB_ACCENT else WTheme.surface)
            .border(2.dp, if (centre) HUB_ACCENT else WTheme.border, RoundedCornerShape(8.dp))
            .then(if (enabled) Modifier.pressScale { onTap() } else Modifier),
        contentAlignment = Alignment.Center,
    ) { Text(ch.toString(), fontSize = 26.sp, fontWeight = FontWeight.Black, color = if (centre) Color.White else WTheme.text, fontFamily = Nunito) }
}

@Composable
private fun Chip(session: HubSession, w: String, dim: Boolean = false) {
    val s = session.state; val pangram = w in s.pangrams; val revealed = w in s.revealed
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

@Composable
private fun HubBoard(session: HubSession) {
    val s = session.state
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            RankBar(session)
            Row(Modifier.heightIn(min = 44.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (session.typing.isEmpty()) Text("Tap letters or type", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                else for (ch in session.typing) Box(Modifier.size(34.dp, 42.dp).clip(RoundedCornerShape(6.dp)).background(WTheme.surface).border(2.dp, WTheme.border, RoundedCornerShape(6.dp)), contentAlignment = Alignment.Center) {
                    Text(ch.toString(), fontSize = 18.sp, fontWeight = FontWeight.Black, color = if (ch == session.centre) HUB_ACCENT else WTheme.text, fontFamily = Nunito)
                }
            }
            val o = session.outer.toList() + List(maxOf(0, 6 - session.outer.size)) { ' ' }
            val enabled = !s.ended
            Column(verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { LetterTile(o[0], false, enabled) { session.type(o[0]) }; LetterTile(o[1], false, enabled) { session.type(o[1]) } }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { LetterTile(o[2], false, enabled) { session.type(o[2]) }; LetterTile(session.centre, true, enabled) { session.type(session.centre) }; LetterTile(o[3], false, enabled) { session.type(o[3]) } }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { LetterTile(o[4], false, enabled) { session.type(o[4]) }; LetterTile(o[5], false, enabled) { session.type(o[5]) } }
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
            Text("${s.found.size} OF ${s.words.size} WORDS" + (if (s.bonusFound.isEmpty()) "" else " · ${s.bonusFound.size} BONUS"), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = WTheme.textMuted)
            ChipRows(session, s.found.sorted())
            if (s.bonusFound.isNotEmpty()) ChipRows(session, s.bonusFound.sorted(), dim = true)
        }
        if (s.status == HubStatus.WON) Text("See results", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HUB_ACCENT, modifier = Modifier.clickableNoRipple { session.showResults = true })
        else Row(Modifier.clickableNoRipple { session.end() }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(Icons.Filled.Flag, null, tint = WTheme.textMuted, modifier = Modifier.size(12.dp)); Text("End puzzle and see answers", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Spacer(Modifier.height(6.dp))
    }
}

@Composable
private fun HubResults(
    session: HubSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state; val won = s.status == HubStatus.WON; val secs = session.elapsed
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
            for (row in s.words.sorted().chunked(4)) Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                for (w in row) if (w in s.found) Chip(session, w) else Text(w, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF9CA3AF),
                    modifier = Modifier.clip(CircleShape).background(Color(0xFFF9FAFB)).border(1.dp, Color(0xFFE5E7EB), CircleShape).padding(horizontal = 8.dp, vertical = 3.dp))
            }
        } else ChipRows(session, s.found.sorted())
        if (session.isDaily) DailyRankBadge(GameMode.HUB)
        ScoreBreakdownCard(GameMode.HUB, won, s.guessCount, secs, s.boardsSolved, HUB_TOTAL_BOARDS, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.HUB, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
    }
}

@Composable
private fun ResultAction(icon: ImageVector, label: String, color: Color, onClick: () -> Unit) {
    Row(Modifier.clickableNoRipple(onClick), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(icon, null, tint = color, modifier = Modifier.size(14.dp)); Text(label, fontSize = 13.sp, fontWeight = FontWeight.Black, color = color)
    }
}

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"

@Composable
private fun HubOverlay(session: HubSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == HubStatus.WON; val secs = session.elapsed
    Box(Modifier.fillMaxSize().background(Color(0xFF18182E).copy(alpha = 0.6f)).clickableNoRipple(onDismiss), contentAlignment = Alignment.Center) {
        Column(Modifier.padding(horizontal = 24.dp).widthIn(max = 380.dp).clip(RoundedCornerShape(16.dp)).background(WTheme.surface).border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.fillMaxWidth().height(6.dp).background(androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))))
            Column(Modifier.padding(horizontal = 20.dp, vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(if (won) "VICTORY!" else "GAME OVER", fontSize = 36.sp, fontWeight = FontWeight.Black,
                    style = if (won) androidx.compose.ui.text.TextStyle(fontFamily = Nunito, brush = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))) else androidx.compose.ui.text.TextStyle(fontFamily = Nunito, color = Color(0xFFF87171)))
                Text(session.state.rankName, fontSize = 16.sp, fontWeight = FontWeight.Black, color = HUB_ACCENT, fontFamily = Nunito)
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    StatBlock("${session.state.found.size}", "WORDS"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
                }
                onPlayAgain?.let {
                    Text(if (won) "Play again" else "Try again", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White,
                        modifier = Modifier.clip(CircleShape).background(if (won) androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899))) else androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFF87171), Color(0xFFF87171)))).clickableNoRipple(it).padding(horizontal = 28.dp, vertical = 10.dp))
                }
                Text(if (won) "Keep going for a higher rank" else "Tap anywhere to continue", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFC4B5FD))
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
