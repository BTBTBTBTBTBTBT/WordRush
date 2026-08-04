package com.wordocious.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.core.GameMode
import com.wordocious.app.ModeGen

/**
 * The home-screen mode cards — ported 1:1 from the web `MODE_CARDS`
 * (apps/web/app/page.tsx). Title, description and accent color are the source
 * of truth; `engineMode` maps each card to the `:core` GameMode (null = VS,
 * which has no single-player engine state). Order matches the web grid exactly.
 *
 * Icons: the web uses lucide-react + custom SVGs (WordleGrid/Six/Seven) and
 * Roman numerals (IV/VIII). Here `glyph` carries the text marks (IV/VIII/6/7),
 * `lucide` names the web icon (bundled as ic_* VectorDrawables), and `hand`
 * names the brand hand SVG for Six/Seven (ic_six_hand/ic_seven_hand — the same
 * art as the iOS six-hand/seven-hand imagesets), rendered with the digit
 * overlaid exactly like iOS ModeIconView's `.hand` case.
 */
data class ModeCard(
    val id: String,
    val title: String,
    val desc: String,
    val accent: Color,
    val engineMode: GameMode?,
    val glyph: String? = null,   // Roman numeral / number shown instead of an icon
    val lucide: String? = null,  // web lucide icon name (for the exact-icon pass)
    val hand: String? = null,    // brand hand asset (six-hand/seven-hand); glyph = its digit
)

/** In-game uppercase mode title — single-sourced uppercased shareLabel from ModeGen. */
fun modeTitle(mode: GameMode): String =
    ModeGen.byDbKey(mode.name)?.shareLabel?.uppercase() ?: mode.name

/** Mode accent color (from MODE_CARDS). */
fun modeAccent(mode: GameMode): Color =
    MODE_CARDS.firstOrNull { it.engineMode == mode }?.accent ?: Color(0xFF7C3AED)

/** Mode-title gradient stops — matches iOS ModeStyle.gradient. */
fun modeTitleGradient(mode: GameMode): List<Color> = when (mode) {
    GameMode.DUEL -> listOf(Color(0xFFA78BFA), Color(0xFFEC4899))
    GameMode.DUEL_6 -> listOf(Color(0xFF06B6D4), Color(0xFF22D3EE))
    GameMode.DUEL_7 -> listOf(Color(0xFF84CC16), Color(0xFFA3E635))
    else -> modeAccent(mode).let { listOf(it, it.copy(alpha = 0.65f)) }
}

/** Per-mode icon chrome (web-native; keyed by catalog id). glyph = roman/number
 *  shown instead of an icon; lucide = web icon name. Title/desc/accent/order come
 *  from the single-source catalog (modes.json → ModeGen). */
private data class ModeChrome(val glyph: String?, val lucide: String?, val hand: String? = null)
private val MODE_CHROME: Map<String, ModeChrome> = mapOf(
    "practice" to ModeChrome(null, "WordleGrid"),
    "vs" to ModeChrome(null, "Swords"),
    "quordle" to ModeChrome("IV", null),
    "octordle" to ModeChrome("VIII", null),
    "sequence" to ModeChrome(null, "TrendingUp"),
    "rescue" to ModeChrome(null, "Shield"),
    // Brand hand SVGs + digit overlay (iOS ModeIconView `.hand`); the glyph
    // digit stays as the widget/share fallback source.
    "six" to ModeChrome("6", null, hand = "six-hand"),
    "seven" to ModeChrome("7", null, hand = "seven-hand"),
    "gauntlet" to ModeChrome(null, "Skull"),
    "propernoundle" to ModeChrome(null, "Crown"),
)

val MODE_CARDS: List<ModeCard> = ModeGen.all.map { m ->
    val chrome = MODE_CHROME[m.id]
    val engine = m.dbKey?.let { runCatching { GameMode.valueOf(it) }.getOrNull() }
    ModeCard(m.id, m.title, m.desc, m.accent, engine, glyph = chrome?.glyph, lucide = chrome?.lucide, hand = chrome?.hand)
}

/** The MODE_CARDS entry for a `:core` GameMode (icon/accent/glyph source of truth). */
fun modeCardFor(mode: GameMode): ModeCard? = MODE_CARDS.firstOrNull { it.engineMode == mode }

/** Exact lucide/custom icon drawable per mode (matches the web MODE_CARDS icons). */
fun modeIconRes(lucide: String?): Int? = when (lucide) {
    "WordleGrid" -> com.wordocious.app.R.drawable.ic_wordle_grid
    "Swords" -> com.wordocious.app.R.drawable.ic_swords
    "TrendingUp" -> com.wordocious.app.R.drawable.ic_trending_up
    "Shield" -> com.wordocious.app.R.drawable.ic_shield
    "Skull" -> com.wordocious.app.R.drawable.ic_skull
    "Crown" -> com.wordocious.app.R.drawable.ic_crown
    "Broom" -> com.wordocious.app.R.drawable.ic_broom
    "six-hand" -> com.wordocious.app.R.drawable.ic_six_hand
    "seven-hand" -> com.wordocious.app.R.drawable.ic_seven_hand
    else -> null
}

/**
 * A mode's glyph/icon EXACTLY as the web/home card renders it — the brand hand
 * with its digit overlaid (Six/Seven), a roman numeral/number (IV/VIII) or the
 * lucide drawable. Use everywhere a mode is shown (home cards, leaderboard
 * grid, profile picker) so icons stay consistent with the web.
 *
 * `box` is the accent tile the glyph sits in; the glyph/icon sizes derive from
 * it with iOS ModeIconView's proportions (ModeCatalog.swift): icon = box*0.5,
 * roman = box*0.42 (0.34 when longer than 2 chars, pinned 11 at box 32 like the
 * web help list), hand = box*0.6 with the digit at box*0.3 offset box*0.12
 * down. All text sizes are DERIVED FROM DP through LocalDensity (the TileView
 * rule): the tile is a fixed dp square, so a flat `.sp` would grow with the
 * user's font scale and overflow the unscaled box.
 */
@Composable
fun ModeGlyph(card: ModeCard, tint: Color, box: Dp) {
    val density = LocalDensity.current
    // Pin the line box to the glyph (TileView-style) so a digit/roman centers
    // truly in the tile instead of riding the default 24sp line height.
    val glyphStyle = LocalTextStyle.current.copy(
        platformStyle = PlatformTextStyle(includeFontPadding = false),
        lineHeightStyle = LineHeightStyle(
            alignment = LineHeightStyle.Alignment.Center,
            trim = LineHeightStyle.Trim.Both,
        ),
    )
    val handRes = modeIconRes(card.hand)
    when {
        handRes != null -> Box(contentAlignment = Alignment.Center) {
            Icon(
                painterResource(handRes), null, tint = tint,
                modifier = Modifier.size(width = box * 0.6f, height = box * 0.62f),
            )
            card.glyph?.let { digit ->
                val digitSp = with(density) { (box * 0.3f).toSp() }
                Text(
                    digit, fontSize = digitSp, fontWeight = FontWeight.Black, color = tint,
                    maxLines = 1, softWrap = false, lineHeight = digitSp, style = glyphStyle,
                    modifier = Modifier.offset(y = box * 0.12f),
                )
            }
        }
        card.glyph != null -> {
            // iOS: help-screen box (32) pins romans to a fixed 11pt like web;
            // everywhere else scales with the box, smaller for VIII-length text.
            val glyphDp = if (box == 32.dp) 11.dp else box * (if (card.glyph.length > 2) 0.34f else 0.42f)
            val glyphSp = with(density) { glyphDp.toSp() }
            Text(
                card.glyph, fontSize = glyphSp, fontWeight = FontWeight.Black, color = tint,
                maxLines = 1, softWrap = false, lineHeight = glyphSp, style = glyphStyle,
            )
        }
        else -> modeIconRes(card.lucide)?.let {
            Icon(painterResource(it), null, tint = tint, modifier = Modifier.size(box * 0.5f))
        }
    }
}

/** Convenience overload for callers that only have a `:core` GameMode. */
@Composable
fun ModeGlyph(mode: GameMode, tint: Color, box: Dp) {
    modeCardFor(mode)?.let { ModeGlyph(it, tint, box) }
}

/**
 * A composite score for display. The stored score is fractional (the speed
 * bonus carries 2 decimals) but no surface shows the decimal — rows read
 * "2,332".
 *
 * TRUNCATES rather than rounds, matching web (Math.trunc) and iOS
 * (Int(score)): the same result must never read 2,332 on iOS and 2,333 here.
 * Grouping is pinned to US so the three platforms agree digit-for-digit.
 * Ordering is unaffected — leaderboards sort on the stored value.
 */
fun formatScore(score: Double): String =
    java.text.NumberFormat.getIntegerInstance(java.util.Locale.US).format(score.toLong())
