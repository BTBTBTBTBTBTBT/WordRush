package com.wordocious.app.ui.friends

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.pageCardShadow
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.CoinFace
import com.wordocious.core.FriendlyKind
import com.wordocious.core.RpsPick

// The Friends overhaul's look (founder-approved 2026-10-01; spec
// docs/FRIENDS_REDESIGN_SPEC.md §0): the home / VS aesthetic in a PINK accent.
// Page #f8f7ff, Nunito, caps headlines at 900, section labels 11/900 with 1.2
// tracking in #6b7280, borderless white cards (radius 14, soft shadow). Shared
// by the Friends tab, the banner, the quick-play sheet and the game screens.

object FriendsPink {
    val ink = Color(0xFF831843)
    val mid = Color(0xFF9D174D)
    val solid = Color(0xFFDB2777)
    val soft = Color(0xFFFCE7F3)
    val titleGradient = listOf(Color(0xFFDB2777), Color(0xFF7C3AED))
    val green = Color(0xFF10B981)
    val flameInk = Color(0xFFC2410C)
    val flame = Color(0xFFF59E0B)
    val page = Color(0xFFF8F7FF)
    val label = Color(0xFF6B7280)
    val sub = Color(0xFF4B5563)
    val lavender = Color(0xFFEDE9FE)
}

/** OUR tile colors (never Wordle green/yellow): purple = right / you, amber = present / them, slate = absent. */
object FriendsTiles {
    val purple = Color(0xFF7C3AED)
    val amber = Color(0xFFF59E0B)
    val slate = Color(0xFFCBD5E1)
}

/** Each pocket game's color (§0). */
val FriendlyKind.color: Color get() = when (this) {
    FriendlyKind.RPS -> Color(0xFFF97316)
    FriendlyKind.TTT -> Color(0xFF7C3AED)
    FriendlyKind.COIN -> Color(0xFFCA8A04)
    FriendlyKind.PASS -> Color(0xFF2563EB)
    FriendlyKind.GHOST -> Color(0xFF9F1239)
    FriendlyKind.CHAIN -> Color(0xFF059669)
}

/** The game screen's title gradient (§4). */
val FriendlyKind.gradient: List<Color> get() = when (this) {
    FriendlyKind.RPS -> listOf(Color(0xFFF97316), Color(0xFFDB2777))
    FriendlyKind.TTT -> listOf(Color(0xFF7C3AED), Color(0xFFDB2777))
    FriendlyKind.COIN -> listOf(Color(0xFFCA8A04), Color(0xFFDB2777))
    FriendlyKind.PASS -> listOf(Color(0xFF2563EB), Color(0xFF7C3AED))
    FriendlyKind.GHOST -> listOf(Color(0xFF9F1239), Color(0xFF7C3AED))
    FriendlyKind.CHAIN -> listOf(Color(0xFF059669), Color(0xFF2563EB))
}

/** The PLAY WITH FRIENDS tile sub line (§2.5, §9). */
val FriendlyKind.sub: String get() = when (this) {
    FriendlyKind.RPS -> "Best of 3 · our tiles"
    FriendlyKind.TTT -> "Three in a row, best of 3"
    FriendlyKind.COIN -> "Heads or tails, best of 5"
    FriendlyKind.PASS -> "One board, take turns"
    FriendlyKind.GHOST -> "Add a letter; don't finish a word"
    FriendlyKind.CHAIN -> "Last letter starts the next"
}

/** The ChatGPT art (§0): res/drawable-nodpi/friends_<name>.png. */
fun rpsArt(pick: RpsPick): Int = when (pick) {
    RpsPick.ROCK -> R.drawable.friends_rock
    RpsPick.PAPER -> R.drawable.friends_paper
    RpsPick.SCISSORS, RpsPick.HIDDEN -> R.drawable.friends_scissors
}

fun coinArt(face: CoinFace): Int = if (face == CoinFace.HEADS) R.drawable.friends_heads else R.drawable.friends_tails

/** "PLAY WITH FRIENDS", "YOUR TURN" … — 11 sp, 900, letter-spacing 1.2, grey. */
@Composable
fun FriendsLabel(text: String, modifier: Modifier = Modifier, color: Color = FriendsPink.label) {
    Text(text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = color, modifier = modifier, maxLines = 1)
}

/** White, radius 14, soft shadow (the page accent on a tinted page, ART_SPEC §11), no border. */
fun Modifier.friendsCard(radius: Dp = 14.dp): Modifier =
    this.pageCardShadow(radius) { shadow(4.dp, RoundedCornerShape(radius), ambientColor = Color(0x124C1D95), spotColor = Color(0x124C1D95)) }
        .clip(RoundedCornerShape(radius))
        // FINISH_SPEC A1: the Friends page's pink wash + a faint pink line instead of white
        // (dark mode keeps the card it had).
        .background(if (com.wordocious.app.ui.theme.WTheme.isDark) Color.White else com.wordocious.app.ui.Wash.mix(FRIENDS_CARD_ACCENT, com.wordocious.app.ui.Wash.CARD))
        .then(
            if (com.wordocious.app.ui.theme.WTheme.isDark) Modifier
            else Modifier.border(1.5.dp, com.wordocious.app.ui.Wash.mix(FRIENDS_CARD_ACCENT, com.wordocious.app.ui.Wash.LINE), RoundedCornerShape(radius))
        )

/** A1 the Friends page accent the cards wash with (#ec4899). */
private val FRIENDS_CARD_ACCENT = Color(0xFFEC4899)

/** Solid pink (primary) or soft pink pill. */
@Composable
fun PinkPill(text: String, solid: Boolean, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(50))
            .background(if (solid) FriendsPink.solid else FriendsPink.soft)
            .alpha(if (enabled) 1f else 0.5f)
            .clickableNoRipple { if (enabled) onClick() }
            .padding(horizontal = 12.dp, vertical = 6.dp),
        Alignment.Center,
    ) {
        Text(
            text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, maxLines = 1,
            color = if (solid) Color.White else FriendsPink.solid,
        )
    }
}

/** Full-width solid pink caps button (CTA). */
@Composable
fun PinkButton(text: String, modifier: Modifier = Modifier, solid: Boolean = true, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(14.dp))
            .background(if (solid) FriendsPink.solid else FriendsPink.soft)
            .alpha(if (enabled) 1f else 0.5f)
            .clickableNoRipple { if (enabled) onClick() }
            .padding(horizontal = 16.dp, vertical = 13.dp),
        Alignment.Center,
    ) {
        Text(
            text, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, maxLines = 1,
            color = if (solid) Color.White else FriendsPink.solid,
        )
    }
}

/**
 * A pocket game's icon (ART_SPEC §9): the glossy 3D `game_pocket_<kind>` art (rock
 * fist, X+O, star coin, puzzle piece, little ghost, chain links) filling a soft chip
 * in the game's accent, like the §3 game icons. Decorative.
 */
@Composable
fun FriendlyGameIcon(kind: FriendlyKind, size: Dp, modifier: Modifier = Modifier) {
    Box(
        modifier.size(size).clip(RoundedCornerShape(size * 0.28f)).background(kind.color.copy(alpha = 0.14f)),
        Alignment.Center,
    ) {
        FriendlyGameGlyph(kind, size * 0.86f)
    }
}

/** A pocket game's 3D art alone (§9), for the soft chip of a game tile (docs/GAME_TILE_STYLE.md); ~0.82 of the chip. */
@Composable
fun FriendlyGameGlyph(kind: FriendlyKind, size: Dp) {
    Image(
        painterResource(com.wordocious.app.ui.pocketArtRes(kind)), contentDescription = null,
        modifier = Modifier.size(size).clearAndSetSemantics { },
    )
}

/**
 * A friend's face: avatar (photo, emoji or initial) with, when they are on, a
 * 2 dp green ring with a soft pulse and a green dot.
 */
@Composable
fun FriendFace(
    name: String,
    avatarUrl: String?,
    avatarEmoji: String?,
    size: Dp,
    online: Boolean,
    modifier: Modifier = Modifier,
    ring: Color? = null,
    accentHex: String? = null,
) {
    val pulse = if (online && !WTheme.reducedMotion) {
        val t = rememberInfiniteTransition(label = "onNowPulse")
        val a by t.animateFloat(0.25f, 0.7f, infiniteRepeatable(tween(1100, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "a")
        a
    } else 0.45f
    val url = avatarUrl?.takeIf { it.isNotBlank() }
    // ART_SPEC §20: no photo → letter tile; its ring, glow and presence dot follow the tile's rounded square.
    val shape = com.wordocious.app.ui.avatarShape(hasPhoto = url != null, size = size)
    Box(modifier.size(size), Alignment.Center) {
        val ringColor = if (online) FriendsPink.green else ring
        val glow = if (online) Modifier.drawBehind {
            val grow = 3.dp.toPx()
            if (url != null) {
                drawCircle(FriendsPink.green.copy(alpha = pulse * 0.45f), radius = this.size.minDimension / 2f + grow)
            } else {
                drawRoundRect(
                    FriendsPink.green.copy(alpha = pulse * 0.45f),
                    topLeft = androidx.compose.ui.geometry.Offset(-grow, -grow),
                    size = androidx.compose.ui.geometry.Size(this.size.width + 2 * grow, this.size.height + 2 * grow),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(this.size.minDimension * 0.24f + grow),
                )
            }
        } else Modifier
        if (url != null) {
            Box(
                Modifier.size(size).then(glow)
                    .clip(CircleShape)
                    .background(Color(0xFFEDE9FE))
                    .then(if (ringColor != null) Modifier.border(2.dp, ringColor, CircleShape) else Modifier),
                Alignment.Center,
            ) {
                coil.compose.AsyncImage(
                    model = url, contentDescription = name,
                    modifier = Modifier.fillMaxSize().padding(if (ringColor != null) 2.dp else 0.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop,
                )
            }
        } else {
            Box(Modifier.size(size).then(glow)) {
                com.wordocious.app.ui.LetterTileAvatar(name, size, accentHex = accentHex, emoji = avatarEmoji)
                if (ringColor != null) Box(Modifier.matchParentSize().border(2.dp, ringColor, shape))
            }
        }
        if (online) {
            Box(
                Modifier.align(Alignment.BottomEnd).offset(x = 1.dp, y = 1.dp)
                    .size((size.value * 0.28f).coerceAtLeast(9f).dp)
                    .clip(CircleShape).background(Color.White).padding(1.5.dp)
                    .clip(CircleShape).background(FriendsPink.green),
            )
        }
    }
}

/** The 3D streak flame (HEADER_SPEC §2) + count, hidden by callers at 0. */
@Composable
fun FlameCount(text: String, modifier: Modifier = Modifier, size: Dp = 14.dp) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.FLAME, size)
        Text(text, fontSize = 11.sp, fontWeight = FontWeight.Black, color = FriendsPink.flameInk, maxLines = 1)
    }
}

/** HH:MM:SS to local midnight (the Friends banner clock). */
fun localMidnightClock(): String {
    val now = java.time.LocalDateTime.now()
    val secs = java.time.Duration.between(now, now.toLocalDate().plusDays(1).atStartOfDay()).seconds.coerceAtLeast(0)
    return String.format(java.util.Locale.US, "%02d:%02d:%02d", secs / 3600, (secs % 3600) / 60, secs % 60)
}

/** "You lead 5–3" / "They lead 5–3" / "Tied 2–2" from the 90-day daily head-to-head (web rivalryLine). */
fun h2hWords(w: Int, l: Int): String? = when {
    w + l == 0 -> null
    w == l -> "Tied $w–$l"
    w > l -> "You lead $w–$l"
    else -> "They lead $l–$w"
}
