package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector4D
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.AvatarSaveResult
import com.wordocious.app.data.MascotAvatars
import com.wordocious.app.data.MascotConfigRules
import com.wordocious.app.data.Profile
import com.wordocious.app.data.SoundManager
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.AvatarConfig
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.roundToInt
import kotlin.math.sin

// FINISH_SPEC AO steps 4–5. MAKE YOUR MASCOT hosts the AN builder (ui/MascotBuilder.kt)
// starting from the player's default mascot, with W coaching in a speech-bubble card:
// four tips, tap to advance, a spotlight that dims everything except the control W
// points at (the builder reports its controls through its `anchor` hook). "Do it later"
// keeps the default. ALL SET: the player's mascot hops into the cast row next to W
// (hop + confetti), then "Play today's Classic" or "Explore first".

/** One coach tip: what W says, the builder control it points at, W's pose. */
private data class CoachTip(val text: String, val anchor: String, val pose: String)

private val COACH = listOf(
    CoachTip("This is you! Your initial is on your belly.", "stage", "wave"),
    CoachTip("Change your body, colors, face and hats here.", "tabs", "point"),
    CoachTip("Stuck? Let me pick!", "randomize", "hips"),
    CoachTip("Love it? Save it!", "save", "point"),
)

/** The player's starting mascot: their saved one, else the deterministic default with their initial. */
internal fun startingMascot(profile: Profile?): AvatarConfig {
    val name = profile?.username
    val own = runCatching { MascotAvatars.ownConfig(profile) }.getOrNull()
    return own ?: MascotConfigRules.forDisplay(MascotAvatars.configFor(name), null, null, name ?: "guest", profile?.accentColor)
}

// ── 4 MAKE YOUR MASCOT ───────────────────────────────────────────────────────────

@Composable
internal fun MascotStep(profile: Profile?) {
    val scope = rememberCoroutineScope()
    val initial = MascotConfigRules.initialOf(profile?.username)
    var config by remember(profile?.id) { mutableStateOf(startingMascot(profile)) }
    var saving by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var tip by rememberSaveable { mutableIntStateOf(0) }
    // The builder's controls in root coordinates, and this screen's own origin.
    val anchors = remember { mutableStateMapOf<String, Rect>() }
    var origin by remember { mutableStateOf(Offset.Zero) }

    fun save() {
        if (saving) return
        saving = true; failed = false
        scope.launch {
            val r = MascotAvatars.save(config)
            saving = false
            if (r == AvatarSaveResult.FAILED) failed = true
            else {
                saved = true
                delay(350)
                Onboarding.dispatch(OnboardingEvent.MascotSaved)
            }
        }
    }

    Box(Modifier.fillMaxSize().onGloballyPositioned { origin = it.boundsInRoot().topLeft }) {
        OnboardingFrame(
            onSkip = { Onboarding.dispatch(OnboardingEvent.Skip) },
            dots = stepDots(OnboardingStep.MASCOT),
        ) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                HeadingArt(Heading.MASCOT, height = 44.dp, maxWidth = 340.dp)   // BJ16
                Spacer(Modifier.height(12.dp))
                MascotBuilder(
                    config = config,
                    onChange = { config = it; saved = false },
                    initial = initial,
                    // A brand-new player: level 1 (higher tier frames show their lock).
                    level = 1,
                    isPro = AuthService.isProActive,
                    onSave = { save() },
                    saving = saving,
                    saved = saved,
                    anchor = { key, coords -> anchors[key] = coords.boundsInRoot() },
                )
                if (failed) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Couldn't save just now. Try again, or do it later.",
                        fontFamily = Nunito, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFFDC2626), textAlign = TextAlign.Center,
                    )
                }
                Spacer(Modifier.height(14.dp))
                CandyButton(
                    "Do it later", onClick = { Onboarding.dispatch(OnboardingEvent.MascotLater) },
                    color = CandyColor.PEACH, size = CandySize.SMALL,
                    contentDescription = "Do it later and keep this mascot",
                )
                Spacer(Modifier.height(12.dp))
            }
        }
        if (tip < COACH.size) {
            val target = anchors[COACH[tip].anchor]?.translate(-origin.x, -origin.y)
            CoachOverlay(tip, COACH[tip], target, onNext = { tip++ })
        }
    }
}

/**
 * The spotlight: the screen dims except a rounded window around [target] (animated
 * between tips; calm motion snaps), with W's speech-bubble card below or above it.
 * A tap anywhere moves to the next tip.
 */
@Composable
private fun CoachOverlay(index: Int, tip: CoachTip, target: Rect?, onNext: () -> Unit) {
    val calm = WTheme.calmMotion
    val density = LocalDensity.current
    val hole = remember { mutableStateOf<Animatable<Rect, AnimationVector4D>?>(null) }
    LaunchedEffect(target) {
        val t = target ?: return@LaunchedEffect
        val a = hole.value
        when {
            a == null -> hole.value = Animatable(t, Rect.VectorConverter)
            calm -> a.snapTo(t)
            else -> a.animateTo(t, tween(320))
        }
    }
    val pad = with(density) { 8.dp.toPx() }
    val ring = with(density) { 3.dp.toPx() }
    val radius = with(density) { 20.dp.toPx() }
    val dim = Color(0xFF1A1033).copy(alpha = 0.64f)
    BoxWithConstraints(
        Modifier.fillMaxSize()
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onNext)
            .semantics(mergeDescendants = true) {
                role = Role.Button
                contentDescription = "W says: ${tip.text} Tip ${index + 1} of ${COACH.size}. Tap to continue."
            },
    ) {
        val r = hole.value?.value
        Canvas(Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }) {
            drawRect(dim)
            if (r != null) {
                val tl = Offset(r.left - pad, r.top - pad)
                val sz = Size(r.width + pad * 2, r.height + pad * 2)
                drawRoundRect(Color.Black, tl, sz, CornerRadius(radius), blendMode = BlendMode.Clear)
                drawRoundRect(Color.White.copy(alpha = 0.92f), tl, sz, CornerRadius(radius), style = Stroke(ring))
            }
        }
        val hPx = constraints.maxHeight
        var bubbleH by remember { mutableIntStateOf(0) }
        val gap = with(density) { 14.dp.toPx() }
        val below = r == null || r.center.y < hPx * 0.5f
        val y = when {
            r == null -> (hPx - bubbleH) / 2f
            below -> r.bottom + pad + gap
            else -> r.top - pad - gap - bubbleH
        }
        CoachBubble(
            tip, index, tailUp = below && r != null, tailDown = !below && r != null,
            modifier = Modifier.align(Alignment.TopCenter)
                .offset { IntOffset(0, y.roundToInt().coerceIn(0, (hPx - bubbleH).coerceAtLeast(0))) }
                .onSizeChanged { bubbleH = it.height }
                .padding(horizontal = 16.dp),
        )
    }
}

/** W (a small pose) beside a speech-bubble tinted card; the tail points at the spotlight. */
@Composable
private fun CoachBubble(tip: CoachTip, index: Int, tailUp: Boolean, tailDown: Boolean, modifier: Modifier = Modifier) {
    val fill = accentWash(ONBOARD_ACCENT, 0.16f)
    val line = accentLine(ONBOARD_ACCENT, 0.5f)
    Row(
        modifier.widthIn(max = 420.dp).fillMaxWidth().clearAndSetSemantics { },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        CastPose(MascotId.W, tip.pose, 76.dp)
        Column(Modifier.weight(1f)) {
            if (tailUp) BubbleTail(fill, line, up = true)
            Column(
                Modifier.fillMaxWidth()
                    .background(fill, RoundedCornerShape(18.dp))
                    .border(1.5.dp, line, RoundedCornerShape(18.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    tip.text, fontFamily = Nunito, fontSize = 16.sp, fontWeight = FontWeight.Black, lineHeight = 1.3.em,
                    color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                )
                Text(
                    "Tap to continue  ·  ${index + 1} of ${COACH.size}",
                    fontFamily = Nunito, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = onboardMuted(),
                )
            }
            if (tailDown) BubbleTail(fill, line, up = false)
        }
    }
}

/** The speech bubble's little tail (a triangle in the card's wash and line). */
@Composable
private fun BubbleTail(fill: Color, line: Color, up: Boolean) {
    Canvas(Modifier.padding(start = 28.dp).size(18.dp, 10.dp).offset(y = if (up) 1.dp else (-1).dp)) {
        val w = size.width; val h = size.height
        val p = Path().apply {
            if (up) { moveTo(0f, h); lineTo(w / 2f, 0f); lineTo(w, h) } else { moveTo(0f, 0f); lineTo(w / 2f, h); lineTo(w, 0f) }
        }
        drawPath(p, fill)
        drawPath(p, line, style = Stroke(1.5.dp.toPx()))
    }
}

// ── 5 ALL SET ────────────────────────────────────────────────────────────────────

@Composable
internal fun AllSetStep(profile: Profile?, guest: Boolean) {
    val calm = WTheme.calmMotion
    val allSetArt = optionalArt("art_scene_all_set")
    val mine = remember(profile?.id, guest) { if (guest || profile == null) startingMascot(null) else startingMascot(profile) }
    val initial = if (guest || profile == null) "G" else MascotConfigRules.initialOf(profile.username)
    val arrive = remember { Animatable(if (calm) 1f else 0f) }
    var landed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(380)
        if (!calm) arrive.animateTo(1f, tween(640, easing = LinearOutSlowInEasing))
        // U: the hop sounds under Reduce Motion too (motion only is off).
        runCatching { SoundManager.playHop() }
        landed = true
    }
    val density = LocalDensity.current
    val hopIn = Modifier.graphicsLayer {
        val p = arrive.value
        translationX = -(1f - p) * with(density) { 120.dp.toPx() }
        translationY = -sin(PI * p).toFloat() * with(density) { 44.dp.toPx() }
        alpha = (p * 3f).coerceAtMost(1f)
    }

    Box(Modifier.fillMaxSize()) {
        OnboardingFrame(onSkip = null, dots = stepDots(OnboardingStep.ALL_SET)) {
            OnboardBody { h ->
                if (allSetArt != null) {
                    SceneArtPop(allSetArt, (h * 0.36f).coerceAtMost(280.dp), delayMs = 60L)
                    Spacer(Modifier.height(4.dp))
                    MascotAvatar(mine, initial, 84.dp, modifier = hopIn)
                } else {
                    // The cast row with the player's mascot hopping in next to W.
                    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        val tile = ((maxWidth - 26.dp) / 11.4f).coerceAtMost(36.dp)
                        Row(verticalAlignment = Alignment.Bottom) {
                            MascotAvatar(mine, initial, tile * 1.4f, modifier = hopIn)
                            Spacer(Modifier.width(4.dp))
                            CastRow(tile, motion = if (landed) MascotMotion.WAVE else MascotMotion.NONE, hop = 8.dp, repeats = 1)
                        }
                    }
                }
                Spacer(Modifier.height(22.dp))
                HeadingArt(Heading.YOUREIN, height = 56.dp)   // BJ16
                Spacer(Modifier.height(10.dp))
                OnboardLine("Meet the gang. Your first puzzle is ready.")
                Spacer(Modifier.height(28.dp))
                CastButton(
                    "Play today's Classic", onClick = { Onboarding.dispatch(OnboardingEvent.Play) }, size = CastSize.L, fill = true,
                    modifier = ONBOARD_CTA,
                )
                Spacer(Modifier.height(12.dp))
                CandyButton(
                    "Explore first", onClick = { Onboarding.dispatch(OnboardingEvent.Explore) },
                    color = CandyColor.PEACH, size = CandySize.MEDIUM,
                    contentDescription = "Explore first, go to Home",
                )
            }
        }
        if (landed) {
            PopupConfetti(
                listOf(Color(0xFF7C3AED), Color(0xFFEC4899), Color(0xFFF5C542), Color(0xFF0D9488), Color(0xFF2563EB)),
                Modifier.fillMaxSize(),
            )
        }
    }
}
