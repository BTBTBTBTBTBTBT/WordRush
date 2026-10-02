package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.core.ProperNoundle
import com.wordocious.core.leaderboardTitle

// The Leaderboard banner (founder 2026-10-01, docs/LEADERBOARD_REDESIGN_SPEC.md §1):
// one window like the home / VS / Friends banners — gold-to-lilac with the white
// sheen, a frosted strip carrying the core day title (FRIDAY’S FINEST, HALLOWEEN
// HEROES) and the date + reset clock + ALL-TIME link, then the eight Wordocious
// dailies and the ten Puzzles as rows of square game tiles (docs/GAME_TILE_STYLE.md),
// with the cross-mode SWEEP chip on the Wordocious label line. Exactly one selection
// across both rows and the chip. Replaces the old gradient title, countdown row and
// 5-over-N mode grid. Pinned light palette, like the other banners.

private val LB_INK = Color(0xFF78350F)
private val LB_SUB = Color(0xFF92400E)
private val LB_GOLD = Color(0xFFF59E0B)

/** The sweep's gold (the banner chip and the Sweep play card). */
internal val LB_SWEEP_GOLD = LB_GOLD

@Composable
internal fun LeaderboardBanner(
    selected: String,
    onSelect: (String) -> Unit,
    onOpenRecords: () -> Unit,
) {
    val secs by rememberMidnightCountdown()
    // Re-read the day once a minute so the title and date roll over at midnight.
    val minute = secs / 60
    val day = remember(minute) { com.wordocious.app.todayLocalDate() }
    val holiday = remember(day) { ProperNoundle.holidayNameForDay(day) }
    val title = remember(day) { leaderboardTitle(day, holiday) }
    // ART_SPEC §1: the weekday's day-title art (it carries its own host); holidays keep the text.
    val dayArt = remember(day) { dayTitleArtRes(day, holiday) }
    // ART_SPEC §8: on a holiday the whole-cast LEADERBOARD art fills the slot, the
    // `<HOLIDAY> HEROES` text under it as a small caps subtitle.
    val holidayArt = dayArt == null && !holiday.isNullOrBlank()
    val dateLabel = remember(day) {
        java.time.LocalDate.parse(day).format(java.time.format.DateTimeFormatter.ofPattern("MMM d", java.util.Locale.US)).uppercase(java.util.Locale.US)
    }
    val glow = with(LocalDensity.current) { 8.dp.toPx() }

    // The banner's own O2 host is dropped while the day / holiday art shows (the art has its cast).
    LbBannerShell(Color(0xFFFEF3C7), Color(0xFFEDE9FE), host = if (dayArt != null || holidayArt) null else Mascots.leaderboard) {
        // Frosted strip: the day title, then the date · reset clock and the ALL-TIME door.
        Column(
            Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f))
                .padding(start = 12.dp, top = if (dayArt != null || holidayArt) 8.dp else 12.dp, end = 12.dp, bottom = 10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (dayArt != null) {
                DayTitleArt(dayArt, title, height = 110.dp)
            } else if (holidayArt) {
                HolidayLeaderboardTitle(title, artHeight = 96.dp, subtitleColor = LB_INK)
            } else {
                Text(
                    title, fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, lineHeight = 1.15.em,
                    color = LB_INK, maxLines = 2, modifier = Modifier.padding(end = BANNER_HOST_CLEAR - 4.dp),
                    style = TextStyle(shadow = Shadow(LB_GOLD.copy(alpha = 0.55f), Offset.Zero, blurRadius = glow)),
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "$dateLabel · RESETS IN ${formatCountdown(secs)}",
                    fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp,
                    color = LB_SUB, maxLines = 1, modifier = Modifier.weight(1f),
                )
                Text(
                    "ALL-TIME →", fontSize = 10.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp,
                    color = LB_SUB, maxLines = 1,
                    modifier = Modifier.clickableNoRipple(onOpenRecords).padding(vertical = 4.dp)
                        .semantics { contentDescription = "All-time records" },
                )
            }
        }
        LbGameRows(selected, onSelect, LB_SUB)
    }
}

/** The one-window banner chrome shared by the Leaderboard and Records banners: a
 *  [top] → [bottom] vertical gradient + the white sheen, radius 16, soft gold shadow.
 *  The page [host] (O2, MASCOT_SPEC §1–§2) peeks over the strip's top-right edge. */
@Composable
internal fun LbBannerShell(top: Color, bottom: Color, host: MascotId? = null, content: @Composable ColumnScope.() -> Unit) {
    CappedFontScale {
        Box(Modifier.fillMaxWidth().padding(top = if (host != null) BANNER_HOST_PEEK else 0.dp)) {
        Column(
            Modifier.fillMaxWidth()
                .leaderboardBannerShadow()
                .clip(RoundedCornerShape(16.dp))
                .drawBehind {
                    drawRect(Brush.verticalGradient(listOf(top, bottom)))
                    drawRect(Brush.linearGradient(
                        0f to Color.White.copy(alpha = 0.35f), 0.55f to Color.White.copy(alpha = 0f),
                        start = Offset.Zero, end = Offset(size.width, size.height),
                    ))
                },
            content = content,
        )
        if (host != null) BannerHost(host, Modifier.align(Alignment.TopEnd))
        }
    }
}

/**
 * The banner's two game rows (Leaderboard + Records): WORDOCIOUS with the SWEEP chip
 * over the eight dailies (home WORDOCIOUS DAILIES order), then PUZZLES over the ten
 * More Games dailies (home PUZZLES order), remote flags honored. Exactly one
 * selection across both rows and the chip.
 */
@Composable
internal fun LbGameRows(selected: String, onSelect: (String) -> Unit, labelColor: Color) {
    val flagTable by com.wordocious.app.data.FlagsService.flags.collectAsState()
    val flagsLoaded by com.wordocious.app.data.FlagsService.loaded.collectAsState()
    val wordCards = MODE_CARDS.filter {
        !it.homeWide && it.dbKey != null && com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded)
    }
    val puzzleCards = moreDailyModes(MORE_CARDS.filter { com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) })
    Column(
        Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 6.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "WORDOCIOUS", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp,
                color = labelColor, modifier = Modifier.weight(1f),
            )
            SweepChip(selected == SWEEP_ID) { onSelect(SWEEP_ID) }
        }
        TileRow(wordCards, selected, spec = 38.dp, gap = 7.dp, corner = 10.dp, onSelect = onSelect)
    }
    Column(
        Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("PUZZLES", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = labelColor)
        TileRow(puzzleCards, selected, spec = 31.dp, gap = 4.dp, corner = 9.dp, onSelect = onSelect)
    }
}

/**
 * One row of icon-only square game tiles at the spec size, centered; a narrow
 * phone shrinks them to fit, never below 28 dp — past that the row scrolls
 * sideways instead of wrapping.
 */
@Composable
private fun TileRow(
    cards: List<ModeCard>,
    selected: String,
    spec: Dp,
    gap: Dp,
    corner: Dp,
    onSelect: (String) -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val n = cards.size.coerceAtLeast(1)
        val fit = (maxWidth - gap * (n - 1)) / n
        val size = if (fit < spec) maxOf(fit, 28.dp) else spec
        val overflow = fit < 28.dp
        Row(
            if (overflow) Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()) else Modifier,
            horizontalArrangement = Arrangement.spacedBy(gap),
        ) {
            cards.forEach { card ->
                val key = card.dbKey ?: return@forEach
                val on = key == selected
                GameTileSquare(
                    accent = card.accent, label = null, selected = on,
                    modifier = Modifier.size(size).semantics {
                        contentDescription = card.title + if (on) ", selected" else ""
                    },
                    surface = Color.White,
                    chipSize = size * 0.7f,
                    corner = corner,
                    onClick = { onSelect(key) },
                ) { chip -> ModeGlyph(card, card.accent, box = chip * 1.2f) }
            }
        }
    }
}

/** The cross-mode Sweep board chip: soft gold pill; selected = solid gold, white ink. */
@Composable
private fun SweepChip(on: Boolean, onClick: () -> Unit) {
    val ink = if (on) Color.White else LB_SUB
    Row(
        Modifier.height(24.dp).clip(RoundedCornerShape(50))
            .background(if (on) LB_GOLD else LB_GOLD.copy(alpha = 0.18f))
            .gameTilePress(onClick = onClick)
            .padding(horizontal = 10.dp)
            .semantics { contentDescription = "Daily Sweep board" + if (on) ", selected" else "" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(painterResource(com.wordocious.app.R.drawable.ic_broom), null, tint = ink, modifier = Modifier.size(12.dp))
        Text("SWEEP", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = ink, maxLines = 1)
    }
}

/** `0 4 14 rgba(146,64,14,0.10)`, drawn unclipped before the card clips itself. */
private fun Modifier.leaderboardBannerShadow(): Modifier = drawBehind {
    val r = 16.dp.toPx()
    val dy = 4.dp.toPx()
    drawIntoCanvas { canvas ->
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            color = Color(0xFF92400E).copy(alpha = 0.10f).toArgb()
            maskFilter = android.graphics.BlurMaskFilter(14.dp.toPx() / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL)
        }
        canvas.nativeCanvas.drawRoundRect(0f, dy, size.width, size.height + dy, r, r, paint)
    }
}

// ── The Records banner (docs/RECORDS_REDESIGN_SPEC.md §1) ───────────────────

private val REC_INK = Color(0xFF4C1D95)
private val REC_SUB = Color(0xFF6D28D9)

/**
 * The all-time Records banner: lilac-to-gold one window (the Leaderboard banner's
 * chrome and game rows), a frosted strip with the trophy + ALL-TIME RECORDS and the
 * DAILY | ALL-TIME switch. The sub line reads THE BEST EVER · N RECORDS on All-Time
 * ([recordCount] null drops the number) and <DAY TITLE> · RESETS IN … on Daily.
 * Replaces the old RECORDS header, the Daily / All-Time toggle row and the mode grid.
 */
@Composable
internal fun RecordsBanner(
    daily: Boolean,
    onDaily: (Boolean) -> Unit,
    selected: String,
    onSelect: (String) -> Unit,
    recordCount: Int? = null,
) {
    val secs by rememberMidnightCountdown()
    val day = remember(secs / 60) { com.wordocious.app.todayLocalDate() }
    val dayTitle = remember(day) { leaderboardTitle(day, ProperNoundle.holidayNameForDay(day)) }
    val sub = if (daily) "$dayTitle · RESETS IN ${formatCountdown(secs)}"
        else if (recordCount != null && recordCount > 0) "THE BEST EVER · $recordCount RECORDS"
        else "THE BEST EVER"

    // ART_SPEC §2: the whole-cast ALL-TIME RECORDS art replaces the trophy + text title
    // and the banner's host (the cast is on the art); the DAILY | ALL-TIME switch stays below.
    LbBannerShell(Color(0xFFEDE9FE), Color(0xFFFEF3C7)) {
        Column(
            Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f))
                .padding(start = 12.dp, top = 10.dp, end = 10.dp, bottom = 10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { PageTitleArt(TitleArt.RECORDS) }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    sub, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp,
                    color = REC_SUB, maxLines = 2, modifier = Modifier.weight(1f),
                )
                RecordsViewSwitch(daily, onDaily)
            }
        }
        LbGameRows(selected, onSelect, REC_SUB)
    }
}

/** DAILY | ALL-TIME as the home banner's pill switch: violet 12% track, white selected segment. */
@Composable
private fun RecordsViewSwitch(daily: Boolean, onDaily: (Boolean) -> Unit) {
    Row(Modifier.clip(RoundedCornerShape(50)).background(Color(0xFF7C3AED).copy(alpha = 0.12f)).padding(2.dp)) {
        listOf(true to "DAILY", false to "ALL-TIME").forEach { (isDaily, label) ->
            val on = daily == isDaily
            Box(
                Modifier.height(26.dp).clip(RoundedCornerShape(50))
                    .background(if (on) Color.White else Color.Transparent)
                    .clickableNoRipple { onDaily(isDaily) }
                    .padding(horizontal = 10.dp)
                    .semantics { contentDescription = label.lowercase() + if (on) ", selected" else "" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label, fontSize = 10.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
                    color = if (on) REC_INK else Color(0xFF7C3AED), maxLines = 1,
                )
            }
        }
    }
}
