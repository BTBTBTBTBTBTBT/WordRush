package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.AllInclusive
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
/** ART_SPEC §21.1: the completion badge (same 26 dp art) on the title line. */
private val MODE_CARD_BADGE = 26.dp
private val MODE_CARD_TITLE_LINE = 20.dp
/** §18.2 inner padding under the band (shared with [GameCardFrame], §21.5). */
private val MODE_CARD_PADDING = PaddingValues(start = 8.dp, end = 10.dp, top = 8.dp, bottom = 10.dp)

/** The game card's surface: shadow, radius-18 clip, fill and optional border (ART_SPEC §18.2). */
private fun Modifier.gameCardSurface(bg: Color, border: Color?): Modifier {
    val shape = RoundedCornerShape(MODE_CARD_CORNER)
    return this.cardShadow(MODE_CARD_CORNER).clip(shape).background(bg)
        .then(if (border != null) Modifier.border(1.5.dp, border, shape) else Modifier)
}

/** The thick colored top band across a game card (the card's clip rounds its corners). */
@Composable
private fun GameCardBand(color: Color) {
    Box(Modifier.fillMaxWidth().height(MODE_CARD_BAND).background(color))
}

/** §21.1: a W/L badge (same 26 dp art) centered on a 16 sp title line without making it taller. */
@Composable
internal fun TitleLineBadge(won: Boolean) {
    Box(Modifier.width(MODE_CARD_BADGE).height(MODE_CARD_TITLE_LINE), contentAlignment = Alignment.Center) {
        ResultBadge(won = won, size = MODE_CARD_BADGE, modifier = Modifier.requiredSize(MODE_CARD_BADGE))
    }
}

/**
 * ART_SPEC §21.5: the exact Home game-card treatment for a non-game window (Word of the Day,
 * VS Battle): white surface, radius 18, shadow, the colored top band, the card's inner
 * padding. `done` wears the completed card's accent tint + border, as the game cards do.
 */
@Composable
internal fun GameCardFrame(
    accent: Color,
    modifier: Modifier = Modifier,
    done: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier.fillMaxWidth()
            .gameCardSurface(
                bg = if (done) accent.copy(alpha = 0.06f) else WTheme.surface,
                border = if (done) accent.copy(alpha = 0.4f) else null,
            )
            .then(if (onClick != null) Modifier.clickableNoRipple(onClick) else Modifier),
    ) {
        GameCardBand(accent)
        Column(Modifier.fillMaxWidth().padding(MODE_CARD_PADDING), content = content)
    }
}

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
     *  completion), a small infinity mark on the title line in the card's accent instead (§21.1). */
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

    // ART_SPEC §18.2 (the ChatGPT home mockup): a white rounded card (radius 18) under a
    // THICK 10 dp accent band (the card's clip rounds its top corners), then one row —
    // the glossy game icon at 52 dp (no chip box), the game name (accent, 900, 16) over
    // the one-line description (secondary ink, 12.5, max 2 lines). §21: the W/L badge on
    // the title line, the text column spanning the icon, no chevron. ~84 dp tall. Capped
    // fontScale so large system text keeps the cards short enough that ~6 fit per screen,
    // iOS parity.
    CappedFontScale {
    Box(
        modifier = modifier
            .heightIn(min = MODE_CARD_MIN_HEIGHT)
            .gameCardSurface(cardBg, cardBorder)
            .then(if (isLocked) Modifier.alpha(0.6f) else Modifier)
            .clickableNoRipple(onClick),
    ) {
        Column {
            // The thick accent band across the top.
            GameCardBand(card.accent)
            Row(
                Modifier.fillMaxWidth().padding(MODE_CARD_PADDING),
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
                // ART_SPEC §21.2: the text column is exactly as tall as the icon and pinned to
                // it — title on the icon's top edge, the subtitle's last line on its bottom edge
                // (space between). Taller text grows the card; the row centers the icon on it.
                Column(
                    Modifier.weight(1f).heightIn(min = MODE_CARD_ICON),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    // §21.1: the W/L badge sits at the end of the title line, centered on it;
                    // the title truncates (shrinks) before it rather than running under it.
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // One line, shrink-to-fit: "Crosswordocious" wrapped mid-word at a larger font scale.
                        FitText(
                            card.title, fontSize = 16.sp, fontWeight = FontWeight.Black, color = card.accent,
                            modifier = Modifier.weight(1f),
                        )
                        if (isDone) {
                            Spacer(Modifier.width(4.dp))
                            // Same 26 dp art as before (ART_SPEC §4), centered on the title line
                            // without making the line taller (the title's top stays on the icon's).
                            TitleLineBadge(doneWon)
                        } else if (unlimited && !isLocked) {
                            // Pro Unlimited's infinity mark takes the badge's place on the title line.
                            Spacer(Modifier.width(4.dp))
                            Icon(
                                androidx.compose.material.icons.Icons.Filled.AllInclusive, contentDescription = null,
                                tint = card.accent, modifier = Modifier.size(14.dp),
                            )
                        }
                    }
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
                // ART_SPEC §21.4: no trailing ">" chevron — the whole card is the tap target.
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
