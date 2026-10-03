package com.wordocious.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
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
        MascotAvatar(resolved.config, initial, size, modifier, pro = pro)
    }
}
