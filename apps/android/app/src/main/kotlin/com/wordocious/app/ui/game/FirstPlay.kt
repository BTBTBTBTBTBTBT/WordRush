package com.wordocious.app.ui.game

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FlagsService
import com.wordocious.app.data.TutorialsSeen
import com.wordocious.core.PocketHelp

// First-play welcome (FRIDAY-QUEUE item 12, 2.8 wave 3): the first time a player opens ANY game (the 18 main
// games and the six pocket games) its help card opens by itself once, with "Let's play!" instead of "Got it".
// The decision is core (PocketHelp.shouldAutoShowTutorial), the off-switch is app_flags 'first_play_tutorials'
// (fail-open), and "seen" is TutorialsSeen (profiles.tutorials_seen synced, local copy for guests). A card that
// closes (button, scrim, back) marks its key seen. Main games key on the guide slug, pocket games on "pocket-<kind>".

/**
 * True while the card for [key] should be open by itself (the switch is live, "seen" is loaded and lacks [key]).
 * A game screen opens its guide (and pauses its clock) when this turns true:
 * `LaunchedEffect(firstPlay) { if (firstPlay) { showGuide = true; pause() } }`.
 */
@Composable
fun rememberFirstPlayAutoShow(key: String): Boolean {
    val flags by FlagsService.flags.collectAsState()
    val seen by TutorialsSeen.seen.collectAsState()
    val profile by AuthService.profile.collectAsState()
    LaunchedEffect(profile?.id) { TutorialsSeen.ensureLoaded() }
    return PocketHelp.shouldAutoShowTutorial(FlagsService.isLive(PocketHelp.FIRST_PLAY_FLAG, flags), seen, key)
}

/** The card's button: "Let's play!" the first time, "Got it" after. */
@Composable
fun firstPlayButtonLabel(key: String): String {
    val seen by TutorialsSeen.seen.collectAsState()
    // Decided when the card opens (the key is marked seen as it closes, so the label must not flip mid-close).
    return androidx.compose.runtime.remember(key) { seen?.contains(key) == false }.let {
        if (it) PocketHelp.TUTORIAL_BUTTON_FIRST else PocketHelp.TUTORIAL_BUTTON_AGAIN
    }
}
