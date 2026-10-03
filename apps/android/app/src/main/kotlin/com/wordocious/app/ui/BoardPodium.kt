package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.PodiumLayout
import com.wordocious.core.podiumLayout
import com.wordocious.core.podiumOpenSpot
import kotlinx.serialization.json.JsonElement
import kotlin.math.cos
import kotlin.math.sin

// FINISH_SPEC BJ4 (founder 10-03: "The podium only appears on classic right now") —
// every board (each game's daily board, Everyone AND Friends, the Sweep board today +
// yesterday, Puzzles / More Games, Yesterday's Winners, Records) stands its leaders on the
// podium once ONE result is in: core podiumLayout(ranks) says how many leading rows stand
// on it, the free places are open spots (the pedestal softly dimmed, R asleep where the
// avatar goes, "Open spot · Claim #N", not tappable), rows after the podium list below.
// The stage backdrop sits behind it inside the board card's top: one soft accent
// gradient, ONE static shape layer (faint sunburst rays from just above #1, a few tiny
// confetti dots, a soft floor shadow under the pedestals). Static and cheap: no
// animation, no blur, no outline.

/** One player on the podium. [place] is the column (1–3); avatars go through PlayerAvatar (BJ5). */
data class BoardPodiumSpot(
    val place: Int,
    val name: String,
    val points: String,
    val username: String?,
    val userId: String? = null,
    val avatarUrl: String? = null,
    val config: JsonElement? = null,
    val castId: String? = null,
    val frame: String? = null,
    val accentHex: String? = null,
    val onClick: (() -> Unit)? = null,
    /** Friends board: the taunt bell under the name (null = none). */
    val onTaunt: (() -> Unit)? = null,
)

/** BJ4: the podium split for a board's competition ranks (score-desc order). */
fun boardPodium(ranks: List<Int>): PodiumLayout = podiumLayout(ranks)

/** The sleepy cast member on an open spot (art-scene-r-asleep, ~373×302). */
private const val ASLEEP_ASPECT = 373f / 302f

/** Cast colors for the confetti dots (W, O, D, C, I, S). */
private val CONFETTI = listOf(
    Color(0xFF8B2CF5), Color(0xFFFF2F91), Color(0xFF0A6CFF), Color(0xFF00B4BE), Color(0xFF4CC77A), Color(0xFFF5A623),
)

/** Fixed confetti positions (fractions of the stage) + radius in dp. */
private val CONFETTI_DOTS = listOf(
    Triple(0.08f, 0.22f, 1.6f), Triple(0.19f, 0.08f, 1.2f), Triple(0.31f, 0.30f, 1.0f),
    Triple(0.70f, 0.12f, 1.4f), Triple(0.82f, 0.28f, 1.1f), Triple(0.93f, 0.10f, 1.8f),
    Triple(0.58f, 0.04f, 1.0f),
)

/**
 * BJ4 the stage backdrop: accent gradient (≈16% at the top → 0 at the pedestal base), the
 * static ray + confetti layer and the floor shadow. Dark mode: the same at lower alphas.
 */
private fun Modifier.podiumStage(accent: Color, dark: Boolean): Modifier = this.drawBehind {
    val w = size.width
    val h = size.height
    val k = if (dark) 0.6f else 1f
    drawRect(Brush.verticalGradient(listOf(accent.copy(alpha = 0.16f * k), accent.copy(alpha = 0f)), startY = 0f, endY = h))
    // ~12 faint sunburst rays fanning down from a point just above the #1 column.
    val origin = Offset(w / 2f, -h * 0.08f)
    val reach = h * 1.4f
    val rayInk = (if (dark) Color.White else accent).copy(alpha = 0.09f * k)
    val rays = 12
    val span = Math.toRadians(150.0)
    val start = Math.toRadians(90.0) - span / 2
    val step = span / rays
    for (i in 0 until rays) {
        val a0 = start + step * i
        val a1 = a0 + step * 0.45
        val p = Path().apply {
            moveTo(origin.x, origin.y)
            lineTo(origin.x + (cos(a0) * reach).toFloat(), origin.y + (sin(a0) * reach).toFloat())
            lineTo(origin.x + (cos(a1) * reach).toFloat(), origin.y + (sin(a1) * reach).toFloat())
            close()
        }
        drawPath(p, rayInk)
    }
    // 6–8 tiny confetti dots (2–4 px), fixed positions, cast colors at ~50%.
    CONFETTI_DOTS.forEachIndexed { i, (fx, fy, r) ->
        drawCircle(CONFETTI[i % CONFETTI.size].copy(alpha = 0.5f * k), r.dp.toPx(), Offset(fx * w, fy * h))
    }
    // A soft elliptical floor shadow under the pedestals (radial, black ~10%).
    val floorH = 14.dp.toPx()
    val center = Offset(w / 2f, h - floorH * 0.35f)
    drawOval(
        Brush.radialGradient(
            listOf(Color.Black.copy(alpha = 0.10f * k), Color.Black.copy(alpha = 0f)),
            center = center, radius = w * 0.46f,
        ),
        topLeft = Offset(w * 0.04f, h - floorH),
        size = Size(w * 0.92f, floorH),
    )
}

/**
 * BJ4 the board podium: second · first · third, [spots] standing on their gold / silver /
 * bronze steps, [open] places as open spots, over the stage backdrop in [accent]. Put it
 * FIRST inside a board card (lbBoardCard clips it to the card's top corners).
 */
@Composable
fun BoardPodium(
    spots: List<BoardPodiumSpot>,
    open: List<Int>,
    accent: Color,
    modifier: Modifier = Modifier,
    avatar: Dp = 44.dp,
) {
    val byPlace = spots.associateBy { it.place }
    val dark = WTheme.isDark
    Row(
        modifier.fillMaxWidth().podiumStage(accent, dark).padding(start = 10.dp, end = 10.dp, top = 8.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        listOf(2, 1, 3).forEach { place ->
            val s = byPlace[place]
            val a = if (place == 1) avatar * 1.22f else avatar
            val stepH = when (place) { 1 -> 74.dp; 2 -> 54.dp; else -> 40.dp }
            Column(
                Modifier.weight(1f).then(
                    when {
                        s?.onClick != null -> Modifier.squishClickable(label = "${podiumPlaceWord(place)} place, ${s.name}, ${s.points}") { s.onClick.invoke() }
                        s != null -> Modifier.semantics(mergeDescendants = true) { contentDescription = "${podiumPlaceWord(place)} place, ${s.name}, ${s.points}" }
                        place in open -> Modifier.semantics(mergeDescendants = true) {
                            contentDescription = "${podiumPlaceWord(place)} place, open spot"
                        }
                        else -> Modifier
                    },
                ),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (s != null) {
                    Box(contentAlignment = Alignment.TopCenter) {
                        PlayerAvatar(
                            s.username ?: s.name, a, Modifier.padding(top = if (place == 1) 18.dp else 0.dp),
                            userId = s.userId, avatarUrl = s.avatarUrl, config = s.config, castId = s.castId,
                            frame = s.frame, accentHex = s.accentHex,
                        )
                        if (place == 1) Icon3D(Icon3DName.CROWN, 26.dp)
                    }
                    Text(
                        s.name, fontSize = 13.sp, fontWeight = FontWeight.Black,
                        color = if (dark) WTheme.text else FinishInk.heading,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                    )
                    SoftNumber(s.points, 13.sp)
                    // Friends board: the taunt bell stays reachable for friends on the podium.
                    s.onTaunt?.let { taunt ->
                        SoftControl(Icon3DName.BELL, "Taunt ${s.name}", taunt, iconSize = 16.dp)
                    }
                } else if (place in open) {
                    val spot = podiumOpenSpot(place)
                    Box(Modifier.padding(top = if (place == 1) 18.dp else 0.dp).height(a), contentAlignment = Alignment.BottomCenter) {
                        Image(
                            painterResource(com.wordocious.app.R.drawable.art_scene_r_asleep), contentDescription = null,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.height(a).width(a * ASLEEP_ASPECT).clearAndSetSemantics { },
                        )
                    }
                    Text(
                        spot.title, fontSize = 13.sp, fontWeight = FontWeight.Black,
                        color = (if (dark) WTheme.text else FinishInk.heading).copy(alpha = 0.7f),
                        maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                    )
                    Text(
                        spot.line, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold,
                        color = if (dark) WTheme.textMuted else LB_SUB_INK,
                        maxLines = 1, textAlign = TextAlign.Center,
                    )
                }
                Box(
                    Modifier.fillMaxWidth().height(stepH)
                        .alpha(if (s == null) 0.4f else 1f)
                        .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
                        .background(Brush.verticalGradient(PodiumInk.step(place)))
                        .clearAndSetSemantics { },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "$place", fontSize = 22.sp, fontWeight = FontWeight.Black, color = Color.White,
                        style = androidx.compose.ui.text.TextStyle(shadow = Shadow(Color(0x26000000), Offset(0f, 2f), 0f)),
                    )
                }
            }
        }
    }
}

private fun podiumPlaceWord(place: Int) = when (place) { 1 -> "First"; 2 -> "Second"; 3 -> "Third"; else -> "#$place" }
