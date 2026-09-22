package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.ui.theme.WTheme

/**
 * The home-grid mode card, moved verbatim out of HomeScreen.kt (More Games
 * Stage 5) so the More Games sheet renders the SAME card dp for dp. Daily
 * completion (W/L badge, "4 guesses · 27s", accent tint) is a DAILY-only
 * concept: callers pass `completion`/`vsWon` only in Daily mode.
 *
 * `subtitleOverride` is the More Games tile's "N of M played" line, which
 * replaces the description (that tile never locks and never tints).
 */
@Composable
internal fun ModeCardView(
    card: ModeCard,
    completion: DailyCompletionsService.Completion?,
    isLocked: Boolean,
    showVs: Boolean,
    modifier: Modifier,
    vsWon: Boolean? = null,
    subtitleOverride: String? = null,
    onVs: () -> Unit,
    onClick: () -> Unit,
) {
    // VS has no solo completion row; vsWon carries today's daily-VS outcome.
    val vsDone = vsWon != null
    val isDone = completion != null || vsDone
    val doneWon = completion?.completed ?: (vsWon == true)
    // Completed daily: soft tint in the mode's accent + accent border (web parity).
    // Locked (free user, played today): dimmed 60% + gray border.
    val cardBg = if (isDone) card.accent.copy(alpha = 0.06f) else WTheme.surface
    val cardBorder = if (isLocked) Color(0xFFD1D5DB) else if (isDone) card.accent.copy(alpha = 0.4f) else WTheme.border

    // Card chrome (icon tile, name, one stat line — a fixed visual like the iOS
    // grid): capped fontScale so large system text keeps the cards short enough
    // that ~6 fit per screen, iOS parity.
    CappedFontScale {
    Box(
        modifier = modifier
            .cardShadow(14.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(cardBg)
            .border(1.5.dp, cardBorder, RoundedCornerShape(14.dp))
            .then(if (isLocked) Modifier.alpha(0.6f) else Modifier)
            .clickableNoRipple(onClick),
    ) {
        // Top accent bar (web h-1 gradient accent → accent88)
        Box(
            modifier = Modifier.fillMaxWidth().height(4.dp)
                .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
                .background(Brush.horizontalGradient(listOf(card.accent, card.accent.copy(alpha = 0.53f)))),
        )
        Column(modifier = Modifier.padding(12.dp)) {
            // Icon box (8x8 rounded, accent @ ~8% bg)
            Box(
                modifier = Modifier.size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(card.accent.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center,
            ) {
                ModeGlyph(card, card.accent, box = 32.dp)
            }
            Spacer(Modifier.height(8.dp))
            Text(card.title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            // Completed daily shows guesses · time; else the mode description (web parity).
            Text(
                subtitleOverride ?: if (completion != null) {
                    // Through the mode's guess semantics (Sudoku reads "0 mistakes",
                    // Letter Ladder "Par") — the shared cross-platform formatter.
                    "${formatGuessStat(card.guessSemantics, card.guessBase, completion.guessCount)} · ${formatShortTime(completion.timeSeconds)}"
                } else if (vsDone) "Played today" else card.desc,
                fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
            )
        }

        // W/L pill top-right when today's daily is on the books (web parity).
        if (isDone) {
            Box(
                // iOS keeps the badge inside the 12pt content padding, below the
                // 4pt accent bar — not flush against the card corner.
                modifier = Modifier.align(Alignment.TopEnd).padding(top = 16.dp, end = 12.dp)
                    .size(20.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (doneWon) Color(0xFF7C3AED) else Color(0xFFDC2626)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (doneWon) "W" else "L",
                    fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White,
                )
            }
        }

        // VS swords button (Pro + Unlimited) — quick-match this mode (web parity).
        if (showVs) {
            Box(
                modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp).size(26.dp)
                    .clip(RoundedCornerShape(8.dp)).background(Color(0xFF0D9488).copy(alpha = 0.12f))
                    .border(1.dp, Color(0xFF0D9488).copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                    .clickableNoRipple(onVs),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords),
                    contentDescription = "VS", tint = Color(0xFF0D9488), modifier = Modifier.size(14.dp),
                )
            }
        }
    }
    }
}
