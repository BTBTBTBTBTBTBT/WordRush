package com.wordocious.app.ui.game

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.FirstPlayResults
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
fun rememberFirstPlayAutoShow(key: String, hasResultsOverride: Boolean? = null): Boolean {
    val flags by FlagsService.flags.collectAsState()
    val seen by TutorialsSeen.seen.collectAsState()
    val profile by AuthService.profile.collectAsState()
    val played by FirstPlayResults.played.collectAsState()
    LaunchedEffect(profile?.id) { TutorialsSeen.ensureLoaded(); FirstPlayResults.ensureLoaded() }
    // Decided once when the screen opens: a save written by this very game must not retract the card.
    val dbKey = androidx.compose.runtime.remember(key) { FirstPlayResults.dbKeyForSlug(key) }
    val localSave = androidx.compose.runtime.remember(key) { dbKey?.let { FirstPlayResults.hasLocalSave(it) } ?: false }
    val live = FlagsService.isLive(PocketHelp.FIRST_PLAY_FLAG, flags)
    // Main games wait for the stats read (signed in) so an existing player never sees a flash of the card.
    val waitingForStats = hasResultsOverride == null && dbKey != null && !localSave && played == null
    val hasResults = when {
        hasResultsOverride != null -> hasResultsOverride
        dbKey == null -> false
        localSave -> true
        else -> played?.contains(dbKey) == true
    }
    val record = !waitingForStats && PocketHelp.tutorialShouldRecordSeen(live, seen, key, hasResults)
    LaunchedEffect(record, key) { if (record) TutorialsSeen.mark(key) }
    return !waitingForStats && PocketHelp.shouldAutoShowTutorial(live, seen, key, hasResults)
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
