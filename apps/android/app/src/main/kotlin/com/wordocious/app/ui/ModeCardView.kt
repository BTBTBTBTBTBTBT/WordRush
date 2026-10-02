package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.AllInclusive
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.ui.theme.WTheme

/** ART_SPEC §18.2 the home game card's geometry (the ChatGPT home mockup). */
private val MODE_CARD_CORNER = 18.dp
private val MODE_CARD_BAND = 10.dp
private val MODE_CARD_ICON = 52.dp
private val MODE_CARD_MIN_HEIGHT = 84.dp

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
    /** Pro's Unlimited mode (home redesign, founder 2026-10-01): no badges (callers pass no
     *  completion), a small infinity mark top-right in the card's accent instead. */
    unlimited: Boolean = false,
    onVs: () -> Unit,
    onClick: () -> Unit,
) {
    // VS has no solo completion row; vsWon carries today's daily-VS outcome.
    val vsDone = vsWon != null
    val isDone = completion != null || vsDone
    val doneWon = completion?.completed ?: (vsWon == true)
    // Completed daily: soft tint in the mode's accent + accent border (web parity).
    // Locked (free user, played today): dimmed 60% + gray border. ART_SPEC §18.2: an
    // untouched card is plain white (no border), as in the mockup.
    val cardBg = if (isDone) card.accent.copy(alpha = 0.06f) else WTheme.surface
    val cardBorder = if (isLocked) Color(0xFFD1D5DB) else if (isDone) card.accent.copy(alpha = 0.4f) else null
    val shape = RoundedCornerShape(MODE_CARD_CORNER)

    // ART_SPEC §18.2 (the ChatGPT home mockup): a white rounded card (radius 18) under a
    // THICK 10 dp accent band (the card's clip rounds its top corners), then one row —
    // the glossy game icon at 52 dp (no chip box), the game name (accent, 900, 16) over
    // the one-line description (secondary ink, 12.5, max 2 lines), a small chevron at
    // the right. ~84 dp tall. Capped fontScale so large system text keeps the cards
    // short enough that ~6 fit per screen, iOS parity.
    CappedFontScale {
    Box(
        modifier = modifier
            .heightIn(min = MODE_CARD_MIN_HEIGHT)
            .cardShadow(MODE_CARD_CORNER)
            .clip(shape)
            .background(cardBg)
            .then(if (cardBorder != null) Modifier.border(1.5.dp, cardBorder, shape) else Modifier)
            .then(if (isLocked) Modifier.alpha(0.6f) else Modifier)
            .clickableNoRipple(onClick),
    ) {
        Column {
            // The thick accent band across the top.
            Box(Modifier.fillMaxWidth().height(MODE_CARD_BAND).background(card.accent))
            Row(
                Modifier.fillMaxWidth().padding(start = 8.dp, end = 6.dp, top = 8.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // The glossy 3D game icon (ART_SPEC §3) on its own; the old glyph only as a fallback.
                val art = gameArtRes(card.id)
                if (art != null) {
                    androidx.compose.foundation.Image(
                        androidx.compose.ui.res.painterResource(art), contentDescription = null,
                        modifier = Modifier.size(MODE_CARD_ICON),
                    )
                } else {
                    Box(Modifier.size(MODE_CARD_ICON), contentAlignment = Alignment.Center) {
                        ModeGlyph(card, card.accent, box = MODE_CARD_ICON)
                    }
                }
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    // One line, shrink-to-fit: "Crosswordocious" wrapped mid-word at a larger font scale.
                    FitText(card.title, fontSize = 16.sp, fontWeight = FontWeight.Black, color = card.accent)
                    // Completed daily shows guesses · time; else the mode description (web parity).
                    Text(
                        subtitleOverride ?: if (completion != null) {
                            // Through the mode's guess semantics (Sudoku reads "0 mistakes",
                            // Letter Ladder "Par") — the shared cross-platform formatter.
                            "${formatGuessStat(card.guessSemantics, card.guessBase, completion.guessCount)} · ${formatShortTime(completion.timeSeconds)}"
                        } else if (vsDone) "Played today" else card.desc,
                        fontSize = 12.5.sp, lineHeight = 15.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary,
                        maxLines = 2, overflow = TextOverflow.Ellipsis,
                    )
                }
                Icon(
                    androidx.compose.material.icons.Icons.Filled.ChevronRight, contentDescription = null,
                    tint = WTheme.textMuted, modifier = Modifier.size(18.dp),
                )
            }
        }

        if (unlimited && !isLocked) {
            // Just under the band, above the chevron.
            Icon(
                androidx.compose.material.icons.Icons.Filled.AllInclusive, contentDescription = null,
                tint = card.accent,
                modifier = Modifier.align(Alignment.TopEnd).padding(top = 14.dp, end = 8.dp).size(14.dp),
            )
        }

        // W/L badge top-right when today's daily is on the books (web parity): the
        // 3D badge-w / badge-l at 26 dp (ART_SPEC §4), §18.2 in the top-right corner
        // riding over the accent band.
        if (isDone) {
            ResultBadge(
                won = doneWon, size = 26.dp,
                modifier = Modifier.align(Alignment.TopEnd).padding(top = 2.dp, end = 6.dp),
            )
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
