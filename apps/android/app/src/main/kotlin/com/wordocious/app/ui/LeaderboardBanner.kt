package com.wordocious.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.ProperNoundle
import com.wordocious.core.leaderboardTitle

// The Leaderboard + Records page tops (FINISH_SPEC A6 / C2 / C2b, mockup
// docs/design/brand/mockups/leaderboard-polish.html): the day title is the page
// HEADLINE — full width, edge to edge, right on the wallpaper (no box, no stage, no
// frosted strip, no float) — and the game picker is THE shared GamePickerCard
// (FinishPages.kt) with the Sweep as the 9th Wordocious tile. Its tinted header strip
// carries "<MMM d> · RESETS IN hh:mm:ss" + the ALL-TIME door (Leaderboard) or the
// sub line + the DAILY | ALL-TIME switch (Records).

/** The Leaderboard page accent (PageTint.LEADERBOARD gold) — cards, picker, stripes. */
internal val LB_GOLD = Color(0xFFF59E0B)

/** The picker / caps label ink on the gold page (mockup `.plabel` #8a4a12). */
internal val LB_LABEL = Color(0xFF8A4A12)

/** The sweep's gold (the Sweep tile and the Sweep play card). */
internal val LB_SWEEP_GOLD = LB_GOLD

/**
 * A6 the Leaderboard headline: today's day-title art (FRIDAY'S FINEST …) full width,
 * edge to edge ([bleed] = the parent's side padding). On a holiday the whole-cast
 * LEADERBOARD art with the `<HOLIDAY> HEROES` caps subtitle under it; with no art at
 * all (an unparseable day) the title as caps text. Rolls over at midnight.
 */
@Composable
internal fun LeaderboardHeadline(bleed: Dp) {
    // AU2: the day title stays ≤ 110 dp tall so the podium shows on arrival.
    val countdown = rememberMidnightCountdown()
    // Re-read the day once a minute so the title rolls over at midnight (not every tick).
    val minute by remember { derivedStateOf { countdown.value / 60 } }
    val day = remember(minute) { com.wordocious.app.todayLocalDate() }
    val holiday = remember(day) { ProperNoundle.holidayNameForDay(day) }
    val title = remember(day) { leaderboardTitle(day, holiday) }
    val dayArt = remember(day) { dayTitleArtRes(day, holiday) }
    when {
        // X: in the Halloween season, small props (pumpkin, bat) flank the day title when shipped.
        dayArt != null -> Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            PageHeadline(dayArt, titleCaseLabel(title), bleed = bleed, maxHeight = LB_TITLE_MAX) // AU2
            HalloweenPropSlot("pumpkin", 40.dp, Modifier.align(Alignment.BottomStart).padding(start = 8.dp))
            HalloweenPropSlot("bat", 34.dp, Modifier.align(Alignment.TopEnd).padding(end = 8.dp))
        }
        !holiday.isNullOrBlank() -> Column(
            Modifier.fillMaxWidth().clearAndSetSemantics {
                contentDescription = "Leaderboard, ${titleCaseLabel(title)}"
                heading()
            },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            PageHeadline(com.wordocious.app.R.drawable.art_titlecast_leaderboard, "Leaderboard", bleed = bleed, maxHeight = LB_TITLE_MAX - 18.dp)
            Text(
                title.uppercase(), fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.14.em,
                color = if (WTheme.isDark) WTheme.textSecondary else LB_LABEL, maxLines = 1, textAlign = TextAlign.Center,
            )
        }
        else -> Text(
            title, fontSize = 26.sp, fontWeight = FontWeight.Black, letterSpacing = 0.02.em,
            color = if (WTheme.isDark) WTheme.text else FinishInk.heading, textAlign = TextAlign.Center, maxLines = 2,
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).semantics { heading() },
        )
    }
}

/**
 * C2 / C2b the Leaderboard's game picker: the shared [GamePickerCard] in the page
 * gold, the Sweep as the 9th Wordocious tile ([SWEEP_ID]), its header strip carrying
 * the date · reset clock (left) and the ALL-TIME door to Records (right). Same
 * [onSelect] path as every other selection.
 */
@Composable
internal fun LeaderboardPicker(
    selected: String,
    onSelect: (String) -> Unit,
    @Suppress("UNUSED_PARAMETER") onOpenRecords: () -> Unit = {},
) {
    GamePickerCard(
        selected = selected,
        onSelect = onSelect,
        // BB3: the SAME two-row grid as Stats (every game visible, no sideways scroll), dense
        // (~30–32 dp tiles, tight gaps) so the podium still shows on arrival.
        dense = true,
        accent = LB_GOLD,
        labelColor = LB_LABEL,
        withSweep = true,
        sweepKey = SWEEP_ID,
        header = {
            // BB4: no ALL-TIME door here (all-time lives in Stats).
            ResetClockLabel(Modifier.weight(1f))
        },
    )
}

/** AU2 the Leaderboard day title's height cap. */
private val LB_TITLE_MAX = 78.dp // BJ7 (BB3 was 90, before that 110)

/** "OCT 2 · RESETS IN 12:41:17" — reads the ticking clock in its own scope so only it recomposes. */
@Composable
private fun ResetClockLabel(modifier: Modifier = Modifier, prefix: String? = null) {
    val secs by rememberMidnightCountdown()
    val day = remember(secs / 60) { com.wordocious.app.todayLocalDate() }
    val lead = prefix ?: remember(day) {
        java.time.LocalDate.parse(day).format(java.time.format.DateTimeFormatter.ofPattern("MMM d", java.util.Locale.US)).uppercase(java.util.Locale.US)
    }
    HeaderCaps("$lead · RESETS IN ${formatCountdown(secs)}", modifier, maxLines = 2)
}

/** The picker header's caps ink (mockup `.stagefoot`: 12 / 900 / .06em). */
@Composable
private fun HeaderCaps(text: String, modifier: Modifier = Modifier, maxLines: Int = 1) {
    Text(
        text, fontSize = 11.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.06.em,
        color = if (WTheme.isDark) WTheme.textSecondary else LB_LABEL,
        maxLines = maxLines, overflow = TextOverflow.Ellipsis, modifier = modifier,
    )
}

/** A small tappable caps label in the header strip (the ALL-TIME door): squish, 44 dp tall tap row. */
@Composable
private fun HeaderLink(text: String, description: String, onClick: () -> Unit) {
    Text(
        text, fontSize = 11.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.06.em,
        color = if (WTheme.isDark) WTheme.textSecondary else LB_LABEL, maxLines = 1,
        modifier = Modifier
            .squishClickable(label = description, role = Role.Button, onClick = onClick)
            .heightIn(min = 32.dp)
            .padding(start = 8.dp, top = 8.dp, bottom = 8.dp),
    )
}

// ── The Records page top (docs/RECORDS_REDESIGN_SPEC.md §1, FINISH_SPEC A6 / C2) ──

/**
 * The Records page top: the whole-cast RECORDS title as the page headline (A6, edge
 * to edge, [bleed] = the parent's side padding), then the shared [GamePickerCard]
 * (Sweep tile included) whose header strip carries the sub line — THE BEST EVER · N
 * RECORDS on All-Time ([recordCount] null drops the number), <DAY TITLE> · RESETS IN …
 * on Daily — and the DAILY | ALL-TIME switch.
 */
@Composable
internal fun RecordsBanner(
    daily: Boolean,
    onDaily: (Boolean) -> Unit,
    selected: String,
    onSelect: (String) -> Unit,
    recordCount: Int? = null,
    bleed: Dp = 12.dp,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PageHeadline(TitleArt.RECORDS, bleed = bleed)
        GamePickerCard(
            selected = selected,
            onSelect = onSelect,
            accent = LB_GOLD,
            labelColor = LB_LABEL,
            withSweep = true,
            sweepKey = SWEEP_ID,
            header = { RecordsHeader(daily, onDaily, recordCount) },
        )
    }
}

@Composable
private fun RowScope.RecordsHeader(daily: Boolean, onDaily: (Boolean) -> Unit, recordCount: Int?) {
    if (daily) {
        val secs by rememberMidnightCountdown()
        val day = remember(secs / 60) { com.wordocious.app.todayLocalDate() }
        val dayTitle = remember(day) { leaderboardTitle(day, ProperNoundle.holidayNameForDay(day)) }
        ResetClockLabel(Modifier.weight(1f), prefix = dayTitle)
    } else {
        HeaderCaps(
            if (recordCount != null && recordCount > 0) "THE BEST EVER · $recordCount RECORDS" else "THE BEST EVER",
            Modifier.weight(1f), maxLines = 2,
        )
    }
    SoftSegment(listOf(true to "DAILY", false to "ALL-TIME"), daily, onDaily)
}
