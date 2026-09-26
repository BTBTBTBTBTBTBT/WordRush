package com.wordocious.app.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.ui.theme.WTheme

/**
 * The Stats tab's game rail (Stats + Friends redesign D2, founder 2026-09-26:
 * "I don't want to swipe right through 19 different games … flow like
 * butter"). One horizontal row of chips: Today · the eight sweep games · VS ·
 * the More Games titles · All-time. Tap jumps straight to that page; a swipe on
 * the page below moves one chip (ProfileScreen owns that gesture); HOLD the
 * Today chip (or tap the grid button) for the whole set as a 5-wide grid so any
 * game is one tap away. Each game chip wears today's W/L dot. Twin of web
 * components/stats/game-rail.tsx and iOS StatsRail.
 */
const val RAIL_TODAY = "today"
const val RAIL_VS = "vs"
const val RAIL_ALL = "all"

/** The loss red every W/L surface on the Stats tab shares. */
val RAIL_LOSS_RED = Color(0xFFDC2626)

data class RailItem(
    /** RAIL_TODAY | RAIL_VS | RAIL_ALL | a daily mode dbKey. */
    val key: String,
    val label: String,
    /** The catalog card for a game chip (icon/glyph source); null for the three fixed chips. */
    val card: ModeCard? = null,
    /** Fixed-chip icon (Today / All-time). VS draws the swords drawable. */
    val icon: ImageVector? = null,
    val accent: Color,
    /** Today's result on a game chip: true = won, false = lost, null = not played. */
    val dot: Boolean? = null,
)

fun buildRailItems(
    sweepCards: List<ModeCard>,
    moreCards: List<ModeCard>,
    todayDailies: Map<String, DailyCompletionsService.Completion>,
    vsDailyWon: Boolean?,
): List<RailItem> {
    fun game(c: ModeCard): RailItem {
        val r = c.dbKey?.let { todayDailies[it] }
        return RailItem(
            key = c.dbKey ?: c.id,
            label = com.wordocious.app.ModeGen.byId(c.id)?.shortTitle ?: c.title,
            card = c,
            accent = c.accent,
            dot = r?.completed,
        )
    }
    return buildList {
        add(RailItem(RAIL_TODAY, "Today", icon = Icons.Filled.CalendarToday, accent = Color(0xFF7C3AED)))
        sweepCards.forEach { add(game(it)) }
        add(RailItem(RAIL_VS, "VS", accent = Color(0xFFEC4899), dot = vsDailyWon))
        moreCards.forEach { add(game(it)) }
        add(RailItem(RAIL_ALL, "All-time", icon = Icons.Filled.EmojiEvents, accent = Color(0xFFD97706)))
    }
}

@Composable
fun StatsRail(items: List<RailItem>, selected: String, onSelect: (String) -> Unit) {
    var gridOpen by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val haptics = LocalHapticFeedback.current

    // Keep the selected chip in view as the page changes (swipe, grid pick).
    LaunchedEffect(selected, items.size) {
        val idx = items.indexOfFirst { it.key == selected }
        if (idx < 0) return@LaunchedEffect
        val info = listState.layoutInfo
        val viewport = info.viewportEndOffset - info.viewportStartOffset
        val itemW = info.visibleItemsInfo.firstOrNull()?.size ?: 0
        // A negative offset scrolls the item toward the viewport's center.
        val centerOffset = if (viewport > 0 && itemW > 0) -((viewport - itemW) / 2) else 0
        listState.animateScrollToItem(idx, centerOffset)
    }

    fun pick(key: String) {
        gridOpen = false
        if (!WTheme.reducedMotion) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        onSelect(key)
    }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LazyRow(
                state = listState,
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items.forEach { it ->
                    item(key = it.key) {
                        RailChip(
                            item = it, active = it.key == selected, inGrid = false,
                            onClick = { pick(it.key) },
                            onLongClick = if (it.key == RAIL_TODAY) ({ gridOpen = true }) else null,
                        )
                    }
                }
            }
            // The grid button: every game at once (the hold-Today twin).
            val gridAccent = Color(0xFF7C3AED)
            Box(
                Modifier.size(36.dp).clip(RoundedCornerShape(12.dp))
                    .background(if (gridOpen) gridAccent.copy(alpha = 0.08f) else WTheme.surface)
                    .border(1.5.dp, if (gridOpen) gridAccent else WTheme.border, RoundedCornerShape(12.dp))
                    .clickableNoRipple { gridOpen = !gridOpen },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (gridOpen) Icons.Filled.Close else Icons.Filled.GridView, if (gridOpen) "Close" else "Every game",
                    tint = if (gridOpen) gridAccent else WTheme.textMuted, modifier = Modifier.size(16.dp),
                )
            }
        }
        if (gridOpen) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(WTheme.surface)
                    .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp)).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items.chunked(5).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { it ->
                            RailChip(
                                item = it, active = it.key == selected, inGrid = true,
                                modifier = Modifier.weight(1f),
                                onClick = { pick(it.key) }, onLongClick = null,
                            )
                        }
                        repeat(5 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

/** One rail chip: 28dp icon tile in the accent at 15%, 10sp ExtraBold label,
 *  accent border when selected, today's W/L dot top-end on a game chip. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun RailChip(
    item: RailItem,
    active: Boolean,
    inGrid: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)?,
) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier
            .then(if (inGrid) Modifier else Modifier.widthIn(min = 62.dp))
            .clip(RoundedCornerShape(12.dp))
            .background(if (active) item.accent.copy(alpha = 0.08f) else WTheme.surface)
            .border(1.5.dp, if (active) item.accent else WTheme.border, RoundedCornerShape(12.dp))
            .combinedClickable(interactionSource = interaction, indication = null, onLongClick = onLongClick, onClick = onClick),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Box(
                Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(item.accent.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                when {
                    item.card != null -> ModeGlyph(item.card, item.accent, box = 28.dp)
                    item.key == RAIL_VS -> Icon(
                        painterResource(com.wordocious.app.R.drawable.ic_swords), null,
                        tint = item.accent, modifier = Modifier.size(14.dp),
                    )
                    item.icon != null -> Icon(item.icon, null, tint = item.accent, modifier = Modifier.size(14.dp))
                }
            }
            Text(
                item.label, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                color = if (active) item.accent else WTheme.textMuted,
                maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis,
            )
        }
        item.dot?.let { won ->
            Box(
                Modifier.align(Alignment.TopEnd).padding(4.dp).size(8.dp).clip(CircleShape)
                    .background(if (won) WTheme.correct else RAIL_LOSS_RED),
            )
        }
    }
}
