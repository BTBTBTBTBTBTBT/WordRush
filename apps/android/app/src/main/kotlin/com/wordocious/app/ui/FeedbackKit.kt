package com.wordocious.app.ui

import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.platform.LocalView
import com.wordocious.app.data.FeedbackEvent
import com.wordocious.app.data.SoundManager

/**
 * FINISH_SPEC U — Compose glue for sound + haptics.
 *
 * - [squishFeedback]: the candy-button / squish press (`press` · soft on touch-down,
 *   `release` on lift; a cancel — e.g. the touch turned into a scroll — stays silent).
 * - [LocalSquishSound]: provide `false` around surfaces that already make their own
 *   sound per touch (the game keyboard, pads, board cells) so a key never double-clicks.
 * - [rememberFeedback] / [FeedbackOnShow]: fire a [FeedbackEvent] with this view's haptics.
 */
val LocalSquishSound = staticCompositionLocalOf { true }

/** Spec U squish press/release feedback, driven by the same [interaction] as the squish. */
fun Modifier.squishFeedback(interaction: InteractionSource): Modifier = composed {
    if (!LocalSquishSound.current) return@composed this
    val view = LocalView.current
    LaunchedEffect(interaction) {
        interaction.interactions.collect { i ->
            when (i) {
                is PressInteraction.Press ->
                    // A key sound just played = the same touch on a board/pad: the key sound wins.
                    if (!SoundManager.keyRecentlyPlayed()) SoundManager.fire(FeedbackEvent.PRESS, view)
                is PressInteraction.Release ->
                    if (!SoundManager.keyRecentlyPlayed()) SoundManager.fire(FeedbackEvent.RELEASE, view)
            }
        }
    }
    this
}

/** A fire(event) bound to this composable's view (haptics land on the right window). */
@Composable
fun rememberFeedback(): (FeedbackEvent) -> Unit {
    val view = LocalView.current
    return remember(view) { { e: FeedbackEvent -> SoundManager.fire(e, view) } }
}

/** Fire [event] once when this enters composition (again whenever [key] changes). */
@Composable
fun FeedbackOnShow(event: FeedbackEvent, key: Any? = Unit) {
    val view = LocalView.current
    LaunchedEffect(key) { SoundManager.fire(event, view) }
}
