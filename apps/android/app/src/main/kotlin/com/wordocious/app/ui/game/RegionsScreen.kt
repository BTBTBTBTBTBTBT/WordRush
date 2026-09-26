package com.wordocious.app.ui.game

import android.app.Activity
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
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
import com.wordocious.core.GameMode
import com.wordocious.core.REGIONS_MAX_MISTAKES
import com.wordocious.core.RegionsAction
import com.wordocious.core.RegionsSnapshot
import com.wordocious.core.RegionsState
import com.wordocious.core.RegionsStatus
import com.wordocious.core.generateRegions
import com.wordocious.core.regionsDailyNumber
import com.wordocious.core.regionsMatchRow
import com.wordocious.core.regionsReduce
import com.wordocious.core.regionsRemaining
import com.wordocious.core.regionsSizeForDay
import com.wordocious.core.regionsSizeForSeed
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Starsweep (More Games §18b) — the Android twin of components/regions/* and
// RegionsView.swift. One star in every row, column and color region, none
// touching. Daily 7 × 7 Monday–Wednesday, 8 × 8 Thursday–Sunday; Pro Unlimited
// picks 7 / 8 / 9. Tap = cross out, again = star, again = clear. A wrong star
// is a mistake, the third loses; a hint places one correct star for a score
// cost, never a mistake. guess_count = mistakes + 1.
//
// Wording (§18b guard): always "Starsweep", one word; win copy "Board cleared";
// never "Sweep!" — Starsweep does not count toward the Daily Sweep.

private val REGIONS_ACCENT = Color(0xFFCA8A04)
private val REGIONS_SIZE_LABEL = mapOf(7 to "7 × 7", 8 to "8 × 8", 9 to "9 × 9")
private val REGIONS_SIZES = listOf(7, 8, 9)

/** The soft region tints — the same nine the web board and share card use. */
val REGIONS_TINTS = listOf(
    Color(0xFFEDE9FE), Color(0xFFD1FAE5), Color(0xFFE0F2FE), Color(0xFFFCE7F3), Color(0xFFFEF9C3),
    Color(0xFFCCFBF1), Color(0xFFFFEDD5), Color(0xFFECFCCB), Color(0xFFE2E8F0),
)

// ── Session ─────────────────────────────────────────────────────────────────

class RegionsSession(val seed: String, val isDaily: Boolean) {
    var state by mutableStateOf(
        RegionsState.create(
            run {
                val n = if (isDaily) regionsSizeForDay(todayLocalDate()) else regionsSizeForSeed(seed)
                generateRegions(seed, n) ?: generateRegions("$seed-fallback", 7)!!
            },
            System.currentTimeMillis(),
        ),
    )
        private set
    var focused by mutableStateOf<Int?>(null)
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

    val isFinished get() = state.status != RegionsStatus.PLAYING
    val n get() = state.n
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, ((System.currentTimeMillis() - startMs) / 1000).toInt())
    val dailyNumber get() = regionsDailyNumber(todayLocalDate())
    val remaining get() = regionsRemaining(state)
    val sizeLabel get() = REGIONS_SIZE_LABEL[n] ?: "$n × $n"

    // Declared BEFORE init: restore() runs inside init and needs it. Declared below the
    // block it was null during construction, decode threw inside runCatching and every
    // save was silently ignored on the next open (Doug, Android production, 2026-09-25).
    private val json = Json { ignoreUnknownKeys = true }

    init { restore() }

    fun beginTimer() { startMs = System.currentTimeMillis() - restoredElapsedMs }
    fun pauseForGuide() { if (guidePauseStart == null && !isFinished) guidePauseStart = System.currentTimeMillis() }
    fun resumeFromGuide() { guidePauseStart?.let { startMs += System.currentTimeMillis() - it; guidePauseStart = null } }

    // Persistence (mirrors components/regions/persistence.ts).
    @Serializable private data class SnapDto(val board: String, val hintMask: String, val wrongMask: String)
    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
        val n: Int, val regions: String, val solution: String,
        val board: String, val hintMask: String, val wrongMask: String,
        val mistakes: Int, val hintsUsed: Int, val autoCross: Boolean,
        val status: String, val history: List<SnapDto>, val startTime: Long, val endTime: Long?,
    )
    private val storageKey get() = if (isDaily) "regions-save-daily" else "regions-save-$seed"

    private fun persist() {
        val s = state
        val dto = SaveDto(
            seed, todayLocalDate(), elapsed, System.currentTimeMillis(),
            s.n, s.regions, s.solution, s.board, s.hintMask, s.wrongMask,
            s.mistakes, s.hintsUsed, s.autoCross, s.status.key,
            s.history.map { SnapDto(it.board, it.hintMask, it.wrongMask) }, s.startTime, s.endTime,
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
        val status = RegionsStatus.values().firstOrNull { it.key == dto.status } ?: RegionsStatus.PLAYING
        state = RegionsState(
            seed, dto.n, dto.regions, dto.solution, dto.board, dto.hintMask, dto.wrongMask,
            dto.mistakes, dto.hintsUsed, dto.autoCross, status,
            dto.history.map { RegionsSnapshot(it.board, it.hintMask, it.wrongMask) }, dto.startTime, dto.endTime,
        )
        restoredElapsedMs = dto.elapsed * 1000L
        if (status != RegionsStatus.PLAYING) { finalTimeSeconds = dto.elapsed; recorded = true; restoredFinished = true }
    }

    // Actions
    private fun dispatch(a: RegionsAction, onFinished: () -> Unit) {
        if (isFinished) return
        state = regionsReduce(state, a, System.currentTimeMillis())
        if (isFinished) onFinished()
        persist()
    }

    /** A tap cycles the cell (empty → × → star → empty) and makes it the focus for Erase/Hint. */
    fun tap(cell: Int, onFinished: () -> Unit) {
        if (isFinished || cell !in 0 until n * n) return
        focused = cell
        val cur = state.board[cell]
        if (cur == '*' && state.hintMask[cell] == '1') { SoundManager.playInvalid(); return }
        val placingWrong = cur == 'x' && (state.solution[cell / n] - '0') != cell % n
        dispatch(RegionsAction.Tap(cell), onFinished)
        if (placingWrong && !isFinished) SoundManager.playInvalid() else SoundManager.playKeyTap()
    }
    fun erase(onFinished: () -> Unit) { focused?.let { dispatch(RegionsAction.Erase(it), onFinished) } }
    fun undo(onFinished: () -> Unit) = dispatch(RegionsAction.Undo, onFinished)
    fun toggleAutoCross(onFinished: () -> Unit) = dispatch(RegionsAction.SetAutoCross(!state.autoCross), onFinished)
    fun hint(onFinished: () -> Unit) = dispatch(RegionsAction.Hint(focused), onFinished)

    val canErase: Boolean
        get() {
            val f = focused ?: return false
            if (f !in 0 until n * n) return false
            val cur = state.board[f]
            return cur != '.' && !(cur == '*' && state.hintMask[f] == '1')
        }

    /** Freeze the clock, play the sound, record ONCE. */
    suspend fun finish() {
        finalTimeSeconds = elapsed
        if (state.status == RegionsStatus.WON) SoundManager.playSuccess() else SoundManager.playGameOver()
        if (recorded) return
        recorded = true
        val won = state.status == RegionsStatus.WON
        val gc = state.mistakes + 1
        val (solutions, guesses) = regionsMatchRow(state)
        val xp = GameResultsService.record(
            gameMode = GameMode.REGIONS, won = won, guessCount = gc, timeSeconds = elapsed,
            boardsSolved = if (won) 1 else 0, totalBoards = 1, seed = seed,
            solutions = solutions, guesses = guesses, hintsUsed = state.hintsUsed,
        )
        xpResult = xp
        if (isDaily) DailyCompletionsService.noteCompletion(GameMode.REGIONS.name, won, gc, elapsed)
    }
}

// ── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun RegionsScreen(
    seed: String,
    isDaily: Boolean,
    onBack: () -> Unit,
    /** Pro Unlimited "Play Again" / size switch — MainScreen mints a fresh seed carrying the size. */
    onPlayAgain: ((Int) -> Unit)? = null,
    onOpenDaily: (GameMode) -> Unit = {},
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val session = remember(seed) { RegionsSession(seed, isDaily) }
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
    LaunchedEffect(session.toast) { if (session.toast != null) { kotlinx.coroutines.delay(1200); session.toast = null } }

    val onFinished: () -> Unit = {
        scope.launch {
            session.finish()
            if (!session.restoredFinished) showOverlay = true
            if (session.state.status == RegionsStatus.WON) {
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
                RegionsHeader(session)
                RegionsBoard(session.state, focused = null, revealSolution = session.state.status == RegionsStatus.LOST) {}
                RegionsResult(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
            }
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                RegionsHeader(session)
                if (!isDaily && isPro && onPlayAgain != null) SizePicker(session.n) { onPlayAgain(it) }
                Spacer(Modifier.weight(1f))
                RegionsBoard(session.state, session.focused, revealSolution = false) { session.tap(it, onFinished) }
                Spacer(Modifier.weight(1f))
                val remaining = session.remaining
                Text(
                    if (remaining == session.n && session.state.history.isEmpty()) "Tap a cell: × first, then a star" else "$remaining star${if (remaining == 1) "" else "s"} left",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
                RegionsPad(session, onFinished)
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
        if (showOverlay) RegionsOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain(session.n) } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(REGIONS_ACCENT, onBack) }
        CornerHelpButton(REGIONS_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
        if (showGuide) GuideSheet(mode = GameMode.REGIONS, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@Composable
private fun RegionsHeader(session: RegionsSession) {
    val tick by produceState(0, session.isFinished) {
        while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ }
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        Text("STARSWEEP", fontSize = 24.sp, fontWeight = FontWeight.Black, color = REGIONS_ACCENT, fontFamily = Nunito)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text(session.sizeLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Mistakes", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                repeat(REGIONS_MAX_MISTAKES) { i ->
                    Box(Modifier.size(8.dp).clip(CircleShape).background(if (i < session.state.mistakes) Color(0xFFDC2626) else WTheme.borderLight))
                }
            }
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

@Composable
private fun SizePicker(current: Int, onPick: (Int) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        REGIONS_SIZES.forEach { n ->
            val active = n == current
            Text(
                REGIONS_SIZE_LABEL[n] ?: "$n", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                color = if (active) Color.White else REGIONS_ACCENT,
                modifier = Modifier.clip(CircleShape)
                    .background(if (active) REGIONS_ACCENT else Color.Transparent)
                    .border(1.5.dp, REGIONS_ACCENT.copy(alpha = if (active) 1f else 0.35f), CircleShape)
                    .clickableNoRipple { if (!active) onPick(n) }
                    .padding(horizontal = 12.dp, vertical = 5.dp),
            )
        }
    }
}

// ── Board ───────────────────────────────────────────────────────────────────

/** ONE continuous ruled board like the Sudoku board: heavy rules between
 *  regions, hairlines within a region, regions washed in soft tints (the heavy
 *  borders carry the shape, never color alone). Star in the dark text color,
 *  wrong star red, hint star violet, cross-out a small muted ×. The focused
 *  cell wears a thin accent inset ring. */
@Composable
fun RegionsBoard(state: RegionsState, focused: Int?, revealSolution: Boolean, onTap: (Int) -> Unit) {
    val n = state.n
    val rule = Color(0xFF4C1D95).copy(alpha = 0.22f); val heavy = Color(0xFF4C1D95)
    val hint = Color(0xFF8B5CF6); val wrong = Color(0xFFDC2626); val cross = Color(0xFF6B7280)

    Box(
        Modifier.fillMaxWidth().widthIn(max = 420.dp).aspectRatio(1f)
            .clip(RoundedCornerShape(14.dp)).background(WTheme.surface)
            .border(2.5.dp, heavy, RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.fillMaxSize()) {
            for (r in 0 until n) {
                Row(Modifier.weight(1f).fillMaxWidth()) {
                    for (c in 0 until n) {
                        val i = r * n + c
                        val g = state.regions[i] - '0'
                        val mark = state.board[i]
                        val isWrong = state.wrongMask[i] == '1'
                        val hinted = state.hintMask[i] == '1'
                        val missing = revealSolution && mark != '*' && (state.solution[r] - '0') == c
                        val starColor = when { isWrong -> wrong; hinted -> hint; else -> WTheme.text }
                        Box(
                            Modifier.weight(1f).fillMaxSize().background(REGIONS_TINTS[g % REGIONS_TINTS.size])
                                .then(if (i == focused) Modifier.padding(1.dp).border(2.dp, REGIONS_ACCENT) else Modifier)
                                .clickableNoRipple { onTap(i) },
                            contentAlignment = Alignment.Center,
                        ) {
                            when {
                                mark == '*' -> Icon(Icons.Filled.Star, null, tint = starColor, modifier = Modifier.fillMaxSize(0.62f))
                                mark == 'x' -> Icon(Icons.Filled.Close, null, tint = cross, modifier = Modifier.fillMaxSize(0.42f))
                                missing -> Icon(Icons.Filled.Star, null, tint = WTheme.textMuted, modifier = Modifier.fillMaxSize(0.62f).alpha(0.55f))
                            }
                        }
                    }
                }
            }
        }
        // Rules — hairline within a region, heavy where the region changes.
        Canvas(Modifier.fillMaxSize()) {
            val side = size.width
            val cell = side / n.toFloat()
            val hairline = 1.dp.toPx(); val heavyW = 2.5.dp.toPx()
            for (r in 0 until n) for (c in 0 until n) {
                val i = r * n + c
                if (c < n - 1) {
                    val hv = state.regions[i + 1] != state.regions[i]
                    val w = if (hv) heavyW else hairline
                    drawRect(if (hv) heavy else rule, topLeft = Offset((c + 1) * cell - w / 2, r * cell), size = Size(w, cell))
                }
                if (r < n - 1) {
                    val hv = state.regions[i + n] != state.regions[i]
                    val w = if (hv) heavyW else hairline
                    drawRect(if (hv) heavy else rule, topLeft = Offset(c * cell, (r + 1) * cell - w / 2), size = Size(cell, w))
                }
            }
        }
    }
}

// ── Pad ─────────────────────────────────────────────────────────────────────

/** Action row — Undo · Erase · Auto-cross · Hint, each with its icon (§19).
 *  Auto-cross is a toggle: fixed label, state shown by filling with the accent. */
@Composable
private fun RegionsPad(session: RegionsSession, onFinished: () -> Unit) {
    val s = session.state
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(horizontal = 2.dp)) {
        Capsule("Undo", Icons.AutoMirrored.Filled.Undo, dim = s.history.isEmpty()) { session.undo(onFinished) }
        Capsule("Erase", Icons.AutoMirrored.Filled.Backspace, dim = !session.canErase) { session.erase(onFinished) }
        Capsule("Auto-cross", Icons.Filled.Close, active = s.autoCross) { session.toggleAutoCross(onFinished) }
        Capsule(if (s.hintsUsed > 0) "Hint · ${s.hintsUsed}" else "Hint", Icons.Filled.Lightbulb) { session.hint(onFinished) }
    }
}

@Composable
private fun Capsule(label: String, icon: ImageVector, active: Boolean = false, dim: Boolean = false, onClick: () -> Unit) {
    val fg = if (dim) WTheme.textMuted.copy(alpha = 0.5f) else if (active) Color.White else REGIONS_ACCENT
    Row(
        Modifier.clip(CircleShape)
            .background(if (active) REGIONS_ACCENT else if (dim) Color.Transparent else REGIONS_ACCENT.copy(alpha = 0.05f))
            .border(1.5.dp, if (dim) WTheme.border else if (active) REGIONS_ACCENT else REGIONS_ACCENT.copy(alpha = 0.4f), CircleShape)
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
private fun RegionsResult(
    session: RegionsSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: ((Int) -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == RegionsStatus.WON
    val secs = session.elapsed
    val remaining = session.remaining
    val context = LocalContext.current
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 12.dp)) {
        Text(if (won) "Board cleared" else "Out of mistakes", fontSize = 20.sp, fontWeight = FontWeight.Black,
            color = if (won) Color(0xFF7C3AED) else Color(0xFFEF4444), fontFamily = Nunito)
        Text(
            if (won) "${formatGuessStat("mistakes", 1, s.mistakes + 1)} · ${timeText(secs)}" + (if (s.hintsUsed > 0) " · ${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}" else "")
            else "$remaining star${if (remaining == 1) "" else "s"} left · ${timeText(secs)}",
            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            ResultAction(Icons.Filled.Home, "Home", REGIONS_ACCENT, onBack)
            ResultAction(Icons.Filled.Share, "Share", REGIONS_ACCENT) {
                val num = if (session.isDaily) session.dailyNumber else null
                val meta = "${num?.let { "#$it · " } ?: ""}${session.sizeLabel} · ${if (won) "${s.mistakes} mistake${if (s.mistakes == 1) "" else "s"}" else "Out of mistakes"} · ${timeText(secs)}"
                // Caption names each figure (founder, 2026-09-22): score, time, mistakes.
                val pts = com.wordocious.app.data.DailyScoring.breakdown(GameMode.REGIONS.name, won, s.mistakes + 1, secs, if (won) 1 else 0, 1, s.hintsUsed).total.toInt()
                val text = "Wordocious Starsweep${num?.let { " #$it" } ?: ""} — Score $pts pts · Time ${timeText(secs)} · ${if (won) "${s.mistakes} mistake${if (s.mistakes == 1) "" else "s"}" else "Out of mistakes"} · wordocious.com/starsweep"
                val bmp = ShareImage.renderRegions(context, s.n, s.regions, s.board, s.hintMask, won, meta)
                ShareImage.shareBitmap(context, bmp, text)
            }
            if (!session.isDaily && isPro && onPlayAgain != null) ResultAction(Icons.Filled.Refresh, "Play Again", Color(0xFFD97706)) { onPlayAgain(s.n) }
        }
        if (session.isDaily) DailyRankBadge(GameMode.REGIONS)
        ScoreBreakdownCard(GameMode.REGIONS, won, s.mistakes + 1, secs, if (won) 1 else 0, 1, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.REGIONS, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
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

/** Victory / game-over card (VictoryOverlay's look for a non-word board). */
@Composable
private fun RegionsOverlay(session: RegionsSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == RegionsStatus.WON
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
                val pts = com.wordocious.app.data.DailyScoring.breakdown(GameMode.REGIONS.name, won, session.state.mistakes + 1, secs, if (won) 1 else 0, 1, session.state.hintsUsed).total.toInt()
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    StatBlock("${session.state.mistakes}", "MISTAKES"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(pts), "POINTS")
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
