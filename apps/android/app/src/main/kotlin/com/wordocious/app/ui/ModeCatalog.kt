package com.wordocious.app.ui

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import com.wordocious.core.GameMode
import com.wordocious.app.ModeGen

/**
 * The home-screen mode cards — ported 1:1 from the web `MODE_CARDS`
 * (apps/web/app/page.tsx). Title, description and accent color are the source
 * of truth; `engineMode` maps each card to the `:core` GameMode (null = VS,
 * which has no single-player engine state). Order matches the web grid exactly.
 *
 * Icons: the web uses lucide-react + custom SVGs (WordleGrid/Six/Seven) and
 * Roman numerals (IV/VIII). Here `glyph` carries the text marks (IV/VIII/6/7)
 * and `icon` names the lucide icon to match during the exact-icon pass; the
 * Compose screen renders the closest material icon until the brand SVGs are
 * bundled (tracked as a follow-up — exact icon parity per the parity spec).
 */
data class ModeCard(
    val id: String,
    val title: String,
    val desc: String,
    val accent: Color,
    val engineMode: GameMode?,
    val glyph: String? = null,   // Roman numeral / number shown instead of an icon
    val lucide: String? = null,  // web lucide icon name (for the exact-icon pass)
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
private data class ModeChrome(val glyph: String?, val lucide: String?)
private val MODE_CHROME: Map<String, ModeChrome> = mapOf(
    "practice" to ModeChrome(null, "WordleGrid"),
    "vs" to ModeChrome(null, "Swords"),
    "quordle" to ModeChrome("IV", null),
    "octordle" to ModeChrome("VIII", null),
    "sequence" to ModeChrome(null, "TrendingUp"),
    "rescue" to ModeChrome(null, "Shield"),
    "six" to ModeChrome("6", null),
    "seven" to ModeChrome("7", null),
    "gauntlet" to ModeChrome(null, "Skull"),
    "propernoundle" to ModeChrome(null, "Crown"),
)

val MODE_CARDS: List<ModeCard> = ModeGen.all.map { m ->
    val chrome = MODE_CHROME[m.id]
    val engine = m.dbKey?.let { runCatching { GameMode.valueOf(it) }.getOrNull() }
    ModeCard(m.id, m.title, m.desc, m.accent, engine, glyph = chrome?.glyph, lucide = chrome?.lucide)
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
    else -> null
}

/**
 * A mode's glyph/icon EXACTLY as the web/home card renders it — a roman
 * numeral/number (IV/VIII/6/7) or the lucide drawable. Use everywhere a mode is
 * shown (home cards, leaderboard grid, profile picker) so icons stay consistent
 * with the web. Caller supplies the tint + sizes.
 */
@Composable
fun ModeGlyph(card: ModeCard, tint: Color, glyphSize: TextUnit, iconSize: Dp) {
    when {
        card.glyph != null -> Text(card.glyph, fontSize = glyphSize, fontWeight = FontWeight.Black, color = tint)
        else -> modeIconRes(card.lucide)?.let { Icon(painterResource(it), null, tint = tint, modifier = Modifier.size(iconSize)) }
    }
}

/** Convenience overload for callers that only have a `:core` GameMode. */
@Composable
fun ModeGlyph(mode: GameMode, tint: Color, glyphSize: TextUnit, iconSize: Dp) {
    modeCardFor(mode)?.let { ModeGlyph(it, tint, glyphSize, iconSize) }
}
