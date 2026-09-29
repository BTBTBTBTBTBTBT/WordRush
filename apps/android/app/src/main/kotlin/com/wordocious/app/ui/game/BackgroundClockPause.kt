package com.wordocious.app.ui.game

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

/**
 * The More Games clocks are wall-clock (startMs), so they ran on while the app sat in the
 * background: a tester's Hubbub daily recorded 337 minutes (founder, 2026-09-29). Every
 * More Games screen calls this: ON_STOP (home, app switch, screen lock, a full-screen ad)
 * pauses its session's clock for the background reason, ON_START lifts it. The classic
 * word games do the same through GameViewModel's ProcessLifecycleOwner observer.
 */
@Composable
fun PauseClockInBackground(key: Any, onStop: () -> Unit, onStart: () -> Unit) {
    val owner = LocalLifecycleOwner.current
    val stop by rememberUpdatedState(onStop)
    val start by rememberUpdatedState(onStart)
    DisposableEffect(owner, key) {
        val obs = LifecycleEventObserver { _, e ->
            when (e) { Lifecycle.Event.ON_STOP -> stop(); Lifecycle.Event.ON_START -> start(); else -> Unit }
        }
        owner.lifecycle.addObserver(obs)
        onDispose { owner.lifecycle.removeObserver(obs) }
    }
}
