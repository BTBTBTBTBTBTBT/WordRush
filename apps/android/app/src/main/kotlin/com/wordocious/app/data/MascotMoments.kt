package com.wordocious.app.data

import com.wordocious.core.AvatarLiveConfig
import com.wordocious.core.AvatarReaction
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * The living mascot's moments (web lib/living-mascot.ts emitMascotMoment): a win (cheer), a loss (shrug), a
 * streak +1 (hop), a level up (cheer). App-wide; the player's own LivingMascot collects it. A no-op while
 * AvatarLiveConfig.LIVING_MASCOT is off (the default).
 *
 * Emitted from: VictoryOverlay (win / loss, the main game's result card) and XpToast (level up, else a streak
 * bonus), mirroring web victory-animation / game-over-animation / xp-toast.
 */
object MascotMoments {
    private val events = MutableSharedFlow<AvatarReaction>(extraBufferCapacity = 4)

    val flow: SharedFlow<AvatarReaction> = events.asSharedFlow()

    /** Tell the player's living mascot a moment happened (never throws, never suspends). */
    fun emit(kind: AvatarReaction) {
        if (!AvatarLiveConfig.LIVING_MASCOT) return
        events.tryEmit(kind)
    }
}
