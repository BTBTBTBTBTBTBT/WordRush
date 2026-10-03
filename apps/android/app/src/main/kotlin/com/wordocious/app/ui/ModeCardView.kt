package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.offset
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

/**
 * FINISH_SPEC BH: the compact Home game card (was ~104 dp with a 52 icon and a 2-line subtitle)
 * and its candy cap trim. One set of numbers; mirrors web MODE_CARD + lib/card-trim.ts and iOS
 * HomeCardSpec / CardTrimGeometry (keep the three in step).
 */
internal object HomeCardSpec {
    const val HEIGHT = 74f
    const val RADIUS = 16f
    const val ICON = 42f
    const val NAME = 17f
    const val DESC = 13f
    const val PAD_X = 10f
    const val GAP = 10f
    const val BADGE = 22f
    /** DAILIES / PUZZLES title art over the compact grid (~25% smaller). */
    const val SECTION_TITLE_SCALE = 0.75f
}

/**
 * BH1: the trim is ONE shape — a slim band across the card's top whose bottom edge is a row of
 * shallow frosting drips. [segments] walks right → left from the band's bottom-right corner; each
 * drip is a quadratic (control, end) whose control sits 2·drip below the band, so it peaks
 * exactly [DRIP] below it.
 */
internal object CardTrimGeometry {
    const val BAND = 9f
    const val DRIP = 4f
    const val BUMPS = 8

    /** (controlX, controlY, endX, endY) per drip, in card units. */
    fun segments(width: Float, band: Float = BAND, drip: Float = DRIP, bumps: Int = BUMPS): List<FloatArray> {
        val bw = width / bumps
        return (bumps - 1 downTo 0).map { i -> floatArrayOf((i + 0.5f) * bw, band + 2 * drip, i * bw, band) }
    }
}

private val MODE_CARD_CORNER = HomeCardSpec.RADIUS.dp
private val MODE_CARD_BAND = CardTrimGeometry.BAND.dp
private val MODE_CARD_ICON = HomeCardSpec.ICON.dp
private val MODE_CARD_MIN_HEIGHT = HomeCardSpec.HEIGHT.dp
/** ART_SPEC §21.1: the completion badge on the VS card's title line. */
private val MODE_CARD_BADGE = 26.dp
private val MODE_CARD_TITLE_LINE = 20.dp
/** §18.2 inner padding under the trim (shared with [GameCardFrame], §21.5). */
private val MODE_CARD_PADDING = PaddingValues(start = 8.dp, end = 10.dp, top = 10.dp, bottom = 10.dp)

/** The game card's surface: shadow, radius-16 clip and fill — NO stroke (FINISH_SPEC BH4). */
private fun Modifier.gameCardSurface(bg: Color): Modifier {
    val shape = RoundedCornerShape(MODE_CARD_CORNER)
    return this.cardShadow(MODE_CARD_CORNER).clip(shape).background(bg)
}

/**
 * FINISH_SPEC A1: a game card is never plain white — an untouched card takes a soft
 * wash of its accent (13% over white); a completed daily a stronger wash (20%). Dark
 * mode keeps the dark surface (and the completed card's faint accent tint). BH4: no
 * outline any more.
 */
internal fun gameCardBg(accent: Color, done: Boolean): Color = when {
    WTheme.isDark -> if (done) accent.copy(alpha = 0.06f) else WTheme.surface
    done -> Wash.mix(accent, 0.20f)
    else -> Wash.mix(accent, Wash.CARD)
}

private val TRIM_LOCKED = listOf(Color(0xFFE5E7EB), Color(0xFFC9CED6))

/**
 * FINISH_SPEC BH1: the candy cap trim — ONE static path (cached per size) filled with the candy
 * gradient: a light glossy lip (the highlight, baked in) → the game's color → a deeper base,
 * with frosting drips along its bottom. No blur, no shadow, no animation. Takes [MODE_CARD_BAND]
 * of the layout; the drips hang over the content's top padding.
 */
@Composable
private fun CardTrim(color: Color, locked: Boolean = false) {
    Box(
        Modifier.fillMaxWidth().height(MODE_CARD_BAND).wrapContentHeight(Alignment.Top, unbounded = true)
            .height((CardTrimGeometry.BAND + CardTrimGeometry.DRIP).dp)
            .drawWithCache {
                val u = density
                val path = Path().apply {
                    moveTo(0f, 0f)
                    lineTo(size.width, 0f)
                    lineTo(size.width, CardTrimGeometry.BAND * u)
                    for (seg in CardTrimGeometry.segments(size.width / u)) {
                        quadraticTo(seg[0] * u, seg[1] * u, seg[2] * u, seg[3] * u)
                    }
                    close()
                }
                val brush = if (locked) Brush.verticalGradient(TRIM_LOCKED) else Brush.verticalGradient(
                    0f to Wash.mix(color, 0.45f),
                    0.42f to color,
                    1f to Color(TintMath.over(color.copy(alpha = 1f).toArgb(), 0.86f, 0xFF000000.toInt())),
                )
                onDrawBehind { drawPath(path, brush) }
            },
    )
}

/** §21.1: a W/L badge (same 26 dp art) centered on a 16 sp title line without making it taller. */
@Composable
internal fun TitleLineBadge(won: Boolean) {
    Box(Modifier.width(MODE_CARD_BADGE).height(MODE_CARD_TITLE_LINE), contentAlignment = Alignment.Center) {
        ResultBadge(won = won, size = MODE_CARD_BADGE, modifier = Modifier.requiredSize(MODE_CARD_BADGE))
    }
}

/**
 * ART_SPEC §21.5: the exact Home game-card treatment for a non-game window (VS Battle):
 * the accent wash, radius 16, shadow, the candy cap trim, the card's inner padding.
 * `done` wears the completed card's stronger wash, as the game cards do.
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
        // A9: the whole card squishes (the press leads the chain).
        modifier.then(if (onClick != null) Modifier.squishClickable(card = true, onClick = onClick) else Modifier)
            .fillMaxWidth()
            .gameCardSurface(bg = gameCardBg(accent, done)),
    ) {
        CardTrim(accent)
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
     *  completion) and, since FINISH_SPEC Y, no infinity mark either. */
    unlimited: Boolean = false,
    onVs: () -> Unit,
    onClick: () -> Unit,
) {
    // VS has no solo completion row; vsWon carries today's daily-VS outcome.
    val vsDone = vsWon != null
    val isDone = completion != null || vsDone
    val doneWon = completion?.completed ?: (vsWon == true)
    // Completed daily: a stronger wash in the mode's accent (web parity). Locked (free
    // user, played today): dimmed 60% with a gray trim and muted name (web / iOS parity).
    val cardBg = gameCardBg(card.accent, isDone)

    // FINISH_SPEC BH (the compact card; web mode-card.tsx, iOS ModeCardView.swift): 74 dp,
    // radius 16, no stroke, the candy cap trim across the rounded top; under it one row
    // centered in the rest of the card — the glossy game icon at 42 dp with today's W / L
    // badge on its bottom-right corner, then the name (accent, 900, 17, ONE line, shrinking
    // for long names) over ONE muted subtitle line (13, ellipsis). No chevron (§21.4).
    // Capped fontScale so large system text keeps the cards short, iOS parity.
    CappedFontScale {
    Box(
        // A9: the whole card squishes (the press leads the chain).
        modifier = modifier
            .squishClickable(card = true, onClick = onClick)
            .heightIn(min = MODE_CARD_MIN_HEIGHT)
            .gameCardSurface(cardBg)
            .then(if (isLocked) Modifier.alpha(0.6f) else Modifier),
    ) {
        Column {
            CardTrim(if (isLocked) Color(0xFFD1D5DB) else card.accent, locked = isLocked)
            Row(
                Modifier.fillMaxWidth().heightIn(min = MODE_CARD_MIN_HEIGHT - MODE_CARD_BAND)
                    .padding(horizontal = HomeCardSpec.PAD_X.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // The glossy 3D game icon (ART_SPEC §3) on its own; the old glyph only as a fallback.
                Box(Modifier.size(MODE_CARD_ICON)) {
                    val art = gameArtRes(card.id)
                    if (art != null) {
                        androidx.compose.foundation.Image(
                            androidx.compose.ui.res.painterResource(art), contentDescription = null,
                            modifier = Modifier.size(MODE_CARD_ICON),
                        )
                    } else {
                        Box(Modifier.size(MODE_CARD_ICON), contentAlignment = Alignment.Center) {
                            ModeGlyph(card, card.accent, box = 36.dp)
                        }
                    }
                    // BH2: today's W / L badge rides the icon's corner, so the name gets the full width.
                    if (isDone && !unlimited) {
                        ResultBadge(
                            won = doneWon, size = HomeCardSpec.BADGE.dp,
                            modifier = Modifier.align(Alignment.BottomEnd).offset(x = 6.dp, y = 5.dp)
                                .requiredSize(HomeCardSpec.BADGE.dp),
                        )
                    }
                }
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    // One line, shrink-to-fit (Crosswordocious, ProperNoundle), never wraps.
                    FitText(
                        card.title, fontSize = HomeCardSpec.NAME.sp, fontWeight = FontWeight.Black,
                        color = if (isLocked) WTheme.textMuted else card.accent, minScale = 0.6f,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    // Completed daily shows guesses · time; else the mode description (web parity).
                    Text(
                        subtitleOverride ?: if (completion != null) {
                            // Through the mode's guess semantics (Sudoku reads "0 mistakes",
                            // Letter Ladder "Par") — the shared cross-platform formatter.
                            "${formatGuessStat(card.guessSemantics, card.guessBase, completion.guessCount)} · ${formatShortTime(completion.timeSeconds)}"
                        } else if (vsDone) "Played today" else card.desc,
                        fontSize = HomeCardSpec.DESC.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium, color = WTheme.textMuted,
                        maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis,
                    )
                }
                // ART_SPEC §21.4: no trailing ">" chevron — the whole card is the tap target.
            }
        }

        // VS swords button (Pro + Unlimited) — quick-match this mode (web parity).
        if (showVs) {
            // FINISH_SPEC A8: a small round teal candy button (was a flat tinted square).
            CandyRoundButton(
                "VS", onClick = onVs, color = CandyColor.TEAL, diameter = 30.dp,
                modifier = Modifier.align(Alignment.BottomEnd).padding(6.dp),
            ) {
                Icon(
                    androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_swords),
                    contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp),
                )
            }
        }
    }
    }
}
