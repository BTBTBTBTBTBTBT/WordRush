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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

/**
 * Shared visual grammar for the Profile + Records stat pages — ports
 * components/profile/stat-kit.tsx (and iOS StatKit.swift). Every section uses
 * SectionHeader; every stat cell uses StatCell; every chart sits in a
 * ChartCard; every Pro gate uses ProLockOverlay. One look, defined once.
 */

/** Uppercase tracked section label with an accent tick + optional right control. */
@Composable
fun SectionHeader(
    label: String,
    accent: Color = WTheme.primary,
    right: (@Composable () -> Unit)? = null,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(4.dp).height(14.dp).clip(RoundedCornerShape(50)).background(accent))
        Spacer(Modifier.width(8.dp))
        Text(
            label.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black,
            color = WTheme.textMuted, letterSpacing = 1.2.sp,
        )
        Spacer(Modifier.weight(1f))
        right?.invoke()
    }
}

/**
 * The standard card surface: 16dp radius, 1.5dp border, optional 3dp top
 * accent bar (mode color), like the leaderboard card.
 */
@Composable
fun KitCard(
    accent: Color? = null,
    padded: Boolean = true,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
    ) {
        if (accent != null) Box(Modifier.fillMaxWidth().height(3.dp).background(accent))
        Column(Modifier.fillMaxWidth().padding(if (padded) 16.dp else 0.dp), content = content)
    }
}

/** One stat: icon, big value, small uppercase label, optional sub line. */
@Composable
fun StatCell(
    icon: ImageVector?,
    label: String,
    value: String,
    sub: String? = null,
    color: Color? = null,
    modifier: Modifier = Modifier,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        if (icon != null) Icon(icon, null, tint = color ?: WTheme.textMuted, modifier = Modifier.size(16.dp))
        Text(
            value, fontSize = 18.sp, fontWeight = FontWeight.Black,
            color = if (icon == null) (color ?: WTheme.text) else WTheme.text, maxLines = 1,
        )
        Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, letterSpacing = 0.4.sp, maxLines = 1)
        // Always reserve the sub line so grids of cells stay equal-height.
        Text(sub ?: " ", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
    }
}

/** One stat for a [StatGrid] row. */
data class KitStat(
    val icon: ImageVector?,
    val label: String,
    val value: String,
    val sub: String? = null,
    val color: Color? = null,
)

/** Grid of StatCells on one KitCard (defaults 4-up like the summary row). */
@Composable
fun StatGrid(stats: List<KitStat>, cols: Int = 4, accent: Color? = null) {
    KitCard(accent = accent) {
        stats.chunked(cols).forEachIndexed { i, row ->
            if (i > 0) Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { s ->
                    StatCell(s.icon, s.label, s.value, s.sub, s.color, Modifier.weight(1f))
                }
                repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** Chart frame: title row + optional timeframe hint + consistent empty state. */
@Composable
fun ChartCard(
    title: String,
    hint: String? = null,
    /** When set, renders the empty-state message instead of children. */
    empty: String? = null,
    accent: Color? = null,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    KitCard(accent = accent) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Spacer(Modifier.weight(1f))
            if (hint != null) Text(hint, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Spacer(Modifier.height(8.dp))
        if (empty != null) {
            Text(
                empty, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), textAlign = TextAlign.Center,
            )
        } else {
            content()
        }
    }
}

/**
 * The single Pro gate: blurred sample content + a gradient lock pill that
 * opens the Pro screen. Ports stat-kit.tsx ProLockOverlay / iOS ProLockOverlay.
 * (Modifier.blur needs API 31; older devices still get the 0.6-alpha dim +
 * the lock pill over static sample data, so nothing real ever leaks.)
 */
@Composable
fun ProLockOverlay(
    label: String = "Unlock with Pro",
    onGoPro: () -> Unit,
    content: @Composable () -> Unit,
) {
    Box(Modifier.fillMaxWidth()) {
        Box(
            Modifier.fillMaxWidth().blur(3.dp).alpha(0.6f)
                .clearAndSetSemantics { },
        ) { content() }
        // Transparent scrim eats taps on the blurred content underneath.
        Box(Modifier.matchParentSize().clickableNoRipple(onGoPro))
        Row(
            Modifier.align(Alignment.Center).clip(RoundedCornerShape(50))
                .background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899))))
                .clickableNoRipple(onGoPro).padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text("🔒", fontSize = 11.sp)
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White)
        }
    }
}
