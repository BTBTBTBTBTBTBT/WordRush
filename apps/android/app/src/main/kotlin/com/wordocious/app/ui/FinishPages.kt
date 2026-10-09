package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.WTheme

// The finishing build, phase 2 (docs/FINISH_SPEC.md A6, C2–C6): the shared page parts
// the Leaderboard, Stats, Friends and footer pages are rebuilt from — the full-width
// headline titles, THE one game picker (Leaderboard + Stats), the W / L badge column,
// the medal podium, striped rows and tinted stat pills. Visual reference:
// docs/design/brand/mockups/leaderboard-polish.html + stats-friends-polish.html +
// finishing-touches.html. Mirrors the web and iOS finishing kits.

// ── A6 + N1 · page titles are calm, centered headlines ───────────────────

/**
 * N1 (founder 10-02, "a calmer top"): the living cast row is the only whole-cast art;
 * page titles (now lettering only) are smaller centered headlines — ≈62% of the content
 * width, at most 300 dp wide and 64 dp tall; the Leaderboard day title (it keeps its
 * single host) ≈58% / at most 150 dp tall. Pure, unit-tested: the size for content
 * [contentW] (dp) and an art [aspect] (w / h).
 */
object HeadlineSize {
    const val PAGE_FRACTION = 0.62f
    const val PAGE_MAX_W = 300f
    const val PAGE_MAX_H = 64f
    /** BJ7: a page's top title (PageHeadline) caps at 52 tall — crisper headers (the Home
     *  section titles keep PAGE_MAX_H through PageTitleArt). */
    const val PAGE_TITLE_H = 52f
    const val DAY_FRACTION = 0.58f
    const val DAY_MAX_H = 150f

    /** (width, height) in dp: fit the art inside the headline box, aspect kept. */
    fun fit(contentW: Float, aspect: Float, day: Boolean = false): Pair<Float, Float> {
        val a = aspect.coerceAtLeast(0.1f)
        val maxW = if (day) contentW * DAY_FRACTION else minOf(contentW * PAGE_FRACTION, PAGE_MAX_W)
        val maxH = if (day) DAY_MAX_H else PAGE_MAX_H
        val w = minOf(maxW, maxH * a)
        return w to w / a
    }
}

/** The weekday day-title arts (each keeps its single host — N1's day rule). */
private val DAY_TITLE_RES: Set<Int> = setOf(
    R.drawable.art_day_monday, R.drawable.art_day_tuesday, R.drawable.art_day_wednesday, R.drawable.art_day_thursday,
    R.drawable.art_day_friday, R.drawable.art_day_saturday, R.drawable.art_day_sunday,
)

/**
 * A6 + N1 a page / day title as a headline: right on the wallpaper (no box, no stage, no
 * border, no float), centered, sized by [HeadlineSize] (a weekday day title by the day
 * rule). [bleed] is accepted for older callers and no longer used (titles are no longer
 * edge to edge). TalkBack reads [contentDescription] as a heading.
 */
@Composable
fun PageHeadline(
    @DrawableRes res: Int,
    contentDescription: String,
    modifier: Modifier = Modifier,
    @Suppress("UNUSED_PARAMETER") bleed: Dp = 0.dp,
    day: Boolean = res in DAY_TITLE_RES,
    /** AU2: cap the art's height (width follows the aspect). */
    maxHeight: Dp? = null,
) {
    val painter = artPainter(res, androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp)
    val intrinsic = painter.intrinsicSize
    val aspect = if (intrinsic.height > 0f && intrinsic.width > 0f) intrinsic.width / intrinsic.height else 4f
    BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val (w0, h0) = HeadlineSize.fit(maxWidth.value, aspect, day)
        val cap = maxHeight?.value ?: if (day) null else HeadlineSize.PAGE_TITLE_H
        val (w, h) = if (cap != null && h0 > cap) (cap * aspect) to cap else w0 to h0
        Image(
            painter,
            contentDescription = contentDescription,
            contentScale = ContentScale.Fit,
            modifier = Modifier.size(w.dp, h.dp).semantics { heading() },
        )
    }
}

/** A6 + N1 [PageHeadline] for one of the page titles. */
@Composable
fun PageHeadline(art: TitleArt, modifier: Modifier = Modifier, bleed: Dp = 0.dp, contentDescription: String = art.label) =
    PageHeadline(art.res, contentDescription, modifier, bleed)

/**
 * Lay the element out [bleed] wider on each side than the width its parent gives it
 * (the parent's side padding), centered. Capped at [TITLE_ART_MAX_WIDTH].
 */
fun Modifier.bleedWidth(bleed: Dp): Modifier = this.layout { measurable, constraints ->
    if (!constraints.hasBoundedWidth) {
        val p = measurable.measure(constraints)
        return@layout layout(p.width, p.height) { p.place(0, 0) }
    }
    val extra = bleed.roundToPx() * 2
    val w = (constraints.maxWidth + extra).coerceAtMost(TITLE_ART_MAX_WIDTH.roundToPx().coerceAtLeast(constraints.maxWidth))
    val p = measurable.measure(constraints.copy(minWidth = w, maxWidth = w))
    layout(constraints.maxWidth, p.height) { p.place((constraints.maxWidth - w) / 2, 0) }
}

/** Kept for older callers: the How to Play title's aspect. */
const val FOOTER_TITLE_ASPECT = 900f / 122f

/**
 * C6 + N1 the footer-page title: the page's own lettering by the shared headline rule
 * (every footer title fits the same ≤ 64 dp box, so they stand at one height unless a
 * very wide word is width-limited).
 */
@Composable
fun FooterHeadline(art: TitleArt, modifier: Modifier = Modifier, bleed: Dp = 0.dp) =
    PageHeadline(art, modifier, bleed)

/** The seven footer / info pages' own titles (C6), all shipped. */
val FOOTER_TITLES: List<TitleArt> = listOf(
    TitleArt.HOWTO, TitleArt.GUIDES, TitleArt.STRATEGY, TitleArt.WORDS, TitleArt.FAQ, TitleArt.PRIVACY, TitleArt.TERMS,
)

// ── C2 / C2b / C3 · THE game picker (Leaderboard + Stats) ─────────────────

/** C2b the Sweep tile's gold. */
val SWEEP_TILE_ACCENT = Color(0xFFF59E0B)

/** One tile in the picker: a daily game (its catalog card) or the Sweep. */
data class PickerTile(val key: String, val label: String, val accent: Color, @DrawableRes val art: Int?, val card: ModeCard? = null)

/**
 * The picker's two rows (pure order, unit-tested): WORDOCIOUS = the eight sweep dailies
 * in home order + the Sweep as the 9th tile right after Seven ([withSweep]); PUZZLES =
 * the More Games dailies in home order. Keys are the db keys ([sweepKey] for the Sweep).
 */
fun pickerRows(
    wordCards: List<ModeCard>,
    puzzleCards: List<ModeCard>,
    withSweep: Boolean,
    sweepKey: String,
): Pair<List<PickerTile>, List<PickerTile>> {
    fun tile(c: ModeCard) = PickerTile(c.dbKey ?: c.id, com.wordocious.app.ModeGen.byId(c.id)?.shortTitle ?: c.title, c.accent, gameArtRes(c.id), c)
    val words = wordCards.filter { it.dbKey != null }.map(::tile) +
        if (withSweep) listOf(PickerTile(sweepKey, "Daily Sweep", SWEEP_TILE_ACCENT, R.drawable.game_sweep)) else emptyList()
    val puzzles = puzzleCards.filter { it.dbKey != null }.map(::tile)
    return words to puzzles
}

/**
 * C2 / C3 THE game picker window, shared by the Leaderboard and the Stats page: a
 * tinted card ([accent], A1) whose top strip carries the page's [header] row (the
 * Leaderboard's date · reset clock + ALL-TIME; the Stats page's Today | All-time
 * toggle), then WORDOCIOUS (the eight dailies + the Sweep tile, C2b) and PUZZLES (the
 * More Games dailies), every game visible at once — the tiles shrink to fit, never a
 * scrolling rail. Tiles are mini game cards tinted by game; the selected one takes the
 * stronger tint + accent ring. [badge] puts a small W / L / ✓ on a tile (Stats: today's
 * result); [selected] matches a tile key (db key, or [sweepKey]).
 */
@Composable
fun GamePickerCard(
    selected: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = SWEEP_TILE_ACCENT,
    labelColor: Color = Color(0xFF8A4A12),
    withSweep: Boolean = true,
    sweepKey: String = "SWEEP",
    badge: ((String) -> Boolean?)? = null,
    badgeShown: ((String) -> Boolean)? = null,
    sweepLabel: String = "Daily Sweep board",
    header: (@Composable RowScope.() -> Unit)? = null,
    /** BB3: the dense grid (tighter padding / gaps, smaller labels — the Leaderboard's ~30–32 dp tiles). */
    dense: Boolean = false,
    /** BB1: the card's centered title under the header strip (Stats: the selected game's title art). */
    title: (@Composable () -> Unit)? = null,
    /** 11b: no card chrome and no header strip — the picker sits directly on the Leaderboard stage's backdrop. */
    bare: Boolean = false,
) {
    val flagTable by com.wordocious.app.data.FlagsService.flags.collectAsState()
    val flagsLoaded by com.wordocious.app.data.FlagsService.loaded.collectAsState()
    // Item 35: both rows follow the player's own game order.
    val savedOrder by com.wordocious.app.data.GameOrderStore.prefs.collectAsState()
    val wordCards = com.wordocious.app.data.GameOrderStore.ordered(MODE_CARDS.filter {
        !it.homeWide && it.dbKey != null && com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded)
    }, com.wordocious.core.GameOrderSection.DAILIES) { it.id }
    val puzzleCards = com.wordocious.app.data.GameOrderStore.ordered(moreDailyModes(MORE_CARDS.filter { com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) }), com.wordocious.core.GameOrderSection.PUZZLES) { it.id }
    val (words, puzzles) = pickerRows(wordCards, puzzleCards, withSweep, sweepKey)
    val dark = WTheme.isDark
    val shape = RoundedCornerShape(20.dp)
    CappedFontScale {
        Column(
            if (bare) modifier.fillMaxWidth() else modifier.fillMaxWidth()
                .shadow(6.dp, shape, clip = false, ambientColor = Color(0x1F78350F), spotColor = Color(0x1F78350F))
                .clip(shape)
                .background(accentWash(accent, 0.10f))
                .border(1.5.dp, accentLine(accent), shape),
        ) {
            if (header != null && !bare) {
                Row(
                    Modifier.fillMaxWidth()
                        .background(if (dark) WTheme.surface else Wash.mix(accent, 0.18f))
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    content = header,
                )
            }
            if (title != null) {
                Box(Modifier.fillMaxWidth().padding(top = 8.dp, start = 12.dp, end = 12.dp), contentAlignment = Alignment.Center) { title() }
            }
            Column(
                Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = if (bare) 4.dp else if (dense) 7.dp else 12.dp, bottom = if (bare) 6.dp else if (dense) 9.dp else 14.dp),
                verticalArrangement = Arrangement.spacedBy(if (dense) 4.dp else 8.dp),
            ) {
                PickerLabel("WORDOCIOUS", labelColor)
                // 2.8 item 8: both rows share ONE tile size (sized for the longer row) and one gap, centered.
                val slots = maxOf(words.size, puzzles.size)
                PickerRow(words, selected, onSelect, gap = 6.dp, corner = 12.dp, badge = badge, badgeShown = badgeShown, sweepLabel = sweepLabel, slots = slots)
                PickerLabel("PUZZLES", labelColor, Modifier.padding(top = if (dense) 2.dp else 4.dp))
                PickerRow(puzzles, selected, onSelect, gap = 6.dp, corner = 12.dp, badge = badge, badgeShown = badgeShown, sweepLabel = sweepLabel, slots = slots)
            }
        }
    }
}

@Composable
private fun PickerLabel(text: String, color: Color, modifier: Modifier = Modifier) {
    Text(
        text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.12.em,
        color = if (WTheme.isDark) WTheme.textSecondary else color, maxLines = 1, modifier = modifier,
    )
}

/** One picker row: the tiles share the width evenly (square, mini game cards). */
@Composable
private fun PickerRow(
    tiles: List<PickerTile>,
    selected: String?,
    onSelect: (String) -> Unit,
    gap: Dp,
    corner: Dp,
    badge: ((String) -> Boolean?)?,
    badgeShown: ((String) -> Boolean)?,
    sweepLabel: String,
    slots: Int = tiles.size,
) {
    if (tiles.isEmpty()) return
    val spare = (slots - tiles.size).coerceAtLeast(0) / 2f
    // Room for the selected tile's 3 dp ring + the press scale.
    Row(Modifier.fillMaxWidth().padding(horizontal = 1.dp), horizontalArrangement = Arrangement.spacedBy(gap)) {
        if (spare > 0f) Spacer(Modifier.weight(spare))
        tiles.forEach { t ->
            PickerTileBox(t, Modifier.weight(1f).aspectRatio(1f), t.key == selected, onSelect, corner, badge, badgeShown, sweepLabel)
        }
        if (spare > 0f) Spacer(Modifier.weight(spare))
    }
}

/** One picker tile (a mini game card tinted by game; the selected one ringed). */
@Composable
private fun PickerTileBox(
    t: PickerTile,
    modifier: Modifier,
    on: Boolean,
    onSelect: (String) -> Unit,
    corner: Dp,
    badge: ((String) -> Boolean?)?,
    badgeShown: ((String) -> Boolean)?,
    sweepLabel: String,
) {
            Box(
                modifier
                    .squishClickable(onClick = { onSelect(t.key) })
                    .semantics(mergeDescendants = true) {
                        role = Role.Tab
                        this.selected = on
                        contentDescription = if (t.art == R.drawable.game_sweep) sweepLabel else t.label
                    },
            ) {
                Box(
                    Modifier.fillMaxSize().miniGameCard(t.accent, corner, selected = on),
                    contentAlignment = Alignment.Center,
                ) {
                    if (t.art != null) {
                        Image(
                            artPainter(t.art, 64.dp), contentDescription = null, // AQ2: ~900 px art at tile size
                            modifier = Modifier.fillMaxSize(0.74f).padding(top = 2.dp),
                        )
                    } else if (t.card != null) {
                        BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            ModeGlyph(t.card, t.accent, box = maxWidth * 0.7f)
                        }
                    }
                }
                val shown = badgeShown?.invoke(t.key) ?: (badge != null)
                if (badge != null && shown) {
                    val won = badge(t.key)
                    if (won != null || badgeShown != null) {
                        ResultBadge(
                            won, size = 14.dp,
                            modifier = Modifier.align(Alignment.TopEnd).offset(x = 3.dp, y = (-3).dp),
                        )
                    }
                }
            }
}

// ── C2a · the W / L badge column ──────────────────────────────────────────

/** C2a the badge column's fixed width (the 18 dp badge + breathing room). */
val RESULT_BADGE_COLUMN: Dp = 22.dp

/**
 * C2a the W / L badge in its own fixed-width column, immediately LEFT of a board row's
 * points, vertically centered — so the badges stack in one even column down the list.
 * [won] null = no badge (the column keeps its space so the points still line up).
 */
@Composable
fun ResultBadgeColumn(won: Boolean?, modifier: Modifier = Modifier, show: Boolean = won != null) {
    Box(modifier.width(RESULT_BADGE_COLUMN), contentAlignment = Alignment.Center) {
        if (show && won != null) {
            ResultBadge(won, size = ROW_RESULT_BADGE_SIZE, contentDescription = if (won) "Won" else "Lost")
        }
    }
}

// ── C2 / C4 · the medal podium + striped rows ─────────────────────────────

/** One podium spot (C2 / C4). [place] 1–3. */
data class PodiumSpot(
    val place: Int,
    val name: String,
    val points: String,
    val username: String?,
    val accentHex: String? = null,
    val emoji: String? = null,
    val onClick: (() -> Unit)? = null,
)

/** The three medal steps: gold / silver / bronze gradients (the mockups' `.s1` `.s2` `.s3`). */
object PodiumInk {
    val gold = listOf(Color(0xFFFFD66B), Color(0xFFF5A524))
    val silver = listOf(Color(0xFFE4E8F0), Color(0xFFAAB3C5))
    val bronze = listOf(Color(0xFFFFC9A0), Color(0xFFD9844A))
    fun step(place: Int): List<Color> = when (place) { 1 -> gold; 2 -> silver; else -> bronze }
    /** The medal color as one solid (chips, badges). */
    fun medal(place: Int): Color = when (place) { 1 -> Color(0xFFF5A524); 2 -> Color(0xFFAAB3C5); else -> Color(0xFFD9844A) }
}

/**
 * C2 / C4 the top-3 podium: second · first · third on gold / silver / bronze steps
 * (first tallest), letter-tile avatars over each step (first bigger, the crown on top),
 * name and soft points under the avatar. [stepScale] shrinks the steps (Friends' race
 * card uses the mockup's smaller set). Fewer than three spots leave their column empty.
 */
@Composable
fun MedalPodium(spots: List<PodiumSpot>, modifier: Modifier = Modifier, stepScale: Float = 1f, avatar: Dp = 44.dp) {
    val byPlace = spots.associateBy { it.place }
    Box(modifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, top = 12.dp)) {
    PodiumFloor(Modifier.align(Alignment.BottomCenter))
    Row(
        Modifier.fillMaxWidth().padding(bottom = PodiumArt.FLOOR_RISE),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        listOf(2, 1, 3).forEach { place ->
            val s = byPlace[place]
            Column(
                Modifier.weight(1f).then(
                    if (s?.onClick != null) Modifier.squishClickable(label = "${podiumOrdinal(place)} place, ${s.name}, ${s.points}") { s.onClick.invoke() }
                    else if (s != null) Modifier.semantics(mergeDescendants = true) {
                        contentDescription = "${podiumOrdinal(place)} place, ${s.name}, ${s.points}"
                    } else Modifier,
                ),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (s != null) {
                    val a = if (place == 1) avatar * 1.22f else avatar
                    Box(contentAlignment = Alignment.TopCenter) {
                        LetterTileAvatar(
                            s.username ?: s.name, a, Modifier.padding(top = if (place == 1) 18.dp else 0.dp), accentHex = s.accentHex, emoji = s.emoji,
                            pro = isOwnProAvatar(s.username ?: s.name), // AA2
                        )
                        if (place == 1) Icon3D(Icon3DName.CROWN, 26.dp)
                    }
                    Text(
                        s.name, fontSize = 13.sp, fontWeight = FontWeight.Black,
                        color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                    )
                    SoftNumber(s.points, 13.sp)
                }
                val h = when (place) { 1 -> 74.dp; 2 -> 54.dp; else -> 40.dp } * stepScale
                PodiumPedestal(place, h)
            }
        }
    }
    }
}

private fun podiumOrdinal(place: Int) = when (place) { 1 -> "First"; 2 -> "Second"; 3 -> "Third"; else -> "#$place" }

/**
 * C2 / C4 soft striped rows: every other row (by [index]) takes a soft wash of [accent]
 * (the mockups' `.lrow:nth-child(odd)`), with a faint hairline on top of each row after
 * the first. Dark mode keeps a subtle white stripe.
 */
fun Modifier.stripedRow(index: Int, accent: Color, first: Boolean = index == 0): Modifier = this.drawBehind {
    if (index % 2 == 0) {
        drawRect(
            if (WTheme.isDark) Color.White.copy(alpha = 0.04f) else accent.copy(alpha = 0.10f),
        )
    }
    if (!first) drawRect(accent.copy(alpha = 0.14f), Offset.Zero, Size(size.width, 1.dp.toPx()))
}

// ── A1 · tinted pills + stat tiles ────────────────────────────────────────

/**
 * A1 a tinted pill / stat window (`.pill`, `.rpill`, `.pop .st` in the mockups): the
 * accent wash (12%), a 1.5 dp line (30%) and a 4 dp accent band inset across the top.
 */
fun Modifier.tintedPill(accent: Color, corner: Dp = 12.dp): Modifier = composed {
    val shape = RoundedCornerShape(corner)
    this.clip(shape)
        .background(accentWash(accent, 0.12f))
        .drawBehind { drawRect(accent, Offset.Zero, Size(size.width, 4.dp.toPx())) }
    // BI25: no outline (founder: never bordered boxes; overrides A8 for the used-hint pill too).
}

/**
 * A stat tile (C3 / C5 / G): a tinted card in [accent] with an optional 3D [icon] and a
 * caps [label] over a big soft [value] and an optional small [sub] line.
 */
@Composable
fun TintedStatTile(
    accent: Color,
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    icon: Icon3DName? = null,
    sub: String? = null,
    labelColor: Color = darkenInk(accent),
    valueSize: TextUnit = 28.sp,
    bar: Boolean = false,
) {
    TintedCard(
        accent, modifier.semantics(mergeDescendants = true) { },
        bar = if (bar) SolidColor(accent) else null,
        contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (icon != null) Icon3D(icon, 20.dp)
            Text(
                label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.1.em,
                color = if (WTheme.isDark) WTheme.textSecondary else labelColor, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
        SoftNumber(value, valueSize)
        if (sub != null) {
            Text(sub, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted, maxLines = 2)
        }
    }
}

/** A readable label ink for an [accent]: the accent darkened ~45% (the mockups' `--lc`). */
fun darkenInk(accent: Color): Color = Color(TintMath.over(0xFF000000.toInt(), 0.45f, accent.copy(alpha = 1f).toArgb()))

/** A caps section label (11 sp Black, .12em) in [color] — the mockups' `.lbl`. */
@Composable
fun FinishLabel(text: String, modifier: Modifier = Modifier, color: Color = FinishInk.label) {
    Text(
        text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.12.em,
        color = if (WTheme.isDark) WTheme.textSecondary else color, maxLines = 1, overflow = TextOverflow.Ellipsis,
        modifier = modifier,
    )
}

/** A spacer-free helper: a [ColumnScope] gap of [h]. */
@Composable
fun ColumnScope.Gap(h: Dp) = Spacer(Modifier.height(h))

/** A [RowScope] gap of [w]. */
@Composable
fun RowScope.HGap(w: Dp) = Spacer(Modifier.size(w, 1.dp))
