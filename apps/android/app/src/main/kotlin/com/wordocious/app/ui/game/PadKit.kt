package com.wordocious.app.ui.game

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.semantics.clearAndSetSemantics
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
import com.wordocious.app.ui.HelperButton
import com.wordocious.app.ui.helperTint
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
 * BI22: the label never carries a count — [count] (hints / checks used) shows as the gold
 * [HintCountBadge] pinned over the top-right corner (an overlay: no layout change), and a
 * label that does change (a countdown, "Reveal all?") keeps [reserveLabel]'s width.
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
    /** BI22: a label that changes ("Reveal · 4:59") reserves this widest variant's width. */
    reserveLabel: String? = null,
    /** BI22: hints / checks used, shown as the corner badge (0 = none). */
    count: Int = 0,
) {
    // The button family: a HELPER pill in the game's accent (off a game a non-purple [color]'s tint); [active] =
    // the selected helper (solid tint, white ink); the icon is its 3D family art when it has one.
    val tint = color.takeIf { it != CandyColor.PURPLE && it != CandyColor.PEACH }?.helperTint()
    val description = hintCountDescription(label, count) + if (active) ", on" else ""
    Box(modifier) {
        if (reserveLabel == null) {
            HelperButton(
                label, onClick = { if (!dim) onClick() }, tint = tint, vector = icon, selected = active,
                enabled = !dim, contentDescription = description,
            )
        } else {
            ReservedWidth(reserve = { HelperButton(reserveLabel, onClick = {}, tint = tint, vector = icon, selected = active, enabled = false) }) {
                HelperButton(
                    label, onClick = { if (!dim) onClick() }, tint = tint, vector = icon, selected = active, fill = true,
                    enabled = !dim, contentDescription = description,
                )
            }
        }
        HintCountBadge(count, Modifier.align(Alignment.TopEnd).offset(x = 5.dp, y = (-7).dp))
    }
}

private val BADGE_TOP = Color(0xFFFFE27A)
private val BADGE_BOTTOM = Color(0xFFF5A524)
private val BADGE_LIP = Color(0xFFB45309)
private val BADGE_INK = Color(0xFF7A3D00)

/**
 * BI22 the used-count badge: a small glossy gold coin (17 dp tall, at least 17 dp wide, a
 * 1.5 dp white inner rim, a 2 dp amber lip below) with the count ([hintCountText]: hidden at
 * 0, "99+" past 99). Place it as an overlay (align + offset) so it never changes layout;
 * TalkBack reads the count from the button's description instead.
 */
@Composable
fun HintCountBadge(count: Int, modifier: Modifier = Modifier) {
    val text = hintCountText(count)
    if (text.isEmpty()) return
    Box(
        modifier
            .clearAndSetSemantics { }
            .height(17.dp)
            .widthIn(min = 17.dp)
            .drawBehind {
                val r = CornerRadius(size.height / 2f)
                val lip = 2.dp.toPx()
                drawRoundRect(BADGE_LIP, topLeft = androidx.compose.ui.geometry.Offset(0f, lip), size = size, cornerRadius = r)
                drawRoundRect(Brush.verticalGradient(listOf(BADGE_TOP, BADGE_BOTTOM)), size = size, cornerRadius = r)
                val rim = 1.5.dp.toPx()
                drawRoundRect(
                    Color.White, topLeft = androidx.compose.ui.geometry.Offset(rim / 2f, rim / 2f),
                    size = Size(size.width - rim, size.height - rim), cornerRadius = CornerRadius(size.height / 2f - rim / 2f),
                    style = androidx.compose.ui.graphics.drawscope.Stroke(rim),
                )
            }
            .padding(horizontal = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, fontSize = 10.sp, fontWeight = FontWeight.Black, color = BADGE_INK, fontFamily = Nunito, maxLines = 1, softWrap = false)
    }
}

/**
 * BI22 lays [content] out exactly as wide as [reserve] would be (the reserve is measured,
 * never placed: not drawn, not touchable, not read by TalkBack), so a button whose label
 * counts up ("Hint" → "Hint · 3") or ticks ("Reveal · 4:59") never changes width and never
 * nudges its row. [content] should fill the width it is given (a candy with fill = true).
 */
@Composable
fun ReservedWidth(reserve: @Composable () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    androidx.compose.ui.layout.Layout(
        contents = listOf({ Box(Modifier.clearAndSetSemantics { }) { reserve() } }, content),
        modifier = modifier,
    ) { (ghost, real), constraints ->
        val g = ghost.first().measure(constraints.copy(minWidth = 0))
        val w = g.width.coerceIn(constraints.minWidth, constraints.maxWidth)
        val p = real.first().measure(constraints.copy(minWidth = w, maxWidth = w))
        layout(p.width, p.height) { p.place(0, 0) }
    }
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
    // The button family (iOS HelperButtonStyle(used:)): a HELPER pill (the game accent in a game, else [color]'s
    // tint); once spent it keeps its place carrying [usedLabel] in the explicit used look (saturation .25, 50%).
    HelperButton(
        if (used) usedLabel else label, onClick = { if (!used) onClick() }, modifier = modifier,
        tint = color.helperTint(), vector = icon, used = used, enabled = !used, fill = fill,
        contentDescription = if (used) usedLabel else label,
    )
}
