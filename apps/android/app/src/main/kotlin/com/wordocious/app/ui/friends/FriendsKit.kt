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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.em
import com.wordocious.app.ui.CandyButton
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandySize
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.Wash
import com.wordocious.app.ui.pageCardShadow
import com.wordocious.app.ui.softNumberStyle
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
    /** FINISH_SPEC C4 inks (stats-friends-polish mockup). */
    val labelInk = Color(0xFF8A2D63)
    val heading = Color(0xFF2A1650)
    val muted = Color(0xFF6F5F8F)
    /** The online dot (#22c55e). */
    val online = Color(0xFF22C55E)
}

/** OUR tile colors (never Wordle green/yellow): purple = right / you, amber = present / them, slate = absent. */
object FriendsTiles {
    val purple = Color(0xFF7C3AED)
    val amber = Color(0xFFF59E0B)
    val slate = Color(0xFFCBD5E1)
}

/**
 * Each pocket game's color — FINISH_SPEC C4 (stats-friends-polish mockup): the PLAY
 * WITH FRIENDS cards' own top bars (RPS orange, Tic-Tac-Tile purple, Call It gold,
 * Pass the Puzzle sky, Ghost violet, Word Chain green); the card tint is its wash.
 */
val FriendlyKind.color: Color get() = when (this) {
    FriendlyKind.RPS -> Color(0xFFF97316)
    FriendlyKind.TTT -> Color(0xFF7C3AED)
    FriendlyKind.COIN -> Color(0xFFEAB308)
    FriendlyKind.PASS -> Color(0xFF0EA5E9)
    FriendlyKind.GHOST -> Color(0xFF8B5CF6)
    FriendlyKind.CHAIN -> Color(0xFF10B981)
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

/**
 * "PLAY WITH FRIENDS", "YOUR TURN" … — the finishing kit's section label (FinishLabel:
 * 11 sp Black, .12em) in the Friends page's pink label ink. The Friends tab is a
 * fixed-light design (pageBackground alwaysLight), so the ink stays fixed in every theme.
 */
@Composable
fun FriendsLabel(text: String, modifier: Modifier = Modifier, color: Color = FriendsPink.labelInk) {
    Text(
        text, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.12.em, color = color,
        modifier = modifier, maxLines = 1, overflow = TextOverflow.Ellipsis,
    )
}

/**
 * A1 the Friends page's fixed-light wash of [accent] (the Friends tab stays light in
 * every theme, like its wallpaper).
 */
fun friendsWash(accent: Color, amount: Float = Wash.CARD): Color = Wash.mix(accent, amount)

/** A1 the matching fixed-light 1.5 dp line. */
fun friendsLine(accent: Color, amount: Float = Wash.LINE): Color = Wash.mix(accent, amount)

/**
 * A1 a Friends card: the page's pink wash (or [accent]'s) with a 1.5 dp line, radius
 * [radius], a soft violet lift and, when [bar] is set, the game-card top bar.
 */
fun Modifier.friendsCard(radius: Dp = 14.dp, accent: Color = FRIENDS_CARD_ACCENT, bar: Color? = null, barHeight: Dp = 10.dp): Modifier =
    this.pageCardShadow(radius) { shadow(4.dp, RoundedCornerShape(radius), ambientColor = Color(0x124C1D95), spotColor = Color(0x124C1D95)) }
        .clip(RoundedCornerShape(radius))
        // FINISH_SPEC A1: the accent's wash + a faint line instead of white (fixed light, like the page).
        .background(friendsWash(accent))
        .then(if (bar != null) Modifier.drawBehind { drawRect(bar, Offset.Zero, Size(size.width, barHeight.toPx())) } else Modifier)
        // BI23 (founder: no outlined boxes anywhere): wash + soft lift, no line.

/** A1 the Friends page accent the cards wash with (#ec4899). */
val FRIENDS_CARD_ACCENT = Color(0xFFEC4899)

/**
 * A8 the Friends small action: a SMALL candy button — [solid] = the pink candy, soft =
 * the quiet peach candy. (Was a flat pink pill; every caller flips with it.)
 */
@Composable
fun PinkPill(text: String, solid: Boolean, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    CandyButton(
        text, onClick = onClick, modifier = modifier,
        color = if (solid) CandyColor.PINK else CandyColor.PEACH,
        size = CandySize.SMALL, enabled = enabled,
    )
}

/**
 * A8 the Friends call to action: a LARGE candy button stretched to the width it is
 * given — [solid] = the pink candy, soft = the quiet peach candy.
 */
@Composable
fun PinkButton(text: String, modifier: Modifier = Modifier, solid: Boolean = true, enabled: Boolean = true, onClick: () -> Unit) {
    CandyButton(
        text, onClick = onClick, modifier = modifier,
        color = if (solid) CandyColor.PINK else CandyColor.PEACH,
        size = CandySize.LARGE, fill = true, enabled = enabled,
    )
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
        com.wordocious.app.ui.artPainter(com.wordocious.app.ui.pocketArtRes(kind), size), contentDescription = null,
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
    /** The pulsing green ring around an online face (off = just the green dot, C4 banner). */
    presenceRing: Boolean = true,
    /** BJ5: the friend's user id (the shared avatar resolver). */
    userId: String? = null,
) {
    // AQ2: the pulse is read in the draw pass only (no per-frame recomposition of the row),
    // and holds still while the page scrolls or is hidden.
    val pulseState: androidx.compose.runtime.State<Float> = if (online && presenceRing && !WTheme.reducedMotion && !com.wordocious.app.ui.ambientMotionPaused()) {
        val t = rememberInfiniteTransition(label = "onNowPulse")
        t.animateFloat(0.25f, 0.7f, infiniteRepeatable(tween(1100, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "a")
    } else androidx.compose.runtime.remember { androidx.compose.runtime.mutableFloatStateOf(0.45f) }
    // BJ5: THE shared resolver (photo / saved mascot / worn cast / seeded) — a rounded square
    // either way (AN6), so the ring, glow and presence dot follow the tile shape.
    val shape = com.wordocious.app.ui.avatarTileShape(size)
    @Suppress("UNUSED_VARIABLE") val retiredEmoji = avatarEmoji
    Box(modifier.size(size), Alignment.Center) {
        val ringColor = if (online && presenceRing) FriendsPink.green else ring
        val glow = if (online && presenceRing) Modifier.drawBehind {
            val grow = 3.dp.toPx()
            // AN6: photo and mascot are both rounded squares, so the glow is too.
            drawRoundRect(
                FriendsPink.green.copy(alpha = pulseState.value * 0.45f),
                topLeft = androidx.compose.ui.geometry.Offset(-grow, -grow),
                size = androidx.compose.ui.geometry.Size(this.size.width + 2 * grow, this.size.height + 2 * grow),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(this.size.minDimension * 0.22f + grow),
            )
        } else Modifier
        Box(Modifier.size(size).then(glow)) {
            // AA2: the signed-in Pro player's own face wears the gold ring + crown.
            com.wordocious.app.ui.PlayerAvatar(
                name, size, userId = userId, avatarUrl = avatarUrl, accentHex = accentHex,
                pro = com.wordocious.app.ui.isOwnProAvatar(name), contentDescription = name,
            )
            if (ringColor != null) Box(Modifier.matchParentSize().border(2.dp, ringColor, shape))
        }
        if (online) {
            // C4: the green dot (#22c55e) in a 2 dp white ring.
            Box(
                Modifier.align(Alignment.BottomEnd).offset(x = 3.dp, y = 1.dp)
                    .size((size.value * 0.3f).coerceAtLeast(12f).dp)
                    .clip(CircleShape).background(Color.White).padding(2.dp)
                    .clip(CircleShape).background(FriendsPink.online),
            )
        }
    }
}

/** The 3D streak flame (HEADER_SPEC §2) + count, hidden by callers at 0. */
@Composable
fun FlameCount(text: String, modifier: Modifier = Modifier, size: Dp = 14.dp) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        com.wordocious.app.ui.Icon3D(com.wordocious.app.ui.Icon3DName.FLAME, size)
        // A2: the count in the soft-number style (fixed light: the Friends tab).
        Text(text, style = softNumberStyle(12.sp, FinishInk.softNumber), maxLines = 1)
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
