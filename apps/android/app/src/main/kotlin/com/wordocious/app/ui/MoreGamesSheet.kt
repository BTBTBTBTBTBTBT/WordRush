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
    // The ten games are "Puzzles" now (founder, 2026-10-01: home redesign).
    SWEEP("PUZZLES SWEEP!", "Puzzles Sweep"),
    FLAWLESS("PUZZLES FLAWLESS!", "Puzzles Flawless"),
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
            // The shared sheet header (HEADER_SPEC §4); Done is the white close circle.
            PageHeader(
                "MORE GAMES", onClose = onDismiss, closeLabel = "Done",
                contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
                art = TitleArt.MOREGAMES, // ART_SPEC §2
            )
            val flagTable by FlagsService.flags.collectAsState()
            val flagsLoaded by FlagsService.loaded.collectAsState()
            moreSections(MORE_CARDS.filter { it.dailyEligible && it.dbKey != null && FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) }).forEach { section ->
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        section.title.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                        color = WTheme.textMuted, letterSpacing = 1.sp,
                    )
                    section.modes.forEach { card ->
                        // The game tile's chrome (docs/GAME_TILE_STYLE.md) on a list row.
                        Row(
                            Modifier.fillMaxWidth()
                                .gameTilePress { onPick(card.dbKey!!) }
                                .gameTileChrome(card.accent, WTheme.surface)
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            GameTileChip(card.accent, 40.dp) { ModeGlyph(card, card.accent, box = 40.dp) }
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
