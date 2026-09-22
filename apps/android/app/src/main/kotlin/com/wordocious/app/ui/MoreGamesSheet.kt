package com.wordocious.app.ui

import androidx.compose.foundation.background
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

/** "N of M played" over the More Games dailies — the More tile's Daily subtitle. */
fun morePlayedText(completedKeys: Set<String>, modes: List<ModeCard> = MORE_CARDS): String {
    val daily = modes.filter { it.dailyEligible && it.dbKey != null }
    val played = daily.count { it.dbKey in completedKeys }
    return "$played of ${daily.size} played"
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
    completions: Map<String, DailyCompletionsService.Completion>,
    unlimitedMode: Boolean,
    isPro: Boolean,
    onSelect: (ModeCard, Boolean) -> Unit,
    onLocked: (ModeCard) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = WTheme.bg) {
        Column(
            Modifier.fillMaxWidth().heightIn(max = 640.dp).verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "MORE GAMES", fontSize = 22.sp, fontWeight = FontWeight.Black,
                        style = TextStyle(fontFamily = Nunito, brush = Brush.linearGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899)))),
                    )
                    Text(
                        if (unlimitedMode) "Unlimited play" else "One free daily each · not part of the Daily Sweep",
                        fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    )
                }
                Text(
                    "Done", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.primary,
                    modifier = Modifier.clickableNoRipple(onDismiss).padding(4.dp),
                )
            }
            val sections = moreSections()
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
            moreSections(MORE_CARDS.filter { it.dailyEligible && it.dbKey != null }).forEach { section ->
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
