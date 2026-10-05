package com.wordocious.app.ui.game

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme

// BI22 (founder, 2026-10-03): the ProperNoundle Clue used to appear as a multi-line Wikipedia
// paragraph in the header flow, taking its height straight out of the board. It now sits in
// a fixed two-line slot that is always present (empty when idle), and tapping it opens the
// whole clue as an overlay card. Shared by the solo and VS ProperNoundle screens; iOS parity.

private val PN_RED = Color(0xFFDC2626)

/**
 * The always-present clue slot under the ProperNoundle header: [HintLayout.clueLines] lines of the
 * 13 sp italic clue (tail ellipsis), empty until the Clue is used ("Finding a clue…" while it loads).
 * Tapping a clue calls [onOpen] (the full-clue overlay).
 */
@Composable
fun ProperNoundleClueSlot(
    clue: String?, loading: Boolean, onOpen: () -> Unit, modifier: Modifier = Modifier,
    onPlaced: (topInRootPx: Float) -> Unit = {},
) {
    val lineDp = with(LocalDensity.current) { HintLayout.CLUE_LINE_SP.sp.toDp() }.value
    val lines = HintLayout.clueLines(androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp)
    val slotH = HintLayout.clueSlotHeight(lineDp, clue, lines).dp
    Box(
        modifier.fillMaxWidth().height(slotH)
            .onGloballyPositioned { onPlaced(it.positionInRoot().y) }
            .padding(start = 20.dp, end = 20.dp, top = HintLayout.CLUE_TOP_PAD.dp),
        contentAlignment = Alignment.TopCenter,
    ) {
        when {
            clue != null -> Text(
                clue, color = WTheme.textSecondary, fontSize = HintLayout.CLUE_SP.sp, lineHeight = 1.3.em,
                fontStyle = FontStyle.Italic, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center,
                maxLines = lines, overflow = TextOverflow.Ellipsis,
                // Unbounded height: only maxLines decides where the clue ellipsizes, never the slot's
                // rounding (the old exact-fit slot cut the clue to one line).
                modifier = Modifier.wrapContentHeight(Alignment.Top, unbounded = true)
                    .clickableNoRipple { onOpen() }.semantics {
                        role = Role.Button
                        onClick(label = "Read the whole clue") { onOpen(); true }
                    },
            )
            loading -> Text(
                "Finding a clue…", color = WTheme.textMuted, fontSize = HintLayout.CLUE_SP.sp, lineHeight = 1.3.em,
                fontStyle = FontStyle.Italic, fontWeight = FontWeight.SemiBold, maxLines = 1,
            )
        }
    }
}

/**
 * The whole ProperNoundle clue as a soft-pop card over the game (tap outside, the X or Back
 * to close). Its top edge is the clue slot's top ([anchorTopPx], from the slot's `onPlaced`),
 * so the title art and the category line stay clear (Johnny 10-05: the centered card covered
 * the title art); full width with 14 dp margins, and a clue taller than the room down to the
 * screen's bottom scrolls inside the card. Fade + scale (instant with Reduce Motion); a soft
 * shadow, no border. Put it in the screen's root Box so it covers the game.
 */
@Composable
fun ProperNoundleClueOverlay(text: String, anchorTopPx: Float? = null, onDismiss: () -> Unit) {
    val still = WTheme.reducedMotion
    val t = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(Unit) { if (!still) t.animateTo(1f, tween(180)) }
    androidx.activity.compose.BackHandler { onDismiss() }
    val shape = RoundedCornerShape(22.dp)
    var selfTop by remember { mutableFloatStateOf(0f) }
    val density = LocalDensity.current
    val top = with(density) { ((anchorTopPx ?: 0f) - selfTop).coerceAtLeast(0f).toDp() } - 4.dp
    Box(
        Modifier.fillMaxSize()
            .onGloballyPositioned { selfTop = it.positionInRoot().y }
            .graphicsLayer { alpha = t.value }
            .background(Color.Black.copy(alpha = 0.28f))
            .clickableNoRipple { onDismiss() },
        contentAlignment = if (anchorTopPx == null) Alignment.Center else Alignment.TopCenter,
    ) {
        Column(
            Modifier.padding(start = 14.dp, end = 14.dp, bottom = 16.dp, top = if (anchorTopPx == null) 16.dp else top.coerceAtLeast(0.dp))
                .widthIn(max = 460.dp).fillMaxWidth()
                .graphicsLayer {
                    val s = 0.94f + 0.06f * t.value; scaleX = s; scaleY = s
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 1f)
                }
                .shadow(18.dp, shape, clip = false)
                .clip(shape)
                .background(WTheme.surface)
                .clickableNoRipple { }
                .padding(start = 20.dp, end = 6.dp, top = 4.dp, bottom = 18.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("CLUE", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = PN_RED,
                    fontFamily = Nunito, modifier = Modifier.weight(1f))
                com.wordocious.app.ui.PopupClose(onDismiss, tint = WTheme.textMuted)
            }
            Text(
                text, fontSize = 16.sp, lineHeight = 1.45.em, fontWeight = FontWeight.SemiBold, fontStyle = FontStyle.Italic,
                color = WTheme.text,
                modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(end = 14.dp),
            )
        }
    }
}
