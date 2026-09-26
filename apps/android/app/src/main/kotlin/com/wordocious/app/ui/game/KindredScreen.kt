package com.wordocious.app.ui.game

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Label
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Shuffle
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
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
import com.wordocious.app.ui.pressScale
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GROUPS_DAILY_EPOCH
import com.wordocious.core.GROUPS_MAX_MISTAKES
import com.wordocious.core.GROUPS_TOTAL_BOARDS
import com.wordocious.core.GameMode
import com.wordocious.core.GroupsAction
import com.wordocious.core.GroupsBank
import com.wordocious.core.GroupsGroup
import com.wordocious.core.GroupsPuzzle
import com.wordocious.core.GroupsResult
import com.wordocious.core.GroupsState
import com.wordocious.core.GroupsStatus
import com.wordocious.core.HolidayTable
import com.wordocious.core.createGroupsState
import com.wordocious.core.groupsBoardsSolved
import com.wordocious.core.groupsDailyNumber
import com.wordocious.core.groupsGuessCount
import com.wordocious.core.groupsLabelTarget
import com.wordocious.core.groupsMatchRow
import com.wordocious.core.groupsPairTarget
import com.wordocious.core.groupsPuzzleForDay
import com.wordocious.core.groupsPuzzleForSeed
import com.wordocious.core.groupsReduce
import com.wordocious.core.groupsUnsolved
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

// Kindred (More Games §14) — the Android twin of components/groups/* and
// KindredView.swift. Sixteen words hide four groups of four; find them all
// with at most four mistakes. Submit four → a group locks and becomes a bar
// with one to four pips (tier), three-of-a-kind reads "One away", a repeated
// set is free. Name a category (1 hint) / Show a pair (2 hints) never cost a
// mistake. guess_count = submissions on a win, groups found + 4 on a loss.

private val GROUPS_ACCENT = Color(0xFF9F1239)
private val PAIR_RING = Color(0xFF8B5CF6)

/** Tier ramp (§14): one hue, four lightnesses — plus pips, never color alone. */
private data class TierStyle(val bg: Color, val fg: Color)
private val TIER_STYLE = mapOf(
    1 to TierStyle(Color(0xFFDDD6FE), Color(0xFF3B0764)),
    2 to TierStyle(Color(0xFFA78BFA), Color(0xFF1A1A2E)),
    3 to TierStyle(Color(0xFF7C3AED), Color(0xFFFFFFFF)),
    4 to TierStyle(Color(0xFF1A1A2E), Color(0xFFFFFFFF)),
)
private fun tierStyle(tier: Int) = TIER_STYLE[tier] ?: TIER_STYLE[1]!!

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

class KindredSession(val seed: String, val isDaily: Boolean) {
    private val bank: GroupsBank = GroupsBank.bundled ?: GroupsBank(1, GROUPS_DAILY_EPOCH, emptyList(), emptyList())

    var state by mutableStateOf(
        createGroupsState(
            run {
                val fallback = GroupsPuzzle(
                    "none",
                    listOf(
                        GroupsGroup(1, "Colors", listOf("RED", "BLUE", "GREEN", "GOLD")),
                        GroupsGroup(2, "Card games", listOf("POKER", "BRIDGE", "RUMMY", "HEARTS")),
                        GroupsGroup(3, "___ Ring", listOf("KEY", "EAR", "BOXING", "ONION")),
                        GroupsGroup(4, "Hidden numbers", listOf("STONE", "OFTEN", "CANINE", "WEIGHT")),
                    ),
                )
                (if (isDaily) groupsPuzzleForDay(bank, todayLocalDate(), HolidayTable.bundled) else groupsPuzzleForSeed(bank, seed)) ?: fallback
            },
            seed, System.currentTimeMillis(),
        ),
    )
        private set
    var toast by mutableStateOf<String?>(null)
    /** Bumps on every wrong submission so the grid shakes once per miss. */
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

    val isFinished get() = state.status != GroupsStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, ((System.currentTimeMillis() - startMs) / 1000).toInt())
    val dailyNumber get() = groupsDailyNumber(todayLocalDate())
    /** The holiday this puzzle was drawn from (its display title), or null for an everyday puzzle. */
    val holidayTitle: String? get() {
        val id = state.id
        val key = bank.holiday?.entries?.firstOrNull { (_, list) -> list.any { it.id == id } }?.key ?: return null
        return HOLIDAY_TITLES[key]
    }
    val mistakesLabel: String get() = "${state.mistakes} mistake${if (state.mistakes == 1) "" else "s"}"
    val groupsLabel: String get() = "${state.solved.size}/$GROUPS_TOTAL_BOARDS groups"
    val points: Int get() = DailyScoring.breakdown(
        GameMode.GROUPS.name, state.status == GroupsStatus.WON, groupsGuessCount(state), elapsed,
        groupsBoardsSolved(state), GROUPS_TOTAL_BOARDS, state.hintsUsed,
    ).total.toInt()

    // Declared BEFORE init: restore() runs inside init and needs it. Declared below the
    // block it was null during construction, decode threw inside runCatching and every
    // save was silently ignored on the next open (Doug, Android production, 2026-09-25).
    private val json = Json { ignoreUnknownKeys = true }

    init { restore() }

    fun beginTimer() { startMs = System.currentTimeMillis() - restoredElapsedMs }
    fun pauseForGuide() { if (guidePauseStart == null && !isFinished) guidePauseStart = System.currentTimeMillis() }
    fun resumeFromGuide() { guidePauseStart?.let { startMs += System.currentTimeMillis() - it; guidePauseStart = null } }

    @Serializable private data class SaveDto(
        val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
        val id: String, val groups: List<GroupsGroup>, val tiles: List<String>, val solved: List<GroupsGroup>,
        val selected: List<String>, val mistakes: Int, val submissions: Int, val hintsUsed: Int,
        val revealedTiers: List<Int>, val pairs: List<List<String>>, val wrongSets: List<String>, val shuffles: Int,
        val lastResult: String?, val events: List<String>,
        val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
    )
    private val storageKey get() = if (isDaily) "groups-save-daily" else "groups-save-$seed"

    private fun persist() {
        val s = state
        val dto = SaveDto(
            seed, todayLocalDate(), elapsed, System.currentTimeMillis(),
            s.id, s.groups, s.tiles, s.solved, s.selected, s.mistakes, s.submissions, s.hintsUsed,
            s.revealedTiers, s.pairs, s.wrongSets, s.shuffles, s.lastResult?.key, s.events,
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
        if (dto.groups.size != GROUPS_TOTAL_BOARDS) return
        val status = GroupsStatus.values().firstOrNull { it.key == dto.status } ?: GroupsStatus.PLAYING
        val lastResult = dto.lastResult?.let { k -> GroupsResult.values().firstOrNull { it.key == k } }
        state = GroupsState(
            seed, dto.id, dto.groups, dto.tiles, dto.solved, dto.selected, dto.mistakes, dto.submissions, dto.hintsUsed,
            dto.revealedTiers, dto.pairs, dto.wrongSets, dto.shuffles, lastResult, dto.events,
            status, dto.ended, dto.startTime, dto.endTime,
        )
        restoredElapsedMs = dto.elapsed * 1000L
        if (status != GroupsStatus.PLAYING) { finalTimeSeconds = dto.elapsed; recorded = true; restoredFinished = true }
    }

    private fun dispatch(a: GroupsAction, onFinished: () -> Unit = {}) {
        if (isFinished) return
        state = groupsReduce(state, a, System.currentTimeMillis())
        if (isFinished) onFinished()
        persist()
    }

    fun toggle(word: String) { if (!isFinished) { SoundManager.playKeyTap(); dispatch(GroupsAction.Toggle(word)) } }
    fun deselect() { if (!isFinished && state.selected.isNotEmpty()) { SoundManager.playKeyTap(); dispatch(GroupsAction.Deselect) } }
    fun shuffle() { if (!isFinished) { SoundManager.playKeyTap(); dispatch(GroupsAction.Shuffle) } }
    fun submit(onFinished: () -> Unit) {
        if (isFinished) return
        dispatch(GroupsAction.Submit, onFinished)
        when (state.lastResult) {
            GroupsResult.CORRECT -> if (!isFinished) SoundManager.playSuccess()
            GroupsResult.ONEAWAY -> { flash("One away…"); SoundManager.playInvalid(); shakeKey++ }
            GroupsResult.WRONG -> { flash("Not a group"); SoundManager.playInvalid(); shakeKey++ }
            GroupsResult.REPEAT -> flash("Already tried that set")
            GroupsResult.SHORT -> flash("Pick four words")
            null -> {}
        }
    }
    fun hintLabel() {
        if (isFinished) return
        if (groupsLabelTarget(state) != null) dispatch(GroupsAction.HintLabel) else flash("Every category is already named")
    }
    fun hintPair() {
        if (isFinished) return
        if (groupsPairTarget(state) != null) dispatch(GroupsAction.HintPair) else flash("Every group already has a pair shown")
    }

    suspend fun finish() {
        finalTimeSeconds = elapsed
        if (state.status == GroupsStatus.WON) SoundManager.playSuccess() else SoundManager.playGameOver()
        if (recorded) return
        recorded = true
        val won = state.status == GroupsStatus.WON
        val gc = groupsGuessCount(state)
        val (solutions, guesses) = groupsMatchRow(state)
        val xp = GameResultsService.record(
            gameMode = GameMode.GROUPS, won = won, guessCount = gc, timeSeconds = elapsed,
            boardsSolved = groupsBoardsSolved(state), totalBoards = GROUPS_TOTAL_BOARDS, seed = seed,
            solutions = solutions, guesses = guesses, hintsUsed = state.hintsUsed,
        )
        xpResult = xp
        if (isDaily) DailyCompletionsService.noteCompletion(GameMode.GROUPS.name, won, gc, elapsed)
    }

    private fun flash(m: String) { toast = m }
}

// ── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun KindredScreen(
    seed: String,
    isDaily: Boolean,
    onBack: () -> Unit,
    onPlayAgain: (() -> Unit)? = null,
    onOpenDaily: (GameMode) -> Unit = {},
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val session = remember(seed) { KindredSession(seed, isDaily) }
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
    LaunchedEffect(session.toast) { if (session.toast != null) { kotlinx.coroutines.delay(1500); session.toast = null } }

    val onFinished: () -> Unit = {
        scope.launch {
            session.finish()
            if (!session.restoredFinished) showOverlay = true
            if (session.state.status == GroupsStatus.WON) {
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
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                KindredHeader(session, tick)
                Column(Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    session.state.solved.forEach { g -> GroupBar(g) }
                    groupsUnsolved(session.state).forEach { g -> GroupBar(g, revealed = true) }
                }
                KindredResult(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
            }
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                KindredHeader(session, tick)
                Column(
                    Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    val s = session.state
                    if (s.solved.isNotEmpty()) {
                        Column(Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            s.solved.forEach { g -> GroupBar(g) }
                        }
                    }
                    val revealedLabels = s.revealedTiers.mapNotNull { t -> s.groups.firstOrNull { it.tier == t } }.filter { g -> s.solved.none { it.tier == g.tier } }
                    if (revealedLabels.isNotEmpty()) RevealedChips(revealedLabels)
                    TileGrid(session)
                    MistakeDots(s.mistakes)
                }
                val sel = session.state.selected.size
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Capsule("Shuffle", Icons.Filled.Shuffle) { session.shuffle() }
                    Capsule("Deselect", Icons.Filled.Cancel, dim = sel == 0) { session.deselect() }
                    Capsule("Submit", Icons.Filled.CheckCircle, dim = sel != 4, filled = sel == 4) { session.submit(onFinished) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Capsule("Name a category", Icons.Filled.Label) { session.hintLabel() }
                    Capsule(if (session.state.hintsUsed > 0) "Show a pair · ${session.state.hintsUsed}" else "Show a pair", Icons.Filled.Link) { session.hintPair() }
                }
                Spacer(Modifier.height(10.dp))
            }
        }
        session.toast?.let {
            Box(Modifier.fillMaxWidth().padding(top = 100.dp), contentAlignment = Alignment.TopCenter) {
                Text(it, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clip(CircleShape).background(WTheme.text.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 10.dp))
            }
        }
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) KindredOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(GROUPS_ACCENT, onBack) }
        CornerHelpButton(GROUPS_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
        if (showGuide) GuideSheet(mode = GameMode.GROUPS, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
}

@Composable
private fun KindredHeader(session: KindredSession, tick: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        Text("KINDRED", fontSize = 24.sp, fontWeight = FontWeight.Black, color = GROUPS_ACCENT, fontFamily = Nunito)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (session.isDaily) Text("#${session.dailyNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            session.holidayTitle?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = GROUPS_ACCENT) }
            Text(session.groupsLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text(session.mistakesLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            @Suppress("UNUSED_EXPRESSION") tick
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Icon(Icons.Filled.Schedule, null, tint = WTheme.textMuted, modifier = Modifier.size(11.dp))
                Text(clockText(session.elapsed), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
    }
}

// ── Board ───────────────────────────────────────────────────────────────────

/** One to four pips — the tier, readable without color. */
@Composable
private fun Pips(tier: Int, color: Color, size: Int = 5) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(tier.coerceIn(1, 4)) { Box(Modifier.size(size.dp).clip(CircleShape).background(color)) }
    }
}

/** A solved (or, after the game, revealed) group as a full-width bar: pips for
 *  the tier, the label, the four words. Revealed bars are dimmed and dashed. */
@Composable
private fun GroupBar(group: GroupsGroup, revealed: Boolean = false) {
    val st = tierStyle(group.tier)
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier.fillMaxWidth().alpha(if (revealed) 0.85f else 1f).clip(shape).background(st.bg)
            .then(
                if (revealed) Modifier.drawBehind {
                    val stroke = 2.dp.toPx()
                    drawRoundRect(
                        color = Color.White.copy(alpha = 0.5f), cornerRadius = CornerRadius(12.dp.toPx()),
                        style = Stroke(width = stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 5.dp.toPx()))),
                    )
                } else Modifier,
            )
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Pips(group.tier, st.fg)
            Text(group.label, fontSize = 14.sp, fontWeight = FontWeight.Black, color = st.fg, fontFamily = Nunito, textAlign = TextAlign.Center)
        }
        Text(group.words.joinToString(", "), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = st.fg, letterSpacing = 0.4.sp, textAlign = TextAlign.Center)
    }
}

/** Categories named by a hint, as tier-colored chips above the grid. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RevealedChips(groups: List<GroupsGroup>) {
    FlowRow(
        Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        groups.forEach { g ->
            val st = tierStyle(g.tier)
            Row(
                Modifier.clip(CircleShape).background(st.bg).padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Pips(g.tier, st.fg, size = 4)
                Text(g.label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = st.fg)
            }
        }
    }
}

/** The unsolved words as a 4-wide grid of Classic-style tiles; selected tiles
 *  fill with the accent; hinted pairs wear a violet ring. Shakes on a miss. */
@Composable
private fun TileGrid(session: KindredSession) {
    val s = session.state
    val ringed = s.pairs.flatten().filter { it in s.tiles }.toSet()
    Column(
        Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp).shakeOnReject(session.shakeKey),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        for (row in s.tiles.chunked(4)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (w in row) Box(Modifier.weight(1f)) { WordTile(w, selected = w in s.selected, ringed = w in ringed) { session.toggle(w) } }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun WordTile(word: String, selected: Boolean, ringed: Boolean, onTap: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    val fs = when {
        word.length > 11 -> 9.sp
        word.length > 8 -> 10.sp
        else -> 12.sp
    }
    Box(
        Modifier.fillMaxWidth().height(60.dp)
            .then(if (ringed) Modifier.border(2.dp, PAIR_RING, RoundedCornerShape(14.dp)).padding(3.dp) else Modifier.padding(3.dp)),
    ) {
        Box(
            Modifier.fillMaxSize().clip(shape).background(if (selected) GROUPS_ACCENT else WTheme.surface)
                .border(2.dp, if (selected) GROUPS_ACCENT else WTheme.border, shape)
                .pressScale { onTap() }
                .padding(horizontal = 3.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                word, fontSize = fs, fontWeight = FontWeight.Black, color = if (selected) Color.White else WTheme.text, fontFamily = Nunito,
                textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Clip, lineHeight = fs,
            )
        }
    }
}

/** Four dots: filled while a mistake remains. */
@Composable
private fun MistakeDots(mistakes: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Mistakes left", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        for (i in 0 until GROUPS_MAX_MISTAKES) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(if (i < GROUPS_MAX_MISTAKES - mistakes) GROUPS_ACCENT else WTheme.border))
        }
    }
}

@Composable
private fun Capsule(label: String, icon: ImageVector, dim: Boolean = false, filled: Boolean = false, onClick: () -> Unit) {
    val fg = if (dim) WTheme.textMuted.copy(alpha = 0.5f) else if (filled) Color.White else GROUPS_ACCENT
    Row(
        Modifier.clip(CircleShape)
            .background(if (dim) Color.Transparent else if (filled) GROUPS_ACCENT else GROUPS_ACCENT.copy(alpha = 0.05f))
            .border(1.5.dp, if (dim) WTheme.border else if (filled) GROUPS_ACCENT else GROUPS_ACCENT.copy(alpha = 0.4f), CircleShape)
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
private fun KindredResult(
    session: KindredSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == GroupsStatus.WON
    val secs = session.elapsed
    val gc = groupsGuessCount(s)
    val context = LocalContext.current
    val hintsText = if (s.hintsUsed > 0) " · ${s.hintsUsed} hint${if (s.hintsUsed == 1) "" else "s"}" else ""
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 12.dp)) {
        Row(
            Modifier.widthIn(max = 420.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.surface)
                .border(1.dp, WTheme.border, RoundedCornerShape(12.dp)).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(GROUPS_ACCENT.copy(alpha = 0.08f))
                    .border(2.dp, GROUPS_ACCENT.copy(alpha = 0.27f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(if (won) (if (s.mistakes == 0) "✓" else "${s.mistakes}") else "✗", fontSize = 20.sp, fontWeight = FontWeight.Black, color = GROUPS_ACCENT, fontFamily = Nunito)
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    if (won) (if (s.mistakes == 0) "Flawless — all four groups" else "All four groups found") else "Out of mistakes",
                    fontSize = 15.sp, fontWeight = FontWeight.Black, color = if (won) Color(0xFF16A34A) else Color(0xFFEF4444), fontFamily = Nunito,
                )
                Text("${session.groupsLabel} · ${session.mistakesLabel} · ${timeText(secs)}$hintsText", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            ResultAction(Icons.Filled.Home, "Home", GROUPS_ACCENT, onBack)
            ResultAction(Icons.Filled.Share, "Share", GROUPS_ACCENT) {
                val num = if (session.isDaily) session.dailyNumber else null
                val meta = "${num?.let { "#$it · " } ?: ""}${session.groupsLabel} · ${session.mistakesLabel} · ${timeText(secs)}"
                val text = "Wordocious Kindred${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${clockText(secs)} · ${session.groupsLabel} · ${session.mistakesLabel} · wordocious.com/kindred"
                val bmp = ShareImage.renderGroups(context, s.solved.map { it.tier }, s.mistakes, GROUPS_MAX_MISTAKES, won, meta)
                ShareImage.shareBitmap(context, bmp, text)
            }
            if (!session.isDaily && isPro && onPlayAgain != null) ResultAction(Icons.Filled.Refresh, "Play Again", Color(0xFFD97706)) { onPlayAgain() }
        }
        if (session.isDaily) DailyRankBadge(GameMode.GROUPS)
        ScoreBreakdownCard(GameMode.GROUPS, won, gc, secs, groupsBoardsSolved(s), GROUPS_TOTAL_BOARDS, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
        if (session.isDaily) NextDailyRow(GameMode.GROUPS, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
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
private fun KindredOverlay(session: KindredSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == GroupsStatus.WON
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
                    StatBlock("${session.state.mistakes}", "MISTAKES"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
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
