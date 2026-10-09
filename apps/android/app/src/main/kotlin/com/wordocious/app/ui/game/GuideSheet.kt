package com.wordocious.app.ui.game

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Label
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import com.wordocious.app.data.GuideService
import com.wordocious.app.ui.CandyButton
import com.wordocious.app.ui.CandySize
import com.wordocious.app.ui.CastPose
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.Mascots
import com.wordocious.app.ui.PopupScrim
import com.wordocious.app.ui.SoftNumber
import com.wordocious.app.ui.WideLayout
import com.wordocious.app.ui.darkenInk
import com.wordocious.app.ui.miniGameCard
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.tintedPill
import com.wordocious.core.GameMode
import kotlinx.coroutines.delay

/**
 * FINISH_SPEC AF the in-game "?" help popup, in the R1 card language (WinPopup): the
 * game's host in a helpful pose springing in on top of a soft game-accent card over the
 * warm cream with the rainbow bar, the game's title art, 3–4 short steps (GuideSteps,
 * shortened from the how-to-play copy) each with a tiny animated row of real glossy
 * tiles, a candy "Got it" and the "Full guide" chip. The
 * whole guide (facts, How it works, The buttons, scoring, strategy — GuideService, the
 * web's lib/guide-content.ts) stays one tap away under "Full guide". Opening it plays the
 * popup whoosh (PopupScrim). The callers keep pausing the game clock on open and resuming
 * it in [onDismiss]. Reduce Motion: no spring, no tile motion (rows show their result).
 */
@Composable
fun GuideSheet(mode: GameMode, onDismiss: () -> Unit) {
    var guide by remember(mode) { mutableStateOf<GuideService.ModeGuide?>(null) }
    LaunchedEffect(mode) { guide = GuideService.guide(mode) }
    val g = guide
    val accent = g?.accent?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() }
        ?: com.wordocious.app.ui.modeAccent(mode)
    val slug = remember(mode) { GuideService.slugFor(mode) }
    val steps = remember(slug, g) { GuideSteps.stepsFor(slug, g?.rules ?: emptyList()) }
    val title = g?.title ?: com.wordocious.app.ui.gameTitleLabelForKey(mode.name)
    // First-play (item 12): any close marks this game's card seen (synced); the button reads "Let's play!" the first time.
    val close = { com.wordocious.app.data.TutorialsSeen.mark(slug); onDismiss() }

    Dialog(
        onDismissRequest = close,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        // The popup paints its own scrim (PopupScrim): no second window dim behind it.
        com.wordocious.app.ui.EdgeToEdgeDialogWindow(dimAmount = 0f)
        PopupScrim(onTap = close) {
            BoxWithConstraints(Modifier.fillMaxSize().systemBarsPadding()) {
                val viewport = maxHeight
                Column(
                    Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = viewport)
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    GuideCard(mode, title, accent, steps, g, close)
                }
            }
        }
    }
}

/** How far the host's pose overlaps down into the card, and its size. */
private val POSE_SIZE = 104.dp
private val POSE_INTO_CARD = 34.dp
private val GUIDE_BAR = Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))

@Composable
private fun GuideCard(
    mode: GameMode,
    title: String,
    accent: Color,
    steps: List<GuideStep>,
    guide: GuideService.ModeGuide?,
    onDismiss: () -> Unit,
) {
    val still = WTheme.reducedMotion
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val dur = if (still) 0 else 260
    // AZ: the help popup springs in with the shared family.
    // BJ10: the soft pop — 0.94 → 1 from the bottom center on the soft spring.
    val scale by animateFloatAsState(if (shown) 1f else com.wordocious.core.MotionSpec.POP_SCALE, if (dur == 0) tween(0) else com.wordocious.app.ui.softPopSpring(), label = "guideScale")
    val alpha by animateFloatAsState(if (shown) 1f else 0f, tween(dur, easing = EaseOut), label = "guideAlpha")
    var full by remember(mode) { mutableStateOf(false) }
    val host = remember(mode) { Mascots.hostFor(mode.name) }

    Box(
        Modifier.widthIn(max = WideLayout.POPUP_CARD_DP.dp).fillMaxWidth()
            .graphicsLayer { scaleX = scale; scaleY = scale; this.alpha = alpha; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 1f) }
            .semantics { paneTitle = "How to play $title" },
        contentAlignment = Alignment.TopCenter,
    ) {
        GuideCardBody(
            accent,
            Modifier.padding(top = if (host != null) POSE_SIZE - POSE_INTO_CARD else 0.dp)
                // Taps on the card never fall through to the scrim (which closes the popup).
                .pointerInput(Unit) { detectTapGestures { } },
            topRoom = if (host != null) POSE_INTO_CARD + 6.dp else 18.dp,
        ) {
            // The game's title art (its own heading label), else the title in Nunito Black.
            val titleArt = com.wordocious.app.ui.gameTitleArtResForKey(mode.name)
            if (titleArt != null) {
                com.wordocious.app.ui.FittedGameTitleArt(
                    titleArt, title,
                    maxHeight = GUIDE_TITLE_ART_MAX,
                    alignment = Alignment.Center,
                )
            } else {
                Text(
                    title.uppercase(), fontSize = 26.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.semantics { heading() },
                    style = androidx.compose.ui.text.TextStyle(
                        fontFamily = Nunito,
                        brush = Brush.horizontalGradient(com.wordocious.app.ui.modeTitleGradient(mode)),
                    ),
                )
            }
            Text(
                "HOW TO PLAY", fontFamily = Nunito, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.12.em,
                color = if (WTheme.isDark) WTheme.textMuted else darkenInk(accent),
            )
            if (steps.isEmpty()) {
                // A game with no quick steps yet, its guide still loading.
                com.wordocious.app.ui.CastLoader(null, Modifier.padding(vertical = 12.dp))
            } else {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    steps.forEachIndexed { i, s -> GuideStepRow(i, s, accent) }
                }
            }
            CandyButton(
                firstPlayButtonLabel(GuideService.slugFor(mode)), onClick = onDismiss,
                color = WinPopupMath.candyFor(accent.copy(alpha = 1f).toArgb()),
                size = CandySize.LARGE, fill = true,
                modifier = Modifier.padding(top = 4.dp),
            )
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // The app tour lives only in Settings -> Help (founder 10-07), not in per-game help.
                if (guide != null) {
                    GuideLinkChip(
                        if (full) "Hide full guide" else "Full guide", accent,
                        expanded = full,
                    ) { full = !full }
                }
            }
            if (full && guide != null) FullGuide(guide, accent)
        }
        if (host != null) GuideHostPose(host, accent)
    }
}

/** The title art's height cap inside the popup card. */
private val GUIDE_TITLE_ART_MAX = 60.dp

/** R1 card: accent ~10% → ~4% over the warm cream (dark: a deep accent tint), the rainbow bar, 28 dp, an accent glow. */
@Composable
private fun GuideCardBody(
    accent: Color,
    modifier: Modifier,
    topRoom: Dp,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(28.dp)
    val dark = WTheme.isDark
    val a = accent.copy(alpha = 1f).toArgb()
    val base = if (dark) WTheme.surface.toArgb() else WinPopupMath.CREAM
    val top = Color(WinPopupMath.cardWash(a, if (dark) 0.24f else 0.10f, base))
    val bottom = Color(WinPopupMath.cardWash(a, if (dark) 0.12f else 0.04f, base))
    Column(
        modifier.fillMaxWidth()
            .shadow(22.dp, shape, clip = false, ambientColor = accent.copy(alpha = 0.45f), spotColor = accent.copy(alpha = 0.6f))
            .clip(shape)
            .background(Brush.verticalGradient(listOf(top, bottom)))
            .border(1.5.dp, accent.copy(alpha = if (dark) 0.35f else 0.22f), shape),
    ) {
        Box(Modifier.fillMaxWidth().height(10.dp).background(GUIDE_BAR))
        Column(
            Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = topRoom, bottom = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

/** The host in its helpful pose over the card: a soft accent glow, a spring-in (1.06 overshoot). Decorative. */
@Composable
private fun GuideHostPose(host: com.wordocious.app.ui.MascotId, accent: Color) {
    val still = WTheme.reducedMotion
    val pop = remember { Animatable(if (still) 1f else 0.5f) }
    LaunchedEffect(still) {
        if (still) { pop.snapTo(1f); return@LaunchedEffect }
        delay(100)
        pop.animateTo(1f, keyframes {
            durationMillis = 520
            0.5f at 0 using FastOutSlowInEasing
            1.06f at 340 using FastOutSlowInEasing
            1f at 520
        })
    }
    Box(Modifier.size(POSE_SIZE + 40.dp, POSE_SIZE).clearAndSetSemantics { }, contentAlignment = Alignment.BottomCenter) {
        Canvas(Modifier.matchParentSize()) {
            val c = Offset(size.width / 2f, size.height * 0.55f)
            val r = size.minDimension * 0.62f
            drawCircle(Brush.radialGradient(0f to accent.copy(alpha = 0.28f), 0.7f to accent.copy(alpha = 0f), center = c, radius = r), radius = r, center = c)
        }
        Box(
            Modifier.graphicsLayer {
                scaleX = pop.value; scaleY = pop.value
                alpha = ((pop.value - 0.5f) / 0.3f).coerceIn(0f, 1f)
                transformOrigin = TransformOrigin(0.5f, 1f)
            },
        ) { CastPose(host, GuideSteps.hostPose(host), POSE_SIZE) }
    }
}

/** One quick step: its number in soft digits on a tinted disc, the line, and the example row. */
@Composable
private fun GuideStepRow(index: Int, step: GuideStep, accent: Color) {
    val dark = WTheme.isDark
    Row(
        Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "Step ${index + 1}: ${step.text}" },
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(28.dp).clip(CircleShape)
                .background(accent.copy(alpha = if (dark) 0.28f else 0.14f))
                .border(1.5.dp, accent.copy(alpha = if (dark) 0.5f else 0.32f), CircleShape)
                .clearAndSetSemantics { },
            contentAlignment = Alignment.Center,
        ) { SoftNumber("${index + 1}", 15.sp, color = if (dark) WTheme.text else null) }
        Column(Modifier.weight(1f).clearAndSetSemantics { }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(step.text, fontFamily = Nunito, fontSize = 13.5.sp, fontWeight = FontWeight.ExtraBold, color = guideInk(), lineHeight = 18.sp)
            if (step.tiles.isNotEmpty()) GuideDemoRow(step, index)
        }
    }
}

/** A step's tiny example row of glossy tiles, looping (type in / flip / pop). Reduce Motion: the result, still. */
@Composable
private fun GuideDemoRow(step: GuideStep, stepIndex: Int) {
    val n = step.tiles.size
    val still = WTheme.reducedMotion
    val cycle = GuideSteps.cycleMs(n).toFloat()
    val clock = if (still) null else rememberInfiniteTransition(label = "guideDemo$stepIndex").animateFloat(
        initialValue = 0f, targetValue = cycle,
        animationSpec = infiniteRepeatable(
            tween(cycle.toInt(), easing = LinearEasing), RepeatMode.Restart,
            initialStartOffset = StartOffset(stepIndex * GuideSteps.STEP_OFFSET_MS),
        ),
        label = "clock",
    )
    val wordRow = step.tiles.any { it.glyph.length > 2 }
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        step.tiles.forEachIndexed { i, t ->
            val f = clock?.let { GuideSteps.tileProgress(it.value, i, n) } ?: 1f
            val size = if (wordRow) Modifier.width((16 + 8 * t.glyph.length).dp).height(24.dp) else Modifier.size(24.dp)
            DemoTileView(t, step.motion, f, size, wordRow)
        }
    }
}

@Composable
private fun DemoTileView(t: DemoTile, motion: DemoMotion, f: Float, sizeMod: Modifier, wide: Boolean) {
    val glyphSize = if (wide) 11f else null
    when (motion) {
        DemoMotion.FLIP -> {
            val front = f < 0.5f
            val glyph = if (front) (t.before ?: t.glyph) else t.glyph
            val face = if (front) TileFace.TYPED else t.face
            Box(sizeMod.graphicsLayer {
                rotationX = if (front) f * 180f else (f - 1f) * 180f
                cameraDistance = 12f * density
            }) { DemoFace(glyph, face, Modifier.fillMaxSize(), glyphSize) }
        }
        DemoMotion.TYPE -> Box(sizeMod) {
            if (f <= 0f) GameTileFace("", TileFace.EMPTY, Modifier.fillMaxSize(), square = false)
            else DemoFace(
                t.glyph, t.face,
                Modifier.fillMaxSize().graphicsLayer { val s = 0.82f + 0.18f * f; scaleX = s; scaleY = s },
                glyphSize,
            )
        }
        DemoMotion.POP -> Box(sizeMod.graphicsLayer {
            val s = 0.6f + 0.4f * f
            scaleX = s; scaleY = s
            alpha = (f * 3f).coerceIn(0f, 1f)
        }) { DemoFace(t.glyph, t.face, Modifier.fillMaxSize(), glyphSize) }
    }
}

/**
 * A demo tile face. AL addendum 2: the Starsweep tokens (the star and the cross) draw the
 * board's own art on the tile instead of a text glyph; everything else is the letter.
 */
@Composable
private fun DemoFace(glyph: String, face: TileFace, modifier: Modifier, glyphSize: Float?) {
    val art = when (glyph) {
        GuideSteps.STAR_TOKEN -> when (face) {
            TileFace.CORRECT -> com.wordocious.app.R.drawable.art_starsweep_star_correct
            TileFace.CONFLICT, TileFace.BAD -> com.wordocious.app.R.drawable.art_starsweep_star_wrong
            else -> com.wordocious.app.R.drawable.art_starsweep_star_placed
        }
        GuideSteps.CROSS_TOKEN -> com.wordocious.app.R.drawable.art_starsweep_cross
        else -> null
    }
    if (art == null) {
        GameTileFace(glyph, face, modifier, square = false, glyphSize = glyphSize)
        return
    }
    Box(modifier, contentAlignment = Alignment.Center) {
        GameTileFace("", face, Modifier.fillMaxSize(), square = false)
        androidx.compose.foundation.Image(
            androidx.compose.ui.res.painterResource(art), null,
            Modifier.fillMaxSize(0.62f).padding(bottom = 2.dp),
        )
    }
}

/** A small tinted link chip (squish; a button for TalkBack). */
@Composable
private fun GuideLinkChip(label: String, accent: Color, expanded: Boolean? = null, onClick: () -> Unit) {
    val ink = if (WTheme.isDark) WTheme.text else darkenInk(accent)
    Row(
        Modifier.tintedPill(accent, 14.dp)
            .squishClickable(label, Role.Button, onClick = onClick)
            .then(if (expanded != null) Modifier.semantics { stateDescription = if (expanded) "Expanded" else "Collapsed" } else Modifier)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, fontFamily = Nunito, fontSize = 12.5.sp, fontWeight = FontWeight.Black, color = ink)
        if (expanded != null) {
            Icon(if (expanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown, null, tint = ink, modifier = Modifier.size(16.dp))
        }
    }
}

/** The whole guide (the old sheet's content): quick facts, How it works, The buttons, scoring, strategy. */
@Composable
private fun FullGuide(g: GuideService.ModeGuide, accent: Color) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (g.tagline.isNotBlank()) {
            Text(
                g.tagline, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
                color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted,
            )
        }
        // Quick facts — 2-col tinted pills in the game's color.
        g.facts.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { f ->
                    Column(
                        Modifier.weight(1f).tintedPill(accent)
                            .padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 10.dp)
                            .semantics(mergeDescendants = true) { },
                    ) {
                        Text(f.label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
                            color = if (WTheme.isDark) WTheme.textMuted else darkenInk(accent))
                        Text(f.value, fontSize = 13.sp, fontWeight = FontWeight.Black, color = guideInk())
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        guideCard("How it works", accent) { paragraphs(g.rules) }
        // "The buttons" (founder round 13): every on-screen control, with the SAME icon
        // the button carries, its label, and what it costs.
        if (g.controls.isNotEmpty()) {
            guideCard("The buttons", accent) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    g.controls.forEach { c ->
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(Modifier.size(28.dp).miniGameCard(accent, 8.dp), contentAlignment = Alignment.Center) {
                                Icon(controlIcon(c.icon), null, tint = accent, modifier = Modifier.size(14.dp))
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(c.label, fontSize = 12.5.sp, fontWeight = FontWeight.Black, color = guideInk())
                                Text(c.body, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = guideBody(), lineHeight = 18.sp)
                            }
                        }
                    }
                }
            }
        }
        guideCard("How scoring works", accent) { paragraphs(g.scoring) }
        if (g.tips.isNotEmpty()) {
            guideCard("Strategy", accent) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    g.tips.forEach { t ->
                        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(t.heading, fontSize = 12.5.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) accent else darkenInk(accent))
                            Text(t.body, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = guideBody(), lineHeight = 18.sp)
                        }
                    }
                }
            }
        }
    }
}

/** lucide icon name (as written in guide-content.ts) → the Material icon the
 *  game's button actually carries, so the guide shows the SAME icon. */
private fun controlIcon(lucide: String): androidx.compose.ui.graphics.vector.ImageVector = when (lucide) {
    "undo-2" -> Icons.AutoMirrored.Filled.Undo
    "eraser" -> Icons.AutoMirrored.Filled.Backspace
    "pencil" -> Icons.Filled.Edit
    "lightbulb" -> Icons.Filled.Lightbulb
    "shuffle" -> Icons.Filled.Shuffle
    "check" -> Icons.Filled.Check
    "delete" -> Icons.AutoMirrored.Filled.Backspace
    "eye" -> Icons.Filled.Visibility
    "list" -> Icons.AutoMirrored.Filled.List
    "check-check" -> Icons.Filled.DoneAll
    "flag" -> Icons.Filled.Flag
    "corner-down-left" -> Icons.AutoMirrored.Filled.KeyboardReturn
    "x-circle" -> Icons.Filled.Cancel
    "check-circle-2" -> Icons.Filled.CheckCircle
    "tag" -> Icons.Filled.Label
    "link-2" -> Icons.Filled.Link
    "arrow-left-right" -> Icons.Filled.SwapHoriz
    else -> Icons.Filled.Circle
}

/** FINISH_SPEC A1 / C6: a guide section as a tinted card in the game's color with its top bar. */
@Composable
private fun guideCard(title: String, accent: Color, content: @Composable () -> Unit) {
    com.wordocious.app.ui.InfoSectionCard(accent, title = title) { content() }
}

@Composable
private fun paragraphs(ps: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ps.forEach { Text(it, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = guideBody(), lineHeight = 18.sp) }
    }
}

@Composable
private fun guideInk(): Color = if (WTheme.isDark) WTheme.text else FinishInk.heading

@Composable
private fun guideBody(): Color = if (WTheme.isDark) WTheme.textSecondary else Color(0xFF4B3D66)
