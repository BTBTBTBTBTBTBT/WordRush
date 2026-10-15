package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
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
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.A11yLabels
import com.wordocious.core.PodiumArtGeometry
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
// yesterday, Puzzles / More Games, Yesterday's Winners, Records, the Friends races) stands its
// leaders on the podium once ONE result is in: core podiumLayout(ranks) says how many leading
// rows stand on it, the free places are open spots, rows after the podium list below.
// 2.8 (founder 10-15): all of them stand on ONE stadium image with the stats printed in its panels.

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
    /** Panel lines under the score, when the caller has them already split (the race's highlight lines); wins over [detail]. */
    val lines: List<String>? = null,
)

/** BJ4: the podium split for a board's competition ranks (score-desc order). */
fun boardPodium(ranks: List<Int>): PodiumLayout = podiumLayout(ranks)

/**
 * 2.8 one-image podium (founder 10-15): ONE stadium image (art_podium_stage, 1536x1024, transparent fades) stands behind
 * every podium — the crowd, the lights and three glossy numbered steps each with a blank satin panel. It replaces the
 * three pedestal blocks AND the per-player stat plaques. The geometry (feet + panel rectangles, as fractions of the image)
 * lives in core [PodiumArtGeometry]; decoded once through [ArtBitmaps] (prewarmed off main).
 */
object PodiumArt {
    val STAGE_RES: Int get() = com.wordocious.app.R.drawable.art_podium_stage
    /** A phone-width display bucket for the prewarm (the art is 1536 px wide; wider screens decode a bigger bucket on first use). */
    val PREWARM: Dp = 360.dp
    /** The widest the stage grows on a tablet (page width, capped). */
    val MAX_WIDTH: Dp = 1000.dp

    /** The stage image's height for a display [width]. */
    fun heightFor(width: Dp): Dp = width / PodiumArtGeometry.ASPECT.toFloat()

    /** The stage decoded into [ArtBitmaps] on the IO pool, before Home / the Leaderboard show it. */
    suspend fun prewarm(context: android.content.Context, density: Float) = withContext(Dispatchers.IO) {
        runCatching { ArtBitmaps.get(context, STAGE_RES, ArtBitmaps.bucketPx((PREWARM.value * density).roundToInt())) }
        Unit
    }
}

/**
 * The cheering pose (1st place) is drawn mid-jump: its cutout's feet sit this fraction of the figure's size above the box's
 * bottom edge, so the winner's box drops by it to land on the step like the claps / wave poses do (measured on the emulator).
 */
private const val CHEER_FEET_DROP = 0.19f

/** The panel's text ink: rgb(70, 30, 100) on all three light satin panels (core PodiumArtGeometry.TEXT_RGB). */
private val PANEL_INK = PodiumArtGeometry.TEXT_RGB.let { Color(it[0], it[1], it[2]) }

/** The sleepy cast member on an open spot (art-scene-r-asleep, ~373×302). */
private const val ASLEEP_ASPECT = 373f / 302f

/** The detail text as at most two panel lines: the first part, then the rest (parity with iOS PodiumView.detailLines). */
fun podiumDetailLines(detail: String?): List<String> {
    if (detail.isNullOrEmpty()) return emptyList()
    val parts = detail.split("·").map { it.trim() }.filter { it.isNotEmpty() }
    // Founder 10-12 ("3M 13S · 2/4 · 1 HI…"): with time, boards AND hints the hints part joins the first line instead.
    val h = parts.indices.drop(1).firstOrNull { parts[it].contains("hint", ignoreCase = true) }
    return when {
        parts.size <= 1 -> parts
        parts.size >= 3 && h != null -> listOf("${parts.first()} · ${parts[h]}", parts.filterIndexed { i, _ -> i != 0 && i != h }.joinToString(" · "))
        else -> listOf(parts.first(), parts.drop(1).joinToString(" · "))
    }
}

/** Places a child with its bottom-center at ([cx], [bottom]) px inside the parent (a stage-sized Box). */
private fun Modifier.anchoredBottomCenter(cx: Float, bottom: Float, maxWidthPx: Int): Modifier = this.layout { measurable, c ->
    val p = measurable.measure(Constraints(maxWidth = maxWidthPx.coerceAtLeast(0)))
    layout(c.maxWidth, c.maxHeight) { p.place((cx - p.width / 2f).roundToInt(), (bottom - p.height).roundToInt()) }
}

/** Places a child with its top-left at ([x], [y]) px, sized exactly [w] x [h] px. */
private fun Modifier.anchoredRect(x: Float, y: Float, w: Float, h: Float): Modifier = this.layout { measurable, c ->
    val p = measurable.measure(Constraints.fixed(w.roundToInt().coerceAtLeast(0), h.roundToInt().coerceAtLeast(0)))
    layout(c.maxWidth, c.maxHeight) { p.place(x.roundToInt(), y.roundToInt()) }
}

/**
 * The stats inside one step's panel, centered: the score (Nunito Black, ~29% of the panel's height) then the guesses / time
 * lines (~19%), dark purple on the light satin. Sizes come from the panel's height in dp (system font scale never resizes
 * them: the panel is fixed art); every line shrinks to fit the panel's width.
 */
@Composable
private fun PanelText(score: String, lines: List<String>, panelW: Dp, panelH: Dp, scoreHeight: Double = PodiumArtGeometry.SCORE_HEIGHT) {
    val scoreSp = with(LocalDensity.current) { (panelH * scoreHeight.toFloat()).toSp() }
    val lineSp = with(LocalDensity.current) { (panelH * PodiumArtGeometry.DETAIL_HEIGHT.toFloat()).toSp() }
    Column(
        Modifier.width(panelW).height(panelH).padding(horizontal = panelW * 0.07f),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
    ) {
        FitText(
            score, fontSize = scoreSp, color = PANEL_INK, fontWeight = FontWeight.Black, fontFamily = Nunito,
            textAlign = TextAlign.Center, minScale = 0.4f, modifier = Modifier.fillMaxWidth(),
        )
        lines.take(2).forEach { line ->
            FitText(
                line.uppercase(), fontSize = lineSp, color = PANEL_INK, fontWeight = FontWeight.ExtraBold, fontFamily = Nunito,
                textAlign = TextAlign.Center, minScale = 0.4f, modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/**
 * BJ4 / 2.8 the board podium on the one stadium image: [spots] stand with their feet on their step's top center, [open]
 * places are open spots (the sleepy R and "Open spot · Claim #N" in the panel). The image spans the content width (capped at
 * [PodiumArt.MAX_WIDTH]; [compact] a smaller copy for Yesterday), height = width / 1.5; the headroom above it holds the
 * champion's name and head. Put it where the old podium went; the page's season wallpaper stays behind (the art fades out).
 */
@Composable
fun BoardPodium(
    spots: List<BoardPodiumSpot>,
    open: List<Int>,
    @Suppress("UNUSED_PARAMETER") accent: Color,
    modifier: Modifier = Modifier,
    /** Kept for call-site parity: the stage image carries its own light, glow and floor everywhere now. */
    @Suppress("UNUSED_PARAMETER") bare: Boolean = false,
    /** Founder 10-09: the smaller copy (Yesterday): the same stage at a narrower width. */
    compact: Boolean = false,
) {
    val byPlace = spots.associateBy { it.place }
    // 2.8 item 13: tapping another player's standing mascot opens their mini Stage card.
    var stageSpot by remember { mutableStateOf<BoardPodiumSpot?>(null) }
    stageSpot?.let { PodiumStageCard(it, it.place) { stageSpot = null } }
    val geo = PodiumArtGeometry
    val taunts = spots.any { it.onTaunt != null }
    // The art is fixed-size, so huge system text is capped here (reflow lives on the rows below).
    CappedFontScale {
        BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            val w = minOf(maxWidth, if (compact) 300.dp else PodiumArt.MAX_WIDTH)
            val imgH = PodiumArt.heightFor(w)
            val density = LocalDensity.current
            // Figure sizes (mascot box, in dp) scale with the stage width: #1 slightly larger.
            val fig = { place: Int -> w * (if (place == 1) 0.36f else 0.30f) }
            val plant = geo.PLANT_PT.dp
            val nameSlot = 24.dp
            // Headroom: the gold figure + its name rise above the image's top edge.
            val goldFeet = imgH * geo.step(1).feetY.toFloat() + plant
            val headroom = (fig(1) + nameSlot + geo.NAME_GAP_PT.dp - goldFeet).coerceAtLeast(0.dp)
            val tauntRow = if (taunts) 30.dp else 0.dp
            Box(Modifier.size(w, headroom + imgH + tauntRow)) {
                Image(
                    artPainter(PodiumArt.STAGE_RES, w), contentDescription = null, contentScale = ContentScale.FillBounds,
                    modifier = Modifier.offset(y = headroom).size(w, imgH).clearAndSetSemantics { },
                )
                with(density) {
                    val wPx = w.toPx(); val imgHPx = imgH.toPx(); val topPx = headroom.toPx()
                    geo.ORDER.forEach { place ->
                        val step = geo.step(place)
                        val s = byPlace[place]
                        val cx = (step.feetX * wPx).toFloat()
                        val feetY = topPx + (step.feetY * imgHPx).toFloat() + plant.toPx()
                        val f = fig(place)
                        val colW = (wPx * 0.30f).roundToInt()
                        // ── the stats panel (or the open spot's copy) ──
                        val pnl = step.panel
                        val px = (pnl.x0 * wPx).toFloat(); val py = topPx + (pnl.y0 * imgHPx).toFloat()
                        val pw = ((pnl.x1 - pnl.x0) * wPx).toFloat(); val ph = ((pnl.y1 - pnl.y0) * imgHPx).toFloat()
                        Box(Modifier.anchoredRect(px, py, pw, ph).clearAndSetSemantics { }) {
                            if (s != null) {
                                PanelText(s.points, s.lines ?: podiumDetailLines(s.detail), pw.toDp(), ph.toDp())
                            } else if (place in open) {
                                val spot = podiumOpenSpot(place)
                                PanelText(spot.title, listOf(spot.line), pw.toDp(), ph.toDp(), scoreHeight = 0.24)
                            }
                        }
                        // ── the standing figure + name ──
                        if (s != null) {
                            val stands = podiumStands(s.username ?: s.name, s.userId, s.avatarUrl, s.config, s.castId, s.frame, s.accentHex)
                            val opensCard = stands && com.wordocious.app.data.FlagsService.isLive("podium_stage_card") &&
                                !com.wordocious.app.data.PlayerAvatars.isOwn(s.userId, s.username ?: s.name)
                            val figure = if (stands) f else f * 0.5f
                            // the contact shadow, under the feet
                            Box(
                                Modifier.anchoredRect(
                                    cx - figure.toPx() * geo.SHADOW_WIDTH.toFloat() / 2f, feetY - figure.toPx() * 0.05f,
                                    figure.toPx() * geo.SHADOW_WIDTH.toFloat(), figure.toPx() * 0.10f,
                                ).clearAndSetSemantics { }.drawBehind {
                                    drawOval(
                                        Brush.radialGradient(
                                            listOf(Color(0xFF14002B).copy(alpha = 0.55f), Color(0xFF14002B).copy(alpha = 0f)),
                                            center = Offset(size.width / 2f, size.height / 2f), radius = size.width / 2f,
                                        ),
                                        topLeft = Offset.Zero, size = Size(size.width, size.height),
                                    )
                                },
                            ) {}
                            Column(
                                Modifier.anchoredBottomCenter(cx, feetY + (if (place == 1 && stands) figure.toPx() * CHEER_FEET_DROP else 0f), colW)
                                    .width(colW.toDp())
                                    .then(
                                        when {
                                            opensCard || s.onClick != null -> Modifier.squishClickable(
                                                label = A11yLabels.podiumPlace(place, s.name, s.points, s.detail) + (if (opensCard) ". Opens their stage" else ""),
                                            ) { if (opensCard) stageSpot = s else s.onClick?.invoke() }
                                            else -> Modifier.semantics(mergeDescendants = true) { contentDescription = A11yLabels.podiumPlace(place, s.name, s.points, s.detail) }
                                        },
                                    ),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                // Founder 10-09: the name rides ABOVE the head in the bubble lettering (their color, one line,
                                // glow in their secondary color); the winner's pull keeps it above the crown.
                                PodiumNameAbove(
                                    s.name, s.userId, s.username ?: s.name,
                                    size = if (compact) 14f else (if (place == 1) 19f else 16f),
                                    pull = if (stands) (if (place == 1) 12.dp else 20.dp) - geo.NAME_GAP_PT.dp + 8.dp else 2.dp,
                                    avatarUrl = s.avatarUrl, config = s.config, castId = s.castId, frame = s.frame, accentHex = s.accentHex,
                                )
                                Box(Modifier.zIndex(1f), contentAlignment = Alignment.TopCenter) {
                                    // the winner's confetti burst opens once on load
                                    if (place == 1 && com.wordocious.app.data.FlagsService.isLive("podium_burst")) {
                                        // overlay only: the burst never sizes the figure's box
                                        Box(Modifier.matchParentSize(), contentAlignment = Alignment.Center) { PodiumBurst() }
                                    }
                                    PlayerAvatar(
                                        s.username ?: s.name, figure, Modifier,
                                        userId = s.userId, avatarUrl = s.avatarUrl, config = s.config, castId = s.castId,
                                        frame = s.frame, accentHex = s.accentHex, podiumPlace = if (stands) place else null,
                                    )
                                    // the crown sits ON the first place's head
                                    if (place == 1) Icon3D(Icon3DName.CROWN, if (compact) 28.dp else 34.dp, Modifier.offset(y = -(figure * if (stands) 0.05f else 0.12f)))
                                }
                            }
                        } else if (place in open) {
                            // the sleepy cast member keeps the open step company
                            val rW = w * 0.20f
                            Image(
                                painterResource(com.wordocious.app.R.drawable.art_scene_r_asleep), contentDescription = null,
                                contentScale = ContentScale.Fit,
                                modifier = Modifier.anchoredBottomCenter(cx, feetY, rW.roundToPx()).width(rW).height(rW / ASLEEP_ASPECT)
                                    .semantics(mergeDescendants = true) { contentDescription = A11yLabels.podiumOpenSpot(place) },
                            )
                        }
                        // Friends board: the taunt bell stays reachable under the stage, centered on the step.
                        s?.onTaunt?.let { taunt ->
                            Box(Modifier.anchoredBottomCenter(cx, topPx + imgHPx + tauntRow.toPx(), colW)) {
                                SoftControl(Icon3DName.BELL, "Taunt ${s.name}", taunt, iconSize = 16.dp)
                            }
                        }
                    }
                }
            }
        }
    }
}


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
            Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(PodiumSheetPalette.bandBottom(dark)),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            DressStage(posed, initial, photoUrl = resolved.photoUrl, height = 250.dp, mascotSize = 160.dp, mascotDescription = A11yLabels.mascot(false, spot.name),
                glow = listOf(Color(0xFFFCD34D), Color(0xFFE2E8F0), Color(0xFFFB923C))[place.coerceIn(1, 3) - 1], finish = true) {
                StageCloseButton(label = "Close", modifier = Modifier.align(Alignment.TopEnd).padding(8.dp), onClick = onDismiss)
            }
            // Founder 10-12: the band continues the stage's gradient (the stage fades into the same top color): no seam, no empty slab.
            Column(
                Modifier.fillMaxWidth().background(PodiumSheetPalette.band(dark)).padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 18.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                // Founder 10-09 ("no more plain text anywhere"): the name and the points in the bubble lettering, the name in the
                // player's own color (their backdrop), and View profile as the family cast button.
                BubbleText(
                    spot.name.uppercase(), ThemeKit.accentPalette(coreHexColor(com.wordocious.core.PlayerTint.nameHex(resolved.config))),
                    maxSize = 30, minSize = 18, animated = false,
                )
                BubbleText(spot.points.uppercase(), ThemeKit.accentPalette(Color(0xFFF5B82E)), maxSize = 22, minSize = 14, animated = false)
                spot.onClick?.let { go ->
                    CastButton("View profile", { onDismiss(); go() }, Modifier.padding(top = 6.dp), color = CastColor.PURPLE, size = CastSize.M)
                }
            }
        }
    }
}
