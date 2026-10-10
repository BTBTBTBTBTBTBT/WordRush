package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

// The finishing build, phase 2 — the Leaderboard + Records pieces (FINISH_SPEC A1 / A2 /
// A9 / C2 / C2a, mockup docs/design/brand/mockups/leaderboard-polish.html): the cream
// board card, the soft striped rows, the tinted segmented toggles, the caps section
// labels and the ONE gold result card. Built on FinishKit / FinishPages.

/** The board card's cream wash + line (mockup `--tint:#fff8ef;--tline:#f3e3cf`). */
internal val LB_BOARD_TINT = Color(0xFFFFF8EF)
internal val LB_BOARD_LINE = Color(0xFFF3E3CF)

/** The result card's gold wash + line (mockup `--tint:#fff5df;--tline:#f8e2b4`). */
internal val LB_RESULT_TINT = Color(0xFFFFF5DF)
internal val LB_RESULT_LINE = Color(0xFFF8E2B4)

/** Row inks (mockup `.lrow`): rank #8a78ad, name #2a1650, subtitle #7a6a95. */
internal val LB_RANK_INK = Color(0xFF8A78AD)
internal val LB_SUB_INK = Color(0xFF7A6A95)

/** The board section label ink (mockup `.bhead .t` #8a6a55). */
internal val LB_SECTION_INK = Color(0xFF8A6A55)

/**
 * A1 the board card (cream): radius 20, the cream wash + 1.5 dp line, the soft warm
 * lift. Dark mode keeps the dark surface + border. Fills the width.
 */
internal fun Modifier.lbBoardCard(): Modifier = composed {
    val shape = RoundedCornerShape(20.dp)
    val dark = WTheme.isDark
    this.fillMaxWidth()
        .shadow(6.dp, shape, clip = false, ambientColor = Color(0x1F78350F), spotColor = Color(0x1F78350F))
        .clip(shape)
        .background(if (dark) WTheme.surface else LB_BOARD_TINT)   // BJ7: wash + lift, no outline
}

/**
 * C2 a board row's shell: soft stripes ([index] even = the warm wash, a faint hairline
 * on top of every row but the first — [topRule] decides), your own row a stronger gold tint with a gold
 * edge bar. Fills the width; the row's own padding is inside.
 */
internal fun Modifier.lbStripedRow(index: Int, isCurrentUser: Boolean, topRule: Boolean = index > 0): Modifier = composed {
    val dark = WTheme.isDark
    val base = this.fillMaxWidth()
    if (isCurrentUser) {
        base.drawBehind {
            drawRect(if (dark) LB_GOLD.copy(alpha = 0.18f) else LB_GOLD.copy(alpha = 0.24f))
            drawRect(LB_GOLD, Offset.Zero, Size(4.dp.toPx(), size.height))
            if (topRule) drawRect(LB_GOLD.copy(alpha = 0.3f), Offset.Zero, Size(size.width, 1.dp.toPx()))
        }
    } else {
        base.stripedRow(index, LB_GOLD, first = !topRule)
    }.padding(horizontal = 12.dp, vertical = 8.dp)   // BJ7: was 14 / 10
}

/** The board's caps section label (mockup `.bhead .t`: 12 / 900 / .14em). */
@Composable
internal fun LbBoardLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text, fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.14.em,
        color = if (WTheme.isDark) WTheme.textSecondary else LB_SECTION_INK,
        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = modifier,
    )
}

/**
 * A tinted segmented toggle (Everyone | Friends, Solo | VS, DAILY | ALL-TIME; mockup
 * `.seg`): a warm tinted track, the selected segment light with purple ink and a soft
 * lift; every segment squishes (A9). Announced as tabs with their selected state.
 */
@Composable
internal fun <T> SoftSegment(options: List<Pair<T, String>>, selected: T, small: Boolean = false, onChange: (T) -> Unit) {
    // The button family: every two-way switch is the candy segmented (frosted track + glossy purple thumb).
    // Founder 10-09: `small` = a quiet switch that sits beside another control (Leaderboard's Everyone | Friends): 26 dp, 11 sp labels.
    if (small) CandySegmentedToggle(options, selected, onChange, height = 26.dp, width = 148.dp, fontSize = 11.sp)
    else CandySegmentedToggle(options, selected, onChange, height = 34.dp, width = 168.dp)
}

/** A row's rank number (mockup `.lrow .n`: 15 / 900 #8a78ad, a 28 dp column; medal tints for 1–3). */
@Composable
internal fun LbRankNumber(rank: Int, modifier: Modifier = Modifier) {
    val medal = if (rank in 1..3) PodiumInk.medal(rank) else null
    Box(modifier.width(28.dp), contentAlignment = Alignment.Center) {
        if (medal != null) {
            SoftNumber("$rank", 16.sp, color = if (WTheme.isDark) medal else darkenInk(medal).copy(alpha = 1f))
        } else {
            Text(
                "$rank", fontSize = if (rank >= 1000) 12.sp else 15.sp, fontWeight = FontWeight.Black,
                color = if (WTheme.isDark) WTheme.textMuted else LB_RANK_INK, maxLines = 1, softWrap = false,
            )
        }
    }
}

/** A row's name ink. */
@Composable
internal fun lbNameInk(): Color = if (WTheme.isDark) WTheme.text else FinishInk.heading

/** A row's subtitle ink. */
@Composable
internal fun lbSubInk(): Color = if (WTheme.isDark) WTheme.textMuted else LB_SUB_INK

/** A tinted card in the page gold (A1) for the Records / Leaderboard secondary cards. */
@Composable
internal fun LbTintedCard(
    accent: Color,
    modifier: Modifier = Modifier,
    bar: Boolean = true,
    contentPadding: PaddingValues = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(8.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    TintedCard(
        accent, modifier.fillMaxWidth(),
        bar = if (bar) Brush.horizontalGradient(listOf(accent, Wash.mix(accent, 0.55f))) else null,
        contentPadding = contentPadding,
        verticalArrangement = verticalArrangement,
        content = content,
    )
}

/**
 * C2 THE result card (mockup `.result`, gold): the crown over your "#rank" in soft
 * numbers, then "OF N TODAY" (caps) + [solvedLine] (how you solved it), and your
 * [points] as a big soft number over POINTS on the right. [delta] puts the transient
 * rank-movement pill beside the caps line.
 */
@Composable
internal fun LbResultCard(
    rank: Int,
    ofLine: String,
    solvedLine: String?,
    points: String?,
    modifier: Modifier = Modifier,
    pointsLabel: String = "POINTS",
    delta: (@Composable () -> Unit)? = null,
) {
    val dark = WTheme.isDark
    TintedCard(
        LB_GOLD,
        modifier.fillMaxWidth().semantics(mergeDescendants = true) { },
        bar = Brush.horizontalGradient(listOf(Color(0xFFF5A524), Color(0xFFFFD166))),
        tint = if (dark) WTheme.surface else LB_RESULT_TINT,
        line = if (dark) WTheme.border else LB_RESULT_LINE,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
    ) {
        // BJ7: one top line — crown + rank, the caps line and the points top-aligned;
        // the solve line ONE line 4 under it.
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon3D(Icon3DName.CROWN, 24.dp)
                SoftNumber("#$rank", if (rank >= 1000) 18.sp else 22.sp)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        ofLine, fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.08.em,
                        color = if (dark) WTheme.textSecondary else LB_LABEL, maxLines = 2,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    delta?.invoke()
                }
                if (solvedLine != null) {
                    Text(
                        solvedLine, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold,
                        color = if (dark) WTheme.textMuted else FinishInk.muted, maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (points != null) {
                Column(horizontalAlignment = Alignment.End) {
                    SoftNumber(points, if (points.length > 7) 18.sp else 22.sp)
                    Text(
                        pointsLabel, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.12.em,
                        color = if (dark) WTheme.textSecondary else LB_LABEL, maxLines = 1,
                    )
                }
            }
        }
    }
}

/** The gap between the page's cards (mockup `.scroll { gap: 12px }`). */
internal val LB_CARD_GAP: Dp = 10.dp   // BJ7: was 12
