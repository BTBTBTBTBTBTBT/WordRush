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

/** In-game uppercase mode title (matches iOS ModeStyle titles). */
fun modeTitle(mode: GameMode): String = when (mode) {
    GameMode.DUEL -> "CLASSIC"
    GameMode.DUEL_6 -> "CLASSIC SIX"
    GameMode.DUEL_7 -> "CLASSIC SEVEN"
    GameMode.QUORDLE -> "QUADWORD"
    GameMode.OCTORDLE -> "OCTOWORD"
    GameMode.SEQUENCE -> "SUCCESSION"
    GameMode.RESCUE -> "DELIVERANCE"
    GameMode.GAUNTLET -> "GAUNTLET"
    GameMode.PROPERNOUNDLE -> "PROPERNOUNDLE"
    else -> mode.name
}

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

val MODE_CARDS: List<ModeCard> = listOf(
    ModeCard("practice", "Classic", "1 word, 6 tries", Color(0xFF7C3AED), GameMode.DUEL, lucide = "WordleGrid"),
    ModeCard("vs", "VS Battle", "Real-time PvP", Color(0xFF0D9488), null, lucide = "Swords"),
    ModeCard("quordle", "QuadWord", "4 words at once", Color(0xFFEC4899), GameMode.QUORDLE, glyph = "IV"),
    ModeCard("octordle", "OctoWord", "8 boards, 13 tries", Color(0xFF7E22CE), GameMode.OCTORDLE, glyph = "VIII"),
    ModeCard("sequence", "Succession", "4 words, one by one", Color(0xFF2563EB), GameMode.SEQUENCE, lucide = "TrendingUp"),
    ModeCard("rescue", "Deliverance", "4 prefilled boards", Color(0xFF059669), GameMode.RESCUE, lucide = "Shield"),
    ModeCard("six", "Six", "6 letters, 7 tries", Color(0xFF06B6D4), GameMode.DUEL_6, glyph = "6"),
    ModeCard("seven", "Seven", "7 letters, 8 tries", Color(0xFF84CC16), GameMode.DUEL_7, glyph = "7"),
    ModeCard("gauntlet", "Gauntlet", "5 escalating stages", Color(0xFFD97706), GameMode.GAUNTLET, lucide = "Skull"),
    ModeCard("propernoundle", "ProperNoundle", "Guess famous names", Color(0xFFDC2626), GameMode.PROPERNOUNDLE, lucide = "Crown"),
)

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
