package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.tween
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.zIndex
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
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
import com.wordocious.core.A11yLabels
import com.wordocious.core.PodiumLayout
import com.wordocious.core.podiumLayout
import com.wordocious.core.podiumOpenSpot
import kotlinx.serialization.json.JsonElement
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.cos
import kotlin.math.roundToInt
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
    /** Founder 10-05: how they got the points — the board rows' detail line ("4 Guesses · 1m 45s"). */
    val detail: String? = null,
)

/** BJ4: the podium split for a board's competition ranks (score-desc order). */
fun boardPodium(ranks: List<Int>): PodiumLayout = podiumLayout(ranks)

/**
 * The podium art (10-03, docs/design/brand/podium/make-pedestals.py): glossy gold / silver /
 * bronze pedestals — `art_podium_N` wears its numeral, `art_podium_N_plain` is blank — and
 * the lilac floor plate they stand on. Same step heights as the code-drawn steps; the
 * width follows the art. Decoded off main ([prewarm]) before Home / the Leaderboard show it.
 */
object PodiumArt {
    /** The pedestal's display bucket (its longer side). */
    val PEDESTAL: Dp = 96.dp
    /** The floor plate's display bucket. */
    val FLOOR: Dp = 360.dp
    /** How far the floor plate rises under the pedestals' feet. */
    val FLOOR_RISE: Dp = 10.dp

    fun pedestal(place: Int, numbered: Boolean = true): Int = when (place.coerceIn(1, 3)) {
        1 -> if (numbered) com.wordocious.app.R.drawable.art_podium_1 else com.wordocious.app.R.drawable.art_podium_1_plain
        2 -> if (numbered) com.wordocious.app.R.drawable.art_podium_2 else com.wordocious.app.R.drawable.art_podium_2_plain
        else -> if (numbered) com.wordocious.app.R.drawable.art_podium_3 else com.wordocious.app.R.drawable.art_podium_3_plain
    }

    val FLOOR_RES: Int get() = com.wordocious.app.R.drawable.art_podium_floor

    /** BJ2: the pedestals + floor into [ArtBitmaps] on the IO pool (same buckets as [PodiumPedestal]). */
    suspend fun prewarm(context: android.content.Context, density: Float) = withContext(Dispatchers.IO) {
        val ped = ArtBitmaps.bucketPx((PEDESTAL.value * density).roundToInt())
        (1..3).forEach { runCatching { ArtBitmaps.get(context, pedestal(it), ped) } }
        runCatching { ArtBitmaps.get(context, FLOOR_RES, ArtBitmaps.bucketPx((FLOOR.value * density).roundToInt())) }
        Unit
    }
}

/**
 * One pedestal at [height] (the column's step height), centered in its column. A [label]
 * other than the place's own number takes the plain pedestal with the label on it.
 */
@Composable
fun PodiumPedestal(place: Int, height: Dp, modifier: Modifier = Modifier, label: String? = null) {
    val numbered = label == null || label == "${place.coerceIn(1, 3)}"
    Box(modifier.fillMaxWidth().height(height).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
        Image(
            artPainter(PodiumArt.pedestal(place, numbered), PodiumArt.PEDESTAL), contentDescription = null,
            contentScale = ContentScale.Fit, modifier = Modifier.matchParentSize(),
        )
        if (!numbered && label != null) {
            Text(
                label, fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color.White,
                modifier = Modifier.offset(y = height * 0.12f),
                style = androidx.compose.ui.text.TextStyle(shadow = Shadow(Color(0x2E000000), Offset(0f, 2f), 0f)),
            )
        }
    }
}

/** The floor plate behind a podium row: full width, [PodiumArt.FLOOR_RISE] × 2 + 4 dp tall, at the bottom. */
@Composable
fun PodiumFloor(modifier: Modifier = Modifier) {
    Image(
        artPainter(PodiumArt.FLOOR_RES, PodiumArt.FLOOR), contentDescription = null,
        contentScale = ContentScale.FillBounds,
        modifier = modifier.fillMaxWidth().height(PodiumArt.FLOOR_RISE * 2 + 4.dp).clearAndSetSemantics { },
    )
}

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
    /** 11b: on the Leaderboard stage the shared backdrop already draws the light + glow — no stage of its own. */
    bare: Boolean = false,
    /** Founder 10-09: the smaller copy (Yesterday): shorter steps, a smaller figure and type; same glows, points and detail lines. */
    compact: Boolean = false,
) {
    val byPlace = spots.associateBy { it.place }
    val dark = WTheme.isDark
    // 2.8 item 13: tapping another player's standing mascot opens their mini Stage card.
    var stageSpot by remember { mutableStateOf<BoardPodiumSpot?>(null) }
    stageSpot?.let { PodiumStageCard(it, it.place) { stageSpot = null } }
    // 2.8 item 40: the steps are fixed-height art, so huge system text is capped at 1.3x here (reflow lives on the rows below)
    CappedFontScale {
    Box(modifier.fillMaxWidth().then(if (bare) Modifier else Modifier.podiumStage(accent, dark)).padding(start = 10.dp, end = 10.dp, top = 8.dp)) {
    PodiumFloor(Modifier.align(Alignment.BottomCenter))
    Row(
        Modifier.fillMaxWidth().padding(bottom = PodiumArt.FLOOR_RISE),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        listOf(2, 1, 3).forEach { place ->
            val s = byPlace[place]
            val base = if (compact) 40.dp else avatar
            val a = if (place == 1) base * 1.22f else base
            val stepH = when (place) {
                1 -> if (compact) 62.dp else 74.dp
                2 -> if (compact) 46.dp else 54.dp
                else -> if (compact) 34.dp else 40.dp
            }
            val stands = s != null && podiumStands(s.username ?: s.name, s.userId, s.avatarUrl, s.config, s.castId, s.frame, s.accentHex)
            val opensCard = stands && s != null && com.wordocious.app.data.FlagsService.isLive("podium_stage_card") && !com.wordocious.app.data.PlayerAvatars.isOwn(s.userId, s.username ?: s.name)
            Column(
                Modifier.weight(1f).then(
                    when {
                        s != null && (opensCard || s.onClick != null) -> Modifier.squishClickable(label = A11yLabels.podiumPlace(place, s.name, s.points, s.detail) + (if (opensCard) ". Opens their stage" else "")) {
                            if (opensCard) stageSpot = s else s.onClick?.invoke()
                        }
                        s != null -> Modifier.semantics(mergeDescendants = true) { contentDescription = A11yLabels.podiumPlace(place, s.name, s.points, s.detail) }
                        place in open -> Modifier.semantics(mergeDescendants = true) {
                            contentDescription = A11yLabels.podiumOpenSpot(place)
                        }
                        else -> Modifier
                    },
                ),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (s != null) {
                    // 2.8 item 13: with the living mascot on, a mascot player STANDS on the step (2x, no tile, posed by place).
                    if (stands) {
                        Box(
                            Modifier.padding(bottom = 0.dp).offset(y = PODIUM_FOOT_OVERLAP).zIndex(1f)
                                .podiumGlow(place, a * PODIUM_FIGURE_SCALE, (a * PODIUM_FIGURE_SCALE) / 2),
                            contentAlignment = Alignment.TopCenter,
                        ) {
                            // the winner's confetti burst opens once on load
                            if (place == 1 && com.wordocious.app.data.FlagsService.isLive("podium_burst")) PodiumBurst()
                            PlayerAvatar(
                                s.username ?: s.name, a * PODIUM_FIGURE_SCALE, Modifier,
                                userId = s.userId, avatarUrl = s.avatarUrl, config = s.config, castId = s.castId,
                                frame = s.frame, accentHex = s.accentHex, podiumPlace = place,
                            )
                            // the crown sits ON the first place's head
                            if (place == 1) Icon3D(Icon3DName.CROWN, if (compact) 28.dp else 34.dp, Modifier.offset(y = -(a * PODIUM_FIGURE_SCALE * 0.05f)))
                        }
                    } else Box(
                        Modifier.podiumGlow(place, a, (if (place == 1) 18.dp else 0.dp) + a / 2),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        PlayerAvatar(
                            s.username ?: s.name, a, Modifier.padding(top = if (place == 1) 18.dp else 0.dp),
                            userId = s.userId, avatarUrl = s.avatarUrl, config = s.config, castId = s.castId,
                            frame = s.frame, accentHex = s.accentHex,
                        )
                        if (place == 1) Icon3D(Icon3DName.CROWN, if (compact) 24.dp else 26.dp)
                    }
                    // Name, points and detail ride on a soft plaque above the step when the figure stands.
                    Column(
                        (if (stands) {
                            // sits fully ABOVE the step (it used to be laid out 12 dp short, so the step rose under it and the plaque covered its top face)
                            Modifier.zIndex(2f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (dark) WTheme.surface.copy(alpha = 0.8f) else Color.White.copy(alpha = 0.72f))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        } else Modifier),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            s.name, fontSize = if (compact) 12.sp else 13.sp, fontWeight = FontWeight.Black,
                            color = if (dark) WTheme.text else FinishInk.heading,
                            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                        )
                        // Points stay the headline (#1 a touch larger), then ONE muted detail line,
                        // shrink-to-fit, never wrapping into the pedestal.
                        SoftNumber(s.points, if (compact) (if (place == 1) 12.5.sp else 11.sp) else (if (place == 1) 14.5.sp else 13.sp))
                        s.detail?.takeIf { it.isNotEmpty() }?.let { d ->
                            FitText(
                                d, if (compact) 9.sp else 10.sp, Modifier.fillMaxWidth().padding(top = 0.dp).offset(y = (-2).dp),
                                color = (if (dark) WTheme.textMuted else LB_SUB_INK).copy(alpha = if (place == 1) 1f else 0.85f),
                                fontWeight = if (place == 1) FontWeight.ExtraBold else FontWeight.Bold,
                                textAlign = TextAlign.Center, minScale = 0.6f,
                            )
                        }
                    }
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
                // Open spots: the pedestal art softly dimmed.
                PodiumPedestal(place, stepH, Modifier.alpha(if (s == null) 0.45f else 1f))
            }
        }
    }
    }
    }
}



/**
 * Podium glow (2.8 TestFlight feedback: "a glow behind the characters so they stand out"): a soft radial light behind a
 * standing figure, one clearly different hue per metal (1st warm gold with a few twinkling sparkles, 2nd cool silver, 3rd copper
 * bronze). Drawn BEHIND the figure (drawBehind), transparent by its rim; the sparkles hold still under calm motion. [figure] is
 * the figure's height and [centerY] its vertical center within the box. Mirrors web PODIUM_GLOW and iOS PodiumGlow hex-for-hex.
 */
@Composable
private fun Modifier.podiumGlow(place: Int, figure: Dp, centerY: Dp): Modifier {
    val calm = WTheme.calmMotion
    val tone = place.coerceIn(1, 3)
    val phase = if (calm || tone != 1) null else rememberInfiniteTransition(label = "podium-twinkle")
        .animateFloat(0f, 1f, infiniteRepeatable(tween(2600, easing = LinearEasing), RepeatMode.Restart), label = "p")
    return this.drawBehind {
        val (core, alpha, scale) = when (tone) {
            1 -> Triple(Color(0xFFFFC93C), 0.8f, 1.55f)
            2 -> Triple(Color(0xFFB4C8EE), 0.75f, 1.4f)
            else -> Triple(Color(0xFFF28A3B), 0.7f, 1.4f)
        }
        val d = figure.toPx() * scale
        val c = Offset(size.width / 2f, centerY.toPx())
        drawCircle(
            Brush.radialGradient(
                0f to core.copy(alpha = alpha), 0.54f to core.copy(alpha = alpha * 0.45f), 1f to core.copy(alpha = 0f),
                center = c, radius = d / 2f,
            ),
            radius = d / 2f, center = c,
        )
        if (tone == 1) {
            val topLeft = Offset(c.x - d / 2f, c.y - d / 2f)
            val t = phase?.value
            PODIUM_SPARKLES.forEach { (fx, fy, px, delay) ->
                val k = if (t == null) 1f else 0.7f + 0.4f * wave(t, delay)
                val a = if (t == null) 0.85f else 0.35f + 0.65f * wave(t, delay)
                val r = px.dp.toPx() * k / 2f
                val ctr = Offset(topLeft.x + d * fx, topLeft.y + d * fy)
                val star = Path().apply {
                    moveTo(ctr.x, ctr.y - r)
                    lineTo(ctr.x + r * 0.24f, ctr.y - r * 0.24f); lineTo(ctr.x + r, ctr.y)
                    lineTo(ctr.x + r * 0.24f, ctr.y + r * 0.24f); lineTo(ctr.x, ctr.y + r)
                    lineTo(ctr.x - r * 0.24f, ctr.y + r * 0.24f); lineTo(ctr.x - r, ctr.y)
                    lineTo(ctr.x - r * 0.24f, ctr.y - r * 0.24f); close()
                }
                drawPath(star, Color(0xFFFFF1B8).copy(alpha = a))
            }
        }
    }
}

/** 0..1..0 over a phase (0..1) shifted by [delaySec] of the 2.6 s cycle. */
private fun wave(phase: Float, delaySec: Float): Float =
    (0.5f - 0.5f * cos(2.0 * Math.PI * (phase + delaySec / 2.6f)).toFloat())

/** The gold glow's sparkles: (x, y) as fractions of the glow, size dp, delay s. Same as web PODIUM_SPARKLES. */
private val PODIUM_SPARKLES = listOf(
    Sparkle(0.14f, 0.30f, 9f, 0f), Sparkle(0.86f, 0.24f, 7f, 0.7f), Sparkle(0.24f, 0.74f, 6f, 1.3f), Sparkle(0.80f, 0.68f, 8f, 0.35f),
)

private data class Sparkle(val fx: Float, val fy: Float, val px: Float, val delay: Float)

/**
 * 2.8 item 13: the winner's confetti burst, once, as the podium opens (the celebration kit's party burst, the season's swap
 * when there is one). Scale + alpha only; nothing under Reduce Motion / Low Power.
 */
@Composable
private fun PodiumBurst() {
    val still = WTheme.calmMotion
    val ctx = LocalContext.current
    val res = remember {
        val n = SeasonKit.extra(ctx, SeasonSkins.current(), "celebrate-burst-party") ?: return@remember 0
        ctx.resources.getIdentifier(n.replace('-', '_'), "drawable", ctx.packageName)
    }
    if (still || res == 0) return
    val t = remember { Animatable(0f) }
    val fade = remember { Animatable(1f) }
    LaunchedEffect(Unit) {
        t.animateTo(1f, tween(550))
        kotlinx.coroutines.delay(150)
        fade.animateTo(0f, tween(500))
    }
    Image(
        painterResource(res), contentDescription = null, contentScale = ContentScale.Fit,
        modifier = Modifier.requiredSize(170.dp).graphicsLayer {
            val k = 0.4f + 0.65f * t.value
            scaleX = k; scaleY = k; alpha = t.value.coerceAtMost(1f) * fade.value
        }.clearAndSetSemantics { },
    )
}

/**
 * 2.8 item 13: the mini Stage card a podium mascot opens: that player's mascot standing on the stage in their backdrop,
 * posed for the place they hold, then their name, points and a quiet View profile pill. Nothing new is fetched.
 */
@Composable
private fun PodiumStageCard(spot: BoardPodiumSpot, place: Int, onDismiss: () -> Unit) {
    val dark = WTheme.isDark
    val resolved = com.wordocious.app.data.PlayerAvatars.resolve(
        com.wordocious.app.data.AvatarFields(spot.userId, spot.username ?: spot.name, spot.avatarUrl, spot.config, spot.castId, spot.frame, spot.accentHex),
    )
    val posed = remember(resolved.config, place) { resolved.config.copy(pose = com.wordocious.core.AvatarPoses.placePose(place)) }
    val initial = remember(spot.username, spot.name) { com.wordocious.app.data.MascotConfigRules.initialOf(spot.username ?: spot.name) }
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(if (dark) WTheme.surface else Color.White),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            DressStage(posed, initial, photoUrl = resolved.photoUrl, height = 250.dp, mascotSize = 160.dp, mascotDescription = A11yLabels.mascot(false, spot.name)) {
                StageCloseButton(label = "Close", modifier = Modifier.align(Alignment.TopEnd).padding(8.dp), onClick = onDismiss)
            }
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(spot.name, fontSize = 20.sp, fontWeight = FontWeight.Black, color = if (dark) WTheme.text else FinishInk.heading, maxLines = 1, overflow = TextOverflow.Ellipsis)
                SoftNumber(spot.points, 15.sp)
                spot.onClick?.let { go ->
                    QuietButton("View profile", { onDismiss(); go() }, Modifier.padding(top = 6.dp), size = CandySize.SMALL)
                }
            }
        }
    }
}
