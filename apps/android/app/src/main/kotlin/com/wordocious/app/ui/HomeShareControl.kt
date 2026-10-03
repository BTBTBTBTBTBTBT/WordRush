package com.wordocious.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import com.wordocious.app.ui.theme.WTheme

/**
 * FINISH_SPEC BJ6 (founder 10-03: "even and symmetrical"): Home's "Share today's progress"
 * moved OFF the Good Morning card into the app header's right-hand controls (beside ? and the
 * gear, same size and spacing). Home publishes whether it can share + the action; the header
 * draws the control on the Home tab only, its slot kept while hidden (Unlimited, or before
 * the first finished game) so the header never jumps.
 */
internal object HomeShareState {
    val visible = mutableStateOf(false)
    val action = mutableStateOf<(() -> Unit)?>(null)
}

/** Home's side: keep the header's share state in step with the banner. */
@Composable
internal fun HomeSharePublisher(visible: Boolean, onShare: () -> Unit) {
    SideEffect {
        HomeShareState.visible.value = visible
        HomeShareState.action.value = onShare
    }
    DisposableEffect(Unit) {
        onDispose { HomeShareState.visible.value = false; HomeShareState.action.value = null }
    }
}

/** The header's side: the share control (Home only), a [SoftControl] like ? and the gear. */
@Composable
internal fun HomeShareControl() {
    val visible by HomeShareState.visible
    val action by HomeShareState.action
    val shown = visible && action != null
    val alpha by animateFloatAsState(
        if (shown) 1f else 0f, if (WTheme.reducedMotion) snap() else tween(180), label = "homeShare",
    )
    if (shown) {
        SoftControl(
            Icon3DName.SHARE, "Share today's progress", onClick = { action?.invoke() },
            modifier = Modifier.graphicsLayer { this.alpha = alpha },
        )
    } else {
        // The slot stays (empty, silent) so the header never jumps.
        Box(Modifier.widthIn(min = SOFT_CONTROL_TAP).heightIn(min = SOFT_CONTROL_TAP).clearAndSetSemantics { })
    }
}
