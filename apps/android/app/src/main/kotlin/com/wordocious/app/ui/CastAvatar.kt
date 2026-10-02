package com.wordocious.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AvatarCast
import com.wordocious.app.data.AvatarFrame
import com.wordocious.app.ui.theme.WTheme

// FINISH_SPEC AH — the drawing half of pick-a-character avatars (logic:
// data/AvatarCast.kt). LetterTileAvatar calls these, so every avatar path that
// falls back to the letter tile wears the player's character + frame.

/** The MascotId for a stored character id ("w", "o1", …), or null. */
fun castMascot(castId: String?): MascotId? {
    val id = AvatarCast.normalize(castId) ?: return null
    return MascotId.entries.firstOrNull { it.name.lowercase() == id }
}

/** The character's own color (BotCast), purple for an unknown id. */
fun castColor(castId: String?): Color = Color(AvatarCast.colorArgb(castId) ?: 0xFF7C3AED)

/**
 * The character's hero art on a tinted circle in its own color, [size] square.
 * Decorative: the caller's row / button carries the name.
 */
@Composable
fun CastAvatarFace(castId: String, size: Dp, modifier: Modifier = Modifier) {
    val mascot = castMascot(castId) ?: return
    val c = castColor(castId)
    val dark = WTheme.isDark
    val top = if (dark) lerp(WTheme.surface, c, 0.42f) else lerp(Color.White, c, 0.22f)
    val bottom = if (dark) lerp(WTheme.surface, c, 0.62f) else lerp(Color.White, c, 0.42f)
    Box(
        modifier.size(size).clearAndSetSemantics { }
            .clip(CircleShape)
            .background(Brush.verticalGradient(listOf(top, bottom)))
            .border((size * 0.04f).coerceAtLeast(1.dp), c.copy(alpha = 0.55f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        // The hero stands a touch low so the face sits in the middle of the circle.
        Image(
            painterResource(mascot.res), contentDescription = null,
            modifier = Modifier.size(size * 0.86f).offset(y = size * 0.06f),
        )
    }
}

/** The ring thickness for a frame on a [size] avatar (the face is inset by it). */
fun avatarFrameWidth(size: Dp): Dp = (size * 0.075f).coerceIn(2.dp, 8.dp)

/**
 * A level-tier frame filling a [size] box — AN6: always the ROUNDED-SQUARE frame (the
 * mascot tile shape), never a ring. [circle] is kept for source compatibility and ignored.
 */
@Composable
@Suppress("UNUSED_PARAMETER")
fun AvatarFrameRing(frame: String, size: Dp, circle: Boolean, modifier: Modifier = Modifier) {
    val key = AvatarFrame.normalize(frame) ?: frame.takeIf { it == "pro" } ?: return
    AvatarSquareFrame(key, size, modifier)
}

/**
 * The avatar a player picks in Edit Profile: [castId] on its tinted circle, else
 * [photoUrl] in a circle, else the letter tile — with the [frame] ring and the
 * AA2 Pro decoration via LetterTileAvatar. Never looks the username up (the
 * editor shows the live, unsaved choice).
 */
@Composable
fun ChosenAvatar(
    username: String,
    size: Dp,
    castId: String?,
    photoUrl: String?,
    frame: String?,
    modifier: Modifier = Modifier,
    accentHex: String? = null,
    emoji: String? = null,
    pro: Boolean = false,
    contentDescription: String? = null,
) {
    val cast = AvatarCast.normalize(castId)
    if (cast == null && !photoUrl.isNullOrBlank()) {
        // AN6: the photo is a rounded square inside its rounded-square frame.
        PhotoAvatar(photoUrl, size, modifier, frame = AvatarFrame.normalize(frame), pro = pro, contentDescription = contentDescription)
        return
    }
    LetterTileAvatar(
        username, size, modifier, accentHex = accentHex, emoji = emoji, pro = pro,
        castId = cast, frame = frame, lookup = false,
    )
}

// The AH Edit Profile pickers (CastPickerGrid / FramePicker) were retired by FINISH_SPEC AN4:
// the cast are presets and the frames a tab in the mascot builder (ui/MascotBuilder.kt).
