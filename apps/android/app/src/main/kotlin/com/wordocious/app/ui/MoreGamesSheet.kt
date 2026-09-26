package com.wordocious.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.lerp
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ModeGen
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.FlagsService
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme

/**
 * More Games sheet helpers — ports apps/web/lib/more-games.ts (More Games §18,
 * Stage 5). Sections follow the catalog's moreCategories order, non-empty only;
 * an uncategorised title falls into a trailing "Other" section.
 */
data class MoreSection(val key: String, val title: String, val modes: List<ModeCard>)

fun moreSections(modes: List<ModeCard> = MORE_CARDS): List<MoreSection> {
    val known = ModeGen.moreCategories.map { it.key }.toSet()
    val sections = ModeGen.moreCategories.map { c -> MoreSection(c.key, c.title, modes.filter { it.category == c.key }) }.toMutableList()
    val other = modes.filter { it.category == null || it.category !in known }
    if (other.isNotEmpty()) sections += MoreSection("other", "Other", other)
    return sections.filter { it.modes.isNotEmpty() }
}

/** The More Games dailies — what "N of M played" and the More Games Sweep count over. */
fun moreDailyModes(modes: List<ModeCard> = MORE_CARDS): List<ModeCard> = modes.filter { it.dailyEligible && it.dbKey != null }

/** "N of M played" over the More Games dailies — the More tile's Daily subtitle. */
fun morePlayedText(completedKeys: Set<String>, modes: List<ModeCard> = MORE_CARDS): String {
    val daily = moreDailyModes(modes)
    val played = daily.count { it.dbKey in completedKeys }
    return "$played of ${daily.size} played"
}

/**
 * More Games Sweep / Flawless (founder, 2026-09-26): a purely visual tier from
 * today's completions — every More Games daily played = SWEEP, every one won =
 * FLAWLESS. It never touches the Daily Sweep (no bonus, XP, leaderboard, dots).
 * Mirrors apps/web/lib/more-games.ts moreSweepTier().
 */
enum class MoreSweepTier(val title: String, val short: String) {
    SWEEP("MORE GAMES SWEEP!", "More Games Sweep"),
    FLAWLESS("FLAWLESS MORE GAMES!", "Flawless More Games"),
}
fun moreSweepTier(byMode: Map<String, DailyCompletionsService.Completion>, modes: List<ModeCard> = MORE_CARDS): MoreSweepTier? {
    val daily = moreDailyModes(modes)
    if (daily.isEmpty()) return null
    val rows = daily.map { byMode[it.dbKey!!] }
    if (rows.any { it == null }) return null
    return if (rows.all { it!!.completed }) MoreSweepTier.FLAWLESS else MoreSweepTier.SWEEP
}
data class MoreTotals(val completed: Int, val won: Int, val total: Int, val totalTimeSeconds: Int, val totalScore: Int)
fun moreTotals(byMode: Map<String, DailyCompletionsService.Completion>, modes: List<ModeCard> = MORE_CARDS): MoreTotals {
    val daily = moreDailyModes(modes)
    var completed = 0; var won = 0; var time = 0; var score = 0.0
    for (m in daily) { val c = byMode[m.dbKey!!] ?: continue; completed++; if (c.completed) won++; time += c.timeSeconds; score += Math.round(c.score).toDouble() }
    return MoreTotals(completed, won, daily.size, time, score.toInt())
}

/**
 * The More Games sheet: the SAME mode card as the home grid, two across, under
 * small section headers (Word · Trivia · Logic). ModalBottomSheet, fully
 * expanded, like GuideSheet. The Daily/Unlimited toggle is respected inside
 * the sheet exactly as on the grid; a locked card reports through onLocked so
 * HomeScreen shows its ModeLimitModal.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreGamesSheet(
    /** The More Games titles visible to this viewer (catalog ∩ remote flags). */
    modes: List<ModeCard> = MORE_CARDS,
    completions: Map<String, DailyCompletionsService.Completion>,
    unlimitedMode: Boolean,
    isPro: Boolean,
    onSelect: (ModeCard, Boolean) -> Unit,
    onLocked: (ModeCard) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = WTheme.bg) {
        MoreGamesSheetContent(Modifier.heightIn(max = 640.dp), modes, completions, unlimitedMode, isPro, onSelect, onLocked, onDismiss)
    }
}

/**
 * More Games opens by GROWING OUT OF the band (founder, 2026-09-26: "a fluid entry into
 * the menu from the current shape of the board, kind of like how we do the OctoWord
 * zooms"). Same grammar as the OctoWord board zoom: the panel starts as the band's exact
 * rectangle (14 dp radius), swells to a centered menu panel (20 dp) while the scrim fades
 * in, and the menu content fades in over the second half; dismissal runs the same path
 * backwards, shrinking onto the band before it vanishes. Replaces the ModalBottomSheet
 * that used to fan up from the bottom. Web more-games-sheet.tsx and iOS MoreGamesMorph
 * are the twins. Stays composed while collapsing, so the parent just flips [visible].
 */
@Composable
fun MoreGamesMorphPanel(
    visible: Boolean,
    /** The band's bounds in root coordinates (null → grows from the centre). */
    origin: androidx.compose.ui.geometry.Rect?,
    onRequestClose: () -> Unit,
    content: @Composable () -> Unit,
) {
    var mounted by remember { mutableStateOf(false) }
    val progress = remember { Animatable(0f) }
    val spring = spring<Float>(dampingRatio = 0.82f, stiffness = 320f)
    LaunchedEffect(visible) {
        if (visible) { mounted = true; progress.animateTo(1f, spring) }
        else if (mounted) { progress.animateTo(0f, spring); mounted = false }
    }
    if (!mounted && !visible) return
    BackHandler(enabled = visible) { onRequestClose() }
    val p = progress.value
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val density = LocalDensity.current
        var myPos by remember { mutableStateOf(Offset.Zero) }
        val rootW = constraints.maxWidth.toFloat()
        val rootH = constraints.maxHeight.toFloat()
        val tw = minOf(rootW - with(density) { 32.dp.toPx() }, with(density) { 384.dp.toPx() })
        val th = minOf(rootH - with(density) { 48.dp.toPx() }, with(density) { 720.dp.toPx() })
        val target = Rect((rootW - tw) / 2f, (rootH - th) / 2f, (rootW - tw) / 2f + tw, (rootH - th) / 2f + th)
        val from = origin?.translate(-myPos) ?: target.deflate(minOf(tw, th) * 0.05f)
        val rect = lerp(from, target, p)
        val radius = with(density) { (14f + 6f * p).dp }
        val shape = RoundedCornerShape(radius)
        Box(
            Modifier.fillMaxSize()
                .onGloballyPositioned { myPos = it.positionInRoot() }
                .background(Color.Black.copy(alpha = 0.4f * p))
                .clickableNoRipple(onRequestClose),
        ) {
            Box(
                Modifier
                    .offset { IntOffset(rect.left.toInt(), rect.top.toInt()) }
                    .size(with(density) { rect.width.toDp() }, with(density) { rect.height.toDp() })
                    .alpha(minOf(1f, p * 2.5f))
                    .clip(shape)
                    .background(WTheme.bg)
                    .border(1.5.dp, WTheme.border, shape)
                    .clickableNoRipple {},
            ) {
                // Laid out at the FINAL size throughout and clipped to the in-flight rectangle,
                // so nothing reflows while the panel grows.
                Box(Modifier.wrapContentSize(Alignment.TopStart, unbounded = true)) {
                    Box(
                        Modifier.size(with(density) { tw.toDp() }, with(density) { th.toDp() })
                            .alpha(maxOf(0f, (p - 0.5f) * 2f)),
                    ) { content() }
                }
            }
        }
    }
}

/** The sheet body shared by the ModalBottomSheet and the morph panel. */
@Composable
fun MoreGamesSheetContent(
    modifier: Modifier = Modifier,
    modes: List<ModeCard>,
    completions: Map<String, DailyCompletionsService.Completion>,
    unlimitedMode: Boolean,
    isPro: Boolean,
    onSelect: (ModeCard, Boolean) -> Unit,
    onLocked: (ModeCard) -> Unit,
    onDismiss: () -> Unit,
) {
    Column(
        modifier.fillMaxWidth().verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp).padding(top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        run {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "MORE GAMES", fontSize = 22.sp, fontWeight = FontWeight.Black,
                        style = TextStyle(fontFamily = Nunito, brush = Brush.linearGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899)))),
                    )
                    // More Games Sweep / Flawless (founder, 2026-09-26): the win shows where the
                    // games are. Purely visual — derived from today's completions, never a score.
                    val tier = if (unlimitedMode) null else moreSweepTier(completions, modes)
                    if (tier != null) {
                        val gold = tier == MoreSweepTier.FLAWLESS
                        Text(
                            (if (gold) "🏆 " else "✦ ") + tier.short + " · all ${moreDailyModes(modes).size} ${if (gold) "won" else "played"} today",
                            fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (gold) Color(0xFFB45309) else Color(0xFF4338CA),
                        )
                    } else {
                        Text(
                            if (unlimitedMode) "Unlimited play" else "One free daily each · not part of the Daily Sweep",
                            fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        )
                    }
                }
                Text(
                    "Done", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.primary,
                    modifier = Modifier.clickableNoRipple(onDismiss).padding(4.dp),
                )
            }
            val sections = moreSections(modes)
            if (sections.isEmpty()) {
                Text(
                    "New games are on the way.", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
            sections.forEach { section ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        section.title.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                        color = WTheme.textMuted, letterSpacing = 1.sp,
                    )
                    section.modes.chunked(2).forEach { rowCards ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            rowCards.forEach { card ->
                                val completion = if (unlimitedMode) null else card.dbKey?.let { completions[it] }
                                val isLocked = !isPro && completion != null
                                ModeCardView(card, completion, isLocked, showVs = false, Modifier.weight(1f), onVs = {}) {
                                    if (isLocked) onLocked(card) else onSelect(card, unlimitedMode)
                                }
                            }
                            if (rowCards.size == 1) Spacer(Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(4.dp))
                    }
                }
            }
        }
    }
}

/**
 * The pickers' "More" chip target (More Games §18): the same sectioned list as
 * the sheet, as tappable rows, returning the chosen mode's dbKey. Used by
 * ModePickerRow (Leaderboard / Records) when the grid cannot hold every daily
 * mode in its 5-over-N layout.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreModePickerSheet(onPick: (String) -> Unit, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = WTheme.bg) {
        Column(
            Modifier.fillMaxWidth().heightIn(max = 640.dp).verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "MORE GAMES", fontSize = 22.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f),
                    style = TextStyle(fontFamily = Nunito, brush = Brush.linearGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899)))),
                )
                Text(
                    "Done", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.primary,
                    modifier = Modifier.clickableNoRipple(onDismiss).padding(4.dp),
                )
            }
            val flagTable by FlagsService.flags.collectAsState()
            val flagsLoaded by FlagsService.loaded.collectAsState()
            moreSections(MORE_CARDS.filter { it.dailyEligible && it.dbKey != null && FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) }).forEach { section ->
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        section.title.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                        color = WTheme.textMuted, letterSpacing = 1.sp,
                    )
                    section.modes.forEach { card ->
                        Row(
                            Modifier.fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(WTheme.surface)
                                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
                                .clickableNoRipple { onPick(card.dbKey!!) }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                Modifier.size(40.dp)
                                    .clip(RoundedCornerShape(11.dp))
                                    .background(card.accent.copy(alpha = 0.08f)),
                                contentAlignment = Alignment.Center,
                            ) { ModeGlyph(card, card.accent, box = 40.dp) }
                            Column(Modifier.weight(1f)) {
                                Text(card.title, fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                                Text(card.desc, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                            }
                            Icon(
                                Icons.Filled.ChevronRight, null,
                                tint = WTheme.textMuted, modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
