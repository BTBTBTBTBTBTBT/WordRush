package com.wordocious.app.ui.friends

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.clickableNoRipple
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
}

/** The game screen's title gradient (§4). */
val FriendlyKind.gradient: List<Color> get() = when (this) {
    FriendlyKind.RPS -> listOf(Color(0xFFF97316), Color(0xFFDB2777))
    FriendlyKind.TTT -> listOf(Color(0xFF7C3AED), Color(0xFFDB2777))
    FriendlyKind.COIN -> listOf(Color(0xFFCA8A04), Color(0xFFDB2777))
    FriendlyKind.PASS -> listOf(Color(0xFF2563EB), Color(0xFF7C3AED))
}

/** The PLAY WITH FRIENDS tile sub line (§2.5). */
val FriendlyKind.sub: String get() = when (this) {
    FriendlyKind.RPS -> "Best of 3 · our tiles"
    FriendlyKind.TTT -> "Three in a row, best of 3"
    FriendlyKind.COIN -> "Heads or tails, best of 5"
    FriendlyKind.PASS -> "One board, take turns"
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

/** White, radius 14, soft shadow, no border. */
fun Modifier.friendsCard(radius: Dp = 14.dp): Modifier =
    this.shadow(4.dp, RoundedCornerShape(radius), ambientColor = Color(0x124C1D95), spotColor = Color(0x124C1D95))
        .clip(RoundedCornerShape(radius)).background(Color.White)

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
 * A pocket game's OUTLINE icon (§0): a white 2.4 stroke in a colored rounded
 * square with a glow in the same color. RPS = scissors, Tic-Tac-Tile = hash,
 * Call It = a coin (two concentric circles + a short vertical line), Pass the
 * Puzzle = two opposing arrows.
 */
@Composable
fun FriendlyGameIcon(kind: FriendlyKind, size: Dp, modifier: Modifier = Modifier) {
    val c = kind.color
    val shape = RoundedCornerShape(size * 0.28f)
    Box(
        modifier.size(size)
            .shadow(size * 0.18f, shape, ambientColor = c.copy(alpha = 0.6f), spotColor = c.copy(alpha = 0.6f))
            .clip(shape).background(c),
        Alignment.Center,
    ) {
        Canvas(Modifier.size(size * 0.56f)) { drawGameGlyph(kind, Color.White) }
    }
}

/** The outline glyph on a 24-unit grid, scaled to the canvas. */
fun DrawScope.drawGameGlyph(kind: FriendlyKind, color: Color) {
    val u = size.minDimension / 24f
    val stroke = Stroke(width = 2.4f * u, cap = StrokeCap.Round, join = StrokeJoin.Round)
    fun line(x1: Float, y1: Float, x2: Float, y2: Float) =
        drawLine(color, Offset(x1 * u, y1 * u), Offset(x2 * u, y2 * u), strokeWidth = 2.4f * u, cap = StrokeCap.Round)
    fun circle(cx: Float, cy: Float, r: Float) = drawCircle(color, r * u, Offset(cx * u, cy * u), style = stroke)
    when (kind) {
        FriendlyKind.RPS -> {
            circle(6f, 6f, 3f); circle(6f, 18f, 3f)
            line(20f, 4f, 8.12f, 15.88f); line(14.47f, 14.48f, 20f, 20f); line(8.12f, 8.12f, 12f, 12f)
        }
        FriendlyKind.TTT -> {
            line(4f, 9f, 20f, 9f); line(4f, 15f, 20f, 15f); line(10f, 3f, 8f, 21f); line(16f, 3f, 14f, 21f)
        }
        FriendlyKind.COIN -> {
            circle(12f, 12f, 9.5f); circle(12f, 12f, 5.5f); line(12f, 9.5f, 12f, 14.5f)
        }
        FriendlyKind.PASS -> {
            val p = Path().apply {
                moveTo(8f * u, 3f * u); lineTo(4f * u, 7f * u); lineTo(8f * u, 11f * u)
                moveTo(4f * u, 7f * u); lineTo(20f * u, 7f * u)
                moveTo(16f * u, 21f * u); lineTo(20f * u, 17f * u); lineTo(16f * u, 13f * u)
                moveTo(20f * u, 17f * u); lineTo(4f * u, 17f * u)
            }
            drawPath(p, color, style = stroke)
        }
    }
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
) {
    val pulse = if (online && !WTheme.reducedMotion) {
        val t = rememberInfiniteTransition(label = "onNowPulse")
        val a by t.animateFloat(0.25f, 0.7f, infiniteRepeatable(tween(1100, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "a")
        a
    } else 0.45f
    Box(modifier.size(size), Alignment.Center) {
        val ringColor = if (online) FriendsPink.green else ring
        Box(
            Modifier.size(size)
                .then(if (online) Modifier.drawBehind {
                    drawCircle(FriendsPink.green.copy(alpha = pulse * 0.45f), radius = this.size.minDimension / 2f + 3.dp.toPx())
                } else Modifier)
                .clip(CircleShape)
                .background(Color(0xFFEDE9FE))
                .then(if (ringColor != null) Modifier.border(2.dp, ringColor, CircleShape) else Modifier),
            Alignment.Center,
        ) {
            val url = avatarUrl?.takeIf { it.isNotBlank() }
            if (url != null) {
                coil.compose.AsyncImage(
                    model = url, contentDescription = name,
                    modifier = Modifier.fillMaxSize().padding(if (ringColor != null) 2.dp else 0.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop,
                )
            } else {
                val emoji = avatarEmoji?.trim().orEmpty()
                Text(
                    if (emoji.isNotEmpty()) emoji else name.trim().take(1).uppercase().ifEmpty { "?" },
                    fontSize = (size.value * 0.4f).sp, fontWeight = FontWeight.Black, color = Color(0xFF7C3AED),
                )
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

/** Flame + count (the home flame), hidden by callers at 0. */
@Composable
fun FlameCount(text: String, modifier: Modifier = Modifier, size: Dp = 12.dp) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(R.drawable.ic_flame_gold), null, modifier = Modifier.size(size))
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
