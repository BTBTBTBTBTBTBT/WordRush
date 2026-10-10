@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.keyframes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ModeGen
import com.wordocious.app.ui.game.WinPopupMath
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import kotlinx.coroutines.delay

// Strategy + How to Play as the "guide page family" (3-platform parity spec, 10-02):
// the Strategy index, the article reader and the footer How to Play page share the
// per-game guide card's language (GuideSheet): the host's ready pose on a soft glow,
// the game's title art, soft numerals, candy buttons. Founder rules: no outlined
// boxes (soft fills, top color bars and one soft shadow only), no emoji, no generic
// icons as decoration, transform/opacity motion only.

// ── Pure catalog logic (unit-tested: StrategyCatalogTest) ─────────────────────

/** The index sections, in display order. */
enum class StrategyGroup(val label: String) {
    DAILIES("WORDOCIOUS DAILIES"),
    PUZZLES("PUZZLES"),
    EVERY("EVERY GAME"),
}

/** One article's place in the family: its game (null = general), section and general-cast index. */
data class StrategySlot(val slug: String, val gameId: String?, val group: StrategyGroup, val castIndex: Int)

/** A section's first sentence pulled out as the takeaway, and what is left of the paragraph. */
data class StrategyTakeaway(val lead: String, val rest: String)

object StrategyCatalog {
    /** Slug → catalog (modes.json) id; null = a general article (every game). */
    val SLUG_GAMES: Map<String, String?> = mapOf(
        "best-starting-words" to "practice",
        "solve-faster" to "practice",
        "multi-board-mastery" to "quordle",
        "gauntlet-survival" to "gauntlet",
        "propernoundle-playbook" to "propernoundle",
        "sudocious-playbook" to "sudoku",
        "starsweep-playbook" to "regions",
        "letter-ladder-playbook" to "ladder",
        "spyglass-playbook" to "wordsearch",
        "hubbub-playbook" to "hub",
        "codebreaker-playbook" to "cryptogram",
        "kindred-playbook" to "groups",
        "crosswordocious-playbook" to "crossword",
        "muddle-playbook" to "scramble",
        "vs-battle-tactics" to "vs",
        "modes-explained" to null,
        "daily-sweep-guide" to null,
        "letter-frequency-atlas" to null,
        "repeated-letter-traps" to null,
        "beginner-to-sweeper" to null,
    )

    /** The general articles' cast, by their index among the general articles (API order). */
    val GENERAL_CAST: List<MascotId> = listOf(
        MascotId.W, MascotId.O1, MascotId.R, MascotId.D, MascotId.O2,
        MascotId.C, MascotId.I, MascotId.O3, MascotId.U, MascotId.S,
    )

    /**
     * The catalog id an article belongs to: the slug map, else the slug with "-playbook"
     * stripped matched against the catalog titles (lowercased, spaces → '-'), else null.
     */
    fun gameIdFor(slug: String): String? {
        if (SLUG_GAMES.containsKey(slug)) return SLUG_GAMES[slug]?.takeIf { ModeGen.byId(it) != null }
        val key = slug.removeSuffix("-playbook")
        return ModeGen.all.firstOrNull { it.title.lowercase().replace(' ', '-') == key }?.id
    }

    /** Catalog group "core" → dailies, "more" → puzzles, general → every game. */
    fun groupFor(gameId: String?): StrategyGroup = when (gameId?.let { ModeGen.byId(it)?.group }) {
        "core" -> StrategyGroup.DAILIES
        "more" -> StrategyGroup.PUZZLES
        else -> StrategyGroup.EVERY
    }

    /** Slugs in API order → the flattened grouped order (dailies, puzzles, every game; API order within). */
    fun arrange(slugs: List<String>): List<StrategySlot> {
        var general = 0
        val slots = slugs.map { slug ->
            val id = gameIdFor(slug)
            StrategySlot(slug, id, groupFor(id), if (id == null) general++ else -1)
        }
        return StrategyGroup.entries.flatMap { g -> slots.filter { it.group == g } }
    }

    /** Whole days from 1970-01-01 to [date] (the local calendar date, at UTC midnight). */
    fun epochDay(date: java.time.LocalDate): Long = date.toEpochDay()

    /** Tip of the day: the index into the flattened list for [epochDay]. */
    fun featuredIndex(epochDay: Long, count: Int): Int =
        if (count <= 0) 0 else Math.floorMod(epochDay, count.toLong()).toInt()

    /**
     * The first sentence of [paragraph] (split at the first ". ", "! " or "? " at index
     * ≥ 20, punctuation kept) and the trimmed remainder; null when there is no split point.
     */
    fun takeaway(paragraph: String): StrategyTakeaway? {
        var i = 20
        while (i < paragraph.length - 1) {
            val c = paragraph[i]
            if ((c == '.' || c == '!' || c == '?') && paragraph[i + 1] == ' ') {
                return StrategyTakeaway(paragraph.substring(0, i + 1), paragraph.substring(i + 2).trim())
            }
            i++
        }
        return null
    }

    /** How to Play mode rows: the text before " — " matched to a catalog title (case-insensitive). */
    fun htpModeId(name: String): String? {
        val key = name.substringBefore(" — ").trim()
        return when {
            key.equals("VS Battle", ignoreCase = true) -> "vs"
            key.equals("Puzzles", ignoreCase = true) -> "more"
            else -> ModeGen.all.firstOrNull { it.title.equals(key, ignoreCase = true) }?.id
        }
    }

    /** The daily a PLAY CTA opens (null for general articles, VS, or a game this build hides). */
    fun dailyModeFor(gameId: String?): GameMode? {
        val key = gameId?.let { ModeGen.byId(it)?.dbKey } ?: return null
        return runCatching { GameMode.valueOf(key) }.getOrNull()
    }
}

// ── The article as shown ──────────────────────────────────────────────────────

/** Brand purple: the general articles' accent. */
private val BRAND = Color(0xFF7C3AED)
/** The warm cream the guide cards wash over. */
private const val FAMILY_CREAM: Int = 0xFFFFF8F1.toInt()
private val RAINBOW_BAR = Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))

/** An article with its game, accent, host and title art resolved. */
class StrategyEntry(val article: StrategyService.Article, val slot: StrategySlot) {
    val gameId: String? get() = slot.gameId
    val game get() = gameId?.let { ModeGen.byId(it) }
    val accent: Color get() = game?.accent ?: BRAND
    val host: MascotId get() = when {
        gameId == null -> StrategyCatalog.GENERAL_CAST[slot.castIndex.coerceAtLeast(0) % StrategyCatalog.GENERAL_CAST.size]
        gameId == "vs" -> MascotId.W
        else -> Mascots.hostFor(game?.dbKey) ?: MascotId.W
    }
    val titleArt: Int? get() = gameTitleArtRes(gameId)
    /** The daily the PLAY CTA opens, when it has one (and this build shows that game). */
    val playMode: GameMode? get() = StrategyCatalog.dailyModeFor(gameId)?.takeIf { modeCardFor(it) != null }
}

/** Articles (API order) → entries in the flattened grouped order. */
fun strategyEntries(articles: List<StrategyService.Article>): List<StrategyEntry> {
    val bySlug = articles.associateBy { it.slug }
    return StrategyCatalog.arrange(articles.map { it.slug }).mapNotNull { s -> bySlug[s.slug]?.let { StrategyEntry(it, s) } }
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

/** [accent] washed over the page (light) or the dark surface. */
@Composable
private fun field(accent: Color, light: Float, dark: Float): Color {
    val a = accent.copy(alpha = 1f).toArgb()
    return if (WTheme.isDark) Color(WinPopupMath.cardWash(a, dark, WTheme.surface.toArgb())) else Wash.mix(accent, light)
}

/** Text in a darkened accent (dark mode: a light tint of it). */
@Composable
private fun accentInk(accent: Color): Color = if (WTheme.isDark) Wash.mix(accent, 0.55f) else darkenInk(accent)

/** The game accent as a name color, a touch deeper on light so pale accents still read. */
@Composable
private fun nameInk(accent: Color): Color =
    if (WTheme.isDark) Wash.mix(accent, 0.75f)
    else Color(TintMath.over(0xFF000000.toInt(), 0.18f, accent.copy(alpha = 1f).toArgb()))

/**
 * The guide page's R1 card with NO stroke: [accent] ~10% → ~4% over the warm cream
 * (dark: the surface + 24% → 8%), the 8 dp rainbow bar, radius 28, one soft accent shadow.
 */
@Composable
private fun FamilyCard(
    accent: Color,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 20.dp),
    spacing: Dp = 10.dp,
    radius: Dp = 28.dp,
    horizontalAlignment: Alignment.Horizontal = Alignment.CenterHorizontally,
    /** Founder 10-09: the Home cards' frosting cap (band + soft drips) in the rainbow instead of the flat 8 dp bar. */
    trim: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(radius)
    val dark = WTheme.isDark
    val a = accent.copy(alpha = 1f).toArgb()
    val base = if (dark) WTheme.surface.toArgb() else FAMILY_CREAM
    val top = Color(WinPopupMath.cardWash(a, if (dark) 0.24f else 0.10f, base))
    val bottom = Color(WinPopupMath.cardWash(a, if (dark) 0.08f else 0.04f, base))
    Column(
        modifier.fillMaxWidth()
            .shadow(16.dp, shape, clip = false, ambientColor = accent.copy(alpha = 0.35f), spotColor = accent.copy(alpha = 0.45f))
            .clip(shape)
            .background(Brush.verticalGradient(listOf(top, bottom))),
    ) {
        if (trim) RainbowCardTrim() else Box(Modifier.fillMaxWidth().height(8.dp).background(RAINBOW_BAR))
        Column(
            Modifier.fillMaxWidth().padding(contentPadding),
            horizontalAlignment = horizontalAlignment,
            verticalArrangement = Arrangement.spacedBy(spacing),
            content = content,
        )
    }
}

/**
 * Founder 10-09 (iOS guideHeroCard(trim:)): the Word of the Day card wears the Home game cards' frosting cap (CardTrimGeometry:
 * a slim band whose bottom edge is a row of shallow drips) filled with the rainbow, plus the top white sheen. It takes the
 * band's height of the layout; the drips hang over the content's top padding.
 */
@Composable
private fun RainbowCardTrim() {
    Box(
        Modifier.fillMaxWidth().height(CardTrimGeometry.BAND.dp).wrapContentHeight(Alignment.Top, unbounded = true)
            .height((CardTrimGeometry.BAND + CardTrimGeometry.DRIP).dp)
            .clearAndSetSemantics { }
            .drawWithCache {
                val u = density
                val path = Path().apply {
                    moveTo(0f, 0f)
                    lineTo(size.width, 0f)
                    lineTo(size.width, CardTrimGeometry.BAND * u)
                    for (seg in CardTrimGeometry.segments(size.width / u)) quadraticTo(seg[0] * u, seg[1] * u, seg[2] * u, seg[3] * u)
                    close()
                }
                val sheen = Brush.verticalGradient(0f to Color.White.copy(alpha = 0.42f), 0.6f to Color.White.copy(alpha = 0f))
                onDrawBehind {
                    drawPath(path, RAINBOW_BAR)
                    drawPath(path, sheen)
                }
            },
    )
}

/** The host's "ready" pose on the soft radial glow with a ground ellipse, springing in once. Decorative. */
@Composable
private fun HostReadyPose(host: MascotId, accent: Color, poseSize: Dp) {
    val still = WTheme.reducedMotion
    val pop = remember(host) { Animatable(if (still) 1f else 0.5f) }
    LaunchedEffect(host, still) {
        if (still) { pop.snapTo(1f); return@LaunchedEffect }
        delay(100)
        pop.animateTo(1f, keyframes {
            durationMillis = 520
            0.5f at 0 using FastOutSlowInEasing
            1.06f at 340 using FastOutSlowInEasing
            1f at 520
        })
    }
    Box(Modifier.size(poseSize + 40.dp, poseSize + 6.dp).clearAndSetSemantics { }, contentAlignment = Alignment.BottomCenter) {
        Canvas(Modifier.matchParentSize()) {
            val c = Offset(size.width / 2f, size.height * 0.55f)
            val r = size.minDimension * 0.62f
            drawCircle(Brush.radialGradient(0f to accent.copy(alpha = 0.28f), 0.7f to accent.copy(alpha = 0f), center = c, radius = r), radius = r, center = c)
            val gw = size.width * 0.42f
            val gh = 9.dp.toPx()
            drawOval(accent.copy(alpha = 0.18f), Offset((size.width - gw) / 2f, size.height - gh - 1.dp.toPx()), Size(gw, gh))
        }
        Box(
            Modifier.padding(bottom = 4.dp).graphicsLayer {
                scaleX = pop.value; scaleY = pop.value
                alpha = ((pop.value - 0.5f) / 0.3f).coerceIn(0f, 1f)
                transformOrigin = TransformOrigin(0.5f, 1f)
            },
        ) { CastPose(host, "ready", poseSize) }
    }
}

/** A capsule chip in the accent wash ("6 MIN READ"), no stroke. */
@Composable
private fun MinChip(text: String, accent: Color) {
    Text(
        text, fontFamily = Nunito, fontSize = 10.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.1.em,
        color = accentInk(accent), maxLines = 1,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(field(accent, 0.16f, 0.30f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

/** The game's name as lettering in its accent (a game without title art: VS). */
@Composable
private fun TitleLettering(text: String, accent: Color, fontSize: Float) {
    Text(
        text.uppercase(), fontFamily = Nunito, fontSize = fontSize.sp, fontWeight = FontWeight.Black,
        letterSpacing = 0.04.em, color = if (WTheme.isDark) Wash.mix(accent, 0.7f) else accent, maxLines = 1,
    )
}

/** A big soft numeral on a filled accent-wash circle, beside a Nunito Black heading. */
@Composable
private fun NumberedHeading(n: Int, title: String, accent: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(field(accent, 0.16f, 0.32f)).clearAndSetSemantics { },
            contentAlignment = Alignment.Center,
        ) { SoftNumber("$n", 26.sp, color = if (WTheme.isDark) Wash.mix(accent, 0.7f) else accent) }
        Text(
            title, fontFamily = Nunito, fontSize = 17.5.sp, fontWeight = FontWeight.Black, color = InfoInk.heading,
            lineHeight = 22.sp, modifier = Modifier.weight(1f).semantics { heading() },
        )
    }
}

/** A takeaway in a soft accent field (no border). */
@Composable
private fun TakeawayField(text: String, accent: Color) {
    Text(
        text, fontFamily = Nunito, fontSize = 15.sp, fontWeight = FontWeight.Black, color = accentInk(accent),
        lineHeight = 1.4.em,
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(field(accent, 0.10f, 0.22f))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    )
}

@Composable
private fun FamilyBody(text: String) {
    Text(text, fontSize = 15.5.sp, fontWeight = FontWeight.Normal, color = InfoInk.body, lineHeight = 1.55.em)
}

/** The game's title art (reader / tip), lettering for VS, nothing for a general article. */
@Composable
private fun EntryTitleArt(e: StrategyEntry, maxHeight: Dp) {
    val art = e.titleArt
    val game = e.game
    if (art != null && game != null) FittedGameTitleArt(art, game.title, maxHeight = maxHeight, heading = false)
    else if (game != null) TitleLettering(game.title, e.accent, if (maxHeight > 48.dp) 26f else 20f)
}

// ── Strategy index ────────────────────────────────────────────────────────────

/** The Strategy index body: the hero with the tip of the day, then the grouped tile grid. */
@Composable
fun StrategyIndexBody(entries: List<StrategyEntry>, onOpen: (StrategyEntry) -> Unit) {
    // BJ7: 10 between blocks (was 14), tiles that hug their content.
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(
            Modifier.fillMaxWidth().padding(top = 2.dp).semantics(mergeDescendants = true) { },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                "SOLVE SMARTER", fontFamily = Nunito, fontSize = 11.sp, fontWeight = FontWeight.Black,
                letterSpacing = 0.12.em, color = accentInk(BRAND),
            )
            Text(
                "Original strategy for every Wordocious game.", fontFamily = Nunito, fontSize = 16.sp,
                fontWeight = FontWeight.Black, color = InfoInk.heading, textAlign = TextAlign.Center,
            )
        }
        if (entries.isEmpty()) {
            CastLoader(null, Modifier.padding(top = 24.dp).align(Alignment.CenterHorizontally))
            return@Column
        }
        val featured = entries[StrategyCatalog.featuredIndex(StrategyCatalog.epochDay(java.time.LocalDate.now()), entries.size)]
        SectionLabel("TIP OF THE DAY")
        TipCard(featured) { onOpen(featured) }
        StrategyGroup.entries.forEach { g ->
            val list = entries.filter { it.slot.group == g }
            if (list.isEmpty()) return@forEach
            SectionLabel(g.label, Modifier.padding(top = 4.dp))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                list.chunked(2).forEach { row ->
                    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { e -> StrategyTile(e, Modifier.weight(1f).fillMaxHeight()) { onOpen(e) } }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text, fontFamily = Nunito, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
        color = InfoInk.heading, modifier = modifier.padding(horizontal = 4.dp).semantics { heading() },
    )
}

/** The tip of the day: a mini reader hero (pose ~90, title art ~40, title, 2-line dek, chip). */
@Composable
private fun TipCard(e: StrategyEntry, onClick: () -> Unit) {
    val a = e.article
    FamilyCard(
        e.accent,
        Modifier.squishClickable("Tip of the day: ${a.title}, ${a.minutes} minute read", card = true, onClick = onClick),
        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 10.dp, bottom = 12.dp),
        spacing = 6.dp,
    ) {
        HostReadyPose(e.host, e.accent, 64.dp)
        EntryTitleArt(e, 40.dp)
        Text(
            a.title, fontFamily = Nunito, fontSize = 17.sp, fontWeight = FontWeight.Black, color = InfoInk.heading,
            textAlign = TextAlign.Center, lineHeight = 21.sp,
        )
        if (a.dek.isNotBlank()) {
            Text(
                a.dek, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = InfoInk.muted, textAlign = TextAlign.Center,
                maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 1.35.em,
            )
        }
        MinChip("${a.minutes} MIN READ", e.accent)
    }
}

/** A grid tile: the accent gradient, a 6 dp accent bar, one soft shadow, no stroke. */
@Composable
private fun StrategyTile(e: StrategyEntry, modifier: Modifier, onClick: () -> Unit) {
    val a = e.article
    val accent = e.accent
    val shape = RoundedCornerShape(22.dp)
    val dark = WTheme.isDark
    val argb = accent.copy(alpha = 1f).toArgb()
    val base = if (dark) WTheme.surface.toArgb() else FAMILY_CREAM
    val top = Color(WinPopupMath.cardWash(argb, if (dark) 0.26f else 0.16f, base))
    val bottom = Color(WinPopupMath.cardWash(argb, if (dark) 0.10f else 0.06f, base))
    Column(
        modifier.squishClickable("${a.title}, ${a.minutes} minute read", card = true, onClick = onClick)
            .shadow(8.dp, shape, clip = false, ambientColor = accent.copy(alpha = 0.25f), spotColor = accent.copy(alpha = 0.35f))
            .clip(shape)
            .background(Brush.verticalGradient(listOf(top, bottom))),
    ) {
        Box(Modifier.fillMaxWidth().height(5.dp).background(accent))
        // BJ7: art, the title (3 lines reserved so the pair match) and the minutes chip
        // right under it — no chip floating at the bottom.
        Column(
            Modifier.fillMaxWidth().weight(1f).padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            val art = e.titleArt
            when {
                art != null -> Image(
                    artPainter(art, 180.dp), contentDescription = null,
                    modifier = Modifier.fillMaxWidth().height(30.dp),
                    contentScale = ContentScale.Fit, alignment = Alignment.CenterStart,
                )
                // BJ16: VS wears the VS BATTLE lettering.
                e.gameId == "vs" -> Image(
                    artPainter(com.wordocious.app.R.drawable.art_titlecast_vsbattle, 180.dp), contentDescription = null,
                    modifier = Modifier.fillMaxWidth().height(30.dp),
                    contentScale = ContentScale.Fit, alignment = Alignment.CenterStart,
                )
                else -> CastPose(e.host, "ready", 36.dp)
            }
            Text(
                a.title, fontFamily = Nunito, fontSize = 14.sp, fontWeight = FontWeight.Black, color = InfoInk.heading,
                maxLines = 3, minLines = 3, overflow = TextOverflow.Ellipsis, lineHeight = 18.sp,
            )
            MinChip("${a.minutes} MIN", accent)
        }
    }
}

// ── Article reader ────────────────────────────────────────────────────────────

/**
 * The article reader, mirroring the guide page: the hero card, numbered sections with
 * their takeaways, the PLAY CTA ([onPlay] null = hidden) and the prev / next row.
 */
@Composable
fun StrategyArticleBody(
    e: StrategyEntry,
    prev: StrategyEntry?,
    next: StrategyEntry?,
    onOpen: (StrategyEntry) -> Unit,
    onPlay: (() -> Unit)?,
) {
    val a = e.article
    val accent = e.accent
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        FamilyCard(accent) {
            HostReadyPose(e.host, accent, 104.dp)
            EntryTitleArt(e, 60.dp)
            Text(
                a.title, fontFamily = Nunito, fontSize = 21.sp, fontWeight = FontWeight.Black, color = InfoInk.heading,
                textAlign = TextAlign.Center, lineHeight = 26.sp, modifier = Modifier.semantics { heading() },
            )
            if (a.dek.isNotBlank()) {
                Text(
                    a.dek, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = InfoInk.muted,
                    textAlign = TextAlign.Center, lineHeight = 1.4.em,
                )
            }
            MinChip("${a.minutes} MIN READ", accent)
        }
        a.sections.forEachIndexed { i, s ->
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                NumberedHeading(i + 1, s.heading, accent)
                val first = s.body.firstOrNull()
                val take = first?.let { StrategyCatalog.takeaway(it) }
                if (take != null) TakeawayField(take.lead, accent)
                s.body.forEachIndexed { j, p ->
                    if (j == 0 && take != null) { if (take.rest.isNotEmpty()) FamilyBody(take.rest) }
                    else FamilyBody(p)
                }
            }
        }
        if (onPlay != null) {
            val name = e.game?.title?.uppercase().orEmpty()
            // BJ9: the game grows from this button's frame (the page closes as it opens).
            CandyButton(
                "PLAY $name", onClick = { GameMotion.arm("strategy:play", frameOnly = true); onPlay() },
                color = CandyColor.PURPLE, size = CandySize.LARGE,
                icon = CandyIcon.PLAY, fill = true, contentDescription = "Play today's ${e.game?.title.orEmpty()}",
                modifier = Modifier.gameLaunchSource("strategy:play", Wash.mix(accent, Wash.CARD), 22.dp),
            )
        }
        if (prev != null || next != null) {
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (prev != null) NeighborField(prev, "PREVIOUS", false, Modifier.weight(1f).fillMaxHeight()) { onOpen(prev) }
                else Spacer(Modifier.weight(1f))
                if (next != null) NeighborField(next, "NEXT", true, Modifier.weight(1f).fillMaxHeight()) { onOpen(next) }
                else Spacer(Modifier.weight(1f))
            }
        }
    }
}

/** Half of the prev / next row: a borderless soft field in that article's accent. */
@Composable
private fun NeighborField(e: StrategyEntry, eyebrow: String, end: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val accent = e.accent
    Column(
        modifier.squishClickable("$eyebrow article: ${e.article.title}", card = true, onClick = onClick)
            .clip(RoundedCornerShape(18.dp)).background(field(accent, 0.14f, 0.26f))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalAlignment = if (end) Alignment.End else Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(eyebrow, fontFamily = Nunito, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.12.em, color = accentInk(accent))
        Text(
            e.article.title, fontFamily = Nunito, fontSize = 13.sp, fontWeight = FontWeight.Black, color = InfoInk.heading,
            maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 17.sp,
            textAlign = if (end) TextAlign.End else TextAlign.Start,
        )
    }
}

// ── How to Play ───────────────────────────────────────────────────────────────

/** The rotating brand set the How to Play sections keep. */
private val HTP_ACCENTS = listOf(Color(0xFF7C3AED), Color(0xFFEC4899), Color(0xFFF59E0B), Color(0xFF3B82F6), Color(0xFF10B981))

private fun hexColor(hex: String, fallback: Color): Color =
    runCatching { Color(("FF" + hex.removePrefix("#")).toLong(16)) }.getOrDefault(fallback)

/**
 * How to Play in the guide family: the hero card (W ready),
 * then sections numbered 1..N. [tile] draws one example letter tile (unchanged).
 */
@Composable
fun HowToPlayBody(
    sections: List<HowToPlayService.Section>,
    tile: @Composable (HowToPlayService.Letter) -> Unit,
    /** BI24: the fetch came back empty — the caller draws its offline state, so no loader. */
    loadFailed: Boolean = false,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        FamilyCard(BRAND) {
            HostReadyPose(MascotId.W, BRAND, 104.dp)
            Text(
                "How Wordocious works", fontFamily = Nunito, fontSize = 20.sp, fontWeight = FontWeight.Black,
                color = InfoInk.heading, textAlign = TextAlign.Center, modifier = Modifier.semantics { heading() },
            )
            Text(
                "Everything you need to know to get started", fontSize = 13.sp, fontWeight = FontWeight.Bold,
                color = InfoInk.muted, textAlign = TextAlign.Center,
            )
        }
        if (sections.isEmpty()) {
            if (!loadFailed) CastLoader(null, Modifier.padding(top = 8.dp).align(Alignment.CenterHorizontally))
        } else {
            var sheet by remember { mutableStateOf<HtpSheet?>(null) }
            sections.forEachIndexed { i, s ->
                HtpSection(i + 1, s, HTP_ACCENTS[i % HTP_ACCENTS.size], HTP_PALETTES[i % HTP_PALETTES.size], tile) { sheet = it }
            }
            when (val sh = sheet) {
                is HtpSheet.Guide -> com.wordocious.app.ui.game.GuideSheet(sh.mode, onDismiss = { sheet = null }, startExpanded = sh.expanded)
                is HtpSheet.Pocket -> com.wordocious.app.ui.friends.PocketHelpDialog(sh.kind, onDismiss = { sheet = null })
                null -> Unit
            }
        }
    }
}

/** "Full guide" / "Watch how" targets (item 36). */
private sealed interface HtpSheet {
    data class Guide(val mode: GameMode, val expanded: Boolean) : HtpSheet
    data class Pocket(val kind: com.wordocious.core.FriendlyKind) : HtpSheet
}

/** The section titles' bubble lettering, by section order. */
private val HTP_PALETTES = listOf(
    HeadlinePalette.HOME, HeadlinePalette.STATS, HeadlinePalette.STATS, HeadlinePalette.VS, HeadlinePalette.FRIENDS,
    HeadlinePalette.LEADERBOARD, HeadlinePalette.HOME, HeadlinePalette.STATS, HeadlinePalette.VS, HeadlinePalette.FRIENDS,
)

/** A numbered head in bubble lettering: the soft numeral, then the title (item 36). */
@Composable
private fun HtpHeading(n: Int, title: String, accent: Color, palette: HeadlinePalette) {
    Row(
        Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "$n. $title"; heading() },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(field(accent, 0.16f, 0.32f)).clearAndSetSemantics { },
            contentAlignment = Alignment.Center,
        ) { SoftNumber("$n", 26.sp, color = if (WTheme.isDark) Wash.mix(accent, 0.7f) else accent) }
        BubbleText(title.uppercase(), palette, Modifier.weight(1f), maxSize = 24, minSize = 16, align = TextAlign.Start, animated = false)
    }
}

/** One game's entry: icon, title art, a few plain lines, then "Full guide" and "Watch how" (its first-play walk-through). */
@Composable
private fun HtpGameEntry(g: HowToPlayService.Game, accent: Color, onSheet: (HtpSheet) -> Unit) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val kind = remember(g.id) { if (g.id.startsWith("pocket-")) com.wordocious.core.FriendlyKind.from(g.id.removePrefix("pocket-")) else null }
    val gen = remember(g.id) { if (kind == null) ModeGen.byId(g.id) else null }
    val mode = remember(g.id) { gen?.dbKey?.let { k -> runCatching { GameMode.valueOf(k) }.getOrNull() } }
    val icon = if (kind != null) ctx.resources.getIdentifier("game_pocket_${kind.raw}", "drawable", ctx.packageName).takeIf { it != 0 } else gameArtRes(g.id)
    val titleArt = if (kind != null) ctx.resources.getIdentifier("art_titlecast_pocket_${kind.raw}", "drawable", ctx.packageName).takeIf { it != 0 }
        else gameTitleArtRes(g.id)
    val c = gen?.accent ?: hexColor(g.accent, accent)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        if (icon != null) Image(artPainter(icon, 40.dp), contentDescription = null, modifier = Modifier.size(40.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            if (titleArt != null) {
                Image(
                    artPainter(titleArt, 30.dp), contentDescription = g.title,
                    modifier = Modifier.height(30.dp).widthIn(max = 220.dp).semantics { heading() },
                    contentScale = ContentScale.Fit, alignment = Alignment.CenterStart,
                )
            } else {
                Text(g.title, fontFamily = Nunito, fontSize = 15.sp, fontWeight = FontWeight.Black, color = nameInk(c), modifier = Modifier.semantics { heading() })
            }
            g.lines.forEach { Text(it, fontSize = 14.sp, fontWeight = FontWeight.Normal, color = InfoInk.body, lineHeight = 1.45.em) }
            if (mode != null && gen?.guideSlug != null) {
                androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    QuietButton("Full guide", onClick = { onSheet(HtpSheet.Guide(mode, true)) }, size = CandySize.SMALL, contentDescription = "Full guide: ${g.title}")
                    QuietButton("Watch how", onClick = { onSheet(HtpSheet.Guide(mode, false)) }, size = CandySize.SMALL, icon = FamIcon.PLAY, contentDescription = "Watch how to play ${g.title}")
                }
            } else if (kind != null) {
                QuietButton("Watch how", onClick = { onSheet(HtpSheet.Pocket(kind)) }, size = CandySize.SMALL, icon = FamIcon.PLAY, contentDescription = "Watch how to play ${g.title}")
            }
        }
    }
}

@Composable
private fun HtpSection(n: Int, s: HowToPlayService.Section, accent: Color, palette: HeadlinePalette, tile: @Composable (HowToPlayService.Letter) -> Unit, onSheet: (HtpSheet) -> Unit) {
    // Founder 10-10 ("hard to read with our theme"): every section sits on its own card (night glass in a dark season), so body
    // text never lies on the wallpaper's scenery.
    TintedCard(
        accent, Modifier.fillMaxWidth(), bar = null, tint = accentWash(accent, 0.08f), line = accentLine(accent, 0.22f),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        HtpHeading(n, s.title, accent, palette)
        s.intro?.let { TakeawayField(it, accent) }
        s.bullets?.let { bullets ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                bullets.forEach { b ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(Modifier.padding(top = 8.dp).size(8.dp).clip(CircleShape).background(accent))
                        Text(
                            buildAnnotatedString {
                                b.strong?.let { withStyle(SpanStyle(fontWeight = FontWeight.Black, color = InfoInk.heading)) { append(it) } }
                                append(b.text)
                            },
                            fontSize = 15.sp, fontWeight = FontWeight.Normal, color = InfoInk.body, lineHeight = 1.5.em,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
        s.tilesHeading?.let { Text(it, fontFamily = Nunito, fontSize = 14.sp, fontWeight = FontWeight.Black, color = InfoInk.heading) }
        s.tiles?.let { tiles ->
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                tiles.forEach { row ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { row.letters.forEach { tile(it) } }
                        Text(
                            buildAnnotatedString {
                                withStyle(SpanStyle(fontWeight = FontWeight.Black, color = hexColor(row.strongColor, BRAND))) { append(row.strong) }
                                append(row.rest)
                            },
                            fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = InfoInk.body, lineHeight = 1.4.em,
                        )
                    }
                }
            }
        }
        s.games?.let { games ->
            Column(verticalArrangement = Arrangement.spacedBy(18.dp)) { games.forEach { HtpGameEntry(it, accent, onSheet) } }
        } ?: s.modes?.let { modes ->
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                modes.forEach { m ->
                    val id = StrategyCatalog.htpModeId(m.name)
                    val c = id?.let { ModeGen.byId(it)?.accent } ?: hexColor(m.accent, accent)
                    val icon = gameArtRes(id)
                    Row(
                        Modifier.fillMaxWidth().semantics(mergeDescendants = true) { },
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        if (icon != null) {
                            Image(artPainter(icon, 32.dp), contentDescription = null, modifier = Modifier.size(32.dp))
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(m.name, fontFamily = Nunito, fontSize = 14.sp, fontWeight = FontWeight.Black, color = nameInk(c), lineHeight = 18.sp)
                            Text(m.body, fontSize = 14.sp, fontWeight = FontWeight.Normal, color = InfoInk.body, lineHeight = 1.5.em)
                        }
                    }
                }
            }
        }
        s.outro?.let { FamilyBody(it) }
    }
}

// ── Shared with Word of the Day (FINISH_SPEC BI17) ────────────────────────────

/** Brand purple, the family's reading accent. */
internal val GUIDE_BRAND: Color get() = BRAND

/** The guide hero card (no stroke, rainbow bar, accent gradient over cream, one soft shadow). */
@Composable
internal fun GuideHeroCard(
    accent: Color,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 20.dp),
    spacing: Dp = 10.dp,
    radius: Dp = 28.dp,
    horizontalAlignment: Alignment.Horizontal = Alignment.CenterHorizontally,
    trim: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) = FamilyCard(accent, modifier, contentPadding, spacing, radius, horizontalAlignment, trim, content)

/** The host's ready pose on the soft glow, springing in once. Decorative. */
@Composable
internal fun GuideHostHero(host: MascotId, accent: Color, poseSize: Dp) = HostReadyPose(host, accent, poseSize)

/** A capsule chip in the accent wash, no stroke. */
@Composable
internal fun GuideChip(text: String, accent: Color) = MinChip(text, accent)

/** A section label (13 black, tracking 1.2, heading ink; a TalkBack heading). */
@Composable
internal fun GuideSectionHead(text: String, modifier: Modifier = Modifier) = SectionLabel(text, modifier)

/** A body paragraph in the family's reading size. */
@Composable
internal fun GuideParagraph(text: String) = FamilyBody(text)

/** [accent] washed over the page (light) or the dark surface. */
@Composable
internal fun guideField(accent: Color, light: Float, dark: Float): Color = field(accent, light, dark)

/** Text in a darkened accent (dark mode: a light tint of it). */
@Composable
internal fun guideAccentInk(accent: Color): Color = accentInk(accent)

/** A highlighted line in a soft accent field (no border); [italic] for a quoted example. */
@Composable
internal fun GuideTakeaway(text: String, accent: Color, italic: Boolean = false) {
    if (!italic) { TakeawayField(text, accent); return }
    Text(
        text, fontFamily = Nunito, fontSize = 15.sp, fontWeight = FontWeight.Bold,
        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic, color = accentInk(accent), lineHeight = 1.45.em,
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(field(accent, 0.10f, 0.22f))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    )
}

/** A soft numeral on a filled accent-wash circle ([size] square, no stroke). Decorative. */
@Composable
internal fun GuideNumeral(n: Int, accent: Color, size: Dp = 34.dp) {
    Box(
        Modifier.size(size).clip(CircleShape).background(field(accent, 0.16f, 0.32f)).clearAndSetSemantics { },
        contentAlignment = Alignment.Center,
    ) { SoftNumber("$n", (size.value * 0.62f).sp, color = if (WTheme.isDark) Wash.mix(accent, 0.7f) else accent) }
}
