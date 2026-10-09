package com.wordocious.app.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.toSize
import com.wordocious.app.data.FeedbackRules
import com.wordocious.app.data.Haptic
import com.wordocious.app.data.Haptics
import com.wordocious.app.data.MascotMoments
import com.wordocious.app.data.SoundManager
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarFit
import com.wordocious.core.AvatarFitManifest
import com.wordocious.core.AvatarLayout
import com.wordocious.core.AvatarLayoutPose
import com.wordocious.core.AvatarLiveConfig
import com.wordocious.core.AvatarLiveFrame
import com.wordocious.core.AvatarLiveInput
import com.wordocious.core.AvatarPoseSpec
import com.wordocious.core.AvatarPoses
import com.wordocious.core.AvatarPosesData
import com.wordocious.core.AvatarReaction
import com.wordocious.core.AvatarReactionPlay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

// The living mascot (docs/cloud-prompts/06; core AvatarPose.kt) — web components/avatar/use-living-mascot.ts parity.
// The player's own mascot breathes, blinks, holds its saved pose, hops + laughs on a tap, squishes while pressed and
// reacts to moments (MascotMoments: win = cheer, loss = shrug, streak +1 = hop, level up = cheer).
// Everything here stands down while AvatarLiveConfig.LIVING_MASCOT is off (the default): callers draw exactly the
// current composables then.
//
// Performance rules (founder: smooth over pretty): laid out ONCE (the live layout: the saved pose + room for every
// reaction, so it never rescales), its layers pre-drawn once off main (MascotComposer.livePieces); a frame only
// blits them under core matrices. Frames run only while on screen (the window's frame clock also pauses when the
// app is stopped), and Android holds still between moves (AvatarLiveConfig.ANDROID_IDLE_STILL): no breathing between
// a tap / reaction, just a wake-up for each blink. Reduce Motion (the app toggle or the system animator scale 0)
// holds the saved pose; a tap then only shows the laugh. At most AvatarLiveConfig.MAX_ANIMATED run at once.

/** The pure rules (JVM-testable). */
object LivingMascotRules {
    /** Which cast giggle a body laughs with (web BODY_LAUGH), pitched per body by AvatarPoses.LAUGH_RATE. */
    val BODY_LAUGH: Map<String, String> = mapOf(
        "classic" to "w", "tall" to "i", "wide" to "u", "blob" to "o1", "bean" to "s", "star" to "o2",
        "drop" to "d", "pear" to "r", "cloud" to "u", "chunky" to "c", "mini" to "o3", "hex" to "d",
    )

    fun laughRate(body: String): Double = AvatarPoses.LAUGH_RATE[body] ?: 1.0

    /** A per-mascot blink seed (web: (body.length·977 + color.length·131) mod 233280). */
    fun blinkSeed(c: AvatarConfig): Double = ((c.body.length * 977 + c.color.length * 131) % 233280).toDouble()

    /**
     * The living mascot's layout (web avatarLiveLayout): rigged (feet / base / arms as their own layers, even in the
     * "none" pose), in its saved pose, with room in the fit for its reactions + hop. Null when the body has no rig.
     */
    fun liveLayout(c: AvatarConfig, fm: AvatarFitManifest, data: AvatarPosesData): AvatarLayout? {
        val id = c.pose
        val pose = AvatarLayoutPose.Live(id, AvatarPoses.poseDef(id, data)?.spec ?: AvatarPoseSpec())
        return AvatarFit.layout(c, false, fm, pose, AvatarPoses.liveRoom(data), data).takeIf { it.pose != null }
    }

    /** The eyes' look toward a finger at [x], [y] (window px) for a mascot in [r] (web: clamp to −1…1). */
    fun look(x: Float, y: Float, r: Rect): Offset {
        if (r.width <= 0f || r.height <= 0f) return Offset.Zero
        val cx = r.left + r.width / 2f
        val cy = r.top + r.height * 0.4f
        return Offset(((x - cx) / (r.width * 1.5f)).coerceIn(-1f, 1f), ((y - cy) / (r.height * 1.5f)).coerceIn(-1f, 1f))
    }
}

/** The animation budget: at most AvatarLiveConfig.MAX_ANIMATED living mascots run at once; the player's own always do. */
object LivingSlots {
    private var running = 0

    @Synchronized fun claim(own: Boolean): Boolean {
        if (!own && running >= AvatarLiveConfig.MAX_ANIMATED) return false
        running++
        return true
    }

    @Synchronized fun release() { running = (running - 1).coerceAtLeast(0) }

    @Synchronized fun inUse(): Int = running
}

/** The finger on the Edit Profile Stage (window px; null = none yet): the living mascot's eyes follow it. */
val LocalMascotFinger = staticCompositionLocalOf<MutableState<Offset?>?> { null }

/** Track the finger over this node (window px) into [finger] without consuming anything (the Stage). */
fun Modifier.trackMascotFinger(finger: MutableState<Offset?>): Modifier {
    val origin = floatArrayOf(0f, 0f)
    return this.onGloballyPositioned { val p = it.positionInWindow(); origin[0] = p.x; origin[1] = p.y }
        .pointerInput(finger) {
            awaitPointerEventScope {
                while (true) {
                    val e = awaitPointerEvent(PointerEventPass.Initial)
                    val ch = e.changes.firstOrNull() ?: continue
                    if (ch.pressed) finger.value = Offset(origin[0] + ch.position.x, origin[1] + ch.position.y)
                }
            }
        }
}

/** One living mascot's mutable state (plain fields: only [frame] / [look] are read while drawing). */
private class LiveState {
    private val t0 = System.nanoTime()
    var tapAt: Double? = null
    var reaction: Pair<AvatarReaction, Double>? = null
    var pressing = false
    var press = 0.0
    var visible = true
    var box: Rect = Rect.Zero
    var frame by mutableStateOf<AvatarLiveFrame?>(null)
    var look by mutableStateOf(Offset.Zero)
    val kick = Channel<Unit>(Channel.CONFLATED)

    fun clock(): Double = (System.nanoTime() - t0) / 1e9
    fun busy(): Boolean = tapAt != null || reaction != null || pressing || press > 0.01
    fun wake() { kick.trySend(Unit) }
}

/**
 * The player's own mascot, alive (only while AvatarLiveConfig.LIVING_MASCOT is on — callers check). Falls back to
 * the static [MascotAvatar] while its layers are being drawn, at small sizes, and on a body without a rig.
 * [own] = the player's own mascot (reacts to MascotMoments, always gets an animation slot); [follow] = the eyes
 * follow the finger (LocalMascotFinger, the Edit Profile Stage); [hopToken] changes = a hop + laugh (no sound:
 * the Dressing Room's change hop); [label] = the tap's spoken action (null: the caller's row speaks for it).
 */
@Composable
fun LivingMascot(
    config: AvatarConfig,
    initial: String,
    size: Dp,
    modifier: Modifier = Modifier,
    cutout: Boolean = false,
    pro: Boolean = false,
    own: Boolean = true,
    follow: Boolean = false,
    hopToken: Int = 0,
    tappable: Boolean = true,
    label: String? = "Your mascot, tap to laugh",
    /** 2.8 item 40: what TalkBack calls the picture ("Your mascot", "doug's mascot"); null = the caller's row speaks for it. */
    description: String? = null,
) {
    @Suppress("NAME_SHADOWING")
    val modifier = if (description != null) modifier.semantics { contentDescription = description } else modifier
    val context = LocalContext.current
    val fm = remember { MascotComposer.fitManifest(context) }
    val data = remember { MascotComposer.posesData(context) }
    val drawn = if (pro && config.frame == "none" && !cutout) config.copy(frame = "pro") else config
    val small = MascotLayers.isSmall(size.value)
    val layout = remember(drawn, fm, data, small) { if (fm == null || data == null || small) null else LivingMascotRules.liveLayout(drawn, fm, data) }
    if (layout == null || data == null) {
        MascotAvatar(config, initial, size, modifier, pro = pro, cutout = cutout)
        return
    }
    val density = LocalDensity.current
    val view = LocalView.current
    val px = with(density) { size.roundToPx() }.coerceAtLeast(1)
    val dark = WTheme.isDark
    val still = WTheme.reducedMotion
    val letter = initial.take(2).ifEmpty { "?" }
    var pieces by remember(layout, px, cutout) { mutableStateOf<List<Bitmap?>?>(null) }
    LaunchedEffect(layout, px, cutout) {
        pieces = withContext(Dispatchers.Default) { MascotComposer.livePieces(context, drawn, layout, px, cutout) }
    }
    val state = remember(layout) { LiveState() }
    val seed = remember(drawn.body, drawn.color) { LivingMascotRules.blinkSeed(drawn) }
    val slot = remember(own) { LivingSlots.claim(own) }
    DisposableEffect(slot) { onDispose { if (slot) LivingSlots.release() } }

    fun tap(sound: Boolean) {
        state.tapAt = state.clock()
        if (sound) {
            // the cast giggle for this body, pitched by AvatarPoses.LAUGH_RATE (SoundPool rate)
            FeedbackRules.laughSfx(LivingMascotRules.BODY_LAUGH[drawn.body] ?: "w")
                ?.let { SoundManager.play(it, rate = LivingMascotRules.laughRate(drawn.body).toFloat()) }
            Haptics.perform(Haptic.LIGHT, view)
        }
        state.wake()
    }

    // the frame loop: every frame while a move plays; between moves the held pose (+ a wake-up per blink)
    LaunchedEffect(layout, still, slot) {
        val blinks = AvatarPoses.blinkTimes(seed)
        fun step() {
            val t = state.clock()
            state.press += ((if (state.pressing) 1.0 else 0.0) - state.press) * 0.25
            if (!state.pressing && state.press < 0.001) state.press = 0.0
            val busy = state.busy()
            state.frame = AvatarPoses.liveFrame(
                AvatarLiveInput(
                    pose = drawn.pose, t = t, tap = state.tapAt?.let { t - it },
                    reaction = state.reaction?.let { (k, at) -> AvatarReactionPlay(k, t - at) },
                    press = state.press, still = still,
                    // Android holds still between moves: breathing only while a tap / reaction plays
                    ambient = !AvatarLiveConfig.ANDROID_IDLE_STILL || busy,
                    blinkSeed = seed,
                ),
                data,
            )
            state.tapAt?.let { if (t - it > 1.2) state.tapAt = null }
            state.reaction?.let { if (t - it.second > 3) state.reaction = null }
        }
        suspend fun play(seconds: Double) {
            val until = state.clock() + seconds
            while (state.clock() < until && !state.busy()) withFrameNanos { step() }
        }
        while (true) {
            val animating = state.visible && (state.busy() || (!still && slot && !AvatarLiveConfig.ANDROID_IDLE_STILL))
            if (animating) { withFrameNanos { step() }; continue }
            step()   // the held frame
            if (!still && state.visible && slot && (state.frame?.eyes ?: 1.0) != 1.0) { play(0.2); continue }   // finish a blink
            if (still || !state.visible || !slot) { state.kick.receive(); continue }
            // between moves: sleep until the next blink (or a tap / reaction / press wakes it)
            val tt = ((state.clock() % 600) + 600) % 600
            val next = blinks.firstOrNull { it > tt } ?: (600.0 + (blinks.firstOrNull() ?: 1.3))
            val woke = withTimeoutOrNull(((next - tt) * 1000).toLong().coerceAtLeast(1L)) { state.kick.receive() }
            if (woke == null) play(0.2)
        }
    }
    // moments (the player's own mascot only; Reduce Motion holds still)
    LaunchedEffect(own, still) {
        if (!own || still) return@LaunchedEffect
        MascotMoments.flow.collect { kind -> state.reaction = kind to state.clock(); state.wake() }
    }
    // the Dressing Room's change hop
    var lastToken by remember { mutableIntStateOf(hopToken) }
    LaunchedEffect(hopToken) { if (hopToken != lastToken) { lastToken = hopToken; tap(sound = false) } }
    // the eyes follow the finger on the Stage
    val finger = LocalMascotFinger.current
    if (follow && finger != null) {
        LaunchedEffect(finger) {
            snapshotFlow { finger.value }.collect { f -> if (f != null) state.look = LivingMascotRules.look(f.x, f.y, state.box) }
        }
    }

    val gestures = if (!tappable) Modifier else Modifier.pointerInput(Unit) {
        awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false)
            state.pressing = true
            state.wake()
            val up = waitForUpOrCancellation()
            state.pressing = false
            // not consumed: a parent's tap (the Stats card opens the Stage) still runs
            if (up != null) tap(sound = true) else state.wake()
        }
    }
    val a11y = if (tappable && label != null) Modifier.semantics { role = Role.Button; onClick(label) { tap(sound = true); true } } else Modifier
    Box(
        modifier.size(size)
            .onGloballyPositioned { c ->
                state.box = Rect(c.positionInWindow(), c.size.toSize())
                val b = c.boundsInWindow()
                val vis = b.width > 0f && b.height > 0f
                if (vis != state.visible) { state.visible = vis; if (vis) state.wake() }
            }
            .then(gestures).then(a11y),
    ) {
        val p = pieces
        if (p == null) {
            MascotAvatar(config, initial, size, pro = pro, cutout = cutout)
        } else {
            Canvas(Modifier.fillMaxSize().clearAndSetSemantics { }) {
                val f = state.frame ?: return@Canvas
                val look = state.look
                val tf = AvatarFit.liveTransforms(layout, drawn.body, f, look.x.toDouble(), look.y.toDouble(), data)
                drawIntoCanvas { MascotComposer.drawLive(context, it.nativeCanvas, this.size.minDimension, drawn, letter, cutout, dark, layout, p, tf) }
            }
            if (pro) ProAvatarCrown(size)
        }
    }
}
