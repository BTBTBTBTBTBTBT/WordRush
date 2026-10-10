package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.wordocious.app.data.AvatarFields
import com.wordocious.app.data.PlayerAvatars
import com.wordocious.core.PlayerTint
import com.wordocious.core.avatarColorHex
import kotlinx.serialization.json.JsonElement

/** The three inks of a podium plaque, picked for contrast against its fill (founder 10-09). */
class PlaqueInk(val lightInk: Boolean) {
    val heading: Color = if (lightInk) Color.White else Color(0xFF2A1650)
    val muted: Color = if (lightInk) Color.White.copy(alpha = 0.82f) else Color(0xFF5B4B7A)
    /** The gold highlight (FLAWLESS / streak): bright gold on dark, deep amber on light. */
    val badge: Color = if (lightInk) Color(0xFFF5B82E) else Color(0xFFB45309)
}

private fun hex(c: String): Color = Color(android.graphics.Color.parseColor(c))

private fun List<String>.fillBrush(diagonal: Boolean): Brush {
    val colors = map(::hex).let { if (it.size > 1) it else listOf(it[0], it[0]) }
    return if (diagonal) Brush.linearGradient(colors) else Brush.verticalGradient(colors)
}

/**
 * Founder 10-09: the name / points / badge / detail plaque under a podium player wears THEIR mascot-maker backdrop
 * (the fill, a top-left to bottom-right gradient) and frame (the border), 12 dp radius and a soft shadow; the ink follows
 * the fill's brightness so the stats read on any backdrop. Colors come from core PlayerTint (pinned to TS and Swift by
 * player-tint-fixtures.json), the config from the same resolver the avatar uses.
 */
@Composable
fun PodiumPlaque(
    userId: String?,
    username: String?,
    avatarUrl: String? = null,
    config: JsonElement? = null,
    castId: String? = null,
    frame: String? = null,
    accentHex: String? = null,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.(PlaqueInk) -> Unit,
) {
    val row = remember(userId, username, avatarUrl, config, castId, frame, accentHex) {
        AvatarFields(userId, username, avatarUrl, config, castId, frame, accentHex)
    }
    // Reads snapshot state (the directory + the own profile patch), like the avatar above it: recomposes on a lookup / an edit.
    val cfg = PlayerAvatars.resolve(row).config
    if (row.isPartial) {
        LaunchedEffect(userId, username) {
            if (PlayerAvatars.known(userId, username)?.complete != true) PlayerAvatars.requestLookup(userId, username)
        }
    }
    val plate = remember(cfg.bg, cfg.frame, cfg.color) { PlayerTint.plateHexes(cfg.bg, cfg.frame, avatarColorHex(cfg.color)) }
    val ink = remember(plate.lightInk) { PlaqueInk(plate.lightInk) }
    val shape = RoundedCornerShape(12.dp)
    val border = if (plate.border.size > 1) plate.border.fillBrush(diagonal = false) else SolidColor(hex(plate.border[0]))
    Column(
        modifier.zIndex(2f)
            .shadow(3.dp, shape, clip = false, ambientColor = Color.Black.copy(alpha = 0.18f), spotColor = Color.Black.copy(alpha = 0.18f))
            .background(plate.fill.fillBrush(diagonal = true), shape)
            .border(plate.borderWidth.dp, border, shape)
            .padding(PaddingValues(horizontal = 10.dp, vertical = 4.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) { content(ink) }
}
