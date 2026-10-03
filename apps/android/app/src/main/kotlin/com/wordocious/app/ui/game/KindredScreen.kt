package com.wordocious.app.ui.game

import com.wordocious.app.ui.gameBackground
import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
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
import com.wordocious.app.ui.squishClickable
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

/** J3 a tier's card / pip accent (the same one-hue ramp, readable as a top bar and a wash). */
private val TIER_ACCENT = mapOf(1 to Color(0xFFA78BFA), 2 to Color(0xFF8B5CF6), 3 to Color(0xFF7C3AED), 4 to Color(0xFF3B0764))
private fun tierAccent(tier: Int) = TIER_ACCENT[tier] ?: TIER_ACCENT[1]!!

/** L the Kindred tray's inner padding (the tray adds its 4 dp lip under it). */
private val KINDRED_TRAY_PAD = 8.dp

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
    private var began = false
    /** Why the clock is stopped (guide open, app in background); it runs only while the set is empty. */
    enum class Pause { GUIDE, BACKGROUND }
    private val pausedFor = mutableSetOf<Pause>()
    private var pauseStart: Long? = null
    private var recorded = false

    val isFinished get() = state.status != GroupsStatus.PLAYING
    val elapsed: Int get() = finalTimeSeconds ?: maxOf(0, (((pauseStart ?: System.currentTimeMillis()) - startMs) / 1000).toInt())
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
        val id: String, val groups: List<GroupsGroup>, val tiles: List<String>, val solved: List<GroupsGroup>,
        val selected: List<String>, val mistakes: Int, val submissions: Int, val hintsUsed: Int,
        val revealedTiers: List<Int>, val pairs: List<List<String>>, val wrongSets: List<String>, val shuffles: Int,
        val lastResult: String?, val events: List<String>,
        val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
    )
    private val storageKey get() = if (isDaily) "groups-save-daily" else "groups-save-$seed"

    private fun persist() {
        if (!isDaily && isFinished) { SettingsPref.remove(storageKey); return }
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
            GroupsResult.CORRECT -> if (!isFinished) SoundManager.playPartial()
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
    PauseClockInBackground(session, session::enterBackground, session::leaveBackground)
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


    // Physical keyboard (founder, 2026-09-30; web groups-game.tsx, iOS parity): Return submits the
    // four picked words, Escape deselects them all.
    ProvideFeedbackAnchor {
    Box(
        Modifier.fillMaxSize()
            .hardwareKeys(enabled = !session.isFinished && !showOverlay && !showGuide) { k ->
                when (k) {
                    HwKey.Enter -> { session.submit(onFinished); true }
                    HwKey.Escape -> { session.deselect(); true }
                    else -> false
                }
            }
            .gameBackground { background(WTheme.bg) }.statusBarsPadding(),
    ) {
        if (session.isFinished) {
            // FINISH_SPEC R2: the one-screen finished screen (header · strip · board · dock).
            KindredFinished(session, isPro, onBack, onPlayAgain, onOpenDaily, onOpenUnlimited, onOpenLeaderboard)
        } else {
            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                KindredHeader(session)
                // The grid is the hero (founder, 2026-09-28, on the real build: a content-sized
                // 4×4 at the top left the bottom half of the phone empty). The band between the
                // header and the pinned controls is measured here — never the window — and the
                // tiles scale to fill it: tile = (band − rail − solved bars − gaps) / rows,
                // clamped 56–92 dp. Bars are ESTIMATED (≈56 dp + 6 dp each, rail ≈24 dp), like
                // Muddle's tier estimation, so the remaining rows and their bars stay balanced
                // without measuring every child. Order: chips → grid → rail → bars; the column
                // still scrolls as a fallback on very short screens (tiles at the floor may
                // overflow, the buttons never do).
                // BI22: the named-category chips row is a fixed slot that is ALWAYS reserved
                // (empty until "Name a category" is used), so a hint never shrinks the tiles
                // or pushes the grid down (HintLayout.kindredTileHeight).
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                    val s = session.state
                    val revealedLabels = s.revealedTiers.mapNotNull { t -> s.groups.firstOrNull { it.tier == t } }.filter { g -> s.solved.none { it.tier == g.tier } }
                    val rows = ((s.tiles.size + 3) / 4).coerceAtLeast(1)
                    val gap = 8.dp
                    val chipSlot = kindredChipSlotHeight()
                    val tileH = HintLayout.kindredTileHeight(
                        bandH = maxHeight.value, rows = rows, solved = s.solved.size, revealedLabels = revealedLabels.size,
                        chipSlotH = (chipSlot + gap).value, trayPad = KINDRED_TRAY_PAD.value, trayLip = GameTrayStyle.LIP.value, gap = gap.value,
                    ).dp
                    Column(
                        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(gap),
                    ) {
                        RevealedChips(revealedLabels, chipSlot)
                        TileGrid(session, tileH)
                        ProgressRail(s)
                        // Solved groups stack UNDER the grid in solve order, newest at the bottom,
                        // so the tiles never get pushed down as you solve (founder, 2026-09-28).
                        if (s.solved.isNotEmpty()) {
                            Column(Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                s.solved.forEach { g -> GroupBar(g) }
                            }
                        }
                    }
                }
                val sel = session.state.selected.size
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Capsule("Shuffle", Icons.Filled.Shuffle) { session.shuffle() }
                    Capsule("Deselect", Icons.Filled.Cancel, dim = sel == 0) { session.deselect() }
                    Capsule("Submit", Icons.Filled.CheckCircle, dim = sel != 4, color = com.wordocious.app.ui.CandyColor.PURPLE) { session.submit(onFinished) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Capsule("Name a category", Icons.Filled.Label, color = com.wordocious.app.ui.CandyColor.AMBER) { session.hintLabel() }
                    Capsule("Show a pair", Icons.Filled.Link, color = com.wordocious.app.ui.CandyColor.AMBER, count = session.state.hintsUsed) { session.hintPair() }
                }
                Spacer(Modifier.height(10.dp))
            }
        }
        // G5 a toast is a tinted pill (no dark slab, no white).
        // The candy feedback toast, centered on the header meta row (never the title art or the board).
        GameFeedbackToast(session.toast, fallbackTop = 100.dp)
        session.xpResult?.let { XpToast(it) { session.xpResult = null } }
        if (showOverlay) KindredOverlay(session, onPlayAgain = if (!isDaily && isPro && onPlayAgain != null) { { showOverlay = false; onPlayAgain() } } else null) { showOverlay = false }
        Box(Modifier.align(Alignment.TopStart)) { CornerHomeButton(GROUPS_ACCENT, onBack) }
        CornerHelpButton(GROUPS_ACCENT, onClick = { showGuide = true; session.pauseForGuide() }, modifier = Modifier.align(Alignment.TopEnd).padding(GAME_CONTROLS_INSET))
        if (showGuide) GuideSheet(mode = GameMode.GROUPS, onDismiss = { showGuide = false; session.resumeFromGuide() })
    }
    }
}

@Composable
private fun KindredHeader(session: KindredSession) {
    val tick by produceState(0, session.isFinished) { while (!session.isFinished) { kotlinx.coroutines.delay(1000); value++ } }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 6.dp)) {
        // The game's title art: lettering + host (ART_SPEC §10).
        com.wordocious.app.ui.HostedGameTitle("GROUPS") { Text("KINDRED", fontSize = 24.sp, fontWeight = FontWeight.Black, color = GROUPS_ACCENT, fontFamily = Nunito) }
        Row(Modifier.feedbackAnchor(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
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

/** J3 a solved (or, after the game, revealed) group as a tinted card in its tier's
 *  color with the top bar: pips for the tier, the label, the four words. Revealed
 *  cards are faded with a dashed outline. */
@Composable
internal fun GroupBar(group: GroupsGroup, revealed: Boolean = false) {
    val accent = tierAccent(group.tier)
    val dark = WTheme.isDark
    val ink = if (dark) WTheme.text else com.wordocious.app.ui.FinishInk.heading
    com.wordocious.app.ui.TintedCard(
        accent = accent,
        modifier = Modifier.fillMaxWidth().alpha(if (revealed) 0.85f else 1f)
            .then(
                if (revealed) Modifier.drawWithContent {
                    drawContent()
                    val stroke = 2.dp.toPx()
                    drawRoundRect(
                        color = accent.copy(alpha = 0.7f), cornerRadius = CornerRadius(16.dp.toPx()),
                        topLeft = androidx.compose.ui.geometry.Offset(stroke / 2, stroke / 2),
                        size = androidx.compose.ui.geometry.Size(size.width - stroke, size.height - stroke),
                        style = Stroke(width = stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 5.dp.toPx()))),
                    )
                } else Modifier,
            ),
        corner = 16.dp, barHeight = 8.dp,
        tint = com.wordocious.app.ui.accentWash(accent, if (group.tier >= 3) 0.16f else 0.18f),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Pips(group.tier, if (dark) Color(0xFFC4B5FD) else accent)
                Text(group.label, fontSize = 14.sp, fontWeight = FontWeight.Black, color = ink, fontFamily = Nunito, textAlign = TextAlign.Center)
            }
            Text(group.words.joinToString(", "), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (dark) WTheme.textMuted else com.wordocious.app.ui.FinishInk.label, letterSpacing = 0.4.sp, textAlign = TextAlign.Center)
        }
    }
}

/** L the finished groups (the game's results and the Completed-Today card): the
 *  solved cards, then the revealed ones, in the game tray (purple solved, slate not). */
@Composable
internal fun KindredFinishedBars(solved: List<GroupsGroup>, unsolved: List<GroupsGroup>, modifier: Modifier = Modifier) {
    GameTray(
        GROUPS_ACCENT, modifier.widthIn(max = 420.dp).fillMaxWidth(), state = finishTray(true, unsolved.isEmpty()),
        padding = androidx.compose.foundation.layout.PaddingValues(KINDRED_TRAY_PAD),
    ) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            solved.forEach { GroupBar(it) }
            unsolved.forEach { GroupBar(it, revealed = true) }
        }
    }
}

/** BI22 the named-category slot's fixed height: one 11 sp chip (1.3 em line + 5 dp padding each side) + 2 dp slack, at any font scale. */
@Composable
private fun kindredChipSlotHeight(): androidx.compose.ui.unit.Dp =
    with(androidx.compose.ui.platform.LocalDensity.current) { (11.sp * 1.3f).toDp() } + 12.dp

/**
 * Categories named by a hint, as tier-colored chips above the grid — in a fixed-height,
 * always-present slot (BI22): one centered line that scrolls sideways when the chips
 * overflow, empty until a category is named, so the grid never moves or resizes.
 */
@Composable
private fun RevealedChips(groups: List<GroupsGroup>, slotHeight: androidx.compose.ui.unit.Dp) {
    Box(Modifier.widthIn(max = 420.dp).fillMaxWidth().height(slotHeight), contentAlignment = Alignment.Center) {
    if (groups.isNotEmpty()) Row(
        Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        groups.forEach { g ->
            val accent = tierAccent(g.tier)
            // A1 a soft chip in the tier's tint.
            Row(
                Modifier.softChip(accent).padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Pips(g.tier, if (WTheme.isDark) Color(0xFFC4B5FD) else accent, size = 4)
                Text(g.label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else com.wordocious.app.ui.FinishInk.heading, maxLines = 1, softWrap = false)
            }
        }
    }
    }
}

/** The unsolved words as a 4-wide grid of Classic-style tiles; selected tiles
 *  fill with the accent; hinted pairs wear a violet ring. Shakes on a miss.
 *  [tileH] comes from the band measurement in KindredScreen (56–92 dp). */
@Composable
private fun TileGrid(session: KindredSession, tileH: Dp) {
    val s = session.state
    val ringed = s.pairs.flatten().filter { it in s.tiles }.toSet()
    // L the grid sits in the shared game tray.
    Column(
        Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp).shakeOnReject(session.shakeKey)
            .gameTray(GROUPS_ACCENT, padding = androidx.compose.foundation.layout.PaddingValues(KINDRED_TRAY_PAD)),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        for (row in s.tiles.chunked(4)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (w in row) Box(Modifier.weight(1f)) { WordTile(w, tileH, selected = w in s.selected, ringed = w in ringed) { session.toggle(w) } }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun WordTile(word: String, tileH: Dp, selected: Boolean, ringed: Boolean, onTap: () -> Unit) {
    // The label scales with the tile (founder, 2026-09-28): normal words
    // clamp(tile × 0.22, 12–15 sp), long words (> 8 chars) clamp(tile × 0.18, 10–13 sp).
    val base = if (word.length > 8) (tileH.value * 0.18f).coerceIn(10f, 13f).sp else (tileH.value * 0.22f).coerceIn(12f, 15f).sp
    // Shrink-to-fit on ONE line (Doug, Android, 2026-09-26: PRESENCE broke as
    // "PRESENC / E" at his font scale). The old three-step size table could not
    // know the tile width or the user's font scale; now the text lays out at the
    // base size, and while it overflows the tile it steps down (floor 55%) before
    // it is drawn, so no word ever wraps or clips. iOS does the same with minimumScaleFactor.
    var scale by remember(word, base) { mutableFloatStateOf(1f) }
    var fitted by remember(word, base) { mutableStateOf(false) }
    val fs = base * scale
    Box(
        Modifier.fillMaxWidth().height(tileH)
            .then(if (ringed) Modifier.border(2.dp, PAIR_RING, RoundedCornerShape(14.dp)).padding(3.dp) else Modifier.padding(3.dp)),
    ) {
        // J3 a glossy chip (tinted face, lip, gloss); selected = filled purple (the tier ramp's color).
        val look = if (selected) TileLooks.CORRECT else tintedChipLook(GROUPS_ACCENT, WTheme.isDark)
        Box(
            Modifier.fillMaxSize()
                .squishClickable(onClick = onTap)
                .drawBehind { drawGameTile(look) }
                .padding(start = 3.dp, end = 3.dp, bottom = (tileH - 6.dp) * TILE_LIP),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                word, fontSize = fs, fontWeight = FontWeight.Black, color = look.glyph, fontFamily = Nunito,
                style = androidx.compose.ui.text.TextStyle(shadow = if (look.glyphShadow.alpha > 0f) androidx.compose.ui.graphics.Shadow(look.glyphShadow, androidx.compose.ui.geometry.Offset(0f, 1.5f), 1.5f) else null),
                textAlign = TextAlign.Center, maxLines = 1, softWrap = false, overflow = TextOverflow.Clip, lineHeight = fs,
                modifier = Modifier.drawWithContent { if (fitted) drawContent() },
                onTextLayout = { r -> if (r.hasVisualOverflow && scale > 0.55f) scale -= 0.05f else fitted = true },
            )
        }
    }
}

/** The rail between the grid and the solved bars (founder, 2026-09-28): left,
 *  "Groups · N of 4" with four pips in the tier ramp — filled once that tier is
 *  solved, a ring until then; right, the mistake dots. It is there from the first
 *  second so the lower band never starts fully empty. Same max width as the grid. */
@Composable
private fun ProgressRail(s: GroupsState) {
    val found = s.solved.size
    Row(
        Modifier.widthIn(max = 420.dp).fillMaxWidth().padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            Modifier.clearAndSetSemantics { contentDescription = "$found of $GROUPS_TOTAL_BOARDS groups found" },
            horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Groups", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            Text("$found of $GROUPS_TOTAL_BOARDS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
            for (tier in 1..GROUPS_TOTAL_BOARDS) {
                val c = tierStyle(tier).bg
                val solved = s.solved.any { it.tier == tier }
                Box(Modifier.size(10.dp).clip(CircleShape).then(if (solved) Modifier.background(c) else Modifier.border(1.5.dp, c, CircleShape)))
            }
        }
        MistakeDots(s.mistakes)
    }
}

/** Four dots: filled while a mistake remains. */
@Composable
private fun MistakeDots(mistakes: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Mistakes left", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        for (i in 0 until GROUPS_MAX_MISTAKES) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(if (i < GROUPS_MAX_MISTAKES - mistakes) GROUPS_ACCENT else com.wordocious.app.ui.accentLine(GROUPS_ACCENT)))
        }
    }
}

/** A8 a game control: a small candy button with its icon; [dim] = nothing to do (taps ignored, as before). */
@Composable
private fun Capsule(label: String, icon: ImageVector, dim: Boolean = false, color: com.wordocious.app.ui.CandyColor = com.wordocious.app.ui.CandyColor.PEACH, reserve: String? = null, count: Int = 0, onClick: () -> Unit) =
    PadAction(label, icon, onClick = onClick, color = color, dim = dim, reserveLabel = reserve, count = count)

// ── Result + overlay ────────────────────────────────────────────────────────

@Composable
private fun KindredFinished(
    session: KindredSession, isPro: Boolean, onBack: () -> Unit, onPlayAgain: (() -> Unit)?,
    onOpenDaily: (GameMode) -> Unit, onOpenUnlimited: ((GameMode) -> Unit)?, onOpenLeaderboard: ((GameMode) -> Unit)?,
) {
    val s = session.state
    val won = s.status == GroupsStatus.WON
    val secs = session.elapsed
    val gc = groupsGuessCount(s)
    val context = LocalContext.current
    val title = if (won) (if (s.mistakes == 0) "Flawless, all four groups" else "All four groups found") else "Out of mistakes"
    val share = {
        val num = if (session.isDaily) session.dailyNumber else null
        val meta = "${num?.let { "#$it · " } ?: ""}${session.groupsLabel} · ${session.mistakesLabel} · ${timeText(secs)}"
        val text = "Wordocious Kindred${num?.let { " #$it" } ?: ""} — Score ${session.points} pts · Time ${clockText(secs)} · ${session.groupsLabel} · ${session.mistakesLabel} · wordocious.com/kindred"
        val bmp = ShareImage.renderGroups(context, s.solved.map { it.tier }, s.mistakes, GROUPS_MAX_MISTAKES, won, meta)
        ShareImage.shareBitmap(context, bmp, text)
    }
    FinishedScreen(
        header = { KindredHeader(session) },
        strip = {
            ResultStrip(
                won,
                listOfNotNull(
                    // A win is always 4/4; the groups chip only says something on a loss.
                    if (!won) stripCount("${s.solved.size}/$GROUPS_TOTAL_BOARDS", "groups") else null,
                    stripCount("${s.mistakes}", if (s.mistakes == 1) "mistake" else "mistakes", StripGlyph.CROWN, GROUPS_ACCENT),
                    stripTime(secs), stripPoints(session.points),
                ),
                srText = "$title. ${s.solved.size} of $GROUPS_TOTAL_BOARDS groups, ${s.mistakes} mistake${if (s.mistakes == 1) "" else "s"}, time ${timeText(secs)}, ${session.points} points",
            )
        },
        dock = {
            FinishedDock(
                GameMode.GROUPS, isDaily = session.isDaily, accent = GROUPS_ACCENT, onShare = share,
                onOpenDaily = onOpenDaily, onOpenLeaderboard = onOpenLeaderboard, onOpenUnlimited = onOpenUnlimited,
                onNewPuzzle = if (!session.isDaily && isPro && onPlayAgain != null) onPlayAgain else null,
                onOtherGames = onBack,
                more = {
                    hintsNote(s.hintsUsed)?.let { Text("$title · $it", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted) }
                    if (session.isDaily) DailyRankBadge(GameMode.GROUPS)
                    ScoreBreakdownCard(GameMode.GROUPS, won, gc, secs, groupsBoardsSolved(s), GROUPS_TOTAL_BOARDS, s.hintsUsed, day = if (session.isDaily) todayLocalDate() else null)
                },
            )
        },
    ) { _, maxH ->
        // R2: the four group bars; on a very short phone they scroll in place.
        FinishedListSlot(maxHeight = maxH, accent = GROUPS_ACCENT, seeAllTitle = "All four groups") {
            KindredFinishedBars(s.solved, groupsUnsolved(s), Modifier.padding(horizontal = 4.dp))
        }
    }
}

private fun timeText(s: Int) = if (s >= 60) "${s / 60}:${"%02d".format(s % 60)}" else "${s}s"
/** Always m:ss — the header clock and the share caption. */
private fun clockText(s: Int) = "${s / 60}:${"%02d".format(s % 60)}"

@Composable
private fun KindredOverlay(session: KindredSession, onPlayAgain: (() -> Unit)?, onDismiss: () -> Unit) {
    val won = session.state.status == GroupsStatus.WON
    val secs = session.elapsed
    PieceOverlay(won, "GROUPS", GROUPS_ACCENT, onScrimTap = onDismiss) {
        // Moment lettering (ART_SPEC §6).
        com.wordocious.app.ui.MomentTitle(if (won) com.wordocious.app.ui.MomentArt.VICTORY else com.wordocious.app.ui.MomentArt.SO_CLOSE)
        Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            StatBlock("${session.state.mistakes}", "MISTAKES"); StatBlock(timeText(secs), "TIME"); StatBlock("%,d".format(session.points), "POINTS")
        }
        onPlayAgain?.let { PiecePlayAgain(won, it) }
        PieceTapHint()
    }
}

/** A2 a soft-number stat. */
@Composable
private fun StatBlock(value: String, label: String) = PieceStat(value, label)
