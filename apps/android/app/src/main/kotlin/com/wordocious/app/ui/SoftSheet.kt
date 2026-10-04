package com.wordocious.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.MotionSpec
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.pow

/** BJ10: the soft spring (MotionSpec POP_MS response, POP_DAMPING). */
internal fun <T> softPopSpring() = spring<T>(
    dampingRatio = MotionSpec.POP_DAMPING,
    stiffness = (2 * PI / (MotionSpec.POP_MS / 1000.0)).pow(2).toFloat(),
)

/**
 * FINISH_SPEC BJ10 — the app's bottom sheet, soft-popped: the background dims and the
 * sheet springs up gently from the bottom center (scale 0.94 → 1 + fade) instead of
 * sliding; dismiss (scrim tap, back, a swipe) reverses quickly. A drop-in for
 * Material's ModalBottomSheet at the app's call sites (`sheetState` is accepted and
 * ignored). Swipe-to-dismiss follows the finger — from the handle area or by pulling
 * a scrolled-to-top list further down — then soft-dismisses past the threshold.
 *
 * Smoothness: the content composes (is built) in the first frame at alpha 0; the pop
 * starts the frame after. Everything animated is read in graphicsLayer lambdas only.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SoftModalSheet(
    onDismissRequest: () -> Unit,
    sheetState: SheetState? = null,
    containerColor: Color = WTheme.surface,
    dragHandle: (@Composable () -> Unit)? = { BottomSheetDefaults.DragHandle() },
    content: @Composable ColumnScope.() -> Unit,
) {
    @Suppress("UNUSED_VARIABLE") val unused = sheetState
    val reduce = WTheme.reducedMotion
    var closing by remember { mutableStateOf(false) }
    val appear = remember { Animatable(0f) }
    var drag by remember { mutableFloatStateOf(0f) }
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val threshold = with(density) { 120.dp.toPx() }

    val close: () -> Unit = {
        if (!closing) {
            closing = true
            scope.launch {
                appear.animateTo(0f, tween(if (reduce) MotionSpec.CROSS_FADE_MS else MotionSpec.POP_DISMISS_MS, easing = FastOutLinearInEasing))
                onDismissRequest()
            }
        }
    }
    val settle: (Float) -> Unit = { velocity ->
        if (drag > threshold || velocity > 1600f) close()
        else scope.launch { animate(drag, 0f, animationSpec = softPopSpring()) { v, _ -> drag = v } }
    }
    val nested = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                // Pulled down, then back up: the sheet returns before the list scrolls.
                if (available.y < 0f && drag > 0f) {
                    val used = max(available.y, -drag)
                    drag += used
                    return Offset(0f, used)
                }
                return Offset.Zero
            }

            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                // A list at its top pulled further down: the sheet follows the finger.
                if (source == NestedScrollSource.UserInput && available.y > 0f) {
                    drag += available.y
                    return Offset(0f, available.y)
                }
                return Offset.Zero
            }

            override suspend fun onPreFling(available: Velocity): Velocity {
                if (drag > 0f) { settle(available.y); return available }
                return Velocity.Zero
            }
        }
    }

    // 10-03 (AVD check): inside the dialog window the nav-bar inset can read 0 (the Close row sat
    // under the gesture bar), so the host activity's own inset is the floor.
    val hostView = LocalView.current
    val hostNavBottom = remember(hostView) {
        androidx.core.view.ViewCompat.getRootWindowInsets(hostView)
            ?.getInsets(androidx.core.view.WindowInsetsCompat.Type.navigationBars())?.bottom ?: 0
    }
    Dialog(
        onDismissRequest = close,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        // Our own scrim fades with the pop (the platform dim is off).
        EdgeToEdgeDialogWindow(dimAmount = 0f)
        // Built this frame (alpha 0), popped from the next.
        LaunchedEffect(Unit) { appear.animateTo(1f, if (reduce) tween(MotionSpec.CROSS_FADE_MS) else softPopSpring()) }
        BackHandler { close() }
        Box(Modifier.fillMaxSize()) {
            Box(
                Modifier.fillMaxSize()
                    .graphicsLayer { alpha = appear.value.coerceIn(0f, 1f) }
                    .background(Color.Black.copy(alpha = MotionSpec.DIM_ALPHA))
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = close),
            )
            Column(
                Modifier.align(Alignment.BottomCenter).statusBarsPadding()
                    .widthIn(max = 640.dp).fillMaxWidth()
                    .graphicsLayer {
                        val p = appear.value
                        alpha = (p / 0.55f).coerceIn(0f, 1f)
                        if (!reduce) {
                            val s = MotionSpec.POP_SCALE + (1f - MotionSpec.POP_SCALE) * p
                            scaleX = s; scaleY = s
                            transformOrigin = TransformOrigin(0.5f, 1f)   // the bottom center
                        }
                        translationY = drag
                    }
                    .draggable(
                        rememberDraggableState { d -> drag = (drag + d).coerceAtLeast(0f) },
                        Orientation.Vertical,
                        onDragStopped = { v -> settle(v) },
                    )
                    .nestedScroll(nested)
                    .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
                    .background(containerColor)
                    // Like ModalBottomSheet: the sheet takes the nav-bar inset (and consumes it).
                    .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets(bottom = hostNavBottom))),
            ) {
                dragHandle?.let { Box(Modifier.align(Alignment.CenterHorizontally)) { it() } }
                content()
            }
        }
    }
}

/**
 * BJ10 for the app's full-screen popups (streak / shield / flawless, guides): the
 * card's scale from the bottom center at [appear] (0 → 1).
 */
fun Modifier.softPopScale(appear: () -> Float): Modifier = graphicsLayer {
    val p = appear()
    val s = MotionSpec.POP_SCALE + (1f - MotionSpec.POP_SCALE) * p
    scaleX = s; scaleY = s
    transformOrigin = TransformOrigin(0.5f, 1f)
}

/**
 * Inside a `Dialog(decorFitsSystemWindows = false)`: lay the dialog window over the system bars
 * too. On API 30+ a dialog window otherwise gets a frame inset by the status + nav bars while its
 * content measures the full display (seen 10-03 on the API 35 AVD: the finished "More" sheet's
 * Close button sat under the gesture bar, cut off). The content pads its own insets.
 */
@Composable
fun EdgeToEdgeDialogWindow(dimAmount: Float? = null) {
    val view = LocalView.current
    SideEffect {
        val w = (view.parent as? DialogWindowProvider)?.window ?: return@SideEffect
        dimAmount?.let { w.setDimAmount(it) }
        w.addFlags(android.view.WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN)
        val a = w.attributes
        var changed = false
        if (android.os.Build.VERSION.SDK_INT >= 28 && a.layoutInDisplayCutoutMode !=
            android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES) {
            a.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            changed = true
        }
        if (android.os.Build.VERSION.SDK_INT >= 30 && a.fitInsetsTypes != 0) { a.fitInsetsTypes = 0; changed = true }
        if (changed) w.attributes = a
    }
}
