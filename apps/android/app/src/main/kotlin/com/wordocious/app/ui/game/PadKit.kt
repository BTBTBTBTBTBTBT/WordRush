package com.wordocious.app.ui.game

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.CandyButton
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandySize
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.tintedPill

// The finishing build, phase 2 leftovers (FINISH_SPEC A8 + B2): the number pad keys
// (Sudoku) are key tiles like the keyboard's, and the in-game hint pills (Six / Seven /
// ProperNoundle) are glossy candy buttons that turn into a tinted pill carrying the
// revealed letter once used. Mirrors the web and iOS finishing kits.

/** B2 a pad key's paint: lilac lip, light face, dark-purple Nunito Black ink. */
private data class PadLook(val lip: Color, val faceTop: Color, val faceBottom: Color, val ink: Color)

private val PAD_PLAIN = PadLook(Color(0xFFCDB9F0), Color(0xF2FFFFFF), Color(0xE6FFFFFF), Color(0xFF3B1A78))
private val PAD_PLAIN_DARK = PadLook(Color(0xFF4A3B6E), Color(0xFF3A2D5C), Color(0xFF33284F), Color(0xFFF1EAFF))
/** Notes mode: the face takes a soft lilac wash so the pad reads as "pencil". */
private val PAD_NOTES = PadLook(Color(0xFFB79BEA), Color(0xFFF3ECFF), Color(0xFFE9DDFF), Color(0xFF5B21B6))
private val PAD_NOTES_DARK = PadLook(Color(0xFF5B4790), Color(0xFF45366E), Color(0xFF3D2F62), Color(0xFFE9DDFF))

private val PAD_CORNER = 9.dp
private val PAD_LIP = 3.dp

/**
 * B2 a number-pad key: a key tile (the keyboard's lilac lip, light face, dark-purple
 * Nunito Black digit) that squishes on press (A9). [notes] = the pencil look; [faded] =
 * the digit is complete on the board (still tappable, like before).
 */
@Composable
fun PadKey(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    notes: Boolean = false,
    faded: Boolean = false,
    contentDescription: String = label,
    fontSize: TextUnit = 22.sp,
) {
    val dark = WTheme.isDark
    val look = when {
        notes -> if (dark) PAD_NOTES_DARK else PAD_NOTES
        else -> if (dark) PAD_PLAIN_DARK else PAD_PLAIN
    }
    Box(
        modifier
            .squishClickable(contentDescription, onClick = onClick)
            .alpha(if (faded) 0.4f else 1f)
            .drawBehind {
                val r = CornerRadius(PAD_CORNER.toPx())
                drawRoundRect(look.lip, cornerRadius = r)
                val faceH = size.height - PAD_LIP.toPx()
                drawRoundRect(
                    Brush.verticalGradient(listOf(look.faceTop, look.faceBottom), endY = faceH),
                    size = Size(size.width, faceH), cornerRadius = r,
                )
                // The gloss across the top of the face.
                val gx = size.width * 0.1f
                drawRoundRect(
                    Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.5f), Color.White.copy(alpha = 0f)), startY = 2f, endY = faceH * 0.45f),
                    topLeft = androidx.compose.ui.geometry.Offset(gx, 2f),
                    size = Size(size.width - gx * 2, faceH * 0.42f),
                    cornerRadius = CornerRadius(PAD_CORNER.toPx() * 0.7f),
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label, fontSize = fontSize, fontWeight = FontWeight.Black, color = look.ink, fontFamily = Nunito,
            modifier = Modifier.padding(bottom = PAD_LIP),
        )
    }
}

/**
 * A8 a game control (Undo / Erase / Notes / Hint …) as a small candy button with a
 * white leading [icon]. [active] (a toggle that is on) wears [activeColor]; [dim] =
 * nothing to do right now (faded, taps ignored — the same as before).
 */
@Composable
fun PadAction(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: CandyColor = CandyColor.PEACH,
    active: Boolean = false,
    activeColor: CandyColor = CandyColor.PURPLE,
    dim: Boolean = false,
) {
    val c = if (active) activeColor else color
    CandyButton(
        label,
        onClick = { if (!dim) onClick() },
        modifier = modifier,
        color = c,
        size = CandySize.SMALL,
        enabled = !dim,
        contentDescription = if (active) "$label, on" else label,
        leading = { Icon(icon, null, tint = c.ink, modifier = Modifier.size(13.dp)) },
    )
}

/**
 * A8 an in-game hint: an unused hint is a candy button ([color]) with a leading [icon];
 * once used it becomes a tinted pill (A1) carrying [usedLabel] (the revealed letter, or
 * "No vowels left") — information, not a button.
 */
@Composable
fun HintCandy(
    label: String,
    usedLabel: String,
    used: Boolean,
    color: CandyColor,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    fill: Boolean = false,
    height: Dp = CandySize.MEDIUM.height,
) {
    if (!used) {
        CandyButton(
            label, onClick = onClick, modifier = modifier, color = color, size = CandySize.MEDIUM, fill = fill,
            leading = { Icon(icon, null, tint = Color.White, modifier = Modifier.size(15.dp)) },
        )
    } else {
        Row(
            modifier
                .then(if (fill) Modifier.fillMaxWidth() else Modifier)
                .padding(top = CandySize.MEDIUM.lip)
                .tintedPill(color.bottom, corner = height / 2)
                .semantics(mergeDescendants = true) {
                    disabled()
                    contentDescription = usedLabel
                }
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
        ) {
            Box(Modifier.size(1.dp, height))
            Icon(icon, null, tint = color.bottom, modifier = Modifier.size(14.dp))
            Text(
                usedLabel, fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 0.02.em,
                color = if (WTheme.isDark) WTheme.text else FinishInk.softNumber,
                maxLines = 1, overflow = TextOverflow.Ellipsis, fontFamily = Nunito,
            )
        }
    }
}
