package com.wordocious.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.data.AvatarFields
import com.wordocious.app.data.MascotConfigRules
import com.wordocious.app.data.PlayerAvatars
import kotlinx.serialization.json.JsonElement

/**
 * FINISH_SPEC BJ5 — THE player avatar on Android: every board row, podium, Sweep row,
 * yesterday's winner, Records holder, Friends row, profile, VS card and share goes through
 * here, so they all follow core resolveAvatar's precedence (custom photo when display =
 * "photo" → saved mascot → worn cast hero → seeded mascot) with the signed-in player's own
 * look always taken from their local profile. Pass whatever the row carries; a row that
 * says nothing beyond the name is batch-looked-up (PlayerAvatars) and recomposes when the
 * profile lands. [pro] adds the AA2 crown + the Pro gold frame when no frame is chosen.
 */
@Composable
fun PlayerAvatar(
    username: String?,
    size: Dp,
    modifier: Modifier = Modifier,
    userId: String? = null,
    avatarUrl: String? = null,
    config: JsonElement? = null,
    castId: String? = null,
    frame: String? = null,
    accentHex: String? = null,
    pro: Boolean = isOwnProAvatar(username),
    contentDescription: String? = null,
    /**
     * 10-06: draw the player's OWN mascot as the living mascot (the Stats card; only while
     * AvatarLiveConfig.LIVING_MASCOT is on). Lists never pass it: they stay still.
     */
    live: Boolean = false,
    /**
     * 2.8 item 13: a podium place (1-3) — with the living mascot on, a MASCOT player stands full-body (no tile) in the pose of
     * their place (1st cheers, 2nd claps, 3rd waves); the caller sizes it with [podiumStands]. Photos keep the framed tile.
     */
    podiumPlace: Int? = null,
    /**
     * 2.8 item 22: stand the player's mascot full-body (living, no tile) in its idle pose, the waiting lobby's stage figure.
     * Photos keep the framed tile, and with the living mascot off the tile is drawn.
     */
    standing: Boolean = false,
) {
    val row = remember(userId, username, avatarUrl, config, castId, frame, accentHex) {
        AvatarFields(userId, username, avatarUrl, config, castId, frame, accentHex)
    }
    // Reads snapshot state (the directory + the own profile patch): recomposes on a lookup / an edit.
    val resolved = PlayerAvatars.resolve(row)
    if (row.isPartial) {
        LaunchedEffect(userId, username) {
            if (PlayerAvatars.known(userId, username)?.complete != true) PlayerAvatars.requestLookup(userId, username)
        }
    }
    val photo = resolved.photoUrl
    if (photo != null) {
        // BJ5 photo rule: a photo is a framed PORTRAIT, never a face on a mascot body — the
        // chosen frame, else the Pro gold, else (level known: the signed-in player) their tier frame.
        val level = if (PlayerAvatars.isOwn(userId, username)) com.wordocious.app.data.AuthService.profile.value?.level else null
        PhotoAvatar(
            photo, size, modifier,
            frame = com.wordocious.app.data.AvatarDirectoryRules.portraitFrame(resolved.config.frame, pro, level),
            pro = pro, contentDescription = contentDescription,
        )
    } else {
        val initial = remember(username) { MascotConfigRules.initialOf(username) }
        if (podiumPlace != null && com.wordocious.core.AvatarLiveConfig.LIVING_MASCOT) {
            val posed = remember(resolved.config, podiumPlace) { resolved.config.copy(pose = com.wordocious.core.AvatarPoses.placePose(podiumPlace)) }
            LivingMascot(posed, initial, size, modifier, cutout = true, pro = pro, own = PlayerAvatars.isOwn(userId, username), tappable = false, label = null)
        } else if (standing && com.wordocious.core.AvatarLiveConfig.LIVING_MASCOT) {
            LivingMascot(resolved.config, initial, size, modifier, cutout = true, pro = pro, own = PlayerAvatars.isOwn(userId, username), tappable = false, label = null)
        } else if (live && com.wordocious.core.AvatarLiveConfig.LIVING_MASCOT && PlayerAvatars.isOwn(userId, username)) {
            LivingMascot(resolved.config, initial, size, modifier, pro = pro, label = null)
        } else MascotAvatar(resolved.config, initial, size, modifier, pro = pro)
    }
}


/**
 * 2.8 item 13: whether this podium entry stands full-body (a mascot player, the living mascot on) — the podium draws it at
 * [PODIUM_FIGURE_SCALE] times the tile size and sinks its feet [PODIUM_FOOT_OVERLAP] into the step.
 */
@Composable
fun podiumStands(
    username: String?, userId: String?, avatarUrl: String?, config: JsonElement?, castId: String?, frame: String?, accentHex: String?,
): Boolean {
    if (!com.wordocious.core.AvatarLiveConfig.LIVING_MASCOT) return false
    val row = remember(userId, username, avatarUrl, config, castId, frame, accentHex) {
        AvatarFields(userId, username, avatarUrl, config, castId, frame, accentHex)
    }
    return PlayerAvatars.resolve(row).photoUrl == null
}

const val PODIUM_FIGURE_SCALE = 2.0f
val PODIUM_FOOT_OVERLAP = 12.dp
