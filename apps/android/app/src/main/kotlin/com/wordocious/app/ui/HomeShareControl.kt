package com.wordocious.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier

/**
 * FINISH_SPEC BJ6 (founder 10-03: "even and symmetrical"): Home's "Share today's progress"
 * moved OFF the Good Morning card into the app header's right-hand controls (beside ? and the
 * gear, same size and spacing). Home publishes whether it can share + the action; the header
 * draws the control on the Home tab only, once there is something to share (Daily, after the
 * first finished game). BJ6 round 3: no reserved slot when hidden.
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

/** The header's side: the share control (Home only), a [SoftControl] like ? and the gear; absent when hidden. */
@Composable
internal fun HomeShareControl(modifier: Modifier = Modifier) {
    val visible by HomeShareState.visible
    val action by HomeShareState.action
    val run = action
    // BJ6 round 3: no reserved slot — when Share isn't shown the header looks exactly as before.
    if (!visible || run == null) return
    SoftControl(Icon3DName.SHARE, "Share today's progress", onClick = { run() }, modifier = modifier)
}
